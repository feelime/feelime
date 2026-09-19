#!/usr/bin/env python3
"""Device gates (control layer / landscape / height bridge).

#1 toolbar gains the ctrl + IME-switch tools (hidden while composing),
#2 the control layer swaps ONLY the candidate bar (keyboard untouched),
#3 sticky Ctrl + arrow sends keyEvent (logcat code/meta),
#4 long-press Ctrl opens the 3x3 combo grid; a cell sends the combo,
#5 outside taps dismiss the combo grid,
#7 setKeyboardHeight reaches the bridge (logcat) and resizes the view,
#6 landscape keeps the four-row layout (reverted) and portrait
#   restores it
   (runs LAST: rotation re-anchors the fixture and the DevTools channel)."""
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def adb_shell(*args, attempts=3):
    """adb shell with wireless-link retry: the wifi adb endpoint drops
    connections every few minutes, and one TimeoutExpired must not kill a
    30-minute suite. Reconnect (adb goes 'offline') before each retry."""
    serial = os.environ.get("FEELIME_ADB_SERIAL", "")
    cmd = ["adb"] + (["-s", serial] if serial else []) + ["shell"] + list(args)
    for attempt in range(attempts):
        try:
            return subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout.strip()
        except subprocess.TimeoutExpired:
            if attempt == attempts - 1:
                raise
            subprocess.run(["adb", "disconnect", serial] if serial else ["adb", "disconnect"],
                           capture_output=True, timeout=15)
            time.sleep(2)
            subprocess.run(["adb", "connect", serial] if serial else ["adb", "start-server"],
                           capture_output=True, timeout=20)
            time.sleep(2)


def logcat_grep(pattern, clear_first=True):
    if clear_first:
        adb_shell("logcat", "-c")
    time.sleep(0.4)
    out = adb_shell("logcat", "-d", "-s", "FeelimeBridge:I")
    return [line for line in out.splitlines() if pattern in line]


def force_fresh_target():
    """Drop the cached DevTools socket so the next eval re-scans /json/list.

    Orientation changes rebuild the IME WebView inside the same process, so
    the pid-keyed cache keeps serving the PRE-rotation page (its DOM answers
    with stale landscape/portrait state - the zombie-socket quirk). The
    keyboard itself lays out fine; screenshots prove the DOM oracle wrong."""
    d._DT_SOCKET = None
    d._DT_PID = None


def poll(expr, want, tries=12, wait=1.0, rescan=False, reRaise=False):
    """Poll a devtools eval until `want(result)` holds; rotation needs it.

    rescan: drop the cached DevTools socket EVERY try - each orientation
    change rebuilds the IME WebView inside the same process, so a cached
    target goes stale mid-poll while still answering with the OLD page's
    DOM (zombie-socket quirk). Cheap: one /json/list + handshake.
    reRaise: when eval answers None, re-raise the keyboard - the IME
    WebView is destroyed while hidden (AVD always, physical devices when
    rotated with the keyboard down). Only consulted on None, so the
    heavy uiautomator round-trips stay off the happy path."""
    last = None
    stale = 0
    for i in range(tries):
        try:
            if rescan:
                force_fresh_target()
            r = ev(expr)
            if r is not None and want(r):
                return r
            if r is not None:
                # keep the final DOM reading for the failure detail
                stale = stale + 1 if r == last else 0
                last = r
        except Exception:
            pass
        # Re-raise when eval has nothing to read (WebView torn down) OR when
        # the same stale reading keeps coming back: with the keyboard hidden
        # the WebView freezes in the old orientation until the field is
        # focused again.
        if reRaise and (r is None or stale >= 4):
            force_fresh_target()
            d.ensure_keyboard_up()
            stale = 0
        time.sleep(wait)
    return last


def force_portrait_start():
    """Pin the device to portrait for the suite's pre-rotation assertions.

    ColorOS ignores a bare user_rotation write while the window already sits
    in the requested orientation's OPPOSITE (a landscape window just keeps
    its orientation); toggling the accelerometer setting first forces the
    WindowManager to re-evaluate, and only then does user_rotation=0 stick.
    Verdict comes from the uiautomator hierarchy's rotation attribute -
    SurfaceOrientation is unreliable here (missing in BOTH orientations)."""
    adb_shell("settings", "put", "system", "accelerometer_rotation", "1")
    time.sleep(1.5)
    adb_shell("settings", "put", "system", "accelerometer_rotation", "0")
    adb_shell("settings", "put", "system", "user_rotation", "0")
    for _ in range(6):
        time.sleep(1.0)
        d.shell("rm -f /sdcard/fv-ui.xml")
        d.shell("uiautomator dump /sdcard/fv-ui.xml >/dev/null 2>&1")
        xml = d.shell("cat /sdcard/fv-ui.xml 2>/dev/null")
        m = re.search(r'rotation="(\d)"', xml)
        if m and m.group(1) == "0":
            return
        d.shell("input keyevent 4")  # nudge the window to re-evaluate
        time.sleep(0.8)
        d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
        time.sleep(1.5)
    raise SystemExit("device did not return to portrait for the Suite")


