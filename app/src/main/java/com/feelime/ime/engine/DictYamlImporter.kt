package com.feelime.ime.engine

import java.io.BufferedReader
import java.io.Reader

/**
 * rime .dict.yaml 词库导入解析器（issue #22/#37）。
 *
 * 只取正文「词<TAB>码[<TAB>权重]」行，头部元数据（name/version/
 * import_tables/...）与 `#` 注释、`---`/`...` 分隔行全部跳过。导入的
 * 词条经 CustomPhraseStore 的 imported 段挂 custom_phrase 通道——这是
 * 「叠加」而非「换基底」：词库原有的词频/造句能力不进来，每个词按
 * quality 1 的附加候选出现（渲染层符号词重排只动纯符号词，含汉字的
 * 导入词保持引擎序）。整配置兼容与基底替换见 issue #22/#23 的分层结论。
 *
 * 约束（防爆内存/坏数据）：流式逐行读、文件侧由调用方限制大小；
 * 词 ≤32 字、码去空格后 1-48 个 [a-z]；导入词与自身/手管 items 去重
 * （手管优先）；上限 [MAX_ENTRIES] 条，超出按文件序截断并在结果里说明。
 */
object DictYamlImporter {
    const val MAX_ENTRIES = 5000
    private const val MAX_TEXT_CHARS = 32
    private const val MAX_CODE_CHARS = 48
    private val CODE = Regex("^[a-z]{1,$MAX_CODE_CHARS}$")

    data class Result(
        /** 解析成功的词条（已去重、截断到上限）。 */
        val items: List<Pair<String, String>>,
        /** 跳过的正文行数（坏行/超限行）。 */
        val skipped: Int,
        /** 因上限截断丢弃的条数。 */
        val truncated: Int,
    )

    fun parse(reader: Reader, existing: Set<Pair<String, String>> = emptySet()): Result {
        val items = LinkedHashMap<Pair<String, String>, Unit>()
        var skipped = 0
        var truncated = 0
        BufferedReader(reader).useLines { lines ->
            for (raw in lines) {
                val line = raw.trimEnd()
                if (line.isEmpty()) continue
                if (line.startsWith("#")) continue
                // rime 头部（--- 到 ... 之间的 name:/version: 等键值行）
                // 无 TAB；词条行「词<TAB>码[<TAB>权重]」必有 TAB。按
                // TAB 认词条：标准文件与无头的裸词表（用户自制）都成立。
                if (!line.contains('\t')) continue
                val columns = line.split('\t')
                if (columns.size < 2) {
                    skipped++
                    continue
                }
                val text = columns[0].trim()
                val code = columns[1].trim().replace(" ", "").lowercase()
                if (text.isEmpty() || text.length > MAX_TEXT_CHARS ||
                    !CODE.matches(code)
                ) {
                    skipped++
                    continue
                }
                if (text.length == 1 && code.isEmpty()) {
                    skipped++
                    continue
                }
                val entry = text to code
                if (entry in existing) continue // 手管词优先，不重复计数
                if (items.size >= MAX_ENTRIES) {
                    truncated++
                    continue
                }
                items[entry] = Unit
            }
        }
        return Result(items.keys.toList(), skipped, truncated)
    }
}
