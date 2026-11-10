package com.feelime.ime.engine

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

    /** #98：雾凇 tencent 表声明 `columns: [text, weight]`（无码列，词条
     *  靠 librime 编译期 encoder 注音）。旧逻辑把第二列权重"100"当编码
     *  判（非字母恒 fail）→ ratio=0，整表被排除出双拼/T9 子伞。 */
    @Test
    fun codelessColumnDictIsPinyinTable() {
        val noCode = File.createTempFile("tencent", ".dict.yaml").apply {
            writeText(
                """# Rime dictionary
# encoding: utf-8
---
name: tencent
version: "1"
sort: by_weight
columns:
  - text
  - weight
...
交叉熵	100
傀儡皇帝	100
菜谱设计	100
""",
            )
            deleteOnExit()
        }
        assertEquals(-1, BaseDictInstaller.dictCodeColumn(noCode))
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(noCode, syllables, 100), 1e-9)
        // 有码表（无 columns 声明）默认第二列不变。
        assertEquals(1, BaseDictInstaller.dictCodeColumn(dict("你\tni\t1")))
    }

    /** codex 一轮 P2：inline list、列表内注释/空行/引号、显式重排列序。 */
    @Test
    fun codeColumnParsesAllYamlListForms() {
        fun tmp(content: String) = File.createTempFile("dict", ".yaml").apply {
            writeText(content); deleteOnExit()
        }
        // inline 无码：columns: [text, weight]
        val inlineNoCode = tmp(
            "# Rime dictionary\n---\nname: a\nversion: \"1\"\ncolumns: [text, weight]\n...\n词\t100\n")
        assertEquals(-1, BaseDictInstaller.dictCodeColumn(inlineNoCode))
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(inlineNoCode, syllables, 100), 1e-9)
        // inline 重排：码在第三列（你\t100\tni）。
        val inlineReordered = tmp(
            "# Rime dictionary\n---\nname: b\nversion: \"1\"\ncolumns: [text, weight, code]\n...\n你\t100\tni\n")
        assertEquals(2, BaseDictInstaller.dictCodeColumn(inlineReordered))
        assertEquals(1.0, BaseDictInstaller.pinyinCodeRatio(inlineReordered, syllables, 100), 1e-9)
        // 多行列表内注释/空行不得中断解析（codex P2：半截列表误判无码
        // 会把形码表当拼音表）。
        val commented = tmp(
            "# Rime dictionary\n---\nname: c\nversion: \"1\"\ncolumns:\n  - text\n" +
                "  # 编码列\n\n  - code\n  - weight\n...\n那\tnaxy\t100\n")
        assertEquals(1, BaseDictInstaller.dictCodeColumn(commented))
        assertEquals(0.0, BaseDictInstaller.pinyinCodeRatio(commented, syllables, 100), 1e-9)
        // 带引号的列表项。
        val quoted = tmp(
            "# Rime dictionary\n---\nname: d\nversion: \"1\"\ncolumns:\n  - \"text\"\n  - 'weight'\n...\n词\t100\n")
        assertEquals(-1, BaseDictInstaller.dictCodeColumn(quoted))
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

    @Test
    fun nonPinyinHintThresholdIsStrictlyBelow() {
        // codex P2-4：阈值约定严格小于。恰好 0.5 的拼音系码表（占比
        // 踩线）不算形码；未检测(-1)/builtin/未建成不下发提示。
        assertEquals(0.4999, BaseDictInstaller.nonPinyinHint("custom", true, 0.4999f)!!, 1e-3)
        assertEquals(0.49, BaseDictInstaller.nonPinyinHint("custom", true, 0.49f)!!, 1e-3)
        assertNull("exactly at the threshold is NOT a shape-code table",
            BaseDictInstaller.nonPinyinHint("custom", true, 0.5f))
        assertNull(BaseDictInstaller.nonPinyinHint("custom", true, 0.51f))
        assertNull("probe not run stays silent",
            BaseDictInstaller.nonPinyinHint("custom", true, -1f))
        assertNull(BaseDictInstaller.nonPinyinHint("builtin", true, 0.1f))
        assertNull("built product missing stays silent",
            BaseDictInstaller.nonPinyinHint("custom", false, 0.1f))
    }
}
