package com.feelime.ime

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.Log
import java.io.File
import java.nio.FloatBuffer
import java.util.concurrent.Executors
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

/** 手写单字识别（design/handwriting.md §1-§4）。
 *
 * 独立引擎（照 [AsrEngine] 先例）：输入是笔迹不是按键流，不实现
 * TextEngine、不进 EngineCoordinator。推理在单线程后台执行，
 * [recognizeInk] 立即返回，结果只经 [Listener] 回调（调用方负责
 * 切回主线程）。模型未落地/推理异常时回调 error，不阻塞书写。
 *
 * 渲染 / 预处理 / 解码参数钉死，与 host spike 逐参数一致：
 * 256×256 内容归一渲染 → 内容 bbox 裁剪 → 48 高等比缩放 →
 * RGB CHW [-1,1] → 单字符精确 CTC 概率 DP（模型输出已是概率，不再 softmax）。
 * 纯函数部分（几何、预处理、DP、候选归一）在 [HandwritingInk]，JVM 单测
 * 直接逐参数核对，模型文件不进单测。
 */
class HandwritingEngine(
    private val context: Context,
    private val listener: Listener,
) {
    interface Listener {
        /** 后台线程回调。[error] 为 null 时 [candidates] 有效（可为空）；
         * "unavailable"=模型未落地，"failed"=payload/推理异常。 */
        fun onInkResult(reqId: Int, candidates: List<InkCandidate>, error: String?)
    }

    private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "feelime-ink") }
    private val modelStore = ModelStore(context)
    @Volatile private var session: OrtSession? = null
    @Volatile private var environment: OrtEnvironment? = null
    @Volatile private var vocabulary: List<String> = emptyList()
    @Volatile private var t2s: Map<String, String> = emptyMap()
    @Volatile private var released = false

    /** hello 的 engineDataReady 判定（§3）：模型落地即可用，不触发加载。
     * assets（full 包）或 ModelStore 下载完成皆算落地。 */
    fun isModelAvailable(): Boolean = modelStore.sourceFor(MODEL_ROLE) != null

    fun recognizeInk(reqId: Int, payload: String) {
        if (released) return
        worker.execute {
            val result = runCatching { recognize(reqId, payload) }
                .getOrElse { failure ->
                    Log.w(TAG, "ink recognition failed", failure)
                    InkResult(reqId, emptyList(), "failed")
                }
            listener.onInkResult(result.reqId, result.candidates, result.error)
        }
    }

    fun release() {
        released = true
        worker.execute { closeSession() }
        worker.shutdown()
    }

    private fun recognize(reqId: Int, payload: String): InkResult {
        val request = HandwritingInk.parseInkRequest(payload)
            ?: return InkResult(reqId, emptyList(), "failed")
        if (!ensureSession()) return InkResult(reqId, emptyList(), "unavailable")
        val activeSession = checkNotNull(session)
        // §4.1 渲染：内容 bbox 归一到 256×256（长边撑满、短边居中留白），
        // 笔宽 = 渲染画布短边的 2.2%，白底纯黑笔画、圆头圆角、抗锯齿。
        val transform = HandwritingInk.inkTransform(request.strokes, SIZE_PX.toFloat())
        val paint = Paint().apply {
            color = android.graphics.Color.BLACK
            isAntiAlias = true
            strokeWidth = SIZE_PX * STROKE_WIDTH_RATIO
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            style = Paint.Style.STROKE
        }
        val bitmap = Bitmap.createBitmap(SIZE_PX, SIZE_PX, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(android.graphics.Color.WHITE)
        request.strokes.forEach { stroke ->
            if (stroke.isEmpty()) return@forEach
            val first = stroke.first()
            if (stroke.size == 1) {
                // 单点成笔：Android 的 ROUND cap 不画零长度线。
                canvas.drawPoint(
                    first.x * transform.scale + transform.offsetX,
                    first.y * transform.scale + transform.offsetY,
                    paint,
                )
                return@forEach
            }
            val path = Path()
            path.moveTo(
                first.x * transform.scale + transform.offsetX,
                first.y * transform.scale + transform.offsetY,
            )
            stroke.drop(1).forEach { point ->
                path.lineTo(
                    point.x * transform.scale + transform.offsetX,
                    point.y * transform.scale + transform.offsetY,
                )
            }
            canvas.drawPath(path, paint)
        }
        val pixels = IntArray(SIZE_PX * SIZE_PX)
        bitmap.getPixels(pixels, 0, SIZE_PX, 0, 0, SIZE_PX, SIZE_PX)
        bitmap.recycle()
        // §4.2 预处理 + §4.3 解码（纯函数，参数钉死）。
        val input = HandwritingInk.preprocess(pixels, SIZE_PX, SIZE_PX)
        val width = HandwritingInk.resizedWidth(input)
        val env = checkNotNull(environment)
        // 模型输入是 NCHW（实测：index1 期望 3、index2 期望 48），数据侧
        // HandwritingInk.preprocess 产出的正是 CHW 平面序。
        val shape = longArrayOf(1, 3L, IMG_HEIGHT.toLong(), width.toLong())
        OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape).use { tensor ->
            activeSession.run(mapOf(checkNotNull(inputName) to tensor)).use { output ->
                val tensor = output[0] as OnnxTensor
                val dimensions = tensor.info.shape
                val buffer = tensor.floatBuffer
                val logits = FloatArray(buffer.remaining())
                buffer.get(logits)
                val (steps, vocab) = lastTwoDimensions(dimensions)
                val top = HandwritingInk.decodeCtc(logits, steps, vocab, RAW_LIMIT)
                val candidates = HandwritingInk.rankCandidates(
                    top.mapNotNull { (index, score) ->
                        vocabulary.getOrNull(index)?.let { it to score }
                    },
                    t2sMap(),
                    CANDIDATE_LIMIT,
                )
                return InkResult(reqId, candidates, null)
            }
        }
    }

    /** 词表（§4.3）：onnx metadata 的 \n 分隔字符表（RapidOCR 导出键为
     * `character`，`character_list` 为同义占位），按原始字符表存取——
     * decodeCtc 返回的下标就是这里的下标（blank 是输出第 0 列，不占表
     * 位；末列空格由汉字过滤兜掉）。条目**原样保留**——首条目是 U+3000
     * （表意空格），trim 会把它洗掉导致全体词表索引错位。 */
    private fun loadVocabulary(created: OrtSession): List<String> {
        val metadata = created.metadata.customMetadata
        val raw = metadata["character"] ?: metadata["character_list"] ?: return emptyList()
        val entries = raw.split('\n').toMutableList()
        if (entries.lastOrNull()?.isEmpty() == true) entries.removeAt(entries.lastIndex)
        return entries
    }

    private fun t2sMap(): Map<String, String> {
        if (t2s.isNotEmpty()) return t2s
        t2s = runCatching {
            context.assets.open(T2S_ASSET).use { stream ->
                val parsed = org.json.JSONObject(stream.readBytes().decodeToString())
                val keys = parsed.keys()
                buildMap {
                    while (keys.hasNext()) {
                        val key = keys.next()
                        put(key, parsed.optString(key))
                    }
                }
            }
        }.getOrDefault(emptyMap())
        return t2s
    }

    /** 模型落地才创建 session（1 线程后台 init）；失败按 unavailable 上报。 */
    private fun ensureSession(): Boolean {
        if (session != null) return vocabulary.isNotEmpty()
        val source = modelStore.sourceFor(MODEL_ROLE) ?: return false
        return try {
            val bytes = when (source) {
                is ModelSource.Assets ->
                    context.assets.open(MODEL_FILE).use { it.readBytes() }
                is ModelSource.Directory -> File(source.root, MODEL_FILE).readBytes()
            }
            val env = OrtEnvironment.getEnvironment()
            val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(1) }
            val created = env.createSession(bytes, options)
            val vocab = loadVocabulary(created)
            if (vocab.isEmpty()) {
                created.close()
                Log.w(TAG, "handwriting model carries no character table")
                return false
            }
            // 输出维度必须 = blank + 词表 + 空格；不符说明词表解析错位
            // （解码出的字符会整体漂移），按不可用处理。
            val outputVocab = (created.outputInfo.values.firstOrNull() as? TensorInfo)
                ?.let { it.shape.lastOrNull()?.toInt() } ?: 0
            // 动态/符号维度读不出来时（outputVocab<=0）放行：词表解析本身
            // 已按 metadata 原样对齐，这里只是能查就查的双保险。
            if (outputVocab > 0 && outputVocab != vocab.size + 2) {
                created.close()
                Log.w(TAG, "handwriting vocab mismatch: output=$outputVocab vocab=${vocab.size}")
                return false
            }
            Log.i(TAG, "handwriting outputVocab=$outputVocab vocab=${vocab.size}")
            closeSession()
            environment = env
            session = created
            vocabulary = vocab
            Log.i(TAG, "handwriting model ready vocab=${vocab.size}")
            true
        } catch (failure: Throwable) {
            Log.w(TAG, "handwriting model load failed", failure)
            false
        }
    }

    private fun closeSession() {
        runCatching { session?.close() }
        session = null
        vocabulary = emptyList()
    }

    private val inputName: String?
        get() = session?.inputNames?.firstOrNull()

    private data class InkResult(
        val reqId: Int,
        val candidates: List<InkCandidate>,
        val error: String?,
    )

    companion object {
        private const val TAG = "FeelimeInk"
        const val MODEL_ROLE = "handwriting-rec"
        const val MODEL_FILE = "handwriting/model.onnx"
        private const val T2S_ASSET = "engine-data/handwriting/t2s.json"

        /** §4.1/§4.2/§4.3 钉死参数（host spike 同源）。 */
        const val SIZE_PX = 256
        const val STROKE_WIDTH_RATIO = 0.022f
        const val IMG_HEIGHT = 48
        const val MAX_IMG_WIDTH = 320
        const val BBOX_THRESHOLD = 200
        const val BBOX_PAD_RATIO = 0.10f
        const val BBOX_PAD_MIN_PX = 4
        /** 解码先行截断 top-30，滤汉字/t2s 聚合后取 top-8。 */
        const val RAW_LIMIT = 30
        const val CANDIDATE_LIMIT = 8

        /** 输出张量 (1,T,V)/(T,V) 的 (T,V)。 */
        fun lastTwoDimensions(shape: LongArray): Pair<Int, Int> = when (shape.size) {
            0, 1 -> 0 to 0
            2 -> shape[0].toInt() to shape[1].toInt()
            else -> shape[shape.size - 2].toInt() to shape[shape.size - 1].toInt()
        }
    }
}

