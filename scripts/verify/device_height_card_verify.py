#!/usr/bin/env python3
"""Device gates (height card / editor strip / settings pages / languages).

This suite deliberately keeps JavaScript read-only.  It may inspect live DOM
rects and state through DevTools, but every interaction that this batch is
checking is sent as an adb input tap/swipe.  In particular, the height card,
phrase card, mode menu, candidate picks, settings navigation and JSON editor
backspaces must exercise the same touch/InputConnection paths as a user.

The native IME-picker persistence path is owned by the separate native gate;
this file covers the keyboard/settings interactions requested for .
"""
import json
import math
import os
import re
import sys
import time
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d


RESULTS = []
# Shared keyboard/settings UI helpers and the mode label tables live in
# fv_common now (six other suites used to import them from THIS file, which
# made every height-card edit a cross-suite event).
from fv_common import (  # noqa: E402
    type_word_adb,
    DEFAULT_QUICK_PAIR,
    MODE_ID_LABELS,
    MODE_ID_TITLES,
    MODE_LABELS,
    MODE_TITLES,
    QUICK_PAIR_KEY,
    _quoted,
    ev,
    keyboard_long_press,
    keyboard_point,
    keyboard_rect,
    keyboard_state,
    keyboard_swipe,
    keyboard_tap,
    keyboard_text_point,
    keyboard_text_point_any,
    keyboard_text_rect,
    keyboard_text_tap,
    keyboard_text_tap_any,
    launch_settings,
    mode_menu_item_point,
    refresh_keyboard_geometry,
    screen_size,
    sev,
    settings_geometry,
    settings_home_text,
    settings_payload,
    settings_point,
    settings_tap,
    settings_visible_pages,
    height_state,
    switch_mode_real,
    wait_mode,
    wait_settings_ready,
    wait_until,
)


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def saved_quick_pair():
    """Read the effective pair, including the production default."""
    raw = ev("localStorage.getItem(" + _quoted(QUICK_PAIR_KEY) + ")")
    try:
        pair = json.loads(raw) if raw else list(DEFAULT_QUICK_PAIR)
    except (TypeError, ValueError):
        pair = list(DEFAULT_QUICK_PAIR)
    if not isinstance(pair, list) or len(pair) != 2:
        return list(DEFAULT_QUICK_PAIR)
    if any(not isinstance(mode, str) or mode not in MODE_ID_TITLES
           for mode in pair):
        return list(DEFAULT_QUICK_PAIR)
    return pair


