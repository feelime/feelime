package com.feelime.ime

import android.content.ClipData
import android.content.ClipDescription
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.content.ClipboardManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import com.feelime.ime.backup.AndroidPrefs
import com.feelime.ime.backup.UserdataBackup
import com.feelime.ime.update.GithubReleaseSource
import com.feelime.ime.update.KeyboardPackageVerifier
import com.feelime.ime.update.KeyboardSource
import com.feelime.ime.update.KeyboardPackageReader
import com.feelime.ime.update.KeyboardStore
import com.feelime.ime.update.KeyboardUpdateCenter
import com.feelime.ime.update.KeyboardUpdateDownloader
import com.feelime.ime.update.KeyboardUpdateErrorCode
import com.feelime.ime.update.HttpUrlConnectionFactory
import com.feelime.ime.update.UpdateMetainfo
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URI
import java.util.concurrent.Executors

/** userdata 恢复广播：设置页发，IME 收（userdb 暂存已就位，
 * 换目录+重建引擎会话，docs/design/userdata.md §1.2）。 */
const val ACTION_USERDATA_RESTORED = "com.feelime.ime.USERDATA_RESTORED"

/** 双拼方案切换广播：设置页发，IME 收（当前是双拼会话时按新 schema
 * 重建会话，并重推 hello 让键盘换解析表/sep 键，double-pinyin.md §2）。 */
const val ACTION_DP_SCHEME_CHANGED = "com.feelime.ime.DP_SCHEME_CHANGED"
const val ACTION_FUZZY_PINYIN_CHANGED = "com.feelime.ime.FUZZY_PINYIN_CHANGED"

/** 自定义短语变更广播：设置页发（saveCustomPhrases 已落盘+派生 txt），
 *  IME 收到后整引擎重载（stabledb 生命周期绑定引擎而非会话）。 */
const val ACTION_CUSTOM_PHRASES_CHANGED = "com.feelime.ime.CUSTOM_PHRASES_CHANGED"

/** 设置页改动键盘侧偏好（底部留白/手感参数）后通知 IME 重推 hello。 */
const val ACTION_KEYBOARD_PREFS_CHANGED = "com.feelime.ime.KEYBOARD_PREFS_CHANGED"

/** 模型集合变化（下载完成/删除）：设置页发，IME 收到重推 hello。hello 的
 *  engineDataReady 只在键盘加载时算一次，手写模型下载落地后不重推的话，
 *  长按菜单里的手写一直灰，用户得去键盘选择里取消再勾选才恢复（验收
 *  2026-09-24 实录）。 */
const val ACTION_MODELS_CHANGED = "com.feelime.ime.MODELS_CHANGED"

/** 外观页预览：设置页让 IME 弹出/收起真实键盘（无编辑框场景，由 IME
 *  自己 requestShowSelf，不依赖输入焦点）。 */
const val ACTION_PREVIEW_KEYBOARD = "com.feelime.ime.PREVIEW_KEYBOARD"

// 键盘侧偏好的键与合法档位（mode-fallback §3/§4）：设置页写入、IME 读取，
// 双方共用同一份定义；非法持久值一律回落默认。
const val KEYBOARD_PREFS_FILE = "feelime_keyboard"
const val PREF_BOTTOM_PAD_DP = "bottom_pad_dp"

// 留白按方向独立（横竖屏系统条高度不同，横屏高度预算也紧张）；旧单键
// 保留作迁移默认源——新键缺省时回落旧值，用户改任一方向后开始分叉。
const val PREF_BOTTOM_PAD_DP_PORTRAIT = "bottom_pad_dp_portrait"
const val PREF_BOTTOM_PAD_DP_LANDSCAPE = "bottom_pad_dp_landscape"
val BOTTOM_PAD_STEPS = intArrayOf(0, 12, 24, 36, 48)
const val PREF_FEEL_SCRUB_SPEED = "feel_scrub_speed"
const val PREF_FEEL_HOLD_MS = "feel_hold_ms"
val FEEL_HOLD_STEPS = intArrayOf(200, 300, 350, 450, 600)
const val PREF_FEEL_POPUP_SNAP = "feel_popup_snap"
/** 上下滑方向互换（issue #29-2，默认关）：开=上滑大写/下滑小字符。 */
const val PREF_FLICK_SWAP = "flick_swap"
const val PREF_CANDIDATE_FONT = "candidate_font"

fun readFlickSwap(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_FLICK_SWAP, false)

/** 拼音字号档位：0=标准 1=大 2=特大（issue #8）。 */
const val PREF_PREEDIT_FONT = "preedit_font"

fun readPreeditFont(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_PREEDIT_FONT, 0)
        .takeIf { it in 0..2 } ?: 0


/** 拼音加粗开关（issue #8）：默认关。 */
const val PREF_PREEDIT_BOLD = "preedit_bold"

fun readPreeditBold(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_PREEDIT_BOLD, false)

/** 单手模式（issue #15）：0=关 1=左手（键区贴左，侧边条在右） 2=右手。 */
const val PREF_ONE_HAND = "one_hand"

fun readOneHand(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_ONE_HAND, 0)
        .takeIf { it in 0..2 }
        ?: 0

/** 单手压缩比例：让位宽度占屏宽的百分比；0=默认让位（64px）。
 *  2026-09-18 用户反馈：大屏单手模式 64px 让位后键区仍太宽。 */
const val PREF_ONE_HAND_PAD = "one_hand_pad"
val ONE_HAND_PAD_CHOICES = setOf(0, 15, 25, 35)

fun readOneHandPad(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_ONE_HAND_PAD, 0)
        .takeIf { it in ONE_HAND_PAD_CHOICES }
        ?: 0

/** 侧边条内容：0=光标控制 1=空白。历史上的 2（自定义侧边图）已废除
 *  ——图片功能升级为覆盖整个键盘的「背景图片」，读到旧值按空白处理。 */
const val PREF_SIDE_CONTENT = "side_content"

fun readSideContent(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_SIDE_CONTENT, 0)
        .let { if (it == 2) 1 else it.takeIf { v -> v in 0..1 } ?: 0 }

/** 工具栏编辑布局（issue #15）：JSON {"left":[...],"right":[...]}，键盘
 *  侧已按目录校验，这里只透传。 */
const val PREF_TOOLBAR_LAYOUT = "toolbar_layout"

fun readToolbarLayout(context: Context): String =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getString(PREF_TOOLBAR_LAYOUT, "") ?: ""

/** 键帽不透明度（0-100，默认 100）：背景图开启时键帽可半透。 */
const val PREF_KEY_OPACITY = "key_opacity"
/** 按键气泡（issue #30-1，默认关）：按下时放大预览所按字符。 */
const val PREF_KEY_BUBBLE = "key_bubble"
/** 气泡停留时长（验收 2026-09-24：松手立即消失看不清）。0/250/400/600ms。 */
const val PREF_BUBBLE_LINGER = "bubble_linger_ms"
val BUBBLE_LINGER_STEPS = intArrayOf(0, 250, 400, 600)

fun readBubbleLinger(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_BUBBLE_LINGER, 400)
        .takeIf { it in BUBBLE_LINGER_STEPS.asList() } ?: 400
const val KB_HEIGHT_PORTRAIT_KEY = "keyboard_height_portrait"

fun readKeyOpacity(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_KEY_OPACITY, 100)
        .let { if (it in 0..100) it else 100 }

fun readKeyBubble(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_KEY_BUBBLE, false)

/** 键盘高度（竖屏存值；pref 物理px，对外统一转 CSS px；0=默认）。 */
fun readKbHeightPortrait(context: Context): Int {
    val physical = context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(KB_HEIGHT_PORTRAIT_KEY, 0)
    if (physical <= 0) return 0
    val density = context.resources.displayMetrics.density
    return Math.round(physical / density)
}

/** 竖屏高度滑块边界（CSS px，与 FeelimeService.setKeyboardHeight 的
 *  clamp 同源：min 226（round-6 起竖屏内容下限，含手写 chrome+96；
 *  旧值 210 低于 native 钳制，滑杆 210~225 会被暗改到 226——滑杆
 *  读数与键盘实际高度对不上），max 竖屏可用高度 45%）。 */
fun readKbHeightBounds(context: Context): Pair<Int, Int> {
    val metrics = context.resources.displayMetrics
    val min = 226
    val max = ((metrics.heightPixels * 45 / 100) / metrics.density).toInt()
    return Pair(min, maxOf(min, max))
}

/** 设置页左上角 logo：用应用本身的 launcher 图标（adaptive icon 也能
 *  画出背景+前景），编码一次缓存——icon 不随状态变化。 */
private var cachedAppIconDataUri: String? = null

fun appIconDataUri(context: Context): String {
    cachedAppIconDataUri?.let { return it }
    return try {
        val drawable = context.packageManager.getApplicationIcon(context.packageName)
        val size = 96
        val bitmap = android.graphics.Bitmap.createBitmap(
            size, size, android.graphics.Bitmap.Config.ARGB_8888,
        )
        val canvas = android.graphics.Canvas(bitmap)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        val bytes = java.io.ByteArrayOutputStream().use { output ->
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 90, output)
            output.toByteArray()
        }
        bitmap.recycle()
        ("data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP))
            .also { cachedAppIconDataUri = it }
    } catch (error: Exception) {
        Log.w("FeelimeBridge", "appIcon encode failed: ${error.message}")
        ""
    }
}

/** 三态主题（外观页写、键盘 hello 读回应用；键盘侧改动经 pushStores
 *  回写此 pref，保持单一事实源）。 */
const val PREF_THEME_MODE = "theme_mode"

fun readThemeMode(context: Context): String =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getString(PREF_THEME_MODE, "") ?: ""

/** 背景图片（亮/暗各一组）：设置页压缩到 ≤720px 宽 JPEG 后经桥写入。
 *  variant 只认 light/dark；「无」= 删文件。src 记录来源供设置页回显。 */
fun isValidBgVariant(variant: String): Boolean = variant == "light" || variant == "dark"

fun bgImageFile(context: Context, variant: String): File =
    File(context.filesDir, "bg_image_$variant.jpg")

fun readBgImageBase64(context: Context, variant: String): String =
    bgImageFile(context, variant).takeIf { it.exists() }
        ?.readBytes()
        ?.let { Base64.encodeToString(it, Base64.NO_WRAP) } ?: ""

fun readBgImageSource(context: Context, variant: String): String =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getString("bg_image_${variant}_src", "") ?: ""
        ?: ""

/** 键盘侧偏好读取（非法持久值回落默认）；设置页 state 与 IME hello 共用。 */
fun readBottomPadPortraitDp(context: Context): Int =
    readBottomPadDpForKey(context, PREF_BOTTOM_PAD_DP_PORTRAIT)

fun readBottomPadLandscapeDp(context: Context): Int =
    readBottomPadDpForKey(context, PREF_BOTTOM_PAD_DP_LANDSCAPE)

/** IME hello 用：按当前显示方向取值（IME context 的 configuration 跟随方向）。 */
fun readBottomPadDp(context: Context): Int =
    if (context.resources.configuration.orientation ==
        android.content.res.Configuration.ORIENTATION_LANDSCAPE
    ) readBottomPadLandscapeDp(context) else readBottomPadPortraitDp(context)

private fun readBottomPadDpForKey(context: Context, key: String): Int {
    val prefs = context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
    val legacy = prefs.getInt(PREF_BOTTOM_PAD_DP, 0)
        .takeIf { it in BOTTOM_PAD_STEPS } ?: 0
    return prefs.getInt(key, Int.MIN_VALUE)
        .takeIf { it in BOTTOM_PAD_STEPS } ?: legacy
}

fun readFeelScrubSpeed(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_FEEL_SCRUB_SPEED, 3)
        .takeIf { it in 1..5 }
        ?: 3

