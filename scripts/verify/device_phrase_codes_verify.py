#!/usr/bin/env python3
"""Device gates (phrase codes / French editing / UI language / cursor).

The suite covers the six device cases added by 

* an empty phrase code derives the offline Chinese initials;
* an explicitly entered phrase code wins over the derived code;
* a French-mode phrase row can be reopened and edited;
* saving that card quickly never writes its text into the host editor;
* the UI language can be English while the input engine remains Pinyin;
* the settings JSON editor keeps focus/caret while real backspaces arrive
  without the old per-key two-second stall.

Every action under test is an adb tap, swipe, key event, or text injection.
DevTools is an observation channel only: the expressions below read DOM text,
rects, values, selections, and state.  The coordinate helpers are shared with
device_height_card_verify.py, whose ADB/DevTools target selection is the project
standard.  No device is selected by default; device_verify reads
FEELIME_ADB_SERIAL and fails fast when it is absent.
"""
import html
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fv_common as shared
import device_verify as d


RESULTS = []

FAVORITES_PREF = "shared_prefs/feelime_favorites.xml"
FAVORITES_DEVICE_BACKUP = "/data/local/tmp/feelime-favorites-b25.xml"
UNIQUE_PHRASE = "周末到海边看紫色日落"
UNIQUE_PHRASE_CODE = "zmdhbkzsrl"
UNIQUE_PHRASE_SYLLABLES = (
    ("zhou", "周"), ("mo", "末"), ("dao", "到"), ("hai", "海"),
    ("bian", "边"), ("kan", "看"), ("zi", "紫"), ("se", "色"),
    ("ri", "日"), ("luo", "落"),
)


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def ev(expression):
    """Read the keyboard WebView through DevTools."""
    return d.devtools_eval(expression)


def sev(expression):
    """Read the full-settings WebView through DevTools."""
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


def keyboard_candidates():
    return ev(
        "[...document.querySelectorAll('#candidates .candidate')]"
        ".map(node => node.textContent.trim())") or []


def wait_candidate(text, timeout=8.0):
    return wait_until(
        keyboard_candidates,
        lambda values: isinstance(values, list) and any(text == value for value in values),
        timeout=timeout,
    ) or []


def keyboard_qwerty():
    """Get the live qwerty geometry without the mutating fallback in d.key_geometry."""
    for _ in range(8):
        value = d.devtools_key_geometry()
        if value and all(key in value for key in ("<backspace>", "<space>", "n")):
            return value
        time.sleep(0.5)
    return None


def clear_host_adb(keyboard, rounds=3):
    """Clear the debug host editor using adb only.

    The select-all key event is a shortcut for committed text.  The physical
    backspace tap loop also drains an active engine composition and covers
    WebViews that consume host key events while a button has focus.
    """
    point = keyboard.get("<backspace>") if keyboard else None
    for _ in range(rounds):
        d.shell("input keycombination 113 29")  # CTRL_LEFT + A
        d.shell("input keyevent 67")
        d.shell("input keyevent 67")
        time.sleep(0.25)
        if d.field_text_retry() == "":
            return True
        if point:
            for _ in range(80):
                d.tap(*point, wait=0.015)
                if d.field_text_retry(attempts=1) == "":
                    return True
    return d.field_text_retry() == ""


