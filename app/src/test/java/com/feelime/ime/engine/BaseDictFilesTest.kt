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
        val yaml = BaseDictFiles.umbrellaYaml("abcdef123456", 4321)
        assertTrue(yaml.contains("name: luna_pinyin"))
        assertTrue(yaml.contains("import_tables:"))
        assertTrue(yaml.contains("  - rime-dict-source/source"))
        assertTrue(yaml.contains("user-abcdef123456"))
        assertTrue(yaml.contains("# source entries: 4321"))
    }

    @Test
    fun defaultListsEveryRecompiledSchema() {
        val yaml = BaseDictFiles.defaultYaml()
        // 1 luna + 31 fuzzy variants + 4 double pinyin + 1 t9 = 37.
        val schemas = Regex("- schema: (\\S+)").findAll(yaml).map { it.groupValues[1] }.toList()
        assertEquals(37, schemas.size)
        assertEquals("luna_pinyin", schemas.first())
        assertEquals("luna_pinyin_fuzzy_m1", schemas[1])
        assertEquals("luna_pinyin_fuzzy_m31", schemas[31])
        assertTrue("luna_pinyin_t9" in schemas)
        assertTrue("ziranma_double_pinyin" in schemas)
        assertTrue("feelime_stroke" !in schemas) // 笔画不重编，shared 产物继续用
    }

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
