package com.feelime.ime.backup

import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody

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

    /** 共享客户端：连接复用；重定向关闭——3xx 统一走本对象的单跳跟随
     *  （HttpURLConnection 只对 GET 自动跟随且拒收 PROPFIND——Android
     *  的实现限定标准方法集，ProtocolException 定罪于 2026-10-10 AVD
     *  实测，已整体迁 okhttp）。 */
    private val client = OkHttpClient.Builder()
        .connectTimeout(CONNECT_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
        .readTimeout(READ_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    /** PROPFIND 的零长请求体（Content-Length: 0，服务器端普遍要求）。 */
    private val EMPTY_BODY = ByteArray(0).toRequestBody(null)

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

    /** 单次 HTTP 往返的统一产物：状态码 + 消息 + 头（重定向 Location 用）
     *  + 响应体（PROPFIND 用）。 */
    private data class Response(
        val code: Int,
        val message: String,
        val body: ByteArray?,
        val headers: Map<String, String>? = null,
    )

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

    /** 上传一份备份（PUT）。overwrite=false 时带 If-None-Match:* 让
     *  服务器仲裁重名（412→CONFLICT）——客户端名单可能过期/拉取失败，
     *  「覆盖必须经用户确认」的最终裁判在服务器端，不吃列表竞态。 */
    fun put(config: Config, name: String, bytes: ByteArray, overwrite: Boolean = false): Outcome<String> =
        exchange(config, "PUT", name, body = bytes, noClobber = !overwrite).let { outcome ->
            when (outcome) {
                is Outcome.Ok -> if (outcome.value.code == 412) Outcome.Fail("CONFLICT")
                else if (outcome.value.code in 200..299) Outcome.Ok(name)
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

    /** HTTP 往返公共壳（带单跳重定向跟随）：认证头/超时/动词/请求体；
     *  响应体流式有界读回（[maxBody] 判 Content-Length 头 + 实读双重
     *  防线，防超大响应撑爆内存——GET 下载路径的安全闸）。
     *  重定向：HttpURLConnection 只对 GET 自动跟随，PROPFIND/PUT 的
     *  301/302/307/308 要自己跟（实测：反代对无尾斜杠目录回 301，
     *  app 的地址规整恰好会去掉尾斜杠）。只跟一跳，防环。 */
    private fun exchange(
        config: Config,
        method: String,
        name: String,
        depth: String? = null,
        body: ByteArray? = null,
        maxBody: Long = 4L * 1024 * 1024,
        noClobber: Boolean = false,
    ): Outcome<Response> = exchangeOnce(config, method, name, depth, body, maxBody, noClobber).let { first ->
        val location = (first as? Outcome.Ok)?.value?.takeIf { it.code in 301..308 }
            ?.let { resp -> redirectTarget(config, name, resp) } ?: return first
        exchangeOnce(config, method, location, depth, body, maxBody, noClobber)
    }

    /** 301/302/307/308 的 Location 解析（相对路径按 base 补全）。
     *  只跟同源（scheme+host 一致）目标：重定向是服务器可控的，凭据与
     *  备份正文不能被带去第二台主机，也不能 https→http 降级明文重发。 */
    private fun redirectTarget(config: Config, name: String, resp: Response): String? {
        val location = resp.headers?.get("Location") ?: return null
        if (location.isBlank()) return null
        val resolved = when {
            location.startsWith("http://") || location.startsWith("https://") -> location
            // 根相对（/x）：按 origin（scheme://host）解析，不是拼到 base 后面。
            location.startsWith("/") ->
                Regex("^(https?://[^/]+)").find(config.base)?.groupValues?.get(1)
                    ?.let { it + location }
            // 相对当前路径的形态罕见，不跟（宁可不跟随也不错拼）。
            else -> null
        } ?: return null
        val baseOrigin = Regex("^(https?://[^/]+)").find(config.base)?.groupValues?.get(1)
            ?: return null
        val targetOrigin = Regex("^(https?://[^/]+)").find(resolved)?.groupValues?.get(1)
            ?: return null
        return if (targetOrigin.equals(baseOrigin, ignoreCase = true)) resolved else null
    }

    private fun exchangeOnce(
        config: Config,
        method: String,
        name: String,
        depth: String? = null,
        body: ByteArray? = null,
        maxBody: Long = 4L * 1024 * 1024,
        noClobber: Boolean = false,
    ): Outcome<Response> {
        return try {
            val target = when {
                name.startsWith("http://") || name.startsWith("https://") -> name
                name.isEmpty() -> config.base
                else -> config.base + "/" + java.net.URLEncoder.encode(name, "UTF-8")
            }
            val builder = Request.Builder()
                .url(target)
                .header("Authorization", basicAuth(config))
                .header("User-Agent", "feelime-backup/1")
            depth?.let { builder.header("Depth", it) }
            if (noClobber) builder.header("If-None-Match", "*")
            when {
                body != null -> builder.method(method, body.toRequestBody(null))
                method == "PROPFIND" -> builder.method(method, EMPTY_BODY)
                else -> builder.method(method, null)
            }
            client.newCall(builder.build()).execute().use { response ->
                val code = response.code
                val message = (response.message ?: "").take(80)
                val declared = response.header("Content-Length")?.toLongOrNull() ?: -1L
                if (declared > maxBody) return Outcome.Fail("TOO_LARGE", "Content-Length=$declared")
                var overflow = false
                // 读体异常不吞（runCatching→null 会把断连/超时变成「成功的
                // 空响应」：PROPFIND 得到空目录、重名检查被架空）——直接
                // 抛给外层 catch 统一按 NETWORK 失败。
                val respBody = response.body?.byteStream()?.use { input ->
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
                if (overflow) return Outcome.Fail("TOO_LARGE")
                val headerMap = HashMap<String, String>()
                listOf("Location").forEach { key ->
                    response.header(key)?.let { headerMap[key] = it }
                }
                Outcome.Ok(Response(code, message, respBody, headerMap))
            }
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
