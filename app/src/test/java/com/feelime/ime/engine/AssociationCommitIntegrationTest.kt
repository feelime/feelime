package com.feelime.ime.engine

import java.util.concurrent.Executor
import org.junit.Assert.*
import org.junit.Test

/** 真实 coordinator + 缓存，主队列按 Service 的投递顺序运行，不依赖 Android 设备。 */
class AssociationCommitIntegrationTest {
    private class Harness {
        val main = ArrayDeque<() -> Unit>()
        val loads = ArrayDeque<Runnable>()
        val editor = RecordingEditor()
        val cache = AssociationCache()
        var generation = 0L
        var contextGeneration = 0L
        var editorGeneration = 0L
        var panelGeneration = 0L
        var enabled = true
        val delivered = mutableListOf<List<String>>()
        val coordinator = TextInputCoordinator(editor, { generation++ }, { FakeEngine() },
            mainPoster = { main.addLast(it) })
        init {
            coordinator.onEditorStarted(false)
            drain()
        }
        fun drain() { while (main.isNotEmpty()) main.removeFirst()() }
        fun load() = cache.load(Executor { loads.addLast(it) }) {
            mapOf("你好" to listOf("中国"), "中国" to listOf("人民"), "人民" to listOf("生活"))
        }
        fun choose(text: String) {
            val context = ++contextGeneration
            val editorAtClick = editorGeneration
            val panelAtClick = panelGeneration
            coordinator.pasteExternal(text) {
                if (context != contextGeneration || editorAtClick != editorGeneration ||
                    panelAtClick != panelGeneration || !enabled) return@pasteExternal
                val request = ++generation
                cache.query(text) { words ->
                    main.addLast {
                        if (request == generation && editorAtClick == editorGeneration &&
                            panelAtClick == panelGeneration && enabled) delivered.add(words)
                    }
                }
                load()
            }
        }
    }

    @Test fun `warm cache allows consecutive association choices after each own reset echo`() {
        val h = Harness()
        h.load()
        h.loads.removeFirst().run()
        for ((text, next) in listOf("你好" to "中国", "中国" to "人民", "人民" to "生活")) {
            val before = h.delivered.size
            h.choose(text)
            assertEquals(before, h.delivered.size)
            h.drain()
            assertEquals(listOf(next), h.delivered.last())
        }
        assertEquals("你好中国人民", h.editor.text)
    }

    @Test fun `cold load followed by consecutive choices retains the newest association`() {
        val h = Harness()
        h.choose("你好")
        h.drain()
        assertTrue(h.delivered.isEmpty())
        // 首次加载还未结束时继续选择，不能给前一次提交补送。
        h.choose("中国")
        h.drain()
        assertEquals(1, h.loads.size)
        h.loads.removeFirst().run()
        h.drain()
        assertEquals(listOf(listOf("人民")), h.delivered)
        h.choose("人民")
        h.drain()
        assertEquals(listOf("生活"), h.delivered.last())
        assertEquals("你好中国人民", h.editor.text)
    }

    @Test fun `new input editor panel hide and disabled setting invalidate pending delivery`() {
        for (change in listOf("key", "editor", "panel", "hide", "off")) {
            for (beforeReset in listOf(false, true)) {
                val h = Harness()
                h.choose("你好")
                if (!beforeReset) h.drain()
                when (change) {
                    "key" -> h.coordinator.key('x'.code)
                    "editor" -> h.editorGeneration++
                    "panel" -> h.panelGeneration++
                    "hide" -> { h.contextGeneration++; h.generation++ }
                    "off" -> h.enabled = false
                }
                h.drain()
                while (h.loads.isNotEmpty()) h.loads.removeFirst().run()
                h.drain()
                assertTrue("$change beforeReset=$beforeReset", h.delivered.isEmpty())
            }
        }
    }

    @Test fun `completion waits for editor write with inline and posted reset and queued paste`() {
        for (inline in listOf(false, true)) {
            val main = ArrayDeque<() -> Unit>()
            val editor = RecordingEditor()
            val c = TextInputCoordinator(editor, {}, { FakeEngine() },
                mainPoster = { if (inline) it() else main.addLast(it) })
            fun drain() { while (main.isNotEmpty()) main.removeFirst()() }
            c.onEditorStarted(false)
            drain()
            // 异步回声时，第二次粘贴会排在这条 key 后面。
            c.key('x'.code)
            var completed = 0
            c.pasteExternal("中国") {
                assertTrue(editor.text.endsWith("中国"))
                completed++
            }
            drain()
            assertEquals(1, completed)
        }
    }
}
