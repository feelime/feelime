package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 预处理与上游 preprocessing.rs 的逐值对拍：fixtures 由 Python 镜像
 * （~/tmp/xima-poc，issue #84 POC）生成，任何一侧改动都必须同步。 */
class OchwproInkTest {

    private fun fixtures(): Map<String, Map<String, Any>> {
        val text = javaClass.getResourceAsStream("/ochwpro_fixtures.json")!!
            .readBytes().decodeToString()
        val root = org.json.JSONObject(text)
        val out = mutableMapOf<String, Map<String, Any>>()
        val keys = root.keySet().asSequence().toList()
        for (key in keys) {
            val case = root.getJSONObject(key)
            val strokesJson = case.getJSONArray("strokes")
            val strokes = (0 until strokesJson.length()).map { s ->
                val pts = strokesJson.getJSONArray(s)
                (0 until pts.length()).map { p ->
                    val xy = pts.getJSONArray(p)
                    HandwritingInk.InkPoint(xy.getDouble(0).toFloat(), xy.getDouble(1).toFloat())
                }
            }
            val feats = case.getJSONArray("features")
            val flat = FloatArray(feats.length()) { feats.getDouble(it).toFloat() }
            out[key] = mapOf("strokes" to strokes, "features" to flat)
        }
        return out
    }

    @Test
    fun `strokesToSequence matches upstream preprocessing byte for byte`() {
        for ((name, case) in fixtures()) {
            @Suppress("UNCHECKED_CAST")
            val strokes = case["strokes"] as List<List<HandwritingInk.InkPoint>>
            val expected = case["features"] as FloatArray
            val actual = OchwproInk.strokesToSequence(strokes)
            assertEquals("$name size", expected.size, actual.size)
            for (i in expected.indices) {
                assertEquals("$name[$i]", expected[i], actual[i], 1e-6f)
            }
        }
    }

    @Test
    fun `last point of each stroke carries pen_down zero`() {
        val strokes = listOf(
            listOf(HandwritingInk.InkPoint(10f, 10f), HandwritingInk.InkPoint(10f, 90f)),
            listOf(HandwritingInk.InkPoint(5f, 50f), HandwritingInk.InkPoint(95f, 50f)),
        )
        val feats = OchwproInk.strokesToSequence(strokes)
        assertEquals(1f, feats[4], 1e-6f)
        assertEquals(0f, feats[9], 1e-6f)
        assertEquals(1f, feats[14], 1e-6f)
        assertEquals(0f, feats[19], 1e-6f)
    }

    @Test
    fun `decimate keeps endpoints and caps total points`() {
        val long = List(600) { HandwritingInk.InkPoint(it.toFloat(), (it * it % 97).toFloat()) }
        val strokes = listOf(long)
        val out = OchwproInk.decimate(strokes, 512)
        assertEquals(512, out[0].size)
        assertEquals(long.first(), out[0].first())
        assertEquals(long.last(), out[0].last())
        // 逐笔保底 1 点：多笔超限时每笔至少存活一个
        val multi = listOf(
            List(400) { HandwritingInk.InkPoint(it.toFloat(), 0f) },
            listOf(HandwritingInk.InkPoint(1f, 1f)),
        )
        val outMulti = OchwproInk.decimate(multi, 100)
        assertTrue(outMulti[0].size >= 1 && outMulti[1].size == 1)
        assertEquals(multi[1].single(), outMulti[1].single())
    }

    @Test
    fun `decimate is identity under the cap`() {
        val strokes = listOf(listOf(HandwritingInk.InkPoint(1f, 2f)))
        assertEquals(strokes, OchwproInk.decimate(strokes, 512))
    }

    @Test
    fun `decimate keeps single point for short strokes of multi-stroke glyphs`() {
        // 验收实录（2026-11-01 藏字）：笔画多的字总点数远超 cap，点/提
        // 等 2-3 点短笔画被抽到 keep==1——索引分母 (keep-1)=0 除零，整
        // 次识别回 error。size>=2 且 keep==1 不在 1 点笔画的 continue
        // 分支里，此前没有任何用例踩到。
        val long = List(190) { HandwritingInk.InkPoint(it.toFloat(), 0f) }
        val dots = List(15) { listOf(HandwritingInk.InkPoint(1f, 1f), HandwritingInk.InkPoint(2f, 2f)) }
        val strokes = listOf(long) + dots
        val out = OchwproInk.decimate(strokes, 48)
        // 算法按笔取整，总和不严格等于 cap；这里只断言收敛与短笔画存活
        assertTrue(out.sumOf { it.size } < strokes.sumOf { it.size })
        dots.forEachIndexed { i, dot ->
            assertEquals(1, out[1 + i].size)
            assertEquals(dot.first(), out[1 + i].single())
        }
    }
}
