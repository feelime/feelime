# 引擎降级统一化与自愈 + 底部留白/手感微调/剪贴板残留（1.0.6 批次方案 v3）

2026-09-11 第三批。v1 被 codex round-1 否决核心根因推断；v2 采纳统一降级
方向后，round-2 评审要求补齐状态生命周期、重建串行顺序、高度协议与剪贴板
边界。v3 即逐项补齐（文末附 round-2 清单对照）。行号基于 bf892e1。

现场反馈：① 用户实拍（微信，1.0.5/3.29.0）：quick-pair 切双拼后打字全部
字面直出、无候选，回车整串上屏，杀宿主 APP 才恢复；② 中英切换后键位标签
不变、中文无输入预览、回车吐字母、切 APP 不恢复、偶发 IME 崩溃被系统切走。

## 1. 根因现状（按 round-2 校正措辞）

**已证实**：存在静默降级——五类触发最终都落到 Direct 字面直出，全程无
错误/降级通知（普通事件仍会发出，工厂异常分支的普通事件还错误地标着目标
模式）。**待确认**：现场具体触发路径（本批补诊断日志回收归因；不宣称与
视频「完全一致」——Direct 逐键 commit，解释不了「回车才整串上屏」的
细节，那条还需结合 Rime 原始串提交路径）。

五类触发（均存在，现状互不一致）：

| 触发 | 位置 | 现状 |
|---|---|---|
| warmup 超时 | TextInputCoordinator.kt:709（5s，含后台排队时间） | fallbackFromWarmup，无降级通知 |
| 队列溢出 | :533（仅 pending 分支；Mode/Accept/Literal/undo-addFirst 四个写入口无容量检查） | 同上 |
| 工厂抛异常 | :685-690（不置 engineMatchesMode、mode 保持目标模式、LOADED/READY 普通事件带目标模式） | 完全静默 |
| init 失败 | :891（pending 分支处理全部 ERROR；:732 异步 Start 拒绝合成为 init ERROR；:696 同步 Start 拒绝直接 fallback） | listener(ERROR) 后 fallback |
| runtime 失败 | :809-819 | 同上 |

另两个经探针证实的实现洞：
1. **warmup 中 recreateEngineSession 死链**（:242-276）：liveEngine 是未
   Start 的 interim Direct，Close 被 STALE_STAMP 拒绝且不回调 →
   closePendingThenSwap 永不执行（探针 `swapApplied=false closed=true
   nextKey=Rejected(STALE_STAMP)`）；closePendingThenSwap 在后台读写
   pending 字段（主线程约定违例）。
2. **runtime fallback 直接覆盖 engine 不关旧 live 引擎**（:758）。

## 2. 引擎降级统一化

### 2.1 状态与通知契约

- coordinator 新增持久状态：`degraded: DegradeState?`，其中
  `DegradeState(failedMode, reason, seq)`；`seq` 单调递增，**每次降级
  转换 seq+1**（通知按转换计，不用布尔升沿——重试再失败仍有新通知）。
- 通知：转换完成时发一个引擎事件级 payload：`{degraded: true, seq,
  failedMode, reason}`；恢复时 `{degraded: false, seq, failedMode,
  reason}`。**hello 携带同构字段 + `warming`**（WebView 重建后角标/占位
  可恢复；hello 不触发 toast，只恢复持续状态）。
- 降级转换 `degradeToDirect(failedMode, reason)` 统一顺序：
  1) 捕获并处置旧 live/pending 引擎（Close best-effort；runtime 失败的
     live 引擎也关闭——修 :758 的直接覆盖）；
  2) 失效旧回调身份（stamp/generation 前移）；
  3) `mode=DIRECT`、`engineMatchesMode=false`、新 session、启动 Direct；
  4) degraded 置位、seq+1、发通知事件；
  5) 重放队列（重放进 Direct；queued Mode 保留语义）。
  纳入入口：五类触发 + 同步/异步 Start 拒绝（:696/:732）。
- 日志：reason/failedMode/schema/耗时/queueLen/session 代次；不记输入
  正文。

