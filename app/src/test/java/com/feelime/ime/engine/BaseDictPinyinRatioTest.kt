package com.feelime.ime.engine

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * #37 码表域检测：换装通道只支持拼音系码表（查询走拼音 prism，码列
 * 必须能切成音节序列）。小鹤音形「四码唯一」这类形码/音形码表导入
 * 后「那/看/来」打不出——只有恰与拼音音节同形的码能命中。检测函数
 * 抽样统计可切占比，低于阈值即持续提示支持域。
 */
class BaseDictPinyinRatioTest {
    private val syllables = setOf(
        "a", "ai", "an", "ang", "ao",
        "na", "nuo", "kan", "lai", "le", "li", "ma", "ni", "hao", "de",
        "zhang", "zang", "shi", "chi", "zhi", "xi", "an", "xin",
        "zhong", "guo",
    )

    private fun dict(vararg rows: String): File =
        File.createTempFile("dict", ".yaml").apply {
            writeText(buildString {
                append("# Rime dictionary\n---\nname: test\nversion: \"1\"\n...\n")
                rows.forEach { append(it).append('\n') }
            })
            deleteOnExit()
        }

    @Test
    fun pinyinDictIsFullySegmentable() {
        val f = dict(
            "你\tni\t1",
            "你好\tni hao\t2",
            "张\tzhang\t1",
            "脏\tzang\t1",
        )
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100), 1e-9)
    }

    @Test
    fun shapeCodedDictScoresLow() {
        // 小鹤音形「四码唯一」形态：声韵 + 形码部件（xy 等非音节尾巴）。
        val f = dict(
            "那\tnaxy\t1",
            "看\tkkfj\t1",
            "来\tlaip\t1",
            "的\tdgts\t1",
        )
        val ratio = BaseDictInstaller.pinyinCodeRatio(f, syllables, 100)
        assertEquals("component tails never segment into syllables", 0.0, ratio, 1e-9)
    }

    @Test
    fun mixedDictLandsBetweenThresholds() {
        // 半拼音半形码：占比 0.5，恰好压线（提示阈值为 < 0.5）。
        val f = dict(
            "你\tni\t1",
            "好\thao\t1",
            "那\tnaxy\t1",
            "看\tkkfj\t1",
        )
        assertEquals(0.5, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100), 1e-9)
    }

    @Test
    fun yamlHeaderAndCommentsAreSkipped() {
        val f = dict("你\tni\t1")
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100), 1e-9)
    }

    @Test
    fun emptyDictionaryDefaultsToSegmentable() {
        val f = dict()
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100), 1e-9)
    }

    @Test
    fun samplingIsSpreadAcrossTheWholeFile() {
        // 均匀采样（codex R1 P2）：只取前缀时「头部全拼+尾部形码」的表
        // 会整体漏检——步长采样必须覆盖尾部。
        val rows = (1..4000).map { "你\tni\t$it" } + (1..4000).map { "那\tnaxy\t$it" }
        val f = dict(*rows.toTypedArray())
        val ratio = BaseDictInstaller.pinyinCodeRatio(f, syllables, 100, totalLines = 8000)
        assertTrue("tail shape codes must be sampled, got $ratio", ratio < 0.9)
    }

    @Test
    fun tabbedCommentAndHeaderLinesAreSkipped() {
        // 带 Tab 的注释/YAML 头混进词条区时不进分母。
        val f = dict(
            "# comment\twith\ttabs",
            "你\tni\t1",
        )
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100, totalLines = 2), 1e-9)
    }

    @Test
    fun longSyllableChainsStaySegmentable() {
        // zhongguo = zhong+guo：完整切分不该被段长上限误杀。
        val f = dict("中国\tzhongguo\t1")
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(f, syllables, 100), 1e-9)
    }
}
