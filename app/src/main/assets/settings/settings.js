/* Feelime full settings page.
 *
 * The bridge remains the source of truth for settings and device state. The
 * page owns only presentation: tokens, page routing, and this small zh/en
 * dictionary. User text, URLs, JSON, model titles, and device names are
 * always rendered as received. */
"use strict";
let keySoundVolumeTimer = 0;

const BRIDGE = window.Native || { ready() {} };
let token = "";
let lastState = null;
let uiChoice = "auto";
let uiLocale = browserLocale();
let pendingModelConsent = null;
let lastModelError = null;

const $ = id => document.getElementById(id);

// 键盘选择（验收 2026-09-24）：与键盘 MODES 一致；默认菜单 = round-6 五项。
const KEYBOARD_MODES = [
    ['direct', '英文直出'], ['pinyin', '全拼'], ['double-pinyin', '双拼'],
    ['t9', '九宫格'], ['stroke', '笔画'], ['flypy', '音形'],
    ['handwriting', '手写'],
    ['french', '法语'], ['russian', '俄语'], ['japanese', '日语'],
];
const DEFAULT_MENU_MODES = ['direct', 'pinyin', 'double-pinyin', 't9', 'stroke'];

// #31 键盘色调：与 native THEME_PRESETS / keyboard.css html[data-preset] 同源。
const THEME_PRESET_LIST = ['classic', 'ocean', 'violet', 'amber', 'sakura', 'teal'];
const THEME_PRESET_COLORS = {
    classic: '#23c890', ocean: '#4da3ff', violet: '#a78bfa',
    amber: '#ff9f45', sakura: '#ff8fb1', teal: '#2ec8c8',
};
// 预置→hue 映射与 keyboard.css html[data-preset] 同源；键面色板复用同一份。
const PRESET_HUE = { classic: 160, ocean: 212, violet: 255, amber: 27, sakura: 344, teal: 180 };

