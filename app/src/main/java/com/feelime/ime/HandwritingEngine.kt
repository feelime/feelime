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
        InkRequest(width, height, strokes)
    }.getOrNull()

    /** §4.1：内容 bbox → 画布等比映射（长边撑满、短边居中）。 */
    data class InkTransform(val scale: Float, val offsetX: Float, val offsetY: Float)

    /** recognizeInk 桥载荷预算（原 HandwritingEngine.MAX_PAYLOAD_CHARS）。 */
    const val MAX_PAYLOAD_CHARS = 4096
    private const val MAX_STROKES = 64
    private const val MAX_POINTS_PER_STROKE = 512
}
