package com.feelime.ime.engine

/** Final engine command contract from design.md section 5.1. */
enum class InputMode(val wireName: String) {
    DIRECT("direct"),
    PINYIN("pinyin"),
    DOUBLE_PINYIN("double-pinyin"),
    T9("t9"),
    STROKE("stroke"),
    JAPANESE("japanese"),
    FRENCH("french"),
    RUSSIAN("russian"),
    // 手写（design/handwriting.md §1）：模式注册只为 hello/selectMode 的
    // 模式簿记，笔迹走独立的 HandwritingEngine（recognizeInk），从不进
    // Key/Backspace 命令契约；控制键（退格/空格/回车）由 Direct 承载
    // （TextInputCoordinator.servesDirectly 同步起跑，无 warmup）。
    HANDWRITING("handwriting"),
}

data class EngineStamp(
    val editorGeneration: Long,
    val engineSessionGeneration: Long,
    val mode: InputMode,
)

data class Candidate(val id: String, val text: String)

data class EngineState(
    val composing: String,
    val rawInput: String,
    val candidates: List<Candidate>,
    val hasPreviousPage: Boolean,
    val hasNextPage: Boolean,
    val commit: String? = null,
)

data class EngineRequest(
    val stamp: EngineStamp,
    val command: EngineCommand,
)

sealed interface EngineCommand {
    data object Start : EngineCommand
    data class Key(val unicodeScalar: Int, val modifiers: Int) : EngineCommand
    data object Backspace : EngineCommand
    data object Space : EngineCommand
    data object EnterRaw : EngineCommand
    data class Choose(val expectedRevision: Long, val candidateId: String) : EngineCommand
    data class PageNext(val expectedRevision: Long) : EngineCommand
    data class PagePrevious(val expectedRevision: Long) : EngineCommand

    /** 删除当前高亮候选（librime 的 Shift+Delete 删自造词
     * 通道）。高亮候选由引擎维护，命令不带参数。 */
    data object DeleteHighlighted : EngineCommand

    /** 删除任意候选——先翻到候选所在页，再按 Down 移动高亮到
     * 页内位次（librime selector 的 XK_Down=NextCandidate），最后 Shift+Delete。 */
    data class DeleteCandidate(val candidateId: String) : EngineCommand
    data object Reset : EngineCommand
    data object Close : EngineCommand
}

enum class EngineCode {
    OK, STALE_STAMP, STALE_REVISION, INVALID_COMMAND,
    PAGE_BOUNDARY, EMPTY_COMPOSING, ENGINE_INIT_FAILED,
    ENGINE_DATA_MISMATCH, ENGINE_RUNTIME_FAILED, ENGINE_CLOSED, NOT_DELETABLE,
}

enum class Phase { LOADING, READY, CLOSED, ERROR }

/** Why the coordinator settled on the Direct engine (design: mode-fallback §2).
 *  The reason rides the degrade notification and diagnostics logs — never the
 *  user's input text. */
enum class DegradeReason {
    WARMUP_TIMEOUT, QUEUE_OVERFLOW, ENGINE_FACTORY_FAILED,
    ENGINE_INIT_FAILED, ENGINE_DATA_MISMATCH, ENGINE_RUNTIME_FAILED,
}

/** Persistent degraded state: which user mode failed and why. `seq` advances
 *  on EVERY degrade transition so each failure can notify once (a retry that
 *  fails again must toast again). Cleared when a real engine for the failed
 *  mode lands, or when the user/an editor lifecycle picks a mode deliberately
 *  (transition table in mode-fallback §2.2). */
data class DegradeState(
    val failedMode: InputMode,
    val reason: DegradeReason,
    val seq: Long,
)

sealed interface DispatchAck {
    data object Accepted : DispatchAck
    data class Rejected(val code: EngineCode) : DispatchAck
}

data class EngineEvent(
    val stamp: EngineStamp,
    val revision: Long,
    val phase: Phase,
    val state: EngineState,
    val consumed: Boolean,
    val code: EngineCode,
    /** Set only on the coordinator's synthetic degrade/recover notification
     *  events; engines never produce these. */
    val degrade: DegradeState? = null,
    /** True when the degrade is (still) serving — the degrade notification
     *  and the hello restore both carry it; false only on the recovery
     *  notification. */
    val degradedActive: Boolean = false,
)

fun interface TextEngine {
    fun dispatch(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck
}