const I18N = {
    zh: {
        "title": "Feelime 设置",
        "hero.tag": "离线中英混合语音输入法",
        "status.title": "状态",
        "ime.title": "输入法状态",
        "ime.enabled": "在系统中启用 Feelime",
        "ime.default": "设为默认输入法",
        "ime.enableAction": "去启用",
        "ime.pickAction": "去切换",
        "ime.addShortcut": "添加桌面快捷方式",
        "ime.addTile": "添加快捷设置磁贴",
        "language.title": "界面语言",
        "language.badge": "界面",
        "language.label": "显示语言",
        "language.hint": "默认跟随系统；只影响 Feelime 界面，不改变输入语言。",
        "language.note": "输入语言仍由键盘模式决定。",
        "language.auto": "跟随系统",
        "language.zh": "中文",
        "language.en": "English",
        "nav.groups": "设置分组",
        "nav.back": "返回首页",
        "entry.input.title": "键盘与输入",
        "entry.input.subtitle": "双拼 · 定制按键",
        "entry.dict.title": "词库",
        "entry.dict.subtitle": "导入 rime 词库 · 叠加候选",
        "entry.voice.title": "语音识别",
        "entry.voice.subtitle": "语音模型 · 识别设置",
        "entry.update.title": "键盘热更新",
        "entry.update.subtitle": "键盘前端文件更新",
        "entry.backup.title": "备份与恢复",
        "entry.backup.subtitle": "设置 · 常用语 · 词库",
        "entry.about.title": "关于",
        "entry.about.subtitle": "版本信息 · 组件说明",
        "entry.test.title": "输入测试",
        "entry.test.subtitle": "唤起键盘试一试",
        "page.input": "键盘与输入",
        "page.dict": "词库",
        "dict.badge": "叠加",
        "dict.import.title": "导入词库",
        "dict.import.enable": "rime 词库文件（.dict.yaml）",
        "dict.import.note": "词<TAB>码 逐行导入，上限 5000 条；适合把 rime-ice 等社区词库里的自选词补进来。",
        "dict.userwords.title": "自造词",
        "dict.userwords.enable": "手动维护的常用词",
        "dict.userwords.hint": "逐条添加「词 + 全拼输入码」，输入码命中即出这个词；适合名字、缩写、行话。改动即时生效，重启保留。",
        "dict.userwords.manage": "管理词条",
        "page.userwords": "自造词",
        "page.fuzzy": "全拼模糊音",
        "page.keyboards": "键盘选择",
        "userwords.list.title": "词条",
        "userwords.list.empty": "还没有词条，在下方添加。",
        "userwords.form.text": "词条（如 你好世界）",
        "userwords.form.code": "输入码（留空自动按拼音生成）",
        "userwords.form.add": "添加",
        "userwords.form.save": "保存",
        "userwords.form.cancel": "取消",
        "userwords.list.note": "输入码留空即自动按拼音生成（多音字会生成全部读音组合，并自动适配双拼按键）；点词条可修改，✕ 删除。改动即时生效，上限 200 条。",
        "userwords.note.saved": "已保存",
        "userwords.note.deleted": "已删除",
        "userwords.err.notReady": "正在读取词表，稍后再试",
        "userwords.err.duplicate": "这个输入码已存在",
        "userwords.err.limit": "最多 200 条",
        "userwords.form.textErr": "词条不能为空",
        "userwords.form.codeErr": "输入码需为 1-48 位字母",
        "userwords.count": "共 {0} 条",
        "nav.backDict": "返回词库",
        "dict.base.title": "基底词库",
        "dict.base.badge": "基底",
        "dict.base.hint": "换装整个词库：选择 rime 词库文件（.dict.yaml，如 rime-ice 的词典；万象拼音请选去声调的 Lite 版 zip 整包），在本机重新编译（几分钟），模糊音/双拼/T9 一起重建；可随时恢复内置。",
        "dict.base.pick": "选择词库文件换装",
        "dict.base.revert": "恢复内置词库",
        "dict.slot.delete": "删除",
        "dict.base.builtin": "内置 rime-frost（白霜拼音）",
        "dict.base.custom": "自定义：{0}",
        "dict.base.builtinNote": "内置 rime-frost 词库",
        "dict.base.entries": "{0} 词条",
        "dict.base.nonPinyin": "抽样发现此词库的较多编码不是拼音音节组合（形码/音形码表特征）：可能无法按读音（拼音）预期打出这些字；如需形码输入请关注后续的专属方案支持。",
        "dict.base.t9Skip": "此词库词条较多：编译九宫格（T9）词库的内存开销超出本机承受（会被系统中止），本次导入跳过了九宫格，拼音/双拼不受影响；换更小的词库或恢复内置后九宫格即恢复。",
        "dict.base.toned": "此词库的编码带声调（疑似完整版，如万象拼音 Base）：键盘打不出声调符号，很多字将无法命中，请改用去声调的 Lite 版（或换回内置词库）。",
        "flypy.title": "音形码表",
        "flypy.badge": "音形",
        "flypy.hint": "导入形码方案码表（如小鹤音形的 rime 词表 .dict.yaml，或 TAB 分隔的「词、码」纯文本）：两码音 + 两码形，四码唯一顶字上屏。在本机编译为独立的音形模式，不影响拼音词库；可随时移除。",
        "flypy.pick": "导入音形码表",
        "flypy.revert": "移除码表",
        "flypy.none": "未导入（模式菜单暂无音形模式）",
        "flypy.custom": "已导入：{0}",
        "flypy.building": "正在处理音形码表…",
        "dict.base.stageCopy": "正在读取词库文件…",
        "dict.base.stageActivate": "正在切换词库…",
        "dict.base.stageCompile": "正在编译词库（期间中文输入暂不可用），可离开此页，完成后自动换装",
        "dict.base.elapsed": "已编译 {0} 秒",
        "dict.base.switching": "当前生效 {0}，正在切换到 {1}：",
        "page.appearance": "外观",
        "themeMode.auto": "跟随系统",
        "themeMode.light": "浅色",
        "themeMode.dark": "深色",
        "page.voice": "语音识别",
        "page.update": "键盘热更新",
        "page.about": "关于",
        "page.test": "输入测试",
        "input.fuzzy.title": "全拼模糊音",
        "input.fuzzy.manage": "管理模糊音",
        "input.fuzzy.manageHint": "分不清的音一起打：平翘舌、n/l、前后鼻音等开关。",
        "input.fuzzy.badge": "输入",
        "input.fuzzy.g.ping": "平翘舌",
        "input.fuzzy.g.ping.hint": "z/zh、c/ch、s/sh：打 zang 也能出「张」，打 zhang 也能出「脏」。",
        "input.fuzzy.g.nl": "声母 n/l",
        "input.fuzzy.g.nl.hint": "打 nai 也能出「来」，打 lai 也能出「奶」。",
        "input.fuzzy.g.fh": "声母 f/h",
        "input.fuzzy.g.fh.hint": "打 fu 也能出「湖」，打 hu 也能出「父」。",
        "input.fuzzy.g.rl": "声母 r/l",
        "input.fuzzy.g.rl.hint": "打 re 也能出「乐」，打 le 也能出「热」。",
        "input.fuzzy.g.nasal": "前后鼻音",
        "input.fuzzy.g.nasal.hint": "an/ang、en/eng、in/ing：打 zang 也能出「张」，打 zhon 也能出「中」。",
        "input.assoc.title": "中文联想",
        "input.assoc.badge": "输入",
        "input.assoc.enable": "选词后联想下一个词",
        "input.assoc.hint": "上屏后在候选条给出高频接续词，点击可连续联想；只在全拼/双拼生效。",
        "input.assoc.backspaceClear": "联想时退格清除联想",
        "input.assoc.backspaceClearHint": "联想候选显示时按退格先清联想、恢复工具栏（不删字）；关闭则退格照旧删字。",
        "input.datetime.title": "日期时间候选",
        "input.datetime.badge": "输入",
        "input.datetime.enable": "打 date/time/week 出日期时间",
        "input.datetime.hint": "候选条直接给当前日期、时间、星期（全拼打 riqi/shijian/xingqi 也出）；不需要可关。",
        "input.phrases.title": "候选符号词",
        "input.phrases.badge": "输入",
        "input.phrases.enable": "附加符号/emoji 候选",
        "input.phrases.hint": "打 shang 出 ↑、dui 出 ✓ 这类符号词，排在候选第 3 位附近；全拼和双拼通用。",
        "input.phrases.manage": "管理词条",
        "input.phrases.importHint": "rime 词库文件的词条叠加进候选（不替换内置词库、不带原词频）。再次导入会替换上一次的导入表。",
        "input.phrases.importBtn": "选择文件导入",
        "input.phrases.clearBtn": "清空导入词",
        "input.phrases.confirmClear": "确认清空",
        "input.phrases.importedCount": "已导入 {0} 条",
        "page.phrases": "候选符号词",
        "nav.backInput": "返回键盘与输入",
        "phrases.list.title": "词条",
        "phrases.list.empty": "还没有词条，在下方添加。",
        "phrases.list.note": "输入码用全拼（单个音节自动适配双拼按键）；点词条可修改，✕ 删除。改动即时生效。",
        "phrases.form.text": "词条（如 ↑ 或 你好）",
        "phrases.form.code": "输入码（如 shang）",
        "phrases.form.add": "添加",
        "phrases.form.save": "保存修改",
        "phrases.form.cancel": "取消",
        "phrases.note.saved": "已保存",
        "phrases.note.deleted": "已删除",
        "phrases.err.duplicate": "该输入码已有词条",
        "phrases.err.notReady": "词表还在加载，稍等再试",
        "phrases.err.limit": "最多 200 条，先删掉一些再添加",
        "input.double.title": "双拼方案",
        "input.double.badge": "输入",
        "input.double.scheme": "方案",
        "input.double.hint": "键盘切到「双拼」模式后按所选方案出字。",        "input.double.layout": "键盘布局",
        "input.double.layoutHint": "14 键把相邻两字母合并成宽键帽，按键更大更不易误触。",
        "input.double.layout26": "26 键",
        "input.feel.kbLayout": "字母键盘布局",
        "input.feel.kbLayoutHint": "拼音、双拼、英文键盘通用；14 键把相邻两字母合并成宽键帽，按键更大更不易误触。",
        "input.double.layout14": "14 键",
        "input.double.ziranma": "自然码",
        "input.double.flypy": "小鹤双拼",
        "input.double.sogou": "搜狗 / 微软双拼",
        "input.double.ziguang": "紫光双拼",
        "input.double.note.ziranma": "声母与全拼相同（zh=V、ch=I、sh=U 除外）。零声母（a/e 开头）直接打全拼：啊=aa、爱=ai、安=an、恩=en、二=er。",
        "input.double.note.flypy": "声母与全拼相同（zh=V、ch=I、sh=U 除外）。零声母（a/e/o 开头）双打首字母，也可打全拼：啊=aa、爱=ai、恩=ef、二=er。",
        "input.double.note.sogou": "声母与全拼相同（zh=V、ch=I、sh=U 除外）；ing 在「;」键（键盘上即分词键位置），ü 在 Y。零声母固定先打 O：啊=oa、爱=ol、安=oj、恩=of、二=or。搜狗与微软双拼键位完全一致，用微软双拼习惯的选这项即可。",
        "input.double.note.ziguang": "紫光华宇拼音的双拼键位。zh=U、ch=A、sh=I；ing 在「;」键，ü 在 V（ju/qu/xu 也可用 v 键）。零声母固定先打 O：啊=oa、爱=op、安=or。",
        "input.double.mapCaption": "韵母键位图（键名下方为该键韵母，右下为双声母）",
        "input.custom.title": "定制按键",
        "input.custom.badge": "高级",
        "input.custom.enabled": "启用定制按键",
        "input.custom.jsonLabel": "定制 JSON（{\"version\":1,\"rows\":[[{\"t\":\"键面\",\"tap\":\"点击输出\",\"note\":\"备注\"}]]}）",
        "input.custom.jsonPlaceholder": "粘贴定制 JSON",
        "input.custom.note": "保存在本机，键盘下次载入时生效。",
        "input.custom.manage": "管理定制按键",
        "page.customkeys": "定制按键",
        "ck.status.title": "定制按键",
        "ck.openEditor": "打开编辑器",
        "ck.openEditor.hint": "点选创建按键，不用写代码",
        "ck.json.title": "JSON（兜底）",
        "ck.json.hint": "编辑器够用的日常不需要动这里；批量导入/导出或高级玩法可直接粘贴 JSON。",
        "ck.preview.title": "预览",
        "ck.rows.title": "按键（第 1/2/3 行）",
        "ck.quick.title": "常用键，一键加",
        "ck.quick.title.hint": "先点一行里的「＋」，或在下面常用键里一键添加。",
        "ck.edit.title": "编辑按键",
        "ck.apply": "确定",
        "ck.save": "保存全部",
        "ck.add": "＋",
        "ck.f.t": "键面文案",
        "ck.f.t.hint": "按钮上显示的字",
        "ck.f.action": "点击输出",
        "ck.f.mode": "类型",
        "ck.f.mode.text": "文本",
        "ck.f.mode.single": "按键",
        "ck.f.mode.combo": "组合键",
        "ck.f.mode.advanced": "高级",
        "ck.f.text": "要输入的文本，如 :w 或 me@example.com",
        "ck.f.mods": "修饰键",
        "ck.f.key": "按键",
        "ck.f.dsl": "DSL（如 [esc]ggVGD）",
        "ck.help.aria": "DSL 说明",
        "ck.help.dsl": "<b>点了这颗键会发生什么，按顺序写下来就行：</b><br>· 要打字，直接写：<code>:w</code>（输入 :w）、<code>me@example.com</code>（输入邮箱）<br>· 按一个键，套上方括号：<code>[esc]</code>（Esc）、<code>[f5]</code>（F5 刷新）、<code>[backspace]</code>（退格）<br>· 组合键：<code>[ctrl+s]</code>（保存）、<code>[alt+f4]</code>（关窗口）<br>· 连着来：<code>[esc]ggVGD</code> = Vim 删除全文（Esc，gg 回开头，VG 选到结尾，D 删除）<br>· 可用的键名：esc、tab、enter、space、backspace、del、left、right、up、down、home、end、pgup、pgdn、f1～f12、单字母、数字；组合键的修饰：ctrl、alt、shift、win。",
        "ck.f.span": "宽度",
        "ck.f.color": "颜色",
        "ck.color.default": "默认",
        "ck.color.custom": "自定义",
        "ck.color.hue": "色调",
        "ck.color.sat": "饱和度",
        "ck.f.note": "备注",
        "ck.f.note.hint": "长按键面时显示",
        "ck.editBar.hint": "拖动排序 · 点 × 删除 · 长按按键开始",
        "ck.editBar.done": "完成",
        "ck.common": "常用",
        "ck.common.hint": "选一颗直接填好，改改就能用",
        "ck.err.t": "键面不能为空",
        "ck.err.tap": "点击输出不能为空",
        "ck.note.saved": "已保存，键盘下次载入时生效",
        "ck.note.deleted": "已删除",
        "ck.row": "第 {n} 行",
        "ck.none": "（空行）",
        "ck.dirty": "有未保存的修改",
        "ck.newTitle": "新建按键",
        "ck.cancel": "取消",
        "ck.confirmLeave": "有未保存的修改，离开将丢失。仍要离开吗？",
        "ck.confirmLeaveTitle": "未保存的修改",
        "ck.leaveGo": "丢弃并离开",
        "ck.leaveStay": "留下",
        "input.keyboards.title": "键盘选择",
        "input.keyboards.manage": "管理键盘与快捷切换",
        "input.keyboards.manageHint": "长按菜单列出哪些键盘、快捷切换键在两个键盘间往返。",
        "input.keyboards.badge": "菜单",
        "input.keyboards.enable": "长按菜单里列出哪些键盘",
        "input.keyboards.hint": "勾选的键盘出现在长按切换键的菜单里，行序即菜单顺序（箭头调整）；不勾的还可以在菜单里临时勾回来。改动即时生效。",
        "input.keyboards.drag": "拖动排序",
        "input.keyboards.moveUp": "上移",
        "input.keyboards.moveDown": "下移",
        "input.english.enable": "英文词直出",
        "input.english.hint": "拼音组合里直接敲 github、ios、android 这类英文词出候选，不用切英文模式；全拼和双拼通用。",
        "input.phrases.wxSlash": "万象 / 键功能引导",
        "input.phrases.wxSlashHint": "换装万象拼音方案后，开启可在拼音/双拼下用 / 进入功能引导（如 /sj 出时间、/ri 出日期）；关闭则 / 直接上屏。其它键盘不受影响。",
        "input.keyboards.pairA": "快捷切换 · 第一个",
        "input.keyboards.pairB": "快捷切换 · 第二个",
        "input.keyboards.pairHint": "点切换键在两个键盘之间往返；选最常用的两个。",
        "input.keyboards.saved": "已保存，键盘即时生效",
        "input.feel.bubbleLinger": "气泡停留时长",
        "input.feel.bubbleLingerHint": "松手后气泡多停留一会儿再消失，看得清按了什么；0 为立即消失。",
        "search.placeholder": "搜索设置：高度、气泡、双拼、词库…",
        "search.noResults": "没有匹配的设置项",
        "action.saveCustom": "保存定制",
        "action.insertTemplate": "插入模板",
        "action.viewDocs": "查看说明",
        "voice.models.title": "麦克风与语音模型",
        "voice.models.badge": "语音",
        "voice.backend.label": "模型来源",
        "voice.backend.auto": "安装包优先",
        "voice.backend.remote": "使用下载模型",
        "voice.backend.hint": "切换后下次录音生效。选择下载模型后，请在下方补齐所需模型再录音。",
        "voice.downloadSource.label": "模型下载源",
        "voice.downloadSource.gitee": "Gitee（国内推荐）",
        "voice.downloadSource.hfMirror": "HF / GitHub 镜像（默认）",
        "voice.downloadSource.official": "官方源（HF / GitHub）",
        "voice.downloadSource.custom": "自定义源",
        "voice.downloadSource.customPlaceholder": "例如：https://example.com/huggingface",
        "voice.downloadSource.archive": "流式模型压缩包地址",
        "voice.downloadSource.archivePlaceholder": "例如：https://example.com/model.tar.bz2",
        "voice.downloadSource.save": "保存下载源",
        "voice.downloadSource.hint": "下载后会校验文件完整性；压缩包地址只用于流式模型的大文件，自定义源需同时填写仓库地址和对应的 tar.bz2 地址。",
        "voice.holdSpace": "长按空格语音输入",
        "voice.holdSpaceHint": "关闭后空格键不再显示麦克风，工具栏麦克风按钮同隐藏。",
        "voice.mic.permission": "麦克风权限",
        "voice.mic.hint": "语音输入必需，全程本地处理",
        "voice.mic.action": "去授权",
        "voice.models.note": "完整安装包已内置全部模型；精简安装包在此按需下载（断点续传，逐文件校验）。",
        "voice.asr.title": "语音识别设置",
        "voice.asr.badge": "识别",
        "voice.asr.stripPeriod": "去掉句尾句号",
        "voice.asr.stripHint": "问号、叹号保留；关闭后保留模型输出",
        "voice.asr.hotwordsLabel": "热词（一行一个，可填中文或英文；识别优先考虑这些词）",
        "voice.asr.hotwordsPlaceholder": "例如：\n倪妮\nGPU",
        "action.saveAsr": "保存识别设置",
        "update.title": "键盘热更新",
        "update.badge": "更新",
        "update.note": "仅替换 HTML/CSS/JS，不涉及引擎、词典与语音模型。",
        "update.sourceLabel": "更新源地址（metainfo.json）",
        "update.sourcePlaceholder": "https://example.com/feelime/metainfo.json",
        "update.autoCheck": "启动时自动检查更新",
        "update.autoCheckHint": "每天最多检查一次；清空更新源后自动检查停用",
        "update.urlLabel": "键盘包地址（联网下载）",
        "update.urlPlaceholder": "https://example.com/feelime-keyboard.zip",
        "action.checkUpdate": "检查更新",
        "action.install": "联网下载安装",
        "action.importLocal": "从本地 ZIP 导入",
        "action.restore": "恢复内置",
        "update.localHint": "从本地 ZIP 导入不需要网络，仍会校验签名和兼容性。",
        "update.unsigned": "⚠ 未签名键盘拥有 IME 权限（仅限调试构建）",
        "update.sigConfirmed": "⚠ 当前键盘：签名不符（已手动确认导入）",
        "page.backup": "备份与恢复",
        "backup.title": "备份与恢复",
        "backup.badge": "备份",
        "backup.note": "把设置、常用语、自定义键位与输入词库打包成一个 JSON 文件，方便换机或手工编辑。",
        "backup.export": "导出数据",
        "backup.import": "导入数据",
        "backup.consent.title": "确认覆盖",
        "backup.consent.badge": "覆盖提示",
        "backup.consent.message": "导入会覆盖当前的设置、常用语、自定义键位与词库，且无法撤销。确定继续吗？",
        "backup.consent.cancel": "取消",
        "backup.consent.confirm": "选择文件导入",
        "backup.done.export": "已导出到所选位置。",
        "backup.done.import": "导入完成，正在生效。",
        "backup.failed.export": "导出失败",
        "backup.failed.import": "导入失败",
        "backup.error.FORMAT": "文件不是有效的 JSON。",
        "backup.error.KIND": "这不是 Feelime 备份文件。",
        "backup.error.VERSION": "备份文件版本较新，请先升级 Feelime。",
        "backup.error.IO_ERROR": "读取或写入文件失败。",
        "backup.error.PATH": "备份里包含不安全的路径，已拒绝。",
        "backup.error.BASE64": "备份中的词库数据损坏。",
        "kbSig.title": "键盘包签名不符",
        "kbSig.badge": "安全提示",
        "kbSig.message": "这个键盘包的签名与官方发布密钥不一致（可能是自改包或第三方包）。仍要导入将以“已确认签名不符”的状态运行，重启后仍生效。",
        "kbSig.cancel": "取消",
        "kbSig.confirm": "仍要导入",
        "about.versionTitle": "版本信息",
        "about.badge": "信息",
        "action.copyVersion": "复制版本信息",
        "action.appStore": "在 Google Play 查看应用",
        "action.githubRepo": "GitHub 仓库",
        "action.githubIssues": "问题反馈",
        "action.feishuGroup": "加入飞书交流群",
        "action.checkUpdate": "检查更新",
        "action.checkUpdatePlay": "去 Google Play 更新",
        "action.dlThin": "下载精简版",
        "action.dlFull": "下载完整版",
        "update.checking": "正在检查更新…",
        "update.upToDate": "已是最新版本（v{0}）",
        "update.available": "发现新版本 v{0}（当前 v{1}），建议下载：",
        "update.failed": "检查更新失败，请稍后再试（或到 GitHub Releases 页查看）",
        "about.copyHint": "反馈问题时直接粘贴；复制内容标记为敏感，不会进入键盘剪贴板历史。",
        "about.offlineHint": "全程离线：语音识别与文字候选都不联网。",
        "about.noticesTitle": "第三方许可与组件说明",
        "about.legalBadge": "许可",
        "about.expandNotices": "展开完整说明",
        "about.openLicenses": "开源许可与致谢",
        "about.openLicensesHint": "组件清单 · 上游链接 · 完整说明",
        "page.licenses": "开源许可与致谢",
        "nav.backAbout": "返回关于",
        "licenses.self.title": "本应用许可",
        "licenses.self.note": "Feelime 整体以 GPL-3.0 提供：内置中文基底词库来自 rime-frost（同样 GPL-3.0），对应源码即应用源码仓库。",
        "licenses.components.title": "致谢组件",
        "licenses.components.badge": "开源",
        "licenses.thanks": "Feelime 站在以下开源项目的肩膀上，特此致谢；点击链接可跳转上游。",
        "licenses.full.title": "完整说明",
        "licenses.cmp.frost": "中文基底词库（语料词频重统）",
        "licenses.cmp.librime": "中文输入引擎（内嵌 Boost/OpenCC/marisa-trie 等）",
        "licenses.cmp.rimedata": "Rime 方案与数据文件",
        "licenses.cmp.sherpa": "离线语音识别运行时与模型",
        "licenses.cmp.mozc": "日文引擎（Abseil/Protobuf/zlib 等随附）",
        "licenses.cmp.hunspell": "拼写检查（法/俄词典随附）",
        "licenses.cmp.okhttp": "模型下载网络（仅下载时联网）",
        "licenses.cmp.othersName": "其余内嵌依赖",
        "licenses.cmp.others": "Commons Compress、yaml-cpp、LevelDB、RapidJSON 等 · 见下方完整说明",
        "test.title": "试输入一段文字",
        "test.badge": "测试",
        "test.placeholder": "点这里唤起 Feelime 试一试",
        "test.note": "输入内容只留在当前编辑框中。",
        "model.builtIn": "已随安装包提供",
        "model.transferSize": "下载 {download}（整包包含额外文件）\n安装后占用 {installed}",
        "model.installed": "已下载，校验通过",
        "model.downloading": "下载中 {percent}%",
        "model.downloadingBytes": "下载中 {percent}%（{done} / {total}）",
        "model.broken": "文件异常，请重新下载",
        "model.missing": "未下载（约 {size}）",
        "model.download": "下载",
        "model.cancel": "取消",
        "model.remove": "删除",
        "model.redownload": "重新下载",
        "model.import": "导入模型文件",
        "model.importing": "正在读取模型文件…",
        "model.importValidating": "正在验证模型文件…",
        "model.importInstalling": "正在安装已验证模型…",
        "model.importFormat": "仅支持与内置清单对应的官方模型 tar.bz2 或 zip 归档。",
        "model.title.streaming": "流式语音识别（中英）",
        "model.title.final": "整句纠错识别",
        "model.title.punctuation": "中英标点恢复",
        "model.consent.title": "确认下载流量",
        "model.consent.badge": "流量提示",
        "model.consent.message": "模型“{name}”约 {bytes}，当前网络可能产生流量费用。是否继续？",
        "model.consent.cancel": "取消",
        "model.consent.confirm": "继续下载",
        "update.sourceBuiltIn": "APK 内置",
        "update.sourceHot": "热更新版本",
        "update.version": "版本：{value}",
        "update.hash": "内容校验：{value}…",
        "update.state": "状态：{value}",
        "update.lastError": "最近错误：{value}",
        "update.lastSuccess": "上次成功：{value}",
        "update.sourceStatus": "更新源：{value}",
        "update.sourceDefault": "官方默认源",
        "update.sourceCustom": "用户设置",
        "update.sourceDisabled": "已停用",
        "update.states.BUILT_IN": "内置",
        "update.states.DOWNLOADING": "下载中",
        "update.states.VERIFYING": "校验中",
        "update.states.CHECKING_COMPATIBILITY": "检查兼容性",
        "update.states.READY": "已就绪",
        "update.states.ACTIVE": "已启用",
        "update.states.ACTIVATING": "启用中",
        "update.states.ROLLED_BACK": "已回退",
        "update.states.FAILED": "失败",
        "about.appVersion": "App 版本",
        "about.activeKeyboard": "键盘版本（当前）",
        "about.builtInKeyboard": "键盘版本（内置）",
        "about.device": "手机型号",
        "about.android": "系统版本",
                "about.androidValue": "Android {release}（API {sdk}）",
        "about.inputStats": "输入字数",
        "about.inputStatsValue": "今日 {today} · 累计 {total}",
        "note.saved": "已保存",
        "note.customSaved": "已保存，键盘下次载入时生效",
        "note.copied": "已复制",
        "custom.none": "未定制",
        "custom.count": "已定制 {count} 个键",
        "error.INVALID_CUSTOM_JSON": "定制 JSON 格式不正确。",
        "error.INVALID_DP_SCHEME": "双拼方案选项无效。",
                "input.ink.title": "手写输入",
        "input.ink.badge": "手写",
        "input.ink.delay": "停顿触发识别",
        "input.ink.delayHint": "停笔后等这么久就识别上一个字；写得慢选「慢」，抢着识别选「快」。",
        "input.ink.live": "实时（逐笔识别）",
        "input.ink.fast": "快（约 300 毫秒）",
        "input.ink.standard": "标准（约 600 毫秒）",
        "input.ink.slow": "慢（约 1200 毫秒）",
        "input.feel.title": "键盘手感",
        "input.feel.badge": "微调",

        "input.feel.padHint": "键盘下方的空白高度，0 保持贴底（终端场景），补偿全面屏手势条或系统元素。",
        "input.feel.padPortrait": "底部留白 · 竖屏",
        "input.feel.padLandscape": "底部留白 · 横屏",
        "input.feel.padLandscapeHint": "横屏单独保存，互不影响。",
        "input.feel.candFont": "候选字号",
        "input.feel.candFontHint": "候选词文字的大小，不改变键盘行高。",
        "input.feel.preeditFont": "拼音字号",
        "input.feel.preeditFontHint": "打字时拼音字母的大小；特大档会占一行更多高度。",
        "input.feel.preeditBold": "拼音加粗",
        "input.feel.preeditBoldHint": "打字时的拼音字母用粗体显示，默认关。",
        "input.feel.oneHand": "单手模式",
        "input.feel.oneHandHint": "键盘贴左或贴右，空出的侧边条放光标与编辑操作。",
        "input.feel.oneHandPad": "单手压缩比例",
        "input.feel.oneHandPadHint": "大屏上把键盘进一步收窄，方便拇指够到全部按键。",
        "pad.default": "不压缩",
        "pad.15": "收窄 15%",
        "pad.25": "收窄 25%",
        "pad.35": "收窄 35%",
        "input.feel.sideContent": "侧边条内容",
        "input.feel.sideContentHint": "单手模式下空出区域的内容。",
        "input.feel.bgImageLight": "亮色背景",
        "input.feel.bgImageDark": "暗色背景",
        "input.feel.themeMode": "色彩模式",
        "input.feel.themePreset": "键盘色调",
        "input.feel.themePresetHint": "一个色相驱动整套键盘配色（键帽/面板/强调色）；拖滑条自定义，或点预置快捷档。",
        "input.feel.themeSat": "键盘饱和度",
        "input.feel.themePreview": "效果预览",
        "input.feel.themePreviewHint": "色调、饱和度、按键不透明度与背景图在这里实时反映；亮暗各一组。",
        "preview.light": "亮色",
        "preview.dark": "暗色",
        "entry.skin.title": "皮肤",
        "entry.skin.subtitle": "色调 · 饱和度 · 背景图",
        "page.skin": "皮肤",
        "nav.backAppearance": "返回外观",
        "input.feel.keyHue": "键面色调",
        "input.feel.keyHueHint": "只调键帽/强调色的色相（背景不动）；点「跟键盘」还原跟随。",
        "preset.followKey": "跟键盘色",
        "input.feel.keySat": "键面饱和度",
        "input.feel.keySatHint": "只调键帽组的色彩浓度；最左=键帽变黑白灰。",
        "input.english.posLabel": "英文词候选位置",
        "input.english.posHint": "自动：不打扰拼音的词排第 1 位、与拼音键序重叠的排第 3 位；也可固定。",
        "input.english.posAuto": "自动",
        "input.english.pos1": "第 1 位",
        "input.english.pos3": "第 3 位",
        "input.english.pos5": "第 5 位",
        "input.feel.themeSatHint": "拉到最左是黑白灰（明暗模式定黑白基底），往右色彩渐浓。",
        "preset.classic": "默认绿",
        "preset.ocean": "海蓝",
        "preset.violet": "紫罗兰",
        "preset.amber": "蜜橙",
        "preset.sakura": "樱粉",
        "preset.teal": "青碧",
        "input.feel.themeModeHint": "跟随系统，或固定浅色/深色。",
        "input.feel.keyOpacity": "按键不透明度",
        "input.feel.kbHeight": "键盘高度",
        "input.feel.kbHeightHint": "竖屏键盘的高度；键盘上拖拽调节与此处等效。",
        "input.feel.kbHeightReset": "恢复默认",
        "input.feel.keyOpacityHint": "键帽在背景图上的透明程度，文字始终实色。",
        "input.feel.keyBubble": "按键气泡",
        "input.feel.keyBubbleHint": "按下按键时在键帽上方放大显示所按的字符，方便确认有没有按错（默认关闭）。",
        "entry.appearance.title": "外观",
        "entry.appearance.subtitle": "色彩模式 · 背景图片 · 透明度",
        "input.appearance.title": "外观",
        "input.appearance.preview": "预览",
        "input.appearance.previewHint": "进入本页时，真实键盘会在屏幕底部弹出（本页自动让位），上面的设置实时生效，直接在这里打字试。",
        "input.appearance.previewPlaceholder": "直接在这里打字试试",
        "input.appearance.badge": "主题",
        "input.feel.bgImageHint": "铺满整个键盘区域（工具条到底部留白），压缩到 720px 宽存储，只在本机生效。",
        "input.feel.bgImageHintDark": "亮暗切换时各自使用对应组的图片。",
        "自定义": "Custom",
        "光标控制": "光标控制",
        "自定义图片": "自定义图片",
        "左手": "左手",
        "右手": "右手",
        "input.feel.hold": "长按触发时长",
        "input.feel.holdHint": "长按弹出选字、锁定大写、打开模式菜单的等待时间。",
"input.feel.flickSwap": "上下滑方向互换",
        "input.feel.flickSwapHint": "默认上滑出数字/符号、下滑出大写；开启后对调（键面小字提示随之下移）。",
        "input.feel.scrub": "光标移动速度",
        "input.feel.scrubHint": "光标拖拽时每个刻度移动的距离。",
        "input.feel.snap": "滑动选字范围",
        "input.feel.snapHint": "长按滑选时手指偏离多远取消选择：松=更远也有效，紧=更早取消。",
        "input.feel.snapLoose": "松",
        "input.feel.snapStandard": "标准",
        "input.feel.snapTight": "紧",
        "input.feel.keySound": "按键声音",
        "input.feel.keySoundVolume": "按键音量",
        "input.feel.keySoundVolumeHint": "哔声、系统键击音与自定义音效共用。",
        "input.feel.keyHapticStrength": "振动强度",
        "input.feel.keyHapticStrengthHint": "本机马达不支持强弱调节时按轻重的时长近似。",
        "input.feel.hapticLight": "弱", "input.feel.hapticMedium": "中", "input.feel.hapticStrong": "强",
        "input.feel.keySoundHint": "按键时轻响一声，跟随系统音量，静音时不响。",
        "input.feel.keySoundStyle": "按键音效",
        "input.feel.keySoundStyleHint": "默认哔声之外的音效；",
        "input.feel.kssDefault": "默认哔声",
        "input.feel.kssKeypress": "系统键击音",
        "input.feel.kssCustom": "自定义音效",
        "input.feel.keySoundFile": "自定义音效文件",
        "input.feel.keySoundFileHint": "选一段 2MB 内的短音频（ogg/mp3/wav）；不合适可清除换回默认。",
        "input.feel.keySoundPick": "选择文件",
        "input.feel.keySoundClear": "清除",
        "feel.keySound.current": "当前：",
        "feel.keySound.none": "未选择",
        "input.feel.keyHaptic": "按键振动",
        "diag.title": "诊断记录",
        "diag.badge": "调试",
        "diag.toggle": "记录引擎诊断事件",
        "diag.toggleHint": "复现「按键字母直接上屏」这类故障前打开。只记录引擎与编辑器事件（包名、inputType、降级原因），不含任何输入内容。",
        "diag.copy": "导出诊断信息",
        "diag.on": "诊断记录已开启，复现问题后回到这里导出诊断信息。",
        "diag.exported": "诊断文件已生成，在弹出的分享面板里选微信 / 邮件等方式发送。",
        "diag.off": "诊断记录未开启。",
        "input.feel.keyHapticHint": "按键时轻短振动一下，强度跟随机型；系统触感总开关关闭时不震。",
        "error.INVALID_FEEL_OPTION": "手感参数无效，已还原为原值。",
        "error.EMPTY_SOURCE": "请先填入更新源地址（metainfo.json）。",
        "error.EMPTY_URL": "请先填入键盘包地址。",
        "error.INVALID_SOURCE": "更新源地址无效。",
        "error.NO_RELEASE": "尚无可用发布。",
        "error.NO_INSTALLABLE_ASSET": "发布中没有可安装的键盘包。",
        "error.AMBIGUOUS_ASSET": "发布中的键盘包不唯一。",
        "error.INVALID_ASSET_URL": "发布资产下载地址无效。",
        "error.RATE_LIMITED": "GitHub 请求受到限流，请稍后重试。",
        "error.NETWORK_ERROR": "网络请求失败。",
        "error.BAD_RESPONSE": "更新源返回了无法识别的内容。",
        "error.INTERNAL_ERROR": "更新失败，请稍后重试。",
        "error.URL_NOT_HTTPS": "更新地址必须使用 HTTPS。",
        "error.URL_USER_INFO": "更新地址不能包含账号或密码。",
        "error.TIMEOUT": "网络请求超时。",
        "error.TLS_ERROR": "安全连接失败。",
        "error.REDIRECT_LIMIT": "重定向次数过多。",
        "error.REDIRECT_NOT_HTTPS": "重定向地址必须使用 HTTPS。",
        "error.DOWNLOAD_TOO_LARGE": "下载文件超过大小限制。",
        "error.ZIP_TOO_LARGE": "键盘包超过大小限制。",
        "error.NOT_ZIP": "键盘包格式不正确。",
        "error.SIGNATURE_MISSING": "键盘包缺少签名。",
        "error.SIGNATURE_BAD": "键盘包签名校验失败。",
        "error.PAYLOAD_HASH": "键盘文件校验失败。",
        "error.VERSION_MISMATCH": "键盘版本信息不一致。",
        "error.COMPAT_MIN_NATIVE_API": "当前版本的 Feelime 不支持此键盘包。",
        "error.COMPAT_CAPABILITIES": "此键盘包需要未提供的能力。",
        "error.FRAGMENT_PIN_MISMATCH": "键盘包校验指纹不匹配。",
        "error.IO_ERROR": "本地文件操作失败。",
        "error.ENTRY_LIMIT": "键盘包包含过多文件。",
        "error.DUPLICATE_ENTRY": "键盘包包含重复文件。",
        "error.PATH_TRAVERSAL": "键盘包包含不安全路径。",
        "error.PATH_ABSOLUTE": "键盘包包含绝对路径。",
        "error.PATH_BACKSLASH": "键盘包路径格式不安全。",
        "error.PATH_NUL": "键盘包路径包含无效字符。",
        "error.SYMLINK_OR_SPECIAL": "键盘包包含不支持的特殊文件。",
        "error.UNICODE_CONFLICT": "键盘包文件名存在冲突。",
        "error.UNKNOWN_ENTRY": "键盘包包含未知文件。",
        "error.ENVELOPE_MISSING": "键盘包缺少校验元数据。",
        "error.MANIFEST_INVALID_JSON": "键盘包清单格式无效。",
        "error.MANIFEST_UNKNOWN_KEY": "键盘包清单包含未知字段。",
        "error.MANIFEST_MISSING_KEY": "键盘包清单缺少必要字段。",
        "error.MANIFEST_LISTS_ENVELOPE": "键盘包清单结构无效。",
        "error.MANIFEST_PAYLOAD_ALLOWLIST": "键盘包包含不允许的内容。",
        "error.KEY_UNKNOWN": "键盘包签名密钥未知。",
        "error.PAYLOAD_LENGTH": "键盘文件大小校验失败。",
        "error.INFLATED_TOO_LARGE": "键盘包解压后超过大小限制。",
        "error.HOTWORDS_TRUNCATED": "已保存，但有 {count} 行热词超出限制（最多 {max} 行，每行 {chars} 字）。",
        "error.NO_NETWORK": "当前没有可用的网络连接。",
        "error.STALE_CONFIRMATION": "下载确认已过期，请重新点击下载。",
        "error.MODEL_DOWNLOAD_FAILED": "模型下载失败，请稍后重试。",
        "error.MODEL_IMPORT_FAILED": "模型导入失败，请检查官方归档格式后重试。",
        "error.MODEL_IMPORT_BUSY": "模型正在处理，请稍候。",
        "error.MODEL_NETWORK_CHANGED": "网络已变化，下载已暂停；请重新确认后重试。",
        "error.INVALID_MODEL_SOURCE": "自定义源需要 HTTPS 仓库地址和对应的 tar.bz2 归档地址。",
    },
    en: {
        "title": "Feelime Settings",
        "hero.tag": "Offline Chinese-English voice input",
        "status.title": "Status",
        "ime.title": "Input method status",
        "ime.enabled": "Enable Feelime in system settings",
        "ime.default": "Set as the default input method",
        "ime.enableAction": "Enable",
        "ime.pickAction": "Switch",
        "ime.addShortcut": "Add home-screen shortcut",
        "ime.addTile": "Add Quick Settings tile",
        "language.title": "Interface language",
        "language.badge": "UI",
        "language.label": "Display language",
        "language.hint": "Follows the system by default; this changes Feelime UI only, not input language.",
        "language.note": "Input language is still controlled by the keyboard mode.",
        "language.auto": "Follow system",
        "language.zh": "中文",
        "language.en": "English",
        "nav.groups": "Settings sections",
        "nav.back": "Back to home",
        "nav.backAppearance": "Back to appearance",
        "entry.input.title": "Keyboard & input",
        "entry.input.subtitle": "Double pinyin · Custom keys",
        "entry.dict.title": "Lexicon",
        "entry.dict.subtitle": "Import rime dicts · Extra candidates",
        "entry.backup.title": "Backup & restore",
        "entry.backup.subtitle": "Settings · Phrases · Lexicons",
        "entry.voice.title": "Voice recognition",
        "entry.voice.subtitle": "Voice models · Recognition options",
        "entry.update.title": "Keyboard updates",
        "entry.update.subtitle": "Update keyboard HTML/CSS/JS",
        "entry.about.title": "About",
        "entry.about.subtitle": "Version info · Components",
        "entry.test.title": "Input test",
        "entry.test.subtitle": "Wake Feelime and try it",
        "page.input": "Keyboard & input",
        "page.dict": "Lexicon",
        "dict.badge": "Overlay",
        "dict.import.title": "Import a dictionary",
        "dict.import.enable": "rime dictionary file (.dict.yaml)",
        "dict.import.note": "Lines of word<TAB>code are imported, up to 5000 entries; handy for cherry-picking words from community dicts such as rime-ice.",
        "dict.userwords.title": "User words",
        "dict.userwords.enable": "Hand-maintained words",
        "dict.userwords.hint": "Add word + full-pinyin code pairs one by one; typing the code surfaces the word. Great for names, abbreviations, jargon. Applies immediately, survives restart.",
        "dict.userwords.manage": "Manage words",
        "page.userwords": "User words",
        "page.fuzzy": "Fuzzy pinyin",
        "page.keyboards": "Keyboard selection",
        "userwords.list.title": "Words",
        "userwords.list.empty": "No words yet - add one below.",
        "userwords.form.text": "Word (e.g. hello world)",
        "userwords.form.code": "Code (leave empty for auto pinyin)",
        "userwords.form.add": "Add",
        "userwords.form.save": "Save",
        "userwords.form.cancel": "Cancel",
        "userwords.list.note": "Leave the code empty to auto-generate pinyin (polyphones expand to every reading; double-pinyin keys auto-adapt); tap a word to edit, ✕ deletes. Applies immediately, 200-entry cap.",
        "userwords.note.saved": "Saved",
        "userwords.note.deleted": "Deleted",
        "userwords.err.notReady": "Word list still loading, try again shortly",
        "userwords.err.duplicate": "That code already exists",
        "userwords.err.limit": "200 entries max",
        "userwords.form.textErr": "Word cannot be empty",
        "userwords.form.codeErr": "Code must be 1-48 letters",
        "userwords.count": "{0} entries",
        "nav.backDict": "Back to dictionary",
        "dict.base.title": "Base dictionary",
        "dict.base.badge": "Base",
        "dict.base.hint": "Swap the whole lexicon: pick a rime dictionary file (.dict.yaml, e.g. from rime-ice; for wanxiang use the tone-free Lite zip) and it recompiles on this device (a few minutes); fuzzy/double-pinyin/T9 rebuild with it. Built-in can be restored anytime.",
        "dict.base.pick": "Pick a dictionary file",
        "dict.base.revert": "Restore built-in",
        "dict.slot.delete": "Delete",
        "dict.base.builtin": "Built-in rime-frost",
        "dict.base.custom": "Custom: {0}",
        "dict.base.builtinNote": "Bundled rime-frost dictionary",
        "dict.base.entries": "{0} entries",
        "dict.base.nonPinyin": "A large share of codes in this dictionary are not pinyin syllable sequences (shape-code layout): characters may not be reachable by typing their pronunciation. Dedicated shape-code schema support may come later.",
        "dict.base.t9Skip": "This dictionary has many entries: compiling the T9 (9-key) prism would exceed this device's available memory, so the 9-key mode was skipped for this import. Pinyin and double-pinyin are unaffected; a smaller dictionary or the built-in one restores it.",
        "dict.base.toned": "Codes in this dictionary carry tone marks (likely the full variant, e.g. wanxiang Base): tones are not typeable on this keyboard, so many entries will never match. Use the tone-free Lite variant (or restore the built-in).",
        "flypy.title": "Shape-code table",
        "flypy.badge": "Shape",
        "flypy.hint": "Import a shape-code table (e.g. the flypy rime dict .dict.yaml, or plain TAB-separated word/code text): two sound codes + two shape codes, unique 4-code auto-commit. Compiled on this device into a standalone mode - the pinyin lexicon is untouched. Removable anytime.",
        "flypy.pick": "Import shape-code table",
        "flypy.revert": "Remove table",
        "flypy.none": "Not imported (no shape mode in the mode menu yet)",
        "flypy.custom": "Imported: {0}",
        "flypy.building": "Processing the shape-code table…",
        "dict.base.stageCopy": "Reading the dictionary file…",
        "dict.base.stageActivate": "Switching dictionary…",
        "dict.base.stageCompile": "Compiling (Chinese input pauses meanwhile) - you can leave this page; the keyboard swaps over when done",
        "dict.base.elapsed": "{0}s elapsed",
        "dict.base.switching": "Active: {0}, switching to {1}: ",
        "page.appearance": "Appearance",
        "themeMode.auto": "Follow system",
        "themeMode.light": "Light",
        "themeMode.dark": "Dark",
        "page.voice": "Voice recognition",
        "page.update": "Keyboard updates",
        "page.about": "About",
        "page.test": "Input test",
        "input.fuzzy.title": "Full-pinyin fuzzy",
        "input.fuzzy.manage": "Manage fuzzy pinyin",
        "input.fuzzy.manageHint": "Type confusable sounds interchangeably: z/zh, n/l, nasal endings and more.",
        "input.fuzzy.badge": "Input",
        "input.fuzzy.g.ping": "Retroflex z/zh, c/ch, s/sh",
        "input.fuzzy.g.ping.hint": "Typing zang also matches 张, typing zhang also matches 脏.",
        "input.fuzzy.g.nl": "n/l initials",
        "input.fuzzy.g.nl.hint": "Typing nai also matches 来, typing lai also matches 奶.",
        "input.fuzzy.g.fh": "f/h initials",
        "input.fuzzy.g.fh.hint": "Typing fu also matches 湖, typing hu also matches 父.",
        "input.fuzzy.g.rl": "r/l initials",
        "input.fuzzy.g.rl.hint": "Typing re also matches 乐, typing le also matches 热.",
        "input.fuzzy.g.nasal": "Front/back nasals",
        "input.fuzzy.g.nasal.hint": "an/ang, en/eng, in/ing: typing zang also matches 张, typing zhon also matches 中.",
        "input.assoc.title": "Chinese word association",
        "input.assoc.badge": "Input",
        "input.assoc.enable": "Suggest the next word after a commit",
        "input.assoc.hint": "Shows frequent followers in the candidates bar after a word commits; tap to keep the chain going. Full/Double Pinyin only.",
        "input.assoc.backspaceClear": "Backspace dismisses associations",
        "input.assoc.backspaceClearHint": "When association candidates are showing, backspace clears them and restores the toolbar (nothing deleted); off = backspace deletes as usual.",
        "input.datetime.title": "Date & time candidates",
        "input.datetime.badge": "Input",
        "input.datetime.enable": "Type date/time/week for quick stamps",
        "input.datetime.hint": "The candidates bar offers the current date, time and weekday (full pinyin riqi/shijian/xingqi works too); turn off if unwanted.",
        "input.phrases.title": "Symbol candidates",
        "input.phrases.badge": "Input",
        "input.phrases.enable": "Symbol / emoji candidates",
        "input.phrases.hint": "Adds words like ↑ for shang and ✓ for dui near candidate #3; works in full and double Pinyin.",
        "input.english.enable": "English word candidates",
        "input.english.hint": "Type english words like github, ios or android right inside Pinyin composing — no mode switch; works in full and double Pinyin.",
        "input.phrases.wxSlash": "wanxiang / feature guide",
        "input.phrases.wxSlashHint": "After installing the wanxiang Pinyin schema, enable to route / into the engine in Pinyin modes (/sj types the time, /ri the date); off = / commits directly. Other keyboards are unaffected.",
        "input.phrases.manage": "Manage entries",
        "input.phrases.importHint": "Entries from a rime dictionary join the candidates as an overlay (the built-in lexicon stays; original frequencies are not carried). Importing again replaces the previous import.",
        "input.phrases.importBtn": "Pick a file",
        "input.phrases.clearBtn": "Clear imported",
        "input.phrases.confirmClear": "Confirm clear",
        "input.phrases.importedCount": "{0} entries imported",
        "page.phrases": "Symbol candidates",
        "nav.backInput": "Back to Keyboard & input",
        "phrases.list.title": "Entries",
        "phrases.list.empty": "No entries yet — add one below.",
        "phrases.list.note": "Codes use full Pinyin (single-syllable entries also match double-pinyin keys); tap an entry to edit, ✕ to delete. Changes apply immediately.",
        "phrases.form.text": "Text (e.g. ↑ or a word)",
        "phrases.form.code": "Code (e.g. shang)",
        "phrases.form.add": "Add",
        "phrases.form.save": "Save changes",
        "phrases.form.cancel": "Cancel",
        "phrases.note.saved": "Saved",
        "phrases.note.deleted": "Deleted",
        "phrases.err.duplicate": "An entry with this code already exists",
        "phrases.err.notReady": "Entries are still loading — try again shortly",
        "phrases.err.limit": "Limit is 200 entries — remove some first",
        "input.double.title": "Double-pinyin scheme",
        "input.double.badge": "Input",
        "input.double.scheme": "Scheme",
        "input.double.hint": "Takes effect when the keyboard is in Double Pinyin mode.",
        "input.double.layout": "Key layout",
        "input.double.layoutHint": "14-key merges neighbouring letters into wide caps - bigger targets, fewer mis-taps.",
        "input.double.layout26": "26 keys",
        "input.feel.kbLayout": "Letter layout",
        "input.feel.kbLayoutHint": "Applies to pinyin, double-pinyin and English; 14-key merges neighbouring letters into wider caps.",
        "input.double.layout14": "14 keys",
        "input.double.ziranma": "Ziranma",
        "input.double.flypy": "Flypy (小鹤)",
        "input.double.sogou": "Sogou / MSPY",
        "input.double.ziguang": "Ziguang (紫光)",
        "input.double.note.ziranma": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e) use full Pinyin: 啊=aa、爱=ai、安=an、恩=en、二=er.",
        "input.double.note.flypy": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e/o) double the first letter; full Pinyin also works: 啊=aa、爱=ai、恩=ef、二=er.",
        "input.double.note.sogou": "Initials match full Pinyin (except zh=V, ch=I, sh=U); ing sits on the “;” key (the wide key on the keyboard), ü on Y. Zero-initial syllables always start with O: 啊=oa、爱=ol、安=oj、恩=of、二=or. Sogou and MSPY share the exact same layout.",
        "input.double.note.ziguang": "The Ziguang (紫光) layout. zh=U、ch=A、sh=I; ing sits on the “;” key, ü on V (ju/qu/xu also take v). Zero-initial syllables always start with O: 啊=oa、爱=op、安=or.",
        "input.double.mapCaption": "Final key map (finals under each key, double initials bottom-right)",
        "input.custom.title": "Custom keys",
        "input.custom.badge": "Advanced",
        "input.custom.enabled": "Enable custom symbols",
        "input.custom.jsonLabel": "Custom JSON ({\"version\":1,\"rows\":[[{\"t\":\"key label\",\"tap\":\"output\",\"note\":\"note\"}]]})",
        "input.custom.jsonPlaceholder": "Paste custom JSON",
        "input.custom.note": "Saved on this device and applied the next time the keyboard loads.",
        "input.custom.manage": "Manage custom keys",
        "page.customkeys": "Custom keys",
        "ck.status.title": "Custom keys",
        "ck.openEditor": "Open editor",
        "ck.openEditor.hint": "Build keys by tapping - no code needed",
        "ck.json.title": "JSON (fallback)",
        "ck.json.hint": "The editor covers everyday needs; use JSON for bulk import/export or advanced tricks.",
        "ck.preview.title": "Preview",
        "ck.rows.title": "Keys (rows 1/2/3)",
        "ck.quick.title": "Quick add",
        "ck.quick.title.hint": "Tap ＋ in a row, or one-tap add from the common keys below.",
        "ck.edit.title": "Edit key",
        "ck.apply": "Apply",
        "ck.save": "Save all",
        "ck.add": "＋",
        "ck.f.t": "Label",
        "ck.f.t.hint": "Text shown on the key",
        "ck.f.action": "Tap action",
        "ck.f.mode": "Type",
        "ck.f.mode.text": "Text",
        "ck.f.mode.single": "Key",
        "ck.f.mode.combo": "Combo",
        "ck.f.mode.advanced": "Adv",
        "ck.f.text": "Text to type, e.g. :w or me@example.com",
        "ck.f.mods": "Mods",
        "ck.f.key": "Key",
        "ck.f.dsl": "DSL (e.g. [esc]ggVGD)",
        "ck.help.aria": "DSL help",
        "ck.help.dsl": "<b>Write what should happen, in order:</b><br>· Type text: just write it, e.g. <code>:w</code>, <code>me@example.com</code><br>· One key: bracket it, e.g. <code>[esc]</code>, <code>[f5]</code>, <code>[backspace]</code><br>· Combos: <code>[ctrl+s]</code> (save), <code>[alt+f4]</code><br>· Sequences: <code>[esc]ggVGD</code> = Vim delete the whole file: <code>[esc]ggVGD</code><br>· Key names: esc, tab, enter, space, backspace, del, arrows, home, end, pgup, pgdn, f1-f12, letters, digits; modifiers: ctrl, alt, shift, win.",
        "ck.f.span": "Width",
        "ck.f.color": "Color",
        "ck.color.default": "Default",
        "ck.color.custom": "Custom",
        "ck.color.hue": "Hue",
        "ck.color.sat": "Saturation",
        "ck.f.note": "Note",
        "ck.f.note.hint": "Shown on long-press",
        "ck.editBar.hint": "Drag to reorder · × removes · long-press a key to start",
        "ck.editBar.done": "Done",
        "ck.common": "Common",
        "ck.common.hint": "Pick one to prefill, tweak, apply",
        "ck.err.t": "Key face is required",
        "ck.err.tap": "Tap action is required",
        "ck.note.saved": "Saved; applied the next time the keyboard loads",
        "ck.note.deleted": "Deleted",
        "ck.row": "Row {n}",
        "ck.none": "(empty)",
        "ck.dirty": "Unsaved changes",
        "ck.newTitle": "New key",
        "ck.cancel": "Cancel",
        "ck.confirmLeave": "You have unsaved changes. Leave anyway?",
        "ck.confirmLeaveTitle": "Unsaved changes",
        "ck.leaveGo": "Discard and leave",
        "ck.leaveStay": "Stay",
        "input.keyboards.title": "Keyboard selection",
        "input.keyboards.manage": "Manage keyboards & quick switch",
        "input.keyboards.manageHint": "Which keyboards appear in the long-press menu, and the quick-switch pair.",
        "input.keyboards.badge": "Menu",
        "input.keyboards.enable": "Keyboards listed in the long-press menu",
        "input.keyboards.hint": "Checked keyboards appear in the mode-key long-press menu; row order is the menu order (arrow buttons). Unchecked ones can be re-enabled from that menu. Applies immediately.",
        "input.keyboards.drag": "Drag to reorder",
        "input.keyboards.moveUp": "Move up",
        "input.keyboards.moveDown": "Move down",
        "input.keyboards.pairA": "Quick switch · first",
        "input.keyboards.pairB": "Quick switch · second",
        "input.keyboards.pairHint": "The switch key toggles between these two; pick your two most-used keyboards.",
        "input.keyboards.saved": "Saved; the keyboard applies it immediately",
        "input.feel.bubbleLinger": "Bubble linger",
        "input.feel.bubbleLingerHint": "How long the bubble stays after release; 0 hides it instantly.",
        "search.placeholder": "Search settings: height, bubble, double-pinyin, lexicon…",
        "search.noResults": "No matching settings",
        "action.saveCustom": "Save custom layout",
        "action.insertTemplate": "Insert template",
        "action.viewDocs": "View guide",
        "voice.models.title": "Microphone & voice models",
        "voice.models.badge": "Voice",
        "voice.backend.label": "Model source",
        "voice.backend.auto": "Prefer app models",
        "voice.backend.remote": "Downloaded models",
        "voice.backend.hint": "Changes apply to the next recording. After selecting downloaded models, download any missing models below before recording.",
        "voice.downloadSource.label": "Model download source",
        "voice.downloadSource.gitee": "Gitee (China-friendly)",
        "voice.downloadSource.hfMirror": "HF / GitHub mirrors (default)",
        "voice.downloadSource.official": "Official sources (HF / GitHub)",
        "voice.downloadSource.custom": "Custom source",
        "voice.downloadSource.customPlaceholder": "For example: https://example.com/huggingface",
        "voice.downloadSource.archive": "Streaming model archive URL",
        "voice.downloadSource.archivePlaceholder": "For example: https://example.com/model.tar.bz2",
        "voice.downloadSource.save": "Save download source",
        "voice.downloadSource.hint": "Downloads are checked for integrity. The archive URL is only for the streaming model's large file; a custom source must provide both the repository URL and its matching tar.bz2 URL.",
        "voice.holdSpace": "Hold-space voice input",
        "voice.holdSpaceHint": "Off removes the mic glyph from the space bar and hides the toolbar mic.",
        "voice.mic.permission": "Microphone permission",
        "voice.mic.hint": "Required for voice input; processing stays on this device",
        "voice.mic.action": "Allow",
        "voice.models.note": "The full package includes all models. Smaller packages can download models here with resume and per-file verification.",
        "voice.asr.title": "Voice recognition options",
        "voice.asr.badge": "Recognition",
        "voice.asr.stripPeriod": "Remove final periods",
        "voice.asr.stripHint": "Question and exclamation marks stay; turn off to keep model output unchanged",
        "voice.asr.hotwordsLabel": "Hotwords (one per line; Chinese or English; recognition gives these words priority)",
        "voice.asr.hotwordsPlaceholder": "For example:\n倪妮\nGPU",
        "action.saveAsr": "Save recognition options",
        "update.title": "Keyboard updates",
        "update.badge": "Update",
        "update.note": "Only keyboard HTML/CSS/JS are replaced. The engine, dictionaries, and voice models stay untouched.",
        "update.sourceLabel": "Update source (metainfo.json)",
        "update.sourcePlaceholder": "https://example.com/feelime/metainfo.json",
        "update.autoCheck": "Check for updates when settings opens",
        "update.autoCheckHint": "At most once a day; clearing the source disables automatic checks",
        "update.urlLabel": "Keyboard package URL (network download)",
        "update.urlPlaceholder": "https://example.com/feelime-keyboard.zip",
        "action.checkUpdate": "Check for updates",
        "action.install": "Download and install",
        "action.importLocal": "Import local ZIP",
        "action.restore": "Restore built-in",
        "update.localHint": "Importing a local ZIP needs no network; its signature and compatibility are still verified.",
        "update.unsigned": "⚠ An unsigned keyboard has IME access (debug builds only)",
        "update.sigConfirmed": "⚠ Active keyboard: signature unverified (manually confirmed)",
        "page.backup": "Backup & restore",
        "backup.title": "Backup & restore",
        "backup.badge": "Backup",
        "backup.note": "Pack settings, saved phrases, custom keys and input lexicons into one editable JSON file for device migration.",
        "backup.export": "Export data",
        "backup.import": "Import data",
        "backup.consent.title": "Confirm overwrite",
        "backup.consent.badge": "Overwrite",
        "backup.consent.message": "Importing overwrites your current settings, saved phrases, custom keys and lexicons. This cannot be undone. Continue?",
        "backup.consent.cancel": "Cancel",
        "backup.consent.confirm": "Choose a file",
        "backup.done.export": "Exported to the chosen location.",
        "backup.done.import": "Import complete; applying changes.",
        "backup.failed.export": "Export failed",
        "backup.failed.import": "Import failed",
        "backup.error.FORMAT": "The file is not valid JSON.",
        "backup.error.KIND": "This is not a Feelime backup file.",
        "backup.error.VERSION": "The backup is from a newer version; update Feelime first.",
        "backup.error.IO_ERROR": "Could not read or write the file.",
        "backup.error.PATH": "The backup contains unsafe paths and was rejected.",
        "backup.error.BASE64": "The lexicon data in the backup is corrupted.",
        "kbSig.title": "Keyboard package signature mismatch",
        "kbSig.badge": "Security",
        "kbSig.message": "This keyboard package was not signed with the official release key (it may be self-modified or third-party). After importing it runs marked as \"signature unverified\" and survives restart.",
        "kbSig.cancel": "Cancel",
        "kbSig.confirm": "Import anyway",
        "about.versionTitle": "Version information",
        "about.badge": "Info",
        "action.copyVersion": "Copy version info",
        "action.appStore": "View app on Google Play",
        "action.githubRepo": "GitHub repository",
        "action.githubIssues": "Report an issue",
        "action.feishuGroup": "Join the Feishu group",
        "action.checkUpdate": "Check for updates",
        "action.checkUpdatePlay": "Update on Google Play",
        "action.dlThin": "Download thin build",
        "action.dlFull": "Download full build",
        "update.checking": "Checking for updates…",
        "update.upToDate": "Up to date (v{0})",
        "update.available": "New version v{0} available (current v{1}). Download:",
        "update.failed": "Update check failed. Try again later, or visit GitHub Releases.",
        "about.copyHint": "Paste this when reporting a problem. The copied report is marked sensitive and is kept out of keyboard clipboard history.",
        "about.offlineHint": "Everything stays offline: voice recognition and text candidates use no network.",
        "about.noticesTitle": "Third-party licenses & components",
        "about.legalBadge": "Licenses",
        "about.expandNotices": "Show full notices",
        "about.openLicenses": "Open-source licenses & credits",
        "about.openLicensesHint": "Components · Upstream links · Full notices",
        "page.licenses": "Licenses & credits",
        "nav.backAbout": "Back to about",
        "licenses.self.title": "This app's license",
        "licenses.self.note": "Feelime as a whole is offered under GPL-3.0: the built-in Chinese base lexicon comes from rime-frost (also GPL-3.0), and the corresponding source is the app's source repository.",
        "licenses.components.title": "Credits",
        "licenses.components.badge": "Open source",
        "licenses.thanks": "Feelime stands on the shoulders of these open-source projects; tap a link to visit the upstream.",
        "licenses.full.title": "Full notices",
        "licenses.cmp.frost": "Chinese base lexicon (re-curated word frequencies)",
        "licenses.cmp.librime": "Chinese input engine (bundles Boost/OpenCC/marisa-trie etc.)",
        "licenses.cmp.rimedata": "Rime schemas & data files",
        "licenses.cmp.sherpa": "Offline speech recognition runtime & models",
        "licenses.cmp.mozc": "Japanese engine (Abseil/Protobuf/zlib bundled)",
        "licenses.cmp.hunspell": "Spell checking (FR/RU dictionaries bundled)",
        "licenses.cmp.okhttp": "Networking for model downloads (online only while downloading)",
        "licenses.cmp.othersName": "Other bundled dependencies",
        "licenses.cmp.others": "Commons Compress, yaml-cpp, LevelDB, RapidJSON etc. · see the full notices below",
        "test.title": "Type a test sentence",
        "test.badge": "Test",
        "test.placeholder": "Tap here to wake Feelime and try it",
        "test.note": "Text stays in this editor.",
        "model.builtIn": "Included with the app",
        "model.transferSize": "Download {download} (archive includes extra files)\nInstalled size {installed}",
        "model.installed": "Downloaded and verified",
        "model.downloading": "Downloading {percent}%",
        "model.downloadingBytes": "Downloading {percent}% ({done} / {total})",
        "model.broken": "File is invalid; download again",
        "model.missing": "Not downloaded (about {size})",
        "model.download": "Download",
        "model.cancel": "Cancel",
        "model.remove": "Delete",
        "model.redownload": "Download again",
        "model.import": "Import model file",
        "model.importing": "Reading model file…",
        "model.importValidating": "Verifying model file…",
        "model.importInstalling": "Installing verified model…",
        "model.importFormat": "Only official tar.bz2 or zip archives matching the built-in model list are accepted.",
        "model.title.streaming": "Streaming speech recognition (Chinese/English)",
        "model.title.final": "Full-sentence correction",
        "model.title.punctuation": "Chinese-English punctuation restoration",
        "model.consent.title": "Confirm download",
        "model.consent.badge": "Data notice",
        "model.consent.message": "“{name}” is about {bytes}. Your current network may incur data charges. Continue?",
        "model.consent.cancel": "Cancel",
        "model.consent.confirm": "Continue download",
        "update.sourceBuiltIn": "Built-in APK",
        "update.sourceHot": "Hot-updated version",
        "update.version": "Version: {value}",
        "update.hash": "Content hash: {value}…",
        "update.state": "Status: {value}",
        "update.lastError": "Latest error: {value}",
        "update.lastSuccess": "Last success: {value}",
        "update.sourceStatus": "Update source: {value}",
        "update.sourceDefault": "Official default",
        "update.sourceCustom": "User configured",
        "update.sourceDisabled": "Disabled",
        "update.states.BUILT_IN": "Built-in",
        "update.states.DOWNLOADING": "Downloading",
        "update.states.VERIFYING": "Verifying",
        "update.states.CHECKING_COMPATIBILITY": "Checking compatibility",
        "update.states.READY": "Ready",
        "update.states.ACTIVE": "Active",
        "update.states.ACTIVATING": "Activating",
        "update.states.ROLLED_BACK": "Rolled back",
        "update.states.FAILED": "Failed",
        "about.appVersion": "App version",
        "about.activeKeyboard": "Keyboard version (current)",
        "about.builtInKeyboard": "Keyboard version (built-in)",
        "about.device": "Device",
        "about.android": "System version",
                "about.androidValue": "Android {release} (API {sdk})",
        "about.inputStats": "Characters typed",
        "about.inputStatsValue": "Today {today} · Total {total}",
        "note.saved": "Saved",
        "note.customSaved": "Saved; applied the next time the keyboard loads",
        "note.copied": "Copied",
        "custom.none": "No custom keys",
        "custom.count": "{count} custom keys",
        "error.INVALID_CUSTOM_JSON": "The custom JSON format is invalid.",
        "error.INVALID_DP_SCHEME": "Invalid double-pinyin scheme.",
                "input.ink.title": "Handwriting",
        "input.ink.badge": "Hand",
        "input.ink.delay": "Pause before recognition",
        "input.ink.delayHint": "How long to wait after the pen lifts before recognizing; pick Slow if you write slowly, Fast if it fires too eagerly.",
        "input.ink.live": "Live (per stroke)",
        "input.ink.fast": "Fast (~300 ms)",
        "input.ink.standard": "Standard (~600 ms)",
        "input.ink.slow": "Slow (~1200 ms)",
        "input.feel.title": "Keyboard feel",
        "input.feel.badge": "Tuning",
        "input.feel.pad": "Bottom padding",
        "input.feel.padHint": "Blank strip under the keys; 0 keeps the keyboard flush with the screen (terminal use). Saved per orientation to compensate gesture bars or OEM IME buttons.",
        "input.feel.padPortrait": "Bottom padding · Portrait",
        "input.feel.padLandscape": "Bottom padding · Landscape",
        "input.feel.padLandscapeHint": "Saved separately from portrait.",
        "input.feel.candFont": "Candidate text size",
        "input.feel.candFontHint": "Size of the candidate words; keyboard row height is unchanged.",
        "input.feel.preeditFont": "Pinyin text size",
        "input.feel.preeditFontHint": "Size of the pinyin letters while typing; the largest level takes extra band height.",
        "input.feel.preeditBold": "Bold pinyin",
        "input.feel.preeditBoldHint": "Show the composing pinyin letters in bold; off by default.",
        "input.feel.oneHand": "One-handed mode",
        "input.feel.oneHandHint": "Shift the keys left or right; the freed side strip holds cursor and editing actions.",
        "input.feel.oneHandPad": "One-handed shrink",
        "input.feel.oneHandPadHint": "Narrow the keyboard further on big screens so your thumb reaches every key.",
        "pad.default": "Off",
        "pad.15": "Shrink 15%",
        "pad.25": "Shrink 25%",
        "pad.35": "Shrink 35%",
        "input.feel.sideContent": "Side strip content",
        "input.feel.sideContentHint": "What fills the freed strip in one-handed mode.",
        "input.feel.bgImageLight": "Light background",
        "input.feel.bgImageDark": "Dark background",
        "input.feel.themeMode": "Color mode",
        "input.feel.themePreset": "Keyboard tint",
        "input.feel.themePresetHint": "One hue drives the whole keyboard palette; drag the slider or tap a preset.",
        "input.feel.themeSat": "Keyboard saturation",
        "input.feel.themeSatHint": "Far left is grayscale (light/dark sets the base); colors deepen to the right.",
        "input.feel.themePreview": "Preview",
        "input.feel.themePreviewHint": "Reflects tint, saturation, key opacity and background images live; one board per theme.",
        "preview.light": "Light",
        "preview.dark": "Dark",
        "input.feel.keyHue": "Keycap tint",
        "input.feel.keyHueHint": "Recolors keycaps/accents only (background stays); tap Follow to inherit again.",
        "input.feel.keySat": "Keycap saturation",
        "input.feel.keySatHint": "Color intensity of the keycap group only; far left makes keycaps grayscale.",
        "preset.followKey": "Follow keyboard",
        "preset.classic": "Classic green",
        "preset.ocean": "Ocean",
        "preset.violet": "Violet",
        "preset.amber": "Amber",
        "preset.sakura": "Sakura",
        "preset.teal": "Teal",
        "input.feel.themeModeHint": "Follow the system, or pin light/dark.",
                "无": "None",
        "选择图片": "Pick an image…",
