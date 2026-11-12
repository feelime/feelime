package com.feelime.ime.engine

/**
 * The no-learning fallback engine used for DIRECT mode, password fields and
 * after engine init failures. It never predicts or learns; it only echoes
 * composing text and commits on demand.
 */
class DirectTextEngine : TextEngine {
    private var sessionStamp: EngineStamp? = null
    private var revision = 0L
    private var composing = ""

    override fun dispatch(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck {
        val stamp = sessionStamp
        if (stamp != null && request.stamp != stamp) return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        if (stamp == null && request.command != EngineCommand.Start) {
            return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        if (request.command is EngineCommand.Start) {
            if (stamp == null) sessionStamp = request.stamp
            revision = 0
            composing = ""
            emit(event(request.stamp, Phase.LOADING, EngineCode.OK))
            emit(event(request.stamp, Phase.READY, EngineCode.OK))
            return DispatchAck.Accepted
        }
        if (request.command is EngineCommand.Close) {
            emit(event(request.stamp, Phase.CLOSED, EngineCode.ENGINE_CLOSED, consumed = true))
            sessionStamp = null
            composing = ""
            return DispatchAck.Accepted
        }
        return when (val command = request.command) {
            is EngineCommand.Key -> {
                // only true Unicode scalars are valid; an unpaired
                // surrogate half would corrupt supplementary-plane text.
                if (command.unicodeScalar < 0 ||
                    command.unicodeScalar > 0x10FFFF ||
                    command.unicodeScalar in 0xD800..0xDFFF
                ) {
                    return DispatchAck.Rejected(EngineCode.INVALID_COMMAND)
                }
                // Direct typing commits immediately; no preedit underline,
                // and backspace always falls through to the editor cascade.
                composing = ""
                emit(
                    event(
                        request.stamp,
                        Phase.READY,
                        EngineCode.OK,
                        consumed = true,
                        commit = String(Character.toChars(command.unicodeScalar)),
                    ),
                )
                DispatchAck.Accepted
            }
            is EngineCommand.Backspace -> {
                if (composing.isEmpty()) {
                    emit(event(request.stamp, Phase.READY, EngineCode.EMPTY_COMPOSING, consumed = false))
                } else {
                    composing = composing.substring(0, composing.length - lastCodeUnitCount(composing))
                    emit(event(request.stamp, Phase.READY, EngineCode.OK, consumed = true))
                }
                DispatchAck.Accepted
            }
            is EngineCommand.Space -> {
                val commit = if (composing.isEmpty()) " " else "$composing "
                composing = ""
                emit(event(request.stamp, Phase.READY, EngineCode.OK, consumed = true, commit = commit))
                DispatchAck.Accepted
            }
            is EngineCommand.EnterRaw -> {
                val commit = composing.ifEmpty { null }
                composing = ""
                emit(event(request.stamp, Phase.READY, EngineCode.OK, consumed = true, commit = commit))
                DispatchAck.Accepted
            }
            is EngineCommand.Choose -> {
                if (command.expectedRevision != revision) {
                    DispatchAck.Rejected(EngineCode.STALE_REVISION)
                } else {
                    DispatchAck.Rejected(EngineCode.INVALID_COMMAND)
                }
            }
            is EngineCommand.PageNext, is EngineCommand.PagePrevious -> {
                val expected = if (command is EngineCommand.PageNext) command.expectedRevision else (command as EngineCommand.PagePrevious).expectedRevision
                if (expected != revision) {
                    DispatchAck.Rejected(EngineCode.STALE_REVISION)
                } else {
                    emit(event(request.stamp, Phase.READY, EngineCode.PAGE_BOUNDARY, consumed = false))
                    DispatchAck.Accepted
                }
            }
            is EngineCommand.Reset -> {
                composing = ""
                emit(event(request.stamp, Phase.READY, EngineCode.OK, consumed = true))
                DispatchAck.Accepted
            }
            // Direct has no engine candidates to delete.
            is EngineCommand.DeleteHighlighted -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            is EngineCommand.DeleteCandidate -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            // #103 preedit 光标只有 rime 引擎支持（coordinator 白名单先挡）。
            is EngineCommand.MovePreeditCursor -> DispatchAck.Rejected(EngineCode.INVALID_COMMAND)
            EngineCommand.Start, EngineCommand.Close -> DispatchAck.Accepted
        }
    }

    private fun event(
        stamp: EngineStamp,
        phase: Phase,
        code: EngineCode,
        consumed: Boolean = true,
        commit: String? = null,
    ): EngineEvent {
        revision += 1
        return EngineEvent(
            stamp = stamp,
            revision = revision,
            phase = phase,
            state = EngineState(
                composing = composing,
                rawInput = composing,
                candidates = emptyList(),
                hasPreviousPage = false,
                hasNextPage = false,
                commit = commit,
            ),
            consumed = consumed,
            code = code,
        )
    }

    private fun lastCodeUnitCount(text: String): Int {
        if (text.isEmpty()) return 0
        val last = text.length - 1
        if (last > 0 && Character.isLowSurrogate(text[last]) && Character.isHighSurrogate(text[last - 1])) {
            return 2
        }
        return 1
    }
}
