package com.feelime.ime



/** 一个识别候选：score 已归一到和为 1（design §4.3）。 */
data class InkCandidate(val text: String, val score: Float)

/** 手写 ink payload 的解析与回包组包（桥 JSON ↔ 结构化类型）。
 * Melnyk 预处理纯函数已随引擎退役删除（issue #84）；ochwpro 的
 * 纯函数层在 [OchwproInk]。 */
object HandwritingInk {
    internal fun resultPayload(reqId: Int, candidates: List<InkCandidate>, error: String?): org.json.JSONObject {
        require(candidates.all { it.score.isFinite() }) { "non-finite candidate score" }
        return org.json.JSONObject().put("reqId", reqId)
            .put("candidates", org.json.JSONArray().apply {
                candidates.forEach { candidate ->
                    put(org.json.JSONObject().put("text", candidate.text).put("score", candidate.score.toDouble()))
                }
            }).put("error", error ?: org.json.JSONObject.NULL)
    }
    data class InkPoint(val x: Float, val y: Float)
    data class InkRequest(
        val width: Float,
        val height: Float,
        val strokes: List<List<InkPoint>>,
        val originalStrokeSizes: List<Int>? = null,
    )

    /** payload 解析（§3）：{"w":..,"h":..,"strokes":[[[x,y],..],..]}。
     * 结构非法返回 null（native 侧防御；JS 侧已先行校验）。w/h 只承载
     * 书写区尺寸——渲染按内容 bbox 紧致化（§4.1），不参与几何。 */
    fun parseInkRequest(json: String): InkRequest? = runCatching {
        val root = org.json.JSONObject(json)
        val width = root.optDouble("w").takeIf { it.isFinite() }?.toFloat() ?: return null
        val height = root.optDouble("h").takeIf { it.isFinite() }?.toFloat() ?: return null
        if (width <= 0f || height <= 0f) return null
        val rawStrokes = root.optJSONArray("strokes") ?: return null
        if (rawStrokes.length() !in 1..MAX_STROKES) return null
        val strokes = (0 until rawStrokes.length()).map { strokeIndex ->
            val rawPoints = rawStrokes.optJSONArray(strokeIndex) ?: return null
            if (rawPoints.length() !in 1..MAX_POINTS_PER_STROKE) return null
            (0 until rawPoints.length()).map { pointIndex ->
                val rawPoint = rawPoints.optJSONArray(pointIndex) ?: return null
                if (rawPoint.length() != 2) return null
                val x = rawPoint.optDouble(0).toFloat()
                val y = rawPoint.optDouble(1).toFloat()
                if (!x.isFinite() || !y.isFinite()) return null
                InkPoint(x, y)
            }
        }
        val originalSizes = root.optJSONArray("originalStrokeSizes")?.let { sizes ->
            if (sizes.length() != strokes.size) return null
            (0 until sizes.length()).map { i ->
                sizes.optInt(i).takeIf { it in strokes[i].size..1_000_000 } ?: return null
            }
        }
        InkRequest(width, height, strokes, originalSizes)
    }.getOrNull()

    /** §4.1：内容 bbox → 画布等比映射（长边撑满、短边居中）。 */
    data class InkTransform(val scale: Float, val offsetX: Float, val offsetY: Float)

    /** recognizeInk 桥载荷预算（原 HandwritingEngine.MAX_PAYLOAD_CHARS）。
     * 2026-11-17 修正：0471fd7 切 ochwpro 时误从 512Ki 砍到 4096——与
     * MAX_POINTS_PER_STROKE=512 自相矛盾（4096 字符 ≈ 420 点，一笔快速
     * 长滑就超预算 inkReject，用户没候选）。推理成本由 DENSITY_CAP 抽稀
     * 钳制，预算只需防滥用，恢复 512Ki（覆盖 64 笔×512 点上限）。 */
    const val MAX_PAYLOAD_CHARS = 512 * 1024
    private const val MAX_STROKES = 64
    private const val MAX_POINTS_PER_STROKE = 512
}
