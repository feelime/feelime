package com.feelime.ime

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.provider.Settings
import android.content.pm.PackageManager
import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import com.feelime.ime.engine.DirectTextEngine
import com.feelime.ime.engine.InputConnectionEditorPort
import com.feelime.ime.engine.InputMode
import com.feelime.ime.engine.TextInputCoordinator
import com.feelime.ime.update.BridgeContract
import com.feelime.ime.update.KeyboardUpdateCenter
import java.security.SecureRandom
import java.util.ArrayDeque
import org.json.JSONArray
import org.json.JSONObject

class FeelimeService : InputMethodService(), AsrEngine.Listener {
    private val main = Handler(Looper.getMainLooper())
    private val background = java.util.concurrent.Executors.newSingleThreadExecutor()
    /** getExtractedText is a synchronous editor RPC. Keep it off the IME
     * main thread; one scrub call handles its whole bounded delta. */
    private val cursorQueryExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    private lateinit var engine: AsrEngine
    private lateinit var editorPort: InputConnectionEditorPort
    private lateinit var coordinator: TextInputCoordinator
    private lateinit var clipboardStore: com.feelime.ime.panel.ClipboardStore
    private lateinit var favoritesStore: com.feelime.ime.panel.FavoritesStore
    private var keyboardView: WebView? = null
    /** 按键音（issue #5 问题 2）合成器：实例化开销高，懒加载复用，
     *  onDestroy 释放。 */
    private var keyTone: ToneGenerator? = null
    /** Host of [keyboardView]; re-measured when keyboard-side prefs change
     *  while the keyboard is already visible (bottom pad, mode-fallback §3). */
    private var inputViewHost: FixedHeightInputView? = null
    /** Bumped by keyboard-pref changes; the next show re-measures (a
     *  requestLayout issued while the input view is hidden has no effect —
     *  the height stale-read until this epoch check fires on show). */
    private var keyboardPrefsEpoch = 0
    private var appliedKeyboardPrefsEpoch = 0
    private var assetStore: KeyboardAssetStore? = null
    private var state = VoiceState.IDLE
    private var acceptAsrResults = false
    private var composing = false
    private var level = 0f
    private var currentPartial = ""
    /** One composing span owns the complete voice session. Keeping endpoint
     * segments here makes cancellation able to remove the whole recording. */
    private data class VoiceSession(
        val editorGeneration: Long,
        /** Null means the host reported a non-empty selection but did not
         * expose its text. In that case voice text stays buffered until the
         * user normally stops, so cancellation cannot erase unknown text. */
        val originalSelection: String?,
        val streamToEditor: Boolean,
        var finalizedText: String = "",
        var text: String = "",
        var composingApplied: Boolean = false,
        var cancelled: Boolean = false,
    )
    private var voiceSession: VoiceSession? = null
    private var voiceStartPending = false
    private var voiceCancelRequested = false
    private var voiceStartEditorGeneration = -1L
    private var voiceRequestId = 0L
    private var voiceStartRequestId = 0L
    private var inputConnectionGeneration = 0L
    private var cursorQueryGeneration = 0L
    private val pendingCursorDeltas = ArrayDeque<Int>()
    private var cursorQueryActive = false
    private var cursorQueryRequest = 0L
    private val cursorSnapshotSupport = CursorSnapshotSupport()
    private val expectedCursorSelections = ArrayDeque<Pair<Int, Int>>()
 // Set while a keyboard-panel input (phrase add/edit) has
    // focus. The system InputConnection always belongs to the host app
    // editor - a WebView input inside the IME's own view never re-routes
    // it - so editor writes must be redirected back into the panel input.
    @Volatile private var panelInputActive = false
    private var panelComposeSupported = false
    private var panelInputRequested = false
    private var panelRouteGeneration = 0L
    private var panelSession = 0
    private var pendingPanelSelection: Triple<Int, Int, Int>? = null
    private var hostSelectionStart = -1
    private var hostSelectionEnd = -1

