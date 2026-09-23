/* Feelime full settings page.
 *
 * The bridge remains the source of truth for settings and device state. The
 * page owns only presentation: tokens, page routing, and this small zh/en
 * dictionary. User text, URLs, JSON, model titles, and device names are
 * always rendered as received. */
"use strict";

const BRIDGE = window.Native || { ready() {} };
let token = "";
let lastState = null;
let uiChoice = "auto";
let uiLocale = browserLocale();
let pendingModelConsent = null;
let lastModelError = null;

const $ = id => document.getElementById(id);

const I18N = {
    zh: {
        "title": "Feelime 设置",
        "hero.tag": "离线中英混合语音输入法",
        "hero.connecting": "连接引擎…",
        "hero.online": "默认输入法在线",
        "hero.notDefault": "未设为默认",
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
        "entry.input.subtitle": "双拼 · 定制键盘",
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
        "dict.base.title": "基底词库",
        "dict.base.badge": "基底",
        "dict.base.hint": "换装整个词库：选择 rime 词库文件（.dict.yaml，如 rime-ice 的词典），在本机重新编译（几分钟），模糊音/双拼/T9 一起重建；可随时恢复内置。",
        "dict.base.pick": "选择词库文件换装",
        "dict.base.revert": "恢复内置词库",
        "dict.base.builtin": "内置 rime-frost（白霜拼音）",
        "dict.base.custom": "自定义：{0}",
        "dict.base.stageCopy": "正在读取词库文件…",
        "dict.base.stageCompile": "正在编译词库（期间中文输入暂不可用），可离开此页，完成后自动换装",
        "dict.base.elapsed": "已编译 {0} 秒",
        "page.appearance": "外观",
        "themeMode.auto": "跟随系统",
        "themeMode.light": "浅色",
        "themeMode.dark": "深色",
        "page.voice": "语音识别",
        "page.update": "键盘热更新",
        "page.about": "关于",
        "page.test": "输入测试",
        "input.fuzzy.title": "全拼模糊音",
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
        "input.double.hint": "键盘切到「双拼」模式后按所选方案出字。",        "input.double.ziranma": "自然码",
        "input.double.flypy": "小鹤双拼",
        "input.double.sogou": "搜狗 / 微软双拼",
        "input.double.ziguang": "紫光双拼",
        "input.double.note.ziranma": "声母与全拼相同（zh=V、ch=I、sh=U 除外）。零声母（a/e 开头）直接打全拼：啊=aa、爱=ai、安=an、恩=en、二=er。",
        "input.double.note.flypy": "声母与全拼相同（zh=V、ch=I、sh=U 除外）。零声母（a/e/o 开头）双打首字母，也可打全拼：啊=aa、爱=ai、恩=ef、二=er。",
        "input.double.note.sogou": "声母与全拼相同（zh=V、ch=I、sh=U 除外）；ing 在「;」键（键盘上即分词键位置），ü 在 Y。零声母固定先打 O：啊=oa、爱=ol、安=oj、恩=of、二=or。搜狗与微软双拼键位完全一致，用微软双拼习惯的选这项即可。",
        "input.double.note.ziguang": "紫光华宇拼音的双拼键位。zh=U、ch=A、sh=I；ing 在「;」键，ü 在 V（ju/qu/xu 也可用 v 键）。零声母固定先打 O：啊=oa、爱=op、安=or。",
        "input.double.mapCaption": "韵母键位图（键名下方为该键韵母，右下为双声母）",
        "input.custom.title": "定制键盘",
        "input.custom.badge": "高级",
        "input.custom.enabled": "启用定制键盘",
        "input.custom.jsonLabel": "定制 JSON（{\"version\":1,\"rows\":[[{\"t\":\"键面\",\"tap\":\"点击输出\",\"note\":\"备注\"}]]}）",
        "input.custom.jsonPlaceholder": "粘贴定制 JSON",
        "input.custom.note": "保存在本机，键盘下次载入时生效。",
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
        "input.feel.scrub": "光标移动速度",
        "input.feel.scrubHint": "光标拖拽时每个刻度移动的距离。",
        "input.feel.snap": "滑动选字范围",
        "input.feel.snapHint": "长按滑选时手指偏离多远取消选择：松=更远也有效，紧=更早取消。",
        "input.feel.snapLoose": "松",
        "input.feel.snapStandard": "标准",
        "input.feel.snapTight": "紧",
        "input.feel.keySound": "按键声音",
        "input.feel.keySoundHint": "按键时轻响一声，跟随系统音量，静音时不响。",
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
        "hero.connecting": "Connecting to the engine…",
        "hero.online": "Default input method is ready",
        "hero.notDefault": "Not the default input method",
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
        "entry.input.title": "Keyboard & input",
        "entry.input.subtitle": "Double pinyin · Custom keyboard",
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
        "dict.base.title": "Base dictionary",
        "dict.base.badge": "Base",
        "dict.base.hint": "Swap the whole lexicon: pick a rime dictionary file (.dict.yaml, e.g. from rime-ice) and it recompiles on this device (a few minutes); fuzzy/double-pinyin/T9 rebuild with it. Built-in can be restored anytime.",
        "dict.base.pick": "Pick a dictionary file",
        "dict.base.revert": "Restore built-in",
        "dict.base.builtin": "Built-in rime-frost",
        "dict.base.custom": "Custom: {0}",
        "dict.base.stageCopy": "Reading the dictionary file…",
        "dict.base.stageCompile": "Compiling (Chinese input pauses meanwhile) - you can leave this page; the keyboard swaps over when done",
        "dict.base.elapsed": "{0}s elapsed",
        "page.appearance": "Appearance",
        "themeMode.auto": "Follow system",
        "themeMode.light": "Light",
        "themeMode.dark": "Dark",
        "page.voice": "Voice recognition",
        "page.update": "Keyboard updates",
        "page.about": "About",
        "page.test": "Input test",
        "input.fuzzy.title": "Full-pinyin fuzzy",
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
        "input.datetime.title": "Date & time candidates",
        "input.datetime.badge": "Input",
        "input.datetime.enable": "Type date/time/week for quick stamps",
        "input.datetime.hint": "The candidates bar offers the current date, time and weekday (full pinyin riqi/shijian/xingqi works too); turn off if unwanted.",
        "input.phrases.title": "Symbol candidates",
        "input.phrases.badge": "Input",
        "input.phrases.enable": "Symbol / emoji candidates",
        "input.phrases.hint": "Adds words like ↑ for shang and ✓ for dui near candidate #3; works in full and double Pinyin.",
        "input.phrases.manage": "Manage entries",
        "input.phrases.importHint": "Entries from a rime dictionary join the candidates as an overlay (the built-in lexicon stays; original frequencies are not carried). Importing again replaces the previous import.",
        "input.phrases.importBtn": "Pick a file",
        "input.phrases.clearBtn": "Clear imported",
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
        "input.double.ziranma": "Ziranma",
        "input.double.flypy": "Flypy (小鹤)",
        "input.double.sogou": "Sogou / MSPY",
        "input.double.ziguang": "Ziguang (紫光)",
        "input.double.note.ziranma": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e) use full Pinyin: 啊=aa、爱=ai、安=an、恩=en、二=er.",
        "input.double.note.flypy": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e/o) double the first letter; full Pinyin also works: 啊=aa、爱=ai、恩=ef、二=er.",
        "input.double.note.sogou": "Initials match full Pinyin (except zh=V, ch=I, sh=U); ing sits on the “;” key (the wide key on the keyboard), ü on Y. Zero-initial syllables always start with O: 啊=oa、爱=ol、安=oj、恩=of、二=or. Sogou and MSPY share the exact same layout.",
        "input.double.note.ziguang": "The Ziguang (紫光) layout. zh=U、ch=A、sh=I; ing sits on the “;” key, ü on V (ju/qu/xu also take v). Zero-initial syllables always start with O: 啊=oa、爱=op、安=or.",
        "input.double.mapCaption": "Final key map (finals under each key, double initials bottom-right)",
        "input.custom.title": "Custom keyboard",
        "input.custom.badge": "Advanced",
        "input.custom.enabled": "Enable custom keyboard",
        "input.custom.jsonLabel": "Custom JSON ({\"version\":1,\"rows\":[[{\"t\":\"key label\",\"tap\":\"output\",\"note\":\"note\"}]]})",
        "input.custom.jsonPlaceholder": "Paste custom JSON",
        "input.custom.note": "Saved on this device and applied the next time the keyboard loads.",
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
        "input.feel.scrub": "Cursor speed",
        "input.feel.scrubHint": "Distance the caret moves per drag step.",
        "input.feel.snap": "Swipe selection range",
        "input.feel.snapHint": "How far the finger may drift during popup swipe before the pick cancels: loose = forgiving, tight = early cancel.",
        "input.feel.keySound": "Key sound",
        "input.feel.keySoundHint": "A soft click on each key press; follows system volume, silent in mute mode.",
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

