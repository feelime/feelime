package com.feelime.ime

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.k2fsa.sherpa.onnx.EndpointConfig
import com.k2fsa.sherpa.onnx.EndpointRule
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineRecognizer
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

/** The AssetManager for asset-mode sources; null switches sherpa to its
 * file-path constructor (newFromFile JNI branch, design §12.3 thin builds). */
internal fun modelAssetManager(context: Context, source: ModelSource) =
    if (source is ModelSource.Assets) context.assets else null

/** Streaming recognizer config shared by AsrEngine and the debug model
 * smoke test (paths resolve per ModelSource). */
internal fun streamingRecognizerConfig(source: ModelSource, hotwordVocab: String): OnlineRecognizerConfig {
    fun path(file: String) = source.pathFor("asr-model/$file")
    return OnlineRecognizerConfig(
        featConfig = FeatureConfig(sampleRate = SAMPLE_RATE_ASR, featureDim = 80),
        modelConfig = OnlineModelConfig(
            transducer = OnlineTransducerModelConfig(
                encoder = path("encoder.int8.onnx"),
                decoder = path("decoder.onnx"),
                joiner = path("joiner.int8.onnx"),
            ),
            tokens = path("tokens.txt"),
            numThreads = 1,
            provider = "cpu",
            modelType = "zipformer",
            modelingUnit = "cjkchar+bpe",
            bpeVocab = hotwordVocab,
        ),
        endpointConfig = EndpointConfig(
            rule1 = EndpointRule(false, 2.4f, 0f),
            rule2 = EndpointRule(true, 1.2f, 0f),
            rule3 = EndpointRule(false, 0f, 20f),
        ),
        enableEndpoint = true,
        decodingMethod = "modified_beam_search",
        // decoder 先选 top-k，再加入本次热词分，窄 beam 可能提前淘汰目标路径。
        // #79 姚程样本：TTS 音频 beam=8 即临界（2/8~4/8），12 才 8/8；
        // 用户真声（「程」发音近 chén，声学差距更大）12/score5 仍 6/8~7/8，
        // 16/score5 达 8/8 且扰动矩阵稳定，误插入/回归面全绿，故采用。
        maxActivePaths = 16,
        hotwordsScore = 5.0f,
    )
}

internal const val SAMPLE_RATE_ASR = 16_000

