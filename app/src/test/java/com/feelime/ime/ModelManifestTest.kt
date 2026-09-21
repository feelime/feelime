package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** design §12.3: the manifest/record parsing is pure Kotlin (PanelCodec
 * precedent) so the JVM suite pins the exact shapes the downloader, the
 * settings UI, and the engines depend on. */
class ModelManifestTest {

    private val manifestJson = """
        {
          "version": 1,
          "models": [
            {
              "id": "streaming-zipformer-bilingual-zh-en",
              "title": "流式语音识别（中英）",
              "role": "asr-streaming",
              "version": "2023-02-20",
              "files": [
                {"path": "asr-model/encoder.int8.onnx", "downloadPath": "encoder-epoch-99-avg-1.int8.onnx", "sha256": "${"a".repeat(64)}", "bytes": 123456,
                 "archive": {"url": "https://example.test/mobile.tar.bz2", "bytes": 456789,
                   "sha256": "${"c".repeat(64)}", "entry": "mobile/encoder.onnx",
                   "entryBytes": 123456, "entrySha256": "${"a".repeat(64)}",
                   "sourceUrls": {"hf_mirror": "https://proxy.example/mobile.tar.bz2"}}},
                {"path": "asr-model/tokens.txt", "sha256": "${"b".repeat(64)}", "bytes": 789}
              ],
              "urls": [
                "https://mirror-a.example/f/",
                "https://mirror-b.example/f/"
              ]
            },
            {"id": "broken", "files": [], "urls": []}
          ]
        }
    """.trimIndent()

    @Test
    fun parsesRepoShapedManifest() {
        val manifest = ModelManifest.parse(manifestJson)
        assertEquals(1, manifest.models.size)
        val model = manifest.models.single()
        assertEquals("streaming-zipformer-bilingual-zh-en", model.id)
        assertEquals("流式语音识别（中英）", model.title)
        assertEquals("asr-streaming", model.role)
        assertEquals("asr-model", model.dir)
        assertEquals(2, model.files.size)
        assertEquals(123456L + 789L, model.totalBytes)
        assertEquals(456789L + 789L, model.totalDownloadBytes)
        assertEquals(listOf("encoder.int8.onnx", "tokens.txt"), model.files.map { it.path.substringAfter('/') })
        assertEquals("encoder-epoch-99-avg-1.int8.onnx", model.files.first().downloadPath)
        assertEquals(456789L, model.files.first().archive?.bytes)
        val encoder = model.files.single { it.path == "asr-model/encoder.int8.onnx" }
        assertEquals(
            "https://proxy.example/mobile.tar.bz2",
            encoder.archive?.sourceUrls?.get("hf_mirror"),
        )
        assertTrue(encoder.archive != null)
        assertEquals(
            "mobile/encoder.onnx",
            encoder.archive?.entry,
        )
        assertEquals(2, model.urls.size)
        assertTrue(model.verified)
        assertEquals(model, manifest.byRole("asr-streaming"))
        assertNull(manifest.byRole("asr-final"))
    }

    @Test
    fun placeholderDigestsReadUnverified() {
        // The repo manifest ships "SEE-DEV-MODELS" until the build fills real
        // digests - downloadSync must refuse these.
        val json = """{"models":[{"id":"m","role":"r","files":[{"path":"d/f","sha256":"SEE-DEV-MODELS","bytes":0}],"urls":["https://x/"]}]}"""
        val model = ModelManifest.parse(json).models.single()
        assertFalse(model.verified)
    }

    @Test
    fun malformedArchiveMetadataDoesNotLeaveAFileOnlyFallbackModel() {
        val json = """
            {"models":[{"id":"m","role":"r","files":[
              {"path":"asr-model/encoder.int8.onnx","sha256":"${"a".repeat(64)}","bytes":10,
               "archive":{"url":"https://example.test/a.tar.bz2","bytes":100,
                 "sha256":"${"b".repeat(64)}","entry":"mobile/encoder.onnx",
                 "entryBytes":10}}
            ],"urls":["https://example.test/"]}]}
        """.trimIndent()

        assertEquals(0, ModelManifest.parse(json).models.size)
    }

