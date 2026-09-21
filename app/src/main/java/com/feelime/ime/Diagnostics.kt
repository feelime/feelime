package com.feelime.ime

import android.content.Context
import android.os.SystemClock

/**
 * 诊断记录（用户报告：双拼下按键字母直接上屏，A/B 聊天窗口可复现）。
 *
 * 开关打开后，IME 把引擎降级链路的关键事件收进内存环形缓冲，供设置页
 * 一键导出做故障分析。采集点（全部不含文本内容）：
 *   - 编辑器切换：包名 / inputType hex / imeOptions hex / 敏感与终端标记
 *   - 引擎生命周期：startEngine 目标与降级前状态、READY、工厂失败、
 *     warmup 超时、队列溢出、降级期按键直出重放计数
 *   - 徽标清除路径：endVoiceSession / recreateBegin / clearDegrade
 *   - 用户动作：selectMode
 *   - 触摸/UI 层（v3，issue #13「键盘弹出后所有按键点不了」——引擎层
 *     已被真机诊断排除，病灶在触摸链路）：insets 可触摸区状态、窗口
 *     焦点、键盘 WebView 的 touch-down 到达计数、JS 侧 rAF/timer
 *     双通道心跳与触摸到达计数。信号矩阵：心跳停=WebView 渲染死；
 *     native down 有而 JS touch=0=事件丢在 native→JS 边界；两者皆无=
 *     窗口层没收（看 insets/焦点行）。
 *
 * 默认关闭；关闭时 log() 直接返回（调用方不做判断也近乎零开销）。
 * 环形缓冲 400 条、单条截断 220 字符，只进内存，不落盘、不进备份。
 * 心跳类事件导出时折叠（见 snapshot），不冲刷其它事件。
 */
object Diagnostics {
    private const val PREFS = "feelime_diagnostics"
    private const val KEY_ENABLED = "enabled"
    private const val MAX_EVENTS = 400
    private const val MAX_EVENT_CHARS = 220
    /** snapshot() 对心跳行保留的尾部条数（issue #13 v3）。 */
    private const val KEEP_BEATS = 4

    private val lock = Any()
    private val events = ArrayDeque<String>()
    private var recording = false
    private var startedAt = 0L
    private var seq = 0L

    /** 当前引擎/编辑器状态行（导出头用），由 service 在 hello 推送时刷新。 */
    @Volatile
    var liveState: String = ""
        private set

    fun enabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)

    /** 进程启动时恢复记录状态（service onCreate 调用）。 */
    fun refresh(context: Context) {
        synchronized(lock) {
            recording = enabled(context)
            if (recording && startedAt == 0L) startedAt = SystemClock.elapsedRealtime()
        }
    }

    fun setEnabled(context: Context, on: Boolean) {
        synchronized(lock) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, on).apply()
            recording = on
            events.clear()
            seq = 0
            startedAt = if (on) SystemClock.elapsedRealtime() else 0L
        }
        if (on) log("diag", "recording started")
    }

    fun log(tag: String, detail: String = "") {
        synchronized(lock) {
            if (!recording) return
            seq += 1
            val seconds = (SystemClock.elapsedRealtime() - startedAt) / 1000.0
            var line = String.format(java.util.Locale.US, "%.3f #%d %s %s",
                seconds, seq, tag, detail).trim()
            if (line.length > MAX_EVENT_CHARS) line = line.take(MAX_EVENT_CHARS - 1) + "…"
            if (events.size >= MAX_EVENTS) events.removeFirst()
            events.addLast(line)
        }
    }

    /** service 刷新导出头里的实时状态（mode / degrade / 最后编辑器）。 */
    fun noteLiveState(state: String) {
        liveState = state
    }

    /** 录制至今的总事件数（含被导出折叠的心跳）——导出头与可见行数
     *  分别展示，折叠不产生计数谜团。 */
    fun totalLogged(): Long = synchronized(lock) { seq }

    /** JS 心跳行（issue #13 v3）按 2.5s 一条持续写入，直接全量导出会把
     *  环形缓冲里的其它事件冲掉。导出时折叠：首条（起始证据）+ 最近
     *  KEEP 条（收尾证据）+ 中间计数行（带被折叠的 seq 区间，导出里的
     *  编号空洞对得上号）——心跳「持续存在」由计数与最后一条的时间戳
     *  共同证明，卡死现场则是心跳行戛然而止。 */
    fun snapshot(): List<String> = synchronized(lock) {
        val all = events.toList()
        val isBeat: (String) -> Boolean = { it.contains(" js heartbeat ") }
        val beats = all.count(isBeat)
        if (beats <= KEEP_BEATS + 1) {
            all
        } else {
            val out = ArrayList<String>(all.size - beats + KEEP_BEATS + 2)
            val droppedSeqs = ArrayList<Int>()
            // 首个心跳保留，其余心跳只留最后 KEEP 条；被折叠的计中间。
            val lastKept = all.filter(isBeat).takeLast(KEEP_BEATS).toHashSet()
            var firstBeatSeen = false
            for (line in all) {
                if (!isBeat(line)) {
                    out.add(line)
                } else if (!firstBeatSeen || lastKept.contains(line)) {
                    out.add(line)
                    firstBeatSeen = true
                } else {
                    droppedSeqs.add(seqOf(line))
                }
            }
            if (droppedSeqs.isNotEmpty()) {
                out.add(
                    out.indexOfFirst(isBeat) + 1,
                    "… ${droppedSeqs.size} heartbeat lines elided (#${compactRanges(droppedSeqs)})",
                )
            }
            out
        }
    }

    /** 行文本里的序号（"#N "），解析失败给 0。 */
    private fun seqOf(line: String): Int =
        Regex("""#(\d+)""").find(line)?.groupValues?.get(1)?.toIntOrNull() ?: 0

    /** 序号列表 → 紧凑区间（1,2,3,7 → "1-3,7"）。 */
    private fun compactRanges(seq: List<Int>): String {
        val sorted = seq.sorted()
        val parts = mutableListOf<String>()
        var start = sorted.first()
        var prev = start
        for (n in sorted.drop(1)) {
            if (n == prev + 1) {
                prev = n
            } else {
                parts.add(if (start == prev) "$start" else "$start-$prev")
                start = n
                prev = n
            }
        }
        parts.add(if (start == prev) "$start" else "$start-$prev")
        return parts.joinToString(",")
    }
}
