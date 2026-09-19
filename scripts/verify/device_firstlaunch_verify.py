#!/usr/bin/env python3
"""First-launch smoke (see docs/testing/verification.md): after a FRESH install (no
force-stop-first, no leftover data), the very first run must work. The
existing suites always force-stop before starting - they test the SECOND
launch and never the first (a released build once came up dead on
this path).

  F1 first launch of SetupActivity renders its content and reaches hello
  F2 no settings-page JS errors in logcat
  F3 the very first keyboard show completes the handshake (version, DOM)
  F4 pinyin composes on the first try

Env: FEELIME_ADB_SERIAL, FEELIME_NEW_APK (the build under test).
"""
import os
import re
import subprocess
import sys
import time

import device_verify as d

SERIAL = os.environ.get("FEELIME_ADB_SERIAL", "")
NEW_APK = os.environ.get("FEELIME_NEW_APK", "")
PKG = d.PKG
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {detail}" if detail else ""))


def main():
    if not SERIAL or not NEW_APK:
        raise SystemExit("FEELIME_ADB_SERIAL / FEELIME_NEW_APK are required")

    print("== fresh install (data wiped - the true first launch) ==")
    out = subprocess.run(["adb", "-s", SERIAL, "uninstall", PKG], capture_output=True).stdout.decode()
    out = subprocess.run(["adb", "-s", SERIAL, "install", "-r", NEW_APK], capture_output=True).stdout.decode()
    if "Success" not in out:
        raise SystemExit(f"install failed:\n{out}")
    subprocess.run(["adb", "-s", SERIAL, "shell",
                    f"pm grant {PKG} android.permission.RECORD_AUDIO"], capture_output=True)
    # A fresh install's IME component starts DISABLED (enabled=0): without
    # the explicit enable the default falls back to another IME and the keyboard
    # never shows (the real user goes through the enable step once). The
    # package manager is still mid-registration right after install - retry
    # until the enable actually sticks (checked against `ime list -s`).
    # Review F4: enable only - the actual `ime set` happens AFTER the first
    # SetupActivity launch, matching the real first-install order (settings
    # page first, IME selected later); binding the IME earlier would run the
    # app's onCreate before the activity's first frame and mask exactly the
    # cold-start ordering this smoke exists to cover.
    import time as _time
    _time.sleep(3.0)
    for _ in range(5):
        enabled = d.shell("ime list -s")
        if f"{PKG}/" in enabled:
            break
        d.shell(f"ime enable {PKG}/com.feelime.ime.FeelimeService")
        _time.sleep(1.5)

    # NO force-stop, NO ime set yet: the FIRST activity start of the app's
    # life, with a cold process.
    print("== F1/F2: first SetupActivity launch ==")
    d.shell(f"logcat -c")
    d.shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity")
    # A fresh install's first WebView load (cold process, first asset read)
    # can take well past 4s on a busy emulator - poll for the render instead
    # of sampling once.
    rendered = ""
    for _ in range(10):
        time.sleep(1.5)
        rendered = d.devtools_eval_target(
            "settings/index.html",
            "!!window.FeelimeSettings ? String(document.body.innerText.length) : 'no-bridge'") or ""
        if rendered.isdigit() and int(rendered) > 50:
            break
    check("F1 settings page renders on first launch", rendered.isdigit() and int(rendered) > 50,
          f"innerText={rendered!r}")
    xml = d.ui_dump()
    # WebView 的 a11y 树是懒建立的——DOM 渲染完成不等于 uiautomator 能看到
    # 内容（1.0.8 冒烟实录：DOM 704 字符稳定可见，a11y 树要再等几拍）。
    # The first page follows the device/UI locale. Keep the Chinese markers
    # for zh devices and accept the exact English labels from settings.js on
    # en devices; do not change the locale just to satisfy this smoke.
    def _has_settings_content(x):
        return (("语音识别" in x) or ("模型" in x) or ("输入法" in x)
                or ("Voice recognition" in x) or ("Voice models" in x)
                or ("Input method" in x))
    for _ in range(6):
        if _has_settings_content(xml):
            break
        time.sleep(2)
        xml = d.ui_dump()
    check("F1b settings content in a11y tree", _has_settings_content(xml))
    errors = d.shell("logcat -d | grep -c 'console:.*[Ee]rror' || true").strip()
    check("F2 no settings-page JS errors", errors in ("0", ""), f"count={errors}")

    print("== F3/F4: first keyboard show ==")
    d.shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    d.prepare()
    kb = d.fresh_kb()
    check("F3a keyboard geometry visible", bool(kb))
    # KEYBOARD_VERSION lives inside the keyboard.js closure - assert the
    # served DOM by 3.21.0-only elements (same as the upgrade smoke).
    served_new = bool(d.devtools_eval(
        "!!document.getElementById('heightTrack') || !!document.getElementById('phraseCard')"))
    check("F3b served keyboard is the new version (DOM form)", served_new)
    bar = d.devtools_eval("!!document.getElementById('candidates')")
    check("F3c keyboard DOM alive (candidates bar)", bool(bar))
    if kb:
        d.switch_mode(kb, "全拼 Pinyin")
        typed = d.type_word_verified(kb, "nihao", r"^nihao$")
        cands = d.devtools_candidates()
        check("F4a pinyin preedit composes", bool(typed))
        check("F4b candidates render", any("你" in c for c in cands), repr(cands[:3]))
        d.clear_engine_buffer(kb)

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n== first-launch smoke: {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("failures:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
