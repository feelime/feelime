#!/usr/bin/env python3
"""Device gates (caps isolation / flick / ink centering / variants / settings).

Covers the batch's own acceptance points that the legacy suites do not:
#1 caps isolation, #2 Chinese flick commits, #3 fullwidth punct ink centering,
#5 full mic glyph, #7 caps icon, #8 toggle sub label, #9 variant column
survival, #10 collapse button ring, #11 ziranma map, #12 pair editor,
#13 symbol layer redesign.
"""
import os
import sys
import time

import device_verify as d
from PIL import Image

OUT = os.environ.get('FEELIME_B10_OUT', '/tmp/feelime-b10')
os.makedirs(OUT, exist_ok=True)

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def shot(name, serial=None):
    d.shell("screencap -p /sdcard/b10.png")
    import subprocess
    serial = serial or d.SERIAL
    subprocess.run(["adb", "-s", serial, "pull", "/sdcard/b10.png", f"{OUT}/{name}.png"],
                   capture_output=True)


def clear(kb):
    d.clear_field(kb)
    time.sleep(0.2)


def ink_center_offset(kb, key):
    """Horizontal offset (physical px) of the MAIN glyph ink centre vs the
    key centre. Rows are limited to the below-centre band so the top-left
    alt preview cannot pollute the measurement."""
    path = f"{OUT}/b10-ink.png"
    d.screenshot(path)
    im = Image.open(path).convert('RGB')
    cx, cy = kb[key]
    r = 60
    px = im.load()
    y0 = int(cy + 0.04 * r)
    y1 = int(cy + 0.55 * r)
    xs = []
    for y in range(y0, y1):
        for x in range(int(cx - r), int(cx + r)):
            c = px[x, y]
            if sum(c) < 330:  # theme-text ink on light key surface
                xs.append(x)
    if not xs:
        return None
    return (min(xs) + max(xs)) / 2 - cx


