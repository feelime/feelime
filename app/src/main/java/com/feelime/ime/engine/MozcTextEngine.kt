package com.feelime.ime.engine

import android.content.Context
import com.feelime.ime.nativeengine.ProtoField
import com.feelime.ime.nativeengine.ProtoWire
import com.google.android.apps.inputmethod.libs.mozc.session.MozcJNI
import java.io.File

/**
 * Mozc romaji adapter. Upstream's session handler is process-global and its
 * onPostLoad never fails visibly (bad data downgrades to a minimal engine
 * whose data version is "0.0.0"), so Start gates on the real data version
 * (G1 lesson) and every native call is serialized on [gate].
 *
 * Adapter normalizations over upstream behavior (design section 6.3):
 *  - `nna` produces んな: an extra `n` is inserted before a vowel when the raw
 *    input ends with exactly two `n`s, matching common romaji expectations.
 *  - One user Backspace after a conversion removes one composing unit even
 *    when upstream's first DEL only dismisses the suggestion window.
 */
class MozcTextEngine(context: Context) : NativeTextEngine() {
    private val appContext = context.applicationContext
    private var session = 0L
    private var output = emptyList<ProtoField>()
    private var rawInput = ""
    private var converted = false
    private var candidateIds = emptyMap<String, Long>()

    override fun startNative() {
        val dataRoot = EngineDataStore.verifyGroup(appContext, "mozc")
            ?: throw EngineFailure(
                if (EngineDataStore.mismatched()) EngineCode.ENGINE_DATA_MISMATCH
                else EngineCode.ENGINE_INIT_FAILED,
            )
        val userDir = File(appContext.filesDir, "mozc-user").apply { mkdirs() }
        synchronized(gate) {
            if (!MozcJNI.onPostLoad(userDir.path, File(dataRoot, "mozc/mozc.data").path)) {
                throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            }
            if (MozcJNI.getDataVersion() in setOf("", "0.0.0")) {
                throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            }
            eval(ProtoWire.setRequest())
            session = ProtoWire.integer(eval(ProtoWire.createSession()), 1)
                ?: throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
        }
    }

