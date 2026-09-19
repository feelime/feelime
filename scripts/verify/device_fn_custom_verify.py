#!/usr/bin/env python3
"""Device gates (Fn keys / combo band / custom JSON / toolbar / voice).

#1  Fn sticky: Q..P/K/L relabel to F1..F12 and send F-keycodes (Q = F1 =
    131, Ctrl+R = Ctrl+F4 = 134 - the old F4 entry was the bogus 131/F1
    that the native whitelist rejected, so Alt+F4 never fired).
#2  Fn long-press opens the former Comb grid; the anchor tap only closes.
#5  a tap on the trigger key while its popup is open only closes it (Fn
    grid AND the mode menu; the toggle must not switch keyboards).
#6  English j/k/l alt-texts are the half-width ~ " ' set.
#7  the custom symbol table is pasted JSON: a saved table renders as three
    scrollable strips, an invalid paste names the error instead of saving.
#8  landscape keeps the WebView and its bottom controls above the actual
    system navigation area; --safe-bottom may be zero when there is no overlap.
#9  the float band rides hello (--band > 0) and band popups flip the
    native touch region (logcat `setOverlayOpen`).
#10 landscape toolbar grew (40px bar below the 14px preedit line) and the
    ctrl rows take real keys again (27px).
#11 the voice overlay shows the 20px mic icon (no red dot) and fits the
    keyboard area in landscape.
#12 hiding and re-showing the IME lands on the letters layer.

RDP end-to-end (Alt+F4 kills a remote notepad, Win+D shows the remote
desktop) is verified against the user's test host separately."""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d

RESULTS = []
SKIPPED = []

STATE_JS = ("(() => ({ qwertyHidden: document.getElementById('qwertyLayer').hidden,"
            " symbolHidden: document.getElementById('symbolLayer').hidden,"
            " ctrlHidden: document.getElementById('ctrlLayer').hidden,"
            " ctrlView: document.body.classList.contains('ctrl-view'),"
            " band: getComputedStyle(document.documentElement).getPropertyValue('--band'),"
            " fnActive: (document.querySelector('[data-ctrl=\\\"sticky-fn\\\"]')||{classList:{contains:()=>false}}).classList.contains('active'),"
            " qMain: (document.querySelector('[data-key=\\\"q\\\"] .kb-main')||{}).textContent,"
            " qAlt: (document.querySelector('[data-key=\\\"q\\\"] .kb-alt')||{}).textContent,"
            " aMain: (document.querySelector('[data-key=\\\"a\\\"] .kb-main')||{}).textContent,"
            " menuOpen: document.getElementById('modeMenu').classList.contains('open'),"
            " comboOpen: document.getElementById('comboPopup').classList.contains('open'),"
            " comboCells: document.querySelectorAll('.combo-cell').length,"
            " jAlt: (document.querySelector('[data-key=\\\"j\\\"] .kb-alt')||{}).textContent,"
            " kAlt: (document.querySelector('[data-key=\\\"k\\\"] .kb-alt')||{}).textContent,"
            " lAlt: (document.querySelector('[data-key=\\\"l\\\"] .kb-alt')||{}).textContent }))()")


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def skip(name, detail):
    """Record an unavailable platform condition without counting it as pass."""
    SKIPPED.append((name, detail))
    print(f"SKIP {name}  [{detail}]", flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def state():
    return ev(STATE_JS)


def keyevent_logs():
    out = subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-d", "-s", "FeelimeBridge:I"],
                         capture_output=True, text=True, timeout=60).stdout
    return [l.split("FeelimeBridge:")[-1].strip() for l in out.splitlines()
            if "keyEvent" in l or "setOverlayOpen" in l]


def click(sel):
    ok = ev("(() => { const k = document.querySelector('" + sel + "');"
            " if (!k) return 'no'; k.click(); return 'ok'; })()")
    if ok != "ok":
        raise RuntimeError(f"click failed on {sel!r}")
    time.sleep(0.5)


