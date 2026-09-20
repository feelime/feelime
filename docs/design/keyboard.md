# Feelime 设计文档：键盘与产品语义

本文档是产品与交互语义的**权威出处**。代码注释里的「design §N」「§N」都指
本文档的节号，改语义时先改这里再改代码。配套阅读：

- 外观与视觉规范（配色体系、新增元素的约束）：[appearance.md](appearance.md)
- 中文联想（bigram 后继词）：[association.md](association.md)
- 最终需求清单（产品必须做什么）：[../product/requirements.md](../product/requirements.md)
- 验证方法与门禁：[../testing/verification.md](../testing/verification.md)

代码结构对照：键盘前端在 `app/src/main/assets/keyboard/`（index.html /
keyboard.js / keyboard.css / VERSION），原生在
`app/src/main/java/com/feelime/ime/`（FeelimeService、engine/、panel/、
update/），完整设置页在 `app/src/main/assets/settings/`。

## 0. 总原则

- **离线与隐私优先**：全部输入、识别、存储发生在设备本地。WebView 关闭网络
  与文件访问；密码框禁用语音、不采集剪贴板；剪贴板历史不进云备份。
- **mock 优先**：UI 逻辑与桥接行为先在 `mock_bridge_tests.js`（fake DOM +
  fake Native，node 直跑，不装 APK）验证；Kotlin 侧纯函数（codec、解析器、
  契约）用 JVM 单测钉住；设备套件只做端到端回归。
- **demo-first**：涉及外观的需求先在真实源码预览（`tools/keyboard-preview.html`）
  确认，再进入功能收尾；不做手写模拟键盘。
- **浮层用满整个 IME 窗口，锚定触发点**：长按浮层（组合卡、模式菜单等）的
  可用空间是整个窗口——键盘视图与其上方的原生扩展带都是合法落点。规则：
  1. 优先紧贴触发键上沿完整展开（右缘对齐或水平居中触发键）；
  2. 上方空间不足时先缩内容（组合卡格子 58→40px 下限）再考虑滚动，
     不得骑跨在按键行上；
  3. 空间仍不足时贴触发键侧边（左右择一）、垂直居中于触发键行；
  4. 永不遮挡触发键自身，永不出 IME 窗口边界。
  键盘本体同理必须完整可见：系统不报导航条 inset 时由原生主动兜底（见 §14）。
- **诚实降级**：失败必须如实提示（固定词库删不掉就说删不掉；能力不足就提示
  升级 APK），不得把「调用发出去了」当成「远端生效了」。
- **断言跟行为走**：改可见语义时先 grep `scripts/verify/` 里的字形字面量与
  元素 id，级联更新套件后再发版。
- **最小改动**：样式值集中在 CSS token；不重构无关代码；新增能力以新元素
  id / data-role / capability 暴露，不改动既有测试钩子语义。

## 1. 视觉规格

### 1.1 色彩 token

全部颜色收敛为 `keyboard.css` 的 CSS 变量，禁止在组件里写散色。
默认 `:root` 为深色；`html.theme-light` / `html.theme-dark` 由主题机制
（§13）切换；两者都缺席时由 `prefers-color-scheme` 媒体查询兜底。

| token | dark | light | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#202020` | `#e2e3e8` | 键盘背景 |
| `--key` | `#5f5f5f` | `#fcfcfc` | 字母键面 |
| `--special` | `#414141` | `#b7bbc4` | 功能键 |
| `--pressed` | `#6e6e6e` | `#eceef2` | 按压态 |
| `--text` | `#e8e8e8` | `#181818` | 主文字 |
| `--muted` | `#b0b0b0` | `#5c616b` | 副文字（alt 角标、提示、图标） |
| `--accent` | `#23c890` | `#23c890` | 当前态/首候选/强调（两主题同源） |
| `--accent-text` | `#5cdeb0` | `#086d49` | 强调**文字**（accent 上的可读色） |
| `--accent-ink` | `#07180e` | `#07180e` | accent 底上的墨色文字 |
| `--panel` | `#2a2a2a` | `#f4f5f7` | 面板/菜单卡片 |
| `--pill` | `#3d3d3d` | `#ffffff` | 首候选 pill |
| `--logo-bg` | `#4d4d4d` | `#fcfcfc` | 工具圆钮/logo 底 |
| `--icon` | `#989898` | `#787878` | 圆钮内图标 |
| `--danger` | `#ff6b6b` | `#d93025` | 删除/错误 |
| `--recording` | `#ff4d4d` | `#e5484d` | 录音态 |
| `--mod-active-bg` | `#103a24` | `#d7f0e4` | 修饰键锁定态底 |
| `--line` | `#484848` | `#d0d3db` | 分隔线 |
| `--card-bg` / `--card-text` / `--card-sub` | `#2b2b31` / `#e8e8e8` / `#a2a2ac` | `#f7f7fa` / `#1c1c24` / `#6a6a78` | 浮卡（常用语编辑卡、高度卡） |
| `--input-placeholder` / `--key-subtext` | `#dedede` | `#5c616b` | 输入框占位/键面副字 |
| `--scrim` | `#000000b8` | `#ffffffb0` | 语音浮层遮罩 |
| `--radius-key` / `--radius-card` | `5px` / `10px` | 同左 | 圆角 |

- 强调**填充**与强调**文字**分开：绿底上用 `--accent-ink`，普通底上用
  `--accent-text`；禁止拿 `--accent` 直接当小字文字色。
- 次要文字必须满足 WCAG AA（≥4.5:1）。浅色 `--muted` 取 `#5c616b`：
  在 `--key` 6.1:1、`--panel` 5.7:1、`--bg` 4.9:1；`--special` 面上放
  `--text` 而非 muted。
- 少数语义色保持字面量（像素门禁依赖）：修饰键锁定态底 `#103a24`、语音
  浮层的录音红/错误红。新增颜色先问「token 表里有没有近义」，没有就加
  token，不加散色。
- **全角标点光学居中**：中文逗号/句号字形墨迹集中在 em box 左半，
  `.zh-punct` 的主字与副字都做 `translateX(.3em)` 光学修正并共享中心线，
  验收看截图墨迹中心与键中心偏差，不以 flex 居中算完成。

### 1.2 几何与高度预算

- 键高 `--kb-row-h`（默认 44px），键圆角 5px，水平间距 5px，行距 5px，
  左右边缘 4px；底行 flex 权重：123=2.1、标点=1.0、空格=4.15、中英=1.15、
  enter=2.25。
- 竖屏内容预算：工具栏 40px + 候选条 + 4 行键 + 行距 + 底部边距 ≈ 272px
  内容高（`heightDefault` 由原生下发，见 §14）。preedit 行 absolute 覆盖
  顶部留白，**不占独立高度**——组合态与空闲态键盘总高相同，避免抖动。
- 行高随键盘总高自动缩放（`applyHeight`），字号取 `min(原字号, 键高×系数)`，
  永不溢出键面；高度增加时四行等分新增空间，不设 60px 行高上限。
- 候选字号 17px 基值（三档 ×1/1.2/1.35，issue #2）；preedit 13px 基值
  （三档缩放，issue #8）；工具圆钮 32px 圆形；主字母 22px w400。
- **底部留白**：用户可为终端等场景把键盘整体抬高——`--kb-bottom-pad`
  （0/12/24/36/48dp，原生换算 px 下发）只作用于 `#softKeyboard` 的
  padding-bottom，加在内容之外：行高预算（`applyHeight`/
  `currentContentHeight`）先扣 pad 再等分行高，行高与不加 pad 时完全
  一致（UI-18）；高度上下限仍按内容高口径。
- **长按角标**：仅「长按有隐藏功能」的键右上角画一枚 4px 圆点
  （`--key-subtext`，`::after` 绘制，不占布局）——123（九宫格）、中英
  切换（模式菜单）、Shift（锁定）、控制层 Ctrl/Alt/Win/Fn（组合卡）、
  空格（长按语音）；连发类长按（⌫/enter/方向格）与字母弹层不画，满屏
  角标只余噪声（用户评审定稿）。

### 1.3 输入态（composing）

- `body.composing` 状态类由引擎事件维护。
- preedit（拼音/罗马字原串）显示在 `#preeditLine`（10px 小字，左对齐），
  **不写入宿主编辑器**（§5.2）。
- 组合态隐藏与输入无关的工具按钮；**麦克风在录音中不隐藏**（长按空格可以在
  组合中进入语音，必须保留停止入口）；候选条保留（点选/横滑）。
- 首候选绿字 + pill（`--pill`，圆角 8px）；enter 键文案组合态「确定」、
  空闲「换行」。
- 模式切换被原生拒绝（引擎数据未就绪）时 UI 保持当前模式（不乐观切换），
  状态区显示原因（如语言数据准备中）。

## 2. 界面结构

### 2.1 工具栏（candidateBar）

```
[F logo(快捷设置)] [控制键层] [🌐 切换系统输入法] [候选区/preedit] [剪贴板] [常用语] [×/˅(组合态)] [麦克风] [收起]
```

- 组合态隐藏 logo/控制键/🌐/剪贴板/常用语/收起，保留 ×（清组合）、˅
  （收起组合保留候选）与麦克风；候选区全量渲染累积池（§7.1）。
- 控制键层入口与 Fn 见 §11；🌐 调 `Native.switchInputMethod` 唤起系统
  输入法选择器；F logo 打开键盘内快捷设置面板（§6.1），完整设置齿轮在
  面板内。
