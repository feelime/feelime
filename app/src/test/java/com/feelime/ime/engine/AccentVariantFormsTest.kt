package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 屈折形重音枚举（eclate → éclaté）的不变量：含目标形、剔除原形、
 * 重音少者优先、无可折叠位返空、越界（折叠位>4 / 乘积>625）返空。
 */
class AccentVariantFormsTest {

    private fun forms(word: String) = HunspellTextEngine.accentVariantForms(word)

    @Test
    fun coversMultiAccentInflections() {
        // 用户实录：eclate 的目标形 éclaté（首尾两处重音，REP 单次替换够不到）
        val eclate = forms("eclate")
        assertTrue("éclate in " + eclate, eclate.contains("éclate"))
        assertTrue("éclaté in " + eclate, eclate.contains("éclaté"))
        // 重音少者优先：éclate(1) 排 éclaté(2) 前
        assertTrue(eclate.indexOf("éclate") < eclate.indexOf("éclaté"))
        // 原形剔除
        assertFalse(eclate.contains("eclate"))

        assertTrue(forms("mangee").contains("mangée"))
        assertTrue(forms("elevee").contains("élevée"))
        assertTrue(forms("ages").contains("âgés"))
        assertTrue(forms("ecole").contains("école"))
    }

    @Test
    fun singleAccentPositionsStillWork() {
        val ca = forms("ca")
        assertTrue(ca.contains("ça"))
        assertTrue(forms("etre").contains("être"))
    }

    @Test
    fun sortedByFewerAccentsThenLexicographic() {
        val cote = forms("cote")
        // côté(2) 不该压住 coté/côte(1)
        val one = cote.filter { it.count { c -> c in "àâçéèêëîïôùû" } == 1 }
        val two = cote.filter { it.count { c -> c in "àâçéèêëîïôùû" } == 2 }
        assertTrue(one.isNotEmpty() && two.isNotEmpty())
        assertTrue(cote.indexOfAll(one).max() < cote.indexOfAll(two).min())
    }

    private fun <T> List<T>.indexOfAll(xs: List<T>) = xs.map { indexOf(it) }

    @Test
    fun emptyWhenNoFoldableOrTooLong() {
        assertTrue(forms("bkzm").isEmpty())
        assertTrue(forms("a").isEmpty())
        assertTrue(forms("").isEmpty())
        // 折叠位 >4：e-l-e-v-e-e + e → 5 位
        assertTrue(forms("eleveee").isEmpty())
    }

    @Test
    fun productBoundKicksIn() {
        // 4 个 e 位 = 5^4 = 625 恰好在内；4 位含一个 a+e 混合并未越界
        assertTrue(forms("elevee").isNotEmpty())
    }
}

/** 重音折叠前缀索引（用户 2026-10-07：eclate 也要出 éclater）。 */
class FoldPrefixIndexTest {
    @Test
    fun findsAccentedHeadwordsByPlainPrefix() {
        val idx = HunspellTextEngine.buildFoldPrefixIndex(
            listOf("table", "éclater", "éclatement", "être", "élever"))!!
        val hits = idx.find("eclate", 8)
        assertTrue(hits.contains("éclater"))
        assertTrue(hits.contains("éclatement"))
        // 长度升序：更接近输入长度的排前。
        assertTrue(hits.indexOf("éclater") < hits.indexOf("éclatement"))
        assertFalse("纯词不进 fold 索引", hits.contains("table"))
    }

    @Test
    fun sameKeySegmentSortedByLengthThenWord() {
        val idx = HunspellTextEngine.buildFoldPrefixIndex(
            listOf("élève", "élevé", "élevée", "élever"))!!
        val hits = idx.find("eleve", 8)
        // (len, word) 序：5 长度组 élevé(é,l,e,v,é) < élève(é,l,è,v,e)
        // （第 3 字符 e<è）；6 长度组 élever < élevée（第 5 字符 e<é）。
        assertEquals(listOf("élevé", "élève", "élever", "élevée"), hits)
    }

    @Test
    fun plainOnlyWordListYieldsNull() {
        assertNull(HunspellTextEngine.buildFoldPrefixIndex(listOf("table", "la")))
    }
}
