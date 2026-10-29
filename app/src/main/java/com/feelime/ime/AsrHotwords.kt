package com.feelime.ime

import android.content.Context
import java.io.File
import java.security.MessageDigest
import java.util.Locale

/** Raw phrases for sherpa's cjkchar+bpe encoder; never pre-tokenize twice. */
object AsrHotwords {
    const val MAX_WEIGHT = 20.0
    const val MAX_LINES = 50
    const val MAX_CHARS_PER_LINE = 30
    internal const val BPE_ASSET = "asr-hotwords/bpe.vocab"
    internal const val BPE_SHA256 = "d0b642f3a2eacd5fadefdeff9e0e1358cab729647cbb7fe58cf738e1f7407029"
    internal const val TOKENS_SHA256 = "a8e0e4ec53810e433789b54a5c0134a7eaa2ffca595a6334d54c00da858841d3"

    /** Raw lines for the save path and encode(); filtering happens in
     * parseHotwordLines so saved weighted entries like "姚程:15" survive
     * the read (a whole-line length filter here would drop a 30-char word
     * with a weight suffix that the save path accepted). */
    fun load(context: Context): List<String> =
        context.getSharedPreferences("feelime_asr", Context.MODE_PRIVATE)
            .getString("hotwords", null).orEmpty().lines()


    /** JNI can exit the process on invalid configuration. Verify both files
     * before its constructor; the small BPE resource is in full AND thin APKs. */
    fun vocabPath(context: Context, source: ModelSource): String {
        val bpe = context.assets.open(BPE_ASSET).use { it.readBytes() }
        val tokens = readTokens(context, source)
        verifyResources(bpe, tokens)
        if (source is ModelSource.Assets) return BPE_ASSET
        val target = File(context.filesDir, BPE_ASSET)
        target.parentFile!!.mkdirs()
        if (!target.isFile || sha256(target.readBytes()) != BPE_SHA256) {
            val temporary = File(target.parentFile, "bpe.vocab.tmp")
            temporary.writeBytes(bpe)
            check(temporary.renameTo(target)) { "无法准备语音热词词表" }
        }
        return target.absolutePath
    }

    internal fun verifyResources(bpe: ByteArray, tokens: ByteArray) {
        check(sha256(bpe) == BPE_SHA256) { "语音热词词表校验失败，请重新安装应用" }
        check(sha256(tokens) == TOKENS_SHA256) { "语音模型与热词词表不匹配，请重新下载语音模型" }
    }

    fun encode(context: Context, source: ModelSource, words: List<String> = load(context)): EncodedHotwords {
        if (words.isEmpty()) return EncodedHotwords("", emptyList())
        val tokens = readTokens(context, source)
        check(sha256(tokens) == TOKENS_SHA256) { "语音模型与热词词表不匹配，请重新下载语音模型" }
        val vocab = tokens.decodeToString().lineSequence()
            .map { it.substringBefore(' ') }.toSet()
        return encodeWords(words, vocab)
    }

    /** Encoded hotwords: [streamText] goes to createStream (sherpa protocol:
     * '/'-separated phrases, an explicit per-word boost as a trailing " :N");
     * [phrases] is the plain word list for final-pass hotword preservation.
     * Both must come from the same parse so a "姚程:15" entry keeps matching
     * the plain "姚程" in selectFinalText. */
    data class EncodedHotwords(val streamText: String, val phrases: List<String>)

    /** One parsed input line: word normalized (trimmed, single spaces,
     * uppercase); weight is the explicit per-word boost or null for the
     * global default; displayIndex keeps the original line number for
     * error messages after blank-line filtering. */
    internal data class ParsedHotwordLine(val word: String, val weight: Double?, val displayIndex: Int)

