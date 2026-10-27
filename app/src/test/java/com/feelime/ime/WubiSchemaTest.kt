package com.feelime.ime

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class WubiSchemaTest {
    @Test
    fun dynamicLookupCodesAreExcludedFromUniqueAutoCommit() {
        val schema = File("src/main/assets/engine-data/rime/feelime_wubi86.schema.yaml").readText()
        assertTrue(schema.contains("auto_select_pattern:"))
        assertTrue(schema.contains("jjad"))
        assertTrue(schema.contains("jfuj"))
        assertTrue(schema.contains("jtad"))
    }

    @Test
    fun shortCodesUseTableCompletionWithoutSentence() {
        val schema = File("src/main/assets/engine-data/rime/feelime_wubi86.schema.yaml").readText()
        assertTrue(schema.contains("enable_completion: true"))
        assertTrue(schema.contains("enable_sentence: false"))
    }

    @Test
    fun sourceDictionaryStaysOutOfRuntimeAssets() {
        assertFalse(
            File("src/main/assets/engine-data/rime/wubi86.dict.yaml").exists(),
        )
    }
}
