package com.feelime.ime

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.util.Log
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Model management for thin builds (design §12.3).
 *
 * Full builds carry the ASR/punctuation models as APK assets; thin builds
 * (-PfeelimeModels=thin) ship without them and download on demand from the
 * mirror prefixes listed in the build-embedded manifest (the gradle
 * generateModelManifest task fills real sha256/bytes from the local full
 * copies). Files land under filesDir/models/<dir>/ and the model is sealed
 * with an INSTALL.json record written only after every file passed the
 * manifest digest - a missing/broken record reads as "not installed".
 *
 * Engine-facing lookup is ModelStore.sourceFor(role): AUTO uses a packaged
 * asset when present and falls back to the verified download; REMOTE ignores
 * packaged assets. sherpa-onnx loads file paths when constructed with a null
 * AssetManager (newFromFile JNI branch). */

/** One file of a model: path relative to the manifest (first segment is the
 * directory sherpa expects, e.g. "asr-model/encoder.int8.onnx"). */
data class ModelFileSpec(
    /** Path used by the engine and by the local full asset tree. */
    val path: String,
    /** Digest of the final on-disk content (after any gunzip). */
    val sha256: String,
    val bytes: Long,
    /** Remote file name in the distribution channel. Model assets use stable
     * local names while upstream releases carry epoch/averaging suffixes. */
    val downloadPath: String = path,
    /** The served file is gzip-compressed: verify the wire bytes against
     * [downloadSha256]/[downloadBytes], gunzip to [path] content. */
    val gunzip: Boolean = false,
    /** Wire-side digest when the served file differs from [sha256] (gzip). */
    val downloadSha256: String? = null,
    /** Wire-side byte count; also the progress denominator. */
    val downloadBytesOverride: Long? = null,
) {
    val wireSha256: String get() = downloadSha256 ?: sha256
    val downloadBytes: Long get() = downloadBytesOverride ?: bytes
}

data class ModelSpec(
    val id: String,
    val title: String,
    val role: String,
    val version: String,
    val files: List<ModelFileSpec>,
    /** Download bases per source (distribution 频道直链，release 附件目录）。
     * ModelStore resolves these to the persisted source choice before
     * starting a download. */
    val sources: Map<String, String> = emptyMap(),
    /** Legacy mirror prefixes (dev-urls 注入目标）；no longer consulted for
     * source selection - kept so a developer manifest still parses. */
    val urls: List<String> = emptyList(),
) {
    val dir: String get() = files.first().path.substringBefore('/')
    val totalBytes: Long get() = files.sumOf { it.bytes }
    /** Bytes transferred from the network. gzip-backed files count the
     * compressed size so the UI does not promise 105 MB while it actually
     * downloads 91 MB. */
    val totalDownloadBytes: Long get() = files.sumOf { it.downloadBytes }
    /** The repo manifest ships placeholder digests until dev-models.sh /
     * generateModelManifest fill them from a local verified copy. */
    val verified: Boolean get() = files.all {
        it.sha256.length == 64 && it.bytes > 0
    }
}

/** Where verified model files are fetched from.  The source is deliberately
 * separate from the model backend: the latter chooses APK assets versus a
 * downloaded copy, while this choice only controls the network endpoint. */
enum class ModelDownloadSource(val value: String) {
    // gitee release 资产直链（feelime/distribution 镜像）：国内直连，默认源。
    GITEE("gitee"),
    GITHUB("github"),
    GHPROXY("ghproxy"),
    CUSTOM("custom");

    companion object {
        fun fromValue(value: String?): ModelDownloadSource = when (
            value?.lowercase(Locale.ROOT)
        ) {
            GITHUB.value -> GITHUB
            GHPROXY.value -> GHPROXY
            CUSTOM.value -> CUSTOM
            // 遗留 hf_mirror/official 值与缺省一律回落 gitee：两端内容同源，
            // 完整性由 manifest SHA-256 兜底，静默迁移安全。
            else -> GITEE
        }
    }
}

data class ModelDownloadSourceConfig(
    val source: ModelDownloadSource,
    val customBase: String = "",
)

data class ModelDownloadError(
    val code: String,
    val detail: String,
)

/** Which model location the engine is allowed to use.
 *
 * AUTO is the normal Play/PAD mode: an install-time asset is preferred and a
 * verified downloaded copy is the fallback. REMOTE deliberately ignores the
 * packaged copy, so users can switch to a downloaded model without the PAD
 * bytes silently taking precedence. The choice is persisted by ModelStore;
 * this enum stays pure Kotlin so its wire values and defaults can be tested
 * without an Android Context.
 */
enum class ModelBackend(val value: String) {
    AUTO("auto"),
    REMOTE("remote");

    companion object {
        fun fromValue(value: String?): ModelBackend? = when (value?.lowercase(Locale.ROOT)) {
            AUTO.value -> AUTO
            REMOTE.value -> REMOTE
            else -> null
        }

        /** Full installs must work offline on first launch. Thin direct
         * installs start with downloads; an explicit saved choice wins. */
        fun defaultFor(playDistribution: Boolean, bundledStreamingModel: Boolean = false): ModelBackend =
            if (playDistribution || bundledStreamingModel) AUTO else REMOTE
    }
}

class ModelManifest(val models: List<ModelSpec>) {
    fun byRole(role: String): ModelSpec? = models.firstOrNull { it.role == role }

