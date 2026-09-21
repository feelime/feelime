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
    saveCustomPhrases(...a) { this._rec('saveCustomPhrases', a); }
    setDiagnostics(...a) { this._rec('setDiagnostics', a); }
    exportDiagnostics(...a) { this._rec('exportDiagnostics', a); }
    setOneHandPad(...a) { this._rec('setOneHandPad', a); }
    setKeySound(...a) { this._rec('setKeySound', a); }
    setKeyHaptic(...a) { this._rec('setKeyHaptic', a); }
    // /R8: page reporting (BACK returns home first) + about-page
    // one-tap copy.
    reportPage(...a) { this._rec('reportPage', a); }
    setThemeMode(...a) { this._rec('setThemeMode', a); }
    setKeyOpacity(...a) { this._rec('setKeyOpacity', a); }
    setKbHeight(...a) { this._rec('setKbHeight', a); }
    previewKeyboard(...a) { this._rec('previewKeyboard', a); }
    setBgImage(...a) { this._rec('setBgImage', a); }
    clearBgImage(...a) { this._rec('clearBgImage', a); }
    setBuiltinBgImage(...a) { this._rec('setBuiltinBgImage', a); }
    copyText(...a) { this._rec('copyText', a); }
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
        };
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
    const hero = world.$('heroStatus').textContent;
    assert(hero.includes('未设为默认'), 'default status');
    assert(!hero.includes('3.26.0') && !hero.includes('0.17.6'), 'versions moved to about');
    world.push({ ...BASE_STATE, ime: { enabled: true, isDefault: true } });
    assert(world.$('heroStatus').textContent.includes('默认输入法在线'), 'default hero');
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

test('navigation: home starts as the only visible page; showPage swaps and reports', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    world.native.calls.length = 0;

    const hiddenMap = () => Object.fromEntries(
        [...world.doc.querySelectorAll('[data-page]')].map(p => [p.dataset.page, p.hidden]));
    equal(hiddenMap(), {
        home: false, appearance: true, input: true, dict: true, phrases: true, voice: true, update: true,
        backup: true, about: true, licenses: true, test: true,
    }, 'initial: home visible, sub-pages hidden');

    world.FeelimeSettings().showPage('voice');
    equal(hiddenMap(), {
        home: true, appearance: true, input: true, dict: true, phrases: true, voice: false, update: true,
        backup: true, about: true, licenses: true, test: true,
    }, 'voice page visible, everything else hidden');
    equal(world.lastCall('reportPage').args, ['voice', world.token], 'reportPage(page name) on sub-page');

    world.FeelimeSettings().showPage('home');
    equal(hiddenMap().home, false, 'home visible again');
    equal(world.lastCall('reportPage').args, ['home', world.token], 'reportPage(home) on home');

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
    equal(world.lastCall('reportPage').args, ['input', world.token], 'entry click reports the page name');

    const back = world.doc.querySelector('[data-page="input"] [data-back]');
    back.click();
    equal(world.doc.querySelector('[data-page="home"]').hidden, false, 'back returns home');
    equal(world.doc.querySelector('[data-page="input"]').hidden, true, 'input page hidden');
    equal(world.lastCall('reportPage').args, ['home', world.token], 'back reports home');
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
    world.push({ ...BASE_STATE });
    const rows = [...world.$('aboutRows').querySelectorAll('.row')]
        .map(r => r.textContent);
    assert(rows.some(t => t.includes('App 版本') && t.includes('0.17.6')), `app row: ${rows}`);
    assert(rows.some(t => t.includes('当前') && t.includes('3.20.0')), `active kb row: ${rows}`);
    assert(rows.some(t => t.includes('内置') && t.includes('3.21.0')), `built-in kb row: ${rows}`);
    assert(rows.some(t => t.includes('手机型号') && t.includes('Google Pixel 8')), `model row: ${rows}`);
    assert(rows.some(t => t.includes('系统版本') && t.includes('Android 15') && t.includes('35')),
        `os row: ${rows}`);

    world.$('btnCopyAbout').click();
    const [text, token] = world.lastCall('copyText').args;
    equal(token, world.token, 'copyText token');
    const lines = text.split('\n');
    equal(lines.length, 5, 'copy block is one line per version row');
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

test('custom phrases: empty list shows the hint; third-level page routes back to input', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, customPhrases: { enabled: false, items: [] } });
    equal(world.$('phraseEmpty').hidden, false, 'empty hint visible');
    equal(world.$('phrasesOn').checked, false, 'toggle off from state');

    // 三级页：back 回 input，不回 home。
    world.FeelimeSettings().showPage('input');
    world.FeelimeSettings().showPage('phrases');
    equal(world.doc.querySelector('[data-page="phrases"]').hidden, false, 'phrases page open');
    world.doc.querySelector('[data-page="phrases"] [data-back]').click();
    equal(world.doc.querySelector('[data-page="input"]').hidden, false, 'back lands on input');
    equal(world.doc.querySelector('[data-page="phrases"]').hidden, true, 'phrases closed');
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

test('feel card renders state values and commits each control with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, bottomPadPortrait: 24, bottomPadLandscape: 12, holdMs: 450, scrubSpeed: 2, popupSnap: 2, candidateFont: 2 });
    equal(world.$('bottomPadPortrait').value, '24', 'portrait pad from state');
    equal(world.$('bottomPadLandscape').value, '12', 'landscape pad from state');
    equal(world.$('holdMs').value, '450', 'hold ms from state');
    equal(world.$('scrubSpeed').value, '2', 'scrub speed from state');
    equal(world.$('popupSnap').value, '2', 'popup snap from state');
    equal(world.$('candidateFont').value, '2', 'candidate font from state');

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
    equal(world.lastCall('setCandidateFont').args, [2, world.token], 'candidate font + token');
});

