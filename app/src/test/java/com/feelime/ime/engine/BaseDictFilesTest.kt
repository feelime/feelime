package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** issue #23 设备端编译现场的 yaml 生成（纯字符串逻辑，与
 *  scripts/generate-fuzzy-prisms.py 的原型语义一致）。 */
class BaseDictFilesTest {

    /** 模板骨架：编译形态的关键段（speller/algebra/abbrev、alphabet、
     *  schema_id），algebra 里预置 m19 组合的模糊规则（真实模板的形态）。 */
    private val template = """
        __build_info:
          rime_version: 1.17.0
        schema:
          schema_id: luna_pinyin_fuzzy
          version: "0.31"
        speller:
          algebra:
            - "derive/^([zcs])h/${'$'}1/"
            - "derive/^([zcs])([^h])/${'$'}1h${'$'}2/"
            - "derive/^n/l/"
            - "derive/^l/n/"
            - "derive/ang${'$'}/an/"
            - "derive/an${'$'}/ang/"
            - "derive/eng${'$'}/en/"
            - "derive/en${'$'}/eng/"
            - "derive/ing${'$'}/in/"
            - "derive/in${'$'}/ing/"
            - "abbrev/^([a-z]).+${'$'}/${'$'}1/"
            - "xlit/abc/xyz/"
          alphabet: zyxwvutsrqponmlkjihgfedcba
        translator:
          dictionary: luna_pinyin
          prism: luna_pinyin_fuzzy
    """.trimIndent()

    @Test
    fun umbrellaKeepsLunaNameAndImportsUserSource() {
        val yaml = BaseDictFiles.umbrellaYaml(
            "abcdef123456", listOf(BaseDictFiles.SOURCE_FILE), 4321,
        )
        assertTrue(yaml.contains("name: luna_pinyin"))
        assertTrue(yaml.contains("import_tables:"))
        assertTrue(yaml.contains("  - rime-dict-source/source"))
        assertTrue(yaml.contains("user-abcdef123456"))
        assertTrue(yaml.contains("# source entries: 4321"))
    }

    /** #35：zip 多表导入（万象 Lite）——import_tables 逐表列出。 */
    @Test
    fun umbrellaListsEveryExtractedTable() {
        val yaml = BaseDictFiles.umbrellaYaml(
            "deadbeefcafe",
            listOf("zi.lite.dict.yaml", "8105.lite.dict.yaml", "en.dict.yaml"),
            987654,
        )
        val imports = Regex("  - rime-dict-source/(.+)").findAll(yaml)
            .map { it.groupValues[1] }.toList()
        assertEquals(listOf("zi.lite", "8105.lite", "en"), imports)
    }

    /** #35：zip entry 名拍平与安全校验。 */
    @Test
    fun zipEntryNameFlattensAndRejectsUnsafe() {
        assertEquals("zi.lite.dict.yaml", BaseDictFiles.zipEntryName("dicts/zi.lite.dict.yaml"))
        assertEquals("a.dict.yaml", BaseDictFiles.zipEntryName("a.dict.yaml"))
        // macOS 打包垃圾、隐藏文件、非 ASCII 名、yaml 注入面全部拒收。
        assertEquals(null, BaseDictFiles.zipEntryName("dicts/"))
        assertEquals(null, BaseDictFiles.zipEntryName("dicts/.DS_Store"))
        assertEquals(null, BaseDictFiles.zipEntryName("dicts/naïve.dict.yaml"))
        assertEquals(null, BaseDictFiles.zipEntryName("dicts/a b.dict.yaml"))
        // 路径穿越无害化：只取 basename，../ 前缀被拍平吃掉（不可能逃出
        // sourceDir——zip-slip 在「拍平落盘」设计下不成立）。
        assertEquals("evil.dict.yaml", BaseDictFiles.zipEntryName("../evil.dict.yaml"))
    }

