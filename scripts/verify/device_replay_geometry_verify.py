#!/usr/bin/env python3
""" Device gates for candidate replay and keyboard geometry.

This file covers the keyboard paths that need a real InputConnection:

* Full-Pinyin ``c'shi`` expansion, in-place replay through ``ca'shi`` and
  ``cai'shi``, return to the original spelling, and final candidate commit.
* A saved Pinyin/Direct quick pair while a third keyboard is selected from the
  long-press menu.  The temporary keyboard must not rewrite the pair.
* A saved height followed by the control layer, Fn's long-press popup, Fn's
  short-lock labels, and the control layer's close path.  The same checks run
  in portrait and landscape; a present navigation inset is checked against
  the independent system frame.

The WebView is an observation channel.  DOM evaluation reads state and
geometry only; taps and swipes use adb coordinates from the live DOM.  Voice,
cursor, settings-page, model, and offline-import cases belong to their own
gates and are intentionally outside this suite.
"""

import base64
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_fn_custom_verify as b21
import fv_common as shared
import device_verify as d


RESULTS = []
SKIPPED = []

HEIGHT_PREF = "shared_prefs/feelime_keyboard.xml"
QUICK_PAIR_KEY = "feelime_quick_pair"
HEIGHT_LOCAL_KEYS = (
    "feelime_kb_height_portrait",
    "feelime_kb_height_landscape",
)
PAIR_FIXTURE = ["pinyin", "direct"]
PAIR_LABELS = {
    "pinyin": ("拼", "PY"),
    "direct": ("En", "English"),
}


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def skip(name, detail):
    SKIPPED.append((name, detail))
    print(f"SKIP {name}  [{detail}]", flush=True)


def ev(expression):
    return d.devtools_eval(expression)


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


def pref_snapshot(path):
    """Read one app-private preference file without changing it."""
    result = d.shell(f"run-as {d.PKG} cat {path}")
    exists = bool(result) and "No such file" not in result
    return exists, result


def restore_pref(path, snapshot):
    exists, data = snapshot
    if not exists:
        d.shell(f"run-as {d.PKG} rm -f {path}")
        return
    encoded = base64.b64encode(data.encode()).decode()
    d.shell(f"run-as {d.PKG} sh -c 'echo {encoded} | base64 -d > {path}'")


def local_storage_snapshot():
    expression = (
        "(() => { const out = {};"
        " for (const key of " + json.dumps([QUICK_PAIR_KEY, *HEIGHT_LOCAL_KEYS]) + ")"
        " out[key] = localStorage.getItem(key);"
        " return out; })()"
    )
    value = ev(expression)
    return value if isinstance(value, dict) else {}


def restore_local_storage(snapshot):
    if not snapshot:
        return
    pairs = []
    for key in (QUICK_PAIR_KEY, *HEIGHT_LOCAL_KEYS):
        value = snapshot.get(key)
        if value is None:
            pairs.append("localStorage.removeItem(" + json.dumps(key) + ")")
        else:
            pairs.append("localStorage.setItem(" + json.dumps(key) + "," +
                         json.dumps(value) + ")")
    ev("(() => { " + "; ".join(pairs) + "; return true; })()")


def normalized_raw(value):
    return (value or "").replace(" ", "").replace("’", "'").strip()


CANDIDATE_STATE_JS = r"""
(() => {
  const text = selector => [...document.querySelectorAll(selector)]
    .map(el => el.textContent.trim());
  const variants = [...document.querySelectorAll('#expandVariants .expand-variant')]
    .map(el => ({text: el.textContent.trim(), current: el.classList.contains('current')}));
  return {
    raw: document.getElementById('preeditLine')?.textContent || '',
    composing: document.body.classList.contains('composing'),
    expanded: !document.getElementById('expandLayer')?.hidden,
    variantsHidden: !!document.getElementById('expandVariants')?.hidden,
    variants,
    grid: text('#expandGrid .expand-candidate'),
    candidates: text('#candidates .candidate'),
    replaying: !!window.Feelime?.variantReplaying,
    replayTimer: !!window.Feelime?.variantReplayTimer,
    expandKey: window.Feelime?.expandKey || null
  };
})()
"""