/** Offline streaming recognizer using the bilingual zh/en Zipformer model. */
class AsrEngine(
    private val context: Context,
    private val listener: Listener,
) {
    interface Listener {
        fun onLoading()
        fun onListening()
        fun onPartial(text: String)
        fun onFinal(text: String)
        fun onLevel(level: Float)
        fun onStopped()
        fun onError(message: String)
    }

    private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "feelime-asr") }
    private val modelStore = ModelStore(context)

    /** transcripts never reach release logs; only lengths are recorded. */
    private inline fun transcriptLog(len: Int, debugLine: () -> String) {
        if (BuildConfig.DEBUG) {
            Log.i(TAG, debugLine())
        } else {
            Log.i(TAG, "transcript len=$len")
        }
    }
    private val running = AtomicBoolean(false)
    private val starting = AtomicBoolean(false)
    /** A normal stop drains captured audio; cancellation drops it. */
    private val stopRequested = AtomicBoolean(false)
    private val cancelRequested = AtomicBoolean(false)
    private val released = AtomicBoolean(false)
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var audioQueue: AsrAudioQueue? = null
    private var recognizer: OnlineRecognizer? = null
    private var finalPassRecognizer: FinalPassRecognizer? = null
    private var postProcessor: TranscriptPostProcessor? = null
    private var loadedModels: AsrModelSnapshot? = null

    fun start() {
        if (released.get()) return
        if (running.get() || !starting.compareAndSet(false, true)) return
        stopRequested.set(false)
        cancelRequested.set(false)
        worker.execute {
            val failure = try {
                if (ensureRecognizer() && !stopRequested.get() && !cancelRequested.get()) {
                    recordLoop()
                }
                null
            } catch (error: Throwable) {
                error
            }
            // Capture this recording's result before reopening the start
            // gate. A new start may reset the flags as soon as it is open.
            // Do not clear the gate again after notifying the listener: that
            // would clear the next recording's ownership on a quick restart.
            val cancelled = cancelRequested.get() || released.get()
            starting.set(false)
            if (failure != null && !cancelled) {
                listener.onError(failure.message ?: failure.javaClass.simpleName)
            } else {
                listener.onStopped()
            }
        }
    }

    fun stop() {
        stopRequested.set(true)
        running.set(false)
    }

    /** Stop immediately without decoding or emitting the captured tail. */
    fun cancel() {
        stopRequested.set(true)
        cancelRequested.set(true)
        running.set(false)
        audioQueue?.cancel()
        runCatching { recorder?.stop() }
    }

    fun release() {
        released.set(true)
        stopRequested.set(true)
        cancelRequested.set(true)
        running.set(false)
        audioQueue?.cancel()
        runCatching { recorder?.stop() }
        worker.execute {
            releaseRecorder()
            releaseRecognizerChain()
        }
        worker.shutdown()
    }

    /** Called only on the ASR worker, after the previous recording has
     * released its recorder/stream. Never replace native handles mid-decode. */
    private fun releaseRecognizerChain() {
        runCatching { postProcessor?.release() }.onFailure { Log.w(TAG, "Punctuation release failed", it) }
        postProcessor = null
        runCatching { finalPassRecognizer?.release() }.onFailure { Log.w(TAG, "Final-pass release failed", it) }
        finalPassRecognizer = null
        runCatching { recognizer?.release() }.onFailure { Log.w(TAG, "Streaming release failed", it) }
        recognizer = null
        loadedModels = null
    }

    private fun selectedModels(): AsrModelSnapshot {
        // Settings can change while a large downloaded file is verified.
        // Retry a changed backend instead of constructing a mixed chain.
        repeat(3) {
            val backend = modelStore.modelBackend()
            val snapshot = AsrModelSnapshot.capture(backend, modelStore.manifest(), modelStore::sourceFor)
            if (backend == modelStore.modelBackend()) return snapshot
        }
        error(t(context, "模型来源正在切换，请稍后再试", "The model source is changing. Try again shortly."))
    }

    /** Resolve all roles at each start: optional downloads and backend
     * changes must take effect without restarting the IME service. */
    private fun ensureRecognizer(): Boolean {
        listener.onLoading()
        val selected = selectedModels()
        if (recognizer != null && loadedModels == selected) return true
        releaseRecognizerChain()
        val started = SystemClock.elapsedRealtime()
        val source = selected.sourceFor("asr-streaming")
        if (source == null) {
            error(t(context,
                "语音模型未安装：请在 设置 → 语音识别 中下载或切换模型来源",
                "Speech model is not installed. Download it or change its source in Settings → Speech recognition.",
            ))
        }
        try {
            recognizer = OnlineRecognizer(
                modelAssetManager(context, source),
                streamingRecognizerConfig(source, AsrHotwords.vocabPath(context, source)),
            )
            finalPassRecognizer = runCatching {
                FinalPassRecognizer(context, modelStore, selected.sourceFor("asr-final"))
            }.onFailure { Log.w(TAG, "Final-pass Paraformer unavailable; using streaming result", it) }
                .getOrNull()
            postProcessor = TranscriptPostProcessor(context, modelStore, selected.sourceFor("punctuation"))
            loadedModels = selected
        } catch (failure: Throwable) {
            releaseRecognizerChain()
            throw failure
        }
        Log.i(TAG, "Streaming and final-pass models ready in ${SystemClock.elapsedRealtime() - started} ms")
        return true
    }

    private fun recordLoop() {
        check(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED,
        ) { "请先在 Feelime 设置页授予麦克风权限" }

        // Hotword tokens must come from the same source as the loaded
        // recognizer, even if the settings page changes during this recording.
        val source = checkNotNull(loadedModels?.sourceFor("asr-streaming")) { "语音模型未安装" }
        val hotwords = AsrHotwords.encode(context, source)

        val minBytes = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        check(minBytes > 0) { "设备不支持 16 kHz 单声道录音" }
        val activeRecorder = AudioRecord.Builder()
            // ColorOS applies a privacy/voice-processing path to
            // VOICE_RECOGNITION when the recorder belongs to an IME. The
            // level still moves, but the recognizer receives unusable PCM.
            // MIC gives us the same raw 16 kHz samples as the working model
            // self-test and standalone benchmark.
            .setAudioSource(MediaRecorder.AudioSource.MIC)
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(maxOf(minBytes * 2, CHUNK_SAMPLES * 4))
            .build()
        check(activeRecorder.state == AudioRecord.STATE_INITIALIZED) { "录音初始化失败" }

        recorder = activeRecorder
        // Raw phrases are encoded once by the configured native tokenizer.
        val stream = checkNotNull(recognizer).createStream(hotwords)
        val queue = AsrAudioQueue(MAX_PENDING_CHUNKS)
        audioQueue = queue
        var captureThread: Thread? = null
        var rawPartial = ""
        var currentPartial = ""
        var previousLoggedPartial = ""
        var previousFinal = ""
        var chunks = 0
        var lastAudioLogMs = 0L
        val utterance = FloatSampleBuffer(MAX_UTTERANCE_SAMPLES)
        fun emitFinal(text: String) {
            if (text.isBlank()) return
            // Keep the stored segment unprefixed: each partial/final callback
            // is derived from the recognizer's current raw segment, so a
            // correction cannot accumulate another separator.
            listener.onFinal(AsrSegmentSpacing.forNext(previousFinal, text))
            previousFinal = text
        }
        try {
            activeRecorder.startRecording()
            check(activeRecorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "麦克风启动失败" }
            running.set(true)
            if (stopRequested.get() || cancelRequested.get()) {
                running.set(false)
                return
            }
            // Decode and final-pass work can exceed the recorder's small
            // hardware buffer. Keep reading independently, then drain every
            // captured block on Stop before producing the final transcript.
            captureThread = Thread({
                var failure: Throwable? = null
                try {
                    val buffer = ShortArray(CHUNK_SAMPLES)
                    while (running.get()) {
                        val count = activeRecorder.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                        if (count <= 0) {
                            if (!running.get()) break
                            error(t(context, "麦克风读取失败，请重试", "Microphone read failed. Try again."))
                        }
                        val pcm = buffer.copyOf(count)
                        var sumSquares = 0.0
                        for (sample in pcm) {
                            val value = sample / 32768.0
                            sumSquares += value * value
                        }
                        listener.onLevel((sqrt(sumSquares / count).toFloat() * 7.5f).coerceIn(0f, 1f))
                        if (!queue.offer(pcm)) {
                            if (released.get()) break
                            error(t(context,
                                "设备识别速度不足，录音已停止，请分段重试",
                                "Recognition cannot keep up. Recording stopped; try shorter segments.",
                            ))
                        }
                    }
                } catch (error: Throwable) {
                    if (!released.get()) failure = error
                } finally {
                    running.set(false)
                    runCatching { activeRecorder.stop() }
                    queue.finish(failure)
                }
            }, "feelime-audio").also { it.start() }
            listener.onListening()

            while (!released.get() && !cancelRequested.get()) {
                val pcm = queue.take() ?: break
                val count = pcm.size
                val samples = FloatArray(count)
                var sumSquares = 0.0
                for (index in 0 until count) {
                    val sample = pcm[index] / 32768.0f
                    samples[index] = sample
                    sumSquares += sample * sample
                }
                val rms = sqrt(sumSquares / count).toFloat()
                utterance.append(samples)
                stream.acceptWaveform(samples, SAMPLE_RATE)
                decodeReady(stream)
                chunks += 1
                rawPartial = checkNotNull(recognizer).getResult(stream).text.trim()
                currentPartial = checkNotNull(postProcessor).partial(rawPartial)
                if (currentPartial != previousLoggedPartial) {
                    transcriptLog(currentPartial.length) { "partial=[$currentPartial]" }
                    previousLoggedPartial = currentPartial
                }
                val now = SystemClock.elapsedRealtime()
                if (now - lastAudioLogMs >= 1_000L) {
                    Log.d(TAG, "audio chunks=$chunks rms=$rms resultLength=${currentPartial.length}")
                    lastAudioLogMs = now
                }
                listener.onPartial(AsrSegmentSpacing.forNext(previousFinal, currentPartial))

                if (checkNotNull(recognizer).isEndpoint(stream)) {
                    if (cancelRequested.get()) return
                    val endpointSamples = utterance.takeAndClear()
                    checkNotNull(recognizer).reset(stream)
                    val refinedRaw = refine(endpointSamples, rawPartial, hotwords)
                    val finalText = checkNotNull(postProcessor).final(refinedRaw)
                    Log.i(TAG, "endpoint")
                    transcriptLog(finalText.length) { "endpoint stream=[$rawPartial] refined=[$refinedRaw] final=[$finalText]" }
                    emitFinal(finalText)
                    rawPartial = ""
                    currentPartial = ""
                    listener.onPartial("")
                }
            }

            if (released.get() || cancelRequested.get()) return
            stream.inputFinished()
            decodeReady(stream)
            val tail = checkNotNull(recognizer).getResult(stream).text.trim()
            val streamTail = tail.ifBlank { rawPartial }
            val refinedRaw = refine(utterance.takeAndClear(), streamTail, hotwords)
            val finalText = checkNotNull(postProcessor).final(refinedRaw)
            Log.i(TAG, "stopped")
            transcriptLog(finalText.length) { "stopped stream=[$streamTail] refined=[$refinedRaw] final=[$finalText]" }
            emitFinal(finalText)
            listener.onPartial("")
        } finally {
            running.set(false)
            queue.cancel()
            runCatching { activeRecorder.stop() }
            captureThread?.join()
            audioQueue = null
            stream.release()
            releaseRecorder()
            listener.onLevel(0f)
        }
    }

    private fun decodeReady(stream: OnlineStream) {
        val active = checkNotNull(recognizer)
        while (active.isReady(stream)) active.decode(stream)
    }

    private fun refine(samples: FloatArray, streamingText: String, hotwords: String = ""): String {
        // Avoid repeatedly running the offline model on rule-1 endpoints while
        // the microphone is open in a quiet room.
        if (streamingText.isBlank()) return ""
        if (samples.size < MIN_FINAL_PASS_SAMPLES) return streamingText
        val finalPass = finalPassRecognizer ?: return streamingText
        return runCatching { finalPass.recognize(samples) }
            .onSuccess { result ->
                val audioMs = samples.size * 1_000L / SAMPLE_RATE
                Log.i(TAG, "final-pass audioMs=$audioMs elapsedMs=${result.elapsedMs}")
                transcriptLog(result.text.length) { "final-pass text=[${result.text}]" }
            }
            .onFailure { Log.w(TAG, "Final-pass recognition failed; using streaming result", it) }
            .getOrNull()
            ?.text
            ?.let { AsrHotwords.selectFinalText(streamingText, it, hotwords) }
            ?: streamingText
    }

    private fun releaseRecorder() {
        recorder?.let { active ->
            runCatching {
                if (active.recordingState == AudioRecord.RECORDSTATE_RECORDING) active.stop()
            }
            active.release()
        }
        recorder = null
    }

    private companion object {
        const val TAG = "FeelimeAsr"
        const val SAMPLE_RATE = 16_000
        const val CHUNK_SAMPLES = 1_600
        // At most 24 seconds / 768 KB of pending PCM; overload is explicit.
        const val MAX_PENDING_CHUNKS = 240
        const val MIN_FINAL_PASS_SAMPLES = SAMPLE_RATE / 4
        const val MAX_UTTERANCE_SAMPLES = SAMPLE_RATE * 24
    }
}
