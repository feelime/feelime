package com.feelime.ime.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
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
 * - `files/rime-user/`（librime 的 user_data_dir）——编译期暂放 umbrella/
 *   31 变体 schema/default.yaml + `rime-dict-source/` 用户源；
 * - maintenance 产物落 `files/rime-user/build/`（traits 的显式 staging_dir
 *   ——librime 对它不做 build/ 追加，见 bridge 注释），运行时按
 *   staging > shared 顺序解析，天然覆盖内置 frost；
 * - 编译完成后 user 根的 yaml 源全部删除，用户源挪去 `files/rime-user-dict/`
 *   留档（该目录与 user/build 都不进 userdata 备份）；
 * - 换装经 [ACTION_BASE_DICT_CHANGED] 广播走既有 reloadGlobal + 会话重建链。
 *
 * 并发与生命周期（codex review P1-3/4/5 的边界）：
 * - maintenance 期间 librime 服务整体 disabled（上游语义）——中文输入
 *   暂不可用，UI 明示；不尝试在编译期间保持输入。
 * - 编译期间任何 reloadGlobal（finalize 内部会 join 编译线程）都会阻塞
 *   调用线程数分钟——FeelimeService 的广播 receiver 以 [isBuilding] 拦截，
 *   编译完成事件本身的重载统一补齐。
 * - 事务标记 `installing`：进程中断后由 [sweepPending] 在引擎初始化前
 *   全量回滚到内置词库，杜绝半截产物进入运行时。
 */
object BaseDictInstaller {
    const val ACTION_BASE_DICT_CHANGED = "com.feelime.ime.BASE_DICT_CHANGED"
    const val PREF_FILE = "feelime_base_dict"
    private const val KEY_MODE = "mode" // builtin | custom
    private const val KEY_NAME = "name"
    private const val KEY_INSTALLED_AT = "installed_at"
    private const val KEY_SOURCE_SHA = "source_sha"
    private const val KEY_INSTALLING = "installing"

    private const val MAX_SOURCE_BYTES = 150L * 1024 * 1024
    private const val MAINTENANCE_TIMEOUT_MS = 15 * 60 * 1000L
    private const val PROGRESS_EVERY_MS = 2000L

    /** 编译期校验的产物清单（staging= user/build 下；缺任一即失败回滚）。 */
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

