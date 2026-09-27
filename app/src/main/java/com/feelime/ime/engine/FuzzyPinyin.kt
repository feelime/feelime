package com.feelime.ime.engine

import android.content.Context

/**
 * 全拼模糊音分组开关（issue #2）。原生持有选择（feelime_engine 偏好里的
 * 位掩码）：每位对应一组双向派生，全部关闭即回到严格 luna_pinyin。
 *
 * prism 是部署期产物（speller algebra 只在编译期生效），所以每组组合
 * 对应一个预编译变体 luna_pinyin_fuzzy_m{mask}.prism.bin，切换时由
 * [EngineDataStore.materializeFuzzyPrism] 复制为 schema 期望的
 * luna_pinyin_fuzzy.prism.bin（该名字不在 MANIFEST 里，不参与哈希校验）。
 * 未知/越界掩码一律视为关闭（0）。
 */
object FuzzyPinyin {
    const val PREF_FILE = "feelime_engine"
    const val PREF_KEY = "fuzzy_pinyin_mask"
    const val SCHEMA_ID = "luna_pinyin_fuzzy"
    const val STRICT_SCHEMA_ID = "luna_pinyin"

    /** 各分组一位；新增分组时同步 build_matrix.py 与设置页。 */
    const val BIT_PINGQIAOSHE = 1 // 平翘舌 z/zh c/ch s/sh
    const val BIT_NL = 2          // n/l
    const val BIT_FH = 4          // f/h
    const val BIT_RL = 8          // r/l
    const val BIT_NASAL = 16      // 前后鼻音 an/ang en/eng in/ing + ong→on
    const val MASK_ALL = 31
    private const val MASK_MAX = MASK_ALL

    fun mask(context: Context): Int {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        if (prefs.contains(PREF_KEY)) {
            val mask = prefs.getInt(PREF_KEY, 0)
            return if (mask in 0..MASK_MAX) mask else 0
        }
        // 迁移：旧布尔开关的语义 = 平翘舌 + n/l + 前后鼻音（19）。
        return if (prefs.getBoolean("fuzzy_pinyin", false)) {
            BIT_PINGQIAOSHE or BIT_NL or BIT_NASAL
        } else 0
    }

    fun set(context: Context, mask: Int) {
        val safe = if (mask in 0..MASK_MAX) mask else 0
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
            .edit().putInt(PREF_KEY, safe).commit()
    }

    fun on(context: Context): Boolean = mask(context) != 0
}
