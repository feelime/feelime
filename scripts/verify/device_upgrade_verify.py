#!/usr/bin/env python3
"""Upgrade-path smoke (see docs/testing/verification.md): reproduce the released user path
path - install an older APK, hot-update its keyboard (the stale
active pointer), then OVERWRITE-install the new APK without clearing data -
and assert the fresh built-in keyboard actually serves:

  U1 the stale hot-update pointer no longer shadows the APK keyboard
  U2 the served keyboard is the new version and the handshake completes
  U3 pinyin composes and candidates render (the "cannot type" symptom)
  U4 the settings page renders its content and the debug fixtures stay
     collapsed behind their toggle

Env: FEELIME_ADB_SERIAL, FEELIME_OLD_APK (released 0.16.0), FEELIME_NEW_APK
(the build under test), FEELIME_KB_ZIP (signed-or-unsigned keyboard zip the
old APK accepts, default: the committed 3.20.0 unsigned zip in test-fixtures/).
"""
import os
import re
import subprocess
import sys
import time

import device_verify as d

SERIAL = os.environ.get("FEELIME_ADB_SERIAL", "")
OLD_APK = os.environ.get("FEELIME_OLD_APK", "")
NEW_APK = os.environ.get("FEELIME_NEW_APK", "")
# The stale hot-update package the old APK installs: the committed 3.20.0
# unsigned zip (old envelope format on purpose - it simulates an update from
# the 0.16.0 era; debug builds accept unsigned packages).
KB_ZIP = os.environ.get(
    "FEELIME_KB_ZIP",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 os.pardir, "test-fixtures", "feelime-keyboard-3.20.0-unsigned.zip"),
)
PKG = d.PKG
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {detail}" if detail else ""))


def run(cmd, timeout=300):
    result = subprocess.run(cmd, capture_output=True, timeout=timeout)
    out = result.stdout.decode("utf-8", "replace")
    if not out.strip():
        print("  [run stderr]", result.stderr.decode("utf-8", "replace").strip()[-200:] or "(empty)")
    return out


def run_as(cmd, timeout=30):
    return d.shell(f"run-as {PKG} sh -c {cmd!r}", timeout=timeout)


def active_pointer():
    out = run_as("cat files/keyboard/active.json 2>/dev/null")
    m = re.search(r'"active"\s*:\s*"([^"]*)"', out)
    return m.group(1) if m else None


def pref(key):
    out = run_as("cat shared_prefs/keyboard_update.xml 2>/dev/null")
    # <string name="k">VALUE</string> (and the value="" attribute form)
    m = re.search(rf'name="{key}"[^>]*>([^<]*)<', out) or \
        re.search(rf'name="{key}"[^>]*value="([^"]*)"', out)
    return m.group(1) if m else None


def install(apk, extra=""):
    out = run(["adb", "-s", SERIAL, "install", extra, "-r", apk])
    if "Success" not in out:
        raise SystemExit(f"install failed: {apk}\n{out}")


