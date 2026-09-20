package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.StringReader

/** rime .dict.yaml 导入解析（issue #37）：头部/注释/坏行过滤、码归一、
 *  去重与上限截断。 */
class DictYamlImporterTest {

    private val sample = """
        # Rime dictionary
        # encoding: utf-8
        ---
        name: mydict
        version: "1.0"
        sort: by_weight
        ...
        大学	da xue	100
        你好	ni hao
        # 注释行
        空行上一行
        坏行没有码
        缩写	nh	50
        ok的	zhong wen da xue ci dian hen chang a a a a	1
    """.trimIndent()

    @Test
    fun parsesBodySkippingHeaderAndComments() {
        val result = DictYamlImporter.parse(StringReader(sample))
        // 无 TAB 的行（头部键值/注释/坏行）静默跳过；长拼音码（≤48）合法。
        assertEquals(
            listOf(
                "大学" to "daxue", "你好" to "nihao", "缩写" to "nh",
                "ok的" to "zhongwendaxuecidianhenchangaaaa",
            ),
            result.items,
        )
        assertEquals(0, result.skipped)
        assertEquals(0, result.truncated)
    }

    @Test
    fun dedupesWithinFileAndAgainstExisting() {
        val text = "大学\tda xue\n大学\tda xue\n新词\txin ci\n"
        val result = DictYamlImporter.parse(StringReader(text), existing = setOf("新词" to "xinci"))
        assertEquals(listOf("大学" to "daxue"), result.items)
    }

    @Test
    fun rejectsBadCodesAndOversizedText() {
        val text = buildString {
            append("含空格码\tno spaces allowed here\n")   // 去空格后含非法? -> "nospacesallowedhere" 合法；改用真非法
            append("大写码\tABC\n")                        // 非 [a-z]
            append("超长词${"很".repeat(30)}\tci\n")        // text > 32
            append("超长码\t${"a".repeat(49)}\n")           // code > 48
            append("正常\tzheng chang\n")
        }
        val result = DictYamlImporter.parse(StringReader(text))
        // 大写码被 lowercase 宽容成 abc；超长词/超长码两行坏。
        assertEquals(
            listOf(
                "含空格码" to "nospacesallowedhere",
                "大写码" to "abc",
                "正常" to "zhengchang",
            ),
            result.items,
        )
        assertEquals(2, result.skipped)
    }

    @Test
    fun truncatesAtCap() {
        // 码用 26 进制字母串保证唯一（解析器只认 [a-z]）。
        fun code(n: Int): String {
            var s = ""
            var v = n
            do { s += 'a' + v % 26; v /= 26 } while (v > 0)
            return s
        }
        val lines = (1..DictYamlImporter.MAX_ENTRIES + 10).joinToString("\n") { "词$it\t${code(it)}" }
        val result = DictYamlImporter.parse(StringReader(lines))
        assertEquals(DictYamlImporter.MAX_ENTRIES, result.items.size)
        assertEquals(10, result.truncated)
        assertTrue(result.items.first() == "词1" to "b")
    }

    @Test
    fun emptyAndHeaderOnlyYieldNothing() {
        assertEquals(0, DictYamlImporter.parse(StringReader("")).items.size)
        assertEquals(
            0,
            DictYamlImporter.parse(StringReader("# only comments\n---\nname: x\n...\n")).items.size,
        )
    }
}
