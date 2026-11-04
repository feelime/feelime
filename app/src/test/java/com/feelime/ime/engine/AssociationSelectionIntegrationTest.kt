package com.feelime.ime.engine

import java.util.concurrent.Executor
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** 编辑器回调与联想投递分别排队，覆盖自身回调晚于提交、早于结果的窗口。 */
@RunWith(Parameterized::class)
class AssociationSelectionIntegrationTest(private val own: Boolean, private val warm: Boolean, private val mode: InputMode) {
    companion object {
        @JvmStatic @Parameterized.Parameters(name = "own={0}, warm={1}, mode={2}")
        fun cases(): List<Array<Any>> = listOf(false, true).flatMap { own ->
            listOf(false, true).flatMap { warm ->
                listOf(InputMode.PINYIN, InputMode.DOUBLE_PINYIN, InputMode.T9, InputMode.STROKE, InputMode.FRENCH)
                    .map { arrayOf<Any>(own, warm, it) }
            }
        }
    }
    private class Harness(val own: Boolean, val warm: Boolean, val mode: InputMode) {
        val main = ArrayDeque<() -> Unit>()
        val selections = ArrayDeque<() -> Unit>()
        val loads = ArrayDeque<Runnable>()
        val editor = RecordingEditor()
        val cache = AssociationCache()
        val delivered = mutableListOf<List<String>>()
        val fake = FakeEngine()
        var eventGeneration = 0L
        var failNextKey = false
        var hardwareCommit: String? = "你好"
        lateinit var coordinator: TextInputCoordinator
        private val port = object : EditorPort by editor {
            fun write(block: () -> Unit) {
                val old = editor.caret
                val text = editor.text
                block()
                val new = editor.caret
                if (old != new || text != editor.text) selections.addLast {
                    coordinator.onEditorSelectionChanged(old, old, new, new)
                }
            }
            override fun setComposing(text: String) = write { editor.setComposing(text) }
            override fun commitText(text: String) = write { editor.commitText(text) }
        }
        init {
            val engine = object : TextEngine by fake {
                override fun dispatch(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck {
                    val command = request.command
                    if (command is EngineCommand.Key && failNextKey) {
                        failNextKey = false
                        emit(fake.state(request.stamp, Phase.ERROR, code = EngineCode.ENGINE_RUNTIME_FAILED))
                        return DispatchAck.Accepted
                    }
                    if (command is EngineCommand.Choose || command is EngineCommand.Key && command.hw) {
                        fake.composing = ""
                        emit(fake.state(request.stamp, Phase.READY,
                            commit = if (command is EngineCommand.Choose) "你好" else hardwareCommit,
                            consumed = command is EngineCommand.Choose))
                        return DispatchAck.Accepted
                    }
                    return fake.dispatch(request, emit)
                }
            }
            coordinator = TextInputCoordinator(port, { event ->
                eventGeneration++
                event.state.commit?.let { request(it) }
            }, { engine }, mainPoster = { main.addLast(it) }, ownAppEditor = { own })
            coordinator.onEditorStarted(false)
            drain()
            coordinator.selectMode(mode)
            drain()
            if (warm) { load(); loads.removeFirst().run() }
        }
        fun drain() { while (main.isNotEmpty()) main.removeFirst()() }
        fun callbacks() { while (selections.isNotEmpty()) selections.removeFirst()() }
        fun load() = cache.load(Executor { loads.addLast(it) }) { mapOf("你好" to listOf("中国")) }
        fun request(text: String = "你好") {
            val input = coordinator.userInputGeneration
            val event = eventGeneration
            cache.query(text) { words -> main.addLast {
                if (input == coordinator.userInputGeneration && event == eventGeneration) delivered.add(words)
            } }
            load()
        }
        fun compose() {
            for (ch in "nihao") {
                coordinator.key(ch.code)
                drain()
                callbacks()
            }
        }
        fun finishResult() {
            while (loads.isNotEmpty()) loads.removeFirst().run()
            drain()
        }
        fun assertOwnCallbacks(input: Long) {
            callbacks()
            assertEquals("own=$own warm=$warm mode=$mode", input, coordinator.userInputGeneration)
        }
    }

    private fun withHarness(block: (Harness) -> Unit) {
        block(Harness(own, warm, mode))
    }

    @Test fun `composing replacements preserve input generation`() = withHarness { h ->
        for (ch in "nihao") {
            h.coordinator.key(ch.code)
            h.drain()
            h.assertOwnCallbacks(h.coordinator.userInputGeneration)
        }
    }