### 2.2 状态转换表（清除与保留）

| 事件 | degraded 结果 |
|---|---|
| 任一降级触发 | 置新 DegradeState（seq+1，即使重试再失败也通知） |
| **fallback Direct 自己的 READY** | **不清除**（它就是降级本体） |
| 用户重试 selectMode(failedMode) | 保留（重试中），失败按新 seq 再通知；真引擎 READY 落地（onPendingEvent READY）→ 清除 |
| 编辑器重绑 startEngine(savedUserMode) | 清除（新 warmup 开始；落地 READY 或再次降级走上行） |
| 主动选择 Direct（菜单/切换） | 清除（这是用户要的 Direct，不是降级） |
| enterPasswordField | 清除并屏蔽（密码栏只允许 Direct；不得残留旧 failedMode 的「点模式键重试」提示） |
| recreateEngineSession / 语音结束的 startEngine | 与重绑同规则（重试中保留，落地/再失败按上两行） |
| live CLOSED（主动关闭） | 保留与否跟随后续 startEngine（不单独当恢复）；意外 CLOSED 视为一次 RUNTIME_FAILED 降级，不当恢复 |
| pending CLOSED | 维持现状（忽略），由超时/错误路径收口 |

### 2.3 降级态 UI 与重试

- 键盘在 `variantReplaying` 提前 return **之前**消费 degraded 事件
  （keyboard.js:5044 前置），失败时终止相应 UI 重放，防吞更新。
- 持续状态（角标 + LOADING 占位）从事件/hello 状态渲染；toast 在收到
  `degraded:true` 且 seq > 已见 seq 时弹一次（hello 恢复不弹）。
- 降级态下模式键短按 → `Native.selectMode(failedMode)`（不按 pair
  轮换）。与 selectMode 分支交互：降级后 mode=DIRECT，failedMode 为中文
  模式不会命中 ALREADY_ACTIVE（:202 需 engineMatchesMode=true）；warmup
  中重复短按入队（:211），成功后多余请求由 ALREADY_ACTIVE 消化、失败由
  队列重放继续重试；密码栏 BLOCKED（:208）时键盘不得显示重试提示
  （角标/提示随密码栏清除规则隐藏）。

### 2.4 recreateEngineSession 串行化（修死链）

全部在主线程做身份捕获与摘除，后台只做捕获对象的 IO：

1. 主线程：捕获 live/pending 引擎与 stamp（含「interim Direct 未启动」
   生命周期标记）；**原子摘除 pendingEngine/pendingStamp**（此后超时/
   READY 的身份检查必然失配，不再能插入转换）；
2. 后台：按捕获顺序 Close 旧引擎（未启动的 interim Direct 无需 Close，
   跳过而非依赖错误码；Close 回调 ERROR → 放弃 swap，reason=
   DATA_SWAP_FAILED，主线程直接 beginSession 在原目录重启引擎）；
3. 后台：目录 rename（swap）；
4. 回主线程：校验重建操作身份（专用 recreateGeneration；新编辑器已重建则
   丢弃本次 beginSession——swap 已发生只能如实记录日志）；beginSession
   （newSession + startEngine(target)）。
重复 recreate / 与新编辑器交错由 recreateGeneration + 编辑器代次双重
判定；Close 拒绝不再作为续接条件（拒绝且捕获生命周期=未启动 → 直接走
后续步骤）。

### 2.5 队列与超时

- 单一 `enqueueQueued()` helper 覆盖全部写入口：Mode(:212)、Accept(:301)、
  Literal(:466)、undo 重开 addFirst(:954)；容量检查在入队前；
  MAX_WARMUP_QUEUE 128→256（15s × ~17 键/秒）。
- 溢出处理：pending 期 → degradeToDirect(QUEUE_OVERFLOW)，failedMode 取
  **溢出会话的 pendingStamp.mode**（不是被后续请求覆盖的 savedUserMode）；
  replaying 期（无 pending）→ 溢出的 Accept 立即执行宿主动作、Key/Mode
  丢弃并回 Rejected(ENGINE_BUSY)（键盘按既有拒绝路径静默）。
