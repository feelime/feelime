#!/usr/bin/env python3
"""Voice-hold gesture gate (J3): space long-press enters native listening,
release exits.

Split out of device_gesture_verify: the streaming model's cold load (102s
observed on SwiftShader/AVD) dominated this suite, and a failed J3 used to
leave the voice overlay open, poisoning every following suite (the reg2
height-card false failures). The gesture suite now stays pure-gesture; this
suite owns the model warmup AND the overlay teardown.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d
from fv_common import new_recorder

record, RESULTS = new_recorder()


def motion(action, x, y):
    """Inject one real touchscreen event at physical screen coordinates."""
    if action not in {"DOWN", "MOVE", "UP", "CANCEL"}:
        raise ValueError(f"unsupported motion action: {action!r}")
    d.shell(f"input touchscreen motionevent {action} {int(x)} {int(y)}")
    # Let the WebView dispatch the event before the next assertion or event.
    time.sleep(0.06)


def tap_dom(selector, keyboard):
    """Read a DOM element's CSS center, then tap it through ADB."""
    center = d.devtools_eval(
        "(() => { const e = document.querySelector(" + repr(selector) + ");"
        " if (!e) return null; const r = e.getBoundingClientRect();"
        " return [r.left + r.width / 2, r.top + r.height / 2]; })()"
    )
    if not center:
        return False
    offset_x, offset_y = d._DT_OFFSET
    scale = keyboard["<density>"]
    d.tap(center[0] * scale + offset_x, center[1] * scale + offset_y, wait=0.2)
    return True


def overlay_state():
    return d.devtools_eval(
        "(() => { const overlay = document.getElementById('voiceOverlay');"
        " return { open: !!(overlay && overlay.classList.contains('open')),"
        " text: overlay ? overlay.textContent : null }; })()")


def teardown_overlay():
    """Tear the voice overlay down no matter what: this suite was the only
    source of a leaked voice overlay that poisoned every following suite
    (reg2). Idempotent; runs in a finally so mid-case exceptions (DevTools
    death, assertion helper raising) still clean up."""
    state = overlay_state()
    if state and state.get("open"):
        d.shell("input keyevent KEYCODE_BACK")
        time.sleep(1.0)
        state = overlay_state()
        if state and state.get("open"):
            d.shell(f"am force-stop {d.PKG}")
            time.sleep(1.5)


def main():
    d.prepare()
    kb = d.fresh_kb()
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    d.reset_shift(kb)
    d.switch_mode(kb, "英文 Direct")
    kb = d.fresh_kb() or kb

    try:
        run_cases(kb)
    finally:
        teardown_overlay()

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


def run_cases(kb):
    # Cold-model warmup: the FIRST startVoice loads the streaming model
    # (102s observed on SwiftShader/AVD cold boot) - far past any hold the
    # gesture can keep. Start one session through the mic tap path, wait for
    # listening (bounded), stop it; the recognizer stays warm and the case
    # below keeps testing the GESTURE, not the model-load latency.
    warmup_started = tap_dom("#mic", kb)
    if warmup_started:
        for _ in range(80):
            time.sleep(1.5)
            state = overlay_state()
            if state and any(label in (state.get("text") or "")
                             for label in ("聆听", "Listening")):
                break
            if state is not None and not state.get("open") and _ > 8:
                # The overlay never opened; the case's own polling remains
                # the authoritative result for the actual space gesture.
                break
        tap_dom("#mic", kb)
    # The stop is async (stopping -> idle); a startVoice fired while still
    # stopping is swallowed and the hold's overlay never opens (observed as
    # overlayOpen=False). Wait the session ALL the way out before the hold.
    for _ in range(20):
        if overlay_state() and overlay_state().get("open") is False:
            break
        time.sleep(1.0)
    time.sleep(1.0)

    sx, sy = kb["<space>"]
    # A silent process death mid-hold (sherpa EncodeHotwords
    # exit(-1) on an unset modeling_unit; AVD additionally memory-bound)
    # leaves every DevTools eval returning None for the rest of the case -
    # surface the pid so "[None]" is self-explanatory.
    pid_before = d.shell(f"pidof {d.PKG}").strip()
    motion("DOWN", sx, sy)
    listening = None
    try:
        # Loading can legitimately take 20s+ on a cold or slow device (AVD
        # CPU translation); 'listening' breaks early on real hardware.
        # The durable listening oracle is the overlay: open + the 聆听 label.
        for _ in range(60):
            time.sleep(0.5)
            listening = overlay_state()
            if listening and any(label in (listening.get("text") or "")
                                 for label in ("聆听", "Listening")):
                break
        pid_after = d.shell(f"pidof {d.PKG}").strip()
        detail = repr(listening)
        if pid_after != pid_before:
            detail += f" [IME process {pid_before} -> {pid_after}: died mid-hold]"
        record(
            "voice hold: space long-press starts listening overlay",
            bool(listening) and listening.get("open") is True and
                any(label in (listening.get("text") or "")
                    for label in ("聆听", "Listening")),
            detail,
        )
    finally:
        motion("UP", sx, sy)

    released = None
    for _ in range(12):
        time.sleep(0.5)
        released = overlay_state()
        if released and released.get("open") is False:
            break
    record(
        "voice hold: release stops listening overlay",
        bool(released) and released.get("open") is False,
        repr(released),
    )


if __name__ == "__main__":
    main()