"input.feel.keyOpacity": "Key opacity",
        "input.feel.kbHeight": "Keyboard height",
        "input.feel.kbHeightHint": "Portrait keyboard height; dragging on the keyboard stays equivalent.",
        "input.feel.kbHeightReset": "Reset",
        "input.feel.keyOpacityHint": "How transparent the keycaps sit over the background image; labels stay solid.",
        "input.feel.keyBubble": "Key bubble",
        "input.feel.keyBubbleHint": "Enlarge the pressed character above the keycap while held, so mis-presses are obvious (off by default).",
        "entry.appearance.title": "Appearance",
        "entry.appearance.subtitle": "Color mode · Background · Opacity",
        "entry.skin.title": "Skin",
        "entry.skin.subtitle": "Tint · Saturation · Background",
        "page.skin": "Skin",
        "input.appearance.title": "Appearance",
        "input.appearance.preview": "Preview",
        "input.appearance.previewHint": "On this page the real keyboard pops up at the bottom of the screen (this page yields). Every setting above applies to it live - type here to try.",
        "input.appearance.previewPlaceholder": "Type here to try it",
        "input.appearance.badge": "Theme",
        "input.feel.bgImageHint": "Covers the whole keyboard (toolbar to bottom padding), compressed to 720px wide and stored locally.",
        "input.feel.bgImageHintDark": "Each theme uses its own image when you switch.",
        "自定义": "Custom",
        "光标控制": "Cursor",
        "自定义图片": "Custom image",
        "左手": "Left hand",
        "右手": "Right hand",
        "关": "Off",
        "空白": "Blank",
        "input.feel.hold": "Long-press trigger",
        "input.feel.holdHint": "How long a press waits before popup selection, caps lock, or the mode menu opens.",
