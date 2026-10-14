package com.feelime.ime

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.NodeInfo
import ai.onnxruntime.OnnxJavaType
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
import java.util.concurrent.atomic.AtomicInteger
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
        fun onInkResult(reqId: Int, candidates: List<InkCandidate>, error: String?, pageToken: String)
    }

    private val engineId = engineIds.incrementAndGet()
    private var activeRequest = -1
    private val worker = InkWorkQueue { task ->
        Thread(task, "feelime-ink").apply {
            setUncaughtExceptionHandler { thread, failure ->
                Log.e(TAG, "ink worker uncaught on ${thread.name}", failure)
                Diagnostics.logCritical("inkWorker", "e=$engineId thread=${thread.name} ${failure.javaClass.name}")
            }
        }
    }
    private val modelStore = ModelStore(context)
    @Volatile private var session: OrtSession? = null
    private var environment: OrtEnvironment? = null
    private var vocabulary: List<String> = emptyList()
    private var inputName: String? = null
    @Volatile private var released = false

    fun isModelAvailable(): Boolean = modelStore.sourceFor(MODEL_ROLE) != null

    fun recognizeInk(reqId: Int, payload: String, pageToken: String) {
        if (released) return
        val arrived = android.os.SystemClock.elapsedRealtime()
        // 主线程只入队；worker 在任何业务 native 调用前同步标记。
        Diagnostics.log("inkReq", "arrive e=$engineId req=$reqId chars=${payload.length}")
        worker.submit {
            activeRequest = reqId
            Diagnostics.logCritical("inkReq", "start e=$engineId req=$reqId tid=${android.os.Process.myTid()} " +
                "waitMs=${android.os.SystemClock.elapsedRealtime() - arrived}")
            val result = runCatching { recognize(reqId, payload) }.getOrElse { failure ->
                Log.w(TAG, "ink recognition failed", failure)
                Diagnostics.logCritical("inkFail", "e=$engineId req=$reqId ${failure.javaClass.name}: " +
                    "${(failure.message ?: "").take(110)}")
                InkResult(reqId, emptyList(), "failed")
            }
            if (!released) runCatching {
                listener.onInkResult(result.reqId, result.candidates, result.error, pageToken)
            }.onFailure {
                Log.w(TAG, "ink result dispatch failed", it)
                Diagnostics.logCritical("inkDispatch", "e=$engineId req=$reqId ${it.javaClass.name}")
            }
        }
    }

    fun release() {
        released = true
        worker.close { closeSession() }
    }

    /** handwriting §12：同一 worker 上的业务 native 段；异常也标记。
     * 绘图的同类逐点调用按一笔分段，避免每个点都同步刷盘。 */
    private inline fun <T> nativeStep(stage: String, block: () -> T): T {
        if (!Diagnostics.isRecording()) return block()
        val start = android.os.SystemClock.elapsedRealtime()
        val detail = "e=$engineId req=$activeRequest tid=${android.os.Process.myTid()} stage=$stage"
        Diagnostics.logCritical("inkNative", "begin $detail")
        return try {
            block().also {
                Diagnostics.logCritical("inkNative", "done $detail ms=${android.os.SystemClock.elapsedRealtime() - start}")
            }
        } catch (failure: Throwable) {
            Diagnostics.logCritical("inkNative", "throw $detail ${failure.javaClass.simpleName}")
            throw failure
        }
    }

    private fun recognize(reqId: Int, payload: String): InkResult {
        val request = HandwritingInk.parseInkRequest(payload) ?: run {
            Diagnostics.logCritical("inkSkip", "reason=parse e=$engineId req=$reqId")
            return InkResult(reqId, emptyList(), "failed")
        }
        Diagnostics.logCritical("inkParse", "e=$engineId req=$reqId strokes=${request.strokes.size} " +
            "points=${request.strokes.sumOf { it.size }}")
        if (!ensureSession()) return InkResult(reqId, emptyList(), "unavailable")
        val activeSession = checkNotNull(session)
        val transform = HandwritingInk.inkTransform(request.strokes, SIZE_PX.toFloat())
        val paint = nativeStep("paint-config") {
            Paint().apply {
                color = android.graphics.Color.BLACK
                isAntiAlias = true
                strokeWidth = SIZE_PX * STROKE_WIDTH_RATIO
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                style = Paint.Style.STROKE
            }
        }
        val bitmap = nativeStep("bitmap-create") {
            Bitmap.createBitmap(SIZE_PX, SIZE_PX, Bitmap.Config.ARGB_8888)
        }
        val pixels = try {
            val canvas = nativeStep("canvas-create") { Canvas(bitmap) }
            nativeStep("canvas-clear") { canvas.drawColor(android.graphics.Color.WHITE) }
            request.strokes.forEachIndexed { index, stroke ->
                val first = stroke.first()
                if (stroke.size == 1) {
                    nativeStep("point-draw/$index") {
                        canvas.drawPoint(first.x * transform.scale + transform.offsetX,
                            first.y * transform.scale + transform.offsetY, paint)
                    }
                } else {
                    val path = nativeStep("path-build/$index") {
                        Path().apply {
                            moveTo(first.x * transform.scale + transform.offsetX,
                                first.y * transform.scale + transform.offsetY)
                            stroke.drop(1).forEach { point ->
                                lineTo(point.x * transform.scale + transform.offsetX,
                                    point.y * transform.scale + transform.offsetY)
                            }
                        }
                    }
                    nativeStep("path-draw/$index") { canvas.drawPath(path, paint) }
                }
            }
            IntArray(SIZE_PX * SIZE_PX).also { pixels ->
                nativeStep("bitmap-pixels") { bitmap.getPixels(pixels, 0, SIZE_PX, 0, 0, SIZE_PX, SIZE_PX) }
            }
        } finally { nativeStep("bitmap-recycle") { bitmap.recycle() } }
        val input = HandwritingInk.preprocessMelnyk(pixels, SIZE_PX, SIZE_PX)
        if (input.isEmpty()) return InkResult(reqId, emptyList(), null)
        if (BuildConfig.DEBUG) runCatching {
            val dir = File(context.filesDir, "ink-inputs").apply { mkdirs() }
            File(dir, "req-%04d.bin".format(reqId)).writeBytes(input)
            File(dir, "payload-%04d.json".format(reqId)).writeText(payload)
        }
        val tensor = nativeStep("tensor-create") {
            OnnxTensor.createTensor(checkNotNull(environment), java.nio.ByteBuffer.wrap(input),
                longArrayOf(1, MELNYK_SIZE.toLong(), MELNYK_SIZE.toLong(), 1), OnnxJavaType.UINT8)
        }
        try {
            val output = nativeStep("session-run") { activeSession.run(mapOf(checkNotNull(inputName) to tensor)) }
            try {
                val probs = nativeStep("output-read") {
                    val result = output[0] as OnnxTensor
                    require(result.info.type == OnnxJavaType.FLOAT) { "output must be float" }
                    val buffer = result.floatBuffer
                    require(buffer.remaining() == vocabulary.size) { "output length does not match vocabulary" }
                    FloatArray(buffer.remaining()).also { buffer.get(it) }
                }
                val candidates = HandwritingInk.rankSoftmax(probs, vocabulary, CANDIDATE_LIMIT)
                Diagnostics.logCritical("inkDecode", "e=$engineId req=$reqId n=${candidates.size}")
                return InkResult(reqId, candidates, null)
            } finally { nativeStep("output-close") { output.close() } }
        } finally { nativeStep("tensor-close") { tensor.close() } }
    }

    private fun loadVocabulary(): List<String> = context.assets.open(VOCAB_ASSET).use { stream ->
        val parsed = org.json.JSONArray(stream.readBytes().decodeToString())
        List(parsed.length()) { parsed.optString(it) }
    }

    private fun sourceLabel(source: ModelSource): String = when (source) {
        is ModelSource.Assets -> "assets"
        is ModelSource.Directory -> "dir:" + File(source.root).name
    }

    private fun ensureSession(): Boolean {
        if (session != null) return true
        var pending: OrtSession? = null
        return try {
            val source = nativeStep("model-source") { modelStore.sourceFor(MODEL_ROLE) } ?: return false
            val bytes = nativeStep("model-read") {
                when (source) {
                    is ModelSource.Assets -> context.assets.open(MODEL_FILE).use { it.readBytes() }
                    is ModelSource.Directory -> File(source.root, MODEL_FILE).readBytes()
                }
            }
            val sha = java.security.MessageDigest.getInstance("SHA-256").digest(bytes)
                .take(8).joinToString("") { "%02x".format(it) }
            Diagnostics.logCritical("inkSession", "e=$engineId model=${sourceLabel(source)} bytes=${bytes.size} sha=$sha")
            val env = nativeStep("environment-create") { OrtEnvironment.getEnvironment() }
            val version = nativeStep("runtime-version") { env.version }
            Diagnostics.logCritical("inkRuntime", "e=$engineId ort=$version heapKb=${Runtime.getRuntime().totalMemory() / 1024}")
            val options = nativeStep("options-create") { OrtSession.SessionOptions() }
            val created = try {
                nativeStep("options-threads") { options.setIntraOpNumThreads(1) }
                nativeStep("session-create") { env.createSession(bytes, options) }.also { pending = it }
            } finally { nativeStep("options-close") { options.close() } }
            Diagnostics.logCritical("inkSession", "e=$engineId created")
            val vocab = nativeStep("vocabulary-read") { loadVocabulary() }
            require(vocab.isNotEmpty()) { "vocabulary empty" }
            val inputs = nativeStep("input-info") { created.inputInfo }
            val outputs = nativeStep("output-info") { created.outputInfo }
            val name = HandwritingInk.validateModelInfo(inputs, outputs, vocab.size)
            Diagnostics.logCritical("inkSession", "e=$engineId outInfoRead n=${vocab.size}")
            environment = env
            vocabulary = vocab
            inputName = name
            session = created
            pending = null // 所有权移交；失败时 finally 只清理未移交的会话。
            Diagnostics.logCritical("inkSession", "e=$engineId ready vocab=${vocab.size}")
            true
        } catch (failure: Throwable) {
            Log.w(TAG, "handwriting model load failed", failure)
            Diagnostics.logCritical("inkSession", "e=$engineId fail ${failure.javaClass.name}: ${(failure.message ?: "").take(100)}")
            false
        } finally {
            pending?.let { failed ->
                runCatching { nativeStep("session-close-unowned") { failed.close() } }
                    .onFailure { Log.w(TAG, "failed session close", it) }
            }
        }
    }

    private fun closeSession() {
        val owned = session
        session = null
        inputName = null
        vocabulary = emptyList()
        environment = null // OrtEnvironment 是进程共享对象，不在这里 close。
        if (owned != null) runCatching { nativeStep("session-close") { owned.close() } }
            .onFailure { Log.w(TAG, "ink session close failed", it) }
    }

    private data class InkResult(
        val reqId: Int,
        val candidates: List<InkCandidate>,
        val error: String?,
    )

    companion object {
        private val engineIds = AtomicInteger()
        private const val TAG = "FeelimeInk"
        const val MAX_PAYLOAD_CHARS = 512 * 1024
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
    internal fun validateModelInfo(inputs: Map<String, NodeInfo>, outputs: Map<String, NodeInfo>, vocab: Int): String {
        require(inputs.size == 1 && outputs.size == 1) { "expected one input and output" }
        val input = inputs.values.single().info as? TensorInfo ?: error("input must be tensor")
        val output = outputs.values.single().info as? TensorInfo ?: error("output must be tensor")
        fun singleBatch(shape: LongArray, tail: LongArray): Boolean =
            shape.size == tail.size + 1 && shape[0] in longArrayOf(-1, 1) &&
                shape.copyOfRange(1, shape.size).contentEquals(tail)
        require(input.type == OnnxJavaType.UINT8 && singleBatch(input.shape, longArrayOf(96, 96, 1))) {
            "input ${input.type} ${input.shape.contentToString()} must be uint8 [1,96,96,1]"
        }
        require(output.type == OnnxJavaType.FLOAT && singleBatch(output.shape, longArrayOf(vocab.toLong()))) {
            "output ${output.type} ${output.shape.contentToString()} must be float [1,$vocab]"
        }
        return inputs.keys.single()
    }

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
        // 二值化（otsu，resize 前）：训练数据（CASIA）是扫描位图，笔画边缘
        // 干净；Android Canvas 抗锯齿的灰边若带进 resize 会让有效线宽变糊，
        // 真机实测「就」因此 rank4，硬边重渲染 rank1（issue #28 真迹采集
        // 2026-09-22）。阈值化在缩放前做，细节先落定再缩。
        val binarized = otsuBinarize(crop.pixels)
        // pad 成正方形（短边两侧补白）
        val pad = abs(crop.width - crop.height) / 2
        val squareSize = max(crop.width, crop.height)
        val square = IntArray(squareSize * squareSize) { 0xFFFFFFFF.toInt() }
        for (y in 0 until crop.height) {
            val targetY = y + (if (crop.height < crop.width) pad else 0)
            for (x in 0 until crop.width) {
                val targetX = x + (if (crop.width < crop.height) pad else 0)
                square[targetY * squareSize + targetX] = binarized[y * crop.width + x]
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

    /** otsu 二值化（256 级直方图，类间方差最大阈值），输出纯黑/纯白
     * ARGB。空输入返回原数组。 */
    fun otsuBinarize(pixels: IntArray): IntArray {
        if (pixels.isEmpty()) return pixels
        val histogram = IntArray(256)
        for (pixel in pixels) histogram[pixel and 0xFF]++
        val total = pixels.size
        var sumAll = 0.0
        for (t in 0 until 256) sumAll += t.toDouble() * histogram[t]
        var weightBg = 0.0
        var sumBg = 0.0
        var bestThreshold = 127
        var bestVariance = -1.0
        for (t in 0 until 256) {
            weightBg += histogram[t]
            if (weightBg == 0.0) continue
            val weightFg = total - weightBg
            if (weightFg == 0.0) break
            sumBg += t.toDouble() * histogram[t]
            val meanBg = sumBg / weightBg
            val meanFg = (sumAll - sumBg) / weightFg
            val variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg)
            if (variance > bestVariance) {
                bestVariance = variance
                bestThreshold = t
            }
        }
        return IntArray(pixels.size) { index ->
            if ((pixels[index] and 0xFF) <= bestThreshold) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
        }
    }

    /** §4.3（v2）：softmax 输出直排 top-[limit]。概率已是模型归一值，
     * score 原样输出（不再二次归一）；下标 = 词表下标。 */
    fun rankSoftmax(
        probs: FloatArray,
        vocabulary: List<String>,
        limit: Int,
    ): List<InkCandidate> {
        require(probs.all { it.isFinite() }) { "non-finite model output" }
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
