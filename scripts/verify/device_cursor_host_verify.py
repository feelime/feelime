#!/usr/bin/env python3
"""Cursor scrub gate against an ordinary Android EditText host.

The host is a small standalone app under ``cursor-host/``.  Its
``InputConnection`` returns null for the two full-editor snapshot APIs and
rejects left/right DPAD events, while displaying the bounded text API calls
and the current UTF-16 selection through uiautomator.

The production APK is never installed by this script.  ``FEELIME_VERIFY_APK``
must already match the installed Feelime package.  The host APK may be
installed with ``FEELIME_CURSOR_HOST_APK`` or may already be present.

DevTools is an observation channel for live keyboard geometry only.  Every
host button, keyboard mode-independent scrub gesture, and assertion input is
sent through adb.  Distances are expressed in CSS pixels and converted with
the live WebView scale; no screen-size coordinates are baked into the gate.
"""

import argparse
import hashlib
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d


HOST_PKG = "org.example.feelimecursorprobe"
HOST_ACTIVITY = HOST_PKG + "/.MainActivity"
HOST_UI_XML = "/sdcard/feelime-cursor-host-ui.xml"
PRESET_TEXT = "Feelime cursor probe 😀 / ASCII 123"

# These are the values used by keyboard.js: 38 CSS px recognition slop and
# 36 / speed CSS px per step at the shipped speed 3 = 12 CSS px.
SCRUB_SLOP_CSS = 38.0
SCRUB_UNIT_CSS = 12.0
# Leave enough CSS-pixel headroom for both the DOM center's integer physical
# coordinate and the final adb endpoint conversion.  A half-pixel margin can
# still land just below the last 12px boundary at 2.62x density.
ROUNDING_MARGIN_CSS = 2.0
TRAVEL_STEPS = 17
EMOJI_STEPS = 4

RESULTS = []


def record(name, ok, detail=""):
    ok = bool(ok)
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)
    return ok


def screen_size():
    matches = re.findall(r"(\d+)x(\d+)", d.shell("wm size"))
    if not matches:
        raise RuntimeError("wm size is unavailable")
    return tuple(int(value) for value in matches[-1])


def installed_production_matches(apk):
    """Compare the exact requested production APK with pm's installed path."""
    if not apk.is_file():
        return False, f"FEELIME_VERIFY_APK is not a file: {apk}"
    local = hashlib.sha256(apk.read_bytes()).hexdigest()
    paths = [line.removeprefix("package:").strip()
             for line in d.shell(f"pm path {d.PKG}").splitlines()
             if line.startswith("package:")]
    if not paths:
        return False, "production APK is not installed"
    remote = d.shell("sha256sum " + shlex.quote(paths[0])).split()
    if not remote:
        return False, "installed production APK hash is unavailable"
    return remote[0].lower() == local.lower(), (
        f"local={local[:16]} device={remote[0][:16]}"
    )


