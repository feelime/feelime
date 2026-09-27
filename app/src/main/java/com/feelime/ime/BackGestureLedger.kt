package com.feelime.ime

/**
 * #34 删除手势恢复账本的删除单位切分（codex 终审 P1 收口 + 二轮 P1/P2）。
 *
 * 原实现按单个 code point 记账，而宿主编辑器的退格（AOSP
 * BaseKeyListener）按「用户感知字符」（grapheme cluster）整组删：
 * 国旗 🇨🇳 是两个码点、肤色修饰 👍🏽 是基础 emoji + 修饰符、ZWJ 家庭
 * 👨‍👩‍👧 是一整串——账本记一个码点、宿主删一组，回滑恢复就会错字。
 * 这里按同一口径切分：恢复账本的单位与宿主删除的单位一致。
 *
 * 尾部分割只需要从字符串末尾识别一个 cluster 的起点，不引 ICU 依赖
 * （android.icu 在 JVM 单测不可用，SystemClock 的 not-mocked 教训）。
 * 覆盖：代理对、Regional Indicator 按段内奇偶配对（国旗；GB12/13 的
 * 配对从段头起算，局部计数在基线被截断的病态场景下有已知近似）、
 * 肤色修饰（U+1F3FB..FF）、变体选择符（U+FE0E/FE0F 与补充
 * U+E0100..E01EF）、tag 序列（U+E0020..E007F，英格兰/苏格兰/威尔士
 * 旗帜 🏴󠁧󠁢󠁥󠁮󠁧󠁿）、keycap/禁止锁（U+20E3/20E0）、ZWJ 链（家庭/职业
 * 等组合 emoji，含链内肤色与 VS16）。ZWJ 合并只认 emoji 属性的段
 * （GB11 的 Extended_Pictographic 近似：主 emoji 区块范围表）——
 * 普通字母夹 ZWJ 不合并（宿主退格只删尾字符，codex 二轮 P2-4）。
 */
object BackGestureLedger {

    private const val ZWJ = 0x200D
    private const val RI_LOW = 0x1F1E6   // Regional Indicator A
    private const val RI_HIGH = 0x1F1FF  // Regional Indicator Z
    private const val SKIN_LOW = 0x1F3FB // light skin tone
    private const val SKIN_HIGH = 0x1F3FF
    private const val VS15 = 0xFE0E
    private const val VS16 = 0xFE0F
    private const val KEYCAP = 0x20E3
    private const val NO_ENTRY = 0x20E0 // 圆圈斜杠（iOS「禁止」emoji）
    // tag 序列（旗帜子division 标签，U+E0020..E007F；终止符在尾）
    private const val TAG_LOW = 0xE0020
    private const val TAG_HIGH = 0xE007F
    // 补充变体选择符（MVS，如「葛󠄀」历史用字）
    private const val MVS_LOW = 0xE0100
    private const val MVS_HIGH = 0xE01EF

    /** Extended_Pictographic 的区块近似（GB11 的 ZWJ 合并资格）。只用于
     *  「ZWJ 前的段是否 emoji」判断，范围表覆盖常用 emoji 区块；区外
     *  的罕见 pictographic 走不合并（与宿主按属性删除的偏差属已知近似，
     *  好过把普通文本夹 ZWJ 整段吞掉）。 */
    private fun isPictographic(cp: Int): Boolean =
        cp >= 0x1F000 ||                       // 所有增补 emoji 区块
            cp in 0x2600..0x27BF ||            // 杂项符号/装饰符号
            cp in 0x2B00..0x2BFF ||            // 杂项符号与箭头
            cp in 0x2300..0x23FF ||            // 杂项技术（⌚⏰ 等）
            cp in 0x2190..0x21FF ||            // 箭头（➡ 等）
            cp == 0x00A9 || cp == 0x00AE ||    // © ®
            cp == 0x2122 || cp == 0x3030 || cp == 0x303D || cp == 0x3297 || cp == 0x3299

    /** 弹出文本末尾的一个删除单位。[Pair] 的 first=剩余文本，second=被
     *  弹出的单位；空串返回 null。纯函数，JVM 可单测。 */
    fun splitTailUnit(text: String): Pair<String, String>? {
        if (text.isEmpty()) return null
        val start = tailClusterStart(text)
        return text.substring(0, start) to text.substring(start)
    }

    /** 末尾 grapheme cluster 的起始 index。 */
    private fun tailClusterStart(s: String): Int {
        var start = stepBack(s, s.length)
        // 尾部修饰符链（肤色/变体选择符/tag 序列/keycap）整体粘附：从最
        // 末码点向前吃到第一个非修饰符为止——修饰符自己不能当 cluster
        // 基础（tag 旗帜 🏴󠁧… 的整个标签串都是 trailing，一起吃到黑旗
        // 码点为止，codex 二轮 P1-1）。
        while (start > 0 && isTrailingMark(s.codePointAt(start))) {
            start = stepBack(s, start)
        }
        val base = s.codePointAt(start)

        // Regional Indicator：GB12/13 的配对从连续段头起算——段内计数
        // 偶数取末两个、奇数取末一个（🇦🇧🇨 的尾单位是孤立的 🇨，
        // codex 二轮 P2-3）。基线把段头截在外的病态场景按局部计数近似。
        if (base in RI_LOW..RI_HIGH) {
            var count = 1
            var p = start
            while (true) {
                val prev = stepBack(s, p)
                if (prev < 0 || s.codePointAt(prev) !in RI_LOW..RI_HIGH) break
                p = prev
                count += 1
            }
            return if (count % 2 == 0) stepBack(s, start) else start
        }

        // ZWJ 链：基础 + ZWJ + 段 + … 整组是一个 cluster，从尾向头逐段收。
        // 只有 emoji 属性的段才跨 ZWJ 合并（GB11；普通字母夹 ZWJ 宿主按
        // 单字符删，吞整段会重复恢复前缀，codex 二轮 P2-4）。
        while (start > 0) {
            val zwjPos = stepBack(s, start)
            if (zwjPos < 0 || s.codePointAt(zwjPos) != ZWJ) break
            var segStart = stepBack(s, zwjPos)
            if (segStart < 0) break // 病态：串以 ZWJ 开头，把 ZWJ 留给本单位
            while (segStart > 0 && isTrailingMark(s.codePointAt(segStart))) {
                segStart = stepBack(s, segStart)
            }
            if (!isPictographic(s.codePointAt(segStart))) break
            start = segStart
        }
        return start
    }

    private fun isTrailingMark(cp: Int): Boolean =
        cp in SKIN_LOW..SKIN_HIGH || cp == VS15 || cp == VS16 ||
            cp == KEYCAP || cp == NO_ENTRY ||
            cp in TAG_LOW..TAG_HIGH || cp in MVS_LOW..MVS_HIGH

    /** [until] 前一个 code point 的起始 index；串首返回 -1。代理对不劈半。 */
    private fun stepBack(s: String, until: Int): Int {
        if (until <= 0) return -1
        val prev = until - 1
        return if (Character.isLowSurrogate(s[prev]) && prev > 0 &&
            Character.isHighSurrogate(s[prev - 1])
        ) prev - 1 else prev
    }
}
