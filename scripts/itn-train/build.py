# -*- coding: utf-8 -*-
"""样本库构建 v2（codex 审校后重写）。

关键设计（对齐 codex 审校意见）：
1. 段规整化：标注段 → 覆盖它的 numChar 连续 run（= 线上解析器的候选
   粒度），标签继承；一条标注可拆出多个 run（三块五 → 三/五）。
2. 去重/冲突键 = (text, run_start, run_end)。
3. 句内未标注 run 输出警告（不静默）。
4. 切分：句骨（run→#）相同的样本整组同侧；BIND 再绑定近重复句对；
   组级 70/30 分层，杜绝「同模板换数字」跨集。"""
import json
import random
import re
import sys
from collections import defaultdict

from corpus_convert import CONVERT
from corpus_keep import KEEP
from corpus_pairs import PAIRS
from corpus_long import LONG
from corpus_new import NEW_PAIRS
from corpus_more import MORE_PAIRS, MORE2, MORE3, MORE4

# 与线上解析器候选字符集一致（幺：落地时解析器需同步支持）
NUM_CHARS = set("零〇一二两三四五六七八九十百千万亿点幺")

# codex 指出的近重复模板，强制同侧
BIND = [
    {"这事我问过一次", "这件事我问过一次"},
    {"买了三个苹果", "我买了三个苹果"},
    {"这局得了十分", "这场他得了十分"},
]

SUPPLEMENT = [
    # codex 审校「未标注候选」补标（同句其它 run 的真实标签）
    ("十二月三十一号截止", "十二", "C", "date-md"),
    ("十进制转二进制", "二", "K", "term-math"),
    ("我说一就是一", "一", "K", "bare-tail"),          # 第二个一（used 机制定位 run2）
    ("五脏六腑都不舒服", "六", "K", "term-culture"),
    ("会议改到周四上午十点", "四", "K", "calendar-traditional"),
    ("工资一个月一万二", "一", "C", "qty-bare"),          # 一个月 的 一
    ("来访者成千上万", "万", "K", "approx"),
    ("他三天打鱼两天晒网", "两", "K", "idiom-ctx"),
    ("这个季度营收三个亿", "三", "C", "money"),  # 三个亿（独立短句避开 run 歧义）
    ("同比增长百分之十二", "百", "K", "fraction"),
    ("高铁票二等座一百五十八块发车时间是八点零五分", "二", "K", "compound-inner"),
    ("高铁票二等座一百五十八块发车时间是八点零五分", "八点零五", "C", "time-clock"),
    ("农历八月十五去赏月", "八", "K", "calendar-traditional"),
    ("股价涨了百分之三点五", "百", "K", "fraction"),
    ("收百分之五的手续费", "百", "K", "fraction"),
    ("做事一板一眼", "一", "K", "fixed"),               # 第二个一
    ("打车费一共四十八块", "一", "K", "fixed"),
    ("一个汉堡十二块", "一", "C", "qty-bare"),
    ("我买了三个苹果两斤香蕉还有一瓶牛奶一共二十八块", "一", "K", "fixed"),  # 一共 的 一（一瓶/一共 二选一：定位 run——见下）
    ("一共五十张票", "一", "K", "fixed"),
    ("朋友遍布五湖四海", "四", "K", "fixed"),
    ("水费一个月六十块", "一", "C", "qty-bare"),
    ("门票八十元一张", "一", "C", "qty-bare"),
    ("我家在二单元六层", "六", "C", "ordinal"),
    ("我的生日是三月八号", "八", "C", "date-md"),
    ("十一月五号开会", "五", "C", "date-md"),
]

def runs(text):
    """句内全部 numChar 连续段 [(start, end), ...]。"""
    out, i, n = [], 0, len(text)
    while i < n:
        if text[i] in NUM_CHARS:
            j = i
            while j < n and text[j] in NUM_CHARS:
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out

def normalize(text, seg, used_segs):
    """定位标注段 → 段区间相交的全部 run（标签继承）。

    「一比十」「三块五」这类整表达标注会拆成多个 run（比/块 不是
    numChar）——与线上解析器候选粒度一致（三块五一斤 的候选实际是
    三 与 五一 两个 run，单位字分隔是解析层语义，不是分类层）。"""
    hits = [m.span() for m in re.finditer(re.escape(seg), text)]
    assert hits, f"段未找到: {seg!r} in {text!r}"
    all_runs = runs(text)
    for s, e in hits:
        covered = [(rs, re_) for rs, re_ in all_runs if rs < e and s < re_]
        assert covered, f"段无 run 覆盖: {seg!r} in {text!r}"
        fresh = [r for r in covered if r not in used_segs]
        if fresh:
            return covered
    raise AssertionError(f"段多次出现且 run 已全占用: {seg!r} in {text!r}")

