package com.feelime.ime.engine

import android.content.Context
import com.feelime.ime.nativeengine.NativeSmoke
import com.feelime.ime.nativeengine.PrefixIndex
import java.io.File

/**
 * Hunspell adapter for French/Russian: a composing buffer with offline
 * suggestions (dictionary + prefix index). The upstream constructor never
 * throws on bad data, so Start proves the dictionary with a known probe word
 * before reporting READY (G1 lesson).
 */
class HunspellTextEngine(
    context: Context,
    private val locale: String,
    private val probeWord: String,
) : NativeTextEngine() {
    private val appContext = context.applicationContext
    private var handle = 0L
    private var prefixIndex: PrefixIndex? = null
    private var composing = ""
    private var allCandidates: List<Candidate> = emptyList()
    private var page = 0

    override fun startNative() {
        val dataRoot = EngineDataStore.verifyGroup(appContext, "hunspell")
            ?: throw EngineFailure(
                if (EngineDataStore.mismatched()) EngineCode.ENGINE_DATA_MISMATCH
                else EngineCode.ENGINE_INIT_FAILED,
            )
        val dir = File(dataRoot, "hunspell")
        synchronized(gate) {
            handle = NativeSmoke.hunspellCreate(File(dir, "$locale.aff").path, File(dir, "$locale.dic").path)
            if (handle == 0L) throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            if (NativeSmoke.hunspellSpell(handle, probeWord) != 1) {
                throw EngineFailure(EngineCode.ENGINE_INIT_FAILED)
            }
            prefixIndex = PrefixIndex.load(File(dir, "$locale.prefix.txt"))
        }
    }

    override fun handle(request: EngineRequest, emit: (EngineEvent) -> Unit): DispatchAck {
        when (val command = request.command) {
            is EngineCommand.Key -> {
                composing += String(intArrayOf(command.unicodeScalar), 0, 1)
                rebuild()
                emit(event(Phase.READY, viewState()))
            }
            is EngineCommand.Space -> {
                val commit = composing + " "
                composing = ""
                rebuild()
                emit(event(Phase.READY, viewState(commit = commit)))
            }
            is EngineCommand.EnterRaw -> {
                val commit = composing
                composing = ""
                rebuild()
                emit(event(Phase.READY, viewState(commit = commit)))
            }
            is EngineCommand.Backspace -> {
                if (composing.isEmpty()) {
                    emit(event(Phase.READY, viewState(), consumed = false, code = EngineCode.EMPTY_COMPOSING))
                } else {
                    // delete a full code point, never a surrogate half.
                    val end = composing.length
                    val start = end - Character.charCount(composing.codePointBefore(end))
                    composing = composing.substring(0, start)
                    rebuild()
                    emit(event(Phase.READY, viewState()))
                }
            }
            is EngineCommand.Choose -> {
                val chosen = allCandidates.firstOrNull { it.id == command.candidateId }
                if (chosen == null || command.expectedRevision != currentRevision()) {
                    return staleRevision()
                }
                composing = ""
                rebuild()
                // A picked word lands WITH a trailing space. Without it every
                // confirmed word glued to
                // the next one (bonjourmonde), because the JS space key goes
                // through the shared pool-top pick instead of the
                // Space command, and Choose used to commit the bare word.
                // Same "word + space" shape as Space below and
                // DirectTextEngine.Space; Russian shares this engine.
                emit(event(Phase.READY, viewState(commit = chosen.text + " ")))
            }
            is EngineCommand.PageNext -> {
                // stale paging must never move the page.
                if (command.expectedRevision != currentRevision()) return staleRevision()
                val maxPage = ((allCandidates.size - 1).coerceAtLeast(0)) / PAGE_SIZE
                if (page >= maxPage) {
                    emit(event(Phase.READY, viewState(), consumed = false, code = EngineCode.PAGE_BOUNDARY))
                } else {
                    page += 1
                    emit(event(Phase.READY, viewState()))
                }
            }
            is EngineCommand.PagePrevious -> {
                if (command.expectedRevision != currentRevision()) return staleRevision()
                if (page == 0) {
                    emit(event(Phase.READY, viewState(), consumed = false, code = EngineCode.PAGE_BOUNDARY))
                } else {
                    page -= 1
                    emit(event(Phase.READY, viewState()))
                }
            }
            is EngineCommand.Reset -> {
                composing = ""
                rebuild()
                emit(event(Phase.READY, viewState()))
            }
            // No user-dict candidates to delete here.
            is EngineCommand.DeleteHighlighted -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            is EngineCommand.DeleteCandidate -> DispatchAck.Rejected(EngineCode.NOT_DELETABLE)
            EngineCommand.Close -> close(emit)
            EngineCommand.Start -> return DispatchAck.Rejected(EngineCode.STALE_STAMP)
        }
        return DispatchAck.Accepted
    }

    private fun rebuild() {
        page = 0
        if (composing.isEmpty()) {
            allCandidates = emptyList()
            return
        }
        val suggested = NativeSmoke.hunspellSuggest(handle, composing)
            .lineSequence().filter { it.isNotEmpty() }.toMutableList()
        suggested += prefixIndex?.find(composing, PAGE_SIZE * 3).orEmpty()
        // 法语省音恢复（用户实录 cetait → c'était）：插在 suggest 之前、
        // 原样拼对词之后（用户打了完整词时原样仍排第一）。
        if (locale.startsWith("fr")) suggested.addAll(0, elisionCandidates())
        if (NativeSmoke.hunspellSpell(handle, composing) == 1) suggested.add(0, composing)
        allCandidates = suggested.distinct().mapIndexed { index, value ->
            Candidate(stableCandidateId("hunspell-$locale", 0, index, value), value)
        }
    }

    /**
     * 法语省音（élision）：cetait → c'était、daccord → d'accord、
     * jaime → j'aime、lheure → l'heure、nimporte → n'importe、
     * sappelle → s'appelle、taime → t'aime、quon → qu'on、
     * jusqua → jusqu'à。词典把 c'/d'/…/qu'/jusqu 收成 `--` 词缀词条，
     * root（était/accord…）是普通词，两级验证：
     *   1) 整词（含撇号）过词典；
     *   2) head' 与 root 各自过词典（aff 复合不认整词时的退路）。
     * 完整词免疫：quand/table/seul 的 root（and/able/eul）不是词，
     * 验证不过就不会误出 qu'and/t'able/s'eul。
     */
    private fun elisionCandidates(): List<String> {
        val out = LinkedHashSet<String>()
        fun offer(head: String, rest: String, minRest: Int = 2) {
            if (rest.length < minRest) return
            // 省音只在元音（或哑音 h）前。
            if (rest[0].lowercase() !in ELISION_VOWELS) return
            val roots = LinkedHashSet<String>()
            if (NativeSmoke.hunspellSpell(handle, rest) == 1) roots += rest
            NativeSmoke.hunspellSuggest(handle, rest).lineSequence()
                .filter { it.isNotEmpty() }.take(3).forEach { roots += it }
            for (root in roots) {
                if (root[0].lowercase() !in ELISION_VOWELS) continue
                val whole = head + "'" + root
                if (out.contains(whole)) continue
                if (NativeSmoke.hunspellSpell(handle, whole) == 1 ||
                    (
                        NativeSmoke.hunspellSpell(handle, head + "'") == 1 &&
                            NativeSmoke.hunspellSpell(handle, root) == 1
                        )
                ) out += whole
            }
        }
        // jusqu' 档的词根可以是单字母（jusqu'à 的 à），其余档 ≥2。
        elisionSplitsStatic(composing).forEach { split ->
            offer(split.first, split.second, if (split.first == "jusqu") 1 else 2)
        }
        return out.toList()
    }



    private fun viewState(commit: String? = null): EngineState = EngineState(
        composing = composing,
        rawInput = composing,
        candidates = allCandidates.drop(page * PAGE_SIZE).take(PAGE_SIZE),
        hasPreviousPage = page > 0,
        hasNextPage = allCandidates.size > (page + 1) * PAGE_SIZE,
        commit = commit,
    )

    override fun closeNative() {
        synchronized(gate) {
            if (handle != 0L) NativeSmoke.hunspellDestroy(handle)
            handle = 0
        }
    }

    companion object {
        private const val PAGE_SIZE = 8
        private val gate = Any()

        /** 省音发生的字母环境：元音（含各重音形）与哑音 h。 */
        private const val ELISION_VOWELS = "aàâäeéèêëiîïoôöuùûüyœæh"

        /** 省音切分（纯逻辑，JVM 可测）：jusqu/qu/单字母三档。 */
        internal fun elisionSplitsStatic(word: String): List<Pair<String, String>> {
            val splits = ArrayList<Pair<String, String>>(3)
            if (word.length >= 6 && word.startsWith("jusqu")) {
                splits += "jusqu" to word.substring(5)
            }
            if (word.length >= 3 && word.startsWith("qu")) {
                splits += "qu" to word.substring(2)
            }
            if (word.length >= 3 && word[0] in "cdjlmnstCDJLMNST") {
                splits += word[0].toString() to word.substring(1)
            }
            return splits
        }
    }
}
