package com.feelime.ime.engine

import android.content.Context
import java.io.File

/**
 * 中文联想表（docs/design/association.md）：commit 的词 → 高频后继词。
 * 表随引擎数据部署（MANIFEST 哈希校验），后台解析后常驻内存；
 * 查询取上屏文本的最长可用后缀（4→1 字），不需要分词器。
 * 表缺失/解析失败一律返回空——联想是增强，绝不阻塞输入主链路。
 *
 * 存的是裸 TSV（不是 .gz）：aapt2 打包会解压 .gz 资产并去掉后缀，
 * 运行时按 .gz 找不到文件会让整个部署链路静默失败（2026-09-13 实录）。
 * APK 本身会对条目做 DEFLATE，体积不吃亏。
 */
object AssociationStore {
    private const val TABLE_PATH = "assoc/zh_bigram.tsv"
    private const val MAX_HOPS = 8

    private val cache = AssociationCache()
    private val loader = java.util.concurrent.Executors.newSingleThreadExecutor { task ->
        Thread(task, "feelime-assoc").apply { isDaemon = true }
    }

    /** 联想表文件（随引擎数据版本部署）；未部署返回 null。 */
    fun tableFile(context: Context): File? = EngineDataStore.readyFile(context, TABLE_PATH)

    fun prewarm(context: Context) {
        val appContext = context.applicationContext
        cache.load(loader) { tableFile(appContext)?.let { parse(it) } }
    }

    /** 冷查询不等解析；加载完成后补送，调用方校验编辑器与提交代际。 */
    fun nextAsync(context: Context, committed: String, deliver: (List<String>) -> Unit): () -> Unit {
        val cancel = cache.query(committed, deliver)
        prewarm(context)
        return cancel
    }

    private fun parse(file: File): Map<String, List<String>> {
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

/** 未就绪/加载中/已完成分开；文件缺失与解析失败都允许下次部署或查询重试。 */
internal class AssociationCache {
    private enum class State { NOT_READY, LOADING, READY }
    private var state = State.NOT_READY
    private var table: Map<String, List<String>> = emptyMap()
    // 只保留最后一次冷查询，旧提交的联想已无补送价值。
    private var pending: Pair<String, (List<String>) -> Unit>? = null

    fun query(committed: String, deliver: (List<String>) -> Unit): () -> Unit {
        val result = synchronized(this) {
            if (state == State.READY) lookup(table, committed) else {
                pending = committed to deliver
                null
            }
        }
        if (result != null) deliver(result)
        return {
            synchronized(this) {
                if (pending?.second === deliver) pending = null
            }
        }
    }

    fun load(executor: java.util.concurrent.Executor, parse: () -> Map<String, List<String>>?) {
        synchronized(this) {
            if (state != State.NOT_READY) return
            state = State.LOADING
        }
        executor.execute {
            val parsed = runCatching { parse() }.getOrNull()
            val delivery = synchronized(this) {
                if (parsed == null) {
                    state = State.NOT_READY
                    null
                } else {
                    table = parsed
                    state = State.READY
                    pending.also { pending = null }
                }
            }
            if (delivery != null) delivery.second(lookup(checkNotNull(parsed), delivery.first))
        }
    }

    private fun lookup(map: Map<String, List<String>>, committed: String): List<String> {
        for (length in minOf(4, committed.length) downTo 1) {
            val hops = map[committed.takeLast(length)]
            if (!hops.isNullOrEmpty()) return hops
        }
        return emptyList()
    }
}
