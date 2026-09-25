# AGENTS.md — AI 协作指南

给 AI agent（和新同事）的工程约定与操作手册。读完本文件即可安全地改代码、
跑门禁、发版本；产品语义的权威出处见 [docs/README.md](docs/README.md)。

## 项目一句话

Feelime 是一个 Android 离线输入法：Kotlin `InputMethodService` + WebView
渲染的 HTML 键盘（`app/src/main/assets/keyboard/`），通过 token 鉴权的
JS Bridge 调用 `InputConnection`；离线语音（sherpa-onnx 流式 + 整句
纠错双通道）与 librime 中文引擎。

## 仓库布局

```
app/src/main/assets/keyboard/   键盘前端（index.html / keyboard.js / keyboard.css / VERSION）
app/src/main/assets/settings/   完整设置页（HTML，不参与键盘热更新）
app/src/main/java/com/feelime/ime/   IME 服务、Bridge、引擎、面板、更新（Kotlin）
app/src/main/res/               图标与资源（ic_launcher.xml 与 docs/branding 同源）
scripts/verify/                 自动化验证套件（mock / css lint / 设备门禁）
scripts/research/               ASR 回归门禁、Hunspell 前缀索引生成、native
                                词典引擎 pinned 构建管线与验证脚本
docs/                           文档（见 docs/README.md 的主题索引）
tools/                          真实源码预览（keyboard-preview / settings-preview）
spikes/                         独立 Gradle 工程：librime 引擎冒烟、ASR 基线
test-fixtures/                  验证测试数据（旧代键盘源码、双拼键位表）
third_party/                    许可证清单与来源闭包
```

## 常用命令

```bash
./scripts/setup-assets.sh          # 首次：下载 sherpa-onnx AAR/模型（SHA-256 校验，
                                   #   安装到 ~/.config/feelime，全 worktree 共享）
ANDROID_HOME=… ./gradlew :app:assembleDirectDebug
                                   # 构建（产物 app/build/outputs/apk/direct/debug/）
./scripts/push-keyboard.sh --local # 键盘热更新：打包本仓键盘并推到设备（裸调需要 zip 参数）
adb install -r app/build/outputs/apk/direct/debug/app-direct-debug.apk
```

**debug 包名带 `.dev` 后缀**（`com.feelime.ime.dev`，名称 "Feelime Dev"），
与 Play/直装正式包（`com.feelime.ime`）**可同时安装**、数据目录独立。
配套约定：

- 验证脚本/工具的包名统一走解析：`FEELIME_PKG` 显式指定 > 设备装了
  `.dev` 就用 `.dev` > 正式包名（`device_verify.py::_resolve_pkg`、
  `run-all.sh`、`push-keyboard.sh` 同规则）。**正式包冒烟时显式
  `FEELIME_PKG=com.feelime.ime`**。
- **组件名字符串按命令分两类**（类在 namespace `com.feelime.ime` 下，
  不随 applicationId 变）：
  - `am start/force-stop` 等：宽松解析，任意形态都行——统一写全类名
    `{PKG}/com.feelime.ime.FeelimeService`（`.dev` 包下 `pkg/.Svc`
    缩写会按 applicationId 拼出不存在的类，全类名对两个包都对）。
  - **`ime enable/set`（ColorOS 实测）按 `flattenToShortString` 精确
    匹配注册表**：正式包注册形态是缩写 `com.feelime.ime/.FeelimeService`，
    写全类名反而报 Unknown input method；`.dev` 包类包不同、注册为全类名。
    一律用 `device_verify.py::IME_SVC`（按 PKG 自动选形态），不要手写
    组件串。

## 本机构建环境（不入仓库）

仓库面向开源，任何主机名、本机路径、签名凭据都不得入库；它们统一放在
每台机器的 `~/.config/feelime/`，所有 worktree/clone 共享一份：

```
~/.config/feelime/
├── env.sh      # KEY=VALUE 行、'#' 注释；键位表见下
├── models/     # ASR 模型树（setup-assets.sh 的安装目标，一次下载处处可用）
└── android/    # 大件构建资产（sherpa-onnx AAR）
```

