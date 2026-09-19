#!/usr/bin/env python3
"""1.0.6 batch device gates (mode-fallback.md):

- unified degrade: injected degraded engine event renders badge/status/slot,
  a REAL tap on the mode toggle retries the failed mode and the real engine's
  READY clears the degrade end-to-end;
- bottom pad: the settings <select> (real tap + system dialog) lands the pref,
  hello carries it, the keyboard paints the pad OUTSIDE the row budget;
- feel tuning: holdMs/scrubSpeed reach the keyboard runtime through the same
  real path;
- clipboard suppression: clear -> editor hop must NOT resurrect the wiped
  history; a genuinely new clip lifts the marker.

Read-only DevTools for assertions; every interaction this batch checks is a
real adb tap (the select options ride the system dialog, the retry/clear taps
ride the keyboard keys).
"""
import re
import sys
import time
from xml.etree import ElementTree

sys.path.insert(0, __file__.rsplit("/", 1)[0])

import device_verify as d
import fv_common as shared
import device_panel_verify as panel

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def ev(expression):
    return shared.ev(expression)


def pick_select_option(selector, option_text, wait=1.0):
    # canonical copy lives in fv_common (shared settings helpers)
    return shared.pick_select_option(selector, option_text, wait=wait)


def prefs_body():
    return d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_keyboard.xml")


def open_input_page():
    shared.settings_tap('button[data-target="input"]')
    return shared.wait_until(shared.settings_visible_pages,
                             lambda value: value == ["input"], timeout=5.0)


def case_degrade_retry():
    kb = d.fresh_kb(refocus=True)
    if not kb:
        record("degrade: keyboard up", False)
        return
    # Inject the degraded state the coordinator would announce (native-side
    # transitions are JVM-tested; the device gap is the DOM surface + the
    # real retry → real engine READY loop).
    ev("window.Feelime.onEngineState({phase: 'READY', revision: 1,"
       " mode: 'direct', composing: '', degraded: true, degradedActive: true,"
       " failedMode: 'double-pinyin', degradeReason: 'WARMUP_TIMEOUT',"
       " degradeSeq: 5})")
    time.sleep(0.4)
    state = ev("window.Feelime.debugState ? window.Feelime.debugState() : null")
    badge = ev("document.getElementById('modeToggle').classList.contains('degraded')")
    status = ev("!document.getElementById('engineStatus').hidden")
    status_text = ev("document.getElementById('engineStatus').textContent")
    slot = ev("document.getElementById('candidates').hidden")
    degraded_flag = bool(state) and (state.get("degraded") or {}).get("active") is True
    record("degrade: badge + status strip + candidate slot",
           bool(badge) and bool(status) and bool(slot) and degraded_flag
           and ("双拼" in (status_text or "") or "Double Pinyin" in (status_text or "")),
           f"badge={badge} status={status} slot={slot} degraded={state and state.get('degraded')} text={status_text!r}")

    # REAL tap on the mode toggle: the degraded short-press must retry the
    # failed mode, and the REAL engine's READY must clear the state.
    shared.keyboard_tap("#modeToggle", wait=0.8)
    cleared = shared.wait_until(
        lambda: (lambda st: st and st.get("mode") == "double-pinyin"
                 and not (st.get("degraded") or {}).get("active"))(
            ev("window.Feelime.debugState()")),
        lambda value: value is True, timeout=30.0, interval=0.8)
    slot_back = ev("!document.getElementById('candidates').hidden")
    record("degrade: real retry tap lands the real engine and clears",
           bool(cleared) and bool(slot_back), f"cleared={cleared} slot_back={slot_back}")
    if not cleared:
        d.screenshot("/tmp/fv-feel-degrade.png")


def read_kb_geometry():
    return (
        str(ev("document.getElementById('softKeyboard').clientHeight") or ""),
        str(ev("getComputedStyle(document.getElementById('softKeyboard'))"
               ".paddingBottom") or ""),
        str(ev("getComputedStyle(document.documentElement)"
               ".getPropertyValue('--kb-row-h')") or ""),
    )


def wait_rows_settled(timeout=16.0):
    """True steady state: two consecutive identical (clientHeight, padding,
    rowHeight) readings. Baseline-relative waits keep losing to device-state
    transients (the gesture-nav inset resolves on the FIRST show only, and a
    pref change made while hidden lands across a detach/attach)."""
    last = None
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = read_kb_geometry()
        if all(current) and current == last:
            return current
        last = current
        time.sleep(0.8)
    print(f"    rows never settled; last={last}", flush=True)
    return None


