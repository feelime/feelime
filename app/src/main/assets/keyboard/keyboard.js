/*
 * Feelime HTML keyboard: config-rendered rows, flick characters, long-press
 * popup, symbol recents. Native access goes through the FeelimeNative bridge
 * (token-gated, design §5.3) with engine candidates, input modes and the
 * recording-only voice overlay.
 */
(() => {
    'use strict';

    // Interface language is independent of the active input engine.
    let uiLocale = 'zh';
    try {
        uiLocale = localStorage.getItem('feelime_ui_locale') ||
            (typeof navigator === 'undefined' || /^zh/i.test(navigator.language) ? 'zh' : 'en');
    } catch (_) {}
    // Active double-pinyin scheme (ziranma/flypy/sogou) - native owns the
    // choice (feelime_engine.dp_scheme) and pushes it in every hello;
    // until then everything uses the default 自然码.
    let dpScheme = 'ziranma';
    const UI_EN = {
        "英文 Direct": "English",
        "全拼 Pinyin": "Pinyin",
        "双拼": "Double Pinyin",
        "笔画 Stroke": "Stroke",
        "重输": "Restart",
        "该键盘还在准备中": "That keyboard is still preparing",
        "通配符只能用一个": "Only one wildcard at a time",
        "日本語 Romaji": "Japanese",
        "常用": "Common",
        "定制": "Custom",
        "最近": "Recent",
        "引号": "Quotes",
        "货币": "Currency",
        "数学": "Math",
        "序号": "Numbers",
        "拼音": "Pinyin",
        "平假名": "Hiragana",
        "片假名": "Katakana",
        "希腊": "Greek",
        "分词": "Split",
        "切换键盘": "Switch keyboard",
        "确定": "Confirm",
        "换行": "Enter",
        "空格": "Space",
        "符号": "Sym",
        "返回主键盘": "Back to keyboard",
        "表情": "Symbols",
        "笑脸": "Smileys",
        "手势": "Gestures",
        "动物": "Animals",
        "食物": "Food",
        "活动": "Activity",
        "物品": "Objects",
        "出现空的 [] 记号": "Empty [] key token",
        "「{0}」无法解析": "Cannot parse “{0}”",
        "「{0}」缺少键名": "“{0}” is missing a key name",
        "「{0}」的键名不可用": "Unsupported key in “{0}”",
        "按键步骤超过 {0} 个": "More than {0} key steps",
        "JSON 解析失败：": "Invalid JSON: ",
        "顶层必须是 JSON 对象（{\"version\":1,\"rows\":[...]}）": "Use a JSON object: {\"version\":1,\"rows\":[...]}",
        "version 必须是 1": "version must be 1",
        "rows 必须是数组": "rows must be an array",
        "最多 {0} 行（收到 {1} 行）": "Up to {0} rows allowed; received {1}",
        "第 {0} 行必须是数组": "Row {0} must be an array",
        "第 {0} 行第 {1} 个键": "Row {0}, key {1}",
        "{0} 必须是对象（{t, tap, note}）": "{0} must be an object: {t, tap, note}",
        "{0} 缺少 t（键面）": "{0} is missing t (key label)",
        "「{0}」的 t 超过 {1} 字": "The label for “{0}” exceeds {1} characters",
        "「{0}」的 note 超过 {1} 字": "The note for “{0}” exceeds {1} characters",
        "{0}（「{1}」）缺少 tap（单击行为）": "{0} (“{1}”) is missing tap (key action)",
        "「{0}」的 tap 超过 {1} 字符": "The action for “{0}” exceeds {1} characters",
        "「{0}」的 tap {1}": "Action for “{0}”: {1}",
        "键总数超过 {0}": "More than {0} keys",
        "至少要定义一个键": "Add at least one key",
        "按键无效：{0}": "Invalid key: {0}",
        "横屏已达屏幕上限": "Maximum landscape height",
        "拖动为预览，松手应用": "Drag to preview; release to apply",
        "键盘高度已保存": "Keyboard height saved",
        "恢复默认": "Reset",
        "已恢复默认高度": "Default height restored",
        "输入法快捷切换": "Quick switch",
        "长按菜单": "Keyboard menu",
        "定制键盘": "Custom keys",
        "返回设置首页": "Back to quick settings",
        "收起设置": "Close quick settings",
        "色彩模式": "Appearance",
        "跟随系统": "System",
        "浅色": "Light",
        "深色": "Dark",
        "滑动跟手": "Cursor speed",
        "光标移动速度": "Cursor speed",
        "快捷切换": "Quick switch",
        "编辑工具栏": "Edit toolbar",
        "正在准备语言数据…": "Preparing language data…",
        "「{0}」引擎启动失败，暂时英文直出；点模式键重试": "{0} failed to start; English Direct is serving. Tap the mode key to retry",
        "「{0}」暂以英文直出，点模式键重试": "{0} is temporarily serving as English Direct; tap the mode key to retry",
        "{0} 个键盘": "{0} keyboards",
        "键盘高度": "Keyboard height",
        "调节 ›": "Adjust ›",
        // 快捷设置方块（tile 网格）新增文案。
        "中文联想": "Associations",
        "按键声音": "Key sound",
        "按键振动": "Key vibration",
        "单手模式": "One-handed",
        "左手": "Left hand",
        "右手": "Right hand",
        "全选": "Select all",
        "粘贴": "Paste",
        "复制": "Copy",
        "剪切": "Cut",
        "光标左移": "Move cursor left",
        "光标右移": "Move cursor right",
        "光标上移": "Move cursor up",
        "光标下移": "Move cursor down",
        "候选字号": "Candidate size",
        "界面语言": "Language",
        "底部留白": "Bottom padding",
        "长按时长": "Long-press delay",
        "滑动选字": "Swipe reach",
        "双拼方案": "Double-pinyin",
        "调节": "Adjust",
        "开": "On",
        "关": "Off",
        "标准": "Standard",
        "大": "Large",
        "更大": "Larger",
        "松": "Loose",
        "紧": "Tight",
        "中文": "Chinese",
        "自然码": "Ziranma",
        "小鹤双拼": "Flypy",
        "搜狗 / 微软双拼": "Sogou / MSPY",
        "紫光双拼": "Ziguang",
        "松手撤销": "Release to cancel",
        "粘贴 JSON 定义符号键盘（最多 3 行，每行键数不限）：t=键面，": "Paste JSON to define up to 3 key rows: t=label, ",
        "tap=单击行为（文本 / [esc] 单键 / [ctrl+s] 组合，可混排，如 [esc]ggVGD），": "tap=action (text, [esc], or [ctrl+s]; combine them, e.g. [esc]ggVGD), ",
        "note=长按说明。超宽的行可以左右拖动查看。": "note=long-press description. Swipe wide rows to see more keys.",
        "当前状态": "Status",
        "已定制 {0} 个键": "{0} custom keys",
        "未定制": "No custom keys",
        "粘贴 JSON ›": "Paste JSON ›",
        "粘贴 JSON 定制键盘": "Paste custom keyboard JSON",
        "插入模板 ›": "Use example ›",
        "插入定制模板": "Use custom keyboard example",
        "粘贴定制 JSON": "Paste custom keyboard JSON",
        "保存失败：本地存储不可用": "Could not save. Local storage is unavailable.",
        "已保存 {0} 个键": "Saved {0} keys",
        "勾选两项作为切换键的快捷切换对（点已勾选项无效果，点未勾选项会替换最早勾选的一项）": "Choose two keyboards for quick switching. A new selection replaces the oldest one.",
        "快捷切换 {0}": "Quick switch: {0}",
        "勾选长按切换键时列出的键盘 · 拖动排序（至少保留一个）": "Choose keyboards shown on long press. Drag to reorder; keep at least one.",
        "长按菜单显示 {0}": "Show {0} in keyboard menu",
        "拖动排序": "Drag to reorder",
        "暂无单字": "No single-character candidates",
        "暂无候选": "No candidates",
        "剪贴板已开启，复制的内容将在这里显示": "Copied text will appear here.",
        "暂无常用语，点右上角「＋添加」": "No saved phrases. Tap Add to create one.",
        "…（内容过长）": "… (text truncated)",
        "删除": "Delete",
        "更多操作": "More actions",
        "编辑常用语": "Edit phrase",
        "添加常用语": "Add phrase",
        "置顶": "Pin to top",
        "编辑": "Edit",
        "删除自造词": "Delete learned word",
        "该候选需升级 APK 后删除": "Update the app to delete this word.",
        "从自选词词库删除「{0}」？（固定词库的词删不掉）": "Delete “{0}” from learned words? Built-in words cannot be deleted.",
        "「{0}」来自固定词库，无法删除": "“{0}” is a built-in word and cannot be deleted.",
        "已从自选词词库删除「{0}」": "Deleted “{0}” from learned words.",
        "正在聆听…": "Listening…",
        "启动识别…": "Starting…",
        "结束识别…": "Finishing…",
        "请稍候，就绪后开口说话": "Hold on — start speaking when ready",
        "取消": "Cancel",
        "保存": "Save",
        "关闭": "Close",
        "输入常用内容（最多 200 字）": "Enter a phrase (up to 200 characters)",
        "常用语内容": "Phrase",
        "定制键盘 JSON": "Custom keyboard JSON",
        "输入常用内容": "Enter a phrase",
        "输入码": "Shortcut",
        "留空时自动生成": "Leave blank to generate",
        "例如：nh": "e.g. hello",
        "位次": "Rank",
        "位次减一": "Rank down",
        "位次加一": "Rank up",
        "减少高度": "Decrease height",
        "增加高度": "Increase height",
        "快捷设置": "Quick settings",
        "完整设置": "All settings",
        "控制键": "Control keys",
        "切换输入法": "Switch input method",
        "剪贴板": "Clipboard",
        "常用语": "Phrases",
        "语音输入": "Voice input",
        "收起键盘": "Hide keyboard",
        "取消组合": "Clear composition",
        "展开候选": "Expand candidates",
        "收起候选": "Collapse candidates",
        "词频": "Frequency",
        "单字": "Single",
        "候选区": "Candidates",
        "收起控制键": "Hide control keys",
        "关闭面板": "Close panel",
        "清空剪贴板": "Clear clipboard",
        "清空": "Clear",
        "＋添加": "＋ Add",
        "松手结束": "Release to finish.",
        "点击任意位置结束": "Tap anywhere to finish.",
        "取消语音输入": "Cancel voice input",
        "撤销本次听写": "Discard this dictation",
        "撤销": "Discard",
        "已撤销本次听写": "Dictation discarded",
        "说完了，结束并上屏": "Done — finish and insert",
        "说完了": "Done",
        "松手上屏": "Release to insert",
        "上滑撤销": "Slide up to discard",
        "当前版本不支持取消语音输入，请更新 APK": "Update the app to enable voice cancellation.",
        "关闭组合键浮层": "Close shortcut menu",
        "Meta 键": "Meta key",
        "输入": "Input",
        "返回": "Back",
        "删除组合": "Clear composition",
        "上屏原文": "Commit typed text",
        "展开候选词": "Expand candidates",
        "收起候选词": "Collapse candidates",
        "打开完整设置": "Open all settings",
        "Fn 粘滞键": "Sticky Fn",
        "开始语音输入": "Start voice input",
        "清除输入": "Clear composition",
        "键盘设置": "Quick settings"
};
    function t(source, ...values) {
        const pattern = uiLocale === 'en' ? (UI_EN[source] || source) : source;
        return pattern.replace(/\{(\d+)\}/g, (match, index) =>
            values[index] === undefined ? match : String(values[index]));
    }
    function translateStaticUi() {
        document.documentElement.lang = uiLocale === 'en' ? 'en' : 'zh-CN';
        document.querySelectorAll('[data-i18n]').forEach(node => {
            node.textContent = t(node.getAttribute('data-i18n'));
        });
        ['aria-label', 'placeholder'].forEach(attribute => {
            document.querySelectorAll('[data-i18n-' + attribute + ']').forEach(node => {
                node.setAttribute(attribute, t(node.getAttribute('data-i18n-' + attribute)));
            });
        });
    }

    const KEYBOARD_VERSION = '3.50.0';

    /** 纯符号词条判定（issue #17）：每个字符既不是字母（含汉字）也不是
     *  数字——↑✓★🐱♂ 这类 custom_phrase 符号词。用于渲染层把它们重排
     *  到候选第 3 格；含汉字/字母的词（正常词条）不在此列。 */
    function isSymbolicText(text) {
        if (!text) return false;
        return [...String(text)].every(ch => !/\p{L}/u.test(ch) && !/\p{N}/u.test(ch));
    }
/** 工具栏可编辑 icon 目录（issue #15 编辑模式）：id → 按钮 DOM id。
 *  logo（左）与收起（右）固定不可编辑；组合态工具（清除/展开）与
 *  完整设置齿轮不参与编辑。 */
const TOOL_CATALOG = {
    ctrl: 'ctrlTool',
    ime: 'imeSwitchButton',
    clipboard: 'clipboardButton',
    favorites: 'favoritesButton',
    mic: 'mic',
    // 开关型工具：默认不上栏，只待在编辑仓库里由用户添加（动态创建）。
    theme: 'toolTheme',
    vibrate: 'toolVibrate',
    sound: 'toolSound',
    assoc: 'toolAssoc',
    onehand: 'toolOneHand',
};
const TOOLBAR_DEFAULT = { left: ['ctrl', 'ime'], right: ['clipboard', 'favorites', 'mic'] };
    const MIN_NATIVE_API = 1;
    const REQUIRED_CAPABILITIES = [
        'candidate-revision-v1',
        'clipboard-v1',
        'commit-text-v1',
        'compose-control-v1',
        'unicode-compose-v1',
        'cursor-repeat-v1',
        'cursor-delta-v1',
        'panel-compose-v1',
        'favorites-v2',
        'ime-control-v1',
        'key-event-v1',
        'keyboard-height-reset-v1',
        'keyboard-update-status-v1',
        'text-input-v1',
        'voice-session-v1',
        'voice-cancel-v1',
    ];
    // Over-long clipboard items cannot pass the native commitText limit, so
    // they render disabled in the panel (stored in full, paste blocked).
    const MAX_COMMIT_CODE_POINTS = 2000;
    // Cursor scrub: one caret step per 12px of drag at the default
    // 3x speed (SCRUB_UNIT_BASE_PX / scrubSpeed), counted after the fixed
    // recognition-threshold crossing. Exposes 1x..5x in the quick
    // settings panel.
    const SCRUB_UNIT_BASE_PX = 36;

    const MODES = {
        'direct': { label: 'En', title: '英文 Direct', layout: 'qwerty', engine: false },
        'pinyin': { label: '拼', title: '全拼 Pinyin', layout: 'qwerty', engine: true },
        // 键位是自然码（ei→Z / ie→X / iao→C / ou→B 是自然码特征）；旧文件名
        // ziranma_double_pinyin 是历史误名，显示一律用「双拼」。
        'double-pinyin': { label: '双', title: '双拼', layout: 'qwerty', engine: true },
        // 九宫格：键面是数字（schema 侧把音节表 xlit 成数字串），候选出词。
        't9': { label: '九', title: '九宫格 T9', layout: 't9', engine: true },
        // 笔画（issue #18）：T9 网格骨架，键面是笔画部件（点按发 h/s/p/n/z
        // 进引擎，preedit 由 schema xlit 成部件字形回显）。strictReady：旧
        // APK 的 hello 不带 stroke 就绪字段，缺失必须当不可用——沿用
        // !== false 的宽松判定会把缺键当可用，出现可点却无效的入口。
        'stroke': { label: '笔', title: '笔画 Stroke', layout: 't9', engine: true, strictReady: true },
        'french': { label: 'FR', title: 'Français', layout: 'qwerty-fr', engine: true },
        'russian': { label: 'РУ', title: 'Русский', layout: 'cyrillic', engine: true },
        'japanese': { label: '日', title: '日本語 Romaji', layout: 'qwerty', engine: true },
    };

    const LAYOUTS = {
        // 九宫格 T9：键面数字为主、字母组为角标（alts）；分隔键（分词）
        // 保留——数字切分歧义（9426 = xian / xi'an）靠它手动消歧。
        t9: {
            // 字母组角标只做键面提示，不参与上滑/弹窗上屏（见 altCandidates）。
            hintsOnly: true,
            rows: [
                '123',
                '456',
                { keys: '789', shift: true, backspace: true },
            ],
            alts: {
                '2': 'abc', '3': 'def',
                '4': 'ghi', '5': 'jkl', '6': 'mno',
                '7': 'pqrs', '8': 'tuv', '9': 'wxyz',
            },
            // 长按三行浮层的中列符号（issue #9）：每键两个，分列数字
            // 左右；键面左上角小字展示同一组，长按能出什么不用猜。
            keySymbols: {
                '2': ['—', '&'], '3': ['（', '）'], '4': ['「', '」'], '5': ['、', '：'],
                '6': ['；', '～'], '7': ['《', '》'], '8': ['…', '·'], '9': ['%', '/'],
            },
        },
        qwerty: {
            rows: [
                'qwertyuiop',
                { keys: 'asdfghjkl', indent: true },
                { keys: 'zxcvbnm', shift: true, backspace: true },
            ],
            alts: {
                q: '1', w: '2', e: '3', r: '4', t: '5',
                y: '6', u: '7', i: '8', o: '9', p: '0',
                // J/k carried fullwidth “ ” on the ENGLISH
                // keyboard - the half-width ~ " ' are what English expects
                // (French keeps its own accented set in qwerty-fr).
                a: '-', s: '/', d: ':', f: ';', g: '(', h: ')', j: '~', k: '"', l: "'",
                z: '@', x: '_', c: '#', v: '&', b: '?', n: '!', m: '…', '.': ',',
            },
        },
        // French uses standard QWERTY (no AZERTY); accent candidates
        // follow the design section 6.2 fixture exactly.
        // French long-press set: a gains ä and o gains ö -
        // the collection was incomplete, not just the candidate flow.
        'qwerty-fr': {
            rows: [
                'qwertyuiop',
                { keys: 'asdfghjkl', indent: true },
                { keys: 'zxcvbnm', shift: true, backspace: true },
            ],
            alts: {
                q: '1', w: '2', e: ['3', 'é', 'è', 'ê', 'ë'], r: '4', t: '5',
                y: ['6', 'ÿ'], u: ['7', 'ù', 'û', 'ü'], i: ['8', 'î', 'ï'], o: ['9', 'ô', 'ö', 'œ'], p: '0',
                a: ['-', 'à', 'â', 'ä', 'æ'], s: '/', d: ':', f: ';', g: '(', h: ')',
                j: ['~', '«'], k: ["'", '»'], l: ['"', '’'],
                z: '@', x: '_', c: ['#', 'ç'], v: '&', b: '?', n: '!', m: '.', '.': ',',
            },
        },
        cyrillic: {
            rows: [
                'йцукенгшщзхъ',
                { keys: 'фывапролджэ', indent: true },
                { keys: 'ячсмитьбю', shift: true, backspace: true },
            ],
            alts: {
                е: 'ё',
                а: '1', н: '2', р: '3', о: '4', л: '5',
                д: '6', ж: '7', э: '8', я: '9', ч: '0',
            },
        },
    };

    // fixed 24x24 vector icons; state changes toggle classes/colours
    // and never swap glyphs. Referenced by name from renderLetters().
    // M4: the enter key is text (换行/确定) and the globe key is replaced by
    // the Chinese/English toggle, so their glyphs were removed.
    const ICON_PATHS = {
        shift: 'M12 5l7 7h-4v6H9v-6H5z',
        caps: 'M12 3l7 7h-4v6H9v-6H5zM7 19h10v2H7z',
        backspace: 'M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.59 12.59L16 17l-2.5-2.5L11 17l-1.41-1.41L12.09 13 9.59 10.5 11 9.1l2.5 2.5L16 9.1l1.41 1.41L14.91 13z',
        mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z M19 12a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2z',
        arrowLeft: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
        smiley: 'M15.5 11c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5zM11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
        // 快捷设置方块图标（wechat 式 tile 网格）。同一构建器，键面不用。
        // 色彩模式三态三图形（fill 同色 currentColor，不换色）：
        // auto=半填充圆（自动切换）、light=太阳、dark=月牙。
        theme: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 2v14a7 7 0 010-14z',
        themeSun: 'M12 8.2a3.8 3.8 0 110 7.6 3.8 3.8 0 010-7.6zM12 1.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM12 19.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM3 10.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM21 10.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM5.6 4.1a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM18.4 4.1a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM5.6 16.9a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM18.4 16.9a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0z',
        themeMoon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
        assoc: 'M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2H10l-5 4V6a2 2 0 012-2zm2 4h10v2H7V8zm0 4h6v2H7v-2z',
        sound: 'M3 9v6h4l5 4V5L7 9H3zm11.5 3a3.5 3.5 0 00-2-3.16v6.32a3.5 3.5 0 002-3.16zM12.5 3.8v2.1a6.2 6.2 0 010 12.2v2.1a8.3 8.3 0 000-16.4z',
        vibrate: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v16h6V4H9zM3 8h2v8H3V8zm16 0h2v8h-2V8z',
        height: 'M12 2l4.5 5.5h-9L12 2zm0 20l-4.5-5.5h9L12 22zM6 11h12v2H6v-2z',
        swap: 'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
        font: 'M10 4h4l5 16h-2.6l-1.2-4H8.8l-1.2 4H5L10 4zm-.4 9.5h4.8L12 6.8 9.6 13.5z',
        lang: 'M12 2a10 10 0 100 20 10 10 0 000-20zm7.9 9h-3.4a15 15 0 00-1.2-5.7A8 8 0 0119.9 11zM12 4c.9 1.2 1.9 3.4 2.2 7H9.8c.3-3.6 1.3-5.8 2.2-7zM8.7 5.3A15 15 0 007.5 11H4.1a8 8 0 014.6-5.7zM4.1 13h3.4a15 15 0 001.2 5.7A8 8 0 014.1 13zM12 20c-.9-1.2-1.9-3.4-2.2-7h4.4c-.3 3.6-1.3 5.8-2.2 7zm3.3-1.3a15 15 0 001.2-5.7h3.4a8 8 0 01-4.6 5.7z',
        pad: 'M3 5h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v8h16V7H4zM2 19h20v2H2v-2z',
        onehand: 'M4 4h10a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v12h8V6H5zm12 3h4v2h-4V9zm0 4h4v2h-4v-2z',
        timer: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 110 14 7 7 0 010-14zm-1 2h2v5.4l4 2.4-1 1.6-5-3V7z',
        snap: 'M12 8a2 2 0 110 4 2 2 0 010-4zM2 11h5v2H2v-2zm15 0h5v2h-5v-2zM11 3h2v5h-2V3zm0 13h2v5h-2v-5z',
        menu: 'M5 4h3v3H5V4zm5.5 0h3v3h-3V4zM16 4h3v3h-3V4zM5 10.5h3v3H5v-3zm5.5 0h3v3h-3v-3zm5.5 0h3v3h-3v-3zM5 17h3v3H5v-3zm5.5 0h3v3h-3v-3zm5.5 0h3v3h-3v-3z',
        keyboard: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zm1 2v8h16V8H4zm2 1.5h2v2H6v-2zm3.5 0h2v2h-2v-2zm3.5 0h2v2h-2v-2zM6 13h8v1.5H6V13zm9.5 0H17v1.5h-1.5V13z',
        dp: 'M8 3.5L3 12l5 8.5 5-8.5-5-8.5zm8 0l-5 8.5 5 8.5 5-8.5-5-8.5z',
        gear: 'M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
    };
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {};
    for (const [name, pathData] of Object.entries(ICON_PATHS)) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', pathData);
        svg.append(path);
        ICONS[name] = svg;
    }

    // Symbol rows (English tab shows
    // the latin set with a digit first row, Chinese tab the CJK punct set).
    // Symbol categories live in SYMBOL_CATEGORIES below.
    // Symbol categories picked from a bottom strip.
    // Every category renders as a 3x10 grid; the ninth/last cell of row 3 is
    // always the backspace key, and short lists pad with blank spacers so row
    // heights stay even (fixes the old two-row stretched "recent" layout).
    // The symbol layer opens on 常用 - ASCII
    // digits on row 1 (keeps digits half-width everywhere) and
    // the daily CJK symbols on rows 2-3 in Chinese modes. Row 3 ends with
    // the delete key and row 4 carries ABC | sliding categories | enter.
    const ZH_COMMON_ROWS = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['，', '。', '、', '；', '：', '？', '！', '～', '（', '）'],
        ['“', '”', '‘', '’', '《', '》', '〈', '〉', '…'],
    ];
    const EN_COMMON_ROWS = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['-', '/', ':', ';', '(', ')', '&', '@', '+', '='],
        ['.', ',', '?', '!', '"', "'", '*', '#', '%'],
    ];
    // The 引号 table's zh side (the only quote table until the 中/En
    // toggle landed): fullwidth CJK quotes and brackets.
    const ZH_QUOTE_ROWS = [
        ['“', '”', '‘', '’', '„', '‟', '«', '»', '‹', '›'],
        ['「', '」', '『', '』', '【', '】', '〖', '〗', '〔', '〕'],
        ['《', '》', '〈', '〉', '［', '］', '｛', '｝', '＃'],
    ];
    // The 引号 table's en side: ASCII quotes and brackets the zh table
    // has no room for ([ ] were unreachable on the whole keyboard).
    const EN_QUOTE_ROWS = [
        ['[', ']', '{', '}', '(', ')', '<', '>', '\'', '"'],
        ['`', '*', '/', '\\', '|', '~', '^', '&', '@', '#'],
        ['$', '%', '=', '+', '_', '«', '»', '‹', '›'],
    ];
    // Categories shipping a 中/En table pair; a second tap on the ACTIVE
    // tab flips the pin (design §2.4).
    const VARIANT_TABLES = {
        common: { zh: ZH_COMMON_ROWS, en: EN_COMMON_ROWS },
        quote: { zh: ZH_QUOTE_ROWS, en: EN_QUOTE_ROWS },
    };
    // The nine-pad's left strip - symbols that pair well with digits
    // (phone numbers, prices, units, simple math). Literal commits.
    const NUM_PAD_SYMBOLS = ['@', '%', '-', '+', '/', '*', '(', ')',
        '#', '$', '&', '_', '=', '~', '^', ':', ';'];

    /* ===== 九宫格 T9（微信式键面，docs/design/t9.md） ===== */
    // 左列空闲态的常用字符：中文标点，与 1 键(@#.)的西文/技术符号后选
    // （候选条符号行）互不重复——两套独立清单，避免同字符双入口。
    const T9_SIDE_CHARS = ['，', '。', '？', '！', '；', '：', '、',
        '“', '”', '（', '）', '《', '》', '…', '·', '—'];
    // 1 键点按在候选条展开的西文/技术符号（sendSymbol 直上屏）。
    const T9_BAR_SYMBOLS = ['@', '#', '.', '*', '+', '-', '_', '/', '='];
    // 下滑拆分浮层：7/9 是四个字母里唯二有两枚「下位」字母的键，
    // 下左/下右继续滑选中 q/r、x/y（用户定稿：不做子组通配拼写）。
    const T9_SPLIT = { '7': ['q', 'r'], '9': ['x', 'y'] };

    // 笔画键位（issue #18）：1-5=横竖撇点折（发 h/s/p/n/z）、6=单通配 *、
    // 8=逗号（发 ASCII ',' 走 punctuator——全角直发会被引擎丢弃，与
    // qwerty 标点槽同一教训）、9=分词 '。7 键不在此表（@#. 符号组，与
    // T9 的 1 键同款）。data-key 恒为数字：手势/浮层/套件按数字索引。
    // syms=长按浮层中列数字左右的跟手符号（沿用 T9 的键位分配）。
    const STROKE_KEYS = {
        '1': { main: '一', code: 'h', syms: ['！', '？'] },
        '2': { main: '丨', code: 's', syms: ['—', '&'] },
        '3': { main: '丿', code: 'p', syms: ['（', '）'] },
        '4': { main: '丶', code: 'n', syms: ['「', '」'] },
        '5': { main: '乙', code: 'z', syms: ['、', '：'] },
        '6': { main: '＊', code: '*', syms: ['；', '～'] },
        '8': { main: '，', code: ',', syms: ['…', '·'] },
        '9': { main: '分词', code: "'", syms: ['%', '/'] },
    };

    /** T9/笔画网格的坐标占位器（renderT9/renderStroke 共用）。 */
    const t9Place = grid => (button, row, column) => {
        button.style.gridRow = String(row);
        button.style.gridColumn = String(column);
        grid.append(button);
    };
    // 字母 → 九宫格数字（与 schema xlit 同表）：音节点选后计算剩余
    // 数字段长度用（ni 消耗 "64"，剩余从第 3 位起）。
    const T9_XLIT = {
        a: '2', b: '2', c: '2', d: '3', e: '3', f: '3', g: '4', h: '4', i: '4',
        j: '5', k: '5', l: '5', m: '6', n: '6', o: '6', p: '7', q: '7', r: '7',
        s: '7', t: '8', u: '8', v: '8', w: '9', x: '9', y: '9', z: '9',
    };
    const t9ToDigits = text => [...text].map(ch => T9_XLIT[ch] || ch).join('');

    // The emoji picker's curated offline set - seven categories of
    // daily-use glyphs (~350 total, a few KB inline). VS16/ZWJ sequences
    // are committed verbatim via commitText.
    const EMOJI_CATEGORIES = [
        { id: 'smiley', label: '笑脸', emojis: (
            '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 ' +
            '😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 ' +
            '🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 ' +
            '😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟').split(' ') },
        { id: 'hand', label: '手势', emojis: (
            '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 ' +
            '👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ ' +
            '💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 👶 🧒 👦 👧 👱 👨 ' +
            '👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🤦 🤷 🙇 🧘 🛀 🛌').split(' ') },
        { id: 'animal', label: '动物', emojis: (
            '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 ' +
            '🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 ' +
            '🦋 🐌 🐞 🐜 🪰 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦀 🐡 🐠 🐟 ' +
            '🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦏 🐪 🦒 🐃 🐄 🐎 🐖').split(' ') },
        { id: 'food', label: '食物', emojis: (
            '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 ' +
            '🍅 🥑 🥦 🥬 🥒 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🥨 🧀 ' +
            '🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 ' +
            '🍣 🍱 🍤 🍙 🍚 🍘 🍥 🍦 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍵').split(' ') },
        { id: 'activity', label: '活动', emojis: (
            '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏸 🏒 🥍 🏑 🥅 ' +
            '⛳ 🏹 🎣 🥊 🥋 🎽 🛹 🛼 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🎪 ' +
            '🎭 🎨 🎬 🎤 🎧 🎸 🎹 🥁 🎺 🎲 ♟️ 🧩 🎮 🕹️ 🎳 🎿 ' +
            '⛸️ 🥌 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧗 🏄 🚴 🚵 🏓 🤽').split(' ') },
        { id: 'object', label: '物品', emojis: (
            '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ ' +
            '📟 📠 📺 📻 🎙️ ⏰ 🕰️ ⌛ 💡 🔦 🕯️ 🧯 💸 💵 💰 💳 ' +
            '💎 ⚖️ 🧰 🔧 🔨 ⚙️ 🧲 🔫 💣 🔪 🛡️ 🔮 💉 💊 🩹 🩺 ' +
            '🚪 🪑 🛏️ 🚽 🚿 🛁 🧴 🧹 🧺 🔑 🗝️ 📦 📫 📝 ✏️ 📌 📎').split(' ') },
        { id: 'symbol', label: '表情', emojis: (
            '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 ' +
            '💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ' +
            '♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ ✅ ❌ ❓ ❗ ' +
            '💯 🔞 🚭 ♻️ ⚜️ 🔱 📛 🔰 ⭕ 🉑 🈶 🈚 🈸 🈺 🈷️ 🔥').split(' ') },
    ];
    const SYMBOL_CATEGORIES = [
        { id: 'common', label: '常用', rows: null }, // filled per keyboard mode
        // The user's own table, between 常用 and 最近; hidden
        // from the strip until it has content (renderSymbolCats filters).
        { id: 'custom', label: '定制', rows: null },
        { id: 'recent', label: '最近', rows: null }, // filled from history, falls back to 常用
        {
            id: 'quote', label: '引号',
            // 中/En paired like 常用 - rows come from VARIANT_TABLES.
            rows: null,
        },
        {
            id: 'money', label: '货币',
            rows: [
                ['$', '€', '£', '¥', '₩', '₽', '₹', '₫', '฿', '¢'],
                ['¤', '₴', '₦', '₲', '₱', '﷼', '₪', '₭', '₮', '₯'],
                ['％', '＄', '＆'],
            ],
        },
        {
            id: 'math', label: '数学',
            rows: [
                ['±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '°'],
                ['∑', '∫', '∏', '∈', '∉', '⊂', '⊃', '∪', '∩', '∅'],
                ['′', '″', '‰', '⊕', '⊗', '⊙', '∵', '∴', '⊥'],
            ],
        },
        // The 方向 category fires HOST key events, not text - it has no
        // rows of its own and is rendered by the arrows branch of
        // renderSymbols (design §2.4).
        { id: 'arrows', label: '方向', rows: null },
        {
            id: 'num', label: '序号',
            rows: [
                ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'],
                ['⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'],
                ['⒈', '⒉', '⒊', '⒋', '⒌', '⒍', '⒎', '⒏', '⒐'],
            ],
        },
        {
            id: 'pinyin', label: '拼音',
            rows: [
                ['ā', 'á', 'ǎ', 'à', 'ō', 'ó', 'ǒ', 'ò', 'ē', 'é'],
                ['ě', 'è', 'ī', 'í', 'ǐ', 'ì', 'ū', 'ú', 'ǔ', 'ù'],
                ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü', 'ê', 'Ā', 'Á', 'Ǎ'],
            ],
        },
        {
            id: 'hira', label: '平假名',
            rows: [
                ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'],
                ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'],
                ['な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ'],
            ],
        },
        {
            id: 'kata', label: '片假名',
            rows: [
                ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'],
                ['サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト'],
                ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ'],
            ],
        },
        {
            id: 'greek', label: '希腊',
            rows: [
                ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ'],
                ['Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ'],
                ['Φ', 'Χ', 'Ψ', 'Ω', 'α', 'β', 'γ', 'δ', 'ε'],
            ],
        },
    ];

    // Chinese-mode alts carry their FINAL glyphs - mostly
    // full-width -/：；（）～“”、？！… but the ones the user pinned stay
    // HALF-WIDTH (@ . # on Z X C). Re-pins the second row to
    // the user's exact list (a=-, s=/; the rest full-width). Row 1 keeps
    // half-width digits and the punct slot (，main / 。alt) is handled
    // separately. This replaces the older FULLWIDTH widening map: the
    // table IS the committed value, so no flick-time rewrite can misfire.
    const CN_ALTS = {
        a: '-', s: '/', d: '：', f: '；', g: '（', h: '）', j: '～',
        k: '“', l: '”',
        z: '@', x: '.', c: '#', v: '、', b: '？', n: '！', m: '…',
    };

    /* ===== Control-key layer ===== */
    // android.view.KeyCodes the control layer may send (native side
    // whitelists the same set + A..Z).
    const CTRL_KEY_CODES = {
        Escape: 111, Tab: 61, Home: 122, End: 123,
        PageUp: 92, PageDown: 93, Del: 112,
        ArrowUp: 19, ArrowDown: 20, ArrowLeft: 21, ArrowRight: 22,
        '.': 56,
        // The custom-key DSL and the Fn layer reach the whole
        // special-key palette - physical Backspace/Enter/Space join too.
        Enter: 66, Space: 62, Backspace: 67,
        // The old entry was `F4: 131` - 131 is KEYCODE_F1, so
        // Alt+F4 was rejected by the native whitelist and NEVER fired.
        // KEYCODE_F4 is 134; the whole F row is here for the Fn layer.
        F1: 131, F2: 132, F3: 133, F4: 134, F5: 135, F6: 136,
        F7: 137, F8: 138, F9: 139, F10: 140, F11: 141, F12: 142,
        // The bare LEFT modifier keys - a second tap on an armed
        // sticky modifier fires these (Win alone opens the Start menu).
        CtrlLeft: 113, AltLeft: 57, MetaLeft: 117,
    };
    // The Fn sticky layer - twelve letter keys turn into F-keys
    // while Fn is armed (top row F1..F10, K/L take F11/F12).
    const FN_KEYS = {
        q: 'F1', w: 'F2', e: 'F3', r: 'F4', t: 'F5', y: 'F6',
        u: 'F7', i: 'F8', o: 'F9', p: 'F10', k: 'F11', l: 'F12',
    };
    const STICKY_ALONE = { Ctrl: 'CtrlLeft', Alt: 'AltLeft', Meta: 'MetaLeft' };
    // android.view.KeyEvent meta bits (SHIFT/ALT/CTRL/META).
    const CTRL_META_BITS = { Shift: 1, Alt: 2, Ctrl: 0x1000, Meta: 0x10000 };
    // The 3x3 combo grids (long-press Ctrl/Alt, tap Comb). Full key names,
    // one modifier chain per cell; ctrl+c/v and alt+f/b/. are pinned.
    const COMBO_GRIDS = {
        ctrl: [
            ['Ctrl', 'Z'], ['Ctrl', 'X'], ['Ctrl', 'C'],
            ['Ctrl', 'W'], ['Ctrl', 'V'], ['Ctrl', 'A'],
            ['Ctrl', 'U'], ['Ctrl', 'K'], ['Ctrl', 'E'],
        ],
        alt: [
            ['Alt', 'F'], ['Alt', 'B'], ['Alt', '.'],
            ['Alt', 'D'], ['Alt', 'T'], ['Alt', 'H'],
            ['Alt', 'C'], ['Alt', 'L'], ['Alt', 'N'],
        ],
        comb: [
            ['Ctrl', 'Alt', 'Del'], ['Ctrl', 'Shift', 'C'], ['Ctrl', 'Shift', 'V'],
            ['Ctrl', 'Shift', 'Esc'], ['Ctrl', 'Shift', 'T'], ['Ctrl', 'Shift', 'N'],
            ['Ctrl', 'Shift', 'W'], ['Ctrl', 'Shift', 'Tab'], ['Alt', 'F4'],
        ],
        // Long-press the Win key - desktop shortcuts that make
        // sense on a phone-as-terminal (show desktop / lock / project).
        meta: [
            ['Meta', 'D'], ['Meta', 'L'], ['Meta', 'P'],
        ],
    };
    // Keyboard height (the letter key height) is tunable per
    // orientation; clamped so four rows always stay inside the budget.
    const KB_HEIGHT_KEY = orientation => `feelime_kb_height_${orientation}`;
    const KB_ROW_MIN = 32;

    /* ===== Custom symbol keys, defined as pasted JSON ===== */
    // Storage: {"version":1,"rows":[[ {t,tap,note} ... ] x3 ]}. tap is a
    // DSL: literal text commits as-is; [name] presses a key; [mod+name]
    // presses a combo (e.g. "[esc]ggVGD", "[ctrl+s]", "[alt+f4]").
    const CUSTOM_KEYS_STORE = 'feelime_custom_keys_v2';
    const CUSTOM_LIMITS = {
        rows: 3, keys: 100, tapChars: 128, labelChars: 12, noteChars: 60,
        maxKeySteps: 16, // combo/key steps per tap (the 25/s bridge throttle)
    };

    // 备份数据源（docs/design/userdata.md §1.4）：这些设置级 localStorage
    // 键在握手后与每次变化时镜像给原生（ImeBridge.pushStores），导出/换机
    // 由原生统一打包；最近符号/最近 emoji 属于使用痕迹，不进备份。
    // 色彩模式已迁到 native pref（feelime_keyboard.xml 的 theme_mode），
    // 由 PREFS_FILES 打包备份，不再走 localStorage 镜像。
    const STORE_BACKUP_KEYS = [
        'feelime_ui_locale', 'feelime_scrub_speed',
        'feelime_quick_pair', 'feelime_menu_modes', 'feelime_mode_order',
    ];

    function collectStores() {
        const stores = {};
        try {
            for (const key of STORE_BACKUP_KEYS) {
                const value = localStorage.getItem(key);
                if (value !== null) stores[key] = value;
            }
        } catch (_) { /* storage unavailable */ }
        return JSON.stringify(stores);
    }

    function pushStores() {
        // 类型守卫：热更键盘（新 JS）跑在旧原生（无 pushStores）上时，
        // 不许在 hello 路径抛错——能力握手之外的方法一律探测后再调。
        try {
            if (typeof Native.pushStores === 'function') {
                const rev = Native.pushStores(collectStores(), keyboard.token);
                if (rev) localStorage.setItem('feelime_stores_rev', String(rev));
            }
        } catch (_) { /* bridge unavailable */ }
    }

    /** 原生镜像比本地新（设置页导入过备份）时拉取恢复值（userdata.md §1.5）。
     * rev 跳号只能出现在导入侧，比较用大于即可。 */
    function pullStores(token) {
        try {
            if (typeof Native.getStores !== 'function') return;
            const mirror = JSON.parse(Native.getStores(token) || '{}');
            const remoteRev = parseInt(mirror.rev || 0, 10) || 0;
            const localRev = parseInt(localStorage.getItem('feelime_stores_rev') || '0', 10) || 0;
            // 只有真正的键值对象才表达恢复语义：数组/字符串等异常载荷
            // 不能当成「空备份」触发全量删除（native 正常产出 JSONObject）。
            const values = mirror.values;
            const valid = values !== null && typeof values === 'object' && !Array.isArray(values);
            if (remoteRev > localRev && valid) {
                keyboard.onStoresRestored(values);
                localStorage.setItem('feelime_stores_rev', String(remoteRev));
            }
        } catch (_) { /* old native or bad payload */ }
    }

    // DSL key names -> the CTRL_KEY_CODES label sent through sendCombo.
    const CUSTOM_KEY_TOKENS = {
        esc: 'Escape', tab: 'Tab', enter: 'Enter', space: 'Space',
        bs: 'Backspace', backspace: 'Backspace', del: 'Del',
        left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
        home: 'Home', end: 'End', pgup: 'PageUp', pgdn: 'PageDown', pageup: 'PageUp',
        pagedown: 'PageDown',
        f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
        f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
    };
    const CUSTOM_MOD_TOKENS = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', win: 'Meta', meta: 'Meta' };
    const CUSTOM_TEMPLATE = JSON.stringify({
        version: 1,
        rows: [
            [
                { t: 'Esc', tap: '[esc]', note: 'Vim / 终端 Esc' },
                { t: ':w', tap: ':w[enter]', note: 'Vim 保存' },
                { t: '整理', tap: '[esc]ggVGD', note: 'Vim 全文重新缩进' },
                { t: '保存', tap: '[ctrl+s]', note: '常见保存快捷键' },
                { t: '√', tap: '√' }, { t: '→', tap: '→' }, { t: 'F5', tap: '[f5]', note: '刷新' },
            ],
            [],
            [],
        ],
    }, null, 2);

    // Exact syllables from the bundled luna-pinyin prism.
    const FULL_PINYIN_SYLLABLES = `a ai an ang ao
        ba bai ban bang bao bei ben beng bi bian biang biao bie bin bing bo bu
        ca cai can cang cao ce cei cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo
        da dai dan dang dao de dei den deng di dia dian diao die din ding diu dong dou du duan dui dun duo
        e eh ei en eng er
        fa fan fang fei fen feng fiao fo fong fou fu
        ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
        ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
        ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
        ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
        la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lv lvan lve
        ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
        na nai nan nang nao ne nei nen neng ni nia nian niang niao nie nin ning niu nong nou nu nuan nun nuo nv nve
        o ou
        pa pai pan pang pao pei pen peng pi pia pian piao pie pin ping po pou pu
        qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
        ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo
        sa sai san sang sao se sei sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo
        ta tai tan tang tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
        wa wai wan wang wei wen weng wo wong wu
        xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
        ya yai yan yang yao ye yi yin ying yo yong you yu yuan yue yun
        za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo`.trim().split(/\s+/);

// BEGIN GENERATED T9_SYLLABLE_INDEX
    // 由 scripts/generate-t9-syllables.py 生成：数字串 → 音节
    // （组内按词典词频降序）+ 音节词重表 + 声母前缀层
    // （424 音节，源 luna_pinyin.table.txt）。
    const T9_SYLLABLE_INDEX = {"full":{"33":["de"],"53":["le","ke"],"96":["wo","yo"],"744":["shi"],"924":["zai","wai","yai"],"64":["ni","mi"],"548":["jiu","liu"],"43":["he","ge"],"94":["yi","zi","xi"],"968":["you","zou"],"28":["bu","cu"],"326":["dan","dao","fan"],"943":["zhe","xie"],"786":["suo","qun","run","sun","ruo"],"636":["men","nen"],"934":["wei","zei"],"946":["yin","xin"],"486":["guo","huo","hun","gun"],"78":["ru","qu","pu","su"],"54":["ji","li"],"468":["hou","gou"],"424":["hai","gai"],"93":["ye","ze"],"926":["yao","yan","wan","zao","zan"],"368":["dou","fou"],"22":["ba","ca"],"426":["hao","gan","gao","han"],"634":["mei","nei"],"82":["ta"],"7486":["shuo","shun"],"386":["duo","dun"],"436":["hen","gen"],"63":["me","ne"],"743":["she","qie","pie"],"7436":["shen"],"74264":["shang","qiang"],"9426":["xian","xiao","zhan","zhao"],"98":["xu","yu","wu","zu"],"384":["dui"],"94664":["zhong","xiong"],"726":["ran","san","pan","pao","rao","sao"],"62":["na","ma"],"944":["zhi"],"24":["bi","ci","ai"],"736":["ren","sen","pen"],"37":["er"],"74":["qi","si","ri","pi"],"526":["kan","lao","kao","lan"],"524":["lai","kai"],"4826":["huan","guan"],"4664":["gong","hong"],"482":["hua","gua"],"9826":["xuan","yuan","zuan"],"984":["zui"],"484":["hui","gui"],"5464":["jing","ling"],"8664":["tong"],"38":["fu","du"],"6364":["neng","meng"],"784":["sui","rui"],"434":["gei","hei"],"546":["jin","lin"],"9464":["xing","ying"],"3364":["deng","feng"],"986":["zuo","yun","xun","zun"],"983":["xue","yue"],"3264":["dang","fang"],"9264":["yang","wang","zang"],"2426":["chan","biao","bian","chao"],"746":["pin","qin"],"936":["zen","wen"],"84":["ti"],"9436":["zhen"],"9664":["yong","zong","wong"],"543":["jie","lie"],"32":["da","fa"],"542":["jia","lia"],"94826":["zhuan"],"5426":["jiao","jian","liao","lian"],"942":["xia","zha"],"36":["en","fo"],"7664":["rong","song"],"7426":["qian","shao","pian","piao","qiao","shan"],"94264":["xiang","zhang"],"3426":["dian","diao","fiao"],"234":["bei","cei"],"226":["ban","bao","cao","can"],"248":["chu"],"24264":["chang","biang"],"334":["fei","dei"],"58":["ju","lv","lu","ku"],"748":["shu","qiu"],"2664":["cong"],"3664":["dong","fong"],"34":["di","eh","ei"],"42":["ha","ga"],"54264":["jiang","liang"],"6426":["mian","nian","miao","niao"],"68":["mu","nu","nv","ou"],"74364":["sheng"],"236":["ben","cen"],"884":["tui"],"2464":["bing"],"8426":["tian","tiao"],"48":["hu","gu"],"286":["cun","cuo"],"52":["la","ka"],"7468":["shou"],"624":["mai","nai"],"336":["fen","den"],"586":["kuo","lun","luo","jun","kun"],"583":["jue","lve"],"7264":["rang","pang","sang"],"7464":["ping","qing"],"824":["tai"],"364":["eng"],"24364":["cheng"],"948":["zhu","xiu"],"7364":["peng","reng","seng"],"224":["cai","bai"],"7826":["quan","ruan","suan"],"2":["a"],"94364":["zheng"],"534":["lei","kei"],"92":["ya","za","wa"],"26":["an","bo","ao"],"724":["pai","sai"],"783":["que"],"58264":["kuang"],"244":["chi"],"868":["tou"],"3464":["ding"],"243":["bie","che"],"7484":["shui"],"83":["te"],"948264":["zhuang"],"5664":["kong","long"],"4364":["geng","heng"],"324":["dai"],"66":["mo"],"9486":["zhun","zhuo"],"8826":["tuan"],"6464":["ming","ning"],"7434":["shei"],"9364":["zeng","weng"],"626":["nan","man","nao","mao"],"3826":["duan"],"24664":["chong"],"2264":["bang","cang"],"5824":["kuai"],"536":["ken"],"826":["tao","tan"],"4264":["hang","gang"],"646":["nin","min"],"88":["tu"],"48264":["guang","huang"],"742":["sha","qia","pia"],"242":["cha"],"2364":["ceng","beng"],"5826":["kuan","luan","juan","lvan"],"8464":["ting"],"24826":["chuan"],"23":["ce"],"73":["se","re"],"7424":["shai"],"9484":["zhui"],"668":["mou","nou"],"768":["sou","rou","pou"],"5264":["kang","lang"],"248264":["chuang"],"9468":["zhou"],"6264":["mang","nang"],"76":["po"],"72":["pa","sa"],"8364":["teng"],"56":["lo"],"734":["pei","sei"],"2486":["chun","chuo"],"6664":["nong"],"748264":["shuang"],"4824":["guai","huai"],"568":["kou","lou"],"284":["cui"],"3":["e"],"648":["niu","miu"],"6":["o"],"584":["kui"],"7482":["shua"],"843":["tie"],"2436":["chen"],"64264":["niang"],"9424":["zhai"],"9482":["zhua"],"343":["die"],"6826":["nuan"],"643":["mie","nie"],"886":["tuo","tun"],"8264":["tang"],"686":["nuo","nun"],"2468":["chou"],"5364":["leng","keng"],"74824":["shuai"],"2484":["chui"],"348":["diu"],"2424":["chai"],"582":["kua"],"74664":["qiong"],"246":["bin"],"264":["ang"],"54664":["jiong"],"268":["cou"],"9434":["zhei"],"342":["dia"],"94824":["zhuai"],"24824":["chuai"],"683":["nve"],"642":["nia"],"2826":["cuan"],"74826":["shuan"],"834":["tei"],"782":["rua"],"2482":["chua"],"346":["din"]},"pre":{"2":["b","c"],"7":["p","q","r","s"],"6":["m","n"],"3":["f","d"],"8":["t"],"5":["l","k","j"],"4":["g","h"],"9":["x","z","y","w"],"94":["zh"],"24":["ch"],"74":["sh"]},"w":{"ling":101601.0,"tian":110731.0,"wu":75447.0,"pi":23423.0,"qia":10561.0,"chu":133824.0,"ye":404779.0,"jia":167401.0,"xue":177616.0,"ao":9136.0,"zan":23242.0,"gong":234244.0,"zong":52879.0,"xing":187596.0,"qin":32100.0,"xi":190700.0,"xie":268736.0,"bo":27491.0,"e":16452.0,"zheng":82665.0,"bao":100006.0,"yuan":58764.0,"qing":72567.0,"che":27023.3,"le":1495850.0,"zhan":91754.0,"san":36542.0,"shi":1180110.0,"die":9582.0,"qu":331354.0,"meng":16382.0,"yi":635391.0,"zhuo":8404.0,"si":234244.0,"ding":68928.0,"ba":385554.0,"chang":129032.0,"wei":474154.0,"xian":283910.0,"huan":235076.0,"xuan":216102.0,"kao":62877.0,"qiao":34543.0,"qi":245931.0,"shang":285526.0,"xia":164421.0,"han":19592.0,"mo":62488.0,"wan":87086.0,"zhang":76398.0,"ji":444292.0,"bu":590801.0,"yu":258188.0,"gai":98472.0,"mian":117698.0,"chou":7917.0,"qie":250274.0,"pei":27136.0,"qiu":109014.0,"bing":112978.0,"cheng":95999.0,"diu":6453.0,"liang":106330.0,"you":613999.0,"gun":10790.0,"shu":128574.0,"jiu":664963.0,"ya":79996.0,"qiang":30519.0,"zhong":278588.0,"xun":50467.0,"jie":167731.0,"feng":62257.0,"guan":118727.0,"kuang":72567.0,"chuan":36437.0,"chan":174020.0,"dian":138948.0,"zhu":92763.0,"dan":567022.0,"dong":126783.0,"jing":209044.0,"li":137141.0,"pie":1124.0,"fu":199709.0,"ai":32742.0,"nai":11863.0,"tuo":8898.0,"zhe":559659.0,"ma":221081.0,"me":295927.0,"yao":397297.0,"cha":40313.0,"zhi":253997.0,"zha":8619.0,"hu":109383.0,"fa":125666.0,"ping":98670.0,"pang":17570.0,"guai":19261.0,"sheng":114814.0,"yin":474154.0,"mie":8995.0,"nie":5001.0,"ge":635391.0,"he":664831.0,"dou":385949.0,"nang":1929.0,"ru":448056.0,"yan":93375.0,"sha":41314.0,"na":269940.0,"gan":76480.0,"qian":148413.0,"suo":531858.0,"chi":71344.0,"luan":13475.0,"gui":32535.0,"jun":23295.0,"lin":16405.0,"jue":99870.0,"liao":51026.0,"er":250274.0,"xu":281927.0,"yun":58476.0,"sui":195165.0,"gen":102983.0,"geng":63482.0,"zhai":13091.0,"zi":444292.0,"tou":70242.0,"wang":84561.0,"kang":31203.0,"da":167401.0,"dai":62548.0,"tai":98670.0,"jiao":165124.0,"hai":419427.0,"heng":20540.0,"xiang":142577.0,"ting":37642.0,"xin":89682.0,"zhen":169887.0,"lian":50794.0,"men":479209.0,"ren":250956.0,"shen":295927.0,"ze":216102.0,"pu":52398.0,"jin":187596.0,"ning":5348.0,"reng":26909.0,"bi":252143.0,"fo":4861.59,"zai":974219.0,"ta":344401.0,"gang":39563.0,"hong":13906.2,"tong":205273.0,"chao":50445.0,"miao":35376.0,"sa":18783.0,"mu":117345.0,"fan":36047.0,"yang":175106.0,"jian":130635.0,"cang":12327.0,"fen":101065.0,"di":122902.0,"fang":124842.0,"diao":21526.0,"dun":19588.0,"wen":171932.0,"xiu":46492.0,"bei":138923.0,"chen":13953.0,"nu":50784.0,"tang":8801.0,"huo":316870.0,"cui":16752.0,"bai":22808.0,"gu":50581.0,"ni":972978.0,"ban":138040.0,"zhou":30479.0,"ci":121514.0,"beng":10814.0,"ga":9129.0,"leng":7003.0,"mai":101135.0,"que":72660.0,"zhao":78886.0,"zuo":177744.0,"ben":114170.0,"ti":171932.0,"she":295927.0,"gou":121192.0,"ju":128574.0,"kou":17559.0,"yong":168923.0,"wa":16583.0,"ka":30144.4,"huai":14775.0,"hui":209791.0,"ke":483983.0,"lao":142562.0,"ming":58948.0,"hen":303301.0,"gua":12581.0,"quan":87086.0,"tiao":39431.0,"kan":245657.0,"kai":195561.0,"lai":235090.0,"kua":5745.0,"guang":41722.0,"an":79643.0,"mi":22343.0,"lu":34625.0,"mou":32366.0,"lun":54594.0,"hou":429078.0,"cuo":47595.0,"hao":378951.0,"lv":50289.0,"cen":1308.0,"nan":52601.0,"xiao":94151.0,"bian":56107.0,"pian":42408.0,"tui":113080.0,"cu":11827.0,"ku":18936.0,"lang":11455.0,"zu":38108.0,"hun":16690.0,"pai":76278.0,"su":37579.0,"biao":58039.0,"fei":129032.0,"lia":6011.19,"dao":297457.0,"tan":25105.0,"chui":6883.0,"peng":91420.0,"kong":64026.0,"juan":5922.0,"wo":1191910.0,"luo":42291.0,"song":21713.0,"kun":15121.0,"cai":89512.0,"ying":113623.0,"ruan":55503.0,"chun":25230.0,"nuo":8505.0,"ruo":12110.9,"dang":176920.0,"huang":19128.0,"chai":6395.0,"sai":43689.0,"duan":52510.0,"ce":36183.0,"ou":27887.0,"za":36774.0,"kui":15691.0,"sou":31598.0,"rong":152208.0,"jiang":120425.0,"bang":50819.0,"shan":16446.0,"can":26598.0,"lei":82236.0,"zao":46076.0,"zhuan":165885.0,"chuang":31122.0,"shuang":20483.0,"lou":17439.0,"piao":37045.0,"man":37783.0,"lan":15083.0,"jiong":3690.0,"zun":18406.0,"deng":183329.0,"tie":14576.0,"seng":1527.0,"zhuang":66733.0,"min":15706.0,"nong":25174.6,"kuai":48871.0,"bin":4378.0,"neng":195401.0,"qiong":5437.0,"lie":49671.0,"du":70250.0,"teng":28492.0,"long":10914.0,"rang":99107.0,"xiong":27136.0,"chong":52476.0,"dui":280800.0,"tu":43913.0,"mao":19588.0,"nei":152208.0,"liu":34574.0,"ran":272554.0,"guo":448056.0,"pan":35462.0,"mei":347575.0,"zhun":60056.0,"cou":2624.0,"cun":104597.0,"hua":222801.0,"yue":66349.0,"bie":67379.0,"pao":22665.0,"duo":303301.0,"shua":15120.0,"kei":4642.0,"la":103305.0,"pou":2930.0,"lve":33719.0,"tuan":59868.0,"fou":83210.0,"cao":63889.0,"cuan":1527.0,"zuan":7542.0,"keng":5752.0,"shao":63342.0,"gao":50087.0,"shuo":339890.0,"cong":128082.0,"tao":45568.0,"nao":33941.0,"zang":9907.0,"suan":43385.0,"nian":106172.0,"shuai":6908.0,"ang":3740.0,"yai":1449.0,"mang":30469.0,"zui":212671.0,"rou":26113.0,"shou":101593.0,"re":15158.0,"rui":5667.0,"po":30451.0,"a":84662.0,"tun":3151.0,"hang":45453.0,"shun":19588.0,"ne":240457.0,"chuo":1408.0,"pen":2844.0,"lo":28146.0,"pin":174020.0,"ha":122324.0,"o":16231.4,"miu":1415.0,"yo":8481.0,"zou":49021.0,"nou":629.0,"ken":48286.0,"pa":29829.0,"pia":928.0,"wai":101601.0,"sang":6696.0,"sun":17818.0,"sao":4953.0,"se":35144.0,"weng":1766.0,"en":162561.0,"eng":96536.0,"dia":2018.0,"chuai":1773.0,"hei":30819.0,"ceng":39759.0,"zeng":53937.0,"ca":4711.0,"nin":45322.0,"ri":199709.0,"de":4821480.0,"zhui":32887.0,"nv":33977.0,"niu":16350.0,"kuo":100006.0,"niang":13390.0,"shui":66967.0,"niao":10283.6,"nen":3402.0,"nun":3402.0,"rao":8421.0,"nia":1532.0,"lvan":1035.0,"qun":27195.0,"kuan":39744.0,"sen":5670.0,"dei":16843.0,"te":66798.0,"tei":807.092,"zen":173763.0,"zei":4785.0,"zhua":10209.0,"shuan":1170.0,"zhuai":1869.63,"rua":426.0,"run":23259.0,"nuan":9493.0,"shai":35144.0,"ei":2139.5,"chua":418.0,"fong":340.0,"nve":1689.0,"gei":192977.0,"fiao":400.0,"eh":2139.5,"shei":54727.0,"zhei":2563.04}};
    // END GENERATED T9_SYLLABLE_INDEX

    // Double-pinyin parse variants and the displayed key map come from the
    // generated block below: per scheme (ziranma / flypy / sogou), derived
    // from the shipped schemas by scripts/generate-keyboard-data.py and
    // re-checked against the prisms by scripts/verify/guard_dp_finals.js.

    function modeLabel(mode) {
        if (uiLocale === 'en') return ({pinyin: 'PY', 'double-pinyin': 'DP', t9: 'T9', japanese: 'JP'})[mode] || MODES[mode].label;
        return (MODES[mode] || MODES.direct).label;
    }

    /** Parse-variant table of the ACTIVE scheme (generated block); falls
     * back to 自然码 when native reported an unknown id (older engine). */
    function dpFinals() {
        return DP_INITIAL_FINALS[dpScheme] || DP_INITIAL_FINALS.ziranma;
    }

    // BEGIN GENERATED SCHEMA_MAP
    // schema-sha256: ziranma=ac60c13a00eae405 flypy=7850588e9495b50d sogou=e278729922814390 ziguang=6a139f79776718dd
    const DP_INITIAL_FINALS = {"ziranma":{"a":"ahijklno","b":"acdfghijklmnouxyz","c":"abefghijkloprsuvz","d":"abcefghijklmnopqrsuvwxyz","e":"efginrz","f":"abcfghjosuz","g":"abdefghjkloprsuvwyz","h":"abdefghjkloprsuvwyz","i":"abdefghijkloprsuvwy","j":"cdimnpqrstuvwxy","k":"abdefghjkloprsuvwyz","l":"abcdeghijklmnopqrstuvwxyz","m":"abcefghijklmnoquxyz","n":"abcdefghijklmnopqrstuvwxyz","o":"abefghjkloruz","p":"abcfghijklmnouwxyz","q":"cdimnpqrstuvwxy","r":"befghijkoprsuvw","s":"abefghijkloprsuvz","t":"abceghijklmoprsuvxyz","u":"abdefghijklopruvwyz","v":"abdefghijkloprsuvwyz","w":"afghjlosuz","x":"cdimnpqrstuvwxy","y":"abehijklnoprstuvy","z":"abefghijkloprsuvz"},"flypy":{"a":"acdhijno","b":"abcdfghijklmnopuw","c":"acdefghijorsuvwyz","d":"abcdefghijkmnopqrsuvwxyz","e":"efghinrw","f":"afghjnosuwz","g":"acdefghjklorsuvwxyz","h":"acdefghjklorsuvwxyz","i":"acdefghijklorsuvxyz","j":"biklmnpqrstuvxy","k":"acdefghjklorsuvwxyz","l":"abcdeghijklmnopqrstuvwxyz","m":"abcdefghijkmnopquwz","n":"abcdefghijklmnopqrstuvwxyz","o":"ouz","p":"abcdfghijkmnopuwxz","q":"biklmnpqrstuvxy","r":"cefghijorsuvxyz","s":"acdefghijorsuvwyz","t":"acdeghijkmnoprsuvwyz","u":"acdefghijkloruvwxyz","v":"acdefghijklorsuvwxyz","w":"adfghjosuw","x":"biklmnpqrstuvxy","y":"abcdehijkorstuvyz","z":"acdefghijorsuvwyz"},"sogou":{"a":"ahjkl","b":";acdfghijklmnouxz","c":"abefghijkloprsuvz","d":";abcefghijklmnopqrsuvwxz","e":"efgrz","f":"abcfghjosuz","g":"abdefghjkloprsuvwyz","h":"abdefghjkloprsuvwyz","i":"abdefghijkloprsuvwy","j":";cdimnpqrstuwxy","k":"abdefghjkloprsuvwyz","l":";abcdeghijklmnopqrstuwxyz","m":";abcefghijklmnoquxz","n":";abcdefghijklmnopqrstuwxyz","o":"abefghjkloruz","p":";abcfghijklmnouwxz","q":";cdimnpqrstuwxy","r":"befghijkoprsuvw","s":"abefghijkloprsuvz","t":";abceghijklmoprsuvxz","u":"abdefghijklopruvwyz","v":"abdefghijkloprsuvwyz","w":"afghjlosuz","x":";cdimnpqrstuwxy","y":";abehijklnoprstuy","z":"abefghijkloprsuvz"},"ziguang":{"a":"aeghilmnopqrstuwxyz","b":";abdfgikopqrstuwy","c":"aehiklmnopqrstuwz","d":";abdefhijklmnopqrstuwxyz","f":"abhkorstuwz","g":"aeghklmnopqrstuwxyz","h":"aeghklmnopqrstuwxyz","i":"aegiklmnopqrstuwxyz","j":";bdfghijlmnuvxy","k":"aeghklmnopqrstuwxyz","l":";abdefghijklmnopqrstuvxyz","m":";abdefijkopqrstuwyz","n":";abdefghijklmnopqrstuvwxyz","o":"aejkopqrstwz","p":";abdfikopqrstuwxyz","q":";bdfghijlmnuvxy","r":"ehilmnoqrstuwxz","s":"aehiklmnopqrstuwz","t":";abdefhiklmnopqrstuz","u":"aeghiklmnopqrstuwxyz","w":"ahkoprstuw","x":";bdfghijlmnuvxy","y":";aehilmnopqrsuvyz","z":"aehiklmnopqrstuwz"}};
    // END GENERATED SCHEMA_MAP

    class FeelimeKeyboard {
        constructor() {
            this.token = '';
            this.ready = false;
            this.mode = 'direct';
            this.engineReady = {};
            this.shift = false;
            this.caps = false;
            this.voiceState = 'idle';
            this.editorSensitive = false;
            this.composing = false;
            this.expanded = false;
            this.lastEngineState = null;
            this.lastRawInput = '';
            this.symbolCat = 'common';
            // 中/En table pins per category (常用/引号): a second tap on
            // the active tab pins 'zh'/'en'; a mode switch clears the
            // map (design §2.4).
            this.tableVariants = {};
            // Which key-area layer is visible (letters/symbols/numpad) -
            // panels and settings borrow the area and restore this.
            this.keyLayer = 'letters';
            // The nine-pad's emoji sub-view (toggled by the smiley key).
            this.emojiView = false;
            // The 常用 pin lives per MODE; this is the mode it was reset
            // for (rotation re-renders the same mode and must not reset).
            this.renderedMode = null;
            // The key layer the key area showed before a panel editor card
            // borrowed it for letters - openPanel must re-capture THIS.
            this.panelEditorKeyLayer = null;
            this.panelTab = 'clipboard';
            this.panelOpen = false;
            // Control-key layer state - the toolbar swap, the
            // sticky Ctrl/Alt/Meta modifiers and the open combo grid.
            this.ctrlView = false;
            this.ctrlSuspended = false;
            this.ctrlReturnLayer = 'letters';
            // Fn joins the sticky modifiers.
            this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
            this.comboGrid = null;
            // Which key opened the combo grid (its next tap only
            // closes) and whether the native float band is touchable.
            this.comboAnchor = null;
            this._overlayOpen = false;
            // Orientation (native hello / resize fallback) and
            // the saved per-orientation content height (0 = native default).
            this.landscape = false;
            this.helloOrientation = null;
            this.safeBottom = 0;
            // Native float band above the keyboard (CSS px; 0 =
            // old behaviour - every layer stays inside the IME view).
            this.floatBand = 0;
            this.kbHeight = 0;
            this.rowHeight = 44;
            this.heightEditSaved = null;
            // Custom-symbol editor state. customEditRow is the
            // row index while the shared strip edits a custom table row;
            // editorReturn routes closePanelEditor back to the right place.
            this.customEditRow = null;
            this.editorReturn = null;
            // Row action menu + phrase editor state.
            this.itemMenuOpen = null;
            this.panelEditItem = null;
            this.clipboardItems = [];
            this.favoriteItems = [];
            this.popup = null;
            this.touchOrigin = null;
            this.swiping = false;
            this.voiceHold = false;
            this.voiceSession = null;
            this.spaceHoldTimer = 0;
            this.pressedKeys = new Set();
            this.lastRevision = 0;
            this.toastTimer = null;
            // Expanded-strip state: candidates accumulate across page
            // fetches so the area scrolls infinitely instead of
            // paging. expandKey pins the accumulation to one composition.
            this.expandKey = null;
            // Expanded area: vertical candidate grid with a
            // parse-variant column (double pinyin) and a word/single filter.
            this.expandTab = 'freq';
            this.expandRendered = 0;
            // A variant tap rewinds through an empty composition;
            // the auto-collapse on composition end must hold off until the
            // replay's target echo lands, then the layer reopens on the
            // chosen parse.
            this.variantReplaying = false;
            this.variantTarget = null;
            this.variantReplayTimer = null;
            // The variant list is pinned to the parse the area was
            // opened with; switching variants moves the highlight and must
            // never shrink the list to the new raw's own expansions.
            this.variantAnchor = null;
            // Cursor scrub: horizontal drag moves the caret
            // continuously, seeded at the fixed threshold crossing.
            // Steps-per-pixel is tunable (1x..5x, default 3x).
            this.scrubSpeed = 3;
            // hello 已下发原生速度后置 true：旧 localStorage 镜像不再覆盖运行值。
            this.scrubSpeedFromNative = false;
            // Long-press trigger (ms) for popup/lock/mode-menu/numpad; the
            // repeat interval rides it (hold + 40). Feel-tuned via the
            // settings app, delivered through hello (mode-fallback §4).
            this.holdMs = 350;
            // Popup swipe selection range: 0=loose 1.4x, 1=standard 1.0x,
            // 2=tight 0.7x — scales the relative-tracking jitter dead zone
            // and the card-boundary cancel slop (selection itself stays
            // nearest-center).
            this.popupSnap = 1;
            // Bottom blank strip (CSS px) below the rows - native window
            // includes it; applyHeight/H budgets exclude it (mode-fallback §3).
            this.bottomPad = 0;
            // Candidate text scale (issue #2), pre-hello default.
            this.candidateFont = 0;
            // 拼音字号（issue #8）：0/1/2 三档，hello 回读（旧 APK 的 hello
            // 没有该字段时保持默认档 = 原始 13px 悬浮带）。加粗开关默认关。
            this.preeditFont = 0;
            this.preeditBold = false;
            // 单手模式（issue #15）：0=关 1=左手（键区贴左）2=右手；侧边条
            // 内容 0=光标控制 1=空白。背景图片（原「侧边图片」升级）：铺满
            // 整个键盘区域，bgImageEnabled 控制展示。
            this.oneHand = 0;
            // 单手压缩比例（2026-09-18 用户反馈：大屏单手仍够不着）：
            // 0=默认让位（CSS --side-pad-w 64px），15/25/35=让位占屏宽百分比。
            this.oneHandPad = 0;
            this.sideContent = 0;
            // 背景图亮/暗两组：各自独立，空串 = 该组无图（纯色背景）。
            this.bgImageLight = '';
            this.bgImageDark = '';
            // 键帽不透明度（0-100，默认 100=不透明）。
            this.keyOpacity = 100;
            // 色彩模式（auto/light/dark）：真相源是 native pref theme_mode，
            // hello 下发、tile 循环上报。AGENTS.md「设置不走 localStorage」。
            this.themeMode = 'auto';
            // 工具栏编辑模式（issue #15）：可编辑 icon 的左右分组顺序；
            // toolbarEdit 为编辑态（键区被仓库替换，候选条 icon 可删/拖）。
            this.toolbarLeft = TOOLBAR_DEFAULT.left.slice();
            this.toolbarRight = TOOLBAR_DEFAULT.right.slice();
            this.toolbarEdit = false;
            // 中文联想（docs/design/association.md），hello/onAssoc 驱动。
            this.associationOn = false;
            this.assocWords = [];
            // 按键反馈开关（issue #5 问题 2）：hello 回读（旧 APK 的 hello
            // 没有这两个字段，保持默认关）。
            this.keySound = false;
            this.keyHaptic = false;
            // 界面语言「选择值」（auto/zh/en，hello.uiLanguage）；uiLocale
            // 是解析后的显示语言（英文系统上 auto→en），tile 必须用选择值
            // 才能在英文系统上切回中文。
            this.uiLanguageChoice = 'auto';
            // 快捷偏好的未决意图（快速连点时防在途 hello 快照覆盖，见
            // quickTileDefs 的 qRead/qFlip/qStep）。
            this.quickPending = {};
            // 快捷设置方块网格的当前页（重渲染后恢复，见 renderSettingsHome）。
            this.qsPage = 0;
            // Degraded-engine state from events/hello (mode-fallback §2).
            // Non-null while a Direct fallback serves for a failed mode.
            this.degrade = null;
            this.warming = false;
            this.seenDegradeSeq = 0;
            // Quick keyboard pair for the space-adjacent toggle.
            this.quickPair = ['pinyin', 'direct'];
            try {
                const speed = parseInt(localStorage.getItem('feelime_scrub_speed') || '3', 10);
                if (speed >= 1 && speed <= 5) this.scrubSpeed = speed;
            } catch (_) { /* default 3x */ }
            try {
                const pair = JSON.parse(localStorage.getItem('feelime_quick_pair') || 'null');
                if (Array.isArray(pair) && pair.length === 2 &&
                    MODES[pair[0]] && MODES[pair[1]]) this.quickPair = pair;
            } catch (_) { /* default 拼/En */ }
            try {
                // The height is stored per orientation; the other key (if
                // any) is picked up when the device rotates (applyHeight).
                // Values hold the content height ; anything below
                // 120 is a legacy per-row height - ignored.
                const saved = parseInt(
                    localStorage.getItem(KB_HEIGHT_KEY('portrait')) || '0', 10);
                if (saved >= 120) this.kbHeight = saved;
            } catch (_) { /* native default */ }
            this.scrubBase = null;
            this.scrubSteps = 0;
            this.expandCandidates = [];
            this.expandHasNext = false;
            this.loadingMore = false;
        }

        setup() {
            window.addEventListener('blur', () => this.cancelTouches());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.cancelTouches();
            });
            // The view can disappear while a finger is down. A new touch
            // sequence must not inherit a press whose end was never delivered.
            document.addEventListener('touchstart', event => {
                if (event.touches.length === event.changedTouches.length) {
                    this.cancelTouches();
                    // WebView may omit the synthetic click after a long
                    // press opens a popup. Its suppression belongs only to
                    // that old gesture. Clear it before the keyboard's
                    // capture handler can mark a NEW trigger tap close-only.
                    document.querySelectorAll('#ctrlLayer [data-ctrl]').forEach(button => {
                        button._suppressClick = false;
                    });
                }
            }, { capture: true, passive: true });
            translateStaticUi();
            this.renderMode();
            this.renderSymbols();
            document.querySelector('[data-action="letters"]').addEventListener('click', () => this.showLetters());
            this.renderSymbolCats();
            document.getElementById('setupButton').addEventListener('click', () => this.toggleSettingsPanel());
            // Full settings opens from the toolbar button that
            // only shows while the quick panel is open.
            const fullSetup = document.getElementById('fullSetupButton');
            if (fullSetup) {
                fullSetup.addEventListener('click', () => {
                    this.closeSettingsPanel();
                    this.call(() => Native.openSetup(this.token));
                });
            }
            // Symbol layer row 4 : the enter key lives there too.
            document.getElementById('symEnterKey').addEventListener('click', () => this.call(() => Native.enter(this.token)));
            this.setupToolbarEditor && this.setupToolbarEditor();
            // 单手模式侧边条（issue #15）：光标四向发 DPAD 键事件（与物理
            // 方向键同通道，终端 cursor 语义兼容），全选/复制/剪切/粘贴走
            // 宿主 context menu action；旧 APK 无桥方法时点击无效果
            // （typeof 守卫，与 setQuickPref 同策略，不产生假成功）。
            document.querySelectorAll('#sideGrid .side-key').forEach(key => {
                const dir = key.getAttribute('data-side-cursor');
                const action = key.getAttribute('data-side-action');
                key.addEventListener('click', () => {
                    if (dir) {
                        this.call(() => {
                            if (typeof Native.editorCursor !== 'function') return;
                            Native.editorCursor(dir, this.token);
                        });
                    } else if (action) {
                        this.call(() => {
                            if (typeof Native.editorAction !== 'function') return;
                            Native.editorAction(action, this.token);
                        });
                    }
                });
            });
            // Clipboard/favorites moved into the quick panel rows.
            const clipBtn = document.getElementById('clipboardButton');
            if (clipBtn) clipBtn.addEventListener('click', () => this.openPanel('clipboard'));
            const favBtn = document.getElementById('favoritesButton');
            if (favBtn) favBtn.addEventListener('click', () => this.openPanel('favorites'));
            document.getElementById('panelClose').addEventListener('click', () => this.closePanel());
            document.getElementById('panelClear').addEventListener('click', () => {
                if (this.panelTab !== 'clipboard') return;
                this.call(() => Native.clearClipboard(this.token));
            });
            document.getElementById('panelManage').addEventListener('click', () => this.openPanelEditor(null));
            // The phrase editor input rides above the keyboard;
            // focus redirects native editor writes into it (see setPanelInput).
            const editorInput = document.getElementById('panelEditorInput');
            editorInput.addEventListener('focus', () => this.setPanelInput(true));
            document.querySelectorAll('.phrase-input').forEach(field => {
                field.addEventListener('focus', () => this.reportPanelSelection());
                ['input', 'select', 'click', 'keyup'].forEach(name =>
                    field.addEventListener(name, () => this.reportPanelSelection()));
            });
            editorInput.addEventListener('blur', () => {
                // Review P1: picking a bar candidate mousedowns the
                // button, which blurs the input BEFORE the click - closing
                // the redirect there would land the word in the host editor.
                // While the editor flow is open the redirect stays on; the
                // explicit close paths (closePanelEditor) still clear it.
                if (!document.body.classList.contains('editing')) {
                    this.setPanelInput(false);
                }
            });
            editorInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') this.savePanelEditor();
            });
            document.getElementById('panelEditorSave').addEventListener('click', () => this.savePanelEditor());
            document.getElementById('panelEditorCancel').addEventListener('click', () => this.closePanelEditor());
            // Floating phrase card buttons + reflow on resize.
            document.getElementById('phraseCardSave').addEventListener('click', () => this.savePanelEditor());
            document.getElementById('phraseCardCancel').addEventListener('click', () => this.closePanelEditor());
            document.getElementById('phraseCardClose').addEventListener('click', () => this.closePanelEditor());
            // 位次 stepper - exact code matches splice into their
            // 1-based candidate slot (min 1; the pool clamps large values).
            const nudgeRank = step => {
                const value = document.getElementById('phraseCardRankValue');
                const next = Math.min(Math.max((parseInt(value.textContent, 10) || 1) + step, 1), 99);
                value.textContent = String(next);
            };
            document.getElementById('phraseCardRankDown').addEventListener('click', () => nudgeRank(-1));
            document.getElementById('phraseCardRankUp').addEventListener('click', () => nudgeRank(1));
            // Tapping anywhere outside an open row menu closes it.
            // The combo grid and the mode menu get the same
            // outside-tap dismissal. A tap on the TRIGGER key of
            // one of those layers only closes it - the trigger's own action
            // (sticky arm, mode toggle) is suppressed for that tap.
            document.getElementById('softKeyboard').addEventListener('touchstart', event => {
                const inLayer = id => event.target && event.target.closest &&
                    event.target.closest(id);
                if (this.itemMenuOpen && !inLayer('#itemMenu')) this.closeItemMenu();
                // Review: the phrase card deliberately has NO
                // outside-tap dismissal - key taps are its INPUT channel
                // (redirect typing, Semantics; picking a candidate
                // mid-edit is the point). It closes only via ✕/取消/保存.
                if (this.comboGrid && !inLayer('#comboPopup')) {
                    const anchor = this.comboAnchor;
                    const onAnchor = anchor && event.target.closest &&
                        event.target.closest('[data-ctrl]') === anchor;
                    this.closeComboGrid();
                    if (onAnchor) anchor._suppressClick = true;
                }
                if (document.getElementById('modeMenu').classList.contains('open') &&
                    !inLayer('#modeMenu')) {
                    const toggle = document.getElementById('modeToggle');
                    const onToggle = event.target.closest && event.target.closest('#modeToggle') === toggle;
                    this.closeModeMenu();
                    if (onToggle && toggle) toggle._suppressClick = true;
                }
            }, { capture: true, passive: true });
            document.querySelectorAll('[data-panel-tab]').forEach(button => {
                button.addEventListener('click', () => this.openPanel(button.dataset.panelTab));
                this.bindTouch(button);
            });
            document.getElementById('hide').addEventListener('click', () => this.call(() => Native.hideKeyboard(this.token)));
            const micBtn = document.getElementById('mic');
            if (micBtn) micBtn.addEventListener('click', () => this.toggleVoice());
            // The globe opens the SYSTEM input method picker.
            const imeSwitch = document.getElementById('imeSwitchButton');
            if (imeSwitch) imeSwitch.addEventListener('click', () =>
                this.call(() => Native.switchInputMethod(this.token)));
            // The control-key entry swaps the toolbar for two
            // rows of control keys (candidate bar hides, key rows compress).
            const ctrlToolBtn = document.getElementById('ctrlTool');
            if (ctrlToolBtn) ctrlToolBtn.addEventListener('click', () =>
                this.setControlView(!this.ctrlView));
            this.bindCtrlLayer();
            // An explicit close affordance on the card (the
            // outside-tap dismissal stays as the second path).
            document.getElementById('comboClose').addEventListener('click', () => {
                this.closeComboGrid();
            });
            // Same pressed feedback for the floating X.
            this.bindPressFeedback(document.getElementById('comboClose'));
            // ...and for the delete-confirmation card's buttons .
            this.bindPressFeedback(document.getElementById('confirmCancel'));
            this.bindPressFeedback(document.getElementById('confirmOk'));
            this.bindHeightCard();
            // The delete-confirmation card.
            document.getElementById('confirmCancel').addEventListener('click', () => this.closeConfirmCard());
            document.getElementById('confirmOk').addEventListener('click', () => this.deleteHighlightedCandidate());
            // Orientation also arrives over the bridge hello,
            // but the preview harness (and any missed hello) still needs the
            // viewport to win. Every resize re-derives the row height too -
            // a height drag changes the view without changing orientation.
            if (typeof window.addEventListener === 'function') {
                window.addEventListener('resize', () => {
                    // B: the IME viewport IS the keyboard - a
                    // portrait drag shrinks innerHeight below innerWidth and
                    // the old width>height test flipped the layout to the
                    // (now reverted) folded landscape. The bridge's hello
                    // orientation is authoritative once it has spoken; only
                    // the preview harness (no hello yet) falls back to the
                    // viewport ratio.
                    if (!this.helloOrientation) {
                        this.applyOrientation(window.innerWidth > window.innerHeight);
                    }
                    this.applyHeight();
                    // 单手让位是屏宽百分比：旋转后重算。
                    if ((this.oneHand || 0) !== 0) this.applyOneHand();
                });
            }
            // Native height changes land after setKeyboardHeight returns.
            // Derive the rows from the keyboard's measured size when layout
            // finishes, including changes that don't resize the JS viewport.
            // Opening an unrelated popup must never be what fixes stale rows.
            if (typeof ResizeObserver === 'function') {
                this.heightObserver = new ResizeObserver(() => this.applyHeight());
                this.heightObserver.observe(document.getElementById('softKeyboard'), { box: 'border-box' });
            }
            // Hidden-window resizes produce no layout (and no observer
            // callback); re-derive when the page becomes visible again.
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) this.applyHeight();
            });
            // Candidate compose controls : × aborts the composition
            // and restores the toolbar; ˅ expands the candidate area over the
            // whole keyboard; inside, ˄ collapses (the
            // single chevron - aborting stays with the toolbar's ×).
            document.getElementById('composeClear').addEventListener('click', () => {
                // T9 符号行（1 键单击）的 × = 取消本次符号选择，工具栏恢复。
                if (this.t9SymBar) {
                    this.t9CloseSymbolBar();
                    return;
                }
                // 联想态的 × = 清掉联想词并恢复工具栏（没有引擎组合可清）。
                if (this.assocWords.length && !this.composing) {
                    this.assocWords = [];
                    this.renderCandidates(this.lastEngineState || {});
                    return;
                }
                this.clearComposing();
            });
            document.getElementById('composeExpand').addEventListener('click', () => this.setExpanded(true));
            document.getElementById('expandCollapse').addEventListener('click', () => this.setExpanded(false));
            // Infinite horizontal strip: dragging near the right edge (or a
            // too-short strip) fetches the next candidate page and appends it.
            document.getElementById('expandGrid').addEventListener('scroll', () => this.maybeLoadMoreCandidates());
            // The collapsed bar shares the pool - swiping it
            // near its end pulls the next page too.
            document.getElementById('candidates').addEventListener('scroll', () => this.maybeLoadMoreCandidates());
            // Word-frequency vs single-char filter tabs.
            document.querySelectorAll('[data-expand-tab]').forEach(button => {
                button.addEventListener('click', () => {
                    this.expandTab = button.dataset.expandTab;
                    document.querySelectorAll('[data-expand-tab]').forEach(el => (
                        el.classList.toggle('active', el === button)));
                    this.renderExpanded();
                });
            });
            this.bindTouch(document.getElementById('composeClear'));
            this.bindTouch(document.getElementById('composeExpand'));
            this.bindTouch(document.getElementById('expandCollapse'));
            // The overlay is a stop surface: a tap anywhere submits the live
            // recognition.  The explicit close button is the one exception;
            // its handler stops propagation and discards the live input.
            document.getElementById('voiceOverlay').addEventListener('click', () => {
                this.requestVoiceStop(false);
            });
            const finishVoice = event => {
                event.stopPropagation();
                this.requestVoiceStop(false);
            };
            // Keep explicit handlers on both painted surfaces as well.  Apart
            // from making the hit target unambiguous in WebView, this keeps
            // the scrim/card paths observable in the headless bridge harness.
            document.getElementById('voiceScrim').addEventListener('click', finishVoice);
            document.getElementById('voiceCard').addEventListener('click', finishVoice);
            const voiceClose = document.getElementById('voiceClose');
            voiceClose.addEventListener('click', event => {
                event.stopPropagation();
                // 撤销=弃稿：图标+文字明确语义，单击即撤销（无确认）。
                if (this.requestVoiceStop(true)) {
                    this.showToast(t("已撤销本次听写"));
                }
            });
            this.bindPressFeedback(voiceClose);
            const voiceDone = document.getElementById('voiceDone');
            voiceDone.addEventListener('click', event => {
                // 说完了=结束并上屏（与点卡片任意位置同一路径），大按钮
                // 是浮层里的主要出口。
                event.stopPropagation();
                this.requestVoiceStop(false);
            });
            this.bindPressFeedback(voiceDone);
            // The toolbar mic needs bindTouch (preventDefault + active-touch
            // + manual click dispatch), unlike the plain-click toolbar tools.
            this.bindTouch(document.getElementById('mic'));
            this.setupFlick(document.getElementById('softKeyboard'));
            // A saved content height rides in at startup (native
            // restores its own copy from prefs; the bridge call keeps both
            // sides in sync, the fallback styles the total view directly).
            if (this.kbHeight) this.applyKbHeight(this.kbHeight);
            this.applyHeight();
            // 预览 iframe（设置页外观页）没有桥：直接引用会 ReferenceError
            // 中断构造，键网格画不出来。正常键盘 WebView 里 Native 恒在。
            if (typeof Native === 'object' && Native !== null
                && typeof Native.requestState === 'function') {
                Native.requestState();
            }
        }

        /* ===== bridge helpers ===== */

        call(action) {
            if (!this.ready || !this.token) return;
            action(this.lastRevision);
        }

        isChineseMode() {
            return this.mode === 'pinyin' || this.mode === 'double-pinyin' ||
                this.mode === 't9' || this.mode === 'stroke';
        }

        sendKey(key) {
            // Inside the ctrl view an ARMED sticky modifier turns
            // the main keyboard's letter taps into host combos (Ctrl then w
            // sends Ctrl+W) - letting "w" fall through to the engine would
            // type into the terminal instead of firing the shortcut.
            const stickyArmed = this.ctrlView && this.sticky &&
                Object.keys(this.sticky).some(name => this.sticky[name]);
            if (stickyArmed) {
                const mods = Object.keys(this.sticky).filter(name => this.sticky[name]);
                // The qwerty shift's armed state joins as the SHIFT meta
                // bit (design §11): Ctrl sticky + shift + letter = Ctrl
                // +Shift+C, Fn + shift = Shift+F-key. It is appended AFTER
                // the guard below - shift alone must never open the combo
                // path, letters keep the one-shot uppercase fallthrough.
                const shiftMod = this.shift ? ['Shift'] : [];
                // An armed Fn turns the twelve mapped keys into
                // F-keys (Q -> F1 ... L -> F12); the combo clears every
                // sticky bit, Fn included.
                const fnLabel = this.sticky.Fn ? FN_KEYS[key] : null;
                if (fnLabel) {
                    this.sendCombo([...mods.filter(name => name !== 'Fn'), ...shiftMod, fnLabel]);
                    return;
                }
                // Plain modifiers + letter keeps the old combo path; Fn alone
                // leaves the tap to fall through and type the letter.
                if (/^[a-z]$/i.test(key) && mods.some(name => name !== 'Fn')) {
                    this.sendCombo([...mods.filter(name => name !== 'Fn'), ...shiftMod, key.toUpperCase()]);
                    return;
                }
            }
            // The punct slot's MAIN glyph is now ，and the
            // alt is 。— a tap sends ASCII ',' so the engine's punctuator
            // produces ，(the same already-verified path; sending U+FF0C
            // directly would bypass the punctuator and be dropped).
            const text = key === '.' && this.isChineseMode() ? ',' : this.applyCase(key);
            this.call(() => Native.key(text, this.token));
            if (this.shift) { this.shift = false; this.updateLabels(); }
        }

        sendText(text) {
            if (!text) return;
            // T9 引擎拼写不区分大小写：schema 的 alphabet 只收小写字母+数字，
            // 大写键会被 rime recognizer 的大写规则截成英文原文段直接上屏。
            // 这条通道现在只剩滑动手势的「字母确认拼写」（长按弹层的字母格
            // 是 literal 直上屏，不走这里），统一归一小写——applyCase 之后
            // 做，残留 shift 不会反弹。
            if (this.mode === 't9') text = this.applyCase(text).toLowerCase();
            else text = this.applyCase(text);
            this.call(() => Native.key(text, this.token));
            if (this.shift) { this.shift = false; this.updateLabels(); }
        }

        /**
         * Symbol-grid insertion is literal text, never engine input: routing
         * digits through key() feeds Chinese modes, where they are consumed
         * as candidate selectors and nothing lands (user-reported bug).
         * commitText bypasses composition, like panel paste.
         */
        sendSymbol(text) {
            if (!text) return;
            // Literal insertion - no case shifting: the 拼音/希腊 categories
            // contain letters, and leftover Shift must not turn ā into Ā.
            this.call(() => Native.commitText(text, this.token));
            if (this.shift) { this.shift = false; this.updateLabels(); }
        }

        // Shift/Caps must also apply to accented and Cyrillic letters
        // arriving via popups and flicks, not just to [a-z0-9а-яё] key taps.
        applyCase(text) {
            if (!(this.shift || this.caps)) return text;
            if (!/^\p{L}$/u.test(text)) return text;
            if (text !== text.toLowerCase()) return text;
            return text.toUpperCase();
        }

        toggleVoice() {
            if (!this.ready) return;
            if (this.voiceState === 'listening' || this.voiceState === 'loading') {
                this.requestVoiceStop(false);
            } else {
                this.voiceSession = 'toolbar';
                Native.startVoice(this.token);
            }
        }

        /** Stop submits the current partial; cancel discards it.  The native
         * cancel entry is capability-gated so an older APK can never fall
         * back to stopVoice and accidentally commit a cancelled utterance. */
        requestVoiceStop(cancel) {
            // A hold can be released in the short gap between startVoice and
            // the first native loading callback. Keep the session marker as
            // the source of truth for that race.
            const active = ['listening', 'loading'].includes(this.voiceState) || this.voiceSession;
            if (!active) return false;
            if (cancel) {
                if (typeof Native.cancelVoice !== 'function') {
                    this.showToast(t("当前版本不支持取消语音输入，请更新 APK"));
                    return false;
                }
                Native.cancelVoice(this.token);
                return true;
            }
            Native.stopVoice(this.token);
            return false;
        }

        /* ===== rendering ===== */

        /** Keep the native side informed about layers that
         * overlap the float band above the keyboard - the band is not
         * touchable while closed, so any popup living there must flip the
         * native touch region (see FeelimeService.onComputeInsets). */
        syncOverlay() {
            const open = this.comboGrid !== null ||
                document.getElementById('modeMenu').classList.contains('open') ||
                document.getElementById('itemMenu').classList.contains('open') ||
                document.getElementById('phraseCard').classList.contains('open') ||
                // The height card lives in the band too - without
                // this line every real touch on it fell through to the host
                // app (±/strip/cancel all dead under a finger; synthetic
                // clicks bypassed hit-testing, so every suite stayed green).
                document.getElementById('heightCard').classList.contains('open');
            if (this._overlayOpen === open) return;
            this._overlayOpen = open;
            if (typeof Native.setOverlayOpen === 'function') {
                this.call(() => Native.setOverlayOpen(open, this.token));
            }
        }

        renderMode() {
            const config = MODES[this.mode] || MODES.direct;
            // CapsLock/Shift belong to the keyboard they were set
            // on - switching keyboards must not inherit them (and Chinese
            // layouts have no shift key to undo them with).
            this.shift = false;
            this.caps = false;
            // Table pins follow the MODE, not the render: rotation
            // re-renders through applyOrientation and must keep a pinned
            // variant, or the grid, its badge and the recent-fill
            // disagree (design §2.4, review P2).
            if (this.renderedMode !== this.mode) {
                this.renderedMode = this.mode;
                this.tableVariants = {};
                // A mode switch can land while the symbol layer is open -
                // the grid and its badge must follow the new default.
                if (!document.getElementById('symbolLayer').hidden) {
                    this.renderSymbolCats();
                    this.renderSymbols();
                }
            }
            this.renderLetters(config.layout);
            this.closeModeMenu();
            this.closeSettingsPanel();
            // renderMode is invoked on every mode change INCLUDING the one a
            // degrade/recovery event carries; the badge must survive it.
            this.renderDegradeBadge();
        }

        renderLetters(layoutName) {
            if (layoutName === 't9') {
                this.t9SymBar = false;
                // 换键面=离开符号行：工具栏让位必须解除，否则隐藏的快捷
                // 按钮没有恢复入口（引擎事件只是兜底）。
                if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
                return this.mode === 'stroke' ? this.renderStroke() : this.renderT9();
            }
            this.t9SymBar = false;
            if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
            const layout = LAYOUTS[layoutName] || LAYOUTS.qwerty;
            // E: the folded landscape layout is REVERTED - user
            // report: the mixed bottom rows broke muscle memory and the
            // symbol layer lost its last row. Landscape now renders the same
            // four rows as portrait (the height budget grew to half the
            // screen to make room).
            const layer = document.getElementById('qwertyLayer');
            layer.replaceChildren();
            layout.rows.forEach(definition => {
                const config = typeof definition === 'string' ? { keys: definition } : definition;
                const row = this.row(config.indent);
                if (config.shift) {
                    // Both Chinese modes carry the 分词 separator.
                    // Full pinyin: xi'an pins the split. Double pinyin: the
                    // schema's jianpin abbreviations + bare zero-initials make
                    // x'an expand into every x-syllable + an (aggregated,
                    // frequency-ranked), so the separator is useful there too
                    // (an earlier iteration had reverted it to Shift while n'hk was dead
                    // input). Non-Chinese modes keep Shift/Caps.
                    // Sogou and Ziguang double pinyin put the ing final on
                    // the ';' key (that wide slot), so there the key IS a
                    // letter key.
                    row.append(this.isChineseMode()
                        ? (this.mode === 'double-pinyin' && (dpScheme === 'sogou' || dpScheme === 'ziguang')
                            ? this.specialKey('sep', 'ing', () => this.call(() => Native.key(';', this.token)), 'kb-wide-1_4 kb-mod sep')
                            : this.specialKey('sep', t("分词"), () => this.call(() => Native.key("'", this.token)), 'kb-wide-1_4 kb-mod sep'))
                        : this.specialKey('shift', ICONS.shift, () => this.toggleShift(), 'kb-wide-1_4 kb-mod shift', 'lock'));
                }
                [...config.keys].forEach(key => row.append(this.letterKey(key)));
                if (config.backspace) row.append(this.specialKey('backspace', ICONS.backspace, () => this.call(() => Native.backspace(this.token)), 'kb-wide-1_4 kb-special', 'repeat'));
                layer.append(row);
            });
            // Bottom row:
            // [123] [punct] [space(+mic)] [中/英] [enter]; long-press the
            // toggle for the system IME picker (the old globe slot).
            const bottom = this.row();
            bottom.append(this.specialKey('symbols', '123', () => this.showSymbols(), 'kb-wide-2_1 kb-special', 'numpad'));
            bottom.append(this.letterKey('.'));
            bottom.append(this.spaceKey());
            bottom.append(this.cnEnKey());
            bottom.append(this.enterKey());
            layer.append(bottom);
            this.updateLabels();
        }

        /* ===== 九宫格 T9 键面：五列网格（微信式，preview-t9 定稿） =====
         * c1 音节/常用字符条（grid-row 1/5，底部符号键）· c2-c4 字母组 3×3 ·
         * c5 退格/重输/emoji/确认。底行 123 与中英各 2/3 键宽，省出的
         * 空间全部给空格（mic）键（用户定稿）。 */
        renderT9() {
            const layer = document.getElementById('qwertyLayer');
            layer.replaceChildren();
            const grid = document.createElement('div');
            grid.className = 't9-grid';
            this.t9GridSide(grid);
            // 3×3 字母组键（data-key=数字：几何/套件/长按弹层都认它）。
            // 显式坐标表——自动占位错一格就全盘漂移（renderNumpad 教训）。
            const place = t9Place(grid);
            const coords = {
                '1': [1, 2], '2': [1, 3], '3': [1, 4],
                '4': [2, 2], '5': [2, 3], '6': [2, 4],
                '7': [3, 2], '8': [3, 3], '9': [3, 4],
            };
            Object.keys(coords).forEach(digit => {
                if (digit === '1') {
                    // 1 键：主字形 @#.（西文/技术符号）。单击=符号行并让位
                    // 工具栏（× 取消/点选还原），无长按态（用户定稿）。
                    const one = document.createElement('button');
                    one.className = 'kb-key t9-key';
                    one.dataset.key = '1';
                    one.innerHTML = '<span class="t9-sup">1</span><span class="t9-group">@#.</span>';
                    one.addEventListener('click', () => this.t9SymbolBar());
                    this.bindTouch(one);
                    place(one, coords[digit][0], coords[digit][1]);
                } else {
                    place(this.t9LetterKey(digit), coords[digit][0], coords[digit][1]);
                }
            });
            this.t9GridChrome(grid, place);
            layer.append(grid);
            this.t9SideSig = null;
            // 确认边界跟随组合生命周期（updateComposing 管理），不随键面
            // 重绘清零——横竖屏切换重建键面，清零会丢掉有效边界
            // （codex round-2 P2-1）。
            this.renderT9Side();
            this.updateLabels();
        }

        /** T9 网格左列（笔画键面共用同一骨架）：竖向滚动条（native
         * scroll，无 bindTouch——preventDefault 杀拖动的既有教训）+
         * 底部符号键（面板入口，非 @#. 后选）。 */
        t9GridSide(grid) {
            const side = document.createElement('div');
            side.className = 't9-side';
            const strip = document.createElement('div');
            strip.className = 't9-strip';
            strip.id = 't9Strip';
            side.append(strip);
            const symBtn = this.specialKey('t9sym', t("符号"),
                () => this.showSymbols(), 't9-sym-btn kb-special');
            symBtn.setAttribute('aria-label', t("符号面板"));
            side.append(symBtn);
            grid.append(side);
        }

        /** T9 网格的功能列与底行（笔画键面共用同一骨架）：c5 退格/重输/
         * emoji，底行 123(2/3) + mic 空格(5/3) + 中英(2/3) + 确认。 */
        t9GridChrome(grid, place) {
            place(this.specialKey('backspace', ICONS.backspace,
                () => this.call(() => Native.backspace(this.token)),
                'kb-special', 'repeat'), 1, 5);
            const clearKey = this.specialKey('t9clear', t("重输"),
                () => this.clearComposing(), 'kb-special');
            place(clearKey, 2, 5);
            const emojiKey = this.specialKey('t9emoji', ICONS.smiley,
                () => { this.emojiView = true; this.showNumpad(); }, 'kb-special');
            place(emojiKey, 3, 5);
            const r4 = document.createElement('div');
            r4.className = 't9-r4';
            r4.append(this.specialKey('symbols', '123',
                () => this.showNumpad(), 't9-narrow kb-special'));
            const space = this.spaceKey();
            // data-key 让通用手势层认领 mic：上滑字面 0、横滑光标 scrub
            // 都走 .kb-key[data-key] 选择器（T9 下唯一保留 scrub 的键）。
            // 右上角 0 角标提示字面 0；长按圆点由 CSS 挪到左上角。
            space.dataset.key = '0';
            space.classList.add('t9-wide');
            space.classList.add('t9-space');
            const zero = document.createElement('span');
            zero.className = 't9-sup';
            zero.textContent = '0';
            space.append(zero);
            r4.append(space);
            // 中英键同样压成 2/3 键宽——cnEnKey 自带的 kb-wide-1_15 会被
            // .t9-r4 .kb-key{flex:3} 盖掉，不补窄类会吃掉空格的宽度
            // （底行约定 2:5:2，codex round-2 P2-8）。
            const cnEn = this.cnEnKey();
            cnEn.classList.add('t9-narrow');
            r4.append(cnEn);
            r4.style.gridRow = '4';
            r4.style.gridColumn = '2 / 5';
            grid.append(r4);
            // 确认键：组合中=提交高亮候选（拦截 Native.enter），见 enterKey。
            const enter = this.enterKey('');
            enter.style.gridRow = '4';
            enter.style.gridColumn = '5';
            grid.append(enter);
        }

        /* ===== 笔画键面（issue #18）：T9 五列网格骨架，3×3 换成笔画
         * 部件键。左列无音节枚举（renderT9Side 的 stroke 分支恒出常用
         * 字符），其余交互（退格/重输/emoji/底行/确认）与 T9 一致。 */
        renderStroke() {
            const layer = document.getElementById('qwertyLayer');
            layer.replaceChildren();
            const grid = document.createElement('div');
            grid.className = 't9-grid';
            this.t9GridSide(grid);
            const place = t9Place(grid);
            const coords = {
                '1': [1, 2], '2': [1, 3], '3': [1, 4],
                '4': [2, 2], '5': [2, 3], '6': [2, 4],
                '7': [3, 2], '8': [3, 3], '9': [3, 4],
            };
            Object.keys(coords).forEach(digit => {
                if (digit === '7') {
                    // 7 键=@#. 符号组（issue #18：同 T9 符号组）：单击=
                    // 符号行并让位工具栏，无长按态（与 T9 的 1 键同款）。
                    const sym = document.createElement('button');
                    sym.className = 'kb-key t9-key';
                    sym.dataset.key = '7';
                    sym.innerHTML = '<span class="t9-sup">7</span><span class="t9-group">@#.</span>';
                    sym.addEventListener('click', () => this.t9SymbolBar());
                    this.bindTouch(sym);
                    place(sym, coords[digit][0], coords[digit][1]);
                } else {
                    place(this.strokeKey(digit), coords[digit][0], coords[digit][1]);
                }
            });
            this.t9GridChrome(grid, place);
            layer.append(grid);
            this.t9SideSig = null;
            this.renderT9Side();
            this.updateLabels();
        }

        /** 笔画键：主字形=笔画部件（一丨丿丶乙 / ＊ / ， / 分词），右上
         * 角标=数字（上滑字面），左上小字=长按可出的两个符号。点按=
         * 部件编码进引擎（8 键发 ASCII ',' 走 punctuator）；6 键的第二
         * 个 * 在 JS 拦截（码表只派生了单通配行，** 无命中）。rawInput
         * 是 schema xlit 后的部件字形，* 原样保留（probe 实测）。 */
        strokeKey(digit) {
            const def = STROKE_KEYS[digit];
            const button = document.createElement('button');
            button.className = 'kb-key t9-key';
            button.dataset.key = digit;
            button.dataset.lp = 'popup';
            const hint = document.createElement('span');
            hint.className = 't9-hint';
            hint.textContent = (def.syms || []).join('');
            const sup = document.createElement('span');
            sup.className = 't9-sup';
            sup.textContent = digit;
            const group = document.createElement('span');
            group.className = 't9-group';
            // t() 过一遍让「分词」跟界面语言走（其余部件字形无翻译条目，
            // 原样返回）；模块级表不能预求值，locale 切换后重渲染即更新。
            group.textContent = t(def.main);
            button.append(hint, sup, group);
            button.addEventListener('click', () => this.strokeActivate(digit));
            this.bindTouch(button);
            return button;
        }

        /** 笔画键的统一激活入口（点按与长按中格共用——codex 评审 P1：
         * closePopup 的引擎通道原先直发 send 绕过了这里的两个守卫）。
         * 6 键=单通配（码表只派生单 * 行，第二个拦截：回显含 * 或上一
         * 个 * 还在途）；8 键组合中=两步逗号（Android librime 组合中标点
         * 路径异常，先按 id 确认池头，组合结束回声后 commitText 直发
         * 全角 ，）。 */
        strokeActivate(digit) {
            const def = STROKE_KEYS[digit];
            if (!def) return;
            if (digit === '6' && this.composing &&
                ((this.lastRawInput || '').includes('*') || this.wildcardInFlight)) {
                this.showToast(t("通配符只能用一个"));
                return;
            }
            if (digit === '8' && this.composing) {
                const candidate = (this.expandCandidates || []).find(item =>
                    !String(item.id).startsWith('alt:'));
                if (candidate) {
                    this.pendingPunct = { text: '，', raw: this.lastRawInput, at: Date.now() };
                    this.choosePoolCandidate(candidate);
                    return;
                }
            }
            if (digit === '6') this.wildcardInFlight = true;
            this.call(() => Native.key(def.code, this.token));
        }

        /** 字母组键：主字形=字母组（ABC），右上角标=数字，左上角小字=
         * 长按可出的两个符号（issue #9）。点按=整组通配（数字进引擎）；
         * 长按=三行弹层（大小写+符号）；四向滑动见 setupFlick。 */
        t9LetterKey(digit) {
            const button = document.createElement('button');
            button.className = 'kb-key t9-key';
            button.dataset.key = digit;
            button.dataset.lp = 'popup';
            const hint = document.createElement('span');
            hint.className = 't9-hint';
            hint.textContent = (LAYOUTS.t9.keySymbols[digit] || []).join('');
            const sup = document.createElement('span');
            sup.className = 't9-sup';
            sup.textContent = digit;
            const group = document.createElement('span');
            group.className = 't9-group';
            group.textContent = (LAYOUTS.t9.alts[digit] || '').toUpperCase();
            button.append(hint, sup, group);
            button.addEventListener('click', () =>
                this.call(() => Native.key(digit, this.token)));
            this.bindTouch(button);
            return button;
        }

        /** 待确认段音节枚举：对「未确认前缀之后的输入」做前缀枚举，逐位
         * 校验字母一致性（段中已确认的字母必须与音节同位相同或该位是
         * 数字）。候选跨前缀长度按词典词频全局降序（输入 64 → ni 在
         * mi/o 之前），声母前缀层缀尾。 */
        t9SegmentSyllables(seg) {
            const digits = t9ToDigits(seg);
            const consistent = (form, n) => {
                for (let i = 0; i < n; i++) {
                    if (seg[i] !== form[i] && seg[i] !== t9ToDigits(form[i]).charAt(0)) {
                        return false;
                    }
                }
                return true;
            };
            const w = T9_SYLLABLE_INDEX.w || {};
            const full = [];
            for (let n = 1; n <= seg.length; n++) {
                (T9_SYLLABLE_INDEX.full[digits.slice(0, n)] || []).forEach(s => {
                    if (consistent(s, n)) full.push(s);
                });
            }
            full.sort((a, b) => (w[b] || 0) - (w[a] || 0));
            const pre = [];
            const seen = new Set();
            Object.values(T9_SYLLABLE_INDEX.pre).forEach(list => list.forEach(p => {
                if (!seen.has(p) && p.length <= seg.length && consistent(p, p.length)) {
                    seen.add(p);
                    pre.push(p);
                }
            }));
            return { full, pre };
        }

        /** 未确认段：键盘侧记录的「用户点选确认」边界之后的输入。引擎回显
         * 的段空格是切分猜测不是用户确认（64426 会被引擎猜成 64|426，
         * 首字还没定就展示第二字读法是错的，用户定稿：只出首字读法）。 */
        t9PendingSegment() {
            const raw = (this.lastRawInput || '').replace(/ /g, '');
            const cut = Math.min(this.t9ConfirmedLen || 0, raw.length);
            // librime 连续造词会把已选汉字写进 preedit（'你426'）：已选
            // 文字不属于待确认拼写，剥掉前缀非拼写字符，音节枚举才有得
            // 可选（codex round-2 P2-2）。边界按 raw 坐标先切再剥。
            return raw.slice(cut).replace(/^[^a-z2-9]+/i, '');
        }

        /** 当前读音（候选字上方的拼音提示）：按引擎回显的段切分，段内
         * 贪婪最长覆盖（同长取词频高）拼出 'ni'hao'——取词频首位会把
         * nian 截成 ni（codex round-4 P2-1），读音必须覆盖整段；剩余
         * 无匹配时原样保留。 */
        t9Reading() {
            const parts = (this.lastRawInput || '').trim().split(/ +/).filter(Boolean);
            if (!this.composing || !parts.length) return '';
            const w = T9_SYLLABLE_INDEX.w || {};
            const out = [];
            parts.forEach(part => {
                let i = 0;
                while (i < part.length) {
                    // 已选汉字（连续造词的 preedit 前缀）原样保留，读音只
                    // 对拼写段重建（codex round-2 P2-2）。
                    if (!/[a-z2-9]/.test(part.charAt(i))) {
                        let j = i + 1;
                        while (j < part.length && !/[a-z2-9]/.test(part.charAt(j))) j++;
                        out.push(part.slice(i, j));
                        i = j;
                        continue;
                    }
                    let best = null;
                    this.t9SegmentSyllables(part.slice(i)).full.forEach(s => {
                        if (!best || s.length > best.length ||
                            (s.length === best.length && (w[s] || 0) > (w[best] || 0))) {
                            best = s;
                        }
                    });
                    if (!best) { out.push(part.slice(i)); break; }
                    out.push(best);
                    i += best.length;
                }
            });
            return out.join("'");
        }

        /** 左列双态：空闲=常用字符（中文标点，sendSymbol 直上屏）；组合中=
            拼音音节候选（完整音节可点重写组合，声母前缀置灰提示）。
            内容签名不变不重建——滚动位置在竖拖时不被引擎事件打断。 */
        renderT9Side() {
            const strip = document.getElementById('t9Strip');
            if (!strip || (this.mode !== 't9' && this.mode !== 'stroke')) return;
            if (this.mode === 'stroke') {
                // 笔画左列（issue #18）：常用字符恒定——笔画无音节枚举
                // 语义，组合中不变。
                if (this.t9SideSig === 'sym') return;
                this.t9SideSig = 'sym';
                strip.replaceChildren();
                T9_SIDE_CHARS.forEach(char => strip.append(this.t9SideCell(char)));
                return;
            }
            const seg = this.composing ? this.t9PendingSegment() : '';
            const sig = this.composing && seg ? `syl:${seg}` : 'sym';
            if (sig === this.t9SideSig) return;
            this.t9SideSig = sig;
            strip.replaceChildren();
            if (sig === 'sym') {
                T9_SIDE_CHARS.forEach(char => strip.append(this.t9SideCell(char)));
                return;
            }
            const { full, pre } = this.t9SegmentSyllables(seg);
            full.forEach(syllable => {
                const cell = this.t9SideCell(syllable,
                    () => this.t9PickSyllable(syllable, seg));
                cell.classList.add('t9-syl-full');
                strip.append(cell);
            });
            pre.forEach(initial => {
                // 前缀格只做提示（「还没打完」），点按无动作。
                const cell = this.t9SideCell(initial, () => {});
                cell.classList.add('t9-syl-pre');
                strip.append(cell);
            });
        }

        t9SideCell(label, action) {
            const cell = document.createElement('button');
            cell.className = 't9-side-cell';
            cell.textContent = label;
            // 默认行为=字面上屏（常用字符）；音节格传自己的动作，
            // 前缀格传 no-op——避免默认上屏把拼音组合打断。
            cell.addEventListener('click', action || (() => this.sendSymbol(label)));
            return cell;
        }

        /** 点选音节：把未完成段重写为「选中音节 + 段内剩余」。混合串由
         * 引擎音节图原生切分（BridgeContract 对 T9 放行 2-9），复用双拼
         * 变体的原子 setComposition 通道。段前的已确认部分（含回显空格）
         * 原样保留。 */
        t9PickSyllable(syllable, seg) {
            // 重放期间的点选直接丢弃：switchToVariant 会早退，先挪边界
            // 会把确认段和实际组合错开（codex round-4 P2-5）。
            if (this.variantReplaying) return;
            const raw = (this.lastRawInput || '').replace(/ /g, '');
            const head = raw.slice(0, raw.length - seg.length);
            // 键盘侧确认边界 = 已确认前缀 + 本段选中音节（引擎回显的段
            // 空格只是切分猜测，不能当确认边界用）。文本锚定给退格失效
            // 判定用。
            this._t9ConfirmedText = head + syllable;
            this.t9ConfirmedLen = this._t9ConfirmedText.length;
            this.switchToVariant(this._t9ConfirmedText + seg.slice(syllable.length));
        }

        /** preedit 观感：字母段与数字段之间插窄空格（64426 → ni·426 观感），
         * 只改显示——lastRawInput 仍是无空格混合串。 */
        t9PreeditLabel(raw) {
            return (raw || '').replace(/([a-z]+)([2-9])/g, '$1 $2');
        }

        /** 1 键（点按/长按）：候选条展开西文/技术符号行（sendSymbol 直
         * 上屏）。长按（chrome=true）额外收起工具栏图标，仅保留最右的
         * × 供取消本次符号行——取消后工具栏原样恢复。 */
        /** 1 键符号行（用户定稿：单击即开）：候选栏展开西文/技术符号行，
         * 工具栏快捷按钮全部让位（含 mic），仅保留最右 × 供取消。点选
         * 符号或 × 都会关闭符号行并复原工具栏。语音进行中不开（mic 是
         * 停止入口）。 */
        t9SymbolBar() {
            if (this.composing || this.voiceState !== 'idle') return;
            this.t9SymBar = true;
            this.t9BarChrome = true;
            this.setToolbarYield(true);
            this.renderT9SymbolBar();
        }

        /** 工具栏让位开关（T9 符号行与中文联想共用）：整条语义——上栏
         * 的所有工具（含动态开关工具与 mic）全部收起，仅留 ×。不得逐 id
         * 枚举：动态工具曾被漏掉，联想让位时还挂着半条工具栏（真机翻
         * 车）。固定 chrome（setup）不在 TOOL_CATALOG，单列。 */
        setToolbarYield(active) {
            this.toolbarYield = active;
            ['setupButton', ...Object.values(TOOL_CATALOG)].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.hidden = active;
            });
            const clear = document.getElementById('composeClear');
            if (clear) clear.hidden = !active;
        }

        /** 撤掉符号行 chrome：工具栏图标复位、× 隐藏。联想等引擎事件
         * 也会走这条路（onAssoc 直调 renderCandidates，不经过
         * updateComposing——不恢复的话工具栏会一直空着，codex round-4
         * P2-3）；组合态例外，可见性由 updateComposing 统一管。 */
        t9RestoreBarChrome(composing) {
            this.t9SymBar = false;
            this.t9BarChrome = false;
            if (composing) return;
            this.setToolbarYield(false);
        }

        t9CloseSymbolBar() {
            this.t9RestoreBarChrome(false);
            this.renderCandidates(this.lastEngineState || {});
        }

        renderT9SymbolBar() {
            const bar = document.getElementById('candidates');
            bar.replaceChildren();
            T9_BAR_SYMBOLS.forEach(symbol => {
                const button = document.createElement('button');
                button.className = 'candidate';
                button.textContent = symbol;
                // 点选符号 = 上屏 + 关闭符号行并还原工具栏（用户定稿）。
                button.addEventListener('click', () => {
                    this.sendSymbol(symbol);
                    this.t9CloseSymbolBar();
                });
                button.addEventListener('mousedown', event => event.preventDefault());
                bar.append(button);
            });
        }

        cnEnKey() {
            const button = document.createElement('button');
            button.className = 'kb-key kb-special kb-wide-1_15';
            button.dataset.role = 'cnEn';
            button.id = 'modeToggle';
            // Tap flips the quick pair; long-press opens the full
            // mode menu (the old toolbar mode button is gone).
            button.dataset.lp = 'mode-menu';
            button.setAttribute('aria-label', t("切换键盘"));
            const main = document.createElement('span');
            main.className = 'cn-main';
            const sub = document.createElement('span');
            sub.className = 'cn-sub';
            button.append(main, sub);
            button.addEventListener('click', () => {
                // The tap that closes the long-press mode menu
                // must not ALSO flip the keyboard.
                if (button._suppressClick) {
                    button._suppressClick = false;
                    return;
                }
                this.toggleChineseEnglish();
            });
            this.bindTouch(button);
            return button;
        }

        enterKey(longPress = 'repeat') {
            const button = document.createElement('button');
            button.className = 'kb-key kb-special kb-wide-2_25';
            button.dataset.role = 'enter';
            button.id = 'enterKey';
            if (longPress) button.dataset.lp = longPress;
            button.setAttribute('aria-label', this.composing ? t("确定") : t("换行"));
            button.textContent = this.composing ? t("确定") : t("换行");
            button.addEventListener('click', () => {
                // T9/笔画组合中的确认键=提交高亮候选（用户定稿）。EnterRaw
                // 会 ESCAPE+把原始输入串原样上屏（RimeTextEngine）——笔画
                // 的组合串是 schema xlit 后的部件字形（一丨丿…），落进
                // 编辑器就是乱码，同样必须拦截。repeat 长按在 T9 关闭：
                // 确认后残留的 interval 点击会落进非组合分支连发换行。
                if ((this.mode === 't9' || this.mode === 'stroke') && this.composing) {
                    const candidate = (this.expandCandidates || []).find(item =>
                        !String(item.id).startsWith('alt:'));
                    if (candidate) {
                        this.choosePoolCandidate(candidate);
                        return;
                    }
                }
                this.call(() => Native.enter(this.token));
            });
            this.bindTouch(button);
            return button;
        }

        /** The saved pair alone determines the shortcut. A temporary mode
         * selected from the long-press menu returns to the first pair entry.
         * While a degrade fallback serves, the short press retries the
         * FAILED mode instead of toggling the pair (mode-fallback §2.3). */
        toggleChineseEnglish() {
            if (this.degrade && this.degrade.active && this.degrade.failedMode) {
                this.call(() => Native.selectMode(this.degrade.failedMode, this.token));
                return;
            }
            const pair = this.quickPair;
            const target = this.mode === pair[0] ? pair[1] : pair[0];
            // 快捷对里的 strictReady 模式不可用时不出击（codex 评审 P2：
            // 旧 APK 的 hello 不带 stroke 字段，直发 selectMode 只会被
            // 原生拒绝，切换键看起来坏了）。
            const targetConfig = MODES[target];
            if (targetConfig && targetConfig.engine && targetConfig.strictReady &&
                this.engineReady[target] !== true) {
                this.showToast(t("该键盘还在准备中"));
                return;
            }
            this.call(() => Native.selectMode(target, this.token));
        }

        row(indent = false) {
            const row = document.createElement('div');
            row.className = 'kb-row' + (indent ? ' kb-indent' : '');
            return row;
        }

        letterKey(key) {
            const button = document.createElement('button');
            button.className = 'kb-key kb-letter';
            button.dataset.key = key;
            button.dataset.lp = 'popup';
            button.innerHTML = '<span class="kb-alt"></span><span class="kb-main"></span>';
            button.querySelector('.kb-alt').textContent = this.keyAltHint(key);
            button.addEventListener('click', () => this.sendKey(key));
            this.bindTouch(button);
            return button;
        }

        functionKey(label, action, classes = '', longPress = '') {
            const button = document.createElement('button');
            button.className = 'kb-key ' + classes;
            button.textContent = label;
            if (longPress) button.dataset.lp = longPress;
            button.addEventListener('click', action);
            this.bindTouch(button);
            return button;
        }

        // icon-bearing special key with a stable data-role for
        // structure-based assertions (text content is empty for icon keys).
        specialKey(role, icon, action, classes = '', longPress = '') {
            const button = document.createElement('button');
            button.className = 'kb-key ' + classes;
            button.dataset.role = role;
            if (typeof icon === 'string') {
                button.textContent = icon;
            } else {
                button.append(icon.cloneNode(true));
            }
            if (longPress) button.dataset.lp = longPress;
            button.addEventListener('click', action);
            this.bindTouch(button);
            return button;
        }

        spaceKey() {
            // The space key shows only a mic
            // glyph - the active mode's shorthand lives on the toggle key.
            // Plain key-cap colour, not the special grey -
            // the reference keeps the space bar in the normal key style.
            const button = document.createElement('button');
            button.className = 'kb-key kb-wide-4';
            button.id = 'spaceKey';
            // 长按空格拉起语音浮层（design §1.2）：右上角圆点标识可长按。
            button.dataset.lp = 'voice-hold';
            button.setAttribute('aria-label', t("空格"));
            const mic = document.createElementNS(SVG_NS, 'svg');
            mic.setAttribute('viewBox', '0 0 24 24');
            mic.setAttribute('class', 'space-mic');
            mic.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', ICON_PATHS.mic);
            path.setAttribute('fill', 'currentColor');
            mic.append(path);
            button.append(mic);
            button.addEventListener('click', () => {
                // While composing, space must confirm the TOP
                // candidate. Native space confirms the highlight, which sits
                // on whatever page the bar/grid preloading dragged the cursor
                // to (nihao + preload -> space committed a page-3 word).
                // Choosing the pool head by id decouples it from paging.
                const candidate = (this.expandCandidates || []).find(item =>
                    !String(item.id).startsWith('alt:'));
                if (this.composing && candidate) {
                    this.choosePoolCandidate(candidate);
                    return;
                }
                this.call(() => Native.space(this.token));
            });
            this.bindSpaceHold(button);
            this.bindTouch(button, { skipClick: true });
            return button;
        }

        bindSpaceHold(button) {
            // 上滑撤销（长按空格的浮层没有按钮）：上滑途中浮层随进度
            // 变小变透明、「上滑撤销」变明显；过阈值松手=撤销，否则
            // 松手就上屏。
            const SLIDE_CANCEL_PX = 110;
            let startY = 0;
            let slideProgress = 0;
            button._cancelSpaceHold = () => {
                clearTimeout(this.spaceHoldTimer);
                if (this.voiceHold) {
                    this.voiceHold = false;
                    this.resetSlideCancel();
                    this.requestVoiceStop(true);
                }
            };
            const start = event => {
                event.preventDefault();
                button.classList.add('active-touch');
                startY = event.touches[0].clientY;
                slideProgress = 0;
                if (!this.ready || !this.token) return;
                this.spaceHoldTimer = setTimeout(() => {
                    this.voiceHold = true;
                    this.voiceSession = 'space-hold';
                    Native.startVoice(this.token);
                }, 350);
            };
            const move = event => {
                if (!this.voiceHold) return;
                const dy = startY - event.touches[0].clientY;
                slideProgress = Math.max(0, Math.min(1, dy / SLIDE_CANCEL_PX));
                this.updateSlideCancel(slideProgress);
            };
            const finish = cancelled => {
                if (!this.pressedKeys.has(button)) return;
                button.classList.remove('active-touch');
                clearTimeout(this.spaceHoldTimer);
                const armed = slideProgress >= 1;
                slideProgress = 0;
                this.resetSlideCancel();
                if (this.voiceHold) {
                    this.voiceHold = false;
                    // 松手就上屏；只有上滑过阈值才撤销。
                    this.requestVoiceStop(armed ? true : cancelled);
                    if (armed) this.showToast(t("已撤销本次听写"));
                } else if (!cancelled) {
                    // touchstart preventDefault suppresses synthetic clicks,
                    // so the tap must be delivered manually. T9 的 mic 有
                    // data-key：横滑 scrub 已被手势层消费，松手不再补发
                    // 空格（swiping 的复位是 setTimeout(0)，此处仍为 true）。
                    if (!this.swiping) button.click();
                }
            };
            button.addEventListener('touchstart', start, { passive: false });
            button.addEventListener('touchmove', move, { passive: true });
            button.addEventListener('touchend', () => finish(false));
            button.addEventListener('touchcancel', () => finish(true));
        }

        /** 上滑撤销的进度动画：浮层变小变透明；下方 toast 胶囊
         * 「上滑撤销」字体和背景同步放大（transform scale），过阈值 arm。 */
        updateSlideCancel(progress) {
            const card = document.getElementById('voiceCard');
            const hint = document.getElementById('voiceSlideHint');
            if (!card || !hint) return;
            card.style.transform =
                `translate(-50%, -50%) scale(${(1 - 0.22 * progress).toFixed(3)})`;
            card.style.opacity = (1 - 0.55 * progress).toFixed(3);
            hint.style.transform =
                `translateX(-50%) scale(${(0.85 + 0.45 * progress).toFixed(3)})`;
            hint.classList.toggle('arm', progress >= 1);
        }

        resetSlideCancel() {
            const card = document.getElementById('voiceCard');
            const hint = document.getElementById('voiceSlideHint');
            if (card) {
                card.style.transform = '';
                card.style.opacity = '';
            }
            if (hint) {
                hint.style.transform = '';
                hint.classList.remove('arm');
            }
        }

        /** 按键声音/触感（issue #5 问题 2）：开关在设置页、默认全关，
         * 原生按偏好决定发声/振动。走 call() 门闸：桥未就绪不发；
         * 旧 APK 无此通道时 typeof 守卫静默跳过。 */
        nativeKeyFeedback() {
            this.call(() => {
                if (typeof Native.keyFeedback === 'function') {
                    Native.keyFeedback(this.token);
                }
            });
        }

        bindTouch(button, options = {}) {
            if (!button) return; // Toolbar tools may not exist
            if (button.dataset.bound) return;
            button.dataset.bound = '1';
            let holdTimer = 0;
            let repeatTimer = 0;
            let longFired = false;
            const clear = () => { clearTimeout(holdTimer); clearInterval(repeatTimer); holdTimer = repeatTimer = 0; };
            // Review: the flick layer cancels pending repeats when
            // a swipe takes over the gesture (the finger may stay on the key).
            button._cancelRepeat = clear;
            button._cancelPress = () => {
                clear();
                button._suppressClick = false;
                if (button._cancelSpaceHold) button._cancelSpaceHold();
            };
            button.addEventListener('touchstart', event => {
                event.preventDefault();
                this.pressedKeys.add(button);
                button.classList.add('active-touch');
                this.nativeKeyFeedback();
                longFired = false;
                const touch = event.changedTouches[0];
                if (!this.touchOrigin) {
                    this.touchOrigin = { x: touch.clientX, y: touch.clientY,
                        id: touch.identifier, button };
                }
                if (button.dataset.lp === 'repeat') {
                    holdTimer = setTimeout(() => { repeatTimer = setInterval(() => button.click(), 75); }, this.holdMs + 40);
                } else if (button.dataset.lp === 'popup' && button.dataset.key) {
                    holdTimer = setTimeout(() => {
                        if (this.swiping) return;
                        // T9：长按=数字+字母组全后选（引擎通道）；1 键=
                        // 符号行并收起工具栏；qwerty 维持 accent 备选弹层。
                        if (this.mode === 't9') {
                            // 1 键没有长按态（单击即开符号行，用户定稿）；
                            // 其余数字键长按=数字+字母组全后选浮层。
                            this.openT9HoldPopup(button);
                        } else if (this.mode === 'stroke') {
                            // 笔画：三格浮层（符号·数字·符号）。7 键（符号
                            // 组）不设 data-lp，不会走到这里。
                            this.openStrokeHoldPopup(button);
                        } else this.openPopup(button);
                    }, this.holdMs);
                } else if (button.dataset.lp === 'lock') {
                    holdTimer = setTimeout(() => {
                        if (!this.swiping) { longFired = true; this.lockShift(); }
                    }, this.holdMs);
                } else if (button.dataset.lp === 'mode-menu') {
                    // Long-press the toggle for the full keyboard mode list
                    // (the system IME picker replaced there; the
                    // system picker stays in the full settings UI).
                    holdTimer = setTimeout(() => {
                        longFired = true;
                        this.toggleModeMenu();
                    }, this.holdMs);
                } else if (button.dataset.lp === 'numpad') {
                    // Long-press 123 opens the nine-pad; the plain tap
                    // still opens the symbol layer (fired on touchend).
                    holdTimer = setTimeout(() => {
                        if (!this.swiping) { longFired = true; this.showNumpad(); }
                    }, this.holdMs);
                }
            }, { passive: false });
            // A finger that slides off the key cancels the
            // pending long-press/repeat (the press never becomes a popup or
            // auto-repeat while over some other key).
            button.addEventListener('touchmove', event => {
                const touch = event.touches[0];
                const at = document.elementFromPoint && document.elementFromPoint(touch.clientX, touch.clientY);
                if (at !== button && !(at && button.contains(at))) clear();
            }, { passive: true });
            button.addEventListener('touchend', event => {
                event.preventDefault();
                if (!this.pressedKeys.has(button)) return;
                this.pressedKeys.delete(button);
                button.classList.remove('active-touch');
                clear();
                if (this.popup) {
                    // 快速甩出时最终位置只出现在 changedTouches：相对跟手
                    // 收尾先刷新一次选中再提交，否则按旧高亮落错格
                    // （codex P2）。split 弹层保持既有语义不动。
                    if (this.popup.relative) {
                        const last = event.changedTouches && event.changedTouches[0];
                        if (last) this.movePopup(last);
                    }
                    this.closePopup(false);
                }
                else if (!longFired && !this.swiping && !options.skipClick) button.click();
            }, { passive: false });
            button.addEventListener('touchcancel', () => {
                this.pressedKeys.delete(button);
                button.classList.remove('active-touch');
                clear();
                if (this.popup) this.closePopup(true);
                // Review P3: a cancelled gesture never delivers the click
                // that would consume _suppressClick  -
                // clear it or the key's NEXT tap is swallowed.
                button._suppressClick = false;
            });
        }

        cancelTouches() {
            for (const button of this.pressedKeys) {
                button.classList.remove('active-touch');
                if (button._cancelPress) button._cancelPress();
                clearTimeout(button._comboTimer);
            }
            this.pressedKeys.clear();
            if (this.popup) this.closePopup(true);
            this.touchOrigin = null;
            this.scrubBase = null;
            this.scrubSteps = 0;
            this.swiping = false;
        }

        setupFlick(root) {
            const threshold = 38;
            // Scrub tuning: recognition slop; caret steps are
            // SCRUB_UNIT_PX each, counted from the fixed threshold crossing.
            root.addEventListener('touchmove', event => {
                if (this.popup) {
                    event.preventDefault();
                    this.movePopup(event.touches[0]);
                    return;
                }
                // The expanded candidate strip owns horizontal drags: a swipe
                // there must scroll the strip, not move the cursor (and a
                // preventDefault here would cancel that scroll entirely).
                // Same for the collapsed candidate BAR - swiping it
                // scrolls the strip instead of starting a flick/scrub, so the
                // extra pages stay reachable without tapping the arrows.
                if (event.target && event.target.closest &&
                    (event.target.closest('#expandLayer') ||
                     event.target.closest('#candidates'))) return;
                if (!this.touchOrigin) return;
                const touch = Array.from(event.touches).find(item => item.identifier === this.touchOrigin.id);
                if (!touch) return;
                const dx = touch.clientX - this.touchOrigin.x;
                const dy = touch.clientY - this.touchOrigin.y;
                const originButton = this.touchOrigin.button;
                const button = originButton.closest('.kb-key[data-key]');
                if (!this.swiping) {
                    // Flick/scrub recognition: the slop threshold gates the
                    // gesture start only - once swiping, the scrub below must
                    // keep tracking even when the finger crosses back over
                    // the origin (that is exactly how direction reverses).
                    if (Math.hypot(dx, dy) < threshold) return;
                    this.swiping = true;
                    // 滑动接管手势：只撤「挂起的」语音长按计时器（T9 mic
                    // 横滑 scrub 按住不放，350ms 计时器若不撤，光标移动
                    // 中途会拉起语音浮层）。已激活的语音会话不动——上滑
                    // 撤销是 bindSpaceHold 自己的手势，这里抢了会破坏它。
                    clearTimeout(this.spaceHoldTimer);
                    // A LEFT swipe on the backspace key aborts the
                    // whole live composition (pinyin preedit...) in one go -
                    // repeat-tapping it down letter by letter is the old way.
                    // Swipes while idle do nothing (the click stays suppressed
                    // by this.swiping, so no stray delete either). The pending
                    // hold/repeat timers die with the swipe: the finger may
                    // still be ON the key (elementFromPoint never left it) and
                    // a late repeat would eat COMMITTED text .
                    const bsKey = originButton.closest('.kb-key[data-role="backspace"]');
                    if (Math.abs(dx) > Math.abs(dy) && dx < 0 && bsKey) {
                        if (bsKey._cancelRepeat) bsKey._cancelRepeat();
                        if (this.composing) this.clearComposing();
                        return;
                    }
                    // T9 手势仲裁（t9.md §3）：字母键四向=引擎字母/字面
                    // 数字，mic 独占 scrub。false=落回通用分支（mic 横滑）。
                    // 笔画同走这里（只保留上滑=字面数字）。
                    if ((this.mode === 't9' || this.mode === 'stroke') &&
                        this.t9Flick(originButton, dx, dy)) return;
                    if (Math.abs(dy) >= Math.abs(dx) && button && button.dataset.key) {
                        const key = button.dataset.key;
                        // Chinese-mode punct slot : the main glyph is
                        // 。so a tap/down-flick commits it; up commits the
                        // alt ，- both via the engine punctuator (ASCII '.'
                        // / ','), so the gestures match the printed glyphs.
                        let value;
                        if (key === '.' && this.isChineseMode()) {
                            // Main ，(tap, down) / alt 。(up);
                            // both keep flowing through the engine punctuator
                            // (Native.key) - full-width directly would be
                            // dropped unprocessed.
                            value = dy < 0 ? '.' : ',';
                        } else {
                            // CN_ALTS values are the final
                            // glyphs - committed as-is (commitText); the old
                            // FULLWIDTH widening map is gone.
                            value = dy < 0 ? this.altCandidates(key)[0] : key.toUpperCase();
                        }
                        if (value) {
                            // In Chinese modes a flicked digit/symbol
                            // or uppercase letter must LAND in the editor -
                            // Native.key() would feed the composition engine
                            // (digits become candidate selectors, uppercase
                            // becomes dead pinyin). commitText bypasses it.
                            if (this.isChineseMode() && key !== '.') {
                                this.sendSymbol(value);
                            } else {
                                this.sendText(value);
                            }
                            // Direction-only blob, no character.
                            this.showFlick(button, dy);
                        }
                    } else if (Math.abs(dx) > Math.abs(dy) && button && !this.composing
                        && !this.voiceHold) {
                        // Scrub only starts ON a letter key: horizontal drags
                        // that begin on the panel/symbol grid scroll those
                        // layers instead of moving the caret. While a pinyin
                        // composition is live the caret belongs to the
                        // composing span - moving it just makes the next
                        // setComposingText snap it back (jumpy).
// engage: keep the recognition slop out
                        // of the first step, but derive the anchor from the
                        // fixed threshold crossing rather than this sample.
                        // Slow and fast event sampling then produce the same
                        // endpoint. The first crossing still emits exactly one
                        // step for the established light-swipe feel.
                        const unit = SCRUB_UNIT_BASE_PX / this.scrubSpeed;
                        const direction = dx > 0 ? 1 : -1;
                        const distance = Math.hypot(dx, dy) || threshold;
                        const crossingX = this.touchOrigin.x + (dx / distance) * threshold;
                        this.scrubBase = crossingX - direction * unit;
                        this.scrubSteps = direction;
                        this.call(() => Native.moveCursor(direction, this.token));
                    }
                } else if (this.scrubBase !== null) {
                    this.applyScrub(touch.clientX);
                }
            }, { passive: false, capture: true });
            const finish = (event, cancelled) => {
                const origin = this.touchOrigin;
                if (origin && !Array.from(event.changedTouches || []).some(
                    touch => touch.identifier === origin.id)) return;
                // A real touchend carries the final changedTouch position. Apply
                // it before clearing the anchor so a last partial unit is not
                // lost. touchcancel deliberately leaves the caret unchanged.
                if (!cancelled && origin && this.scrubBase !== null) {
                    const touch = Array.from(event.changedTouches || []).find(
                        item => item.identifier === origin.id);
                    if (touch) this.applyScrub(touch.clientX);
                }
                this.touchOrigin = null;
                this.scrubBase = null;
                this.scrubSteps = 0;
                setTimeout(() => { this.swiping = false; }, 0);
            };
            root.addEventListener('touchend', event => finish(event, false), { capture: true });
            root.addEventListener('touchcancel', event => finish(event, true), { capture: true });
        }

        /** Continuous scrub: crossing a unit boundary moves the caret by the
         * exact number of crossed steps, so fast drags jump multiple cells
         * and direction flips at the fixed threshold anchor automatically.
         * Unit scales with the user's speed setting: 36px per step at 1x down
         * to 7.2px at 5x (3x keeps the shipped 12px feel). */
        applyScrub(clientX) {
            const unit = SCRUB_UNIT_BASE_PX / this.scrubSpeed;
            const steps = Math.trunc((clientX - this.scrubBase) / unit);
            if (steps === this.scrubSteps) return;
            const delta = steps - this.scrubSteps;
            this.scrubSteps = steps;
            // One bridge call carries the crossed steps. Splitting only at
            // the native bound preserves every step without a burst of
            // single-step calls being lost to the bridge rate limiter.
            let remaining = delta;
            while (remaining) {
                const move = Math.max(-256, Math.min(256, remaining));
                this.call(() => Native.moveCursor(move, this.token));
                remaining -= move;
            }
        }

        /** T9 手势仲裁（t9.md §3）。返回 true=已消费；false=落回通用
         * 分支（mic 的横滑 scrub 由通用代码处理——scrub 选择器认
         * .kb-key[data-key]，mic 在 T9 下挂 data-key=0）。 */
        t9Flick(originButton, dx, dy) {
            const button = originButton && originButton.closest('.kb-key[data-key]');
            if (!button) return false;
            const vertical = Math.abs(dy) >= Math.abs(dx);
            if (button.id === 'spaceKey') {
                // 语音会话进行中：手势归 bindSpaceHold（上滑撤销听写），
                // T9 的字面 0 消歧不再抢道——否则撤销会先落一个 0
                // （codex round-3 P2）。
                if (this.voiceHold) return true;
                if (!vertical) return false;
                if (dy < 0) {
                    // 上滑=字面 0（右上角标提示）。
                    this.sendSymbol('0');
                    this.showFlick(button, dy, dx);
                }
                return true;
            }
            const key = button.dataset.key;
            // 笔画（issue #18）：数字键只保留上滑=字面数字（sendSymbol
            // 旁路——进引擎会成为候选选择器，字面数字上不了屏）；其余
            // 方向无语义，返回 true 吞掉，不落回通用分支把 CN_ALTS 符号
            // /大写发出去。空格（0）已被上面的 spaceKey 分支处理。
            if (this.mode === 'stroke') {
                if (/^[1-9]$/.test(key)) {
                    if (vertical && dy < 0) {
                        this.sendSymbol(key);
                        this.showFlick(button, dy, dx);
                    }
                    return true;
                }
                return false;
            }
            // 1 键（@#.）：上滑=字面 1；下滑/横滑无语义（符号行走点按/长按）。
            if (this.mode === 't9' && key === '1') {
                if (vertical && dy < 0) {
                    this.sendSymbol('1');
                    this.showFlick(button, dy, dx);
                }
                return true;
            }
            if (this.mode !== 't9' || !/^[2-9]$/.test(key)) return false;
            const letters = (LAYOUTS.t9.alts[key] || '').split('');
            if (vertical) {
                if (dy < 0) {
                    // 上滑=字面数字，commitText 旁路（进引擎会成为
                    // 候选选择器，字面数字永远上不了屏）。
                    this.sendSymbol(key);
                } else if (T9_SPLIT[key]) {
                    // 7/9 下滑=拆分浮层：下左/下右继续滑选 q/r、x/y。
                    // initialX=越过阈值那一刻的手指 x——直接松手也按
                    // 半边判定选中，不再固定预选首格（codex round-3 P2）。
                    this.openT9Popup(button, T9_SPLIT[key], {
                        split: true,
                        initialX: this.touchOrigin ? this.touchOrigin.x + dx : null,
                    });
                } else {
                    // 下滑=中间字母进引擎（确认拼写，非 commitText）。
                    this.sendText(letters[Math.floor((letters.length - 1) / 2)]);
                }
            } else {
                // 横滑=首/尾字母进引擎。
                this.sendText(dx < 0 ? letters[0] : letters[letters.length - 1]);
            }
            this.showFlick(button, dy, dx);
            return true;
        }

        altCandidates(key) {
            // Chinese modes print their own symbol set.
            if (this.isChineseMode() && CN_ALTS[key]) return [CN_ALTS[key]];
            const layout = LAYOUTS[(MODES[this.mode] || MODES.direct).layout] || LAYOUTS.qwerty;
            // t9 的字母组（abc/def…）只是键面提示，整段不是可上屏字符
            // （codex round-1 P2-3：上滑 2 曾把字面 'abc' 提交出去）。
            if (layout.hintsOnly) return [];
            const value = layout.alts[key];
            if (!value) return [];
            return Array.isArray(value) ? value : [value];
        }

        /** 键面角标显示：hintsOnly 布局（t9）也要画出字母组，但走的是
         * 展示语义，与 altCandidates 的可上屏备选分开。 */
        keyAltHint(key) {
            if (this.isChineseMode() && CN_ALTS[key]) return CN_ALTS[key];
            const layout = LAYOUTS[(MODES[this.mode] || MODES.direct).layout] || LAYOUTS.qwerty;
            const value = layout.alts[key];
            if (!value) return '';
            return Array.isArray(value) ? value[0] : value;
        }

        /** 长按全后选：数字 + 字母组逐个（4 → [4 g h i]）。 */
        /** T9 长按（issue #9）：三行弹层——上行=字母组小写、中行=左符号
         * ·数字·右符号、下行=大写。字母与符号都是 literal 直上屏
         * （commitText，大小写原样落）；数字格=通配，进引擎（与点按
         * 同义）。拼音里确认字母由下滑/横滑手势承担，不经弹层。 */
        openT9HoldPopup(button) {
            const key = button.dataset.key;
            const letters = (LAYOUTS.t9.alts[key] || '').split('');
            const syms = LAYOUTS.t9.keySymbols[key] || [];
            const cells = [
                ...letters.map(ch => ({ char: ch, literal: true })),
                { char: syms[0], literal: true },
                { char: key },
                { char: syms[1], literal: true },
                ...letters.map(ch => ({ char: ch.toUpperCase(), literal: true })),
            ].filter(cell => cell.char);
            this.openT9Popup(button, cells, { grid: true });
        }

        /** 笔画长按（issue #18，用户定稿 2026-09-19）：与 T9 同款三排——
         * 小写字母组 / 左符号 · 数字 · 右符号 / 大写字母组。字母组沿用
         * T9 的数字键位分配（2=abc…9=wxyz，拨号键盘肌肉记忆），上屏规
         * 则同 T9：字母（含大写）与符号 literal 直上屏（commitText），中
         * 格数字=点按同义（发部件编码，send 字段），预选中格、相对跟手。
         * 1 键无字母组：退回单排 符号·数字·符号。 */
        openStrokeHoldPopup(button) {
            const key = button.dataset.key;
            const def = STROKE_KEYS[key] || {};
            const syms = def.syms || [];
            const letters = (LAYOUTS.t9.alts[key] || '').split('');
            const middle = [
                { char: syms[0], literal: true },
                { char: key, send: def.code },
                { char: syms[1], literal: true },
            ].filter(cell => cell.char);
            const cells = letters.length
                ? [...letters.map(ch => ({ char: ch, literal: true })),
                   ...middle,
                   ...letters.map(ch => ({ char: ch.toUpperCase(), literal: true }))]
                : middle;
            this.openT9Popup(button, cells, letters.length ? { grid: true } : { middle: true });
        }

        /** T9 浮层：长按=三行大小写+符号弹层（opts.grid）；7/9 下滑=拆分
         * 字母（opts.split：按触点 x 半边判定下左/下右，不按格子距离——
         * 拖动方向与浮层位置相反，距离命中会立刻取消）。格子默认走引擎
         * 通道（enginePath → sendText），literal 格直上屏（commitText）。
         */
        openT9Popup(button, cells, opts = {}) {
            const popup = document.getElementById('keyPopup');
            const inner = document.getElementById('keyPopupInner');
            inner.classList.add(opts.grid ? 't9-grid3' : 't9-row');
            inner.replaceChildren();
            const defs = cells.map(cell => (typeof cell === 'object' ? cell : { char: cell }));
            const makeItem = def => {
                const item = document.createElement('div');
                item.className = 'kp-item';
                item.textContent = def.char;
                // send：显示字符与提交值分离（笔画中格显示数字、发部件
                // 编码）；缺省提交显示字符本身。
                return { item, char: def.char, send: def.send, literal: !!def.literal, cx: 0, cy: 0 };
            };
            const items = [];
            if (opts.grid) {
                // 三行各占一行容器：行内居中（符号行 3 格窄于字母行也能
                // 对齐中轴），最近中心选格只认 cx/cy，DOM 层级无关。
                const per = (defs.length - 3) / 2;
                [defs.slice(0, per), defs.slice(per, per + 3), defs.slice(per + 3)]
                    .forEach(group => {
                        const row = document.createElement('div');
                        row.className = 'kp-row';
                        group.forEach(def => {
                            const cell = makeItem(def);
                            row.append(cell.item);
                            items.push(cell);
                        });
                        inner.append(row);
                    });
            } else {
                defs.forEach(def => {
                    const cell = makeItem(def);
                    inner.append(cell.item);
                    items.push(cell);
                });
            }
            popup.classList.add('open');
            const rect = button.getBoundingClientRect();
            const left = Math.max(4, Math.min(innerWidth - popup.offsetWidth - 4,
                rect.left + rect.width / 2 - popup.offsetWidth / 2));
            popup.style.left = left + 'px';
            popup.style.top = Math.max(2, rect.top - popup.offsetHeight - 6) + 'px';
            items.forEach(cell => {
                const r = cell.item.getBoundingClientRect();
                cell.cx = r.left + r.width / 2;
                cell.cy = r.top + r.height / 2;
            });
            // 预选=数字格（与点按同义）：不拖直接松手不改变输入。三行
            // 弹层中点恰是数字格；单行/拆分浮层保持首格预选，拆分按
            // initialX 半边判定（松手不再产生 move 也选对格，codex round-3 P2）。
            let selected;
            if (opts.split && typeof opts.initialX === 'number') {
                const mid = (items[0].cx + items[1].cx) / 2;
                selected = opts.initialX < mid ? items[0] : items[1];
            } else if (opts.grid || opts.middle) {
                selected = items[Math.floor(items.length / 2)];
            } else {
                selected = items[0];
            }
            selected.item.classList.add('sel');
            this.popup = { key: button.dataset.key, cells: items,
                selected, cancelled: false, enginePath: true };
            if (opts.split) this.popup.split = true;
            if (opts.grid || opts.middle) this.attachRelativeTracking(popup, selected);
        }

        /** 相对跟手选中（issue #9 定稿，qwerty accent 弹层同款）：高亮锚在
         * 预选格上，跟随手指「相对按下点」的位移同步移动——手指全程不必
         * 碰到浮层；虚拟光标滑出卡片边界 = 淡出 + 「松手撤销」，拖回恢复。
         * origin 拷贝自按下点：capture 收尾会清 touchOrigin，弹层必须自带
         * 位移基准。 */
        attachRelativeTracking(popup, anchor) {
            this.popup.relative = true;
            this.popup.anchor = anchor;
            this.popup.origin = this.touchOrigin
                ? { x: this.touchOrigin.x, y: this.touchOrigin.y } : null;
            const card = popup.getBoundingClientRect();
            this.popup.cardRect = {
                left: card.left, top: card.top,
                right: card.right, bottom: card.bottom,
            };
        }

        openPopup(button) {
            const key = button.dataset.key;
            const upper = key.toUpperCase();
            // letter alternates must offer their uppercase forms too
            // (e.g. Russian ё → Ё), not just the base key.
            const chars = [
                ...this.altCandidates(key).flatMap(char =>
                    /^\p{L}$/u.test(char) && char === char.toLowerCase()
                        ? [char, char.toUpperCase()] : [char]),
                upper,
                key,
            ].filter((v, i, all) => all.indexOf(v) === i);
            const popup = document.getElementById('keyPopup');
            const inner = document.getElementById('keyPopupInner');
            inner.replaceChildren();
            const cells = chars.map(char => {
                const item = document.createElement('div');
                item.className = 'kp-item';
                // Chinese mode prints full-width glyphs for the punct-slot
                // cells; the commit value stays ASCII and closePopup routes
                // it through the engine so the printed glyph is what lands.
                const glyph = this.isChineseMode() && (char === ',' || char === '.')
                    ? (char === ',' ? '，' : '。')
                    : char;
                item.textContent = glyph;
                inner.append(item);
                return { item, char, cx: 0, cy: 0 };
            });
            popup.classList.add('open');
            const rect = button.getBoundingClientRect();
            const left = Math.max(4, Math.min(innerWidth - popup.offsetWidth - 4, rect.left + rect.width / 2 - popup.offsetWidth / 2));
            popup.style.left = left + 'px';
            popup.style.top = Math.max(2, rect.top - popup.offsetHeight - 6) + 'px';
            cells.forEach(cell => {
                const r = cell.item.getBoundingClientRect();
                cell.cx = r.left + r.width / 2;
                cell.cy = r.top + r.height / 2;
            });
            const selected = cells.find(cell => cell.char === upper) || cells[0];
            selected.item.classList.add('sel');
            this.popup = { key, cells, selected, cancelled: false };
            // qwerty accent 弹层与 T9 三行弹层同一套相对跟手（用户定稿）：
            // 高亮跟随手指位移，不要求手先滑上浮层。
            this.attachRelativeTracking(popup, selected);
        }

        /** 「松手撤销」提示（issue #9）：弹层滑出卡片边界时浮层淡出，
         *  这条 toast 把状态说破——固定挂在浮层上方中线，不跟手；
         *  拖回卡片内自动恢复。 */
        showPopupCancelTip(show) {
            const tip = document.getElementById('keyPopupCancelTip');
            const popup = document.getElementById('keyPopup');
            if (!tip || !popup) return;
            if (!show) { tip.classList.remove('show'); return; }
            tip.textContent = t("松手撤销");
            // 卡片矩形取一次即可：toast 固定在浮层上方中线，不跟手。
            const card = popup.getBoundingClientRect();
            tip.style.left = (card.left + card.width / 2) + 'px';
            tip.style.top = Math.max(2, card.top - 30) + 'px';
            tip.classList.add('show');
        }

        movePopup(touch) {
            if (!this.popup) return;
            // 拆分浮层（T9 7/9 下滑）：下左/下右按两格中点判定，
            // 不做距离取消——下滑开层后继续向左下/右下即选中。
            if (this.popup.split) {
                const mid = (this.popup.cells[0].cx + this.popup.cells[1].cx) / 2;
                const sel = touch.clientX < mid
                    ? this.popup.cells[0] : this.popup.cells[1];
                this.popup.cancelled = false;
                this.popup.selected = sel;
                this.showPopupCancelTip(false);
                this.popup.cells.forEach(cell =>
                    cell.item.classList.toggle('sel', cell === sel));
                return;
            }
            // 相对跟手（issue #9 定稿，T9 三行与 qwerty accent 弹层共用）。
            // 高亮锚在预选格上，跟随手指位移同步移动——手往左滑高亮往左、
            // 往下滑高亮往下滑，和手指位置是相对关系，手指全程不必碰到
            // 浮层。虚拟光标（锚点+位移）滑出卡片 → 淡出 + 「松手撤销」，
            // 拖回恢复。
            const inner = document.getElementById('keyPopupInner');
            const anchor = this.popup.anchor;
            const r = this.popup.cardRect;
            const origin = this.popup.origin || this.touchOrigin ||
                { x: anchor.cx, y: anchor.cy };
            const dx = touch.clientX - origin.x;
            const dy = touch.clientY - origin.y;
            // 手感档（松 1.4x / 标准 1.0x / 紧 0.7x）缩放抖动死区与卡片
            // 边界容差：松=更难误取消，紧=更快撤销。选格本身始终按
            // 最近格心判定。
            const scale = [1.4, 1, 0.7][this.popupSnap] || 1;
            const DEAD = Math.round(12 * scale);
            const SLOP = Math.round(6 * scale);
            // 按点死区内的微动不动高亮（吃手指抖动，松手仍落预选格）。
            if (!this.popup.tracking) {
                if (Math.hypot(dx, dy) <= DEAD) return;
                this.popup.tracking = true;
            }
            const vx = anchor.cx + dx;
            const vy = anchor.cy + dy;
            const inside = vx >= r.left - SLOP && vx <= r.right + SLOP &&
                vy >= r.top - SLOP && vy <= r.bottom + SLOP;
            if (!inside) {
                if (!this.popup.cancelled) {
                    this.popup.cancelled = true;
                    this.popup.selected = null;
                    this.popup.cells.forEach(cell => cell.item.classList.remove('sel'));
                    inner.style.transform = 'scale(0.92)';
                    inner.style.opacity = '0.5';
                    this.showPopupCancelTip(true);
                }
                return;
            }
            if (this.popup.cancelled) {
                this.popup.cancelled = false;
                inner.style.transform = '';
                inner.style.opacity = '';
                this.showPopupCancelTip(false);
            }
            let selected = this.popup.cells[0];
            let best = Infinity;
            this.popup.cells.forEach(cell => {
                const d = Math.hypot(vx - cell.cx, vy - cell.cy);
                if (d < best) { best = d; selected = cell; }
            });
            this.popup.cells.forEach(cell =>
                cell.item.classList.toggle('sel', cell === selected));
            this.popup.selected = selected;
        }

        closePopup(cancel) {
            const popup = this.popup;
            this.popup = null;
            const inner = document.getElementById('keyPopupInner');
            inner.style.transform = '';
            inner.style.opacity = '';
            inner.classList.remove('t9-row', 't9-grid3');
            document.getElementById('keyPopup').classList.remove('open');
            this.showPopupCancelTip(false);
            if (cancel || popup?.cancelled) return;
            // T9 弹层：literal 格（字母大小写 + 中行符号）直上屏，大小写
            // 原样落；数字格 = 通配进引擎（与点按同义）。拼音里确认字母
            // 由滑动手势承担，不经弹层。
            if (popup?.enginePath) {
                if (!popup.selected) return;
                if (popup.selected.literal) {
                    this.sendSymbol(popup.selected.char);
                } else if (this.mode === 'stroke' && popup.key !== '7') {
                    // 笔画中格=点按同义：走统一入口（通配/逗号守卫不被
                    // 长按绕过——codex 评审 P1）。7 键无弹层，防御性兜底。
                    this.strokeActivate(popup.key);
                } else {
                    this.sendText(popup.selected.send || popup.selected.char);
                }
                return;
            }
            // the reference parity (soft_keyboard.js closePopup): the pre-selected
            // cell is the uppercase form, so a release with no drag commits
            // that pre-selection - "original spot" only falls back to the
            // key's own character when the key-itself cell is the selected
            // one. Every live selection has a cell here, no extra fallback.
            // In Chinese modes the pick must LAND as typed -
            // Native.key() would feed it to the composition engine (" became
            // nothing, J/j opened a pinyin preedit). commitText bypasses it,
            // like flicks and the symbol grid.
            if (popup?.selected) {
                // Review P1: the punct slot prints ，/。so those are
                // what a pick must land - ASCII ,/. go through the engine
                // punctuator like a tap (full-width direct would be fine here,
                // but半角 landing would NOT); other Chinese picks commit
                // literally; English always goes native key.
                const char = popup.selected.char;
                if (this.isChineseMode() && (char === ',' || char === '.')) {
                    this.sendText(char);
                } else if (this.isChineseMode()) {
                    this.sendSymbol(char);
                } else {
                    this.sendText(char);
                }
            }
        }

        /** The flick feedback is a direction-only blob - a
         * viscous half-ellipse that peels OFF the key along the swipe and
         * fades fast. It must NOT preview the character (the character
         * actually lands; showing it read as a duplicate). */
        showFlick(button, dy, dx = 0) {
            const blob = document.getElementById('flickBlob');
            if (!blob) return;
            const rect = button.getBoundingClientRect();
            const size = Math.min(38, rect.width * 0.72);
            blob.style.left = (rect.left + rect.width / 2 - size / 2) + 'px';
            blob.style.top = (rect.top + rect.height / 2 - size / 2) + 'px';
            blob.style.width = size + 'px';
            blob.style.height = size + 'px';
            // 方向跟随手势轴：横滑（T9 首/尾字母）沿 X 剥离，竖滑沿 Y。
            const horizontal = Math.abs(dx) > Math.abs(dy);
            const dir = (horizontal ? dx : dy) < 0 ? -1 : 1;
            const axis = horizontal ? 'X' : 'Y';
            blob.classList.add('run');
            // WAAPI is assumed on real WebViews; without it the blob must not
            // stick around (the .run class would leave it painted forever).
            if (typeof blob.animate === 'function') {
                const anim = blob.animate([
                    { transform: 'scale(1.12, 0.55)', opacity: 0.5, filter: 'blur(1.5px)' },
                    { transform: `scale(1, 1) translate${axis}(${dir * 12}px)`, opacity: 0.38, filter: 'blur(2.5px)', offset: 0.45 },
                    { transform: `scale(0.82, 1.28) translate${axis}(${dir * 26}px)`, opacity: 0, filter: 'blur(5px)' },
                ], { duration: 250, easing: 'cubic-bezier(.2, .7, .3, 1)' });
                anim.onfinish = () => blob.classList.remove('run');
            } else {
                blob.classList.remove('run');
            }
        }

        toggleShift() {
            if (this.caps) this.caps = false;
            else this.shift = !this.shift;
            this.updateLabels();
        }

        lockShift() {
            this.caps = true;
            this.shift = false;
            this.updateLabels();
        }

        updateLabels() {
            // Pinyin keyboards show uppercase key glyphs
            // (candidates are what actually commit), direct shows lowercase.
            const chinese = this.mode === 'pinyin' || this.mode === 'double-pinyin';
            const upper = this.shift || this.caps;
            document.querySelectorAll('[data-key]').forEach(button => {
                const key = button.dataset.key;
                const main = button.querySelector('.kb-main');
                // T9 键（.t9-group 固定字形）与挂 data-key 的 mic 没有主字
                // span——键面固定，大小写切换不适用。
                if (!main) return;
                main.textContent = (chinese || upper) ? key.toUpperCase() : key;
            });
            // The slot's main glyph is ，(what a tap commits
            // via the punctuator) and the alt previews the flick-up 。.
            const punct = document.querySelector('[data-key="."] .kb-alt');
            if (punct) punct.textContent = chinese ? '。' : (this.altCandidates('.')[0] || '');
            const punctMain = document.querySelector('[data-key="."] .kb-main');
            if (punctMain) punctMain.textContent = chinese ? '，' : '.';
            // Chinese punctuation uses centered shapes (design §1.1).
            document.querySelector('[data-key="."]')?.classList.toggle('zh-punct', chinese);
            const shift = document.querySelector('.shift');
            shift?.classList.toggle('active', this.shift);
            shift?.classList.toggle('locked', this.caps);
            // Long-press lock shows the caps glyph (arrow + bar),
            // plain shift keeps the bare arrow (class/icon change,
            // never a different button).
            if (shift && shift.querySelector('svg path')) {
                shift.querySelector('svg path').setAttribute('d', this.caps ? ICON_PATHS.caps : ICON_PATHS.shift);
            }
            this.updateToggleLabels();
            this.updateEnterLabel();
            // An armed Fn relabels the twelve F-keys last.
            this.renderFnLabels();
        }

        updateToggleLabels() {
            // The toggle carries mode shorthands - current big, the
            // quick-pair partner small in the lower-right corner.
            // The small label previews the target from the saved pair.
            const toggle = document.getElementById('modeToggle');
            if (!toggle) return;
            const pair = this.quickPair;
            const target = this.mode === pair[0] ? pair[1] : pair[0];
            toggle.querySelector('.cn-main').textContent =
                modeLabel(this.mode);
            toggle.querySelector('.cn-sub').textContent =
                modeLabel(target);
        }

        updateEnterLabel() {
            const label = this.composing ? t("确定") : t("换行");
            const enter = document.getElementById('enterKey');
            if (enter) {
                enter.textContent = label;
                enter.setAttribute('aria-label', label);
            }
            // Symbol layer row 4 carries its own enter key .
            const symEnter = document.getElementById('symEnterKey');
            if (symEnter) {
                symEnter.textContent = label;
                symEnter.setAttribute('aria-label', label);
            }
            // So does the nine-pad's action column.
            const numEnter = document.getElementById('numEnterKey');
            if (numEnter) {
                numEnter.textContent = label;
                numEnter.setAttribute('aria-label', label);
            }
        }

        /* ===== symbol layer ===== */

        /** The key-area layers are mutually exclusive; this field owns
         * which one is visible. Full-width borrowers (panel, quick
         * settings, editors) hide every layer via hideKeyLayers and hand
         * the remembered one back with showKeyLayer - no call site juggles
         * the individual hidden flags any more. */
        showKeyLayer(name) {
            this.keyLayer = name;
            // The emoji sub-view belongs to a nine-pad session.
            if (name !== 'numpad') this.emojiView = false;
            this.hideKeyLayers();
            document.getElementById(
                name === 'symbols' ? 'symbolLayer'
                    : name === 'numpad' ? 'numPadLayer' : 'qwertyLayer',
            ).hidden = false;
        }

        hideKeyLayers() {
            document.getElementById('qwertyLayer').hidden = true;
            document.getElementById('symbolLayer').hidden = true;
            document.getElementById('numPadLayer').hidden = true;
        }

        showSymbols() {
            this.symbolCat = 'common';
            this.renderSymbolCats();
            this.renderSymbols();
            this.showKeyLayer('symbols');
        }

        showLetters() {
            this.showKeyLayer('letters');
        }

        /** The IME re-showing always lands on the main view -
         * a keyboard hidden from the symbol layer must not come back
         * there. Closes every panel/layer and returns to the letters (the
         * active MODE is untouched - renderMode would also drop it). */
        resetToHome() {
            this.closePanel();
            this.closeSettingsPanel();
            this.clearEditorStrip();
            this.closeItemMenu();
            this.closeComboGrid();
            this.closeModeMenu();
            this.closeConfirmCard();
            // Review P3: a mid-drag height edit must not survive the reset -
            // cancel semantics (restore the pre-drag height), like 取消.
            if (document.getElementById('heightCard').classList.contains('open')) {
                if (this.heightEditedLive) this.applyKbHeight(this.heightEditSaved);
                this.exitHeightEdit();
            }
            this.setControlView(false);
            this.setExpanded(false);
            this.showLetters();
            // 编辑态是模态 UI：reset 到主视图时不该残留（收起再弹出
            // 的某些路径只走 resetToHome，不走原生 onFinishInputView
            // 的取消通道）。取消语义 = 快照回退、不落盘。
            if (this.toolbarEdit) this.cancelToolbarEdit();
            // 工具栏对账：任何操作链丢掉的按钮在这里强制归位。
            this.auditToolbarTools();
        }

        recent() {
            try { return JSON.parse(localStorage.getItem('feelime_symbol_recent') || '[]'); } catch (_) { return []; }
        }

        remember(value) {
            const values = [value, ...this.recent().filter(item => item !== value)].slice(0, 16);
            localStorage.setItem('feelime_symbol_recent', JSON.stringify(values));
        }

        /* ===== 九宫格数字键盘（长按 123）与 emoji 选择器 ===== */

        showNumpad() {
            this.renderNumpad();
            this.showKeyLayer('numpad');
        }

        /** The nine-pad (long-press 123): a 4×5 grid - the left column is
         * the number-symbol strip (vertical scroll, literal commits) over
         * the back key, then digits, '.', the action column and the emoji
         * sub-view. EVERY glyph commits literally via sendSymbol - the
         * Chinese engine never sees these digits as candidate selectors,
         * and '.' stays a decimal point in every mode (design §2.6). */
        renderNumpad() {
            const layer = document.getElementById('numPadLayer');
            layer.replaceChildren();
            const grid = document.createElement('div');
            grid.className = 'num-grid';

            // Left column rows 1-3: the symbol strip. Plain clicks, NO
            // bindTouch - its preventDefault would kill the vertical
            // scroll (same lesson as the sym-cat strip).
            const syms = document.createElement('div');
            syms.className = 'num-syms';
            NUM_PAD_SYMBOLS.forEach(value => {
                const button = document.createElement('button');
                button.className = 'num-sym-key';
                button.textContent = value;
                button.addEventListener('click', () => this.sendSymbol(value));
                syms.append(button);
            });
            grid.append(syms);

            // Left column row 4: back to the letters keyboard (green).
            // specialKey over a raw button: the back key is NOT inside a
            // scroller, so it joins the bindTouch chain (active-touch +
            // unified cancel, review P2).
            const back = this.specialKey('numpad-back', ICONS.arrowLeft,
                () => this.showLetters(), 'num-back');
            back.setAttribute('aria-label', t("返回主键盘"));
            grid.append(back);

            if (this.emojiView) {
                grid.append(this.renderEmojiArea());
            } else {
                // Grid auto-placement fills c2-c5 row by row after the
                // two placed left-column items. Appended EXACTLY row by
                // row: 1-3/⌫, 4-6/空格, 7-9/emoji, 符号/0/./换行 - one
                // missing cell shifts the whole grid (caught on the demo
                // screenshot: the 0 was dropped and 4 slid into the
                // action column).
                const push = cell => grid.append(cell);
                const digit = value => this.functionKey(value,
                    () => this.sendSymbol(value), 'num-digit');
                push(digit('1'));
                push(digit('2'));
                push(digit('3'));
                push(this.specialKey('backspace', ICONS.backspace,
                    () => this.call(() => Native.backspace(this.token)),
                    'num-fn kb-special', 'repeat'));
                push(digit('4'));
                push(digit('5'));
                push(digit('6'));
                push(this.functionKey(t("空格"),
                    () => this.call(() => Native.space(this.token)),
                    'num-fn kb-special'));
                push(digit('7'));
                push(digit('8'));
                push(digit('9'));
                // bindTouch'd like every non-scroller key (review P2);
                // the aria-label stays language-neutral, "表情" names the
                // symbol CATEGORY, not this entry.
                const emojiKey = this.specialKey('emoji', ICONS.smiley,
                    () => this.toggleEmojiView(), 'num-fn kb-special');
                emojiKey.setAttribute('aria-label', 'emoji');
                push(emojiKey);
                push(this.functionKey(t("符号"), () => this.showSymbols(), 'num-fn kb-special'));
                push(digit('0'));
                push(digit('.'));
                const enter = this.functionKey(t("换行"),
                    () => this.call(() => Native.enter(this.token)),
                    'num-fn kb-special', 'repeat');
                enter.id = 'numEnterKey';
                push(enter);
            }
            layer.append(grid);
            // The pad can open mid-composition (and back from emoji):
            // the enter key must read 确定 then, not a stale 换行.
            this.updateEnterLabel();
        }

        /** The emoji sub-view replaces the digit area (cols 2-5): a
         * horizontally snapping page scroller over the category strip.
         * Pages pair with the strip through a shared index (design §2.6). */
        renderEmojiArea() {
            const area = document.createElement('div');
            area.className = 'emoji-area';
            const recents = this.emojiRecents();
            // recent 常用 leads when it has content (mirrors the 定制 tab).
            const categories = (recents.length
                ? [{ id: 'recent', label: '常用', emojis: recents }, ...EMOJI_CATEGORIES]
                : EMOJI_CATEGORIES);
            const pages = document.createElement('div');
            pages.className = 'emoji-pages';
            const pageCats = [];
            const firstPage = {};
            categories.forEach(category => {
                firstPage[category.id] = pageCats.length;
                for (let i = 0; i < category.emojis.length; i += 24) {
                    pageCats.push(category.id);
                    const page = document.createElement('div');
                    page.className = 'emoji-page';
                    // Plain clicks - bindTouch's preventDefault would kill
                    // the page swipe starting on a key.
                    category.emojis.slice(i, i + 24).forEach(emoji => {
                        const button = document.createElement('button');
                        button.className = 'emoji-key';
                        button.textContent = emoji;
                        button.addEventListener('click', () => {
                            this.sendSymbol(emoji);
                            this.rememberEmoji(emoji);
                        });
                        page.append(button);
                    });
                    pages.append(page);
                }
            });
            const strip = document.createElement('div');
            strip.className = 'emoji-cats';
            // The leading 123 tab returns to the digit pad - the smiley
            // key it replaced lives in that view (symbol layer's ABC
            // grammar).
            const digitsTab = document.createElement('button');
            digitsTab.className = 'sym-cat';
            digitsTab.textContent = '123';
            digitsTab.addEventListener('click', () => this.toggleEmojiView());
            strip.append(digitsTab);
            const tabs = [];
            categories.forEach((category, index) => {
                const tab = document.createElement('button');
                tab.className = 'sym-cat' + (index === 0 ? ' active' : '');
                tab.textContent = t(category.label);
                tab.addEventListener('click', () => {
                    const left = firstPage[category.id] * (pages.clientWidth || 0);
                    if (typeof pages.scrollTo === 'function') {
                        pages.scrollTo({ left, behavior: 'smooth' });
                    } else {
                        pages.scrollLeft = left;
                    }
                });
                tabs.push(tab);
                strip.append(tab);
            });
            // Swiping the pages keeps the strip in sync (per-page index).
            pages.addEventListener('scroll', () => {
                const width = pages.clientWidth;
                if (!width) return;
                const catId = pageCats[Math.round(pages.scrollLeft / width)] || pageCats[0];
                tabs.forEach((tab, index) => tab.classList.toggle('active', categories[index].id === catId));
            });
            area.append(pages, strip);
            return area;
        }

        toggleEmojiView() {
            this.emojiView = !this.emojiView;
            this.renderNumpad();
        }

        emojiRecents() {
            try {
                const parsed = JSON.parse(localStorage.getItem('feelime_emoji_recent') || '[]');
                if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string');
            } catch (_) { /* unset */ }
            return [];
        }

        rememberEmoji(emoji) {
            const values = [emoji, ...this.emojiRecents().filter(item => item !== emoji)].slice(0, 16);
            localStorage.setItem('feelime_emoji_recent', JSON.stringify(values));
        }

        renderSymbolCats() {
            const strip = document.getElementById('symCats');
            strip.replaceChildren();
            SYMBOL_CATEGORIES.forEach(category => {
                // The custom tab only exists once the user saved a table.
                if (category.id === 'custom' && !this.customKeys()) return;
                const button = document.createElement('button');
                button.className = 'sym-cat' + (category.id === this.symbolCat ? ' active' : '');
                button.textContent = t(category.label);
                button.dataset.symCat = category.id;
                // Paired-table tabs (常用/引号) borrow the mode toggle's
                // dual-label grammar: a small 中/En badge names the table.
                if (VARIANT_TABLES[category.id]) {
                    button.classList.add('sym-cat-variant');
                    const badge = document.createElement('span');
                    badge.className = 'cat-sub';
                    badge.textContent = this.variantNow(category.id) === 'zh' ? '中' : 'En';
                    button.append(badge);
                }
                button.addEventListener('click', () => {
                    // Second tap on the ACTIVE paired tab flips its zh/en
                    // table in place - the badge is updated, not the strip
                    // rebuilt (scroll position survives), and the grid
                    // re-renders from the other row set.
                    if (VARIANT_TABLES[category.id] && this.symbolCat === category.id) {
                        const to = this.variantNow(category.id) === 'zh' ? 'en' : 'zh';
                        this.tableVariants[category.id] = to;
                        const badge = button.querySelector('.cat-sub');
                        if (badge) badge.textContent = to === 'zh' ? '中' : 'En';
                        this.renderSymbols();
                        return;
                    }
                    this.symbolCat = category.id;
                    document.querySelectorAll('[data-sym-cat]').forEach(el => (
                        el.classList.toggle('active', el.dataset.symCat === category.id)));
                    this.renderSymbols();
                    // The strip scrolls; keep the active category in view.
                    if (button.scrollIntoView) {
                        button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                });
                strip.append(button);
            });
        }

        /** The variant a paired table (常用/引号) shows: the pinned one
         * (second tap on the active tab flips it) or the default - 常用
         * follows the input mode, 引号 defaults to zh. */
        variantNow(catId) {
            if (this.tableVariants[catId]) return this.tableVariants[catId];
            return catId === 'common' && !this.isChineseMode() ? 'en' : 'zh';
        }

        rowsFor(catId) {
            return VARIANT_TABLES[catId][this.variantNow(catId)];
        }

        commonRows() {
            return VARIANT_TABLES.common[this.variantNow('common')];
        }

        /** The user's custom symbol table - exactly 3 rows of
         * key caps (≤10/10/9; row 3's tenth cell stays the delete key).
         * Stored in localStorage; null (tab hidden) until it has content.
         * This format is REPLACED by pasted JSON
         * (feelime_custom_keys_v2); the old comma tables migrate once. */
        customRows() {
            try {
                const rows = JSON.parse(localStorage.getItem('feelime_custom_rows') || 'null');
                if (Array.isArray(rows) && rows.length === 3 &&
                    rows.some(row => Array.isArray(row) && row.length)) return rows;
            } catch (_) { /* unset */ }
            return null;
        }

        /** The pasted-JSON table: rows of {t, tap, note}. Null
         * until the user saved one; older comma rows migrate over. */
        customKeys() {
            try {
                const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEYS_STORE) || 'null');
                if (parsed && parsed.version === 1 && Array.isArray(parsed.rows) &&
                    parsed.rows.length <= CUSTOM_LIMITS.rows) {
                    return parsed.rows;
                }
            } catch (_) { /* unset */ }
            const legacy = this.customRows();
            if (legacy) {
                const rows = legacy.map(row =>
                    (row || []).map(value => ({ t: value, tap: value, note: '' })));
                try {
                    localStorage.setItem(CUSTOM_KEYS_STORE,
                        JSON.stringify({ version: 1, rows }));
                    localStorage.removeItem('feelime_custom_rows');
                } catch (_) { /* keep the legacy table */ }
                return rows;
            }
            return null;
        }

        /** Tap DSL -> execution steps. Text outside [..] commits
         * literally; [name] presses a key; [mod+...+name] a combo. Returns
         * {steps} or {error} (message names the offending token). */
        parseTapDsl(tap) {
            const steps = [];
            const re = /\[([^\[\]]*)\]/g;
            let index = 0;
            let match;
            const pushText = chunk => {
                if (chunk) steps.push({ text: chunk });
            };
            while ((match = re.exec(tap))) {
                pushText(tap.slice(index, match.index));
                index = match.index + match[0].length;
                const body = match[1].trim().toLowerCase();
                if (!body) return { error: t("出现空的 [] 记号") };
                const mods = [];
                let key = null;
                for (const part of body.split('+').map(p => p.trim()).filter(Boolean)) {
                    if (key === null && CUSTOM_MOD_TOKENS[part]) {
                        mods.push(CUSTOM_MOD_TOKENS[part]);
                        continue;
                    }
                    if (key === null) {
                        key = part;
                        continue;
                    }
                    return { error: t("「{0}」无法解析", match[0]) };
                }
                if (!key) return { error: t("「{0}」缺少键名", match[0]) };
                const comboLabel = CUSTOM_KEY_TOKENS[key] ||
                    (/^[a-z]$/.test(key) ? key.toUpperCase() : null);
                if (!comboLabel) return { error: t("「{0}」的键名不可用", match[0]) };
                steps.push({ combo: [...mods, comboLabel] });
            }
            pushText(tap.slice(index));
            if (steps.filter(step => step.combo).length > CUSTOM_LIMITS.maxKeySteps) {
                return { error: t("按键步骤超过 {0} 个", CUSTOM_LIMITS.maxKeySteps) };
            }
            return { steps };
        }

        /** Validate a pasted JSON definition. Returns {rows} or
         * {error} with the FIRST problem (position + reason). */
        parseCustomKeys(text) {
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                return { error: t("JSON 解析失败：") + err.message };
            }
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return { error: t("顶层必须是 JSON 对象（{\"version\":1,\"rows\":[...]}）") };
            }
            if (data.version !== 1) return { error: t("version 必须是 1") };
            if (!Array.isArray(data.rows)) return { error: t("rows 必须是数组") };
            if (data.rows.length > CUSTOM_LIMITS.rows) {
                return { error: t("最多 {0} 行（收到 {1} 行）", CUSTOM_LIMITS.rows, data.rows.length) };
            }
            const rows = [];
            let total = 0;
            for (let r = 0; r < data.rows.length; r++) {
                const row = data.rows[r];
                if (!Array.isArray(row)) return { error: t("第 {0} 行必须是数组", r + 1) };
                const keys = [];
                for (let c = 0; c < row.length; c++) {
                    const cell = row[c];
                    const at = t("第 {0} 行第 {1} 个键", r + 1, c + 1);
                    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
                        return { error: t("{0} 必须是对象（{t, tap, note}）", at) };
                    }
                    const label = typeof cell.t === 'string' ? cell.t.trim() : '';
                    if (!label) return { error: t("{0} 缺少 t（键面）", at) };
                    if ([...label].length > CUSTOM_LIMITS.labelChars) {
                        return { error: t("「{0}」的 t 超过 {1} 字", label, CUSTOM_LIMITS.labelChars) };
                    }
                    const note = cell.note == null ? '' : String(cell.note);
                    if ([...note].length > CUSTOM_LIMITS.noteChars) {
                        return { error: t("「{0}」的 note 超过 {1} 字", label, CUSTOM_LIMITS.noteChars) };
                    }
                    const tap = typeof cell.tap === 'string' ? cell.tap : '';
                    if (!tap) return { error: t("{0}（「{1}」）缺少 tap（单击行为）", at, label) };
                    if ([...tap].length > CUSTOM_LIMITS.tapChars) {
                        return { error: t("「{0}」的 tap 超过 {1} 字符", label, CUSTOM_LIMITS.tapChars) };
                    }
                    const parsed = this.parseTapDsl(tap);
                    if (parsed.error) return { error: t("「{0}」的 tap {1}", label, parsed.error) };
                    if (++total > CUSTOM_LIMITS.keys) {
                        return { error: t("键总数超过 {0}", CUSTOM_LIMITS.keys) };
                    }
                    keys.push({ t: label, tap, note });
                }
                rows.push(keys);
            }
            if (!rows.some(row => row.length)) return { error: t("至少要定义一个键") };
            return { rows };
        }

        /** Fire one custom key - text chunks commit literally,
         * key/combo steps go through sendCombo (same channel as the ctrl
         * layer). Steps were validated when the table was saved; a table
         * edited out-of-band re-validates defensively. */
        runCustomCell(cell) {
            const parsed = this.parseTapDsl(cell.tap);
            if (parsed.error) {
                this.showToast(t("按键无效：{0}", parsed.error));
                return;
            }
            for (const step of parsed.steps) {
                if (step.text) this.sendSymbol(step.text);
                else this.sendCombo(step.combo);
            }
        }

        symbolCategoryValues() {
            // 中/En paired tables (常用/引号) pick rows by variant.
            if (VARIANT_TABLES[this.symbolCat]) {
                return this.rowsFor(this.symbolCat).flat();
            }
            if (this.symbolCat === 'recent') {
                const values = this.recent();
                // Fill the remainder from the common set so the grid always
                // shows full, evenly spaced rows (style fix).
                for (const row of this.commonRows()) {
                    for (const value of row) {
                        if (values.length >= 29) break;
                        if (!values.includes(value)) values.push(value);
                    }
                }
                return values;
            }
            const category = SYMBOL_CATEGORIES.find(c => c.id === this.symbolCat) || SYMBOL_CATEGORIES[0];
            // Pad every row to the full 10 cells: flattening short rows first
            // shifted the grid left and split pairs like ( ) across rows
 // .
            const values = [];
            category.rows.forEach(row => {
                const padded = [...row];
                while (padded.length < 10) padded.push('');
                values.push(...padded);
            });
            return values;
        }

        renderSymbols() {
            const grid = document.getElementById('symGrid');
            grid.replaceChildren();
            // The custom table renders as three independent
            // horizontally scrollable strips (unlimited keys per row, drag
            // to see the overflow) with a fixed backspace column on the
            // right - the old "row 3 cell 10 is delete" deal belonged to
            // the even 10-column grid.
            if (this.symbolCat === 'custom') {
                const wrap = document.createElement('div');
                wrap.className = 'sym-custom';
                const rowsBox = document.createElement('div');
                rowsBox.className = 'sym-custom-rows';
                const rows = this.customKeys() || [[], [], []];
                rows.forEach(row => {
                    const strip = document.createElement('div');
                    strip.className = 'kb-row sym-custom-row';
                    (row || []).forEach(cell => {
                        const button = document.createElement('button');
                        button.className = 'kb-key sym-custom-key';
                        button.textContent = cell.t;
                        button.addEventListener('click', () => this.runCustomCell(cell));
                        if (cell.note) {
                            this.bindItemLongPress(button, () => this.showToast(cell.note));
                        }
                        strip.append(button);
                    });
                    rowsBox.append(strip);
                });
                const bsCol = document.createElement('div');
                bsCol.className = 'sym-custom-bs';
                bsCol.append(this.specialKey('backspace', ICONS.backspace,
                    () => this.call(() => Native.backspace(this.token)),
                    'kb-special', 'repeat'));
                wrap.append(rowsBox, bsCol);
                grid.append(wrap);
                return;
            }
            if (this.symbolCat === 'arrows') {
                // The 方向 category commits directional TEXT (design §2.4):
                // the glyphs land literally and ⇥ commits a real tab
                // character - no key events, no repeat, nothing remembered.
                // Rows live in a top-aligned wrap: two rows spread across
                // the three-row slot would read as a hole in the middle.
                const arrowsRows = [
                    [['←'], ['↑'], ['→'], ['↓'], ['↔'], ['↕'], ['↖'], ['↗'], ['↘'], ['↙']],
                    [['⇥', '\t']],
                ];
                const wrap = document.createElement('div');
                wrap.className = 'sym-arrows';
                arrowsRows.forEach(cells => {
                    const row = this.row();
                    cells.forEach(([glyph, text]) => {
                        row.append(this.functionKey(glyph,
                            () => this.sendSymbol(text || glyph), 'sym-single'));
                    });
                    while (row.children.length < 10) {
                        const blank = document.createElement('span');
                        blank.className = 'sym-blank';
                        row.append(blank);
                    }
                    wrap.append(row);
                });
                // 行 3 末位固定 ⌫（keyboard.md §155）：分类再特殊，
                // 删自己刚输入的字符不该先切层。
                const lastRow = this.row();
                for (let i = 0; i < 9; i++) {
                    const blank = document.createElement('span');
                    blank.className = 'sym-blank';
                    lastRow.append(blank);
                }
                lastRow.append(this.specialKey('backspace', ICONS.backspace,
                    () => this.call(() => Native.backspace(this.token)),
                    'kb-special', 'repeat'));
                wrap.append(lastRow);
                grid.append(wrap);
                return;
            }
            const values = this.symbolCategoryValues();
            while (values.length < 29) values.push('');
            for (let r = 0; r < 3; r++) {
                const row = this.row();
                const slice = values.slice(r * 10, r * 10 + 10);
                if (r === 2) slice.length = 9; // last cell of row 3 is backspace
                slice.forEach(value => {
                    if (value === '') {
                        const blank = document.createElement('span');
                        blank.className = 'sym-blank';
                        row.append(blank);
                        return;
                    }
                    const button = this.functionKey(value, () => {
                        this.sendSymbol(value);
                        this.remember(value);
                        if (this.symbolCat === 'recent') this.renderSymbols();
                    }, value.length > 1 ? 'sym-multi' : 'sym-single');
                    row.append(button);
                });
                if (r === 2) {
                    row.append(this.specialKey('backspace', ICONS.backspace,
                        () => this.call(() => Native.backspace(this.token)),
                        'kb-special', 'repeat'));
                }
                grid.append(row);
            }
        }

        /* ===== control-key layer  ===== */

        /** Swap the TOOLBAR for the two control-key rows (the bar's 40px
         * slot, The rows never exceed the slot so the keyboard
         * body keeps its height). The ctrl view is a SWITCH: composing or
         * a panel only SUSPENDS it (see suspendCtrlView), the user turns
         * it off with the X. Any layer that owns the bar blocks entering. */
        setControlView(on) {
            // Entering is blocked while composing (the composing toolbar
            // swap owns the bar); leaving is always allowed.
            if (on && this.composing) return;
            if (on && this.panelOpen) return; // panel owns the toolbar
            // The quick settings panel owns the key area too .
            if (on && document.getElementById('settingsPanel').classList.contains('open')) return;
            // Review P3: the editor strip (custom-symbol editing)
            // owns the bar too - it would fight the ctrl rows for the slot.
            if (on && document.body.classList.contains('editing')) return;
            this.ctrlView = on;
            this.ctrlSuspended = false;
            document.body.classList.toggle('ctrl-view', on);
            document.getElementById('ctrlLayer').hidden = !on;
            document.getElementById('candidateBar').hidden = on;
            if (!on) {
                this.closeComboGrid();
                this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
            }
            this.renderCtrlSticky();
            // The control layer has a different top slot in landscape. Read
            // the current view after the swap so a saved height cannot leave
            // the qwerty rows laid out from the previous slot budget.
            this.applyHeight();
        }

        /** The ctrl view is a switch, not a one-shot. When a
         * composition (or a panel) borrows the toolbar, the display hands
         * the bar back but the switch STAYS ON; maybeResumeCtrlView brings
         * the rows back once the borrower leaves. */
        suspendCtrlView() {
            if (!this.ctrlView || this.ctrlSuspended) return;
            this.ctrlSuspended = true;
            this.closeComboGrid();
            this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
            this.renderCtrlSticky();
            document.body.classList.remove('ctrl-view');
            document.getElementById('ctrlLayer').hidden = true;
            document.getElementById('candidateBar').hidden = false;
            this.applyHeight();
        }

        maybeResumeCtrlView() {
            if (!this.ctrlView || !this.ctrlSuspended) return;
            if (this.composing || this.panelOpen) return;
            if (document.body.classList.contains('editing')) return;
            if (document.getElementById('settingsPanel').classList.contains('open')) return;
            this.ctrlSuspended = false;
            document.body.classList.add('ctrl-view');
            document.getElementById('ctrlLayer').hidden = false;
            document.getElementById('candidateBar').hidden = true;
            this.applyHeight();
        }

        /** Pressed feedback for buttons that keep their native
         * click path (no bindTouch) - the class goes on directly; :active
         * alone is unreliable on touch. */
        bindPressFeedback(el) {
            el.addEventListener('touchstart', () => {
                this.pressedKeys.add(el);
                el.classList.add('active-touch');
            }, { passive: true });
            const finish = () => {
                this.pressedKeys.delete(el);
                el.classList.remove('active-touch');
            };
            el.addEventListener('touchend', finish);
            el.addEventListener('touchcancel', finish);
        }

        bindCtrlLayer() {
            document.querySelectorAll('#ctrlLayer [data-ctrl]').forEach(button => {
                this.bindPressFeedback(button);
                button.addEventListener('click', () => {
                    // A long-press that opened the combo grid is followed by
                    // a synthetic click - it must not ALSO flip the sticky
 // modifier .
                    if (button._suppressClick) {
                        button._suppressClick = false;
                        return;
                    }
                    this.handleCtrlKey(button.dataset.ctrl);
                });
                // Ctrl/Alt/Meta long-press opens their combo grids; the Fn
                // key long-presses into the former Comb grid -
                // its tap is the sticky toggle. Plain keys just fire.
                if (button.classList.contains('ctrl-mod') ||
                    button.classList.contains('ctrl-combo')) {
                    button.addEventListener('touchstart', () => {
                        button._comboTimer = setTimeout(() => {
                            button._suppressClick = true;
                            this.openComboGrid(
                                button.dataset.ctrl === 'sticky-fn'
                                    ? 'comb'
                                    : button.dataset.ctrl.replace('sticky-', ''),
                                button,
                            );
                        }, 350);
                    }, { passive: true });
                    button.addEventListener('touchend', () => {
                        clearTimeout(button._comboTimer);
                    });
                    button.addEventListener('touchcancel', () => {
                        clearTimeout(button._comboTimer);
                        // Same residue rule: a cancelled long-press never
                        // delivers the click that clears _suppressClick.
                        button._suppressClick = false;
                    });
                }
            });
            document.getElementById('comboPopup').addEventListener('click', event => {
                if (event.target.id === 'comboPopup') this.closeComboGrid();
            });
        }

        /** Sticky modifiers: Ctrl/Alt/Meta/Fn arm the NEXT key into a combo
         * (reference terminal-keyboard behaviour); they light up and clear
         * after the combo lands. Fn additionally relabels the letter rows
         * (renderFnLabels). */
        renderCtrlSticky() {
            document.querySelectorAll('#ctrlLayer .ctrl-mod').forEach(button => {
                const mod = button.dataset.ctrl.replace('sticky-', '');
                const meta = mod === 'ctrl' ? 'Ctrl'
                    : mod === 'alt' ? 'Alt'
                    : mod === 'fn' ? 'Fn' : 'Meta';
                button.classList.toggle('active', this.sticky[meta]);
            });
            this.renderFnLabels();
        }

        /** While Fn is armed the twelve mapped keys print their
         * F-number as the main glyph (the letter drops to the small alt
         * slot). The OFF branch restores the base glyphs itself - every
         * disarm path (sendCombo, second-tap disarm, collapse/suspend) only
         * calls renderCtrlSticky, and an earlier review showed an early return
         * left F1..F12 printed while taps already typed letters. The alt
         * slot must go back to the mode's alt hint, not the bare letter. */
        renderFnLabels() {
            const on = this.ctrlView && this.sticky.Fn;
            const chinese = this.mode === 'pinyin' || this.mode === 'double-pinyin';
            const upper = this.shift || this.caps;
            document.querySelectorAll('#qwertyLayer [data-key]').forEach(button => {
                const key = button.dataset.key;
                if (!FN_KEYS[key]) return; // updateLabels owns every other state
                const main = button.querySelector('.kb-main');
                const alt = button.querySelector('.kb-alt');
                if (!main || !alt) return;
                button.classList.toggle('fn-label', on);
                if (on) {
                    main.textContent = FN_KEYS[key];
                    alt.textContent = (chinese || upper) ? key.toUpperCase() : key;
                } else {
                    main.textContent = (chinese || upper) ? key.toUpperCase() : key;
                    alt.textContent = this.keyAltHint(key);
                }
            });
        }

        handleCtrlKey(action) {
            if (action === 'collapse') {
                this.setControlView(false);
                return;
            }
            if (action.startsWith('sticky-')) {
                const meta = action === 'sticky-ctrl' ? 'Ctrl'
                    : action === 'sticky-alt' ? 'Alt'
                    : action === 'sticky-fn' ? 'Fn' : 'Meta';
                if (this.sticky[meta]) {
                    if (meta === 'Fn') {
                        // Fn has no bare F-key; a second tap just disarms.
                        this.sticky.Fn = false;
                        this.renderCtrlSticky();
                        return;
                    }
                    // Tapping the ARMED modifier again fires the
                    // bare key (Win alone opens the Windows menu, Alt alone
                    // the menu bar) - a no-op disarm read as "broken".
                    this.sendCombo([STICKY_ALONE[meta]]);
                    return;
                }
                this.sticky[meta] = true;
                this.renderCtrlSticky();
                return;
            }
            // A plain control key: fires with the armed modifiers at once.
            // The qwerty shift's armed state rides along too - shift + Tab,
            // shift + arrows (selection), shift + Del (design §11).
            const mods = Object.keys(this.sticky).filter(key => this.sticky[key]);
            if (this.shift) mods.push('Shift');
            this.sendCombo([...mods, action]);
        }

        /** Send one host key event: [modifiers..., key] -> keycode + meta
         * bits over Native.keyEvent (whitelisted on the native side).
         * EVERY modifier combo rides the PHYSICAL channel
         * (modifier key down -> key down/up -> modifier up). The RDP round
         * proved the single-event form leaves the remote Alt held down -
         * the Alt+Tab switcher never commits (the client synthesizes
         * Alt-down from the meta bit but no matching Alt-up), the same
         * failure class as the original Win report. Ctrl/Shift join them
         * for one uniform sequence that mirrors a physical left-hand press. */
        sendCombo(parts) {
            const label = parts[parts.length - 1];
            const keyCode = this.keyCodeFor(label);
            if (!keyCode) return;
            let meta = 0;
            parts.slice(0, -1).forEach(mod => { meta |= CTRL_META_BITS[mod] || 0; });
            const physical = meta !== 0 && typeof Native.keyEventPhysical === 'function';
            this.call(() => physical
                ? Native.keyEventPhysical(keyCode, meta, this.token)
                : Native.keyEvent(keyCode, meta, this.token));
            this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
            this.renderCtrlSticky();
            // An armed qwerty shift rode along as the SHIFT meta bit
            // (design §11) - the combo consumes it like every sticky bit.
            if (this.shift) { this.shift = false; this.updateLabels(); }
        }

        keyCodeFor(label) {
            if (CTRL_KEY_CODES[label] !== undefined) return CTRL_KEY_CODES[label];
            if (/^[A-Z]$/.test(label)) return 29 + label.charCodeAt(0) - 65; // KEYCODE_A..
            return 0;
        }

        /** The 3x3 combo grid floats above the control layer; cells carry
         * the full key names stacked per line (demo round 3). 
         * #0.3: placement hugs the trigger's top edge across the WHOLE IME
         * window (band included), shrinking its cells if the headroom is
         * short - the trigger key itself is never covered and the card
         * never straddles the key rows half-off (design §0 总原则).
         * Tapping the anchor again only closes the card. */
        openComboGrid(grid, anchor) {
            const popup = document.getElementById('comboPopup');
            const inner = document.getElementById('comboPopupInner');
            inner.replaceChildren();
            (COMBO_GRIDS[grid] || []).forEach(combo => {
                const cell = document.createElement('button');
                cell.className = 'combo-cell';
                combo.forEach((part, index) => {
                    const line = document.createElement('span');
                    // Modifier names ride as small muted text; the last item
                    // is the key itself and gets the big face.
                    line.className = index === combo.length - 1 ? 'combo-main' : 'combo-mod';
                    line.textContent = part;
                    cell.append(line);
                });
                cell.addEventListener('click', () => {
                    this.closeComboGrid();
                    this.sendCombo(combo);
                });
                inner.append(cell);
            });
            this.comboGrid = grid;
            this.comboAnchor = anchor || null;
            popup.classList.add('open');
            // Placement is ANCHOR-driven across the whole IME
            // window (the band above the keyboard is window, too - 
            // #9 got the space right but pinned the card to the keyboard's
            // top EDGE instead of the trigger, so it drifted off its key;
            // and when the band ran short in landscape the old floor let it
            // hang halfway over the key rows). Rule: hug the trigger's top
            // edge with the full-size card; if the space above the trigger
            // cannot hold it, shrink the cells (58 → 40px floor, still
            // tappable) before ever covering a key. The ✕ badge overhangs
 // 14px top/right  - the clamps reserve that.
            const rect = anchor.getBoundingClientRect();
            // Review P1-1: headroom must reserve the ✕ badge's 14px
            // overhang AND the 6px gap the hug branch adds on top, or the
            // badge clips at the window edge on the tight fits.
            const availUp = rect.top - 20;
            // Full-size first; shrink only when the space above the trigger
            // cannot hold the card (then re-measure before positioning).
            // Review P1-1: measure at the 58px design size FIRST -
            // closeComboGrid leaves the inline --combo-cell behind, and
            // sizing the shrink decision off the stale small cell made the
            // shrink branch flip to side-placement on every second open.
            popup.style.removeProperty('--combo-cell');
            if (popup.offsetHeight > availUp) {
                // Card height = 3*cell + 2*gap + padding + borders = 3*cell
 // + 26 (the +24 constant ignored the
                // 2px borders and left every third fit 2px short).
                popup.style.setProperty('--combo-cell',
                    Math.max(40, Math.floor((availUp - 26) / 3)) + 'px');
            }
            const cardW = popup.offsetWidth;
            const cardH = popup.offsetHeight;
            const left = Math.max(16, Math.min(innerWidth - cardW - 16,
                rect.left + rect.width / 2 - cardW / 2));
            if (cardH <= availUp) {
                // Hug the trigger's top edge (the usual case: portrait has
                // the whole band above the keyboard to grow into).
                popup.style.left = left + 'px';
                popup.style.top = (rect.top - cardH - 6) + 'px';
            } else {
                // Even the 40px floor does not fit above the trigger (short
                // landscape ctrl rows): slide BESIDE the trigger, vertically
                // centred on its row - the trigger key itself stays visible
                // and tappable (tap it = close).
                const cy = rect.top + rect.height / 2;
                popup.style.top =
                    Math.max(14, Math.min(cy - cardH / 2, innerHeight - cardH - 4)) + 'px';
                popup.style.left = (rect.right + 8 + cardW <= innerWidth - 16
                    ? rect.right + 8
                    : Math.max(16, rect.left - 8 - cardW)) + 'px';
            }
            this.syncOverlay();
        }

        closeComboGrid() {
            this.comboGrid = null;
            this.comboAnchor = null;
            const popup = document.getElementById('comboPopup');
            popup.classList.remove('open');
            this.syncOverlay();
        }

        /* ===== orientation & keyboard height  ===== */

        applyOrientation(landscape) {
            if (this.landscape === landscape) return;
            this.landscape = landscape;
            document.body.classList.toggle('landscape', landscape);
            // Stored heights are per orientation; pick the right one, then
            // re-render the letter rows (the layout folds in landscape).
            this.kbHeight = this.storedKbHeight();
            this.renderMode();
            this.applyHeight();
        }

        /** Saved CONTENT keyboard height (CSS px) for the current orientation;
         * 0 = native default (272). Legacy keys held a per-row height (<100)
         * - ignored so an old value cannot clamp the new content height. */
        storedKbHeight() {
            try {
                const saved = parseInt(
                    localStorage.getItem(KB_HEIGHT_KEY(this.landscape ? 'landscape' : 'portrait')) || '0', 10);
                if (saved >= 120) return saved;
            } catch (_) { /* unset */ }
            return 0;
        }

        /** The native side owns the content height; its view also carries the
         * bottom safe area. Keep the rows inside the content portion so the
         * same content height gives the same key height in both orientations.
         * chrome = top pad + bar + gaps + bottom pad, including the inter-row
         * margins (portrait 14+2+40+10+5+3*5 = 86). */
        safeBottomPx() {
            return Math.max(0, Number(this.safeBottom) || 0);
        }

        /** Fixed vertical space outside the four qwerty rows. Candidate and
         * control slots have the same total height (design §11). The
         * composing-preedit band rides the top of that budget; its height
         * mirrors the CSS --preedit-band levels (18/22/25px — sized to a
         * CJK font line box so vendor fonts don't clip descenders, issue
         * #8): the rows shrink by 4/8/11 against the old 14px base. */
        layoutChrome() {
            const bandExtra = this.preeditFont === 2 ? 11 : this.preeditFont === 1 ? 8 : 4;
            return (this.landscape ? 78 : 86) + bandExtra;
        }

        /** Read the native view's total height back as content height. The
         * fallback keeps the preview usable before its layout has measured. */
        currentContentHeight(fallback = 272) {
            const view = document.getElementById('softKeyboard');
            const measured = Number(view && view.clientHeight);
            const safe = this.safeBottomPx();
            const pad = this.bottomPadPx();
            const total = Number.isFinite(measured) && measured > 0
                ? measured
                : Number(fallback) + safe + pad;
            return Math.max(0, Math.round(total - safe - pad));
        }

        /** The bottom blank strip in CSS px (dp == px in this WebView);
         * mirrored into CSS so #softKeyboard's bottom padding owns the
         * exact same space the JS budgets exclude (mode-fallback §3). */
        bottomPadPx() {
            return Math.max(0, Number(this.bottomPad) || 0);
        }

        // 候选字号（issue #2）：body data 属性驱动 CSS 变量，行高预算不动。
        applyCandidateFont() {
            const level = Number(this.candidateFont) || 0;
            document.body.dataset.candFont =
                level === 1 ? 'large' : level === 2 ? 'xlarge' : 'normal';
        }

        // 拼音字号（issue #8）：悬浮带回 1.0.13 的顶部形态，档位驱动
        // --preedit-font-scale（字号）与 --preedit-band-scale（带高 +
        // 顶部 padding/横屏 bar margin，随档位让位）。带高变化改写行高
        // 预算（layoutChrome 按 preeditFont 加增量），切档重算 applyHeight。
        applyPreeditFont() {
            const level = Number(this.preeditFont) || 0;
            document.body.dataset.preeditFont =
                level === 1 ? 'large' : level === 2 ? 'xlarge' : 'normal';
            this.applyHeight();
        }

        // 单手模式（issue #15）：data 属性驱动 CSS 布局（键区同侧让位 +
        // #sidePad 贴另一侧占满让位条），侧边内容三态与自定义图在这里一并
        // 落地。位置纯 CSS（含安全区对齐），无需 JS 定位。
        applyOneHand() {
            const level = Number(this.oneHand) || 0;
            document.body.dataset.oneHand =
                level === 1 ? 'left' : level === 2 ? 'right' : 'off';
            const content = Number(this.sideContent) || 0;
            document.body.dataset.sideContent = content === 1 ? 'blank' : 'cursor';
            // 压缩比例：让位宽度 = 屏宽的百分比（大屏单手靠它收窄键区）。
            // 0 档不覆盖，保持 CSS 默认 64px；旋转后 innerWidth 变化，
            // resize 时本方法会重跑重算。
            const padPct = Number(this.oneHandPad) || 0;
            if (padPct > 0) {
                const padW = Math.round(window.innerWidth * padPct / 100);
                document.documentElement.style.setProperty('--side-pad-w', padW + 'px');
            } else {
                document.documentElement.style.removeProperty('--side-pad-w');
            }
            // 让位宽度变了，候选条容量随之变化：重算溢出隐藏。
            this.pruneOverflowTools();
        }

        /** 背景图片（亮/暗两组，issue #15）：铺满整个键盘区域（工具条
         *  到底部留白；float band 扩展透明区在 WebView 之外，天然不覆
         *  盖）。按当前主题取对应组；该组无图 = 纯色背景。 */
        applyBackground() {
            const light = document.documentElement.classList.contains('theme-light');
            const image = light ? this.bgImageLight : this.bgImageDark;
            const layer = document.getElementById('bgImage');
            if (layer) {
                // 该组无图必须清掉残留——不清会把另一组的图带到当前
                // 主题（真机：暗色主题铺着亮色组的老图）。
                layer.style.backgroundImage =
                    image ? `url("data:image/jpeg;base64,${image}")` : '';
            }
            document.body.dataset.bgImage = image ? 'on' : 'off';
        }

        /** 键帽不透明度：只动背景 alpha 变量，键帽文字保持实色。 */
        applyKeyOpacity() {
            const pct = Math.max(0, Math.min(100, Number(this.keyOpacity) || 0));
            document.documentElement.style.setProperty(
                '--key-alpha', String(Math.max(0.05, pct / 100)));
        }

        // ---- 工具栏编辑模式（issue #15）----
        // 布局是两个有序数组（左组 / 右组，中间候选区留空）。按钮 DOM 永远
        // 存在于 candidateBar（编辑态把未上栏的按钮移进下方仓库 grid），
        // applyToolbarLayout 只负责按数组重排；事件绑定在元素上，移动安全。

        applyToolbarLayoutValue(raw) {
            let parsed = null;
            try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }
            const valid = arr => Array.isArray(arr) && arr.length <= 4
                && arr.every(id => typeof id === 'string' && id in TOOL_CATALOG)
                && new Set(arr).size === arr.length;
            if (!parsed || !valid(parsed.left) || !valid(parsed.right)) return;
            this.toolbarLeft = parsed.left.slice();
            this.toolbarRight = parsed.right.slice();
        }

        applyToolbarLayout() {
            // 左组锚在候选区之前（candidateBar 行内，F logo 之后）；右组
            // 锚在收起键之前。拼音带 preeditLine 在 softKeyboard 顶部、
            // 候选条之外——拿它当锚点会把左组插成键盘顶部的全宽行，把
            // 键盘顶出一屏（真机截图教训），两个锚点都必须在行内。
            const pre = document.getElementById('candidates');
            const hideBtn = document.getElementById('hide');
            if (!pre || !hideBtn) return;
            const resolve = id => document.getElementById(TOOL_CATALOG[id]);
            this.toolbarLeft.forEach(id => {
                const el = resolve(id);
                if (el) pre.parentNode.insertBefore(el, pre);
            });
            this.toolbarRight.forEach(id => {
                const el = resolve(id);
                if (el) hideBtn.parentNode.insertBefore(el, hideBtn);
            });
            this.pruneOverflowTools();
            this.renderToolbarEditor();
        }

        /** 工具栏对账（兜底，每次编辑操作 / 键盘弹起后跑）：不变式是
         *  「每颗工具要么在候选条、要么在下方仓库完整展示」。实现拆两层：
         *  1) applyToolbarLayout 把数组内的按钮重新插桩（防 DOM 脱队），
         *     末尾的 renderToolbarEditor 把栏上没有的全部收进仓库；
         *  2) hidden 只对栏上按钮按 composing/溢出重算，仓库内的按钮
         *     一律可见（历史上把 hidden 写到仓库按钮上，编辑态里看着
         *     像凭空消失）。 */
        auditToolbarTools() {
            this.applyToolbarLayout();
            const composeHidden = document.body.classList.contains('composing');
            const overflow = this._overflowTools || new Set();
            Object.entries(TOOL_CATALOG).forEach(([id, dom]) => {
                if (dom === 'mic') return;
                const el = document.getElementById(dom);
                if (!el) return;
                el.hidden = el.closest('#toolbarEditorGrid')
                    ? false
                    : (composeHidden || overflow.has(dom));
            });
            const mic = document.getElementById('mic');
            if (mic) mic.hidden = composeHidden && this.voiceState === 'idle';
        }

        /** 溢出兜底：已保存的布局可能比当前候选条容量大（典型：单手模式
         *  让位 64px 后放不下 6 颗）——放不下的按钮隐藏，收起键永远留在
         *  栏内、不压侧边栏。配置不丢：切回宽布局/退出单手自动恢复。 */
        pruneOverflowTools() {
            const cap = this.toolbarCapacity();
            this._overflowTools = new Set();
            let shown = 0;
            [...this.toolbarLeft, ...this.toolbarRight].forEach(id => {
                if (shown >= cap) {
                    this._overflowTools.add(id);
                    return;
                }
                shown++;
            });
            [...this.toolbarLeft, ...this.toolbarRight].forEach(id => {
                const el = document.getElementById(TOOL_CATALOG[id]);
                if (el) el.hidden = this._overflowTools.has(id);
            });
        }

        enterToolbarEdit() {
            if (this.toolbarEdit || this.composing) return;
            const editor = document.getElementById('toolbarEditor');
            if (!editor) return;
            this.closeSettingsPanel();
            // 快照进入时的布局：「完成」才落盘，「取消」按快照整体回退。
            this._toolbarSnapshot = {
                left: this.toolbarLeft.slice(),
                right: this.toolbarRight.slice(),
            };
            this.toolbarEdit = true;
            document.body.classList.add('toolbar-edit');
            editor.hidden = false;
            this.renderToolbarEditor();
            this.showToast(t("工具栏编辑：点下方图标添加，拖动排序，× 移除"));
        }

        exitToolbarEdit() {
            this.closeToolbarEdit(true);
        }

        /** 「取消」：按进入编辑时的快照整体回退，不落盘。 */
        cancelToolbarEdit() {
            if (!this.toolbarEdit) return;
            if (this._toolbarSnapshot) {
                this.toolbarLeft = this._toolbarSnapshot.left.slice();
                this.toolbarRight = this._toolbarSnapshot.right.slice();
            }
            this.closeToolbarEdit(false);
        }

        closeToolbarEdit(save) {
            if (!this.toolbarEdit) return;
            this.toolbarEdit = false;
            document.body.classList.remove('toolbar-edit');
            const editor = document.getElementById('toolbarEditor');
            if (editor) editor.hidden = true;
            this._toolbarSnapshot = null;
            this.applyToolbarLayout();
            if (save && typeof Native.setQuickPref === 'function') {
                this.call(() => Native.setQuickPref('toolbarLayout',
                    JSON.stringify({ left: this.toolbarLeft, right: this.toolbarRight }),
                    this.token));
            }
        }

        /** 下方仓库：把未上栏的 catalog 按钮移入 grid（点按添加）。只做
         *  增量搬移、绝不清空 grid——按钮一旦被移出 DOM，getElementById
         *  就再也找不回它（× 掉第二个 icon 时第一个会凭空消失）。 */
        renderToolbarEditor() {
            const grid = document.getElementById('toolbarEditorGrid');
            if (!grid) return;
            const used = new Set([...this.toolbarLeft, ...this.toolbarRight]);
            Object.keys(TOOL_CATALOG).forEach(id => {
                const el = document.getElementById(TOOL_CATALOG[id]);
                if (!el) return;
                if (used.has(id)) return;
                // 未上栏 = 仓库态：class 幂等补齐（历史版本挪进仓库时可能
                // 漏掉 editor-pool，+ 角标挂在这个 class 上，缺了就没有 +）。
                el.classList.add('editor-pool');
                if (!el.closest('#toolbarEditorGrid')) grid.append(el);
            });
        }

        addToToolbar(id) {
            // 幂等：合成 click 在部分 WebView（ColorOS 实测）拦不干净，
            // 触摸链 + 合成 click 双通道会把同一颗加两次。
            if (this.toolbarLeft.includes(id) || this.toolbarRight.includes(id)) return;
            const el = document.getElementById(TOOL_CATALOG[id]);
            if (!el || !el.classList.contains('editor-pool')) return;
            if (this.toolbarLeft.length + this.toolbarRight.length
                >= this.toolbarCapacity()) {
                this.showToast(t("工具栏空间不够"));
                return;
            }
            el.classList.remove('editor-pool');
            if (this.toolbarRight.length < 4) {
                this.toolbarRight.push(id);
            } else if (this.toolbarLeft.length < 4) {
                this.toolbarLeft.push(id);
            } else return;
            this.applyToolbarLayout();
        }

        removeFromToolbar(id) {
            this.toolbarLeft = this.toolbarLeft.filter(x => x !== id);
            this.toolbarRight = this.toolbarRight.filter(x => x !== id);
            this.applyToolbarLayout();
        }

        /** 开关型工具（色彩模式/振动/声音/联想/单手）：index.html 没有静
         *  态节点，这里动态创建，初始只待在编辑仓库里，由用户上栏。点击
         *  行为 = 快捷设置同名 tile 的 toggle；状态用 state-on 底色。 */
        buildToggleTools() {
            const defs = [
                { key: 'theme', id: 'toolTheme', icon: 'theme', label: '色彩模式' },
                { key: 'vibrate', id: 'toolVibrate', icon: 'vibrate', label: '按键振动' },
                { key: 'sound', id: 'toolSound', icon: 'sound', label: '按键声音' },
                { key: 'assoc', id: 'toolAssoc', icon: 'assoc', label: '中文联想' },
                { key: 'onehand', id: 'toolOneHand', icon: 'onehand', label: '单手模式' },
            ];
            const pool = document.getElementById('toolbarEditorGrid');
            defs.forEach(({ key, id, icon, label }) => {
                if (document.getElementById(id)) return;
                const b = document.createElement('button');
                b.id = id;
                b.className = 'tool editor-pool';
                b.dataset.tool = key;
                b.setAttribute('aria-label', t(label));
                b.setAttribute('data-i18n-aria-label', label);
                // ICONS[name] 是活的 SVG 元素（同一节点只能挂一处），必须
                // clone；拼进 innerHTML 会变成 "[object SVGSVGElement]"。
                const svg = ICONS[icon].cloneNode(true);
                svg.setAttribute('width', '16');
                svg.setAttribute('height', '16');
                b.append(svg);
                b.addEventListener('click', () => {
                    if (this.toolbarEdit) return;
                    this.toggleExtraTool(key);
                });
                if (pool) pool.append(b);
            });
            this.syncToolStates();
        }

        /** 色彩模式三态循环（工具条按钮与快捷设置方块共用）。本地即时
         *  生效，意图进 quickPending 并落 native pref（theme_mode 是唯一
         *  真相源）。只写 localStorage 的话，任何一次 hello——比如调
         *  不透明度滑块触发的 PREFS_CHANGED——都会按旧 pref 把主题洗回
         *  去（真机实录：暗色下调滑块，键盘弹回系统亮色）。 */
        cycleThemeNative() {
            const modes = ['auto', 'light', 'dark'];
            const next = this.qStep('themeMode', modes,
                modes.includes(this.themeMode) ? this.themeMode : 'auto');
            this.themeMode = next;
            applyTheme(next);
            if (typeof Native.setQuickPref === 'function') {
                this.call(() => Native.setQuickPref('themeMode', next, this.token));
            }
            pushStores();
            return next;
        }

        /** 开关型工具的点击行为（与快捷设置 tile 同参）。 */
        toggleExtraTool(key) {
            const setNative = (k, v) => {
                if (typeof Native.setQuickPref === 'function') {
                    this.call(() => Native.setQuickPref(k, String(v), this.token));
                }
            };
            if (key === 'theme') {
                this.cycleThemeNative();
            } else if (key === 'sound') {
                this.keySound = this.qFlip('keySound', this.keySound);
                setNative('keySound', this.keySound ? '1' : '0');
            } else if (key === 'vibrate') {
                this.keyHaptic = this.qFlip('keyHaptic', this.keyHaptic);
                setNative('keyHaptic', this.keyHaptic ? '1' : '0');
            } else if (key === 'assoc') {
                this.associationOn = this.qFlip('association', this.associationOn);
                if (!this.associationOn) this.assocWords = [];
                setNative('association', this.associationOn ? '1' : '0');
            } else if (key === 'onehand') {
                this.oneHand = this.qStep('oneHand', [0, 1, 2], this.oneHand);
                this.applyOneHand();
                setNative('oneHand', this.oneHand);
            }
            if (this.settingsPage === null) this.renderSettingsPanel();
            this.syncToolStates();
        }

        /** 开关型工具 icon 的 on 底色跟随当前状态（hello / 点击后同步）。 */
        syncToolStates() {
            const set = (id, on) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('state-on', !!on);
            };
            const theme = this.themeMode || 'auto';
            // 色彩模式不挂 on 态：auto/浅/深是三态循环，没有开/关语义，
            // 亮绿 icon+描边在暗色背景上是整条工具栏唯一的亮点（用户三次
            // 点名刺眼）——工具栏上与其他工具完全同款。三态换图形区分
            // （auto=半填充圆/light=太阳/dark=月牙，同色不换色）。
            set('toolTheme', false);
            this.swapThemeGlyph(theme);
            set('toolVibrate', this.keyHaptic);
            set('toolSound', this.keySound);
            set('toolAssoc', this.associationOn);
            set('toolOneHand', (this.oneHand || 0) !== 0);
        }

        /** 色彩模式按钮的三态图形：跟随系统=半填充圆、浅色=太阳、
         *  深色=月牙（同一 currentColor，只换形不换色）。幂等：图形
         *  名记在 dataset，不变就不动 DOM。 */
        swapThemeGlyph(theme) {
            const el = document.getElementById('toolTheme');
            if (!el) return;
            const glyph = theme === 'light' ? 'themeSun'
                : theme === 'dark' ? 'themeMoon' : 'theme';
            if (el.dataset.glyph === glyph) return;
            el.dataset.glyph = glyph;
            const old = el.querySelector('svg');
            if (old) old.remove();
            const svg = ICONS[glyph].cloneNode(true);
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            el.append(svg);
        }

        /** 候选条当前宽度还放得下几颗工具（单手模式键区让位后 bar 变窄，
         *  容量自动变小）。MIN_CAND 给候选词留的最小宽度必须收窄：96px
         *  时 352px 宽的 ace 真机 cap=4，比默认布局的 5 颗还少，新增一律
         *  被拒（真机验收抓到）；候选区本身可横向滚动兜底。布局塌陷时
         *  （宽度 0）放宽到 8，不挡编辑。 */
        toolbarCapacity() {
            const bar = document.getElementById('candidateBar');
            const setup = document.getElementById('setupButton');
            const hide = document.getElementById('hide');
            if (!bar || !setup || !hide || !bar.clientWidth) return 8;
            const BTN = 32, GAP = 5, MIN_CAND = 24;
            const avail = bar.clientWidth - setup.offsetWidth - hide.offsetWidth
                - MIN_CAND - GAP * 2;
            return Math.max(1, Math.floor(avail / (BTN + GAP)));
        }

        /** 编辑态下按组内索引移动 id（拖拽落位）。跨组拖入满组（4）时
         *  与落点按钮交换——拖动是调序手段，静默拒绝会让用户以为坏了。
         *  id 还在仓库（不在任何组）时是「从仓库拖上栏」，走 addToToolbar
         *  （带容量检查 + 清掉 editor-pool 角标）。 */
        moveInToolbar(id, group, index) {
            if (!this.toolbarLeft.includes(id) && !this.toolbarRight.includes(id)) {
                this.addToToolbar(id);
                return;
            }
            const from = this.toolbarLeft.includes(id) ? this.toolbarLeft : this.toolbarRight;
            const to = group === 'left' ? this.toolbarLeft : this.toolbarRight;
            const origIndex = from.indexOf(id);
            const old = from.filter(x => x !== id);
            if (to === from) {
                old.splice(Math.max(0, Math.min(index, old.length)), 0, id);
                this.toolbarLeft = group === 'left' ? old : this.toolbarLeft;
                this.toolbarRight = group === 'right' ? old : this.toolbarRight;
                this.applyToolbarLayout();
                return;
            }
            if (to.length < 4) {
                to.splice(Math.max(0, Math.min(index, to.length)), 0, id);
            } else {
                const victimIndex = Math.max(0, Math.min(index, to.length - 1));
                const victim = to[victimIndex];
                to.splice(victimIndex, 1, id);
                old.splice(Math.max(0, Math.min(origIndex, old.length)), 0, victim);
            }
            if (from === this.toolbarLeft) this.toolbarLeft = old;
            else this.toolbarRight = old;
            this.applyToolbarLayout();
        }

        /** 编辑模式事件接线（issue #15）：长按候选条工具进入编辑；× 移除
         *  到仓库；仓库点按添加；编辑态长按工具=拖动排序（跨左右组，中间
         *  候选区不放按钮）；「完成」退出并保存。 */
        setupToolbarEditor() {
            const bar = document.getElementById('candidateBar');
            const doneBtn = document.getElementById('toolbarEditDone');
            if (!bar || !doneBtn) return;
            const EDIT_HOLD_MS = 280;
            this.buildToggleTools();
            Object.entries(TOOL_CATALOG).forEach(([id, dom]) => {
                const el = document.getElementById(dom);
                if (!el) return;
                el.dataset.tool = id;
                const x = document.createElement('span');
                x.className = 'tool-x';
                x.textContent = '×';
                // × 自己接管触摸：阻止冒泡到按钮的 bindTouch（否则
                // preventDefault 后手动 button.click() 的 target 是整颗
                // 按钮，× 的移除永远轮不到）。
                x.addEventListener('touchstart', event => {
                    event.stopPropagation();
                    event.preventDefault();
                }, { passive: false });
                x.addEventListener('touchend', event => {
                    event.stopPropagation();
                    event.preventDefault();
                    if (this.toolbarEdit) this.removeFromToolbar(id);
                }, { passive: false });
                el.append(x);
                // 长按入口（非编辑态）→ 进入编辑；编辑态长按 → 拖拽。
                // 编辑态必须 stopImmediatePropagation 压掉同节点后注册的
                // bindTouch（click 拦截管不到它的 350ms 长按 hold，否则
                // 进编辑 70ms 后原功能长按照常触发——preview 实测）。
                // 长按计时不能被 touchmove 一票清掉：真机手指长按必然有
                // 亚像素微动（ace 实测 swipe 同点也插 MOVE），一旦清掉就
                // 时灵时不灵。move 只更新位置，到点按「总位移 <12px」判。
                el.addEventListener('touchstart', event => {
                    if (this.toolbarEdit) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        el._editStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
                        this.beginToolbarDrag(id, el, event);
                        return;
                    }
                    if (el.closest('#toolbarEditorGrid')) return;
                    const start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
                    el._editHoldPos = start;
                    el._editHold = setTimeout(() => {
                        const pos = el._editHoldPos || start;
                        if (Math.abs(pos.x - start.x) < 12
                            && Math.abs(pos.y - start.y) < 12) {
                            this.enterToolbarEdit();
                        }
                    }, EDIT_HOLD_MS);
                }, { passive: true });
                el.addEventListener('touchmove', event => {
                    const t = event.touches[0];
                    if (t && el._editHoldPos) {
                        el._editHoldPos = { x: t.clientX, y: t.clientY };
                    }
                }, { passive: true });
                // 编辑态点击（位移 <12px）：仓库按钮 = 添加。触摸链上
                // bindTouch 已被 immediateStop 压掉，合成 click 不会发生，
                // 添加语义只能在这里兜（拖动落点由 beginToolbarDrag 的
                // window touchend 处理，两路按位移分流不打架）。
                el.addEventListener('touchend', event => {
                    clearTimeout(el._editHold);
                    el._editHoldPos = null;
                    if (!this.toolbarEdit || !el._editStart) return;
                    const t = event.changedTouches[0];
                    const moved = Math.hypot(t.clientX - el._editStart.x,
                        t.clientY - el._editStart.y) >= 12;
                    el._editStart = null;
                    if (moved) return;
                    if (el.closest('#toolbarEditorGrid')) {
                        this.addToToolbar(id);
                    }
                }, { passive: true });
                ['touchend', 'touchcancel'].forEach(name =>
                    el.addEventListener(name, () => {
                        clearTimeout(el._editHold);
                        el._editHoldPos = null;
                    }, { passive: true }));
            });
            // 编辑态吞掉工具原功能（capture 阶段拦在 candidateBar 上）；
            // × 的移除也在这里做——capture 先于 target，若在按钮上
            // stopPropagation 会把 × 自身的 listener 一并吞掉。
            if (!bar) throw new Error('TBE-REG-NOBAR');
            bar.addEventListener('click', event => {
                if (!this.toolbarEdit) return;
                const tool = event.target.closest('.tool');
                if (!tool || !tool.dataset.tool) return;
                event.stopPropagation();
                if (event.target.classList.contains('tool-x')) {
                    this.removeFromToolbar(tool.dataset.tool);
                }
            }, true);
            // 仓库（grid）同理：capture 拦原功能。
            const grid = document.getElementById('toolbarEditorGrid');
            if (grid) {
                grid.addEventListener('click', event => {
                    if (!this.toolbarEdit) return;
                    // 编辑态点仓库按钮只做「上工具栏」（touchend 通道）。
                    // 剪贴板/常用语等静态按钮的 click 直连 openPanel 且
                    // 不在 candidateBar 拦截范围内——按钮进仓库后点按会
                    // 上栏 + 弹面板同时发生。capture 阶段拦：事件到不了
                    // target，按钮自己的 click listener 不跑。
                    if (event.target.closest('[data-tool]')) event.stopPropagation();
                }, true);
            }
            // 仓库的「点按添加」只走 editor touchend 这一条通道——
            // 不要再挂 click 委托：合成 click 在部分 WebView（ColorOS
            // 实测）拦不干净，且按钮上栏后相邻按钮补位到点击坐标，
            // 委托会再命中下一颗，一次点击带上两颗（真机实测两次）。
            doneBtn.addEventListener('click', () => this.exitToolbarEdit());
            const cancelBtn = document.getElementById('toolbarEditCancel');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelToolbarEdit());
            // 长按候选条空白（target 是 bar 本身，即按钮之外的空隙）也能
            // 进编辑——工具栏按钮全被移除后，这里和快捷设置的「编辑工具
            // 栏」tile 是仅存的入口。计时同样抗微动（见上）。
            bar.addEventListener('touchstart', event => {
                if (this.toolbarEdit || event.target !== bar) return;
                const start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
                bar._barHoldPos = start;
                bar._barHold = setTimeout(() => {
                    const pos = bar._barHoldPos || start;
                    if (Math.abs(pos.x - start.x) < 12
                        && Math.abs(pos.y - start.y) < 12) {
                        this.enterToolbarEdit();
                    }
                }, EDIT_HOLD_MS);
            }, { passive: true });
            bar.addEventListener('touchmove', event => {
                const t = event.touches[0];
                if (t && bar._barHoldPos) {
                    bar._barHoldPos = { x: t.clientX, y: t.clientY };
                }
            }, { passive: true });
            ['touchend', 'touchcancel'].forEach(name =>
                bar.addEventListener(name, () => {
                    clearTimeout(bar._barHold);
                    bar._barHoldPos = null;
                }, { passive: true }));
        }

        /** 编辑态拖拽：ghost（44px 圆钮，见 .toolbar-drag-ghost）跟手，
         *  松手按落点 x 定组（candidateBar 中点分左右）与组内索引（各
         *  按钮中点比较），中间候选区不放按钮。 */
        beginToolbarDrag(id, el, event) {
            const SIZE = 44;
            const ghost = el.cloneNode(true);
            ghost.classList.remove('toolbar-dragging');
            ghost.classList.add('toolbar-drag-ghost');
            ghost.style.left = (event.touches[0].clientX - SIZE / 2) + 'px';
            ghost.style.top = (event.touches[0].clientY - SIZE / 2) + 'px';
            ghost.style.width = SIZE + 'px';
            ghost.style.height = SIZE + 'px';
            document.body.append(ghost);
            el.classList.add('toolbar-dragging');
            const move = ev => {
                const t = ev.touches[0];
                ghost.style.left = (t.clientX - SIZE / 2) + 'px';
                ghost.style.top = (t.clientY - SIZE / 2) + 'px';
            };
            const up = ev => {
                window.removeEventListener('touchmove', move);
                window.removeEventListener('touchend', up);
                window.removeEventListener('touchcancel', up);
                ghost.remove();
                el.classList.remove('toolbar-dragging');
                if (!ev.changedTouches.length) return;
                const t = ev.changedTouches[0];
                const barEl = document.getElementById('candidateBar');
                const barRect = barEl.getBoundingClientRect();
                if (t.clientY < barRect.top || t.clientY > barRect.bottom) return;
                const group = t.clientX < barRect.left + barRect.width / 2 ? 'left' : 'right';
                const arr = group === 'left'
                    ? this.toolbarLeft.filter(x => x !== id)
                    : this.toolbarRight.filter(x => x !== id);
                let index = arr.length;
                for (let i = 0; i < arr.length; i++) {
                    const other = document.getElementById(TOOL_CATALOG[arr[i]]);
                    if (!other) continue;
                    const r = other.getBoundingClientRect();
                    if (t.clientX < r.left + r.width / 2) { index = i; break; }
                }
                this.moveInToolbar(id, group, index);
            };
            window.addEventListener('touchmove', move, { passive: true });
            window.addEventListener('touchend', up);
            window.addEventListener('touchcancel', up);
        }

        applyHeight() {
            const view = document.getElementById('softKeyboard');
            const total = (view && view.clientHeight) || window.innerHeight;
            const safe = this.safeBottomPx();
            // The user's bottom blank strip rides INSIDE the view (CSS
            // padding-bottom owns it); the row budget excludes it so rows
            // keep their height and the strip stays blank (mode-fallback §3).
            const pad = this.bottomPadPx();
            const available = Math.max(0, total - safe - pad);
            const root = document.documentElement;
            if (root && root.style && typeof root.style.setProperty === 'function') {
                root.style.setProperty('--kb-bottom-pad', pad + 'px');
            }
            // The ctrl rows live INSIDE the bar slot again, so
            // the keyboard budget is orientation-only (no ctrl branch). The
            // height-edit card owns its own 36px slice: while
            // it shows, the bar is pushed down and the chrome grows to keep
            // the rows inside the view.
            // The landscape bar grew to clear the preedit line
            // (margin-top 14 + 40 bar vs the old 2 + 26 that made the pinyin
            // overlap the candidates). Both bar slots take 62px; bottom
            // padding and four row margins add 16px in landscape.
            const chrome = this.layoutChrome();
            const rows = 4;
            const fit = Math.floor((available - chrome) / rows);
            // A short landscape screen can cap content below 78 + 4*32.
            // Honor the actual budget so the last row clears the safe area.
            const rowHeight = Math.max(this.landscape ? 1 : KB_ROW_MIN, fit);
            if (root && root.style && typeof root.style.setProperty === 'function') {
                root.style.setProperty('--kb-row-h', rowHeight + 'px');
                // D: the keyboard stops above the gesture strip in
                // both orientations; the background fills the inset.
                root.style.setProperty('--safe-bottom', safe + 'px');
            }
            // A clientHeight read mid-resize bakes a transient budget into
            // the vars, and a var-only change re-fires nothing (the view's
            // final size is already observed). Re-run one frame later when
            // the derivation moved since the previous pass; layout settles,
            // the values stop moving and the cascade ends. (device gate:
            // --kb-row-h drifted 46→43→49 across a pad flip)
            const signature = [total, pad, safe, rowHeight, this.landscape].join('/');
            if (this._lastHeightSig !== undefined && signature !== this._lastHeightSig
                && !this._heightConverging && typeof requestAnimationFrame === 'function') {
                this._heightConverging = true;
                requestAnimationFrame(() => {
                    this._heightConverging = false;
                    this.applyHeight();
                });
            }
            this._lastHeightSig = signature;
            // Keep the floating card attached to the keyboard after the
            // native resize or a preview bridge changes its height.
            if (document.getElementById('heightCard').classList.contains('open')) {
                this.placeHeightCard();
            }
            // native show/resize 必经 applyHeightNow→这里：工具栏对账的
            // 兜底触发点（同输入框收起再弹不走 onStartInputView/resetToHome）。
            this.auditToolbarTools();
        }

        /** Push a new CONTENT height to the native side. Old bridges (and the
         * preview harness without the native method) fall back to styling the
         * total view height, adding the safe area exactly once. */
        applyKbHeight(content) {
            const value = Math.round(Number(content) || 0);
            this.kbHeight = value;
            const view = document.getElementById('softKeyboard');
            if (typeof Native.setKeyboardHeight === 'function') {
                this.call(() => Native.setKeyboardHeight(value, this.token));
            } else if (view) {
                view.style.height = (value || this.heightDefaultCss || 272) + this.safeBottomPx() + 'px';
            }
            this.applyHeight();
        }

        /** Drag the keyboard's top edge to resize the WHOLE
         * view (keys and fonts scale with it); Save keeps the content height
         * for the CURRENT orientation, Cancel restores. */
        /** The height adjuster is a card floating above the
         * keyboard view. Two adjusters: -/+ buttons (fine, applied live)
         * and a drag strip (coarse, PREVIEW only - the height lands on
         * release/save; the user explicitly rejected live drag resize).
         * Every applied path funnels through applyKbHeight → the native
         * setKeyboardHeight bridge (which persists the pref) - the old save
         * path wrote only localStorage and the height silently reverted. */
        heightBounds() {
            const chrome = this.layoutChrome();
            // The content floor and the native clamp floor - whichever
            // is taller wins (a 170css landscape pref would squeeze the rows).
            const min = Math.max(chrome + 4 * KB_ROW_MIN, this.heightFloorCss || 0);
            // The ceiling comes from the hello-pushed REAL-screen
            // fraction (mirrors setKeyboardHeight's clamp) - no synthetic
            // headroom beyond it: on landscape half-screen budgets the ceiling
            // can sit AT the content floor, and offering a taller range would
            // be a drag the native clamp silently refuses. The stale
            // innerHeight-floatBand fallback only serves hello-less harnesses.
            const fallback = Math.max(
                min + 40,
                window.innerHeight - (this.floatBand || 0) - this.safeBottomPx(),
            );
            const max = Math.max(min, this.heightCeilCss || fallback);
            return { min, max };
        }

        enterHeightEdit() {
            this.heightEditSaved = this.currentContentHeight();
            this.heightResetPending = false;
            this.heightEditedLive = false;
            // Landscape can legitimately sit 1-2css BELOW the content
            // floor (half-screen budget); clamp the preview so the card never
            // opens showing a value under its own minimum - EXCEPT when the
            // range is capped, where the honest current height is displayed
            // (the strip and save are disabled; nothing gets written anyway).
            const bounds = this.heightBounds();
            const capped = bounds.max <= bounds.min + 2;
            this.heightPreview = capped
                ? this.heightEditSaved
                : Math.max(bounds.min, this.heightEditSaved);
            this.closeSettingsPanel();
            const card = document.getElementById('heightCard');
            card.hidden = false;
            card.classList.add('open');
            this.placeHeightCard();
            this.renderHeightCard();
            this.syncOverlay();
        }

        placeHeightCard() {
            const card = document.getElementById('heightCard');
            const kb = document.getElementById('softKeyboard').getBoundingClientRect();
            card.style.top = '0px';
            const h = card.offsetHeight;
            card.style.top = Math.max(14, kb.top - h - 6) + 'px';
        }

        exitHeightEdit() {
            const card = document.getElementById('heightCard');
            card.classList.remove('open');
            card.hidden = true;
            this.applyHeight();
            this.syncOverlay();
            this.maybeResumeCtrlView();
        }

        renderHeightCard() {
            const bounds = this.heightBounds();
            const content = Math.round(this.heightPreview);
            document.getElementById('heightValue').innerHTML = content + '<small>px</small>';
            const track = document.getElementById('heightTrack');
            const thumb = document.getElementById('heightThumb');
            // Landscape half-screen budgets can pin the ceiling AT the
            // content floor - say so instead of offering a dead range.
            const capped = bounds.max <= bounds.min + 2;
            const hint = document.getElementById('heightHint');
            if (hint) hint.textContent = capped ? t("横屏已达屏幕上限") : t("拖动为预览，松手应用");
            track.style.opacity = capped ? '.35' : '';
            document.getElementById('heightMinus').disabled = capped;
            document.getElementById('heightPlus').disabled = capped;
            // Saving a clamped-up preview would pin the localStorage mirror
            // above what native ever honours - a no-op save, not a real one.
            document.getElementById('heightCardSave').disabled = capped && !this.heightResetPending;
            const span = Math.max(1, bounds.max - bounds.min);
            const frac = Math.min(1, Math.max(0, (content - bounds.min) / span));
            const width = (track && track.clientWidth) || 200;
            thumb.style.left = Math.round(frac * (width - 14)) + 'px';
            if (track && track.style && typeof track.style.setProperty === 'function') {
                track.style.setProperty('--frac', String(frac));
            }
        }

        applyHeightPreview(total) {
            const bounds = this.heightBounds();
            this.heightResetPending = false;
            this.heightPreview = Math.round(Math.min(bounds.max, Math.max(bounds.min, total)));
            this.renderHeightCard();
        }

        bindHeightCard() {
            const step = delta => {
                const current = this.heightPreview;
                this.heightPreview = current;
                this.applyHeightPreview(current + delta);
                this.heightEditedLive = true;
                // Fine steps land immediately (user rule: buttons adjust).
                this.applyKbHeight(this.heightPreview);
            };
            document.getElementById('heightMinus').addEventListener('click', () => step(-4));
            document.getElementById('heightPlus').addEventListener('click', () => step(4));
            const track = document.getElementById('heightTrack');
            let startX = 0;
            let startContent = 272;
            let dragging = false;
            track.addEventListener('touchstart', event => {
                // At the ceiling a tap would still jump the preview
                // and land it on release - keep the strip inert, matching the
                // disabled +/- affordances.
                if (this.heightBounds().max <= this.heightBounds().min + 2) {
                    event.preventDefault();
                    return;
                }
                event.preventDefault();
                const touch = event.touches[0];
                const rect = track.getBoundingClientRect();
                // A tap on the strip jumps the preview to that position.
                const bounds = this.heightBounds();
                const width = rect.width - 14;
                const frac = Math.min(1, Math.max(0, (touch.clientX - rect.left) / width));
                startContent = bounds.min + frac * (bounds.max - bounds.min);
                this.heightResetPending = false;
                this.heightPreview = startContent;
                startX = touch.clientX;
                dragging = true;
                this.renderHeightCard();
            }, { passive: false });
            track.addEventListener('touchmove', event => {
                if (!dragging) return;
                event.preventDefault();
                const bounds = this.heightBounds();
                const width = (track.clientWidth || 200) - 14;
                const dx = event.touches[0].clientX - startX;
                this.heightPreview = Math.round(
                    Math.min(bounds.max, Math.max(bounds.min, startContent + dx / width * (bounds.max - bounds.min))));
                this.renderHeightCard();
            }, { passive: false });
            track.addEventListener('touchend', () => {
                if (!dragging) return;
                dragging = false;
                this.heightEditedLive = true;
                // Release lands the preview (user rule: no live resize).
                this.applyKbHeight(this.heightPreview);
            });
            track.addEventListener('touchcancel', () => { dragging = false; });
            document.getElementById('heightCardCancel').addEventListener('click', () => {
                if (this.heightEditedLive) this.applyKbHeight(this.heightEditSaved);
                this.exitHeightEdit();
            });
            document.getElementById('heightCardReset').addEventListener('click', () => {
                this.heightResetPending = true;
                this.heightPreview = this.heightDefaultCss || 272;
                this.renderHeightCard();
            });
            document.getElementById('heightCardSave').addEventListener('click', () => {
                const content = Math.round(this.heightPreview);
                // applyKbHeight → native setKeyboardHeight persists the pref
                // per orientation; localStorage mirrors it for the preview.
                this.applyKbHeight(this.heightResetPending ? 0 : content);
                try {
                    const key = KB_HEIGHT_KEY(this.landscape ? 'landscape' : 'portrait');
                    if (this.heightResetPending) localStorage.removeItem(key);
                    else localStorage.setItem(key, String(content));
                } catch (_) {}
                this.showToast(t("键盘高度已保存"));
                this.exitHeightEdit();
            });
        }

                /* ===== mode menu ===== */

        toggleModeMenu() {
            const menu = document.getElementById('modeMenu');
            if (menu.classList.contains('open')) { this.closeModeMenu(); return; }
            this.closeSettingsPanel();
            menu.replaceChildren();
            this.modeOrder().forEach(name => {
                const config = MODES[name];
                const button = document.createElement('button');
                // strictReady（stroke）：只有 hello 明确给 true 才可点——
                // 旧 APK 的 engineDataReady 不含 stroke 字段，宽松判定
                // （!== false）会把缺键当可用，出现可点却无效的入口。
                const ready = !config.engine || (config.strictReady
                    ? this.engineReady[name] === true
                    : this.engineReady[name] !== false);
                const current = name === this.mode;
                button.className = current ? 'current' : (ready ? '' : 'preparing');
                // Compact rows - the shorthand leads, the full
                // title follows (left aligned, no trailing blank).
                button.innerHTML = `<span class="prep">${ready ? modeLabel(name) : '…'}</span><span>${t(config.title)}</span>`;
                if (ready && !current) {
                    button.addEventListener('click', () => {
                        this.closeModeMenu();
                        this.call(() => Native.selectMode(name, this.token));
                    });
                }
                menu.append(button);
            });
            // M4: 键盘设置 moved out of the menu to the toolbar setupButton;
            // Moved the theme row into that settings panel too.
            menu.scrollTop = 0; // scroll state must not leak between opens
            menu.classList.add('open');
            // ANCHOR-driven placement. Had the
            // right idea (use the app-area band above the keyboard so all
            // rows fit) but pinned the menu to the keyboard's top EDGE -
            // far from its trigger and drifting over whatever the app
            // showed there. Now the menu hugs the mode toggle's top edge
            // (right edges aligned); only when the space above the toggle
            // cannot hold it does it fall back to window-top + scroll
            // (short landscape band) - it never lands on the key rows and
            // never detaches from its trigger.
            menu.style.maxHeight = 'none'; // measure the natural height first
            const toggle = document.getElementById('modeToggle').getBoundingClientRect();
            menu.style.left = 'auto';
            menu.style.right = Math.max(4, innerWidth - toggle.right) + 'px';
            menu.style.bottom = 'auto';
            const availUp = toggle.top - 14;
            if (menu.offsetHeight <= availUp) {
                menu.style.maxHeight = '';
                menu.style.top = (toggle.top - menu.offsetHeight - 6) + 'px';
            } else {
                menu.style.maxHeight = availUp + 'px';
                menu.style.top = '14px';
            }
            this.syncOverlay();
        }

        closeModeMenu() {
            document.getElementById('modeMenu').classList.remove('open');
            this.syncOverlay();
        }

        /** Automation hook : wipe the editor through the IME's own
         * deletion cascade - host-injected keyevents are unreliable while
         * the WebView is focused. */
        clearEditorBridge() {
            if (!this.ready || !this.token) return 'not-ready';
            this.call(() => Native.clearComposing(this.token));
            for (let i = 0; i < 160; i++) {
                this.call(() => Native.backspace(this.token));
            }
            return 'ok';
        }

        /* ===== quick settings panel  ===== */

        toggleSettingsPanel(page = null) {
            const panel = document.getElementById('settingsPanel');
            if (panel.classList.contains('open')) { this.closeSettingsPanel(); return; }
            this.closeModeMenu();
            // The control view owns the key area too - it never
            // coexists with the settings panel. Borrow, don't
            // switch off (closing the panel restores the rows).
            if (this.ctrlView) this.suspendCtrlView();
            // Review P2: opening the quick panel over the editor
            // strip must tear the strip down too, or the input rides on
            // without a keyboard (and keeps the native redirect armed).
            this.clearEditorStrip();
            // The panel reopens on its home page (or the requested
            // sub-page - the custom-row editor returns to 定制键盘).
            this.settingsPage = page;
            // 全新打开回第一屏；打开后的 tile 重渲染由 qsPage 保持在当前页。
            this.qsPage = 0;
            this.renderSettingsPanel();
            panel.classList.add('open');
            panel.hidden = false;
            // The full-settings gear rides the toolbar only while the quick
            // panel is open: as a permanent resident it hovers over the
            // candidates while typing (tried and rejected).
            const full = document.getElementById('fullSetupButton');
            if (full) full.hidden = false;
            // The panel REPLACES the key area (no overlay) -
            // remember which key layer to restore on close.
            this.settingsReturnLayer = this.keyLayer;
            this.hideKeyLayers();
        }

        closeSettingsPanel() {
            const panel = document.getElementById('settingsPanel');
            if (!panel) return;
            if (!panel.classList.contains('open')) return;
            panel.classList.remove('open');
            panel.hidden = true;
            const full = document.getElementById('fullSetupButton');
            if (full) full.hidden = true;
            this.settingsPage = null;
            this.hideSettingsPageBar();
            // Hand the key layer back unconditionally - the
            // panel replaces whichever layer was visible when it opened.
            // Review P1: the old "editor/panel own their layers" branch
            // stranded an empty key area after a settings round-trip inside
            // the phrase editor (the editor coexists with the qwerty layer
            // since ).
            this.showKeyLayer(this.settingsReturnLayer || 'letters');
            // The panel borrowed the bar from the ctrl view -
            // bring the rows back if the switch is still on.
            this.maybeResumeCtrlView();
        }

        /** Quick settings grew sub-pages - complex features
         * (quick-switch pairs, phrase management)
         * get their own page with a back row instead of stacking inline
         * blocks that overflowed the screen. */
        renderSettingsPanel(page = this.settingsPage) {
            const panel = document.getElementById('settingsPanel');
            panel.replaceChildren();
            if (page) {
                // The sub-page header rides the TOOLBAR (left:
                // back + title, right: close) instead of its own row.
                this.showSettingsPageBar({ pair: t("输入法快捷切换"), menu: t("长按菜单"),
                    custom: t("定制键盘") }[page] || '');
            } else {
                this.hideSettingsPageBar();
            }
            if (page === 'pair') this.renderPairEditor(panel);
            else if (page === 'menu') this.renderMenuEditor(panel);
            else if (page === 'custom') this.renderCustomPage(panel);
            else this.renderSettingsHome(panel);
        }

        /** Sub-page chrome lives in the candidate bar - a ‹ back
         * button and the page title on the left, a close × on the right,
         * same .tool pill styling as the rest of the toolbar; every regular
         * tool hides while a sub-page is up (body.settings-page). */
        showSettingsPageBar(title) {
            const bar = document.getElementById('settingsPageBar');
            bar.replaceChildren();
            const back = document.createElement('button');
            back.className = 'tool';
            back.textContent = '‹';
            back.setAttribute('aria-label', t("返回设置首页"));
            back.addEventListener('click', () => {
                this.settingsPage = null;
                this.renderSettingsPanel();
            });
            const label = document.createElement('span');
            label.className = 'page-title';
            label.textContent = title;
            const close = document.createElement('button');
            close.className = 'tool';
            close.textContent = '×';
            close.setAttribute('aria-label', t("收起设置"));
            close.addEventListener('click', () => this.closeSettingsPanel());
            bar.append(back, label, close);
            bar.hidden = false;
            document.body.classList.add('settings-page');
        }

        hideSettingsPageBar() {
            const bar = document.getElementById('settingsPageBar');
            if (bar) bar.hidden = true;
            document.body.classList.remove('settings-page');
        }

        /** 快捷设置首页：微信式 2×4 方块网格，横向滑动翻页（native
         *  scroll-snap，无手势代码）。工具栏保持现状（齿轮=完整设置），
         *  网格末尾再放一块大的「完整设置」。与主键盘重复的能力（语音、
         *  剪贴板）不进面板；tile 即状态——点按直接生效并重渲染回读。 */
        renderSettingsHome(panel) {
            const wrap = document.createElement('div');
            wrap.className = 'qs-wrap';
            const pages = document.createElement('div');
            pages.className = 'qs-pages';
            // 严格 2×4：.qs-page 的 grid 是 4 列 × 2 行，第 9 个 tile 会
            // 溢出成隐式第三行（真机翻车）。分页在这里硬切，页大小是
            // 结构保证——新增 tile 只会多一页，永远挤不爆网格。
            const defs = this.quickTileDefs();
            for (let i = 0; i < defs.length; i += 8) {
                const page = document.createElement('div');
                page.className = 'qs-page';
                defs.slice(i, i + 8).forEach(def => page.append(this.qsTile(def)));
                pages.append(page);
            }
            // 翻页手势完全接管（硬限制）：Android WebView 的 fling 惯性
            // 会连跨两页，事后钳制在真机上拦不住（合成器惯性不经过
            // DOM）。改为 preventDefault 吃掉原生滚动、自己跟手，手指
            // 抬起按位移+速度算目标页——目标页被硬限制在起点 ±1 页，
            // 甩得再快也只翻一屏。
            let drag = null;
            const pageW = () =>
                pages.firstElementChild ? pages.firstElementChild.offsetWidth : 0;
            pages.addEventListener('touchstart', e => {
                // Mock/旧 WebView 的合成事件可能没有 touches：此处抛错
                // 会打断 tap→click 链，一排面板测试跟着挂。
                const t = e.touches && e.touches[0];
                if (!t) return;
                drag = {
                    startX: t.clientX,
                    startY: t.clientY,
                    startLeft: pages.scrollLeft,
                    lastX: t.clientX,
                    lastT: Date.now(),
                    v: 0,
                    axis: null,
                };
            }, { passive: true });
            pages.addEventListener('touchmove', e => {
                if (!drag) return;
                const t0 = e.touches && e.touches[0];
                if (!t0) return;
                const x = t0.clientX;
                const y = t0.clientY;
                if (drag.axis === null) {
                    const dx = Math.abs(x - drag.startX);
                    const dy = Math.abs(y - drag.startY);
                    if (dx < 8 && dy < 8) return; // 位移死区，防误判
                    drag.axis = dx > dy ? 'x' : 'y';
                }
                if (drag.axis !== 'x') { drag = null; return; } // 纵向放行
                const now = Date.now();
                drag.v = (x - drag.lastX) / Math.max(1, now - drag.lastT);
                drag.lastX = x;
                drag.lastT = now;
                e.preventDefault(); // 惯性滚动的源头在这里掐断
                const pw = pageW();
                if (!pw) return;
                const max = (pages.children.length - 1) * pw;
                let left = drag.startLeft - (x - drag.startX);
                if (left < 0) left /= 3; // 越界阻尼（第一页往右拖）
                if (left > max) left = max + (left - max) / 3;
                pages.scrollLeft = left;
            }, { passive: false });
            pages.addEventListener('touchend', () => {
                if (!drag) return;
                const pw = pageW();
                if (drag.axis === 'x' && pw) {
                    const startPage = Math.round(drag.startLeft / pw);
                    const delta = pages.scrollLeft - drag.startLeft; // >0 = 手指左移（下一页）
                    // 翻页判定（2026-09-18 用户反馈「要划大半屏才翻页」）：
                    // 快扫只要速度到位（滤点按抖动留 4% 位移下限）；慢拖
                    // 从「过半页」放宽到 1/4 页。小幅度滑动也能翻页。
                    const distance = Math.abs(delta);
                    const fast = Math.abs(drag.v) > 0.2 && distance > pw * 0.04;
                    let page = startPage;
                    if (fast || distance > pw * 0.25) {
                        page = startPage + (delta > 0 ? 1 : -1);
                    }
                    // 硬限制：一次操作最多翻一屏
                    page = Math.max(startPage - 1, Math.min(page, startPage + 1));
                    page = Math.max(0, Math.min(page, pages.children.length - 1));
                    pages.scrollTo({ left: page * pw, behavior: 'smooth' });
                }
                drag = null;
            });
            // 圆点/qsPage 记录仍由 scroll 事件驱动（跟手过程实时亮点）。
            pages.addEventListener('scroll', () => this.qsSyncDots(pages), { passive: true });
            const dots = document.createElement('div');
            dots.className = 'qs-dots';
            pages.querySelectorAll('.qs-page').forEach(() => dots.append(document.createElement('span')));
            wrap.append(pages, dots);
            panel.append(wrap);
            // 点按 tile 会整页重渲染：留在当前页，不许跳回第一屏
            // （this.qsPage 由 qsSyncDots 维护；首次打开时为 0）。
            this.qsPages = pages;
            const restore = () => {
                // 面板收起/整页重渲染会换掉本节点：width 恒 0，无守卫会
                // 变成每帧重排的无终止 rAF（codex P2）。
                if (!pages.isConnected || this.qsPages !== pages) return;
                const pageW = pages.firstElementChild ? pages.firstElementChild.offsetWidth : 0;
                if (!pageW) { requestAnimationFrame(restore); return; }
                pages.scrollLeft = pageW * (this.qsPage || 0);
                this.qsSyncDots(pages);
            };
            restore();
        }

        qsTile(def) {
            const tile = document.createElement('button');
            tile.className = 'qs-tile' + (def.on && def.on() ? ' on' : '') +
                (def.big ? ' qs-big' : '');
            if (def.icon) tile.append(def.icon.cloneNode(true));
            const name = document.createElement('span');
            name.className = 'qs-name';
            name.textContent = def.label;
            tile.append(name);
            if (def.state) {
                const state = document.createElement('span');
                state.className = 'qs-state';
                state.textContent = def.state();
                tile.append(state);
            }
            tile.addEventListener('click', () => def.tap());
            return tile;
        }

        /** 翻页圆点跟随横向滚动位置（scroll 事件驱动，无触摸仲裁）；
         *  当前页码记到 this.qsPage，重渲染后由 renderSettingsHome 恢复。 */
        qsSyncDots(pages) {
            const strip = pages || this.qsPages;
            if (!strip || !strip.parentNode) return;
            const dots = strip.parentNode.querySelector('.qs-dots');
            if (!dots || !dots.children.length || !strip.firstElementChild) return;
            const pageW = strip.firstElementChild.offsetWidth || 1;
            const idx = Math.max(0, Math.min(dots.children.length - 1,
                Math.round(strip.scrollLeft / pageW)));
            this.qsPage = idx;
            [...dots.children].forEach((dot, i) => dot.classList.toggle('cur', i === idx));
        }

        /** 快捷偏好的未决意图层：tap 把「下一个值」写进 quickPending 并
         *  发送；hello 快照只有等于意图才撤签。渲染读 qRead（意图优先），
         *  连点永远基于上一次意图翻转/步进，不会丢操作（codex P2）。 */
        qRead(key, actual) {
            const pending = this.quickPending[key];
            return pending === undefined ? actual : pending;
        }
        qFlip(key, current) {
            const pending = this.quickPending[key];
            const next = pending === undefined ? !current : !pending;
            this.quickPending[key] = next;
            return next;
        }
        qStep(key, list, current) {
            const pending = this.quickPending[key];
            const cur = pending === undefined ? current : pending;
            const next = list[(list.indexOf(cur) + 1) % list.length];
            this.quickPending[key] = next;
            return next;
        }
        qConfirm(key, actual) {
            const pending = this.quickPending[key];
            if (pending !== undefined && String(pending) === String(actual)) {
                delete this.quickPending[key];
            }
        }

        /** 方块定义：{icon, label, state?, on?, big?, tap}。state() 返回
         *  状态行文本，on() 高亮开关/当前档；写偏好走 ImeBridge.setQuickPref
         *  （旧 APK 没有该方法：typeof 守卫，点了不动，不产生假状态）。 */
        quickTileDefs() {
            const quickPref = (key, value) => {
                if (typeof Native.setQuickPref === 'function') {
                    this.call(() => Native.setQuickPref(key, String(value), this.token));
                }
            };
            const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
            const themeText = { auto: t("跟随系统"), light: t("浅色"), dark: t("深色") };
            const localeText = { auto: t("跟随系统"), zh: t("中文"), en: t("English") };
            const snapText = { 0: t("松"), 1: t("标准"), 2: t("紧") };
            const fontText = { 0: t("标准"), 1: t("大"), 2: t("更大") };
            const oneHandText = { 0: t("关"), 1: t("左手"), 2: t("右手") };
            const dpText = { ziranma: t("自然码"), flypy: t("小鹤双拼"), sogou: t("搜狗 / 微软双拼"), ziguang: t("紫光双拼") };
            const themeTheme = () => this.themeMode || 'auto';
            const rehome = () => {
                if (this.settingsPage === null) this.renderSettingsPanel();
            };
            const customRows = this.customKeys();
            return [
                    {
                        icon: ICONS.theme, label: t("色彩模式"),
                        state: () => themeText[themeTheme()] || themeText.auto,
                        tap: () => {
                            this.cycleThemeNative();
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.assoc, label: t("中文联想"),
                        on: () => this.qRead('association', this.associationOn),
                        state: () => (this.qRead('association', this.associationOn) ? t("开") : t("关")),
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.associationOn = this.qFlip('association', this.associationOn);
                            if (!this.associationOn) this.assocWords = [];
                            quickPref('association', this.associationOn ? '1' : '0');
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.sound, label: t("按键声音"),
                        on: () => this.qRead('keySound', this.keySound),
                        state: () => (this.qRead('keySound', this.keySound) ? t("开") : t("关")),
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.keySound = this.qFlip('keySound', this.keySound);
                            quickPref('keySound', this.keySound ? '1' : '0');
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.vibrate, label: t("按键振动"),
                        on: () => this.qRead('keyHaptic', this.keyHaptic),
                        state: () => (this.qRead('keyHaptic', this.keyHaptic) ? t("开") : t("关")),
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.keyHaptic = this.qFlip('keyHaptic', this.keyHaptic);
                            quickPref('keyHaptic', this.keyHaptic ? '1' : '0');
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.height, label: t("键盘高度"), state: () => t("调节"),
                        tap: () => this.enterHeightEdit(),
                    },
                    {
                        icon: ICONS.swap, label: t("快捷切换"),
                        state: () => this.quickPair.map(m => modeLabel(m)).join(' · '),
                        tap: () => { this.settingsPage = 'pair'; this.renderSettingsPanel(); },
                    },
                    {
                        icon: ICONS.font, label: t("候选字号"),
                        state: () => fontText[this.qRead('candidateFont', this.candidateFont)] || fontText[0],
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.candidateFont = this.qStep('candidateFont', [0, 1, 2], this.candidateFont);
                            this.applyCandidateFont();
                            quickPref('candidateFont', this.candidateFont);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.lang, label: t("界面语言"),
                        // 选择值（auto/zh/en）驱动循环与显示；uiLocale 是
                        // 解析后的显示语言，英文系统上用它永远回不到中文。
                        state: () => localeText[this.qRead('uiLocale', this.uiLanguageChoice)] || localeText.auto,
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            const next = this.qStep('uiLocale', ['auto', 'zh', 'en'], this.uiLanguageChoice || 'auto');
                            quickPref('uiLocale', next);
                            rehome();
                        },
                    },
                    {
                        // 单手模式（issue #15）：关 → 左手 → 右手循环；
                        // tile 状态行常显当前模式（qRead 回读，含未决意图）。
                        icon: ICONS.onehand, label: t("单手模式"),
                        state: () => oneHandText[this.qRead('oneHand', this.oneHand)] || oneHandText[0],
                        on: () => (this.qRead('oneHand', this.oneHand) || 0) !== 0,
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.oneHand = this.qStep('oneHand', [0, 1, 2], this.oneHand);
                            this.applyOneHand();
                            quickPref('oneHand', this.oneHand);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.pad, label: t("底部留白"),
                        state: () => {
                            const pad = this.qRead('bottomPad', this.bottomPad);
                            return pad ? pad + 'dp' : t("关");
                        },
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.bottomPad = this.qStep('bottomPad', [0, 12, 24, 36, 48], Number(this.bottomPad) || 0);
                            this.applyHeight();
                            quickPref('bottomPad', this.bottomPad);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.timer, label: t("长按时长"),
                        state: () => (Number(this.qRead('holdMs', this.holdMs)) || 350) + 'ms',
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.holdMs = this.qStep('holdMs', [200, 300, 350, 450, 600], Number(this.holdMs) || 350);
                            quickPref('holdMs', this.holdMs);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.snap, label: t("滑动选字"),
                        state: () => snapText[this.qRead('popupSnap', this.popupSnap)] || snapText[1],
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.popupSnap = this.qStep('popupSnap', [0, 1, 2], this.popupSnap);
                            quickPref('popupSnap', this.popupSnap);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.menu, label: t("长按菜单"),
                        state: () => t("{0} 个键盘", this.menuModes().length),
                        tap: () => { this.settingsPage = 'menu'; this.renderSettingsPanel(); },
                    },
                    {
                        icon: ICONS.keyboard, label: t("定制键盘"),
                        state: () => (customRows
                            ? t("已定制 {0} 个键", customRows.reduce((sum, row) => sum + (row || []).length, 0))
                            : t("未定制")),
                        tap: () => { this.settingsPage = 'custom'; this.renderSettingsPanel(); },
                    },
                    {
                        icon: ICONS.dp, label: t("双拼方案"),
                        state: () => dpText[this.qRead('dpScheme', dpScheme)] || dpText.ziranma,
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            quickPref('dpScheme', this.qStep('dpScheme', ['ziranma', 'flypy', 'sogou', 'ziguang'], dpScheme));
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.swap, label: t("编辑工具栏"),
                        tap: () => {
                            this.closeSettingsPanel();
                            this.enterToolbarEdit();
                        },
                    },
                    {
                        icon: ICONS.gear, label: t("完整设置"), big: true,
                        tap: () => {
                            this.closeSettingsPanel();
                            this.call(() => Native.openSetup(this.token));
                        },
                    },
            ];
        }

        /** 自然码键位图（，重排，再调）：说明统一
         * 在示意图上方；每行独立居中（不再用 shift/⌫ 占位格凑宽度）；
         * 双韵母键内上下两行；V 的前两个短 candidate 并排一行（ui ü）。 */
        /** The custom table is PASTED JSON now - one editor for
         * the whole table (validation errors are shown, never swallowed),
         * plus a template button for a quick start. */
        renderCustomPage(panel) {
            const box = document.createElement('div');
            box.className = 'custom-editor';
            const hint = document.createElement('div');
            hint.className = 'pair-hint';
            hint.textContent =
                t("粘贴 JSON 定义符号键盘（最多 3 行，每行键数不限）：t=键面，") +
                t("tap=单击行为（文本 / [esc] 单键 / [ctrl+s] 组合，可混排，如 [esc]ggVGD），") +
                t("note=长按说明。超宽的行可以左右拖动查看。");
            box.append(hint);
            const status = document.createElement('div');
            status.className = 'set-row';
            const label = document.createElement('span');
            label.className = 'set-label';
            label.textContent = t("当前状态");
            const preview = document.createElement('span');
            preview.className = 'custom-preview';
            const rows = this.customKeys();
            preview.textContent = rows
                ? t("已定制 {0} 个键", rows.reduce((sum, row) => sum + (row || []).length, 0))
                : t("未定制");
            status.append(label, preview);
            const actions = document.createElement('div');
            actions.className = 'custom-actions';
            const edit = document.createElement('button');
            edit.className = 'set-opt set-nav';
            edit.textContent = t("粘贴 JSON ›");
            edit.setAttribute('aria-label', t("粘贴 JSON 定制键盘"));
            edit.addEventListener('click', () => this.openCustomJsonEditor());
            const template = document.createElement('button');
            template.className = 'set-opt set-nav';
            template.textContent = t("插入模板 ›");
            template.setAttribute('aria-label', t("插入定制模板"));
            template.addEventListener('click', () => this.openCustomJsonEditor(CUSTOM_TEMPLATE));
            actions.append(edit, template);
            box.append(status, actions);
            panel.append(box);
        }

        /** Edit the whole custom table as JSON in the shared
         * editor strip (textarea; system paste works there). */
        openCustomJsonEditor(prefill = null) {
            this.editorReturn = 'custom';
            this.customEditRow = null;
            const current = this.customKeys();
            const rows = current || [[], [], []];
            const editor = document.getElementById('panelEditor');
            const input = document.getElementById('panelEditorInput');
            const area = document.getElementById('panelEditorArea');
            input.hidden = true;
            area.hidden = false;
            area.value = prefill != null ? prefill
                : JSON.stringify({ version: 1, rows }, null, 2);
            area.placeholder = t("粘贴定制 JSON");
            this.editorMode = 'custom-json';
            this.closeSettingsPanel();
            this.showKeyLayer('letters');
            document.body.classList.add('editing');
            editor.hidden = false;
            area.focus();
            this.setPanelInput(true);
        }

        /** Validate + persist the pasted JSON. Errors keep the
         * editor open and name the first problem - nothing is truncated
         * silently. */
        saveCustomJson(text) {
            const parsed = this.parseCustomKeys(text);
            if (parsed.error) {
                this.showToast(parsed.error);
                return;
            }
            try {
                const payload = JSON.stringify({ version: 1, rows: parsed.rows });
                localStorage.setItem(CUSTOM_KEYS_STORE, payload);
                Native.setCustomKeys(payload, this.token);
            } catch (_) {
                this.showToast(t("保存失败：本地存储不可用"));
                return;
            }
            this.editorMode = null;
            // The symbol strip's 定制 tab exists only once the table has
            // content - refresh it wherever we are (showSymbols re-runs this
            // anyway before the layer is next shown).
            this.renderSymbolCats();
            this.closePanelEditor();
            this.showToast(t("已保存 {0} 个键", parsed.rows.reduce((sum, row) => sum + row.length, 0)));
        }

        /** Quick-switch sub-page : pick EXACTLY the two keyboards
         * the toggle key flips between - tick first, then the name. The
         * long-press list is a separate setting (renderMenuEditor). */
        renderPairEditor(panel) {
            const box = document.createElement('div');
            box.id = 'pairEditor';
            const hint = document.createElement('div');
            hint.className = 'pair-hint';
            hint.textContent =
                t("勾选两项作为切换键的快捷切换对（点已勾选项无效果，点未勾选项会替换最早勾选的一项）");
            box.append(hint);
            this.orderedModeNames().forEach(name => {
                const row = document.createElement('div');
                row.className = 'pair-row';
                row.dataset.mode = name;
                const tick = document.createElement('button');
                const on = this.quickPair.includes(name);
                tick.className = 'pair-tick' + (on ? ' on' : '');
                tick.textContent = on ? '✓' : '';
                tick.setAttribute('aria-label', t("快捷切换 {0}", t(MODES[name].title)));
                const label = document.createElement('span');
                label.className = 'pair-name';
                label.textContent = t(MODES[name].title);
                tick.addEventListener('click', () => {
                    // Exactly two stay ticked: the pair must never drop to
                    // one (the toggle shorthand would lie), so an un-tick is
                    // a no-op and a new tick replaces the oldest member.
                    if (this.quickPair.includes(name)) return;
                    this.quickPair.push(name);
                    if (this.quickPair.length > 2) this.quickPair.shift();
                    try { localStorage.setItem('feelime_quick_pair', JSON.stringify(this.quickPair)); } catch (_) {}
                    pushStores();
                    this.updateToggleLabels();
                    box.querySelectorAll('.pair-row').forEach(el => {
                        const active = this.quickPair.includes(el.dataset.mode);
                        const t = el.querySelector('.pair-tick');
                        t.classList.toggle('on', active);
                        t.textContent = active ? '✓' : '';
                    });
                });
                row.append(tick, label);
                box.append(row);
            });
            panel.append(box);
        }

        /** Long-press menu sub-page : tick WHICH keyboards appear
         * in the toggle's long-press menu (default: all; at least one stays),
         * and drag to reorder that menu. Tick first, drag handle last. */
        renderMenuEditor(panel) {
            const box = document.createElement('div');
            box.id = 'menuEditor';
            const hint = document.createElement('div');
            hint.className = 'pair-hint';
            hint.textContent = t("勾选长按切换键时列出的键盘 · 拖动排序（至少保留一个）");
            box.append(hint);
            const enabled = this.menuModes();
            this.orderedModeNames().forEach(name => {
                const row = document.createElement('div');
                row.className = 'pair-row';
                row.dataset.mode = name;
                const tick = document.createElement('button');
                const on = enabled.includes(name);
                tick.className = 'pair-tick' + (on ? ' on' : '');
                tick.textContent = on ? '✓' : '';
                tick.setAttribute('aria-label', t("长按菜单显示 {0}", t(MODES[name].title)));
                const label = document.createElement('span');
                label.className = 'pair-name';
                label.textContent = t(MODES[name].title);
                const handle = document.createElement('span');
                handle.className = 'pair-drag';
                handle.textContent = '≡';
                handle.setAttribute('aria-label', t("拖动排序"));
                tick.addEventListener('click', () => {
                    // At least one keyboard stays listed: dropping the last
                    // tick is ignored (an empty menu would brick the picker).
                    const current = this.menuModes();
                    if (current.includes(name) && current.length <= 1) return;
                    const next = current.includes(name)
                        ? current.filter(m => m !== name)
                        : [...current, name];
                    try {
                        localStorage.setItem('feelime_menu_modes', JSON.stringify(next));
                    } catch (_) {}
                    pushStores();
                    tick.classList.toggle('on', next.includes(name));
                    tick.textContent = next.includes(name) ? '✓' : '';
                });
                row.append(tick, label, handle);
                box.append(row);
                this.bindListDrag(row, box, '.pair-row', 'mode', order => {
                    try { localStorage.setItem('feelime_mode_order', JSON.stringify(order)); } catch (_) {}
                    pushStores();
                });
            });
            panel.append(box);
        }

        /** Minimal in-flow touch drag (pairs, phrases):
         * while the finger holds a row handle the row swaps with whatever
         * sibling it crosses; onDrop receives the resulting row-id order. */
        bindListDrag(row, box, rowSelector, idAttr, onDrop) {
            const handle = row.querySelector('.pair-drag');
            handle.addEventListener('touchstart', event => {
                event.preventDefault();
                event.stopPropagation();
                row.classList.add('dragging');
                const move = ev => {
                    ev.preventDefault();
                    const y = ev.touches[0].clientY;
                    for (const other of box.querySelectorAll(rowSelector)) {
                        if (other === row) continue;
                        const r = other.getBoundingClientRect();
                        if (y >= r.top && y <= r.bottom) {
                            if (y > r.top + r.height / 2 && row.nextElementSibling !== other) {
                                box.insertBefore(row, other.nextElementSibling);
                            } else if (y <= r.top + r.height / 2 && row.previousElementSibling !== other) {
                                box.insertBefore(row, other);
                            }
                            break;
                        }
                    }
                };
                const up = () => {
                    row.classList.remove('dragging');
                    handle.removeEventListener('touchmove', move);
                    handle.removeEventListener('touchend', up);
                    handle.removeEventListener('touchcancel', up);
                    onDrop([...box.querySelectorAll(rowSelector)].map(el => el.dataset[idAttr]));
                };
                handle.addEventListener('touchmove', move, { passive: false });
                handle.addEventListener('touchend', up);
                handle.addEventListener('touchcancel', up);
            }, { passive: false });
        }


        /** Saved drag order  applied to the long-press menu. */
        modeOrder() {
            const ordered = this.orderedModeNames();
            // The long-press menu shows ONLY the keyboards the user
            // enabled (default: all) - not everyone wants fr/ru/ja there.
            // The quick toggle always reaches the pair regardless.
            let menu = null;
            try { menu = JSON.parse(localStorage.getItem('feelime_menu_modes') || 'null'); } catch (_) {}
            if (Array.isArray(menu)) {
                const filtered = ordered.filter(name => menu.includes(name));
                if (filtered.length) return filtered;
            }
            return ordered;
        }

        /** Every known keyboard in the saved drag order (unfiltered). */
        orderedModeNames() {
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem('feelime_mode_order') || 'null'); } catch (_) {}
            const names = Object.keys(MODES);
            if (Array.isArray(saved)) {
                const clean = saved.filter(n => MODES[n]);
                names.forEach(n => { if (!clean.includes(n)) clean.push(n); });
                return clean;
            }
            return names;
        }

        /** Which keyboards the long-press menu lists. Null = all. */
        menuModes() {
            let menu = null;
            try { menu = JSON.parse(localStorage.getItem('feelime_menu_modes') || 'null'); } catch (_) {}
            const filtered = Array.isArray(menu) && menu.length
                ? this.orderedModeNames().filter(name => menu.includes(name))
                : null;
            // Unknown ids only would resolve to nothing - fall back to all.
            return filtered && filtered.length
                ? filtered
                : this.orderedModeNames();
        }

        /* ===== candidates ===== */

        clearComposing() {
            // 重输=用户明确放弃当前组合：挂起的两步逗号一并作废（codex
            // 评审 P1——clearComposing 本地合成 composing:false 事件，会
            // 把 pendingPunct 提前补出去）。
            this.pendingPunct = null;
            this.call(() => Native.clearComposing(this.token));
            // Optimistic local restore: the engine event roundtrip also clears
            // composing, but the toolbar must not lag a roundtrip behind the
            // tap. If the bridge rejects (stale token), the next engine event
            // repaints the true state anyway.
            this.composing = false;
            this.updateComposing({ composing: false }, '');
            if (this.expanded) this.setExpanded(false);
        }

        setExpanded(expanded) {
            this.expanded = expanded;
            document.body.classList.toggle('expanded', expanded);
            document.getElementById('expandLayer').hidden = !expanded;
            if (expanded) {
                // Pin the accumulation to the current composition; picking ˅
                // again after a collapse keeps the already-fetched candidates.
                const key = this.lastRawInput || '';
                if (key !== this.expandKey) {
                    this.expandKey = key;
                    this.expandCandidates = [];
                    // A NEW composition must not inherit the
                    // previous parse's variant list - the anchor pin exists
                    // for in-place variant switches (finishVariantReplay),
                    // not across compositions. xi'j opened after an x'an
                    // session would otherwise show x'an's sixteen variants.
                    this.variantAnchor = null;
                }
                this.loadingMore = false;
                this.accumulateCandidates(this.lastEngineState || {});
                // OnEngineState now owns expandKey even while the
                // layer is closed, so a key-diff here no longer detects the
                // first open - repaint the grid (and the shared bar) on
                // every open from the pool we already hold.
                this.renderExpanded();
                this.renderCandidates(this.lastEngineState || {});
                // A strip shorter than the viewport can never be scrolled, so
                // preload the next page right away (until it overflows).
                this.maybeLoadMoreCandidates();
            } else {
                // Collapse keeps the fetched pages; a NEW composition clears
                // them (onEngineState resets expandKey) and so does clearing
                // the composition entirely.
                document.getElementById('expandPreedit').textContent = '';
            }
        }

        /** Merge one engine state's candidates into the strip (dedupe by id). */
        accumulateCandidates(state) {
            const known = new Set(this.expandCandidates.map(candidate => candidate.id));
            (state.candidates || []).forEach(candidate => {
                if (!known.has(candidate.id)) this.expandCandidates.push(candidate);
            });
            this.expandHasNext = !!state.hasNextPage;
            this.loadingMore = false;
            this.injectFavoriteCandidates();
            // 符号重排（issue #17）可能改写池前缀：展开区的增量水位线
            // （expandRendered 按旧索引跳过已绘制部分）与新顺序错位会漏项/
            // 重复。前缀一变就全量重绘展开层（renderExpanded 自带水位线
            // 重置与 DOM 清空）。
            if (this.symbolicPrefixChanged) {
                this.symbolicPrefixChanged = false;
                this.renderExpanded();
            }
        }

        /** 常用语注入 (design §7.4): favorites whose input code
         * prefixes the raw keys join the shared pool. Exact code matches take
         * their configured 1-based rank slot (default 1 = the pool
         * head, as before rank slots existed); prefix matches sit after the
         * engine's first candidate.
         * These are overlay entries (fav:<id>) - the engine holds no such
         * candidate, so choosing them commits the text directly instead of
         * Native.chooseCandidate. The pool is RECOMPUTED from the
         * engine slice every call (all fav: entries are stripped first), so
         * list edits mid-composition converge instead of losing or stranding
         * earlier fav entries.
         * Accent variants (alt:<char>) join the same overlay -
         * the layout's accented long-press set for the composition's FIRST
         * character, so typing "ete" offers é/è/ê/ë one tap away (iOS-style;
         * picking one REPLACES the first character and keeps composing via
         * switchToVariant). Position is AFTER the engine's first candidate
         * (never at the head - the space key confirms
         * expandCandidates[0], and "a"+space must stay "a", not "à").
         * Only accented glyphs are taken - alts also carry digits/'-' which
         * must not surf in the word bar. */
        injectFavoriteCandidates() {
            const rawEngine = this.expandCandidates.filter(candidate =>
                !String(candidate.id).startsWith('fav:') &&
                !String(candidate.id).startsWith('alt:'));
            // 符号词条重排（issue #17）先于 overlay 组装：custom_phrase 通道
            // 的符号/emoji 词在引擎侧受 initial_quality 的 0/1 悬崖支配（第
            // 1 位或沉底，weight 无法跨流微调），在 ENGINE 池内把纯符号词
            // 挪到 index 2（两个正常候选保持在最前）。先排引擎序、后插
            // overlay，常用语 rank 位次与空格确认的池头语义不被符号挪动
            // 二次改写；中文自定义词（含汉字/字母）不动。bar/展开层/选词
            // 通道共用同一池，天然一致。
            const symbolic = rawEngine.filter(candidate => isSymbolicText(candidate.text));
            let engine = rawEngine;
            if (symbolic.length) {
                const rest = rawEngine.filter(candidate => !symbolic.includes(candidate));
                engine = [...rest.slice(0, 2), ...symbolic, ...rest.slice(2)];
            }
            // 笔画句子候选压后（issue #18）：词典 max_phrase_length=1，
            // 多字候选必来自 enable_sentence 造句（☯；comment 不在桥协议
            // 里，按字长识别）。不压后的话 h'z 的句子「一乙」会顶掉首字
            // 候选，空格确认整段上屏（probe 实测首格被句子占据）。
            if (this.mode === 'stroke') {
                const sentences = engine.filter(candidate =>
                    [...candidate.text].length > 1);
                if (sentences.length) {
                    const rest = engine.filter(candidate => !sentences.includes(candidate));
                    engine = [...rest, ...sentences];
                }
            }
            // 池前缀 id 签名变了 → 展开区增量水位线与新顺序错位（会漏项/
            // 重复），标记让 accumulateCandidates 全量重绘。签名必须覆盖
            // 「已渲染」的整段前缀（取 max(expandRendered, 3)）——句子压后
            // 发生在池中部时只看前 3 项发现不了（codex 评审 P1 复现：翻页
            // 后「二」漏绘、「才丿」重复）；纯追加不动已有顺序时不触发，
            // 保留拖动预载的增量渲染。
            const prefixSig = engine.slice(0, Math.max(this.expandRendered, 3))
                .map(candidate => candidate.id).join('|');
            if (prefixSig !== this.symbolicPrefixSig) {
                this.symbolicPrefixSig = prefixSig;
                this.symbolicPrefixChanged = true;
            }
            const raw = (this.lastRawInput || '').replace(/ /g, '').toLowerCase();
            const engineTexts = new Set(engine.map(candidate => candidate.text));
            const exact = [];
            const prefix = [];
            if (raw) {
                (this.favoriteItems || []).forEach(item => {
                    const code = (item.code || '').toLowerCase();
                    if (!code || !raw.startsWith(code)) return;
                    if (engineTexts.has(item.text)) return;
                    (raw === code ? exact : prefix).push({
                        id: `fav:${item.id}`, text: item.text, favorite: true,
                        rank: item.rank || 1,
                    });
                });
            }
            // Accent variants: accented alts of the composition's first char.
            const variants = [];
            if (raw) {
                const layout = LAYOUTS[MODES[this.mode] && MODES[this.mode].layout];
                const alts = layout && layout.alts[raw[0]];
                if (Array.isArray(alts)) {
                    alts.forEach(ch => {
                        // Non-ASCII only (drops the '9'/'-' row entries) and
                        // never duplicate what the engine already shows.
                        if (ch.charCodeAt(0) < 128 || engineTexts.has(ch)) return;
                        variants.push({ id: `alt:${ch}`, text: ch, variant: true });
                    });
                }
            }
            // 位次插槽 order (design §7.4): the pool without exact favs runs
            // engine head, accent variants, prefix favs, engine rest. Exact
            // favs then splice into their 1-based rank slots: rank 1 = pool
            // head (the behaviour before rank slots), rank N = the Nth visible
            // candidate, ties keep list order side by side, and a rank past
            // the pool end clamps to the tail.
            const pool = [
                ...engine.slice(0, 1),
                ...variants,
                ...prefix,
                ...engine.slice(1),
            ];
            let prevRank = 0;
            let prevIndex = -1;
            exact
                .slice()
                .sort((a, b) => a.rank - b.rank)
                .forEach(item => {
                    const at = item.rank === prevRank
                        ? prevIndex + 1
                        : Math.min(item.rank - 1, pool.length);
                    pool.splice(at, 0, item);
                    prevRank = item.rank;
                    prevIndex = at;
                });
            this.expandCandidates = pool;
        }

        /** Single pick funnel for pool entries: engine ids ride the engine
         * channel; overlay favorites clear the composition and commit;
         * accent variants swap the first character and KEEP the
         * composition alive - pick é on "ete" and it becomes "éte",
         * still composing (iOS-style, via the atomic setComposition). */
        choosePoolCandidate(candidate) {
            if (candidate && String(candidate.id).startsWith('fav:')) {
                this.call(() => Native.clearComposing(this.token));
                this.call(() => Native.commitText(candidate.text, this.token));
                return;
            }
            if (candidate && String(candidate.id).startsWith('alt:')) {
                const raw = (this.lastRawInput || '').replace(/ /g, '');
                this.switchToVariant(candidate.text + raw.slice(1));
                return;
            }
            this.call(revision => Native.chooseCandidate(revision, candidate.id, this.token));
        }

        /** Fresh composition: the filter tab returns to 词频 (word freq). */
        resetExpandTab() {
            this.expandTab = 'freq';
            document.querySelectorAll('[data-expand-tab]').forEach(el => (
                el.classList.toggle('active', el.dataset.expandTab === 'freq')));
        }

        renderExpanded() {
            const strip = document.getElementById('expandGrid');
            document.getElementById('expandPreedit').textContent =
                this.mode === 't9'
                    ? (this.t9Reading() || this.t9PreeditLabel(this.lastRawInput))
                    : (this.lastRawInput || '');
            strip.replaceChildren();
            this.expandRendered = 0;
            this.renderVariants();
            this.appendExpandedCandidates();
        }

        /** Parse variants (double pinyin): every way to read the raw
         * keys as exact syllables or first-key abbreviations. The first entry
         * is the raw input itself; a single-key first segment expands into
         * every syllable that starts with it (xi'an, xy'an, xr'an ...), and
         * longer inputs offer syllable-boundary prefixes (vf, vf'x ...) whose
         * trailing segment the engine completes via its abbreviations. */
        expandVariantsFor(rawInput) {
            // The engine echo interleaves display-only spaces at segment
            // boundaries ('x an''); the variant space speaks pure key codes.
            const raw = (rawInput || '').replace(/ /g, '');
            if (this.mode === 'pinyin') {
                const input = (rawInput || '').replace(/’/g, "'").toLowerCase().trim();
                if (!input || input.length > 64 || !/^[a-z' \t]+$/.test(input)) return [];
                const segments = input.split(/[' \t]+/).filter(Boolean);
                if (segments.length < 2) return [];
                const incomplete = [];
                for (let index = 0; index < segments.length; index++) {
                    const segment = segments[index];
                    if (FULL_PINYIN_SYLLABLES.includes(segment)) continue;
                    if (!FULL_PINYIN_SYLLABLES.some(value => value.startsWith(segment))) return [];
                    incomplete.push(index);
                }
                if (incomplete.length !== 1) return [];
                const index = incomplete[0];
                return FULL_PINYIN_SYLLABLES.filter(value => value.startsWith(segments[index]))
                    .map(value => segments.map((segment, at) =>
                        at === index ? value : segment).join("'"));
            }
            if (!raw || this.mode !== 'double-pinyin') return [];
            const variants = [];
            const seen = new Set([raw]);
            const push = keys => {
                if (!seen.has(keys)) { seen.add(keys); variants.push(keys); }
            };
            const segments = raw.split("'");
            const first = segments[0];
            if (first.length === 1 && segments.length > 1) {
                const finals = dpFinals()[first[0]] || '';
                for (const final of finals) {
                    const keys = first + final + "'" + segments.slice(1).join("'");
                    // Only exact double-key syllables - the expansion exists
                    // to pin one exact parse, not to re-abbreviate.
                    push(keys);
                }
            }
            // Every segment a complete 2-key syllable means the
            // user TYPED the full parse (xi'an) - it pins itself and the
            // column must not offer prefix re-reads (xi). The expansion only
            // disambiguates single-key abbreviations (x'an, vf'x).
            if (segments.some(seg => seg.length === 1)) {
                const joined = raw.replace(/'/g, '');
                for (let cut = 2; cut <= joined.length - 2; cut += 2) {
                    push(joined.slice(0, cut));
                }
            }
            return variants;
        }

        renderVariants() {
            const column = document.getElementById('expandVariants');
            column.replaceChildren();
            // T9：左列改渲染音节候选（与键盘左列同一枚举），右侧仍是
            // 该组合的候选字词——用户要的「完整候选界面」（t9.md §3）。
            if (this.mode === 't9') {
                const seg = this.t9PendingSegment();
                if (!seg) { column.hidden = true; return; }
                column.hidden = false;
                const makeSyllable = (syllable, disabled) => {
                    const button = document.createElement('button');
                    button.className = 'expand-variant';
                    button.textContent = syllable;
                    if (disabled) button.disabled = true;
                    else button.addEventListener('click', () =>
                        this.t9PickSyllable(syllable, seg));
                    column.append(button);
                };
                const { full, pre } = this.t9SegmentSyllables(seg);
                full.forEach(s => makeSyllable(s, false));
                pre.forEach(p => makeSyllable(p, true));
                return;
            }
            const raw = this.mode === 'pinyin'
                ? (this.lastRawInput || '').trim().replace(/ +/g, "'")
                : (this.lastRawInput || '').replace(/ /g, '');
            // Pin the list to the parse the area was opened with: switching
            // to xc'an moves the highlight but keeps x'an/xd'an/xi'an/...
            // listed (a list rebuilt from the new raw would shrink to its
            // own two entries).
            if (!this.variantAnchor) this.variantAnchor = raw;
            const anchor = this.variantAnchor;
            const variants = this.expandVariantsFor(anchor);
            // Full pinyin keeps the same two columns for complete spellings;
            // its current spelling remains visible even without alternatives.
            column.hidden = variants.length === 0 && !(this.mode === 'pinyin' && anchor);
            const makeButton = keys => {
                const button = document.createElement('button');
                button.className = 'expand-variant' + (keys === raw ? ' current' : '');
                button.textContent = keys;
                button.addEventListener('click', () => this.switchToVariant(keys));
                column.append(button);
            };
            if (!column.hidden) {
                makeButton(anchor);
                variants.forEach(makeButton);
            }
        }

        /** Switch to a parse variant IN PLACE: the variant highlights at once
         * and the right-hand grid swaps to that parse's candidates. The
         * rewind+retype happens inside one native call, so there is no
         * visible delete-and-retype and the layer never collapses. The grid
         * keeps the previous parse's candidates until the target echo lands
         * (variantReplaying suppresses intermediate re-renders). */
        switchToVariant(keys) {
            if (this.variantReplaying) return;
            clearTimeout(this.variantReplayTimer);
            this.variantReplaying = true;
            this.variantWasExpanded = this.expanded;
            this.variantTarget = keys;
            // Optimistic highlight; the list itself stays put. The grid dims
            // and refuses taps while its ids still belong to the previous
            // parse (taps during the swap used to be lost).
            // T9 音节点选没有变体列（列表是音节枚举，非解析变体），跳过。
            if (this.mode !== 't9') {
                document.querySelectorAll('#expandVariants .expand-variant').forEach(el => {
                    el.classList.toggle('current', el.textContent === keys);
                });
            }
            document.getElementById('expandGrid').classList.add('reloading');
            document.getElementById('expandPreedit').textContent = keys;
            if (typeof Native.setComposition === 'function') {
                this.call(() => Native.setComposition(keys, this.token));
            } else {
                // Older native bridge: fall back to per-key replay.
                const previous = (this.lastRawInput || '').replace(/ /g, '');
                const replay = [];
                for (let i = 0; i < previous.length; i++) replay.push('<backspace>');
                for (const ch of keys) replay.push(ch);
                const step = () => {
                    if (!replay.length) return;
                    const next = replay.shift();
                    if (next === '<backspace>') {
                        this.call(() => Native.backspace(this.token));
                    } else {
                        this.call(() => Native.key(next, this.token));
                    }
                    setTimeout(step, 45);
                };
                step();
            }
            // Safety valve: the guard normally lifts on the echo carrying the
            // target composition. If that echo never arrives (bridge failure)
            // the layer must not stay frozen forever.
            this.variantReplayTimer = setTimeout(() => {
                if (this.variantReplaying) this.finishVariantReplay();
            }, 1500);
        }

        /** Lift the replay guard once the target composition's echo has
         * landed (safety valve: 1500ms without it), then refresh the grid
         * on the chosen parse. The refresh must NOT go through the
         * expandKey reset - that path clears the variant anchor and would
         * shrink the list to the new parse's own expansions. */
        finishVariantReplay() {
            clearTimeout(this.variantReplayTimer);
            this.variantReplayTimer = null;
            this.variantReplaying = false;
            this.variantTarget = null;
            document.getElementById('expandGrid').classList.remove('reloading');
            if (!this.expanded && this.variantWasExpanded) {
                this.setExpanded(true);
                return;
            }
            const state = this.lastEngineState || {};
            const rawEcho = state.rawInput || state.composing || '';
            // onEngineEvent order: the target-echo detection above runs before
            // updateComposing, so lastRawInput still holds the old parse here.
            if (rawEcho) this.lastRawInput = rawEcho;
            this.expandKey = rawEcho;
            this.expandCandidates = [];
            this.accumulateCandidates(state);
            this.renderExpanded();
            // The bar shares the pool - the safety-valve path
            // (timeout without the target echo) must not strand it on the
            // previous parse's candidates.
            this.renderCandidates(state);
        }

        /** Incremental strip append (P1-2): replacing the whole strip would
         * collapse scrollWidth and clamp scrollLeft back to 0 on every page
         * fetch - the endless drag would snap to the left each time. The
         * filter tab re-renders fully (renderExpanded); appends stay
         * incremental for the same tab. */
        appendExpandedCandidates() {
            const strip = document.getElementById('expandGrid');
            const visible = this.expandCandidates.filter(candidate =>
                this.expandTab !== 'single' || [...candidate.text].length === 1);
            visible.forEach((candidate, index) => {
                if (index < this.expandRendered) return;
                const button = document.createElement('button');
                button.className = index === 0 ? 'expand-candidate first' : 'expand-candidate';
                button.textContent = candidate.text;
                // Native clicks only: bindTouch preventDefaults touchstart,
                // which cancels the strip's pan .
                let longPressed = false;
                button.addEventListener('click', () => {
                    if (longPressed) { longPressed = false; return; }
                    this.choosePoolCandidate(candidate);
                });
                this.bindCandidateLongPress(button, candidate, () => { longPressed = true; });
                // Same mousedown guard as the bar : the
                // expanded grid is reachable while the phrase editor is open.
                button.addEventListener('mousedown', event => event.preventDefault());
                strip.append(button);
                this.expandRendered += 1;
            });
            // Empty state lives here so a reset->append sequence can never
            // strand a stale placeholder next to freshly added candidates.
            if (!visible.length) {
                if (!strip.querySelector('.expand-empty')) {
                    const empty = document.createElement('div');
                    empty.className = 'expand-empty';
                    empty.textContent = this.expandTab === 'single' ? t("暂无单字") : t("暂无候选");
                    strip.append(empty);
                }
            } else {
                const empty = strip.querySelector('.expand-empty');
                if (empty) empty.remove();
            }
        }

        /** Fetch the next page when the visible candidate surface is scrolled
         * near its end (or too short to scroll at all). The bar
         * (horizontal) joins the expanded grid (vertical) - whichever is on
         * screen drives the shared native cursor. */
        maybeLoadMoreCandidates() {
            if (!this.expandHasNext || this.loadingMore) return;
            // 笔画组合中不追页（三个调用点统一在这拦）：候选池本来就只有
            // 几条（completion 单字 + 压后的句子候选），条永远不满，
            // 「拉到溢出为止」会在组合中每键自动发一次 PAGE_DOWN——
            // librime 的 Next 耗尽 MakeSentence 翻译流后还会挪 selector
            // 高亮，composition 直接塌成分段坏态（那'个 →「乙hhpzs'p」，
            // device + INFO 日志实锤 2026-09-20）。拼音候选多、一两页就
            // 溢出停止，不受影响。
            if (this.mode === 'stroke' && this.composing) return;
            const strip = document.getElementById('expandGrid');
            const bar = document.getElementById('candidates');
            let nearEnd = false;
            let tooShort = false;
            if (this.expanded) {
                if (!strip.children.length) return;
                const top = strip.scrollTop || 0;
                const height = strip.clientHeight || 0;
                const total = strip.scrollHeight || 0;
                nearEnd = top + height >= total - 120;
                tooShort = total <= height;
            } else {
                const left = bar.scrollLeft || 0;
                const width = bar.clientWidth || 0;
                const total = bar.scrollWidth || 0;
                if (!total) return;
                nearEnd = left + width >= total - 120;
                tooShort = total <= width;
            }
            if (!nearEnd && !tooShort) return;
            this.loadingMore = true;
            this.call(revision => Native.pageNext(revision, this.token));
            // A rejected fetch (stale token/stamp) emits no engine event and
            // would leave loadingMore stuck true - rearm after a beat.
            setTimeout(() => { this.loadingMore = false; }, 900);
        }

        renderCandidates(state) {
            // Variant replay bursts intermediate events: freeze the bar like
            // the grid (the replay's target echo repaints it).
            if (this.variantReplaying) return;
            // T9：1 键展开的西文/技术符号行。引擎候选/联想/组合任一
            // 出现即让位（符号行是暂态选择面，不与候选池共存）。
            if (this.t9SymBar) {
                if (state.composing || (this.mode !== 't9' && this.mode !== 'stroke') ||
                    (this.expandCandidates || []).length || this.assocWords.length) {
                    this.t9RestoreBarChrome(state.composing);
                } else {
                    this.renderT9SymbolBar();
                    return;
                }
            }
            // 中文联想 chrome（用户定稿）：有联想词时工具栏全部让位（含
            // mic）仅留 ×；onAssoc 直调这里、不经过 updateComposing，
            // 联想的出现与消失都在这条统一兜住。组合/语音态不动（各由
            // updateComposing 管）。
            if (!state.composing && this.voiceState === 'idle') {
                this.setToolbarYield(this.assocWords.length > 0);
            }
            const bar = document.getElementById('candidates');
            // Full repaints would clamp scrollLeft back to 0 mid-drag - the
            // exact bar-side version of the grid bug appendExpandedCandidates
            // exists for. Hold and restore across the rebuild.
            const held = bar.scrollLeft || 0;
            bar.replaceChildren();
            // 中文联想（docs/design/association.md）：组合为空且无引擎候选时，
            // 候选条展示上屏词的后继联想；组合开始即让位（assocWords 已清）。
            if (!(this.expandCandidates || []).length &&
                this.assocWords.length && !state.composing) {
                this.assocWords.forEach(word => {
                    const button = document.createElement('button');
                    button.className = 'candidate assoc';
                    button.textContent = word;
                    button.addEventListener('click', () => this.commitAssocWord(word));
                    button.addEventListener('mousedown', event => event.preventDefault());
                    bar.append(button);
                });
                bar.scrollLeft = held;
                return;
            }
            // The bar renders the WHOLE accumulated pool (same pool
            // the expanded grid scrolls) - native paging must not cap it at
            // one page, and swiping the bar reveals the rest. The first pool
            // entry keeps the highlighted pill.
            (this.expandCandidates || []).forEach((candidate, index) => {
                const button = document.createElement('button');
                button.className = index === 0 ? 'candidate first' : 'candidate';
                button.textContent = candidate.text;
                let longPressed = false;
                button.addEventListener('click', () => {
                    // A long-press opens the delete menu; the
                    // release would otherwise also fire the pick (same guard
                    // as the favorites rows).
                    if (longPressed) { longPressed = false; return; }
                    this.choosePoolCandidate(candidate);
                });
                this.bindCandidateLongPress(button, candidate, () => { longPressed = true; });
                // Native clicks only - bindTouch preventDefaults the
                // touchstart, which is exactly what cancels the bar's native
                // horizontal pan (the strip must stay swipeable).
                // Review P1: a mousedown's default focus move would
                // blur the phrase editor input mid-pick (the redirect then
                // lands the word in the host editor); suppressing it keeps
                // the tap a pure click without touching the pan.
                button.addEventListener('mousedown', event => event.preventDefault());
                bar.append(button);
            });
            // The ‹ › pager buttons are gone - the bar shows
            // the whole accumulated pool and swiping past the end auto-fetches
            // the next page (maybeLoadMoreCandidates).
            bar.scrollLeft = held;
            // A pool shorter than the bar can never be scrolled, so keep
            // pulling pages until the strip overflows (endless drag ready).
            if (!this.expanded) this.maybeLoadMoreCandidates();
        }

        /** M4 composing chrome: preedit line, toolbar swap, enter label. */
        updateComposing(state, rawInput) {
            // Variant replay fires a burst of intermediate engine events
            // (rewind passes through the empty composition); the UI must
            // stay frozen on the target parse until the replay settles.
            if (this.variantReplaying) return;
            const wasComposing = this.composing;
            this.composing = !!state.composing;
            if (this.composing && rawInput !== undefined) this.lastRawInput = rawInput;
            // 8 键组合中逗号的两步收尾（issue #18）：候选确认的回声把组合
            // 收掉后，直发挂起的全角 ，；组合继续且 raw 变了（用户接着打）
            // 或确认被拒超时（3s 无回声收尾）则作废——迟到的逗号比缺逗号
            // 更糟。重输/切模式在各自入口显式作废。
            if (this.pendingPunct) {
                const pending = this.pendingPunct;
                const rawChanged = pending.raw !== undefined &&
                    pending.raw !== this.lastRawInput;
                const stale = Date.now() - pending.at > 3000;
                if (!this.composing) {
                    this.pendingPunct = null;
                    this.sendSymbol(pending.text);
                } else if (rawChanged || stale) {
                    this.pendingPunct = null;
                }
            }
            // 通配在途标志随任一回声解除（codex 评审 P2：两个 6 连点、
            // 回声未到时 raw 仍不含 *，会放进第二个 *）。
            this.wildcardInFlight = false;
            document.body.classList.toggle('composing', this.composing);
            const preedit = document.getElementById('preeditLine');
            preedit.textContent = this.composing
                ? (this.mode === 't9'
                    ? (this.t9Reading() || this.t9PreeditLabel(this.lastRawInput))
                    : this.lastRawInput)
                : '';
            if (!this.composing) {
                this.t9ConfirmedLen = 0;
                this._t9ConfirmedText = '';
            } else if (this.mode === 't9' && this.t9ConfirmedLen) {
                // 边界失效只看确认前缀本身有没有被动过：未确认尾段里退格
                // （ni 426 → ni 42）边界保留；删进已确认段（前缀对不上）
                // 才从头重算（codex round-4 P2-4）。变体重放的中间事件不
                // 会走到这里（variantReplaying 早退）。
                const raw = (this.lastRawInput || '').replace(/ /g, '');
                if (!raw.startsWith(this._t9ConfirmedText || '')) {
                    this.t9ConfirmedLen = 0;
                    this._t9ConfirmedText = '';
                }
            }
            const recording = this.voiceState !== 'idle';
            // Composing hides the setup/mode/clipboard tools but never the mic
            // while a voice session is active (the stop entry must survive).
            document.getElementById('setupButton').hidden = this.composing;
            const clipboardButtonEl = document.getElementById('clipboardButton');
            if (clipboardButtonEl) clipboardButtonEl.hidden = this.composing;
            const favoritesButtonEl = document.getElementById('favoritesButton');
            if (favoritesButtonEl) favoritesButtonEl.hidden = this.composing;
            // The new control/IME tools follow the same rule.
            // A composition started mid-control-view only
            // SUSPENDS the rows (switch stays on) - picking a candidate
            // brings them back via maybeResumeCtrlView below.
            const ctrlToolEl = document.getElementById('ctrlTool');
            if (ctrlToolEl) ctrlToolEl.hidden = this.composing;
            const imeSwitchButtonEl = document.getElementById('imeSwitchButton');
            if (imeSwitchButtonEl) imeSwitchButtonEl.hidden = this.composing;
            // 编辑模式可添加的工具（issue #15）随输入统一隐藏——composing
            // 时候选区空间宝贵；mic 例外（语音 stop 入口必须存活）。
            // 溢出集（单手等窄布局放不下的）在非 composing 时也保持隐藏。
            Object.values(TOOL_CATALOG).forEach(dom => {
                if (dom === 'mic') return;
                const el = document.getElementById(dom);
                if (el) el.hidden = this.composing
                    || (this._overflowTools && this._overflowTools.has(dom));
            });
            if (this.composing && this.ctrlView) this.suspendCtrlView();
            else if (!this.composing) this.maybeResumeCtrlView();
            // Keep the quick panel open while the user is typing
            // INTO it (phrase manager input) - the candidate bar sits above
            // the panel (top 44px) so the two coexist; anywhere else a
            // composition closes the panel as before.
            if (this.composing && !this.settingsInputFocus) this.closeSettingsPanel();
            // Compose controls exist only while there is something to clear.
            // A live voice session hides them too: the × must not clear the
            // ASR partial that shares the editor span .
            const voiceBusy = recording;
            document.getElementById('composeClear').hidden = !this.composing || voiceBusy;
            // T9 符号行 chrome 态：空闲刷新（onNativeState 回声、空引擎事
            // 件）不得把工具栏翻回来——× 是唯一取消入口（codex round-2
            // P2-4）。组合/语音中的可见性仍由上面的通用规则管。
            if ((this.mode === 't9' || this.mode === 'stroke') &&
                this.t9BarChrome && !this.composing && !voiceBusy) {
                this.setToolbarYield(true);
            } else if ((this.assocWords || []).length && !voiceBusy) {
                // 中文联想（用户定稿）：有联想词时工具栏全部让位（含
                // mic）仅留 ×。renderCandidates 会兜住引擎事件路径，这
                // 条覆盖 onNativeState 等不渲染候选条的刷新。
                this.setToolbarYield(true);
            }
            document.getElementById('composeExpand').hidden = !this.composing || voiceBusy;
            if (!this.composing && this.expanded && !this.variantReplaying) this.setExpanded(false);
            const mic = document.getElementById('mic');
            if (mic) mic.hidden = this.composing && !recording;
            // While composing the right side carries exactly two
            // buttons (× and ˅). The keyboard-dismiss chevron looks identical
            // to the expand arrow - hide it until the composition ends.
            document.getElementById('hide').hidden = this.composing;
            // Collapse overlays only on the idle→composing transition, so a
            // stream of unrelated native events cannot close an open menu.
            // Typing INTO a panel input (phrase add/edit) must
            // not close the panel under the user's fingers.
            if (this.composing && !wasComposing && !this.settingsInputFocus) {
                if (this.panelOpen) this.closePanel();
                this.closeModeMenu();
            }
            this.updateEnterLabel();
            // T9 左列跟随组合状态：空闲=常用字符，组合中=音节候选。
            this.renderT9Side();
        }

        /* ===== clipboard / favorites panel ===== */

        /** Tear the shared editor strip down completely: hide it, drop the
         * editing key-height override, release the native redirect and clear
         * every routing flag (review finding - leaving any of these
         * dangling strands the UI in half-torn-down states). */
        clearEditorStrip() {
            // The floating phrase card tears down with the same
            // semantics as the legacy strip (redirect released, editing
            // class dropped, item ref cleared).
            const card = document.getElementById('phraseCard');
            if (card.classList.contains('open')) {
                card.classList.remove('open');
                card.hidden = true;
                document.body.classList.remove('editing');
                if (this.settingsInputFocus) this.setPanelInput(false);
                this.panelEditItem = null;
            }
            const editor = document.getElementById('panelEditor');
            if (!editor.hidden) {
                editor.hidden = true;
                document.body.classList.remove('editing');
                if (this.settingsInputFocus) this.setPanelInput(false);
                this.panelEditItem = null;
            }
            this.customEditRow = null;
            this.editorReturn = null;
            this.editorMode = null;
        }

        openPanel(tab) {
            if (!this.ready) return;
            this.panelTab = tab === 'favorites' ? 'favorites' : 'clipboard';
            this.panelOpen = true;
            // Remember the layer to restore on close (panel can open from the
            // symbol layer too).
            this.panelReturnLayer = this.keyLayer;
            this.closeModeMenu();
            // The control view never coexists with the panel.
            // Borrow, don't switch off - closing the panel
            // brings the rows back.
            if (this.ctrlView) this.suspendCtrlView();
            // Review P2: the quick settings panel (z-index 30) would
            // sit above the panel layer and its gear is hidden with the
            // toolbar - close it or the user gets trapped.
            this.closeSettingsPanel();
            // Leaving the editor (cancel path) or a tab switch must
            // tear the editor strip down before the list shows.
            // Review P2 + Review P2: one teardown for
            // every flag and layer the strip owns.
            this.clearEditorStrip();
            this.closeItemMenu();
            // The panel REPLACES the toolbar row instead of adding
            // another line to the keyboard - its own head carries the tabs.
            document.getElementById('candidateBar').hidden = true;
            this.hideKeyLayers();
            document.getElementById('panelLayer').hidden = false;
            document.querySelectorAll('[data-panel-tab]').forEach(button => {
                button.classList.toggle('active', button.dataset.panelTab === this.panelTab);
            });
            document.getElementById('panelClear').hidden = this.panelTab !== 'clipboard';
            document.getElementById('panelManage').hidden = this.panelTab !== 'favorites';
            this.renderPanel();
            if (this.panelTab === 'clipboard') Native.getClipboard(this.token);
            else Native.getFavorites(this.token);
        }

        closePanel() {
            if (this.settingsInputFocus) this.setPanelInput(false);
            this.panelOpen = false;
            document.getElementById('panelLayer').hidden = true;
            document.getElementById('candidateBar').hidden = false;
            this.showKeyLayer(this.panelReturnLayer || 'letters');
            // The panel only borrowed the bar from the ctrl
            // view - hand the rows back if the switch is still on.
            this.maybeResumeCtrlView();
        }

        renderPanel() {
            const list = document.getElementById('panelList');
            const empty = document.getElementById('panelEmpty');
            list.replaceChildren();
            const items = this.panelTab === 'clipboard' ? this.clipboardItems : this.favoriteItems;
            empty.hidden = items.length > 0;
            if (!items.length) {
                empty.textContent = this.panelTab === 'clipboard'
                    ? t("剪贴板已开启，复制的内容将在这里显示")
                    : t("暂无常用语，点右上角「＋添加」");
                return;
            }
            items.forEach(item => {
                const row = document.createElement(this.panelTab === 'favorites' ? 'div' : 'button');
                row.className = 'panel-item';
                row.dataset.itemId = item.id;
                const tooLong = [...item.text].length > MAX_COMMIT_CODE_POINTS;
                if (tooLong) row.classList.add('disabled');

                const commit = () => {
                    if (tooLong) return;
                    this.call(() => Native.commitText(item.text, this.token));
                    this.closePanel();
                };

                if (this.panelTab === 'clipboard') {
                    const preview = document.createElement('span');
                    preview.className = 'panel-text';
                    // Two-line clamp in CSS; the hard cut only marks over-long rows
                    // and uses code-point slicing so surrogate pairs stay intact.
                    preview.textContent = tooLong
                        ? Array.from(item.text).slice(0, 400).join('') + t("…（内容过长）")
                        : item.text;
                    const remove = document.createElement('span');
                    remove.className = 'panel-remove';
                    remove.textContent = '×';
                    remove.setAttribute('aria-label', t("删除"));
                    remove.addEventListener('click', event => {
                        event.stopPropagation();
                        this.call(() => Native.removeClipboard(item.id, this.token));
                    });
                    row.append(preview, remove);
                    // Native clicks only: bindTouch's preventDefault would kill
                    // panel scrolling AND bubble a second row click on remove taps
                    // .
                    row.addEventListener('click', commit);
                    list.append(row);
                    return;
                }

                // The row stays compact - drag handle, text,
                // and a ⋯ trigger. Pin/edit/delete live in the long-press
                // menu (⋯ tap = long press).
                const handle = document.createElement('span');
                handle.className = 'pair-drag';
                handle.textContent = '≡';
                const preview = document.createElement('span');
                preview.className = 'panel-text';
                preview.textContent = item.text;
                let longPressed = false;
                preview.addEventListener('click', () => {
                    if (longPressed) { longPressed = false; return; }
                    commit();
                });
                this.bindItemLongPress(preview, () => { longPressed = true; });
                const more = document.createElement('button');
                more.className = 'panel-more';
                more.textContent = '⋯';
                more.setAttribute('aria-label', t("更多操作"));
                more.addEventListener('click', () => this.openItemMenu(item, more));
                row.append(handle, preview, more);
                this.bindListDrag(row, list, '.panel-item', 'itemId', order => {
                    order.forEach((id, index) => {
                        if ((this.favoriteItems || [])[index]?.id !== id) {
                            this.call(() => Native.favoritesMove(id, index, this.token));
                        }
                    });
                });
                list.append(row);
            });
        }

        /** Focus tracking for panel inputs, shared with the
         * native redirect - while active, editor writes come back through
         * onPanelCommit/onPanelDelete instead of the host editor. */
        setPanelInput(active) {
            const changed = this.settingsInputFocus !== active;
            this.settingsInputFocus = active;
            if (changed) {
                this.panelSession = (this.panelSession || 0) + 1;
                this.panelSpans = new Map();
                this.panelSelections = new Map();
                this.panelTargets = new Map();
                this.panelTarget = null;
                this.panelSavePending = false;
            }
            if (changed) this.call(() => Native.panelInput(active, this.token));
            if (active) this.reportPanelSelection();
        }

        panelInputField() {
            const el = document.activeElement;
            if (el && el.classList && el.classList.contains('phrase-input')) return el;
            return this.settingsInputFocus ? this.panelTarget || null : null;
        }

        rememberPanelSelection(field) {
            if (!this.panelSelections) this.panelSelections = new Map();
            this.panelSelections.set(field, {value: field.value,
                start: field.selectionStart ?? field.value.length,
                end: field.selectionEnd ?? field.value.length});
        }

        reportPanelSelection() {
            if (!this.settingsInputFocus) return;
            const field = this.panelInputField();
            if (!field) return;
            const changed = this.panelTarget !== field;
            if (changed) {
                this.panelSession = (this.panelSession || 0) + 1;
                this.panelTarget = field;
                this.panelTargets.set(this.panelSession, field);
            }
            const previous = this.panelSelections && this.panelSelections.get(field);
            const start = field.selectionStart ?? field.value.length;
            const end = field.selectionEnd ?? start;
            if (!changed && previous && previous.value === field.value &&
                previous.start === start && previous.end === end) return;
            this.panelSavePending = false;
            if (!changed) {
                for (const [session, target] of this.panelTargets) {
                    if (target === field) this.panelTargets.delete(session);
                }
                this.panelSession = (this.panelSession || 0) + 1;
                this.panelTargets.set(this.panelSession, field);
            }
            if (this.panelSpans) this.panelSpans.delete(field);
            this.rememberPanelSelection(field);
            this.call(() => Native.panelSelection(start, end, this.panelSession || 0, this.token));
        }

        panelPayloadCurrent(payload) {
            return this.settingsInputFocus && (!payload || payload.session == null ||
                this.panelTargets && this.panelTargets.has(payload.session));
        }

        panelPayloadField(payload) {
            if (!this.panelPayloadCurrent(payload)) return null;
            return payload && payload.session != null ? this.panelTargets.get(payload.session) : this.panelInputField();
        }

        replacePanelRange(field, start, end, text) {
            field.value = field.value.slice(0, start) + text + field.value.slice(end);
            const caret = start + text.length;
            try { field.setSelectionRange(caret, caret); } catch (_) {}
            this.rememberPanelSelection(field);
        }

        insertIntoPanelInput(text, field = this.panelInputField()) {
            if (!field) return;
            const span = this.panelSpans && this.panelSpans.get(field);
            const start = span && span.field === field ? span.start : field.selectionStart ?? field.value.length;
            const end = span && span.field === field ? span.end : field.selectionEnd ?? start;
            this.replacePanelRange(field, start, end, text);
            if (this.panelSpans) this.panelSpans.delete(field);
        }

        deleteFromPanelInput(count, field = this.panelInputField()) {
            if (!field) return;
            if (this.panelSpans) this.panelSpans.delete(field);
            for (let i = 0; i < count; i++) {
                let start = field.selectionStart ?? field.value.length;
                const end = field.selectionEnd ?? start;
                if (start === end) {
                    if (start === 0) return;
                    const prefix = Array.from(field.value.slice(0, start));
                    start -= prefix[prefix.length - 1].length;
                }
                this.replacePanelRange(field, start, end, '');
            }
        }

        onPanelCommit(payload) {
            if (!this.panelPayloadCurrent(payload)) return;
            this.insertIntoPanelInput(String((payload && payload.text) || ''), this.panelPayloadField(payload));
        }

        onPanelComposing(payload) {
            if (!this.panelPayloadCurrent(payload)) return;
            const field = this.panelPayloadField(payload);
            if (!field) return;
            const span = this.panelSpans && this.panelSpans.get(field);
            const start = span && span.field === field ? span.start : field.selectionStart ?? field.value.length;
            const end = span && span.field === field ? span.end : field.selectionEnd ?? start;
            const text = String((payload && payload.text) || '');
            this.replacePanelRange(field, start, end, text);
            this.panelSpans.set(field, {field, start, end: start + text.length});
        }

        onPanelFinishComposing(payload) {
            const field = this.panelPayloadField(payload);
            if (field && this.panelSpans) this.panelSpans.delete(field);
        }

        onPanelReopen(payload) {
            if (!this.panelPayloadCurrent(payload)) return;
            const field = this.panelPayloadField(payload);
            if (!field) return;
            const word = payload && payload.word;
            const selectionStart = field.selectionStart ?? field.value.length;
            const end = field.selectionEnd ?? selectionStart;
            const start = end - (typeof word === 'string' ? word.length : 0) - 1;
            const valid = typeof word === 'string' && word.length > 0 &&
                selectionStart === end && start >= 0 &&
                field.value.slice(start, end) === word + ' ';
            if (!valid) {
                // A failed reopen proves that this native callback no longer
                // describes the focused field. Retire the session so queued
                // replay callbacks cannot write into a later selection, then
                // let the existing selection report establish a fresh one.
                if (payload && payload.session != null && this.panelTargets) {
                    this.panelTargets.delete(payload.session);
                }
                if (field === this.panelTarget) {
                    if (this.panelSelections) this.panelSelections.delete(field);
                    this.reportPanelSelection();
                }
                return;
            }
            this.replacePanelRange(field, start, end, word);
            this.panelSpans.set(field, {field, start, end: start + word.length});
        }

        onPanelDelete(payload) {
            if (this.panelPayloadCurrent(payload)) this.deleteFromPanelInput(Number((payload && payload.count) || 1), this.panelPayloadField(payload));
        }

        /** The phrase editor is a card floating ABOVE the
         * keyboard view (band area) - the old
         * in-keyboard strip is gone for the favorites flow. Redirect typing
         * still works: the card textarea keeps the .phrase-input class.
         * The custom-JSON editor keeps the legacy strip until it moves to
         * the full settings page (design §15/§6.2). */
        openPanelEditor(item) {
            this.panelEditItem = item || null;
            this.customEditRow = null;
            this.editorReturn = null;
            this.closeItemMenu();
            this.editorMode = null;
            const card = document.getElementById('phraseCard');
            const input = document.getElementById('phraseCardInput');
            const code = document.getElementById('phraseCardCode');
            document.getElementById('phraseCardTitle').textContent =
                item ? t("编辑常用语") : t("添加常用语");
            input.value = item ? item.text : '';
            code.value = (item && item.code) || '';
            document.getElementById('phraseCardRankValue').textContent =
                String(item ? (item.rank || 1) : 1);
            document.getElementById('panelLayer').hidden = true;
            // The keyboard STAYS visible under the card -
            // picking a candidate mid-edit is the whole point.
            document.getElementById('candidateBar').hidden = false;
            // The card borrows the key area for letters; remember what the
            // PANEL was restoring - closePanelEditor hands it back before
            // openPanel re-captures, or a nine-pad return layer would be
            // lost to 'letters' (review P2).
            this.panelEditorKeyLayer = this.keyLayer;
            this.showKeyLayer('letters');
            // body.editing keeps the native redirect armed across blurs
            // (review finding) - the card flow keeps that semantics.
            document.body.classList.add('editing');
            card.hidden = false;
            card.classList.add('open');
            this.placePhraseCard();
            this.syncOverlay();
            input.focus();
            this.setPanelInput(true);
        }

        /** Place the card flush above the keyboard view; when the band is
         * too short (landscape) clamp to the window top and let the modal
         * card ride over the keyboard top rows (see design §0). */
        placePhraseCard() {
            const card = document.getElementById('phraseCard');
            const kb = document.getElementById('softKeyboard').getBoundingClientRect();
            card.style.top = '0px';
            const h = card.offsetHeight;
            const top = Math.max(14, kb.top - h - 6);
            card.style.top = top + 'px';
        }

        closePanelEditor() {
            const editor = document.getElementById('panelEditor');
            const input = document.getElementById('panelEditorInput');
            const area = document.getElementById('panelEditorArea');
            // The favorites flow closes the floating card; the
            // custom-JSON flow still lives on the legacy strip (design §15).
            const card = document.getElementById('phraseCard');
            card.classList.remove('open');
            card.hidden = true;
            document.getElementById('phraseCardInput').value = '';
            document.getElementById('phraseCardCode').value = '';
            document.getElementById('phraseCardRankValue').textContent = '1';
            input.value = '';
            input.hidden = false;
            area.value = '';
            area.hidden = true;
            this.editorMode = null;
            editor.hidden = true;
            document.body.classList.remove('editing');
            if (this.settingsInputFocus) this.setPanelInput(false);
            // Custom-row edits return to their settings page
            // instead of the favorites panel.
            if (this.editorReturn === 'custom') {
                this.editorReturn = null;
                this.customEditRow = null;
                this.toggleSettingsPanel('custom');
                return;
            }
            // Hand the borrowed key area back to the panel's session
            // before openPanel re-captures the return layer.
            this.keyLayer = this.panelEditorKeyLayer || this.keyLayer;
            this.panelEditorKeyLayer = null;
            this.openPanel('favorites');
        }

        savePanelEditor() {
            if (this.panelSavePending) return;
            if (!this.settingsInputFocus) return this.finishSavePanelEditor();
            this.panelSavePending = true;
            this.call(() => Native.panelFlush(this.panelSession || 0, this.token));
        }

        onPanelFlushed(payload) {
            if (!this.panelSavePending || !payload || payload.session !== this.panelSession) return;
            this.panelSavePending = false;
            this.finishSavePanelEditor();
        }

        finishSavePanelEditor() {
            // The textarea form edits the custom-keys JSON.
            if (this.editorMode === 'custom-json') {
                this.saveCustomJson(document.getElementById('panelEditorArea').value);
                return;
            }
            // The card carries the phrase text + its input code
            // (empty = auto: first 3 chars / pinyin initials, resolved at
            // engine side in the phrase-injection step).
            // It also carries the 1-based candidate rank (default 1).
            const input = document.getElementById('phraseCardInput');
            const codeEl = document.getElementById('phraseCardCode');
            const rank = Math.min(Math.max(
                parseInt(document.getElementById('phraseCardRankValue').textContent, 10) || 1, 1), 99);
            const text = input.value.trim();
            const code = codeEl.value.trim();
            if (!text) return;
            if (this.panelEditItem) {
                const id = this.panelEditItem.id;
                if (text !== this.panelEditItem.text ||
                    code !== (this.panelEditItem.code || '') ||
                    rank !== (this.panelEditItem.rank || 1)) {
                    this.call(() => Native.favoritesUpdate(id, text, code, rank, this.token));
                }
            } else {
                this.call(() => Native.favoritesAdd(text, code, rank, this.token));
            }
            this.panelEditItem = null;
            this.closePanelEditor();
        }

        /** Pin/edit/delete ride a long-press menu (⋯ tap opens
         * the same one); rows only carry the drag handle, text and ⋯. */
        openItemMenu(item, anchor) {
            const menu = document.getElementById('itemMenu');
            this.closeItemMenu();
            this.itemMenuOpen = item.id;
            const build = (label, cls, action) => {
                const button = document.createElement('button');
                if (cls) button.className = cls;
                button.textContent = label;
                button.addEventListener('click', () => {
                    this.closeItemMenu();
                    action();
                });
                menu.append(button);
            };
            build(t("置顶"), '', () =>
                this.call(() => Native.favoritesMove(item.id, 0, this.token)));
            build(t("编辑"), '', () => this.openPanelEditor(item));
            build(t("删除"), 'danger', () =>
                this.call(() => Native.removeFavorite(item.id, this.token)));
            menu.classList.add('open');
            // Clamp above the anchor row (rows sit in a scrollable list).
            const rect = anchor.getBoundingClientRect();
            menu.style.left = Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4,
                rect.right - menu.offsetWidth)) + 'px';
            menu.style.top = Math.max(2, rect.top - menu.offsetHeight - 6) + 'px';
            this.syncOverlay();
        }

        closeItemMenu() {
            this.itemMenuOpen = null;
            const menu = document.getElementById('itemMenu');
            menu.classList.remove('open');
            menu.replaceChildren();
            this.syncOverlay();
        }

        /* ===== 长按候选删除自造词 ===== */

        /** Long-press a candidate (bar or expanded grid). The candidates keep
         * native clicks (bindTouch would kill the bar's pan), so this is the
         * passive bindItemLongPress plus the click-suppress flag callback.
         * Only Chinese modes have a librime user lexicon to delete from. */
        bindCandidateLongPress(button, candidate, onLongPress) {
            if (!this.isChineseMode()) return;
            this.bindItemLongPress(button, () => {
                onLongPress();
                this.openCandidateMenu(candidate, button);
            });
        }

        /** EVERY candidate is deletable now - the engine seeks to
         * the candidate's page and walks the librime highlight (selector's
         * Down = next candidate) onto it before Shift+Delete. Natives with
         * neither bridge method get no menu at all; head-only natives can
         * only delete the head, so off-head falls back to the upgrade hint. */
        openCandidateMenu(candidate, anchor) {
            if (this.composing === false) return;
            const hasAny = typeof Native.deleteCandidate === 'function';
            const hasHeadOnly = typeof Native.deleteHighlightedCandidate === 'function';
            if (!hasAny && !hasHeadOnly) return;
            const head = (this.expandCandidates || [])[0];
            // With only the head-only method the non-head menu still opens -
            // it carries the disabled upgrade hint instead of a silent no-op.
            const deletable = hasAny ||
                (hasHeadOnly && !!head && head.id === candidate.id);
            const menu = document.getElementById('itemMenu');
            this.closeItemMenu();
            this.itemMenuOpen = 'candidate';
            const build = (label, cls, action) => {
                const button = document.createElement('button');
                if (cls) button.className = cls;
                button.textContent = label;
                button.addEventListener('click', () => {
                    this.closeItemMenu();
                    action();
                });
                menu.append(button);
            };
            if (deletable) {
                build(t("删除自造词"), 'danger', () => this.confirmDeleteCandidate(candidate));
            } else {
                // Head-only native: just the head is deletable there.
                const hint = document.createElement('button');
                hint.disabled = true;
                hint.textContent = t("该候选需升级 APK 后删除");
                menu.append(hint);
            }
            menu.classList.add('open');
            // The bar sits at the TOP of the keyboard: the menu must open
            // DOWNWARD (favorites rows open upward).
            menu.style.left = '0';
            menu.style.top = '0';
            const rect = anchor.getBoundingClientRect();
            const left = Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, rect.left));
            menu.style.left = left + 'px';
            menu.style.top = Math.min(innerHeight - menu.offsetHeight - 2, rect.bottom + 6) + 'px';
            this.syncOverlay();
        }

        confirmDeleteCandidate(candidate) {
            this.deleteTarget = candidate;
            document.getElementById('confirmText').textContent =
                t("从自选词词库删除「{0}」？（固定词库的词删不掉）", candidate.text);
            document.getElementById('confirmCard').hidden = false;
        }

        closeConfirmCard() {
            this.deleteTarget = null;
            document.getElementById('confirmCard').hidden = true;
        }

        deleteHighlightedCandidate() {
            const candidate = this.deleteTarget;
            this.closeConfirmCard();
            if (!candidate) return;
            // Prefer the any-candidate channel; head-only natives
            // only know the head-only variant (the head is the only thing
            // that was deletable there).
            const head = (this.expandCandidates || [])[0];
            const isHead = head && head.id === candidate.id;
            if (typeof Native.deleteCandidate === 'function') {
                this.pendingDelete = candidate;
                this.call(revision => Native.deleteCandidate(revision, candidate.id, this.token));
            } else if (isHead && typeof Native.deleteHighlightedCandidate === 'function') {
                this.pendingDelete = candidate;
                this.call(() => Native.deleteHighlightedCandidate(this.token));
            } else {
                return;
            }
            // The engine refreshes the candidates WITHOUT changing the
            // preedit, so the accumulated pool must be rebuilt on the echo
            // (accumulateCandidates only appends - the deleted word would
            // stay on the bar forever).
            setTimeout(() => { this.pendingDelete = null; }, 1500);
        }

        /** Long-press on a panel row text (no preventDefault: the list must
         * keep scrolling); a drag past a few px cancels the timer. */
        bindItemLongPress(el, onLongPress) {
            let timer = 0;
            let startX = 0;
            let startY = 0;
            el.addEventListener('touchstart', event => {
                const touch = event.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                timer = setTimeout(() => {
                    timer = 0;
                    onLongPress();
                }, 380);
            }, { passive: true });
            el.addEventListener('touchmove', event => {
                if (!timer) return;
                const touch = event.touches[0];
                if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 12) {
                    clearTimeout(timer);
                    timer = 0;
                }
            }, { passive: true });
            const clear = () => {
                if (timer) clearTimeout(timer);
                timer = 0;
            };
            el.addEventListener('touchend', clear, { passive: true });
            el.addEventListener('touchcancel', clear, { passive: true });
        }

        onClipboard(payload) {
            this.clipboardItems = (payload.items || []).map(item => ({
                id: String(item.id), text: String(item.text), time: Number(item.time) || 0,
            }));
            if (this.panelOpen && this.panelTab === 'clipboard') this.renderPanel();
        }

        /** 导入备份后原生把 localStorage 级设置推回来（userdata.md §1.4）。
         * 白名单外的键一律忽略；主题当场生效，语言变化重走一次渲染。 */
        onStoresRestored(stores) {
            let localeChanged = false;
            let localeRemoved = false;
            let quickPairRemoved = false;
            try {
                const incoming = stores || {};
                // 恢复是覆盖语义（userdata.md §1.1 空即空状态）：备份里没有的
                // 白名单键要从本机删掉，否则本页随后的「先拉后推」会把陈旧值
                // 推回镜像，导出方的空状态/缺省键就被恢复方旧值翻了案。
                for (const key of STORE_BACKUP_KEYS) {
                    if (Object.prototype.hasOwnProperty.call(incoming, key)) continue;
                    if (localStorage.getItem(key) === null) continue;
                    if (key === 'feelime_ui_locale') { localeChanged = true; localeRemoved = true; }
                    if (key === 'feelime_quick_pair') quickPairRemoved = true;
                    localStorage.removeItem(key);
                }
                for (const key of Object.keys(incoming)) {
                    if (!STORE_BACKUP_KEYS.includes(key)) continue;
                    if (key === 'feelime_ui_locale' && incoming[key] !== uiLocale) {
                        localeChanged = true;
                    }
                    localStorage.setItem(key, String(incoming[key]));
                }
            } catch (_) { /* storage unavailable */ }
            applyTheme(this.themeMode || 'auto');
            // 构造时缓存的运行时值一并刷新，否则恢复值只在下次冷启动生效。
            // Native 值到达后（hello 的 scrubSpeed）镜像是纯兼容遗留：运行值
            // 以原生为准，旧镜像（如恢复备份刚写入的 rev）不得回写覆盖。
            if (!this.scrubSpeedFromNative) {
                try {
                    const speed = parseInt(localStorage.getItem('feelime_scrub_speed') || '3', 10);
                    if (speed >= 1 && speed <= 5) this.scrubSpeed = speed;
                } catch (_) { /* keep current */ }
            }
            if (quickPairRemoved) this.quickPair = ['pinyin', 'direct'];
            try {
                const pair = JSON.parse(localStorage.getItem('feelime_quick_pair') || 'null');
                if (Array.isArray(pair) && pair.length === 2 &&
                    MODES[pair[0]] && MODES[pair[1]]) this.quickPair = pair;
            } catch (_) { /* keep current */ }
            this.updateToggleLabels();
            if (localeChanged) {
                // 备份缺席语言键 = 导出方用默认语言（zh），不能沿用本机旧值。
                uiLocale = String((stores || {})['feelime_ui_locale'] || (localeRemoved ? 'zh' : uiLocale));
                translateStaticUi();
                this.renderLetters((MODES[this.mode] || MODES.direct).layout);
                this.renderSymbolCats();
            }
            this.updateLabels();
            if (document.getElementById('settingsPanel').classList.contains('open')) {
                this.renderSettingsPanel();
            }
        }

        onFavorites(payload) {
            this.favoriteItems = (payload.items || []).map(item => ({
                id: String(item.id), text: String(item.text), time: Number(item.time) || 0,
                code: String(item.code || ''),
                rank: Math.min(Math.max(Number(item.rank) || 1, 1), 99),
            }));
            // design §7.4: the composition may be live when the list
            // changes - re-inject so add/edit/delete converge immediately
            // (the recompute is idempotent; repaint right away).
            if (this.composing) {
                this.injectFavoriteCandidates();
                this.renderCandidates(this.lastEngineState || {});
                if (this.expanded) this.renderExpanded();
            }
            if (this.panelOpen && this.panelTab === 'favorites') this.renderPanel();
        }

        /* ===== native callbacks ===== */

        onBridgeHello(payload) {
            if (payload.nativeApiVersion < MIN_NATIVE_API) return;
            const provided = payload.capabilities || [];
            if (!REQUIRED_CAPABILITIES.every(cap => provided.includes(cap))) return;
            const localeChanged = (payload.uiLocale === 'zh' || payload.uiLocale === 'en') &&
                payload.uiLocale !== uiLocale;
            if (localeChanged) {
                uiLocale = payload.uiLocale;
                try { localStorage.setItem('feelime_ui_locale', uiLocale); } catch (_) {}
                translateStaticUi();
                // 这里不许 pushStores：hello 尾部统一「先拉后推」，提前推会把
                // 本地陈旧值写回镜像并抬高 rev，设置页刚导入的恢复值就丢了。
            }
            this.token = payload.pageGenerationToken;
            this.engineReady = payload.engineDataReady || {};
            // D: bottom gesture-nav inset (CSS px) - the native
            // view carries this space in both orientations (see applyHeight).
            this.safeBottom = Math.max(0, Number(payload.safeBottom) || 0);
            // Feel tuning + bottom blank strip (mode-fallback §3/§4). dp is
            // CSS px in this WebView; hello is authoritative over the old
            // localStorage scrub key (which stays as the pre-hello fallback).
            this.bottomPad = Math.max(0, Number(payload.bottomPad) || 0);
            // Candidate text scale (issue #2): 0=normal 1=large 2=xlarge,
            // applied as a CSS var multiplier (row budget untouched).
            if (Number(payload.candidateFont) in { 0: 1, 1: 1, 2: 1 }) {
                this.candidateFont = Number(payload.candidateFont);
            }
            this.applyCandidateFont();
            // 拼音字号（issue #8）：0=标准 1=大 2=特大；旧 APK 不带字段不覆盖。
            if (Number(payload.preeditFont) in { 0: 1, 1: 1, 2: 1 }) {
                this.preeditFont = Number(payload.preeditFont);
            }
            this.applyPreeditFont();
            // 拼音加粗开关（issue #8）：默认关；旧 APK 不带字段不覆盖。
            if (typeof payload.preeditBold === 'boolean') {
                this.preeditBold = payload.preeditBold;
            }
            document.body.dataset.preeditBold = this.preeditBold ? '1' : '0';
            // 单手模式（issue #15）：0=关 1=左手 2=右手；旧 APK 不带字段不覆盖。
            if (Number(payload.oneHand) in { 0: 1, 1: 1, 2: 1 }) {
                this.oneHand = Number(payload.oneHand);
            }
            // 单手压缩比例：白名单档（0=默认 64px），旧 APK 不带字段不覆盖。
            if (Number(payload.oneHandPad) in { 0: 1, 15: 1, 25: 1, 35: 1 }) {
                this.oneHandPad = Number(payload.oneHandPad);
            }
            // 2 是废除的「自定义侧边图」档，按空白处理（防旧 pref 直漏）。
            const side = Number(payload.sideContent);
            if (side === 0 || side === 1) this.sideContent = side;
            else if (side === 2) this.sideContent = 1;
            if (typeof payload.bgImageLight === 'string') this.bgImageLight = payload.bgImageLight;
            if (typeof payload.bgImageDark === 'string') this.bgImageDark = payload.bgImageDark;
            const opacity = Number(payload.keyOpacity);
            if (opacity >= 0 && opacity <= 100) this.keyOpacity = opacity;
            this.applyOneHand();
            this.applyBackground();
            this.applyKeyOpacity();
            // 主题真相源是 native pref（外观页 select / tile 循环都写它）：
            // 与本地不同才覆盖。tile 连点的未决意图在途时不覆盖，只确认
            // 撤签——否则连点后先发的旧快照会把新意图洗掉。
            const themeMode = payload.themeMode;
            if (themeMode === 'auto' || themeMode === 'light' || themeMode === 'dark') {
                this.qConfirm('themeMode', themeMode);
                try { localStorage.removeItem('feelime_theme'); } catch (_) {}
                if (this.quickPending.themeMode === undefined && themeMode !== this.themeMode) {
                    this.themeMode = themeMode;
                    applyTheme(themeMode);
                }
            } else {
                // 迁移窗口：老版本把主题存在 localStorage（3.45.1 前）。
                // pref 为空而本地有合法遗留值时上报一次并沿用，升级不丢主题。
                let legacy = null;
                try {
                    const saved = localStorage.getItem('feelime_theme');
                    if (saved === 'auto' || saved === 'light' || saved === 'dark') legacy = saved;
                    localStorage.removeItem('feelime_theme');
                } catch (_) {}
                if (legacy !== null) {
                    this.themeMode = legacy;
                    applyTheme(legacy);
                    // hello 前段 this.ready 还没置位，this.call 会静默丢——
                    // token 已就绪，直调（同 pushStores 的旧原生守卫）。
                    if (typeof Native.setQuickPref === 'function' && this.token) {
                        Native.setQuickPref('themeMode', legacy, this.token);
                    }
                }
            }
            // 工具栏布局（issue #15 编辑模式）：非法串整体回退默认。
            if (typeof payload.toolbarLayout === 'string' && payload.toolbarLayout) {
                this.applyToolbarLayoutValue(payload.toolbarLayout);
            }
            this.applyToolbarLayout();
            this.associationOn = !!payload.associationOn;
            if (!this.associationOn) this.assocWords = [];
            if (payload.uiLanguage === 'auto' || payload.uiLanguage === 'zh' || payload.uiLanguage === 'en') {
                this.uiLanguageChoice = payload.uiLanguage;
            }
            // 按键反馈开关（快捷设置方块回读；旧 APK 不带字段=不覆盖）。
            if (typeof payload.keySound === 'boolean') this.keySound = payload.keySound;
            if (typeof payload.keyHaptic === 'boolean') this.keyHaptic = payload.keyHaptic;
            // hello 快照是确认：只有等于未决意图才清除（否则连点中的
            // 旧快照不得覆盖本地意图，见 quickTileDefs）。
            this.qConfirm('association', this.associationOn);
            this.qConfirm('keySound', this.keySound);
            this.qConfirm('keyHaptic', this.keyHaptic);
            this.qConfirm('uiLocale', this.uiLanguageChoice);
            this.qConfirm('candidateFont', this.candidateFont);
            this.qConfirm('preeditFont', this.preeditFont);
            this.qConfirm('oneHand', this.oneHand);
            // 开关型工具 icon 的 on 底色跟随 hello 快照。
            this.syncToolStates();
            this.auditToolbarTools();
            this.qConfirm('sideContent', this.sideContent);
            this.qConfirm('bottomPad', this.bottomPad);
            this.qConfirm('holdMs', this.holdMs);
            this.qConfirm('popupSnap', this.popupSnap);
            if (Number(payload.holdMs) in { 200: 1, 300: 1, 350: 1, 450: 1, 600: 1 }) {
                this.holdMs = Number(payload.holdMs);
            }
            if (Number(payload.scrubSpeed) >= 1 && Number(payload.scrubSpeed) <= 5) {
                this.scrubSpeed = Number(payload.scrubSpeed);
                // Once native has spoken, the legacy localStorage scrub key
                // may no longer overwrite the runtime value (pullStores
                // refresh, restored backup rev) — native owns it now.
                this.scrubSpeedFromNative = true;
            }
            if (Number(payload.popupSnap) in { 0: 1, 1: 1, 2: 1 }) {
                this.popupSnap = Number(payload.popupSnap);
            }
            // The native float band above the keyboard - the
            // room every popup may float into (0 keeps everything inside
            // the IME view, e.g. the preview harness).
            this.floatBand = Number(payload.floatBand) || 0;
            // Real-screen height-card range (same clamp the native
            // setKeyboardHeight enforces) - innerHeight rides the keyboard
            // itself, so it can never define the drag range (see heightBounds).
            this.heightDefaultCss = Number(payload.heightDefault) || 272;
            this.heightFloorCss = Number(payload.heightFloor) || 0;
            this.heightCeilCss = Number(payload.heightCeil) || 0;
            {
                const root = document.documentElement;
                if (root && root.style && typeof root.style.setProperty === 'function') {
                    root.style.setProperty('--band', this.floatBand + 'px');
                }
                // design §15: the settings page edits the custom table in its
                // native store; native wins on (re)load so the mirror stays
                // single-source. Unset/empty = nothing to adopt.
                try {
                    const nativeCustom = Native.customKeys(this.token);
                    if (nativeCustom === 'disabled') {
                        // The settings switch must actually turn
                        // the custom layer off - the localStorage mirror would
                        // otherwise keep serving the table from its own copy.
                        localStorage.removeItem(CUSTOM_KEYS_STORE);
                    } else if (nativeCustom) {
                        // The settings page writes loosely-validated JSON;
                        // the keyboard's validator stays authoritative, and a
                        // bad table is ignored (never bricked keys).
                        const parsed = this.parseCustomKeys(nativeCustom);
                        if (!parsed.error) {
                            localStorage.setItem(CUSTOM_KEYS_STORE,
                                JSON.stringify({ version: 1, rows: parsed.rows }));
                        }
                    } else {
                        // A keyboard upgraded from a pre-migration
                        // version holds its table only in localStorage while
                        // native is unset - push it up once, so the settings
                        // page sees it and the native-wins sync can never
                        // silently drop it.
                        const local = localStorage.getItem(CUSTOM_KEYS_STORE);
                        if (local) {
                            const parsed = this.parseCustomKeys(local);
                            if (!parsed.error) {
                                Native.setCustomKeys(local, this.token);
                            }
                        }
                    }
                } catch (_) { /* storage unavailable */ }
            }
            // Native orientation wins over the resize heuristic.
            if (payload.orientation) {
                this.helloOrientation = payload.orientation;
                this.applyOrientation(payload.orientation === 'landscape');
            }
            // The band shrinks the keyboard INSIDE an unchanged
            // viewport - no resize event fires and applyOrientation
            // early-returns on a same-orientation hello, so the row budget
            // must be recomputed here (a stale 60px budget overflowed the
            // rows out of the shorter view and broke every coordinate-based
            // device gesture).
            this.applyHeight();
            // The phrase card rides the keyboard top edge.
            if (document.getElementById('phraseCard').classList.contains('open')) {
                this.placePhraseCard();
            }
            if (payload.theme === 'dark' || payload.theme === 'light') {
                systemTheme = payload.theme;
                systemThemeKnown = true;
                try { localStorage.setItem('feelime_system_theme', payload.theme); } catch (_) {}
                applyTheme(this.themeMode || 'auto');
            }
            const nextMode = MODES[payload.mode] ? payload.mode : 'direct';
            const modeChanged = nextMode !== this.mode;
            this.mode = nextMode;
            this.ready = true;
            // 模式切换=组合语境整体作废：挂起的两步逗号不跨模式补发。
            if (modeChanged) this.pendingPunct = null;
            // Scheme switch re-renders the letter layer: the wide sep key
            // shows the sogou ing key instead of the 分词 label. Own-property
            // check: inherited names like "constructor" must not pass.
            const nextScheme = payload.dpScheme &&
                Object.prototype.hasOwnProperty.call(DP_INITIAL_FINALS, payload.dpScheme)
                ? payload.dpScheme : 'ziranma';
            const schemeChanged = nextScheme !== dpScheme;
            dpScheme = nextScheme;
            this.qConfirm('dpScheme', dpScheme);
            if (modeChanged) this.renderMode();
            // Degraded/warming state arrives with every hello (mode-fallback
            // §2.1): a rebuilt WebView restores its badge/notice silently.
            // hello is a snapshot, never a notification — the flag is what
            // keeps a rebuild from re-toasting the failure it reports.
            this.applyEngineLifecycle({ ...payload, snapshot: true });
            if (schemeChanged && this.mode === 'double-pinyin') {
                this.renderLetters((MODES[this.mode] || MODES.direct).layout);
                this.updateLabels();
            }
            if (localeChanged) {
                this.renderLetters((MODES[this.mode] || MODES.direct).layout);
                this.renderSymbolCats();
                this.updateLabels();
                // The nine-pad (and its emoji sub-view) prints t()-labels -
                // re-render or 空格/换行 mix languages mid-session (review P2).
                if (this.keyLayer === 'numpad') this.renderNumpad();
                if (document.getElementById('settingsPanel').classList.contains('open')) this.renderSettingsPanel();
                if (this.panelOpen) this.renderPanel();
                if (this.expanded) this.renderExpanded();
                document.getElementById('phraseCardTitle').textContent =
                    t(this.panelEditItem ? '编辑常用语' : '添加常用语');
                if (document.getElementById('heightCard').classList.contains('open')) this.renderHeightCard();
            }
            Native.keyboardReady(KEYBOARD_VERSION, MIN_NATIVE_API, JSON.stringify(REQUIRED_CAPABILITIES), this.token);
            // design §7.4: the candidate injection matches against this
            // cache - it must be warm before the favorites panel ever opens.
            this.call(() => Native.getFavorites(this.token));
            // 备份数据源（userdata.md §1.4/§1.5）：先按 rev 拉取恢复值，
            // 再把本地镜像推给原生——两个方向都走一遍，导入与修改才收敛。
            pullStores(this.token);
            pushStores();
            // The native view may still be (re)measuring while hello lands,
            // and a resize that happened while the IME window was hidden
            // never fires the ResizeObserver (no layout while hidden — the
            // row budget then stale-read 272 on a 308 view). Re-derive the
            // budget after the show settles (device-gate proven gap).
            setTimeout(() => this.applyHeight(), 250);
            setTimeout(() => this.applyHeight(), 900);
        }

        /** Degraded/warming state from engine events AND hello (mode-fallback
         * §2.1): hello restores the persistent badge after a WebView rebuild
         * but never toasts (degradedActive absent); each degrade transition
         * carries a fresh seq so a retry that fails again toasts again. */
        applyEngineLifecycle(payload) {
            if (payload.warming !== undefined) this.warming = !!payload.warming;
            if (payload.degraded) {
                const seq = Number(payload.degradeSeq) || 0;
                const failedMode = payload.failedMode || '';
                // degradedActive absent (hello restore) means the fallback IS
                // serving — restore the badge but never re-toast it.
                const active = payload.degradedActive !== undefined
                    ? !!payload.degradedActive : true;
                const previous = this.degrade;
                this.degrade = { failedMode, seq, active };
                // hello is a SNAPSHOT, never a notification (mode-fallback
                // §2.1): a WebView rebuild restores the badge silently and
                // marks the seq seen, so a later event for the same failure
                // cannot re-toast it either.
                if (payload.snapshot) this.seenDegradeSeq = Math.max(this.seenDegradeSeq, seq);
                // A degrade kills the engine session an in-flight variant
                // replay depends on: abandon the wait instead of stranding
                // the old parse's UI until the replay timer fires (§2.3).
                if (active && this.variantReplaying) {
                    clearTimeout(this.variantReplayTimer);
                    this.variantReplayTimer = null;
                    this.variantReplaying = false;
                    this.variantTarget = null;
                    const grid = document.getElementById('expandGrid');
                    if (grid) grid.classList.remove('reloading');
                    if (this.expanded) this.setExpanded(false);
                }
                if (active && !payload.snapshot && seq > this.seenDegradeSeq) {
                    this.seenDegradeSeq = seq;
                    // Full translated title (「双拼」), not the toggle shorthand (双).
                    const modeName = MODES[failedMode] ? t(MODES[failedMode].title) : failedMode;
                    this.showToast(
                        t("「{0}」引擎启动失败，暂时英文直出；点模式键重试")
                            .replace('{0}', modeName),
                    );
                }
                this.renderDegradeBadge();
            } else if (this.degrade) {
                this.degrade = null;
                this.renderDegradeBadge();
            }
            this.updateEngineStatus();
            // 快捷设置首页的方块状态跟 hello 走（广播落盘 → 重推 hello）：
            // 面板开着就重渲染首页，开关/档位立即反映新值。子页有自己的
            // 渲染节奏，不动。
            {
                const panel = document.getElementById('settingsPanel');
                if (panel && panel.classList.contains('open') && !this.settingsPage) {
                    this.renderSettingsPanel();
                }
            }
        }

        renderDegradeBadge() {
            const toggle = document.getElementById('modeToggle');
            if (!toggle) return;
            toggle.classList.toggle('degraded', !!(this.degrade && this.degrade.active));
        }

        /** Warming wins over degraded: while language data is still
         * preparing (including a user-initiated retry of the failed mode),
         * that is the actionable state — the degrade text would keep telling
         * the user to retry a retry already running. */
        updateEngineStatus() {
            const el = document.getElementById('engineStatus');
            if (!el) return;
            const degradedActive = !!(this.degrade && this.degrade.active);
            const candidates = document.getElementById('candidates');
            // The status strip takes the candidate bar's slot while visible:
            // both flex:1 side by side would squeeze each other and clip the
            // message instead (keyboard.css #engineStatus).
            if (candidates) candidates.hidden = !!(this.warming || degradedActive);
            if (this.warming) {
                el.textContent = t("正在准备语言数据…");
                el.hidden = false;
            } else if (degradedActive) {
                const modeName = MODES[this.degrade.failedMode]
                    ? t(MODES[this.degrade.failedMode].title) : this.degrade.failedMode;
                el.textContent = t("「{0}」暂以英文直出，点模式键重试").replace('{0}', modeName);
                el.hidden = false;
            } else {
                el.hidden = true;
            }
        }

        /** 中文联想（docs/design/association.md）：原生在 commit 后/点击后
         * 推送后继词；编辑器切换等场景推空列表清屏。 */
        onAssoc(payload) {
            this.assocWords = Array.isArray(payload && payload.words)
                ? payload.words.filter(word => typeof word === 'string' && word) : [];
            if (this.variantReplaying) return;
            this.renderCandidates(this.lastEngineState || {});
        }

        /** 联想词点击：原生写入编辑器并推下一轮联想（连续联想）。 */
        commitAssocWord(word) {
            this.assocWords = [];
            this.renderCandidates(this.lastEngineState || {});
            // 桥全局叫 FeelimeNative（本作用域里别名 Native）；window.Native
            // 从不存在，用它做守卫会把点击静默吞掉（2026-09-13 9o 实录）。
            if (typeof Native !== 'undefined' && typeof Native.commitAssoc === 'function') {
                Native.commitAssoc(word, this.token);
            }
        }

        onEngineState(payload) {
            this.lastRevision = payload.revision || 0;
            this.lastEngineState = payload;
            // 组合开始，联想让位给引擎候选（设计 §3 清空时机）。
            if (payload.composing && this.assocWords.length) this.assocWords = [];
            // 模式变化同样清空：英文模式下残留的中文联想词仍可点击上屏
            // （codex round-1 P2-2）。
            if (payload.mode && this.mode && payload.mode !== this.mode && this.assocWords.length) {
                this.assocWords = [];
            }
            // Engine lifecycle (warming / degraded) is consumed BEFORE the
            // variantReplaying early-return below — a replay in flight must
            // never swallow a degrade or recovery notice (mode-fallback §2.3).
            if (payload.phase === 'LOADING') this.warming = true;
            if (payload.phase === 'READY' && !payload.composing) this.warming = false;
            if (payload.degraded !== undefined) this.applyEngineLifecycle(payload);
            else if (payload.phase === 'LOADING' || payload.phase === 'READY' || this.degrade) {
                this.updateEngineStatus();
            }
            // Replay completes when the echo carrying the target parse
            // arrives; the intermediate echoes (including the empty
            // composition) keep the auto-collapse suppressed until then.
            if (this.variantReplaying && payload.composing) {
                const echoed = payload.rawInput || payload.composing || '';
                const raw = this.mode === 'pinyin'
                    ? echoed.trim().replace(/ +/g, "'") : echoed.replace(/ /g, '');
                if (this.variantTarget && raw === this.variantTarget) this.finishVariantReplay();
            }
            // setComposition emits Reset and every replayed key. None of
            // those intermediate states owns the candidate pool or anchor.
            // Only the final target echo can replace the visible parse.
            if (this.variantReplaying) return;
            if (payload.mode && MODES[payload.mode] && payload.mode !== this.mode) {
                this.mode = payload.mode;
                this.renderMode();
            }
            this.updateComposing(payload, payload.rawInput || payload.composing || '');
            // ONE accumulated pool feeds both the candidate bar and
            // the expanded grid. Maintaining it before renderCandidates (and
            // regardless of expansion) is what lets the bar show every
            // candidate and keep its head after the grid collapses - the old
            // per-page bar is what stranded it on a low-frequency page.
            if (payload.composing) {
                const key = payload.rawInput || payload.composing || '';
                // Rewind bursts can emit a composing event with an EMPTY raw;
                // only a real (non-empty) new input resets the accumulation.
                if (key && key !== this.expandKey) {
                    this.expandKey = key;
                    this.expandCandidates = [];
                    this.resetExpandTab();
                    this.variantAnchor = null;
                    if (this.expanded) this.renderExpanded();
                }
                // The echo after a delete keeps the preedit, so
                // the pool must be rebuilt by hand - accumulateCandidates only
                // appends. The deleted word vanishing from the fresh pool is
                // also the only honest success signal (librime deletes
                // silently; fixed-dictionary words are no-ops).
                if (this.pendingDelete) {
                    const gone = this.pendingDelete;
                    this.pendingDelete = null;
                    this.expandCandidates = [];
                    this.accumulateCandidates(payload);
                    // Review P1: the expanded grid renders
                    // incrementally (expandRendered watermark) - without a
                    // full re-render the deleted word's button would survive
                    // right under a "deleted" toast.
                    if (this.expanded) this.renderExpanded();
                    const stillThere = (this.expandCandidates || []).some(c => c.text === gone.text);
                    this.showToast(stillThere
                        ? t("「{0}」来自固定词库，无法删除", gone.text)
                        : t("已从自选词词库删除「{0}」", gone.text));
                } else {
                    this.accumulateCandidates(payload);
                }
            } else if (!this.variantReplaying) {
                this.expandCandidates = [];
                this.expandKey = null;
                this.pendingDelete = null;
                if (!document.getElementById('confirmCard').hidden) this.closeConfirmCard();
            }
            this.renderCandidates(payload);
            // Intermediate replay events must not clear/rebuild the grid;
            // the target echo lifts the guard above and flows through.
            if (this.expanded && !this.variantReplaying) {
                if (payload.composing) {
                    // Incremental: a full replace would clamp scrollLeft to 0
 // mid-drag .
                    this.appendExpandedCandidates();
                    this.maybeLoadMoreCandidates();
                } else {
                    this.setExpanded(false);
                }
            }
        }

        onNativeState(payload) {
            this.voiceState = payload.state || 'idle';
            if (this.voiceState === 'idle' || this.voiceState === 'error') {
                this.voiceSession = null;
            }
            const overlay = document.getElementById('voiceOverlay');
            const recording = ['listening', 'loading', 'stopping'].includes(this.voiceState);
            overlay.classList.toggle('open', recording);
            // issue #11：data-state 驱动「可以开始说话」的信号——麦克风脉冲
            // 只在真正聆听时出现，加载态弱化静态显示，用户不会过早开口。
            if (recording) overlay.dataset.state = this.voiceState;
            else delete overlay.dataset.state;
            // 两种浮层：长按空格（松手就上屏，无按钮，上滑撤销）与
            // 点 mic（撤销/说完了 按钮）。
            overlay.classList.toggle('hold', recording && this.voiceSession === 'space-hold');
            if (!recording) this.resetSlideCancel();
            document.getElementById('voiceStatus').textContent =
                this.voiceState === 'listening' ? t("正在聆听…")
                : this.voiceState === 'loading' ? t("启动识别…")
                : this.voiceState === 'stopping' ? t("结束识别…")
                : '';
            document.getElementById('voiceHint').textContent =
                this.voiceState === 'loading'
                    ? t("请稍候，就绪后开口说话")
                    : this.voiceSession === 'space-hold'
                        ? t("松手上屏")
                        : t("点击任意位置结束");
            if (payload.message && this.voiceState === 'error') {
                document.getElementById('voiceStatus').textContent = payload.message;
            }
            document.getElementById('partialText').textContent = payload.partial || '';
            document.querySelector('#levelBar i').style.transform = `scaleX(${Math.max(0, Math.min(1, payload.level || 0))})`;
            const mic = document.getElementById('mic');
            // the mic is a fixed SVG icon; only classes/colours change.
            if (mic) mic.className = 'tool' + (this.voiceState === 'idle' ? '' : ' ' + this.voiceState);
            const space = document.querySelector('#spaceKey');
            space?.classList.toggle('voice', this.voiceState !== 'idle');
            this.updateMicDisabled();
            // Recompute composing chrome: a voice session may start/stop while
            // composing, which changes whether the mic tool may stay hidden.
            this.updateComposing({ composing: this.composing });
            // Native messages also explain rejected mode switches while voice
            // stays idle (design §1.3); display them independently of ASR state.
            if (payload.message) this.showToast(payload.message);
        }

        onEditorInfo(payload) {
            this.editorSensitive = !!payload.sensitive;
            this.updateMicDisabled();
        }

        /** H4: mic disabled is the OR of editor sensitivity and stop-in-progress. */
        updateMicDisabled() {
            const mic = document.getElementById('mic');
            if (mic) mic.disabled = this.editorSensitive || this.voiceState === 'stopping';
        }

        showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('open');
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => toast.classList.remove('open'), 2600);
        }
    }

    const Native = window.FeelimeNative || {
        keyboardReady: () => {},
        pushStores: () => '',
        getStores: () => '{}',
        key: value => console.log('key', value),
        setComposition: keys => console.log('setComposition', keys),
        space: () => console.log('space'),
        backspace: () => console.log('backspace'),
        enter: () => console.log('enter'),
        moveCursor: delta => console.log('moveCursor', delta),
        keyEvent: (keyCode, metaState) => console.log('keyEvent', keyCode, metaState),
        chooseCandidate: (revision, id) => console.log('choose', revision, id),
        deleteHighlightedCandidate: () => console.log('deleteHighlightedCandidate'),
        deleteCandidate: (revision, id) => console.log('deleteCandidate', revision, id),
        pageNext: () => {},
        pagePrevious: () => {},
        selectMode: mode => console.log('mode', mode),
        startVoice: () => {},
        stopVoice: () => {},
        switchInputMethod: () => {},
        hideKeyboard: () => {},
        openSetup: () => {},
        reloadKeyboard: () => {},
        requestState: () => {},
        commitText: text => console.log('commitText', text),
        getClipboard: () => {},
        removeClipboard: id => console.log('removeClipboard', id),
        clearClipboard: () => {},
        getFavorites: () => {},
        removeFavorite: id => console.log('removeFavorite', id),
    };

    const THEMES = ['auto', 'light', 'dark'];
    const THEME_LABELS = { auto: '跟随系统', light: '浅色', dark: '深色' };
    // Last system theme seen over the bridge, persisted so the first paint of
    // a rebuilt WebView already matches the system (the CSS prefers-color-
    // scheme fallback stays active until the bridge has spoken once - review
    // F1: never paint a guessed theme over it).
    let systemTheme = 'light';
    let systemThemeKnown = false;
    try {
        const saved = localStorage.getItem('feelime_system_theme');
        if (saved === 'dark' || saved === 'light') {
            systemTheme = saved;
            systemThemeKnown = true;
        }
    } catch (_) { /* storage unavailable */ }
    function applyTheme(theme) {
        // theme 缺省/非法按 auto：auto 跟壳下发的系统主题（systemTheme），
        // 壳没说话前留空类让 CSS media-query 兜底画。
        if (theme !== 'auto' && theme !== 'light' && theme !== 'dark') theme = 'auto';
        const root = document.documentElement;
        if (theme !== 'auto') {
            root.className = `theme-${theme}`;
        } else {
            // auto follows the native system theme (WebView builds differ in
            // whether prefers-color-scheme ever flips). Until the bridge told
            // us once, leave the class unset so the CSS media-query fallback
            // paints.
            root.className = systemThemeKnown ? `theme-${systemTheme}` : '';
        }
        // 主题切换即换对应组的背景图与工具栏图形（两组拆分后这里必须
        // 跟；真机翻车：非 auto 分支提前 return，手动切深色后背景停在
        // 另一组的图上）。hello 首轮走构造路径时 keyboard 还在 TDZ
        // （typeof 也会抛 ReferenceError），吞掉即可——hello 尾部自己的
        // applyBackground/syncToolStates 会铺。
        try {
            keyboard.swapThemeGlyph(theme);
            keyboard.applyBackground();
        } catch (_) { /* pre-init */ }
    }
    function cycleTheme() {
        try {
            const current = localStorage.getItem('feelime_theme') || 'auto';
            const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
            localStorage.setItem('feelime_theme', next);
            applyTheme(next);
            return next;
        } catch (_) {
            return 'auto';
        }
    }
    applyTheme();

    const keyboard = new FeelimeKeyboard();
    // Keyboard buttons must never take TAB/arrow focus. A focused
    // key makes the WebView eat host-injected keyevents (adb `input keyevent`)
    // as spatial navigation + clicks - observed as a '.' per clear attempt
    // and KEYCODE_0 landing as '2'. Unfocusable buttons let those events fall
    // through to the host editor.
    const defocusButtons = () => {
        document.querySelectorAll('button:not([tabindex])').forEach(button => {
            button.tabIndex = -1;
        });
    };
    if (typeof MutationObserver === 'function') {
        new MutationObserver(defocusButtons).observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
    defocusButtons();
    keyboard.cycleTheme = cycleTheme;
    keyboard.themeLabel = () => t(THEME_LABELS[keyboard.themeMode] || THEME_LABELS.auto);

    window.Feelime = {
        onBridgeHello: payload => keyboard.onBridgeHello(payload),
        onEngineState: payload => keyboard.onEngineState(payload),
        onAssoc: payload => keyboard.onAssoc(payload),
        onNativeState: payload => keyboard.onNativeState(payload),
        onEditorInfo: payload => keyboard.onEditorInfo(payload),
        cancelTouches: () => keyboard.cancelTouches(),
        cancelToolbarEdit: () => keyboard.cancelToolbarEdit(),
        onClipboard: payload => keyboard.onClipboard(payload),
        onFavorites: payload => keyboard.onFavorites(payload),
        onStoresRestored: stores => keyboard.onStoresRestored(stores),
        onPanelCommit: payload => keyboard.onPanelCommit(payload),
        onPanelDelete: payload => keyboard.onPanelDelete(payload),
        onPanelComposing: payload => keyboard.onPanelComposing(payload),
        onPanelFinishComposing: payload => keyboard.onPanelFinishComposing(payload),
        onPanelReopen: payload => keyboard.onPanelReopen(payload),
        onPanelFlushed: payload => keyboard.onPanelFlushed(payload),
        // Debug/automation hooks: the mode menu and settings panel render
        // lazily, so DOM-only openers would show an empty container.
        toggleModeMenu: () => keyboard.toggleModeMenu(),
        closeModeMenu: () => keyboard.closeModeMenu(),
        toggleSettingsPanel: () => keyboard.toggleSettingsPanel(),
        closeSettingsPanel: () => keyboard.closeSettingsPanel(),
        toggleControlView: () => keyboard.setControlView(!keyboard.ctrlView),
        showNumpad: () => keyboard.showNumpad(),
        // Called by the native side on every IME show: hiding the IME can
        // DETACH the input view, and a re-attach hands ResizeObserver the
        // current size as its baseline (no callback) - a pad/height change
        // made while hidden would then keep a stale row budget (device-gate
        // proven). Re-derive from the live geometry at show time.
        applyHeightNow: () => keyboard.applyHeight(),
        // Read-only automation probe (device gates): the keyboard instance is
        // a closure, so gates cannot reach runtime fields without this.
        debugState: () => ({
            mode: keyboard.mode,
            holdMs: keyboard.holdMs,
            scrubSpeed: keyboard.scrubSpeed,
            popupSnap: keyboard.popupSnap,
            bottomPad: keyboard.bottomPad,
            // Copy: a hand-out reference would let automation mutate the
            // live degrade state (active=false left a stale badge).
            degraded: keyboard.degrade ? { ...keyboard.degrade } : null,
            warming: keyboard.warming,
            // 工具栏编辑模式（issue #15）：编辑态 + 左右分组只读快照。
            toolbarEdit: keyboard.toolbarEdit,
            toolbarLeft: keyboard.toolbarLeft.slice(),
            toolbarRight: keyboard.toolbarRight.slice(),
            // Automation gates drive setComposition (T9 音节条引擎验证等)；
            // DevTools 已是调试构建的完整控制面，token 不放大攻击面。
            token: keyboard.token,
        }),
        // Voice-overlay preview hooks: 长按空格的浮层（无按钮、上滑撤销）
        // 与 mic 浮层不同形；preview 页没有真实的按住手势，用钩子驱动。
        setVoiceSession: session => { keyboard.voiceSession = session; },
        previewVoiceSlide: progress => keyboard.updateSlideCancel(progress),
        clearEditor: () => keyboard.clearEditorBridge(),
        // The native re-show path lands the keyboard on its
        // main view.
        resetToHome: () => keyboard.resetToHome(),
        // Suite hook: drives the content-height bridge without
        // synthesizing a drag (the drag gesture itself is covered by ).
        applyKbHeight: content => keyboard.applyKbHeight(content),
        // Preview/suite hook (issue #8): switch the preedit font level
        // without a native hello round-trip.
        setPreeditFont: level => {
            keyboard.preeditFont = Number(level) || 0;
            keyboard.applyPreeditFont();
        },
        // Preview/suite hook (issue #15): drive one-handed mode and the
        // side-strip content without a native hello round-trip.
        // Suite hook (issue #15): drive the toolbar drag landing directly
        // (mock cannot synthesize window-level touchmove/touchend).
        toolbarMove: (id, group, index) => keyboard.moveInToolbar(id, group, index),
        // Suite hook (issue #15): run the toolbar audit on demand.
        toolbarAudit: () => keyboard.auditToolbarTools(),
        // Suite hook (issue #15): add from the pool directly (idempotency
        // assertions).
        toolbarAdd: id => keyboard.addToToolbar(id),
        // Suite hook (issue #15): overwrite both groups (audit-scenario
        // setup: ghost array entries / orphans cannot be built otherwise).
        toolbarSet: (left, right) => {
            keyboard.toolbarLeft = [...left];
            keyboard.toolbarRight = [...right];
            keyboard.applyToolbarLayout();
        },
        setOneHand: level => {
            keyboard.oneHand = Number(level) || 0;
            keyboard.applyOneHand();
        },
        setOneHandPad: pct => {
            keyboard.oneHandPad = Number(pct) || 0;
            keyboard.applyOneHand();
        },
        setSideContent: mode => {
            const n = Number(mode) || 0;
            keyboard.sideContent = n === 2 ? 1 : n;
            keyboard.applyOneHand();
        },
        // Suite hook: the real theme-switch entry (toolbar tool / quick
        // tile route through it too).
        cycleTheme: () => keyboard.cycleTheme(),
        // Suite/preview hook: re-evaluate the theme→image mapping after
        // switching html theme classes directly (applyTheme does this in
        // real flows).
        refreshBackground: () => keyboard.applyBackground(),
        // Suite/preview hook: drive the background image without a hello.
        setBgImage: (variant, base64) => {
            if (variant === 'light') keyboard.bgImageLight = base64 || '';
            else if (variant === 'dark') keyboard.bgImageDark = base64 || '';
            keyboard.applyBackground();
        },
        // Device-suite hook: driving the newer bridge methods (height/key
        // events) from automation needs the live page token.
        get token() { return keyboard.token; },
        // design §15: custom-table editing moved to the full settings page;
        // suites drive the surviving save path directly.
        saveCustomJson: text => keyboard.saveCustomJson(text),
    };
    keyboard.setup();
})();