- 超时 5s→15s：自 warmup 安排时起算、含后台排队（期限是参数不是修复）。

**1.0.12 修复**：`endVoiceSession` / `recreateEngineSession` 的
beginSession 此前用 `mode`（降级后已是 DIRECT）重启引擎——静默续跑英文
直出且清掉角标（§2.2 表早已写明应「与重绑同规则」，实现偏离了表）。
修复后两者在降级态下改用 `degraded?.failedMode` 重试：重试中保留角标，
真引擎 READY 落地清除并发恢复通知，再失败按新 seq 再通知（自愈闭环；
JVM `degradedVoiceEndRetriesTheFailedModeInsteadOfSilentDirect` 钉住）。

### 2.6 诊断采集（设置 → 关于 → 诊断记录）

用户报告「双拼按键字母直接上屏」且用户侧无法取证（issue 链：1.0.6 声称
修复实际没修好）。诊断开关打开后，IME 把降级链路事件收进内存环形缓冲
（`Diagnostics.kt`，400 条、单条 ≤220 字符、只进内存不落盘不进备份），
设置页「复制诊断信息」一键导出（剪贴板标记敏感）。采集点全部不含文本
内容：editorStart/editor（包名、inputType hex、imeOptions hex）、
startEngine（目标 + degradedBefore）、engineReady（warmupMs）、degrade
（failedMode/reason/seq/queue）、replayQueue（降级直出重放计数）、
clearDegrade（reason）、endVoiceSession、recreateBegin、selectMode。
其中 `startEngine target=direct degradedBefore=…` 一行即「隐式恢复静默
清徽标」的直接证据（§1 根因 B）。coordinator 保持 JVM 无 android 依赖，
经构造参数 `diagnosticSink` 注入。

### 2.7 不做

rime 预热（round-2 B2.6 风险清单）→ backlog；自动循环重试 → 不做。

## 3. 底部留白高度设置

- 语义：键盘总高 = **内容高（受既有上下限约束）+ pad + 系统导航 inset**；
  pad ∈ {0,12,24,36,48}dp，默认 0=现状；用户拖拽/保存的高度值仍是内容
  单位，**原生保存协议不变**（heightCssPx==0 删除覆盖值的语义保留，
  FeelimeService.kt:1721）。
- **oplus 手势机的 inset 地板（issue #5）**：ColorOS/OxygenOS/realme 把
  「收起键盘/切换输入法」把手画在键盘窗口之上，而系统只报手势小条的
  高度（ace 实测 reserve 16px，把手却画到屏幕底 ~24dp 处、压住末行按键）。
  判定用公共字段 `Build.BRAND ∈ {oppo, oneplus, realme}`；手势导航读
  `Settings.Secure.navigation_mode==2`（进程内各解析一次）。命中时
  API30+ 的 WindowMetrics 读取（`navBottomInset` 主路径）与 API≤29 的
  `effectiveBottomInset` 兜底都把底部 reserve 抬到
  `max(系统值, 24dp)`（24dp = 把手可见带 ~18dp + 点击余量，按 ace 逐像素
  量得）。**教训：第一版只改了 `effectiveBottomInset`，而 API30+ 设备
  （如 ace/Android 15）走 WindowMetrics 分支根本不经过它，改造在真机上
  静默无效**——两条路径必须一起盖。非 oplus ROM 维持「上报为 0 时横屏
  才按 navigation_bar_height 兜底」的旧行为。
- **方向独立（issue #5 追加）**：pref 拆成 `bottom_pad_dp_portrait` /
  `bottom_pad_dp_landscape` 两键，设置页两条档位；旧单键 `bottom_pad_dp`
  保留作迁移默认源（新键缺省回落旧值，改任一方向后分叉）。IME hello 的
  `bottomPad` 由原生按当前方向取值后下发，键盘 JS 无感知。
