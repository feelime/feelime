#!/usr/bin/env python3
"""Device gates (control-layer switch/slot contract, height card).

#1 the ctrl view is a SWITCH: composing suspends it, committing the
   composition brings the rows back; X keeps it off.
#2 the ctrl rows live INSIDE the toolbar slot (<= 44px) and never shrink
   the keyboard rows below.
#3 the height card pins to the keyboard's top edge, owns its layout slice
   (the bar is pushed below it), and cancel restores everything."""
import os
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


def main():
    initial_accel = d.shell("settings get system accelerometer_rotation").strip()
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(1.2)
    d.clear_field(kb)

    GEOM = ("(() => ({ ctrlH: document.getElementById('ctrlLayer').clientHeight,"
            " barH: document.getElementById('candidateBar').clientHeight,"
            " rowH: document.querySelector('#qwertyLayer .kb-row').clientHeight,"
            " qwertyTop: document.querySelector('#qwertyLayer').getBoundingClientRect().top,"
            " ctrlHidden: document.getElementById('ctrlLayer').hidden,"
            " barHidden: document.getElementById('candidateBar').hidden,"
            " editing: document.body.classList.contains('height-editing'),"
            " handleHidden: !document.getElementById('heightCard').classList.contains('open'),"
            " barTop: document.getElementById('candidateBar').getBoundingClientRect().top,"
            " handleBottom: document.getElementById('heightCard').getBoundingClientRect().bottom"
            " }))()")

    # ---- #2 the ctrl rows stay inside the bar slot ----
    # (design §11, slot conservation 2026-09-18) ctrlLayer height follows the
    # preedit band: calc(band + 43px) with margins 3+3, so the ctrl slot
    # (3 + band+43 + 3) equals the normal slot (band + 2+40+10) at every band
    # level. The user-visible guarantees: the qwerty top edge does not move
    # between the two states and the keyboard rows keep their height.
    base = ev("(() => ({ rowH: document.querySelector('#qwertyLayer .kb-row').clientHeight,"
              " top: document.querySelector('#qwertyLayer').getBoundingClientRect().top,"
              " band: parseFloat(getComputedStyle(document.body).getPropertyValue('--preedit-band')) || 18 }))()")
    baseline = base.get("rowH")
    ev("document.getElementById('ctrlTool').click()")
    time.sleep(0.6)
    state = ev(GEOM)
    expect_ctrl = round(base.get("band")) + 43
    record("ctrl rows inside the bar slot, keyboard rows unshrunk",
           bool(state) and 0 < state.get("ctrlH", 0) == expect_ctrl
           and state.get("rowH") == baseline
           and abs((state.get("qwertyTop") or 0) - base.get("top", 0)) <= 1,
           f"baseline={baseline} expect_ctrlH={expect_ctrl} state={state}")

    # ---- #1 composing suspends, committing restores, X stays off ----
    d.clear_field(kb)
    for ch in "ni":
        d.press(kb, ch, 0.12)
    time.sleep(0.8)
    composing = ev(GEOM)
    record("composing suspends the ctrl rows (bar returns)",
           bool(composing) and composing.get("ctrlHidden") and not composing.get("barHidden"),
           str(composing))
    d.clear_field(kb)
    time.sleep(0.8)
    resumed = ev(GEOM)
    record("committing the composition restores the ctrl rows",
           bool(resumed) and not resumed.get("ctrlHidden") and resumed.get("barHidden"),
           str(resumed))
    ev("document.querySelector('[data-ctrl=\"collapse\"]').click()")
    time.sleep(0.4)
    d.clear_field(kb)
    for ch in "ni":
        d.press(kb, ch, 0.12)
    time.sleep(0.8)
    d.clear_field(kb)
    time.sleep(0.8)
    off = ev(GEOM)
    record("X keeps the switch off across a later composition",
           bool(off) and off.get("ctrlHidden") and not off.get("barHidden"),
           str(off))

    # ---- #3 the height card owns the top edge ----
    ev("document.getElementById('setupButton').click()")
    time.sleep(0.5)
    ev("(() => { const tile = [...document.querySelectorAll('#settingsPanel .qs-tile')]"
       ".find(t => ['键盘高度', 'Keyboard height'].includes(t.querySelector('.qs-name')?.textContent.trim()));"
       " tile?.click(); return tile ? 'ok' : 'no-tile'; })()")
    time.sleep(0.8)
    card = ev(GEOM)
    # design §3.4: the card floats in the band ABOVE the keyboard (no
    # body.height-editing push anymore) - the guarantee is "no overlap with
    # the bar" + keyboard rows unshrunk.
    record("height card floats above the keyboard; bar unobstructed",
           bool(card) and not card.get("handleHidden")
           and card.get("barTop") >= card.get("handleBottom", 0) - 1
           and card.get("rowH") == baseline,
           f"baseline={baseline} card={card}")
    ev("document.getElementById('heightCardCancel').click()")
    time.sleep(0.6)
    # Cancel reopens quick settings; close it.
    ev("document.getElementById('setupButton').click()")
    time.sleep(0.5)
    restored = ev(GEOM)
    record("cancel closes the card and restores the layout",
           bool(restored) and restored.get("handleHidden") and not restored.get("editing"),
           str(restored))

    if initial_accel in ("0", "1"):
        d.shell(f"settings put system accelerometer_rotation {initial_accel}")

    failures = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n Suite: {len(RESULTS) - len(failures)}/{len(RESULTS)} passed", flush=True)
    if failures:
        print("failures: " + " | ".join(failures), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
