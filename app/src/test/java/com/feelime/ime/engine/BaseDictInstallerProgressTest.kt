package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 导入进度模型（#95 后续：COPYING 字节比 / COMPILING 产物权重步进）。 */
class BaseDictInstallerProgressTest {
    private val expected = listOf(
        "luna_pinyin.table.bin", "luna_pinyin.prism.bin",
        "luna_pinyin_t9.prism.bin", "double_pinyin_flypy.prism.bin",
    )

    @Test
    fun productWeightsCoverFullCompileShare() {
        // table 70% + prism 8% + 其余均摊 22%，合计恰为编译段总权重。
        val sum = expected.sumOf { BaseDictInstaller.productWeight(it, expected) }
        assertEquals(1.0, sum, 1e-9)
        assertEquals(0.70, BaseDictInstaller.productWeight("luna_pinyin.table.bin", expected), 1e-9)
        assertEquals(0.08, BaseDictInstaller.productWeight("luna_pinyin.prism.bin", expected), 1e-9)
        assertEquals(0.11, BaseDictInstaller.productWeight("luna_pinyin_t9.prism.bin", expected), 1e-9)
    }

    @Test
    fun compilePercentMonotonicAndClamped() {
        val none = BaseDictInstaller.compileProgress(emptySet(), expected)
        assertEquals(15, none.getInt("percent"))
        // 0/N：不知道 librime 在编哪项，detail 不给（codex 二轮）。
        assertTrue(none.isNull("detail"))

        val tableDone = BaseDictInstaller.compileProgress(setOf("luna_pinyin.table.bin"), expected)
        assertEquals(71, tableDone.getInt("percent"))
        // detail = 未完成产物中权重最大者（均摊 0.11 > prism 0.08）。
        assertEquals("luna_pinyin_t9", tableDone.getString("detail"))

        val all = BaseDictInstaller.compileProgress(expected.toSet(), expected)
        assertEquals(95, all.getInt("percent"))
        assertEquals(4, all.getInt("done"))
        assertTrue(all.isNull("detail"))
    }

    @Test
    fun weightNormalizationCoversNonPinyinManifest() {
        // 音形清单（无 luna_pinyin 主产物，codex P2：旧公式 2/2 只到 50%）。
        val flypy = listOf("flypy.table.bin", "flypy.prism.bin")
        val half = BaseDictInstaller.compileProgress(setOf("flypy.table.bin"), flypy)
        assertEquals(55, half.getInt("percent")) // 15 + 80×0.5
        val done = BaseDictInstaller.compileProgress(flypy.toSet(), flypy)
        assertEquals(95, done.getInt("percent"))
        // 真实八件清单（含 dp 子伞表）全完成显式 95（浮点截断防 94）。
        val eight = listOf("luna_pinyin.table.bin", "luna_pinyin.prism.bin",
            "luna_pinyin_t9.prism.bin", "luna_pinyin_fuzzy_m1.prism.bin",
            "double_pinyin_flypy.prism.bin", "double_pinyin_sogou.prism.bin",
            "double_pinyin_ms.prism.bin", "luna_pinyin_dp.table.bin")
        assertEquals(95,
            BaseDictInstaller.compileProgress(eight.toSet(), eight).getInt("percent"))
    }

    @Test
    fun copyPercentScalesWithBytesAndSurvivesUnknownSize() {
        val half = BaseDictInstaller.copyProgress(50L, 100L, "base.dict.yaml")
        assertEquals(7, half.getInt("percent")) // 15% × 0.5 → 7.5 截断
        assertEquals(50L, half.getLong("done"))
        assertEquals("base.dict.yaml", half.getString("detail"))

        val unknown = BaseDictInstaller.copyProgress(50L, -1L, null)
        assertTrue(unknown.isNull("percent"))
        assertEquals(0L, unknown.getLong("total"))
        // 字节比越界钳制（压缩比估算误差容错）。
        assertEquals(15, BaseDictInstaller.copyProgress(500L, 100L, "x").getInt("percent"))
    }
}
