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

- 加载：hello、部署完成、开关变化时后台预热（裸 TSV 解析为
  `HashMap<prev, List<next>>`，文件内序即质量序）。区分未就绪、加载中、
  已完成；文件未部署或解析失败不缓存空表，后续部署/查询可重试。
- 冷查询立即返回，加载完补送最后一次查询；不在输入线程等待解析。
  补送前校验编辑器、提交、面板代际及开关，组合开始、收起、关闭联想
  或 Service 销毁即作废旧请求。暖查询沿用同一补送入口。
- 命中：取上屏文本的**最长可用后缀**（4→1 字）查表。上屏可能是整句，
  不需要分词器。

## 3. 触发与展示

- 挂点在 service 的 engine listener：`event.state.commit` 非空且模式为
  全拼/双拼/T9/笔画且开关开启时，commit 事件尾部经独立的
  `Feelime.onAssoc` 通道推送词列表。其他事件不推，键盘保留现有联想
  直到组合开始。
- 键盘：组合（composing）非空时联想让位给引擎候选；组合为空时展示联想词，
  样式与引擎候选完全同款（用户定稿 2026-09-20：不做灰字/圆点等降调标识，
  class `candidate assoc` 仅作测试定位用）。
- 清空时机：组合开始、编辑器切换（onStartInput 推空列表）、**键盘收起**
  （onFinishInputView 推空，onStartInputView 再兜一次——同编辑器收起再弹出
  不走 onStartInput，不清的话联想词与工具栏让位态原样残留，device 复现
  2026-09-20）、模式切换、关闭开关。
- 点击联想词：`Native.commitAssoc(word, token)` → coordinator.pasteExternal
  写入编辑器，等本次 Reset 回声与文字提交都完成后，以该词为前词查询
  下一轮联想（连续联想）。等待期间收起、切换编辑器/面板或接受后续输入
  （含退格、粘贴、再次选联想词），旧点击不再发起查询；用户输入在入口
  推进独立代际，不等引擎回声，内部 Reset 与队列回放不重复推进。
  提交完成与结果投递都校验该代际，结果补送仍校验后续引擎事件与上下文，
  暖缓存与冷加载使用相同顺序。
- 自身写入引起的选区回调不推进输入代际；组合替换的光标预测与组合串镜像
  共用规则（含自家编辑器的拼音族）。接受/清空组合、硬键补交等直接写入
  同样登记预测；原生 setSelection 成功时立即更新预测坐标，随后回调只确认
  这次操作。真实外部编辑、移光标或切换面板输入目标仍使旧联想失效。

## 4. 开关

- `feelime_keyboard` 偏好 `association_on`，**默认关**（不惊扰现有用户，
  设备套件行为保持确定性）。
- 设置页「输入」卡「中文联想」开关 → `setAssociation(on, token)` →
  ACTION_KEYBOARD_PREFS_CHANGED 广播 → IME 重推 hello（带 associationOn）。
