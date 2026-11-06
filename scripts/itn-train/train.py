# -*- coding: utf-8 -*-
"""字符 n-gram 逻辑回归 ITN 分类器（原型）。

特征（与未来 Kotlin 落地同构，纯查表+加权求和）：
- 候选段左右各 8 字窗口的字符 1/2/3-gram（跨界含段首/段尾字）
- 段自身形态：长度分桶、首/末字符、是否含进制词、是否纯字形
- 段+右1字 bigram、左1字+段 bigram
哈希到 2^18 槽，SGD 逻辑回归，L2 正则。纯 Python 无依赖。"""
import json
import math
import random
from collections import defaultdict

SLOTS = 1 << 18
WINDOW = 8

def hash_feature(s: str) -> int:
    # FNV-1a 32bit
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h % SLOTS

SCALE_WORDS = set("十百千万亿")

# 词典证据（frost base 提取的含数字字词条）：候选段参与的构词。
# 特征交给逻辑回归学权重——「十万八千里」→K 侧证据，「三个」→C 侧
# 证据，双栖词靠上下文特征消歧（codex 三件套的词典一环）。
LEXICON = {}
for line in open("lexicon.txt", encoding="utf-8"):
    w, _, f = line.rstrip().partition("\t")
    if w:
        LEXICON[w] = int(f)

def lexicon_hits(text, start, end):
    """(word, freq) 列表：词典里包含候选段且跨越其边界的词。"""
    lo, hi = max(0, start - 3), min(len(text), end + 3)
    out = []
    for s in range(lo, end):
        for e in range(max(end, s + 2), hi + 1):
            w = text[s:e]
            if w in LEXICON:
                out.append((w, LEXICON[w]))
    return out

def freq_bucket(f):
    import math
    return min(int(math.log10(f + 1)), 5)

def extract(text, start, end):
    seg = text[start:end]
    left = text[max(0, start - WINDOW):start]
    right = text[end:end + WINDOW]
    fs = []
    for ctx, tag in ((left, "L"), (right, "R")):
        for n in (1, 2, 3):
            for i in range(len(ctx) - n + 1):
                fs.append(f"{tag}{n}:{ctx[i:i+n]}")
    # 跨界特征
    if left:
        fs.append(f"XL:{left[-1]}[{seg[:1]}]")
    if right:
        fs.append(f"XR:[{seg[-1:]}]{right[0]}")
    # 段形态
    fs.append(f"S:len{min(len(seg), 6)}")
    fs.append(f"S:head{seg[0]}")
    fs.append(f"S:tail{seg[-1]}")
    if any(c in SCALE_WORDS for c in seg):
        fs.append("S:scale")
    if all(c in "零一二两三四五六七八九" for c in seg):
        fs.append("S:puredigits")
    for i in range(len(seg) - 1):
        fs.append(f"S:bi{seg[i:i+2]}")
    # 段+右首字（量词证据）
    if right:
        fs.append(f"S+R1:{seg[-1:]}{right[0]}")
        fs.append(f"R1:{right[0]}")
    if left:
        fs.append(f"L1:{left[-1]}")
    for w, f in lexicon_hits(text, start, end):
        # 词面 + 词频桶：量词短语（三个 3.6万 / 一次 7万）与成语术语
        # （九九归一 25 / 六六大顺 16）在频率数量级上分离，桶特征跨
        # 词条共享信号，规避词面特征在句骨切分下的单侧失效。
        fs.append(f"D:{w}")
        fs.append(f"D:f{freq_bucket(f)}")
        ext = len(w) - (end - start)
        side = ("L" if text.index(w) < start else "R") if ext else "E"
        fs.append(f"D:ext{side}{ext}{freq_bucket(f)}")
    return fs

def featurize(sample):
    return [hash_feature(f) for f in extract(sample["text"], sample["start"], sample["end"])]

def sigmoid(z):
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z)) if z < 35 else 1.0
    return math.exp(z) / (1.0 + math.exp(z)) if z > -35 else 0.0