    /** 手写条目（design/handwriting.md §5.3）：urls 首位是 gitee 镜像
     * （国内直连，默认按 manifest 顺序直用），downloadPath 与 gitee
     * release 资产名对齐。 */
    @Test
    fun repoManifestHandwritingEntryPinsDistributionShape() {
        val repo = java.io.File("../models/manifest.json")
        if (!repo.isFile) return // 非 app/ 工作目录的运行环境跳过
        val manifest = ModelManifest.parse(repo.readText())
        val model = manifest.byRole("handwriting-rec")
            ?: return // 旧分支无此条目
        assertEquals("ppocrv5-mobile-rec", model.id)
        assertEquals(listOf("model.onnx"), model.files.map { it.path.substringAfter('/') })
        assertTrue(model.verified)
        assertTrue(model.urls.first().startsWith("https://gitee.com/"))
        assertTrue(model.urls.first().endsWith("/"))
        assertTrue(model.urls.drop(1).contains("https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master/"))
        // gitee 前缀 + downloadPath = 设计钉死的资产 URL。
        assertEquals(
            "https://gitee.com/feelime/models/releases/download/handwriting-v1/model.onnx",
            model.urls.first() + model.files.first().downloadPath,
        )
        assertEquals(16631306L, model.files.first().bytes)
        assertEquals(
            "5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5",
            model.files.first().sha256,
        )
    }

    @Test
    fun modelDownloadSourceAcceptsGitee() {
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("gitee"))
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("GITEE"))
        assertEquals(ModelDownloadSource.HF_MIRROR, ModelDownloadSource.fromValue(null))
        assertEquals(ModelDownloadSource.HF_MIRROR, ModelDownloadSource.fromValue("nonsense"))
    }

    @Test
    fun modelBackendUsesStableWireValuesAndChannelDefaults() {
        assertEquals(ModelBackend.AUTO, ModelBackend.fromValue("AUTO"))
        assertEquals(ModelBackend.REMOTE, ModelBackend.fromValue("remote"))
        assertNull(ModelBackend.fromValue("unexpected"))
        assertEquals(ModelBackend.AUTO, ModelBackend.defaultFor(playDistribution = true))
        assertEquals(ModelBackend.REMOTE, ModelBackend.defaultFor(playDistribution = false))
        assertEquals(ModelBackend.AUTO, ModelBackend.defaultFor(
            playDistribution = false, bundledStreamingModel = true,
        ))
    }

    @Test
    fun structuralSurprisesYieldEmptyManifest() {
        assertEquals(0, ModelManifest.parse("not json at all").models.size)
        assertEquals(0, ModelManifest.parse("{}").models.size)
        assertEquals(0, ModelManifest.parse("""{"models":[{"id":"x"}]}""").models.size)
        assertEquals(0, ModelManifest.parse("""{"models":[{"id":"x","files":[{"path":"p"}]}]}""").models.size)
    }

    @Test
    fun jsonParserHandlesEscapesAndUnicode() {
        val json = """{"a":"line\nbreak 中 \"quoted\" \\ back","n":-42,"t":true,"f":false,"z":null,"list":[1,{"k":"v"}]}"""
        val root = ModelManifest.parse(json)
        assertEquals(0, root.models.size) // shape mismatch is tolerated, parse must not throw
        val parsed = JsonParser(json).parseDocument() as Map<*, *>
        assertEquals("line\nbreak 中 \"quoted\" \\ back", parsed["a"])
        assertEquals(-42L, parsed["n"])
        assertEquals(true, parsed["t"])
        assertEquals(false, parsed["f"])
        assertEquals(null, parsed["z"])
    }

    @Test
    fun installRecordRoundTrip() {
        val record = ModelStore.InstallRecord(
            id = "streaming-zipformer-bilingual-zh-en",
            version = "2023-02-20",
            files = mapOf(
                "encoder.int8.onnx" to ModelStore.InstallEntry("a".repeat(64), 123456),
                "tokens.txt" to ModelStore.InstallEntry("b".repeat(64), 789),
            ),
        )
        val parsed = ModelStore.InstallRecord.parse(record.toJson())
        assertEquals(record, parsed)
        assertNull(ModelStore.InstallRecord.parse("garbage"))
        assertNull(ModelStore.InstallRecord.parse("{}"))
    }

    @Test
    fun legacyOnlinePunctuationInstallCannotSatisfyOfflineManifest() {
        val offline = ModelSpec(
            id = "offline-punct-zh-en",
            title = "中英标点恢复",
            role = "punctuation",
            version = "2024-04-12-int8",
            files = listOf(
                ModelFileSpec(
                    path = "punctuation/model.int8.onnx",
                    sha256 = "a".repeat(64),
                    bytes = 42,
                ),
            ),
            urls = emptyList(),
        )
        val legacy = ModelStore.InstallRecord(
            id = "online-punct-en",
            version = "2024-08-06",
            files = mapOf(
                "model.int8.onnx" to ModelStore.InstallEntry("b".repeat(64), 41),
                "bpe.vocab" to ModelStore.InstallEntry("c".repeat(64), 7),
            ),
        )

        assertFalse(legacy.matches(offline))
    }
}