    companion object {
        /** Tolerant: any structural surprise yields an empty manifest (the
         * engines then report "model missing" instead of crashing). */
        fun parse(text: String): ModelManifest {
            val root = runCatching { JsonParser(text).parseDocument() }
                .getOrNull() as? Map<*, *> ?: return ModelManifest(emptyList())
            val models = (root["models"] as? List<*>)?.mapNotNull { entry ->
                val map = entry as? Map<*, *> ?: return@mapNotNull null
                val id = map["id"] as? String ?: return@mapNotNull null
                val rawFiles = map["files"] as? List<*> ?: return@mapNotNull null
                val files = rawFiles.mapNotNull { item ->
                    val fileMap = item as? Map<*, *> ?: return@mapNotNull null
                    val path = fileMap["path"] as? String ?: return@mapNotNull null
                    // A file entry without a digest is unusable (downloads are
                    // verified against it) - drop it; the placeholder digests
                    // of the repo manifest are kept but read unverified.
                    val sha256 = (fileMap["sha256"] as? String).takeIf { !it.isNullOrEmpty() }
                        ?: return@mapNotNull null
                    val gunzip = fileMap["gunzip"] == true
                    val wireSha = (fileMap["downloadSha256"] as? String)
                        ?.takeIf { it.length == 64 }
                    val wireBytes = (fileMap["downloadBytes"] as? Number)?.toLong()
                        ?.takeIf { it > 0 }
                    // gzip 存放必须带静态 wire 指纹（distribution 附件口径）；
                    // 缺失 = 清单坏档，按不可用处理而不是下载必炸。
                    if (gunzip && (wireSha == null || wireBytes == null)) return@mapNotNull null
                    ModelFileSpec(
                        path = path,
                        sha256 = sha256,
                        bytes = (fileMap["bytes"] as? Number)?.toLong() ?: 0L,
                        downloadPath = (fileMap["downloadPath"] as? String)
                            ?.trim()
                            ?.takeIf { it.isNotEmpty() }
                            ?: path,
                        gunzip = gunzip,
                        downloadSha256 = wireSha,
                        downloadBytesOverride = wireBytes,
                    )
                }
                if (files.size != rawFiles.size || files.isEmpty()) return@mapNotNull null
                ModelSpec(
                    id = id,
                    title = map["title"] as? String ?: id,
                    role = map["role"] as? String ?: "",
                    version = map["version"] as? String ?: "",
                    files = files,
                    sources = (map["sources"] as? Map<*, *>)
                        ?.mapNotNull { (key, value) ->
                            val source = key as? String
                            val url = value as? String
                            if (source.isNullOrBlank() || url.isNullOrBlank()) null
                            else source to url
                        }
                        ?.toMap()
                        .orEmpty(),
                    urls = (map["urls"] as? List<*>)?.filterIsInstance<String>().orEmpty(),
                )
            }.orEmpty()
            return ModelManifest(models)
        }
    }
}

/** Where a model actually lives: APK assets (full builds) or the verified
 * download root (absolute; sherpa's file mode). Paths stay manifest-relative
 * ("final-model/tokens.txt") in both modes - Directory.root is filesDir/models
 * WITHOUT the model dir, so pathFor must always receive the full relative
 * path. */
sealed interface ModelSource {
    object Assets : ModelSource
    data class Directory(val root: String) : ModelSource
}

fun ModelSource.pathFor(manifestPath: String): String = when (this) {
    is ModelSource.Assets -> manifestPath
    is ModelSource.Directory -> "$root/$manifestPath"
}

/** Download transport seam (mirrors update.UrlConnectionFactory, plus the
 * Range header resume needs); JVM tests inject a fake. */
interface ModelConnectionFactory {
    fun open(url: URI, rangeFrom: Long): ModelConnection
}

interface ModelConnection {
    val responseCode: Int
    fun body(): InputStream
    fun disconnect()
}

/** feelime/distribution 仓库的源根目录（与 models/manifest.json 各条目的
 * sources 值同源；ModelManifestTest 里有 pin 测试对账）。测速探针从这里拼。 */
val MODEL_DISTRIBUTION_ROOTS: Map<String, String> = mapOf(
    "gitee" to "https://gitee.com/feelime/distribution/releases/download/",
    "github" to "https://github.com/feelime/distribution/releases/download/",
    "ghproxy" to "https://gh-proxy.com/https://github.com/feelime/distribution/releases/download/",
)

/** 测速探针文件：handwriting 频道的 metainfo（几百字节、恒在、与其他频道
 * 同 CDN）。custom 源回退探测 base 本身（LAN http.server 目录列表 200）。 */
const val MODEL_SPEED_PROBE_FILE = "handwriting/handwriting-metainfo.json"

/** Download-source latency probe（参考 podic speed_test）：GET 一个真实小
 * 文件量总耗时（含连接、重定向、完整 body），失败返回 null。并发由调用方
 * 编排；这里只负责单次探测。 */
internal class ModelSourceSpeedTester(
    private val connectionFactory: ModelConnectionFactory,
    private val allowHttp: Boolean,
) {
    fun probe(base: String, probePath: String?): Long? {
        if (!allowHttp && base.substringBefore(':').equals("http", ignoreCase = true)) return null
        val url = base.trimEnd('/') + "/" + (probePath ?: "")
        val start = System.nanoTime()
        return try {
            val connection = connectionFactory.open(URI.create(url), 0)
            try {
                if (connection.responseCode !in HTTP_OK..HTTP_NO_CONTENT) return null
                connection.body().use { stream ->
                    val buffer = ByteArray(16 * 1024)
                    while (stream.read(buffer) >= 0) { /* drain */ }
                }
            } finally {
                runCatching { connection.disconnect() }
            }
            (System.nanoTime() - start) / 1_000_000
        } catch (_: Exception) {
            null
        }
    }

    /** 固定三源走 metainfo 探针；custom 允许回退到 base 本身（目录列表）。 */
    fun probeSource(base: String, isCustom: Boolean): Long? {
        return probe(base, MODEL_SPEED_PROBE_FILE).takeIf { it != null || !isCustom }
            ?: probe(base, null)
    }

    private companion object {
        const val HTTP_OK = 200
        const val HTTP_NO_CONTENT = 299
    }
}

/** Production transport: GET with an optional Range header. Plain http is
 * admitted (LAN mirrors); integrity comes from the manifest SHA-256, not the
 * transport. Redirects are followed manually (bounded) with the Range header
 * re-applied - the HF /resolve/ endpoints answer 308 to their CDN. */
