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

    /** 派生规则版本戳：deriveTxt 的产出规则变了就 bump（v2=#29-3 加
     *  english 段）。老 json 无此字段按 v1；load 见版本不匹配按当前规则
     *  重派生一次——否则升级用户的 txt 停在旧规则（英文词直出静默失效，
     *  真机验收 2026-09-26 问题 B），要碰一次开关才恢复。 */
    private const val DERIVE_VERSION = 4

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
     *  字母）。派生时过滤掉能被完整切成拼音音节的词（如 api=a+pi、
     *  demo=de+mo）——那些按键序列本就是正常拼音输入，插英文候选是
     *  打扰；github/ios/android 这类切不开的词才直出。选词时已按真实
     *  音节表剔除过死词条（api/demo/repo/cache/ping/share/safari），
     *  运行时过滤是防线不是常态路径。 */
    val DEFAULT_ENGLISH_WORDS: List<Pair<String, String>> = listOf(
        "GitHub" to "github", "iOS" to "ios", "Android" to "android",
        "iPhone" to "iphone", "iPad" to "ipad", "MacBook" to "macbook",
        "App" to "app", "APK" to "apk", "Windows" to "windows",
        "Linux" to "linux", "Ubuntu" to "ubuntu", "macOS" to "macos",
        "Python" to "python", "Java" to "java", "JavaScript" to "javascript",
        "TypeScript" to "typescript", "Golang" to "golang", "Rust" to "rust",
        "Kotlin" to "kotlin", "Dart" to "dart", "Flutter" to "flutter",
        "React" to "react", "Vue" to "vue", "HTML" to "html", "JSON" to "json",
        "XML" to "xml", "YAML" to "yaml", "SQL" to "sql", "SDK" to "sdk", "IDE" to "ide", "URL" to "url", "HTTP" to "http",
        "HTTPS" to "https", "DNS" to "dns", "VPN" to "vpn", "WiFi" to "wifi",
        "GPT" to "gpt", "LLM" to "llm", "GPU" to "gpu", "CPU" to "cpu",
        "RAM" to "ram", "SSD" to "ssd", "USB" to "usb", "HDMI" to "hdmi",
        "OCR" to "ocr", "OTG" to "otg", "NFC" to "nfc", "SIM" to "sim",
        "eSIM" to "esim", "QR" to "qr", "bug" to "bug", "debug" to "debug",
        "log" to "log", "crash" to "crash",
        "update" to "update", "upgrade" to "upgrade", "beta" to "beta",
        "commit" to "commit", "push" to "push", "pull" to "pull",
        "merge" to "merge", "branch" to "branch", "fork" to "fork",
        "issue" to "issue", "PR" to "pr", "code" to "code",
        "review" to "review", "test" to "test", "spec" to "spec",
        "doc" to "doc", "docs" to "docs", "wiki" to "wiki", "blog" to "blog",
        "email" to "email", "spam" to "spam", "login" to "login",
        "logout" to "logout", "token" to "token", "cookie" to "cookie", "server" to "server", "client" to "client",
        "cloud" to "cloud", "docker" to "docker", "nginx" to "nginx",
        "redis" to "redis", "mysql" to "mysql", "git" to "git",
        "vim" to "vim", "ssh" to "ssh", "sudo" to "sudo", "bash" to "bash",
        "zsh" to "zsh", "curl" to "curl", "wget" to "wget", "grep" to "grep",
        "download" to "download", "upload" to "upload",
        "copy" to "copy", "paste" to "paste", "undo" to "undo",
        "redo" to "redo", "save" to "save", "tips" to "tips", "hint" to "hint", "note" to "note",
        "task" to "task", "todo" to "todo", "ok" to "ok", "yes" to "yes",
        "no" to "no", "hello" to "hello", "sorry" to "sorry", "thanks" to "thanks",
        "wechat" to "wechat", "telegram" to "telegram", "whatsapp" to "whatsapp",
        "youtube" to "youtube", "netflix" to "netflix", "spotify" to "spotify",
        "twitter" to "twitter", "google" to "google", "chrome" to "chrome",
        "firefox" to "firefox", "edge" to "edge",
        "office" to "office", "photoshop" to "photoshop", "bluetooth" to "bluetooth",
        // 扩容（2026-09-27，#29）：平台/工具/硬件/格式/日常词 141 个，
        // 已按 custom-phrase-codes.json 真音节表预筛（meta/mouse/openai/
        // gemini/release/juejin 等能被完整切成拼音音节的词被吞掉，不落表）。
        "Apple" to "apple", "Microsoft" to "microsoft", "Amazon" to "amazon", "Claude" to "claude", "Copilot" to "copilot",
        "Notion" to "notion", "Obsidian" to "obsidian", "Typora" to "typora", "VSCode" to "vscode", "GitLab" to "gitlab",
        "Jenkins" to "jenkins", "Jira" to "jira", "Figma" to "figma", "Canvas" to "canvas", "Steam" to "steam",
        "Epic" to "epic", "Discord" to "discord", "Slack" to "slack", "Zoom" to "zoom", "Teams" to "teams",
        "Skype" to "skype", "TikTok" to "tiktok", "Reddit" to "reddit", "LinkedIn" to "linkedin", "Pinterest" to "pinterest",
        "Instagram" to "instagram", "Snapchat" to "snapchat", "Quora" to "quora", "Medium" to "medium", "ChatGPT" to "chatgpt",
        "Perplexity" to "perplexity", "HuggingFace" to "huggingface", "keyboard" to "keyboard", "monitor" to "monitor", "laptop" to "laptop",
        "desktop" to "desktop", "tablet" to "tablet", "charger" to "charger", "cable" to "cable", "adapter" to "adapter",
        "battery" to "battery", "headset" to "headset", "earbuds" to "earbuds", "AirPods" to "airpods", "Pixel" to "pixel",
        "Galaxy" to "galaxy", "OnePlus" to "oneplus", "ThinkPad" to "thinkpad", "Surface" to "surface", "Kindle" to "kindle",
        "router" to "router", "switch" to "switch", "modem" to "modem", "bandwidth" to "bandwidth", "ethernet" to "ethernet",
        "broadband" to "broadband", "firewall" to "firewall", "SMTP" to "smtp", "IMAP" to "imap", "SSL" to "ssl",
        "TLS" to "tls", "PDF" to "pdf", "CSV" to "csv", "TSV" to "tsv", "PNG" to "png",
        "JPEG" to "jpeg", "GIF" to "gif", "SVG" to "svg", "WebP" to "webp", "HEIC" to "heic",
        "AVI" to "avi", "MKV" to "mkv", "FLAC" to "flac", "AAC" to "aac", "ZIP" to "zip",
        "RAR" to "rar", "ISO" to "iso", "EXE" to "exe", "MSI" to "msi", "DMG" to "dmg",
        "PKG" to "pkg", "GCC" to "gcc", "Clang" to "clang", "CMake" to "cmake", "Gradle" to "gradle",
        "Maven" to "maven", "npm" to "npm", "yarn" to "yarn", "pnpm" to "pnpm", "cargo" to "cargo",
        "ESLint" to "eslint", "Prettier" to "prettier", "webpack" to "webpack", "Vite" to "vite", "Babel" to "babel",
        "Jest" to "jest", "Vitest" to "vitest", "JUnit" to "junit", "mock" to "mock", "stub" to "stub",
        "refactor" to "refactor", "deploy" to "deploy", "build" to "build", "feature" to "feature", "hotfix" to "hotfix",
        "sprint" to "sprint", "backlog" to "backlog", "standup" to "standup", "password" to "password", "username" to "username",
        "account" to "account", "profile" to "profile", "feedback" to "feedback", "contact" to "contact", "address" to "address",
        "message" to "message", "video" to "video", "music" to "music", "movie" to "movie", "photo" to "photo",
        "camera" to "camera", "weather" to "weather", "calendar" to "calendar", "alarm" to "alarm", "timer" to "timer",
        "reminder" to "reminder", "notebook" to "notebook", "folder" to "folder", "file" to "file", "screen" to "screen",
        "brightness" to "brightness", "volume" to "volume", "airplane" to "airplane", "hotspot" to "hotspot", "roaming" to "roaming",
        "voicemail" to "voicemail", "CSDN" to "csdn", "Gitee" to "gitee", "LeetCode" to "leetcode", "App Store" to "appstore",
        "iCloud" to "icloud",
    )

    // 高频日常词（#29 扩容二轮 2026-09-27，用户点名 how/are 等要能打）：
    val DAILY_ENGLISH_WORDS: List<Pair<String, String>> = listOf(
        "how" to "how", "what" to "what", "when" to "when", "where" to "where", "which" to "which", "who" to "who", "whom" to "whom",
        "whose" to "whose", "why" to "why", "want" to "want", "need" to "need", "love" to "love", "know" to "know", "think" to "think",
        "say" to "say", "tell" to "tell", "ask" to "ask", "answer" to "answer", "help" to "help", "work" to "work", "play" to "play",
        "walk" to "walk", "jump" to "jump", "swim" to "swim", "eat" to "eat", "drink" to "drink", "sleep" to "sleep", "read" to "read",
        "write" to "write", "learn" to "learn", "study" to "study", "teach" to "teach", "speak" to "speak", "listen" to "listen", "look" to "look",
        "watch" to "watch", "hear" to "hear", "feel" to "feel", "touch" to "touch", "taste" to "taste", "smell" to "smell", "come" to "come",
        "go" to "go", "leave" to "leave", "stay" to "stay", "arrive" to "arrive", "return" to "return", "start" to "start", "stop" to "stop",
        "finish" to "finish", "begin" to "begin", "end" to "end", "close" to "close", "buy" to "buy", "sell" to "sell", "pay" to "pay",
        "cost" to "cost", "spend" to "spend", "give" to "give", "bring" to "bring", "send" to "send", "receive" to "receive", "find" to "find",
        "get" to "get", "put" to "put", "keep" to "keep", "hold" to "hold", "carry" to "carry", "move" to "move", "turn" to "turn",
        "fix" to "fix", "break" to "break", "create" to "create", "call" to "call", "phone" to "phone", "text" to "text", "mail" to "mail",
        "chat" to "chat", "talk" to "talk", "meet" to "meet", "visit" to "visit", "travel" to "travel", "drive" to "drive", "fly" to "fly",
        "sail" to "sail", "good" to "good", "bad" to "bad", "big" to "big", "small" to "small", "tall" to "tall", "short" to "short",
        "wide" to "wide", "narrow" to "narrow", "fast" to "fast", "slow" to "slow", "early" to "early", "new" to "new", "old" to "old",
        "young" to "young", "hot" to "hot", "cold" to "cold", "warm" to "warm", "cool" to "cool", "dry" to "dry", "wet" to "wet",
        "clean" to "clean", "dirty" to "dirty", "easy" to "easy", "hard" to "hard", "soft" to "soft", "light" to "light", "dark" to "dark",
        "thick" to "thick", "thin" to "thin", "rich" to "rich", "poor" to "poor", "full" to "full", "empty" to "empty", "high" to "high",
        "low" to "low", "near" to "near", "far" to "far", "safe" to "safe", "dangerous" to "dangerous", "happy" to "happy", "sad" to "sad",
        "angry" to "angry", "tired" to "tired", "hungry" to "hungry", "thirsty" to "thirsty", "bored" to "bored", "busy" to "busy", "free" to "free",
        "ready" to "ready", "maybe" to "maybe", "almost" to "almost", "always" to "always", "never" to "never", "often" to "often", "sometimes" to "sometimes",
        "usually" to "usually", "rarely" to "rarely", "really" to "really", "very" to "very", "quite" to "quite", "too" to "too", "enough" to "enough",
        "again" to "again", "once" to "once", "twice" to "twice", "day" to "day", "week" to "week", "month" to "month", "year" to "year",
        "hour" to "hour", "second" to "second", "morning" to "morning", "noon" to "noon", "evening" to "evening", "night" to "night", "today" to "today",
        "tomorrow" to "tomorrow", "yesterday" to "yesterday", "now" to "now", "soon" to "soon", "later" to "later", "then" to "then", "next" to "next",
        "last" to "last", "first" to "first", "third" to "third", "people" to "people", "person" to "person", "friend" to "friend", "family" to "family",
        "mother" to "mother", "father" to "father", "sister" to "sister", "brother" to "brother", "son" to "son", "daughter" to "daughter", "child" to "child",
        "children" to "children", "kid" to "kid", "baby" to "baby", "girl" to "girl", "boy" to "boy", "husband" to "husband", "wife" to "wife",
        "home" to "home", "room" to "room", "door" to "door", "window" to "window", "table" to "table", "chair" to "chair", "bed" to "bed",
        "kitchen" to "kitchen", "bathroom" to "bathroom", "garden" to "garden", "street" to "street", "road" to "road", "city" to "city", "town" to "town",
        "country" to "country", "world" to "world", "place" to "place", "space" to "space", "water" to "water", "coffee" to "coffee", "milk" to "milk",
        "bread" to "bread", "meat" to "meat", "fruit" to "fruit", "sugar" to "sugar", "salt" to "salt", "food" to "food", "lunch" to "lunch",
        "dinner" to "dinner", "breakfast" to "breakfast", "money" to "money", "price" to "price", "dollar" to "dollar", "number" to "number", "letter" to "letter",
        "word" to "word", "title" to "title", "story" to "story", "book" to "book", "list" to "list", "show" to "show", "sport" to "sport",
        "ball" to "ball", "team" to "team", "player" to "player", "school" to "school", "class" to "class", "student" to "student", "teacher" to "teacher",
        "lesson" to "lesson", "exam" to "exam", "homework" to "homework", "question" to "question", "job" to "job", "company" to "company", "boss" to "boss",
        "project" to "project", "plan" to "plan", "idea" to "idea", "news" to "news", "fact" to "fact", "truth" to "truth", "dream" to "dream",
        "goal" to "goal", "life" to "life", "death" to "death", "health" to "health", "body" to "body", "head" to "head", "hand" to "hand",
        "ear" to "ear", "nose" to "nose", "mouth" to "mouth", "foot" to "foot", "leg" to "leg", "arm" to "arm", "heart" to "heart",
        "car" to "car", "bus" to "bus", "train" to "train", "plane" to "plane", "ship" to "ship", "trip" to "trip", "map" to "map",
        "spring" to "spring", "summer" to "summer", "autumn" to "autumn", "winter" to "winter", "rain" to "rain", "snow" to "snow", "wind" to "wind",
        "moon" to "moon", "star" to "star", "sky" to "sky", "tree" to "tree", "flower" to "flower", "grass" to "grass", "river" to "river",
        "mountain" to "mountain", "beach" to "beach", "rainbow" to "rainbow", "storm" to "storm", "thunder" to "thunder", "lightning" to "lightning", "because" to "because",
        "since" to "since", "while" to "while", "during" to "during", "before" to "before", "after" to "after", "above" to "above", "below" to "below",
        "under" to "under", "over" to "over", "between" to "between", "through" to "through", "against" to "against", "without" to "without", "about" to "about",
        "able" to "able", "available" to "available", "useful" to "useful", "helpful" to "helpful", "important" to "important", "different" to "different", "similar" to "similar",
        "better" to "better", "best" to "best", "worse" to "worse", "worst" to "worst", "possible" to "possible", "true" to "true", "false" to "false",
        "right" to "right", "wrong" to "wrong", "clear" to "clear", "simple" to "simple", "quick" to "quick", "direct" to "direct", "exact" to "exact",
        "black" to "black", "white" to "white", "red" to "red", "blue" to "blue", "green" to "green", "yellow" to "yellow", "purple" to "purple",
        "pink" to "pink", "brown" to "brown", "grey" to "grey", "gray" to "gray", "there" to "there", "everywhere" to "everywhere", "anywhere" to "anywhere",
        "somewhere" to "somewhere", "nowhere" to "nowhere", "everyone" to "everyone", "everything" to "everything", "nobody" to "nobody", "nothing" to "nothing", "something" to "something",
        "anything" to "anything", "someone" to "someone", "anybody" to "anybody", "lot" to "lot", "kind" to "kind", "type" to "type", "way" to "way",
        "method" to "method", "part" to "part", "bit" to "bit", "group" to "group", "set" to "set", "pair" to "pair", "box" to "box",
        "bag" to "bag", "please" to "please", "thank" to "thank", "welcome" to "welcome", "congratulations" to "congratulations", "excuse" to "excuse", "search" to "search",
        "check" to "check", "choose" to "choose", "pick" to "pick", "select" to "select", "english" to "english", "japanese" to "japanese", "french" to "french",
        "russian" to "russian", "german" to "german", "spanish" to "spanish", "korean" to "korean", "phrase" to "phrase", "sentence" to "sentence", "paragraph" to "paragraph",
        "chapter" to "chapter", "section" to "section", "edit" to "edit", "cut" to "cut", "internet" to "internet", "online" to "online", "offline" to "offline",
        "website" to "website", "webpage" to "webpage", "link" to "link", "network" to "network", "power" to "power", "energy" to "energy", "oil" to "oil",
        "gas" to "gas", "fire" to "fire", "ice" to "ice", "war" to "war", "peace" to "peace", "doctor" to "doctor", "nurse" to "nurse",
        "driver" to "driver", "farmer" to "farmer", "cook" to "cook", "waiter" to "waiter", "singer" to "singer", "dancer" to "dancer", "artist" to "artist",
        "writer" to "writer", "holiday" to "holiday", "vacation" to "vacation", "birthday" to "birthday", "party" to "party", "gift" to "gift", "present" to "present",
        "card" to "card", "picture" to "picture", "image" to "image", "painting" to "painting", "drawing" to "drawing", "voice" to "voice", "sound" to "sound",
        "noise" to "noise", "silence" to "silence", "quiet" to "quiet", "loud" to "loud", "problem" to "problem", "solution" to "solution", "trouble" to "trouble",
        "difficulty" to "difficulty", "past" to "past", "history" to "history", "science" to "science", "art" to "art", "math" to "math", "physics" to "physics",
        "chemistry" to "chemistry", "biology" to "biology", "law" to "law", "business" to "business", "economics" to "economics", "guitar" to "guitar", "violin" to "violin",
        "drum" to "drum", "football" to "football", "basketball" to "basketball", "tennis" to "tennis", "swimming" to "swimming", "golf" to "golf", "chess" to "chess",
        "festival" to "festival", "christmas" to "christmas",
    )

    // 音节冲突词（键序=正常拼音，如 are=a+re、time=ti+me）：quality 0 落表排
    // 在拼音候选之后（低位直出），不顶中文。
    val COLLIDING_ENGLISH_WORDS: List<Pair<String, String>> = listOf(
        "are" to "are", "like" to "like", "hate" to "hate", "run" to "run", "see" to "see", "open" to "open", "take" to "take",
        "lose" to "lose", "make" to "make", "ride" to "ride", "long" to "long", "late" to "late", "sure" to "sure", "time" to "time",
        "minute" to "minute", "man" to "man", "woman" to "woman", "house" to "house", "tea" to "tea", "rice" to "rice", "orange" to "orange",
        "banana" to "banana", "cake" to "cake", "name" to "name", "page" to "page", "line" to "line", "song" to "song", "game" to "game",
        "meeting" to "meeting", "eye" to "eye", "bike" to "bike", "sun" to "sun", "sea" to "sea", "same" to "same", "here" to "here",
        "piece" to "piece", "change" to "change", "chinese" to "chinese", "share" to "share", "delete" to "delete", "police" to "police", "future" to "future",
        "medicine" to "medicine", "piano" to "piano", "running" to "running", "boxing" to "boxing",
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

    /** 读取真相源；json 不存在时（首装）种子写入默认表并派生 txt；
     *  已存在但派生版本落后时按当前规则重派生（升级路径，见
     *  [DERIVE_VERSION]）。@Synchronized 与 save 互斥：迁移的
     *  读-重派生-写若与设置页保存交错，旧状态会覆盖用户的新保存
     *  （codex 评审 P2-5）。 */
    @Synchronized
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
            val state = State(root.optBoolean("enabled", true), items, imported, user,
                root.optBoolean("englishEnabled", true))
            if (root.optInt("derive", 1) != DERIVE_VERSION) {
                save(context, state.enabled, state.items, state.imported, state.user,
                    englishEnabled = state.englishEnabled)
                // 迁移改写了 txt：已在跑的 IME 引擎还挂着旧 txt，广播让它
                // 整引擎重载（stabledb 生命周期绑定引擎）。迁移只发生一次
                // （版本戳落定），不会刷屏。
                context.sendBroadcast(
                    android.content.Intent("com.feelime.ime.CUSTOM_PHRASES_CHANGED")
                        .setPackage(context.packageName),
                )
            }
            state
        } catch (_: Exception) {
            State(true, DEFAULT_ITEMS)
        }
    }

    /** 落盘 json + 派生/删除 txt。seed=true 时跳过 enabled 持久化语义
     * （首装默认开，行为一致，仅日志区分）。@Synchronized 见 load。
     * 落盘顺序：先 txt 后 json——derive 版本戳是「派生已完成」的提交点；
     * 反过来（旧顺序）时进程死在两写之间会留下「戳已新、txt 停在旧规
     * 则」且永不重试（codex 评审 P2-5）。先 txt 后 json，中断后的下一
     * 次 load 仍见旧戳、重派生一次，幂等收敛。 */
    @Synchronized
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
            .put("derive", DERIVE_VERSION)
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
        deriveTxt(context, enabled, items, imported, user, englishEnabled)
        jsonFile(context).writeText(root.toString())
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
        val english = if (englishEnabled) {
            englishLines(codes, frequencyWords = frequencyEnglishWords(context))
        } else emptyList()
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

    /** #29-3：内置英文表 -> txt 行，双轨落表（扩容二轮 2026-09-27，用户
     *  点名 how/are 都要能打）：
     *  - 主轨（DEFAULT+DAILY，quality 1）：切不开拼音音节的词（github/
     *    how），键序无拼音语义，直出不打扰。
     *  - 低位轨（COLLIDING，quality 0）：键序=正常拼音的词（are=a+re、
     *    time=ti+me）——用户高频英文词也要能打，以最低权重落表排在
     *    拼音候选之后，不顶中文。
     *  码表缺失（资产未就绪）时主轨不过滤全量落表。参数化便于单测。 */
    internal fun englishLines(
        codes: JSONObject?,
        words: List<Pair<String, String>> = DEFAULT_ENGLISH_WORDS + DAILY_ENGLISH_WORDS,
        lowRankWords: List<Pair<String, String>> = COLLIDING_ENGLISH_WORDS,
        frequencyWords: List<Pair<String, String>> = emptyList(),
    ): List<String> {
        val syllables = HashSet<String>()
        if (codes != null) {
            val keys = codes.keys()
            while (keys.hasNext()) syllables.add(keys.next())
        }
        val primary = words.mapNotNull { (text, code) ->
            val collides = syllables.isNotEmpty() &&
                syllableSegmentations(code, syllables).any { seg -> seg.isNotEmpty() }
            if (collides) null else "$text\t$code\t1"
        } + frequencyWords.map { (text, code) -> "$text\t$code\t1" }
        // 权重注（AVD 实测 2026-09-27）：stabledb 词条权重不参与与主词典
        // 的组间排序——0/1/-99 落表后候选位次相同（are 都在第 4 位）。
        // 低位轨保留作语义分类（与拼音键序重叠的词），quality 与主轨
        // 一致；真要压位需双 translator 实例重构（下版本评估）。
        return primary + lowRankWords.map { (text, code) -> "$text\t$code\t1" }
    }

    /** 测试探针：码能否被音节集完整切分（低位表完整性断言用）。 */
    internal fun englishLinesRun(code: String, syllables: Set<String>): Boolean =
        syllableSegmentations(code, syllables).any { it.isNotEmpty() }

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

    /** 高频英文词表（assets/english-words.txt，google-10000 词频）：一行
     *  `Display\tcode`。不编译成 Kotlin 字面量——9000+ 对的 listOf 会
     *  生成超 JVM 65KB 方法体限制的巨型 clinit（编译 daemon 崩，
     *  FileNotFoundException 于 class 输出）。lazy 读 + 缓存。 */
    @Volatile private var frequencyWordsCache: List<Pair<String, String>>? = null
    fun frequencyEnglishWords(context: Context): List<Pair<String, String>> {
        frequencyWordsCache?.let { return it }
        return runCatching {
            context.assets.open("english-words.txt").bufferedReader().readLines()
                .mapNotNull { line ->
                    val parts = line.split('\t')
                    if (parts.size == 2 && parts[0].isNotEmpty() && parts[1].isNotEmpty()) {
                        parts[0] to parts[1]
                    } else null
                }.also { frequencyWordsCache = it }
        }.getOrDefault(emptyList())
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
