# Feelime 输入法

> **Feelime** is an open-source, fully offline Android keyboard with modern
> visuals and built-in voice input. Everything — keystrokes, candidates,
> speech recognition — stays on your device.
>
> **Open** · completely open source and free; the keyboard UI is plain
> HTML/CSS/JS that you can customize without repacking the APK.
> **Modern** · a clean, modern interface plus streaming bilingual
> speech recognition.
> **Private** · fully offline, no network access, nothing leaves the device.
>
> English details: [README.en.md](README.en.md)

Feelime 是一个 Android 离线输入法：键盘区域由本地 HTML/CSS/JavaScript
渲染，通过受控 JS Bridge 调用 Android `InputConnection`；语音识别采用
双通道——流式 Zipformer 实时出临时文本，停顿段由 Paraformer 整句纠错，
最后恢复英文大小写、缩写与标点。全部计算发生在设备本地。

## 特性

- **完全离线**：语音识别（sherpa-onnx）与中文引擎（librime）都在本机
  运行，音频与文本不出设备；WebView 关闭网络与文件访问，CSP 禁外链
- **现代界面**：统一的色彩体系与交互语言，自动适配亮/暗主题（详见
  [docs/design/appearance.md](docs/design/appearance.md)）
- **语音输入**：中英混合流式识别 + 整句纠错 + 本地标点恢复，长按空格
  即说即上
- **中文**：全拼 / 双拼（自然码/小鹤/搜狗/紫光，含模糊音）、T9 九宫格、
  笔画五键（通配与分词造句）、简体、连续造词、独立用户词库、统一候选池
  （候选条与展开区共用全量候选，拖动自动加载）、中文联想、单手模式
- **多语言**：英语、法语、俄语、日语罗马字，离线词典候选
- **键盘界面可定制**：键盘就是 `app/src/main/assets/keyboard/` 下的
  HTML/CSS/JS——改几个颜色或整层重排，都无需重新打包 APK（debug 构建
  支持免签名热更包与本地推送，见下文「键盘热更新」）
- **符号键定制**：定制键位表支持文本 / 特殊键 / 组合键（如 Vim 宏）混排
- **控制键层**：Ctrl/Alt/Win/Fn 粘滞键与组合键，可驱动终端与远程桌面

## 构建与安装

标准 Android 开发环境即可（Linux/macOS，需要 `ANDROID_HOME` 指向
Android SDK）：

```bash
./scripts/setup-assets.sh     # 首次：下载 sherpa-onnx AAR 与模型（SHA-256 校验）
ANDROID_HOME=… ./gradlew :app:assembleDirectDebug
adb install -r app/build/outputs/apk/direct/debug/app-direct-debug.apk
```

词典引擎数据（中文/西文/日语，约 52MB）随仓库分发，构建时
`checkEngineArtifacts` 逐文件核对 SHA-256；再生成用 pinned 管线，见
[AGENTS.md「词典引擎数据」](AGENTS.md)。

完整包内置语音模型；`-PfeelimeModels=thin` 可构建不含模型的精简包
（首次使用语音前在设置页下载）。启用方式：授予麦克风权限、在系统输入法
设置里启用 Feelime，然后切换输入法选择 Feelime。

## 键盘热更新

键盘源文件在 `app/src/main/assets/keyboard/`。这就是自定义键盘外观的
入口：改 HTML/CSS/JS 后无需重打 APK——

```bash
./scripts/push-keyboard.sh --local  # 打包本仓键盘并推到设备，秒级生效
```

脚本写入应用私有目录并广播更新，运行中的 Feelime 免重启重载页面。
设置页可随时「恢复 APK 内置键盘」；键盘包安装走签名/能力校验与原子
激活（详见 [docs/design/keyboard.md §8](docs/design/keyboard.md)）。

## 文档

| 文档 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 工程约定、常用命令、验证门禁（AI 协作手册） |
| [docs/design/keyboard.md](docs/design/keyboard.md) | 产品与交互语义权威文档（代码注释的 §N 出处） |
| [docs/design/appearance.md](docs/design/appearance.md) | 外观方案与新增元素检查单 |
| [docs/product/requirements.md](docs/product/requirements.md) | 需求清单与已知边界 |
| [docs/testing/verification.md](docs/testing/verification.md) | 验证方法与门禁 |

## 开发与验证

本地三层门禁（无需设备，秒级）：

```bash
node scripts/verify/css_lint.js
node scripts/verify/mock_bridge_tests.js
ANDROID_HOME=… ./gradlew testDebugUnitTest
```

设备门禁（`FEELIME_ADB_SERIAL` 等环境变量注入）：

```bash
bash scripts/verify/run-all.sh
```

完整的验证方法、套件清单与平台怪癖见
[docs/testing/verification.md](docs/testing/verification.md)。

## 大文件与隐私

sherpa-onnx AAR、ONNX 模型与语音测试音频不提交 Git；
`scripts/setup-assets.sh` 从官方 release 下载并校验 SHA-256：

```text
sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20-mobile
sherpa-onnx-paraformer-zh-small-2024-03-09
sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8
```

音频不会写入磁盘（内存最多暂存约 24 秒 PCM），所有音频和文本都留在
设备上；剪贴板历史不采集密码框、不进云备份。

## 许可证

[GPL-3.0](LICENSE)（1.0.19 及之前的历史版本以 MIT 发布）。内置中文词库
来自 [rime-frost（白霜拼音）](https://github.com/gaboolic/rime-frost)
（GPL-3.0，裁剪组合，见 [third_party/](third_party/)）；语音能力来自
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)，中文引擎为
[librime](https://github.com/rime/librime)；第三方组件的完整清单见
[third_party/](third_party/) 与 [NOTICE](NOTICE)。
