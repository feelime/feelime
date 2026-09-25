package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** #27 setChromeColor 的颜色解析（独立评审要求钉住）：#RGB/#RRGGBB/
 *  #AARRGGBB、rgb()/rgba()（getComputedStyle 的产出形态）、transparent；
 *  垃圾值返回 null 由调用方保持旧值。直测 FeelimeService.kt 顶层的
 *  纯 Kotlin 实现（无 android.graphics 依赖）。 */
class ChromeColorParseTest {

    @Test
    fun `hex 三种宽度`() {
        assertEquals((0xFF shl 24) or 0xE2E3E8, parseChromeColor("#e2e3e8"))
        // #333 = 每位重复：3→33。
        assertEquals((0xFF shl 24) or 0x333333, parseChromeColor("#333"))
        assertEquals(0x80E2E3E8.toInt(), parseChromeColor("#80e2e3e8"))
    }

    @Test
    fun `rgb 空格与逗号分隔`() {
        // getComputedStyle 的两种产出形态。
        assertEquals((0xFF shl 24) or (226 shl 16) or (227 shl 8) or 232, parseChromeColor("rgb(226, 227, 232)"))
        assertEquals((0xFF shl 24) or (226 shl 16) or (227 shl 8) or 232, parseChromeColor("rgb(226 227 232)"))
    }

    @Test
    fun `rgba 的 alpha 缩放`() {
        assertEquals((0xFF shl 24) or (32 shl 16) or (32 shl 8) or 32, parseChromeColor("rgba(32, 32, 32, 1)"))
        assertEquals((32 shl 16) or (32 shl 8) or 32, parseChromeColor("rgba(32, 32, 32, 0)"))
    }

    @Test
    fun `transparent 与垃圾值`() {
        assertEquals(0, parseChromeColor("transparent"))
        assertEquals(0, parseChromeColor(" TRANSPARENT "))
        assertNull(parseChromeColor("not-a-color"))
        assertNull(parseChromeColor("#zzz"))
        assertNull(parseChromeColor("#12345"))
        // 通道值越界被钳到 0..255（不再溢进 alpha 位）；负号的 "-"
        // 被分隔符吃掉，按 1 取值（getComputedStyle 不会产出负数）。
        assertEquals((0xFF shl 24) or (255 shl 16) or (1 shl 8) or 255, parseChromeColor("rgb(260, -1, 300)"))
    }
}