LAYOUT_STATE_JS = r"""
(() => {
  const rect = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {left:r.left, top:r.top, right:r.right, bottom:r.bottom,
            width:r.width, height:r.height};
  };
  const view = document.getElementById('softKeyboard');
  const rows = [...document.querySelectorAll('#qwertyLayer .kb-row')]
    .map(rect);
  const ctrl = document.getElementById('ctrlLayer');
  const safeText = getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-bottom').trim();
  const safe = Number.parseFloat(safeText) || 0;
  const bottom = rows.length ? rows[rows.length - 1].bottom : null;
  const vr = rect(view);
  return {
    landscape: document.body.classList.contains('landscape'),
    ctrlView: document.body.classList.contains('ctrl-view'),
    qwertyHidden: !!document.getElementById('qwertyLayer')?.hidden,
    ctrlHidden: !!ctrl?.hidden,
    view: vr,
    viewClientHeight: view?.clientHeight || 0,
    rows,
    rowHeight: rows.length ? rows[0].height : 0,
    rowBottom: bottom,
    bottomGap: vr && bottom != null ? vr.bottom - bottom : null,
    safe,
    ctrl: rect(ctrl),
    controlCount: document.querySelectorAll('#ctrlLayer .ctrl-key').length,
    cssWidth: window.innerWidth
  };
})()
"""


FN_STATE_JS = r"""
(() => {
  const keys = ['q','w','e','r','t','y','u','i','o','p','k','l'];
  const out = {};
  for (const key of keys) {
    const button = document.querySelector(`[data-key="${key}"]`);
    const main = button?.querySelector('.kb-main');
    const alt = button?.querySelector('.kb-alt');
    const br = button?.getBoundingClientRect();
    const mr = main?.getBoundingClientRect();
    const ar = alt?.getBoundingClientRect();
    const cs = alt ? getComputedStyle(alt) : null;
    out[key] = {
      main: main?.textContent || '', alt: alt?.textContent || '',
      fn: !!button?.classList.contains('fn-label'),
      buttonWidth: br?.width || 0, buttonCenter: br ? br.top + br.height / 2 : 0,
      mainWidth: mr?.width || 0, mainCenter: mr ? mr.top + mr.height / 2 : 0,
      altWidth: ar?.width || 0, altHeight: ar?.height || 0,
      altDisplay: cs?.display || '', altVisibility: cs?.visibility || '',
      fontSize: parseFloat(getComputedStyle(main).fontSize || '0') || 0
    };
  }
  return {
    active: !!document.querySelector('[data-ctrl="sticky-fn"]')?.classList.contains('active'),
    items: out
  };
})()
"""


def layout_state():
    return ev(LAYOUT_STATE_JS) or {}


def candidate_state():
    return ev(CANDIDATE_STATE_JS) or {}


def tap_selector(selector, wait=0.45):
    point = shared.keyboard_point(selector)
    if not point:
        raise RuntimeError(f"keyboard selector not visible: {selector}")
    d.tap(*point, wait=wait)


def tap_variant(text, wait=0.08):
    point = shared.keyboard_text_point(text, "#expandVariants .expand-variant")
    if not point:
        raise RuntimeError(f"variant not visible: {text}")
    d.tap(*point, wait=wait)


def type_split_pinyin(keyboard, value):
    """Type one or more apostrophe-separated syllables through key faces."""
    pieces = value.split("'")
    for index, piece in enumerate(pieces):
        for char in piece:
            d.press(keyboard, char, wait=0.22)
        if index + 1 < len(pieces):
            # Chinese separator is rendered in the former Shift slot.
            d.press(keyboard, "<shift>", wait=0.22)


def wait_composition(raw, timeout=8.0):
    return wait_until(
        candidate_state,
        lambda value: value.get("composing") and
        normalized_raw(value.get("raw")) == raw,
        timeout=timeout,
    )


