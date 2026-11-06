package com.feelime.ime.engine

import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Test

/** #78 中文数字 ITN：结构层三态 + 开放面分类器（真资源）。 */
class ChineseNumberItnTest {

    companion object {
        @BeforeClass
        @JvmStatic
        fun loadClassifier() {
            // 开放面（三个/一次/第X 等）走真模型资源；结构层断言不依赖它
            runCatching {
                var dir = java.io.File(System.getProperty("user.dir") ?: ".")
                repeat(6) {
                    val m = java.io.File(dir, "src/main/assets/itn/itn-model.bin")
                    val l = java.io.File(dir, "src/main/assets/itn/itn-lexicon.bin")
                    if (m.isFile && l.isFile) {
                        ItnClassifier.loadFiles(m, l)
                        ChineseNumberItn.classifier = ItnClassifier
                        return@runCatching
                    }
                    dir = dir.parentFile ?: return@repeat
                }
            }
        }
    }

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
        assertEquals("30.5", ChineseNumberItn.apply("三十点五"))
        // codex #1：整数段先转换后回删会吃掉正文——必须整段一次成形
        assertEquals("价格是123.45元", ChineseNumberItn.apply("价格是一百二十三点四五元"))
        // codex #7：单位小数（分/秒）是钟点，保留点字；数值式分钟
        assertEquals("下午3点5分", ChineseNumberItn.apply("下午三点五分"))
        assertEquals("10点20分", ChineseNumberItn.apply("十点二十分"))
        assertEquals("3点05分", ChineseNumberItn.apply("三点零五分"))
        // 「一刻」不进小数语境（3.1 是错值），钟点整数部仍转
        assertEquals("3点一刻", ChineseNumberItn.apply("三点一刻"))
        // 「一点」的稍微义/成语语境不转（frac 为空或非数字）
        assertEquals("一点意见都没有", ChineseNumberItn.apply("一点意见都没有"))
    }

    @Test
    fun codexRegressions() {
        // codex #2：亿位后再遇万，旧算法把亿级总量再乘万
        assertEquals("120000000个", ChineseNumberItn.apply("一亿两千万个"))
        assertEquals(120000000L, ChineseNumberItn.parseZhNumber("一亿两千万"))
        assertEquals(100000000L, ChineseNumberItn.parseZhNumber("一亿"))
        assertEquals(12000000L, ChineseNumberItn.parseZhNumber("一千二百万"))
        // codex #8：「十分」程度副词黑名单
        assertEquals("十分满意", ChineseNumberItn.apply("十分满意"))
        // codex #9：纯字形编号保前导零（先走数值解析会丢）
        assertEquals("007号", ChineseNumberItn.apply("零零七号"))
        assertEquals("三心二意", ChineseNumberItn.apply("三心二意"))
    }

    @Test
    fun tailCompoundNumbersConvert() {
        assertEquals("一共12", ChineseNumberItn.apply("一共十二"))
        assertEquals("总共35", ChineseNumberItn.apply("总共三十五"))
        // 长组合数值链没有习语形态，句尾结构层直转（ace 验收实录：
        // 一亿五千万三千五百六十 曾被分类器保守 KEEP）
        assertEquals("人口150003560", ChineseNumberItn.apply("人口一亿五千万三千五百六十"))
        assertEquals("价值15000", ChineseNumberItn.apply("价值一万五千"))
        // 短组合数值（≤3字）仍是开放面：习语双栖由分类器裁决
        assertEquals("别二百五", ChineseNumberItn.apply("别二百五"))
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
        // 相邻个位概数保持汉字（真实语料实证：两三岁/三四个人/三五成群）
        assertEquals("也就两三岁", ChineseNumberItn.apply("也就两三岁"))
        assertEquals("门口站着三四个人", ChineseNumberItn.apply("门口站着三四个人"))
        // 白名单剔除里/行后的构词安全
        assertEquals("差了十万八千里", ChineseNumberItn.apply("差了十万八千里"))
        assertEquals("三百六十行行行出状元", ChineseNumberItn.apply("三百六十行行行出状元"))
        // 含数字的常用词：后字不在单位白名单，原样（起/共/生 都不是量词）
        assertEquals("我们一起去吧", ChineseNumberItn.apply("我们一起去吧"))
        assertEquals("一共", ChineseNumberItn.apply("一共"))
        assertEquals("十二生肖", ChineseNumberItn.apply("十二生肖"))
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
