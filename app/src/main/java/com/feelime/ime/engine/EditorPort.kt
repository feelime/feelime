package com.feelime.ime.engine

/** Editor operations the coordinator needs, so the deletion and commit
 * cascade is unit-testable without Android. */
interface EditorPort {
    fun finishComposing()
    fun setComposing(text: String)
    fun commitText(text: String)
    /** Commit without feeding #41 stats - external text the user did not
     * type (panel paste, issue #44). Default tracks like commitText. */
    fun commitTextUntracked(text: String) = commitText(text)
    /** Re-mark exactly the most recent owned commit as editable text. */
    fun reopenComposing(start: Int, end: Int, word: String): Boolean = false
    fun selectedText(): String?
    /** Returns false when the editor cannot delete by code points. */
    fun deleteSurroundingCodePoints(count: Int): Boolean
    /** #85 光标前文本窗口：码点数 + 窗口（UTF-16 单位）是否截断 +
     *  窗口原文（下滑恢复的快照素材）。null = 宿主不回 IC 文本查询。 */
    data class TextWindow(val codePoints: Int, val full: Boolean, val text: String)

    fun textBeforeCursorWindow(limitUnits: Int): TextWindow? = null

    /** #85 光标后尾部窗口：删除完成时留档、恢复前核对——右侧变更
     *  （宿主删右侧文本）常无选区回调可听，靠尾部比对暴露（codex
     *  复审 P1）。null = 宿主不回该查询。 */
    fun textAfterCursorWindow(limitUnits: Int): TextWindow? = null

    /** #85 按窗口语义删除：码点 API 优先；窗口起点对齐码点边界时
     *  才允许字符版回退（UTF-16 单位数恰为窗口文本长度=实际删除
     *  范围）。窗口起点劈开代理对时代理对被真实删除跨过，单位数
     *  ≠ 实际跨度，字符版会留下孤高代理项——此时只认码点 API，
     *  拒绝即返回 false（调用方回落 DEL 键，键事件按字素删不劈半）。 */
    fun deleteSurrounding(window: TextWindow): Boolean = deleteSurroundingCodePoints(window.codePoints)

    /** #85 恢复回落：Ctrl+Z 键事件（宿主自己的 undo，语义不可控——
     *  部分宿主恢复后选中内容，仅作无快照时的兜底）。 */
    fun sendCtrlZ() {}
    fun sendDeleteKey()
    fun performEditorAction()
}