fun readFeelHoldMs(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_FEEL_HOLD_MS, 350)
        .takeIf { it in FEEL_HOLD_STEPS }
        ?: 350

fun readFeelPopupSnap(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_FEEL_POPUP_SNAP, 1)
        .takeIf { it in 0..2 }
        ?: 1

/** 候选字号档位：0=正常 1=大 2=更大（issue #2）。 */
fun readCandidateFont(context: Context): Int =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getInt(PREF_CANDIDATE_FONT, 0)
        .takeIf { it in 0..2 }
        ?: 0

/** 中文联想开关（docs/design/association.md）：默认关。 */
const val PREF_ASSOCIATION = "association_on"

fun readAssociation(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_ASSOCIATION, false)

/** 日期时间快捷候选开关（issue #22，验收反馈）：默认开——date/time/
 *  week 动态候选不是人人都用，设置里可整体关掉。 */
const val PREF_DYNAMIC_DATETIME = "dynamic_datetime_on"

fun readDynamicDateTime(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_DYNAMIC_DATETIME, true)

/** 按键反馈开关（issue #5 问题 2，借鉴 WeType「按键效果」）：
 * 声音/触感各自独立，默认都关。 */
const val PREF_KEY_SOUND = "key_sound_on"
const val PREF_KEY_HAPTIC = "key_haptic_on"

fun readKeySoundEnabled(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_KEY_SOUND, false)

fun readKeyHapticEnabled(context: Context): Boolean =
    context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        .getBoolean(PREF_KEY_HAPTIC, false)

/** The full-settings WebView bridge (design §6.2).
 *
 * Same handshake as the IME bridge (design §5.3): the activity mints a
 * per-page-load token, pushes it through onBridgeHello, and every call must
 * carry it back ([guarded]). State changes travel as ONE full-state push
 * (window.FeelimeSettings.onEvent({type:"state",...})) - the page is small
 * enough that diffing is not worth the bug surface.
 *
 * Custom keyboard rows (design §15): the settings page edits the same table the
 * IME uses. The store moved to native prefs ([CustomKeysStore]) - the IME
 * WebView mirrors it through its own bridge (FeelimeService.ImeBridge), so
 * both WebViews share one source of truth like clipboard/favorites.
 *
 * The clipboard/favorites management moved out of this page
 * (keyboard panel only), so their stores/entries live solely in
 * FeelimeService.ImeBridge now. */