"input.feel.flickSwap": "Swap flick directions",
        "input.feel.flickSwapHint": "By default flick up gives the digit/symbol and flick down uppercases; enabling swaps them (the keycap hint moves below).",
        "input.feel.scrub": "Cursor speed",
        "input.feel.scrubHint": "Distance the caret moves per drag step.",
        "input.feel.snap": "Swipe selection range",
        "input.feel.snapHint": "How far the finger may drift during popup swipe before the pick cancels: loose = forgiving, tight = early cancel.",
        "input.feel.keySoundVolume": "Key volume",
        "input.feel.keySoundVolumeHint": "Shared by the beep, system keypress and custom sounds.",
        "input.feel.keyHapticStrength": "Haptic strength",
        "input.feel.keyHapticStrengthHint": "Approximated by duration when the motor lacks amplitude control.",
        "input.feel.hapticLight": "Light", "input.feel.hapticMedium": "Medium", "input.feel.hapticStrong": "Strong",
        "input.feel.keySound": "Key sound",
        "input.feel.keySoundHint": "A soft click on each key press; follows system volume, silent in mute mode.",
        "input.feel.keySoundStyle": "Key sound style",
        "input.feel.keySoundStyleHint": "Sounds beyond the default beep;",
        "input.feel.kssDefault": "Default beep",
        "input.feel.kssKeypress": "System keypress tone",
        "input.feel.kssCustom": "Custom sound",
        "input.feel.keySoundFile": "Custom sound file",
        "input.feel.keySoundFileHint": "Pick a short audio (ogg/mp3/wav) within 2MB; clear to fall back to the default.",
        "input.feel.keySoundPick": "Choose file",
        "input.feel.keySoundClear": "Clear",
        "feel.keySound.current": "Current: ",
        "feel.keySound.none": "none",
        "input.feel.keyHaptic": "Key vibration",
        "diag.title": "Diagnostics",
        "diag.badge": "Debug",
        "diag.toggle": "Record engine diagnostic events",
        "diag.toggleHint": "Enable before reproducing issues like raw letters landing directly. Records engine/editor events only (package, inputType, degrade reason) — never any typed content.",
        "diag.copy": "Export diagnostics",
        "diag.on": "Recording. Reproduce the issue, then come back and export the diagnostics.",
        "diag.exported": "Diagnostics file created — pick WeChat / email etc. in the share sheet.",
        "diag.off": "Diagnostics recording is off.",
        "input.feel.keyHapticHint": "A light tap on each key press; strength follows the device tuning. No vibration while the system haptics master switch is off.",
        "input.feel.snapLoose": "Loose",
        "input.feel.snapStandard": "Standard",
        "input.feel.snapTight": "Tight",
        "error.INVALID_FEEL_OPTION": "Invalid feel option; the previous value was kept.",
        "error.EMPTY_SOURCE": "Enter an update source (metainfo.json) first.",
        "error.EMPTY_URL": "Enter a keyboard package URL first.",
        "error.INVALID_SOURCE": "The update source URL is invalid.",
        "error.NO_RELEASE": "No release is currently available.",
        "error.NO_INSTALLABLE_ASSET": "The release has no installable keyboard package.",
        "error.AMBIGUOUS_ASSET": "The release has ambiguous keyboard packages.",
        "error.INVALID_ASSET_URL": "The release asset URL is invalid.",
        "error.RATE_LIMITED": "GitHub rate limited the request. Try again later.",
        "error.NETWORK_ERROR": "The network request failed.",
        "error.BAD_RESPONSE": "The update source returned an unrecognized response.",
        "error.INTERNAL_ERROR": "Update failed. Try again later.",
        "error.URL_NOT_HTTPS": "The update URL must use HTTPS.",
        "error.URL_USER_INFO": "The update URL cannot contain a username or password.",
        "error.TIMEOUT": "The network request timed out.",
        "error.TLS_ERROR": "The secure connection failed.",
        "error.REDIRECT_LIMIT": "Too many redirects.",
        "error.REDIRECT_NOT_HTTPS": "Redirect URLs must use HTTPS.",
        "error.DOWNLOAD_TOO_LARGE": "The downloaded file is too large.",
        "error.ZIP_TOO_LARGE": "The keyboard package is too large.",
        "error.NOT_ZIP": "The keyboard package has an invalid format.",
        "error.SIGNATURE_MISSING": "The keyboard package has no signature.",
        "error.SIGNATURE_BAD": "Keyboard package signature verification failed.",
        "error.PAYLOAD_HASH": "Keyboard file verification failed.",
        "error.VERSION_MISMATCH": "Keyboard version information is inconsistent.",
        "error.COMPAT_MIN_NATIVE_API": "This Feelime version does not support the package.",
        "error.COMPAT_CAPABILITIES": "The package requires unavailable capabilities.",
        "error.FRAGMENT_PIN_MISMATCH": "The keyboard package fingerprint does not match.",
        "error.IO_ERROR": "A local file operation failed.",
        "error.ENTRY_LIMIT": "The keyboard package contains too many files.",
        "error.DUPLICATE_ENTRY": "The keyboard package contains a duplicate file.",
        "error.PATH_TRAVERSAL": "The keyboard package contains an unsafe path.",
        "error.PATH_ABSOLUTE": "The keyboard package contains an absolute path.",
        "error.PATH_BACKSLASH": "The keyboard package contains an unsafe path format.",
        "error.PATH_NUL": "The keyboard package path contains an invalid character.",
        "error.SYMLINK_OR_SPECIAL": "The keyboard package contains an unsupported special file.",
        "error.UNICODE_CONFLICT": "The keyboard package contains conflicting filenames.",
        "error.UNKNOWN_ENTRY": "The keyboard package contains an unknown file.",
        "error.ENVELOPE_MISSING": "The keyboard package is missing verification metadata.",
        "error.MANIFEST_INVALID_JSON": "The keyboard package manifest is invalid.",
        "error.MANIFEST_UNKNOWN_KEY": "The keyboard package manifest has an unknown field.",
        "error.MANIFEST_MISSING_KEY": "The keyboard package manifest is missing a required field.",
        "error.MANIFEST_LISTS_ENVELOPE": "The keyboard package manifest structure is invalid.",
        "error.MANIFEST_PAYLOAD_ALLOWLIST": "The keyboard package contains disallowed content.",
        "error.KEY_UNKNOWN": "The keyboard package signing key is unknown.",
        "error.PAYLOAD_LENGTH": "Keyboard file size verification failed.",
        "error.INFLATED_TOO_LARGE": "The unpacked keyboard package is too large.",
        "error.HOTWORDS_TRUNCATED": "Saved, but {count} hotword lines exceeded the limit (up to {max} lines, {chars} characters each).",
        "error.NO_NETWORK": "No network connection is available.",
        "error.STALE_CONFIRMATION": "The download confirmation expired; tap Download again.",
        "error.MODEL_DOWNLOAD_FAILED": "Model download failed. Try again later.",
        "error.MODEL_IMPORT_FAILED": "Model import failed. Check that this is an official model archive and try again.",
        "error.MODEL_IMPORT_BUSY": "The model is already being processed.",
        "error.MODEL_NETWORK_CHANGED": "The network changed and the download paused. Confirm and try again.",
        "error.INVALID_MODEL_SOURCE": "A custom source needs an HTTPS repository URL and its matching tar.bz2 archive URL.",
    },
};

// #39-12：customkeys（二级）与 customkeys-editor（三级）。
const PAGES = ["home", "appearance", "skin", "input", "fuzzy", "keyboards", "dict", "phrases", "userwords", "voice", "update", "backup", "about", "customkeys", "licenses", "test"];
const ERROR_KEYS = new Set(Object.keys(I18N.zh).filter(key => key.startsWith("error.")));
const progressPercent = {};

function browserLocale() {
    const value = (typeof navigator !== "undefined" && navigator.language) ||
        (window.navigator && window.navigator.language) || "zh-CN";
    return String(value).toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeChoice(value) {
    return ["auto", "zh", "en"].includes(value) ? value : "auto";
}

function normalizeLocale(value) {
    return ["zh", "en"].includes(value) ? value : null;
}

function format(template, values = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_all, name) =>
        values[name] === undefined ? `{${name}}` : String(values[name]));
}

function t(key, values) {
    const dictionary = I18N[uiLocale] || I18N.zh;
    const template = dictionary[key] ?? I18N.zh[key] ?? key;
    return format(template, values);
}

function call(action, ...args) {
    try {
        if (typeof BRIDGE[action] === "function") BRIDGE[action](...args, token);
    } catch (error) {
        console.warn("bridge call failed", action, error);
    }
}

function setTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.className = `theme-${theme}`;
}

/** 左上角 logo 换成真实的输入法应用图标（桥下发 base64）。失败/缺失
 *  时保留「F.」占位方块，幂等：已替换过就不再动 DOM。 */
function applyAppIcon(dataUri) {
    if (!dataUri) return;
    const mark = $("heroLogo");
    if (!mark || mark.dataset.appIcon === "1") return;
    const img = document.createElement("img");
    img.src = dataUri;
    img.alt = "";
    mark.textContent = "";
    mark.append(img);
    mark.dataset.appIcon = "1";
}

