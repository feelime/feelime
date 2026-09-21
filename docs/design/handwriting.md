# 手写输入（design: handwriting）

> 状态：开发中（issue #28）。本文档是手写输入的第一版设计与实现任务书。
> 调研与识别率 spike 结论见 issue #28 评论；本文只记定案与实现契约。

## §1 定案摘要

- **第一版范围：单字手写**——用户在书写区写一个字，停笔后识别，候选出现在
  候选条，点选上屏。多字连写/叠写/笔迹美化均为后续项（§9）。
- **识别引擎**：`ch_PP-OCRv5_rec_mobile.onnx`（fp32，16,631,306 字节，
  sha256 `5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5`，
  来源 ModelScope `RapidAI/RapidOCR` v3.9.2 `onnx/PP-OCRv5/rec/`）。
  int8 量化已试（dynamic/static 两种）掉点崩坏（行书 top5 98.2%→63.8%/51.8%），
  **定案 fp32**，量化优化进后续项。**分发：16.6MB 直接进 APK**（§5.3），
  thin 渠道运行时下载，国内镜像走 gitee（org feelime / repo models）。
- **host 识别率**（字体模拟口径，仅汉字候选+t2s 归一）：楷书 top1 98.8% /
  top5 99.6%，行书 93.4% / 98.2%，行草 81.6% / 94.5%。手指圆头粗笔比
  毛笔笔锋更友好（粗笔变体楷 top5 99.8%）。
- **推理栈**：`com.microsoft.onnxruntime:onnxruntime-android:1.27.1`。
  版本必须与 sherpa-onnx AAR（1.13.6）内嵌的 `libonnxruntime.so`（1.27.1）
  一致，两 AAR 的 so 用 packagingOptions pickFirst 去重——**APK 体积零增加**，
  Java API 完整，不写 JNI。装机后必须回归 ASR 门禁验证 sherpa 未受影响。
- **架构形态**：独立引擎，照 ASR 模式（`AsrEngine` 先例），**不实现
  `TextEngine`、不进 EngineCoordinator**——手写的输入是笔迹不是按键流，
  强行适配 Key/Backspace 命令契约是错误抽象。模式注册进 `MODES`，但
  `engine: false`。

## §2 数据流

```
JS 手写板(canvas) --touch 采集--> strokes: [[{x,y}...],...] + {w,h}
  --Native.recognizeInk(reqId, payload, token)-->
Kotlin HandwritingEngine:
  1) 点序列渲染 bitmap（§4.1 参数钉死）
  2) 预处理（§4.2，与 host spike 逐参数一致）
  3) OrtSession 推理 -> logits (T, 18385)
  4) 单字符精确 CTC 概率 DP（§4.3）-> 全词表排名
  5) 滤汉字 + t2s 归一（离线映射表）+ 聚合同字 -> top-8
  --window.Feelime.onInkCandidates({reqId, candidates})-->
JS 候选条渲染 -> 点选 -> Native.commitText(text, token) 上屏并清笔迹
```

推理在后台线程（`recognizeInk` 立即返回；结果只经回调）。reqId 单调递增，
回调与最新请求不符时 JS 丢弃。

## §3 桥协议 `handwriting-v1`

- `BridgeContract.CAPABILITIES` 增加 `"handwriting-v1"`。
- JS→native：`recognizeInk(reqId: Int, payload: String, token: String)`。
  `payload` JSON：`{"w":<书写区CSS宽>,"h":<高>,"strokes":[[[x,y],...],...]}`
  （坐标为浮点 CSS px，保留原始比例，归一化在 native 侧做）。
  过 `guarded(token)`，方法在 JavaBridge 线程被调，内部转主线程派发到引擎。
- native→JS：`window.Feelime.onInkCandidates(JSON)`：
  `{"reqId":n,"candidates":[{"text":"感","score":0.83},...],"error":null}`。
  模型未就绪/推理异常：`candidates: []` + `error: "unavailable"|"failed"`，
  JS 显示提示但不阻塞书写。
