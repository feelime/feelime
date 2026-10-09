#!/usr/bin/env node
/*
 * Settings-page mock-bridge suite: runs the REAL assets/settings/index.html +
 * settings.js against a fake DOM and a recording bridge, and asserts the
 * contract: EVERY user-visible control must
 * trigger the right native capability with the right args (and the token on
 * every call). Zero deps, same fake-DOM approach as mock_bridge_harness.js.
 *
 *   node scripts/verify/mock_settings_tests.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { loadDocument } = require('./mock_bridge_harness.js');

const ROOT = path.resolve(__dirname, '../..');
const HTML_PATH = path.join(ROOT, 'app/src/main/assets/settings/index.html');
const JS_PATH = path.join(ROOT, 'app/src/main/assets/settings/settings.js');

const RESULTS = [];
function test(name, fn) {
    try {
        fn();
        RESULTS.push([name, true, '']);
        console.log(`PASS ${name}`);
    } catch (error) {
        RESULTS.push([name, false, error.message]);
        console.log(`FAIL ${name} :: ${error.message}`);
    }
}
function assert(cond, message) {
    if (!cond) throw new Error(message);
}
function equal(actual, expected, label) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    assert(a === b, `${label}: expected ${b}, got ${a}`);
}

// ---------------------------------------------------------- recording bridge

class MockSettingsNative {
    constructor() {
        this.calls = [];
    }
    _rec(method, args) {
        this.calls.push({ method, args });
    }
    // FeelimeService SettingsBridge surface. Every @JavascriptInterface method
    // ends with the page token; the mocks accept anything and record it.
    ready(...a) { this._rec('ready', a); }
    enableIme(...a) { this._rec('enableIme', a); }
    pickIme(...a) { this._rec('pickIme', a); }
    addImeShortcut(...a) { this._rec('addImeShortcut', a); }
    addImeTile(...a) { this._rec('addImeTile', a); }
    requestMic(...a) { this._rec('requestMic', a); }
    openAppStore(...a) { this._rec('openAppStore', a); }
    setDoublePinyinScheme(...a) { this._rec('setDoublePinyinScheme', a); }
    setModelBackend(...a) { this._rec('setModelBackend', a); }
    setModelDownloadSource(...a) { this._rec('setModelDownloadSource', a); }
    downloadModel(...a) { this._rec('downloadModel', a); }
    openModelDocument(...a) { this._rec('openModelDocument', a); }
    openKeyboardDocument(...a) { this._rec('openKeyboardDocument', a); }
    exportUserdata(...a) { this._rec('exportUserdata', a); }
    openBackupDocument(...a) { this._rec('openBackupDocument', a); }
    confirmKeyboardInstall(...a) { this._rec('confirmKeyboardInstall', a); }
    dismissKeyboardInstall(...a) { this._rec('dismissKeyboardInstall', a); }
    confirmModelDownload(...a) { this._rec('confirmModelDownload', a); }
    cancelModelDownload(...a) { this._rec('cancelModelDownload', a); }
    deleteModel(...a) { this._rec('deleteModel', a); }
    saveAsrSettings(...a) { this._rec('saveAsrSettings', a); }
    saveCustom(...a) { this._rec('saveCustom', a); }
    checkUpdate(...a) { this._rec('checkUpdate', a); }
    installZip(...a) { this._rec('installZip', a); }
    restoreBuiltInKeyboard(...a) { this._rec('restoreBuiltInKeyboard', a); }
    setUiLanguage(...a) { this._rec('setUiLanguage', a); }
    setAutoUpdateCheck(...a) { this._rec('setAutoUpdateCheck', a); }
    setBottomPadPortrait(...a) { this._rec('setBottomPadPortrait', a); }
    setBottomPadLandscape(...a) { this._rec('setBottomPadLandscape', a); }
    setFeelOptions(...a) { this._rec('setFeelOptions', a); }
    setCandidateFont(...a) { this._rec('setCandidateFont', a); }
    setInkDelay(...a) { this._rec('setInkDelay', a); }
    setFuzzyPinyinMask(...a) { this._rec('setFuzzyPinyinMask', a); }
    setAssociation(...a) { this._rec('setAssociation', a); }
    setDynamicDateTime(...a) { this._rec('setDynamicDateTime', a); }
    openBaseDictDocument(...a) { this._rec('openBaseDictDocument', a); }
    clearBaseDict(...a) { this._rec('clearBaseDict', a); }
    activateBaseDictSlot(...a) { this._rec('activateBaseDictSlot', a); }
    deleteBaseDictSlot(...a) { this._rec('deleteBaseDictSlot', a); }
    saveCustomPhrases(...a) { this._rec('saveCustomPhrases', a); }
    setDiagnostics(...a) { this._rec('setDiagnostics', a); }
    exportDiagnostics(...a) { this._rec('exportDiagnostics', a); }
    setOneHandPad(...a) { this._rec('setOneHandPad', a); }
    setKeySound(...a) { this._rec('setKeySound', a); }
    setKeyHaptic(...a) { this._rec('setKeyHaptic', a); }
    setVoiceOnSpace(...a) { this._rec("setVoiceOnSpace", a); }
    setSpaceHoldAction(...a) { this._rec("setSpaceHoldAction", a); }
    setSpaceHoldTap(...a) { this._rec("setSpaceHoldTap", a); }
    setKeySoundVolume(...a) { this._rec('setKeySoundVolume', a); }
    setKeyHapticStrength(...a) { this._rec('setKeyHapticStrength', a); }
    // /R8: page reporting (BACK returns home first) + about-page
    // one-tap copy.
    reportPage(...a) { this._rec('reportPage', a); }
    reportCkState(...a) { this._rec('reportCkState', a); }
    setThemeMode(...a) { this._rec('setThemeMode', a); }
    setThemePreset(...a) { this._rec('setThemePreset', a); }
    setThemeHue(...a) { this._rec('setThemeHue', a); }
    setThemeSat(...a) { this._rec('setThemeSat', a); }
    setKeyHue(...a) { this._rec('setKeyHue', a); }
    setKeySat(...a) { this._rec('setKeySat', a); }
    setOneHandMode(...a) { this._rec('setOneHandMode', a); }
    setPreeditBold(...a) { this._rec('setPreeditBold', a); }
    setCustomEnabled(...a) { this._rec('setCustomEnabled', a); }
    setKeyOpacity(...a) { this._rec('setKeyOpacity', a); }
    setKeyBubble(...a) { this._rec('setKeyBubble', a); }
    setBubbleLinger(...a) { this._rec('setBubbleLinger', a); }
    saveUserWords(...a) { this._rec('saveUserWords', a); }
    setFlickSwap(...a) { this._rec('setFlickSwap', a); }
    setKbHeight(...a) { this._rec('setKbHeight', a); }
    previewKeyboard(...a) { this._rec('previewKeyboard', a); }
    setBgImage(...a) { this._rec('setBgImage', a); }
    clearBgImage(...a) { this._rec('clearBgImage', a); }
    setBuiltinBgImage(...a) { this._rec('setBuiltinBgImage', a); }
    copyText(...a) { this._rec('copyText', a); }
    // 1.2.1 批次：键盘排序（mode_order 真相源）+ 英文词直出开关 + 按键
    // 音效风格（#排序/#29-3/#30-2）。
    saveKeyboardSelection(...a) { this._rec('saveKeyboardSelection', a); }
    setEnglishWords(...a) { this._rec('setEnglishWords', a); }
    setKeySoundStyle(...a) { this._rec('setKeySoundStyle', a); }
    openKeySoundDocument(...a) { this._rec('openKeySoundDocument', a); }
    clearKeySoundFile(...a) { this._rec('clearKeySoundFile', a); }
    of(method) {
        return this.calls.filter(c => c.method === method);
    }
}

// ------------------------------------------------------------------- world

class SettingsWorld {
    constructor() {
        this.native = new MockSettingsNative();
        this.token = 'tok-settings-1';
        const sandbox = {
            console: { warn() {}, log() {}, error() {} },
            Native: this.native,
            localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
            JSON, Math, Object, Array, String, Number, Boolean, Promise, Date,
            // Keep this suite deterministic even when Node runs under an
            // English host locale; the production fallback is navigator.language.
            navigator: { language: 'zh-CN' },
            getComputedStyle: el => ({ fontSize: el.style.fontSize || '13.05px' }),
            // 搜索/锚定（验收 2026-09-24 二改）：rAF 同步执行让断言无需等
            // 帧；flashAnchor 的清理 setTimeout 只入队不跑（flushTimers 手动
            // 冲洗）；location.hash 由 focusSetting 写入，断言直达锚。
            requestAnimationFrame: fn => { fn(); return 0; },
            setTimeout: fn => { this.timers.push(fn); return this.timers.length; },
            clearTimeout: () => {},
            location: { hash: '' },
            // #51 hashtag 直达：hashchange 收集（applyLocationHash 顶层
            // 注册；测试改写 location.hash 后手动派发）。
            addEventListener: (type, fn) => {
                (this.winListeners = this.winListeners || {})[type] = fn;
            },
            removeEventListener: () => {},
            scrollTo: (x, y) => { this.lastScrollTo = [x, y]; },
        };
        this.timers = [];
        sandbox.window = sandbox;
        this.doc = loadDocument(fs.readFileSync(HTML_PATH, 'utf8'));
        sandbox.document = this.doc;
        const context = vm.createContext(sandbox);
        // The REAL generated data file loads first, exactly as index.html
        // orders it - the suite asserts against shipped data, not a copy.
        vm.runInContext(
            fs.readFileSync(path.join(path.dirname(HTML_PATH), 'dp-data.js'), 'utf8'),
            context, { filename: 'dp-data.js' });
        vm.runInContext(fs.readFileSync(JS_PATH, 'utf8'), context, { filename: 'settings.js' });
        this.sandbox = sandbox;
        // First handshake, as SetupActivity does after onPageFinished.
        this.FeelimeSettings().onBridgeHello({ token: this.token, theme: 'dark' });
        this.native.calls.length = 0; // ready() asserted separately
    }
    FeelimeSettings() {
        return this.sandbox.window.FeelimeSettings;
    }
    $(id) {
        const el = this.doc.getElementById(id);
        assert(el, `missing element #${id}`);
        return el;
    }
    push(state) {
        this.FeelimeSettings().onEvent({ type: 'state', state });
    }
    lastCall(method) {
        const list = this.native.of(method);
        assert(list.length > 0, `expected a ${method} call, got none`);
        return list[list.length - 1];
    }
}

const BASE_STATE = {
    ime: { enabled: false, isDefault: false },
    mic: { granted: false },
    models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'missing' },
    ],
    asr: { stripPeriod: true, hotwords: '' },
    custom: { enabled: false, summary: '未定制', json: '' },
   update: { source: '', sourceMode: 'default', sourceConfigured: false, autoCheck: false, autoCheckLastAttemptAt: 0, url: '', activeSource: 'built_in', activeVersion: '3.20.0',
              activeContentHash: '', state: 'ok', lastError: '', lastErrorCode: '',
              lastErrorDetail: '', lastSuccessAt: '' },
    appVersion: '0.17.6',
    keyboardVersion: '3.21.0',
    device: { manufacturer: 'Google', model: 'Pixel 8', release: '15', sdkInt: 35 },
    notices: 'NOTICES',
    uiLanguage: 'auto',
    uiLocale: 'zh',
};

// ------------------------------------------------------------------- tests

test('hello handshake calls ready() with the page token exactly once', () => {
    const world = new SettingsWorld();
    equal(world.native.of('ready').length, 0, 'ready consumed by world setup');
    // A fresh world records its own ready() during onBridgeHello.
    const raw = new SettingsWorld();
    raw.native.calls.length = 0;
    raw.FeelimeSettings().onBridgeHello({ token: 'tok-x', theme: 'light' });
    const ready = raw.lastCall('ready');
    equal(ready.args, ['tok-x'], 'ready token');
});

test('theme from hello lands on <html> class', () => {
    const world = new SettingsWorld();
    equal(world.doc.documentElement.className, 'theme-dark', 'html theme class');
});

test('interface language is independent from input state and persists through state pushes', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const language = world.$('uiLanguage');
    equal(language.value, 'auto', 'default follows system');
    language.value = 'en';
    const change = language.listeners.find(listener => listener.type === 'change');
    assert(change, 'language select has a change listener');
    change.handler({ target: language });
    equal(world.lastCall('setUiLanguage').args, ['en', world.token], 'setUiLanguage token');
    assert(world.$('imeTitle').textContent.includes('Input method'), 'English IME title');
    equal(world.$('uiLanguage').value, 'en', 'English selection retained');
    equal(world.doc.querySelector('[data-page="input"] [data-back]').getAttribute('aria-label'),
        'Back to home', 'English back label');
    assert(world.$('updateSource').getAttribute('placeholder').startsWith('https://'),
        'URLs stay as URL placeholders');

    // Native is authoritative after the bridge round trip. The input mode
    // and user-entered content are unrelated to UI locale.
    world.push({ ...BASE_STATE, uiLanguage: 'en', uiLocale: 'en', asr: { stripPeriod: true, hotwords: '你好' } });
    assert(world.doc.querySelector('.hero-tag').textContent.includes('Offline'), 'English hero copy');
    equal(world.$('hotwords').value, '你好', 'user content is not translated');
});

test('home shows input status and keeps versions on the about page', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    // hero 状态行已删（用户实录：不该占在搜索框上方）——正常/异常态
    // 都由「输入法状态」卡表达（LED+按钮），页首不再有状态文案。
    assert(!world.doc.getElementById('heroStatus'), 'hero status line removed');
    world.push({ ...BASE_STATE, ime: { enabled: true, isDefault: true } });
    assert(!world.doc.getElementById('heroStatus'), 'still gone when default');
});

test('ime rows: LEDs reflect state; action buttons appear only when actionable', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('btnEnableIme').hidden, false, '去启用 visible when disabled');
    equal(world.$('btnPickIme').hidden, false, '去切换 visible when not default');
    world.push({ ...BASE_STATE, ime: { enabled: true, isDefault: true } });
    equal(world.$('btnEnableIme').hidden, true, '去启用 hidden when enabled');
    equal(world.$('btnPickIme').hidden, true, '去切换 hidden when default');
});

test('去启用 / 去切换 / 去授权 buttons trigger the system-intent bridge calls', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('btnEnableIme').click();
    world.$('btnPickIme').click();
    world.$('btnMic').click();
    equal(world.lastCall('enableIme').args, [world.token], 'enableIme token');
    equal(world.lastCall('pickIme').args, [world.token], 'pickIme token');
    equal(world.lastCall('requestMic').args, [world.token], 'requestMic token');
});

test('desktop shortcut and Quick Settings entry use their dedicated bridge calls', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('btnAddShortcut').click();
    world.$('btnAddTile').click();
    equal(world.lastCall('addImeShortcut').args, [world.token], 'shortcut token');
    equal(world.lastCall('addImeTile').args, [world.token], 'tile token');
});

test('model row renders state copy and the 下载/取消/删除 buttons hit the bridge with the model id', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const row = world.doc.querySelector('.model[data-id="m-stream"]');
    assert(row, 'model row built');
    equal(row.querySelector('.model-name').textContent, '流式语音识别（中英）', 'title');
    equal(row.querySelector('.model-status').textContent, '未下载（约 116.9 MB）', 'missing copy');
    const [download, cancel, remove] = row.querySelectorAll('.model-actions .btn');
    equal(cancel.hidden, true, 'cancel hidden when idle');
    equal(remove.hidden, true, 'remove hidden when missing');
    download.click();
    equal(world.lastCall('downloadModel').args, ['m-stream', world.token], 'downloadModel args');
    const importer = row.querySelector('[data-action="import"]');
    assert(importer && !importer.hidden, 'import action visible when missing');
    importer.click();
    equal(world.lastCall('openModelDocument').args, ['m-stream', world.token], 'openModelDocument args');

    world.push({ ...BASE_STATE, models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'downloading' },
    ] });
    equal(row.querySelector('.model-status').textContent, '下载中 0%', 'downloading copy');
    const [dl2, cancel2, remove2] = row.querySelectorAll('.model-actions .btn');
    equal(dl2.hidden, true, 'download hidden while downloading');
    equal(cancel2.hidden, false, 'cancel shown while downloading');
    cancel2.click();
    equal(world.lastCall('cancelModelDownload').args, [world.token], 'cancelModelDownload token');

    world.push({ ...BASE_STATE, models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'installed' },
    ] });
    equal(row.querySelector('.model-status').textContent, '已下载，校验通过', 'installed copy');
    const remove3 = row.querySelectorAll('.model-actions .btn')[2];
    equal(remove3.hidden, false, 'remove shown when installed');
    remove3.click();
    equal(world.lastCall('deleteModel').args, ['m-stream', world.token], 'deleteModel args');
});

test('model source selector persists mirror/official/custom choices', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, modelDownloadSource: { mode: 'hf_mirror', customBase: '' } });
    equal(world.$('modelDownloadSource').value, 'hf_mirror', 'default model source');
    world.$('modelDownloadSource').value = 'custom';
    world.$('modelDownloadSource').listeners.find(listener => listener.type === 'change')
        .handler({ target: world.$('modelDownloadSource') });
    equal(world.$('modelDownloadCustom').hidden, false, 'custom source field visible');
    world.$('modelDownloadCustom').value = 'https://models.example.test/hf';
    world.$('modelDownloadArchive').value = 'https://models.example.test/streaming-mobile.tar.bz2';
    world.$('btnSaveModelSource').click();
    equal(world.lastCall('setModelDownloadSource').args,
        ['custom', 'https://models.example.test/hf',
            'https://models.example.test/streaming-mobile.tar.bz2', world.token], 'custom source call');
});

test('persistent model failure stays visible with detail and keeps retry/import actions', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, models: [{
        id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743,
        state: 'missing', errorCode: 'MODEL_DOWNLOAD_FAILED', errorDetail: 'HTTP 503 from hf-mirror',
    }] });
    const row = world.doc.querySelector('.model[data-id="m-stream"]');
    assert(row.querySelector('.model-status').textContent.includes('HTTP 503'), 'failure detail visible');
    assert(!row.querySelector('[data-action="download"]').hidden, 'retry remains visible');
    assert(!row.querySelector('[data-action="import"]').hidden, 'import remains visible');
});

test('model import status shows reading and verification progress', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, models: [{
        id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'importing',
    }] });
    const row = world.doc.querySelector('.model[data-id="m-stream"]');
    world.FeelimeSettings().onEvent({ type: 'modelImportStatus', id: 'm-stream', status: 'validating' });
    assert(row.querySelector('.model-status').textContent.includes('验证'), 'validation status visible');
});

test('modelProgress event moves the bar; a state re-push keeps the percent (no 0% flash)', () => {


    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'downloading' },
    ] });
    const row = world.doc.querySelector('.model[data-id="m-stream"]');
    world.FeelimeSettings().onEvent({ type: 'modelProgress', id: 'm-stream', percent: 42,
        doneBytes: 100, totalBytes: 240 });
    equal(row.querySelector('.progress').firstElementChild.style.width, '42%', 'bar width');
    assert(row.querySelector('.model-status').textContent.includes('42%'), 'status text');
    world.push({ ...BASE_STATE, models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'downloading' },
    ] });
    equal(row.querySelector('.model-status').textContent, '下载中 42%',
        'state re-push reuses last percent');
});

test('English model rows translate titles and action labels for installed/downloading states', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, uiLanguage: 'en', uiLocale: 'en', models: [
        { id: 'streaming-zipformer-bilingual-zh-en', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'installed' },
        { id: 'paraformer-zh-small', title: '整句纠错识别', sizeBytes: 52428800, state: 'downloading' },
    ] });
    const installed = world.doc.querySelector('.model[data-id="streaming-zipformer-bilingual-zh-en"]');
    const downloading = world.doc.querySelector('.model[data-id="paraformer-zh-small"]');
    equal(installed.querySelector('.model-name').textContent, 'Streaming speech recognition (Chinese/English)', 'English installed title');
    equal(installed.querySelector('[data-action="remove"]').textContent, 'Delete', 'English installed action');
    equal(downloading.querySelector('.model-name').textContent, 'Full-sentence correction', 'English downloading title');
    equal(downloading.querySelector('[data-action="cancel"]').textContent, 'Cancel', 'English downloading action');
});

test('archive model shows transfer size separately from installed size', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, uiLocale: 'en', uiLanguage: 'en', models: [
        { id: 'm-stream', title: 'Streaming', sizeBytes: 100 * 1024 * 1024,
            downloadBytes: 350 * 1024 * 1024, state: 'missing' },
    ] });
    const text = world.doc.querySelector('.model-size').textContent;
    assert(text.includes('Download 350') && text.includes('Installed size 100'), text);
});

test('metered-network confirmation: cancel and approve use one-shot confirm bridge calls', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.FeelimeSettings().onEvent({
        type: 'modelDownloadConfirmation', id: 'm-stream',
        name: '流式语音识别（中英）', bytes: 122577743,
    });
    equal(world.$('modelConsent').hidden, false, 'consent card shown');
    assert(world.$('modelConsentMessage').textContent.includes('流量费用'), 'Chinese consent copy');
    world.$('modelConsentCancel').click();
    equal(world.lastCall('confirmModelDownload').args,
        ['m-stream', false, world.token], 'cancel consumes pending request');
    equal(world.$('modelConsent').hidden, true, 'cancel hides consent card');

    world.FeelimeSettings().onEvent({
        type: 'modelDownloadConfirmation', id: 'm-stream',
        name: '流式语音识别（中英）', bytes: 122577743,
    });
    world.$('modelConsentConfirm').click();
    equal(world.lastCall('confirmModelDownload').args,
        ['m-stream', true, world.token], 'approval is explicit');
    world.$('modelConsentConfirm').click();
    equal(world.native.of('confirmModelDownload').length, 2,
        'hidden consent cannot reuse an old approval');
});

test('backup: export calls straight through; import gates on overwrite consent; status notes render', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('btnExportBackup').click();
    equal(world.lastCall('exportUserdata').args, [world.token], 'export opens the save picker');

    world.$('btnImportBackup').click();
    equal(world.$('backupConsent').hidden, false, 'import shows the overwrite consent first');
    equal(world.native.of('openBackupDocument').length, 0, 'no picker before consent');
    world.$('backupConsentCancel').click();
    equal(world.$('backupConsent').hidden, true, 'cancel backs out');
    world.$('btnImportBackup').click();
    world.$('backupConsentConfirm').click();
    equal(world.lastCall('openBackupDocument').args, [world.token], 'consent opens the file picker');

    world.FeelimeSettings().onEvent({ type: 'backupStatus', direction: 'import', ok: true });
    assert(world.$('backupNote').textContent.includes('导入完成'), 'success note');
    world.FeelimeSettings().onEvent({ type: 'backupStatus', direction: 'import', ok: false, code: 'KIND' });
    assert(world.$('backupNote').textContent.includes('不是 Feelime 备份'), 'wrong-kind note');
});

test('keyboard signature mismatch: confirmable errors open the consent; confirm reinstalls once', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.FeelimeSettings().onEvent({
        type: 'updateError', code: 'SIGNATURE_BAD', message: 'x', confirmable: true, confirmId: 'abc123',
    });
    equal(world.$('kbSigConsent').hidden, false, 'signature consent shown');
    world.$('kbSigConsentCancel').click();
    equal(world.$('kbSigConsent').hidden, true, 'cancel hides it');
    equal(world.lastCall('dismissKeyboardInstall').args, ['abc123', world.token],
        'cancel invalidates the stashed package');
    world.FeelimeSettings().onEvent({
        type: 'updateError', code: 'IO_ERROR', message: 'x', confirmable: false,
    });
    equal(world.$('kbSigConsent').hidden, true, 'plain errors never open the consent');
    world.FeelimeSettings().onEvent({
        type: 'updateError', code: 'SIGNATURE_BAD', message: 'x', confirmable: true, confirmId: 'def456',
    });
    world.$('kbSigConsentConfirm').click();
    equal(world.lastCall('confirmKeyboardInstall').args, ['def456', world.token],
        'confirm carries the package-bound id');
    equal(world.native.of('confirmKeyboardInstall').length, 1, 'one confirmation per consent');
});

test('model errors translate stable codes without altering model names', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, uiLanguage: 'en', uiLocale: 'en' });
    world.FeelimeSettings().onEvent({ type: 'modelDownloadError', id: 'm-stream', code: 'NO_NETWORK' });
    assert(world.$('modelNote').textContent.includes('No network'), 'English no-network error');
    world.FeelimeSettings().onEvent({ type: 'modelDownloadConfirmation', id: 'm-stream', name: '模型', bytes: 100 });
    world.$('modelConsentCancel').click();
    world.FeelimeSettings().onEvent({ type: 'modelDownloadError', id: 'm-stream', code: 'STALE_CONFIRMATION' });
    assert(world.$('modelNote').textContent.includes('expired'), 'English stale error');
    world.FeelimeSettings().onEvent({
        type: 'modelDownloadConfirmation', id: 'm-stream', name: 'GPU model / 用户版', bytes: 100,
    });
    assert(world.$('modelConsentMessage').textContent.includes('GPU model / 用户版'),
        'model name stays verbatim');
    assert(world.$('modelConsentMessage').textContent.includes('data charges'), 'English consent copy');
});

test('model retry clears the old error across state and locale refreshes, then shows a new failure', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.FeelimeSettings().onEvent({ type: 'modelDownloadError', id: 'm-stream', code: 'TIMEOUT' });
    assert(world.$('modelNote').textContent.includes('网络请求超时'), 'initial timeout is shown');

    const row = world.doc.querySelector('.model[data-id="m-stream"]');
    row.querySelector('[data-action="download"]').click();
    equal(world.lastCall('downloadModel').args, ['m-stream', world.token], 'retry call');
    equal(world.$('modelNote').textContent, '', 'retry clears the old note immediately');

    world.push({ ...BASE_STATE, models: [
        { id: 'm-stream', title: '流式语音识别（中英）', sizeBytes: 122577743, state: 'downloading' },
    ] });
    equal(world.$('modelNote').textContent, '', 'downloading state keeps the note clear');
    const language = world.$('uiLanguage');
    language.value = 'en';
    language.listeners.find(listener => listener.type === 'change').handler({ target: language });
    equal(world.$('modelNote').textContent, '', 'locale refresh does not resurrect the old error');

    world.FeelimeSettings().onEvent({ type: 'modelDownloadError', id: 'm-stream', code: 'NETWORK_ERROR' });
    assert(world.$('modelNote').textContent.includes('network request failed'), 'new failure remains visible');
});

test('保存识别设置 sends the checkbox + textarea verbatim', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('stripPeriod').checked = false;
    world.$('hotwords').value = '倪妮\nGPU';
    world.$('btnSaveAsr').click();
    equal(world.lastCall('saveAsrSettings').args,
        [false, '倪妮\nGPU', world.token], 'saveAsrSettings args');
    assert(world.$('asrNote').textContent.includes('已保存'), 'save note shown');
});

test('保存定制 sends the JSON + switch; 插入模板 fills valid JSON without calling the bridge', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('customJson').value = '{"version":1,"rows":[[]]}';
    world.$('customEnabled').checked = true;
    world.$('btnSaveCustom').click();
    equal(world.lastCall('saveCustom').args,
        ['{"version":1,"rows":[[]]}', true, world.token], 'saveCustom args');
    world.$('btnCustomTemplate').click();
    const filled = world.$('customJson').value;
    assert(/"version":\s*1/.test(filled) && filled.includes('rows'), 'template JSON');
    equal(world.native.of('saveCustom').length, 1, 'template insert does not save');
});

test('custom templates: practical is the default, developer keeps full coverage (2026-10-03)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('btnCustomTemplate').click();
    const practical = world.$('customJson').value;
    const rows = JSON.parse(practical).rows;
    // 三行填满（用户裁定 2026-10-03 二轮：不实用=不行）。
    equal(rows.length, 3, 'three rows');
    rows.forEach((row, i) => assert(row.length >= 5, `row ${i + 1} is filled`));
    // 行1 高频短语；行2 组合键+单键；行3 [open:]/span/color/note/⌫。
    assert(practical.includes('谢谢') && practical.includes('收到'), 'everyday phrases');
    assert(practical.includes('[ctrl+z]') && practical.includes('[ctrl+c]')
        && practical.includes('[ctrl+s]'), 'useful combos');
    assert(practical.includes('[enter]'), 'single key present');
    // 支付宝扫码/收付款官方 scheme（微信外部 scheme 被封，不收录）。
    assert(practical.includes('[open:alipays://platformapi/startapp?saId=10000007]'),
        'alipay scan deeplink');
    assert(practical.includes('[open:alipays://platformapi/startapp?saId=20000056]'),
        'alipay pay deeplink');
    const last = rows[rows.length - 1];
    equal(last[last.length - 1].tap, '[backspace]',
        'backspace sits at the end of the last row');
    equal(last[0].align, 'right', 'row 3 is right-aligned (align showcase)');
    assert(last.some(k => k.span === 2), 'row 3 carries a span-2 key');
    assert(last.some(k => k.color === 'blue') && last.some(k => k.color === 'green'),
        'deeplink keys are color-coded');
    assert(rows.flat().some(k => (k.note || '').length > 0), 'notes explain the keys');
    world.$('btnCustomTemplateDev').click();
    const dev = world.$('customJson').value;
    // 开发者模板承载全覆盖验收：单键/混排/组合/功能键/光标/⌫/[open:]/align。
    for (const token of ['[esc]', ':w[enter]', '[ctrl+s]', '[f5]', '[left]',
        '[backspace]', '[open:https://fanyi.baidu.com]', 'align']) {
        assert(dev.includes(token), 'dev template covers ' + token);
    }
});

test('custom key editor: open type validates URI at apply time', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    g.ckOpenNew(2);
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    const tInput = g.document.getElementById('ckT');
    tInput.value = '翻译'; fire(tInput, 'input');
    const pickMode = value => {
        const sel = world.doc.getElementById('ckMode');
        sel.value = value;
        fire(sel, 'change');
    };
    pickMode('open');
    // 坏 URI：intent:// 走私被拦，确定按钮不落表（ckRows 是 let，不进
    // vm 全局——经行 chips 断言，与既有测试同一口径）。
    const uri = g.document.getElementById('ckOpenUri');
    uri.value = 'intent://x#Intent;end'; fire(uri, 'input');
    world.$('ckApply').click();
    assert(world.$('ckEditNote').textContent.length > 0, 'bad uri rejected with a note');
    assert(!g.document.getElementById('ckRowList').textContent.includes('翻译'),
        'rejected key not added');
    // 好 URI：落表为 [open:...]，行 chips 出现「翻译」。
    uri.value = 'doubao://chat'; fire(uri, 'input');
    world.$('ckApply').click();
    assert(g.document.getElementById('ckRowList').textContent.includes('翻译'),
        'open cell saved and rendered');
    // 保存全部 → saveCustom 桥收到 [open:...] 的 tap。
    world.$('ckSave').click();
    const saved = world.lastCall('saveCustom').args[0];
    assert(saved.includes('[open:doubao://chat]'), 'saveCustom carries the open tap');
});

test('custom key editor: long URIs are stopped at apply time (review P2-3)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    g.ckOpenNew(0);
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    const tInput = g.document.getElementById('ckT');
    tInput.value = '长链'; fire(tInput, 'input');
    const modeSel = world.doc.getElementById('ckMode');
    modeSel.value = 'open';
    fire(modeSel, 'change');
    // 220 字符 URI：scheme 合法但 tap 会超 128——必须在确定时拦下
    // （键盘侧整表拒收会让全部定制键静默消失）。
    const uri = g.document.getElementById('ckOpenUri');
    uri.value = 'https://example.com/' + 'a'.repeat(200); fire(uri, 'input');
    world.$('ckApply').click();
    assert(world.$('ckEditNote').textContent.includes('128'),
        'over-limit tap length rejected with the limit named');
    assert(!g.document.getElementById('ckRowList').textContent.includes('长链'),
        'long-uri key not added');
});

test('custom key editor: span survives edit and quick-pick (review P3-4)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: '邮箱', tap: 'me@example.com', span: 2 }], [], []],
    });
    g.ckEnter();
    // 编辑已有键：改名不改布局，span 必须保留（无独立控件，丢了就是
    // 静默数据丢失——默认样例的邮箱 span2 引导用户「改成自己的」）。
    g.ckOpenChip(0, 0);
    const tInput = g.document.getElementById('ckT');
    tInput.value = '我的邮箱'; fire(tInput, 'input');
    g.document.getElementById('ckApply').click();
    world.$('ckSave').click();
    let rows = JSON.parse(world.lastCall('saveCustom').args[0]).rows;
    equal(rows[0][0].t, '我的邮箱', 'edit applied');
    equal(rows[0][0].span, 2, 'span kept through an edit');
    // 快捷库的 span2 邮箱：选中即带入。
    g.ckOpenNew(1);
    const chip = [...world.doc.querySelectorAll('.ck-common-chip')]
        .find(e => e.textContent === '邮箱');
    assert(chip, 'quick-library email chip rendered');
    fire(chip, 'click');
    g.document.getElementById('ckApply').click();
    // 新键（没选带 span 的条目）不带 span 字段。ckBuildForm 每次重建
    // 表单：#ckT 必须重查，旧引用已 detach。
    g.ckOpenNew(2);
    const t2 = g.document.getElementById('ckT');
    t2.value = 'A'; fire(t2, 'input');
    g.document.getElementById('ckApply').click();
    world.$('ckSave').click();
    rows = JSON.parse(world.lastCall('saveCustom').args[0]).rows;
    equal(rows[1][0].span, 2, 'quick-pick carries span');
    equal(rows[2][0].span, undefined, 'fresh key has no span');
});

test('custom key editor: row alignment control writes the marker cell (2026-10-03)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    const lines = () => [...world.doc.querySelectorAll('#ckRowList .ck-row-line')];
    const btns = r => lines()[r].querySelectorAll('.ck-align-btn');
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }, { t: 'B', tap: 'B' }], [], []],
    });
    g.ckEnter();
    // 有键的行才有对齐控件（标记要挂 cell，空行没载体）；默认左。
    equal(btns(0).length, 3, 'row 1 renders the 3-way align control');
    equal(lines()[1].querySelector('.ck-align'), null, 'empty row has no align control');
    equal(btns(0)[0].className.includes('on'), true, 'left (default) marked on');
    // 点「右」：标记写进行内首键，其他 cell 不动。
    fire(btns(0)[2], 'click');
    world.$('ckSave').click();
    let rows = JSON.parse(world.lastCall('saveCustom').args[0]).rows;
    equal(rows[0][0].align, 'right', 'align marker on the first cell');
    equal(rows[0][1].align, undefined, 'other cells untouched');
    // 编辑首键（ckApply 重建 cell）：标记保留。
    g.ckOpenChip(0, 0);
    const tInput = g.document.getElementById('ckT');
    tInput.value = 'A2'; fire(tInput, 'input');
    g.document.getElementById('ckApply').click();
    world.$('ckSave').click();
    equal(JSON.parse(world.lastCall('saveCustom').args[0]).rows[0][0].align, 'right',
        'align survives a key edit');
    // 切回「左」：标记清除。
    fire(btns(0)[0], 'click');
    world.$('ckSave').click();
    equal(JSON.parse(world.lastCall('saveCustom').args[0]).rows[0][0].align, undefined,
        'left clears the marker');
    // 重新设右后删掉载体键（× 删除）：标记转移给留下的新首键，行停靠
    // 不静默回左（评审 P3-1）。× 现在先弹二次确认（2026-10-04），确认
    // 才真删。
    fire(btns(0)[2], 'click');
    g.ckEnterEditMode([...world.doc.querySelector('#ckRowList .ck-row-strip').querySelectorAll('.ck-chip')][0]);
    const xbtn = [...world.doc.querySelectorAll('#ckRowList .ck-x')][0];
    xbtn.listeners.find(l => l.type === 'click').handler({ stopPropagation() {} });
    equal(g.document.getElementById('ckDelModal').hidden, false, 'delete asks first');
    equal(g.document.getElementById('ckDelText').textContent.includes('A'), true,
        'confirm dialog names the key');
    g.document.getElementById('ckDelGo').listeners.find(l => l.type === 'click').handler();
    world.$('ckSave').click();
    const after = JSON.parse(world.lastCall('saveCustom').args[0]).rows[0];
    equal(after.length, 1, 'marker key removed');
    equal(after[0].align, 'right', 'align transferred to the new first key');
});

test('custom key editor: back key asks before leaving edit mode / dirty state (2026-10-04)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    // backPressed 只在 customkeys 页响应（防误伤其他页的 back）。
    world.FeelimeSettings().showPage('customkeys');
    const strip0 = world.doc.querySelector('#ckRowList .ck-row-strip');
    g.ckEnterEditMode([...strip0.querySelectorAll('.ck-chip')][0]);
    // 编辑态 + 跟手拖影：ghost 克隆被拖键挂在 body 上。
    const ghost = g.document.querySelector('.ck-ghost') || [...g.document.body.children]
        .find(el => el.className === 'ck-ghost');
    equal(ghost && ghost.textContent, 'A', 'drag ghost mirrors the held key');
    equal(ghost.style.fontSize, '13.05px', 'body ghost preserves the fitted chip font');
    // BACK：编辑态弹确认，放弃=退出编辑态（改动保留为脏）。
    world.FeelimeSettings().backPressed();
    equal(g.document.getElementById('ckBackModal').hidden, false, 'back asks in edit mode');
    g.document.getElementById('ckBackGo').listeners.find(l => l.type === 'click').handler();
    equal(g.document.getElementById('ckBackModal').hidden, true, 'choice closes the dialog');
    equal(g.document.getElementById('ckEditBar').hidden, true, 'discard exits edit mode');
    // 状态上报随变化点走：值序列锁住（进编辑 [true,false]、退出
    // [false,false]）——只数条数锁不住残留 bug（review P1-2）。
    const reports = world.native.of('reportCkState').map(r => r.args.slice(0, 2));
    equal(JSON.stringify(reports[reports.length - 2]), JSON.stringify([true, false]),
        'entering edit mode reports [editing=true]');
    equal(JSON.stringify(reports[reports.length - 1]), JSON.stringify([false, false]),
        'discard reports both false');
    // 编辑态下从页内 ‹ 离开：编辑态必须回落并上报，否则壳侧 BACK 分流
    // 键残留 true，其他页的返回被吞（review P1-2 真机可达路径）。
    g.ckEnterEditMode([...world.doc.querySelector('#ckRowList .ck-row-strip').querySelectorAll('.ck-chip')][0]);
    world.FeelimeSettings().showPage('home');
    const last = world.native.of('reportCkState').pop().args;
    equal(JSON.stringify(last.slice(0, 2)), JSON.stringify([false, false]),
        'page-leave mirrors the state down to the shell');
    // 脏态下的 BACK 复用离开确认。
    world.FeelimeSettings().showPage('customkeys');
    g.ckMarkDirty(true);
    world.FeelimeSettings().backPressed();
    equal(g.document.getElementById('ckLeaveModal').hidden, false, 'dirty back reuses leave confirm');
});

test('custom key editor: head carries the add button, strip stays preview-pure (2026-10-04)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    // ＋ 在行头（空行也有——否则空行无法加键），strip 不再有虚线加号。
    // （fake DOM 不支持 :not()——恒空断言守不住门，用总数+归属断言。）
    equal(world.doc.querySelectorAll('#ckRowList .ck-head-add').length, 3, 'one add per row head');
    const allAdds = [...world.doc.querySelectorAll('#ckRowList .ck-add-chip')];
    equal(allAdds.length, 3, 'no add chips outside the heads');
    equal(allAdds.every(el => el.parentElement.className.includes('ck-row-head')), true,
        'every add chip lives in a row head');
    const emptyHead = [...world.doc.querySelectorAll('#ckRowList .ck-row-head')][1];
    equal(emptyHead.querySelectorAll('.ck-head-add').length, 1, 'empty row head still offers ＋');
    equal(emptyHead.querySelectorAll('.ck-align-btn').length, 0, 'empty row has no align buttons');
});

test('custom key editor: merged rows carry a row-number head (2026-10-04)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [{ t: 'B', tap: 'B' }], []],
    });
    g.ckEnter();
    // 定制即预览：每行行头常驻行号（空行也有），对齐按钮仅挂有键的行
    // （align 标记需要 cell 载体）；独立预览区已删。
    const heads = [...world.doc.querySelectorAll('#ckRowList .ck-row-head')];
    equal(heads.length, 3, 'every row (incl. empty) has a numbered head');
    equal(heads[0].textContent.includes('第 1 行'), true, 'row 1 head names its number');
    equal(heads[2].querySelector('.ck-align-btn'), null, 'empty row shows no align control');
    equal(heads[0].querySelector('.ck-align-btn') !== null, true, 'keyed row has the align control');
    equal(world.doc.querySelectorAll('#ckRowList .ck-row-strip').length, 3,
        'merged view renders one strip per row');
    // 合并行就是对齐预览本体：data-align 停靠标记挂上（CSS 首键
    // auto margin，与键盘同款）。
    g.ckSetRowAlign(0, 'right');
    g.ckRenderRows();
    equal(world.doc.querySelectorAll('#ckRowList .ck-row-strip')[0].dataset.align, 'right',
        'merged strip carries the align attribute');
});

test('custom key editor: overwide rows scale their font instead of wrapping (2026-10-04)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    // ckFitStrip 直测：jsdom 无布局（clientWidth=0 渲染路径自动跳过，
    // 不炸即可），几何用仿射模型模拟——固定部分（min-width/padding/
    // gap）不随字缩，可变部分（字面宽）随 fontSize 线性缩。静态
    // getter 测不出多轮收敛（review P1：第二轮比例是相对当前字号的）。
    const el = world.doc.createElement('div');
    const affine = (fixed, base) => {
        Object.defineProperty(el, 'clientWidth', { get: () => 320, configurable: true });
        Object.defineProperty(el, 'scrollWidth', {
            // 右对齐徽章的固定溢出不随字缩；fit 必须排除它。
            get: () => Math.round(fixed + base * (parseInt(el.style.fontSize, 10) || 100) / 100)
                + (el.classList.contains('ck-fitting') ? 0 : 7),
            configurable: true,
        });
    };
    // fixed=60 base=340：100% 宽 400 → 一轮 80% 仍 332 → 乘法精化到
    // 76%（残差循环逐 1% 收净，sw≤avail）。一轮算法在 parent 上会停在
    // 80% 溢出，锁住多轮收敛+残差收尾。
    affine(60, 340);
    g.ckFitStrip(el, 55);
    equal(el.style.fontSize, '76%', 'successive rounds refine past the first estimate');
    // 重跑从自然尺寸重新算（fontSize 先清空）。
    affine(60, 340);
    g.ckFitStrip(el, 55);
    equal(el.style.fontSize, '76%', 'fit is recomputed from scratch each render');
    // 极端溢出：钳在下限，不做蚂蚁字（放不下交还滚动兜底）。
    affine(200, 700);
    g.ckFitStrip(el, 55);
    equal(el.style.fontSize, '55%', 'extreme overflow clamps at the floor, not ant text');
    // 刚好放得下：保持自然字号。
    affine(100, 200);
    g.ckFitStrip(el, 55);
    equal(el.style.fontSize, '', 'fitting rows keep the natural size');
    // 右对齐的末键徽章多出 7px，不能让它参与键帽缩放测量。
    Object.defineProperty(el, 'scrollWidth', {
        get: () => el.classList.contains('ck-fitting') ? 320 : 327,
        configurable: true,
    });
    g.ckFitStrip(el, 55);
    equal(el.style.fontSize, '', 'delete badge overflow does not shrink a fitting row');
    equal(el.classList.contains('ck-fitting'), false, 'badges return after measurement');
    // 渲染路径冒烟：行 strip 挂了 nowrap 类（定制即预览合并视图）。
    const strip = world.doc.querySelector('#ckRowList .ck-row-strip');
    equal(strip !== null, true, 'row strip carries the no-wrap scaling class');
    strip.style.fontSize = '72%';
    g.ckRenderRows(true);
    equal(world.doc.querySelector('#ckRowList .ck-row-strip').style.fontSize, '72%',
        'drag reorder preserves the fitted row size without measuring again');
});

test('custom key editor: open presets are a dropdown with full labels (2026-10-04)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    g.ckOpenNew(2);
    const tInput = g.document.getElementById('ckT');
    const modeSel = world.doc.getElementById('ckMode');
    modeSel.value = 'open';
    fire(modeSel, 'change');
    const sel = g.document.getElementById('ckOpenPreset');
    assert(sel, 'preset dropdown rendered');
    const labels = [...sel.querySelectorAll('option')].map(o => o.textContent);
    equal(labels.includes('支付宝扫一扫'), true, 'dropdown shows the full label');
    equal(labels[0], '选择常用应用…', 'placeholder option first');
    // 预设按钮不再有（挤）；选「支付宝扫一扫」→ URI 与短键面预填。
    equal(world.doc.querySelectorAll('#ckActionHolder .ck-seg-btn').length, 0,
        'preset buttons replaced by the dropdown');
    sel.value = 'alipays://platformapi/startapp?saId=10000007';
    fire(sel, 'change');
    equal(g.document.getElementById('ckOpenUri').value,
        'alipays://platformapi/startapp?saId=10000007', 'picking fills the URI field');
    equal(g.document.getElementById('ckT').value, '扫一扫', 'keycap prefilled with the short name');
    g.document.getElementById('ckApply').click();
    world.$('ckSave').click();
    const saved = world.lastCall('saveCustom').args[0];
    assert(saved.includes('[open:alipays://platformapi/startapp?saId=10000007]'),
        'preset round-trips into the saved tap');
});

test('hot-update card: 检查更新/下载安装/恢复内置 pass the field values', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, update: { ...BASE_STATE.update, source: 'http://s/meta.json', url: 'http://s/kb.zip' } });
    equal(world.$('updateSource').value, 'http://s/meta.json', 'source field filled from state');
    world.$('btnCheckUpdate').click();
    equal(world.lastCall('checkUpdate').args, ['http://s/meta.json', world.token], 'checkUpdate args');
    world.$('btnInstallZip').click();
    equal(world.lastCall('installZip').args, ['http://s/kb.zip', world.token], 'installZip args');
    world.$('btnImportZip').click();
    equal(world.lastCall('openKeyboardDocument').args, [world.token], 'local ZIP picker args');
    world.$('btnRestore').click();
    equal(world.lastCall('restoreBuiltInKeyboard').args, [world.token], 'restore token');
});

test('update source status and daily auto-check toggle use the native bridge', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, update: {
        ...BASE_STATE.update, source: 'https://github.com/feelime/feelime',
        sourceMode: 'default', autoCheck: false,
    } });
    assert(world.$('updateStatus').textContent.includes('官方默认源'), 'default source status');
    world.$('autoUpdateCheck').checked = true;
    const change = world.$('autoUpdateCheck').listeners.find(listener => listener.type === 'change');
    assert(change, 'auto-check toggle listener');
    change.handler({ target: world.$('autoUpdateCheck') });
    equal(world.lastCall('setAutoUpdateCheck').args, [true, world.token], 'auto-check toggle');
});

test('diagnostics toggle records via bridge; copy button exports', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, diagnosticsOn: false });
    equal(world.$('diagnosticsOn').checked, false, 'diagnostics off from state');
    const box = world.$('diagnosticsOn');
    const change = box.listeners.find(listener => listener.type === 'change');
    assert(change, '#diagnosticsOn has a change listener');
    box.checked = true;
    change.handler({ target: box });
    equal(world.lastCall('setDiagnostics').args, [true, world.token], 'setDiagnostics + token');
    assert(world.$('diagNote').textContent.length > 0, 'note tells the user recording started');
    // 导出按钮：开关打开 → exportDiagnostics；未打开 → 只提示不导出。
    world.push({ ...BASE_STATE, diagnosticsOn: true });
    world.$('btnExportDiagnostics').click();
    equal(world.lastCall('exportDiagnostics').args, [world.token], 'export button exports');
    world.push({ ...BASE_STATE, diagnosticsOn: false });
    world.$('btnExportDiagnostics').click();
    equal(world.native.of('exportDiagnostics').length, 1,
        'export is gated on the toggle (no second export)');
});

test('one-handed pad select mirrors state and routes setOneHandPad', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, oneHand: 1, oneHandPad: 25 });
    equal(world.$('oneHandPad').value, '25', 'select mirrors the hello state');
    world.native.calls.length = 0;
    const sel = world.$('oneHandPad');
    const change = sel.listeners.filter(l => l.type === 'change');
    assert(change.length === 1, '#oneHandPad has a change listener');
    change[0].handler({ target: { value: '35' } });
    equal(world.lastCall('setOneHandPad').args, [35, world.token],
        'change routes the pad tier with token');
});

test('custom key editor: tap parse/build round-trips (#39-12)', () => {
    const world = new SettingsWorld();
    const g = world.sandbox;
    // 反猜型别：单键/组合/文本/宏。
    equal(g.ckTapParse('[esc]').mode, 'single', '[esc] -> single');
    equal(g.ckTapParse('[esc]').single, 'esc', 'single key name');
    const combo = g.ckTapParse('[ctrl+s]');
    equal(combo.mode, 'combo', '[ctrl+s] -> combo');
    equal(combo.comboKey, 's', 'combo key');
    equal([...combo.mods].join(','), 'ctrl', 'combo mods');
    equal(g.ckTapParse('me@example.com').mode, 'text', 'plain text -> text');
    equal(g.ckTapParse('[esc]ggVGD').mode, 'advanced', 'macro -> advanced');
    // [open:URI] 反猜为 open 型，且 URI 大小写保留（lowercase 之前识别）。
    const open = g.ckTapParse('[open:https://X.COM/Search]');
    equal(open.mode, 'open', '[open:..] -> open');
    equal(open.open, 'https://X.COM/Search', 'uri keeps its case');
    equal(g.ckTapFromDraft({ mode: 'open', open: 'doubao://chat' }),
        '[open:doubao://chat]', 'open build');
    equal(g.ckTapFromDraft({ mode: 'open', open: '  ' }), '', 'blank uri builds empty tap');
    // 构造：四型生成 tap 串。
    equal(g.ckTapFromDraft({ mode: 'text', text: ':w' }), ':w', 'text build');
    equal(g.ckTapFromDraft({ mode: 'single', single: 'f5' }), '[f5]', 'single build');
    equal(g.ckTapFromDraft({ mode: 'combo', comboKey: 's', mods: new Set(['ctrl']) }),
        '[ctrl+s]', 'combo build');
    equal(g.ckTapFromDraft({ mode: 'advanced', dsl: '[esc]ggVGD' }), '[esc]ggVGD',
        'advanced build');
});

test('custom key editor: new key -> apply -> save rides the saveCustom bridge (#39-12)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    g.ckEnter();
    // 行 chips 从 textarea 载入（定制即预览：合并视图就是唯一呈现）。
    equal(g.document.getElementById('ckRowList').textContent.includes('A'), true,
        'existing key rendered as chip');
    // 新建一颗组合键：走表单控件的 listener 链（ckDraft 是 let，不进
    // vm 全局——只能从 UI 路径驱动，这本身也断言了接线）。
    g.ckOpenNew(1);
    const fire = (el, type) => el.listeners.find(l => l.type === type).handler();
    const tInput = g.document.getElementById('ckT');
    tInput.value = '存'; fire(tInput, 'input');
    // 类型是下拉（#50 三轮：九项排不开一字排开），色板仍是 segmented。
    const modeSel = world.doc.getElementById('ckMode');
    modeSel.value = 'combo';
    fire(modeSel, 'change');
    const keySel = g.document.getElementById('ckKey');
    keySel.value = 's'; fire(keySel, 'change');
    // 颜色：切「自定义」展开 hue 滑块，设 120。
    const customBtn = [...world.doc.querySelectorAll('#ckEditBody .ck-seg-btn')]
        .find(el => el.textContent === '自定义');
    fire(customBtn, 'click');
    const hueInput = g.document.querySelector('.ck-hue input');
    assert(hueInput, 'hue slider appears only after picking custom');
    hueInput.value = '120';
    hueInput.listeners.find(l => l.type === 'input').handler();
    // popup 开着（apply 前可见），确定后关闭。
    equal(g.document.getElementById('ckModal').hidden, false, 'popup open while editing');
    fire(g.document.getElementById('ckApply'), 'click');
    equal(g.document.getElementById('ckModal').hidden, true, 'popup closes on apply');
    // 脏态：保存条高亮 + 提示可见（用户验收：改完没保存必须看得见）。
    equal(g.document.getElementById('ckSave').classList.contains('ck-save-dirty'),
        true, 'save bar shows the dirty state');
    equal(g.document.getElementById('ckDirtyHint').hidden, false, 'dirty hint visible');
    // 保存走 saveCustom 桥，payload 携带新键。
    world.native.calls.length = 0;
    g.document.getElementById('ckSave').listeners
        .find(l => l.type === 'click').handler();
    const save = world.lastCall('saveCustom');
    const rows = JSON.parse(save.args[0]).rows;
    equal(rows[1][0].t, '存', 'new key saved on row 2');
    equal(rows[1][0].tap, '[ctrl+s]', 'combo tap serialized');
    equal(rows[1][0].color, 'h120s65', 'custom hue+sat serialized');
});

test('custom key editor: unsaved changes gate page navigation (#39-12)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'A' }], [], []],
    });
    // 先真切进定制按键页（拦截看的是 currentPage，直调 ckEnter 不切页）。
    world.FeelimeSettings().showPage('customkeys');
    equal(world.doc.querySelector('[data-page="customkeys"]').hidden, false,
        'entered the customkeys page');
    // 弄脏：走脏态接口（快捷库卡已并入「＋」popup 的常用区）。
    g.ckMarkDirty(true);
    equal(g.document.getElementById('ckSave').classList.contains('ck-save-dirty'),
        true, 'marking dirty lights the save bar');
    // 脏态离开：被拦下弹页内确认，页面没切。
    world.FeelimeSettings().showPage('home');
    equal(g.document.getElementById('ckLeaveModal').hidden, false, 'leave confirm pops');
    equal(world.doc.querySelector('[data-page="customkeys"]').hidden, false,
        'still on the customkeys page');
    // 「留下」= 关确认、停留、脏态保留。
    g.document.getElementById('ckLeaveStay').listeners
        .find(l => l.type === 'click').handler();
    equal(g.document.getElementById('ckLeaveModal').hidden, true, 'stay closes confirm');
    equal(g.document.getElementById('ckSave').classList.contains('ck-save-dirty'),
        true, 'dirty state kept after staying');
    // 再离开走「丢弃」= 真切走且脏态清。
    world.FeelimeSettings().showPage('home');
    g.document.getElementById('ckLeaveGo').listeners
        .find(l => l.type === 'click').handler();
    equal(world.doc.querySelector('[data-page="home"]').hidden, false, 'leave-go navigates');
    equal(g.document.getElementById('ckSave').classList.contains('ck-save-dirty'),
        false, 'dirty cleared after discarding');
    // 干净态离开不弹确认。
    world.FeelimeSettings().showPage('customkeys');
    world.FeelimeSettings().showPage('home');
    equal(g.document.getElementById('ckLeaveModal').hidden, true, 'clean leave has no confirm');
});

test('custom key editor: move mode (×/drag) + popup slimmed (#39-12)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const g = world.sandbox;
    g.document.getElementById('customJson').value = JSON.stringify({
        version: 1, rows: [[{ t: 'A', tap: 'a' }, { t: 'B', tap: 'b' }], [{ t: 'C', tap: 'c' }], []],
    });
    g.ckEnter();
    // popup 瘦身：无删除按钮、无移行控件（移动/删除全走长按模式）。
    g.ckOpenChip(0, 0);
    equal(g.document.getElementById('ckDelete'), null, 'popup has no delete button');
    equal(g.document.getElementById('ckEditBody').textContent.includes('移到'), false,
        'popup has no move-to-row control');
    g.document.getElementById('ckModalCancel').listeners.find(l => l.type === 'click').handler();
    // 可移动模式：× 徽章 + × 删除 + dirty。
    const chipA = () => [...world.doc.querySelectorAll('#ckRowList .ck-chip')]
        .find(e => e.textContent.replace('×','') === 'A');
    const heldChip = chipA();
    heldChip.listeners.find(l => l.type === 'touchstart').handler({
        touches: [{ clientX: 10, clientY: 10 }],
    });
    g.ckEnterEditMode(heldChip);
    equal(heldChip.listeners.filter(l => l.type === 'touchmove').length, 2,
        'drag listens on the original touch target across edit-mode rendering');
    equal(g.document.getElementById('ckEditBar').hidden, false, 'edit bar visible');
    const x = (chipA().children || []).find(c => c.className === 'ck-x')
        || [...world.doc.querySelectorAll('#ckRowList .ck-x')][0];
    x.listeners.find(l => l.type === 'click').handler({ stopPropagation() {} });
    // 二次确认（2026-10-04）：× 只弹框，确认才删。
    equal(g.document.getElementById('ckDelModal').hidden, false, 'delete confirmation opens');
    g.document.getElementById('ckDelGo').listeners.find(l => l.type === 'click').handler();
    const rowTexts = [...world.doc.querySelectorAll('#ckRowList .ck-chips[data-ck-row]')]
        .map(st => [...st.children].filter(e => e.classList.contains('ck-chip')
            && !e.classList.contains('ck-add-chip'))
            .map(e => e.textContent.replace('×', '')).join(','));
    equal(rowTexts[0], 'B', '× removes the key (row 1 now B only)');
    equal(g.document.getElementById('ckSave').classList.contains('ck-save-dirty'), true,
        'removal marks dirty');
    g.ckExitEditMode();
    equal(g.document.getElementById('ckEditBar').hidden, true, 'done hides the bar');
    g.ckEndDragSession();
    equal(heldChip.listeners.filter(l => l.type === 'touchmove').length, 1,
        'session cleanup removes the detached target drag listener');
    // 长按链：touchstart 起定时器（不等待，仅验证接线不抛错）+ 位移取消。
    // ＋ 已挪进行头（2026-10-04），行内键从 strip 里取（fake DOM 不支持
    // 双类后代选择器，分两段查）。
    const strip0 = world.doc.querySelector('#ckRowList .ck-row-strip');
    const chip = strip0 && [...strip0.querySelectorAll('.ck-chip')][0];
    const ts = chip.listeners.find(l => l.type === 'touchstart');
    ts.handler({ touches: [{ clientX: 10, clientY: 10 }] });
    chip.listeners.find(l => l.type === 'touchmove')
        .handler({ touches: [{ clientX: 60, clientY: 10 }] });
    chip.listeners.find(l => l.type === 'touchend').handler({});
    equal(g.document.getElementById('ckEditBar').hidden, true,
        'a scroll-sized move cancels the hold (no edit mode)');
    ts.handler({ touches: [{ clientX: 10, clientY: 10 }] });
    g.ckEnterEditMode(chip);
    assert(world.doc.querySelector('#ckRowList .ck-row-strip').children[0] === chip,
        'entering edit mode retains the original touch target');
    g.ckRenderRows(true);
    assert(world.doc.querySelector('#ckRowList .ck-row-strip').children[0] === chip,
        'live reorder retains the original touch target');
    g.ckEndDragSession();
    // 编辑态再按一颗键 = 按下即拖（2026-10-04 用户操作模型：进编辑态
    // 后往往已松手，再按想拖——此前 touchstart 对编辑态直接短路）。
    // 断言必须设防（review P1）：先收掉进编辑态自动武装的会话清基线，
    // 且 chipB 要在重渲后重新取（旧引用已脱离文档）。
    g.ckEnterEditMode(chip);
    equal(g.document.body.classList.contains('ck-editing'), true,
        'edit mode claims the gesture (touch-action none via body class)');
    g.ckEndDragSession();
    const stripNow = world.doc.querySelector('#ckRowList .ck-row-strip');
    const chipB = [...stripNow.querySelectorAll('.ck-chip')][0];
    chipB.listeners.find(l => l.type === 'touchstart')
        .handler({ touches: [{ clientX: 120, clientY: 300 }], target: chipB });
    assert(chipB.classList.contains('ck-dragging'), 'pressing a key in edit mode starts a drag');
    assert(world.doc.querySelectorAll('.ck-ghost').length, 1, 'drag ghost armed');
    equal(chipB.listeners.filter(l => l.type === 'touchmove').length, 2,
        'drag touchmove listener bound on the press target');
    // 多指二按让位（review P2）：第一拖动未松手时第二指按下另一颗键，
    // 旧 ghost 必须被收掉（恒 1），松手后归零。
    const chipC = [...world.doc.querySelector('#ckRowList .ck-row-strip').querySelectorAll('.ck-chip')][1]
        || chipB;
    chipC.listeners.find(l => l.type === 'touchstart')
        .handler({ touches: [{ clientX: 130, clientY: 320 }], target: chipC });
    equal(world.doc.querySelectorAll('.ck-ghost').length, 1, 'second press yields, no orphan ghost');
    g.ckEndDragSession();
    equal(world.doc.querySelectorAll('.ck-ghost').length, 0, 'release clears the ghost');
    // × 徽章上的按下是删除意图：不起拖。
    const xSpan = chipC.querySelector('.ck-x') || world.doc.querySelector('#ckRowList .ck-x');
    if (xSpan) {
        chipC.listeners.find(l => l.type === 'touchstart')
            .handler({ touches: [{ clientX: 130, clientY: 320 }], target: xSpan });
        equal(world.doc.querySelectorAll('.ck-ghost').length, 0, 'press on the × badge never drags');
    }
    g.ckExitEditMode();
});

test('navigation: home starts as the only visible page; showPage swaps and reports', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.native.calls.length = 0;

    const hiddenMap = () => Object.fromEntries(
        [...world.doc.querySelectorAll('[data-page]')].map(p => [p.dataset.page, p.hidden]));
    equal(hiddenMap(), {
        home: false, appearance: true, skin: true, input: true, fuzzy: true, landscape: true, keyboards: true, dict: true, userwords: true, phrases: true, voice: true, update: true,
        backup: true, about: true, customkeys: true, licenses: true, test: true,
    }, 'initial: home visible, sub-pages hidden');

    world.FeelimeSettings().showPage('voice');
    equal(hiddenMap(), {
        home: true, appearance: true, skin: true, input: true, fuzzy: true, landscape: true, keyboards: true, dict: true, userwords: true, phrases: true, voice: false, update: true,
        backup: true, about: true, customkeys: true, licenses: true, test: true,
    }, 'voice page visible, everything else hidden');
    equal(world.lastCall('reportPage').args, ['voice', 'home', world.token], 'reportPage(page, parent) on sub-page');

    world.FeelimeSettings().showPage('home');
    equal(hiddenMap().home, false, 'home visible again');
    equal(world.lastCall('reportPage').args, ['home', 'home', world.token], 'reportPage(home) on home');

    // #39-12 守门：DOM 里每个 .page 都必须能被 showPage 切到——
    // PAGES 白名单漏登新页时入口点了没反应（真机实录），这里全量枚举。
    [...world.doc.querySelectorAll('[data-page]')].forEach(node => {
        const name = node.dataset.page;
        world.FeelimeSettings().showPage(name);
        equal(node.hidden, false, name + ' is switchable via showPage');
    });
    world.FeelimeSettings().showPage('home');

    // 三级页守门（用户实录：自造词/定制按键系统 BACK 落回 home）：
    // showPage 上报的父级必须与该页 ‹ 按钮 data-back 一致，且是合法页名
    // ——壳侧系统 BACK 直接消费这个父级，这里锁死「单一事实源」链路。
    const parents = {};
    [...world.doc.querySelectorAll('[data-page]')].forEach(node => {
        const name = node.dataset.page;
        world.FeelimeSettings().showPage(name);
        parents[name] = world.lastCall('reportPage').args[1];
    });
    world.FeelimeSettings().showPage('home');
    [...world.doc.querySelectorAll('[data-page]')].forEach(node => {
        const btn = node.querySelector('.page-back');
        const declared = btn?.dataset.back || 'home';
        equal(parents[node.dataset.page], declared,
            node.dataset.page + ' reports its ‹ data-back as parent (' + declared + ')');
        assert([...world.doc.querySelectorAll('[data-page]')]
            .some(p => p.dataset.page === declared),
            declared + ' is a real page (parent target exists)');
    });
    equal(parents.userwords, 'dict', 'userwords backs to the dict page');
    equal(parents.customkeys, 'input', 'customkeys backs to the input page');
    equal(parents.fuzzy, 'input', 'fuzzy backs to the input page');
    equal(parents.keyboards, 'input', 'keyboards backs to the input page');

    // Unknown page names are a no-op (device gates probe with typos).
    world.FeelimeSettings().showPage('nosuch');
    equal(hiddenMap().home, false, 'unknown page leaves the current page alone');
});

test('navigation: home entry buttons open their group; the sub-page back button returns home', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const inputEntry = [...world.doc.querySelectorAll('[data-target]')]
        .find(b => b.dataset.target === 'input');
    inputEntry.click();
    equal(world.doc.querySelector('[data-page="input"]').hidden, false, 'input page open');
    equal(world.doc.querySelector('[data-page="home"]').hidden, true, 'home hidden');
    equal(world.lastCall('reportPage').args, ['input', 'home', world.token], 'entry click reports the page name');

    const back = world.doc.querySelector('[data-page="input"] [data-back]');
    back.click();
    equal(world.doc.querySelector('[data-page="home"]').hidden, false, 'back returns home');
    equal(world.doc.querySelector('[data-page="input"]').hidden, true, 'input page hidden');
    equal(world.lastCall('reportPage').args, ['home', 'home', world.token], 'back reports home');
});

test('input page splits fuzzy and keyboards into third-level pages (2026-09-30 acceptance)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    // fake DOM 不支持 :not([hidden])——遍历比对（同 renderDictBase 口径）。
    const visible = () => [...world.doc.querySelectorAll('[data-page]')]
        .find(p => !p.hidden).dataset.page;

    // 入口在 input 页：点开各自的三级页，内容 id 原样迁入。
    world.FeelimeSettings().showPage('input');
    world.$('btnOpenFuzzy').click();
    equal(visible(), 'fuzzy', 'fuzzy entry opens the fuzzy page');
    assert(world.$('fuzzyBit16'), 'fuzzy switches live on the fuzzy page');
    equal(world.lastCall('reportPage').args, ['fuzzy', 'input', world.token],
        'fuzzy reports input as its parent');
    world.doc.querySelector('[data-page="fuzzy"] [data-back]').click();
    equal(visible(), 'input', 'in-page back returns to input');

    world.$('btnOpenKeyboards').click();
    equal(visible(), 'keyboards', 'keyboards entry opens the keyboards page');
    assert(world.$('kbModeList') && world.$('quickPairA'),
        'keyboard list and quick-pair selects live on the keyboards page');
    equal(world.lastCall('reportPage').args, ['keyboards', 'input', world.token],
        'keyboards reports input as its parent');

    // 快捷设置 tile 深链（openSetupPage → focusSetting）：锚点随卡片
    // 迁入后要直接落到三级页。
    world.FeelimeSettings().showPage('home');
    equal(world.FeelimeSettings().focusSetting('quickPairA'), true,
        'quickPairA anchor still resolves');
    equal(visible(), 'keyboards', 'quickPairA tile lands on the keyboards page');
    world.FeelimeSettings().showPage('home');
    equal(world.FeelimeSettings().focusSetting('menuModesRow'), true,
        'menuModesRow anchor still resolves');
    equal(visible(), 'keyboards', 'menuModesRow tile lands on the keyboards page');
    world.FeelimeSettings().showPage('home');
    equal(world.FeelimeSettings().focusSetting('fuzzyBit16'), true,
        'fuzzy switch anchor resolves');
    equal(visible(), 'fuzzy', 'fuzzy anchors land on the fuzzy page');

    // input 页瘦身：两张内容卡不在 input 页里了，只剩入口卡。
    world.FeelimeSettings().showPage('input');
    const inputPage = world.doc.querySelector('[data-page="input"]');
    assert(inputPage.querySelector('#sec-fuzzy-entry'), 'fuzzy entry card on input');
    assert(inputPage.querySelector('#secKeyboards-entry'), 'keyboards entry card on input');
    equal(inputPage.querySelector('#sec-fuzzy'), null, 'fuzzy card moved out');
    equal(inputPage.querySelector('#secKeyboards'), null, 'keyboards card moved out');
});

test('hidden pages still render from state pushes (R7: render does not follow the page)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE }); // still on home
    assert(world.doc.querySelector('.model[data-id="m-stream"]'),
        'model row built although the voice page is hidden');
    assert(world.$('updateStatus').textContent.includes('版本'),
        'update status rendered although the update page is hidden');
    assert([...world.$('aboutRows').querySelectorAll('.row')].length >= 4,
        'about rows rendered although the about page is hidden');
});

test('about page: version rows from device + active/built-in keyboards; 复制版本信息 posts copyText', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, inputStats: { today: 12, total: 345 } });
    const rows = [...world.$('aboutRows').querySelectorAll('.row')]
        .map(r => r.textContent);
    assert(rows.some(t => t.includes('App 版本') && t.includes('0.17.6')), `app row: ${rows}`);
    assert(rows.some(t => t.includes('当前') && t.includes('3.20.0')), `active kb row: ${rows}`);
    assert(rows.some(t => t.includes('内置') && t.includes('3.21.0')), `built-in kb row: ${rows}`);
    assert(rows.some(t => t.includes('手机型号') && t.includes('Google Pixel 8')), `model row: ${rows}`);
    assert(rows.some(t => t.includes('系统版本') && t.includes('Android 15') && t.includes('35')),
        `os row: ${rows}`);
    // #41 输入字数行渲染（今日/累计），但复制版本信息不带（易变数据）。
    assert(rows.some(t => t.includes('输入字数') && t.includes('12') && t.includes('345')),
        `stats row: ${rows}`);

    world.$('btnCopyAbout').click();
    const [text, token] = world.lastCall('copyText').args;
    equal(token, world.token, 'copyText token');
    const lines = text.split('\n');
    equal(lines.length, 5, 'copy block is one line per version row');
    equal(lines.some(l => l.includes('输入字数')), false, 'volatile stats never join the copy block');
    assert(lines.some(l => l === 'App 版本: v0.17.6'), `app line: ${lines}`);
    assert(lines.some(l => l === '键盘版本（当前）: v3.20.0'), `active line: ${lines}`);
    assert(lines.some(l => l === '键盘版本（内置）: v3.21.0'), `built-in line: ${lines}`);
    assert(lines.some(l => l === '手机型号: Google Pixel 8'), `model line: ${lines}`);
    assert(lines.some(l => l === '系统版本: Android 15（API 35）'), `os line: ${lines}`);
    equal(world.$('aboutNote').textContent, '已复制', 'copy note shown');
});

test('bridge error events land in their note nodes (customError / updateError / asrNote)', () => {
    const world = new SettingsWorld();
    world.FeelimeSettings().onEvent({ type: 'customError', message: 'JSON 需为 {"version":1,…}' });
    assert(world.$('customNote').textContent.includes('JSON 需为'), 'customNote');
    world.FeelimeSettings().onEvent({ type: 'updateError', message: '请先填入更新源地址' });
    assert(world.$('updateStatus').textContent.includes('请先填入更新源地址'), 'updateStatus');
    world.FeelimeSettings().onEvent({ type: 'asrNote', message: '已保存，但超长/超量的 1 行热词被忽略' });
    assert(world.$('asrNote').textContent.includes('超量'), 'asrNote');
});

test('focused fields are never re-rendered by a state push', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.$('hotwords').focus();
    world.doc.activeElement = world.$('hotwords');
    world.$('hotwords').value = '打字中';
    world.push({ ...BASE_STATE, asr: { stripPeriod: true, hotwords: '保存过的旧值' } });
    equal(world.$('hotwords').value, '打字中', 'focused textarea untouched');
    world.doc.activeElement = null;
    world.push({ ...BASE_STATE, asr: { stripPeriod: true, hotwords: '保存过的旧值' } });
    equal(world.$('hotwords').value, '保存过的旧值', 'unfocused field syncs');
});

test('model backend selection reflects state and sends only an explicit change', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, uiLocale: 'en', modelBackend: 'remote' });
    equal(world.$('modelBackend').value, 'remote', 'download backend restored');
    equal(world.native.of('setModelBackend').length, 0, 'render never writes preferences');
    world.$('modelBackend').value = 'auto';
    world.$('modelBackend').listeners.find(l => l.type === 'change').handler({target: world.$('modelBackend')});
    equal(world.native.of('setModelBackend').slice(-1)[0].args, ['auto', world.token], 'explicit selection uses authenticated bridge');
});

test('Play app updates have their own store action while keyboard ZIP controls remain available', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, playDistribution: false });
    assert(world.$('btnAppStore').hidden, 'direct channel hides store action');
    world.push({ ...BASE_STATE, playDistribution: true });
    assert(!world.$('btnAppStore').hidden, 'Play channel exposes store action');
    world.$('btnAppStore').listeners.find(l => l.type === 'click').handler();
    equal(world.native.of('openAppStore').slice(-1)[0].args, [world.token], 'store action authenticated');
    assert(!world.$('btnInstallZip').hidden, 'keyboard resource installation stays available');
});

// ------------------------------------------------- custom phrases (issue #17)

test('custom phrases: state renders the list; CRUD resends the full payload with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, customPhrases: {
        enabled: true, items: [{ text: '↑', code: 'shang' }, { text: '✓', code: 'dui' }],
    } });
    equal(world.$('phrasesOn').checked, true, 'toggle on from state');
    const rows = [...world.doc.querySelectorAll('#phraseList .phrase-row')];
    equal(rows.length, 2, 'two rows rendered');
    equal(rows[0].querySelector('.phrase-text').textContent, '↑', 'row text');
    equal(rows[0].querySelector('code').textContent, 'shang', 'row code');

    // 添加：新词条追加重发全量（text+code+enabled）。
    world.$('phraseText').value = '🐱';
    world.$('phraseCode').value = 'Mao';
    world.$('btnSavePhrase').click();
    const args = world.lastCall('saveCustomPhrases').args;
    equal(args.length, 3, 'items + enabled + token');
    equal(args[2], world.token, 'token');
    equal(JSON.parse(args[0]).length, 3, 'full list resent');
    equal(JSON.parse(args[0])[2], { text: '🐱', code: 'mao' }, 'code normalized to lowercase');
    equal(args[1], true, 'enabled carried through');

    // 重复码拒绝、且不发桥调用。
    const calls = world.native.of('saveCustomPhrases').length;
    world.$('phraseText').value = 'dup';
    world.$('phraseCode').value = 'shang';
    world.$('btnSavePhrase').click();
    equal(world.native.of('saveCustomPhrases').length, calls, 'duplicate code not saved');

    // 编辑：点行进入编辑态，保存改写该行。
    world.push({ ...BASE_STATE, customPhrases: {
        enabled: true, items: [{ text: '↑', code: 'shang' }, { text: '✓', code: 'dui' }],
    } });
    [...world.doc.querySelectorAll('#phraseList .phrase-edit')][1].click();
    equal(world.$('btnSavePhrase').textContent, '保存修改', 'edit mode label');
    equal(world.$('btnCancelPhraseEdit').hidden, false, 'cancel visible in edit mode');
    world.$('phraseText').value = '✔';
    world.$('btnSavePhrase').click();
    const edited = JSON.parse(world.lastCall('saveCustomPhrases').args[0]);
    equal(edited[1], { text: '✔', code: 'dui' }, 'edit rewrites the row');

    // 删除：行内 ✕ 立即重发剩余表。
    world.push({ ...BASE_STATE, customPhrases: {
        enabled: true, items: [{ text: '↑', code: 'shang' }, { text: '✓', code: 'dui' }],
    } });
    [...world.doc.querySelectorAll('#phraseList .phrase-del')][0].click();
    equal(JSON.parse(world.lastCall('saveCustomPhrases').args[0]).length, 1, 'delete resends the rest');

    // 开关：只翻 enabled，词条表保持。
    const box = world.$('phrasesOn');
    box.checked = false;
    box.listeners.find(l => l.type === 'change').handler({ target: box });
    const offArgs = world.lastCall('saveCustomPhrases').args;
    equal(offArgs[1], false, 'toggle off carried');
    equal(JSON.parse(offArgs[0]).length, 1, 'items unchanged by the toggle');
});

test('custom phrases: the 200-entry cap is enforced locally before the bridge call', () => {
    const world = new SettingsWorld();
    const items = Array.from({ length: 200 }, (_, i) => ({ text: '词' + i, code: 'w' + i }));
    world.push({ ...BASE_STATE, customPhrases: { enabled: true, items } });
    world.$('phraseText').value = '多一条';
    world.$('phraseCode').value = 'duo';
    world.$('btnSavePhrase').click();
    equal(world.native.of('saveCustomPhrases').length, 0, 'the 201st entry is refused locally');
    // 删除一条后同一添加立即通过（200 上限是硬边界不是粘滞态）。
    [...world.doc.querySelectorAll('#phraseList .phrase-del')][0].click();
    const afterDelete = JSON.parse(world.lastCall('saveCustomPhrases').args[0]);
    equal(afterDelete.length, 199, 'delete resends 199');
    world.$('phraseText').value = '多一条';
    world.$('phraseCode').value = 'duo';
    world.$('btnSavePhrase').click();
    equal(JSON.parse(world.lastCall('saveCustomPhrases').args[0]).length, 200, 'add passes at 200');
});

// ---- 自造词（issue #29-5）：词库管理的三级编辑页 ----
test('user words: state renders the list; CRUD resends the full payload with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, userWords: [{ text: '你好世界', code: 'nihaoshijie' }] });
    const rows = [...world.doc.querySelectorAll('#userWordList .phrase-row')];
    equal(rows.length, 1, 'one row rendered');
    equal(rows[0].querySelector('.phrase-text').textContent, '你好世界', 'row text');
    equal(rows[0].querySelector('code').textContent, 'nihaoshijie', 'row code');
    equal(world.$('userWordEmpty').hidden, true, 'empty hint hidden with rows');

    // 添加：全量重发（saveUserWords 只带 items+token，无 enabled）。
    world.$('userWordText').value = '张伟';
    world.$('userWordCode').value = 'ZhangWei';
    world.$('btnSaveUserWord').click();
    const args = world.lastCall('saveUserWords').args;
    equal(args.length, 2, 'items + token');
    equal(args[1], world.token, 'token');
    equal(JSON.parse(args[0]).length, 2, 'full list resent');
    equal(JSON.parse(args[0])[1], { text: '张伟', code: 'zhangwei' }, 'code normalized to lowercase');

    // 重复码拒绝、且不发桥调用；超长码本地拒绝。
    const calls = world.native.of('saveUserWords').length;
    world.$('userWordText').value = 'dup';
    world.$('userWordCode').value = 'zhangwei';
    world.$('btnSaveUserWord').click();
    equal(world.native.of('saveUserWords').length, calls, 'duplicate code not saved');
    world.$('userWordText').value = 'bad';
    world.$('userWordCode').value = 'a'.repeat(49);
    world.$('btnSaveUserWord').click();
    equal(world.native.of('saveUserWords').length, calls, 'over-long code rejected locally');

    // 编辑与删除。
    [...world.doc.querySelectorAll('#userWordList .phrase-edit')][0].click();
    equal(world.$('btnSaveUserWord').textContent, '保存', 'edit mode label');
    world.$('userWordText').value = '改';
    world.$('btnSaveUserWord').click();
    equal(JSON.parse(world.lastCall('saveUserWords').args[0])[0], { text: '改', code: 'nihaoshijie' }, 'edit rewrites the row');
    [...world.doc.querySelectorAll('#userWordList .phrase-del')][0].click();
    equal(JSON.parse(world.lastCall('saveUserWords').args[0]).length, 1, 'delete shrinks the list');
});

test('user words: CRUD is refused before the first state push; 200 cap local', () => {
    const world = new SettingsWorld();
    // state 未到：空副本全量重发会把用户词表清空——必须拒绝。
    world.$('userWordText').value = 'x';
    world.$('userWordCode').value = 'xx';
    world.$('btnSaveUserWord').click();
    equal(world.native.of('saveUserWords').length, 0, 'no bridge call before state');

    world.push({ ...BASE_STATE, userWords: [] });
    const filled = Array.from({ length: 200 }, (_, i) => ({ text: `t${i}`, code: `c${i}` }));
    world.push({ ...BASE_STATE, userWords: filled });
    world.$('userWordText').value = 'overflow';
    world.$('userWordCode').value = 'overflow';
    world.$('btnSaveUserWord').click();
    equal(world.native.of('saveUserWords').length, 0, '201st entry rejected locally');
});

test('custom phrases: CRUD is refused before the first state push (no seed wipe)', () => {
    const world = new SettingsWorld();
    // Bridge hello only - no state push yet. phraseItems is still null.
    world.$('phraseText').value = '瓢虫';
    world.$('phraseCode').value = 'pichong';
    world.$('btnSavePhrase').click();
    equal(world.native.of('saveCustomPhrases').length, 0, 'add refused before state arrives');
    const box = world.$('phrasesOn');
    box.checked = false;
    box.listeners.find(l => l.type === 'change').handler({ target: box });
    equal(world.native.of('saveCustomPhrases').length, 0, 'toggle refused before state arrives');
});

test('custom phrases: empty list shows the hint; third-level page routes back to dict', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, customPhrases: { enabled: false, items: [] } });
    equal(world.$('phraseEmpty').hidden, false, 'empty hint visible');
    equal(world.$('phrasesOn').checked, false, 'toggle off from state');

    // 三级页（#54 归位）：back 回 dict，不回 input/home；开关与
    // 管理按钮现在挂在词库页卡片里，输入页不再有这两个元素。
    world.FeelimeSettings().showPage('dict');
    world.FeelimeSettings().showPage('phrases');
    equal(world.doc.querySelector('[data-page="phrases"]').hidden, false, 'phrases page open');
    world.doc.querySelector('[data-page="phrases"] [data-back]').click();
    equal(world.doc.querySelector('[data-page="dict"]').hidden, false, 'back lands on dict');
    equal(world.doc.querySelector('[data-page="phrases"]').hidden, true, 'phrases closed');
    assert(world.$('sec-dict-phrases').contains(world.$('phrasesOn')),
        'symbol toggle lives in the dict page card');
    assert(world.$('sec-dict-phrases').contains(world.$('btnManagePhrases')),
        'manage button lives in the dict page card');
    assert(!world.$('sec-phrases').contains(world.$('phrasesOn')),
        'input page no longer hosts the symbol toggle');
    equal(world.$('phrasesTitle').textContent, '候选增强',
        'input card renamed to the english/slash scope');
});

// ------------------------------------------------- double-pinyin scheme (§2)

test('double-pinyin selector reflects state and sends the change with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, dpScheme: 'flypy' });
    equal(world.$('dpScheme').value, 'flypy', 'state value wins');
    assert(world.$('dpNote').textContent.length > 0, 'per-scheme note rendered');
    const select = world.$('dpScheme');
    select.value = 'sogou';
    select.listeners.find(l => l.type === 'change').handler({ target: select });
    equal(world.lastCall('setDoublePinyinScheme').args, ['sogou', world.token],
        'setDoublePinyinScheme token');
    // Native stays authoritative after the round trip.
    world.push({ ...BASE_STATE, dpScheme: 'sogou' });
    equal(world.$('dpScheme').value, 'sogou', 'selection follows the state push');
});

test('double-pinyin key map renders the active scheme chart from dp-data.js', () => {
    const world = new SettingsWorld();
    assert(world.sandbox.FeelimeDp && world.sandbox.FeelimeDp.maps,
        'real dp-data.js loaded into the page');
    world.push({ ...BASE_STATE, dpScheme: 'sogou' });
    const cells = [...world.doc.querySelectorAll('#dpKeymap .kmap-key')];
    const semi = cells.find(el => el.querySelector('b').textContent === ';');
    assert(semi, 'sogou chart carries the ; key cell');
    assert(semi.textContent.includes('ing'), '; cell shows the ing final');
    // Switching schemes redraws the chart from the same host.
    const select = world.$('dpScheme');
    select.value = 'flypy';
    world.push({ ...BASE_STATE, dpScheme: 'flypy' });
    const flypyCells = [...world.doc.querySelectorAll('#dpKeymap .kmap-key')];
    const k = flypyCells.find(el => el.querySelector('b').textContent === 'K');
    assert(k && k.textContent.includes('uai'), 'flypy chart shows K=ing/uai');
    // 自然码 folds ui + ü onto one line in V.
    world.push({ ...BASE_STATE, dpScheme: 'ziranma' });
    const zCells = [...world.doc.querySelectorAll('#dpKeymap .kmap-key')];
    const v = zCells.find(el => el.querySelector('b').textContent === 'V');
    assert(v && v.textContent.includes('ü'), 'ziranma V carries ui ü');
    // 紫光（issue #16）：state 推送回显选中项（白名单），N 折叠 ui üe，
    // C 无韵母不出格，; 键 ing。
    world.push({ ...BASE_STATE, dpScheme: 'ziguang' });
    equal(world.$('dpScheme').value, 'ziguang', 'ziguang state round-trips');
    const gCells = [...world.doc.querySelectorAll('#dpKeymap .kmap-key')];
    const n = gCells.find(el => el.querySelector('b').textContent === 'N');
    assert(n && n.textContent.includes('ui') && n.textContent.includes('üe'),
        'ziguang N folds ui üe');
    const gSemi = gCells.find(el => el.querySelector('b').textContent === ';');
    assert(gSemi && gSemi.textContent.includes('ing'), 'ziguang ; carries ing');
    assert(!gCells.find(el => el.querySelector('b').textContent === 'C'),
        'ziguang C (no final) is omitted from the chart');
});

// ------------------------------------------------- feel tuning card (UI-18/19)

// ---- 上下滑方向互换（issue #29-2）：feel 卡开关 ----
test('flick swap toggle reflects state and commits setFlickSwap with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('flickSwap').checked, false, 'default off');
    world.push({ ...BASE_STATE, flickSwap: true });
    equal(world.$('flickSwap').checked, true, 'follows state');
    const box = world.$('flickSwap');
    box.checked = true;
    box.listeners.find(l => l.type === 'change').handler({ target: box });
    equal(world.lastCall('setFlickSwap').args, [true, world.token], 'commit + token');
});

test('feel card renders state values and commits each control with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, bottomPadPortrait: 24, bottomPadLandscape: 12, holdMs: 450, scrubSpeed: 2, popupSnap: 2, candidateFont: 135 });
    equal(world.$('bottomPadPortrait').value, '24', 'portrait pad from state');
    equal(world.$('bottomPadLandscape').value, '12', 'landscape pad from state');
    equal(world.$('holdMs').value, '450', 'hold ms from state');
    equal(world.$('scrubSpeed').value, '2', 'scrub speed from state');
    equal(world.$('popupSnap').value, '2', 'popup snap from state');
    equal(world.$('candidateFont').value, '135', 'candidate font from state (#42 slider)');
    equal(world.$('candidateFontOut').textContent, '135%', 'slider readout follows state');

    const fire = (id) => {
        const select = world.$(id);
        const change = select.listeners.find(listener => listener.type === 'change');
        assert(change, `#${id} has a change listener`);
        change.handler({ target: select });
    };
    // The three feel selects always report all three values together.
    fire('holdMs');
    equal(world.lastCall('setFeelOptions').args, [2, 450, 2, world.token], 'feel triple + token');
    fire('scrubSpeed');
    equal(world.lastCall('setFeelOptions').args, [2, 450, 2, world.token], 'unchanged values still complete');
    fire('bottomPadPortrait');
    equal(world.lastCall('setBottomPadPortrait').args, [24, world.token], 'portrait pad + token');
    fire('bottomPadLandscape');
    equal(world.lastCall('setBottomPadLandscape').args, [12, world.token], 'landscape pad + token');
    fire('candidateFont');
    equal(world.lastCall('setCandidateFont').args, [135, world.token], 'candidate font + token');
});


test('feel card defaults when state omits the values and never adopts off-whitelist ones', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('bottomPadPortrait').value, '0', 'portrait pad default 0');
    equal(world.$('bottomPadLandscape').value, '0', 'landscape pad default 0');
    equal(world.$('holdMs').value, '350', 'hold default 350');
    equal(world.$('scrubSpeed').value, '3', 'scrub default 3x');
    equal(world.$('popupSnap').value, '1', 'snap default standard');
    equal(world.$('candidateFont').value, '100', 'candidate font default 100% (#42 slider)');
    // Native validates too, but the page must not blindly mirror junk.
    world.push({ ...BASE_STATE, bottomPadPortrait: 7, bottomPadLandscape: 9, holdMs: 1234, scrubSpeed: 99, popupSnap: 9, candidateFont: 5 });
    equal(world.$('bottomPadPortrait').value, '0', 'off-list portrait pad ignored');
    equal(world.$('bottomPadLandscape').value, '0', 'off-list landscape pad ignored');
    equal(world.$('holdMs').value, '350', 'off-list hold ignored');
    equal(world.$('scrubSpeed').value, '3', 'off-list scrub ignored');
    equal(world.$('popupSnap').value, '1', 'off-list snap ignored');
    equal(world.$('candidateFont').value, '100', 'off-range candidate font ignored');
});

test('fuzzy-pinyin group toggles reflect the state mask and commit the combined mask', () => {
    const world = new SettingsWorld();
    const boxes = () => [...world.doc.querySelectorAll('input[data-fuzzy-bit]')];
    world.push({ ...BASE_STATE, fuzzyPinyinMask: 3 });
    equal(boxes().map(box => box.checked), [true, true, false, false, false],
        'bits 1|2 checked from state mask 3');
    world.push({ ...BASE_STATE });
    equal(boxes().some(box => box.checked), false, 'default mask 0 leaves all off');

    // 只点第 5 组：change 组合所有已勾选位（已有 1）→ 17。
    world.push({ ...BASE_STATE, fuzzyPinyinMask: 1 });
    const nasal = world.$('fuzzyBit16');
    const change = nasal.listeners.find(listener => listener.type === 'change');
    assert(change, '#fuzzyBit16 has a change listener');
    nasal.checked = true;
    change.handler({ target: nasal });
    equal(world.lastCall('setFuzzyPinyinMask').args, [17, world.token],
        'combined mask + token');

    // 焦点所在的组不被异步 state 推送回写（连续点按不丢）。
    nasal.checked = true;
    world.doc.activeElement = nasal;
    world.push({ ...BASE_STATE, fuzzyPinyinMask: 1 });
    equal(nasal.checked, true, 'focused box keeps user state');
    world.doc.activeElement = null;
    world.push({ ...BASE_STATE, fuzzyPinyinMask: 1 });
    equal(nasal.checked, false, 'unfocused box follows state again');
});

test('association toggle reflects state and commits with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, associationOn: true });
    equal(world.$('associationOn').checked, true, 'association on from state');
    world.push({ ...BASE_STATE });
    equal(world.$('associationOn').checked, false, 'association default off');

    const box = world.$('associationOn');
    const change = box.listeners.find(listener => listener.type === 'change');
    assert(change, '#associationOn has a change listener');
    box.checked = true;
    change.handler({ target: box });
    equal(world.lastCall('setAssociation').args, [true, world.token],
        'association toggle + token');
});

test('datetime candidates toggle defaults on and commits with the token', () => {
    const world = new SettingsWorld();
    // 缺字段（旧 native 的 state）与 true 都按开处理。
    world.push({ ...BASE_STATE });
    equal(world.$('dynamicDateTimeOn').checked, true, 'missing field falls back to on');
    world.push({ ...BASE_STATE, dynamicDateTimeOn: false });
    equal(world.$('dynamicDateTimeOn').checked, false, 'explicit off renders off');

    const box = world.$('dynamicDateTimeOn');
    const change = box.listeners.find(listener => listener.type === 'change');
    assert(change, '#dynamicDateTimeOn has a change listener');
    box.checked = false;
    change.handler({ target: box });
    equal(world.lastCall('setDynamicDateTime').args, [false, world.token],
        'datetime toggle + token');
});

test('base dictionary card renders builtin/custom/building and wires the actions (#23 + #7 slots)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    // builtin 态：槽列表只有内置行（builtin radio 选中）+ 换装可点。
    assert(world.$('dictBaseCurrent').textContent.includes('rime-frost'),
        'builtin shows the built-in lexicon');
    const slotRows = () => [...world.doc.querySelectorAll('#dictBaseSlots .dict-slot')];
    equal(slotRows().length, 1, 'no slots yet: only the builtin row');
    assert(slotRows()[0].querySelector('input').checked,
        'builtin radio checked');
    equal(world.$('btnBaseDictPick').disabled, false, 'pick enabled on builtin');
    equal(world.$('dictBaseBuilding').hidden, true, 'building hint hidden');

    // custom + 槽：列表 = 内置 + 槽们，激活槽 radio 选中、槽行带删除。
    world.push({ ...BASE_STATE, baseDict: { mode: 'custom', building: false,
        name: 'rime-ice.base.dict.yaml', installedAt: 1758300000000,
        activeSlot: 'abc123def456',
        slots: [
            { id: 'abc123def456', name: 'rime-ice.base.dict.yaml', entries: 89000,
              installedAt: 1758300000000 },
            { id: 'fff222eee333', name: 'wanxiang-lite.zip', entries: 2700000,
              installedAt: 1758400000000 },
        ] } });
    assert(world.$('dictBaseCurrent').textContent.includes('rime-ice.base.dict.yaml'),
        'custom shows the imported name');
    equal(slotRows().length, 3, 'builtin + two slots');
    const checkedId = slotRows().map(r => r.querySelector('input'))
        .find(i => i.checked).value;
    equal(checkedId, 'abc123def456', 'active slot radio checked');
    equal(slotRows()[0].querySelector('.slot-del'), null,
        'builtin row has no delete');
    assert(slotRows()[2].querySelector('.slot-del'), 'slot rows carry delete');

    // building 态：radio/删除全部禁用。
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: true } });
    equal(world.$('dictBaseBuilding').hidden, false, 'building hint visible');
    equal(world.$('btnBaseDictPick').disabled, true, 'pick disabled while building');
    assert(slotRows().every(r => r.querySelector('input').disabled),
        'slot radios disabled while building');

    // 事件：进度文案（阶段 + 已耗时）与完成收尾。
    world.FeelimeSettings().onEvent({ type: 'dictBaseProgress', stage: 'COMPILING',
        elapsedMs: 32000 });
    assert(world.$('dictBaseBuilding').textContent.includes('32'),
        'elapsed seconds surface in the hint');
    world.FeelimeSettings().onEvent({ type: 'dictBaseDone',
        message: '基底词库换装完成' });
    equal(world.$('dictBaseBuilding').hidden, true, 'done collapses the hint');
    equal(world.$('dictBaseNote').textContent, '基底词库换装完成', 'note carries the message');

    // 按钮接线（带 token）：导入走 SAF；radio 点槽 = activate；点内置 =
    // revert（恢复内置并入列表第一项）；删除按钮带槽 id。
    world.$('btnBaseDictPick').click();
    equal(world.lastCall('openBaseDictDocument').args, [world.token], 'pick opens the SAF picker');
    world.push({ ...BASE_STATE, baseDict: { mode: 'custom', building: false,
        name: 'x', activeSlot: 'abc123def456',
        slots: [{ id: 'abc123def456', name: 'x', entries: 1 }] } });
    const activeRadio = slotRows().map(r => r.querySelector('input'))
        .find(i => i.value === 'abc123def456');
    activeRadio.checked = true;
    activeRadio.listeners.find(l => l.type === 'change').handler({ target: activeRadio });
    equal(world.lastCall('activateBaseDictSlot').args, ['abc123def456', world.token],
        'radio on a slot activates it');
    const builtinRadio = slotRows()[0].querySelector('input');
    builtinRadio.checked = true;
    builtinRadio.listeners.find(l => l.type === 'change').handler({ target: builtinRadio });
    equal(world.lastCall('clearBaseDict').args, [world.token],
        'radio on builtin reverts');
    slotRows()[1].querySelector('.slot-del').listeners
        .find(l => l.type === 'click').handler({ preventDefault() {}, stopPropagation() {} });
    equal(world.lastCall('deleteBaseDictSlot').args, ['abc123def456', world.token],
        'delete carries the slot id');
});

test('base dictionary switching copy states the effective lexicon and the target (#7 user ruling)', () => {
    const world = new SettingsWorld();
    // 复现路径：刚切回内置（note 残留「已恢复内置词库」）再点槽激活。
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: false,
        slots: [
            { id: 'abc123def456', name: 'rime-ice.base.dict.yaml', entries: 89000,
              installedAt: 1758300000000 },
            { id: 'fff222eee333', name: 'wanxiang-lite.zip', entries: 2700000,
              installedAt: 1758400000000 },
        ] } });
    world.FeelimeSettings().onEvent({ type: 'dictBaseDone',
        message: '已恢复内置词库' });
    equal(world.$('dictBaseNote').textContent, '已恢复内置词库', 'stale revert note in place');

    const slotRows = () => [...world.doc.querySelectorAll('#dictBaseSlots .dict-slot')];
    const wanxiang = slotRows().map(r => r.querySelector('input'))
        .find(i => i.value === 'fff222eee333');
    wanxiang.checked = true;
    wanxiang.listeners.find(l => l.type === 'change').handler({ target: wanxiang });
    equal(world.lastCall('activateBaseDictSlot').args, ['fff222eee333', world.token],
        'radio activates the slot');
    equal(world.$('dictBaseNote').textContent, '', 'starting a switch clears the stale note');

    // 编译期进度事件（state 尚未回推）：文案 = 实际生效 + 切换目标。
    world.FeelimeSettings().onEvent({ type: 'dictBaseProgress', stage: 'COMPILING',
        elapsedMs: 32000 });
    const hint = world.$('dictBaseBuilding').textContent;
    assert(hint.includes('当前生效') && hint.includes('rime-frost'),
        'hint names the still-effective lexicon: ' + hint);
    assert(hint.includes('wanxiang-lite.zip'),
        'hint names the switch target: ' + hint);
    assert(hint.includes('32'), 'stage/elapsed still surface');

    // 页面重开（state 恢复）：targetSlot 决定选中态——不再回落到内置。
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: true,
        stage: 'COMPILING', elapsedMs: 60000, targetSlot: 'fff222eee333',
        slots: [
            { id: 'abc123def456', name: 'rime-ice.base.dict.yaml', entries: 89000 },
            { id: 'fff222eee333', name: 'wanxiang-lite.zip', entries: 2700000 },
        ] } });
    equal(world.$('dictBaseBuilding').hidden, false, 'building restored from state');
    const checkedId = slotRows().map(r => r.querySelector('input'))
        .find(i => i.checked).value;
    equal(checkedId, 'fff222eee333', 'radio points at the in-flight target, not builtin');
    assert(world.$('dictBaseBuilding').textContent.includes('正在切换到'),
        'restored hint carries the target too');

    // 完成：pending 清掉，note 反映实际生效词库。
    world.FeelimeSettings().onEvent({ type: 'dictBaseDone',
        message: '已切换到 wanxiang-lite.zip' });
    equal(world.$('dictBaseNote').textContent, '已切换到 wanxiang-lite.zip',
        'done note names the swapped-in lexicon');
    world.push({ ...BASE_STATE, baseDict: { mode: 'custom', building: false,
        name: 'wanxiang-lite.zip', activeSlot: 'fff222eee333',
        slots: [
            { id: 'abc123def456', name: 'rime-ice.base.dict.yaml', entries: 89000 },
            { id: 'fff222eee333', name: 'wanxiang-lite.zip', entries: 2700000 },
        ] } });
    equal(slotRows().map(r => r.querySelector('input')).find(i => i.checked).value,
        'fff222eee333', 'active slot stays checked after the swap');
    assert(world.$('dictBaseCurrent').textContent.includes('wanxiang-lite.zip'),
        'current line reflects the effective lexicon');
});

test('issue-39/50: hold-space virtual custom key (summary + editor) / volume / haptic', () => {
    const world = new SettingsWorld();
    // 摘要反映：tap 值优先，旧布尔回退，默认 voice。
    world.push({ ...BASE_STATE, spaceHoldTap: 'dsl:[panel:clipboard]', keySoundVolume: 40, keyHapticStrength: 2 });
    equal(world.$('spaceHoldSummary').textContent, '剪贴板面板', 'panel tap renders panel label');
    equal(world.$('keySoundVolume').value, '40', 'volume slider reflects state');
    equal(world.$('keyHapticStrength').value, '2', 'haptic strength reflects state');
    world.push({ ...BASE_STATE, voiceOnSpace: false });
    equal(world.$('spaceHoldSummary').textContent, '关闭', 'legacy boolean false maps to none');
    world.push({ ...BASE_STATE });
    equal(world.$('spaceHoldSummary').textContent, '语音输入', 'default maps to voice');
    world.push({ ...BASE_STATE, spaceHoldTap: 'dsl:hi there' });
    equal(world.$('spaceHoldSummary').textContent.includes('文本'), true,
        'text tap renders mode + preview: ' + world.$('spaceHoldSummary').textContent);
    // 编辑器：入口按钮 → 同款弹层（类型下拉，voice 置顶）→ 文本型保存
    // 走 setSpaceHoldTap('dsl:<tap>')。
    const fire = (el, type, target) =>
        el.listeners.find(l => l.type === type).handler({ target });
    world.$('spaceHoldEdit').click();
    equal(world.$('ckModalTitle').textContent, '长按空格动作', 'space editor title');
    const modeSel = world.doc.getElementById('ckMode');
    equal(modeSel.tagName, 'SELECT', 'type picker is a dropdown (9 kinds)');
    equal([...modeSel.querySelectorAll('option')].length, 9, 'voice/none prepended for space');
    equal(modeSel.value, 'text', 'current tap back-fills the type');
    const textInput = world.doc.getElementById('ckText');
    textInput.value = 'me@x.com'; fire(textInput, 'input');
    world.$('ckApply').click();
    equal(world.lastCall('setSpaceHoldTap').args, ['dsl:me@x.com', world.token],
        'editor posts setSpaceHoldTap with dsl prefix + token');
    equal(world.$('spaceHoldSummary').textContent.includes('me@x.com'), true,
        'summary refreshes after save');
    equal(world.$('ckModal').hidden, true, 'modal closes after save');
    fire(world.$('keyHapticStrength'), 'change', { value: '0' });
    equal(world.lastCall('setKeyHapticStrength').args, [0, world.token], 'strength posts setKeyHapticStrength');
    // 音量滑条防抖 250ms：input 当拍不进桥（sandbox 的 setTimeout 只入队）。
    fire(world.$('keySoundVolume'), 'input', { value: '75' });
    equal(world.native.of('setKeySoundVolume').length, 0, 'volume debounced (not posted yet)');
});

test('key feedback toggles reflect state and commit with the token (default off)', () => {
    const world = new SettingsWorld();
    // Both default off: empty state renders unchecked.
    world.push({ ...BASE_STATE });
    equal(world.$('keySound').checked, false, 'key sound default off');
    equal(world.$('keyHaptic').checked, false, 'key haptic default off');
    world.push({ ...BASE_STATE, keySound: true, keyHaptic: true });
    equal(world.$('keySound').checked, true, 'key sound follows state');
    equal(world.$('keyHaptic').checked, true, 'key haptic follows state');

    for (const [id, method] of [['keySound', 'setKeySound'], ['keyHaptic', 'setKeyHaptic']]) {
        const box = world.$(id);
        const change = box.listeners.find(listener => listener.type === 'change');
        assert(change, `#${id} has a change listener`);
        box.checked = true;
        change.handler({ target: box });
        equal(world.lastCall(method).args, [true, world.token], `${id} toggle + token`);
    }
});

test('appearance page reflects state and commits themeMode / keyOpacity with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('themeMode').value, 'auto', 'theme mode default auto');
    equal(world.$('keyOpacity').value, '100', 'key opacity default 100 (opaque)');
    world.push({ ...BASE_STATE, themeMode: 'dark', keyOpacity: 45 });
    equal(world.$('themeMode').value, 'dark', 'theme mode follows state');
    equal(world.$('keyOpacity').value, '45', 'key opacity follows state');

    // Off-whitelist values never adopt.
    world.push({ ...BASE_STATE, themeMode: 'sepia', keyOpacity: 9999 });
    equal(world.$('themeMode').value, 'auto', 'bad theme mode falls back to auto');
    equal(world.$('keyOpacity').value, '100', 'out-of-range opacity clamps to 100');

    const theme = world.$('themeMode');
    theme.listeners.find(l => l.type === 'change').handler({ target: { value: 'light' } });
    equal(world.lastCall('setThemeMode').args, ['light', world.token], 'theme mode commit + token');

    // 按键气泡（issue #30-1）：默认关，state 回显，change 带提交。
    const bubbleToggle = world.$('keyBubble');
    equal(bubbleToggle.checked, false, 'key bubble defaults off');
    world.push({ ...BASE_STATE, keyBubble: true });
    equal(bubbleToggle.checked, true, 'key bubble follows state');
    bubbleToggle.listeners.find(l => l.type === 'change')
        .handler({ target: { checked: true } });
    equal(world.lastCall('setKeyBubble').args, [true, world.token],
        'key bubble commit + token');

    // 气泡停留档（验收 2026-09-24）：回显 + 换档过桥。
    const lingerSel = world.$('bubbleLinger');
    world.push({ ...BASE_STATE, bubbleLinger: 400 });
    equal(lingerSel.value, '400', 'linger echo renders the tier');
    lingerSel.value = '600';
    lingerSel.listeners.find(l => l.type === 'change').handler({ target: { value: '600' } });
    equal(world.lastCall('setBubbleLinger').args, [600, world.token],
        'linger tier commit + token');

    // Slider: input only marks dirty, change commits once with the parsed value.
    const slider = world.$('keyOpacity');
    const inputEvt = slider.listeners.find(l => l.type === 'input');
    const changeEvt = slider.listeners.find(l => l.type === 'change');
    assert(inputEvt && changeEvt, 'slider has input + change listeners');
    inputEvt.handler({ target: { value: '70' } });
    equal(world.native.calls.filter(c => c.method === 'setKeyOpacity').length, 0,
        'dragging (input) does not commit');
    changeEvt.handler({ target: { value: '70' } });
    equal(world.lastCall('setKeyOpacity').args, [70, world.token], 'release commits once + token');
    changeEvt.handler({ target: { value: '70' } });
    equal(world.native.calls.filter(c => c.method === 'setKeyOpacity').length, 1,
        'change without a prior input is ignored (no duplicate commit)');

    // Background selects still commit from the appearance page (the handler
    // reads the select's own value, not the event target).
    const bgLight = world.$('bgImageLight');
    bgLight.value = 'builtin';
    bgLight.listeners.find(l => l.type === 'change').handler({ target: bgLight });
    equal(world.lastCall('setBuiltinBgImage').args, ['light', world.token],
        'bg builtin commit keeps working from the appearance page');
});

test('keyboard height slider commits setKbHeight; reset writes 0; preview follows state', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, theme: 'dark', kbHeightPortrait: 0, kbHeightMin: 210, kbHeightMax: 400 });
    equal(world.$('kbHeight').min, '210', 'slider min from the shell bounds');
    equal(world.$('kbHeight').max, '400', 'slider max from the shell bounds');
    equal(world.$('kbHeight').value, '272', '0 (default) shows the built-in default');

    world.push({ ...BASE_STATE, theme: 'dark', kbHeightPortrait: 320, kbHeightMin: 210, kbHeightMax: 400 });
    equal(world.$('kbHeight').value, '320', 'saved height fills the slider');

    const slider = world.$('kbHeight');
    // 拖动（input 标记 dirty）→ 松手（change 才提交），与按键透明度同款。
    slider.listeners.find(l => l.type === 'input').handler({ target: { value: '300' } });
    slider.listeners.find(l => l.type === 'change').handler({ target: { value: '300' } });
    equal(world.lastCall('setKbHeight').args, [300, world.token], 'release commits px + token');

    world.$('kbHeightReset').listeners.find(l => l.type === 'click').handler({});
    equal(world.lastCall('setKbHeight').args[0], 0, 'reset writes 0 (= remove pref)');

    world.push({
        ...BASE_STATE, theme: 'dark', themeMode: 'auto', keyOpacity: 50,
        kbHeightPortrait: 320, kbHeightMin: 210, kbHeightMax: 400,
        bottomPadPortrait: 24, bgImageDark: 'REFEQz=', bgImageLight: '',
    });

    // 滑块 input 只标记（松手 change 才提交），预览交给真实键盘。
    const opacitySlider = world.$('keyOpacity');
    opacitySlider.value = '35';
    opacitySlider.listeners.find(l => l.type === 'input').handler({ target: { value: '35' } });
    equal(world.native.calls.filter(c => c.method === 'setKeyOpacity').length, 0,
        'dragging alone does not commit');
});

test('entering the appearance page pops the REAL keyboard; leaving dismisses it', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.native.calls.length = 0;

    const previewCalls = () => world.native.of('previewKeyboard').map(c => c.args[0]);
    equal(world.$('previewEditor') != null, true, 'demo editor exists on the page');

    world.FeelimeSettings().showPage('appearance');
    equal(previewCalls(), [true], 'entering appearance shows the real keyboard');
    world.FeelimeSettings().showPage('home');
    equal(previewCalls(), [true, false], 'leaving appearance dismisses it');
    // 重复进入/离开（单页路由重复 showPage 不重复发）。
    world.FeelimeSettings().showPage('home');
    equal(previewCalls(), [true, false], 'staying off appearance sends nothing');
});

test('bridge validation errors surface on the feel note', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.FeelimeSettings().onEvent({ type: 'feelOptionsError', code: 'INVALID_FEEL_OPTION' });
    assert(world.$('feelNote').textContent.includes('手感参数无效'), 'zh feel error note');
    world.FeelimeSettings().onEvent({ type: 'bottomPadError', code: 'BAD_BOTTOM_PAD' });
    assert(world.$('feelNote').textContent.length > 0, 'bottom pad error also lands on the note');
    world.FeelimeSettings().onEvent({ type: 'candidateFontError', code: 'BAD_CANDIDATE_FONT' });
    assert(world.$('feelNote').textContent.length > 0, 'candidate font error lands on the note');
});

// ------------------------------------------------- 搜索与直达锚（验收二改）

test('settings search surfaces setting rows with hints: 背景 → 亮色/暗色背景', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const input = world.$('settingsSearch');
    input.value = '背景';
    input.listeners.find(l => l.type === 'input').handler({ target: input });
    const box = world.$('searchResults');
    assert(!box.hidden, 'results visible');
    const hits = [...box.querySelectorAll('.search-hit')];
    const titles = hits.map(b => b.querySelector('.search-hit-main span').textContent);
    equal(titles[0], '亮色背景', '亮色背景 is the first hit');
    equal(titles[1], '暗色背景', '暗色背景 is the second hit');
    assert(titles.indexOf('外观') < 0, 'card fallback is hidden when its rows hit');
    // 说明小注跟着条目走（用户要看的不只是名字）。
    assert(hits[0].querySelector('.search-hit-desc').textContent.includes('铺满整个键盘区域'),
        'row hint rides along as the description');
    assert(hits[0].querySelector('.search-hit-page').textContent.length > 0, 'page label shown');
});

test('search hit click routes to the exact row via focusSetting', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const input = world.$('settingsSearch');
    input.value = '亮色背景';
    input.listeners.find(l => l.type === 'input').handler({ target: input });
    const hit = world.$('searchResults').querySelectorAll('.search-hit')[0];
    hit.listeners.find(l => l.type === 'click').handler();
    // 输入清空 + 下拉收起 + hashtag 锚到具体控件 + 整行呼吸。
    equal(world.$('settingsSearch').value, '', 'query cleared');
    equal(world.$('searchResults').hidden, true, 'dropdown hidden');
    equal(world.sandbox.location.hash, '#bgImageLight', 'hashtag anchors the exact row');
    const row = world.$('bgImageLight').closest('.row, label.row');
    assert(row.classList.contains('search-flash'), 'the whole row breathes');
    assert(row._scrollIntoView, 'row scrolled into view');
    assert(!world.$('bgImageLight').closest('.page').hidden, 'skin page shown (row migrated)');
});

test('focusSetting anchors rows and whole cards; unknown ids return false', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    // 行级：quickPairA（键盘 tile 深链的锚）→ 所在行整行呼吸。
    equal(world.FeelimeSettings().focusSetting('quickPairA'), true, 'row anchor resolves');
    const pairRow = world.$('quickPairA').closest('.row, label.row');
    assert(pairRow.classList.contains('search-flash'), 'whole row breathes');
    assert(pairRow._scrollIntoView, 'row scrolled into view');
    equal(world.sandbox.location.hash, '#quickPairA', 'hashtag updated');
    // 卡级：customTitle（定制键盘 tile 的锚）→ 整卡呼吸。
    equal(world.FeelimeSettings().focusSetting('customTitle'), true, 'card anchor resolves');
    const card = world.$('customTitle').closest('section.card');
    assert(card.classList.contains('search-flash'), 'whole card breathes');
    assert(!world.$('customTitle').closest('.page').hidden, 'input page shown for the card');
    // 未知锚点不炸，返回 false（Kotlin 侧轮询重试依赖此契约）。
    equal(world.FeelimeSettings().focusSetting('nope'), false, 'unknown anchor returns false');
    // 呼吸类到点清理（定时器挂起队列手动冲洗）。
    world.timers.splice(0).forEach(fn => fn());
    assert(!pairRow.classList.contains('search-flash'), 'breathe class clears after the timer');
});

// --------------------------------------------------- 1.2.1 批次（排序/英文词/音效）

// fake DOM 没有 Event 构造器/dispatchEvent：直调元素上挂的 listener，
// handler 抛错会直接浮出到测试断言（比 click() 的静默吞错更可诊断）。
const fire = (el, type) => {
    const handlers = (el.listeners || []).filter(l => l.type === type);
    assert(handlers.length > 0, `element has a ${type} listener`);
    handlers.forEach(l => l.handler({ target: el, type }));
};

// 排序真相源（评审 P1 修正）：行序 = feelime_mode_order（键盘长按菜单/
// 快捷设置拖拽共用），勾选只是集合。拖动把手保存全序作第 3 参
// （验收二轮：箭头按钮已移除，拖动是唯一排序方式；落点按指针 y 直接
// 映射目标位，不逐格步进）。
test('keyboard rows render in modeOrder and drag reorder saves the full order', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, keyboards: {
        menuModes: JSON.stringify(['direct', 'pinyin', 'double-pinyin', 't9', 'stroke']),
        quickPair: JSON.stringify(['pinyin', 'direct']),
        modeOrder: JSON.stringify(['t9', 'pinyin', 'direct', 'double-pinyin', 'stroke']),
    } });
    const ids = () => [...world.doc.querySelectorAll('#kbModeList input[data-kb-mode]')]
        .map(b => b.dataset.kbMode);
    equal(ids(), ['t9', 'pinyin', 'direct', 'double-pinyin', 'stroke', 'flypy', 'handwriting', 'french', 'russian', 'japanese'],
        'rows follow modeOrder, unlisted modes appended in catalog order');
    assert(!world.doc.querySelector('.kb-move'), 'arrow buttons are gone (drag is the only reorder)');
    // 把 handwriting（flypy 入 catalog 后是第 7 行）拖到指针越过前 2 行
    // 中心的位置：落点直接映射（跨多格），全序落盘作第 3 参。
    const rows = [...world.doc.querySelectorAll('#kbModeList .row')];
    const handle = rows[6].querySelector('.kb-drag');
    assert(handle, 'drag handle rendered');
    // jsdom 不做 layout：给每行打桩等高 44px 依次排布（y=100 起）。
    rows.forEach((r, i) => {
        r.getBoundingClientRect = () => ({ x: 0, y: 100 + i * 44, top: 100 + i * 44, height: 40, width: 300, bottom: 140 + i * 44, left: 0, right: 300 });
    });
    // jsdom 无 PointerEvent 构造：直接合成裸事件对象走监听器（settings 的
    // handler 只读 pointerId/clientY/button/pointerType 字段）。
    // fake DOM 无 dispatchEvent：直调元素上的 listener（fire 的内联版，
    // 需要带 pointerId/clientY 的自定义事件对象）。pointerdown 挂在
    // handle；move/up 监听被 beginKbRowDrag 挂到 host（列表容器）。
    const mkEv = (y) => ({ pointerId: 7, clientX: 10, clientY: y, pointerType: 'touch', button: 0, preventDefault: () => {}, type: '' });
    const emit = (el, type, ev) => {
        const handlers = (el.listeners || []).filter(l => l.type === type);
        assert(handlers.length > 0, `${type} listener present`);
        handlers.forEach(l => l.handler(ev));
    };
    const host = rows[6].parentElement;
    // 行6中心 y=384，上拖到 142：落在行1（pinyin，中心 164）之前——
    // handwriting 跨 4 格直接落到第 2 位。
    emit(handle, 'pointerdown', mkEv(384));
    emit(host, 'pointermove', mkEv(142));
    emit(host, 'pointerup', mkEv(142));
    const call = world.lastCall('saveKeyboardSelection');
    equal(JSON.parse(call.args[2]), ['t9', 'handwriting', 'pinyin', 'direct', 'double-pinyin', 'stroke', 'flypy', 'french', 'russian', 'japanese'],
        'drag persists the full row order as the 3rd arg (feelime_mode_order)');
    // 勾选集仍按行序收集 checked（menuModes 只是集合，序无关紧要）。
    equal(JSON.parse(call.args[0]).slice().sort(), ['direct', 'double-pinyin', 'pinyin', 'stroke', 't9'],
        'checked set follows rows');
    // 实参顺序契约：call() 把 token 追加在末尾，第 3 参必须是 order——
    // Kotlin 签名 token 若排第 3 位会静默拒绝（真机验收 2026-09-26 问题 A）。
    equal(typeof call.args[3], 'string', 'token rides last after the order json');
    equal(JSON.parse(call.args[2]).length, 10, 'arg #3 parses as the order array');
    // 保存失败要可见：keyboardsError 事件落到同一 note（覆盖乐观「已保存」）。
    world.FeelimeSettings().onEvent({ type: 'keyboardsError', code: 'BAD_KEYBOARD_SELECTION',
        message: '键盘选择数据格式错误' });
    assert(world.doc.getElementById('keyboardsNote').textContent.includes('键盘选择'),
        'keyboardsError surfaces on the card note');
});

test('english words toggle posts setEnglishWords with the checkbox value', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, customPhrases: { enabled: true, items: [], englishEnabled: true } });
    const box = world.$('englishWordsOn');
    assert(box.checked, 'english words default on from state');
    box.checked = false;
    fire(box, 'change');
    equal(world.lastCall('setEnglishWords').args[0], false, 'setEnglishWords(false)');
});

test('key sound style select posts style; custom routes to the file picker', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, keySound: false, keySoundStyle: 'default', keySoundName: '' });
    const sel = world.$('keySoundStyle');
    assert(world.$('keySoundFileRow').hidden, 'file row hidden at default');
    sel.value = 'keypress';
    fire(sel, 'change');
    equal(world.lastCall('setKeySoundStyle').args[0], 'keypress', 'style change posts');
    sel.value = 'custom';
    fire(sel, 'change');
    assert(world.native.of('openKeySoundDocument').length > 0, 'choosing custom opens the picker');
});

// #31 键盘色调：swatch 行按 state 渲染选中态，点击发 setThemePreset。
test('theme preset swatches render state and post on click', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, themePreset: 'ocean' });
    const dots = [...world.doc.querySelectorAll('#themePresetSwatches .preset-swatch')];
    equal(dots.length, 6, 'six presets');
    equal(dots.find(d => d.dataset.preset === 'ocean').className.includes('active'), true,
        'current preset marked active');
    dots.find(d => d.dataset.preset === 'violet').click();
    equal(world.lastCall('setThemePreset').args[0], 'violet', 'click posts the preset id');
});

// 单手模式 select → 桥（codex R1 P1 回归防护）：#38 直达切换后设置页
// 是选侧唯一正式入口，桥方法缺失会让选择静默失效。
test('one-hand side select reaches the bridge', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const sel = world.$('oneHand');
    sel.value = '1';
    sel.listeners.find(l => l.type === 'change').handler({ target: sel });
    equal(world.lastCall('setOneHandMode').args[0], 1, 'left selection posts setOneHandMode(1)');
    sel.value = '2';
    sel.listeners.find(l => l.type === 'change').handler({ target: sel });
    equal(world.lastCall('setOneHandMode').args[0], 2, 'right selection posts setOneHandMode(2)');
});

// #39-1/#39-2：两个「桥端缺失/无监听」的开关回归防护——开关拨动必须
// 到达桥（缺失时静默失败，任何 state 回推都把勾选洗回默认）。
test('issue-39 toggles reach the bridge: preedit bold and custom-keyboard enable', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const bold = world.$('preeditBold');
    bold.checked = true;
    bold.listeners.find(l => l.type === 'change').handler({ target: bold });
    equal(world.lastCall('setPreeditBold').args[0], true, 'bold toggle posts setPreeditBold(true)');
    const custom = world.$('customEnabled');
    custom.checked = false;
    custom.listeners.find(l => l.type === 'change').handler({ target: custom });
    equal(world.lastCall('setCustomEnabled').args[0], false,
        'custom-enable toggle posts setCustomEnabled immediately (not only via save)');
});

// 键面色调同款取色（用户验收五轮）：跟随档 + 六预置；未自定义时跟随
// 选中，点预置=setKeyHue(预置 hue)，点跟随=setKeyHue(-1) 还原继承。
test('keycap hue swatches: follow default, presets post hue, follow posts -1', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, keyHue: -1 });
    const dots = [...world.doc.querySelectorAll('#keyHueSwatches .preset-swatch')];
    equal(dots.length, 7, 'follow + six presets');
    const follow = dots[0];
    equal(follow.className.includes('active'), true, 'follow active when unset');
    equal(dots.filter(d => d !== follow && d.className.includes('active')).length, 0,
        'no preset active when unset');
    // 自定义=某预置 hue 时该预置选中、跟随让位。
    world.push({ ...BASE_STATE, keyHue: 212 });
    const dots2 = [...world.doc.querySelectorAll('#keyHueSwatches .preset-swatch')];
    equal(dots2[0].className.includes('active'), false, 'follow inactive when custom');
    const oceanIdx = dots2.findIndex(d => d.getAttribute('aria-label') === '海蓝');
    equal(dots2[oceanIdx].className.includes('active'), true, 'matching preset active');
    // 点选与还原：预置档下发预置 hue，跟随档双复位（hue+sat 都回 -1）。
    dots2[oceanIdx].click();
    equal(world.lastCall('setKeyHue').args[0], 212, 'preset click posts its hue');
    world.$('keyHueSwatches').querySelectorAll('.preset-swatch')[0].click();
    equal(world.lastCall('setKeyHue').args[0], -1, 'follow click posts hue -1');
    equal(world.lastCall('setKeySat').args[0], -1, 'follow click also resets saturation');
});

// 皮肤页行序（用户验收五轮定稿）：色调两组在前、背景图居中、预览收尾。
test('skin page row order: tints, saturations, opacity, backgrounds, preview last', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const ids = [...world.doc.querySelectorAll('[data-page="skin"] .row')]
        .map(r => r.querySelector('select[id], input[id], span[id]')?.id)
        .filter(Boolean);
    equal(ids, ['themeHue', 'themeSat', 'keyHue', 'keySat', 'keyOpacity',
        'bgImageLight', 'bgImageDark', 'themePreview'], 'rows follow the agreed order');
});

// 皮肤入口（用户验收五轮）：与其他入口同款 .entry 行（label+chevron），
// 不再是无样式 entry-card。
test('skin entry is a standard entry row with chevron', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    const entry = world.doc.querySelector('button[data-target="skin"]');
    assert(entry, 'skin entry button exists');
    assert(entry.className.split(' ').includes('entry'), 'uses the standard .entry class');
    assert(entry.querySelector('.entry-label small'), 'subtitle present');
    assert(entry.querySelector('.entry-chevron'), 'chevron present');
    assert(!world.doc.querySelector('.entry-card'), 'legacy entry-card gone');
});

// 效果预览（用户验收五轮）：亮/暗双板、每板两行键；不透明度与背景图
// base64 经 --pv-key-alpha / --pv-bg-img-* 进预览。
test('preview duo boards render and carry opacity + background image vars', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, keyOpacity: 60,
        bgImageLightSource: 'builtin', bgImageLight: 'QUJD',
        bgImageDarkSource: 'none' });
    const pv = world.$('themePreview');
    const boards = [...pv.querySelectorAll('.tp-board')];
    equal(boards.length, 2, 'light and dark boards');
    boards.forEach(board => {
        equal(board.querySelectorAll('.tp-row').length, 2, 'two key rows per board');
        equal(board.querySelectorAll('.tp-key').length, 8, 'eight keycaps per board');
    });
    equal(pv.style.getPropertyValue('--pv-key-alpha'), '0.6', 'key opacity feeds the preview');
    equal(pv.style.getPropertyValue('--pv-bg-img-light'),
        'url(data:image/jpeg;base64,QUJD)', 'light background image rides into the preview');
    equal(pv.style.getPropertyValue('--pv-bg-img-dark'), 'none', 'dark board stays imageless');
    // 不透明度拖动实时更新预览（不落盘，松手才提交）。
    const slider = world.$('keyOpacity');
    slider.value = '40';
    slider.listeners.find(l => l.type === 'input').handler({ target: slider });
    equal(pv.style.getPropertyValue('--pv-key-alpha'), '0.4', 'opacity drag updates the preview live');
});

test('dictionary operation progress stays in its own card after reopening', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: true,
        operation: 'base', stage: 'COPYING', flypy: { installed: true, name: 'shape.dict.yaml' } } });
    equal(world.$('dictBaseBuilding').hidden, false, 'base progress visible');
    equal(world.$('flypyBuilding').hidden, true, 'shape does not pretend to read');
    equal(world.$('btnFlypyPick').disabled, true, 'global operation remains exclusive');
    world.FeelimeSettings().onEvent({ type: 'dictBaseProgress', operation: 'base',
        stage: 'ACTIVATING', elapsedMs: 500 });
    assert(world.$('dictBaseBuilding').textContent.includes('正在切换词库'), 'cache switch says switching');
    assert(!world.$('dictBaseBuilding').textContent.includes('已编译'), 'cache switch does not pretend to compile');
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: true,
        operation: 'flypy', stage: 'COPYING' } });
    equal(world.$('dictBaseBuilding').hidden, true, 'base does not pretend to compile shape');
    equal(world.$('flypyBuilding').hidden, false, 'shape progress restored from state');
    world.FeelimeSettings().onEvent({ type: 'dictBaseProgress', operation: 'flypy',
        stage: 'COMPILING', elapsedMs: 12000 });
    equal(world.$('dictBaseBuilding').hidden, true, 'shape event stays out of base');
    assert(world.$('flypyBuilding').textContent.includes('12'), 'shape gets elapsed time');
});

// ---------------------------------------------------------------- runner

const failed = RESULTS.filter(([, ok]) => !ok);

test('showPage restores each page scroll offset (issue #51)', () => {
    const world = new SettingsWorld();
    const S = world.FeelimeSettings();
    // 模拟滚动：window.scrollY 由测试直接拨动（fake scroller 无布局）。
    const win = world.sandbox.window;
    S.showPage('input');
    win.scrollY = 640;
    S.showPage('home');
    equal(world.lastScrollTo, [0, 0], 'fresh home starts at top');
    S.showPage('input');
    equal(world.lastScrollTo, [0, 640], 'returning to input restores 640');
    // 新访问过的页从顶部开始：voice 从未记过滚动。
    win.scrollY = 0;
    S.showPage('voice');
    equal(world.lastScrollTo, [0, 0], 'unvisited page starts at top');
});

test('location hash routes to the anchor on load and on change (issue #51)', () => {
    const world = new SettingsWorld();
    const win = world.sandbox.window;
    // 启动消费：hash 已在（外部 deeplink / tile 深链复用同一锚语义）。
    // applyLocationHash 在脚本顶层已跑过一次（hash 为空 → no-op），
    // 这里直接改写再手动派发，覆盖 hashchange 路径。
    win.location.hash = '#keySound';
    assert(world.winListeners && typeof world.winListeners.hashchange === 'function',
        'hashchange listener registered');
    world.winListeners.hashchange();
    assert(world.lastCall('reportPage').args[0] === 'input',
        'anchor routes to its page first');
    equal(win.location.hash, '#keySound', 'focusSetting keeps the anchor');
    // focusSetting 自己写回的 hash 不回环（lastAppliedHash 挡板）。
    const reports = world.native.calls.filter(c => c.name === 'reportPage').length;
    world.winListeners.hashchange();
    equal(world.native.calls.filter(c => c.name === 'reportPage').length, reports,
        'self-written hash does not re-run');
});

test('custom key setting mode round-trips [setting:id] (issue #51)', () => {
    const world = new SettingsWorld();
    const S = world.FeelimeSettings();
    // 表单值 → DSL。
    let draft = { mode: 'setting', setting: 'keySound', t: '声音' };
    equal(S.ckTapFromDraft(draft), '[setting:keySound]', 'draft builds the setting token');
    // DSL → 表单（编辑回填）。
    const parsed = S.ckTapParse('[setting:candidateFont]');
    equal(parsed.mode, 'setting', 'parse recognizes the token');
    equal(parsed.setting, 'candidateFont', 'anchor id kept');
});

console.log(`\n== settings mock-bridge suite: ${RESULTS.length - failed.length}/${RESULTS.length} passed ==`);
if (failed.length) {
    console.log('failures: ' + failed.map(([name]) => name).join(' | '));
    process.exit(1);
}
