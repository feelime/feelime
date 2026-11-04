package com.feelime.ime

/** 跨设置页共用换装门闸：解码不持锁，文件与来源偏好一起在有效请求内写入。 */
internal class BackgroundImageRequests {
    private val lock = Any()
    private var sequence = 0L
    private val latest = mutableMapOf<String, Long>()

    fun session() = Session()

    inner class Session {
        private var closed = false

        fun close() = synchronized(lock) { closed = true }

        fun begin(variant: String): Request? = synchronized(lock) {
            if (closed) return@synchronized null
            val id = ++sequence
            latest[variant] = id
            Request(variant, id)
        }

        inner class Request(private val variant: String, private val id: Long) {
            fun applyIfCurrent(write: () -> Unit): Boolean = synchronized(lock) {
                // 代号在用户选择时分配，不能等旧 worker 解码结束才排新请求。
                if (closed || latest[variant] != id) return@synchronized false
                write()
                true
            }
        }
    }
}