    @Test fun `candidate replacement callbacks preserve warm and cold association`() = withHarness { h ->
        h.compose()
        h.coordinator.choose(h.fake.revision, "candidate")
        val input = h.coordinator.userInputGeneration
        h.main.removeFirst()() // commit 的回调先于暖缓存投递和冷加载完成。
        assertEquals("你好", h.editor.text)
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `literal landing callbacks preserve warm and cold association`() = withHarness { h ->
        h.compose()
        h.coordinator.pasteExternal("你好") { h.request() }
        val input = h.coordinator.userInputGeneration
        h.main.removeFirst()() // Reset 完成后才查询。
        assertEquals("nihao你好", h.editor.text)
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `composition replacement registers own callbacks`() = control("replace")
    @Test fun `composition clear registers own callbacks`() = control("clear")
    @Test fun `composition acceptance registers own callbacks`() = control("accept")
    @Test fun `gesture restore registers own callbacks`() = control("restore")
    @Test fun `engine reset registers own callbacks`() = control("reset")
    @Test fun `composing backspace registers own callbacks`() = control("backspace")

    private fun control(control: String) = withHarness { h ->
        h.compose()
        when (control) {
            "replace" -> h.coordinator.setComposition("na")
            "clear" -> h.coordinator.clearComposing()
            "accept" -> h.coordinator.acceptCurrentComposition()
            "restore" -> { h.coordinator.clearComposing(); h.drain(); h.callbacks(); h.coordinator.gestureRestore("字") }
            "reset" -> h.coordinator.reset()
            "backspace" -> {
                repeat(4) { h.coordinator.backspace(); h.drain(); h.callbacks() }
                h.coordinator.backspace()
            }
        }
        val input = h.coordinator.userInputGeneration
        h.drain()
        h.request()
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals("$control own=${h.own} warm=${h.warm} mode=${h.mode}", listOf(listOf("中国")), h.delivered)
    }

    @Test fun `degrade landing registers own callbacks`() = withHarness { h ->
        h.compose()
        h.failNextKey = true
        h.coordinator.key('x'.code)
        val input = h.coordinator.userInputGeneration
        h.drain()
        assertEquals("nihao", h.editor.text)
        h.request()
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `hardware commit and fallback append each predict one replacement`() = withHarness { h ->
        h.compose()
        h.coordinator.key('1'.code, hw = true)
        val input = h.coordinator.userInputGeneration
        h.main.removeFirst()()
        assertEquals("你好1", h.editor.text)
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `hardware fallback after clearing a span predicts a UTF16 append`() = withHarness { h ->
        h.compose()
        h.hardwareCommit = null
        h.coordinator.key(0x1F600, hw = true)
        val input = h.coordinator.userInputGeneration
        h.drain()
        assertEquals("😀", h.editor.text)
        h.request()
        h.assertOwnCallbacks(input)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `successful native cursor operation preserves later association on its own callback`() = withHarness { h ->
        h.coordinator.pasteExternal("你好")
        h.drain()
        h.callbacks()
        h.coordinator.onExternalEditorMutation() // 手势接受时就作废旧结果。
        h.editor.caret = 1
        h.coordinator.onEditorSelectionApplied(1, 1) // 模拟 service 中成功的 setSelection。
        val input = h.coordinator.userInputGeneration
        h.request()
        h.coordinator.onEditorSelectionChanged(2, 2, 1, 1)
        assertEquals(input, h.coordinator.userInputGeneration)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
        h.delivered.clear()
        h.coordinator.pasteExternal("你好") { h.request() }
        val nextInput = h.coordinator.userInputGeneration
        h.main.removeFirst()()
        assertEquals("你你好好", h.editor.text)
        h.assertOwnCallbacks(nextInput)
        h.finishResult()
        assertEquals(listOf(listOf("中国")), h.delivered)
    }

    @Test fun `real host and panel edits still invalidate warm and cold association`() {
        for (change in listOf("cursor", "selection", "sameSelection", "mutation", "panel", "panelCaret", "hostReturn")) withHarness { h ->
            h.coordinator.pasteExternal("你好")
            h.main.removeFirst()()
            h.callbacks()
            h.request()
            val input = h.coordinator.userInputGeneration
            when (change) {
                "cursor" -> h.coordinator.onEditorSelectionChanged(2, 2, 1, 1)
                "selection" -> h.coordinator.onEditorSelectionChanged(2, 2, 0, 2)
                "sameSelection" -> h.coordinator.onEditorSelectionChanged(2, 2, 2, 2)
                "mutation" -> h.coordinator.onExternalEditorMutation()
                "panel" -> h.coordinator.onInputTargetSelection(-1, -1)
                "panelCaret" -> h.coordinator.onInputTargetSelection(1, 1)
                "hostReturn" -> h.coordinator.onInputTargetSelection(2, 2)
            }
            assertTrue(h.coordinator.userInputGeneration > input)
            h.finishResult()
            assertTrue("$change", h.delivered.isEmpty())
        }
    }
}