def case_candidate_replay(keyboard):
    if not shared.switch_mode_real("全拼 Pinyin"):
        record("candidate replay reaches Pinyin", False, "mode switch failed")
        return keyboard

    d.clear_field(keyboard)
    type_split_pinyin(keyboard, "c'shi")
    initial = wait_composition("c'shi")
    if not initial:
        record("c'shi composition reaches the engine", False,
               str(candidate_state()))
        return keyboard

    tap_selector("#composeExpand", wait=0.7)
    expanded = wait_until(
        candidate_state,
        lambda value: value.get("expanded") and
        not value.get("variantsHidden") and
        any(item.get("text") == "ca'shi" for item in value.get("variants", [])) and
        any(item.get("text") == "cai'shi" for item in value.get("variants", [])),
        timeout=8.0,
    ) or candidate_state()
    variant_texts = [item.get("text") for item in expanded.get("variants", [])]
    original_left = set(variant_texts)
    record("c'shi expansion keeps the parse column",
           expanded.get("expanded") and not expanded.get("variantsHidden") and
           "c'shi" in original_left and "ca'shi" in original_left and
           "cai'shi" in original_left,
           f"variants={variant_texts[:32]}")

    previous_grid = list(expanded.get("grid", []))
    transitions = []
    for target in ("ca'shi", "cai'shi", "c'shi"):
        try:
            tap_variant(target)
        except RuntimeError as error:
            record(f"replay reaches {target}", False, str(error))
            break
        settled = wait_until(
            candidate_state,
            lambda value, target=target: value.get("expanded") and
            not value.get("replaying") and
            normalized_raw(value.get("raw")) == target and
            any(item.get("text") == target and item.get("current")
                for item in value.get("variants", [])),
            timeout=8.0,
        ) or candidate_state()
        current_left = {item.get("text") for item in settled.get("variants", [])}
        current_grid = list(settled.get("grid", []))
        changed = current_grid != previous_grid
        transitions.append((target, settled, changed))
        record(f"replay keeps left column and updates candidates: {target}",
               settled.get("expanded") and not settled.get("variantsHidden") and
               target in current_left and original_left.issubset(current_left) and
               bool(current_grid) and changed,
               f"raw={settled.get('raw')!r} left={len(current_left)} "
               f"grid={current_grid[:6]} previous={previous_grid[:6]}")
        previous_grid = current_grid

    # The timer must clear after the final echo, and the layer must stay open
    # long enough for the next physical candidate tap.
    time.sleep(1.8)
    timer_state = candidate_state()
    record("replay guard and timer settle without collapsing the layer",
           timer_state.get("expanded") and not timer_state.get("replaying") and
           not timer_state.get("replayTimer") and
           normalized_raw(timer_state.get("raw")) == "c'shi",
           f"state={timer_state}")

    final_point = shared.keyboard_point("#expandGrid .expand-candidate")
    if final_point:
        d.tap(*final_point, wait=1.0)
        final_state = wait_until(
            candidate_state,
            lambda value: not value.get("composing") and
            not value.get("expanded"),
            timeout=8.0,
        ) or candidate_state()
        committed = d.field_text_retry() or ""
        record("final candidate tap commits the replayed spelling",
               bool(committed) and not final_state.get("composing") and
               not final_state.get("expanded"),
               f"field={committed!r} state={final_state}")
    else:
        record("final candidate tap commits the replayed spelling", False,
               "expanded candidate grid is empty")

    # A complete spelling still gets a stable current entry in the left
    # column.  This also proves the old parse does not leak into a new pool.
    d.clear_field(keyboard)
    type_split_pinyin(keyboard, "cashi")
    complete = wait_composition("cashi")
    tap_selector("#composeExpand", wait=0.7)
    complete_state = wait_until(
        candidate_state,
        lambda value: value.get("expanded") and
        any(normalized_raw(item.get("text")).replace("'", "") == "cashi" and item.get("current")
            for item in value.get("variants", [])),
        timeout=8.0,
    ) or candidate_state()
    complete_variants = [item.get("text") for item in complete_state.get("variants", [])]
    record("complete cashi keeps its current spelling column",
           bool(complete) and complete_state.get("expanded") and
           not complete_state.get("variantsHidden") and
           len(complete_variants) == 1 and
           normalized_raw(complete_variants[0]).replace("'", "") == "cashi" and
           complete_state.get("variants", [{}])[0].get("current"),
           f"variants={complete_variants} state={complete_state}")
    if complete_state.get("expanded"):
        tap_selector("#expandCollapse", wait=0.5)
    d.clear_field(keyboard)
    return d.fresh_kb(refocus=True) or keyboard


def set_pair_fixture(pair):
    """Seed the saved pair, then restart so production startup reads it.

    This is test setup, equivalent to restoring a preference snapshot.  The
    behavior under test (temporary menu selection and short toggle) still
    uses physical input throughout.
    """
    payload = json.dumps(pair, ensure_ascii=False)
    if ev("localStorage.setItem(" + json.dumps(QUICK_PAIR_KEY) + "," +
           json.dumps(payload) + "); true") is not True:
        raise RuntimeError("cannot seed quick-pair storage")
    d.app_hard_reset()
    keyboard = d.fresh_kb(refocus=True)
    if not keyboard:
        raise RuntimeError("keyboard unavailable after quick-pair restart")
    return keyboard


