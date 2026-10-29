package com.feelime.ime

import android.content.Context
import android.graphics.Typeface
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

import org.json.JSONObject

/**
 * 用户自定义键盘字体（issue #70）：单槽位。导入经魔数 + 大小校验
 * （#80 起 20MB 为软上限——超限回报 CONFIRM_LARGE 由用户确认后带
 * allowLarge 重导，100MB 为绝对上限）+ 平台 Typeface 解析后原子换入
 * filesDir/fonts/keyboard/。
 * 字体文件按摘要命名（font-<digest>.<ext>，不可变），meta.json 走
 * 临时文件 rename 原子替换、以它为提交标记——任一步失败都保住旧选择。
 *
 * WebView 侧经 /keyboard/fonts/<digest>/face.css 与同路径字体二进制
 * 加载——digest 进 URL，重导字体天然换 URL，绕开 WebView 对响应头的
 * 缓存钉死（ColorOS 实录见 KeyboardAssetStore）。
 *
 * 字体二进制不进备份：备份只带 keycap 偏好，换机后 digest 查不到文件，
 * hello 下发空 digest，键盘页自动回落系统字体栈（设置页提示重新导入）。
 * WebView 的 @font-face 对损坏/缺失字体的处理就是逐字回落字体栈，
 * 但导入侧仍以平台 Typeface 解析做真终验（review P2：魔数正确不代表
 * 字体可用，不能让导入悄悄换掉一款好字体）。
 */
object KeyboardFontStore {
    private const val DIR = "fonts/keyboard"
    private const val META = "meta.json"

    /** #80：20MB 只做软上限（确认后可继续——全量 CJK 字体普遍 20~40MB）；
     * 100MB 是绝对上限，防误选巨型文件把导入进程的堆读爆（整个文件先
     * 缓存在内存里再校验）。 */
    private const val SOFT_BYTES = 20L * 1024 * 1024
    private const val HARD_BYTES = 100L * 1024 * 1024

    /** digest 出现在 URL 路径段里，取前 16 位 hex 足够防撞+防猜测。 */
    private const val DIGEST_CHARS = 16

    data class UserFont(val digest: String, val ext: String, val name: String)

    sealed class ImportOutcome {
        class Ok(val font: UserFont) : ImportOutcome()

        /** CONFIRM_LARGE 带 bytes：设置页把大小讲给用户听（资源消耗提示），
         *  确认后带 allowLarge 重导。 */
        class Fail(val code: String, val bytes: Long = 0) : ImportOutcome()
    }

