package com.feelime.ime.update

import java.io.ByteArrayInputStream
import java.text.Normalizer
import java.util.Locale
import java.util.zip.ZipInputStream

/** Persisted + surfaced error codes for the update state machine. */
enum class KeyboardUpdateErrorCode {
    URL_NOT_HTTPS,
    URL_USER_INFO,
    REDIRECT_LIMIT,
    REDIRECT_NOT_HTTPS,
    TLS_ERROR,
    TIMEOUT,
    NETWORK_ERROR,
    DOWNLOAD_TOO_LARGE,
    NOT_ZIP,
    ENTRY_LIMIT,
    ZIP_TOO_LARGE,
    DUPLICATE_ENTRY,
    PATH_TRAVERSAL,
    PATH_ABSOLUTE,
    PATH_BACKSLASH,
    PATH_NUL,
    SYMLINK_OR_SPECIAL,
    UNICODE_CONFLICT,
    UNKNOWN_ENTRY,
    ENVELOPE_MISSING,
    MANIFEST_INVALID_JSON,
    MANIFEST_UNKNOWN_KEY,
    MANIFEST_MISSING_KEY,
    MANIFEST_LISTS_ENVELOPE,
    MANIFEST_PAYLOAD_ALLOWLIST,
    SIGNATURE_BAD,
    SIGNATURE_MISSING,
    KEY_UNKNOWN,
    PAYLOAD_HASH,
    PAYLOAD_LENGTH,
    INFLATED_TOO_LARGE,
    VERSION_MISMATCH,
    FRAGMENT_PIN_MISMATCH,
    COMPAT_MIN_NATIVE_API,
    COMPAT_CAPABILITIES,
    IO_ERROR,
}

data class KeyboardManifest(
    val formatVersion: Long,
    val keyboardVersion: String,
    val minNativeApi: Long,
    val maxTestedNativeApi: Long?,
    val requiredCapabilities: List<String>,
    val keyId: String,
    /** Payload name -> (sha256 hex lowercase, byte length). */
    val payload: Map<String, Pair<String, Long>>,
    val rawBytes: ByteArray,
    val contentHash: String,
) {
    override fun equals(other: Any?): Boolean = other is KeyboardManifest && contentHash == other.contentHash
    override fun hashCode(): Int = contentHash.hashCode()
}

/** A ZIP that passed every §8.1/§8.2 check; contents held in memory (≤ 10 MiB). */
class VerifiedKeyboardPackage(
    val manifest: KeyboardManifest,
    val signed: Boolean,
    val files: Map<String, ByteArray>,
    val zipSha256: String,
)