def prepare_readonly():
    """Prepare the debug host field without a DevTools write expression."""
    d.shell("svc power stayon true")
    d.shell("input keyevent KEYCODE_WAKEUP")
    d.shell("wm dismiss-keyguard")
    d.shell("input keyevent 82")
    d.shell("ime set " + d.IME_SVC)
    d.shell("am start -n " + d.PKG +
            "/.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(1.5)
    bounds = None
    for attempt in range(10):
        bounds = d.field_bounds()
        if bounds:
            break
        d.shell("input swipe 540 1750 540 650 220")
        time.sleep(0.45)
        if attempt == 5:
            d.shell("input keyevent 4")
            time.sleep(0.5)
            d.shell("am start -n " + d.PKG +
                    "/.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
            time.sleep(1.2)
    if not bounds:
        raise SystemExit("test field not found")
    d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, wait=1.2)
    # A preceding language suite may leave Russian keys without Latin 'n'.
    # Establish the initial mode through the visible menu before reading keys.
    if not shared.switch_mode_real("英文 Direct"):
        raise SystemExit("initial Direct mode unavailable")
    keyboard = keyboard_qwerty()
    if not keyboard:
        raise SystemExit("keyboard geometry unavailable")
    # Release a caps state left by a previous suite through a real tap.
    for _ in range(3):
        keyboard = keyboard_qwerty() or keyboard
        if not keyboard.get("<shift-green>"):
            break
        d.tap(*keyboard["<shift>"], wait=0.35)
    return keyboard


def wait_panel(opened=True):
    return wait_until(
        lambda: ev("document.getElementById('panelLayer')?.hidden === false"),
        lambda value: value is opened,
        timeout=4.0,
    ) is opened


def open_phrase_card(keyboard):
    shared.keyboard_tap("#favoritesButton")
    if not wait_panel(True):
        return False
    shared.keyboard_tap("#panelManage")
    return wait_until(
        lambda: ev("document.getElementById('phraseCard')?.classList.contains('open')"),
        lambda value: value is True,
        timeout=4.0,
    ) is True


def close_panel_if_open():
    if ev("document.getElementById('panelLayer')?.hidden === false") is True:
        shared.keyboard_tap("#panelClose")
        wait_panel(False)


def phrase_rows():
    return ev(
        "[...document.querySelectorAll('#panelList .panel-item')].map(row => ({"
        "text: row.querySelector('.panel-text')?.textContent || '',"
        "id: row.dataset.itemId || ''}))") or []


def wait_phrase(text, timeout=5.0):
    rows = wait_until(
        phrase_rows,
        lambda rows: isinstance(rows, list) and any(row.get("text") == text for row in rows),
        timeout=timeout,
    )
    # wait_until returns its last observation on timeout.  Do not let an
    # unrelated row make callers treat that observation as a match.
    return rows if isinstance(rows, list) and any(
        row.get("text") == text for row in rows
    ) else []


def row_more_selector(text):
    rows = phrase_rows()
    row = next((item for item in rows if item.get("text") == text), None)
    if not row or not row.get("id"):
        return None
    return ".panel-item[data-item-id=" + json.dumps(row["id"]) + "] .panel-more"


def add_phrase(keyboard, text, code="", pinyin_keys=None, expected_text=None):
    """Add one phrase through the floating card and real keyboard taps."""
    if not open_phrase_card(keyboard):
        return False, "phrase card did not open"
    shared.keyboard_tap("#phraseCardInput")
    if pinyin_keys:
        shared.type_word_adb(keyboard, pinyin_keys, wait=0.24)
        shared.keyboard_tap("#spaceKey", wait=0.8)
    else:
        shared.type_word_adb(keyboard, text, wait=0.24)
    expected = expected_text or text
    input_value = wait_until(
        lambda: ev("document.getElementById('phraseCardInput')?.value || ''"),
        lambda value: value == expected,
        timeout=5.0,
    )
    if input_value != expected:
        shared.keyboard_tap("#phraseCardCancel")
        wait_panel(True)
        return False, f"input={input_value!r}, expected={expected!r}"
    if code:
        shared.keyboard_tap("#phraseCardCode")
        shared.type_word_adb(keyboard, code, wait=0.24)
    shared.keyboard_tap("#phraseCardSave", wait=0.15)
    saved = wait_until(
        lambda: ev("document.getElementById('phraseCard')?.hidden === true"),
        lambda value: value is True,
        timeout=5.0,
    ) is True
    rows = wait_phrase(expected, timeout=5.0)
    return saved and any(row.get("text") == expected for row in rows), \
        f"saved={saved} rows={rows}"


def phrase_card_values():
    return ev(
        "(() => { const c=document.getElementById('phraseCard');"
        "return c ? {open:c.classList.contains('open'),"
        "hidden:!!c.hidden,text:document.getElementById('phraseCardInput')?.value || '',"
        "code:document.getElementById('phraseCardCode')?.value || ''} : null; })()"
    ) or {}


def open_phrase_row_for_edit(text):
    wait_phrase(text, timeout=5.0)
    more = row_more_selector(text)
    if not more:
        return False, {}
    shared.keyboard_tap(more)
    menu_open = wait_until(
        lambda: ev("document.getElementById('itemMenu')?.classList.contains('open')"),
        lambda value: value is True,
        timeout=3.0,
    ) is True
    if not menu_open:
        return False, {}
    shared.keyboard_text_tap("编辑", "#itemMenu button", contains=True)
    card = wait_until(
        phrase_card_values,
        lambda value: value and value.get("open") is True,
        timeout=4.0,
    ) or {}
    return card.get("open") is True, card


def add_phrase_by_syllables(keyboard):
    """Enter a long unique phrase via real Pinyin keys and candidate taps."""
    if not open_phrase_card(keyboard):
        return False, "phrase card did not open"
    for pinyin, expected in UNIQUE_PHRASE_SYLLABLES:
        shared.type_word_adb(keyboard, pinyin, wait=0.18)
        point = wait_until(
            lambda expected=expected: shared.keyboard_text_point(
                expected, "#candidates .candidate"
            ),
            lambda value: value is not None,
            timeout=5.0,
            interval=0.15,
        )
        if not point:
            shared.keyboard_tap("#phraseCardCancel")
            return False, f"candidate {expected!r} missing for {pinyin!r}"
        d.tap(*point, wait=0.35)
        # The exact prefix check below is intentionally text based.  It also
        # proves the candidate was redirected to the card input rather than
        # the host editor.
        expected_value = wait_until(
            lambda: ev("document.getElementById('phraseCardInput')?.value || ''") or "",
            lambda item: item.endswith(expected),
            timeout=4.0,
        ) or ""
        if not expected_value.endswith(expected):
            shared.keyboard_tap("#phraseCardCancel")
            return False, f"card value={expected_value!r} after {expected!r}"
    value = wait_until(
        lambda: ev("document.getElementById('phraseCardInput')?.value || ''"),
        lambda item: item == UNIQUE_PHRASE,
        timeout=5.0,
    )
    if value != UNIQUE_PHRASE:
        shared.keyboard_tap("#phraseCardCancel")
        return False, f"input={value!r}, expected={UNIQUE_PHRASE!r}"
    shared.keyboard_tap("#phraseCardSave", wait=0.15)
    saved = wait_until(
        lambda: ev("document.getElementById('phraseCard')?.hidden === true"),
        lambda item: item is True,
        timeout=5.0,
    ) is True
    rows = wait_phrase(UNIQUE_PHRASE, timeout=5.0)
    return saved and any(row.get("text") == UNIQUE_PHRASE for row in rows), \
        f"saved={saved} rows={rows}"


def clear_phrase_card_input_adb(keyboard):
    """Clear the card through its keyboard; hardware key events target the host."""
    value = ev("document.getElementById('phraseCardInput')?.value || ''") or ""
    if not value:
        return True
    keyboard = d.fresh_kb() or keyboard
    point = keyboard.get("<backspace>") if keyboard else None
    if point:
        for _ in range(len(value) + 8):
            d.tap(*point, wait=0.04)
            value = wait_until(
                lambda: ev("document.getElementById('phraseCardInput')?.value || ''"),
                lambda item: item != value or item == "",
                timeout=2.0,
                interval=0.06,
            )
            if value == "":
                return True
    return (ev("document.getElementById('phraseCardInput')?.value || ''") or "") == ""


def case_default_phrase_code(keyboard):
    """A long phrase gets an automatic code, which is then used for injection."""
    if not shared.switch_mode_real("英文 Direct"):
        record("default phrase code setup reaches Direct", False,
               "mode switch failed")
        return keyboard
    if not clear_host_adb(keyboard):
        record("default phrase code setup clears host", False,
               repr(d.field_text_retry()))
        return keyboard
    shared.type_word_adb(keyboard, "anchor", wait=0.22)
    host_before = d.field_text_retry() or ""
    if not shared.switch_mode_real("全拼 Pinyin"):
        record("default phrase code setup reaches Pinyin", False,
               "mode switch failed")
        return keyboard
    added, detail = add_phrase_by_syllables(keyboard)
    host_after = d.field_text_retry() or ""
    record("blank phrase code saves a unique Chinese phrase",
           added and host_after == host_before,
           f"hostBefore={host_before!r} hostAfter={host_after!r} {detail}")
    close_panel_if_open()
    if not added:
        return keyboard

    # Reopen the stored row first.  The code must be the generated initials,
    # not a value inferred from the test itself or from Rime's built-in words.
    shared.keyboard_tap("#favoritesButton")
    panel_ready = wait_panel(True)
    opened, card = open_phrase_row_for_edit(UNIQUE_PHRASE) if panel_ready else (False, {})
    record("saved phrase reopens with its generated input code",
           opened and card.get("text") == UNIQUE_PHRASE
           and card.get("code") == UNIQUE_PHRASE_CODE,
           f"card={card}")
    if opened:
        shared.keyboard_tap("#phraseCardCancel")
        wait_until(
            lambda: ev("document.getElementById('phraseCard')?.hidden === true"),
            lambda value: value is True,
            timeout=4.0,
        )
    close_panel_if_open()

    # A real code composition must inject the exact saved row.
    shared.type_word_adb(keyboard, UNIQUE_PHRASE_CODE, wait=0.3)
    candidates = wait_candidate(UNIQUE_PHRASE)
    point = shared.keyboard_text_point(UNIQUE_PHRASE, "#candidates .candidate")
    if point:
        d.tap(*point, wait=0.9)
    host = d.field_text_retry() or ""
    record("generated code injects and commits the saved phrase",
           UNIQUE_PHRASE in candidates and point is not None
           and host.endswith(UNIQUE_PHRASE),
           f"candidates={candidates[:8]} field={host!r}")
    clear_host_adb(keyboard)
    return keyboard


def case_custom_phrase_code(keyboard):
    """An explicit code must be used instead of the derived prefix."""
    if not shared.switch_mode_real("英文 Direct"):
        record("custom phrase code setup reaches Direct", False,
               "mode switch failed")
        return keyboard
    clear_host_adb(keyboard)
    shared.type_word_adb(keyboard, "anchor", wait=0.22)
    host_before = d.field_text_retry() or ""
    added, detail = add_phrase(keyboard, "world", code="zz")
    host_after = d.field_text_retry() or ""
    record("user-entered code saves without touching the host",
           added and host_after == host_before,
           f"hostBefore={host_before!r} hostAfter={host_after!r} {detail}")
    close_panel_if_open()
    if not added:
        return keyboard
    if not shared.switch_mode_real("全拼 Pinyin"):
        record("custom phrase code candidate setup reaches Pinyin", False,
               "mode switch failed")
        return keyboard
    shared.type_word_adb(keyboard, "zz", wait=0.3)
    candidates = wait_candidate("world")
    point = shared.keyboard_text_point("world", "#candidates .candidate")
    if point:
        d.tap(*point, wait=0.9)
    host = d.field_text_retry() or ""
    record("explicit zz code matches and commits world",
           "world" in candidates and point is not None and host.endswith("world"),
           f"candidates={candidates[:8]} field={host!r}")
    clear_host_adb(keyboard)
    return keyboard


def case_french_reedit_and_quick_save(keyboard):
    """Exercise panel-routed French undo/reopen, then the queued card save."""
    if not shared.switch_mode_real("英文 Direct"):
        record("French editor setup reaches Direct", False,
               "mode switch failed")
        return keyboard
    clear_host_adb(keyboard)
    shared.type_word_adb(keyboard, "frhost", wait=0.22)
    host_before = d.field_text_retry() or ""
    added, detail = add_phrase(keyboard, "bonjour", code="bj")
    if not added:
        record("French editor seed phrase is available", False, detail)
        return keyboard
    close_panel_if_open()
    if not shared.switch_mode_real("Français"):
        record("French editor reopens in FR mode", False,
               "mode switch failed")
        return keyboard
    shared.keyboard_tap("#favoritesButton")
    if not wait_panel(True):
        record("French editor reopens in FR mode", False,
               "favorites panel did not open")
        return keyboard
    menu_open, card = open_phrase_row_for_edit("bonjour")
    record("French mode reopens the selected phrase and input code",
           menu_open and card.get("text") == "bonjour" and card.get("code") == "bj",
           f"card={card}")
    if not menu_open or not card.get("open"):
        return keyboard

    # Keep the host editor at its anchor while the card owns the composition.
    # This is the regression path: type bo in the card, choose its first
    # actual candidate, press backspace to reopen that word, then continue
    # with s.  The resulting word must occur once in the panel field, with no
    # host leakage.
    cleared = clear_phrase_card_input_adb(keyboard)
    shared.type_word_adb(keyboard, "bo", wait=0.3)
    candidates = wait_until(
        keyboard_candidates,
        lambda values: isinstance(values, list) and bool(values),
        timeout=6.0,
    ) or []
    candidate = candidates[0] if candidates else ""
    point = shared.keyboard_text_point(candidate, "#candidates .candidate") if candidate else None
    if point:
        d.tap(*point, wait=0.45)
    committed = wait_until(
        lambda: (ev("document.getElementById('phraseCardInput')?.value || ''") or "").strip(),
        lambda value: value == candidate,
        timeout=6.0,
    )
    if point:
        d.tap(*keyboard["<backspace>"], wait=0.1)
    reopened = wait_until(
        lambda: (ev("document.getElementById('preeditLine')?.textContent || ''")
                 .replace(" ", "")),
        lambda value: value == candidate,
        timeout=6.0,
    )
    card_after_reopen = wait_until(
        lambda: (ev("document.getElementById('phraseCardInput')?.value || ''") or "").strip(),
        lambda value: value == candidate,
        timeout=6.0,
    )
    shared.type_word_adb(keyboard, "s", wait=0.25)
    continued = wait_until(
        lambda: (ev("document.getElementById('preeditLine')?.textContent || ''")
                 .replace(" ", "")),
        lambda value: value == candidate + "s",
        timeout=6.0,
    )
    card_final = wait_until(
        lambda: (ev("document.getElementById('phraseCardInput')?.value || ''") or "").strip(),
        lambda value: value == candidate + "s",
        timeout=6.0,
    )
    host_during = d.field_text_retry() or ""
    record("French card candidate undo and continuation stay single and isolated",
           cleared and candidate in candidates and point is not None
           and committed == candidate and reopened == candidate
           and card_after_reopen == candidate and continued == candidate + "s"
           and card_final == candidate + "s" and host_during == host_before
           and card_final.count(candidate) == 1,
           f"cleared={cleared} candidates={candidates[:8]} committed={committed!r}"
           f" reopened={reopened!r} continued={continued!r} card={card_final!r}"
           f" host={host_during!r} expectedHost={host_before!r}")
    shared.keyboard_tap("#phraseCardCancel")
    wait_until(
        lambda: ev("document.getElementById('phraseCard')?.hidden === true"),
        lambda value: value is True,
        timeout=4.0,
    )
    close_panel_if_open()

    # Change only the code, with French still active.  The final `j` tap is
    # followed immediately by Save; no DOM wait is allowed between them.
    shared.keyboard_tap("#favoritesButton")
    if not wait_panel(True):
        record("French editor reopens after card candidate test", False,
               "favorites panel did not open")
        return keyboard
    menu_open, card = open_phrase_row_for_edit("bonjour")
    record("French mode reopens the selected phrase and input code",
           menu_open and card.get("text") == "bonjour" and card.get("code") == "bj",
           f"card={card}")
    if not menu_open or not card.get("open"):
        return keyboard
    shared.keyboard_tap("#phraseCardCode")
    for _ in range(len(card.get("code", ""))):
        d.tap(*keyboard["<backspace>"], wait=0.12)
    shared.type_word_adb(keyboard, "bn", wait=0.16)
    final_key = keyboard.get("j")
    if final_key:
        d.tap(*final_key, wait=0.0)
    else:
        record("French panel code edit reaches final key", False,
               "j key geometry unavailable")
    shared.keyboard_tap("#phraseCardSave", wait=0.05)
    hidden = wait_until(
        lambda: ev("document.getElementById('phraseCard')?.hidden === true"),
        lambda value: value is True,
        timeout=5.0,
    ) is True
    host_after = d.field_text_retry() or ""
    rows = wait_phrase("bonjour", timeout=5.0)
    stored_open, stored = open_phrase_row_for_edit("bonjour") if rows else (False, {})
    record("quick save stores the final text and code without host leakage",
           hidden and final_key is not None and host_after == host_before
           and any(row.get("text") == "bonjour" for row in rows)
           and stored_open and stored.get("text") == "bonjour"
           and stored.get("code") == "bnj",
           f"hidden={hidden} hostBefore={host_before!r} hostAfter={host_after!r}"
           f" rows={rows} stored={stored}")
    if stored_open:
        shared.keyboard_tap("#phraseCardCancel")
    close_panel_if_open()
    clear_host_adb(keyboard)
    return keyboard


def ui_option_point(labels):
    """Read a native HTML-select popup and return one option's adb point."""
    xml = d.ui_dump()
    for node in re.finditer(r"<node [^>]*/>", xml):
        blob = node.group(0)
        match = re.search(r' text="([^"]*)"', blob)
        if not match:
            continue
        value = html.unescape(match.group(1))
        if value not in labels:
            continue
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', blob)
        if not bounds:
            continue
        left, top, right, bottom = (int(group) for group in bounds.groups())
        return (left + right) // 2, (top + bottom) // 2, value
    return None


LANGUAGE_OPTIONS = {
    "auto": ("跟随系统", "Follow system", "System"),
    "zh": ("中文", "Chinese"),
    "en": ("English",),
}


def set_settings_language(choice):
    """Open settings and choose auto/zh/en through an adb select tap.

    The helper is intentionally shared by the language case's setup and
    cleanup.  It returns the actual settings text and value, so each result
    line records what the device rendered rather than only the requested enum.
    """
    if not shared.launch_settings(with_fixtures=True):
        return False, {"ready": False}
    if shared.settings_visible_pages() != ["home"]:
        shared.settings_tap('[data-page]:not([hidden]) [data-back]')
        wait_until(shared.settings_visible_pages, lambda pages: pages == ["home"], timeout=4.0)
    current = sev("document.getElementById('uiLanguage')?.value || ''") or ""
    before_locale = sev("document.documentElement.lang || ''") or ""
    if current != choice:
        if not shared.settings_tap("#uiLanguage"):
            return False, {"ready": True, "before": current, "tap": False}
        point = wait_until(
            lambda: ui_option_point(LANGUAGE_OPTIONS[choice]),
            lambda value: value is not None,
            timeout=3.0,
            interval=0.2,
        )
        if point:
            d.tap(point[0], point[1], wait=0.8)
        else:
            # Native select dialogs also accept DPAD; this fallback still uses
            # adb and avoids touching the settings DOM through CDP.
            order = ("auto", "zh", "en")
            try:
                delta = order.index(choice) - order.index(current)
            except ValueError:
                delta = order.index(choice)
            key = "20" if delta > 0 else "19"
            for _ in range(abs(delta)):
                d.shell("input keyevent " + key)
            d.shell("input keyevent 66")
            time.sleep(0.8)
    selected = wait_until(
        lambda: sev("document.getElementById('uiLanguage')?.value || ''"),
        lambda value: value == choice,
        timeout=5.0,
    )
    expected_locale = {"en": "en", "zh": "zh-CN"}.get(choice)
    rendered_locale = wait_until(
        lambda: sev("document.documentElement.lang || ''"),
        lambda value: value in ("zh-CN", "en") and
            (expected_locale is None or value == expected_locale),
        timeout=5.0,
    )
    return selected == choice and rendered_locale in ("zh-CN", "en") and \
        (expected_locale is None or rendered_locale == expected_locale), {
        "before": current,
        "after": selected,
        "beforeLocale": before_locale,
        "locale": rendered_locale,
        "title": sev("document.getElementById('languageTitle')?.textContent || ''") or "",
        "ime": sev("document.getElementById('imeTitle')?.textContent || ''") or "",
    }


def resume_keyboard_readonly():
    """Reopen the debug host after Back closes the settings activity."""
    d.shell("am start -n " + d.PKG +
            "/.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(1.0)
    for _ in range(8):
        keyboard = keyboard_qwerty()
        if keyboard and d.input_shown():
            return keyboard
        bounds = d.field_bounds()
        if bounds:
            d.tap((bounds[0] + bounds[2]) / 2,
                  (bounds[1] + bounds[3]) / 2, wait=0.8)
        time.sleep(0.6)
    return keyboard_qwerty()


def case_independent_ui_language(keyboard):
    """English shell text must not change the active Pinyin engine."""
    clear_host_adb(keyboard)
    if not shared.switch_mode_real("全拼 Pinyin"):
        record("language setup reaches Pinyin", False, "mode switch failed")
        return keyboard
    changed, settings = set_settings_language("en")
    record("English language setup renders English settings text",
           changed and settings.get("title") == "Interface language"
           and settings.get("ime") == "Input method status",
           f"settings={settings}")
    d.shell("input keyevent 4")
    time.sleep(1.2)
    keyboard = resume_keyboard_readonly() or keyboard
    state = wait_until(
        lambda: ev("(() => ({lang:document.documentElement.lang,"
                    "mode:document.querySelector('#modeToggle .cn-main')?.textContent || '',"
                    "setup:document.querySelector('#setupButton')?.getAttribute('aria-label') || ''}))()"),
        lambda value: value and value.get("lang") == "en",
        timeout=6.0,
    ) or {}
    record("English UI stays independent from Pinyin input mode",
           state.get("lang") == "en" and state.get("mode") == "PY"
           and state.get("setup") == "Quick settings",
           f"keyboard={state}")
    restored, restore_detail = set_settings_language("zh")
    record("language setup restores Chinese for following cases",
           restored, f"settings={restore_detail}")
    d.shell("input keyevent 4")
    time.sleep(1.0)
    keyboard = resume_keyboard_readonly() or keyboard
    return keyboard


def shell_input_text(value):
    """Send test data through adb to the focused settings textarea."""
    d.shell("input text " + shlex.quote(value), timeout=30)
    time.sleep(0.8)


def clear_settings_textarea_adb():
    """Clear any prior custom JSON without writing the settings DOM via CDP."""
    existing = sev("document.getElementById('customJson')?.value || ''") or ""
    if not existing:
        return True
    d.shell("input keycombination 113 29")
    d.shell("input keyevent 67")
    d.shell("input keyevent 67")
    time.sleep(0.4)
    # If select-all did not reach the WebView, finish through the actual
    # keyboard backspace key.  The old condition entered this branch only
    # after the field was already empty, leaving stale JSON in place.
    if (sev("document.getElementById('customJson')?.value || ''") or ""):
        keyboard = keyboard_qwerty()
        point = keyboard.get("<backspace>") if keyboard else None
        if point:
            for _ in range(len(existing) + 8):
                d.tap(*point, wait=0.03)
                if not (sev("document.getElementById('customJson')?.value || ''") or ""):
                    break
    return not (sev("document.getElementById('customJson')?.value || ''") or "")


def settings_json_snapshot():
    return sev(
        "(() => { const x=document.getElementById('customJson');"
        "return x ? {value:x.value,start:x.selectionStart,end:x.selectionEnd,"
        "focus:document.activeElement===x,active:document.activeElement?.id || ''} : null; })()"
    ) or {}


def case_settings_json_focus(keyboard):
    """Real settings textarea caret and delete path stay focused and fast."""
    if not shared.switch_mode_real("英文 Direct"):
        record("JSON setup reaches Direct mode", False, "mode switch failed")
        return keyboard
    if not shared.launch_settings(with_fixtures=True):
        record("settings JSON page opens", False, "settings WebView unavailable")
        return keyboard
    opened = shared.settings_tap('button[data-target="input"]')
    page = wait_until(shared.settings_visible_pages,
                      lambda value: value == ["input"], timeout=4.0)
    field_tapped = shared.settings_tap("#customJson", wait=1.0)
    focus_snapshot = settings_json_snapshot()
    focus = focus_snapshot.get("active", "")
    if field_tapped and focus == "customJson":
        cleared = clear_settings_textarea_adb()
        shell_input_text("jsoncaret" * 40)
    else:
        cleared = False
    value_before = (settings_json_snapshot().get("value") or "")
    # Put the caret at a known physical endpoint before comparing two gesture
    # speeds.  This is an adb key event, not a DevTools write.
    d.shell("input keyevent 123")  # KEYCODE_MOVE_END
    selection_before = wait_until(
        settings_json_snapshot,
        lambda value: value and value.get("focus") and
            value.get("start") == len(value_before) and
            value.get("end") == len(value_before),
        timeout=3.0,
    ) or settings_json_snapshot()
    keyboard = wait_until(keyboard_qwerty, lambda value: bool(value), timeout=8.0) or keyboard
    selection_after_scrub = {}
    slow_scrub = {}
    fast_scrub = {}
    scrub_error = ""
    if keyboard and selection_before:
        try:
            # Start on a letter and cross several keys to exceed the 38 CSS
            # pixel recognition threshold. Same displacement at two speeds;
            # compare the actual
            # final caret reported by the textarea, not the swipe return code.
            shared.keyboard_swipe('#qwertyLayer [data-key="h"]', start_fraction=0.9,
                               end_fraction=-2.4, duration_ms=650)
            slow_scrub = wait_until(
                settings_json_snapshot,
                lambda value: value and value.get("focus") and
                    value.get("start", 0) < selection_before.get("start", 0),
                timeout=4.0,
            ) or {}
            d.shell("input keyevent 123")
            wait_until(
                settings_json_snapshot,
                lambda value: value and value.get("focus") and
                    value.get("start") == len(value_before),
                timeout=3.0,
            )
            shared.keyboard_swipe('#qwertyLayer [data-key="h"]', start_fraction=0.9,
                               end_fraction=-2.4, duration_ms=80)
            fast_scrub = wait_until(
                settings_json_snapshot,
                lambda value: value and value.get("focus") and
                    value.get("start", 0) < len(value_before),
                timeout=4.0,
            ) or {}
            selection_after_scrub = fast_scrub
        except RuntimeError as error:
            scrub_error = str(error)
    else:
        scrub_error = "keyboard or initial caret unavailable"
    scrub_ok = (
        slow_scrub.get("focus") is True and fast_scrub.get("focus") is True and
        slow_scrub.get("start", len(value_before)) < len(value_before) and
        fast_scrub.get("start", len(value_before)) < len(value_before) and
        abs(slow_scrub.get("start", -1) - fast_scrub.get("start", -1)) <= 3
    )
    record("settings JSON caret moves left without leaving focus",
           opened and page == ["input"] and field_tapped and focus == "customJson"
           and cleared and len(value_before) >= 100 and scrub_ok,
           f"page={page} focus={focus!r} valueLen={len(value_before)}"
           f" before={selection_before} slow={slow_scrub} fast={fast_scrub}"
           f" after={selection_after_scrub} error={scrub_error!r}")

    shared.refresh_keyboard_geometry()
    keyboard = keyboard_qwerty() or keyboard
    backspace = keyboard.get("<backspace>") if keyboard else None
    timings = []
    # Start the exact 12-key deletion at the end, so every expected value is
    # unambiguous even after the scrub comparison above.
    d.shell("input keyevent 123")
    start_snapshot = wait_until(
        settings_json_snapshot,
        lambda value: value and value.get("focus") and
            value.get("start") == len(value.get("value") or "") and
            value.get("end") == value.get("start"),
        timeout=3.0,
    ) or settings_json_snapshot()
    value_start = start_snapshot.get("value") or ""
    deletion_observations = []
    if backspace:
        for _ in range(12):
            before = settings_json_snapshot()
            before_text = before.get("value") or ""
            before_start = before.get("start")
            if not before.get("focus") or before_start != before.get("end"):
                deletion_observations.append({"ok": False, "reason": "caret lost", "before": before})
                break
            expected_text = before_text[:-1]
            expected_start = max(0, int(before_start) - 1)
            started = time.monotonic()
            d.tap(*backspace, wait=0.0)
            observed = wait_until(
                settings_json_snapshot,
                lambda value: value and value.get("focus") is True and
                    value.get("value") == expected_text and
                    value.get("start") == expected_start and
                    value.get("end") == expected_start,
                timeout=2.5,
                interval=0.03,
            ) or {}
            elapsed = time.monotonic() - started
            timings.append(elapsed)
            deletion_observations.append({
                "ok": observed.get("value") == expected_text and
                    observed.get("start") == expected_start and
                    observed.get("end") == expected_start and
                    observed.get("focus") is True,
                "before": before_text,
                "after": observed.get("value"),
                "caret": observed.get("start"),
            })
    value_after = (settings_json_snapshot().get("value") or "")
    caret_after = settings_json_snapshot()
    max_latency = max(timings) if timings else float("inf")
    exact_twelve = (
        bool(backspace) and len(deletion_observations) == 12 and
        all(item.get("ok") for item in deletion_observations) and
        value_after == value_start[:-12]
    )
    record("JSON backspaces delete text without focus jump",
           exact_twelve and caret_after.get("focus") is True,
           f"before={len(value_start)} after={len(value_after)}"
           f" exact12={exact_twelve} caret={caret_after}"
           f" observations={deletion_observations}")
    record("each JSON backspace stays below the 2s delay",
           len(timings) == 12 and all(item.get("ok") for item in deletion_observations)
           and max_latency < 2.0,
           f"latencies={[round(item, 3) for item in timings]} max={max_latency:.3f}")
    d.shell("input keyevent 4")
    time.sleep(0.8)
    return resume_keyboard_readonly() or keyboard


def adb_checked(*args, timeout=30):
    result = subprocess.run(
        ["adb", "-s", d.SERIAL, *args],
        capture_output=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise RuntimeError(f"adb {' '.join(args)} failed: {detail}")
    return result.stdout


def backup_favorites_status():
    probe = (
        "if [ -f " + FAVORITES_PREF + " ]; then echo exists; "
        "elif [ -d shared_prefs ]; then echo absent; "
        "else echo error >&2; exit 3; fi"
    )
    command = "run-as " + d.PKG + " sh -c " + shlex.quote(probe)
    return adb_checked("shell", command).decode("utf-8", "replace").strip()


def backup_favorites_prefs():
    """Read the user's favorites into ~/tmp before the destructive setup."""
    marker = backup_favorites_status()
    if marker == "absent":
        return {"exists": False, "path": None}
    if marker != "exists":
        raise RuntimeError(f"unexpected favorites preference status: {marker!r}")
    data = adb_checked("exec-out", "run-as", d.PKG, "cat", FAVORITES_PREF)
    if not data or ET.fromstring(data).tag != "map":
        raise RuntimeError("favorites preference could not be backed up as valid XML")
    backup_dir = os.path.expanduser("~/tmp")
    os.makedirs(backup_dir, exist_ok=True)
    fd, path = tempfile.mkstemp(
        prefix="feelime-b25-favorites-", suffix=".xml", dir=backup_dir
    )
    with os.fdopen(fd, "wb") as handle:
        handle.write(data)
    return {"exists": True, "path": path}


def reset_favorites_for_test():
    d.shell("am force-stop " + d.PKG)
    d.shell(
        "run-as " + d.PKG + " sh -c 'rm -f " + FAVORITES_PREF +
        " " + FAVORITES_PREF + ".bak'"
    )
    time.sleep(0.8)


def restore_favorites_prefs(state):
    """Restore the exact pre-suite favorites state, including no-file state."""
    if not state:
        return
    path = state.get("path")
    restored_ok = False
    try:
        d.shell("am force-stop " + d.PKG)
        adb_checked(
            "shell",
            "run-as " + d.PKG + " sh -c 'rm -f " + FAVORITES_PREF +
            " " + FAVORITES_PREF + ".bak'"
        )
        if state.get("exists"):
            if not path or not os.path.isfile(path):
                raise RuntimeError(f"favorites backup is missing: {path}")
            with open(path, "rb") as handle:
                expected = handle.read()
            adb_checked("push", path, FAVORITES_DEVICE_BACKUP, timeout=30)
            adb_checked(
                "shell",
                "run-as " + d.PKG + " cp " + FAVORITES_DEVICE_BACKUP +
                " " + FAVORITES_PREF,
            )
            actual = adb_checked("exec-out", "run-as", d.PKG, "cat", FAVORITES_PREF)
            if actual != expected:
                raise RuntimeError("favorites preference restore byte check failed")
        else:
            marker = backup_favorites_status()
            if marker != "absent":
                raise RuntimeError(f"favorites preference still exists: {marker}")
        restored_ok = True
    finally:
        d.shell("rm -f " + FAVORITES_DEVICE_BACKUP)
        if path and restored_ok:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        elif path:
            print(f"ERROR: favorites backup retained at {path}", file=sys.stderr, flush=True)


def prepare_ui_language_zh():
    """Capture the real UI choice, then select Chinese before mode literals."""
    changed, detail = set_settings_language("zh")
    original = detail.get("before")
    if not detail.get("ready", True) or original not in ("auto", "zh", "en"):
        raise RuntimeError(f"cannot capture original UI language: {detail}")
    if not changed:
        raise RuntimeError(f"cannot set Chinese UI language: {detail}")
    d.shell("input keyevent 4")
    time.sleep(1.0)
    return original


def restore_ui_language(choice):
    if choice not in ("auto", "zh", "en"):
        return
    restored, detail = set_settings_language(choice)
    if not restored:
        raise RuntimeError(f"cannot restore original UI language {choice}: {detail}")
    d.shell("input keyevent 4")
    time.sleep(0.8)


def main():
    # Keep this suite standalone: only the serial comes from the environment;
    # no repository path, serial number, or host name is embedded here.
    original_ui_choice = None
    favorites_backup = None
    try:
        # Chinese is selected through the real settings select first, because
        # all mode-menu literals below intentionally follow the Chinese UI.
        original_ui_choice = prepare_ui_language_zh()
        favorites_backup = backup_favorites_prefs()
        d.shell("settings put system accelerometer_rotation 0")
        d.shell("settings put system user_rotation 0")
        reset_favorites_for_test()
        keyboard = prepare_readonly()
        case_default_phrase_code(keyboard)
        keyboard = keyboard_qwerty() or keyboard
        case_custom_phrase_code(keyboard)
        keyboard = keyboard_qwerty() or keyboard
        case_french_reedit_and_quick_save(keyboard)
        keyboard = keyboard_qwerty() or keyboard
        keyboard = case_independent_ui_language(keyboard)
        keyboard = case_settings_json_focus(keyboard)

        failed = [name for name, ok, _ in RESULTS if not ok]
        passed = len(RESULTS) - len(failed)
        print(f"\n== phrase-codes device suite: {passed}/{len(RESULTS)} passed ==")
        if failed:
            print("failures: " + " | ".join(failed))
            sys.exit(1)
    finally:
        # Both stores are user state.  Restore even when a case raises or the
        # suite exits on an assertion failure.
        try:
            restore_favorites_prefs(favorites_backup)
        finally:
            restore_ui_language(original_ui_choice)


if __name__ == "__main__":
    main()
