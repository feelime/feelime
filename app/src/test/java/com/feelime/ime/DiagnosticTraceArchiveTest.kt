package com.feelime.ime

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream

class DiagnosticTraceArchiveTest {
    @get:Rule val temp = TemporaryFolder()

    @Test fun detectsOversizeWithoutCallingAnExactLimitTruncated() {
        for (size in 4..6) {
            val read = DiagnosticTraceArchive.read(ByteArrayInputStream(ByteArray(size) { 65 }), 5)
            assertEquals(minOf(size, 5), read.bytes.size)
            assertEquals(size > 5, read.truncated)
        }
    }

    @Test fun preservesPrintableProtobufAndLargerThanOldLimit() {
        // Tombstone build_fingerprint (field 2) with a printable value is a
        // valid protobuf whose printable ratio alone cannot identify text.
        val raw = byteArrayOf(0x12, 100) + ByteArray(100) { 'x'.code.toByte() }
        val dir = temp.newFolder()
        DiagnosticTraceArchive.save(dir, "tb-1-1.bin", DiagnosticTraceArchive.read(ByteArrayInputStream(raw)))
        assertArrayEquals(raw, DiagnosticTraceArchive.export(dir).attachments.single().bytes)
        val large = ByteArray(150_000) { (it % 256).toByte() }
        DiagnosticTraceArchive.save(dir, "tb-1-2.bin", DiagnosticTraceArchive.read(ByteArrayInputStream(large)))
        val exported = DiagnosticTraceArchive.export(dir).attachments.first { it.name == "tb-1-2.bin" }
        assertArrayEquals(large, exported.bytes)
        assertEquals("false", exported.truncated)
        assertEquals(64, exported.sha256.length)
    }

    @Test fun retainsThreeArtifactsAndExportsCompletenessAndBudgetOmissions() {
        val dir = temp.newFolder()
        for (i in 1..4) {
            DiagnosticTraceArchive.save(dir, "tb-1-$i.bin", DiagnosticTraceArchive.Trace(byteArrayOf(i.toByte()), i == 4))
            File(dir, "tb-1-$i.bin").setLastModified(i * 1000L)
        }
        assertFalse(File(dir, "tb-1-1.bin").exists())
        assertFalse(File(dir, "tb-1-1.bin.meta").exists())
        val all = DiagnosticTraceArchive.export(dir)
        assertEquals(3, all.attachments.size)
        assertEquals("true", all.attachments.first().truncated)
        val bounded = DiagnosticTraceArchive.export(dir, 1)
        assertEquals(1, bounded.attachments.size)
        assertEquals(2, bounded.omissions.size)
        assertTrue(bounded.omissions.all { it.contains("reason=budget") })
    }

    @Test fun legacyArtifactsHaveUnknownCompleteness() {
        val dir = temp.newFolder()
        File(dir, "tb-1-1.bin").writeBytes(byteArrayOf(1))
        assertEquals("unknown", DiagnosticTraceArchive.export(dir).attachments.single().truncated)
    }

    @Test(expected = IOException::class)
    fun doesNotTurnReadErrorsIntoApparentlyCompleteEvidence() {
        DiagnosticTraceArchive.read(object : InputStream() {
            override fun read(): Int = throw IOException("fixture")
        })
    }
}
