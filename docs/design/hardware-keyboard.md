# 硬件键盘支持（物理键盘拼音输入）

状态：实现中（代码评审 9 P1 + 4 P2 全修——归属表延续/pending 行序/
DIRECT 缓存交付/toggle 余队转新门闩/标点水位/seq 起点同步/上报时序/
面板高度态/Enter tag 快照/Shift UP 放行。评审档 ~/tmp/codex/ 下七份：
六轮设计 + 20261025-0043 代码 review）。

## 0. 目标

硬键盘打拼音：组合流跟随、候选可选词、软键盘让位纯候选条；Ctrl+空格 /
Shift 单按 = 快捷配对切换（quickPair 翻转，与软中英键单击同语义）。

## 1. 核心架构

```
native onKeyDown（同步路由，见 §2 决策表）
  ├─ 修饰组合 → 放行（Ctrl+空格 例外）
  ├─ DIRECT 模式的文本键 → 放行（原事件零接触，无 evaluate 往返）
  ├─ 切换在途（pendingModeSwitch）→ 认领并缓存，切换完成后按新态路由
  ├─ 支持模式(§2)的可打印/控制键 → 认领 + evaluate hwKey(requestId, …)
  └─ 其余 → super.onKeyDown
JS hwKey（单线程串行队列，§4）
  ├─ char: hwChar(cp)——字符语义分派
  ├─ space/enter/backspace: spaceAction()/enterAction()/backspaceAction()
  └─ 防御分支（不该处理的键）→ 忽略 + 诊断打点（不吐回，见 §8-R1）
native 桥执行处终检：requestId 单调 + inputGeneration 匹配（§5）
```

## 2. 按键决策表（onKeyDown，按序首个命中即止）

前置：
- `keyCombo`：`metaState & (CTRL|ALT|META)` 任一位非零（位含左右）。
- `isPrintable`：`unicodeChar != 0` 且非控制字符（<0x20、0x7F）且无
  dead-key 标志（`KeyCharacterMap.COMBINING_ACCENT`）；SPACE/ENTER
  不算（走控制键行）。
- `hwJsReady`：`pageReady && jsHwKeys`（§6 上报协议）。
- `charModes`（native 接管文本键的模式）：PINYIN、DOUBLE_PINYIN、
  FLYPY、FRENCH、RUSSIAN、JAPANESE。`ctrlModes`（只接控制键
  DEL/SPACE/ENTER 的模式）：charModes + T9 + STROKE。
  DIRECT / HANDWRITING 完全旁路（DIRECT=IME 不碰文本；手写候选由
  软键盘确认，物理回车/退格放行）。
- LOADING（pendingEngine）视同支持模式：hwKey→Native.key→
  coordinator warmup 排队（与软键盘同机制不拆词）；ERROR 已
  degrade→DIRECT→旁路。

| # | 条件 | 动作 | onKeyDown 返回 |
|---|---|---|---|
| 1 | Ctrl+空格（CTRL 任一位、无 ALT/META/SHIFT、repeatCount==0、无 pendingModeSwitch） | hwJsReady ? 认领+evaluate quickPairToggle+置 pendingModeSwitch : 认领（吞键，§8-R3） | true（整次按压） |
| 1.5 | `pendingModeSwitch` 且命中精确 Ctrl+空格（同行 1 修饰条件） | 认领+缓存为 toggle 动作（§3） | true |
| 2 | `keyCombo`（其他一切修饰组合） | 放行 | false |
| 3 | `pendingModeSwitch` 且键为文本/控制键（可打印或 DEL/SPACE/ENTER；方向键/F/TAB/修饰键不缓存，落原表） | 认领+入缓存队列 | true |
| 4 | DEL/SPACE/ENTER（无 Ctrl/Alt/Meta；SHIFT 允许）且 `currentMode ∈ ctrlModes` 且 hwJsReady | 认领+evaluate hwKey(kind) | true |
| 5 | `isPrintable` 且 `currentMode ∈ charModes` 且 hwJsReady | 认领+evaluate hwKey('char', cp) | true |
| 6 | 其余（方向键/F/TAB/系统键/不支持模式/未 ready） | `super.onKeyDown` | super |

- 行 4/5 的 mode 门闸是**有意保留**（DIRECT 原事件旁路承诺），其引入
  的「切换后首键」窗口由行 3 的切换在途队列封闭（§3）。
- 未 ready（含热更重载/握手窗口/旧页降级）：文本键放行成英文直通
  ——与 DIRECT 旁路同语义，无双路径。冷启动丢给宿主的键不重发。
