package com.feelime.ime

import android.content.Context
import java.time.LocalDate

/**
 * 输入字数统计（issue #41）：只记两个数——今日上屏 code point 数与累计数。
 * 计数点在三条上屏汇聚路上（引擎 editor.commitText / 语音落定 / JS 桥
 * commitText），回滚与面板重定向不计。native pref 是唯一真相源，设置页
 * 经 SettingsBridge 快照读取；跨日（LocalDate 变化）今日归零。
 */
object InputStats {
    private const val PREFS = "input_stats"
    private const val KEY_DAY = "day"
    private const val KEY_TODAY = "today"
    private const val KEY_TOTAL = "total"

    fun record(context: Context, text: String) {
        if (text.isEmpty()) return
        val count = text.codePointCount(0, text.length)
        if (count <= 0) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val today = LocalDate.now().toString()
        val day = prefs.getString(KEY_DAY, null)
        val dayCount = if (day == today) prefs.getLong(KEY_TODAY, 0L) else 0L
        prefs.edit()
            .putString(KEY_DAY, today)
            .putLong(KEY_TODAY, dayCount + count)
            .putLong(KEY_TOTAL, prefs.getLong(KEY_TOTAL, 0L) + count)
            .apply()
    }

    /** [today, total] code point counts for the settings page. */
    fun snapshot(context: Context): Pair<Long, Long> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val today = LocalDate.now().toString()
        val dayCount = if (prefs.getString(KEY_DAY, null) == today)
            prefs.getLong(KEY_TODAY, 0L) else 0L
        return Pair(dayCount, prefs.getLong(KEY_TOTAL, 0L))
    }
}