- 原生：pref 放 `feelime_keyboard`；
  FixedHeightInputView 测量 = `min(content, contentCeil) + pad +
  navBottomInset()`（横屏 ceil 公式同步，FeelimeService.kt:2263 一处）；
  setter 落 pref + requestLayout + 重推 hello。**原生高度上下限（
  heightFloor/Ceil）保持内容单位不变**——pad 不进 hello 的 floor/ceil，
  避免单位二次换算。
- hello：带 `bottomPad`（dp==CSS px，直接用）；JS 侧：
  - `applyHeight` 两处（:2913/:2920）都减 pad；行高预算 =
    total − safe − pad − chrome；
  - **pad 由 #softKeyboard 单点持有**：`padding-bottom: var(
    --kb-bottom-pad)`（round-2 C5.1：不给 .kb-layer/#symGrid 各加，避免
    嵌套双算与分类栏错位）；panelLayer/settingsPanel 借用键区时同样生效，
    纳入 demo 验收；
  - `applyKbHeight` 上报不变（内容单位）；heightBounds 拖拽边界按内容
    单位不变。
- 备份：UserdataBackup INT_KEYS 登记；**离散集合校验 {0,12,24,36,48}** 覆盖旧单键与方向拆分后的
  portrait/landscape 两键（round-2：仅范围校验会放过 1/13）。
- 设置页「键盘与输入」select 一行（双语）。
- demo-first：真实源码 demo，深浅 × 横竖 × 0/24/48 截图发布确认后进收尾。

## 4. 手感微调设置

三个参数走**专用原生 pref（feelime_keyboard 新 int 键）+ 广播重推
hello**，不用 merged-store 整镜像替换（round-2 C7.1：会删其他键）：

- `feel_scrub_speed`（1-5）：设置页新增；快捷设置不收录该项（行列表时代
  删除该行，3.38.0 方块网格延续不收录）；键盘启动
  采用顺序：hello 值 → 旧 localStorage `feelime_scrub_speed`（迁移兼容，
  不删除旧键，round-2 C7 建议最省改动）→ 默认 3。
- `feel_hold_ms`（200/300/350/450/600，默认 350）：替换 bindTouch 四处
  350（popup/lock/mode-menu/**numpad**，round-2 补第四处）；repeat 间隔
  = hold + 40。空格语音长按与 Ctrl 组合格长按**保持固定**（作用范围在
  设置文案注明）。
- `feel_popup_snap`（0/1/2 = 松/标准/紧）：映射 POPUP_CELL_REACH 取消
  半径 ×1.4/×1.0/×0.7（控制有效选择范围；相邻格切换仍是最近中心，不改
  迟滞——设置文案如此描述）。
- 变更链路：设置页写桥接端点 → pref + 广播 → IME 重推 hello → 键盘即时
  应用；首次拉取不删任何本地键。

### 4.1 按键声音/振动反馈（issue #5 问题 2，借鉴 WeType「按键效果」）

- 形态：设置页「键盘手感」两个独立开关（按键声音/按键振动），
  **默认全关**（与 WeType 默认一致）；无音量/强度滑杆（v1 不做，走系统
  通道已获得合理强度，见下）。
- 通道：键盘 JS 在每个按键 `touchstart` 调一次 `FeelimeNative.keyFeedback
  (token)`（走 `call()` 门闸：桥未就绪不发；旧 APK 无此方法时 typeof
  守卫静默跳过）。原生 `ImeBridge.keyFeedback` 按当前偏好分别触发：
  - 振动 = `performHapticFeedback(KEYBOARD_TAP,
    FLAG_IGNORE_GLOBAL_SETTING)`：跟随机型调校；IGNORE 标志让本开关
    成为唯一权威（否则系统触感总开关关闭时「开了没反应」）。
  - 声音 = `AudioManager.playSoundEffect(FX_KEY_CLICK)`：跟随系统音量、
    静音模式不响（WeType 页面同款提示语义）。
  - 偏好 `key_sound_on`/`key_haptic_on`（feelime_keyboard，Boolean，
    默认 false）每次按键时读取，开关即时生效，无需广播重推 hello。
- 边界：反馈只挂在 touchstart——退格长按的 75ms 重复、滑动消歧的
  中途 move 都不追加反馈；候选条/浮层选字不在本范围（WeType 也只对
  按键生效）。
- 备份：`UserdataBackup.BOOL_KEYS` 登记 `feelime_keyboard` 的
  association_on + key_sound_on + key_haptic_on。

## 5. 剪贴板清空后残留修复

根因：clear() 只清历史；编辑器聚焦 captureCurrent()（FeelimeService
:506/:594）把系统剪贴板原文重新录回。修复（ClipboardStore，全部变更
**串行到主 handler**，消除「复制 A 回调排队 → clear → 旧回调入 A」的
时序洞，round-2 C6）：

- **只存指纹不存原文**：SHA-256 前 16 hex 作为抑制标记（敏感 clip 一律
  不产生标记——保持 IS_SENSITIVE 边界，round-2 P1）；
- clear()/remove(id)（后者仅当所删项指纹==当前系统剪贴板指纹）在**清空
  之后**快照当前系统 clip 指纹为标记；collectEnabled 不约束标记维护
  （与历史记录分离）；
- 焦点补录 captureCurrent()：指纹==标记 → 跳过；
- clip-change listener（复制通知）：**两条路径同规**——指纹==标记 →
  跳过且不解除标记（清空后迟到的复制通知与「用户重新复制同文」无法
  区分，按用户诉求同文一律保持清除状态）；指纹 != 标记 → 记录并解除
  抑制（round-3 评审修正：只按路径区分会复活刚清空的条目）；
- 标记持久化（跨进程重启）；单进程（SettingsBridge 已移除设置页剪贴板
  入口，不存在多实例协调问题）；remove()/clear() 与补录/监听路径全部
  串行到主线程（round-3 评审：后台执行无串行化保证）。
JVM：清空抑制、单删抑制、同文重录解除、旧回调时序（串行化后无）、
敏感 clip、空 clip、重启持久。

## 6. 排查结论与记录（不做）

- 「123 层半角」：九宫格符号/数字全部 `sendSymbol → commitText` 半角
  直出；常用/引号已有 中/En pin；其余 tab 字形无宽度二相性。残留缺口 =
  中文模式 QWERTY 上滑 alts 固定全角，由 rime punctuator（full_shape）
  引擎层决定 → backlog。
- 「双击 shift 锁定」不采纳：现状即长按 350ms 锁定（keyboard.js:1238/
  1503）；requirements.md 记录。
- 键位间隙调整：忽略。长按滑动流畅度：本批由手感档位缓解，纯手感调优
  backlog。

## 7. 测试

- JVM（虚拟时钟 + 队列/内联两种 poster 各测一遍）：2.2 转换表全行；
  五类触发 + 同步/异步 Start 拒绝统一降级；seq 递增与重复失败通知；
  recreate 串行步骤（timeout/READY 插入、新编辑器抢先、重复重建、
  Close ERROR 放弃 swap、未启动 interim 跳过）；队列四入口溢出（pending/
  replaying 两态、Accept 回调次数、failedMode 取溢出会话）；queued Mode
  成功/失败重放；ClipboardStore 全矩阵（§5）。
- mock 键盘套件：seq toast 一次、hello 恢复不弹、角标/LOADING 占位、
  variantReplaying 前置消费、降级短按重试目标、bottomPad 单点 padding、
  手感参数生效与迁移回退。
- mock 设置套件：底部留白/手感控件读写、离散档位校验。
- 设备套件：设置页新行双语、注入 degraded 事件的 DOM + hello 重建恢复、
  剪贴板抑制真机断言、demo 截图；run-all 全绿 + ace 终验（真机采集
  降级日志字段验证）。
- 版本：app 1.0.6（versionCode 36）/ 键盘 3.30.0。

## 附：round-2 合并前清单对照

| 清单项 | 落点 |
|---|---|
| 修正「无事件」「与视频一致」表述 | §1 |
| 状态转换表、持续状态 vs 每次失败通知 | §2.2/§2.1（seq） |
| Start 拒绝、旧引擎清理、队列重放顺序 | §2.1 转换顺序 |
| recreate 可验证串行步骤 | §2.4 |
| 全部队列写入口、在途命令、第 129 条 | §2.5 |
| 留白单次、内容/总高协议、零值、横屏公式、面板、离散校验 | §3 |
| 剪贴板敏感/旧回调/空 clip/禁用采集/同文/重启 | §5 |
| 设置按键更新、迁移、旧键、手感算法 | §4 |
| demo 先行、真实验证非仅注入 DOM | §3/§7 |

## 附：round-3 实现代码评审吸收（全部成立，已修）

实现完成后对工作区全量 diff 的第二轮 codex 评审（5 P1 + 5 P2）逐条核实，
全部成立并修复；附 JVM/mock 回归：

| 级别 | 发现 | 修复 |
|---|---|---|
| P1 | 重复 recreate：第二次 Close 被已关闭引擎同步拒绝且无回调，swap 链再次死锁 | live Close 的同步拒绝视为「无在途收尾」，立即续接 closePendingThenSwap（§2.4） |
| P1 | 新编辑器启动不作废旧 recreate：旧回调可在新会话下换目录 | onEditorStarted 递增 recreateGeneration（@Volatile），旧链每步 gen 检查即失效 |
| P1 | pending Close 失败仍换目录 | pending Close 事件 ERROR → 放弃 swap 仅重启；同步拒绝（无回调）→ 直接 swap |
| P1 | replay 中队列溢出即降级 → 换 stamp 丢弃在途已提交键 | 溢出推迟到 replay 静默点（flushOverflow）；Direct 自身溢出 failedMode 归 null 不打徽标 |
| P1 | remove/clear 在后台线程调用，与监听/焦点补录无串行化 | 存储层内部 post 到主线程；监听路径同文也抑制（只有异文真实记录解除标记） |
| P2 | 留白变化不触发原生重测 | 广播接收器对 FixedHeightInputView requestLayout（pad 在 measure 时读取） |
| P2 | hello 的 scrubSpeed 被旧 localStorage 镜像回写覆盖 | scrubSpeedFromNative 置位后镜像不再覆盖运行值 |
| P2 | hello 快照与失败通知不可区分（缺 seq 时侥幸静默） | hello 携带 degradeSeq 且 JS 标记 snapshot：恢复徽标、更新 seenDegradeSeq、永不 toast |
| P2 | 重试期间状态条仍提示「点模式键重试」；降级不终止变体重放 | warming 无条件优先显示；active 降级取消 variantReplaying 并收起展开层 |
| P2 | warmup 数据不匹配被归因为 ENGINE_INIT_FAILED | 提取 degradeReasonFor(EngineCode)，live/pending ERROR 共用映射 |
| 小 | 意外 CLOSED（引擎自灭）未按方案转 runtime 降级 | ！closed 的 CLOSED → degradeToDirect(mode, ENGINE_RUNTIME_FAILED)；closeEngineSession 先置 closed 再派发（内联 mainPoster 下顺序敏感） |
| 小 | 降级文案直接插 MODES.title 未翻译 | t(config.title)；状态条与候选条互斥占位（CSS [hidden] + ellipsis） |
| 小 | EngineTypes 注释把 degradedActive 语义写反；方案文档含本机临时路径 | 注释更正；路径删除 |

## 附：round-4 修复核验吸收（5 P1 + 1 P2，全部成立，已修）

| 级别 | 发现 | 修复 |
|---|---|---|
| P1 | 双 recreate 交错：第二次 recreate 捕获不到 pending，在第一次 Close 未落地时直接 swap | swap 等待「启动时的全部在途 close」集合齐毕（swapWaits + 继承 closeStates），不是只等自己的 |
| P1 | Rejected ≠ 安全关闭：NativeTextEngine 关闭失败后再 Close 返回 Rejected，修复 1 的续接会绕过失败保护 | beginClose 统一派发/合流：首次派发持有结果，后来者 join；closeFailed 引擎永久阻止 swap；Close ERROR → 放弃 swap 只重启 |
| P1 | flushOverflow 重入：降级启动新重放链后外层循环继续消费队列，串行破坏 | takeOverflowDegrade() 触发即 return，调用方必须停止（降级的链接管队列） |
| P1 | 延迟溢出只保住即时 commit，拼音在途组合串仍丢 | degradeToDirect 落盘 composingRaw（IN-04 回车上原串语义）；意外 CLOSED 分支不再提前清 composingActive |
| P1 | 正常进入语音命中「意外 CLOSED」：READY 接管 pending stamp 未同步 sessionGeneration，后续 newSession 铸出与在途 close 相同的 stamp | READY 接管时 `engineSessionGeneration = stamp.engineSessionGeneration`，恢复 stamp/计数不变式 |
| P2 | 状态条 ellipsis 在 flex 容器上无效（匿名 flex 子项不截断），文案两端被裁 | display:block + line-height 居中 + text-overflow:ellipsis |
| 附带 | 设备套件实锤：degrade 事件携带的 mode 变化触发 renderMode，抹掉刚画上的降级徽标 | renderMode 尾部重画 renderDegradeBadge()（所有切换路径覆盖） |

## 附：round-5 修复核验吸收（3 P1 + 2 P2，全部成立，已修）

| 级别 | 发现 | 修复 |
|---|---|---|
| P1 | abandonPending 直派 Close 绕过记账：失败的 pending 关闭不进 closeFailed，目录保护可绕过 | 改走 beginClose |
| P1 | live 引擎 recreate 时 Close 失败：ERROR 事件被当作引擎运行失败触发降级（模式掀成 Direct），随后 swap 决策按已变的模式重启并清掉降级 | beginClose 的 emit 带 `command = Close` 标记，ERROR 臂对 Close 失败不降级——失败后果归记账（放弃 swap、原模式重启） |
| P1 | span 模式（法/俄）组合期 runtime ERROR：ERROR 臂 finishComposing + 降级 commitText(raw) 双重落字 | 组合落盘统一收口 degradeToDirect（按模式族：拼音落原串、span 模式 finishComposing），ERROR 臂不再重复处理 |
| P2 | 降级发起的 Close 在内联回调下被误判为意外关闭 → 一次失败两次降级通知 | degradeToDirect 先置 closed=true 再派 Close |
| P2 | close 同步落地时 swap 在主线程执行（递归删目录） | decide 的 ok 分支把 swap 派到 background |
| 测试 | live Close 失败按原模式重启不降级；span 组合只落地一次；意外 CLOSED 单次通知（内联时序） | 新增 3 个 JVM 测试 + 强化断言 |

## 附：round-6 核验 + 设备套件实锤（4 P2，全部采纳）

round-6：4 项协调器修复全部通过、无新 P0/P1；4 个 P2 采纳：

- live-close 测试改用默认 onStart（引擎真正 live，断言 `!engineWarming`），
  不再误测 pending 路径；同步重入测试的 CLOSED revision 接续在途事件（=4），
  真正穿过 revision 门验证 closed 提前赋值。
- mock 角标回归先 hello 切到拼音再注入 direct 降级，保证 renderMode 真的
  发生（设备抓到的擦除路径才被回归覆盖）。
- debugState() 返回 degrade 的浅拷贝（原引用可被自动化改写内部状态）。

设备套件（device_feel_degrade_verify）实测出第三个真缺陷：

- **隐藏期原生 resize 不触发 ResizeObserver**（无 layout 即无回调），
  键盘收起时改底部留白、再弹出后行高停在旧预算（37px @ 308 视图）。
  修复：hello 尾部延迟两次 applyHeight（250ms/900ms，显示即重推 hello）+
  visibilitychange 重算；native 在 onStartInputView 的 epoch 重测后再
  post 一次 requestLayout 兜底。
- 套件自身：pad 用例先自归零（被杀残留的 36 会让 delta 永不达成）、
  稳态判定改为「视图高与 padding 相对基线的差值都到位」，剪贴板标记
  轮询等待，i18n 用例显式导航并对起始语言鲁棒。
