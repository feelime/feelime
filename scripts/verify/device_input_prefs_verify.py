#!/usr/bin/env python3
"""Input-prefs device gate (issue #2): 候选字号 + 全拼模糊音.

Both features live on the settings input page and must survive the whole
real chain: a real select/toggle in the settings WebView -> native prefs ->
broadcast -> IME hello / engine-session recreation -> visible behavior.

- 候选字号: the computed font-size of a LIVE candidate element follows the
  tier (100/120/135%) while the row budget stays untouched.
- 模糊音: with the toggle ON the luna_pinyin_fuzzy prism is active - typing
  nian hits lian-family words (n/l initial swap); OFF restores the strict
  prism. The toggle round-trips through the real settings page.
"""
import sys
import time

sys.path.insert(0, __file__.rsplit("/", 1)[0])

import device_verify as d
import fv_common as shared

RESULTS = []
_T0 = time.time()


def tick(label):
    """Phase timing printed to the log: where do the minutes actually go."""
    print(f"[t {time.time() - _T0:7.1f}s] {label}", flush=True)


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def sev(expr):
    return shared.sev(expr)


def engine_prefs_body():
    return d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_engine.xml")


def keyboard_prefs_body():
    return d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_keyboard.xml")


def open_input_page():
    shared.settings_tap('button[data-target="input"]')
    return shared.wait_until(shared.settings_visible_pages,
                             lambda value: value == ["input"], timeout=5.0)


def pref_says(body, pref, value, default):
    """Prefs oracle: an absent key IS the default (a fresh install never
    writes defaults - the boolean/int tiers only materialize on first flip)."""
    if f'name="{pref}"' not in body:
        return value == default
    return f'name="{pref}" value="{value}"' in body


def pick_candidate_font(label, reopen=True):
    """Real system-dialog pick on the 候选字号 select + prefs oracle.

    `reopen=False` reuses the settings page already on screen (the input
    page and scroll position survive between tiers) - only the first pick
    pays the full launch + scroll-in. The light path falls back to a full
    reopen when the direct tap fails, so a failed pick can't poison the
    rest of the case."""
    d.ensure_keyboard_down()
    if reopen:
        if not (shared.launch_settings() and open_input_page()):
            return False
    else:
        # 轻量路径：设置页还在前台，只需路由回到 input 子页（测量后
        # ensure_keyboard_up 会把路由带回家页取编辑框）。先查当前页——
        # input 子页上没有入口按钮，直接 tap 会让 settings_tap 空转几何查询。
        if shared.settings_visible_pages() != ["input"] and not open_input_page():
            if not (shared.launch_settings() and open_input_page()):
                return False
    # #42：select 三档改滑杆（80-150，步进 5）——evaluate 直接设值并派
    # change（CDP 合成 input 事件在键盘页 rAF 停摆的坑不适用于设置页，
    # 但滑杆没有可点的 option，evaluate 是最短路径）。
    pct = int(label.rstrip("%"))
    ok = sev(
        "(() => { const el = document.querySelector('#candidateFont');"
        " if (!el) return false; el.value = String(%d);"
        " el.dispatchEvent(new Event('change', { bubbles: true }));"
        " return true; })()" % pct
    )
    if not ok:
        return False
    return bool(shared.wait_until(
        lambda: pref_says(keyboard_prefs_body(), "candidate_font", str(pct), "100"),
        lambda value: value is True, timeout=8.0))


def candidate_font_px(kb, setup=True):
    """Computed font-size of a LIVE candidate element + the bar height
    (user-visible oracle; Direct mode hides the bar so use full pinyin).
    `setup=False` skips the mode-menu round trip once the case already
    selected 全拼 - the mode survives engine recreates."""
    if setup:
        d.reset_shift(kb)
        d.switch_mode(kb, "全拼 Pinyin")
    kb = d.fresh_kb() or kb
    d.clear_field(kb)
    d.type_word(kb, "ni", wait=0.28)
    time.sleep(0.8)
    for _ in range(5):
        probe = ev(
            "(() => { const c = document.querySelector('#candidates .candidate');"
            " const bar = document.getElementById('candidates');"
            " return c ? [getComputedStyle(c).fontSize, bar.clientHeight] : null; })()"
        )
        if probe:
            return probe[0], probe[1]
        time.sleep(0.5)
    return None, None


