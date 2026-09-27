package com.feelime.ime.engine

import android.content.Context

/**
 * 双拼方案选择（docs/design/double-pinyin.md §2）。原生持有选择
 * （feelime_engine 偏好），每次 hello 以 dpScheme 下发给键盘；键盘按它取
 * 解析变体表和 sep 键形态。未知 id（旧引擎、被改坏的偏好）回落到自然码——
 * 它的 prism 从 1.0 起就随包。
 */
object DoublePinyinScheme {
    const val PREF_FILE = "feelime_engine"
    const val PREF_KEY = "dp_scheme"

    // 方案 id → 编译出的 prism/schema 资产名（engine-data/rime/）。
    private val schemaIds = linkedMapOf(
        "ziranma" to "ziranma_double_pinyin",
        "flypy" to "double_pinyin_flypy",
        "sogou" to "double_pinyin_sogou",
        // 紫光（issue #16）：algebra 转写自 rime-frost，见 schema 注释。
        "ziguang" to "double_pinyin_ziguang",
    )

    fun resolve(context: Context): String {
        val stored = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
            .getString(PREF_KEY, null) ?: return "ziranma"
        return if (stored in schemaIds) stored else "ziranma"
    }

    fun schemaId(context: Context): String = schemaIds.getValue(resolve(context))

    /** 落盘；未知 id 返回 false（调用方负责报错）。 */
    fun set(context: Context, value: String): Boolean {
        if (value !in schemaIds) return false
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
            .edit().putString(PREF_KEY, value).commit()
        return true
    }
}
