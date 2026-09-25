package com.feelime.ime.engine

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** #29-3 英文词直出派生：码=字母序列字面；能完整切成拼音音节的词
 *  （正常拼音键序）被过滤，切不开的（github/ios/android）保留。 */
class EnglishWordDerivationTest {

    private val store = CustomPhraseStore

    /** 音节键集取自真实码表的形态（codeTable 的 keys 即全拼音节表，
     *  doublePinyinSpellings 同源消费）。 */
    private fun codes(vararg syllables: String): JSONObject {
        val root = JSONObject()
        syllables.forEach { s ->
            val spellings = JSONObject()
            spellings.put("flypy", s)
            root.put(s, spellings)
        }
        return root
    }

    @Test
    fun `非拼音键序的词保留为字面码行`() {
        val words = listOf("GitHub" to "github", "iOS" to "ios", "Android" to "android")
        val lines = store.englishLines(codes("a", "ai", "su", "do", "be", "ta", "de", "mo"), words)
        assertEquals(listOf("GitHub\tgithub\t1", "iOS\tios\t1", "Android\tandroid\t1"), lines)
    }

    @Test
    fun `可完整切分的拼音键序被过滤`() {
        val words = listOf("sudo" to "sudo", "beta" to "beta", "demo" to "demo", "ai" to "ai", "ok" to "ok")
        val lines = store.englishLines(codes("ai", "su", "do", "be", "ta", "de", "mo"), words)
        // sudo=su+do、beta=be+ta、demo=de+mo、ai=ai 都是正常拼音输入；
        // ok（o/k 均非音节）保留。
        assertEquals(listOf("ok\tok\t1"), lines)
    }

    @Test
    fun `部分切分不算碰撞`() {
        // "app"：a 是音节但 p 不是，无法完整切分 -> 保留。
        val lines = store.englishLines(codes("a", "pen"), listOf("App" to "app"))
        assertEquals(listOf("App\tapp\t1"), lines)
    }

    @Test
    fun `码表缺失时不过滤全量落表`() {
        val words = listOf("demo" to "demo", "iOS" to "ios")
        val lines = store.englishLines(null, words)
        assertEquals(listOf("demo\tdemo\t1", "iOS\tios\t1"), lines)
    }

    @Test
    fun `内置表不含可完整切分的词`() {
        // 用真实码表资产跑一遍内置表：任何词都不应被音节表完整切分
        // （选词时已剔除 api/demo/repo/cache/ping/share/safari 这类
        //  死词条——运行时过滤是防线，常态不应命中）。
        val codesJson = java.io.File(
            "src/main/assets/custom-phrase-codes.json",
        ).takeIf { it.isFile }?.readText()
        if (codesJson == null) {
            println("asset not packaged in unit test env; skip")
            return
        }
        val lines = store.englishLines(JSONObject(codesJson))
        val kept = lines.map { it.substringBefore('\t').lowercase() }.toSet()
        assertFalse(kept.isEmpty())
        assertTrue("github" in kept && "ios" in kept && "android" in kept)
        assertEquals(
            "内置表出现新的拼音碰撞死词条（应从 DEFAULT_ENGLISH_WORDS 剔除）",
            CustomPhraseStore.DEFAULT_ENGLISH_WORDS.size, kept.size,
        )
    }
}
