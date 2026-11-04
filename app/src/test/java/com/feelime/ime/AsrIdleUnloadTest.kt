package com.feelime.ime

import org.junit.Assert.*
import org.junit.Test

class AsrIdleUnloadTest {
    @Test fun `default stays resident and toggle re-arms only while idle`() {
        var task: (() -> Unit)? = null
        var count = 0
        val lease = AsrIdleUnload({ delay, block ->
            assertEquals(300_000L, delay)
            task = block
            { task = null }
        }, { count++ })
        lease.becameIdle()
        assertNull(task)
        lease.setEnabled(true)
        val stale = task!!
        lease.becameActive()
        assertNull(task)
        stale()
        assertEquals(0, count)
        lease.becameIdle()
        task!!()
        assertEquals(1, count)
        lease.becameActive()
        lease.becameIdle()
        lease.setEnabled(false)
        assertNull(task)
        lease.setEnabled(true)
        val closing = task!!
        lease.close()
        closing()
        assertEquals(1, count)
    }
}
