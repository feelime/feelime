package com.feelime.ime

import com.feelime.ime.engine.InputMode
import org.junit.Assert.assertTrue
import org.junit.Test

class HardwareAndQuickReturnModesTest {
    @Test
    fun wubi86JoinsHardwareTextAndControlAllowlists() {
        assertTrue(InputMode.WUBI_86 in HW_CHAR_MODES)
        assertTrue(InputMode.WUBI_86 in HW_CTRL_MODES)
    }

    @Test
    fun wubi86CanBeRememberedAsTheQuickReturnKeyboard() {
        assertTrue(InputMode.WUBI_86.wireName in QUICK_RETURN_MODES)
    }
}