def main():
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit('keyboard geometry unavailable')
    d.reset_shift(kb)
    d.devtools_click_mode("英文 Direct")
    time.sleep(1.2)
    kb = d.fresh_kb(refocus=False) or kb

    # ---- #5 mic glyph on the space key (full mic: head + arc/stem/base) ----
    mic = ev("(() => { const p = document.querySelector('#spaceKey .space-mic path');"
             " return p ? p.getAttribute('d') : null; })()")
    record("space mic glyph is the full microphone",
           isinstance(mic, str) and 'M19 12' in mic and 'V23' in mic, repr(mic)[:60] if mic else mic)

    # ---- #7 caps icon swap on long-press lock ----
    clear(kb)
    d.press_hold(kb, "<shift>", 0.6)
    d.press(kb, "o", 0.3)
    caps_state = ev("(() => { const s = document.querySelector('[data-role=shift]');"
                    " return { locked: s.classList.contains('locked'),"
                    " d: s.querySelector('svg path').getAttribute('d') }; })()") or {}
    record("caps lock shows arrow+bar glyph",
           caps_state.get('locked') is True and isinstance(caps_state.get('d'), str)
           and caps_state.get('d', '').endswith('h10v2H7z'),
           repr(caps_state.get('d', ''))[-30:])
    text = d.field_text_retry()
    record("caps typing still uppercases", text == "O", repr(text))
    d.reset_shift(kb)
    clear(kb)

    # ---- #1 caps must not survive a keyboard switch ----
    d.press_hold(kb, "<shift>", 0.6)  # caps on
    d.devtools_click_mode("双拼")
    time.sleep(1.5)
    kb = d.fresh_kb(refocus=False) or kb
    clear(kb)
    typed = d.type_word_verified(kb, "nihk", r"nihk")
    preedit = d.devtools_preedit().replace(" ", "")
    # case SENSITIVE: any uppercase in the echo means the caps state leaked
    record("caps does not leak into double pinyin",
           typed and preedit == "nihk" and preedit == preedit.lower(), repr(preedit))
    d.devtools_click_mode("英文 Direct")
    time.sleep(1.5)
    kb = d.fresh_kb(refocus=False) or kb
    clear(kb)
    d.type_word(kb, "ok", wait=0.3)
    text = d.field_text_retry()
    record("caps cleared by the keyboard switch", text == "ok", repr(text))
    clear(kb)

    # ---- #2 Chinese-mode flicks commit digits/uppercase ----
    d.devtools_click_mode("双拼")
    time.sleep(1.5)
    kb = d.fresh_kb(refocus=False) or kb
    clear(kb)
    d.reset_shift(kb)
    ex, ey = kb['e']
    d.synth_swipe(ex, ey, ex, ey - 160)
    time.sleep(0.4)
    text = d.field_text_retry()
    # Flick DIGITS stay half-width (symbols go full-width).
    record("double-pinyin flick-up commits alt digit", text == "3", repr(text))
    clear(kb)
    d.synth_swipe(ex, ey, ex, ey + 160)
    time.sleep(0.4)
    text = d.field_text_retry()
    record("double-pinyin flick-down commits uppercase", text == "E", repr(text))
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(1.5)
    kb = d.fresh_kb(refocus=False) or kb
    clear(kb)
    d.synth_swipe(ex, ey, ex, ey - 160)
    time.sleep(0.4)
    text = d.field_text_retry()
    record("pinyin flick-up commits alt digit", text == "3", repr(text))
    clear(kb)

    # ---- #3 fullwidth punct ink centering ----
    kb = d.fresh_kb(refocus=False) or kb
    off = ink_center_offset(kb, '.')
    # The slot's main glyph swapped to ，(alt is 。) - the
    # ink-centering measurement is glyph-agnostic.
    record("fullwidth ， ink visually centered",
           off is not None and abs(off) <= 12, f"ink offset {off} px")

    # ---- #8 toggle sub label present in every mode ----
    labels = {}
    for mode in ("英文 Direct", "Français", "Русский", "日本語 Romaji", "全拼 Pinyin", "双拼"):
        d.devtools_click_mode(mode)
        time.sleep(1.2)
        labels[mode] = ev(
            "(() => { const t = document.getElementById('modeToggle');"
            " return t.querySelector('.cn-main').textContent + '/' +"
            " t.querySelector('.cn-sub').textContent; })()")
    ok8 = all(isinstance(v, str) and '/' in v and len(v.split('/')[1]) > 0
              for v in labels.values())
    record("toggle always shows current + target shorthand", ok8, repr(labels))
    d.devtools_click_mode("双拼")
    time.sleep(1.2)
    kb = d.fresh_kb(refocus=False) or kb

    # ---- #9 variant column survives switching to a variant ----
    clear(kb)

    def type_xan():
        """Type x + sep + an and wait for the composition to read x'an.
        In full-suite runs the sep press occasionally lands while the
        editor bridge is still draining the clear burst; recovery = wipe
        the composition and retype (patching with extra seps cannot undo
        a misplaced separator)."""
        for _ in range(3):
            d.press(kb, 'x', 0.2)
            d.press(kb, '<shift>', 0.25)
            for ch in 'an':
                d.press(kb, ch, 0.2)
            for _ in range(6):
                if (d.devtools_preedit() or '').replace(' ', '') == "x'an":
                    return True
                time.sleep(0.4)
            d.press(kb, '<backspace>', 0.2)
            d.press(kb, '<backspace>', 0.2)
            d.press(kb, '<backspace>', 0.2)
            time.sleep(0.5)
        return False

    assert type_xan(), "composition never reached x'an"
    time.sleep(0.6)
    ev("(() => { document.getElementById('composeExpand').click(); return 1; })()")
    time.sleep(1.2)
    v0 = ev("[...document.querySelectorAll('#expandVariants .expand-variant')]"
            ".map(e => e.textContent)") or []
    clicked = ev("(() => { const v = [...document.querySelectorAll('#expandVariants .expand-variant')]"
                 ".find(e => e.textContent === \"xc'an\");"
                 " if (!v) return 'missing'; v.click(); return 'clicked'; })()")
    time.sleep(1.5)
    v1 = ev("[...document.querySelectorAll('#expandVariants .expand-variant')]"
            ".map(e => e.textContent)") or []
    grid = ev("document.querySelectorAll('#expandGrid .expand-candidate').length")
    record("variant column survives a variant switch",
           clicked == 'clicked' and len(v0) >= 3 and len(v1) >= 3
           and any(v == "xi'an" for v in v1) and (grid or 0) > 0,
           f"before={len(v0)} after={len(v1)} grid={grid}")
    ev("(() => { document.getElementById('expandCollapse')?.click(); return 1; })()")
    time.sleep(0.4)
    clear(kb)

    # ---- #10 collapse button has no UA border ring ----
    ring = ev("(() => { const b = document.getElementById('expandCollapse');"
              " return getComputedStyle(b).borderStyle; })()")
    record("collapse button border removed", ring in ('none', None, ''), repr(ring))

    # ---- #11 schema entry moved to the settings app (schemes joined) ----
    ev("(() => { window.Feelime.toggleSettingsPanel(); return 1; })()")
    time.sleep(0.5)
    schema_labels = ev("[...document.querySelectorAll('#settingsPanel .set-label')]"
                       ".map(b => b.textContent)") or []
    record("quick panel carries no schema entry any more",
           all('双拼键位' not in t and 'Pinyin key map' not in t for t in schema_labels),
           f"labels={schema_labels}")
    ev("(() => { window.Feelime.closeSettingsPanel(); return 1; })()")
    time.sleep(0.4)

    # ---- #12 pair editor: rows, tick, order save ----
    ev("(() => { const tile = [...document.querySelectorAll('#settingsPanel .qs-tile')]"
       ".find(t => ['快捷切换', 'Quick switch'].includes(t.querySelector('.qs-name')?.textContent.trim()));"
       " tile?.click(); return 1; })()")
    time.sleep(0.4)
    rows = ev("[...document.querySelectorAll('#pairEditor .pair-row')]"
              ".map(r => r.dataset.mode)") or []
    ticked = ev("[...document.querySelectorAll('#pairEditor .pair-tick.on')].length")
    # 手写（issue #28）起配对编辑器列全部 9 个键盘（手写也是可配对键盘，
    # round-5 快捷切换 手写↔上个键盘）。旧断言 7 个是手写分支之前的口径。
    record("pair editor lists all keyboards with two ticks",
           len(rows) == 9 and ticked == 2, f"rows={rows} ticks={ticked}")
    shot('b10-pair-editor')
    ev("(() => { window.Feelime.closeSettingsPanel(); return 1; })()")
    time.sleep(0.3)
    # The long-press menu must follow the saved drag order: inject an order
    # (a real drag is covered by the mock), reopen the menu, compare.
    ev("(() => { localStorage.setItem('feelime_mode_order', JSON.stringify("
       "['japanese', 'pinyin', 'direct', 'french', 'russian', 'double-pinyin']));"
       " window.Feelime.toggleModeMenu(); return 1; })()")
    time.sleep(0.5)
    menu_titles = ev("[...document.getElementById('modeMenu').children]"
                     ".map(b => b.querySelectorAll('span')[1].textContent)") or []
    ev("(() => { window.Feelime.closeModeMenu();"
       " localStorage.removeItem('feelime_mode_order'); return 1; })()")
    # 手写分支后：opt_in_menu_modes 勾了 8 个非手写键盘，注入 6 个拖拽序
    # 后补 t9+stroke 共 8 项（旧口径 7 = 手写进 MODES 之前）。
    record("menu follows the saved drag order",
           menu_titles[:2] in (['日本語 Romaji', '全拼 Pinyin'], ['Japanese', 'Pinyin'])
           and len(menu_titles) == 8
           and menu_titles[-1] in ('九宫格 T9', 'T9', 'Stroke', '笔画 Stroke'),
           f"menu={menu_titles}")

    # ---- #13 symbol layer redesign ----
    clear(kb)
    d.press(kb, "<123>", 0.5)
    time.sleep(0.5)
    sym = ev("(() => { const g = document.getElementById('symGrid');"
             " const rows = [...g.children].map(r => [...r.children].map(c => c.textContent).join(''));"
             " return { rows, bs: g.children[2]?.children[9]?.dataset.role,"
             " abc: !!document.querySelector('#symCatBar [data-action=letters]'),"
             " enter: document.getElementById('symEnterKey')?.textContent,"
             " cats: [...document.querySelectorAll('[data-sym-cat]')].map(c => c.dataset.symCat).join(',') }; })()") or {}
    rows = sym.get('rows') or []
    record("symbol layer: digits row, del key, ABC + enter row",
           rows and rows[0] == '1234567890'
           and sym.get('bs') == 'backspace'
           and sym.get('abc') is True and sym.get('enter') in ('换行', 'Enter')
           and 'cn,' not in (sym.get('cats') or '') and ',en' not in (sym.get('cats') or ''),
           repr(sym)[:220])
    # halfwidth default in Direct
    d.devtools_click_mode("英文 Direct")
    time.sleep(1.2)
    d.press(kb, "<123>", 0.5)
    time.sleep(0.4)
    en_row2 = ev("[...document.getElementById('symGrid').children[1].children]"
                 ".map(c => c.textContent).join('')")
    record("symbol defaults follow the keyboard mode",
           en_row2 == '-/:;()&@+=', repr(en_row2))
    mask = ev("(() => { const s = document.getElementById('symCats');"
              " return getComputedStyle(s).maskImage || getComputedStyle(s).webkitMaskImage || 'none'; })()")
    record("category strip shows a scroll affordance", isinstance(mask, str) and mask != 'none',
           repr(mask)[:60])
    # ABC returns to letters
    ev("(() => { document.querySelector('#symCatBar [data-action=letters]').click(); return 1; })()")
    time.sleep(0.4)
    back = ev("!document.getElementById('qwertyLayer').hidden")
    record("ABC returns to the letter keyboard", back is True, repr(back))
    d._restore_letters()
    clear(kb)
    d.devtools_click_mode("双拼")
    time.sleep(1.2)

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