function applyLocale() {
    document.documentElement.lang = uiLocale === "zh" ? "zh-CN" : "en";
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach(node => {
        node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(node => {
        node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
        node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    const language = $("uiLanguage");
    if (language) language.value = uiChoice;
    if (lastState) renderDoublePinyin(lastState);
    if (pendingModelConsent) {
        $("modelConsentMessage").textContent = t("model.consent.message", {
            name: pendingModelConsent.name,
            bytes: mb(pendingModelConsent.bytes),
        });
    }
    if (lastModelError) setNote("modelNote", eventText(lastModelError, "error.MODEL_DOWNLOAD_FAILED"));
}

function adoptLocale(state) {
    const choice = normalizeChoice(state && state.uiLanguage);
    if (state && state.uiLanguage !== undefined) uiChoice = choice;
    const resolved = normalizeLocale(state && state.uiLocale);
    const next = resolved || (uiChoice === "auto" ? browserLocale() : uiChoice);
    const changed = next !== uiLocale;
    uiLocale = next;
    if (changed || state && state.uiLanguage !== undefined) applyLocale();
}

function setUiLanguage(choice) {
    uiChoice = normalizeChoice(choice);
    uiLocale = uiChoice === "auto" ? browserLocale() : uiChoice;
    applyLocale();
    call("setUiLanguage", uiChoice);
}

function mb(bytes) {
    return `${(Number(bytes || 0) / 1048576).toFixed(1)} MB`;
}

function modelTitle(model) {
    const key = {
        "streaming-zipformer-bilingual-zh-en": "model.title.streaming",
        "paraformer-zh-small": "model.title.final",
        "offline-punct-zh-en": "model.title.punctuation",
        "online-punct-en": "model.title.punctuation", // Legacy model ID.
    }[String(model && model.id || "")];
    return key ? t(key) : String(model && (model.title || model.id) || "");
}

function activeKeyboardVersion(state) {
    return (state.update && state.update.activeVersion) || state.keyboardVersion || "?";
}

function statusSpan(text, className) {
    const span = document.createElement("span");
    span.className = className || "";
    span.textContent = text;
    return span;
}

function setNote(id, text) {
    const node = $(id);
    if (node) node.textContent = text;
}

function eventText(event, fallbackKey, values) {
    const code = String(event && (event.code || event.errorCode) || "");
    const key = code ? `error.${code}` : "";
    if (key && ERROR_KEYS.has(key)) {
        const translated = t(key, values || event);
        const detail = String(event && (event.detail || event.errorDetail) || "").trim();
        return detail ? `${translated} ${detail}` : translated;
    }
    if (event && event.message) return String(event.message);
    if (event && (event.detail || event.errorDetail)) return String(event.detail || event.errorDetail);
    return t(fallbackKey, values);
}

/* --- event channel ----------------------------------------------------- */

window.FeelimeSettings = {
    onBridgeHello(payload) {
        payload = payload || {};
        token = payload.token || "";
        if (payload.theme) setTheme(payload.theme);
        applyAppIcon(payload.appIcon);
        if (payload.uiLanguage !== undefined) uiChoice = normalizeChoice(payload.uiLanguage);
        const helloLocale = normalizeLocale(payload.uiLocale);
        uiLocale = helloLocale || (uiChoice === "auto" ? browserLocale() : uiChoice);
        applyLocale();
        call("ready");
    },

    onEvent(event) {
        if (!event || !event.type) return;
        switch (event.type) {
            case "state":
                lastState = event.state || {};
                if (lastState.theme) setTheme(lastState.theme);
                adoptLocale(lastState);
                render(lastState);
                break;
            case "modelProgress":
                renderProgress(event);
                break;
            case "modelDownloadConfirmation":
                renderModelConsent(event);
                break;
            case "modelDownloadError":
                lastModelError = event;
                if (!pendingModelConsent || pendingModelConsent.id === String(event.id || "")) hideModelConsent();
                setNote("modelNote", eventText(event, "error.MODEL_DOWNLOAD_FAILED"));
                break;
            case "modelImportStatus":
                renderImportStatus(event);
                break;
            case "modelSourceError":
                setNote("modelNote", eventText(event, "error.INVALID_MODEL_SOURCE"));
                break;
            case "customError":
                setNote("customNote", eventText(event, "error.INVALID_CUSTOM_JSON"));
                break;
            case "customPhrasesError":
                setNote("phrasesNote", eventText(event, "error.BAD_PHRASES_PAYLOAD"));
                break;
            case "keySoundError":
                // #30-2：音效文件不可用（超限/损坏）——提示后 state 回推
                // 会把风格弹回实际生效值。
                setNote("feelNote", eventText(event, "error.KEY_SOUND_FILE"));
                break;
            case "userWordsError":
                setNote("userWordsNote", eventText(event, "error.BAD_PHRASES_PAYLOAD"));
                break;
            case "keyboardsError":
                // 排序/勾选保存失败要让用户看见（验收 2026-09-26 问题 A：
                // 参数错位时静默拒绝，UI 还提示「已保存」）。事件比乐观的
                // 「已保存」晚到，覆盖同一 note。
                setNote("keyboardsNote", eventText(event, "error.BAD_KEYBOARD_SELECTION"));
                break;
            case "dictImported":
                setNote("dictImportNote", event.message || "");
                break;
            case "dictBaseProgress":
                onDictBaseProgress(event);
                break;
            case "dictBaseDone":
            case "dictBaseError":
                setNote("dictBaseNote", event.message || "");
                $("dictBaseBuilding").hidden = true;
                dictBasePending = null;
                break;
            case "flypyDone":
            case "flypyError":
                setNote("flypyNote", event.message || "");
                $("flypyBuilding").hidden = true;
                break;
            case "dpSchemeError":
                setNote("dpNote", eventText(event, "error.INVALID_DP_SCHEME"));
                break;
            case "bottomPadError":
            case "candidateFontError":
            case "preeditFontError":
            case "feelOptionsError":
            case "fuzzyPinyinError":
                setNote("feelNote", eventText(event, "error.INVALID_FEEL_OPTION"));
                break;
            case "asrNote":
                setNote("asrNote", eventText(event, "note.saved", {
                    count: event.count, max: event.max || event.maxLines, chars: event.chars || event.maxChars,
                }));
                break;
            case "updateError":
                if (event.confirmable && event.confirmId) {
                    pendingKbSigId = String(event.confirmId);
                    $("kbSigConsent").hidden = false;
                } else if (pendingKbSigId) {
                    // 新的失败事件让旧的确认请求作废。
                    pendingKbSigId = "";
                    $("kbSigConsent").hidden = true;
                }
                setNote("updateStatus", eventText(event, "error.INTERNAL_ERROR"));
                break;
            case "backupStatus":
                renderBackupStatus(event);
                break;
            default:
                break;
        }
    },

    showPage,
    focusSetting,
};

/* --- pages ------------------------------------------------------------- */

let currentPage = "home";

function showPage(name) {
    if (!PAGES.includes(name)) return;
    // #39-12 定制按键页：脏态离开先弹页内确认（改完退出没保存都不
    // 知道——用户验收实录；不用 confirm：WebChromeClient 不处理时恒
    // false 会把用户锁死）。收口在本函数里——包装外层函数会漏掉已
    // 导出的旧引用。ckEnter 同理在进页时统一触发。
    if (typeof ckDirty !== "undefined" && currentPage === "customkeys"
        && name !== "customkeys" && ckDirty) {
        ckLeaveTarget = name;
        document.getElementById("ckLeaveModal").hidden = false;
        return;
    }
    const wasAppearance = currentPage === "appearance" || currentPage === "skin";
    // 页内深链会再次 showPage(本页)：customkeys 此时不能 ckMarkDirty(false)
    // ——脏标被清、内存编辑还在，离开不再确认，改动静默丢失（评审 P3-11）。
    const wasCustomkeys = currentPage === "customkeys";
    currentPage = name;
    document.querySelectorAll("[data-page]").forEach(node => {
        node.hidden = node.dataset.page !== name;
    });
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
    // 外观页预览：真实键盘在屏幕底部弹出、本页窗口被压缩；离开时收起。
    // 皮肤页（从外观拆出）同样要真实键盘预览：调色时看得见效果——进出
    // 两个预览页（appearance↔skin）不收键盘（codex P1：隐藏条件要与
    // 显示条件同一个集合，否则外观→皮肤会把预览键盘收掉）。
    const isPreviewPage = name === "appearance" || name === "skin";
    if (isPreviewPage && !wasAppearance) call("previewKeyboard", true);
    if (!isPreviewPage && wasAppearance) call("previewKeyboard", false);
    // 页面父级随页上报：系统 BACK 逐级返回用。层级唯一事实源是本页
    // ‹ 按钮的 data-back（index.html），壳侧不再维护第二份映射——
    // userwords/customkeys 曾因此各自漂移回 home（用户验收实录）。
    const back = document.querySelector(`.page[data-page="${name}"] .page-back`);
    call("reportPage", name, back?.dataset?.back || "home");
    if (name === "customkeys" && !wasCustomkeys && typeof ckEnter === "function") {
        ckEnter();
        ckMarkDirty(false);
    }
}

/* --- 皮肤滑条显示态（模块级，跨 render 存活）-------------------------- */

// 四个色调/饱和度滑条的本地显示值 + 键面组跟随态。放模块级是因为
// renderFeel 每轮重建局部变量：拖动中的异步 state 回推会连预览带滑条
// 一起拽回旧值（codex R2 复核：焦点守卫只挡 input.value 不够，显示值
// 本身要在拖动期间保留本地值）。
let themeHueShown = 160, themeSatShown = 100;
let keyHueShown = 160, keySatShown = 100;
let keyHueFollow = true, keySatFollow = true;
// 预览素材（用户验收五轮）：按键不透明度 + 亮/暗背景图（state 带
// base64，source=none 时无图）。
let pvKeyAlpha = 1;
let pvBgLightImg = "none", pvBgDarkImg = "none";

// 最终色彩预览（用户验收三轮起持续升级）：任一滑条拖动实时反映。键面
// 组跟随（keyHue/keySat=-1）时用背景组的本地拖动值，脱离跟随后用自己
// 的；不透明度与背景图同样进预览（亮/暗两板各取各的图）。
function updateThemePreview() {
    const pv = $("themePreview");
    if (!pv) return;
    pv.style.setProperty("--pv-hue", String(Math.round(themeHueShown)));
    pv.style.setProperty("--pv-sat", String(themeSatShown / 100));
    const kh = keyHueFollow ? themeHueShown : keyHueShown;
    const ks = keySatFollow ? themeSatShown : keySatShown;
    pv.style.setProperty("--pv-key-hue", String(Math.round(kh)));
    pv.style.setProperty("--pv-key-sat", String(ks / 100));
    pv.style.setProperty("--pv-key-alpha", String(pvKeyAlpha));
    pv.style.setProperty("--pv-bg-img-light", pvBgLightImg);
    pv.style.setProperty("--pv-bg-img-dark", pvBgDarkImg);
}

/* --- render ------------------------------------------------------------ */

function render(state) {
    state = state || {};
    renderIme(state);
    renderDoublePinyin(state);
    renderFeel(state);
    renderVoice(state);
    renderAsr(state);
    renderCustom(state);
    renderKeyboards(state);
    renderCustomPhrases(state);
    renderUserWords(state);
    renderDictBase(state);
    renderFlypy(state);
    renderUpdate(state);
    renderAbout(state);
}

/** 键盘手感（mode-fallback §3/§4）：底部留白 + 长按/滑动/光标微调。
 *  值来自桥接 state（与 IME hello 同一份 prefs 回落逻辑）；取值先对
 *  合法档位白名单校验，避免把 state 里的野值灌进 select。 */
function renderFeel(state) {
    const setSelect = (id, value, allowed) => {
        const node = $(id);
        if (!node) return;
        const text = String(value);
        if (allowed.includes(text) && document.activeElement !== node) node.value = text;
    };
    setSelect("bottomPadPortrait", state.bottomPadPortrait ?? 0, ["0", "12", "24", "36", "48"]);
    setSelect("bottomPadLandscape", state.bottomPadLandscape ?? 0, ["0", "12", "24", "36", "48"]);
    setSelect("candidateFont", state.candidateFont ?? 0, ["0", "1", "2"]);
    setSelect("preeditFont", state.preeditFont ?? 0, ["0", "1", "2"]);
    setSelect("oneHand", state.oneHand ?? 0, ["0", "1", "2"]);
    setSelect("oneHandPad", state.oneHandPad ?? 0, ["0", "15", "25", "35"]);
    setSelect("sideContent", state.sideContent ?? 0, ["0", "1"]);
    // 外观页:色彩模式 + 按键不透明度。
    const themeSel = $("themeMode");
    if (themeSel) {
        const mode = state.themeMode || "auto";
        themeSel.value = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
    }
    // #31 键盘色调：预置色板（单选 swatch 行）+ 自定义色相滑条。
    // 自定义 hue（0-360）优先于预置：有自定义值时滑条亮「已自定义」态
    // 且预置全不选中；-1（未自定义）时滑条停在各预置对应的 hue。
    const swatches = $("themePresetSwatches");
    const hueInput = $("themeHue");
    const hue = Number(state.themeHue);
    const hasCustomHue = Number.isFinite(hue) && hue >= 0 && hue <= 360;
    if (swatches) {
        const current = !hasCustomHue && THEME_PRESET_LIST.includes(state.themePreset)
            ? state.themePreset : "";
        swatches.textContent = "";
        THEME_PRESET_LIST.forEach(id => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "preset-swatch" + (id === current ? " active" : "");
            dot.dataset.preset = id;
            dot.style.setProperty("--sw", THEME_PRESET_COLORS[id] || "#23c890");
            dot.setAttribute("aria-label", t("preset." + id));
            dot.setAttribute("aria-pressed", id === current ? "true" : "false");
            dot.addEventListener("click", () => call("setThemePreset", id));
            swatches.append(dot);
        });
    }
    if (hueInput) {
        // 焦点守卫（与 setSelect 同款）：拖动中的异步 state 回推不得覆盖
        // 本地值——否则旧回包会把滑条拽回旧 hue，松手提交的就是错值。
        // 显示值存模块级（themeHueShown 等）：renderFeel 每轮重建局部
        // let，跳过赋值也保不住上一轮的拖动值（codex R2 复核）。
        if (document.activeElement !== hueInput) {
            themeHueShown = hasCustomHue ? Math.round(hue)
                : PRESET_HUE[THEME_PRESET_LIST.includes(state.themePreset) ? state.themePreset : "classic"] || 160;
            hueInput.value = String(themeHueShown);
            hueInput.style.setProperty("--thumb-hue", String(themeHueShown));
        }
        hueInput.classList.toggle("customized", hasCustomHue);
        hueInput.oninput = () => {
            // 拖动只跟 thumb 颜色与预览（本地），松手才落盘+广播生效
            // （hello 全量重推，拖动实时推会抖）。
            hueInput.style.setProperty("--thumb-hue", hueInput.value);
            const v = Number(hueInput.value);
            if (Number.isFinite(v)) { themeHueShown = Math.max(0, Math.min(360, Math.round(v))); updateThemePreview(); }
        };
        hueInput.onchange = () => {
            const v = Math.round(Number(hueInput.value));
            if (Number.isFinite(v) && v >= 0 && v <= 360) call("setThemeHue", v);
        };
    }
    // 饱和度滑块（黑白灰，用户验收二轮）：0=纯灰度。与 hue 同款焦点
    // 守卫 + 松手提交。
    const satInput = $("themeSat");
    if (satInput) {
        const sat = Number(state.themeSat);
        if (document.activeElement !== satInput) {
            themeSatShown = Number.isFinite(sat) && sat >= 0 && sat <= 100 ? Math.round(sat) : 100;
            satInput.value = String(themeSatShown);
        }
        satInput.oninput = () => {
            const v = Number(satInput.value);
            if (Number.isFinite(v)) { themeSatShown = Math.max(0, Math.min(100, Math.round(v))); updateThemePreview(); }
        };
        satInput.onchange = () => {
            const v = Math.round(Number(satInput.value));
            if (Number.isFinite(v) && v >= 0 && v <= 100) call("setThemeSat", v);
        };
    }
    // 皮肤双组（用户验收四轮+codex 收口）：键面 hue/sat 独立滑条；
    // -1=跟随背景组（饱和度继承标记同样为 -1，100 是显式全彩）。
    const keyHueInput = $("keyHue");
    if (keyHueInput) {
        const kv = Number(state.keyHue);
        const hasKeyHue = Number.isFinite(kv) && kv >= 0 && kv <= 360;
        // 跟随态也受焦点守卫：拖动中（oninput 已置 false）的异步回推
        // 不得把它翻回跟随，否则预览又跳回背景组取值。
        if (document.activeElement !== keyHueInput) keyHueFollow = !hasKeyHue;
        // 焦点守卫覆盖到显示值与预览（模块级变量才有「保留」可言）。
        if (document.activeElement !== keyHueInput) {
            keyHueShown = hasKeyHue ? Math.round(kv) : themeHueShown;
            keyHueInput.value = String(keyHueShown);
            keyHueInput.style.setProperty("--thumb-hue", String(keyHueShown));
        }
        keyHueInput.classList.toggle("customized", hasKeyHue);
        keyHueInput.oninput = () => {
            // 拖动键面滑条=脱离跟随（codex R2-P2：跟随态下拖动预览不动）。
            keyHueFollow = false;
            keyHueInput.style.setProperty("--thumb-hue", keyHueInput.value);
            const v = Number(keyHueInput.value);
            if (Number.isFinite(v)) { keyHueShown = Math.max(0, Math.min(360, Math.round(v))); updateThemePreview(); }
        };
        keyHueInput.onchange = () => {
            const v = Math.round(Number(keyHueInput.value));
            if (Number.isFinite(v) && v >= 0 && v <= 360) call("setKeyHue", v);
        };
        // 键面色调同款取色（用户验收五轮）：预置色板点选=setKeyHue(预置 hue)，
        // 「跟键盘」档=键面组整体还原跟随（hue+sat 都回 -1）；自定义值
        // 恰为某预置 hue 时该档选中。
        const keySwatches = $("keyHueSwatches");
        if (keySwatches) {
            keySwatches.textContent = "";
            const follow = document.createElement("button");
            follow.type = "button";
            follow.className = "preset-swatch follow" + (hasKeyHue ? "" : " active");
            follow.setAttribute("aria-label", t("preset.followKey"));
            follow.setAttribute("aria-pressed", hasKeyHue ? "false" : "true");
            follow.addEventListener("click", () => {
                call("setKeyHue", -1);
                call("setKeySat", -1);
            });
            keySwatches.append(follow);
            THEME_PRESET_LIST.forEach(id => {
                const dot = document.createElement("button");
                dot.type = "button";
                const active = hasKeyHue && Math.round(kv) === PRESET_HUE[id];
                dot.className = "preset-swatch" + (active ? " active" : "");
                dot.style.setProperty("--sw", THEME_PRESET_COLORS[id] || "#23c890");
                dot.setAttribute("aria-label", t("preset." + id));
                dot.setAttribute("aria-pressed", active ? "true" : "false");
                dot.addEventListener("click", () => call("setKeyHue", PRESET_HUE[id]));
                keySwatches.append(dot);
            });
        }
    }
    const keySatInput = $("keySat");
    if (keySatInput) {
        const ks = Number(state.keySat);
        const hasKeySat = Number.isFinite(ks) && ks >= 0 && ks <= 100;
        // 跟随态同受焦点守卫（见 keyHue）。
        if (document.activeElement !== keySatInput) keySatFollow = !hasKeySat;
        if (document.activeElement !== keySatInput) {
            keySatShown = hasKeySat ? Math.round(ks) : themeSatShown;
            keySatInput.value = String(keySatShown);
        }
        keySatInput.oninput = () => {
            // 拖动键面滑条=脱离跟随（同 keyHue）。
            keySatFollow = false;
            const v = Number(keySatInput.value);
            if (Number.isFinite(v)) { keySatShown = Math.max(0, Math.min(100, Math.round(v))); updateThemePreview(); }
        };
        keySatInput.onchange = () => {
            const v = Math.round(Number(keySatInput.value));
            if (Number.isFinite(v) && v >= 0 && v <= 100) call("setKeySat", v);
        };
    }
    // 预览素材先行初始化（不透明度 + 亮/暗背景图），再刷预览。
    const opacity = $("keyOpacity");
    if (opacity) {
        const opPct = Math.max(5, Math.min(100, Number(state.keyOpacity ?? 100)));
        pvKeyAlpha = opPct / 100;
        opacity.value = String(opPct);
    }
    const pvBg = (imgKey, srcKey) => (state[srcKey] && state[srcKey] !== "none" && state[imgKey])
        ? `url(data:image/jpeg;base64,${state[imgKey]})` : "none";
    pvBgLightImg = pvBg("bgImageLight", "bgImageLightSource");
    pvBgDarkImg = pvBg("bgImageDark", "bgImageDarkSource");
    updateThemePreview();
    const bubble = $("keyBubble");
    if (bubble) bubble.checked = state.keyBubble === true;
    const lingerSel = $("bubbleLinger");
    if (lingerSel && document.activeElement !== lingerSel) {
        lingerSel.value = String(state.bubbleLinger ?? 400);
    }
    const kbHeight = $("kbHeight");
    if (kbHeight) {
        const min = Number(state.kbHeightMin ?? 226);
        const max = Number(state.kbHeightMax ?? 400);
        kbHeight.min = String(min);
        kbHeight.max = String(max);
        kbHeight.step = "5";
        // 0 = 默认（键盘内置 272css）；滑块位停在默认值上。
        const saved = Number(state.kbHeightPortrait ?? 0);
        kbHeight.value = String(saved >= min ? saved : 272);
        kbHeight.dataset.default = "272";
    }
    // 背景图两组回显：source = none/builtin/custom（custom 选项按需挂载）。
    [["bgImageLight", "bgImageLightSource"], ["bgImageDark", "bgImageDarkSource"]].forEach(([id, key]) => {
        const sel = $(id);
        if (!sel) return;
        const src = state[key] || "none";
        let opt = sel.querySelector('option[value="custom"]');
        if (src === "custom" && !opt) {
            opt = document.createElement("option");
            opt.value = "custom";
            opt.textContent = t("自定义");
            sel.append(opt);
        }
        if (opt && src !== "custom") opt.remove();
        sel.value = src === "custom" ? "custom" : src;
    });
    setSelect("holdMs", state.holdMs ?? 350, ["200", "300", "350", "450", "600"]);
    setSelect("kbLayout", state.kbLayout === "14" ? "14" : "26", ["26", "14"]);
    setSelect("scrubSpeed", state.scrubSpeed ?? 3, ["1", "2", "3", "4", "5"]);
    const flickSwap = $("flickSwap");
    if (flickSwap) flickSwap.checked = state.flickSwap === true;
    setSelect("popupSnap", state.popupSnap ?? 1, ["0", "1", "2"]);
    const setToggle = (id, value) => {
        const node = $(id);
        if (node && document.activeElement !== node) node.checked = !!value;
    };
    setToggle("keySound", state.keySound);
    const vol = $("keySoundVolume");
    if (vol && document.activeElement !== vol) vol.value = String(state.keySoundVolume ?? 60);
    setSelect("keyHapticStrength", String(state.keyHapticStrength ?? 1), ["0", "1", "2"]);
    // #30-2 音效风格回读：custom 需文件在（native 已保证不悬空），文件行
    // 仅在选了 custom 或已有文件时露出。
    {
        const style = state.keySoundStyle || "default";
        const sel = $("keySoundStyle");
        if (sel && document.activeElement !== sel) sel.value = style;
        const name = $("keySoundName");
        if (name) name.textContent = state.keySoundName
            ? t("feel.keySound.current") + state.keySoundName : t("feel.keySound.none");
        const fileRow = $("keySoundFileRow");
        if (fileRow) fileRow.hidden = !(style === "custom" || state.keySoundName);
    }
    setToggle("keyHaptic", state.keyHaptic);
    setToggle("preeditBold", state.preeditBold);
}

/** 双拼方案 + 键位图（dp-data.js 的 window.FeelimeDp 提供各方案键位）。 */
function renderDoublePinyin(state) {
    const select = $("dpScheme");
    if (!select) return;
    // 白名单直接取生成数据（dp-data.js 随方案列表再生成，不重复维护）。
    const known = (window.FeelimeDp && window.FeelimeDp.schemes)
        || ["ziranma", "flypy", "sogou"];
    const scheme = known.includes(state.dpScheme)
        ? state.dpScheme : "ziranma";
    if (document.activeElement !== select) select.value = scheme;
    // 模糊音分组开关：按位掩码勾选，焦点所在的组不回写（连续点按不被
    // 异步 state 推送打断）。
    const mask = Number(state.fuzzyPinyinMask) || 0;
    document.querySelectorAll("input[data-fuzzy-bit]").forEach(box => {
        if (document.activeElement === box) return;
        box.checked = (mask & Number(box.dataset.fuzzyBit)) !== 0;
    });
    if (document.activeElement !== $("associationOn")) {
        $("associationOn").checked = !!state.associationOn;
    }
    if (document.activeElement !== $("backspaceAssocOn")) {
        $("backspaceAssocOn").checked = !!state.backspaceAssocOn;
    }
    if (document.activeElement !== $("wxSlashOn")) {
        $("wxSlashOn").checked = !!state.wxSlashOn;
    }
    if (document.activeElement !== $("dynamicDateTimeOn")) {
        $("dynamicDateTimeOn").checked = state.dynamicDateTimeOn !== false;
    }
    $("dpNote").textContent = t(`input.double.note.${select.value}`);
    renderDpKeymap(select.value);
}

function renderDpKeymap(scheme) {
    const host = $("dpKeymap");
    if (!host) return;
    host.replaceChildren();
    const data = window.FeelimeDp || {};
    const rows = data.maps && data.maps[scheme];
    if (!Array.isArray(rows)) return;
    const caption = document.createElement("div");
    caption.className = "hint block";
    caption.textContent = t("input.double.mapCaption");
    host.append(caption);
    // [key, final1, final2|null, initial|null] per cell; two finals stack
    // inside the key, V's short pair shares one line ("ui ü").
    rows.forEach(cells => {
        const row = document.createElement("div");
        row.className = "kmap-row";
        cells.forEach(([key, first, second, initial]) => {
            const cell = document.createElement("div");
            cell.className = "kmap-key";
            const cap = document.createElement("b");
            cap.textContent = key === ";" ? ";" : key.toUpperCase();
            cell.append(cap);
            [first, second].forEach(final => {
                if (!final) return;
                const fin = document.createElement("span");
                fin.textContent = final;
                cell.append(fin);
            });
            if (initial) {
                const ini = document.createElement("i");
                ini.textContent = initial;
                cell.append(ini);
            }
            row.append(cell);
        });
        host.append(row);
    });
}

function renderIme(state) {
    const ime = state.ime || {};
    setLed("imeEnabledRow", !!ime.enabled);
    setLed("imeDefaultRow", !!ime.isDefault);
    $("btnEnableIme").hidden = !!ime.enabled;
    $("btnPickIme").hidden = !!ime.isDefault;
}

function setLed(rowId, ok) {
    const row = $(rowId);
    if (!row) return;
    const led = row.querySelector("[data-led]");
    if (led) led.className = `led ${ok ? "ok" : "warn"}`;
}

function renderVoice(state) {
    if (document.activeElement !== $("voiceOnSpace")) {
        $("voiceOnSpace").checked = state.voiceOnSpace !== false;
    }
    if (document.activeElement !== $("modelBackend")) {
        $("modelBackend").value = state.modelBackend === "remote" ? "remote" : "auto";
    }
    const source = state.modelDownloadSource || {};
    if (document.activeElement !== $("modelDownloadSource")) {
        $("modelDownloadSource").value = ["official", "custom", "gitee"].includes(source.mode) ? source.mode : "hf_mirror";
    }
    if (document.activeElement !== $("modelDownloadCustom")) {
        $("modelDownloadCustom").value = source.customBase || "";
    }
    if (document.activeElement !== $("modelDownloadArchive")) {
        $("modelDownloadArchive").value = source.customArchiveUrl || "";
    }
    const customVisible = $("modelDownloadSource").value === "custom";
    $("modelDownloadCustom").hidden = !customVisible;
    $("modelDownloadCustomLabel").hidden = !customVisible;
    $("modelDownloadArchive").hidden = !customVisible;
    $("modelDownloadArchiveLabel").hidden = !customVisible;
    const mic = state.mic || {};
    setLed("micRow", !!mic.granted);
    $("btnMic").hidden = !!mic.granted;
    const host = $("modelRows");
    const models = Array.isArray(state.models) ? state.models : [];
    const existing = new Map([...host.querySelectorAll(".model")].map(node => [node.dataset.id, node]));
    const current = new Set();
    models.forEach(model => {
        current.add(model.id);
        let node = existing.get(model.id);
        if (!node) {
            node = buildModelRow(model);
            host.append(node);
        }
        updateModelRow(node, model);
    });
    existing.forEach((node, id) => { if (!current.has(id)) node.remove(); });
}

function buildModelRow(model) {
    const node = document.createElement("div");
    node.className = "model";
    node.dataset.id = model.id;
    node.innerHTML = `
        <div class="model-head">
            <span class="model-name"></span>
            <span class="model-size"></span>
        </div>
        <p class="model-status"></p>
        <div class="progress" hidden><i></i></div>
        <div class="model-actions"></div>`;
    node.querySelector(".model-name").textContent = modelTitle(model);
    node.querySelector(".model-size").textContent = mb(model.sizeBytes);
    const actions = node.querySelector(".model-actions");
    const button = (kind, className, textKey) => {
        const buttonNode = document.createElement("button");
        buttonNode.type = "button";
        buttonNode.className = `btn small ${className}`.trim();
        buttonNode.textContent = t(textKey);
        buttonNode.setAttribute("aria-label", `${t(textKey)}: ${modelTitle(model)}`);
        buttonNode.dataset.action = kind;
        if (kind === "download") buttonNode.addEventListener("click", () => {
            // A retry starts a new request. Do not let a previous failure
            // survive the downloading state or a later locale refresh.
            lastModelError = null;
            setNote("modelNote", "");
            call("downloadModel", model.id);
        });
        if (kind === "cancel") buttonNode.addEventListener("click", () => call("cancelModelDownload"));
        if (kind === "remove") buttonNode.addEventListener("click", () => call("deleteModel", model.id));
        if (kind === "import") buttonNode.addEventListener("click", () => {
            lastModelError = null;
            setNote("modelNote", "");
            call("openModelDocument", model.id);
        });
        return buttonNode;
    };
    actions.append(
        button("download", "primary", "model.download"),
        button("cancel", "", "model.cancel"),
        button("remove", "link", "model.remove"),
        button("import", "", "model.import"),
    );
    return node;
}

function updateModelRow(node, model) {
    const status = node.querySelector(".model-status");
    const bar = node.querySelector(".progress");
    const download = node.querySelector('[data-action="download"]');
    const cancel = node.querySelector('[data-action="cancel"]');
    const remove = node.querySelector('[data-action="remove"]');
    const importer = node.querySelector('[data-action="import"]');
    node.querySelector(".model-name").textContent = modelTitle(model);
    const hasArchive = model.downloadBytes > model.sizeBytes &&
        model.state !== "built_in" && model.state !== "installed";
    node.querySelector(".model-size").textContent = hasArchive
        ? t("model.transferSize", { download: mb(model.downloadBytes), installed: mb(model.sizeBytes) })
        : mb(model.sizeBytes);
    node.querySelectorAll("[data-action]").forEach(button => {
        const key = {
            download: model.state === "broken" ? "model.redownload" : "model.download",
            cancel: "model.cancel",
            remove: "model.remove",
            import: "model.import",
        }[button.dataset.action];
        if (key) {
            button.textContent = t(key);
            button.setAttribute("aria-label", `${t(key)}: ${modelTitle(model)}`);
        }
    });
    status.className = "model-status";
    bar.hidden = true;
    cancel.hidden = true;
    remove.hidden = true;
    importer.hidden = false;
    download.hidden = true;
    switch (model.state) {
        case "built_in":
            if (model.errorCode) {
                status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
                status.classList.add("bad");
                download.textContent = t("model.redownload");
                download.hidden = false;
            } else {
                status.textContent = t("model.builtIn");
                status.classList.add("ok");
            }
            break;
        case "installed":
            if (model.errorCode) {
                status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
                status.classList.add("bad");
                download.textContent = t("model.redownload");
                download.hidden = false;
                remove.hidden = false;
            } else {
                status.textContent = t("model.installed");
                status.classList.add("ok");
                remove.hidden = false;
            }
            break;
        case "downloading":
            status.textContent = t("model.downloading", { percent: lastPercentFor(model.id) });
            status.classList.add("warn");
            bar.hidden = false;
            bar.firstElementChild.style.width = `${lastPercentFor(model.id)}%`;
            cancel.hidden = false;
            importer.hidden = true;
            break;
        case "importing":
            status.textContent = t("model.importing");
            status.classList.add("warn");
            bar.hidden = false;
            cancel.hidden = false;
            importer.hidden = true;
            break;
        case "broken":
            status.textContent = model.errorCode ?
                eventText(model, "error.MODEL_DOWNLOAD_FAILED") : t("model.broken");
            status.classList.add("bad");
            download.textContent = t("model.redownload");
            download.hidden = false;
            break;
        default:
            if (model.errorCode) {
                status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
                status.classList.add("bad");
                download.textContent = t("model.redownload");
            } else {
                status.textContent = t("model.missing", { size: mb(model.downloadBytes || model.sizeBytes) });
                download.textContent = t("model.download");
            }
            download.hidden = false;
            break;
    }
}

function lastPercentFor(id) { return progressPercent[id] ?? 0; }

function renderProgress(event) {
    const percent = Math.max(0, Math.min(100, Number(event.percent) || 0));
    progressPercent[event.id] = percent;
    const node = document.querySelector(`.model[data-id="${event.id}"]`);
    if (!node) return;
    const bar = node.querySelector(".progress");
    const status = node.querySelector(".model-status");
    bar.hidden = false;
    bar.firstElementChild.style.width = `${percent}%`;
    status.textContent = t("model.downloadingBytes", {
        percent, done: mb(event.doneBytes), total: mb(event.totalBytes),
    });
}

function renderImportStatus(event) {
    const node = document.querySelector(`.model[data-id="${event.id}"]`);
    if (!node) return;
    const status = node.querySelector(".model-status");
    const labels = {
        reading: "model.importing",
        validating: "model.importValidating",
        installing: "model.importInstalling",
    };
    status.textContent = t(labels[event.status] || "model.importing");
    status.className = "model-status warn";
}

function renderModelConsent(event) {
    lastModelError = null;
    pendingModelConsent = {
        id: String(event.id || ""),
        name: String(event.name || event.id || ""),
        bytes: Number(event.bytes || 0),
    };
    const consent = $("modelConsent");
    consent.hidden = false;
    $("modelConsentMessage").textContent = t("model.consent.message", {
        name: pendingModelConsent.name,
        bytes: mb(pendingModelConsent.bytes),
    });
    setNote("modelNote", "");
}

function hideModelConsent() {
    pendingModelConsent = null;
    const consent = $("modelConsent");
    if (consent) consent.hidden = true;
}

function renderAsr(state) {
    const asr = state.asr || {};
    if (document.activeElement !== $("hotwords")) $("hotwords").value = asr.hotwords || "";
    if (document.activeElement !== $("stripPeriod")) $("stripPeriod").checked = !!asr.stripPeriod;
}

function renderCustom(state) {
    const custom = state.custom || {};
    $("customSummary").textContent = customSummary(custom.summary);
    const ckStatus = document.getElementById("ckStatus");
    if (ckStatus) ckStatus.textContent = customSummary(custom.summary);
    if (document.activeElement !== $("customEnabled")) $("customEnabled").checked = !!custom.enabled;
    if (document.activeElement !== $("customJson") && !$(`customJson`).value) {
        $("customJson").value = custom.json || "";
    }
}

function customSummary(summary) {
    const raw = String(summary || "");
    if (!raw || raw === "未定制" || raw.toLowerCase() === "no custom keys") return t("custom.none");
    const count = raw.match(/(?:已定制\s*(\d+)|(?:custom keys?\s*)?(\d+)\s*custom keys?)/i);
    return count ? t("custom.count", { count: count[1] || count[2] }) : raw;
}

/* --- custom phrases (issue #17) ----------------------------------------- */

/** 桥侧真相源镜像：state.customPhrases = {enabled, items}。CRUD 都在
 *  这份副本上全量重发（saveCustomPhrases），native 落盘+派生+引擎重载。
 *  初始为 null（state 未到）：全量重发的语义下，拿空表当真相源会把
 *  种子表覆盖清空，所以 CRUD 在 state 到达前一律拒绝。 */
let phraseItems = null;
let phraseEditing = -1;

function phraseState() {
    return { enabled: !!($("phrasesOn").checked), items: phraseItems };
}

/** 设置搜索（验收 2026-09-24，同日二改）：索引到「行」级——每个设置行
 *  （label + 说明小注 + data-keywords 意图词 + 所在卡标题）都是独立条目，
 *  搜「背景」出「亮色背景」「暗色背景」而不是只有「外观」。卡片标题条目
 *  只做兜底：它的行有命中时从结果里隐掉，避免同卡重复。 */
let searchIndex = null;

function buildSearchIndex() {
    const entries = [];
    document.querySelectorAll(".page").forEach(page => {
        const pageName = page.dataset.page;
        if (pageName === "home") return;
        const pageTitle = page.querySelector(".page-title")?.textContent || pageName;
        page.querySelectorAll("section.card").forEach(card => {
            const heading = card.querySelector(".section-heading h2");
            const title = heading?.textContent?.trim() || "";
            const cardKey = heading?.id || title;
            card.querySelectorAll(".row, label.row").forEach(row => {
                // 标签只取主 span：querySelector(".row-label span, .row-label")
                // 会按文档序先命中 .row-label 本身，textContent 连说明小注
                // 一起聚合，标题就脏了。
                const label = row.querySelector(".row-label span") || row.querySelector(".row-label");
                const labelText = label?.textContent?.trim() || "";
                const hintParts = [];
                row.querySelectorAll("small").forEach(node => hintParts.push(node.textContent));
                const keywords = [];
                row.querySelectorAll("[data-keywords]").forEach(node =>
                    keywords.push(node.dataset.keywords));
                // 无名行（纯布局）不入索引；条目文本聚合 label/说明/意图词/卡名。
                if (!labelText && !hintParts.length && !keywords.length) return;
                // 锚 id 优先取行内控件 id（每个设置行都有），其次意图词元素
                // 或行自身——搜索点击与键盘 tile 深链共用 focusSetting(id)。
                const control = row.querySelector("select[id], input[id], button[id]");
                const anchorId = (control && control.id)
                    || row.querySelector("[data-keywords][id]")?.id
                    || row.id
                    || heading?.id
                    || "";
                entries.push({
                    page: pageName,
                    pageTitle,
                    title: labelText || title,
                    desc: hintParts.join(" ").replace(/\s+/g, " ").trim(),
                    anchorId,
                    anchorEl: row,
                    cardKey,
                    rowHit: true,
                    text: [labelText, ...hintParts, ...keywords, title]
                        .filter(Boolean).join(" ").replace(/\s+/g, " "),
                });
            });
            const parts = [title];
            card.querySelectorAll(".row-label span, .row-label small").forEach(node => {
                parts.push(node.textContent);
            });
            entries.push({
                page: pageName,
                pageTitle,
                title,
                desc: "",
                anchorId: heading?.id || "",
                anchorEl: heading || card,
                cardKey,
                rowHit: false,
                text: parts.filter(Boolean).join(" ").replace(/\s+/g, " "),
            });
        });
    });
    return entries;
}

/** 跳转后的呼吸灯提醒：整个设置项背景呼吸三次（约 1.9s）。 */
function flashAnchor(el) {
    if (!el) return;
    el.classList.remove("search-flash");
    void el.offsetWidth; // reflow 让重播动画可靠触发
    el.classList.add("search-flash");
    setTimeout(() => el.classList.remove("search-flash"), 2100);
}

/** 直达某个设置项（搜索点击 / 键盘快捷设置 tile 深链共用）：翻到所在页
 *  → 滚到整行 → 整行呼吸三次提醒。hashtag 同步写入便于定位与自动化
 *  断言。返回 false 表示目标不存在（调用方可以重试）。 */
function focusSetting(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const page = el.closest(".page");
    if (page && page.dataset.page) showPage(page.dataset.page);
    const row = el.closest(".row, label.row, section.card") || el;
    // 全程同步执行，不进 rAF/setTimeout：键盘 tile 深链时 WebView 正从
    // IME 覆盖下恢复，入队的 rAF 回调在 ace 真机上整批丢失；搜索点击
    // 翻到外观页会弹真键盘预览，WebView 被压后台连 setTimeout 都冻结。
    // scrollIntoView 与 hidden 切换都是同步布局，无须等帧；呼吸是 CSS
    // 合成器动画，类挂上就播。
    if (typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ block: "center" });
    }
    flashAnchor(row);
    // 显式带 #：不依赖浏览器对 hash 赋值的规范化（fake DOM/自动化同口径）。
    if (window.location) window.location.hash = "#" + id;
    return true;
}

function runSettingsSearch(query) {
    const box = $("searchResults");
    if (!box) return;
    const q = query.trim().toLowerCase();
    if (!q) { box.hidden = true; box.textContent = ""; return; }
    if (!searchIndex) searchIndex = buildSearchIndex();
    const matched = searchIndex.filter(entry => entry.text.toLowerCase().includes(q));
    // 标题命中排在说明/关键词命中前面（皮肤页重排后「背景」的首中曾
    // 变成说明里带「背景」二字的键面色调——用户搜标题词要的是那个设置）。
    matched.sort((a, b) =>
        (b.title.toLowerCase().includes(q) ? 1 : 0) - (a.title.toLowerCase().includes(q) ? 1 : 0));
    // 卡兜底条目在同卡有行命中时让位——行级条目就是更准的答案。
    const rowCards = new Set(matched.filter(e => e.rowHit).map(e => e.cardKey));
    const hits = matched.filter(e => e.rowHit || !rowCards.has(e.cardKey)).slice(0, 12);
    box.textContent = "";
    if (!hits.length) {
        const empty = document.createElement("p");
        empty.className = "search-empty";
        empty.textContent = t("search.noResults");
        box.append(empty);
    } else {
        hits.forEach(entry => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-hit";
            const main = document.createElement("span");
            main.className = "search-hit-main";
            const label = document.createElement("span");
            label.textContent = entry.title || entry.pageTitle;
            main.append(label);
            if (entry.desc) {
                const desc = document.createElement("small");
                desc.className = "search-hit-desc";
                desc.textContent = entry.desc;
                main.append(desc);
            }
            const where = document.createElement("small");
            where.className = "search-hit-page";
            where.textContent = entry.pageTitle;
            button.append(main, where);
            button.addEventListener("click", () => {
                $("settingsSearch").value = "";
                box.hidden = true;
                if (entry.anchorId) {
                    focusSetting(entry.anchorId);
                } else {
                    showPage(entry.page);
                    // 同 focusSetting：同步执行（rAF/setTimeout 在 WebView
                    // 恢复/冻结窗口都会丢）。
                    if (entry.anchorEl) {
                        if (typeof entry.anchorEl.scrollIntoView === "function") {
                            entry.anchorEl.scrollIntoView({ block: "center" });
                        }
                        flashAnchor(entry.anchorEl);
                    }
                }
            });
            box.append(button);
        });
    }
    box.hidden = false;
}

