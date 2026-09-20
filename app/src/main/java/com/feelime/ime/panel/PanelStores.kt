package com.feelime.ime.panel

import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicLong

/**
 * Clipboard history for the keyboard panel (design §3.7).
 *
 * - Single source of truth is a SharedPreferences string; all list algebra
 *   lives in [PanelStoreOps]/[PanelCodec] so the JVM tests cover the logic.
 * - The clip listener runs on the main-thread handler and reads the caller's
 *   sensitivity flag synchronously: [setEnabled] is true exactly while the
 *   focused editor is non-sensitive (set in onStartInput, reset in
 *   onFinishInputView — see FeelimeService).
 * - Items are stored in full (no truncation: a truncated copy would paste
 *   corrupted data). The 2000-code-point commit limit is enforced at the UI
 *   layer, where over-long items render disabled.
 */
/**
 * Pure decision core for the clipboard suppression marker (mode-fallback §5):
 * after a clear/remove, the system clipboard still holds the wiped text — a
 * re-capture must not re-import it, and any recording of a DIFFERENT text
 * lifts the marker. Same-text captures stay suppressed on every path: a late
 * clip-changed notification for a copy made before the clear is
 * indistinguishable from the wiped clip itself, and the user asked for the
 * text to stay gone either way. Operates on fingerprints only, never clip
 * text, so a sensitive clip can never leak into prefs through this path.
 * JVM-tested.
 */
class ClipSuppressPolicy(private val onMarkerChanged: (String?) -> Unit = {}) {
    var marker: String? = null
        private set

    /** Process restart: reload the persisted marker (fingerprint or null). */
    fun restore(saved: String?) {
        marker = saved
    }

    /** clear()/remove(): snapshot the fingerprint of the clip the system
     *  still holds (null = nothing usable to suppress). */
    fun snapshot(currentFingerprint: String?) {
        marker = currentFingerprint
        onMarkerChanged(marker)
    }

    fun shouldSuppress(fingerprint: String): Boolean =
        marker != null && fingerprint.isNotEmpty() && fingerprint == marker

    /** Any recorded entry is a real capture — the marker has served its purpose. */
    fun onRecorded() {
        if (marker == null) return
        marker = null
        onMarkerChanged(null)
    }
}

