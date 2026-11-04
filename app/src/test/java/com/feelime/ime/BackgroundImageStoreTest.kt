package com.feelime.ime

import org.junit.Assert.*
import org.junit.Test

class BackgroundImageStoreTest {
    @Test fun `accepted images keep original width policy and aspect ratio`() {
        assertEquals(720 to 480, BackgroundImageStore.importSize(6000, 4000))
        assertEquals(300 to 900, BackgroundImageStore.importSize(300, 900))
        assertEquals(720 to 4096, BackgroundImageStore.importSize(720, 4096))
    }
    @Test fun `long images are rejected before allocating pixels instead of cropped`() {
        for ((w, h) in listOf(720 to 20_000, 0 to 10, 1 to Int.MAX_VALUE)) {
            try {
                BackgroundImageStore.importSize(w, h)
                fail("accepted $w x $h")
            } catch (_: IllegalArgumentException) { }
        }
    }
}
