package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 手写识别纯函数层（design/handwriting.md §4.1-§4.3）：
 * 预处理形状/归一化数值、CTC DP 手算期望、t2s 归一聚合、非汉字过滤。
 * 模型文件不进单测——没有模型时引擎走 unavailable 回调。 */
class HandwritingEngineTest {
    // ---- §3 payload 解析 ----

    @Test
    fun parsesWellFormedPayload() {
        val request = HandwritingInk.parseInkRequest(
            """{"w":320,"h":140,"strokes":[[[10,20],[30.5,40.25]],[[1,2]]]}""",
        )
        assertEquals(320f, request!!.width, 0.001f)
        assertEquals(140f, request.height, 0.001f)
        assertEquals(2, request.strokes.size)
        assertEquals(listOf(10f to 20f, 30.5f to 40.25f), request.strokes[0].map { it.x to it.y })
    }

    @Test
    fun rejectsMalformedPayloads() {
        assertNull(HandwritingInk.parseInkRequest("""{"h":100,"strokes":[[[1,2]]]}"""))
        assertNull(HandwritingInk.parseInkRequest("""{"w":0,"h":100,"strokes":[[[1,2]]]}"""))
        assertNull(HandwritingInk.parseInkRequest("""{"w":10,"h":100}"""))
        assertNull(HandwritingInk.parseInkRequest("""{"w":10,"h":100,"strokes":[]}"""))
        assertNull(HandwritingInk.parseInkRequest("""{"w":10,"h":100,"strokes":[[]]}"""))
        // 点必须是 [x, y] 二元组。
        assertNull(HandwritingInk.parseInkRequest("""{"w":10,"h":100,"strokes":[[[1]]]}"""))
        assertNull(HandwritingInk.parseInkRequest("""{"w":10,"h":100,"strokes":[[[1,2,3]]]}"""))
        assertNull(HandwritingInk.parseInkRequest("not json"))
    }

    // ---- §4.1 渲染几何：内容 bbox 归一，长边撑满、短边居中 ----

    @Test
    fun inkTransformNormalizesContentBbox() {
        val strokes = listOf(
            listOf(HandwritingInk.InkPoint(0f, 0f), HandwritingInk.InkPoint(100f, 0f),
                HandwritingInk.InkPoint(100f, 50f)),
        )
        val transform = HandwritingInk.inkTransform(strokes, 256f)
        // 长边（宽 100）撑满 256。
        assertEquals(2.56f, transform.scale, 0.0001f)
        assertEquals(0f, transform.offsetX, 0.0001f)
        // 短边（高 50 → 128px）居中：offset 64。
        assertEquals(64f, transform.offsetY, 0.0001f)
        val last = HandwritingInk.InkPoint(100f, 50f)
        assertEquals(256f, last.x * transform.scale + transform.offsetX, 0.0001f)
        assertEquals(192f, last.y * transform.scale + transform.offsetY, 0.0001f)
    }

    @Test
    fun inkTransformIsContentOnlyNotWritingArea() {
        // 同样的笔迹放在书写区不同位置（平移），映射结果一致——渲染只看内容
        // bbox，不关心书写区原始 w/h（design §4.1）。
        val base = listOf(
            listOf(HandwritingInk.InkPoint(0f, 0f), HandwritingInk.InkPoint(60f, 80f)),
        )
        val shifted = listOf(
            listOf(HandwritingInk.InkPoint(200f, 500f), HandwritingInk.InkPoint(260f, 580f)),
        )
        val a = HandwritingInk.inkTransform(base, 256f)
        val b = HandwritingInk.inkTransform(shifted, 256f)
        assertEquals(a.scale, b.scale, 0.0001f)
        // bbox 右下角（两份笔迹的同一相对位置）落在同一画布点。
        assertEquals(60f * a.scale + a.offsetX, 260f * b.scale + b.offsetX, 0.0001f)
        assertEquals(80f * a.scale + a.offsetY, 580f * b.scale + b.offsetY, 0.0001f)
    }

    // ---- §4.2 预处理：内容 bbox（<200）+ 10% 外扩（至少 4px）+ 裁剪 ----

    private fun canvas(width: Int, height: Int, dark: List<Pair<Int, Int>>): IntArray {
        val pixels = IntArray(width * height) { 0xFFFFFFFF.toInt() }
        dark.forEach { (x, y) -> pixels[y * width + x] = 0xFF000000.toInt() }
        return pixels
    }

