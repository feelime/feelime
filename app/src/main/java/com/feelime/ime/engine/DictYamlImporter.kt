package com.feelime.ime.engine

import java.io.BufferedReader
import java.io.Reader

/**
 * rime .dict.yaml 词库导入解析器（issue #22/#37）。
 *
 * 只取正文「词<TAB>码[<TAB>权重]」行，头部元数据（name/version/
 * import_tables/...）与 `#` 注释、`---`/`...` 分隔行全部跳过，唯
 * `columns:` 声明除外（#107，见 [parseColumns]）。导入的词条经
 * CustomPhraseStore 的 imported 段挂 custom_phrase 通道——这是
 * 「叠加」而非「换基底」：词库原有的词频/造句能力不进来，每个词按
 * quality 1 的附加候选出现。整配置兼容与基底替换见 issue #22/#23 的
 * 分层结论。
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
        /** #81 第三列「位置」：词面 → 候选位（1-9；列缺失/坏值=未指定）。
         *  rime 生态此列本是权重——大数字会被钳到 9，语义以导入 hint
         *  文案为准（第三列=位置 1-9）。 */
        val ranks: Map<String, Int> = emptyMap(),
        /** #107 列头声明含 `rank`：本表第三列按候选位次解释，对全部词面
         *  （汉字/字母/符号/Emoji）生效；无声明维持 #81（仅纯符号词）。
         *  声明了 columns 但不含 rank（如 [text, code, weight]）时
         *  [ranks] 为空——显式声明权重语义，第三列不再按 #81 折中。 */
        val rankDeclared: Boolean = false,
        /** 跳过的正文行数（坏行/超限行）。 */
        val skipped: Int,
        /** 因上限截断丢弃的条数。 */
        val truncated: Int,
    )

    fun parse(reader: Reader, existing: Set<Pair<String, String>> = emptySet()): Result {
        val items = LinkedHashMap<Pair<String, String>, Unit>()
        val ranks = LinkedHashMap<String, Int>()
        var skipped = 0
        var truncated = 0
        // #107 columns 声明（rime 头部语义，BaseDictInstaller.dictCodeColumn
        // 同款宽容度）。columnsSeen=false=无声明；`...` 之后的正文区
        // 不再认声明。
        val declaredRoles = mutableListOf<String>()
        var columnsSeen = false
        var inColumns = false
        var headerOpen = true
        BufferedReader(reader).useLines { lines ->
            for (raw in lines) {
                val line = raw.trimEnd()
                if (line.isEmpty() && !inColumns) continue
                if (line.startsWith("#") && !inColumns) continue
                // rime 头部（--- 到 ... 之间的 name:/version: 等键值行）
                // 无 TAB；词条行「词<TAB>码[<TAB>位置]」必有 TAB。按
                // TAB 认词条：标准文件与无头的裸词表（用户自制）都成立。
                if (!line.contains('\t')) {
                    val t = line.trim()
                    if (t == "...") {
                        headerOpen = false
                        inColumns = false
                        continue
                    }
                    // 块声明内的空行/注释不中断声明（与 BaseDictInstaller
                    // 同宽：中断在注释处的半截声明不算读完）。
                    if (inColumns && (t.isEmpty() || t.startsWith("#"))) continue
                    if (!headerOpen) continue
                    if (!inColumns) {
                        if (t == "columns:") { inColumns = true; continue }
                        // inline 形态：columns: [text, code, rank]
                        if (t.startsWith("columns:")) {
                            val rest = t.removePrefix("columns:").trim()
                            if (rest.startsWith("[") && rest.endsWith("]")) {
                                val roles = rest.removeSurrounding("[", "]")
                                    .split(',')
                                    .map { it.trim().trim('"').trim('\'') }
                                    .filter { it.isNotEmpty() }
                                if (roles.isNotEmpty()) {
                                    declaredRoles.addAll(roles)
                                    columnsSeen = true
                                }
                            }
                        }
                        continue
                    }
                    // 块形态列表项（- rank）；非列表行=声明结束。
                    val item = Regex("^-\\s*(.+?)\\s*$").find(t)
                    if (item != null) {
                        val role = item.groupValues[1].trim().trim('"').trim('\'')
                        if (role.isNotEmpty()) {
                            declaredRoles.add(role)
                            columnsSeen = true
                        }
                    } else {
                        inColumns = false
                    }
                    continue
                }
                inColumns = false // 词条行=已进正文，块声明自然结束
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
                // #81 位置列：1-9 整数（越界钳到边界，非数字忽略）。
                // #107 声明裁决：无声明=第三列仍按位置读（#81 折中，仅
                // 纯符号词在渲染层生效）；声明含 rank=全词面生效
                // （rankDeclared）；声明不含 rank=第三列是声明的其它角色
                // （weight 等），忽略。
                if (columns.size >= 3) {
                    val rankOn = !columnsSeen || declaredRoles.contains("rank")
                    if (rankOn) {
                        columns[2].trim().toIntOrNull()?.let { rank ->
                            if (rank >= 1) ranks[text] = rank.coerceAtMost(9)
                        }
                    }
                }
            }
        }
        return Result(
            items.keys.toList(), ranks,
            rankDeclared = columnsSeen && declaredRoles.contains("rank"),
            skipped, truncated,
        )
    }
}
