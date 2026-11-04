package com.feelime.ime

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.util.Log
import java.nio.ByteBuffer
import java.nio.FloatBuffer
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** 手写引擎公共面（issue #84：引擎已统一为 ochwpro，Melnyk-Net 于
 * 2026-11-04 退役删除）。 */
interface InkEngine {
    fun isModelAvailable(): Boolean
    fun recognizeInk(reqId: Int, payload: String, pageToken: String)
    fun release()
}

/** 手写识别回调契约（原 HandwritingEngine.Listener，类删后提升顶层）。 */
interface InkEngineListener {
    /** 后台线程回调。[error] 为 null 时 [candidates] 有效（可为空）；
     * "unavailable"=模型未落地，"failed"=payload/推理异常。 */
    fun onInkResult(reqId: Int, candidates: List<InkCandidate>, error: String?, pageToken: String)
}

/** ochwpro（曦码开源手写引擎，MIT，issue #84）轨迹原生识别。
 *
 * 输入不栅格化：墨迹点列按 `preprocessing.rs` 的口径转 5 维特征
 * （x,y 各自 bbox 归一化、dx,dy 增量、每笔末点 pen_down=0），喂
 * StrokeTransformer int8（7356 类，2.1MB）。模型内置生产资产
 * （`app/src/main/assets/ochwpro/`，2026-11-04 整体切换后）。
 *
 * 预处理必须与上游逐值同构，否则精度不可比：纯函数在 [OchwproInk]，
 * JVM 单测拿 Python 镜像生成的 fixtures 逐值核对。 */
