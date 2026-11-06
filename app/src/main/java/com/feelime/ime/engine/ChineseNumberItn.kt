package com.feelime.ime.engine

/**
 * 中文数字逆正则化（ITN，issue #78）：语音识别的最终文本里，把「按规则
 * 应写成阿拉伯数字」的汉字数字段转成阿拉伯——识别模型原生输出汉字数字
 * （一二三），数量/日期/小数场景的期望是阿拉伯。
 *
 * 分层裁决（~/tmp/itn-cls 原型验证：结构层+开放面分类器 test 精确率
 * 0.920/召回 0.902，纯规则 0.882/0.784）：
 * - 结构层（本 object）确定性规则直接裁决 CONVERT/KEEP，覆盖约七成
 *   样本（错误率 3-7%）：点形态小数/钟点、年月日号、组合数值+白名单
 *   量词、比分/分数构式、概数/叠字/农历/星期 KEEP。
 * - 开放面（OPEN：裸个位+量词「三个/一次/二元」、第X 序数、X分/X尺、
 *   里/行、句尾组合数值等双栖形态）交 [ItnClassifier] 上下文判定；
 *   分类器未加载/未决 → 一律 KEEP（宁少转不误转）。
 *
 * 纯字符串逻辑（JVM 可测）；流式中间态（partial）不转，只处理最终文本。
 */
object ChineseNumberItn {

