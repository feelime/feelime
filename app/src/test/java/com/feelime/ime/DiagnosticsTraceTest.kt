package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 取证 v2（#54 手写连环崩溃，2026-10-09）：ApplicationExitInfo
 * traceInputStream 的 tombstone 抽取不变量——头字段（signal/Abort
 * message/pid/Cmdline）与全部 backtrace 帧（#NN pc + .so + 偏移）保留，
 * 噪声行（寄存器/内存dump/相邻线程的重复头）丢弃，总预算受控。
 */
class DiagnosticsTraceTest {
    private val sample = """
        *** *** ***
        Build fingerprint: 'vendor/oneplus/app'
        Revision: '0'
        ABI: 'arm64'
        Timestamp: 2026-10-09 21:38:41.649+0800
        Cmdline: com.feelime.ime
        pid: 17729, tid: 17738, name: DefaultDispatche >>> com.feelime.ime <<<
        uid: 10xxx
        signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0
        Abort message: 'onnxruntime abort'
            x0  0000000000000000  x1  0000000000000000
            x2  0000007b8e600000  x3  0000000000000004
        backtrace:
              #00 pc 000000000001a4f0  /data/app/~~xyz/com.feelime.ime-abc/lib/arm64-v8a/libonnxruntime.so (ai::onnxruntime::Foo+728)
              #01 pc 00000000000b2c34  /data/app/~~xyz/com.feelime.ime-abc/lib/arm64-v8a/libonnxruntime.so (ai::onnxruntime::Bar+1124)
              #02 pc 0000000000055f18  /apex/com.android.art/lib64/libart.so (art::Interpreter+88)
              #03 pc 0000000000123ab4  /data/misc/apexdata/com.android.art/dalvik-cache/arm64/boot.oat (java_method+420)
        memory near x0:
            0000000000000000 0000000000000000 0000000000000000

        --- --- ---
        pid: 17729, tid: 17730, name: RenderThread
        signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0
        backtrace:
              #00 pc 0000000000004210  /system/lib64/libhwui.so
    """.trimIndent()

    @Test
    fun keepsHeaderAndFramesDropsNoise() {
        val lines = Diagnostics.extractTraceLines(sample)
        val text = lines.joinToString("\n")
        assertTrue("signal line kept", text.contains("signal 11 (SIGSEGV)"))
        assertTrue("abort message kept", text.contains("Abort message: 'onnxruntime abort'"))
        assertTrue("cmdline kept", text.contains("Cmdline: com.feelime.ime"))
        assertTrue("first frame kept with module",
            text.contains("#00 pc") && text.contains("libonnxruntime.so"))
        assertTrue("register rows dropped", !text.contains("x0  0000"))
        assertTrue("memory dump dropped", !text.contains("memory near"))
        // 相邻线程的重复 signal/pid 头去重，预算让给帧表。
        assertEquals(1, lines.count { it.startsWith("signal ") })
        assertEquals(1, lines.count { it.startsWith("pid:") })
    }

    @Test
    fun budgetCapsTotalVolume() {
        val lines = Diagnostics.extractTraceLines(sample, maxChars = 200)
        // 只装得下头两三行：帧表被预算截断而非越限。
        assertTrue(lines.isNotEmpty())
        assertTrue(lines.joinToString("").length <= 400)
        assertTrue(lines.size < 8)
    }

    @Test
    fun blankTraceYieldsNothing() {
        assertTrue(Diagnostics.extractTraceLines("").isEmpty())
        assertTrue(Diagnostics.extractTraceLines("   \n  \n").isEmpty())
    }

    @Test
    fun longFrameLinesAreClampedPerEvent() {
        val longFrame = "        #42 pc " + "a".repeat(400) + " (Sym+1)"
        val lines = Diagnostics.extractTraceLines(longFrame)
        // 单行钳到事件行上限内（logSyncLocked 的 220 字符口径）。
        assertTrue(lines.isNotEmpty())
        assertTrue(lines[0].length <= 200)
    }
}
