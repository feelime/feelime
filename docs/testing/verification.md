# 验证与门禁

改动怎么验收：本地三层（秒级、无设备）→ 模拟器收敛 → 真机终验 →
发布产物本身冒烟。本文只讲方法与门禁构成；不保留历史结果——任何
一轮的通过记录都不能代替当前产物的验收。

需求口径见 [../product/requirements.md](../product/requirements.md)，
设计语义见 [../design/keyboard.md](../design/keyboard.md)。

## 0. 原则

- **mock 优先**：UI 逻辑与桥接行为先在 `mock_bridge_tests.js`
  （fake DOM + fake Native，node 直跑）验证；Kotlin 纯函数用 JVM 单测
  钉住；设备只做端到端回归。
- **断言跟行为走**：改可见语义先 grep `scripts/verify/` 里的字形字面量
  与元素 id，级联更新套件后再发版。
- **设备断言以宿主编辑器文本为 oracle**（uiautomator dump 的 text 属性
  与截图），不信键盘自身的乐观 UI 状态。
- **触摸必须真实**：能被页面合成事件骗过的路径（滚动、手势、浮层）用
  adb input / CDP `Input.dispatchTouchEvent` 驱动；DevTools 只读 DOM、
  几何与状态。
- **失败即重跑该组**：任何 FAIL → 修复 → 该套件全部用例重跑；部分
  通过不算收敛。
- **发布冒烟针对将发布的 APK 本身**：覆盖安装与真正首启两条路径都要
  在发布字节上跑过（`device_upgrade_verify.py` /
  `device_firstlaunch_verify.py`），且装机 SHA 与发布产物一致。
- **环境全部注入**：仓库内没有硬编码的设备序列号/主机名/路径；一次性
  诊断探针放 `scripts/verify/archive/check_*.py`，同样只读环境变量。

## 1. 本地门禁（无设备）

```bash
node scripts/verify/css_lint.js              # CSS 静态规则（R1-R3）
python3 scripts/generate-keyboard-data.py --check    # 键位图与 schema 一致
python3 scripts/generate-phrase-initials.py --check  # 常用语默认输入码表
node scripts/verify/mock_bridge_tests.js     # 键盘桥接功能套件
node scripts/verify/mock_settings_tests.js   # 设置页调用面
bash scripts/verify/mock_baseline_tests.sh   # 旧代键盘基线钉数（漂移即红）
ANDROID_HOME=… ./gradlew testDebugUnitTest   # 应用 JVM 套件（direct/play 两 flavor）
./gradlew --settings-file spikes/native-engine-smoke/settings.gradle.kts \
    --project-dir spikes/native-engine-smoke testDebugUnitTest   # 引擎冒烟 JVM
```

- **css_lint**（零依赖 node）：R1 `touch-action:none` 只允许键位网格，
  滚动容器子元素必须 pan-x；R2 初始/动态 hidden 的 id 若有无条件
  display 声明必须有 `#id[hidden]{display:none}` 抵消；R3 mock 套件的
  滚动容器必须在 CSS 有对应 `overflow-x:auto`（防改名后 mock 假绿）。
- **mock 基线**：`test-fixtures/keyboard-<旧版本>/` 内是与发布 APK 内嵌
  逐字节一致的键盘源码，套件按 `{since, until}` 键盘版本门控双代
  同跑，钉精确的 passed/failed/skipped 计数——harness 变更导致旧形态
  用例腐烂时在这里暴露。2026-09 起 baseline 只锁 failed=0 与通过数下限，
  让 skip 计数随 `since:` 门自然浮动（精确 pin 变成了每批次的复盘仪式）。
- **滚动模型**：mock harness 对滚动容器有 clientWidth/scrollWidth/
  scrollLeft 模型与 `world.drag()`（preventDefault 即 cancelled）——
  「拖到底弹回最左」「横滑被 touchstart 杀掉」这类缺陷在本地可复现。

## 2. 设备门禁

**设备套件跑 debug 构建**（依赖设置页测试字段与 DevTools，release 都没有
——release 包冒烟走 §4a）。debug 包名带 `.dev` 后缀，套件的包名/组件串
统一由 `FEELIME_PKG` / `IME_SVC` 解析（规则见 §4 与 AGENTS.md）。