    @Test
    fun cropPadsByAtLeastFourPixelsAndClamps() {
        // 单个黑点 (5,3) 在 20×10 里：bbox 1×1，pad = max(0,4) = 4，
        // 裁剪 (1,0)-(9,7) → 9×8。
        val crop = HandwritingInk.cropToContent(canvas(20, 10, listOf(5 to 3)), 20, 10)
        assertEquals(9, crop.width)
        assertEquals(8, crop.height)
        assertEquals(9 * 8, crop.pixels.size)
    }

    @Test
    fun cropPadsTenPercentOnLargeContent() {
        // 黑块 (2,2)-(11,11)：bbox 10×10，pad = max(1,4)=4，向左/上越界
        // 被钳到 0 → (0,0)-(15,15) = 16×16。
        val dark = (2..11).flatMap { x -> (2..11).map { y -> x to y } }
        val crop = HandwritingInk.cropToContent(canvas(40, 40, dark), 40, 40)
        assertEquals(16, crop.width)
        assertEquals(16, crop.height)
    }

    @Test
    fun blankCanvasCropsToNothing() {
        val crop = HandwritingInk.cropToContent(canvas(32, 32, emptyList()), 32, 32)
        assertEquals(0, crop.pixels.size)
    }

    // ---- §4.2（v2）：Melnyk-Net 96×96 uint8 反色 ----

    @Test
    fun melnykPreprocessProducesSquareInvertedUint8() {
        // 32×32 内容方框（居中 12×12 黑块）→ 96×96 uint8：
        // 四边白（反色后 0）、内容区笔画高值。
        val dark = (10..21).flatMap { x -> (10..21).map { y -> x to y } }
        val input = HandwritingInk.preprocessMelnyk(canvas(32, 32, dark), 32, 32)
        assertEquals(96 * 96, input.size)
        fun px(x: Int, y: Int) = input[y * 96 + x].toInt() and 0xFF
        // 白边（反色后 0）
        assertEquals(0, px(0, 0))
        assertEquals(0, px(95, 95))
        assertEquals(0, px(47, 0))
        // 中央黑块反色成高值（双线性后仍在高位）
        assertTrue("中心应反色成高值, got ${px(48, 48)}", px(48, 48) > 200)
        // 全幅值域 [0,255]
        assertTrue(input.all { (it.toInt() and 0xFF) in 0..255 })
    }

    @Test
    fun melnykPreprocessPadsWideContentVertically() {
        // 宽>高的内容（横线）：pad 成正方形后上下留白，笔画居于中央行。
        val wide = IntArray(128 * 32) { 0xFFFFFFFF.toInt() }
        (0 until 128).forEach { x -> wide[16 * 128 + x] = 0xFF000000.toInt() }
        val input = HandwritingInk.preprocessMelnyk(wide, 128, 32)
        assertEquals(96 * 96, input.size)
        fun px(x: Int, y: Int) = input[y * 96 + x].toInt() and 0xFF
        // 中央行（y=47）中段有笔画（高值），远离中心的上下行全 0
        assertTrue(px(48, 47) > 0)
        assertEquals(0, px(48, 8))
        assertEquals(0, px(48, 87))
    }

    @Test
    fun melnykPreprocessBlankReturnsEmpty() {
        assertTrue(HandwritingInk.preprocessMelnyk(canvas(32, 32, emptyList()), 32, 32).isEmpty())
    }

    // ---- §4.3（v2）：softmax 直排 ----

    @Test
    fun rankSoftmaxOrdersByProbabilityAndCaps() {
        val probs = floatArrayOf(0.05f, 0.50f, 0.30f, 0.15f)
        val vocab = listOf("甲", "乙", "丙", "丁")
        val ranked = HandwritingInk.rankSoftmax(probs, vocab, 2)
        assertEquals(listOf(InkCandidate("乙", 0.50f), InkCandidate("丙", 0.30f)), ranked)
    }

    @Test
    fun rankSoftmaxSkipsEmptyVocabEntries() {
        val ranked = HandwritingInk.rankSoftmax(floatArrayOf(0.9f, 0.1f), listOf("就", ""), 8)
        assertEquals(listOf(InkCandidate("就", 0.9f)), ranked)
    }

    @Test
    fun rankSoftmaxHandlesDegenerateInput() {
        assertTrue(HandwritingInk.rankSoftmax(FloatArray(0), listOf("就"), 8).isEmpty())
        assertTrue(HandwritingInk.rankSoftmax(floatArrayOf(1f), emptyList(), 8).isEmpty())
    }
}
