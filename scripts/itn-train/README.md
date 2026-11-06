# ITN 开放面分类器训练管线

分层裁决（`ChineseNumberItn` 结构层三态 + `ItnClassifier` 开放面逻辑回归）
的语料、训练与资源导出。验证记录（2026-11-06）：切分 eval 开放面
精确率 0.833/召回 0.976；结构层直接裁决错误率 3-7%（~/tmp/itn-cls
原型，语料 1429 句 = LLM 合成 + 人民网/BBC 真实语料 89 篇）。

## 结构

- `corpus_*.py` 样本定义（family 分族、C=转阿拉伯/K=保持汉字）
- `../data/itn-raw-extracts.jsonl` 真实语料冻结（出版社级文本自带
  标注真值；语域错配样本——新闻书面「数字+量词」倾向汉字——已在
  提取侧剔除，见 ~/tmp/itn-cls/extract_corpus.py 的口径记录）
- `lexicon.txt` frost base 数字词条+词频（24920 词，重提取命令见
  下）；**词面特征需要每词条多句语料才能学到权重**（单句 SGD 学不动
  ——成语 FP 的根因，见 MORE3/MORE4 的词条多句增广）
- `verdict.py` Kotlin `ChineseNumberItn.verdict()` 的逐规则移植——
  训练/推理开放面定义必须一致，**改任何一边都要同步另一边** +
  `ItnClassifierGoldenTest` 金样对拍
- `build.py` 语料规整化（段=解析器 run 粒度）+ 句骨切分防泄漏
- `train.py` 特征提取（n-gram + 词典词频桶 + FNV hash）与 SGD 逻辑回归
- `export_model.py` 训练 + 导出 assets（大端，DataInputStream 直读）

## 用法

```sh
cd scripts/itn-train
python3 build.py          # 语料 → train/test.jsonl（先于一切）
python3 export_model.py   # 训练 + 导出 ../../app/src/main/assets/itn/*.bin + 金样
# 然后强制重跑 JVM 测试（assets 不在 gradle 测试输入里）：
../../gradlew :app:testDirectDebugUnitTest --tests "*Itn*" --rerun-tasks
```

重提取词典（frost 换版本时）：

```sh
tar xzf <rime-frost tarball> --to-stdout '*/cn_dicts/base.dict.yaml' \
  | awk -F'\t' '/^[^\t]*\t[^\t]*\t[0-9]+/ {print $1"\t"$3}' > lexicon.txt
```

## 已知边界（按需扩数据重跑即可）

- 词面长尾（成语/俚语）靠词条多句增广压制，新词=补句重训
- 新闻语域与输入法语域的「数字+量词」写法冲突已在提取侧隔离
- 幺（幺幺零）未进解析器候选字符集，进的话语料补 phone-digits
