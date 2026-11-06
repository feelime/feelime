package com.feelime.ime.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeyboardPackageVerifierTest {
    private fun verifier(debug: Boolean = false) =
        KeyboardPackageVerifier(KeyboardPackageFixture.releaseKeys(), allowUnsignedDebug = debug)

    private fun rejected(zip: ByteArray, debug: Boolean = false): KeyboardUpdateErrorCode {
        val result = verifier(debug).verify(zip)
        assertTrue("expected rejection, got $result", result is KeyboardPackageVerifier.Result.Rejected)
        return (result as KeyboardPackageVerifier.Result.Rejected).code
    }

    private fun accepted(zip: ByteArray, debug: Boolean = false): VerifiedKeyboardPackage {
        val result = verifier(debug).verify(zip)
        assertTrue("expected acceptance, got $result", result is KeyboardPackageVerifier.Result.Ok)
        return (result as KeyboardPackageVerifier.Result.Ok).pkg
    }

    @Test
    fun acceptsValidSignedPackage() {
        val zip = KeyboardPackageFixture.build()
        val pkg = accepted(zip)
        assertTrue(pkg.signed)
        assertEquals("2.0.1", pkg.manifest.keyboardVersion)
        assertEquals(listOf("candidate-revision-v1", "text-input-v1"), pkg.manifest.requiredCapabilities)
        assertEquals(
            KeyboardPackageVerifier.sha256Hex(pkg.manifest.rawBytes),
            pkg.manifest.contentHash,
        )
        assertEquals(
            KeyboardPackageFixture.payloadFiles()["keyboard.js"]!!.decodeToString(),
            pkg.files.getValue("keyboard.js").decodeToString(),
        )
        assertFalse(pkg.files.containsKey(KeyboardPackageVerifier.MANIFEST_ENTRY))
    }

    @Test
    fun envelopeMissingDuplicateRenamedOversizedManifestListsEnvelopeUnknownKeyBadSignature() {
        val fixture = KeyboardPackageFixture.build()

        // Missing signature in production mode.
        assertEquals(
            KeyboardUpdateErrorCode.SIGNATURE_MISSING,
            rejected(KeyboardPackageFixture.build(signed = false)),
        )
        // Missing manifest.
        assertEquals(
            KeyboardUpdateErrorCode.ENVELOPE_MISSING,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, ByteArray(64))
                    .also { b -> KeyboardPackageFixture.payloadFiles().forEach { (n, d) -> b.add(n, d) } }
                    .build(),
            ),
        )
        // Duplicate manifest entries.
        assertEquals(
            KeyboardUpdateErrorCode.DUPLICATE_ENTRY,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, "{}".toByteArray())
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, "{}".toByteArray())
                    .build(),
            ),
        )
        // Renamed envelope entry.
        assertEquals(
            KeyboardUpdateErrorCode.UNKNOWN_ENTRY,
            rejected(
                TestZipBuilder()
                    .add("feelime-keyboard.sig2", ByteArray(64))
                    .build(),
            ),
        )
        // Oversized manifest.
        assertEquals(
            KeyboardUpdateErrorCode.INFLATED_TOO_LARGE,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, ByteArray(70 * 1024) { 'a'.code.toByte() })
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, ByteArray(64))
                    .also { b -> KeyboardPackageFixture.payloadFiles().forEach { (n, d) -> b.add(n, d) } }
                    .build(),
            ),
        )
        // Manifest payload allowlist includes an envelope entry.
        val files = KeyboardPackageFixture.payloadFiles()
        val withEnvelope = KeyboardPackageFixture.manifest(
            files + (KeyboardPackageVerifier.MANIFEST_ENTRY to ByteArray(2)),
            payloadNames = files.keys.toList() + KeyboardPackageVerifier.MANIFEST_ENTRY,
        )
        assertEquals(
            KeyboardUpdateErrorCode.MANIFEST_LISTS_ENVELOPE,
            rejected(KeyboardPackageFixture.build(manifestBytes = withEnvelope)),
        )
        // Unknown manifest key.
        val manifestText = KeyboardPackageFixture.manifest(files).decodeToString()
        val withUnknownKey = ("{\"evil\":1," + manifestText.drop(1)).toByteArray()
        assertEquals(
            KeyboardUpdateErrorCode.MANIFEST_UNKNOWN_KEY,
            rejected(KeyboardPackageFixture.build(manifestBytes = withUnknownKey)),
        )
        // Bad signature.
        val badSignature = TestEd25519Signer.sign(KeyboardPackageFixture.SEED, ByteArray(3))
        assertEquals(
            KeyboardUpdateErrorCode.SIGNATURE_BAD,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, KeyboardPackageFixture.manifest(files))
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, badSignature)
                    .also { b -> files.forEach { (n, d) -> b.add(n, d) } }
                    .build(),
            ),
        )
        // Unknown key id.
        assertEquals(
            KeyboardUpdateErrorCode.KEY_UNKNOWN,
            rejected(KeyboardPackageFixture.build(keyId = "attacker-key")),
        )
        // Silence unused warning for fixture.
        assertTrue(fixture.size > 0)
    }

    @Test
    fun payloadHashLengthAllowlistDuplicateSymlinkTraversalNulUnicodeCaseNfcLimits() {
        val files = KeyboardPackageFixture.payloadFiles()
        val manifest = KeyboardPackageFixture.manifest(files)

        // Wrong payload hash in manifest (signature valid over the tampered manifest).
        val cssHash = KeyboardPackageVerifier.sha256Hex(files.getValue("keyboard.css"))
        val tamperedHash = KeyboardPackageFixture.manifest(files).decodeToString()
            .replaceFirst("\"$cssHash\"", "\"" + "0".repeat(64) + "\"")
            .toByteArray()
        assertEquals(
            KeyboardUpdateErrorCode.PAYLOAD_HASH,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, tamperedHash)
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, TestEd25519Signer.sign(KeyboardPackageFixture.SEED, tamperedHash))
                    .also { b -> files.forEach { (n, d) -> b.add(n, d) } }
                    .build(),
            ),
        )
        // Declared length lies about the real entry size.
        assertEquals(
            KeyboardUpdateErrorCode.PAYLOAD_LENGTH,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, manifest)
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, TestEd25519Signer.sign(KeyboardPackageFixture.SEED, manifest))
                    .add("index.html", files.getValue("index.html"), declaredUncompressed = 3)
                    .also { b -> files.keys.filter { it != "index.html" }.forEach { n -> b.add(n, files.getValue(n)) } }
                    .build(),
            ),
        )
        // Manifest allowlist omits one payload.
        val partial = files - "keyboard.js"
        assertEquals(
            KeyboardUpdateErrorCode.MANIFEST_PAYLOAD_ALLOWLIST,
            rejected(
                KeyboardPackageFixture.build(files = files, manifestBytes = KeyboardPackageFixture.manifest(partial, payloadNames = partial.keys.toList())),
            ),
        )
        // Duplicate payload entry.
        assertEquals(
            KeyboardUpdateErrorCode.DUPLICATE_ENTRY,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, manifest)
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, TestEd25519Signer.sign(KeyboardPackageFixture.SEED, manifest))
                    .also { b -> files.forEach { (n, d) -> b.add(n, d) } }
                    .add("VERSION", files.getValue("VERSION"))
                    .build(),
            ),
        )
        // Symlink entry.
        assertEquals(
            KeyboardUpdateErrorCode.SYMLINK_OR_SPECIAL,
            rejected(
                TestZipBuilder()
                    .add("link", ByteArray(0), unixMode = 0xA1FF)
                    .build(),
            ),
        )
        // Traversal entry.
        assertEquals(
            KeyboardUpdateErrorCode.PATH_TRAVERSAL,
            rejected(
                TestZipBuilder()
                    .add("../index.html", ByteArray(0))
                    .build(),
            ),
        )
        // NUL in entry name.
        assertEquals(
            KeyboardUpdateErrorCode.PATH_NUL,
            rejected(
                TestZipBuilder()
                    .addRawName(
                        "index.html".toByteArray() + byteArrayOf(0) + "x".toByteArray(),
                        ByteArray(0),
                    )
                    .build(),
            ),
        )
        // Unicode case-fold conflict (fullwidth VERSION after real VERSION).
        assertEquals(
            KeyboardUpdateErrorCode.UNICODE_CONFLICT,
            rejected(
                TestZipBuilder()
                    .add("VERSION", files.getValue("VERSION"))
                    .add("\uff36\uff25\uff32\uff33\uff29\uff2f\uff2e", ByteArray(1))
                    .build(),
            ),
        )
        // Fullwidth lookalike ordered before the real entry still rejects.
        assertEquals(
            KeyboardUpdateErrorCode.UNKNOWN_ENTRY,
            rejected(
                TestZipBuilder()
                    .add("\uff36\uff25\uff32\uff33\uff29\uff2f\uff2e", ByteArray(1))
                    .add("VERSION", files.getValue("VERSION"))
                    .build(),
            ),
        )
        // NFC-conflicting pair (precomposed vs decomposed a-acute) rejects.
        assertEquals(
            KeyboardUpdateErrorCode.UNKNOWN_ENTRY,
            rejected(
                TestZipBuilder()
                    .add("keybo\u00e1rd.js", ByteArray(1))
                    .add("keybo\u0061\u0301rd.js", ByteArray(1))
                    .build(),
            ),
        )
        // Entry count limit.
        val tooMany = TestZipBuilder()
        repeat(129) { index -> tooMany.add("x$index", ByteArray(0)) }
        assertEquals(KeyboardUpdateErrorCode.ENTRY_LIMIT, rejected(tooMany.build()))
        // Inflated total limit (actual 12 MiB of zeros in one payload).
        assertEquals(
            KeyboardUpdateErrorCode.INFLATED_TOO_LARGE,
            rejected(
                TestZipBuilder()
                    .add(KeyboardPackageVerifier.MANIFEST_ENTRY, manifest)
                    .add(KeyboardPackageVerifier.SIGNATURE_ENTRY, TestEd25519Signer.sign(KeyboardPackageFixture.SEED, manifest))
                    .add("index.html", ByteArray(12 * 1024 * 1024), declaredUncompressed = 12L * 1024 * 1024)
                    .also { b -> files.keys.filter { it != "index.html" }.forEach { n -> b.add(n, files.getValue(n)) } }
                    .build(),
            ),
        )
        // Raw ZIP size limit.
        val oversized = KeyboardPackageVerifier(
            KeyboardPackageFixture.releaseKeys(),
            maxZipBytes = 1024,
        ).verify(KeyboardPackageFixture.build())
        assertTrue(oversized is KeyboardPackageVerifier.Result.Rejected)
        assertEquals(
            KeyboardUpdateErrorCode.ZIP_TOO_LARGE,
            (oversized as KeyboardPackageVerifier.Result.Rejected).code,
        )
    }

    @Test
    fun rejectsVersionMismatchAndNonCanonicalManifestAndBadMethod() {
        val files = KeyboardPackageFixture.payloadFiles()
        // VERSION file disagrees with manifest.
        assertEquals(
            KeyboardUpdateErrorCode.VERSION_MISMATCH,
            rejected(KeyboardPackageFixture.build(files = files + ("VERSION" to "9.9.9".toByteArray()))),
        )
        // Non-canonical JSON (extra whitespace) fails the round-trip check.
        val manifest = KeyboardPackageFixture.manifest(files).decodeToString()
        val spaced = ("{ " + manifest.drop(1)).toByteArray()
        assertEquals(
            KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON,
            rejected(
                KeyboardPackageFixture.build(
                    files = files,
                    manifestBytes = spaced,
                    signed = true,
                ),
            ),
        )
        // Unsupported compression method.
        assertEquals(
            KeyboardUpdateErrorCode.NOT_ZIP,
            rejected(
                TestZipBuilder()
                    .add("index.html", ByteArray(0), method = 12)
                    .build(),
            ),
        )
    }

    @Test
    fun debugAllowsUnsignedPackageButProductionDoesNot() {
        val zip = KeyboardPackageFixture.build(signed = false)
        val pkg = accepted(zip, debug = true)
        assertFalse(pkg.signed)
        assertEquals(KeyboardUpdateErrorCode.SIGNATURE_MISSING, rejected(zip))
    }
}
