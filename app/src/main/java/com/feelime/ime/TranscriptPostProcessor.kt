package com.feelime.ime

import android.content.Context
import android.util.Log
import com.feelime.ime.engine.ChineseNumberItn
import com.feelime.ime.engine.ItnClassifier
import com.k2fsa.sherpa.onnx.OfflinePunctuation
import com.k2fsa.sherpa.onnx.OfflinePunctuationConfig
import com.k2fsa.sherpa.onnx.OfflinePunctuationModelConfig
import java.util.Locale

/** Restores readable sentence marks for mixed Chinese-English transcripts while
 * keeping the existing English normalization and sentence-ending policy.
 * 句尾句号默认剥掉（ 的行为），可在「语音识别设置」
 *  里关闭（feelime_asr/strip_final_period=false 时保留模型给的标点）。 */
class TranscriptPostProcessor(
    context: Context,
    modelStore: ModelStore? = null,
    source: ModelSource? = (modelStore ?: ModelStore(context)).sourceFor("punctuation"),
) {
    private val appContext = context.applicationContext
    // Model source precedence (design §12.3): assets win, else the verified filesDir download;
    // with neither, punctuation degrades to no-op instead of feeding sherpa
    // a missing file (sherpa exit(-1)s the process on those).
    private val punctuation = source?.let {
        runCatching {
            OfflinePunctuation(
                if (it is ModelSource.Assets) context.assets else null,
                OfflinePunctuationConfig(
                    OfflinePunctuationModelConfig(
                        ctTransformer = it.pathFor("punctuation/model.int8.onnx"),
                        numThreads = 1,
                        provider = "cpu",
                    ),
                ),
            )
        }.onFailure { Log.w(TAG, "Punctuation model unavailable", it) }.getOrNull()
    }

    fun partial(text: String): String = EnglishTextNormalizer.normalize(text)

    fun final(text: String): String {
        val normalized = partial(text)
        if (normalized.isBlank()) return ""
        // 数字 ITN（#78）在标点恢复之前：识别原文里数字段以词界/句尾收束，
        // 标点模型插逗号后句尾裸段规则（「一共十二」）会失配；模型对含
        // 阿拉伯数字的输入同样在域内。关闭开关则原文进标点模型。
        val itnEnabled = appContext.getSharedPreferences("feelime_asr", Context.MODE_PRIVATE)
            .getBoolean(AsrSettings.KEY_ITN, false)
        val converted = if (itnEnabled) {
            // 开放面分类器随语音后处理器加载（资源缺失静默降级严格 KEEP）
            if (!ItnClassifier.loaded) {
                ItnClassifier.load(appContext)
                ChineseNumberItn.classifier = ItnClassifier
            }
            ChineseNumberItn.apply(normalized)
        } else normalized
        val restored = EnglishTextNormalizer.normalizeDigitPunctSpacing(
            punctuation?.addPunctuation(converted)?.trim().orEmpty().ifBlank { converted },
        )
        val stripPeriod = appContext.getSharedPreferences("feelime_asr", Context.MODE_PRIVATE)
            .getBoolean(AsrSettings.KEY_STRIP_FINAL_PERIOD, true)
        return if (stripPeriod) EnglishTextNormalizer.ensureTerminalPunctuation(restored) else restored
    }

    fun release() {
        punctuation?.release()
    }

    private companion object {
        const val TAG = "FeelimePostProcess"
    }
}

object EnglishTextNormalizer {
    private val spacedSuffix = Regex(
        "\\b(i|you|we|they|he|she|it|what|that|there|here|who|where|when|why|how)\\s+" +
            "(m|re|ve|ll|d|s)\\b",
    )
    private val spacedNegative = Regex("\\b(can|could|would|should|do|does|did|is|are|was|were|have|has|had|wo)\\s+t\\b")
    private val bareContractions = linkedMapOf(
        "whats" to "what's", "thats" to "that's", "theres" to "there's",
        "heres" to "here's", "whos" to "who's", "wheres" to "where's",
        "hows" to "how's", "im" to "i'm", "youre" to "you're",
        "youve" to "you've", "youll" to "you'll",
        "weve" to "we've", "theyre" to "they're", "theyve" to "they've",
        "hes" to "he's", "shes" to "she's", "dont" to "don't",
        "doesnt" to "doesn't", "didnt" to "didn't", "cant" to "can't",
        "couldnt" to "couldn't", "wouldnt" to "wouldn't", "shouldnt" to "shouldn't",
        "wont" to "won't", "isnt" to "isn't", "arent" to "aren't",
        "wasnt" to "wasn't", "werent" to "weren't", "havent" to "haven't",
        "hasnt" to "hasn't", "hadnt" to "hadn't",
    )
    private val whitespace = Regex("\\s+")
    private val contractionPatterns = bareContractions.map { (plain, replacement) ->
        Regex("\\b$plain\\b") to replacement
    }
    private val terminalPunctuation = Regex("[.!?。！？…]$")
    private val englishQuestion = Regex(
        "^(what|who|whose|where|when|why|how|is|are|am|was|were|do|does|did|" +
            "can|could|would|will|should|have|has|had)\\b",
    )

    fun normalize(text: String): String {
        var value = text.trim().replace(whitespace, " ").lowercase(Locale.ENGLISH)
        value = spacedSuffix.replace(value) { "${it.groupValues[1]}'${it.groupValues[2]}" }
        value = spacedNegative.replace(value) {
            val stem = it.groupValues[1]
            if (stem == "wo") "won't" else "${stem}n't"
        }
        contractionPatterns.forEach { (pattern, contraction) ->
            value = pattern.replace(value, contraction)
        }
        return value
    }

    private val digitPunctSpacing = Regex("(\\d) +([.,]) +(?=\\d)")

    /** 标点模型输出归一：数字间标点两侧的空格压掉——口语标点模型把
     *  ITN 产物 1.23 排成 "1 . 23"（英文标点空格习惯），中文数字排版
     *  无空格。右侧数字用环视不消费，链式 "1 . 2 . 3" 一次压成 1.2.3；
     *  标点两侧都须是数字，句尾句点与普通英文短语不误伤。 */
    fun normalizeDigitPunctSpacing(text: String): String =
        digitPunctSpacing.replace(text, "$1$2")

    fun ensureTerminalPunctuation(text: String): String {
        val clean = text.trim()
        if (clean.isEmpty()) return clean
        if (terminalPunctuation.containsMatchIn(clean)) {
            // 语音结果默认不以句号收尾 —— 标点模型（或上一版
            // 的兜底）给的句尾句号剥掉；问号/叹号/省略号自带语义，保留。
            // 剥掉后 trimEnd："ok ." 这类模型输出不留尾巴。
            return if (clean.last() in ".。") clean.dropLast(1).trimEnd() else clean
        }
        val lower = clean.lowercase(Locale.ENGLISH)
        return when {
            clean.last() in "吗呢么" -> "$clean？"
            englishQuestion.containsMatchIn(lower) -> "$clean?"
            else -> clean
        }
    }
}
