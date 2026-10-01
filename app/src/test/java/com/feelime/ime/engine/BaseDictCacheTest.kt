package com.feelime.ime.engine

import java.io.File
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Test

class BaseDictCacheTest {
    private fun withFiles(block: (File, File, File) -> Unit) {
        val root = Files.createTempDirectory("base-cache-test").toFile()
        try {
            val build = File(root, "build").apply { mkdirs() }
            File(build, "luna_pinyin.table.bin").writeText("table A")
            File(build, "luna_pinyin.prism.bin").writeText("prism A")
            File(build, "luna_pinyin_fuzzy_m3.prism.bin").writeText("fuzzy A")
            File(build, "luna_pinyin.schema.yaml").writeText("schema A")
            File(build, "flypy.table.bin").writeText("independent shape table")
            block(root, build, File(root, "compiled"))
        } finally { root.deleteRecursively() }
    }

    @Test fun switchRestoresMatchingProductsAndKeepsShapeTable() = withFiles { _, build, cache ->
        BaseDictCache.save(cache, build, "engine1", mapOf("name" to "词库 A"))
        assertFalse(File(cache, "flypy.table.bin").exists())
        File(build, "luna_pinyin.table.bin").writeText("table B")
        File(build, "luna_pinyin_fuzzy_m7.prism.bin").writeText("only B")
        val state = BaseDictCache.restore(cache, build, "engine1")!!
        assertEquals("词库 A", state.getProperty("state.name"))
        assertEquals("table A", File(build, "luna_pinyin.table.bin").readText())
        assertEquals("fuzzy A", File(build, "luna_pinyin_fuzzy_m3.prism.bin").readText())
        assertFalse(File(build, "luna_pinyin_fuzzy_m7.prism.bin").exists())
        assertEquals("independent shape table", File(build, "flypy.table.bin").readText())
    }

    @Test fun staleOrCorruptCacheDoesNotChangeActiveProducts() = withFiles { _, build, cache ->
        BaseDictCache.save(cache, build, "engine1", emptyMap())
        assertNull(BaseDictCache.restore(cache, build, "engine2"))
        // Same-size corruption must also be rejected.
        File(cache, "luna_pinyin.table.bin").writeText("table X")
        assertNull(BaseDictCache.restore(cache, build, "engine1"))
        assertEquals("table A", File(build, "luna_pinyin.table.bin").readText())
    }

    @Test fun incompleteSnapshotIsRejected() = withFiles { _, build, cache ->
        BaseDictCache.save(cache, build, "engine1", emptyMap())
        File(cache, "luna_pinyin.prism.bin").delete()
        assertNull(BaseDictCache.read(cache, "engine1"))
    }
}
