#!/usr/bin/env python3
"""Extended device assertions for previously unexecuted language/UI cases."""
import sys
import time

import device_verify as d


RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def clear(kb):
    # The expanded layer is modal: physical key coordinates land on it, so a
    # stale expand state would silently swallow every later keypress. Collapse
    # it (and give the engine a beat) before any system-level field wipe.
    if d.devtools_eval("!document.getElementById('expandLayer').hidden") is True:
        d.devtools_eval(
            "(() => { document.getElementById('expandCollapse')?.click(); return true; })()")
        time.sleep(0.4)
    # The host-injected Ctrl+A/Del can be eaten while the WebView
    # owns the key events; drain through the IME bridge first (clearComposing
    # + backspace cascade), then mop with select-all/delete and verify.
    d.devtools_eval("window.Feelime && window.Feelime.clearEditor && window.Feelime.clearEditor()")
    time.sleep(0.5)
    d.clear_field(kb)
    time.sleep(0.3)
    remaining = d.field_text_retry()
    if remaining not in (None, ""):
        raise RuntimeError(f"test field did not clear: {remaining!r}")


def switch(kb, mode):
    d.switch_mode(kb, mode)
    return d.fresh_kb(refocus=False) or kb


def dom_center(selector, kb):
    center = d.devtools_eval(
        "(() => { const e=document.querySelector(" + repr(selector) + ");"
        " if(!e)return null; const r=e.getBoundingClientRect();"
        " return [r.left+r.width/2,r.top+r.height/2]; })()"
    )
    if not center:
        return None
    ox, oy = d._DT_OFFSET
    scale = kb["<density>"]
    return center[0] * scale + ox, center[1] * scale + oy


def tap_dom(selector, kb):
    # Physical taps are unreliable against the keyboard WebView on
    # the fresh AVD - click the node through DevTools instead.
    return d.devtools_eval(
        "(() => { const e = document.querySelector(" + repr(selector) + ");"
        " if (!e) return false; e.click(); return true; })()"
    ) is True


def ensure_fixture(kb):
    """Mid-suite focus insurance: the editor fixture can silently lose focus
    (DevTools zombies, IME hidden after long blocks). Same contract as the
    editor suite's focus_fixture: hide the keyboard BEFORE tapping, or the
    tap lands on the WebView and focus never moves."""
    if d.field_text_retry() is not None:
        return kb
    d.ensure_keyboard_down()
    for _ in range(8):
        bounds = d.field_bounds(d.TEST_INPUT_DESCRIPTION)
        if bounds and bounds[3] > 0 and bounds[1] < 2250:
            d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.2)
            if d.input_shown():
                return d.fresh_kb(refocus=False) or kb
        d.ensure_keyboard_down()
        d.shell("input swipe 80 1900 80 800 300")
        time.sleep(0.5)
    return kb


def popup_hold_window():
    """How long to hold before reading the popup: the long-press timer is
    user-tunable now (feel settings), so the read window follows the LIVE
    holdMs instead of the default 350ms — a device left at 600ms must not
    read the previous case's stale popup DOM."""
    feel = d.devtools_eval(
        "window.Feelime && Feelime.debugState && Feelime.debugState()")
    hold = feel.get("holdMs") if isinstance(feel, dict) else 350
    return max(0.55, (hold or 350) / 1000.0 + 0.25)


def popup_items_and_select(kb, key, selected_text):
    x, y = kb[key]
    if d.synth_touch("start", x, y) != "ok":
        raise RuntimeError("popup start failed - keyboard not up?")
    try:
        time.sleep(popup_hold_window())
        items = d.devtools_eval(
            "[...document.querySelectorAll('#keyPopup .kp-item')].map(e=>e.textContent)"
        ) or []
        selector = f"#keyPopup .kp-item:nth-child({items.index(selected_text) + 1})" if selected_text in items else ""
        if selector == "":
            # Failure forensics: the popup belongs to a different key or never
            # opened. Dump the live layout so the stale-geometry question is
            # answerable from the log.
            forensics = d.devtools_eval(
                "(()=>{const live=k=>{const r=document.querySelector(`[data-key='${k}']`)"
                "?.getBoundingClientRect();return r?[Math.round(r.x),Math.round(r.y)]:null};"
                "const rows=[...document.querySelectorAll('#softKeyboard > *')].map(el=>({id:el.id||el.className,"
                "h:Math.round(el.getBoundingClientRect().height)}));"
                "return JSON.stringify({kbLive:{l:live('l'),e:live('e')},rows,"
                "kbCss:Math.round(document.getElementById('softKeyboard')"
                "?.getBoundingClientRect().height||0),"
                "pad:getComputedStyle(document.getElementById('softKeyboard')).paddingBottom})})()")
            print(f"  [popup-forensics] key={key} want={selected_text!r} items={items} screen=({x},{y})")
            print(f"  [popup-forensics] {forensics}")
            d.screenshot("/tmp/fv-popup-forensics.png")
        target = dom_center(selector, kb) if selector else None
        if target:
            # 3.39.0 相对跟手：手指按「目标格 − 锚点格」的 CSS 位移拖动
            # （拖到可见格会越过虚拟光标的卡片边界，被「松手撤销」吃掉）。
            delta = d.devtools_eval(
                "(() => { const items = [...document.querySelectorAll('#keyPopup .kp-item')];"
                f" const t = items[{items.index(selected_text)}];"
                " const a = document.querySelector('#keyPopup .kp-item.sel');"
                " if (!t || !a) return null;"
                " const rt = t.getBoundingClientRect(), ra = a.getBoundingClientRect();"
                " return [rt.left + rt.width/2 - (ra.left + ra.width/2),"
                " rt.top + rt.height/2 - (ra.top + ra.height/2)]; })()"
            )
            scale = kb.get("<density>") or 2.625
            if delta:
                mx, my = x + delta[0] * scale, y + delta[1] * scale
            else:
                mx, my = target
            d.synth_touch("move", mx, my)
            time.sleep(0.15)
            d.synth_touch("end", mx, my)
        else:
            d.synth_touch("end", x, y)
        return items
    except BaseException:
        d.synth_touch("end", x, y)
        raise