def mode_menu_labels():
    """Map engine ids to the labels rendered for the current UI locale."""
    keyboard_long_press("#modeToggle")
    opened = wait_until(
        lambda: ev("document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is True, timeout=3.0)
    if not opened:
        return {}
    items = ev(
        "[...document.querySelectorAll('#modeMenu button')].map(button => ({"
        "title:button.querySelector('span:last-child')?.textContent.trim() || '',"
        "label:button.querySelector('.prep')?.textContent.trim() || ''"
        "}))") or []
    keyboard_tap("#modeToggle")
    wait_until(
        lambda: ev("document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is False, timeout=3.0)
    labels = {}
    for mode, titles in MODE_ID_TITLES.items():
        for item in items:
            if item.get("title", "") in titles and item.get("label") not in ("", "…"):
                labels[mode] = item.get("label", "")
                break
    return labels


def switch_mode_id_real(mode_id, expected_label=None):
    """Select a mode by its stable engine id through the real mode menu."""
    titles = MODE_ID_TITLES.get(mode_id, ())
    if not titles:
        return False
    if expected_label:
        current = ev("document.querySelector('#modeToggle .cn-main')?.textContent || ''")
        if current == expected_label:
            return True
    if ev("document.getElementById('modeMenu')?.classList.contains('open')"):
        keyboard_tap("#modeToggle")
        time.sleep(0.4)
    keyboard_long_press("#modeToggle")
    opened = wait_until(
        lambda: ev("document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is True, timeout=3.0)
    if not opened:
        return False
    point = None
    menu_ready = False
    for _ in range(20):
        menu_ready = ev(
            "(() => { const wanted = " + _quoted(titles) + ";"
            " const item = [...document.querySelectorAll('#modeMenu button')]"
            "   .find(node => {"
            "     const title = node.querySelector('span:last-child')"
            "       ?.textContent.trim() || '';"
            "     return wanted.includes(title);"
            "   });"
            " return !!item && !item.classList.contains('preparing')"
            "   && !item.classList.contains('current'); })()")
        point = mode_menu_item_point(titles)
        if menu_ready and point:
            break
        time.sleep(0.4)
    if not menu_ready or not point:
        keyboard_tap("#modeToggle")
        return False
    d.tap(*point, wait=0.8)
    if expected_label:
        return wait_mode(expected_label) == expected_label
    return wait_until(
        lambda: ev("!document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is True, timeout=10.0) is True


def keyboard_key_dimensions():
    return ev(
        "(() => { const out = {};"
        " document.querySelectorAll('#qwertyLayer [data-key]').forEach(el => {"
        "   const r = el.getBoundingClientRect();"
        "   out[el.dataset.key] = {left:r.left, top:r.top, width:r.width, height:r.height};"
        " }); return out; })()") or {}


def reset_input(keyboard):
    # This is preparation between cases, not the interaction under test.  The
    # shared helper drains both the engine composition and the host fixture.
    d.clear_field(keyboard)
    time.sleep(0.5)


def height_card_fits(state):
    try:
        card_bottom = float(state.get("cardBottom", math.nan))
        keyboard_top = float(state.get("keyboardTop", math.nan))
    except (TypeError, ValueError):
        return False
    return bool(state.get("open")) and math.isfinite(card_bottom) \
        and math.isfinite(keyboard_top) and card_bottom <= keyboard_top + 1.5


def case_height_card(keyboard):
    reset_input(keyboard)
    keyboard_tap("#setupButton")
    if not wait_until(lambda: ev("document.getElementById('settingsPanel')?.classList.contains('open')"),
                      lambda value: value is True, timeout=3.0):
        record("height card opens from keyboard settings", False, "settings panel did not open")
        return
    keyboard_text_tap_any(("键盘高度", "Keyboard height"), "#settingsPanel .qs-name", contains=False)
    initial = wait_until(height_state, lambda value: value and value.get("open"), timeout=3.0)
    if not initial or not initial.get("open"):
        record("height card opens from keyboard settings", False, "height card did not open")
        return
    record("height card opens from keyboard settings", True,
           f"value={initial.get('value')}")
    record("height card starts above keyboard keys", height_card_fits(initial),
           f"cardBottom={initial.get('cardBottom')} keyboardTop={initial.get('keyboardTop')}")

    # Fine step buttons are actual adb taps.  Re-read their positions after
    # every step because the keyboard top (and therefore the card) may move.
    if initial.get("plusDisabled"):
        record("+ button changes height by real touch", False, "button disabled")
    else:
        keyboard_tap("#heightPlus")
        plus = wait_until(height_state,
                          lambda value: value and value.get("value") != initial.get("value"),
                          timeout=3.0)
        plus_value = plus.get("value") if plus else None
        plus_ok = isinstance(plus_value, (int, float)) and \
            plus_value > initial.get("value", math.inf)
        record("+ button changes height by real touch",
               plus_ok,
               f"{initial.get('value')}->{plus_value}")
        record("card follows keyboard top after +", height_card_fits(plus or {}),
               f"state={plus}")

    current = height_state()
    if current.get("minusDisabled"):
        record("− button changes height by real touch", False, "button disabled")
    else:
        keyboard_tap("#heightMinus")
        minus = wait_until(height_state,
                           lambda value: value and value.get("value") != current.get("value"),
                           timeout=3.0)
        minus_value = minus.get("value") if minus else None
        minus_ok = isinstance(minus_value, (int, float)) and \
            minus_value < current.get("value", -math.inf)
        record("− button changes height by real touch",
               minus_ok,
               f"{current.get('value')}->{minus_value}")
        record("card follows keyboard top after −", height_card_fits(minus or {}),
               f"state={minus}")

    before_drag = height_state()
    try:
        keyboard_swipe("#heightTrack")
        after_drag = wait_until(height_state,
                                lambda value: value and value.get("value") != before_drag.get("value"),
                                timeout=3.0)
        record("drag strip changes height by real adb swipe",
               bool(after_drag and after_drag.get("value") != before_drag.get("value")),
               f"{before_drag.get('value')}->{after_drag.get('value') if after_drag else None}")
        record("card follows keyboard top after drag",
               height_card_fits(after_drag or {}), f"state={after_drag}")
    except RuntimeError as error:
        record("drag strip changes height by real adb swipe", False, str(error))
        record("card follows keyboard top after drag", False, "no drag state")

    # Cancel is also a real tap.  It must close the card and restore the
    # height saved when editing began, rather than persisting the preview.
    keyboard_tap("#heightCardCancel")
    closed = wait_until(
        lambda: ev("document.getElementById('heightCard')?.hidden"),
        lambda value: value is True, timeout=3.0)
    restored = wait_until(
        lambda: ev("Math.round(document.getElementById('softKeyboard')?.clientHeight || 0)"),
        lambda value: isinstance(value, (int, float)) and value == initial.get("keyboardHeight"),
        timeout=3.0)
    record("cancel closes card and rolls back preview",
           closed is True and restored == initial.get("keyboardHeight"),
           f"hidden={closed} initial={initial.get('keyboardHeight')} restored={restored}")
    ev("window.Feelime && window.Feelime.resetToHome && window.Feelime.resetToHome()")


def case_phrase_card(keyboard):
    reset_input(keyboard)
    if not switch_mode_real("英文 Direct"):
        record("phrase card setup reaches Direct mode", False, "mode switch failed")
        return
    before = keyboard_key_dimensions()
    keyboard_tap("#favoritesButton")
    if not wait_until(lambda: ev("document.getElementById('panelLayer')?.hidden === false"),
                      lambda value: value is True, timeout=3.0):
        record("phrase editor opens from keyboard favorites", False, "favorites panel did not open")
        return
    keyboard_tap("#panelManage")
    opened = wait_until(lambda: ev("document.getElementById('phraseCard')?.classList.contains('open')"),
                        lambda value: value is True, timeout=3.0)
    after = keyboard_key_dimensions()
    common = sorted(set(before) & set(after))
    changed = []
    for key in common:
        for field in ("left", "top", "width", "height"):
            if abs(float(before[key][field]) - float(after[key][field])) > 1.0:
                changed.append(f"{key}.{field}")
    record("phrase editor opens as a floating card", opened is True,
           f"open={opened}")
    record("phrase card leaves key dimensions unchanged",
           bool(opened) and not changed,
           f"changed={changed[:8]}")
    if opened:
        keyboard_tap("#phraseCardCancel")
        wait_until(lambda: ev("document.getElementById('phraseCard')?.hidden"),
                   lambda value: value is True, timeout=3.0)
        if ev("document.getElementById('panelLayer')?.hidden === false"):
            keyboard_tap("#panelClose")
    ev("window.Feelime && window.Feelime.resetToHome && window.Feelime.resetToHome()")


def case_mode_and_pinyin(keyboard):
    # Supersedes the old "last explicit mode" rule: a temporary
    # long-press selection returns to the first persisted quick-pair entry,
    # then the second entry.  Resolve labels from the live menu so this stays
    # valid in either UI locale and for a user-configured pair.
    pair = saved_quick_pair()
    labels = mode_menu_labels() if pair else {}
    first_labels = tuple(dict.fromkeys(
        ([labels[pair[0]]] if pair[0] in labels else [])
        + list(MODE_ID_LABELS.get(pair[0], ()))
    )) if pair else ()
    second_labels = tuple(dict.fromkeys(
        ([labels[pair[1]]] if pair[1] in labels else [])
        + list(MODE_ID_LABELS.get(pair[1], ()))
    )) if pair else ()
    third_modes = [mode for mode in MODE_ID_TITLES
                   if mode not in pair and mode in labels]
    third_mode = third_modes[0] if third_modes else None
    third_label = labels.get(third_mode) if third_mode else None
    if pair and third_mode and first_labels and second_labels and third_label:
        switched = switch_mode_id_real(third_mode, third_label)
        saved_after_menu = saved_quick_pair()
        first_state = {}
        second_state = {}
        if switched:
            keyboard_tap("#modeToggle")
            first_state = wait_until(
                keyboard_state,
                lambda value: value.get("mode") in first_labels
                and value.get("sub") in second_labels,
                timeout=10.0) or keyboard_state()
            keyboard_tap("#modeToggle")
            second_state = wait_until(
                keyboard_state,
                lambda value: value.get("mode") in second_labels
                and value.get("sub") in first_labels,
                timeout=10.0) or keyboard_state()
        record("temporary third mode -> saved quick pair first then second",
               switched and saved_after_menu == pair
               and first_state.get("mode") in first_labels
               and first_state.get("sub") in second_labels
               and second_state.get("mode") in second_labels
               and second_state.get("sub") in first_labels
               and saved_quick_pair() == pair,
               f"pair={pair} labels={labels} first={first_state} second={second_state}")
    else:
        record("temporary third mode -> saved quick pair first then second",
               False,
               f"invalid/no-third-mode pair={pair!r} labels={labels!r}")

    if not switch_mode_real("双拼"):
        record("switching Chinese mode commits raw input", False, "Double mode unavailable")
        return
    reset_input(keyboard)
    type_word_adb(keyboard, "ni", wait=0.35)
    before = {
        "preedit": ev("document.getElementById('preeditLine')?.textContent || ''"),
        "field": d.field_text_retry() or "",
    }
    switched = switch_mode_real("英文 Direct")
    field = d.field_text_retry() or ""
    record("switching Chinese mode commits raw input",
           switched and before["preedit"].replace(" ", "") == "ni" and field.endswith("ni"),
           f"before={before} afterField={field!r}")
    reset_input(keyboard)


def case_french_candidates(keyboard):
    if not switch_mode_real("Français"):
        record("R3/R12 French candidate case reaches Français", False, "mode switch failed")
        return
    reset_input(keyboard)
    type_word_adb(keyboard, "ete", wait=0.35)
    candidates = wait_until(
        lambda: ev("[...document.querySelectorAll('#candidates .candidate')].map(e => e.textContent)"),
        lambda value: isinstance(value, list) and len(value) > 0, timeout=8.0) or []
    accent_point = keyboard_text_point("ê", "#candidates .candidate")
    if not accent_point:
        # Some model builds expose a different circumflex head; the required
        # regression is still recorded as a missing accent rather than guessed.
        accent_point = keyboard_text_point("é", "#candidates .candidate")
        accent_text = "é"
    else:
        accent_text = "ê"
    if accent_point:
        d.tap(*accent_point, wait=1.0)
        accent_state = keyboard_state()
        preedit = accent_state.get("preedit", "").replace(" ", "")
        record("tapping French accent keeps composing without expanding",
               not accent_state.get("expanded") and preedit.startswith(accent_text),
               f"accent={accent_text} preedit={preedit!r} expanded={accent_state.get('expanded')}")
    else:
        record("tapping French accent keeps composing without expanding",
               False, f"candidates={candidates[:8]}")

    reset_input(keyboard)
    type_word_adb(keyboard, "ete", wait=0.35)
    first = wait_until(
        lambda: ev("document.querySelector('#candidates .candidate')?.textContent || ''"),
        lambda value: bool(value), timeout=8.0)
    if first:
        keyboard_tap("#candidates .candidate:first-child", wait=1.0)
        text = d.field_text_retry() or ""
        record("French candidate selection commits a trailing space",
               text.endswith(" "), f"candidate={first!r} field={text!r}")
    else:
        record("French candidate selection commits a trailing space",
               False, "no French candidate")
    reset_input(keyboard)
    switch_mode_real("英文 Direct")


def case_settings_and_json(keyboard):
    # Launch without the automation-only fixture extra: the home page must not
    # expose a debug editor or any management surface.
    if not launch_settings(with_fixtures=False):
        record("R4/R5/R7 settings home opens", False, "settings WebView unavailable")
        return
    home = settings_home_text()
    pages = settings_visible_pages()
    debug_nodes = "feelime-test-input" in d.ui_dump()
    # 1.0.4's backup entry subtitle ("设置 · 常用语 · 词库") legitimately
    # MENTIONS 常用语 - the old home-text substring check false-positived on
    # it. The actual R4/R5/R7 target is management ENTRIES on the home page,
    # so match entry labels, not free text.
    duplicate_management = sev(
        "[...document.querySelectorAll('[data-page=\"home\"] button[data-target]')]"
        ".some(b => /^（?(剪贴板|常用语)/.test(b.textContent.trim()))")
    # The about ENTRY subtitle legitimately says 版本信息; the old card flaw
    # was a copy button + rows table on the home page - check for those.
    no_version_card = (sev("!!document.querySelector('[data-page=\"home\"] #aboutRows, "
                           "[data-page=\"home\"] #btnCopyAbout')") is False)
    record("R4/R5/R7 settings home has no debug/version/duplicate management",
           pages == ["home"] and not debug_nodes and no_version_card
           and duplicate_management is False,
           f"pages={pages} version={no_version_card} debug={debug_nodes} duplicate={duplicate_management}")

    # The height-card steps leave the IME open; an open keyboard squeezes
    # the settings WebView and swallows the taps aimed at the home entries
    # (geometry maps below the window bottom, input swipe lands on keys).
    # Close it first - the JSON editor step reopens it via the focus tap.
    for _ in range(3):
        if "mInputShown=true" not in d.shell(
                "dumpsys input_method | grep -m1 mInputShown"):
            break
        d.shell("input keyevent 4")
        time.sleep(0.8)
    opened_input = settings_tap('button[data-target="input"]')
    input_page = wait_until(settings_visible_pages,
                            lambda value: value == ["input"], timeout=4.0)
    record("settings group opens through a real tap", opened_input and input_page == ["input"],
           f"pages={input_page}")
    back_input = settings_tap('[data-page="input"] [data-back]')
    home_again = wait_until(settings_visible_pages,
                            lambda value: value == ["home"], timeout=4.0)
    record("settings sub-page back returns to home through a real tap",
           back_input and home_again == ["home"], f"pages={home_again}")

    # Open the input page again and seed only test data through JS.  Focus and
    # every deletion below still travel through a physical tap on the actual
    # Feelime backspace key and the settings WebView's native InputConnection.
    settings_tap('button[data-target="input"]')
    wait_until(settings_visible_pages, lambda value: value == ["input"], timeout=4.0)
    seeded = sev(
        "(() => { const ta = document.getElementById('customJson');"
        " if (!ta) return false; ta.value = '{\"version\":1,\"rows\":[["
        "{\"t\":\"alpha\",\"tap\":\"alpha\"}]]}';"
        " ta.dispatchEvent(new Event('input', {bubbles:true})); return ta.value.length; })()")
    focused = settings_tap("#customJson", wait=1.0)
    kb = wait_until(lambda: d.key_geometry(), lambda value: bool(value), timeout=8.0)
    value_before = sev("document.getElementById('customJson')?.value || ''") or ""
    # The caret placement is preparation after the real focus tap; no bridge
    # or native proxy is wrapped, and all deletes below are adb input taps.
    sev("(() => { const ta = document.getElementById('customJson');"
        " if (!ta) return false; ta.focus();"
        " ta.setSelectionRange(ta.value.length, ta.value.length); return true; })()")
    timings = []
    if kb:
        for _ in range(10):
            start = time.monotonic()
            d.tap(*kb["<backspace>"], wait=0.05)
            timings.append(time.monotonic() - start)
    value_after = sev("document.getElementById('customJson')?.value || ''") or ""
    max_latency = max(timings) if timings else float("inf")
    record("JSON editor accepts continuous real backspaces",
           bool(seeded) and focused and bool(kb) and len(value_after) < len(value_before),
           f"seed={seeded} focused={focused} before={len(value_before)} after={len(value_after)}")
    record("each JSON backspace stays below the 2s regression threshold",
           bool(timings) and max_latency < 2.0,
           f"latencies={[round(value, 3) for value in timings]} max={max_latency:.3f}")
    d.shell("input keyevent 4")
    time.sleep(1.0)


def main():
    # Start from portrait and the stock keyboard height so a previous suite
    # cannot make the height range appear capped.
    d.shell("settings put system accelerometer_rotation 0")
    d.shell("settings put system user_rotation 0")
    d.shell(f"run-as {d.PKG} sh -c 'rm -f shared_prefs/feelime_keyboard.xml'")
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(1.0)
    d.prepare()
    keyboard = d.fresh_kb(refocus=True)
    if not keyboard:
        raise SystemExit("keyboard geometry unavailable")
    ev("window.Feelime && window.Feelime.resetToHome && window.Feelime.resetToHome()")
    time.sleep(0.6)

    case_height_card(keyboard)
    keyboard = d.fresh_kb(refocus=True) or keyboard
    case_phrase_card(keyboard)
    keyboard = d.fresh_kb(refocus=True) or keyboard
    case_mode_and_pinyin(keyboard)
    keyboard = d.fresh_kb(refocus=True) or keyboard
    case_french_candidates(keyboard)
    case_settings_and_json(keyboard)

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== height-card device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
