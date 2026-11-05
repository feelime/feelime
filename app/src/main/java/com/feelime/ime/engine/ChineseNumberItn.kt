package com.feelime.ime.engine

/**
 * 中文数字逆正则化（ITN，issue #78）：语音识别的最终文本里，把「按规则
 * 应写成阿拉伯数字」的汉字数字段转成阿拉伯——识别模型原生输出汉字数字
 * （一二三），数量/日期/小数场景的期望是阿拉伯。
 *
 * 保守策略：只在数字段后跟单位白名单（个/年/月/号/元…）、构成「点」
 * 小数或钟点、或句尾 ≥10 的组合数值（如「一共十二」）时转换；句尾裸
 * 个位数、成语（一五一十/三心二意——段后无单位）保持原样。宁可少转
 * 不误转，白名单按用户反馈再加宽（已知残留：「一日三餐」这类成语里
 * 的单字后缀无法与量词机械区分，仅堵最高频的「十分」）。
 *
 * 纯字符串逻辑（JVM 可测）；流式中间态（partial）不转，只处理最终文本。
 */
object ChineseNumberItn {

    private val DIGIT_MAP = mapOf(
        '零' to 0L, '一' to 1L, '二' to 2L, '两' to 2L, '三' to 3L, '四' to 4L,
        '五' to 5L, '六' to 6L, '七' to 7L, '八' to 8L, '九' to 9L,
    )
    private const val UNITS = "十百千万亿"

    private fun isNumChar(c: Char) = c in DIGIT_MAP || c in UNITS

    /** 触发转换的后缀单位白名单（误转反馈驱动加宽，不预先放宽）。 */
    private val SUFFIX_UNITS = setOf(
        '个', '只', '条', '张', '次', '分', '秒', '天', '年', '月', '日', '号', '点',
        '元', '块', '毛', '倍', '周', '层', '楼', '位', '件', '台', '部', '辆',
        '页', '行', '岁', '斤', '米', '里', '克', '吨', '升', '公', '杯', '碗',
        '篇', '章', '节', '课', '题', '字', '句', '词', '人', '家', '种',
        '样', '批', '组', '队', '轮', '遍', '趟', '场', '局', '步',
    )

    /** 逐位读法段（二零二六/零零七）→ 数字串（保留前导零）；含进制词 null。 */
    private fun digitwise(s: String): String? {
        if (s.isEmpty()) return null
        return buildString {
            for (c in s) {
                val d = DIGIT_MAP[c] ?: return null
                append(d)
            }
        }
    }

    /** 数值式（十/十五/一千二百三十四/两万/一亿两千万）→ Long；逐位式
     *  （二零二六/一五一十）与歧形 null。万只缩放段内累计、亿结算进
     *  总量（codex #2 实锤：旧算法一亿两千万 = (1e8+2000)×1e4 错算
     *  一万亿）。 */
    fun parseZhNumber(s: String): Long? {
        if (s.isEmpty()) return null
        var total = 0L      // 已结算（亿级）累计
        var section = 0L    // 万段内累计（万结算后暂存，遇亿时并入 total）
        var current = 0L    // 十/百/千 链上的尾数字
        var pendingDigit = false
        var sawUnit = false
        for (c in s) {
            when {
                DIGIT_MAP.containsKey(c) -> {
                    // 「一一」「三五」式的连续高位数是逐位读法特征；
                    // 「零」是占位（current 归零），零后接数合法（一百零五）
                    if (pendingDigit && current != 0L) return null
                    current = DIGIT_MAP[c]!!
                    pendingDigit = true
                }
                c == '十' -> {
                    if (!pendingDigit) current = 1L          // 十五 = 15
                    section += current * 10L
                    current = 0L; pendingDigit = false; sawUnit = true
                }
                c == '百' || c == '千' -> {
                    if (!pendingDigit && !sawUnit) return null
                    if (!pendingDigit) return null           // 百十 歧形不收
                    section += current * if (c == '百') 100L else 1000L
                    current = 0L; pendingDigit = false; sawUnit = true
                }
                c == '万' -> {
                    if (!pendingDigit && !sawUnit) return null
                    section = (section + current) * 10_000L
                    current = 0L; pendingDigit = false; sawUnit = true
                }
                c == '亿' -> {
                    if (!pendingDigit && !sawUnit) return null
                    total += (section + current) * 100_000_000L
                    section = 0L; current = 0L; pendingDigit = false; sawUnit = true
                }
                else -> return null
            }
        }
        return total + section + current
    }