/** 一个识别候选：score 已归一到和为 1（design §4.3）。 */
data class InkCandidate(val text: String, val score: Float)

/** 手写识别的纯函数层（无 Android 依赖，JVM 单测直接覆盖）。
 * 参数钉死在 [HandwritingEngine] companion，与 host spike 一致。 */
object HandwritingInk {
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

    fun inkTransform(strokes: List<List<InkPoint>>, size: Float): InkTransform {
        var minX = Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        strokes.forEach { stroke -> stroke.forEach { point ->
            minX = min(minX, point.x)
            minY = min(minY, point.y)
            maxX = max(maxX, point.x)
            maxY = max(maxY, point.y)
        } }
        if (minX > maxX || minY > maxY) return InkTransform(1f, 0f, 0f)
        val spanX = max(maxX - minX, 1f)
        val spanY = max(maxY - minY, 1f)
        val scale = size / max(spanX, spanY)
        return InkTransform(
            scale = scale,
            offsetX = (size - spanX * scale) / 2f - minX * scale,
            offsetY = (size - spanY * scale) / 2f - minY * scale,
        )
    }

    /** 裁剪产物：像素（行主序）+ 自身宽高（预处理缩放要用）。 */
    data class CroppedImage(val pixels: IntArray, val width: Int, val height: Int)