class OchwproEngine(
    private val context: Context,
    private val listener: InkEngineListener,
) : InkEngine {
    private val engineId = engineIds.incrementAndGet()
    private val worker = InkWorkQueue { task ->
        Thread(task, "feelime-ink-ochwpro").apply {
            setUncaughtExceptionHandler { thread, failure ->
                Log.e(TAG, "ink worker uncaught on ${thread.name}", failure)
                Diagnostics.logCritical("inkWorker", "e=$engineId thread=${thread.name} ${failure.javaClass.name}")
            }
        }
    }
    @Volatile private var session: OrtSession? = null
    private var environment: OrtEnvironment? = null
    private var vocabulary: List<String> = emptyList()
    @Volatile private var released = false

    override fun isModelAvailable(): Boolean =
        runCatching { context.assets.open(MODEL_FILE).close() }.isSuccess

    override fun recognizeInk(reqId: Int, payload: String, pageToken: String) {
        if (released) return
        worker.submit {
            Diagnostics.logCritical("inkReq", "start e=$engineId ochwpro req=$reqId chars=${payload.length}")
            val result = runCatching { recognize(reqId, payload) }.getOrElse { failure ->
                Log.w(TAG, "ochwpro recognition failed req=$reqId", failure)
                Diagnostics.logCritical("inkFail", "e=$engineId ochwpro req=$reqId ${failure.javaClass.name}: " +
                    "${(failure.message ?: "").take(110)}")
                OchwproResult(reqId, emptyList(), "failed")
            }
            if (!released) runCatching {
                listener.onInkResult(result.reqId, result.candidates, result.error, pageToken)
            }.onFailure {
                Log.w(TAG, "ink result dispatch failed", it)
                Diagnostics.logCritical("inkDispatch", "e=$engineId ochwpro req=$reqId ${it.javaClass.name}")
            }
        }
    }

    override fun release() {
        released = true
        worker.close {
            runCatching { session?.close() }
            session = null
        }
    }

    private fun recognize(reqId: Int, payload: String): OchwproResult {
        val request = HandwritingInk.parseInkRequest(payload) ?: run {
            Diagnostics.logCritical("inkSkip", "reason=parse e=$engineId ochwpro req=$reqId")
            return OchwproResult(reqId, emptyList(), "failed")
        }
        val activeSession = ensureSession() ?: return OchwproResult(reqId, emptyList(), "unavailable")
        val vocab = ensureVocabulary() ?: return OchwproResult(reqId, emptyList(), "unavailable")
        val decimated = OchwproInk.decimate(request.strokes, DENSITY_CAP, request.originalStrokeSizes)
        val features = OchwproInk.strokesToSequence(decimated)
        val t = features.size / FEATURE_DIM
        val env = checkNotNull(environment)
        val started = android.os.SystemClock.elapsedRealtime()
        val points = OnnxTensor.createTensor(
            env, FloatBuffer.wrap(features), longArrayOf(1, t.toLong(), FEATURE_DIM.toLong()),
        )
        points.use { p ->
            OnnxTensor.createTensor(
                env, ByteBuffer.wrap(ByteArray(t) { 1 }), longArrayOf(1, t.toLong()), OnnxJavaType.BOOL,
            ).use { m ->
                activeSession.run(mapOf("points" to p, "mask" to m)).use { output ->
                    @Suppress("UNCHECKED_CAST")
                    val logits = (output.get(0).value as Array<FloatArray>)[0]
                    val elapsed = android.os.SystemClock.elapsedRealtime() - started
                    Diagnostics.logCritical("inkInfer", "e=$engineId ochwpro req=$reqId T=$t ms=$elapsed")
                    return OchwproResult(reqId, topSoftmax(logits, vocab, TOP_K), null)
                }
            }
        }
    }

    private fun ensureSession(): OrtSession? {
        session?.let { return it }
        if (released) return null
        val bytes = runCatching { context.assets.open(MODEL_FILE).use { it.readBytes() } }.getOrNull()
            ?: return null
        val env = environment ?: OrtEnvironment.getEnvironment().also { environment = it }
        return runCatching {
            OrtSession.SessionOptions().use { options ->
                options.setIntraOpNumThreads(2)
                env.createSession(bytes, options).also { session = it }
            }
        }.onFailure {
            Log.w(TAG, "ochwpro session create failed", it)
        }.getOrNull()
    }

    private fun ensureVocabulary(): List<String>? {
        if (vocabulary.isNotEmpty()) return vocabulary
        val chars = runCatching {
            val root = org.json.JSONObject(context.assets.open(VOCAB_FILE).use { it.readBytes().decodeToString() })
            val array = root.getJSONArray("chars")
            (0 until array.length()).map { array.getString(it) }
        }.getOrElse {
            Log.w(TAG, "ochwpro vocab unreadable", it)
            emptyList()
        }
        if (chars.isEmpty()) return null
        vocabulary = chars
        return vocabulary
    }

    private fun topSoftmax(logits: FloatArray, vocab: List<String>, k: Int): List<InkCandidate> {
        var maxLogit = Float.NEGATIVE_INFINITY
        for (v in logits) maxLogit = max(maxLogit, v)
        val exps = FloatArray(logits.size)
        var sum = 0f
        for (i in logits.indices) {
            exps[i] = exp(logits[i] - maxLogit)
            sum += exps[i]
        }
        return logits.withIndex()
            .sortedByDescending { it.value }
            .take(k)
            .map { (index, _) -> InkCandidate(vocab.getOrElse(index) { "?" }, exps[index] / sum) }
    }

    private data class OchwproResult(
        val reqId: Int,
        val candidates: List<InkCandidate>,
        val error: String?,
    )

    companion object {
        private val engineIds = AtomicInteger()
        private const val TAG = "FeelimeInkOchwpro"
        const val MODEL_FILE = "ochwpro/model.int8.onnx"
        const val VOCAB_FILE = "ochwpro/vocab.json"
        const val FEATURE_DIM = 5

        /** 模型位置编码表上限（max_seq_len=512，CLS 另占 1 位）。 */
        const val MAX_SEQ_LEN = 512

        /** 训练分布密度顶：上游 CASIA 每字仅 8-24 点（dataset.py 增强
         * 只做 0.15-1.0 随机下采样，模型从未见过稠密输入）。实测密度
         * 曲线（cand2 九字 host 复算）：总点数 ≤48 稳 top8 8/9，≥160
         * 全崩 0/9（键盘 JS 平滑重采样 3px 步进实测 T≈217 → 乱码）。
         * 识别前先按此钳密度（decimate 保端点等比），MAX_SEQ_LEN 只是
         * 其上的硬上限。 */
        const val DENSITY_CAP = 48
        const val TOP_K = 8

    }
}