加载语义（`scripts/feelime-env.sh` 与 `app/build.gradle.kts` 一致）：
文件被**解析**（不执行），只填充**未设置**的 `FEELIME_*` 变量——显式环境
变量永远优先。`env.sh` 键位（全部可选）：

| 键 | 用途 |
| --- | --- |
| `FEELIME_ANDROID_HOME` | Android SDK |
| `FEELIME_NDK_HOME` | NDK（pinned native 管线用） |
| `FEELIME_AAPT2` | aapt2 覆盖路径（x86_64 主机必配，见验证节） |
| `FEELIME_MODELS_DIR` | 共享模型树位置（默认 `~/.config/feelime/models`） |
| `FEELIME_ANDROID_DIR` | 共享 AAR 位置（默认 `~/.config/feelime/android`） |
| `FEELIME_ADB_SERIAL` | 门禁默认测试设备 |
| `FEELIME_ASR_FIXTURE` | ASR 门禁录音（16 kHz wav，自备、不入库） |
| `FEELIME_PREVIEW_ROOT` / `_URL` | demo 预览发布目录 / 访问链接前缀（`tools/deploy-preview.sh`，见外观变更流程） |
| `FEELIME_BUILDER_SSH` / `_DIR` / `_SDK` | 远端构建机（JVM 套件） |
| `FEELIME_DEBUG_KEYSTORE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD` | 调试签名（缺省用 Android 默认 debug.keystore） |
| `FEELIME_RELEASE_KEYSTORE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD` | 发布签名（正式私钥离线保存） |

**调试签名必须跨机构建一致**：默认 debug.keystore 每台机器不同，签名
不一致的包互相「升级」会被系统判定为不同应用、强制卸载重装——用户设置、
常用词、词库全部丢失（输入法还要重新启用）。所有参与构建的机器把同一份
`debug.keystore` 放在 `~/.config/feelime/` 并在 `env.sh` 配置
`FEELIME_DEBUG_KEYSTORE` 指向它。

模型目录解析优先级（`FEELIME_MODELS_DIR`）→ `~/.config/feelime/models` →
旧版仓库内 `app/src/modelAssets/full`（向后兼容，逐步废弃）。

**无模型 APK 的设置页下载验证**：thin/无模型 APK 在设置页走 ModelStore
下载。当前产品的下载源由设置页「模型源」选择驱动（`hf_mirror` /
`official` / `custom`），构建时嵌入的 `models/dev-urls.json` 镜像前缀
**只在设备端源选择为空时生效**。`custom` 接受 http/https（下载完整性
由 manifest 的 SHA-256 逐文件校验兜底，transport 不是信任边界）；custom
base 按 HuggingFace 仓库结构拼接（`base + <owner>/<repo>/resolve/main/ +
downloadPath`），自建源需镜像该目录布局：

```bash
# 生成本机 web 根并起 Range-aware 临时 server（设备下载器用 Range 续传，
# `python3 -m http.server` 不支持 Range 会损坏 .part，勿直接用）
scripts/dev-models.sh --serve <设备可达的主机或IP> 8765
# 之后构建 thin 包：-PfeelimeModels=thin -PfeelimeDevModels=true
# 注意：设备端「模型源」若已固定为 hf_mirror/official，需在设置页改回
# 或清除，dev 前缀才会生效；hf-mirror 上的部分模型对象与发布归档不一致
# （如 streaming encoder），固定走它必然校验失败
```

## 验证（改动的验收标准）

方法、套件清单与平台怪癖的完整说明见
[docs/testing/verification.md](docs/testing/verification.md)。速查：

