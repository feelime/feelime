package com.feelime.ime.engine

import android.content.Context
import java.io.DataInputStream

/**
 * ITN 开放面分类器：字符 n-gram + 词典词频特征的逻辑回归（scripts/
 * itn-train 训练、assets 冻结权重，~/tmp/itn-cls 原型验证同构）。
 *
 * 特征与权重必须与训练侧逐 bit 对齐（FNV-1a 32 位哈希 + 相同特征串
 * 拼接），对拍金样在 ItnClassifierGoldenTest。资源缺失/损坏 → 未加载
 * 状态恒 false（KEEP，宁少转不误转）。
 *
 * 资源格式（itn-model.bin，小端）：
 *   u32 magic=0x49544E31 ("ITN1")  u32 特征槽数
 *   u32 非零权重数 N
 *   N × (u32 slot, f32 weight)
 * 词典（itn-lexicon.bin，小端）：
 *   u32 magic=0x49544C31 ("ITL1")  u32 词条数 M
 *   M × (u16 词字节长, UTF-8 词面, u32 词频)
 */
object ItnClassifier {

    private const val MODEL_ASSET = "itn/itn-model.bin"
    private const val LEXICON_ASSET = "itn/itn-lexicon.bin"
    private const val WINDOW = 8
    private const val SLOTS = 1 shl 18

    @Volatile private var weights: HashMap<Int, Float>? = null
    @Volatile private var lexicon: HashMap<String, Int>? = null
    @Volatile private var bias = 0f

    val loaded: Boolean get() = weights != null

    /** 语音会话初始化时加载（worker 线程）；失败静默保持未加载。 */
    fun load(context: Context) {
        if (weights != null) return
        runCatching {
            val w = parseModel(context.assets.open(MODEL_ASSET))
            val lex = parseLexicon(context.assets.open(LEXICON_ASSET))
            weights = w
            lexicon = lex
        }.onFailure { weights = null }
    }

    /** JVM 单测/工具入口：直接读资源文件。 */
    fun loadFiles(model: java.io.File, lexiconFile: java.io.File) {
        weights = parseModel(model.inputStream())
        lexicon = parseLexicon(lexiconFile.inputStream())
    }

    private fun parseModel(input: java.io.InputStream): HashMap<Int, Float> {
        val w = HashMap<Int, Float>()
        DataInputStream(input).use { d ->
            check(d.readInt() == 0x49544E31) { "bad model magic" }
            check(d.readInt() == SLOTS) { "bad slot count" }
            // 帧序与导出端一致：magic, slots, n(u32), bias(f32)
            val count = d.readInt()
            bias = d.readFloat()
            repeat(count) { w[d.readInt()] = d.readFloat() }
        }
        return w
    }

    private fun parseLexicon(input: java.io.InputStream): HashMap<String, Int> {
        val lex = HashMap<String, Int>()
        DataInputStream(input).use { d ->
            check(d.readInt() == 0x49544C31) { "bad lexicon magic" }
            repeat(d.readInt()) {
                val bytes = ByteArray(d.readUnsignedShort())
                d.readFully(bytes)
                lex[String(bytes, Charsets.UTF_8)] = d.readInt()
            }
        }
        return lex
    }

    fun release() {
        weights = null
        lexicon = null
    }

    /** 开放面裁决：true = 转。未加载恒 false。 */
    fun decide(text: String, start: Int, end: Int): Boolean {
        val w = weights ?: return false
        var z = bias
        for (f in features(text, start, end)) {
            w[hashFeature(f)]?.let { z += it }
        }
        return sigmoid(z) >= 0.5f
    }

    // ---------------------------------------------------------- 特征（与训练侧对拍）

    internal fun features(text: String, start: Int, end: Int): List<String> {
        val seg = text.substring(start, end)
        val left = text.substring(maxOf(0, start - WINDOW), start)
        val right = text.substring(end, minOf(text.length, end + WINDOW))
        val fs = ArrayList<String>(128)
        for ((ctx, tag) in listOf(left to "L", right to "R")) {
            for (n in 1..3) {
                for (i in 0..ctx.length - n) {
                    fs.add("$tag$n:${ctx.substring(i, i + n)}")
                }
            }
        }
        if (left.isNotEmpty()) fs.add("XL:${left.last()}[${seg.take(1)}]")
        if (right.isNotEmpty()) fs.add("XR:[${seg.takeLast(1)}]${right.first()}")
        fs.add("S:len${minOf(seg.length, 6)}")
        fs.add("S:head${seg.first()}")
        fs.add("S:tail${seg.last()}")
        if (seg.any { it in SCALE_WORDS }) fs.add("S:scale")
        if (seg.all { it in DIGITS }) fs.add("S:puredigits")
        for (i in 0 until seg.length - 1) fs.add("S:bi${seg.substring(i, i + 2)}")
        if (right.isNotEmpty()) {
            fs.add("S+R1:${seg.takeLast(1)}${right.first()}")
            fs.add("R1:${right.first()}")
        }
        if (left.isNotEmpty()) fs.add("L1:${left.last()}")
        lexicon?.let { lex ->
            val lo = maxOf(0, start - 3)
            val hi = minOf(text.length, end + 3)
            for (s in lo until end) {
                for (e in maxOf(end, s + 2)..hi) {
                    val word = text.substring(s, e)
                    val freq = lex[word] ?: continue
                    fs.add("D:$word")
                    fs.add("D:f${freqBucket(freq)}")
                    val ext = word.length - (end - start)
                    val side = when {
                        ext == 0 -> "E"
                        text.indexOf(word) < start -> "L"
                        else -> "R"
                    }
                    fs.add("D:ext$side$ext${freqBucket(freq)}")
                }
            }
        }
        return fs
    }

    private val SCALE_WORDS = setOf('十', '百', '千', '万', '亿')
    private val DIGITS = setOf('零', '一', '二', '两', '三', '四', '五', '六', '七', '八', '九')

    private fun freqBucket(f: Int): Int {
        var v = f + 1
        var bucket = 0
        while (v >= 10) {
            v /= 10
            bucket++
        }
        return minOf(bucket, 5)
    }

    /** FNV-1a 32 位——与训练侧 python 实现逐 bit 一致（金样对拍）。 */
    internal fun hashFeature(s: String): Int {
        var h = 0x811C9DC5.toInt()
        for (ch in s) {
            h = h xor ch.code
            h *= 0x01000193
        }
        return ((h.toLong() and 0xFFFFFFFFL) % SLOTS).toInt()
    }

    private fun sigmoid(z: Float): Float =
        if (z >= 0) {
            if (z < 35f) 1f / (1f + kotlin.math.exp(-z)) else 1f
        } else {
            if (z > -35f) kotlin.math.exp(z) / (1f + kotlin.math.exp(z)) else 0f
        }
}