class KeyboardPackageVerifier(
    private val releaseKeys: Map<String, ByteArray>,
    private val allowUnsignedDebug: Boolean = false,
    private val maxEntries: Int = 128,
    private val maxZipBytes: Long = MAX_ZIP_BYTES,
    private val maxInflatedBytes: Long = 10L * 1024 * 1024,
    private val maxManifestBytes: Long = 64L * 1024,
) {
    sealed class Result {
        class Rejected(val code: KeyboardUpdateErrorCode, val detail: String) : Result()
        class Ok(val pkg: VerifiedKeyboardPackage) : Result()
    }

    /** [acceptBadSignature]（docs/design/userdata.md §3）：只放行
     * SIGNATURE_BAD（长度不对/验签失败）这一类，签名缺失仍拒绝；放行时
     * signed=false 且签名字节原样保留，由 KeyboardStore 落盘
     * `.signature-confirmed` 标记。 */
    fun verify(zip: ByteArray, acceptBadSignature: Boolean = false): Result {
        if (zip.size > maxZipBytes) return rejected(KeyboardUpdateErrorCode.ZIP_TOO_LARGE, "${zip.size} bytes")
        val index = parseCentralDirectory(zip) ?: return rejected(KeyboardUpdateErrorCode.NOT_ZIP, "no central directory")

        // §8.2: structural checks before reading any content.
        if (index.size > maxEntries) {
            return rejected(KeyboardUpdateErrorCode.ENTRY_LIMIT, "${index.size} entries")
        }
        val seen = HashMap<String, CentralEntry>()
        val nfcSeen = HashMap<String, String>()
        val foldSeen = HashMap<String, String>()
        for (entry in index) {
            val name = entry.name
            if (entry.nameBytes.any { it == 0.toByte() }) {
                return rejected(KeyboardUpdateErrorCode.PATH_NUL, name)
            }
            if ('\\' in name) return rejected(KeyboardUpdateErrorCode.PATH_BACKSLASH, name)
            if (name.startsWith("/")) return rejected(KeyboardUpdateErrorCode.PATH_ABSOLUTE, name)
            if (name.split('/').any { it == "." || it == ".." }) {
                return rejected(KeyboardUpdateErrorCode.PATH_TRAVERSAL, name)
            }
            if (seen.put(name, entry) != null) {
                return rejected(KeyboardUpdateErrorCode.DUPLICATE_ENTRY, name)
            }
            val nfc = Normalizer.normalize(name, Normalizer.Form.NFC)
            if (nfcSeen.put(nfc, name) != null) {
                return rejected(KeyboardUpdateErrorCode.UNICODE_CONFLICT, name)
            }
            val folded = Normalizer.normalize(nfc, Normalizer.Form.NFKC).lowercase(Locale.ROOT)
            if (foldSeen.put(folded, name) != null) {
                return rejected(KeyboardUpdateErrorCode.UNICODE_CONFLICT, name)
            }
            val fileType = entry.unixMode and 0xF000
            if (fileType != 0x8000 && fileType != 0x0000) {
                return rejected(KeyboardUpdateErrorCode.SYMLINK_OR_SPECIAL, "$name mode=${entry.unixMode.toString(16)}")
            }
            if (entry.method != 0 && entry.method != 8) {
                return rejected(KeyboardUpdateErrorCode.NOT_ZIP, "$name method=${entry.method}")
            }
            if (!ALLOWED_ENTRIES.contains(name)) {
                return rejected(KeyboardUpdateErrorCode.UNKNOWN_ENTRY, name)
            }
        }
        for (required in ENVELOPE_ENTRIES) {
            if (required != SIGNATURE_ENTRY && seen[required] == null) {
                return rejected(KeyboardUpdateErrorCode.ENVELOPE_MISSING, required)
            }
        }
        for (required in PAYLOAD_ENTRIES) {
            if (seen[required] == null) {
                return rejected(KeyboardUpdateErrorCode.ENVELOPE_MISSING, required)
            }
        }
        if (!allowUnsignedDebug && seen[SIGNATURE_ENTRY] == null) {
            return rejected(KeyboardUpdateErrorCode.SIGNATURE_MISSING, SIGNATURE_ENTRY)
        }

        // §8.2: bounded inflate; never trust header sizes for limits.
        val contents = HashMap<String, ByteArray>()
        var inflatedTotal = 0L
        val stream = ZipInputStream(ByteArrayInputStream(zip))
        try {
            while (true) {
                val entry = stream.nextEntry ?: break
                val declared = seen[entry.name] ?: return rejected(KeyboardUpdateErrorCode.UNKNOWN_ENTRY, entry.name)
                val cap = if (entry.name == MANIFEST_ENTRY) maxManifestBytes else maxInflatedBytes
                val buffer = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(8192)
                var size = 0L
                while (true) {
                    val read = stream.read(chunk)
                    if (read < 0) break
                    size += read
                    inflatedTotal += read
                    if (size > cap || inflatedTotal > maxInflatedBytes) {
                        return rejected(KeyboardUpdateErrorCode.INFLATED_TOO_LARGE, entry.name)
                    }
                    buffer.write(chunk, 0, read)
                }
                if (size != declared.uncompressedSize) {
                    return rejected(KeyboardUpdateErrorCode.PAYLOAD_LENGTH, "${entry.name} header ${declared.uncompressedSize} actual $size")
                }
                contents[entry.name] = buffer.toByteArray()
            }
        } catch (exception: java.util.zip.ZipException) {
            // The JDK validates declared sizes while streaming; a lie lands here.
            return rejected(KeyboardUpdateErrorCode.PAYLOAD_LENGTH, exception.message ?: "zip stream")
        }

        val manifestBytes = contents[MANIFEST_ENTRY]
            ?: return rejected(KeyboardUpdateErrorCode.ENVELOPE_MISSING, MANIFEST_ENTRY)
        if (manifestBytes.size >= 3 && manifestBytes[0] == 0xEF.toByte() &&
            manifestBytes[1] == 0xBB.toByte() && manifestBytes[2] == 0xBF.toByte()
        ) {
            return rejected(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "BOM")
        }
        val manifest = when (val parsed = parseManifest(manifestBytes)) {
            is ManifestParse.Err -> return rejected(parsed.code, parsed.detail)
            is ManifestParse.Ok -> parsed.manifest
        }

        val signature = contents[SIGNATURE_ENTRY]
        var signed = false
        if (signature != null) {
            // KEY_UNKNOWN 在确认通道之外：陌生密钥一律拒绝，与 SIGNATURE_BAD
            // （可确认导入）区分开。
            val key = releaseKeys[manifest.keyId]
                ?: return rejected(KeyboardUpdateErrorCode.KEY_UNKNOWN, manifest.keyId)
            val signatureValid = signature.size == 64 && Ed25519.verify(key, manifestBytes, signature)
            if (signatureValid) {
                signed = true
            } else if (!acceptBadSignature) {
                return if (signature.size != 64) {
                    rejected(KeyboardUpdateErrorCode.SIGNATURE_BAD, "signature ${signature.size} bytes")
                } else {
                    rejected(KeyboardUpdateErrorCode.SIGNATURE_BAD, manifest.keyId)
                }
            }
        } else {
            if (allowUnsignedDebug) {
                signed = false
            } else {
                return rejected(KeyboardUpdateErrorCode.SIGNATURE_MISSING, SIGNATURE_ENTRY)
            }
        }

        for ((name, bytes) in contents) {
            if (name == MANIFEST_ENTRY || name == SIGNATURE_ENTRY) continue
            val allowed = manifest.payload[name]
                ?: return rejected(KeyboardUpdateErrorCode.MANIFEST_PAYLOAD_ALLOWLIST, name)
            if (bytes.size.toLong() != allowed.second) {
                return rejected(KeyboardUpdateErrorCode.PAYLOAD_LENGTH, name)
            }
            if (sha256Hex(bytes) != allowed.first) {
                return rejected(KeyboardUpdateErrorCode.PAYLOAD_HASH, name)
            }
        }
        val versionFile = String(contents["VERSION"] ?: return rejected(KeyboardUpdateErrorCode.ENVELOPE_MISSING, "VERSION"), Charsets.UTF_8)
        if (versionFile.trim() != manifest.keyboardVersion || versionFile.trim().isEmpty()) {
            return rejected(KeyboardUpdateErrorCode.VERSION_MISMATCH, versionFile.trim())
        }

        return Result.Ok(
            VerifiedKeyboardPackage(
                manifest = manifest,
                signed = signed,
                files = contents.filterKeys { it != MANIFEST_ENTRY && it != SIGNATURE_ENTRY },
                zipSha256 = sha256Hex(zip),
            ),
        )
    }

    private fun rejected(code: KeyboardUpdateErrorCode, detail: String): Result =
        Result.Rejected(code, detail)

    /** Startup re-verification path (design §8.3): manifest + stored signature. */
    fun verifyStoredSignature(manifestBytes: ByteArray, keyId: String, signature: ByteArray): Boolean {
        if (signature.size != 64) return false
        val key = releaseKeys[keyId] ?: return false
        return Ed25519.verify(key, manifestBytes, signature)
    }

    private sealed class ManifestParse {
        class Ok(val manifest: KeyboardManifest) : ManifestParse()
        class Err(val code: KeyboardUpdateErrorCode, val detail: String) : ManifestParse()
    }

    private fun err(code: KeyboardUpdateErrorCode, detail: String) = ManifestParse.Err(code, detail)

    private fun parseManifest(bytes: ByteArray): ManifestParse {
        val root = try {
            CanonicalJson.parseAndCheck(bytes)
        } catch (exception: CanonicalJson.FormatException) {
            return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, exception.message ?: "canonical JSON")
        }
        if (root !is CanonicalJson.Value.Obj) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "root not object")
        val known = setOf(
            "formatVersion", "keyboardVersion", "minNativeApi", "maxTestedNativeApi",
            "requiredCapabilities", "keyId", "payload",
        )
        for (key in root.keys) {
            if (key !in known) return err(KeyboardUpdateErrorCode.MANIFEST_UNKNOWN_KEY, key)
        }
        for (required in listOf("formatVersion", "keyboardVersion", "minNativeApi", "requiredCapabilities", "keyId", "payload")) {
            if (root[required] == null) return err(KeyboardUpdateErrorCode.MANIFEST_MISSING_KEY, required)
        }
        val formatVersion = (root["formatVersion"] as? CanonicalJson.Value.Num)?.value
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "formatVersion")
        if (formatVersion != 1L) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "formatVersion=$formatVersion")
        val keyboardVersion = (root["keyboardVersion"] as? CanonicalJson.Value.Str)?.value
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "keyboardVersion")
        if (!SEMVER.matches(keyboardVersion)) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "keyboardVersion=$keyboardVersion")
        val minNativeApi = (root["minNativeApi"] as? CanonicalJson.Value.Num)?.value
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "minNativeApi")
        if (minNativeApi < 1) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "minNativeApi=$minNativeApi")
        val maxTested = (root["maxTestedNativeApi"] as? CanonicalJson.Value.Num)?.value
        val capsArray = root["requiredCapabilities"] as? CanonicalJson.Value.Arr
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "requiredCapabilities")
        val caps = mutableListOf<String>()
        for (item in capsArray.items) {
            val cap = (item as? CanonicalJson.Value.Str)?.value
                ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "capability")
            caps.add(cap)
        }
        if (caps.isEmpty()) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "empty capabilities")
        if (caps.zipWithNext().any { it.first >= it.second }) {
            return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "capabilities not sorted+unique")
        }
        if (caps.any { it.isEmpty() }) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "empty capability")
        val keyId = (root["keyId"] as? CanonicalJson.Value.Str)?.value
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "keyId")
        if (keyId.isEmpty() || keyId.length > 64) return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "keyId")
        val payloadObj = root["payload"] as? CanonicalJson.Value.Obj
            ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload")
        if (payloadObj.keys.sorted() != PAYLOAD_ENTRIES.sorted()) {
            if (payloadObj.keys.any { ENVELOPE_ENTRIES.contains(it) }) {
                return err(KeyboardUpdateErrorCode.MANIFEST_LISTS_ENVELOPE, payloadObj.keys.joinToString())
            }
            return err(KeyboardUpdateErrorCode.MANIFEST_PAYLOAD_ALLOWLIST, payloadObj.keys.sorted().joinToString())
        }
        val payload = HashMap<String, Pair<String, Long>>()
        for ((name, value) in payloadObj.entries) {
            val meta = value as? CanonicalJson.Value.Obj
                ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name")
            if (meta.keys.sorted() != listOf("bytes", "sha256")) {
                return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name keys")
            }
            val hash = (meta["sha256"] as? CanonicalJson.Value.Str)?.value
                ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name.sha256")
            val length = (meta["bytes"] as? CanonicalJson.Value.Num)?.value
                ?: return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name.bytes")
            if (!hash.matches(Regex("^[0-9a-f]{64}$"))) {
                return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name.sha256")
            }
            if (length < 0 || length > maxInflatedBytes) {
                return err(KeyboardUpdateErrorCode.MANIFEST_INVALID_JSON, "payload.$name.bytes=$length")
            }
            payload[name] = hash to length
        }
        return ManifestParse.Ok(KeyboardManifest(
            formatVersion = formatVersion,
            keyboardVersion = keyboardVersion,
            minNativeApi = minNativeApi,
            maxTestedNativeApi = maxTested,
            requiredCapabilities = caps,
            keyId = keyId,
            payload = payload,
            rawBytes = bytes,
            contentHash = sha256Hex(bytes),
        ))
    }

    private class CentralEntry(
        val name: String,
        val nameBytes: ByteArray,
        val method: Int,
        val uncompressedSize: Long,
        val unixMode: Int,
    )

    /**
     * Minimal central-directory reader: the entry table must be inspected
     * (count, names, unix modes) before any content is inflated.
     */
    private fun parseCentralDirectory(zip: ByteArray): List<CentralEntry>? {
        var eocd = -1
        val scanStart = maxOf(0, zip.size - 66000)
        for (index in zip.size - 22 downTo scanStart) {
            if (zip[index] == 0x50.toByte() && zip[index + 1] == 0x4b.toByte() &&
                zip[index + 2] == 0x05.toByte() && zip[index + 3] == 0x06.toByte()
            ) {
                eocd = index
                break
            }
        }
        if (eocd < 0) return null
        fun u16(offset: Int) = (zip[offset].toInt() and 0xff) or ((zip[offset + 1].toInt() and 0xff) shl 8)
        fun u32(offset: Int): Long =
            (zip[offset].toInt() and 0xff).toLong() or
                ((zip[offset + 1].toInt() and 0xff).toLong() shl 8) or
                ((zip[offset + 2].toInt() and 0xff).toLong() shl 16) or
                ((zip[offset + 3].toInt() and 0xff).toLong() shl 24)
        val count = u16(eocd + 10)
        if (count == 0xffff) return null // ZIP64
        val offset = u32(eocd + 16).toInt()
        val entries = mutableListOf<CentralEntry>()
        var pos = offset
        repeat(count) {
            if (pos + 46 > zip.size) return null
            if (zip[pos] != 0x50.toByte() || zip[pos + 1] != 0x4b.toByte() ||
                zip[pos + 2] != 0x01.toByte() || zip[pos + 3] != 0x02.toByte()
            ) {
                return null
            }
            val method = u16(pos + 10)
            val compressedSize = u32(pos + 20)
            val uncompressedSize = u32(pos + 24)
            if (compressedSize == 0xffffffffL || uncompressedSize == 0xffffffffL) return null // ZIP64
            val nameLength = u16(pos + 28)
            val extraLength = u16(pos + 30)
            val commentLength = u16(pos + 32)
            val externalAttrs = u32(pos + 38)
            val headerOffset = u32(pos + 42)
            if (headerOffset == 0xffffffffL) return null
            val nameStart = pos + 46
            if (nameStart + nameLength > zip.size) return null
            val nameBytes = zip.copyOfRange(nameStart, nameStart + nameLength)
            if (nameBytes.isEmpty()) return null
            entries.add(
                CentralEntry(
                    name = String(nameBytes, Charsets.UTF_8),
                    nameBytes = nameBytes,
                    method = method,
                    uncompressedSize = uncompressedSize,
                    unixMode = (externalAttrs shr 16).toInt(),
                ),
            )
            pos = nameStart + nameLength + extraLength + commentLength
        }
        return entries
    }

    companion object {
        /** Maximum package size shared by network and local-file import. */
        const val MAX_ZIP_BYTES = 5L * 1024 * 1024
        const val MANIFEST_ENTRY = "feelime-keyboard.json"
        const val SIGNATURE_ENTRY = "feelime-keyboard.sig"
        val ENVELOPE_ENTRIES = listOf(MANIFEST_ENTRY, SIGNATURE_ENTRY)
        // keyboard.legacy.js（#90 旧 WebView 兼容带）随包分发：seedBuiltIn 拷贝、
        // 热更 payload 清单、manifest 校验三处都从这里取——漏了哪处 built-in
        // 目录就少文件（API 28 实录：SERVED_FILES 放行后仍 404，种子目录没这文件）。
        val PAYLOAD_ENTRIES = listOf("index.html", "keyboard.css", "keyboard.js", "keyboard.legacy.js", "VERSION")
        val ALLOWED_ENTRIES = (ENVELOPE_ENTRIES + PAYLOAD_ENTRIES).toSet()
        val SEMVER = Regex("^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?(\\+[0-9A-Za-z.-]+)?$")

        fun sha256Hex(bytes: ByteArray): String {
            val digest = java.security.MessageDigest.getInstance("SHA-256").digest(bytes)
            return digest.joinToString("") { "%02x".format(it) }
        }
    }
}
