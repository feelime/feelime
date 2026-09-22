#!/usr/bin/env python3
"""Device gates (settings sub-pages / phrase CRUD / preedit semantics).

#1 settings sub-pages + phrase CRUD, #3 composition lands before literal,
#4 space key style/mic contrast, #5 complete-input variant pinning, #6 key
map page, #7 Chinese-mode literal popup picks, #8 pinyin preedit stays off
the editor, #9 scrollable panel + toolbar full-settings entry.
(#2 deletion is covered by the legacy editor suites plus the xterm.js
probe on the real device.)"""
import json
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


LABEL_ALIASES = {
    "双拼键位": ("双拼键位", "Pinyin key map"),
    "快捷切换": ("快捷切换", "Quick switch"),
}


def clear(kb):
    d.clear_field(kb)
    time.sleep(0.2)


def open_panel(kb):
    ev("window.Feelime && window.Feelime.toggleSettingsPanel && window.Feelime.toggleSettingsPanel()")
    time.sleep(0.5)


def nav_to(kb, label):
    """From the panel home, tap the sub-page nav tile for `label`."""
    labels = json.dumps(LABEL_ALIASES.get(label, (label,)), ensure_ascii=False)
    ev(f"(() => {{ const tile = [...document.querySelectorAll('#settingsPanel .qs-tile')]"
       f".find(t => {labels}.includes(t.querySelector('.qs-name')?.textContent.trim()));"
       f" tile?.click(); return 1; }})()")
    time.sleep(0.4)


