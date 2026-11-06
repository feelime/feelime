package com.feelime.ime.update

/** Builds valid and deliberately broken keyboard update ZIPs for tests. */
object KeyboardPackageFixture {
    val SEED = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
    const val KEY_ID = "test-release-1"

    fun releaseKeys(): Map<String, ByteArray> = mapOf(KEY_ID to TestEd25519Signer.publicKey(SEED))

    fun payloadFiles(version: String = "2.0.1"): Map<String, ByteArray> = mapOf(
        "index.html" to "<!doctype html><html>Feelime ${version.hashCode()}</html>".toByteArray(),
        "keyboard.css" to "body{background:#0f0f18}".toByteArray(),
        "keyboard.js" to "const KEYBOARD_VERSION='${version}';".toByteArray(),
        "keyboard.legacy.js" to "window.__feelimeES=1;/*${version}*/".toByteArray(),
        "VERSION" to version.toByteArray(),
    )

    fun manifest(
        files: Map<String, ByteArray>,
        version: String = "2.0.1",
        minNativeApi: Long = 1,
        caps: List<String> = listOf("candidate-revision-v1", "text-input-v1"),
        keyId: String = KEY_ID,
        payloadNames: List<String> = files.keys.toList(),
    ): ByteArray {
        val payload = CanonicalJson.Value.Obj(
            payloadNames.sorted().map { name ->
                val bytes = files.getValue(name)
                name to CanonicalJson.Value.Obj(
                    listOf(
                        "bytes" to CanonicalJson.Value.Num(bytes.size.toLong()),
                        "sha256" to CanonicalJson.Value.Str(KeyboardPackageVerifier.sha256Hex(bytes)),
                    ),
                )
            },
        )
        return CanonicalJson.serialize(
            CanonicalJson.Value.Obj(
                listOf(
                    "formatVersion" to CanonicalJson.Value.Num(1),
                    "keyboardVersion" to CanonicalJson.Value.Str(version),
                    "keyId" to CanonicalJson.Value.Str(keyId),
                    "minNativeApi" to CanonicalJson.Value.Num(minNativeApi),
                    "requiredCapabilities" to CanonicalJson.Value.Arr(caps.map { CanonicalJson.Value.Str(it) }),
                    "payload" to payload,
                ),
            ),
        )
    }

    fun build(
        version: String = "2.0.1",
        minNativeApi: Long = 1,
        caps: List<String> = listOf("candidate-revision-v1", "text-input-v1"),
        keyId: String = KEY_ID,
        signed: Boolean = true,
        files: Map<String, ByteArray> = payloadFiles(version),
        manifestBytes: ByteArray? = null,
        extraEntries: List<TestZipBuilder.Entry> = emptyList(),
        skipSignatureEntry: Boolean = false,
    ): ByteArray {
        val manifest = manifestBytes ?: manifest(files, version, minNativeApi, caps, keyId)
        val builder = TestZipBuilder()
            .add(KeyboardPackageVerifier.MANIFEST_ENTRY, manifest)
        if (signed && !skipSignatureEntry) {
            builder.add(KeyboardPackageVerifier.SIGNATURE_ENTRY, TestEd25519Signer.sign(SEED, manifest))
        }
        // 与 manifest 同源（files.keys）：payload 清单演进时 fixture 不再漏文件
        for (name in files.keys) {
            builder.add(name, files.getValue(name))
        }
        extraEntries.forEach(builder::addRaw)
        return builder.build()
    }

    fun hex(text: String): ByteArray = text.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