def install_host_if_requested():
    raw = os.environ.get("FEELIME_CURSOR_HOST_APK", "").strip()
    if raw:
        apk = Path(raw).expanduser()
        if not apk.is_file():
            raise RuntimeError(f"FEELIME_CURSOR_HOST_APK is not a file: {apk}")
        result = subprocess.run(
            ["adb", "-s", d.SERIAL, "install", "-r", str(apk)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "install failed").strip()
            raise RuntimeError(f"cursor host install failed: {detail}")
    if not d.shell(f"pm path {HOST_PKG}").strip():
        raise RuntimeError(
            "cursor host is not installed; set FEELIME_CURSOR_HOST_APK "
            "to the standalone host APK"
        )


def host_ui_dump():
    """Return a parsed uiautomator tree for the host diagnostics."""
    for _ in range(4):
        d.shell(f"rm -f {HOST_UI_XML}")
        d.shell(f"uiautomator dump {HOST_UI_XML} >/dev/null 2>&1")
        raw = d.shell(f"cat {HOST_UI_XML} 2>/dev/null")
        if not raw.lstrip().startswith("<?xml"):
            time.sleep(0.25)
            continue
        try:
            return ElementTree.fromstring(raw)
        except ElementTree.ParseError:
            time.sleep(0.25)
    return None


def node_by_id(root, short_id):
    if root is None:
        return None
    suffix = ":id/" + short_id
    for node in root.iter("node"):
        resource_id = node.attrib.get("resource-id", "")
        if resource_id.endswith(suffix) or resource_id.endswith("/" + short_id):
            return node
    return None


def node_bounds(node):
    if node is None:
        return None
    match = re.fullmatch(
        r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",
        node.attrib.get("bounds", ""),
    )
    return tuple(int(value) for value in match.groups()) if match else None


def host_diagnostics():
    """Read only the host's named TextViews from uiautomator."""
    root = host_ui_dump()
    selection_node = node_by_id(root, "probe_selection")
    counters_node = node_by_id(root, "probe_counters")
    text_node = node_by_id(root, "probe_text")
    if (selection_node is None or counters_node is None or
            text_node is None):
        return None
    selection_text = selection_node.attrib.get("text", "")
    selection = re.search(
        r"selectionStart=(-?\d+)\s+selectionEnd=(-?\d+)", selection_text
    )
    if not selection:
        return None
    counters_text = counters_node.attrib.get("text", "")
    counters = {
        key: int(value)
        for key, value in re.findall(r"([A-Za-z]+)=(\d+)", counters_text)
    }
    text = text_node.attrib.get("text", "")
    if text.startswith("text="):
        text = text[5:]
    return {
        "text": text,
        "start": int(selection.group(1)),
        "end": int(selection.group(2)),
        "counters": counters,
        "selectionText": selection_text,
        "countersText": counters_text,
    }


def wait_host(predicate, timeout=8.0):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        last = host_diagnostics()
        if last is not None and predicate(last):
            return last
        time.sleep(0.25)
    return last


def settle_host(timeout=4.0):
    """Wait for two identical named diagnostics after async setSelection."""
    deadline = time.monotonic() + timeout
    previous = None
    repeated = 0
    last = None
    while time.monotonic() < deadline:
        last = host_diagnostics()
        if last is not None:
            current = (last["text"], last["start"], last["end"])
            if current == previous:
                repeated += 1
            else:
                repeated = 0
            previous = current
            if repeated >= 2:
                return last
        time.sleep(0.25)
    return last


def input_hidden():
    if d.input_shown():
        d.shell("input keyevent KEYCODE_BACK")
        deadline = time.monotonic() + 3.0
        while time.monotonic() < deadline and d.input_shown():
            time.sleep(0.15)
    return not d.input_shown()


def node_visible(node, width, height):
    bounds = node_bounds(node)
    if not bounds:
        return False
    left, top, right, bottom = bounds
    return (right > left and bottom > top and
            0 <= (left + right) / 2 < width and
            0 <= (top + bottom) / 2 < height)


def host_scroll_down():
    width, height = screen_size()
    x = width // 2
    d.shell(
        f"input swipe {x} {round(height * 0.80)} "
        f"{x} {round(height * 0.28)} 260"
    )
    time.sleep(0.35)


def host_click(short_id, attempts=8):
    """Click a named host control after hiding the IME, scrolling if needed."""
    if not input_hidden():
        raise RuntimeError("could not hide IME before host button interaction")
    width, height = screen_size()
    for _ in range(attempts):
        root = host_ui_dump()
        node = node_by_id(root, short_id)
        if node_visible(node, width, height):
            left, top, right, bottom = node_bounds(node)
            d.tap((left + right) / 2, (top + bottom) / 2, wait=0.35)
            return True
        host_scroll_down()
    return False


def launch_host():
    """Start the real host and select Feelime without launching SetupActivity."""
    # A fresh IME process removes a stale panel/composition left by another
    # case while keeping the installed production APK untouched.
    d.shell("am force-stop " + d.PKG)
    d.shell("am force-stop " + HOST_PKG)
    d._DT_SOCKET = None
    d._DT_PID = None
    output = d.shell(
        "am start -n " + HOST_ACTIVITY +
        # Android 14's `am` shell parser accepts the Intent flags in -f;
        # `--activity-new-task` is an ActivityManager option on some older
        # releases but is rejected as an unknown option here.
        " -f 0x10008000"
    )
    if "Error" in output or "Exception" in output:
        raise RuntimeError("host activity did not start: " + output.strip())
    time.sleep(1.0)
    # Let the host's post-onCreate show request settle while still using the
    # remembered IME, then hide that first window before selecting Feelime.
    # Selecting during the request races Android's per-package IME restore and
    # can leave the previous IME bound even though `ime set` reported success.
    if not input_hidden():
        raise RuntimeError("could not hide the host's initial keyboard")
    # Android remembers the last IME per host package.  Select Feelime after
    # the first editor connection has been hidden, otherwise a prior default-IME
    # run can silently replace the selection during the initial show request.
    selected = d.shell("ime set " + d.PKG + "/com.feelime.ime.FeelimeService")
    if "Error" in selected or "Exception" in selected:
        raise RuntimeError("Feelime IME could not be selected: " + selected.strip())
    time.sleep(0.8)
    if not wait_host(lambda state: state["text"] == PRESET_TEXT, timeout=6.0):
        raise RuntimeError("host diagnostics did not render the preset text")


def show_keyboard():
    # The host remembers its last IME independently of secure/default IME.
    # A previous-IME window therefore counts as "shown" but cannot exercise the
    # Feelime WebView.  Retry the real button after re-selecting Feelime if the
    # first show request was claimed by that remembered IME.
    for attempt in range(3):
        if not host_click("probe_show_ime"):
            raise RuntimeError("host Show keyboard button is not reachable")
        deadline = time.monotonic() + 8.0
        while time.monotonic() < deadline:
            if d.input_shown():
                current = d.shell(
                    "dumpsys input_method | grep -m1 mCurMethodId"
                )
                if d.PKG in current:
                    return
                break
            time.sleep(0.25)
        if attempt == 2:
            current = d.shell(
                "dumpsys input_method | grep -m1 mCurMethodId"
            ).strip()
            default = d.shell("settings get secure default_input_method").strip()
            raise RuntimeError(
                "host Show keyboard did not bind Feelime: "
                f"current={current!r} default={default!r}"
            )
        # Hide the wrong IME, select Feelime once the host is idle, and let the
        # next button click create a fresh InputConnection.
        input_hidden()
        selected = d.shell("ime set " + d.PKG + "/com.feelime.ime.FeelimeService")
        if "Error" in selected or "Exception" in selected:
            raise RuntimeError("Feelime IME could not be selected: " + selected.strip())
        time.sleep(0.5)


def prepare_host(origin):
    """Use host Reset/Middle controls to create a deterministic real editor."""
    if origin not in {"end", "middle"}:
        raise ValueError(origin)
    if not host_click("probe_reset"):
        raise RuntimeError("host Reset text button is not reachable")
    expected = len(PRESET_TEXT.encode("utf-16-le")) // 2
    state = wait_host(
        lambda value: value["text"] == PRESET_TEXT and
        value["start"] == expected and value["end"] == expected,
        timeout=5.0,
    )
    if not state:
        raise RuntimeError("host Reset text did not place the caret at the end")
    if origin == "middle":
        if not host_click("probe_middle"):
            raise RuntimeError("host middle-cursor button is not reachable")
        middle = expected // 2
        state = wait_host(
            lambda value: value["text"] == PRESET_TEXT and
            value["start"] == middle and value["end"] == middle,
            timeout=5.0,
        )
        if not state:
            raise RuntimeError("host middle-cursor button did not set selection")
    show_keyboard()
    # Showing the IME requests a new InputConnection.  Keep the initial
    # selection as evidence after that hand-off, rather than trusting the
    # button click's immediate callback.
    state = wait_host(
        lambda value: value["text"] == PRESET_TEXT and
        value["start"] == (expected if origin == "end" else expected // 2) and
        value["end"] == (expected if origin == "end" else expected // 2),
        timeout=5.0,
    )
    if not state:
        raise RuntimeError("host selection changed while showing the IME")
    return state


def keyboard_geometry():
    """Read live qwerty geometry and refresh stale WebView coordinates."""
    for _ in range(12):
        if d._DT_SOCKET is not None:
            try:
                d._DT_SOCKET.close()
            except OSError:
                pass
        d._DT_SOCKET = None
        value = d.devtools_key_geometry()
        if value:
            letters = [
                (name, point) for name, point in value.items()
                if len(name) == 1 and name.isalpha() and
                isinstance(point, tuple) and len(point) == 2
            ]
            if letters and value.get("<density>"):
                return value
        time.sleep(0.35)
    current = d.shell("dumpsys input_method | grep -m1 mCurMethodId").strip()
    default = d.shell("settings get secure default_input_method").strip()
    pid = d.shell("pidof " + d.PKG).strip()
    raise RuntimeError(
        "live keyboard letter geometry is unavailable; "
        f"current={current!r} default={default!r} inputShown={d.input_shown()} "
        f"pid={pid!r} devtoolsPid={d._DT_PID!r}"
    )


def cursor_path(direction, target_steps):
    """Build a physical adb path from a live letter key.

    The endpoint is one half-CSS-pixel inside the requested step boundary so
    integer conversion to physical pixels cannot lose the final unit.
    """
    if direction not in {-1, 1}:
        raise ValueError(direction)
    geometry = keyboard_geometry()
    letters = [
        (name, point) for name, point in geometry.items()
        if len(name) == 1 and name.isalpha() and
        isinstance(point, tuple) and len(point) == 2
    ]
    density = float(geometry["<density>"])
    distance_css = (
        SCRUB_SLOP_CSS + (target_steps - 1) * SCRUB_UNIT_CSS +
        ROUNDING_MARGIN_CSS
    )
    distance = max(1, round(distance_css * density))
    width, height = screen_size()
    if direction < 0:
        candidates = sorted(letters, key=lambda item: item[1][0], reverse=True)
        candidates = [item for item in candidates if item[1][0] - distance >= 0]
    else:
        candidates = sorted(letters, key=lambda item: item[1][0])
        candidates = [item for item in candidates if item[1][0] + distance < width]
    if not candidates:
        raise RuntimeError(
            f"no letter key has room for {distance_css:.1f} CSS px scrub "
            f"on a {width}x{height} screen"
        )
    name, (start_x, start_y) = candidates[0]
    end_x = start_x + direction * distance
    if not (0 <= end_x < width and 0 <= start_y < height):
        raise RuntimeError("computed scrub path is outside the display")
    return {
        "key": name,
        "x1": int(start_x),
        "y": int(start_y),
        "x2": int(end_x),
        "cssDistance": distance_css,
        "physicalDistance": abs(int(end_x) - int(start_x)),
        "density": density,
    }


def adb_swipe(path, duration_ms):
    """Inject one real touchscreen swipe; do not synthesize WebView events."""
    command = [
        "adb", "-s", d.SERIAL, "shell", "input", "touchscreen", "swipe",
        str(path["x1"]), str(path["y"]), str(path["x2"]), str(path["y"]),
        str(int(duration_ms)),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "adb swipe failed").strip()
        raise RuntimeError(detail)
    time.sleep(0.45)


def swipe_and_settle(path, duration_ms, expected=None):
    adb_swipe(path, duration_ms)
    if expected is None:
        return settle_host()
    state = wait_host(
        lambda value: value["start"] == expected and value["end"] == expected,
        timeout=5.0,
    )
    # Keep reading after the first matching callback in case an in-flight
    # batch of moveCursor deltas is still being applied.
    settled = settle_host(timeout=3.0)
    return settled or state


def utf16_boundaries(text):
    offsets = [0]
    for char in text:
        offsets.append(offsets[-1] + len(char.encode("utf-16-le")) // 2)
    return offsets


def offset_after_steps(offset, delta, boundaries):
    """Move by Unicode characters while returning an editor UTF-16 offset."""
    try:
        index = boundaries.index(offset)
    except ValueError as error:
        raise RuntimeError(
            f"selection offset {offset} is not a UTF-16 character boundary"
        ) from error
    return boundaries[max(0, min(len(boundaries) - 1, index + delta))]


def counter_delta(before, after):
    keys = set(before or {}) | set(after or {})
    return {key: (after or {}).get(key, 0) - (before or {}).get(key, 0)
            for key in keys}


def run_new_gate():
    end = prepare_host("end")
    initial_counters = dict(end["counters"])
    expected_end = len(PRESET_TEXT.encode("utf-16-le")) // 2
    boundaries = utf16_boundaries(PRESET_TEXT)
    expected_slow = offset_after_steps(
        expected_end, -TRAVEL_STEPS, boundaries
    )
    slow_path = cursor_path(-1, TRAVEL_STEPS)
    slow = swipe_and_settle(slow_path, 850, expected_slow)

    end_again = prepare_host("end")
    fast_path = cursor_path(-1, TRAVEL_STEPS)
    fast = swipe_and_settle(fast_path, 140, expected_slow)
    same_endpoint = (
        slow is not None and fast is not None and
        slow.get("start") == expected_slow and
        fast.get("start") == expected_slow and
        slow.get("start") == fast.get("start") and
        slow.get("end") == slow.get("start") and
        fast.get("end") == fast.get("start")
    )
    same_distance = slow_path["physicalDistance"] == fast_path["physicalDistance"]
    record(
        "cursor slow and fast equal-distance swipes reach one endpoint",
        bool(end_again) and same_endpoint and same_distance,
        f"slow={slow} fast={fast} slowPath={slow_path} fastPath={fast_path}",
    )

    after_pair = fast or slow or {}
    pair_delta = counter_delta(initial_counters, after_pair.get("counters", {}))
    api_ok = (
        pair_delta.get("getTextBeforeCursor", 0) > 0 and
        pair_delta.get("getTextAfterCursor", 0) > 0 and
        pair_delta.get("setSelection", 0) > 0 and
        pair_delta.get("blockedDpadLeftRight", 0) == 0 and
        pair_delta.get("sendKeyEvent", 0) == 0
    )
    record(
        "cursor uses bounded text APIs and setSelection without DPAD",
        api_ok,
        f"counterDelta={pair_delta}",
    )

    middle = prepare_host("middle")
    emoji_target = offset_after_steps(
        middle["start"], EMOJI_STEPS, boundaries
    )
    right_path = cursor_path(1, EMOJI_STEPS)
    across = swipe_and_settle(right_path, 520, emoji_target)
    reverse_path = cursor_path(-1, EMOJI_STEPS)
    back = swipe_and_settle(reverse_path, 180, middle["start"])
    emoji_ok = (
        across is not None and back is not None and
        across.get("start") == emoji_target and
        across.get("end") == emoji_target and
        back.get("start") == middle["start"] and
        back.get("end") == middle["start"] and
        across.get("start") in boundaries and
        back.get("start") in boundaries
    )
    record(
        "cursor crosses emoji without landing inside its UTF-16 pair",
        emoji_ok,
        f"middle={middle.get('start')} across={across} reverse={back} "
        f"rightPath={right_path} reversePath={reverse_path} "
        f"boundaries={sorted(boundaries)}",
    )

    at_middle = prepare_host("middle")
    left_path = cursor_path(-1, TRAVEL_STEPS)
    at_start = swipe_and_settle(left_path, 500, 0)
    still_start = swipe_and_settle(left_path, 160, 0)
    right_path = cursor_path(1, TRAVEL_STEPS)
    at_middle_again = swipe_and_settle(right_path, 500, at_middle["start"])
    at_end = swipe_and_settle(right_path, 160, expected_end)
    boundary_ok = all(
        value is not None and value.get("start") == value.get("end") and
        value.get("start") in boundaries
        for value in (at_start, still_start, at_middle_again, at_end)
    ) and (at_start or {}).get("start") == 0 and \
        (still_start or {}).get("start") == 0 and \
        (at_middle_again or {}).get("start") == at_middle["start"] and \
        (at_end or {}).get("start") == expected_end
    record(
        "cursor clamps at both text boundaries",
        boundary_ok,
        f"middle={at_middle.get('start')} start={at_start} "
        f"repeat={still_start} middleAgain={at_middle_again} end={at_end} "
        f"leftPath={left_path} rightPath={right_path}",
    )

    final = at_end or at_start or {}
    total_delta = counter_delta(initial_counters, final.get("counters", {}))
    record(
        "cursor host observed no DPAD dependence across the gate",
        total_delta.get("blockedDpadLeftRight", 0) == 0 and
        total_delta.get("sendKeyEvent", 0) == 0,
        f"counterDelta={total_delta}",
    )


def run_stalled_gate():
    initial = prepare_host("end")
    expected_end = len(PRESET_TEXT.encode("utf-16-le")) // 2
    path = cursor_path(-1, TRAVEL_STEPS)
    after = swipe_and_settle(path, 420)
    delta = counter_delta(initial["counters"], (after or {}).get("counters", {}))
    stalled = (
        after is not None and after.get("text") == PRESET_TEXT and
        after.get("start") == expected_end and after.get("end") == expected_end and
        delta.get("sendKeyEvent", 0) > 0 and
        delta.get("blockedDpadLeftRight", 0) > 0
    )
    record(
        "stalled reference receives DPAD while selection stays unchanged",
        stalled,
        f"after={after} counterDelta={delta} path={path}",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--expect-stalled", action="store_true",
        help="expect the old fallback APK to send blocked DPAD events",
    )
    args = parser.parse_args()
    apk_raw = os.environ.get("FEELIME_VERIFY_APK", "").strip()
    if not apk_raw:
        raise SystemExit("FEELIME_VERIFY_APK is required")
    apk = Path(apk_raw).expanduser()
    apk_ok, apk_detail = installed_production_matches(apk)
    record("installed Feelime APK matches FEELIME_VERIFY_APK", apk_ok, apk_detail)
    if not apk_ok:
        return 1
    try:
        install_host_if_requested()
        record("ordinary cursor host is installed", True, HOST_PKG)
        launch_host()
        record("ordinary cursor host exposes preset diagnostics", True, PRESET_TEXT)
        if args.expect_stalled:
            run_stalled_gate()
        else:
            run_new_gate()
    except Exception as error:
        record("cursor host device gate completed", False, str(error))
    finally:
        # Leave the target in a quiet state for the next gate.  This only
        # touches the explicitly supplied FEELIME_ADB_SERIAL device.
        try:
            input_hidden()
            d.shell("am force-stop " + HOST_PKG)
        except Exception:
            pass
    print(f"cursor host: {sum(ok for _, ok, _ in RESULTS)}/{len(RESULTS)} passed", flush=True)
    return 0 if RESULTS and all(ok for _, ok, _ in RESULTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
