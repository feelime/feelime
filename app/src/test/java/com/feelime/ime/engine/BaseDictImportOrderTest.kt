package com.feelime.ime.engine

import java.io.File
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * import_tables 顺序（rime「重复词条靠前的表先到先得」）。
 *
 * 真机反例：雾凇 41448 大字表（46055 行零权重）被 listFiles() 排到
 * 8105 字表（8765 行全带权重）前面，常用词条频全被空权重顶成
 * log(DBL_EPSILON)≈-708，`niuiuabima` 造句出「…是啥蓖麻」而非
 * 「你是傻逼吗」。这里钉住「带权重的表在前 + 与文件系统顺序无关」。
 */
class BaseDictImportOrderTest {

    private val dir = Files.createTempDirectory("import-order").toFile()

    private fun table(name: String, vararg rows: String): File =
        File(dir, name).apply {
            deleteOnExit()
            writeText(buildString {
                append("# Rime dictionary\n---\nname: ${name.removeSuffix(".dict.yaml")}\n")
                append("version: \"1\"\nsort: by_weight\n...\n")
                rows.forEach { append(it).append('\n') }
            })
        }

    @Test
    fun weightlessTableSortsAfterWeightedOne() {
        // 41448 形态（无权重）在前也会被挪到 8105 形态（有权重）之后。
        val bare = table("41448.dict.yaml", "吖\ta", "你\tni")
        val weighted = table("8105.dict.yaml", "这\tzhei\t17648808", "你\tni\t1422192")
        val ordered = BaseDictInstaller.orderImportTables(listOf(bare, weighted))
        assertEquals(listOf(weighted, bare), ordered)
        // 反向输入结果一致——顺序由内容决定，与文件系统无关。
        assertEquals(ordered, BaseDictInstaller.orderImportTables(listOf(weighted, bare)))
    }

    @Test
    fun sameWeightClassKeepsFileNameOrder() {
        val a = table("base.dict.yaml", "啊\ta a\t100")
        val b = table("ext.dict.yaml", "啊啊\ta a a\t100")
        val c = table("radical_pinyin.dict.yaml", "的\tbai'shao\t40529")
        assertEquals(
            listOf(a, b, c),
            BaseDictInstaller.orderImportTables(listOf(c, a, b)),
        )
    }

    @Test
    fun singleTablePassesThrough() {
        val only = table("only.dict.yaml", "你\tni\t1")
        assertEquals(listOf(only), BaseDictInstaller.orderImportTables(listOf(only)))
        assertEquals(
            emptyList<File>(),
            BaseDictInstaller.orderImportTables(emptyList()),
        )
    }

    @Test
    fun commentsAndHeaderDoNotCountAsWeight() {
        // 注释里的「\t」第三段不算权重，否则全表会被误判成带权重。
        val commented = table(
            "commented.dict.yaml",
            "# 说明\t带\t三段\t的注释行",
            "你\tni",
            "好\thao",
        )
        val weighted = table("8105.dict.yaml", "你\tni\t1")
        assertFalse(BaseDictInstaller.hasExplicitWeight(commented))
        assertTrue(BaseDictInstaller.hasExplicitWeight(weighted))
        assertEquals(
            listOf(weighted, commented),
            BaseDictInstaller.orderImportTables(listOf(commented, weighted)),
        )
    }

    @Test
    fun emptyThirdColumnIsNotAWeight() {
        // 两列行 + 空第三列（`你\tni\t`）都算无权重。
        val trailing = table("trailing.dict.yaml", "你\tni\t", "好\thao")
        assertFalse(BaseDictInstaller.hasExplicitWeight(trailing))
    }

    @Test
    fun missingFileIsTreatedAsWeightless() {
        // 读失败退化成纯文件名序，不抛、不改其它表的相对关系。
        val missing = File(dir, "aaa_missing.dict.yaml")
        val weighted = table("8105.dict.yaml", "你\tni\t1")
        assertFalse(BaseDictInstaller.hasExplicitWeight(missing))
        assertEquals(
            listOf(weighted, missing),
            BaseDictInstaller.orderImportTables(listOf(missing, weighted)),
        )
    }
}