def case_bottom_pad():
    # Self-normalize first: a killed earlier run can leave the pad at 36,
    # and every later reading would then wait for a delta that never comes.
    if 'value="36"' in prefs_body() or 'bottom_pad_dp' not in prefs_body():
        d.ensure_keyboard_down()
        if shared.launch_settings() and open_input_page():
            pick_select_option("#bottomPadPortrait", "0 dp")
            shared.wait_until(
                lambda: re.search(r'name="bottom_pad_dp_portrait" value="0"', prefs_body()),
                lambda value: value is True, timeout=8.0)

    def pad_zero_steady():
        d.ensure_keyboard_down()
        return shared.launch_settings() and open_input_page() \
            and pick_select_option("#bottomPadPortrait", "0 dp") and \
            bool(shared.wait_until(
                lambda: re.search(r'name="bottom_pad_dp_portrait" value="0"', prefs_body()),
                lambda value: value is True, timeout=8.0))

    d.fresh_kb(refocus=True)
    settled0 = wait_rows_settled()

    d.ensure_keyboard_down()
    picked = False
    for attempt in range(2):
        if not shared.launch_settings():
            continue
        if open_input_page() and pick_select_option("#bottomPadPortrait", "36 dp"):
            picked = True
            break
        # A wedged settings WebView (resumed instance, stale a11y tree)
        # recovers on a cold start.
        d.shell(f"am force-stop {d.PKG}")
        time.sleep(1.5)
    if not picked:
        record("pad: 36 dp picked in the system dialog", False)
        return
    applied = shared.wait_until(
        lambda: re.search(r'name="bottom_pad_dp_portrait" value="36"', prefs_body()),
        lambda value: value is True, timeout=8.0)
    record("pad: select commit lands the native pref", bool(applied),
           f"prefs={prefs_body()[:160]!r}")

    d.fresh_kb(refocus=True)
    settled36 = wait_rows_settled()

    # Reset to 0 through the same real path; doubles as the restore for
    # later suites/landscape (default flush keyboard).
    reset = pad_zero_steady()
    record("pad: reset to 0 dp", bool(reset), f"prefs={prefs_body()[:160]!r}")
    d.fresh_kb(refocus=True)
    settled0b = wait_rows_settled()

    # UI-18: the pad lives OUTSIDE the content budget - the view grows and
    # the padding carries it, but the ROW height must not move. All three
    # readings are steady states, so the (constant) gesture-nav inset and
    # the base margin cancel out of every comparison.
    #
    # The inset is NOT constant across a force-stop boundary (first show
    # resolves it late): readings straddling that epoch disagree by ~11-12px
    # in both view height and computed padding (row 46→43→49, pad delta 47).
    # Detect the shift via the 0-vs-0b delta and rerun the whole 36→0 cycle
    # so every reading shares one epoch.
    ok = settled36 and settled0 and settled0b
    if ok:
        d_view_warmup = float(settled0b[0]) - float(settled0[0])
        if abs(d_view_warmup) >= 2.0:
            print(f"    [pad] inset epoch shifted (viewDelta0={d_view_warmup}); rerunning the cycle", flush=True)
            d.ensure_keyboard_down()
            picked2 = False
            for attempt in range(2):
                if not shared.launch_settings():
                    continue
                if open_input_page() and pick_select_option("#bottomPadPortrait", "36 dp"):
                    picked2 = True
                    break
                d.shell(f"am force-stop {d.PKG}")
                time.sleep(1.5)
            if picked2:
                shared.wait_until(
                    lambda: re.search(r'name="bottom_pad_dp_portrait" value="36"', prefs_body()),
                    lambda value: value is True, timeout=8.0)
                d.fresh_kb(refocus=True)
                settled0, settled36 = settled0b, wait_rows_settled()
                reset = pad_zero_steady()
                record("pad: reset to 0 dp", bool(reset), f"prefs={prefs_body()[:160]!r}")
                d.fresh_kb(refocus=True)
                settled0b = wait_rows_settled()
            ok = settled36 and settled0 and settled0b
    if not ok:
        record("pad: keyboard paints 36dp outside the content budget", False,
               f"s0={settled0} s36={settled36} s0b={settled0b}")
        return
    (ch36, pad36, row36) = settled36
    (ch0, pad0, row0) = settled0
    (ch0b, pad0b, row0b) = settled0b
    d_view = float(ch36) - float(ch0)
    d_pad = float(pad36.split("px")[0]) - float(pad0.split("px")[0])
    d_view2 = float(ch0b) - float(ch0)
    d_pad2 = float(pad0b.split("px")[0]) - float(pad0.split("px")[0])
    record("pad: keyboard paints 36dp outside the content budget",
           row36 == row0 == row0b
           and abs(d_view - 36.0) < 2.0 and abs(d_pad - 36.0) < 0.6
           and abs(d_view2) < 2.0 and abs(d_pad2) < 0.6,
           f"row36={row36} row0={row0} row0b={row0b} "
           f"viewDelta36={d_view} padDelta36={d_pad} "
           f"viewDelta0={d_view2} padDelta0={d_pad2}")


