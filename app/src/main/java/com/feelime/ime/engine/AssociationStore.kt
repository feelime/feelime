package com.feelime.ime.engine

import android.content.Context
import java.io.File

/**
 * 中文联想表（docs/design/association.md）：commit 的词 → 高频后继词。
 * 表随引擎数据部署（MANIFEST 哈希校验），首次查询同步解析一次常驻内存；
 * 查询取上屏文本的最长可用后缀（4→1 字），不需要分词器。
 * 表缺失/解析失败一律返回空——联想是增强，绝不阻塞输入主链路。
 *
 * 存的是裸 TSV（不是 .gz）：aapt2 打包会解压 .gz 资产并去掉后缀，
 * 运行时按 .gz 找不到文件会让整个部署链路静默失败（2026-09-13 实录）。
 * APK 本身会对条目做 DEFLATE，体积不吃亏。
 */
object AssociationStore {
    private const val TABLE_PATH = "assoc/zh_bigram.tsv"
    private const val MAX_SUFFIX = 4
    private const val MAX_HOPS = 8

    // 问号在语料里是独立 token，构建 bigram 表时已被纯中文过滤掉。
    // 上屏内容带明确疑问线索时在查询层补回，避免为了一个标点重建整表。
    private val questionCue = Regex(
        "(?:吗|呢|嘛)$|" +
            "(?:什么|怎么|为什么|为何|如何|谁|哪(?:里|儿|个|些|位|天|年|次|种)?|" +
            "多少|几点|几个|几位|几岁|几天|几年|几次|几时|几号|" +
            "是否|是不是|有没有|能不能|可不可以|会不会|要不要|对不对|好不好|" +
            "行不行|可否|请问)",
    )

    @Volatile private var table: Map<String, List<String>>? = null
    private val prewarming = java.util.concurrent.atomic.AtomicBoolean(false)

    /** 联想表文件（随引擎数据版本部署）；未部署返回 null。 */
    fun tableFile(context: Context): File? =
        EngineDataStore.readyFile(context, TABLE_PATH)

    /** 后台预热：服务起来/开关打开时就把表解析好，让首次 commit 的查询
     * 命中暖缓存，主线程不用付整表解析的代价（codex round-1 P2-4）。 */
    fun prewarm(context: Context) {
        if (table != null) return
        if (!prewarming.compareAndSet(false, true)) return
        Thread { loadIntoCache(context) }.apply { isDaemon = true }.start()
    }

    private fun loadIntoCache(context: Context) {
        synchronized(this) {
            if (table != null) return
            table = runCatching { parse(tableFile(context)) }.getOrNull().orEmpty()
        }
    }

    /** [committed] 的最长后缀命中；返回后继词（可能为空）。
     *
     * 表没就绪时**同步**解析兜底（双检锁，一次性 ~0.5s）：prewarm 覆盖
     * 不到的场景（开启联想后立刻 commit）用它保证正确性——之前异步起
     * 线程后紧跟查询，首次 commit 读到的永远是空表（2026-09-13 实录）。
     * 解析失败缓存空表——联想是增强，不值得每次 commit 重读。 */
    fun next(context: Context, committed: String): List<String> {
        val map = table ?: synchronized(this) {
            table ?: runCatching { parse(tableFile(context)) }.getOrNull().orEmpty().also {
                table = it
            }
        }
        for (length in minOf(MAX_SUFFIX, committed.length) downTo 1) {
            val hops = map[committed.substring(committed.length - length)]
            if (!hops.isNullOrEmpty()) {
                return addQuestionMarkCandidate(committed, hops)
            }
        }
        return addQuestionMarkCandidate(committed, emptyList())
    }

    /** 问句的后继词可能为空，但问号仍然有效；显式标点已收尾时不重复补。 */
    internal fun addQuestionMarkCandidate(
        committed: String,
        words: List<String>,
    ): List<String> {
        val text = committed.trim()
        if (text.isEmpty() || text.last() in "？！?!。…") return words
        if (!questionCue.containsMatchIn(text)) return words
        return (listOf("？") + words.filterNot { it == "？" }).take(MAX_HOPS)
    }

    private fun parse(file: File?): Map<String, List<String>> {
        if (file == null) return emptyMap()
        val map = HashMap<String, MutableList<String>>()
        file.forEachLine { line ->
            val parts = line.split('\t')
            if (parts.size < 2) return@forEachLine
            val hops = map[parts[0]]
            if (hops == null) {
                map[parts[0]] = mutableListOf(parts[1])
            } else if (hops.size < MAX_HOPS) {
                hops.add(parts[1])
            }
        }
        return map
    }
}