```bash
# 本地三层（无设备，秒级）——任何改动至少过这三层
node scripts/verify/css_lint.js
node scripts/verify/mock_bridge_tests.js
ANDROID_HOME=… ./gradlew testDebugUnitTest

# 设备层（环境变量注入；run-all 第一步核对装机 APK SHA）
export FEELIME_ADB_SERIAL=<serial>
export FEELIME_VERIFY_APK=$PWD/app/build/outputs/apk/direct/debug/app-direct-debug.apk
export FEELIME_ASR_FIXTURE=$PWD/mixed-zh-en.wav   # 本地自备 16kHz wav，不入库
# 可选：FEELIME_BUILDER_SSH 可把 JVM 套件放到远端跑；仅本机构建时无需设置
bash scripts/verify/run-all.sh    # 全量门禁（--list/--resume/--from/--profile 选段；
                                  #  开头 pm clear 基线复位，段间清扫，flock 单设备锁）
```

## 词典引擎数据（engine-data）

`app/src/main/assets/engine-data/`（rime/hunspell/mozc/assoc 数据，约 66MB）随仓库
分发，构建时 `checkEngineArtifacts` 按 `third_party/manifest.json` 与
`MANIFEST.json` 的 SHA-256 逐文件核对。再生成走 pinned 管线（输入全部是
上游开源归档，哈希钉死）：

```bash
./scripts/research/fetch-native-engine-inputs.sh ~/tmp/feelime-native-inputs
# NDK r29 解压到任意目录后：
FEELIME_NATIVE_INPUTS=… FEELIME_NATIVE_NDK=… FEELIME_NATIVE_WORK=… \
  bash scripts/research/build-cmake-native-engines.sh   # so + rime-data
# mozc.data 另由 scripts/research/build-mozc-android.sh 构建
```

## 键盘热更包签名身份

正式 Ed25519 私钥离线保存，仓库只有公钥（`ReleaseKeys`）。
`app/src/test/resources/keyboard-update-signed.zip` 由一次性测试身份
`feelime-roundtrip-test` 签名（私钥 PEM 就在测试资源里，只用于打包器↔校验器
的往返测试，不在生产信任集）。重打：

```bash
FEELIME_SIGNING_KEY=app/src/test/resources/keyboard-update-roundtrip-test-ed25519.pem \
  FEELIME_KEY_ID=feelime-roundtrip-test scripts/package-keyboard.sh \
  app/src/test/resources/keyboard-update-signed.zip
```

约定：**先模拟器收敛、再真机终验**；改可见语义先 grep
`scripts/verify/` 里的字形字面量与元素 id，级联更新套件；发布前对将
发布的 APK 本身跑覆盖安装（`device_upgrade_verify.py`）与首启
（`device_firstlaunch_verify.py`）冒烟。

模拟器环境注意：API 36（Android 16）google_apis x86_64 镜像在
DevTools 合成 TouchEvent 切到符号层（`<123>`）时会触发 qemu **静默退出**
（host 无 OOM/信号记录，100% 复现；真实 `input tap` 未测出差异前先假定
模拟器缺陷）。这类"套件跑到某一步模拟器就没了"先换真机回归，别在
模拟器上死磕。

## 工程约定

- **设置不进 localStorage，壳提供统一 pref 接口**：一切「设置」（用户
  偏好，需要备份/换机跟随的值）的真相源必须是原生层（键盘侧走
  `feelime_keyboard.xml` + hello 下发 + `setQuickPref`/SettingsBridge
  回写；设置页走 SettingsBridge）。localStorage 只允许两类用途：
  ① 纯 UI 缓存（如系统主题镜像，壳每轮重发、丢了无害）；② 使用痕迹
  （最近符号/表情，明确不进备份）。新增设置项时直接接桥，别再落
  localStorage；旧项按批次迁移（色彩模式已于 3.45.1 迁 `theme_mode`）。
  违反后果真实发生过：tile 循环只写 localStorage，任何一次 hello 按旧
  pref 把主题洗回系统亮色（2026-09-17）。
- **UI 改动先过 preview**：本版若含任何键盘/设置页的外观变化，发布前
  必须已走「键盘外观变更流程（demo-first，强制）」并拿到确认；检查单
  先过这条，再看双 bump/tag/冒烟。外观改动的 hotfix 同样适用（热更
  ZIP 也是发布）。
