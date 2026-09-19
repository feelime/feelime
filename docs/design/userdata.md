# 用户数据备份 / 语音权限 / 签名确认导入

本期三个原生侧需求的设计（2026-09）。对应验收点 #5/#6/#7。

## 1. 设置/常用语/词库整体备份（导入导出）

### 1.1 文件格式

单个 JSON 文件，带版本号，纯文本可直接编辑。值保留 Java 类型
（Boolean/整数/字符串），恢复后 getString/getBoolean/getInt 不串型：

```json
{
  "kind": "feelime-userdata",
  "version": 1,
  "appVersion": "1.0.4",
  "settings": {
    "feelime_ui":        { "key": "value" },
    "feelime_keyboard":  { "keyboard_height_portrait": 640 },
    "feelime_engine":    {},
    "feelime_asr":       { "strip_final_period": true },
    "feelime_custom_keys": { "json": "...", "enabled": true },
    "feelime_favorites": {},
    "keyboard_update":   { "update_url": "...", "update_source_url": "...", "update_auto_check_enabled": true }
  },
  "favorites": [
    { "id": "f12", "time": 1730000000000, "text": "常用语", "code": "cyy", "rank": 1 }
  ],
  "webviewStores": { "feelime_ui_locale": "zh" },
  "userdb": {
    "rime": { "user.yaml": "<base64>" },
    "mozc": { "user_dictionary.db": "<base64>" }
  }
}
```

- `settings`：SharedPreferences 全量导出（类型保真）。
  `keyboard_update` 只保留三个配置键（update_url / source_url / auto_check），
  丢弃 update_state、content_hash 等过程状态——恢复时这些必须重新走一次
  安装/校验，直接搬会把新设备钉死在一个失效的热更指针上。
- `favorites`：常用语，TSV（`items` 键）解码成 JSON 数组，方便人肉编辑；
  导入时用 PanelCodec 重新编码写回（上限同 FavoritesStore：200 条）。
- `customKeys`：自定义键位（feelime_custom_keys 的 json+enabled），随 settings 走。
- `webviewStores`：键盘 WebView localStorage 里设置级的键（见 §1.4）。
  最近符号/最近 emoji 属于使用痕迹，不备份。键盘高度走原生
  feelime_keyboard（物理 px），JS 副本是 CSS px，单位不同不进备份。
- `userdb`：`filesDir/rime-user`、`filesDir/mozc-user` 逐文件编码
  （rime 用户词库、mozc 词典）。**version 2 起**：可压缩的文件写成
  `{"gz": "<base64(gzip(bytes))>"}`（mozc 预分配的稀疏 DB 绝大部分是
  零字节、leveldb `.ldb` 也可压，实测 649KB 备份缩到 ~57KB）；压不动
  的小文件保持 v1 的纯 base64 字符串。导入双格式兼容（按条目形态区分，
  version 1/2 都收）。`LOCK`/`LOG`/`LOG.old` 是 leveldb 可再生文件，
  导出跳过；小写 `*.log` 是 write-ahead 日志（含未压实数据），保留。
- **空即空状态**：favorites/webviewStores/userdb 即使为空也写出——备份表达
  「导出方的完整状态」，空列表的恢复语义就是清空目标（覆盖语义）。

### 1.2 通道与原子性

- 导出：设置页「导出数据」→ SAF CreateDocument（默认文件名
  `feelime-backup-<yyyyMMdd-HHmm>.json`）→ bridge 组包后写流。
  已知限制：词库文件在输入法使用中被逐个复制，快照不保证引擎级一致
  （正在学习中的词条可能处于中间态）；空闲时导出最稳。
- 导入：设置页「导入数据」（先弹覆盖确认）→ SAF OpenDocument →
  bridge 有界读取（上限 64MiB，超限即拒绝）→ **阶段一全量校验**
  （kind/version、prefs 段落白名单、键类型契约、favorites 结构、
  webviewStores 白名单、userdb 路径穿越 + base64 解码）→
  **阶段二一次性提交**：写 prefs、favorites、镜像，userdb 写进
  `filesDir/rime-user.import` / `mozc-user.import` 暂存目录，
  `.ready` 标记最后落盘（半写的暂存永远不会被换入）。任何校验失败
  都不碰现有状态。
