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
                {"path": "asr-model/encoder.int8.onnx", "downloadPath": "encoder-epoch-99-avg-1.int8.onnx.gz",
                 "gunzip": true, "downloadSha256": "${"c".repeat(64)}", "downloadBytes": 456789,
                 "sha256": "${"a".repeat(64)}", "bytes": 123456},
                {"path": "asr-model/tokens.txt", "sha256": "${"b".repeat(64)}", "bytes": 789}
              ],
              "sources": {
                "gitee": "https://gitee.example/distribution/releases/download/asr-streaming-zh-en/",
                "github": "https://github.example/distribution/releases/download/asr-streaming-zh-en/",
                "ghproxy": "https://proxy.example/https://github.example/distribution/releases/download/asr-streaming-zh-en/"
              },
              "urls": [
                "https://lan-mirror.example/f/asr-model/"
              ]
            },
            {"id": "broken", "files": [], "sources": {}}
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
        // gzip 存放的文件按 wire 侧（压缩后）字节数计入下载量。
        assertEquals(456789L + 789L, model.totalDownloadBytes)
        assertEquals(listOf("encoder.int8.onnx", "tokens.txt"), model.files.map { it.path.substringAfter('/') })
        assertEquals("encoder-epoch-99-avg-1.int8.onnx.gz", model.files.first().downloadPath)
        val encoder = model.files.single { it.path == "asr-model/encoder.int8.onnx" }
        assertTrue(encoder.gunzip)
        assertEquals("c".repeat(64), encoder.wireSha256)
        assertEquals(456789L, encoder.downloadBytes)
        assertEquals(3, model.sources.size)
        assertEquals(
            "https://gitee.example/distribution/releases/download/asr-streaming-zh-en/",
            model.sources["gitee"],
        )
        assertEquals(1, model.urls.size)
        assertTrue(model.verified)
        assertEquals(model, manifest.byRole("asr-streaming"))
        assertNull(manifest.byRole("asr-final"))
    }

    @Test
    fun placeholderDigestsReadUnverified() {
        // The repo manifest ships "SEE-DEV-MODELS" until the build fills real
        // digests - downloadSync must refuse these.
        val json = """{"models":[{"id":"m","role":"r","files":[{"path":"d/f","sha256":"SEE-DEV-MODELS","bytes":0}],"sources":{"gitee":"https://x/"}}]}"""
        val model = ModelManifest.parse(json).models.single()
        assertFalse(model.verified)
    }

    @Test
    fun gunzipWithoutStaticWireDigestDropsTheModel() {
        // gzip 存放必须带 downloadSha256/downloadBytes（distribution 附件
        // 口径）；缺失 = 清单坏档，整个条目按不可用处理，不做裸下。
        val json = """
            {"models":[{"id":"m","role":"r","files":[
              {"path":"asr-model/encoder.int8.onnx","sha256":"${"a".repeat(64)}","bytes":10,
               "downloadPath":"encoder.gz","gunzip":true}
            ],"sources":{"gitee":"https://example.test/"}}]}
        """.trimIndent()

        assertEquals(0, ModelManifest.parse(json).models.size)
    }

    /** distribution 频道形状（gitee 默认源 + gunzip 外层静态指纹）：仓库
     * manifest 与 feelime/distribution 的发布产物必须一一对应——encoder 换
     * 版时本测试会失败，提醒先重发布频道再改清单。 */
    @Test
    fun repoManifestPinsDistributionChannelShape() {
        val repo = java.io.File("../models/manifest.json")
        if (!repo.isFile) return // 非 app/ 工作目录的运行环境跳过
        val manifest = ModelManifest.parse(repo.readText())
        val streaming = manifest.byRole("asr-streaming") ?: return
        assertEquals("2023-02-20", streaming.version)
        val encoder = streaming.files.single { it.gunzip }
        assertEquals("asr-model/encoder.int8.onnx", encoder.path)
        assertEquals("encoder-epoch-99-avg-1.int8.onnx.gz", encoder.downloadPath)
        // 已发布 .gz 附件的外层指纹（feelime/distribution 两端同值）。
        assertEquals(91524142L, encoder.downloadBytes)
        assertEquals(
            "7f5acf8cc2f8073d1887f8bf6cceaa3b41effe3e180ad3d7bf8fae832af441be",
            encoder.downloadSha256,
        )
        // 内层（落盘）内容 sha/bytes 是构建期从本地模型树回填的占位口径
        // （"SEE-DEV-MODELS"/0）；真实值由 generateModelManifest 填充并在
        // AVD 验收时按已装产物核对。
        assertEquals("SEE-DEV-MODELS", encoder.sha256)
        assertEquals(0L, encoder.bytes)
        for (source in listOf("gitee", "github", "ghproxy")) {
            val base = streaming.sources[source] ?: throw AssertionError("missing source $source")
            assertTrue(base.endsWith("/"))
        }
        assertEquals(
            "https://gitee.com/feelime/distribution/releases/download/asr-streaming-zh-en/",
            streaming.sources["gitee"],
        )
        assertEquals(
            MODEL_DISTRIBUTION_ROOTS["gitee"]!! + "asr-streaming-zh-en/",
            streaming.sources["gitee"],
        )
        // 手写条目同样迁移到 distribution（原 gitee.com/feelime/models）。
        val handwriting = manifest.byRole("handwriting-rec") ?: return
        assertEquals(
            "https://gitee.com/feelime/distribution/releases/download/handwriting/",
            handwriting.sources["gitee"],
        )
        assertEquals("model.onnx", handwriting.files.single().downloadPath)
        assertEquals(6613389L, handwriting.files.single().bytes)
        assertEquals(
            "04bf65859482f2e9f4836fb872c5a881940a8f6f81bd0994542187617793e932",
            handwriting.files.single().sha256,
        )
    }

    @Test
    fun modelDownloadSourceWireValuesAndLegacyMigration() {
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("gitee"))
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("GITEE"))
        assertEquals(ModelDownloadSource.GITHUB, ModelDownloadSource.fromValue("github"))
        assertEquals(ModelDownloadSource.GHPROXY, ModelDownloadSource.fromValue("ghproxy"))
        assertEquals(ModelDownloadSource.CUSTOM, ModelDownloadSource.fromValue("custom"))
        // 遗留值与未知值/缺省一律迁移到 gitee（distribution 镜像，sha 兜底）。
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue(null))
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("nonsense"))
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("hf_mirror"))
        assertEquals(ModelDownloadSource.GITEE, ModelDownloadSource.fromValue("official"))
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
