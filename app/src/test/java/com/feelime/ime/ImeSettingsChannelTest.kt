package com.feelime.ime

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch

/** #85 设置页手势通道的代际隔离（codex 复审 P2：旧实例迟到上报
 *  不得覆盖新实例状态——check-then-write 与注册交错污染）。 */
class ImeSettingsChannelTest {
    @Test
    fun staleGenerationReportsNeverOverrideTheNewInstance() {
        val genA = ImeSettingsChannel.register { }
        ImeSettingsChannel.reportFocus(genA, true)
        ImeSettingsChannel.reportGestureSupport(genA)
        // 新实例注册：状态复位
        val genB = ImeSettingsChannel.register { }
        assertFalse(ImeSettingsChannel.inputFocused)
        assertFalse(ImeSettingsChannel.gestureCapable)
        // 旧 bridge 的迟到上报（顺序场景）
        ImeSettingsChannel.reportFocus(genA, true)
        ImeSettingsChannel.reportGestureSupport(genA)
        assertFalse(ImeSettingsChannel.inputFocused)
        assertFalse(ImeSettingsChannel.gestureCapable)
        // 新实例正常上报生效
        ImeSettingsChannel.reportFocus(genB, true)
        ImeSettingsChannel.reportGestureSupport(genB)
        assertTrue(ImeSettingsChannel.inputFocused)
        assertTrue(ImeSettingsChannel.gestureCapable)
        ImeSettingsChannel.unregister(genB)
    }

    @Test
    fun concurrentStaleReportsNeverRacePastRegistration() {
        // codex round 13 P2：旧代际必须在仍持有通道时开始上报，与新注册
        // 真实交错——若先注册新代际再上报，去掉生产锁照样全绿（假覆盖）。
        // 形态：4 个 racer 连续轰炸旧上报，主线程反复注册新代际并在每次
        // register 返回后立即校验。有锁：register 返回即持有干净状态（旧
        // 上报要么已被复位覆盖、要么因代际不符被拒）。无锁：stale 上报
        // 「校验通过后暂停 → 新注册复位 → 旧写入落地」即被当场抓到。
        // codex round 14 P2：断言失败路径必须回收 racer（stop/join 进
        // finally，线程标 daemon），否则一次红灯泄漏 4 个死循环线程拖住
        // 整个测试进程。
        repeat(50) {
            val stale = ImeSettingsChannel.register { }
            // stale 仍是当前代际：先让它的上报合法生效
            ImeSettingsChannel.reportFocus(stale, true)
            ImeSettingsChannel.reportGestureSupport(stale)
            assertTrue(ImeSettingsChannel.inputFocused)
            assertTrue(ImeSettingsChannel.gestureCapable)
            val stop = java.util.concurrent.atomic.AtomicBoolean(false)
            val reports = java.util.concurrent.atomic.AtomicLong(0)
            val racers = (1..4).map {
                Thread {
                    while (!stop.get()) {
                        ImeSettingsChannel.reportFocus(stale, true)
                        ImeSettingsChannel.reportGestureSupport(stale)
                        reports.incrementAndGet()
                    }
                }.apply { isDaemon = true }
            }
            var latestFresh = -1
            try {
                racers.forEach { it.start() }
                // 启动握手：确认 racer 已开始上报再首度换代，窗口不靠运气
                val deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(5)
                while (reports.get() == 0L && System.nanoTime() < deadline) Thread.sleep(1)
                assertTrue("racers must report before the first fresh register", reports.get() > 0L)
                repeat(200) {
                    latestFresh = ImeSettingsChannel.register { }
                    assertFalse(
                        "stale report landed after fresh register #${it + 1} reset",
                        ImeSettingsChannel.inputFocused || ImeSettingsChannel.gestureCapable)
                }
            } finally {
                // codex round 14 P2：断言失败也必须回收 racer（daemon +
                // stop/join 进 finally），否则泄漏死循环线程拖住测试进程。
                stop.set(true)
                racers.forEach { it.join(5000) }
            }
            // 终态检查必须在 join 之后、注销之前（codex round 15 P2）：
            // 放 join 前会漏掉「旧上报校验通过后暂停 → 主线程断言完 →
            // 迟到写入落地」的尾巴写入，且随后的注销会把它清掉（假绿）。
            // 本块只在 try 成功时到达（latestFresh 必 ≥ 0），失败路径的
            // 残留状态由下一轮 register 开头的复位兜底。
            assertFalse("late stale write survived past the join", ImeSettingsChannel.inputFocused)
            assertFalse("late stale write survived past the join", ImeSettingsChannel.gestureCapable)
            // 旧代际的注销不得清掉新执行器（断言须在注销 latestFresh 之前）
            ImeSettingsChannel.unregister(stale)
            assertTrue("stale unregister must not clear the fresh executor",
                ImeSettingsChannel.evaluate != null)
            ImeSettingsChannel.unregister(latestFresh)
        }
    }
}
