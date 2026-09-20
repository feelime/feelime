package com.feelime.ime.engine

import android.content.Context
import java.io.File
import java.security.MessageDigest
import org.json.JSONObject

/**
 * Deploys the bundled engine data from APK assets into app-private storage
 * using the staging/rename harness proven by the native smoke spike: copying
 * happens in the background while the no-learning Direct engine keeps the
 * keyboard inputable, and a language only becomes selectable once its data
 * is deployed and hash-verified. Any deployed byte that no longer matches
 * the bundled manifest flips [mismatched], which surfaces to the coordinator
 * as ENGINE_DATA_MISMATCH (the N01 production trigger).
 */
object EngineDataStore {
    private const val ASSET_ROOT = "engine-data"
    private const val MANIFEST_ASSET = "$ASSET_ROOT/MANIFEST.json"

    @Volatile private var mismatch = false
    @Volatile private var deployFailed = false

    fun ensureAsync(context: Context, onComplete: () -> Unit = {}) {
        val appContext = context.applicationContext
        Thread {
            runCatching { ensure(appContext) }
            onComplete()
        }.apply { isDaemon = true }.start()
    }

    fun mismatched(): Boolean = mismatch

    /** Fast pointer check used for the HTML mode menu (no hashing). */
    fun isModeReady(context: Context, mode: InputMode): Boolean {
        val root = readyRoot(context) ?: return false
        return when (mode) {
            InputMode.DIRECT -> true
            InputMode.PINYIN -> File(root, "rime/luna_pinyin.schema.yaml").isFile
            InputMode.DOUBLE_PINYIN -> File(root, "rime/${DoublePinyinScheme.schemaId(context)}.schema.yaml").isFile
            InputMode.T9 -> File(root, "rime/luna_pinyin_t9.schema.yaml").isFile
            InputMode.STROKE -> File(root, "rime/feelime_stroke.schema.yaml").isFile
            InputMode.FRENCH -> File(root, "hunspell/fr.aff").isFile
            InputMode.RUSSIAN -> File(root, "hunspell/ru_RU.aff").isFile
            InputMode.JAPANESE -> File(root, "mozc/mozc.data").isFile
        }
    }

    /** 已部署版本目录内经 MANIFEST 校验部署的文件；未就绪返回 null。 */
    fun readyFile(context: Context, path: String): File? {
        val root = readyRoot(context) ?: return null
        return File(root, path).takeIf { it.isFile }
    }

    /** 模糊音开启时返回 schema id，并把该掩码的预编译 prism 物化为
     * schema 期望的文件名（运行时只加载 prism，不重跑 algebra）。
     * 掩码为 0 或数据未就绪/变体缺失时返回 null（调用方回落严格全拼）。
     * 变体源两处（issue #23 基底换装）：用户自定义词库的设备端编译产物
     * （`rime-user/build/`，与用户 table 同场编译，优先）或内置 frost 的
     * 预编译变体（shared 根）。物化目标仍是 shared 根的 active 名——
     * librime 按 user/build > shared 顺序找 prism，但 active 由本机制
     * 管理（不在 MANIFEST、不进 build）。 */
    fun fuzzySchemaId(context: Context): String? {
        val mask = FuzzyPinyin.mask(context)
        if (mask == 0) return null
        val root = readyRoot(context) ?: return null
        if (!File(root, "rime/${FuzzyPinyin.SCHEMA_ID}.schema.yaml").isFile) return null
        val userVariant = File(
            context.filesDir, "rime-user/build/${FuzzyPinyin.SCHEMA_ID}_m$mask.prism.bin",
        )
        val sharedVariant = File(root, "rime/${FuzzyPinyin.SCHEMA_ID}_m$mask.prism.bin")
        val variant = userVariant.takeIf { it.isFile } ?: sharedVariant
        val active = File(root, "rime/${FuzzyPinyin.SCHEMA_ID}.prism.bin")
        if (!variant.isFile) return null
        // active 不在 MANIFEST 里，长度相等的内容损坏无法被启动校验发现：
        // 以内容一致为准，不一致就一律从已校验的变体重新物化
        // （codex round-1 P2-5）。
        if (!active.isFile || active.length() != variant.length() ||
            !active.inputStream().use { it.readBytes() }.contentEquals(
                variant.inputStream().use { it.readBytes() })
        ) {
            android.util.Log.w("FeelimeEngine", "fuzzy prism re-materialize: ${active.name} (mask=$mask)")
            variant.copyTo(active, overwrite = true)
        }
        return FuzzyPinyin.SCHEMA_ID
    }