def train(samples, epochs=30, lr=0.15, l2=1e-6, seed=7):
    w = [0.0] * SLOTS
    rng = random.Random(seed)
    order = list(range(len(samples)))
    feats = [featurize(s) for s in samples]
    ys = [1.0 if s["label"] == "C" else 0.0 for s in samples]
    for _ in range(epochs):
        rng.shuffle(order)
        for idx in order:
            z = sum(w[h] for h in feats[idx])
            p = sigmoid(z)
            g = p - ys[idx]
            for h in feats[idx]:
                w[h] -= lr * (g + l2 * w[h])
    return w

def predict(w, sample, bias_scale=1.0):
    feats = featurize(sample)
    z = sum(w[h] for h in feats)
    return sigmoid(z * bias_scale)

def evaluate(w, samples, threshold=0.5):
    tp = fp = tn = fn = 0
    errors = []
    for s in samples:
        p = predict(w, s)
        pred = "C" if p >= threshold else "K"
        if pred == "C" and s["label"] == "C":
            tp += 1
        elif pred == "C" and s["label"] == "K":
            fp += 1
            errors.append(("FP", p, s))
        elif pred == "K" and s["label"] == "K":
            tn += 1
        else:
            fn += 1
            errors.append(("FN", p, s))
    return tp, fp, tn, fn, errors

def main():
    train_set = [json.loads(l) for l in open("train.jsonl", encoding="utf-8")]
    test_set = [json.loads(l) for l in open("test.jsonl", encoding="utf-8")]
    w = train(train_set)
    print(f"train={len(train_set)} test={len(test_set)}")

    for name, data in (("train", train_set), ("test", test_set)):
        tp, fp, tn, fn, errors = evaluate(w, data)
        prec = tp / (tp + fp) if tp + fp else 1.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        print(f"{name}: C对={tp} 误转={fp} K对={tn} 漏转={fn} 精确率={prec:.3f} 召回={rec:.3f}")
        for kind, p, s in sorted(errors, key=lambda x: -abs(x[1] - 0.5)):
            print(f"  {kind} p={p:.3f} [{s['seg']}] {s['text'][:24]} ({s['family']})")

    # 阈值扫描（误转优先压零）
    print("\n阈值扫描(test): threshold fp fn")
    for th in (0.5, 0.7, 0.8, 0.9, 0.95):
        _, fp, _, fn, _ = evaluate(w, test_set, th)
        print(f"  {th:.2f}  fp={fp} fn={fn}")

    # 固定验收集（codex 调研报告口径，与训练/测试集独立）
    ACCEPT = [
        ("我对结果十分满意", "十", "K"), ("解一道二元一次方程", "二", "K"),
        ("每天一日三餐要规律", "一", "K"), ("这是三位一体的改革", "三", "K"),
        ("一次性付款", "一", "K"), ("二次函数", "二次", "K"),
        ("一起", "一", "K"), ("一共", "一", "K"), ("十二生肖", "十二", "K"),
        ("他把事情一五一十地说了", "一五一十", "K"), ("他总是三心二意", "三", "K"), ("他说一不二", "一", "K"),
        ("买了三个苹果", "三", "C"), ("十五个", "十五", "C"),
        ("一共一千二百三十四块", "一千二百三十四", "C"),
        ("二零二六年11月5日", "二零二六", "C"),
        ("三点一四", "三点一四", "C"), ("下午三点十五分", "三", "C"),
        ("二十楼", "二十", "C"), ("第二条", "第二", "C"),
        ("五公里", "五", "C"), ("一百米", "一百", "C"),
    ]
    ok = bad = 0
    for text, seg, want in ACCEPT:
        start = text.index(seg)
        p = predict(w, dict(text=text, start=start, end=start + len(seg)))
        pred = "C" if p >= 0.5 else "K"
        mark = "✓" if pred == want else "✗"
        if pred == want:
            ok += 1
        else:
            bad += 1
        print(f"  {mark} {text} [{seg}] want={want} p={p:.3f}")
    print(f"验收集: {ok}/{ok+bad}")

if __name__ == "__main__":
    main()
