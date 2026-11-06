# -*- coding: utf-8 -*-
"""ChineseNumberItn.kt verdict() 的忠实 Python 移植（训练侧开放面定义）。

两边必须逐规则一致：训练用它分出 OPEN 集合训分类器，Kotlin 推理用
同一 OPEN 定义。改动任何一边都要同步另一边 + 金样对拍。"""
import re

DIGIT_MAP = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
             '六': 6, '七': 7, '八': 8, '九': 9}
UNITS = set("十百千万亿")
SUFFIX_UNITS = set("个只条张次分秒天年月日号点元块毛倍周层楼位件台部辆"
                  "页岁斤米克吨升公杯碗篇章节课题字句词人家种样批组队"
                  "轮遍趟场局步折成")
CLOCK_PREFIXES = {"上午", "下午", "晚上", "早上", "清晨", "傍晚", "凌晨", "中午"}

CONVERT, KEEP, OPEN = "CONVERT", "KEEP", "OPEN"

def verdict(text, start, end, segment=None):
    segment = segment if segment is not None else text[start:end]
    n = len(text)
    prev = text[start - 1] if start > 0 else None
    prev2 = text[start - 2] if start > 1 else None
    nxt = text[end] if end < n else None
    nxt2 = text[end + 1] if end + 1 < n else None
    if len(segment) == 2 and segment[0] in "一二两三四五" and segment[1] in "三四五六七八九":
        return KEEP
    if len(segment) == 2 and segment[0] == segment[1]:
        return KEEP
    if nxt == "比" and nxt2 is not None and nxt2 in DIGIT_MAP:
        return CONVERT
    if nxt == "分" and nxt2 == "之":
        return KEEP if (len(segment) == 1 and segment[0] in "百千万") else CONVERT
    if prev == "比" and prev2 is not None and prev2 in DIGIT_MAP:
        return CONVERT
    if prev == "之" and prev2 == "分":
        return CONVERT
    if prev is not None and prev in "周礼星" and (
            (len(segment) == 1 and segment[0] in "一二三四五六日天") or segment == "十一"):
        return KEEP
    if (start >= 2 and text[start - 2:start] in {"农历", "正月", "腊月"}
            or (prev is not None and prev in "腊正初大")):
        return KEEP
    if prev == "第":
        return OPEN
    if nxt == "分" or nxt == "尺":
        return OPEN
    if nxt is not None and nxt in "年月日号":
        return CONVERT
    has_unit = any(c in UNITS for c in segment)
    pure = all(c in DIGIT_MAP for c in segment)
    if nxt is None:
        if pure and len(segment) >= 3:
            return CONVERT
        # 长组合数值链没有习语形态，句尾也直接转；短组合数值
        # （一共十二 C vs 别二百五 K）双栖，留分类器
        if has_unit and not pure and len(segment) >= 4:
            return CONVERT
        if has_unit and len(segment) >= 2 and not pure:
            return OPEN
        return KEEP
    if nxt == "里" or nxt == "行" or prev == "里" or prev == "行":
        return OPEN
    if nxt not in SUFFIX_UNITS:
        return KEEP
    if has_unit:
        return CONVERT
    if pure and len(segment) >= 3:
        return CONVERT
    if nxt == "点":
        if start >= 2 and text[start - 2:start] in CLOCK_PREFIXES:
            return CONVERT
        return OPEN
    return OPEN