def case_candidate_font():
    if not pick_candidate_font("100%"):
        record("candFont: 100% baseline picked", False)
        return
    kb = d.fresh_kb(refocus=True)
    if not kb:
        record("candFont: keyboard up", False)
        return
    base, bar_base = candidate_font_px(kb)
    dataset0 = ev("document.body.dataset.candFont")
    tick("candFont: 100% baseline measured")

    if not pick_candidate_font("120%", reopen=False):
        record("candFont: 120% picked", False)
        return
    d.fresh_kb(refocus=True)
    large, bar_large = candidate_font_px(kb, setup=False)
    dataset1 = ev("document.body.dataset.candFont")

    if not pick_candidate_font("150%", reopen=False):
        record("candFont: 150% picked", False)
        return
    d.fresh_kb(refocus=True)
    xlarge, bar_xlarge = candidate_font_px(kb, setup=False)
    dataset2 = ev("document.body.dataset.candFont")

    def px(value):
        return float(str(value).replace("px", "")) if value else 0.0

    # #42 滑杆：120% 与新上限 150% 都落在实算字号上；dataset 只有
    # normal/scaled 两态（CSS 变量才是刻度真源）。
    record("candFont: slider values land on the live candidate text",
           bool(base and large and xlarge)
           and abs(px(large) - px(base) * 1.2) < 0.6
           and abs(px(xlarge) - px(base) * 1.5) < 0.6
           and (dataset0, dataset1, dataset2) == ("normal", "scaled", "scaled"),
           f"base={base} large={large} xlarge={xlarge} "
           f"datasets={(dataset0, dataset1, dataset2)}")

    # Row budget untouched: the candidates bar height must not move.
    record("candFont: bar height unchanged across slider values",
           bar_base == bar_large == bar_xlarge and (bar_base or 0) >= 40,
           f"bars=({bar_base}, {bar_large}, {bar_xlarge})")

    if not pick_candidate_font("100%", reopen=False):
        record("candFont: restore 100%", False)
        return
    d.fresh_kb(refocus=True)
    restored, _ = candidate_font_px(kb, setup=False)
    record("candFont: restore to 100%",
           bool(restored) and abs(px(restored) - px(base)) < 0.3,
           f"restored={restored} base={base}")


def set_fuzzy_mask(mask):
    """Real settings-page group toggles + engine-prefs oracle (bit mask).
    No force-stop recovery here: killing the app mid-injection wedged the
    AVD's input dispatcher (2026-09-12) - plain retries are enough, the
    toggles are idempotent against their checked state."""
    d.ensure_keyboard_down()
    for attempt in range(3):
        if shared.launch_settings() and open_input_page():
            for bit in (1, 2, 4, 8, 16):
                want = bool(mask & bit)
                checked = sev(
                    f"document.querySelector('input[data-fuzzy-bit=\"{bit}\"]')"
                    "?.checked"
                )
                if checked is None:
                    break
                if bool(checked) != want:
                    sev(
                        "document.querySelector("
                        f"'input[data-fuzzy-bit=\"{bit}\"]').click()"
                    )
            if shared.wait_until(
                    lambda: pref_says(engine_prefs_body(), "fuzzy_pinyin_mask",
                                      str(mask), "0"),
                    lambda value: value is True, timeout=8.0):
                return True
        time.sleep(2.0)
    return False


def typed_candidates(kb, word, attempts=3, setup=True):
    """Type `word` in full-pinyin and return the candidate list (with typing
    retries: the schema swap drops in-flight keys through the same
    STALE_STAMP window as the double-pinyin switch). `setup=False` skips the
    mode-menu round trip when the case already selected 全拼 earlier — the
    mode survives engine recreates, so only the first round needs it."""
    if setup:
        d.reset_shift(kb)
        d.switch_mode(kb, "全拼 Pinyin")
    for _ in range(attempts):
        kb2 = d.fresh_kb() or kb
        d.clear_field(kb2)
        d.type_word(kb2, word, wait=0.28)
        time.sleep(0.8)
        for _ in range(5):
            cands = d.devtools_candidates()
            if cands:
                return cands
            time.sleep(0.5)
        kb = kb2
    return []


LIAN_CHARS = "连联莲怜帘恋炼链廉镰"
ZHAN_CHARS = "沾粘斩展站湛占瞻"
HU_CHARS = "湖壶糊蝴虎互户护"
RE_CHARS = "热惹"
ZHONG_CHARS = "中种重众钟忠"


def has_any(texts, chars):
    return any(any(ch in text for ch in chars) for text in texts)