- **工具栏编辑模式（issue #15）**：长按工具/空白进编辑——左右两组可
  自定义布局：仓库点按添加工具、× 移除、拖拽排序、溢出自动隐藏；可
  上栏的开关工具（色彩/振动/声音/联想/单手）在栏内即点即生效。布局经
  `setQuickPref('toolbarLayout')` 落盘（JSON，左右各 ≤4 项）。
- **单手模式侧条（issue #15）**：键盘左/右缘压缩出侧边条——方向键
  （`editorCursor`）、全选/剪切/复制/粘贴（`editorAction`，宿主编辑
  action 通道）。

### 2.2 底行

`[123 符号] [标点键] [空格(mic 内嵌,长按语音)] [中英切换] [enter]`

- 中英切换键：大字为当前模式简称（中/英/拼/双…），右下小字预告点击后的
  目标（§9.5 的目标计算）；长按弹模式菜单；控制键 Fn 态下十二个字母键
  主字形换成 F1..F12（§11）。
- 标点键：中文态主字「，」（空闲 tap 发 ASCII `,` 走引擎 punctuator 转
  全角；组合中两步流，§9.6）、上滑「。」；英文态 `.` 主字/`,` 角标。中文长按弹层：标点槽
  弹 ，。（enginePunct 同 tap）；字母键弹层的 CN_ALTS 字形走
  `sendSymbol` 字面直上屏（全角经引擎会被丢弃，字面 commit 不受影响）。

### 2.3 模式菜单（modeMenu）

长按切换键弹出，单列紧凑行（缩写在前的双 span，当前模式 accent 绿），
条目 = §9.5 的可用模式集合（主题切换在快捷设置的色彩模式 tile，
§6.1）。几何遵守
§0 浮层锚定（右缘对齐触发键、贴上沿、不够高退到窗口顶 + 滚动）。

### 2.4 符号层

- 底部横向分类条（两侧渐隐 mask + 相邻类目露头作滑动暗示）：
  `常用 / 定制 / 最近 / 引号 / 货币 / 数学 / 方向 / 序号 / 拼音 / 平假名 / 片假名 / 希腊`，
  按当前模式选默认表（中文模式默认中文表，英文模式默认英文表）；
  已在「常用」tab 再点一次「常用」= 中/英两表互换：tab 右下角小字
  `中`/`En` 标识当前表（借模式切换键的双写语法），切换输入模式后复位；
  「最近」回填跟随常用当前表。「引号」同语法：英文表补 ASCII 引号括号
  （`[ ] { }` 等此前无法输入的符号）。
- **方向分类**：字面上屏方向字符——四向 `←↑→↓`、双向 `↔↕`、斜角
  `↖↗↘↙`，以及制表符（`⇥` 格提交真实 `\t`）；不发按键事件、不连发、
  不记入「最近」。
- 每类 3×10 等高网格，单字符格 20px、多字符格 11px；第三行末位固定 ⌫，
  末行右侧 ABC + 换行键（与主键盘 enter 文案同步）。
- 最近使用符号自动记录（`feelime_symbol_recent`，不足时用「常用」当前表回填）。
- 符号点击一律 `commitText` 字面插入（不进引擎，防止数字被中文引擎当作
  选字键消费）；上滑/长按弹层走引擎通道（需要参与组词的场景，如法语
  撇号）。
- 「定制」分类来自 §15 的定制键表，无内容时隐藏。

### 2.5 顶部扩展带（floatBand）

- 原生 IME 窗口高度 = 键盘高度 + `floatBand`（约 200dp，横屏按
  `min(200dp, 真实屏×30%)` 收缩）；WebView 透明背景，HTML 顶部由
  `--band` 变量预留透明区（无独立元素）。
- 平时完全透明、不触摸（应用只让位到键盘顶）；浮层开启时经桥
  `setOverlayOpen(true)` 通知原生翻转触摸放行（`TOUCHABLE_INSETS_VISIBLE`），
  浮层（模式菜单/组合卡/行操作菜单/编辑卡/高度卡）进带并可点；确认卡
  定位在键盘区上方（不入带）。
- 扩展带对用户不可见时必须真正透明：键盘区背景由 `--bg` 提供。

### 2.6 九宫格数字键盘与 emoji

- **入口**：长按 123（350ms，与一般长按一致）开九宫格；单击 123 仍是符号层。
- **布局**：4×5 网格，列宽 `0.8:1.2:1.2:1.2:1`（数字列宽、左右两列窄）。
  左列上三格是数字场景符号条（`@ %-+/*()#$&_=~^:;`，
  竖向滑动、边缘渐隐，字面上屏），左下角强调色 ← 键任何状态下都直接回
  主键盘；右侧为 1-9/0/`.` 与动作列（⌫ 连发 / 空格 / emoji / 符号 / 换行），
  「符号」跳符号层。
- **上屏通道**：九宫格所有字符一律 `commitText` 字面插入——中文模式下数字
  不会被拼音引擎当作选字键消费，`.` 在任何模式都是点号（不进 punctuator）；
  不写入符号层「最近」。⌫/空格/换行走对应桥（⌫ 与换行带连发）。
- **emoji 子视图**：动作列 emoji 键展开，替换右侧数字区；横向 scroll-snap
  分页（每页 3×8），下方分类条（内置精选 7 分类 ~350 个，离线），滑动时
  分类条同步高亮；分类条最前的「123」tab 原地返回数字区（符号层 ABC 同
  语法）。点 emoji 字面上屏并记入「常用」（`feelime_emoji_recent`，存 16
  个；有内容时「常用」分类领先，无内容隐藏）。离开九宫格即结束 emoji
  会话，再次进入显示数字区。
- **层状态**：letters/symbols/numpad 三态由 `keyLayer` 单字段持有；面板/
  快捷设置/编辑卡借用键区后按记录原样归还（面板可从九宫格打开、关闭后
  回到九宫格）。

### 2.7 T9 九宫格键面（T9 模式主键盘）

模式（非层）：长按中/英键的模式菜单进入；键面渲染在 `qwertyLayer` 容器。
五列网格：左列常用字符/音节候选条（竖向滚动 + 底部符号面板键）、3×3 字母
组（主字形字母组 + 右上角标数字）、右列退格/重输/emoji/确认；底行 123 与
中英切换各 2/3 键宽、mic/空格 5/3 宽。点按=整组通配、四向滑动=字母消歧、
长按=数字+字母全后选浮层、确认键组合中=提交高亮候选——语义表与引擎侧
混合拼写 schema 见 docs/design/t9.md。

## 3. 剪贴板与常用语面板

### 3.1 结构与入口

- `#panelLayer` 全键盘覆盖（隐藏键盘层），顶部 `[收起] [剪贴板|常用语]`
  双 tab，列表区 + 空态文案；面板 `max-height` 受键盘区约束并可滚动。
- 入口：工具栏剪贴板圆钮、常用语按钮；组合开始时自动关闭面板（引擎事件
  优先）。关闭恢复字母层。
- 每次打开都重新拉取 `getClipboard` / `getFavorites`（设置页改过数据后
  再打开即新鲜）；native 侧变化经 `onClipboard` / `onFavorites` 推送。

### 3.2 列表行为

- 剪贴板项：文本预览 + 时间；点击上屏（`commitText`）并关面板。
- 常用语项：文本 + 输入码徽标；点击上屏。
- 敏感编辑器（密码框）里面板可用但剪贴板列表为空（`getClipboard` 返回空
  数组，避免密码管理器内容出现在屏幕上）——「敏感编辑器里点选常用语仍可
  上屏」是有意行为。

### 3.3 行操作与排序

- 长按（380ms，移动 12px 取消，不 preventDefault 保滚动）行文本或点 `⋯`
  弹菜单：置顶 / 编辑 / 删除（红，单击 + 确认卡）。
- 拖动手柄排序（写入 `feelime_mode_order` 同款顺序存储或 favorites 顺序）；
  长按触发后抑制同一次 click（不误上屏）；菜单外点关闭。

### 3.4 常用语编辑卡（浮卡）

- 添加/编辑走浮动卡片（band 内，非面板内联）——键盘 WebView 里的内联
  input 没有自己的 InputConnection，内联编辑会把字打进宿主编辑器。
- 卡片字段：正文 + 输入码（缩短）+ 位次 −/＋ 步进器（默认 1，范围
  1–99）+ 取消/保存；打开按条目回填，关闭复位。
- 输入通道（capability `panel-compose-v1`）：面板输入聚焦时原生把
  `commitText`/删除/选区操作**改道**回 WebView（`panelInput` 上报焦点态，
  服务用 `EditorPort` 包装器转成 `onPanelCommit` 等回调）。要点：
  - 字段有独立会话号，切换字段时排空此前输入，事件携会话号回原字段；
    卡片关闭后旧会话不能再写入新卡片；
  - 保存等待原生确认此前输入已处理，再读取最终字段；等待期间继续编辑
    会取消本次保存（可再点保存）；中文未选词的拼写也先处理再保存；
  - 组合中点候选、选字上屏都写进卡片字段而非宿主；编辑期间输入框 blur
    不释放改道（点候选会先 blur），显式保存/取消才释放；
  - 卡片**没有点外关闭**——按键是它的输入通道，仅 ✕/取消/保存 关闭。
- 正文与输入码都接面板输入通道；法语/俄语在卡片内重开词语替换原范围，
  不操作宿主文本。