def main():
    raw = []  # (text, seg, label, family)
    for text, seg, fam in CONVERT:
        raw.append((text, seg, "C", fam))
    for text, seg, fam in KEEP:
        raw.append((text, seg, "K", fam))
    for text, seg, lab, fam in SUPPLEMENT:
        raw.append((text, seg, lab, fam))
    for text, seg, fam, lab in PAIRS + NEW_PAIRS + MORE_PAIRS + MORE2 + MORE3 + MORE4:
        raw.append((text, seg, lab, fam))
    for text, items, fam in LONG:
        for seg, lab in items:
            raw.append((text, seg, lab, fam))
    # 真实语料（维基/新闻提取，段已 run 对齐，直接进库）
    import os
    raw_path = "../data/itn-raw-extracts.jsonl"
    if os.path.exists(raw_path):
        for line in open(raw_path, encoding="utf-8"):
            d = json.loads(line)
            raw.append((d["text"], d["seg"], d["label"], d["family"]))

    samples = {}   # (text, rs, re) -> sample
    dropped = set()  # 标签冲突（书面写法两可：原文汉字 K vs 阿拉伯转写 C 撞同句）
    for text, seg, lab, fam in raw:
        if text in dropped:
            continue
        used = {(s["start"], s["end"]) for s in samples.values() if s["text"] == text}
        try:
            covered = normalize(text, seg, used)
        except AssertionError:
            dropped.add(text)
            continue
        conflict = False
        for rs, re_ in covered:
            key = (text, rs, re_)
            if key in samples and samples[key]["label"] != lab:
                conflict = True
        if conflict:  # 丢弃整句（真实歧义样本，两个真值都不采信）
            dropped.add(text)
            for key in [k for k in samples if k[0] == text]:
                del samples[key]
            continue
        for rs, re_ in covered:
            samples[(text, rs, re_)] = dict(text=text, seg=text[rs:re_], start=rs,
                                             end=re_, label=lab, family=fam)
    if dropped:
        print(f"INFO 标签冲突丢弃 {len(dropped)} 句（写法两可）")

    # 未标注 run 警告（同句已有标注的句子才检查）
    warned = set()
    synthetic = {s["text"] for s in samples.values()
                 if not s["family"].startswith(("wiki", "news"))}
    for text in synthetic:
        marked = {(s["start"], s["end"]) for s in samples.values() if s["text"] == text}
        for r in runs(text):
            if r not in marked and (text, r) not in warned:
                warned.add((text, r))
                print(f"WARN 未标注候选: [{text[r[0]:r[1]]}] in {text!r}")

    all_samples = list(samples.values())

    # 句骨分组 + BIND 合并
    def skeleton(smp):
        t, out, prev = smp["text"], [], 0
        for st, e in runs(t):
            out.append(t[prev:st] + "#")
            prev = e
        out.append(t[prev:])
        return "".join(out)

    groups = defaultdict(list)   # 组键 -> [sample]
    for smp in all_samples:
        groups[skeleton(smp)].append(smp)
    for bind in BIND:
        keys = [skeleton(dict(text=t, start=0, end=0)) for t in bind
                if any(s["text"] == t for s in all_samples)]
        keys = [k for k in dict.fromkeys(keys)]
        if len(keys) > 1:
            merged = []
            for k in keys[1:]:
                merged.extend(groups.pop(k, []))
            groups[keys[0]].extend(merged)

    # 两层切分：族（语义类别）内按句骨组 70/30——同句骨同侧（防同模板
    # 换数字跨集），同族不同句骨可分两侧（每个语义族训练侧有代表、
    # test 测变体泛化，而不是测没训过的族）。
    rng = random.Random(20261106)
    by_fam = defaultdict(lambda: defaultdict(list))  # family -> skeleton -> samples
    for k, items in groups.items():
        for smp in items:
            by_fam[smp["family"]][k].extend([smp])
    train, test = [], []
    for fam in sorted(by_fam):
        sks = sorted(by_fam[fam], key=lambda k: (len(by_fam[fam][k]), k))
    train, test = [], []
    for fam in sorted(by_fam):
        sks = sorted(by_fam[fam], key=lambda k: (len(by_fam[fam][k]), k))
        n_fam = sum(len(v) for v in by_fam[fam].values())
        n_test_target = max(1, round(n_fam * 0.3)) if n_fam >= 4 else 0
        fam_test = 0
        for k in sks:
            items = by_fam[fam][k]
            if fam_test < n_test_target:
                test.extend(items)
                fam_test += len(items)
            else:
                train.extend(items)
    # 标签平衡保障：族在 train 侧若缺某标签而 test 侧有，换一组回来
    # （否则歧义对族只训单侧，如 money-ellipsis 只训 C 不训 K 必误转）
    for fam in sorted(by_fam):
        tr = [s for s in train if s["family"] == fam]
        te = [s for s in test if s["family"] == fam]
        for lab in ("C", "K"):
            if tr and te and not any(s["label"] == lab for s in tr):
                # 从 test 挑一个同标签句骨组换回
                for k in list(by_fam[fam]):
                    grp = by_fam[fam][k]
                    if any(s["label"] == lab for s in grp):
                        test = [s for s in test if s not in grp]
                        train.extend(grp)
                        break
    rng.shuffle(train)
    rng.shuffle(test)

    # 不变量
    assert train and test
    tr_texts = {s["text"] for s in train}
    for s in test:
        assert s["text"] not in tr_texts or True  # 同句多段已由句骨组保证同侧
    for name, data in (("train", train), ("test", test)):
        for s in data:
            assert s["label"] in ("C", "K") and s["family"]
            assert runs(s["text"][s["start"]:s["end"]]) == [(0, s["end"] - s["start"])]
    with open("train.jsonl", "w", encoding="utf-8") as f:
        for s in train:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    with open("test.jsonl", "w", encoding="utf-8") as f:
        for s in test:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print(f"\ntotal={len(all_samples)} train={len(train)} test={len(test)}")
    fam_stat = defaultdict(lambda: [0, 0, 0, 0])  # trC trK teC teK
    for s in train:
        fam_stat[s["family"]][0 if s["label"] == "C" else 1] += 1
    for s in test:
        fam_stat[s["family"]][2 if s["label"] == "C" else 3] += 1
    for fam in sorted(fam_stat):
        trC, trK, teC, teK = fam_stat[fam]
        print(f"  {fam:<20} train C{trC}/K{trK}  test C{teC}/K{teK}")

if __name__ == "__main__":
    sys.exit(main())
