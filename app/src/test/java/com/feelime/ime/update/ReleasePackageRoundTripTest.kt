package com.feelime.ime.update

import java.io.ByteArrayInputStream
import java.io.File
import java.util.zip.ZipInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * End-to-end proof that scripts/package-keyboard.sh output (canonical JSON +
 * openssl Ed25519 + python zipfile) passes the production verifier and store.
 *
 * The fixture is committed at
 * app/src/test/resources/keyboard-update-signed.zip, packaged from the real
 * keyboard sources. It is signed by a THROWAWAY identity (private key kept
 * next to it as keyboard-update-roundtrip-test-ed25519.pem) so the offline
 * release key never has to exist on a build machine. Regenerate both with:
 * ```
 * FEELIME_SIGNING_KEY=app/src/test/resources/keyboard-update-roundtrip-test-ed25519.pem \
 *   FEELIME_KEY_ID=feelime-roundtrip-test \
 *   scripts/package-keyboard.sh app/src/test/resources/keyboard-update-signed.zip
 * ```
 */
class ReleasePackageRoundTripTest {
    @get:Rule
    val tmp = TemporaryFolder()

    /** Identity embedded in the fixture manifest; see scripts/package-keyboard.sh FEELIME_KEY_ID. */
    private val keyId = "feelime-roundtrip-test"
    private val publicKey: ByteArray = hex("8605082accfb77c8bd74a790c2925b7ac583e39e5aa1fb6c7e7126c0b1f145bf")

    private fun fixture(): ByteArray = javaClass.classLoader!!
        .getResourceAsStream("keyboard-update-signed.zip")!!
        .readBytes()

    /** The version the fixture was packaged from, read straight from its VERSION entry. */
    private fun fixtureVersion(): String {
        ZipInputStream(ByteArrayInputStream(fixture())).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: error("fixture has no VERSION entry")
                if (entry.name == "VERSION") return String(zip.readBytes()).trim()
            }
        }
    }

    @Test
    fun packagedZipVerifiesAgainstFixtureKey() {
        val verifier = KeyboardPackageVerifier(mapOf(keyId to publicKey))
        val result = verifier.verify(fixture())
        assertTrue("got $result", result is KeyboardPackageVerifier.Result.Ok)
        val pkg = (result as KeyboardPackageVerifier.Result.Ok).pkg
        assertTrue(pkg.signed)
        assertEquals(keyId, pkg.manifest.keyId)
        assertEquals(fixtureVersion(), pkg.manifest.keyboardVersion)
        assertEquals(5, pkg.files.size)
    }

    @Test
    fun packagedZipInstallsAndActivates() {
        val root = tmp.newFolder()
        val state = object : KeyboardStateStore {
            val map = HashMap<String, String>()
            override fun get(key: String): String? = map[key]
            override fun put(key: String, value: String) {
                map[key] = value
            }
        }
        val builtIn = object : BuiltInKeyboardSource {
            override fun version() = "0.0.1"
            override fun files() = mapOf(
                "index.html" to "old".toByteArray(),
                "keyboard.css" to "old".toByteArray(),
                "keyboard.js" to "old".toByteArray(),
                "keyboard.legacy.js" to "old".toByteArray(),
                "VERSION" to "0.0.1".toByteArray(),
            )
        }
        val store = KeyboardStore(
            root = root,
            builtIn = builtIn,
            verifier = KeyboardPackageVerifier(mapOf(keyId to publicKey)),
            state = state,
        )
        val install = store.install(fixture())
        assertTrue("got $install", install is KeyboardStore.InstallResult.Ok)
        val active = store.resolve()
        assertEquals(KeyboardSource.ACTIVE_VERSION, active.source)
        assertEquals(fixtureVersion(), active.version)
        assertTrue(active.signed)
        // The activated files are the packaged ones, not the built-in stubs.
        assertEquals(fixtureVersion(), File(active.dir, "VERSION").readText().trim())
        assertTrue(File(active.dir, "keyboard.js").length() > 1000)
        assertTrue(File(active.dir, KeyboardPackageVerifier.SIGNATURE_ENTRY).isFile)
    }

    private fun hex(text: String): ByteArray = text.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
