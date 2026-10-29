package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AsrHotwordsTest {
    private val tokens = File("src/modelAssets/full/asr-model/tokens.txt").readBytes()
    private val bpe = File("src/main/assets/asr-hotwords/bpe.vocab").readBytes()
    private val vocab = tokens.decodeToString().lines().map { it.substringBefore(' ') }.toSet()

    @Test fun rawMixedPhrasesReachNativeWithoutDoubleEncoding() {
        assertEquals("你好/HELLO/NEW YORK/GPU模式",
            AsrHotwords.encodeWords(listOf("你好", "hello", "New   York", "GPU模式"), vocab).streamText)
        assertEquals("", AsrHotwords.encodeWords(emptyList(), vocab).streamText)
        assertEquals("HELLO", AsrHotwords.encodeWords(listOf("hello", "HELLO"), vocab).streamText)
    }

    @Test fun unsupportedInputCannotEnterNativeProtocolParser() {
        for (word in listOf("你好/世界", "hello :99", "hello/#/world", "a\nb", "<unk>", "⌘⌥", "😀")) {
            assertThrows(IllegalArgumentException::class.java) { AsrHotwords.encodeWords(listOf(word), vocab) }
        }
    }

    @Test fun actualVocabularyAndShippedTokenizerMustMatchPinnedModel() {
        AsrHotwords.verifyResources(bpe, tokens)
        assertThrows(IllegalStateException::class.java) { AsrHotwords.verifyResources(bpe + 0, tokens) }
        assertThrows(IllegalStateException::class.java) { AsrHotwords.verifyResources(bpe, tokens + 0) }
    }

    @Test fun finalCorrectionIsPreservedWhenNoRecognizedHotwordIsLost() {
        assertEquals("你好，世界", AsrHotwords.selectFinalText("你好世介", "你好，世界", emptyList()))
        assertEquals("你好，世界", AsrHotwords.selectFinalText("你好世介", "你好，世界", listOf("微软")))
        assertEquals("New York is nice.", AsrHotwords.selectFinalText("NEWYORK IS NICE", "New York is nice.", listOf("NEW YORK")))
        assertEquals("使用语音识别。", AsrHotwords.selectFinalText("使用语 音识别", "使用语音识别。", listOf("语音识别")))
    }

    @Test fun recognizedHotwordSurvivesDestructiveFinalPass() {
        assertEquals("今天是礼拜二", AsrHotwords.selectFinalText("今天是礼拜二", "今天是李白二", listOf("礼拜")))
        assertEquals("NEW YORK IS NICE", AsrHotwords.selectFinalText("NEW YORK IS NICE", "New work is nice.", listOf("NEW YORK")))
        assertEquals("你好", AsrHotwords.selectFinalText("你好", "", listOf("你好")))
    }

    @Test fun latinWordFragmentsDoNotSuppressFinalCorrection() {
        assertEquals("The cathedral is old.", AsrHotwords.selectFinalText("THE CATHEDRAL IS OLD", "The cathedral is old.", listOf("CAT")))
        assertEquals("Categorize this.", AsrHotwords.selectFinalText("CATALOG THIS", "Categorize this.", listOf("CAT")))
    }

    @Test fun perWordWeightsSerializeIntoStreamProtocol() {
        val vocab = File("src/modelAssets/full/asr-model/tokens.txt").readBytes()
            .decodeToString().lineSequence().map { it.substringBefore(' ') }.toSet()
        val encoded = AsrHotwords.encodeWords(listOf("姚程:15", "星期一", "New York:7.5", "GPU : 2"), vocab)
        assertEquals("姚程 :15/星期一/NEW YORK :7.5/GPU :2", encoded.streamText)
        assertEquals(listOf("姚程", "星期一", "NEW YORK", "GPU"), encoded.phrases)
        // 05/5.0 规范化输出；同词同权重去重
        val normalized = AsrHotwords.encodeWords(listOf("姚程:05", "姚程 :5.0"), vocab)
        assertEquals("姚程 :5", normalized.streamText)
    }

    @Test fun weightedHotwordStillMatchesPlainPhraseInFinalPass() {
        // 权重条目的纯词形态仍参与终稿保留（双产物同一解析）
        assertEquals("姚程明天来开会", AsrHotwords.selectFinalText(
            "姚程明天来开会", "姚城明天来开会。", listOf("姚程")))
    }

    @Test fun hotweightSyntaxRejectsBadLines() {
        for (line in listOf("姚程:0", "姚程:21", "姚程:-1", "姚程:999", "姚程:", ":15",
                            "姚程:abc", "姚程:5:6", "姚程:1e1", "姚程:+5", "姚程:.5",
                            "姚程:5abc", "姚程：15")) {
            assertThrows(IllegalArgumentException::class.java) {
                AsrHotwords.parseHotwordLines(listOf(line))
            }
        }
        // 合法边界：1、20、一位小数
        AsrHotwords.parseHotwordLines(listOf("姚程:1", "星期一 :20", "GPU:7.5"))
    }

    @Test fun hotweightConflictsAndLimitsReportOriginalLines() {
        val conflict = assertThrows(IllegalArgumentException::class.java) {
            AsrHotwords.parseHotwordLines(listOf("姚程:5", "别的词", "姚程:8"))
        }
        assertTrue(conflict.message!!.contains("第 3 行"))
        val full = assertThrows(IllegalArgumentException::class.java) {
            AsrHotwords.parseHotwordLines(List(51) { "词$it" })
        }
        assertTrue(full.message!!.contains("最多"))
        val long = assertThrows(IllegalArgumentException::class.java) {
            AsrHotwords.parseHotwordLines(listOf("a".repeat(31)))
        }
        assertTrue(long.message!!.contains("第 1 行"))
    }
}
