package com.feelime.ime

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.security.MessageDigest

/** 原始 trace 的保存不依赖格式猜测；有界读取同时探测截断。 */
internal object DiagnosticTraceArchive {
    const val MAX_TRACE_BYTES = 2 * 1024 * 1024
    const val EXPORT_BYTES = 3 * MAX_TRACE_BYTES
    data class Trace(val bytes: ByteArray, val truncated: Boolean)
    data class Attachment(val name: String, val bytes: ByteArray, val sha256: String, val truncated: String)
    data class Export(val attachments: List<Attachment>, val omissions: List<String>)

    fun read(input: InputStream, limit: Int = MAX_TRACE_BYTES): Trace {
        require(limit > 0)
        val output = ByteArrayOutputStream()
        val chunk = ByteArray(minOf(limit, 16 * 1024))
        while (output.size() < limit) {
            val count = input.read(chunk, 0, minOf(chunk.size, limit - output.size()))
            if (count < 0) return Trace(output.toByteArray(), false)
            if (count == 0) {
                val single = input.read()
                if (single < 0) return Trace(output.toByteArray(), false)
                output.write(single)
            } else output.write(chunk, 0, count)
        }
        return Trace(output.toByteArray(), input.read() >= 0)
    }

    private fun digest(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }

    fun save(dir: File, name: String, trace: Trace) {
        require(name.startsWith("tb-") && name.endsWith(".bin") && !name.contains('/'))
        dir.mkdirs()
        val file = File(dir, name)
        val temp = File(dir, "$name.tmp")
        temp.writeBytes(trace.bytes)
        check(temp.renameTo(file)) { "trace rename failed" }
        File(dir, "$name.meta").writeText("truncated=${trace.truncated}\nsha256=${digest(trace.bytes)}\n")
        files(dir).drop(3).forEach { old -> old.delete(); File(dir, "${old.name}.meta").delete() }
    }

    private fun files(dir: File): List<File> = dir.listFiles().orEmpty()
        .filter { it.isFile && it.name.startsWith("tb-") && it.name.endsWith(".bin") }
        .sortedWith(compareByDescending<File> { it.lastModified() }.thenByDescending { it.name })

    fun export(dir: File, budget: Int = EXPORT_BYTES): Export {
        val attachments = mutableListOf<Attachment>()
        val omissions = mutableListOf<String>()
        var used = 0L
        for (file in files(dir)) {
            if (file.length() > budget.toLong() - used) {
                omissions.add("${file.name} omitted reason=budget bytes=${file.length()}")
                continue
            }
            runCatching {
                val bytes = file.readBytes()
                check(bytes.size <= budget.toLong() - used) { "trace grew past budget" }
                val truncated = runCatching { File(dir, "${file.name}.meta").readLines() }
                    .getOrNull()?.firstOrNull { it.startsWith("truncated=") }?.substringAfter('=') ?: "unknown"
                attachments.add(Attachment(file.name, bytes, digest(bytes), truncated))
                used += bytes.size
            }.onFailure { omissions.add("${file.name} omitted reason=read ${it.javaClass.simpleName}") }
        }
        return Export(attachments, omissions)
    }
}
