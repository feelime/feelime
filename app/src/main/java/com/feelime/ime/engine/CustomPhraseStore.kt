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

    /** #29-3 英文词直出内置表（text 展示 / code 按键字面，code 恒小写
     *  字母）。派生时过滤掉能被完整切成拼音音节的词（如 ai/mode/
     *  mini）——那些按键序列本就是正常拼音输入，插英文候选是打扰；
     *  github/ios/android 这类切不开的词才直出。 */
    val DEFAULT_ENGLISH_WORDS: List<Pair<String, String>> = listOf(
        "GitHub" to "github", "iOS" to "ios", "Android" to "android",
        "iPhone" to "iphone", "iPad" to "ipad", "MacBook" to "macbook",
        "App" to "app", "APK" to "apk", "Windows" to "windows",
        "Linux" to "linux", "Ubuntu" to "ubuntu", "macOS" to "macos",
        "Python" to "python", "Java" to "java", "JavaScript" to "javascript",
        "TypeScript" to "typescript", "Golang" to "golang", "Rust" to "rust",
        "Kotlin" to "kotlin", "Dart" to "dart", "Flutter" to "flutter",
        "React" to "react", "Vue" to "vue", "HTML" to "html", "JSON" to "json",
        "XML" to "xml", "YAML" to "yaml", "SQL" to "sql", "API" to "api",
        "SDK" to "sdk", "IDE" to "ide", "URL" to "url", "HTTP" to "http",
        "HTTPS" to "https", "DNS" to "dns", "VPN" to "vpn", "WiFi" to "wifi",
        "GPT" to "gpt", "LLM" to "llm", "GPU" to "gpu", "CPU" to "cpu",
        "RAM" to "ram", "SSD" to "ssd", "USB" to "usb", "HDMI" to "hdmi",
        "OCR" to "ocr", "OTG" to "otg", "NFC" to "nfc", "SIM" to "sim",
        "eSIM" to "esim", "QR" to "qr", "bug" to "bug", "debug" to "debug",
        "demo" to "demo", "log" to "log", "crash" to "crash",
        "update" to "update", "upgrade" to "upgrade", "beta" to "beta",
        "commit" to "commit", "push" to "push", "pull" to "pull",
        "merge" to "merge", "branch" to "branch", "fork" to "fork",
        "issue" to "issue", "PR" to "pr", "repo" to "repo", "code" to "code",
        "review" to "review", "test" to "test", "spec" to "spec",
        "doc" to "doc", "docs" to "docs", "wiki" to "wiki", "blog" to "blog",
        "email" to "email", "spam" to "spam", "login" to "login",
        "logout" to "logout", "token" to "token", "cache" to "cache",
        "cookie" to "cookie", "server" to "server", "client" to "client",
        "cloud" to "cloud", "docker" to "docker", "nginx" to "nginx",
        "redis" to "redis", "mysql" to "mysql", "git" to "git",
        "vim" to "vim", "ssh" to "ssh", "sudo" to "sudo", "bash" to "bash",
        "zsh" to "zsh", "curl" to "curl", "wget" to "wget", "grep" to "grep",
        "ping" to "ping", "download" to "download", "upload" to "upload",
        "copy" to "copy", "paste" to "paste", "undo" to "undo",
        "redo" to "redo", "save" to "save", "share" to "share",
        "tips" to "tips", "hint" to "hint", "note" to "note",
        "task" to "task", "todo" to "todo", "ok" to "ok", "yes" to "yes",
        "no" to "no", "hello" to "hello", "sorry" to "sorry", "thanks" to "thanks",
        "wechat" to "wechat", "telegram" to "telegram", "whatsapp" to "whatsapp",
        "youtube" to "youtube", "netflix" to "netflix", "spotify" to "spotify",
        "twitter" to "twitter", "google" to "google", "chrome" to "chrome",
        "firefox" to "firefox", "safari" to "safari", "edge" to "edge",
        "office" to "office", "photoshop" to "photoshop", "bluetooth" to "bluetooth",
    )

    data class State(
        val enabled: Boolean,
        val items: List<Pair<String, String>>,
        val imported: List<Pair<String, String>> = emptyList(),
        /** 自造词（issue #29-5）：用户在词库管理手动维护的词表。独立于
         *  items（符号词）与 imported（文件导入），同一 txt 通道派生，
         *  但不受符号词开关 gating——用户词是词库本体，不是附加候选。 */
        val user: List<Pair<String, String>> = emptyList(),
        /** #29-3 英文词直出：拼音/双拼下直接敲出常见英文词。同一 txt
         *  通道派生（码列=字母序列字面，全拼/双拼通吃），独立开关，
         *  不进词库管理的增删 UI（内置表，后续再开用户自定义）。 */
        val englishEnabled: Boolean = true,
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
            State(root.optBoolean("enabled", true), items, imported, user,
                root.optBoolean("englishEnabled", true))
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
        englishEnabled: Boolean = true,
    ) {
        val root = JSONObject()
            .put("version", 1)
            .put("enabled", enabled)
            .put("englishEnabled", englishEnabled)
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
        deriveTxt(context, enabled, items, imported, user, englishEnabled)
        android.util.Log.i(
            "FeelimeCustomPhrase",
            "saved seed=$seed enabled=$enabled items=${items.size} imported=${imported.size} " +
                "user=${user.size} english=$englishEnabled txt=${txtFile(context).exists()}",
        )
    }

    /** 派生 custom_phrase.txt（每词条多行展开）。gating 边界（#29-5 起）：
     *  开关只管 items（符号词附加候选）；imported 与 user 是词库本体，
     *  各有自己的清空/管理入口，不随符号词开关消失。english（#29-3）
     *  同为独立开关。全部段为空（或关）才删 txt。 */
    private fun deriveTxt(
        context: Context,
        enabled: Boolean,
        items: List<Pair<String, String>>,
        imported: List<Pair<String, String>>,
        user: List<Pair<String, String>>,
        englishEnabled: Boolean,
    ) {
        val txt = txtFile(context)
        val deriving = (if (enabled) items else emptyList()) + imported + user
        val codes = codeTable(context)
        val english = if (englishEnabled) englishLines(codes) else emptyList()
        if (deriving.isEmpty() && english.isEmpty()) {
            txt.delete()
            return
        }
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
        // #29-3 英文词直出：码=字母序列字面（stabledb 按键字面匹配，
        // 全拼/双拼同一份码通吃，无需双拼变体展开——双拼下这些键的
        // 字面序列就是它本身）。
        lines.addAll(english)
        txt.writeText(lines.joinToString("\n", postfix = "\n"))
    }

    /** #29-3：内置英文表 -> txt 行，过滤能被完整切成拼音音节的词
     *  （如 sudo/beta/demo——su+do/be+ta/de+mo 是正常拼音键序，插英文
     *  候选反而打扰）。码表缺失（资产未就绪）时不过滤全量落表。
     *  参数化 words 便于单测。 */
    internal fun englishLines(
        codes: JSONObject?,
        words: List<Pair<String, String>> = DEFAULT_ENGLISH_WORDS,
    ): List<String> {
        val syllables = HashSet<String>()
        if (codes != null) {
            val keys = codes.keys()
            while (keys.hasNext()) syllables.add(keys.next())
        }
        return words.mapNotNull { (text, code) ->
            val collides = syllables.isNotEmpty() &&
                syllableSegmentations(code, syllables).any { seg -> seg.isNotEmpty() }
            if (collides) null else "$text\t$code\t1"
        }
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
