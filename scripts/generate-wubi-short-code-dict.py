#!/usr/bin/env python3
"""Expand the audited Wubi source with ranked one-to-three-code candidates.

librime's predictive table lookup walks longer codes in table order before
applying entry weights. For Wubi that makes a short code such as `ip` surface
rare three-code characters before common completions such as `学习`. This
transform adds bounded exact-code aliases for every one-to-three-letter prefix:

* a one-letter prefix starts with the canonical Wubi 86 level-one character;
* a two/three-letter prefix keeps exact-code entries first;
* remaining candidates are ranked by source weight.

The aliases only exist in the host-compiled runtime table. The audited base
dictionary remains `scripts/data/wubi86.dict.yaml` and stays out of the APK.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import pathlib
import sys


PRIORITY_PREFIX_LENGTHS = (1, 2, 3)
PRIORITY_CANDIDATES_PER_PREFIX = 32
PRIORITY_WEIGHT_BASE = 10_000_000

# 王码五笔字型 86 一级简码。Explicit ordering is required because some
# secondary component characters share the same one-letter table code.
LEVEL1_SHORT_CODES = {
    "a": "工",
    "b": "了",
    "c": "以",
    "d": "在",
    "e": "有",
    "f": "地",
    "g": "一",
    "h": "上",
    "i": "不",
    "j": "是",
    "k": "中",
    "l": "国",
    "m": "同",
    "n": "民",
    "o": "为",
    "p": "这",
    "q": "我",
    "r": "的",
    "s": "要",
    "t": "和",
    "u": "产",
    "v": "发",
    "w": "人",
    "x": "经",
    "y": "主",
}


def read_dictionary(path: pathlib.Path) -> tuple[list[str], list[tuple[str, str, int]]]:
    header: list[str] = []
    rows: list[tuple[str, str, int]] = []
    in_body = False
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not in_body:
            header.append(line)
            in_body = line == "..."
            continue
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) != 3:
            raise ValueError(f"{path}:{line_number}: expected text/code/weight columns")
        text, code, raw_weight = fields
        try:
            weight = int(raw_weight)
        except ValueError as error:
            raise ValueError(f"{path}:{line_number}: invalid weight {raw_weight!r}") from error
        rows.append((text, code, weight))
    if not in_body:
        raise ValueError(f"{path}: missing dictionary body marker")
    return header, rows


def rank_candidates(
    prefix: str,
    candidates: list[tuple[str, str, int]],
) -> list[tuple[str, str, int]]:
    if len(prefix) == 1 and (level_one := LEVEL1_SHORT_CODES.get(prefix)):
        primary = sorted(
            (row for row in candidates if row[0] == level_one),
            key=lambda row: (-row[2], len(row[1]), row[1], row[0]),
        )
        if not primary:
            raise ValueError(f"level-one short code {prefix!r} ({level_one}) missing")
        rest = (row for row in candidates if row[0] != level_one)
        ordered = primary + sorted(
            rest,
            key=lambda row: (-row[2], len(row[1]), row[1], row[0]),
        )
    else:
        exact = sorted(
            (row for row in candidates if row[1] == prefix),
            key=lambda row: (-row[2], row[0]),
        )
        longer = sorted(
            (row for row in candidates if row[1] != prefix),
            key=lambda row: (-row[2], len(row[1]), row[1], row[0]),
        )
        ordered = exact + longer

    ranked: list[tuple[str, str, int]] = []
    seen_text: set[str] = set()
    for row in ordered:
        if row[0] in seen_text:
            continue
        seen_text.add(row[0])
        ranked.append(row)
        if len(ranked) >= PRIORITY_CANDIDATES_PER_PREFIX:
            break
    return ranked


def render(path: pathlib.Path) -> tuple[str, int, int]:
    header, rows = read_dictionary(path)
    best = {(text, code): weight for text, code, weight in rows}
    by_prefix: dict[str, list[tuple[str, str, int]]] = defaultdict(list)
    for row in rows:
        text, code, weight = row
        for length in PRIORITY_PREFIX_LENGTHS:
            if len(code) >= length:
                by_prefix[code[:length]].append(row)

    for prefix in sorted(by_prefix):
        for rank, (text, _code, _weight) in enumerate(rank_candidates(prefix, by_prefix[prefix])):
            best[(text, prefix)] = PRIORITY_WEIGHT_BASE - rank

    rendered = "\n".join(
        header + [f"{text}\t{code}\t{weight}" for (text, code), weight in best.items()]
    ) + "\n"
    return rendered, len(rows), len(best) - len(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=pathlib.Path("scripts/data/wubi86.dict.yaml"),
        type=pathlib.Path,
    )
    parser.add_argument("--output", required=True, type=pathlib.Path)
    args = parser.parse_args()

    rendered, source_entries, added_entries = render(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(
        f"wrote {args.output} ({source_entries + added_entries} entries; "
        f"{added_entries} short-code aliases)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