- 就绪位：hello 的 `engineDataReady` 列表加 `"handwriting"`（照 stroke 的
  `strictReady: true` 语义：**缺失当不可用**，菜单不出现入口）。就绪判定 =
  模型文件已落地（assets 或 ModelStore 下载完成，见 §5.3）。

## §4 渲染 / 预处理 / 解码（参数钉死，与 host spike 一致）

### §4.1 轨迹渲染（native，android.graphics.Canvas）

- 白底纯黑笔画，`Paint.Cap.ROUND`、`Join.ROUND`，抗锯齿开。
- 笔宽 = 渲染画布短边的 **4.3%**（§6.1 设备实证拍板：字体渲染的印刷体笔画
  天然 4-5%，spike 从未覆盖 2.2% 初值——真实轨迹下 2.2% 缩到 ~1px 模型放弃
  方形字；4.3% 实测「中」0.88 高置信。画布定义见下）。
- 画布：以笔迹内容归一——所有点做 bbox，映射到 **256×256 画布内保持纵横比**
  （长边撑满 256，短边居中留白）。直接用书写区原始 w/h 比例渲染会带大量空白，
  必须先按内容 bbox 紧致化。
- 相邻点 lineTo，一笔 stroke 一条路径。

### §4.2 预处理（逐参数对齐 RapidOCR `resize_norm_img`）

1. 渲染图取内容 bbox（阈值 pixel<200），四边外扩 10%（每边至少 4px），裁剪。
2. resize 到高 48，宽 `ceil(48*w/h)`，上限 320，双线性。
3. RGB、CHW、`x/255`，减 0.5 除 0.5（即归一到 [-1,1]）。

### §4.3 解码：单字符精确 CTC 概率

不写 beam search。输出恰为单字符 c 的精确概率，三状态 DP 向量化全词表
（host spike 已验证，一次矩阵运算出全排名）：

```
p = softmax(logits)               # (T, V)
pb = p[:,0]（blank）; pc = p[:,1:] # (T, V-1)
A=1.0; C=zeros(V-1)
for t in range(T):
    C = C*(pb[t]+pc[t]) + A*pc[t]   # 已完成"c"后接 blank/重复 c
    A = A*pb[t]                      # 保持全 blank
top = argsort(-C)[:30]
```

候选后处理：滤非汉字（CJK 统一表意 `㐀-鿿`、兼容 `豈-﫿`、`〇`）；
繁体字形按离线映射表归简（`engine-data/handwriting/t2s.json`，2843 条，
host OpenCC 生成，sha256 `79cc3619a3e3d0507014017863f49fea723cbb16146869959c02447c117fc860`）；
归一后同字概率相加、重排，输出 top-8 `{text, score}`（score 归一化到和为 1）。

词表来自 onnx metadata `character_list`（18383 字符，`\n` 分隔），
运行时构造 `["blank"] + chars + [" "]`（blank=0）。

## §5 实现清单

### §5.1 Kotlin（`app/src/main/java/com/feelime/ime/`）

| 文件 | 改动 | 参照 |
|---|---|---|
| `HandwritingEngine.kt`（新） | 加载模型（OrtSession，1 线程后台 init）、渲染/预处理/DP 解码、生命周期（onCreate 懒加载、onDestroy 释放）；纯函数部分（预处理、DP）写成可单测的静态方法 | `AsrEngine.kt`、`FinalPassRecognizer.kt` |
| `FeelimeService.kt` | `ImeBridge` 加 `recognizeInk`（guarded，转发引擎）；hello `engineDataReady` 加就绪位 | `startVoice` L2271 形态 |
| `update/BridgeContract.kt` | CAPABILITIES +`handwriting-v1` | — |
| `app/build.gradle.kts` | dependencies +onnxruntime-android:1.27.1；packagingOptions jniLibs pickFirst `**/libonnxruntime.so`（注释说明与 sherpa 同版本去重） | 现有 sherpa 依赖段 L496-509 |
| `models/manifest.json` | 新条目 `id: ppocrv5-mobile-rec`、`role: handwriting-rec`、files `handwriting/model.onnx`（downloadPath 同名）、urls 顺序：gitee 镜像（§5.3）→ ModelScope 直链 → huggingface 占位 | 现有 asr 条目结构 |
| `scripts/setup-assets.sh` | `INK_ASSET_DIR="$MODELS_ROOT/handwriting"`：目录不存在时从 ModelScope 下载、sha256 校验 | FINAL/PUNCT 段 |
| `engine-data/handwriting/t2s.json`（新） | 离线简繁映射表（文件见 §4.3） | third_party 清单如有体积门槛则放 MANIFEST |

