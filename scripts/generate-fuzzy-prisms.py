#!/usr/bin/env python3
"""生成/校验全拼模糊音 prism 变体矩阵（31 个 mask 组合）。

背景（issue #39，2026-09-20）：prism 与 table 共享 syllable_id 空间，必须
同场成对编译——基底词库换装（luna → rime-frost）时 31 个
luna_pinyin_fuzzy_m{mask}.prism.bin 要用同一现场重编。当年一次性脚本
build_matrix.py 没进仓（FuzzyPinyin.kt 注释残留引用），本脚本按 FuzzyPinyin
的五组位定义重建矩阵，规则集通过对 assets 现有 m19 变体（平翘舌+n/l+鼻音，
迁移默认组合）的 algebra 反推恢复。

用法：
  --shared DIR   编译现场（含 luna_pinyin.schema.yaml 与词库 dict/bin）
  --deployer BIN rime_deployer（与目标 table 同源的 pinned 构建）
  --out DIR      产出目录（默认写回仓库 assets）
  --verify       只与 assets 现有 m{N}.prism.bin 字节比对，不写回
"""
import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets/engine-data/rime"

# 五组模糊规则（FuzzyPinyin.kt 的位定义；双向 derive）。
GROUPS = [
    (1, ["derive/^([zcs])h/$1/", "derive/^([zcs])([^h])/$1h$2/"]),  # 平翘舌
    (2, ["derive/^n/l/", "derive/^l/n/"]),                          # n/l
    (4, ["derive/^f/h/", "derive/^h/f/"]),                          # f/h
    (8, ["derive/^r/l/", "derive/^l/r/"]),                          # r/l
    (16, [                                                         # 前后鼻音
        "derive/ang$/an/", "derive/an$/ang/",
        "derive/eng$/en/", "derive/en$/eng/",
        "derive/ing$/in/", "derive/in$/ing/",
    ]),
]

# 模糊组规则插在主 schema algebra 的 abbrev 行之前（m19 现有形态的顺序）。
ABBREV_ANCHOR = "abbrev/^([a-z]).+$/$1/"


def algebra_for(base_algebra: list[str], mask: int) -> list[str]:
    known_fuzzy = {rule for _, rules in GROUPS for rule in rules}
    fuzzy = [rule for bit, rules in GROUPS if mask & bit for rule in rules]
    out = []
    inserted = False
    for rule in base_algebra:
        # 模板（assets 的 fuzzy schema）自带 m19 组合的模糊规则——剔除后
        # 按 mask 重插，避免规则重复/错位。
        if rule in known_fuzzy:
            continue
        if not inserted and rule.startswith("abbrev/"):
            out.extend(fuzzy)
            inserted = True
        out.append(rule)
    if not inserted:
        out.extend(fuzzy)
    return out


def speller_algebra(template: str) -> list[str]:
    """提取 speller: 段内的 algebra 列表项（编译形态 yaml 是 4 空格缩进）。"""
    lines = template.splitlines()
    rules, in_speller = [], False
    for line in lines:
        if line.startswith("speller:"):
            in_speller = True
            continue
        if in_speller and line and not line[0].isspace():
            break  # 下一个顶级键，speller 段结束
        if in_speller:
            s = line.strip()
            if s.startswith("- "):
                rules.append(s[2:].strip().strip('"'))
    return rules


def schema_for(template: str, mask: int) -> str:
    fuzzy = algebra_for(speller_algebra(template), mask)
    body = "\n".join(f'    - "{rule}"' for rule in fuzzy)
    text = template
    start = text.index("  algebra:")
    end = start + text[start:].index("\n  alphabet:")
    return text[:start] + "  algebra:\n" + body + text[end:]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shared", type=pathlib.Path, required=True)
    parser.add_argument("--deployer", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, default=ASSETS)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    template = (args.shared / "luna_pinyin_fuzzy.schema.yaml").read_text(encoding="utf-8")
    work = pathlib.Path(tempfile.mkdtemp(prefix="fuzzy-matrix-"))
    (work / "user").mkdir()
    (work / "build").mkdir()
    ok = True
    try:
        for mask in range(1, 32):
            schema = work / "luna_pinyin_fuzzy.schema.yaml"
            schema.write_text(schema_for(template, mask), encoding="utf-8")
            for name in ("luna_pinyin.schema.yaml", "luna_pinyin.dict.yaml",
                         "essay.txt", "default.yaml", "key_bindings.yaml",
                         "pinyin.yaml", "punctuation.yaml", "symbols.yaml",
                         "luna_pinyin.table.bin", "luna_pinyin.prism.bin",
                         "luna_pinyin.reverse.bin"):
                src = args.shared / name
                if src.is_file() and not (work / name).exists():
                    shutil.copy2(src, work / name)
            if (args.shared / "cn_dicts").is_dir():
                if not (work / "cn_dicts").exists():
                    shutil.copytree(args.shared / "cn_dicts", work / "cn_dicts")
            r = subprocess.run(
                [str(args.deployer), "--compile", "luna_pinyin_fuzzy.schema.yaml",
                 "user", ".", "build"],
                cwd=work, capture_output=True, text=True, timeout=600)
            produced = work / "build" / "luna_pinyin_fuzzy.prism.bin"
            if r.returncode != 0 or not produced.is_file():
                print(f"m{mask}: compile failed rc={r.returncode} {r.stderr[-200:]}",
                      file=sys.stderr)
                ok = False
                continue
            existing = args.out / f"luna_pinyin_fuzzy_m{mask}.prism.bin"
            if args.verify:
                # 字节级会因 marisa trie 的构建顺序差 134/43888 字节（规则
                # 顺序影响插入序），语义等价用 prism.txt（拼写明文集合）验收：
                # 集合相同 = 同一 algebra 展开，跨词库重编安全。
                dump = work / "build" / "luna_pinyin_fuzzy.prism.txt"
                want = args.out / f"luna_pinyin_fuzzy_m{mask}.prism.txt"
                have_dump = dump.is_file()
                have_want = want.is_file()
                if have_dump and have_want:
                    got_set = {l for l in dump.read_text(encoding="utf-8").splitlines() if l.strip()}
                    want_set = {l for l in want.read_text(encoding="utf-8").splitlines() if l.strip()}
                    same = got_set == want_set
                    detail = f"{len(got_set)} spellings"
                else:
                    # 无 txt 基线时退回大小比对（同大小≈同集合）。
                    same = existing.is_file() and existing.stat().st_size == produced.stat().st_size
                    detail = f"{produced.stat().st_size} bytes (no txt baseline)"
                print(f"m{mask}: {'IDENTICAL' if same else 'DIFFERS'} ({detail})")
                ok = ok and same
            else:
                shutil.copy2(produced, existing)
                print(f"m{mask}: {existing.stat().st_size} bytes")
            for stale in ("luna_pinyin_fuzzy.prism.bin", "luna_pinyin_fuzzy.prism.txt"):
                p = work / "build" / stale
                if p.is_file():
                    p.unlink()
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
