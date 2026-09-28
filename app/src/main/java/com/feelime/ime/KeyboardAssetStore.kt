package com.feelime.ime

import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.File

/**
 * Serves the currently active keyboard (built-in or hot-update version) from
 * the synthetic HTTPS origin. Source selection lives in KeyboardStore.
 */
class KeyboardAssetStore(private val root: File) {

    fun response(path: String): WebResourceResponse {
        // ?v=<version> 只做缓存失效（真机实录：no-store 响应头仍被
        // ColorOS WebView 的 HTTP cache 钉死旧 JS，rm built-in + 进程
        // 重启都救不回，升级 APK 后键盘停留旧版）——URL 带版本，缓存
        // key 天然随版本换。
        val relative = path.removePrefix("/keyboard/").substringBefore('?').ifBlank { "index.html" }
        if (relative.split('/').any { it == ".." || it.isBlank() }) return missing()
        if (relative !in SERVED_FILES) return missing()
        val file = File(root, relative)
        if (!file.isFile || !file.canonicalPath.startsWith(root.canonicalPath + File.separator)) return missing()
        val headers = mutableMapOf("Cache-Control" to "no-store")
        if (relative == "index.html") {
            headers["Content-Security-Policy"] =
                "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
                    "connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"
            // 注入当前版本号：index.html 自身 no-store 不被缓存，它引用
            // 的 js/css 的 URL 随 VERSION 变化。
            val version = File(root, "VERSION").takeIf { it.isFile }
                ?.readText()?.trim().takeUnless { it.isNullOrEmpty() } ?: "0"
            val html = file.readText().replace("__KB_VERSION__", version)
            return WebResourceResponse(
                mimeType(relative),
                "UTF-8",
                200,
                "OK",
                headers,
                html.byteInputStream(),
            )
        }
        return WebResourceResponse(
            mimeType(relative),
            "UTF-8",
            200,
            "OK",
            headers,
            file.inputStream(),
        )
    }

    companion object {
        private val SERVED_FILES = setOf("index.html", "keyboard.css", "keyboard.js", "VERSION")

        private fun missing() = WebResourceResponse(
            "text/plain",
            "UTF-8",
            404,
            "Not Found",
            mapOf("Cache-Control" to "no-store"),
            ByteArrayInputStream("Not found".toByteArray()),
        )

        private fun mimeType(path: String) = when (path.substringAfterLast('.', "")) {
            "html" -> "text/html"
            "css" -> "text/css"
            "js" -> "application/javascript"
            else -> "application/octet-stream"
        }
    }
}