### §5.2 JS（`app/src/main/assets/keyboard/`）

| 位置 | 改动 | 参照 |
|---|---|---|
| `MODES`（keyboard.js L365） | `'handwriting': {label:'手', title:'手写 Handwriting', layout:'handwriting', engine:false, strictReady:true}` | stroke 条目 |
| `LAYOUTS` + 渲染 | 新 `handwriting` 布局：候选条（复用现有 DOM/渲染函数）+ 书写区（canvas）+ 底部控制行（退格/空格/回车/模式键，复用控制键渲染） | `renderStroke` L1616、控制行渲染 |
| 手写板 | 书写区 canvas：touchstart/move/end 采点（passive:false、`stopPropagation`，**不得被 `setupFlick` 抢事件**——先读 L2488-2627 理解根级手势层再决定挂载层级/事件序）；实时画笔迹；停笔 600ms 触发 `recognizeInk`；书写中再来新笔则取消未决请求（reqId 失配丢弃）；长按书写区清空 | 语音上滑手势的事件处理经验 |
| 候选条 | `onInkCandidates` 回调渲染（复用现有候选条 DOM 与点击上屏通道，点选走 `commitText`）；识别期间候选条保持原样（不做 loading 态） | `onCandidates` L 处理 |
| preview | `tools/keyboard-preview.html` 的 noop 桥加 `recognizeInk` mock（延时 300ms 回固定候选），URL `?act=handwriting` 直达手写模式 | 现有 act 参数 |
| 模式菜单 | `modeOrder/menuModes` 默认表加 handwriting（排在 stroke 后） | L5798 |

### §5.3 模型分发

- **模型进 APK**：`setup-assets.sh` 下载到 `~/.config/feelime/models/handwriting/`，
  软链 `app/src/modelAssets/full` 进 assets（现有机制，路径 `handwriting/model.onnx`）。
  full/direct 构建随包分发（16.6MB，相对 engine-data 66MB 是零头）；play 版
  走 `:feelime-models` asset pack 同随包。
- **thin 构建（github release 直装渠道）不带手写模型**，运行时 ModelStore
  按 manifest 下载。manifest urls 第一位放 **gitee 镜像**
  （`https://gitee.com/feelime/models/releases/download/handwriting-v1/model.onnx`，
  org=feelime / repo=models / release tag=handwriting-v1），其后 ModelScope
  直链、huggingface 占位——gitee 国内直连，是默认国内友好源。
- **设置页「模型源」加 `gitee` 选项**（现有 hf_mirror/official/custom 之外），
  选中后 ModelStore 的 URL 解析优先 gitee 镜像前缀；设置页文案「Gitee（国内
  推荐）」。默认源选择为空时仍按 manifest urls 顺序（gitee 第一）。
- 加载顺序：assets（full/play pack）→ ModelStore 落地目录 → 都没有 = 未就绪。

### §5.4 测试

1. **单测**（`app/src/test/`）：HandwritingEngine 的纯函数——预处理形状/归一化
   数值、DP 解码（构造小 logits 手算期望 top-k）、t2s 归一聚合、非汉字过滤。
   模型文件不进单测（没模型时 engine 返回 unavailable）。
