package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 省音词根收集（elisionRootsStatic）的不变量：词根只能是「用户所打
 * 字母的原样/重音摆位形」，ngram 建议的无关词结构上进不来（quotidie
 * 切 qu+otidie 后 suggest 吐 idiotie，拼出 qu'idiotie 压住 quotidien
 * 的用户实录）；原样排重音形前（j'aime 压住 j'aimé）。
 */
class ElisionRootsTest {
    private fun roots(rest: String, words: Set<String>, fold: Map<String, List<String>> = emptyMap()) =
        HunspellTextEngine.elisionRootsStatic(rest, { it in words }, fold)

    @Test
    fun bareRootComesBeforeAccentedForms() {
        // jaime：j'aime(无调词根、整词) 要压住 j'aimé(带调词根、拼装)。
        val jaime = roots("aime", setOf("aime", "aimé"), mapOf("aime" to listOf("aimé")))
        assertEquals(listOf("aime", "aimé"), jaime)
    }

    @Test
    fun accentedRootViaFoldTableAndEnumeration() {
        // cetait：etait 不是词，折叠表给 était。
        assertEquals(listOf("était"), roots("etait", setOf("était"), mapOf("etait" to listOf("était"))))
        // 折叠表没收（如屈折形）时，枚举摆位形过词典兜底。
        assertEquals(listOf("était"), roots("etait", setOf("était")))
        // jusqua：单字母 a 是词、à 走折叠表（jusqu'à 的 à）。
        assertEquals(listOf("a", "à"), roots("a", setOf("a", "à"), mapOf("a" to listOf("à"))))
    }

    @Test
    fun ngramStrangersNeverEnter() {
        // quotidie 的教训：otidie 的 suggest 会吐 idiotie/idiotifie/
        // idiotise，但它们不是 otidie 字母的重音摆位形，永远进不了词根。
        assertTrue(roots("otidie", setOf("idiotie", "idiotifie", "idiotise")).isEmpty())
        // 完整词免疫的另一半：table 的 t+able 档，able 不是词。
        assertTrue(roots("able", emptySet()).isEmpty())
    }

    @Test
    fun enumerationFormsCapped() {
        // cote 的摆位形（côte/coté/côté/…）词典全收也只到 ROOT_CAP 个
        // 枚举形（原样+折叠表之外的上限）。
        val words = setOf("cote", "côte", "coté", "côté", "côtié", "cotê", "côte", "côté")
        val capped = roots("cote", words)
        assertTrue(capped.size <= 1 + 4)
        assertTrue(capped.first() == "cote")
    }
}