### 3.5 容量与截断

- 剪贴板项文本预览**两行截断显示，存储不截断**（截断副本=静默数据损坏）。
- 剪贴板总预算 64KB（各条目 text 的 UTF-8 字节和 + 8KB 元数据余量），入队
  后循环弹出最旧直到达标；同文本置顶去重。
- 粘贴上限 2000 code point（`MAX_COMMIT_CODE_POINTS`）：超长条目在面板
  置灰不可点，标注「内容过长」——存得下≠贴得出。
- 常用语单条 ≤200 字、≤200 条；输入码 ≤12 字符、位次 1–99。

## 3a. 候选符号词（issue #17）

打 shang 出 ↑、dui 出 ✓ 这类符号/emoji 词，排在候选第 3 格附近；带开关，
词条在设置「键盘与输入 → 候选符号词」三级页增删改查（种子 27 条：箭头/
对错/心星手势/动物/天象/性别符号）。

- **词条通道**：rime 原生 `table_translator@custom_phrase`（stabledb，
  `user_dict: custom_phrase`），luna 与四个双拼 schema 全挂。码列匹配的是
  用户**实际按键序列的字面**（composition raw input）——不是音节形态：
  全拼码 `shang` 在双拼模式不命中，双拼按 u+h 命中 `uh` 行。因此真相源
  `files/rime-user/custom-phrases.json`（{text, code}，code=全拼串）派生
  custom_phrase.txt 时每词条写多行：原码一行 + code 是合法单音节时补四
  方案全部规范拼式行（拼式并集来自生成器产出的 APK 资产
  custom-phrase-codes.json，音节集合取 luna prism 第二列，424 个规范音节
  ——第一列混有简拼/纠错拼式，不能当音节）。跨方案码行字面共存=「别的
  按键序列也能打出该词」的附加候选，不会错词。
- **第 3 格**：引擎侧 custom_phrase 组受 initial_quality 0/1 悬崖支配
  （≥0.9 恒第 1、≤0.5 沉底，weight 不影响跨流位置），精确位次不可达。
  位置控制在 keyboard.js `injectFavoriteCandidates` 的**引擎池内**先排
  （纯符号词——无字母无数字——挪到 index 2），再走常用语/变体 overlay
  组装：常用语 rank 位次与空格确认的池头语义不被符号挪动二次改写；中文
  自定义词（含汉字/字母）保持引擎排位（quality=1 组第 1）。已渲染前缀
  （max(expandRendered, 3) 项 id 签名）变化时展开层全量重绘——增量水位线
  只认追加，不认前缀改写。
- **热生效**：stabledb 只在引擎生命周期加载一次（切 schema 重建会话不重
  读）。任何词条/开关变更走 `RimeTextEngine.reloadGlobal`（finalize +
  重新 init，synchronized(gate) 串行；换代 epoch 防 closeNative 对悬垂
  handle 误 destroy）+ `recreateEngineSession`。开关关闭或词条清空=删
  custom_phrase.txt（json 保留，用户数据不因开关丢失）。
- **恢复联动**：userdata 恢复换入 rime-user 后，按恢复的 json 幂等重派生
  txt 并广播 `CUSTOM_PHRASES_CHANGED`——设置页的 phraseItems 是全量重发
  语义的镜像副本，不刷新的话下一次保存会把旧副本写回（恢复竞态）。
- **页面防覆盖**：settings.js 的 phraseItems 初始为 null，state 未推送到
  前一切 CRUD/开关操作被拒（全量重发语义下空表会覆盖种子）。上限 200 条
  前后端同值。
- 备份：custom-phrases.json 与 custom_phrase.txt 都在 rime-user 下，随
  整目录进出备份。
- **词库导入（issue #37，2026-09-20）**：设置「候选符号词」卡可 SAF 选
  rime `.dict.yaml` 导入——`DictYamlImporter` 只取「词<TAB>码」行（头部
  无 TAB 键值/注释天然跳过；码去空格转小写，词 ≤32 字、码 1-48 位
  [a-z]；上限 5000 条，与手管词去重时手管优先），进 custom-phrases.json
  的 **imported 段**（与手管 items 并列但独立：三级页 CRUD 只动 items，
  导入是替换式，另有「清空导入词」入口）。派生 txt 两段同规则展开
  （导入词多音节居多，双拼变体展开只作用于单音节码）。语义是**叠加**
  而非换基底：不带原词频、quality 1 附加候选；整配置兼容与基底替换的
  分层结论见 issue #22/#23。



### 3.6 剪贴板采集生命周期

- `onStartInput` 按 `!isSensitiveEditor()` 置位采集 flag；`onFinishInputView`
  复位（收起后不采集）；同一输入框收起再弹出时恢复采集并读取收起期间
  复制的内容；敏感编辑器（密码等）永不采集；采集回调在主线程同步读该
  flag。
- 不能依赖可能不再触发的输入框切换回调（系统可能直接改默认 IME 或销毁
  窗口）。
- **清空抑制**：清空/单删后系统剪贴板仍持有被删文本，下一次焦点补录会把
  刚清空的历史原样复活（实测复现）。清除时记下当前剪贴板的 SHA-256
  指纹（只存指纹，绝不存原文），焦点补录命中同指纹即跳过；任何一次
  真实记录（复制监听器路径）解除抑制。指纹随历史持久化，进程重启后
  仍生效（§3.7 备份排除清单同文件覆盖）。

### 3.7 Native 侧（存储与外部提交）

- `panel/PanelStores.kt` + `PanelCodec.kt`：SharedPreferences
  `feelime_clipboard` / `feelime_favorites`，编解码为纯函数（JVM 直测）。
  常用语记录 5 字段 `id \t time \t code \t text \t rank`（旧 3/4 字段行
  兼容读取，rank 缺省 1）。
- **外部提交路径**：面板/语音/粘贴的 `commitText` 不直接写 editorPort
  （会绕过引擎状态机：组合不清、语音 partial 继续写 preedit）。走
  coordinator 外部提交命令：引擎会话中先 Reset（清引擎 buffer 并发正常
  引擎事件）再 `commitText`，随后推引擎状态刷新 JS；录音中先停止并丢弃
  半句再提交。
- **备份排除**：`feelime_clipboard` / `feelime_favorites` 进
  dataExtractionRules / backup_rules 排除清单。

## 4. 存储与偏好

Native（SharedPreferences，应用私有）：

| key | 内容 |
| --- | --- |
| `feelime_clipboard` | 剪贴板历史 JSON（§3.5 预算） |
| `feelime_favorites` | 常用语行记录（id/time/code/text/rank） |
| `feelime_keyboard` | 键盘热更新状态（active/previous 指针、更新源，§8）+ 手感/留白偏好（底部留白、长按时长、光标速度、弹层吸附） |
| `feelime_kb_height_<orientation>` | 分横竖屏的键盘内容高度 |
| `feelime_asr` | 语音设置（句号开关、热词表等） |
| `feelime_custom_keys` | 定制键表 JSON + enabled（§15，单一事实源） |
| `feelime_quick_pair` / `feelime_menu_modes` / `feelime_mode_order` | 快捷切换对 / 长按菜单勾选 / 菜单顺序 |
| `feelime_engine` / `feelime_smoke` / `feelime_bg` | 引擎数据与内部标记 |
| `theme_mode` 等 | 主题真相源已迁原生（`feelime_keyboard` 的 theme_mode/preeditBold 等，localStorage 旧值仅迁移来源） |

键盘 WebView（localStorage）：

| key | 内容 |
|---|---|
| `feelime_system_theme` | 最近一次系统主题（首帧防闪，§13） |
| `feelime_kb_height_<orientation>` | 高度卡确认值（内容高口径，≥120 视为新格式） |
| `feelime_symbol_recent` | 最近符号 |
| `feelime_scrub_speed` | 光标横滑速度档 |
| `feelime_ui` / `feelime_ui_locale` | 界面语言选择 |
| `feelime_custom_keys_v2` | 定制键表本地镜像（§15 同步规则） |

## 5. JS Bridge 与文本语义

### 5.1 方法表

JS→Native（全部 token 门控 + 输入校验；面板 id `[0-9a-f]{1,16}`、候选 id
另有 `[0-9a-f:]`（96 字符上限），文本 1..2000 code point 且拒绝孤立代理对/NUL）：

| 组 | 方法 |
| --- | --- |
| 文本 | `key`、`commitText`、`backspace`、`enter`、`space`、`moveCursor`、`clearComposing`、`setComposition`、`keyFeedback`（按键声/振动，§6.1） |
| 候选 | `chooseCandidate`、`pageNext`、`pagePrevious`、`deleteCandidate`、`deleteHighlightedCandidate` |
| 面板 | `getClipboard`、`removeClipboard`、`clearClipboard`、`getFavorites`、`favoritesAdd/Update/Remove/Move`、`panelInput`、`panelFlush`、`panelSelection`、`commitAssoc`（联想词点击，§3a） |
| 编辑器（单手侧条，§2.8） | `editorCursor`（方向键）、`editorAction`（全选/剪切/复制/粘贴） |
| 控制键 | `keyEvent`、`keyEventPhysical`（§11，keycode 白名单 + meta 位白名单 + 限流） |
| 语音 | `startVoice`、`stopVoice`、`cancelVoice`（启停经状态事件） |
| 模式/浮层 | `selectMode`、`switchInputMethod`、`hideKeyboard`、`requestState`、`setOverlayOpen`（§2.5） |
| 高度 | `setKeyboardHeight` |
| 更新 | `reloadKeyboard`、`keyboardReady`（握手，§5.3/§8）（`restoreBuiltInKeyboard` 是设置页桥） |
| 设置 | `openSetup`、`customKeys`、`setCustomKeys`、`setQuickPref`（§6.1）、`pushStores`/`getStores`（备份镜像，§4） |