    /** Syntax-level parsing shared by the settings save path (no model
     * needed) and encode(). Takes raw lines: blank lines are skipped but
     * original line numbers are preserved in errors, control characters are
     * checked on the raw text, and the 50-line limit counts non-empty input
     * lines before dedup. Rejects the whole list on the first bad line. */
    internal fun parseHotwordLines(raw: List<String>): List<ParsedHotwordLine> {
        val nonEmpty = raw.filter { it.isNotBlank() }
        require(nonEmpty.size <= MAX_LINES) { "热词最多 $MAX_LINES 行" }
        val weights = mutableMapOf<String, Double?>()
        val seen = mutableSetOf<String>()
        return raw.mapIndexedNotNull { index, rawLine ->
            if (rawLine.isBlank()) return@mapIndexedNotNull null
            // 防呆：全角冒号按权重分隔符识别；保存后规范化为英文冒号。
            val value = rawLine.replace('：', ':')
            val colons = value.count { it == ':' }
            require(colons <= 1) { "第 ${index + 1} 行热词语法错误：冒号只用于「词:权重」" }
            var word = value
            var weight: Double? = null
            if (colons == 1) {
                val parts = value.split(':')
                word = parts[0]
                val literal = parts[1].trim()
                // Native parses the score with std::stof without checking the
                // full string ("5junk"→5, "nan", "1e3" all pass), so accept
                // plain decimals here and re-serialize - never forward the
                // user's literal.
                require(Regex("^[0-9]+(\\.[0-9])?$").matches(literal)) {
                    "第 ${index + 1} 行权重须为 1~${MAX_WEIGHT.toInt()} 的数字，最多一位小数"
                }
                weight = literal.toDouble()
                require(weight in 1.0..MAX_WEIGHT) {
                    "第 ${index + 1} 行权重须为 1~${MAX_WEIGHT.toInt()}"
                }
            }
            require(value.none { it == '/' || it == '#' || it == '<' || it == '>' || it.isISOControl() }) {
                "第 ${index + 1} 行热词含不支持的分隔符，请只填写词语"
            }
            val normalized = word.trim().replace(Regex("\\s+"), " ").uppercase(Locale.ROOT)
            require(normalized.isNotEmpty() && normalized.length <= MAX_CHARS_PER_LINE) {
                "第 ${index + 1} 行热词为空或过长"
            }
            if (weights.containsKey(normalized) && weights[normalized] != weight) {
                throw IllegalArgumentException("第 ${index + 1} 行与前面的「$normalized」权重不一致")
            }
            weights[normalized] = weight
            if (!seen.add(normalized)) return@mapIndexedNotNull null
            ParsedHotwordLine(normalized, weight, index)
        }
    }

    private fun formatWeight(weight: Double): String =
        if (weight % 1.0 == 0.0) weight.toInt().toString()
        else String.format(Locale.ROOT, "%.1f", weight)

    /** CreateStream replaces '/' with a newline; a trailing " :N" injects a
     * per-word boost that overrides the global score for that phrase only.
     * Unsupported glyphs are rejected here rather than allowing native
     * parsing failures (which silently drop whole hotword batches). */
    internal fun encodeWords(words: List<String>, vocab: Set<String>): EncodedHotwords {
        val parsed = parseHotwordLines(words)
        parsed.forEach { line ->
            require(line.word.codePoints().toArray().all { point ->
                val glyph = String(Character.toChars(point))
                point == 32 || glyph in vocab || "▁$glyph" in vocab
            }) { "第 ${line.displayIndex + 1} 行热词含语音模型不支持的字符" }
        }
        return EncodedHotwords(
            streamText = parsed.joinToString("/") { line ->
                line.word + (line.weight?.let { " :${formatWeight(it)}" } ?: "")
            },
            phrases = parsed.map { it.word },
        )
    }

    /** Keep final-pass correction unless it removes a configured hotword
     * actually recognized in the stream. Match whole Latin words; tolerate
     * capitalization and model-inserted whitespace, including within Chinese. */
    internal fun selectFinalText(streaming: String, final: String, phrases: List<String>): String {
        if (final.isBlank()) return streaming
        val lostHotword = phrases.filter(String::isNotBlank).any { phrase ->
            val glyphs = phrase.filterNot(Char::isWhitespace).codePoints().toArray()
            if (glyphs.isEmpty()) return@any false
            val pattern = buildString {
                if (isLatinWordPoint(glyphs.first())) append("(?<![A-Za-z0-9])")
                append(glyphs.joinToString("\\s*") { Regex.escape(String(Character.toChars(it))) })
                if (isLatinWordPoint(glyphs.last())) append("(?![A-Za-z0-9])")
            }
            val matcher = Regex(pattern, RegexOption.IGNORE_CASE)
            matcher.containsMatchIn(streaming) && !matcher.containsMatchIn(final)
        }
        return if (lostHotword) streaming else final
    }

    private fun isLatinWordPoint(point: Int): Boolean =
        point in 'A'.code..'Z'.code || point in 'a'.code..'z'.code || point in '0'.code..'9'.code

    private fun readTokens(context: Context, source: ModelSource): ByteArray =
        if (source is ModelSource.Assets) context.assets.open("asr-model/tokens.txt").use { it.readBytes() }
        else File(source.pathFor("asr-model/tokens.txt")).readBytes()

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}