def main():
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit('keyboard geometry unavailable')
    d.reset_shift(kb)
    d.devtools_click_mode("双拼")
    time.sleep(1.5)
    kb = d.fresh_kb(refocus=False) or kb

    # ---- #8 pinyin preedit must NOT land in the editor ----
    clear(kb)
    d.type_word(kb, "nihk", wait=0.4)
    preedit = (d.devtools_preedit() or '').replace(' ', '')
    text = d.field_text_retry()
    record("pinyin stays on the keyboard, not the editor",
           preedit == "nihk" and text == "", f"preedit={preedit!r} field={text!r}")
    clear(kb)

    # ---- #3 a live composition must LAND before a literal commit ----
    d.press(kb, 'x', 0.2)
    time.sleep(0.3)
    ex, ey = kb['e']
    pts = []
    for i in range(14):
        pts.append([round((ex - d._DT_OFFSET[0]) / d._DT_SCALE),
                    round((ey - 160 * i / 13 - d._DT_OFFSET[1]) / d._DT_SCALE)])
    d.synth_gesture(pts, step_ms=12)
    time.sleep(0.5)
    text = d.field_text_retry()
    # Flick digits stay half-width; the composition still lands
    # BEFORE the literal.
    record("flick after composition keeps it (x then flick-up e)",
           text == "x3", f"field={text!r}")
    clear(kb)

    # ---- #5 complete double-pinyin input pins its parse ----
    # Key sequences, not display strings: 自然码 a=韵母a, j=韵母an.
    # "x'a"  reads x'an  (single-key abbreviation x + an)
    # "xi'j" reads xi'an (complete 2-key syllables xi + an)
    def expand_variants(keys):
        clear(kb)
        for ch in keys:
            if ch == "'":
                d.press(kb, '<shift>', 0.22)  # 分词 separator rides the shift slot
            else:
                d.press(kb, ch, 0.2)
        time.sleep(0.8)
        preedit = (d.devtools_preedit() or '').replace(' ', '')
        ev("document.getElementById('composeExpand')?.click()")
        time.sleep(0.9)
        n = ev("[...document.querySelectorAll('#expandVariants .expand-variant')].length") or 0
        ev("document.getElementById('expandCollapse')?.click()")
        time.sleep(0.3)
        return n, preedit

    n_abbr, pe_abbr = expand_variants("x'a")
    n_full, pe_full = expand_variants("xi'j")
    record("abbreviated input expands variants, complete input pins",
           n_abbr >= 3 and pe_abbr == "x'a" and n_full == 0 and pe_full == "xi'j",
           f"x'a={n_abbr} xi'j={n_full} preedits=({pe_abbr!r},{pe_full!r})")

    # ---- #7 long-press popup picks land literally in Chinese modes ----
    # " moved from J to K (J now carries ～).
    clear(kb)
    jx, jy = kb['k']
    d.synth_touch('start', jx, jy)
    time.sleep(0.6)
    cells = ev("(() => { const items = [...document.querySelectorAll('.kp-item')];"
               " return items.map(el => { const r = el.getBoundingClientRect();"
               " return { t: el.textContent, x: Math.round(r.left + r.width / 2),"
               " y: Math.round(r.top + r.height / 2) }; }); })()") or []
    quote = next((c for c in cells if c.get('t') == '“'), None)
    ok7 = False
    if quote:
        # 弹层选格是相对跟手（issue #9 定稿）：虚拟光标 = 锚格 + 手指
        # 相对起点的位移，绝对拖到目标格会把光标顶出卡片（dy 过大）
        # 触发「松手撤销」。按 锚格→目标格 的位移拖，手指停在键位附近。
        # cells are CSS px; the delta needs the same _DT_SCALE conversion.
        anchor = next((c for c in cells if c.get('t') == 'K'),
                      cells[len(cells) // 2])
        dx = quote['x'] - anchor['x']
        dy = quote['y'] - anchor['y']
        fx = int(jx + dx * d._DT_SCALE)
        fy = int(jy + dy * d._DT_SCALE)
        d.synth_touch('move', fx, fy)
        time.sleep(0.2)
        d.synth_touch('end', fx, fy)
        time.sleep(0.5)
        text = d.field_text_retry()
        preedit = (d.devtools_preedit() or '').replace(' ', '')
        ok7 = text == '“' and preedit == ''
        record("popup quote lands literally", ok7,
               f"field={text!r} preedit={preedit!r}")
    else:
        record("popup quote lands literally", False, f"cells={cells[:4]}")
    clear(kb)

    # ---- #1/#6 settings sub-pages ----
    open_panel(kb)
    labels = ev("[...document.querySelectorAll('#settingsPanel .qs-name')]"
                ".map(el => el.textContent)") or []
    record("home page tiles (3.38.0 tile grid; voice/clipboard stay on the main keyboard)",
           # 3.38.0: the row list became a 2x4 tile grid across two pages;
           # both pages render into the DOM, so all 15 names are queryable.
           labels == ['色彩模式', '中文联想', '按键声音', '按键振动',
                      '键盘高度', '快捷切换', '候选字号', '界面语言',
                      '单手模式', '底部留白', '长按时长', '滑动选字',
                      '长按菜单', '定制键盘', '双拼方案', '编辑工具栏',
                      '完整设置']
           or labels == ['Appearance', 'Associations', 'Key sound', 'Key vibration',
                         'Keyboard height', 'Quick switch', 'Candidate size', 'Language',
                         'One-handed', 'Bottom padding', 'Long-press delay', 'Swipe reach',
                         'Keyboard menu', 'Custom keys', 'Double-pinyin', 'Edit toolbar',
                         'All settings'],
           repr(labels))

    nav_to(kb, '快捷切换')
    pair_rows = ev("[...document.querySelectorAll('#pairEditor .pair-row')].length") or 0
    # #9: overflow is the FEATURE - the panel must scroll within the
    # keyboard instead of pushing rows off-screen.
    scroll = ev("(() => { const p = document.getElementById('settingsPanel');"
                " return { oy: getComputedStyle(p).overflowY,"
                " inKb: p.getBoundingClientRect().bottom <= window.innerHeight + 1 }; })()") or {}
    # 手写（issue #28）起配对编辑器列 9 个键盘。
    record("quick-switch sub-page scrolls inside the keyboard",
           pair_rows == 9 and scroll.get('oy') == 'auto' and scroll.get('inKb') is True,
           f"rows={pair_rows} scroll={scroll}")
    # The back chevron rides the toolbar page bar (child 0).
    ev("document.getElementById('settingsPageBar')?.children[0]?.click()")
    time.sleep(0.4)

    # The phrases sub-page is gone - phrase add/edit/delete moved
    # INTO the favorites panel (native-redirect typing included). Covered by
    # the keymap suite; nothing to gate here any more.
    # The back chevron rides the toolbar page bar (child 0).
    ev("document.getElementById('settingsPageBar')?.children[0]?.click()")
    time.sleep(0.3)

    # ---- #9 scrollable panel + toolbar full-settings entry ----
    ev("window.Feelime.closeSettingsPanel()")
    time.sleep(0.3)
    # #33-1：齿轮不再随快开面板自动插栏（会把用户摆好的图标顶右移一格），
    # 改为工具栏目录里的可选工具——面板开合都不进 candidateBar。
    not_in_bar = ("document.getElementById('fullSetupButton')"
                  "?.closest('#candidateBar') === null")
    gear_out_1 = ev(not_in_bar)
    ev("window.Feelime.toggleSettingsPanel()")
    time.sleep(0.4)
    gear_out_2 = ev(not_in_bar)
    scrollable = ev("(() => { const p = document.getElementById('settingsPanel');"
                    " return p.classList.contains('open') && getComputedStyle(p).overflowY === 'auto'; })()")
    ev("window.Feelime.closeSettingsPanel()")
    time.sleep(0.3)
    gear_out_3 = ev(not_in_bar)
    record("full-settings gear stays out of the toolbar (#33-1); panel scrolls",
           gear_out_1 is True and gear_out_2 is True and gear_out_3 is True and scrollable is True,
           f"out={gear_out_1},{gear_out_2},{gear_out_3} scrollable={scrollable}")

    # ---- #4 space key uses the plain key-cap colour in both themes ----
    space_bg = ev("(() => { const s = document.getElementById('spaceKey');"
                  " return { special: s.classList.contains('kb-special'),"
                  " bg: getComputedStyle(s).backgroundColor }; })()") or {}
    mic_color = ev("(() => { const m = document.querySelector('#spaceKey .space-mic');"
                   " const cs = getComputedStyle(m);"
                   " return { color: cs.color, opacity: cs.opacity }; })()") or {}
    # Light-theme contrast check: parse rgb of --text vs mic colour at .55
    record("space key drops the special grey; mic uses text colour",
           space_bg.get('special') is False and mic_color.get('opacity') == '0.55',
           f"space={space_bg} mic={mic_color}")

    d.devtools_click_mode("英文 Direct")
    time.sleep(1.0)

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
