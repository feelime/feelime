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

    /** 编译现场的完整配置模板（assets/rime-compile/，frost 原版）。
     *  schema 编译链（ConfigBuilder + LegacyPresetConfigPlugin）要解析
     *  schema 里的 import_preset: default / symbols——最小 default.yaml
     *  只有 schema_list 会让全部 schema 的 config 构建失败（真机第三轮
     *  定罪：36 schema 报 failed to include section，build/ 里连
     *  compiled default 都没有）。模板不在 engine-data 下，运行时
     *  shared 目录不受影响。 */
    const val ASSETS_DEFAULT = "rime-compile/default.yaml"
    const val ASSETS_SYMBOLS = "rime-compile/symbols.yaml"
    const val SYMBOLS_FILE = "symbols.yaml"

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

    /** 音形码表的 schema id（issue #20）。 */
    const val FLYPY_SCHEMA = "feelime_flypy"
    const val FLYPY_DICT = "flypy.dict.yaml"
    const val FLYPY_TABLE = "flypy.table.bin"

    /** 不依赖模糊音组合的核心清单（#35 延迟编译）：主表/主 prism/
     *  双拼四方案/T9——模糊音 31 变体按需补编（见 [fuzzyVariant]）。
     *  实测背景：万象 Lite（2.73M 词条）全量 37 schema 真机（8Gen2）
     *  60min+ 未完成、模拟器 70min+ 进程被杀；31 个变体占 84% 任务量，
     *  而用户任一时刻只用一个模糊音组合。 */
    val CORE_SCHEMAS: List<String> =
        listOf("luna_pinyin") +
            listOf(
                "ziranma_double_pinyin", "double_pinyin_flypy",
                "double_pinyin_sogou", "double_pinyin_ziguang",
                "luna_pinyin_t9",
            )

    /** 模糊音变体 schema id（mask≠0 时进编译清单）。 */
    fun fuzzyVariant(mask: Int): String? =
        if (mask in 1..31) "${FuzzyPinyin.SCHEMA_ID}_m$mask" else null

    /** #35 延迟编译版换装清单：核心 6 项 + 当前模糊音组合 1 项（若开）
     *  + flypy 联动（#20：音形码表已导入时同场，见 [flypyCompileSchemas]）。
     *  其余 30 个变体在用户切换模糊音组合时按需补编（FuzzyPinyin
     *  开关链路的 ensureFuzzyVariant，见 BaseDictInstaller）。 */
    fun baseCompileSchemas(fuzzyMask: Int, flypyInstalled: Boolean): List<String> {
        val core = CORE_SCHEMAS + listOfNotNull(fuzzyVariant(fuzzyMask))
        return if (flypyInstalled) core + FLYPY_SCHEMA else core
    }

    /** 反向联动（#20 音形导入）：基底是用户自定义（产物在 staging）时
     *  核心清单同场在列（保守：staging 产物的去留不应被本次部署影响）；
     *  基底是内置（产物在 shared，maintenance 不写 shared）时只编 flypy。
     *  ⚠ custom 基底 + flypy 组合的真机行为待验收实测（变体 schema 源
     *  在基底安装成功后已被清理，SchemaUpdate 找不到源时的行为要
     *  眼见为实）。 */
    fun flypyCompileSchemas(baseCustom: Boolean): List<String> =
        if (baseCustom) CORE_SCHEMAS + FLYPY_SCHEMA else listOf(FLYPY_SCHEMA)

    /** #35：tables = 落进 [SOURCE_DIR] 的词条表文件名（zip 多表导入；
     *  单文件导入就是 [SOURCE_FILE] 一项）。import_tables 的引用名 =
     *  文件名去掉 .dict.yaml（librime 惯例）。 */
    fun umbrellaYaml(sourceSha: String, tables: List<String>, lineCount: Int): String = buildString {
        append("# Rime dictionary\n# encoding: utf-8\n")
        append("# issue #23: user-imported base dictionary (device-compiled).\n")
        append("# name MUST stay luna_pinyin - every schema references it.\n")
        append("---\n")
        append("name: luna_pinyin\n")
        append("version: \"user-$sourceSha\"\n")
        append("sort: by_weight\n")
        append("import_tables:\n")
        tables.forEach { append("  - $SOURCE_DIR/${it.removeSuffix(".dict.yaml")}\n") }
        append("...\n")
        // lineCount 记进注释，便于诊断（用户源多少词条）。
        append("# source entries: $lineCount\n")
    }

    // ---- #35：zip 多表导入的纯逻辑（JVM 可单测；IO 胶水在 Installer）----

    /** zip entry 名 → 落盘文件名（拍平到目录根）。规则：取最后一段
     *  路径成分（目录结构不保留——import_tables 引用全部重写为
     *  `rime-dict-source/<name>`），且必须匹配安全名集（字母数字开头，
     *  仅字母/数字/./_/-），否则返回 null 跳过——entry 名会进 yaml 的
     *  import_tables，放行任意串等于往 yaml 里注入。 */
    fun zipEntryName(entryName: String): String? {
        val base = entryName.substringAfterLast('/')
        fun ascii(c: Char) = c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9'
        if (base.isEmpty() || !ascii(base[0])) return null
        if (!base.all { ascii(it) || it == '.' || it == '_' || it == '-' }) return null
        return base
    }

    /** #35 带调码表检测：码列出现声调字符（含 m̀ 类组合附标）即视为
     *  带调形态。上游完整版（如万象 Base）的码列是 ā bà 形态，Lite
     *  去调后是 a ba——本检测用于「导入的疑似完整版，打不出来」的
     *  专属提示。注意不含 ü：无调 ü 是合法拼式（lü），会误报。 */
    private val TONE_MARKS = (
        "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ" +
            // 组合附标（U+0300..U+0304，如 "m" + U+0300 = m̀）：与预组合字符等价，一并计入。
            "\u0300\u0301\u0302\u0303\u0304"
        ).toSet()

    fun codeHasTone(code: String): Boolean = code.any { it in TONE_MARKS }

    /** yaml 头区（首个 `...` 行之前）是否有顶格 `import_tables:`——
     *  伞表特征（万象 Lite 包的 wanxiang_lite.dict.yaml：头区引用
     *  dicts/ 相对路径、全文零词条）。头区由调用方流式截取（有上限），
     *  这里只做纯字符串判定。 */
    fun hasImportTables(header: String): Boolean =
        header.lineSequence().any { it.startsWith("import_tables:") }

    /** content 级纯伞判定（#20 zip 源：表小全内存安全；#35 的多表大包
     *  走流式 hasImportTables + 全文扫，见 Installer）。头区截取上限
     *  200 行，防无 `...` 结束符的畸形文件。 */
    fun isPureUmbrella(content: String): Boolean {
        val header = content.lineSequence().takeWhile { it.trimEnd() != "..." }.take(200)
        if (!header.any { it.startsWith("import_tables:") }) return false
        return content.lineSequence().none { !it.startsWith("#") && it.contains('\t') }
    }

    /** 子表自带的 import_tables 引用（如 `dicts/zi.lite`）重写为拍平后的
     *  `rime-dict-source/zi.lite`——引用按 zip 内原始 entry 路径（去
     *  .dict.yaml）匹配，命中才改，未命中（引用包外资源）原样保留。
     *  逐行喂数（大表流式处理，不整读内存）；块状态机在实例内。 */
    class ImportRefRewriter(private val refMap: Map<String, String>) {
        private var inImports = false

        fun apply(line: String): String {
            val trimmed = line.trimStart()
            if (trimmed.startsWith("import_tables:")) {
                inImports = true
                return line
            }
            if (inImports && trimmed.startsWith("- ")) {
                val token = trimmed.removePrefix("- ").trim().trim('"', '\'')
                    .substringBefore('#').trim()
                val target = refMap[token] ?: refMap[token + ".dict.yaml"]
                if (target != null) return line.replaceFirst(token, target)
                return line
            }
            // 顶格非注释 key 或 `...` 结束 import_tables 块。
            if (line.isNotEmpty() && !line[0].isWhitespace() &&
                !line.startsWith("#") && trimmed != "..."
            ) inImports = false
            return line
        }
    }

    /** 以 frost 完整 default.yaml 为底，把 schema_list 段替换为本次要重编
     *  的清单（缺省 37 项；#20 音形联动时由调用方传入组合结果）。其余段
     *  （menu/navigator/selector/key_binder/…）原样保留——schema 编译链
     *  include 它们。 */
    fun defaultYaml(frostTemplate: String, schemas: List<String> = COMPILE_SCHEMAS): String {
        val start = frostTemplate.indexOf("\nschema_list:")
        require(start >= 0) { "template lacks schema_list" }
        val afterHeader = start + 1 // keep the leading \n
        // 段结束 = 下一个顶格 key（跳过缩进行/注释/空行）。
        var end = frostTemplate.length
        val topKey = Regex("""^[A-Za-z_][\w/]*:""", RegexOption.MULTILINE)
        for (match in topKey.findAll(frostTemplate, afterHeader + "schema_list:".length)) {
            end = match.range.first
            break
        }
        val ours = buildString {
            append("schema_list:\n")
            append("# issue #23 device-side rebuild list - deleted after maintenance.\n")
            schemas.forEach { append("  - schema: $it\n") }
        }
        return frostTemplate.substring(0, afterHeader) + ours +
            frostTemplate.substring(end)
    }

    /** #20 音形码表归一：用户源（rime .dict.yaml 或 词<TAB>码 纯文本）
     *  → 规范词条行列表（词\t码\t权重；权重缺省 1）。跳过 yaml 头区
     *  （--- 到 ...）、注释、无 TAB 行；码列非纯字母或超 4 码的行剔除
     *  （音形键面打不出，schema 的 auto_select 也只认 4 码）。返回
     *  (行列表, 剔除数) 便于诊断。 */
    fun normalizeFlypyLines(content: String): Pair<List<String>, Int> {
        val out = ArrayList<String>()
        var dropped = 0
        var inHeader = false
        var headerDone = false
        for (raw in content.lineSequence()) {
            val line = raw.trimEnd()
            if (!headerDone) {
                if (line == "---") {
                    inHeader = true
                    continue
                }
                if (line == "...") {
                    headerDone = true
                    continue
                }
                // 头区外先遇词条行（纯文本源没有 ---/... 包裹）也直接收。
                if (inHeader) continue
            }
            if (line.isEmpty() || line.startsWith("#") || !line.contains('\t')) continue
            val parts = line.split('\t')
            val word = parts.getOrNull(0)?.trim().orEmpty()
            val code = parts.getOrNull(1)?.trim().orEmpty()
            if (word.isEmpty() || code.isEmpty() ||
                code.length > 4 || !code.all { it in 'a'..'z' || it in 'A'..'Z' }
            ) {
                dropped++
                continue
            }
            val weight = parts.getOrNull(2)?.trim()?.takeIf { it.isNotEmpty() } ?: "1"
            out.add("$word\t${code.lowercase()}\t$weight")
        }
        return out to dropped
    }

    /** #20 音形词典源（user 根落位形态）：yaml 头 + 归一词条行。 */
    fun flypyDictYaml(entries: List<String>, sourceSha: String): String = buildString {
        append("# Rime dictionary\n# encoding: utf-8\n")
        append("# issue #20: user-imported shape-code table (device-compiled).\n")
        append("---\n")
        append("name: flypy\n")
        append("version: \"user-$sourceSha\"\n")
        append("sort: by_weight\n")
        append("...\n")
        entries.forEach { append(it).append('\n') }
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
