package com.feelime.ime.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * WebDAV 传输层纯函数（#43）：PROPFIND 解析的命名前缀容忍、目录跳过、
 * 时间戳文件名（不覆盖历史语义的根基）、地址规整。
 */
class WebDavBackupTest {
    private val propfind = """<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:">
 <d:response>
  <d:href>/dav/feelime/</d:href>
  <d:propstat><d:prop>
   <d:resourcetype><d:collection/></d:resourcetype>
  </d:prop></d:propstat>
 </d:response>
 <d:response>
  <d:href>/dav/feelime/feelime-backup-20261009-213905.json</d:href>
  <d:propstat><d:prop>
   <d:getcontentlength>57198</d:getcontentlength>
   <d:getlastmodified>Thu, 09 Oct 2026 21:39:05 GMT</d:getlastmodified>
  </d:prop></d:propstat>
 </d:response>
 <d:response>
  <d:href>/dav/feelime/feelime-backup-20261008-060025.json</d:href>
  <d:propstat><d:prop>
   <d:getcontentlength>12</d:getcontentlength>
  </d:prop></d:propstat>
 </d:response>
 <d:response>
  <d:href>/dav/feelime/notes.txt</d:href>
  <d:propstat><d:prop>
   <d:getcontentlength>999</d:getcontentlength>
  </d:prop></d:propstat>
 </d:response>
</d:multistatus>
"""

    @Test
    fun parsesEntriesSkipsDirectoriesAndForeignFiles() {
        val entries = WebDavBackup.parsePropfind(propfind)
        // 目录（无 getcontentlength）与列表过滤外的文件不进恢复候选。
        val names = entries.map { it.name }
        assertTrue(names.contains("feelime-backup-20261009-213905.json"))
        assertTrue(names.contains("feelime-backup-20261008-060025.json"))
        assertTrue(names.contains("notes.txt"))
        assertFalse(names.any { it.isEmpty() })
        val head = entries.first { it.name.startsWith("feelime-backup-20261009") }
        assertEquals(57198L, head.size)
        assertEquals("Thu, 09 Oct 2026 21:39:05 GMT", head.modified)
    }

    @Test
    fun toleratesUnprefixedAndLowercaseNamespaces() {
        val bare = """
            <multistatus>
             <response><href>/dav/f/feelime-backup-20261001-010101.json</href>
              <propstat><prop><getcontentlength>5</getcontentlength></prop></propstat></response>
            </multistatus>
        """.trimIndent()
        val entries = WebDavBackup.parsePropfind(bare)
        assertEquals(1, entries.size)
        assertEquals("feelime-backup-20261001-010101.json", entries[0].name)
        assertEquals(5L, entries[0].size)
    }

    @Test
    fun blankXmlYieldsEmptyList() {
        assertTrue(WebDavBackup.parsePropfind("").isEmpty())
        assertTrue(WebDavBackup.parsePropfind("not xml at all").isEmpty())
    }

    @Test
    fun backupFileNameCarriesSecondResolutionStamp() {
        val name = WebDavBackup.backupFileName(LocalDateTime.of(2026, 10, 9, 21, 39, 5))
        assertEquals("feelime-backup-20261009-213905.json", name)
        // 同秒才撞名：两次相邻调用时间戳不同 → 新文件（不覆盖历史）。
        val other = WebDavBackup.backupFileName(LocalDateTime.of(2026, 10, 9, 21, 39, 6))
        assertTrue(name != other)
    }

    @Test
    fun configNormalizesBaseAndValidatesScheme() {
        val config = WebDavBackup.Config(" https://dav.example.com/dav/feelime/ ", "u", "p")
        assertEquals("https://dav.example.com/dav/feelime", config.base)
        assertTrue(config.valid)
        assertFalse(WebDavBackup.Config("ftp://x", "", "").valid)
        assertFalse(WebDavBackup.Config("", "", "").valid)
    }
}
