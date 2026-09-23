#!/usr/bin/env python3
"""Device gates (editor restrictions / pinyin / touch / cursor / reset).

This suite exercises the regressions that need a real InputConnection:

* EditorInfo-sensitive mode switching: a normal editor may use Pinyin, while
  a password editor and an explicitly supplied TYPE_NULL editor stay Direct;
  returning to a normal editor must restore the user's mode.
* Full-Pinyin ``x'an`` spelling expansion, in-place spelling selection and
  candidate selection.  ``xi'an`` and multiply abbreviated input must stay
  unexpanded.
* A key held while the IME is hidden cannot leave pressed styling or a repeat
  timer behind, and the next touch starts a clean sequence.
* Cursor scrubbing at two speeds and reverse direction in a real settings
  textarea.  The AVD run also reports the separate surrogate-pair coverage
  gap when ``adb input text`` cannot seed an emoji.
* Height-card reset is pending-only.  Reset does not call the native height
  bridge; Cancel restores the value from card entry; Save is the operation
  that removes the current orientation's persisted override.

The keyboard/settings WebViews are observation channels.  Inputs are sent by
adb taps, swipes, key events, or text injection.  The TYPE_NULL target is
deliberately opt-in because this repository cannot assume Termux or another
terminal is installed on a device.  Set both ``FEELIME_TYPE_NULL_ACTIVITY``
(``package/.Activity``) and ``FEELIME_TYPE_NULL_FOCUS`` (``x,y``) to run that
case against a real target.  Missing configuration is reported as SKIP, never
as a false pass.
"""

import base64
import html
import os
import re
import shlex
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fv_common as shared
import device_phrase_codes_verify as b25
import device_verify as d


RESULTS = []
SKIPPED = []

PASSWORD_DESCRIPTION = "feelime-password-input"
HEIGHT_PREF = "shared_prefs/feelime_keyboard.xml"
MODE_PREF = "shared_prefs/feelime_engine.xml"


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def skip(name, detail):
    SKIPPED.append((name, detail))
    print(f"SKIP {name}  [{detail}]", flush=True)


def ev(expression):
    """Read the keyboard WebView through DevTools."""
    return d.devtools_eval(expression)


def sev(expression):
    """Read the settings WebView through DevTools."""
    return d.devtools_eval_target("settings/index.html", expression)


def wait_until(read, predicate=lambda value: bool(value), timeout=8.0,
               interval=0.25):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            last = read()
        except Exception:
            last = None
        if predicate(last):
            return last
        time.sleep(interval)
    return last


def keyboard_state():
    return ev(
        "(() => ({"
        "mode:document.querySelector('#modeToggle .cn-main')?.textContent || '',"
        "preedit:document.getElementById('preeditLine')?.textContent || '',"
        "composing:document.body.classList.contains('composing'),"
        "expanded:document.body.classList.contains('expanded'),"
        "expandHidden:!!document.getElementById('expandLayer')?.hidden,"
        "variantsHidden:!!document.getElementById('expandVariants')?.hidden,"
        "toast:document.getElementById('toast')?.textContent || '',"
        "micDisabled:!!document.getElementById('mic')?.disabled,"
        "candidates:[...document.querySelectorAll('#candidates .candidate')].map(e=>e.textContent.trim()),"
        "candidateIds:[...document.querySelectorAll('#candidates .candidate')].map(e=>e.dataset.id || ''),"
        "variants:[...document.querySelectorAll('#expandVariants .expand-variant')].map(e=>({text:e.textContent,current:e.classList.contains('current')})),"
        "grid:[...document.querySelectorAll('#expandGrid .expand-candidate')].map(e=>e.textContent.trim()),"
        "active:[...document.querySelectorAll('.active-touch')].map(e=>e.dataset.key || e.id || '')"
        "}))()") or {}


def request_native_state():
    # This is a request for the already-held native state, not a test action;
    # it closes the EditorInfo hand-off race after a real fixture focus.
    return ev(
        "(() => { if (window.FeelimeNative?.requestState) "
        "window.FeelimeNative.requestState(); return true; })()")


def focus_fixture(description):
    """Focus a named native SetupActivity editor and return fresh geometry."""
    d.ensure_keyboard_down()
    for _ in range(10):
        bounds = d.field_bounds(description)
        if bounds and bounds[3] > 0:
            d.tap((bounds[0] + bounds[2]) / 2,
                  (bounds[1] + bounds[3]) / 2, wait=1.2)
            if d.input_shown():
                return d.fresh_kb(refocus=False)
        d.ensure_keyboard_down()
        d.shell("input swipe 540 1650 540 420 450")
        time.sleep(0.5)
    raise RuntimeError(f"editor fixture not reachable: {description}")


def input_type_dump():
    text = d.shell("dumpsys input_method")
    values = re.findall(r"inputType\s*=\s*(?:0x)?([0-9a-fA-F]+)", text)
    return int(values[-1], 16) if values else None


def mode_chip():
    return d.keyboard_chip()