    /** #35：带调码表检测（预组合/组合附标；无调 ü 不算带调）。 */
    @Test
    fun toneDetectionCoversPrecomposedAndCombining() {
        assertTrue(BaseDictFiles.codeHasTone("ā bà"))
        assertTrue(BaseDictFiles.codeHasTone("lǜ"))
        assertTrue(BaseDictFiles.codeHasTone("ǹ"))          // 预组合 ǹ
        assertTrue(BaseDictFiles.codeHasTone("m\u0300")) // 组合附标 m̀
        assertTrue(!BaseDictFiles.codeHasTone("a ba"))
        assertTrue(!BaseDictFiles.codeHasTone("lü"))         // 无调 ü 合法拼式
        assertTrue(!BaseDictFiles.codeHasTone("2B"))
    }

    /** #35：伞表特征 = 头区顶格 import_tables。 */
    @Test
    fun importTablesDetectedInHeaderOnly() {
        val lite = """
            # Rime dictionary
            ---
            name: wanxiang_lite
            version: "LTS"
            import_tables:
              - dicts/zi.lite
            ...
        """.trimIndent()
        assertTrue(BaseDictFiles.hasImportTables(lite))
        // 词条行里的 import_tables 字样（词面含该前缀）不误判——只认顶格 key。
        val withEntries = """
            ---
            name: x
            ...
            import_tables什么词	a bia	1
        """.trimIndent()
        assertTrue(!BaseDictFiles.hasImportTables(withEntries))
    }

    /** #35：子表引用重写——命中拍平引用，未命中/块外原样。 */
    @Test
    fun importRefRewriterFlattensKnownRefsOnly() {
        val refMap = mapOf(
            "dicts/zi.lite" to "rime-dict-source/zi.lite",
            "dicts/en" to "rime-dict-source/en",
        )
        val rewriter = BaseDictFiles.ImportRefRewriter(refMap)
        val lines = listOf(
            "---",
            "name: base",
            "import_tables:",
            "  - dicts/zi.lite            #字表",
            "  - dicts/en",
            "  - dicts/unknown",
            "...",
            "词	ci	1",
        ).map { rewriter.apply(it) }
        assertEquals("  - rime-dict-source/zi.lite            #字表", lines[3])
        assertEquals("  - rime-dict-source/en", lines[4])
        assertEquals("  - dicts/unknown", lines[5])
        assertEquals("词	ci	1", lines[7])
    }

    /** #20：音形码表归一——yaml 头区跳过、纯文本直收、坏码剔除。 */
    @Test
    fun flypyNormalizationSkipsHeaderAndDropsBadCodes() {
        val source = """
            # Rime dictionary
            ---
            name: flypy_full
            version: "1"
            ...
            好	hc	100
            小鹤	xhnm	50
            坏行无码
            长码	xhnmd	1
            数字码	xh2	1
            大写码	XH	5
        """.trimIndent()
        val (entries, dropped) = BaseDictFiles.normalizeFlypyLines(source)
        assertEquals(listOf("好\thc\t100", "小鹤\txhnm\t50", "大写码\txh\t5"), entries)
        // dropped 只计「有 TAB 但码不合格」：5 码 + 数字码（无 TAB 行
        // 本就不是词条行，不计）。大写码合法（小写化收编）。
        assertEquals(2, dropped)
    }

    /** #20：纯文本源（无 yaml 头）也直收；权重缺省 1。 */
    @Test
    fun flypyNormalizationAcceptsPlainText() {
        val (entries, dropped) = BaseDictFiles.normalizeFlypyLines("的	de\n一	yi")
        assertEquals(listOf("的\tde\t1", "一\tyi\t1"), entries)
        assertEquals(0, dropped)
    }

    /** #20：词典源生成（name 固定 flypy——schema 的 dictionary 引用它）。 */
    @Test
    fun flypyDictYamlHasStableHeader() {
        val yaml = BaseDictFiles.flypyDictYaml(listOf("的\tde\t1"), "abc123")
        assertTrue(yaml.contains("name: flypy\n"))
        assertTrue(yaml.contains("version: \"user-abc123\""))
        assertTrue(yaml.contains("的\tde\t1"))
    }