$("settingsSearch").addEventListener("input", event => runSettingsSearch(event.target.value));

/** 键盘选择（验收 2026-09-24）：菜单模式勾选 + 快捷切换对。真相源在
 *  键盘 localStorage、经 pushStores 镜像原生（备份走原生）；保存写同一
 *  镜像（saveKeyboardSelection），键盘 hello 的 pullStores 按 rev 落地。 */
function selectedMenuModes(state) {
    const raw = (state.keyboards && state.keyboards.menuModes) || "";
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed.filter(x => typeof x === "string");
    } catch (_) { /* unset */ }
    return DEFAULT_MENU_MODES.slice();
}

function selectedQuickPair(state) {
    const raw = (state.keyboards && state.keyboards.quickPair) || "";
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed;
    } catch (_) { /* unset */ }
    return ["pinyin", "direct"];
}

/** 排序真相源（评审 P1 修正）：键盘长按菜单/快捷设置拖拽共用的全序是
 *  feelime_mode_order（键盘侧 orderedModeNames：已知项过滤 + 未列补齐）。
 *  这里做同语义展开；无存序时回 null（渲染落目录序）。 */
function selectedModeOrder(state) {
    const raw = (state.keyboards && state.keyboards.modeOrder) || "";
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
            const known = parsed.filter(id => KEYBOARD_MODES.some(([m]) => m === id));
            KEYBOARD_MODES.forEach(([id]) => { if (!known.includes(id)) known.push(id); });
            return known;
        }
    } catch (_) { /* unset */ }
    return null;
}

function renderKeyboards(state) {
    const host = $("kbModeList");
    if (!host) return;
    const selected = selectedMenuModes(state);
    host.textContent = "";
    // 排序能力（2026-09-26 用户反馈；评审 P1 修正真相源）：行序 =
    // feelime_mode_order（长按菜单与键盘快捷设置拖拽共用），勾选只决定
    // 谁进菜单。上下移重排全序并即时保存。行是 div 包 label：按钮放在
    // label 外，点按钮不会带翻勾选框。
    const ordered = selectedModeOrder(state) || KEYBOARD_MODES.map(([id]) => id);
    ordered.forEach((id) => {
        const found = KEYBOARD_MODES.find(([modeId]) => modeId === id);
        const label = found ? found[1] : id;
        const row = document.createElement("div");
        row.className = "row switch-row";
        const btns = document.createElement("span");
        btns.className = "kb-order-btns";
        // 拖动把手（用户验收二轮拍板：箭头按钮移除，拖动是唯一排序方式）。
        const drag = document.createElement("button");
        drag.type = "button";
        drag.className = "btn small kb-drag";
        drag.textContent = "≡";
        drag.setAttribute("aria-label", t("input.keyboards.drag"));
        drag.addEventListener("pointerdown", (e) => beginKbRowDrag(e, row, drag));
        btns.append(drag);
        const lab = document.createElement("label");
        lab.className = "kb-order-label";
        lab.htmlFor = "kbMode_" + id;
        const text = document.createElement("span");
        text.className = "row-label";
        const main = document.createElement("span");
        main.textContent = label;
        text.append(main);
        const box = document.createElement("input");
        box.type = "checkbox";
        box.id = "kbMode_" + id;
        box.className = "toggle";
        box.dataset.kbMode = id;
        box.checked = selected.includes(id);
        box.addEventListener("change", () => saveKeyboardSelectionFromUi());
        lab.append(text, box);
        row.append(btns, lab);
        host.append(row);
    });
    renderQuickPairSelects(state);
}



/** 拖动重排（≡ 把手）：pointer capture 跟手，拖动行中心越过相邻行中心
 *  即让位（insertBefore 实时换位），松手按 DOM 序保存——与 ↑↓/勾选共
 *  用 saveKeyboardSelectionFromUi，落同一份 feelime_mode_order。 */
function beginKbRowDrag(e, row, handle) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const host = row.parentElement;
    if (!host) return;
    const pid = e.pointerId;
    let startY = e.clientY;
    let moved = false;
    // capture 与 move/up 监听挂 host（列表容器）而非 handle：让位的
    // insertBefore 会移除再插回整行，Chromium 在元素移除路径清掉
    // pending capture，绑在 handle 上的监听第一次换位后就收不到 up——
    // 拖动挂死且不保存（codex 二轮 P1-2）。host 不随重排移动。
    try { host.setPointerCapture(pid); } catch (_) { /* 已释放 */ }
    const move = (ev) => {
        if (ev.pointerId !== pid) return;
        if (!moved && Math.abs(ev.clientY - startY) < 6) return;
        moved = true;
        row.classList.add("dragging");
        // 指针 y 直接映射目标位（用户验收二轮：逐格让位=只能动一格，
        // 与箭头无异）。对非拖动兄弟行做落点命中：插到第一个中心超过
        // 指针的行之前；指针越过全部行则落末尾。拖多远落多远。
        const siblings = [...host.children].filter(r => r !== row);
        let anchor = null;
        for (const sib of siblings) {
            const rc = sib.getBoundingClientRect();
            if (ev.clientY < rc.top + rc.height / 2) { anchor = sib; break; }
        }
        const inPlace = anchor ? row.nextSibling === anchor : host.lastElementChild === row;
        if (!inPlace) host.insertBefore(row, anchor);
    };
    const finish = (ev) => {
        if (ev.pointerId !== pid && ev.type !== "lostpointercapture") return;
        try { host.releasePointerCapture(pid); } catch (_) { /* 无捕获 */ }
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerup", finish);
        host.removeEventListener("pointercancel", finish);
        host.removeEventListener("lostpointercapture", finish);
        row.classList.remove("dragging");
        if (moved) saveKeyboardSelectionFromUi();
    };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", finish);
    host.addEventListener("pointercancel", finish);
    host.addEventListener("lostpointercapture", finish);
}

function renderQuickPairSelects(state) {
    const selected = selectedMenuModes(state);
    const pair = selectedQuickPair(state);
    [$("quickPairA"), $("quickPairB")].forEach((sel, slot) => {
        if (!sel) return;
        sel.textContent = "";
        KEYBOARD_MODES.forEach(([id, label]) => {
            if (!selected.includes(id)) return;
            const option = document.createElement("option");
            option.value = id;
            option.textContent = label;
            sel.append(option);
        });
        if (!selected.includes(pair[slot])) sel.value = selected[0] || "";
        else sel.value = pair[slot];
        if (sel.dataset.bound !== "1") {
            sel.dataset.bound = "1";
            sel.addEventListener("change", () => saveKeyboardSelectionFromUi());
        }
    });
}

function saveKeyboardSelectionFromUi() {
    const boxes = [...document.querySelectorAll("#kbModeList input[data-kb-mode]")];
    const order = boxes.map(box => box.dataset.kbMode);
    const modes = boxes.filter(box => box.checked).map(box => box.dataset.kbMode);
    if (!modes.length) {
        setNote("keyboardsNote", t("input.keyboards.hint"));
        return;
    }
    const pair = [$("quickPairA").value || modes[0], $("quickPairB").value || modes[0]]
        .filter(id => modes.includes(id));
    while (pair.length < 2) pair.push(modes.find(m => !pair.includes(m)) || modes[0]);
    // 全序（含未勾项）落 feelime_mode_order——长按菜单/快捷设置拖拽的
    // 共用真相源；勾选集落 feelime_menu_modes。
    call("saveKeyboardSelection", JSON.stringify(modes), JSON.stringify(pair.slice(0, 2)), JSON.stringify(order));
    renderQuickPairSelects({ keyboards: { menuModes: JSON.stringify(modes), quickPair: JSON.stringify(pair.slice(0, 2)), modeOrder: JSON.stringify(order) } });
    setNote("keyboardsNote", t("input.keyboards.saved"));
}

function renderCustomPhrases(state) {
    const phrases = state.customPhrases;
    if (phrases) {
        phraseItems = (phrases.items || []).map(item => ({
            text: String(item.text || ""), code: String(item.code || ""),
        }));
        if (document.activeElement !== $("phrasesOn")) $("phrasesOn").checked = !!phrases.enabled;
        if (document.activeElement !== $("englishWordsOn")) $("englishWordsOn").checked = phrases.englishEnabled !== false;
        const posSel = $("englishPos");
        if (posSel) {
            const pos = [ -1, 1, 3, 5 ].includes(Number(state.englishPos)) ? Number(state.englishPos) : -1;
            if (document.activeElement !== posSel) posSel.value = String(pos);
            if (!posSel.dataset.bound) {
                posSel.dataset.bound = "1";
                posSel.addEventListener("change", () => {
                    const v = Number(posSel.value);
                    if ([ -1, 1, 3, 5 ].includes(v)) call("setEnglishPos", v);
                });
            }
        }
        renderPhraseList();
        const imported = phrases.importedCount || 0;
        const note = $("dictImportNote");
        if (note) {
            // 导入事件的具体消息（含截断说明）优先保留；归零（清空）时
            // 旧消息必须撤掉——否则「Imported 4 entries」在清空后仍挂着
            // （glm-flash 真机验证抓到的 UI bug）。
            if (imported === 0 || !note.textContent) {
                note.textContent = imported
                    ? t("input.phrases.importedCount", [imported])
                    : "";
            }
        }
        const clear = $("btnClearImportedDict");
        if (clear) clear.hidden = imported === 0;
        // 重渲染（导入/清空/语言切换）撤掉可能残留的确认态。
        if (clearDictArmed) disarmClearDict();
    }
}

/** state 未到（bridge 慢/页面刚开）时 CRUD 一律不发——全量重发语义下
 *  空表会覆盖种子。 */
function phraseStateReady() {
    if (phraseItems !== null) return true;
    setNote("phrasesNote", t("phrases.err.notReady"));
    return false;
}

function renderPhraseList() {
    const list = $("phraseList");
    list.textContent = "";
    phraseItems.forEach((item, index) => {
        const row = document.createElement("li");
        row.className = "phrase-row";
        const label = document.createElement("button");
        label.type = "button";
        label.className = "phrase-edit";
        const text = document.createElement("span");
        text.className = "phrase-text";
        text.textContent = item.text;
        const code = document.createElement("code");
        code.textContent = item.code;
        label.append(text, code);
        label.addEventListener("click", () => startPhraseEdit(index));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "phrase-del";
        del.textContent = "✕";
        del.setAttribute("aria-label", t("phrases.note.deleted"));
        del.addEventListener("click", () => {
            if (!phraseStateReady()) return;
            phraseItems.splice(index, 1);
            if (phraseEditing === index) resetPhraseForm();
            if (phraseEditing > index) phraseEditing -= 1;
            savePhrases();
            setNote("phrasesNote", t("phrases.note.deleted"));
        });
        row.append(label, del);
        list.append(row);
    });
    $("phraseEmpty").hidden = phraseItems.length > 0;
}

function startPhraseEdit(index) {
    phraseEditing = index;
    $("phraseText").value = phraseItems[index].text;
    $("phraseCode").value = phraseItems[index].code;
    $("btnSavePhrase").textContent = t("phrases.form.save");
    $("btnCancelPhraseEdit").hidden = false;
}

function resetPhraseForm() {
    phraseEditing = -1;
    $("phraseText").value = "";
    $("phraseCode").value = "";
    $("btnSavePhrase").textContent = t("phrases.form.add");
    $("btnCancelPhraseEdit").hidden = true;
}

function savePhrases() {
    const payload = phraseItems.map(item => ({ text: item.text, code: item.code }));
    call("saveCustomPhrases", JSON.stringify(payload), phraseState().enabled);
}

$("phrasesOn").addEventListener("change", event => {
    if (!phraseStateReady()) return;
    call("saveCustomPhrases",
        JSON.stringify(phraseItems.map(item => ({ text: item.text, code: item.code }))),
        event.target.checked);
    setNote("phrasesNote", t("phrases.note.saved"));
});

// #29-3 英文词直出：内置词表整体开关（词表不进增删 UI）。
$("englishWordsOn").addEventListener("change", event => {
    call("setEnglishWords", event.target.checked);
});
$("btnManagePhrases").addEventListener("click", () => showPage("phrases"));
$("btnOpenLicenses").addEventListener("click", () => showPage("licenses"));
// 词库导入（issue #37）：SAF 选择 .dict.yaml → 壳侧解析进 imported 段。
$("btnImportDict").addEventListener("click", () => call("openDictDocument"));
$("btnBaseDictPick").addEventListener("click", () => call("openBaseDictDocument"));

/** 基底编译是黑盒（librime maintenance），无百分比——用阶段 + 已耗时
 *  提示；用户可离开页面，完成/失败由 dictBaseDone/dictBaseError 收尾。 */
function dictBaseStageText(stage, elapsedMs) {
    if (stage === "ACTIVATING") return t("dict.base.stageActivate");
    const seconds = Math.round((elapsedMs || 0) / 1000);
    const label = stage === "COPYING" ? t("dict.base.stageCopy") : t("dict.base.stageCompile");
    return stage === "COPYING" ? label : `${label}（${t("dict.base.elapsed", [seconds])}）`;
}

/** 切换目标（用户点选的 radio 值）：编译期间文案必须标出「实际生效 +
 *  切换目标」（用户裁定——曾只有上一步的「已恢复内置词库」残留，分不清
 *  现在用的哪个）。页面开着时它先于 state 推送可用；页面重开由
 *  state.baseDict.targetSlot（Kotlin pendingSlotId）恢复同一信息。 */
let dictBasePending = null;

function dictBaseBuildingText(base) {
    const stage = dictBaseStageText(base.stage || "COMPILING", base.elapsedMs);
    const target = base.building && (base.targetSlot || dictBasePending);
    if (!target) return stage;
    let label = null;
    if (target === "builtin") label = t("dict.base.builtin");
    else {
        const slot = (Array.isArray(base.slots) ? base.slots : [])
            .find(s => s && s.id === target);
        label = slot ? String(slot.name || slot.id) : null;
    }
    if (!label) return stage;
    const effective = base.mode === "custom" && base.name
        ? t("dict.base.custom", [base.name])
        : t("dict.base.builtin");
    return t("dict.base.switching", [effective, label]) + stage;
}

function onDictBaseProgress(event) {
    if (event.operation === "flypy") {
        $("flypyBuilding").hidden = false;
        $("flypyBuilding").textContent = dictBaseStageText(event.stage, event.elapsedMs);
        return;
    }
    const building = $("dictBaseBuilding");
    building.hidden = false;
    building.textContent = dictBaseBuildingText({
        ...(lastState && lastState.baseDict),
        stage: event.stage,
        elapsedMs: event.elapsedMs,
        building: true,
    });
}

/** state.baseDict: {mode, building, stage, elapsedMs, name, installedAt}——
 *  编译中离开再进设置页，提示行从 state 快照恢复（不丢进度文本）。 */
function renderDictBase(state) {
    const base = state.baseDict || {};
    const when = base.installedAt
        ? new Date(base.installedAt).toLocaleString() : "";
    // #7 多槽列表：内置 + 已导入槽。radio 点选 = 激活（槽重编，免 SAF）；
    // 「恢复内置」并入列表第一项（激活内置 = revert），槽行尾「删除」。
    const host = $("dictBaseSlots");
    if (host) {
        host.textContent = "";
        const building = !!base.building;
        const mkRow = (value, label, note, delSlot) => {
            const row = document.createElement("label");
            row.className = "dict-slot";
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "dictBaseChoice";
            radio.value = value;
            radio.disabled = building;
            row.append(radio);
            const labelBox = document.createElement("span");
            labelBox.className = "slot-label";
            const main = document.createElement("span");
            main.textContent = label;
            labelBox.append(main);
            if (note) {
                const small = document.createElement("small");
                small.textContent = note;
                labelBox.append(small);
            }
            row.append(labelBox);
            if (delSlot) {
                const del = document.createElement("button");
                del.type = "button";
                del.className = "slot-del";
                del.textContent = t("dict.slot.delete");
                del.disabled = building;
                del.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    call("deleteBaseDictSlot", delSlot);
                });
                row.append(del);
            }
            radio.addEventListener("change", () => {
                // 清上一步的残留提示（曾把「已恢复内置词库」带进整个
                // 切换期）；目标记进 dictBasePending 供 building 文案用。
                setNote("dictBaseNote", "");
                dictBasePending = radio.value;
                if (radio.value === "builtin") call("clearBaseDict");
                else call("activateBaseDictSlot", radio.value);
            });
            host.append(row);
        };
        const active = base.activeSlot || null;
        const slots = Array.isArray(base.slots) ? base.slots : [];
        mkRow("builtin", t("dict.base.builtin"),
            t("dict.base.builtinNote"));
        slots.forEach(slot => mkRow(slot.id,
            String(slot.name || slot.id),
            `${t("dict.base.entries", [slot.entries])}${slot.installedAt ? " · " + new Date(slot.installedAt).toLocaleString() : ""}`,
            slot.id));
        // 选中态不走属性选择器（部分环境不支持）：遍历比对 value。
        // 编译期指向切换目标（targetSlot），成功后 activeSlot 接棒——
        // 曾在 revert 后整场编译都显示「内置」选中，误导实际生效项。
        const want = (building && base.targetSlot) || active || "builtin";
        host.querySelectorAll("input").forEach(input => {
            if (input.type === "radio") input.checked = input.value === want;
        });
    }
    const current = $("dictBaseCurrent");
    if (current) current.textContent = base.mode === "custom" && base.name
        ? `${t("dict.base.custom", [base.name])} · ${when}`
        : t("dict.base.builtin");
    // #37：形码/音形特征持续警示（换回内置或导入拼音系码表即消失）。
    const warn = $("dictBaseNonPinyin");
    if (warn) warn.hidden = !(typeof base.nonPinyin === "number");
    // #35：带调码表（疑似完整版）持续警示。
    const toned = $("dictBaseToned");
    if (toned) toned.hidden = !base.toned;
    // T9 内存门跳编的持续提示（词条量/内存不足）。
    const t9skip = $("dictBaseT9Skip");
    if (t9skip) t9skip.hidden = !base.t9Skipped;
    $("btnBaseDictPick").disabled = !!base.building;
    $("dictBaseBuilding").hidden = !base.building || base.operation === "flypy";
    if (base.building && base.operation !== "flypy") {
        $("dictBaseBuilding").textContent = dictBaseBuildingText(base);
    }
}
$("btnFlypyPick").addEventListener("click", () => call("openFlypyDocument"));
$("btnFlypyRevert").addEventListener("click", () => call("clearFlypy"));

/** state.baseDict.flypy: {installed, name, installedAt}——音形码表独立
 *  状态段（#20）。building 与基底换装共用同一互斥标志。 */
function renderFlypy(state) {
    // baseDict 缺防御：旧 bridge/纯 flypy state 推送没有该段时整卡
    // 渲染直接抛错（mock 套件 62 项连坐挂的根因）。
    const base = state.baseDict || {};
    const flypy = base.flypy || {};
    // #20 幂等补勾选（codex P2-6）：导入成功后音形进长按菜单——放在
    // 渲染层而非 flypyDone 事件里，编译期间退出设置页丢事件的路径
    // （旧 bridge 销毁）也能在下次渲染补上。
    if (flypy.installed) {
        const box = document.querySelector('#kbModeList input[data-kb-mode="flypy"]');
        if (box && !box.checked) {
            box.checked = true;
            saveKeyboardSelectionFromUi();
        }
    }
    const current = $("flypyCurrent");
    const when = flypy.installedAt
        ? new Date(flypy.installedAt).toLocaleString() : "";
    current.textContent = flypy.installed && flypy.name
        ? `${t("flypy.custom", [flypy.name])} · ${when}`
        : t("flypy.none");
    $("btnFlypyRevert").hidden = !flypy.installed || !!base.building;
    $("btnFlypyPick").disabled = !!base.building;
    const building = $("flypyBuilding");
    building.hidden = !base.building || base.operation !== "flypy";
    if (base.building && base.operation === "flypy") {
        building.textContent =
            dictBaseStageText(base.stage || "COMPILING", base.elapsedMs);
    }
}
/** 清空导入词的两击确认（#39 补充建议）：WebView 无原生 confirm
 *  （WebChromeClient 未挂 onJsConfirm），首击变红「确认清空」，4s 内
 *  再击才执行；超时或重新渲染恢复。 */
let clearDictArmed = null;
function disarmClearDict() {
    clearTimeout(clearDictArmed);
    clearDictArmed = null;
    const btn = $("btnClearImportedDict");
    btn.classList.remove("danger");
    btn.textContent = t("input.phrases.clearBtn");
}
$("btnClearImportedDict").addEventListener("click", () => {
    if (clearDictArmed) {
        disarmClearDict();
        call("clearImportedDict");
        return;
    }
    const btn = $("btnClearImportedDict");
    btn.classList.add("danger");
    btn.textContent = t("input.phrases.confirmClear");
    clearDictArmed = setTimeout(disarmClearDict, 4000);
});
$("btnCancelPhraseEdit").addEventListener("click", resetPhraseForm);
$("btnSavePhrase").addEventListener("click", () => {
    if (!phraseStateReady()) return;
    const text = $("phraseText").value.trim();
    const code = $("phraseCode").value.trim().toLowerCase();
    // 校验与壳侧 saveCustomPhrases 一致：词条非空 + 码 1-16 位字母。
    if (!text) {
        setNote("phrasesNote", t("phrases.form.text"));
        return;
    }
    if (!/^[a-z;]{1,16}$/.test(code)) {
        setNote("phrasesNote", t("phrases.form.code"));
        return;
    }
    if (phraseEditing >= 0) {
        phraseItems[phraseEditing] = { text, code };
    } else {
        if (phraseItems.some(item => item.code === code)) {
            setNote("phrasesNote", t("phrases.err.duplicate"));
            return;
        }
        // 与壳侧 saveCustomPhrases 同一条上限：先在本地拒绝，避免 push
        // 后被 native 打回、页面副本却已带着第 201 条继续全量重发。
        if (phraseItems.length >= 200) {
            setNote("phrasesNote", t("phrases.err.limit"));
            return;
        }
        phraseItems.push({ text, code });
    }
    savePhrases();
    resetPhraseForm();
    setNote("phrasesNote", t("phrases.note.saved"));
});

/* --- 自造词（issue #29-5）：词库管理的三级编辑页，镜像候选符号词。
 * state.userWords = [{text,code}]，CRUD 全量重发 saveUserWords，native
 * 落盘 json 的 user 段 + 派生 txt + 广播引擎重载。 */
let userWordItems = null;
let userWordEditing = -1;

function renderUserWords(state) {
    const words = state.userWords;
    if (!words) return;
    userWordItems = words.map(item => ({
        text: String(item.text || ""), code: String(item.code || ""),
    }));
    renderUserWordList();
    const count = $("userWordsCount");
    if (count) count.textContent = userWordItems.length
        ? t("userwords.count", [userWordItems.length]) : "";
}

function userWordStateReady() {
    if (userWordItems !== null) return true;
    setNote("userWordsNote", t("userwords.err.notReady"));
    return false;
}

function renderUserWordList() {
    const list = $("userWordList");
    list.textContent = "";
    userWordItems.forEach((item, index) => {
        const row = document.createElement("li");
        row.className = "phrase-row";
        const label = document.createElement("button");
        label.type = "button";
        label.className = "phrase-edit";
        const text = document.createElement("span");
        text.className = "phrase-text";
        text.textContent = item.text;
        const code = document.createElement("code");
        code.textContent = item.code;
        label.append(text, code);
        label.addEventListener("click", () => startUserWordEdit(index));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "phrase-del";
        del.textContent = "✕";
        del.setAttribute("aria-label", t("userwords.note.deleted"));
        del.addEventListener("click", () => {
            if (!userWordStateReady()) return;
            userWordItems.splice(index, 1);
            if (userWordEditing === index) resetUserWordForm();
            if (userWordEditing > index) userWordEditing -= 1;
            saveUserWordsToBridge();
            setNote("userWordsNote", t("userwords.note.deleted"));
        });
        row.append(label, del);
        list.append(row);
    });
    $("userWordEmpty").hidden = userWordItems.length > 0;
}