前置环境变量（`run-all.sh` 第一步会核对装机 APK 与本地字节一致）：

```bash
export FEELIME_ADB_SERIAL=<serial>          # 测试设备
export FEELIME_VERIFY_APK=$PWD/app/build/outputs/apk/direct/debug/app-direct-debug.apk
export FEELIME_ASR_FIXTURE=<16kHz wav>      # 本地自备，不入库
export FEELIME_AAPT2=/path/to/aapt2         # 可选（x86_64 主机构建）
export FEELIME_BUILDER_SSH=<user@host>      # 可选（远端 x86_64 构建机跑 JVM 门禁）
export FEELIME_BUILDER_DIR=<远端仓库路径>    # 可选，默认 ~/code/feelime
export FEELIME_BUILDER_SDK=<远端 SDK 路径>   # 可选，默认 /opt/android-sdk
export FEELIME_EMU_LOG=<模拟器日志路径>      # 可选（AVD：开启图形通道病态检测）
export FEELIME_EMU_RESTART_CMD=<重启命令>    # 可选（病态时在段边界计划内重启）
bash scripts/verify/run-all.sh             # 全量门禁
```

单跑某套件：`FEELIME_ADB_SERIAL=<serial> python3 scripts/verify/device_<name>_verify.py`
（环境变量见各脚本头部注释）。

### run-all 的段选择、续跑与 profiles

2026-09 评审落地：设备持久状态是假失败的第一来源，gate 开头做一次
**基线复位**（`pm clear` + 重授权 + 重选 IME + 关旋转），设备段之间做
轻量清扫（force-stop + 删套件可写的 prefs 文件）。同一设备同时只允许
一个 gate（`/tmp/feelime-gate-<serial>.lock`，并发第二个直接拒绝）。

```bash
bash scripts/verify/run-all.sh --list        # 列出段与 profiles
bash scripts/verify/run-all.sh 9n 9j         # 只跑指定段（前缀匹配）
bash scripts/verify/run-all.sh --from 9g     # 从某段跑到尾
bash scripts/verify/run-all.sh --resume      # 跳过状态文件里已绿的段
bash scripts/verify/run-all.sh --profile quick   # 按改动面选段
FEELIME_GATE_NO_RESET=1 bash scripts/verify/run-all.sh  # 调试：跳过基线复位
# 另有 FEELIME_GATE_RETRIES=<n>（失败段自动重试次数）与 FEELIME_GATE_NO_RESET
```

段选择按 label 前缀匹配，可选中包括本地段在内的任意段，未知段名
直接报错退出；`--resume` 对所有段生效。状态文件
`/tmp/feelime-gate-state-<serial>.json` 记录 APK sha + git sha + 工作区
指纹，换 APK/换 commit/改工作区自动作废（已绿的段重新验才算数）。
qemu 死亡或单段重试耗尽时 gate 响亮退出，修复/重启后用 `--resume`
续跑，不再整跑报废。

profiles（按改动面选层，普通批次用 quick ≈ 30min，全量留给发版前）：

| profile | 段 |
| --- | --- |
| quick | base、extended、feel-degrade、input-prefs、panel、height-card |
| input | base、feel-degrade、input-prefs、t9、appearance、stroke |
| keyboard-js | base、extended、caps-flick、keymap、pool |
| native-engine | base、extended、backspace、delete |
| kotlin-service | base、editor、feel-degrade、resource |
| voice | gesture、voice-hold、fn-voice、asr |
| resources | resource |

### run-all 步骤

| 步骤 | 内容 |
| --- | --- |
| 1 | css lint + 两个生成器 `--check` |
| 2 | mock 桥接 / mock 设置页 + 旧代基线（锁 failed=0 且通过数不低于下限） |
| 3 | 应用 JVM + 引擎冒烟 JVM |
| 5 | `device_verify`：基础输入、中文全拼/双拼候选、模式持久化 |
| 6/6b | `device_gesture_verify`：纯物理手势（连删、上滑、长按弹层、光标滑动）；`device_voice_hold_verify`：空格长按语音（含模型预热与浮层收尾） |
| 7 | `device_extended_verify`：扩展语言/UI（法/俄/日、符号、候选翻页、主题） |
| 8 | `device_editor_verify`：宿主编辑器（多行、密码框、imeOptions、日语转换） |
| 9 | `device_panel_verify`：剪贴板/常用语面板与敏感编辑器行为 |
| 9a–9r | 各交互专项回归（见 §3 套件清单；9n = 引擎降级，9o = 候选字号/模糊音/联想输入偏好，9p = T9 九宫格，9q = 外观页，9r = 笔画五键） |
| 10 | `device_resource_verify`：高度/资源预算（APK 体积、数据目录、PSS 增量） |
| 11 | ASR 回归：AVD 单次正确性 smoke（性能门只在真机成立）；真机五跑严格门限（见下） |

