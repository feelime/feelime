# 中文联想（bigram 统计表）

选词上屏后，候选条给出「下一个词」的联想候选（issue #2，2026-09 立项）。

## 1. 数据

- `engine-data/assoc/zh_bigram.tsv`：裸 TSV，`prev<TAB>next<TAB>count`。
  不用 .gz 交付——aapt2 打包会解压 .gz 资产并去掉后缀，运行时按原路径
  找不到文件会让整条部署链路静默失败；APK 对条目本身做 DEFLATE，体积不吃亏。
- 语料：LCCC 对话语料（预分词，标点独立成 token，标点断链）。
- 生成：`scripts/build-association-data.py`（确定性剪枝/排序，重跑字节稳定）。
  参数：每前词 top-8、单对 ≥3 次、前词总计 ≥12 次、纯中文 1-4 字词。
- 部署：进 `engine-data/MANIFEST.json`（bytes+sha256），随 EngineDataStore
  的版本目录哈希校验部署，与其他引擎资产同一通道。

## 2. 查询（AssociationStore）

- 懒加载：首次用到时后台线程解压解析为 `HashMap<prev, List<next>>`
  （文件内序即质量序，直接截断 TOP_K）。
- 命中：取上屏文本的**最长可用后缀**（4→1 字）查表。上屏可能是整句，
  不需要分词器。
- 表缺失/未加载完 → 返回空（联想是增强，绝不阻塞输入主链路）。

## 3. 触发与展示

- 挂点在 service 的 engine listener：`event.state.commit` 非空且模式为
  全拼/双拼/T9/笔画且开关开启时，把 `assoc` 词列表并入当次 `onEngineState`
  payload。其他事件不带该字段，键盘保留现有联想直到组合开始。
- 键盘：组合（composing）非空时联想让位给引擎候选；组合为空时展示联想词，
  样式与引擎候选完全同款（用户定稿 2026-09-20：不做灰字/圆点等降调标识，
  class `candidate assoc` 仅作测试定位用）。
- 清空时机：组合开始、编辑器切换（onStartInput 推空列表）、**键盘收起**
  （onFinishInputView 推空，onStartInputView 再兜一次——同编辑器收起再弹出
  不走 onStartInput，不清的话联想词与工具栏让位态原样残留，device 复现
  2026-09-20）、模式切换、关闭开关。
- 点击联想词：`Native.commitAssoc(word, token)` → coordinator.pasteExternal
  写入编辑器 → 立即以该词为前词计算下一轮联想并推送（连续联想）。

## 4. 开关

- `feelime_keyboard` 偏好 `association_on`，**默认关**（不惊扰现有用户，
  设备套件行为保持确定性）。
- 设置页「输入」卡「中文联想」开关 → `setAssociation(on, token)` →
  ACTION_KEYBOARD_PREFS_CHANGED 广播 → IME 重推 hello（带 associationOn）。