    /** §4.2 步骤 1：内容 bbox（pixel<200），四边外扩 10%（每边至少 4px），
     * 裁剪到图像边界。无内容（全白）返回空像素。 */
    fun cropToContent(
        pixels: IntArray,
        width: Int,
        height: Int,
        threshold: Int = HandwritingEngine.BBOX_THRESHOLD,
    ): CroppedImage {
        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1
        for (y in 0 until height) {
            val row = y * width
            for (x in 0 until width) {
                if ((pixels[row + x] and 0xFF) >= threshold) continue
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
            }
        }
        if (maxX < 0) return CroppedImage(IntArray(0), 0, 0)
        val padX = max((maxX - minX + 1) * HandwritingEngine.BBOX_PAD_RATIO,
            HandwritingEngine.BBOX_PAD_MIN_PX.toFloat()).toInt()
        val padY = max((maxY - minY + 1) * HandwritingEngine.BBOX_PAD_RATIO,
            HandwritingEngine.BBOX_PAD_MIN_PX.toFloat()).toInt()
        val left = max(0, minX - padX)
        val top = max(0, minY - padY)
        val right = min(width - 1, maxX + padX)
        val bottom = min(height - 1, maxY + padY)
        val cropWidth = right - left + 1
        val cropHeight = bottom - top + 1
        return CroppedImage(
            IntArray(cropWidth * cropHeight) { index ->
                pixels[(top + index / cropWidth) * width + left + index % cropWidth]
            },
            cropWidth,
            cropHeight,
        )
    }