function startUserWordEdit(index) {
    userWordEditing = index;
    $("userWordText").value = userWordItems[index].text;
    $("userWordCode").value = userWordItems[index].code;
    $("btnSaveUserWord").textContent = t("userwords.form.save");
    $("btnCancelUserWordEdit").hidden = false;
}

function resetUserWordForm() {
    userWordEditing = -1;
    $("userWordText").value = "";
    $("userWordCode").value = "";
    $("btnSaveUserWord").textContent = t("userwords.form.add");
    $("btnCancelUserWordEdit").hidden = true;
}

function saveUserWordsToBridge() {
    const payload = userWordItems.map(item => ({ text: item.text, code: item.code }));
    call("saveUserWords", JSON.stringify(payload));
    const count = $("userWordsCount");
    if (count) count.textContent = userWordItems.length
        ? t("userwords.count", [userWordItems.length]) : "";
}

$("btnManageUserWords").addEventListener("click", () => showPage("userwords"));
$("btnCancelUserWordEdit").addEventListener("click", resetUserWordForm);
$("btnSaveUserWord").addEventListener("click", () => {
    if (!userWordStateReady()) return;
    const text = $("userWordText").value.trim();
    const code = $("userWordCode").value.trim().toLowerCase();
    // 校验与壳侧 saveUserWords 一致：词条非空 + 码 1-48 位字母。
    if (!text) {
        setNote("userWordsNote", t("userwords.form.textErr"));
        return;
    }
    // 码可留空：空 = 自动注音（壳侧 autoPinyinCodes 生成主码，txt 侧展开
    // 多音字全组合 + 双拼键序）；填了才校验格式。
    if (code && !/^[a-z;]{1,48}$/.test(code)) {
        setNote("userWordsNote", t("userwords.form.codeErr"));
        return;
    }
    if (userWordEditing >= 0) {
        userWordItems[userWordEditing] = { text, code };
    } else {
        if (code && userWordItems.some(item => item.code === code)) {
            setNote("userWordsNote", t("userwords.err.duplicate"));
            return;
        }
        if (userWordItems.length >= 200) {
            setNote("userWordsNote", t("userwords.err.limit"));
            return;
        }
        userWordItems.push({ text, code });
    }
    saveUserWordsToBridge();
    resetUserWordForm();
    setNote("userWordsNote", t("userwords.note.saved"));
});

function updateStateLabel(value) {
    const key = `update.states.${String(value || "").toUpperCase()}`;
    return I18N[uiLocale][key] || I18N.zh[key] || String(value || "");
}

function renderUpdate(state) {
    const update = state.update || {};
    if (document.activeElement !== $("updateSource")) $("updateSource").value = update.source || "";
    if (document.activeElement !== $("updateUrl")) $("updateUrl").value = update.url || "";
    if (document.activeElement !== $("autoUpdateCheck")) {
        $("autoUpdateCheck").checked = !!update.autoCheck;
    }
    const source = update.activeSource === "built_in" ? t("update.sourceBuiltIn") : t("update.sourceHot");
    const sourceStatus = update.sourceMode === "disabled" ? t("update.sourceDisabled") :
        update.sourceMode === "custom" ? t("update.sourceCustom") : t("update.sourceDefault");
    const lines = [
        `${source}`,
        t("update.sourceStatus", { value: sourceStatus }),
        t("update.version", { value: update.activeVersion || "?" }),
        update.activeContentHash ? t("update.hash", { value: update.activeContentHash.slice(0, 16) }) : "",
        t("update.state", { value: updateStateLabel(update.state) }),
    ].filter(Boolean);
    const errorCode = String(update.lastErrorCode || "");
    const errorDetail = String(update.lastErrorDetail || "");
    if (errorCode) {
        const translated = eventText({ code: errorCode, detail: errorDetail }, "error.INTERNAL_ERROR");
        lines.push(t("update.lastError", { value: translated }));
    } else if ((update.lastError || "").trim()) {
        lines.push(t("update.lastError", { value: update.lastError.trim() }));
    }
    if (update.lastSuccessAt) lines.push(t("update.lastSuccess", { value: update.lastSuccessAt }));
    $("updateStatus").textContent = lines.join("\n");
    // 三种状态：正常签名（隐藏）/ 确认过的签名不符 / （调试构建）未签名。
    const confirmedBad = update.activeSource === "hot" &&
        !update.activeSigned && !!update.activeSignatureConfirmed;
    $("updateDanger").hidden = !confirmedBad && !(update.activeSource === "hot" && !update.activeSigned);
    $("updateDanger").textContent = t(confirmedBad ? "update.sigConfirmed" : "update.unsigned");
}

function aboutRows(state, opts = {}) {
    const device = state.device || {};
    const release = device.release || "?";
    const sdk = device.sdkInt === undefined ? "?" : device.sdkInt;
    const rows = [
        [t("about.appVersion"), `v${state.appVersion || "?"}`],
        [t("about.activeKeyboard"), `v${activeKeyboardVersion(state)}`],
        [t("about.builtInKeyboard"), `v${state.keyboardVersion || "?"}`],
        [t("about.device"), `${device.manufacturer || ""} ${device.model || ""}`.trim() || "?"],
        [t("about.android"), t("about.androidValue", { release, sdk })],
    ];
    // #41 字数统计（native pref 唯一真相源，state 快照读取）。复制版本
    // 信息（forCopy）不带：计数值随输入漂移，进了诊断贴反而成噪声。
    if (state.inputStats && !opts.forCopy) {
        rows.push([t("about.inputStats"),
            t("about.inputStatsValue", {
                today: state.inputStats.today || 0,
                total: state.inputStats.total || 0,
            })]);
    }
    return rows;
}

function renderAbout(state) {
    $("btnAppStore").hidden = !state.playDistribution;
    // 更新检测入口（关于页）：Play 渠道跳商店由商店管理更新；直装渠道
    // 走 GitHub Releases 检测（见 checkGithubUpdate）。下载按钮只在检测
    // 出新版本后出现，Play 渠道恒隐藏。
    $("btnAboutCheckUpdate").hidden = false;
    // data-i18n 跟着渠道换：translateStaticUi 按 key 重刷文案，静态 key
    // 不换的话语言切换会把 Play 分支的「去 Google Play 更新」洗掉。
    const checkKey = state.playDistribution ? "action.checkUpdatePlay" : "action.checkUpdate";
    $("btnAboutCheckUpdate").dataset.i18n = checkKey;
    $("btnAboutCheckUpdate").textContent = t(checkKey);
    if (state.playDistribution) { $("btnDlThin").hidden = true; $("btnDlFull").hidden = true; }
    setToggleSafe("diagnosticsOn", state.diagnosticsOn);
    const host = $("aboutRows");
    host.replaceChildren();
    aboutRows(state).forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "row";
        const name = document.createElement("span");
        name.className = "row-label";
        name.textContent = label;
        const val = document.createElement("span");
        val.className = "row-value";
        val.textContent = value;
        row.append(name, val);
        host.append(row);
    });
    if ($("noticesText").textContent !== (state.notices || "")) {
        $("noticesText").textContent = state.notices || "";
    }
}

/** 关于页等处的开关回读（与 renderFeel 的 setToggle 同语义：焦点不回写）。 */
function setToggleSafe(id, value) {
    const node = $(id);
    if (node && document.activeElement !== node) node.checked = !!value;
}

/* --- wiring ------------------------------------------------------------ */

$("btnEnableIme").addEventListener("click", () => call("enableIme"));
$("btnPickIme").addEventListener("click", () => call("pickIme"));
$("btnAddShortcut").addEventListener("click", () => call("addImeShortcut"));
$("btnAddTile").addEventListener("click", () => call("addImeTile"));
$("btnMic").addEventListener("click", () => call("requestMic"));
$("uiLanguage").addEventListener("change", event => setUiLanguage(event.target.value));
$("dpScheme").addEventListener("change", event => call("setDoublePinyinScheme", event.target.value));
$("kbLayout").addEventListener("change", event => call("setKbLayout", event.target.value));

// 输入测试框（验收反馈）：多行 textarea 随内容自适应增高，键盘弹出
// 窗口压缩时也完整可见；min-height 兜底 rows=4 的初始高度。
(() => {
    const ta = $("testInput");
    if (!ta) return;
    const fit = () => {
        ta.style.height = "auto";
        ta.style.height = Math.max(96, ta.scrollHeight + 2) + "px";
    };
    ta.addEventListener("input", fit);
    fit();
})();

// 键盘手感（mode-fallback §3/§4）：任一下拉变更即提交三值（-1=不变的是
// 原生侧约定；这里三值总是全部上报，省一次「哪个变了」的状态跟踪）。
function submitFeelOptions() {
    call(
        "setFeelOptions",
        parseInt($("scrubSpeed").value, 10),
        parseInt($("holdMs").value, 10),
        parseInt($("popupSnap").value, 10),
    );
}
$("bottomPadPortrait").addEventListener("change", event => call("setBottomPadPortrait", parseInt(event.target.value, 10)));
$("bottomPadLandscape").addEventListener("change", event => call("setBottomPadLandscape", parseInt(event.target.value, 10)));
$("candidateFont").addEventListener("change", event => call("setCandidateFont", parseInt(event.target.value, 10)));
$("preeditFont").addEventListener("change", event => call("setPreeditFont", parseInt(event.target.value, 10)));
$("preeditBold").addEventListener("change", event => call("setPreeditBold", event.target.checked));
$("oneHand").addEventListener("change", event => call("setOneHandMode", parseInt(event.target.value, 10)));
$("oneHandPad").addEventListener("change", event => call("setOneHandPad", parseInt(event.target.value, 10)));
$("sideContent").addEventListener("change", event => call("setSideContent", parseInt(event.target.value, 10)));
// 外观页:色彩模式 + 键帽不透明度(input 实时预览,松手才落盘一次)。
$("themeMode").addEventListener("change", event => call("setThemeMode", event.target.value));
let keyOpacityDirty = false;
$("keyOpacity").addEventListener("input", event => {
    keyOpacityDirty = true;
    // 拖动实时进预览（用户验收五轮）：不透明度直接影响键帽半透观感。
    const v = parseInt(event.target.value, 10);
    if (Number.isFinite(v)) { pvKeyAlpha = Math.max(0, Math.min(1, v / 100)); updateThemePreview(); }
});
$("keyOpacity").addEventListener("change", event => {
    if (!keyOpacityDirty) return;
    keyOpacityDirty = false;
    call("setKeyOpacity", parseInt(event.target.value, 10));
});
// 按键气泡（issue #30-1）：外观页开关，默认关；广播→hello 实时作用到
// 底下弹出的预览键盘。
$("keyBubble").addEventListener("change", event => call("setKeyBubble", event.target.checked));
$("bubbleLinger").addEventListener("change", event => {
    call("setBubbleLinger", parseInt(event.target.value, 10) || 0);
});
// 键盘高度滑块：拖动即时反映在预览上，松手落盘；「恢复默认」写 0。
let kbHeightDirty = false;
$("kbHeight").addEventListener("input", event => {
    kbHeightDirty = true;
});
$("kbHeight").addEventListener("change", event => {
    if (!kbHeightDirty) return;
    kbHeightDirty = false;
    call("setKbHeight", parseInt(event.target.value, 10));
});
$("kbHeightReset").addEventListener("click", () => {
    const slider = $("kbHeight");
    slider.value = slider.dataset.default || "272";
    call("setKbHeight", 0);
});
// 背景图两组（亮/暗）：「选择图片…」打开文件选择器，选完压到 720px 宽
// JPEG 走桥；「无 / 内置」直接桥调用。选中自定义图后 select 挂「自定义」
// 回显；pick 项本身永不作为状态（取消选择时回退原值）。
[["bgImageLight", "light"], ["bgImageDark", "dark"]].forEach(([id, variant]) => {
    const sel = $(id);
    sel.dataset.prev = "none";
    sel.addEventListener("change", () => {
        const v = sel.value;
        if (v === "none") { call("clearBgImage", variant); sel.dataset.prev = "none"; }
        else if (v === "builtin") { call("setBuiltinBgImage", variant); sel.dataset.prev = "builtin"; }
        else if (v === "custom") { sel.value = sel.dataset.prev; }
        else if (v === "pick") {
            sel.value = sel.dataset.prev;
            pickBgImage(variant);
        }
    });
});
function markBgCustom(variant) {
    const sel = $("bgImage" + (variant === "light" ? "Light" : "Dark"));
    let opt = sel.querySelector('option[value="custom"]');
    if (!opt) {
        opt = document.createElement("option");
        opt.value = "custom";
        opt.textContent = t("自定义");
        sel.append(opt);
    }
    sel.value = "custom";
    sel.dataset.prev = "custom";
}
function pickBgImage(variant) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 720 / img.naturalWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            call("setBgImage", variant, canvas.toDataURL("image/jpeg", 0.72).split(",")[1]);
            markBgCustom(variant);
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    });
    input.click();
}
$("holdMs").addEventListener("change", submitFeelOptions);
$("scrubSpeed").addEventListener("change", submitFeelOptions);
$("flickSwap").addEventListener("change", event => call("setFlickSwap", event.target.checked));
$("popupSnap").addEventListener("change", submitFeelOptions);
$("modelBackend").addEventListener("change", event => call("setModelBackend", event.target.value));
$("voiceOnSpace").addEventListener("change", event => call("setVoiceOnSpace", event.target.checked));
$("modelDownloadSource").addEventListener("change", event => {
    const visible = event.target.value === "custom";
    $("modelDownloadCustom").hidden = !visible;
    $("modelDownloadCustomLabel").hidden = !visible;
    $("modelDownloadArchive").hidden = !visible;
    $("modelDownloadArchiveLabel").hidden = !visible;
});
$("btnSaveModelSource").addEventListener("click", () => {
    call(
        "setModelDownloadSource",
        $("modelDownloadSource").value,
        $("modelDownloadCustom").value || "",
        $("modelDownloadArchive").value || "",
    );
    setNote("modelNote", t("note.saved"));
});
$("modelConsentCancel").addEventListener("click", () => {
    if (!pendingModelConsent) return;
    const id = pendingModelConsent.id;
    hideModelConsent();
    call("confirmModelDownload", id, false);
});
$("modelConsentConfirm").addEventListener("click", () => {
    if (!pendingModelConsent) return;
    const id = pendingModelConsent.id;
    hideModelConsent();
    call("confirmModelDownload", id, true);
});

$("btnSaveAsr").addEventListener("click", () => {
    call("saveAsrSettings", $("stripPeriod").checked, $("hotwords").value);
    setNote("asrNote", t("note.saved"));
});

$("btnSaveCustom").addEventListener("click", () => {
    call("saveCustom", $("customJson").value || "{}", $("customEnabled").checked);
    setNote("customNote", t("note.customSaved"));
});
// 启用开关拨动即生效（#39-2）：此前只随「保存定制」提交，拨了不点
// 保存=从未落盘，重进被回读洗回「开」。
$("customEnabled").addEventListener("change", event => call("setCustomEnabled", event.target.checked));

$("btnCustomTemplate").addEventListener("click", () => {
    // 全功能示例（验收 2026-09-24：模板要覆盖每个特性）——三行各自一类：
    // ①终端/Vim（单键、文本+键混排、组合键）②光标/编辑键 ③短语与符号。
    $("customJson").value = JSON.stringify({
        version: 1,
        rows: [
            [
                { t: "Esc", tap: "[esc]", note: "单键" },
                { t: ":w", tap: ":w[enter]", note: "文本+回车" },
                { t: "整理", tap: "[esc]ggVGD", note: "Vim 删除全文" },
                { t: "保存", tap: "[ctrl+s]", note: "组合键" },
                { t: "F5", tap: "[f5]", note: "功能键" },
            ],
            [
                { t: "←", tap: "[left]", note: "光标" },
                { t: "行首", tap: "[home]" },
                { t: "行尾", tap: "[end]" },
                { t: "删字", tap: "[bs]" },
                { t: "Tab", tap: "[tab]" },
            ],
            [
                { t: "邮箱", tap: "me@example.com", note: "整段文本" },
                { t: "✓", tap: "好的" },
                { t: "→", tap: "→ " },
                { t: "￥", tap: "￥" },
            ],
        ],
    }, null, 2);
});

$("btnCheckUpdate").addEventListener("click", () => call("checkUpdate", $("updateSource").value));
$("autoUpdateCheck").addEventListener("change", event => call("setAutoUpdateCheck", event.target.checked));
$("associationOn").addEventListener("change", event => call("setAssociation", event.target.checked));
$("backspaceAssocOn").addEventListener("change", event => call("setBackspaceAssoc", event.target.checked));
$("wxSlashOn").addEventListener("change", event => call("setWxSlash", event.target.checked));
$("dynamicDateTimeOn").addEventListener("change", event => call("setDynamicDateTime", event.target.checked));
$("keySound").addEventListener("change", event => call("setKeySound", event.target.checked));

$("keySoundVolume").addEventListener("input", event => {
    clearTimeout(keySoundVolumeTimer);
    keySoundVolumeTimer = setTimeout(
        () => call("setKeySoundVolume", Number(event.target.value)), 250);
});
$("keyHapticStrength").addEventListener("change", event => call("setKeyHapticStrength", Number(event.target.value)));

// #30-2 音效风格：custom 但文件还没选过时先走选文件（native 拒绝无文件的
// custom，state 回推会把 select 弹回实际生效值）。

$("keySoundStyle").addEventListener("change", event => {
    if (event.target.value === "custom") call("openKeySoundDocument");
    else call("setKeySoundStyle", event.target.value);
});
$("btnPickKeySound").addEventListener("click", () => call("openKeySoundDocument"));
$("btnClearKeySound").addEventListener("click", () => call("clearKeySoundFile"));
$("keyHaptic").addEventListener("change", event => call("setKeyHaptic", event.target.checked));
document.querySelectorAll("input[data-fuzzy-bit]").forEach(box => {
    box.addEventListener("change", () => {
        let mask = 0;
        document.querySelectorAll("input[data-fuzzy-bit]").forEach(other => {
            if (other.checked) mask |= Number(other.dataset.fuzzyBit);
        });
        call("setFuzzyPinyinMask", mask);
    });
});
$("btnInstallZip").addEventListener("click", () => call("installZip", $("updateUrl").value));
$("btnImportZip").addEventListener("click", () => call("openKeyboardDocument"));
$("btnRestore").addEventListener("click", () => call("restoreBuiltInKeyboard"));

// 备份（docs/design/userdata.md §1）：导出直接拉起系统“保存文件”；
// 导入先弹覆盖确认，确认后才打开文件选择器。
$("btnExportBackup").addEventListener("click", () => call("exportUserdata"));
$("btnImportBackup").addEventListener("click", () => { $("backupConsent").hidden = false; });
$("backupConsentCancel").addEventListener("click", () => { $("backupConsent").hidden = true; });
$("backupConsentConfirm").addEventListener("click", () => {
    $("backupConsent").hidden = true;
    call("openBackupDocument");
});
// 签名不符的确认导入（§3）：凭 confirmId 只对暂存的那一份包生效，
// 取消/确认都会作废它，旧包残留不到下一次操作。
let pendingKbSigId = "";
$("kbSigConsentCancel").addEventListener("click", () => {
    $("kbSigConsent").hidden = true;
    if (pendingKbSigId) call("dismissKeyboardInstall", pendingKbSigId);
    pendingKbSigId = "";
});
$("kbSigConsentConfirm").addEventListener("click", () => {
    $("kbSigConsent").hidden = true;
    if (pendingKbSigId) call("confirmKeyboardInstall", pendingKbSigId);
    pendingKbSigId = "";
});

function renderBackupStatus(event) {
    const exporting = event.direction === "export";
    if (event.ok) {
        setNote("backupNote", t(exporting ? "backup.done.export" : "backup.done.import"));
    } else {
        setNote("backupNote", t(exporting ? "backup.failed.export" : "backup.failed.import") + " " +
            t("backup.error." + String(event.code || "IO_ERROR")));
    }
}

$("diagnosticsOn").addEventListener("change", event => {
    call("setDiagnostics", event.target.checked);
    setNote("diagNote", event.target.checked ? t("diag.on") : t("diag.off"));
});
$("btnExportDiagnostics").addEventListener("click", () => {
    if (!lastState || !lastState.diagnosticsOn) {
        setNote("diagNote", t("diag.off"));
        return;
    }
    call("exportDiagnostics");
    setNote("diagNote", t("diag.exported"));
});
$("btnAppStore").addEventListener("click", () => call("openAppStore"));
// #29-4：关于页开源仓库/问题反馈入口（native 侧只认内置两址）。
$("btnGithubRepo").addEventListener("click", () => call("openGithub", "repo"));
// #29-8：定制键盘 JSON 的官方说明文档（native 只认内置地址）。
$("btnCustomDocs").addEventListener("click", () => call("openDocs"));

/* ===== #39-12 定制按键编辑器（三级页，免 JSON）============================
 * 数据：ckRows = [[cell,...],[],[]]（cell {t,tap,note,span?,color?}），进入
 * 页面时从 state.custom.json 载入；「保存全部」校验后走同一条 saveCustom
 * 桥（JSON 兜底与编辑器共享真相源，textarea 同步刷新）。
 * tap 的可视化构造：文本/单键/组合键/高级 DSL 四型；编辑已有键时按 tap
 * 内容反猜型别（ckTapParse），切型重造。 */
const CK_KEYS = [
    ["esc", "Esc"], ["tab", "Tab"], ["enter", "Enter ⏎"], ["space", "Space"],
    ["backspace", "退格 ⌫"], ["del", "Del"],
    ["left", "←"], ["up", "↑"], ["down", "↓"], ["right", "→"],
    ["home", "Home"], ["end", "End"], ["pgup", "PgUp"], ["pgdn", "PgDn"],
].concat(Array.from({ length: 12 }, (_, i) => ["f" + (i + 1), "F" + (i + 1)]))
    .concat(Array.from({ length: 26 }, (_, i) =>
        [String.fromCharCode(97 + i), String.fromCharCode(65 + i)]))
    .concat(Array.from({ length: 10 }, (_, i) => [String(i), String(i)]));
const CK_KEY_NAME = Object.fromEntries(CK_KEYS);
const CK_MODS = [["ctrl", "Ctrl"], ["alt", "Alt"], ["shift", "Shift"], ["win", "Win"]];
const CK_COLORS = ["blue", "green", "orange", "red", "purple"];
const CK_QUICK = [
    { t: "Esc", tap: "[esc]" },
    { t: "Tab", tap: "[tab]" },
    { t: "⏎", tap: "[enter]" },
    { t: "⌫", tap: "[backspace]", note: "退格，长按连删" },
    { t: "←", tap: "[left]" }, { t: "→", tap: "[right]" },
    { t: "↑", tap: "[up]" }, { t: "↓", tap: "[down]" },
    { t: "Home", tap: "[home]" }, { t: "End", tap: "[end]" },
    { t: "F5", tap: "[f5]" },
    { t: "存", tap: "[ctrl+s]", color: "h210" },
    { t: "复制", tap: "[ctrl+c]" }, { t: "粘贴", tap: "[ctrl+v]" },
    { t: "剪切", tap: "[ctrl+x]" }, { t: "全选", tap: "[ctrl+a]" },
    { t: "撤销", tap: "[ctrl+z]" },
    { t: "邮箱", tap: "me@example.com", span: 2 },
];
let ckRows = null;
let ckSel = null;   // 正在编辑的位置 {r, c, isNew}
let ckDraft = null; // 表单草稿
let ckDirty = false;
let ckLeaveTarget = null;   // 脏态离开确认的目标页

/** 脏态驱动的保存条：变更必须让用户看得见（用户验收实录）。
 *  dirty 时按钮高亮 + 提示文案；保存后回落。 */
function ckMarkDirty(dirty) {
    ckDirty = dirty;
    const bar = document.getElementById("ckSaveBar");
    if (!bar) return;
    document.getElementById("ckSave").classList.toggle("ck-save-dirty", dirty);
    document.getElementById("ckDirtyHint").hidden = !dirty;
}

function ckOpenModal(isNew) {
    const modal = document.getElementById("ckModal");
    document.getElementById("ckModalTitle").textContent =
        t(isNew ? "ck.newTitle" : "ck.edit.title");
    setNote("ckEditNote", "");
    modal.hidden = false;
}

function ckCloseModal() {
    document.getElementById("ckModal").hidden = true;
    ckSel = null;
}

