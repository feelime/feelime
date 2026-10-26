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
    // #72 只读候选通道：应用侧视图页。native 的 selector/页号不再被
    // 候选浏览移动（那是 nihlk 第 5 帧丢锚的根因——PAGE_DOWN 拖走高亮，
    // stable-seg hint 取到深页候选的残缺 spans）。任何键/编辑/选删/
    // Reset 后回到第 0 页重新读取。
    private var viewPage = 0
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
                // #12 复发取证：每键 librime 耗时曲线（主线程同步调用，
                // 慢=主线程阻塞=键盘无响应）。超 60ms 才打，正常零噪音。
                val t0 = android.os.SystemClock.elapsedRealtime()
                if (session == 0L) {
                    // 诊断埋点（issue #12）：死会话收键 = 收键无候选/
                    // composing 空的直接形态。rimeProcessKey(0,…) 不报错，
                    // 靠这条现形。
                    com.feelime.ime.Diagnostics.log(
                        "engine",
                        "rimeKeyOnDeadSession schema=$schemaId cmd=Key",
                    )
                }
                // consumed 透传（硬件键盘 #H）：librime 的 process_key 返回值
                // 之前被丢弃、stateEvent 恒报 consumed=true——调用方无从
                // 判断「引擎没接这个键」（空组合下的部分符号等）。透传真值，
                // JS/Native 侧可据「未处理且无状态变化」做防御分流。
                val handled = NativeSmoke.rimeProcessKey(session, command.unicodeScalar, command.modifiers)
                viewPage = 0
                emit(stateEvent(consumed = handled))
                val ms = android.os.SystemClock.elapsedRealtime() - t0
                if (ms > 60) com.feelime.ime.Diagnostics.log(
                    "engine", "rimeSlow op=Key ms=$ms raw=${lastState.composing.replace(" ", "").length}")
            }
            is EngineCommand.Space -> synchronized(gate) {
                NativeSmoke.rimeProcessKey(session, SPACE, 0)
                val committed = commitHarvest()
                viewPage = 0
                val state = parseState()
                lastState = state
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
                viewPage = 0
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
                val t0 = android.os.SystemClock.elapsedRealtime()
                val hadComposing = lastState.composing.isNotEmpty()
                NativeSmoke.rimeProcessKey(session, BACKSPACE, 0)
                val committed = commitHarvest()
                viewPage = 0
                val state = parseState()
                lastState = state
                if (!hadComposing && state.composing.isEmpty() && committed == null) {
                    // Nothing in the engine to delete: fall through to the
                    // editor deletion cascade (design section 5.4).
                    emit(event(Phase.READY, state, consumed = false, code = EngineCode.EMPTY_COMPOSING))
                } else {
                    emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
                }
                val ms = android.os.SystemClock.elapsedRealtime() - t0
                if (ms > 60) com.feelime.ime.Diagnostics.log(
                    "engine", "rimeSlow op=Backspace ms=$ms raw=${lastState.composing.replace(" ", "").length}")
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
                // 上游 delete/select 对无效下标防御不完整：先只读回验该
                // 候选仍在原绝对下标上（菜单一经变动即拒绝，防错选）。
                if (!candidateStillAt(command.candidateId)) {
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                if (!NativeSmoke.rimeSelectCandidateAbsolute(session, target)) {
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                viewPage = 0
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
                // 只读通道下 selector 高亮恒在第 0 位（浏览不再挪动它），
                // 「当前高亮」即池首——按绝对下标 0 直接删，不再 seek。
                NativeSmoke.rimeDeleteCandidateAbsolute(session, 0)
                val committed = commitHarvest()
                viewPage = 0
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
                if (!candidateStillAt(command.candidateId)) {
                    lastState = parseState()
                    emit(event(Phase.READY, lastState))
                    return staleRevision()
                }
                NativeSmoke.rimeDeleteCandidateAbsolute(session, target)
                val committed = commitHarvest()
                viewPage = 0
                val state = parseState()
                lastState = state
                emit(event(Phase.READY, if (committed != null) state.copy(commit = committed) else state))
            }
            is EngineCommand.Reset -> synchronized(gate) {
                NativeSmoke.rimeDestroySession(session)
                session = NativeSmoke.rimeCreateSession(schemaId)
                viewPage = 0
                emit(stateEvent())
            }
            EngineCommand.Close -> close(emit)
            EngineCommand.Start -> return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        return DispatchAck.Accepted
    }

    private fun pageCommand(direction: Int, emit: (EngineEvent) -> Unit) = synchronized(gate) {
        // #72 只读翻页：直接读目标视图页，不发 PAGE_DOWN/PAGE_UP——
        // 键控翻页会挪 selector 高亮（候选预加载每帧翻页 = 高亮被拖到
        // 深页 = stable-seg hint 取到残缺 spans = nihlk 第 5 帧病态）。
        val target = viewPage + direction
        if (target < 0) {
            emit(event(Phase.READY, lastState, consumed = false, code = EngineCode.PAGE_BOUNDARY))
            return@synchronized
        }
        val json = JSONObject(NativeSmoke.rimeContextAtPage(session, target))
        if (json.optInt("code", -1) != 0) {
            // 越界/空页：保留当前视图页，如实上报边界。
            emit(event(Phase.READY, lastState, consumed = false, code = EngineCode.PAGE_BOUNDARY))
            return@synchronized
        }
        viewPage = target
        val next = parseState()
        lastState = next
        emit(event(Phase.READY, lastState))
        Unit
    }

    /**
     * Every candidate the UI has shown for the current composition,
     * id -> absolute index (candidate_list 平铺序号) + id -> text（选/删前
     * 只读回验用）。Cleared whenever the preedit changes so a stale id can
     * never address the wrong composition; the expectedRevision guard on
     * Choose covers the rest.
     */
    private var shownCandidates: Map<String, Int> = emptyMap()
    private var shownTexts: Map<String, String> = emptyMap()
    private var lastPageSize = 5
    private var shownPreedit: String? = null

    /** 选/删前回验：该 id 的候选文本仍在其记录的绝对下标上。 */
    private fun candidateStillAt(candidateId: String): Boolean {
        val absolute = shownCandidates[candidateId] ?: return false
        val text = shownTexts[candidateId] ?: return false
        if (lastPageSize <= 0) return false
        val json = JSONObject(NativeSmoke.rimeContextAtPage(session, absolute / lastPageSize))
        if (json.optInt("code", -1) != 0) return false
        val lines = json.optString("candidates").split("\n")
        val slot = absolute % lastPageSize
        return slot < lines.size && lines[slot] == text
    }

    private fun stateEvent(consumed: Boolean = true): EngineEvent {
        val committed = commitHarvest()
        val state = parseState()
        lastState = state
        return event(Phase.READY, if (committed != null) state.copy(commit = committed) else state, consumed = consumed)
    }

    private fun commitHarvest(): String? {
        val committed = NativeSmoke.rimeCommit(session)
        return committed.takeIf { it.isNotEmpty() }
    }

    private fun parseState(): EngineState {
        // 只读通道：按应用视图页读取（键后恒为第 0 页，翻页只动 viewPage）。
        var json = JSONObject(NativeSmoke.rimeContextAtPage(session, viewPage))
        if (json.optInt("code", -1) != 0) {
            // 越界视图页（新组合重置了菜单）：回读第 0 页自愈。分页失败
            // 绝不能被解释成组合结束（codex 四轮 P1）。
            viewPage = 0
            json = JSONObject(NativeSmoke.rimeContextAtPage(session, 0))
            if (json.optInt("code", -1) != 0) {
                return EngineState("", "", emptyList(), false, false, null)
            }
        }
        val viewPageNo = json.optInt("pageNo", viewPage).coerceAtLeast(0)
        val pageSize = json.optInt("pageSize", 0)
        if (pageSize > 0) lastPageSize = pageSize
        val isLastPage = json.optInt("isLastPage", 1) != 0
        val preedit = json.optString("preedit")
        if (preedit != shownPreedit) {
            shownCandidates = emptyMap()
            shownTexts = emptyMap()
            shownPreedit = preedit
        }
        val candidates = json.optString("candidates").lineSequence()
            .mapIndexed { index, value ->
                // null 文本占位（bridge 保留下标对齐）在 Kotlin 侧跳过渲染，
                // 但绝对下标仍按行号推进——寻址不漂移。
                val absolute = viewPageNo * lastPageSize + index
                val id = stableCandidateId(engineName, viewPageNo, index, value)
                if (value.isNotEmpty()) {
                    shownCandidates = shownCandidates + (id to absolute)
                    shownTexts = shownTexts + (id to value)
                }
                Candidate(id, value)
            }
            .filter { it.text.isNotEmpty() }
            .toList()
        return EngineState(
            composing = preedit,
            rawInput = preedit,
            candidates = candidates,
            hasPreviousPage = viewPage > 0,
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
        private const val ESCAPE = 0xff1b
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