### 共享助手与新套件

共享的键盘/设置页触摸助手、模式标签表、PASS/FAIL 记录器统一放在
`scripts/verify/fv_common.py`（`new_recorder()` / `ev` / `sev` /
`wait_until` / `keyboard_*` / `settings_*` / `launch_settings` /
`switch_mode_real`）。新套件从这里导入，不要再复制私有副本，也不要
import 其它套件当库（历史教训：height_card 曾被 6 个套件当库用，
改一处坏一片）。

### ASR 门禁

`scripts/research/run-asr-regression.sh`（经 run-all 第 11 步）对冻结的
16 kHz WAV 跑五轮识别：识别结果必须包含关键 token；性能门限与
`scripts/research/asr-baseline.json`（**物理设备**上录制的基线）比较。
注意：

- x86_64 模拟器比物理设备慢一个量级，**跨设备类别的性能比较不可复现**：
  AVD 日常门只跑**单次正确性 smoke**（`--runs 1 --waive-perf-gate`），
  性能结论必须来自冷真机的五跑严格门限。
- 设备热状态直接决定性能结果（外壳温热即可使推理慢数倍）；性能门限
  必须在冷设备上跑。
- 该步的隔离 harness 会覆盖安装设备上的主应用，跑完必须重装主 debug
  APK 再做任何面板/编辑器类操作。

## 3. 套件清单

| 套件 | 覆盖点 |
| --- | --- |
| `device_verify` | 基础输入/布局/持久化（英文、全拼、双拼候选与确认、模式记忆） |
| `device_gesture_verify` | 退格连删、上滑/下滑、长按弹层与拖远取消、光标滑动（语音长按在 `device_voice_hold_verify`） |
| `device_extended_verify` | 法/俄/日、符号层、候选翻页与展开区真实滑动、主题切换 |
| `device_editor_verify` | 多行 Enter、密码框、imeOptions、日语转换、宿主动作 |
| `device_panel_verify` | 剪贴板显示/粘贴/删除、常用语增删、敏感编辑器置空 |
| `device_caps_flick` | 大写锁定隔离、中文 flick、标点墨迹居中、变体列存活、快捷切换 |
| `device_settings_phrases` | 设置子页、常用语 CRUD、组合落地、preedit 不上屏 |
| `device_keymap` | 自然码键位图、设置二级页、候选条横滑 |
| `device_candidate_pool` | 统一候选池收起保真、全角 flick、编辑卡、行菜单 |
| `device_control_layer` | 控制键层只换工具条、粘滞组合 keyEvent、横屏、高度桥 |
| `device_control_switch` | 控制层开关语义、槽位不压缩键盘、高度卡 |
| `device_backspace_delete` | 退格左滑清组合、删词（真实 librime）、组合浮层角标 |
| `device_candidate_delete` | 任意候选删除、meta 位线上形态、横屏四行、语音设置页 |
| `device_fn_custom` | Fn 键码、扩展带浮层、定制 JSON 全链路、语音界面、重弹回主界面 |
| `device_height_card` | 高度卡/编辑卡真实触摸、设置页导航、界面语言 |
| `device_phrase_codes` | 常用语自动输入码、法语卡内编辑、光标快慢一致性 |
| `device_editor_modes` | 编辑器级模式限制、全拼展开、触摸状态清理、收起重开 |
| `device_replay_geometry` | 稳定展开列表、快捷切换目标、Fn 键面、横屏槽位预算 |
| `device_t9_verify` | T9 九宫格（微信式键面）：五列结构/左列常用字符、点按通配回归（94664→中族、9426 歧义）、手势消歧（上滑字面数字、横滑首尾字母、下滑中字母、7 拆分浮层 q/r）、音节条收窄 + 确认键提交、长按全后选、123/emoji 直达、重输、mic scrub 不落空格、空格上屏、回全拼复原 |
| `device_input_prefs` | 输入偏好全链路：候选字号三档到真实候选文字、模糊音五组独立开关切 prism（nian→lian、zan→zhan、fu→hu、le→re、zhon→zhong）与复原、联想 bigram 上屏出接续词 + 连续联想 + 关闭复原 |
| `device_resource_verify` | 高度顶沿、APK/数据/PSS 预算 |
| `device_feel_degrade` | 统一降级状态机：注入失败矩阵（超时/工厂/初始化）断言徽标、键入排队回放、重试与自动恢复（9n） |
| `device_stroke_verify` | 笔画五键：键面/通配/分词造句/句子压后/空格确认/逗号两步/三行弹层/符号行（9r） |
| `device_appearance_verify` | 外观页：主题/背景图/键帽不透明度/单手压缩等真实控件链路（9q） |
| `device_upgrade_verify` / `device_firstlaunch_verify` | 发布冒烟：覆盖安装 / 真正首启 |
| `device_cursor_host_verify` | 光标滑动宿主探针（需 cursor-host 探针 APK，按需单独跑） |
| `device_models_verify` | 模型导入/下载面（需 models 探针 APK，按需单独跑） |
| `device_punctuation_verify` | 标点探针（punctuation-probe 宿主，按需单独跑） |
| `device_settings_entry_verify` | 系统入口/设置专项（依赖 model_import，按需单独跑） |
| `device_voice_stop_verify` | 生产语音停/取消专项（真实编辑器+触摸，按需单独跑） |
| `device_model_import_verify` | 模型本地导入（SAF 选择器 → 校验 → 安装 → 麦克风） |
| `device_asr_production_verify` | 生产录音链路（模拟器音频注入 → 真实 InputConnection） |
| `archive/check_*.py` | 一次性探针（0.17.6 终端时代遗产，诊断用，不进 run-all） |

