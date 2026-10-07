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
    fun sendDeleteKey()
    fun performEditorAction()
}
