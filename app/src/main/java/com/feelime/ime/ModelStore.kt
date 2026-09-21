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
data class ModelArchiveSpec(
    /** Official archive URL. Source-specific URLs must carry the same archive
     * and are still verified against both archive and entry hashes. */
    val url: String,
    val bytes: Long,
    val sha256: String,
    /** Exact POSIX path inside the tar stream, including its model directory. */
    val entry: String,
    val entryBytes: Long,
    val entrySha256: String,
    /** Optional source-specific URLs.  HF repositories do not contain the
     * mobile archive, so the default manifest may point its HF choice at a
     * verified GitHub proxy while retaining [url] for the official source. */
    val sourceUrls: Map<String, String> = emptyMap(),
) {
    val verified: Boolean
        get() = url.isNotBlank() &&
            bytes > 0 &&
            sha256.length == 64 &&
            entry.isNotBlank() &&
            entryBytes > 0 &&
            entrySha256.length == 64
}

data class ModelFileSpec(
    /** Path used by the engine and by the local full asset tree. */
    val path: String,
    val sha256: String,
    val bytes: Long,
    /** Upstream repository path. Model assets use stable local names while
     * sherpa's public repositories include epoch/averaging suffixes. */
    val downloadPath: String = path,
    /** Optional archive source. When present, this file is extracted from the
     * verified archive and its ordinary URL is never attempted. */
    val archive: ModelArchiveSpec? = null,
) {
    val downloadBytes: Long get() = archive?.bytes ?: bytes
}

data class ModelSpec(
    val id: String,
    val title: String,
    val role: String,
    val version: String,
    val files: List<ModelFileSpec>,
    /** Manifest URL prefixes; ModelStore resolves these to the persisted
     * source choice before starting a download. */
    val urls: List<String>,
) {
    val dir: String get() = files.first().path.substringBefore('/')
    val totalBytes: Long get() = files.sumOf { it.bytes }
    /** Bytes transferred from the network. Archive-backed files count the
     * compressed archive size so the UI does not promise 105 MB while it
     * actually downloads 347 MB. */
    val totalDownloadBytes: Long get() = files.sumOf { it.downloadBytes }
    /** The repo manifest ships placeholder digests until dev-models.sh /
     * generateModelManifest fill them from a local verified copy. */
    val verified: Boolean get() = files.all {
        it.sha256.length == 64 && it.bytes > 0 && (it.archive?.verified ?: true)
    }
}

/** Where verified model files are fetched from.  The source is deliberately
 * separate from the model backend: the latter chooses APK assets versus a
 * downloaded copy, while this choice only controls the network endpoint. */
enum class ModelDownloadSource(val value: String) {
    HF_MIRROR("hf_mirror"),
    OFFICIAL("official"),
    CUSTOM("custom"),
    // gitee release 资产直链（design/handwriting.md §5.3）：国内直连，
    // 作为手写模型等新条目的默认第一源。
    GITEE("gitee");

    companion object {
        fun fromValue(value: String?): ModelDownloadSource = when (
            value?.lowercase(Locale.ROOT)
        ) {
            OFFICIAL.value -> OFFICIAL
            CUSTOM.value -> CUSTOM
            GITEE.value -> GITEE
            else -> HF_MIRROR
        }
    }
}

