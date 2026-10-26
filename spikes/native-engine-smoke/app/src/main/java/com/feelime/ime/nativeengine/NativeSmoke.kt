package com.feelime.ime.nativeengine

object NativeSmoke {
    init {
        System.loadLibrary("feelime_smoke")
    }

    @JvmStatic external fun runRime(sharedDir: String, userDir: String): String
    @JvmStatic external fun runHunspell(
        frAff: String,
        frDic: String,
        ruAff: String,
        ruDic: String,
    ): String

    @JvmStatic external fun rimeInitialize(sharedDir: String, userDir: String): Boolean
    @JvmStatic external fun rimeCreateSession(schemaId: String): Long
    @JvmStatic external fun rimeProcessKey(session: Long, keyCode: Int, modifiers: Int): Boolean
    @JvmStatic external fun rimeSelectCandidate(session: Long, pageIndex: Int): Boolean
    @JvmStatic external fun rimeSelectCandidateAbsolute(session: Long, index: Int): Boolean
    @JvmStatic external fun rimeDeleteCandidateAbsolute(session: Long, index: Int): Boolean
    @JvmStatic external fun rimeContextAtPage(session: Long, viewPage: Int): String
    @JvmStatic external fun rimeContext(session: Long): String
    @JvmStatic external fun rimeCommit(session: Long): String
    @JvmStatic external fun rimeDestroySession(session: Long)
    @JvmStatic external fun rimeFinalize()

    @JvmStatic external fun hunspellCreate(affPath: String, dicPath: String): Long
    @JvmStatic external fun hunspellSpell(handle: Long, word: String): Int
    @JvmStatic external fun hunspellSuggest(handle: Long, word: String): String
    @JvmStatic external fun hunspellDestroy(handle: Long)
}
