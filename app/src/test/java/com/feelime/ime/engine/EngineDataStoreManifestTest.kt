package com.feelime.ime.engine

import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class EngineDataStoreManifestTest {
    private fun withColdManifest(test: () -> Unit) {
        val field = EngineDataStore::class.java.getDeclaredField("cachedManifest").apply { isAccessible = true }
        val saved = field.get(EngineDataStore)
        field.set(EngineDataStore, null)
        try { test() } finally { field.set(EngineDataStore, saved) }
    }

    @Test fun `first query waits for manifest only while deployment still holds ensure monitor`() = withColdManifest {
        val reading = CountDownLatch(1)
        val finishRead = CountDownLatch(1)
        val deploying = CountDownLatch(1)
        val finishDeploy = CountDownLatch(1)
        val querying = CountDownLatch(1)
        val queryThread = java.util.concurrent.atomic.AtomicReference<Thread>()
        val pool = Executors.newFixedThreadPool(2)
        val parsed = EngineDataStore.ParsedManifest("test-version", emptyMap())
        try {
            // ensure 是 @Synchronized：复用同一个真实对象锁，并暂停清单读取及后续部署。
            val deploy = pool.submit {
                synchronized(EngineDataStore) {
                    EngineDataStore.manifest {
                        reading.countDown()
                        check(finishRead.await(5, TimeUnit.SECONDS))
                        parsed
                    }
                    deploying.countDown()
                    check(finishDeploy.await(5, TimeUnit.SECONDS))
                }
            }
            assertTrue(reading.await(5, TimeUnit.SECONDS))
            val query = pool.submit<EngineDataStore.ParsedManifest?> {
                queryThread.set(Thread.currentThread())
                querying.countDown()
                EngineDataStore.manifest { error("manifest read twice") }
            }
            assertTrue(querying.await(5, TimeUnit.SECONDS))
            // 确认查询已进入取锁路径，避免读取过快让测试误走缓存命中分支。
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            while (queryThread.get().state != Thread.State.BLOCKED && System.nanoTime() < deadline) Thread.yield()
            assertEquals(Thread.State.BLOCKED, queryThread.get().state)
            assertFalse(query.isDone)
            finishRead.countDown()
            assertTrue(deploying.await(5, TimeUnit.SECONDS))
            assertSame(parsed, query.get(1, TimeUnit.SECONDS))
            assertFalse(deploy.isDone)
            finishDeploy.countDown()
            deploy.get(5, TimeUnit.SECONDS)
        } finally {
            finishRead.countDown()
            finishDeploy.countDown()
            pool.shutdownNow()
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS))
        }
    }

    @Test fun `unreadable manifest is retried rather than cached`() = withColdManifest {
        assertNull(EngineDataStore.manifest { null })
        val parsed = EngineDataStore.ParsedManifest("retry", emptyMap())
        assertSame(parsed, EngineDataStore.manifest { parsed })
        assertSame(parsed, EngineDataStore.manifest { error("cached manifest was reloaded") })
    }
}
