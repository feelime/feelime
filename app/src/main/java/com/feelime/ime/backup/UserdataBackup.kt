package com.feelime.ime.backup

import com.feelime.ime.BOTTOM_PAD_STEPS
import com.feelime.ime.FEEL_HOLD_STEPS
import com.feelime.ime.PREF_ASSOCIATION
import com.feelime.ime.PREF_BOTTOM_PAD_DP
import com.feelime.ime.PREF_BOTTOM_PAD_DP_LANDSCAPE
import com.feelime.ime.PREF_BOTTOM_PAD_DP_PORTRAIT
import com.feelime.ime.PREF_FEEL_HOLD_MS
import com.feelime.ime.PREF_FEEL_POPUP_SNAP
import com.feelime.ime.PREF_FEEL_SCRUB_SPEED
import com.feelime.ime.PREF_KEY_HAPTIC
import com.feelime.ime.PREF_KEY_SOUND
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Base64
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * 设计 docs/design/userdata.md §1: 设置/常用语/词库打包成单个带版本的
 * JSON。prefs 访问抽象成接口（值保留 Java 类型）让收集/恢复逻辑在 JVM
 * 单测里跑（无 Android）。
 *
 * 恢复是「先全量校验，后一次性提交」：base64 解码、路径、类型契约全部
 * 通过才开始写 prefs / 暂存目录，任何一步失败都不留下半份备份。
 */
interface PrefsAccess {
    /** 值类型：String / Boolean / Int / Long / Float / Set<String>，null=键不存在。 */
    fun all(prefsName: String): Map<String, Any?>
    fun put(prefsName: String, key: String, value: Any?)
}

