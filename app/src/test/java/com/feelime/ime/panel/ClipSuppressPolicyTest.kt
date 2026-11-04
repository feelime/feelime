package com.feelime.ime.panel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 抑制标记的纯决策核（mode-fallback §5）：清空/单删后快照系统剪贴板指纹，
 *  焦点补录被同指纹抑制，任何真实记录解除标记。 */
class ClipSuppressPolicyTest {
    @Test
    fun clearSnapshotsMarkerAndSuppressesFocusRecapture() {
        val changes = mutableListOf<String?>()
        val policy = ClipSuppressPolicy { changes.add(it) }
        assertNull(policy.marker)
        policy.snapshot("fp-A")
        assertEquals("fp-A", policy.marker)
        assertEquals(listOf("fp-A"), changes)
        assertTrue(policy.shouldSuppress("fp-A"))
        assertFalse(policy.shouldSuppress("fp-B"))
    }

    @Test
    fun anyRealRecordLiftsTheMarker() {
        val policy = ClipSuppressPolicy()
        policy.snapshot("fp-A")
        // 同文重录（真实复制事件）也解除抑制。
        policy.onRecorded()
        assertNull(policy.marker)
        assertFalse(policy.shouldSuppress("fp-A"))
    }

    @Test
    fun removeOnlySuppressesWhenRemovedTextIsTheCurrentClip() {
        val policy = ClipSuppressPolicy()
        // 删除的条目不是当前系统剪贴板 → 不设标记。
        policy.snapshot(null)
        assertNull(policy.marker)
        policy.snapshot("fp-removed")
        assertTrue(policy.shouldSuppress("fp-removed"))
    }

    @Test
    fun emptyAndNullFingerprintsNeverSuppress() {
        val policy = ClipSuppressPolicy()
        policy.snapshot("")
        assertFalse(policy.shouldSuppress(""))
        policy.snapshot(null)
        assertFalse(policy.shouldSuppress(""))
    }

    @Test
    fun restoreReloadsPersistedMarkerAfterProcessDeath() {
        val persisted = mutableListOf<String?>()
        val policy = ClipSuppressPolicy { persisted.add(it) }
        policy.snapshot("fp-A")
        assertEquals(listOf("fp-A"), persisted)
        val revived = ClipSuppressPolicy()
        revived.restore(persisted.last())
        assertTrue(revived.shouldSuppress("fp-A"))
    }
    @Test
    fun focusRecaptureSkipsUnchangedButRealCopyStillReorders() {
        val policy = ClipSuppressPolicy()
        assertFalse(policy.unchangedFocus("A", true))
        policy.onRecorded("A")
        assertTrue(policy.unchangedFocus("A", true))
        assertFalse(policy.unchangedFocus("A", false))
        assertFalse(policy.unchangedFocus("B", true))
        policy.snapshot("A")
        assertTrue(policy.shouldSuppress("A"))
        policy.onRecorded("B")
        assertNull(policy.marker)
        assertTrue(policy.unchangedFocus("B", true))
    }
    @Test
    fun clearWithoutUsableClipAllowsSameTextCopiedWhileHidden() {
        val policy = ClipSuppressPolicy()
        val history = mutableListOf<String>()
        fun capture(text: String, fromFocus: Boolean) {
            if (policy.shouldSuppress(text) || policy.unchangedFocus(text, fromFocus)) return
            history.add(text)
            policy.onRecorded(text)
        }
        capture("A", false)
        history.clear()
        // 空剪贴板与敏感剪贴板都不生成可持久化的删除指纹。
        policy.snapshot(null)
        // 隐藏期间复制 A：没有监听记录，重新显示才走焦点补采。
        capture("A", true)
        assertEquals(listOf("A"), history)
        capture("A", true)
        assertEquals(1, history.size)
    }

    @Test
    fun deletionInvalidatesFocusCacheWithoutLiftingSuppression() {
        val policy = ClipSuppressPolicy()
        policy.onRecorded("A")
        policy.snapshot("B")
        policy.invalidateCapture()
        assertFalse(policy.unchangedFocus("A", true))
        assertTrue(policy.shouldSuppress("B"))
        policy.snapshot("A")
        assertFalse(policy.unchangedFocus("A", true))
        assertTrue(policy.shouldSuppress("A"))
    }
}
