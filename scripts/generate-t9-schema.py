#!/usr/bin/env python3
"""Generate engine-data/rime/luna_pinyin_t9.schema.yaml from luna_pinyin.

T9 九宫格 v2（方向滑动消歧）：每个音节拥有全部「确认字母/通配数字」混合
拼写形态——点按数字键发数字（整组通配，abc→2 …），方向滑动发确定字母。
实现：首/末字母保护规则 × 26 级联（每条把一个字母替换成大写绕过后续
xlit，级联组合覆盖任意位置的 2^k 保护组合；重复字母的首个出现靠首匹
配规则），再 xlit 小写→数字、大写→小写还原。最终 alphabet = a-z + 2-9，
librime 音节图对混合输入原生枚举切分。coverage_patches() 模拟级联断言
全部音节的 2^k 投影覆盖，缺口（含模拟盲区）补显式 derive。

形态量级：424 音节 × 平均 2^3.2 ≈ 4.7k 拼写，prism ~140KB（纯数字版
11KB）——方向滑动消歧的代价，一次性加载可接受。

【坑】algebra 列表项必须 2 空格缩进（与 `algebra:` 平级）；4 空格缩进
（YAML 合法）会让 rime_deployer 静默 exit=1（2026-09-13 spike 实录）。

用法：generate-t9-schema.py [--compile]
  无 --compile：只生成 schema.yaml
  --compile   ：再用 pinned rime_deployer 编译 prism.bin，拷入 assets 并
                重算 MANIFEST.json 两文件的 bytes+sha256（checkEngineArtifacts
                会在构建期审计一致性）

T9 模糊音（issue #73，扩展全拼模糊到九宫格）：
  --fuzzy <mask> 生成单个模糊变体：schema_id=luna_pinyin_t9_fuzzy、
                algebra 在保护级联之前注入 mask 对应的模糊组行（与
                generate-fuzzy-prisms.py 的 GROUPS 同源，须保持一致），
                编译产物 luna_pinyin_t9_fuzzy_m{mask}.prism.bin 进 assets
                与 MANIFEST（运行时由 EngineDataStore 物化为
                luna_pinyin_t9_fuzzy.prism.bin——同全拼模糊的变体机制）。
                mask=0 时另写部署模板 luna_pinyin_t9_fuzzy.schema.yaml
                （algebra 含全五组；仅供 select_schema 加载配置与 custom
                基底补编做模板，运行时不重编）。
  --fuzzy-all    mask 1..31 全矩阵循环（每个都走 --fuzzy <mask> 路径）。
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

# T9 模糊音（issue #73）：五组位定义与 FuzzyPinyin.kt / generate-fuzzy-prisms.py
# 同源——三处须保持一致（新增分组时同步三方 + 设置页）。
FUZZY_SCHEMA = "luna_pinyin_t9_fuzzy"
FUZZY_TEMPLATE_DST = pathlib.Path(
    f"app/src/main/assets/engine-data/rime/{FUZZY_SCHEMA}.schema.yaml")
FUZZY_GROUPS = [
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


def fuzzy_rules(mask: int) -> list:
    return [rule for bit, rules in FUZZY_GROUPS if mask & bit for rule in rules]
# 词库换装/重编现场与 pinned deployer 可用环境变量覆盖。SHARED 不设
# 默认值（1.4.7 事故实录：历史默认现场 ~/tmp/fv-t9-hybrid/shared 的
# dict 源已随换装实验漂移，编出的 prism 与随包 table 的 syllable_id
# 静默错位，f364→fo，运行时无任何报错）——必须显式指向随包 table 的
# 编译现场（scripts/research/build-cmake-native-engines.sh 产出的
# $work/rime-data/shared），配套性由 table_paired 门兜底校验。
DEPLOYER = pathlib.Path(os.environ.get(
    "FEELIME_T9_DEPLOYER",
    str(pathlib.Path.home() / "tmp/pinned/build-host/librime/bin/rime_deployer")))
_shared_env = os.environ.get("FEELIME_T9_SHARED")
if not _shared_env:
    raise SystemExit(
        "FEELIME_T9_SHARED is required: point it at the compile scene that "
        "built the shipped luna_pinyin.table.bin "
        "(scripts/research/build-cmake-native-engines.sh: $work/rime-data/shared)")
SHARED = pathlib.Path(_shared_env)
TABLE_DST = pathlib.Path("app/src/main/assets/engine-data/rime/luna_pinyin.table.bin")

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
    table = pathlib.Path("scripts/data/luna_pinyin.table.txt")
    out = []
    for line in table.read_text(encoding="utf-8").splitlines():
        m = re.match(r"# - ([a-z]+)\s*$", line)
        if m:
            out.append(m.group(1))
        elif out and not line.startswith("#"):
            break
    # 完整性防护（codex #95 review）：解析静默漏项会让 erase 白名单缺
    # 音节、真丢输入能力——数量地板 + 哨兵音节（含显式覆盖规则特殊
    # 音节 junding）不符直接报错，不做静默降级。
    missing = {"a", "ai", "an", "ang", "zhong", "junding"} - set(out)
    if len(out) < 400 or missing:
        raise SystemExit(
            f"syllabary parse looks broken: {len(out)} syllables, missing {sorted(missing)}")
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


def domain_filter_rule(syllables: list) -> str:
    """#95 T9 编码域过滤：algebra 第一行 erase「不在音节表内的编码」。

    大词库导入（如雾凇 full ≈192 万词条）时英文词条的字母编码会混进
    syllabary（librime 对「音节」无拼音合法性校验，EntryCollector 按码
    列空格拆分后逐单元收集）。T9 保护级联对每个编码做 2^k 展开——仅
    rime-ice en 表 18,380 个纯小写英文编码就派生 359 万拼写形态，编译
    RSS 爬到 6.9GB 被系统杀（58c3bcc 的 60 万词条门实际是被英文污染
    的测量，中文词条数与 T9 prism 大小基本无关——prism 输入是去重音
    节表而非词条）。
    在级联之前把非音节编码 erase 掉：英文编码在 T9 下本来就不该可达
    （内置 T9 的 prism 就只有 424 音节），零功能损失；被滤词条仍留在
    table（全拼等其余 schema 照常命中）。
    """
    alt = "|".join(syllables)
    return f"erase/^(?!(?:{alt})$).+$/"


def hybrid_speller(patches: list, fuzzy: list = None) -> str:
    head = (
        "speller:\n"
        "  # 混合拼写（docs/design/t9.md §1）：首/末字母保护级联 + xlit 成数字\n"
        "  # + 大写还原。列表项缩进必须与 algebra: 平级（2 空格），见文件头说明。\n"
        "  alphabet: abcdefghijklmnopqrstuvwxyz23456789\n"
        "  delimiter: \" '\"\n"
        "  algebra:\n"
    )
    # 编码域过滤（#95）必须先于一切派生——fuzzy/protect 只应作用于合法
    # 音节，英文长编码不该进入级联。
    filter_lines = f'  - "{domain_filter_rule(syllabary())}"\n'
    # 模糊行必须在保护级联之前：protect 把字母大写化后（ZH≠zh），模糊
    # 正则不再命中——音节容错只在纯小写音节形态上派生。
    fuzzy_lines = "".join(f'  - "{r}"\n' for r in (fuzzy or []))
    rule_lines = "".join(f'  - "derive/{p}/{r}/"\n' for p, r in protect_rules())
    patch_lines = "".join(f'  - "{p}"\n' for p in patches)
    return (head + filter_lines + fuzzy_lines + rule_lines + patch_lines
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


def table_paired(work_build: pathlib.Path) -> bool:
    """配套门（1.4.7 事故）：deployer 编 T9 系 schema 时会同场编出
    luna_pinyin.table.bin。prism 里的 syllable_id 编号与 table 的音节表
    耦合，现场 dict 源漂移后编号静默错位（f364→fo，运行时零报错，
    32 个 prism 全军覆没）。同场 table 与随包逐字节一致才算配套。"""
    built = work_build / "luna_pinyin.table.bin"
    if not built.is_file():
        print(f"scene pairing check: {built} missing (deployer produced no table)",
              file=sys.stderr)
        return False
    if built.read_bytes() != TABLE_DST.read_bytes():
        print(
            "scene pairing check FAILED: deployer-built luna_pinyin.table.bin "
            "differs from the shipped one — FEELIME_T9_SHARED points at a scene "
            "whose dict source drifted from the shipped dictionary. prism from "
            "this scene would misnumber every syllable (silent wrong-word "
            "regression). Rebuild the scene with "
            "scripts/research/build-cmake-native-engines.sh and retry.",
            file=sys.stderr)
        return False
    return True


def compile_variant(schema_text: str, schema_name: str, prism_out: pathlib.Path) -> int:
    """在临时现场编译单个变体 schema，产物 rename 后拷入 assets 并进 MANIFEST。

    与 compile_prism 同款调用形态（deployer --compile <schema> . SHARED build），
    只是 schema 文本与产物名参数化。"""
    if not DEPLOYER.exists():
        print(f"deployer missing: {DEPLOYER}", file=sys.stderr)
        return 1
    work = pathlib.Path(tempfile.mkdtemp(prefix="t9-fuzzy-"))
    (work / "build").mkdir()
    schema_file = work / schema_name
    schema_file.write_text(schema_text, encoding="utf-8")
    r = subprocess.run(
        [str(DEPLOYER), "--compile", schema_name, ".", str(SHARED), "build"],
        cwd=work, capture_output=True, text=True, timeout=1200)
    built = work / "build" / (schema_name.replace(".schema.yaml", ".prism.bin"))
    if r.returncode != 0 or not built.is_file():
        print(f"compile failed rc={r.returncode}\n{r.stdout[-400:]}\n{r.stderr[-400:]}",
              file=sys.stderr)
        shutil.rmtree(work, ignore_errors=True)
        return 1
    if not table_paired(work / "build"):
        shutil.rmtree(work, ignore_errors=True)
        return 1
    shutil.copy2(built, prism_out)
    print(f"prism: {prism_out.name} = {prism_out.stat().st_size} bytes")
    manifest_add(prism_out)
    shutil.rmtree(work, ignore_errors=True)
    return 0


def manifest_add(path: pathlib.Path) -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    key = str(path.relative_to(path.parents[1]))
    data["files"][key] = {"bytes": path.stat().st_size, "sha256": sha256(path)}
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")


def generate_fuzzy_variant(mask: int, with_template: bool) -> int:
    """生成 T9 模糊变体（issue #73）。

    mask>0：变体 schema（algebra 只含 mask 的模糊组）编译出
    luna_pinyin_t9_fuzzy_m{mask}.prism.bin。with_template 时另写部署模板
    luna_pinyin_t9_fuzzy.schema.yaml（algebra 含全五组、prism 字段指向
    物化目标名 luna_pinyin_t9_fuzzy）——select_schema 加载配置用。"""
    text = SRC.read_text(encoding="utf-8")
    start = text.index("speller:")
    end = text.index("switches:")
    patches = coverage_patches(syllabary(), protect_rules())
    # 模板恒用全五组（自定义基底补编按 mask 过滤的源）；变体才按 mask。
    full_rules = fuzzy_rules(31)
    rules = fuzzy_rules(mask if mask > 0 else 31)
    if with_template:
        template_text = (text[:start]
                         + hybrid_speller(patches, full_rules) + "\n" + text[end:])
        template_text = template_text.replace(
            "alphabet: zyxwvutsrqponmlkjihgfedcba",
            "alphabet: abcdefghijklmnopqrstuvwxyz23456789")
        template_text = template_text.replace(
            "schema_id: luna_pinyin\n", f"schema_id: {FUZZY_SCHEMA}\n")
        template_text = template_text.replace(
            "translator:\n  dictionary: luna_pinyin\n",
            "translator:\n  dictionary: luna_pinyin\n"
            f"  prism: {FUZZY_SCHEMA}\n")
        FUZZY_TEMPLATE_DST.write_text(template_text, encoding="utf-8")
        manifest_add(FUZZY_TEMPLATE_DST)
        print(f"wrote {FUZZY_TEMPLATE_DST} (full 5 groups)")
    if mask <= 0:
        return 0
    text = text[:start] + hybrid_speller(patches, rules) + "\n" + text[end:]
    text = text.replace("alphabet: zyxwvutsrqponmlkjihgfedcba",
                        "alphabet: abcdefghijklmnopqrstuvwxyz23456789")
    text = text.replace("schema_id: luna_pinyin\n", f"schema_id: {FUZZY_SCHEMA}\n")
    # 变体的 schema_id 与 prism 都带 _m{N} 后缀（与全拼 variantSchema
    # 同款：SchemaUpdate 按 schema_id 定位 deployed config，不带后缀会
    # 找不到而静默跳过编译——日志定罪实录）。
    variant = f"{FUZZY_SCHEMA}_m{mask}"
    variant_text = text.replace(
        "translator:\n  dictionary: luna_pinyin\n",
        "translator:\n  dictionary: luna_pinyin\n"
        f"  prism: {variant}\n")
    variant_text = variant_text.replace(f"schema_id: {FUZZY_SCHEMA}\n",
                                        f"schema_id: {variant}\n")
    schema_name = f"{variant}.schema.yaml"
    if "--no-compile" not in sys.argv:
        return compile_variant(variant_text, schema_name,
                               PRISM_DST.parent / f"{variant}.prism.bin")
    print(f"[dry] variant algebra rules = {len(rules)}")
    return 0


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
    if not table_paired(work / "build"):
        shutil.rmtree(work, ignore_errors=True)
        return 1
    shutil.copy2(prism, PRISM_DST)
    print(f"prism: {PRISM_DST.stat().st_size} bytes")
    update_manifest()
    shutil.rmtree(work, ignore_errors=True)
    return 0


def main() -> int:
    # T9 模糊变体（issue #73）优先分流：--fuzzy <mask> / --fuzzy-all。
    for i, arg in enumerate(sys.argv):
        if arg == "--fuzzy":
            return generate_fuzzy_variant(int(sys.argv[i + 1]), with_template=True)
        if arg == "--fuzzy-all":
            for mask in range(1, 32):
                print(f"== fuzzy mask {mask} ==")
                rc = generate_fuzzy_variant(mask, with_template=(mask == 1))
                if rc != 0:
                    return rc
            return 0
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
