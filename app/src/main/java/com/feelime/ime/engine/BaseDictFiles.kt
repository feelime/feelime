package com.feelime.ime.engine

/**
 * issue #23 基底词库导入：设备端编译现场的 yaml 生成（纯字符串逻辑，
 * JVM 可单测）。全部文件只在编译期写进 `files/rime-user/`，maintenance
 * 完成后由 [BaseDictInstaller] 删除——运行时的 rime-user 不携带这些源。
 *
 * 三个产出：
 * - umbrella `luna_pinyin.dict.yaml`：name 保持 luna_pinyin（所有 schema
 *   引用同一词典名），import_tables 指向用户源（放 user 根的
 *   `rime-dict-source/`，与 host 构建的 `cn_dicts/` 相对布局同构）。
 * - 模糊音 31 变体 schema：从 shared 的 `luna_pinyin_fuzzy.schema.yaml`
 *   模板改写 algebra 段 + schema_id 变体化（`luna_pinyin_fuzzy_m{N}`），
 *   编译产物即 `luna_pinyin_fuzzy_m{N}.prism.bin`，与
 *   [EngineDataStore.fuzzySchemaId] 的物化命名精确匹配。规则集与
 *   `scripts/generate-fuzzy-prisms.py` 一致（那套是本逻辑的 Python 原型）。
 * - 最小 `default.yaml`：仅 schema_list——maintenance 的 SchemaListUpdate
 *   以它驱动编译清单（shared 目录没有 default.yaml，编译后即删，
 *   运行时不会读到）。
 */
object BaseDictFiles {

    /** 用户源在 user 根下的落位（librime 的 import_tables 相对 user 根解析）。 */
    const val SOURCE_DIR = "rime-dict-source"
    const val SOURCE_FILE = "source.dict.yaml"
    const val UMBRELLA_FILE = "luna_pinyin.dict.yaml"
    const val DEFAULT_FILE = "default.yaml"

    /** 五组模糊规则（FuzzyPinyin 的位定义；双向 derive；与 Python 原型一致）。 */
    private val GROUPS = listOf(
        1 to listOf("derive/^([zcs])h/\$1/", "derive/^([zcs])([^h])/\$1h\$2/"),
        2 to listOf("derive/^n/l/", "derive/^l/n/"),
        4 to listOf("derive/^f/h/", "derive/^h/f/"),
        8 to listOf("derive/^r/l/", "derive/^l/r/"),
        16 to listOf(
            "derive/ang\$/an/", "derive/an\$/ang/",
            "derive/eng\$/en/", "derive/en\$/eng/",
            "derive/ing\$/in/", "derive/in\$/ing/",
        ),
    )
    private val KNOWN_FUZZY = GROUPS.flatMap { it.second }.toSet()
    private const val ABBREV_ANCHOR = "abbrev/"

    const val MASK_MIN = 1
    const val MASK_MAX = 31

    /** 维护期要重编的 schema 清单：严格全拼 + 模糊音 31 变体 + 双拼四方案 + T9。
     *  笔画不在列——stroke 词典与拼音基底无关，shared 预编译产物继续用。 */
    val COMPILE_SCHEMAS: List<String> =
        listOf("luna_pinyin") +
            (MASK_MIN..MASK_MAX).map { "${FuzzyPinyin.SCHEMA_ID}_m$it" } +
            listOf(
                "ziranma_double_pinyin", "double_pinyin_flypy",
                "double_pinyin_sogou", "double_pinyin_ziguang",
                "luna_pinyin_t9",
            )

