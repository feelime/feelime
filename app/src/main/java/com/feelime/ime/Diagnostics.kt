package com.feelime.ime

import android.content.Context
import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

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
 *   - 键盘收起取证（用户录屏：手写中键盘 13 秒收起 3 次，两次紧跟长
 *     笔画——旧采集只记 touchDown 汇总，收起瞬间的「谁干的」无从对
 *     账）：touchUp 计数、touchCancel 即时行（含屏幕三边距离——判
 *     系统手势条抢断）、二指即时行（平板防误触对账）、requestHideSelf
 *     两个调用点带 src、windowHidden 带 down/up/cancel 相对毫秒、
 *     service 生命周期（create/destroy/config 变更）、JS inkCancel。
 *
 * 默认关闭；关闭时 log() 直接返回（调用方不做判断也近乎零开销）。
 * 环形缓冲 400 条、单条截断 220 字符。事件同时镜像追加到 noBackup
 * 目录的文本文件（跨进程死亡存活——进程被杀/重启即清空环形缓冲，
 * 正是「莫名收起」最需要现场的时刻证据自毁；文件不进云备份）。
 * 心跳行落盘降频（每 12 条落 1 条 ≈ 30s），文件容量给非心跳事件让路。
 * 导出时文件尾部与内存环合并去重后再做心跳折叠（见 snapshot）。
 */
object Diagnostics {
    private const val PREFS = "feelime_diagnostics"
    private const val KEY_ENABLED = "enabled"
    /** 已扫过的最近进程退因时间戳（崩溃取证去重）。 */
    private const val KEY_LAST_EXIT_TS = "last_exit_ts"
    private const val MAX_EVENTS = 400
    private const val MAX_EVENT_CHARS = 220
    /** snapshot() 对心跳行保留的尾部条数（issue #13 v3）。 */
    private const val KEEP_BEATS = 10 // #12 复发取证：最近 25s 心跳（含 touch/noClick 计数）全保留

    // ---- 落盘镜像（键盘收起取证）----
    private const val MAX_FILE_LINES = 4000
    private const val FILE_TRIM_TO = 2000
    /** 导出时从文件并入的尾部行数上限（含早于内存环窗口的历史会话）。 */
    private const val EXPORT_FILE_TAIL = 900
    /** 心跳行每 N 条落 1 条：空闲期文件覆盖从 ~2.8h 拉到 ~33h。 */
    private const val BEAT_FILE_EVERY = 12

    private val lock = Any()
    private val events = ArrayDeque<String>()
    // @Volatile：#12 帧探针（choreoTick/uiSampler）每帧/每拍读取此标志，
    // 关诊断时自熄不再续订帧回调（省电，codex 终审 P1）。
    @Volatile private var recording = false
    private var startedAt = 0L
    private var seq = 0L
    private var sink: DiagSink? = null
    private var beatCount = 0

    /** 当前引擎/编辑器状态行（导出头用），由 service 在 hello 推送时刷新。 */
    @Volatile
    var liveState: String = ""
        private set

    /** 探针自熄判读：诊断关闭后帧回调/采样循环不再续订。 */
    fun isRecording(): Boolean = recording