def mode_chip():
    return ev("document.querySelector('#modeToggle .cn-main')?.textContent || ''") or ""


def wait_mode_any(labels):
    wanted = set(labels)
    return wait_until(mode_chip, lambda value: value in wanted, timeout=10.0)


def pair_storage():
    value = ev("localStorage.getItem(" + json.dumps(QUICK_PAIR_KEY) + ")")
    return value


def case_quick_pair(keyboard):
    try:
        keyboard = set_pair_fixture(PAIR_FIXTURE)
    except RuntimeError as error:
        record("quick pair fixture starts with a live keyboard", False, str(error))
        return keyboard

    if not shared.switch_mode_real("Français"):
        record("long-press can select a temporary third keyboard", False,
               "Français unavailable; state=" + str(shared.keyboard_state()) +
               "; menu=" + str(ev("document.getElementById('modeMenu')?.outerHTML")))
        return keyboard

    saved = pair_storage()
    sub_before = ev("document.querySelector('#modeToggle .cn-sub')?.textContent || ''")
    expected_first = PAIR_LABELS[PAIR_FIXTURE[0]]
    record("temporary keyboard leaves the saved quick pair unchanged",
           saved == json.dumps(PAIR_FIXTURE, ensure_ascii=False) and
           sub_before in expected_first,
           f"pair={saved!r} sub={sub_before!r} mode={mode_chip()!r}")

    tap_selector("#modeToggle", wait=0.8)
    first = wait_mode_any(PAIR_LABELS["pinyin"])
    sub_second = ev("document.querySelector('#modeToggle .cn-sub')?.textContent || ''")
    record("temporary third keyboard short-toggles to saved pair first",
           first in PAIR_LABELS["pinyin"] and sub_second in PAIR_LABELS["direct"],
           f"mode={first!r} sub={sub_second!r}")

    tap_selector("#modeToggle", wait=0.8)
    second = wait_mode_any(PAIR_LABELS["direct"])
    sub_first = ev("document.querySelector('#modeToggle .cn-sub')?.textContent || ''")
    record("saved quick pair toggles to its second keyboard",
           second in PAIR_LABELS["direct"] and sub_first in PAIR_LABELS["pinyin"],
           f"mode={second!r} sub={sub_first!r}")
    record("quick-pair storage remains unchanged after both toggles",
           pair_storage() == json.dumps(PAIR_FIXTURE, ensure_ascii=False),
           f"pair={pair_storage()!r}")
    return d.fresh_kb(refocus=True) or keyboard


def rect_close(left, right, tolerance=2.0):
    if not left or not right:
        return False
    try:
        return abs(float(left) - float(right)) <= tolerance
    except (TypeError, ValueError):
        return False


def geometry_matches(reference, current, tolerance=2.0):
    if not reference or not current:
        return False
    rows_a = reference.get("rows") or []
    rows_b = current.get("rows") or []
    if len(rows_a) != 4 or len(rows_b) != 4:
        return False
    return all(rect_close(a.get("height"), b.get("height"), tolerance)
               and rect_close(a.get("bottom"), b.get("bottom"), tolerance)
               for a, b in zip(rows_a, rows_b)) and \
        rect_close(reference.get("bottomGap"), current.get("bottomGap"), tolerance)