def set_feel_defaults():
    """Normalize hold/scrub through the real settings path. Runs BEFORE the
    600ms/5x probe (a previous run or crash may have left 600ms behind, which
    silently breaks every fixed-window long-press case in other suites) and
    again after it, so the device is always left at defaults."""
    d.ensure_keyboard_down()
    if not (shared.launch_settings() and open_input_page()):
        print("feel-defaults: settings/input page did not open", flush=True)
        return False
    if not pick_select_option("#holdMs", "350 ms"):
        print("feel-defaults: holdMs 350ms pick failed", flush=True)
        return False
    if not pick_select_option("#scrubSpeed", "3x"):
        print("feel-defaults: scrubSpeed 3x pick failed", flush=True)
        return False
    return bool(shared.wait_until(
        lambda: re.search(r'name="feel_hold_ms" value="350"', prefs_body())
        and not re.search(r'name="feel_hold_ms" value="600"', prefs_body()),
        lambda value: value is True, timeout=8.0))


def case_feel_values():
    # Self-normalize first: the probe values must be reached from defaults,
    # and a polluted device (hold=600 from an earlier run) would otherwise
    # poison every other suite's long-press windows.
    if not set_feel_defaults():
        record("feel: start from defaults", False)
    # Still on the settings input page (case_bottom_pad leaves it open).
    if not pick_select_option("#holdMs", "600 ms"):
        record("feel: 600 ms picked", False)
        set_feel_defaults()
        return
    if not pick_select_option("#scrubSpeed", "5x"):
        record("feel: 5x picked", False)
        set_feel_defaults()
        return
    kb = d.fresh_kb(refocus=True)
    feel = ev("window.Feelime.debugState()")
    hold = feel and feel.get("holdMs")
    scrub = feel and feel.get("scrubSpeed")
    record("feel: holdMs + scrubSpeed reach the keyboard runtime",
           bool(kb) and hold == 600 and scrub == 5,
           f"holdMs={hold} scrubSpeed={scrub}")

    # Restore defaults through the same real path (must reach the prefs even
    # if the probe above failed - later suites long-press against 350ms).
    ok = set_feel_defaults()
    record("feel: defaults restored", bool(ok))


def case_clipboard_suppression():
    d.ensure_keyboard_down()
    # The debug clipboard-seed button writes a GENERATED text to the system
    # clipboard - each tap is a genuinely new clip (new fingerprint).
    if not shared.launch_settings(with_fixtures=True):
        record("clip: settings opens", False)
        return
    d.ensure_keyboard_down()
    seeded = None
    for _ in range(6):
        if panel.setup_tap_desc("feelime-clipboard-seed", wait=0.6):
            ids = re.findall(r"clipboardSeedId=(\d+)",
                             d.shell("logcat -d -s FeelimeSettingsShell:D '*:S'"))
            if ids:
                seeded = ids[-1]
                break
        d.shell("input swipe 540 1750 540 650 220")
        time.sleep(0.5)
    record("clip: fresh clip seeded", seeded is not None, f"id={seeded}")
    if seeded is None:
        return
    seed_text = "feelime-clip-" + seeded

    kb = d.fresh_kb(refocus=True)
    panel.open_panel("clipboard")
    shown = shared.wait_until(
        lambda: seed_text in (panel.panel_items() or []),
        lambda value: value is True, timeout=15.0)
    record("clip: seeded entry reaches the panel", bool(shown),
           f"items={panel.panel_items()[:3]}")

    # Real tap on 清空, then the marker must exist in prefs (polled: the
    # async prefs flush trails the emptied panel by a beat).
    cleared = ev("(() => { const b = document.getElementById('panelClear');"
                 " if (!b) return false; b.click(); return true; })()")
    empty = shared.wait_until(
        lambda: panel.panel_items() == [], lambda value: value is True,
        timeout=8.0)
    marker = shared.wait_until(
        lambda: "suppress_fingerprint" in d.shell(
            f"run-as {d.PKG} cat shared_prefs/feelime_clipboard.xml"),
        lambda value: value is True, timeout=8.0)
    record("clip: clear empties the list and writes the fingerprint marker",
           bool(cleared and empty and marker),
           f"items={panel.panel_items()[:2]} marker={bool(marker)}")

    # THE field bug: hide the keyboard, hop the editor focus (re-capture
    # path) - the wiped entry must stay gone.
    d.ensure_keyboard_down()
    d.fresh_kb(refocus=True)
    panel.open_panel("clipboard")
    still_empty = shared.wait_until(
        lambda: panel.panel_items() == [], lambda value: value is True,
        timeout=8.0)
    record("clip: editor hop does not resurrect the cleared history",
           bool(still_empty), f"items={panel.panel_items()[:3]}")

    # A genuinely new clip (different fingerprint) lifts the marker.
    d.ensure_keyboard_down()
    seeded2 = None
    for _ in range(4):
        if panel.setup_tap_desc("feelime-clipboard-seed", wait=0.6):
            ids = re.findall(r"clipboardSeedId=(\d+)",
                             d.shell("logcat -d -s FeelimeSettingsShell:D '*:S'"))
            if ids and ids[-1] != seeded:
                seeded2 = ids[-1]
                break
        time.sleep(0.5)
    d.fresh_kb(refocus=True)
    panel.open_panel("clipboard")
    lifted = shared.wait_until(
        lambda: ("feelime-clip-" + seeded2) in (panel.panel_items() or []),
        lambda value: value is True, timeout=15.0)
    record("clip: a new clip records and lifts the suppression",
           bool(lifted), f"id2={seeded2} items={panel.panel_items()[:3]}")


