package com.feelime.ime.engine

import java.util.concurrent.Executor

/**
 * Owns editor/session generations, validates every engine event against the
 * current EngineStamp, applies committed text to the editor and runs the
 * section 5.4 deletion cascade for unconsumed backspaces.  All public methods
 * must be called from the poster's target thread (the Android main thread in
 * production; inline in JVM tests).
 *
 * Slow engines follow the Direct-first state machine (design section 9): the
 * target engine's Start runs asynchronously against a *pending* stamp while
 * keys typed during warmup are ACCEPTED and queued (). The queue is
 * replayed into whichever engine wins — the target after READY, or the
 * no-learning Direct engine after a failure — so no keystroke is lost and no
 * word is ever split across two engines. During warmup the coordinator only
 * publishes LOADING; READY is never claimed before the target engine can
 * actually produce state.
 */
class TextInputCoordinator(
    private val editor: EditorPort,
    private val listener: (EngineEvent) -> Unit,
    private val engineFactory: (InputMode) -> TextEngine,
    private val asrGuard: () -> Unit = {},
    private val mainPoster: (() -> Unit) -> Unit = { it() },
    private val background: Executor? = null,
    private val modeStore: ModeStore? = null,
    private val delayPoster: ((Long, () -> Unit) -> Unit)? = null,
    /** 诊断事件出口（Diagnostics 环形缓冲）。本类保持 JVM 无 android 依赖，
     *  由 service 注入；关闭诊断时 sink 内部直接丢弃。行内绝无文本内容。 */
    val diagnosticSink: ((String) -> Unit)? = null,
) {
    /** process-death-safe persistence of the user's selected mode. */
    interface ModeStore {
        fun save(mode: InputMode)

        fun load(): InputMode?
    }

    private var editorGeneration = 0L
    private var engineSessionGeneration = 0L
    /** 诊断用：当前 startEngine 的打点（warmup 耗时 = READY - start）。 */
    private var engineStartAt = 0L
    private var mode: InputMode = InputMode.DIRECT
    private var savedUserMode: InputMode = modeStore?.load() ?: InputMode.DIRECT
    /** True once the LIVE engine is the real target (not interim/fallback). */
    private var engineMatchesMode = true
    private var inPasswordField = false

    /** 诊断埋点（双拼字母直上屏故障分析）：只有开关打开时 sink 才落盘。 */
    private fun diag(message: String) {
        diagnosticSink?.invoke(message)
    }

    private fun degradeSummary(): String =
        degraded?.let { "${it.failedMode?.wireName}/${it.reason.name}/seq=${it.seq}" } ?: "none"

    private var engine: TextEngine = DirectTextEngine()
    private var stamp: EngineStamp = EngineStamp(editorGeneration, engineSessionGeneration, mode)
    private var lastAppliedRevision = 0L
    private var closed = false
    /** Whether [engine] ever got a Start. The warmup's interim Direct is
     *  created un-started — its Close would be rejected WITHOUT a callback,
     *  which the recreate chain once deadlocked on (mode-fallback §2.4). */
    private var liveEngineStarted = true

    private var pendingEngine: TextEngine? = null
    private var pendingStamp: EngineStamp? = null
    private var pendingLastRevision = 0L

    /** Close bookkeeping for swap gating (mode-fallback §2.4): a recreate's
     *  swap must wait for EVERY close in flight when it starts — its own,
     *  a superseded recreate's, a degrade's — plus inherit engines whose
     *  close ever FAILED. A rejected re-close proves nothing (the engine may
     *  still hold the userdb dir), so those block swaps for good. */
    private class CloseState {
        var dispatched = false
    }
    private val closeStates = HashMap<TextEngine, CloseState>()
    private val closeFailed = java.util.Collections.newSetFromMap(
        java.util.concurrent.ConcurrentHashMap<TextEngine, Boolean>(),
    )
    /** (watched closes, decision) pairs — see recreateEngineSession. */
    private val swapWaits = mutableListOf<
        Pair<MutableMap<TextEngine, Boolean?>, (Boolean) -> Unit>>()

    /** Set while the live engine is a degraded Direct standing in for a failed
     *  target (mode-fallback §2). One notification per transition; `seq`
     *  advances on every degrade so a retry that fails again notifies again. */
    private var degraded: DegradeState? = null
    private var degradeSeq = 0L
    /** Identifies one recreateEngineSession operation end-to-end (mode-fallback
     *  §2.4): late callbacks from a superseded recreate must not run its swap.
     *  @Volatile: the close/swap chain re-checks it on a background thread. */
    @Volatile
    private var recreateGeneration = 0L

    private sealed interface QueuedInput {
        data class Command(val value: EngineCommand) : QueuedInput
        data class Mode(val value: InputMode) : QueuedInput
        data class Accept(val after: () -> Unit) : QueuedInput
        data class Literal(val text: String) : QueuedInput
    }
    private val warmupQueue = ArrayDeque<QueuedInput>()
    private var warmupReplayGeneration = 0L
    private var replaying = false
    /** Queue cap hit while a dispatched command is still in flight: degrading
     *  immediately would re-stamp the session and orphan that command's event
     *  (its commit would be dropped by the stamp check = a lost keystroke).
     *  The degrade is deferred to the next quiescent point of the replay
     *  (mode-fallback §2.5) instead. */
    private var overflowPending = false
    private var composingActive = false
    /** The raw pinyin no longer enters the editor, so the
     * coordinator keeps the buffer here - it must be landable when a literal
     * (flick/symbol/popup pick) arrives mid-composition. */
    private var composingRaw: String = ""
    private var lastEnterConsumedComposing = false

    /**
     * A Hunspell word commit is editor text plus one trailing space. Keep a
     * small local undo transaction so the first Backspace can remove that
     * space and reopen the word in the same engine. The transaction is tied to
     * both editor/session generations and a local mutation generation; it is
     * never reconstructed by synchronously reading host text.
     */
    private data class LastWordCommit(
        val word: String,
        val editorGeneration: Long,
        val engineSessionGeneration: Long,
        val mode: InputMode,
        val mutationGeneration: Long,
        val start: Int,
        val end: Int,
        val automaticSpace: Boolean,
    )

    private var editorMutationGeneration = 0L
    private var lastWordCommit: LastWordCommit? = null
    private var predictedSelectionStart = -1
    private var predictedSelectionEnd = -1
    private val expectedSelections = ArrayDeque<Pair<Int, Int>>()

    val currentMode: InputMode get() = mode
    val currentStamp: EngineStamp get() = stamp
    val engineWarming: Boolean get() = pendingEngine != null
    val enterConsumedComposing: Boolean get() = lastEnterConsumedComposing

    /** Persistent degraded state for hello/event payloads (null = healthy). */
    val engineDegrade: DegradeState? get() = degraded

    /** Host selection/caret changed outside a coordinator operation. */
    fun onEditorSelectionChanged(
        oldSelStart: Int,
        oldSelEnd: Int,
        newSelStart: Int,
        newSelEnd: Int,
    ) {
        val actual = newSelStart to newSelEnd
        val own = expectedSelections.lastIndexOf(actual)
        if (own >= 0) {
            repeat(own + 1) { expectedSelections.removeFirst() }
            return
        }
        predictedSelectionStart = newSelStart
        predictedSelectionEnd = newSelEnd
        onExternalEditorMutation()
    }

    /** A host mutation invalidates both word ownership and pending predictions. */
    fun onExternalEditorMutation() {
        expectedSelections.clear()
        invalidateWordUndo()
    }

    private fun invalidateWordUndo() {
        editorMutationGeneration += 1
        lastWordCommit = null
    }

    /** Switch between the host and keyboard-owned input, or receive an
     * explicit DOM caret edit. Coordinates never carry across input targets. */
    fun onInputTargetSelection(start: Int, end: Int) {
        onExternalEditorMutation()
        predictedSelectionStart = start
        predictedSelectionEnd = end
        // The DOM accepted any old span before reporting an explicit caret
        // change. Reset only the engine so the next key starts a new word.
        if (composingActive) {
            composingActive = false
            composingRaw = ""
            dispatch(EngineCommand.Reset)
        }
    }

    /** 拼音族（全拼/双拼/T9）：preedit 只在键盘 UI（候选条/preedit 行），
     * 宿主编辑器不落组合串；其余模式保持经典 span 语义（IN-04）。 */
    private fun isPinyinFamily(mode: InputMode): Boolean =
        mode == InputMode.PINYIN || mode == InputMode.DOUBLE_PINYIN || mode == InputMode.T9 ||
            mode == InputMode.STROKE

    private fun expectReplacement(length: Int) {
        if (predictedSelectionStart < 0 || predictedSelectionEnd < 0) return
        val start = if (composingActive && !isPinyinFamily(mode)) predictedSelectionEnd - composingRaw.length
            else minOf(predictedSelectionStart, predictedSelectionEnd)
        val target = (start + length).coerceAtLeast(0)
        predictedSelectionStart = target
        predictedSelectionEnd = target
        expectedSelections.addLast(target to target)
    }

    fun onEditorStarted(sensitive: Boolean, terminalLike: Boolean = false, initialSelectionStart: Int = 0, initialSelectionEnd: Int = initialSelectionStart) {
        asrGuard()
        invalidateWordUndo()
        expectedSelections.clear()
        predictedSelectionStart = initialSelectionStart
        predictedSelectionEnd = initialSelectionEnd
        warmupQueue.clear()
        overflowPending = false
        // A new editor session supersedes any in-flight recreate (mode-fallback
        // §2.4): its close/swap chain re-checks recreateGeneration at every
        // step, so bumping it here strands the old operation before it can
        // swap the userdb under the freshly opened session.
        recreateGeneration += 1
        abandonPending()
        if (sensitive) {
            // The production password-field entry must perform the same
            // synchronous scrub as enterPasswordField(): clear any composing
            // span before an old callback can be rendered into the new field.
            editor.setComposing("")
            editor.finishComposing()
            composingActive = false
        }
        // close the live engine before opening the new session so
        // native sessions cannot leak across editor transitions.
        closeEngineSession()
        editorGeneration += 1
        newSession()
        inPasswordField = sensitive
        diag("editorStart gen=$editorGeneration sensitive=$sensitive terminal=$terminalLike")
        if (sensitive) {
            // Password fields must stay on Direct: composition spans must
            // never render into them (see enterPasswordField).
            startEngine(InputMode.DIRECT)
        } else {
            // Terminal (TYPE_NULL) editors no longer force Direct -
            // the user picks the mode. Deletion already rides real Backspace
            // key events and cursor scrub rides arrow key events on such
            // editors, so committed text (candidates/Direct keys) reaches the
            // shell regardless of the engine. Composing-span alphabetic
            // modes (French/Russian) still do not echo on a dummy
            // InputConnection - a declared limitation, not a restriction.
            startEngine(savedUserMode)
        }
    }

    enum class ModeSelectionResult {
        ACCEPTED,
        ALREADY_ACTIVE,
        BLOCKED_SENSITIVE_EDITOR,
    }

    fun selectMode(next: InputMode): ModeSelectionResult {
        // A same-mode request is harmless even when the current editor is a
        // restricted one.  The keyboard can use this result to avoid showing
        // a warning for a tap on the already-selected Direct row.
        if (next == mode && engineIsActive() && engineMatchesMode) {
            return ModeSelectionResult.ALREADY_ACTIVE
        }
        // Only password fields restrict the mode; terminal editors accept
        // every mode (user request: terminals are not forced to
        // English Direct any more).
        if (inPasswordField) return ModeSelectionResult.BLOCKED_SENSITIVE_EDITOR
        invalidateWordUndo()

        if (pendingEngine != null || replaying) {
            enqueueQueued(QueuedInput.Mode(next))
            savedUserMode = next
            modeStore?.save(next)
            return ModeSelectionResult.ACCEPTED
        }

        // A same-mode switch must still re-attempt the real engine when the
        // interim/fallback Direct engine is serving (pending never landed).
        acceptCurrentComposition()
        savedUserMode = next
        modeStore?.save(next)
        closeEngineSession()
        abandonPending()
        newSession()
        startEngine(next)
        return ModeSelectionResult.ACCEPTED
    }

    /**
     * userdata 导入后重建引擎会话（docs/design/userdata.md §1.2）：
     * rime/mozc 的用户目录在引擎初始化时打开，二次初始化会死锁
     * （keyboard.md §8），所以换目录必须卡在关会话与开新会话之间——
     * [swapUserdb] 就是那个卡点。
     *
     * 与 selectMode 的同步链不同，这里必须「等旧引擎 Close 真正执行完」
     * 再换目录：Close 是排进引擎线程的异步命令，不等就会和旧引擎的
     * 收尾写入赛跑。
     *
     * 串行协议（mode-fallback §2.4，修「warmup 中 recreate 死链」）：
     * 主线程一次性捕获全部身份并**先摘除 pending**（此后迟到的超时/READY
     * 回调身份检查必然失配，无法插进本链）；live 引擎按捕获的启动生命
     * 周期决定是否需要 Close——warmup 的 interim Direct 未启动，其 Close
     * 会被 STALE_STAMP **拒绝且不回调**（旧实现恰死在这里），直接续接；
     * Close 回调 ERROR → 放弃 swap（引擎可能仍握着目录），在原目录重启。
     * recreateGeneration 让被新编辑器/新 recreate 取代的旧链全部丢弃
     * （swap 一旦发生无法撤销，只能如实记日志）。须在主线程调用。
     */
    fun recreateEngineSession(swapUserdb: () -> Unit) {
        acceptCurrentComposition()
        recreateGeneration += 1
        val gen = recreateGeneration
        val live = engine
        val liveStamp = stamp
        val liveWasStarted = liveEngineStarted
        val warmupEngine = pendingEngine
        val warmupStamp = pendingStamp
        pendingEngine = null
        pendingStamp = null
        pendingLastRevision = 0
        closed = true

        fun beginSession() = mainPoster {
            if (gen != recreateGeneration) return@mainPoster
            abandonPending()
            newSession()
            diag("recreateBegin mode=${mode.wireName}")
            // 与 endVoiceSession 同规则：降级态下重建 = 重试失败模式。
            startEngine(if (inPasswordField) InputMode.DIRECT else degraded?.failedMode ?: mode)
        }

        fun swapAndBegin() {
            // Background-thread guard: a stale read at worst lets one
            // redundant swap run; beginSession re-checks on the main thread.
            if (gen != recreateGeneration) return
            runCatching { swapUserdb() }
                .onFailure { android.util.Log.w("FeelimeEngine", "userdb swap failed", it) }
            beginSession()
        }

        fun decide(allOk: Boolean) {
            if (gen != recreateGeneration) return
            if (allOk) {
                // The decision fires from settleClose on the MAIN thread;
                // the swap walks and deletes user directories — keep it off
                // the main thread (round-5 review).
                if (background != null) background.execute { swapAndBegin() }
                else swapAndBegin()
            } else {
                println("FeelimeEngine: recreate close failed; swap aborted")
                beginSession()
            }
        }

        // The swap renames the userdb directory ANY closing engine may still
        // hold open, so it waits for every close this recreate concerns AND
        // every close already in flight (a superseded recreate's, a degrade's)
        // — plus every engine whose close ever failed. A mere Rejected ack
        // never counts as a safe close (mode-fallback §2.4, round-4 review).
        val watch = LinkedHashMap<TextEngine, Boolean?>()
        if (liveWasStarted) watch[live] = null
        if (warmupEngine != null && warmupStamp != null) watch[warmupEngine] = null
        for (failedEngine in closeFailed) watch.putIfAbsent(failedEngine, false)
        for ((busyEngine, state) in closeStates) {
            if (state.dispatched) watch.putIfAbsent(busyEngine, null)
        }
        if (watch.isEmpty()) {
            decide(true)
            return
        }
        swapWaits.add(watch to { allOk -> decide(allOk) })

        if (liveWasStarted) beginClose(live, liveStamp, background)
        if (warmupEngine != null && warmupStamp != null) {
            beginClose(warmupEngine, warmupStamp, background)
        }
        scanSwapWaits()
    }

    /** Initiate a close of [engine]; later calls for the same engine join the
     *  in-flight one instead of re-dispatching. The outcome reaches swap
     *  decisions through [settleClose] updating every watch map. */
    private fun beginClose(
        engine: TextEngine,
        stamp: EngineStamp,
        executor: java.util.concurrent.Executor?,
    ) {
        if (engine in closeFailed) return
        val state = closeStates.getOrPut(engine) { CloseState() }
        if (state.dispatched) return
        state.dispatched = true
        val dispatch = Runnable {
            val ack = engine.dispatch(EngineRequest(stamp, EngineCommand.Close)) { event ->
                mainPoster {
                    // Ordinary close semantics first (generation bump,
                    // listener) — stamp checks drop events that no longer
                    // belong to the current session. The command tag keeps
                    // the ERROR arm from degrading on a failed CLOSE: the
                    // engine did not fail while serving; the bookkeeping
                    // owns that consequence (round-5 review).
                    onEngineEvent(event, EngineCommand.Close)
                    settleClose(engine, event.phase != Phase.ERROR)
                }
            }
            if (ack != DispatchAck.Accepted) {
                mainPoster { settleClose(engine, true) }
            }
        }
        if (executor != null) executor.execute(dispatch) else dispatch.run()
    }

    private fun settleClose(engine: TextEngine, ok: Boolean) {
        if (!ok) closeFailed.add(engine)
        if (closeStates.remove(engine) == null) return
        // Central watch update: a recreate watching an engine it does not
        // own (inherited in-flight close) has no waiter here — the watch map
        // is the only channel (round-4 review probe).
        swapWaits.forEach { (watch, _) -> if (engine in watch) watch[engine] = ok }
        scanSwapWaits()
    }

    /** Fire every recreate decision whose watched closes are all settled —
     *  or any of which failed (a failure aborts the swap immediately). */
    private fun scanSwapWaits() {
        if (swapWaits.isEmpty()) return
        val decided = mutableListOf<Pair<(Boolean) -> Unit, Boolean>>()
        val iterator = swapWaits.iterator()
        while (iterator.hasNext()) {
            val (watch, decide) = iterator.next()
            when {
                watch.values.any { it == false } -> {
                    iterator.remove()
                    decided.add(decide to false)
                }
                watch.values.all { it != null } -> {
                    iterator.remove()
                    decided.add(decide to true)
                }
                else -> {}
            }
        }
        decided.forEach { (decide, ok) -> decide(ok) }
    }

    /**
     * Accept and clear the composition owned by this coordinator.  Chinese
     * engines expose raw pinyin only to the keyboard UI, so it is committed
     * explicitly.  Alphabetic modes expose an editor composing span, so
     * finishing that span performs the single landing operation.
     *
     * Local state is cleared before Reset because its empty event may arrive
     * synchronously or later on the main thread; either way it must not land
     * the same text twice.  This operation is explicit so an ordinary input
     * view teardown does not turn into a global commit.
     */
    fun acceptCurrentComposition(): DispatchAck = acceptCurrentComposition { }

    /**
     * Variant used by system-IME switching.  If the target engine is still
     * warming, wait for its queued commands to replay before invoking
     * [after]; switching the system IME immediately would strand that queue.
     */
    fun acceptCurrentComposition(after: () -> Unit): DispatchAck {
        invalidateWordUndo()
        if (pendingEngine != null || replaying) {
            return enqueueQueued(QueuedInput.Accept(after))
        }
        val ack = acceptCurrentCompositionNow()
        after()
        return ack
    }

    private fun acceptCurrentCompositionNow(): DispatchAck {
        if (!composingActive) return DispatchAck.Accepted

        val raw = composingRaw.replace(" ", "")
        val rawMode = isPinyinFamily(mode)
        composingActive = false
        composingRaw = ""
        val ack = dispatchLive(EngineCommand.Reset)
        if (rawMode) {
            if (raw.isNotEmpty()) editor.commitText(raw)
        } else {
            editor.finishComposing()
        }
        return ack
    }

    fun enterPasswordField() {
        if (inPasswordField) return
        asrGuard()
        invalidateWordUndo()
        inPasswordField = true
        warmupQueue.clear()
        abandonPending()
        editor.setComposing("")
        editor.finishComposing()
        composingActive = false
        closeEngineSession()
        editorGeneration += 1
        newSession()
        startEngine(InputMode.DIRECT)
    }

    fun leavePasswordField() {
        if (!inPasswordField) return
        invalidateWordUndo()
        inPasswordField = false
        warmupQueue.clear()
        closeEngineSession()
        abandonPending()
        editorGeneration += 1
        newSession()
        startEngine(savedUserMode)
    }

    /**
     * Begin voice mode after the current composition has landed. The
     * continuation may sit in warmupQueue while a target engine is loading;
     * callers that own a wider editor lifecycle should provide [isCurrent] so
     * a late continuation cannot close or reset a replacement editor's
     * engine.
     */
    fun beginVoiceSession(after: () -> Unit = {}) {
        beginVoiceSession(isCurrent = { true }, after = after)
    }

    fun beginVoiceSession(isCurrent: () -> Boolean, after: () -> Unit) {
        acceptCurrentComposition {
            if (!isCurrent()) return@acceptCurrentComposition
            closeEngineSession()
            abandonPending()
            newSession()
            after()
        }
    }

    fun endVoiceSession() {
        invalidateWordUndo()
        diag("endVoiceSession mode=${mode.wireName} inPasswordField=$inPasswordField")
        newSession()
        // 降级态下语音结束 = 重试失败模式（mode-fallback §2.2：与重绑同
        // 规则，重试中保留降级、落地 READY 清除）。旧实现用 mode（降级
        // 后已是 DIRECT）→ 静默续跑英文直出还清了角标，用户无感知。
        startEngine(if (inPasswordField) InputMode.DIRECT else degraded?.failedMode ?: mode)
    }

    fun key(unicodeScalar: Int): DispatchAck {
        if (!isWordPunctuation(unicodeScalar)) invalidateWordUndo()
        return dispatch(EngineCommand.Key(unicodeScalar, 0))
    }

    /**
     * Parse-variant switch: rewind the composition and retype [keys]
     * inside ONE bridge call. Every command still emits its own engine event,
     * but they are all enqueued before the WebView renders again - the JS
     * side freezes on its chosen parse until the final echo lands, so the
     * user never sees the delete-and-retype.
     */
    fun setComposition(keys: String): DispatchAck {
        asrGuard()
        invalidateWordUndo()
        dispatch(EngineCommand.Reset)
        editor.setComposing("")
        editor.finishComposing()
        composingActive = false
        var ack: DispatchAck = DispatchAck.Accepted
        for (ch in keys) {
            ack = dispatch(EngineCommand.Key(ch.code, 0))
            if (ack != DispatchAck.Accepted) break
        }
        return ack
    }

    fun space(): DispatchAck {
        invalidateWordUndo()
        return dispatch(EngineCommand.Space)
    }

    fun backspace(): DispatchAck {
        val undo = lastWordCommit
        if (!replaying && undo != null && canReopen(undo)) return reopenLastWord(undo)
        invalidateWordUndo()
        return dispatch(EngineCommand.Backspace)
    }

    fun enterRaw(): DispatchAck {
        invalidateWordUndo()
        lastEnterConsumedComposing = false
        return dispatch(EngineCommand.EnterRaw)
    }

    fun choose(expectedRevision: Long, candidateId: String): DispatchAck {
        invalidateWordUndo()
        return dispatch(EngineCommand.Choose(expectedRevision, candidateId))
    }

    /** 删除当前高亮候选（librime Shift+Delete 通道）。 */
    fun deleteHighlighted(): DispatchAck {
        invalidateWordUndo()
        return dispatch(EngineCommand.DeleteHighlighted)
    }

    /** 删除任意候选（seek 到所在页 + Down 移高亮 + Shift+Delete）。 */
    fun deleteCandidate(candidateId: String): DispatchAck {
        invalidateWordUndo()
        return dispatch(EngineCommand.DeleteCandidate(candidateId))
    }

    fun pageNext(expectedRevision: Long): DispatchAck {
        return dispatch(EngineCommand.PageNext(expectedRevision))
    }

    fun pagePrevious(expectedRevision: Long): DispatchAck {
        return dispatch(EngineCommand.PagePrevious(expectedRevision))
    }

    fun reset(): DispatchAck {
        invalidateWordUndo()
        return dispatch(EngineCommand.Reset)
    }

    /**
     * External paste (clipboard/favorites panel, design §3.7): stop any ASR
     * session, clear the engine buffer through the normal command path, scrub
     * the editor's composing span synchronously, then commit. Going through
     * Reset keeps composingActive/rawInput consistent — a bare
     * finishComposing+commit would leave the engine's old buffer alive and
     * the next keystroke would open a second preedit over the pasted text.
     */
    fun pasteExternal(text: String): DispatchAck {
        asrGuard()
        if (pendingEngine != null || replaying) {
            return enqueueQueued(QueuedInput.Literal(text))
        }
        return pasteExternalNow(text)
    }

    private fun pasteExternalNow(text: String): DispatchAck {
        removeAutomaticSpaceBefore(text)
        invalidateWordUndo()
        // A live composition must LAND before the literal -
        // flicks/long-press popups/symbols all arrive here, and the old
        // setComposing("") wiped the preedit (x + flick-up e produced "3",
        // dropping the x). Stopped mirroring the pinyin into
        // the editor, so there is no span to finishComposing any more: the
        // raw buffer is committed EXPLICITLY instead, then the engine reset
        // cannot touch the editor (composingActive is already false when its
        // echo arrives).
        if (composingActive) {
            // librime's preedit interleaves display-only spaces at syllable
            // boundaries ("xi an") - they are not user input and must not
            // land (the Enter path has the same quirk by design).
            if (composingRaw.isNotEmpty()) {
                val raw = composingRaw.replace(" ", "")
                expectReplacement(raw.length)
                editor.commitText(raw)
            }
            composingRaw = ""
            composingActive = false
        }
        val ack = dispatchLive(EngineCommand.Reset)
        expectReplacement(text.length)
        editor.commitText(text)
        return ack
    }

    /**
     * Candidate-bar × (design: candidate compose controls): abort the current
     * composition and restore Direct/tools. Same scrub ordering as
     * [pasteExternal] — the engine buffer must go through the Reset command
     * path or the next keystroke would resurrect the old preedit.
     */
    fun clearComposing(scrubEditor: Boolean = true): DispatchAck {
        invalidateWordUndo()
        val ack = dispatch(EngineCommand.Reset)
        if (scrubEditor) {
            editor.setComposing("")
            editor.finishComposing()
        }
        composingActive = false
        return ack
    }

    fun close() {
        warmupQueue.clear()
        invalidateWordUndo()
        closeEngineSession()
        abandonPending()
        newSession()
    }

    private fun engineIsActive(): Boolean = !closed

    /** Single queue entrance for every user-input path (mode-fallback §2.5):
     *  the item is ALWAYS enqueued (nothing is lost); overflowing the cap
     *  settles on Direct with the overflow as the reason — during warmup the
     *  failed mode is the pending session's, during a live replay it is the
     *  mode being replayed. */
    private fun enqueueQueued(item: QueuedInput): DispatchAck {
        warmupQueue.addLast(item)
        if (warmupQueue.size > MAX_WARMUP_QUEUE) {
            if (replaying) {
                // A command is dispatched but its event has not been applied
                // yet; degrading now would re-stamp and drop it (P1: typed
                // key lost). Degrade when the replay reaches a quiescent
                // point instead — the queue keeps every key until then.
                overflowPending = true
            } else {
                degradeToDirect(overflowFailedMode(), DegradeReason.QUEUE_OVERFLOW)
            }
        }
        return DispatchAck.Accepted
    }

    /** The mode an overflow degrade blames: the pending warmup's target, or
     *  the mode being replayed. Direct itself overflowing (event backpressure
     *  on a plain Direct session) is nobody's failure — no degrade badge. */
    private fun overflowFailedMode(): InputMode? {
        val failed = pendingStamp?.mode ?: mode
        return if (failed == InputMode.DIRECT) null else failed
    }

    /** Run the deferred overflow degrade at a replay quiescent point.
     *  Returns true when it fired: the caller must STOP — degradeToDirect
     *  started its own replay chain, and continuing the caller's loop would
     *  run two chains against one queue (round-4 review). */
    private fun takeOverflowDegrade(): Boolean {
        if (!overflowPending) return false
        overflowPending = false
        degradeToDirect(overflowFailedMode(), DegradeReason.QUEUE_OVERFLOW)
        return true
    }

    private fun dispatch(command: EngineCommand): DispatchAck {
        if (closed && command != EngineCommand.Start) {
            diag("dispatchRejected cmd=${command::class.simpleName} code=STALE_STAMP closed=true")
            return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        if (pendingEngine != null || replaying) {
            return enqueueQueued(QueuedInput.Command(command))
        }
        // Live events are posted too. Keep subsequent keys and mode/session
        // changes behind the applied event, just like warmup replay.
        replaying = true
        val ack = if (command == EngineCommand.EnterRaw) {
            dispatchLiveEnter { replayWarmupQueue() }
        } else {
            dispatchLive(command) { replayWarmupQueue() }
        }
        if (ack is DispatchAck.Rejected) {
            diag("dispatchRejected cmd=${command::class.simpleName} code=${ack.code.name}")
        }
        return ack
    }

    private fun dispatchLive(
        command: EngineCommand,
        onComplete: (() -> Unit)? = null,
    ): DispatchAck {
        if (command == EngineCommand.Backspace) {
            val undo = lastWordCommit
            if (undo != null && canReopen(undo)) return reopenLastWord(undo, onComplete)
        }
        if (command is EngineCommand.Key &&
            (mode == InputMode.FRENCH || mode == InputMode.RUSSIAN) &&
            isWordPunctuation(command.unicodeScalar) &&
            !(composingActive && (command.unicodeScalar == '\''.code || command.unicodeScalar == '’'.code))) {
            val ack = pasteExternalNow(String(Character.toChars(command.unicodeScalar)))
            onComplete?.invoke()
            return ack
        }
        val requestStamp = stamp
        var completed = false
        fun complete() {
            if (completed || requestStamp != stamp) return
            completed = true
            onComplete?.invoke()
        }
        val ack = engine.dispatch(EngineRequest(stamp, command)) { event ->
            mainPoster {
                onEngineEvent(event, command)
                complete()
            }
        }
        if (ack != DispatchAck.Accepted) complete()
        return ack
    }

    /**
     * Enter's host action must be decided after preceding queued commands have
     * updated composingActive.  The callback therefore performs the decision
     * after the engine event, which also works when mainPoster is asynchronous
     * in production.
     */
    private fun dispatchLiveEnter(onComplete: (() -> Unit)? = null): DispatchAck {
        val hadComposing = composingActive
        lastEnterConsumedComposing = false
        val requestStamp = stamp
        var completed = false
        fun complete() {
            if (completed || requestStamp != stamp) return
            completed = true
            if (hadComposing) {
                lastEnterConsumedComposing = true
            } else {
                editor.performEditorAction()
            }
            onComplete?.invoke()
        }
        val ack = engine.dispatch(EngineRequest(stamp, EngineCommand.EnterRaw)) { event ->
            mainPoster {
                onEngineEvent(event, EngineCommand.EnterRaw)
                complete()
            }
        }
        if (ack != DispatchAck.Accepted) {
            // A rejected Enter never reaches the editor.  Still release a
            // warmup replay continuation, but do not synthesize an action.
            if (!completed) {
                completed = true
                onComplete?.invoke()
            }
        }
        return ack
    }

    /**
     * Replay warmup commands one at a time.  Posting the next dispatch only
     * after the previous event has been applied preserves command semantics
     * (especially Backspace/Space/Enter) even when mainPoster posts to the
     * Android main looper instead of running inline.
     */
    private fun replayWarmupQueue() {
        if (takeOverflowDegrade()) return
        diag("replayQueue n=${warmupQueue.size} mode=${mode.wireName}")
        replaying = true
        val generation = ++warmupReplayGeneration
        fun next() {
            if (generation != warmupReplayGeneration) return
            val item = warmupQueue.removeFirstOrNull()
            if (item == null) {
                replaying = false
                // Drain finished: a deferred overflow degrade re-enters the
                // unified transition from a genuinely quiescent point. The
                // degrade starts its own replay chain and owns the queue.
                takeOverflowDegrade()
                return
            }
            when (item) {
                is QueuedInput.Command -> {
                    if (item.value == EngineCommand.EnterRaw) dispatchLiveEnter(::next)
                    else dispatchLive(item.value, ::next)
                }
                is QueuedInput.Literal -> {
                    pasteExternalNow(item.text)
                    if (generation == warmupReplayGeneration) next()
                }
                is QueuedInput.Accept -> {
                    acceptCurrentCompositionNow()
                    item.after()
                    if (generation == warmupReplayGeneration) next()
                }
                is QueuedInput.Mode -> {
                    replaying = false
                    selectMode(item.value)
                    if (pendingEngine == null) replayWarmupQueue()
                }
            }
        }
        next()
    }

    /** Unified degrade transition (mode-fallback §2.1): dispose the old live
     *  AND pending engines, settle on a real Direct engine, record WHY (with a
     *  fresh seq — a retry that fails again notifies again), emit exactly one
     *  notification, then replay whatever was typed into Direct. */
    private fun degradeToDirect(failedMode: InputMode?, reason: DegradeReason) {
        val live = engine
        val liveStamp = stamp
        val liveWasStarted = liveEngineStarted
        val warmupEngine = pendingEngine
        val warmupStamp = pendingStamp
        pendingEngine = null
        pendingStamp = null
        pendingLastRevision = 0
        // Mark the old session closed BEFORE the closes: with an inline
        // mainPoster the close's CLOSED event lands during the dispatch call,
        // and a still-false `closed` would re-enter the unexpected-death
        // branch — one failure, two degrade notifications (round-5 review).
        closed = true
        // A degrade is a forced mode switch: the unconfirmed composition
        // lands exactly once, with the mode family's own semantics — pinyin
        // commits the raw input (IN-04 回车上原串), span modes finish the
        // host span (same as an explicit mode switch, IN-08). Committing the
        // raw for span modes too double-landed the word (round-5 review).
        if (composingActive) {
            if (isPinyinFamily(mode)) {
                val raw = composingRaw.replace(" ", "")
                if (raw.isNotEmpty()) editor.commitText(raw)
            } else {
                editor.finishComposing()
            }
            composingActive = false
            composingRaw = ""
        }
        if (liveWasStarted) beginClose(live, liveStamp, background)
        if (warmupEngine != null && warmupStamp != null) {
            beginClose(warmupEngine, warmupStamp, background)
        }
        mode = InputMode.DIRECT
        engineSessionGeneration += 1
        stamp = EngineStamp(editorGeneration, engineSessionGeneration, mode)
        lastAppliedRevision = 0
        closed = false
        engine = DirectTextEngine()
        liveEngineStarted = true
        engineMatchesMode = false
        startDirect()
        degradeSeq += 1
        degraded = failedMode?.let { DegradeState(it, reason, degradeSeq) }
        // println (not android.util.Log): this class is JVM-unit-tested and
        // must stay android-free; System.out lands in logcat regardless.
        println(
            "FeelimeEngine: engine degraded failedMode=$failedMode reason=$reason " +
                "seq=$degradeSeq queue=${warmupQueue.size} mode=$mode",
        )
        diag("degrade failedMode=${failedMode?.wireName ?: "none"} reason=${reason.name} " +
            "seq=$degradeSeq queue=${warmupQueue.size}")
        notifyDegrade()
        replayWarmupQueue()
    }

    /** Synthetic degrade notification — the ONLY payload carrying
     *  [EngineEvent.degrade] with degradedActive=true; engines never produce
     *  these. Emitted after the transition has settled, never before. */
    private fun notifyDegrade() {
        val state = degraded ?: return
        mainPoster {
            listener(
                EngineEvent(
                    stamp,
                    1L,
                    Phase.READY,
                    EngineState("", "", emptyList(), false, false, null),
                    false,
                    EngineCode.OK,
                    degrade = state,
                    degradedActive = true,
                ),
            )
        }
    }

    private fun clearDegrade(notify: Boolean) {
        val previous = degraded ?: return
        diag("clearDegrade prev=${previous.failedMode?.wireName}/${previous.reason.name}/seq=${previous.seq}")
        degraded = null
        if (notify) {
            mainPoster {
                listener(
                    EngineEvent(
                        stamp,
                        1L,
                        Phase.READY,
                        EngineState("", "", emptyList(), false, false, null),
                        false,
                        EngineCode.OK,
                        degrade = previous,
                        degradedActive = false,
                    ),
                )
            }
        }
    }

    private fun newSession() {
        warmupReplayGeneration += 1
        replaying = false
        overflowPending = false
        engineSessionGeneration += 1
        stamp = EngineStamp(editorGeneration, engineSessionGeneration, mode)
        lastAppliedRevision = 0
        closed = false
    }

    /** 这些模式同步起跑引擎、不进 Direct-first warmup（无语言数据装载）。
     * DIRECT 之外只有手写：其 Direct 引擎只承载控制键，笔迹识别走独立的
     * HandwritingEngine（design/handwriting.md §1）——挂进 warmup 只会让
     * 切换平白多一个 LOADING 相位。 */
    private fun servesDirectly(mode: InputMode): Boolean =
        mode == InputMode.DIRECT || mode == InputMode.HANDWRITING

    private fun startEngine(next: InputMode) {
        // Transition table (mode-fallback §2.2): a deliberate start clears the
        // degraded state — EXCEPT the retry of the very mode that failed,
        // which stays degraded until the real engine's READY lands (or the
        // warmup fails again, degrading anew with a fresh seq).
        diag("startEngine target=${next.wireName} degradedBefore=${degradeSummary()}")
        engineStartAt = System.nanoTime()
        if (degraded != null && next != degraded?.failedMode) {
            diag("clearDegrade reason=deliberateStart")
            clearDegrade(notify = true)
        }
        mode = next
        stamp = EngineStamp(editorGeneration, engineSessionGeneration, mode)
        lastAppliedRevision = 0
        closed = false
        val target = runCatching { engineFactory(next) }.getOrElse {
            // The old branch silently served a started Direct under the
            // TARGET mode's label with no event and no flag — the exact
            // invisible-degradation shape reported in the field. Route it
            // through the unified transition (mode-fallback §1).
            degradeToDirect(next, DegradeReason.ENGINE_FACTORY_FAILED)
            return
        }
        engineMatchesMode = servesDirectly(next) || background == null
        if (servesDirectly(next) || background == null) {
            engine = target
            liveEngineStarted = true
            val ack = target.dispatch(EngineRequest(stamp, EngineCommand.Start)) { event ->
                mainPoster { onEngineEvent(event) }
            }
            if (ack != DispatchAck.Accepted) {
                // Direct itself failed to start (test engines only); settle on
                // a fresh Direct WITHOUT recording a degrade — this is not a
                // failed Chinese mode.
                degradeToDirect(null, DegradeReason.ENGINE_INIT_FAILED)
            }
            return
        }
        // Direct-first (): an interim Direct engine stands by but is
        // NOT started and publishes nothing — READY would be a lie. Keys
        // typed during warmup are queued and replayed into the winner.
        engine = DirectTextEngine()
        liveEngineStarted = false
        val targetStamp = EngineStamp(editorGeneration, engineSessionGeneration + 1, mode)
        pendingStamp = targetStamp
        pendingLastRevision = 0
        pendingEngine = target
        delayPoster?.invoke(15_000L) {
            if (pendingEngine === target && pendingStamp == targetStamp) {
                degradeToDirect(targetStamp.mode, DegradeReason.WARMUP_TIMEOUT)
            }
        }
        mainPoster {
            listener(
                EngineEvent(
                    stamp,
                    1L,
                    Phase.LOADING,
                    EngineState("", "", emptyList(), false, false, null),
                    false,
                    EngineCode.OK,
                ),
            )
        }
        background.execute {
            // Capture immutable identity at task creation. Never read the
            // mutable current pendingStamp from a delayed background task.
            val ack = target.dispatch(EngineRequest(targetStamp, EngineCommand.Start)) { event ->
                mainPoster {
                    if (pendingEngine === target && pendingStamp == targetStamp) onEngineEvent(event)
                }
            }
            if (ack != DispatchAck.Accepted) {
                mainPoster {
                    if (pendingEngine === target && pendingStamp == targetStamp) {
                        onEngineEvent(pendingAbandoned(targetStamp))
                    }
                }
            }
        }
    }

    private fun pendingAbandoned(targetStamp: EngineStamp): EngineEvent =
        EngineEvent(
            targetStamp,
            1L,
            Phase.ERROR,
            EngineState("", "", emptyList(), false, false, null),
            false,
            EngineCode.ENGINE_INIT_FAILED,
        )

    private fun startDirect() {
        liveEngineStarted = true
        engine.dispatch(EngineRequest(stamp, EngineCommand.Start)) { event ->
            mainPoster { onEngineEvent(event) }
        }
    }

    private fun closeEngineSession() {
        // `closed` MUST be set before the dispatch: an inline mainPoster (the
        // JVM tests, and any engine that answers synchronously) delivers the
        // CLOSED event during the dispatch call itself, and a late assignment
        // would make the initiated close look like an unexpected engine death.
        closed = true
        beginClose(engine, stamp, executor = null)
    }

    private fun abandonPending() {
        val engine = pendingEngine
        val pending = pendingStamp
        pendingEngine = null
        pendingStamp = null
        pendingLastRevision = 0
        if (engine == null || pending == null) return
        // Through the bookkeeping: a FAILED pending close must block later
        // swaps around this engine just like a failed recreate close
        // (round-5 review).
        beginClose(engine, pending, background)
    }

    fun onEngineEvent(event: EngineEvent, command: EngineCommand? = null) {
        // The stamp check is what makes late async callbacks harmless: after
        // any generation or mode change their stamp no longer matches.
        if (pendingStamp != null && event.stamp == pendingStamp) {
            onPendingEvent(event)
            return
        }
        if (event.stamp != stamp) {
            // 诊断埋点（issue #12）：快速模式切换后键入无候选的排查——
            // 迟到事件被 stamp 拦下在这里不可见。只记代际/模式/相位。
            diag("eventDropped reason=stampMismatch phase=${event.phase.name} " +
                "got=${event.stamp.engineSessionGeneration}/${event.stamp.mode.wireName} " +
                "want=${stamp.engineSessionGeneration}/${stamp.mode.wireName}")
            return
        }
        if (event.revision <= lastAppliedRevision) {
            diag("eventDropped reason=revisionRegression phase=${event.phase.name} " +
                "rev=${event.revision} applied=$lastAppliedRevision")
            return
        }
        lastAppliedRevision = event.revision
        when (event.phase) {
            Phase.CLOSED -> {
                if (!closed) {
                    // We set `closed` synchronously around every initiated
                    // Close, so an un-closed CLOSED means the engine died on
                    // its own — settle on a fresh Direct and record why
                    // (mode-fallback §2.2). The trailing re-stamp of the
                    // initiated path must NOT run: degradeToDirect already
                    // opened a new session and started an engine. Composition
                    // state stays untouched here — degradeToDirect lands the
                    // pending pinyin raw itself.
                    lastWordCommit = null
                    listener(event)
                    degradeToDirect(
                        if (mode == InputMode.DIRECT) null else mode,
                        DegradeReason.ENGINE_RUNTIME_FAILED,
                    )
                    return
                }
                closed = true
                lastWordCommit = null
                listener(event)
                engineSessionGeneration += 1
                stamp = EngineStamp(editorGeneration, engineSessionGeneration, mode)
                lastAppliedRevision = 0
            }
            Phase.ERROR -> {
                lastWordCommit = null
                listener(event)
                // A Close's ERROR is a failed teardown, not a failed engine:
                // degrading here would ALSO flip the user's mode while the
                // recreate's swap decision restarts in the original mode
                // (round-5 review) — the close bookkeeping handles it.
                val reason = if (command is EngineCommand.Close) null
                else degradeReasonFor(event.code)
                if (reason != null) {
                    // Composition landing is degradeToDirect's job (mode
                    // family semantics); finishing here TOO double-landed
                    // span-mode words (round-5 R5-3).
                    // failedMode = the mode the failing engine was serving.
                    if (pendingEngine != null) {
                        degradeToDirect(
                            pendingStamp?.mode ?: event.stamp.mode,
                            reason,
                        )
                    } else {
                        degradeToDirect(event.stamp.mode, reason)
                    }
                }
            }
            else -> {
                // 诊断埋点（issue #12）：每次应用引擎状态记数量指纹
                // （不含文本内容）。rime 收键但不产候选 / composing 置位
                // 失败在这条上现形。
                diag("stateApplied phase=${event.phase.name} " +
                    "preedit=${event.state.composing.length} " +
                    "raw=${event.state.rawInput.length} " +
                    "cand=${event.state.candidates.size} " +
                    "commit=${event.state.commit != null} rev=${event.revision}")
                event.state.commit?.let { committed ->
                    // A commit changes the host editor even when the engine
                    // event itself is asynchronous. Start a new local
                    // mutation generation before arming a possible word undo.
                    editorMutationGeneration += 1
                    lastWordCommit = null
                    expectReplacement(committed.length)
                    editor.commitText(committed)
                    editor.finishComposing()
                    armWordUndo(committed, automaticSpace = command is EngineCommand.Choose)
                }
                if (event.state.commit == null && event.state.composing.isNotEmpty()) {
                    lastWordCommit = null
                    // Pinyin preedit lives on the keyboard UI
                    // (candidate bar / preedit line), NOT in the editor - the
                    // raw letters must not land before a word is chosen.
                    // Alphabetical spellcheck modes (French/Russian) and the
                    // editors' own composing spans keep the classic span.
                    if (!isPinyinFamily(mode)) {
                        expectReplacement(event.state.composing.length)
                        editor.setComposing(event.state.composing)
                    }
                }
                if (event.state.commit == null && event.state.composing.isEmpty()) {
                    // finishComposingText() accepts the old span as committed
                    // text. When an engine consumed the last composing
                    // character (for example Backspace: "n" -> ""), clear
                    // that span first so the final character is not orphaned
                    // into the editor as a literal prefix.
                    if (composingActive) {
                        if (!isPinyinFamily(mode)) expectReplacement(0)
                        editor.setComposing("")
                        editor.finishComposing()
                    }
                }
                if (!event.consumed && event.code == EngineCode.EMPTY_COMPOSING) {
                    deleteOneEditorUnit()
                }
                composingActive = event.state.commit == null && event.state.composing.isNotEmpty()
                composingRaw = if (composingActive) event.state.composing else ""
                listener(event)
            }
        }
    }

    /** EngineCode → why-we-degraded; null for ordinary request rejections
     *  (STALE_STAMP etc.), which are not engine failures. Shared by the live
     *  and pending ERROR paths so warmup failures are attributed the same
     *  way as running ones (a data mismatch must not be logged as an init
     *  failure — the field report needs the true reason). */
    private fun degradeReasonFor(code: EngineCode): DegradeReason? = when (code) {
        EngineCode.ENGINE_INIT_FAILED -> DegradeReason.ENGINE_INIT_FAILED
        EngineCode.ENGINE_DATA_MISMATCH -> DegradeReason.ENGINE_DATA_MISMATCH
        EngineCode.ENGINE_RUNTIME_FAILED -> DegradeReason.ENGINE_RUNTIME_FAILED
        else -> null
    }

    private fun onPendingEvent(event: EngineEvent) {
        if (event.revision <= pendingLastRevision) {
            diag("eventDropped reason=pendingRevisionRegression phase=${event.phase.name} " +
                "rev=${event.revision} applied=$pendingLastRevision")
            return
        }
        when (event.phase) {
            Phase.LOADING -> {
                pendingLastRevision = event.revision
                listener(event)
            }
            Phase.READY -> {
                pendingLastRevision = event.revision
                // The target engine can now serve keys: swap over, then
                // replay whatever was typed during warmup into it ().
                diag("engineReady mode=${event.stamp.mode.wireName} " +
                    "warmupMs=${(System.nanoTime() - engineStartAt) / 1_000_000} queue=${warmupQueue.size}")
                engineMatchesMode = true
                engine = pendingEngine!!
                stamp = pendingStamp!!
                // Restore the stamp/counter invariant: pending stamps are
                // minted at sessionGeneration+1, and a later newSession()
                // must not mint a colliding generation (a voice takeover's
                // close then looks like an unexpected engine death —
                // round-4 review).
                engineSessionGeneration = stamp.engineSessionGeneration
                liveEngineStarted = true
                pendingEngine = null
                pendingStamp = null
                lastAppliedRevision = event.revision
                composingActive = false
                replaying = true
                listener(event)
                // The retried failed mode actually landed: recovery (the
                // fallback Direct's own READY never clears the state — it IS
                // the degradation; mode-fallback §2.2).
                if (degraded?.failedMode == event.stamp.mode) clearDegrade(notify = true)
                replayWarmupQueue()
            }
            Phase.ERROR -> {
                pendingLastRevision = event.revision
                listener(event)
                // the live engine is an unstarted interim Direct —
                // settle on a real Direct engine and replay the queue.
                // Same attribution as a running engine's ERROR (P2: a data
                // mismatch during warmup used to be logged as init failure).
                degradeToDirect(
                    event.stamp.mode,
                    degradeReasonFor(event.code) ?: DegradeReason.ENGINE_INIT_FAILED,
                )
            }
            Phase.CLOSED -> Unit
        }
    }

    /** Committed text is deleted with a REAL Backspace key
     * event. deleteSurroundingText rewrote the editor's text buffer without
     * the host ever noticing (xterm.js style terminals only listen for
     * keydown/input deltas), so the terminal never deleted - and no
     * IME-side probe can detect that. KEYCODE_DEL is honoured by both
     * worlds, so the cascade no longer calls the surrounding-text path at
     * all; [EditorPort.deleteSurroundingCodePoints] remains only as a
     * primitive for future explicit needs.
     * The selectedText pre-check is GONE - it is a
     * synchronous InputConnection call, and against the in-process settings
     * WebView (design §6.2) Chromium never answers, so every backspace
     * burned the framework's 2000ms watchdog before the key went out.
     * KEYCODE_DEL deletes a selection natively (device-verified: 5 chars
     * removed, caret converged), so the branch was pure cost. */
    private fun deleteOneEditorUnit() {
        editor.sendDeleteKey()
    }

    private fun canReopen(record: LastWordCommit): Boolean =
        pendingEngine == null &&
            record.editorGeneration == editorGeneration &&
            record.engineSessionGeneration == engineSessionGeneration &&
            record.mode == mode &&
            record.mutationGeneration == editorMutationGeneration &&
            (mode == InputMode.FRENCH || mode == InputMode.RUSSIAN)

    /** Remove the known trailing space, then replay the word into Hunspell. */
    private fun reopenLastWord(record: LastWordCommit, onFailed: (() -> Unit)? = null): DispatchAck {
        invalidateWordUndo()
        if (!editor.reopenComposing(record.start, record.end, record.word)) {
            editor.sendDeleteKey()
            onFailed?.invoke()
            return DispatchAck.Accepted
        }
        predictedSelectionStart = record.start + record.word.length
        predictedSelectionEnd = predictedSelectionStart
        expectedSelections.addLast(predictedSelectionStart to predictedSelectionEnd)
        // Reset the engine while keeping the editor-owned span intact. Only
        // after its callback may replay replace that span, one key at a time.
        composingActive = false
        composingRaw = ""
        replaying = true
        return dispatchLive(EngineCommand.Reset) {
            composingActive = true
            composingRaw = record.word
            val commands = mutableListOf<QueuedInput>()
            var offset = 0
            while (offset < record.word.length) {
                val codePoint = record.word.codePointAt(offset)
                commands.add(QueuedInput.Command(EngineCommand.Key(codePoint, 0)))
                offset += Character.charCount(codePoint)
            }
            commands.asReversed().forEach { warmupQueue.addFirst(it) }
            replayWarmupQueue()
        }
    }

    private fun isWordPunctuation(scalar: Int): Boolean =
        scalar <= Char.MAX_VALUE.code && scalar.toChar() in ",.;:!?…)]}’'"

    /** Only a candidate pick owns an automatic space. Never infer ownership
     * from host text, and retain French spacing before semicolon, colon, ! and ?. */
    private fun removeAutomaticSpaceBefore(text: String) {
        val record = lastWordCommit ?: return
        if (!record.automaticSpace || !canReopen(record) || composingActive ||
            predictedSelectionStart != record.end || predictedSelectionEnd != record.end) return
        val joinedPunctuation = if (mode == InputMode.FRENCH) ",.…)]}’'"
            else ",.;:!?…)]}’'"
        if (text != "..." && (text.length != 1 || text[0] !in joinedPunctuation)) return
        if (!editor.reopenComposing(record.start, record.end, record.word)) return
        editor.finishComposing()
        predictedSelectionStart = record.end - 1
        predictedSelectionEnd = predictedSelectionStart
        expectedSelections.addLast(predictedSelectionStart to predictedSelectionEnd)
    }

    private fun armWordUndo(commit: String, automaticSpace: Boolean) {
        if (mode != InputMode.FRENCH && mode != InputMode.RUSSIAN) {
            lastWordCommit = null
            return
        }
        if (!commit.endsWith(" ") || commit.length == 1 || predictedSelectionEnd < commit.length) {
            lastWordCommit = null
            return
        }
        lastWordCommit = LastWordCommit(
            word = commit.dropLast(1),
            editorGeneration = editorGeneration,
            engineSessionGeneration = engineSessionGeneration,
            mode = mode,
            mutationGeneration = editorMutationGeneration,
            start = predictedSelectionEnd - commit.length,
            end = predictedSelectionEnd,
            automaticSpace = automaticSpace,
        )
    }

    private companion object {
        const val MAX_WARMUP_QUEUE = 256
    }
}