- 类型契约（防手编文件把 IME 写成持续崩溃）：getInt 的键（键盘高度）
  必须 Int 且在 [0,100000]；getBoolean 的键（custom_keys.enabled、
  asr.strip_final_period、update_auto_check_enabled）必须 Boolean；
  其余键只接受 String/Boolean/Int。白名单外的 prefs 段落忽略（前向兼容）。
- 广播 `ACTION_USERDATA_RESTORED`：**无论是否带词库都发**。设置页与 IME
  同进程，但恢复动作全部走 SharedPreferences + 广播，不做跨实例直调。
- IME 收到广播：有待换入的暂存（以 `.ready` 为准）时，走
  TextInputCoordinator.recreateEngineSession：主线程 accept → dispatch
  Close（异步，等旧引擎真正停写）→ **换目录** → 回主线程开新会话。
  不能在会话活着的时候换目录，也不能二次 rimeInitialize（死锁，
  见 keyboard.md §8）。
- **mozc 的边界**：mozc 的 JNI 全局引擎不随会话重建（上游 onPostLoad
  见全局即返回），恢复的 mozc 词库文件在其输入法进程下次启动时生效；
  rime（主引擎）走会话重建即时生效。engineRestartNeeded 只看 rime。

### 1.3 webviewStores 镜像与 rev 协议

镜像存 `feelime_webview_stores` prefs（key `stores`），
格式 `{"rev": N, "values": {...白名单键...}}`：

- 键盘页在握手完成和这些键变化时 `Native.pushStores(values, token)`，
  原生合并白名单、rev+1、返回新 rev，键盘页存入
  `localStorage['feelime_stores_rev']`。
- 键盘页握手时 `Native.getStores(token)`：远端 rev 大于本地已见
  （只可能因为设置页导入让 rev 跳号）→ 先把恢复值落地
  （`Feelime.onStoresRestored`：写 localStorage、applyTheme、刷新
  scrubSpeed/quickPair 等构造期缓存、语言变化重走渲染）再继续握手。
  恢复是**权威覆盖**：备份里没有的白名单键要从本机 localStorage 删除
  （quick_pair 等运行时缓存回默认；语言键缺席即回默认 zh），否则页面
  随后的「先拉后推」会把陈旧值推回镜像，导出方的空状态/缺省键就被
  恢复方旧值翻了案。语言切换分支也不得在 hello 里提前 push——hello
  尾部统一「先拉后推」，提前推会让陈旧值写回镜像并抬高 rev，把刚导入
  的恢复值顶掉。拉取只接受真正的键值对象（数组/字符串等异常载荷不算
  「空备份」，不触发删除；native 正常产出 JSONObject）。
  「先拉后推」保证导入与修改两个方向都收敛，页面不在时也不丢恢复值。
- 白名单：`feelime_ui_locale`、`feelime_scrub_speed`、
  `feelime_quick_pair`、`feelime_menu_modes`、`feelime_mode_order`
  （`feelime_theme` 已迁原生 theme_mode，localStorage 旧值只是迁移来源、
  不在备份白名单）。
- 旧原生（无 pushStores/getStores）上运行新键盘 JS：全部 `typeof`
  探测后调用，绝不抛错。

## 2. 语音首用直弹系统权限

现状：FeelimeService.startVoice 无权限时只 toast 指引用户去设置页
（startVoice 的 MIC_PERMISSION_REQUIRED 分支）。Service 不能直接
requestPermissions，设置页的授权入口又埋得深。

方案：新增透明 `VoicePermissionActivity`（exported=false，
excludeFromRecents + finishOnTaskLaunch；**不能 noHistory**——官方
明确要求请求权限的 Activity 不得设置，否则授权回调不可靠）。
startVoice 无权限分支改为拉起它；Activity 调 requestPermissions(RECORD_AUDIO)：
- 授权 → 广播 `ACTION_VOICE_PERMISSION_GRANTED`，IME 接收后若仍停在
  ERROR/MIC_PERMISSION_REQUIRED 就重试 startVoice；
- 拒绝 → pushState 提示（保留去设置页的手动路径）。

