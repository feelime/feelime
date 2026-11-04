package com.feelime.ime.engine

import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Test

class StableCandidateIdTest {
    @Test fun `candidate IDs retain original SHA256 bytes across repeated calls`() {
        for (page in 0..20) for (text in listOf("你好", "été", "я", "", "😀")) {
            val expected = MessageDigest.getInstance("SHA-256")
                .digest("rime\u0000$page\u00002\u0000$text".toByteArray())
                .take(8).joinToString("") { "%02x".format(it) }
            assertEquals(expected, stableCandidateId("rime", page, 2, text))
        }
    }
}