/** tap 反猜型别 + 拆字段（编辑已有键时回填表单）。 */
function ckTapParse(tap) {
    const m = /^\[([a-z0-9+]+)\]$/.exec(String(tap || "").trim().toLowerCase());
    if (m) {
        const parts = m[1].split("+");
        if (parts.length === 1 && CK_KEY_NAME[parts[0]]) {
            return { mode: "single", single: parts[0] };
        }
        const key = parts[parts.length - 1];
        const mods = parts.slice(0, -1);
        const modNames = ["ctrl", "alt", "shift", "win"];
        if (CK_KEY_NAME[key] && mods.every(x => modNames.includes(x))) {
            return { mode: "combo", comboKey: key, mods: new Set(mods) };
        }
    }
    if (!String(tap || "").includes("[")) return { mode: "text", text: tap || "" };
    return { mode: "advanced", dsl: tap || "" };
}

/** 表单草稿 → tap 串。 */
function ckTapFromDraft(d) {
    if (d.mode === "text") return d.text || "";
    if (d.mode === "single") return d.single ? "[" + d.single + "]" : "";
    if (d.mode === "combo") {
        const mods = CK_MODS.filter(([name]) => d.mods.has(name)).map(([name]) => name);
        return d.comboKey ? "[" + mods.concat(d.comboKey).join("+") + "]" : "";
    }
    return d.dsl || "";
}

function ckLoad() {
    let rows = null;
    try {
        const parsed = JSON.parse($("customJson").value || "null");
        if (parsed && parsed.version === 1 && Array.isArray(parsed.rows)) rows = parsed.rows;
    } catch (_) { /* textarea 空/坏 JSON → 模板 */ }
    if (!rows || !rows.some(row => row && row.length)) rows = JSON.parse(CK_TEMPLATE).rows;
    ckRows = [0, 1, 2].map(i => Array.isArray(rows[i]) ? rows[i].slice() : []);
}

const CK_TEMPLATE = JSON.stringify({
    version: 1,
    rows: [
        [
            { t: "Esc", tap: "[esc]", note: "Vim / 终端 Esc" },
            { t: ":w", tap: ":w[enter]", note: "Vim 保存" },
            { t: "整理", tap: "[esc]ggVGD", note: "Vim 删除全文" },
            { t: "保存", tap: "[ctrl+s]", note: "常见保存快捷键", color: "blue" },
            { t: "⌫", tap: "[backspace]", note: "退格，长按连删" },
        ],
        [{ t: "邮箱", tap: "me@example.com", span: 2 }],
        [],
    ],
}, null, 2);

function ckEnter() {
    if (!ckRows) ckLoad();
    ckSel = null;
    ckEditMode = false;
    document.getElementById("ckEditBar").hidden = true;
    ckCloseModal();
    ckRenderRows();
    ckRenderPreview();
}

function ckRenderRows() {
    const host = $("ckRowList");
    host.textContent = "";
    const bar = document.getElementById("ckEditBar");
    if (bar) bar.hidden = !ckEditMode;
    ckRows.forEach((row, r) => {
        const line = document.createElement("div");
        line.className = "ck-row-line";
        const strip = document.createElement("div");
        strip.className = "ck-chips";
        if (!row.length) {
            const none = document.createElement("span");
            none.className = "ck-none";
            none.textContent = t("ck.none");
            strip.append(none);
        }
        strip.dataset.ckRow = String(r);
        row.forEach((cell, c) => {
            const chip = document.createElement("button");
            chip.type = "button";
            const isHue = /^h\d+$/.test(cell.color || "");
            chip.className = "ck-chip" + (!isHue && cell.color ? " ck-" + cell.color : "");
            if (isHue) {
                chip.style.background = "hsl(" + cell.color.slice(1) + ", 65%, 45%)";
                chip.style.borderColor = "hsl(" + cell.color.slice(1) + ", 65%, 35%)";
                chip.style.color = "#fff";
            }
            chip.textContent = cell.tap === "[backspace]" || cell.tap === "[bs]" ? "⌫" : cell.t;
            if (ckEditMode) {
                // 长按编辑态：× 删除；chip 本体被拖动接管（单击无动作）。
                const x = document.createElement("span");
                x.className = "ck-x";
                x.textContent = "×";
                x.addEventListener("click", event => {
                    event.stopPropagation();
                    ckRows[r].splice(c, 1);
                    ckRenderRows();
                    ckRenderPreview();
                    ckMarkDirty(true);
                });
                chip.append(x);
            } else {
                chip.addEventListener("click", () => ckOpenChip(r, c));
            }
            ckBindChipTouch(chip, r);
            strip.append(chip);
        });
        const add = document.createElement("button");
        add.type = "button";
        add.className = "ck-chip ck-add-chip";
        add.textContent = t("ck.add");
        add.addEventListener("click", () => ckOpenNew(r));
        strip.append(add);
        line.append(strip);
        host.append(line);
    });
}

/** 长按 = 进入可移动模式并拖起该键（键盘工具栏编辑同款形态：× 删除、
 *  跨行拖动排序；popup 只管属性——用户裁定）。 */
let ckEditMode = false;
let ckDrag = null;   // {timer, fromR, fromC, dragging, startX, startY}
// 拖动会话的 document 级监听（全局唯一一套）：live reorder 每轮重渲
// 都会重绑目标 chip——不先移除旧监听就是 N 套 handler 叠跑，同一颗键
// 被 splice N 次（真机实录：一次拖动后行里冒出 4 个退格）。
let ckDragHandlers = null;

function ckUnbindDrag() {
    if (!ckDragHandlers) return;
    document.removeEventListener("touchmove", ckDragHandlers.move);
    document.removeEventListener("touchend", ckDragHandlers.end);
    ckDragHandlers = null;
}

function ckEnterEditMode(firstChip) {
    ckEditMode = true;
    document.getElementById("ckEditBar").hidden = false;
    ckRenderRows();
    if (firstChip) ckBindDrag(firstChip);
}

function ckExitEditMode() {
    ckEditMode = false;
    document.getElementById("ckEditBar").hidden = true;
    ckRenderRows();
}

function ckBindChipTouch(chip) {
    chip.addEventListener("touchstart", event => {
        if (ckEditMode || !ckRows) return;
        const t = event.touches[0];
        ckDrag = { timer: null, dragging: false,
            startX: t.clientX, startY: t.clientY, chip };
        ckDrag.timer = setTimeout(() => {
            ckEnterEditMode(ckDrag.chip);
        }, 350);
    }, { passive: true });
    chip.addEventListener("touchmove", event => {
        if (!ckDrag) return;
        const t = event.touches[0];
        // 长按等待期位移超阈 = 取消（那是滚动，不是长按）。
        if (!ckDrag.dragging && !ckEditMode
            && Math.hypot(t.clientX - ckDrag.startX, t.clientY - ckDrag.startY) > 10) {
            clearTimeout(ckDrag.timer);
        }
    }, { passive: true });
    chip.addEventListener("touchend", () => {
        if (ckDrag && !ckDrag.dragging) clearTimeout(ckDrag.timer);
    }, { passive: true });
}

/** 编辑态拖动：live reorder——move 时按落点行/列把键 splice 到位。 */
function ckBindDrag(chip) {
    ckUnbindDrag();
    const strip = chip.parentElement;
    if (!strip) return;
    const fromR = Number(strip.dataset.ckRow);
    const fromC = [...strip.children].indexOf(chip);
    const cell = ckRows[fromR] && ckRows[fromR][fromC];
    if (!cell) return;
    chip.classList.add("ck-dragging");
    const onMove = event => {
        const t = event.touches[0];
        ckDrag.dragging = true;
        const strips = [...document.querySelectorAll("#ckRowList .ck-chips[data-ck-row]")];
        let toR = fromR;
        for (const st of strips) {
            const rect = st.getBoundingClientRect();
            if (t.clientY >= rect.top && t.clientY <= rect.bottom) {
                toR = Number(st.dataset.ckRow);
                break;
            }
        }
        const target = strips.find(st => Number(st.dataset.ckRow) === toR);
        if (!target) return;
        let toC = ckRows[toR].length;
        [...target.children].forEach((el, i) => {
            if (el === chip) return;
            const rect = el.getBoundingClientRect();
            if (t.clientX < rect.left + rect.width / 2) { toC = Math.min(toC, i); }
        });
        if (toR === fromR && toC > fromC) toC -= 1;
        ckRows[fromR].splice(fromC, 1);
        ckRows[toR].splice(toC, 0, cell);
        ckMarkDirty(true);
        ckRenderRows();
        // 重渲后继续拖：新的同位键重新接管。
        const stripNow = [...document.querySelectorAll("#ckRowList .ck-chips[data-ck-row]")]
            .find(st => Number(st.dataset.ckRow) === toR);
        const chipNow = stripNow && [...stripNow.children][toC];
        if (chipNow) ckBindDrag(chipNow);
    };
    const onEnd = () => {
        ckUnbindDrag();
        const dragging = document.querySelector(".ck-dragging");
        if (dragging) dragging.classList.remove("ck-dragging");
        ckRenderRows();
        ckRenderPreview();
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    ckDragHandlers = { move: onMove, end: onEnd };
}

function ckRenderPreview() {
    const host = $("ckPreview");
    host.textContent = "";
    ckRows.forEach(row => {
        const strip = document.createElement("div");
        strip.className = "ck-prev-row";
        if (!row.length) {
            const none = document.createElement("span");
            none.className = "ck-none";
            none.textContent = t("ck.none");
            strip.append(none);
        }
        row.forEach(cell => {
            const key = document.createElement("span");
            const isHue = /^h\d+$/.test(cell.color || "");
            key.className = "ck-prev-key" + (!isHue && cell.color ? " ck-" + cell.color : "");
            if (isHue) {
                key.style.background = "hsl(" + cell.color.slice(1) + ", 65%, 45%)";
                key.style.borderColor = "hsl(" + cell.color.slice(1) + ", 65%, 35%)";
                key.style.color = "#fff";
            }
            key.textContent = cell.tap === "[backspace]" || cell.tap === "[bs]" ? "⌫" : cell.t;
            if (cell.note) key.title = cell.note;
            strip.append(key);
        });
        host.append(strip);
    });
}

/** 编辑卡：isNew 时空白表单；否则按 cell 回填（tap 反猜型别）。 */
function ckOpenChip(r, c) {
    const cell = ckRows[r][c];
    ckSel = { r, c, isNew: false };
    // 全字段先兜底再让 parse 覆盖命中型：切到任何型都拿得到默认值
    // （此前文本/组合键型缺 text/mods 字段，切换后输入框填 undefined、
    // 组合键渲染直接中断——用户实录）。
    ckDraft = {
        t: cell.t,
        text: "", single: "esc", comboKey: "s", mods: new Set(["ctrl"]), dsl: "",
        ...ckTapParse(cell.tap),
        color: cell.color || "",
        note: cell.note || "",
    };
    ckBuildForm();
    ckOpenModal(false);
}

function ckOpenNew(r) {
    ckSel = { r, c: ckRows[r].length, isNew: true };
    ckDraft = { t: "", mode: "single", single: "esc", text: "", comboKey: "s",
        mods: new Set(["ctrl"]), dsl: "", color: "", note: "" };
    ckBuildForm();
    ckOpenModal(true);
}

/** 行式表单行：短标签在左、控件在右占满余宽（一行一个属性——空间
 *  利用率优先，用户裁定）。 */
function ckField(labelText, control, cls) {
    const wrap = document.createElement("label");
    wrap.className = "ck-row2" + (cls ? " " + cls : "");
    if (labelText != null) {
        const span = document.createElement("span");
        span.className = "ck-row2-label";
        span.textContent = labelText;
        wrap.append(span);
    } else {
        wrap.classList.add("ck-row2-bare");
    }
    control.classList.add("ck-row2-ctl");
    wrap.append(control);
    return wrap;
}

/** 单选按钮组（类型/宽度/色板/修饰键共用同一形态）。 */
function ckSegment(options, value, onPick) {
    const row = document.createElement("div");
    row.className = "ck-seg";
    options.forEach(([v, label, cls]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ck-seg-btn" + (cls ? " " + cls : "") + (v === value ? " selected" : "");
        b.textContent = label;
        b.addEventListener("click", () => onPick(v));
        row.append(b);
    });
    return row;
}

function ckBuildForm() {
    const body = $("ckEditBody");
    body.textContent = "";
    const d = ckDraft;

    // 新建时提供「常用」起点：默认收起，点开展开，选一颗预填。
    if (ckSel && ckSel.isNew) {
        const common = document.createElement("div");
        common.className = "ck-common";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ck-common-toggle";
        toggle.textContent = t("ck.common") + " \u25be";
        const list = document.createElement("div");
        list.className = "ck-chips ck-common-list";
        list.hidden = true;
        CK_QUICK.forEach(item => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "ck-chip ck-common-chip" + (item.color ? " ck-" + item.color : "");
            chip.textContent = item.t;
            chip.title = item.note || item.tap;
            chip.addEventListener("click", () => {
                ckDraft.t = item.t;
                ckDraft.note = item.note || "";
                ckDraft.color = item.color || "";
                Object.assign(ckDraft, ckTapParse(item.tap));
                ckBuildForm();
            });
            list.append(chip);
        });
        toggle.addEventListener("click", () => {
            list.hidden = !list.hidden;
            toggle.textContent = t("ck.common") + (list.hidden ? " \u25be" : " \u25b4");
        });
        common.append(toggle, list);
        body.append(common);
    }

    // 顺序：键面文案 -> 类型四选 -> 类型输入控件 -> 颜色 -> 备注。
    const tInput = document.createElement("input");
    tInput.id = "ckT";
    tInput.className = "ck-input";
    tInput.value = d.t;
    tInput.placeholder = t("ck.f.t.hint");
    tInput.addEventListener("input", () => { d.t = tInput.value; });
    body.append(ckField(t("ck.f.t"), tInput));

    const modeSeg = ckSegment([["text", t("ck.f.mode.text")], ["single", t("ck.f.mode.single")],
        ["combo", t("ck.f.mode.combo")], ["advanced", t("ck.f.mode.advanced")]],
        d.mode, v => { d.mode = v; ckBuildForm(); });
    modeSeg.id = "ckMode";
    modeSeg.classList.add("ck-mode-seg");
    body.append(modeSeg);

    const holder = document.createElement("div");
    holder.id = "ckActionHolder";
    body.append(holder);
    ckBuildAction(holder);

    // 颜色：默认 / 自定义（自定义才展开 hue 滑块行）。cell.color 记
    // "h<度数>"（0-359）渲染按 hsl 算；旧色板名兼容读。
    const HUE_RE = /^h\d{1,3}(?:s\d{1,3})?$/;
    const isCustomHue = HUE_RE.test(d.color || "");
    const colorSeg = ckSegment([["", t("ck.color.default")], ["custom", t("ck.color.custom")]],
        isCustomHue ? "custom" : "", v => {
            if (v === "custom") { if (!HUE_RE.test(d.color || "")) d.color = "h210s65"; }
            else d.color = "";
            ckBuildForm();
        });
    body.append(ckField(t("ck.f.color"), colorSeg, "ck-row-color"));
    if (isCustomHue) {
        // 双滑块：色调（全谱渐变轨道）+ 饱和度（灰->纯色，色相联动）。
        const parts = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(d.color) || [null, "210", "65"];
        let hueVal = parseInt(parts[1], 10);
        let satVal = parts[2] != null ? parseInt(parts[2], 10) : 65;
        const encode = () => { d.color = "h" + hueVal + "s" + satVal; };
        const hueWrap = document.createElement("div");
        hueWrap.className = "ck-hue";
        const hue = document.createElement("input");
        hue.type = "range";
        hue.className = "ck-hue-range";
        hue.min = "0"; hue.max = "359";
        hue.value = String(hueVal);
        const satWrap = document.createElement("div");
        satWrap.className = "ck-hue";
        const sat = document.createElement("input");
        sat.type = "range";
        sat.className = "ck-sat-range";
        sat.min = "0"; sat.max = "100";
        sat.value = String(satVal);
        const swatch = document.createElement("span");
        swatch.className = "ck-hue-swatch";
        const paint = () => {
            const css = "hsl(" + hueVal + ", " + satVal + "%, 45%)";
            swatch.style.background = css;
            hue.style.setProperty("--thumb-hue", String(hueVal));
            sat.style.background = "linear-gradient(90deg, hsl(" + hueVal + ", 0%, 45%), " + css + ")";
        };
        paint();
        hue.addEventListener("input", () => { hueVal = parseInt(hue.value, 10) || 0; encode(); paint(); });
        sat.addEventListener("input", () => { satVal = parseInt(sat.value, 10) || 0; encode(); paint(); });
        hueWrap.append(hue, swatch);
        body.append(ckField(t("ck.color.hue"), hueWrap, "ck-row-hue"));
        satWrap.append(sat);
        body.append(ckField(t("ck.color.sat"), satWrap, "ck-row-hue"));
    }

    const noteInput = document.createElement("input");
    noteInput.id = "ckNote";
    noteInput.className = "ck-input";
    noteInput.value = d.note;
    noteInput.placeholder = t("ck.f.note.hint");
    noteInput.addEventListener("input", () => { d.note = noteInput.value; });
    body.append(ckField(t("ck.f.note"), noteInput));
}

function ckBuildAction(holder) {
    holder.textContent = "";
    const d = ckDraft;
    if (d.mode === "text") {
        const input = document.createElement("input");
        input.id = "ckText";
        input.className = "ck-input";
        input.value = d.text;
        input.placeholder = t("ck.f.text");
        input.addEventListener("input", () => { d.text = input.value; });
        holder.append(ckField(t("ck.f.mode.text"), input));
    } else if (d.mode === "single" || d.mode === "combo") {
        if (d.mode === "combo") {
            // 修饰键：标签在左、按钮组在右，一行放下（多选）。
            const row = document.createElement("div");
            row.className = "ck-seg";
            CK_MODS.forEach(([name, label]) => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "ck-seg-btn" + (d.mods.has(name) ? " selected" : "");
                chip.textContent = label;
                chip.addEventListener("click", () => {
                    d.mods.has(name) ? d.mods.delete(name) : d.mods.add(name);
                    ckBuildAction(holder);
                });
                row.append(chip);
            });
            holder.append(ckField(t("ck.f.mods"), row));
        }
        const keySel = document.createElement("select");
        keySel.id = "ckKey";
        CK_KEYS.forEach(([value, label]) => {
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = label;
            keySel.append(opt);
        });
        keySel.value = d.mode === "single" ? (d.single || "esc") : (d.comboKey || "s");
        keySel.addEventListener("change", () => {
            if (d.mode === "single") d.single = keySel.value;
            else d.comboKey = keySel.value;
        });
        holder.append(ckField(t("ck.f.key"), keySel));
    } else {
        // 高级：标签 + ? 帮助（点开 DSL 速查）+ 输入框，行式对齐。
        const labelWrap = document.createElement("span");
        labelWrap.className = "ck-dsl-label";
        const labelText = document.createElement("span");
        labelText.textContent = t("ck.f.mode.advanced");
        const help = document.createElement("button");
        help.type = "button";
        help.className = "ck-help";
        help.textContent = "?";
        help.setAttribute("aria-label", t("ck.help.aria"));
        const helpCard = document.createElement("div");
        helpCard.className = "ck-help-card";
        helpCard.hidden = true;
        helpCard.innerHTML = t("ck.help.dsl");
        help.addEventListener("click", () => {
            helpCard.hidden = !helpCard.hidden;
        });
        labelWrap.append(labelText, help);
        const input = document.createElement("input");
        input.id = "ckDsl";
        input.className = "ck-input";
        input.value = d.dsl;
        input.placeholder = t("ck.f.dsl");
        input.addEventListener("input", () => { d.dsl = input.value; });
        const row = ckField(null, input);
        row.prepend(labelWrap);
        labelWrap.classList.add("ck-row2-label");
        labelWrap.style.display = "inline-flex";
        labelWrap.style.gap = "6px";
        labelWrap.style.alignItems = "center";
        holder.append(row, helpCard);
    }
}

$("ckApply").addEventListener("click", () => {
    const d = ckDraft;
    if (!d.t.trim()) return setNote("ckEditNote", t("ck.err.t"));
    const tap = ckTapFromDraft(d);
    if (!tap) return setNote("ckEditNote", t("ck.err.tap"));
    const cell = { t: d.t.trim(), tap, note: d.note || "" };
    if (d.color) cell.color = d.color;
    if (ckSel.isNew) ckRows[ckSel.r].push(cell);
    else ckRows[ckSel.r][ckSel.c] = cell;
    ckCloseModal();
    // 动作带来的变化必须在当前屏可见：列表+预览立即刷新，脏态亮起。
    ckRenderRows();
    ckRenderPreview();
    ckMarkDirty(true);
});

$("ckEditDone").addEventListener("click", () => ckExitEditMode());
$("ckModalCancel").addEventListener("click", () => ckCloseModal());
$("ckModalMask").addEventListener("click", () => ckCloseModal());

$("ckSave").addEventListener("click", () => {
    const json = JSON.stringify({ version: 1, rows: ckRows });
    call("saveCustom", json, $("customEnabled").checked);
    $("customJson").value = json;
    ckMarkDirty(false);
    setNote("ckSaveNote", t("ck.note.saved"));
});

$("btnOpenCustomKeys").addEventListener("click", () => showPage("customkeys"));
// 2026-09-30 验收拆分：模糊音/键盘选择收进三级页，input 页只留入口。
$("btnOpenFuzzy").addEventListener("click", () => showPage("fuzzy"));
$("btnOpenKeyboards").addEventListener("click", () => showPage("keyboards"));
$("ckLeaveStay").addEventListener("click", () => {
    ckLeaveTarget = null;
    document.getElementById("ckLeaveModal").hidden = true;
});
$("ckLeaveGo").addEventListener("click", () => {
    document.getElementById("ckLeaveModal").hidden = true;
    ckMarkDirty(false);
    const target = ckLeaveTarget;
    ckLeaveTarget = null;
    if (target) showPage(target);
});
$("btnGithubIssues").addEventListener("click", () => call("openGithub", "issues"));
// 飞书交流群（浏览器打开内置邀请链接，native 侧固定白名单同 openGithub）。
$("btnFeishuGroup").addEventListener("click", () => call("openFeishuGroup"));

// 关于页「检查更新」：Play 渠道跳商店详情页（版本/更新由商店管理）；
// 直装渠道查 GitHub Releases——ghproxy 镜像先行（国内可达），直连回退
// （海外更快）。WebView 的 file:// origin 依赖目标端 ACAO:*（GitHub
// API 满足；镜像若拦截 CORS 则该源失败，两个源都挂才报错）。
let latestReleaseAssets = null;
function newerVersion(latest, current) {
    const norm = s => String(s || "").replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    const a = norm(latest), b = norm(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = (a[i] || 0) - (b[i] || 0);
        if (d) return d > 0;
    }
    return false;
}
async function checkGithubUpdate() {
    $("btnDlThin").hidden = true;
    $("btnDlFull").hidden = true;
    latestReleaseAssets = null;
    setNote("aboutNote", t("update.checking"));
    const current = (lastState && lastState.appVersion) || "?";
    const endpoints = [
        "https://gh-proxy.com/https://api.github.com/repos/feelime/feelime/releases/latest",
        "https://api.github.com/repos/feelime/feelime/releases/latest",
    ];
    for (const url of endpoints) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) continue;
            const rel = await res.json();
            const tag = String(rel.tag_name || "").replace(/^v/, "");
            if (!tag) continue;
            if (!newerVersion(tag, current)) {
                setNote("aboutNote", t("update.upToDate", [tag]));
                return;
            }
            setNote("aboutNote", t("update.available", [tag, current]));
            latestReleaseAssets = {};
            (rel.assets || []).forEach(asset => {
                const m = /-(thin|full)\.apk$/.exec(asset.name || "");
                if (m && asset.browser_download_url) latestReleaseAssets[m[1]] = asset.browser_download_url;
            });
            if (latestReleaseAssets.thin) $("btnDlThin").hidden = false;
            if (latestReleaseAssets.full) $("btnDlFull").hidden = false;
            return;
        } catch (_) { /* 下一个源 */ }
    }
    setNote("aboutNote", t("update.failed"));
}
$("btnAboutCheckUpdate").addEventListener("click", () => {
    if (lastState && lastState.playDistribution) {
        call("openAppStore");
        return;
    }
    checkGithubUpdate();
});
// 下载确认即点击本身：浏览器打开 ghproxy 加速的资产地址（native 白名单
// 校验后再跳）。
function downloadRelease(kind) {
    const raw = latestReleaseAssets && latestReleaseAssets[kind];
    if (!raw) return;
    call("openReleaseDownload", "https://gh-proxy.com/" + raw);
}
$("btnDlThin").addEventListener("click", () => downloadRelease("thin"));
$("btnDlFull").addEventListener("click", () => downloadRelease("full"));
$("btnCopyAbout").addEventListener("click", () => {
    if (!lastState) return;
    call("copyText", aboutRows(lastState, { forCopy: true }).map(([label, value]) => `${label}: ${value}`).join("\n"));
    setNote("aboutNote", t("note.copied"));
});

document.querySelectorAll("[data-target]").forEach(entry => {
    entry.addEventListener("click", () => showPage(entry.dataset.target));
});

document.querySelectorAll("[data-back]").forEach(back => {
    back.addEventListener("click", () => showPage(back.dataset.back || "home"));
});

/* Apply browser fallback before the first bridge hello. Native state may
 * immediately replace it with uiLocale/uiLanguage. */
applyLocale();