def synth_tap(sel, hold_ms=90):
    """A real-shaped tap: touchstart + touchend so capture listeners and the
    bindTouch click-delivery path both run (a bare .click() skips them)."""
    js = ("(() => { const k = document.querySelector('" + sel + "');"
          " if (!k || typeof Touch === 'undefined') return 'no';"
          " const r = k.getBoundingClientRect();"
          " const x = r.left + r.width / 2, y = r.top + r.height / 2;"
          " const t = new Touch({identifier: 2, target: k, clientX: x, clientY: y});"
          " const mk = type => new TouchEvent(type, {cancelable: true, bubbles: true,"
          "   touches: type === 'touchend' ? [] : [t], changedTouches: [t]});"
          " k.dispatchEvent(mk('touchstart'));"
          " setTimeout(() => k.dispatchEvent(mk('touchend')), " + str(int(hold_ms)) + ");"
          " return 'ok'; })()")
    if ev(js) != "ok":
        raise RuntimeError(f"tap failed on {sel!r}")
    time.sleep(0.5)


def long_press(sel, hold_s=0.55):
    js = ("(() => { const k = document.querySelector('" + sel + "');"
          " if (!k || typeof Touch === 'undefined') return 'no';"
          " const r = k.getBoundingClientRect();"
          " const x = r.left + r.width / 2, y = r.top + r.height / 2;"
          " const t = new Touch({identifier: 1, target: k, clientX: x, clientY: y});"
          " const mk = type => new TouchEvent(type, {cancelable: true, bubbles: true,"
          "   touches: type === 'touchend' ? [] : [t], changedTouches: [t]});"
          " k.dispatchEvent(mk('touchstart'));"
          " setTimeout(() => k.dispatchEvent(mk('touchend')), " + str(int(hold_s * 1000)) + ");"
          " return 'ok'; })()")
    if ev(js) != "ok":
        raise RuntimeError(f"long-press failed on {sel!r}")
    time.sleep(hold_s + 0.5)


def key_by_label(label):
    return ev("(() => { const k = [...document.querySelectorAll('.kb-key')]"
              "   .find(el => el.textContent === '" + label + "');"
              " if (!k) return 'no'; k.click(); return 'ok'; })()")


# ---------------------------------------------------------------- rotation

