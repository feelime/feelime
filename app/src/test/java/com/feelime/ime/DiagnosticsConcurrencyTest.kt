package com.feelime.ime

import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class DiagnosticsConcurrencyTest {
    @Test fun `slow critical fsync permits ordinary enqueue and acknowledgement waits for sync`() {
        val file = Files.createTempDirectory("diag-sync").resolve("events.log").toFile()
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val sink = Diagnostics.DiagSink(file) { output ->
            entered.countDown()
            check(release.await(5, TimeUnit.SECONDS))
            output.fd.sync()
        }
        val executor = Executors.newFixedThreadPool(2)
        try {
            sink.append("before queued")
            val critical = executor.submit { sink.appendCritical("critical must survive").await() }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            assertFalse(critical.isDone)
            executor.submit { sink.append("input still accepted") }.get(1, TimeUnit.SECONDS)
            release.countDown()
            critical.get(5, TimeUnit.SECONDS)
            val barrier = sink.appendCritical("barrier")
            assertTrue(barrier.await(5, TimeUnit.SECONDS))
            val lines = file.readLines()
            assertTrue(lines.indexOfFirst { it.contains("before queued") } < lines.indexOfFirst { it.contains("critical must survive") })
            assertTrue(lines.indexOfFirst { it.contains("critical must survive") } < lines.indexOfFirst { it.contains("input still accepted") })
        } finally {
            release.countDown()
            executor.shutdownNow()
            checkNotNull(file.parentFile).deleteRecursively()
        }
    }
}