def candidates_after(kb, word):
    clear(kb)
    d.type_word(kb, word, wait=0.2)
    time.sleep(0.8)
    return d.devtools_candidates()


def conv_after(kb, word):
    """Composition then SPACE: Mozc only produces a candidate list once the
    conversion key fires (see device_editor_verify G4 handoff fix)."""
    candidates_after(kb, word)
    d.press(kb, "<space>", 0.7)
    time.sleep(0.8)
    return d.devtools_candidates()


def main():
    d.prepare()
    kb = d.fresh_kb()
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    d.reset_shift(kb)

    # Chinese pinyin: real candidate selection, paging and sentence candidate.
    kb = switch(kb, "全拼 Pinyin")
    candidates = candidates_after(kb, "nihao")
    selected = d.devtools_eval(
        "(() => { const b = document.querySelector('#candidates button.candidate');"
        " if (!b) return false; b.click(); return true; })()"
    )
    time.sleep(0.6)
    text = d.field_text_retry()
    record("C3 candidate click commits 你好", selected and text == "你好", f"candidates={candidates[:6]} text={text!r}")

    before = candidates_after(kb, "shi")
    # The pager buttons are gone - the bar shows the whole
    # accumulated pool and fetches the next page when scrolled near its end.
    pager_gone = d.devtools_eval(
        "!document.getElementById('pageNext') && !document.getElementById('pagePrev')") is True
    pool_len = len(before)
    record(
        "C7 candidate pool accumulates beyond one page (no pager)",
        pager_gone and pool_len >= 6,
        f"pool={before[:6]} len={pool_len} pager_gone={pager_gone}",
    )

    sentence = candidates_after(kb, "jintiandetianqi")
    # Review P3: the engine may split the leading char off the sentence
    # candidate, so match on prefix rather than containment.
    record("C8 sentence candidate", any(
        item.startswith("今天的天气") for item in sentence), repr(sentence[:8]))

    # Double pinyin zero-initial case from the frozen verification plan.
    # The rebuilt prism maps aa->a directly (design §9.3), so the raw echo
    # candidate is gone and a-syllable words lead the list.
    kb = switch(kb, "双拼")
    zero = candidates_after(kb, "aa")
    record(
        "D3 double-pinyin zero initial aa",
        zero[:2] == ["啊", "阿"],
        repr(zero[:8]),
    )

    # Review probes for the simplified-Chinese conversion path.
    # Phrase-level OpenCC dictionary (TSPhrases): 不了解 must win over the
    # character-wise 不瞭解 decomposition.
    d.switch_mode(kb, "全拼 Pinyin")
    time.sleep(0.8)
    phrase = candidates_after(kb, "buliaojie")
    record(
        "C9 phrase t2s bu liao jie",
        phrase[:1] == ["不了解"] or "不了解" in phrase[:4],
        repr(phrase[:8]),
    )
    # Double pinyin after t2s: output must be simplified (發→发, 裏→里), and
    # traditional sources collapsing onto one form must be deduped by the
    # uniquifier. Assert the conversion itself: the first pass flagged a
    # dup-only check as PASS while every candidate was still traditional.
    d.switch_mode(kb, "双拼")
    time.sleep(0.8)
    fa = candidates_after(kb, "fa")
    li = candidates_after(kb, "li")
    trad = set("發髮罰裏裡離麗")
    dup = [c for c in fa if fa.count(c) > 1] + [c for c in li if li.count(c) > 1]
    clean = not (set("".join(fa)) & trad) and not (set("".join(li)) & trad)
    record(
        "D4 double-pinyin t2s simplified and deduped",
        clean and not dup and fa[:1] == ["发"],
        f"fa={fa[:8]} li={li[:8]} dup={sorted(set(dup))}",
    )

    # French popup, apostrophe-in-word and Hunspell correction.
    kb = switch(kb, "Français")
    clear(kb)
    fr_popup = popup_items_and_select(kb, "e", "é")
    time.sleep(0.5)
    text = d.field_text_retry()
    expected_accents = {"3", "é", "É", "è", "È", "ê", "Ê", "ë", "Ë", "E", "e"}
    record("E2 French accent popup and selection", set(fr_popup) == expected_accents and text == "é", f"items={fr_popup} text={text!r}")

    clear(kb)
    d.press(kb, "l", 0.15)
    kx, ky = kb["k"]
    d.synth_swipe(kx, ky, kx, ky - 160)
    d.type_word(kb, "homme", wait=0.15)
    time.sleep(0.6)
    apostrophe = d.devtools_candidates()
    record("E3 French apostrophe stays in word", bool(apostrophe) and apostrophe[0] == "l'homme", repr(apostrophe[:6]))

    french = candidates_after(kb, "bonjor")
    record("E4 Hunspell offers bonjour", "bonjour" in french, repr(french[:8]))

    # A confirmed word lands WITH a trailing space - the JS space key
    # rides the pool-top pick, and Choose now
    # commits word+space, so consecutive words never glue together.
    clear(kb)
    d.type_word(kb, "bonjor", wait=0.15)
    time.sleep(0.6)
    d.press(kb, "<space>", 0.5)
    time.sleep(0.6)
    d.type_word(kb, "monde", wait=0.15)
    time.sleep(0.6)
    d.press(kb, "<space>", 0.5)
    time.sleep(0.6)
    spaced = d.field_text_retry()
    record("E4b picked words land space-separated",
           spaced == "bonjour monde ", f"text={spaced!r}")

    # The first char's accented alts ride the pool right
    # after the engine head; picking one swaps the first character and
    # keeps composing (preedit "ête").
    clear(kb)
    d.type_word(kb, "ete", wait=0.15)
    time.sleep(0.7)
    variant_pool = d.devtools_candidates()
    # The engine head is whatever Hunspell ranks first for "ete" (its
    # corrected "été" on device, the raw echo in the mock) - the gate is
    # that a variant never displaces it.
    head_is_word = bool(variant_pool) and variant_pool[0] != "é" and len(variant_pool[0]) > 1
    record("E4c accent variants join the pool after the engine head",
           head_is_word and all(a in variant_pool[1:6] for a in ("é", "è", "ê", "ë")),
           repr(variant_pool[:7]))
    picked = d.devtools_eval(
        "(() => { const b=[...document.querySelectorAll('#candidates .candidate')]"
        ".find(e => e.textContent === 'ê'); if (!b) return false; b.click(); return true; })()")
    time.sleep(0.8)
    variant_preedit = d.devtools_preedit()
    record("E4d variant pick swaps the first char and keeps composing",
           picked is True and variant_preedit == "ête", f"preedit={variant_preedit!r}")
    clear(kb)

    # Russian ё/Ё, dictionary correction and Shift.
    kb = switch(kb, "Русский")
    clear(kb)
    ru_popup = popup_items_and_select(kb, "е", "ё")
    time.sleep(0.5)
    text = d.field_text_retry()
    record("F2 Russian popup offers ё and Ё", {"ё", "Ё"}.issubset(set(ru_popup)) and text == "ё", f"items={ru_popup} text={text!r}")

    russian = candidates_after(kb, "превет")
    record("F3 Hunspell offers привет", "привет" in russian, repr(russian[:8]))

    clear(kb)
    d.press(kb, "<shift>", 0.25)
    d.press(kb, "п", 0.35)
    time.sleep(0.6)
    # A lone uppercase Cyrillic letter has no dictionary entry: the engine
    # holds it as an uppercase composition (preedit echo), not a conversion.
    shifted_echo = d.devtools_preedit()
    record(
        "F4 Shift uppercases Cyrillic",
        shifted_echo == "П",
        f"preedit={shifted_echo!r} cands={d.devtools_candidates()[:3]}",
    )

    # Japanese n/nn, small kana sequences, and staged backspace.
    kb = switch(kb, "日本語 Romaji")
    konn = conv_after(kb, "konn")
    nna = conv_after(kb, "nna")
    record(
        "G2 Japanese n/nn sequences",
        "コン" in konn[:2] and nna[:1] == ["んな"],
        f"konn={konn[:4]} nna={nna[:4]}",
    )

    conversions = {}
    for raw in ("kitta", "kya", "koukou"):
        conversions[raw] = conv_after(kb, raw)
    record(
        "G3 Japanese sokuon/youon/long vowel",
        "きった" in conversions["kitta"][:2]
        and "きゃ" in conversions["kya"][:2]
        and conversions["koukou"][:1] == ["高校"],
        repr({k: v[:3] for k, v in conversions.items()}),
    )

    # Staged backspace after conversion: deletion deconverts to the raw
    # romaji staging on the preedit line while the candidate row empties.
    conv_after(kb, "kitta")
    stages = []
    for _ in range(4):
        d.press(kb, "<backspace>", 0.4)
        time.sleep(0.45)
        stages.append(d.devtools_preedit())
    record(
        "G5 Japanese staged backspace",
        stages == ["きった", "きっ", "き", ""],
        repr(stages),
    )

    # Device-level mode transition behavior.
    kb = switch(kb, "英文 Direct")
    clear(kb)
    d.type_word(kb, "abc", wait=0.15)
    kb = switch(kb, "Français")
    text = d.field_text_retry()
    record("H2 committed text survives mode switch", text == "abc", repr(text))

    clear(kb)
    kb = switch(kb, "全拼 Pinyin")
    d.type_word(kb, "nihao", wait=0.2)
    time.sleep(0.6)
    kb = switch(kb, "英文 Direct")
    text = d.field_text_retry()
    preedit = d.devtools_preedit()
    # design §5.2: the pinyin preedit lives on the
    # keyboard, not the editor - switching away lands the RAW characters
    # into the editor instead of dropping them with the session.
    record("H3 unconfirmed pinyin lands on mode switch",
           text == "nihao" and preedit == "", f"text={text!r} preedit={preedit!r}")

    # Engine flow: continuous word-building. Picking a SINGLE-char
    # candidate must keep the rest composing (preedit 字ma), and finishing the
    # rest commits exactly once. Candidate texts are discovered dynamically:
    # the scheme-local user dict (C11) reshuffles page one after first use.
    kb = switch(kb, "双拼")
    kb = ensure_fixture(kb)
    clear(kb)
    for ch in "zima":
        d.press(kb, ch, 0.2)
    time.sleep(0.9)

    def choose_candidate(label):
        return d.devtools_eval(
            "(() => { const b=[...document.querySelectorAll('#candidates button.candidate')]"
            ".find(e => e.textContent === '" + label + "');"
            " if(!b) return false; b.click(); return true; })()"
        ) is True

    def first_single_candidate(exclude=(), max_pages=4):
        # A single char, not matched by exact text: page one is reshuffled by
        # the user dict, and after C11 the nihk page one can be ALL two-char
        # words - page forward until a single char shows up.
        skips = "".join(exclude)
        for _ in range(max_pages):
            got = d.devtools_eval(
                "(() => { const b=[...document.querySelectorAll('#candidates .candidate')]"
                ".find(el => el.textContent.length === 1 && !" + repr(skips) + ".includes(el.textContent));"
                " if (!b) return null; b.click(); return b.textContent; })()"
            )
            if isinstance(got, str):
                return got
            if d.devtools_eval("!document.getElementById('pageNext').disabled") is True:
                d.devtools_eval("document.getElementById('pageNext').click(); true")
                time.sleep(0.7)
            else:
                return None
        return None

    page = d.devtools_candidates()[:6]
    singles = [t for t in page if len(t) == 1]
    if not singles and d.devtools_eval("!document.getElementById('pageNext').disabled") is True:
        d.devtools_eval("document.getElementById('pageNext').click(); true")
        time.sleep(0.7)
        page = d.devtools_candidates()[:6]
        singles = [t for t in page if len(t) == 1]
    picked_first = False
    mid_preedit = None
    built_text = None
    picked_second = False
    first = singles[0] if singles else None
    rest = [""]
    if first:
        picked_first = choose_candidate(first)
        time.sleep(0.8)
        mid_preedit = d.devtools_eval("document.getElementById('preeditLine').textContent")
        rest = d.devtools_candidates()[:1]
        if rest:
            picked_second = choose_candidate(rest[0])
            time.sleep(0.9)
            built_text = d.field_text_retry()
    record(
        "C10 continuous word building commits once",
        picked_first and picked_second
        and mid_preedit is not None and mid_preedit.startswith(first)
        and built_text == first + rest[0],
        f"singles={singles} picked={picked_first}/{picked_second} "
        f"mid={mid_preedit!r} text={built_text!r}",
    )
    # C11: a word the user assembled (two single-char picks) must outrank the
    # built-in dictionary on retype. Built twice so its user-dict frequency
    # deterministically beats single-use entries (uninstall wipes userdb, so
    # the word must be built right here - no reliance on earlier sessions).
    def build_user_word():
        clear(kb)
        d.type_word(kb, "nihk", wait=0.2)
        time.sleep(0.8)
        first = first_single_candidate()
        time.sleep(0.8)
        # Skipping 好 keeps the built word out of the built-in dictionary, so
        # the retype rank below can only be explained by the user dict.
        second = first_single_candidate(exclude=("好",))
        time.sleep(0.9)
        return first, second, d.field_text_retry()

    picks = [build_user_word(), build_user_word()]
    built_word = picks[-1][2] if all(p[0] and p[1] for p in picks) else None
    expected = (picks[0][0] + picks[0][1]) if all(
        isinstance(p[0], str) and isinstance(p[1], str) for p in picks) else None
    clear(kb)
    for ch in "nihk":
        d.press(kb, ch, 0.15)
    time.sleep(1.0)
    ranked = d.devtools_candidates()[:5]
    # Top-1 held when the suite ran on a fresh user dict; after many runs the
    # picked-in runs' 你好 outranks it - the gate is "beats the built-in tail",
    # so top-2 with a recorded rank.
    rank = ranked.index(built_word) if built_word in ranked else -1
    record(
        "C11 user word outranks built-in on retype",
        built_word is not None and picks[0][2] == picks[1][2] == expected
        and 0 <= rank <= 1,
        f"picks={picks} ranked={ranked} rank={rank}",
    )

    # 分词 key: Chinese layouts swap Shift for the syllable separator, and
    # bare initials fuzzy-match across syllables (x'an -> 西安/新安...).
    kb = switch(kb, "全拼 Pinyin")
    kb = ensure_fixture(kb)
    clear(kb)
    sep_label = d.devtools_eval(
        "(() => { const b=document.querySelector('[data-role=sep]');"
        " return b ? b.textContent : 'no-sep'; })()"
    )
    for ch in "xi":
        d.press(kb, ch, 0.18)
    time.sleep(0.3)
    d.devtools_eval("(() => { const b=document.querySelector('[data-role=sep]'); if (b) b.click(); return true; })()")
    time.sleep(0.4)
    for ch in "an":
        d.press(kb, ch, 0.18)
    time.sleep(0.8)
    split_cands = d.devtools_candidates()[:5]
    record(
        "C12 分词 splits xi'an into 西安",
        sep_label in ("分词", "Split") and split_cands[:1] == ["西安"],
        f"sep={sep_label!r} cands={split_cands}",
    )
    clear(kb)
    kb = ensure_fixture(kb)
    d.press(kb, "x", 0.18)
    d.devtools_eval("(() => { const b=document.querySelector('[data-role=sep]'); if (b) b.click(); return true; })()")
    time.sleep(0.3)
    for ch in "an":
        d.press(kb, ch, 0.18)
    time.sleep(0.8)
    fuzzy = d.devtools_candidates()[:5]
    record(
        "C13 initial fuzzy match x'an",
        "西安" in fuzzy and len(fuzzy) >= 2,
        repr(fuzzy),
    )

    # Double-pinyin engine semantics (schema: jianpin abbreviations,
    # bare zero-initial spellings, full punctuator).
    kb = switch(kb, "双拼")
    kb = ensure_fixture(kb)
    dp_candidates = candidates_after(kb, "xian")
    record("C14 double-pinyin xian auto-splits into 西安", "西安" in dp_candidates, repr(dp_candidates[:6]))

    clear(kb)
    # x then the 分词 slot (sends ') then an: raw x'an - the exact x|an parse
    # the variant column is built from. (xan+sep would parse xa|n instead.)
    d.press(kb, "x", 0.2)
    d.press(kb, "<shift>", 0.2)  # sep slot: the 分词 key sends '
    for ch in "an":
        d.press(kb, ch, 0.2)
    time.sleep(1.0)
    dp_xsep = d.devtools_candidates()[:6]
    record("C15 double-pinyin x'an aggregates expansions",
           "西安" in dp_xsep and len(dp_xsep) >= 3, repr(dp_xsep))

    # Continuous word building: nihk -> pick the leading single char ->
    # remaining keys keep composing -> pick the next char -> the whole word
    # commits once. The single char is discovered dynamically (page one is
    # reshuffled by the user dict C11 just fed).
    clear(kb)
    d.type_word(kb, "nihk", wait=0.2)
    time.sleep(0.8)
    first_page = d.devtools_candidates()[:8]
    pick_single = first_single_candidate()
    time.sleep(0.8)
    mid_preedit = d.devtools_eval("document.getElementById('preeditLine').textContent")
    mid_candidates = d.devtools_candidates()[:4]
    rest_first = mid_candidates[0] if mid_candidates else None
    pick_second = d.devtools_eval(
        "(() => { const b=document.querySelector('#candidates .candidate');"
        " if (!b) return false; b.click(); return true; })()"
    )
    time.sleep(0.9)
    built = d.field_text_retry()
    record("C17 double-pinyin continuous word building commits once",
           isinstance(pick_single, str) and pick_second and mid_preedit not in (None, "")
           and isinstance(rest_first, str) and built == pick_single + rest_first,
           f"first={first_page} single={pick_single!r} mid={mid_preedit!r}/{mid_candidates} "
           f"expect={(pick_single or '') + (rest_first or '')!r} text={built!r}")

    # Punct slot (swap): tap commits ，and the alt previews 。.
    clear(kb)
    alt_label = d.devtools_eval(
        "document.querySelector(\"[data-key='.'] .kb-alt\")?.textContent")
    d.press(kb, ".", 0.4)
    time.sleep(0.5)
    period_text = d.field_text_retry()
    record("C16 double-pinyin punct tap commits comma with period alt",
           period_text == "，" and alt_label == "。", f"alt={alt_label!r} text={period_text!r}")

    # Space with an empty composition must type a blank (user
    # report: Chinese modes swallowed it - librime has no space binding).
    clear(kb)
    d.press(kb, "<space>", 0.4)
    time.sleep(0.5)
    space_text = d.field_text_retry()
    record("C16b double-pinyin idle space commits a blank",
           space_text == " ", repr(space_text))

    # Long-press popup selects and commits in double pinyin (F1: every
    # non-alphabet key used to be rejected by the missing punctuator).
    clear(kb)
    # L's alt prints/lands the full-width RIGHT double quote
    # (the user's re-pinned second row dropped the single quotes).
    popup = popup_items_and_select(kb, "l", "\u201d")
    time.sleep(0.5)
    apostrophe = d.field_text_retry()
    # Popup picks land LITERALLY in Chinese modes (the user
    # requirement) - the ASCII apostrophe is no longer rerouted through the
    # engine's punctuator into a curly quote.
    record("C18 double-pinyin popup right double quote commits",
           "\u201d" in (popup or []) and apostrophe == "\u201d",
           f"items={popup} text={apostrophe!r}")

    # Symbol layer: bottom category strip  with 11 fixed entries and
    # Japanese/Greek content; row 3 ends with backspace.
    clear(kb)
    # Expects the 定制 (custom) category in the strip - it only
    # renders once a table EXISTS (the mock suite pins the same rule), and a
    # fresh install has none. Seed one through the debug seeding hook and VERIFY the
    # storage write (a silently dead DevTools eval must not fake-pass I5).
    seeded = False
    for _ in range(4):
        d.devtools_eval(
            "window.Feelime && Feelime.saveCustomJson"
            "(JSON.stringify({version:1,rows:[[{t:'Esc',tap:'[esc]'}],[],[]]}))")
        time.sleep(0.3)
        if d.devtools_eval("!!localStorage.getItem('feelime_custom_keys_v2')") is True:
            seeded = True
            break
    if not seeded:
        print("  [I5] custom-table seed failed (DevTools eval dead?)")
    kb = ensure_fixture(kb)
    d.press(kb, "<123>", 0.4)
    cats = d.devtools_eval(
        "[...document.querySelectorAll('[data-sym-cat]')].map(el => el.dataset.symCat)"
    ) or []
    d.devtools_eval(
        "(() => { const c=[...document.querySelectorAll('[data-sym-cat]')]"
        ".find(el => el.dataset.symCat === 'hira'); if (c) c.click(); return !!c; })()"
    )
    time.sleep(0.4)
    hira_keys = d.devtools_eval(
        "[...document.querySelectorAll('#symGrid .kb-key')].map(e => e.textContent).join('')"
    ) or ""
    backspace_role = d.devtools_eval(
        "document.querySelector('#symGrid .kb-row:last-child .kb-key:last-child')?.dataset.role"
    )
    record(
        "I5 symbol category strip with kana content",
        # The 定制 (custom) category joins the strip after common.
        ",".join(cats) == "common,custom,recent,quote,money,math,arrows,num,pinyin,hira,kata,greek"
        and "あ" in hira_keys and backspace_role == "backspace",
        f"cats={cats} hira_has_a={'あ' in hira_keys} bs={backspace_role}",
    )
    d._restore_letters()
    clear(kb)

    # Composing chrome: the right side carries exactly × and ˅ - the
    # keyboard-dismiss chevron must be hidden while composing.
    kb2 = switch(kb, "双拼")
    kb2 = ensure_fixture(kb2)
    clear(kb2)
    for ch in "ni":
        d.press(kb2, ch, 0.2)
    time.sleep(0.7)
    chrome = d.devtools_eval(
        "(() => ({ hide: document.getElementById('hide').hidden,"
        " clear: document.getElementById('composeClear').hidden,"
        " expand: document.getElementById('composeExpand').hidden }))()"
    ) or {}
    record(
        "X0 composing bar shows only x and expand",
        chrome.get("hide") is True and chrome.get("clear") is False and chrome.get("expand") is False,
        repr(chrome),
    )
    d.press(kb2, "<backspace>", 0.3)
    time.sleep(0.4)
    clear(kb2)
    kb = kb2

    # X7 : the expanded area is a vertically scrolling candidate
    # grid with a parse-variant column. Real touches must scroll it (the old
    # P1: preventDefault cancelled native pans) and dragging to the bottom
    # edge must append the next page. x'an gives a rich variant list.
    clear(kb)
    # Same x|an parse as C15: x, sep, an (xan+sep would read xa|n).
    d.press(kb, "x", 0.2)
    d.press(kb, "<shift>", 0.2)  # sep slot: the 分词 key sends '
    for ch in "an":
        d.press(kb, ch, 0.2)
    time.sleep(0.8)
    opened = d.devtools_eval(
        "(() => { document.getElementById('composeExpand').click();"
        " return !document.getElementById('expandLayer').hidden; })()"
    )
    time.sleep(0.8)

    def expand_stats():
        return d.devtools_eval(
            "(() => { const g=document.getElementById('expandGrid'); return {"
            " top:g.scrollTop, total:g.scrollHeight, count:"
            "g.querySelectorAll('.expand-candidate').length }; })()"
        ) or {}

    def variant_labels():
        return d.devtools_eval(
            "[...document.querySelectorAll('#expandVariants .expand-variant')]"
            ".map(el => el.textContent)") or []

    rect = d.devtools_eval(
        "(() => { const r=document.getElementById('expandGrid').getBoundingClientRect();"
        " return [r.left+r.width/2, r.top+r.height/2]; })()"
    )
    stats0 = expand_stats()
    variants0 = variant_labels()
    scrolled = appended = False
    detail7 = f"opened={opened} stats0={stats0} variants={len(variants0)}"
    if opened and rect:
        ox, oy = d._DT_OFFSET
        scale = kb["<density>"]
        cx, cy = rect[0] * scale + ox, rect[1] * scale + oy
        # Native pan (overflow scroll) needs real injection - synthetic
        # TouchEvents never reach the compositor's scroll gestures.
        d.shell(f"input touchscreen swipe {int(cx)} {int(cy)} {int(cx)} {int(cy - 260)} 260")
        time.sleep(0.7)
        stats1 = expand_stats()
        scrolled = stats1.get("top", 0) > stats0.get("top", 0)
        # Drag past the bottom edge: the scroll listener fetches the next page.
        d.shell(f"input touchscreen swipe {int(cx)} {int(cy)} {int(cx)} {int(cy + 700)} 320")
        time.sleep(1.4)
        stats2 = expand_stats()
        appended = stats2.get("count", 0) > stats0.get("count", 0)
        detail7 = f"stats0={stats0} after_up={stats1} after_bottom={stats2} variants={len(variants0)}"
    record("X7 expanded grid scrolls vertically and appends", opened and scrolled and appended, detail7)
    record("X7b x'an parse-variant column lists expansions",
           any(v.startswith("xi'an") for v in variants0) and len(variants0) >= 3, repr(variants0[:6]))

    # 单字 tab filters the grid. Read the unfiltered total FIRST: after the
    # tab click the grid only shows the filtered set (an x'an page can be all
    # two-char words, so a zero single-count is a valid filtered result, and
    # reading "total" afterwards would read the filtered count as the total).
    total_count = expand_stats().get("count", 0)
    singles = d.devtools_eval(
        "(() => { const tab=[...document.querySelectorAll('[data-expand-tab]')]"
        ".find(el => el.dataset.expandTab === 'single'); if (!tab) return null;"
        " tab.click(); return document.querySelectorAll('#expandGrid .expand-candidate').length; })()"
    )
    time.sleep(0.4)
    single_count = singles if isinstance(singles, int) else -1
    d.devtools_eval(
        "(() => { const tab=[...document.querySelectorAll('[data-expand-tab]')]"
        ".find(el => el.dataset.expandTab === 'freq'); if (tab) tab.click(); return true; })()"
    )
    record("X7c single-char tab filters the grid",
           total_count > 0 and 0 <= single_count < total_count,
           f"single={single_count} total={total_count}")

    # Tapping a variant rewinds and retypes that parse: preedit becomes xi'an.
    # State is read as one JSON atom - a DevTools socket can garble
    # plain textContent reads into stale array payloads from earlier evals.
    tapped_variant = d.devtools_eval(
        "(() => { const v=[...document.querySelectorAll('#expandVariants .expand-variant')]"
        ".find(el => el.textContent === \"xi'an\"); if (!v) return false; v.click(); return true; })()"
    )
    preedit_after = None
    for _ in range(6):
        time.sleep(0.5)
        snap = d.devtools_eval(
            "JSON.stringify({p: document.getElementById('expandPreedit').textContent,"
            " open: !document.getElementById('expandLayer').hidden,"
            " composing: document.body.classList.contains('composing')})")
        try:
            preedit_after = __import__("json").loads(snap) if isinstance(snap, str) else None
        except ValueError:
            preedit_after = None
        if preedit_after and preedit_after.get("p") == "xi'an":
            break
    record("X7d variant tap retypes the chosen parse",
           tapped_variant is True and isinstance(preedit_after, dict)
           and preedit_after.get("p") == "xi'an" and preedit_after.get("open") is True
           and preedit_after.get("composing") is True, repr(preedit_after))
    d.devtools_eval("(() => { document.getElementById('expandCollapse')?.click(); return true; })()")
    time.sleep(0.4)
    clear(kb)

    # Recent-symbol history via real symbol taps.
    clear(kb)
    d.press(kb, "<123>", 0.4)
    first_symbol = d.devtools_eval("document.querySelector('#symGrid .kb-key')?.textContent")
    tapped_symbol = tap_dom("#symGrid .kb-key", kb)
    d._restore_letters()
    d.press(kb, "<123>", 0.4)
    tapped_recent = tap_dom('[data-sym-cat="recent"]', kb)
    recent = d.devtools_eval("[...document.querySelectorAll('#symGrid .kb-key')].map(e=>e.textContent)") or []
    rows = d.devtools_eval("document.querySelectorAll('#symGrid .kb-row').length")
    record("I3 used symbol appears first in three-row recent", tapped_symbol and tapped_recent and recent[:1] == [first_symbol] and rows == 3, f"symbol={first_symbol!r} recent={recent[:5]} rows={rows}")

    # Symbol-grid digits must land literally in Chinese modes. sendText used
    # to route through key(); the engine consumed digits as candidate
    # selectors and nothing ever reached the editor (user-reported bug).
    kb = switch(kb, "全拼 Pinyin")
    kb = ensure_fixture(kb)
    clear(kb)
    d.press(kb, "<123>", 0.4)
    # The default 常用 grid leads with the digit row in every mode.
    time.sleep(0.4)

    def tap_digit(ch):
        return d.devtools_eval(
            "(() => { const e=[...document.querySelectorAll('#symGrid .kb-key')]"
            f".find(b => b.textContent === '{ch}');"
            " if(!e) return false; e.click(); return true; })()"
        ) is True

    digits_landed = [(expected, tap_digit(expected)) for expected in "138"]
    time.sleep(0.5)
    digit_text = d.field_text_retry()
    record(
        "I4 symbol digits commit literally in pinyin mode",
        all(ok for _, ok in digits_landed) and digit_text == "138",
        f"taps={digits_landed} text={digit_text!r}",
    )
    # I6 (review regression): the category strip must drag with a
    # real touch too - .sym-cat { touch-action:none } froze it once.
    cat0 = d.devtools_eval(
        "(() => { const s=document.getElementById('symCats'); return {"
        " left:s.scrollLeft, total:s.scrollWidth, width:s.clientWidth }; })()"
    ) or {}
    crect = d.devtools_eval(
        "(() => { const r=document.getElementById('symCats').getBoundingClientRect();"
        " return [r.left+r.width/2, r.top+r.height/2]; })()"
    )
    i6_ok = False
    detail6 = f"stats={cat0}"
    if crect and cat0.get("total", 0) > cat0.get("width", 0):
        ox, oy = d._DT_OFFSET
        scale = kb["<density>"]
        cx, cy = crect[0] * scale + ox, crect[1] * scale + oy
        d.shell(f"input touchscreen swipe {int(cx)} {int(cy)} {int(max(40, cx - 500))} {int(cy)} 280")
        time.sleep(0.7)
        cat1 = d.devtools_eval("document.getElementById('symCats').scrollLeft")
        i6_ok = isinstance(cat1, (int, float)) and cat1 > cat0.get("left", 0)
        detail6 = f"{cat0} -> left={cat1}"
    record("I6 symbol category strip drags for real", i6_ok, detail6)

    # Leave a clean slate: an open symbol layer makes coordinate taps land on
    # digits and poisons the next suite's baseline.
    d._restore_letters()
    clear(kb)
    d._restore_letters()

    # The toolbar mic moved into the quick panel - the always-
    # visible mic affordance is the space key's SVG (space-mic). The idle
    # copy check keeps guarding against the old hint text returning.
    clear(kb)
    voice_dom = d.devtools_eval(
        "(() => { return {"
        " svg:!!document.querySelector('.space-mic path'),"
        " oldCopy:document.body.textContent.includes('点按麦克风开始中英混合识别'),"
        " overlay:document.getElementById('voiceOverlay').classList.contains('open')}; })()"
    ) or {}
    record("J1 mic is an SVG without dot text", voice_dom.get("svg") is True, repr(voice_dom))
    record("J2 idle hint removed", voice_dom.get("oldCopy") is False and voice_dom.get("overlay") is False, repr(voice_dom))

    # Settings source/boundary assertions. This verifies the clean built-in
    # display only; K5 rollback needs an actually active update first and is
    # deliberately kept PENDING in the verification plan.
    d.shell("input keyevent KEYCODE_BACK")
    d.shell(f"am force-stop {d.PKG}")
    # Force-stopping the IME that IS the system default can make ColorOS flip
    # the default to another IME, which legitimately brings the setup wizard
    # back (wizard hides the feature cards K0/K6 assert on). Re-enable + re-pin
    # before relaunching so the assertion tests the settings page, not the
    # wizard (on a fresh AVD the IME also starts disabled after reinstall).
    d.shell(f"ime enable {d.IME_SVC}")
    # `ime set` right after a force-stop can be silently dropped while IMMS
    # is still tearing the old connection down (the AVD flipped the
    # default to LatinIME and the wizard came back). Poll until the pin
    # actually took before opening the settings page.
    for _ in range(10):
        d.shell(f"ime set {d.IME_SVC}")
        time.sleep(0.5)
        if d.PKG in d.shell("settings get secure default_input_method"):
            break
    d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(2.0)
    d.scroll_setup_top()
    default_ime = d.shell("settings get secure default_input_method").strip()
    # Review P3: the old single blind swipe missed whenever the card
    # landed below the fold; scroll until the keywords show up in the dump.
    def dump_has(*needles):
        xml = d.ui_dump()
        return xml, all(n in xml for n in needles)
    # The settings page is sub-paged now - the update card
    # (source line + boundary copy) lives on the update sub-page. Drive the
    # page switch through the page's own DevTools target, then dump.
    # The a11y tree can lag the launch by seconds on a cold WebView - poll
    # for content before asserting (first dump came back a bare shell).
    sev = lambda expr: d.devtools_eval_target("settings/index.html", expr)
    xml = ""
    for _ in range(10):
        xml = d.ui_dump()
        if "Feelime" in xml or any(label in xml for label in ("键盘热更新", "Keyboard updates")):
            break
        time.sleep(1.0)
    sev("window.FeelimeSettings && window.FeelimeSettings.showPage('update')")
    time.sleep(0.8)
    # Poll the SUB-PAGE dump too - a single early dump caught a bare shell
    # once (long-run flake, hand-repro showed all three markers present).
    for _ in range(8):
        xml = d.ui_dump()
        if any(label in xml for label in ("更新源：", "Update source:")):
            break
        time.sleep(1.0)
    detail_xml = xml
    update_status = sev("document.getElementById('updateStatus')?.innerText || ''") or ""
    status_lines = update_status.splitlines()
    source_ok = bool(status_lines) and status_lines[0] in ("APK 内置", "Built-in APK")
    source_ok = source_ok and any(
        line.startswith(("更新源：", "Update source:")) for line in status_lines[1:]
    )
    record("K0 clean built-in source display persists",
           any(label in xml for label in ("键盘热更新", "Keyboard updates"))
           and source_ok,
           f"default={default_ime!r} status={update_status!r}")
    # Removed the duplicated in-card header; the boundary copy now
    # lives in the card() summary line only.
    boundaries = (
        "仅替换 HTML/CSS/JS，不涉及引擎、词典与语音模型",
        "Only keyboard HTML/CSS/JS are replaced. The engine, dictionaries, and voice models stay untouched.",
    )
    record("K6 settings states hot-update boundary",
           any(boundary in xml for boundary in boundaries),
           f"dump-head={xml[:160]!r}")

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