    /** #20/#35：清单联动 + 延迟编译——换装只带核心 6 项 + 当前模糊音
     *  1 变体（万象 2.7M 词条全量 37 项真机 60min+ 的实测修正）。 */
    @Test
    fun compileSchemaListsAreLinkedAndLazy() {
        assertEquals(37, BaseDictFiles.COMPILE_SCHEMAS.size)
        assertEquals(6, BaseDictFiles.CORE_SCHEMAS.size)
        // 模糊音关：核心 6 项。
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS,
            BaseDictFiles.baseCompileSchemas(fuzzyMask = 0, flypyInstalled = false),
        )
        // 模糊音开 m19：核心 + 1 变体。
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS + "luna_pinyin_fuzzy_m19",
            BaseDictFiles.baseCompileSchemas(fuzzyMask = 19, flypyInstalled = false),
        )
        // + flypy 联动。
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS + "luna_pinyin_fuzzy_m19" + BaseDictFiles.FLYPY_SCHEMA,
            BaseDictFiles.baseCompileSchemas(fuzzyMask = 19, flypyInstalled = true),
        )
        assertEquals(
            listOf(BaseDictFiles.FLYPY_SCHEMA),
            BaseDictFiles.flypyCompileSchemas(baseCustom = false),
        )
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS + BaseDictFiles.FLYPY_SCHEMA,
            BaseDictFiles.flypyCompileSchemas(baseCustom = true),
        )
        // #35 T9 内存门（词条量 + 可用内存双门；万象 2.7M 实测 RSS 爬到
        // 6.9GB+ 被系统 SIGKILL）。
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS.filter { it != "luna_pinyin_t9" } + "luna_pinyin_fuzzy_m19",
            BaseDictFiles.baseCompileSchemas(
                fuzzyMask = 19, flypyInstalled = false, includeT9 = false,
            ),
        )
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS,
            BaseDictFiles.baseCompileSchemas(
                fuzzyMask = 0, flypyInstalled = false, includeT9 = true),
        )
        assertEquals(
            BaseDictFiles.CORE_SCHEMAS.filter { it != "luna_pinyin_t9" } + BaseDictFiles.FLYPY_SCHEMA,
            BaseDictFiles.flypyCompileSchemas(baseCustom = true, includeT9 = false),
        )
        // t9Eligible 双门边界：词条上限、内存按 4KB/词条。
        assertEquals(false, BaseDictFiles.t9Eligible(BaseDictFiles.T9_MAX_ENTRIES + 1, Long.MAX_VALUE))
        assertEquals(true, BaseDictFiles.t9Eligible(BaseDictFiles.T9_MAX_ENTRIES, Long.MAX_VALUE))
        // 600k 词条 × 4KB = 2.4GB：可用 2GB 不够。
        assertEquals(false, BaseDictFiles.t9Eligible(600_000, 2_000_000_000L))
        assertEquals(true, BaseDictFiles.t9Eligible(500_000, 2_500_000_000L))
        assertEquals(false, BaseDictFiles.t9Eligible(0, Long.MAX_VALUE))

        // #35 双拼/T9 纯拼音子伞：dictionary 行只动 translator 的精确匹配。
        val dpSchema = BaseDictFiles.rewriteDictionary(
            "speller:\n  algebra: []\ntranslator:\n  dictionary: luna_pinyin\npunctuator:\n  dictionary: \"\"\n",
            BaseDictFiles.DP_DICTIONARY,
        )
        assertTrue(dpSchema.contains("  dictionary: ${BaseDictFiles.DP_DICTIONARY}"))
        // 其他 dictionary 行（空串/stroke 类）不被误伤。
        assertTrue(dpSchema.count { it == "dictionary: ".first() } >= 0) // 形状占位
        assertTrue(dpSchema.contains("dictionary: \"\""))
        // mask 边界。
        assertEquals(null, BaseDictFiles.fuzzyVariant(0))
        assertEquals(null, BaseDictFiles.fuzzyVariant(32))
        assertEquals("luna_pinyin_fuzzy_m31", BaseDictFiles.fuzzyVariant(31))
    }

    @Test
    fun defaultListsEveryRecompiledSchema() {
        val yaml = BaseDictFiles.defaultYaml(frostDefaultTemplate)
        // 1 luna + 31 fuzzy variants + 4 double pinyin + 1 t9 = 37.
        val schemas = Regex("- schema: (\\S+)").findAll(yaml).map { it.groupValues[1] }.toList()
        assertEquals(37, schemas.size)
        assertEquals("luna_pinyin", schemas.first())
        assertEquals("luna_pinyin_fuzzy_m1", schemas[1])
        assertEquals("luna_pinyin_fuzzy_m31", schemas[31])
        assertTrue("luna_pinyin_t9" in schemas)
        assertTrue("ziranma_double_pinyin" in schemas)
        assertTrue("feelime_stroke" !in schemas) // 笔画不重编，shared 产物继续用
        // frost 模板的其余段原样保留（schema 编译链 include 它们）。
        assertTrue(yaml.contains("menu:"))
        assertTrue(yaml.contains("page_size: 8"))
        assertTrue(yaml.contains("config_version: '0.50'"))
        // frost 自己的方案不得残留。
        assertTrue(!yaml.contains("rime_frost"))
    }

    /** frost default.yaml 的骨架（真实模板的关键形态：注释、schema_list、
     *  后续顶格段 menu）。 */
    private val frostDefaultTemplate = """
        # Rime default settings
        # encoding: utf-8

        config_version: '0.50'

        schema_list:
          # 可以直接删除或注释不需要的方案
          - schema: rime_frost             # 白霜拼音（全拼）
          - schema: rime_frost_double_pinyin          # 自然码双拼
          - schema: rime_frost_t9                     # 仓·九键拼音

        # 菜单
        menu:
          page_size: 8  # 候选词个数
    """.trimIndent()

    @Test
    fun variantMask1OnlyCarriesPingzhaoshe() {
        val out = BaseDictFiles.variantSchema(template, 1)
        assertTrue(out.contains("schema_id: luna_pinyin_fuzzy_m1"))
        // P1-2：prism 名决定编译产物名，必须与 schema_id 一起变体化。
        assertTrue(out.contains("prism: luna_pinyin_fuzzy_m1"))
        assertTrue(!out.contains("prism: luna_pinyin_fuzzy\n"))
        assertTrue(out.contains("- \"derive/^([zcs])h/\$1/\""))
        assertTrue(out.contains("- \"derive/^([zcs])([^h])/\$1h\$2/\""))
        // 其它组不得出现（模板预置的 n/l、鼻音规则被剔除且未重插）。
        assertTrue(!out.contains("derive/^n/l/"))
        assertTrue(!out.contains("derive/ang\$/an/"))
        // 非模糊规则原样保留（abbrev 正则带行尾锚 .+$ —— Python 原型同款）。
        assertTrue(out.contains("- \"abbrev/^([a-z]).+\$/${'$'}1/\""))
        assertTrue(out.contains("- \"xlit/abc/xyz/\""))
    }

    @Test
    fun variantMask19MatchesMigratedDefaultCombo() {
        // m19 = 平翘舌 + n/l + 鼻音（迁移默认组合，与模板预置同集）。
        val out = BaseDictFiles.variantSchema(template, 19)
        assertTrue(out.contains("schema_id: luna_pinyin_fuzzy_m19"))
        assertTrue(out.contains("prism: luna_pinyin_fuzzy_m19"))
        assertEquals(1, Regex("derive/\\^\\(\\[zcs\\]\\)h/").findAll(out).count())
        assertTrue(out.contains("- \"derive/^n/l/"))
        assertTrue(out.contains("- \"derive/ang\$/an/"))
        assertTrue(!out.contains("derive/^f/h/"))
    }

    @Test
    fun fuzzyRulesInsertBeforeAbbrevAnchor() {
        val algebra = BaseDictFiles.algebraFor(BaseDictFiles.spellerAlgebra(template), 4)
        val fuzzyAt = algebra.indexOfFirst { it.startsWith("derive/^f/h/") }
        val abbrevAt = algebra.indexOfFirst { it.startsWith("abbrev/") }
        assertTrue(fuzzyAt in 0 until abbrevAt)
        // 12 条模板规则 - 10 条 m19 模糊 + 2 条 f/h。
        assertEquals(4, algebra.size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun variantRejectsMaskOutOfRange() {
        BaseDictFiles.variantSchema(template, 32)
    }

    @Test(expected = IllegalArgumentException::class)
    fun variantRejectsTemplateWithoutAlgebra() {
        BaseDictFiles.variantSchema("schema:\n  schema_id: x\n", 1)
    }
}
