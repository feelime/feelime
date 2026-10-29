package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AsrModelSnapshotTest {
    private fun manifest(version: String = "1", digest: String = "a".repeat(64)) = ModelManifest(
        AsrModelSnapshot.ROLES.map { role ->
            ModelSpec(role, role, role, version,
                listOf(ModelFileSpec("$role/model.onnx", digest, 100)), sources = emptyMap(), urls = emptyList())
        },
    )

    @Test
    fun unchangedChoiceReusesTheWholeChain() {
        val first = AsrModelSnapshot.capture(ModelBackend.AUTO, manifest()) { ModelSource.Assets }
        val next = AsrModelSnapshot.capture(ModelBackend.AUTO, manifest()) { ModelSource.Assets }
        assertEquals(first, next)
    }

    @Test
    fun backendSwitchInvalidatesEvenWhenBothResolveToTheSameDownloadedDirectory() {
        val source = ModelSource.Directory("models")
        val automatic = AsrModelSnapshot.capture(ModelBackend.AUTO, manifest()) { source }
        val remote = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest()) { source }
        assertNotEquals(automatic, remote)
    }

    @Test
    fun optionalModelDownloadedAfterFirstRecordingInvalidatesChain() {
        val before = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest()) {
            if (it == "asr-streaming") ModelSource.Directory("models") else null
        }
        val after = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest()) { ModelSource.Directory("models") }
        assertNull(before.sourceFor("asr-final"))
        assertNotEquals(before, after)
    }

    @Test
    fun samePathAndByteSizeWithNewVersionOrHashRequiresReload() {
        val source = ModelSource.Directory("models")
        val first = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest()) { source }
        val version = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest(version = "2")) { source }
        val content = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest(digest = "b".repeat(64))) { source }
        assertNotEquals(first, version)
        assertNotEquals(first, content)
    }

    @Test
    fun snapshotKeepsLoadedSourceWhenSettingsLaterChange() {
        var source: ModelSource? = ModelSource.Assets
        val first = AsrModelSnapshot.capture(ModelBackend.AUTO, manifest()) { source }
        source = ModelSource.Directory("models")
        val next = AsrModelSnapshot.capture(ModelBackend.REMOTE, manifest()) { source }
        assertEquals(ModelSource.Assets, first.sourceFor("asr-streaming"))
        assertEquals(source, next.sourceFor("asr-streaming"))
        assertNotEquals(first, next)
    }
}