    // Bridge handshake state (design section 5.3). A fresh random token is
    // minted per page load; every call must carry the live token.
    private var pageToken = ""
    private var pageReady = false
    private var rejectedCalls = 0L
    private var servedRevision = ""
    private val callTimes = ArrayDeque<Long>()
 // Runtime keyboard height (PHYSICAL px; 0 = the 272dp
    // default). The user drags the keyboard's top edge in quick settings;
    // the value persists per orientation in feelime_keyboard prefs.
    private var keyboardHeightOverride = 0
 // A: drag-time setKeyboardHeight calls coalesce into one pref
    // commit (see setKeyboardHeight).
    private var pendingHeightWrite = 0
 // Review P3-4: the slot is decided when the value is DRAGGED,
    // not when the debounce fires - a mid-drag rotation must not file the
    // old orientation's height under the new one.
    private var pendingHeightLandscape = false
 // A popup moved into the float band above the keyboard; the
    // band is transparent and NOT touchable until this flips (see
    // onComputeInsets).
    private var overlayOpen = false
    // Last notified bottom safe area; never used as the current measurement.
    private var lastSafeBottom = -1
    // Last bottom inset observed while the keyboard view was actually laid
    // out; the hidden-state fallback reports this instead of guessing.
    private var lastShownSafeBottom = 0
    // JS notified once per settled height value (see FixedHeightInputView).
    private var lastMeasuredHeight = -1
    /** Legacy path only (non-oplus, or insets unavailable): resolved once
     * per process - navigation_bar_height capped at 32dp, -1 = not
     * resolved yet (see effectiveBottomInset). The oplus gesture floor
     * lives in oplusInsetFloor(). */
    private var navInsetFallback = -1
    private var insetWatcherInstalled = false
    // Set while an inset change is pending its settle re-read.
    private var insetChangeConfirmed = false
    private val flushHeightPref = Runnable {
        val px = pendingHeightWrite
        if (px > 0) {
            pendingHeightWrite = 0
            getSharedPreferences("feelime_keyboard", MODE_PRIVATE).edit()
                .putInt(
                    if (pendingHeightLandscape) {
                        "keyboard_height_landscape"
                    } else {
                        "keyboard_height_portrait"
                    },
                    px,
                )
                .apply()
        }
    }
    private val updateReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action == KeyboardUpdateCenter.ACTION_KEYBOARD_UPDATED) reloadKeyboardFiles()
        }
    }

    /** 设置页导入 userdata 备份的收尾（docs/design/userdata.md §1.2）。 */
    private val userdataReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action != ACTION_USERDATA_RESTORED) return
            applyRestoredUserdata()
        }
    }

    /** 设置页切换双拼方案（docs/design/double-pinyin.md §2）：当前就是双拼
     * 会话时立即按新 schema 重建；顺带重推 hello，键盘的解析表与 sep 键
     * 跟着切换。方案落盘在先，非双拼会话下次建会话自然取到。 */
    private val dpSchemeReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action != ACTION_DP_SCHEME_CHANGED) return
            onMain {
                if (coordinator.currentMode == com.feelime.ime.engine.InputMode.DOUBLE_PINYIN) {
                    coordinator.recreateEngineSession { }
                }
                pushBridgeHello()
            }
        }
    }

    /** 设置页切换全拼模糊音（issue #2）：当前就是全拼会话时立即按新
     *  schema 重建；顺带重推 hello。非全拼会话下次建会话自然取到。 */
    private val fuzzyPinyinReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action != ACTION_FUZZY_PINYIN_CHANGED) return
            onMain {
                if (coordinator.currentMode == com.feelime.ime.engine.InputMode.PINYIN) {
                    coordinator.recreateEngineSession { }
                }
                pushBridgeHello()
            }
        }
    }

    /** 设置页保存自定义短语（issue #17）：txt 已落盘，stabledb 只在引擎
     *  生命周期加载一次（session 重建不重读），先整引擎 finalize+init
     *  再重建会话。引擎未起（如刚装完直接进设置页）时只留会话重建。 */
    private val customPhrasesReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action != ACTION_CUSTOM_PHRASES_CHANGED) return
            onMain {
                runCatching {
                    com.feelime.ime.engine.RimeTextEngine.reloadGlobal(applicationContext)
                }
                coordinator.recreateEngineSession { }
                pushBridgeHello()
            }
        }
    }

    /** 设置页改动键盘侧偏好（底部留白/手感参数，mode-fallback §3/§4）：
     *  值已由设置页落盘，这里重推 hello（运行中的键盘即时采用），并让
     *  FixedHeightInputView 按新留白重新测量——否则键盘可见时 JS 立刻把
     *  现有总高扣掉 pad，键行先缩、总高却没变。 */
    private val keyboardPrefsReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action == ACTION_PREVIEW_KEYBOARD) {
                // 外观页预览：设置页请求弹出/收起真实键盘。IME 自己 show
                // self 不依赖编辑焦点（requestShowSelf，API 28+）。
                val show = intent.getBooleanExtra("show", false)
                android.util.Log.i("FeelimeBridge", "previewKeyboard show=$show")
                onMain {
                    if (show && android.os.Build.VERSION.SDK_INT >= 28) {
                        val shown = requestShowSelf(0)
                        android.util.Log.i("FeelimeBridge", "requestShowSelf -> $shown")
                    } else {
                        requestHideSelf(0)
                    }
                }
                return
            }
            if (intent?.action != ACTION_KEYBOARD_PREFS_CHANGED) return
            onMain {
                // 键盘高度也走这份 pref 文件（设置页滑块直接写 pref）：
                // override 是内存态，广播时统一重读，否则写完不生效——
                // 内存 override 只有旋转/启动才重读。
                keyboardHeightOverride = storedKeyboardHeight()
                (keyboardView?.parent as? View)?.requestLayout()
                pushBridgeHello()
                if (readAssociation(this@FeelimeService)) {
                    com.feelime.ime.engine.AssociationStore.prewarm(this@FeelimeService)
                } else {
                    clearAssociation()
                }
                keyboardPrefsEpoch += 1
                inputViewHost?.requestLayout()
            }
        }
    }

    /** 语音权限透明 Activity 的回执（docs/design/userdata.md §2）。 */
    private val voicePermissionReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            when (intent?.action) {
                VoicePermissionActivity.ACTION_VOICE_PERMISSION_GRANTED -> onMain {
                    if (state == VoiceState.ERROR) {
                        state = VoiceState.IDLE
                        startVoice()
                    }
                }
                VoicePermissionActivity.ACTION_VOICE_PERMISSION_DENIED -> onMain {
                    if (state == VoiceState.ERROR) {
                        pushState(
                            message = t(
                                this@FeelimeService,
                                "未授予麦克风权限，可在系统设置或 Feelime 设置中开启",
                                "Microphone permission denied; enable it in system or Feelime settings",
                            ),
                            messageCode = "MIC_PERMISSION_REQUIRED",
                        )
                    }
                }
            }
        }
    }

    /** 换目录必须卡在关会话与开新会话之间（二次 rime 初始化死锁，
     * keyboard.md §8）：recreateEngineSession 的回调就是那个卡点。
     * 之后让常驻键盘页重拉 custom keys（hello 通道），并把恢复的
     * localStorage 级设置当场推下去（页面不在也没关系——rev 协议保证
     * 下次握手仍会拉到恢复值）。 */
    private fun applyRestoredUserdata() = onMain {
        val appPrefs = com.feelime.ime.backup.AndroidPrefs(applicationContext)
        val backup = com.feelime.ime.backup.UserdataBackup(appPrefs, applicationContext.filesDir)
        if (backup.hasPendingUserdb()) {
            coordinator.recreateEngineSession {
                backup.applyPendingUserdb()
                // 恢复的 rime-user 已换入：custom_phrase.txt 按恢复后的
                // json 幂等重派生（老备份可能只有 txt 无 json，或两者
                // 错代），并广播让引擎重载 + 设置页重读 state——否则设置
                // 页还持着恢复前的词表副本，下一次全量保存会把它写回去。
                runCatching {
                    val state = com.feelime.ime.engine.CustomPhraseStore.load(applicationContext)
                    com.feelime.ime.engine.CustomPhraseStore.save(
                        applicationContext, state.enabled, state.items,
                        imported = state.imported,
                    )
                }
                sendBroadcast(
                    android.content.Intent(ACTION_CUSTOM_PHRASES_CHANGED)
                        .setPackage(packageName),
                )
            }
        }
        val mirror = appPrefs.all(com.feelime.ime.backup.UserdataBackup.WEBVIEW_PREFS)
            .get(com.feelime.ime.backup.UserdataBackup.WEBVIEW_KEY) as? String
        val values = runCatching { mirror?.let(::JSONObject)?.optJSONObject("values") }
            .getOrNull()
        if (values != null && values.length() > 0) {
            evaluate(
                "window.Feelime && window.Feelime.onStoresRestored && " +
                    "window.Feelime.onStoresRestored($values)",
            )
        }
        pushBridgeHello()
    }

    /** UI language is shared with SetupActivity. Keep an already visible
     * keyboard in sync when settings changes in another window. */
    private val uiLanguageListener =
        android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == UiLanguage.KEY_CHOICE) {
                onMain {
                    pushBridgeHello()
                    pushState()
                }
            }
        }

    /** Language data readiness for the HTML mode menu. */
    private fun engineDataReady(mode: String): Boolean {
        val inputMode = InputModeBridge.fromWire(mode) ?: com.feelime.ime.engine.InputMode.DIRECT
        return com.feelime.ime.engine.EngineDataStore.isModeReady(applicationContext, inputMode)
    }

    private fun newToken(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    override fun onCreate() {
        super.onCreate()
        // 手势导航条区域：窗口是 bottom-anchored 到屏幕的（高度含
        // navBottomInset），系统默认的 navigationBarColor 黑色对比保护层
        // 会把最底 24dp 涂黑——背景图开启后键盘要一路铺到屏幕底，必须
        // 透明并关掉对比强制，否则图和屏幕底之间隔着一条黑带（真机截图
        // 定罪）。
        // SoftInputWindow is a Dialog: the Window hangs off .window.
        getWindow()?.window?.let { w ->
            w.navigationBarColor = Color.TRANSPARENT
            if (Build.VERSION.SDK_INT >= 29) w.isNavigationBarContrastEnforced = false
        }
        Diagnostics.refresh(this)
        UiLanguage.preferences(this)
            .registerOnSharedPreferenceChangeListener(uiLanguageListener)
        engine = AsrEngine(applicationContext, this)
        editorPort = InputConnectionEditorPort(this)
        clipboardStore = com.feelime.ime.panel.ClipboardStore(applicationContext)
        favoritesStore = com.feelime.ime.panel.FavoritesStore(applicationContext)
        // A capture that actually persisted (listener copy or focus
        // re-capture) pushes immediately: an open clipboard panel
        // hot-refreshes instead of waiting for the next getClipboard.
        clipboardStore.onChanged = { main.post { pushClipboard() } }
        // Panel-side freshness: mutations made in SetupActivity must reach an
        // open favorites tab on the keyboard . Removals through the
        // panel push themselves; this listener covers the Setup->panel
        // direction. Panel ids the panel no longer has are inert.
        com.feelime.ime.panel.PanelStoreSignals.favorites.add {
            main.post { pushFavorites() }
        }
        clipboardStore.start()
        registerReceiver(
            updateReceiver,
            android.content.IntentFilter(KeyboardUpdateCenter.ACTION_KEYBOARD_UPDATED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            userdataReceiver,
            android.content.IntentFilter(ACTION_USERDATA_RESTORED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            dpSchemeReceiver,
            android.content.IntentFilter(ACTION_DP_SCHEME_CHANGED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            fuzzyPinyinReceiver,
            android.content.IntentFilter(ACTION_FUZZY_PINYIN_CHANGED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            customPhrasesReceiver,
            android.content.IntentFilter(ACTION_CUSTOM_PHRASES_CHANGED),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            keyboardPrefsReceiver,
            android.content.IntentFilter(ACTION_KEYBOARD_PREFS_CHANGED).apply {
                addAction(ACTION_PREVIEW_KEYBOARD)
            },
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        registerReceiver(
            voicePermissionReceiver,
            android.content.IntentFilter(VoicePermissionActivity.ACTION_VOICE_PERMISSION_GRANTED).apply {
                addAction(VoicePermissionActivity.ACTION_VOICE_PERMISSION_DENIED)
            },
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        // 设置页可能在我没运行时导入了带词库的备份（暂存目录已就位）：
        // 引擎建立前把暂存换入正式目录。走主线程避免与恢复广播并发换目录。
        onMain {
            runCatching {
                com.feelime.ime.backup.UserdataBackup(
                    com.feelime.ime.backup.AndroidPrefs(applicationContext),
                    applicationContext.filesDir,
                ).applyPendingUserdb()
            }
        }
        // 自定义短语种子（issue #17）：首装/升级后 json 与 custom_phrase.txt
        // 必须在引擎 init 前就位（stabledb 只在引擎生命周期加载一次）。
        runCatching { com.feelime.ime.engine.CustomPhraseStore.load(applicationContext) }
        com.feelime.ime.engine.EngineDataStore.ensureAsync(applicationContext) {
            main.post { pushBridgeHello() }
        }
        coordinator = TextInputCoordinator(
            editor = object : com.feelime.ime.engine.EditorPort by editorPort {
                override fun commitText(text: String) {
                    if (panelInputActive) panelCommit(text) else editorPort.commitText(text)
                }

                override fun reopenComposing(start: Int, end: Int, word: String): Boolean {
                    if (!panelInputActive) return editorPort.reopenComposing(start, end, word)
                    if (!panelComposeSupported) return false
                    val payload = JSONObject().put("start", start).put("end", end)
                        .put("word", word).put("session", panelSession)
                    evaluate("window.Feelime && window.Feelime.onPanelReopen && window.Feelime.onPanelReopen($payload)")
                    return true
                }

                override fun selectedText(): String? =
                    if (panelInputActive) null else editorPort.selectedText()

                override fun sendDeleteKey() {
                    if (panelInputActive) panelDelete() else editorPort.sendDeleteKey()
                }

                // Latin-composing modes (FR/RU/JA) would write their in-flight
                // spelling into the host editor while the panel input is the
                // intended target; hold the span back (the final commit still
                // redirects through commitText above).
                override fun setComposing(text: String) {
                    if (!panelInputActive) editorPort.setComposing(text)
                    else if (panelComposeSupported) {
                        val payload = JSONObject().put("text", text).put("session", panelSession)
                        evaluate("window.Feelime && window.Feelime.onPanelComposing && window.Feelime.onPanelComposing($payload)")
                    }
                }

                override fun finishComposing() {
                    if (!panelInputActive) editorPort.finishComposing()
                    else if (panelComposeSupported) {
                        val payload = JSONObject().put("session", panelSession)
                        evaluate("window.Feelime && window.Feelime.onPanelFinishComposing && window.Feelime.onPanelFinishComposing($payload)")
                    }
                }
            },
            listener = { event ->
                val payload = JSONObject()
                    .put("phase", event.phase.name)
                    .put("revision", event.revision)
                    .put("consumed", event.consumed)
                    .put("code", event.code.name)
                    .put("mode", event.stamp.mode.wireName)
                    .put("composing", event.state.composing)
                    .put("rawInput", event.state.rawInput)
                    .put("commit", event.state.commit ?: "")
                    .put(
                        "candidates",
                        JSONArray(event.state.candidates.map { candidate ->
                            JSONObject().put("id", candidate.id).put("text", candidate.text)
                        }),
                    )
                    .put("hasPreviousPage", event.state.hasPreviousPage)
                    .put("hasNextPage", event.state.hasNextPage)
                event.degrade?.let {
                    payload
                        .put("degraded", true)
                        .put("degradedActive", event.degradedActive)
                        .put("failedMode", it.failedMode.wireName)
                        .put("degradeReason", it.reason.name)
                        .put("degradeSeq", it.seq)
                }
                if (event.degrade != null && event.degradedActive) {
                    android.util.Log.w(
                        "FeelimeEngine",
                        "engine degraded: failedMode=${event.degrade.failedMode.wireName} " +
                            "reason=${event.degrade.reason} seq=${event.degrade.seq}",
                    )
                }
                // 诊断埋点（issue #12）：keyboardView 为 null 时 composing/
                // 候选推送被静默跳过 = 「引擎有产出但 UI 看不到」的直接形态。
                if (keyboardView == null) {
                    Diagnostics.log(
                        "engine",
                        "statePushSkipped reason=noWebView " +
                            "preedit=${event.state.composing.length} " +
                            "cand=${event.state.candidates.size}",
                    )
                }
                evaluate("window.Feelime && window.Feelime.onEngineState && window.Feelime.onEngineState($payload)")
                // 中文联想（docs/design/association.md §3）：只在 commit 事件
                // 上计算并推送，键盘保留现有联想直到组合开始。
                val committed = event.state.commit
                if (committed != null && readAssociation(this@FeelimeService) &&
                    (
                        event.stamp.mode == com.feelime.ime.engine.InputMode.PINYIN ||
                            event.stamp.mode == com.feelime.ime.engine.InputMode.DOUBLE_PINYIN ||
                            event.stamp.mode == com.feelime.ime.engine.InputMode.T9 ||
                            // 笔画（issue #18）：上屏的也是汉字文本，联想表
                            // 按文本后继查询，与输入模式无关。
                            event.stamp.mode == com.feelime.ime.engine.InputMode.STROKE
                        )
                ) {
                    pushAssoc(com.feelime.ime.engine.AssociationStore.next(applicationContext, committed))
                }
            },
            engineFactory = { mode ->
                // 诊断埋点（issue #12）：会话生命周期起点，与 startEngine/
                // engineReady 对账（快速切换后 schema 绑定错位的排查）。
                Diagnostics.log("engine", "factory mode=${mode.wireName}")
                EngineFactory.create(applicationContext, mode)
            },
            asrGuard = { stopVoice(discardResults = true) },
            mainPoster = { block -> main.post(block) },
            background = background,
            modeStore = sharedPreferencesModeStore(),
            delayPoster = { delay, block -> main.postDelayed(block, delay) },
            diagnosticSink = { Diagnostics.log("engine", it) },
        )
    }

    /** survives process death via SharedPreferences. */
    private fun sharedPreferencesModeStore(): TextInputCoordinator.ModeStore {
        val prefs = getSharedPreferences("feelime_engine", MODE_PRIVATE)
        return object : TextInputCoordinator.ModeStore {
            override fun save(mode: com.feelime.ime.engine.InputMode) {
                prefs.edit().putString("selected_input_mode", mode.name).apply()
            }

            override fun load(): com.feelime.ime.engine.InputMode? {
                val name = prefs.getString("selected_input_mode", null) ?: return null
                return runCatching { com.feelime.ime.engine.InputMode.valueOf(name) }.getOrNull()
            }
        }
    }

    override fun onCreateInputView(): View {
        pageToken = newToken()
        pageReady = false
        val active = KeyboardUpdateCenter.activeKeyboard(this)
        servedRevision = active.revision
        assetStore = KeyboardAssetStore(active.dir)
        keyboardHeightOverride = storedKeyboardHeight()
        val keyboardHeight = dp(272)
 // The WebView is transparent - the float band above the
        // keyboard shows the app through it, and the keyboard area paints
        // its own themed background in CSS.
        val view = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                blockNetworkLoads = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                setSupportMultipleWindows(false)
                javaScriptCanOpenWindowsAutomatically = false
                mediaPlaybackRequiresUserGesture = true
            }
            removeJavascriptInterface("searchBoxJavaBridge_")
            removeJavascriptInterface("accessibility")
            removeJavascriptInterface("accessibilityTraversal")
            addJavascriptInterface(ImeBridge(), BRIDGE_NAME)
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? {
                    val url = request.url
                    return if (url.scheme == "https" && url.host == LOCAL_HOST &&
                        url.path.orEmpty().startsWith("/keyboard/")
                    ) assetStore?.response(url.path.orEmpty()) ?: blocked() else blocked()
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    return !(url.scheme == "https" && url.host == LOCAL_HOST &&
                        url.path.orEmpty().startsWith("/keyboard/"))
                }

                override fun onPageFinished(view: WebView, url: String) {
                    pushBridgeHello()
                }
            }
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            loadUrl(KEYBOARD_URL)
        }
        keyboardView = view
        view.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            onBottomInsetChanged()
        }
        installBottomInsetWatcher()
        val host = FixedHeightInputView(keyboardHeight).apply {
            setBackgroundColor(Color.TRANSPARENT)
            minimumHeight = keyboardHeight
            addView(
                view,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
        }
        inputViewHost = host
        return host
    }

    override fun onEvaluateInputViewShown(): Boolean = true

    override fun onEvaluateFullscreenMode(): Boolean = false

    /**
     * The input view is keyboard + float band (transparent strip
     * ABOVE the keyboard where popups live). The app must still only make
     * room for the KEYBOARD: content insets stop at the band's bottom edge,
     * and the band passes touches through to the app unless a popup opened
     * there (setOverlayOpen).
     */
    override fun onComputeInsets(outInsets: android.inputmethodservice.InputMethodService.Insets) {
        super.onComputeInsets(outInsets)
        val band = floatBandPx()
        if (band <= 0) return
        outInsets.contentTopInsets = band
        outInsets.visibleTopInsets = if (overlayOpen) 0 else band
        outInsets.touchableInsets =
            android.inputmethodservice.InputMethodService.Insets.TOUCHABLE_INSETS_VISIBLE
    }

    /** Popup band height - capped at 40% of the current screen
     * height so landscape keyboards keep most of the short edge for keys.
     * Landscape caps at 30% of the REAL screen (measured off
     * heightPixels the band starved the keyboard: chrome + 4x32css row floor
     * + safe-bottom no longer fit under it and the last row slid beneath the
     * gesture strip); 30% still keeps the mode menu in its floating branch
     * (>=120css). */
    private fun floatBandPx(): Int {
        val metrics = resources.displayMetrics
        val landscape =
            resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
        val budget = if (landscape) realHeightPixels() * 30 else metrics.heightPixels * 40
        return minOf(dp(200), budget / 100)
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        inputConnectionGeneration += 1
        invalidatePendingVoiceStartOnEditorChange()
        cursorQueryGeneration += 1
        pendingCursorDeltas.clear()
        cursorQueryActive = false
        expectedCursorSelections.clear()
        cursorSnapshotSupport.reset()
        android.util.Log.d("FeelimePanel", "onStartInput type=${attribute?.inputType} restarting=$restarting")
        stopVoice(discardResults = true)
        // Clipboard collection follows editor sensitivity (design §3.6):
        // arm on a normal editor, keep off for password fields. Re-capture the
        // current clip so copies made while hidden are not lost .
        // [attribute] is the editor identity for THIS callback. Reading
        // currentInputEditorInfo here can still return the previous field
        // while Android is handing us a new one, which would incorrectly
        // carry a password/Direct restriction into a normal text editor.
        val sensitive = isSensitiveEditor(attribute)
        clipboardStore.collectEnabled = !sensitive
        if (clipboardStore.collectEnabled) clipboardStore.captureCurrent()
        // TYPE_NULL (terminal) editors: force the Direct engine there - see
 // TextInputCoordinator.onEditorStarted .
        val terminalLike = isTerminalLikeEditor(attribute)
        hostSelectionStart = attribute?.initialSelStart ?: -1
        hostSelectionEnd = attribute?.initialSelEnd ?: -1
        panelInputActive = false
        panelInputRequested = false
        panelRouteGeneration += 1
        coordinator.onEditorStarted(sensitive, terminalLike, hostSelectionStart, hostSelectionEnd)
        // 编辑器切换，上一字段末尾的联想词失效（association.md §3）。
        clearAssociation()
        main.post { pushEditorInfo() }
    }

    override fun onUpdateSelection(
        oldSelStart: Int,
        oldSelEnd: Int,
        newSelStart: Int,
        newSelEnd: Int,
        candidatesStart: Int,
        candidatesEnd: Int,
    ) {
        super.onUpdateSelection(
            oldSelStart,
            oldSelEnd,
            newSelStart,
            newSelEnd,
            candidatesStart,
            candidatesEnd,
        )
        val ownSelection = expectedCursorSelections.lastIndexOf(newSelStart to newSelEnd)
        if (ownSelection >= 0) {
            // setSelection() is asynchronous. If an older own callback lands
            // after a newer request was already issued, keep the newest
            // expected position as the text-before/text-after baseline.
            val baseline = cursorSelectionBaseline(
                newSelStart to newSelEnd,
                expectedCursorSelections.toList(),
            )
            repeat(ownSelection + 1) { expectedCursorSelections.removeFirst() }
            hostSelectionStart = baseline.first
            hostSelectionEnd = baseline.second
        } else if (oldSelStart != newSelStart || oldSelEnd != newSelEnd) {
            expectedCursorSelections.clear()
            cursorQueryGeneration += 1
            pendingCursorDeltas.clear()
            hostSelectionStart = newSelStart
            hostSelectionEnd = newSelEnd
        } else if (expectedCursorSelections.isEmpty()) {
            // A host may report its initial selection without a movement.
            hostSelectionStart = newSelStart
            hostSelectionEnd = newSelEnd
        }
        // This callback is asynchronous and does not query editor text. It
        // invalidates the coordinator's last-word transaction whenever the
        // host moves/selects the caret outside our own bridge action.
        if (::coordinator.isInitialized && !panelInputActive) {
            coordinator.onEditorSelectionChanged(oldSelStart, oldSelEnd, newSelStart, newSelEnd)
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        inputConnectionGeneration += 1
        invalidatePendingVoiceStartOnEditorChange()
        cursorQueryGeneration += 1
        pendingCursorDeltas.clear()
        cursorQueryActive = false
        expectedCursorSelections.clear()
        cursorSnapshotSupport.reset()
        if (::coordinator.isInitialized) coordinator.onExternalEditorMutation()
        stopVoice(discardResults = true)
        // No focused editor: never record (password managers' copies stay out).
        clipboardStore.collectEnabled = false
        composing = false
        // The system may hide the IME without delivering touchend/cancel to
        // the WebView. Clear its gesture-owned visual/timer state while the
        // page is still alive; the JS hook is optional for older keyboard
        // assets and the next show path still resets home as before.
        // Toolbar edit is modal: hiding the keyboard cancels it (snapshot
        // rollback, nothing saved). Same-editor re-shows skip onStartInput
        // /resetToHome, so this hide path is the only reliable hook.
        // 联想词同理（association.md §3）：它是「上屏词的后继」，键盘收起
        // 后上下文已断——不清的话同编辑器再弹出时联想词和工具栏让位态
        // 原样残留（device 复现 2026-09-20）。onStartInputView 再兜一次，
        // 覆盖此处 evaluate 因 WebView 正在 detach 而丢失的场合。
        evaluate("window.Feelime && window.Feelime.cancelTouches && window.Feelime.cancelTouches()")
        evaluate("window.Feelime && window.Feelime.cancelToolbarEdit && window.Feelime.cancelToolbarEdit()")
        clearAssociation()
        super.onFinishInputView(finishingInput)
    }

    override fun onStartInputView(editorInfo: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(editorInfo, restarting)
        // 收起时（onFinishInputView）已清过一次联想；restarting 弹出时若那
        // 次 evaluate 没到达（WebView detach 竞态），这里是可靠兜底——
        // onStartInputView 对同编辑器再弹出必然触发。
        clearAssociation()
        onBottomInsetChanged()
        // A pref change while the keyboard was hidden cannot re-measure
        // (its requestLayout landed on a non-visible view) — re-measure once
        // on the next show so the pad/height read fresh prefs (mode-fallback
        // §3).
        if (appliedKeyboardPrefsEpoch != keyboardPrefsEpoch) {
            appliedKeyboardPrefsEpoch = keyboardPrefsEpoch
            inputViewHost?.requestLayout()
            // Belt and suspenders: a measure that lands while the window is
            // still coming up can be pre-empted; re-run once visible.
            inputViewHost?.post { inputViewHost?.requestLayout() }
        }
        // Hiding the IME can detach the input view; on re-attach the JS
        // ResizeObserver takes the current size as its baseline and never
        // fires, so prefs changed while hidden would keep a stale row
        // budget. Re-derive from live geometry on every show.
        inputViewHost?.post {
            keyboardView?.evaluateJavascript(HEIGHT_SETTLED_JS, null)
        }
        // Showing the same editor after hiding may skip onStartInput.
        // Restore collection disabled by onFinishInputView and capture copies
        // made while hidden, except for sensitive editors.
        clipboardStore.collectEnabled = !isSensitiveEditor()
        if (clipboardStore.collectEnabled) clipboardStore.captureCurrent()
 // A fresh show always lands on the main view - a
        // keyboard hidden from the symbol layer must not come back there.
        if (!restarting) {
            installBottomInsetWatcher()
            evaluate("window.Feelime && window.Feelime.resetToHome && window.Feelime.resetToHome()")
        }
    }

    override fun onDestroy() {
        acceptAsrResults = false
        inputConnectionGeneration += 1
        cursorQueryGeneration += 1
        pendingCursorDeltas.clear()
        cursorQueryActive = false
        cursorSnapshotSupport.reset()
        runCatching { keyTone?.release() }
        keyTone = null
        clipboardStore.stop()
        unregisterReceiver(updateReceiver)
        unregisterReceiver(userdataReceiver)
        unregisterReceiver(dpSchemeReceiver)
        unregisterReceiver(fuzzyPinyinReceiver)
        unregisterReceiver(customPhrasesReceiver)
        unregisterReceiver(keyboardPrefsReceiver)
        unregisterReceiver(voicePermissionReceiver)
        UiLanguage.preferences(this)
            .unregisterOnSharedPreferenceChangeListener(uiLanguageListener)
        // close any live engine session before tearing down.
        runCatching { coordinator.close() }
        engine.release()
        background.shutdown()
        cursorQueryExecutor.shutdownNow()
        keyboardView?.apply {
            removeJavascriptInterface(BRIDGE_NAME)
            destroy()
        }
        keyboardView = null
        inputViewHost = null
        super.onDestroy()
    }

    /**
     * Hot-update reload (design §8.3): re-resolve the active keyboard and, if
     * the revision changed, reload the synthetic origin so the next page load
     * serves the new files with a fresh page token. Never force-stops.
     */
    private fun reloadKeyboardFiles() = onMain {
        val active = KeyboardUpdateCenter.activeKeyboard(this)
        if (active.revision == servedRevision) return@onMain
        servedRevision = active.revision
        assetStore = KeyboardAssetStore(active.dir)
        pageToken = newToken()
        pageReady = false
        keyboardView?.loadUrl(KEYBOARD_URL)
    }

    private fun startVoice() = onMain {
        if (state != VoiceState.IDLE && state != VoiceState.ERROR) return@onMain
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            // 首用直弹系统权限窗（docs/design/userdata.md §2）：Service 不能
            // requestPermissions，用透明 Activity 代发；授权后广播回来重试，
            // 拒绝则落到原有的去设置页手动路径。
            state = VoiceState.ERROR
            pushState(
                message = t(
                    this,
                    "等待麦克风权限…",
                    "Waiting for microphone permission…",
                ),
                messageCode = "MIC_PERMISSION_REQUESTED",
            )
            runCatching {
                startActivity(
                    Intent(this, VoicePermissionActivity::class.java)
                        .addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                // 空 taskAffinity 的透明壳叠在当前界面上，
                                // 不带任务切换动画（userdata.md §2）。
                                Intent.FLAG_ACTIVITY_NO_ANIMATION,
                        ),
                )
            }.onFailure { failure ->
                android.util.Log.w("FeelimeService", "voice permission activity launch dropped", failure)
                pushState(
                    message = t(
                        this,
                        "请先打开 Feelime 设置并授予麦克风权限",
                        "Open Feelime settings and grant microphone permission first",
                    ),
                    messageCode = "MIC_PERMISSION_REQUIRED",
                )
            }
            return@onMain
        }
        if (currentInputConnection == null) {
            state = VoiceState.ERROR
            pushState(
                message = t(this, "当前应用没有可输入的文本框", "The current app has no editable text field"),
                messageCode = "NO_EDITOR",
            )
            return@onMain
        }
        if (isSensitiveEditor()) {
            state = VoiceState.ERROR
            pushState(
                message = t(this, "密码输入框已停用语音识别", "Voice input is disabled in password fields"),
                messageCode = "SENSITIVE_EDITOR",
            )
            return@onMain
        }
        val requestId = ++voiceRequestId
        voiceStartRequestId = requestId
        val editorGeneration = inputConnectionGeneration
        voiceStartEditorGeneration = editorGeneration
        voiceStartPending = true
        voiceSession = null
        voiceCancelRequested = false
        acceptAsrResults = true
        currentPartial = ""
        state = VoiceState.LOADING
        pushState()
        coordinator.beginVoiceSession(
            isCurrent = { inputConnectionGeneration == editorGeneration },
        ) {
            onMain {
                // beginVoiceSession may wait for an engine warm-up. A stop,
                // editor switch, or a newer request must invalidate this
                // callback before it can start the old recording.
                if (!voiceStartPending || voiceStartRequestId != requestId) return@onMain
                if (requestId != voiceRequestId ||
                    !acceptAsrResults || state != VoiceState.LOADING
                ) {
                    finishPendingVoiceStart(requestId)
                    return@onMain
                }
                voiceStartPending = false
                val selected = runCatching { editorPort.selectedText() }.getOrNull()
                val selectionKnownNonEmpty =
                    hostSelectionStart >= 0 && hostSelectionEnd >= 0 &&
                        hostSelectionEnd != hostSelectionStart
                voiceSession = VoiceSession(
                    editorGeneration = inputConnectionGeneration,
                    originalSelection = if (selected != null) selected
                    else if (selectionKnownNonEmpty) null
                    else "",
                    // A null selected-text result plus a known non-empty
                    // selection cannot be safely replaced by a composing span.
                    streamToEditor = selected != null || !selectionKnownNonEmpty,
                )
                engine.start()
            }
        }
    }

    private fun stopVoice(discardResults: Boolean = false) = onMain {
        if (discardResults) {
            cancelVoiceOnMain()
            return@onMain
        }
        if (voiceStartPending) {
            // No AsrEngine callback will complete a request that has not
            // reached engine.start yet. Invalidate its after callback and let
            // that callback finish the coordinator transition when it lands.
            voiceCancelRequested = true
            voiceRequestId += 1
            state = VoiceState.STOPPING
            pushState()
            return@onMain
        }
        if (state == VoiceState.LISTENING || state == VoiceState.LOADING) {
            state = VoiceState.STOPPING
            pushState()
            engine.stop()
        }
    }

    /**
     * An editor transition clears the coordinator's warmup queue. If that
     * queue contained the continuation that would start voice recording, no
     * ASR callback can settle the service's pending marker afterwards. Clear
     * the marker here; the lifecycle handler owns the coordinator reset for
     * the new editor, so ending the old voice session would touch the new one.
     */
    private fun invalidatePendingVoiceStartOnEditorChange() {
        if (!voiceStartPending) return
        voiceStartPending = false
        voiceRequestId += 1
        voiceStartRequestId = 0L
        voiceStartEditorGeneration = -1L
        voiceCancelRequested = false
        acceptAsrResults = false
        voiceSession = null
        composing = false
        currentPartial = ""
        level = 0f
        state = VoiceState.IDLE
        pushState(partial = "")
    }

    /** Cancel the whole recording, including endpoint segments already seen. */
    private fun cancelVoice() = onMain { cancelVoiceOnMain() }

    private fun cancelVoiceOnMain() {
        if (state == VoiceState.IDLE || state == VoiceState.ERROR) return
        voiceCancelRequested = true
        voiceRequestId += 1
        voiceSession?.let { session ->
            session.cancelled = true
            // Clear the editor span synchronously. The recognizer's worker
            // still has to release the recorder, but cancellation must be
            // visible immediately and must not wait for that cleanup.
            if (session.editorGeneration == inputConnectionGeneration) {
                rollbackVoiceSession(session)
            }
        }
        acceptAsrResults = false
        currentPartial = ""
        level = 0f
        if (state == VoiceState.LOADING || state == VoiceState.LISTENING ||
            state == VoiceState.STOPPING
        ) {
            state = VoiceState.STOPPING
            pushState(partial = "")
        }
        if (voiceStartPending) return
        // A normal stop may already have put the service in STOPPING; cancel
        // still has to switch the engine from drain to discard semantics.
        engine.cancel()
    }

    private fun finishPendingVoiceStart(requestId: Long) {
        if (!voiceStartPending || voiceStartRequestId != requestId) return
        voiceStartPending = false
        acceptAsrResults = false
        currentPartial = ""
        level = 0f
        state = VoiceState.IDLE
        if (voiceStartEditorGeneration == inputConnectionGeneration) {
            coordinator.endVoiceSession()
        }
        voiceCancelRequested = false
        pushState(partial = "")
    }

    private fun sendKey(code: Int) = onMain {
        val connection = currentInputConnection ?: return@onMain
        connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }

    /**
     * Move the caret inside a normal editor without blocking the IME main
     * thread. getExtractedText is a synchronous InputConnection RPC and some
     * in-process WebViews take the framework's two-second timeout. Query one
     * snapshot on a worker, then calculate the whole bounded delta by Unicode
     * code point before applying setSelection on the main thread.
     *
     * TYPE_NULL editors deliberately retain physical arrow events: terminals
     * own their cursor semantics and do not expose a reliable selection model.
     * A normal editor without full snapshots is reconstructed from its text
     * around the known host selection before falling back to native arrows.
     */
    private fun moveCursorWithinEditor(delta: Int) = onMain {
        val connection = currentInputConnection ?: return@onMain
        val info = currentInputEditorInfo
        if (isKeyEventCursorEditor(info)) {
            val code = if (delta < 0) KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_RIGHT
            repeat(kotlin.math.abs(delta)) {
                connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
                connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
            }
            coordinator.onExternalEditorMutation()
            return@onMain
        }

        // Invalidate the word-undo transaction before the potentially slow
        // query. A host selection/caret change must never resurrect a word.
        coordinator.onExternalEditorMutation()
        // Some WebView InputConnections do not expose either full snapshot
        // API. A failed probe cools down before native arrows are used, so a
        // transient null does not permanently disable later setSelection.
        if (cursorSnapshotSupport.strategy(
                connection,
                android.os.SystemClock.elapsedRealtime(),
            ) == CursorSnapshotSupport.Strategy.NATIVE_ARROWS
        ) {
            sendNativeCursorArrows(connection, listOf(delta))
            return@onMain
        }
        // Scrub frames can enqueue several bounded bridge calls before the
        // first editor RPC returns. Preserve their net movement and issue one
        // snapshot at a time; replacing an in-flight request would silently
        // lose earlier steps.
        // Keep direction changes ordered: cancelling opposite deltas loses
        // movement when the first segment reaches an editor boundary.
        val previous = pendingCursorDeltas.lastOrNull()
        if (previous != null && (previous < 0) == (delta < 0) &&
            kotlin.math.abs(previous + delta) <= MAX_CURSOR_DELTA) {
            pendingCursorDeltas.removeLast()
            pendingCursorDeltas.addLast(previous + delta)
        } else pendingCursorDeltas.addLast(delta)
        startCursorQueryIfNeeded()
    }

    private fun startCursorQueryIfNeeded() {
        if (cursorQueryActive || pendingCursorDeltas.isEmpty()) return
        val connection = currentInputConnection ?: run {
            pendingCursorDeltas.clear()
            return
        }
        val probeStrategy = cursorSnapshotSupport.strategy(
            connection,
            android.os.SystemClock.elapsedRealtime(),
        )
        if (probeStrategy == CursorSnapshotSupport.Strategy.NATIVE_ARROWS) {
            val deltas = ArrayList<Int>(pendingCursorDeltas.size)
            while (pendingCursorDeltas.isNotEmpty()) {
                deltas.add(pendingCursorDeltas.removeFirst())
            }
            sendNativeCursorArrows(connection, deltas)
            return
        }
        val delta = pendingCursorDeltas.removeFirst()
        cursorQueryActive = true
        val editorGeneration = inputConnectionGeneration
        val queryGeneration = cursorQueryGeneration
        // These callbacks are the only absolute selection offsets available
        // when a host implements neither full snapshot API. Capture them on
        // the main thread before the worker starts querying text around the
        // cursor.
        val selectionStart = hostSelectionStart
        val selectionEnd = hostSelectionEnd
        val request = ++cursorQueryRequest
        cursorQueryExecutor.execute {
            val snapshot = if (probeStrategy == CursorSnapshotSupport.Strategy.FULL_SNAPSHOT) {
                runCatching {
                    connection.getExtractedText(android.view.inputmethod.ExtractedTextRequest().apply {
                        hintMaxChars = 0
                    }, 0)
                }.getOrNull()?.let { extracted ->
                    if (extracted.partialStartOffset >= 0 || extracted.partialEndOffset >= 0) {
                        null
                    } else {
                        val text = extracted.text?.toString() ?: return@let null
                        CursorSnapshot(text, extracted.selectionStart, extracted.selectionEnd, extracted.startOffset)
                    }
                }
            } else null
            val surroundingSnapshot = if (
                snapshot == null && probeStrategy == CursorSnapshotSupport.Strategy.FULL_SNAPSHOT &&
                    android.os.Build.VERSION.SDK_INT >= 31
            ) {
                runCatching { connection.getSurroundingText(2048, 2048, 0) }
                    .getOrNull()?.let { surrounding ->
                        if (surrounding.offset < 0) null else CursorSnapshot(
                            surrounding.text.toString(), surrounding.selectionStart,
                            surrounding.selectionEnd, surrounding.offset,
                        )
                    }
            } else null
            val textSnapshot = if (snapshot == null && surroundingSnapshot == null) {
                val before = runCatching {
                    connection.getTextBeforeCursor(MAX_CURSOR_CONTEXT_CHARS, 0)?.toString()
                }.getOrNull()
                val after = if (before != null) {
                    runCatching {
                        connection.getTextAfterCursor(MAX_CURSOR_CONTEXT_CHARS, 0)?.toString()
                    }.getOrNull()
                } else null
                val selectedText = if (
                    before != null && after != null && selectionStart >= 0 && selectionEnd >= 0 &&
                    selectionStart != selectionEnd
                ) {
                    runCatching { connection.getSelectedText(0)?.toString() }.getOrNull()
                } else null
                if (before != null && after != null) {
                    cursorSnapshotAroundSelection(
                        before,
                        after,
                        selectionStart,
                        selectionEnd,
                        selectedText,
                        MAX_CURSOR_CONTEXT_CHARS,
                    )
                } else null
            } else null
            val usableSnapshot = snapshot ?: surroundingSnapshot ?: textSnapshot
            val usedTextFallback = textSnapshot != null
            main.post {
                // A previous editor's completion never owns the current
                // request and must not clear its active flag or queued work.
                if (request != cursorQueryRequest || editorGeneration != inputConnectionGeneration) return@post
                cursorQueryActive = false
                if (connection === currentInputConnection) {
                    when {
                        usedTextFallback -> cursorSnapshotSupport.markTextFallback(connection)
                        usableSnapshot == null -> {
                            // Null can be a timeout or an invalidated
                            // connection, so keep native arrows only until a
                            // later probe is allowed. Do this before the
                            // generation check: a stale selection callback
                            // must not make every following frame repeat the
                            // slow pair of snapshot calls.
                            cursorSnapshotSupport.markUnsupported(
                                connection,
                                android.os.SystemClock.elapsedRealtime(),
                            )
                        }
                        probeStrategy != CursorSnapshotSupport.Strategy.FULL_SNAPSHOT ->
                            cursorSnapshotSupport.markSupported(connection)
                    }
                }
                if (queryGeneration != cursorQueryGeneration) {
                    // A host selection change invalidates both this snapshot
                    // and its delta. The lifecycle may also have replaced the
                    // InputConnection, so this check must precede the
                    // identity-recovery path below; otherwise an obsolete
                    // delta would be requeued after onUpdateSelection had
                    // deliberately cleared pending movement.
                    startCursorQueryIfNeeded()
                    return@post
                }
                if (connection !== currentInputConnection) {
                    // Some InputConnection implementations replace their
                    // proxy before the lifecycle callback that advances the
                    // generation. The query's delta has not reached the
                    // editor yet, so return it to the front of the queue and
                    // retry against the live connection. Leaving the active
                    // flag set here would strand every later scrub request.
                    pendingCursorDeltas.addFirst(delta)
                    startCursorQueryIfNeeded()
                    return@post
                }
                // A drag can enqueue more deltas while the snapshot RPC is in
                // flight. Drain that burst against the same immutable text
                // snapshot; querying once per queued segment made a slow
                // editor turn continuous scrubbing into visible lag. The
                // sequence helper still clamps each segment independently,
                // preserving Unicode boundaries and native selection collapse
                // at either end of the text.
                val deltas = ArrayList<Int>(pendingCursorDeltas.size + 1)
                deltas.add(delta)
                while (pendingCursorDeltas.isNotEmpty()) {
                    deltas.add(pendingCursorDeltas.removeFirst())
                }
                // xterm.js-style WebView terminals present a hidden
                // helper textarea to the IME. Its snapshot reads empty and its
                // caret never represents the visible terminal cursor, so a
                // snapshot-driven setSelection is a silent no-op there: the
                // terminal only follows real key events. An empty snapshot can
                // never honour a non-zero delta either, so route that movement
                // through the arrow-key channel, like the TYPE_NULL path.
                val usable = usableSnapshot?.takeIf { it.text.isNotEmpty() }
                var applied = false
                if (usable != null) {
                    val target = CursorMovement.targetSequence(usable, deltas)
                    if (target != null) {
                        val same = usable.selectionStart + usable.startOffset == target &&
                            usable.selectionEnd + usable.startOffset == target
                        if (!same) {
                            if (connection.setSelection(target, target)) {
                                expectedCursorSelections.addLast(target to target)
                                // The host callback is asynchronous; subsequent
                                // text-before/text-after queries must use the
                                // position we just requested immediately.
                                hostSelectionStart = target
                                hostSelectionEnd = target
                                coordinator.onExternalEditorMutation()
                                applied = true
                            }
                        } else {
                            applied = true
                        }
                    }
                }
                if (!applied) {
                    // Editors without extracted text still support their
                    // native arrow protocol (including custom web editors).
                    sendNativeCursorArrows(connection, deltas)
                }
                startCursorQueryIfNeeded()
            }
        }
    }

    private fun sendNativeCursorArrows(
        connection: InputConnection,
        deltas: Iterable<Int>,
    ) {
        val flags = KeyEvent.FLAG_SOFT_KEYBOARD or KeyEvent.FLAG_KEEP_TOUCH_MODE
        deltas.forEach { movement ->
            val code = if (movement < 0) KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_RIGHT
            repeat(kotlin.math.abs(movement)) {
                val downAt = android.os.SystemClock.uptimeMillis()
                connection.sendKeyEvent(
                    KeyEvent(
                        downAt,
                        downAt,
                        KeyEvent.ACTION_DOWN,
                        code,
                        0,
                        0,
                        android.view.KeyCharacterMap.VIRTUAL_KEYBOARD,
                        0,
                        flags,
                    ),
                )
                connection.sendKeyEvent(
                    KeyEvent(
                        downAt,
                        android.os.SystemClock.uptimeMillis(),
                        KeyEvent.ACTION_UP,
                        code,
                        0,
                        0,
                        android.view.KeyCharacterMap.VIRTUAL_KEYBOARD,
                        0,
                        flags,
                    ),
                )
            }
        }
    }

    private fun enter() = onMain {
        // The coordinator owns the action decision because a warmup-queued
        // Enter can only be classified after preceding queued keys replay.
        coordinator.enterRaw()
    }

    private fun switchIme() = onMain {
        // The engine's pinyin raw buffer is rendered only in the keyboard UI;
        // accept it before the system hands the editor to another IME.  The
        // coordinator also resets its engine session, so returning to this
        // IME cannot replay the same composition a second time.
        coordinator.acceptCurrentComposition {
            if (shouldOfferSwitchingToNextInputMethod()) {
                switchToNextInputMethod(false)
            } else {
                getSystemService(InputMethodManager::class.java).showInputMethodPicker()
            }
        }
    }

    private fun openSetup() = onMain {
        startActivity(
            Intent(this, SetupActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(SetupActivity.SETUP_LAUNCH_EXTRA, android.os.SystemClock.elapsedRealtimeNanos()),
        )
    }

    /** System dark/light for the keyboard's auto theme (WebView prefers-
     *  color-scheme is unreliable across OEM WebView builds). */
    private fun systemTheme(): String {
        val night = resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return if (night == android.content.res.Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        main.post {
 // Each orientation keeps its own height.
            keyboardHeightOverride = storedKeyboardHeight()
            (keyboardView?.parent as? View)?.requestLayout()
            pushBridgeHello()
            pushState()
        }
    }

    private fun pushBridgeHello() {
        installBottomInsetWatcher()
        // 联想开着就趁 hello 预热 bigram 表（后台线程，不占输入链路）
        if (readAssociation(this)) {
            com.feelime.ime.engine.AssociationStore.prewarm(this)
        }
        val landscape =
            resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
        val payload = JSONObject()
            .put("nativeApiVersion", NATIVE_API_VERSION)
            .put("capabilities", JSONArray(CAPABILITIES.toList()))
            .put("theme", systemTheme())
            .put("uiLanguage", UiLanguage.choice(this))
            .put("uiLocale", UiLanguage.locale(this))
            .put("orientation", if (landscape) "landscape" else "portrait")
            // Content stays above the system navigation/gesture area in
            // either orientation; the native view carries the extra space.
            .put("safeBottom", (navBottomInset() / resources.displayMetrics.density).toInt())
 // The transparent popup band above the keyboard.
            .put("floatBand", (floatBandPx() / resources.displayMetrics.density).toInt())
            .put("heightDefault", (minOf(dp(272), if (landscape) realHeightPixels() / 2
                else resources.displayMetrics.heightPixels * 45 / 100) /
                resources.displayMetrics.density).toInt())
            // The height-card drag range must follow the REAL screen
            // ceiling (same formula as setKeyboardHeight's clamp). The WebView's
            // own innerHeight rides the keyboard (band + keys), so deriving the
            // range there pinned the thumb at an end on open (landscape: below
            // min).
            .put(
                "heightFloor",
                if (landscape) 170 else 210,
            )
            .put(
                "heightCeil",
                (
                    (
                        if (landscape) realHeightPixels() / 2
                        else (resources.displayMetrics.heightPixels * 45) / 100
                    ) / resources.displayMetrics.density
                ).toInt(),
            )
            .put("pageGenerationToken", pageToken)
            .put("mode", coordinator.currentMode.wireName)
            .put("dpScheme", com.feelime.ime.engine.DoublePinyinScheme.resolve(this))
            // Degraded-engine state survives WebView rebuilds via hello
            // (mode-fallback §2.1); hello NEVER fires the toast itself.
            .put("degraded", coordinator.engineDegrade != null)
            .put("failedMode", coordinator.engineDegrade?.failedMode?.wireName ?: "")
            .put("degradeReason", coordinator.engineDegrade?.reason?.name ?: "")
            .put("degradeSeq", coordinator.engineDegrade?.seq ?: 0L)
            .put("warming", coordinator.engineWarming)
            // Keyboard-side preference values (mode-fallback §3/§4). dp == CSS
            // px inside this WebView; numbers pass through as-is.
            .put("bottomPad", bottomPadDp())
            .put("scrubSpeed", feelScrubSpeed())
            .put("holdMs", feelHoldMs())
            .put("popupSnap", feelPopupSnap())
            .put("candidateFont", candidateFont())
            .put("preeditFont", preeditFont())
            .put("preeditBold", readPreeditBold(this))
            .put("oneHand", readOneHand(this))
            .put("oneHandPad", readOneHandPad(this))
            .put("sideContent", readSideContent(this))
            .put("bgImageLight", readBgImageBase64(this, "light"))
            .put("bgImageDark", readBgImageBase64(this, "dark"))
            .put("bgImageLightSource", readBgImageSource(this, "light"))
            .put("bgImageDarkSource", readBgImageSource(this, "dark"))
            .put("keyOpacity", readKeyOpacity(this))
            .put("themeMode", readThemeMode(this))
            .put("toolbarLayout", readToolbarLayout(this))
            .put("associationOn", readAssociation(this))
            .put("dynamicDateTimeOn", readDynamicDateTime(this))
            // 按键反馈开关（issue #5 问题 2）也进 hello：快捷设置方块的
            // 开/关状态要跟原生偏好走（设置页改动同样经这里回读）。
            .put("keySound", readKeySoundEnabled(this))
            .put("keyHaptic", readKeyHapticEnabled(this))
            .put(
                "engineDataReady",
                JSONObject().apply {
                    listOf("pinyin", "double-pinyin", "t9", "stroke", "japanese", "french", "russian").forEach { mode ->
                        put(mode, engineDataReady(mode))
                    }
                },
            )
        Diagnostics.noteLiveState(
            "mode=${coordinator.currentMode.wireName} " +
                "degraded=${coordinator.engineDegrade != null} warming=${coordinator.engineWarming} " +
                "pkg=${currentInputEditorInfo?.packageName}",
        )
        evaluate("window.Feelime && window.Feelime.onBridgeHello && window.Feelime.onBridgeHello($payload)")
    }

    private fun pushEditorInfo() {
        val info = currentInputEditorInfo
        val payload = JSONObject()
            .put("inputType", info?.inputType ?: 0)
            .put("imeOptions", info?.imeOptions ?: 0)
            .put("packageName", info?.packageName ?: "")
            .put("sensitive", isSensitiveEditor(info))
            .put("terminalLike", isTerminalLikeEditor(info))
        Diagnostics.log(
            "editor",
            "pkg=${info?.packageName} inputType=0x${Integer.toHexString(info?.inputType ?: 0)} " +
                "imeOptions=0x${Integer.toHexString(info?.imeOptions ?: 0)}",
        )
        evaluate("window.Feelime && window.Feelime.onEditorInfo($payload)")
    }

    private fun pushClipboard() {
        // Password fields get an empty list: password managers' copied content
        // must not be renderable on screen while a sensitive editor is focused.
        val sensitive = isSensitiveEditor()
        val items = if (sensitive) emptyList() else clipboardStore.items()
        val payload = JSONObject().put(
            "items",
            JSONArray().apply {
                items.forEach { item ->
                    put(JSONObject().put("id", item.id).put("time", item.time).put("text", item.text))
                }
            },
        )
        evaluate("window.Feelime && window.Feelime.onClipboard && window.Feelime.onClipboard($payload)")
    }

    private fun pushFavorites() {
        val payload = JSONObject().put(
            "items",
            JSONArray().apply {
                favoritesStore.items().forEach { item ->
                    put(JSONObject().put("id", item.id).put("time", item.time)
                        .put("text", item.text).put("code", item.code).put("rank", item.rank))
                }
            },
        )
        evaluate("window.Feelime && window.Feelime.onFavorites && window.Feelime.onFavorites($payload)")
    }

    private fun pushState(
        message: String? = null,
        partial: String? = null,
        messageCode: String? = null,
    ) {
        val payload = JSONObject()
            .put("state", state.wireName)
            .put("uiLanguage", UiLanguage.choice(this))
            .put("uiLocale", UiLanguage.locale(this))
            .put("messageCode", messageCode ?: "")
            .put("message", message ?: "")
            .put("partial", partial ?: currentPartial)
            .put("level", level.toDouble())
        evaluate("window.Feelime && window.Feelime.onNativeState($payload)")
    }

    private fun evaluate(script: String) = onMain {
        keyboardView?.evaluateJavascript(script, null)
    }

    /** 推送/清空联想词（docs/design/association.md §3）。 */
    private fun pushAssoc(words: List<String>) {
        val payload = JSONObject().put("words", JSONArray(words))
        evaluate("window.Feelime && window.Feelime.onAssoc && window.Feelime.onAssoc($payload)")
    }

    private fun clearAssociation() = pushAssoc(emptyList())

    /** Redirect editor writes into the focused panel input . */
    private fun panelCommit(text: String) {
        val payload = JSONObject().put("text", text).put("session", panelSession)
        evaluate("window.Feelime && window.Feelime.onPanelCommit && window.Feelime.onPanelCommit($payload)")
    }

    private fun panelDelete(count: Int = 1) {
        val payload = JSONObject().put("count", count).put("session", panelSession)
        evaluate("window.Feelime && window.Feelime.onPanelDelete && window.Feelime.onPanelDelete($payload)")
    }

    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    private fun renderVoiceText(session: VoiceSession) {
        if (!session.streamToEditor) {
            // Unknown non-empty selections are deliberately buffered. The
            // normal stop commits into the still-live selection; cancellation
            // performs no editor write at all.
            composing = false
            return
        }
        val connection = currentInputConnection ?: return
        if (session.text.isEmpty()) {
            // Do not touch a pre-existing selection before the recognizer has
            // produced its first non-empty text. Once this session owns a
            // span, an empty update is allowed to clear that span while
            // retaining the ownership needed for cancellation rollback.
            if (!session.composingApplied) {
                composing = false
                return
            }
            connection.setComposingText("", 1)
            composing = false
            return
        }
        connection.setComposingText(session.text, 1)
        if (session.text.isNotEmpty()) session.composingApplied = true
        composing = session.text.isNotEmpty()
    }

    private fun commitVoiceSession(session: VoiceSession) {
        if (session.text.isBlank()) {
            // A recognizer may retract a partial without producing a final.
            // If that partial had replaced a selection, restore it before
            // ending the otherwise empty session.
            if (session.streamToEditor && session.composingApplied) {
                rollbackVoiceSession(session)
            }
            return
        }
        val connection = currentInputConnection ?: return
        if (session.streamToEditor && session.composingApplied) {
            connection.finishComposingText()
        } else {
            // Buffered sessions retain the original selection until normal
            // stop, so this single commit replaces it atomically.
            connection.commitText(session.text, 1)
        }
    }

    private fun rollbackVoiceSession(session: VoiceSession) {
        if (!session.streamToEditor || !session.composingApplied) return
        val connection = currentInputConnection ?: return
        connection.setComposingText("", 1)
        connection.finishComposingText()
        // setComposingText replaced the selection. Put the exact selected
        // text back only after the temporary span has been cleared.
        session.originalSelection?.takeIf { it.isNotEmpty() }?.let {
            connection.commitText(it, 1)
        }
        session.composingApplied = false
        composing = false
    }

    override fun onLoading() = onMain {
        if (!acceptAsrResults) return@onMain
        state = VoiceState.LOADING
        pushState()
    }

    override fun onListening() = onMain {
        if (!acceptAsrResults) return@onMain
        state = VoiceState.LISTENING
        pushState()
    }

    override fun onPartial(text: String) = onMain {
        val session = voiceSession ?: return@onMain
        if (!acceptAsrResults || session.cancelled ||
            session.editorGeneration != inputConnectionGeneration
        ) return@onMain
        session.text = session.finalizedText + text
        currentPartial = text
        renderVoiceText(session)
        pushState(partial = text)
    }

    override fun onFinal(text: String) = onMain {
        val session = voiceSession ?: return@onMain
        if (!acceptAsrResults || session.cancelled ||
            session.editorGeneration != inputConnectionGeneration || text.isBlank()
        ) return@onMain
        session.finalizedText += text
        session.text = session.finalizedText
        renderVoiceText(session)
        currentPartial = ""
        pushState(partial = "")
    }

    override fun onLevel(level: Float) = onMain {
        this.level = level
        if (acceptAsrResults && state == VoiceState.LISTENING) pushState()
    }

    override fun onStopped() = onMain {
        val session = voiceSession
        val cancelled = voiceCancelRequested || session?.cancelled == true || !acceptAsrResults
        if (session != null && session.editorGeneration == inputConnectionGeneration) {
            if (cancelled) rollbackVoiceSession(session) else commitVoiceSession(session)
        }
        composing = false
        acceptAsrResults = false
        currentPartial = ""
        level = 0f
        voiceSession = null
        voiceStartPending = false
        voiceCancelRequested = false
        state = VoiceState.IDLE
        if (session == null || session.editorGeneration == inputConnectionGeneration) {
            coordinator.endVoiceSession()
        }
        pushState()
    }

    override fun onError(message: String) = onMain {
        val session = voiceSession
        val cancelled = voiceCancelRequested || session?.cancelled == true || !acceptAsrResults
        if (session != null && session.editorGeneration == inputConnectionGeneration) {
            if (cancelled) rollbackVoiceSession(session) else commitVoiceSession(session)
        }
        composing = false
        acceptAsrResults = false
        currentPartial = ""
        level = 0f
        voiceSession = null
        voiceStartPending = false
        voiceCancelRequested = false
        state = VoiceState.ERROR
        if (session == null || session.editorGeneration == inputConnectionGeneration) {
            coordinator.endVoiceSession()
        }
        val english = when {
            message.contains("热词词表校验失败") -> "Hotword vocabulary is damaged. Reinstall the app."
            message.contains("模型与热词词表不匹配") -> "Speech model and hotword vocabulary do not match. Download the speech model again."
            message.contains("无法准备语音热词词表") -> "Could not prepare the speech hotword vocabulary."
            message.contains("热词含不支持的分隔符") -> "A hotword contains an unsupported separator. Enter words only."
            message.contains("热词含语音模型不支持的字符") -> "A hotword contains characters unsupported by the speech model."
            message.contains("行热词为空或过长") -> "A hotword is empty or too long."
            message.startsWith("热词最多") -> "Enter at most 50 hotwords."
            else -> message
        }
        pushState(message = t(this, message, english), messageCode = "ASR_ERROR")
    }

    inner class ImeBridge {
        @JavascriptInterface
        fun keyboardReady(keyboardVersion: String, minNativeApi: Int, requiredCapabilities: String, token: String) {
            onMain {
                if (token != pageToken) {
                    rejectedCalls += 1
                    return@onMain
                }
                if (keyboardVersion.length > 64 || requiredCapabilities.length > MAX_JSON_CHARS) {
                    rejectedCalls += 1
                    return@onMain
                }
                val required = runCatching {
                    JSONArray(requiredCapabilities).let { array ->
                        (0 until array.length()).map(array::getString)
                    }
                }.getOrDefault(emptyList())
                val compatible = minNativeApi in 1..NATIVE_API_VERSION &&
                    required.all(CAPABILITIES::contains)
                if (compatible) {
                    val firstReady = !pageReady
                    pageReady = true
                    panelComposeSupported = "panel-compose-v1" in required
                    // Review P2-1: a fresh page never has a band popup open,
                    // but a hot-update reload can arrive while the OLD page
                    // left overlayOpen=true - the new page would then never
                    // emit setOverlayOpen(false) and the band area would eat
                    // host touches until some popup toggled. Only reset for
                    // a fresh page: same-page inset updates must preserve
                    // the touch region of an already-open card.
                    if (firstReady && overlayOpen) {
                        overlayOpen = false
                        (keyboardView?.parent as? View)?.requestLayout()
                    }
                    // §8.3: cleanup runs only after a successful ready handshake.
                    background.execute {
                        runCatching { KeyboardUpdateCenter.store(this@FeelimeService).onHandshakeComplete() }
                    }
                    pushEditorInfo()
                } else {
                    rejectedCalls += 1
                }
            }
        }

        @JavascriptInterface
        fun key(char: String, token: String) = guarded(token, limited = false) {
            if (char.length > MAX_JSON_CHARS || char.codePointCount(0, char.length) != 1) {
                rejectedCalls += 1
                return@guarded
            }
            coordinator.key(char.codePointAt(0))
        }

        /** 单手模式侧边条的光标键（issue #15）：直接发 DPAD 键事件，
         *  跟物理方向键同一通道（终端的 cursor 语义天然兼容）。 */
        @JavascriptInterface
        fun editorCursor(dir: String, token: String) = guarded(token, limited = false) {
            val code = when (dir) {
                "left" -> KeyEvent.KEYCODE_DPAD_LEFT
                "right" -> KeyEvent.KEYCODE_DPAD_RIGHT
                "up" -> KeyEvent.KEYCODE_DPAD_UP
                "down" -> KeyEvent.KEYCODE_DPAD_DOWN
                else -> {
                    rejectedCalls += 1
                    return@guarded
                }
            }
            sendKey(code)
        }

        /** 单手模式侧边条的全选/剪切/复制/粘贴（issue #15）：走宿主
         *  TextView 的 context menu action 通道，与系统编辑菜单同源。 */
        @JavascriptInterface
        fun editorAction(action: String, token: String) = guarded(token, limited = false) {
            val id = when (action) {
                "selectAll" -> android.R.id.selectAll
                "cut" -> android.R.id.cut
                "copy" -> android.R.id.copy
                "paste" -> android.R.id.paste
                else -> {
                    rejectedCalls += 1
                    return@guarded
                }
            }
            onMain { currentInputConnection?.performContextMenuAction(id) }
        }

        @JavascriptInterface
        fun setComposition(keys: String, token: String) = guarded(token, limited = false) {
            // Variant parses are short key sequences ('xc'an').  Unicode
            // letters and combining marks are accepted for accent variants;
            // punctuation and whitespace remain rejected by the contract
            // validator.  T9 额外放行 2-9（音节条点选后的「已选音节+剩余
            // 数字」混合重写，t9.md §3）。
            val allowDigits = coordinator.currentMode ==
                com.feelime.ime.engine.InputMode.T9
            if (!BridgeContract.isValidComposition(keys, allowDigits)) {
                rejectedCalls += 1
                return@guarded
            }
            coordinator.setComposition(keys)
        }

        /** 按键反馈（issue #5 问题 2）：声音/触感各自受设置页开关控制，
         * 默认都关——都关时这里只是一次空操作。走系统通道：
         * 触感 KEYBOARD_TAP（跟随机型调校；FLAG_IGNORE_GLOBAL_SETTING
         * 让本开关成为唯一权威，避免「开了没反应」），声音
         * FX_KEY_CLICK（跟随系统音量与静音，与 WeType 行为一致）。 */
        /** 按键声音/触感（issue #5 问题 2；issue #15 真机返工）：直接走
         *  Vibrator/ToneGenerator。原先 performHapticFeedback(
         *  FLAG_IGNORE_GLOBAL_SETTING) 在 Android 14+（ColorOS 实测）不再
         *  被尊重——系统「触摸振动」总开关一关整条通道静默，开关形同虚设；
         *  playSoundEffect 同样受系统「触摸提示音」开关拦截。自播通道只
         *  摆脱这两个总开关，音量仍跟系统。 */
        @JavascriptInterface
        fun keyFeedback(token: String) = guarded(token, limited = false) {
            if (readKeyHapticEnabled(this@FeelimeService)) playKeyHaptic()
            if (readKeySoundEnabled(this@FeelimeService)) playKeySound()
        }

        private fun playKeyHaptic() {
            runCatching {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    (getSystemService(VibratorManager::class.java))?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    (getSystemService(VIBRATOR_SERVICE) as? Vibrator)
                }
                if (vibrator == null || !vibrator.hasVibrator()) return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
                } else {
                    vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 20), -1))
                }
            }
        }

        private fun playKeySound() {
            val tone = keyTone ?: runCatching {
                ToneGenerator(AudioManager.STREAM_SYSTEM, 80)
            }.getOrNull()?.also { keyTone = it } ?: return
            runCatching { tone.startTone(ToneGenerator.TONE_PROP_BEEP, 40) }
        }

        /** 快捷设置方块面板的偏好写通道：与设置页写同一批偏好
         *  （feelime_keyboard / feelime_engine / feelime_ui），落盘后广播
         *  对应 action——keyboardPrefsReceiver 重推 hello 让方块回读新
         *  状态，双拼方案广播让引擎按新 schema 重建。白名单外的键与
         *  非法值一律拒绝，不落半个值。 */
        @JavascriptInterface
        fun setQuickPref(key: String, value: String, token: String) = guarded(token, limited = false) {
            // 布尔参数只认 "1"/"0"：其他值一律拒绝，不落盘不广播。
            fun boolArg(): Boolean? = when (value) {
                "1" -> true
                "0" -> false
                else -> null
            }
            val keyboardPrefs = getSharedPreferences(KEYBOARD_PREFS_FILE, MODE_PRIVATE)
            val action = when (key) {
                "association" -> {
                    val on = boolArg() ?: return@guarded
                    keyboardPrefs.edit().putBoolean(PREF_ASSOCIATION, on).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "keySound" -> {
                    val on = boolArg() ?: return@guarded
                    keyboardPrefs.edit().putBoolean(PREF_KEY_SOUND, on).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "keyHaptic" -> {
                    val on = boolArg() ?: return@guarded
                    keyboardPrefs.edit().putBoolean(PREF_KEY_HAPTIC, on).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "candidateFont" -> {
                    val size = value.toIntOrNull()
                    if (size == null || size !in 0..2) return@guarded
                    keyboardPrefs.edit().putInt(PREF_CANDIDATE_FONT, size).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "preeditFont" -> {
                    val size = value.toIntOrNull()
                    if (size == null || size !in 0..2) return@guarded
                    keyboardPrefs.edit().putInt(PREF_PREEDIT_FONT, size).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "preeditBold" -> {
                    val on = boolArg() ?: return@guarded
                    keyboardPrefs.edit().putBoolean(PREF_PREEDIT_BOLD, on).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "keyOpacity" -> {
                    val pct = value.toIntOrNull()
                    if (pct == null || pct !in 0..100) return@guarded
                    keyboardPrefs.edit().putInt(PREF_KEY_OPACITY, pct).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "themeMode" -> {
                    // 外观页的三态主题（设置 app 写、键盘 hello 读回应用）；
                    // 键盘侧 pushStores 会把 tile/工具的改动同步回这里。
                    if (value !in listOf("auto", "light", "dark")) return@guarded
                    keyboardPrefs.edit().putString(PREF_THEME_MODE, value).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "oneHand" -> {
                    val mode = value.toIntOrNull()
                    if (mode == null || mode !in 0..2) return@guarded
                    keyboardPrefs.edit().putInt(PREF_ONE_HAND, mode).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "sideContent" -> {
                    val mode = value.toIntOrNull()
                    if (mode == null || mode !in 0..2) return@guarded
                    keyboardPrefs.edit().putInt(PREF_SIDE_CONTENT, mode).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "toolbarLayout" -> {
                    // 键盘侧已按目录/上限校验（applyToolbarLayoutValue），
                    // 这里只验证是可解析的布局对象再落盘。
                    val parsed = runCatching { JSONObject(value) }.getOrNull() ?: return@guarded
                    val left = parsed.optJSONArray("left") ?: return@guarded
                    val right = parsed.optJSONArray("right") ?: return@guarded
                    if (left.length() > 4 || right.length() > 4) return@guarded
                    keyboardPrefs.edit().putString(PREF_TOOLBAR_LAYOUT, value).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "bottomPad" -> {
                    val pad = value.toIntOrNull()
                    if (pad == null || pad !in BOTTOM_PAD_STEPS) return@guarded
                    val landscape = resources.configuration.orientation ==
                        android.content.res.Configuration.ORIENTATION_LANDSCAPE
                    keyboardPrefs.edit().putInt(
                        if (landscape) PREF_BOTTOM_PAD_DP_LANDSCAPE else PREF_BOTTOM_PAD_DP_PORTRAIT,
                        pad,
                    ).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "holdMs" -> {
                    val hold = value.toIntOrNull()
                    if (hold == null || hold !in FEEL_HOLD_STEPS) return@guarded
                    keyboardPrefs.edit().putInt(PREF_FEEL_HOLD_MS, hold).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "popupSnap" -> {
                    val snap = value.toIntOrNull()
                    if (snap == null || snap !in 0..2) return@guarded
                    keyboardPrefs.edit().putInt(PREF_FEEL_POPUP_SNAP, snap).apply()
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "uiLocale" -> {
                    if (!UiLanguage.setChoice(applicationContext, value)) return@guarded
                    ACTION_KEYBOARD_PREFS_CHANGED
                }
                "dpScheme" -> {
                    if (!com.feelime.ime.engine.DoublePinyinScheme.set(applicationContext, value)) {
                        return@guarded
                    }
                    ACTION_DP_SCHEME_CHANGED
                }
                else -> return@guarded
            }
            sendBroadcast(Intent(action).setPackage(packageName))
        }

        @JavascriptInterface
        fun space(token: String) = guarded(token, limited = false) { coordinator.space() }

        @JavascriptInterface
        fun backspace(token: String) = guarded(token, limited = true) { coordinator.backspace() }

        @JavascriptInterface
        fun enter(token: String) = guarded(token, limited = false) { enter() }

        @JavascriptInterface
        fun moveCursor(delta: Int, token: String) = guarded(token, limited = false) {
            if (delta == 0 || delta < -MAX_CURSOR_DELTA || delta > MAX_CURSOR_DELTA) {
                rejectedCalls += 1
                return@guarded
            }
            moveCursorWithinEditor(delta)
        }

        /**
         * Control-layer combos (Ctrl+C, Alt+., Ctrl+Shift+V, ...)
         * reach the HOST editor as raw key events - terminals and editors own
         * those bindings, and the IME has no business interpreting them. The
         * keycode and meta state are whitelisted: anything outside the
         * control layer's palette is dropped like other bridge abuse.
         */
        @JavascriptInterface
        fun keyEvent(keyCode: Int, metaState: Int, token: String) = guarded(token, limited = true) {
            val connection = validKeyEvent(keyCode, metaState) ?: return@guarded
 // Name the physical LEFT key beside the generic bit
            // (a real left-ctrl press reports both) - RDP hosts resolve a
            // generic-only bit to no side key and drop the combo.
            val wire = withLeftMetaBits(metaState)
            val stamp = android.os.SystemClock.uptimeMillis()
            connection.sendKeyEvent(KeyEvent(stamp, stamp, KeyEvent.ACTION_DOWN, keyCode, 0, wire))
            connection.sendKeyEvent(KeyEvent(stamp, stamp, KeyEvent.ACTION_UP, keyCode, 0, wire))
            // Device-suite observability (same pattern as the engine tag).
            android.util.Log.i("FeelimeBridge", "keyEvent code=$keyCode meta=$metaState wire=$wire")
        }

        /**
         * The PHYSICAL combo form for RDP hosts that treat the
         * Windows key differently from ctrl/alt/shift: the armed modifier's
         * LEFT key is pressed and released around the combo key (meta down,
         * key down/up, meta up), which is what a real hand does. Verified
         * against the user's test host: single-event META+D never reached
         * the remote Win handler; the discrete sequence does.
         */
        @JavascriptInterface
        fun keyEventPhysical(keyCode: Int, metaState: Int, token: String) =
            guarded(token, limited = true) {
                val connection = validKeyEvent(keyCode, metaState) ?: return@guarded
                val wire = withLeftMetaBits(metaState)
                val stamp = android.os.SystemClock.uptimeMillis()
 // (RDP round 4): four events sharing ONE timestamp
                // arrive coalesced/reordered at the client - the remote saw
                // Win down+up pair off (toggling Start) with the letter
                // trailing as a stray key. Real hardware advances eventTime;
                // step it per event so the DOWN/UP order survives.
                var eventTime = stamp
                fun emit(action: Int, code: Int, meta: Int) {
                    eventTime += 12
                    connection.sendKeyEvent(KeyEvent(stamp, eventTime, action, code, 0, meta))
                }
                fun mod(modBit: Int, leftCode: Int, ownBit: Int, down: Boolean) {
                    if (metaState and modBit != 0) {
 // (RDP round 3): the client swallows events
                        // whose meta state carries a filtered bit (META, and
                        // generically anything it special-cases) - a physical
                        // keyboard carries NO meta state on its scancodes, the
                        // host derives modifier state from the DOWN/UP order
                        // itself. Emit the modifier bare.
                        emit(if (down) KeyEvent.ACTION_DOWN else KeyEvent.ACTION_UP, leftCode, 0)
                    }
                }
                mod(KeyEvent.META_SHIFT_ON, KeyEvent.KEYCODE_SHIFT_LEFT, KeyEvent.META_SHIFT_ON, down = true)
                mod(KeyEvent.META_CTRL_ON, KeyEvent.KEYCODE_CTRL_LEFT, KeyEvent.META_CTRL_ON, down = true)
                mod(KeyEvent.META_ALT_ON, KeyEvent.KEYCODE_ALT_LEFT, KeyEvent.META_ALT_ON, down = true)
                mod(KeyEvent.META_META_ON, KeyEvent.KEYCODE_META_LEFT, KeyEvent.META_META_ON, down = true)
 // (RDP round 2): the Windows App client DROPS a
                // key event whose meta state carries META bits (dedicated Win
                // handling) - Win+D reached the host as a bare Win tap and
                // toggled the Start menu instead of showing the desktop. The
                // discrete MetaLeft DOWN/UP above already forwards, so the
                // combo key itself rides with the non-META bits only and the
                // host combines it with the held Win key.
                val keyWire = wire and (KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON).inv()
                emit(KeyEvent.ACTION_DOWN, keyCode, keyWire)
                emit(KeyEvent.ACTION_UP, keyCode, keyWire)
                mod(KeyEvent.META_META_ON, KeyEvent.KEYCODE_META_LEFT, KeyEvent.META_META_ON, down = false)
                mod(KeyEvent.META_ALT_ON, KeyEvent.KEYCODE_ALT_LEFT, KeyEvent.META_ALT_ON, down = false)
                mod(KeyEvent.META_CTRL_ON, KeyEvent.KEYCODE_CTRL_LEFT, KeyEvent.META_CTRL_ON, down = false)
                mod(KeyEvent.META_SHIFT_ON, KeyEvent.KEYCODE_SHIFT_LEFT, KeyEvent.META_SHIFT_ON, down = false)
                android.util.Log.i(
                    "FeelimeBridge",
                    "keyEvent code=$keyCode meta=$metaState wire=$wire form=physical",
                )
            }

        /** Shared keyEvent validation: the keycode whitelist (A..Z + the
         * control palette) and the meta-bit mask. Null = rejected. */
        private fun validKeyEvent(keyCode: Int, metaState: Int): android.view.inputmethod.InputConnection? {
 // RDP hosts (Windows App) resolve a generic meta bit
            // to no physical side key and drop the combo - the wire state
            // must name the LEFT variant beside the generic bit (a physical
            // left-ctrl press reports both), so both are accepted here.
            val allowedMeta = KeyEvent.META_SHIFT_ON or KeyEvent.META_ALT_ON or
                KeyEvent.META_CTRL_ON or KeyEvent.META_META_ON or
                KeyEvent.META_SHIFT_LEFT_ON or KeyEvent.META_ALT_LEFT_ON or
                KeyEvent.META_CTRL_LEFT_ON or KeyEvent.META_META_LEFT_ON
            val codeAllowed = keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z ||
                keyCode in KEY_EVENT_CODES
            if (!codeAllowed || metaState and allowedMeta.inv() != 0) {
                rejectedCalls += 1
                return null
            }
            return currentInputConnection
        }

        /** Generic meta bits name their LEFT variant too (the
         * wire form a physical left-key press reports). */
        private fun withLeftMetaBits(metaState: Int): Int {
            var wire = metaState
            if (metaState and KeyEvent.META_SHIFT_ON != 0) wire = wire or KeyEvent.META_SHIFT_LEFT_ON
            if (metaState and KeyEvent.META_ALT_ON != 0) wire = wire or KeyEvent.META_ALT_LEFT_ON
            if (metaState and KeyEvent.META_CTRL_ON != 0) wire = wire or KeyEvent.META_CTRL_LEFT_ON
            if (metaState and KeyEvent.META_META_ON != 0) wire = wire or KeyEvent.META_META_LEFT_ON
            return wire
        }

        private fun leftMetaBit(keyCode: Int): Int = when (keyCode) {
            KeyEvent.KEYCODE_SHIFT_LEFT -> KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON
            KeyEvent.KEYCODE_CTRL_LEFT -> KeyEvent.META_CTRL_ON or KeyEvent.META_CTRL_LEFT_ON
            KeyEvent.KEYCODE_ALT_LEFT -> KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON
            KeyEvent.KEYCODE_META_LEFT -> KeyEvent.META_META_ON or KeyEvent.META_META_LEFT_ON
            else -> 0
        }

        @JavascriptInterface
        fun chooseCandidate(revision: Long, candidateId: String, token: String) = guarded(token, limited = false) {
            if (candidateId.length > MAX_CANDIDATE_ID_CHARS ||
                !candidateId.all { it in '0'..'9' || it in 'a'..'f' || it == ':' }
            ) {
                rejectedCalls += 1
                return@guarded
            }
            coordinator.choose(revision, candidateId)
        }

        @JavascriptInterface
        fun pageNext(revision: Long, token: String) = guarded(token, limited = false) { coordinator.pageNext(revision) }

        @JavascriptInterface
        fun pagePrevious(revision: Long, token: String) = guarded(token, limited = false) { coordinator.pagePrevious(revision) }

        @JavascriptInterface
        fun selectMode(mode: String, token: String) = guarded(token, limited = false) {
            if (mode.length > 32) {
                rejectedCalls += 1
                return@guarded
            }
            val next = InputModeBridge.fromWire(mode)
            val ready = next?.let { engineDataReady(mode) } == true
            android.util.Log.i("FeelimeEngine", "bridge selectMode wire=$mode parsed=$next ready=$ready")
            Diagnostics.log("selectMode", "mode=${next?.wireName ?: "invalid"} ready=$ready")
            if (next == null || !ready) {
                rejectedCalls += 1
                if (next != null && !ready) {
                    pushState(
                        message = t(
                            this@FeelimeService,
                            "该输入法正在准备语言数据，请稍后再试",
                            "Language data is still being prepared. Try again shortly",
                        ),
                        messageCode = "ENGINE_DATA_PREPARING",
                    )
                }
                return@guarded
            }
            when (coordinator.selectMode(next)) {
                TextInputCoordinator.ModeSelectionResult.BLOCKED_SENSITIVE_EDITOR -> {
                    pushState(
                        message = t(
                            this@FeelimeService,
                            "密码输入框只能使用英文键盘",
                            "Password fields only support English Direct",
                        ),
                        messageCode = "SENSITIVE_EDITOR_DIRECT_ONLY",
                    )
                }
                else -> Unit
            }
            pushBridgeHello()
        }

        @JavascriptInterface
        fun startVoice(token: String) = guarded(token, limited = false) { startVoice() }

        @JavascriptInterface
        fun stopVoice(token: String) = guarded(token, limited = false) { stopVoice() }

        @JavascriptInterface
        fun cancelVoice(token: String) = guarded(token, limited = false) { cancelVoice() }

        @JavascriptInterface
        fun switchInputMethod(token: String) = guarded(token, limited = false) { switchIme() }

        /**
         * The height the user dragged (CSS px from the WebView,
         * where 1px == 1dp). Clamped: never below a usable keyboard, never
         * above 45% of the portrait height / half of the landscape height
         * (F key), and persisted per orientation.
         */
        @JavascriptInterface
        fun setKeyboardHeight(heightCssPx: Int, token: String) = guarded(token, limited = false) {
            val landscape =
                resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
            if (heightCssPx == 0) {
                // Reset this orientation; do not let a queued drag save put
                // the old value back after the user restores the default.
                if (pendingHeightLandscape == landscape) {
                    main.removeCallbacks(flushHeightPref)
                    pendingHeightWrite = 0
                }
                getSharedPreferences("feelime_keyboard", MODE_PRIVATE).edit()
                    .remove(if (landscape) "keyboard_height_landscape" else "keyboard_height_portrait")
                    .apply()
                keyboardHeightOverride = 0
                (keyboardView?.parent as? View)?.requestLayout()
                pushBridgeHello()
                return@guarded
            }
            val metrics = resources.displayMetrics
            val physical = (heightCssPx * metrics.density).toInt()
            val available = metrics.heightPixels
 // C: the old landscape budget (screen/3) sat BELOW the
            // 170dp floor, so coerceIn(min, min) pinned every drag to the
            // same value - the gesture read as dead. Half the screen lifts
            // the ceiling back above the floor.
            val min = dp(if (landscape) 170 else 210)
 // the landscape ceiling is a fraction of the REAL
            // screen (app-space heightPixels drops the system bars and landed
            // BELOW the keyboard's content minimum - bottom row clipped).
            val max = if (landscape) realHeightPixels() / 2 else (available * 45) / 100
            val clamped = physical.coerceIn(min, maxOf(min, max))
            if (clamped != keyboardHeightOverride) {
                keyboardHeightOverride = clamped
                (keyboardView?.parent as? View)?.requestLayout()
            }
 // A: the drag flushes one call per frame - commit the
            // pref on a debounce so the flash never rides a disk write.
            pendingHeightWrite = clamped
            pendingHeightLandscape = landscape
            main.removeCallbacks(flushHeightPref)
            main.postDelayed(flushHeightPref, HEIGHT_PREF_DEBOUNCE_MS)
            android.util.Log.i("FeelimeBridge", "setKeyboardHeight css=$heightCssPx px=$clamped orientation=${if (landscape) "landscape" else "portrait"}")
        }

        /** A popup moved into the float band above the keyboard -
         * the band must become touchable until it closes (onComputeInsets
         * reads overlayOpen). The requestLayout ride makes the IME recompute
         * its insets on the next traversal. */
        @JavascriptInterface
        fun setOverlayOpen(open: Boolean, token: String) = guarded(token, limited = false) {
            onMain {
                if (overlayOpen == open) return@onMain
                overlayOpen = open
                (keyboardView?.parent as? View)?.requestLayout()
                android.util.Log.i("FeelimeBridge", "setOverlayOpen open=$open")
            }
        }

        @JavascriptInterface
        fun hideKeyboard(token: String) = guarded(token, limited = false) { onMain { requestHideSelf(0) } }

        @JavascriptInterface
        fun openSetup(token: String) = guarded(token, limited = false) { openSetup() }

        /** design §15: the custom-keyboard table's native mirror (the
         * settings page edits the same store). Synchronous prefs read on the
         * bridge thread; empty string = unset, "disabled" = the settings
         * switch turned the custom layer off (the keyboard must
         * be able to tell that apart from unset, or the switch is a no-op). */
        @JavascriptInterface
        fun customKeys(token: String): String {
            if (token != pageToken) return ""
            val store = com.feelime.ime.CustomKeysStore(applicationContext)
            return if (store.enabled()) store.json() else "disabled"
        }

        @JavascriptInterface
        fun setCustomKeys(json: String, token: String) = guarded(token, limited = false) {
            if (json.isNotEmpty() && json.length <= MAX_JSON_CHARS) {
                com.feelime.ime.CustomKeysStore(applicationContext).save(json, enabled = true)
            }
        }

        /** 键盘页把 localStorage 里设置级的键镜像上来（备份数据源，
         * docs/design/userdata.md §1.4）：握手后与这些键变化时各调一次。
         * 只收录白名单键，最近符号/emoji 等使用痕迹不进备份。
         * 返回递增的 rev——键盘页存下它，握手时与原生比对决定
         * 谁更新（设置页导入会让 rev 跳号，键盘页据此拉取恢复值）。 */
        @JavascriptInterface
        fun pushStores(json: String, token: String): String = guardedStore(token) {
            if (json.isEmpty() || json.length > MAX_JSON_CHARS) return@guardedStore ""
            runCatching {
                val parsed = JSONObject(json)
                val mirror = readStoresMirror()
                val merged = JSONObject()
                for (key in com.feelime.ime.backup.UserdataBackup.WEBVIEW_STORE_KEYS) {
                    val value = parsed.opt(key) ?: continue
                    merged.put(key, value)
                }
                val nextRev = mirror.optInt("rev", 0) + 1
                val payload = JSONObject().put("rev", nextRev).put("values", merged)
                com.feelime.ime.backup.AndroidPrefs(applicationContext)
                    .put(
                        com.feelime.ime.backup.UserdataBackup.WEBVIEW_PREFS,
                        com.feelime.ime.backup.UserdataBackup.WEBVIEW_KEY,
                        payload.toString(),
                    )
                nextRev.toString()
            }.getOrDefault("")
        }

        /** 键盘页握手时拉取镜像（rev + 白名单值）。rev 大于本地已见的值，
         * 说明设置页恢复过备份，键盘页先落地恢复值再继续。 */
        @JavascriptInterface
        fun getStores(token: String): String = guardedStore(token) {
            readStoresMirror().toString()
        }

        private fun readStoresMirror(): JSONObject {
            val raw = com.feelime.ime.backup.AndroidPrefs(applicationContext)
                .all(com.feelime.ime.backup.UserdataBackup.WEBVIEW_PREFS)
                .get(com.feelime.ime.backup.UserdataBackup.WEBVIEW_KEY) as? String
            return runCatching { JSONObject(raw ?: "{}") }.getOrDefault(JSONObject())
        }

        /** stores 通道的守卫：与 guarded 相同的 token 校验，但不限流、
         * 可携带返回值。 */
        private fun guardedStore(token: String, action: () -> String): String {
            if (token != pageToken || !pageReady) return ""
            return action()
        }

        /** The panel add/edit inputs report focus here so editor
         * writes can be redirected into them (see panelInputActive). */
        @JavascriptInterface
        fun panelInput(active: Boolean, token: String) = guarded(token, limited = false) {
            panelInputRequested = active
            pendingPanelSelection = null
            val generation = ++panelRouteGeneration
            coordinator.acceptCurrentComposition {
                if (generation == panelRouteGeneration) {
                    panelInputActive = active
                    if (active) coordinator.onInputTargetSelection(-1, -1)
                    else coordinator.onInputTargetSelection(hostSelectionStart, hostSelectionEnd)
                }
            }
        }

        /** 中文联想点击（docs/design/association.md §3）：写入编辑器，
         * 然后以该词为前词给出连续联想。 */
        @JavascriptInterface
        fun commitAssoc(text: String, token: String) = guarded(token, limited = false) {
            if (text.isEmpty() || text.length > 32) return@guarded
            onMain {
                if (panelInputActive) return@onMain
                coordinator.pasteExternal(text)
                if (readAssociation(applicationContext)) {
                    // 表在 commit 路径已预热，这里是暖读
                    pushAssoc(com.feelime.ime.engine.AssociationStore.next(applicationContext, text))
                }
            }
        }

        @JavascriptInterface
        fun panelSelection(start: Int, end: Int, session: Int, token: String) = guarded(token, limited = false) {
            if (!panelComposeSupported || !panelInputRequested || start < 0 || end < 0 || session < 0) {
                rejectedCalls += 1
                return@guarded
            }
            pendingPanelSelection = Triple(start, end, session)
            val generation = panelRouteGeneration
            // Capture every field transition in the same input queue. A
            // mutable latest selection would send keys typed in B into C
            // when A's event is still waiting on the main looper.
            coordinator.acceptCurrentComposition {
                if (generation == panelRouteGeneration && panelInputActive) {
                    panelSession = session
                    coordinator.onInputTargetSelection(start, end)
                }
            }
        }

        @JavascriptInterface
        fun panelFlush(session: Int, token: String) = guarded(token, limited = false) {
            if (!panelComposeSupported || !panelInputRequested ||
                session != (pendingPanelSelection?.third ?: panelSession)) {
                rejectedCalls += 1
                return@guarded
            }
            val generation = panelRouteGeneration
            coordinator.acceptCurrentComposition {
                if (generation == panelRouteGeneration && panelInputActive && session == panelSession) {
                    val payload = JSONObject().put("session", session)
                    evaluate("window.Feelime && window.Feelime.onPanelFlushed && window.Feelime.onPanelFlushed($payload)")
                }
            }
        }

        /** Phrase CRUD happens IN the favorites panel (the bridge
         * calls below); the old native-manager deep link is gone.
         * [rank] is the 1-based candidate slot for exact code
         * matches (default 1 = pool head, as before rank slots existed). */
        @JavascriptInterface
        fun favoritesAdd(text: String, code: String, rank: Int, token: String) = guarded(token, limited = false) {
            if (text.isEmpty() || text.length > MAX_JSON_CHARS || code.length > 12 ||
                rank < 1 || rank > 99
            ) {
                rejectedCalls += 1
                return@guarded
            }
            favoritesStore.add(text, code.trim(), rank)
        }

        @JavascriptInterface
        fun favoritesUpdate(id: String, text: String, code: String, rank: Int, token: String) = guarded(token, limited = false) {
            if (id.isEmpty() || id.length > 64 || text.isEmpty() ||
                text.length > MAX_JSON_CHARS || code.length > 12 ||
                rank < 1 || rank > 99
            ) {
                rejectedCalls += 1
                return@guarded
            }
            favoritesStore.update(id, text, code.trim(), rank)
        }

        @JavascriptInterface
        fun favoritesRemove(id: String, token: String) = guarded(token, limited = false) {
            if (id.isEmpty() || id.length > 64) {
                rejectedCalls += 1
                return@guarded
            }
            favoritesStore.remove(id)
        }

        @JavascriptInterface
        fun favoritesMove(id: String, to: Int, token: String) = guarded(token, limited = false) {
            if (id.isEmpty() || id.length > 64 || to < 0 || to > 200) {
                rejectedCalls += 1
                return@guarded
            }
            favoritesStore.move(id, to)
        }

        @JavascriptInterface
        fun reloadKeyboard(token: String) = guarded(token, limited = false) {
            onMain { reloadKeyboardFiles() }
        }

        @JavascriptInterface
        fun requestState() {
            onMain {
                pushBridgeHello()
                pushState()
                pushEditorInfo()
            }
        }

        /** Panel paste (clipboard/favorites): multi-code-point external commit. */
        @JavascriptInterface
        fun commitText(text: String, token: String) = guarded(token, limited = false) {
            val valid = text.isNotEmpty() &&
                text.codePointCount(0, text.length) <= MAX_COMMIT_CODE_POINTS &&
                runCatching {
                    var index = 0
                    while (index < text.length) {
                        val codePoint = text.codePointAt(index)
                        // Reject NUL and unpaired surrogates (not valid text).
                        if (codePoint == 0) return@runCatching false
                        if (Character.isHighSurrogate(text[index]) &&
                            (index + 1 >= text.length || !Character.isLowSurrogate(text[index + 1]))
                        ) {
                            return@runCatching false
                        }
                        if (Character.isLowSurrogate(text[index])) return@runCatching false
                        index += Character.charCount(codePoint)
                    }
                    true
                }.getOrDefault(false)
            if (!valid) {
                rejectedCalls += 1
                return@guarded
            }
            coordinator.pasteExternal(text)
        }

        /** Candidate-bar ×: abort composition, restore the toolbar.
         * During a voice session the editor span belongs to the ASR partial,
         * so only the engine pinyin buffer is reset . */
        @JavascriptInterface
        fun clearComposing(token: String) = guarded(token, limited = false) {
            onMain {
                coordinator.clearComposing(scrubEditor = state == VoiceState.IDLE)
            }
        }

        /** Delete the highlighted candidate from the engine's
         * user lexicon (librime Shift+Delete channel). Old keyboards never
         * call this; older APKs simply lack the method and the keyboard
         * feature-detects it. */
        @JavascriptInterface
        fun deleteHighlightedCandidate(token: String) = guarded(token, limited = false) {
            onMain { coordinator.deleteHighlighted() }
        }

        /** Delete ANY candidate by pool id (seek + move highlight
         * + Shift+Delete). Same id alphabet as chooseCandidate. */
        @JavascriptInterface
        fun deleteCandidate(revision: Long, candidateId: String, token: String) =
            guarded(token, limited = false) {
                if (candidateId.length > MAX_CANDIDATE_ID_CHARS ||
                    !candidateId.all { it in '0'..'9' || it in 'a'..'f' || it == ':' }
                ) {
                    rejectedCalls += 1
                    return@guarded
                }
                onMain { coordinator.deleteCandidate(candidateId) }
            }

        @JavascriptInterface
        fun getClipboard(token: String) = guarded(token, limited = false) {
            onMain { pushClipboard() }
        }

        @JavascriptInterface
        fun removeClipboard(id: String, token: String) = guarded(token, limited = true) {
            if (!isPanelId(id)) {
                rejectedCalls += 1
                return@guarded
            }
            // Push only after the mutation lands, or the panel re-renders the
            // pre-removal list . The store serializes its mutations onto the
            // main thread itself (same thread as the capture paths).
            clipboardStore.remove(id)
            main.post { pushClipboard() }
        }

        @JavascriptInterface
        fun clearClipboard(token: String) = guarded(token, limited = true) {
            clipboardStore.clear()
            main.post { pushClipboard() }
        }

        @JavascriptInterface
        fun getFavorites(token: String) = guarded(token, limited = false) {
            onMain { pushFavorites() }
        }

        @JavascriptInterface
        fun removeFavorite(id: String, token: String) = guarded(token, limited = true) {
            if (!isPanelId(id)) {
                rejectedCalls += 1
                return@guarded
            }
            background.execute {
                favoritesStore.remove(id)
                main.post { pushFavorites() }
            }
        }

        /** Panel ids are hex timestamps (PanelStore idCounter format). */
        private fun isPanelId(id: String): Boolean =
            id.isNotEmpty() && id.length <= 16 && id.all { it in '0'..'9' || it in 'a'..'f' }

        /** Token gate plus the 25/s sliding-window throttle for repeatable keys. */
        private fun guarded(token: String, limited: Boolean, action: () -> Unit) {
            onMain {
                if (token != pageToken || !pageReady) {
                    rejectedCalls += 1
                    return@onMain
                }
                if (limited && !throttleAllows()) {
                    rejectedCalls += 1
                    return@onMain
                }
                action()
            }
        }

        private fun throttleAllows(): Boolean {
            val now = android.os.SystemClock.elapsedRealtime()
            while (callTimes.isNotEmpty() && now - callTimes.first() > 1000) callTimes.removeFirst()
            if (callTimes.size >= CALLS_PER_SECOND) return false
            callTimes.addLast(now)
            return true
        }
    }

    private fun isSensitiveEditor(info: EditorInfo? = currentInputEditorInfo): Boolean =
        com.feelime.ime.engine.InputSensitivity.isSensitive(info?.inputType)

    private fun isTerminalLikeEditor(info: EditorInfo?): Boolean =
        info != null && info.inputType and InputType.TYPE_MASK_CLASS == InputType.TYPE_NULL

    /**
     * Editors whose VISIBLE text surface is not the
     * InputConnection buffer at all. xterm.js-style web terminal shells
     * (Tauri-based WebView hosts) mirror committed text into a hidden helper
     * textarea: snapshots read "abc" and setSelection callbacks report the
     * caret moving, while the terminal cursor never follows - only real
     * key events reach it (device-logged 2026-09-07; Found the
     * same lie for deletion). Whole-app terminal shells are listed here so
     * cursor scrub rides the arrow-key channel; mixed hosts (browsers)
     * must NOT be listed - their ordinary text fields need the snapshot
     * path. Native terminals keep the TYPE_NULL detection above.
     */
    private fun isKeyEventCursorEditor(info: EditorInfo?): Boolean {
        if (isTerminalLikeEditor(info)) return true
        return info?.packageName in KEY_EVENT_CURSOR_PACKAGES
    }

    private fun blocked() = WebResourceResponse(
        "text/plain",
        "UTF-8",
        403,
        "Blocked",
        emptyMap(),
        java.io.ByteArrayInputStream(ByteArray(0)),
    )

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    /** Real display height (physical px, rotation-aware). The APP-space
     * heightPixels excludes the system bars, so a cap derived from it sits
     * below the keyboard's own content minimum once Grew the
     * landscape toolbar - the bottom key row clipped on every landscape
     * device (AVD 1080x2400: cap 508px vs content 522px).
     * caps must be fractions of the REAL screen. */
    private fun realHeightPixels(): Int {
        return if (android.os.Build.VERSION.SDK_INT >= 30) {
            val wm = getSystemService(android.view.WindowManager::class.java)
            wm?.maximumWindowMetrics?.bounds?.height() ?: resources.displayMetrics.heightPixels
        } else {
            val real = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            display?.getRealMetrics(real)
            if (real.heightPixels > 0) real.heightPixels else resources.displayMetrics.heightPixels
        }
    }

    /** Persisted keyboard height for the CURRENT orientation (physical px,
     * 0 when unset). . */
    private fun storedKeyboardHeight(): Int {
        val prefs = getSharedPreferences("feelime_keyboard", MODE_PRIVATE)
        val landscape =
            resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
        return prefs.getInt(if (landscape) "keyboard_height_landscape" else "keyboard_height_portrait", 0)
    }

    // ===== Keyboard-side prefs (mode-fallback §3/§4). Values live in the
    // feelime_keyboard prefs file; the settings app writes them through
    // SettingsBridge and broadcasts ACTION_KEYBOARD_PREFS_CHANGED. Invalid
    // persisted values fall back to the defaults (the backup whitelist
    // validates on restore too). =====

    private fun keyboardPrefs() = getSharedPreferences(KEYBOARD_PREFS_FILE, MODE_PRIVATE)

    /** Bottom blank strip below the key rows, in dp (== CSS px in this
     *  WebView). Default 0 keeps the rows flush with the screen bottom. */
    private fun bottomPadDp(): Int = readBottomPadDp(this)

    private fun bottomPadPx(): Int =
        (bottomPadDp() * resources.displayMetrics.density).toInt()

    fun feelScrubSpeed(): Int = readFeelScrubSpeed(this)

    fun feelHoldMs(): Int = readFeelHoldMs(this)

    fun feelPopupSnap(): Int = readFeelPopupSnap(this)

    /** 候选字号档位（issue #2）：0=正常 1=大 2=更大。 */
    private fun candidateFont(): Int = readCandidateFont(this)

    /** 拼音字号档位（issue #8）：0=标准 1=大 2=特大。 */
    private fun preeditFont(): Int = readPreeditFont(this)

    /** Current system area overlapped by the keyboard. WindowMetrics avoids
     * decor insets already consumed by InputMethodService; layout callbacks
     * recheck overlap after the window has moved or changed orientation. */
    @Suppress("DEPRECATION")
    private fun navBottomInset(): Int {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            val metrics = getSystemService(android.view.WindowManager::class.java).currentWindowMetrics
            // Gesture-start regions can be larger than the visible system
            // bar. Reserve drawing/tap occlusion, not that entire region.
            val types = android.view.WindowInsets.Type.navigationBars() or
                android.view.WindowInsets.Type.tappableElement()
            // oplus gesture nav: the collapse/switch handles sit higher than
            // the reported nav reserve (ace: reserve 16px, handles ~24dp).
            val floor = oplusInsetFloor()
            val reserved = maxOf(metrics.windowInsets.getInsets(types).bottom, floor)
            if (reserved == 0) return 0
            if (reserved > 0) {
                // Decor insets may already be consumed by InputMethodService.
                // Reserve only the part our actual WebView overlaps; windows
                // already placed above the system area need no second padding.
                // Read only while the keyboard is actually shown: mid-animation
                // the view's on-screen position is transient and every read is
                // garbage (device gate: a show/hide flip briefly reported the
                // full reserve and hello budgeted 11px the view never grows).
                val view = keyboardView
                if (isInputViewShown && view != null && view.isLaidOut && view.height > 0) {
                    val location = IntArray(2)
                    view.getLocationOnScreen(location)
                    val bottom = location[1] + view.height
                    val overlap = (bottom - (metrics.bounds.bottom - reserved)).coerceIn(0, reserved)
                    lastShownSafeBottom = overlap
                    return overlap
                }
                // Hidden or not yet laid out: the overlap cannot be measured
                // now, and the old full-reserve guess here reported an inset
                // the shown-state measure never grows the view by - hello
                // then budgets safe rows the view doesn't have (device gate:
                // a pad flip moved --safe-bottom 0→11px and shrank rows
                // 46→43). Report the last value observed while visible.
                return lastShownSafeBottom.coerceIn(0, reserved)
            }
        }
        val insets = window?.window?.decorView?.rootWindowInsets
        val reported = if (android.os.Build.VERSION.SDK_INT >= 29 && insets != null) {
            maxOf(insets.systemWindowInsetBottom, insets.tappableElementInsets.bottom)
        } else insets?.systemWindowInsetBottom ?: 0
        return effectiveBottomInset(reported)
    }

    /** API≤29 fallback (navBottomInset reads WindowMetrics on 30+ and
     * applies oplusInsetFloor() there): apply the oplus gesture floor,
     * otherwise the legacy behaviour - keep a reported inset, and when
     * the system reports none, estimate from navigation_bar_height
     * (landscape only, capped at 32dp). */
    private fun effectiveBottomInset(reported: Int): Int {
        val floor = oplusInsetFloor()
        if (floor > 0) return maxOf(reported, floor)
        if (reported > 0) return reported
        if (resources.configuration.orientation !=
            android.content.res.Configuration.ORIENTATION_LANDSCAPE
        ) return 0
        if (navInsetFallback < 0) {
            val id = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            val raw = if (id > 0) resources.getDimensionPixelSize(id) else 0
            navInsetFallback = minOf(raw, (32 * resources.displayMetrics.density).toInt())
        }
        return navInsetFallback
    }

    /** 24dp floor on oplus gesture nav - the collapse-keyboard /
     * IME-switcher handles draw above the reported nav reserve (ace:
     * reserve 16px, handles ~24dp, issue #5). Resolved once per process;
     * 0 = not an oplus gesture device. */
    private var oplusFloorResolved = -1
    private fun oplusInsetFloor(): Int {
        if (oplusFloorResolved < 0) {
            val hit = isOplusRom && android.os.Build.VERSION.SDK_INT >= 29 &&
                isGestureNavigation()
            oplusFloorResolved = if (hit) {
                (24 * resources.displayMetrics.density).toInt()
            } else 0
            if (BuildConfig.DEBUG) {
                android.util.Log.d(
                    "FeelimeService",
                    "oplus inset floor=$oplusFloorResolved " +
                        "(oplus=$isOplusRom gesture=${isGestureNavigation()})",
                )
            }
        }
        return oplusFloorResolved
    }

    /** oplus 代码库探测（ColorOS 与 OxygenOS/realme UI 同源，营销名不参与判定）。
     * 只用公共 Build 字段：这三家品牌共享一套 SystemUI，会把收起键盘/切换
     * 输入法把手画在输入法窗口之上（issue #5）。早期用 SystemProperties
     * 反射取 ro.build.version.oplusrom，无法证明各 ROM 放行 app 反射，
     * 换成零风险的公开信号。 */
    private val isOplusRom: Boolean =
        android.os.Build.BRAND.lowercase() in setOf("oppo", "oneplus", "realme")

    /** Settings.Secure.navigation_mode: 2 = 手势导航（API 29+）。 */
    private fun isGestureNavigation(): Boolean = try {
        Settings.Secure.getString(contentResolver, "navigation_mode") == "2"
    } catch (error: Exception) {
        false
    }

    /** Watch the decor view's insets so a navigation-bar inset
     * that lands after the first hello still reaches the keyboard (re-push
     * hello on change). */
    private fun installBottomInsetWatcher() {
        if (insetWatcherInstalled) return
        val decor = window?.window?.decorView ?: return
        insetWatcherInstalled = true
        decor.setOnApplyWindowInsetsListener { view, insets ->
            view.post { onBottomInsetChanged() }
            view.onApplyWindowInsets(insets)
        }
        decor.requestApplyInsets()
    }

    private fun onBottomInsetChanged() {
        val effective = navBottomInset()
        if (effective == lastSafeBottom) return
        // Re-read once after the window settles: a mid-animation read can
        // transiently disagree, and adopting it re-budges the JS rows.
        if (!insetChangeConfirmed) {
            insetChangeConfirmed = true
            keyboardView?.postDelayed({ insetChangeConfirmed = false; onBottomInsetChanged() }, 300)
            return
        }
        insetChangeConfirmed = false
        lastSafeBottom = effective
        (keyboardView?.parent as? View)?.requestLayout()
        pushBridgeHello()
    }

    private inner class FixedHeightInputView(private val desiredHeight: Int) : FrameLayout(this) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
 // A user-dragged height wins when set; landscape
            // must never cover a third of the screen - the host editor above
            // stays usable. Portrait keeps the 272dp design budget unless
            // the user adjusted it.
            //
            // The height must come from STABLE quantities
            // only. Deriving it from the incoming measure spec bakes in the
            // transient height ColorOS reports while the IME window is still
            // animating in (~120px spec -> 40px view) and nothing re-measures
            // once the window settles at its real 360px - the keyboard stayed
            // a 40px sliver, reproducible on every landscape show. The window
            // wraps this view, so it settles at exactly the height measured
            // here; the display metrics do not fluctuate mid-animation.
            val landscape =
                resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
            val base = if (keyboardHeightOverride > 0) keyboardHeightOverride else desiredHeight
            val screenH = resources.displayMetrics.heightPixels
 // Review Mirror setKeyboardHeight's clamps here so a
            // pref carried to a smaller screen (backup restore, freeform)
            // cannot push the keyboard past its budget either.
 // the landscape ceiling mirrors the real-screen
            // fraction (see setKeyboardHeight) - app-space heightPixels sits
            // below the content minimum and clipped the bottom row. The view
            // is bottom-anchored to the SCREEN, so the gesture-nav strip
            // (lastSafeBottom) overlaps it: the keyboard's own budget must
            // grow by the inset or the JS row floor (32css) overflows and
            // the bottom row lands under the strip.
            val height = when {
 // Review P2-6: navBottomInset resolves the -1
                // "not observed yet" sentinel through the fallback chain;
                // the raw field could subtract a pixel from the first frame.
                // bottomPad rides OUTSIDE the content clamp (mode-fallback
                // §3): the user's bottom blank strip adds on top of the
                // clamped content height in every branch.
                landscape && screenH > 0 ->
                    minOf(base, realHeightPixels() / 2) + navBottomInset() + bottomPadPx()
                screenH > 0 -> minOf(base, (screenH * 45) / 100) + navBottomInset() + bottomPadPx()
                else -> base + navBottomInset() + bottomPadPx()
            }
 // The view carries the transparent popup band on
            // top; onComputeInsets keeps the app sized to the keyboard
            // alone (contentTopInsets = band).
            val total = height + floatBandPx()
            // Height settled at a new value: tell the JS once more AFTER the
            // layout. Hello's deferred re-derives land at arbitrary offsets
            // from this measure and can bake a mid-flight row budget that
            // nothing later corrects (device gate: rows stuck at 37/55 after
            // a bottom-pad flip). The post-measure notify is authoritative:
            // it reads the final geometry by construction.
            if (total != lastMeasuredHeight) {
                lastMeasuredHeight = total
                post { keyboardView?.evaluateJavascript(HEIGHT_SETTLED_JS, null) }
            }
            super.onMeasure(
                widthMeasureSpec,
                View.MeasureSpec.makeMeasureSpec(total, View.MeasureSpec.EXACTLY),
            )
        }
    }

    private enum class VoiceState(val wireName: String) {
        IDLE("idle"),
        LOADING("loading"),
        LISTENING("listening"),
        STOPPING("stopping"),
        ERROR("error"),
    }

    private companion object {
        const val LOCAL_HOST = "feelime.local"
        /** Re-derive the JS row budget from the settled view geometry. */
        const val HEIGHT_SETTLED_JS =
            "window.Feelime && window.Feelime.applyHeightNow && window.Feelime.applyHeightNow()"
        const val KEYBOARD_URL = "https://$LOCAL_HOST/keyboard/index.html"
        const val BRIDGE_NAME = "FeelimeNative"
 // The control layer's palette - Esc/Tab/Home/End, the
        // four arrows, PgUp/PgDn, forward delete (Del) and '.' (Alt+.) / F4.
 // F1..F12 (Fn sticky layer + custom keys) and the physical
        // Backspace/Enter/Space join the palette (custom-key DSL).
        val KEY_EVENT_CODES = intArrayOf(
            KeyEvent.KEYCODE_ESCAPE,
            KeyEvent.KEYCODE_TAB,
            KeyEvent.KEYCODE_MOVE_HOME,
            KeyEvent.KEYCODE_MOVE_END,
            KeyEvent.KEYCODE_PAGE_UP,
            KeyEvent.KEYCODE_PAGE_DOWN,
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_FORWARD_DEL,
            KeyEvent.KEYCODE_PERIOD,
            KeyEvent.KEYCODE_F4,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_SPACE,
            KeyEvent.KEYCODE_DEL,
            KeyEvent.KEYCODE_F1,
            KeyEvent.KEYCODE_F2,
            KeyEvent.KEYCODE_F3,
            KeyEvent.KEYCODE_F5,
            KeyEvent.KEYCODE_F6,
            KeyEvent.KEYCODE_F7,
            KeyEvent.KEYCODE_F8,
            KeyEvent.KEYCODE_F9,
            KeyEvent.KEYCODE_F10,
            KeyEvent.KEYCODE_F11,
            KeyEvent.KEYCODE_F12,
 // A second tap on an armed sticky modifier fires the
            // BARE left key (Win alone opens the Start menu, Alt alone the
            // menu bar) instead of silently disarming.
            KeyEvent.KEYCODE_CTRL_LEFT,
            KeyEvent.KEYCODE_ALT_LEFT,
            KeyEvent.KEYCODE_META_LEFT,
        )
        val NATIVE_API_VERSION get() = BridgeContract.NATIVE_API_VERSION
        val CAPABILITIES get() = BridgeContract.CAPABILITIES
        const val MAX_JSON_CHARS = 4096
        const val MAX_CANDIDATE_ID_CHARS = 96
        const val MAX_COMMIT_CODE_POINTS = 2000
        const val MAX_CURSOR_DELTA = 256
        const val MAX_CURSOR_CONTEXT_CHARS = 2048
        const val MAX_PENDING_CURSOR_DELTA = 16_384L
        const val CALLS_PER_SECOND = 25
        const val HEIGHT_PREF_DEBOUNCE_MS = 300L

        /**
         * Whole-app terminal shells (see [isKeyEventCursorEditor]): their
         * only editable surface is a web/native terminal, so every cursor
         * movement rides key events. Termux is listed for completeness -
         * its TYPE_NULL inputType already matches.
         */
        val KEY_EVENT_CURSOR_PACKAGES = setOf(
            "com.termux",
            "com.ohmyterm.mobile",
        )
    }
}
