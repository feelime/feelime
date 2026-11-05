package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.Test

/** #78 中文数字 ITN：保守白名单转换（宁少转不误转）。 */
class ChineseNumberItnTest {

    @Test
    fun quantitiesAndDatesConvert() {
        assertEquals("买了3个苹果", ChineseNumberItn.apply("买了三个苹果"))
        assertEquals("一共1234块", ChineseNumberItn.apply("一共一千二百三十四块"))
        assertEquals("10月5号", ChineseNumberItn.apply("十月五号"))
        assertEquals("2026年", ChineseNumberItn.apply("二零二六年"))
        assertEquals("下午3点15分", ChineseNumberItn.apply("下午三点十五分"))
        assertEquals("15周年", ChineseNumberItn.apply("十五周年"))
        assertEquals("20楼", ChineseNumberItn.apply("二十楼"))
        assertEquals("第2条", ChineseNumberItn.apply("第二条"))
        assertEquals("5公里", ChineseNumberItn.apply("五公里"))
        assertEquals("100米", ChineseNumberItn.apply("一百米"))
    }

    @Test
    fun decimalsConvert() {
        assertEquals("3.14", ChineseNumberItn.apply("三点一四"))
        assertEquals("圆周率是3.1415", ChineseNumberItn.apply("圆周率是三点一四一五"))
        assertEquals("0.5米", ChineseNumberItn.apply("零点五米"))
    }

    @Test
    fun tailCompoundNumbersConvert() {
        assertEquals("一共12", ChineseNumberItn.apply("一共十二"))
        assertEquals("总共35", ChineseNumberItn.apply("总共三十五"))
    }

    @Test
    fun idiomsAndBareDigitsStay() {
        // 成语：段后无单位白名单词，原样
        assertEquals("一五一十地说", ChineseNumberItn.apply("一五一十地说"))
        assertEquals("三心二意", ChineseNumberItn.apply("三心二意"))
        // 句尾裸个位数不转
        assertEquals("我说一", ChineseNumberItn.apply("我说一"))
        // 逐位串无日期单位且不足 3 位不转
        assertEquals("密码三七", ChineseNumberItn.apply("密码三七"))
        // 「点」非小数语境（钟点表达在带单位时由单位链转换；纯「一点」句尾不动）
        assertEquals("一点", ChineseNumberItn.apply("一点"))
    }

    @Test
    fun mixedTextOnlyTouchesEligibleSegments() {
        assertEquals(
            "第3章有2节,共15页",
            ChineseNumberItn.apply("第三章有二节,共十五页"),
        )
        assertEquals("2026年11月5日", ChineseNumberItn.apply("二零二六年十一月五日"))
    }

    @Test
    fun parseZhNumberHandlesScaleWords() {
        assertEquals(10L, ChineseNumberItn.parseZhNumber("十"))
        assertEquals(15L, ChineseNumberItn.parseZhNumber("十五"))
        assertEquals(1234L, ChineseNumberItn.parseZhNumber("一千二百三十四"))
        assertEquals(20000L, ChineseNumberItn.parseZhNumber("两万"))
        assertEquals(100000000L, ChineseNumberItn.parseZhNumber("一亿"))
        assertEquals(105L, ChineseNumberItn.parseZhNumber("一百零五"))
        // 逐位式与歧形不收
        assertEquals(null, ChineseNumberItn.parseZhNumber("二零二六"))
        assertEquals(null, ChineseNumberItn.parseZhNumber("一五一十"))
    }
}
