package com.feelime.ime

import org.junit.Assert.*
import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

class InkWorkQueueTest {
    private val factory = ThreadFactory { Thread(it, "ink-queue-test").apply { isDaemon = true } }
    private fun CountDownLatch.waitFor() = assertTrue(await(3, TimeUnit.SECONDS))

    @Test fun retainsOnlyTheNewestPendingRequest() {
        val queue = InkWorkQueue(factory)
        val started = CountDownLatch(1)
        val unblock = CountDownLatch(1)
        val latest = CountDownLatch(1)
        val seen = Collections.synchronizedList(mutableListOf<Int>())
        try {
            queue.submit { started.countDown(); unblock.waitFor(); seen.add(1) }
            started.waitFor()
            for (i in 2..100) queue.submit { seen.add(i); if (i == 100) latest.countDown() }
            unblock.countDown()
            latest.waitFor()
            assertEquals(listOf(1, 100), seen.toList())
        } finally { unblock.countDown(); queue.close {} }
    }

    @Test fun releaseWaitsForRunningWorkAndDropsPendingWork() {
        val queue = InkWorkQueue(factory)
        val started = CountDownLatch(1)
        val unblock = CountDownLatch(1)
        val released = CountDownLatch(1)
        val seen = Collections.synchronizedList(mutableListOf<String>())
        queue.submit { seen.add("start"); started.countDown(); unblock.waitFor(); seen.add("end") }
        started.waitFor()
        queue.submit { seen.add("obsolete") }
        queue.close { seen.add("release"); released.countDown() }
        assertFalse(queue.submit { seen.add("after-close") })
        assertEquals(listOf("start"), seen.toList())
        unblock.countDown()
        released.waitFor()
        queue.close { seen.add("second-release") }
        assertEquals(listOf("start", "end", "release"), seen.toList())
    }
}
