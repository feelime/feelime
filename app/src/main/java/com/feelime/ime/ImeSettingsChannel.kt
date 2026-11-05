package com.feelime.ime

/** 设置页（同进程 WebView）与 IME 服务的手势直连通道（#85）。
 *
 * 设置页输入框聚焦在自家 WebView 里：Chromium IC 的文本查询不回
 * （宿主路径先卡秒级再退化为 DEL 连发），Ctrl+Z 键事件兜底在浏览器
 * 里一次只撤销一个字符——上滑删/下滑恢复这两个手势改由服务直调
 * 设置页 JS（[SetupActivity] 在前台时注册执行器），同步读写输入框，
 * 光标与快照语义和宿主路径一致（恢复落删除前位、无选中）。
 *
 * 焦点态由 settings.js 经 SettingsBridge.imeInputFocused 上报；原生
 * 调试 fixture（同包名但非 WebView）不置位，继续走宿主路径。 */
object ImeSettingsChannel {
    /** 设置页注册的脚本执行器（onResume 注册、onPause 注销，代际
     *  隔离：旋转重建时旧实例的注销不得清掉新实例刚注册的通道）。 */
    @Volatile var evaluate: ((String) -> Unit)? = null

    /** 设置页任一文字输入框持有焦点。 */
    @Volatile var inputFocused: Boolean = false

    /** 设置页声明过手势处理器（imeGestureSupport）：旧页面缓存混搭
     *  新 APK 时不路由，回落宿主路径（codex 复审 P2）。 */
    @Volatile var gestureCapable: Boolean = false

    private val generation = java.util.concurrent.atomic.AtomicInteger(0)
    private val lock = Any()

    /** 注册并返回本实例代际；[unregister] 只在仍是最新注册者时清通道。
     *  注册/注销/上报共用一把锁：check-then-write 与注册交错时，旧
     *  代际上报会在新注册完成后落地、污染新实例状态（codex 复审
     *  P2，JVM 并发探针复现）。 */
    fun register(runner: (String) -> Unit): Int = synchronized(lock) {
        gestureCapable = false
        inputFocused = false
        evaluate = runner
        generation.incrementAndGet()
    }

    fun unregister(gen: Int) = synchronized(lock) {
        if (generation.get() == gen) {
            evaluate = null
            inputFocused = false
            gestureCapable = false
        }
    }

    /** 上报绑定代际：旧实例 bridge 的迟到上报不得覆盖新实例的通道
     *  状态（guarded() 只校验本 bridge 的 token，证明不了它拥有当前
     *  通道）。 */
    fun reportFocus(gen: Int, active: Boolean) = synchronized(lock) {
        if (generation.get() == gen) inputFocused = active
    }

    fun reportGestureSupport(gen: Int) = synchronized(lock) {
        if (generation.get() == gen) gestureCapable = true
    }
}
