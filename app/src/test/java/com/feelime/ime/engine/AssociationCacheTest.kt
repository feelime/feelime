package com.feelime.ime.engine

import java.util.concurrent.Executor
import org.junit.Assert.*
import org.junit.Test

class AssociationCacheTest {
    @Test fun `query during load returns immediately and only latest commit receives results`() {
        val cache = AssociationCache()
        val tasks = ArrayDeque<Runnable>()
        val executor = Executor { tasks.add(it) }
        val deliveries = mutableListOf<String>()
        cache.query("你好") { deliveries.add("old") }
        cache.load(executor) { mapOf("好" to listOf("世界")) }
        cache.query("真好") { deliveries.addAll(it) }
        cache.load(executor) { error("duplicate load") }
        assertTrue(deliveries.isEmpty())
        assertEquals(1, tasks.size)
        tasks.removeFirst().run()
        assertEquals(listOf("世界"), deliveries)
        cache.query("真好") { assertEquals(listOf("世界"), it) }
    }

    @Test fun `missing deployment and failed parse retry instead of caching empty ready table`() {
        val cache = AssociationCache()
        val inline = Executor { it.run() }
        var delivered: List<String>? = null
        cache.query("你") { delivered = it }
        cache.load(inline) { null }
        assertNull(delivered)
        cache.load(inline) { error("partial deployment") }
        assertNull(delivered)
        cache.load(inline) { mapOf("你" to listOf("好")) }
        assertEquals(listOf("好"), delivered)
        cache.query("无") { assertEquals(emptyList<String>(), it) }
    }
    @Test fun `cancelling a pending cold query drops callback without cancelling shared preload`() {
        val cache = AssociationCache()
        val tasks = ArrayDeque<Runnable>()
        var called = false
        val cancel = cache.query("你") { called = true }
        cache.load(Executor { tasks.add(it) }) { mapOf("你" to listOf("好")) }
        cancel()
        tasks.removeFirst().run()
        assertFalse(called)
        cache.query("你") { assertEquals(listOf("好"), it) }
    }
}