    // 可重订阅的状态快照（codex review P2-8）：编译期间设置页关闭重开，
    // 新页面从 state 恢复提示行，不依赖旧 bridge 的事件回调。
    @Volatile private var stageSnapshot: String? = null
    @Volatile private var stageStartedAt: Long = 0L

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
        stageSnapshot = "COPYING"
        stageStartedAt = SystemClock.elapsedRealtime()
        worker.execute {
            var result = runCatching { installBlocking(app, uri, displayName, pushEvent) }
                .getOrElse {
                    rollback(app)
                    InstallResult("BASE_DICT_INTERNAL", changed = true)
                }
            building.set(false)
            stageSnapshot = null
            // 换装广播必须在 building 清零后发——receiver 的 P1-4 守卫正拦着
            // 编译期的 reloadGlobal，building=true 时发等于自我吞掉。
            if (result.changed) {
                app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
            }
            pushEvent(
                JSONObject()
                    .put("type", if (result.code == null) "dictBaseDone" else "dictBaseError")
                    .put("code", result.code ?: "OK")
                    .put("message", messageFor(app, result.code)),
            )
            onFinished()
        }
    }

    fun isBuilding(): Boolean = building.get()

    fun revertAsync(context: Context, pushEvent: (JSONObject) -> Unit, onFinished: () -> Unit) {
        val app = context.applicationContext
        worker.execute {
            val code = runCatching { revert(app); null as String? }
                .getOrElse { "BASE_DICT_REVERT_FAILED" }
            if (code == null) {
                app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
            }
            pushEvent(JSONObject().put("type", "dictBaseDone")
                .put("code", code ?: "REVERTED")
                .put("message", messageFor(app, code ?: "REVERTED")))
            onFinished()
        }
    }

    /** 设置页 state 的 baseDict 段（含编译中快照，供页面重开恢复提示）。 */
    fun statusJson(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        val mode = prefs.getString(KEY_MODE, "builtin") ?: "builtin"
        val built = File(context.filesDir, "rime-user/build/luna_pinyin.table.bin").isFile
        val json = JSONObject()
            .put("mode", if (mode == "custom" && built) "custom" else "builtin")
            .put("building", isBuilding())
            .putOpt("name", prefs.getString(KEY_NAME, null) ?: JSONObject.NULL)
            .putOpt("installedAt", prefs.getLong(KEY_INSTALLED_AT, 0L))
        val stage = stageSnapshot
        if (isBuilding() && stage != null) {
            json.put("stage", stage)
                .put("elapsedMs", SystemClock.elapsedRealtime() - stageStartedAt)
        }
        return json
    }

    /** 引擎初始化前的事务恢复（FeelimeService onCreate 调）：上次编译被
     *  进程中断（installing 标记残留）→ 全量回滚，运行时只能见到完整的
     *  旧库或新库（codex review P1-5）。 */
    fun sweepPending(context: Context) {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_INSTALLING, false)) return
        android.util.Log.w("FeelimeBaseDict", "sweeping interrupted install -> builtin")
        runCatching { revert(context) }
            .onFailure { android.util.Log.w("FeelimeBaseDict", "sweep: ${it.message}") }
    }

    // ---- blocking core (worker thread) ------------------------------------

    /** code=null 即成功；changed 表示磁盘词库态有变（含失败回滚），调用方
     *  据此在 building 清零后补换装广播。 */
    private class InstallResult(val code: String?, val changed: Boolean)

    private fun installBlocking(
        context: Context,
        uri: Uri,
        displayName: String,
        pushEvent: (JSONObject) -> Unit,
    ): InstallResult {
        // P2-7: maintenance 走同一个 librime 实例——编译入口自己保证
        // 引擎已 init（进程重启后直接进设置页的场景）。init 前先扫一遍
        // 中断残留（正常入口是 FeelimeService.onCreate，这里兜「只开过
        // 设置页、IME 服务从未创建」的路径）。
        sweepPending(context)
        runCatching { RimeTextEngine.ensureGlobalInit(context) }
            .onFailure { return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = false) }

        // 事务开始（P1-5）：从此刻起任何中断都会被 sweepPending 回滚。
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, true).apply()

        pushEvent(status("COPYING"))
        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR).apply {
            deleteRecursively(); mkdirs()
        }
        val stagedFile = File(sourceDir, BaseDictFiles.SOURCE_FILE)
        val staged = stageSource(context, uri, stagedFile)
        if (staged == null) {
            stagedFile.delete() // P2-9: 超限/坏文件的半截暂存不残留
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult("BASE_DICT_READ_FAILED", changed = false)
        }
        val (sha, lines) = staged
        if (lines <= 0) {
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult("BASE_DICT_EMPTY", changed = false)
        }

        // 编译现场：umbrella + 31 变体 schema + default.yaml。
        val template = engineTemplate(context) ?: run {
            rollback(context); return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = true)
        }
        runCatching {
            File(user, BaseDictFiles.UMBRELLA_FILE).writeText(
                BaseDictFiles.umbrellaYaml(sha.take(12), lines),
            )
            (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
                File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").writeText(
                    BaseDictFiles.variantSchema(template, mask),
                )
            }
            File(user, BaseDictFiles.DEFAULT_FILE).writeText(BaseDictFiles.defaultYaml())
        }.onFailure {
            rollback(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }

        // maintenance：full_check=true（staging 里已有同名产物时也要重编）。
        // 期间 librime 服务 disabled——中文输入暂不可用（上游语义）。
        if (!NativeSmoke.rimeStartMaintenance(true)) {
            rollback(context)
            return InstallResult("BASE_DICT_MAINTENANCE_START_FAILED", changed = true)
        }
        pushEvent(status("COMPILING"))
        val timeout = pollMaintenance(pushEvent)
        // join 必须等到部署线程真正收尾才能动产物（线程还在写文件时
        // 回滚会撕裂）。超时只改变结果判定，不做有风险的强杀。
        NativeSmoke.rimeJoinMaintenance()
        if (timeout) {
            rollback(context)
            return InstallResult("BASE_DICT_TIMEOUT", changed = true)
        }

        // 产物校验。
        val build = File(user, "build")
        val missing = REQUIRED_PRODUCTS.filterNot { File(build, it).isFile }
        if (missing.isNotEmpty()) {
            android.util.Log.w("FeelimeBaseDict", "missing products: $missing")
            rollback(context)
            return InstallResult("BASE_DICT_INCOMPLETE", changed = true)
        }

        // 清理编译期源 + 留档用户源 + 提交状态。换装广播由 installAsync 在
        // building 清零后统一发。
        cleanupCompileSources(user, keepSource = true)
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, false)
            .putString(KEY_MODE, "custom")
            .putString(KEY_NAME, displayName)
            .putString(KEY_SOURCE_SHA, sha)
            .putLong(KEY_INSTALLED_AT, System.currentTimeMillis())
            .apply()
        return InstallResult(null, changed = true)
    }

    /** 轮询 maintenance 状态直到收尾；超时不中断轮询（P2-10：超时后仍等
     *  部署线程自然结束，期间进度事件继续），返回是否已超时。 */
    private fun pollMaintenance(pushEvent: (JSONObject) -> Unit): Boolean {
        val started = SystemClock.elapsedRealtime()
        var lastPush = 0L
        var timedOut = false
        while (NativeSmoke.rimeIsMaintenanceMode()) {
            val now = SystemClock.elapsedRealtime()
            val elapsed = now - started
            if (!timedOut && elapsed > MAINTENANCE_TIMEOUT_MS) {
                timedOut = true
                android.util.Log.w("FeelimeBaseDict", "maintenance timed out, draining")
            }
            if (now - lastPush > PROGRESS_EVERY_MS) {
                lastPush = now
                pushEvent(status(if (timedOut) "DRAINING" else "COMPILING")
                    .put("elapsedMs", elapsed))
            }
            Thread.sleep(500)
        }
        return timedOut
    }

    /** SAF 流暂存到 target；返回 (sha256, TAB 词条行数)；读取失败/超限/无
     *  词条给 null（词条数 0 也返回，由调用方区分报错）。 */
    private fun stageSource(context: Context, uri: Uri, target: File): Pair<String, Int>? {
        val input = runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            ?: return null
        val digest = MessageDigest.getInstance("SHA-256")
        var total = 0L
        var failed = false
        val buffer = ByteArray(1 shl 16)
        input.use { stream ->
            target.outputStream().use { out ->
                while (true) {
                    val read = stream.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > MAX_SOURCE_BYTES) {
                        failed = true
                        break
                    }
                    digest.update(buffer, 0, read)
                    out.write(buffer, 0, read)
                }
            }
        }
        if (failed || total == 0L) return null
        var tabLines = 0
        target.bufferedReader(Charsets.UTF_8).useLines { seq ->
            seq.forEach { line ->
                if (!line.startsWith("#") && line.contains('\t')) tabLines++
            }
        }
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

    /** 失败/恢复/清扫共用的完整回滚：回内置 frost（含事务标记清理）。
     *  删除结果检查后发换装广播——运行中的会话立即重建回内置。 */
    private fun revert(context: Context) {
        val user = File(context.filesDir, "rime-user")
        if (user.isDirectory) {
            val build = File(user, "build")
            if (build.isDirectory && !build.deleteRecursively()) {
                android.util.Log.w("FeelimeBaseDict", "build dir not fully deleted")
            }
            cleanupCompileSources(user, keepSource = false)
        }
        File(context.filesDir, "rime-user-dict").deleteRecursively()
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun rollback(context: Context) {
        runCatching { revert(context) }
            .onFailure { android.util.Log.w("FeelimeBaseDict", "rollback: ${it.message}") }
        // 换装广播不在这里发：此刻 building 仍为 true，receiver 的守卫会
        // 吞掉它（见 installAsync 的时序说明）。
    }

    private fun clearInstalling(context: Context) {
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, false).apply()
    }

    private fun status(stage: String): JSONObject =
        JSONObject().put("type", "dictBaseProgress").put("stage", stage)

    private fun messageFor(context: Context, code: String?): String {
        val key = code ?: "OK"
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
            "BASE_DICT_REVERT_FAILED" to "恢复内置失败，请重试或重启应用",
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
            "BASE_DICT_REVERT_FAILED" to "Restore failed, retry or restart the app",
        )
        return com.feelime.ime.t(context, zh[key] ?: key, en[key] ?: key)
    }
}