（`copyText` 属设置页 SettingsBridge，不在键盘 ImeBridge。）

Native→JS 事件：`hello`（§5.3）、引擎状态 `onEngineState`（候选/组合）、
`onEditorInfo`、`onClipboard`、`onFavorites`、`onAssoc`（联想词）、语音状态
`onNativeState`（listening/partial/final/error 的 state+message 通道）。

### 5.2 文本提交与 preedit 语义

- **拼音/双拼 preedit 不写入编辑器**：组合原串只存在于键盘 preedit 行与
  候选条；选字 `commitText` 汉字、回车 `commitText` 原串（经
  preedit_format 归一，如全拼 `nv`→`nü`）、切模式/切编辑器时未确认组合
  **显式提交**（与法/俄语的 span 组合 `finishComposing` 分流，防双写）。
  法语/俄语拼写组合保留编辑器 span 语义。
- **组合落地**：flick/长按候选/符号/粘贴等外部插入前先把未确认组合显式
  commit（`pasteExternal`：先 commit raw 再插入字面量），避免组合区残留
  吞字（如 x + 上滑 e → `x3`）。
- **整词撤回**：法语选词后记录「已提交词+自动空格」，退格恢复词的编辑态
  （重新组词）；只吞输入法自动添加的空格，手动空格与标点前空格不吞；
  候选翻页不改已提交文本、不清撤回记录；旧分页请求按 revision 拒绝。
  程序化文本替换（编辑卡内）不作用户光标，整词撤回以字段实际光标与词尾
  空格为准，字段内容不匹配即废弃旧会话。
- 删除：选中替换 → 真 Backspace 键事件（§10.1）；光标：§10.2。
- 大小写：shift 单次、长按锁定（绿）；中文模式字母键面显示大写（跟手
  习惯），提交仍按引擎；符号不参与大小写变换。

### 5.3 握手（hello）与 token

- 每次页面加载，原生生成一次性随机 token 注入页面；所有桥方法必须携带
  token，不匹配一律拒绝（防同进程其他 WebView/恶意页面调用）。
- JS 侧就绪后调 `keyboardReady(version, minNativeApi, capabilities)`：
  - native 校验 `minNativeApi ≤ NATIVE_API_VERSION` 且
    `requiredCapabilities ⊆ CAPABILITIES`，不满足拒绝加载（§8.1）；
  - 通过后推送 `hello`：

| 字段 | 内容 |
| --- | --- |
| `nativeApiVersion` / `capabilities` | 原生 API 版本与能力全集 |
| `theme` / `uiLanguage` / `uiLocale` | 系统主题、界面语言选择、locale（§6.4/§13） |
| `orientation` | portrait/landscape（旋转时重推；JS 不用 innerWidth 自猜） |
| `safeBottom` | 底部导航/手势区 inset（CSS px，§14） |
| `floatBand` | 顶部扩展带高度（CSS px，§2.5） |
| `heightDefault` / `heightFloor` / `heightCeil` | 默认/最小/最大键盘内容高（§14） |
| 引擎与面板数据 | 模式、双拼方案、降级/预热状态、键盘偏好回读、engineDataReady |

- `@JavascriptInterface` 代理对象无法从 JS 侧包装（静默 no-op）：观察桥
  调用要换通道（引擎事件 / 宿主编辑器 / native 日志）。

### 5.4 能力与兼容门控

- 键盘在 `REQUIRED_CAPABILITIES` 声明所需能力（`candidate-revision-v1`、
  `clipboard-v1`、`commit-text-v1`、`compose-control-v1`、
  `unicode-compose-v1`、`cursor-repeat-v1`、`cursor-delta-v1`、
  `panel-compose-v1`、`favorites-v2`、`ime-control-v1`、`key-event-v1`、
  `keyboard-height-reset-v1`、`keyboard-update-status-v1`、`text-input-v1`、
  `voice-session-v1`、`voice-cancel-v1`）。
- 新 native + 旧键盘：兼容（未知字段忽略）；旧 native + 新键盘：握手
  拒绝——**新增能力必须随 APK 发布，绝不通过热更新推给旧 native**（会让
  旧 native 拒载、键盘整层哑掉）。
- 旧 APK 上新增的桥方法在 JS 侧用 `typeof Native.x !== 'function'`
  feature-detect（如任意候选删除），降级为禁用提示而非报错。

## 6. 设置

### 6.1 快捷设置（键盘面板内）

设置面板是键盘内流内区块（打开时替换按键层，观感是「换了一页」）。
3.38.0 起首页为微信式 2×4 方块网格（横向滑动翻页：JS 手势接管跟手拖动、
松手一次最多翻一屏——CSS scroll-snap 已显式关闭，防与拖动手势竞争；
翻页圆点保留），工具栏保持原样（齿轮 = 完整设置），网格末尾另有「完整设置」
大方块。方块即状态：点按直接生效并重渲染回读；tile 分四类——

- 循环档（点按轮换）：色彩模式（auto/浅/深，tile 状态行跟随）、候选字号
  （标准/大/更大）、拼音字号（标准/大/特大，issue #8）、界面语言（跟随
  系统/中文/English）、底部留白（0–48dp，按当前横竖屏落盘）、长按时长
  （200–600ms）、滑动选字（松/标准/紧）、单手模式（关/左手/右手）、
  双拼方案（自然码/小鹤/搜狗/紫光，四档）。
- 开关：中文联想、按键声音、按键振动（开 = 图标与状态行着色）、
  键帽不透明度（编辑工具栏的溢出开关工具，随布局落盘）。
- 动作：键盘高度（拉起拖动调节卡）、完整设置（关面板 + openSetup）。
- 子页导航：快捷切换（勾选切换对）、长按菜单（勾选+排序）、定制键盘
  （JSON 粘贴）。与主键盘重复的能力（语音听写、剪贴板）不进面板。

原生偏好写入走 `ImeBridge.setQuickPref(key, value, token)`（白名单 16 键：
association/keySound/keyHaptic/candidateFont/preeditFont/preeditBold/
keyOpacity/themeMode/oneHand/sideContent/toolbarLayout/bottomPad/holdMs/
popupSnap/uiLocale/dpScheme），落盘后广播 `ACTION_KEYBOARD_PREFS_CHANGED`（双拼
方案广播 `ACTION_DP_SCHEME_CHANGED` 触发引擎重建），receiver 重推 hello
让方块回读；hello 新增 `keySound`/`keyHaptic`。旧 APK 没有该方法时
tile 点按 no-op（typeof 守卫），绝不画假状态。二级内容（快捷对勾选、
长按菜单勾选+排序）为子页。双拼键位图随四方案（自然码/小鹤/搜狗/紫光）在
设置 app（keyboard.md §6.2 / double-pinyin.md §2.4）；「光标移动速度」
同样收编进设置 app 的手感微调组（UI-19）。

- 快捷切换：勾选两个键盘组成切换对（勾在前、名在后）；切换键点击 = 在
  对内翻转（在第一项时切第二项，其余情况切第一项）。
- 长按菜单：勾选进入长按列表的键盘（至少一个，空集回退全部）+ 拖动
  排序（`feelime_menu_modes` / `feelime_mode_order`）。

### 6.2 完整设置（HTML 设置页）

- 独立 WebView 加载 `assets/settings/`（不支持热更新），桥
  `SettingsBridge` 与 IME 桥同款 token 握手（§5.3）+ 全量 state 推送；
  主题 token 与键盘同源（§1.1）。
