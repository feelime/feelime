package com.feelime.ime

import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest
import java.util.HashSet
import org.apache.commons.compress.archivers.ArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream

/**
 * Imports one of the model archives published by the manifest's upstream
 * project. The archive is accepted only when it contains every file declared
 * by the embedded model manifest and each file matches its expected byte size
 * and SHA-256. Unknown documentation/assets are ignored after their safe path
 * has been checked; this permits the official archives' extra files without
 * treating an arbitrary model as supported.
 *
 * Files are extracted into a staging directory. The caller switches the
 * staging directory into place only after this method returns successfully.
 */
internal class ModelArchiveImporter(
    private val maxArchiveBytes: Long = DEFAULT_MAX_ARCHIVE_BYTES,
    private val maxExpandedBytes: Long = DEFAULT_MAX_EXPANDED_BYTES,
    private val isCancelled: () -> Boolean = { false },
) {
    fun importArchive(
        input: InputStream,
        model: ModelSpec,
        stagingRoot: File,
        onStatus: (String) -> Unit = {},
    ) {
        require(model.verified) { "模型清单缺少完整校验信息" }
        require(maxArchiveBytes > 0 && maxExpandedBytes > 0) { "导入大小限制无效" }
        validateManifestPaths(model)
        stagingRoot.deleteRecursively()
        if (!stagingRoot.mkdirs() && !stagingRoot.isDirectory) {
            throw IOException("无法创建模型导入暂存目录")
        }
        val found = HashSet<String>()
        val names = HashSet<String>()
        var expandedBytes = 0L
        var entries = 0
        onStatus("reading")
        try {
            val limited = LimitedInputStream(input, maxArchiveBytes, ::checkCancelled)
            val buffered = BufferedInputStream(limited, BUFFER_SIZE)
            val magic = readMagic(buffered)
            onStatus("validating")
            when {
                magic[0] == 'B'.code.toByte() && magic[1] == 'Z'.code.toByte() -> {
                    BZip2CompressorInputStream(buffered, true).use { compressed ->
                        TarArchiveInputStream(compressed).use { archive ->
                            while (true) {
                                val entry = archive.nextEntry ?: break
                                val result = consumeEntry(
                                    input = archive,
                                    entry = entry,
                                    model = model,
                                    stagingRoot = stagingRoot,
                                    names = names,
                                    found = found,
                                    expandedBytes = expandedBytes,
                                    entryCount = ++entries,
                                )
                                expandedBytes = result.expandedBytes
                            }
                        }
                    }
                }
                magic[0] == 'P'.code.toByte() && magic[1] == 'K'.code.toByte() -> {
                    ZipArchiveInputStream(buffered).use { archive ->
                        while (true) {
                            val entry = archive.nextEntry ?: break
                            val result = consumeEntry(
                                input = archive,
                                entry = entry,
                                model = model,
                                stagingRoot = stagingRoot,
                                names = names,
                                found = found,
                                expandedBytes = expandedBytes,
                                entryCount = ++entries,
                                zipEntry = entry,
                            )
                            expandedBytes = result.expandedBytes
                        }
                    }
                }
                else -> throw IOException("只支持官方 tar.bz2 或 zip 模型归档")
            }
            if (found.size != model.files.size) {
                val missing = model.files
                    .filter { it.path !in found }
                    .joinToString(", ") { it.path.substringAfter('/') }
                throw IOException("归档缺少模型文件：$missing")
            }
            model.files.forEach { spec ->
                val file = File(stagingRoot, spec.path.substringAfter('/'))
                if (!file.isFile || file.length() != spec.bytes || sha256(file) != spec.sha256) {
                    throw IOException("模型文件校验失败：${spec.path}")
                }
            }
        } catch (failure: Exception) {
            stagingRoot.deleteRecursively()
            throw failure
        }
    }

    private data class ConsumeResult(val expandedBytes: Long)

    private fun consumeEntry(
        input: InputStream,
        entry: ArchiveEntry,
        model: ModelSpec,
        stagingRoot: File,
        names: MutableSet<String>,
        found: MutableSet<String>,
        expandedBytes: Long,
        entryCount: Int,
        zipEntry: ZipArchiveEntry? = null,
    ): ConsumeResult {
        checkCancelled()
        if (entryCount > MAX_ENTRIES) throw IOException("模型归档包含过多文件")
        val rawName = entry.name ?: throw IOException("归档条目没有名称")
        val name = normalizePath(rawName, entry.isDirectory)
        if (!names.add(name)) throw IOException("归档包含重复条目：$name")
        val tarLink = (entry as? TarArchiveEntry)?.let {
            it.isSymbolicLink || it.isLink
        } == true
        if (zipEntry?.isUnixSymlink == true || tarLink) {
            throw IOException("归档包含不支持的链接：$name")
        }
        if (!entry.isDirectory) {
            val tarSpecial = (entry as? TarArchiveEntry)?.isFile == false
            val zipMode = zipEntry?.unixMode ?: 0
            val zipSpecial = zipMode != 0 && (zipMode and 0xF000) != 0x8000
            if (tarSpecial || zipSpecial) throw IOException("归档包含不支持的特殊文件：$name")
        }
        // ZIP entries written with DEFLATED + a data descriptor commonly do
        // not expose their size in the local header.  Commons Compress then
        // reports -1 here; the entry stream itself is still bounded by the
        // next-entry marker, so count bytes while consuming it below.
        val declaredSize = entry.size
        if (declaredSize > MAX_ENTRY_BYTES ||
            (declaredSize >= 0L && declaredSize > maxExpandedBytes - expandedBytes)
        ) {
            throw IOException("归档条目过大：$name")
        }
        val spec = if (entry.isDirectory) null else matchingSpec(name, model)
        if (spec != null) {
            if (!found.add(spec.path)) throw IOException("归档包含重复模型文件：${spec.path}")
            if (spec.bytes > MAX_ENTRY_BYTES || spec.bytes > maxExpandedBytes - expandedBytes) {
                throw IOException("模型文件超出导入限制：${spec.path}")
            }
            if (declaredSize >= 0L && declaredSize != spec.bytes) {
                throw IOException("模型归档条目大小不匹配：$name")
            }
            val destination = File(stagingRoot, spec.path.substringAfter('/'))
            destination.parentFile?.mkdirs()
            FileOutputStream(destination).use { output ->
                if (declaredSize >= 0L) copyExact(input, output, spec.bytes)
                else copyUnknown(input, output, spec.bytes)
            }
            // With a declared size, one extra byte proves the entry does not
            // match the manifest.  For a data-descriptor ZIP, copyUnknown
            // reaches the entry boundary itself and has already checked the
            // exact expected size.
            if (declaredSize >= 0L && input.read() >= 0) {
                throw IOException("模型归档条目大小不匹配：$name")
            }
            val actualSize = spec.bytes
            if (actualSize > maxExpandedBytes - expandedBytes) {
                throw IOException("归档解压总大小超过限制")
            }
            return ConsumeResult(expandedBytes + actualSize)
        } else {
            val discarded = if (entry.isDirectory) 0L else if (declaredSize >= 0L) {
                discard(input, declaredSize)
                declaredSize
            } else {
                discardUnknown(input, expandedBytes)
            }
            if (discarded > maxExpandedBytes - expandedBytes) {
                throw IOException("归档解压总大小超过限制")
            }
            return ConsumeResult(expandedBytes + discarded)
        }
    }

    private fun matchingSpec(name: String, model: ModelSpec): ModelFileSpec? {
        val candidates = model.files.filter { spec ->
            val localName = spec.path.substringAfter('/')
            val upstreamName = spec.downloadPath.substringAfterLast('/')
            // gzip 存放的文件（downloadPath 以 .gz 结尾）在官方归档里的条目
            // 仍是原始名：.gz 只是 distribution 附件口径，不改变上游 tar 布局。
            val upstreamRaw = upstreamName.removeSuffix(".gz")
            name == spec.path || name == localName || name == upstreamName || name == upstreamRaw ||
                name.endsWith("/$localName") || name.endsWith("/$upstreamName") ||
                name.endsWith("/$upstreamRaw")
        }
        return when {
            candidates.isEmpty() -> null
            candidates.size == 1 -> candidates.single()
            else -> throw IOException("归档条目匹配多个模型文件：$name")
        }
    }

    private fun validateManifestPaths(model: ModelSpec) {
        val top = model.dir
        model.files.forEach { spec ->
            val path = spec.path
            if (path.isEmpty() || path.startsWith('/') || path.contains('\\') ||
                path.split('/').any { it.isEmpty() || it == "." || it == ".." } ||
                !path.startsWith("$top/")
            ) throw IOException("模型清单路径不安全：$path")
        }
    }

    private fun normalizePath(raw: String, directory: Boolean): String {
        val path = if (directory && raw.endsWith('/')) raw.dropLast(1) else raw
        if (path.isEmpty() || path.length > MAX_PATH_LENGTH || path.indexOf('\u0000') >= 0 ||
            path.startsWith('/') || path.contains('\\') || path.matches(DRIVE_PATH) ||
            path.split('/').any { it.isEmpty() || it == "." || it == ".." }
        ) throw IOException("归档包含不安全路径：$raw")
        return path
    }

    private fun copyExact(input: InputStream, output: FileOutputStream, expected: Long) {
        var remaining = expected
        var total = 0L
        val buffer = ByteArray(BUFFER_SIZE)
        while (remaining > 0) {
            checkCancelled()
            val count = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
            if (count < 0) throw IOException("模型归档条目内容提前结束")
            if (count == 0) continue
            output.write(buffer, 0, count)
            remaining -= count
            total += count
        }
        if (total != expected) throw IOException("模型归档条目大小不匹配")
    }

    /** Consume a ZIP data-descriptor entry whose uncompressed size was not
     * present in its local header.  End-of-entry is represented by -1 from
     * the archive stream, so the exact manifest size is checked as bytes
     * arrive and no extra byte needs to be pushed back. */
    private fun copyUnknown(input: InputStream, output: FileOutputStream, expected: Long) {
        var total = 0L
        val buffer = ByteArray(BUFFER_SIZE)
        while (true) {
            checkCancelled()
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) continue
            total += count
            if (total > expected) throw IOException("模型归档条目大小不匹配")
            output.write(buffer, 0, count)
        }
        if (total != expected) throw IOException("模型归档条目大小不匹配")
    }

    private fun discard(input: InputStream, size: Long) {
        var remaining = size
        val buffer = ByteArray(BUFFER_SIZE)
        while (remaining > 0) {
            checkCancelled()
            val count = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
            if (count < 0) throw IOException("归档条目内容提前结束")
            if (count == 0) continue
            remaining -= count
        }
    }

    private fun discardUnknown(input: InputStream, expandedBytes: Long): Long {
        var total = 0L
        val buffer = ByteArray(BUFFER_SIZE)
        while (true) {
            checkCancelled()
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) continue
            total += count
            if (total > MAX_ENTRY_BYTES || total > maxExpandedBytes - expandedBytes) {
                throw IOException("归档解压总大小超过限制")
            }
        }
        return total
    }

    private fun readMagic(input: BufferedInputStream): ByteArray {
        input.mark(4)
        val magic = ByteArray(4)
        var offset = 0
        while (offset < magic.size) {
            val count = input.read(magic, offset, magic.size - offset)
            if (count < 0) break
            offset += count
        }
        input.reset()
        if (offset < 2) throw IOException("模型归档内容为空")
        return magic
    }

    private fun checkCancelled() {
        if (isCancelled()) throw ModelDownloadCancelled()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(BUFFER_SIZE)
            while (true) {
                checkCancelled()
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private class LimitedInputStream(
        private val delegate: InputStream,
        private val limit: Long,
        private val check: () -> Unit,
    ) : InputStream() {
        private var count = 0L

        override fun read(): Int {
            check()
            if (count >= limit) throw IOException("导入归档超过大小限制")
            val value = delegate.read()
            if (value >= 0) count++
            return value
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            check()
            if (count >= limit) throw IOException("导入归档超过大小限制")
            val allowed = minOf(length.toLong(), limit - count).toInt()
            val read = delegate.read(buffer, offset, allowed)
            if (read > 0) count += read
            return read
        }

        override fun close() = delegate.close()
    }

    private companion object {
        const val BUFFER_SIZE = 64 * 1024
        const val MAX_ENTRIES = 10_000
        const val MAX_PATH_LENGTH = 512
        const val MAX_ENTRY_BYTES = 512L * 1024L * 1024L
        const val DEFAULT_MAX_ARCHIVE_BYTES = 1L * 1024L * 1024L * 1024L
        const val DEFAULT_MAX_EXPANDED_BYTES = 768L * 1024L * 1024L
        val DRIVE_PATH = Regex("^[A-Za-z]:.*")
    }
}