class HttpModelConnectionFactory(
    private val connectTimeoutMs: Int = 10_000,
    private val readTimeoutMs: Int = 30_000,
    private val allowHttp: Boolean = true,
    private val openConnection: (java.net.URL) -> HttpURLConnection = {
        it.openConnection() as HttpURLConnection
    },
) : ModelConnectionFactory {
    override fun open(url: URI, rangeFrom: Long): ModelConnection {
        var current = url
        var hops = 0
        while (true) {
            if (!schemeAllowed(current)) {
                throw IOException("不允许的模型下载协议：${current.scheme ?: "unknown"}")
            }
            val connection = openConnection(current.toURL())
            connection.requestMethod = "GET"
            connection.connectTimeout = connectTimeoutMs
            connection.readTimeout = readTimeoutMs
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            if (rangeFrom > 0) connection.setRequestProperty("Range", "bytes=$rangeFrom-")
            val code = connection.responseCode
            if (code in REDIRECT_CODES) {
                val location = connection.getHeaderField("Location")
                connection.disconnect()
                if (location.isNullOrEmpty()) throw IOException("重定向缺少 Location：$current")
                hops += 1
                if (hops > MAX_REDIRECTS) throw IOException("重定向次数过多：$current")
                val next = current.resolve(location)
                if (!schemeAllowed(next)) {
                    throw IOException("模型下载重定向到不允许的协议：${next.scheme ?: "unknown"}")
                }
                current = next
                continue
            }
            return object : ModelConnection {
                override val responseCode get() = connection.responseCode
                override fun body(): InputStream = connection.inputStream
                override fun disconnect() = connection.disconnect()
            }
        }
    }

    private fun schemeAllowed(url: URI): Boolean = when (url.scheme?.lowercase(Locale.ROOT)) {
        "https" -> true
        "http" -> allowHttp
        else -> false
    }

    private companion object {
        val REDIRECT_CODES = setOf(
            HttpURLConnection.HTTP_MOVED_PERM,
            HttpURLConnection.HTTP_MOVED_TEMP,
            HttpURLConnection.HTTP_SEE_OTHER,
            307,
            308,
        )
        const val MAX_REDIRECTS = 5
    }
}