- 结构：首页（输入法状态 + 分组入口 + 输入测试入口）→ 二级页：键盘与
  输入（双拼键位图/候选符号词三级页/定制键盘/**手感微调**：底部留白
  0–48dp、长按时长 200–600ms、光标横滑速度 1–5x、弹层吸附 松/标准/紧
  ——档位在桥端校验，非法值具名报错）、外观（主题/背景图/键帽不透明度/
  单手压缩比例，issue #15）、语音识别、键盘热更新、备份（userdata 导入
  导出，userdata.md）、关于（版本信息一键复制 + 第三方许可）、输入测试。`showPage` 切换，不上 hash 路由；
  系统返回键在二级页先回首页。手感项保存即经
  ACTION_KEYBOARD_PREFS_CHANGED 广播触发 hello 重推，键盘免重开生效。
- 输入测试/调试区仅 debug 显式开关（EXTRA_SHOW_FIXTURES）启动时可见，
  页内无入口。
- 设置页能力：系统输入法启用/跳转/选择、麦克风权限、模型管理（§12.3）、
  键盘更新（§8）、定制键表编辑（§15）、语音设置（§12.5）、界面语言
  （§6.4）、系统入口（§6.3）。剪贴板/常用语管理只在键盘面板（§3）。

### 6.3 系统入口

- 默认输入法状态监听系统变化（完整/缩写组件名都认），系统选择器改默认
  后页面状态即时刷新。
- 桌面快捷方式、小部件、Android 快捷设置磁贴共用「选择输入法」入口：
  前台临时窗口打开系统 picker，选择后关闭；不申请写安全设置权限。

### 6.4 界面语言

界面语言（auto/中文/英文）独立于输入模式：跟随系统或手动选择；两端
（键盘/设置页）动态与静态提示、无障碍标签与原生状态同口径；用户输入、
候选、定制内容不翻译。切输入法不改变界面语言。

## 7. 候选系统

### 7.1 统一累积池

- 候选条与展开区共享同一累积池（`expandCandidates`）：native 分页经
  `pageNext/Previous` 追加，按 id 去重；组合 key 变化才重置（切变体的
  rewind 中间态不重置——空 raw echo 守卫）。
- 条全量渲染池（首候选 pill + 绿字），横向滚动到末端自动追加（加载后
  900ms rearm 防卡死；重建保持 scrollLeft）；展开区纵向网格同池。
- 「确认第 N 候选」（含空格确认池首）一律按 id 选择（`chooseCandidate`），
  引擎侧维护 id→(page,index) 映射并 seek 到位——与当前页游标解耦。
  每次分页带 revision，过期回包拒绝（防旧分页响应覆盖新状态）。
- seek 失败发当前状态并 reject，不静默错选。

### 7.2 展开区（拼音）

- 两栏：左侧拼音列表（原输入 + 有效完整拼音/解析），右侧候选网格。
- 全拼 `x'an` 类（恰一个不完整音节）左栏枚举 `xi'an` / `xiang'an` /
  `xin'an` …；点选经 `setComposition` 原子切换（单次桥调用完成 Reset+重打，
  不塌层），右栏更新；连续选择/返回沿用同一列表，新输入才重建；切换
  过程中禁止选旧候选（原生重放的中间状态不重置池与左列）。
- 完整拼音（解析唯一）不扩展；≥2 个不完整音节不枚举组合。
- 词频/单字筛选 tab、收起保留已取候选（同组合再展开继续）。

### 7.3 重音变体（法/俄等）

- qwerty-fr 长按集含 ä/ö/ç 等；首字符重音变体注入候选池（仅非 ASCII
  字形），位置在引擎首候选之后；空格跳过 `alt:` 变体；词典无候选时提交
  原词+空格（不误触重音替换）。
- 点选变体经 `switchToVariant` 原子替换首字符并**继续组合**
  （`ete` 点 ê → `ête` 仍组词），不落组合、不裸 commit；点重音保留候选
  区当前展开状态。
- 双拼展开的变体列表锚定初始解析；完整双拼键序（解析唯一）不扩展；
  变体原地切换只移高亮不缩水。

### 7.4 常用语注入（输入码 → 候选）

- 常用语带输入码与位次（rank）。注入挂在候选池唯一漏斗
  （`accumulateCandidates` 尾部），条与展开区共享：
  - 匹配：输入（去回显空格、小写）`startsWith(code)`，**覆盖完整输入码
    才注入**（继续输入保持命中）；
  - **精确命中（raw === code）按位次插槽插入**：rank 升序（稳定）splice
    到 1-based 槽位；同位次按列表顺序并排；rank 超出池长收敛到尾部；
    rank 1 = 池首（accent 位）。前缀命中插在引擎首候选之后；
  - 引擎候选相对顺序不变；同文本去重；注入条目 id 为 `fav:<id>`
    （overlay，不进引擎）；
  - 幂等：每次注入先剥离池内全部 `fav:` 条目再按当前匹配重算——组合中
    增删改常用语都收敛，不丢条目、不残留死 id。
- 选择路径单一漏斗（`choosePoolCandidate`）：`fav:` 条目走
  `clearComposing` + `commitText`（组合 raw 不落屏，只上短语本体）；
  空格确认池首同走该漏斗。
- 数据：hello 预热 `getFavorites`；`onFavorites` 推送带 code/rank，
  组合进行中列表变化即时重注入并立即重绘。
- 已知边界：双拼输入码按**实际键序**匹配（如自然码「你好」= `nihk`）；
  默认输入码由离线字表生成（汉字首字母），用户显式填写优先，多音字读音
  可手动修正。

### 7.5 删除自造词

- 通道：librime 桌面同款 `Shift+Delete`（经 express_editor 的
  ShiftAsControl 命中 `Editor::DeleteCandidate`，写 userdb 删除标记），
  不需要重编 native。
- 任意候选：按候选 id seek（Next/Previous 循环）到页首再逐位移高亮到
  目标，然后删除；删除静默且返回值不可信——JS 记 pending，echo 到达后
  重建池并按**文本比对**判定成败（词还在 →「来自固定词库，无法删除」；
  词消失 →「已删除」）；展开层打开时整层重绘（增量渲染会残留被删词的
  按钮）。
- 已知边界：删过的词再次上屏会重新学习（librime 删除标记复活）；同文本
  同时存在于固定词库时可能误报「无法删除」（低概率，接受）。

## 8. 键盘热更新与包安全

键盘前端（HTML/CSS/JS/VERSION）可以独立于 APK 更新。安全模型：包必须
通过签名与能力双重校验才能激活；激活原子；随时可回退。

### 8.1 manifest 与能力门控

- 包内 `manifest.json` 为 canonical JSON（确定性序列化，纯 Kotlin 解析，
  不引 JSON 依赖）：`minNativeApi`、`requiredCapabilities`、逐文件
  `sha256`、Ed25519 签名。
- 握手门控：键盘 `minNativeApi ≤ NATIVE_API_VERSION` 且
  `requiredCapabilities ⊆ native CAPABILITIES` 才允许加载（§5.3/§5.4）。
- 更新源：设置页保存一个 **metainfo URL**（`{"keyboard_version":…,
  "url":…}`，no-cache 现拉现解析，自动填 zip 地址）；支持 GitHub
  Release 适配（只接纳 metainfo 指向或精确匹配的键盘 zip 资产，拒绝
  无关/歧义资产，限流退避）；可选自动检查每日最多一次；清空源 = 停自动
  检查、保留手动入口。
- debug 构建可放行 `http://` 内网源与未签名包（红色警示标明）；
  release 一律 HTTPS + 强制签名。

### 8.2 包结构与校验

- 结构检查先于内容读取：zip 条目路径安全（无 `../`、无绝对路径）、
  大小有界（内容 ≤10MiB 上限）、bounded inflate（不信 header 声明的
  尺寸）。
- 逐文件 sha256 与 manifest 比对；签名（Ed25519，公钥内置于 APK）先于
  内容信任；启动时对已安装包做二次校验（manifest + 存储的签名）。
- 拒绝路径全部显式：能力缺失提示升级 APK；未签名包在 debug 上可装但
  永久红标。

### 8.3 原子安装与恢复

- 安装序列：staging → fsync → rename → 指针切换，只有一步生效；任意
  一步失败保留 previous。
- 激活后清理旧版本仅在**成功 ready 握手之后**（防新包加载失败无回退）。
- 解析顺序：active → previous → APK 内置。「恢复内置键盘」立即把内置
  副本重新播种到当前 APK 版本（只清指针会回退到 previous——旧热更——
  而永远到不了新内置，这是真实踩过的坑）。
- 内置副本播种按 **VERSION + 逐文件字节比对**：只比 VERSION 会导致同
  版本号新内容永不生效（改码不生效的经典假象）。
- 本地 ZIP 导入：系统文件选择器取当次读取授权，大小上限与下载一致，
  复用同一校验/激活/回退链路，不构造下载地址。

## 9. 输入模式与引擎

| 模式 | 引擎 | 语义 |
| --- | --- | --- |
| 英文 Direct | DirectTextEngine | 逐键立即上屏，无组合 |
| 全拼 / 双拼（自然码/小鹤/搜狗/紫光） | librime（RimeTextEngine） | §9.3 |
| T9 九宫格 | librime（RimeTextEngine，独立 schema） | §2.7 / t9.md |
| 笔画五键 | librime（RimeTextEngine） | §9.3a |
| 法语 / 俄语 | Hunspell（HunspellTextEngine） | §9.2 |
| 日语 | Mozc（MozcTextEngine） | §9.4 |

### 9.1 英文 Direct

逐键 commit、空格/退格直发；shift 一次大写、长按锁定（武装态同时是
组合修饰位，§11）；上滑副符号、下滑大写；长按字母弹 alt 弹层（相对
跟手选中，拖出卡片取消、拖回选择）。

### 9.2 法语 / 俄语（Hunspell）

- 离线词典候选（`bonjor`→`bonjour`；`превет`→`привет`）；未知词原样
  提交（原词+空格），不阻塞。
- 选词提交**词+空格**；已选词后的退格吞自动空格回编辑态（§5.2 整词
  撤回）；词内撇号（直撇/弯撇）保留，`l'homme` 不拆词、后续字母继续
  同一组合，不在撇号处提前提交。
- 首字符重音变体（§7.3）；连排重音组合经原生 `unicode-compose-v1`。

### 9.3 中文（librime：全拼 / 双拼四方案）

- schema 固化在 `engine-data/rime`（简体输出：`simplifier` filter +
  `reset: 1` + uniquifier——translator 级 opencc 配置无效）；双拼用户
  词库独立命名（`translator/user_dict`），与全拼不共享 userdb；用户词
  频次权重高于静态词典（连续造词后重打排第一）。
- **基底词库 = rime-frost 瘦身组合**（issue #39，2026-09-20）：
  gaboolic/rime-frost@96278d8（GPL-3.0）cn_dicts 的
  8105/41448/base/ext/others/corrections 六件，仓库 umbrella
  `scripts/research/dicts/rime-frost-umbrella.dict.yaml`（name 保持
  `luna_pinyin`——fuzzy m1-m31/双拼/T9 全部 schema 引用同一词典名）。
  A/B 选型与复跑方法见 `scripts/research/dict-ab/README.md`（frost 瘦身
  95.3% 首选命中 vs 旧 luna 89.0%，table 19.4MB）。词库换装时 prism/
  table **必须成对同场重编**（含 31 个模糊音变体：
  `scripts/generate-fuzzy-prisms.py`；T9：`scripts/generate-t9-schema.py
  --compile`，env `FEELIME_T9_DEPLOYER/FEELIME_T9_SHARED` 指现场）。
- 零声母自然码主打法是**全拼**（啊=aa、爱=ai、安=an、恩=en、二=er），
  O 系（OJ/OL…）只是兼容派生；键位参考图由 schema 的拼写代数生成
  （`scripts/generate-keyboard-data.py`，`--check` 校验源码一致）。
- **prism 同源约束**：双拼 prism 的音节 id 必须与全拼 table 的音节表
  编号一致——两者必须由同一 librime 版本对同一词典编译，独立编译的
  prism 会导致双拼候选全空。
- 连续造词：选首候选后有剩余输入时保持组合（preedit 如「你hk」），
  引擎仅在组合清空时补 ENTER——有剩余输入时补 ENTER 会把「已确认部分+
  剩余原文」整体上屏。
- 分词键（'）：中文模式（含双拼）的 wide 槽固定为分词键；搜狗/紫光
  双拼该槽是 `ing` 字母键（发 `;`）；非中文模式才是 Shift。全拼 `x'an`
  走声母简拼聚合（§7.2）。
- **T9 九宫格**共用本节引擎链路：独立 schema `luna_pinyin_t9`（首/末字母
  保护 × 26 + xlit 的混合拼写 algebra，prism 约 140KB）、键盘侧五列键面与
  手势仲裁、音节候选条与 setComposition 组合重写、BridgeContract 对 T9
  模式放行数字——详见 docs/design/t9.md。

### 9.3a 笔画五键（issue #18）

- **键面**复用 T9 五列网格骨架（`renderStroke`，与 `renderT9` 共用
  `t9GridSide`/`t9GridChrome`/`t9Place`）：1-5=一丨丿丶乙（点按发
  `h/s/p/n/z`）、6=＊单通配、7=@#. 符号组（同 T9 的 1 键：点按展开符号
  行、无长按）、8=，、9=分词 `'`。`data-key` 恒为数字（手势/浮层/套件按
  数字索引）；1-9 上滑=字面数字（commitText 旁路），其余方向无语义（不
  落通用分支发 CN_ALTS/大写）；长按=T9 同款三排浮层（小写字母组/符号·
  数字·符号/大写字母组；字母组沿用拨号键盘分配 2=abc…9=wxyz，上屏同
  T9：字母符号 literal 直上屏、中格数字=点按同义发部件编码；1 键无字母
  组退回单排，7 键无长按）；空格/确认键组合中按 id 确认池头候选；左列
  常用字符恒定（无音节枚举）。
- **词典**（`scripts/generate-stroke-dict.py` 生成，`--check` 门禁；接入
  `build-cmake-native-engines.sh`——生成→编译→四件与仓库资产逐字节 cmp）：
  上游 rime-stroke 17 万单字裁剪到 GB2312（11048 精确行，多码字全保留）；
  权重用 rime-essay 单字频次经 opencc TSCharacters 繁→简聚合同字取 max
  （essay 以繁体统计，直查会让两千简体常用字零频）；每条码（≤20 笔）派生
  单通配变体（第 i 笔→`*`，按 (字，码) 去重，权重 ÷1000）共 116489 行。
- **schema**（`feelime_stroke`）：`alphabet: "hspnz*"`、delimiter " '"、
  `enable_completion: true`（打前几笔出候选）+ `enable_sentence: true`
  （probe 实测：`'` 分词查询与无前缀长码兜底都靠 MakeSentence）；preedit
  由 xlit 回显部件字形（rawInput 即显示形，`*` 原样）；标点**内联**
  half_shape（部署目录没有 default.yaml，`import_preset` 静默落空——
  设备实测 ',' 无人处理出乱字）。
- **句子候选压后**：词典单字（max_phrase_length=1）下多字候选必是造句
  （☯，comment 不在桥协议里，按字长识别），键盘侧压到单字之后——否则
  `h'z` 的「一乙」顶掉首字候选。
- **组合中 8 键逗号两步流**：Android 构建的 librime 组合中标点路径行为
  异常（实测：stroke 提交通配派生字、拼音整体吞键；host gcc 构建正常、
  真机/模拟器 Android 构建复现，机制未明），键盘侧改为——按 id 确认池头
  候选，组合结束回声到达后 `commitText` 直发全角 ，；重输/切模式立即作
  废，raw 变化或 3s 无回声收尾也作废（迟到的逗号比缺逗号更糟）。点按与
  长按中格走同一入口 `strokeActivate`（通配/逗号守卫不被弹层绕过）；6 键
  第二个 * 拦截含「在途」标志（连点不等回声也只进一个 *）。空闲 8 键仍
  发 ASCII ',' 走 punctuator；7 键符号行仅空闲可开（组合中让位候选）。
- **组合中禁自动追页**（2026-09-20）：候选条「池不满自动拉页」的通用
  机制在 stroke 下每键自动发一次 PAGE_DOWN——笔画候选池只有几条、条
  恒不满，而 librime 的 Next 键会耗尽 MakeSentence 翻译流并把 selector
  高亮挪走，composition 直接塌成分段坏态（`那'个` 输入显示「乙hhpzs'p」、
  候选只剩「乙」；INFO 日志实锤：`translation #0 has been exhausted` +
  `process key: Next`）。`maybeLoadMoreCandidates` 对 stroke 组合态直接
  return；拼音候选多、一两页就溢出停止，不受影响。排查时已排除 .so/
  数据/多会话/setup 序列等全部变量（原生 probe 同链路全对），差异只在
  JS 侧的自动翻页。
- **strictReady**：stroke 菜单项要求 hello 的 `engineDataReady.stroke ===
  true` 才可点（旧 APK 不带该字段，宽松的 `!== false` 会给出可点却无效
  的入口）。
- 已知边界：completion 排序契约含「剩余码长度」维度，通配行不保证严格按
  字频排在精确行后（首格为精确行的实测样本稳定）；completion 的剩余码
  comment 不展示（v1）。

### 9.4 日语（Mozc）

罗马字→假名（`konnichiha`→こんにちは；`nn`→ん）；空格触发汉字转换
（仅在转换后出候选）；逐级退格（转换后 ⌫ 按阶段回退 きった→きっ→き）。

### 9.5 模式切换

- 键盘侧记忆：切换键点击在**快捷对**内翻转（§6.1），小字预告目标；
  长按菜单列出全部启用模式；hello/引擎状态重放不喂记忆（防构造默认
  污染）。
- 编辑器级限制按本次 `EditorInfo` 判定，不延续到下一个编辑器：
  - **密码类输入框**强制英文 Direct（组词跨度不得渲染进密码框），
    禁语音、剪贴板列表置空；
  - **终端（TYPE_NULL）**不再强制英文——按用户保存的模式启动，模式
    菜单全部可选（§10.7 已知边界照实声明）；
  - 无法切换时返回明确原因；语言数据准备中显示状态而非静默失败。
- 切换语义：拼音/双拼显式提交未确认组合（§5.2）；引擎 warmup 期间输入
  进队列，切换完成后重放（不丢键）。
- **统一降级（unified degrade，IN-18）**：warmup 超时（15s）、引擎工厂/
  初始化/运行时失败、数据不匹配、队列溢出（>256 键）全部收敛到单一
  `degradeToDirect(failedMode, reason)` 迁移——立即落英文直出、显式标记
  （模式键「!」徽标 + 状态条 + 一次性提示，`seq` 单调保证每次失败只通知
  一次）；期间键入排队并在降级时整队重放，零丢失；重试失败模式期间徽标
  保留，其 READY 落地才清除并提示恢复；密码框/主动 Direct 等显式切换
  清除降级。`hello` 重放恢复徽标但绝不弹提示。完整状态机与历史根因见
  [mode-fallback.md](mode-fallback.md)。

### 9.6 中文标点

- 中文模式标点键发 **ASCII** 字符进引擎 punctuator 转全角（，
  。配对弯引号）；全角直发绕过 punctuator 会被 librime 丢弃——禁止。
  **例外：组合中**——Android 构建的 librime 组合中标点路径吞键（拼音
  `ni`+`,` 整体无声丢弃、stroke 会提交通配派生字；host gcc 构建与空闲
  路径均正常，真机复现，机制未明）。键盘侧统一走两步流
  （`enginePunct`，与笔画 8 键同一机制，§9.3a）：组合中先按 id 确认池头
  候选，回声收掉组合后 `commitText` 直发全角标点（`，`/`。`）；raw 变化
  或 3s 无回声作废。覆盖 qwerty 标点槽三条路（tap/上滑/长按弹层）与
  全拼、双拼。空闲态仍发 ASCII 走 punctuator。
- 数字与 CN_ALTS 表指定符号保持半角；CN_ALTS 是第二行/第三行的副字表
  （全拼/双拼共用，表值即最终提交字形）。

## 10. 编辑、手势与宿主兼容

### 10.1 删除通道

删除一律发**真 Backspace 键事件**（KEYCODE_DEL）：选中替换 → 删除选区；
Unicode 代理对/组合字符按码点完整删除。理由：`deleteSurroundingText`
只改写 InputConnection 层，xterm.js 类终端宿主永远看不见（§10.7）。
TYPE_NULL 假 InputConnection 会对删除调用假成功——不做行为探测，直接
键事件。

### 10.2 光标横滑（scrub）

- 字母键上水平滑动移动光标：12px/步连续跟手，越过 38px 识别阈值时锚点
  取「起点沿首次手势方向到阈值的交点」再按当前速度每步计算——快/慢
  采样即使事件数不同也落在同一位置；正常抬起用 changedTouches 补最后
  一段，取消手势不动光标。
- 位移批量经 `cursor-delta-v1` 发原生（`moveCursor(delta)` 带余步合并），
  native 在后台查询编辑器、按编辑器会话拒绝过期结果；碰到边界后反向、
  选区收拢、Unicode 码点移动语义保留；异步读取期间积累的移动在同一份
  文本上顺序计算。
- **通道选择**：
  1. 普通编辑器：快照路径（getExtractedText + setSelection），焦点不
     逃逸（方向键会把焦点挪到别的控件）；
  2. 完整快照不可用 → 读光标前后文本与已知选区，选区非空必须取得真实
     选中文字再按码点计算；读取暂时失败允许重查；
  3. 确认不提供文本快照的连接（空快照形态）→ 后续直接发系统方向键，
     不再重复查询；
  4. **整应用都是终端壳的包**（按包名配置，如 Termux）→ 一律真键事件
     通道（DPAD → WebView 转 DOM keydown → 终端语义）。这类宿主的
     InputConnection 会把已提交文本镜像回隐藏 textarea：快照回读、
     选区回报全部「正常」，但终端光标不动——行为探针无法识别，只能按
     包名路由。浏览器等混合宿主绝不能进该名单（普通输入框靠快照路径）。
- 能力记录随 InputConnection 与生命周期重置；已因编辑器变化失效的移动
  不重放；连接对象更换时释放查询状态。

### 10.3 Enter

多行编辑器默认 `commitText("\n")`（宿主隐式默认 NEXT/DONE 会跳字段）；
宿主**显式**动作（SEND/GO/SEARCH 等，非 DONE/NEXT/NONE/UNSPECIFIED）且
未设 NO_ENTER_ACTION 时执行宿主 action；搜索/发送框遵循 imeOptions。

### 10.4 flick 与长按

- 上滑副符号（数字/符号直上屏，中文模式数字保持半角）、下滑大写；
  中文模式 flick 值按 CN_ALTS 表输出。
- 长按弹层：相对跟手选中（与 T9 三行弹层同款，t9.md §3）——高亮锚在
  预选格（大写形）上、跟随手指相对按下点的位移移动，手指不必先滑上
  浮层；虚拟光标滑出卡片边界进入取消态（淡出 + 「松手撤销」toast，拖回
  恢复），手感档（popupSnap）缩放抖动死区与边界容差；
  `elementFromPoint` 出键取消长按；长按 timer 挂 touchcancel 清理
  （来电/手势中断不派发 touchend，浮层不得照弹）。
- 方向反馈用方向性半透明椭圆（WAAPI 位移+形变+淡出），不飘出实际字符；
  无 animate 环境立即移除防残影。

### 10.5 组合中退格左滑

落在退格键上的水平左滑（越过 38px slop）一次清掉整段拼音 preedit；
空闲状态 no-op（swiping 标志吞掉释放点击，不误删字符）。

### 10.6 触摸状态卫生

键盘收起、页面失焦或隐藏时清除按下高亮、长按计时器、连发与滑动状态；
新触摸序列不继承缺少结束事件的旧按键；光标滑动只追踪起始手指，第二根
手指的抬起不终止它。

### 10.7 宿主与平台边界（声明不修）

- **ColorOS 焦点清除**：EditText 收到 KEYCODE_ESCAPE 会清除该编辑器的
  view 级焦点，期间键事件派发不到编辑器（退格失效），点输入框重新聚焦
  即恢复；stock Android 不处理 ESC，无此现象。
- **远程桌面（Windows App/RD 客户端）**：Win+字母组合无法表达（客户端
  把 Win 配对成瞬时按压、吞掉带 META 位的键事件），按住 Win 需用远程
  工具条自带键；Alt+Tab/Alt+F4 经物理事件序列可用（§11）。
- 密码框被部分 OEM 的安全键盘整体接管（IME 收不到 EditorInfo）——
  敏感判定矩阵由 JVM 单测覆盖，设备上如实跳过。

## 11. 控制键层与 Fn

- **开关而非一次性视图**：控制键层是持久开关（工具栏入口切换，X 关闭）；
  组合输入/面板/设置面板/高度编辑期间「让位」（收浮层、清粘滞、让出
  槽位），结束后自动恢复；X 是唯一真正关闭。
- **槽位**：控制层两行替换工具栏槽位（竖屏 40px / 横屏 62px = 候选条
  `4+14+40+4` 与控制条 `3+(27+2+27)+3`），**不压缩键盘行高**；两行共用
  8 列网格逐列对齐；键面用主键盘字母键样式（非功能键反色）。
- **粘滞键**（Ctrl/Alt/Win/Fn）：点亮=武装（绿 `--mod-active-bg`），按压
  反馈与粘滞解耦（按住=灰 `--pressed`）；已武装再点一次 = 发裸左键
  （单发 Win 打开开始菜单）；组合落地后全部粘滞清零；粘滞只认 `.active`
  类，按压态不闪绿。
- **主键盘 shift 参与组合**：shift 的单次武装态（点亮，§9.1）等同于一个
  粘滞修饰位——与控制键行普通键组 Shift+Tab / Shift+方向（选区）/
  Shift+Del；与控制层粘滞键叠加成 Ctrl+Shift+字母；Fn 武装时组
  Shift+F1..F12。点亮顺序无关（控制层只替换工具栏槽位，字母键行仍可
  点）。组合落地即消费 shift；shift 单独武装时字母照旧走一次大写，不进
  组合通道；长按锁定的 CapsLock 不参与组合（物理键盘同语义）。
- **发送通道**：`keyEvent(code, meta)` 走 keycode 白名单（A..Z、
  F1..F12、Esc/Tab/Home/End/PgUp/PgDn/方向/DEL/PERIOD/F4、Enter/Space/
  Backspace（定制 DSL 与 Fn 层）、裸 Ctrl/Alt/Meta 左键（武装态二次点击））+ meta 白名单
  （SHIFT|ALT|CTRL|META 位，组合时补 `META_*_LEFT_ON` 物理左键形态）；
  **凡 meta≠0 的组合一律走 `keyEventPhysical` 物理四连发**（左修饰
  DOWN → 键 DOWN → 键 UP → 修饰 UP，逆序释放，eventTime 递增）——单
  事件形式会让远程端把修饰键卡在按下态（Alt+Tab 卡死、后续 Win 全乱）。
- **Fn**：武装时 Q..P/K/L 十二键主字形换 F1..F12（单行小字，原字母降为
  副字），点击发对应 KEYCODE_F1..F12；长按 Fn 打开 3×3 组合浮层（组合
  浮层唯一入口）；解除锁定恢复字母。
- **组合浮层**：锚定触发键上沿、可缩格（58→40px）、贴侧边兜底（§0），
  28px 圆形角标 ✕（absolute 于卡片右上角，不占格子）；触发键再点=只收
  起（一次性抑制标记，不「收起+执行」）；点浮层外关闭；浮层开着时点
  锚点键走关闭分支。

## 12. 语音（离线识别）

### 12.1 双通道识别

- 流式：sherpa-onnx bilingual Zipformer（`modified_beam_search`）实时
  partial；每个停顿段由 bilingual Paraformer 整句纠错（final pass）；
  最后本地标点模型恢复标点 + 英文归一化（大小写/缩写如 `what's`）。
- 同次语音分段拼接：前段以字母/数字结束、后段也以字母/数字开头时补
  空格（预览与最终提交一致，防止去句点后单词黏连）。
- 不以句号收尾：默认剥掉句尾句号（只剥 `[.。]`，问号/叹号/省略号语义
  保留；吗/呢/么→？与英文句首疑问词启发式保留）；可在设置关闭。

### 12.2 录音生命周期

- 入口分两种浮层形态（_userdata.md §2.1_）：
  - **长按空格**：松手就上屏，浮层无按钮；**上滑撤销**——上滑途中浮层
    随进度变小变透明、「上滑撤销」字样变明显（过阈值进入 arm 态），
    过阈值松手=撤销（toast），未过阈值松手=上屏；提示「松手上屏 ·
    上滑撤销」。
  - **点工具栏麦克风**：「点击任意位置结束」（点浮层内外都结束并提交），
    浮层里「↺ 撤销」小按钮在右上角（单击弃稿 + toast），「✓ 说完了」
    accent 实心大按钮居中（主要出口，更大的点击目标）。
- 一次录音的分段属于同一次输入：只有正常结束才最终提交；取消撤回本次
  全部临时文字并保留录音前文本与原选区；启动未完成时取消同样生效；切换
  编辑框后旧录音结果/撤回不写入新编辑框。
- 采集独立于识别线程（有界队列，识别慢于录音不丢音频）；待处理音频最多
  约 24 秒，超容量停止并提示分段重试，不静默丢弃；关闭服务取消等待并
  释放录音。

### 12.3 模型管理

- 打包：full 包内置全部模型；thin 包不含模型，首次使用前在设置页下载
  或本地导入。运行时经 `ModelStore.sourceFor` 解析（assets 优先，其次
  下载副本），**source 为空绝不进引擎构造器**（构造器会 `exit(-1)` 静默
  杀进程）。
- 下载：多镜像按序尝试（连接失败/超时/4xx/5xx/中途断流记录后换下一
  镜像，416 清空 part 从头续）；断点续传；逐文件 sha256 + INSTALL.json
  落款；进度整 percent 节流；失败原因持久化（刷新/重进仍可看），重新
  下载/导入清除旧错误。
- 流量同意：移动计费网络下载需显式同意（显示整包大小与安装占用）；请求
  绑定该网络（DNS/socket），换网/断网/未同意即断开并保留已下载部分；
  取消为持久状态（未建连也不能再开始）；不绑定整个进程、不自动转新
  移动网络。
- 本地导入：系统文件选择器（当次授权，不申请存储目录权限）；先在临时
  目录校验完整性，全部符合当前清单才替换安装目录；选择器期间旋转可
  恢复请求；取消不改动现有模型；ZIP 未声明条目大小时按实际读取计数。
- 模型清单见 `third_party/`（来源、SHA-256、许可证）。

### 12.4 热词

- 设置页热词表（一行一词，中英混合，上限 50 行）；以**原始词语**传给
  sherpa（由其原生编码器做一次 BPE 编码，`/` 分隔条目）；随包分发与
  模型 token 表同源、SHA 校验过的 `bpe.vocab`，`modelingUnit` 显式配置
  （缺失会让 native `SHERPA_ONNX_EXIT(-1)` 静默杀进程）；hotwordsScore
  与实测配置一致。
- Paraformer（整句纠错）不支持上下文热词：不给它传热词；仅当流式结果
  已命中热词、终稿却丢失时保留该段流式结果（匹配忽略大小写与字间空白，
  保留拉丁词边界）；其余情况采用终稿。
- 传参前校验：不支持注入协议字符（`/`、`#`、`:`），模型不支持的字符在
  进 native 前明确报错。

### 12.5 语音设置与隐私

- 设置（`feelime_asr`）：去掉句尾句号（默认开）、热词表；下一次语音会话
  生效。
- 隐私：音频与文本不出设备、不写磁盘；敏感编辑器（密码框）原生拒绝
  启动语音；录音浮层状态色与脉冲动画不携带任何内容。

## 13. 主题与首帧

- WebView 的 `prefers-color-scheme` 在部分 OEM 上不随系统翻转：原生在
  hello 下发 `theme`（读 `uiMode`），旋转/日夜切换时重推；JS auto 档
  据此显式落 `theme-dark`/`theme-light`；用户显式偏好永远优先。
- 首帧不猜主题：hello 未到时 `<html>` 不挂主题 class（CSS 媒体查询
  兜底）；每次 hello 把系统主题回写 `localStorage['feelime_system_theme']`，
  WebView 重建后的首帧直接用持久值，深色系统不闪浅色。
- 主题机制细节与完整 token 表见 [appearance.md](appearance.md)。

## 14. 横屏、键盘高度与安全区

- **高度口径**：全部高度值使用**键盘内容高度**（`#softKeyboard` 的
  内容高，不含底部安全区）；实际视图高度 = 内容高 + `safeBottom`。前端
  行高从视图总高扣一次 `safeBottom`，CSS 底部 padding 同步留出。
- **clamp**：竖屏 [210, 45%×app 屏高]，横屏 [170, 50%×真实屏高]
  （`realHeightPixels`，不是 app 空间高度）；`heightFloor/heightCeil/
  heightDefault` 由 hello 下发（与 `setKeyboardHeight` 同一公式），
  高度卡拖条范围只消费 hello 值（WebView 自身 innerHeight 随键盘浮动，
  不能作为范围）。
- **横屏**：与竖屏统一四行（无三行折叠）；键盘高度上限可达真实屏一半；
  小高度下主键行按实际剩余高度等分（不用 32px 下限撑进安全区）。
- **原生视图**（FixedHeightInputView）：高度只从稳定量推导
  （displayMetrics + orientation + prefs override），**不吃窗口瞬时
  measure spec**——弹窗/旋转动画期间的过渡 spec 会把错误高度烤死；横屏
  预算加 `lastSafeBottom`；扩展带按 `min(200dp, 30%×真实屏)` 收缩。
- **safe area**：decorView `OnApplyWindowInsetsListener` 监听导航条
  inset（变化即重推 hello）；系统报 0 且横屏时取平台
  `navigation_bar_height` 兜底（上限 32dp，手势条是细条；竖屏不兜）。
  旋转时 `onConfigurationChanged` → 重推 hello。
- **拖动**：JS 拖动 rAF 节流（每帧一次 native 调用），native prefs
  写入 300ms debounce；高度未变不 requestLayout；松手/加减应用后高度卡
  随键盘上沿重新定位；拖动中预览数值；「恢复默认」只设待保存值不改实际
  高度；「保存」才落盘并清除当前方向偏好；取消还原。
- **高度卡**：贴键盘上沿的浮卡（不覆盖按键），capped 态（ceil ≤ min+2）
  显示「已达上限」、拖条置灰、按钮禁用、显示真实高度不抬到 min；触摸经
  `setOverlayOpen` 放行（§2.5）。
- 键盘元素完成尺寸变化后**重算行高**，不依赖后续弹层触发；安全区只计入
  一次。

## 15. 定制键盘（符号键定制）

- 存储：native `CustomKeysStore`（`feelime_custom_keys`：json + enabled）
  为单一事实源；键盘经桥 `customKeys()`/`setCustomKeys()` 镜像；hello
  时 **native 胜出**且采纳前过键盘校验器（坏表不采纳，键盘永不因坏
  JSON 变砖）；「enabled=false」返回哨兵 `"disabled"`，hello 据此清除
  本地镜像（否则旧镜像继续生效，开关形同虚设）；native 为空而本地有表
  （旧版升级）时 hello 上行一次，防下一次同步覆盖丢表。
- Schema（v1）：

```json
{"version": 1, "rows": [
  [{"t": "√", "tap": "√", "note": "根号"},
   {"t": "Esc", "tap": "[esc]"},
   {"t": "整理", "tap": "[esc]ggVGD", "note": "Vim 全文缩进"}],
  [], []]}
```

  - `t` 键面（必填，≤12 字符）；`tap` 必填（≤128 字符）；`note` 可选
    （长按提示，≤60 字符）。
  - `tap` DSL：括号外是原文 commitText；`[name]` 单键（esc/tab/enter/
    space/bs/del/方向/home/end/pgup/pgdn/f1..f12）；`[mod+…+key]` 组合
    （ctrl/alt/shift/win）。大小写不敏感；未知记号保存时报错并指出位置；
    未闭合 `[` 报错不提交。
  - 上限：行 ≤3、键总数 ≤100（超限报错不截断）。
- 渲染：符号层「定制」分类 = 三行横向滚动条带（键宽随内容、上限 96px），
  右侧固定竖向 ⌫ 列；编辑在完整设置页 JSON 编辑器（textarea + 插入
  模板 + 保存即校验）。

## 16. 版本与发布

- **版本双 bump**：发版必须同时改 `app/build.gradle.kts`（versionCode/
  versionName）与键盘版本（keyboard.js `KEYBOARD_VERSION` +
  `app/src/main/assets/keyboard/VERSION`，两处一致）——built-in 副本
  按 VERSION 判断重播种，只 bump JS 常量会留旧副本。
- **发版必留源码快照**：发布任何版本前，对应源码已 commit 并打 tag
  （`v<versionName>`）；发布产物从该 tag 构建，装机冒烟（对将发布的
  APK 本身，含覆盖安装与首启路径）通过才算发布完成。
- 渠道：`direct`（APK 安装/内网更新可用）与 `play`（禁 APK 安装路径、
  禁 HTTP、更新走商店）双 flavor 同源构建；Play 用 AAB + install-time
  模型 asset pack。
- 模型二进制不入库：`scripts/setup-assets.sh` 从官方源下载并按
  SHA-256 校验（含 thin 包运行时下载的同一清单）。
- 发布前：敏感信息扫描（无内网主机名/IP/绝对路径/私有项目引用）、
  `third_party/` 许可证闭包、发布页与产物 SHA 同步。

## 17. 外观变更流程（demo-first，强制）

1. 外观方案直接实现到真实键盘源码，用 `tools/keyboard-preview.html`
   预览（fetch 真实键盘文件 + 空操作桥 + 假引擎，键盘行为与真机同源）；
   `python3 -m http.server` 仓库根后打开 `/tools/keyboard-preview.html`，
   或 `./tools/deploy-preview.sh` 部署到静态服务器。
2. 预览覆盖竖屏/横屏、亮/暗主题、组合态/面板/控制层；验收清单在预览页
   内逐项勾选。
3. 外观确认后才进入功能收尾（套件、设备回归、发布）；视觉验收看截图
   墨迹/对齐，不以 DOM 断言或 flex 居中算完成。
