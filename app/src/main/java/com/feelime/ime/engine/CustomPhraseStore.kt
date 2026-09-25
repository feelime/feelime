package com.feelime.ime.engine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 自定义短语（issue #17/#29-5）：真相源是
 * files/rime-user/custom-phrases.json（{version, items/imported/user}，
 * code 是用户输入的全拼串），派生物是 rime 的
 * files/rime-user/custom_phrase.txt。stabledb 码列匹配的是用户实际
 * 按键序列的字面（AVD 实测：全拼码在双拼下不命中；table_translator
 * 的 dictionary 为空、不加载 prism，host 复核 2026-09-24），所以派生时
 * 每个词条展开成多行——code 原样一行 + 全部音节切分在每个双拼方案内
 * 逐段拼接的完整键序（表来自 APK 资产 custom-phrase-codes.json，按方案
 * 分组、从各 scheme 的 prism.txt 直读，generate-keyboard-data.py 产出；
 * 多音节必须方案内拼接，跨方案混拼是错码）。同一份 txt 覆盖全拼和全部
 * 双拼方案；多套码行字面共存只会带来「别的按键序列也能打出这个词」的
 * 附加候选，不会错词。
 *
 * 开关关闭或词条清空时删除 txt（引擎侧自然不出词），json 保留——
 * 用户的增删改结果不因开关丢失。
 *
 * 词库导入（issue #22/#37，2026-09-20）：json 另有 imported 段——
 * rime .dict.yaml 导入的词条（设置页 SAF 选择，DictYamlImporter 解析），
 * 与手管理的 items 同一 txt 通道但独立列表：三级页的增删改 UI 只作用于
 * items，导入表有自己的「清空」入口。码长上限比 UI 手输宽（48 vs 16）：
 * 多音节词的完整拼音串更长；派生规则同 items（单音节展开双拼变体）。
 */
object CustomPhraseStore {
    private const val JSON_FILE = "custom-phrases.json"
    const val TXT_FILE = "custom_phrase.txt"

    /** 预设符号词（issue #17 原始需求：箭头/对错/心星手势/动物/天象/
     * 性别符号；用户可在设置的三级页增删改）。 */
    val DEFAULT_ITEMS: List<Pair<String, String>> = listOf(
        "↑" to "shang", "↓" to "xia", "←" to "zuo", "→" to "you",
        "✓" to "dui", "✕" to "cuo",
        "❤" to "xin", "★" to "xing", "👍" to "zan",
        "🐱" to "mao", "🐶" to "gou", "🐻" to "xiong", "🐰" to "tu",
        "🐟" to "yu", "🐦" to "niao", "🐴" to "ma", "🐷" to "zhu",
        "🐮" to "niu", "🐑" to "yang", "🐯" to "hu", "🐲" to "long",
        "🌸" to "hua", "🌙" to "yue", "☀" to "ri", "☁" to "yun",
        "♂" to "nan", "♀" to "nv",
    )

    fun jsonFile(context: Context): File =
        File(File(context.filesDir, "rime-user"), JSON_FILE)

    fun txtFile(context: Context): File =
        File(File(context.filesDir, "rime-user"), TXT_FILE)

    data class State(
        val enabled: Boolean,
        val items: List<Pair<String, String>>,
        val imported: List<Pair<String, String>> = emptyList(),
        /** 自造词（issue #29-5）：用户在词库管理手动维护的词表。独立于
         *  items（符号词）与 imported（文件导入），同一 txt 通道派生，
         *  但不受符号词开关 gating——用户词是词库本体，不是附加候选。 */
        val user: List<Pair<String, String>> = emptyList(),
    )