def case_fuzzy_pinyin():
    kb = d.fresh_kb(refocus=True)
    if not kb:
        record("fuzzy: keyboard up", False)
        return

    if not set_fuzzy_mask(0):
        record("fuzzy: all groups OFF lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    tick("fuzzy: strict baseline ready")
    strict = typed_candidates(kb, "nian")
    record("fuzzy OFF: nian stays nian-only",
           bool(strict) and not has_any(strict, LIAN_CHARS),
           f"candidates={strict[:6]}")
    tick("fuzzy: OFF typing done")

    if not set_fuzzy_mask(2):
        record("fuzzy: n/l only lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    nl_nian = typed_candidates(kb, "nian", setup=False)
    record("fuzzy n/l: nian also hits lian-family words",
           bool(nl_nian) and has_any(nl_nian, LIAN_CHARS),
           f"candidates={nl_nian[:6]}")
    nl_zan = typed_candidates(kb or d.fresh_kb(refocus=True), "zan", setup=False)
    record("fuzzy n/l only: zan stays zhan-free (groups are isolated)",
           bool(nl_zan) and not has_any(nl_zan, ZHAN_CHARS),
           f"candidates={nl_zan[:6]}")
    tick("fuzzy: n/l group done")

    if not set_fuzzy_mask(3):
        record("fuzzy: 平翘舌+n/l lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    zan = typed_candidates(kb, "zan", setup=False)
    record("fuzzy 平翘舌: zan also hits zhan-family words",
           bool(zan) and has_any(zan, ZHAN_CHARS),
           f"candidates={zan[:6]}")
    tick("fuzzy: 平翘舌 group done")

    if not set_fuzzy_mask(4):
        record("fuzzy: f/h only lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    fu = typed_candidates(kb, "fu", setup=False)
    record("fuzzy f/h: fu also hits hu-family words",
           bool(fu) and has_any(fu, HU_CHARS),
           f"candidates={fu[:6]}")

    if not set_fuzzy_mask(8):
        record("fuzzy: r/l only lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    le = typed_candidates(kb, "le", setup=False)
    record("fuzzy r/l: le also hits re-family words",
           bool(le) and has_any(le, RE_CHARS),
           f"candidates={le[:6]}")
    tick("fuzzy: f/h + r/l groups done")

    if not set_fuzzy_mask(16):
        record("fuzzy: nasal only lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    zhon = typed_candidates(kb, "zhon", setup=False)
    record("fuzzy nasal: zhon reaches zhong-family words (ong→on)",
           bool(zhon) and has_any(zhon, ZHONG_CHARS),
           f"candidates={zhon[:6]}")
    tick("fuzzy: nasal group done")

    if not set_fuzzy_mask(0):
        record("fuzzy: restore OFF", False)
        return
    d.fresh_kb(refocus=True)
    restored = typed_candidates(d.fresh_kb() or kb, "nian", setup=False)
    record("fuzzy: restore OFF returns the strict prism",
           bool(restored) and not has_any(restored, LIAN_CHARS),
           f"candidates={restored[:6]}")
    tick("fuzzy: case done")


def set_association(on):
    """Real settings toggle + pref oracle for the association switch."""
    d.ensure_keyboard_down()
    for attempt in range(3):
        if shared.launch_settings() and open_input_page():
            checked = sev("document.getElementById('associationOn')?.checked")
            if checked is not None:
                if bool(checked) != on:
                    sev("document.getElementById('associationOn').click()")
                if shared.wait_until(
                        lambda: pref_says(keyboard_prefs_body(), "association_on",
                                          "true" if on else "false", "false"),
                        lambda value: value is True, timeout=8.0):
                    return True
        time.sleep(2.0)
    return False


def assoc_words():
    return ev(
        "[...document.querySelectorAll('#candidates .candidate.assoc')]"
        ".map(b => b.textContent)"
    ) or []


def click_bar_candidate(text):
    return ev(
        "(() => { const b = [...document.querySelectorAll('#candidates .candidate')]"
        ".find(x => x.textContent === '" + text + "');"
        " if (!b) return 'no'; b.click(); return 'ok'; })()"
    )


def case_association(kb):
    if not set_association(True):
        record("assoc: toggle ON lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    tick("assoc: ON ready")
    cands = typed_candidates(kb, "ni")
    target = next((c for c in cands if len(c) == 1), None)
    if not target:
        record("assoc: single-char candidate available", False,
               f"candidates={cands[:6]}")
        return
    if click_bar_candidate(target) != "ok":
        record("assoc: head candidate clicked", False, f"target={target}")
        return
    words = shared.wait_until(assoc_words, lambda v: bool(v), timeout=5.0) or []
    record("assoc: commit shows follower words",
           bool(words), f"first={target} assoc={words[:6]}")
    tick("assoc: first commit done")

    chained = words[0] if words else None
    if not chained:
        record("assoc: chained tap commits and re-suggests", False, "nothing to chain")
        return
    ev("(() => { const b = document.querySelector('#candidates .candidate.assoc');"
       " if (!b) return 'no'; b.click(); return 'ok'; })()")
    text = shared.wait_until(
        lambda: d.field_text_retry() or "", lambda v: chained in v, timeout=6.0) or ""
    words2 = shared.wait_until(assoc_words, lambda v: isinstance(v, list), timeout=5.0) or []
    record("assoc: chained tap commits and re-suggests",
           chained in text, f"field={text!r} next={words2[:6]}")
    tick("assoc: chain done")

    if not set_association(False):
        record("assoc: toggle OFF lands the pref", False)
        return
    d.fresh_kb(refocus=True)
    cands2 = typed_candidates(kb, "ni", setup=False)
    target2 = next((c for c in cands2 if len(c) == 1), None)
    quiet = True
    if target2 and click_bar_candidate(target2) == "ok":
        quiet = not bool(shared.wait_until(
            assoc_words, lambda v: bool(v), timeout=4.0))
    record("assoc: OFF keeps the bar clean after commit",
           quiet, f"candidates={cands2[:4]}")
    tick("assoc: case done")


def main():
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    case_candidate_font()
    case_fuzzy_pinyin()
    case_association(kb)

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== input-prefs device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
