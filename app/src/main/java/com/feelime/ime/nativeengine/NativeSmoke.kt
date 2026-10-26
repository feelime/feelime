package com.feelime.ime.nativeengine

/**
 * JNI surface bound by name to the prebuilt libfeelime_smoke.so (built by the
 * G1 reproducible chain; see third_party/manifest.json). Renaming this class
 * or any function breaks the static symbol resolution.
 */
object NativeSmoke {
    init { System.loadLibrary("feelime_smoke") }

    @JvmStatic external fun runRime(sharedDir: String, userDir: String): String
    @JvmStatic external fun runHunspell(
        frAff: String,
        frDic: String,
        ruAff: String,
        ruDic: String,
    ): String
    /** stagingDir = librime 的显式 staging 目录（maintenance 产物落点，
     *  运行时按 staging > prebuilt > shared 顺序解析）；传 <user>/build。
     *  null/空串回落 user 目录（兼容旧行为）。 */
    @JvmStatic external fun rimeInitialize(sharedDir: String, userDir: String, stagingDir: String?): Boolean
    /** issue #23: spawn librime's deployer thread (dict/prism rebuild) against
     *  the initialize() traits; bins land in <user>/build shadowing shared. */
    @JvmStatic external fun rimeStartMaintenance(fullCheck: Boolean): Boolean
    @JvmStatic external fun rimeIsMaintenanceMode(): Boolean
    /** Blocks until the deployer thread finishes - minutes on a big dict. */
    @JvmStatic external fun rimeJoinMaintenance()
    @JvmStatic external fun rimeCreateSession(schemaId: String): Long
    @JvmStatic external fun rimeProcessKey(session: Long, keyCode: Int, modifiers: Int): Boolean
    @JvmStatic external fun rimeSelectCandidate(session: Long, pageIndex: Int): Boolean
    /** #72 只读候选通道：绝对下标（整个候选列表的平铺序号）选/删，
     *  替代 seek 翻页+页内下标——翻页会挪 selector 高亮，污染
     *  stable-seg hint 的取材候选（nihlk 第 5 帧病态根因）。 */
    @JvmStatic external fun rimeSelectCandidateAbsolute(session: Long, index: Int): Boolean
    @JvmStatic external fun rimeDeleteCandidateAbsolute(session: Long, index: Int): Boolean
    /** 按应用页只读读取候选（不发键、不动高亮、不收 commit）。
     *  JSON: code(0 成功/-4 页越界) preedit candidates pageNo isLastPage hasNext */
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