    /** 开放面判定器：assets 冻结的 n-gram 逻辑回归权重，未加载恒 KEEP。 */
    internal var classifier: ItnClassifier? = null

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
        '页', '岁', '斤', '米', '克', '吨', '升', '公', '杯', '碗',
        '篇', '章', '节', '课', '题', '字', '句', '词', '人', '家', '种',
        '样', '批', '组', '队', '轮', '遍', '趟', '场', '局', '步', '折', '成',
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
            // 「点」前瞻（codex #1/#7）：小数/钟点按完整片段一次成形，
            // 不能先单段转换再回删——整数段转换后输出长度已变，按原文
            // 长度回删会吃掉正文（「价格是一百二十三点四五元」实录）。
            if (j < n - 1 && text[j] == '点') {
                var r = j + 1
                while (r < n && isNumChar(text[r])) r++
                val frac = text.substring(j + 1, r)
                val after = if (r < n) text[r] else null
                val intVal = parseZhNumber(segment)
                if (intVal != null && frac.isNotEmpty()) {
                    if ((after == '分' || after == '秒')) {
                        val minute = digitwise(frac) ?: parseZhNumber(frac)?.toString()
                        if (minute != null) {
                            out.append(intVal).append("点").append(minute)
                            i = r
                            continue
                        }
                    } else if (after != '刻') {
                        val digits = digitwise(frac)
                        if (digits != null) {
                            out.append(intVal).append('.').append(digits)
                            i = r
                            continue
                        }
                    }
                }
            }
            when (verdict(text, i, j, segment)) {
                Verdict.CONVERT -> out.append(render(segment))
                Verdict.OPEN ->
                    if (classifier?.decide(text, i, j) == true) out.append(render(segment))
                    else out.append(segment)
                Verdict.KEEP -> out.append(segment)
            }
            i = j
        }
        return out.toString()
    }

    internal enum class Verdict { CONVERT, KEEP, OPEN }

    /** 上下文环境字（时辰/星期/农历），结构层 KEEP 证据。 */
    private val CLOCK_PREFIXES = listOf(
        "上午", "下午", "晚上", "早上", "清晨", "傍晚", "凌晨", "中午",
    )

    /**
     * 单段三态裁决（结构层）。CONVERT/KEEP 为确定性结论；OPEN 是
     * 双栖形态（三个/一次/第X/X分/里行/句尾组合数值），交分类器。
     */
    internal fun verdict(text: String, start: Int, end: Int, segment: String): Verdict {
        val n = text.length
        val prev = if (start > 0) text[start - 1] else null
        val prev2 = if (start > 1) text[start - 2] else null
        val next = if (end < n) text[end] else null
        val next2 = if (end + 1 < n) text[end + 1] else null
        // 相邻个位概数（两三/三四/三五）：真实语料实证是构词形态
        if (segment.length == 2 && segment[0] in "一二两三四五" &&
            segment[1] in "三四五六七八九") return Verdict.KEEP
        // 叠字段（九九/六六）：构词（九九归一/六六大顺）
        if (segment.length <= 2 && segment[0] == segment.lastOrNull() &&
            segment.length == 2) return Verdict.KEEP
        // 比分构式 X比Y / 分数构式 X分之Y（双向）；分母标记（百分之）KEEP
        if (next == '比' && next2 != null && DIGIT_MAP.containsKey(next2)) return Verdict.CONVERT
        if (next == '分' && next2 == '之') {
            return if (segment.length == 1 && segment[0] in "百千万") Verdict.KEEP
            else Verdict.CONVERT
        }
        if (prev == '比' && prev2 != null && DIGIT_MAP.containsKey(prev2)) return Verdict.CONVERT
        if (prev == '之' && prev2 == '分') return Verdict.CONVERT
        // 星期/周/礼拜（周一/星期三）
        if (prev != null && prev in "周礼星" &&
            (segment.length == 1 && segment[0] in "一二三四五六日天" || segment == "十一")
        ) return Verdict.KEEP
        // 农历月日（八月十五/正月初一/腊月二十八）
        if (start >= 2 && text.substring(start - 2, start) in listOf("农历", "正月", "腊月") ||
            prev != null && prev in "腊正初大"
        ) return Verdict.KEEP
        // 第X 序数：考了第一 C vs 第一次世界大战 K —— 开放面
        if (prev == '第') return Verdict.OPEN
        // 十分满意 vs 得了十分 / 百尺竿头 vs 二尺八 —— 开放面
        if (next == '分' || next == '尺') return Verdict.OPEN
        // 日期单位：任意形态 CONVERT（纯字形走逐位渲染保前导零）
        if (next != null && next in "年月日号") return Verdict.CONVERT
        val hasUnit = segment.any { it in UNITS }
        val pure = segment.all { DIGIT_MAP.containsKey(it) }
        if (next == null) {
            // 句尾逐位编号（取件码零三六八/车牌）
            if (pure && segment.length >= 3) return Verdict.CONVERT
            // 长组合数值链（一亿五千万三千五百六十）没有习语形态，
            // 句尾也直接转；短组合数值（一共十二 C vs 别二百五 K）
            // 双栖，留分类器——开放面
            if (hasUnit && !pure && segment.length >= 4) return Verdict.CONVERT
            if (hasUnit && segment.length >= 2 && !pure) return Verdict.OPEN
            return Verdict.KEEP
        }
        // 里/行：万里长城 vs 跑一万里 —— 开放面
        if (next == '里' || next == '行' || prev == '里' || prev == '行') return Verdict.OPEN
        if (next !in SUFFIX_UNITS) return Verdict.KEEP
        if (hasUnit) return Verdict.CONVERT              // 十五个/一千二百三十四块
        if (pure && segment.length >= 3) return Verdict.CONVERT  // 零零七八尾号
        // 点的钟点消歧由主循环点前瞻先行；此处的点=「X点」句中形态
        if (next == '点') {
            // 时辰前缀（下午三点开会）：原型验证的钟点整点 CONVERT
            if (start >= 2 && text.substring(start - 2, start) in CLOCK_PREFIXES) {
                return Verdict.CONVERT
            }
            return Verdict.OPEN                          // 一点意见/约在十点边缘
        }
        // 裸个位 + 白名单量词（三个/一次/二元/五天）—— 分类器开放面
        return Verdict.OPEN
    }

    /** CONVERT 段的渲染：纯字形段逐位优先（零零七 → 007 保前导零），
     *  含进制词段数值优先（一千二百三十四 → 1234）。 */
    private fun render(segment: String): String =
        if (segment.all { DIGIT_MAP.containsKey(it) }) {
            digitwise(segment) ?: segment
        } else {
            parseZhNumber(segment)?.toString() ?: digitwise(segment) ?: segment
        }
}
