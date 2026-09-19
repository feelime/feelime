#!/usr/bin/env python3
"""Grant RECORD_AUDIO via the feelime wizard (ColorOS refuses `adb pm grant`
and `appops set`): flip default IME away so the
wizard reappears, tap its grant button, accept the system dialog, restore."""
import os
import re
import subprocess
import sys
import time

SERIAL = os.environ.get("FEELIME_ADB_SERIAL", os.environ.get("ANDROID_SERIAL", ""))

# debug 构建包名带 .dev 后缀（与正式包共存）：显式 FEELIME_PKG >
# 设备装了 .dev 用 .dev > 正式包名（与 device_verify._resolve_pkg 同规）。
def _resolve_pkg():
    explicit = os.environ.get("FEELIME_PKG", "").strip()
    if explicit:
        return explicit
    out = sh("pm list packages")
    return "com.feelime.ime.dev" if "package:com.feelime.ime.dev\n" in out else "com.feelime.ime"


PKG = _resolve_pkg()
if not SERIAL:
    raise SystemExit("set FEELIME_ADB_SERIAL (adb serial of the test device)")


def sh(cmd):
    return subprocess.run(["adb", "-s", SERIAL] + cmd.split(), capture_output=True, text=True).stdout


def dump():
    sh("uiautomator dump /sdcard/g.xml")
    return sh("cat /sdcard/g.xml")


def tap_text(xml, needles):
    for needle in needles:
        for m in re.finditer(r'text="([^"]*' + needle + r'[^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
            x = (int(m.group(2)) + int(m.group(4))) // 2
            y = (int(m.group(3)) + int(m.group(5))) // 2
            print(f"tap {m.group(1)!r} at ({x},{y})")
            sh(f"input tap {x} {y}")
            time.sleep(1.5)
            return True
    return False


sh(f"am force-stop {PKG}")
sh("ime set com.sohu.inputmethod.sogou/.SogouIME")
sh(f"am start -n {PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
time.sleep(2.5)
xml = dump()
if "授予麦克风权限" not in xml:
    print("wizard grant button not visible, dump head:", xml[:400])
    sys.exit(1)
if not tap_text(xml, ["授予麦克风权限"]):
    sys.exit(1)
time.sleep(1.0)
xml = dump()
if not tap_text(xml, ["仅在使用中允许", "使用应用时允许", "允许", "While using", "Allow"]):
    print("allow button not found, dump head:", xml[:400])
    sys.exit(1)
time.sleep(1.0)
sh(f"ime set {PKG}/com.feelime.ime.FeelimeService")
out = sh("dumpsys package com.feelime.ime")
granted = re.search(r"RECORD_AUDIO: granted=(\w+)", out)
print("RECORD_AUDIO granted =", granted.group(1) if granted else "unknown")
sys.exit(0 if granted and granted.group(1) == "true" else 1)