// ------------------------------------------------- handwriting card (issue #28 round-2)

test('handwriting card reflects the ink delay tier and commits it with the token', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE, inkDelay: 0 });
    equal(world.$('inkDelay').value, '0', 'fast tier from state');
    const fire = () => {
        const select = world.$('inkDelay');
        const change = select.listeners.find(listener => listener.type === 'change');
        assert(change, '#inkDelay has a change listener');
        change.handler({ target: select });
    };
    fire();
    equal(world.lastCall('setInkDelay').args, [0, world.token], 'ink delay + token');
    world.push({ ...BASE_STATE, inkDelay: 2 });
    equal(world.$('inkDelay').value, '2', 'slow tier from state');
});

test('handwriting card defaults to the live tier and ignores off-whitelist values', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('inkDelay').value, '3', 'default live (per-stroke)');
    world.push({ ...BASE_STATE, inkDelay: 7 });
    equal(world.$('inkDelay').value, '3', 'off-whitelist tier ignored');
});

test('feel card defaults when state omits the values and never adopts off-whitelist ones', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    equal(world.$('bottomPadPortrait').value, '0', 'portrait pad default 0');
    equal(world.$('bottomPadLandscape').value, '0', 'landscape pad default 0');
    equal(world.$('holdMs').value, '350', 'hold default 350');
    equal(world.$('scrubSpeed').value, '3', 'scrub default 3x');
    equal(world.$('popupSnap').value, '1', 'snap default standard');
    equal(world.$('candidateFont').value, '0', 'candidate font default 100%');
    // Native validates too, but the page must not blindly mirror junk.
    world.push({ ...BASE_STATE, bottomPadPortrait: 7, bottomPadLandscape: 9, holdMs: 1234, scrubSpeed: 99, popupSnap: 9, candidateFont: 5 });
    equal(world.$('bottomPadPortrait').value, '0', 'off-list portrait pad ignored');
    equal(world.$('bottomPadLandscape').value, '0', 'off-list landscape pad ignored');
    equal(world.$('holdMs').value, '350', 'off-list hold ignored');
    equal(world.$('scrubSpeed').value, '3', 'off-list scrub ignored');
    equal(world.$('popupSnap').value, '1', 'off-list snap ignored');
    equal(world.$('candidateFont').value, '0', 'off-list candidate font ignored');
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

test('base dictionary card renders builtin/custom/building and wires the actions (issue #23)', () => {
    const world = new SettingsWorld();
    world.push({ ...BASE_STATE });
    // builtin 态：内置文案 + 恢复按钮隐藏 + 换装可点。
    assert(world.$('dictBaseCurrent').textContent.includes('rime-frost'),
        'builtin shows the built-in lexicon');
    equal(world.$('btnBaseDictRevert').hidden, true, 'revert hidden on builtin');
    equal(world.$('btnBaseDictPick').disabled, false, 'pick enabled on builtin');
    equal(world.$('dictBaseBuilding').hidden, true, 'building hint hidden');

    // custom 态：文件名 + 恢复按钮出现。
    world.push({ ...BASE_STATE, baseDict: { mode: 'custom', building: false,
        name: 'rime-ice.base.dict.yaml', installedAt: 1758300000000 } });
    assert(world.$('dictBaseCurrent').textContent.includes('rime-ice.base.dict.yaml'),
        'custom shows the imported name');
    equal(world.$('btnBaseDictRevert').hidden, false, 'revert visible on custom');

    // building 态：提示行显示 + 两个按钮都不可用。
    world.push({ ...BASE_STATE, baseDict: { mode: 'builtin', building: true } });
    equal(world.$('dictBaseBuilding').hidden, false, 'building hint visible');
    equal(world.$('btnBaseDictPick').disabled, true, 'pick disabled while building');
    equal(world.$('btnBaseDictRevert').hidden, true, 'revert hidden while building');

    // 事件：进度文案（阶段 + 已耗时）与完成收尾。
    world.FeelimeSettings().onEvent({ type: 'dictBaseProgress', stage: 'COMPILING',
        elapsedMs: 32000 });
    assert(world.$('dictBaseBuilding').textContent.includes('32'),
        'elapsed seconds surface in the hint');
    world.FeelimeSettings().onEvent({ type: 'dictBaseDone',
        message: '基底词库换装完成' });
    equal(world.$('dictBaseBuilding').hidden, true, 'done collapses the hint');
    equal(world.$('dictBaseNote').textContent, '基底词库换装完成', 'note carries the message');

    // 按钮接线（带 token）。
    world.$('btnBaseDictPick').click();
    equal(world.lastCall('openBaseDictDocument').args, [world.token], 'pick opens the SAF picker');
    world.push({ ...BASE_STATE, baseDict: { mode: 'custom', building: false, name: 'x' } });
    world.$('btnBaseDictRevert').click();
    equal(world.lastCall('clearBaseDict').args, [world.token], 'revert clears the base dict');
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

// ---------------------------------------------------------------- runner

const failed = RESULTS.filter(([, ok]) => !ok);
console.log(`\n== settings mock-bridge suite: ${RESULTS.length - failed.length}/${RESULTS.length} passed ==`);
if (failed.length) {
    console.log('failures: ' + failed.map(([name]) => name).join(' | '));
    process.exit(1);
}
