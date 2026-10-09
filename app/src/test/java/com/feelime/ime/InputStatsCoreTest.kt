package com.feelime.ime

import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * InputStats 推导层的不变量（#41 二轮）：streak 跨「今天没打字」的口径、
 * 近 7 天窗口、日均分母是活跃天数（不是装机天数）。
 */
class InputStatsCoreTest {
    private fun snapshot(daily: Map<String, Long>, today: LocalDate): JSONObject {
        val cache = InputStats.Cache(
            LocalDate.of(2026, 1, 1), daily.values.sum(), 0L, HashMap(daily))
        return JSONObject(InputStats.coreSnapshot(cache, today))
    }

    @Test
    fun streakCountsConsecutiveDaysIncludingToday() {
        val today = LocalDate.of(2026, 9, 29)
        val json = snapshot(
            mapOf("2026-09-27" to 5L, "2026-09-28" to 7L, "2026-09-29" to 3L), today)
        assertEquals(3L, json.getLong("streak"))
        assertEquals(3L, json.getLong("today"))
    }

    @Test
    fun streakKeepsYesterdayStreakWhenTodayIsEmpty() {
        val today = LocalDate.of(2026, 9, 29)
        val json = snapshot(mapOf("2026-09-28" to 7L), today)
        // 今天还没打字：连续天数仍显示到昨天为止的 1 天，不归零。
        assertEquals(1L, json.getLong("streak"))
        assertEquals(0L, json.getLong("today"))
    }

    @Test
    fun dailyWindowIsLastSevenDaysEndingToday() {
        val today = LocalDate.of(2026, 9, 29)
        val json = snapshot(mapOf("2026-09-22" to 9L, "2026-09-29" to 1L), today)
        val daily = json.getJSONArray("daily")
        assertEquals(7, daily.length())
        assertEquals("2026-09-23", daily.getJSONObject(0).getString("date"))
        assertEquals("2026-09-29", daily.getJSONObject(6).getString("date"))
        // 窗口外的 09-22 不进图；窗口内的空日补零。
        assertEquals(0L, daily.getJSONObject(1).getLong("chars"))
        assertEquals(1L, daily.getJSONObject(6).getLong("chars"))
    }

    @Test
    fun avgDailyDividesByActiveDaysOnly() {
        val today = LocalDate.of(2026, 9, 29)
        val json = snapshot(mapOf("2026-09-28" to 100L, "2026-09-29" to 50L), today)
        assertEquals(2L, json.getLong("daysWith"))
        assertEquals(75L, json.getLong("avgDaily"))
        assertTrue(json.getLong("total") == 150L)
    }

    @Test
    fun companionSinceAdoptsEarlierInstallDay() {
        // 用户裁定 A（2026-10-09）：功能上线前已在用的老用户，相伴天数
        // 从安装日起算，不从统计 v2 首启日起算。
        val current = LocalDate.of(2026, 9, 30)
        val installed = LocalDate.of(2026, 8, 12)
        assertEquals(installed, InputStats.adoptEarlierSince(current, installed))
        // 备份带来的更早 since（换机导入）保持不动。
        val olderBackup = LocalDate.of(2026, 7, 1)
        assertEquals(olderBackup, InputStats.adoptEarlierSince(olderBackup, installed))
        // 包信息读不到：保持现状。
        assertEquals(current, InputStats.adoptEarlierSince(current, null))
        // 新装用户：安装日==首启日或更晚（同天安装当天启用），不变。
        assertEquals(current, InputStats.adoptEarlierSince(current, current))
    }
}
