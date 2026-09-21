package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

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

    @Test
    fun preprocessShapeFollowsAspectRatioAndCap() {
        // 32×32 内容方框 → 48×48 张量（RGB CHW）。
        val dark = (8..20).flatMap { x -> (8..20).map { y -> x to y } }
        val input = HandwritingInk.preprocess(canvas(32, 32, dark), 32, 32)
        assertEquals(3 * 48 * 48, input.size)
        assertEquals(48, HandwritingInk.resizedWidth(input))

        // 极宽内容（512×32 → 内容 bbox 宽>高）→ 宽上限 320。
        val wide = IntArray(512 * 32) { 0xFFFFFFFF.toInt() }
        (0 until 512).forEach { x -> (10 until 20).forEach { y -> wide[y * 512 + x] = 0xFF000000.toInt() } }
        val wideInput = HandwritingInk.preprocess(wide, 512, 32)
        assertEquals(3 * 48 * HandwritingEngine.MAX_IMG_WIDTH, wideInput.size)
    }

    @Test
    fun preprocessNormalizesToSignedUnitRange() {
        // 中央黑块：裁剪缩放后角落是白（+1.0），块中心是黑（-1.0）。
        val dark = (100..140).flatMap { x -> (100..140).map { y -> x to y } }
        val input = HandwritingInk.preprocess(canvas(256, 256, dark), 256, 256)
        val width = HandwritingInk.resizedWidth(input)
        fun channel(x: Int, y: Int, c: Int) = input[c * 48 * width + y * width + x]
        assertTrue(input.all { it.isFinite() && abs(it) <= 1.0001f })
        assertEquals(1f, channel(1, 1, 0), 0.02f)
        assertEquals(-1f, channel(width / 2, 24, 0), 0.02f)
        // 黑白笔画的三通道相等（灰度输入）。
        assertEquals(channel(2, 2, 0), channel(2, 2, 1), 1e-5f)
        assertEquals(channel(2, 2, 1), channel(2, 2, 2), 1e-5f)
    }

    // ---- §4.3 解码：单字符精确 CTC 概率 DP ----

    @Test
    fun ctcDpMatchesHandComputedProbabilities() {
        // V=3（blank + 2 字符），两帧 softmax 都是 [0.5, 0.5, 0]（用极大负
        // logits 压出 0 概率）。P(单字 c0) = blank,c + c,blank + c,c = 0.75，
        // P(c1) = 0。
        val frame = floatArrayOf(0f, 0f, -1000f)
        val logits = floatArrayOf(*frame, *frame)
        val top = HandwritingInk.decodeCtc(logits, 2, 3, 30)
        assertEquals(2, top.size)
        assertEquals(0, top[0].first)
        assertEquals(0.75f, top[0].second, 1e-4f)
        assertEquals(1, top[1].first)
        assertEquals(0f, top[1].second, 1e-4f)
    }

    @Test
    fun ctcDpRanksByProbabilityAndRespectsLimit() {
        // 两帧：第一帧 c0 独大，第二帧 c1 独大 → 跨帧组合不成单字，
        // 单字概率都趋近 0，但 c0（先完成）概率严格更大。
        val logits = floatArrayOf(0f, 100f, -1000f, 0f, -1000f, 100f)
        val top = HandwritingInk.decodeCtc(logits, 2, 3, 1)
        assertEquals(1, top.size)
        assertEquals(0, top[0].first)
        assertTrue(top[0].second > 0f)
    }

    @Test
    fun ctcDpHandlesBlankOnlyFrames() {
        val logits = floatArrayOf(0f, -1000f, -1000f, 0f, -1000f, -1000f)
        val top = HandwritingInk.decodeCtc(logits, 2, 3, 30)
        assertTrue(top.all { it.second < 1e-6f })
    }

    @Test
    fun ctcDpRejectsDegenerateShapes() {
        assertTrue(HandwritingInk.decodeCtc(FloatArray(0), 0, 18385, 30).isEmpty())
        assertTrue(HandwritingInk.decodeCtc(floatArrayOf(0f, 1f), 1, 1, 30).isEmpty())
    }

    // ---- §4.3 候选后处理：滤汉字 + t2s 归一 + 聚合 + 归一化 ----

    @Test
    fun isHanCoversUnifiedCompatibilityAndZero() {
        assertTrue(HandwritingInk.isHan('感'.code))
        assertTrue(HandwritingInk.isHan('㐀'.code)) // CJK 扩展 A 首字
        assertTrue(HandwritingInk.isHan('豈'.code)) // 兼容表意
        assertTrue(HandwritingInk.isHan('〇'.code))
        assertFalse(HandwritingInk.isHan('A'.code))
        assertFalse(HandwritingInk.isHan('ぁ'.code))
        assertFalse(HandwritingInk.isHan('1'.code))
        assertFalse(HandwritingInk.isHan('⽕'.code)) // 康熙部首（0x2F55）不在词表滤后集合
        assertFalse(HandwritingInk.isHan("🕐".codePointAt(0))) // emoji（增补平面）
    }

    @Test
    fun rankFiltersNonHanAndMergesTraditionalVariants() {
        val merged = HandwritingInk.rankCandidates(
            listOf(
                "厂" to 0.40f,
                "廠" to 0.20f, // t2s → 厂
                "A" to 0.30f, // 非汉字
                "😀" to 0.10f, // 非汉字
            ),
            mapOf("廠" to "厂"),
            8,
        )
        assertEquals(listOf(InkCandidate("厂", 1f)), merged)
    }

    @Test
    fun rankNormalizesScoresToSumOneAndCapsAtEight() {
        // 12 个不同汉字，概率递减：截断到 top-8 且和为 1。
        val raw = (0 until 12).map { index ->
            String(Character.toChars(0x4E00 + index)) to (0.24f - index * 0.01f)
        }
        val ranked = HandwritingInk.rankCandidates(raw, emptyMap(), 8)
        assertEquals(8, ranked.size)
        val total = ranked.sumOf { it.score.toDouble() }
        assertEquals(1.0, total, 1e-4)
        // 按概率降序。
        assertEquals(ranked.sortedByDescending { it.score }, ranked)
        // 首名 = 原始概率最大的字，score = 0.24 / 前 8 名原始概率和 1.64。
        assertEquals(String(Character.toChars(0x4E00)), ranked.first().text)
        assertEquals(0.24 / 1.64, ranked.first().score.toDouble(), 1e-4)
    }

    @Test
    fun rankKeepsOrderStableForEqualScores() {
        val raw = listOf("中" to 0.2f, "国" to 0.2f, "人" to 0.2f)
        val ranked = HandwritingInk.rankCandidates(raw, emptyMap(), 8)
        assertEquals(listOf("中", "国", "人"), ranked.map { it.text })
    }

    @Test
    fun rankHandlesEmptyInput() {
        assertTrue(HandwritingInk.rankCandidates(emptyList(), emptyMap(), 8).isEmpty())
        assertTrue(HandwritingInk.rankCandidates(listOf("A" to 0.5f), emptyMap(), 8).isEmpty())
    }

    // ---- 输出张量形状 ----

    @Test
    fun lastTwoDimensionsReadTimeAndVocab() {
        assertEquals(40 to 18385, HandwritingEngine.lastTwoDimensions(longArrayOf(1, 40, 18385)))
        assertEquals(40 to 18385, HandwritingEngine.lastTwoDimensions(longArrayOf(40, 18385)))
        assertEquals(0 to 0, HandwritingEngine.lastTwoDimensions(longArrayOf()))
    }
}