    /** §4.2 步骤 2-3：双线性缩放到高 [HandwritingEngine.IMG_HEIGHT]
     * （宽 = ceil(48*w/h)，上限 [HandwritingEngine.MAX_IMG_WIDTH]），
     * RGB CHW、x/255 再 (x-0.5)/0.5（归一到 [-1,1]）。 */
    fun preprocess(
        pixels: IntArray,
        width: Int,
        height: Int,
        imgHeight: Int = HandwritingEngine.IMG_HEIGHT,
        maxImgWidth: Int = HandwritingEngine.MAX_IMG_WIDTH,
    ): FloatArray {
        val crop = cropToContent(pixels, width, height)
        if (crop.pixels.isEmpty() || crop.width <= 0 || crop.height <= 0) return FloatArray(0)
        val resizedWidth = min(
            maxImgWidth,
            ceil(imgHeight * crop.width.toFloat() / crop.height.toFloat()).toInt(),
        ).coerceAtLeast(1)
        val resized = resizeBilinear(crop.pixels, crop.width, crop.height, resizedWidth, imgHeight)
        val output = FloatArray(3 * resized.size)
        for (channel in 0 until 3) {
            val shift = 16 - 8 * channel
            var offset = channel * resized.size
            for (pixel in resized) {
                val value = ((pixel shr shift) and 0xFF) / 255f
                output[offset++] = (value - 0.5f) / 0.5f
            }
        }
        return output
    }

    /** 输入张量的宽（高恒为 IMG_HEIGHT）。 */
    fun resizedWidth(input: FloatArray): Int = when {
        input.isEmpty() -> 1
        else -> (input.size / (3 * HandwritingEngine.IMG_HEIGHT)).coerceAtLeast(1)
    }