    /** 入口：把文本里符合条件的汉字数字段转成阿拉伯数字。 */
    fun apply(text: String): String {
        if (text.none { isNumChar(it) }) return text
        val out = StringBuilder()
        var i = 0
        val n = text.length
        while (i < n) {
            if (!isNumChar(text[i])) {
                out.append(text[i])
                i++
                continue
            }
            var j = i
            while (j < n && isNumChar(text[j])) j++
            val segment = text.substring(i, j)
            // 「点」前瞻（codex #1/#7）：小数/钟点必须按完整片段一次成形，
            // 不能先单段转换再回删——整数段转换后输出长度已变，按原文
            // 长度回删会吃掉正文（「价格是一百二十三点四五元」实录）。
            // frac = 点后的完整数字段（含进制词，钟点分钟常是数值式
            // 「二十」）；「分/秒」跟随按钟点保留点字，「刻」不进转换。
            if (j < n - 1 && text[j] == '点') {
                var r = j + 1
                while (r < n && isNumChar(text[r])) r++
                val frac = text.substring(j + 1, r)
                val after = if (r < n) text[r] else null
                val intVal = parseZhNumber(segment)
                if (intVal != null && frac.isNotEmpty()) {
                    if ((after == '分' || after == '秒')) {
                        // 分钟优先逐位（保前导零：零五 → 05），数值式其次
                        val minute = digitwise(frac) ?: parseZhNumber(frac)?.toString()
                        if (minute != null) {
                            out.append(intVal).append("点").append(minute)
                            i = r
                            continue
                        }
                    } else if (after != '刻') {
                        // 小数：frac 必须纯数字字形（三四 → 34）
                        val digits = digitwise(frac)
                        if (digits != null) {
                            out.append(intVal).append('.').append(digits)
                            i = r
                            continue
                        }
                    }
                }
            }
            out.append(convertSegment(
                segment,
                if (j < n) text[j] else null,
                if (j + 1 < n) text[j + 1] else null,
            ))
            i = j
        }
        return out.toString()
    }

    /** 单个数字段的裁决：不满足条件原样返回。next2 用于「点」的消歧
     *  （句尾/标点前的「一点」是「稍微」义，不转；「三点十五分」「三点
     *  一四」这类点后带数字的才按钟点/小数转）。 */
    private fun convertSegment(segment: String, next: Char?, next2: Char? = null): String {
        if (segment.isEmpty()) return segment
        // 纯数字字形段（无进制词）在编号语境优先按位转：零零七 → 007
        // （codex #9：先走数值解析会丢前导零）。单段（三个）不适用。
        if (segment.length >= 2 && segment.none { it in UNITS } && next != null &&
            (next == '年' || next == '月' || next == '日' || next == '号' ||
                (segment.length >= 3 && SUFFIX_UNITS.contains(next)))
        ) {
            digitwise(segment)?.let { return it }
        }
        // 「十分」黑名单（codex #8 实锤：十分满意 → 10分满意）。程度
        // 副词远高频于量词（分数语境通常另带 钟分/之 佐证），一律不转。
        if (segment == "十" && next == '分') return segment
        val hasUnit = segment.any { it in UNITS }
        val value = parseZhNumber(segment)
        if (value != null) {
            val unitTriggers = next != null && SUFFIX_UNITS.contains(next) &&
                (next != '点' || isNumChar(next2 ?: ' ') || DIGIT_MAP.containsKey(next2 ?: ' '))
            // 句尾裸数字只转组合值（≥10）：「一共十二」→「一共12」，
            // 单个「一」不转（成语/语气不受影响）
            val tailTriggers = next == null && value >= 10L && hasUnit
            if (unitTriggers || tailTriggers) return value.toString()
        }
        // 逐位式（二零二六）+ 日期单位，或长逐位串（≥3 位）+ 单位
        val dw = digitwise(segment)
        if (dw != null && segment.length >= 2 && next != null &&
            (next == '年' || next == '月' || next == '日' || next == '号' ||
                (segment.length >= 3 && SUFFIX_UNITS.contains(next)))
        ) {
            return dw
        }
        return segment
    }
}