class ClipboardStore(private val context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("feelime_clipboard", Context.MODE_PRIVATE)
    private val idCounter = AtomicLong(System.currentTimeMillis())

    /** Suppression marker lives in prefs (fingerprint only) so it survives
     *  process death alongside the history it protects. */
    private val suppress = ClipSuppressPolicy { marker ->
        if (marker == null) prefs.edit().remove(SUPPRESS_KEY).apply()
        else prefs.edit().putString(SUPPRESS_KEY, marker).apply()
    }.also { it.restore(prefs.getString(SUPPRESS_KEY, null)) }

    /** Mirrors the service's current editor sensitivity; false = never record. */
    @Volatile
    var collectEnabled: Boolean = false

    private val listener = ClipboardManager.OnPrimaryClipChangedListener {
        mainHandler.post { onClipChanged() }
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    /** Runs on the main thread; reads the volatile sensitivity flag once. */
    private fun onClipChanged() {
        if (!collectEnabled) return
        captureCurrent(fromFocus = false)
    }

    /**
     * Reads the current primary clip into the history. Called by the listener
     * and once when an editor gains focus : copies made while the
     * keyboard was hidden never fired the listener with collectEnabled=true,
     * so the first thing the user pastes would otherwise be missing.
     *
     * The suppression fingerprint is honoured on BOTH paths (mode-fallback
     * §5): right after the user cleared the history, the system clip still
     * holds the wiped text, and a focus re-capture must not re-import it.
     * The listener path is included because a copy notification may arrive
     * AFTER the clear (the copy itself was queued before it) — recording it
     * would resurrect the just-wiped entry and lift the marker. Only a clip
     * that differs from the suppressed fingerprint is a REAL new recording.
     */
    fun captureCurrent(fromFocus: Boolean = true) {
        val clip = clipboard(context)?.primaryClip ?: return
        if (clip.itemCount == 0) return
        // The flag is also used for version reports copied by Settings.
        // Reading the literal key works on older Android releases too.
        if (clip.description.extras?.getBoolean("android.content.extra.IS_SENSITIVE", false) == true) return
        val text = clip.getItemAt(0).coerceToText(context)?.toString() ?: return
        if (text.isEmpty()) return
        val fingerprint = fingerprintOf(text)
        if (suppress.shouldSuppress(fingerprint)) return
        record(text)
        suppress.onRecorded()
    }

    private var registered = false

    fun start() {
        if (registered) return
        clipboard(context)?.addPrimaryClipChangedListener(listener)
        registered = true
    }

    fun stop() {
        if (!registered) return
        clipboard(context)?.removePrimaryClipChangedListener(listener)
        registered = false
    }

    fun record(text: String) {
        synchronized(prefs) {
            val items = PanelCodec.parse(prefs.getString(KEY, "").orEmpty())
            val next = PanelStoreOps.insert(
                items, text, nextId(), System.currentTimeMillis(),
                TEXT_BUDGET_BYTES, MAX_ITEMS,
            ) ?: return
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
        }
        // New content landed (listener or focus re-capture): let the
        // service push so an open clipboard panel hot-refreshes instead
        // of waiting for the next getClipboard pull.
        onChanged?.invoke()
    }

    /** Fired after a capture actually persisted a new entry. The service
     * wires this to pushClipboard(); null by default keeps the store
     * self-contained in tests. */
    @Volatile
    var onChanged: (() -> Unit)? = null

    fun items(): List<PanelItem> = synchronized(prefs) {
        PanelCodec.parse(prefs.getString(KEY, "").orEmpty())
    }

    /** Mutations are serialized onto the main thread WITH the listener/focus
     *  capture paths (the panel bridge posts to main; the service used to
     *  call these from a background executor): clear()/remove() ordering
     *  against captures is what keeps a just-wiped history from being
     *  resurrected by a capture that lands between the wipe and the
     *  suppression marker (mode-fallback §5). */
    fun remove(id: String) {
        mainHandler.post { removeNow(id) }
    }

    private fun removeNow(id: String) {
        val removed = synchronized(prefs) {
            val items = PanelCodec.parse(prefs.getString(KEY, "").orEmpty())
            val next = PanelStoreOps.remove(items, id)
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
            items.firstOrNull { it.id == id }
        }
        // Removing the entry that IS the current system clip would be undone
        // at the next editor focus (captureCurrent) — suppress it too.
        if (removed != null && currentClipText() == removed.text) {
            suppress.snapshot(fingerprintOf(removed.text))
        }
    }

    /** See [remove] for the threading note. */
    fun clear() {
        mainHandler.post { clearNow() }
    }

    private fun clearNow() {
        synchronized(prefs) {
            prefs.edit().putString(KEY, "").apply()
        }
        // Suppress whatever the system clipboard still holds so a focus
        // re-capture cannot resurrect the wiped history. Only the fingerprint
        // is stored — sensitive clips never persist their text (§5).
        suppress.snapshot(currentClipText()?.let { fingerprintOf(it) })
    }

    /** Runs on the main thread; null when there is no usable clip text. */
    private fun currentClipText(): String? {
        val clip = clipboard(context)?.primaryClip ?: return null
        if (clip.itemCount == 0) return null
        if (clip.description.extras?.getBoolean("android.content.extra.IS_SENSITIVE", false) == true) {
            return null
        }
        return clip.getItemAt(0).coerceToText(context)?.toString()?.takeIf { it.isNotEmpty() }
    }

    /** SHA-256, hex, first 16 chars — never store the clip text itself. */
    private fun fingerprintOf(text: String): String = runCatching {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest(text.toByteArray(Charsets.UTF_8))
        digest.take(8).joinToString("") { "%02x".format(it) }
    }.getOrDefault("")

    private fun nextId(): String = "%012x".format(idCounter.incrementAndGet())

    private fun clipboard(context: Context): ClipboardManager? =
        context.applicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager

    private companion object {
        const val KEY = "items"
        const val SUPPRESS_KEY = "suppress_fingerprint"
        // Design budget: 64KiB total minus ~8KiB metadata headroom, counting
        // text UTF-8 bytes only.
        const val TEXT_BUDGET_BYTES = 56 * 1024
        const val MAX_ITEMS = 50
    }
}

/**
 * Cross-instance mutation signals. Stores are thin wrappers over one
 * SharedPreferences each; the SetupActivity manager and the IME panel bridge
 * hold different wrapper instances, so an instance-level callback would miss
 * writes made through the other one. Callbacks have no thread guarantee;
 * consumers hop themselves.
 */
object PanelStoreSignals {
    // Only favorites need a cross-instance signal: its writers live on both
    // sides (SetupActivity manager and the IME panel), while the clipboard has
    // a single UI consumer - the IME panel - which re-pulls after its own
    // mutations and is otherwise fed by the system clip listener; Setup has no
    // clipboard UI.
    val favorites: MutableSet<() -> Unit> =
        java.util.concurrent.ConcurrentHashMap.newKeySet()

    fun fireFavoritesChanged() {
        favorites.forEach { it() }
    }
}

/** Saved phrases (常用语); managed from SetupActivity, consumed by the panel. */
class FavoritesStore(context: Context) {
    private val appContext = context.applicationContext
    private val initials: Map<Int, Char> by lazy {
        appContext.assets.open("phrase-initials.tsv").bufferedReader().useLines { lines ->
            lines.mapNotNull { line ->
                val parts = line.split('\t')
                if (parts.size == 2 && parts[0].isNotEmpty() && parts[1].length == 1)
                    parts[0].codePointAt(0) to parts[1][0] else null
            }.toMap()
        }
    }

    private fun inputCode(text: String, explicit: String): String =
        explicit.trim().ifEmpty { PhraseInputCode.generate(text) { initials[it] } }

    private val prefs = context.applicationContext
        .getSharedPreferences("feelime_favorites", Context.MODE_PRIVATE)
    private val idCounter = AtomicLong(System.currentTimeMillis())

    private fun fireChanged() {
        PanelStoreSignals.fireFavoritesChanged()
    }

    fun items(): List<PanelItem> = synchronized(prefs) {
        val stored = PanelCodec.parse(prefs.getString(KEY, "").orEmpty())
        val resolved = stored.map { if (it.code.isBlank()) it.copy(code = inputCode(it.text, "")) else it }
        if (resolved != stored) prefs.edit().putString(KEY, PanelCodec.serialize(resolved)).apply()
        resolved
    }

    /** Returns false when the text is empty or exceeds the per-item limit.
     * [code] is the optional phrase input code.
     * [rank] is the 1-based candidate slot for exact code matches. */
    fun add(text: String, code: String = "", rank: Int = 1): Boolean {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || trimmed.length > MAX_TEXT_CHARS) return false
        synchronized(prefs) {
            val inserted = PanelStoreOps.insert(
                items(), trimmed, nextId(), System.currentTimeMillis(),
                TEXT_BUDGET_BYTES, MAX_ITEMS,
            ) ?: return false
            // insert() puts the new row first; stamp the code onto it.
            val resolvedCode = inputCode(trimmed, code)
            val resolvedRank = rank.coerceIn(1, 99)
            val next = inserted.map {
                if (it.id == inserted[0].id) it.copy(code = resolvedCode, rank = resolvedRank) else it
            }
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
        }
        fireChanged()
        return true
    }

    fun remove(id: String) {
        synchronized(prefs) {
            val next = PanelStoreOps.remove(items(), id)
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
        }
        fireChanged()
    }

    /** Phrase manager: rewrite one phrase (same limits as add).
     * [code] rides along. [rank] rides along too. */
    fun update(id: String, text: String, code: String = "", rank: Int = 1): Boolean {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || trimmed.length > MAX_TEXT_CHARS) return false
        synchronized(prefs) {
            val next = PanelStoreOps.update(items(), id, trimmed, inputCode(trimmed, code), rank.coerceIn(1, 99))
                ?: return false
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
        }
        fireChanged()
        return true
    }

    /** Phrase manager: drag reorder / pin-to-top (to = 0). */
    fun move(id: String, to: Int) {
        synchronized(prefs) {
            val next = PanelStoreOps.move(items(), id, to)
            prefs.edit().putString(KEY, PanelCodec.serialize(next)).apply()
        }
        fireChanged()
    }

    private fun nextId(): String = "%012x".format(idCounter.incrementAndGet())

    private companion object {
        const val KEY = "items"
        const val TEXT_BUDGET_BYTES = 56 * 1024
        const val MAX_ITEMS = 200
        const val MAX_TEXT_CHARS = 200
    }
}
