package com.feelime.ime

import com.feelime.ime.engine.AssociationStore
import org.junit.Assert.assertEquals
import org.junit.Test

class AssociationStoreTest {
    @Test
    fun questionParticlePutsFullWidthQuestionMarkFirst() {
        assertEquals(
            listOf("？", "我", "你"),
            AssociationStore.addQuestionMarkCandidate("你好吗", listOf("我", "你")),
        )
    }

    @Test
    fun questionWordInsidePhraseAlsoSuggestsQuestionMark() {
        assertEquals(
            listOf("？", "名字"),
            AssociationStore.addQuestionMarkCandidate("你叫什么名字", listOf("名字")),
        )
    }

    @Test
    fun questionMarkIsAvailableWithoutBigramHits() {
        assertEquals(
            listOf("？"),
            AssociationStore.addQuestionMarkCandidate("是不是", emptyList()),
        )
    }

    @Test
    fun ordinaryStatementDoesNotGetQuestionMark() {
        assertEquals(
            listOf("的", "是"),
            AssociationStore.addQuestionMarkCandidate("我很好", listOf("的", "是")),
        )
    }

    @Test
    fun existingTerminalPunctuationIsNotDuplicated() {
        assertEquals(
            emptyList<String>(),
            AssociationStore.addQuestionMarkCandidate("你好吗？", emptyList()),
        )
    }

    @Test
    fun questionMarkDoesNotDuplicateOrExceedCandidateLimit() {
        val words = listOf("？") + (1..8).map { "词$it" }
        assertEquals(
            listOf("？") + (1..7).map { "词$it" },
            AssociationStore.addQuestionMarkCandidate("为什么", words),
        )
    }
}
