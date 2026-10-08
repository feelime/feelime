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

    /** 重音折叠索引（ca→ça、etre→être）：无调形 → 带调词列表。 */
    private var accentFold: Map<String, List<String>>? = null

    /** 重音折叠【前缀】索引（用户 2026-10-07：eclate 也要出 éclater/
     *  éclatement…）：fold(word) 为键排序二分、值为原词——原 PrefixIndex
     *  的 startsWith 匹配不上 é 开头的词。 */
    private var foldPrefix: FoldPrefixIndex? = null
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
            accentFold = buildAccentFold(prefixIndex?.allWords().orEmpty())
            if (locale.startsWith("fr")) {
                foldPrefix = buildFoldPrefixIndex(prefixIndex?.allWords().orEmpty())
            }
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
        // 重音折叠前缀（eclate → éclater/éclatement…，长度升序取近者）：
        // 原 prefix 索引的 startsWith 吃 é≠e 匹配不上带调词。
        if (locale.startsWith("fr")) {
            foldPrefix?.find(composing.lowercase(), 8)?.let { suggested += it }
        }
        // 法语省音恢复（用户实录 cetait → c'était）：插在 suggest 之前、
        // 原样拼对词之后（用户打了完整词时原样仍排第一）。
        if (locale.startsWith("fr")) suggested.addAll(0, elisionCandidates())
        // 重音折叠候选（ca → ça、etre → être、deja → déjà）：键盘打不出
        // 重音字符，无调形直查折叠表；suggest 排序不可靠、prefix 索引的
        // startsWith 语义也带不进 ça（ç≠c）。
        accentFold?.get(composing.lowercase())?.let { folds ->
            suggested.addAll(0, folds)
        }
        // 屈折形折叠（用户实录 eclate 要 éclaté）：折叠表只收词典
        // headword，SFX/PFX 派生形（éclaté/mangée/âgés…）永远查不到，
        // suggest 的 REP 建议只做单次重音替换也够不到多处重音。这里
        // 对无调形枚举重音组合、逐个过词典拼对即收——覆盖全部屈折形，
        // 排序同折叠表口径（重音少者优先）。插在折叠表结果之后、省音
        // 之前（headword 同形优先）。
        if (locale.startsWith("fr")) {
            // 凑满 4 个即停（codex 评审 P3）：filter 全量跑完才 take 会做
            // 最坏 624 次拼写 JNI；重音少者优先的排序惰性遍历不破坏。
            val seen = suggested.toHashSet()
            val variants = ArrayList<String>(4)
            var formsProbed = 0
            for (form in accentVariantForms(composing.lowercase())) {
                formsProbed += 1
                if (form !in seen && NativeSmoke.hunspellSpell(handle, form) == 1) {
                    variants.add(form)
                    if (variants.size == 4) break
                }
            }
            // #4 复发取证（真机 éclaté 仍缺失 2026-10-07）：forms=0 是
            // 生成上限早退；forms>0 且 variants 空=spell 全拒。
            android.util.Log.d("FeelimeFr",
                "variants word=${composing.lowercase()} forms=$formsProbed out=$variants")
            if (variants.isNotEmpty()) {
                val at = accentFold?.get(composing.lowercase())?.size ?: 0
                suggested.addAll(at, variants)
            }
        }
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
     * 词根只认「用户所打字母的原样/重音摆位形」（elisionRootsStatic），
     * 不收 suggest 建议：quotidie 切 qu+otidie 后 ngram 建议出
     * idiotie/idiotifie/idiotise，拼成 qu'idiotie 还压住 quotidien
     * 的前缀补全（用户实录）。排序：整词验证过的在前（jusqu'à 压住
     * 拼装的 jusqu'a），同档词根重音少的在前（j'aime 压住 j'aimé）。
     * 完整词免疫：quand/table/seul 的 root（and/able/eul）不是词，
     * 验证不过就不会误出 qu'and/t'able/s'eul。
     */
    private fun elisionCandidates(): List<String> {
        // whole → 排序键：整词档 = 词根重音数，拼装档 = STITCHED_RANK +
        // 重音数（永远落后整词档）。
        val found = LinkedHashMap<String, Int>()
        fun spell(word: String) = NativeSmoke.hunspellSpell(handle, word) == 1
        fun offer(head: String, rest: String, minRest: Int = 2) {
            if (rest.length < minRest) return
            // 省音只在元音（或哑音 h）前。
            if (rest[0].lowercase() !in ELISION_VOWELS) return
            val roots = elisionRootsStatic(rest, ::spell, accentFold.orEmpty())
            for (root in roots) {
                if (root[0].lowercase() !in ELISION_VOWELS) continue
                val whole = head + "'" + root
                if (found.contains(whole)) continue
                if (spell(whole)) {
                    found[whole] = root.count { it in ACCENT_CHARS }
                } else if (spell(head + "'") && spell(root)) {
                    found[whole] = STITCHED_RANK + root.count { it in ACCENT_CHARS }
                }
            }
        }
        // jusqu' 档的词根可以是单字母（jusqu'à 的 à），其余档 ≥2。
        elisionSplitsStatic(composing).forEach { split ->
            offer(split.first, split.second, if (split.first == "jusqu") 1 else 2)
        }
        return found.entries.sortedWith(compareBy({ it.value }, { it.key }))
            .map { it.key }
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

        /** 拼装档（整词没过词典、head' 与 root 各自过）的排序垫底值。 */
        private const val STITCHED_RANK = 100

        /** 省音词根枚举形的收集上限（与 rebuild 主路径的 4 同口径）。 */
        private const val ROOT_CAP = 4

        /** 单字母词根重音族被 buildAccentFold 覆盖后仍保留：élision 的
         *  root 展开走它（jusqu'a → jusqu'à 的整词拼装在 offer 侧）。 */

        /** 词典全表构建无调形 → 带调词索引（fr/ru，一次 ~几十 ms）。 */
        internal fun buildAccentFold(words: List<String>): Map<String, List<String>> {
            val map = HashMap<String, MutableList<String>>()
            for (word in words) {
                if (word.isEmpty() || word.first().isUpperCase()) continue
                val folded = foldAccents(word)
                if (folded == word) continue
                map.getOrPut(folded) { mutableListOf() }.add(word)
            }
            // 同键排序：重音字符少的先（常用形通常重音少），等重音数保持
            // 词典序（词条顺序近似频次）。
            map.values.forEach { list ->
                list.sortBy { w -> w.count { it in ACCENT_CHARS } }
            }
            return map
        }

        /** 重音折叠（é→e、ç→c、ё→e…）：纯函数，JVM 可测。 */
        internal fun foldAccents(word: String): String {
            val sb = StringBuilder(word.length)
            for (ch in word) sb.append(ACCENT_FOLD_MAP[ch] ?: ch)
            return sb.toString()
        }

        /** 无调形的重音组合枚举（éclaté/mangée——带调屈折形，折叠表
         *  只收 headword 覆盖不到）：对每个可折叠字符位（ACCENT_FOLD
         *  的 a/e/i/o/u/c）做「原字符×重音族」笛卡尔积，剔除原形，按
         *  「重音少者优先、同数词典序」排（与折叠表同口径）。上限：
         *  折叠位 ≤4、乘积 ≤625（法语词重音位几乎不超 3-4），越界返
         *  空（不枚举）。词典拼对过滤在 rebuild 侧（需 native）。 */
        /** 重音折叠前缀索引（fr）：fold(word) 键排序二分、值=原词、
         *  同键段内长度升序（更接近输入长度的排前）。只收 fold 后有
         *  变化的词——纯词由原 PrefixIndex 覆盖，免重复。纯 JVM 可测。 */
        internal class FoldPrefixIndex internal constructor(
            private val keys: Array<String>,
            private val words: Array<String>,
        ) {
            fun find(prefix: String, limit: Int): List<String> {
                if (prefix.isEmpty()) return emptyList()
                var low = 0
                var high = keys.size
                while (low < high) {
                    val middle = (low + high) ushr 1
                    if (keys[middle] < prefix) low = middle + 1 else high = middle
                }
                // 段内取「词长最短」的 top-K（用户直觉：éclater 比
                // éclatement 更接近输入长度）——键序只保证段连续，段内
                // 长度序要边扫边维护（短前缀的段上千词，不能全收）。
                val best = ArrayList<String>(minOf(limit, 16))
                var i = low
                while (i < keys.size && keys[i].startsWith(prefix)) {
                    val word = words[i]
                    var j = best.size
                    while (j > 0 &&
                        (best[j - 1].length > word.length ||
                            (best[j - 1].length == word.length && best[j - 1] > word))
                    ) j -= 1
                    if (j < limit) {
                        best.add(j, word)
                        if (best.size > limit) best.removeAt(best.size - 1)
                    }
                    i += 1
                }
                return best
            }
        }

        internal fun buildFoldPrefixIndex(words: List<String>): FoldPrefixIndex? {
            val pairs = ArrayList<Pair<String, String>>(words.size / 3)
            for (word in words) {
                val key = foldAccents(word)
                if (key != word) pairs.add(key to word)
            }
            if (pairs.isEmpty()) return null
            pairs.sortWith(compareBy({ it.first }, { it.second.length }, { it.second }))
            return FoldPrefixIndex(
                Array(pairs.size) { i -> pairs[i].first },
                Array(pairs.size) { i -> pairs[i].second },
            )
        }

        internal fun accentVariantForms(word: String): List<String> {
            if (word.length < 2) return emptyList()
            val positions = ArrayList<Int>()
            word.forEachIndexed { i, ch -> if (ACCENT_FOLD.containsKey(ch)) positions += i }
            if (positions.isEmpty() || positions.size > 4) return emptyList()
            var product = 1
            positions.forEach { product *= 1 + ACCENT_FOLD.getValue(word[it]).size }
            if (product > 625) return emptyList()
            val forms = ArrayList<String>(product)
            val chars = word.toCharArray()
            fun walk(depth: Int) {
                if (depth == positions.size) {
                    forms += String(chars)
                    return
                }
                val pos = positions[depth]
                val orig = word[pos]
                walk(depth + 1) // 该位保持原字符
                for (variant in ACCENT_FOLD.getValue(orig)) {
                    chars[pos] = variant
                    walk(depth + 1)
                }
                chars[pos] = orig
            }
            walk(0)
            forms.remove(word)
            forms.sortWith(compareBy({ w -> w.count { it in ACCENT_CHARS } }, { it }))
            return forms
        }

        private const val ACCENT_CHARS = "àâçéèêëîïôùûёÀÂÇÉÈÊËÎÏÔÙÛЁ"
        private val ACCENT_FOLD_MAP = mapOf(
            'é' to 'e', 'è' to 'e', 'ê' to 'e', 'ë' to 'e',
            'à' to 'a', 'â' to 'a',
            'î' to 'i', 'ï' to 'i',
            'ô' to 'o',
            'ù' to 'u', 'û' to 'u',
            'ç' to 'c',
            'É' to 'E', 'È' to 'E', 'Ê' to 'E', 'Ë' to 'E',
            'À' to 'A', 'Â' to 'A',
            'Î' to 'I', 'Ï' to 'I',
            'Ô' to 'O',
            'Ù' to 'U', 'Û' to 'U',
            'Ç' to 'C',
            'ё' to 'е', 'Ё' to 'Е',
        )

        /** 重音族（a→àâ、e→éèêë…）：accentVariantForms 的枚举源。 */
        private val ACCENT_FOLD = mapOf(
            'a' to charArrayOf('à', 'â'),
            'e' to charArrayOf('é', 'è', 'ê', 'ë'),
            'i' to charArrayOf('î', 'ï'),
            'o' to charArrayOf('ô'),
            'u' to charArrayOf('ù', 'û'),
            'c' to charArrayOf('ç'),
        )

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

        /** 省音词根收集（纯逻辑，JVM 可测）：原样（过词典）+ 折叠表
         *  重音形 + 重音摆位枚举形（≤ ROOT_CAP，过词典）。词根必须是
         *  「用户所打字母的重音摆位形」——suggest 的 ngram 建议会把
         *  无关词放进词根（otidie → idiotie，拼出 qu'idiotie 压住
         *  quotidie 的 quotidien），这里结构上就不收 suggest。
         *  原样排重音形前：j'aime 压住 j'aimé（无调词根是常用形）。 */
        internal fun elisionRootsStatic(
            rest: String,
            spell: (String) -> Boolean,
            accentFold: Map<String, List<String>>,
        ): List<String> {
            val roots = ArrayList<String>()
            if (spell(rest)) roots += rest
            accentFold[rest.lowercase()]?.forEach { if (it !in roots) roots += it }
            for (form in accentVariantForms(rest.lowercase())) {
                if (roots.size >= ROOT_CAP) break
                if (form !in roots && spell(form)) roots += form
            }
            return roots
        }
    }
}