    override fun handle(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck {
        when (val command = request.command) {
            is EngineCommand.Key -> synchronized(gate) {
                if (!converted && isVowel(command.unicodeScalar) && trailingNCount(rawInput) == 2) {
                    eval(ProtoWire.sendCharacter(session, 'n'.code))
                }
                rawInput += String(intArrayOf(command.unicodeScalar), 0, 1)
                output = eval(ProtoWire.sendCharacter(session, command.unicodeScalar))
                emit(event(Phase.READY, parseState()))
            }
            is EngineCommand.Space -> synchronized(gate) {
                output = eval(ProtoWire.sendSpecial(session, SPECIAL_SPACE))
                converted = true
                emit(event(Phase.READY, parseState()))
            }
            is EngineCommand.EnterRaw -> synchronized(gate) {
                output = eval(ProtoWire.sendSpecial(session, SPECIAL_ENTER))
                rawInput = ""
                converted = false
                emit(event(Phase.READY, parseState()))
            }
            is EngineCommand.Backspace -> synchronized(gate) {
                val before = visibleState()
                output = eval(ProtoWire.sendSpecial(session, SPECIAL_BACKSPACE))
                if (visibleState() == before) {
                    // Coalesce upstream's no-op DEL (suggestion dismissal).
                    output = eval(ProtoWire.sendSpecial(session, SPECIAL_BACKSPACE))
                }
                val after = visibleState()
                if (before.composing.isEmpty() && after.composing.isEmpty()) {
                    // Empty preedit on both sides: editor deletion cascade.
                    emit(event(Phase.READY, parseState(), consumed = false, code = EngineCode.EMPTY_COMPOSING))
                    return@synchronized
                }
                if (!after.composing.isNotEmpty()) {
                    rawInput = ""
                    converted = false
                } else {
                    rawInput = rawInput.dropLast(1)
                }
                emit(event(Phase.READY, parseState()))
            }
            is EngineCommand.Choose -> synchronized(gate) {
                val nativeId = candidateIds[command.candidateId]
                if (nativeId == null || command.expectedRevision != currentRevision()) {
                    return staleRevision()
                }
                output = eval(ProtoWire.sendSessionCommand(session, COMMAND_SELECT_CANDIDATE, nativeId))
                output = eval(ProtoWire.sendSpecial(session, SPECIAL_ENTER))
                rawInput = ""
                converted = false
                emit(event(Phase.READY, parseState()))
            }
            is EngineCommand.PageNext, is EngineCommand.PagePrevious -> {
                // paging is served from the conversion preview; a
                // stale request must not observe current state at all.
                val expected = if (command is EngineCommand.PageNext) {
                    command.expectedRevision
                } else {
                    (command as EngineCommand.PagePrevious).expectedRevision
                }
                if (expected != currentRevision()) return staleRevision()
                emit(event(Phase.READY, visibleState(), consumed = false, code = EngineCode.PAGE_BOUNDARY))
            }
            is EngineCommand.Reset -> synchronized(gate) {
                eval(ProtoWire.deleteSession(session))
                session = ProtoWire.integer(eval(ProtoWire.createSession()), 1) ?: session
                output = emptyList()
                rawInput = ""
                converted = false
                emit(event(Phase.READY, parseState()))
            }
            // No user-dict candidates to delete here.
            is EngineCommand.DeleteHighlighted -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            is EngineCommand.DeleteCandidate -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            // #103 preedit 光标只有 rime 引擎支持（coordinator 白名单先挡）。
            is EngineCommand.MovePreeditCursor -> DispatchAck.Rejected(EngineCode.INVALID_COMMAND)
            EngineCommand.Close -> close(emit)
            EngineCommand.Start -> return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        return DispatchAck.Accepted
    }

    private fun visibleState(): EngineState = parseState(preview = true)

    private fun parseState(preview: Boolean = false): EngineState {
        val preedit = ProtoWire.nested(output, 5)
            .filter { it.number == 2 && it.wireType == 3 }
            .flatMap { it.group.orEmpty() }
            .filter { it.number == 4 }
            .mapNotNull(ProtoField::text)
            .joinToString("")
        val committed = ProtoWire.nested(output, 4).firstOrNull { it.number == 2 }?.text()
        val window = ProtoWire.nested(output, 6)
            .filter { it.number == 3 && it.wireType == 3 }
            .mapNotNull { candidate ->
                val fields = candidate.group.orEmpty()
                val id = fields.firstOrNull { it.number == 9 }?.integer ?: return@mapNotNull null
                val value = fields.firstOrNull { it.number == 5 }?.text() ?: return@mapNotNull null
                id to value
            }
        val all = ProtoWire.nested(output, 14)
            .filter { it.number == 2 && it.wireType == 2 }
            .mapNotNull { candidate ->
                val fields = candidate.bytes?.let(ProtoWire::fields).orEmpty()
                val id = fields.firstOrNull { it.number == 1 }?.integer ?: return@mapNotNull null
                val value = fields.firstOrNull { it.number == 4 }?.text() ?: return@mapNotNull null
                id to value
            }
        val candidates = (window + all).distinctBy { it.first }
            .mapIndexed { index, (_, value) ->
                Candidate(stableCandidateId("mozc", 0, index, value), value)
            }
        if (!preview) {
            val byId = (window + all).distinctBy { it.first }
            candidateIds = candidates.mapIndexed { index, candidate ->
                candidate.id to byId[index].first
            }.toMap()
        }
        return EngineState(
            composing = preedit,
            rawInput = preedit,
            candidates = candidates,
            hasPreviousPage = false,
            hasNextPage = false,
            commit = committed?.takeIf { it.isNotEmpty() && !preview },
        )
    }

    override fun closeNative() {
        synchronized(gate) {
            if (session != 0L) eval(ProtoWire.deleteSession(session))
            session = 0
        }
    }

    private fun eval(command: ByteArray): List<ProtoField> =
        ProtoWire.output(MozcJNI.evalCommand(command))

    companion object {
        private const val SPECIAL_SPACE = 4
        private const val SPECIAL_ENTER = 5
        private const val SPECIAL_BACKSPACE = 12
        private const val COMMAND_SELECT_CANDIDATE = 3
        private val gate = Any()

        private fun isVowel(code: Int) = code == 'a'.code || code == 'i'.code ||
            code == 'u'.code || code == 'e'.code || code == 'o'.code

        private fun trailingNCount(text: String): Int {
            var count = 0
            for (index in text.length - 1 downTo 0) {
                if (text[index] != 'n') break
                count += 1
            }
            return count
        }
    }
}
