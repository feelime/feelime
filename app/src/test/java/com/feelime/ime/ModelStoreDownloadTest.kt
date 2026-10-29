package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.security.MessageDigest

/** Mirror failover must survive every failure path - connect
 * errors, HTTP error codes, 416, mid-stream truncation - not just the two
 * exception-free ones. The fetcher runs against a fake transport. */
class ModelStoreDownloadTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val listener = object : ModelStore.Listener {
        override fun onProgress(modelId: String, doneBytes: Long, totalBytes: Long) = Unit
        override fun onFinished(modelId: String, state: ModelStore.State, error: String?) = Unit
    }

    private fun spec(vararg urls: String) = ModelSpec(
        id = "m", title = "m", role = "asr-streaming", version = "1",
        files = listOf(ModelFileSpec("dir/file.bin", sha256(PAYLOAD), PAYLOAD.size.toLong())),
        urls = urls.toList(),
    )

    private fun fetcher(factory: ModelConnectionFactory, allowHttp: Boolean = true) =
        ModelFileFetcher(factory, allowHttp, isCancelled = { false })

    private fun dest() = File(tmp.root, "file.bin")

    /** Open throws / returns a scripted code+bytes per call, per mirror. */
    private class FakeFactory(val scripts: MutableList<FakeResponse>) : ModelConnectionFactory {
        val opened = mutableListOf<Pair<String, Long>>() // url to rangeFrom
        override fun open(url: URI, rangeFrom: Long): ModelConnection {
            opened.add(url.toString() to rangeFrom)
            val response = scripts.removeFirstOrNull()
                ?: throw IOException("no script for $url")
            return response.connection(rangeFrom)
        }
    }

    private class FakeResponse(
        private val code: Int,
        private val bytes: ByteArray = ByteArray(0),
        private val boom: Boolean = false,
        private val truncateTo: Int = -1,
    ) {
        fun connection(rangeFrom: Long): ModelConnection {
            if (boom) throw IOException("connection failed")
            return object : ModelConnection {
                override val responseCode get() = code
                override fun body(): InputStream {
                    // Resume-aware: a Range request gets the tail of the
                    // payload so 206 reads like a real server.
                    val slice = if (rangeFrom > 0) {
                        bytes.copyOfRange(rangeFrom.toInt(), bytes.size)
                    } else {
                        bytes
                    }
                    val data = if (truncateTo >= 0) slice.copyOf(truncateTo) else slice
                    return ByteArrayInputStream(data)
                }
                override fun disconnect() = Unit
            }
        }
    }

    @Test
    fun `first mirror unreachable falls through to the second`() {
        val factory = FakeFactory(mutableListOf(
            FakeResponse(code = 0, boom = true),
            FakeResponse(200, PAYLOAD),
        ))
        val file = dest()
        fetcher(factory).fetch(spec("https://a/", "https://b/"),
            spec("https://a/", "https://b/").files[0], file, listener, 0)
        assertEquals(sha256(file), sha256(PAYLOAD))
        assertFalse(File(tmp.root, "file.bin.part").exists())
    }

    @Test
    fun `http error code falls through to the next mirror`() {
        val factory = FakeFactory(mutableListOf(
            FakeResponse(500),
            FakeResponse(200, PAYLOAD),
        ))
        fetcher(factory).fetch(spec("https://a/", "https://b/"),
            spec("https://a/", "https://b/").files[0], dest(), listener, 0)
        assertEquals(sha256(dest()), sha256(PAYLOAD))
    }

    @Test
    fun `complete but corrupt mirror falls through and restarts from zero`() {
        val corrupt = PAYLOAD.copyOf().also { it[0] = (it[0].toInt() xor 0x7f).toByte() }
        val factory = FakeFactory(mutableListOf(
            FakeResponse(200, corrupt),
            FakeResponse(200, PAYLOAD),
        ))
        fetcher(factory).fetch(spec("https://bad/", "https://good/"),
            spec("https://bad/", "https://good/").files[0], dest(), listener, 0)
        assertEquals(
            listOf(
                "https://bad/dir/file.bin" to 0L,
                "https://good/dir/file.bin" to 0L,
            ),
            factory.opened,
        )
        assertEquals(sha256(dest()), sha256(PAYLOAD))
    }

    @Test
    fun `range not satisfiable restarts clean on the next mirror`() {
        val file = dest()
        file.writeBytes("stale-part".toByteArray())
        val factory = FakeFactory(mutableListOf(
            FakeResponse(416),
            FakeResponse(200, PAYLOAD),
        ))
        fetcher(factory).fetch(spec("https://a/", "https://b/"),
            spec("https://a/", "https://b/").files[0], file, listener, 0)
        assertEquals(sha256(file), sha256(PAYLOAD))
    }

    @Test
    fun `truncated stream resumes from the part length on the next mirror`() {
        val factory = FakeFactory(mutableListOf(
            // First mirror dies mid-stream: half the payload on disk.
            FakeResponse(200, PAYLOAD, truncateTo = PAYLOAD.size / 2),
            // Second mirror is asked for the remainder (Range = part length).
            FakeResponse(206, PAYLOAD),
        ))
        fetcher(factory).fetch(spec("https://a/", "https://b/"),
            spec("https://a/", "https://b/").files[0], dest(), listener, 0)
        val (_, range) = factory.opened[1]
        assertEquals(PAYLOAD.size / 2.toLong(), range)
        assertEquals(sha256(dest()), sha256(PAYLOAD))
    }

    @Test
    fun `exhausted mirrors rethrow the last error`() {
        val factory = FakeFactory(mutableListOf(
            FakeResponse(code = 0, boom = true),
            FakeResponse(503),
        ))
        val error = runCatching {
            fetcher(factory).fetch(spec("https://a/", "https://b/"),
                spec("https://a/", "https://b/").files[0], dest(), listener, 0)
        }.exceptionOrNull()
        assertTrue(error is IOException)
        assertTrue(error!!.message!!.contains("503"))
    }

    @Test
    fun `plain http mirrors are skipped when not allowed`() {
        val factory = FakeFactory(mutableListOf(
            FakeResponse(200, PAYLOAD),
        ))
        fetcher(factory, allowHttp = false).fetch(spec("http://insecure/", "https://b/"),
            spec("http://insecure/", "https://b/").files[0], dest(), listener, 0)
        // The http prefix never even opened a connection.
        assertEquals(listOf("https://b/dir/file.bin" to 0L), factory.opened)
    }

    @Test
    fun `download path can differ from the local engine path`() {
        val model = spec("https://mirror/").copy(
            files = listOf(
                ModelFileSpec(
                    path = "asr-model/encoder.int8.onnx",
                    sha256 = sha256(PAYLOAD),
                    bytes = PAYLOAD.size.toLong(),
                    downloadPath = "encoder-epoch-99-avg-1.int8.onnx",
                ),
            ),
        )
        val factory = FakeFactory(mutableListOf(FakeResponse(200, PAYLOAD)))
        fetcher(factory).fetch(model, model.files.single(), dest(), listener, 0)
        assertEquals(
            "https://mirror/encoder-epoch-99-avg-1.int8.onnx" to 0L,
            factory.opened.single(),
        )
    }

    private fun sha256(file: File): String = sha256(file.readBytes())

    @Test
    fun `network not approved opens no mirror`() {
        val factory = FakeFactory(mutableListOf(FakeResponse(200, PAYLOAD)))
        val model = spec("https://a/", "https://b/")
        val error = runCatching {
            ModelFileFetcher(factory, false, { false },
                checkNetwork = { throw ModelDownloadNetworkChanged() })
                .fetch(model, model.files.single(), dest(), listener, 0)
        }.exceptionOrNull()
        assertTrue(error is ModelDownloadNetworkChanged)
        assertTrue(factory.opened.isEmpty())
        assertFalse(dest().exists())
    }

    @Test
    fun `network switch stops stream without mirror fallback and approved retry resumes`() {
        var approved = true
        val factory = FakeFactory(mutableListOf(FakeResponse(200, PAYLOAD)))
        val model = spec("https://a/", "https://b/")
        val progress = object : ModelStore.Listener {
            override fun onProgress(modelId: String, doneBytes: Long, totalBytes: Long) {
                approved = false
            }
            override fun onFinished(modelId: String, state: ModelStore.State, error: String?) = Unit
        }
        val error = runCatching {
            ModelFileFetcher(factory, false, { false }, checkNetwork = {
                if (!approved) throw ModelDownloadNetworkChanged()
            }).fetch(model, model.files.single(), dest(), progress, 0)
        }.exceptionOrNull()
        assertTrue(error is ModelDownloadNetworkChanged)
        assertEquals(1, factory.opened.size)
        assertFalse(dest().exists())
        val partialBytes = File(tmp.root, "file.bin.part").length()
        assertTrue(partialBytes in 1 until PAYLOAD.size.toLong())

        val resumed = FakeFactory(mutableListOf(FakeResponse(206, PAYLOAD)))
        fetcher(resumed).fetch(model, model.files.single(), dest(), listener, 0)
        assertEquals(partialBytes, resumed.opened.single().second)
        assertEquals(sha256(PAYLOAD), sha256(dest()))
    }

    private fun gzipFileSpec(): ModelFileSpec {
        val gz = ByteArrayOutputStream().use { buffer ->
            java.util.zip.GZIPOutputStream(buffer).use { it.write(PAYLOAD) }
            buffer.toByteArray()
        }
        return ModelFileSpec(
            path = "asr-model/encoder.int8.onnx",
            sha256 = sha256(PAYLOAD),
            bytes = PAYLOAD.size.toLong(),
            downloadPath = "encoder-epoch-99-avg-1.int8.onnx.gz",
            gunzip = true,
            downloadSha256 = sha256(gz),
            downloadBytesOverride = gz.size.toLong(),
        )
    }

    @Test
    fun `gzip-backed file verifies wire digest and gunzips to raw content`() {
        val spec = gzipFileSpec()
        val gz = ByteArrayOutputStream().use { buffer ->
            java.util.zip.GZIPOutputStream(buffer).use { it.write(PAYLOAD) }
            buffer.toByteArray()
        }
        val model = spec("https://a/").copy(files = listOf(spec))
        fetcher(FakeFactory(mutableListOf(FakeResponse(200, gz))))
            .fetch(model, spec, dest(), listener, 0)
        assertEquals(sha256(PAYLOAD), sha256(dest()))
        assertFalse(File(tmp.root, "file.bin.part").exists())
    }

    @Test
    fun `corrupt gzip wire digest restarts from zero on the next mirror`() {
        val spec = gzipFileSpec()
        val goodGz = ByteArrayOutputStream().use { buffer ->
            java.util.zip.GZIPOutputStream(buffer).use { it.write(PAYLOAD) }
            buffer.toByteArray()
        }
        val corruptGz = goodGz.copyOf().also { it[2] = (it[2].toInt() xor 0x5a).toByte() }
        val model = spec("https://bad/", "https://good/").copy(files = listOf(spec))
        val factory = FakeFactory(mutableListOf(
            FakeResponse(200, corruptGz),
            FakeResponse(200, goodGz),
        ))
        fetcher(factory).fetch(model, spec, dest(), listener, 0)
        assertEquals(
            listOf(
                "https://bad/${spec.downloadPath}" to 0L,
                "https://good/${spec.downloadPath}" to 0L,
            ),
            factory.opened,
        )
        assertEquals(sha256(PAYLOAD), sha256(dest()))
    }

    @Test
    fun `speed tester measures elapsed ms and maps failures to null`() {
        class ScriptFactory(val code: Int, val boom: Boolean = false) : ModelConnectionFactory {
            override fun open(url: URI, rangeFrom: Long): ModelConnection {
                if (boom) throw IOException("connect failed")
                return object : ModelConnection {
                    override val responseCode get() = code
                    override fun body(): InputStream = ByteArrayInputStream("{}".toByteArray())
                    override fun disconnect() = Unit
                }
            }
        }
        val tester = ModelSourceSpeedTester(ScriptFactory(200), allowHttp = false)
        assertTrue(tester.probe("https://fast/", MODEL_SPEED_PROBE_FILE)!! >= 0)
        assertNull(ModelSourceSpeedTester(ScriptFactory(503), allowHttp = false)
            .probe("https://slow/", MODEL_SPEED_PROBE_FILE))
        assertNull(tester.probe("http://lan/", MODEL_SPEED_PROBE_FILE))
        assertNull(ModelSourceSpeedTester(ScriptFactory(200, boom = true), allowHttp = false)
            .probe("https://boom/", MODEL_SPEED_PROBE_FILE))
        // custom 源允许回退探测 base 本身（metainfo 404 时目录列表 200）。
        val custom = ModelSourceSpeedTester(ScriptFactory(200), allowHttp = true)
        assertTrue(custom.probeSource("http://lan/models/", isCustom = true) != null)
        assertNull(ModelSourceSpeedTester(ScriptFactory(404), allowHttp = false)
            .probeSource("https://metainfo404/", isCustom = false))
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { "%02x".format(it) }

    companion object {
        val PAYLOAD = ByteArray(200_000) { (it % 251).toByte() }
    }
}