- TAB 放行。`onKeyUp`：按归属表（§5.2）；未匹配 up → `super.onKeyUp`。

### 2.1 Shift 单按（第二切换入口）

按设备 pressed 键集合（deviceId→keyCodes）。Shift down：repeat==0、
集合空（无任何键含修饰键按住）且无同次另一 Shift → 武装（deviceId+
downTime+600ms）。任何键 down / CANCEL / 超窗解除。up 命中 → 同行 1
（含 pendingModeSwitch 语义）。Shift down/up 不消费。同次按压的后半
段 up 不得重武装（downTime 绑定）。

## 3. 切换在途队列（pendingModeSwitch，五审 B1 终案）

- **行序修正**：决策表行 1 与行 2 之间加行 1.5——`pendingModeSwitch`
  且命中精确 Ctrl+空格（同行 1 修饰条件）→ **缓存为 toggle 动作**
  （不作为普通 Space 处理）。Shift 单按触发的第二次 toggle 同入。
- **完成条件**（释放门闩 + 重路由缓存）：native 的 state listener 看到
  `coordinator.currentMode == pendingTargetMode` 且该次 state 载荷的
  mode 字段已随推送到达 JS（onEngineState 载荷自带 mode，JS 就靠它
  更新 this.mode）——即「实际应用 + JS 已对齐」双条件。
  strictReady 拒绝/无操作路径无 mode 事件，由 200ms 超时收尾。
- **超时降级**（六审收窄）：200ms 未收到完成信号**不能证明切换未生效**
  （目标 mode 可能已应用只是状态未达 JS，也可能仍在队列）。缓存键仍走
  同一有序入口（evaluate hwKey），实际执行模式可能已变，记诊断——不
  承诺「按旧模式处理是正确语义」。迟到 selectMode 不得清除新一轮门闩
  （门闩带代数号 hwSwitchEpoch，清除时校验；旧 Mode 不会被取消）。
- **缓存交付统一入口**：重路由的缓存键（含 DIRECT 的文本键）**全部
  evaluate hwKey**——DIRECT 文本走 JS hwChar→Native.key→
  DirectTextEngine→commitText（软键盘 DIRECT 字母同通道），native
  不做第二执行端（coordinator.key 直调删除），缓存内顺序 =
  evaluate 注入序 ✓。重路由按「键类别×目标模式」：文本键交付
  charModes + DIRECT 目标（代码评审 P1-4 落地：DIRECT 下的
  space/enter/backspace 同样经 JS action 交付——直发空格/换行/删键，
  不丢已认领键）；T9/STROKE/HANDWRITING 目标下文本键无落点，
  忽略+诊断——quickPair 目标极少为这些模式的字符输入场景）。
- **缓存内 toggle 的余队**（代码评审 P1-5）：settle 遇 toggle 开启新
  切换后**停止本轮交付**，余下队列整体转入新 pending 的缓存（超限
  丢最旧），由新门闩的 settle/超时再交付——连续 toggle 不折叠、后续
  键不按旧 mode 执行。
- 缓存上限 8 键（超限丢最旧+诊断）。

## 4. JS 侧

### 4.1 hwKey 串行队列（命令完成水位，六审 B2 终案）

- **JS 自产单调 seq**（hwSeqCounter++），随 hw 桥调用传入：
  `hwKeyChar(char, seq, token)` / `hwSpace(seq, token)` /
  `hwEnter(seq, token)` / `hwBackspace(seq, token)` /
  `hwChoose(seq, revision, id, token)`——两端同一计数域（六审定罪
  「各计各的数」会被软键/分页领先量伪解除）。
- **native 绑定**：coordinator 的 `hwTag(seq) { … }` 把 seq 捕获进该次
  dispatch 的 emit 事件闭包；事件**应用点**（补交/状态结算完成、
  listener 推送前）推进 `hwDoneSeq = max(hwDoneSeq, tag)`。
- state 载荷带 `hwDoneSeq`。JS 屏障：`payload.hwDoneSeq >=
  hwWaitSeq`（本会话最后一个 hw 命令的结果已应用）。
- 软键盘/自动分页无 tag 不推进水位——不伪解除 ✓；无在途 hw 命令
  （hwDoneSeq 已 >= hwWaitSeq）立即执行 ✓。
- **排队路径边界**：pendingEngine/replaying 入队时 tag 丢失（回放命令
  的 dispatch 不在 hwTag 块内）——LOADING 过渡态屏障靠 120ms 超时
  降级（诊断打点），记为已知边界。
