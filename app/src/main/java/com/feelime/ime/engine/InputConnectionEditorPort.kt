package com.feelime.ime.engine

import android.inputmethodservice.InputMethodService
import android.view.KeyEvent

/** EditorPort over the service's current InputConnection. */
class InputConnectionEditorPort(private val service: InputMethodService) : EditorPort {
    override fun finishComposing() {
        service.currentInputConnection?.finishComposingText()
    }

    override fun setComposing(text: String) {
        service.currentInputConnection?.setComposingText(text, 1)
    }

    override fun commitText(text: String) {
        service.currentInputConnection?.commitText(text, 1)
        // #41 字数统计：引擎路径的上屏必经点（选词/直发/Hunpell 词）。
        // 面板重定向不走这里（TextInputCoordinator 的包装层先分流）。
        com.feelime.ime.InputStats.record(service, text)
    }

    override fun commitTextUntracked(text: String) {
        // 面板粘贴等外部长文本（issue #44）：粘贴不是「输入」。
        service.currentInputConnection?.commitText(text, 1)
    }

    override fun reopenComposing(start: Int, end: Int, word: String): Boolean {
        val connection = service.currentInputConnection ?: return false
        connection.beginBatchEdit()
        return try {
            if (!connection.setComposingRegion(start, end)) false
            else connection.setComposingText(word, 1).also { success ->
                if (!success) connection.finishComposingText()
            }
        } finally {
            connection.endBatchEdit()
        }
    }

    override fun selectedText(): String? =
        service.currentInputConnection?.getSelectedText(0)?.toString()

    /** No longer part of the backspace cascade - committed text
     * deletes via KEYCODE_DEL (see coordinator.deleteOneEditorUnit), because
     * deleteSurroundingText rewrites buffers xterm.js-style hosts never see.
     * Kept as an explicit fallback primitive. */
    override fun deleteSurroundingCodePoints(count: Int): Boolean {
        val connection = service.currentInputConnection ?: return false
        // API34+ 的 code-points 版要求宿主 IC 覆写——自定义 IC 常停在
        // default 实现（直接 false），验收实录（#85 上滑静默无效）。
        // 回退字符版：emoji 边界小概率劈半，换取功能可用。
        if (runCatching { connection.deleteSurroundingTextInCodePoints(count, 0) }
                .getOrDefault(false)) return true
        return connection.deleteSurroundingText(count, 0)
    }

    override fun textBeforeCursorWindow(limitUnits: Int): EditorPort.TextWindow? {
        val connection = service.currentInputConnection ?: return null
        // limit 按 UTF-16 单位截窗；计数按码点（删除走 InCodePoints /
        // DEL 键一次一个字素）。full=窗口满（协调器现只按码点数删，
        // 不读 full——保留字段备诊断；API 合约允许宿主限量返回，
        // 窗口形态不构成「删完/无效」的证据，codex 三轮 P1）。
        return runCatching {
            connection.getTextBeforeCursor(limitUnits, 0)?.let { raw ->
                val text = raw.toString()
                EditorPort.TextWindow(text.codePointCount(0, text.length), text.length == limitUnits)
            }
        }.getOrNull()
    }

    override fun sendDeleteKey() {
        val connection = service.currentInputConnection ?: return
        connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL))
        connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL))
    }

    override fun performEditorAction() {
        val info = service.currentInputEditorInfo
        val action = info?.imeOptions?.and(
            android.view.inputmethod.EditorInfo.IME_MASK_ACTION,
        ) ?: android.view.inputmethod.EditorInfo.IME_ACTION_NONE
        val multiline = info != null &&
            info.inputType.and(android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0
        // Multiline editors: Enter means newline unless the host explicitly
        // declared an action (SEND/GO/SEARCH...) WITHOUT IME_FLAG_NO_ENTER_ACTION —
        // that combination is deliberate and must still fire. The implicit
        // multi-line default (NEXT/DONE + NO_ENTER_ACTION, e.g. ColorOS
        // TextViews) would otherwise move focus instead of inserting "\n".
        val explicitAction = action != android.view.inputmethod.EditorInfo.IME_ACTION_NONE &&
            action != android.view.inputmethod.EditorInfo.IME_ACTION_UNSPECIFIED &&
            action != android.view.inputmethod.EditorInfo.IME_ACTION_DONE &&
            action != android.view.inputmethod.EditorInfo.IME_ACTION_NEXT
        val noEnterFlag = info != null &&
            info.imeOptions.and(android.view.inputmethod.EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0
        if (!multiline || (explicitAction && !noEnterFlag)) {
            if (action != android.view.inputmethod.EditorInfo.IME_ACTION_NONE &&
                action != android.view.inputmethod.EditorInfo.IME_ACTION_UNSPECIFIED
            ) {
                service.currentInputConnection?.performEditorAction(action)
            } else {
                performEnterFallback(action, multiline, info)
            }
        } else {
            performEnterFallback(action, multiline, info)
        }
    }

    private fun performEnterFallback(
        action: Int,
        multiline: Boolean,
        info: android.view.inputmethod.EditorInfo?,
    ) {
        if (com.feelime.ime.BuildConfig.DEBUG) {
            // A4 diagnostics: numbers/booleans only, never editor text.
            android.util.Log.d(
                "FeelimeEnter",
                "editorAction fallback: action=$action multiline=$multiline inputType=${info?.inputType} " +
                    "connectionNull=${service.currentInputConnection == null}",
            )
        }
        // Some host EditTexts ignore synthetic ENTER key events from an
        // IME; committing the newline is the InputConnection-native
        // operation and inserts it exactly once without dismissing the
        // keyboard.
        service.currentInputConnection?.commitText("\n", 1)
    }
}