2. **mock 桥测试**（`scripts/verify/mock_bridge_tests.js`）：recognizeInk 的
   payload 合法性（w/h/strokes 结构）、token 拒绝、onInkCandidates 回调格式、
   reqId 失配丢弃。
3. **preview**：手写布局深浅主题 × 横竖截图（外观变更流程，demo-first）。
4. **AVD 回归**（emulator-5554）：装 directDebug，CDP 切手写模式，
   `Input.dispatchTouchEvent` 合成连笔轨迹（多步 move）画"十""中"等简单字，
   断言候选条出现且含目标字（mock 阶段断言固定候选；真模型断言 top-8）。
   注意 API36 模拟器符号层 qemu 崩溃缺陷与本特性无关，别死磕模拟器怪癖。

## §6 验收断言（主会话执行）

1. 本地三层门禁全绿（css_lint / mock_bridge_tests / testDebugUnitTest）。
2. `assembleDirectDebug` 产物 sha 与源码一致，装机（AVD + ace 真机）。
3. 真机 CDP：切手写 → 画字 → 候选含目标 → 点选上屏 → 笔迹清除。
4. thin 包 + ModelStore 下载链路可用（设置页模型源走 ModelScope 直链）。
5. **ASR 门禁回归通过**（onnxruntime so pickFirst 后 sherpa 必须无损）。
6. 识别抽查：真机手写 10 个常用字（工整口径），top-5 命中 ≥8。
7. 外观截图（深浅×横竖）过 preview 流程确认。

### §6.1 AVD 验证记录（2026-09-21，emulator-5554）

实现链路已端到端实证为**忠实**：设备输入张量拉回 host 复跑，
DP 输出与设备逐字一致到小数点后三位（渲染/预处理/模型/解码/词表
全部对齐）；CDP 合成笔迹 → 候选含「中」（top-1）→ 点选上屏 →
编辑框收到「中」、笔迹清除 → 模式菜单进出后状态干净，全部通过。

同时暴露一个**待拍板的参数问题**（§4 钉死值按约定未动，仅记录实测）：

- 笔宽 2.2%（256 画布上 5.6px）在 48px 输入高下缩到 ~1px，模型对
  方形字基本放弃：工整合成「中」最高概率仅 0.014~0.19，多数常用字
  （十/人/口/日）进不了汉字前 8。同一笔迹把笔宽提到 4.3%（11px），
  「中」即到 0.88、宽扁「大」0.84，稳定性数量级改善。
- §4 注明 2.2% 的出处是「spike 粗笔≈手指口径」；但 spike 的字体
  渲染实验里笔画天然是印刷体粗细（≈4-5% 画布），2.2% 从未被那条
  路径验证过。真手指接触面约占字宽 8-10%，4.3% 仍是保守值。
- 建议：`STROKE_WIDTH_RATIO` 0.022 → 0.043（一行），并把 §4 的
  笔宽与出处说明一并改。**未改，等确认。**

## §7 后续项（本版不做）

- int8/fp16 量化重试（per-channel + op blocklist 混合量化）、模型自托管源
- 多字连写、叠写（写满自动识别/半透明上一字）
- 笔迹美化渲染、笔锋、压感
- 词库联动候选（识别字 → assoc 联想补全词组）
- 手写候选数设置（停顿触发延时应要求已在二轮落地，见 §8.3）

## §8 二轮 UI/UX 定稿（2026-09-21，issue #28 round-2）

### §8.1 书写面板与模式高度

- 书写区改成大块面板，竖屏目标**宽高比 1.6:1**（微信输入法 wetype
  实测 984×590 口径），中央浅色提示「在此手写 · 长按清空」，落笔隐藏
  （`.writing`，沿用一轮机制）。
