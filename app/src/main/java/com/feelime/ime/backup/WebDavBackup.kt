package com.feelime.ime.backup

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/**
 * WebDAV 云端备份传输层（issue #43，2026-10-09）。
 *
 * WebDAV 就是 HTTP 加几个动词（PUT 写 / GET 读 / PROPFIND 列目录），
 * [HttpURLConnection] 直写、零新依赖。Basic 认证——Digest-only 的服务
 * 器 v1 不支持（UI 文案提示）。纯传输层：组包与恢复仍走 [UserdataBackup]，
 * 语义与本地导入导出完全一致。
 *
 * 用户裁定的两条硬语义（2026-10-09）：
 * 1. 备份不覆盖历史——文件名带时间戳（[backupFileName]）；
 * 2. 恢复前列出远端备份让用户挑（[list]，UI 逐条出恢复按钮）。
 *
 * 凭据存设备私有 prefs（`webdav_backup`），**不进备份包**——备份 JSON
 * 用户可手工编辑/转发，密码不能随之旅行（UserdataBackup.PREFS_FILES
 * 白名单不含它）。
 */
object WebDavBackup {
    /** 备份文件名前缀（列目录时按它过滤，忽略服务器上其它文件）。 */
    const val FILE_PREFIX = "feelime-backup-"
    private const val CONNECT_TIMEOUT_MS = 10_000
    private const val READ_TIMEOUT_MS = 30_000
    /** GET 的有界读取（与本地导入 MAX_BACKUP_BYTES 同量级，防内存炸弹）。 */
    const val MAX_GET_BYTES = 64L * 1024 * 1024

    data class Config(val url: String, val user: String, val password: String) {
        /** 地址规整：去空白、去尾斜杠——列表/上传的 URL 拼接统一走它。 */
        val base: String get() = url.trim().trimEnd('/')
        val valid: Boolean get() = base.startsWith("http://") || base.startsWith("https://")
        val isHttp get() = base.startsWith("http://")
    }

    data class Entry(val name: String, val size: Long, val modified: String)

    sealed class Outcome<out T> {
        data class Ok<out T>(val value: T) : Outcome<T>()
        data class Fail(val code: String, val detail: String = "") : Outcome<Nothing>()
    }

    /** 单次 HTTP 往返的统一产物：状态码 + 消息 + 响应体（PROPFIND 用）。 */
    private data class Response(val code: Int, val message: String, val body: ByteArray?)

    /** 时间戳文件名（本地时区，秒级——同秒两次备份才可能撞名，撞名即
     *  PUT 覆盖同文件，语义可接受）。 */
    fun backupFileName(now: java.time.LocalDateTime = java.time.LocalDateTime.now()): String {
        val stamp = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(now)
        return "$FILE_PREFIX$stamp.json"
    }

    /** 连接性/凭据探测：PROPFIND Depth 0。207/200 视为可达且认证通过。 */
    fun test(config: Config): Outcome<Boolean> = interpret(config, "PROPFIND", "", depth = "0") { resp ->
        when (resp.code) {
            207, 200 -> Outcome.Ok(true)
            else -> null
        }
    }

    /** 上传一份备份（PUT，新时间戳文件名，不覆盖历史）。 */
    fun put(config: Config, name: String, bytes: ByteArray): Outcome<String> =
        exchange(config, "PUT", name, body = bytes).let { outcome ->
            when (outcome) {
                is Outcome.Ok -> if (outcome.value.code in 200..299) Outcome.Ok(name)
                else Outcome.Fail("HTTP_${outcome.value.code}", outcome.value.message)
                is Outcome.Fail -> outcome
            }
        }

    /** 列出远端备份（PROPFIND Depth 1 + 前缀过滤，按文件名倒序=最新在前）。 */
    fun list(config: Config): Outcome<List<Entry>> {
        val outcome = exchange(config, "PROPFIND", "", depth = "1")
        return when (outcome) {
            is Outcome.Fail -> outcome
            is Outcome.Ok -> when (outcome.value.code) {
                207, 200 -> Outcome.Ok(
                    parsePropfind(outcome.value.body?.toString(Charsets.UTF_8) ?: "")
                        .filter { it.name.startsWith(FILE_PREFIX) && it.name.endsWith(".json") }
                        .sortedByDescending { it.name })
                401, 403 -> Outcome.Fail("AUTH", outcome.value.message)
                else -> Outcome.Fail("HTTP_${outcome.value.code}", outcome.value.message)
            }
        }
    }

    /** 下载一份备份（有界读取，[MAX_GET_BYTES]）。 */
    fun get(config: Config, name: String): Outcome<ByteArray> {
        val outcome = exchange(config, "GET", name, maxBody = MAX_GET_BYTES)
        return when (outcome) {
            is Outcome.Fail -> outcome
            is Outcome.Ok -> when (outcome.value.code) {
                200 -> Outcome.Ok(outcome.value.body ?: ByteArray(0))
                401, 403 -> Outcome.Fail("AUTH", outcome.value.message)
                404 -> Outcome.Fail("NOT_FOUND", outcome.value.message)
                else -> Outcome.Fail("HTTP_${outcome.value.code}", outcome.value.message)
            }
        }
    }

