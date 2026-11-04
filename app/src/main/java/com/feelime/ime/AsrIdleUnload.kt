package com.feelime.ime

/** 所有入口与计时回调都在 ASR worker 上执行，卸载与解码共享串行边界。 */
internal class AsrIdleUnload(
    private val schedule: (Long, () -> Unit) -> (() -> Unit),
    private val unload: () -> Unit,
) {
    private var enabled = false
    private var idle = false
    private var generation = 0L
    private var cancel: (() -> Unit)? = null

    fun setEnabled(on: Boolean) {
        if (enabled == on) return
        enabled = on
        arm()
    }

    fun becameActive() {
        idle = false
        arm()
    }

    fun becameIdle() {
        idle = true
        arm()
    }

    private fun arm() {
        cancel?.invoke()
        cancel = null
        val request = ++generation
        if (!enabled || !idle) return
        cancel = schedule(5 * 60_000L) {
            if (request == generation && enabled && idle) {
                cancel = null
                unload()
            }
        }
    }

    fun close() {
        idle = false
        arm()
    }
}
