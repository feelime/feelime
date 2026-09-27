package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** #34 删除单位的 grapheme 切分（BackGestureLedger）：恢复账本必须与
 *  宿主退格的整组删除同口径（codex 终审 P1，真机曾录得国旗恢复错字）。 */
class BackGestureLedgerTest {

    private fun tail(s: String) = BackGestureLedger.splitTailUnit(s)!!.second

    @Test
    fun asciiSingleChar() {
        assertEquals("a", tail("a"))
        assertEquals("x", tail("ax"))
    }

    @Test
    fun bmpCjkSingleUnit() {
        assertEquals("你", tail("你"))
        assertEquals("好", tail("你好"))
    }

    @Test
    fun surrogatePairNotSplit() {
        assertEquals("😀", tail("😀")) // U+1F600
        assertEquals("😀", tail("a😀"))
    }

    @Test
    fun flagIsOneUnit() {
        assertEquals("🇨🇳", tail("🇨🇳")) // 两个 RI 码点
        assertEquals("🇺🇸", tail("🇨🇳🇺🇸")) // 尾对完整弹出，前一对保留
    }

    @Test
    fun oddRiSequenceDegradesGracefully() {
        // 病态孤 RI（用户不太可能输入）：末 RI 单独成单位，不崩不劈代理对
        assertEquals("🇦", tail("🇦"))
    }

    @Test
    fun tripleRiPicksTheLoneTail() {
        // GB12/13 配对从段头起算：🇦🇧🇨 的尾单位是孤立的 🇨（codex 二轮
        // P2-3——旧行为弹 🇧🇨，恢复会得到 🇦🇧🇧🇨 重复 B）。
        val (rest, unit) = BackGestureLedger.splitTailUnit("🇦🇧🇨")!!
        assertEquals("🇨", unit)
        assertEquals("🇦🇧", rest)
    }

    @Test
    fun fiveRiChainAlternatesCorrectly() {
        // GB 配对从段头起算：🇦🇧|🇨🇩|🇪——先弹孤立的 🇪；余 🇦🇧🇨🇩 两对，
        // 弹 🇨🇩；余 🇦🇧 再弹整对。
        var rest = "🇦🇧🇨🇩🇪"
        assertEquals("🇪", BackGestureLedger.splitTailUnit(rest)!!.second)
        rest = BackGestureLedger.splitTailUnit(rest)!!.first
        assertEquals("🇨🇩", BackGestureLedger.splitTailUnit(rest)!!.second)
        rest = BackGestureLedger.splitTailUnit(rest)!!.first
        assertEquals("🇦🇧", BackGestureLedger.splitTailUnit(rest)!!.second)
    }

    @Test
    fun tagFlagIsOneUnit() {
        // 英格兰旗（1F3F4 + gbeng tag 序列 + cancel tag E007F）：整组一个
        // 单位（codex 二轮 P1-1——tag 字符此前不在 trailing 集，只会弹出
        // 不可见的终止符）。码点构造，避免源文件字面量被编辑器污染。
        val england = buildString {
            appendCodePoint(0x1F3F4)
            "gbeng".forEach { appendCodePoint(0xE0000 + it.code) }
            appendCodePoint(0xE007F)
        }
        assertEquals(england, tail(england))
        assertEquals(england, tail("x$england"))
    }

    @Test
    fun mvsBindsToBase() {
        // 补充变体选择符（MVS，「葛󠄀」历史文本）：粘附基础汉字
        val withMvs = "葛" + String(Character.toChars(0xE0100))
        assertEquals(withMvs, tail(withMvs))
    }

    @Test
    fun plainLettersAroundZwjDoNotMerge() {
        // 普通字母夹 ZWJ：宿主退格只删尾字符（codex 二轮 P2-4）——b 单独
        // 弹出，a 保留给下一次。
        val (rest, unit) = BackGestureLedger.splitTailUnit("a‍b")!!
        assertEquals("b", unit)
        assertEquals("a‍", rest)
    }

    @Test
    fun zwjStaysWithItsUnitWhenNotEmoji() {
        // ZWJ 在普通字母后且下一字符非 emoji：不吞前缀
        val (rest, unit) = BackGestureLedger.splitTailUnit("你‍好")!!
        assertEquals("好", unit)
        assertEquals("你‍", rest)
    }

    @Test
    fun skinToneBindsToBase() {
        assertEquals("👍🏽", tail("👍🏽")) // U+1F44D + U+1F3FD
        assertEquals("👍🏽", tail("hi👍🏽"))
    }

    @Test
    fun variationSelectorBindsToBase() {
        assertEquals("✌️", tail("✌️")) // U+270C + U+FE0F
    }

    @Test
    fun keycapIsOneUnit() {
        assertEquals("1️⃣", tail("1️⃣")) // '1' + U+FE0F + U+20E3
    }

    @Test
    fun zwjFamilyIsOneUnit() {
        val family = "👨‍👩‍👧" // 3 emoji + 2 ZWJ
        assertEquals(family, tail(family))
        assertEquals(family, tail("前缀" + family))
    }

    @Test
    fun zwjWithSkinToneInside() {
        val couple = "👩🏽‍❤️‍👨🏻" // 混肤色+VS16+ZWJ 链
        assertEquals(couple, tail(couple))
    }

    @Test
    fun mixedSequenceDrainsInOrder() {
        // "字a😀🇨🇳👍🏽"：连续弹四次应得到 👍🏽 / 🇨🇳 / 😀 / a，最后剩 "字"
        var rest = "字a😀🇨🇳👍🏽"
        val drained = ArrayList<String>()
        while (true) {
            val (next, unit) = BackGestureLedger.splitTailUnit(rest) ?: break
            drained.add(unit)
            rest = next
        }
        assertEquals(listOf("👍🏽", "🇨🇳", "😀", "a", "字"), drained)
        assertTrue(rest.isEmpty())
    }

    @Test
    fun emptyOrNull() {
        assertNull(BackGestureLedger.splitTailUnit(""))
    }

    @Test
    fun restKeepsPrefixIntact() {
        val (rest, unit) = BackGestureLedger.splitTailUnit("你好😀")!!
        assertEquals("你好", rest)
        assertEquals("😀", unit)
        // rest 本身可继续弹
        assertEquals("好", BackGestureLedger.splitTailUnit(rest)!!.second)
    }
}