    fun umbrellaYaml(sourceSha: String, lineCount: Int): String = buildString {
        append("# Rime dictionary\n# encoding: utf-8\n")
        append("# issue #23: user-imported base dictionary (device-compiled).\n")
        append("# name MUST stay luna_pinyin - every schema references it.\n")
        append("---\n")
        append("name: luna_pinyin\n")
        append("version: \"user-$sourceSha\"\n")
        append("sort: by_weight\n")
        append("import_tables:\n")
        append("  - $SOURCE_DIR/${SOURCE_FILE.removeSuffix(".dict.yaml")}\n")
        append("...\n")
        // lineCount 记进注释，便于诊断（用户源多少词条）。
        append("# source entries: $lineCount\n")
    }

    fun defaultYaml(): String = buildString {
        append("# issue #23 compile-time schema list - deleted after maintenance.\n")
        append("config_version: \"feelime-base-dict-1\"\n")
        append("schema_list:\n")
        COMPILE_SCHEMAS.forEach { append("  - schema: $it\n") }
    }

    /** 变体 schema：algebra 段整段重写 + schema_id 与 translator/prism
     *  变体化。prism 名决定编译产物名（schema_id 不参与）——31 个变体
     *  必须各自 `prism: luna_pinyin_fuzzy_m{N}` 才能产出物化机制期望的
     *  `_mN.prism.bin`（codex review P1-2；Python 原型是编完逐个改名，
     *  这里在 schema 里一次到位）。模板自带 m19 组合的模糊规则，剔除后
     *  按 mask 重插（Python 原型同法）。 */
    fun variantSchema(template: String, mask: Int): String {
        require(mask in MASK_MIN..MASK_MAX) { "mask out of range: $mask" }
        val algebra = algebraFor(spellerAlgebra(template), mask)
        val body = algebra.joinToString("\n") { "    - \"$it\"" }
        val start = template.indexOf("  algebra:")
        require(start >= 0) { "template lacks an algebra section" }
        val end = template.indexOf("\n  alphabet:", start)
        require(end > start) { "template lacks the alphabet anchor" }
        val rewritten = template.substring(0, start) +
            "  algebra:\n" + body + template.substring(end)
        val variantId = "${FuzzyPinyin.SCHEMA_ID}_m$mask"
        return rewriteLine(rewritten, "schema_id", variantId)
            .let { rewriteLine(it, "prism", variantId) }
    }

    /** 改写段内 2 空格缩进的单值行（schema_id/prism；只动第一个匹配）。 */
    private fun rewriteLine(text: String, key: String, value: String): String {
        val regex = Regex("""^(\s*$key:\s*)\S.*$""", RegexOption.MULTILINE)
        val match = regex.find(text)
            ?: throw IllegalArgumentException("template lacks a $key line")
        return text.substring(0, match.range.first) +
            match.groupValues[1] + value + text.substring(match.range.last + 1)
    }

    /** 提取 speller: 段内的 algebra 列表项（编译形态 yaml 是 4 空格缩进）。 */
    internal fun spellerAlgebra(template: String): List<String> {
        val rules = mutableListOf<String>()
        var inSpeller = false
        for (line in template.lines()) {
            if (line.startsWith("speller:")) {
                inSpeller = true
                continue
            }
            if (inSpeller && line.isNotEmpty() && !line[0].isWhitespace()) break
            if (inSpeller) {
                val s = line.trim()
                if (s.startsWith("- ")) {
                    rules.add(s.removePrefix("- ").trim().trim('"'))
                }
            }
        }
        return rules
    }

    /** 按 mask 重插模糊规则（插在 abbrev 行之前——m19 现有形态的顺序）。 */
    internal fun algebraFor(baseAlgebra: List<String>, mask: Int): List<String> {
        val fuzzy = GROUPS.filter { mask and it.first != 0 }.flatMap { it.second }
        val out = mutableListOf<String>()
        var inserted = false
        for (rule in baseAlgebra) {
            if (rule in KNOWN_FUZZY) continue
            if (!inserted && rule.startsWith(ABBREV_ANCHOR)) {
                out.addAll(fuzzy)
                inserted = true
            }
            out.add(rule)
        }
        if (!inserted) out.addAll(fuzzy)
        return out
    }
}