- 手写是唯一**改变键盘总高**的模式：进入时 JS 按当前宽度推
  `chrome + 控制行 + 面板` 的内容高度（`applyModeHeight` →
  `setKeyboardHeight`，native 按 orientation 持久化并钳制）；离开模式
  推回该方向已存高度，无已存值时推 0（native 复位默认的既有语义）。
  推送挂在 renderMode / renderHandwriting / resetToHome（重唤键盘）/
  applyHeightNow（HEIGHT_SETTLED_JS）四处，幂等。
- **横屏不改总高**：native 钳半屏、纵向没有余量，改**左右布局**
  （`.ink-layout` 横屏 row 分支）：面板竖向铺满整层高，退格/空格/中英/
  回车在右列三等分。
- 控制行高固定（`--ink-row-h`，JS 单一来源写入 CSS 变量，默认 46px），
  **不消费 `--kb-row-h`**——这是 §8.4 的结构性修复。中英键保留（wetype
  的模式出口在顶部工具栏，我们的模式菜单只挂这颗键）。

### §8.2 候选与工具栏整行互斥（wetype 形态）

- 无候选（初始/清空态）：候选条槽位显示工具栏。
- 有识别候选：**整行替换**——`setToolbarYield(true)` 收起全部工具
  （含 mic），左侧 `#inkTag`「手写」模式标识 + 候选横排占满，
  右侧 `#composeClear` × = 清笔迹并恢复工具栏。语音进行中不让位
  （mic 是 stop 入口，与联想让位同一守卫口径）。
- 点选候选上屏：`commitText` + 清笔迹/候选 → 回工具栏态；继续写则
  再次进候选态。收起键（#hide）在任何互斥态都保留。
- `auditToolbarTools` / `pruneOverflowTools` 尊重 `toolbarYield`：
  重唤键盘触发的工具栏对账不得把工具插回让位中的候选行。

### §8.3 平滑与停顿延时

- **平滑**只作用于发给引擎的 payload（`smoothInkStroke`），屏上实时
  笔迹保持原样：① 5 点三角核（1-2-3-2-1）滑动平均去抖，首尾锚点
  原样保留，窗口小不磨拐角；② 按弧长等距重采样（步长 3px）。
  payload 结构不变（strokes of [x,y]），native 侧无感。
- **停顿触发延时**：设置页「手写输入」卡片，0=快 300ms / 1=标准 600ms
  （默认）/ 2=慢 1200ms。原生 pref `ink_delay`（`PREF_INK_DELAY`），
  设置页走 SettingsBridge `setInkDelay`，键盘经 hello `inkDelay` 回读
  （旧 APK 不带字段不覆盖）；落盘广播
  ACTION_KEYBOARD_PREFS_CHANGED → native 重推 hello → 即时生效。

### §8.4 重唤折叠 P1（根因与修复）

现象：手写写了字 → 收起键盘 → 重唤，书写区 rect 折叠（0 高）、触摸
静默失效，候选条 rect 异常导致点选落空。

根因：控制键行走 `.kb-key` 的 `--kb-row-h`，而 `applyHeight()` 在视图
被瞬时量高（attach/重唤窗口、resize 与 layout 竞态）时会把行变量烘焙
成大值。qwerty 键面下这只是键变高；手写键面里书写区是
`flex:1; min-height:0` 的弹性块，被固定行高的控制行吃掉全部空间后
**塌缩为 0**，且没有后续再推导把它救回来（ace 的 evaluate 时序比
AVD 更容易把瞬态值固化）。

修复（三层）：
1. 控制行高与 `--kb-row-h` 解耦（固定 `--ink-row-h`）——陈旧行变量
   再也压不塌书写区（结构性拆除根因通道）；
2. `applyModeHeight` 挂进重唤路径（resetToHome / applyHeightNow），
   收起期间动过的高度回到手写态；
3. `inkSyncViewport` 挂进 `applyHeight`：书写区 CSS 盒变化才重建画布
   分辨率并重放笔迹（画布陈旧位图一类问题的兜底）。