- **版本双 bump**：发版本必须同时改 `app/build.gradle.kts`（versionCode/
  versionName）和键盘版本（`keyboard.js` 的 `KEYBOARD_VERSION` +
  `app/src/main/assets/keyboard/VERSION`，两处一致）。设备上 built-in
  键盘副本按 VERSION + 字节比对判断刷新；改键盘文件后要 `run-as … rm -rf
  files/keyboard/built-in` + force-stop 重建副本。
- **发版必留源码快照**：发布任何版本前，对应源码必须已 commit 并打 tag
  （`v<versionName>`）；发布产物从该 tag 构建，装机冒烟通过才算发布
  完成（冒烟入口见 docs/testing/verification.md §3；release 包冒烟走
  verification.md §4a 的系统级断言——release 没有测试字段与 DevTools）。
- **Play closed testing 发布**（1.0.2 起 established）：`./gradlew
  :app:bundlePlayRelease` → 产物在 `app/build/outputs/bundle/playRelease/`。
  上传前校验三件套：manifest 版本（bundletool dump）、签名证书
  （`keytool -printcert -jarfile`，须与历届上传密钥一致）、jarsigner
  verify。上传走 Play Developer API 脚本（机器私有，
  `~/.config/feelime/scripts/publish-play.py`，SA 密钥 `play-upload.json`，
  发布名 `feelime-play-release-<ver>.aab` 归档到内网 googleplay 目录并
  在其 index.html 加产物行）。closed testing = **alpha** 轨道；
  `--list-tracks` 先看现状，中英 release notes 各 ≤500 字符。
- **设计文档权威**：产品/交互语义以 `docs/design/keyboard.md` 的节为准，
  代码注释写「design §N」引用它；引用必须指向真实存在的节，改语义
  先改文档再改代码。
- **候选池语义**：候选条与展开区共享同一累积池，组合 key 变化才重置；
  「确认第 N 候选」类操作一律按 id 走 `chooseCandidate`，与分页游标
  解耦（design §7）。
- **中文标点通道分两态**（design §9.6）：空闲态发 ASCII 走引擎
  punctuator 转全角（全角直发绕过 punctuator 会被 librime 丢弃）；
  **组合中**Android 构建的 librime 会吞标点键——一律走 `enginePunct`
  两步流（按 id 确认池头候选，回声收组合后 `commitText` 直发全角），
  覆盖 qwerty 标点槽 tap/上滑/长按与 stroke 8 键。其余符号仍走
  `commitText` 直上屏。
- **WebView 限制**：`@JavascriptInterface` 代理对象无法从 JS 侧包装
  （静默 no-op）；观察桥调用要换通道（引擎事件 / 宿主编辑器 / native
  日志）。
- **桥方法三条铁律**（2026-09-24/25 深链七轮连环修的教训，详见
  docs/testing/verification.md §9 诊断流程）：
  ① **注解逐个检查**：`@JavascriptInterface` 只作用于紧随的声明，
  新增桥方法时确认注解在自己头上——漏注解 = JS 端 undefined、调用
  TypeError 静默崩，设备上无任何报错（批四 openSetupPage 实录）。
  ② **桥方法别与外类方法同形**：ImeBridge 的 `openSetup(token)` 与
  外类 `openSetup(page)` 单 String 参数重叠，inner class 里裸调
  `openSetup(page)` 被 Kotlin 静默解析到桥方法、page 被当 token 吃
  掉——跨层同名调用一律 `this@Outer.method(...)` 显式限定。
  ③ **门闸按语义分级**：导航类桥调用（跳自家设置页，用户明确点击、
  无数据面）不过 token/throttle 门闸——guarded 静默拒绝 × 导航可见性
  = 用户感知「按键失灵」；数据读写类照旧全量门闸。
- **深链/注入脚本只用同步表达式**：`WebView.evaluateJavascript`
  **不 await Promise**，回调拿到的是 "{}" 而非 resolve 值；需要 JS 侧
  重试或异步结果时，把重试调度放 Kotlin（postDelayed），注入脚本保持
  一次性同步返回（2026-09-25 pending 永不清实录）。