class SettingsBridge(
    private val context: Context,
    private val host: Host,
) {
    interface Host {
        /** Push a JS event; implementations must marshal to the UI thread
         * and call through to WebView.evaluateJavascript. */
        fun evaluate(script: String)
        fun requestMicPermission()
        fun showImeEnableSettings()
        fun showImePicker()
        /** Launch ACTION_OPEN_DOCUMENT for a verified model archive. */
        fun openModelDocument(modelId: String)
        /** Launch ACTION_OPEN_DOCUMENT for a local keyboard ZIP package. */
        fun openKeyboardDocument() = Unit
        /** Launch ACTION_OPEN_DOCUMENT for a rime .dict.yaml lexicon import. */
        fun openDictDocument() = Unit
        /** Launch ACTION_OPEN_DOCUMENT for a base dictionary (.dict.yaml). */
        fun openBaseDictDocument() = Unit
        /** Launch ACTION_CREATE_DOCUMENT for the userdata backup (userdata.md §1). */
        fun createBackupDocument() = Unit
        /** Launch ACTION_OPEN_DOCUMENT for a userdata backup file. */
        fun openBackupDocument() = Unit
        fun addImeShortcut() = Unit
        fun addImeTile() = Unit
        fun onSettingsChanged()
    }

    @Volatile var pageToken: String = ""

    /** The page reports whether a sub-page is open so the
     * shell's BACK callback returns home first instead of finishing
     * (design §6.2). */
    @Volatile var onSubPage: Boolean = false
    /** 当前子页名（"home"/"input"/"phrases"/…），BACK 逐级返回用。 */
    @Volatile var subPageName: String = "home"

    private val modelStore = ModelStore(context)
    private val customKeysStore = CustomKeysStore(context)
    private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "feelime-settings") }
    private val uiPreferences = UiLanguage.preferences(context)
    private val modelDownloadGate = ModelDownloadConsentGate()

    /** 签名不符但用户可能要装的包（§3 pending/confirm 状态机，
     * 仿 modelDownloadGate；只活在本进程内存，页面刷新即弃）。
     * bytes/id/sha256= 钉扎三者一体发布、一体取走：bridge binder 线程与
     * 安装 worker 并发，拆散字段会让确认绑错包或丢钉扎。 */
    private class PendingKeyboardInstall(
        val bytes: ByteArray,
        val id: String,
        val pin: String?,
    )

    private val pendingLock = Any()
    private var pendingKeyboardInstall: PendingKeyboardInstall? = null
    private val lifecycleLock = Any()
    @Volatile private var closed = false
    private var modelDownloadNetwork: ModelDownloadNetwork? = null

    /**
     * The settings page can stay open while another surface changes the
     * language preference.  Re-push both the shell hello (theme/language) and
     * the full state so the current page redraws immediately.
     */
    private val uiLanguageListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == UiLanguage.KEY_CHOICE && !closed) {
            host.onSettingsChanged()
            pushState()
        }
    }

    /** 词表被别的入口改写（备份恢复后的重派生广播）：设置页若开着，
     *  重推 state——页面的 phraseItems 是全量重发语义的镜像副本，不刷
     *  新的话下一次保存会把旧副本写回去（恢复竞态，review P1）。 */
    private val customPhrasesListener = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: android.content.Intent?) {
            if (intent?.action != ACTION_CUSTOM_PHRASES_CHANGED || closed) return
            pushState()
        }
    }

    init {
        uiPreferences.registerOnSharedPreferenceChangeListener(uiLanguageListener)
        androidx.core.content.ContextCompat.registerReceiver(
            context,
            customPhrasesListener,
            android.content.IntentFilter(ACTION_CUSTOM_PHRASES_CHANGED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    /** The store fires a callback per 64 KB chunk - forward only
     * whole-percent steps (and the terminal states) so the WebView gets one
     * evaluate per percent instead of hundreds per second. */
    private val lastPercent = java.util.concurrent.atomic.AtomicInteger(-1)

    private val modelListener = object : ModelStore.Listener {
        override fun onProgress(modelId: String, doneBytes: Long, totalBytes: Long) {
            if (closed) return
            val percent = if (totalBytes > 0) ((doneBytes * 100) / totalBytes).toInt() else 0
            if (lastPercent.getAndSet(percent) == percent) return
            pushEvent(
                JSONObject()
                    .put("type", "modelProgress")
                    .put("id", modelId)
                    .put("percent", percent)
                    .put("doneBytes", doneBytes)
                    .put("totalBytes", totalBytes),
            )
        }

        override fun onFinished(modelId: String, state: ModelStore.State, error: String?) {
            if (closed) return
            lastPercent.set(-1)
            if (!error.isNullOrBlank()) {
                val saved = modelStore.lastDownloadError(modelId)
                pushModelError(
                    modelId,
                    saved?.code ?: "MODEL_DOWNLOAD_FAILED",
                    saved?.detail ?: error,
                )
            }
            pushState()
            if (error.isNullOrBlank()) notifyModelsChanged()
        }

        override fun onStatus(modelId: String, status: String) {
            if (closed) return
            pushEvent(
                JSONObject()
                    .put("type", "modelImportStatus")
                    .put("id", modelId)
                    .put("status", status),
            )
        }
    }

    fun release() = synchronized(lifecycleLock) {
        if (closed) return
        closed = true
        uiPreferences.unregisterOnSharedPreferenceChangeListener(uiLanguageListener)
        runCatching { context.unregisterReceiver(customPhrasesListener) }
        modelDownloadGate.cancelPending()
        invalidatePendingInstall()
        modelDownloadNetwork?.close()
        modelDownloadNetwork = null
        modelStore.release()
        worker.shutdown()
    }

    // ---- push -----------------------------------------------------------

    /** Passthrough for the shell (hello push lands after onPageFinished). */
    fun evaluate(script: String) {
        if (closed) return
        runCatching { host.evaluate(script) }
            .onFailure { Log.w(TAG, "settings evaluate failed", it) }
    }

    /** Full state snapshot; also the ready-time payload. */
    fun pushState() {
        // A guarded handler can still run after release() (bridge
        // callback racing onDestroy) - a rejected execute must not crash.
        runCatching { worker.execute { pushStateSync() } }
            .onFailure { Log.w(TAG, "settings state push after release", it) }
    }

    private fun pushStateSync() {
        if (closed) return
        val payload = runCatching { stateJson() }
            .onFailure { Log.w(TAG, "settings state build failed", it) }
            .getOrNull() ?: return
        // release() may race the state build.  Do not enqueue a host callback
        // after the bridge has been closed; the Activity also guards its UI
        // runnable for the remaining check-to-post race.
        if (closed) return
        runCatching { host.evaluate("window.FeelimeSettings && window.FeelimeSettings.onEvent($payload)") }
            .onFailure { Log.w(TAG, "settings state push failed", it) }
    }

    private fun pushEvent(payload: JSONObject) {
        if (closed) return
        runCatching { host.evaluate("window.FeelimeSettings && window.FeelimeSettings.onEvent($payload)") }
            .onFailure { Log.w(TAG, "settings event push failed", it) }
    }

    fun stateJson(): String {
        val prefs = context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
        val sourcePreferenceSet = prefs.contains(KeyboardStore.STATE_SOURCE_URL)
        val savedSource = prefs.getString(KeyboardStore.STATE_SOURCE_URL, "") ?: ""
        val sourceMode = when {
            !sourcePreferenceSet -> "default"
            savedSource.isBlank() -> "disabled"
            else -> "custom"
        }
        val source = if (sourcePreferenceSet) savedSource else DEFAULT_GITHUB_SOURCE
        val active = KeyboardUpdateCenter.activeKeyboard(context)
        val state = JSONObject()
            .put("theme", themeName())
            .put("channel", if (BuildConfig.PLAY_DISTRIBUTION) "play" else "direct")
            // Keep the distribution capability explicit for settings UI
            // actions.  The channel string remains for older pages, while
            // new pages can show the app-update entry without inferring it.
            .put("playDistribution", BuildConfig.PLAY_DISTRIBUTION)
            .put("modelBackend", modelStore.modelBackend().value)
            .put("modelDownloadSource", JSONObject().apply {
                val source = modelStore.modelDownloadSource()
                put("mode", source.source.value)
                put("customBase", source.customBase)
                put("customArchiveUrl", source.customArchiveUrl)
            })
            // Stable protocol values; the page resolves labels from these
            // codes and never infers UI language from the input mode.
            .put("uiLanguage", UiLanguage.choice(context))
            .put("uiLocale", UiLanguage.locale(context))
            .put("ime", JSONObject()
                .put("enabled", hostEnabled())
                .put("isDefault", hostIsDefaultIme()))
            .put("mic", JSONObject().put("granted", micGranted()))
            .put("dpScheme", com.feelime.ime.engine.DoublePinyinScheme.resolve(context))
            .put("fuzzyPinyinMask", com.feelime.ime.engine.FuzzyPinyin.mask(context))
            .put("baseDict", com.feelime.ime.engine.BaseDictInstaller.statusJson(context))
            .put("customPhrases", JSONObject().apply {
                val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
                put("enabled", state.enabled)
                put("items", JSONArray().apply {
                    state.items.forEach { (text, code) ->
                        put(JSONObject().put("text", text).put("code", code))
                    }
                })
                put("importedCount", state.imported.size)
            })
            .put("userWords", JSONArray().apply {
                com.feelime.ime.engine.CustomPhraseStore.load(context).user.forEach { (text, code) ->
                    put(JSONObject().put("text", text).put("code", code))
                }
            })
            .put("associationOn", readAssociation(context))
            .put("dynamicDateTimeOn", readDynamicDateTime(context))
            .put("keySound", readKeySoundEnabled(context))
            .put("keyHaptic", readKeyHapticEnabled(context))
            .put("bottomPadPortrait", readBottomPadPortraitDp(context))
            .put("bottomPadLandscape", readBottomPadLandscapeDp(context))
            .put("scrubSpeed", readFeelScrubSpeed(context))
            .put("holdMs", readFeelHoldMs(context))
            .put("popupSnap", readFeelPopupSnap(context))
            .put("candidateFont", readCandidateFont(context))
            .put("preeditFont", readPreeditFont(context))
            .put("preeditBold", readPreeditBold(context))
            .put("oneHand", readOneHand(context))
            .put("oneHandPad", readOneHandPad(context))
            .put("sideContent", readSideContent(context))
            .put("bgImageLight", readBgImageBase64(context, "light"))
            .put("bgImageDark", readBgImageBase64(context, "dark"))
            .put("bgImageLightSource", readBgImageSource(context, "light"))
            .put("bgImageDarkSource", readBgImageSource(context, "dark"))
            .put("keyOpacity", readKeyOpacity(context))
            .put("keyBubble", readKeyBubble(context))
            .put("bubbleLinger", readBubbleLinger(context))
            // 验收 2026-09-24：state push 漏 flickSwap，设置页回显恒 false，
            // 点开开关后 pushState 一到就弹回——「开了看不出开」。
            .put("flickSwap", readFlickSwap(context))
            .put("themeMode", readThemeMode(context))
            .put("kbHeightPortrait", readKbHeightPortrait(context))
            .apply {
                val (min, max) = readKbHeightBounds(context)
                put("kbHeightMin", min)
                put("kbHeightMax", max)
            }
            .put("toolbarLayout", readToolbarLayout(context))
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("keyboardVersion", keyboardVersion())
            .put("diagnosticsOn", Diagnostics.enabled(context))
            .put("device", JSONObject()
                .put("manufacturer", Build.MANUFACTURER)
                .put("model", Build.MODEL)
                .put("release", Build.VERSION.RELEASE)
                .put("sdkInt", Build.VERSION.SDK_INT))
            .put("models", modelsJson())
            .put("asr", JSONObject()
                .put("stripPeriod", asrPrefs().getBoolean(AsrSettings.KEY_STRIP_FINAL_PERIOD, true))
                .put("hotwords", asrPrefs().getString(AsrSettings.KEY_HOTWORDS, "") ?: ""))
            .put("custom", JSONObject()
                .put("enabled", customKeysStore.enabled())
                .put("summary", customKeysStore.summary(context))
                .put("json", customKeysStore.json()))
            // 键盘选择/快捷切换对（快捷设置 tile 直达设置页管理）：值是
            // 键盘 localStorage 的 JSON 字符串（["pinyin",...]），空串=未设
            // 置（键盘用默认菜单）。
            .put("keyboards", keyboardsState())
            .put("update", JSONObject()
                // Keep the absence of a preference distinct from an explicit
                // empty value: a fresh install shows the official source,
                // while clearing it disables automatic checks.
                .put("source", source)
                .put("sourceMode", sourceMode)
                .put("sourceConfigured", sourcePreferenceSet)
                .put("autoCheck", prefs.getBoolean(STATE_AUTO_CHECK_ENABLED, false))
                .put("autoCheckLastAttemptAt", prefs.getLong(STATE_AUTO_CHECK_LAST_ATTEMPT_AT, 0L))
                .put("url", prefs.getString(KeyboardStore.STATE_UPDATE_URL, "") ?: "")
                .put("state", prefs.getString(KeyboardStore.STATE_UPDATE_STATE, "BUILT_IN") ?: "BUILT_IN")
                .put("lastErrorCode", prefs.getString(KeyboardStore.STATE_LAST_ERROR_CODE, "") ?: "")
                .put("lastErrorMessage", updateErrorMessage(
                    prefs.getString(KeyboardStore.STATE_LAST_ERROR_CODE, "") ?: "",
                    "",
                ))
                .put("lastErrorDetail", prefs.getString(KeyboardStore.STATE_LAST_ERROR_MESSAGE, "") ?: "")
                // Keep the old combined field for older settings pages while
                // exposing code and message separately to new pages.
                .put("lastError", (prefs.getString(KeyboardStore.STATE_LAST_ERROR_CODE, null) ?: "") +
                    " " + (prefs.getString(KeyboardStore.STATE_LAST_ERROR_MESSAGE, null) ?: ""))
                .put("lastSuccessAt", prefs.getString(KeyboardStore.STATE_LAST_SUCCESS_AT, "") ?: "")
                .put("activeSource", if (active.source == KeyboardSource.BUILT_IN) "built_in" else "hot")
                .put("activeVersion", active.version)
                .put("activeContentHash", active.contentHash ?: "")
                .put("activeSigned", active.signed)
                .put("activeSignatureConfirmed", active.signatureConfirmed))
            .put("notices", notices())
        return JSONObject().put("type", "state").put("state", state).toString()
    }

    private fun modelsJson(): JSONArray = JSONArray().apply {
        for (model in modelStore.manifest().models) {
            val state = modelStore.state(model)
            val error = modelStore.lastDownloadError(model.id)
            put(JSONObject()
                .put("id", model.id)
                .put("title", modelTitle(model))
                .put("sizeBytes", model.totalBytes)
                .put("downloadBytes", model.totalDownloadBytes)
                .put("errorCode", error?.code ?: "")
                .put("errorDetail", error?.detail ?: "")
                .put("state", when (state) {
                    ModelStore.State.BUILT_IN -> "built_in"
                    ModelStore.State.MISSING -> "missing"
                    ModelStore.State.DOWNLOADING -> "downloading"
                    ModelStore.State.IMPORTING -> "importing"
                    ModelStore.State.INSTALLED -> "installed"
                    ModelStore.State.BROKEN -> "broken"
                }))
        }
    }

    private fun modelTitle(model: ModelSpec): String = when (model.id) {
        "streaming-zipformer-bilingual-zh-en" -> t(context, "流式语音识别（中英）", "Streaming speech recognition (Chinese/English)")
        "paraformer-zh-small" -> t(context, "整句纠错识别", "Full-sentence correction")
        "offline-punct-zh-en",
        "online-punct-en" -> t(context, "中英标点恢复", "Chinese-English punctuation restoration") // Keep old downloaded manifests readable during migration.
        else -> model.title
    }

    private fun notices(): String = runCatching {
        context.assets.open("third-party/THIRD_PARTY_NOTICES.txt")
            .use { stream -> stream.readBytes().decodeToString() }
    }.getOrDefault(t(context, "第三方说明文件缺失", "Third-party notices are missing"))

    private fun updateErrorMessage(code: String, detail: String): String {
        if (code.isBlank() && detail.isBlank()) return ""
        val label = when (code) {
            "INVALID_SOURCE" -> t(context, "更新源地址无效", "The update source URL is invalid")
            "NO_RELEASE" -> t(context, "尚无可用发布", "No release is currently available")
            "NO_INSTALLABLE_ASSET" -> t(context, "发布中没有可安装的键盘包", "The release has no installable keyboard package")
            "AMBIGUOUS_ASSET" -> t(context, "发布中的键盘包不唯一", "The release has ambiguous keyboard packages")
            "INVALID_ASSET_URL" -> t(context, "发布资产下载地址无效", "The release asset URL is invalid")
            "RATE_LIMITED" -> t(context, "GitHub 请求受到限流", "GitHub rate limited the request")
            "NETWORK_ERROR" -> t(context, "网络请求失败", "The network request failed")
            "BAD_RESPONSE" -> t(context, "更新源响应无效", "The update source returned an invalid response")
            "INTERNAL_ERROR" -> t(context, "更新处理失败", "The update operation failed")
            "MISSING_SOURCE_URL" -> t(context, "缺少更新源地址", "The update source URL is missing")
            "MISSING_PACKAGE_URL" -> t(context, "缺少键盘包地址", "The keyboard package URL is missing")
            else -> t(context, "键盘更新失败", "Keyboard update failed")
        }
        return label
    }

    private fun themeName(): String {
        val night = context.resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return if (night == android.content.res.Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
    }

    private fun hostEnabled(): Boolean = runCatching {
        inputMethodManager().enabledInputMethodList.any { it.packageName == context.packageName }
    }.getOrDefault(false)

    private fun hostIsDefaultIme(): Boolean = runCatching {
        val flat = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.DEFAULT_INPUT_METHOD,
        )
        matchesDefaultImeComponent(
            flat,
            context.packageName,
            FeelimeService::class.java.name,
        )
    }.getOrDefault(false)

    private fun micGranted(): Boolean = runCatching {
        androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.RECORD_AUDIO,
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }.getOrDefault(false)

    private fun inputMethodManager() =
        context.getSystemService(Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager

    private fun asrPrefs() = context.getSharedPreferences(AsrSettings.PREFS, Context.MODE_PRIVATE)

    private fun networkDecision(): NetworkDownloadDecision {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return NetworkDownloadDecision.NO_NETWORK
        val network = manager.activeNetwork ?: return NetworkDownloadDecision.NO_NETWORK
        val capabilities = manager.getNetworkCapabilities(network)
            ?: return NetworkDownloadDecision.NO_NETWORK
        val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        return NetworkDownloadConsent.decision(hasInternet, manager.isActiveNetworkMetered)
    }

    private fun startModelDownload(model: ModelSpec, allowMetered: Boolean = false) = synchronized(lifecycleLock) {
        if (closed || modelDownloadNetwork != null) return
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val network = manager?.activeNetwork
        if (manager == null || network == null) {
            pushModelError(model.id, "NO_NETWORK")
            return
        }
        val session = ModelDownloadNetwork(manager, network, allowMetered)
        try {
            session.check()
        } catch (_: ModelDownloadNetworkChanged) {
            session.close()
            pushModelError(model.id, "MODEL_NETWORK_CHANGED")
            return
        }
        val listener = object : ModelStore.Listener {
            override fun onProgress(modelId: String, doneBytes: Long, totalBytes: Long) =
                modelListener.onProgress(modelId, doneBytes, totalBytes)

            override fun onFinished(modelId: String, state: ModelStore.State, error: String?) {
                val changed = runCatching { session.check() }.isFailure
                session.close()
                synchronized(lifecycleLock) {
                    if (modelDownloadNetwork === session) modelDownloadNetwork = null
                    if (closed) return
                }
                if (session.cancelledByUser) {
                    modelListener.onFinished(modelId, state, null)
                } else if (changed && state != ModelStore.State.INSTALLED) {
                    lastPercent.set(-1)
                    pushModelError(modelId, "MODEL_NETWORK_CHANGED")
                    pushState()
                } else {
                    modelListener.onFinished(modelId, state, error)
                }
            }
        }
        modelDownloadNetwork = session
        var accepted = false
        try {
            accepted = modelStore.download(model, listener, session.transport, session::check)
            if (accepted) pushState()
        } finally {
            if (!accepted) {
                modelDownloadNetwork = null
                session.close()
            }
        }
    }

    private fun startModelImport(model: ModelSpec, uri: Uri) = synchronized(lifecycleLock) {
        if (closed) return
        val accepted = modelStore.importModel(model, context.contentResolver, uri, modelListener)
        if (accepted) {
            pushState()
        } else {
            pushModelError(model.id, "MODEL_IMPORT_BUSY")
        }
    }

    private fun modelRequest(model: ModelSpec): ModelDownloadRequest = ModelDownloadRequest(
        id = model.id,
        name = modelTitle(model),
        bytes = model.totalDownloadBytes,
    )

    private fun pushModelError(id: String, code: String) {
        pushModelError(id, code, "")
    }

    private fun pushModelError(id: String, code: String, detail: String) {
        val message = when (code) {
            "NO_NETWORK" -> t(context, "当前没有可用的网络连接", "No network connection is available")
            "MODEL_NETWORK_CHANGED" -> t(context, "网络已变化，下载已暂停。请重新点击下载确认流量后继续", "The network changed and the download paused. Tap Download to confirm and resume")
            "STALE_CONFIRMATION" -> t(context, "下载确认已过期，请重新点击下载", "The download confirmation expired; tap Download again")
            "MODEL_IMPORT_BUSY" -> t(context, "模型正在处理，请稍候", "The model is already being processed")
            "MODEL_IMPORT_FAILED" -> t(context, "模型导入失败，请检查归档格式和清单后重试", "Model import failed; check the archive format and manifest, then try again")
            else -> t(context, "模型下载失败，请稍后重试", "Model download failed; try again later")
        }
        if (id.isNotBlank() && code != "MODEL_IMPORT_BUSY") {
            modelStore.recordDownloadError(id, code, detail)
        }
        pushEvent(
            JSONObject()
                .put("type", "modelDownloadError")
                .put("id", id)
                .put("code", code)
                .put("message", message)
                .put("detail", detail.take(240)),
        )
    }

    private fun keyboardVersion(): String = runCatching {
        context.assets.open("keyboard/VERSION").use { it.readBytes().decodeToString().trim() }
    }.getOrDefault("")

    // ---- JS entry points -------------------------------------------------

    /** Page readiness ping → pushes the first full state. */
    @JavascriptInterface
    fun ready(token: String) = guarded(token) {
        pushState()
        maybeAutoCheck()
    }

    @JavascriptInterface
    fun enableIme(token: String) = guarded(token) { host.showImeEnableSettings() }

    @JavascriptInterface
    fun pickIme(token: String) = guarded(token) { host.showImePicker() }

    @JavascriptInterface
    fun requestMic(token: String) = guarded(token) { host.requestMicPermission() }

    /** Open the native application listing.  Play builds use this for APK
     * updates; keyboard ZIP updates continue through the signed bridge flow.
     * Direct builds deliberately ignore the call so a stale page cannot route
     * them to a store listing.
     */
    @JavascriptInterface
    fun openAppStore(token: String) = guarded(token) {
        if (BuildConfig.PLAY_DISTRIBUTION) openPlayListing()
    }

    @JavascriptInterface
    fun setModelBackend(value: String, token: String) = guarded(token) {
        val backend = ModelBackend.fromValue(value)
        if (backend == null) {
            pushState()
            return@guarded
        }
        modelStore.setModelBackend(backend)
        pushState()
    }

    @JavascriptInterface
    fun setModelDownloadSource(
        value: String,
        customBase: String,
        customArchiveUrl: String,
        token: String,
    ) = guarded(token) {
        val source = ModelDownloadSource.fromValue(value)
        if (!modelStore.setModelDownloadSource(source, customBase, customArchiveUrl)) {
            pushEvent(
                JSONObject()
                    .put("type", "modelSourceError")
                    .put("code", "INVALID_MODEL_SOURCE")
                    .put("message", t(context, "自定义源需要 HTTPS 仓库地址和对应的 tar.bz2 归档地址", "A custom source needs an HTTPS repository URL and its matching tar.bz2 archive URL")),
            )
            return@guarded
        }
        pushState()
    }

    /** 双拼方案切换（docs/design/double-pinyin.md §2）：落盘偏好并广播，
     * IME 在当前双拼会话上换 schema 重建；hello 会把新方案推给键盘。 */
    @JavascriptInterface
    fun setDoublePinyinScheme(value: String, token: String) = guarded(token) {
        if (!com.feelime.ime.engine.DoublePinyinScheme.set(context, value)) {
            pushEvent(
                JSONObject()
                    .put("type", "dpSchemeError")
                    .put("code", "BAD_DP_SCHEME")
                    .put("message", t(context, "双拼方案选项无效", "Invalid double-pinyin scheme")),
            )
            pushState()
            return@guarded
        }
        context.sendBroadcast(
            Intent(ACTION_DP_SCHEME_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 全拼模糊音分组开关（issue #2）：位掩码落盘并广播，IME 在当前全拼
     * 会话上按新掩码物化 prism 换 schema 重建。掩码由设置页按组合成。 */
    @JavascriptInterface
    fun setFuzzyPinyinMask(mask: Int, token: String) = guarded(token) {
        if (mask !in 0..com.feelime.ime.engine.FuzzyPinyin.MASK_ALL) {
            pushEvent(
                JSONObject()
                    .put("type", "fuzzyPinyinError")
                    .put("code", "BAD_FUZZY_MASK")
                    .put("message", t(context, "模糊音组合无效", "Invalid fuzzy-pinyin combination")),
            )
            pushState()
            return@guarded
        }
        com.feelime.ime.engine.FuzzyPinyin.set(context, mask)
        context.sendBroadcast(
            Intent(ACTION_FUZZY_PINYIN_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 底部留白（mode-fallback §3）：档位离散，非法值报错不落盘。写完
     *  广播让 IME 重推 hello，运行中的键盘即时采用新 pad。 */
    @JavascriptInterface
    fun setBottomPadPortrait(dp: Int, token: String) =
        setBottomPadFor(PREF_BOTTOM_PAD_DP_PORTRAIT, dp, token)

    @JavascriptInterface
    fun setBottomPadLandscape(dp: Int, token: String) =
        setBottomPadFor(PREF_BOTTOM_PAD_DP_LANDSCAPE, dp, token)

    private fun setBottomPadFor(key: String, dp: Int, token: String) = guarded(token) {
        if (dp !in BOTTOM_PAD_STEPS) {
            pushEvent(
                JSONObject()
                    .put("type", "bottomPadError")
                    .put("code", "BAD_BOTTOM_PAD")
                    .put("message", t(context, "底部留白选项无效", "Invalid bottom padding option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(key, dp).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 候选字号档位（issue #2）：0=正常 1=大 2=更大。 */
    @JavascriptInterface
    fun setCandidateFont(size: Int, token: String) = guarded(token) {
        if (size !in 0..2) {
            pushEvent(
                JSONObject()
                    .put("type", "candidateFontError")
                    .put("code", "BAD_CANDIDATE_FONT")
                    .put("message", t(context, "候选字号选项无效", "Invalid candidate font option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_CANDIDATE_FONT, size).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 拼音字号档位（issue #8）：0=标准 1=大 2=特大。 */
    @JavascriptInterface
    fun setPreeditFont(size: Int, token: String) = guarded(token) {
        if (size !in 0..2) {
            pushEvent(
                JSONObject()
                    .put("type", "preeditFontError")
                    .put("code", "BAD_PREEDIT_FONT")
                    .put("message", t(context, "拼音字号选项无效", "Invalid preedit font option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_PREEDIT_FONT, size).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }



    /** 单手压缩比例：0=默认让位 15/25/35=让位占屏宽百分比。 */
    @JavascriptInterface
    fun setOneHandPad(pct: Int, token: String) = guarded(token) {
        if (pct !in ONE_HAND_PAD_CHOICES) {
            pushEvent(
                JSONObject()
                    .put("type", "oneHandError")
                    .put("code", "BAD_ONE_HAND_PAD")
                    .put("message", t(context, "单手压缩比例无效", "Invalid one-hand pad option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_ONE_HAND_PAD, pct).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 侧边条内容：0=光标控制 1=空白（2=自定义图片已废除，升级为背景图片）。 */
    @JavascriptInterface
    fun setSideContent(mode: Int, token: String) = guarded(token) {
        if (mode !in 0..1) {
            pushEvent(
                JSONObject()
                    .put("type", "sideContentError")
                    .put("code", "BAD_SIDE_CONTENT")
                    .put("message", t(context, "侧边条选项无效", "Invalid side-pad option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_SIDE_CONTENT, mode).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 背景图片（variant=light/dark）：设置页压缩到 ≤720px 宽的 JPEG
     *  base64，落盘 + 记录来源，广播让键盘重拉 hello。 */
    @JavascriptInterface
    fun setBgImage(variant: String, base64: String, token: String) = guarded(token) {
        if (!isValidBgVariant(variant)) return@guarded
        try {
            val bytes = Base64.decode(base64, Base64.NO_WRAP)
            if (bytes.isEmpty()) throw IllegalArgumentException("empty image")
            bgImageFile(context, variant).writeBytes(bytes)
        } catch (error: Exception) {
            pushEvent(
                JSONObject()
                    .put("type", "bgImageError")
                    .put("code", "BAD_BG_IMAGE")
                    .put("message", t(context, "图片保存失败", "Failed to save the image")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putString("bg_image_" + variant + "_src", "custom").apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 色彩模式（外观页）：写 theme_mode pref + 广播，键盘 hello 读回
     *  应用到 localStorage/背景图/工具栏图形。 */
    @JavascriptInterface
    fun setThemeMode(mode: String, token: String) = guarded(token) {
        if (mode !in listOf("auto", "light", "dark")) return@guarded
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putString(PREF_THEME_MODE, mode).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 上下滑方向互换（issue #29-2，默认关）。 */
    @JavascriptInterface
    fun setFlickSwap(on: Boolean, token: String) = guarded(token) {
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putBoolean(PREF_FLICK_SWAP, on).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 键帽不透明度（0-100）。 */
    @JavascriptInterface
    fun setKeyOpacity(pct: Int, token: String) = guarded(token) {
        if (pct !in 0..100) return@guarded
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_KEY_OPACITY, pct).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 按键气泡开关（issue #30-1，默认关）。 */
    @JavascriptInterface
    fun setKeyBubble(on: Boolean, token: String) = guarded(token) {
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putBoolean(PREF_KEY_BUBBLE, on).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 气泡停留时长（验收 2026-09-24）：0=立即隐藏，250/400/600ms 档。 */
    @JavascriptInterface
    fun setBubbleLinger(ms: Int, token: String) = guarded(token) {
        if (ms !in BUBBLE_LINGER_STEPS.asList()) return@guarded
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_BUBBLE_LINGER, ms).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }


    /** 外观页预览：让 IME 显示/收起真实键盘（service 自己 show self）。 */
    @JavascriptInterface
    fun previewKeyboard(show: Boolean, token: String) = guarded(token) {
        context.sendBroadcast(
            Intent(ACTION_PREVIEW_KEYBOARD)
                .setPackage(context.packageName)
                .putExtra("show", show),
        )
    }

    /** 键盘高度（竖屏，入参 CSS px；0=恢复默认）。写 pref 后广播，service
     *  侧统一重读 override（拖拽调节的 setKeyboardHeight 也落同一 pref，
     *  两条路收敛到同一真相源）。pref 的既存语义是物理 px（拖拽路径
     *  flushHeightPref 写 clamped 物理值），这里写盘必须 ×density 对齐，
     *  否则广播重读后窗口高度塌成 1/3、键位被裁（真机实录）。 */
    @JavascriptInterface
    fun setKbHeight(px: Int, token: String) = guarded(token) {
        val (min, max) = readKbHeightBounds(context)
        val density = context.resources.displayMetrics.density
        val value = when {
            px <= 0 -> 0
            else -> px.coerceIn(min, max)
        }
        val prefs = context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
        if (value == 0) {
            prefs.edit().remove(KB_HEIGHT_PORTRAIT_KEY).apply()
        } else {
            prefs.edit().putInt(KB_HEIGHT_PORTRAIT_KEY, Math.round(value * density)).apply()
        }
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 「无」：删除该组背景图（回到纯色背景）。 */
    @JavascriptInterface
    fun clearBgImage(variant: String, token: String) = guarded(token) {
        if (!isValidBgVariant(variant)) return@guarded
        bgImageFile(context, variant).delete()
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().remove("bg_image_" + variant + "_src").apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 内置背景图（随包 assets，设置页直接选用）：从 assets 拷贝到该组
     *  落盘位，省一遍 base64 编解码。variant 只认 light/dark。 */
    @JavascriptInterface
    fun setBuiltinBgImage(variant: String, token: String) = guarded(token) {
        if (!isValidBgVariant(variant)) {
            pushEvent(
                JSONObject()
                    .put("type", "bgImageError")
                    .put("code", "BAD_BG_IMAGE")
                    .put("message", t(context, "图片保存失败", "Failed to save the image")),
            )
            return@guarded
        }
        try {
            context.assets.open("settings/bg-$variant.jpg").use { input ->
                bgImageFile(context, variant).outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        } catch (error: Exception) {
            pushEvent(
                JSONObject()
                    .put("type", "bgImageError")
                    .put("code", "BAD_BG_IMAGE")
                    .put("message", t(context, "图片保存失败", "Failed to save the image")),
            )
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putString("bg_image_" + variant + "_src", "builtin").apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }




    /** 中文联想开关（docs/design/association.md §4）：落盘 + 广播重推
     *  hello；关掉时的联想清屏由 service 的 keyboardPrefsReceiver 处理。 */
    @JavascriptInterface
    fun setAssociation(on: Boolean, token: String) = guarded(token) {
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putBoolean(PREF_ASSOCIATION, on).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 日期时间快捷候选开关：落盘 + 广播重推 hello，键盘侧
     *  dynamicCandidatesFor 直接按 hello 字段 gate。 */
    @JavascriptInterface
    fun setDynamicDateTime(on: Boolean, token: String) = guarded(token) {
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putBoolean(PREF_DYNAMIC_DATETIME, on).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 自定义短语（issue #17）：itemsJson = [{text,code}] 全量保存。
     * 壳侧落盘 json + 派生/删除 custom_phrase.txt，随后广播让 IME 整
     * 引擎重载（stabledb 只在引擎生命周期加载一次）。词条校验：text
     * 非空、code 为 1..16 位字母（大小写归一），上限 200 条。 */
    @JavascriptInterface
    fun saveCustomPhrases(itemsJson: String, enabled: Boolean, token: String) = guarded(token) {
        val items = ArrayList<Pair<String, String>>()
        val parseError = try {
            val array = JSONArray(itemsJson)
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                val text = item.optString("text").trim()
                val code = item.optString("code").trim().lowercase()
                if (text.isEmpty()) continue
                if (!Regex("^[a-z;]{1,16}$").matches(code)) {
                    pushEvent(
                        JSONObject()
                            .put("type", "customPhrasesError")
                            .put("code", "BAD_PHRASE_CODE")
                            .put("message", t(context, "输入码需为 1-16 位字母", "Code must be 1-16 letters")),
                    )
                    return@guarded
                }
                items.add(text to code)
            }
            false
        } catch (_: Exception) {
            true
        }
        if (parseError || items.size > 200) {
            pushEvent(
                JSONObject()
                    .put("type", "customPhrasesError")
                    .put("code", "BAD_PHRASES_PAYLOAD")
                    .put("message", t(context, "词表格式错误", "Invalid phrase list")),
            )
            return@guarded
        }
        // 手管 items 全量重发不触碰导入段（imported 由导入/清空入口专管）。
        val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
        com.feelime.ime.engine.CustomPhraseStore.save(
            context, enabled, items, imported = state.imported, user = state.user,
        )
        context.sendBroadcast(
            Intent(ACTION_CUSTOM_PHRASES_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 自造词（issue #29-5）：词库管理里手动维护的用户词表，独立于
     *  符号词（items）与导入表（imported），不受符号词开关 gating。
     *  校验：text 非空、code 1..48 位字母（真实拼音串比符号码长），
     *  上限 200 条。 */
    @JavascriptInterface
    fun saveUserWords(itemsJson: String, token: String) = guarded(token) {
        val items = ArrayList<Pair<String, String>>()
        val parseError = try {
            val array = JSONArray(itemsJson)
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                val text = item.optString("text").trim()
                val code = item.optString("code").trim().lowercase()
                if (text.isEmpty()) continue
                if (code.isEmpty()) {
                    // 自动注音（#29-5 验收）：码留空=只输词。user 段只存主码
                    // （词频最高组合，UI 一词一行）；deriveTxt 落 txt 时对
                    // user 段做 autoPinyinCodes 全组合展开（多音字）再叠双
                    // 拼键序。含无法注音字符（字母/数字）回落为要求手输码。
                    val auto = com.feelime.ime.engine.CustomPhraseStore.autoPinyinCodes(context, text)
                    if (auto.isEmpty()) {
                        pushEvent(
                            JSONObject()
                                .put("type", "userWordsError")
                                .put("code", "AUTO_PINYIN_FAILED")
                                .put("message", t(context,
                                    "「" + text.take(8) + "」含无法自动注音的字符，请手动填写输入码",
                                    "\"" + text.take(8) + "\" needs a manual code (non-Han characters)")),
                        )
                        return@guarded
                    }
                    items.add(text to auto[0])
                    continue
                }
                if (!Regex("^[a-z;]{1,48}$").matches(code)) {
                    pushEvent(
                        JSONObject()
                            .put("type", "userWordsError")
                            .put("code", "BAD_PHRASE_CODE")
                            .put("message", t(context, "输入码需为 1-48 位字母", "Code must be 1-48 letters")),
                    )
                    return@guarded
                }
                items.add(text to code)
            }
            false
        } catch (_: Exception) {
            true
        }
        if (parseError || items.size > 200) {
            pushEvent(
                JSONObject()
                    .put("type", "userWordsError")
                    .put("code", "BAD_PHRASES_PAYLOAD")
                    .put("message", t(context, "词表格式错误", "Invalid phrase list")),
            )
            return@guarded
        }
        val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
        com.feelime.ime.engine.CustomPhraseStore.save(
            context, state.enabled, state.items, imported = state.imported, user = items,
        )
        context.sendBroadcast(
            Intent(ACTION_CUSTOM_PHRASES_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 词库导入（issue #37）：SAF 选中的 rime .dict.yaml 解析后进
     *  CustomPhraseStore 的 imported 段（替换式——再导一次即换表）。
     *  与 saveCustomPhrases 同一重载链路（广播 + state 重推）。
     *  Called by SetupActivity after ACTION_OPEN_DOCUMENT returns. */
    fun importDictFromUri(uri: Uri) = synchronized(lifecycleLock) {
        if (closed) return
        worker.execute {
            val result = runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use {
                    val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
                    com.feelime.ime.engine.DictYamlImporter.parse(
                        it, existing = state.items.toSet(),
                    )
                } ?: return@execute pushDictImportedEvent(0, 0, "DICT_READ_FAILED")
            }.getOrElse {
                Log.w(TAG, "dict import read failed", it)
                return@execute pushDictImportedEvent(0, 0, "DICT_READ_FAILED")
            }
            if (result.items.isEmpty()) {
                pushDictImportedEvent(0, result.skipped, "DICT_EMPTY")
                return@execute
            }
            val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
            com.feelime.ime.engine.CustomPhraseStore.save(
                context, state.enabled, state.items, imported = result.items, user = state.user,
            )
            context.sendBroadcast(
                Intent(ACTION_CUSTOM_PHRASES_CHANGED).setPackage(context.packageName),
            )
            pushDictImportedEvent(
                result.items.size,
                result.skipped + result.truncated,
                if (result.truncated > 0) "DICT_TRUNCATED" else null,
            )
            pushState()
        }
    }

    /** SAF 选择器由宿主 Activity 起（Host.openDictDocument），token 走
     *  guarded 只做存活校验。 */
    @JavascriptInterface
    fun openDictDocument(token: String) = guarded(token) {
        host.openDictDocument()
    }

    /** 清空导入词（手管 items 不动）。 */
    @JavascriptInterface
    fun clearImportedDict(token: String) = guarded(token) {
        val state = com.feelime.ime.engine.CustomPhraseStore.load(context)
        if (state.imported.isEmpty()) return@guarded
        com.feelime.ime.engine.CustomPhraseStore.save(
            context, state.enabled, state.items, imported = emptyList(), user = state.user,
        )
        context.sendBroadcast(
            Intent(ACTION_CUSTOM_PHRASES_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 基底词库换装（issue #23）：SAF 选择器由宿主起（Host.openBaseDictDocument）。
     *  编译在 BaseDictInstaller 自己的单线程上跑，事件经 [pushEvent] 直推。 */
    @JavascriptInterface
    fun openBaseDictDocument(token: String) = guarded(token) {
        host.openBaseDictDocument()
    }

    /** Called by SetupActivity after the base-dict SAF picker returns. */
    fun installBaseDict(uri: android.net.Uri, displayName: String) = synchronized(lifecycleLock) {
        if (closed) return
        if (com.feelime.ime.engine.BaseDictInstaller.isBuilding()) return
        com.feelime.ime.engine.BaseDictInstaller.installAsync(
            context, uri, displayName,
            pushEvent = { payload -> pushEvent(payload) },
            onFinished = { pushState() },
        )
        pushState()
    }

    /** 恢复内置 frost 词库（删设备端编译产物 + 留档源）。 */
    @JavascriptInterface
    fun clearBaseDict(token: String) = guarded(token) {
        if (com.feelime.ime.engine.BaseDictInstaller.isBuilding()) return@guarded
        com.feelime.ime.engine.BaseDictInstaller.revertAsync(
            context,
            pushEvent = { payload -> pushEvent(payload) },
            onFinished = { pushState() },
        )
        pushState()
    }

    private fun pushDictImportedEvent(count: Int, skipped: Int, warnCode: String?) {
        val message = when (warnCode) {
            "DICT_READ_FAILED" -> t(context, "读取文件失败", "Failed to read the file")
            "DICT_EMPTY" -> t(context, "没有可导入的词条", "No importable entries found")
            "DICT_TRUNCATED" -> t(
                context,
                "已导入 $count 条（超出上限的部分被截断，共跳过 $skipped 行）",
                "Imported $count entries (rest truncated, $skipped lines skipped)",
            )
            else -> t(context, "已导入 $count 条", "Imported $count entries")
        }
        pushEvent(
            JSONObject()
                .put("type", "dictImported")
                .put("count", count)
                .put("skipped", skipped)
                .put("code", warnCode ?: "OK")
                .put("message", message),
        )
    }

    /** 按键反馈开关（issue #5 问题 2）：落盘生效（键盘每次按键都调
     * keyFeedback，原生按当前偏好决定发声/振动）+ 广播重推 hello——
     * 快捷设置 tile 的开/关回读靠它。 */
    @JavascriptInterface
    fun setKeySound(on: Boolean, token: String) = guarded(token) {
        applyKeyFeedbackPref(PREF_KEY_SOUND, on)
    }

    @JavascriptInterface
    fun setKeyHaptic(on: Boolean, token: String) = guarded(token) {
        applyKeyFeedbackPref(PREF_KEY_HAPTIC, on)
    }

    private fun applyKeyFeedbackPref(key: String, on: Boolean) {
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().putBoolean(key, on).apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** 手感微调（mode-fallback §4）：三值一起提交，-1 表示不变。 */
    @JavascriptInterface
    fun setFeelOptions(scrubSpeed: Int, holdMs: Int, popupSnap: Int, token: String) = guarded(token) {
        val valid = (scrubSpeed == -1 || scrubSpeed in 1..5) &&
            (holdMs == -1 || holdMs in FEEL_HOLD_STEPS) &&
            (popupSnap == -1 || popupSnap in 0..2)
        if (!valid) {
            pushEvent(
                JSONObject()
                    .put("type", "feelOptionsError")
                    .put("code", "BAD_FEEL_OPTION")
                    .put("message", t(context, "手感参数无效", "Invalid feel tuning option")),
            )
            pushState()
            return@guarded
        }
        context.getSharedPreferences(KEYBOARD_PREFS_FILE, Context.MODE_PRIVATE)
            .edit().apply {
                if (scrubSpeed != -1) putInt(PREF_FEEL_SCRUB_SPEED, scrubSpeed)
                if (holdMs != -1) putInt(PREF_FEEL_HOLD_MS, holdMs)
                if (popupSnap != -1) putInt(PREF_FEEL_POPUP_SNAP, popupSnap)
            }.apply()
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    /** Persist the UI language choice independently of the input mode. */
    @JavascriptInterface
    fun setUiLanguage(choice: String, token: String) = guarded(token) {
        if (!UiLanguage.setChoice(context, choice)) {
            pushEvent(
                JSONObject()
                    .put("type", "uiLanguageError")
                    .put("code", "BAD_UI_LANGUAGE")
                    .put("message", t(context, "界面语言选项无效", "Invalid interface language choice")),
            )
            return@guarded
        }
        // The preference listener also refreshes an already-open page (and
        // notifies the IME service); this direct push guarantees a response
        // even when Android dispatches the listener on a later main-loop turn.
        pushState()
        host.onSettingsChanged()
    }

    @JavascriptInterface
    fun setAutoUpdateCheck(enabled: Boolean, token: String) = guarded(token) {
        context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
            .edit().putBoolean(STATE_AUTO_CHECK_ENABLED, enabled).apply()
        pushState()
        if (enabled) maybeAutoCheck()
    }

    /** 诊断记录开关（双拼字母直上屏故障分析）：打开后 IME 采集引擎
     *  降级链路事件（不含任何文本内容），「复制诊断信息」导出。 */
    @JavascriptInterface
    fun setDiagnostics(on: Boolean, token: String) = guarded(token) {
        Diagnostics.setEnabled(context, on)
        pushState()
    }

    /** 组装诊断导出为文本文件并弹出系统分享面板（微信/邮件等均可收），
     *  返回文件名供 JS 提示。不再进剪贴板（2026-09-18 用户反馈）。 */
    @JavascriptInterface
    fun exportDiagnostics(token: String) = guarded(token) {
        val events = Diagnostics.snapshot()
        val header = listOf(
            "Feelime 诊断导出 ${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
                .format(java.util.Date())}",
            "app=${BuildConfig.VERSION_NAME} keyboard=${keyboardVersion()} " +
                "android=${android.os.Build.VERSION.SDK_INT} device=${android.os.Build.MODEL}",
            Diagnostics.liveState,
            "events=${Diagnostics.totalLogged()} logged, ${events.size} lines exported",
            "--- events ---",
        )
        val text = (header + events).joinToString("\n")
        val stamp = java.text.SimpleDateFormat("yyyyMMdd-HHmmss", java.util.Locale.US)
            .format(java.util.Date())
        val file = File(File(context.cacheDir, "exports"), "feelime-diagnostics-$stamp.txt")
        file.parentFile?.mkdirs()
        file.writeText(text)
        Handler(Looper.getMainLooper()).post {
            runCatching {
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, file.name)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                // IME service 无任务栈，分享面板必须 NEW_TASK
                context.startActivity(
                    Intent.createChooser(send, file.name)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }.onFailure { Log.w(TAG, "exportDiagnostics failed", it) }
        }
    }

    @JavascriptInterface
    fun downloadModel(id: String, token: String) = guarded(token) {
        val model = modelStore.manifest().models.firstOrNull { it.id == id } ?: return@guarded
        val result = modelDownloadGate.request(modelRequest(model), networkDecision())
        when (result.action) {
            ModelDownloadGateAction.START -> startModelDownload(model)
            ModelDownloadGateAction.ASK -> {
                val request = result.request ?: return@guarded
                pushEvent(
                    JSONObject()
                        .put("type", "modelDownloadConfirmation")
                        .put("id", request.id)
                        .put("name", request.name)
                        .put("bytes", request.bytes),
                )
            }
            ModelDownloadGateAction.NO_NETWORK -> pushModelError(id, "NO_NETWORK")
            ModelDownloadGateAction.REJECTED,
            ModelDownloadGateAction.STALE -> pushModelError(id, "STALE_CONFIRMATION")
        }
    }

    @JavascriptInterface
    fun openModelDocument(id: String, token: String) = guarded(token) {
        if (modelStore.manifest().models.any { it.id == id }) host.openModelDocument(id)
        else pushModelError(id, "MODEL_IMPORT_FAILED", "未知模型")
    }

    /** Select a local ZIP through Android's document provider. This path never
     * constructs a URL or enters the network downloader. */
    @JavascriptInterface
    fun openKeyboardDocument(token: String) = guarded(token) {
        host.openKeyboardDocument()
    }

    @JavascriptInterface
    fun addImeShortcut(token: String) = guarded(token) { host.addImeShortcut() }

    @JavascriptInterface
    fun addImeTile(token: String) = guarded(token) { host.addImeTile() }

    @JavascriptInterface

    /** Called by SetupActivity after the local keyboard ZIP picker returns. */
    fun installKeyboardFromUri(uri: Uri) {
        if (closed) return
        runCatching {
            worker.execute {
                if (closed) return@execute
                // 接受新导入请求即作废旧待确认包（§3）：读取/安装期间旧确认失效。
                invalidatePendingInstall()
                runCatching {
                    val read = runCatching {
                        context.contentResolver.openInputStream(uri)?.let(KeyboardPackageReader::read)
                            ?: throw java.io.IOException("selected document has no readable stream")
                    }
                    when {
                        read.isFailure -> {
                            failUpdate("IO_ERROR", read.exceptionOrNull()?.message ?: "local package")
                        }
                        read.getOrThrow() is KeyboardPackageReader.Result.TooLarge -> {
                            failUpdate("ZIP_TOO_LARGE", "${KeyboardPackageReader.MAX_BYTES} bytes")
                        }
                        else -> {
                            val bytes = (read.getOrThrow() as KeyboardPackageReader.Result.Ok).bytes
                            installWithConsent(bytes)
                        }
                    }
                    pushState()
                }.onFailure { failure ->
                    // Match the network install path: a write/activation or
                    // broadcast failure must leave a durable error and a
                    // visible state update instead of disappearing in the worker.
                    failUpdate("INTERNAL_ERROR", failure.javaClass.simpleName)
                }
            }
        }.onFailure { failure ->
            failUpdate("IO_ERROR", failure.message ?: "local package")
        }
    }

    // ---- userdata backup (docs/design/userdata.md §1) ---------------------

    @JavascriptInterface
    fun exportUserdata(token: String) = guarded(token) { host.createBackupDocument() }

    @JavascriptInterface
    fun openBackupDocument(token: String) = guarded(token) { host.openBackupDocument() }

    /** 设置页的 CreateDocument 回调：组包后写入选定位置。 */
    fun writeUserdataBackupToUri(uri: Uri) {
        if (closed) return
        runCatching {
            worker.execute {
                if (closed) return@execute
                runCatching {
                    val json = UserdataBackup(AndroidPrefs(context), context.filesDir, appVersion())
                        .export()
                    context.contentResolver.openOutputStream(uri, "wt")?.use { output ->
                        output.write(json.toString().toByteArray(Charsets.UTF_8))
                        output.flush()
                    } ?: throw java.io.IOException("selected document has no writable stream")
                    pushEvent(JSONObject().put("type", "backupStatus").put("direction", "export").put("ok", true))
                }.onFailure { failure ->
                    Log.w(TAG, "userdata export failed", failure)
                    pushEvent(
                        JSONObject().put("type", "backupStatus").put("direction", "export")
                            .put("ok", false).put("code", "IO_ERROR"),
                    )
                }
            }
        }
    }

    /** 设置页的 OpenDocument 回调：校验 kind/version 后恢复。settings 立即
     * 生效；userdb 暂存并广播给 IME，由它在关会话→换目录→开新会话的
     * 中间点换入（TextInputCoordinator.recreateEngineSession）。 */
    fun restoreUserdataBackupFromUri(uri: Uri) {
        if (closed) return
        runCatching {
            worker.execute {
                if (closed) return@execute
                runCatching {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
                        // 有界读取：超出上限即拒绝，不把整个文件吃进内存。
                        val buffer = java.io.ByteArrayOutputStream()
                        val chunk = ByteArray(64 * 1024)
                        var total = 0L
                        while (true) {
                            val read = input.read(chunk)
                            if (read < 0) break
                            total += read
                            if (total > MAX_BACKUP_BYTES) {
                                throw java.io.IOException("backup too large")
                            }
                            buffer.write(chunk, 0, read)
                        }
                        buffer.toByteArray()
                    } ?: throw java.io.IOException("selected document has no readable stream")
                    val result = UserdataBackup(AndroidPrefs(context), context.filesDir).restore(bytes)
                    if (result is UserdataBackup.RestoreResult.Fail) {
                        pushEvent(
                            JSONObject().put("type", "backupStatus").put("direction", "import")
                                .put("ok", false).put("code", result.code),
                        )
                    } else {
                        com.feelime.ime.panel.PanelStoreSignals.fireFavoritesChanged()
                        // 不带词库的备份也要广播：键盘页要刷新运行时设置；
                        // 页面不在时 rev 协议保证下次握手仍会拉到恢复值。
                        context.sendBroadcast(
                            Intent(ACTION_USERDATA_RESTORED).setPackage(context.packageName),
                        )
                        pushEvent(
                            JSONObject().put("type", "backupStatus").put("direction", "import").put("ok", true),
                        )
                    }
                    pushState()
                }.onFailure { failure ->
                    Log.w(TAG, "userdata import failed", failure)
                    pushEvent(
                        JSONObject().put("type", "backupStatus").put("direction", "import")
                            .put("ok", false).put("code", "IO_ERROR"),
                    )
                }
            }
        }
    }

    /** 从哪版 App 导出（信息性，恢复不依赖）。 */
    private fun appVersion(): String = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
    }.getOrDefault("")

    /** 签名不符的确认导入（设计 §3）：凭 id 只认最近一次暂存的
     * SIGNATURE_BAD 包（本地导入 / URL 下载同路）；一次确认装一份，
     * 装完/取消即弃。URL 路径的 sha256= 钉扎随包重放。 */
    @JavascriptInterface
    fun confirmKeyboardInstall(id: String, token: String) = guarded(token) {
        val pending = takePendingInstall(id)
        if (pending == null) {
            pushUpdateError("NO_PENDING_PACKAGE", "")
            return@guarded
        }
        worker.execute {
            if (closed) return@execute
            runCatching {
                val result = KeyboardUpdateCenter.store(context).install(
                    pending.bytes, fragmentPin = pending.pin, confirmBadSignature = true)
                if (result is KeyboardStore.InstallResult.Ok) {
                    KeyboardUpdateCenter.notifyUpdated(context)
                } else if (result is KeyboardStore.InstallResult.Fail) {
                    pushUpdateError(result.code.name, result.detail)
                }
                pushState()
            }.onFailure { failure ->
                failUpdate("INTERNAL_ERROR", failure.javaClass.simpleName)
            }
        }
    }

    /** 用户取消签名确认：作废待确认包，避免旧包残留到下一次操作；
     * 带着旧 id 的迟到取消不动更新的请求。 */
    @JavascriptInterface
    fun dismissKeyboardInstall(id: String, token: String) = guarded(token) {
        synchronized(pendingLock) {
            val pending = pendingKeyboardInstall
            if (id.isEmpty() || pending == null || id == pending.id) {
                pendingKeyboardInstall = null
            }
        }
    }

    /** 短摘要作为确认请求 id（绑定「这一份包」，而非「随便哪份」）。 */
    private fun pendingRequestId(bytes: ByteArray): String =
        KeyboardPackageVerifier.sha256Hex(bytes).take(16)

    @JavascriptInterface
    fun confirmModelDownload(id: String, approved: Boolean, token: String) = guarded(token) {
        val result = modelDownloadGate.confirm(id, approved)
        when (result.action) {
            ModelDownloadGateAction.START -> {
                val model = modelStore.manifest().models.firstOrNull { it.id == id }
                when {
                    model == null -> pushModelError(id, "STALE_CONFIRMATION")
                    networkDecision() == NetworkDownloadDecision.NO_NETWORK -> pushModelError(id, "NO_NETWORK")
                    else -> startModelDownload(model, allowMetered = true)
                }
            }
            ModelDownloadGateAction.REJECTED -> Unit
            ModelDownloadGateAction.STALE,
            ModelDownloadGateAction.NO_NETWORK,
            ModelDownloadGateAction.ASK -> pushModelError(id, "STALE_CONFIRMATION")
        }
    }

    @JavascriptInterface
    fun cancelModelDownload(token: String) = guarded(token) {
        modelDownloadGate.cancelPending()
        synchronized(lifecycleLock) {
            modelStore.cancelDownload()
            modelDownloadNetwork?.cancelByUser()
        }
    }

    /** Called by SetupActivity after ACTION_OPEN_DOCUMENT returns. */
    fun importModelFromUri(id: String, uri: Uri) = synchronized(lifecycleLock) {
        if (closed) return
        val model = modelStore.manifest().models.firstOrNull { it.id == id }
        if (model == null) {
            pushModelError(id, "MODEL_IMPORT_FAILED", "未知模型")
            return
        }
        startModelImport(model, uri)
    }

    @JavascriptInterface
    fun deleteModel(id: String, token: String) = guarded(token) {
        val model = modelStore.manifest().models.firstOrNull { it.id == id } ?: return@guarded
        modelStore.delete(model)
        pushState()
        notifyModelsChanged()
    }

    /** 见 [ACTION_MODELS_CHANGED]：IME 重推 hello 让 engineDataReady 跟上。 */
    private fun notifyModelsChanged() {
        context.sendBroadcast(
            android.content.Intent(ACTION_MODELS_CHANGED).setPackage(context.packageName),
        )
    }

    @JavascriptInterface
    fun saveAsrSettings(stripPeriod: Boolean, hotwords: String, token: String) = guarded(token) {
        val lines = hotwords.lines().map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        val kept = lines
            .filter { it.length <= AsrHotwords.MAX_CHARS_PER_LINE }
            .take(AsrHotwords.MAX_LINES)
        asrPrefs().edit()
            .putBoolean(AsrSettings.KEY_STRIP_FINAL_PERIOD, stripPeriod)
            .putString(AsrSettings.KEY_HOTWORDS, kept.joinToString("\n"))
            .apply()
        // Silently dropping over-long/extra lines looked like the
        // user's input vanishing - name what was kept instead.
        if (kept.size < lines.size) {
            pushEvent(
                JSONObject()
                    .put("type", "asrNote")
                    .put(
                        "message",
                        t(
                            context,
                            "已保存，但超长/超量的 ${lines.size - kept.size} 行热词被忽略（上限 ${AsrHotwords.MAX_LINES} 行，每行 ${AsrHotwords.MAX_CHARS_PER_LINE} 字）",
                            "Saved, but ${lines.size - kept.size} oversized or extra hotword lines were ignored (up to ${AsrHotwords.MAX_LINES} lines, ${AsrHotwords.MAX_CHARS_PER_LINE} characters per line)",
                        ),
                    )
            )
        }
        pushState()
    }

    /** Sub-page presence for the shell's BACK callback. */
    @JavascriptInterface
    fun reportPage(page: String, token: String) = guarded(token) {
        // 页名而非布尔（issue #17 三级页）：系统 BACK 按 phrases → input →
        // home 逐级返回；旧页面布尔协议与壳同 APK 发布，无兼容窗口。
        subPageName = page
        onSubPage = page != "home" && page.isNotBlank()
    }

    /** The about page's one-tap version report. The clip is
     * flagged sensitive on API 33+ so the keyboard's clipboard history does
     * not absorb it; older releases just copy (flag unknown, never throws). */
    @JavascriptInterface
    fun copyText(text: String, token: String) = guarded(token) {
        // @JavascriptInterface runs on the WebView bridge thread; clipboard
        // focus checks are per-window, so marshal to the main thread like
        // the other host-visible actions.
        Handler(Looper.getMainLooper()).post {
            runCatching {
                val clip = ClipData.newPlainText("feelime", text)
                if (Build.VERSION.SDK_INT >= 33) {
                    clip.description.extras = PersistableBundle().apply {
                        putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                    }
                }
                clipboardManager().setPrimaryClip(clip)
            }.onFailure { Log.w(TAG, "copyText failed", it) }
        }
    }

    private fun clipboardManager() =
        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    /** §15: the custom-keyboard table editor. Loose structural validation
     * here; the IME re-validates on adoption (single validator lives in
     * keyboard.js). */
    @JavascriptInterface
    fun saveCustom(json: String, enabled: Boolean, token: String) = guarded(token) {
        val parsed = runCatching { JSONObject(json) }.getOrNull()
        val rows = parsed?.optJSONArray("rows")
        if (parsed == null || parsed.optInt("version", 0) != 1 || rows == null) {
            pushEvent(
                JSONObject()
                    .put("type", "customError")
                    .put("code", "INVALID_CUSTOM_JSON")
                    .put("message", t(context, "JSON 需为 {\"version\":1,\"rows\":[[...]]}", "JSON must be {\"version\":1,\"rows\":[[...]]}")),
            )
            return@guarded
        }
        customKeysStore.save(json, enabled)
        pushState()
        // 验收 2026-09-24：不发广播键盘 hello 不重推，localStorage 镜像不
        // 刷新，符号页的「定制」tab 要等键盘进程重启才出现。
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
    }

    /** 快捷设置入口外移（验收 2026-09-24）：键盘选择（长按菜单内容）与
     *  快捷切换对在设置页管理。真相源仍是键盘 localStorage + pushStores
     *  原生镜像（备份走原生）；设置页写同一镜像（rev+1），广播后键盘
     *  hello 的 pullStores 按 rev 落地。 */
    @JavascriptInterface
    fun saveKeyboardSelection(menuJson: String, pairJson: String, token: String) = guarded(token) {
        fun allStrings(json: String): Boolean = try {
            val array = JSONArray(json)
            var ok = true
            for (i in 0 until array.length()) {
                if (array.opt(i) !is String) ok = false
            }
            ok
        } catch (_: Exception) {
            false
        }
        val menuOk = allStrings(menuJson)
        val pairOk = allStrings(pairJson)
        if (!menuOk || !pairOk) {
            pushEvent(
                JSONObject()
                    .put("type", "keyboardsError")
                    .put("code", "BAD_KEYBOARD_SELECTION")
                    .put("message", t(context, "键盘选择数据格式错误", "Invalid keyboard selection data")),
            )
            return@guarded
        }
        val values = JSONObject()
            .put("feelime_menu_modes", menuJson)
            .put("feelime_quick_pair", pairJson)
        val mirror = storesMirror()
        val merged = mirror.optJSONObject("values") ?: JSONObject()
        for (key in values.keys()) merged.put(key, values.get(key))
        com.feelime.ime.backup.AndroidPrefs(context).put(
            com.feelime.ime.backup.UserdataBackup.WEBVIEW_PREFS,
            com.feelime.ime.backup.UserdataBackup.WEBVIEW_KEY,
            JSONObject()
                .put("rev", mirror.optInt("rev", 0) + 1)
                .put("values", merged)
                .toString(),
        )
        context.sendBroadcast(
            Intent(ACTION_KEYBOARD_PREFS_CHANGED).setPackage(context.packageName),
        )
        pushState()
    }

    private fun keyboardsState(): JSONObject {
        val values = storesMirror().optJSONObject("values") ?: JSONObject()
        return JSONObject()
            .put("menuModes", values.optString("feelime_menu_modes", ""))
            .put("quickPair", values.optString("feelime_quick_pair", ""))
    }

    /** webview stores 原生镜像（与 ImeBridge.pushStores 同一存储）。 */
    private fun storesMirror(): JSONObject {
        val raw = com.feelime.ime.backup.AndroidPrefs(context)
            .all(com.feelime.ime.backup.UserdataBackup.WEBVIEW_PREFS)
            .get(com.feelime.ime.backup.UserdataBackup.WEBVIEW_KEY) as? String
        return runCatching { JSONObject(raw ?: "{}") }.getOrDefault(JSONObject())
    }

    @JavascriptInterface
    fun checkUpdate(sourceUrl: String, token: String) = guarded(token) {
        val prefs = context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
        val entered = sourceUrl.trim()
        // An explicit empty value is the user's opt-out. It remains distinct
        // from an absent preference, which uses the official default source.
        prefs.edit().putString(KeyboardStore.STATE_SOURCE_URL, entered).apply()
        pushState()
        startUpdateCheck(entered.ifBlank { DEFAULT_GITHUB_SOURCE })
    }

    /** Run the opt-in startup check at most once per 24 hours. The timestamp
     * is written before the request, so failures and offline devices do not
     * cause a retry storm on every settings-page launch. */
    private fun maybeAutoCheck() {
        val prefs = context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
        if (!prefs.getBoolean(STATE_AUTO_CHECK_ENABLED, false)) return
        val sourceConfigured = prefs.contains(KeyboardStore.STATE_SOURCE_URL)
        val savedSource = prefs.getString(KeyboardStore.STATE_SOURCE_URL, "") ?: ""
        if (sourceConfigured && savedSource.isBlank()) return
        val now = System.currentTimeMillis()
        val last = prefs.getLong(STATE_AUTO_CHECK_LAST_ATTEMPT_AT, 0L)
        if (!UpdateCheckThrottle.isDue(
                enabled = true,
                sourceConfigured = sourceConfigured,
                source = savedSource,
                nowMs = now,
                lastAttemptMs = last,
            )) return
        prefs.edit().putLong(STATE_AUTO_CHECK_LAST_ATTEMPT_AT, now).apply()
        pushState()
        startUpdateCheck(if (sourceConfigured) savedSource else DEFAULT_GITHUB_SOURCE)
    }

    private fun startUpdateCheck(sourceUrl: String) {
        // Both channels may install a signed HTML/CSS/JS keyboard package.
        // Native APK updates have no path through this bridge; Play app
        // updates remain the store's responsibility.
        val source = sourceUrl.trim().ifBlank { DEFAULT_GITHUB_SOURCE }
        val github = GithubReleaseSource(HttpUrlConnectionFactory())
        worker.execute {
            runCatching {
                setState(KeyboardStore.STATE_UPDATE_STATE, "DOWNLOADING")
                pushState()
                if (github.accepts(source)) {
                    when (val result = github.fetch(source)) {
                        is GithubReleaseSource.GithubResult.Error -> failUpdate(result.code, result.message)
                        is GithubReleaseSource.GithubResult.Release -> {
                            if (result.isMetainfo) {
                                resolveAndInstallMetainfo(result.installUrl)
                            } else {
                                installResolved(result.installUrl)
                            }
                        }
                    }
                } else {
                    resolveAndInstallMetainfo(source)
                }
            }.onFailure { failure ->
                failUpdate("INTERNAL_ERROR", failure.javaClass.simpleName)
            }
        }
    }

    /** Metainfo update flow: uncached fetch → parse → install the zip it
     * points at (signature fragment pin intact). */
    private fun resolveAndInstallMetainfo(metainfoUrl: String) {
        val downloader = KeyboardUpdateDownloader(
            HttpUrlConnectionFactory(),
            allowHttp = BuildConfig.DEBUG && !BuildConfig.PLAY_DISTRIBUTION,
        )
        when (val meta = downloader.download(URI(metainfoUrl))) {
            is KeyboardUpdateDownloader.Result.Fail -> {
                failUpdate(meta.code.name, "metainfo: ${meta.detail.take(180)}")
            }
            is KeyboardUpdateDownloader.Result.Ok -> {
                val info = UpdateMetainfo.parse(String(meta.bytes, Charsets.UTF_8))
                if (info.url.isNullOrBlank()) {
                    failUpdate("INTERNAL_ERROR", "metainfo 里没有 url 字段")
                } else {
                    installResolved(info.url.trim())
                }
            }
        }
    }

    @JavascriptInterface
    fun installZip(url: String, token: String) = guarded(token) {
        if (url.isBlank()) {
            pushUpdateError(
                "MISSING_PACKAGE_URL",
                t(context, "请先填入键盘包地址", "Enter a keyboard package URL first"),
            )
            return@guarded
        }
        worker.execute {
            runCatching {
                installResolved(url.trim())
            }.onFailure { failure ->
                failUpdate("INTERNAL_ERROR", failure.javaClass.simpleName)
            }
        }
    }

    @JavascriptInterface
    fun restoreBuiltInKeyboard(token: String) = guarded(token) {
        worker.execute {
            runCatching {
                KeyboardUpdateCenter.store(context).restoreBuiltIn()
                setState(KeyboardStore.STATE_UPDATE_STATE, "BUILT_IN")
                KeyboardUpdateCenter.notifyUpdated(context)
            }.onFailure { Log.w(TAG, "restoreBuiltIn failed", it) }
            pushState()
        }
    }

    /** 定制键盘 JSON 说明文档（#29-8）：固定官方地址。 */
    @JavascriptInterface
    fun openDocs(token: String) = guarded(token) {
        runCatching {
            context.startActivity(
                android.content.Intent(
                    android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse("https://feelime.github.io/custom-keyboard.html"),
                ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    /** 关于页开源仓库入口（#29-4）：只认内置两址（仓库/issues），
     *  不收任意 URL——设置页 WebView 不该能驱动任意 intent 跳转。 */
    @JavascriptInterface
    fun openGithub(page: String, token: String) = guarded(token) {
        val url = when (page) {
            "issues" -> "https://github.com/feelime/feelime/issues"
            else -> "https://github.com/feelime/feelime"
        }
        runCatching {
            context.startActivity(
                android.content.Intent(
                    android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse(url),
                ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    /** §16: play builds route update actions to the store listing. */
    private fun openPlayListing() {
        val pkg = context.packageName
        val intents = listOf(
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=$pkg")),
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://play.google.com/store/apps/details?id=$pkg")),
        )
        for (intent in intents) {
            try {
                context.startActivity(intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (_: android.content.ActivityNotFoundException) {
                // try the next transport
            }
        }
        // AOSP builds and restricted work profiles may provide neither a Play
        // market handler nor a browser. Make the failure visible instead of
        // turning the button into a silent no-op.
        Handler(Looper.getMainLooper()).post {
            android.widget.Toast.makeText(
                context,
                t(context, "未找到可打开应用商店的应用", "No app is available to open the app store"),
                android.widget.Toast.LENGTH_SHORT,
            ).show()
        }
    }

    /** The keyboard install flow (metainfo-resolved or direct zip URL). */
    // ---- §3 待确认包：整体发布/取走，避免 bridge 线程与 worker 交错 ----

    private fun invalidatePendingInstall() = synchronized(pendingLock) {
        pendingKeyboardInstall = null
    }

    /** 确认/取消按 id 整体取走；旧 id 只拒绝自身，不清掉更新的请求。 */
    private fun takePendingInstall(id: String): PendingKeyboardInstall? = synchronized(pendingLock) {
        val pending = pendingKeyboardInstall ?: return null
        if (id.isEmpty() || id != pending.id) return null
        pendingKeyboardInstall = null
        pending
    }

    private fun publishPendingInstall(install: PendingKeyboardInstall) = synchronized(pendingLock) {
        if (!closed) pendingKeyboardInstall = install
    }

    /** 设置页两条导入入口（本地 SAF 导入 / URL 下载安装）共用的安装：
     * SIGNATURE_BAD 时留包待确认，设置页弹确认后凭同一 id 走
     * confirmKeyboardInstall（设计 docs/design/userdata.md §3）；其余失败
     * 直接报错。每次新的安装尝试作废上一份待确认包：确认框永远只对应
     * 最近一次 SIGNATURE_BAD。 */
    private fun installWithConsent(bytes: ByteArray, fragmentPin: String? = null) {
        invalidatePendingInstall()
        when (val result = KeyboardUpdateCenter.store(context)
            .install(bytes, fragmentPin = fragmentPin)) {
            is KeyboardStore.InstallResult.Ok ->
                KeyboardUpdateCenter.notifyUpdated(context)
            is KeyboardStore.InstallResult.Fail -> {
                if (result.code == KeyboardUpdateErrorCode.SIGNATURE_BAD) {
                    val id = pendingRequestId(bytes)
                    publishPendingInstall(PendingKeyboardInstall(bytes, id, fragmentPin))
                    pushUpdateError(
                        result.code.name, result.detail,
                        confirmable = true, confirmId = id,
                    )
                } else {
                    pushUpdateError(result.code.name, result.detail)
                }
            }
        }
    }

    private fun installResolved(resolvedUrl: String) {
        val store = KeyboardUpdateCenter.store(context)
        val prefs = context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
        store.state.put(KeyboardStore.STATE_UPDATE_URL, resolvedUrl)
        // 接受新安装请求即作废旧待确认包（§3）：下载期间旧确认失效。
        invalidatePendingInstall()
        val url = URI(resolvedUrl)
        val fragmentPin = url.rawFragment
            ?.takeIf { it.startsWith("sha256=") }
            ?.removePrefix("sha256=")
        prefs.edit().putString(KeyboardStore.STATE_UPDATE_STATE, "DOWNLOADING").apply()
        pushState()
        val downloader = KeyboardUpdateDownloader(
            HttpUrlConnectionFactory(),
            allowHttp = BuildConfig.DEBUG && !BuildConfig.PLAY_DISTRIBUTION,
        )
        when (val download = downloader.download(url)) {
            is KeyboardUpdateDownloader.Result.Fail -> failUpdate(download.code.name, download.detail.take(200))
            is KeyboardUpdateDownloader.Result.Ok ->
                installWithConsent(download.bytes, fragmentPin)
        }
        pushState()
    }

    private fun setState(key: String, value: String) {
        context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
            .edit().putString(key, value).apply()
    }

    private fun failUpdate(code: String, detail: String) {
        // 任何导入/更新失败都作废待确认包（§3）：确认框只对应最近一次
        // SIGNATURE_BAD，失败后的旧确认请求一律不再有效。
        invalidatePendingInstall()
        val prefs = context.getSharedPreferences("keyboard_update", Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KeyboardStore.STATE_LAST_ERROR_CODE, code)
            .putString(KeyboardStore.STATE_LAST_ERROR_MESSAGE, detail)
            .putString(KeyboardStore.STATE_UPDATE_STATE, "FAILED")
            .apply()
        // Worker failures use the same stable code/message protocol as
        // immediate validation failures.  Keep raw detail separate so it can
        // aid diagnosis without making the user-facing sentence language
        // dependent on whichever exception/network stack produced it.
        pushEvent(
            JSONObject()
                .put("type", "updateError")
                .put("code", code)
                .put("message", updateErrorMessage(code, ""))
                .put("detail", detail),
        )
        pushState()
    }

    private fun pushUpdateError(
        code: String,
        message: String,
        confirmable: Boolean = false,
        confirmId: String = "",
    ) {
        pushEvent(
            JSONObject()
                .put("type", "updateError")
                .put("code", code)
                .put("message", message)
                .put("confirmable", confirmable)
                .put("confirmId", confirmId),
        )
    }

    // ---- plumbing --------------------------------------------------------

    private fun guarded(token: String, body: () -> Unit) {
        if (closed) return
        if (pageToken.isEmpty() || token != pageToken) {
            Log.w(TAG, "settings bridge call rejected (bad token)")
            return
        }
        body()
    }

    private companion object {
        const val TAG = "FeelimeSettings"
        const val DEFAULT_GITHUB_SOURCE = "https://github.com/feelime/feelime"
        const val STATE_AUTO_CHECK_ENABLED = "update_auto_check_enabled"
        const val STATE_AUTO_CHECK_LAST_ATTEMPT_AT = "update_auto_check_last_attempt_at"

        /** 备份文件大小上限：userdb base64 后通常几百 KB，给到 64MB 防呆。 */
        const val MAX_BACKUP_BYTES = 64 * 1024 * 1024
    }
}

/** Android may persist a component as either `pkg/.Service` or
 * `pkg/pkg.Service`; compare both forms without relying on a particular
 * Settings provider's flattening choice. */
internal fun matchesDefaultImeComponent(
    flat: String?,
    packageName: String,
    serviceClassName: String,
): Boolean {
    val value = flat?.trim().orEmpty()
    val slash = value.indexOf('/')
    if (slash <= 0 || slash == value.lastIndex) return false
    if (value.substring(0, slash) != packageName) return false
    val classPart = value.substring(slash + 1)
    val shortName = serviceClassName.removePrefix("$packageName.")
    return classPart == serviceClassName ||
        classPart == ".$shortName" ||
        classPart == shortName
}

/** Pure daily-check policy so the preference distinction is JVM-testable. */
internal object UpdateCheckThrottle {
    const val INTERVAL_MS = 24L * 60L * 60L * 1_000L

    fun isDue(
        enabled: Boolean,
        sourceConfigured: Boolean,
        source: String,
        nowMs: Long,
        lastAttemptMs: Long,
    ): Boolean {
        if (!enabled) return false
        if (sourceConfigured && source.isBlank()) return false
        // Zero is the persisted "never attempted" sentinel.  Keep any other
        // timestamp (including synthetic negative values used by JVM tests)
        // as a real attempt so a failed request still consumes the full day
        // budget instead of being retried immediately.
        if (lastAttemptMs == 0L) return true
        val elapsed = nowMs - lastAttemptMs
        return elapsed >= INTERVAL_MS
    }
}

/** design §15: native single source of truth for the custom keyboard
 * table (the IME WebView mirrors it through its bridge). */
class CustomKeysStore(private val context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun json(): String = prefs.getString(KEY_JSON, "") ?: ""

    fun enabled(): Boolean = prefs.getBoolean(KEY_ENABLED, true)

    fun summary(): String = summary(null)

    fun summary(context: Context?): String {
        val raw = json()
        val noCustom = if (context == null) "未定制" else t(context, "未定制", "No custom keys")
        if (raw.isEmpty()) return noCustom
        val rows = runCatching { JSONObject(raw).optJSONArray("rows") }.getOrNull() ?: return noCustom
        var count = 0
        for (row in rows.iterate()) count += row.length()
        return if (context == null) "已定制 $count 个键"
        else t(context, "已定制 $count 个键", "$count custom keys")
    }

    fun save(json: String, enabled: Boolean) {
        prefs.edit().putString(KEY_JSON, json).putBoolean(KEY_ENABLED, enabled).apply()
    }

    private fun JSONArray.iterate(): Sequence<JSONArray> = sequence {
        for (index in 0 until length()) yield(optJSONArray(index) ?: JSONArray())
    }

    private companion object {
        const val PREFS = "feelime_custom_keys"
        const val KEY_JSON = "json"
        const val KEY_ENABLED = "enabled"
    }
}