- 字母：只等 `pendingPunct == null`（跨步屏障）；字母间不等
  （coordinator 队列保序）。中文 `,`/`.`（chineseSymMode）虽是 char，
  但 enginePunct 读组合/池——**同样等水位**（代码评审 P1-6：不等会
  拿旧池确认、或在前一字母回声前误走空闲通道）；其 seq 只在两步流
  真正走 hwChoose 时成为等待目标（空闲 sendText 无回声，预设会让
  下一键白等 120ms）。
- **会话代数 gen**（代码评审 P1-1 落地 §5.1）：hwKey 注入携带
  hwInputGeneration，队列 job 与全部 hw 桥调用（hwKeyChar/hwSpace/
  hwEnter/hwBackspace/hwChoose）贯穿；drain 时旧 gen 丢弃、native
  桥执行处终检丢弃；两步标点的第二步 pendingPunct 记 gen，跨会话
  作废。残余：hw 路径撞上 dyn:/fav: 候选时走 clearComposing+
  commitText（软键盘同通道，无 gen）——跨编辑器窗口为一帧内的
  drain 检查与桥执行间隙，接受。
- **页面代数**（代码评审 P1-7）：hello 载荷带 hwGen + hwSeqBase
  （native 当前 hwDoneSeq）——新页 gen 基准与 seq 起点同步，旧水位
  不伪解除。
- 两步标点：`pendingPunct` 非空期间**所有**动作（含字母、含超时路径）
  挂起；清除=补发 commitText 已按序进入 coordinator。
- 120ms 超时：仅用于水位等待与 pendingPunct 之外的异常兜底，按当时
  状态执行+诊断。

### 4.2 hwChar(cp)——物理字符分派

`String.fromCodePoint` 后按下表（模式判断取 JS 实时 mode，非 native
快照）：

| 字符 | 分派 |
|---|---|
| `,` `.` | `chineseSymMode()` 且组合中：enginePunct（中文全角两步修复，**限定中文**——法/俄/日走 Native.key 由各引擎/Hunspell 词标点处理）；否则 `Native.key` |
| 其余全部（字母含物理 case、`;` `'` 编码/分隔键、数字、符号、非 ASCII） | `Native.key(cp)`——不走 applyCase/软 Shift/Caps/sticky（物理事件自带形态） |

### 4.3 action 提取（软硬共用）

spaceAction/enterAction 从 spaceKey/enterKey 的 click 回调无损提取
（按钮与 hwKey 共用；软键盘既有 mock 全量回归=行为不变的证明）；
backspaceAction 已存在直呼。

### 4.4 数字键（首版边界）

组合中数字 = `Native.key`（rime selector 当前页语义）。**不做**候选
池可见编号映射（英文重排/dyn 候选插入会错位；luna page_size=5 的
1-5 有选择语义）。组合空数字进引擎=rime 标点/数字处理（空组合下
rime 未处理的键由 consumed 透传→§5.3 防御）。

### 4.5 window.Feelime 新导出

`hwKey(kind, value, requestId)`、`quickPairToggle(requestId)`；
ready/token 门闸走 `call()`；requestId 附在后续一切桥调用上。

## 5. native 侧

### 5.1 requestId 与 generation

- 硬键请求 id 单调递增；每个 hwKey 产生的**全部**桥调用（含
  enginePunct 延迟第二步 commitText、choosePoolCandidate 内部的
  clearComposing+commitText）都带 requestId。
- 桥 handler 在主线程执行处终检：requestId ≥ 当前会话最小有效值
  且 inputGeneration 匹配（onStartInput 递增的**独立计数器**
  hwInputGeneration——不复用 onFinishInputView 也递增的
  inputConnectionGeneration，避免干扰退格手势/语音等既有使用方）。
  失配丢弃+诊断。
- `onFinishInput`/`onUnbindInput` 令 hwInputGeneration 失效（无新
  onStartInput 也作废旧请求）。JS 本地延迟续步（pendingPunct 等）
  同样按 requestId 丢弃旧上下文。

### 5.2 按压归属表

首次 down 定归属并记**决策类别**（放行/char/space/enter/backspace/
toggle/consumed——代码评审 P1-2：值类别化，repeat 按首次类别执行，
meta/ready/mode 中途变化不换语义），记 (deviceId, keyCode, downTime)；
repeat down 与 up 同归属；up 清表；未匹配 up → super.onKeyUp（父类
Back 收起保留）。清理点：onStartInput / onFinishInput / onDestroy /
ACTION_CANCEL。`InputDevice` 移除（ACTION_CANCEL 之外的强制清理：
`InputDevice.getId()` 失效场景记入验收）。