- **交互链路验收要证明链路归属**：看到「设置页显示目标内容」不等于
  「tile 链路通了」——am start 直发、上轮残留、CDP 僵尸读数都能伪造
  同样的终态。验收多环节交互时打开诊断开关（设置页 → 诊断），按
  verification.md §9 的 route 链对账：桥入口 → startActivity →
  Activity 到达 → 锚命中，四点齐了才算链路通。改时序/状态语义前先
  列全交互场景（冷启/热启/搜索/预览触发），每轮修完跑一遍清单，
  只回归报障场景必然把新 bug 带进下一轮。
- **环境变量注入**：仓库内不落设备序列号/主机名/绝对路径；一次性探针
  放 `scripts/verify/archive/check_*.py`，同样只读环境变量。
- **发布前**：敏感信息扫描（主机名/IP/绝对路径/私有项目引用/私人内容
  不得入库，测试数据放 .gitignore 并在文档说明自备方式）。

## 文档更新纪律

- 改交互/行为语义 → `docs/design/keyboard.md` 对应节（或新增主题节）。
- 改视觉/新增可见元素 → 对照 `docs/design/appearance.md` 的检查单。
- 需求变化（新增/放弃能力）→ `docs/product/requirements.md` 的对应条目
  或已知边界；不再维护按批次的需求存档。
- 改验证方法/门禁 → `docs/testing/verification.md`。

## 键盘外观变更流程（demo-first，强制）

所有涉及键盘**外观**的需求（布局、间距、键面、图标、配色、新增可见
控件，以及**任何用户能看见的变化**——现有控件的位置移动、字号/尺寸
调整、文案排版、显示与隐藏的形态），必须先出 demo、确认后再开发。
判断标准只看「用户眼睛能不能看到」，不区分「新控件」还是「老控件
换个样子」；拿不准算外观。**未经预览确认的外观改动禁止进入发布**
（包括搭其他改动的批次一起发——搭车也是发布）。

1. 外观方案直接实现到**真实键盘源码**
   （`app/src/main/assets/keyboard/`），用
   [`tools/keyboard-preview.html`](tools/keyboard-preview.html) 预览——
   该页 fetch 真实的 index.html/keyboard.css/keyboard.js，注入空操作桥
   （调用日志 + 假引擎），键盘行为与真机同源；不做手写模拟键盘。
2. 预览方式：`python3 -m http.server <port>`（仓库根）后打开
   `/tools/keyboard-preview.html`，或发布到静态目录：
   `./tools/deploy-preview.sh`。交付给人看时必须发布并附访问链接——
   目录取 `FEELIME_PREVIEW_ROOT`（落 `<root>/preview-<键盘版本>/`，版本
   取自 assets/keyboard/VERSION），链接前缀取 `FEELIME_PREVIEW_URL`
   （两个键都在 `~/.config/feelime/env.sh`，本机路径/域名不入库；都没配
   时落到 `~/tmp/feelime-preview`）。demo 截图（深浅 × 横竖）放进同一
   预览目录。发布后要在**部署出来的 URL** 上验证（禁用缓存的全新会话或
   确认服务端对预览路径发 `Cache-Control: no-cache`）——本地看过、线上
   是旧缓存，等于没交付。Chrome F12 设备模拟（手机模式）下可像
   手机一样触摸操作；页面按钮可切竖屏/横屏、模拟输入、开快捷设置、
   控制键层与九宫格。URL 可直达状态便于截图/评审：
   `?act=qs`（快捷设置，`&page=2` 翻页）、`?act=t9`、`?act=t9popup`、
   `?act=t9cancel`（T9 长按弹层/松手取消），可叠加 `&theme=light`、
   `&locale=en`、`&mode=landscape`。
3. 外观确认后才进入功能收尾（测试套件、设备回归、发布）；视觉验收看
   截图（深浅两主题、横竖两方向），DOM 断言不能代替视觉核对。
