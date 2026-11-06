# -*- coding: utf-8 -*-
"""最终训练 + 资源导出：assets/itn/{itn-model.bin, itn-lexicon.bin}。

流程：build.py 产出的 train/test + verdict.py 开放面 → 全量训练逻辑
回归（带 bias）→ 导出大端二进制（DataInputStream） + JVM 对拍金样（golden_features.json）。
指标在切分集上报告留档（生产权重用全量训练）。

用法：python3 export_model.py   （在 scripts/itn-train/ 下，先跑 build.py）
"""
import json
import math
import random
import struct
import sys

from train import featurize, sigmoid  # 特征/哈希与 Kotlin 对拍版同源

SLOTS = 1 << 18

def train_lr(samples, epochs=60, lr=0.15, l2=1e-6, seed=7):
    w = [0.0] * SLOTS
    b = 0.0
    rng = random.Random(seed)
    order = list(range(len(samples)))
    feats = [featurize(s) for s in samples]
    ys = [1.0 if s["label"] == "C" else 0.0 for s in samples]
    for _ in range(epochs):
        rng.shuffle(order)
        for idx in order:
            z = b + sum(w[h] for h in feats[idx])
            p = sigmoid(z)
            g = p - ys[idx]
            b -= lr * g
            for h in feats[idx]:
                w[h] -= lr * (g + l2 * w[h])
    return w, b

def export_model(w, b, path):
    items = [(i, val) for i, val in enumerate(w) if abs(val) > 1e-9]
    with open(path, "wb") as f:
        f.write(struct.pack(">IIIf", 0x49544E31, SLOTS, len(items), b))  # DataInputStream 大端
        for i, val in items:
            f.write(struct.pack(">If", i, val))
    return len(items)

def export_lexicon(lex_path, out_path):
    words = []
    for line in open(lex_path, encoding="utf-8"):
        w, _, f = line.rstrip().partition("\t")
        if w:
            words.append((w, int(f)))
    words.sort()
    with open(out_path, "wb") as f:
        f.write(struct.pack(">II", 0x49544C31, len(words)))
        for w, freq in words:
            bs = w.encode("utf-8")
            f.write(struct.pack(">H", len(bs)))
            f.write(bs)
            f.write(struct.pack(">I", freq))
    return len(words)

def export_golden(samples, path):
    """对拍金样：特征串列表 + hash（Kotlin ItnClassifierGoldenTest 用）。"""
    out = []
    from train import extract
    for s in samples:
        feats = extract(s["text"], s["start"], s["end"])
        from train import hash_feature
        out.append({
            "text": s["text"], "start": s["start"], "end": s["end"],
            "features": feats,
            "hashes": [hash_feature(f) for f in feats],
        })
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

def main():
    sys.path.insert(0, ".")
    from verdict import verdict, OPEN
    train_all = [json.loads(l) for l in open("train.jsonl", encoding="utf-8")]
    test_all = [json.loads(l) for l in open("test.jsonl", encoding="utf-8")]

    # 指标留档：切分集开放面
    def open_set(rows):
        return [s for s in rows if verdict(s["text"], s["start"], s["end"]) == OPEN]

    tr_open, te_open = open_set(train_all), open_set(test_all)
    w_eval, b_eval = train_lr(tr_open)
    tp = fp = tn = fn = 0
    for s in te_open:
        z = b_eval + sum(w_eval[h] for h in featurize(s))
        pred = "C" if sigmoid(z) >= 0.5 else "K"
        if pred == s["label"]:
            tp = tp + 1 if pred == "C" else tp
            tn = tn + 1 if pred == "K" else tn
        else:
            fp = fp + 1 if pred == "C" else fp
            fn = fn + 1 if pred == "K" else fn
    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    print(f"开放面 eval: train={len(tr_open)} test={len(te_open)} "
          f"精确率={prec:.3f} 召回={rec:.3f} (fp={fp} fn={fn})")

    # 生产权重：全量开放面训练
    all_open = tr_open + te_open
    w, b = train_lr(all_open, epochs=80)
    n = export_model(w, b, "../../app/src/main/assets/itn/itn-model.bin")
    m = export_lexicon("lexicon.txt", "../../app/src/main/assets/itn/itn-lexicon.bin")
    print(f"model: {n} features  lexicon: {m} words")
    export_golden(te_open[:6] + tr_open[:4], "../../app/src/test/resources/itn/golden_features.json")
    print("golden: 10 samples")

if __name__ == "__main__":
    main()
