package com.feelime.ime

/** 语音识别设置（feelime_asr prefs）： 的两个用户可调项。 */
object AsrSettings {
    const val PREFS = "feelime_asr"
    /** true = 语音结果剥掉句尾句号（默认， 行为）。 */
    const val KEY_STRIP_FINAL_PERIOD = "strip_final_period"
    /** true = 最终文本把汉字数字按规则转阿拉伯（数量/日期/小数，issue #78）。
     *  默认关：不动存量用户的输出感知。 */
    const val KEY_ITN = "asr_number_itn"
    /** 热词表，一行一个。 */
    const val KEY_HOTWORDS = "hotwords"
    /** 默认常驻；开启后录音结束空闲五分钟卸载，下次使用重新加载。 */
    const val KEY_IDLE_UNLOAD = "idle_unload"
}