新增用户可见行为时：先补 mock/JVM 用例，再加对应设备套件用例，并把
新套件接进 `run-all.sh` 的步骤序列。

## 4. 平台差异与已知怪癖

以「SKIPPED/放宽预算并写明原因」处理，真机保持严格断言：

- 模拟器（SwiftShader/ART 常驻开销）PSS 增量预算放宽；WebView 冷启动
  慢，几何/面板用例放宽轮询窗口。
- **SwiftShader 图形通道会逐渐腐坏**（2026-09-12 定位）：qemu 死亡前几十
  分钟持续刷 `bad color buffer handle`，且病态期 WebView 渲染已失败——
  「settings 打不开/几何读不到」先查模拟器日志再怀疑代码。把
  `FEELIME_EMU_LOG` 指向模拟器日志即可让 gate 在段间检测并警告，配
  `FEELIME_EMU_RESTART_CMD` 可在段边界计划内重启（2026-09 根因：
  36.4.10 的 SwiftShader 绘制任务在 buffer churn 下命中 JIT 断言 →
  SIGABRT）。
- 部分 OEM 的密码输入框被系统安全键盘整体接管，IME 收不到 EditorInfo：
  设备断言记「平台接管」，敏感判定矩阵由 JVM `InputSensitivityTest`
  覆盖。
- WebView 收起后 DevTools 旧 target 可能僵尸：连接要按当前屏宽过滤、
  带超时重握手；旋转后可能残留多方向僵尸 target，不能按 pid 缓存命中。
- `dumpsys` 判定旋转成功要看实际字段（`mCurrentRotation`），uiautomator
  层级里的 rotation 属性优先于 SurfaceOrientation（部分设备横竖屏都可能
  缺失）。
- force-stop 当前默认 IME 可能触发系统切走默认输入法：套件开头重新
  `ime enable + set`；卸载重装后 RECORD_AUDIO 需重新授权（部分 OEM 拒绝
  adb 授权，走系统向导）。
- 引擎数据部署是异步的：全新安装后等 `.ready` 出现再跑套件。
- **`ime enable/set` 的组件串按 `flattenToShortString` 精确匹配**（ColorOS
  实测）：正式包必须写缩写 `com.feelime.ime/.FeelimeService`，全类名报
  Unknown input method；`.dev` 包（类包≠applicationId）注册为全类名。
  脚本一律用 `device_verify.py::IME_SVC`，不要手写。

