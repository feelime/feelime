package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Test

class EnglishTextNormalizerTest {
    @Test
    fun restoresCommonEnglishContractions() {
        assertEquals("what's your name", EnglishTextNormalizer.normalize("WHATS YOUR NAME"))
        assertEquals(
            "i'm fine and i don't know",
            EnglishTextNormalizer.normalize("I M FINE AND I DONT KNOW"),
        )
    }

    @Test
    fun preservesChineseWhileNormalizingEnglish() {
        assertEquals(
            "今天是 monday tomorrow 是星期二",
            EnglishTextNormalizer.normalize("今天是 MONDAY TOMORROW 是星期二"),
        )
    }

    @Test
    fun keepsQuestionMarksButNeverEndsWithAPeriod() {
        // 语音结果默认不加句号收尾；标点模型给的句尾句号也剥掉。
        assertEquals("what's your name?", EnglishTextNormalizer.ensureTerminalPunctuation("what's your name"))
        assertEquals("hello world", EnglishTextNormalizer.ensureTerminalPunctuation("hello world"))
        assertEquals("hello world", EnglishTextNormalizer.ensureTerminalPunctuation("hello world."))
        assertEquals("今天天气不错", EnglishTextNormalizer.ensureTerminalPunctuation("今天天气不错。"))
        assertEquals("ok", EnglishTextNormalizer.ensureTerminalPunctuation("ok ."))
        assertEquals("你叫什么名字吗？", EnglishTextNormalizer.ensureTerminalPunctuation("你叫什么名字吗"))
        // 问号/叹号/省略号自带语义，保留。
        assertEquals("真的吗？", EnglishTextNormalizer.ensureTerminalPunctuation("真的吗？"))
        assertEquals("等等…", EnglishTextNormalizer.ensureTerminalPunctuation("等等…"))
    }

    @Test
    fun collapsesSpacingAroundPunctuationBetweenDigits() {
        // 标点模型把 ITN 产物 1.23 排成 "1 . 23"（英文标点空格习惯）。
        assertEquals("1.23", EnglishTextNormalizer.normalizeDigitPunctSpacing("1 . 23"))
        assertEquals("价格是1.5元", EnglishTextNormalizer.normalizeDigitPunctSpacing("价格是1 . 5元"))
        // 环视不消费右侧数字：链式一次压净。
        assertEquals("1.2.3", EnglishTextNormalizer.normalizeDigitPunctSpacing("1 . 2 . 3"))
        assertEquals("1,234", EnglishTextNormalizer.normalizeDigitPunctSpacing("1 , 234"))
        // 句尾句点、数字外标点、普通空格不动。
        assertEquals("ok .", EnglishTextNormalizer.normalizeDigitPunctSpacing("ok ."))
        assertEquals("hello , world", EnglishTextNormalizer.normalizeDigitPunctSpacing("hello , world"))
        assertEquals("共 3 项", EnglishTextNormalizer.normalizeDigitPunctSpacing("共 3 项"))
    }
}
