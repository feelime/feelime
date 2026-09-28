package com.feelime.ime.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import com.feelime.ime.nativeengine.NativeSmoke
import java.io.File
import java.io.PushbackInputStream
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream
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
    // #37：码表域检测结果（-1=未检测）。切得开拼音音节的码列占比低于
    // 阈值 → 形码/音形码表特征，全拼方案（拼音 prism）下大量码无法命中。
    private const val KEY_NON_PINYIN_RATIO = "non_pinyin_ratio"
    private const val NON_PINYIN_THRESHOLD = 0.5f
    private const val NON_PINYIN_SAMPLE = 4000

    /** #35 带调码表检测：抽样码列带声调字符的占比超阈值 → 疑似完整版
     *  （如万象 Base，码列 ā bà 形态），完整版打不出（键面无调）——
     *  持续提示改用去调 Lite 版。Lite（去调后 a ba）与英文表占比≈0。 */
    private const val KEY_TONED = "toned"
    /** 基底词条数（#35 T9 内存门的 flypy 联动用，兼诊断）。 */
    private const val KEY_TAB_LINES = "tab_lines"
    /** T9 因词条量/内存被跳过（E：设置页持续提示直到换库/换小库）。 */
    private const val KEY_T9_SKIPPED = "t9_skipped"
    /** 主表构建的内存估算系数（实测万象 2.7M 词条峰值 1.2GB ≈ 450B/条）。 */
    private const val BASE_BUILD_BYTES_PER_ENTRY = 600L
    private const val TONE_RATIO_THRESHOLD = 0.02

    // ---- #20 音形码表导入（小鹤音形）：独立于基底词库的第二换装通道 ----
    // 事务标记共用 KEY_INSTALLING（编译期间进程中断由 sweepPending 回滚），
    // kind 区分回滚目标（基底全量 vs 仅音形产物）。
    private const val KEY_INSTALLING_KIND = "installing_kind"
    private const val KIND_BASE = "base"
    private const val KIND_FLYPY = "flypy"
    /** 写入事务的进程 pid（codex P1-2）：编译期间重开设置页时
     *  sweepPending 不能把 worker 正在跑的事务当进程中断回滚——
     *  「同 pid + isBuilding」= 本进程在编，跳过；否则才是冷启动
     *  残留（别的 pid 写的，或本 pid 但 worker 已收尾）。 */
    private const val KEY_INSTALLING_PID = "installing_pid"
    private const val KEY_FLYPY_MODE = "flypy_mode"    // custom | -
    private const val KEY_FLYPY_NAME = "flypy_name"
    private const val KEY_FLYPY_SHA = "flypy_sha"
    private const val KEY_FLYPY_AT = "flypy_installed_at"
    /** 音形码表量级 ~1MB（码+词 6 万条），20MB 上限足够宽。 */
    private const val FLYPY_MAX_SOURCE_BYTES = 20L * 1024 * 1024

    /** 模糊音补编的双职标记（codex 二轮 P1-1/P2-4/P2-6）：忙时排队
     *  补偿的 pending mask；编译前置的事务位（进程中断后 sweepPending
     *  据此删半成品 prism——librime 原地写入，被杀时文件可能存在但不
     *  完整，「isFile 即有效」不成立）。 */
    private const val KEY_FUZZY_PENDING_MASK = "fuzzy_pending_mask"
    private const val KEY_FUZZY_COMPILING_MASK = "fuzzy_compiling_mask"
    private const val FLYPY_TIMEOUT_MS = 10 * 60 * 1000L

    /** #20 编译产物（staging）。compiled schema yaml 是 DictCompiler 输出，
     *  运行时 schema 组件要读，回滚时与 bin 一起删；reverse.bin 是
     *  table_translator 的反查表（AVD 实测会产出，一并清理）。 */
    private val FLYPY_PRODUCTS = listOf(
        BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin", "flypy.reverse.bin",
        "${BaseDictFiles.FLYPY_SCHEMA}.schema.yaml",
    )

    /** #37 门闸（codex P2-4）：阈值约定严格小于——恰好 0.5 的拼音系
     *  码表不算形码（`in 0f..THRESHOLD` 是闭区间，会误报）。 */
    fun nonPinyinHint(mode: String, built: Boolean, ratio: Float): Double? =
        if (mode == "custom" && built && ratio >= 0f && ratio < NON_PINYIN_THRESHOLD) ratio.toDouble() else null

    /** #35 门闸：只在 custom 已编译生效时提示。 */
    fun tonedHint(mode: String, built: Boolean, toned: Boolean): Boolean =
        mode == "custom" && built && toned

    private const val MAX_SOURCE_BYTES = 150L * 1024 * 1024
    /** 提醒阈值（#35 万象实测修正）：2.7M 词条的全套 36 个 prism 在
     *  慢机上要 1 小时量级。超时不再判负回滚——只是把进度文案切到
     *  DRAINING 并记日志，join 等编译自然结束后按产物完整性定成败
     *  （慢设备 drain 完、产物齐 = 成功；真缺产物才回滚）。 */
    private const val MAINTENANCE_TIMEOUT_MS = 45 * 60 * 1000L
    private const val PROGRESS_EVERY_MS = 2000L

    /** 编译期校验的产物清单（staging= user/build 下；缺任一即失败回滚）。
     *  #35 延迟编译：随编译清单推导（luna 产 table+prism，其余 schema 只
     *  产 prism；模糊音变体只在进入本次清单时校验）。 */
    private fun requiredProducts(schemas: List<String>): List<String> =
        schemas.flatMap { schema ->
            if (schema == "luna_pinyin") {
                listOf("luna_pinyin.table.bin", "luna_pinyin.prism.bin")
            } else if (schema == BaseDictFiles.FLYPY_SCHEMA) {
                listOf(BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin")
            } else {
                listOf("$schema.prism.bin")
            }
        }

    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "feelime-base-dict") }
    private val building = AtomicBoolean(false)

    /** 忙时排队的登记/消费共用锁（codex 三轮 P2-3）：CAS 失败到写 pending
     *  之间若被切走，收尾消费可能读到旧值 0 提前结束——丢唤醒。同锁后
     *  消费方必然看到登记方刚写的值。 */
    private val pendingLock = Any()

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
            // 编译保活（ace 实录：灭屏数分钟 ColorOS 静默清进程）。收尾的
            // stop 在补偿排队之后——排进来的补编任务会自己再 start。
            CompileGuardService.start(app)
            var result = runCatching { installBlocking(app, uri, displayName, pushEvent) }
                .getOrElse {
                    runCatching { rollback(app) }
                    InstallResult("BASE_DICT_INTERNAL", changed = true)
                }
            // building 先清（换装广播的前置——receiver 的 P1-4 守卫正拦着
            // 编译期的 reloadGlobal）。此后本 lambda 不再触碰 building：
            // 收尾补偿排入的下一个补编任务由它自己的 CAS 持有，上一个
            // 任务的 finally 若再清零会让补编全程裸奔（codex 三轮 P1-1）。
            building.set(false)
            stageSnapshot = null
            try {
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
            } finally {
                CompileGuardService.stop(app)
            }
            // 补偿放 building/FGS 语义收尾之后（P2-6）：走了排队路径的由
            // compensatePendingFuzzy 处理；没走成排队的（基底导入期 mode
            // 尚未提交、receiver 早退，切到的组合不在安装清单）由这次
            // 无条件补判兜住——prism 已在就 no-op。
            compensatePendingFuzzy(app)
            if (result.code == null) ensureFuzzyVariantIfNeeded(app)
        }
    }

    fun isBuilding(): Boolean = building.get()

    /** 忙时排队的补编补偿（P2-6）：任务收尾（building 已清零）统一触发。
     *  目标变体若本次安装清单已编出（prism 在），ifNeeded 自行 no-op。 */
    private fun compensatePendingFuzzy(app: Context) {
        synchronized(pendingLock) {
            val pending = app.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
                .getInt(KEY_FUZZY_PENDING_MASK, 0)
            if (pending != 0) {
                app.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
                    .remove(KEY_FUZZY_PENDING_MASK).apply()
                ensureFuzzyVariantIfNeeded(app)
            }
        }
    }

    /** #20 音形码表导入（与基底换装共用 worker/building，互斥）。 */
    fun installFlypyAsync(
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
            CompileGuardService.start(app)
            var result = runCatching { installFlypyBlocking(app, uri, displayName, pushEvent) }
                .getOrElse {
                    runCatching { revertFlypy(app) }
                    InstallResult("BASE_DICT_INTERNAL", changed = true)
                }
            building.set(false)
            stageSnapshot = null
            try {
                if (result.changed) {
                    app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
                }
                pushEvent(
                    JSONObject()
                        .put("type", if (result.code == null) "flypyDone" else "flypyError")
                        .put("code", result.code ?: "FLYPY_OK")
                        .put("message", messageFor(app, result.code ?: "FLYPY_OK")),
                )
                onFinished()
            } finally {
                CompileGuardService.stop(app)
            }
            compensatePendingFuzzy(app)
        }
    }

    /** #20 移除音形码表（删产物 + 留档，模式菜单随之隐藏）。 */
    fun revertFlypyAsync(context: Context, pushEvent: (JSONObject) -> Unit, onFinished: () -> Unit) {
        val app = context.applicationContext
        worker.execute {
            val code = runCatching { revertFlypy(app); null as String? }
                .getOrElse { "BASE_DICT_REVERT_FAILED" }
            if (code == null) {
                app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
            }
            pushEvent(JSONObject().put("type", "flypyDone")
                .put("code", code ?: "FLYPY_REVERTED")
                .put("message", messageFor(app, code ?: "FLYPY_REVERTED")))
            onFinished()
        }
    }

    /** #35 延迟编译的补编入口：模糊音组合切换且目标变体 prism 缺失时，
     *  从留档源恢复编译现场，单独编这一个变体（真机 ~1.5min）。期间
     *  输入按严格全拼降级（fuzzySchemaId 找不到变体回落 null，现状
     *  语义），编完发换装广播让 IME 会话重建用上新变体。
     *  前置条件由调用方判（基底 custom；prism 确实缺失）。 */
    /** receiver 入口：按需判定（基底 custom 且目标变体 prism 缺失）再触发。
     *  忙时（导入/另一补编在跑）记 pending mask 由导入收尾补偿（codex
     *  二轮 P2-6：忙时直接丢弃会让目标变体一直缺失）。 */
    fun ensureFuzzyVariantIfNeeded(context: Context) {
        val mask = FuzzyPinyin.mask(context)
        val variant = BaseDictFiles.fuzzyVariant(mask) ?: return
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        if (prefs.getString(KEY_MODE, "builtin") != "custom") return
        if (fuzzyVariantIntact(context, mask)) return
        android.util.Log.i("FeelimeBaseDict", "fuzzy variant $variant missing -> compile")
        ensureFuzzyVariantAsync(context, mask)
    }

    /** 变体产物可用 = prism 存在且无编译事务位残留（codex 三轮 P1-2：
     *  librime 原地写，中断的半截 prism 文件也在——只看 isFile 会把
     *  残骸当可用变体喂给运行时）。fuzzySchemaId 与入口共用本判定。 */
    fun fuzzyVariantIntact(context: Context, mask: Int): Boolean {
        val variant = BaseDictFiles.fuzzyVariant(mask) ?: return false
        if (!File(context.filesDir, "rime-user/build/$variant.prism.bin").isFile) return false
        return context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
            .getInt(KEY_FUZZY_COMPILING_MASK, 0) == 0
    }

    fun ensureFuzzyVariantAsync(context: Context, mask: Int) {
        if (mask !in BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX) return
        val app = context.applicationContext
        // codex 二轮 P1-1：补编与导入共用 building——期间 customPhrases 等
        // receiver 的 isBuilding 守卫必须同样拦住主线程 reloadGlobal（否则
        // finalize join 编译线程 = ANR）。抢不到即排队，由当前任务的收尾
        // （installBlocking 提交段 / 本函数结尾）统一补偿。
        synchronized(pendingLock) {
            if (!building.compareAndSet(false, true)) {
                context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
                    .putInt(KEY_FUZZY_PENDING_MASK, mask).apply()
                android.util.Log.i("FeelimeBaseDict", "busy -> fuzzy m$mask queued")
                return
            }
        }
        worker.execute {
            CompileGuardService.start(app)
            val code = runCatching { compileFuzzyVariant(app, mask) }
                .getOrElse { "BASE_DICT_INTERNAL" as String? }
            building.set(false)
            try {
                if (code != null) {
                    android.util.Log.w("FeelimeBaseDict", "fuzzy variant m$mask compile: $code")
                } else {
                    android.util.Log.i("FeelimeBaseDict", "fuzzy variant m$mask compiled")
                }
                // 失败也发（codex 二轮 P2-5）：reloadGlobal 已使旧会话失效，
                // 失败收尾同样要重建会话（回严格全拼），否则输入不恢复。
                app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
            } finally {
                CompileGuardService.stop(app)
            }
            // 补偿排队中的补编（串行 worker 上不存在重入）；放 building
            // 清零之后，下一个任务的 CAS 不被本任务的 finally 覆盖
            // （codex 三轮 P1-1）。
            compensatePendingFuzzy(app)
        }
    }

    /** 编一个模糊音变体；null=成功。事务位（KEY_FUZZY_COMPILING_MASK）
     *  先于 prism 落盘写、成功后清——中断残留由 sweepPending 删半成品。
     *  现场（源/umbrella/default/变体 schema）在 finally 统一清理（codex
     *  二轮 P2-5：失败出口不能残留半截现场影响下次补编）。 */
    private fun compileFuzzyVariant(context: Context, mask: Int): String? {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        if (prefs.getString(KEY_MODE, "builtin") != "custom") return "NOT_CUSTOM_BASE"
        val variant = BaseDictFiles.fuzzyVariant(mask) ?: return "BAD_MASK"
        val user = File(context.filesDir, "rime-user")
        val staging = File(user, "build")
        val prism = File(staging, "$variant.prism.bin")
        if (prism.isFile && prefs.getInt(KEY_FUZZY_COMPILING_MASK, 0) == 0) {
            return null // 已有且非中断残留，无需补编
        }

        val archive = File(context.filesDir, "rime-user-dict")
        if (!archive.isDirectory) return "NO_ARCHIVE"
        val template = engineTemplate(context) ?: return "ENGINE_NOT_READY"
        val defaultYaml = runCatching {
            BaseDictFiles.defaultYaml(
                context.assets.open(BaseDictFiles.ASSETS_DEFAULT).bufferedReader().readText(),
                listOf(variant),
            )
        }.getOrNull() ?: return "NO_TEMPLATE"
        val sha = prefs.getString(KEY_SOURCE_SHA, "user") ?: "user"
        // 事务位：此后进程中断 → sweepPending 删该 prism（librime 原地
        // 写入，「文件存在」不等于完整）。
        prefs.edit().putInt(KEY_FUZZY_COMPILING_MASK, mask).apply()
        var result: String? = "STAGE_FAILED"
        try {
            runCatching {
                val sourceDir = File(user, BaseDictFiles.SOURCE_DIR).apply {
                    deleteRecursively(); mkdirs()
                }
                archive.listFiles()?.forEach {
                    it.copyTo(File(sourceDir, it.name), overwrite = true)
                }
                File(user, BaseDictFiles.UMBRELLA_FILE).writeText(
                    BaseDictFiles.umbrellaYaml(
                        sha.take(12), stagedTableNames(sourceDir), stagedLineHint(prefs),
                    ),
                )
                val schemaText = BaseDictFiles.variantSchema(template, mask)
                File(user, "$variant.schema.yaml").writeText(schemaText)
                File(staging, "$variant.schema.yaml").writeText(schemaText)
                File(user, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
                File(staging, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
            }.getOrElse { return finallyCleanup(user, staging, prefs, "STAGE_FAILED") }

            runCatching { RimeTextEngine.reloadGlobal(context) }
                .getOrElse { return finallyCleanup(user, staging, prefs, "RELOAD_FAILED") }
            if (!NativeSmoke.rimeStartMaintenance(false)) {
                return finallyCleanup(user, staging, prefs, "MAINTENANCE_FAILED")
            }
            pollMaintenance({ })
            NativeSmoke.rimeJoinMaintenance()
            result = if (prism.isFile) null else "PRISM_MISSING"
            return result
        } finally {
            finallyCleanup(user, staging, prefs, result ?: "")
        }
    }

    /** 补编收尾清场：编译源（user 根）+ default 双落位 + 事务位；成功时
     *  变体 compiled schema 与 prism 留 staging（运行时要读）。返回 code
     *  透传（finally 里 return 的 Kotlin 惯用法：正常路径先算好 result）。 */
    private fun finallyCleanup(
        user: File,
        staging: File,
        prefs: android.content.SharedPreferences,
        code: String,
    ): String {
        File(user, BaseDictFiles.SOURCE_DIR).deleteRecursively()
        File(user, BaseDictFiles.UMBRELLA_FILE).delete()
        File(user, BaseDictFiles.DEFAULT_FILE).delete()
        File(staging, BaseDictFiles.DEFAULT_FILE).delete()
        // 变体 schema 源（maintenance 的源解析用）也清——实测漏删会在
        // user 根累积 luna_pinyin_fuzzy_m*.schema.yaml。
        (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
            File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").delete()
        }
        // 成功/确认无产物（PRISM_MISSING = prism 根本没写出）清事务位；
        // 中途失败保留事务位——半成品/无产物都视为不可用，下次补编
        // 重走（开头 isFile && compiling==0 判定拦截误用）。
        if (code == "" || code == "PRISM_MISSING") {
            prefs.edit().remove(KEY_FUZZY_COMPILING_MASK).apply()
        }
        return code
    }

    /** 留档目录里的表文件名（补编现场恢复用）。 */
    private fun stagedTableNames(sourceDir: File): List<String> =
        sourceDir.listFiles()?.map { it.name }?.sorted() ?: emptyList()

    /** umbrella 的行数注释位（补编路径拿不到精确值，留诊断提示）。 */
    private fun stagedLineHint(@Suppress("UNUSED_PARAMETER") prefs: android.content.SharedPreferences): Int = 0

    fun isFlypyInstalled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        return prefs.getString(KEY_FLYPY_MODE, null) == "custom" &&
            File(context.filesDir, "rime-user/build/${BaseDictFiles.FLYPY_TABLE}").isFile
    }

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
        val ratio = prefs.getFloat(KEY_NON_PINYIN_RATIO, -1f)
        val json = JSONObject()
            .put("mode", if (mode == "custom" && built) "custom" else "builtin")
            .put("building", isBuilding())
            .putOpt("name", prefs.getString(KEY_NAME, null) ?: JSONObject.NULL)
            .putOpt("installedAt", prefs.getLong(KEY_INSTALLED_AT, 0L))
            // #37：形码/音形特征（可切码占比低于阈值）持续提示，直到换回
            // 内置或导入拼音系码表。
            .putOpt("nonPinyin", nonPinyinHint(mode, built, ratio) ?: JSONObject.NULL)
            // #35：带调码表（疑似完整版）持续提示，直到换 Lite/内置。
            .put("toned", tonedHint(mode, built, prefs.getBoolean(KEY_TONED, false)))
            // T9 跳过提示（E）：词条量/内存门跳编九宫格，直到换库消失。
            .put("t9Skipped", mode == "custom" && built &&
                prefs.getBoolean(KEY_T9_SKIPPED, false) &&
                !File(context.filesDir, "rime-user/build/luna_pinyin_t9.prism.bin").isFile)
        val stage = stageSnapshot
        if (isBuilding() && stage != null) {
            json.put("stage", stage)
                .put("elapsedMs", SystemClock.elapsedRealtime() - stageStartedAt)
        }
        // #20：音形码表独立状态段。
        val flypyBuilt = File(context.filesDir, "rime-user/build/${BaseDictFiles.FLYPY_TABLE}").isFile
        json.put("flypy", JSONObject()
            .put("installed", prefs.getString(KEY_FLYPY_MODE, null) == "custom" && flypyBuilt)
            .putOpt("name", prefs.getString(KEY_FLYPY_NAME, null) ?: JSONObject.NULL)
            .putOpt("installedAt", prefs.getLong(KEY_FLYPY_AT, 0L)))
        return json
    }

    /** 引擎初始化前的事务恢复（FeelimeService/SetupActivity onCreate 调）：
     *  上次编译被进程中断（installing 标记残留）→ 全量回滚，运行时只能
     *  见到完整的旧库或新库（codex review P1-5；真机第 5 轮 G 段证明
     *  两条入口都要挂——只挂 service 时 force-stop 后开设置页看到
     *  误导性的「自定义」态）。幂等：无标记即 no-op。 */
    fun sweepPending(context: Context) {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_INSTALLING, false)) return
        // codex P1-2：本进程 worker 正在编译（编译期间重开设置页）时，
        // installing 标记是「活的」不是残留——此刻回滚会删掉正在写的
        // 编译现场。冷启动残留的 pid 必然不同（或同 pid 但进程重启过、
        // worker 不在跑——building=false 时仍走回滚，覆盖同 pid 重启的
        // 理论窗口）。
        if (prefs.getInt(KEY_INSTALLING_PID, -1) == android.os.Process.myPid() &&
            isBuilding()
        ) return
        // 补编中断的事务位（codex 三轮 P1-2）：不占 KEY_INSTALLING，单独
        // 清扫——半截 prism 删掉，让下次 ensure 判定缺失并重编。
        val staleCompiling = prefs.getInt(KEY_FUZZY_COMPILING_MASK, 0)
        if (staleCompiling != 0) {
            val variant = BaseDictFiles.fuzzyVariant(staleCompiling)
            android.util.Log.w("FeelimeBaseDict", "sweeping interrupted fuzzy m$staleCompiling")
            runCatching {
                if (variant != null) {
                    File(context.filesDir, "rime-user/build/$variant.prism.bin").delete()
                }
                // 编译现场的 user 根残留（源/umbrella/default/变体 schema）
                // 一并清——finallyCleanup 没机会跑。
                val user = File(context.filesDir, "rime-user")
                File(user, BaseDictFiles.SOURCE_DIR).deleteRecursively()
                File(user, BaseDictFiles.UMBRELLA_FILE).delete()
                File(user, BaseDictFiles.DEFAULT_FILE).delete()
                File(File(user, "build"), BaseDictFiles.DEFAULT_FILE).delete()
                (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { m ->
                    File(user, "${FuzzyPinyin.SCHEMA_ID}_m$m.schema.yaml").delete()
                }
            }
            prefs.edit().remove(KEY_FUZZY_COMPILING_MASK).apply()
        }
        val kind = prefs.getString(KEY_INSTALLING_KIND, KIND_BASE) ?: KIND_BASE
        android.util.Log.w("FeelimeBaseDict", "sweeping interrupted $kind install")
        // #20：按 kind 分派回滚目标——音形导入中断只回滚音形现场，
        // 不动已换装的基底词库（反之亦然）。
        runCatching {
            if (kind == KIND_FLYPY) revertFlypy(context) else revert(context)
        }.onFailure { android.util.Log.w("FeelimeBaseDict", "sweep: ${it.message}") }
        // 回滚后若 IME 服务活着（SetupActivity 入口时可能），发广播让其
        // 立即重载回内置；service 启动早期 receiver 未注册，广播无人收
        // 也无害（后续 init 自然落到 shared）。
        context.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(context.packageName))
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
        // 装新 APK 后直接进设置页（IME service 未起）时部署从未跑过
        // （ensureAsync 只挂在 service onCreate）——先同步部署再 init。
        EngineDataStore.ensureSync(context)
        runCatching { RimeTextEngine.ensureGlobalInit(context) }
            .onFailure { return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = false) }

        // 事务开始（P1-5）：从此刻起任何中断都会被 sweepPending 回滚。
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, true)
            .putString(KEY_INSTALLING_KIND, KIND_BASE)
            .putInt(KEY_INSTALLING_PID, android.os.Process.myPid())
            .apply()

        pushEvent(status("COPYING"))
        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR).apply {
            deleteRecursively(); mkdirs()
        }
        // #35：单文件或 zip 多表（万象 Lite 包）统一解包到 sourceDir。
        // 失败/超限时半截文件不残留（P2-9）：整目录清掉再报错。
        val outcome = stageSource(context, uri, sourceDir)
        val staged = outcome.staged
        if (staged == null) {
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult(outcome.errorCode ?: "BASE_DICT_READ_FAILED", changed = false)
        }
        val stats = analyzeSource(staged.files)
        if (staged.files.isEmpty() || stats.tabLines <= 0) {
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult("BASE_DICT_EMPTY", changed = false)
        }
        val sha = staged.sha
        val toned = stats.toneRatio > TONE_RATIO_THRESHOLD
        // #37 码表域检测：编译照常（导入域只承诺 yaml 可解析可编译），
        // 抽样提示「较多编码不是拼音音节组合」（启发式，非兼容性判定，
        // codex R1 实测换装重编 prism 后形码串也可命中）。多表包按行数
        // 加权（每表分摊采样额度）。音节表加载失败/检测异常 → 不落盘
        // 不提示，绝不阻断导入。
        val syllables = syllableSet(context)
        val nonPinyinRatio: Float? =
            if (syllables.isEmpty()) null
            else runCatching { pinyinRatioOverFiles(stats, syllables) }.getOrNull()
        android.util.Log.i("FeelimeBaseDict",
            "code-domain probe: segmentable=${nonPinyinRatio ?: "n/a"} " +
                "toneRatio=${"%.4f".format(stats.toneRatio)} tables=${staged.files.size}")

        // 内存预检（整体 review F）：主表构建峰值实测 ~450B/词条（万象
        // 2.7M→1.2GB），按 600B/词条留余量估总峰值（table+主 prism 同场）。
        // 可用内存兜不住直接报错——跑下去也是中途被系统杀（ace 实录：
        // Athena SIGKILL 后全量回滚，用户白等十分钟）。
        val availBytes = availMemory(context)
        val estBytes = stats.tabLines * BASE_BUILD_BYTES_PER_ENTRY
        if (availBytes in 1 until estBytes) {
            android.util.Log.w("FeelimeBaseDict",
                "memory preflight: avail=${availBytes / 1_000_000}MB " +
                    "est=${estBytes / 1_000_000}MB entries=${stats.tabLines}")
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult("BASE_DICT_MEMORY_LOW", changed = false)
        }

        // 编译现场：umbrella + 31 变体 schema + default.yaml，双落位
        // （librime resolver 语义，真机首验 2 秒空转定罪）：
        // - user 根 = 源形态：source resolver（user→shared）从这里读
        //   schema 源、umbrella 词典源；
        // - staging（user/build）= deployed 形态：WorkspaceUpdate 读
        //   default.yaml 的 schema_list、SchemaUpdate 读 compiled schema
        //   都走 deployed resolver（staging→prebuilt），user 根的 yaml
        //   它们看不见——不落 staging 就是「schema list not defined」
        //   整体失败 / 变体「not requiring a dictionary」静默跳过，零产物。
        // staging 的变体副本随后被 DictCompiler 的 compiled schema 输出
        // 覆盖；luna/双拼/T9 的 compiled schema 由 prebuilt（shared）兜底。
        val template = engineTemplate(context) ?: run {
            rollback(context); return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = true)
        }
        // 完整 default.yaml / symbols.yaml 模板（frost 原版，assets/rime-compile）：
        // schema 编译链 include default:menu/key_binder/… 与 symbols:punctuator。
        // #35 延迟编译：核心 6 项 + 当前模糊音 1 变体（见 baseCompileSchemas）；
        // #20 联动：音形码表已导入时 flypy 同场在列。
        val flypyInstalled = isFlypyInstalled(context)
        val includeT9 = BaseDictFiles.t9Eligible(stats.tabLines, availBytes)
        val compileSchemas = BaseDictFiles.baseCompileSchemas(
            FuzzyPinyin.mask(context), flypyInstalled, includeT9,
        )
        if (!includeT9) {
            android.util.Log.w("FeelimeBaseDict",
                "T9 skipped: ${stats.tabLines} entries, " +
                    "avail=${availBytes / 1_000_000}MB")
        }

        // #35 双拼/T9 纯拼音子伞表（「ing欧」定罪）：按表采样切分比例，
        // 拼音码表照旧进全量伞表（全拼英文混输特性保留），字母码表
        // （en/abbrev 类）只进全量伞。全部表都是拼音码时不分表（单文件
        // #23 导入零变化）；切不出来（全字母）也退回全量（行为同旧）。
        val dpTables: List<String> = if (syllables.isEmpty() || nonPinyinRatio == null) {
            emptyList()
        } else {
            staged.files.filter { f ->
                val lines = stats.perFile.firstOrNull { it.first == f }?.second ?: 0
                lines <= 0 || runCatching {
                    pinyinCodeRatio(f, syllables, NON_PINYIN_SAMPLE / 4, lines) >= 0.5f
                }.getOrDefault(true)
            }.map { it.name }.also { eligible ->
                if (eligible.size == staged.files.size || eligible.isEmpty()) {
                    android.util.Log.i("FeelimeBaseDict",
                        "dp umbrella: no split (${eligible.size}/${staged.files.size} pinyin tables)")
                }
            }
        }
        val splitDp = dpTables.isNotEmpty() && dpTables.size < staged.files.size
        val assets = context.assets
        val defaultYaml = runCatching {
            BaseDictFiles.defaultYaml(
                assets.open(BaseDictFiles.ASSETS_DEFAULT).bufferedReader().readText(),
                compileSchemas,
            )
        }.getOrNull() ?: run {
            rollback(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }
        val symbolsYaml = runCatching {
            assets.open(BaseDictFiles.ASSETS_SYMBOLS).bufferedReader().readText()
        }.getOrNull() ?: run {
            rollback(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }
        runCatching {
            val staging = File(user, "build").apply { mkdirs() }
            File(user, BaseDictFiles.UMBRELLA_FILE).writeText(
                BaseDictFiles.umbrellaYaml(sha.take(12), staged.files.map { it.name }, stats.tabLines),
            )
            if (splitDp) {
                // 子伞表（user 根源形态）+ 双拼/T9 schema 的 dictionary 改写
                //（shared 原版引用 luna_pinyin；user/staging 双落位影随）。
                File(user, BaseDictFiles.DP_UMBRELLA_FILE).writeText(
                    BaseDictFiles.umbrellaYaml(sha.take(12), dpTables, stats.tabLines,
                        BaseDictFiles.DP_DICTIONARY),
                )
                BaseDictFiles.KEYMAPPED_SCHEMAS.forEach { schema ->
                    val src = EngineDataStore.readyFile(context, "rime/$schema.schema.yaml")
                    if (src != null) {
                        val rewritten = BaseDictFiles.rewriteDictionary(
                            src.readText(), BaseDictFiles.DP_DICTIONARY,
                        )
                        File(user, "$schema.schema.yaml").writeText(rewritten)
                        File(staging, "$schema.schema.yaml").writeText(rewritten)
                    }
                }
            }
            (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
                val variant = BaseDictFiles.variantSchema(template, mask)
                File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").writeText(variant)
                File(staging, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").writeText(variant)
            }
            // default 双落位：user 根 = ConfigBuilder 的源（include 解析），
            // staging = SchemaListUpdate 的 deployed 直读。
            File(user, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
            File(staging, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
            // symbols 只需 user 根（编译链的源解析）。
            File(user, BaseDictFiles.SYMBOLS_FILE).writeText(symbolsYaml)
            // codex 二轮 P1-B：清掉不在本次清单里的旧变体 prism——上一
            // 基底编的 prism 配本次新 table 会出错位候选（同名文件 ≠
            // 同源产物）。当前组合的变体在清单内（full_check=true 重编），
            // 其余删掉后由 ensureFuzzyVariantIfNeeded 按需补编。
            // T9 同理：本次跳过（词条超限）时清上一基底的 t9 prism，
            // isModeReady 据此把 T9 模式判为不可用。
            staging.listFiles()?.forEach { f ->
                val stem = f.name.removeSuffix(".prism.bin")
                val managed = stem.startsWith("${FuzzyPinyin.SCHEMA_ID}_m") ||
                    stem == "luna_pinyin_t9"
                if (f.name.endsWith(".prism.bin") && managed &&
                    stem !in compileSchemas
                ) f.delete()
            }
            if (!splitDp) {
                // 上一基底分过表而本次不分（词库全拼音）：子伞产物与 schema
                // 影随副本全部失效——prism 引用的字典已不存在。
                staging.listFiles()?.forEach { f ->
                    if (f.name == BaseDictFiles.DP_TABLE ||
                        f.name.removeSuffix(".prism.bin") in BaseDictFiles.KEYMAPPED_SCHEMAS
                    ) f.delete()
                }
            }
        }.onFailure {
            rollback(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }

        // maintenance 前整引擎重载（finalize+init，真机第二轮钉死）：
        // librime 的 config 组件按资源 id 缓存弱引用 ConfigData
        // （config_component.cc GetConfigData），运行中的引擎持有
        // "default" 与各 schema 的旧配置引用（当时 build/ 为空），
        // 不重载的话 WorkspaceUpdate 读 schema_list 命中缓存零 IO、
        // SchemaUpdate 的 compiled schema 同理——读回的全是旧世界，
        // 编译要么整体失败要么拿旧配置编出错位 prism。重载后组件表
        // 重建、缓存清空，部署器以 staging 现场真读盘。代价与
        // maintenance 语义一致：编译期间中文输入暂不可用。
        runCatching { RimeTextEngine.reloadGlobal(context) }
            .onFailure {
                rollback(context)
                return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = true)
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
        // 回滚会撕裂）。超时不自动判负（#35 万象实测：2.7M 词条慢机
        // 超 45min 也该等它编完），成败由产物完整性判定。
        NativeSmoke.rimeJoinMaintenance()

        // 产物校验（按本次编译清单推导；#35 延迟编译后只验进过清单的）。
        val build = File(user, "build")
        val required = requiredProducts(compileSchemas) +
            listOfNotNull(BaseDictFiles.DP_TABLE.takeIf { splitDp })
        val missing = required.filterNot { File(build, it).isFile }
        if (missing.isNotEmpty()) {
            android.util.Log.w("FeelimeBaseDict", "missing products: $missing")
            rollback(context)
            return InstallResult(
                if (timeout) "BASE_DICT_TIMEOUT" else "BASE_DICT_INCOMPLETE",
                changed = true,
            )
        }

        // 清理编译期源 + 留档用户源 + 提交状态。换装广播由 installAsync 在
        // building 清零后统一发。
        cleanupCompileSources(user, keepSource = true)
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, false)
            // P1-B 收尾：残留的补编事务位/排队位一并作废（半成品要么
            // 被重编要么已删）。
            .remove(KEY_FUZZY_COMPILING_MASK).remove(KEY_FUZZY_PENDING_MASK)
            .putString(KEY_MODE, "custom")
            .putString(KEY_NAME, displayName)
            .putString(KEY_SOURCE_SHA, sha)
            .putLong(KEY_INSTALLED_AT, System.currentTimeMillis())
            .putFloat(KEY_NON_PINYIN_RATIO, nonPinyinRatio ?: -1f)
            .putBoolean(KEY_TONED, toned)
            .putInt(KEY_TAB_LINES, stats.tabLines)
            .putBoolean(KEY_T9_SKIPPED, !includeT9)
            .apply()
        return InstallResult(null, changed = true)
    }

    /** #20 音形码表导入 blocking core（worker 线程）。与基底换装同构但
     *  独立事务：只编 flypy（基底自定义时 37 项同场在列防 obsolete 清理，
     *  full_check=false 让它们按 fingerprint 跳过）。
     *  码表形态：rime .dict.yaml 或 词<TAB>码 纯文本，归一见
     *  [BaseDictFiles.normalizeFlypyLines]。 */
    private fun installFlypyBlocking(
        context: Context,
        uri: Uri,
        displayName: String,
        pushEvent: (JSONObject) -> Unit,
    ): InstallResult {
        sweepPending(context)
        EngineDataStore.ensureSync(context)
        runCatching { RimeTextEngine.ensureGlobalInit(context) }
            .onFailure { return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = false) }

        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, true)
            .putString(KEY_INSTALLING_KIND, KIND_FLYPY)
            .putInt(KEY_INSTALLING_PID, android.os.Process.myPid())
            .apply()

        pushEvent(status("COPYING"))
        val source = stageFlypySource(context, uri)
            ?: return clearTxn(context, "BASE_DICT_READ_FAILED")
        val sha = source.sha
        val entries = source.entries
        android.util.Log.i("FeelimeBaseDict",
            "flypy table: ${entries.size} entries, ${source.dropped} dropped")
        if (entries.isEmpty()) return clearTxn(context, "BASE_DICT_EMPTY")

        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        val baseCustom = prefs.getString(KEY_MODE, "builtin") == "custom"
        val assets = context.assets
        val defaultYaml = runCatching {
            BaseDictFiles.defaultYaml(
                assets.open(BaseDictFiles.ASSETS_DEFAULT).bufferedReader().readText(),
                BaseDictFiles.flypyCompileSchemas(
                    baseCustom,
                    baseCustom && BaseDictFiles.t9Eligible(
                        prefs.getInt(KEY_TAB_LINES, 0), availMemory(context)),
                ),
            )
        }.getOrNull() ?: run {
            rollbackFlypy(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }
        val symbolsYaml = runCatching {
            assets.open(BaseDictFiles.ASSETS_SYMBOLS).bufferedReader().readText()
        }.getOrNull() ?: run {
            rollbackFlypy(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }
        runCatching {
            val staging = File(user, "build").apply { mkdirs() }
            File(user, BaseDictFiles.FLYPY_DICT).writeText(
                BaseDictFiles.flypyDictYaml(entries, sha.take(12)),
            )
            File(user, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
            File(staging, BaseDictFiles.DEFAULT_FILE).writeText(defaultYaml)
            File(user, BaseDictFiles.SYMBOLS_FILE).writeText(symbolsYaml)
        }.onFailure {
            rollbackFlypy(context); return InstallResult("BASE_DICT_INTERNAL", changed = true)
        }

        // maintenance(false)：AVD 实测（2026-09-28）custom 基底下 37 项不
        // 重编、仅 flypy 编译（全套几十秒）。机制按 1.17.0 源码是部署任务
        // 的 mtime 修改检测（deployment_tasks.cc 的 last_build_time）而非
        // 逐 schema fingerprint（codex review P3 核正）——已知边界：系统
        // 时钟回拨/同秒重导入时 mtime 判定可能失真走「无需部署」，产物
        // 校验随后判负回滚（重导入场景会丢旧码表，接受：概率极低且码表
        // 可再导）。
        runCatching { RimeTextEngine.reloadGlobal(context) }
            .onFailure {
                rollbackFlypy(context)
                return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = true)
            }
        if (!NativeSmoke.rimeStartMaintenance(false)) {
            rollbackFlypy(context)
            return InstallResult("BASE_DICT_MAINTENANCE_START_FAILED", changed = true)
        }
        pushEvent(status("COMPILING"))
        val timeout = pollMaintenance(pushEvent, FLYPY_TIMEOUT_MS)
        NativeSmoke.rimeJoinMaintenance()
        val build = File(user, "build")
        val missing = listOf(BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin")
            .filterNot { File(build, it).isFile }
        if (missing.isNotEmpty()) {
            android.util.Log.w("FeelimeBaseDict", "flypy missing products: $missing")
            rollbackFlypy(context)
            return InstallResult(
                if (timeout) "BASE_DICT_TIMEOUT" else "BASE_DICT_INCOMPLETE",
                changed = true,
            )
        }

        // 清理编译现场 + 留档 + 提交（compiled flypy schema 留在 staging，
        // 运行时 schema 组件要读）。
        File(user, BaseDictFiles.DEFAULT_FILE).delete()
        File(build, BaseDictFiles.DEFAULT_FILE).delete()
        File(user, BaseDictFiles.SYMBOLS_FILE).delete()
        val archive = File(context.filesDir, "rime-flypy-source").apply { mkdirs() }
        archive.listFiles()?.forEach { it.delete() }
        File(user, BaseDictFiles.FLYPY_DICT).copyTo(File(archive, BaseDictFiles.FLYPY_DICT), overwrite = true)
        File(user, BaseDictFiles.FLYPY_DICT).delete()
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, false)
            .putString(KEY_FLYPY_MODE, "custom")
            .putString(KEY_FLYPY_NAME, displayName)
            .putString(KEY_FLYPY_SHA, sha)
            .putLong(KEY_FLYPY_AT, System.currentTimeMillis())
            .apply()
        return InstallResult(null, changed = true)
    }

    /** SAF 读全量（带容量上限）；超限/失败返回 null。字节流攒齐后一次
     *  解码——分块 String 解码会在多字节字符边界撕裂出 U+FFFD。 */
    private fun readAllCapped(context: Context, uri: Uri, maxBytes: Long): ByteArray? {
        val input = runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            ?: return null
        return runCatching {
            input.use { stream ->
                val buffer = ByteArray(1 shl 16)
                val out = java.io.ByteArrayOutputStream()
                while (true) {
                    val read = stream.read(buffer)
                    if (read < 0) break
                    if (out.size() + read > maxBytes) return@use null
                    out.write(buffer, 0, read)
                }
                if (out.size() == 0) null else out.toByteArray()
            }
        }.getOrNull()
    }

    /** #20 读源：单文件（rime .dict.yaml 或 词<TAB>码 纯文本）或 zip
     *  整包（rime-flypy 形态：伞 + flypy/ 分表）——分表词条归并进单一
     *  码表，纯伞表跳过，坏码行由 [BaseDictFiles.normalizeFlypyLines]
     *  剔除（分号快符表随之滤掉——音形 alphabet 只有 a-z）。sha 对源
     *  字节计算（zip 即 zip 本身）。null = 读取失败/超限。 */
    private class FlypySource(val sha: String, val entries: List<String>, val dropped: Int)

    private fun stageFlypySource(context: Context, uri: Uri): FlypySource? {
        val bytes = readAllCapped(context, uri, FLYPY_MAX_SOURCE_BYTES) ?: return null
        val sha = joinHex(MessageDigest.getInstance("SHA-256").digest(bytes))
        if (bytes.size < 4 ||
            bytes[0] != 'P'.code.toByte() || bytes[1] != 'K'.code.toByte() ||
            (bytes[2] != 0x03.toByte() && bytes[2] != 0x05.toByte() && bytes[2] != 0x07.toByte())
        ) {
            val (entries, dropped) = BaseDictFiles.normalizeFlypyLines(String(bytes, Charsets.UTF_8))
            return FlypySource(sha, entries, dropped)
        }
        // codex P1-1：解压总量必须与压缩字节同预算——64KB zip 可裹 33MB
        // 词条，readBytes() 一口气进内存就是 OOM。逐条目块读计费，超限
        // 整体拒绝；跳过的条目也计费（nextEntry 的自动 drain 不免费）。
        val buffer = ByteArray(1 shl 16)
        return runCatching {
            val entries = ArrayList<String>()
            var dropped = 0
            var total = 0L
            java.util.zip.ZipInputStream(java.io.ByteArrayInputStream(bytes)).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    var keep = false
                    if (!entry.isDirectory && "__MACOSX" !in entry.name) {
                        val base = BaseDictFiles.zipEntryName(entry.name)
                        if (base != null && base.endsWith(".dict.yaml")) keep = true
                    }
                    val out = java.io.ByteArrayOutputStream()
                    while (true) {
                        val read = zip.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > FLYPY_MAX_SOURCE_BYTES) return@runCatching null
                        if (keep) out.write(buffer, 0, read)
                    }
                    if (!keep) continue
                    val content = out.toString("UTF-8")
                    if (BaseDictFiles.isPureUmbrella(content)) continue
                    val (part, d) = BaseDictFiles.normalizeFlypyLines(content)
                    entries.addAll(part)
                    dropped += d
                }
            }
            FlypySource(sha, entries, dropped)
        }.getOrNull()
    }

    /** 事务中止但无现场可回滚（staging 尚未落盘）：只清标记。 */
    private fun clearTxn(context: Context, code: String): InstallResult {
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, false).apply()
        return InstallResult(code, changed = false)
    }

    private fun rollbackFlypy(context: Context) {
        runCatching { revertFlypy(context) }
            .onFailure { android.util.Log.w("FeelimeBaseDict", "flypy rollback: ${it.message}") }
    }

    /** 轮询 maintenance 状态直到收尾；超时不中断轮询（P2-10：超时后仍等
     *  部署线程自然结束，期间进度事件继续），返回是否已超时。 */
    private fun pollMaintenance(
        pushEvent: (JSONObject) -> Unit,
        timeoutMs: Long = MAINTENANCE_TIMEOUT_MS,
    ): Boolean {
        val started = SystemClock.elapsedRealtime()
        var lastPush = 0L
        var timedOut = false
        while (NativeSmoke.rimeIsMaintenanceMode()) {
            val now = SystemClock.elapsedRealtime()
            val elapsed = now - started
            if (!timedOut && elapsed > timeoutMs) {
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

    /** #37：抽样码列统计「能完全切成拼音音节序列」的占比（0..1）。
     *  与 CustomPhraseStore 的切分口径一致（音节集 = 拼式表的键）；
     *  参数化纯函数便于单测。非小写字母码（符号形码）必然切不开，
     *  直接计入不可切。全文件按步长均匀采样（codex R1 P2：只取前缀
     *  时，「头部全拼+尾部形码」的表会整体漏检）；注释/分隔行跳过。
     *  注意这只是启发式提示信号：换装会按导入码表重编 prism（本机
     *  librime 实测 naxy/kkfj 可命中），不构成「无法输入」的判定。 */
    internal fun pinyinCodeRatio(
        file: File,
        syllables: Set<String>,
        sampleLimit: Int,
        totalLines: Int = 0,
    ): Double {
        // 步长让样本均匀铺满全表；词表小于样本上限时逐行全采。
        val step = if (totalLines > sampleLimit) (totalLines + sampleLimit - 1) / sampleLimit else 1
        var seen = 0
        var sampled = 0
        var segmentable = 0
        file.bufferedReader(Charsets.UTF_8).useLines { seq ->
            for (line in seq) {
                if (sampled >= sampleLimit) break
                val trimmed = line.trimStart()
                if (trimmed.startsWith("#") || trimmed == "..." ||
                    trimmed == "---" || !line.contains('\t')
                ) continue
                // dict.yaml 词条行：词\t码\t[权重]——码在第 2 列。
                val code = line.split('\t').getOrNull(1)?.trim() ?: continue
                seen++
                if ((seen - 1) % step != 0) continue
                if (code.isEmpty()) continue
                sampled++
                // 词组码列带空格分段（"ni hao"），逐段独立判可切。
                if (code.split(' ').all { seg ->
                        seg.isNotEmpty() && seg.all { it in 'a'..'z' } &&
                            fullySegmentable(seg, syllables)
                    }
                ) segmentable++
            }
        }
        return if (sampled == 0) 1.0 else segmentable.toDouble() / sampled
    }

    /** 码串能否完整切成音节序列（可达性 DP，等价回溯切分器「存在切分」）。 */
    private fun fullySegmentable(code: String, syllables: Set<String>): Boolean {
        val ok = BooleanArray(code.length + 1)
        ok[0] = true
        for (i in code.indices) {
            if (!ok[i]) continue
            for (len in 1..minOf(6, code.length - i)) {
                if (ok[i + len]) continue
                if (code.substring(i, i + len) in syllables) ok[i + len] = true
            }
        }
        return ok[code.length]
    }

    /** 合法拼音音节集合：APK 拼式表（音节→各方案键序）的键空间。
     *  加载失败返回空集（调用方跳过检测，不误报）。 */
    private fun availMemory(context: Context): Long = runCatching {
        val mi = android.app.ActivityManager.MemoryInfo()
        (context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager)
            .getMemoryInfo(mi)
        mi.availMem
    }.getOrDefault(0L)

    private fun syllableSet(context: Context): Set<String> {
        val out = HashSet<String>()
        runCatching {
            context.assets.open("custom-phrase-codes.json").bufferedReader().use { r ->
                val codes = JSONObject(r.readText())
                val keys = codes.keys()
                while (keys.hasNext()) out.add(keys.next())
            }
        }
        return out
    }

    /** SAF 流解包到 [sourceDir]（#35 起支持 zip 多表包）：
     *  - 普通 `.dict.yaml` 单文件直写 [BaseDictFiles.SOURCE_FILE]；
     *  - zip（PK 头）解包全部 `*.dict.yaml` 拍平落盘——纯伞表剔除
     *    （引用由我们的 umbrella 接管）、子表自带 import_tables 引用
     *    重写为 `rime-dict-source/<名>`。
     *  返回 (sha256, 落盘文件表)；sha 对最终落盘集合（名+内容，按名排序）
     *  计算，zip 后处理改写会体现在指纹里。null = 读取失败/超 150MB。
     *  空 zip（无可解析表）返回非 null 空文件表，由调用方按 EMPTY 报。 */
    private class Staged(val sha: String, val files: List<File>)

    private class StageOutcome(val staged: Staged?, val errorCode: String? = null)

    private fun stageSource(context: Context, uri: Uri, sourceDir: File): StageOutcome {
        val input = runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            ?: return StageOutcome(null)
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(1 shl 16)
        input.use { stream ->
            // 读头 4 字节判 zip（PK\x03\x04 本地头 / PK\x05\x06 空档 /
            // PK\x07\x08 分卷）；不足 4 字节按坏文件处理。
            val head = ByteArray(4)
            var got = 0
            while (got < 4) {
                val read = stream.read(head, got, 4 - got)
                if (read < 0) break
                got += read
            }
            if (got < 4) return StageOutcome(null)
            val isZip = head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte() &&
                (head[2] == 0x03.toByte() || head[2] == 0x05.toByte() || head[2] == 0x07.toByte())

            if (!isZip) {
                var total = 0L
                var overLimit = false
                val target = File(sourceDir, BaseDictFiles.SOURCE_FILE)
                target.outputStream().use { out ->
                    out.write(head, 0, got)
                    digest.update(head, 0, got)
                    total += got
                    while (true) {
                        val read = stream.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_SOURCE_BYTES) {
                            overLimit = true
                            break
                        }
                        digest.update(buffer, 0, read)
                        out.write(buffer, 0, read)
                    }
                }
                if (overLimit || total == 0L) return StageOutcome(null)
                return StageOutcome(Staged(joinHex(digest.digest()), listOf(target)))
            }

            // zip 路径：拍平落盘（落盘名 = entry basename，安全名校验在
            // [BaseDictFiles.zipEntryName]）。解压总量共享 150MB 上限
            // （zip 炸弹防线）——跳过的条目也按块 drain 计费（codex P2-3：
            // 直接 continue 时 nextEntry 的自动 drain 不计费，高压缩率
            // 垃圾文件可绕开预算长期占用 worker）。撞名不静默丢弃
            // （codex P2-4：a/x.dict.yaml 与 b/x.dict.yaml 只留首个会造成
            // 「成功却缺词」）——整包拒绝并报错。
            val entries = LinkedHashMap<String, String>() // 落盘名 -> 原始引用（entry 路径去 .dict.yaml）
            var total = 0L
            var overLimit = false
            var duplicate: Pair<String, String>? = null
            val zipped = runCatching {
                ZipInputStream(PushbackInputStream(stream, 4).apply { unread(head, 0, got) })
                    .use { zip ->
                        while (!overLimit && duplicate == null) {
                            val entry = zip.nextEntry ?: break
                            var keep = false
                            var conflict: Pair<String, String>? = null
                            var base: String? = null
                            if (!entry.isDirectory && "__MACOSX" !in entry.name) {
                                val safe = BaseDictFiles.zipEntryName(entry.name)
                                if (safe != null && safe.endsWith(".dict.yaml")) {
                                    if (safe in entries) {
                                        conflict = entries[safe]!! to entry.name
                                    } else {
                                        keep = true
                                        base = safe
                                    }
                                }
                            }
                            val target = base?.let { File(sourceDir, it) }
                            target?.outputStream().use { out ->
                                while (true) {
                                    val read = zip.read(buffer)
                                    if (read < 0) break
                                    total += read
                                    if (total > MAX_SOURCE_BYTES) {
                                        overLimit = true
                                        break
                                    }
                                    out?.write(buffer, 0, read)
                                }
                            }
                            val name = base
                            when {
                                conflict != null -> duplicate = conflict
                                keep && name != null && !overLimit ->
                                    entries[name] = entry.name.removeSuffix(".dict.yaml")
                            }
                        }
                    }
            }
            if (zipped.isFailure || overLimit) return StageOutcome(null)
            if (duplicate != null) {
                android.util.Log.w("FeelimeBaseDict",
                    "duplicate table names: ${duplicate!!.first} vs ${duplicate!!.second}")
                return StageOutcome(null, "BASE_DICT_DUPLICATE")
            }

            // 纯伞表剔除 + 子表引用重写；sha 覆盖最终形态。
            val refMap = HashMap<String, String>()
            entries.forEach { (flat, orig) ->
                refMap[orig] = "${BaseDictFiles.SOURCE_DIR}/${flat.removeSuffix(".dict.yaml")}"
            }
            val kept = ArrayList<File>(entries.size)
            for (flat in entries.keys.sorted()) {
                val f = File(sourceDir, flat)
                if (isPureUmbrellaFile(f)) {
                    f.delete()
                    continue
                }
                rewriteTableRefs(f, refMap)
                kept.add(f)
                digest.update(flat.toByteArray(Charsets.UTF_8))
                f.inputStream().use { ins ->
                    while (true) {
                        val read = ins.read(buffer)
                        if (read < 0) break
                        digest.update(buffer, 0, read)
                    }
                }
            }
            return StageOutcome(Staged(joinHex(digest.digest()), kept))
        }
    }

    /** 纯伞表判定（#35）：头区（首个 `...` 前）带顶格 import_tables 且
     *  全文零词条行——拍平后其相对引用（dicts/…）全部失效，跳过。头区
     *  读取封顶 64KB（异常膨胀按无伞处理，全文扫词条兜底）。 */
    private fun isPureUmbrellaFile(f: File): Boolean {
        val header = StringBuilder()
        runCatching {
            f.bufferedReader(Charsets.UTF_8).useLines { seq ->
                for (line in seq) {
                    if (line.trimEnd() == "...") break
                    header.appendLine(line)
                    if (header.length > (1 shl 16)) break
                }
            }
        }.getOrNull() ?: return false
        if (!BaseDictFiles.hasImportTables(header.toString())) return false
        return runCatching {
            f.bufferedReader(Charsets.UTF_8).useLines { seq ->
                seq.none { !it.startsWith("#") && it.contains('\t') }
            }
        }.getOrDefault(false)
    }

    /** 子表 import_tables 引用重写（流式经临时文件，未命中引用原样）。 */
    private fun rewriteTableRefs(f: File, refMap: Map<String, String>) {
        val rewriter = BaseDictFiles.ImportRefRewriter(refMap)
        val tmp = File(f.parentFile, f.name + ".rewrite.tmp")
        var changed = false
        runCatching {
            f.bufferedReader(Charsets.UTF_8).useLines { seq ->
                tmp.outputStream().bufferedWriter(Charsets.UTF_8).use { w ->
                    for (line in seq) {
                        val out = rewriter.apply(line)
                        if (out != line) changed = true
                        w.write(out)
                        w.write("\n")
                    }
                }
            }
        }.getOrNull() ?: run { tmp.delete(); return }
        if (changed) {
            f.delete()
            tmp.renameTo(f)
        } else {
            tmp.delete()
        }
    }

    /** 落盘源统计：TAB 词条行数（总 + 分表，供 #37 采样加权）与带调码
     *  占比（#35 提示位）。码列取第 2 列。 */
    private class SourceStats(val tabLines: Int, val toneRatio: Double, val perFile: List<Pair<File, Int>>)

    private fun analyzeSource(files: List<File>): SourceStats {
        val perFile = ArrayList<Pair<File, Int>>(files.size)
        var tabLines = 0
        var toned = 0
        for (f in files) {
            var lines = 0
            var tone = 0
            runCatching {
                f.bufferedReader(Charsets.UTF_8).useLines { seq ->
                    for (line in seq) {
                        if (line.startsWith("#") || !line.contains('\t')) continue
                        lines++
                        val code = line.split('\t').getOrNull(1) ?: continue
                        if (BaseDictFiles.codeHasTone(code)) tone++
                    }
                }
            }
            perFile.add(f to lines)
            tabLines += lines
            toned += tone
        }
        val ratio = if (tabLines == 0) 0.0 else toned.toDouble() / tabLines
        return SourceStats(tabLines, ratio, perFile)
    }

    /** #37 多表加权：每表按行数分摊采样额度（总量 [NON_PINYIN_SAMPLE]），
     *  结果按行数加权平均。 */
    private fun pinyinRatioOverFiles(stats: SourceStats, syllables: Set<String>): Float {
        if (stats.tabLines == 0) return 1f
        var weighted = 0.0
        for ((f, lines) in stats.perFile) {
            if (lines <= 0) continue
            val limit = maxOf(1, NON_PINYIN_SAMPLE * lines / stats.tabLines)
            weighted += pinyinCodeRatio(f, syllables, limit, lines) * lines
        }
        return (weighted / stats.tabLines).toFloat()
    }

    private fun joinHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02x".format(it) }

    private fun engineTemplate(context: Context): String? {
        val shared = EngineDataStore.readyFile(
            context, "rime/${FuzzyPinyin.SCHEMA_ID}.schema.yaml",
        ) ?: return null
        return runCatching { shared.readText() }.getOrNull()
    }

    private fun cleanupCompileSources(user: File, keepSource: Boolean) {
        File(user, BaseDictFiles.DEFAULT_FILE).delete()
        File(user, BaseDictFiles.SYMBOLS_FILE).delete()
        File(user, BaseDictFiles.UMBRELLA_FILE).delete()
        // 双拼/T9 schema 的 dictionary 改写副本与子伞源（编译期影子，
        // 运行时读 staging 的 compiled schema）。
        File(user, BaseDictFiles.DP_UMBRELLA_FILE).delete()
        BaseDictFiles.KEYMAPPED_SCHEMAS.forEach {
            File(user, "$it.schema.yaml").delete()
        }
        (BaseDictFiles.MASK_MIN..BaseDictFiles.MASK_MAX).forEach { mask ->
            File(user, "${FuzzyPinyin.SCHEMA_ID}_m$mask.schema.yaml").delete()
        }
        // staging 的编译期 default.yaml 一并删（运行时不需要 schema_list）；
        // staging 的变体 schema yaml 不删——那是 DictCompiler 输出的
        // compiled schema，与 prism 产物配套、运行时 schema 组件要读。
        File(File(user, "build"), BaseDictFiles.DEFAULT_FILE).delete()
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR)
        if (keepSource) {
            // 留档目录（在 rime-user 之外，天然不进 userdata 备份）。
            val archive = File(user.parentFile, "rime-user-dict").apply { mkdirs() }
            archive.listFiles()?.forEach { it.delete() }
            sourceDir.listFiles()?.forEach { it.copyTo(File(archive, it.name), overwrite = true) }
        }
        sourceDir.deleteRecursively()
    }

    /** 失败/恢复/清扫共用的基底回滚：回内置 frost（含事务标记清理）。
     *  #20：音形码表已导入时保留 flypy 产物与状态（精确删基底产物、
     *  prefs 只清基底键），否则照旧整目录回滚。 */
    private fun revert(context: Context) {
        val user = File(context.filesDir, "rime-user")
        val keepFlypy = isFlypyInstalled(context)
        if (user.isDirectory) {
            val build = File(user, "build")
            if (build.isDirectory) {
                if (keepFlypy) {
                    build.listFiles()?.forEach { f ->
                        if (f.name !in FLYPY_PRODUCTS) f.deleteRecursively()
                    }
                } else if (!build.deleteRecursively()) {
                    android.util.Log.w("FeelimeBaseDict", "build dir not fully deleted")
                }
            }
            cleanupCompileSources(user, keepSource = false)
        }
        File(context.filesDir, "rime-user-dict").deleteRecursively()
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
        if (keepFlypy) {
            prefs.remove(KEY_MODE).remove(KEY_NAME).remove(KEY_INSTALLED_AT)
                .remove(KEY_SOURCE_SHA).remove(KEY_NON_PINYIN_RATIO).remove(KEY_TONED)
                .remove(KEY_TAB_LINES).remove(KEY_T9_SKIPPED)
                .remove(KEY_FUZZY_COMPILING_MASK).remove(KEY_FUZZY_PENDING_MASK)
        } else {
            prefs.clear()
        }
        prefs.remove(KEY_INSTALLING).remove(KEY_INSTALLING_KIND).apply()
    }

    /** #20 音形码表回滚：删 flypy 产物/现场/留档 + 状态键（基底词库
     *  不动）。 */
    private fun revertFlypy(context: Context) {
        val user = File(context.filesDir, "rime-user")
        if (user.isDirectory) {
            val build = File(user, "build")
            FLYPY_PRODUCTS.forEach { File(build, it).delete() }
            // 编译现场残留（导入中断时 sweep 到这里）。
            File(user, BaseDictFiles.FLYPY_DICT).delete()
            File(user, BaseDictFiles.DEFAULT_FILE).delete()
            File(user, BaseDictFiles.SYMBOLS_FILE).delete()
            File(build, BaseDictFiles.DEFAULT_FILE).delete()
        }
        File(context.filesDir, "rime-flypy-source").deleteRecursively()
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .remove(KEY_FLYPY_MODE).remove(KEY_FLYPY_NAME).remove(KEY_FLYPY_SHA)
            .remove(KEY_FLYPY_AT)
            .remove(KEY_INSTALLING).remove(KEY_INSTALLING_KIND)
            .apply()
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
            "BASE_DICT_MEMORY_LOW" to "本机可用内存不足以编译此词库（大词库编译需要约几 GB 空闲内存），请关闭其他应用后重试或换用更小的词库",
            "BASE_DICT_DUPLICATE" to "包内有同名词表（不同目录下的同名 .dict.yaml），无法确定用哪个，请整理后重试",
            "BASE_DICT_ENGINE_NOT_READY" to "引擎数据还没准备好，稍后再试",
            "BASE_DICT_MAINTENANCE_START_FAILED" to "编译线程启动失败",
            "BASE_DICT_TIMEOUT" to "编译超时（45 分钟）且产物不完整，已回滚",
            "BASE_DICT_INCOMPLETE" to "编译产物不完整，已回滚",
            "BASE_DICT_INTERNAL" to "导入过程出错，已回滚",
            "BASE_DICT_REVERT_FAILED" to "恢复内置失败，请重试或重启应用",
            "FLYPY_OK" to "音形码表导入完成",
            "FLYPY_REVERTED" to "已移除音形码表",
        )
        val en = mapOf(
            "OK" to "Base dictionary swapped",
            "REVERTED" to "Built-in dictionary restored",
            "BASE_DICT_READ_FAILED" to "Read failed or file exceeds the 150MB cap",
            "BASE_DICT_EMPTY" to "No entries found (needs word<TAB>code lines)",
            "BASE_DICT_DUPLICATE" to "Duplicate table names in the package (same .dict.yaml basename in different folders); reorganize and retry",
            "BASE_DICT_ENGINE_NOT_READY" to "Engine data not ready yet, try later",
            "BASE_DICT_MAINTENANCE_START_FAILED" to "Failed to start the compile thread",
            "BASE_DICT_TIMEOUT" to "Compile timed out (45 min) with incomplete output, rolled back",
            "BASE_DICT_INCOMPLETE" to "Incomplete build output, rolled back",
            "BASE_DICT_INTERNAL" to "Import failed, rolled back",
            "BASE_DICT_REVERT_FAILED" to "Restore failed, retry or restart the app",
            "FLYPY_OK" to "Shape-code table imported",
            "FLYPY_REVERTED" to "Shape-code table removed",
        )
        return com.feelime.ime.t(context, zh[key] ?: key, en[key] ?: key)
    }
}
