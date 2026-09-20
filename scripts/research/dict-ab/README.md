# 词库 A/B 评测（issue #39，2026-09-20）

基底词库选型（luna vs rime-ice vs rime-frost）用的 host 侧评测基建。
结论定案：**rime-frost 瘦身组合**（95.3% 首选命中 / 19.4MB table），
供应链见 `scripts/research/fetch-native-engine-inputs.sh`（pin
96278d8）与 `build-cmake-native-engines.sh`。

## 当轮结果（172 用例，同一 luna_pinyin.schema、同一系统 librime 1.10）

| 配置 | table.bin | 首选命中 | 前三命中 |
|---|---|---|---|
| luna@56b934b（旧默认） | 8.8MB | 89.0% | 91.3% |
| ice@9e66b07 全量（+tencent） | 60.6MB | 94.8% | 97.7% |
| ice@9e66b07 瘦身（-tencent） | 29.1MB | 94.8% | 97.7% |
| frost@96278d8 全量（+cell） | 63.4MB | 95.3% | 97.1% |
| **frost@96278d8 瘦身（-cell/GB18030）** | **19.4MB** | **95.3%** | 97.1% |

要点：tencent 词向量 / cell 分类词库对本用例集零首选命中贡献（纯体积）；
ice 与 frost 质量打平（1 条差，无统计显著性）；frost 瘦身体积最小。
旧 prism 混搭新 table 会因 syllable_id 耦合词频错位（51.7%）——词库换装
必须 prism/table 成对同场重编（含 fuzzy m1-m31，用
`scripts/generate-fuzzy-prisms.py`）。

## 复跑方法

```sh
# 1) 三套现场：shared 放 prelude/essay/词库源 + 仓内 schema，umbrella 的
#    name 写 luna_pinyin（schema 的 dictionary 不变）。
rime_deployer --build <dir> <dir> <dir>/build     # 系统 deployer 即可（相对比较）
# 2) 编 probe（链系统 librime；返回值命中比对见源码头注释）
gcc -O2 probe_eval.c -o probe_eval -lrime
# 3) 跑（user_dir 用全新目录避免用户词典学习效应）
./probe_eval cases.tsv $PWD/<dir> $PWD/<dir>
```

- `cases.tsv`：每行 `拼音<TAB>期望首选`（`|` 分隔可接受备选），# 注释。
  覆盖高频两字词/常用词/成语/热词新词/技术词/短句造句/长句造句。
- 现场需要的 yaml 依赖：default.yaml（patch schema_list 只留 luna_pinyin，
  用 default.custom.yaml）、key_bindings.yaml、pinyin.yaml、punctuation.yaml、
  symbols.yaml、essay.txt、opencc/（可直接拷 /usr/share/opencc 整目录——
  Debian librime 的 simplifier 与仓内 text 格式 opencc 配置不兼容）。
- probe 退出用 `_exit(0)`：系统 librime 的 octagram/lua 插件在 atexit
  清理路径上会崩。