    fun enabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)

    /** 进程启动时恢复记录状态（service onCreate 调用）。落盘文件随进程
     *  初始化；开启录制时写进程分节行——相对时间戳跨会话归零，分节行
     *  （含墙钟与 pid）是导出里区分会话边界的唯一标记。 */
    fun refresh(context: Context) {
        synchronized(lock) {
            if (sink == null) sink = DiagSink(File(context.noBackupFilesDir, "diag-events.log"))
            recording = enabled(context)
            if (recording && startedAt == 0L) {
                startedAt = SystemClock.elapsedRealtime()
                logLocked("diag",
                    "--- process start ${wallClock()} pid=${android.os.Process.myPid()} app=${BuildConfig.VERSION_NAME} ---")
                // 崩溃取证（1.3.7 后手写连环死亡的采集缺口）：本进程
                // 活着的日志随进程死（DiagSink 队尾来不及写盘），但系统
                // 的 ApplicationExitInfo 不随进程死——进程启动时扫上一
                // 个死进程的退因（REASON_CRASH_NATIVE 的 description 自
                // 带 signal + native 回溯头），同步落盘进导出。
                logExitReasonsLocked(context)
                installCrashHandlerLocked(context)
            }
        }
    }

    /** 已见的最近一次进程退因时间戳（去重：多次 refresh 不重扫）。 */
    private var lastExitTs = 0L

    /** ApplicationExitInfo 取证（API 30+）：上一进程的死因 + 描述头。
     *  native 崩溃的 description 含 signal 与回溯片段——这是拿真实
     *  崩溃点的唯一可靠通道（自有日志在硬崩时必丢队尾）。
     *  v2（2026-10-09，#54 手写连环崩溃一次到位）：CRASH_NATIVE/
     *  CRASH_JAVA/ANR/SIGNALED 再抽 traceInputStream（系统 tombstone
     *  全文）的关键行——罪魁 .so 与帧号只在 trace 里，description 只有
     *  死因类别；status（signal 号）一并入档。 */
    private fun logExitReasonsLocked(context: Context) {
        if (android.os.Build.VERSION.SDK_INT < 30) return
        val am = context.getSystemService(android.app.ActivityManager::class.java) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (lastExitTs == 0L) lastExitTs = prefs.getLong(KEY_LAST_EXIT_TS, 0L)
        val infos = runCatching { am.getHistoricalProcessExitReasons(context.packageName, 0, 6) }
            .getOrNull().orEmpty()
        for (info in infos.sortedBy { it.timestamp }) {
            if (info.timestamp <= lastExitTs) continue
            lastExitTs = info.timestamp
            logSyncLocked("exit",
                "reason=${exitReasonName(info.reason)}(${info.reason}) " +
                    "sig=${info.status} pid=${info.pid} t=${wallClock(info.timestamp)}")
            // 描述（native 回溯/abort message）分段续行——单行 220 上限
            // 装不下回溯头，分段保留 ~1.4KB。
            val desc = (info.description?.toString() ?: "").replace(Regex("\\s+"), " ").trim()
            if (desc.isNotEmpty()) {
                desc.chunked(170).take(8).forEachIndexed { i, chunk ->
                    logSyncLocked("exit+", "[$i] $chunk")
                }
            }
            if (info.reason in TRACE_WORTHY_REASONS) {
                // Android 12+ 的 tombstone 是 protobuf 而非文本（发版
                // review：按文本解只能得到乱码）——限量读原始字节，文本
                // 才走帧表抽取；二进制就记录事实与规模，完整解码另立项。
                // 限量在读取侧（readText().take() 是先全量读再丢）。
                val raw = runCatching {
                    info.traceInputStream?.use { input ->
                        val buffer = ByteArrayOutputStream()
                        val chunk = ByteArray(16 * 1024)
                        var total = 0
                        while (total < MAX_TRACE_READ) {
                            val read = input.read(chunk, 0, minOf(chunk.size, MAX_TRACE_READ - total))
                            if (read < 0) break
                            buffer.write(chunk, 0, read)
                            total += read
                        }
                        buffer.toByteArray()
                    }
                }.getOrNull()
                if (raw == null) {
                    logSyncLocked("exitTrace", "tombstone read failed")
                } else if (raw.isEmpty()) {
                    logSyncLocked("exitTrace", "tombstone empty")
                } else {
                    // protobuf 载荷按字段 tag 编码，文本 tombstone 以
                    // '#'/换行开头——按可打印率判。
                    val isText = runCatching {
                        val head = raw.decodeToString(0, minOf(raw.size, 4096))
                        val printable = head.count { !it.isISOControl() }
                        printable * 10 >= head.length * 9
                    }.getOrDefault(false)
                    if (!isText) {
                        logSyncLocked("exitTrace", "binary tombstone (protobuf), ${raw.size}B head=${raw.take(8).joinToString(",") { (it.toInt() and 0xff).toString() }}")
                    } else {
                        extractTraceLines(String(raw, Charsets.UTF_8)).forEachIndexed { i, line ->
                            logSyncLocked("exitTrace", "[$i] $line")
                        }
                    }
                }
            }
        }
        prefs.edit().putLong(KEY_LAST_EXIT_TS, lastExitTs).commit()
    }

    /** trace 抽取的读取上限（tombstone 全文可达百 KB，只留头部+帧表）。 */
    private const val MAX_TRACE_READ = 128 * 1024
    private val TRACE_WORTHY_REASONS = setOf(
        android.app.ApplicationExitInfo.REASON_CRASH_NATIVE,
        android.app.ApplicationExitInfo.REASON_CRASH,
        android.app.ApplicationExitInfo.REASON_ANR,
        android.app.ApplicationExitInfo.REASON_SIGNALED,
    )
    /** tombstone 抽取（纯函数，JVM 可测）：保 signal/Abort message/
     *  pid/Cmdline 头几行 + 全部 backtrace 帧（#NN pc … 带 .so 与
     *  偏移），总预算 [maxChars]——帧表是定位罪魁 .so 的唯一来源。 */
    internal fun extractTraceLines(trace: String, maxChars: Int = 3200): List<String> {
        if (trace.isBlank()) return emptyList()
        val headerKeep = Regex("signal |Abort message|^pid:|^Cmdline:|^Process uptime|^ABI:")
        val frameKeep = Regex("""^\s*#\d+\s+pc""")
        val seenHeader = HashSet<String>()
        val picked = ArrayList<String>()
        var used = 0
        trace.lineSequence()
            .filter { it.isNotBlank() && (headerKeep.containsMatchIn(it) || frameKeep.containsMatchIn(it)) }
            .forEach { line ->
                val headerKey = headerKeep.findAll(line).firstOrNull()?.value
                if (headerKey != null && !seenHeader.add(headerKey)) {
                    // 多线程 tombstone 每线程一段头：同字段只留首份，
                    // 预算让给帧表。
                    return@forEach
                }
                if (used + line.length > maxChars) return@forEach
                picked.add(line.trim().take(MAX_EVENT_CHARS - 20))
                used += line.length
            }
        return picked
    }

    /** 进程级 Java 崩溃兜底：默认 handler 前同步落盘栈头（异步队列在
     *  崩溃时必丢队尾），再交还系统默认处理（tombstone/ANR 语义不变）。 */
    private fun installCrashHandlerLocked(context: Context) {
        if (crashHandlerInstalled) return
        crashHandlerInstalled = true
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                synchronized(lock) {
                    if (recording) {
                        logSyncLocked("javaCrash",
                            "thread=${thread.name} ${throwable.javaClass.name}: " +
                                "${(throwable.message ?: "").take(120)}")
                    }
                }
            }
            runCatching {
                synchronized(lock) {
                    if (recording) {
                        throwable.stackTrace.take(14).forEach {
                            logSyncLocked("javaCrash+", "at ${it.toString().take(150)}")
                        }
                    }
                }
            }
            previous?.uncaughtException(thread, throwable)
        }
    }

    private var crashHandlerInstalled = false

    /** 同步落盘（绕过 DiagSink 异步队列）：崩溃路径/进程退因专用——
     *  fsync 保证硬崩前字节已到盘。 */
    private fun logSyncLocked(tag: String, detail: String) {
        seq += 1
        val seconds = (SystemClock.elapsedRealtime() - startedAt) / 1000.0
        var line = String.format(java.util.Locale.US, "%.3f #%d %s %s",
            seconds, seq, tag, detail).trim()
        if (line.length > MAX_EVENT_CHARS) line = line.take(MAX_EVENT_CHARS - 1) + "…"
        events.addLast(line)
        if (events.size >= MAX_EVENTS) events.removeFirst()
        sink?.appendSync(line)
    }

    private fun wallClock(millis: Long): String =
        java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date(millis))

    /** ApplicationExitInfo.reason 的可读名（导出里人工读）。 */
    private fun exitReasonName(reason: Int): String = when (reason) {
        android.app.ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_REQUESTED"
        android.app.ApplicationExitInfo.REASON_USER_STOPPED -> "USER_STOPPED"
        android.app.ApplicationExitInfo.REASON_ANR -> "ANR"
        android.app.ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED"
        android.app.ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
        android.app.ApplicationExitInfo.REASON_CRASH -> "CRASH_JAVA"
        android.app.ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
        android.app.ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
        android.app.ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE"
        else -> "OTHER"
    }

    fun setEnabled(context: Context, on: Boolean) {
        synchronized(lock) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, on).commit()
            if (!on && recording) logLocked("diag", "recording stopped")
            recording = on
            events.clear()
            seq = 0
            startedAt = if (on) SystemClock.elapsedRealtime() else 0L
            beatCount = 0
            if (on) logLocked("diag", "recording started")
        }
    }

    fun log(tag: String, detail: String = "") {
        // recording 判定收进锁内（codex 评审 P3）：关闭与并发 log 竞争时，
        // 锁外判定会放进一条迟到事件。
        synchronized(lock) { if (recording) logLocked(tag, detail) }
    }

    /** 关键取证行（硬崩前的最后一跳）：同步写盘 + fsync，绕过异步
     *  队列——崩溃瞬间队尾必丢（1.3.7 手写连环死亡实录：inkInfer
     *  begin 无一存活）。识别节奏每次手写一笔一次，fsync 开销可忽略。 */
    fun logCritical(tag: String, detail: String) {
        synchronized(lock) { if (recording) logSyncLocked(tag, detail) }
    }

    /** 调用方已持 [lock]。 */
    private fun logLocked(tag: String, detail: String) {
        seq += 1
        val seconds = (SystemClock.elapsedRealtime() - startedAt) / 1000.0
        var line = String.format(java.util.Locale.US, "%.3f #%d %s %s",
            seconds, seq, tag, detail).trim()
        if (line.length > MAX_EVENT_CHARS) line = line.take(MAX_EVENT_CHARS - 1) + "…"
        if (events.size >= MAX_EVENTS) events.removeFirst()
        events.addLast(line)
        // 心跳降频落盘：内存环照单全收（实时性），文件只留抽样（容量）。
        val isBeat = detail.startsWith("heartbeat ")
        if (!isBeat || beatCount % BEAT_FILE_EVERY == 0) sink?.append(line)
        if (isBeat) beatCount += 1
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
        val live = events.toList()
        val liveSet = live.toHashSet()
        val persisted = sink?.readTail(EXPORT_FILE_TAIL).orEmpty()
            .filterNot { it in liveSet }
        foldBeats(if (persisted.isEmpty()) live else persisted + live)
    }

    private fun foldBeats(all: List<String>): List<String> {
        val isBeat: (String) -> Boolean = { it.contains(" js heartbeat ") }
        val beats = all.count(isBeat)
        return if (beats <= KEEP_BEATS + 1) {
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

    private fun wallClock(): String =
        java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())

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

    /**
     * 落盘镜像：单线程串行追加，逐行 flush（进程被杀时最后一条已完整
     * 到内核即不丢）。队列有界，积压溢出静默丢——诊断写盘永不允许
     * 反压主线程。超量旋转：保留尾部 [FILE_TRIM_TO] 行重写。
     */
    private class DiagSink(private val file: File) {
        private val executor = Executors.newSingleThreadExecutor { r ->
            Thread(r, "feelime-diag").apply { isDaemon = true }
        }
        private val queue = LinkedBlockingQueue<String>(512)
        // 文件互斥（写/裁剪/导出读）：见 writeBatch 注释。
        private val fileLock = java.util.concurrent.locks.ReentrantLock()
        @Volatile private var lines = -1 // -1 = 未统计（懒计数）
        private var started = false

        fun append(line: String) {
            if (!started) {
                started = true
                executor.execute { drainLoop() }
            }
            queue.offer(line) // 满即丢：见类注释的反压策略
        }

        /** 同步追加（崩溃/退因取证路径）：直接写盘 + fd.sync，绕过
         *  异步队列——硬崩时队尾必丢，这里保证字节已到介质。 */
        fun appendSync(line: String) {
            fileLock.lock()
            try {
                file.parentFile?.mkdirs()
                FileOutputStream(file, true).use { out ->
                    out.write((line + "\n").toByteArray())
                    out.flush()
                    out.fd.sync()
                }
                if (lines >= 0) lines += 1
            } catch (_: java.io.IOException) {
                // 取证尽力而为：盘满等 IO 异常不允许反噬崩溃路径。
            } finally {
                fileLock.unlock()
            }
        }

        private fun drainLoop() {
            while (true) {
                // 首行阻塞等待，随后一把抓走积压（至多 64 条）合并一次写盘
                val first = try {
                    queue.poll(5, TimeUnit.SECONDS)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    return
                } ?: continue
                val batch = ArrayList<String>(32).apply {
                    add(first)
                    queue.drainTo(this, 64)
                }
                runCatching { writeBatch(batch) }
            }
        }

        private fun writeBatch(batch: List<String>) {
            // 目录创建与既有行数统计都在 executor 线程做（append 的调用方
            // 是主线程，只入队不碰盘）。文件读写（写/裁剪/导出读）一律持
            // fileLock：导出读不能撞上半截写入或裁剪重写（codex 评审 P2
            // 的并发读撕裂）。
            fileLock.lock()
            try {
                file.parentFile?.mkdirs()
                if (lines < 0) lines = if (file.exists()) file.readLines().size else 0
                FileOutputStream(file, true).use { out ->
                    out.write(batch.joinToString("\n", postfix = "\n").toByteArray())
                    out.flush()
                }
                lines += batch.size
                if (lines > MAX_FILE_LINES) trimLocked()
            } finally {
                fileLock.unlock()
            }
        }

        private fun trimLocked() {
            // 保留行按行分隔拼回（codex 评审 P1：分隔符为空会把 2000 条
            // 拼成一条巨行——readTail 的按行截尾、心跳折叠、后续裁剪的
            // 行数口径全毁）。
            val kept = file.readLines().takeLast(FILE_TRIM_TO)
            file.writeText(kept.joinToString("\n", postfix = "\n"))
            lines = kept.size
        }

        /** 导出路径调用：读尾部 [n] 行。不做排空——尚未落盘的事件必在
         *  调用方（snapshot）并集的内存环里（logLocked 先进环再入队），
         *  等在途写落盘是白等；原先 submit 空任务排在永不返回的
         *  drainLoop 之后，导出每次干等 2s 超时且读数可能撞上裁剪重写
         *  （codex 评审 P2）。持 fileLock 与写线程互斥，读到的一定是
         *  完整文件。 */
        fun readTail(n: Int): List<String> {
            fileLock.lock()
            try {
                return file.takeIf { it.exists() }?.readLines()?.takeLast(n).orEmpty()
            } finally {
                fileLock.unlock()
            }
        }
    }
}