### 5.3 consumed 透传 + coordinator 原子补交（五审 B3 终案）

`RimeTextEngine.rimeProcessKey` Boolean 返回值透传 stateEvent 的
consumed 字段（已实现）。

**未处理字符的交付在 coordinator 内原子完成**（五审二选一中的
coordinator 方案——JS 补发有乱序窗口：`1→a` 场景 a 先组合、晚到的
补发 pasteExternal 会把 a 以 raw 提前落地）：

- `EngineCommand.Key` 增来源标记 `hw: Boolean = false`；native 新增
  `Native.hwKeyChar(char, token)` 桥（hwRun 调它而非 Native.key；
  旧壳无此方法——JS 存在性检查回退 Native.key，但旧壳本就不注入
  hwKey，此路径不触发）。
- coordinator 事件处理（listener 路径）：`!event.consumed &&
  event.code == OK && lastCommand is Key && lastCommand.hw` →
  编辑器**直接追加** `String.toChars(lastCommand.unicodeScalar)`
  （不走 pasteExternal 的 composingRaw 提交），在事件循环内同步
  执行，天然先于下一条命令。前组合若已被 DirectCommit 提交，其
  commit 已在本事件落地，追加的 cp 排其后，顺序正确。
- 软键盘路径 hw=false：**行为零变化**（软键盘不触发补交——它有
  sendSymbol/commitText 等自己的字面通道）。
- 恰好一次由 consumed 语义保证：consumed=true 引擎已消化；false
  时引擎零消化当前 cp，coordinator 恰好追加一次。
- JS 侧 hwLiteralFallback 删除（不需要 JS 补发）。

### 5.4 状态对齐

`keyboardReady`（pageReady 置位）重推缓存的最后一次 onEngineState
载荷（无副作用，不重放 commit；代码评审 P1-8 落地：lastStatePayload
缓存 + 握手重推）。JS 收到首个 state 推送后上报 `reportHwKeys`
（§6），保证接管时池非空；重握手（同页 hello 重推）时本页 state
活着，立即补报。冷启动宽限（AVD 实测定罪补丁）：direct 模式冷启动
零引擎事件——首 state 永不到达会死锁上报（Ctrl+空格恒 notReady），
ready 后 300ms 无 state 则补报（从未有过状态=无旧池可 stale）。

## 6. 能力上报协议（双向可选，不动现有 capabilities）

- 现有 REQUIRED_CAPABILITIES（JS 要求 native）方向不变、列表不加项
  （避免旧壳拒绝整页）。
- 新增**独立可选桥** `Native.reportHwKeys(version, token)`：新 JS 在
  基础握手成功 + onEngineState 至少到达一次后调用；native 记
  `jsHwKeys=true`（token 校验，重复 hello 不复位）。旧壳无此桥→JS
  存在性检查跳过→native 永不接管（=无硬键功能，软键盘不受影响，
  但行 1 Ctrl+空格仍被吞：§8-R3）。
- 热更重载：pageReady=false 时 native 侧 jsHwKeys 复位 false，
  新页重新上报。

## 7. UI 形态（阶段 2）与设置

（v3 §5 保留）hello 增 `hardwareKeyboard`（hardKeyboardHidden==NO
且 keyboard!=NOKEYS）；`body.hwkb` = hardwareKeyboard && 档位==
candidates && mode∈charModes（onEngineState 路径重评估）；原生候选
高度（preedit band + 40px bar，safeBottom/bottomPad 只在
contentHeightPx 统一出口叠一次——代码评审 P2-12；hwkb CSS 清零 bar
margin 2+10px）与用户保存高度分离不持久化；面板临时高度走新薄桥
`hwPanelHeight(state, token)`（代码评审 P1-9 落地）——**candidates/
ctrl/full 三态**（面板/展开/语音遮罩=full，控制层=ctrl=候选条预算+
行高差，其余回落 candidates），JS 在面板开合/控制层/语音/展开/hello
重算点上报，native 仅在 hwkb 形态分支消费；候选条形态下
ctrlLayer/voiceOverlay 不进 CSS 隐藏列（自管 [hidden]/.open），
candidateBar 不写 display:flex（会盖 [hidden] 让位）。设置三档
`feelime_hwkb_form`（candidates 默认/full/follow），SettingsBridge
逐方法校验，变更补 `updateInputViewShown()`；
onEvaluateInputViewShown：candidates/full→true，follow→super。

## 8. 明确拒绝的过度工程（带理由）

