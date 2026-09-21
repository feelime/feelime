package com.feelime.ime.update

/**
 * Native bridge contract shared by the IME service and the keyboard update
 * compatibility gate (design §8.1: minNativeApi and requiredCapabilities must
 * pass before a downloaded keyboard may be activated).
 */
object BridgeContract {
    const val NATIVE_API_VERSION = 1
    private const val MAX_COMPOSITION_CODE_POINTS = 32
    val CAPABILITIES = setOf(
        "text-input-v1",
        "candidate-revision-v1",
        "voice-session-v1",
        "voice-cancel-v1",
        "cursor-repeat-v1",
        // Cursor scrub accepts a bounded batch delta and resolves one
        // extracted snapshot by Unicode code point instead of querying once
        // per pixel/step.
        "cursor-delta-v1",
        "ime-control-v1",
        "keyboard-update-status-v1",
        "clipboard-v1",
        "favorites-v2",
        "panel-compose-v1",
        "commit-text-v1",
        "compose-control-v1",
        // Unicode setComposition accepts non-ASCII letters used by accent
        // variants and other locale-specific keyboard parses.
        "unicode-compose-v1",
        // The control-key layer sends raw key events with a
        // meta state (Ctrl+C, Alt+., Ctrl+Shift+V ...) into the host editor.
        "key-event-v1",
        "keyboard-height-reset-v1",
        // 手写识别（design/handwriting.md §3）：recognizeInk + onInkCandidates。
        "handwriting-v1",
    )

    fun isCompatible(minNativeApi: Long, requiredCapabilities: Collection<String>): Boolean =
        minNativeApi in 1..NATIVE_API_VERSION && requiredCapabilities.all(CAPABILITIES::contains)

    /**
     * Validate the Unicode key sequence used by the atomic setComposition
     * bridge call.  Iterate by code point so supplementary-plane letters are
     * accepted as one key instead of being rejected as surrogate halves.
     * ';' is a legal key code too: the sogou double-pinyin scheme puts its
     * ing final on the wide key, and parse-variant replays then carry ';'
     * (double-pinyin.md §2.1).
     *
     * [allowDigits] opens '2'..'9' for the T9 音节条重写（ni + 剩余数字的
     * 混合组合串）；仅 T9 模式传入，Direct/密码字段等组合通道不收数字。
     */
    fun isValidComposition(value: String, allowDigits: Boolean = false): Boolean {
        if (value.isEmpty() || value.codePointCount(0, value.length) > MAX_COMPOSITION_CODE_POINTS) {
            return false
        }
        var offset = 0
        while (offset < value.length) {
            val codePoint = value.codePointAt(offset)
            val mark = when (Character.getType(codePoint)) {
                Character.NON_SPACING_MARK.toInt(),
                Character.COMBINING_SPACING_MARK.toInt(),
                Character.ENCLOSING_MARK.toInt(),
                -> true
                else -> false
            }
            val digitOk = allowDigits && codePoint in '2'.code..'9'.code
            if (codePoint != '\''.code && codePoint != ';'.code &&
                !Character.isLetter(codePoint) && !mark && !digitOk
            ) return false
            offset += Character.charCount(codePoint)
        }
        return true
    }
}
