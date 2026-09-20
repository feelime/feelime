package com.feelime.ime.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.feelime.ime.nativeengine.NativeSmoke
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

/**
 * 基底词库导入（issue #23）：用户选一个 rime `.dict.yaml`，设备端
 * librime `start_maintenance` 现场编译出与内置同名的 table/prism 套件。
 *
 * 布局（详见 [BaseDictFiles]）：
 * - `files/rime-user/`（librime 的 user_data_dir = staging_dir）——编译期
 *   暂放 umbrella/31 变体 schema/default.yaml + `rime-dict-source/` 用户源；
 *   maintenance 产物落 `files/rime-user/build/`，librime 运行时按
 *   user/build > shared 的顺序加载，天然覆盖内置 frost。
 * - 编译完成后 user 根的 yaml 源全部删除，用户源挪去 `files/rime-user-dict/`
 *   留档（该目录与 user/build 都不进 userdata 备份）。
 * - 换装经 [ACTION_BASE_DICT_CHANGED] 广播走既有 reloadGlobal + 会话重建链。
 *
 * 引擎并发：maintenance 是 librime 部署线程，与运行中 session 并存是其
 * 设计内形态（编译期间键盘继续用旧词库）；join 不持引擎锁。
 */
object BaseDictInstaller {
    const val ACTION_BASE_DICT_CHANGED = "com.feelime.ime.BASE_DICT_CHANGED"
    const val PREF_FILE = "feelime_base_dict"
    private const val KEY_MODE = "mode" // builtin | custom
    private const val KEY_NAME = "name"
    private const val KEY_INSTALLED_AT = "installed_at"
    private const val KEY_SOURCE_SHA = "source_sha"

    private const val MAX_SOURCE_BYTES = 150L * 1024 * 1024
    private const val MAINTENANCE_TIMEOUT_MS = 15 * 60 * 1000L
    private const val PROGRESS_EVERY_MS = 2000L