    /** 读取真相源；json 不存在时（首装/升级）种子写入默认表并派生 txt。 */
    fun load(context: Context): State {
        val file = jsonFile(context)
        if (!file.isFile) {
            save(context, enabled = true, items = DEFAULT_ITEMS, seed = true)
            return State(true, DEFAULT_ITEMS)
        }
        return try {
            val root = JSONObject(file.readText())
            val items = ArrayList<Pair<String, String>>()
            val array = root.optJSONArray("items") ?: JSONArray()
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val text = item.optString("text")
                val code = item.optString("code")
                if (text.isNotEmpty() && code.isNotEmpty()) items.add(text to code)
            }
            val imported = ArrayList<Pair<String, String>>()
            val importedArray = root.optJSONArray("imported") ?: JSONArray()
            for (i in 0 until importedArray.length()) {
                val item = importedArray.optJSONObject(i) ?: continue
                val text = item.optString("text")
                val code = item.optString("code")
                if (text.isNotEmpty() && code.isNotEmpty()) imported.add(text to code)
            }
            val user = ArrayList<Pair<String, String>>()
            val userArray = root.optJSONArray("user") ?: JSONArray()
            for (i in 0 until userArray.length()) {
                val item = userArray.optJSONObject(i) ?: continue
                val text = item.optString("text")
                val code = item.optString("code")
                if (text.isNotEmpty() && code.isNotEmpty()) user.add(text to code)
            }
            State(root.optBoolean("enabled", true), items, imported, user)
        } catch (_: Exception) {
            State(true, DEFAULT_ITEMS)
        }
    }

    /** 落盘 json + 派生/删除 txt。seed=true 时跳过 enabled 持久化语义
     * （首装默认开，行为一致，仅日志区分）。 */
    fun save(
        context: Context,
        enabled: Boolean,
        items: List<Pair<String, String>>,
        imported: List<Pair<String, String>> = emptyList(),
        user: List<Pair<String, String>> = emptyList(),
        seed: Boolean = false,
    ) {
        val root = JSONObject()
            .put("version", 1)
            .put("enabled", enabled)
            .put("items", JSONArray().apply {
                items.forEach { (text, code) -> put(JSONObject().put("text", text).put("code", code)) }
            })
            .put("imported", JSONArray().apply {
                imported.forEach { (text, code) -> put(JSONObject().put("text", text).put("code", code)) }
            })
            .put("user", JSONArray().apply {
                user.forEach { (text, code) -> put(JSONObject().put("text", text).put("code", code)) }
            })
        val dir = jsonFile(context).parentFile
        dir?.mkdirs()
        jsonFile(context).writeText(root.toString())
        deriveTxt(context, enabled, items, imported, user)
        android.util.Log.i(
            "FeelimeCustomPhrase",
            "saved seed=$seed enabled=$enabled items=${items.size} imported=${imported.size} user=${user.size} txt=${txtFile(context).exists()}",
        )
    }

    /** 派生 custom_phrase.txt（每词条多行展开）。gating 边界（#29-5 起）：
     *  开关只管 items（符号词附加候选）；imported 与 user 是词库本体，
     *  各有自己的清空/管理入口，不随符号词开关消失。三段全空才删 txt。 */
    private fun deriveTxt(
        context: Context,
        enabled: Boolean,
        items: List<Pair<String, String>>,
        imported: List<Pair<String, String>>,
        user: List<Pair<String, String>>,
    ) {
        val txt = txtFile(context)
        val deriving = (if (enabled) items else emptyList()) + imported + user
        if (deriving.isEmpty()) {
            txt.delete()
            return
        }
        val codes = codeTable(context)
        val lines = ArrayList<String>()
        // 三段全部落 txt（#29-5 验收修复：旧循环只写 items 段，自造词/导入
        // 词从未真正进引擎）。user 段额外做自动注音全组合（#29-5：多音字
        // 每 种读音一条全拼码，存的主码只是 UI 展示行）；imported 的码来自
        // .dict.yaml 自带注音，不再二次生成。
        val userTexts = user.map { it.first }.toSet()
        for ((text, code) in deriving) {
            val variants = LinkedHashSet<String>()
            variants.add(code)
            if (text in userTexts) {
                variants.addAll(autoPinyinCodes(context, text))
            }
            for (variant in variants.toList()) {
                variants.addAll(doublePinyinSpellings(variant, codes))
            }
            for (variant in variants) lines.add("$text\t$variant\t1")
        }
        txt.writeText(lines.joinToString("\n", postfix = "\n"))
    }

    /**
     * 全拼码列 -> 各双拼方案的完整键序（#29-5 验收：双拼用户打 fgmn 也要
     * 命中码列 fengmin 的自造词）。码列先枚举音节切分（回溯、含全部歧义
     * 切分），每个切分在每个方案内逐段拼接成整行键序——方案内拼接是硬
     * 约束，跨方案混拼（fg+mb）会产生没人能打出的错码，这正是旧「变体
     * 并集」表只能覆盖单音节的原因。custom_phrase 是 table_translator 裸
     * user_dict（dictionary 为空不加载 prism，host 实测 2026-09-24），
     * 按键字面匹配，变体必须预展开落 txt。含分号的码列是自定义键序，
     * 不展开。
     */
    private fun doublePinyinSpellings(code: String, table: JSONObject?): List<String> {
        if (table == null || code.isEmpty() || !code.all { it in 'a'..'z' }) return emptyList()
        val syllables = HashSet<String>()
        val keys = table.keys()
        while (keys.hasNext()) syllables.add(keys.next())
        val out = LinkedHashSet<String>()
        for (segments in syllableSegmentations(code, syllables)) {
            for (scheme in DOUBLE_PINYIN_SCHEMES) {
                var combos = listOf("")
                var ok = true
                for (seg in segments) {
                    val spellings = table.optJSONObject(seg)?.optJSONArray(scheme)
                    if (spellings == null || spellings.length() == 0) { ok = false; break }
                    combos = combos.flatMap { prefix ->
                        (0 until spellings.length()).map { prefix + spellings.optString(it) }
                    }
                    if (combos.size > 32) { ok = false; break }
                }
                if (ok) out.addAll(combos)
            }
        }
        return out.toList()
    }

    /** 回溯枚举全部音节切分；封顶 64 个切分（"aaaa…" 型串是 fib 级）。 */
    private fun syllableSegmentations(code: String, syllables: Set<String>): List<List<String>> {
        val results = ArrayList<List<String>>()
        val acc = ArrayList<String>()
        fun backtrack(start: Int) {
            if (results.size >= 64) return
            if (start == code.length) {
                results.add(ArrayList(acc))
                return
            }
            val maxEnd = minOf(code.length, start + MAX_SYLLABLE_LEN)
            for (end in start + 1..maxEnd) {
                val seg = code.substring(start, end)
                if (seg in syllables) {
                    acc.add(seg)
                    backtrack(end)
                    acc.removeAt(acc.size - 1)
                }
            }
        }
        backtrack(0)
        return results
    }

    /**
     * 自造词自动注音（#29-5 验收：用户只输词，不输码）。逐字查
     * char-pinyin.json 音节表，笛卡尔积生成全部全拼码列——多音字全组合
     * （都 dou/du），组合封顶 [MAX_AUTO_CODES]，超限按字典序（表内已按
     * 词频降序，靠前的组合更常用）截断。任一字符查不到音节（字母/数字/
     * 生僻符号）返回空，调用方回落为要求手输码。
     */
    fun autoPinyinCodes(context: Context, text: String): List<String> {
        if (text.isEmpty()) return emptyList()
        val table = charPinyin(context) ?: return emptyList()
        var combos = listOf("")
        for (ch in text) {
            val syllables = table.optJSONArray(ch.toString()) ?: return emptyList()
            if (syllables.length() == 0) return emptyList()
            combos = combos.flatMap { prefix ->
                (0 until syllables.length()).map { prefix + syllables.optString(it) }
            }
            if (combos.size > MAX_AUTO_CODES) combos = combos.take(MAX_AUTO_CODES)
        }
        return combos.filter { it.length <= 48 }
    }

    /** APK 单字音节表（char-pinyin.json，generate-char-pinyin.py 产出）。 */
    @Volatile private var charPinyinCache: JSONObject? = null
    private fun charPinyin(context: Context): JSONObject? {
        charPinyinCache?.let { return it }
        return runCatching {
            val text = context.assets.open("char-pinyin.json").bufferedReader().use { it.readText() }
            JSONObject(text).also { charPinyinCache = it }
        }.getOrNull()
    }

    /** APK 资产拼式表（音节→{方案→键序}，prism 直读生成）。缺失时降级为
     *  仅全拼码行。 */
    @Volatile private var codeTableCache: JSONObject? = null
    private fun codeTable(context: Context): JSONObject? {
        codeTableCache?.let { return it }
        return runCatching {
            val text = context.assets.open("custom-phrase-codes.json").bufferedReader().use { it.readText() }
            JSONObject(text).also { codeTableCache = it }
        }.getOrNull()
    }

}

private val DOUBLE_PINYIN_SCHEMES = listOf("ziranma", "flypy", "sogou", "ziguang")
private const val MAX_SYLLABLE_LEN = 6
private const val MAX_AUTO_CODES = 8