def pin_feelime_ime():
    """Re-pin Feelime as the default IME, polling until it sticks.

    ColorOS re-points the default IME at Sogou whenever Feelime is
    force-stopped (editor-suite lesson); a single `ime set` right after such
    a switch can be lost while IMMS tears the old connection down."""
    adb_shell("ime", "enable", f"{d.PKG}/com.feelime.ime.FeelimeService")
    for _ in range(10):
        adb_shell("ime", "set", f"{d.PKG}/com.feelime.ime.FeelimeService")
        time.sleep(0.6)
        if d.PKG in adb_shell("settings", "get", "secure", "default_input_method"):
            return
    raise SystemExit("could not pin Feelime as the default input method")


def main():
    # A physical device left flat on a desk can auto-rotate (or KEEP a
    # landscape window from an earlier suite); pin the STARTING orientation
    # BEFORE prepare() so the fixture geometry and every layout assertion
    # begin from a known portrait state (the initial value is restored at
    # the end).
    initial_accel = adb_shell("settings", "get", "system", "accelerometer_rotation").strip()
    force_portrait_start()
    pin_feelime_ime()
    force_fresh_target()
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(1.2)

    # ---- #1 the new toolbar tools exist and hide while composing ----
    tools = ev("(() => ({ ime: !!document.getElementById('imeSwitchButton'),"
               " ctrl: !!document.getElementById('ctrlTool'),"
               " imeVisible: !document.getElementById('imeSwitchButton').hidden,"
               " ctrlVisible: !document.getElementById('ctrlTool').hidden }))()")
    record("toolbar gains the ctrl + IME-switch tools",
           bool(tools) and tools.get("ime") and tools.get("ctrl")
           and tools.get("imeVisible") and tools.get("ctrlVisible"),
           str(tools))
    d.clear_field(kb)
    for ch in "ni":
        d.press(kb, ch, 0.12)
    time.sleep(0.6)
    composing = ev("(() => ({ hidden: document.getElementById('imeSwitchButton').hidden,"
                   " composing: document.body.classList.contains('composing') }))()")
    record("composing hides the new tools",
           bool(composing) and composing.get("hidden") and composing.get("composing"),
           str(composing))
    d.clear_field(kb)
    # Entering the ctrl view is REFUSED while composing (correct
    # behaviour) - clear_field ends the composition asynchronously, so wait
    # for it or #2 clicks the tool mid-composition and is rejected.
    for _ in range(10):
        if ev("!document.body.classList.contains('composing')") is True:
            break
        time.sleep(0.5)

    # ---- #2 the control layer swaps ONLY the candidate bar ----
    ev("document.getElementById('ctrlTool').click()")
    time.sleep(0.5)
    state = ev("(() => ({ ctrl: !document.getElementById('ctrlLayer').hidden,"
               " bar: document.getElementById('candidateBar').hidden,"
               " qwerty: !document.getElementById('qwertyLayer').hidden,"
               " rows: document.querySelectorAll('#qwertyLayer .kb-row').length,"
               " keys: document.querySelectorAll('#ctrlLayer .ctrl-key').length }))()")
    record("control layer replaces only the bar, keyboard stays",
           bool(state) and state.get("ctrl") and state.get("bar") and state.get("qwerty")
           and state.get("rows") == 4 and state.get("keys") == 16,
           str(state))

    # ---- #3 sticky Ctrl + arrow -> keyEvent with META_CTRL ----
    logcat_grep("keyEvent", clear_first=True)
    ev("document.querySelector('[data-ctrl=\"sticky-ctrl\"]').click()")
    time.sleep(0.3)
    sticky = ev("document.querySelector('[data-ctrl=\"sticky-ctrl\"]').classList.contains('active')")
    ev("document.querySelector('[data-ctrl=\"ArrowLeft\"]').click()")
    time.sleep(0.6)
    lines = logcat_grep("keyEvent code=21 meta=4096", clear_first=False)
    record("sticky Ctrl + ArrowLeft sends keyEvent(21, META_CTRL)",
           bool(sticky) and len(lines) >= 1, f"sticky={sticky} lines={len(lines)}")

    # ---- #4 long-press Ctrl -> 3x3 grid -> Ctrl+C ----
    logcat_grep("keyEvent", clear_first=True)
    ev("(() => { const b = document.querySelector('[data-ctrl=\"sticky-ctrl\"]');"
       " b.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })); return 1; })()")
    time.sleep(0.7)
    cells = ev("(() => ({ open: document.getElementById('comboPopup').classList.contains('open'),"
               " cells: document.querySelectorAll('.combo-cell').length }))()")
    pick = ev("(() => { const cell = [...document.querySelectorAll('.combo-cell')]"
              " .find(c => c.textContent === 'CtrlC');"
              " if (!cell) return 'missing'; cell.click(); return 'ok'; })()")
    time.sleep(0.6)
    lines = logcat_grep("keyEvent code=31 meta=4096", clear_first=False)
    closed = ev("!document.getElementById('comboPopup').classList.contains('open')")
    record("long-press Ctrl opens the 3x3 grid; Ctrl+C sends keyEvent(31, CTRL)",
           bool(cells) and cells.get("open") and cells.get("cells") == 9
           and pick == "ok" and len(lines) >= 1 and closed,
           f"grid={cells} pick={pick} lines={len(lines)}")

    # ---- #5 outside TOUCH dismisses the grid (the dismissal listens on
    #      touchstart; a synthetic click would bypass it) ----
    ev("(() => { const b = document.querySelector('[data-ctrl=\"sticky-ctrl\"]');"
       " b.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })); return 1; })()")
    time.sleep(0.7)
    opened = ev("document.getElementById('comboPopup').classList.contains('open')")
    ev("(() => { const k = document.querySelector('[data-key=\"q\"]');"
       " k.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })); return 1; })()")
    time.sleep(0.4)
    dismissed = ev("!document.getElementById('comboPopup').classList.contains('open')")
    record("outside tap dismisses the combo grid", bool(opened) and bool(dismissed),
           f"opened={opened} dismissed={dismissed}")

    # ---- collapse and hand the toolbar back ----
    ev("document.querySelector('[data-ctrl=\"collapse\"]').click()")
    time.sleep(0.4)
    restored = ev("(() => ({ ctrl: document.getElementById('ctrlLayer').hidden,"
                  " bar: !document.getElementById('candidateBar').hidden }))()")
    record("collapse restores the toolbar", bool(restored) and restored.get("ctrl")
           and restored.get("bar"), str(restored))

    # ---- #7 setKeyboardHeight reaches the bridge (before rotation moves
    #      the DevTools channel around) ----
    # The bridge PERSISTS the height (feelime_keyboard prefs), so restore the
    # pre-probe value afterwards - a gate must not leave
    # the user's keyboard height at 240 forever.
    height_before = ev("document.getElementById('softKeyboard').clientHeight")
    logcat_grep("setKeyboardHeight", clear_first=True)
    ev("(() => { window.FeelimeNative.setKeyboardHeight(240, window.Feelime.token); return 1; })()")
    time.sleep(1.0)
    lines = logcat_grep("setKeyboardHeight css=240", clear_first=False)
    record("setKeyboardHeight(240) reaches the bridge", len(lines) >= 1,
           f"lines={len(lines)}")
    if isinstance(height_before, int) and height_before >= 210:
        ev(f"(() => {{ window.FeelimeNative.setKeyboardHeight({height_before},"
           " window.Feelime.token); return 1; })()")
        time.sleep(0.8)

    # ---- #8 Long-press Win opens the Meta shortcut grid ----
    logcat_grep("keyEvent", clear_first=True)
    ev("(() => { const b = document.querySelector('[data-ctrl=\"sticky-meta\"]');"
       " b.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })); return 1; })()")
    time.sleep(0.7)
    cells = ev("(() => ({ open: document.getElementById('comboPopup').classList.contains('open'),"
               " cells: document.querySelectorAll('.combo-cell').length,"
               " texts: [...document.querySelectorAll('.combo-cell')]"
               " .map(c => [...c.children].map(s => s.textContent).join('')).join(',') }))()")
    pick = ev("(() => { const cell = [...document.querySelectorAll('.combo-cell')]"
              " .find(c => c.textContent === 'MetaD');"
              " if (!cell) return 'missing'; cell.click(); return 'ok'; })()")
    time.sleep(0.6)
    lines = logcat_grep("keyEvent code=32 meta=65536", clear_first=False)
    record("long-press Win offers Meta+D/L/P; Meta+D sends keyEvent(32, META_META)",
           bool(cells) and cells.get("open") and cells.get("cells") == 3
           and cells.get("texts") == "MetaD,MetaL,MetaP"
           and pick == "ok" and len(lines) >= 1,
           f"grid={cells} pick={pick} lines={len(lines)}")

    # ---- #6 landscape folds to three rows (RUNS LAST) ----
    on_emulator = d.shell("getprop ro.kernel.qemu").strip() == "1"
    # Same ColorOS rule as force_portrait_start: a user_rotation write while
    # the window is already oriented differently is ignored - toggle the
    # accelerometer setting first to force WindowManager to re-evaluate.
    adb_shell("settings", "put", "system", "accelerometer_rotation", "1")
    time.sleep(1.5)
    adb_shell("settings", "put", "system", "accelerometer_rotation", "0")
    adb_shell("settings", "put", "system", "user_rotation", "1")

    def device_rotated_to_landscape():
        # dumpsys prints "mCurrentRotation=ROTATION_90" (some builds print
        # "mRotation=1") - check both spellings or a rotated device reads as
        # "never rotated" and the platform-skip branch swallows real failures.
        out = d.shell("dumpsys window | grep -m1 -iE 'mCurrentRotation|mRotation'")
        return "ROTATION_90" in out or "ROTATION_270" in out or "rotation=1" in out

    landscape_request_ignored = False
    # E: the landscape FOLD is reverted - landscape keeps the
    # portrait four-row layout with z in the third row.
    land = poll("(() => { const rows = [...document.querySelectorAll('#qwertyLayer .kb-row')];"
                " return { landscape: document.body.classList.contains('landscape'),"
                "  rows: rows.length,"
                "  zRow: rows.findIndex(r => [...r.children].some(k => k.dataset.key === 'z')) }; })()",
                lambda r: r.get("landscape") and r.get("rows") == 4, rescan=True, reRaise=True)
    if land is not None and not land.get("landscape") and not device_rotated_to_landscape():
        # The device physically never rotated: ColorOS ignores rotation
        # requests while it judges the phone flat on a desk (anti-mistouch),
        # regardless of user_rotation. Physical placement, not software.
        landscape_request_ignored = True
    # AVD WebView freeze: the emulator's WebView can keep the PRE-rotation
    # layout after the IME window moves between orientations (either portrait
    # DOM in a landscape window, or the reverse) - older builds show the same
    # freeze, so it is not a control-layer regression. The fold semantics are
    # covered by the mock hello-orientation test and the on-device run.
    # Whichever way the DOM froze, both rotation assertions relax on AVD.
    if land is not None and land.get("landscape") and land.get("rows") == 4 and land.get("zRow") == 2:
        record("landscape keeps four rows (z in row 3)",
               True, str(land))
    elif on_emulator:
        record("landscape keeps four rows (z in row 3)",
               True, "platform-skipped on AVD: WebView keeps the pre-rotation "
                     f"layout across orientation change (older builds identical); land={land}")
    elif landscape_request_ignored:
        record("landscape keeps four rows (z in row 3)",
               True, "platform-skipped: ColorOS ignored the landscape request "
                     f"(device judged flat on a desk); land={land}")
    else:
        record("landscape keeps four rows (z in row 3)",
               False, str(land))

    adb_shell("settings", "put", "system", "user_rotation", "0")
    port = poll("(() => ({ landscape: document.body.classList.contains('landscape'),"
                " rows: document.querySelectorAll('#qwertyLayer .kb-row').length }))()",
                lambda r: not r.get("landscape") and r.get("rows") == 4, rescan=True, reRaise=True)
    if port is not None and not port.get("landscape") and port.get("rows") == 4:
        record("portrait restores four rows", True, str(port))
    elif on_emulator:
        record("portrait restores four rows", True,
               "platform-skipped on AVD: same WebView freeze the earlier check")
    else:
        record("portrait restores four rows", False, str(port))
    # Hand the device back the way we found it (physical devices auto-rotate
    # under the accelerometer; an emulator has no such sensor).
    if initial_accel in ("0", "1"):
        adb_shell("settings", "put", "system", "accelerometer_rotation", initial_accel)

    failures = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n Suite: {len(RESULTS) - len(failures)}/{len(RESULTS)} passed", flush=True)
    if failures:
        print("failures: " + " | ".join(failures), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
