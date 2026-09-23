#!/usr/bin/env python3
"""单字→拼音音节表（issue #29-5 自造词自动注音）。

从 rime 编译产物 luna_pinyin.table.txt 提取单字条目（`字\t音节\t词频`，
多音字多条），按词频降序聚合成 {字: [音节...]} 写
app/src/main/assets/char-pinyin.json。运行时 SettingsBridge 用它把
纯中文自造词自动展开成全部全拼码列（多音字全组合，封顶）。

词表只影响候选品质不影响正确性，跟着 luna_pinyin.table.txt 变更重跑：
    python3 scripts/generate-char-pinyin.py --check  # 门禁比对
    python3 scripts/generate-char-pinyin.py          # 重生成
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / 'app/src/main/assets/engine-data/rime/luna_pinyin.table.txt'
OUT = ROOT / 'app/src/main/assets/char-pinyin.json'
# 词条上限只防异常输入；单字在 rime 词表里天然有限。
MAX_CHARS = 65536


def build():
    entries = {}  # char -> [(syllable, weight)]
    for line in TABLE.read_text(encoding='utf-8').splitlines():
        if line.startswith('#') or '\t' not in line:
            continue
        text, syllable, *rest = line.split('\t')
        if len(text) != 1 or len(syllable) > 6:
            continue
        weight = int(rest[0]) if rest and rest[0].isdigit() else 0
        entries.setdefault(text, []).append((syllable, weight))
    table = {}
    for char, pairs in entries.items():
        # 词频降序、去重；同音节取最高词频（词表本身可能多行同码）
        seen = {}
        for syllable, weight in pairs:
            seen[syllable] = max(seen.get(syllable, 0), weight)
        table[char] = [s for s, _ in sorted(seen.items(), key=lambda kv: -kv[1])]
        if len(table) >= MAX_CHARS:
            break
    return json.dumps(table, ensure_ascii=False, separators=(',', ':'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true',
                        help='compare the shipped asset instead of writing')
    args = parser.parse_args()
    text = build() + '\n'
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != text:
            raise SystemExit('char-pinyin.json differs. Run scripts/generate-char-pinyin.py')
        print(f'char-pinyin.json matches ({len(json.loads(text))} chars).')
    else:
        OUT.write_text(text, encoding='utf-8')
        print(f'wrote {OUT} ({len(json.loads(text))} chars)')


if __name__ == '__main__':
    main()
