package com.feelime.ime

import android.Manifest
import android.app.StatusBarManager
import android.content.Intent
import android.content.ComponentName
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.database.ContentObserver
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.Icon
import android.net.Uri
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.text.InputType
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import com.feelime.ime.update.KeyboardStore
import com.feelime.ime.update.KeyboardPackageVerifier
import com.feelime.ime.update.KeyboardUpdateErrorCode
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.feelime.ime.update.KeyboardUpdateCenter
import org.json.JSONObject
import java.security.SecureRandom

/** Thin shell around the full-settings WebView (design §6.2).
 * (assets/settings/). All layout/interaction lives in the HTML page and its
 * bridge ([SettingsBridge]); the shell keeps only what must be native:
 * permission runtime flow, system IME intents, the launch nonce consumed by
 * device gates, and the debug editor fixtures (gates drive them by
 * contentDescription). */
class SetupActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: SettingsBridge
    private lateinit var rootLayout: LinearLayout
    /** Drops callbacks already posted by SettingsBridge when this Activity is
     * finishing or has been destroyed. */
    @Volatile private var destroyed = false

    /** K1 gate oracle: the launch nonce rides this dedicated 1px view - a
     * populated WebView a11y tree shadows the WebView's own
     * contentDescription, so the dump would never show it there. */
    private lateinit var launchMarker: android.widget.TextView

    /** Debug-only editor fixtures; visible only under
     * [EXTRA_SHOW_FIXTURES] (null on release builds). */
    private var debugFixtures: LinearLayout? = null
    private var pendingModelImportId: String? = null

    /** The system picker can cover this Activity without pausing it. Observe
     * the secure setting so the status card is refreshed as soon as the user
     * finishes choosing Feelime. */
    private val defaultImeObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            refreshSettingsState()
        }
    }

    /** Keep an already visible settings page in sync with changes made by
     * another surface (for example the keyboard's quick settings). */
    private val uiLanguageListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == UiLanguage.KEY_CHOICE) {
            runOnUiThread {
                pushHello()
                bridge.pushState()
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        bridge.pushState()
    }

    /** ACTION_OPEN_DOCUMENT grants this activity a read URI for the selected
     * file. The model importer consumes it immediately through ContentResolver
     * and never requests broad shared-storage permissions. */
    private val modelDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        val modelId = pendingModelImportId
        pendingModelImportId = null
        if (uri != null && modelId != null) {
            // The importer consumes the URI immediately.  Keep only the
            // transient activity grant; persisting every one-off selection
            // would accumulate provider permission entries over time.
            bridge.importModelFromUri(modelId, uri)
        }
    }

    /** ACTION_OPEN_DOCUMENT gives a one-time read grant; the bridge consumes
     * it immediately and sends the bytes through KeyboardStore.install(). */
    private val keyboardDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) bridge.installKeyboardFromUri(uri)
    }

    /** ACTION_OPEN_DOCUMENT for importing a rime .dict.yaml lexicon
     * (issue #37: 叠加进 custom_phrase 通道的词表导入). */
    private val dictOpenLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) bridge.importDictFromUri(uri)
    }

    /** ACTION_OPEN_DOCUMENT for the base dictionary (issue #23: device-side
     *  rebuild via librime maintenance). Display name via DISPLAY_NAME query
     *  —— SAF 的 lastPathSegment 是 document id（真机实测「msf:491」），
     *  不是文件名。 */
    private val baseDictOpenLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) {
            val name = runCatching {
                contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
                }
            }.getOrNull() ?: uri.lastPathSegment?.substringAfterLast('/') ?: "dict.yaml"
            bridge.installBaseDict(uri, name)
        }
    }

    /** ACTION_CREATE_DOCUMENT for the userdata backup export
     * (docs/design/userdata.md §1). The bridge writes through the granted
     * stream immediately; no persisted grant. */
    private val backupCreateLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri: Uri? ->
        if (uri != null) bridge.writeUserdataBackupToUri(uri)
    }

    /** ACTION_OPEN_DOCUMENT for importing a userdata backup file. */
    private val backupOpenLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri != null) bridge.restoreUserdataBackupFromUri(uri)
    }

    /** Background-image picker (WebView <input type=file>). Without this
     * override the settings page's input.click() is a silent no-op - the
     * stock WebChromeClient never shows anything (真机: 点击无效果). */
    private var pendingFileChooser: android.webkit.ValueCallback<
        Array<android.net.Uri>>? = null

    private val imagePickLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? ->
        pendingFileChooser?.onReceiveValue(
            uri?.let { arrayOf(it) }
        )
        pendingFileChooser = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        destroyed = false
        runCatching { // 诊断：冷启 BAL 验证（事后清理）
            filesDir.resolve("diag_trace.log").appendText(
                "${android.os.SystemClock.elapsedRealtime()} SetupActivity onCreate\n")
        }
        // P1-5 补口（真机第 5 轮 G 段定罪）：force-stop 中断安装后直接开
        // 设置页不走 FeelimeService.onCreate，卡片会残留误导性的「自定义」
        // 态——这里也扫一遍（幂等，prefs 无 installing 标记即 no-op）。
        com.feelime.ime.engine.BaseDictInstaller.sweepPending(this)
        pendingModelImportId = savedInstanceState?.getString(KEY_PENDING_MODEL_IMPORT_ID)
        rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(ContextCompat.getColor(this@SetupActivity, R.color.feelime_bg))
        }
        launchMarker = android.widget.TextView(this).apply {
            importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_YES
            setSingleLine()
            textSize = 1f
            // alpha 0 would drop the view from the a11y tree entirely (the
            // K1 gate reads it from the uiautomator dump) - 0.05 stays
            // imperceptible while remaining visible to accessibility.
            alpha = 0.05f
        }
        rootLayout.addView(launchMarker, LinearLayout.LayoutParams(1, 1))
        bridge = SettingsBridge(this, host)
        contentResolver.registerContentObserver(
            Settings.Secure.getUriFor(Settings.Secure.DEFAULT_INPUT_METHOD),
            false,
            defaultImeObserver,
        )
        UiLanguage.preferences(this)
            .registerOnSharedPreferenceChangeListener(uiLanguageListener)
        // Design §5.3 pattern: a fresh random token per page load, pushed to
        // JS through onBridgeHello; every bridge call carries it back.
        bridge.pageToken = newToken()
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            // Settings content is local-only; never let the page wander off.
            settings.allowContentAccess = false
            // 外观预览把真键盘页面嵌成 iframe（file:///android_asset/...）。
            // API 30+ 默认 false 会把子 frame 的 file URL 整个拒成空文档
            // （主 frame 的 android_asset 不受此开关影响）；导航仍被
            // shouldOverrideUrlLoading 锁死，FromFileURLs 保持 false。
            settings.allowFileAccess = true
            settings.allowFileAccessFromFileURLs = false
            webViewClient = object : WebViewClient() {
                // 外观预览的键盘 iframe（?preview=1）是唯一放行的子 frame；
                // 其余一切导航（主 frame 含内）全部拒绝，设置页不允许漂移。
                // 例外（许可三级页）：http(s) 链接转系统浏览器打开，页面
                // 本体不跳转——组件致谢的上游链接只有这一条外跳通道。
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: android.webkit.WebResourceRequest?,
                ): Boolean {
                    val url = request?.url ?: return true
                    if (url.scheme == "http" || url.scheme == "https") {
                        runCatching {
                            startActivity(android.content.Intent(
                                android.content.Intent.ACTION_VIEW, url,
                            ))
                        }
                        return true
                    }
                    return !(request.isForMainFrame == false
                        && url.scheme == "file"
                        && url.path?.startsWith("/android_asset/keyboard/") == true)
                }
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.i(TAG, "settings page finished: $url")
                    pushHello()
                    routeToSetupTarget()
                }
            }
            webChromeClient = object : android.webkit.WebChromeClient() {
                // FileChooserParams is an inner class of WebChromeClient -
                // referencing it as android.webkit.FileChooserParams does
                // not resolve (compileDirectDebugKotlin).
                // Settings-page JS errors surface as logs ( 探针教训:
                // 无日志的前台调试 = 猜谜).
                override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
                    Log.w(TAG, "console: ${message?.message() ?: "?"} @${message?.lineNumber() ?: "?"}")
                    return true
                }

                /** <input type=file> 落到这里;不覆写时选择器永远不弹,
                 *  页面的 input.click() 静默无效(背景图片入口)。 */
                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: android.webkit.ValueCallback<Array<android.net.Uri>>,
                    params: android.webkit.WebChromeClient.FileChooserParams,
                ): Boolean {
                    if (pendingFileChooser != null) {
                        callback.onReceiveValue(null)
                        return true
                    }
                    pendingFileChooser = callback
                    imagePickLauncher.launch("image/*")
                    return true
                }
            }
        }
        webView.addJavascriptInterface(bridge, BRIDGE_NAME)
        webView.loadUrl("file:///android_asset/settings/index.html")
        rootLayout.addView(webView, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f,
        ))
        if (BuildConfig.DEBUG) {
            // Device-gate fixtures (selected-range backspace, search action…)
            // stay native: they seed real InputConnections for the suites.
            // Fix: collapsed behind a toggle after they squeezed the
            // settings WebView. The toggle itself is GONE too -
            // the fixtures now show only when the activity is started with
            // EXTRA_SHOW_FIXTURES (automation passes it; humans never see
            // the block at all). No in-page entry exists on purpose.
            val fixtures = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                visibility =
                    if (intent.getBooleanExtra(EXTRA_SHOW_FIXTURES, false)) {
                        android.view.View.VISIBLE
                    } else {
                        android.view.View.GONE
                    }
            }
            debugFixtures = fixtures
            addDebugEditorFixtures(fixtures)
            rootLayout.addView(fixtures, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
            ))
        }
        setContentView(rootLayout)
        updateSetupLaunchMarker(intent)
        takeSetupTarget(intent)
        onBackPressedDispatcher.addCallback(this) {
            // A sub-page is open - the first BACK returns home
            // (design §6.2). The flag is also cleared here because the
            // evaluateJavascript round-trip is async; a fast second tap must
            // not finish the activity mid-navigation. The page re-reports
            // its state after showPage lands anyway.
            if (bridge.onSubPage) {
                // 逐级返回（issue #17 三级页）：phrases → input、
                // licenses → about（验收反馈：许可三级页）；其余子页与
                // 设计 §6.2 一律回 home。
                val parent = when (bridge.subPageName) {
                    "phrases" -> "input"
                    "licenses" -> "about"
                    else -> "home"
                }
                bridge.onSubPage = false
                bridge.evaluate(
                    "window.FeelimeSettings && window.FeelimeSettings.showPage" +
                        " && window.FeelimeSettings.showPage('" + parent + "')",
                )
            } else {
                finish()
            }
        }
        if (intent.getStringExtra(KeyboardUpdateCenter.INBOX_EXTRA) != null) installFromInbox()
    }

    private fun newToken(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun pushHello() {
        val payload = JSONObject()
            .put("token", bridge.pageToken)
            .put("theme", themeName())
            .put("uiLanguage", UiLanguage.choice(this))
            .put("uiLocale", UiLanguage.locale(this))
            .put("appIcon", com.feelime.ime.appIconDataUri(this))
        bridge.evaluate("window.FeelimeSettings && window.FeelimeSettings.onBridgeHello($payload)")
    }

    private fun themeName(): String {
        val night = resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return if (night == android.content.res.Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
    }

    override fun onResume() {
        super.onResume()
        // Resolve the current preference on every show; the process may have
        // survived while the keyboard or another settings instance changed it.
        refreshSettingsState()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString(KEY_PENDING_MODEL_IMPORT_ID, pendingModelImportId)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        // Set this before releasing the bridge so a queued host callback sees
        // the destroyed state even if it runs between the two operations.
        destroyed = true
        contentResolver.unregisterContentObserver(defaultImeObserver)
        UiLanguage.preferences(this)
            .unregisterOnSharedPreferenceChangeListener(uiLanguageListener)
        bridge.release()
        super.onDestroy()
    }

    private val host = object : SettingsBridge.Host {
        override fun evaluate(script: String) {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                runCatching { webView.evaluateJavascript(script, null) }
                    .onFailure { Log.w(TAG, "settings WebView callback dropped", it) }
            }
        }

        override fun requestMicPermission() {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }

        override fun showImeEnableSettings() {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }

        override fun showImePicker() {
            getSystemService(InputMethodManager::class.java).showInputMethodPicker()
        }

        override fun onSettingsPageReady() {
            rerouteSetupTargetOnReady()
        }

        override fun openModelDocument(modelId: String) {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                pendingModelImportId = modelId
                runCatching {
                    modelDocumentLauncher.launch(arrayOf(
                        "application/zip",
                        "application/x-bzip2",
                        "application/x-tar",
                        "application/octet-stream",
                    ))
                }.onFailure { Log.w(TAG, "model picker launch dropped", it) }
            }
        }

        override fun openDictDocument() {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                runCatching {
                    dictOpenLauncher.launch(arrayOf(
                        "text/*",
                        "application/octet-stream",
                        "application/yaml",
                        "application/x-yaml",
                    ))
                }.onFailure { Log.w(TAG, "dict picker launch dropped", it) }
            }
        }

        override fun openBaseDictDocument() {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                runCatching {
                    baseDictOpenLauncher.launch(arrayOf(
                        "text/*",
                        "application/octet-stream",
                        "application/yaml",
                        "application/x-yaml",
                    ))
                }.onFailure { Log.w(TAG, "base-dict picker launch dropped", it) }
            }
        }

        override fun openKeyboardDocument() {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                runCatching {
                    keyboardDocumentLauncher.launch(arrayOf(
                        "application/zip",
                        "application/x-zip-compressed",
                        "application/octet-stream",
                    ))
                }.onFailure { Log.w(TAG, "keyboard package picker launch dropped", it) }
            }
        }

        override fun createBackupDocument() {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                val stamp = java.text.SimpleDateFormat(
                    "yyyyMMdd-HHmm", java.util.Locale.US,
                ).format(java.util.Date())
                runCatching {
                    backupCreateLauncher.launch("feelime-backup-$stamp.json")
                }.onFailure { Log.w(TAG, "backup create picker launch dropped", it) }
            }
        }

        override fun openBackupDocument() {
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                runCatching {
                    backupOpenLauncher.launch(arrayOf(
                        "application/json",
                        "application/octet-stream",
                        "text/*",
                    ))
                }.onFailure { Log.w(TAG, "backup open picker launch dropped", it) }
            }
        }

        override fun addImeShortcut() = requestImeShortcut()

        override fun addImeTile() = requestImeTile()

        override fun onSettingsChanged() {
            // SettingsBridge invokes this from its preference listener so the
            // hello payload and the page theme/language switch together.
            if (!canTouchWebView()) return
            runOnUiThread {
                if (!canTouchWebView()) return@runOnUiThread
                pushHello()
            }
        }
    }

    private fun canTouchWebView(): Boolean =
        !destroyed && !isFinishing && !isDestroyed && ::webView.isInitialized

    private fun refreshSettingsState() {
        if (!canTouchWebView()) return
        runOnUiThread {
            if (!canTouchWebView()) return@runOnUiThread
            pushHello()
            bridge.pushState()
        }
    }

    /** Shortcut artwork: the Feelime mark on a full-bleed dark square with a
     * green ON pip at the top-right (adaptive: the launcher crops it; the
     * bottom-right app badge stays clear of the pip). */
    private fun shortcutIconBitmap(context: android.content.Context): Bitmap {
        val size = 108
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.color = Color.parseColor("#11121A")
        canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), paint)
        val drawable = androidx.appcompat.content.res.AppCompatResources.getDrawable(
            context, R.drawable.ic_tile_feelime,
        )!!
        val mark = (size * 0.5f).toInt()
        drawable.setBounds(
            (size * 0.08f).toInt(), (size * 0.28f).toInt(),
            (size * 0.08f).toInt() + mark, (size * 0.28f).toInt() + mark,
        )
        drawable.draw(canvas)
        val pip = size * 0.52f
        paint.color = Color.parseColor("#09D967")
        canvas.drawCircle(size * 0.68f, size * 0.32f, pip / 2, paint)
        paint.color = Color.WHITE
        paint.textSize = pip * 0.46f
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText(
            "ON", size * 0.68f,
            size * 0.32f - (paint.descent() + paint.ascent()) / 2,
            paint,
        )
        return bitmap
    }

    private fun pickerIntent(): Intent = Intent(this, ImePickerActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_NO_ANIMATION or
                Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS,
        )
    }

    /** Request a launcher-pinned shortcut. Android still shows the launcher's
     * own confirmation UI; this app never writes DEFAULT_INPUT_METHOD. */
    private fun requestImeShortcut() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Toast.makeText(this, R.string.shortcut_unsupported, Toast.LENGTH_SHORT).show()
            return
        }
        val manager = getSystemService(ShortcutManager::class.java)
        if (manager == null || !manager.isRequestPinShortcutSupported) {
            Toast.makeText(this, R.string.shortcut_unavailable, Toast.LENGTH_LONG).show()
            return
        }
        val shortcut = ShortcutInfo.Builder(this, SHORTCUT_ID)
            .setShortLabel(getString(R.string.shortcut_ime_short))
            .setLongLabel(getString(R.string.shortcut_ime_long))
            .setIcon(Icon.createWithAdaptiveBitmap(shortcutIconBitmap(this)))
            .setIntent(pickerIntent())
            .build()
        val accepted = manager.requestPinShortcut(shortcut, null)
        Toast.makeText(
            this,
            if (accepted) R.string.shortcut_request_sent else R.string.shortcut_request_rejected,
            Toast.LENGTH_LONG,
        ).show()
    }

    /** Android 13+ can show the system's add-tile confirmation. Older systems
     * still expose the same tile through the manual control-center editor. */
    private fun requestImeTile() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            Toast.makeText(this, R.string.ime_tile_manual_steps, Toast.LENGTH_LONG).show()
            return
        }
        val manager = getSystemService(StatusBarManager::class.java)
        if (manager == null) {
            Toast.makeText(this, R.string.ime_tile_unavailable, Toast.LENGTH_LONG).show()
            return
        }
        manager.requestAddTileService(
            ComponentName(this, ImeTileService::class.java),
            getString(R.string.ime_tile_name),
            Icon.createWithResource(this, R.drawable.ic_tile_feelime),
            mainExecutor,
        ) { result ->
            val message = when (result) {
                StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED -> R.string.ime_tile_added
                StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED -> R.string.ime_tile_already_added
                else -> R.string.ime_tile_request_rejected
            }
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        updateSetupLaunchMarker(intent)
        takeSetupTarget(intent)
        routeToSetupTarget()
        // The fixtures follow the launch intent in BOTH entries (the
        // activity is singleTop - a relaunch with the extra lands here).
        if (BuildConfig.DEBUG) {
            debugFixtures?.visibility =
                if (intent.getBooleanExtra(EXTRA_SHOW_FIXTURES, false)) {
                    android.view.View.VISIBLE
                } else {
                    android.view.View.GONE
                }
        }
        if (intent.getStringExtra(KeyboardUpdateCenter.INBOX_EXTRA) != null) installFromInbox()
    }

    /** Installs the ZIP pushed by scripts/push-keyboard.sh (same mechanism). */
    private fun installFromInbox() {
        val file = KeyboardUpdateCenter.inboxFile(this)
        if (!file.isFile) return
        runCatching {
            val bytes = file.readBytes()
            file.delete()
            when (val result = KeyboardUpdateCenter.store(this).install(bytes)) {
                is KeyboardStore.InstallResult.Ok -> KeyboardUpdateCenter.notifyUpdated(this)
                is KeyboardStore.InstallResult.Fail -> {
                    // 设计 docs/design/userdata.md §3：inbox 推送遇签名不符
                    // 也给确认通道（设置页走 bridge 的 pending/confirm）。
                    if (result.code == KeyboardUpdateErrorCode.SIGNATURE_BAD) {
                        confirmBadSignatureInstall(bytes)
                    }
                }
            }
        }
        bridge.pushState()
    }

    private fun confirmBadSignatureInstall(bytes: ByteArray) {
        runOnUiThread {
            android.app.AlertDialog.Builder(this)
                .setTitle(getString(R.string.keyboard_signature_bad_title))
                .setMessage(getString(R.string.keyboard_signature_bad_message))
                .setPositiveButton(R.string.keyboard_signature_bad_confirm) { _, _ ->
                    runCatching {
                        val result = KeyboardUpdateCenter.store(this)
                            .install(bytes, confirmBadSignature = true)
                        if (result is KeyboardStore.InstallResult.Ok) {
                            KeyboardUpdateCenter.notifyUpdated(this)
                        }
                    }
                    bridge.pushState()
                }
                .setNegativeButton(android.R.string.cancel, null)
                .show()
        }
    }

    private fun updateSetupLaunchMarker(intent: Intent) {
        val nonce = intent.getLongExtra(SETUP_LAUNCH_EXTRA, 0L)
        launchMarker.contentDescription = "$SETUP_LAUNCH_DESCRIPTION_PREFIX$nonce"
    }

    /** 快捷设置 tile 直达（SETUP_PAGE_EXTRA）：页面加载后调设置页的
     *  focusSetting(id)——它自己翻页（目标可能在 input 之外的页）、滚到
     *  整行并呼吸提醒。onPageFinished 时 JS 未必初始化完，注入的脚本自带
     *  轮询重试（30×200ms）；页面 ready（ready ping）时再重放一次兜底
     *  ——冷启动 WebView 慢于轮询窗口时第一次会落空。锚点：quickPairA=
     *  快捷切换对、menuModesRow=长按菜单、customTitle=定制键盘卡。 */
    private var pendingSetupTarget = ""

    private fun takeSetupTarget(intent: Intent) {
        pendingSetupTarget = intent.getStringExtra(SETUP_PAGE_EXTRA) ?: ""
    }

    /** 注入路由脚本；focusSetting 命中（返回 true）才消费 pending。
     *  冷启动 WebView 慢时 JS 未就绪、轮询耗尽返回 false——pending 保
     *  留，等页面 ready（ready ping）时重放。 */
    private fun routeToSetupTarget() {
        val target = pendingSetupTarget
        if (target.isEmpty()) return
        runOnUiThread {
            runCatching {
                webView.evaluateJavascript(
                    "(function go(n){" +
                        "if(window.FeelimeSettings&&window.FeelimeSettings.focusSetting){" +
                        "return Promise.resolve(window.FeelimeSettings.focusSetting('" + target + "'));" +
                        "}else if(n>0){return new Promise(function(res){setTimeout(function(){go(n-1).then(res);},200);});}" +
                        "return Promise.resolve(false);})(30)",
                ) { r ->
                    if (r == "true") pendingSetupTarget = ""
                }
            }
        }
    }

    /** 页面 ready（SettingsBridge.ready）时重放未消费的 pending：冷启动
     *  WebView 慢于轮询窗口时第一次路由落空，ready 是 JS 完全就绪的确
     *  定时机。只重放 pending（一次性语义）——不能记 last 无限重放：
     *  搜索点击翻外观页会弹真键盘触发新 hello→ready，旧锚重放会覆盖
     *  用户刚点击的搜索定位（用户实测「搜背景却跳回定制键盘」）。 */
    private fun rerouteSetupTargetOnReady() {
        if (pendingSetupTarget.isEmpty()) return
        routeToSetupTarget()
    }

    /**
     * Real InputConnection fixtures for device gates. They intentionally live
     * in the host Activity (instead of a mock bridge), and are omitted from
     * release builds so the production setup surface stays unchanged.
     */
    private fun addDebugEditorFixtures(parent: LinearLayout) {
        fun fixture(description: String, configure: EditText.() -> Unit) {
            parent.addView(EditText(this).apply {
                contentDescription = description
                setTextColor(Color.WHITE)
                setHintTextColor(0xff77778f.toInt())
                setBackgroundColor(0xff1e1e30.toInt())
                setPadding(dp(14), dp(10), dp(14), dp(10))
                configure()
            }, matchWidth(top = 8))
        }

        // §6: the release 输入测试 lives in the HTML page; gates need a
        // native EditText they can locate by description and read exactly.
        fixture(TEST_INPUT_DESCRIPTION) {
            // No hint: an empty EditText's a11y text reports the hint, which
            // the upgrade gate (expects text == "") would read as a failure.
            setSingleLine(true)
        }
        fixture(SELECTION_INPUT_DESCRIPTION) {
            hint = "debug: selected-range backspace"
            setSingleLine(true)
            // Reseed unconditionally on every focus gain: earlier cases or
            // runs leave arbitrary residue here, and the first-launch gate needs the
            // exact 'abcd'+range precondition each time.
            setOnFocusChangeListener { _, focused ->
                if (focused) {
                    setText("abcd")
                    // A tap assigns its cursor after onFocusChanged. Post the
                    // range so the device gate exercises selected-text
                    // deletion instead of accidentally testing end deletion.
                    postDelayed({ if (hasFocus()) setSelection(1, 3) }, 300)
                }
            }
        }
        fixture(MULTILINE_INPUT_DESCRIPTION) {
            hint = "debug: multiline enter"
            setSingleLine(false)
            minLines = 2
            imeOptions = EditorInfo.IME_FLAG_NO_ENTER_ACTION
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        }
        val searchResult = android.widget.TextView(this).apply {
            contentDescription = SEARCH_RESULT_IDLE_DESCRIPTION
            importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
        fixture(SEARCH_INPUT_DESCRIPTION) {
            hint = "debug: search editor action"
            setSingleLine(true)
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            inputType = InputType.TYPE_CLASS_TEXT
            setOnEditorActionListener { _, actionId, _ ->
                val fired = actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH
                if (fired) searchResult.contentDescription = SEARCH_RESULT_FIRED_DESCRIPTION
                fired
            }
        }
        parent.addView(searchResult, LinearLayout.LayoutParams(1, 1))
        fixture(PASSWORD_INPUT_DESCRIPTION) {
            hint = "debug: password input"
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            transformationMethod = android.text.method.PasswordTransformationMethod.getInstance()
        }
        addClipboardSeed(parent)
    }

    /** debug-only device fixture: seeds a real system clipboard entry. */
    private fun addClipboardSeed(parent: LinearLayout) {
        parent.addView(button(t(this, "写入测试剪贴板", "Write test clipboard")) {
            val seedId = android.os.SystemClock.elapsedRealtime()
            val text = "feelime-clip-$seedId"
            val manager = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
            manager.setPrimaryClip(android.content.ClipData.newPlainText("feelime", text))
            android.util.Log.d(TAG, "clipboardSeedId=$seedId")
        }.apply { contentDescription = CLIPBOARD_SEED_DESCRIPTION }, matchWidth(top = 8))
    }

    private fun button(label: String, action: () -> Unit) = android.widget.Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { action() }
    }

    private fun matchWidth(top: Int = 0) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(top) }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val TAG = "FeelimeSettingsShell"
        const val TEST_INPUT_DESCRIPTION = "feelime-test-input"
        /** Suites expand the collapsed debug fixtures through this desc. */
        const val SELECTION_INPUT_DESCRIPTION = "feelime-selection-input"
        const val MULTILINE_INPUT_DESCRIPTION = "feelime-multiline-input"
        const val SEARCH_INPUT_DESCRIPTION = "feelime-search-input"
        const val SEARCH_RESULT_IDLE_DESCRIPTION = "feelime-search-action:idle"
        const val SEARCH_RESULT_FIRED_DESCRIPTION = "feelime-search-action:fired"
        const val PASSWORD_INPUT_DESCRIPTION = "feelime-password-input"
        const val SETUP_LAUNCH_EXTRA = "com.feelime.ime.extra.SETUP_LAUNCH_NONCE"

        /** 快捷设置 tile 直达的目标卡（custom=定制键盘，keyboards=键盘选择）。
         *  值是设置页 JS 侧的锚 id，SetupActivity 就绪后注入路由脚本。 */
        const val SETUP_PAGE_EXTRA = "com.feelime.ime.extra.SETUP_TARGET"
        const val SETUP_LAUNCH_DESCRIPTION_PREFIX = "feelime-setup-launch:"
        // Debug fixtures show ONLY when the launcher passes this
        // boolean extra (automation does; humans never see the block).
        const val EXTRA_SHOW_FIXTURES = "com.feelime.ime.extra.SHOW_DEBUG_FIXTURES"
        const val CLIPBOARD_SEED_DESCRIPTION = "feelime-clipboard-seed"
        private const val SHORTCUT_ID = "ime-picker"
        private const val KEY_PENDING_MODEL_IMPORT_ID =
            "com.feelime.ime.pending_model_import_id"
        const val BRIDGE_NAME = "Native"
    }
}
