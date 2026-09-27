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
    private const val TONE_RATIO_THRESHOLD = 0.02

    // ---- #20 音形码表导入（小鹤音形）：独立于基底词库的第二换装通道 ----
    // 事务标记共用 KEY_INSTALLING（编译期间进程中断由 sweepPending 回滚），
    // kind 区分回滚目标（基底全量 vs 仅音形产物）。
    private const val KEY_INSTALLING_KIND = "installing_kind"
    private const val KIND_BASE = "base"
    private const val KIND_FLYPY = "flypy"
    private const val KEY_FLYPY_MODE = "flypy_mode"    // custom | -
    private const val KEY_FLYPY_NAME = "flypy_name"
    private const val KEY_FLYPY_SHA = "flypy_sha"
    private const val KEY_FLYPY_AT = "flypy_installed_at"
    /** 音形码表量级 ~1MB（码+词 6 万条），20MB 上限足够宽。 */
    private const val FLYPY_MAX_SOURCE_BYTES = 20L * 1024 * 1024
    private const val FLYPY_TIMEOUT_MS = 10 * 60 * 1000L

    /** #20 编译产物（staging）。compiled schema yaml 是 DictCompiler 输出，
     *  运行时 schema 组件要读，回滚时与 bin 一起删。 */
    private val FLYPY_PRODUCTS = listOf(
        BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin",
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
            var result = runCatching { installFlypyBlocking(app, uri, displayName, pushEvent) }
                .getOrElse {
                    runCatching { revertFlypy(app) }
                    InstallResult("BASE_DICT_INTERNAL", changed = true)
                }
            building.set(false)
            stageSnapshot = null
            if (result.changed) {
                app.sendBroadcast(Intent(ACTION_BASE_DICT_CHANGED).setPackage(app.packageName))
            }
            pushEvent(
                JSONObject()
                    .put("type", if (result.code == null) "flypyDone" else "flypyError")
                    .put("code", result.code ?: "OK")
                    .put("message", messageFor(app, result.code)),
            )
            onFinished()
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
        runCatching { RimeTextEngine.ensureGlobalInit(context) }
            .onFailure { return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = false) }

        // 事务开始（P1-5）：从此刻起任何中断都会被 sweepPending 回滚。
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, true)
            .putString(KEY_INSTALLING_KIND, KIND_BASE)
            .apply()

        pushEvent(status("COPYING"))
        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val sourceDir = File(user, BaseDictFiles.SOURCE_DIR).apply {
            deleteRecursively(); mkdirs()
        }
        // #35：单文件或 zip 多表（万象 Lite 包）统一解包到 sourceDir。
        // 失败/超限时半截文件不残留（P2-9）：整目录清掉再报错。
        val staged = stageSource(context, uri, sourceDir)
        if (staged == null) {
            sourceDir.deleteRecursively()
            clearInstalling(context)
            return InstallResult("BASE_DICT_READ_FAILED", changed = false)
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
        // #20 联动：音形码表已导入时 flypy 同场在列，否则被 obsolete
        // 清理洗掉（编译清单见 BaseDictFiles.baseCompileSchemas）。
        val flypyInstalled = isFlypyInstalled(context)
        val assets = context.assets
        val defaultYaml = runCatching {
            BaseDictFiles.defaultYaml(
                assets.open(BaseDictFiles.ASSETS_DEFAULT).bufferedReader().readText(),
                BaseDictFiles.baseCompileSchemas(flypyInstalled),
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
        // 回滚会撕裂）。超时只改变结果判定，不做有风险的强杀。
        NativeSmoke.rimeJoinMaintenance()
        if (timeout) {
            rollback(context)
            return InstallResult("BASE_DICT_TIMEOUT", changed = true)
        }

        // 产物校验。#20 联动：flypy 在编译清单里时其产物一并校验。
        val build = File(user, "build")
        val expected = REQUIRED_PRODUCTS + if (flypyInstalled) {
            listOf(BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin")
        } else emptyList()
        val missing = expected.filterNot { File(build, it).isFile }
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
            .putFloat(KEY_NON_PINYIN_RATIO, nonPinyinRatio ?: -1f)
            .putBoolean(KEY_TONED, toned)
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
        runCatching { RimeTextEngine.ensureGlobalInit(context) }
            .onFailure { return InstallResult("BASE_DICT_ENGINE_NOT_READY", changed = false) }

        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_INSTALLING, true)
            .putString(KEY_INSTALLING_KIND, KIND_FLYPY)
            .apply()

        pushEvent(status("COPYING"))
        val content = readAllCapped(context, uri, FLYPY_MAX_SOURCE_BYTES)
            ?: return clearTxn(context, "BASE_DICT_READ_FAILED")
        val sha = joinHex(MessageDigest.getInstance("SHA-256").digest(content.toByteArray(Charsets.UTF_8)))
        val (entries, dropped) = BaseDictFiles.normalizeFlypyLines(content)
        android.util.Log.i("FeelimeBaseDict",
            "flypy table: ${entries.size} entries, $dropped dropped")
        if (entries.isEmpty()) return clearTxn(context, "BASE_DICT_EMPTY")

        val user = File(context.filesDir, "rime-user").apply { mkdirs() }
        val baseCustom = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
            .getString(KEY_MODE, "builtin") == "custom"
        val assets = context.assets
        val defaultYaml = runCatching {
            BaseDictFiles.defaultYaml(
                assets.open(BaseDictFiles.ASSETS_DEFAULT).bufferedReader().readText(),
                BaseDictFiles.flypyCompileSchemas(baseCustom),
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

        // maintenance(false)：staging 里既有 compiled schema 的 fingerprint
        // 未变则跳过（基底 37 项不重编），只有 flypy 真正编译。
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
        if (timeout) {
            rollbackFlypy(context)
            return InstallResult("BASE_DICT_TIMEOUT", changed = true)
        }

        val build = File(user, "build")
        val missing = listOf(BaseDictFiles.FLYPY_TABLE, "flypy.prism.bin")
            .filterNot { File(build, it).isFile }
        if (missing.isNotEmpty()) {
            android.util.Log.w("FeelimeBaseDict", "flypy missing products: $missing")
            rollbackFlypy(context)
            return InstallResult("BASE_DICT_INCOMPLETE", changed = true)
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
    private fun readAllCapped(context: Context, uri: Uri, maxBytes: Long): String? {
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
                if (out.size() == 0) null else out.toString("UTF-8")
            }
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

    private fun stageSource(context: Context, uri: Uri, sourceDir: File): Staged? {
        val input = runCatching { context.contentResolver.openInputStream(uri) }.getOrNull()
            ?: return null
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
            if (got < 4) return null
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
                if (overLimit || total == 0L) return null
                return Staged(joinHex(digest.digest()), listOf(target))
            }

            // zip 路径：拍平落盘（落盘名 = entry basename，安全名校验在
            // [BaseDictFiles.zipEntryName]；撞名保留首个）。解压总量共享
            // 150MB 上限（zip 炸弹防线）。
            val entries = LinkedHashMap<String, String>() // 落盘名 -> 原始引用（entry 路径去 .dict.yaml）
            var total = 0L
            var overLimit = false
            val zipped = runCatching {
                ZipInputStream(PushbackInputStream(stream, 4).apply { unread(head, 0, got) })
                    .use { zip ->
                        while (!overLimit) {
                            val entry = zip.nextEntry ?: break
                            if (entry.isDirectory) continue
                            val name = entry.name
                            if ("__MACOSX" in name) continue
                            val base = BaseDictFiles.zipEntryName(name) ?: continue
                            if (!base.endsWith(".dict.yaml") || base in entries) continue
                            val target = File(sourceDir, base)
                            target.outputStream().use { out ->
                                while (true) {
                                    val read = zip.read(buffer)
                                    if (read < 0) break
                                    total += read
                                    if (total > MAX_SOURCE_BYTES) {
                                        overLimit = true
                                        break
                                    }
                                    out.write(buffer, 0, read)
                                }
                            }
                            if (!overLimit) entries[base] = name.removeSuffix(".dict.yaml")
                        }
                    }
            }
            if (zipped.isFailure || overLimit) return null

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
            return Staged(joinHex(digest.digest()), kept)
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
            "BASE_DICT_ENGINE_NOT_READY" to "引擎数据还没准备好，稍后再试",
            "BASE_DICT_MAINTENANCE_START_FAILED" to "编译线程启动失败",
            "BASE_DICT_TIMEOUT" to "编译超时（15 分钟），已回滚",
            "BASE_DICT_INCOMPLETE" to "编译产物不完整，已回滚",
            "BASE_DICT_INTERNAL" to "导入过程出错，已回滚",
            "BASE_DICT_REVERT_FAILED" to "恢复内置失败，请重试或重启应用",
            "FLYPY_REVERTED" to "已移除音形码表",
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
            "FLYPY_REVERTED" to "Shape-code table removed",
        )
        return com.feelime.ime.t(context, zh[key] ?: key, en[key] ?: key)
    }
}
