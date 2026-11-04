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
    @Test fun `single pixel edges terminate sampling without overflow`() {
        for ((w, h) in listOf(1 to 1, 1 to 4096)) {
            val target = BackgroundImageStore.importSize(w, h)
            assertEquals(1, BackgroundImageStore.importSample(w, h, target.first, target.second))
        }
        assertEquals(8, BackgroundImageStore.importSample(6000, 4000, 720, 480))
        assertEquals(1 shl 30, BackgroundImageStore.importSample(Int.MAX_VALUE, Int.MAX_VALUE, 1, 1))
    }

    @Test fun `single pixel short edge does not block long edge sampling`() {
        for ((width, expected) in listOf(4096 to 4, 1_048_576 to 1024,
            16_777_216 to 16384, Int.MAX_VALUE to 2097152)) {
            val target = BackgroundImageStore.importSize(width, 1)
            val sample = BackgroundImageStore.importSample(width, 1, target.first, target.second)
            assertEquals(expected, sample)
            assertEquals(expected, BackgroundImageStore.importSample(1, width, target.second, target.first))
            BackgroundImageStore.checkImportDecodeBudget(width, 1, sample)
            BackgroundImageStore.checkImportDecodeBudget(1, width, sample)
            assertTrue((width.toLong() + sample - 1) / sample <= 1440)
        }
    }

    @Test fun `decode budget accepts sampled images including target limits and rotated axes`() {
        for ((w, h) in listOf(6000 to 4000, 720 to 4096, 1 to 1, 1 to 4096,
            Int.MAX_VALUE to (Int.MAX_VALUE / 2))) {
            val target = BackgroundImageStore.importSize(w, h)
            val sample = BackgroundImageStore.importSample(w, h, target.first, target.second)
            BackgroundImageStore.checkImportDecodeBudget(w, h, sample)
            BackgroundImageStore.checkImportDecodeBudget(h, w, sample)
        }
        BackgroundImageStore.checkImportDecodeBudget(8192, 1, 1)
        BackgroundImageStore.checkImportDecodeBudget(3000, 4000, 1)
    }

    @Test fun `decode budget rejects oversized allocation and rounds sample dimensions up`() {
        for ((w, h, sample) in listOf(Triple(16_777_216, 1, 1), Triple(1, 16_777_216, 1),
            Triple(4000, 4000, 1), Triple(Int.MAX_VALUE, Int.MAX_VALUE, 1),
            Triple(16_385, 1, 2), Triple(1, 1, 0))) {
            try {
                BackgroundImageStore.checkImportDecodeBudget(w, h, sample)
                fail("accepted decode $w x $h sample=$sample")
            } catch (_: IllegalArgumentException) { }
        }
    }
}
