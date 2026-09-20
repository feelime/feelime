package com.feelime.ime.engine

import android.content.Context
import com.feelime.ime.nativeengine.NativeSmoke
import java.io.File
import org.json.JSONObject

/**
 * Rime adapter for Chinese full pinyin and the natural-code double-pinyin
 * schema. Process-global librime state is serialized on [gate] so session
 * commands on the main thread never overlap a background Start.
 */
class RimeTextEngine(
    context: Context,
    private val schemaId: String,
) : NativeTextEngine() {
    private val appContext = context.applicationContext
    private var session = 0L
    /** 本 session 所属引擎代数：reloadGlobal 换代后旧 handle 悬垂，
     *  closeNative 不得再拿它调 librime（地址可能被新 session 复用）。 */
    private var sessionEpoch = 0L
    private var page = 0
    private var lastState = EngineState("", "", emptyList(), false, false, null)

    override fun startNative() {
        // librime setup is process-global and must run exactly once: a second
        // rimeInitialize() in the same process deadlocks. Sessions per schema
        // are cheap; the user root is shared and rime namespaces per schema.
        android.util.Log.i("FeelimeEngine", "rime startNative schema=$schemaId")
        ensureGlobalInit(appContext)
        synchronized(gate) {
            android.util.Log.i("FeelimeEngine", "rime createSession $schemaId")
            sessionEpoch = engineEpoch
            session = NativeSmoke.rimeCreateSession(schemaId)
            if (session == 0L) {
                // 诊断埋点（issue #12）：createSession 失败走异常前先落诊断。
                com.feelime.ime.Diagnostics.log(
                    "engine",
                    "rime sessionCreateFailed schema=$schemaId",
                )
                throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            }
            android.util.Log.i("FeelimeEngine", "rime session ok $session")
        }
    }

    override fun handle(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck {
        when (val command = request.command) {
            is EngineCommand.Key -> synchronized(gate) {
                if (session == 0L) {
                    // 诊断埋点（issue #12）：死会话收键 = 收键无候选/
                    // composing 空的直接形态。rimeProcessKey(0,…) 不报错，
                    // 靠这条现形。
                    com.feelime.ime.Diagnostics.log(
                        "engine",
                        "rimeKeyOnDeadSession schema=$schemaId cmd=Key",
                    )
                }
                NativeSmoke.rimeProcessKey(session, command.unicodeScalar, command.modifiers)
                page = 0
                emit(stateEvent())
            }
            is EngineCommand.Space -> synchronized(gate) {
                NativeSmoke.rimeProcessKey(session, SPACE, 0)
                val committed = commitHarvest()
                val state = parseState()
                lastState = state
                page = 0
                if (committed == null && state.composing.isEmpty()) {
                    // Empty composition: librime has no binding for space at
                    // all (user report - nothing landed in Chinese
                    // modes). Emit an explicit space commit so a blank still
                    // types; with a live composition the harvest above is the
                    // regular "space confirms the top candidate" path.
                    emit(event(Phase.READY, state.copy(commit = " ")))
                } else {
                    emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
                }
            }
            is EngineCommand.EnterRaw -> synchronized(gate) {
                NativeSmoke.rimeProcessKey(session, ENTER, 0)
                val committed = commitHarvest()
                if (committed == null) {
                    val state = parseState()
                    if (state.composing.isNotEmpty()) {
                        // The pruned data ships no Return key binding: clear the
                        // composition and commit the raw preedit ourselves so
                        // "Enter commits the raw string" still holds.
                        NativeSmoke.rimeProcessKey(session, ESCAPE, 0)
                        lastState = parseState()
                        emit(
                            event(
                                Phase.READY,
                                lastState.copy(commit = state.composing),
                            ),
                        )
                        return@synchronized
                    }
                }
                lastState = parseState()
                emit(event(Phase.READY, if (committed != null) lastState.copy(commit = committed) else lastState))
            }
            is EngineCommand.Backspace -> synchronized(gate) {
                val hadComposing = lastState.composing.isNotEmpty()
                NativeSmoke.rimeProcessKey(session, BACKSPACE, 0)
                val committed = commitHarvest()
                val state = parseState()
                lastState = state
                page = 0
                if (!hadComposing && state.composing.isEmpty() && committed == null) {
                    // Nothing in the engine to delete: fall through to the
                    // editor deletion cascade (design section 5.4).
                    emit(event(Phase.READY, state, consumed = false, code = EngineCode.EMPTY_COMPOSING))
                } else {
                    emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
                }
            }
            is EngineCommand.Choose -> synchronized(gate) {
                // No hard expectedRevision gate here. The strip keeps
                // ids from every page of the CURRENT composition and may be
                // auto-fetching the next page when the user taps; a page flip
                // in flight bumps the revision and used to reject a perfectly
                // valid tap. The id's lifecycle is already composition-bound:
                // shownCandidates is cleared whenever the preedit changes, so
                // a stale id from another composition misses the map anyway.
                val target = shownCandidates[command.candidateId]
                    ?: return staleRevision()
                var guard = 0
                while (page != target.first && guard++ < 64) {
                    NativeSmoke.rimeProcessKey(
                        session,
                        if (target.first > page) PAGE_DOWN else PAGE_UP,
                        0,
                    )
                    parseState()
                }
                if (page != target.first) {
                    // The seek stalled (page boundary or budget): selecting on
                    // the WRONG page would commit a different candidate for
                    // the same index. Report the (moved) state and reject.
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                if (!NativeSmoke.rimeSelectCandidate(session, target.second)) {
                    // The seek already moved librime's page; the UI must see
                    // the new page even though the selection failed.
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                // Continuous word-building: confirming
                // part of the input keeps the rest composing (preedit "你hk"),
                // so the user picks the next syllable's candidate. Only flush
                // Enter when the composition is fully consumed - sending it
                // mid-composition commits the confirmed part together with
                // the remaining raw letters in one go.
                var committed = commitHarvest()
                var state = parseState()
                if (committed == null && state.composing.isEmpty()) {
                    // Engines without auto-commit on the final selection need
                    // the explicit confirm key.
                    NativeSmoke.rimeProcessKey(session, ENTER, 0)
                    committed = commitHarvest()
                    state = parseState()
                }
                // parseState() already refreshed `page` from librime (the
                // authoritative source); overriding it here desyncs the next
                // paging boundary check.
                lastState = state
                emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
            }
            is EngineCommand.PageNext -> {
                // a stale paging request must never move the page.
                if (command.expectedRevision != currentRevision()) return staleRevision()
                pageCommand(1, emit)
            }
            is EngineCommand.PagePrevious -> {
                if (command.expectedRevision != currentRevision()) return staleRevision()
                pageCommand(-1, emit)
            }
            is EngineCommand.DeleteHighlighted -> synchronized(gate) {
                // Librime 删自造词走桌面同款通道 —— Shift+Delete
                // 在 express_editor 的 ShiftAsControl fallback 下命中
                // Editor::DeleteCandidate（editor.cc 绑定 Ctrl+Delete）。删除
                // 只作用于 userdb 里的自造词；固定词库词与不可删候选是引擎内
                // 静默 no-op，进程键的返回值只表示"键被消费"，删没删成由 JS
                // 对比删前后候选池判定。
                // Shift+Delete 删的是「当前高亮」候选，而 UI 的累积池首项在
                // 第 0 页首位：先像 Choose 一样 seek 回第 0 页，高亮才会落在
                // 池首上（feelime 流程内页内高亮恒在首位，翻页只挪页号）。
                var guard = 0
                while (page != 0 && guard++ < 64) {
                    NativeSmoke.rimeProcessKey(session, PAGE_UP, 0)
                    parseState()
                }
                NativeSmoke.rimeProcessKey(session, DELETE, SHIFT_MASK)
                val committed = commitHarvest()
                val state = parseState()
                lastState = state
                emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
            }
            is EngineCommand.DeleteCandidate -> synchronized(gate) {
                // Delete ANY candidate. Same Shift+Delete channel
                // as DeleteHighlighted, but the highlight must land on the
                // target first: seek to the candidate's page (the Choose
                // loop; highlight sits on the page head after a page flip),
                // then tap Down (librime selector: XK_Down = NextCandidate,
                // selector.cc:36) index times, then delete.
                val target = shownCandidates[command.candidateId]
                    ?: return staleRevision()
                var guard = 0
                while (page != target.first && guard++ < 64) {
                    NativeSmoke.rimeProcessKey(
                        session,
                        if (target.first > page) PAGE_DOWN else PAGE_UP,
                        0,
                    )
                    parseState()
                }
                if (page != target.first) {
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                repeat(target.second.coerceAtMost(15)) {
                    NativeSmoke.rimeProcessKey(session, DOWN, 0)
                }
                NativeSmoke.rimeProcessKey(session, DELETE, SHIFT_MASK)
                val committed = commitHarvest()
                val state = parseState()
                lastState = state
                emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
            }
            is EngineCommand.Reset -> synchronized(gate) {
                NativeSmoke.rimeDestroySession(session)
                session = NativeSmoke.rimeCreateSession(schemaId)
                page = 0
                emit(stateEvent())
            }
            EngineCommand.Close -> close(emit)
            EngineCommand.Start -> return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        return DispatchAck.Accepted
    }

    private fun pageCommand(direction: Int, emit: (EngineEvent) -> Unit) = synchronized(gate) {
        val beforePage = page
        NativeSmoke.rimeProcessKey(session, if (direction > 0) PAGE_DOWN else PAGE_UP, 0)
        val next = parseState()
        if (page == beforePage) {
            // librime's page number is authoritative. Candidate text can repeat
            // across pages, so comparing only the visible list is insufficient.
            lastState = next
            emit(event(Phase.READY, next, consumed = false, code = EngineCode.PAGE_BOUNDARY))
        } else {
            lastState = next
            emit(event(Phase.READY, lastState))
        }
        Unit
    }

    /**
     * Every candidate the UI has shown for the current composition,
     * id -> (page, index on page). Cleared whenever the preedit changes so a
     * stale id can never address the wrong composition; the expectedRevision
     * guard on Choose covers the rest.
     */
    private var shownCandidates: Map<String, Pair<Int, Int>> = emptyMap()
    private var shownPreedit: String? = null

    private fun stateEvent(): EngineEvent {
        val committed = commitHarvest()
        val state = parseState()
        lastState = state
        return event(Phase.READY, if (committed != null) state.copy(commit = committed) else state)
    }

    private fun commitHarvest(): String? {
        val committed = NativeSmoke.rimeCommit(session)
        return committed.takeIf { it.isNotEmpty() }
    }

    private fun parseState(): EngineState {
        val json = JSONObject(NativeSmoke.rimeContext(session))
        page = json.optInt("pageNo", 0).coerceAtLeast(0)
        val isLastPage = json.optInt("isLastPage", 1) != 0
        val rawPreedit = json.optString("preedit")
        // librime drops the syllable-separator spaces from the preedit once
        // the page moves ("xi an" -> "xian"). The composition itself is
        // unchanged, but the UI pins its accumulation to rawInput: the flip
        // reset the expanded candidate strip and shrank the variant column
        // . Same string ignoring spaces = same composition, so keep
        // the preedit the UI already shows.
        val preedit = if (lastState.composing.isNotEmpty() &&
            rawPreedit.replace(" ", "") == lastState.composing.replace(" ", "")
        ) {
            lastState.composing
        } else {
            rawPreedit
        }
        if (preedit != shownPreedit) {
            shownCandidates = emptyMap()
            shownPreedit = preedit
        }
        val candidates = json.optString("candidates").lineSequence()
            .filter { it.isNotEmpty() }
            .mapIndexed { index, value ->
                val id = stableCandidateId(engineName, page, index, value)
                shownCandidates = shownCandidates + (id to (page to index))
                Candidate(id, value)
            }
            .toList()
        return EngineState(
            composing = preedit,
            rawInput = preedit,
            candidates = candidates,
            hasPreviousPage = page > 0,
            hasNextPage = candidates.isNotEmpty() && !isLastPage,
        )
    }

    override fun closeNative() {
        synchronized(gate) {
            if (session != 0L && sessionEpoch == engineEpoch) {
                NativeSmoke.rimeDestroySession(session)
            }
            session = 0
        }
    }

    private val engineName get() = "rime"

    companion object {
        private const val SPACE = 0x20
        private const val ENTER = 0xff0d
        private const val BACKSPACE = 0xff08
        private const val PAGE_DOWN = 0xff56
        private const val PAGE_UP = 0xff55
        private const val ESCAPE = 0xff1b
        private const val DELETE = 0xffff // XK_Delete
        private const val DOWN = 0xff54 // XK_Down (selector: next candidate)
        private const val SHIFT_MASK = 1 // kShiftMask
        private val gate = Any()
        @Volatile private var globallyInitialized = false
        /** 引擎代数：reloadGlobal 递增，标记所有现存 session handle 失效。 */
        @Volatile private var engineEpoch = 0L

        fun ensureGlobalInit(context: Context) = synchronized(gate) {
            if (globallyInitialized) return
            android.util.Log.i("FeelimeEngine", "rime global init: verifyGroup")
            val dataRoot = EngineDataStore.verifyGroup(context, "rime")
                ?: throw EngineFailure(
                    if (EngineDataStore.mismatched()) EngineCode.ENGINE_DATA_MISMATCH
                    else EngineCode.ENGINE_INIT_FAILED,
                )
            val user = File(context.filesDir, "rime-user").apply { mkdirs() }
            // staging = <user>/build：librime 对显式 staging_dir 不追加
            // build/（直接用），maintenance 产物与运行时的 staging 优先解析
            // 共用这一个目录（issue #23 设备端编译的落点契约）。
            val staging = File(user, "build").apply { mkdirs() }
            android.util.Log.i("FeelimeEngine", "rime global init: rimeInitialize shared=${dataRoot} user=${user.path} staging=${staging.path}")
            val startedAt = android.os.SystemClock.elapsedRealtime()
            if (!NativeSmoke.rimeInitialize(File(dataRoot, "rime").path, user.path, staging.path)) {
                throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            }
            android.util.Log.i("FeelimeEngine", "rime global init done in ${android.os.SystemClock.elapsedRealtime() - startedAt}ms")
            globallyInitialized = true
        }

        /** custom_phrase 词表变更后整引擎重载。stabledb（custom_phrase
         * 通道）只在引擎生命周期加载一次：session 级重建不重读文件
         * （AVD 实测切 schema 仍出旧词），必须 finalize+init 才重开词
         * 表。调用后引擎实例持有的旧 session handle 全部悬垂——
         * librime 按句柄查表查不到只返回失败，配合调用方紧随其后的
         * recreateEngineSession 重建即恢复。仅在设置页改词时调用
         * （无活动组合的时机）。 */
        fun reloadGlobal(context: Context) = synchronized(gate) {
            if (!globallyInitialized) return
            android.util.Log.i("FeelimeEngine", "rime reload: finalize + re-init")
            NativeSmoke.rimeFinalize()
            globallyInitialized = false
            engineEpoch += 1
            ensureGlobalInit(context)
        }
    }
}
