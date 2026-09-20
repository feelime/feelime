package com.feelime.ime.backup

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class UserdataBackupTest {

    /** 内存 prefs：值保留 Java 类型，与 AndroidPrefs 的类型保真约定一致。 */
    private class FakePrefs : PrefsAccess {
        val files = HashMap<String, HashMap<String, Any?>>()
        override fun all(prefsName: String): Map<String, Any?> =
            files.getOrPut(prefsName) { HashMap() }

        override fun put(prefsName: String, key: String, value: Any?) {
            val file = files.getOrPut(prefsName) { HashMap() }
            if (value == null) file.remove(key) else file[key] = value
        }
    }

    private fun newDir(): File = Files.createTempDirectory("feelime-backup").toFile()

    @Test
    fun roundTripRestoresTypedPrefsAndFavorites() {
        val prefs = FakePrefs()
        prefs.put("feelime_ui", "theme", "dark")
        prefs.put("feelime_keyboard", "keyboard_height_portrait", 640)
        prefs.put("feelime_keyboard", "bottom_pad_dp_portrait", 24)
        prefs.put("feelime_keyboard", "bottom_pad_dp_landscape", 12)
        prefs.put("feelime_keyboard", "association_on", true)
        prefs.put("feelime_keyboard", "key_sound_on", true)
        prefs.put("feelime_keyboard", "key_haptic_on", false)
        prefs.put("feelime_custom_keys", "enabled", true)
        prefs.put("feelime_custom_keys", "json", """{"rows":[]}""")
        prefs.put("feelime_favorites", "items", "f1\t1730000000000\tcode1\t常用语\\t细\t3")
        prefs.put("keyboard_update", "update_url", "https://example.com/kb.zip")
        prefs.put("keyboard_update", "update_source_url", "https://example.com/metainfo.json")
        prefs.put("keyboard_update", "update_auto_check_enabled", true)
        prefs.put("keyboard_update", "update_state", "ACTIVE")
        prefs.put("keyboard_update", "content_hash", "abc123")

        val files = newDir()
        val backup = UserdataBackup(prefs, files, appVersion = "9.9.9-test")
        val json = backup.export().toString()

        // 导出文件是纯文本 JSON，kind/version 齐全。
        val parsed = JSONObject(json)
        assertEquals(UserdataBackup.KIND, parsed.getString("kind"))
        assertEquals(UserdataBackup.VERSION, parsed.getInt("version"))
        assertEquals("9.9.9-test", parsed.getString("appVersion"))

        // 恢复到一套全新的 prefs + 目录。
        val target = FakePrefs()
        val result = UserdataBackup(target, newDir()).restore(json.toByteArray())
        assertTrue(result is UserdataBackup.RestoreResult.Ok)
        assertFalse((result as UserdataBackup.RestoreResult.Ok).engineRestartNeeded)

        // 类型保真：Int 仍是 Int、Boolean 仍是 Boolean（串型会让读侧崩）。
        assertEquals(640, target.all("feelime_keyboard")["keyboard_height_portrait"])
        // 方向拆分后的留白两键同样走离散档位校验（mode-fallback §3：
        // 恢复侧 DISCRETE_INT_KEYS，1/13 这类非法档位不再被范围校验放过）。
        assertEquals(24, target.all("feelime_keyboard")["bottom_pad_dp_portrait"])
        assertEquals(12, target.all("feelime_keyboard")["bottom_pad_dp_landscape"])
        assertEquals(true, target.all("feelime_keyboard")["association_on"])
        assertEquals(true, target.all("feelime_keyboard")["key_sound_on"])
        assertEquals(false, target.all("feelime_keyboard")["key_haptic_on"])
        assertEquals(true, target.all("feelime_custom_keys")["enabled"])
        assertEquals(true, target.all("keyboard_update")["update_auto_check_enabled"])
        assertEquals("dark", target.all("feelime_ui")["theme"])
        // 热更配置搬地址类键，过程状态必须留在恢复方自己的世界里。
        assertEquals("https://example.com/kb.zip", target.all("keyboard_update")["update_url"])
        assertNull(target.all("keyboard_update")["update_state"])
        assertNull(target.all("keyboard_update")["content_hash"])
        // 常用语经 TSV 解码 → JSON → 再编码，code/text/rank 都还在。
        val restored = com.feelime.ime.panel.PanelCodec.parse(
            target.all("feelime_favorites")["items"] as String,
        )
        assertEquals(1, restored.size)
        assertEquals("常用语\t细", restored[0].text)
        assertEquals("code1", restored[0].code)
        assertEquals(3, restored[0].rank)
    }

    @Test
    fun restoreRejectsIllegalPadStepsOnBothOrientationKeys() {
        // 导出全量收集，恢复按 DISCRETE_INT_KEYS 逐档比对：旧单键与方向
        // 拆分后的两键都拒绝 1/13（round-2 评审要拦的形态）。
        val json = """{"kind":"${'$'}{UserdataBackup.KIND}","version":2,"appVersion":"9.9.9-test",
            "settings":{"feelime_keyboard":{"bottom_pad_dp_portrait":13,"bottom_pad_dp_landscape":1}}}"""
        val result = UserdataBackup(FakePrefs(), newDir()).restore(json.toByteArray())
        assertTrue(result is UserdataBackup.RestoreResult.Fail)
    }

    @Test
    fun userdbStagesAndSwapsAroundEngineRestart() {
        val prefs = FakePrefs()
        val files = newDir()
        val rime = File(files, "rime-user").apply { mkdirs() }
        File(rime, "user.yaml").writeText("rime user data")
        File(rime, "build").apply { mkdirs() }
        File(rime, "build/main.table.bin").writeBytes(byteArrayOf(1, 2, 3))
        val backup = UserdataBackup(prefs, files)

        val json = backup.export().toString()
        assertTrue(json.contains("user.yaml"))
        // issue #23：基底词库的设备端编译产物（rime build/）可再生、恢复后
        // 词库状态本来就要复位——不进备份，导出体积不膨胀。
        assertFalse(json.contains("build/main.table.bin"))

        val target = newDir()
        val targetBackup = UserdataBackup(FakePrefs(), target)
        val result = targetBackup.restore(json.toByteArray())
        assertTrue((result as UserdataBackup.RestoreResult.Ok).engineRestartNeeded)
        // 恢复后词库躺在暂存目录，等引擎关会话后才换入。
        assertTrue(targetBackup.hasPendingUserdb())
        assertFalse(File(target, "rime-user").exists())
        assertTrue(File(target, "rime-user.import/user.yaml").isFile)

        // IME 的换入点：swap 之后暂存清空、正式目录就位、幂等。
        assertTrue(targetBackup.applyPendingUserdb())
        assertTrue(File(target, "rime-user/user.yaml").isFile)
        assertFalse(File(target, "rime-user.import").exists())
        assertFalse(targetBackup.hasPendingUserdb())
        assertFalse(targetBackup.applyPendingUserdb())
    }

    @Test
    fun mozcBuildFilesStillBackedUp() {
        // build/ 排除只对 rime 开（#23 编译产物）；mozc 的 build/ 不是
        // 可再生产物，必须照常进导出。
        val files = newDir()
        val build = File(File(files, "mozc-user"), "build").apply { mkdirs() }
        File(build, "userdb.ldb").writeBytes(byteArrayOf(9))
        val json = UserdataBackup(FakePrefs(), files).export().toString()
        assertTrue(json.contains("build/userdb.ldb"))
    }

    @Test
    fun mozcOnlyRestoreNeedsNoEngineRestart() {
        val files = newDir()
        File(File(files, "mozc-user").apply { mkdirs() }, "user.db").writeText("db")
        val json = UserdataBackup(FakePrefs(), files).export().toString()

        val target = newDir()
        val targetBackup = UserdataBackup(FakePrefs(), target)
        val result = targetBackup.restore(json.toByteArray())
        // mozc 的 JNI 全局不随会话重建，文件换入等进程重启生效（设计 §1.3）。
        assertFalse((result as UserdataBackup.RestoreResult.Ok).engineRestartNeeded)
        assertTrue(targetBackup.hasPendingUserdb())
        assertTrue(targetBackup.applyPendingUserdb())
        assertTrue(File(target, "mozc-user/user.db").isFile)
    }

    @Test
    fun compressibleUserdbExportsGzippedAndRoundTrips() {
        // issue #10：mozc 预分配的稀疏 DB 绝大部分是零字节，v2 把可压缩
        // 文件写成 {"gz": base64(gzip(bytes))}，320KB 能缩到几百字节。
        val files = newDir()
        val mozc = File(files, "mozc-user").apply { mkdirs() }
        val sparse = ByteArray(320 * 1024)
        sparse[0] = 0x42
        sparse[sparse.size - 1] = 0x7F
        File(mozc, "segment.db").writeBytes(sparse)
        // 压不动的随机小文件保持 v1 的纯 base64 字符串形态。
        val noisy = File(mozc, "noise.db")
        noisy.writeBytes(ByteArray(64) { (it * 37 + 11).toByte() })
        // LOCK/LOG 是 leveldb 可再生文件，导出跳过；*.log 是 WAL，保留。
        File(mozc, "LOCK").writeBytes(ByteArray(0))
        File(mozc, "LOG").writeText("log")
        File(mozc, "user-history.log").writeText("wal")

        val backup = UserdataBackup(FakePrefs(), files)
        val json = backup.export()
        val entries = json.getJSONObject("userdb").getJSONObject("mozc")
        assertTrue(entries.optJSONObject("segment.db")?.has("gz") == true)
        assertTrue(entries.opt("noise.db") is String)
        assertFalse(entries.has("LOCK"))
        assertFalse(entries.has("LOG"))
        assertTrue(entries.has("user-history.log"))
        val v2Size = json.toString().toByteArray().size
        assertTrue("v2 backup should shrink sparse DBs: $v2Size", v2Size < 2048)

        val target = newDir()
        val targetBackup = UserdataBackup(FakePrefs(), target)
        assertTrue(targetBackup.restore(json.toString().toByteArray())
            is UserdataBackup.RestoreResult.Ok)
        assertTrue(targetBackup.applyPendingUserdb())
        val restored = File(target, "mozc-user/segment.db").readBytes()
        assertEquals(sparse.size, restored.size)
        assertEquals(0x42.toByte(), restored[0])
        assertEquals(0x7F.toByte(), restored[restored.size - 1])
        assertTrue(File(target, "mozc-user/user-history.log").isFile)
        assertFalse(File(target, "mozc-user/LOCK").exists())
    }

    @Test
    fun v1PlainBase64UserdbStillRestores() {
        // 版本前向兼容：老备份（纯 base64 字符串）必须一直能恢复。
        val payload = "aGk=" // "hi"
        val v1 = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
            .put("settings", JSONObject())
            .put("userdb", JSONObject().put(
                "rime",
                JSONObject().put("user.yaml", payload),
            ))
        val targetDir = newDir()
        val target = UserdataBackup(FakePrefs(), targetDir)
        assertTrue(target.restore(v1.toString().toByteArray()) is UserdataBackup.RestoreResult.Ok)
        assertTrue(target.applyPendingUserdb())
        assertEquals("hi", File(targetDir, "rime-user/user.yaml").readText())
    }

    @Test
    fun corruptGzipEntryFailsValidationWithoutSideEffects() {
        val broken = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", UserdataBackup.VERSION)
            .put("settings", JSONObject())
            .put("userdb", JSONObject().put(
                "mozc",
                JSONObject().put("segment.db", JSONObject().put("gz", "bm90LWd6aXA=")),
            ))
        val prefs = FakePrefs()
        prefs.put("feelime_ui", "theme", "dark")
        val target = UserdataBackup(prefs, newDir())
        val result = target.restore(broken.toString().toByteArray())
        assertTrue((result as UserdataBackup.RestoreResult.Fail).code == "BASE64")
        // 校验失败不落任何状态：prefs 不被写、暂存目录不存在。
        assertEquals("dark", prefs.all("feelime_ui")["theme"])
        assertFalse(target.hasPendingUserdb())
    }

    @Test
    fun rejectsWrongKindAndBadVersionAndPathTraversal() {
        val target = UserdataBackup(FakePrefs(), newDir())

        val wrongKind = JSONObject().put("kind", "other").put("version", 1)
        assertTrue(target.restore(wrongKind.toString().toByteArray())
            is UserdataBackup.RestoreResult.Fail)

        // 缺 version 与超版本文本都拒绝；老版本（version < 当前）允许。
        val missingVersion = JSONObject().put("kind", UserdataBackup.KIND)
        assertTrue(target.restore(missingVersion.toString().toByteArray())
            is UserdataBackup.RestoreResult.Fail)
        val newerVersion = JSONObject().put("kind", UserdataBackup.KIND).put("version", 99)
        assertTrue(target.restore(newerVersion.toString().toByteArray())
            is UserdataBackup.RestoreResult.Fail)
        val olderVersion = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
            .put("settings", JSONObject())
        assertTrue(target.restore(olderVersion.toString().toByteArray())
            is UserdataBackup.RestoreResult.Ok)

        // userdb 里的路径穿越在「校验阶段」就被拦下：不落任何文件，
        // 也不写任何 prefs（合法段落也不能先落地）。
        val prefs = FakePrefs()
        prefs.put("feelime_ui", "theme", "dark")
        val traversal = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
            .put("settings", JSONObject().put("feelime_ui", JSONObject().put("theme", "light")))
            .put("userdb", JSONObject().put(
                "rime",
                JSONObject().put("../escape.yaml", "aGk="),
            ))
        val files = newDir()
        val staged = UserdataBackup(prefs, files)
        val outcome = staged.restore(traversal.toString().toByteArray())
        assertTrue(outcome is UserdataBackup.RestoreResult.Fail)
        assertEquals("PATH", (outcome as UserdataBackup.RestoreResult.Fail).code)
        assertFalse(File(files, "escape.yaml").exists())
        assertFalse(File(files, "rime-user.import").exists())
        // 校验失败 = 全量不提交。
        assertEquals("dark", prefs.all("feelime_ui")["theme"])
    }

    @Test
    fun schemaFailuresRejectTheWholeBackup() {
        val target = UserdataBackup(FakePrefs(), newDir())
        fun settings(vararg pairs: Pair<String, JSONObject>) = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
            .put("settings", JSONObject().apply { pairs.forEach { (n, s) -> put(n, s) } })

        // getInt 键写 Long（手编 2147483648 会被 org.json 解析成 Long）→ 拒绝。
        assertTrue(target.restore(
            settings("feelime_keyboard" to JSONObject().put("keyboard_height_portrait", 2147483648L))
                .toString().toByteArray(),
        ) is UserdataBackup.RestoreResult.Fail)
        // getInt 键写超界 Int → 拒绝。
        assertTrue(target.restore(
            settings("feelime_keyboard" to JSONObject().put("keyboard_height_portrait", -5))
                .toString().toByteArray(),
        ) is UserdataBackup.RestoreResult.Fail)
        // getBoolean 键写字符串 "true" → 拒绝（读侧 getBoolean 会崩）。
        assertTrue(target.restore(
            settings("feelime_custom_keys" to JSONObject().put("enabled", "true"))
                .toString().toByteArray(),
        ) is UserdataBackup.RestoreResult.Fail)
        // 白名单外的 prefs 段落忽略（前向兼容），其余照常恢复。
        val prefs = FakePrefs()
        val ignoring = UserdataBackup(prefs, newDir())
        val result = ignoring.restore(
            settings(
                "feelime_unknown_module" to JSONObject().put("evil", true),
                "feelime_ui" to JSONObject().put("theme", "light"),
            ).toString().toByteArray(),
        )
        assertTrue(result is UserdataBackup.RestoreResult.Ok)
        assertNull(prefs.all("feelime_unknown_module")["evil"])
        assertEquals("light", prefs.all("feelime_ui")["theme"])
    }

    @Test
    fun emptyBackupOverwritesTargetState() {
        // 空备份 = 导出方的真实状态（全新安装）：恢复要清空目标，
        // 而不是把旧数据留下。
        val target = FakePrefs()
        target.put("feelime_favorites", "items", "f1\t1\t\t旧常用语\t1")
        target.put(
            UserdataBackup.WEBVIEW_PREFS,
            UserdataBackup.WEBVIEW_KEY,
            JSONObject().put("rev", 3).put("values", JSONObject().put("feelime_theme", "dark")).toString(),
        )
        val empty = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
        val result = UserdataBackup(target, newDir()).restore(empty.toString().toByteArray())
        assertTrue(result is UserdataBackup.RestoreResult.Ok)
        assertEquals("", target.all("feelime_favorites")["items"])
        val mirror = JSONObject(target.all(UserdataBackup.WEBVIEW_PREFS)[UserdataBackup.WEBVIEW_KEY] as String)
        assertEquals(4, mirror.getInt("rev")) // 恢复让 rev 跳号，旧页面下次握手必然拉取
        assertEquals(0, mirror.getJSONObject("values").length())
    }

    @Test
    fun webviewStoresMirrorRoundTripsWithRev() {
        val prefs = FakePrefs()
        prefs.put(
            UserdataBackup.WEBVIEW_PREFS,
            UserdataBackup.WEBVIEW_KEY,
            JSONObject().put("rev", 2).put(
                "values", JSONObject().put("feelime_theme", "dark"),
            ).toString(),
        )
        val exported = UserdataBackup(prefs, newDir()).export()
        assertEquals("dark", exported.getJSONObject("webviewStores").getString("feelime_theme"))

        val target = FakePrefs()
        UserdataBackup(target, newDir()).restore(exported.toString().toByteArray())
        val mirror = JSONObject(target.all(UserdataBackup.WEBVIEW_PREFS)[UserdataBackup.WEBVIEW_KEY] as String)
        assertEquals("dark", mirror.getJSONObject("values").getString("feelime_theme"))
        // 目标原来没有镜像（rev 从 0 起算），恢复后 rev=1。
        assertEquals(1, mirror.getInt("rev"))
    }

    @Test
    fun schemaFailureLeavesUserdbStagingBehind() {
        // 阶段一校验失败时，绝不能留下会被启动逻辑换入的半个暂存。
        val target = UserdataBackup(FakePrefs(), newDir())
        val bad = JSONObject()
            .put("kind", UserdataBackup.KIND)
            .put("version", 1)
            .put("settings", JSONObject().put("feelime_ui", JSONObject().put("x", 1.5)))
        assertTrue(target.restore(bad.toString().toByteArray()) is UserdataBackup.RestoreResult.Fail)
        assertFalse(target.hasPendingUserdb())
    }
}
