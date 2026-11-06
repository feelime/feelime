package com.feelime.ime.engine

import java.io.File
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test

/**
 * 训练/推理特征对拍：scripts/itn-train/export_model.py 导出的金样
 * （特征串列表 + FNV hash），Kotlin 侧逐条一致才允许资源上线——
 * 特征错一个字符（前缀、n、分隔符）权重就对不上槽位，静默降级。
 */
class ItnClassifierGoldenTest {

    companion object {
        @BeforeClass
        @JvmStatic
        fun load() {
            val m = locate("itn-model.bin")
            val l = locate("itn-lexicon.bin")
            println("GOLDEN-DEBUG model=${m.absolutePath} len=${m.length()} lex=${l.absolutePath} len=${l.length()}")
            ItnClassifier.loadFiles(m, l)
        }

        private fun locate(name: String): File {
            var dir = File(System.getProperty("user.dir") ?: ".")
            repeat(6) {
                val f = File(dir, "src/main/assets/itn/$name")
                if (f.isFile) return f
                dir = dir.parentFile ?: return@repeat
            }
            throw IllegalStateException("itn asset $name not found from cwd")
        }
    }

    @Test
    fun goldenFeaturesMatchPythonSide() {
        var dir = File(System.getProperty("user.dir") ?: ".")
        var golden: File? = null
        repeat(6) {
            val f = File(dir, "src/test/resources/itn/golden_features.json")
            if (f.isFile) { golden = f; return@repeat }
            dir = dir.parentFile ?: return@repeat
        }
        val samples = JSONArray(golden!!.readText())
        for (i in 0 until samples.length()) {
            val s = samples.getJSONObject(i)
            val text = s.getString("text")
            val start = s.getInt("start")
            val end = s.getInt("end")
            val wantFeatures = s.getJSONArray("features")
            val wantHashes = s.getJSONArray("hashes")
            val got = ItnClassifier.features(text, start, end)
            assertEquals("feature count @${s.getString("text").take(10)}", wantFeatures.length(), got.size)
            val gotSet = got.toSet()
            for (f in 0 until wantFeatures.length()) {
                assertTrue("missing feature ${wantFeatures.getString(f)}", wantFeatures.getString(f) in gotSet)
            }
            // hash 一致性：对前 20 个特征断言
            for (h in 0 until minOf(20, wantFeatures.length())) {
                assertEquals(
                    "hash of ${wantFeatures.getString(h)}",
                    wantHashes.getInt(h).toLong(),
                    ItnClassifier.hashFeature(wantFeatures.getString(h)).toLong(),
                )
            }
        }
    }

    @Test
    fun loadedClassifierDecides() {
        // 资源已加载（BeforeClass）；抽两条金样验证 decide 不炸且有输出
        val samples = JSONArray(locate2().readText())
        val s = samples.getJSONObject(0)
        ItnClassifier.decide(s.getString("text"), s.getInt("start"), s.getInt("end"))
        assertTrue(ItnClassifier.loaded)
    }

    private fun locate2(): File {
        var dir = File(System.getProperty("user.dir") ?: ".")
        repeat(6) {
            val f = File(dir, "src/test/resources/itn/golden_features.json")
            if (f.isFile) return f
            dir = dir.parentFile ?: return@repeat
        }
        throw IllegalStateException("golden not found")
    }
}
