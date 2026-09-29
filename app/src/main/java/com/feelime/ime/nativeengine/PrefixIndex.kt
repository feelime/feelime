package com.feelime.ime.nativeengine

import java.io.File

class PrefixIndex private constructor(private val words: List<String>) {
    /** 词典全词表（重音折叠索引等派生数据构建用）。 */
    fun allWords(): List<String> = words

    fun find(prefix: String, limit: Int = 12): List<String> {
        val needle = prefix.lowercase()
        var low = 0
        var high = words.size
        while (low < high) {
            val middle = (low + high) ushr 1
            if (words[middle].lowercase() < needle) low = middle + 1 else high = middle
        }
        return words.asSequence().drop(low)
            .takeWhile { it.startsWith(prefix, ignoreCase = true) }
            .take(limit).toList()
    }

    companion object {
        fun load(file: File): PrefixIndex {
            val lines = file.readLines(Charsets.UTF_8)
            require(lines.firstOrNull() == "FEELIME_PREFIX_V1") { "invalid prefix index: $file" }
            // Single pass with one lowercase per line: this index is loaded on
            // the input path, and the pairwise zipWithNext variant cost hundreds
            // of milliseconds on the reference arm64 device.
            val words = ArrayList<String>(lines.size)
            var previousLower: String? = null
            var previousLine: String? = null
            for (index in 1 until lines.size) {
                val line = lines[index]
                if (line.isEmpty()) continue
                val lower = line.lowercase()
                val prevLower = previousLower
                if (prevLower != null) {
                    val order = prevLower.compareTo(lower)
                    if (order > 0 || (order == 0 && checkNotNull(previousLine) > line)) {
                        throw IllegalArgumentException("unsorted prefix index: $file")
                    }
                }
                previousLower = lower
                previousLine = line
                words.add(line)
            }
            return PrefixIndex(words)
        }
    }
}