    /** 导入并原子换入。所有入口共用一把锁：导入（worker 线程）、清除
     *  （桥线程）与资源读取（WebView IO 线程）串行化，用户的最后一次
     *  操作按锁序生效，不会被在途导入覆盖（review P2）。 */
    @Synchronized
    fun importFromUri(
        context: Context,
        uri: Uri,
        /** SAF DISPLAY_NAME（SetupActivity 查询后传入）；lastPathSegment
         *  在部分提供者上是 document id，只作兜底。 */
        displayName: String? = null,
        /** 用户已在设置页确认「大字体资源消耗」提示（#80 软上限）。 */
        allowLarge: Boolean = false,
    ): ImportOutcome {
        val resolver = context.contentResolver
        val dir = File(context.filesDir, DIR).apply { mkdirs() }
        val tmpFont = File(dir, ".import.tmp")
        val tmpMeta = File(dir, ".meta.tmp")
        var total = 0L
        val head = ByteArray(4)
        val hasher = MessageDigest.getInstance("SHA-256")
        // 流式分块写临时文件、边写边算摘要（#80 review P1：100MB 上限下
        // 「分块列表 + 合并数组」双份同活峰值 ~200MB，低配设备直接 OOM；
        // 全程只留一个 64KB chunk）。魔数取首块前 4 字节。
        runCatching {
            resolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tmpFont).use { out ->
                    val chunk = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(chunk)
                        if (read < 0) break
                        total += read
                        if (total > HARD_BYTES) {
                            tmpFont.delete()
                            return ImportOutcome.Fail("TOO_LARGE")
                        }
                        if (total == read.toLong()) {
                            System.arraycopy(chunk, 0, head, 0, minOf(read, head.size))
                        }
                        hasher.update(chunk, 0, read)
                        out.write(chunk, 0, read)
                    }
                }
            } ?: run {
                tmpFont.delete()
                return ImportOutcome.Fail("IO_ERROR")
            }
        }.onFailure {
            tmpFont.delete()
            return ImportOutcome.Fail("IO_ERROR")
        }
        if (total == 0L) {
            tmpFont.delete()
            return ImportOutcome.Fail("IO_ERROR")
        }
        if (total > SOFT_BYTES && !allowLarge) {
            // 确认后重导会重新流式读一遍（SAF 临时授权仍在），不值得为
            // 省一次读把待确认文件挂在盘上。
            tmpFont.delete()
            return ImportOutcome.Fail("CONFIRM_LARGE", total)
        }
        val ext = when (detectFormat(head)) {
            "ttf" -> "ttf"
            "otf" -> "otf"
            else -> {
                tmpFont.delete()
                return ImportOutcome.Fail("BAD_MAGIC")
            }
        }
        val digest = hasher.digest().joinToString("") { "%02x".format(it) }.take(DIGEST_CHARS)
        // 展示名只进设置页 JSON，不进 CSS/HTML；截断防极端文件名。
        val name = (displayName ?: uri.lastPathSegment ?: "")
            .substringAfterLast('/')
            .take(64)
            .ifEmpty { "font.$ext" }

        val fontFile = File(dir, "font-$digest.$ext")
        runCatching {
            // 临时文件已写好，直接过平台解析器：魔数对但字形坏的文件在
            // 这里死掉，不碰现有字体（review P2）。
            runCatching { Typeface.createFromFile(tmpFont) }
                .onFailure {
                    tmpFont.delete()
                    return ImportOutcome.Fail("BAD_FONT")
                }
            if (!tmpFont.renameTo(fontFile)) {
                // 同摘要重导（幂等）：目标已存在即可收货。
                if (!(fontFile.isFile && digest == current(context)?.digest)) {
                    return ImportOutcome.Fail("IO_ERROR")
                }
                tmpFont.delete()
            }
            // meta 最后落：临时文件 rename 原子替换，meta 在 = 新选择生效。
            tmpMeta.writeText(
                JSONObject()
                    .put("digest", digest)
                    .put("ext", ext)
                    .put("name", name)
                    .toString(),
            )
            if (!tmpMeta.renameTo(File(dir, META))) return ImportOutcome.Fail("IO_ERROR")
        }.onFailure { return ImportOutcome.Fail("IO_ERROR") }
        // 清理其他摘要的旧文件（单槽位；失败无害，下次导入再清）。
        dir.listFiles { f -> f.name.startsWith("font-") && f.name != fontFile.name }
            ?.forEach { it.delete() }
        return ImportOutcome.Ok(UserFont(digest, ext, name))
    }

    /** 当前生效字体；meta 缺失/损坏或对应文件丢失都视为无字体。 */
    @Synchronized
    fun current(context: Context): UserFont? {
        val meta = File(File(context.filesDir, DIR), META)
        val obj = runCatching { JSONObject(meta.readText()) }.getOrNull() ?: return null
        val digest = obj.optString("digest").takeIf { it.isNotEmpty() } ?: return null
        val ext = obj.optString("ext").takeIf { it == "ttf" || it == "otf" } ?: return null
        if (!File(File(context.filesDir, DIR), "font-$digest.$ext").isFile) return null
        return UserFont(digest, ext, obj.optString("name"))
    }

    @Synchronized
    fun clear(context: Context) {
        File(context.filesDir, DIR).deleteRecursively()
    }

    /** 键盘 WebView 的字体路由（拦截器只放行 /keyboard/fonts/ 前缀）。
     *  digest 不匹配当前导入一律 null（调用方回 404）；文件在读取瞬间
     *  被清除也归 null，不向上抛（review P2）。face.css 相对引用同目录
     *  二进制，整个路由 no-store。 */
    @Synchronized
    fun response(context: Context, path: String): WebResourceResponse? {
        val font = current(context) ?: return null
        val parts = path.removePrefix("/keyboard/fonts/")
            .split('/').filter { it.isNotEmpty() }
        if (parts.size != 2 || parts[0] != font.digest) return null
        val headers = mapOf("Cache-Control" to "no-store")
        return when {
            parts[1] == "face.css" -> WebResourceResponse(
                "text/css", "UTF-8", 200, "OK", headers,
                ("@font-face{font-family:\"FeelimeUser\";src:url(\"font.${font.ext}\") " +
                    formatHint(font.ext) + "}").byteInputStream(),
            )
            parts[1] == "font.${font.ext}" -> {
                val file = File(File(context.filesDir, DIR), "font-${font.digest}.${font.ext}")
                runCatching {
                    WebResourceResponse(
                        if (font.ext == "otf") "font/otf" else "font/ttf",
                        null, 200, "OK", headers, file.inputStream(),
                    )
                }.getOrNull()
            }
            else -> null
        }
    }

    private fun formatHint(ext: String) = if (ext == "otf") "format(\"opentype\")" else "format(\"truetype\")"

    /** TTF 单字体以 0x00010000 或 "true" 开头；OTF/CFF 以 "OTTO" 开头。
     *  TTC 集合（"ttcf"）不在首版范围。 */
    private fun detectFormat(data: ByteArray): String? {
        if (data.size < 4) return null
        val tag = String(data, 0, 4, Charsets.US_ASCII)
        return when {
            data[0] == 0x00.toByte() && data[1] == 0x01.toByte() &&
                data[2] == 0x00.toByte() && data[3] == 0x00.toByte() -> "ttf"
            tag == "true" -> "ttf"
            tag == "OTTO" -> "otf"
            else -> null
        }
    }
}
