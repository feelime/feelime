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
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

/** 手写单字识别（design/handwriting.md §1-§4；模型 v2 见 issue #32）。
 *
 * 独立引擎（照 [AsrEngine] 先例）：输入是笔迹不是按键流，不实现
 * TextEngine、不进 EngineCoordinator。推理在单线程后台执行，
 * [recognizeInk] 立即返回，结果只经 [Listener] 回调（调用方负责
 * 切回主线程）。模型未落地/推理异常时回调 error，不阻塞书写。
 *
 * 模型 v2：Melnyk-Net int8（6.6MB，CASIA-HWDB 真人手写 3755 类，
 * 真人手写域 top1 99.6% vs PP-OCRv5 63.5%，issue #32 评测）。管线：
 * 256×256 内容归一渲染（笔宽 4.3%，v1 实证保留）→ 内容 bbox 裁剪 →
 * pad 方形 → 88×88 + 4px 白边 → 反色 uint8 (1,96,96,1) → softmax
 * 直排 top-8。分类 softmax 即全词表排名，无 CTC DP/t2s（词表 GB2312
 * 一级全简体）。纯函数部分在 [HandwritingInk]，JVM 单测直接逐参数
 * 核对，模型文件不进单测。
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
        // 预处理 + 解码（纯函数，参数钉死）：96×96 反色 uint8 NHWC。
        val input = HandwritingInk.preprocessMelnyk(pixels, SIZE_PX, SIZE_PX)
        if (input.isEmpty()) return InkResult(reqId, emptyList(), null)
        val env = checkNotNull(environment)
        // 模型输入 (1,96,96,1) uint8（NHWC，tf2onnx 转换保真）。
        val shape = longArrayOf(1, MELNYK_SIZE.toLong(), MELNYK_SIZE.toLong(), 1)
        OnnxTensor.createTensor(
            env,
            java.nio.ByteBuffer.wrap(input),
            shape,
            ai.onnxruntime.OnnxJavaType.UINT8,
        ).use { tensor ->
            activeSession.run(mapOf(checkNotNull(inputName) to tensor)).use { output ->
                val tensor = output[0] as OnnxTensor
                val buffer = tensor.floatBuffer
                val probs = FloatArray(buffer.remaining())
                buffer.get(probs)
                val candidates = HandwritingInk.rankSoftmax(probs, vocabulary, CANDIDATE_LIMIT)
                return InkResult(reqId, candidates, null)
            }
        }
    }

    /** 词表（v2）：assets `vocab.json` 的 3755 字数组，下标 = softmax
     * 输出类目。转换自 CASIA tagcode 顺序（issue #32 spike 同源）。 */
    private fun loadVocabulary(): List<String> = runCatching {
        context.assets.open(VOCAB_ASSET).use { stream ->
            val parsed = org.json.JSONArray(stream.readBytes().decodeToString())
            List(parsed.length()) { parsed.optString(it) }
        }
    }.getOrDefault(emptyList())

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
            val vocab = loadVocabulary()
            if (vocab.isEmpty()) {
                created.close()
                Log.w(TAG, "handwriting vocab asset missing")
                return false
            }
            // 输出类目数必须 = 词表大小；不符说明词表与模型错配
            // （解码出的字符会整体漂移），按不可用处理。
            val outputVocab = (created.outputInfo.values.firstOrNull() as? TensorInfo)
                ?.let { it.shape.lastOrNull()?.toInt() } ?: 0
            // 动态/符号维度读不出来时（outputVocab<=0）放行。
            if (outputVocab > 0 && outputVocab != vocab.size) {
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
        private const val VOCAB_ASSET = "engine-data/handwriting/vocab.json"

        /** §4.1 钉死参数（v1 实证保留）+ v2 预处理参数（Melnyk-Net 口径）。 */
        const val SIZE_PX = 256
        const val STROKE_WIDTH_RATIO = 0.043f  // §6.1 设备实证：2.2% 在 48px 高下缩到 ~1px，模型放弃方形字（中 0.014-0.19）；4.3% 中 0.88
        const val BBOX_THRESHOLD = 200
        const val BBOX_PAD_RATIO = 0.10f
        const val BBOX_PAD_MIN_PX = 4
        /** Melnyk-Net 输入：88×88 内容 + 4px 白边 = 96×96。 */
        const val MELNYK_SIZE = 96
        const val MELNYK_INNER = 88
        const val MELNYK_MARGIN = 4
        const val CANDIDATE_LIMIT = 8
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

    /** §4.2（v2）：内容 bbox 裁剪（复用 [cropToContent]）→ pad 成正方形
     * （白）→ 双线性缩到 [HandwritingEngine.MELNYK_INNER]×88 → 四边
     * [HandwritingEngine.MELNYK_MARGIN]px 白边 → 反色 → uint8 NHWC
     * (96,96,1)。反色后笔画=高值（训练口径 preprocess_bitmap：255-bitmap），
     * 值域保持 0-255 uint8（BN 吸收尺度，不归一）。
     * 空内容返回空数组（调用方按无识别处理）。 */
    fun preprocessMelnyk(
        pixels: IntArray,
        width: Int,
        height: Int,
    ): ByteArray {
        val crop = cropToContent(pixels, width, height)
        if (crop.pixels.isEmpty() || crop.width <= 0 || crop.height <= 0) return ByteArray(0)
        // pad 成正方形（短边两侧补白）
        val pad = abs(crop.width - crop.height) / 2
        val squareSize = max(crop.width, crop.height)
        val square = IntArray(squareSize * squareSize) { 0xFFFFFFFF.toInt() }
        for (y in 0 until crop.height) {
            val targetY = y + (if (crop.height < crop.width) pad else 0)
            for (x in 0 until crop.width) {
                val targetX = x + (if (crop.width < crop.height) pad else 0)
                square[targetY * squareSize + targetX] = crop.pixels[y * crop.width + x]
            }
        }
        val inner = HandwritingEngine.MELNYK_INNER
        val resized = resizeBilinear(square, squareSize, squareSize, inner, inner)
        val size = HandwritingEngine.MELNYK_SIZE
        val margin = HandwritingEngine.MELNYK_MARGIN
        val output = ByteArray(size * size)
        for (y in 0 until size) {
            for (x in 0 until size) {
                val inside = x in margin until margin + inner && y in margin until margin + inner
                // 反色：白(255)→0，笔画(黑→反成高值)
                val value = if (inside) {
                    255 - ((resized[(y - margin) * inner + (x - margin)] and 0xFF))
                } else 0
                output[y * size + x] = value.toByte()
            }
        }
        return output
    }

    /** §4.3（v2）：softmax 输出直排 top-[limit]。概率已是模型归一值，
     * score 原样输出（不再二次归一）；下标 = 词表下标。 */
    fun rankSoftmax(
        probs: FloatArray,
        vocabulary: List<String>,
        limit: Int,
    ): List<InkCandidate> {
        val order = Array(probs.size) { it }
        order.sortByDescending { probs[it] }
        return order.take(limit.coerceAtMost(probs.size))
            .mapNotNull { index ->
                vocabulary.getOrNull(index)?.takeIf { it.isNotEmpty() }
                    ?.let { InkCandidate(it, probs[index]) }
            }
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

    private const val MAX_STROKES = 64
    private const val MAX_POINTS_PER_STROKE = 512
}
