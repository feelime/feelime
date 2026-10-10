/*
 * Feelime HTML keyboard: config-rendered rows, flick characters, long-press
 * popup, symbol recents. Native access goes through the FeelimeNative bridge
 * (token-gated, design §5.3) with engine candidates, input modes and the
 * recording-only voice overlay.
 */
(() => {
    'use strict';

    // 首帧几何（native 经 URL query 注入的物理 px）：在 hello 之前先把
    // --band/--safe-bottom 落到根元素。CSS 的 fallback 是 0，不设的话
    // 首帧 #softKeyboard 画满整个 IME 窗口（含 200dp 弹层带），hello 到
    // 达后再缩回——真机首载会闪一个「更高的键盘」。hello 仍按权威值
    // 覆盖这里；预览 harness 等无 query 场景保持 0。
    try {
        const geom = new URLSearchParams(location.search);
        const dpr = window.devicePixelRatio || 1;
        const band = Number(geom.get('band'));
        const sb = Number(geom.get('sb'));
        if (band > 0) {
            document.documentElement.style.setProperty('--band', (band / dpr) + 'px');
        }
        if (sb > 0) {
            document.documentElement.style.setProperty('--safe-bottom', (sb / dpr) + 'px');
        }
    } catch (_) {}

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
        "输入统计": "Typing stats", "累计输入": "Total typed", "字": "chars",
        "今日": "Today", "连续": "streak", "天": "days", "查看": "View",
        "累计击键": "Keystrokes", "键 / 字": "keys / char", "日均字数": "Daily avg",
        "日": "Su", "一": "Mo", "二": "Tu", "三": "We", "四": "Th", "五": "Fr", "六": "Sa",
        "≈": "≈", "篇高考作文": "exam essays", "条微博": "weibo posts",
        "再来": "", "字就是一条微博": " more chars make a weibo post",
        "与 Feelime 相伴": "with Feelime for",
        "英文 Direct": "English",
        "全拼 Pinyin": "Pinyin",
        "双拼": "Double Pinyin",
        "笔画 Stroke": "Stroke",
        "重输": "Restart",
        "该键盘还在准备中": "That keyboard is still preparing",
        "已截断至 200 字": "Truncated to 200 characters",
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
        "键盘高度保存失败，请重试": "Failed to save keyboard height, try again",
        "键盘高度保存未确认，请重试": "Height save not confirmed, try again",
        "恢复默认": "Reset",
        "已恢复默认高度": "Default height restored",
        "输入法快捷切换": "Quick switch",
        "长按菜单": "Keyboard menu",
        "定制按键": "Custom keys",
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
        "数字键盘": "Number pad",
        "Emoji": "Emoji",
        "左手": "Left hand",
        "右手": "Right hand",
        "全选": "Select all",
        "粘贴": "Paste",
        "复制": "Copy",
        "剪切": "Cut",
        // #39-10 编辑工具条。选择 = 点亮后方向键带 SHIFT 连续扩选
        // （搜狗「开始选择」的 Android 等价物）。
        "编辑工具": "Editing",
        "选择": "Select",
        "光标到行首": "Line start",
        "光标到行尾": "Line end",
        // #36 双拼 14 键布局。
        "双拼14键": "Dp 14-key",
        "14键": "14",
        "26键": "26",
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
        "span=宽键倍数（1-3，可选），color=键面颜色（blue/green/orange/red/purple，可选），[backspace]=退格，": "span=key width 1-3 (optional), color=key color blue/green/orange/red/purple (optional), [backspace]=backspace, ",
        "note=长按说明。超宽的行可以左右拖动查看。": "note=long-press description. Swipe wide rows to see more keys.",
        "当前状态": "Status",
        "已定制 {0} 个键": "{0} custom keys",
        "未定制": "No custom keys",
        "粘贴 JSON ›": "Paste JSON ›",
        "粘贴 JSON 定制按键": "Paste custom-key JSON",
        "插入模板 ›": "Use example ›",
        "插入定制模板": "Use custom keyboard example",
        "查看说明 ›": "View guide ›",
        "查看定制按键说明": "View the custom-key guide",
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
        "组合过长，已清空": "Composition too long; cleared",
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
        "定制按键 JSON": "Custom-key JSON",
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
        "确认清空": "Confirm clear",
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
        "键盘设置": "Quick settings",
        // 手写键面（issue #28）。空书写区提示三行（round-5）。
        "在此手写": "Write here",
        "模型能力有限": "Model has limits",
        "避免连笔以提高识别率": "Avoid cursive strokes for better results",
        "已清空笔迹": "Ink cleared",
        "手写模型未就绪": "Handwriting model not ready",
        "手写识别失败": "Handwriting recognition failed",
        "手写": "Handwriting"
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

    const KEYBOARD_VERSION = '3.73.36';
    // #39-12 收口：整屏级互斥视图注册表（单一事实源）。统计浮层、
    // 定制面板两轮同款叠层事故的根因是互关调用散装在各个 toggle 里，
    // 新视图忘了关所有人就叠加。现在：新视图在此登记一次（怎么判开、
    // 怎么关、返回层字段），开任何视图统一先 closeOtherViews(自己)，
    // 登记即自动与全部视图互斥；mock 有守门测试枚举 DOM 层比对——
    // 新增 .kb-layer/抽屉不登记直接红。局部小浮层（comboPopup/
    // expandLayer/panelEditor/phraseCard）语义上是叠放小部件，不进表。
    const EXCLUSIVE_VIEWS = {
        settings: { el: 'settingsPanel', openClass: 'open', close: 'closeSettingsPanel', returnField: 'settingsReturnLayer' },
        stats:    { el: 'statsLayer',    openClass: null,    close: 'closeStatsPanel',    returnField: 'statsReturnLayer' },
        edit:     { el: 'editLayer',     openClass: null,    close: 'closeEditPanel',     returnField: 'editReturnLayer' },
        panel:    { el: 'panelLayer',    openClass: null,    close: 'closePanel',         returnField: 'panelReturnLayer' },
        modeMenu: { el: 'modeMenu',      openClass: 'open',  close: 'closeModeMenu' },
    };

    // 14 键贴合开放的模式（全拼/双拼/英文；音形四码、日文假名角标等
    // 专业键面维持 26 键）。
    const MERGEABLE_14 = new Set(['pinyin', 'double-pinyin', 'direct']);

    /** [panel:x] DSL 的面板白名单（#50）：runPanelStep 是唯一分发点，
     *  长按空格的虚拟定制键同样经此打开面板。 */
    const PANEL_STEPS = new Set(['clipboard', 'favorites', 'edit', 'control']);

    /** 纯符号词条判定（issue #17）：每个字符既不是字母（含汉字）也不是
     *  数字——↑✓★🐱♂ 这类 custom_phrase 符号词。用于渲染层把它们重排
     *  到候选第 3 格；含汉字/字母的词（正常词条）不在此列。 */
    function isSymbolicText(text) {
        if (!text) return false;
        return [...String(text)].every(ch => !/\p{L}/u.test(ch) && !/\p{N}/u.test(ch));
    }

    /** 动态日期时间候选（issue #22 分层结论，rime date.lua 等价体验）：
     *  输入码精确命中时在候选池注入运行时生成的 overlay 条目（dyn: 前缀，
     *  点击 clearComposing + commitText 直上屏）。拉丁码（date/time/week）
     *  放池头——这些 raw 在拼音/双拼下只有废句候选，池头让空格直选；
     *  拼音码（riqi 等）放引擎首候选之后——用户打 riqi 多半要「日期」
     *  本词，日期值候选做次选。双拼下 riqi 是真实音节输入（ri'qi=日期），
     *  拼音码只在全拼注册。 */
    const DYNAMIC_INPUT_CODES = {
        date: { kind: 'date', head: true },
        time: { kind: 'time', head: true },
        week: { kind: 'week', head: true },
        riqi: { kind: 'date', head: false },
        shijian: { kind: 'time', head: false },
        xingqi: { kind: 'week', head: false },
        xingq: { kind: 'week', head: false },
    };
    const dynamicWeekNames = ['日', '一', '二', '三', '四', '五', '六'];

    function dynamicCandidatesFor(raw, mode) {
        if (mode !== 'pinyin' && mode !== 'double-pinyin') return [];
        let spec = DYNAMIC_INPUT_CODES[raw];
        if (!spec) return [];
        if (!spec.head && mode !== 'pinyin') return [];
        const now = new Date();
        const pad = value => String(value).padStart(2, '0');
        let texts;
        if (spec.kind === 'date') {
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const d = now.getDate();
            const iso = `${y}-${pad(m)}-${pad(d)}`;
            texts = [
                iso,
                `${y}/${pad(m)}/${pad(d)}`,
                `${y}年${m}月${d}日`,
                `${y}年${m}月${d}日 星期${dynamicWeekNames[now.getDay()]}`,
                `${y}${pad(m)}${pad(d)}`,
            ];
        } else if (spec.kind === 'time') {
            const hh = now.getHours();
            texts = [
                `${pad(hh)}:${pad(now.getMinutes())}`,
                `${pad(hh)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
                `${hh < 12 ? '上午' : '下午'}${hh % 12 || 12}:${pad(now.getMinutes())}`,
            ];
        } else {
            const name = dynamicWeekNames[now.getDay()];
            texts = [`星期${name}`, `周${name}`, now.getDay() === 0 ? '星期天' : `礼拜${name}`];
        }
        return texts.map((text, index) => ({
            id: `dyn:${spec.kind}-${index}`,
            text,
            dynamic: true,
            head: spec.head,
        }));
    }
/** 工具栏可编辑 icon 目录（issue #15 编辑模式）：id → 按钮 DOM id。
 *  logo（左）与收起（右）固定不可编辑；组合态工具（清除/展开）不参与
 *  编辑。完整设置齿轮（#33-1）不再随快开面板自动插栏（会把用户摆好的
 *  图标顶右移一格），改为目录里的一颗可选工具，用户自选常驻。 */
const TOOL_CATALOG = {
    ctrl: 'ctrlTool',
    ime: 'imeSwitchButton',
    clipboard: 'clipboardButton',
    favorites: 'favoritesButton',
    mic: 'mic',
    // 开关型/动作型工具：默认不上栏，只待在编辑仓库里由用户添加（动态创建）。
    // setup 是静态元素（index.html 里的 fullSetupButton），其余动态创建。
    setup: 'fullSetupButton',
    theme: 'toolTheme',
    vibrate: 'toolVibrate',
    sound: 'toolSound',
    assoc: 'toolAssoc',
    onehand: 'toolOneHand',
    numpad: 'toolNumpad',
    emoji: 'toolEmoji',
    // #39-10 编辑工具条：替换键区的编辑面板（方向键/扩选/全选/
    // 复制剪切粘贴），动作全部复用现有桥通道。
    edit: 'editTool',
    // #39-12 定制按键：工具栏直达的独立面板。忘了登进这份目录的话
    // buildToggleTools 照样建按钮，但 setupToolbarEditor 的接线循环
    // 遍历的是本目录——池里那颗点不动也拖不了（真机实录）。
    custom: 'toolCustom',
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
    // #34 删除键下滑=撤销：Ctrl+Z 直发宿主（keyEvent 白名单内：A..Z +
    // CTRL 位）。宿主不支持就无操作——spec 定案不做 fallback。Z 的
    // 键码沿用 Fn 层的 29+字母 公式（KEYCODE_A=29）。
    const BS_UNDO_KEYCODE = 29 + 'Z'.charCodeAt(0) - 65;

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
        // 音形（issue #20，首版小鹤音形）：qwerty 键面（码即字母），
        // 码表用户导入、设备端编译独立 flypy table/prism。strictReady：
        // 未导入（hello 缺字段或产物未落地）时菜单不出入口。
        'flypy': { label: '形', title: '音形 Shape', layout: 'qwerty', engine: true, strictReady: true },
        // 手写（issue #28，design/handwriting.md §1）：独立识别引擎
        // （recognizeInk 笔迹 → onInkCandidates 候选），不接按键引擎
        // （engine:false——退格/空格/回车由原生 Direct 承载）。
        // strictReady：模型未落地（旧 APK 的 hello 缺字段 / thin 未下载）
        // 时菜单不出入口，宽松判定会出现可点却无效的模式。
        'handwriting': { label: '手', title: '手写 Handwriting', layout: 'handwriting', engine: false, strictReady: true },
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
        // 14 键贴合布局（拼音/双拼/英文的 kbLayout pref）：26 字母
        // 两两合并到 14 个宽键帽，'|' 分组（L、M 单键）。合并对内两颗
        // 半区仍是标准 kb-key（data-key=单字母），长按弹层/分词/引擎
        // 全链路零改动——减少误触的来源是键帽变宽、行内缝隙减半。键帽
        // 显示两字母并排居中（韵母小字不显示，方案键位图在设置页有）。
        dp14: {
            rows: [
                'qw|er|ty|ui|op',
                { keys: 'as|df|gh|jk|l', indent: true },
                { keys: 'zx|cv|bn|m', shift: true, backspace: true },
            ],
        },
        // French uses standard QWERTY (no AZERTY); accent candidates
        // follow the design section 6.2 fixture exactly.
        // French long-press set: a gains ä and o gains ö -
        // the collection was incomplete, not just the candidate flow.
        'qwerty-fr': {            rows: [
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
        stats: 'M5 13h3v6H5zM10.5 8h3v11h-3zM16 4h3v15h-3z',
        custom: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h3v4h4v3h-7z',
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
        // #39-10 编辑工具条：衬线 I（编辑语义）+ 左右小箭头（选区/光标
        // 可向两侧移动；2026-09-30 用户参照图定稿）。
        edit: 'M9 4h6v2H9V4zM11 6h2v12h-2V6zM9 18h6v2H9v-2zM6 10L2.5 12 6 14zM18 10L21.5 12 18 14z',
        gear: 'M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
    };
    const SVG_NS = 'http://www.w3.org/2000/svg';
    // 少数 icon 用文字字形而非几何 path：数字键盘的九宫格点阵被反馈
    // 「含义不明（像二维码）」，「123」数字本身一眼可读（iOS 数字键
    // 同款语义）。文字走 <text>，其余 icon 保持单 path 实心填充。
    const ICON_TEXTS = { numpad: '123' };
    const ICONS = {};
    // 文字 icon 不在 ICON_PATHS 里，构建源要并上它们（否则 ICONS.numpad
    // 缺席，cloneNode 时才炸）。
    for (const name of [...Object.keys(ICON_PATHS), ...Object.keys(ICON_TEXTS)]) {
        const pathData = ICON_PATHS[name];
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        if (ICON_TEXTS[name]) {
            const text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('x', '12');
            text.setAttribute('y', '17');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '13');
            text.setAttribute('font-weight', '700');
            text.textContent = ICON_TEXTS[name];
            svg.append(text);
        } else {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', pathData);
            svg.append(path);
        }
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
        // #39-12 定稿：定制表回符号面板 tab（工具栏按钮 = 直达此 tab，
        // 与数字/表情的行为模式统一；不做独立面板）。位置沿用旧版第
        // 二位——追加到末尾会被分类条横滚藏到一屏外，用户找不到
        // （真机实录）。
        { id: 'custom', label: '定制', rows: null },
        // The user's own table, between 常用 and 最近; hidden
        // from the strip until it has content (renderSymbolCats filters).
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
    const KB_ROW_MIN = 32;
    // 手写控制行键高（CSS px）：固定值，不参与 --kb-row-h 预算（键盘
    // 高度调节的弹性全部给书写面板）。
    const INK_CONTROL_ROW_H = 46;
    // 长按菜单的默认勾选集（round-6 用户拍板）：英文/全拼/双拼/九宫格/
    // 笔画。手写实验性（识别率有限）不默认进菜单，用户主动勾选才显示。
    const DEFAULT_MENU_MODES = ['direct', 'pinyin', 'double-pinyin', 't9', 'stroke'];

    // #31 预置色调（设置页外观卡「键盘色调」）：CSS 侧 html[data-preset]
    // 只覆盖 accent 三件套；classic 为默认（无 dataset）。
    const THEME_PRESETS = ['classic', 'ocean', 'violet', 'amber', 'sakura', 'teal'];
    // 右列滚动符号列（round-6）：T9/数字面板左列同款形态——常驻滚动
    // 列表，视口露出前三格（，。？），上滑滚出更多，点按直上屏。
    const INK_SIDE_SYMBOLS = ['，', '。', '？', '！', '：', '；', '、', '～', '……', '·', '＃', '＠'];
    // 空书写区的三行提示（round-5，用户反馈）：首行是动作，后两行是
    // 预期管理——模型能力有限、连笔拖识别率。双语走 UI_EN。
    const INK_HINT_LINES = ['在此手写', '模型能力有限', '避免连笔以提高识别率'];
    // 手写停笔→识别的触发延时档位（设置页「手写」区块，hello 下发）。
    // 实时识别（模型 v2 后推理毫秒级，issue #32）：每笔 touchend 立即识别，
    // 候选随笔画刷新（wetype 同款体验）。识别时机不再可配（停顿档已被
    // 实时模式完全取代：每笔都重新识别，写得慢的人最后一笔照样立即出
    // 正确候选，无「抢识别」问题）。
    // 平滑重采样的目标点距（CSS px）：与采点瘦身的最小间距（2px）同量
    // 级，等距后 payload 通常比原始 60Hz 采样更小（桥上限 4096 字符）。
    const INK_SMOOTH_STEP = 3;

    /** 轨迹平滑（只作用于发给引擎的笔迹，屏上实时笔迹保持原样）：
     * ① 5 点三角核（1-2-3-2-1）滑动平均去手指抖动——窗口小、首尾点
     *    原样保留，拐角只有轻度过渡；② 按弧长等距重采样，点距均匀。
     *    输入输出都是 [{x,y}]，payload 结构不变（native 侧无感）。 */
    function smoothInkStroke(points, step = INK_SMOOTH_STEP) {
        if (!Array.isArray(points) || points.length < 3) return points;
        const kernel = [1, 2, 3, 2, 1];
        const smoothed = points.map((point, index) => {
            let sumX = 0, sumY = 0, sumW = 0;
            for (let offset = -2; offset <= 2; offset++) {
                const j = index + offset;
                if (j < 0 || j >= points.length) continue;
                const weight = kernel[offset + 2];
                sumX += points[j].x * weight;
                sumY += points[j].y * weight;
                sumW += weight;
            }
            return { x: sumX / sumW, y: sumY / sumW };
        });
        // 起笔/收笔锚点不动：识别对首尾位置敏感（字形外框）。
        smoothed[0] = { x: points[0].x, y: points[0].y };
        smoothed[smoothed.length - 1] = { x: points[points.length - 1].x, y: points[points.length - 1].y };
        const resampled = [smoothed[0]];
        let from = smoothed[0];
        let carry = 0;
        for (let i = 1; i < smoothed.length; i++) {
            let to = smoothed[i];
            let seg = Math.hypot(to.x - from.x, to.y - from.y);
            while (carry + seg >= step) {
                const t = (step - carry) / seg;
                from = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
                resampled.push({ x: from.x, y: from.y });
                seg = Math.hypot(to.x - from.x, to.y - from.y);
                carry = 0;
            }
            carry += seg;
            from = to;
        }
        // 收笔点必须保留（短笔画/末段不足半步时也要收口）。
        const end = smoothed[smoothed.length - 1];
        const tail = resampled[resampled.length - 1];
        if (Math.hypot(end.x - tail.x, end.y - tail.y) > 0) resampled.push(end);
        return resampled;
    }

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
        return stores;
    }

    function pushStores(changed) {
        // 类型守卫：热更键盘（新 JS）跑在旧原生（无 pushStores）上时，
        // 不许在 hello 路径抛错——能力握手之外的方法一律探测后再调。
        // 载荷内嵌 __rev（本地最后见到的镜像 rev）做 CAS：设置页已推进
        // 镜像（如排序）而键盘还揣着旧 localStorage 时，native 拒绝并返
        // 回 "-1"。
        // changed = {key: value}：本次实际修改的键值（codex 三轮 P2-2/3）。
        // 冲突时拉取铺完远端值后【只回放这些键】（localStorage + 运行态
        // 走 onStoresRestored 同一通道），再全量重推——重放全量旧值会把
        // 设置页刚写的未触碰键顶回旧值。无 changed（握手同步）冲突时拉平
        // 即目标状态，直接返回；修改保留在 localStorage，下次推送收敛。
        // 旧原生不认 __rev（白名单外自然忽略），行为不变。
        try {
            if (typeof Native.pushStores !== 'function') return;
            const payload = changed || collectStores();
            const carry = {};
            for (const key of STORE_BACKUP_KEYS) {
                if (payload[key] !== undefined) carry[key] = payload[key];
            }
            carry.__rev = localStorage.getItem('feelime_stores_rev') || '0';
            const rev = Native.pushStores(JSON.stringify(carry), keyboard.token);
            if (rev === '-1') {
                // 拉平（含运行态）。onStoresRestored 是全量覆盖语义（会删
                // 缺席键，codex 四轮 P2）：回放必须喂「拉取后的全量 + 本
                // 次修改键」合并结果，不能只喂修改键。
                pullStores(keyboard.token);
                if (!changed) return;
                const replay = collectStores();
                for (const key in changed) {
                    try { localStorage.setItem(key, changed[key]); } catch (_) {}
                    replay[key] = changed[key];
                }
                keyboard.onStoresRestored(replay);
                pushStores();
                return;
            }
            if (rev) localStorage.setItem('feelime_stores_rev', String(rev));
        } catch (_) { /* bridge unavailable */ }
    }

    /** 原生镜像拉平（userdata.md §1.5）：native 是唯一真相源，镜像 rev
     * 与本地记录【不等】（native 有新写入：设置页保存 / 备份恢复）就
     * adopt values，方向无关。曾用 remoteRev > localRev 判「更新」——
     * 备份恢复（UserdataBackup.restore）写镜像只做 rev+1 不看键盘本地
     * rev，低 rev 备份导入后镜像低于本地，倒挂一旦发生永不拉平，设置
     * 页的键盘选择从此到不了键盘（AVD 实测 5>1 卡死）。相等（没有新
     * 写入）跳过：镜像里的陈旧值（如旧语言）不许顶掉 hello 带来的
     * 新状态。rev 完全跟随 native（不是取 max）：CAS 的 base 必须等于
     * mirrorRev，本地揣高值只会让后续 push 永远 -1。
     * values 键缺席 = 镜像从未写入过（老 APK 升级首握手），跳过——
     * 不能当「空备份」触发全量删除把本地键洗掉；键在值空（{}）是
     * 显式恢复的空状态，照常 adopt（清空语义，4105 测试锁定）。 */
    function pullStores(token) {
        try {
            if (typeof Native.getStores !== 'function') return;
            const mirror = JSON.parse(Native.getStores(token) || '{}');
            if (!Object.prototype.hasOwnProperty.call(mirror, 'values')) return;
            const remoteRev = parseInt(mirror.rev || 0, 10) || 0;
            const localRev = parseInt(localStorage.getItem('feelime_stores_rev') || '0', 10) || 0;
            if (remoteRev === localRev) return;
            // 只有真正的键值对象才表达恢复语义：数组/字符串等异常载荷
            // 不能当成「空备份」触发全量删除（native 正常产出 JSONObject）。
            const values = mirror.values;
            const valid = values !== null && typeof values === 'object' && !Array.isArray(values);
            if (valid) {
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
    // 定制键色板（cell.color 的合法值）：预设色名而非任意 CSS 色，
    // 零注入面；rgba 在亮/暗两种键底上都可辨。
    const CUSTOM_KEY_COLORS = ['blue', 'green', 'orange', 'red', 'purple'];
    // 注记（2026-10-03）：面向用户的「实用样例」真相源在 settings.js 的
    // CK_TEMPLATE；此处仅为 editorReturn 返回态的兜底残留——入口现状
    // 见 mock_bridge_tests「custom keys: backspace…」用例的注释推理，
    // 并无机械断言锁住，不与新样例同步。
    const CUSTOM_TEMPLATE = JSON.stringify({
        version: 1,
        rows: [
            [
                { t: 'Esc', tap: '[esc]', note: 'Vim / 终端 Esc' },
                { t: ':w', tap: ':w[enter]', note: 'Vim 保存' },
                { t: '整理', tap: '[esc]ggVGD', note: 'Vim 全文重新缩进' },
                { t: '保存', tap: '[ctrl+s]', note: '常见保存快捷键', color: 'blue' },
                { t: '√', tap: '√' }, { t: '→', tap: '→' }, { t: 'F5', tap: '[f5]', note: '刷新' },
                { t: '⌫', tap: '[backspace]', note: '退格，长按连删' },
            ],
            [
                { t: '邮箱', tap: 'me@example.com', span: 2 },
            ],
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
    const FULL_PINYIN_SYLLABLES_SET = new Set(FULL_PINYIN_SYLLABLES);

// BEGIN GENERATED T9_SYLLABLE_INDEX
    // 由 scripts/generate-t9-syllables.py 生成：数字串 → 音节
    // （组内按词典词频降序）+ 音节词重表 + 声母前缀层
    // （424 音节，源 luna_pinyin.table.txt）。
    const T9_SYLLABLE_INDEX = {"full":{"33":["de"],"43":["he","ge"],"744":["shi"],"53":["le","ke"],"924":["zai","wai","yai"],"96":["wo","yo"],"93":["ye","ze"],"548":["jiu","liu"],"94":["yi","zi","xi"],"384":["dui"],"326":["dan","dao","fan"],"6426":["nian","mian","miao","niao"],"943":["zhe","xie"],"37":["er"],"786":["suo","qun","run","ruo","sun"],"968":["you","zou"],"94664":["zhong","xiong"],"64":["ni","mi"],"636":["men","nen"],"934":["wei","zei"],"946":["yin","xin"],"82":["ta"],"736":["ren","pen","sen"],"98":["yu","xu","wu","zu"],"54":["ji","li"],"486":["guo","huo","hun","gun"],"78":["ru","qu","pu","su"],"468":["hou","gou"],"2664":["cong"],"74264":["shang","qiang"],"424":["hai","gai"],"3364":["deng","feng"],"368":["dou","fou"],"634":["mei","nei"],"484":["hui","gui"],"234":["bei","cei"],"524":["lai","kai"],"22":["ba","ca"],"386":["duo","dun"],"436":["hen","gen"],"9664":["yong","zong","wong"],"726":["ran","san","pan","pao","rao","sao"],"9426":["xian","xiao","zhan","zhao"],"926":["yao","wan","yan","zao","zan"],"7486":["shuo","shun"],"63":["ne","me"],"24":["bi","ci","ai"],"944":["zhi"],"743":["qie","she","pie"],"74":["qi","si","ri","pi"],"2":["a"],"6364":["neng","meng"],"62":["na","ma"],"986":["zuo","yun","xun","zun"],"482":["hua","gua"],"4664":["gong","hong"],"28":["bu","cu"],"984":["zui"],"5464":["jing","ling"],"9826":["xuan","yuan","zuan"],"8664":["tong"],"784":["sui","rui"],"54264":["jiang","liang"],"434":["gei","hei"],"546":["jin","lin"],"9464":["xing","ying"],"983":["yue","xue"],"3264":["dang","fang"],"7264":["rang","pang","sang"],"526":["kan","lao","kao","lan"],"5426":["jian","jiao","lian","liao"],"9264":["yang","wang","zang"],"543":["jie","lie"],"84":["ti"],"936":["wen","zen"],"942":["xia","zha"],"32":["da","fa"],"542":["jia","lia"],"2426":["chan","biao","bian","chao"],"746":["pin","qin"],"7436":["shen"],"9436":["zhen"],"7664":["rong","song"],"94826":["zhuan"],"7426":["qian","shao","pian","qiao","piao","shan"],"226":["ban","bao","cao","can"],"2464":["bing"],"248":["chu"],"4364":["geng","heng"],"426":["hao","gan","gao","han"],"34":["di","ei","eh"],"58":["ju","lv","lu","ku"],"748":["shu","qiu"],"3664":["dong","fong"],"783":["que"],"4826":["guan","huan"],"3426":["dian","diao","fiao"],"68":["mu","nu","nv","ou"],"236":["ben","cen"],"94264":["xiang","zhang"],"24264":["chang","biang"],"334":["fei","dei"],"48":["hu","gu"],"74364":["sheng"],"7468":["shou"],"336":["fen","den"],"884":["tui"],"583":["jue","lve"],"286":["cun","cuo"],"586":["kuo","lun","luo","jun","kun"],"224":["cai","bai"],"24364":["cheng"],"7464":["ping","qing"],"824":["tai"],"948":["zhu","xiu"],"7364":["peng","reng","seng"],"7826":["quan","ruan","suan"],"94364":["zheng"],"26":["an","bo","ao"],"7484":["shui"],"8426":["tian","tiao"],"534":["lei","kei"],"58264":["kuang"],"624":["mai","nai"],"38":["du","fu"],"3464":["ding"],"244":["chi"],"724":["pai","sai"],"66":["mo"],"243":["bie","che"],"868":["tou"],"948264":["zhuang"],"52":["la","ka"],"8826":["tuan"],"83":["te"],"9486":["zhun","zhuo"],"6":["o"],"5664":["kong","long"],"324":["dai"],"24664":["chong"],"626":["nan","man","nao","mao"],"9364":["zeng","weng"],"2264":["bang","cang"],"536":["ken"],"88":["tu"],"6464":["ming","ning"],"4264":["hang","gang"],"3826":["duan"],"826":["tao","tan"],"8464":["ting"],"242":["cha"],"2364":["ceng","beng"],"92":["ya","za","wa"],"5826":["kuan","juan","luan","lvan"],"24826":["chuan"],"48264":["guang","huang"],"668":["mou","nou"],"7434":["shei"],"73":["se","re"],"23":["ce"],"72":["pa","sa"],"5824":["kuai"],"9484":["zhui"],"768":["sou","rou","pou"],"646":["nin","min"],"248264":["chuang"],"9468":["zhou"],"2486":["chun","chuo"],"734":["pei","sei"],"8364":["teng"],"7482":["shua"],"5264":["kang","lang"],"76":["po"],"748264":["shuang"],"42":["ha","ga"],"742":["sha","qia","pia"],"284":["cui"],"648":["niu","miu"],"568":["kou","lou"],"584":["kui"],"4824":["huai","guai"],"3":["e"],"5364":["keng","leng"],"2484":["chui"],"64264":["niang"],"9424":["zhai"],"7424":["shai"],"36":["en","fo"],"364":["eng"],"6264":["mang","nang"],"843":["tie"],"9482":["zhua"],"886":["tuo","tun"],"6664":["nong"],"8264":["tang"],"686":["nuo","nun"],"2468":["chou"],"6826":["nuan"],"343":["die"],"2436":["chen"],"643":["mie","nie"],"348":["diu"],"74664":["qiong"],"582":["kua"],"2424":["chai"],"74824":["shuai"],"264":["ang"],"268":["cou"],"54664":["jiong"],"246":["bin"],"683":["nve"],"94824":["zhuai"],"24824":["chuai"],"56":["lo"],"2826":["cuan"],"74826":["shuan"],"834":["tei"],"342":["dia"],"5863464":["junding"],"782":["rua"],"2482":["chua"],"642":["nia"],"9434":["zhei"]},"pre":{"2":["b","c"],"7":["p","q","r","s"],"6":["m","n"],"3":["f","d"],"8":["t"],"5":["l","k","j"],"4":["g","h"],"9":["x","z","y","w"],"94":["zh"],"24":["ch"],"74":["sh"]},"w":{"a":241987.0,"ai":27194.0,"an":77968.0,"ang":2638.0,"ao":7456.0,"ba":297688.0,"bai":18893.0,"ban":133998.0,"bang":48398.0,"bao":98057.0,"bei":307050.0,"ben":110259.0,"beng":9228.0,"bi":250303.0,"bian":49184.0,"biao":50480.0,"bie":60802.0,"bin":1843.0,"bing":132093.0,"bo":23765.0,"bu":207954.0,"ca":3732.0,"cai":92394.0,"can":26557.0,"cang":12182.0,"cao":57636.0,"ce":32378.0,"cen":1308.0,"ceng":39396.0,"cha":39817.0,"chai":4336.0,"chan":157472.0,"chang":104251.0,"chao":47703.0,"che":28616.0,"chen":5833.0,"cheng":91329.0,"chi":64535.0,"chong":50333.0,"chou":7356.0,"chu":131290.0,"chua":5.0,"chuai":1665.0,"chuan":36479.0,"chuang":28040.0,"chui":12365.0,"chun":24143.0,"chuo":5624.0,"ci":121297.0,"cong":412357.0,"cou":2627.0,"cu":8543.0,"cuan":1207.0,"cui":15712.0,"cun":98198.0,"cuo":41913.0,"da":159662.0,"dai":51204.0,"dan":562737.0,"dang":176606.0,"dao":322254.0,"de":15378500.0,"dei":43371.0,"den":28.0,"deng":396005.0,"di":117349.0,"dia":182.0,"dian":111245.0,"diao":18300.0,"die":6602.0,"ding":67788.0,"diu":5100.0,"dong":117002.0,"dou":391232.0,"du":68624.0,"duan":44690.0,"dui":584384.0,"dun":17448.0,"duo":294090.0,"e":13374.0,"ei":5305.0,"en":10134.0,"eng":10134.0,"er":539248.0,"fa":120894.0,"fan":33534.0,"fang":114225.0,"fei":104251.0,"fen":101685.0,"feng":53675.0,"fo":3368.0,"fou":67858.0,"fu":49524.0,"ga":7018.0,"gai":88611.0,"gan":73137.0,"gang":37286.0,"gao":65920.0,"ge":626691.0,"gei":188201.0,"gen":147430.0,"geng":125721.0,"gong":209310.0,"gou":117534.0,"gu":76665.0,"gua":9446.0,"guai":7505.0,"guan":112060.0,"guang":36138.0,"gui":28931.0,"gun":8644.0,"guo":430059.0,"ha":17356.0,"hai":398723.0,"han":19158.0,"hang":44921.0,"hao":124546.0,"he":2111740.0,"hei":22743.0,"hen":294090.0,"heng":17639.0,"hong":10295.0,"hou":424548.0,"hu":103580.0,"hua":218677.0,"huai":13611.0,"huan":76656.0,"huang":15592.0,"hui":328671.0,"hun":13393.0,"huo":307899.0,"ji":433606.0,"jia":159662.0,"jian":169881.0,"jiang":189390.0,"jiao":152337.0,"jie":162145.0,"jin":185284.0,"jing":206450.0,"jiong":1943.0,"jiu":662839.0,"ju":117279.0,"juan":11054.0,"jue":99038.0,"jun":20471.0,"ka":19593.0,"kai":191457.0,"kan":171172.0,"kang":21317.0,"kao":55435.0,"ke":463104.0,"kei":36.0,"ken":47340.0,"keng":12698.0,"kong":52183.0,"kou":15140.0,"ku":16083.0,"kua":4558.0,"kuai":29689.0,"kuan":38037.0,"kuang":70367.0,"kui":14031.0,"kun":12335.0,"kuo":98057.0,"la":57684.0,"lai":306900.0,"lan":12239.0,"lang":8966.0,"lao":130337.0,"le":1758340.0,"lei":72936.0,"leng":4380.0,"li":270298.0,"lia":5477.0,"lian":56359.0,"liang":102276.0,"liao":50243.0,"lie":47768.0,"lin":14686.0,"ling":100461.0,"liu":29772.0,"lo":1575.0,"long":7256.0,"lou":10262.0,"lu":31123.0,"luan":7513.0,"lun":50447.0,"luo":39237.0,"lv":48585.0,"lve":30773.0,"ma":191507.0,"mai":69102.0,"man":34361.0,"mang":9938.0,"mao":17448.0,"me":229812.0,"mei":339165.0,"men":474118.0,"meng":13491.0,"mi":31043.0,"mian":112834.0,"miao":34086.0,"mie":5646.0,"min":13243.0,"ming":45277.0,"miu":1216.0,"mo":60898.0,"mou":35516.0,"mu":111169.0,"na":229812.0,"nai":11506.0,"nan":49856.0,"nang":1872.0,"nao":22788.0,"ne":262461.0,"nei":145310.0,"nen":1238.0,"neng":231337.0,"ni":492791.0,"nian":561011.0,"niang":11554.0,"niao":4810.0,"nie":3229.0,"nin":28473.0,"ning":4571.0,"niu":15631.0,"nong":7982.0,"nou":28.0,"nu":45671.0,"nuan":6711.0,"nuo":7401.0,"nv":26409.0,"nve":1820.0,"o":52861.0,"ou":23075.0,"pa":29699.0,"pai":62621.0,"pan":32877.0,"pang":16319.0,"pao":22328.0,"pei":23626.0,"pen":10376.0,"peng":83108.0,"pi":17210.0,"pian":37616.0,"piao":30226.0,"pie":991.0,"pin":157472.0,"ping":87412.0,"po":21074.0,"pou":2431.0,"pu":46321.0,"qi":244945.0,"qia":7017.0,"qian":144346.0,"qiang":24975.0,"qiao":30416.0,"qie":249296.0,"qin":28585.0,"qing":70367.0,"qiong":5024.0,"qiu":102525.0,"qu":334183.0,"quan":80604.0,"que":113483.0,"qun":23042.0,"ran":270797.0,"rang":171499.0,"rao":8137.0,"re":13271.0,"ren":453337.0,"reng":25913.0,"ri":100724.0,"rong":145310.0,"rou":19002.0,"ru":430059.0,"rua":19.0,"ruan":46998.0,"rui":4750.0,"run":20840.0,"ruo":16573.0,"sa":8034.0,"sai":35543.0,"san":43160.0,"sang":6200.0,"sao":4077.0,"se":32382.0,"sen":4185.0,"seng":1406.0,"sha":16822.0,"shai":10409.0,"shan":12775.0,"shang":403722.0,"shao":62654.0,"she":111999.0,"shei":32982.0,"shen":155349.0,"sheng":103356.0,"shi":1799850.0,"shou":102144.0,"shu":117279.0,"shua":22625.0,"shuai":3151.0,"shuan":534.0,"shuang":17758.0,"shui":75217.0,"shun":16678.0,"shuo":267892.0,"si":209310.0,"song":18669.0,"sou":29331.0,"su":34911.0,"suan":40652.0,"sui":195193.0,"sun":15339.0,"suo":531005.0,"ta":456616.0,"tai":87412.0,"tan":16511.0,"tang":7489.0,"tao":43260.0,"te":53417.0,"tei":378.0,"teng":22816.0,"ti":160751.0,"tian":74823.0,"tiao":33270.0,"tie":9776.0,"ting":40801.0,"tong":202194.0,"tou":60086.0,"tu":45975.0,"tuan":54171.0,"tui":100581.0,"tun":2514.0,"tuo":8000.0,"wa":7545.0,"wai":100461.0,"wan":91334.0,"wang":80539.0,"wei":471708.0,"wen":160751.0,"weng":653.0,"wo":889049.0,"wu":66653.0,"xi":166470.0,"xia":159752.0,"xian":270732.0,"xiang":109045.0,"xiao":97239.0,"xie":283623.0,"xin":76905.0,"xing":185284.0,"xiong":21890.0,"xiu":38729.0,"xu":269447.0,"xuan":202800.0,"xue":162734.0,"xun":45112.0,"ya":38123.0,"yan":84982.0,"yang":166264.0,"yao":269447.0,"ye":693871.0,"yi":626691.0,"yin":471708.0,"ying":99740.0,"yo":3101.0,"yong":277346.0,"you":527912.0,"yu":439612.0,"yuan":89796.0,"yue":182932.0,"yun":50031.0,"za":33538.0,"zai":1436320.0,"zan":22833.0,"zang":7591.0,"zao":42666.0,"ze":202800.0,"zei":4862.0,"zen":76710.0,"zeng":49111.0,"zha":6845.0,"zhai":10916.0,"zhan":74704.0,"zhang":72090.0,"zhao":64811.0,"zhe":555006.0,"zhen":153469.0,"zheng":79081.0,"zhi":249628.0,"zhong":497871.0,"zhou":25394.0,"zhu":86942.0,"zhua":9052.0,"zhuai":1679.0,"zhuan":144350.0,"zhuang":59764.0,"zhui":29497.0,"zhun":53344.0,"zhuo":8033.0,"zi":433606.0,"zong":51524.0,"zou":35582.0,"zu":32618.0,"zuan":3600.0,"zui":207726.0,"zun":9676.0,"zuo":220986.0,"junding":50.0}};
    // END GENERATED T9_SYLLABLE_INDEX

    // Double-pinyin parse variants and the displayed key map come from the
    // generated block below: per scheme (ziranma / flypy / sogou), derived
    // from the shipped schemas by scripts/generate-keyboard-data.py and
    // re-checked against the prisms by scripts/verify/guard_dp_finals.js.

    function modeLabel(mode) {
        if (uiLocale === 'en') return ({pinyin: 'PY', 'double-pinyin': 'DP', t9: 'T9', japanese: 'JP', handwriting: 'HW'})[mode] || MODES[mode].label;
        return (MODES[mode] || MODES.direct).label;
    }

    /** Parse-variant table of the ACTIVE scheme (generated block); falls
     * back to 自然码 when native reported an unknown id (older engine). */
    function dpFinals() {
        return DP_INITIAL_FINALS[dpScheme] || DP_INITIAL_FINALS.ziranma;
    }

    // BEGIN GENERATED SCHEMA_MAP
    // schema-sha256: ziranma=ac60c13a00eae405 flypy=7850588e9495b50d sogou=e278729922814390 ziguang=6a139f79776718dd
    const DP_INITIAL_FINALS = {"ziranma":{"a":"ahijklno","b":"acdfghijklmnouxyz","c":"abefghijkloprsuvz","d":"abcefghijklmopqrsuvwxyz","e":"efginrz","f":"abcfghjosuz","g":"abdefghjkloprsuvwyz","h":"abdefghjkloprsuvwyz","i":"abdefghijkloprsuvwy","j":"cdimnpqrstuvwxy","k":"abdefghjkloprsuvwyz","l":"abcdeghijklmnopqrstuvwxyz","m":"abcefghijklmnoquxyz","n":"abcdefghijklmnopqrstuvwxyz","o":"abefghjkloruz","p":"abcfghijklmnouwxyz","q":"cdimnpqrstuvwxy","r":"befghijkoprsuvw","s":"abefghijkloprsuvz","t":"abceghijklmoprsuvxyz","u":"abdefghijklopruvwyz","v":"abdefghijkloprsuvwyz","w":"afghjlosuz","x":"cdimnpqrstuvwxy","y":"abehijklnoprstuvy","z":"abefghijkloprsuvz"},"flypy":{"a":"acdhijno","b":"abcdfghijklmnopuw","c":"acdefghijorsuvwyz","d":"acdefghijkmnopqrsuvwxyz","e":"efghinrw","f":"afghjnosuwz","g":"acdefghjklorsuvwxyz","h":"acdefghjklorsuvwxyz","i":"acdefghijklorsuvxyz","j":"biklmnpqrstuvxy","k":"acdefghjklorsuvwxyz","l":"abcdeghijklmnopqrstuvwxyz","m":"abcdefghijkmnopquwz","n":"abcdefghijklmnopqrstuvwxyz","o":"ouz","p":"abcdfghijkmnopuwxz","q":"biklmnpqrstuvxy","r":"cefghijorsuvxyz","s":"acdefghijorsuvwyz","t":"acdeghijkmnoprsuvwyz","u":"acdefghijkloruvwxyz","v":"acdefghijklorsuvwxyz","w":"adfghjosuw","x":"biklmnpqrstuvxy","y":"abcdehijkorstuvyz","z":"acdefghijorsuvwyz"},"sogou":{"a":"ahjkl","b":";acdfghijklmnouxz","c":"abefghijkloprsuvz","d":";abcefghijklmopqrsuvwxz","e":"efgrz","f":"abcfghjosuz","g":"abdefghjkloprsuvwyz","h":"abdefghjkloprsuvwyz","i":"abdefghijkloprsuvwy","j":";cdimnpqrstuwxy","k":"abdefghjkloprsuvwyz","l":";abcdeghijklmnopqrstuwxyz","m":";abcefghijklmnoquxz","n":";abcdefghijklmnopqrstuwxyz","o":"abefghjkloruz","p":";abcfghijklmnouwxz","q":";cdimnpqrstuwxy","r":"befghijkoprsuvw","s":"abefghijkloprsuvz","t":";abceghijklmoprsuvxz","u":"abdefghijklopruvwyz","v":"abdefghijkloprsuvwyz","w":"afghjlosuz","x":";cdimnpqrstuwxy","y":";abehijklnoprstuy","z":"abefghijkloprsuvz"},"ziguang":{"a":"aeghilmnopqrstuwxyz","b":";abdfgikopqrstuwy","c":"aehiklmnopqrstuwz","d":";abdefhijklmnopqrstuwxz","f":"abhkorstuwz","g":"aeghklmnopqrstuwxyz","h":"aeghklmnopqrstuwxyz","i":"aegiklmnopqrstuwxyz","j":";bdfghijlmnuvxy","k":"aeghklmnopqrstuwxyz","l":";abdefghijklmnopqrstuvxyz","m":";abdefijkopqrstuwyz","n":";abdefghijklmnopqrstuvwxyz","o":"aejkopqrstwz","p":";abdfikopqrstuwxyz","q":";bdfghijlmnuvxy","r":"ehilmnoqrstuwxz","s":"aehiklmnopqrstuwz","t":";abdefhiklmnopqrstuz","u":"aeghiklmnopqrstuwxyz","w":"ahkoprstuw","x":";bdfghijlmnuvxy","y":";aehilmnopqrsuvyz","z":"aehiklmnopqrstuwz"}};
    const DP_KEYMAP = {"ziranma":{"q":"iu","w":"ua/ia","e":null,"r":"uan/er","t":"ue/ve","y":"ing/uai","u":"sh","i":"ch","o":"uo","p":"un","a":null,"s":"ong/iong","d":"iang/uang","f":"en","g":"eng","h":"ang","j":"an","k":"ao","l":"ai","z":"ei","x":"ie","c":"iao","v":"zh/ui ü","b":"ou","n":"in","m":"ian"},"flypy":{"q":"iu","w":"ei","e":null,"r":"uan/er","t":"ue/ve","y":"un","u":"sh","i":"ch","o":"uo","p":"ie","a":null,"s":"ong/iong","d":"ai","f":"en","g":"eng","h":"ang","j":"an","k":"ing/uai","l":"iang/uang","z":"ou","x":"ua/ia","c":"ao","v":"zh/ui ü","b":"in","n":"iao","m":"ian"},"sogou":{"q":"iu","w":"ua/ia","e":null,"r":"uan/er","t":"ue/ve","y":"uai","u":"sh","i":"ch","o":"uo","p":"un","a":null,"s":"ong/iong","d":"iang/uang","f":"en","g":"eng","h":"ang","j":"an","k":"ao","l":"ai","z":"ei","x":"ie","c":"iao","v":"zh/ui","b":"ou","n":"in","m":"ian"},"ziguang":{"q":"ao","w":"en","e":null,"r":"an","t":"eng","y":"uai/in","u":"zh","i":"sh","o":"uo","p":"ai","a":"ch","s":"ang","d":"ie","f":"ian","g":"iang/uang","h":"ong/iong","j":"iu/er","k":"ei","l":"uan","z":"ou","x":"ua/ia","v":null,"b":"iao","n":"ui üe","m":"un"}};
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
            // #39-10 编辑面板的选择 toggle（开 = 方向键/行首行尾带 SHIFT）。
            this.editSelecting = false;
            // #36 双拼 14 键布局（hello 推送，"26"|"14"，仅双拼模式生效）。
            this.kbLayout = '26';
            // 法语候选大小写循环（用户需求）：null=原样 'cap'=首字母大写
            // 'upper'=全大写；组合期生效，组合结束归零。
            this.caseMode = null;
            this.lettersLayout = null;
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
            // hello 握手标志（见 onBridgeHello 头注释）：到达前禁止一切
            // 按 stored 回推高度的路径，防默认值 debounce 回写覆盖用户
            // 保存的高度（真机实录：保存 300→收起→弹出回 272）。
            this.helloSeen = false;
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
            this.popupEndEvents = new WeakSet();
            this.touchOrigin = null;
            // 重叠双指（快速双手打字的常见窗口：B 落键时 A 还没抬）：
            // 每根手指自己的按下点。touchOrigin 是首指所有权，owner 抬起
            // 时凭这份记录把手势锚点移交给仍在场的手指，各自的起点各自
            // 算位移——否则第二指的上滑被当点按、长按弹层的位移被钉到
            // 首指位置上一动就出界「松手撤销」。
            this.pressById = new Map();
            this.swiping = false;
            this.voiceHold = false;
            // #39-13/#50 长按空格动作（默认 voice）：none=长按不触发+
            // 隐藏空格 mic 小标与工具栏麦克风；其余值为定制按键 tap DSL
            //（虚拟定制键，见 bindSpaceHold 的 runCustomCell 分发）。
            this.spaceHoldTap = 'voice';
            this.voiceSession = null;
            this.spaceHoldTimer = 0;
            // 手写板状态（issue #28）：笔迹（书写区局部 CSS px）、在途请求
            // 号、识别候选。仅 handwriting 模式使用；离开模式即清空。
            this.inkStrokes = [];
            this.inkCurrent = null;
            this.inkTouchId = null;
            this.inkOrigin = null;
            this.inkMoved = false;
            this.inkReqId = 0;
            this.inkStaleAfter = 0;
            this.inkCandidates = [];
            this.inkTimer = null;
            this.inkHoldTimer = null;
            // 手写让位态标记（#39-6 复发修复）：写字会话（笔迹进行中/
            // 已有笔迹/有候选）为 true——updateComposing 的收起键通用
            // 可见性行据此复核，防把让位翻回去。
            this.inkBarActive = false;
            // 书写区几何对账的缓存（inkSyncViewport）与停顿触发延时档位
            // （0=快 300ms / 1=标准 600ms / 2=慢 1200ms，hello 下发）。
            this._inkViewport = '';
            // 手写候选态的整行互斥位（setToolbarYield 的初值）。
            this.toolbarYield = false;
            // #48 定制宏串行链（codex 评审 P1×2）：双击定制键时第二条
            // 宏排队，不插进第一条的 300ms 台阶窗口（其首个键步会把
            // 第一条的文本掐死）；编辑器换代/键盘收起时整链作废——延迟
            // 键步不能发进新输入框（#34 手势会话同款代际语义）。台阶
            // 判据是「距最后一次文本步发送的时间窗」而非结构相邻：
            // 跨宏/跨点击的 text→key 相邻同样会掐死文本，几秒后的
            // 新点击则不垫冤枉台阶。
            this.customChainQueue = [];
            this.customChainActive = false;
            this.customChainLastTextAt = 0;
            this.customChainTimer = 0;
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
            // 上下滑方向互换（issue #29-2，默认关）：默认上滑=小字符（数字/
            // 符号/重音）、下滑=大写；互换后对调。真相源是 native pref
            // flick_swap，hello 下发。
            this.flickSwap = false;
            // Popup swipe selection range: 0=loose 1.4x, 1=standard 1.0x,
            // 2=tight 0.7x — scales the relative-tracking jitter dead zone
            // and the card-boundary cancel slop (selection itself stays
            // nearest-center).
            this.popupSnap = 1;
            // Bottom blank strip (CSS px) below the rows - native window
            // includes it; applyHeight/H budgets exclude it (mode-fallback §3).
            this.bottomPad = 0;
            // Candidate text scale: 80-150 continuous % (issue #42).
            this.candidateFont = 100;
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
            // 单手侧记忆（P2-3 native 化）：0=native 未记忆。
            this.oneHandSideMemory = 0;
            this.sideContent = 0;
            // 背景图亮/暗两组：各自独立，空串 = 该组无图（纯色背景）。
            this.bgImageLight = '';
            this.bgImageDark = '';
            // 键帽不透明度（0-100，默认 100=不透明）。
            this.keyOpacity = 100;
            // #39 横屏三项（默认=铺满+避让安全区、上限 60%、不透明）。
            this.landscapeSafeArea = true;
            this.safeSideL = 0;
            this.safeSideR = 0;
            this.landscapeOpacity = 100;
            // 按键气泡（issue #30-1，默认关）：真相源是 native pref
            // key_bubble，外观页开关经 hello 下发；开着才在按下时放大
            // 预览所按字符。
            this.keyBubble = false;
            this.bubbleLinger = 400;
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
            // 联想让位态退格清联想（issue #46）：hello 回读，默认关。
            this.backspaceAssocOn = false;
            // 万象 / 键功能引导（issue #45）：hello 回读，默认关。
            this.wxSlashOn = false;
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
            // 手写↔上次使用的键盘（round-5）里的「上次键盘」：跨会话也
            // 成立（adoptQuickPairForHandwriting 消费）。
            try { this.lastKbMode = localStorage.getItem('feelime_last_kb_mode') || ''; }
            catch (_) { this.lastKbMode = ''; }
            this.scrubBase = null;
            this.scrubSteps = 0;
            // #34 删除键手势四件套的会话态：delBase=null 表示跟手删未
            // 激活；bsVertical 是 backspace 垂直手势的方向锁定（0 无、
            // -1 上、1 下），松手才派发。
            this.delBase = null;
            this.delSteps = 0;
            this.delUnit = 0;
            this.delNet = 0;
            this.bsVertical = 0;
            this.expandCandidates = [];
            this.expandHasNext = false;
            this.loadingMore = false;
            // v3 触摸诊断（issue #13「键盘弹出后所有按键点不了」）：
            // rAF/timer 双通道心跳 + 触摸到达计数，经 Native.diagEvent 进
            // 原生诊断导出。判读矩阵——心跳行断=WebView 随窗口销毁/JS 死；
            // raf=0 而 timer 活=渲染管线停摆；native touchDown 有而本计数
            // 为 0=事件丢在 native→JS 边界；两边都 0=窗口层没收（对账
            // insets/焦点行）。只在真实桥存在时启动（预览 iframe 与 node
            // mock 环境没有 FeelimeNative/rAF，构造即跳过）；token 未握手
            // 前心跳同样跳过。
            this._diagTouch = 0;
            this._diagRafAt = 0;
            this._diagCallBlocked = 0;
            this._diagNoClick = { swipe: 0, pop: 0, long: 0 };
            // 键盘收起取证：触摸流被抢断时 JS 收到的是 touchcancel/
            // pointercancel（不是 end）。心跳带 cancel 计数，与 native
            // 侧 touchCancel 行（屏幕坐标+手势条距离）双通道对账。
            this._diagCancel = 0;
            if (window.FeelimeNative && typeof window.setInterval === 'function') {
                if (typeof requestAnimationFrame === 'function') {
                    const diagRafLoop = () => {
                        this._diagRafAt = Date.now();
                        requestAnimationFrame(diagRafLoop);
                    };
                    requestAnimationFrame(diagRafLoop);
                }
                window.addEventListener(
                    'pointerdown', () => { this._diagTouch += 1; },
                    { capture: true, passive: true });
                const onDiagCancel = () => { this._diagCancel += 1; };
                window.addEventListener('touchcancel', onDiagCancel, { capture: true, passive: true });
                window.addEventListener('pointercancel', onDiagCancel, { capture: true, passive: true });
                // rAF 探针盲区修正（codex 六期 review）：2600ms 窗口会被
                // 隐藏前的旧回调污染（弹出后首条心跳假 raf=1）——可见性
                // 恢复时清零时间戳，逼下一条心跳如实反映当前帧源状态。
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) this._diagRafAt = 0;
                });
                window.setInterval(() => {
                    if (!this.token || typeof Native.diagEvent !== 'function') return;
                    const rafAlive = Date.now() - this._diagRafAt < 2600;
                    // #12 复发取证：touch=触摸到达数；blocked=call 门闸
                    // 拒绝；noClick=swipe滑动手势/pop弹层/long长按各吞掉的
                    // 键数（touch>0 而 0 事件时，这三个计数指出触摸死在哪层）。
                    const pl = document.getElementById('preeditLine');
                    const ds = window.Feelime.debugState();
                    const err = window.__diagErr || '';
                    // 长按浮层取证（修 6 轮仍复发）：弹层/气泡/按压卡在
                    // 心跳里持续可见——悬挂现场导出即知「哪层开了多久、
                    // owner 是谁、还有几根手指被记在案」。pop=0 关闭；
                    // 1/key@finger/秒数；bub=按键气泡可见；press=未收
                    // 的按压键数（>0 且无活动触摸=触摸流被抢的指纹）。
                    const p = this.popup;
                    const bubEl = document.getElementById('keyBubble');
                    const popStr = !p ? '0' :
                        `1/${p.key || '?'}@${p.fingerId === undefined ? 'x' : p.fingerId}` +
                        `/${p.openedAt ? Math.round((Date.now() - p.openedAt) / 100) / 10 : '?'}s`;
                    Native.diagEvent(
                        `heartbeat raf=${rafAlive ? 1 : 0} touch=${this._diagTouch}` +
                        ` cancel=${this._diagCancel}` +
                        ` blocked=${this._diagCallBlocked}` +
                        ` noClick=${this._diagNoClick.swipe}/${this._diagNoClick.pop}/${this._diagNoClick.long}` +
                        ` pop=${popStr} bub=${bubEl && !bubEl.hidden ? 1 : 0} press=${this.pressedKeys.size}` +
                        ` states=${window.__diagStates || 0} preedit=${pl ? pl.textContent.length : -1}` +
                        ` vr=${ds.vr} warm=${ds.warm} comp=${ds.comp}` +
                        ` vis=${document.hidden ? 'h' : 'v'} rev=${window.__diagRev || 0}` +
                        (err ? ` err=${err}` : ''),
                        this.token);
                    this._diagTouch = 0;
                    this._diagCancel = 0;
                    this._diagCallBlocked = 0;
                    this._diagNoClick = { swipe: 0, pop: 0, long: 0 };
                    window.__diagStates = 0;
                }, 2500);
            }
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
            // PointerEvent 与 Touch 的编号不是同一个空间；按下时用目标和
            // 坐标关联，取消时才能只收所属手指，不误伤同键第二指。
            const pointers = new Map();
            document.addEventListener('pointerdown', event => {
                if (event.pointerType === 'touch') pointers.set(event.pointerId, {
                    target: event.target, x: event.clientX, y: event.clientY,
                });
            }, { capture: true, passive: true });
            document.addEventListener('touchstart', event => {
                for (const touch of event.changedTouches) {
                    const pointer = Array.from(pointers.values()).find(p =>
                        !p.touch && p.target === (touch.target || event.target)
                        && p.x === touch.clientX && p.y === touch.clientY);
                    if (pointer) pointer.touch = touch;
                }
            }, { capture: true, passive: true });
            const forgetPointers = event => {
                for (const [id, pointer] of pointers) {
                    if (pointer.touch && Array.from(event.changedTouches || []).some(
                        t => t.identifier === pointer.touch.identifier)) pointers.delete(id);
                }
            };
            document.addEventListener('touchend', event => {
                this.finishPopupTouch(event, false);
                // 页面先注销结束的手指；原键被替换时也不能留下可开层的记录。
                for (const touch of event.changedTouches) this.pressById.delete(touch.identifier);
                forgetPointers(event);
            }, { capture: true, passive: true });
            document.addEventListener('touchcancel', event => {
                this.cancelTouchEvent(event);
                forgetPointers(event);
            }, { capture: true, passive: true });
            document.addEventListener('pointerup', event => pointers.delete(event.pointerId),
                { capture: true, passive: true });
            document.addEventListener('pointercancel', event => {
                const pointer = pointers.get(event.pointerId);
                pointers.delete(event.pointerId);
                if (!pointer || !pointer.touch) return;
                const id = pointer.touch.identifier;
                this.cancelTouchEvent({ target: pointer.target,
                    changedTouches: [pointer.touch],
                    touches: Array.from(this.pressById.keys()).filter(key => key !== id)
                        .map(identifier => ({ identifier })),
                });
            }, { capture: true, passive: true });
            window.addEventListener('blur', () => pointers.clear());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) pointers.clear();
            });
            // 长按浮层不收起（#7）：系统级长按 ~500ms 触发 WebView 文本
            // 选择/callout 菜单，触摸流被直接终止（touchend/cancel 都不再
            // 发给 JS），弹层悬挂。键盘整页无任何需要右键菜单的场景，
            // 文档级拦掉；CSS touch-callout 双保险（keyboard.css body）。
            // 设置页同款防线 2940168（AVD 双通道取证：CDP 注入不复现、
            // input swipe/真手指复现）。
            document.addEventListener('contextmenu', event => {
                // 键盘内的合法可编辑目标（定制 JSON / 常用语 textarea）
                // 依赖系统长按菜单做粘贴——放行，只拦按键区（codex 评审
                // P2：整页一刀切会砍掉面板输入的粘贴通道）。
                const t = event.target;
                if (t && t.closest &&
                    t.closest('textarea, input, [contenteditable=""], [contenteditable="true"]')) {
                    return;
                }
                event.preventDefault();
            });
            translateStaticUi();
            this.renderMode();
            this.renderSymbols();
            document.querySelector('[data-action="letters"]').addEventListener('click', () => this.showLetters());
            this.renderSymbolCats();
            document.getElementById('setupButton').addEventListener('click', () => this.toggleSettingsPanel());
            // #39-6（手写容易退出，诊断定罪）：工具栏就在书写区正上方，
            // 书写划上去的笔迹若落笔抬笔都在按钮上（如齿轮），会合成
            // click 直达 openSetup——设置页顶掉键盘，用户看到的就是
            // 「写着写着退出」。候选条整行加「静止按压」判定：touchend
            // 时移动超阈值的触摸 preventDefault 掉 click 合成，书写划
            // 过/滑动翻候选页不再误触按钮；正常点按（<24px）不受影响。
            {
                const bar = document.getElementById('candidateBar');
                let barTouchStart = null;
                bar.addEventListener('touchstart', event => {
                    const t = event.changedTouches[0];
                    if (t) barTouchStart = { x: t.clientX, y: t.clientY };
                }, { capture: true, passive: true });
                bar.addEventListener('touchcancel', () => { barTouchStart = null; },
                    { capture: true, passive: true });
                bar.addEventListener('touchend', event => {
                    const start = barTouchStart;
                    barTouchStart = null;
                    if (!start) return;
                    const t = event.changedTouches[0];
                    if (t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 24) {
                        event.preventDefault();
                    }
                }, { capture: true });
            }
            // 完整设置入口（#33-1 后语义）：齿轮是工具栏目录里的可选
            // 工具（用户自选常驻），快开面板菜单里也有一份同名入口。
            const fullSetup = document.getElementById('fullSetupButton');
            if (fullSetup) {
                fullSetup.addEventListener('click', () => {
                    this.closeOtherViews();
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
            // 面板打开时工具栏整条隐藏，这两颗只在面板关闭态可点
            // （#39-4 定稿：面板头不再携带工具栏图标，切换交给 tab）。
            const clipBtn = document.getElementById('clipboardButton');
            if (clipBtn) clipBtn.addEventListener('click', () => this.openPanel('clipboard'));
            const favBtn = document.getElementById('favoritesButton');
            if (favBtn) favBtn.addEventListener('click', () => this.openPanel('favorites'));
            document.getElementById('panelClose').addEventListener('click', () => this.closePanel());
            document.getElementById('panelClear').addEventListener('click', () => {
                if (this.panelTab !== 'clipboard') return;
                // 清空是破坏性操作（#39 补充建议）：首击进入确认态（红字
                // 「确认清空」），3s 内再击才执行；超时或关面板恢复原样。
                if (this.panelClearTimer) {
                    this.armPanelClear(false);
                    this.call(() => Native.clearClipboard(this.token));
                } else {
                    this.armPanelClear(true);
                }
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
                    // 锚定键 = 打开菜单的那颗（round-4 起可能是任意触发
                    // 键）：这颗键上的点按只关菜单，不再触发它自己。
                    const toggle = this.modeMenuAnchor ||
                        document.getElementById('modeToggle');
                    const onToggle = toggle && event.target.closest &&
                        toggle.contains(event.target);
                    this.closeModeMenu();
                    if (onToggle) toggle._suppressClick = true;
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
                    // 自定义行缩放随视口宽度变（2026-10-04）：旋转/让位
                    // 后行宽变了要重拟合（幂等；非 custom 态查不到行，空转）。
                    document.querySelectorAll('.sym-custom-row')
                        .forEach(strip => this.fitCustomRow(strip));
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
                if (!document.hidden) {
                    this.applyHeight();
                    // 隐藏窗口里的 resize 产不出布局（fitCustomRow 量到
                    // clientWidth=0 静默跳过），恢复可见后重拟合定制行
                    // （review P3：否则行滞留自然字号、无人重渲）。
                    document.querySelectorAll('.sym-custom-row')
                        .forEach(strip => this.fitCustomRow(strip));
                }
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
                // 手写候选态/写字中的 × = 清笔迹+候选，工具栏恢复
                // （无组合可清）。写字中也成立——× 是让位态行内唯一
                // 出口（#39-6 复发修复）。
                if (this.mode === 'handwriting' &&
                    ((this.inkCandidates || []).length || (this.inkStrokes || []).length)) {
                    this.inkReset();
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
            // #12 复发取证：门闸拒绝计数（心跳捎带上报，诊断导出可见）。
            if (!this.ready || !this.token) { this._diagCallBlocked += 1; return; }
            // 透传桥返回值：#34 回滑恢复靠 backspaceRestoreOne 的同步
            // 回执决定是否推进 delNet（codex 评审 P1-1），无回执=undefined
            // 按成功处理（旧壳热更兼容）。
            return action(this.lastRevision);
        }

        /** 退格键帽统一出口（issue #46）：开关开启且处于联想让位态
         *  （无组合）时，退格等效 × ——清联想恢复工具栏、不动编辑框；
         *  其余情况照旧走原生删除（回执透传给 #34 回滑恢复）。 */
        backspaceAction() {
            if (this.backspaceAssocOn && this.assocWords.length && !this.composing) {
                this.assocWords = [];
                this.renderCandidates(this.lastEngineState || {});
                return true;
            }
            return this.call(() => Native.backspace(this.token));
        }

        isChineseMode() {
            return this.mode === 'pinyin' || this.mode === 'double-pinyin' ||
                this.mode === 't9' || this.mode === 'stroke';
        }

        /** #39-8：形码（flypy）的符号交互与拼音一致——上滑 CN_ALTS 全角
         * 符号、弹层/下滑 literal 直发（sendSymbol），否则符号会走 sendText
         * 进形码引擎当编码被静默吞掉（用户实测「上滑没有反应」）。但引擎
         * 语义仍是形码：isChineseMode 不收 flypy（第三行左键的分词/Shift
         * 选择、T9 弹层等以它为准，' 分词对形码引擎无语义）。 */
        chineseSymMode() {
            return this.isChineseMode() || this.mode === 'flypy';
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
            // 组合中改走两步流（enginePunct）：Android librime 的组合中
            // 标点路径吞键（§9.6）。
            if (key === '.' && this.chineseSymMode()) {
                this.enginePunct(',');
            } else {
                const text = this.applyCase(key);
                this.call(() => Native.key(text, this.token));
            }
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
            // #45 万象功能引导（/sj 时间 /ri 日期）：默认 '/' 直发上屏，
            // 绕过引擎——万象方案的 recognizer 收不到键，功能引导永远
            // 不触发。开关开启且在拼音/双拼（组合中或空闲）时，'/' 改走
            // 按键通道进 rime；形码/手写/英文等其它模式不受影响。
            if (text === '/' && this.wxSlashOn &&
                (this.mode === 'pinyin' || this.mode === 'double-pinyin')) {
                this.call(() => Native.key('/', this.token));
                if (this.shift) { this.shift = false; this.updateLabels(); }
                return;
            }
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
                // 离开手写：笔迹与候选只属于该模式（重进从空白开始）。
                if (this.mode !== 'handwriting') this.inkReset();
                // A mode switch can land while the symbol layer is open -
                // the grid and its badge must follow the new default.
                if (!document.getElementById('symbolLayer').hidden) {
                    this.renderSymbolCats();
                    this.renderSymbols();
                }
            }
            // 字母键盘布局（kbLayout pref，拼音/双拼/英文生效）：14 键
            // 把相邻字母贴合为宽键帽；音形/日文等专业模式维持 26 键。
            this.renderLetters(config.layout === 'qwerty'
                && MERGEABLE_14.has(this.mode) && this.kbLayout === '14'
                ? 'dp14' : config.layout);
            // 手写是唯一改键盘总高的模式：进出/旋转都把总高切回当前
            // 模式的值（进入=面板高度，离开=该方向已存高度）。
            this.applyModeHeight();
            this.closeOtherViews();
            // renderMode is invoked on every mode change INCLUDING the one a
            // degrade/recovery event carries; the badge must survive it.
            this.renderDegradeBadge();
        }

        renderLetters(layoutName) {
            if (layoutName === 'handwriting') {
                this.t9SymBar = false;
                if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
                return this.renderHandwriting();
            }
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
            // keyAltHint 需要知道当前键面（dp14 显示韵母小字而非符号）。
            this.lettersLayout = layoutName;
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
                // '|' 分组（dp14）：含 '|' 的键串按组切，两字母组渲染为
                // merge-pair 宽键帽内的两颗半区标准键。普通布局（qwerty
                // 等）不含 '|'，走原逐键路径——两字母整行也不会被误判。
                if (String(config.keys).includes('|')) {
                    String(config.keys).split('|').forEach(group => {
                        // 单字母组（L、M）：普通键，不进 pair。
                        if (group.length === 1) {
                            row.append(this.letterKey(group));
                            return;
                        }
                        // 14 键贴合（验收反馈三轮）：两颗半区标准键贴成
                        // 一颗宽键帽（中间分割线与每键字母/上滑小字由
                        // CSS 保留）；触摸判定保持半区（半区宽 ≥ 原
                        // 26 键键宽，且分界无歧义）。
                        const pair = document.createElement('div');
                        pair.className = 'merge-pair';
                        [...group].forEach(key => pair.append(this.letterKey(key)));
                        row.append(pair);
                    });
                } else {
                    [...config.keys].forEach(key => row.append(this.letterKey(key)));
                }
                if (config.backspace) row.append(this.specialKey('backspace', ICONS.backspace, () => this.backspaceAction(), 'kb-wide-1_4 kb-special', 'repeat'));
                layer.append(row);
            });
            // Bottom row:
            // [123] [punct] [space(+mic)] [中/英] [enter]; long-press the
            // toggle for the system IME picker (the old globe slot).
            const bottom = this.row();
            bottom.append(this.specialKey('symbols', '123', () => this.showSymbols(), 'kb-wide-2_1 kb-special', 'numpad'));
            bottom.append(this.letterKey('.'));
            // 26 键空格挂 data-key 借横滑光标 scrub 通道（手势层只认
            // .kb-key[data-key]，同 T9/手写空格）。值取 ' '：bubbleGlyph
            // 对空格本就免气泡（不会按下冒 "0"），垂直 flick 无字面语义
            // 由手势层的 spaceKey guard 让路。
            const space = this.spaceKey();
            space.dataset.key = ' ';
            bottom.append(space);
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
                () => this.backspaceAction(),
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

        /** 中文模式标点进引擎的统一入口（qwerty 标点槽 tap/上滑/长按
         * 与 stroke 8 键共用）：组合中走两步流——Android 构建的 librime
         * 组合中标点路径吞键（全拼 ni+',' 整体无声丢弃，真机实锤；host
         * gcc 构建正常，机制未明，见 keyboard.md §9.6），先按 id 确认池头
         * 候选，回声收掉组合后 commitText 直发全角标点；空闲态照旧发
         * ASCII 走引擎 punctuator 转全角。 */
        enginePunct(ascii) {
            const fullwidth = ascii === ',' ? '，' : '。';
            if (this.composing) {
                // 标点确认走重排后的池头：与空格/点击同一排序（codex P1：
                // 候选条看英文、逗号却确认中文）。
                const candidate = this.englishOrderedPool(this.expandCandidates || []).find(item =>
                    !String(item.id).startsWith('alt:'));
                if (candidate) {
                    this.pendingPunct = { text: fullwidth, raw: this.lastRawInput, at: Date.now() };
                    this.choosePoolCandidate(candidate);
                    return;
                }
            }
            this.sendText(ascii);
        }

        /** 笔画键的统一激活入口（点按与长按中格共用——codex 评审 P1：
         * closePopup 的引擎通道原先直发 send 绕过了这里的两个守卫）。
         * 6 键=单通配（码表只派生单 * 行，第二个拦截：回显含 * 或上一
         * 个 * 还在途）；8 键=标点（enginePunct：组合中两步流，空闲走
         * punctuator）。 */
        strokeActivate(digit) {
            const def = STROKE_KEYS[digit];
            if (!def) return;
            if (digit === '6' && this.composing &&
                ((this.lastRawInput || '').includes('*') || this.wildcardInFlight)) {
                this.showToast(t("通配符只能用一个"));
                return;
            }
            if (digit === '8') {
                this.enginePunct(',');
                return;
            }
            if (digit === '6') this.wildcardInFlight = true;
            this.call(() => Native.key(def.code, this.token));
        }

        /* ===== 手写键面（issue #28，design/handwriting.md）：大块书写区
         * canvas + 底部控制行（退格/空格/中英/回车）。识别走独立桥
         * （recognizeInk → onInkCandidates），不进按键引擎；本节事件
         * 一律 stopPropagation——根级 setupFlick 只认 bindTouch 记下的
         * touchOrigin，书写区不挂 bindTouch 即天然不进 flick/scrub 仲裁。
         * 书写区是 flex 唯一的弹性块，控制行高固定（.ink-controls 的
         * --ink-row-h，不吃 --kb-row-h 预算）：applyHeight 在视图被瞬时
         * 量高时烘焙出的陈旧行变量再也压不塌书写区（重唤折叠 P1 的
         * 根因通道被结构性拆除）。 */

        renderHandwriting() {
            const layer = document.getElementById('qwertyLayer');
            layer.replaceChildren();
            const layout = document.createElement('div');
            layout.className = 'ink-layout';
            // 控制行高单一来源（CSS 只消费这个变量）。
            layout.style.setProperty('--ink-row-h', INK_CONTROL_ROW_H + 'px');
            const pad = document.createElement('div');
            pad.className = 'ink-pad';
            pad.id = 'inkPad';
            const canvas = document.createElement('canvas');
            canvas.id = 'inkCanvas';
            canvas.className = 'ink-canvas';
            const hint = document.createElement('span');
            hint.className = 'ink-hint';
            hint.id = 'inkHint';
            INK_HINT_LINES.forEach(line => {
                const row = document.createElement('span');
                row.className = 'ink-hint-line';
                row.textContent = t(line);
                hint.append(row);
            });
            pad.append(canvas, hint);
            this.bindInkPad(pad);
            if (this.landscape) {
                // 横屏（§9.1）：native 钳半屏、纵向没有底行的余量——
                // 右窄列并成两列四行，键盘切换键不占格（中英键留守，
                // 长按=同一模式菜单通道，见 inkSideKeys）。
                const rail = document.createElement('div');
                rail.className = 'ink-rail';
                rail.append(...this.inkSideKeys(true), ...this.inkBottomKeys(false));
                layout.append(pad, rail);
            } else {
                // 竖屏（wetype round-4）：书写面板是主区，右侧窄列
                // 退格+，。！？（round-5），底行 符号/数字/空格/快捷切换/换行。
                const side = document.createElement('div');
                side.className = 'ink-side';
                side.append(...this.inkSideKeys());
                const main = document.createElement('div');
                main.className = 'ink-main';
                main.append(pad, side);
                const bottom = document.createElement('div');
                bottom.className = 'ink-bottom';
                bottom.append(...this.inkBottomKeys());
                layout.append(main, bottom);
            }
            layer.append(layout);
            this.updateLabels();
            // 旋转/换模式后按当前几何重建画布分辨率并重放既有笔迹。
            this.inkResize();
            // 手写是唯一改变键盘总高的模式：进入/旋转重渲染时按当前
            // 宽度推面板高度（离开模式由 renderMode → applyModeHeight
            // 还原用户高度）。
            this.applyModeHeight();
        }

        /** 右窄列（round-6，用户拍板）：竖屏 = ⌫（固定 1 格）+ 滚动
         * 符号列（视口 3 格高，上滑滚出更多、点按直上屏——T9/数字面板
         * 左列同款形态，不再是手势弹层）。横屏 rail 保持 2×4 定稿：
         * ⌫ + 中英键 + 两颗纯点按符号键（横屏空间紧，不滚）。 */
        inkSideKeys(landscape = false) {
            const keys = [this.inkBackspaceKey()];
            if (landscape) {
                keys.push(this.inkSymbolKey('，'), this.cnEnKey(), this.inkSymbolKey('。'));
            } else {
                keys.push(this.inkSymbolScroller());
            }
            return keys;
        }

        /** 滚动符号列：常驻滚动列表，初始露前三格，上滑滚出更多。
         * 滚动走 CSS overflow（触摸原生滚动），点按=sendSymbol 直上屏。 */
        inkSymbolScroller() {
            const scroller = document.createElement('div');
            scroller.className = 'ink-scroll';
            INK_SIDE_SYMBOLS.forEach(char => scroller.append(this.inkSymbolCell(char)));
            return scroller;
        }

        /** 滚动列里的单个符号格。 */
        inkSymbolCell(char) {
            const button = document.createElement('button');
            button.className = 'kb-key kb-special ink-key ink-sym';
            button.dataset.role = 'ink-sym';
            button.textContent = char;
            button.setAttribute('aria-label', char);
            // 触感放在 click：touchstart 分不清点按和拖动滚列的起点，
            // 拖列不该震（与 .t9-side-cell 同口径）。
            button.addEventListener('click', () => {
                this.nativeKeyFeedback();
                this.sendSymbol(char);
            });
            return button;
        }

        /** 横屏 rail 的纯点按符号键（无手势）。 */
        inkSymbolKey(char) {
            return this.inkSymbolCell(char);
        }

        /** 退格（round-4 反馈）：书写区有笔迹时=清笔迹+候选回工具栏
         * （inkReset，与 × / 长按清空同一出口），不删编辑框字符；无
         * 笔迹时照旧走原生删除。语义锚在**手势起点**：长按连发把笔迹
         * 清掉之后，同一次按住的后续 click（repeat 的 setInterval 与
         * 松手补的那次）都不得转成删除——所以按下时先记状态，清笔迹
         * 那一次同时把连发收走。 */
        inkBackspaceKey() {
            const button = this.specialKey('backspace', ICONS.backspace,
                () => this.inkBackspace(button), 'ink-key kb-special', 'repeat');
            button.addEventListener('touchstart', () => {
                button._inkHadStrokes = this.inkStrokes.length > 0 ||
                    (this.inkCurrent || []).length > 0;
            });
            return button;
        }

        inkBackspace(button) {
            if (button._inkHadStrokes) {
                this.inkReset();
                if (button._cancelRepeat) button._cancelRepeat();
                return;
            }
            this.backspaceAction();
        }

        /** 底行：符号（符号面板）/ 123（九宫格）/ 空格（候选条有手写
         * 候选时=确认 top1，见 spaceKey）/ 快捷切换（=其他键盘底行的
         * 中英切换键同款：短按翻 quick-pair、长按=完整模式菜单，见
         * cnEnKey）/ 换行。横屏不设切换格（includeMode=false）：八键恰
         * 两列四行。 */
        inkBottomKeys(includeMode = true) {
            const keys = [
                this.specialKey('ink-symbols', t("符号"),
                    () => this.showSymbols(), 'ink-key kb-special'),
                this.specialKey('ink-numpad', '123',
                    () => this.showNumpad(), 'ink-key kb-special'),
                this.inkSpaceKey(),
            ];
            if (includeMode) keys.push(this.cnEnKey());
            keys.push(this.enterKey());
            return keys;
        }

        /** 手写空格：= spaceKey（top1 确认 / mic 长按）+ data-key 借
         * T9 空格的横滑 scrub 通道（.kb-key[data-key] 手势层认它）。
         * 垂直方向没有字面语义（setupFlick 让路），上滑留给 bindSpaceHold
         * 的语音长按/撤销。 */
        inkSpaceKey() {
            const space = this.spaceKey();
            space.dataset.key = '0';
            return space;
        }

        /** 抽出条/弹层的选中：指针压在哪格选哪格（格子不重叠、不透明，
         * rect 命中与 elementFromPoint 等价，且在 mock 的合成几何下同样
         * 可测），离开条=取消选中——不弹「松手撤销」，没选过谈不上
         * 撤销；松手无选中=无输入。 */
        moveInkPopup(touch) {
            if (!this.popup) return;
            const cell = this.popup.cells.find(cell => {
                const rect = cell.item.getBoundingClientRect();
                return touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom;
            }) || null;
            this.popup.selected = cell;
            this.popup.cells.forEach(item =>
                item.item.classList.toggle('sel', item === this.popup.selected));
        }

        /** 手写模式的高度预算（竖屏）：面板宽高比钉在 1.6:1（wetype
         * 实测 984×590 口径），键盘总高 = 顶部 chrome + 控制行 + 面板。
         * 横屏不改总高（native 钳半屏，预算本就见底，面板改左右布局
         * 竖向铺满——见 .ink-layout 的横屏分支）。 */
        inkPanelTarget() {
            const width = Math.max(0, (window.innerWidth || 0) - 8);
            return Math.round(width / 1.6);
        }

        /** 手写键面的固定纵向开销：拼音带 + 候选条槽 + 控制行 + 底部
         * 留白（与 .ink-layout/.ink-controls/#candidateBar 的 CSS 常量
         * 一一对应；漏掉任何一段面板就会比目标矮）。 */
        inkChromeHeight() {
            const band = 18 + (this.preeditFont === 2 ? 11 : this.preeditFont === 1 ? 8 : 4);
            const bar = 2 + 40 + 10;
            const row = INK_CONTROL_ROW_H + 5;
            return band + bar + row + 5;
        }

        /** 手写模式期望的内容高度（竖屏），钳进 native 的高度上下限。 */
        inkDesiredHeight() {
            const min = this.inkChromeHeight() + 96;
            const bounds = this.heightBounds();
            const panel = this.inkPanelTarget() + this.inkChromeHeight();
            return Math.round(Math.min(bounds.max, Math.max(min, panel)));
        }

        /** 把键盘总高切到当前模式应有的值。高度体系统一（五轮反馈 5，
         * 用户拍板「统一到矮的」）：所有模式含手写一律用 stored（未调过
         * = native 默认 272），手写仅保内容下限（chrome+最小面板，防弹性
         * 面板被压塌——P1 的教训）。切换键盘不再跳高度。幂等：值相同不
         * 发桥。重唤键盘（resetToHome / applyHeightNow）也走这里——这是
         * 重唤后布局没跟手写态走的 P1 修复的另一半。 */
        applyModeHeight() {
            // 高度编辑中卡片独占高度：拖动/步进的预览值不被 stored 的
            // 重推覆盖。拖动时每次 applyKbHeight 都会触发 native
            // requestLayout → on-show 钩子 → applyHeightNow——不设防，
            // stored 旧值和拖动值每帧打架（用户看到的「抖来抖去」）。
            const card = document.getElementById('heightCard');
            if (card && card.classList.contains('open')) return;
            // hello 未达（页面加载竞态/重唤极早期）：stored 读到 0 会按
            // 默认值回推并写回 pref（见 onBridgeHello 的 helloSeen 注释）。
            if (!this.helloSeen) return;
            const stored = this.storedKbHeight();
            const base = stored > 0 ? stored : (this.heightDefaultCss || 272);
            if (this.landscape || this.mode !== 'handwriting') {
                if (this.kbHeight !== base) this.applyKbHeightLocal(base);
                return;
            }
            // 抬升判定不能只比 JS 曾请求过的值（codex 二轮 P2-6）：收起
            // 期间设置页把 native 高度改低于手写下限时，kbHeight 旧值仍
            // 等于 desired → 永不发桥 → 面板可写高度不足。以「JS 认知与
            // native 权威值取大」为基准，任一低于下限就重推。
            const desired = Math.max(base, this.inkChromeHeight() + 96);
            const authoritative = Math.max(this.kbHeight, base);
            if (authoritative !== desired) this.applyKbHeight(desired);
        }

        /** 「按权威值对齐本地布局」专用：不发高度桥、不写 pref。
         *  stored 路径的回推是 native→hello→JS→native 的回声——native 的
         *  view 高度本来就是它自己按 pref 量的，JS 再教一遍除了制造
         *  debounce 回写覆盖（滑杆值被冲掉的 round-8 同族）没有任何收益。
         *  用户显式编辑（applyKbHeight）与手写下限抬升仍走发桥版本。 */
        applyKbHeightLocal(content) {
            this.kbHeight = Math.round(Number(content) || 0);
            this.applyHeight();
        }

        /** 书写区手势：一笔一采样（首触点起笔，move 追点，end 收笔）。
         * 停笔触发识别的延时走设置档（默认 600ms）；收笔后再落新笔会先
         * 撤未决请求（reqId 失配，迟到结果被丢弃）；长按原地把笔迹清空。 */
        bindInkPad(pad) {
            const INK_HOLD_SLOP = 6;
            const INK_MIN_POINT_GAP = 2;
            const at = touch => {
                const rect = pad.getBoundingClientRect
                    ? pad.getBoundingClientRect()
                    : { left: 0, top: 0 };
                return {
                    x: touch.clientX - (rect.left || 0),
                    y: touch.clientY - (rect.top || 0),
                };
            };
            pad.addEventListener('touchstart', event => {
                event.preventDefault();
                event.stopPropagation();
                // 第二根手指不开启新笔迹（只跟一笔）。
                if (this.inkTouchId !== null) return;
                const touch = event.changedTouches[0];
                this.inkTouchId = touch.identifier;
                this.inkOrigin = at(touch);
                this.inkMoved = false;
                this.inkCurrent = [this.inkOrigin];
                // 书写中撤未决识别：下一笔是新的字形，迟到候选会误导。
                // 已在途的识别结果记 staleAfter 作废（不动 reqId 计数
                // 语义——它锚定「每次请求 +1」），已显示的旧候选撤下：
                // 写字期间行内只剩「手写」标识与 ×，旧候选词不再可点
                // （短笔画窜上去误触旧词=误上屏）。
                this.inkStaleAfter = this.inkReqId;
                if ((this.inkCandidates || []).length) {
                    this.inkCandidates = [];
                    this.renderCandidates(this.lastEngineState || {});
                }
                // 落笔即让位（#39-6 复发修复）：不等识别回来，写字全程
                // 工具栏整行让位、收起键隐藏，短笔画无按钮可触发。
                this.applyInkBarChrome();
                clearTimeout(this.inkTimer);
                this.inkTimer = null;
                clearTimeout(this.inkHoldTimer);
                this.inkHoldTimer = setTimeout(() => {
                    this.inkHoldTimer = null;
                    if (!this.inkMoved) {
                        this.inkTouchId = null;
                        this.inkCurrent = null;
                        this.inkReset();
                        this.showToast(t("已清空笔迹"));
                    }
                }, this.holdMs);
                this.inkPaint();
            }, { passive: false });
            pad.addEventListener('touchmove', event => {
                event.preventDefault();
                event.stopPropagation();
                if (this.inkTouchId === null) return;
                const touch = Array.from(event.changedTouches).find(
                    item => item.identifier === this.inkTouchId);
                if (!touch) return;
                const point = at(touch);
                if (!this.inkMoved) {
                    if (Math.hypot(point.x - this.inkOrigin.x,
                        point.y - this.inkOrigin.y) < INK_HOLD_SLOP) return;
                    this.inkMoved = true;
                    clearTimeout(this.inkHoldTimer);
                    this.inkHoldTimer = null;
                }
                const stroke = this.inkCurrent || [];
                const last = stroke[stroke.length - 1];
                // 采点瘦身：贴得比 2px 更近的点不进 payload（桥 payload
                // 有 4096 字符上限，60Hz 原始采样会顶穿）。
                if (last && Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_POINT_GAP) return;
                stroke.push(point);
                this.inkCurrent = stroke;
                this.inkPaint();
            }, { passive: false });
            // 收笔与中断分 注册：中断（来电/手势抢断）的残笔不成字。
            const release = event => {
                const touch = event.changedTouches && Array.from(event.changedTouches).find(
                    item => item.identifier === this.inkTouchId);
                if (!touch) return null;
                this.inkTouchId = null;
                clearTimeout(this.inkHoldTimer);
                this.inkHoldTimer = null;
                return this.inkCurrent;
            };
            pad.addEventListener('touchend', event => {
                const stroke = release(event);
                if (stroke === null) return;
                if (stroke && stroke.length) this.inkStrokes.push(stroke);
                this.inkCurrent = null;
                this.inkPaint();
                if (this.inkStrokes.length) {
                    // 实时识别：落笔结束即识别（无停顿窗口）。
                    this.inkRecognize();
                }
            }, { passive: false });
            pad.addEventListener('touchcancel', event => {
                const stroke = release(event);
                if (stroke === null) return;
                // 键盘收起取证：真机录屏 13s 内收起 3 次、两次紧跟长
                // 笔画——cancel 即触摸流被系统（导航手势条一类）抢走的
                // 现场信号。上报诊断与 native touchCancel 行对照（坐标
                // 为 pad 内 CSS px，native 侧另有屏幕坐标与三边距离）。
                if (this.token && window.FeelimeNative && typeof Native.diagEvent === 'function') {
                    const last = stroke && stroke.length ? stroke[stroke.length - 1] : null;
                    Native.diagEvent(
                        `inkCancel pts=${stroke ? stroke.length : 0}` +
                        (last ? ` x=${Math.round(last.x)} y=${Math.round(last.y)}` : ''),
                        this.token);
                }
                // 残笔丢弃：不完整的一笔不进识别，也不撤销未决请求。
                this.inkCurrent = null;
                this.inkPaint();
                // 中断后若既无笔迹也无候选，对账恢复工具栏（让位只跟
                // 书写会话走，#39-6 复发修复）。
                this.applyInkBarChrome();
            }, { passive: false });
        }

        /** 画布分辨率跟 CSS 盒走（devicePixelRatio 保清晰）；无 2d 环境
         * （mock/预览降级）只记尺寸不画。 */
        inkResize() {
            const canvas = document.getElementById('inkCanvas');
            if (!canvas) return;
            this.inkSymFont();
            const rect = typeof canvas.getBoundingClientRect === 'function'
                ? canvas.getBoundingClientRect() : null;
            const width = Math.max(1, Math.round((rect && rect.width) || 320));
            const height = Math.max(1, Math.round((rect && rect.height) || 132));
            const ratio = typeof window !== 'undefined' &&
                typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
                ? window.devicePixelRatio : 1;
            if (canvas.width === width * ratio && canvas.height === height * ratio) return;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            this.inkPaint();
        }

        /** 符号列字号跟格高（视口剥缝三等分）：格高随键盘总高变化，
         * 写死字号在矮高度下裁字。inkResize 每次几何变化都先跑这里，
         * 画布早退不影响字号对账。mock/jsdom 无布局（rect=0）跳过，
         * CSS 落回 22px 缺省。 */
        inkSymFont() {
            const scroll = document.querySelector('.ink-scroll');
            if (!scroll || typeof scroll.getBoundingClientRect !== 'function') return;
            const vh = scroll.getBoundingClientRect().height;
            if (!(vh > 0)) return;
            const cellH = (vh - 10) / 3; // 2 条格缝（gap 5px）
            const size = Math.max(12, Math.min(22, Math.round(cellH * 0.5)));
            scroll.style.setProperty('--ink-sym-size', size + 'px');
        }

        inkContext() {
            const canvas = document.getElementById('inkCanvas');
            if (!canvas || typeof canvas.getContext !== 'function') return null;
            try {
                return canvas.getContext('2d');
            } catch (_) {
                return null;
            }
        }

        /** 重放笔迹（局部 CSS px → 画布像素按缩放比映射）。 */
        inkPaint() {
            const pad = document.getElementById('inkPad');
            if (pad) pad.classList.toggle('writing',
                this.inkStrokes.length > 0 || (this.inkCurrent || []).length > 0);
            const context = this.inkContext();
            if (!context || typeof context.scale !== 'function') return;
            const canvas = document.getElementById('inkCanvas');
            const ratio = canvas.width && canvas.clientWidth
                ? canvas.width / canvas.clientWidth : 1;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.lineWidth = 3.2 * ratio;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = this.inkColor();
            context.beginPath();
            const all = this.inkCurrent && this.inkCurrent.length
                ? this.inkStrokes.concat([this.inkCurrent])
                : this.inkStrokes;
            all.forEach(stroke => {
                stroke.forEach((point, index) => {
                    const x = point.x * ratio;
                    const y = point.y * ratio;
                    if (index === 0) context.moveTo(x, y);
                    else context.lineTo(x, y);
                });
            });
            context.stroke();
        }

        /** 墨色跟主题 token 走（§1.1）；取不到 var（mock/降级）用中性灰。 */
        inkColor() {
            if (typeof getComputedStyle !== 'function') return '#888';
            const styles = getComputedStyle(document.documentElement);
            const value = styles && styles.getPropertyValue &&
                styles.getPropertyValue('--text');
            return (value && value.trim()) || '#888';
        }

        inkSchedule(delay) {
            clearTimeout(this.inkTimer);
            this.inkTimer = setTimeout(() => {
                this.inkTimer = null;
                this.inkRecognize();
            }, delay);
        }

        /** 发送识别请求（design §2/§3）：w/h 承载书写区 CSS 尺寸，坐标
         * 保留原始比例（归一在 native 侧做）；发送前对每笔做平滑去抖
         * （smoothInkStroke，只影响这条 payload）。旧 APK 无此桥方法时
         * 静默跳过（§5.4 feature-detect）。 */
        inkRecognize() {
            if (!this.inkStrokes.length) return;
            if (typeof Native.recognizeInk !== 'function') return;
            const canvas = document.getElementById('inkCanvas');
            const rect = canvas && typeof canvas.getBoundingClientRect === 'function'
                ? canvas.getBoundingClientRect() : { width: 320, height: 132 };
            const round1 = value => Math.round(value * 10) / 10;
            const payload = JSON.stringify({
                w: Math.round(rect.width || 320),
                h: Math.round(rect.height || 132),
                strokes: this.inkStrokes.map(stroke =>
                    smoothInkStroke(stroke).map(point => [round1(point.x), round1(point.y)])),
            });
            this.inkReqId += 1;
            this.call(() => Native.recognizeInk(this.inkReqId, payload, this.token));
        }

        /** 清笔迹与候选（点选上屏 / 长按清空 / 离开模式共用）。 */
        inkReset() {
            this.inkStrokes = [];
            this.inkCurrent = null;
            this.inkCandidates = [];
            clearTimeout(this.inkTimer);
            this.inkTimer = null;
            this.inkPaint();
            if (this.mode === 'handwriting') this.renderCandidates(this.lastEngineState || {});
            else {
                // 离开模式：互斥态就地拆除（标识收起、工具栏复位），
                // 新键面的可见性由各自流程接手。
                const tag = document.getElementById('inkTag');
                if (tag) tag.hidden = true;
                this.setToolbarYield(false);
                this.inkBarActive = false;
            }
        }

        /** 键盘收起/失焦的触摸卫生（§10.6）：撤长按计时、丢弃进行中的笔。 */
        inkCancelTouch() {
            this.inkTouchId = null;
            this.inkCurrent = null;
            clearTimeout(this.inkHoldTimer);
            this.inkHoldTimer = null;
        }

        /** 手写候选态（wetype 形态，issue #28 round-2）：有识别候选=工具
         * 栏整行让位（含 mic，仅留 ×），「手写」标识 + 候选横排占满整行；
         * 无候选/清空后=工具栏原样。语音进行中不让位——mic 是 stop 入口
         * 必须存活（与联想让位的守卫同一口径）。round-3：点选上屏后的
         * 联想词同一条 bar 接手，让位语义与拼音态一致（× 由 composeClear
         * 的联想分支恢复），但「手写」标识只跟识别候选走。
         * #39-6 后续（复发）：让位提前到落笔——写字全程（笔迹进行中/
         * 已有笔迹/有候选）整行让位。原实现等「候选回来」才让位，写字
         * 与识别在途的窗口里按钮全在，短笔画（点/顿笔，位移小、约 0.1s
         * 抬笔）与正常点按不可分，起笔稍高即误触（24px 守卫天然漏过）。
         * 收起键一并隐藏（用户裁定：写字中行内只留标识与 ×；收键盘走
         * 系统返回键/点输入框外）。 */
        applyInkBarChrome() {
            const active = this.mode === 'handwriting' &&
                ((this.inkCandidates || []).length > 0 ||
                 (this.inkStrokes || []).length > 0 ||
                 this.inkTouchId !== null);
            this.inkBarActive = active;
            const assocOnly = this.mode === 'handwriting' && !active &&
                (this.assocWords || []).length > 0;
            const tag = document.getElementById('inkTag');
            if (tag) tag.hidden = !active;
            if (this.voiceState === 'idle') {
                this.setToolbarYield(active || assocOnly);
                // mic 虽在让位清单里，但 updateComposing 的通用可见性行
                // （非组合=可见）先于本调用执行，这里显式压回。收起键双
                // 向显式设置（恢复路径不经 updateComposing 时也得翻回）
                // ——联想让位（assocOnly）不藏收起键，与拼音联想同口径。
                if (active) {
                    const mic = document.getElementById('mic');
                    if (mic) mic.hidden = true;
                }
                const hideBtn = document.getElementById('hide');
                if (hideBtn) hideBtn.hidden = active;
            }
            return active;
        }

        /** 点选候选：commitText 直上屏并清笔迹（design §2 数据流）。
         * 清笔迹同时撤掉互斥态 → 工具栏恢复（wetype 同款：上屏后回
         * 工具栏，继续写再进候选态）。 */
        commitInkCandidate(candidate) {
            // 上屏走 commitAssoc 通道（联想通道）：中文联想开时以该字为
            // 前词推后继联想（开关语义在 native readAssociation 统一判
            // 断，对手写与拼音一致）；旧桥缺该方法时退回直发。
            if (typeof Native.commitAssoc === 'function') {
                this.call(() => Native.commitAssoc(candidate.text, this.token));
            } else {
                this.sendSymbol(candidate.text);
            }
            this.inkReset();
        }

        /** 识别结果（design §3）：reqId 与最新请求不符即丢弃；错误提示
         * 但不阻塞书写；成功则整条刷新候选（复用候选条 DOM）。 */
        onInkCandidates(payload) {
            if (this.mode !== 'handwriting') return;
            const reqId = Number(payload && payload.reqId);
            // 落笔即作废在途结果（inkStaleAfter）：旧字形的迟到候选不得
            // 在新笔画进行中复活（#39-6 复发修复配套）。
            if (reqId !== this.inkReqId || reqId <= (this.inkStaleAfter || 0)) return;
            const error = payload && payload.error;
            if (error === 'unavailable') {
                this.showToast(t("手写模型未就绪"));
                return;
            }
            if (error) {
                this.showToast(t("手写识别失败"));
                return;
            }
            const candidates = Array.isArray(payload.candidates)
                ? payload.candidates.filter(item => item && item.text)
                    .map(item => ({ id: `ink:${item.text}`, text: item.text }))
                : [];
            // 手写候选与联想词互斥：新识别到达即让上屏后的联想词退场。
            this.assocWords = [];
            this.inkCandidates = candidates;
            this.renderCandidates(this.lastEngineState || {});
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

        /** 手写接入 quick-pair（round-5）：非手写模式记下「上次使用的
         * 键盘」；进手写时若配对还是出厂默认（拼/En，用户从未定制过），
         * 迁成 手写↔该键盘——切换键在两个方向都立即可用（拼 ⇄ 手）。
         * 定制过的对不动（含用户特意选回 拼/En 的情形），改对走
         * 模式菜单/设置页的 快捷切换 入口。 */
        adoptQuickPairForHandwriting(nextMode) {
            if (nextMode !== 'handwriting') {
                this.lastKbMode = nextMode;
                try { localStorage.setItem('feelime_last_kb_mode', nextMode); } catch (_) {}
                return;
            }
            // 「用户从未定制过」以持久值为准：内存对可能滞后（备份恢复刚
            // 写 storage、hello 尾部才同步内存），单看内存会把刚恢复的定制
            // 对误迁成 手写↔X。
            let savedPair = null;
            try { savedPair = JSON.parse(localStorage.getItem('feelime_quick_pair') || 'null'); } catch (_) { /* unset */ }
            const current = (Array.isArray(savedPair) && savedPair.length === 2) ? savedPair : this.quickPair;
            const factory = current.length === 2 &&
                current[0] === 'pinyin' && current[1] === 'direct';
            if (!factory) return;
            const other = this.lastKbMode && this.lastKbMode !== 'handwriting' &&
                MODES[this.lastKbMode] ? this.lastKbMode : 'pinyin';
            this.quickPair = ['handwriting', other];
            try {
                localStorage.setItem('feelime_quick_pair', JSON.stringify(this.quickPair));
            } catch (_) {}
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
            // 原生拒绝，切换键看起来坏了）。strictReady 与 engine 标志
            // 解耦：手写（engine:false）同样按就绪位挡。
            const targetConfig = MODES[target];
            if (targetConfig && targetConfig.strictReady &&
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
            // 长按空格：右上角圆点标识可长按（#50 起动作可自定义，
            // 圆点语义泛化为「可长按」；mic 小标只在语音动作画）。
            if (this.spaceHoldTap !== 'none') button.dataset.lp = 'space-hold';
            button.setAttribute('aria-label', t("空格"));
            if (this.spaceHoldTap === 'voice') {
                const mic = document.createElementNS(SVG_NS, 'svg');
                mic.setAttribute('viewBox', '0 0 24 24');
                mic.setAttribute('class', 'space-mic');
                mic.setAttribute('aria-hidden', 'true');
                const path = document.createElementNS(SVG_NS, 'path');
                path.setAttribute('d', ICON_PATHS.mic);
                path.setAttribute('fill', 'currentColor');
                mic.append(path);
                button.append(mic);
            }
            button.addEventListener('click', () => {
                // 手写候选在条上时，空格=确认 top1 上屏（issue #28
                // round-3）：走点选同一通道 commitInkCandidate，联想联动
                // 与清笔迹行为完全一致；无候选时空格照旧。
                if (this.mode === 'handwriting' && (this.inkCandidates || []).length) {
                    this.commitInkCandidate(this.inkCandidates[0]);
                    return;
                }
                // While composing, space must confirm the TOP
                // candidate. Native space confirms the highlight, which sits
                // on whatever page the bar/grid preloading dragged the cursor
                // to (nihao + preload -> space committed a page-3 word).
                // Choosing the pool head by id decouples it from paging.
                const ordered = this.englishOrderedPool(this.expandCandidates || []);
                const candidate = ordered.find(item =>
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
            // #50：面板类长按已消费手势——松手不再补发空格点击。
            let holdConsumed = false;
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
                holdConsumed = false;
                if (!this.ready || !this.token || this.spaceHoldTap === 'none') return;
                this.spaceHoldTimer = setTimeout(() => {
                    // #50 长按空格=虚拟定制键（用户裁定）：语音走原浮层流
                    // （松手收尾），其余动作与定制按键完全同通道——
                    // runCustomCell 的 parse+队列串行+错误 toast 全复用；
                    // 松手不补发空格（手势已消费）。
                    const act = this.spaceHoldTap;
                    if (act === 'voice') {
                        this.voiceHold = true;
                        this.voiceSession = 'space-hold';
                        Native.startVoice(this.token);
                    } else {
                        holdConsumed = true;
                        this.runCustomCell({ tap: act });
                    }
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
                } else if (!cancelled && !holdConsumed) {
                    // touchstart preventDefault suppresses synthetic clicks,
                    // so the tap must be delivered manually. T9 的 mic 有
                    // data-key：横滑 scrub 已被手势层消费，松手不再补发
                    // 空格（swiping 的复位是 setTimeout(0)，此处仍为 true）。
                    // #50 面板类长按已消费手势，不再补发空格。
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

        /** 按键气泡取字（issue #30-1）：qwerty 字母读键面主标（随
         *  shift/大小写更新），其余按 data-key 直取（符号格/九宫格数字）；
         *  空格与功能键（无 data-key 无主标）不出气泡；中文态逗/句号
         *  沿用弹层的全角显示映射。 */
        bubbleGlyph(button) {
            const main = button.querySelector('.kb-main');
            if (main && main.textContent) return main.textContent;
            const key = button.dataset.key;
            if (!key || key === ' ') return null;
            if (this.isChineseMode() && (key === ',' || key === '.')) {
                return key === ',' ? '，' : '。';
            }
            return key.length <= 2 ? key : null;
        }

        showKeyBubble(button) {
            const glyph = this.bubbleGlyph(button);
            if (!glyph) return;
            const bubble = document.getElementById('keyBubble');
            if (!bubble) return;
            this.bubbleButton = button;
            bubble.textContent = glyph;
            bubble.hidden = false;
            const rect = button.getBoundingClientRect();
            // 与 openPopup 同一套钳制：水平贴边收拢，垂直不越出视口顶。
            const left = Math.max(4, Math.min(innerWidth - bubble.offsetWidth - 4,
                rect.left + rect.width / 2 - bubble.offsetWidth / 2));
            bubble.style.left = left + 'px';
            bubble.style.top = Math.max(2, rect.top - bubble.offsetHeight - 6) + 'px';
        }

        /** flick 判定后把气泡换成实际将上屏的字符（键位不动，仅换文字）。 */
        updateKeyBubble(glyph) {
            const bubble = document.getElementById('keyBubble');
            if (!bubble || bubble.hidden) return;
            bubble.textContent = glyph;
            this.scheduleHideBubble();
        }

        /** 松手后气泡短暂停留（验收 2026-09-24：立刻消失看不清），停留
         *  时长 hello.bubbleLinger（0=立即，默认 400ms）；新按下或 flick
         *  换字都会取消在途的隐藏调度。 */
        scheduleHideBubble() {
            if (this.bubbleHideTimer) { clearTimeout(this.bubbleHideTimer); this.bubbleHideTimer = 0; }
            if (!this.bubbleLinger) { this.hideKeyBubble(); return; }
            this.bubbleHideTimer = setTimeout(() => {
                this.bubbleHideTimer = 0;
                this.hideKeyBubble();
            }, this.bubbleLinger);
        }

        hideKeyBubble() {
            this.bubbleButton = null;
            if (this.bubbleHideTimer) { clearTimeout(this.bubbleHideTimer); this.bubbleHideTimer = 0; }
            const bubble = document.getElementById('keyBubble');
            if (bubble && !bubble.hidden) bubble.hidden = true;
        }

        bindTouch(button, options = {}) {
            if (!button) return; // Toolbar tools may not exist
            if (button.dataset.bound) return;
            button.dataset.bound = '1';
            let holdTimer = 0;
            let repeatTimer = 0;
            let longFired = false;
            // 本键当前按压（touchstart 刷新）：滑离检查与长按弹层的相对
            // 跟手都以它认手指——重叠双指下 event.touches[0] 可能是
            // 别根手指，坐标张冠李戴。
            let press = null;
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
                // 同键再次按下会重挂长按/连发；先清上一轮，避免覆盖 timer
                // 后松手只能清新 timer，旧 timer 在松手后弹出无人能收的层。
                clear();
                this.pressedKeys.add(button);
                button.classList.add('active-touch');
                this.nativeKeyFeedback();
                if (this.keyBubble && !this.popup) this.showKeyBubble(button);
                else if (this.bubbleHideTimer) this.hideKeyBubble();
                longFired = false;
                const touch = event.changedTouches[0];
                press = { x: touch.clientX, y: touch.clientY,
                    id: touch.identifier, button };
                this.pressById.set(press.id, press);
                // 防御性重占：owner 手指已不在场（其 touchend 没被本层
                // 看到，如按住中元素随布局更换被摘除）时锚点已是幽灵，
                // 新手势不得对着它判定。
                if (this.touchOrigin && !Array.from(event.touches).some(
                    item => item.identifier === this.touchOrigin.id)) {
                    this.touchOrigin = null;
                }
                if (!this.touchOrigin) {
                    this.touchOrigin = { x: press.x, y: press.y,
                        id: press.id, button };
                }
                if (button.dataset.lp === 'repeat') {
                    holdTimer = setTimeout(() => { repeatTimer = setInterval(() => button.click(), 75); }, this.holdMs + 40);
                } else if (button.dataset.lp === 'popup' && button.dataset.key) {
                    holdTimer = setTimeout(() => {
                        if (this.swiping) return;
                        // 同键双指：闭包 press 只剩最后按下者，弹层锚点优先
                        // 取手势 owner 的按压记录（owner 也在本键上时），
                        // 否则退回本键最后一次按压。
                        const ownerPress = this.touchOrigin &&
                            this.touchOrigin.button === button
                            ? this.pressById.get(this.touchOrigin.id) : null;
                        // 同键他指取消会保留共享计时器，闭包 press 却可能已
                        // 结束。只从活跃账本取锚点，避免开出无人能松手的层。
                        const base = ownerPress || (press && this.pressById.get(press.id))
                            || Array.from(this.pressById.values()).find(p => p.button === button);
                        if (!base) return;
                        // T9：长按=数字+字母组全后选（引擎通道）；1 键=
                        // 符号行并收起工具栏；qwerty 维持 accent 备选弹层。
                        if (this.mode === 't9') {
                            // 1 键没有长按态（单击即开符号行，用户定稿）；
                            // 其余数字键长按=数字+字母组全后选浮层。
                            this.openT9HoldPopup(button, base);
                        } else if (this.mode === 'stroke') {
                            // 笔画：三格浮层（符号·数字·符号）。7 键（符号
                            // 组）不设 data-lp，不会走到这里。
                            this.openStrokeHoldPopup(button, base);
                        } else this.openPopup(button, base);
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
                const touch = (press && Array.from(event.touches).find(
                    item => item.identifier === press.id)) || event.touches[0];
                if (!touch) return;
                const at = document.elementFromPoint && document.elementFromPoint(touch.clientX, touch.clientY);
                if (at !== button && !(at && button.contains(at))) clear();
            }, { passive: true });
            button.addEventListener('touchend', event => {
                event.preventDefault();
                // 先判归属再清整键共享标记（1.3.4）：同键非所属手指
                // 先松时，不能撤掉仍按着的 owner 的按压态与计时器。
                // 页面 capture 已收层时仍消费这次松手，不能再补发键面字符。
                // 原键已脱离文档时，由这里调用同一入口收尾。
                const ownsPopup = this.finishPopupTouch(event, false);
                const ownerPress = this.popup ? this.pressById.get(this.popup.fingerId) : null;
                const sameKeyNonOwner = !!(this.popup && !ownsPopup
                    && ownerPress && ownerPress.button === button);
                // 按事件里实际结束的手指清按压记录（同键双指时闭包 press
                // 只剩最后按下者，删它会删错人）。
                for (const item of event.changedTouches || []) {
                    this.pressById.delete(item.identifier);
                }
                // 同键非所属手指的结束对弹层与本键都是无事件：不删共享
                // 标记、不撤 active-touch、不清 owner 的计时器、不点按、
                // 不收弹层。异键非所属仍走下方正常点按路径。
                if (sameKeyNonOwner) return;
                // 迟到 touchend 保护不变（收起/取消后不得再输入）；但弹层
                // owner 的收尾不再依赖按键级标记——它可能已被同键他指删掉。
                if (!this.pressedKeys.has(button) && !ownsPopup) {
                    // 早退也要收按键气泡：owner 已不在任何键上，气泡再无
                    // 别的收起点（真机实录残留路径之一）。
                    this.scheduleHideBubble();
                    return;
                }
                this.pressedKeys.delete(button);
                button.classList.remove('active-touch');
                this.scheduleHideBubble();
                clear();
                if (ownsPopup) return;
                if (this.popup) {
                    if (!longFired && !this.swiping && !options.skipClick) {
                        // 别指的弹层开着：本指按自己的点按语义正常落键。
                        button.click();
                    }
                }
                else if (options.skipClick) { /* 空格键专用，非吞键 */ }
                else if (longFired) this._diagNoClick.long += 1;
                else if (this.swiping) this._diagNoClick.swipe += 1;
                else if (this.popup) this._diagNoClick.pop += 1;
                else button.click();
            }, { passive: false });
        }

        /** 页面级取消出口：事件即使没经过原键，也按手指账本收尾。 */
        cancelTouchEvent(event) {
            const ids = new Set(Array.from(event.changedTouches || [], t => t.identifier));
            const buttons = new Set();
            for (const id of ids) {
                const press = this.pressById.get(id);
                if (press) buttons.add(press.button);
                this.pressById.delete(id);
            }
            this.finishPopupTouch(event, true);
            for (const button of buttons) {
                // 同键仍有手指按住时，保留共享的按压态与计时器。
                if (Array.from(this.pressById.values()).some(p => p.button === button)) continue;
                this.pressedKeys.delete(button);
                button.classList.remove('active-touch');
                if (button._cancelPress) button._cancelPress();
                clearTimeout(button._comboTimer);
                if (this.bubbleButton === button) this.hideKeyBubble();
            }
            // 编辑条的计时器不在 pressedKeys 中，按事件目标撤销。
            const target = event.target;
            const tool = target && target.closest && target.closest('.tool');
            if (tool) {
                clearTimeout(tool._editHold);
                tool._editHoldPos = null;
            }
            const bar = target && target.closest && target.closest('#candidateBar');
            if (bar) {
                clearTimeout(bar._barHold);
                bar._barHoldPos = null;
            }
            if (this.finishTouchGesture) this.finishTouchGesture(event, true);
        }

        cancelTouches() {
            this.inkCancelTouch();
            // 在途定制宏链一并作废（#48 双击/换代防线）：键盘都收走了，
            // 台阶里的延迟键步没有合法去处。
            this.cancelCustomChain();
            // 键盘收起/取消链立即收气泡（2026-10-04 用户真机实录「键盘
            // 已收、单字气泡冻在屏上」）：不能走 scheduleHideBubble 的
            // linger 定时器——键盘都收走了气泡没有理由再停 400ms，且
            // 冻结窗口整批丢 timer 的前科会让它永远挂着。
            this.hideKeyBubble();
            for (const button of this.pressedKeys) {
                button.classList.remove('active-touch');
                if (button._cancelPress) button._cancelPress();
                clearTimeout(button._comboTimer);
            }
            this.pressedKeys.clear();
            if (this.popup) this.closePopup(true);
            this.touchOrigin = null;
            this.pressById.clear();
            // 未到期的工具栏长按计时一并掐掉（codex 2026-10-03 方案 §3）：
            // 它们挂在按钮/候选条自己的 touchend/cancel 上，收起链走不到
            // 那里——不清的话键盘已收、到点仍把编辑态拉起。不依赖
            // pressedKeys（这套计时器没登记进去）。
            const tbar = document.getElementById('candidateBar');
            if (tbar) {
                clearTimeout(tbar._barHold);
                tbar._barHoldPos = null;
                tbar.querySelectorAll('.tool').forEach(el => {
                    clearTimeout(el._editHold);
                    el._editHoldPos = null;
                });
            }
            this.scrubBase = null;
            this.scrubSteps = 0;
            // #34 手势会话随程序化取消一并复位（native 会话也要关——
            // 不关则恢复缓冲滞留到下次 begin）。
            if (this.delBase !== null) {
                this.call(() => Native.backspaceGestureEnd(this.token));
            }
            this.delBase = null;
            this.delSteps = 0;
            this.delNet = 0;
            this.bsVertical = 0;
            this.swiping = false;
        }

        setupFlick(root) {
            const threshold = 38;
            // Scrub tuning: recognition slop; caret steps are
            // SCRUB_UNIT_PX each, counted from the fixed threshold crossing.
            root.addEventListener('touchmove', event => {
                if (this.popup) {
                    event.preventDefault();
                    // 跟手跟的是开弹层那根手指：重叠双指下 touches[0]
                    // 可能是另一根静止手指，坐标一换算就「滑出边界」。
                    const list = Array.from(event.touches);
                    const own = list.find(item =>
                        item.identifier === this.popup.fingerId);
                    this.movePopup(own || list[0]);
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
                let touch = Array.from(event.touches).find(item => item.identifier === this.touchOrigin.id);
                if (!touch) return;
                let dx = touch.clientX - this.touchOrigin.x;
                let dy = touch.clientY - this.touchOrigin.y;
                let originButton = this.touchOrigin.button;
                let button = originButton.closest('.kb-key[data-key]');
                if (!this.swiping) {
                    // Flick/scrub recognition: the slop threshold gates the
                    // gesture start only - once swiping, the scrub below must
                    // keep tracking even when the finger crosses back over
                    // the origin (that is exactly how direction reverses).
                    if (Math.hypot(dx, dy) < threshold) {
                        // 次级仲裁（重叠双指）：owner 手指没动出阈，但另一
                        // 根有按压记录的手指可能正在做手势——A 托底久于 B
                        // 整个 flick 的窗口里，B 的位移也必须有人认领。
                        // 就地把锚点移交给越阈的那根手指，按它的起点判向。
                        const alt = Array.from(event.touches).find(item => {
                            if (item.identifier === this.touchOrigin.id) return false;
                            const p = this.pressById.get(item.identifier);
                            return !!p && Math.hypot(
                                item.clientX - p.x, item.clientY - p.y) >= threshold;
                        });
                        if (!alt) return;
                        const heir = this.pressById.get(alt.identifier);
                        this.touchOrigin = { x: heir.x, y: heir.y,
                            id: heir.id, button: heir.button };
                        touch = alt;
                        dx = alt.clientX - heir.x;
                        dy = alt.clientY - heir.y;
                        originButton = heir.button;
                        button = originButton.closest('.kb-key[data-key]');
                    }
                    this.swiping = true;
                    // 滑动接管手势：只撤「挂起的」语音长按计时器（T9 mic
                    // 横滑 scrub 按住不放，350ms 计时器若不撤，光标移动
                    // 中途会拉起语音浮层）。已激活的语音会话不动——上滑
                    // 撤销是 bindSpaceHold 自己的手势，这里抢了会破坏它。
                    clearTimeout(this.spaceHoldTimer);
                    // #34 删除键手势四件套的仲裁入口。任何被识别的手势
                    // 先杀 repeat——手指可能仍在键上（elementFromPoint 没
                    // 离开），迟到的 repeat 会多吃已上屏文本；repeat 已在
                    // 跑则同样被取消（先滑后按住的用户路径）。
                    const bsKey = originButton.closest('.kb-key[data-role="backspace"]');
                    if (bsKey) {
                        if (bsKey._cancelRepeat) bsKey._cancelRepeat();
                        // 手写模式的退格是「清笔迹优先」（inkBackspace），
                        // 四件套在这里没有对应设计——v1 不启用，键自身
                        // 行为不变。
                        if (bsKey.classList.contains('ink-key')) return;
                        // 四件套只挂主键盘（qwertyLayer：qwerty/双拼/T9/
                        // 笔画共用）的退格。数字/符号/自定义表层内的退格
                        // 常挨着滚动网格，从它起手的滚动不该在松手时变成
                        // 撤销/全选删（垂直动作是松手才发的破坏性操作）。
                        if (!bsKey.closest('#qwertyLayer')) return;
                        // 组合态不启用四件套（spec v1 裁剪，评审 F-2 的
                        // 最大正确性坑）：组合中退格属于引擎世界（删拼音）。
                        // 左滑保留既有「整段撤销组合」语义；垂直滑动不接
                        // 手势。组合被收掉后恢复缓冲也无从谈起——重发
                        // commitText 与原输入不等价。
                        if (this.composing) {
                            if (Math.abs(dx) > Math.abs(dy) && dx < 0) this.clearComposing();
                            return;
                        }
                        // 密码框等敏感编辑器禁用（评审 F-4：恢复重发/全选
                        // 删不碰敏感文本）。sensitive 经 onEditorInfo 下发。
                        if (this.editorSensitive) return;
                        if (Math.abs(dx) > Math.abs(dy)) {
                            // 右滑起始无语义：恢复只针对本会话已删字符。
                            if (dx < 0 && this.deleteGestureSupported()) {
                                this.engageDeleteScrub(bsKey, dx, dy, threshold);
                            }
                            return;
                        }
                        // 垂直主导：方向锁定在跨越样本上，动作延迟到松手
                        // （上=全选+删、下=Ctrl+Z）。与字母键 flick 即发不
                        // 同——删内容的手势先看用户最终意图，防误触即吞。
                        // 四件套整套降级（旧壳/预览无新桥）：垂直方向也
                        // 不锁，松手自然无派发。
                        if (this.deleteGestureSupported()) {
                            this.bsVertical = dy < 0 ? -1 : 1;
                        }
                        return;
                    }
                    // T9 手势仲裁（t9.md §3）：字母键四向=引擎字母/字面
                    // 数字，mic 独占 scrub。false=落回通用分支（mic 横滑）。
                    // 笔画同走这里（只保留上滑=字面数字）。
                    if ((this.mode === 't9' || this.mode === 'stroke') &&
                        this.t9Flick(originButton, dx, dy, touch.clientX,
                            touch.identifier)) return;
                    if (Math.abs(dy) >= Math.abs(dx) && button && button.dataset.key) {
                        // 空格的垂直 flick 无字面语义：T9/笔画的字面 0
                        // 已在 t9Flick 内消费，落到这里的 spaceKey 只会是
                        // 手写/26 键——挂 data-key 都只为借横滑 scrub，
                        // 垂直让路（上滑是 bindSpaceHold 的语音长按/撤销）。
                        if (button.id === 'spaceKey') return;
                        const key = button.dataset.key;
                        // Chinese-mode punct slot : the main glyph is
                        // 。so a tap/down-flick commits it; up commits the
                        // alt ，- both via the engine punctuator (ASCII '.'
                        // / ','), so the gestures match the printed glyphs.
                        let value;
                        // 互换开关（issue #29-2）：默认上滑=alt 小字符、下滑=
                        // 大写；开互换后对调。键面小字提示随 CSS 翻到下侧。
                        const altOnUp = !this.flickSwap;
                        if (key === '.' && this.chineseSymMode()) {
                            // Main ，(tap, down) / alt 。(up);
                            // both keep flowing through the engine punctuator
                            // (Native.key) - full-width directly would be
                            // dropped unprocessed.
                            value = (dy < 0) === altOnUp ? '.' : ',';
                        } else {
                            // CN_ALTS values are the final
                            // glyphs - committed as-is (commitText); the old
                            // FULLWIDTH widening map is gone.
                            value = (dy < 0) === altOnUp
                                ? this.altCandidates(key)[0]
                                : key.toUpperCase();
                        }
                        if (value) {
                            // 气泡反映实际输入字符（验收 2026-09-24）：touchstart
                            // 先显示键面主字，flick 判定出真实 value 后即刻换掉，
                            // 上滑/下滑看到的就是将上屏的 alt/大写。
                            if (this.keyBubble && !this.popup) this.updateKeyBubble(value);
                            // In Chinese modes a flicked digit/symbol
                            // or uppercase letter must LAND in the editor -
                            // Native.key() would feed the composition engine
                            // (digits become candidate selectors, uppercase
                            // becomes dead pinyin). commitText bypasses it.
                            if (this.chineseSymMode() && key === '.') {
                                // 标点槽组合中两步流（enginePunct，§9.6）。
                                this.enginePunct(value);
                            } else if (this.chineseSymMode()) {
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
                } else if (this.delBase !== null) {
                    // #34 跟手删与 scrub 并行连续段（键源互斥：scrub 只
                    // 认 data-key 键，delBase 只来自 backspace）。
                    this.applyDeleteScrub(touch.clientX);
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
                // #34 跟手删收尾：末次位置先结算（与 scrub 同理，最后
                // 半步不丢），松手即关 native 会话——恢复缓冲随之清空
                // （spec：恢复只在会话内有效，不做跨手势撤销栈）。
                // touchcancel 不结算但同样要关会话。
                if (origin && this.delBase !== null) {
                    if (!cancelled) {
                        const touch = Array.from(event.changedTouches || []).find(
                            item => item.identifier === origin.id);
                        if (touch) this.applyDeleteScrub(touch.clientX);
                    }
                    this.delBase = null;
                    this.delSteps = 0;
                    this.delNet = 0;
                    this.delRetry = false;
                    this.call(() => Native.backspaceGestureEnd(this.token));
                }
                // #34 垂直手势在松手派发（方向已在跨越时锁定）。上=全选
                // 删：独立桥 clearEditorText（先作废词撤销再全选再 DEL——
                // 复用普通 backspace 会踩法/俄「退格重开上一词」，codex
                // 评审 P1-3）；旧壳无该桥回落 selectAll+backspace。
                // 下=Ctrl+Z。
                if (!cancelled && origin && this.bsVertical) {
                    if (this.bsVertical < 0) {
                        if (typeof Native.clearEditorText === 'function') {
                            this.call(() => Native.clearEditorText(this.token));
                        } else {
                            this.call(() => Native.editorAction('selectAll', this.token));
                            this.call(() => Native.backspace(this.token));
                        }
                    } else {
                        this.call(() => Native.keyEvent(BS_UNDO_KEYCODE,
                            CTRL_META_BITS.Ctrl, this.token));
                    }
                }
                this.bsVertical = 0;
                this.touchOrigin = null;
                // 重叠双指：owner 抬起时其余手指可能仍在手势中（快速双手
                // 打字的第二指正要上滑）。锚点移交给剩下的、有自己按下点
                // 的手指——各自起点各自算位移；没有候补才真正清空。
                const rest = Array.from(event.touches || []);
                const heir = rest.find(item => this.pressById.has(item.identifier));
                if (heir) {
                    const next = this.pressById.get(heir.identifier);
                    this.touchOrigin = { x: next.x, y: next.y,
                        id: next.id, button: next.button };
                }
                this.scrubBase = null;
                this.scrubSteps = 0;
                setTimeout(() => { this.swiping = false; }, 0);
            };
            root.addEventListener('touchend', event => finish(event, false), { capture: true });
            this.finishTouchGesture = finish;
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

        /** #34 新桥能力探测：键盘可热更到旧 APK 上，四个手势桥缺任何
         * 一个就把整套手势降级为不启用（typeof 守卫，与 keyFeedback 的
         * 兼容模式同款；不进 REQUIRED_CAPABILITIES——那会让旧壳拒绝
         * 整个新键盘）。 */
        deleteGestureSupported() {
            return typeof Native.backspaceGestureBegin === 'function' &&
                typeof Native.backspaceN === 'function' &&
                typeof Native.backspaceRestoreOne === 'function' &&
                typeof Native.backspaceGestureEnd === 'function';
        }

        /** #34 跟手删启动：锚点数学与空格 scrub 同源（在固定阈值跨越处
         * 定锚、首个跨越恰删一字），步长换成退格键宽的 60%（spec --del-step
         * 建议值，用实际行内键宽度量）。begin 先行——native 侧恢复缓冲
         * 的光标前文本基线读取是异步的，越早开始越好。 */
        engageDeleteScrub(bsKey, dx, dy, threshold) {
            this.delUnit = Math.max(12, (bsKey.getBoundingClientRect().width || 44) * 0.6);
            const distance = Math.hypot(dx, dy) || threshold;
            const crossingX = this.touchOrigin.x + (dx / distance) * threshold;
            this.delBase = crossingX + this.delUnit;
            this.delSteps = -1;
            this.delNet = 1;
            this.delRetry = false;
            this.call(() => Native.backspaceGestureBegin(this.token));
            this.call(() => Native.backspaceN(1, this.token));
        }

        /** #34 跟手删连续段。净删除数是位置的函数（target = max(0,
         * -steps)）：左滑删、右滑把本会话已删的恢复回来、恢复完再右滑
         * 无操作——纯位置语义让「右滑抖动再回来」不会误删新字符。
         * 删除走批量桥（一次事件跨过的单位合一次调用，快速甩动不丢步，
         * 与 applyScrub 的批量理由相同；单次上限 16 与 native 的
         * MAX_BACKSPACE_GESTURE_UNITS 对齐）；恢复逐字弹回，凭
         * backspaceRestoreOne 的回执决定成败（见函数内注释）。 */
        applyDeleteScrub(clientX) {
            const steps = Math.trunc((clientX - this.delBase) / this.delUnit);
            // 恢复被拒后同格不再重试的缺口（codex 二轮 P2-3）：拒绝时立
            // delRetry，位置未变的后续事件（含松手前的最终结算）也强制
            // 重算一次——基线在手指原地停顿期间结算好后，恢复能力即恢复。
            if (steps === this.delSteps && !this.delRetry) return;
            this.delRetry = false;
            this.delSteps = steps;
            const target = Math.max(0, -steps);
            let delta = target - this.delNet;
            this.delNet = target;
            while (delta > 0) {
                const count = Math.min(16, delta);
                this.call(() => Native.backspaceN(count, this.token));
                delta -= count;
            }
            while (delta < 0) {
                // 回执协议（codex 评审 P1-1）：restoreOne 返回 false（无账
                // 可弹/基线未结算/编辑器已换）时不把它当成功——delNet 回退
                // 该步，净删除仍是位置的诚实函数；下次事件重算会重试，
                // 幂等无害。旧壳无返回值（undefined）按成功处理。
                const ok = this.call(() => Native.backspaceRestoreOne(this.token));
                if (ok === false) { this.delRetry = true; break; }
                delta += 1;
            }
            if (delta < 0) this.delNet = target - delta;
        }

        /** T9 手势仲裁（t9.md §3）。返回 true=已消费；false=落回通用
         * 分支（mic 的横滑 scrub 由通用代码处理——scrub 选择器认
         * .kb-key[data-key]，mic 在 T9 下挂 data-key=0）。 */
        t9Flick(originButton, dx, dy, clientX, fingerId) {
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
                        initialX: clientX != null ? clientX : null,
                        fingerId,
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
            if (this.chineseSymMode() && CN_ALTS[key]) return [CN_ALTS[key]];
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
            if (this.chineseSymMode() && CN_ALTS[key]) return CN_ALTS[key];
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
        openT9HoldPopup(button, press) {
            this.hideKeyBubble();
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
            this.openT9Popup(button, cells, { grid: true, press });
        }

        /** 笔画长按（issue #18，用户定稿 2026-09-19）：与 T9 同款三排——
         * 小写字母组 / 左符号 · 数字 · 右符号 / 大写字母组。字母组沿用
         * T9 的数字键位分配（2=abc…9=wxyz，拨号键盘肌肉记忆），上屏规
         * 则同 T9：字母（含大写）与符号 literal 直上屏（commitText），中
         * 格数字=点按同义（发部件编码，send 字段），预选中格、相对跟手。
         * 1 键无字母组：退回单排 符号·数字·符号。 */
        openStrokeHoldPopup(button, press) {
            this.hideKeyBubble();
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
            this.openT9Popup(button, cells,
                Object.assign(letters.length ? { grid: true } : { middle: true }, { press }));
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
                selected, cancelled: false, enginePath: true,
                // 长按浮层取证：心跳捎带 open 时长——悬挂现场直接读出
                // 「弹层开了多久没人收」。
                openedAt: Date.now() };
            if (opts.split) {
                this.popup.split = true;
                // split 弹层不做相对跟手，但多指下终判/关层同样要认手
                // （popupOwnsTouch），fingerId 从下滑手势的手指带上。
                if (opts.fingerId !== undefined) this.popup.fingerId = opts.fingerId;
            }
            if (opts.grid || opts.middle) this.attachRelativeTracking(popup, selected, opts.press);
        }

        /** 松手/取消共用的弹层终判：不依赖原键还在文档中，也不依赖
         * touchOrigin 的手势所有权。只有仍按住的手指才能继续持有浮层。
         * 同一事件可能经过页面和原键两次；记录消费结果，防止重复上屏。 */
        finishPopupTouch(event, cancelled) {
            if (this.popupEndEvents.has(event)) return true;
            const popup = this.popup;
            if (!popup) return false;
            const ownsPopup = this.popupOwnsTouch(popup, event);
            const ownerStillDown = Array.from(event.touches || []).some(
                touch => touch.identifier === popup.fingerId);
            if (!ownsPopup && ownerStillDown) return false;
            // 所属手指已失联时只撤销，不能拿别指的松手位置提交旧高亮。
            if (ownsPopup) this.popupEndEvents.add(event);
            if (ownsPopup && !cancelled && popup.relative) {
                const last = Array.from(event.changedTouches || []).find(
                    touch => touch.identifier === popup.fingerId);
                if (last) this.movePopup(last);
            }
            this.closePopup(cancelled || !ownsPopup);
            return ownsPopup;
        }

        /** 弹层是否属于本次事件里变化的手指（多指仲裁）：所属手指
         *  才能提交选中项。fingerId 未知（未记录
         *  的旧弹层、mock 无 identifier）恒真，保持单指既有语义。 */
        popupOwnsTouch(popup, event) {
            return popup.fingerId === undefined ||
                Array.from(event.changedTouches || []).some(
                    item => item.identifier === popup.fingerId);
        }

        /** 相对跟手选中（issue #9 定稿，qwerty accent 弹层同款）：高亮锚在
         * 预选格上，跟随手指「相对按下点」的位移同步移动——手指全程不必
         * 碰到浮层；虚拟光标滑出卡片边界 = 淡出 + 「松手撤销」，拖回恢复。
         * origin 拷贝自按下点：capture 收尾会清 touchOrigin，弹层必须自带
         * 位移基准。press=开弹层那根手指自己的按下点（重叠双指下全局
         * touchOrigin 属于首指，拷它会把这根手指的位移钉到首指位置上，
         * 一动就出卡片边界被当「松手撤销」）。 */
        attachRelativeTracking(popup, anchor, press) {
            this.popup.relative = true;
            this.popup.anchor = anchor;
            const base = press || this.touchOrigin;
            this.popup.origin = base ? { x: base.x, y: base.y } : null;
            this.popup.fingerId = base ? base.id : undefined;
            const card = popup.getBoundingClientRect();
            this.popup.cardRect = {
                left: card.left, top: card.top,
                right: card.right, bottom: card.bottom,
            };
        }

        openPopup(button, press) {
            this.hideKeyBubble();
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
                const glyph = this.chineseSymMode() && (char === ',' || char === '.')
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
            this.popup = { key, cells, selected, cancelled: false,
                openedAt: Date.now() }; // 长按浮层取证：见另一赋值点注释
            // qwerty accent 弹层与 T9 三行弹层同一套相对跟手（用户定稿）：
            // 高亮跟随手指位移，不要求手先滑上浮层。
            this.attachRelativeTracking(popup, selected, press);
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
            // 手写标点上滑弹层（round-3）：绝对命中模式——手指压在哪格
            // 选哪格，无预选格、无相对跟手、无「松手撤销」（没选过谈
            // 不上撤销）。根级手势层是 capture、先进这里；键面 handler
            // 的同名调用幂等。
            if (this.popup.absolute) {
                this.moveInkPopup(touch);
                return;
            }
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
            inner.style.maxHeight = '';
            inner.classList.remove('t9-row', 't9-grid3', 'kp-grid', 'kp-drawer');
            const popupEl = document.getElementById('keyPopup');
            popupEl.classList.remove('open', 'kp-drawer');
            // 抽出条按键宽展开，别把宽度带给下一颗长按弹层。
            popupEl.style.width = '';
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
                if (this.chineseSymMode() && (char === ',' || char === '.')) {
                    // 标点槽组合中两步流（enginePunct，§9.6）。
                    this.enginePunct(char);
                } else if (this.chineseSymMode()) {
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
            // 法语组合态：shift 循环当前候选大小写（全小写 → 首字母
            // 大写 → 全大写 → 全小写），不切换键面大小写状态。
            if (this.mode === 'french' && this.composing) {
                this.caseMode = this.caseMode === 'cap' ? 'upper'
                    : this.caseMode === 'upper' ? null : 'cap';
                this.updateCaseKeyVisual();
                this.renderCandidates(this.lastEngineState || {});
                return;
            }
            if (this.caps) this.caps = false;
            else this.shift = !this.shift;
            this.updateLabels();
        }

        /** caseMode 的 shift 键指示（cap=单亮，upper=锁定亮）。 */
        updateCaseKeyVisual() {
            const key = document.querySelector('.kb-mod.shift');
            if (!key) return;
            key.classList.toggle('case-cap', this.caseMode === 'cap');
            key.classList.toggle('case-upper', this.caseMode === 'upper');
        }

        /** 大小写变形（首字母大写对撇号词取真首字母：c'était → C'était）。 */
        caseifyText(text) {
            if (this.caseMode === 'cap') {
                return text.charAt(0).toUpperCase() + text.slice(1);
            }
            if (this.caseMode === 'upper') return text.toUpperCase();
            return text;
        }

        lockShift() {
            this.caps = true;
            this.shift = false;
            this.updateLabels();
        }

        updateLabels() {
            // Pinyin keyboards show uppercase key glyphs
            // (candidates are what actually commit), direct shows lowercase.
            // #39-7：形码同此——键面大写与拼音统一（码即字母，四码顶字，
            // 键面大写不会误导输入）。
            const chinese = this.mode === 'pinyin' || this.mode === 'double-pinyin' ||
                this.mode === 'flypy';
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
        exclusiveOpen(name) {
            const v = EXCLUSIVE_VIEWS[name];
            if (!v) return false;
            const el = document.getElementById(v.el);
            if (!el) return false;
            return v.openClass ? el.classList.contains(v.openClass) : !el.hidden;
        }

        /** 收口互斥（#39-12）：开 except 视图前关掉其余开着的互斥视图。
         *  except 省略 = 全关（resetToHome/renderMode 等全收场景）。 */
        closeOtherViews(except) {
            Object.keys(EXCLUSIVE_VIEWS).forEach(name => {
                if (name === except || !this.exclusiveOpen(name)) return;
                const close = EXCLUSIVE_VIEWS[name].close;
                if (typeof this[close] === 'function') this[close]();
            });
        }

        showKeyLayer(name) {
            this.keyLayer = name;
            // #39-5 面板互斥：层切换（数字/表情/符号/字母）收掉长按
            // 模式菜单浮层——它锚在 IME 键上不随层走，留着会叠在新层
            // 上方（用户实录：功能菜单 + 数字面板两层同开）。
            this.closeModeMenu();
            // #39-12 收口：互斥视图让位统一走注册表（closeXxx 会
            // showKeyLayer(returnField) 再入此处：彼时该视图已关，
            // 直接放行切到目标层）。modeMenu 不记返回层（锚点浮层，
            // 关掉即回，无层可还）。
            Object.entries(EXCLUSIVE_VIEWS).forEach(([viewName, v]) => {
                if (viewName === 'modeMenu' || !this.exclusiveOpen(viewName)) return;
                if (v.returnField) this[v.returnField] = name;
                this[v.close]();
            });
            // The emoji sub-view belongs to a nine-pad session.
            if (name !== 'numpad') this.emojiView = false;
            this.hideKeyLayers();
            document.getElementById(
                name === 'symbols' ? 'symbolLayer'
                    : name === 'numpad' ? 'numPadLayer' : 'qwertyLayer',
            ).hidden = false;
        }

        hideKeyLayers() {
            // 键区替换层一律藏：正常路径由各自 close 先收（含 body class
            // 清理与返回层记忆），这里兜底防漏。动态扫 .kb-layer——新层
            // 零登记成本自动进（#39-12 实录：定制面板叠快捷设置抽屉）。
            // ctrlLayer 除外：它是候选条行视图，与键区层共存，生命周期
            // 归 setControlView。
            document.querySelectorAll('.kb-layer').forEach(el => {
                if (el.id !== 'ctrlLayer') el.hidden = true;
            });
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
            this.closeOtherViews();
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
            // 重唤键盘（onStartInputView 非 restarting 路径）：手写态把
            // 总高再推一遍——收起期间的高度变化不能把手写面板留在旧值
            // （applyHeightNow 之外的第二条兜底，preview harness 也走这）。
            if (this.mode === 'handwriting') this.applyModeHeight();
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
                    () => this.backspaceAction(),
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
         * (second tap on the active tab flips it) or the default - both
         * follow the input mode (issue #48: 引号 used to default to zh,
         * forcing an extra tap in English mode). */
        variantNow(catId) {
            if (this.tableVariants[catId]) return this.tableVariants[catId];
            return !this.chineseSymMode() ? 'en' : 'zh';
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

        /** [open:URI] 的表单校验（与 native openLink 桥同口径，桥侧
         *  再校验一次兜底）：http(s) 网页地址或应用自定义 scheme；
         *  intent://（点名组件）、data:（塞标记给浏览器）、android-app:
         *  （点名任意包拉起）等能夹带信息走私跳转的形态一律拒绝。
         *  方括号也拒：DSL 以 [..] 切步，含括号的 URI 会被静默截断
         *  （IPv6 字面量同理，属可接受损失）。 */
        validateOpenUri(uri) {
            if (!uri) return { error: t("缺少链接") };
            if (/[\s]/.test(uri)) return { error: t("链接里不能有空格") };
            if (/[\[\]]/.test(uri)) return { error: t("链接里不能有方括号") };
            const scheme = /^([a-z][a-z0-9+.\-]*):/i.exec(uri);
            if (!scheme) return { error: t("必须是 http(s) 网页地址或应用链接（如 doubao://）") };
            const name = scheme[1].toLowerCase();
            const blocked = ['intent', 'javascript', 'file', 'content', 'about',
                'data', 'android-app', 'blob'];
            if (blocked.includes(name)) {
                return { error: t("不支持 {0} 链接", name + ':') };
            }
            return { ok: true };
        }

        /** Tap DSL -> execution steps. Text outside [..] commits
         * literally; [name] presses a key; [mod+...+name] a combo;
         * [open:URI] opens an app/web page. Returns {steps} or
         * {error} (message names the offending token). */
        parseTapDsl(tap) {
            // 方括号 URI 前置拦截：`[open:https://[2001:db8::1]/]` 会被
            // 下方的记号正则切成「[2001:db8::1] 键名不可用」这种费解报错
            // （或更糟：`a]b]` 形态静默截断成文本步骤）。open 记号内部
            // 不允许再出现任何方括号，直接给明确说法。
            const trimmed = String(tap || '').trim();
            if (/^\[open:/i.test(trimmed) && /[\[\]]/.test(trimmed.slice(1, -1))) {
                return { error: t("链接里不能有方括号") };
            }
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
                const raw = match[1].trim();
                // [open:URI]：外链步骤（打开应用/网页）。URI 大小写敏感，
                // 必须取原始串——下方 body 的 toLowerCase 只服务键名。
                if (raw.toLowerCase().startsWith('open:')) {
                    const uri = raw.slice(5).trim();
                    const check = this.validateOpenUri(uri);
                    if (check.error) return { error: t("「{0}」{1}", match[0], check.error) };
                    steps.push({ open: uri });
                    continue;
                }
                // [setting:id]：打开本 App 设置页并直达设置项（#51 定制
                // 按键绑定）。id 是设置行/控件的 element id（与键盘 tile
                // 深链同锚）；长度钳制防滥用（无内容跳转）。
                if (raw.toLowerCase().startsWith('setting:')) {
                    const id = raw.slice(8).trim();
                    if (!/^[\w-]{1,64}$/.test(id)) {
                        return { error: t("「{0}」设置项标识无效", match[0]) };
                    }
                    steps.push({ openSetup: id });
                    continue;
                }
                // [panel:x]：打开键盘面板/图层（#50 定制按键复用——与
                // 长按空格动作同一套面板白名单）。一次性触发，无收尾语义。
                if (raw.toLowerCase().startsWith('panel:')) {
                    const target = raw.slice(6).trim().toLowerCase();
                    if (!PANEL_STEPS.has(target)) {
                        return { error: t("「{0}」面板名无效", match[0]) };
                    }
                    steps.push({ panel: target });
                    continue;
                }
                const body = raw.toLowerCase();
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
                    // 可选字段：span（宽键倍数 1-3）与 color（预设色板）。
                    if (cell.span != null) {
                        if (![1, 2, 3].includes(cell.span)) {
                            return { error: t("「{0}」的 span 只能是 1/2/3", label) };
                        }
                    }
                    if (cell.color != null) {
                        const hue = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color);
                        const hueOk = hue && Number(hue[1]) <= 359
                            && (hue[2] == null || Number(hue[2]) <= 100);
                        if (!hueOk && !CUSTOM_KEY_COLORS.includes(cell.color)) {
                            return { error: t("「{0}」的 color 只能是：{1} 或自定义色调 h0-h359", label, CUSTOM_KEY_COLORS.join('/')) };
                        }
                    }
                    // 行对齐（2026-10-03）：可选 align 挂在行内任意 cell 上，
                    // 渲染取行内第一个有效值。挂 cell 而非改 rows 形状——
                    // 旧版键盘校验器忽略未知字段，热更错峰不炸整表。
                    if (cell.align != null && !['left', 'center', 'right'].includes(cell.align)) {
                        return { error: t("「{0}」的 align 只能是：left/center/right", label) };
                    }
                    if (++total > CUSTOM_LIMITS.keys) {
                        return { error: t("键总数超过 {0}", CUSTOM_LIMITS.keys) };
                    }
                    const clean = { t: label, tap, note };
                    if (cell.span === 2 || cell.span === 3) clean.span = cell.span;
                    if (cell.color != null) clean.color = cell.color;
                    if (cell.align === 'left' || cell.align === 'center' || cell.align === 'right') {
                        clean.align = cell.align;
                    }
                    keys.push(clean);
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
        /** #39-12：cell 的 tap 恰好是单个裸 Backspace（无文本/无修饰）
         *  → 退格专属渲染（specialKey + 长按连删）。 */
        /** 自定义行按需缩放（2026-10-04）：比例相对【当前字号】算
         *  （cur × avail / sw），多轮精化补 min-width/padding 不随字缩
         *  的残差；下限 55%，放不下交还横向滚动。resize/旋转后幂等重跑
         *  （行几何随视口变），无布局环境（mock/隐藏）clientWidth=0
         *  自动跳过。 */
        fitCustomRow(strip) {
            strip.style.fontSize = '';
            const avail = strip.clientWidth;
            if (!avail) return;
            for (let round = 0; round < 3 && strip.scrollWidth > avail; round++) {
                const cur = parseInt(strip.style.fontSize, 10) || 100;
                const pct = Math.round(cur * avail / strip.scrollWidth);
                const clamped = Math.max(55, Math.min(pct, cur));
                strip.style.fontSize = clamped + '%';
                if (clamped <= 55) break;
            }
            // 收敛残差（用户三轮实录"还有一点在容器外"）：乘法精化卡在
            // Math.round 粒度时逐 1% 下调收尾；键的 min-width/padding 已
            // em 化跟着缩，能收干净。放不下到下限则交还横向滚动。
            let cur = parseInt(strip.style.fontSize, 10) || 100;
            while (strip.scrollWidth > avail && cur > 55) {
                cur = Math.max(55, cur - 1);
                strip.style.fontSize = cur + '%';
            }
        }

        customCellIsBackspace(cell) {
            const parsed = this.parseTapDsl(cell.tap);
            if (parsed.error) return false;
            const steps = parsed.steps;
            return steps.length === 1 && steps[0].combo
                && steps[0].combo.length === 1
                && steps[0].combo[0] === 'Backspace';
        }

        // #48（omt vim 退不出）：xterm.js 宿主里 commitText 的落地是
        // 异步的 composition 流，紧跟其后的 keyEvent 会把它掐死——
        // 定制键序列 [esc]:wq[enter] 实测 onData 只有 \x1b 和 \r，:wq
        // 蒸发，vim 收到 ESC 退出插入模式后光标下移一行，不保存退出。
        // 方向实测（真机 xterm+onData 矩阵）：键→文本 0ms 安全；文本→
        // 键 0ms 致死、150ms 起全通（取 300ms 余量）。故只在文本步后面
        // 还跟键步时垫台阶。Termux 等原生终端视图无此坑，垫了也无感。
        // 同步跑到台阶点、余下步骤 setTimeout 续跑（纯定时器，假时钟可测）。
        runCustomCell(cell) {
            const parsed = this.parseTapDsl(cell.tap);
            if (parsed.error) {
                this.showToast(t("按键无效：{0}", parsed.error));
                return;
            }
            // 双击交错防线（codex 评审 P1）：宏入队串行，不与在途宏的
            // 300ms 台阶重叠。
            this.customChainQueue.push(parsed.steps);
            this.pumpCustomChain();
        }

        /** 队列泵：上一条宏跑完（或整链作废）才起下一条。衔接处的
         *  text→key 间距由 customChainLastTextAt 时间窗统一裁决——跨宏/
         *  跨点击的相邻与宏内同罪同罚，几秒后的新点击不垫冤枉台阶。 */
        pumpCustomChain() {
            if (this.customChainActive) return;
            const steps = this.customChainQueue.shift();
            if (!steps) return;
            this.customChainActive = true;
            this.runCustomStepsFrom(steps, 0);
        }

        /** 作废在途宏链：native onStartInput（编辑器换代，经
         *  Feelime.cancelCustomChain 钩子）与收起链（cancelTouches）
         *  触发——台阶里的延迟键步不能发进新输入框，队列整段丢弃。 */
        cancelCustomChain() {
            this.customChainQueue.length = 0;
            if (this.customChainTimer) {
                clearTimeout(this.customChainTimer);
                this.customChainTimer = 0;
            }
            this.customChainActive = false;
            this.customChainLastTextAt = 0;
        }

        /** #50 面板动作分发（唯一入口）：长按空格动作与定制按键
         *  [panel:x] 步骤共用。一次性打开，无收尾语义。 */
        runPanelStep(target) {
            if (target === 'clipboard') this.openPanel('clipboard');
            else if (target === 'favorites') this.openPanel('favorites');
            else if (target === 'edit') this.toggleEditPanel();
            else if (target === 'control') this.setControlView(true);
        }

        /** #48：DSL 步骤执行器。文本步→键步的通道切换处垫台阶到
         *  距最后一次文本发送满 300ms（见 runCustomCell 上方注释）；
         *  同步跑到台阶点，余下步骤 setTimeout 续跑（无 async，假时钟
         *  可测——harness 的 Date 已接 FakeClock）。 */
        runCustomStepsFrom(steps, index) {
            for (let i = index; i < steps.length; i++) {
                const step = steps[i];
                if (step.open) {
                    // 热更键盘（新 JS）跑在旧原生（无 openLink 桥）上时，
                    // 点按应给出可读提示，而非 TypeError 静默吞掉（后续
                    // 步骤一并中断）。能力探测是本仓库新桥方法的约定
                    // （collectStores / height-ack 同款）。
                    if (typeof Native.openLink !== 'function') {
                        this.showToast(t("此按键需要升级 App 后使用（打开链接）"));
                        this.cancelCustomChain();
                        return;
                    }
                    this.call(() => Native.openLink(step.open, this.token));
                }
                else if (step.openSetup) {
                    // #51 定制按键「打开设置项」：openSetupPage 与键盘 tile
                    // 深链同通道（导航类无 token 门闸），能力探测同款。
                    if (typeof Native.openSetupPage !== 'function') {
                        this.showToast(t("此按键需要升级 App 后使用（打开设置）"));
                        this.cancelCustomChain();
                        return;
                    }
                    this.call(() => Native.openSetupPage(step.openSetup, this.token));
                }
                else if (step.panel) {
                    // [panel:x]（#50 定制按键复用）：与长按空格动作同一
                    // 分发点，一次性打开面板/图层。
                    this.runPanelStep(step.panel);
                }
                else if (step.text) {
                    this.sendSymbol(step.text);
                    this.customChainLastTextAt = Date.now();
                }
                else {
                    const sinceText = Date.now() - this.customChainLastTextAt;
                    if (sinceText < 300) {
                        // 只等剩余时间；回调里链已作废则丢弃（编辑器
                        // 代换/收起的竞态兜底）。
                        this.customChainTimer = setTimeout(() => {
                            this.customChainTimer = 0;
                            if (!this.customChainActive) return;
                            this.sendCombo(step.combo);
                            this.runCustomStepsFrom(steps, i + 1);
                        }, 300 - sinceText);
                        return;
                    }
                    this.sendCombo(step.combo);
                }
            }
            // 本宏执行完毕：放下一条（衔接间距由时间窗裁决）。
            this.customChainActive = false;
            this.pumpCustomChain();
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
            // #39-12：定制 tab 的渲染（三行横滚条 + 右列删除），从旧版
            // 迁回——工具栏按钮直达此 tab，与数字/表情面板同模式。
            if (this.symbolCat === 'custom') {
                const grid = document.getElementById('symGrid');
                grid.textContent = '';
                const wrap = document.createElement('div');
                wrap.className = 'sym-custom';
                const rowsBox = document.createElement('div');
                rowsBox.className = 'sym-custom-rows';
                const rows = this.customKeys() || [[], [], []];
                rows.forEach(row => {
                    const strip = document.createElement('div');
                    strip.className = 'kb-row sym-custom-row';
                    // 行对齐取行内第一个有效 align（settings 行控件写在
                    // 首键上）；CSS 用首键 auto margin 停靠，溢出时归零
                    // 不裁键（justify-content 在 overflow 容器会裁起点）。
                    const align = (row || []).map(c => c && c.align)
                        .find(a => a === 'left' || a === 'center' || a === 'right');
                    if (align) strip.dataset.align = align;
                    (row || []).forEach(cell => {
                        // 退格也是表数据的一部分：tap 恰好是单个
                        // [backspace] 的 cell 渲染成specialKey 形态
                        // （桥专用通道 + 长按连删，与原右列同体验），
                        // 不指定就没有——不再硬编码右列。
                        if (this.customCellIsBackspace(cell)) {
                            strip.append(this.specialKey('backspace', ICONS.backspace,
                                () => this.backspaceAction(),
                                'kb-special sym-custom-key', 'repeat'));
                            return;
                        }
                        const button = document.createElement('button');
                        button.className = 'kb-key sym-custom-key';
                        const hueM = cell.color ? /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color) : null;
                        if (cell.color && !hueM && CUSTOM_KEY_COLORS.includes(cell.color)) {
                            button.classList.add('ck-' + cell.color);
                        } else if (hueM) {
                            const sat = hueM[2] != null ? hueM[2] : 65;
                            button.style.background = 'hsl(' + hueM[1] + ', ' + sat + '%, 45%)';
                            button.style.borderColor = 'hsl(' + hueM[1] + ', ' + sat + '%, 35%)';
                            button.style.color = '#fff';
                        }
                        if (cell.span === 2 || cell.span === 3) {
                            button.dataset.span = String(cell.span);
                        }
                        button.textContent = cell.t;
                        button.addEventListener('click', () => this.runCustomCell(cell));
                        if (cell.note) {
                            this.bindItemLongPress(button, () => {
                                this.showKeyNote(button, cell.note);
                                // 松手即收（用户语义，2026-10-04 真机实录
                                // "松手不消失"）：note 的存活绑定本次触摸
                                // 会话。不能只赌 showKeyNote 里的 1600ms
                                // 定时器——IME WebView 冻结窗口整批丢
                                // timer 是本项目有前科的平台行为，丢了
                                // 浮层就无人能收。
                                const dismiss = () => {
                                    const tip = document.getElementById('keyNote');
                                    if (tip) tip.remove();
                                    button.removeEventListener('touchend', dismiss);
                                    button.removeEventListener('touchcancel', dismiss);
                                };
                                button.addEventListener('touchend', dismiss, { passive: true });
                                button.addEventListener('touchcancel', dismiss, { passive: true });
                            });
                        }
                        strip.append(button);
                    });
                    rowsBox.append(strip);
                });
                wrap.append(rowsBox);
                grid.append(wrap);
                // 行内键超宽整体缩放（2026-10-04 用户需求）：与设置页
                // 「定制即预览」同款语义——按行缩字号塞进一行，min-width/
                // padding 已 em 化随字号等比缩；缩到下限仍放不下交还
                // .sym-custom-row 的横向滚动。mock 环境无布局（clientWidth
                // =0）自动跳过。
                [...rowsBox.children].forEach(strip => this.fitCustomRow(strip));
                return;
            }

            const grid = document.getElementById('symGrid');
            grid.replaceChildren();
            if (this.symbolCat === 'arrows') {
                // The 方向 category commits directional TEXT (design §2.4):
                // the glyphs land literally and ⇥ commits a real tab
                // character - no key events, no repeat. Directional glyphs
                // do land in 最近 (issue #48); the tab commit stays out.
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
                        const value = text || glyph;
                        row.append(this.functionKey(glyph,
                            () => {
                                this.sendSymbol(value);
                                if (!text) this.remember(glyph);
                            },
                            'sym-single'));
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
                    () => this.backspaceAction(),
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
                        () => this.backspaceAction(),
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
            // #39-10 编辑面板同样独占键区（ctrl 视图换的是候选栏槽位，
            // 两个替换层叠加会把 ctrl 行画在编辑网格上方）。
            if (on && !document.getElementById('editLayer').hidden) return;
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
            const chinese = this.mode === 'pinyin' || this.mode === 'double-pinyin' ||
                this.mode === 'flypy';
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
            // native pref（hello 下发）是唯一事实（AGENTS.md：配置不走
            // localStorage——曾有的镜像在 force-stop 丢写后与 pref 分裂，
            // 已废除）。
            const nativeValue = Math.round(this.nativeStoredHeightCss || 0);
            return nativeValue >= 120 ? nativeValue : 0;
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

        // 候选字号：80-150 连续百分比直写 CSS 变量（issue #42 替代
        // 三档 data 属性），行高预算不动。
        applyCandidateFont() {
            const pct = Number(this.candidateFont);
            const clamped = Number.isFinite(pct) ? Math.min(150, Math.max(80, pct)) : 100;
            document.body.dataset.candFont = clamped === 100 ? 'normal' : 'scaled';
            document.body.style.setProperty('--cand-font-scale', String(clamped / 100));
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
            // 记忆用过的侧（#38 直达切换）：开关键不再三档循环，单击
            // =开（用上次的侧）/关；设过左手/右手就固定用那只。localStorage
            // 之外同步上推 native（P2-3）：备份与设置页都以 native 为准。
            if (level === 1 || level === 2) {
                try { localStorage.setItem('feelime_onehand_side', String(level)); } catch (_) {}
                // codex P2：this.call 在 ready/token 未就绪时静默丢调用——
                // 若先写 memory，这次上推被拦后永不重试（升级用户首个
                // hello 的记忆永远没落盘）。先验门闸再写 memory，未就绪
                // 就保持「记忆缺失」，下个 hello 的 applyOneHand 重推。
                if (this.ready && this.token && this.oneHandSideMemory !== level &&
                        typeof Native.setQuickPref === 'function') {
                    this.oneHandSideMemory = level;
                    this.call(() => Native.setQuickPref(
                        'oneHandSide', String(level), this.token));
                }
            }
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
            // 让位收窄也不触发 window resize/ResizeObserver（border-box
            // 不含 padding 变化，review P3）：定制行宽度变了要重拟合，
            // 否则滞留旧宽度的字号。
            document.querySelectorAll('.sym-custom-row')
                .forEach(strip => this.fitCustomRow(strip));
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
            this.pushChromeColor();
        }

        /** #27 手势条跟主题色：把键盘底色推给壳，native 把 IME 窗口
         * 的导航栏与窗口背景涂成同色——WebView 铺不满手势条的机型
         * （MIUI 实录黑条）不再露出系统黑层。背景图模式推 transparent
         * （CSS 的 bgImage 层自己铺到屏底）。 */
        pushChromeColor() {
            if (typeof Native.setChromeColor !== 'function' || !this.token) return;
            const wallpaper = document.body.dataset.bgImage === 'on';
            const host = document.getElementById('softKeyboard');
            const color = wallpaper || !host ? 'transparent'
                : getComputedStyle(host).backgroundColor;
            try { Native.setChromeColor(color, this.token); } catch (_) { /* bridge absent */ }
        }

        /** 键帽不透明度：只动背景 alpha 变量，键帽文字保持实色。 */
        applyKeyOpacity() {
            const pct = Math.max(0, Math.min(100, Number(this.keyOpacity) || 0));
            document.documentElement.style.setProperty(
                '--key-alpha', String(Math.max(0.05, pct / 100)));
        }

        /** #39 横屏三项：挖孔安全区（键区 padding 让位，背景仍铺满——
         *  同单手模式的 padding 语义）与整体不透明度（含背景，窗口涂层
         *  由 native 侧同步转透明）。只写 CSS 变量；竖屏选择器不生效，
         *  变量残留无害。 */
        applyLandscapeChrome() {
            const root = document.documentElement.style;
            const safe = this.landscapeSafeArea !== false;
            const l = safe ? Math.max(0, Number(this.safeSideL) || 0) : 0;
            const r = safe ? Math.max(0, Number(this.safeSideR) || 0) : 0;
            root.setProperty('--safe-side-l', l + 'px');
            root.setProperty('--safe-side-r', r + 'px');
            const pct = Math.max(10, Math.min(100, Number(this.landscapeOpacity ?? 100)));
            root.setProperty('--kb-landscape-opacity', String(pct / 100));
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
            // 面板打开时收起键暂住在 .panel-head（#33-2）——此刻锚点不在
            // 工具栏里，重排会把工具插进面板头；面板关闭路径自己会对账。
            if (this.panelOpen) return;
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
                    // 让位态（手写候选整行互斥/T9 符号行/联想）优先：
                    // 重唤键盘触发的对账不得把工具插回让位中的候选行。
                    : (this.toolbarYield || composeHidden || overflow.has(dom));
            });
            const mic = document.getElementById('mic');
            // 工具栏 mic 的显隐只跟布局/让位走：长按空格动作是空格键
            // 自己的事（76e3c72 曾把「动作非 voice」机械翻译成藏工具栏
            // mic——设成剪贴板/定制键也藏，1.3.8 用户实测「刚开输入法
            // 图标丢失、过会儿又被布局对账翻回来」，两条路径打架闪烁）。
            if (mic) mic.hidden = this.toolbarYield ||
                (composeHidden && this.voiceState === 'idle');
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
                // 让位态优先（手写候选整行互斥）：溢出对账不得把工具置回。
                if (el) el.hidden = this.toolbarYield || this._overflowTools.has(id);
            });
        }

        enterToolbarEdit() {
            if (this.toolbarEdit || this.composing) return;
            const editor = document.getElementById('toolbarEditor');
            if (!editor) return;
            this.closeOtherViews();
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

        /** 开关型/动作型工具（色彩模式/振动/声音/联想/单手 + 数字键盘/
         *  Emoji 直达）：index.html 没有静态节点，这里动态创建，初始只
         *  待在编辑仓库里，由用户上栏。开关型的点击 = 快捷设置同名 tile
         *  的 toggle、状态用 state-on 底色；动作型直达对应键区视图。 */
        buildToggleTools() {
            const defs = [
                { key: 'theme', id: 'toolTheme', icon: 'theme', label: '色彩模式' },
                { key: 'vibrate', id: 'toolVibrate', icon: 'vibrate', label: '按键振动' },
                { key: 'sound', id: 'toolSound', icon: 'sound', label: '按键声音' },
                { key: 'assoc', id: 'toolAssoc', icon: 'assoc', label: '中文联想' },
                { key: 'onehand', id: 'toolOneHand', icon: 'onehand', label: '单手模式' },
                { key: 'numpad', id: 'toolNumpad', icon: 'numpad', label: '数字键盘' },
                { key: 'emoji', id: 'toolEmoji', icon: 'smiley', label: 'Emoji' },
                { key: 'edit', id: 'editTool', icon: 'edit', label: '编辑工具' },
                { key: 'custom', id: 'toolCustom', icon: 'custom', label: '定制按键' },
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
                    // 动作型（直达键区视图）：等价长按 123 / t9 的笑脸键，
                    // 收起候选组合由 showNumpad 自己的层切换兜底。
                    if (key === 'numpad') {
                        // toggle（验收 2026-09-24）：已在数字键盘再点 = 回字母层。
                        if (this.keyLayer === 'numpad') this.showLetters();
                        else this.showNumpad();
                        return;
                    }
                    // #33 统一 toggle 语义：已在表情视图再点 = 回到之前的字母层。
                    if (key === 'emoji') {
                        if (this.emojiView && this.keyLayer === 'numpad') this.showLetters();
                        else { this.emojiView = true; this.showNumpad(); }
                        return;
                    }
                    // #39-10 编辑工具条：同款 toggle 语义（面板开着再点 = 回键区）。
                    if (key === 'edit') {
                        this.toggleEditPanel();
                        return;
                    }
                    // #39-12 定稿：不做独立面板——按钮直达符号面板的
                    // 定制 tab，与数字/表情一个行为模式（用户裁定）。
                    if (key === 'custom') {
                        if (!this.customKeys()) {
                            this.showToast(t("还没有定制按键，去设置的定制按键里保存"));
                            this.call(() => Native.openSetupPage('customTitle', this.token));
                            return;
                        }
                        // toggle 语义（与 123/编辑工具一致）：已在定制 tab
                        // 再点 = 回主键盘；符号面板的其他 tab 则正常切入。
                        if (this.keyLayer === 'symbols' && this.symbolCat === 'custom') {
                            this.showLetters();
                            return;
                        }
                        this.showSymbols();
                        this.symbolCat = 'custom';
                        document.querySelectorAll('[data-sym-cat]').forEach(el => (
                            el.classList.toggle('active', el.dataset.symCat === 'custom')));
                        this.renderSymbols();
                        // 分类条横滚：把定制 tab 滚进视口，否则用户
                        // 看不到选中态（tab 点击 handler 同款）。
                        const customTab = document.querySelector('[data-sym-cat="custom"]');
                        if (customTab && customTab.scrollIntoView) {
                            customTab.scrollIntoView({ behavior: 'smooth',
                                inline: 'center', block: 'nearest' });
                        }
                        return;
                    }
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
                // #38 直达切换：不再三档循环——开着就关，关着就开到
                // 上次用的侧（无记忆默认右手）。
                this.oneHand = this.qRead('oneHand', this.oneHand) === 0
                    ? this.oneHandSide() : 0;
                this.quickPending['oneHand'] = this.oneHand;
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
         *  容量自动变小）。候选词与工具栏**互斥**（让位机制）：候选显示
         *  时整行归候选、工具全组隐藏；空闲时整行归工具——不存在「给
         *  候选留底」的预算，只扣 F 与收起键（issue #47 复盘修正）。
         *  布局塌陷时（宽度 0）放宽到 8，不挡编辑。 */
        toolbarCapacity() {
            const bar = document.getElementById('candidateBar');
            const setup = document.getElementById('setupButton');
            const hide = document.getElementById('hide');
            if (!bar || !setup || !hide || !bar.clientWidth) return 8;
            const BTN = 32, GAP = 5;
            const avail = bar.clientWidth - setup.offsetWidth - hide.offsetWidth
                - GAP * 2;
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
            // 手写：总高/画布分辨率跟视图几何走（重唤键盘的兜底再推——
            // 高度在收起期间被改过的话，靠 renderMode 的推送接不住）。
            if (this.mode === 'handwriting') this.inkSyncViewport();
        }

        /** native 落盘回执（setKeyboardHeightNow 的 commit 结果）：提示
         *  只在确认写上盘后出现；失败明确告知（codex 终审 P2）。 */
        onHeightSaved(ok) {
            if (this._heightSavedTimer) {
                clearTimeout(this._heightSavedTimer);
                this._heightSavedTimer = null;
            }
            this.showToast(ok ? t("键盘高度已保存") : t("键盘高度保存失败，请重试"));
        }

        /** 书写区几何对账：pad 的 CSS 盒变了（旋转/总高变化/重唤）才重建
         * 画布分辨率。收起期间改过布局再唤起时，renderHandwriting 不重跑
         * （模式没变），这里是唯一按新几何重放笔迹的通道。 */
        inkSyncViewport() {
            const canvas = document.getElementById('inkCanvas');
            if (!canvas) return;
            const rect = typeof canvas.getBoundingClientRect === 'function'
                ? canvas.getBoundingClientRect() : null;
            const key = rect ? [Math.round(rect.width), Math.round(rect.height)].join('x') : '';
            if (!key || key === this._inkViewport) return;
            this._inkViewport = key;
            this.inkResize();
        }

        /** Push a new CONTENT height to the native side. Old bridges (and the
         * preview harness without the native method) fall back to styling the
         * total view height, adding the safe area exactly once. */
        applyKbHeight(content, now) {
            const value = Math.round(Number(content) || 0);
            this.kbHeight = value;
            const view = document.getElementById('softKeyboard');
            if (now && typeof Native.setKeyboardHeightNow === 'function') {
                // 显式保存立即落盘：debounce 窗口内收起键盘会让进程冻结、
                // pending flush 丢失（高度回旧值）。
                this.call(() => Native.setKeyboardHeightNow(value, this.token));
            } else if (typeof Native.setKeyboardHeight === 'function') {
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
            // 手写（竖屏）的下限按面板口径算：chrome + 控制行 + 一块可写
            // 的最小面板，而不是 qwerty 的四行键高。
            const ink = this.mode === 'handwriting' && !this.landscape;
            const chrome = ink ? this.inkChromeHeight() : this.layoutChrome();
            const floor = ink ? 96 : 4 * KB_ROW_MIN;
            // The content floor and the native clamp floor - whichever
            // is taller wins (a 170css landscape pref would squeeze the rows).
            const min = Math.max(chrome + floor, this.heightFloorCss || 0);
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
            this.closeOtherViews();
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
            if (hint) hint.textContent = capped ? t("横屏已达屏幕上限") : t("拖动实时预览，保存后生效");
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
                // 拖动实时预览（round-6 用户拍板，反转旧「no live resize」
                // 规则）：每次 move 直接推高度，native requestLayout 即时
                // 生效、pref 落盘走 native debounce——松手停在预览值，
                // 保存才写 localStorage 镜像，取消还原。
                this.applyKbHeight(this.heightPreview);
                this.placeHeightCard();
            }, { passive: false });
            track.addEventListener('touchend', () => {
                if (!dragging) return;
                dragging = false;
                this.heightEditedLive = true;
                // 松手停在预览值（拖动中已实时应用）；保存/取消语义
                // 由按钮收口。
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
                // 恢复默认也是一次预览（round-6 用户反馈）：键盘立刻变到
                // 默认高度，保存才落地、取消还原。
                this.applyKbHeight(this.heightPreview);
                this.placeHeightCard();
            });
            document.getElementById('heightCardSave').addEventListener('click', () => {
                const content = Math.round(this.heightPreview);
                // applyKbHeight → native setKeyboardHeight persists the pref
                // per orientation; localStorage mirrors it for the preview.
                // 持久化走 native（applyKbHeight → setKeyboardHeight →
                // pref，debounce 落盘）；重置=0 走 native 的清键语义。
                this.applyKbHeight(this.heightResetPending ? 0 : content, true);
                // 「已保存」只在 native commit 回执后出现（onHeightSaved）。
                // 兜底按能力分流（codex 二轮 P2-5）：新壳（height-ack-v1）
                // 超时如实提示未确认、不谎报成功；旧壳无回执能力，800ms
                // 后按旧语义提示成功（请求确实已发出）。
                if (this._heightSavedTimer) clearTimeout(this._heightSavedTimer);
                const hasAck = Array.isArray(this.nativeCaps) &&
                    this.nativeCaps.includes("height-ack-v1");
                this._heightSavedTimer = setTimeout(() => {
                    this._heightSavedTimer = null;
                    this.showToast(hasAck
                        ? t("键盘高度保存未确认，请重试")
                        : t("键盘高度已保存"));
                }, hasAck ? 3000 : 800);
                this.exitHeightEdit();
            });
        }

                /* ===== mode menu ===== */

        toggleModeMenu(anchor) {
            this.closeOtherViews('modeMenu');
            const menu = document.getElementById('modeMenu');
            if (menu.classList.contains('open')) { this.closeModeMenu(); return; }
            menu.replaceChildren();
            this.modeOrder().forEach(name => {
                const config = MODES[name];
                const button = document.createElement('button');
                // strictReady（stroke/手写）：只有 hello 明确给 true 才可
                // 点——旧 APK 的 engineDataReady 不含该字段，宽松判定
                // （!== false）会把缺键当可用，出现可点却无效的入口。
                // 非 strictReady 维持原语义：engine:false 恒可点。
                const ready = config.strictReady
                    ? this.engineReady[name] === true
                    : (!config.engine || this.engineReady[name] !== false);
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
            // 锚点 = 调用方传入的触发键（round-4：手写竖屏键面没有
            // #modeToggle 了，菜单必须能锚在任意触发键上），缺省仍是
            // 中英切换键。
            const anchorEl = anchor || document.getElementById('modeToggle');
            if (!anchorEl) return;
            this.modeMenuAnchor = anchorEl;
            const toggle = anchorEl.getBoundingClientRect();
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
            this.modeMenuAnchor = null;
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
            this.closeOtherViews('settings');
            // The control view owns the key area too - it never
            // coexists with the settings panel. Borrow, don't
            // switch off (closing the panel restores the rows).
            if (this.ctrlView) this.suspendCtrlView();
            // Review P2: opening the quick panel over the editor
            // strip must tear the strip down too, or the input rides on
            // without a keyboard (and keeps the native redirect armed).
            this.clearEditorStrip();
            // The panel reopens on its home page (or the requested
            // sub-page - the custom-row editor returns to 定制符号).
            this.settingsPage = page;
            // 全新打开回第一屏；打开后的 tile 重渲染由 qsPage 保持在当前页。
            this.qsPage = 0;
            this.renderSettingsPanel();
            panel.classList.add('open');
            panel.hidden = false;
            // #33-1：快开面板不再自动插出齿轮（会把用户摆好的图标顶右移
            // 一格）；完整设置入口 = 面板菜单 + 可选的目录齿轮。
            // The panel REPLACES the key area (no overlay) -
            // remember which key layer to restore on close.
            this.settingsReturnLayer = this.keyLayer;
            // keyLayer 反映「当前键区」：抽屉占着键区时数字键盘已不可
            // 见，123 的 toggle 判定不能再命中（否则点 123 会回字母层
            // 而不是进数字键盘）。
            this.keyLayer = 'settings';
            this.hideKeyLayers();
        }

        closeSettingsPanel() {
            const panel = document.getElementById('settingsPanel');
            if (!panel) return;
            if (!panel.classList.contains('open')) return;
            panel.classList.remove('open');
            panel.hidden = true;
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

        /* ===== #39-10 编辑工具条（可选工具栏控件，搜狗「文字编辑」
         * 形态）：替换键区的编辑面板，工具栏保留（再点工具即收）。
         * 动作全部复用现有桥通道——方向键 editorCursor（终端等
         * keyevent-cursor 场景天然兼容）、扩选/行首行尾走 sendCombo
         * （SHIFT+Arrow/Home/End 组合层）、全选复制剪切粘贴
         * editorAction（宿主 context menu 通道）、删除 backspace。 */
        toggleStatsPanel() {
            this.closeOtherViews('stats');
            const layer = document.getElementById('statsLayer');
            if (layer && !layer.hidden) { this.closeStatsPanel(); return; }
            if (this.ctrlView) this.suspendCtrlView();
            this.renderStatsPanel();
            this.statsReturnLayer = this.keyLayer;
            this.keyLayer = 'stats';
            this.hideKeyLayers();
            layer.hidden = false;
            // 工具栏换成标题+✕（body.stats-page 互斥：常规工具/候选条
            // 全让位，面板之外不可能再叠别的界面——用户验收实录）。
            document.body.classList.add('stats-page');
        }

        closeStatsPanel() {
            const layer = document.getElementById('statsLayer');
            if (!layer || layer.hidden) return;
            layer.hidden = true;
            const bar = document.getElementById('statsPageBar');
            if (bar) { bar.hidden = true; bar.replaceChildren(); }
            document.body.classList.remove('stats-page');
            this.showKeyLayer(this.statsReturnLayer || 'letters');
            this.maybeResumeCtrlView();
        }

        /** #41 二轮：统计浮层。数据经 inputStats 桥同步拉全量 JSON。 */
        renderStatsPanel() {
            const layer = document.getElementById('statsLayer');
            if (!layer) return;
            let data = {};
            try {
                const raw = typeof Native.inputStats === 'function'
                    ? Native.inputStats(this.token) : '';
                data = raw ? JSON.parse(raw) : {};
            } catch (error) { data = {}; }
            const total = Number(data.total) || 0;
            const today = Number(data.today) || 0;
            const keystrokes = Number(data.keystrokes) || 0;
            const streak = Number(data.streak) || 0;
            const avgDaily = Number(data.avgDaily) || 0;
            const days = Array.isArray(data.daily) ? data.daily : [];
            const withDays = data.since
                ? Math.max(1, Math.floor((Date.now() - new Date(data.since + 'T00:00:00')) / 86400000) + 1)
                : 1;
            const fmt = n => {
                if (n < 10000) return String(n);
                if (uiLocale === 'en') return Math.round(n / 1000) + 'k';
                return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
            };
            layer.textContent = '';
            const wrap = document.createElement('div');
            wrap.className = 'stats-wrap';
            const el = (cls, html) => {
                const node = document.createElement('div');
                node.className = cls;
                if (html != null) node.innerHTML = html;
                return node;
            };
            // 标题与 ✕ 在工具栏（statsPageBar），键区从 hero 直接开始。
            const bar = document.getElementById('statsPageBar');
            if (bar) {
                bar.replaceChildren();
                const label = document.createElement('span');
                label.className = 'page-title';
                label.textContent = t("输入统计");
                const close = document.createElement('button');
                close.className = 'tool';
                close.textContent = '×';
                close.setAttribute('aria-label', t("收起统计"));
                close.addEventListener('click', () => this.closeStatsPanel());
                bar.append(label, close);
                bar.hidden = false;
            }
            const hero = el('stats-hero');
            hero.append(el('stats-hero-label', t("累计输入")));
            const totalLine = el('stats-total');
            totalLine.id = 'statsTotal';
            const unit = document.createElement('span');
            unit.className = 'stats-total-unit';
            unit.textContent = t("字");
            totalLine.append(unit);
            hero.append(totalLine);
            hero.append(el('stats-sub',
                t("今日") + ' <b>' + today.toLocaleString() + '</b> ' + t("字")
                + ' · ' + t("连续") + ' <b>' + streak + '</b> ' + t("天")));
            wrap.append(hero);
            const cards = el('stats-cards');
            const card = (v, k) => {
                const c = el('stats-card');
                c.append(el('stats-card-v', v), el('stats-card-k', k));
                return c;
            };
            cards.append(
                card(fmt(keystrokes), t("累计击键")),
                card(total > 0 ? (keystrokes / total).toFixed(1) : '—', t("键 / 字")),
                card(fmt(avgDaily), t("日均字数")));
            wrap.append(cards);
            // 近 7 天柱状图（今天高亮；高度按窗口内最大值归一）。
            const DOW = [t("日"), t("一"), t("二"), t("三"), t("四"), t("五"), t("六")];
            const max = Math.max(1, ...days.map(d => Number(d.chars) || 0));
            const bars = el('stats-bars');
            days.forEach((d, i) => {
                const isToday = i === days.length - 1;
                const col = el('stats-bar-col');
                const bar = el('stats-bar' + (isToday ? ' today' : ''));
                bar.style.height = Math.round(Math.max(0.04, (Number(d.chars) || 0) / max) * 100) + '%';
                col.append(bar);
                const dow = el('stats-bar-dow' + (isToday ? ' today' : ''));
                dow.textContent = DOW[new Date(d.date + 'T00:00:00').getDay()];
                col.append(dow);
                bars.append(col);
            });
            wrap.append(bars);
            // 趣味换算：字数类比 + 相伴天数。
            let fun = '';
            if (total >= 800) {
                fun = t("≈") + ' <b>' + Math.round(total / 800) + '</b> ' + t("篇高考作文");
            } else if (total >= 140) {
                fun = t("≈") + ' <b>' + Math.round(total / 140) + '</b> ' + t("条微博");
            } else {
                fun = t("再来") + ' <b>' + (140 - total) + '</b> ' + t("字就是一条微博");
            }
            wrap.append(el('stats-fun', fun + ' · ' + t("与 Feelime 相伴") + ' <b>' + withDays + '</b> ' + t("天")));
            // 里程碑徽章：达成亮起（pop 动画）。
            const badges = el('stats-badges');
            [100, 1000, 10000, 100000, 1000000].forEach(m => {
                const b = el('stats-badge' + (total >= m ? ' earned' : ''));
                b.append(el('dot'));
                const label = document.createElement('span');
                label.textContent = m >= 10000 ? fmt(m) : String(m);
                b.append(label);
                badges.append(b);
            });
            wrap.append(badges);
            layer.append(wrap);
            // 入场动画：柱状图生长 + 徽章 pop + 大数字滚动。无 rAF 的
            // 环境（Node mock）直接落终态，同步递归会炸栈。
            const raf = typeof requestAnimationFrame === 'function'
                ? requestAnimationFrame.bind(globalThis) : null;
            if (raf) raf(() => raf(() => wrap.classList.add('grown')));
            else wrap.classList.add('grown');
            this.countUp(layer.querySelector('#statsTotal'), total, unit, raf);
        }

        /** 大数字滚动（ease-out ~0.9s；键盘可见时 rAF 正常跑）。 */
        countUp(node, target, unitNode, raf) {
            if (!node) return;
            if (!(target > 0)) {
                node.textContent = '0';
                if (unitNode) node.append(unitNode);
                return;
            }
            if (!raf) {
                node.textContent = target.toLocaleString();
                if (unitNode) node.append(unitNode);
                return;
            }
            const start = Date.now();
            const step = () => {
                const p = Math.min(1, (Date.now() - start) / 900);
                const eased = 1 - Math.pow(1 - p, 3);
                node.textContent = Math.round(target * eased).toLocaleString();
                if (p < 1) raf(step);
                else if (unitNode) node.append(unitNode);
            };
            raf(step);
        }

        toggleEditPanel() {
            this.closeOtherViews('edit');
            const layer = document.getElementById('editLayer');
            if (layer && !layer.hidden) { this.closeEditPanel(); return; }
            this.closeModeMenu();
            this.closeSettingsPanel();
            if (this.panelOpen) this.closePanel();
            // 编辑面板借用键区：ctrl 视图与编辑条让位（借不是关，
            // 收面板时 maybeResumeCtrlView 归还）。
            if (this.ctrlView) this.suspendCtrlView();
            this.clearEditorStrip();
            this.editSelecting = false;
            this.renderEditPanel();
            // 同 settingsPanel：记住被替换的键层，关闭时原样归还。
            this.editReturnLayer = this.keyLayer;
            this.keyLayer = 'edit';
            this.hideKeyLayers();
            layer.hidden = false;
        }

        closeEditPanel() {
            const layer = document.getElementById('editLayer');
            if (!layer || layer.hidden) return;
            layer.hidden = true;
            this.editSelecting = false;
            this.showKeyLayer(this.editReturnLayer || 'letters');
            this.maybeResumeCtrlView();
        }

        renderEditPanel() {
            const layer = document.getElementById('editLayer');
            if (!layer) return;
            const grid = document.createElement('div');
            grid.className = 'edit-grid';
            const cell = (edit, label, opts = {}) => {
                const b = document.createElement('button');
                b.className = 'kb-key kb-special' + (opts.word ? ' edit-word' : '');
                b.dataset.edit = edit;
                if (opts.arrow) b.dataset.arrow = edit;
                b.textContent = label;
                if (opts.aria) {
                    b.setAttribute('aria-label', t(opts.aria));
                    b.setAttribute('data-i18n-aria-label', opts.aria);
                }
                b.addEventListener('touchstart', () => {
                    b.classList.add('active-touch');
                }, { passive: true });
                const lift = () => b.classList.remove('active-touch');
                b.addEventListener('touchend', lift);
                b.addEventListener('touchcancel', lift);
                grid.append(b);
                return b;
            };
            // 布局照搜狗参照：↑ 跨三列；← 扩选 →；↓ 跨三列；
            // 底行 行首|全选|行尾；第四列 删除/复制/剪切/粘贴。
            cell('up', '↑', { arrow: true, aria: '光标上移' });
            cell('left', '←', { arrow: true, aria: '光标左移' });
            const sel = cell('sel', t("选择"), { aria: '选择' });
            cell('right', '→', { arrow: true, aria: '光标右移' });
            cell('down', '↓', { arrow: true, aria: '光标下移' });
            cell('home', '|←', { aria: '光标到行首' });
            cell('all', t("全选"), { word: true, aria: '全选' });
            cell('end', '→|', { aria: '光标到行尾' });
            cell('del', t("删除"), { word: true, aria: '删除' });
            cell('copy', t("复制"), { word: true, aria: '复制' });
            cell('cut', t("剪切"), { word: true, aria: '剪切' });
            cell('paste', t("粘贴"), { word: true, aria: '粘贴' });

            const cursor = way => {
                // 扩选态走组合层（SHIFT+方向），普通态 editorCursor
                // （与侧边条/终端 cursor 语义同源；旧壳缺该桥时回落
                // 无 meta 的组合层，keyEvent 通道很早就有）。
                if (this.editSelecting) {
                    this.sendCombo(['Shift', {
                        up: 'ArrowUp', down: 'ArrowDown',
                        left: 'ArrowLeft', right: 'ArrowRight',
                    }[way]]);
                } else if (typeof Native.editorCursor === 'function') {
                    this.call(() => Native.editorCursor(way, this.token));
                } else {
                    this.sendCombo([{
                        up: 'ArrowUp', down: 'ArrowDown',
                        left: 'ArrowLeft', right: 'ArrowRight',
                    }[way]]);
                }
            };
            const bind = (edit, handler) => {
                const el = grid.querySelector(`[data-edit="${edit}"]`);
                el.addEventListener('click', handler);
            };
            bind('up', () => cursor('up'));
            bind('down', () => cursor('down'));
            bind('left', () => cursor('left'));
            bind('right', () => cursor('right'));
            // 行首/行尾：扩选态同样带 SHIFT（扩到行首/行尾）。
            bind('home', () => this.sendCombo(this.editSelecting ? ['Shift', 'Home'] : ['Home']));
            bind('end', () => this.sendCombo(this.editSelecting ? ['Shift', 'End'] : ['End']));
            bind('all', () => this.call(() => Native.editorAction('selectAll', this.token)));
            // 右列动作执行完即解除选择锁定（验收反馈）：对选中内容的
            // 操作是选择流程的终点，保持锁定反而让后续方向键意外扩选。
            const disarm = () => {
                this.editSelecting = false;
                sel.classList.remove('armed');
            };
            bind('del', () => { this.call(() => Native.backspace(this.token)); disarm(); });
            bind('copy', () => { this.call(() => Native.editorAction('copy', this.token)); disarm(); });
            bind('cut', () => { this.call(() => Native.editorAction('cut', this.token)); disarm(); });
            bind('paste', () => { this.call(() => Native.editorAction('paste', this.token)); disarm(); });
            // 选择 toggle：点亮后方向键/行首行尾带 SHIFT。
            sel.addEventListener('click', () => {
                this.editSelecting = !this.editSelecting;
                sel.classList.toggle('armed', this.editSelecting);
            });

            layer.replaceChildren(grid);
        }

        /** Quick settings sub-pages: only the custom-row editor's
         * return landing (定制符号) is left - the quick-switch and
         * long-press-menu pages were superseded by tile deep-links into
         * the settings app (3.59.6) and removed. */
        renderSettingsPanel(page = this.settingsPage) {
            const panel = document.getElementById('settingsPanel');
            panel.replaceChildren();
            if (page) {
                // The sub-page header rides the TOOLBAR (left:
                // back + title, right: close) instead of its own row.
                this.showSettingsPageBar(page === 'custom' ? t("定制按键") : '');
            } else {
                this.hideSettingsPageBar();
            }
            if (page === 'custom') this.renderCustomPage(panel);
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
            // 长按直达设置行（用户验收三轮）：def.hold = 设置页行锚 id，
            // 与 tile 点击深链共用 openSetupPage→focusSetting 通道。
            if (def.hold) {
                let holdTimer = null;
                const holdMs = Number(this.holdMs) > 0 ? Number(this.holdMs) : 450;
                tile.addEventListener('touchstart', () => {
                    holdTimer = setTimeout(() => {
                        holdTimer = null;
                        this.closeSettingsPanel();
                        this.call(() => Native.openSetupPage(def.hold, this.token));
                    }, holdMs);
                }, { passive: true });
                const cancel = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
                tile.addEventListener('touchmove', cancel, { passive: true });
                tile.addEventListener('touchend', cancel);
                tile.addEventListener('touchcancel', cancel);
            }
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
        /** 单手直达切换（#38）记忆的侧：1=左 2=右；无记忆默认右手。
         *  native 记忆（hello 下发）优先——设置页选侧时键盘 WebView 可能
         *  根本没创建，localStorage 永远不更新（codex P2-3）。 */
        oneHandSide() {
            if (this.oneHandSideMemory === 1 || this.oneHandSideMemory === 2) {
                return this.oneHandSideMemory;
            }
            const v = Number(localStorage.getItem('feelime_onehand_side'));
            return v === 1 || v === 2 ? v : 2;
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
            const snapText = { 0: t("松"), 1: t("标准"), 2: t("紧") };
            // #42 候选字号改为 80-150% 连续值：tile 点按按 10% 步进循环。
            const CAND_STEPS = [80, 90, 100, 110, 120, 130, 140, 150];
            const oneHandText = { 0: t("关"), 1: t("左手"), 2: t("右手") };
            const themeTheme = () => this.themeMode || 'auto';
            const rehome = () => {
                if (this.settingsPage === null) this.renderSettingsPanel();
            };
            const customRows = this.customKeys();
            return [
                    {
                        icon: ICONS.theme, label: t("色彩模式"), hold: 'themeMode',
                        state: () => themeText[themeTheme()] || themeText.auto,
                        tap: () => {
                            this.cycleThemeNative();
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.assoc, label: t("中文联想"), hold: 'associationOn',
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
                        icon: ICONS.sound, label: t("按键声音"), hold: 'keySound',
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
                        icon: ICONS.vibrate, label: t("按键振动"), hold: 'keyHaptic',
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
                        icon: ICONS.height, label: t("键盘高度"), hold: 'kbHeight', state: () => t("调节"),
                        tap: () => this.enterHeightEdit(),
                    },
                    {
                        // #41 二轮：输入统计（键盘区浮层，含动画与换算）。
                        icon: ICONS.stats, label: t("输入统计"),
                        state: () => t("查看"),
                        tap: () => { this.toggleStatsPanel(); rehome(); },
                    },
                    {
                        icon: ICONS.swap, label: t("快捷切换"),
                        state: () => this.quickPair.map(m => modeLabel(m)).join(' · '),
                        // 验收 2026-09-24 二改：tile 直达完整设置的「对应设置
                        // 行」（quickPairA=快捷切换对），不再只落卡级；锚定
                        // 与呼吸灯由设置页 focusSetting 统一处理。
                        tap: () => { this.closeSettingsPanel(); this.call(() => Native.openSetupPage('quickPairA', this.token)); },
                    },
                    {
                        icon: ICONS.menu, label: t("长按菜单"),
                        state: () => t("{0} 个键盘", this.menuModes().length),
                        // menuModesRow=「长按菜单里列出哪些键盘」设置行。
                        tap: () => { this.closeSettingsPanel(); this.call(() => Native.openSetupPage('menuModesRow', this.token)); },
                    },
                    {
                        icon: ICONS.font, label: t("候选字号"), hold: 'candidateFont',
                        state: () => `${this.qRead('candidateFont', this.candidateFont)}%`,
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.candidateFont = this.qStep('candidateFont', CAND_STEPS, this.candidateFont);
                            this.applyCandidateFont();
                            quickPref('candidateFont', this.candidateFont);
                            rehome();
                        },
                    },
                    {
                        // 单手模式（issue #15 起，#38 改直达）：单击 = 开
                        // （上次用的侧，无记忆右手）/关，不再三档循环；
                        // 侧在长按设置行或设置 App 里选。tile 状态行常显
                        // 当前模式（qRead 回读，含未决意图）。
                        icon: ICONS.onehand, label: t("单手模式"), hold: 'oneHand',
                        state: () => oneHandText[this.qRead('oneHand', this.oneHand)] || oneHandText[0],
                        on: () => (this.qRead('oneHand', this.oneHand) || 0) !== 0,
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.oneHand = this.qRead('oneHand', this.oneHand) === 0
                                ? this.oneHandSide() : 0;
                            this.quickPending['oneHand'] = this.oneHand;
                            this.applyOneHand();
                            quickPref('oneHand', this.oneHand);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.pad, label: t("底部留白"), hold: 'bottomPadPortrait',
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
                        icon: ICONS.timer, label: t("长按时长"), hold: 'holdMs',
                        state: () => (Number(this.qRead('holdMs', this.holdMs)) || 350) + 'ms',
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.holdMs = this.qStep('holdMs', [200, 300, 350, 450, 600], Number(this.holdMs) || 350);
                            quickPref('holdMs', this.holdMs);
                            rehome();
                        },
                    },
                    {
                        icon: ICONS.snap, label: t("滑动选字"), hold: 'scrubSpeed',
                        state: () => snapText[this.qRead('popupSnap', this.popupSnap)] || snapText[1],
                        tap: () => {
                            if (typeof Native.setQuickPref !== 'function') return;
                            this.popupSnap = this.qStep('popupSnap', [0, 1, 2], this.popupSnap);
                            quickPref('popupSnap', this.popupSnap);
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
                t("span=宽键倍数（1-3，可选），color=键面颜色（blue/green/orange/red/purple，可选），[backspace]=退格，") +
                t("align=行对齐（left/center/right，可选，挂行内任意键）。note=长按说明。超宽的行可以左右拖动查看。");
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
            edit.setAttribute('aria-label', t("粘贴 JSON 定制符号"));
            edit.addEventListener('click', () => this.openCustomJsonEditor());
            const template = document.createElement('button');
            template.className = 'set-opt set-nav';
            template.textContent = t("插入模板 ›");
            template.setAttribute('aria-label', t("插入定制模板"));
            template.addEventListener('click', () => this.openCustomJsonEditor(CUSTOM_TEMPLATE));
            // #29-8：官方说明文档（格式/tap 语法/示例），native 只认内置地址。
            const docs = document.createElement('button');
            docs.className = 'set-opt set-nav';
            docs.textContent = t("查看说明 ›");
            docs.setAttribute('aria-label', t("查看定制符号说明"));
            docs.addEventListener('click', () => {
                if (typeof Native.openDocs === 'function') this.call(() => Native.openDocs(this.token));
            });
            actions.append(edit, template, docs);
            box.append(status, actions);
            panel.append(box);
        }

        /** Edit the whole custom table as JSON in the shared
         * editor strip (textarea; system paste works there). */
        openCustomJsonEditor(prefill = null) {
            this.editorReturn = 'custom';
            this.customEditRow = null;
            const current = this.customKeys();
            // 空表预填默认例子（含退格/宽键/颜色演示），改完存盘即生效。
            const rows = current || JSON.parse(CUSTOM_TEMPLATE).rows;
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
            // enabled - not everyone wants fr/ru/ja there. Default set
            // (round-6): En/全拼/双拼/九宫格/笔画；手写是实验性能力
            //（识别率有限，issue #28/#32），要用户主动勾选才进菜单。
            // The quick toggle always reaches the pair regardless.
            let menu = null;
            try { menu = JSON.parse(localStorage.getItem('feelime_menu_modes') || 'null'); } catch (_) {}
            if (Array.isArray(menu)) {
                const filtered = ordered.filter(name => menu.includes(name));
                if (filtered.length) return filtered;
            }
            const enabled = ordered.filter(name => DEFAULT_MENU_MODES.includes(name));
            return enabled.length ? enabled : ordered;
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
                !String(candidate.id).startsWith('dyn:') &&
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
            // 池前缀 id 签名 → 见池组装后的计算（须按最终展示序）。
            const raw = (this.lastRawInput || '').replace(/ /g, '').toLowerCase();
            const engineTexts = new Set(engine.map(candidate => candidate.text));
            // 动态日期时间候选（dyn:）：引擎不会给出这些文本，但拼音码
            // （xingqi → 星期日）撞词时去重，避免同文双格。设置开关关掉
            // 时整体不注入（date/time/week 与拼音码一起停）。
            const dyn = (raw && this.dynamicDateTimeOn !== false
                ? dynamicCandidatesFor(raw, this.mode) : [])
                .filter(item => !engineTexts.has(item.text));
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
            // 仅首字符（用户 2026-10-07 反馈）：选拼重音的快捷条只在刚打
            // 完第一个字母时有意义，组合一长就被引擎折叠候选覆盖，留着
            // 只是挤占词格。
            const variants = [];
            if (raw && raw.length === 1) {
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
                ...dyn.filter(item => item.head),
                ...engine.slice(0, 1),
                ...variants,
                ...dyn.filter(item => !item.head),
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
            // 池前缀 id 签名变了 → 展开区增量水位线与新顺序错位（会漏项/
            // 重复），标记让 accumulateCandidates 全量重绘。签名必须覆盖
            // 「已渲染」的整段前缀（取 max(expandRendered, 3)）——句子压后
            // 发生在池中部时只看前 3 项发现不了（codex 评审 P1 复现：翻页
            // 后「二」漏绘、「才丿」重复）；纯追加不动已有顺序时不触发，
            // 保留拖动预载的增量渲染。签名按最终展示序（英文位置重排后）
            // 计算：重排改写展示前缀时同样必须触发全量重绘（codex R2-P1
            // 复现：追加页带来英文，候选条第 1 位是英文、展开区却漏英文
            // 重复中文——旧签名读原始引擎序，感知不到重排变化）。
            const ordered = this.englishOrderedPool(pool);
            const prefixSig = ordered.slice(0, Math.max(this.expandRendered, 3))
                .map(candidate => candidate.id).join('|');
            if (prefixSig !== this.symbolicPrefixSig) {
                this.symbolicPrefixSig = prefixSig;
                this.symbolicPrefixChanged = true;
            }
        }

        /** Single pick funnel for pool entries: engine ids ride the engine
         * channel; overlay entries (favorites, dynamic date/time dyn:)
         * clear the composition and commit;
         * accent variants swap the first character and KEEP the
         * composition alive - pick é on "ete" and it becomes "éte",
         * still composing (iOS-style, via the atomic setComposition). */
        choosePoolCandidate(candidate) {
            // 法语大小写循环：变形提交绕过引擎 Choose（引擎提交原词+空格，
            // 替换不了文本）；clearComposing + commitText 同 dyn:/fav: 通道，
            // 尾空格与引擎 Choose 的提交形态一致。
            if (this.mode === 'french' && this.caseMode && this.composing &&
                candidate && !String(candidate.id).startsWith('alt:')) {
                const text = this.caseifyText(candidate.text);
                if (text !== candidate.text) {
                    this.call(() => Native.clearComposing(this.token));
                    this.call(() => Native.commitText(text + ' ', this.token));
                    return;
                }
            }
            if (candidate && String(candidate.id).startsWith('dyn:')) {
                this.call(() => Native.clearComposing(this.token));
                this.call(() => Native.commitText(candidate.text, this.token));
                return;
            }
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
            // 与首屏渲染（renderExpanded）同视角：追加页也按英文位置
            // 重排后的池算，否则候选条第 1 位是英文、展开区追加页却按
            // 原始顺序冒出中文（codex P1：展示与确认必须共用同一排序）。
            const ordered = this.englishOrderedPool(this.expandCandidates || []);
            const visible = ordered.filter(candidate =>
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

        /** #29 英文词候选位置（用户验收三轮）：auto=-1（引擎有中文候选
         *  第 3、没有则自然第 1），或固定 1/3/5。渲染层重排——rime 侧
         *  stabledb 词条权重不参与与主词典的组间排序（实测 0/1/-99 同位），
         *  位置控制只能在这层做；空格确认与点击都按重排后的池头（空格
         *  本来就走 choosePoolCandidate 解耦分页，共用同一视图即一致）。
         *  auto 的冲突判定用统一规则「池里有没有中文候选」——不看键序
         *  能否切成全拼音节（双拼 ui=shi 在全拼音节表下误判无冲突，
         *  英文占了第一位；各双拼方案映射不同，音节表预判永远追不平，
         *  引擎真值天然适配全拼/双拼/模糊音/自造词）。 */
        englishOrderedPool(pool) {
            const pos = Number(this.englishPos);
            if (!Array.isArray(pool) || !pool.length || pos === 0) return pool;
            // 只在中文输入模式重排：法语/俄语的 accent 变体池头是 ASCII
            // 形态（ete），混进来会顶掉引擎头（mock 法语用例实录）。
            if (!['pinyin', 'double-pinyin', 't9', 'stroke'].includes(this.mode)) return pool;
            const isEnglish = t => typeof t === 'string' && t.length >= 2 &&
                t.length <= 20 && /^[A-Za-z][A-Za-z0-9]*$/.test(t);
            const english = [];
            const rest = [];
            pool.forEach(item => {
                (isEnglish(item && item.text) ? english : rest).push(item);
            });
            if (!english.length || !rest.length) return pool;
            // 目标位：固定档直接用；auto 到这里 rest 必非空（无中文候选
            // 的池在上面原样返回，英文自然第一）= 有候选抢位 → 第 3。
            const target = pos > 0 ? pos : 3;
            const out = rest.slice();
            english.forEach((item, i) => {
                const at = Math.min(out.length, Math.max(0, target - 1 + i));
                out.splice(at, 0, item);
            });
            return out;
        }

        renderCandidates(state) {
            // Variant replay bursts intermediate events: freeze the bar like
            // the grid (the replay's target echo repaints it).
            if (this.variantReplaying) return;
            // 手写（issue #28）：候选来自识别结果而非引擎池。整条自持——
            // 按键通道（退格/空格）的空引擎事件不得把未点选的识别候选
            // 洗掉；点选/清笔迹/离开模式时由 inkReset 收走。
            if (this.mode === 'handwriting') {
                const inkBar = document.getElementById('candidates');
                const inkHeld = inkBar.scrollLeft || 0;
                inkBar.replaceChildren();
                // 识别候选优先；点选上屏后（笔迹已清）native 推来的联想
                // 词接手同一条 bar——早先版本在这条分支里只认识别候选并
                // 提前返回，onAssoc 推来的词被整条吞掉（round-3 修复：
                // 用户反馈「手写联想没生效」的根因，mock 复现
                // assoc-after-ink-pick）。
                const ink = this.inkCandidates || [];
                const source = ink.length ? ink : (this.assocWords || []).map(word => ({
                    id: `assoc:${word}`, text: word, assoc: true }));
                source.forEach((candidate, index) => {
                    const button = document.createElement('button');
                    button.className = candidate.assoc ? 'candidate assoc'
                        : (index === 0 ? 'candidate first' : 'candidate');
                    button.textContent = candidate.text;
                    button.addEventListener('click', () => (candidate.assoc
                        ? this.commitAssocWord(candidate.text)
                        : this.commitInkCandidate(candidate)));
                    // Native clicks only：bindTouch 会 preventDefault
                    // touchstart，正好抵掉横向拖动的取消（同引擎候选条）。
                    button.addEventListener('mousedown', event => event.preventDefault());
                    inkBar.append(button);
                });
                inkBar.scrollLeft = inkHeld;
                // 互斥态（整行替换工具栏）跟候选走，每次重渲染都对账。
                this.applyInkBarChrome();
                return;
            }
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
            this.englishOrderedPool(this.expandCandidates || []).forEach((candidate, index) => {
                const button = document.createElement('button');
                button.className = index === 0 ? 'candidate first' : 'candidate';
                button.textContent = this.mode === 'french' && this.caseMode && state.composing
                    ? this.caseifyText(candidate.text) : candidate.text;
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
            // 组合结束即撤法语大小写循环（连同 shift 键指示）。
            if (wasComposing && !this.composing && this.caseMode) {
                this.caseMode = null;
                this.updateCaseKeyVisual();
            }
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
            // 手写让位态（#39-6 复发修复）× 是行内唯一出口，通用规则
            // 不得把它翻没（与收起键同款复核）。
            const voiceBusy = recording;
            document.getElementById('composeClear').hidden =
                (!this.composing &&
                    !(this.mode === 'handwriting' && !!this.inkBarActive)) || voiceBusy;
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
            // 同 auditToolbarTools：不再耦合长按空格动作（用户反馈
            // 1.3.8 丢图标的另一半触发点——本行在候选渲染高频路径上）。
            if (mic) mic.hidden =
                (this.composing && !recording);
            // 手写候选态的整行互斥要压过上面 mic/工具的通用可见性规则：
            // 引擎回声（commitText 后的空事件等）不得把工具栏插回候选行。
            if (this.mode === 'handwriting') this.applyInkBarChrome();
            // While composing the right side carries exactly two
            // buttons (× and ˅). The keyboard-dismiss chevron looks identical
            // to the expand arrow - hide it until the composition ends.
            // 手写让位态（#39-6 复发修复）同样藏收起键：applyInkBarChrome
            // 先行设置，此处按 inkBarActive 复核，防本行把让位翻回去。
            document.getElementById('hide').hidden = this.composing ||
                (this.mode === 'handwriting' && !!this.inkBarActive);
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
            const want = tab === 'favorites' ? 'favorites' : 'clipboard';
            this.panelTab = want;
            this.panelOpen = true;
            // 打开/切换面板时撤掉「清空」可能残留的确认态。
            this.armPanelClear(false);
            // Remember the layer to restore on close (panel can open from the
            // symbol layer too). #39-5 互斥：数字/表情/符号视图被剪贴板
            // /常用语面板顶掉——关面板回字母层，不再层层套娃（用户实录
            // ：开表情→开剪贴板→要逐层关两次才回字母）。
            this.panelReturnLayer = this.keyLayer === 'letters' ? this.keyLayer : 'letters';
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
            // EXCEPT while the floating phrase card is open: the panel
            // then acts as the card's content picker (验收反馈) - the card
            // and its input redirect must survive the tab switch, and
            // item taps fill the card's 常用内容 field instead of
            // committing to the editor.
            if (!this.phraseCardOpen()) this.clearEditorStrip();
            this.closeItemMenu();
            // 互斥统一走注册表（#39-12 收口）。
            this.closeOtherViews('panel');
            // The panel REPLACES the toolbar row instead of adding
            // another line to the keyboard - its own head carries the tabs.
            document.getElementById('candidateBar').hidden = true;
            // #39-4 定稿（用户验收 2026-09-27）：面板头不携带工具栏图标
            // ——tab 本身就是剪贴板/常用语的切换器，右侧只留一个 X
            // （panelClose）回主键盘。曾试过「接管右组按钮原位渲染」，
            // 会把语音输入等无关图标一并带进面板头，否决。
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
            // 「清空」若停在确认态一并撤下，重开面板不能仍挂在确认态。
            this.armPanelClear(false);
            // 编辑卡还开着时面板只是取材完毕回键盘：卡的输入重定向
            // （setPanelInput）继续有效，不能在这里释放。
            if (this.settingsInputFocus && !this.phraseCardOpen()) this.setPanelInput(false);
            this.panelOpen = false;
            document.getElementById('panelLayer').hidden = true;
            document.getElementById('candidateBar').hidden = false;
            // 收尾对账：面板期间任何路径动过工具栏都在这里归位。用
            // audit 而非裸 apply：组合中收起面板时 prune 不认
            // composing，会把 updateComposing 刚藏掉的工具又点亮。
            this.auditToolbarTools();
            this.showKeyLayer(this.panelReturnLayer || 'letters');
            // The panel only borrowed the bar from the ctrl
            // view - hand the rows back if the switch is still on.
            this.maybeResumeCtrlView();
        }

        /** 面板头「清空」的两击确认态（#39）：on=红字「确认清空」并起
         * 3s 定时，超时自动撤；off=恢复文案与样式。WebView 无原生
         * confirm（WebChromeClient 未挂 onJsConfirm），确认只能自建。 */
        armPanelClear(on) {
            const btn = document.getElementById('panelClear');
            clearTimeout(this.panelClearTimer);
            this.panelClearTimer = null;
            if (on) {
                this.panelClearTimer = setTimeout(() => this.armPanelClear(false), 3000);
                btn.classList.add('danger');
                btn.textContent = t("确认清空");
            } else {
                btn.classList.remove('danger');
                btn.textContent = t("清空");
            }
        }

        renderPanel() {            const list = document.getElementById('panelList');
            const empty = document.getElementById('panelEmpty');
            list.replaceChildren();
            const layer = document.getElementById('panelLayer');
            const items = this.panelTab === 'clipboard' ? this.clipboardItems : this.favoriteItems;
            empty.hidden = items.length > 0;
            // 空态不铺整块列表背景（验收反馈）：列表收起、提示只占一行，
            // 其余空间透出键盘背景，不再是一大块空面板。
            if (items.length) delete layer.dataset.empty;
            else layer.dataset.empty = '1';
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
                    // 编辑卡开着时面板是取材区：条目填充进「常用内容」
                    // 输入框而不是上屏（验收反馈 #19 的第三版语义）。
                    if (this.phraseCardOpen()) {
                        this.fillPhraseCardFromPanel(item.text);
                        return;
                    }
                    // 粘贴不是「输入」：面板条目走独立通道不进 #41 统计
                    // （issue #44）。旧 APK 无此桥方法，退回计数通道。
                    this.call(() => {
                        if (typeof Native.pasteText !== 'function') {
                            Native.commitText(item.text, this.token);
                        } else {
                            Native.pasteText(item.text, this.token);
                        }
                    });
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
        /** The floating phrase card is mid-edit (add or update) - panel
         * items then act as its content picker instead of committing. */
        phraseCardOpen() {
            return document.getElementById('phraseCard').classList.contains('open');
        }

        /** Fill the phrase card's 常用内容 field from a panel item
         * (clipboard history / favorites), then close the panel back to
         * the keyboard - the card stays open for the code/rank steps.
         * Mirrors the retired paste button: 200-char cap with a toast. */
        fillPhraseCardFromPanel(text) {
            const input = document.getElementById('phraseCardInput');
            if (!input) return;
            const value = String(text);
            input.value = [...value].slice(0, 200).join('');
            this.rememberPanelSelection(input);
            this.reportPanelSelection();
            if ([...value].length > 200) this.showToast(t("已截断至 200 字"));
            this.closePanel();
            input.focus();
        }

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
            // codex P2：编辑卡接管期间面板已隐藏，panelOpen 同步归零
            // ——hello 的 toolbar audit 不被 panelOpen 早退挡住，
            // closePanelEditor 尾部的 openPanel('favorites') 正常重开。
            this.panelOpen = false;
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
            // overlay 条目（fav:/dyn:/alt:）不在引擎词库里——删自造词的
            // seek 拿这些 id 只会假动作（菜单/确认框都误导），不挂长按。
            if (/^(fav|dyn|alt):/.test(String(candidate.id))) return;
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
            // 高度回写覆盖（真机实录 2026-09-27 ace）：弹出早期 hello 未达
            // 时，applyModeHeight 拿不到 native 存值、按默认 272 回推
            // setKeyboardHeight 桥，debounce 把默认值写回 pref——用户刚保存
            // 的高度被无声覆盖（「保存→收起→弹出回旧值」的真凶之一）。
            // hello 到达前一切「按 stored 回推高度」的路径一律不执行。
            this.helloSeen = true;
            // 高度保存回执能力（codex 二轮 P2-5）：新壳才有 onHeightSaved
            // 回执——保存提示的兜底策略按能力分流（见保存按钮 handler）。
            this.nativeCaps = provided;
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
            // Candidate text scale (issue #42): 80-150 %. Legacy 0/1/2
            // levels (pre-#42 APKs) map onto the new scale.
            {
                const cf = Number(payload.candidateFont);
                if (cf >= 80 && cf <= 150) this.candidateFont = cf;
                else if (cf === 0) this.candidateFont = 100;
                else if (cf === 1) this.candidateFont = 120;
                else if (cf === 2) this.candidateFont = 135;
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
            // 单手侧记忆（#38 codex P2-3）：native 是真相源（设置页选侧/
            // tile 上推都写它），0=未记忆回落 localStorage，再回落右手。
            if (Number(payload.oneHandSide) in { 1: 1, 2: 1 }) {
                this.oneHandSideMemory = Number(payload.oneHandSide);
            }
            // 2 是废除的「自定义侧边图」档，按空白处理（防旧 pref 直漏）。
            const side = Number(payload.sideContent);
            if (side === 0 || side === 1) this.sideContent = side;
            else if (side === 2) this.sideContent = 1;
            if (typeof payload.bgImageLight === 'string') this.bgImageLight = payload.bgImageLight;
            if (typeof payload.bgImageDark === 'string') this.bgImageDark = payload.bgImageDark;
            const opacity = Number(payload.keyOpacity);
            if (opacity >= 0 && opacity <= 100) this.keyOpacity = opacity;
            // #39 横屏：安全区开关/挖孔 insets/整体不透明度。
            if (typeof payload.landscapeSafeArea === 'boolean') {
                this.landscapeSafeArea = payload.landscapeSafeArea;
            }
            this.safeSideL = Math.max(0, Number(payload.safeSideL) || 0);
            this.safeSideR = Math.max(0, Number(payload.safeSideR) || 0);
            const landOpacity = Number(payload.landscapeOpacity);
            if (landOpacity >= 10 && landOpacity <= 100) this.landscapeOpacity = landOpacity;
            if (typeof payload.keyBubble === 'boolean') this.keyBubble = payload.keyBubble;
            const lingerMs = Number(payload.bubbleLinger);
            if (lingerMs >= 0) this.bubbleLinger = lingerMs;
            this.applyOneHand();
            this.applyBackground();
            this.applyKeyOpacity();
            this.applyLandscapeChrome();
            // #31 预置色调：native pref 经 hello 下发，html[data-preset]
            // 驱动 CSS 覆盖（classic = 清掉 dataset 回默认绿）。
            {
                const preset = typeof payload.themePreset === 'string' ? payload.themePreset : '';
                if (THEME_PRESETS.includes(preset) && preset !== 'classic') {
                    document.documentElement.dataset.preset = preset;
                } else {
                    delete document.documentElement.dataset.preset;
                }
            }
            // #31 色相滑条：自定义 hue（0-360）经 hello 下发，内联
            // --kb-hue 胜过 data-preset 的属性选择器（全套令牌由 CSS 侧
            // hsl 派生）；-1/缺省 = 未自定义，清内联回到预置/默认 160。
            {
                const hue = Number(payload.themeHue);
                if (Number.isFinite(hue) && hue >= 0 && hue <= 360) {
                    document.documentElement.style.setProperty('--kb-hue', String(Math.round(hue)));
                } else {
                    document.documentElement.style.removeProperty('--kb-hue');
                }
                // 饱和度（黑白灰滑块，用户验收二轮）：100=全彩默认。
                this.englishPos = [ -1, 1, 3, 5 ].includes(Number(payload.englishPos))
                    ? Number(payload.englishPos) : -1;
                // 皮肤双组（用户验收四轮）：键面组独立，-1=继承背景
                // （饱和度继承标记同样为 -1：100 是显式全彩，灰背景+
                // 全彩键面要能表达，codex P1）。
                const kh = Number(payload.keyHue);
                if (Number.isFinite(kh) && kh >= 0 && kh <= 360) {
                    document.documentElement.style.setProperty('--key-hue', String(Math.round(kh)));
                } else {
                    document.documentElement.style.removeProperty('--key-hue');
                }
                const ks = Number(payload.keySat);
                if (Number.isFinite(ks) && ks >= 0 && ks <= 100) {
                    document.documentElement.style.setProperty('--key-sat', String(ks / 100));
                } else {
                    document.documentElement.style.removeProperty('--key-sat');
                }
                const sat = Number(payload.themeSat);
                if (Number.isFinite(sat) && sat >= 0 && sat <= 100) {
                    document.documentElement.style.setProperty('--kb-sat', String(sat / 100));
                } else {
                    document.documentElement.style.removeProperty('--kb-sat');
                }
                // hue 变了背景色跟着变：#27 手势条涂色要重推。
                this.pushChromeColor();
            }
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
            // 联想让位态退格清联想（issue #46）。
            this.backspaceAssocOn = !!payload.backspaceAssocOn;
            // 万象 / 键功能引导（issue #45）。
            this.wxSlashOn = !!payload.wxSlashOn;
            // 日期时间候选开关：native 默认开，旧 APK 的 hello 不带字段
            // 也按开处理（!== false 容错）。
            this.dynamicDateTimeOn = payload.dynamicDateTimeOn !== false;
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
            if (typeof payload.flickSwap === 'boolean') {
                this.flickSwap = payload.flickSwap;
                document.body.classList.toggle('flick-swap', this.flickSwap);
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
            // 高度真相源（round-6）：native pref 经 hello 下发（css px）。
            this.nativeStoredHeightCss = Number(payload.storedKbHeight) || 0;
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
            // 先于 renderMode：切换键的键面（快捷切换目标简写）读的就是
            // 迁移后的对。
            this.adoptQuickPairForHandwriting(nextMode);
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
            // 字母键盘布局（kbLayout pref，"26"|"14"）：变化即重渲染当前
            // 键面（renderMode 内部按 pref 换 dp14/qwerty 布局）。
            // 长按空格动作（#50/#56）：空格 mic 小标与 data-lp 圆点只在
            // spaceKey() 构建时读——推送只改字段不重渲染的话，改掉后
            // 图标残留到下一次 renderMode、WebView 重启时构造器默认值
            // 又先画出来（时隐时现）。变化即重渲染。热更键盘（新 JS）跑
            // 旧原生（无 spaceHoldTap 推送）时回退旧布尔键；tap 值域
            // voice|none|<tap DSL 串>（native 侧带 dsl: 前缀，此处剥掉）。
            const rawHold = typeof payload.spaceHoldTap === 'string' && payload.spaceHoldTap
                ? payload.spaceHoldTap
                : (payload.voiceOnSpace === false ? 'none' : 'voice');
            const nextSpaceHold = rawHold === 'voice' || rawHold === 'none'
                ? rawHold
                : (rawHold.startsWith('dsl:') ? rawHold.slice(4) : 'voice');
            const spaceHoldChanged = nextSpaceHold !== this.spaceHoldTap;
            this.spaceHoldTap = nextSpaceHold;
            const nextKbLayout = payload.kbLayout === '14' ? '14' : '26';
            const kbLayoutChanged = nextKbLayout !== this.kbLayout;
            this.kbLayout = nextKbLayout;
            if (modeChanged) this.renderMode();
            else if (kbLayoutChanged && MERGEABLE_14.has(this.mode)) {
                this.renderMode();
            } else if (spaceHoldChanged) {
                this.renderMode();
            }
            // Degraded/warming state arrives with every hello (mode-fallback
            // §2.1): a rebuilt WebView restores its badge/notice silently.
            // hello is a snapshot, never a notification — the flag is what
            // keeps a rebuild from re-toasting the failure it reports.
            this.applyEngineLifecycle({ ...payload, snapshot: true });
            if (schemeChanged && this.mode === 'double-pinyin') {
                // renderMode（非 renderLetters）：dp14 的布局判断在
                // renderMode，方案变化统一走它重渲染。
                this.renderMode();
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
            // #27 补推（评审 P1）：hello handler 里 applyBackground 早于
            // keyboardReady，首推 pushChromeColor 必被 native 的 !pageReady
            // 门闸吞掉；此刻 pageReady 已置位，补一次不再依赖二次 hello。
            this.pushChromeColor();
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
            // issue #12 收尾记账先于 variant 早退（codex R4 P2）：回放
            // 风暴跳过主体的收束判定没问题（回放期间本就不该触发），但
            // 门闩/指纹的解除不能被跳过——清空在途时启动回放的话，空回
            // 声全被早退吞掉，死串保护悬垂，之后 17/18 字符的死串不再
            // 被清。
            if (!payload.composing) {
                this._autoCollapseKey = null;
                this._deadClearPending = false;
            }
            // setComposition emits Reset and every replayed key. None of
            // those intermediate states owns the candidate pool or anchor.
            // Only the final target echo can replace the visible parse.
            if (this.variantReplaying) return;
            if (payload.mode && MODES[payload.mode] && payload.mode !== this.mode) {
                this.mode = payload.mode;
                this.adoptQuickPairForHandwriting(payload.mode);
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
            // issue #12：组合串无上限累积（连打/乱打）后候选退化甚至死空
            // ——设备日志实录：51 字母后 input 自主收缩、候选归零，跨收起/
            // 弹出不清除，用户感知「再按键没有反应」。拼音族在回声侧自动
            // 收束：有候选=组合到 40 字母上屏首候选（等同按空格，主流
            // IME 的超长自动组句）；无候选=不可解析死串，攒到 16 字母清空
            // 组合换回可用性。英文等模式 rawInput 长是正常态，T9/笔画有
            // 各自的确认边界，都不进收束范围。
            // 判定只认引擎原生候选（payload.candidates）：展示池混有常用语
            // /联想等注入项，前缀匹配会在引擎候选已空时冒充池首，既遮住
            // 死串分支、又把 fav: 等非引擎 id 送进 chooseCandidate（codex
            // R1 P1）。在途保护用组合指纹（codex R2/R3 P1）：同一 raw 只
            // 收束一次；指纹变化（新键/部分选词推进）立即重评，收束链随
            // 状态推进自然收敛（每步消耗组合长度，链有尽头）；组合结束
            // 清指纹，同一死串被打第二次仍会被清。破坏性的死串清空另有
            // 在途门闩（见分支内注释）。不用时间窗：墙上时钟回退会误禁
            // 用，且「到期重试」并不正确——无回声时无用户事件也无风险，
            // 收束只该由回声驱动。
            if (this.mode === 'pinyin' || this.mode === 'double-pinyin') {
                if (payload.composing) {
                    const raw = (payload.rawInput || '').replace(/ /g, '');
                    const engineCands = payload.candidates || [];
                    if (raw && raw !== this._autoCollapseKey) {
                        if (raw.length >= 40 && engineCands.length) {
                            this._autoCollapseKey = raw;
                            this.call(revision => Native.chooseCandidate(
                                revision, engineCands[0].id, this.token));
                        } else if (raw.length >= 16 && !engineCands.length) {
                            // 死串清空是破坏性 Reset（原生无 revision 校验，
                            // codex R3 P1）：单独设在途门闩——发出后只认
                            // 「组合结束回声」解除。迟到的高位回声（清空前
                            // 已处理、尚未送达的旧键）不能再次触发清空，
                            // 否则第二次 Reset 会打到清空之后的新输入上。
                            // 选词分支无门闩：chooseCandidate 带 id/revision
                            // 校验，迟到请求被拒或作用于当步状态，无破坏性。
                            if (!this._deadClearPending) {
                                this._deadClearPending = true;
                                this._autoCollapseKey = raw;
                                this.call(() => Native.clearComposing(this.token));
                                this.showToast(t("组合过长，已清空"));
                            }
                        }
                    }
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

        /** 定制键备注：锚在键上方的气泡（1.6s 自隐）。 */
        showKeyNote(anchor, text) {
            const old = document.getElementById('keyNote');
            if (old) old.remove();
            const tip = document.createElement('div');
            tip.id = 'keyNote';
            tip.textContent = text;
            document.body.append(tip);
            const r = anchor.getBoundingClientRect();
            const vw = document.documentElement.clientWidth;
            tip.style.left = Math.max(8, Math.min(vw - tip.offsetWidth - 8,
                r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
            tip.style.top = Math.max(6, r.top - tip.offsetHeight - 10) + 'px';
            clearTimeout(this._keyNoteTimer);
            this._keyNoteTimer = setTimeout(() => tip.remove(), 1600);
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
        recognizeInk: (reqId, payload) => console.log('recognizeInk', reqId, payload),
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
        // #12 复发取证：native 推送到达 JS 的对账计数（心跳捎带
        // states=N preedit=L，与 native 日志的 stateApplied 行数对照：
        // 相等=JS 收到了（查渲染层）；少=推送丢（查 evaluate 层））。
        onEngineState: payload => {
            window.__diagStates = (window.__diagStates || 0) + 1;
            window.__diagRev = payload && payload.revision;
            try { return keyboard.onEngineState(payload); }
            catch (e) { window.__diagErr = String(e && e.message || e).slice(0, 60); throw e; }
        },
        onAssoc: payload => keyboard.onAssoc(payload),
        onNativeState: payload => keyboard.onNativeState(payload),
        onInkCandidates: payload => keyboard.onInkCandidates(payload),
        onEditorInfo: payload => keyboard.onEditorInfo(payload),
        cancelTouches: () => keyboard.cancelTouches(),
        // #48 编辑器换代作废在途定制宏链（native onStartInput 驱动）。
        cancelCustomChain: () => keyboard.cancelCustomChain(),
        cancelToolbarEdit: () => keyboard.cancelToolbarEdit(),
        // 工具位（debugState 同类）：自定义行缩放器，mock/预览直调锁数值。
        fitCustomRow: strip => keyboard.fitCustomRow(strip),
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
        // #39-10 编辑面板（preview/诊断与 mock 套件共用入口）。
        toggleEditPanel: () => keyboard.toggleEditPanel(),
        toggleStatsPanel: () => keyboard.toggleStatsPanel(),
        toggleControlView: () => keyboard.setControlView(!keyboard.ctrlView),
        showNumpad: () => keyboard.showNumpad(),
        // Called by the native side on every IME show: hiding the IME can
        // DETACH the input view, and a re-attach hands ResizeObserver the
        // current size as its baseline (no callback) - a pad/height change
        // made while hidden would then keep a stale row budget (device-gate
        // proven). Re-derive from the live geometry at show time.
        // 手写总高也在这里再推一次：重唤键盘不重跑 renderMode（模式没
        // 变），收起期间动过高度的场合靠这一下回到手写态（P1 重唤折叠）。
        applyHeightNow: () => {
            keyboard.applyModeHeight();
            keyboard.applyHeight();
        },
        onHeightSaved: ok => keyboard.onHeightSaved(ok),
        // Read-only automation probe (device gates): the keyboard instance is
        // a closure, so gates cannot reach runtime fields without this.
        debugState: () => ({
            mode: keyboard.mode,
            // #39-12 守门：互斥注册表名单（mock 枚举 DOM 层比对，
            // 新视图漏登记直接红）。
            exclusiveViews: Object.keys(EXCLUSIVE_VIEWS),
            exclusiveEls: Object.values(EXCLUSIVE_VIEWS).map(v => v.el),
            // #12 复发取证：渲染短路三嫌疑直接暴露（心跳捎带）。
            vr: keyboard.variantReplaying ? 1 : 0,
            warm: keyboard.warming ? 1 : 0,
            comp: keyboard.composing ? 1: 0,
            holdMs: keyboard.holdMs,
            scrubSpeed: keyboard.scrubSpeed,
            popupSnap: keyboard.popupSnap,
            bottomPad: keyboard.bottomPad,
            // 手写（issue #28）：在途请求号 + 笔迹规模，设备门禁断言用。
            inkReqId: keyboard.inkReqId,
            inkStrokes: keyboard.inkStrokes.length,
            // 停顿触发延时档位（设置回归断言用）。
            // Copy: a hand-out reference would let automation mutate the
            // live degrade state (active=false left a stale badge).
            degraded: keyboard.degrade ? { ...keyboard.degrade } : null,
            warming: keyboard.warming,
            // 工具栏编辑模式（issue #15）：编辑态 + 左右分组只读快照。
            toolbarEdit: keyboard.toolbarEdit,
            toolbarLeft: keyboard.toolbarLeft.slice(),
            toolbarRight: keyboard.toolbarRight.slice(),
            // #46 联想让位态退格清联想开关（设置页写入，hello 回读）。
            backspaceAssocOn: keyboard.backspaceAssocOn,
            // #45 万象 / 键功能引导开关。
            wxSlashOn: keyboard.wxSlashOn,
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
        // Suite/preview hook: the height card lives behind a toolbar tap;
        // tests drive the live-preview semantics directly.
        enterHeightEdit: () => keyboard.enterHeightEdit(),
        // Suite/preview hook (issue #28 round-2): the ink delay setting and
        // the recognition-path smoother, for unit tests and preview probes.
        inkSmooth: points => smoothInkStroke(points),
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
