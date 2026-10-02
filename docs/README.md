# Feelime 文档导航

按主题组织。给 AI agent / 新贡献者的阅读顺序建议：
根目录 [AGENTS.md](../AGENTS.md)（工程约定与命令）→ 本索引 → 按任务挑对应主题。

沟通词汇（工具栏/快捷设置/让位等叫什么、指哪块）统一见
[glossary.md](glossary.md)——写文档 / 记 issue 前先对齐口径。

## development/ — 构建与环境

- [`development/building.md`](development/building.md) — **新机器 / 换环境**
  从零到出 APK 的完整步骤（前置组件、~/.config/feelime 配置、gradle 代理、
  setup-assets.sh、构建命令与首包核验），含四个必踩坑的规避方法。

## design/ — 产品与键盘设计

- [`design/keyboard.md`](design/keyboard.md) — 产品与交互语义的**权威文档**
  （§0-§17：总原则、视觉规格、结构、面板、存储、桥、设置、候选、热更新、
  引擎、编辑手势、控制键、语音、主题、横屏高度、定制、版本发布）。
  **代码注释里的「design §N」都指这份文档的节号。**
- [`design/appearance.md`](design/appearance.md) — 外观方案：色彩 token、
  亮暗双主题、状态与浮层语言；新增可见元素的检查单。

## product/ — 需求

- [`product/requirements.md`](product/requirements.md) — 整合后的最终需求
  清单（输入/界面/语音/模型/更新/渠道/质量门槛）与已知边界。

## testing/ — 验证

- [`testing/verification.md`](testing/verification.md) — 验证方法与门禁
  （本地三层 → 模拟器 → 真机 → 发布冒烟）；配套自动化在 `scripts/verify/`。

## branding/ — 品牌资源

- [`branding/feelime-logo.svg`](branding/feelime-logo.svg) — logo 源稿；
  Android 端同形状见 `app/src/main/res/drawable/ic_launcher.xml`。
