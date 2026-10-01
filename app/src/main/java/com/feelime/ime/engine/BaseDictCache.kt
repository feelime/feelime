package com.feelime.ime.engine

import java.io.File
import java.security.MessageDigest
import java.util.Properties

/** 每槽的编译快照。清单最后写入；残缺、配置变化或内容损坏均不可激活。 */
internal object BaseDictCache {
    private const val MANIFEST = "cache.properties"
    fun owns(name: String): Boolean =
        (name.startsWith("luna_pinyin") || name.startsWith("double_pinyin") ||
            name.startsWith("ziranma_double_pinyin")) &&
            (name.endsWith(".bin") || name.endsWith(".schema.yaml"))

    fun sha(file: File): String = file.inputStream().use { input ->
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(65536)
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            digest.update(buffer, 0, n)
        }
        digest.digest().joinToString("") { "%02x".format(it) }
    }

    fun save(cache: File, build: File, key: String, state: Map<String, String>) {
        val temp = File(cache.parentFile, cache.name + ".tmp")
        temp.deleteRecursively()
        check(temp.mkdirs())
        try {
            val props = Properties()
            props.setProperty("key", key)
            state.forEach { (k, v) -> props.setProperty("state.$k", v) }
            build.listFiles().orEmpty().filter { it.isFile && owns(it.name) }.forEach {
                val copy = it.copyTo(File(temp, it.name))
                props.setProperty("file.${it.name}", sha(copy))
            }
            check(props.containsKey("file.luna_pinyin.table.bin"))
            check(props.containsKey("file.luna_pinyin.prism.bin"))
            File(temp, MANIFEST).outputStream().use { props.store(it, null) }
            check(cache.deleteRecursively())
            check(temp.renameTo(cache))
        } finally {
            temp.deleteRecursively()
        }
    }

    fun read(cache: File, key: String): Properties? = runCatching {
        val props = Properties().apply {
            File(cache, MANIFEST).inputStream().use { load(it) }
        }
        check(props.getProperty("key") == key)
        val names = props.stringPropertyNames().filter { it.startsWith("file.") }
        check("file.luna_pinyin.table.bin" in names && "file.luna_pinyin.prism.bin" in names)
        names.forEach {
            val name = it.removePrefix("file.")
            check('/' !in name && '\\' !in name && owns(name))
            check(sha(File(cache, name)) == props.getProperty(it))
        }
        props
    }.getOrNull()

    /** 先复制到临时目录并复核，成功后才替换运行目录，保留音形码表。 */
    fun restore(cache: File, build: File, key: String): Properties? {
        val props = read(cache, key) ?: return null
        val temp = File(build.parentFile, "base-cache-restore")
        temp.deleteRecursively()
        check(temp.mkdirs())
        try {
            props.stringPropertyNames().filter { it.startsWith("file.") }.forEach {
                val name = it.removePrefix("file.")
                val copy = File(cache, name).copyTo(File(temp, name))
                check(sha(copy) == props.getProperty(it))
            }
            build.mkdirs()
            build.listFiles().orEmpty().filter { owns(it.name) }.forEach { check(it.delete()) }
            temp.listFiles().orEmpty().forEach { check(it.renameTo(File(build, it.name))) }
            return props
        } finally {
            temp.deleteRecursively()
        }
    }
}
