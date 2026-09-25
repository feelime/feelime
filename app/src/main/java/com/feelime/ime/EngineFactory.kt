package com.feelime.ime

import android.content.Context
import com.feelime.ime.engine.DirectTextEngine
import com.feelime.ime.engine.DoublePinyinScheme
import com.feelime.ime.engine.FuzzyPinyin
import com.feelime.ime.engine.HunspellTextEngine
import com.feelime.ime.engine.InputMode
import com.feelime.ime.engine.MozcTextEngine
import com.feelime.ime.engine.RimeTextEngine
import com.feelime.ime.engine.TextEngine

object InputModeBridge {
    private val byWire = com.feelime.ime.engine.InputMode.entries.associateBy { it.wireName }
    fun fromWire(wire: String): InputMode? = byWire[wire]
}

object EngineFactory {
    fun create(context: Context, mode: InputMode): TextEngine = when (mode) {
        InputMode.DIRECT -> DirectTextEngine()
        // 模糊音开启时用预编译的 fuzzy 变体（按掩码物化 prism）；其资产缺失
        // （部署不完整/变体缺失）时回落正宫，保证全拼模式始终可用。
        InputMode.PINYIN -> RimeTextEngine(
            context,
            com.feelime.ime.engine.EngineDataStore.fuzzySchemaId(context)
                ?: FuzzyPinyin.STRICT_SCHEMA_ID,
        )
        InputMode.DOUBLE_PINYIN -> RimeTextEngine(context, DoublePinyinScheme.schemaId(context))
        // T9 九宫格：数字键面（schema 侧 xlit 把音节表映射成数字串，
        // 见 scripts/generate-t9-schema.py）；资产缺失时由引擎数据
        // 就绪判定挡在模式菜单，不会走到这里。
        InputMode.T9 -> RimeTextEngine(context, "luna_pinyin_t9")
        // 笔画五键（issue #18）：GB2312 裁剪词典 + 单通配派生行，资产
        // 缺失时由引擎数据就绪判定挡在模式菜单。
        InputMode.STROKE -> RimeTextEngine(context, "feelime_stroke")
        InputMode.FRENCH -> HunspellTextEngine(context, "fr", "bonjour")
        InputMode.RUSSIAN -> HunspellTextEngine(context, "ru_RU", "ёлка")
        InputMode.JAPANESE -> MozcTextEngine(context)
        // 手写（design/handwriting.md §1）：笔迹识别在独立的
        // HandwritingEngine，不实现 TextEngine。这里的 Direct 只承载
        // 手写键面的控制键（退格/空格/回车）——同步起跑、无 warmup。
        InputMode.HANDWRITING -> DirectTextEngine()
    }
}