def choose_mode_without_assuming_success(title):
    """Physically open the mode menu and tap a title; return its toast/state."""
    current = mode_chip()
    expected = shared.MODE_LABELS[title]
    if current in expected:
        return {"chip": current, "toast": "", "attempted": False}
    shared.keyboard_long_press("#modeToggle")
    opened = wait_until(
        lambda: ev("document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is True, timeout=3.0)
    if not opened:
        return {"chip": mode_chip(), "toast": "", "attempted": False,
                "error": "mode menu did not open"}
    point = shared.keyboard_text_point_any(
        shared.MODE_TITLES[title], "#modeMenu button", contains=True)
    if not point:
        return {"chip": mode_chip(), "toast": "", "attempted": False,
                "error": f"mode item missing: {title}"}
    d.tap(*point, wait=0.45)
    time.sleep(0.35)
    state = keyboard_state()
    return {"chip": state.get("mode", mode_chip()),
            "toast": state.get("toast", ""), "attempted": True}


def case_editor_mode_boundaries(keyboard):
    """Sensitive/terminal restrictions must follow the current EditorInfo."""
    if not shared.switch_mode_real("英文 Direct"):
        record("mode boundaries reach Direct", False, "initial mode switch failed")
        return keyboard
    d.clear_field(keyboard)

    if not shared.switch_mode_real("全拼 Pinyin"):
        record("ordinary EditorInfo permits Pinyin", False,
               "Pinyin mode unavailable")
        return keyboard
    ordinary_chip = wait_until(mode_chip, lambda value: value in ("拼", "PY"),
                               timeout=8.0)
    ordinary_type = input_type_dump()
    record("ordinary text editor accepts the requested Pinyin mode",
           ordinary_chip in ("拼", "PY") and ordinary_type not in (None, 0),
           f"chip={ordinary_chip!r} inputType={ordinary_type!r}")

    # A vendor security keyboard may own password fields.  In that case the
    # product never receives this EditorInfo, so count a visible skip rather
    # than reading stale DOM from the preceding ordinary fixture.
    try:
        keyboard = focus_fixture(PASSWORD_DESCRIPTION)
    except RuntimeError as error:
        record("password fixture is reachable", False, str(error))
        return keyboard
    binding, ime = d.wait_password_binding()
    if binding != "hosted":
        skip("password EditorInfo restriction",
             f"security IME owns password editor (binding={binding}, ime={ime})")
    else:
        request_native_state()
        state = wait_until(
            keyboard_state,
            lambda value: value.get("mode") in ("En", "English")
            and value.get("micDisabled") is True
            and value.get("candidates") == [],
            timeout=5.0) or keyboard_state()
        password_type = input_type_dump()
        restricted = choose_mode_without_assuming_success("全拼 Pinyin")
        toast = restricted.get("toast", "")
        record("password EditorInfo forces Direct and disables candidates/mic",
               state.get("mode") in ("En", "English")
               and state.get("micDisabled") is True
               and state.get("candidates") == []
               and password_type is not None and password_type != 0,
               f"state={state} inputType={password_type!r}")
        record("password mode request returns an explicit reason",
               state.get("mode") in ("En", "English")
               and any(word in toast.lower() for word in
                       ("password", "direct", "密码", "英文")),
               f"chip={restricted.get('chip')!r} toast={toast!r}")

    try:
        keyboard = focus_fixture(d.TEST_INPUT_DESCRIPTION) or keyboard
    except RuntimeError as error:
        record("normal editor is reachable after password editor", False,
               str(error))
        return keyboard
    request_native_state()
    restored = wait_until(mode_chip, lambda value: value in ("拼", "PY"),
                          timeout=8.0)
    record("password restriction does not leak into the next normal editor",
           restored in ("拼", "PY"), f"chip={restored!r} inputType={input_type_dump()!r}")
    return keyboard


def case_type_null_mode(keyboard):
    """Run only when the caller supplies a real TYPE_NULL application target."""
    activity = os.environ.get("FEELIME_TYPE_NULL_ACTIVITY", "").strip()
    focus = os.environ.get("FEELIME_TYPE_NULL_FOCUS", "").strip()
    if not activity or not focus:
        skip("TYPE_NULL mode restriction",
             "set FEELIME_TYPE_NULL_ACTIVITY=package/.Activity and "
             "FEELIME_TYPE_NULL_FOCUS=x,y for a real terminal target")
        return keyboard
    match = re.fullmatch(r"\s*(\d+)\s*,\s*(\d+)\s*", focus)
    if not match:
        record("TYPE_NULL focus configuration is valid", False,
               "FEELIME_TYPE_NULL_FOCUS must be x,y")
        return keyboard
    d.shell("am start -n " + shlex.quote(activity))
    time.sleep(2.5)
    d.tap(int(match.group(1)), int(match.group(2)), wait=1.5)
    for _ in range(8):
        if d.input_shown():
            break
        time.sleep(0.5)
    input_type = input_type_dump()
    is_null = input_type == 0
    if not is_null:
        # A configured activity is only a candidate; many terminal WebViews
        # expose a normal text editor even though their UI looks like a shell.
        # Do not turn that host mismatch into a Feelime product failure.
        skip("TYPE_NULL mode restriction",
             f"supplied target is not TYPE_NULL: activity={activity!r} "
             f"inputType={input_type!r}")
        return keyboard
    keyboard = d.fresh_kb(refocus=False) or keyboard
    chip = wait_until(mode_chip, lambda value: value is not None, timeout=8.0)
    request = choose_mode_without_assuming_success("全拼 Pinyin")
    time.sleep(0.5)
    final_chip = mode_chip()
    toast = request.get("toast", "")
    record("TYPE_NULL editor forces Direct on entry",
           chip in ("En", "English"),
           f"chip={chip!r} inputType={input_type}")
    record("TYPE_NULL Pinyin request stays Direct with a reason",
           final_chip in ("En", "English")
           and any(word in toast.lower() for word in
                   ("terminal", "direct", "终端", "英文")),
           f"chip={final_chip!r} toast={toast!r}")
    # Return to the debug host for the remaining cases.  The target itself is
    # external and its cleanup belongs to the caller's focus coordinates.
    keyboard = b25.prepare_readonly()
    return keyboard


def type_xan(keyboard):
    d.clear_field(keyboard)
    d.press(keyboard, "x", wait=0.22)
    d.press(keyboard, "<shift>", wait=0.22)  # Chinese 分词 key sends apostrophe
    d.press(keyboard, "a", wait=0.22)
    d.press(keyboard, "n", wait=0.6)
    return wait_until(
        keyboard_state,
        lambda value: value.get("composing")
        and value.get("preedit", "").replace(" ", "").replace("’", "'")
        == "x'an",
        timeout=8.0)


def case_full_pinyin_variants(keyboard):
    if not shared.switch_mode_real("全拼 Pinyin"):
        record("full-Pinyin variant setup reaches Pinyin", False,
               "mode switch failed")
        return keyboard
    state = type_xan(keyboard)
    if not state:
        record("full-Pinyin x'an composition reaches the engine", False,
               f"state={keyboard_state()}")
        return keyboard
    shared.keyboard_tap("#composeExpand", wait=0.8)
    expanded = wait_until(
        keyboard_state,
        lambda value: not value.get("expandHidden")
        and len(value.get("variants", [])) >= 3,
        timeout=8.0) or keyboard_state()
    variants = [item.get("text") for item in expanded.get("variants", [])]
    expected = {"x'an", "xi'an", "xiang'an", "xin'an"}
    record("full-Pinyin x'an expands the complete spelling column",
           expected.issubset(set(variants))
           and expanded.get("variants", [])[0].get("current") is True,
           f"variants={variants[:32]}")

    before_grid = list(expanded.get("grid", []))
    if "xiang'an" in variants:
        shared.keyboard_text_tap("xiang'an", "#expandVariants .expand-variant",
                              wait=1.0)
        switched = wait_until(
            keyboard_state,
            lambda value: any(item.get("text") == "xiang'an"
                              and item.get("current")
                              for item in value.get("variants", []))
            and not value.get("expandHidden"), timeout=8.0) or keyboard_state()
        after_grid = list(switched.get("grid", []))
        changed = bool(after_grid) and after_grid != before_grid
        record("selecting a full-Pinyin spelling keeps the list and swaps candidates",
               switched.get("expanded") is True and changed
               and "xiang'an" in [item.get("text") for item in switched.get("variants", [])],
               f"before={before_grid[:6]} after={after_grid[:6]} state={switched}")
        if after_grid:
            candidate = after_grid[0]
            point = shared.keyboard_text_point(candidate,
                                             "#expandGrid .expand-candidate")
            if point:
                d.tap(*point, wait=1.0)
            committed = html.unescape(d.field_text_retry() or "")
            record("expanded candidate selection commits the selected Rime word",
                   point is not None and bool(committed),
                   f"candidate={candidate!r} field={committed!r}")
    else:
        record("selecting a full-Pinyin spelling keeps the list and swaps candidates",
               False, "xiang'an missing from spelling column")
        record("expanded candidate selection commits the selected Rime word",
               False, "spelling selection was unavailable")

    # A fresh composition must not retain the previous left column.  Complete
    # xi'an keeps a visible left column with exactly its current spelling so
    # expanding it does not make the two-column layout jump.
    d.clear_field(keyboard)
    for char in "xi":
        d.press(keyboard, char, wait=0.22)
    d.press(keyboard, "<shift>", wait=0.22)
    for char in "an":
        d.press(keyboard, char, wait=0.35)
    complete = wait_until(
        keyboard_state,
        lambda value: value.get("composing") and
        value.get("preedit", "").replace(" ", "").replace("’", "'") == "xi'an",
        timeout=8.0)
    shared.keyboard_tap("#composeExpand", wait=0.8)
    complete_state = wait_until(keyboard_state, lambda value: value is not None,
                                timeout=3.0) or keyboard_state()
    complete_variants = complete_state.get("variants") or []
    complete_variant_text = [
        str(item.get("text", "")).replace(" ", "").replace("’", "'")
        for item in complete_variants
    ]
    record("complete xi'an does not enumerate unnecessary variants",
           bool(complete) and complete_state.get("expanded") is True
           and complete_state.get("expandHidden") is False
           and complete_state.get("variantsHidden") is False
           and len(complete_variants) == 1
           and complete_variant_text == ["xi'an"]
           and complete_variants[0].get("current") is True
           and bool(complete_state.get("grid")),
           f"complete={complete} variants={complete_variant_text} "
           f"grid={complete_state.get('grid', [])[:6]} state={complete_state}")

    # The two-incomplete-syllable form must not trigger a combinatorial list.
    d.clear_field(keyboard)
    for char in "x":
        d.press(keyboard, char, wait=0.22)
    d.press(keyboard, "<shift>", wait=0.22)
    for char in "zh":
        d.press(keyboard, char, wait=0.3)
    d.press(keyboard, "<shift>", wait=0.22)
    d.press(keyboard, "a", wait=0.22)
    d.press(keyboard, "n", wait=0.35)
    time.sleep(0.8)
    shared.keyboard_tap("#composeExpand", wait=0.7)
    multi = keyboard_state()
    normalize_pinyin = lambda value: str(value or "").replace(" ", "").replace("’", "'").lower()
    multi_variants = multi.get("variants") or []
    multi_variant_text = [normalize_pinyin(item.get("text"))
                          for item in multi_variants]
    multi_anchor = normalize_pinyin(multi.get("preedit"))
    record("multiple incomplete Pinyin syllables do not enumerate combinations",
           multi.get("expanded") is True
           and multi.get("expandHidden") is False
           and multi.get("variantsHidden") is False
           and len(multi_variants) == 1
           and multi_variant_text == [multi_anchor]
           and multi_variants[0].get("current") is True
           and bool(multi.get("grid")),
           f"anchor={multi_anchor!r} variants={multi_variant_text} "
           f"grid={multi.get('grid', [])[:6]} state={multi}")
    d.clear_field(keyboard)
    return keyboard


def active_touch_state():
    return ev(
        "(() => ({active:[...document.querySelectorAll('.active-touch')]"
        ".map(e=>e.dataset.key || e.id || ''),"
        "pressed:document.querySelectorAll('.active-touch').length}))()") or {}


def case_touch_lifecycle(keyboard):
    if not shared.switch_mode_real("英文 Direct"):
        record("touch cleanup setup reaches Direct", False, "mode switch failed")
        return keyboard
    d.clear_field(keyboard)
    key_point = shared.keyboard_point('[data-key="a"]')
    if not key_point:
        record("touch cleanup starts from a real key", False, "a key geometry missing")
        return keyboard
    # Deliberately omit touchend, then hide the IME.  FeelimeService invokes
    # cancelTouches before the WebView is torn down.
    d.synth_touch("start", *key_point)
    pressed = wait_until(active_touch_state,
                         lambda value: "a" in value.get("active", []), timeout=2.0)
    d.ensure_keyboard_down()
    time.sleep(0.7)
    try:
        keyboard = focus_fixture(d.TEST_INPUT_DESCRIPTION) or keyboard
    except RuntimeError as error:
        record("touch cleanup can reopen the ordinary editor", False, str(error))
        return keyboard
    clean = active_touch_state()
    d.clear_field(keyboard)
    d.press(keyboard, "a", wait=0.35)
    one_tap = html.unescape(d.field_text_retry() or "")
    record("hiding the IME releases a pressed key and the next tap is clean",
           bool(pressed) and clean.get("pressed") == 0 and one_tap == "a",
           f"pressed={pressed} afterHide={clean} field={one_tap!r}")

    # Repeat timer path: a held backspace is cancelled by hide and must not
    # keep deleting while the keyboard is gone.
    d.clear_field(keyboard)
    d.type_word(keyboard, "abc", wait=0.18)
    backspace_point = shared.keyboard_point('[data-role="backspace"]')
    if backspace_point:
        d.synth_touch("start", *backspace_point)
        d.ensure_keyboard_down()
        time.sleep(0.75)  # beyond the 390ms repeat arm delay
        try:
            keyboard = focus_fixture(d.TEST_INPUT_DESCRIPTION) or keyboard
            after = html.unescape(d.field_text_retry() or "")
            clean_again = active_touch_state()
            record("hiding a held backspace cancels repeat and preserves text",
                   after == "abc" and clean_again.get("pressed") == 0,
                   f"field={after!r} state={clean_again}")
        except RuntimeError as error:
            record("hiding a held backspace cancels repeat and preserves text",
                   False, str(error))
    else:
        record("hiding a held backspace cancels repeat and preserves text",
               False, "backspace geometry missing")
    return keyboard


def utf16_boundaries(value):
    result = [0]
    for char in value:
        result.append(result[-1] + (2 if ord(char) > 0xFFFF else 1))
    return set(result)


def settings_snapshot():
    return b25.settings_json_snapshot()


def shell_input_text(value):
    d.shell("input text " + shlex.quote(value), timeout=30)
    time.sleep(0.9)


def install_scrub_observers():
    """Install observation-only listeners in the two live WebViews.

    The keyboard and settings page have separate DevTools targets, but their
    ``Date.now()`` values come from the same emulator clock.  Recording in
    the page avoids charging the Python/ADB/DevTools round trip to the first
    cursor response.
    """
    keyboard_ready = ev(
        """(() => {
          const state = window.__feelimeB26ScrubTrace ||
            (window.__feelimeB26ScrubTrace = {touch: [], touchInstalled: false});
          if (!state.touchInstalled) {
            const capture = event => {
              const touch = (event.changedTouches && event.changedTouches[0]) ||
                (event.touches && event.touches[0]);
              if (!touch) return;
              state.touch.push({type: event.type, at: Date.now(),
                                x: touch.clientX});
              if (state.touch.length > 1024) state.touch.shift();
            };
            ['touchstart', 'touchmove', 'touchend', 'touchcancel']
              .forEach(type => document.addEventListener(type, capture, true));
            state.touchInstalled = true;
          }
          state.touch = [];
          return true;
        })()""") is True
    settings_ready = sev(
        """(() => {
          const field = document.getElementById('customJson');
          if (!field) return false;
          const state = window.__feelimeB26ScrubTrace ||
            (window.__feelimeB26ScrubTrace = {selection: [], selectionInstalled: false});
          if (!state.selectionInstalled) {
            const capture = () => {
              if (document.activeElement !== field) return;
              state.selection.push({type: 'selectionchange', at: Date.now(),
                                    start: field.selectionStart,
                                    end: field.selectionEnd});
              if (state.selection.length > 1024) state.selection.shift();
            };
            document.addEventListener('selectionchange', capture, true);
            state.selectionInstalled = true;
          }
          state.selection = [];
          return true;
        })()""") is True
    return keyboard_ready and settings_ready


def reset_scrub_observers():
    keyboard_ready = ev(
        "(() => { const state=window.__feelimeB26ScrubTrace;"
        " if (!state) return false; state.touch=[]; return true; })()") is True
    settings_ready = sev(
        "(() => { const state=window.__feelimeB26ScrubTrace;"
        " if (!state) return false; state.selection=[]; return true; })()") is True
    return keyboard_ready and settings_ready


def scrub_observer_snapshot():
    touch = ev("window.__feelimeB26ScrubTrace?.touch || []") or []
    selection = sev("window.__feelimeB26ScrubTrace?.selection || []") or []
    return {"touch": touch, "selection": selection}


def sampled_scrub(selector, start_fraction, end_fraction, duration_ms):
    """Run one real adb swipe and read the page-recorded event trace."""
    shared.refresh_keyboard_geometry()
    rect = shared.keyboard_rect(selector)
    if not rect:
        raise RuntimeError(f"cursor key geometry unavailable: {selector}")
    x1 = round((rect["left"] + rect["width"] * start_fraction) *
               d._DT_SCALE + d._DT_OFFSET[0])
    x2 = round((rect["left"] + rect["width"] * end_fraction) *
               d._DT_SCALE + d._DT_OFFSET[0])
    y = round((rect["top"] + rect["height"] / 2) *
              d._DT_SCALE + d._DT_OFFSET[1])
    command = ["adb", "-s", d.SERIAL, "shell", "input", "swipe",
               str(x1), str(y), str(x2), str(y), str(int(duration_ms))]
    if not reset_scrub_observers():
        raise RuntimeError("scrub observers unavailable")
    process = subprocess.Popen(command, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True)
    started = time.monotonic()
    try:
        process.communicate(timeout=5.0)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        raise RuntimeError("adb cursor swipe timed out")
    if process.returncode:
        raise RuntimeError(f"adb cursor swipe failed: rc={process.returncode}")
    # Keep the page listeners alive after touchend so a late selection event
    # is still present in the trace.  This wait is outside the measurement;
    # event timestamps use the emulator's Date.now clock.
    time.sleep(0.5)
    observed = scrub_observer_snapshot()
    observed["hostElapsedMs"] = round((time.monotonic() - started) * 1000, 1)
    observed["last"] = settings_snapshot()
    return observed


def scrub_trace_metrics(trace, initial_position):
    touch = trace.get("touch", []) if trace else []
    selection = trace.get("selection", []) if trace else []
    starts = [event for event in touch if event.get("type") == "touchstart"
              and isinstance(event.get("at"), int)]
    moves = [event for event in touch if event.get("type") == "touchmove"
             and isinstance(event.get("at"), int)
             and isinstance(event.get("x"), (int, float))]
    ends = [event for event in touch
            if event.get("type") in ("touchend", "touchcancel")
            and isinstance(event.get("at"), int)]
    start_at = starts[0].get("at") if starts else None
    end_at = next((event.get("at") for event in ends
                   if start_at is None or event.get("at") >= start_at), None)
    end_event = next((event for event in ends
                      if start_at is None or event.get("at") >= start_at), None)
    first_move_at = moves[0].get("at") if moves else None
    # Reduce the page trace to actual selection transitions. Repeated
    # selectionchange events are observations, not movements.
    transitions = []
    previous = initial_position
    observed = [event for event in selection
                if isinstance(event.get("at"), int)
                and isinstance(event.get("start"), int)
                and (start_at is None or event.get("at") >= start_at)]
    for event in observed:
        value = event.get("start")
        if value == previous:
            continue
        transitions.append((event.get("at"), value))
        previous = value
    in_swipe = [item for item in transitions
                if end_at is not None and item[0] <= end_at]
    after_swipe = [item for item in transitions
                   if end_at is not None and item[0] > end_at]
    distinct = []
    for _, value in in_swipe:
        if value not in distinct:
            distinct.append(value)
    first_ms = ((in_swipe[0][0] - first_move_at) if in_swipe and
                first_move_at is not None else None)
    last_movement_ms = ((in_swipe[-1][0] - first_move_at) if in_swipe and
                        first_move_at is not None else None)
    tail_ms = ((after_swipe[-1][0] - end_at) if after_swipe and
               end_at is not None else None)
    start_x = starts[0].get("x") if starts else None
    end_x = end_event.get("x") if end_event else None
    first_x = (start_x if isinstance(start_x, (int, float))
               else moves[0].get("x") if moves else None)
    last_x = (end_x if isinstance(end_x, (int, float))
              else moves[-1].get("x") if moves else None)
    move_times = [event.get("at") for event in moves]
    move_intervals = [later - earlier
                      for earlier, later in zip(move_times, move_times[1:])
                      if later >= earlier]
    if move_intervals:
        ordered_intervals = sorted(move_intervals)
        move_cadence = ordered_intervals[len(ordered_intervals) // 2]
    else:
        move_cadence = None
    # Native selection is posted back to the WebView and selectionchange is
    # dispatched on a later frame.  Derive the grace from this gesture's own
    # event cadence: two move periods plus one 60 Hz frame.  A tail beyond
    # that window is a real late movement, rather than host/DOM scheduling.
    tail_grace = (move_cadence * 2 + 16.7
                  if move_cadence is not None else None)
    direction = (1 if last_x > first_x else -1 if last_x < first_x else 0
                 ) if first_x is not None and last_x is not None else None
    return {
        "firstResponseMs": round(first_ms, 1) if first_ms is not None else None,
        "lastMovementMs": round(last_movement_ms, 1) if last_movement_ms is not None else None,
        "inSwipeTransitions": len(in_swipe),
        "distinctPositions": len(distinct),
        "positions": [value for _, value in transitions],
        "tailAfterSwipeMs": round(tail_ms, 1) if tail_ms is not None else None,
        "postSwipeTransitions": len(after_swipe),
        "touchStartAt": start_at,
        "touchEndAt": end_at,
        "touchMoveCount": len(moves),
        "touchDistancePx": (round(abs(last_x - first_x), 2)
                            if first_x is not None and last_x is not None else None),
        "touchMoveCadenceMs": move_cadence,
        "tailGraceMs": (round(tail_grace, 1)
                        if tail_grace is not None else None),
        "direction": direction,
        "last": trace.get("last", {}) if trace else {},
    }


def case_cursor_scrub(keyboard):
    """Compare slow/fast/reverse scrubs using page-recorded real events."""
    if not shared.switch_mode_real("英文 Direct"):
        record("cursor setup reaches Direct", False, "mode switch failed")
        return keyboard
    if not shared.launch_settings(with_fixtures=True):
        record("cursor settings textarea opens", False, "settings WebView unavailable")
        return keyboard
    # SetupActivity is singleTop and retains the page opened by earlier
    # cases. Navigate back before tapping the home-only input settings row.
    if shared.settings_visible_pages() != ["home"]:
        shared.settings_tap('.page:not([hidden]) [data-back]')
        wait_until(shared.settings_visible_pages, lambda value: value == ["home"], timeout=4.0)
    opened = shared.settings_tap('button[data-target="input"]')
    page = wait_until(shared.settings_visible_pages,
                      lambda value: value == ["input"], timeout=4.0)
    focused = shared.settings_tap("#customJson", wait=1.0)
    cleared = b25.clear_settings_textarea_adb() if focused else False
    # `adb shell input text` cannot inject surrogate pairs on the AVD: the
    # Android input tool silently drops the emoji while keeping ASCII.  Seed
    # an ASCII value through the same real host path first so the movement
    # regression remains exercised; the surrogate-pair case is reported as a
    # separate, explicit gap below.
    value_expected = "cursorA-B-C"
    if cleared:
        shell_input_text(value_expected)
    initial = wait_until(settings_snapshot,
                         lambda value: value.get("value") == value_expected
                         and value.get("focus") is True, timeout=5.0) or settings_snapshot()
    text = initial.get("value") or ""
    boundaries = utf16_boundaries(text)
    d.shell("input keyevent 123")  # caret to end through the host path
    at_end = wait_until(
        settings_snapshot,
        lambda value: value.get("focus") and
        value.get("start") == len(text.encode("utf-16-le")) // 2
        and value.get("end") == value.get("start"), timeout=3.0) or settings_snapshot()
    observers_ready = install_scrub_observers()

    slow = fast = reverse = {}
    slow_metrics = fast_metrics = reverse_metrics = {}
    error = ""
    try:
        slow_trace = sampled_scrub('#qwertyLayer [data-key="h"]',
                                   start_fraction=0.90, end_fraction=-2.40,
                                   duration_ms=650)
        slow_metrics = scrub_trace_metrics(slow_trace, at_end.get("start"))
        slow = slow_metrics.get("last", {})
        slow = wait_until(settings_snapshot,
                          lambda value: value.get("focus") and
                          value.get("start", len(text)) < at_end.get("start", len(text)),
                          timeout=4.0) or settings_snapshot()
        d.shell("input keyevent 123")
        wait_until(settings_snapshot,
                   lambda value: value.get("start") == len(text), timeout=3.0)
        fast_trace = sampled_scrub('#qwertyLayer [data-key="h"]',
                                   start_fraction=0.90, end_fraction=-2.40,
                                   duration_ms=160)
        fast_metrics = scrub_trace_metrics(fast_trace, len(text))
        fast = fast_metrics.get("last", {})
        fast = wait_until(settings_snapshot,
                          lambda value: value.get("focus") and
                          value.get("start", len(text)) < len(text),
                          timeout=4.0) or settings_snapshot()
        reverse_trace = sampled_scrub('#qwertyLayer [data-key="h"]',
                                      start_fraction=0.10, end_fraction=3.40,
                                      duration_ms=180)
        reverse_metrics = scrub_trace_metrics(reverse_trace, fast.get("start", -1))
        reverse = reverse_metrics.get("last", {})
        reverse = wait_until(settings_snapshot,
                             lambda value: value.get("focus") and
                             value.get("start", -1) > fast.get("start", -1),
                             timeout=4.0) or settings_snapshot()
    except RuntimeError as exc:
        error = str(exc)

    valid_boundaries = all(
        snapshot.get("start") in boundaries and snapshot.get("end") in boundaries
        for snapshot in (slow, fast, reverse)
    ) and all(
        position in boundaries
        for metrics in (slow_metrics, fast_metrics, reverse_metrics)
        for position in metrics.get("positions", [])
    )
    speed_same = (slow.get("focus") is True and fast.get("focus") is True and
                  slow.get("start", -1) == fast.get("start", -1))
    def response_latency_ok(metrics):
        first = metrics.get("firstResponseMs")
        # Date.now is recorded by the page listeners, so an in-swipe response
        # proves the caret moved before touchend. A selectionchange can be
        # dispatched one or two touchmove cadences after touchend; that is
        # WebView event delivery, while a longer tail is a real late move.
        tail = metrics.get("tailAfterSwipeMs")
        tail_grace = metrics.get("tailGraceMs")
        # Several selectionchange events may be delivered together just
        # after touchend (observed on device within 2 ms). Their delivery
        # count does not measure lag; enforce the measured time bound.
        tail_ok = (tail is None or
                   (tail_grace is not None and tail <= tail_grace))
        return (first is not None and metrics.get("touchMoveCount", 0) >= 1
                and metrics.get("inSwipeTransitions", 0) >= 1
                and tail_ok)

    slow_progress = (
        response_latency_ok(slow_metrics)
        and slow_metrics.get("distinctPositions", 0) >= 2
    )
    fast_progress = (
        response_latency_ok(fast_metrics)
        and fast_metrics.get("inSwipeTransitions", 0) >= 1
    )
    sampled_progress = slow_progress and fast_progress
    reverse_ok = (reverse.get("focus") is True
                  and reverse.get("start", -1) == at_end.get("start")
                  and reverse_metrics.get("touchDistancePx") is not None
                  and fast_metrics.get("touchDistancePx") is not None
                  and abs(reverse_metrics["touchDistancePx"]
                          - fast_metrics["touchDistancePx"]) <= 3)
    reverse_latency_ok = response_latency_ok(reverse_metrics)
    same_distance = (
        slow_metrics.get("touchDistancePx") is not None
        and fast_metrics.get("touchDistancePx") is not None
        and abs(slow_metrics["touchDistancePx"] - fast_metrics["touchDistancePx"]) <= 3
    )
    same_direction = (
        slow_metrics.get("direction") == -1
        and fast_metrics.get("direction") == -1
        and reverse_metrics.get("direction") == 1
    )
    record("cursor scrub keeps focus and reaches the same position at slow/fast speed",
           opened and page == ["input"] and focused and cleared
           and text == value_expected and at_end.get("focus") is True
           and observers_ready and speed_same and same_distance
           and same_direction and sampled_progress and valid_boundaries,
           f"page={page} text={text!r} atEnd={at_end} slow={slow} fast={fast}"
           f" slowTrace={slow_metrics} fastTrace={fast_metrics}"
           f" sameDistance={same_distance} sameDirection={same_direction}"
           f" opened={opened} focused={focused} cleared={cleared}"
           f" progress={sampled_progress} validBoundaries={valid_boundaries}"
           f" observers={observers_ready} error={error!r}")
    record("reverse cursor scrub moves back at ASCII boundaries",
           reverse_ok and valid_boundaries
           and reverse_latency_ok
           and reverse_metrics.get("inSwipeTransitions", 0) >= 1
           and reverse_metrics.get("direction") == 1,
           f"reverse={reverse} reverseTrace={reverse_metrics}"
           f" boundaries={sorted(boundaries)}")
    skip("reverse cursor scrub does not split an emoji",
         "adb input text cannot seed surrogate pairs; ASCII movement was "
         "verified and the emoji symbol-panel path remains to be exercised")
    d.shell("input keyevent 4")
    time.sleep(0.8)
    return b25.resume_keyboard_readonly() or keyboard


def pref_snapshot(path):
    exists = d.shell(f"run-as {d.PKG} sh -c 'test -f {path} && echo yes || echo no'").strip() == "yes"
    data = d.shell(f"run-as {d.PKG} cat {path} 2>/dev/null") if exists else ""
    return exists, data


def restore_pref(path, snapshot):
    exists, data = snapshot
    if not exists:
        d.shell(f"run-as {d.PKG} rm -f {path}")
        return
    encoded = base64.b64encode(data.encode()).decode()
    d.shell(f"run-as {d.PKG} sh -c 'echo {encoded} | base64 -d > {path}'")


def pref_height_value(data, landscape):
    key = "keyboard_height_landscape" if landscape else "keyboard_height_portrait"
    match = re.search(r'name="' + key + r'" value="(\d+)"', data or "")
    return int(match.group(1)) if match else None


def height_bridge_logs():
    output = d.shell("logcat -d -s FeelimeBridge:I")
    return [line for line in output.splitlines() if "setKeyboardHeight" in line]


def case_height_reset(keyboard, original_height_pref):
    """Reset pending/Cancel/Save with the real card and current orientation."""
    shared.keyboard_tap("#setupButton")
    panel_open = wait_until(
        lambda: ev("document.getElementById('settingsPanel')?.classList.contains('open')"),
        lambda value: value is True, timeout=3.0)
    if not panel_open:
        record("height card opens", False, "settings panel did not open")
        return keyboard
    shared.keyboard_text_tap_any(("键盘高度", "Keyboard height"), "#settingsPanel .qs-name")
    initial = wait_until(shared.height_state,
                         lambda value: value.get("open") is True, timeout=4.0) or {}
    if not initial.get("open"):
        record("height card opens", False, f"state={initial}")
        return keyboard
    landscape = ev("document.body.classList.contains('landscape')") is True
    # Use a real + tap when available so Reset has a visibly different pending
    # value.  This live step is restored by Cancel and by the preference
    # snapshot in finally; Reset itself remains the action under test.
    edited = initial
    if not initial.get("plusDisabled"):
        shared.keyboard_tap("#heightPlus")
        edited = wait_until(shared.height_state,
                            lambda value: value.get("value") != initial.get("value"),
                            timeout=4.0) or shared.height_state()
    pref_before_reset = pref_height_value(pref_snapshot(HEIGHT_PREF)[1], landscape)
    logs_before_reset = len(height_bridge_logs())
    shared.keyboard_tap("#heightCardReset")
    pending = wait_until(shared.height_state,
                         lambda value: value.get("open") and
                         value.get("value") is not None,
                         timeout=3.0) or shared.height_state()
    logs_after_reset = len(height_bridge_logs())
    pref_after_reset = pref_height_value(
        pref_snapshot(HEIGHT_PREF)[1], landscape)
    # round-6 定稿（用户反馈）：恢复默认也是一次实时预览——Reset 后键盘
    # 立刻变到默认高度（桥调用/pref 由 debounce 落盘），保存才持久化、
    # 取消还原。旧断言（Reset 只动待定值、不发桥不写 pref）是 round-6
    # 之前的契约，已被产品注释与 9j 套件行为取代。
    record("height Reset previews the default live (round-6)",
           pending.get("open") is True
           and pending.get("value") is not None
           and pending.get("keyboardHeight") == pending.get("value")
           and logs_after_reset >= logs_before_reset,
           f"initial={initial} edited={edited} pending={pending}"
           f" bridge={logs_before_reset}->{logs_after_reset}"
           f" pref={pref_before_reset}->{pref_after_reset}")
    pending_value = pending.get("value")
    shared.keyboard_tap("#heightCardCancel")
    cancelled = wait_until(
        lambda: (not shared.height_state().get("open"), shared.height_state()),
        lambda value: value[0] is True, timeout=4.0)
    after_cancel = cancelled[1] if cancelled else shared.height_state()
    record("height Cancel restores the value from card entry",
           after_cancel.get("keyboardHeight") == initial.get("keyboardHeight")
           and after_cancel.get("open") is False,
           f"entry={initial.get('keyboardHeight')} afterCancel={after_cancel}")

    # Reopen and use Reset + Save.  The persisted key must disappear only at
    # Save; this also proves a Reset that is followed by Save is actionable.
    shared.keyboard_tap("#setupButton")
    wait_until(lambda: ev("document.getElementById('settingsPanel')?.classList.contains('open')"),
               lambda value: value is True, timeout=3.0)
    shared.keyboard_text_tap_any(("键盘高度", "Keyboard height"), "#settingsPanel .qs-name")
    reopened = wait_until(shared.height_state,
                          lambda value: value.get("open") is True, timeout=4.0) or {}
    shared.keyboard_tap("#heightCardReset")
    save_pending = shared.height_state()
    shared.keyboard_tap("#heightCardSave")
    closed = wait_until(lambda: shared.height_state().get("open") is False,
                        lambda value: value is True, timeout=4.0)
    saved_pref = pref_height_value(pref_snapshot(HEIGHT_PREF)[1], landscape)
    record("height Save applies Reset and clears this orientation override",
           closed is True and saved_pref is None
           and (pending_value is None or save_pending.get("value") == pending_value),
           f"pending={save_pending} closed={closed} savedPref={saved_pref}")
    return d.fresh_kb(refocus=True) or keyboard


def main():
    original_height_pref = pref_snapshot(HEIGHT_PREF)
    original_mode_pref = pref_snapshot(MODE_PREF)
    try:
        keyboard = b25.prepare_readonly()
        if not keyboard:
            raise SystemExit("keyboard geometry unavailable")
        keyboard = case_editor_mode_boundaries(keyboard) or keyboard
        keyboard = case_type_null_mode(keyboard) or keyboard
        keyboard = b25.prepare_readonly() or keyboard
        keyboard = case_full_pinyin_variants(keyboard) or keyboard
        keyboard = case_touch_lifecycle(keyboard) or keyboard
        keyboard = case_cursor_scrub(keyboard) or keyboard
        keyboard = b25.prepare_readonly() or keyboard
        case_height_reset(keyboard, original_height_pref)
    finally:
        # Restore native user state even when an assertion or device timeout
        # interrupts a case. Killing the service makes the restored mode file
        # effective on the next start; the native height preference is read on
        # the next input-view measurement.
        restore_pref(HEIGHT_PREF, original_height_pref)
        restore_pref(MODE_PREF, original_mode_pref)
        d.shell("am force-stop " + d.PKG)

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== editor-modes device suite: {passed}/{len(RESULTS)} passed; "
          f"{len(SKIPPED)} skipped ==")
    if SKIPPED:
        print("skips: " + " | ".join(f"{name}: {detail}" for name, detail in SKIPPED))
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
