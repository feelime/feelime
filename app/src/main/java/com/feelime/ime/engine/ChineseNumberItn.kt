package com.feelime.ime.engine

/**
 * 中文数字逆正则化（ITN，issue #78）：语音识别的最终文本里，把「按规则
 * 应写成阿拉伯数字」的汉字数字段转成阿拉伯——识别模型原生输出汉字数字
 * （一二三），数量/日期/小数场景的期望是阿拉伯。
 *
 * 保守策略：只在数字段后跟单位白名单（个/年/月/号/元…）、构成「点」
 * 小数、或句尾 ≥10 的组合数值（如「一共十二」）时转换；句尾裸个位数、
 * 成语（一五一十/三心二意——段后无单位）保持原样。宁可少转不误转，
 * 白名单按用户反馈再加宽。
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

    /** 逐位读法段（二零二六/三七）→ 数字串；含进制词返回 null。 */
    private fun digitwise(s: String): String? {
        if (s.isEmpty()) return null
        return buildString {
            for (c in s) {
                val d = DIGIT_MAP[c] ?: return null
                append(d)
            }
        }
    }

    /** 数值式（十/十五/一千二百三十四/两万）→ Long；逐位式（二零二六）null。 */
    fun parseZhNumber(s: String): Long? {
        if (s.isEmpty()) return null
        var total = 0L      // 万/亿 段累计
        var section = 0L    // 当前万段内累计
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
                c == '万' || c == '亿' -> {
                    if (!pendingDigit && !sawUnit) return null
                    section += current
                    total = (total + section) * if (c == '万') 10_000L else 100_000_000L
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
            val c = text[i]
            if (!isNumChar(c)) {
                // 「点」小数特判：<数段>点<纯数字段>（三点一四 → 3.14）
                if (c == '点' && i > 0 && i + 1 < n &&
                    isNumChar(text[i - 1]) && DIGIT_MAP.containsKey(text[i + 1])
                ) {
                    var l = i - 1
                    while (l > 0 && isNumChar(text[l - 1])) l--
                    var r = i + 1
                    while (r < n && DIGIT_MAP.containsKey(text[r])) r++
                    val intPart = text.substring(l, i)
                    val fracPart = text.substring(i + 1, r)
                    val intVal = parseZhNumber(intPart)
                    val fracDigits = digitwise(fracPart)
                    if (intVal != null && fracDigits != null) {
                        // 整数部可能已按单段写入（如「三点」的单段转换没发生——
                        // 点在白名单里；这里回退已写内容改写整体）
                        val drop = out.length - (i - l)
                        out.setLength(drop.coerceAtLeast(0))
                        out.append(intVal).append('.').append(fracDigits)
                        i = r
                        continue
                    }
                }
                out.append(c)
                i++
                continue
            }
            var j = i
            while (j < n && isNumChar(text[j])) j++
            val segment = text.substring(i, j)
            val next = if (j < n) text[j] else null
            val next2 = if (j + 1 < n) text[j + 1] else null
            out.append(convertSegment(segment, next, next2))
            i = j
        }
        return out.toString()
    }

    /** 单个数字段的裁决：不满足条件原样返回。next2 用于「点」的消歧
     *  （句尾/标点前的「一点」是「稍微」义，不转；「三点十五分」「三点
     *  一四」这类点后带数字的才按钟点/小数转）。 */
    private fun convertSegment(segment: String, next: Char?, next2: Char? = null): String {
        if (segment.isEmpty()) return segment
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