def fn_labels_ok(state):
    expected = dict(zip(
        ("q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "k", "l"),
        (f"F{i}" for i in range(1, 13)),
    ))
    items = state.get("items") or {}
    if not state.get("active") or len(items) != len(expected):
        return False
    for key, label in expected.items():
        item = items.get(key) or {}
        alt_hidden = item.get("altDisplay") == "none" or \
            item.get("altVisibility") == "hidden" or item.get("altHeight", 1) <= 0
        if (not item.get("fn") or item.get("main") != label or not alt_hidden or
                item.get("mainWidth", math.inf) > item.get("buttonWidth", 0) + 0.5 or
                abs(item.get("mainCenter", 0) - item.get("buttonCenter", 0)) > 2.0 or
                item.get("fontSize", math.inf) > 16.1):
            return False
    return True


def fn_unlocked_ok(state):
    item = (state.get("items") or {}).get("q") or {}
    alt_visible = item.get("altDisplay") != "none" and \
        item.get("altVisibility") != "hidden" and item.get("altHeight", 0) > 0
    return not state.get("active") and item.get("main") == "q" and \
        item.get("alt") == "1" and alt_visible


def open_height_card():
    tap_selector("#setupButton")
    opened = wait_until(
        lambda: ev("document.getElementById('settingsPanel')?.classList.contains('open')"),
        lambda value: value is True,
        timeout=4.0,
    )
    if not opened:
        raise RuntimeError("quick settings panel did not open")
    # The landscape panel scrolls; a DOM rectangle below its clipped bottom
    # is not a tappable row. Scroll with real input before selecting it.
    for _ in range(5):
        visible = ev(
            "(() => { const e=[...document.querySelectorAll('#settingsPanel .qs-tile')]"
            ".find(t=>['键盘高度','Keyboard height'].includes(t.querySelector('.qs-name')?.textContent.trim()));"
            "if(!e)return false;const r=e.getBoundingClientRect();"
            "return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()")
        if visible:
            break
        shared.refresh_keyboard_geometry()
        panel = shared.keyboard_rect("#settingsPanel")
        if not panel:
            raise RuntimeError("quick settings scroll area unavailable")
        x = round((panel["left"] + panel["width"] / 2) * d._DT_SCALE + d._DT_OFFSET[0])
        y1 = round((panel["top"] + panel["height"] * 0.85) * d._DT_SCALE + d._DT_OFFSET[1])
        y2 = round((panel["top"] + panel["height"] * 0.15) * d._DT_SCALE + d._DT_OFFSET[1])
        d.shell(f"input swipe {x} {y1} {x} {y2} 400")
        time.sleep(0.4)
    shared.keyboard_text_tap_any(("键盘高度", "Keyboard height"),
                              "#settingsPanel .qs-name", wait=0.7)
    state = wait_until(shared.height_state,
                       lambda value: value.get("open") is True,
                       timeout=4.0) or {}
    if not state.get("open"):
        raise RuntimeError("height card did not open")
    return state


class HeightRangeCapped(RuntimeError):
    """The actual screen budget leaves no editable height range."""


def save_changed_height():
    initial = open_height_card()
    direction = "plus" if not initial.get("plusDisabled") else "minus"
    if initial.get("plusDisabled") and initial.get("minusDisabled"):
        tap_selector("#heightCardCancel")
        raise HeightRangeCapped(f"height range is capped at {initial}")
    tap_selector("#heightPlus" if direction == "plus" else "#heightMinus")
    edited = wait_until(
        shared.height_state,
        lambda value: value.get("open") and
        value.get("value") != initial.get("value"),
        timeout=4.0,
    ) or shared.height_state()
    # The buttons remain enabled at an individual bound.  A saved/default
    # height can already be at the ceiling, so try the other physical button
    # before concluding that a usable range cannot be edited.
    if edited.get("value") == initial.get("value") and direction == "plus" and not initial.get("minusDisabled"):
        tap_selector("#heightMinus")
        edited = wait_until(
            shared.height_state,
            lambda value: value.get("open") and value.get("value") != initial.get("value"),
            timeout=4.0,
        ) or shared.height_state()
    if edited.get("value") == initial.get("value"):
        tap_selector("#heightCardCancel")
        raise RuntimeError(f"height button did not change value: {initial}")
    save = shared.height_state()
    if save.get("saveDisabled"):
        tap_selector("#heightCardCancel")
        raise RuntimeError(f"height Save disabled after edit: {edited}")
    tap_selector("#heightCardSave", wait=1.0)
    closed = wait_until(
        lambda: ev("document.getElementById('heightCard')?.hidden"),
        lambda value: value is True,
        timeout=5.0,
    )
    if not closed:
        raise RuntimeError("height card did not close after Save")
    time.sleep(0.8)
    return initial, edited, layout_state()


def case_control_height(keyboard, orientation_name):
    # A previous candidate or mode case can leave a panel/layer up.  The
    # setup call is intentionally a physical path; this is the height case's
    # preparation, not a synthetic DOM click.
    keyboard = d.fresh_kb(refocus=True) or keyboard
    if not shared.switch_mode_real("英文 Direct"):
        record(f"{orientation_name} height setup reaches Direct", False,
               "mode switch failed; state=" + str(shared.keyboard_state()) +
               "; menu=" + str(ev("document.getElementById('modeMenu')?.outerHTML")))
        return keyboard
    d.clear_field(keyboard)
    try:
        initial, edited, saved = save_changed_height()
        record(f"{orientation_name} height Save changes the persisted layout",
               edited.get("value") != initial.get("value") and
               saved.get("rowHeight", 0) > 0 and len(saved.get("rows", [])) == 4,
               f"initial={initial.get('value')} edited={edited.get('value')} "
               f"saved={saved}")
    except HeightRangeCapped as error:
        skip(f"{orientation_name} height Save changes the persisted layout",
             str(error) + "; repeat on a display with an editable height range")
        saved = layout_state()
    except RuntimeError as error:
        record(f"{orientation_name} height Save changes the persisted layout",
               False, str(error))
        saved = layout_state()

    if not saved.get("rows"):
        record(f"{orientation_name} saved height exposes four qwerty rows",
               False, str(saved))
        return keyboard
    record(f"{orientation_name} saved height exposes four qwerty rows",
           len(saved.get("rows", [])) == 4 and not saved.get("qwertyHidden"),
           f"rows={len(saved.get('rows', []))} rowHeight={saved.get('rowHeight')}")

    tap_selector("#ctrlTool", wait=0.7)
    ctrl = wait_until(layout_state,
                      lambda value: value.get("ctrlView") and
                      not value.get("ctrlHidden"), timeout=4.0) or layout_state()
    record(f"{orientation_name} control view keeps saved row geometry",
           ctrl.get("ctrlView") and ctrl.get("controlCount") == 16 and
           geometry_matches(saved, ctrl),
           f"saved={saved} ctrl={ctrl}")

    shared.keyboard_long_press('[data-ctrl="sticky-fn"]', hold_ms=650)
    popup = wait_until(
        lambda: ev("document.getElementById('comboPopup')?.classList.contains('open')"),
        lambda value: value is True,
        timeout=4.0,
    )
    popup_layout = layout_state()
    record(f"{orientation_name} Fn long-press leaves four rows in place",
           popup is True and geometry_matches(saved, popup_layout),
           f"popup={popup} layout={popup_layout}")
    if popup:
        tap_selector("#comboClose", wait=0.5)
        wait_until(
            lambda: ev("!document.getElementById('comboPopup')?.classList.contains('open')"),
            lambda value: value is True,
            timeout=3.0,
        )

    tap_selector('[data-ctrl="sticky-fn"]', wait=0.5)
    fn_active = wait_until(lambda: ev(FN_STATE_JS),
                           lambda value: value and value.get("active"),
                           timeout=4.0) or ev(FN_STATE_JS) or {}
    record(f"{orientation_name} Fn lock centers compact F labels",
           fn_labels_ok(fn_active), f"state={fn_active}")
    record(f"{orientation_name} Fn lock preserves saved row geometry",
           geometry_matches(saved, layout_state()), f"saved={saved} current={layout_state()}")

    tap_selector('[data-ctrl="sticky-fn"]', wait=0.5)
    fn_off = wait_until(lambda: ev(FN_STATE_JS),
                        lambda value: value and not value.get("active"),
                        timeout=4.0) or ev(FN_STATE_JS) or {}
    record(f"{orientation_name} Fn unlock restores main and alt labels",
           fn_unlocked_ok(fn_off), f"state={fn_off}")

    tap_selector('[data-ctrl="collapse"]', wait=0.7)
    closed = wait_until(layout_state,
                        lambda value: not value.get("ctrlView") and
                        value.get("ctrlHidden"), timeout=4.0) or layout_state()
    record(f"{orientation_name} control close restores saved bottom spacing",
           not closed.get("ctrlView") and closed.get("ctrlHidden") and
           geometry_matches(saved, closed),
           f"saved={saved} closed={closed}")
    return d.fresh_kb(refocus=True) or keyboard


def check_navigation_safe_area(orientation_name):
    state = layout_state()
    safe = float(state.get("safe") or 0)
    if safe <= 0:
        skip(f"{orientation_name} non-zero navigation safe area",
             "device reports no bottom safe area for this orientation")
        return
    nav_bar = {
        "safe": safe,
        "viewBottom": (state.get("view") or {}).get("bottom"),
        "controlBottom": state.get("rowBottom"),
        "controlCount": len(state.get("rows") or []),
        "cssWidth": state.get("cssWidth"),
    }
    ok, detail = b21.safe_area_geometry(nav_bar)
    record(f"{orientation_name} rows clear the navigation safe area", ok,
           str(detail))


def skip_landscape_checks(reason):
    """Keep a failed rotation from becoming a portrait false pass."""
    for name in (
        "height Save changes the persisted layout",
        "saved height exposes four qwerty rows",
        "control view keeps saved row geometry",
        "Fn long-press leaves four rows in place",
        "Fn lock centers compact F labels",
        "Fn lock preserves saved row geometry",
        "Fn unlock restores main and alt labels",
        "control close restores saved bottom spacing",
        "rows clear the navigation safe area",
    ):
        skip(f"landscape {name}", reason)


def main():
    original_accel = d.shell("settings get system accelerometer_rotation").strip()
    original_rotation = d.shell("settings get system user_rotation").strip()
    original_height_pref = pref_snapshot(HEIGHT_PREF)
    original_storage = {}
    rotated = False
    keyboard = None
    try:
        # Start from a deterministic portrait surface; the preference and
        # localStorage snapshots below are restored even when a case fails.
        d.shell("settings put system accelerometer_rotation 0")
        d.shell("settings put system user_rotation 0")
        d.shell(f"run-as {d.PKG} rm -f {HEIGHT_PREF}")
        d.shell("am force-stop " + d.PKG)
        # #H：清基线把 hwkb 形态 pin 一并抹掉——AVD 硬键盘 + 持久化
        # 拼音模式会在下次启动直接收成候选条（fresh_kb 拿不到键区）。
        # 进程已停再写（活进程的 SharedPreferences 写盘会盖回夹具）。
        d.pin_hwkb_form()
        time.sleep(1.0)
        d.prepare()
        keyboard = d.fresh_kb(refocus=True)
        if not keyboard:
            raise SystemExit("keyboard geometry unavailable")
        original_storage = local_storage_snapshot()

        keyboard = case_candidate_replay(keyboard) or keyboard
        keyboard = case_quick_pair(keyboard) or keyboard
        keyboard = case_control_height(keyboard, "portrait") or keyboard
        check_navigation_safe_area("portrait")

        # Recreate the keyboard after rotation so the DevTools oracle cannot
        # keep answering from the detached portrait target.
        b21.KB = keyboard
        b21.set_orientation(True)
        rotated = True
        keyboard = d.fresh_kb(refocus=True)
        if not keyboard:
            raise RuntimeError("landscape keyboard geometry unavailable")
        # Both the display service and the CSS hello/layout must agree before
        # the landscape assertions run.  A platform that ignores rotation
        # must produce SKIP entries; recording the portrait geometry as a
        # landscape pass would hide the very regression these checks target.
        physical_landscape = b21.device_is_landscape()
        css_landscape = bool(layout_state().get("landscape"))
        if physical_landscape and css_landscape:
            keyboard = case_control_height(keyboard, "landscape") or keyboard
            check_navigation_safe_area("landscape")
        else:
            reason = ("platform skipped: device did not rotate to landscape"
                      if not physical_landscape else
                      "platform skipped: keyboard did not expose landscape layout")
            skip_landscape_checks(reason)
    finally:
        # Restore app-owned state before force-stop so the next input view
        # reads the user's original values.  localStorage restoration can fail
        # if the WebView was torn down; the preference file is still restored.
        try:
            restore_pref(HEIGHT_PREF, original_height_pref)
        except Exception as error:
            print(f"WARN height preference restore failed: {error}", flush=True)
        try:
            restore_local_storage(original_storage)
        except Exception as error:
            print(f"WARN localStorage restore failed: {error}", flush=True)
        if rotated:
            try:
                d.shell("settings put system user_rotation 0")
                d.shell("am force-stop " + d.PKG)
                time.sleep(0.6)
            except Exception:
                pass
        if original_rotation:
            d.shell("settings put system user_rotation " + original_rotation)
        if original_accel in ("0", "1"):
            d.shell("settings put system accelerometer_rotation " + original_accel)
        d.shell("am force-stop " + d.PKG)

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== replay-geometry device suite: {passed}/{len(RESULTS)} passed; "
          f"{len(SKIPPED)} skipped ==", flush=True)
    if SKIPPED:
        print("skips: " + " | ".join(f"{name}: {detail}" for name, detail in SKIPPED),
              flush=True)
    if failed:
        print("failures: " + " | ".join(failed), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