data class ModelDownloadSourceConfig(
    val source: ModelDownloadSource,
    val customBase: String = "",
    /** Complete URL for the verified mobile tar.bz2.  It is separate from
     * the repository base because HF does not host that archive. */
    val customArchiveUrl: String = "",
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
                    val archive = when (val rawArchive = fileMap["archive"]) {
                        null -> null
                        is Map<*, *> -> ModelArchiveSpec(
                            url = rawArchive["url"] as? String ?: return@mapNotNull null,
                            bytes = (rawArchive["bytes"] as? Number)?.toLong() ?: return@mapNotNull null,
                            sha256 = rawArchive["sha256"] as? String ?: return@mapNotNull null,
                            entry = rawArchive["entry"] as? String ?: return@mapNotNull null,
                            entryBytes = (rawArchive["entryBytes"] as? Number)?.toLong()
                                ?: return@mapNotNull null,
                            entrySha256 = rawArchive["entrySha256"] as? String
                                ?: return@mapNotNull null,
                            sourceUrls = (rawArchive["sourceUrls"] as? Map<*, *>)
                                ?.mapNotNull { (key, value) ->
                                    val source = key as? String
                                    val url = value as? String
                                    if (source.isNullOrBlank() || url.isNullOrBlank()) null
                                    else source to url
                                }
                                ?.toMap()
                                .orEmpty(),
                        )
                        else -> return@mapNotNull null
                    }
                    ModelFileSpec(
                        path = path,
                        sha256 = sha256,
                        bytes = (fileMap["bytes"] as? Number)?.toLong() ?: 0L,
                        downloadPath = (fileMap["downloadPath"] as? String)
                            ?.trim()
                            ?.takeIf { it.isNotEmpty() }
                            ?: path,
                        archive = archive,
                    )
                }
                if (files.size != rawFiles.size || files.isEmpty()) return@mapNotNull null
                ModelSpec(
                    id = id,
                    title = map["title"] as? String ?: id,
                    role = map["role"] as? String ?: "",
                    version = map["version"] as? String ?: "",
                    files = files,
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
        backendPreferences.edit().putString(KEY_MODEL_BACKEND, backend.value).apply()
    }

    fun modelDownloadSource(): ModelDownloadSourceConfig {
        val source = ModelDownloadSource.fromValue(
            backendPreferences.getString(KEY_MODEL_DOWNLOAD_SOURCE, null),
        )
        val customBase = backendPreferences.getString(KEY_MODEL_DOWNLOAD_CUSTOM, "") ?: ""
        val customArchiveUrl = backendPreferences
            .getString(KEY_MODEL_DOWNLOAD_ARCHIVE, "") ?: ""
        return if (source == ModelDownloadSource.CUSTOM &&
            (!validSourceBase(customBase) || !validArchiveUrl(customArchiveUrl))
        ) {
            ModelDownloadSourceConfig(ModelDownloadSource.HF_MIRROR)
        } else {
            ModelDownloadSourceConfig(source, customBase, customArchiveUrl)
        }
    }

    /** Persist only syntactically valid http(s) endpoints.  Plain http is
     * allowed because integrity rests on the manifest SHA-256 checks, not
     * on transport.  A custom source includes both the ordinary repository
     * base and the fixed mobile tar.bz2 mirror because that archive is not
     * present in HF repositories. */
    fun setModelDownloadSource(
        source: ModelDownloadSource,
        customBase: String,
        customArchiveUrl: String,
    ): Boolean {
        val normalized = customBase.trim().trimEnd('/')
        val normalizedArchive = customArchiveUrl.trim()
        if (source == ModelDownloadSource.CUSTOM &&
            (!validSourceBase(normalized) || !validArchiveUrl(normalizedArchive))
        ) return false
        backendPreferences.edit()
            .putString(KEY_MODEL_DOWNLOAD_SOURCE, source.value)
            .putString(KEY_MODEL_DOWNLOAD_CUSTOM, normalized)
            .putString(KEY_MODEL_DOWNLOAD_ARCHIVE, normalizedArchive)
            .apply()
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
        if (modelBackend() == ModelBackend.AUTO && assetsComplete(model)) {
            return ModelSource.Assets
        }
        return installedSource(model)
    }

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

    /** Resolve the selected source to the repository path recorded in the
     * verified manifest.  This keeps a custom endpoint from changing the
     * model identity: every downloaded byte is still checked against the
     * embedded manifest. */
    private fun effectiveDownloadUrls(model: ModelSpec): List<String> {
        val config = modelDownloadSource()
        // 用户没选过源：按 manifest urls 顺序直用（手写条目的第一位是
        // gitee 镜像，国内直连，design/handwriting.md §5.3）。
        if (!sourceChoiceStored()) return model.urls
        // gitee 是 release 资产直链，没有 /resolve/ 仓库语义，按 host 取用。
        if (config.source == ModelDownloadSource.GITEE) {
            return model.urls.filter { isHost(it, "gitee.com") }
        }
        val repository = model.urls.asSequence()
            .mapNotNull(::repositoryPath)
            .firstOrNull()
        val base = when (config.source) {
            ModelDownloadSource.HF_MIRROR -> HF_MIRROR_BASE
            ModelDownloadSource.OFFICIAL -> OFFICIAL_HF_BASE
            ModelDownloadSource.CUSTOM -> config.customBase
            ModelDownloadSource.GITEE -> ""
        }
        if (repository != null && validSourceBase(base)) {
            return listOf(sourceEndpoint(base, repository))
        }
        // Keep a developer manifest with a non-HuggingFace LAN prefix usable
        // when its source has not been overridden yet.  Release manifests use
        // the repository path branch above.
        return when (config.source) {
            ModelDownloadSource.HF_MIRROR -> model.urls.filter { isHost(it, "hf-mirror.com") }
            ModelDownloadSource.OFFICIAL -> model.urls.filter { isHost(it, "huggingface.co") }
            ModelDownloadSource.CUSTOM -> emptyList()
            ModelDownloadSource.GITEE -> emptyList()
        }
    }

    /** 源选择是否落过盘：区分「默认」与「明确选了 hf_mirror」。 */
    private fun sourceChoiceStored(): Boolean =
        backendPreferences.contains(KEY_MODEL_DOWNLOAD_SOURCE)

    private fun repositoryPath(raw: String): String? = runCatching {
        val path = URI.create(raw).path.trim('/')
        val marker = "/resolve/"
        val index = path.indexOf(marker)
        path.takeIf { index > 0 }?.substring(0, index)
            ?.takeIf { it.count { ch -> ch == '/' } >= 1 }
    }.getOrNull()

    private fun sourceEndpoint(base: String, repository: String): String {
        val clean = base.trimEnd('/')
        return if (clean.contains("/resolve/")) "$clean/" else "$clean/$repository/resolve/main/"
    }

    private fun validSourceBase(raw: String): Boolean = runCatching {
        val uri = URI(raw)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        uri.host != null && uri.userInfo == null && uri.query == null && uri.fragment == null &&
            (scheme == "https" || scheme == "http")
    }.getOrDefault(false)

    private fun isHost(raw: String, host: String): Boolean = runCatching {
        URI.create(raw).host.equals(host, ignoreCase = true)
    }.getOrDefault(false)

    /** Live status for the settings UI. */
    fun state(model: ModelSpec): State {
        if (activeId == model.id) return activeOperation ?: State.DOWNLOADING
        if (modelBackend() == ModelBackend.AUTO && assetsComplete(model)) {
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
        worker.shutdown()
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
        val archiveFetcher = ModelArchiveFetcher(
            connectionFactory = activeTransport,
            allowHttp = allowHttp,
            isCancelled = { cancelled.get() },
            checkNetwork = checkNetwork,
        )
        check(model.verified) { "模型清单缺少 sha256 校验值，无法安全下载" }
        check(model.files.all { it.archive != null } || sourceUrls.isNotEmpty()) {
            "模型清单没有可用的下载地址"
        }
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
            if (fileSpec.archive != null) {
                val selectedArchive = fileSpec.archive.copy(
                    url = effectiveArchiveUrl(fileSpec.archive),
                )
                archiveFetcher.fetch(
                    archive = selectedArchive,
                    destination = dest,
                    onProgress = { downloaded ->
                        listener.onProgress(
                            model.id,
                            doneBytes + downloaded,
                            model.totalDownloadBytes,
                        )
                    },
                )
            } else {
                fetcher.fetch(networkModel, fileSpec, dest, listener, doneBytes)
            }
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

    private fun effectiveArchiveUrl(archive: ModelArchiveSpec): String {
        val config = modelDownloadSource()
        return when (config.source) {
            ModelDownloadSource.HF_MIRROR, ModelDownloadSource.OFFICIAL ->
                archive.sourceUrls[config.source.value]?.takeIf { it.isNotBlank() } ?: archive.url
            ModelDownloadSource.CUSTOM -> config.customArchiveUrl
            // gitee 只镜像散文件，大归档仍走官方地址。
            ModelDownloadSource.GITEE -> archive.url
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
        const val KEY_MODEL_DOWNLOAD_ARCHIVE = "model_download_archive"
        const val ERROR_PREFIX = "model_download_error."
        const val MAX_ERROR_DETAIL = 240
        const val HF_MIRROR_BASE = "https://hf-mirror.com"
        const val OFFICIAL_HF_BASE = "https://huggingface.co"

        fun errorKey(modelId: String): String = "$ERROR_PREFIX$modelId"

        fun validArchiveUrl(raw: String): Boolean = runCatching {
            val uri = URI(raw)
            val scheme = uri.scheme?.lowercase(Locale.ROOT)
            val path = uri.path?.lowercase(Locale.ROOT).orEmpty()
            uri.host != null && uri.userInfo == null && uri.fragment == null &&
                (scheme == "https" || scheme == "http") && path.endsWith(".tar.bz2")
        }.getOrDefault(false)

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
    /** Resumable single-file fetch: append to <dest>.part via Range, rename
     * once the byte count matches. Mirrors fall through on 4xx/5xx/IO. */
    fun fetch(
        model: ModelSpec,
        fileSpec: ModelFileSpec,
        dest: File,
        listener: ModelStore.Listener,
        doneBytesBefore: Long,
    ) {
        val part = File(dest.parentFile, "${dest.name}.part")
        var offset = if (part.isFile) part.length() else 0L
        if (fileSpec.bytes > 0 && offset > fileSpec.bytes) {
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
                if (fileSpec.bytes > 0 && part.length() != fileSpec.bytes) {
                    lastError = IOException("下载不完整：${fileSpec.path} (${part.length()}/${fileSpec.bytes})")
                } else if (sha256(part) != fileSpec.sha256) {
                    // A mirror can return a complete but corrupted object.
                    // Do not seal it or resume from its full length on the
                    // next mirror; restart that file from byte zero.
                    part.delete()
                    offset = 0
                    lastError = IOException("下载内容校验失败：${fileSpec.path}")
                } else {
                    if (dest.exists()) dest.delete()
                    if (part.renameTo(dest)) return
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
