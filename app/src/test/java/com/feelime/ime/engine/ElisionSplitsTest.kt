package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 法语省音切分（élision）的不变量：jusqu/qu/单字母三档的覆盖面，
 * 与「完整词不在切分里被破坏」（切分只是候选来源，词典验证兜底，
 * 这里锁的是切分本身的形态）。
 */
class ElisionSplitsTest {
    private fun splits(word: String) =
        HunspellTextEngine.elisionSplitsStatic(word)

    @Test
    fun singleLetterHeadSplitsBeforeVowelRoot() {
        // cetait → c' + etait（root 的元音检查在 offer 里，切分层不管）。
        assertEquals(listOf("c" to "etait"), splits("cetait"))
        assertEquals(listOf("d" to "accord"), splits("daccord"))
        assertEquals(listOf("j" to "aime"), splits("jaime"))
        assertEquals(listOf("s" to "appelle"), splits("sappelle"))
    }

    @Test
    fun multipleSourcesAreAllOffered() {
        // 切分是候选来源（多档并存，词典验证在 offer 层兜底）：
        // jusqua 同时给 jusqu+a 与 j+usqua（后者被词典拒，j'usqua 不存在）。
        assertEquals(listOf("jusqu" to "a", "j" to "usqua"), splits("jusqua"))
        // jusqa 不以 jusqu 开头，只出 j 档（词典拒 j'usqa）。
        assertEquals(listOf("j" to "usqa"), splits("jusqa"))
        // quon → qu + on（q 不在单字母集，仅一档）。
        assertEquals(listOf("qu" to "on"), splits("quon"))
        // quil → qu + il。
        assertEquals(listOf("qu" to "il"), splits("quil"))
    }

    @Test
    fun nonStarterHeadsDoNotSplit() {
        // table 出 t+able 档但 root "able" 过不了词典（offer 层拒），
        // 切分层只锁「不出不该出的档」：b 开头、太短、无 rest。
        assertEquals(listOf("t" to "able"), splits("table"))
        assertTrue(splits("bonjour").isEmpty()) // b 不在省音字母集
        assertTrue(splits("ce").isEmpty())      // 太短（rest < 2）
        assertTrue(splits("qu").isEmpty())      // qu 后无 rest
    }
}
