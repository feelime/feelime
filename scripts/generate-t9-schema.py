#!/usr/bin/env python3
"""Generate engine-data/rime/luna_pinyin_t9.schema.yaml from luna_pinyin.

T9 九宫格 v2（方向滑动消歧）：每个音节拥有全部「确认字母/通配数字」混合
拼写形态——点按数字键发数字（整组通配，abc→2 …），方向滑动发确定字母。
实现：首/末字母保护规则 × 26 级联（每条把一个字母替换成大写绕过后续
xlit，级联组合覆盖任意位置的 2^k 保护组合；重复字母的首个出现靠首匹
配规则），再 xlit 小写→数字、大写→小写还原。最终 alphabet = a-z + 2-9，
librime 音节图对混合输入原生枚举切分。coverage_patches() 模拟级联断言
全部音节的 2^k 投影覆盖，缺口补显式 derive（当前音节表零缺口）。

形态量级：424 音节 × 平均 2^3.2 ≈ 4.7k 拼写，prism ~140KB（纯数字版
11KB）——方向滑动消歧的代价，一次性加载可接受。

【坑】algebra 列表项必须 2 空格缩进（与 `algebra:` 平级）；4 空格缩进
（YAML 合法）会让 rime_deployer 静默 exit=1（2026-09-13 spike 实录）。

用法：generate-t9-schema.py [--compile]
  无 --compile：只生成 schema.yaml
  --compile   ：再用 pinned rime_deployer 编译 prism.bin，拷入 assets 并
                重算 MANIFEST.json 两文件的 bytes+sha256（checkEngineArtifacts
                会在构建期审计一致性）
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

SRC = pathlib.Path("app/src/main/assets/engine-data/rime/luna_pinyin.schema.yaml")
DST = pathlib.Path("app/src/main/assets/engine-data/rime/luna_pinyin_t9.schema.yaml")
PRISM_DST = pathlib.Path("app/src/main/assets/engine-data/rime/luna_pinyin_t9.prism.bin")
MANIFEST = pathlib.Path("app/src/main/assets/engine-data/MANIFEST.json")
# 词库换装/重编现场与 pinned deployer 可用环境变量覆盖（默认沿用历史路径）。
DEPLOYER = pathlib.Path(os.environ.get(
    "FEELIME_T9_DEPLOYER",
    str(pathlib.Path.home() / "tmp/pinned/build-host/librime/bin/rime_deployer")))
SHARED = pathlib.Path(os.environ.get(
    "FEELIME_T9_SHARED",
    str(pathlib.Path.home() / "tmp/fv-t9-hybrid/shared")))

# 26 个字母 → 9 键位（T9 标准布局：7=PQRS，9=WXYZ）。
XLIT = "xlit/abcdefghijklmnopqrstuvwxyz/22233344455566677778889999/"
RESTORE = "xlit/ABCDEFGHIJKLMNOPQRSTUVWXYZ/abcdefghijklmnopqrstuvwxyz/"


def protect_rules() -> list:
    """首/末出现保护规则 × 26 字母：(pattern, repl) 对。

    只用贪婪的末次匹配（`^(.*)a(.*)$`）保护不了「重复字母的首个出现」
    （nan 的 n26：级联永远保护最后一次），所以每字母配首/末两条。
    级联后任意子集可达——coverage_patches() 会对全部音节模拟断言，
    缺口音节补显式 derive。
    """
    rules = []
    for c in "abcdefghijklmnopqrstuvwxyz":
        rules.append((f"^(.*){c}(.*)$", f"$1{c.upper()}$2"))
        rules.append((f"^{c}(.*)$", f"{c.upper()}$1"))
    return rules


def syllabary() -> list:
    """luna_pinyin.table.txt 头部的 `# - <syllable>` 音节表。"""
    import re
    table = pathlib.Path("app/src/main/assets/engine-data/rime/luna_pinyin.table.txt")
    out = []
    for line in table.read_text(encoding="utf-8").splitlines():
        m = re.match(r"# - ([a-z]+)\s*$", line)
        if m:
            out.append(m.group(1))
        elif out and not line.startswith("#"):
            break
    return out


def coverage_patches(syllables: list, rules: list) -> list:
    """模拟 librime 的 derive 级联 + 两条 xlit，返回缺口音节的补丁规则。

    derive = 追加变体（保留源）；xlit = 原位变换（小写→数字、大写→小写）。
    期望集合 = 每个位置独立取「字母或数字」的 2^k 投影。模拟不全的音节
    （正常音节表不应出现）逐形态补显式 derive，宁可规则多不可拼写缺。
    """
    import re as _re

    digit = {c: d for c, d in zip("abcdefghijklmnopqrstuvwxyz",
                                  "22233344455566677778889999")}
    # rime 的替换语法是 $1，Python re.sub 要 \1——直接 sub 会生成字面
    # "$1N$2" 垃圾形态，模拟集合错乱、误报海量缺口（codex round-3 P2）。
    compiled = [(_re.compile(p), r.replace("$", "\\")) for p, r in rules]
    lines = []
    for syl in syllables:
        live = {syl}
        for pattern, repl in compiled:
            live |= {pattern.sub(repl, f) for f in live if pattern.search(f)}
        projected = {"".join(
            digit[ch] if ch in digit else ch for ch in f).lower() for f in live}
        k = len(syl)
        expected = set()
        for mask in range(1 << k):
            expected.add("".join(
                syl[i] if mask >> i & 1 else digit[syl[i]] for i in range(k)))
        for t in sorted(expected - projected):
            form = "".join(
                syl[i].upper() if t[i] == syl[i] else syl[i] for i in range(k))
            lines.append(f'derive/^{syl}$/{form}/')
    return lines


def hybrid_speller(patches: list) -> str:
    head = (
        "speller:\n"
        "  # 混合拼写（docs/design/t9.md §1）：首/末字母保护级联 + xlit 成数字\n"
        "  # + 大写还原。列表项缩进必须与 algebra: 平级（2 空格），见文件头说明。\n"
        "  alphabet: abcdefghijklmnopqrstuvwxyz23456789\n"
        "  delimiter: \" '\"\n"
        "  algebra:\n"
    )
    rule_lines = "".join(f'  - "derive/{p}/{r}/"\n' for p, r in protect_rules())
    patch_lines = "".join(f'  - "{p}"\n' for p in patches)
    return (head + rule_lines + patch_lines
            + f'  - "{XLIT}"\n'
            + f'  - "{RESTORE}"\n')


def sha256(path: pathlib.Path) -> str:
    import hashlib
    return hashlib.sha256(path.read_bytes()).hexdigest()


def update_manifest() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for path in (DST, PRISM_DST):
        key = str(path.relative_to(path.parents[1]))  # engine-data/ 下的相对路径
        data["files"][key] = {
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
    MANIFEST.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"manifest updated: {DST.name}, {PRISM_DST.name}")


def compile_prism() -> int:
    if not DEPLOYER.exists():
        print(f"deployer missing: {DEPLOYER}", file=sys.stderr)
        return 1
    work = pathlib.Path(tempfile.mkdtemp(prefix="t9-compile-"))
    (work / "build").mkdir()
    shutil.copy2(DST, work / DST.name)
    r = subprocess.run(
        [str(DEPLOYER), "--compile", DST.name, ".", str(SHARED), "build"],
        cwd=work, capture_output=True, text=True, timeout=600)
    prism = work / "build" / PRISM_DST.name
    if r.returncode != 0 or not prism.is_file():
        print(f"compile failed rc={r.returncode}\n{r.stdout[-400:]}\n{r.stderr[-400:]}",
              file=sys.stderr)
        return 1
    shutil.copy2(prism, PRISM_DST)
    print(f"prism: {PRISM_DST.stat().st_size} bytes")
    update_manifest()
    shutil.rmtree(work, ignore_errors=True)
    return 0


def main() -> int:
    text = SRC.read_text(encoding="utf-8")
    # 只替换 speller 段（到 switches: 为止）——切到 translator 会把
    # switches（zh_hans 默认简体）一起删掉，新会话全部输出繁体
    # （codex round-2 P1-2 实录）。
    start = text.index("speller:")
    end = text.index("switches:")
    patches = coverage_patches(syllabary(), protect_rules())
    if patches:
        print(f"coverage patches: {len(patches)} explicit derives")
    text = text[:start] + hybrid_speller(patches) + "\n" + text[end:]
    text = text.replace("alphabet: zyxwvutsrqponmlkjihgfedcba",
                        "alphabet: abcdefghijklmnopqrstuvwxyz23456789")
    text = text.replace("schema_id: luna_pinyin\n", "schema_id: luna_pinyin_t9\n")
    text = text.replace(
        "translator:\n  dictionary: luna_pinyin\n",
        "translator:\n  dictionary: luna_pinyin\n  prism: luna_pinyin_t9\n",
    )
    DST.write_text(text, encoding="utf-8")
    print(f"wrote {DST}")
    for needle in ("luna_pinyin_t9",
                   "derive/^(.*)a(.*)$/$1A$2/",
                   "alphabet: abcdefghijklmnopqrstuvwxyz23456789",
                   RESTORE):
        print(f"  {'has' if needle in text else 'MISSING'} {needle[:44]}")
    if "--compile" in sys.argv:
        return compile_prism()
    return 0


if __name__ == "__main__":
    sys.exit(main())