const PAGES = ["home", "appearance", "input", "dict", "phrases", "voice", "update", "backup", "about", "licenses", "test"];
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
};

/* --- pages ------------------------------------------------------------- */

let currentPage = "home";

function showPage(name) {
    if (!PAGES.includes(name)) return;
    const wasAppearance = currentPage === "appearance";
    currentPage = name;
    document.querySelectorAll("[data-page]").forEach(node => {
        node.hidden = node.dataset.page !== name;
    });
    if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
    // 外观页预览：真实键盘在屏幕底部弹出、本页窗口被压缩；离开时收起。
    if (name === "appearance" && !wasAppearance) call("previewKeyboard", true);
    if (name !== "appearance" && wasAppearance) call("previewKeyboard", false);
    call("reportPage", name);
}

/* --- render ------------------------------------------------------------ */

function render(state) {
    state = state || {};
    renderHero(state);
    renderIme(state);
    renderDoublePinyin(state);
    renderFeel(state);
    renderVoice(state);
    renderAsr(state);
    renderCustom(state);
    renderCustomPhrases(state);
    renderDictBase(state);
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
    const opacity = $("keyOpacity");
    if (opacity) opacity.value = String(Math.max(5, Math.min(100, Number(state.keyOpacity ?? 100))));
    const bubble = $("keyBubble");
    if (bubble) bubble.checked = state.keyBubble === true;
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
    setSelect("scrubSpeed", state.scrubSpeed ?? 3, ["1", "2", "3", "4", "5"]);
    setSelect("popupSnap", state.popupSnap ?? 1, ["0", "1", "2"]);
    const setToggle = (id, value) => {
        const node = $(id);
        if (node && document.activeElement !== node) node.checked = !!value;
    };
    setToggle("keySound", state.keySound);
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

function renderHero(state) {
    const host = $("heroStatus");
    if (!host) return;
    host.replaceChildren(statusSpan(
        state.ime && state.ime.isDefault ? t("hero.online") : t("hero.notDefault"),
        state.ime && state.ime.isDefault ? "ok" : "warn",
    ));
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

function renderCustomPhrases(state) {
    const phrases = state.customPhrases;
    if (phrases) {
        phraseItems = (phrases.items || []).map(item => ({
            text: String(item.text || ""), code: String(item.code || ""),
        }));
        if (document.activeElement !== $("phrasesOn")) $("phrasesOn").checked = !!phrases.enabled;
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
$("btnManagePhrases").addEventListener("click", () => showPage("phrases"));
$("btnOpenLicenses").addEventListener("click", () => showPage("licenses"));
// 词库导入（issue #37）：SAF 选择 .dict.yaml → 壳侧解析进 imported 段。
$("btnImportDict").addEventListener("click", () => call("openDictDocument"));
$("btnBaseDictPick").addEventListener("click", () => call("openBaseDictDocument"));
$("btnBaseDictRevert").addEventListener("click", () => call("clearBaseDict"));

/** 基底编译是黑盒（librime maintenance），无百分比——用阶段 + 已耗时
 *  提示；用户可离开页面，完成/失败由 dictBaseDone/dictBaseError 收尾。 */
function dictBaseStageText(stage, elapsedMs) {
    const seconds = Math.round((elapsedMs || 0) / 1000);
    const label = stage === "COPYING" ? t("dict.base.stageCopy") : t("dict.base.stageCompile");
    return stage === "COPYING" ? label : `${label}（${t("dict.base.elapsed", [seconds])}）`;
}

function onDictBaseProgress(event) {
    const building = $("dictBaseBuilding");
    building.hidden = false;
    building.textContent = dictBaseStageText(event.stage, event.elapsedMs);
}

/** state.baseDict: {mode, building, stage, elapsedMs, name, installedAt}——
 *  编译中离开再进设置页，提示行从 state 快照恢复（不丢进度文本）。 */
function renderDictBase(state) {
    const base = state.baseDict || {};
    const current = $("dictBaseCurrent");
    const when = base.installedAt
        ? new Date(base.installedAt).toLocaleString() : "";
    current.textContent = base.mode === "custom" && base.name
        ? `${t("dict.base.custom", [base.name])} · ${when}`
        : t("dict.base.builtin");
    $("btnBaseDictRevert").hidden = base.mode !== "custom" || base.building;
    $("btnBaseDictPick").disabled = !!base.building;
    $("dictBaseBuilding").hidden = !base.building;
    if (base.building) {
        $("dictBaseBuilding").textContent =
            dictBaseStageText(base.stage || "COMPILING", base.elapsedMs);
    }
}
$("btnClearImportedDict").addEventListener("click", () => call("clearImportedDict"));
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

function aboutRows(state) {
    const device = state.device || {};
    const release = device.release || "?";
    const sdk = device.sdkInt === undefined ? "?" : device.sdkInt;
    return [
        [t("about.appVersion"), `v${state.appVersion || "?"}`],
        [t("about.activeKeyboard"), `v${activeKeyboardVersion(state)}`],
        [t("about.builtInKeyboard"), `v${state.keyboardVersion || "?"}`],
        [t("about.device"), `${device.manufacturer || ""} ${device.model || ""}`.trim() || "?"],
        [t("about.android"), t("about.androidValue", { release, sdk })],
    ];
}

function renderAbout(state) {
    $("btnAppStore").hidden = !state.playDistribution;
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
});
$("keyOpacity").addEventListener("change", event => {
    if (!keyOpacityDirty) return;
    keyOpacityDirty = false;
    call("setKeyOpacity", parseInt(event.target.value, 10));
});
// 按键气泡（issue #30-1）：外观页开关，默认关；广播→hello 实时作用到
// 底下弹出的预览键盘。
$("keyBubble").addEventListener("change", event => call("setKeyBubble", event.target.checked));
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
$("popupSnap").addEventListener("change", submitFeelOptions);
$("modelBackend").addEventListener("change", event => call("setModelBackend", event.target.value));
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

$("btnCustomTemplate").addEventListener("click", () => {
    $("customJson").value = JSON.stringify({
        version: 1,
        rows: [
            [{ t: "✓", tap: "好的", note: "" }, { t: "…", tap: "等等", note: "" }],
            [],
            [],
        ],
    }, null, 2);
});

$("btnCheckUpdate").addEventListener("click", () => call("checkUpdate", $("updateSource").value));
$("autoUpdateCheck").addEventListener("change", event => call("setAutoUpdateCheck", event.target.checked));
$("associationOn").addEventListener("change", event => call("setAssociation", event.target.checked));
$("dynamicDateTimeOn").addEventListener("change", event => call("setDynamicDateTime", event.target.checked));
$("keySound").addEventListener("change", event => call("setKeySound", event.target.checked));
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
$("btnGithubIssues").addEventListener("click", () => call("openGithub", "issues"));
$("btnCopyAbout").addEventListener("click", () => {
    if (!lastState) return;
    call("copyText", aboutRows(lastState).map(([label, value]) => `${label}: ${value}`).join("\n"));
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