def refocus_field():
    """Scroll the SetupActivity test field into view with COORDINATES THAT
    MATCH THE CURRENT ROTATION and tap it (the first AVD rounds wedged here:
    prepare's portrait swipe never reaches the field on a 2400x1080 rotation,
    so the IME never came back up)."""
    size = display_size()
    if not size:
        raise RuntimeError("display size unavailable for editor focus")
    w, h = size
    if w > h:  # landscape: swipe along the shorter edge
        sx, sy, ex, ey = w // 2, int(h * 0.85), w // 2, int(h * 0.15)
    else:
        sx, sy, ex, ey = w // 2, int(h * 0.73), w // 2, int(h * 0.27)
    for attempt in range(8):
        bounds = d.field_bounds()
        # uiautomator also lists OFF-SCREEN nodes with their virtual bounds -
        # tapping those lands nowhere, so require the centre to be on-screen.
        if bounds and 0 <= (bounds[1] + bounds[3]) // 2 < h and 0 <= (bounds[0] + bounds[2]) // 2 < w:
            d.tap((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2, wait=1.2)
            return True
        # This scroll targets the native settings host, not the keyboard
        # WebView; a synthesized keyboard touch cannot move this page.
        d.shell(f"input swipe {sx} {sy} {ex} {ey} 220")
        time.sleep(0.6)
    return False


def set_orientation(landscape):
    # Lock through WindowManager in one operation. Toggling the two settings
    # separately races the asynchronous sensor update on some AVDs.
    # This AVD additionally FREEZES the running activity in
    # its pre-rotation layout (bounds stay portrait on a landscape screen -
    # the keyboard can never refocus), so SetupActivity is relaunched after
    # the flip and re-pinned as the IME's host.
    result = d.shell("wm user-rotation lock " + ("1" if landscape else "0"))
    if "Error" in result or "Unknown command" in result:
        raise RuntimeError("cannot lock display rotation: " + result)
    time.sleep(1.8)
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(0.8)
    d.shell(f"ime enable {d.PKG}/com.feelime.ime.FeelimeService")
    d.shell(f"ime set {d.PKG}/com.feelime.ime.FeelimeService")
    d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(2.2)
    if not refocus_field():
        raise RuntimeError("rotated settings editor could not be focused")
    global KB
    KB = d.fresh_kb(refocus=True) or KB
    time.sleep(0.8)


def device_is_landscape():
    return parse_rotation(d.shell("dumpsys window displays")) in (1, 3)


def parse_rotation(text):
    """Parse the display service's current rotation without window overrides.

    ``dumpsys window`` also prints activity configuration fields named
    ``mRotation``.  Those fields can be stale while the display has already
    rotated, so the display dump is parsed line-by-line and its explicit
    ``mCurrentRotation`` field always wins over the legacy numeric spelling.
    """
    current = []
    numeric = []
    for line in str(text or "").splitlines():
        match = re.fullmatch(
            r"\s*mCurrentRotation\s*=\s*ROTATION_(0|90|180|270)"
            r"(?:\s+.*)?\s*", line,
        )
        if match:
            current.append({"0": 0, "90": 1, "180": 2, "270": 3}[match.group(1)])
            continue
        # Some Android builds append fields to this legacy line, for example
        # ``mRotation=0 mDeferredRotationPauseCount=0``.  Keep the field name
        # anchored at the beginning so ``overrideConfig={mRotation=...}``
        # cannot masquerade as the display rotation.
        match = re.fullmatch(r"\s*mRotation\s*=\s*([0-3])(?:\s+.*)?\s*", line)
        if match:
            numeric.append(int(match.group(1)))
    current_values = set(current)
    numeric_values = set(numeric)
    if len(current_values) > 1:
        raise RuntimeError(
            "dumpsys window displays has conflicting mCurrentRotation values: "
            + repr(sorted(current_values))
        )
    if current_values:
        # mCurrentRotation is the display service's explicit value.  Numeric
        # mRotation is only a compatibility fallback and can be a stale
        # activity/config value in the same dump.
        return next(iter(current_values))
    if len(numeric_values) > 1:
        raise RuntimeError(
            "dumpsys window displays has conflicting mRotation values: "
            + repr(sorted(numeric_values))
        )
    if numeric_values:
        return next(iter(numeric_values))
    raise RuntimeError(
        "dumpsys window displays has no anchored mCurrentRotation="
        "ROTATION_{0,90,180,270} or mRotation={0,1,2,3} field"
    )


def display_size():
    values = re.findall(r"(\d+)x(\d+)", d.shell("wm size") or "")
    if not values:
        return None
    first, second = (int(value) for value in values[-1])
    return (max(first, second), min(first, second)) if device_is_landscape() \
        else (min(first, second), max(first, second))


def system_navigation_frame():
    """Return the visible bottom navigation window in physical coordinates.

    An IME may already be laid out above this window.  In that case the
    correct safe area is zero, even on a gesture-navigation device.  Reading
    the visible InsetsSource frame keeps this gate independent of a fixed
    inset expectation.  NavigationBar's Window frame can include transparent
    space above the actual navigation area, so it is only a legacy fallback.
    """
    size = display_size()
    if not size:
        return None
    _, screen_height = size
    raw = d.shell("dumpsys window") or ""
    frame_pattern = re.compile(
        r"(?:\bmFrame=|\bframe=)\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"
    )

    def bottom_frame(match):
        left, top, right, bottom = (int(value) for value in match.groups())
        height = bottom - top
        # A landscape three-button bar can be a full-height side window;
        # concerns the bottom area only, so do not mistake that side
        # window for a bottom overlap.
        if (right > left and bottom > top and bottom >= screen_height - 2
                and top >= screen_height * 0.5 and height <= screen_height * 0.5):
            return (top, bottom, left, right)
        return None

    # Android's current InsetsState reports the visible frame separately from
    # NavigationBar's Window frame.  The latter may be 126px high while only
    # the bottom 63px are a visible navigation source.  Include a bottom
    # tappableElement source when present; top/side-only sources are filtered
    # by bottom_frame().
    source_frames = []
    saw_source = False
    source_type = re.compile(r"\btype=(?:navigationBars|tappableElement)\b", re.I)
    for line in raw.splitlines():
        if "InsetsSource" not in line or not source_type.search(line):
            continue
        saw_source = True
        visible = re.search(r"\bvisible=(true|false)\b", line, re.I)
        if not visible or visible.group(1).lower() != "true":
            continue
        match = frame_pattern.search(line)
        if not match:
            continue
        frame = bottom_frame(match)
        if frame and frame not in source_frames:
            source_frames.append(frame)
    if source_frames:
        top = min(frame[0] for frame in source_frames)
        bottom = max(frame[1] for frame in source_frames)
        left = min(frame[2] for frame in source_frames)
        right = max(frame[3] for frame in source_frames)
        return {"top": top, "bottom": bottom, "left": left, "right": right}
    if saw_source:
        # Visible sources exist, but only as a top/side/empty frame.  The
        # bottom edge is therefore unobstructed.
        return {"present": False}

    # Older Android releases expose only the NavigationBar window frame.  Keep
    # both mFrame and the newer `Frames: ... frame=` spelling as a fallback;
    # current releases take the InsetsSource path above, avoiding transparent
    # Window-frame space.
    blocks = re.split(r"(?=^\s*Window #\d+)", raw, flags=re.MULTILINE)
    marker = re.compile(r"\bNavigationBar\d*\b|navigation[_ ]?bar", re.I)
    saw_navigation_window = False
    saw_navigation_frame = False
    frames = []
    for block in blocks:
        header = next((line for line in block.splitlines() if line.strip()), "")
        if not marker.search(header):
            continue
        saw_navigation_window = True
        match = frame_pattern.search(block)
        if not match:
            continue
        saw_navigation_frame = True
        frame = bottom_frame(match)
        if frame:
            frames.append(frame)
    if frames:
        top, bottom, left, right = min(frames)
        return {"top": top, "bottom": bottom, "left": left, "right": right}
    if saw_navigation_frame:
        return {"present": False}
    return {"present": False} if not saw_navigation_window else None


def safe_area_geometry(bar):
    """Compare native safe-bottom with the independent screen geometry."""
    if not isinstance(bar, dict):
        return False, {"reason": "keyboard geometry unavailable"}
    required = ("safe", "viewBottom", "controlBottom", "controlCount")
    if any(key not in bar for key in required) or not bar["controlCount"]:
        return False, {"reason": "bottom controls unavailable", "keyboard": bar}
    size = display_size()
    css_width = bar.get("cssWidth")
    try:
        css_width = float(css_width)
        native_width = float(getattr(d, "_DT_VIEW_WIDTH", 0) or 0)
        if css_width > 0 and native_width > 0:
            # The WebView target can be narrower than the physical display
            # (for example, landscape cutout avoidance).  Its DevTools
            # description is the only width that shares the CSS viewport's
            # coordinate space.
            scale = native_width / css_width
            scale_source = "devtools-target-width"
        else:
            # Older WebView descriptions do not expose width.  Keep the
            # device_verify scale as an explicit legacy fallback; do not
            # infer it from the display width here.
            scale = float(getattr(d, "_DT_SCALE", 0) or 0)
            scale_source = "device_verify._DT_SCALE-fallback"
    except (TypeError, ValueError, ZeroDivisionError):
        return False, {"reason": "invalid keyboard geometry", "keyboard": bar}
    offset_y = float((getattr(d, "_DT_OFFSET", (0, 0)) or (0, 0))[1])
    if scale <= 0:
        return False, {"reason": "DevTools screen scale unavailable", "keyboard": bar}
    try:
        view_bottom = offset_y + float(bar["viewBottom"]) * scale
        controls_bottom = offset_y + float(bar["controlBottom"]) * scale
        safe_css = float(str(bar["safe"]).strip().replace("px", ""))
    except (TypeError, ValueError):
        return False, {"reason": "invalid keyboard geometry", "keyboard": bar}
    safe_px = safe_css * scale
    nav = system_navigation_frame()
    tolerance = max(2.0, scale * 1.5)
    if nav is None:
        return False, {"reason": "system navigation frame unavailable", "keyboard": bar}
    if not nav.get("present", True):
        screen_bottom = size[1]
        ok = (abs(safe_px) <= tolerance
              and view_bottom <= screen_bottom + tolerance
              and controls_bottom <= screen_bottom + tolerance)
        return ok, {"nav": "absent", "viewBottom": view_bottom,
                    "controlBottom": controls_bottom, "safePx": safe_px,
                    "scale": scale, "scaleSource": scale_source,
                    "nativeWidth": native_width, "cssWidth": css_width}
    overlap = max(0.0, view_bottom - float(nav["top"]))
    ok = (abs(safe_px - overlap) <= tolerance
          and controls_bottom <= float(nav["top"]) + tolerance)
    return ok, {"nav": nav, "viewBottom": view_bottom,
                "controlBottom": controls_bottom, "safePx": safe_px,
                "expectedOverlapPx": overlap, "tolerancePx": tolerance,
                "scale": scale, "scaleSource": scale_source,
                "nativeWidth": native_width, "cssWidth": css_width}


# json.dumps (NOT Python repr): the page JSON.parse()es this string, and
# repr's single quotes are not valid JSON (suite bug the first AVD round).
CUSTOM_FIXTURE = json.dumps({
    "version": 1,
    "rows": [[
        {"t": "Esc", "tap": "[esc]", "note": "终端 Esc"},
        {"t": "☆", "tap": "☆"},
        {"t": "整理", "tap": "[esc]ggVGD", "note": "Vim 全文缩进"},
    ], [], []],
}, ensure_ascii=False)


def store_fixture():
    ev("localStorage.setItem('feelime_custom_keys_v2', '"
       + CUSTOM_FIXTURE.replace("'", "\\'") + "')")


def main():
    d.prepare()
    global KB
    KB = d.fresh_kb(refocus=True)
    if not KB:
        raise SystemExit("keyboard geometry unavailable")
    d.devtools_click_mode("英文 Direct")
    time.sleep(1.0)
    # A previous run's table must not leak into this one.
    ev("localStorage.removeItem('feelime_custom_keys_v2')")
    ev("localStorage.removeItem('feelime_custom_rows')")
    print("keyboard under test loaded, field ready", flush=True)

    # ---- #9 band rides hello ----
    st = state()
    band_px = None
    if st:
        try:
            band_px = float(str(st["band"]).strip().replace("px", "") or 0)
        except ValueError:
            band_px = None
    record("float band arrives over hello (--band > 0)", bool(band_px and band_px > 0),
           f"band={st['band'] if st else '?'}")

    # ---- #6 English j/k/l alt-texts ----
    st = state()
    record("English j/k/l alt-texts are ~ \" '",
           st and st["jAlt"] == "~" and st["kAlt"] == '"' and st["lAlt"] == "'",
           str({"j": st["jAlt"], "k": st["kAlt"], "l": st["lAlt"]} if st else "?"))

    # ---- #1 Fn sticky + F-keys ----
    ev("Feelime.toggleControlView()")
    time.sleep(0.5)
    st = state()
    record("ctrl view opens with the Fn key", st is not None and not st["ctrlHidden"], "")
    click('[data-ctrl="sticky-fn"]')
    time.sleep(0.4)
    st = state()
    record("Fn arms; q -> F1 / a stays a",
           st and st["fnActive"] and st["qMain"] == "F1" and st["aMain"] == "a",
           str({"fn": st["fnActive"], "q": st["qMain"], "a": st["aMain"]} if st else "?"))
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    click('#qwertyLayer [data-key="q"]')
    time.sleep(0.6)
    st = state()
    lines = keyevent_logs()
    record("q sends KEYCODE_F1(131) and clears the sticky",
           st and not st["fnActive"] and any("code=131" in l and "meta=0" in l for l in lines),
           str({"fn": st["fnActive"] if st else "?", "lines": lines[-3:]}))
    # Review P1-1: the face must snap back with the sticky state.
    record("q face restores after the combo ",
           st and st["qMain"] == "q", str({"q": st["qMain"] if st else "?"}))
    click('[data-ctrl="sticky-ctrl"]')
    click('[data-ctrl="sticky-fn"]')
    time.sleep(0.4)
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    click('#qwertyLayer [data-key="r"]')
    time.sleep(0.6)
    lines = keyevent_logs()
    record("Ctrl+F4 carries code=134 with CTRL wire 12288",
           any("code=134" in l and "meta=4096" in l and "wire=12288" in l for l in lines),
           str(lines[-3:]))

    # ---- #2 Fn long-press opens the comb grid; #5 anchor tap only closes ----
    long_press('[data-ctrl="sticky-fn"]')
    st = state()
    record("Fn long-press opens the comb grid (9 cells)",
           st and st["comboOpen"] and st["comboCells"] == 9,
           str({"open": st["comboOpen"], "cells": st["comboCells"]} if st else "?"))
    # Review P1-3: the combo card's placement math (hug / shrink /
    # side-slide) had no device geometry assertion. Invariants for every
    # branch: fully inside the IME window, ✕ badge (14px overhang) visible,
    # and the trigger key itself not covered (above it, or beside its row).
    geo = ev("(() => { const c = document.getElementById('comboPopup').getBoundingClientRect();"
             " const f = document.querySelector('[data-ctrl=\\\"sticky-fn\\\"]').getBoundingClientRect();"
             " return { t: c.top, b: c.bottom, l: c.left, r: c.right,"
             "  winH: innerHeight, winW: innerWidth,"
             "  fT: f.top, fB: f.bottom, fL: f.left, fR: f.right }; })()")
    geo_ok = bool(geo) and all(isinstance(geo.get(k), (int, float)) for k in ("t", "b", "l", "r"))
    inside = geo_ok and geo["t"] >= 0 and geo["b"] <= geo["winH"] + 1 \
        and geo["l"] >= 0 and geo["r"] <= geo["winW"] + 1
    badge = geo_ok and geo["t"] - 14 >= 0
    clears = geo_ok and (geo["b"] <= geo["fT"] + 1 or geo["l"] >= geo["fR"] - 1
                         or geo["r"] <= geo["fL"] + 1)
    record("combo card in-window, badge visible, trigger key clear",
           inside and badge and clears,
           str({"geo": geo, "inside": inside, "badge": badge, "clears": clears}))
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    synth_tap('[data-ctrl="sticky-fn"]')
    time.sleep(0.5)
    st = state()
    lines = keyevent_logs()
    record("anchor tap closes the grid without arming Fn",
           st and not st["comboOpen"] and not st["fnActive"] and not any("keyEvent" in l for l in lines),
           str({"open": st["comboOpen"], "fn": st["fnActive"], "lines": lines[-2:]}))
    ev("Feelime.toggleControlView()")
    time.sleep(0.4)

    # ---- #5 mode menu: tapping the toggle only closes ----
    long_press('#modeToggle')
    st = state()
    record("long-press toggle opens the mode menu", st and st["menuOpen"], "")
    chip_before = d.keyboard_chip()
    synth_tap('#modeToggle')
    time.sleep(0.5)
    st = state()
    chip_after = d.keyboard_chip()
    record("toggle tap closes the menu without switching keyboards",
           st and not st["menuOpen"] and chip_before == chip_after,
           str({"open": st["menuOpen"], "chip": (chip_before, chip_after)} if st else "?"))

    # ---- #9 band popups flip the native touch region ----
    # The menu's GEOMETRY is intentional (design §0 总原则:
    # anchor-driven - hug the toggle's top edge, window-wide placement), so
    # "above the keyboard" became "above its trigger key". The overlay flip
    # assertion is unchanged.
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    ev("Feelime.toggleModeMenu()")
    time.sleep(0.6)
    lines = keyevent_logs()
    geo = ev("(() => { const m = document.getElementById('modeMenu').getBoundingClientRect();"
             " const t = document.getElementById('modeToggle').getBoundingClientRect();"
             " return { top: m.top, bottom: m.bottom, right: m.right,"
             " toggleTop: t.top, toggleRight: t.right,"
             " hugs: m.bottom <= t.top + 1 && m.top >= 14,"
             " aligned: Math.abs(m.right - t.right) <= 1 }; })()")
    record("mode menu hugs its trigger key; setOverlayOpen(true) logged",
           geo and geo["hugs"] and geo["aligned"]
           and any("setOverlayOpen open=true" in l for l in lines),
           str({"geo": geo, "lines": lines[-2:]}))
    ev("Feelime.closeModeMenu()")
    time.sleep(0.5)
    lines = keyevent_logs()
    record("menu close releases the touch region (setOverlayOpen false)",
           any("setOverlayOpen open=false" in l for l in lines), str(lines[-2:]))

    # ---- #7 custom keys: invalid paste errors, valid table renders ----
    # design §15: the JSON editor lives in the HTML settings page now (the
    # in-keyboard strip is gone); drive the page's own DevTools target.
    d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(2.5)
    sev = lambda expr: d.devtools_eval_target("settings/index.html", expr)
    # The custom-keys card lives on the input sub-page now -
    # switch first, the focus step below needs a visible page.
    sev("window.FeelimeSettings && window.FeelimeSettings.showPage('input')")
    opened = sev("!!document.getElementById('customJson')")
    record("粘贴 JSON editor reachable on the settings page", opened,
           "customJson probe")
    sev("(() => { const ta = document.getElementById('customJson');"
        " ta.focus(); ta.value = 'not json';"
        " ta.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()")
    sev("document.getElementById('btnSaveCustom').click()")
    time.sleep(0.6)
    note = sev("document.getElementById('customNote').textContent") or ""
    kept = sev("document.getElementById('customJson').value") or ""
    record("invalid JSON names the error and keeps the editor",
           "JSON" in note and "not json" in kept,
           str({"note": note[:60], "kept": kept[:30]}))
    # A valid table round-trips into the native store (the summary flips).
    sev("(() => { const ta = document.getElementById('customJson');"
        " ta.focus(); ta.value = " + json.dumps(CUSTOM_FIXTURE) + ";"
        " ta.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()")
    sev("document.getElementById('btnSaveCustom').click()")
    time.sleep(1.0)
    summary = sev("document.getElementById('customSummary').textContent") or ""
    record("valid table saves through the settings page",
           summary.strip() in ("已定制 3 个键", "3 custom keys"),
           f"summary={summary!r}")
    d.shell("input keyevent 4")  # back to the field for the keyboard-side cases
    time.sleep(1.2)
    store_fixture()
    key_by_label("123")
    time.sleep(0.6)
    custom_tab = ev("(() => { const t = [...document.querySelectorAll('.sym-cat')]"
                    "   .find(el => el.textContent === '定制' || el.textContent === 'Custom');"
                    " if (!t) return 'no'; t.click(); return 'ok'; })()")
    time.sleep(0.6)
    keys = ev("(() => [...document.querySelectorAll('#symGrid .sym-custom-key')]"
              "   .map(el => el.textContent))()")
    record("pasted table renders the custom strips",
           custom_tab == "ok" and keys == ["Esc", "☆", "整理"], str(keys))
    # Review P1-2: keys inside the overflow-x row must allow horizontal
    # panning - .kb-key's touch-action:none would strand the gesture.
    ta = ev("(() => { const k = document.querySelector('#symGrid .sym-custom-key');"
            " return k ? getComputedStyle(k).touchAction : 'no-key'; })()")
    record("custom keys keep the row pannable (touch-action pan-x)",
           ta == "pan-x", str(ta))
    # Commit + backspace column FIRST, with no Esc in between (retry the
    # field read: the commit round-trip can outrun a single 0.6s sleep on a
    # busy device; one extra click is a no-op once the field is empty).
    ev("[...document.querySelectorAll('#symGrid .sym-custom-key')][1].click()")
    time.sleep(0.6)
    field = d.field_text_retry()
    record("custom text key commits literally", field and "☆" in field, repr(field))
    ev("document.querySelector('#symGrid .sym-custom-bs .kb-key').click()")
    time.sleep(0.6)
    field = d.field_text_retry()
    if "☆" in (field or ""):
        ev("document.querySelector('#symGrid .sym-custom-bs .kb-key').click()")
        time.sleep(0.8)
        field = d.field_text_retry()
    record("backspace column deletes", "☆" not in (field or ""), repr(field))
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    ev("[...document.querySelectorAll('#symGrid .sym-custom-key')]"
       "[0].click()")
    time.sleep(0.6)
    lines = keyevent_logs()
    record("custom [esc] key sends keycode 111",
           any("code=111" in l and "meta=0" in l for l in lines), str(lines[-2:]))
    ev("[...document.querySelectorAll('#symGrid .sym-custom-key')][1].click()")
    time.sleep(0.6)
    field = d.field_text_retry()
    record("custom text key commits after esc", field and "☆" in field, repr(field))
    # Device forensics: ColorOS clears the EDITOR's view focus when its EditText
    # sees KEYCODE_ESCAPE (uiautomator focused=true -> none, flags .F. ->
    # ....; mServedView survives, so commitText still lands). Key events to
    # an unfocused editor vanish - hardware DEL included - so the
    # key-event-based backspace channel is dead until the
    # field is tapped again. Stock AVD keeps the focus and deletes fine.
    # Platform boundary, documented in docs/design/keyboard.md §10.7 - the
    # case asserts the RECOVERY instead of pretending the delete lands.
    bounds = d.field_bounds()
    if bounds:
        d.tap((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2, wait=1.0)
    ev("document.querySelector('#symGrid .sym-custom-bs .kb-key').click()")
    time.sleep(0.6)
    field = d.field_text_retry()
    record("backspace recovers after refocus (esc focus boundary)",
           "☆" not in (field or ""), repr(field))
    ev("localStorage.removeItem('feelime_custom_keys_v2')")

    # ---- #11 voice overlay: mic icon, no red dot; fits landscape ----
    ev("Feelime.onNativeState && Feelime.onNativeState({state:'listening',partial:'',level:0.5})")
    time.sleep(0.5)
    voice = ev("(() => { const card = document.getElementById('voiceCard');"
               " const mic = card.querySelector('.vc-mic');"
               " const dot = card.querySelector('.vc-dot');"
               " const kb = document.getElementById('softKeyboard').getBoundingClientRect();"
               " const r = card.getBoundingClientRect();"
               " return { mic: !!mic, micH: mic ? mic.getBoundingClientRect().height : 0,"
               "   dot: !!dot, fits: r.top >= kb.top - 1 && r.bottom <= kb.bottom + 1 }; })()")
    record("voice card shows the 20px mic icon (no dot), fits portrait",
           voice and voice["mic"] and not voice["dot"] and 18 <= voice["micH"] <= 24
           and voice["fits"], str(voice))
    ev("Feelime.onNativeState && Feelime.onNativeState({state:'idle',partial:'',level:0})")
    time.sleep(0.4)

    # ---- #10 landscape toolbar + ctrl rows; #8 safe area; #11 landscape ----
    set_orientation(landscape=True)
    rotated = device_is_landscape()
    if rotated:
        bar = ev("(() => { const bar = document.getElementById('candidateBar');"
                 " const cs = getComputedStyle(bar);"
                 " const preedit = document.getElementById('preeditLine');"
                 " const safe = getComputedStyle(document.documentElement)"
                 "   .getPropertyValue('--safe-bottom');"
                 " const view = document.getElementById('softKeyboard')"
                 "   .getBoundingClientRect();"
                 " const controls = ['#spaceKey', '#enterKey',"
                 "   '[data-role=\"backspace\"]'].map(selector =>"
                 "   document.querySelector(selector)).filter(Boolean)"
                 "   .map(node => node.getBoundingClientRect().bottom);"
                 " return { h: cs.height, mt: cs.marginTop, safe, cssWidth: innerWidth,"
                 "   viewBottom: view.bottom, controlBottom: Math.max(...controls),"
                 "   controlCount: controls.length }; })()")
        bar_h = float(str(bar["h"]).replace("px", "")) if bar and bar["h"] else 0
        bar_mt = float(str(bar["mt"]).replace("px", "")) if bar and bar["mt"] else 0
        record("landscape bar grew to 40 and clears the preedit line",
               38 <= bar_h <= 42 and bar_mt >= 12, str(bar))
        safe_ok, safe_detail = safe_area_geometry(bar)
        record("landscape bottom controls clear the actual navigation area",
               safe_ok, str(safe_detail))
        ev("Feelime.toggleControlView()")
        time.sleep(0.6)
        row = ev("(() => { const r = document.querySelector('#ctrlLayer .ctrl-row');"
                 " return { h: r.getBoundingClientRect().height }; })()")
        record("landscape ctrl rows take real keys (>=24px)",
               row and row["h"] >= 24, str(row))
        ev("Feelime.toggleControlView()")
        time.sleep(0.5)
        ev("Feelime.onNativeState && Feelime.onNativeState({state:'listening',partial:'',level:0.5})")
        time.sleep(0.5)
        voice = ev("(() => { const card = document.getElementById('voiceCard');"
                   " const r = card.getBoundingClientRect();"
                   " const kb = document.getElementById('softKeyboard').getBoundingClientRect();"
                   " return { fits: r.top >= kb.top - 1 && r.bottom <= kb.bottom + 1 }; })()")
        record("landscape voice card fits the keyboard",
               voice and voice["fits"], str(voice))
        ev("Feelime.onNativeState && Feelime.onNativeState({state:'idle',partial:'',level:0})")
    else:
        # /20 precedent: the device laid flat ignores user_rotation.
        reason = "platform skipped: device did not rotate to landscape"
        skip("landscape bar grew", reason)
        skip("landscape bottom controls clear the actual navigation area",
             reason)
        skip("landscape ctrl rows", reason)
        skip("landscape voice card fits", reason)
    set_orientation(landscape=False)

    # ---- #12 hide + reshow lands on letters ----
    store_fixture()
    key_by_label("123")
    time.sleep(0.6)
    st = state()
    record("symbol layer up before hide", st and not st["symbolHidden"], "")
    click("#hide")
    time.sleep(1.2)
    d.ensure_keyboard_up()
    time.sleep(1.0)
    st = state()
    record("re-show lands on the letters layer",
           st and not st["qwertyHidden"] and st["symbolHidden"], str(st))
    ev("localStorage.removeItem('feelime_custom_keys_v2')")

    ok = sum(1 for _, passed, _ in RESULTS if passed)
    print(f"\n== fn-custom device suite: {ok}/{len(RESULTS)} passed; "
          f"{len(SKIPPED)} skipped ==")
    if SKIPPED:
        print("skips: " + " | ".join(f"{name}: {detail}"
                                     for name, detail in SKIPPED), flush=True)
    failed = [name for name, passed, _ in RESULTS if not passed]
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