    /**
     * Full hash verification for one engine group ("rime"/"hunspell"/"mozc").
     * Returns the ready data root, or null when the group is not deployed;
     * a hash mismatch sets the mismatch flag and also returns null.
     */
    fun verifyGroup(context: Context, group: String): File? {
        val root = readyRoot(context) ?: return null
        val manifest = manifest(context) ?: return null
        manifest.files.forEach { (path, entry) ->
            if (!path.startsWith("$group/")) return@forEach
            val file = File(root, path)
            if (!file.isFile || file.length() != entry.bytes || sha256(file) != entry.sha256) {
                mismatch = true
                return null
            }
        }
        return root
    }

    private fun readyRoot(context: Context): File? {
        // the CURRENT APK manifest hash is the only pointer. Never
        // select by directory-name ordering — an older version whose hash
        // sorts later would win forever and report a permanent mismatch.
        val parsed = manifest(context) ?: return null
        val version = sha256(parsed.raw)
        val target = File(File(context.filesDir, "engine-data/versions"), version)
        return if (File(target, ".ready").isFile) target else null
    }

    @Synchronized
    private fun ensure(context: Context) {
        val manifest = manifest(context) ?: run {
            android.util.Log.w("FeelimeEngine", "engine data deploy: manifest unreadable")
            deployFailed = true
            return
        }
        val version = sha256(manifest.raw)
        val versions = File(context.filesDir, "engine-data/versions").apply { mkdirs() }
        val target = File(versions, version)
        if (File(target, ".ready").isFile) return
        val staging = File(versions, ".staging-$version")
        staging.deleteRecursively()
        staging.mkdirs()
        manifest.files.forEach { (path, entry) ->
            val outFile = File(staging, path)
            outFile.parentFile?.mkdirs()
            // 资产缺包（如 aapt2 改名 .gz）必须响亮：静默吞掉会退化成
            // 「引擎永远 init 失败」的远端症状（2026-09-13 实录）。
            val stream = runCatching { context.assets.open("$ASSET_ROOT/$path") }
                .onFailure {
                    android.util.Log.w(
                        "FeelimeEngine",
                        "engine data deploy: asset missing $path (${it.message})",
                    )
                }.getOrNull() ?: run {
                deployFailed = true
                staging.deleteRecursively()
                return
            }
            stream.use { input ->
                outFile.outputStream().use { output ->
                    input.copyTo(output)
                    // durable deploy — every byte is on disk before
                    // the version can be marked ready.
                    output.fd.sync()
                }
            }
            if (outFile.length() != entry.bytes || sha256(outFile) != entry.sha256) {
                android.util.Log.w(
                    "FeelimeEngine",
                    "engine data deploy: hash mismatch $path",
                )
                mismatch = true
                staging.deleteRecursively()
                return
            }
        }
        File(staging, ".ready").outputStream().use { output ->
            output.write("ok\n".toByteArray())
            output.fd.sync()
        }
        syncDirectory(staging)
        if (target.isDirectory) target.deleteRecursively()
        if (!staging.renameTo(target)) {
            staging.deleteRecursively()
            deployFailed = true
            return
        }
        syncDirectory(versions)
        // Only now is the current version complete and hash-verified, so any
        // other deployed version is safe to reclaim (cleanup rule).
        versions.listFiles { file -> file.isDirectory }
            ?.filter { it.name != version && !it.name.startsWith(".staging-") }
            ?.forEach { it.deleteRecursively() }
        versions.listFiles { file -> file.name.startsWith(".staging-") }
            ?.forEach { it.deleteRecursively() }
    }

    private fun syncDirectory(dir: File) {
        // Best-effort POSIX directory fsync so the rename itself survives
        // power loss; failures are non-fatal on filesystems that refuse it.
        runCatching {
            val fd = android.system.Os.open(dir.absolutePath, android.system.OsConstants.O_RDONLY, 0)
            try {
                android.system.Os.fsync(fd)
            } finally {
                android.system.Os.close(fd)
            }
        }
    }

    private data class ParsedManifest(val raw: ByteArray, val files: Map<String, Entry>) {
        data class Entry(val sha256: String, val bytes: Long)
    }

    private fun manifest(context: Context): ParsedManifest? {
        val raw = runCatching { context.assets.open(MANIFEST_ASSET).use { it.readBytes() } }
            .getOrNull() ?: return null
        return runCatching {
            val json = JSONObject(String(raw, Charsets.UTF_8))
            val filesObject = json.getJSONObject("files")
            val files = mutableMapOf<String, ParsedManifest.Entry>()
            for (key in filesObject.keys()) {
                val entry = filesObject.getJSONObject(key)
                files[key] = ParsedManifest.Entry(entry.getString("sha256"), entry.getLong("bytes"))
            }
            ParsedManifest(raw, files)
        }.getOrNull()
    }

    private fun sha256(file: File): String =
        file.inputStream().use { input ->
            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(1 shl 16)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}
