#!/usr/bin/env python3
"""Generate the T9 syllable index and inline it into keyboard.js.

数据源：luna_pinyin.table.txt——头部 `# - <syllable>` 音节表（424 条）+
正文 `词\t读音\t词频` 行（词频来自词典编译产物，与 APK 内词典同源）。
产出「数字串 → 音节」正向索引（T9 布局 xlit，组内按词频降序）+
「音节 → 词频」权重表（键盘侧跨前缀长度全局排序、读音重建用）+
「首音节数字串 → 声母」前缀层（左列候选条要展示 m/n 这类未完成读法，
docs/design/t9.md §3）。内联进 keyboard.js 的生成标记块——不新增资产
文件（热更包/打包器/KeyboardAssetStore 都是四文件硬编码）。

用法：generate-t9-syllables.py   （幂等，重跑替换标记块）
"""
import pathlib
import re
import sys

TABLE = pathlib.Path("scripts/data/luna_pinyin.table.txt")
KEYBOARD = pathlib.Path("app/src/main/assets/keyboard/keyboard.js")

XLIT = str.maketrans("abcdefghijklmnopqrstuvwxyz", "22233344455566677778889999")
# 声母表（未完成音节前缀层；zh/ch/sh 是双字母声母，数字串按首字母计——
# 前缀层只提示「还没打完」，具体展开交给完整音节层）。
INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h",
            "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s", "y", "w"]

BEGIN = "// BEGIN GENERATED T9_SYLLABLE_INDEX"
END = "// END GENERATED T9_SYLLABLE_INDEX"


def main() -> int:
    syllables = []
    weight = {}
    # 词频有整数/小数/科学计数（了 le 1.49585e+06、的 de 4.82148e+06，
    # codex round-2 P2-3：漏掉的全是最高频音节）。
    entry = re.compile(r"^\S+\t([a-z ]+)\t([\d.]+(?:e[+-]?\d+)?)\s*$", re.I)
    for line in TABLE.read_text(encoding="utf-8").splitlines():
        m = re.match(r"# - ([a-z]+)\s*$", line)
        if m:
            syllables.append(m.group(1))
            continue
        if syllables and not line.startswith("#"):
            e = entry.match(line)
            if e:
                # 多字词的读音按段拆开，词频记到每个出现的音节头上
                # （取最大值——「你」972978 就是这么来的）。词频有小数
                # （如 哦 o 16231.4，873 条），按浮点读（codex round-4 P2-6）。
                reading, w = e.group(1), float(e.group(2))
                for syl in reading.split():
                    if weight.get(syl, 0) < w:
                        weight[syl] = w
    if len(syllables) < 400 or len(weight) < 400:
        print(f"table parse suspicious: {len(syllables)} syllables, "
              f"{len(weight)} weighted", file=sys.stderr)
        return 1

    full = {}
    for s in sorted(syllables, key=lambda s: -weight.get(s, 0)):
        full.setdefault(s.translate(XLIT), []).append(s)
    pre = {}
    for ini in INITIALS:
        pre.setdefault(ini.translate(XLIT), []).append(ini)

    import json
    payload = json.dumps(
        {"full": full, "pre": pre, "w": weight},
        ensure_ascii=False, separators=(",", ":"))
    block = (f"{BEGIN}\n"
             f"    // 由 scripts/generate-t9-syllables.py 生成：数字串 → 音节\n"
             f"    // （组内按词典词频降序）+ 音节词重表 + 声母前缀层\n"
             f"    // （{len(syllables)} 音节，源 luna_pinyin.table.txt）。\n"
             f"    const T9_SYLLABLE_INDEX = {payload};\n"
             f"    {END}\n")

    text = KEYBOARD.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n", re.S)
    if pattern.search(text):
        text = pattern.sub(block, text)
        action = "replaced"
    else:
        # 挂在 FULL_PINYIN_SYLLABLES 定义之后（同属键盘侧拼音静态数据）。
        anchor = text.index("const FULL_PINYIN_SYLLABLES")
        line_end = text.index("\n", text.index(";", anchor))
        text = text[:line_end + 1] + "\n" + block + text[line_end + 1:]
        action = "inserted"
    KEYBOARD.write_text(text, encoding="utf-8")
    top = full.get("64", [])
    print(f"{action} T9_SYLLABLE_INDEX: {len(syllables)} syllables, "
          f"{len(full)} digit keys, {len(weight)} weighted, "
          f"{len(payload)} bytes payload; 64 -> {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