    /** 编译期校验的产物清单（build/ 下；缺任一即失败回滚）。 */
    private val REQUIRED_PRODUCTS = listOf("luna_pinyin.table.bin", "luna_pinyin.prism.bin") +
        (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX)
            .map { "${FuzzyPinyin.SCHEMA_ID}_m$it.prism.bin" } +
        listOf(
            "ziranma_double_pinyin.prism.bin", "double_pinyin_flypy.prism.bin",
            "double_pinyin_sogou.prism.bin", "double_pinyin_ziguang.prism.bin",
            "luna_pinyin_t9.prism.bin",
        )

    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "feelime-base-dict") }
    private val building = AtomicBoolean(false)

    /** @param pushEvent 主线程安全的 WebView 事件推送（SettingsBridge 提供）。 */
    fun installAsync(
        context: Context,
        uri: Uri,
        displayName: String,
        pushEvent: (JSONObject) -> Unit,
        onFinished: () -> Unit,
    ) {
        check(building.compareAndSet(false, true)) { "install already running" }
        val app = context.applicationContext
        worker.execute {
            val code = runCatching { installBlocking(app, uri, displayName, pushEvent) }
                .getOrElse {
                    rollback(app)
                    "BASE_DICT_INTERNAL"
                }
            building.set(false)
            val ok = code == null
            pushEvent(
                JSONObject()
                    .put("type", if (ok) "dictBaseDone" else "dictBaseError")
                    .put("code", code ?: "OK")
                    .put("message", messageFor(app, code)),
            )
            onFinished()
        }
    }

    fun isBuilding(): Boolean = building.get()

    fun revertAsync(context: Context, pushEvent: (JSONObject) -> Unit, onFinished: () -> Unit) {
        val app = context.applicationContext
        worker.execute {
            runCatching { revert(app) }
                .onFailure { android.util.Log.w("FeelimeBaseDict", "revert: ${it.message}") }
            pushEvent(JSONObject().put("type", "dictBaseDone").put("code", "REVERTED")
                .put("message", messageFor(app, "REVERTED")))
            onFinished()
        }
    }

    /** 设置页 state 的 baseDict 段。 */
    fun statusJson(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        val mode = prefs.getString(KEY_MODE, "builtin") ?: "builtin"
        val built = File(context.filesDir, "rime-user/build/luna_pinyin.table.bin").isFile
        return JSONObject()
            .put("mode", if (mode == "custom" && built) "custom" else "builtin")
            .put("building", isBuilding())
            .putOpt("name", prefs.getString(KEY_NAME, null) ?: JSONObject.NULL)
            .putOpt("installedAt", prefs.getLong(KEY_INSTALLED_AT, 0L))
    }

    // ---- blocking core (worker thread) ------------------------------------

    private fun installBlocking(
        context: Context,
        uri: Uri,
        displayName: String,
        pushEvent: (JSONObject) -> Unit,
    ): String? {
        pushEvent(status("COPYING"))
        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR).apply {
            deleteRecursively(); mkdirs()
        }
        // 1) 暂存用户源 + 嗅探（rime dict yaml：含 TAB 的词条行）。
        val (sha, lines) = stageSource(context, uri, File(sourceDir, BaseDictFiles.SOURCE_FILE))
            ?: return "BASE_DICT_READ_FAILED"
        if (lines <= 0) return "BASE_DICT_EMPTY"

        // 2) 编译现场：umbrella + 31 变体 schema + default.yaml。
        val template = engineTemplate(context) ?: run {
            rollback(context); return "BASE_DICT_ENGINE_NOT_READY"
        }
        File(user, BaseDictFiles.UMBRELLA_FILE).writeText(
            BaseDictFiles.umbrellaYaml(sha.take(12), lines),
        )
        (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
            File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").writeText(
                BaseDictFiles.variantSchema(template, mask),
            )
        }
        File(user, BaseDictFiles.DEFAULT_FILE).writeText(BaseDictFiles.defaultYaml())

        // 3) maintenance：full_check=true（staging 里已有同名产物时也要重编）。
        if (!NativeSmoke.rimeStartMaintenance(true)) {
            rollback(context); return "BASE_DICT_MAINTENANCE_START_FAILED"
        }
        pushEvent(status("COMPILING"))
        val started = System.currentTimeMillis()
        var lastPush = 0L
        while (NativeSmoke.rimeIsMaintenanceMode()) {
            if (System.currentTimeMillis() - started > MAINTENANCE_TIMEOUT_MS) {
                NativeSmoke.rimeJoinMaintenance() // 收尾（部署线程终会结束）再回滚
                rollback(context)
                return "BASE_DICT_TIMEOUT"
            }
            if (System.currentTimeMillis() - lastPush > PROGRESS_EVERY_MS) {
                lastPush = System.currentTimeMillis()
                pushEvent(status("COMPILING")
                    .put("elapsedMs", System.currentTimeMillis() - started))
            }
            Thread.sleep(500)
        }
        NativeSmoke.rimeJoinMaintenance()

        // 4) 产物校验。
        val build = File(user, "build")
        val missing = REQUIRED_PRODUCTS.filterNot { File(build, it).isFile }
        if (missing.isNotEmpty()) {
            android.util.Log.w("FeelimeBaseDict", "missing products: $missing")
            rollback(context)
            return "BASE_DICT_INCOMPLETE"
        }

        // 5) 清理编译期源 + 留档用户源 + 记录状态 + 通知换装。
        cleanupCompileSources(user, keepSource = true)
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putString(KEY_MODE, "custom")
            .putString(KEY_NAME, displayName)
            .putString(KEY_SOURCE_SHA, sha)
            .putLong(KEY_INSTALLED_AT, System.currentTimeMillis())
            .apply()
        context.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(context.packageName))
        return null
    }

    /** SAF 流暂存到 target；返回 (sha256, TAB 词条行数)；上限/坏文件给 null。 */
    private fun stageSource(context: Context, uri: Uri, target: File): Pair<String, Int>? {
        val input = runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            ?: return null
        val digest = MessageDigest.getInstance("SHA-256")
        var tabLines = 0
        var total = 0L
        val buffer = ByteArray(1 shl 16)
        input.use { stream ->
            target.outputStream().use { out ->
                while (true) {
                    val read = stream.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > MAX_SOURCE_BYTES) return null
                    digest.update(buffer, 0, read)
                    out.write(buffer, 0, read)
                }
            }
        }
        // 逐行嗅探（文件已落盘，读副本即可）。
        target.bufferedReader(Charsets.UTF_8).useLines { seq ->
            seq.forEach { line ->
                if (!line.startsWith("#") && line.contains('\t')) tabLines++
            }
        }
        if (tabLines <= 0) return null
        return digest.digest().joinToString("") { "%02x".format(it) } to tabLines
    }

    private fun engineTemplate(context: Context): String? {
        val shared = EngineDataStore.readyFile(
            context, "rime/${FuzzyPinyin.SCHEMA_ID}.schema.yaml",
        ) ?: return null
        return runCatching { shared.readText() }.getOrNull()
    }

    private fun cleanupCompileSources(user: File, keepSource: Boolean) {
        File(user, BaseDictFiles.DEFAULT_FILE).delete()
        File(user, BaseDictFiles.UMBRELLA_FILE).delete()
        (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
            File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").delete()
        }
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR)
        if (keepSource) {
            // 留档目录（在 rime-user 之外，天然不进 userdata 备份）。
            val archive = File(user.parentFile, "rime-user-dict").apply { mkdirs() }
            archive.listFiles()?.forEach { it.delete() }
            sourceDir.listFiles()?.forEach { it.copyTo(File(archive, it.name), overwrite = true) }
        }
        sourceDir.deleteRecursively()
    }

    /** 失败/恢复共用的完整回滚：回内置 frost。 */
    private fun revert(context: Context) {
        val user = File(context.filesDir, "rime-user")
        if (user.isDirectory) {
            File(user, "build").deleteRecursively()
            cleanupCompileSources(user, keepSource = false)
        }
        File(context.filesDir, "rime-user-dict").deleteRecursively()
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun rollback(context: Context) {
        runCatching { revert(context) }
            .onFailure { android.util.Log.w("FeelimeBaseDict", "rollback: ${it.message}") }
        context.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(context.packageName))
    }

    private fun status(stage: String): JSONObject =
        JSONObject().put("type", "dictBaseProgress").put("stage", stage)

    private fun messageFor(context: Context, code: String?): String {
        val zh = mapOf(
            "OK" to "基底词库换装完成",
            "REVERTED" to "已恢复内置词库",
            "BASE_DICT_READ_FAILED" to "读取文件失败或超过 150MB 上限",
            "BASE_DICT_EMPTY" to "文件里没有词条（需要「词<TAB>码」行）",
            "BASE_DICT_ENGINE_NOT_READY" to "引擎数据还没准备好，稍后再试",
            "BASE_DICT_MAINTENANCE_START_FAILED" to "编译线程启动失败",
            "BASE_DICT_TIMEOUT" to "编译超时（15 分钟），已回滚",
            "BASE_DICT_INCOMPLETE" to "编译产物不完整，已回滚",
            "BASE_DICT_INTERNAL" to "导入过程出错，已回滚",
        )
        val en = mapOf(
            "OK" to "Base dictionary swapped",
            "REVERTED" to "Built-in dictionary restored",
            "BASE_DICT_READ_FAILED" to "Read failed or file exceeds the 150MB cap",
            "BASE_DICT_EMPTY" to "No entries found (needs word<TAB>code lines)",
            "BASE_DICT_ENGINE_NOT_READY" to "Engine data not ready yet, try later",
            "BASE_DICT_MAINTENANCE_START_FAILED" to "Failed to start the compile thread",
            "BASE_DICT_TIMEOUT" to "Compile timed out (15 min), rolled back",
            "BASE_DICT_INCOMPLETE" to "Incomplete build output, rolled back",
            "BASE_DICT_INTERNAL" to "Import failed, rolled back",
        )
        val key = code ?: "OK"
        return com.feelime.ime.t(context, zh[key] ?: key, en[key] ?: key)
    }
}
