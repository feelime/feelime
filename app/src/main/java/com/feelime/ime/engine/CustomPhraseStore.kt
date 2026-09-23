package com.feelime.ime.engine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 自定义短语（issue #17：候选附加预设符号/emoji 词）：真相源是
 * files/rime-user/custom-phrases.json（{version, items:[{text,code}]}，
 * code 是用户输入的全拼串），派生物是 rime 的
 * files/rime-user/custom_phrase.txt。stabledb 码列匹配的是用户实际
 * 按键序列的字面（AVD 实测：全拼码在双拼下不命中），所以派生时每个
 * 词条展开成多行——code 原样一行 +（code 是合法单音节时）该音节在
 * 四个双拼方案下的全部规范拼式各一行（变体并集来自 APK 资产
 * custom-phrase-codes.json，generate-keyboard-data.py 产出）。同一份
 * txt 覆盖全拼和全部双拼方案；跨方案码行字面共存只会带来「别的按键
 * 序列也能打出这个词」的附加候选，不会错词。
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
        for ((text, code) in items) {
            val variants = LinkedHashSet<String>()
            variants.add(code)
            // 单音节展开四方案拼式；非音节（缩写/多音节）只写原码行。
            codes?.optJSONArray(code)?.let { array ->
                for (i in 0 until array.length()) variants.add(array.optString(i))
            }
            for (variant in variants) lines.add("$text\t$variant\t1")
        }
        txt.writeText(lines.joinToString("\n", postfix = "\n"))
    }

    /** APK 资产拼式表（音节→按键变体并集）。缺失时降级为仅全拼码行。 */
    @Volatile private var codeTableCache: JSONObject? = null
    private fun codeTable(context: Context): JSONObject? {
        codeTableCache?.let { return it }
        return runCatching {
            val text = context.assets.open("custom-phrase-codes.json").bufferedReader().use { it.readText() }
            JSONObject(text).also { codeTableCache = it }
        }.getOrNull()
    }
}