### 4a. release 包冒烟（对将发布的 APK 本身）

release（`BuildConfig.DEBUG=false`）**没有**套件依赖的两样东西：设置页
测试输入字段（fixtures 块不建）与 DevTools（`setWebContentsDebuggingEnabled
(DEBUG)`）——设备套件直接跑会「test field not found」。冒烟走系统级断言：

1. 安装 release APK（正式签名，与已装的 debug 正式包互斥需先卸）；
   `am start SetupActivity` 后再 `ime enable/set`（fresh install 直接
   set 可能枚举不到）。
2. 首启断言用 firstlaunch 套件中对 release 有效的两项（F1b 设置内容进
   a11y 树、F2 无设置页 JS 错误），其余项 debug-only。
3. 键盘链路：打开 app 设置页「输入测试」（uiautomator 按文本找入口，
   正式功能非 fixtures）→ 聚焦输入框 → `dumpsys input_method` 的
   `mInputShown=true` → **键盘截图推 qwerty 键位坐标打键**（`nihao`+
   空格）→ ui_dump 断言 EditText 文本上屏「你好」。
4. 深层行为（stroke/标点两步流等）在同码 debug 包上跑设备套件覆盖；
   release 差异面只剩 R8/keep（keep 三件套已 established）。

### 4b. librime 行为排查：引擎侧日志是唯一真相源

「probe 正确而 app 异常」时先看**进程实际进引擎的按键流**——应用层以为
发了什么不算数。给 `spikes/.../feelime_rime_bridge.cpp` 的
`min_log_level` 临时改 0 重编 .so，librime 全量 INFO 日志（含
`process key:` 逐键序列、segmentation/translation 细节）经 stderr 进
logcat，tag `rime.feelime_m0`；查完还原。绕过 `checkEngineArtifacts`
gate：临时 .so 需同步改 `third_party/manifest.json` 对应条目的
sha256+bytes，构建完 `git checkout` 还原两者。实锤案例见
keyboard.md §9.3a「组合中禁自动追页」（JS 自动翻页产生的隐藏
PAGE_DOWN 在 librime 侧可见、在应用层不可见）。

### 4c. 词库换装/重编（issue #39 流程）

基底词库与全部 prism 必须成对同场编译（syllable_id 耦合；旧 prism 配新
table 实测词频错位到 51.7% 命中）。重编链路（host，无需 NDK）：

1. `scripts/research/fetch-native-engine-inputs.sh` 拉齐 pinned 源（含
   `rime-frost-96278d8.tar.gz`）。
2. 组装 shared 现场（prelude/essay/luna-pinyin schema + frost cn_dicts
   六件 + 仓内 umbrella 覆盖 `luna_pinyin.dict.yaml`；双拼/T9/fuzzy
   schema 从 assets 拷入），用 pinned host deployer
   （`build-cmake-native-engines.sh` 的 host-deployer 段单独构建）
   `--compile` 各 schema。
3. 模糊音矩阵：`scripts/generate-fuzzy-prisms.py --shared <现场>
   --deployer <bin>`；`--verify` 用 prism.txt 拼写集合做语义校验
   （byte 级会因 marisa 构建顺序差百字节，属预期）。
4. T9：先 `scripts/generate-t9-syllables.py`（读新 `table.txt` 重写
   keyboard.js 内联块，KEYBOARD_VERSION 两处 bump），再
   `FEELIME_T9_DEPLOYER=… FEELIME_T9_SHARED=… scripts/generate-t9-schema.py
   --compile`（顺带更新 engine-data MANIFEST）。
5. 双拼键位图：`scripts/generate-keyboard-data.py`（prism.txt 派生，
   mock 有 golden 校验）。
6. `assets/engine-data/MANIFEST.json` 全量重算 sha/bytes；
   `third_party/manifest.json` 的 outputs 同步（checkEngineArtifacts
   gate 校验的就是它）。A/B 评测见 `scripts/research/dict-ab/README.md`。

## 5. 记录口径

验证记录绑定：被测产物（APK/键盘包 SHA-256）、运行环境（设备/模拟器）、
各套件通过计数、失败定性（功能回归 vs 环境怪癖）。修复后重跑的范围与
原失败范围一致；「上一轮该包通过过」不成立——换了字节就重新验。