def main():
    if not SERIAL or not OLD_APK or not NEW_APK:
        raise SystemExit("FEELIME_ADB_SERIAL / FEELIME_OLD_APK / FEELIME_NEW_APK are required")
    if not os.path.isfile(KB_ZIP):
        raise SystemExit(f"FEELIME_KB_ZIP not found: {KB_ZIP}")
    for label, apk in (("old", OLD_APK), ("new", NEW_APK)):
        print(f"-- {label} apk: {os.path.basename(apk)}")

    print("== phase 1: clean 0.16.0 install ==")
    run(["adb", "-s", SERIAL, "uninstall", PKG])
    install(OLD_APK)
    d.shell(f"pm grant {PKG} android.permission.RECORD_AUDIO")
    d.shell(f"am force-stop {PKG}")
    # Right after install -r the package manager can be mid-registration:
    # push-keyboard's pm-path probe would bail out silently. Let it settle.
    time.sleep(4.0)

    print("== phase 2: hot-update the keyboard (stale pointer) ==")
    push = os.path.join(os.path.dirname(__file__), "..", "push-keyboard.sh")
    out = ""
    for attempt in range(3):
        out = run(["bash", push, KB_ZIP, SERIAL], timeout=120)
        if "install requested" in out:
            break
        print(f"  [push retry {attempt}] {out.strip()[-120:]!r}")
        time.sleep(3.0)
    print(out.strip().splitlines()[-1] if out.strip() else "(no output)")
    # Activity startup and the asynchronous install can exceed a fixed delay
    # on a cold emulator. Verify the prerequisite before testing the upgrade.
    deadline = time.monotonic() + 45
    active = None
    source_type = None
    while time.monotonic() < deadline:
        active = active_pointer()
        source_type = pref("source_type")
        if active and source_type == "ACTIVE_VERSION":
            break
        time.sleep(1)
    check("U0a hot-update installed (active pointer set)", bool(active), f"active={active!r}")
    check("U0b source type is the hot-update", source_type == "ACTIVE_VERSION",
          f"source_type={source_type!r}")
    if not active or source_type != "ACTIVE_VERSION":
        print(d.shell("logcat -d -t 150 | tail -80"))
        raise SystemExit("old hot-update setup failed; upgrade has not been tested")

    print("== phase 3: overwrite-install the new APK (data kept) ==")
    d.shell(f"am force-stop {PKG}")
    install(NEW_APK)
    d.shell(f"pm grant {PKG} android.permission.RECORD_AUDIO")
    # A fresh install's IME component starts DISABLED (enabled=0): without
    # the explicit enable the default falls back to another IME and the keyboard
    # never shows - exactly the "IME dead" symptom. Enable + select.
    d.shell(f"ime enable {PKG}/com.feelime.ime.FeelimeService")
    d.shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    d.shell(f"am force-stop {PKG}")
    time.sleep(1.0)

    print("== phase 4: the fresh keyboard serves ==")
    d.prepare()
    kb = d.fresh_kb()
    check("U2a keyboard geometry visible", bool(kb))
    # KEYBOARD_VERSION lives inside the keyboard.js closure - assert the
    # served DOM by 3.21.0-only elements instead (heightTrack: the ±/slider
    # height card; phraseCard: the floating editor card).
    served_new = bool(d.devtools_eval(
        "!!document.getElementById('heightTrack') || !!document.getElementById('phraseCard')"))
    new_ver = os.popen(
        f"unzip -p '{NEW_APK}' assets/keyboard/VERSION 2>/dev/null").read().strip()
    if not new_ver:
        raise SystemExit(f"cannot read assets/keyboard/VERSION from {NEW_APK}")
    builtin = run_as("cat files/keyboard/built-in/VERSION 2>/dev/null").strip()
    # The goal is BEHAVIOR: the stale hot-update must not be served. Either
    # the pointer was cleared, or (the current path) loadVersion rejects
    # the v1 keyboard at resolve() and the freshly seeded built-in serves -
    # visible as the 3.21.0 DOM plus the reseeded built-in copy.
    check("U1 stale hot-update not served", served_new and builtin == new_ver,
          f"active={active_pointer()!r} built-in={builtin!r} served-new-dom={served_new}")
    check("U2b served keyboard is the new version (DOM form)", served_new)
    bar = d.devtools_eval("!!document.getElementById('candidates')")
    check("U2c keyboard DOM alive (candidates bar)", bool(bar))

    # U3: the "pinyin cannot type" symptom.
    d.switch_mode(kb, "全拼 Pinyin") if kb else None
    typed = d.type_word_verified(kb, "nihao", r"^nihao$") if kb else False
    cands = d.devtools_candidates() if kb else []
    check("U3a pinyin preedit composes", bool(typed))
    check("U3b candidates render", any("你" in c for c in cands), repr(cands[:3]))
    d.clear_engine_buffer(kb) if kb else None

    print("== phase 5: settings page (render, fixtures collapsed) ==")
    d.ensure_keyboard_down()
    # Phase 4 legitimately EXPANDED the fixtures (prepare locates the test
    # field through the toggle). the default-collapsed claim needs a FRESH
    # activity instance that nothing has expanded yet.
    d.shell(f"logcat -c")
    d.shell(f"am force-stop {PKG}")
    time.sleep(1.0)
    d.shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    d.shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity")
    time.sleep(3.0)
    xml = d.ui_dump()
    rendered = d.devtools_eval_target(
        "settings/index.html",
        "!!window.FeelimeSettings ? String(document.body.innerText.length) : 'no-bridge'") or ""
    check("U4a settings page renders content",
          rendered.isdigit() and int(rendered) > 50, f"innerText={rendered!r}")
    check("U4b debug fixtures absent without the extra ",
          'content-desc="feelime-test-input"' not in xml)
    console_errors = d.shell(
        "logcat -d | grep -c 'console:.*[Ee]rror' || true").strip()
    check("U4c no settings-page JS errors", console_errors in ("0", ""), f"count={console_errors}")

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n== upgrade smoke: {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("failures:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
