package com.feelime.ime

import android.content.Context
import android.content.SharedPreferences
import java.util.Locale

/**
 * The product language is independent from the input method mode.
 *
 * The value stored in preferences is deliberately a small, stable wire value
 * (`auto`, `zh`, or `en`).  User visible text is selected from the resolved
 * locale at the edge through [t]; no translated value is ever persisted or
 * sent in the bridge state.
 */
object UiLanguage {
    const val PREFS = "feelime_ui"
    const val KEY_CHOICE = "ui_language"

    const val AUTO = "auto"
    const val ZH = "zh"
    const val EN = "en"

    val choices: List<String> = listOf(AUTO, ZH, EN)

    /** Return a valid wire value, or null when the caller supplied garbage. */
    fun normalizeChoice(raw: String?): String? = when (raw?.trim()?.lowercase(Locale.ROOT)) {
        AUTO -> AUTO
        ZH -> ZH
        EN -> EN
        else -> null
    }

    /**
     * Resolve a wire choice to one of the two locales we currently ship.
     * Exposing the system language as an argument keeps this decision easy to
     * test without a framework Context.
     */
    fun resolveLocale(choice: String?, systemLanguage: String = Locale.getDefault().language): String {
        return when (normalizeChoice(choice) ?: AUTO) {
            ZH -> ZH
            EN -> EN
            else -> if (systemLanguage.lowercase(Locale.ROOT).startsWith("zh")) ZH else EN
        }
    }

    fun preferences(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Stored choice. Missing and legacy invalid values both mean `auto`. */
    fun choice(context: Context): String =
        normalizeChoice(preferences(context).getString(KEY_CHOICE, AUTO)) ?: AUTO

    fun locale(context: Context): String = resolveLocale(choice(context))

    /**
     * Persist a choice after validation. `false` leaves preferences untouched,
     * which lets bridge callers report a stable BAD_UI_LANGUAGE code.
     */
    fun setChoice(context: Context, raw: String): Boolean {
        val choice = normalizeChoice(raw) ?: return false
        preferences(context).edit().putString(KEY_CHOICE, choice).commit()
        return true
    }

    fun isEnglish(context: Context): Boolean = locale(context) == EN

    fun text(context: Context, chinese: String, english: String): String =
        if (isEnglish(context)) english else chinese
}

/** Short call site helper for native prompts and bridge messages. */
fun t(context: Context, zh: String, en: String): String =
    UiLanguage.text(context, zh, en)
