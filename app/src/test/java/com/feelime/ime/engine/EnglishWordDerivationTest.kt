package com.feelime.ime.engine

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** #29-3 英文词直出派生（扩容二轮）：切不开拼音音节的词（github/how）
 *  与键序=正常拼音的高频词（are/time，用户点名要能打）都落表；
 *  音节分类保留作语义注释——stabledb 词条权重不参与与主词典的组间
 *  排序（AVD 实测 0/1/-99 同位），「压到拼音后」需双 translator 重构。 */
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
        val lines = store.englishLines(codes("a", "ai", "su", "do", "be", "ta", "de", "mo"), words, lowRankWords = emptyList())
        assertEquals(listOf("GitHub\tgithub\t1", "iOS\tios\t1", "Android\tandroid\t1"), lines)
    }

    @Test
    fun `可完整切分的拼音键序被过滤`() {
        val words = listOf("sudo" to "sudo", "beta" to "beta", "demo" to "demo", "ai" to "ai", "ok" to "ok")
        val lines = store.englishLines(codes("ai", "su", "do", "be", "ta", "de", "mo"), words, lowRankWords = emptyList())
        // sudo=su+do、beta=be+ta、demo=de+mo、ai=ai 都是正常拼音输入——
        // 主轨过滤；ok（o/k 均非音节）保留。
        assertEquals(listOf("ok\tok\t1"), lines)
    }

    @Test
    fun `部分切分不算碰撞`() {
        // "app"：a 是音节但 p 不是，无法完整切分 -> 保留。
        val lines = store.englishLines(codes("a", "pen"), listOf("App" to "app"), lowRankWords = emptyList())
        assertEquals(listOf("App\tapp\t1"), lines)
    }

    @Test
    fun `码表缺失时不过滤全量落表`() {
        val words = listOf("demo" to "demo", "iOS" to "ios")
        val lines = store.englishLines(null, words, lowRankWords = emptyList())
        assertEquals(listOf("demo\tdemo\t1", "iOS\tios\t1"), lines)
    }

    @Test
    fun `音节冲突词也落表（与主轨同权重）`() {
        // are=a+re（re 是音节）：主轨滤掉，但用户点名要能打——冲突轨
        // 同 quality 落表（词条权重不参与组间排序，AVD 实测）。
        val lines = store.englishLines(
            codes("a", "re"),
            words = listOf("how" to "how"),
            lowRankWords = listOf("are" to "are", "time" to "time"),
        )
        assertEquals(listOf("how\thow\t1", "are\tare\t1", "time\ttime\t1"), lines)
    }

    @Test
    fun `内置低位表全部是音节冲突词`() {
        val codesFile = java.io.File("src/main/assets/custom-phrase-codes.json")
        assertTrue(codesFile.isFile)
        val syllables = HashSet<String>()
        val keys = JSONObject(codesFile.readText()).keys()
        while (keys.hasNext()) syllables.add(keys.next())
        CustomPhraseStore.COLLIDING_ENGLISH_WORDS.forEach { (_, code) ->
            assertTrue(
                "低位表混入了切不开音节的词（应挪去主轨）：$code",
                store.englishLinesRun(code, syllables),
            )
        }
    }

    /** 测试侧读同一 asset（无 Context；格式校验一并覆盖）。 */
    private fun frequencyWordsFromFile(): List<Pair<String, String>> {
        val f = java.io.File("src/main/assets/english-words.txt")
        assertTrue("english-words.txt missing", f.isFile)
        return f.readLines().mapNotNull { line ->
            val parts = line.split('\t')
            if (parts.size == 2) parts[0] to parts[1] else null
        }
    }

    @Test
    fun `内置表不含可完整切分的词`() {
        // 用真实码表资产跑一遍内置表：任何词都不应被音节表完整切分
        // （选词时已剔除 api/demo/repo/cache/ping/share/safari 这类
        //  死词条——运行时过滤是防线，常态不应命中）。
        // 资产缺失=断言失败而非跳过（codex 评审 H：早返回会让该测试
        // 在打包漏资产时假绿）。
        val codesFile = java.io.File("src/main/assets/custom-phrase-codes.json")
        assertTrue("custom-phrase-codes.json missing (worktree needs app/src/modelAssets link or fresh checkout)", codesFile.isFile)
        val lines = store.englishLines(JSONObject(codesFile.readText()),
            frequencyWords = frequencyWordsFromFile())
        val all = lines.map { it.substringBefore('\t').lowercase() }.toSet()
        assertFalse(all.isEmpty())
        assertTrue("github" in all && "ios" in all && "android" in all && "how" in all)
        assertTrue("冲突轨含用户点名的高频词", "are" in all && "time" in all)
        // 全表词数 = DEFAULT + DAILY + COLLIDING（三表各不相交；主轨在真实
        // 码表下零碰撞——有碰撞词会被滤掉导致总数缩水，此断言即防线）。
        assertEquals(
            "表间有重复或主轨出现新的拼音碰撞死词条（应剔到 COLLIDING）",
            CustomPhraseStore.DEFAULT_ENGLISH_WORDS.size +
                CustomPhraseStore.DAILY_ENGLISH_WORDS.size +
                CustomPhraseStore.COLLIDING_ENGLISH_WORDS.size +
                frequencyWordsFromFile().size, all.size,
        )
    }
}