class UserdataBackup(
    private val prefs: PrefsAccess,
    private val filesDir: File,
    /** 信息性字段：记录从哪版 App 导出，恢复逻辑不依赖它。 */
    private val appVersion: String = "",
) {

    sealed class RestoreResult {
        class Ok(val engineRestartNeeded: Boolean) : RestoreResult()
        class Fail(val code: String, val detail: String) : RestoreResult()
    }

    fun export(): JSONObject {
        val settings = JSONObject()
        for (name in PREFS_FILES) {
            settings.put(name, encodePrefs(filtered(name)))
        }
        val favorites = JSONArray()
        for (item in com.feelime.ime.panel.PanelCodec.parse(
            // FavoritesStore.KEY 是 private companion，这里用字面量保持同源。
            prefs.all(FAVORITES_PREFS)["items"] as? String ?: "",
        )) {
            favorites.put(
                JSONObject()
                    .put("id", item.id)
                    .put("time", item.time)
                    .put("text", item.text)
                    .put("code", item.code)
                    .put("rank", item.rank),
            )
        }
        // userdb / favorites / webviewStores 即使为空也要写出：备份表达
        // 「导出方的完整状态」，空列表的恢复语义就是清空目标（覆盖）。
        val userdb = JSONObject()
        collectDir(File(filesDir, RIME_USER_DIR))?.let { userdb.put("rime", it) }
        collectDir(File(filesDir, MOZC_USER_DIR))?.let { userdb.put("mozc", it) }
        val root = JSONObject()
            .put("kind", KIND)
            .put("version", VERSION)
        if (appVersion.isNotEmpty()) root.put("appVersion", appVersion)
        root.put("settings", settings)
        root.put("favorites", favorites)
        root.put("webviewStores", webviewValues())
        root.put("userdb", userdb)
        return root
    }

    /** settings/favorites/customKeys/webviewStores 立即生效；rime 词库写进
     * 暂存目录（rime-user.import），由 IME 在关会话→换目录→开新会话的中间
     * 点换入（返回 engineRestartNeeded）。mozc 的 JNI 全局不随会话重建，
     * 恢复的词库文件在其输入法进程下次启动时生效（设计 §1.3）。 */
    fun restore(raw: ByteArray): RestoreResult {
        // ---- 阶段一：全量校验，不碰任何状态 ----
        val root = try {
            JSONObject(raw.toString(Charsets.UTF_8))
        } catch (exception: org.json.JSONException) {
            return RestoreResult.Fail("FORMAT", exception.message ?: "parse")
        }
        if (root.optString("kind") != KIND) return RestoreResult.Fail("KIND", root.optString("kind"))
        if (!root.has("version")) return RestoreResult.Fail("VERSION", "missing")
        val version = root.optInt("version", -1)
        if (version < 1 || version > VERSION) return RestoreResult.Fail("VERSION", "$version")

        val settings = JSONObject()
        val importedSettings = root.optJSONObject("settings") ?: JSONObject()
        for (name in importedSettings.keys()) {
            // prefs 文件白名单：未知段落直接忽略（前向兼容），已知段落里的
            // 键按类型契约校验——合法 JSON 不能把 IME 写成持续崩溃。
            if (name !in PREFS_FILES) continue
            val section = importedSettings.optJSONObject(name) ?: continue
            for (key in section.keys()) {
                if (name == UPDATE_PREFS && key !in UPDATE_KEEP) continue
                val value = section.opt(key) ?: continue
                val checked = try {
                    checkValue(name, key, value) ?: continue
                } catch (exception: RestoreException) {
                    return RestoreResult.Fail(exception.code, exception.detail)
                }
                val merged = settings.optJSONObject(name) ?: JSONObject().also { settings.put(name, it) }
                merged.put(key, checked)
            }
        }

        val favorites = ArrayList<com.feelime.ime.panel.PanelItem>()
        val favoritesJson = root.optJSONArray("favorites") ?: JSONArray()
        for (index in 0 until favoritesJson.length()) {
            val entry = favoritesJson.optJSONObject(index) ?: continue
            val text = entry.optString("text")
            if (text.isEmpty()) continue
            favorites.add(
                com.feelime.ime.panel.PanelItem(
                    id = entry.optString("id").ifEmpty { "f$index" },
                    time = entry.optLong("time", 0L),
                    text = text.take(200),
                    code = entry.optString("code"),
                    rank = entry.optInt("rank", 1).coerceIn(1, 99),
                ),
            )
        }

        val stores = root.optJSONObject("webviewStores") ?: JSONObject()
        for (key in stores.keys()) {
            if (key !in WEBVIEW_STORE_KEYS) return RestoreResult.Fail("STORES", key)
            if (stores.opt(key) !is String) return RestoreResult.Fail("STORES", key)
        }

        val userdb = root.optJSONObject("userdb") ?: JSONObject()
        // base64/gzip 解码与路径校验提前做：坏数据在校验阶段就失败，不落半个文件。
        val stagedBytes = HashMap<String, Map<String, ByteArray>>()
        for (engine in listOf("rime", "mozc")) {
            val entries = userdb.optJSONObject(engine) ?: JSONObject()
            val files = HashMap<String, ByteArray>()
            for (relative in entries.keys()) {
                if (relative.startsWith("/") || relative.split('/', '\\').any { it == ".." || it == "." }) {
                    return RestoreResult.Fail("PATH", "$engine/$relative")
                }
                files[relative] = decodeUserdbEntry(entries.opt(relative))
                    ?: return RestoreResult.Fail("BASE64", "$engine/$relative")
            }
            stagedBytes[engine] = files
        }

        // ---- 阶段二：一次性提交 ----
        for ((name, section) in settings.toMap()) {
            for (key in section.keys()) {
                prefs.put(name, key, section.opt(key))
            }
        }
        // FavoritesStore 同款上限（MAX_ITEMS=200），超出截断。空列表也写：
        // 「导出方没有常用语」的恢复语义就是清空目标。
        prefs.put(FAVORITES_PREFS, "items",
            com.feelime.ime.panel.PanelCodec.serialize(favorites.take(200)))
        // webviewStores 镜像带 rev：键盘页 hello 时按 rev 决定拉取/推送方向
        // （设计 §1.5），导入后 rev+1 保证旧页面下次握手必然 adopt 恢复值。
        val currentRev = webviewMirror().optInt("rev", 0)
        prefs.put(WEBVIEW_PREFS, WEBVIEW_KEY,
            JSONObject().put("rev", currentRev + 1).put("values", stores).toString())

        var engineRestartNeeded = false
        if (userdb.has("rime")) {
            stageDir("rime", stagedBytes["rime"] ?: emptyMap(), RIME_IMPORT_DIR)
                ?.let { error -> return error }
            engineRestartNeeded = true
        }
        if (userdb.has("mozc")) {
            stageDir("mozc", stagedBytes["mozc"] ?: emptyMap(), MOZC_IMPORT_DIR)
                ?.let { error -> return error }
        }
        return RestoreResult.Ok(engineRestartNeeded)
    }

    /** 是否有待换入的词库暂存（以 .ready 标记为准——半写的暂存不算数）。 */
    fun hasPendingUserdb(): Boolean =
        File(filesDir, RIME_IMPORT_DIR).let { it.isDirectory && File(it, READY_MARKER).isFile } ||
            File(filesDir, MOZC_IMPORT_DIR).let { it.isDirectory && File(it, READY_MARKER).isFile }

    /** IME 启动时（引擎建立前）或收到恢复广播、且引擎会话已关闭后调用：
     * 把暂存的 userdb 换成正式目录。返回是否发生了替换。
     * 上一轮的 .old 目录在此顺带清理——引擎可能还握着旧文件句柄，
     * 不能在换目录的同一拍删。 */
    fun applyPendingUserdb(): Boolean =
        swap(RIME_IMPORT_DIR, RIME_USER_DIR) or swap(MOZC_IMPORT_DIR, MOZC_USER_DIR)

    // ---- prefs 编解码 ----------------------------------------------------

    private fun filtered(prefsName: String): Map<String, Any?> {
        val all = prefs.all(prefsName)
        return if (prefsName == UPDATE_PREFS) all.filterKeys { it in UPDATE_KEEP } else all
    }

    /** Android 的 JSONObject 不是 Map（putAll 在设备上不存在），显式循环；
     * 值按 Java 类型编码，保证恢复后 getString/getBoolean/getInt 不串型。 */
    private fun encodePrefs(values: Map<String, Any?>): JSONObject {
        val section = JSONObject()
        for ((key, value) in values) {
            when (value) {
                null -> {}
                is Set<*> -> section.put(key, JSONArray(value.toList()))
                else -> section.put(key, value)
            }
        }
        return section
    }

    /** 导入侧的类型契约。返回 null = 键可忽略；抛 RestoreResult 之外用
     * Fail 表达（通过 [pending] 收集）。约定：
     * - INT_KEYS 的键必须是 Int 且在界内（读侧 getInt）；
     * - BOOL_KEYS 的键必须是 Boolean（读侧 getBoolean）；
     * - 其余键只接受 String/Boolean/Int——Long/浮点/嵌套结构一律拒绝。 */
    private fun checkValue(prefsName: String, key: String, value: Any): Any? {
        val allowed = DISCRETE_INT_KEYS[prefsName]?.get(key)
        if (allowed != null) {
            if (value !is Int || !allowed.contains(value)) {
                throw RestoreException("SCHEMA", "$prefsName/$key")
            }
            return value
        }
        val range = INT_KEYS[prefsName]?.get(key)
        if (range != null) {
            if (value !is Int || value < range.first || value > range.last) {
                throw RestoreException("SCHEMA", "$prefsName/$key")
            }
            return value
        }
        if (prefsName in BOOL_KEYS && key in BOOL_KEYS.getValue(prefsName)) {
            if (value !is Boolean) throw RestoreException("SCHEMA", "$prefsName/$key")
            return value
        }
        if (value is String || value is Boolean || value is Int) return value
        throw RestoreException("SCHEMA", "$prefsName/$key")
    }

    private class RestoreException(val code: String, val detail: String) : RuntimeException(detail)

    // ---- webviewStores 镜像 ----------------------------------------------

    /** 导出用：只取白名单值（不带 rev）。兼容旧镜像（纯值对象）。 */
    private fun webviewValues(): JSONObject {
        val mirror = webviewMirror()
        return mirror.optJSONObject("values") ?: JSONObject(mirror.toString())
    }

    private fun webviewMirror(): JSONObject = try {
        JSONObject(prefs.all(WEBVIEW_PREFS)[WEBVIEW_KEY] as? String ?: "{}")
    } catch (exception: org.json.JSONException) {
        JSONObject()
    }

    // ---- userdb 目录 -----------------------------------------------------

    /** 逐文件编码（issue #10）：可压缩的词库文件（mozc 预分配的稀疏 DB、
     * leveldb .ldb）gzip 后 base64，写成熟悉的 `{"gz": …}` 对象——320KB 的
     * 稀疏库能缩到几百字节；压不动的小文件保持 v1 的纯 base64 字符串。
     * LOCK/LOG/LOG.old 是 leveldb 可再生文件，跳过。空目录/不存在返回
     * null（导出里就不写这个键）。 */
    private fun collectDir(dir: File): JSONObject? {
        if (!dir.isDirectory) return null
        val out = JSONObject()
        dir.walkTopDown().filter { it.isFile }.forEach { file ->
            val relative = file.relativeTo(dir).invariantSeparatorsPath
            if (file.name in REGENERABLE_FILES) return@forEach
            out.put(relative, encodeUserdbFile(file.readBytes()))
        }
        return if (out.length() > 0) out else null
    }

    private fun encodeUserdbFile(bytes: ByteArray): Any {
        val compressed = ByteArrayOutputStream().use { buffer ->
            GZIPOutputStream(buffer).use { gzip -> gzip.write(bytes) }
            buffer.toByteArray()
        }
        return if (compressed.size < bytes.size) {
            JSONObject().put("gz", Base64.getEncoder().encodeToString(compressed))
        } else {
            Base64.getEncoder().encodeToString(bytes)
        }
    }

    /** v1 = 纯 base64 字符串；v2 = `{"gz": base64(gzip(bytes))}` 对象。
     * 任何一层坏掉都归 BASE64 错误（校验阶段拒绝，不落半个文件）。 */
    private fun decodeUserdbEntry(entry: Any?): ByteArray? {
        val encoded = when (entry) {
            is JSONObject -> entry.opt("gz") as? String ?: return null
            is String -> entry
            else -> return null
        }
        val bytes = try {
            Base64.getDecoder().decode(encoded)
        } catch (exception: IllegalArgumentException) {
            return null
        }
        if (entry !is JSONObject) return bytes
        return try {
            GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() }
        } catch (exception: java.io.IOException) {
            return null
        }
    }

    /** 写暂存目录；.ready 标记最后落盘，半写的暂存永远不会被换入。 */
    private fun stageDir(engine: String, files: Map<String, ByteArray>, importDir: String): RestoreResult.Fail? {
        val staging = File(filesDir, importDir)
        staging.deleteRecursively()
        if (!staging.mkdirs()) {
            return RestoreResult.Fail("IO_ERROR", "mkdir $engine")
        }
        for ((relative, bytes) in files) {
            val target = File(staging, relative)
            if (!target.canonicalPath.startsWith(staging.canonicalPath + File.separator)) {
                staging.deleteRecursively()
                return RestoreResult.Fail("PATH", "$engine/$relative")
            }
            target.parentFile?.mkdirs()
            target.writeBytes(bytes)
        }
        File(staging, READY_MARKER).writeBytes(ByteArray(0))
        return null
    }

    private fun swap(importDir: String, userDir: String): Boolean {
        File(filesDir, "$userDir.old").deleteRecursively()
        val staging = File(filesDir, importDir)
        if (!staging.isDirectory || !File(staging, READY_MARKER).isFile) return false
        val target = File(filesDir, userDir)
        if (target.isDirectory) target.renameTo(File(filesDir, "$userDir.old"))
        val moved = staging.renameTo(target)
        if (moved) {
            File(target, READY_MARKER).delete()
        } else if (!target.isDirectory) {
            // 换入失败且旧目录已让位：把旧目录找回来，宁可要旧数据也别空着。
            File(filesDir, "$userDir.old").renameTo(target)
        }
        return moved
    }

    companion object {
        const val KIND = "feelime-userdata"
        const val VERSION = 2
        const val WEBVIEW_PREFS = "feelime_webview_stores"
        const val WEBVIEW_KEY = "stores"
        const val READY_MARKER = ".ready"

        /** leveldb 可再生文件（issue #10）：LOCK 是锁句柄、LOG 是人类可读
         * 运行日志，换机后没有意义，导出时跳过、恢复时由引擎自己重建。
         * 小写的 *.log 是 write-ahead 日志（含未压实的数据），必须保留。 */
        private val REGENERABLE_FILES = setOf("LOCK", "LOG", "LOG.old")

        private const val FAVORITES_PREFS = "feelime_favorites"
        private const val UPDATE_PREFS = "keyboard_update"
        private const val RIME_USER_DIR = "rime-user"
        private const val MOZC_USER_DIR = "mozc-user"
        private const val RIME_IMPORT_DIR = "rime-user.import"
        private const val MOZC_IMPORT_DIR = "mozc-user.import"

        /** 热更配置只搬地址类键；过程状态(update_state/hash/指针)必须重新校验，
         * 直接恢复会把新设备钉死在失效的热更上（设计 §1.1）。 */
        private val UPDATE_KEEP = setOf("update_url", "update_source_url", "update_auto_check_enabled")

        /** 读侧 getInt 的键（FeelimeService.storedKeyboardHeight）。 */
        private val INT_KEYS = mapOf(
            "feelime_keyboard" to mapOf(
                "keyboard_height_portrait" to (0..100000),
                "keyboard_height_landscape" to (0..100000),
            ),
        )

        /** 读侧 getInt 且档位离散的键（mode-fallback §3/§4：底部留白/手感
         *  参数）。范围校验会放过 1/13 这类非法档位，必须逐一比对。 */
        private val DISCRETE_INT_KEYS = mapOf(
            "feelime_keyboard" to mapOf(
                PREF_BOTTOM_PAD_DP to BOTTOM_PAD_STEPS,
                PREF_BOTTOM_PAD_DP_PORTRAIT to BOTTOM_PAD_STEPS,
                PREF_BOTTOM_PAD_DP_LANDSCAPE to BOTTOM_PAD_STEPS,
                PREF_FEEL_SCRUB_SPEED to intArrayOf(1, 2, 3, 4, 5),
                PREF_FEEL_HOLD_MS to FEEL_HOLD_STEPS,
                PREF_FEEL_POPUP_SNAP to intArrayOf(0, 1, 2),
            ),
        )

        /** 读侧 getBoolean 的键（CustomKeysStore/AsrSettings/自动检查）。 */
        private val BOOL_KEYS = mapOf(
            "feelime_custom_keys" to setOf("enabled"),
            "feelime_asr" to setOf("strip_final_period"),
            "feelime_keyboard" to setOf(
                PREF_ASSOCIATION,
                PREF_KEY_SOUND,
                PREF_KEY_HAPTIC,
            ),
            UPDATE_PREFS to setOf("update_auto_check_enabled"),
        )

        val PREFS_FILES = listOf(
            "feelime_ui",
            "feelime_keyboard",
            "feelime_engine",
            "feelime_asr",
            "feelime_custom_keys",
            "feelime_favorites",
            UPDATE_PREFS,
        )

        /** 键盘 WebView localStorage 里设置级的键（见设计 §1.4）。
         * 键盘高度走原生 feelime_keyboard（物理px），JS 副本是 CSS px，
         * 单位不同不进备份。色彩模式已迁 theme_mode（feelime_keyboard.xml，
         * PREFS_FILES 打包），localStorage 值是迁移前遗留，不进备份。 */
        val WEBVIEW_STORE_KEYS = listOf(
            "feelime_ui_locale",
            "feelime_scrub_speed",
            "feelime_quick_pair",
            "feelime_menu_modes",
            "feelime_mode_order",
        )
    }
}

private fun JSONObject.toMap(): Map<String, JSONObject> {
    val out = HashMap<String, JSONObject>()
    for (name in keys()) optJSONObject(name)?.let { out[name] = it }
    return out
}

/** SharedPreferences 适配。put 按值类型选 put* 方法：读侧有
 * getBoolean（custom_keys.enabled、asr.strip_final_period、auto_check）和
 * getInt（feelime_keyboard 键盘高度），串型会直接 ClassCastException。 */
class AndroidPrefs(private val context: android.content.Context) : PrefsAccess {
    override fun all(prefsName: String): Map<String, Any?> =
        context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            .all

    override fun put(prefsName: String, key: String, value: Any?) {
        val editor = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
            .edit()
        when (value) {
            null -> editor.remove(key)
            is String -> editor.putString(key, value)
            is Boolean -> editor.putBoolean(key, value)
            is Int -> editor.putInt(key, value)
            is Long -> editor.putLong(key, value)
            is Float -> editor.putFloat(key, value)
            is Double -> editor.putFloat(key, value.toFloat())
            is Set<*> -> editor.putStringSet(key, value.map { it.toString() }.toSet())
            else -> editor.putString(key, value.toString())
        }
        editor.apply()
    }
}
