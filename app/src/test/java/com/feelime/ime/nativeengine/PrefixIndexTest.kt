package com.feelime.ime.nativeengine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PrefixIndexTest {
    @Test fun `prefix lookup preserves boundaries and case`() {
        val index = PrefixIndex(listOf("Alpha", "alpine", "middle", "я", "яблоко", "яркий"))
        assertEquals(listOf("Alpha", "alpine"), index.find("AL"))
        assertEquals(listOf("middle"), index.find("mid"))
        assertEquals(listOf("я", "яблоко"), index.find("я", 2))
        assertEquals(emptyList<String>(), index.find("z"))
        assertEquals(emptyList<String>(), index.find("", 0))
    }

    @Test fun `tail lookup only visits binary search and requested results`() {
        var visits = 0
        val words = object : AbstractList<String>() {
            override val size = 150_000
            override fun get(index: Int): String {
                visits++
                return "w" + index.toString().padStart(6, '0')
            }
        }
        assertEquals(24, PrefixIndex(words).find("w149", 24).size)
        assertTrue("visits=$visits", visits < 50)
    }
}
