package com.feelime.ime

import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test

class BackgroundImageRequestsTest {
    @Test fun `old decode cannot overwrite new import builtin or clear after activity recreation`() {
        for (choice in listOf("custom", "builtin", "clear")) {
            val requests = BackgroundImageRequests()
            val oldPage = requests.session()
            val old = checkNotNull(oldPage.begin("light"))
            val decoding = CountDownLatch(1)
            val finishDecode = CountDownLatch(1)
            val worker = Executors.newSingleThreadExecutor()
            val root = Files.createTempDirectory("background-request").toFile()
            val image = root.resolve("image.jpg")
            val source = root.resolve("source-pref")
            image.writeText("initial")
            source.writeText("initial")
            try {
                val stale = worker.submit<Boolean> {
                    decoding.countDown()
                    check(finishDecode.await(5, TimeUnit.SECONDS))
                    old.applyIfCurrent {
                        image.writeText("A")
                        source.writeText("old-custom")
                        fail("closed activity wrote its decoded image")
                    }
                }
                assertTrue(decoding.await(5, TimeUnit.SECONDS))
                oldPage.close()
                val newPage = requests.session()
                val current = checkNotNull(newPage.begin("light"))
                assertTrue(current.applyIfCurrent {
                    if (choice == "clear") {
                        image.delete()
                        source.delete()
                    } else {
                        image.writeText("B")
                        source.writeText(choice)
                    }
                })
                finishDecode.countDown()
                assertFalse(stale.get(5, TimeUnit.SECONDS))
                if (choice == "clear") {
                    assertFalse(image.exists())
                    assertFalse(source.exists())
                } else {
                    assertEquals("B", image.readText())
                    assertEquals(choice, source.readText())
                }
            } finally {
                finishDecode.countDown()
                worker.shutdownNow()
                assertTrue(worker.awaitTermination(5, TimeUnit.SECONDS))
                root.deleteRecursively()
            }
        }
    }

    @Test fun `closing without a replacement discards old file and preference writes`() {
        val page = BackgroundImageRequests().session()
        val request = checkNotNull(page.begin("dark"))
        page.close()
        assertNull(page.begin("dark"))
        assertFalse(request.applyIfCurrent { fail("closed page wrote") })
    }

    @Test fun `request number rejects superseded decode even before newer decode completes`() {
        val requests = BackgroundImageRequests()
        val page = requests.session()
        val old = checkNotNull(page.begin("light"))
        val new = checkNotNull(page.begin("light"))
        assertFalse(old.applyIfCurrent { fail("superseded request wrote") })
        assertTrue(new.applyIfCurrent { })
        val anotherPage = requests.session()
        val newest = checkNotNull(anotherPage.begin("light"))
        assertFalse(new.applyIfCurrent { fail("older page overwrote newer choice") })
        assertTrue(newest.applyIfCurrent { })
    }

    @Test fun `light and dark requests do not invalidate one another`() {
        val page = BackgroundImageRequests().session()
        val light = checkNotNull(page.begin("light"))
        val dark = checkNotNull(page.begin("dark"))
        assertTrue(light.applyIfCurrent { })
        assertTrue(dark.applyIfCurrent { })
    }

    @Test fun `close cannot interleave between final validation and file plus preference writes`() {
        val page = BackgroundImageRequests().session()
        val request = checkNotNull(page.begin("light"))
        val writing = CountDownLatch(1)
        val finishWrite = CountDownLatch(1)
        val closing = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        val writes = mutableListOf<String>()
        try {
            val install = pool.submit<Boolean> {
                request.applyIfCurrent {
                    writing.countDown()
                    check(finishWrite.await(5, TimeUnit.SECONDS))
                    writes.add("file")
                    writes.add("preference")
                }
            }
            assertTrue(writing.await(5, TimeUnit.SECONDS))
            val close = pool.submit {
                closing.countDown()
                page.close()
                writes.add("closed")
            }
            assertTrue(closing.await(5, TimeUnit.SECONDS))
            assertFalse(close.isDone)
            finishWrite.countDown()
            assertTrue(install.get(5, TimeUnit.SECONDS))
            close.get(5, TimeUnit.SECONDS)
            assertEquals(listOf("file", "preference", "closed"), writes)
            assertFalse(request.applyIfCurrent { fail("write after close") })
        } finally {
            finishWrite.countDown()
            pool.shutdownNow()
            assertTrue(pool.awaitTermination(5, TimeUnit.SECONDS))
        }
    }
}
