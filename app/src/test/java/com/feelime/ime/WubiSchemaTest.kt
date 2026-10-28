package com.feelime.ime

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class WubiSchemaTest {
    @Test
    fun uniqueFourCodeCandidatesStaySelectableForMixedInput() {
        val schema = File("src/main/assets/engine-data/rime/feelime_wubi86.schema.yaml").readText()
        assertTrue(schema.contains("auto_select: false"))
        assertFalse(schema.contains("auto_select_pattern:"))
        assertTrue(schema.contains("max_code_length: 0"))
    }

    @Test
    fun shortCodesUseTableCompletionWithoutSentence() {
        val schema = File("src/main/assets/engine-data/rime/feelime_wubi86.schema.yaml").readText()
        assertTrue(schema.contains("enable_completion: true"))
        assertTrue(schema.contains("enable_sentence: false"))
    }

    @Test
    fun userFrequencyKeepsShortCodesPinnedAndDisablesAutoPhrases() {
        val schema = File("src/main/assets/engine-data/rime/feelime_wubi86.schema.yaml").readText()
        assertTrue(schema.contains("enable_user_dict: true"))
        assertTrue(schema.contains("enable_encoder: false"))
        assertTrue(schema.contains("encode_commit_history: false"))
        assertTrue(schema.contains("\"^[a-z]{1,2}$\""))
    }

    @Test
    fun sourceDictionaryStaysOutOfRuntimeAssets() {
        assertFalse(
            File("src/main/assets/engine-data/rime/wubi86.dict.yaml").exists(),
        )
    }
}
