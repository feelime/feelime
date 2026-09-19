#!/usr/bin/env python3
"""Device gates (shared candidate pool / fullwidth flick / phrase editor / row menu).

#1 collapsed bar keeps the pool head after a deep expand+collapse,
#2 bar shows more than one native page (swipeable pool), #3 sentence-key alt
centers, #4 Chinese flicks land full-width, #5 symbol glyphs read big,
#6 phrase editor strip over the keyboard, #7 row ⋯ menu (pin/edit/delete)."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d

RESULTS = []
PHRASE_MENU_LABELS = (
    ("置顶", "编辑", "删除"),
    ("Pin to top", "Edit", "Delete"),
)


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def main():
    # Follow-up: this suite asserts ABSOLUTE geometry (#5 the
    # default 44px row / 20px glyph). A height pref left by an earlier
    # height-drag suite (it writes 240 and restores only when the
    # readback cooperates) shrinks every row and fakes a regression - start
    # from the stock height. Reset BEFORE prepare() so the IME (re)starts
    # with the stock prefs and DevTools binds to the fresh WebView.
    d.shell(f"run-as {d.PKG} sh -c "
            "'rm -f shared_prefs/feelime_keyboard.xml'")
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(1.2)
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit('keyboard geometry unavailable')
    d.reset_shift(kb)
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(1.2)
    kb = d.fresh_kb(refocus=False) or kb

    # ---- #1 + #2 the bar shares the pool: full body, head survives collapse ----
    d.clear_field(kb)
    for ch in "jisuanji":
        d.press(kb, ch, 0.12)
    time.sleep(0.8)
    # force a few page loads through the expanded grid
    ev("document.getElementById('composeExpand').click()")
    time.sleep(0.6)
    for _ in range(5):
        ev("(() => { const g = document.getElementById('expandGrid');"
           " g.scrollTop = g.scrollHeight; g.dispatchEvent(new Event('scroll')); return 1; })()")
        time.sleep(0.5)
    pool = ev("[...document.querySelectorAll('#expandGrid .expand-candidate')].map(e => e.textContent)")
    ev("document.getElementById('expandCollapse').click()")
    time.sleep(0.5)
    bar = ev("[...document.querySelectorAll('#candidates .candidate')].map(e => e.textContent)") or []
    head_ok = bool(bar) and bool(pool) and bar[0] == pool[0]
    record("bar keeps the pool head after deep expand+collapse",
           head_ok and len(bar) >= len(pool),
           f"bar={len(bar)} grid={len(pool)} head=({(pool or [''])[0]!r},{(bar or [''])[0]!r})")
    record("bar renders more than one native page",
           len(bar) > 5, f"bar={len(bar)}")
    d.clear_field(kb)

    # ---- #3 sentence-key alt centers across the key width ----
    alt = ev("(() => { const key = document.querySelector('[data-key=\".\"]');"
             " const a = key.querySelector('.kb-alt'); const k = key.getBoundingClientRect();"
             " const r = a.getBoundingClientRect();"
             " return { cs: getComputedStyle(a).textAlign,"
             "          off: Math.round((r.left + r.width / 2) - (k.left + k.width / 2)) }; })()") or {}
    record("sentence-key alt centers on the key", alt.get("cs") == "center"
           and abs(alt.get("off", 99)) <= 5, f"alt={alt}")

    # ---- #4 Chinese flicks land full-width ----
    d.devtools_click_mode("双拼")
    time.sleep(1.0)
    kb = d.fresh_kb(refocus=False) or kb
    d.clear_field(kb)
    # Flick commits bypass the engine (no composing), so the full-width glyph
    # lands straight in the host editor - read it back from there (wrapping
    # the FeelimeNative bridge object from JS is a silent no-op).
    ex, ey = kb['q']
    pts = [[round((ex - d._DT_OFFSET[0]) / d._DT_SCALE),
            round((ey - 160 * i / 13 - d._DT_OFFSET[1]) / d._DT_SCALE)] for i in range(14)]
    d.synth_gesture(pts, step_ms=12)
    time.sleep(0.6)
    text = d.field_text_retry()
    # Digits stay half-width on Chinese flicks.
    record("double-pinyin flick-up digit stays half-width",
           text == "1", f"field={text!r}")
    d.clear_field(kb)
    # The user's re-pinned row - g up-flick is （ and
    # h up-flick is ）(the tilde moved to J); digits stay half-width.
    gx, gy = kb['g']
    pts = [[round((gx - d._DT_OFFSET[0]) / d._DT_SCALE),
            round((gy - 160 * i / 13 - d._DT_OFFSET[1]) / d._DT_SCALE)] for i in range(14)]
    d.synth_gesture(pts, step_ms=12)
    time.sleep(0.6)
    text = d.field_text_retry()
    record("double-pinyin flick-up bracket lands full-width",
           text == "（", f"field={text!r}")
    d.clear_field(kb)
    hx, hy = kb['h']
    pts = [[round((hx - d._DT_OFFSET[0]) / d._DT_SCALE),
            round((hy - 160 * i / 13 - d._DT_OFFSET[1]) / d._DT_SCALE)] for i in range(14)]
    d.synth_gesture(pts, step_ms=12)
    time.sleep(0.6)
    text = d.field_text_retry()
    record("double-pinyin flick-up closing bracket lands as printed",
           text == "）", f"field={text!r}")
    d.clear_field(kb)

    # ---- #5 symbol glyphs read big ----
    ev("(() => { document.getElementById('symbols')?.click(); return 1; })()")
    time.sleep(0.5)
    sym = ev("(() => { const cell = document.querySelector('#symGrid .sym-single');"
             " return cell ? { fs: getComputedStyle(cell).fontSize,"
             "                 n: document.querySelectorAll('#symGrid .sym-single').length } : null; })()") or {}
    record("symbol single glyphs render at 20px", sym.get("fs") == "20px"
           and (sym.get("n") or 0) >= 20, f"sym={sym}")
    ev("(() => { document.querySelector('[data-action=\"letters\"]')?.click(); return 1; })()")
    time.sleep(0.3)

    # ---- #6 phrase editor strip over the keyboard (En mode for ASCII typing) ----
    d.devtools_click_mode("英文 Direct")
    time.sleep(1.0)
    kb = d.fresh_kb(refocus=False) or kb
    ev("(() => { document.getElementById('favoritesButton').click(); return 1; })()")
    time.sleep(0.6)
    ev("document.getElementById('panelManage').click()")
    time.sleep(0.4)
    # design §3.4: the editor is the floating phrase card above the
    # keyboard (phraseCard); the panel hides, the keys and the bar stay.
    strip = ev("(() => ({ card: document.getElementById('phraseCard').classList.contains('open'),"
               " panel: document.getElementById('panelLayer').hidden,"
               " qwerty: !document.getElementById('qwertyLayer').hidden,"
               " bar: !document.getElementById('candidateBar').hidden,"
               " above: document.getElementById('phraseCard').getBoundingClientRect().bottom"
               "       <= document.getElementById('candidateBar').getBoundingClientRect().top + 1 }))()") or {}
    record("＋添加 shows the phrase card ABOVE the candidate bar (bar stays)",
           strip.get("card") is True and strip.get("panel") is True
           and strip.get("qwerty") is True and strip.get("bar") is True and strip.get("above") is True,
           f"strip={strip}")
    box = ev("(() => { const r = document.getElementById('phraseCardInput')"
             ".getBoundingClientRect();"
             " return { x: Math.round(r.left + r.width / 2),"
             "          y: Math.round(r.top + r.height / 2) }; })()") or {}
    if box:
        d.tap(box["x"] * d._DT_SCALE + d._DT_OFFSET[0],
              box["y"] * d._DT_SCALE + d._DT_OFFSET[1], wait=0.8)
    d.type_word(kb, "ok", wait=0.25)
    time.sleep(0.4)
    value = ev("document.getElementById('phraseCardInput').value")
    ev("document.getElementById('phraseCardSave').click()")
    time.sleep(0.9)
    texts = ev("[...document.querySelectorAll('#panelList .panel-item')]"
               ".map(r => r.querySelector('.panel-text').textContent)") or []
    record("typing over the keyboard lands in the strip; save persists",
           value == "ok" and any(t == "ok" for t in texts),
           f"value={value!r} rows={texts}")

    # ---- #7 row ⋯ menu: edit prefills, pin moves, delete removes ----
    ev("(() => { const row = [...document.querySelectorAll('.panel-item')]"
       ".find(r => r.querySelector('.panel-text')?.textContent === 'ok');"
       " row.querySelector('.panel-more').click(); return 1; })()")
    time.sleep(0.4)
    menu = ev("(() => { const m = document.getElementById('itemMenu');"
              " return { open: m.classList.contains('open'),"
              "          labels: [...m.querySelectorAll('button')].map(b => b.textContent) }; })()") or {}
    record("⋯ opens the pin/edit/delete menu",
           menu.get("open") is True
           and tuple(menu.get("labels") or ()) in PHRASE_MENU_LABELS,
           f"menu={menu}")
    ev("(() => { [...document.getElementById('itemMenu').querySelectorAll('button')]"
       ".find(b => b.textContent === '编辑' || b.textContent === 'Edit').click(); return 1; })()")
    time.sleep(0.4)
    # design §3.4: row 编辑 opens the floating phrase card, not the strip.
    prefilled = ev("document.getElementById('phraseCardInput').value")
    ev("(() => { const i = document.getElementById('phraseCardInput'); i.value = 'ok2'; return 1; })()")
    ev("document.getElementById('phraseCardSave').click()")
    time.sleep(0.9)
    texts2 = ev("[...document.querySelectorAll('#panelList .panel-item')]"
                ".map(r => r.querySelector('.panel-text').textContent)") or []
    record("menu edit prefills and saves",
           prefilled == "ok" and any(t == "ok2" for t in texts2), f"rows={texts2}")
    ev("(() => { const row = [...document.querySelectorAll('.panel-item')]"
       ".find(r => r.querySelector('.panel-text')?.textContent === 'ok2');"
       " row.querySelector('.panel-more').click(); return 1; })()")
    time.sleep(0.3)
    ev("(() => { [...document.getElementById('itemMenu').querySelectorAll('button')]"
       ".find(b => b.textContent === '删除' || b.textContent === 'Delete').click(); return 1; })()")
    time.sleep(0.9)
    texts3 = ev("[...document.querySelectorAll('#panelList .panel-item')]"
                ".map(r => r.querySelector('.panel-text').textContent)") or []
    record("menu delete removes in one tap",
           all(t != "ok2" for t in texts3), f"rows={texts3}")
    ev("document.getElementById('panelClose').click()")
    time.sleep(0.4)

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== candidate-pool device suite: "
          f"{len(RESULTS) - len(failed)} passed, {len(failed)} failed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