/** 预处理纯函数（`preprocessing.rs` strokes_to_tensor 的 Kotlin 镜像 +
 * 序列长度钳制）。JVM 单测逐值核对，模型不进单测。 */
object OchwproInk {
    /** 每笔末点 pen_down=0（抬笔）；坐标各自 bbox 归一化到 [0,1]（非等比，
     * 与上游一致）；dx,dy 为相邻点增量。返回摊平的 (T*5)。 */
    fun strokesToSequence(strokes: List<List<HandwritingInk.InkPoint>>): FloatArray {
        val xs = ArrayList<Float>()
        val ys = ArrayList<Float>()
        val pens = ArrayList<Float>()
        for (stroke in strokes) {
            for ((index, point) in stroke.withIndex()) {
                xs.add(point.x)
                ys.add(point.y)
                pens.add(if (index == stroke.lastIndex) 0f else 1f)
            }
        }
        if (xs.isEmpty()) return FloatArray(5)
        var minX = Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        for (i in xs.indices) {
            minX = min(minX, xs[i])
            maxX = max(maxX, xs[i])
            minY = min(minY, ys[i])
            maxY = max(maxY, ys[i])
        }
        val rangeX = max(maxX - minX, 1f)
        val rangeY = max(maxY - minY, 1f)
        val features = FloatArray(xs.size * 5)
        var prevX = xs[0]
        var prevY = ys[0]
        for (i in xs.indices) {
            features[i * 5] = (xs[i] - minX) / rangeX
            features[i * 5 + 1] = (ys[i] - minY) / rangeY
            features[i * 5 + 2] = (xs[i] - prevX) / rangeX
            features[i * 5 + 3] = (ys[i] - prevY) / rangeY
            features[i * 5 + 4] = pens[i]
            prevX = xs[i]
            prevY = ys[i]
        }
        return features
    }

    /** 总点数超 [maxPoints] 时按笔画等比抽稀：每笔保首末点（末点承载
     * pen_down=0 语义），不足保 1 点。不超时原样返回。 */
    fun decimate(
        strokes: List<List<HandwritingInk.InkPoint>>,
        maxPoints: Int,
        originalStrokeSizes: List<Int>? = null,
    ): List<List<HandwritingInk.InkPoint>> {
        if (originalStrokeSizes != null) {
            require(originalStrokeSizes.size == strokes.size)
            val total = originalStrokeSizes.sum()
            val scale = maxPoints.toFloat() / total
            require(strokes.indices.all { i ->
                val original = originalStrokeSizes[i]
                original > 0 && strokes[i].size == if (total <= maxPoints) original
                    else (original * scale).roundToInt().coerceIn(1, original)
            }) { "invalid pre-decimated stroke sizes" }
            return strokes
        }
        val total = strokes.sumOf { it.size }
        if (total <= maxPoints) return strokes
        val scale = maxPoints.toFloat() / total
        val out = ArrayList<List<HandwritingInk.InkPoint>>(strokes.size)
        for (stroke in strokes) {
            val keep = (stroke.size * scale).roundToInt().coerceIn(1, stroke.size)
            if (keep >= stroke.size) {
                out.add(stroke)
                continue
            }
            val picked = ArrayList<HandwritingInk.InkPoint>(keep)
            // keep==1（短笔画被抽到单点，真实书写「藏」等多笔字的点/提
            // 正中此分支）时索引分母为 0——ArithmeticException 让整次识
            // 别回 error（验收实录 2026-11-01）。保首点：坐标语义上短笔
            // 两端近乎重合，pen_down=1 的起笔标记不丢。
            val indexSpan = (keep - 1).coerceAtLeast(1)
            for (j in 0 until keep) {
                val index = (j.toLong() * (stroke.size - 1).toLong() / indexSpan).toInt()
                picked.add(stroke[index])
            }
            out.add(picked)
        }
        return out
    }
}
