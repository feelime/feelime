package com.feelime.ime

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 桥形参序守门（2026-09-30 用户实录：activateBaseDictSlot/deleteBaseDictSlot
 * 把 token 写成首位形参，JS call() 统一末位追加 → guarded 静默拒绝，点槽
 * 激活全无反应）。mock 套件只断言 JS 侧参数序，看不见 Kotlin 形参——
 * 这一层只能靠源码约定测试锁死：@JavascriptInterface 方法的 token 必须
 * 是最后一个形参。扫设置桥（SettingsBridge）与 IME 桥（FeelimeService
 * 内嵌 bridge）：历史上「排序桥参数错位」恰发生在 IME 侧。
 */
class BridgeTokenConventionTest {
    private fun sources(): List<File> {
        var dir = File(System.getProperty("user.dir") ?: ".")
        repeat(5) {
            val f = File(dir, "src/main/java/com/feelime/ime/SettingsBridge.kt")
            if (f.isFile) {
                return listOf(
                    f,
                    File(dir, "src/main/java/com/feelime/ime/FeelimeService.kt"),
                )
            }
            dir = dir.parentFile ?: return@repeat
        }
        throw IllegalStateException("SettingsBridge.kt not found from ${System.getProperty("user.dir")}")
    }

    /** 按深度 0 的逗号切形参（泛型/函数类型里的逗号不切）。 */
    private fun splitParams(params: String): List<String> {
        val out = mutableListOf<String>()
        val cur = StringBuilder()
        var depth = 0
        for (c in params) {
            when (c) {
                '(', '<' -> { depth++; cur.append(c) }
                ')', '>' -> { depth--; cur.append(c) }
                ',' -> if (depth == 0) { out += cur.toString(); cur.setLength(0) }
                       else cur.append(c)
                else -> cur.append(c)
            }
        }
        if (cur.isNotBlank()) out += cur.toString()
        return out
    }

    @Test
    fun tokenIsAlwaysTheLastJavascriptInterfaceParameter() {
        val offenders = mutableListOf<String>()
        sources().forEach { src ->
        val lines = src.readLines()
        var i = 0
        while (i < lines.size) {
            if (!lines[i].trim().startsWith("@JavascriptInterface")) {
                i++; continue
            }
            // 签名可能跨行：累到圆括号配平为止。
            var sig = StringBuilder()
            var j = i + 1
            while (j < lines.size) {
                sig.append(lines[j])
                val open = sig.count { it == '(' }
                val close = sig.count { it == ')' }
                if (open > 0 && open == close) break
                sig.append('\n')
                j++
            }
            val text = sig.toString()
            // 取首个 '(' 的配平闭括号之间的参数表（不能用最后一个 ')'：
            // 尾部 `= guarded(token)` 会混进来造成误报）。
            val firstParen = text.indexOf('(')
            var depth = 0
            var endParen = -1
            for (k in firstParen until text.length) {
                when (text[k]) {
                    '(' -> depth++
                    ')' -> { depth--; if (depth == 0) { endParen = k; break } }
                }
            }
            val params = if (firstParen >= 0 && endParen > firstParen)
                text.substring(firstParen + 1, endParen) else ""
            val hasToken = params.contains(Regex("\\btoken\\s*:\\s*String"))
            if (hasToken) {
                // 末位形参的名字必须是 token（类型检查不够——slotId 也是
                // String，token 写在首位时末位类型照样是 String）。
                val last = splitParams(params).lastOrNull()?.trim() ?: ""
                if (!last.matches(Regex("token\\s*:\\s*String.*"))) {
                    offenders += "${src.name}: " + text.lineSequence().first().trim()
                }
            }
            i = j + 1
        }
        }
        assertTrue(
            "这些 @JavascriptInterface 方法的 token 不在末位（JS call() 恒末位追加，" +
                "错位会被 guarded 静默拒绝）：\n${offenders.joinToString("\n")}",
            offenders.isEmpty(),
        )
    }
}