    /** 把状态码翻译成失败码（test/list/get 共用口径）。 */
    private inline fun <T> interpret(
        config: Config,
        method: String,
        name: String,
        depth: String? = null,
        map: (Response) -> Outcome<T>?,
    ): Outcome<T> {
        val outcome = exchange(config, method, name, depth = depth)
        return when (outcome) {
            is Outcome.Fail -> outcome
            is Outcome.Ok -> map(outcome.value) ?: when (outcome.value.code) {
                401, 403 -> Outcome.Fail("AUTH", outcome.value.message)
                404 -> Outcome.Fail("NOT_FOUND", outcome.value.message)
                405 -> Outcome.Fail("NO_DAV", outcome.value.message)
                else -> Outcome.Fail("HTTP_${outcome.value.code}", outcome.value.message)
            }
        }
    }

    /** HTTP 往返公共壳：认证头/超时/动词/请求体；响应体流式有界读回
     *  （[maxBody] 判 Content-Length 头 + 实读双重防线，防超大响应
     *  撑爆内存——GET 下载路径的安全闸）。 */
    private fun exchange(
        config: Config,
        method: String,
        name: String,
        depth: String? = null,
        body: ByteArray? = null,
        maxBody: Long = 4L * 1024 * 1024,
    ): Outcome<Response> {
        return try {
        val target = if (name.isEmpty()) config.base
            else config.base + "/" + java.net.URLEncoder.encode(name, "UTF-8")
        val conn = URL(target).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = CONNECT_TIMEOUT_MS
        conn.readTimeout = READ_TIMEOUT_MS
        conn.setRequestProperty("Authorization", basicAuth(config))
        conn.setRequestProperty("User-Agent", "feelime-backup/1")
        depth?.let { conn.setRequestProperty("Depth", it) }
        body?.let {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(it.size)
            conn.outputStream.use { output -> output.write(it) }
        }
        val code = conn.responseCode
        val message = runCatching { conn.responseMessage ?: "" }.getOrDefault("").take(80)
        val declared = conn.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L
        if (declared > maxBody) {
            conn.disconnect()
            return Outcome.Fail("TOO_LARGE", "Content-Length=$declared")
        }
        var overflow = false
        val respBody = runCatching {
            (if (code in 200..399) conn.inputStream else conn.errorStream)?.use { input ->
                val buffer = ByteArrayOutputStream()
                val chunk = ByteArray(64 * 1024)
                var total = 0L
                while (true) {
                    val read = input.read(chunk)
                    if (read < 0) break
                    total += read
                    if (total > maxBody) {
                        overflow = true
                        break
                    }
                    buffer.write(chunk, 0, read)
                }
                buffer.toByteArray()
            }
        }.getOrNull()
        conn.disconnect()
        if (overflow) return Outcome.Fail("TOO_LARGE")
        Outcome.Ok(Response(code, message, respBody))
        } catch (failure: Throwable) {
            Outcome.Fail("NETWORK", failure.javaClass.simpleName + ": " + (failure.message ?: "").take(80))
        }
    }

    private fun basicAuth(config: Config): String =
        "Basic " + Base64.getEncoder().encodeToString(
            "${config.user}:${config.password}".toByteArray(Charsets.UTF_8))

    /** PROPFIND multistatus 解析（纯函数，JVM 可测）。服务器返回的命名
     *  前缀不保证（D:/d:/空），正则按本地名匹配；href 取 basename 为
     *  文件名；目录/collection 条目没有 getcontentlength，跳过——列表
     *  只关心备份文件。 */
    internal fun parsePropfind(xml: String): List<Entry> {
        if (xml.isBlank()) return emptyList()
        val entries = ArrayList<Entry>()
        val response = Regex("(?is)<(?:\\w+:)?response>(.*?)</(?:\\w+:)?response>")
        val href = Regex("(?is)<(?:\\w+:)?href[^>]*>(.*?)</(?:\\w+:)?href>")
        val length = Regex("(?is)<(?:\\w+:)?getcontentlength[^>]*>(.*?)</(?:\\w+:)?getcontentlength>")
        val modified = Regex("(?is)<(?:\\w+:)?getlastmodified[^>]*>(.*?)</(?:\\w+:)?getlastmodified>")
        for (block in response.findAll(xml)) {
            val raw = href.find(block.value)?.groupValues?.get(1)?.trim() ?: continue
            val name = java.net.URLDecoder.decode(raw.substringAfterLast('/'), "UTF-8")
            if (name.isEmpty()) continue
            val size = length.find(block.value)?.groupValues?.get(1)?.trim()?.toLongOrNull() ?: -1L
            if (size < 0) continue
            val time = modified.find(block.value)?.groupValues?.get(1)?.trim() ?: ""
            entries.add(Entry(name, size, time))
        }
        return entries
    }
}