class ModelStore(
    private val context: Context,
    private val connectionFactory: ModelConnectionFactory? = null,
    /** Plain http is allowed on every channel: a LAN mirror is the primary
     * use case, and integrity never relies on the transport - every byte is
     * checked against the embedded manifest SHA-256 before installation. */
    private val allowHttp: Boolean = true,
) {
    enum class State { BUILT_IN, MISSING, DOWNLOADING, IMPORTING, INSTALLED, BROKEN }

    interface Listener {
        /** Cumulative bytes transferred from the network; archive-backed
         * files count the compressed archive. Throttling happens at the UI. */
        fun onProgress(modelId: String, doneBytes: Long, totalBytes: Long)
        fun onFinished(modelId: String, state: State, error: String?)
        /** Import status is separate from byte progress because a
         * ContentResolver stream may not expose its total size. */
        fun onStatus(modelId: String, status: String) = Unit
    }

    private val worker by lazy {
        Executors.newSingleThreadExecutor { task -> Thread(task, "feelime-models") }
    }
    /** 测速探针并发池（gitee/github/ghproxy/custom 四源并发，podic 语义）。 */
    private val speedWorker by lazy {
        Executors.newFixedThreadPool(MODEL_DISTRIBUTION_ROOTS.size + 1) { task ->
            Thread(task, "feelime-model-speed")
        }
    }
    private val speedTestRunning = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    /** Serializes the final import decision with deletion.  Extraction may
     * happen outside this lock, but the cancellation check and directory swap
     * must be one transaction or a delete can be followed by a late install. */
    private val installLock = Any()
    private var closed = false
    @Volatile private var activeId: String? = null
    @Volatile private var activeOperation: State? = null
    @Volatile private var cachedManifest: ModelManifest? = null
    /** A successful digest check is reusable while every file's observable
     * fingerprint is unchanged. The first lookup after process start always
     * hashes the complete model tree; settings/status refreshes then avoid
     * re-reading ~200 MB on every state push. */
    private val verifiedInstallCache = ConcurrentHashMap<String, VerifiedInstall>()

    /** A saved source choice wins. Without one, full/PAD installs use their
     * assets and thin direct installs expose the download path. */
    fun modelBackend(): ModelBackend = ModelBackend.fromValue(
        backendPreferences.getString(KEY_MODEL_BACKEND, null),
    ) ?: ModelBackend.defaultFor(
        BuildConfig.PLAY_DISTRIBUTION,
        manifest().byRole("asr-streaming")?.let(::assetsComplete) == true,
    )

    fun setModelBackend(backend: ModelBackend) {
        backendPreferences.edit().putString(KEY_MODEL_BACKEND, backend.value).commit()
    }

    fun modelDownloadSource(): ModelDownloadSourceConfig {
        val source = ModelDownloadSource.fromValue(
            backendPreferences.getString(KEY_MODEL_DOWNLOAD_SOURCE, null),
        )
        val customBase = backendPreferences.getString(KEY_MODEL_DOWNLOAD_CUSTOM, "") ?: ""
        // customBase 留空是合法的 dev 形态（下载时回退 dev-urls 注入的 LAN
        // 前缀）；只有显式填了非法地址才回落 gitee 默认。
        if (source == ModelDownloadSource.CUSTOM &&
            customBase.isNotBlank() && !validSourceBase(customBase)
        ) {
            return ModelDownloadSourceConfig(ModelDownloadSource.GITEE)
        }
        return ModelDownloadSourceConfig(source, customBase)
    }

    /** Persist only syntactically valid http(s) endpoints.  Plain http is
     * allowed because integrity rests on the manifest SHA-256 checks, not
     * on transport.  An empty customBase is accepted: the download then
     * falls back to the dev-urls LAN prefixes embedded by the build. */
    fun setModelDownloadSource(source: ModelDownloadSource, customBase: String): Boolean {
        val normalized = customBase.trim().trimEnd('/')
        if (source == ModelDownloadSource.CUSTOM &&
            normalized.isNotBlank() && !validSourceBase(normalized)
        ) return false
        backendPreferences.edit()
            .putString(KEY_MODEL_DOWNLOAD_SOURCE, source.value)
            .putString(KEY_MODEL_DOWNLOAD_CUSTOM, normalized)
            .commit()
        return true
    }

    /** Stable state consumed by SettingsBridge so a failed request remains
     * visible after the one-shot worker callback and after activity recreation. */
    fun lastDownloadError(modelId: String): ModelDownloadError? {
        val raw = backendPreferences.getString(errorKey(modelId), null) ?: return null
        val separator = raw.indexOf('\n')
        if (separator < 0) return ModelDownloadError("MODEL_DOWNLOAD_FAILED", raw)
        return ModelDownloadError(raw.substring(0, separator), raw.substring(separator + 1))
    }

    fun recordDownloadError(modelId: String, code: String, detail: String) {
        val safeDetail = detail.trim().take(MAX_ERROR_DETAIL)
        backendPreferences.edit()
            .putString(errorKey(modelId), "${code.trim()}\n$safeDetail")
            .apply()
    }

    fun clearDownloadError(modelId: String) {
        backendPreferences.edit().remove(errorKey(modelId)).apply()
    }

    private val backendPreferences by lazy {
        context.getSharedPreferences(MODEL_PREFS, Context.MODE_PRIVATE)
    }

    fun manifest(): ModelManifest {
        cachedManifest?.let { return it }
        val parsed = runCatching {
            context.assets.open(MANIFEST_ASSET).use { stream ->
                ModelManifest.parse(stream.readBytes().decodeToString())
            }
        }.onFailure { Log.w(TAG, "model manifest unreadable", it) }
            .getOrDefault(ModelManifest(emptyList()))
        cachedManifest = parsed
        return parsed
    }

    fun spec(role: String): ModelSpec? = manifest().byRole(role)

    /** Engine lookup according to the persisted backend choice. Null = the
     * voice entry must report the model as missing. */
    fun sourceFor(role: String): ModelSource? {
        val model = spec(role) ?: return null
        // 默认按当前模型判断。thin 只内置手写，不能因为语音模型没
        // 内置就忽略它；用户明确选择下载模型时仍尊重该选择。
        val bundled = assetsComplete(model)
        if (backendForModel(bundled) == ModelBackend.AUTO && bundled) {
            return ModelSource.Assets
        }
        return installedSource(model)
    }

    private fun backendForModel(bundled: Boolean): ModelBackend =
        ModelBackend.fromValue(backendPreferences.getString(KEY_MODEL_BACKEND, null))
            ?: ModelBackend.defaultFor(BuildConfig.PLAY_DISTRIBUTION, bundled)

    private fun installedSource(model: ModelSpec): ModelSource.Directory? {
        val root = modelRoot()
        val record = installRecord(model) ?: return null
        if (!record.matches(model)) {
            verifiedInstallCache.remove(model.id)
            return null
        }
        val fingerprints = model.files.map { spec ->
            val file = File(root, spec.path)
            if (!file.isFile || file.length() != spec.bytes) return null
            FileFingerprint(spec.path, file.length(), file.lastModified())
        }
        val cached = verifiedInstallCache[model.id]
        if (cached != null && cached.version == model.version && cached.files == fingerprints) {
            return ModelSource.Directory(root.absolutePath)
        }
        if (model.files.any { spec ->
                sha256(File(root, spec.path)) != spec.sha256
            }) {
            verifiedInstallCache.remove(model.id)
            return null
        }
        verifiedInstallCache[model.id] = VerifiedInstall(model.version, fingerprints)
        return ModelSource.Directory(root.absolutePath)
    }

    private fun assetsComplete(model: ModelSpec): Boolean = model.files.all { file ->
        runCatching { context.assets.open(file.path).close() }.isSuccess
    }

    private fun modelRoot(): File = File(context.filesDir, "models")

    /** Resolve the selected source to the distribution channel base recorded
     * in the verified manifest.  This keeps any endpoint from changing the
     * model identity: every downloaded byte is still checked against the
     * embedded manifest. */
    private fun effectiveDownloadUrls(model: ModelSpec): List<String> {
        val config = modelDownloadSource()
        val base = when (config.source) {
            // customBase 留空时回退 dev-urls 注入的 LAN 前缀（dev-models.sh
            // -PfeelimeDevModels=true 工作流：选「自定义源」即可，无需手填）。
            ModelDownloadSource.CUSTOM ->
                config.customBase.ifBlank { model.urls.firstOrNull().orEmpty() }
            // 遗留 manifest 没有 sources 条目时（老开发清单）直接无源可下，
            // 报错引导换源，不做跨源回退（对齐 podic 的显式选择语义）。
            else -> model.sources[config.source.value]
        }
        if (base == null || !validSourceBase(base)) return emptyList()
        return listOf(base.trimEnd('/') + "/")
    }

    private fun validSourceBase(raw: String): Boolean = runCatching {
        val uri = URI(raw)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null &&
            (scheme == "https" || scheme == "http")
    }.getOrDefault(false)

    /** Live status for the settings UI. */
    fun state(model: ModelSpec): State {
        if (activeId == model.id) return activeOperation ?: State.DOWNLOADING
        val bundled = assetsComplete(model)
        if (backendForModel(bundled) == ModelBackend.AUTO && bundled) {
            return State.BUILT_IN
        }
        val record = installRecord(model) ?: return State.MISSING
        return if (installedSource(model) != null) State.INSTALLED else State.BROKEN
    }

    /** Non-null only when a downloaded copy exists (the 删除 button target). */
    fun downloadedRoot(model: ModelSpec): File? {
        val dir = File(modelRoot(), model.dir)
        return if (installRecord(model) != null) dir else null
    }

    @Synchronized
    fun download(
        model: ModelSpec,
        listener: Listener,
        transport: ModelConnectionFactory? = null,
        checkNetwork: () -> Unit = {},
    ): Boolean {
        if (closed || activeId != null) return false
        activeId = model.id
        activeOperation = State.DOWNLOADING
        cancelled.set(false)
        clearDownloadError(model.id)
        try {
            worker.execute {
                var state = State.INSTALLED
                var error: String? = null
                try {
                    downloadSync(model, listener, transport, checkNetwork)
                } catch (cancelledError: ModelDownloadCancelled) {
                    state = State.MISSING
                } catch (failure: Exception) {
                    state = State.MISSING
                    error = failure.message ?: failure.javaClass.simpleName
                    recordDownloadError(model.id, "MODEL_DOWNLOAD_FAILED", error!!)
                    Log.w(TAG, "model download failed: ${model.id}", failure)
                } finally {
                    activeId = null
                    activeOperation = null
                }
                runCatching { listener.onFinished(model.id, state, error) }
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            activeId = null
            cancelled.set(true)
            return false
        }
        return true
    }

    /** Import a verified upstream tar.bz2/zip selected through Android's
     * Storage Access Framework. The resolver supplies only the user-granted
     * URI stream; no shared-storage permission is needed. */
    @Synchronized
    fun importModel(
        model: ModelSpec,
        resolver: ContentResolver,
        uri: Uri,
        listener: Listener,
    ): Boolean {
        if (closed || activeId != null) return false
        activeId = model.id
        activeOperation = State.IMPORTING
        cancelled.set(false)
        clearDownloadError(model.id)
        try {
            worker.execute {
                var state = State.MISSING
                var error: String? = null
                val stage = File(modelRoot(), ".${model.dir}.import.part")
                try {
                    if (!model.verified) throw IOException("模型清单缺少 sha256 校验值，无法导入")
                    modelRoot().mkdirs()
                    listener.onStatus(model.id, "reading")
                    val input = resolver.openInputStream(uri)
                        ?: throw IOException("无法读取所选模型文件")
                    input.use { stream ->
                        ModelArchiveImporter(
                            isCancelled = { cancelled.get() },
                        ).importArchive(stream, model, stage) { status ->
                            listener.onStatus(model.id, status)
                        }
                    }
                    listener.onStatus(model.id, "installing")
                    // A cancellation can arrive after the last hash check.
                    // Keep the final check and swap under the same lock as
                    // delete(), so deletion cannot return before a late
                    // install has completed.
                    synchronized(installLock) {
                        if (cancelled.get()) throw ModelDownloadCancelled()
                        writeInstallRecord(model, stage)
                        if (cancelled.get()) throw ModelDownloadCancelled()
                        atomicallyInstall(model, stage)
                    }
                    verifiedInstallCache.remove(model.id)
                    state = State.INSTALLED
                } catch (cancelledError: ModelDownloadCancelled) {
                    state = if (installedSource(model) != null) State.INSTALLED else State.MISSING
                } catch (failure: Exception) {
                    state = if (installedSource(model) != null) State.INSTALLED else State.MISSING
                    error = failure.message ?: failure.javaClass.simpleName
                    recordDownloadError(model.id, "MODEL_IMPORT_FAILED", error!!)
                    Log.w(TAG, "model import failed: ${model.id}", failure)
                } finally {
                    if (stage.exists()) stage.deleteRecursively()
                    activeId = null
                    activeOperation = null
                }
                runCatching { listener.onFinished(model.id, state, error) }
            }
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            activeId = null
            activeOperation = null
            cancelled.set(true)
            return false
        }
        return true
    }

    /** Abort the running download; partial files stay for the next resume. */
    fun cancelDownload() {
        synchronized(installLock) {
            cancelled.set(true)
        }
    }

    /** 测速是否进行中（设置页防重入提示用）。 */
    fun speedTestInFlight(): Boolean = speedTestRunning.get()

    /** 并发探测所有下载源的延迟（毫秒；null = 不可用）。结果在回调里整批
     * 交付；重复触发返回 false（in-flight 防重入）。8s 超时由 transport
     * 的 connect/read 超时共同兜底。 */
    fun speedTestSources(
        transport: ModelConnectionFactory? = null,
        onResult: (Map<String, Long?>) -> Unit,
    ): Boolean {
        if (closed || !speedTestRunning.compareAndSet(false, true)) return false
        val config = modelDownloadSource()
        val tester = ModelSourceSpeedTester(
            connectionFactory = transport
                ?: HttpModelConnectionFactory(
                    connectTimeoutMs = SPEED_TEST_TIMEOUT_MS,
                    readTimeoutMs = SPEED_TEST_TIMEOUT_MS,
                    allowHttp = allowHttp,
                ),
            allowHttp = allowHttp,
        )
        val bases = mutableListOf<Pair<String, String>>()
        for ((source, root) in MODEL_DISTRIBUTION_ROOTS) bases.add(source to root)
        if (config.customBase.isNotBlank()) {
            bases.add(ModelDownloadSource.CUSTOM.value to config.customBase)
        }
        if (bases.isEmpty()) {
            speedTestRunning.set(false)
            return false
        }
        val results = java.util.concurrent.ConcurrentHashMap<String, Long?>()
        val latch = java.util.concurrent.CountDownLatch(bases.size)
        for ((source, base) in bases) {
            speedWorker.execute {
                results[source] = runCatching { tester.probeSource(base, source == ModelDownloadSource.CUSTOM.value) }
                    .getOrNull()
                latch.countDown()
            }
        }
        worker.execute {
            latch.await()
            speedTestRunning.set(false)
            runCatching { onResult(results.toMap()) }
        }
        return true
    }

    fun delete(model: ModelSpec) = synchronized(installLock) {
        if (activeId == model.id) cancelled.set(true)
        verifiedInstallCache.remove(model.id)
        clearDownloadError(model.id)
        File(modelRoot(), model.dir).deleteRecursively()
        File(modelRoot(), ".${model.dir}.import.part").deleteRecursively()
        File(modelRoot(), ".${model.dir}.previous").deleteRecursively()
    }

    @Synchronized
    fun release() {
        if (closed) return
        closed = true
        synchronized(installLock) {
            cancelled.set(true)
        }
        speedTestRunning.set(false)
        worker.shutdown()
        speedWorker.shutdown()
    }


    private fun downloadSync(
        model: ModelSpec,
        listener: Listener,
        transport: ModelConnectionFactory?,
        checkNetwork: () -> Unit,
    ) {
        val sourceUrls = effectiveDownloadUrls(model)
        val activeTransport = transport ?: connectionFactory
            ?: HttpModelConnectionFactory(allowHttp = allowHttp)
        val fetcher = ModelFileFetcher(
            connectionFactory = activeTransport,
            allowHttp = allowHttp,
            isCancelled = { cancelled.get() },
            checkNetwork = checkNetwork,
        )
        check(model.verified) { "模型清单缺少 sha256 校验值，无法安全下载" }
        check(sourceUrls.isNotEmpty()) { "模型清单没有可用的下载地址" }
        val networkModel = model.copy(urls = sourceUrls)
        verifiedInstallCache.remove(model.id)
        val root = File(modelRoot(), model.dir)
        root.mkdirs()
        var doneBytes = 0L
        for (fileSpec in model.files) {
            val dest = File(root, fileSpec.path.substringAfter('/'))
            if (dest.isFile && dest.length() == fileSpec.bytes && sha256(dest) == fileSpec.sha256) {
                doneBytes += fileSpec.downloadBytes
                listener.onProgress(model.id, doneBytes, model.totalDownloadBytes)
                continue
            }
            fetcher.fetch(networkModel, fileSpec, dest, listener, doneBytes)
            if (sha256(dest) != fileSpec.sha256) {
                dest.delete()
                throw IOException("下载内容校验失败：${fileSpec.path}")
            }
            doneBytes += fileSpec.downloadBytes
            listener.onProgress(model.id, doneBytes, model.totalDownloadBytes)
        }
        // Serialize the final seal with delete().  A cancellation that has
        // already acquired the lock must win before INSTALL.json is written;
        // otherwise delete() could return and a late seal would resurrect the
        // model as installed.
        synchronized(installLock) {
            if (cancelled.get()) throw ModelDownloadCancelled()
            writeInstallRecord(model, root)
        }
    }

    /** INSTALL.json seals a model: written last (tmp + rename) after every
     * file passed sha256; presence + byte sizes read as "installed". */
    private fun installRecord(model: ModelSpec): InstallRecord? {
        val file = File(File(modelRoot(), model.dir), INSTALL_RECORD)
        if (!file.isFile) return null
        return InstallRecord.parse(runCatching { file.readText() }.getOrDefault(""))
    }

    private fun writeInstallRecord(model: ModelSpec, root: File) {
        InstallRecord(
            id = model.id,
            version = model.version,
            files = model.files.associate {
                it.path.substringAfter('/') to InstallEntry(it.sha256, it.bytes)
            },
        ).let { record ->
            val tmp = File(root, "$INSTALL_RECORD.tmp")
            tmp.writeText(record.toJson())
            if (!tmp.renameTo(File(root, INSTALL_RECORD))) {
                tmp.delete()
                throw IOException("写入安装记录失败")
            }
        }
    }

    /** Swap a complete staged model directory into place. A previous valid
     * install is moved aside first and restored if the final rename fails. */
    private fun atomicallyInstall(model: ModelSpec, stage: File) {
        val root = File(modelRoot(), model.dir)
        val previous = File(modelRoot(), ".${model.dir}.previous")
        ModelInstallSwap.install(root, stage, previous)
    }

    // InstallRecord is public for the JVM unit suite (app/src/test).
    data class InstallEntry(val sha256: String, val bytes: Long)
    data class InstallRecord(val id: String, val version: String, val files: Map<String, InstallEntry>) {
        /** Model directories are shared across revisions. Require identity and
         * the complete file set before exposing a directory to sherpa; this
         * rejects the old OnlinePunctuation install that used the same
         * punctuation/model.int8.onnx path as the OfflinePunctuation model. */
        fun matches(model: ModelSpec): Boolean {
            val expected = model.files.associate {
                it.path.substringAfter('/') to InstallEntry(it.sha256, it.bytes)
            }
            return id == model.id && version == model.version && files == expected
        }

        fun toJson(): String = buildString {
            append("{\"id\":").append(quote(id))
            append(",\"version\":").append(quote(version))
            append(",\"files\":{")
            files.entries.forEachIndexed { index, (path, entry) ->
                if (index > 0) append(",")
                append(quote(path)).append(":{\"sha256\":").append(quote(entry.sha256))
                    .append(",\"bytes\":").append(entry.bytes).append("}")
            }
            append("}}")
        }

        private fun quote(raw: String): String = buildString {
            append('"')
            for (ch in raw) when (ch) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                else -> append(ch)
            }
            append('"')
        }

        companion object {
            fun parse(text: String): InstallRecord? {
                val root = runCatching { JsonParser(text).parseDocument() }
                    .getOrNull() as? Map<*, *> ?: return null
                val id = root["id"] as? String ?: return null
                val files = (root["files"] as? Map<*, *>)?.mapNotNull { (path, value) ->
                    val entry = value as? Map<*, *> ?: return@mapNotNull null
                    val name = path as? String ?: return@mapNotNull null
                    name to InstallEntry(
                        sha256 = entry["sha256"] as? String ?: "",
                        bytes = (entry["bytes"] as? Number)?.toLong() ?: 0L,
                    )
                }?.toMap().orEmpty()
                return InstallRecord(
                    id = id,
                    version = root["version"] as? String ?: "",
                    files = files,
                )
            }
        }
    }

    private data class FileFingerprint(val path: String, val bytes: Long, val modifiedAt: Long)
    private data class VerifiedInstall(val version: String, val files: List<FileFingerprint>)

    private companion object {
        const val TAG = "FeelimeModels"
        const val MANIFEST_ASSET = "models/manifest.json"
        const val INSTALL_RECORD = "INSTALL.json"
        const val MODEL_PREFS = "feelime_asr"
        const val KEY_MODEL_BACKEND = "model_backend"
        const val KEY_MODEL_DOWNLOAD_SOURCE = "model_download_source"
        const val KEY_MODEL_DOWNLOAD_CUSTOM = "model_download_custom"
        const val ERROR_PREFIX = "model_download_error."
        const val MAX_ERROR_DETAIL = 240
        /** podic speed_test 同款 8s 总超时（connect/read 双兜底）。 */
        const val SPEED_TEST_TIMEOUT_MS = 8_000

        fun errorKey(modelId: String): String = "$ERROR_PREFIX$modelId"

        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { stream ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}

/** Filesystem transaction used by ModelStore's local import path.  The move
 * callbacks are injectable so JVM tests can exercise the failure recovery
 * branch without an Android Context. */
internal object ModelInstallSwap {
    fun install(
        root: File,
        stage: File,
        previous: File,
        move: (File, File) -> Boolean = { from, to -> from.renameTo(to) },
        deleteRecursively: (File) -> Boolean = { it.deleteRecursively() },
    ) {
        // A backup may be the only recoverable copy after an interrupted
        // replacement.  Never remove it before a new swap has succeeded.
        val hadPrevious = previous.exists()
        if (hadPrevious && root.exists()) {
            throw IOException("模型存在未完成的旧备份：${previous.name}，请先删除模型后重试")
        }

        var movedPrevious = false
        if (root.exists()) {
            if (!move(root, previous)) throw IOException("无法暂存现有模型")
            movedPrevious = true
        }
        if (!move(stage, root)) {
            if (movedPrevious && !move(previous, root)) {
                // Keep previous in place.  The caller's cleanup removes only
                // the staging directory, so this copy remains recoverable.
                throw IOException("无法安装已验证模型；旧模型备份保留：${previous.name}")
            }
            throw IOException("无法安装已验证模型")
        }

        // Once the new root is in place, an old backup is no longer needed.
        // A cleanup failure is non-fatal, but the next install will preserve
        // and report the leftover backup instead of deleting it blindly.
        if ((movedPrevious || hadPrevious) && !deleteRecursively(previous)) {
            Log.w("FeelimeModels", "旧模型清理失败：${previous.name}")
        }
    }
}

/** Minimal recursive-descent reader for the manifest/record JSON subset
 * (objects, arrays, strings, integers, literals) - pure Kotlin so the JVM
 * unit suite runs without org.json (PanelCodec precedent). */
internal class JsonParser(private val text: String) {
    private var pos = 0

    fun parseDocument(): Any? {
        val value = parseValue()
        skipWhitespace()
        if (pos != text.length) throw IOException("trailing content at $pos")
        return value
    }

    private fun parseValue(): Any? {
        skipWhitespace()
        if (pos >= text.length) throw IOException("unexpected end")
        return when (val ch = text[pos]) {
            '{' -> parseObject()
            '[' -> parseArray()
            '"' -> parseString()
            't' -> literal("true", true)
            'f' -> literal("false", false)
            'n' -> literal("null", null)
            '-', in '0'..'9' -> parseNumber()
            else -> throw IOException("unexpected '$ch' at $pos")
        }
    }

    private fun parseObject(): Map<String, Any?> {
        val result = LinkedHashMap<String, Any?>()
        pos++ // {
        skipWhitespace()
        if (peek() == '}') { pos++; return result }
        while (true) {
            skipWhitespace()
            val key = parseString()
            skipWhitespace()
            if (peek() != ':') throw IOException("expected ':' at $pos")
            pos++
            result[key] = parseValue()
            skipWhitespace()
            when (peek()) {
                ',' -> pos++
                '}' -> { pos++; return result }
                else -> throw IOException("expected ',' or '}' at $pos")
            }
        }
    }

    private fun parseArray(): List<Any?> {
        val result = ArrayList<Any?>()
        pos++ // [
        skipWhitespace()
        if (peek() == ']') { pos++; return result }
        while (true) {
            result.add(parseValue())
            skipWhitespace()
            when (peek()) {
                ',' -> pos++
                ']' -> { pos++; return result }
                else -> throw IOException("expected ',' or ']' at $pos")
            }
        }
    }

    private fun parseString(): String {
        pos++ // opening quote
        val builder = StringBuilder()
        while (true) {
            when (val ch = text[pos]) {
                '"' -> { pos++; return builder.toString() }
                '\\' -> {
                    pos++
                    when (val escaped = text[pos]) {
                        '"' -> builder.append('"')
                        '\\' -> builder.append('\\')
                        '/' -> builder.append('/')
                        'b' -> builder.append('\b')
                        'f' -> builder.append('\u000C')
                        'n' -> builder.append('\n')
                        'r' -> builder.append('\r')
                        't' -> builder.append('\t')
                        'u' -> {
                            val hex = text.substring(pos + 1, pos + 5)
                            builder.append(hex.toInt(16).toChar())
                            pos += 4
                        }
                        else -> throw IOException("bad escape '$escaped' at $pos")
                    }
                    pos++
                }
                else -> { builder.append(ch); pos++ }
            }
        }
    }

    private fun parseNumber(): Long {
        val start = pos
        if (text[pos] == '-') pos++
        while (pos < text.length && text[pos] in '0'..'9') pos++
        val raw = text.substring(start, pos)
        if (raw.isEmpty() || raw == "-") throw IOException("bad number at $start")
        return raw.toLong()
    }

    private fun literal(word: String, value: Any?): Any? {
        if (!text.startsWith(word, pos)) throw IOException("bad literal at $pos")
        pos += word.length
        return value
    }

    private fun peek(): Char {
        if (pos >= text.length) throw IOException("unexpected end")
        return text[pos]
    }

    private fun skipWhitespace() {
        while (pos < text.length && text[pos] in " \t\r\n") pos++
    }
}

/** Thrown on user cancel; the fetcher must let it through mirror failover. */
internal class ModelDownloadCancelled : IOException("cancelled")
internal class ModelDownloadNetworkChanged : IOException("MODEL_NETWORK_CHANGED")

/** The mirror loop as its own seam so the JVM suite can prove
 * failover. Every mirror failure (connect/timeout/HTTP error/mid-stream IO/
 * short read) records the error and moves to the next URL; only cancel
 * aborts, and the last error is rethrown after the list is exhausted. */
internal class ModelFileFetcher(
    private val connectionFactory: ModelConnectionFactory,
    private val allowHttp: Boolean,
    private val isCancelled: () -> Boolean,
    private val checkNetwork: () -> Unit = {},
) {
    /** Resumable single-file fetch: append to <dest>.part via Range, verify
     * against the wire digest, then rename - or gunzip first when the file
     * is gzip-backed (distribution 单附件上限压缩存放）。 Mirrors fall through
     * on 4xx/5xx/IO. */
    fun fetch(
        model: ModelSpec,
        fileSpec: ModelFileSpec,
        dest: File,
        listener: ModelStore.Listener,
        doneBytesBefore: Long,
    ) {
        val part = File(dest.parentFile, "${dest.name}.part")
        val wireBytes = fileSpec.downloadBytes
        var offset = if (part.isFile) part.length() else 0L
        if (wireBytes > 0 && offset > wireBytes) {
            part.delete()
            offset = 0
        }
        var lastError: IOException? = null
        for (base in model.urls) {
            if (!allowHttp && base.substringBefore(':').equals("http", ignoreCase = true)) continue
            if (isCancelled()) throw ModelDownloadCancelled()
            checkNetwork()
            try {
                val connection = connectionFactory.open(URI.create(base + fileSpec.downloadPath), offset)
                try {
                    when (connection.responseCode) {
                        HTTP_PARTIAL -> writeStream(connection.body(), part, append = true, resumeOffset = offset, model = model, fileSpec = fileSpec, listener = listener, doneBytesBefore = doneBytesBefore)
                        // A server that ignores Range answers 200 with the full
                        // body (gitee 附件端点实测如此）：从 0 覆盖写，不报错。
                        HTTP_OK -> writeStream(connection.body(), part, append = false, resumeOffset = 0, model = model, fileSpec = fileSpec, listener = listener, doneBytesBefore = doneBytesBefore)
                        // Server lost the part (or never had it): restart clean on
                        // the next mirror with an empty part.
                        HTTP_RANGE_NOT_SATISFIABLE -> {
                            part.delete()
                            offset = 0
                            throw IOException("range not satisfiable: ${fileSpec.path}")
                        }
                        else -> throw IOException("HTTP ${connection.responseCode} for ${fileSpec.path}")
                    }
                } finally {
                    runCatching { connection.disconnect() }
                }
                if (wireBytes > 0 && part.length() != wireBytes) {
                    lastError = IOException("下载不完整：${fileSpec.path} (${part.length()}/${wireBytes})")
                } else if (sha256(part) != fileSpec.wireSha256) {
                    // A mirror can return a complete but corrupted object.
                    // Do not seal it or resume from its full length on the
                    // next mirror; restart that file from byte zero.
                    part.delete()
                    offset = 0
                    lastError = IOException("下载内容校验失败：${fileSpec.path}")
                } else {
                    if (installVerifiedPart(fileSpec, part, dest, model, listener, doneBytesBefore)) return
                    lastError = IOException("重命名失败：${fileSpec.path}")
                }
            } catch (e: ModelDownloadCancelled) {
                throw e
            } catch (e: ModelDownloadNetworkChanged) {
                throw e
            } catch (e: IOException) {
                // design §12.3「urls 多镜像依次尝试」：连接失败/超时/4xx/5xx/中途
                // 断流都记录后换下一镜像，只回传最后一个错误。
                lastError = e
            }
            // A short read (or a failed mirror) leaves the part at whatever
            // length survived - the next mirror attempt must resume from the
            // part's true length.
            offset = if (part.isFile) part.length() else 0L
        }
        throw lastError ?: IOException("没有可用的下载地址：${fileSpec.path}")
    }

    /** A wire-verified part is installed: plain files rename into place,
     * gzip-backed files stream through GZIPInputStream into the destination
     * (the caller re-checks the raw digest afterwards).  Returns false only
     * when the rename itself failed. */
    private fun installVerifiedPart(
        fileSpec: ModelFileSpec,
        part: File,
        dest: File,
        model: ModelSpec,
        listener: ModelStore.Listener,
        doneBytesBefore: Long,
    ): Boolean {
        if (dest.exists()) dest.delete()
        if (!fileSpec.gunzip) return part.renameTo(dest)
        java.util.zip.GZIPInputStream(part.inputStream().buffered()).use { gunzip ->
            java.io.FileOutputStream(dest).use { output ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    if (isCancelled()) {
                        dest.delete()
                        throw ModelDownloadCancelled()
                    }
                    val count = gunzip.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    // Uncompressed bytes are not network progress; keep the
                    // bar pinned at the file's wire total while inflating.
                    listener.onProgress(model.id, doneBytesBefore + fileSpec.downloadBytes, model.totalDownloadBytes)
                }
            }
        }
        part.delete()
        return true
    }

    private fun writeStream(
        input: InputStream,
        part: File,
        append: Boolean,
        resumeOffset: Long,
        model: ModelSpec,
        fileSpec: ModelFileSpec,
        listener: ModelStore.Listener,
        doneBytesBefore: Long,
    ) {
        java.io.FileOutputStream(part, append).use { output ->
            input.use { stream ->
                val buffer = ByteArray(64 * 1024)
                var written = resumeOffset
                while (true) {
                    if (isCancelled()) throw ModelDownloadCancelled()
                    checkNetwork()
                    val count = stream.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    written += count
                    listener.onProgress(model.id, doneBytesBefore + written, model.totalDownloadBytes)
                }
            }
        }
    }

    private companion object {
        const val HTTP_OK = 200
        const val HTTP_PARTIAL = 206
        const val HTTP_RANGE_NOT_SATISFIABLE = 416

        fun sha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    digest.update(buffer, 0, read)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}