def case_feel_bilingual():
    d.ensure_keyboard_down()
    opened = False
    for attempt in range(2):
        if shared.launch_settings() and open_input_page():
            opened = True
            break
        # A wedged resumed settings WebView recovers on a cold start
        # (same recovery as the pad case).
        d.shell(f"am force-stop {d.PKG}")
        time.sleep(1.5)
    if not opened:
        record("feel i18n: input page opens", False)
        return
    # These reads are SETTINGS-page DOM: they must go through sev (the
    # settings/index.html target). ev targets the KEYBOARD WebView, and the
    # feelime.local target list is newest-first - a recently shown keyboard
    # would answer every read with nulls that look like missing i18n.
    start_title = shared.wait_until(
        lambda: shared.sev("document.getElementById('feelTitle')?.textContent"),
        lambda value: bool(value), timeout=6.0)
    # The language select lives on the HOME page - go back explicitly.
    shared.settings_tap('[data-page="input"] [data-back]')
    if not pick_select_option("#uiLanguage", "English"):
        record("feel i18n: language switched to English", False)
        return
    if not open_input_page():
        record("feel i18n: input page opens (en)", False)
        return
    en_title = shared.wait_until(
        lambda: shared.sev("document.getElementById('feelTitle').textContent"),
        lambda value: value == "Keyboard feel", timeout=6.0)
    en_pad = shared.sev(
        "[...document.querySelectorAll('#sec-feel .row-label span')]"
        ".some(s => s.textContent === 'Bottom padding')")
    # A previous run's failed restore can leave the device on English; the
    # contract under test is the TRANSLATION PAIR, not the starting locale.
    zh_ok = start_title in ("键盘手感", "Keyboard feel")
    record("feel i18n: new rows translate zh -> en",
           zh_ok and bool(en_title) and bool(en_pad),
           f"start={start_title!r} en={en_title!r} padLabel={en_pad}")
    # Restore the default locale through the same real path.
    shared.settings_tap('[data-page="input"] [data-back]')
    restore_ok = pick_select_option("#uiLanguage", "跟随系统") or \
        pick_select_option("#uiLanguage", "Follow system")
    if not restore_ok:
        record("feel i18n: language restored", False)
    else:
        restored = shared.wait_until(
            lambda: shared.sev("document.getElementById('uiLanguage').value"),
            lambda value: value == "auto", timeout=6.0)
        record("feel i18n: language restored", restored == "auto")


def main():
    d.shell("settings put system accelerometer_rotation 0")
    d.shell("settings put system user_rotation 0")
    # Cold-start SetupActivity: a resumed instance was created without the
    # fixture extra, and prepare would then find no test field at all.
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(1.0)
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    case_degrade_retry()
    case_bottom_pad()
    case_feel_values()
    case_clipboard_suppression()
    case_feel_bilingual()

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== feel/degrade device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