- **R1 不做吐回/replayKey**：sendDownUpKeyEvents 合成事件不保原
  meta/repeat/deviceId/scanCode，InputConnection.sendKeyEvent 重发
  也非原事件等价（异步+聚焦可能已变）。DIRECT 由 native 门闸旁路
  （原事件零接触）后，吐回只剩「防御分支」用途——丢一键+诊断优于
  乱序重发。
- **R2 不做请求终态协议**（pending/received/executed/cancelled 四态
  + 重载前排空 + 去重恢复）：热更重载窗口（下载完成瞬间）丢已认领
  键，低频+可诊断+用户重按即可。协议复杂度与收益不成比例。
- **R3 旧页/未 ready 下 Ctrl+空格仍吞键**：若放行则宿主收到我们的
  快捷键语义分裂（有时 IME 吃有时 app 吃），行为不可预测。统一吞
  （无功能但一致），诊断可查。
- **R4 不宣称零竞态**：hwDoneSeq 水位（§4.1）覆盖本会话 hw 命令的
  因果顺序；残余窗口（超时降级、LOADING 排队 tag 丢失、跨页/热更）
  记录在案，不为此引入跨层请求-确认协议。
- 数字池 id 映射、按住键实时吐回、IME 激活前预测：均超出首版价值。

## 9. 验证计划

**mock**：hwChar 分派全行（`,`/`.`×中文/法俄×组合中/空闲、物理 case、
`;`、数字、非 ASCII）；spaceAction/enterAction 提取后软键盘空格/回车
既有用例全量回归；hwKey 串行队列（pendingEchoes 屏障+120ms 超时）；
consumed=false 防御分支；requestId/generation 终检（旧请求丢弃、
enginePunct 第二步带 id）；quickPairToggle 直呼 toggleChineseEnglish
（手写迁移 pair/degrade 重试/strictReady 拦截三态）；切换在途队列
（缓存重路由/200ms 超时/上限 8）；reportHwKeys 时序（首个 state 后）；
hwkb body class rect 级断言；档位设置合法值/非法回默认。

**AVD**（input keyevent=硬键通道）：字符矩阵（空组合+组合中的
`, . ; '`、数字、大小写、四双拼+FLYPY、法/俄/日、非 ASCII）；顺序
（DIRECT→Ctrl+空格→立即首字进拼音组合；拼音→切换→立即空格；快打
字母+空格选词不选旧池；两次切换连发；LOADING 整词+控制键）；按压
（首 down/repeat/up 同归属；Ctrl+空格长按只切一次；先松 Ctrl 后松
Space 不吐字；已按住键再 Shift 不触发；双 Shift；CANCEL；>20/s 退格
——25/s 限流边界）；显示（三档+updateInputViewShown；系统硬键盘
显示开关×follow；候选高度/insets/触摸区；面板临时高度枚举切换；
完整高度保存值不漂移；深浅×横竖截图+预览部署 share）；生命周期
（冷启动首键直通；只输首字等 ready 池可见；A→B 切编辑器作废；
外部 ime set；热更重载丢键=已接受边界+诊断；A-CANCEL 清理）。
宿主矩阵：单/多行、SEND/SEARCH、TYPE_NULL 终端、xterm textarea、
RDP。ace：input keyevent+蓝牙键盘（若有）。

**每项都断言最终效果**（编辑器内容/候选 id/原事件归属），非调用
同函数。

## 10. 已知限制（文档化）

- 热更重载/握手窗口已认领键丢失（R2）；旧页 Ctrl+空格被吞（R3）。
- 理论竞态窗口与软键盘同宽（R4）。
- 数字选词=rime 当前页语义，与显示编号在英文重排场景可能错位。
- follow 档冷启动：快捷切换与硬键中文均不可用（IME 有意隐藏）。
- Ctrl+空格被 IME 消费（Emacs set-mark 受影响，有反馈再评估）。
- 物理 repeat >25/s 退格受既有桥限流（典型系统 repeat 20/s 内）。
- RDP 文本注入 vs 扫描码差异（DIRECT 旁路保留原生物理语义）。
- hw 路径 dyn:/fav: 候选的 clearComposing+commitText 无 gen（软键盘
  同通道，一帧内窗口）；hello 期 applyHwForm 的面板高度基线上报撞
  call() ready 门闸被丢（native 默认值即 candidates，无功能差）。
- modeMenu/stats/edit 视图在候选条形态下不可达（触发器在隐藏键区），
  面板高度态按不可达处理；插拔瞬间高度态由 hello 重推收敛（一帧）。
