package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 重音折叠索引（ca → ça）的不变量：折叠键派生、首大写词条跳过、
 * 同键按「重音字符少者先」排序（ça 类高频形不该被长重音词压住）。
 */
class AccentFoldTest {
    @Test
    fun foldMapsAccentsToPlainKeys() {
        assertEquals("ca", HunspellTextEngine.foldAccents("ça"))
        assertEquals("etre", HunspellTextEngine.foldAccents("être"))
        assertEquals("deja", HunspellTextEngine.foldAccents("déjà"))
        assertEquals("francais", HunspellTextEngine.foldAccents("français"))
        assertEquals("кое", HunspellTextEngine.foldAccents("коё"))
        assertEquals("cafe", HunspellTextEngine.foldAccents("café"))
        assertEquals("table", HunspellTextEngine.foldAccents("table"))
    }

    @Test
    fun buildIndexSkipsPlainAndCapitalizedWords() {
        val index = HunspellTextEngine.buildAccentFold(
            listOf("table", "la", "ça", "Être", "être", "café"))
        assertFalse(index.containsKey("table"))
        assertFalse(index.containsKey("la"))
        // 首大写词条跳过（键盘组合为小写；Être 不该盖过 être）。
        assertEquals(listOf("être"), index["etre"])
        assertEquals(listOf("ça"), index["ca"])
        assertEquals(listOf("café"), index["cafe"])
    }

    @Test
    fun sameKeyOrdersByFewerAccentsFirst() {
        // coté/côte（各 1 个重音）排 côté（2 个）前面；等重音数保持词典序。
        val index = HunspellTextEngine.buildAccentFold(
            listOf("côté", "côte", "coté"))
        val list = index["cote"].orEmpty()
        assertEquals(3, list.size)
        assertTrue(list.indexOf("côté") > list.indexOf("côte"))
        assertTrue(list.indexOf("côté") > list.indexOf("coté"))
    }
}