    /** 双线性缩放（cv2 INTER_LINEAR 同构：目标像素中心对齐）。 */
    fun resizeBilinear(
        pixels: IntArray,
        sourceWidth: Int,
        sourceHeight: Int,
        targetWidth: Int,
        targetHeight: Int,
    ): IntArray {
        if (sourceWidth <= 0 || sourceHeight <= 0) return IntArray(0)
        val output = IntArray(targetWidth * targetHeight)
        val scaleX = sourceWidth.toDouble() / targetWidth
        val scaleY = sourceHeight.toDouble() / targetHeight
        for (y in 0 until targetHeight) {
            val sourceY = (y + 0.5) * scaleY - 0.5
            val y0 = sourceY.toInt().coerceIn(0, sourceHeight - 1)
            val y1 = (y0 + 1).coerceAtMost(sourceHeight - 1)
            val fy = (sourceY - y0).coerceIn(0.0, 1.0)
            for (x in 0 until targetWidth) {
                val sourceX = (x + 0.5) * scaleX - 0.5
                val x0 = sourceX.toInt().coerceIn(0, sourceWidth - 1)
                val x1 = (x0 + 1).coerceAtMost(sourceWidth - 1)
                val fx = (sourceX - x0).coerceIn(0.0, 1.0)
                val topLeft = pixels[y0 * sourceWidth + x0]
                val topRight = pixels[y0 * sourceWidth + x1]
                val bottomLeft = pixels[y1 * sourceWidth + x0]
                val bottomRight = pixels[y1 * sourceWidth + x1]
                var blended = 0xFF shl 24
                for (channel in 0 until 3) {
                    val shift = 16 - 8 * channel
                    val value = ((topLeft shr shift) and 0xFF) * (1 - fx) * (1 - fy) +
                        ((topRight shr shift) and 0xFF) * fx * (1 - fy) +
                        ((bottomLeft shr shift) and 0xFF) * (1 - fx) * fy +
                        ((bottomRight shr shift) and 0xFF) * fx * fy
                    blended += (round(value).toInt() and 0xFF) shl shift
                }
                output[y * targetWidth + x] = blended
            }
        }
        return output
    }

    /** §4.3：单字符精确 CTC 概率 DP（向量化全词表，无 beam search）。
     * [logits] 行主序 (T,V)，**已是概率**——该模型输出自带 softmax
     * （host 实测每行和恰为 1），再 softmax 会把分布压平、DP 出错字。
     * 返回概率降序的前 [limit] 个 (字符表下标, 概率)：下标 j 即字符表第
     * j 条（输出第 j+1 列；第 0 列是 blank，不占字符表位）。调用方拿它
     * 直接查字符表，**不要再 +1**——+1 会整体漂移成下一个字符
     * （设备实测：中→贝、口→山、工→土）。 */
    fun decodeCtc(logits: FloatArray, timeSteps: Int, vocabSize: Int, limit: Int): List<Pair<Int, Float>> {
        if (timeSteps <= 0 || vocabSize < 2) return emptyList()
        val nonBlank = vocabSize - 1
        // A=保持全 blank 的前缀概率；C=已完成字符 c 的概率。
        val completed = FloatArray(nonBlank)
        var blankPath = 1f
        for (t in 0 until timeSteps) {
            val base = t * vocabSize
            val blank = logits[base]
            for (j in 0 until nonBlank) {
                val char = logits[base + j + 1]
                completed[j] = completed[j] * (blank + char) + blankPath * char
            }
            blankPath *= blank
        }
        val order = Array(nonBlank) { it }
        order.sortByDescending { completed[it] }
        return order.take(limit.coerceAtMost(nonBlank)).map { j -> j to completed[j] }
    }

    /** 汉字过滤（§4.3：CJK 统一表意 㐀-鿿、兼容 豈-﫿、〇）。 */
    fun isHan(codePoint: Int): Boolean =
        codePoint in 0x3400..0x9FFF || codePoint in 0xF900..0xFAFF || codePoint == 0x3007

    /** 候选后处理（§4.3）：滤非汉字 → 繁体按 t2s 归简 → 同字概率相加重排
     * → 取 top-[limit]，score 归一到输出集合和为 1。 */
    fun rankCandidates(
        raw: List<Pair<String, Float>>,
        t2s: Map<String, String>,
        limit: Int,
    ): List<InkCandidate> {
        val merged = LinkedHashMap<String, Float>()
        raw.forEach { (text, score) ->
            if (score <= 0f) return@forEach
            if (text.isEmpty() || text.codePointCount(0, text.length) != 1) return@forEach
            if (!isHan(text.codePointAt(0))) return@forEach
            val key = t2s[text] ?: text
            merged[key] = (merged[key] ?: 0f) + score
        }
        val top = merged.entries
            .sortedByDescending { it.value }
            .take(limit)
        val total = top.sumOf { it.value.toDouble() }.toFloat()
        if (total <= 0f) return emptyList()
        return top.map { (text, score) -> InkCandidate(text, score / total) }
    }

    private const val MAX_STROKES = 64
    private const val MAX_POINTS_PER_STROKE = 512
}
