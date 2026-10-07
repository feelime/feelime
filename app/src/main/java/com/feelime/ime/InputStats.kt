package com.feelime.ime

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * 输入统计（issue #41，二轮趣味化）：native pref 是唯一真相源，存一份 JSON——
 *   {"since":"2026-09-29","total":123,"keystrokes":456,
 *    "daily":{"2026-09-28":12,...}}            // 近 60 天按日字符数
 * 计数点：字符在三条上屏汇聚路（引擎 editor.commitText / 语音落定 / JS 桥
 * commitText），回滚与面板重定向不计；击键在 ImeBridge 的 key/space/
 * backspace/enter 漏斗（覆盖字母/空格/删除/回车，滑动删除按手势端点计）。
 *
 * 键盘浮层经 [snapshotJson] 拉全量（含 streak/日均/近 7 天推导值）；设置页
 * 关于行沿用 [snapshot] 的 today/total。daily 超窗裁剪时 total 不减（累计
 * 是永续数，daily 只服务趋势图）。
 */
object InputStats {
    private const val PREFS = "input_stats"
    private const val KEY_JSON = "stats"
    private const val DAILY_WINDOW = 60

    // 旧版（一轮）平铺键：迁移并读。
    private const val KEY_LEGACY_TOTAL = "total"

    /** 进程内缓存（击键高频，不能每键读写盘）。internal 供 JVM 测试构造。 */
    internal class Cache(
        var since: LocalDate,
        var total: Long,
        var keystrokes: Long,
        val daily: MutableMap<String, Long>,
    )

    @Volatile private var cache: Cache? = null
    private var pendingKeystrokes = 0L

    private fun load(context: Context): Cache {
        cache?.let { return it }
        synchronized(this) {
            cache?.let { return it }
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val raw = prefs.getString(KEY_JSON, null)
            val parsed = runCatching {
                val obj = JSONObject(raw!!)
                Cache(
                    runCatching { LocalDate.parse(obj.optString("since")) }
                        .getOrDefault(LocalDate.now()),
                    obj.optLong("total"),
                    obj.optLong("keystrokes"),
                    HashMap<String, Long>().apply {
                        val daily = obj.optJSONObject("daily") ?: return@apply
                        daily.keys().forEach { k -> put(k, daily.optLong(k)) }
                    },
                )
            }
            val base = parsed.getOrNull() ?: Cache(LocalDate.now(), 0L, 0L, HashMap())
            // 旧版迁移：一轮的平铺 total 并入（一次性，谁先读到谁合并）。
            // JSON 已存在但损坏（半写入现场）同样读 legacy 补救；并入后
            // 立即 persist——此前只改内存 cache，legacy 键却已删，进程在
            // 下一次 record 前被杀则旧 total 双向丢失（issue #44 累计
            // 偏小的来源之一）。
            val legacy = prefs.getLong(KEY_LEGACY_TOTAL, 0L)
            if (legacy > 0) {
                base.total += legacy
                prefs.edit().remove(KEY_LEGACY_TOTAL).apply()
                cache = base
                persist(context)
                return base
            }
            cache = base
            return base
        }
    }

    private fun persist(context: Context) {
        val c = cache ?: return
        val daily = JSONObject()
        c.daily.toSortedMap().forEach { (k, v) -> daily.put(k, v) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_JSON, JSONObject()
                .put("since", c.since.toString())
                .put("total", c.total)
                .put("keystrokes", c.keystrokes)
                .put("daily", daily)
                .toString())
            .apply()
    }

    /** 上屏字符计数（code point）。 */
    fun record(context: Context, text: String) {
        if (text.isEmpty()) return
        val count = text.codePointCount(0, text.length)
        if (count <= 0) return
        val c = load(context)
        val today = LocalDate.now()
        synchronized(this) {
            c.total += count
            c.daily[today.toString()] = (c.daily[today.toString()] ?: 0L) + count
            trimDaily(c, today)
            pendingKeystrokes = 0L
            persist(context)
        }
    }

    /** 击键计数：内存累加，落盘搭 record/快照/onDestroy 的便车（统计允许
     *  崩溃窗口丢一点，不值得每键写盘）。 */
    fun recordKeystroke(context: Context, n: Int = 1) {
        val c = load(context)
        synchronized(this) {
            c.keystrokes += n
            pendingKeystrokes += n
            if (pendingKeystrokes >= 64) {
                pendingKeystrokes = 0L
                persist(context)
            }
        }
    }

    /** IME 生命周期收尾：把内存击键刷进盘。 */
    fun flush(context: Context) {
        val c = cache ?: return
        synchronized(this) {
            if (pendingKeystrokes > 0L) {
                pendingKeystrokes = 0L
                persist(context)
            }
        }
    }

    private fun trimDaily(c: Cache, today: LocalDate) {
        if (c.daily.size <= DAILY_WINDOW) return
        val cutoff = today.minusDays(DAILY_WINDOW.toLong()).toString()
        c.daily.keys.removeAll { it < cutoff }
    }

    /** [today, total] code point counts（设置页关于行，一轮协议保持）。 */
    fun snapshot(context: Context): Pair<Long, Long> {
        val c = load(context)
        return Pair(c.daily[LocalDate.now().toString()] ?: 0L, c.total)
    }

    /** 键盘浮层全量快照（JSON 字符串，同步返回给桥）。 */
    fun snapshotJson(context: Context): String {
        flushIfPending(context)
        return coreSnapshot(load(context), LocalDate.now())
    }

    /** streak/近 7 天/日均推导（JVM 可测：纯函数，不碰 prefs）。 */
    internal fun coreSnapshot(c: Cache, today: LocalDate): String {
        val todayKey = today.toString()
        val days = JSONArray()
        for (i in 6 downTo 0) {
            val d = today.minusDays(i.toLong())
            days.put(JSONObject()
                .put("date", d.toString())
                .put("chars", c.daily[d.toString()] ?: 0L))
        }
        // streak：从今天（或昨天，今天还没打字时）往前数连续有字的天。
        var streak = 0L
        var cursor = if ((c.daily[todayKey] ?: 0L) > 0L) today else today.minusDays(1)
        while ((c.daily[cursor.toString()] ?: 0L) > 0L) {
            streak++
            cursor = cursor.minusDays(1)
        }
        val activeDays = c.daily.count { it.value > 0L }
        return JSONObject()
            .put("today", c.daily[todayKey] ?: 0L)
            .put("total", c.total)
            .put("keystrokes", c.keystrokes)
            .put("streak", streak)
            .put("since", c.since.toString())
            .put("daysWith", activeDays)
            .put("avgDaily", if (activeDays > 0) c.total / activeDays else 0L)
            .put("daily", days)
            .toString()
    }

    private fun flushIfPending(context: Context) {
        if (pendingKeystrokes > 0L) {
            synchronized(this) {
                if (pendingKeystrokes > 0L) {
                    pendingKeystrokes = 0L
                    persist(context)
                }
            }
        }
    }
}
