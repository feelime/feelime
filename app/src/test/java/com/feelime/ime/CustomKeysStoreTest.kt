package com.feelime.ime

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CustomKeysStore 的桥协议不变量（codex 评审 P1 回归防护）：
 * 从未写过 pref 的存储必须应答「未设置」（空串），绝不能是 "disabled"——
 * §15 之前版本的定制键表只存在于键盘 localStorage，首次 hello 时键盘
 * 靠空串应答走「上推迁移」分支；"disabled" 会让键盘先删掉本地表，
 * 迁移永远不发生（升级用户键表丢失）。
 */
class CustomKeysStoreTest {
    private class FakeEditor(val map: MutableMap<String, Any>) : SharedPreferences.Editor {
        override fun putString(key: String, value: String?) = apply { if (value != null) map[key] = value else map.remove(key) }
        override fun putStringSet(key: String, values: MutableSet<String>?) = this
        override fun putInt(key: String, value: Int) = this
        override fun putLong(key: String, value: Long) = this
        override fun putFloat(key: String, value: Float) = this
        override fun putBoolean(key: String, value: Boolean) = apply { map[key] = value }
        override fun remove(key: String) = apply { map.remove(key) }
        override fun clear() = apply { map.clear() }
        override fun commit() = true
        override fun apply() {}
    }

    private class FakePrefs : SharedPreferences {
        val map = mutableMapOf<String, Any>()
        override fun getAll() = map
        override fun getString(key: String, defValue: String?) = map[key] as? String ?: defValue
        override fun getStringSet(key: String, defValue: MutableSet<String>?) = defValue
        override fun getInt(key: String, defValue: Int) = map[key] as? Int ?: defValue
        override fun getLong(key: String, defValue: Long) = map[key] as? Long ?: defValue
        override fun getFloat(key: String, defValue: Float) = map[key] as? Float ?: defValue
        override fun getBoolean(key: String, defValue: Boolean) = map[key] as? Boolean ?: defValue
        override fun contains(key: String) = key in map
        override fun edit() = FakeEditor(map)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {}
    }

    @Test
    fun neverWrittenStoreAnswersUnsetNotDisabled() {
        val store = CustomKeysStore(FakePrefs())
        assertTrue(store.enabled())
        assertEquals("", store.json())
        assertEquals("fresh store must answer unset so the keyboard pushes its localStorage table up",
            "", store.syncAnswer())
    }

    @Test
    fun explicitOffAnswersDisabledAndWins() {
        val prefs = FakePrefs()
        val store = CustomKeysStore(prefs)
        store.save("""{"version":1,"rows":[[{"t":"✓","tap":"好的"}]]}""", enabled = true)
        assertEquals("""{"version":1,"rows":[[{"t":"✓","tap":"好的"}]]}""", store.syncAnswer())
        store.setEnabled(false)
        assertFalse(store.enabled())
        assertEquals("the settings switch must still reach the keyboard as disabled",
            "disabled", store.syncAnswer())
    }

    @Test
    fun saveWritesJsonAndEnabledTogether() {
        val prefs = FakePrefs()
        val store = CustomKeysStore(prefs)
        store.save("{}", enabled = false)
        assertTrue("save keeps json and enabled written as a pair (no half state)",
            prefs.contains("json") && prefs.contains("enabled"))
    }
}