## 2.1 语音浮层两种形态（撤销/说完了/上滑撤销）

原 ✕ 按钮长得像"关闭"，单击即整段丢弃听写，长篇听写误触挫败感强
（两击确认方案被否决：确认步骤本身挫败感更强）。按入口分两种形态：

- **mic 浮层**（点工具栏麦克风，「点击任意位置结束」不变）：
  - 「↺ 撤销」小按钮回**右上角**（描边幽灵、↺+文字、24px 高），
    单击弃稿 + toast「已撤销本次听写」；aria-label 撤销本次听写。
  - 「✓ 说完了」accent 实心大按钮**居中**（44px 高、卡片宽 78%），
    结束并上屏——浮层的主要出口。
- **长按空格浮层**（「松手上屏」）：无任何按钮，卡片收紧（只框住
  状态+识别内容+松手上屏）——
  - **上滑撤销手势**：按住期间上滑，浮层随进度（110px 满程）变小
    （scale 1→0.78）变透明（opacity 1→0.45）；
  - 「上滑撤销」提示是**卡片下方的常驻 toast 胶囊**（半透明底、
    不自动消失），上滑时字体和背景同步放大（translateX(-50%) 
    scale 0.85→1.30），过阈值进入 arm 态（底色转墨绿、字转 accent）；
  - 过阈值松手=撤销（toast），未过阈值或原地松手=上屏；
  - 提示只在 hold 形态显示（`#voiceOverlay.hold`）。
- 实现载体：`voiceSession`（'space-hold' / 其他）驱动 overlay 的
  hold 类；preview 页用 setVoiceSession/previewVoiceSlide 钩子模拟。
## 3. 键盘 zip 签名不符可确认导入

现状：KeyboardPackageVerifier 对 SIGNATURE_BAD 一律拒绝
（KeyboardStore.install → recordFailure，静默失败）。自签/改过的
键盘包没有任何导入通道。

方案（刻意开洞，但要留痕、绑请求）：
- `verify(zip, acceptBadSignature=false)`：只放行 SIGNATURE_BAD 这一类
  （长度不对/验签失败）；签名缺失(SIGNATURE_MISSING)与陌生密钥
  (KEY_UNKNOWN)仍然拒绝；放行时 signed=false、签名字节原样保留。
- `KeyboardStore.install(..., confirmBadSignature=false)`：透传；
  落盘时签名照存 + 额外写 `.signature-confirmed` 标记
  （区别于调试用的 `.unsigned`）。alreadyCurrent 分支同样补标记。
- `resolve()`/`loadVersion()` 三分支：签名有效 → 正常；签名存在但
  验不过 + 有确认标记 → signed=false、signatureConfirmed=true；
  无签名文件 → 仅 `.unsigned` 标记 + allowUnsignedVersions（调试）。
  ——必须做在 resolve 里，否则强制装上的键盘重启后就被回滚掉，
  "确认导入"形同虚设。
- 状态面板 `signed=false` + `signature_confirmed=true`，设置页
  「⚠ 当前键盘：签名不符（已手动确认导入）」。
- 入口三处，确认都**绑定包摘要 id**（sha256 前 16 位）：
  - 设置页本地导入与 URL 下载安装共用 `installWithConsent`：
    SIGNATURE_BAD 时 bridge 暂存 zip 字节 + id（pending/confirm 状态机），
    pushUpdateError 带 confirmable+confirmId；设置页确认 →
    `confirmKeyboardInstall(id)`、取消 → `dismissKeyboardInstall(id)`。
    pending 的 bytes/id/sha256= 钉扎三者**一体发布、一体取走**
    （bridge binder 线程与安装 worker 并发，拆散字段会绑错包或丢钉扎）；
    接受新导入请求与任何失败都作废旧 pending，旧 id 的确认/取消只拒绝
    自身、不清掉更新的请求。URL 带 `#sha256=` 钉扎时钉扎随包暂存、
    确认重装时重放（验签先于钉扎检查，否则确认通道会绕过钉扎）。
  - inbox 推送（scripts/push-keyboard.sh）：installFromInbox 遇
    SIGNATURE_BAD 弹 AlertDialog，确认后重装。
