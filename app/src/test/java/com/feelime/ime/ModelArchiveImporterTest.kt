package com.feelime.ime

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ModelArchiveImporterTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun `official tar bz2 files are extracted and verified into staging`() {
        val model = model()
        val archive = tarBz2(
            "official-model/" to ByteArray(0),
            "official-model/a.bin" to A,
            "official-model/b.bin" to B,
            "official-model/README" to "ignored".toByteArray(),
        )
        val staging = File(tmp.root, "model.import.part")
        val statuses = mutableListOf<String>()
        ModelArchiveImporter().importArchive(
            ByteArrayInputStream(archive), model, staging, statuses::add,
        )
        assertArrayEquals(A, File(staging, "a.bin").readBytes())
        assertArrayEquals(B, File(staging, "b.bin").readBytes())
        assertTrue(statuses.containsAll(listOf("reading", "validating")))
    }

    @Test
    fun `gzip-backed file matches the raw upstream entry name in official archives`() {
        // distribution 以 .gz 存放（downloadPath 带 .gz 后缀），官方 tar.bz2
        // 里的条目仍是原始名——本地导入必须仍能对上（上游内容即解压结果）。
        val model = ModelSpec(
            id = "gz-model",
            title = "gz",
            role = "test",
            version = "1",
            files = listOf(
                ModelFileSpec(
                    path = "asr-model/encoder.int8.onnx",
                    sha256 = sha256(A),
                    bytes = A.size.toLong(),
                    downloadPath = "encoder-epoch-99-avg-1.int8.onnx.gz",
                    gunzip = true,
                    downloadSha256 = sha256(A),
                    downloadBytesOverride = A.size.toLong(),
                ),
            ),
            sources = mapOf("gitee" to "https://example.test/handwriting/"),
        )
        val archive = tarBz2(
            "official-model/encoder-epoch-99-avg-1.int8.onnx" to A,
        )
        val staging = File(tmp.root, "model.import.part")
        ModelArchiveImporter().importArchive(ByteArrayInputStream(archive), model, staging)
        assertArrayEquals(A, File(staging, "encoder.int8.onnx").readBytes())
    }

    @Test
    fun `zip data descriptor import also accepts direct manifest paths`() {
        // ZipOutputStream writes DEFLATED entries with a data descriptor when
        // no size is supplied. Commons Compress reports entry.size == -1 for
        // this normal archive shape, so this covers the unknown-size stream
        // path rather than only stored entries with a declared size.
        val model = model()
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(ZipEntry("model/a.bin"))
            zip.write(A)
            zip.closeEntry()
            zip.putNextEntry(ZipEntry("model/b.bin"))
            zip.write(B)
            zip.closeEntry()
        }
        val staging = File(tmp.root, "model.import.part")
        ModelArchiveImporter().importArchive(
            ByteArrayInputStream(output.toByteArray()), model, staging,
        )
        assertArrayEquals(A, File(staging, "a.bin").readBytes())
        assertArrayEquals(B, File(staging, "b.bin").readBytes())
    }

    @Test
    fun `hash mismatch never leaves staged model files`() {
        val model = model()
        val archive = tarBz2(
            "model/a.bin" to "wrong".toByteArray(),
            "model/b.bin" to B,
        )
        val staging = File(tmp.root, "model.import.part")
        val error = runCatching {
            ModelArchiveImporter().importArchive(ByteArrayInputStream(archive), model, staging)
        }.exceptionOrNull()
        assertTrue(error is java.io.IOException)
        assertFalse(staging.exists())
    }

    @Test
    fun `missing manifest file never leaves staged model files`() {
        val model = model()
        val archive = tarBz2("model/a.bin" to A)
        val staging = File(tmp.root, "model.import.part")
        val error = runCatching {
            ModelArchiveImporter().importArchive(ByteArrayInputStream(archive), model, staging)
        }.exceptionOrNull()
        assertTrue(error is java.io.IOException)
        assertTrue(error?.message.orEmpty().contains("缺少模型文件"))
        assertFalse(staging.exists())
    }

    @Test
    fun `cancelled import removes staging and leaves existing model untouched`() {
        val model = model()
        val oldRoot = File(tmp.root, "model")
        oldRoot.mkdirs()
        File(oldRoot, "a.bin").writeBytes(A)
        File(oldRoot, "b.bin").writeBytes(B)
        val staging = File(tmp.root, ".model.import.part")
        val error = runCatching {
            ModelArchiveImporter(isCancelled = { true }).importArchive(
                ByteArrayInputStream(tarBz2("model/a.bin" to A, "model/b.bin" to B)),
                model,
                staging,
            )
        }.exceptionOrNull()
        assertTrue(error is ModelDownloadCancelled)
        assertFalse(staging.exists())
        assertArrayEquals(A, File(oldRoot, "a.bin").readBytes())
        assertArrayEquals(B, File(oldRoot, "b.bin").readBytes())
    }

    @Test
    fun `unsafe paths never leave staged model files`() {
        val model = model()
        val archive = tarBz2(
            "../escape" to "bad".toByteArray(),
            "model/a.bin" to A,
            "model/b.bin" to B,
        )
        val staging = File(tmp.root, "model.import.part")
        val error = runCatching {
            ModelArchiveImporter().importArchive(ByteArrayInputStream(archive), model, staging)
        }.exceptionOrNull()
        assertTrue(error is java.io.IOException)
        assertFalse(staging.exists())
        assertFalse(File(tmp.root.parentFile, "escape").exists())
    }

    private fun model() = ModelSpec(
        id = "test-model",
        title = "test",
        role = "test",
        version = "1",
        files = listOf(
            ModelFileSpec("model/a.bin", sha256(A), A.size.toLong(), "a.bin"),
            ModelFileSpec("model/b.bin", sha256(B), B.size.toLong(), "b.bin"),
        ),
        urls = listOf("https://huggingface.co/example/test/resolve/main/"),
    )

    private fun tarBz2(vararg entries: Pair<String, ByteArray>): ByteArray {
        val output = ByteArrayOutputStream()
        BZip2CompressorOutputStream(output).use { bzip ->
            TarArchiveOutputStream(bzip).use { tar ->
                tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX)
                entries.forEach { (name, bytes) ->
                    val entry = TarArchiveEntry(name)
                    entry.size = bytes.size.toLong()
                    tar.putArchiveEntry(entry)
                    tar.write(bytes)
                    tar.closeArchiveEntry()
                }
            }
        }
        return output.toByteArray()
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { "%02x".format(it) }

    companion object {
        private val A = "model-a".toByteArray()
        private val B = "model-b".toByteArray()
    }
}
