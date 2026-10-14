package com.feelime.ime

import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** 单字逐笔识别只保留正在执行和最新待执行的请求（handwriting §12）。
 * 关闭和提交共用锁；释放仍排在正在执行的 native 调用之后。 */
internal class InkWorkQueue(factory: ThreadFactory) {
    private val lock = Any()
    @Volatile private var closed = false
    private val executor = ThreadPoolExecutor(
        1, 1, 0L, TimeUnit.MILLISECONDS, LinkedBlockingQueue<Runnable>(1), factory,
    )

    fun submit(work: () -> Unit): Boolean = synchronized(lock) {
        if (closed) return@synchronized false
        executor.queue.clear()
        executor.execute { if (!closed) work() }
        true
    }

    fun close(release: () -> Unit) = synchronized(lock) {
        if (closed) return@synchronized
        closed = true
        executor.queue.clear()
        executor.execute { release() }
        executor.shutdown()
    }
}
