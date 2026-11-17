#!/usr/bin/env python3
"""Panel (clipboard / favorites) end-to-end gates on device A.

Drives the real chain: SetupActivity clipboard seed -> system ClipboardManager
-> ClipboardStore listener -> panel render (DevTools DOM) -> paste through
coordinator.pasteExternal into the focused editor. Favorites flow uses the
native SetupActivity manager as the source of truth.
"""
import html
import re
import sys
import time

import device_verify as d

RESULTS = []
SKIPPED = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def exact_text(description):
    value = d.field_text_retry(description=description)
    return html.unescape(value) if value is not None else None


def setup_tap_desc(description, wait=1.2):
    """Tap a SetupActivity control by its content-desc (returns True on hit)."""
    xml = d.ui_dump()
    for node in re.finditer(r"<node [^>]*/>", xml):
        blob = node.group(0)
        if f'content-desc="{description}' not in blob:
            continue
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', blob)
        if not bounds:
            continue
        g = [int(x) for x in bounds.groups()]
        if g[2] <= g[0] or g[3] <= g[1]:
            continue
        d.tap((g[0] + g[2]) / 2, (g[1] + g[3]) / 2, wait)
        return True
    return False


def panel_items():
    return d.devtools_eval(
        "[...document.querySelectorAll('#panelList .panel-item')]"
        ".map(r => r.querySelector('.panel-text').textContent)"
    ) or []


def clipboard_store_state():
    """Return a non-sensitive native-store probe for a failed clipboard gate.

    P2/P3 used to report only an empty DOM, which could not distinguish a
    missing native capture from a late panel repaint. Keep the probe to the
    presence/size of the serialized history and never print the clipboard
    payload itself.
    """
    raw = d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_clipboard.xml")
    return {
        "prefs": bool(raw.strip()),
        "hasItemsKey": 'name="items"' in raw,
        "bytes": len(raw.encode("utf-8")),
    }


def open_panel(tab="clipboard"):
    """Open the panel on the given tab via DevTools (real click path)."""
    return d.devtools_eval(
        "(() => {"
        " const layer = document.getElementById('panelLayer');"
        f" if (!layer.hidden) {{"
        f"   const tabBtn = [...document.querySelectorAll('[data-panel-tab]')]"
        f"     .find(b => b.dataset.panelTab === '{tab}');"
        "   if (tabBtn && !tabBtn.classList.contains('active')) tabBtn.click();"
        "   return 'open';"
        " }"
        f" const target = '{tab}';"
        " const btn = document.getElementById('clipboardButton');"
        " btn.click();"
        " if (target !== 'clipboard') {"
        "   const tabBtn = [...document.querySelectorAll('[data-panel-tab]')]"
        "     .find(b => b.dataset.panelTab === target);"
        "   if (tabBtn) tabBtn.click();"
        " }"
        " return document.getElementById('panelLayer').hidden ? 'closed' : 'open'; })()"
    )


def main():
    d.prepare()
    # A stray edge swipe (any earlier suite) leaves the shade covering the
    # screen; every tap below then lands nowhere and P2/P3 fail as items=[].
    d.shell("cmd statusbar collapse")

    # --- P1/P2: system clipboard -> store -> panel -> paste -----------------
    kb = d.fresh_kb(refocus=True)
    if not kb:
        record("panel: keyboard up", False)
        sys.exit(1)
    d.clear_field(kb)
    # Seed a real clipboard entry via the debug SetupActivity button.
    d.ensure_keyboard_down()
    d.shell("logcat -c")
    scrolled = False
    for _ in range(6):
        if setup_tap_desc("feelime-clipboard-seed", wait=0.6):
            scrolled = True
            break
        d.shell("input swipe 540 1750 540 650 220")
        time.sleep(0.5)
    if not scrolled:
        record("P1 clipboard seed button reachable", False)
        sys.exit(1)
    # The debug button logs a generated id only after ClipboardManager
    # accepts this write. An old history row cannot satisfy the current run.
    seed_ids = []
    for _ in range(20):
        seed_ids = re.findall(r"clipboardSeedId=(\d+)",
                              d.shell("logcat -d -s FeelimeSettingsShell:D '*:S'"))
        if seed_ids:
            break
        time.sleep(0.1)
    record("P1 clipboard seed written", bool(seed_ids), f"generatedId={seed_ids[-1] if seed_ids else None}")
    if not seed_ids:
        raise SystemExit("clipboard seed tap did not produce a write")
    seed_text = "feelime-clip-" + seed_ids[-1]

    # Re-raise the keyboard and open the panel.
    bounds = d.remember_field(d.visible_field_bounds())
    if bounds:
        d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.5)
    d.ensure_keyboard_up()
    if not d.input_shown():
        raise SystemExit("normal editor did not regain the IME after clipboard write")
    state = open_panel("clipboard")
    items = []
    for _ in range(15):
        items = panel_items()
        if seed_text in items:
            break
        time.sleep(1.0)
        # The panel shows a one-shot getClipboard snapshot; reopening asks
        # again (and the cold AVD WebView needs many seconds to settle).
        state = open_panel("clipboard") or state
    record(
        "P2 clipboard entry renders in panel",
        state == "open" and seed_text in items,
        f"state={state} items={items[:3]}"
        + ("" if seed_text in items
           else f" store={clipboard_store_state()}"),
    )

    # Paste it: click the panel row, expect the text in the focused editor.
    # The field must be empty first: earlier suites can leave residue (and an
    # unreadable None used to pass clear_field silently), which would concat
    # onto the paste and fake a failure.
    d.clear_field(kb)
    if (d.field_text_retry() or "") != "":
        raise RuntimeError("field still dirty before paste")
    clicked = d.devtools_eval(
        "(() => { const row = [...document.querySelectorAll('#panelList .panel-item')]"
        f".find(r => r.querySelector('.panel-text')?.textContent === {seed_text!r});"
        " if (!row) return false; row.click(); return true; })()"
    )
    time.sleep(0.8)
    text = exact_text(d.TEST_INPUT_DESCRIPTION)
    record(
        "P3 panel paste commits through coordinator",
        clicked is True and text == seed_text,
        f"clicked={clicked} text={text!r}"
        + ("" if clicked is True and text == seed_text
           else f" store={clipboard_store_state()}"),
    )

    # --- P4: sensitive editor yields an empty clipboard list ----------------
    kb = d.fresh_kb(refocus=False) or kb
    d.switch_mode(kb, "英文 Direct")
    # Focus the debug password fixture (device_editor_verify's route). The
    # panel from P3 is still open, so BACK must be verified to actually hide
    # the IME - otherwise the tap lands on the keyboard WebView .
    d.ensure_keyboard_down()
    # 2026-11-17（新 felime-gate AVD 实录）：P3 后的 WebView 布局/焦点
    # 残留会让密码框 tap 落偏（IME 短暂起又收，绑定 type=1，P4 判
    # unknown 稳定挂段）。重开 fixture activity 重置布局——手动验证
    # prepare() 后全链一次通过（tap→type=129 receipt→binding=hosted）。
    d.prepare()
    d.ensure_keyboard_down()
    # Preserve the onStartInput receipt produced by the upcoming focus.
    d.shell("logcat -c")
    kb = None
    for _ in range(8):
        bounds = d.field_bounds("feelime-password-input")
        if bounds and bounds[1] < 2250:
            d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.2)
            # Wait for the IME of the password editor itself. fresh_kb() would
            # re-tap the remembered (non-sensitive) field while the WebView
    # rebuilds, stealing focus back - so poll input_shown instead.
            focused = False
            for _ in range(6):
                if d.input_shown():
                    focused = True
                    break
                time.sleep(0.5)
            if focused:
                kb = "password-editor"
                break
        d.shell("input swipe 540 1650 540 420 450")
        time.sleep(0.5)
    if kb is None:
        record("P4 sensitive editor hides clipboard and disables voice", False, "fixture unreachable")
        sys.exit(1)
    binding, ime = d.wait_password_binding()
    if binding == "claimed":
        # ColorOS hosts password editors in its security keyboard; Feelime
        # never receives the EditorInfo, so there is nothing to gate here.
        SKIPPED.append("P4(sensitive)")
        print(f"SKIP P4: vendor security keyboard owns the password editor ({ime})", flush=True)
        d.ensure_keyboard_down()
    elif binding != "hosted":
        # 取证（2026-11-17）：unknown 有两条出口（129 缺席 / IME 或可见性
        # 不满足），失败轮当场分清，不再盲修。
        n129 = d.shell("logcat -d -s FeelimePanel:* | grep -c 'onStartInput type=129'").strip()
        record("P4 sensitive editor hides clipboard and disables voice", False,
               f"password editor binding not established: {binding}; {ime}; "
               f"shown={d.input_shown()} n129={n129}")
        d.ensure_keyboard_down()
    else:
        time.sleep(1.5)  # WebView + DevTools socket rebuild after hide/show
        # Repush native state in case a push raced the EditorInfo binding.
        d.devtools_eval(
            "window.FeelimeNative && window.FeelimeNative.requestState && window.FeelimeNative.requestState()"
        )
        time.sleep(0.8)
        mic_disabled = d.devtools_eval("document.getElementById('mic').disabled")
        open_panel("clipboard")
        sensitive_items = []
        for _ in range(4):
            sensitive_items = panel_items()
            if sensitive_items == [] and mic_disabled is True:
                break
            mic_disabled = (
                d.devtools_eval("document.getElementById('mic').disabled") or mic_disabled
            )
            time.sleep(0.5)
        record(
            "P4 sensitive editor hides clipboard and disables voice",
            sensitive_items == [] and mic_disabled is True,
            f"items={sensitive_items[:2]} mic.disabled={mic_disabled}",
        )
        d.ensure_keyboard_down()

    # --- P5-P8: favorites editor strip -> paste -> menu removal -------------
    # Add happens in the panelEditor strip over the keyboard;
    # removal rides the row ⋯ menu (one tap).
    bounds = d.remember_field(d.visible_field_bounds())
    if bounds:
        d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.2)
    kb = d.fresh_kb(refocus=False) or kb
    d.clear_field(kb)
    open_panel("favorites")
    added = d.devtools_eval(
        "(() => { document.getElementById('panelManage').click(); return 1; })()"
    )
    time.sleep(0.6)
    # design §3.4: the editor is the float-band phrase card (textarea +
    # input-code field), not the old single-line strip.
    shown = d.devtools_eval("!document.getElementById('phraseCard').hidden")
    filled = d.devtools_eval(
        "(() => { const i = document.getElementById('phraseCardInput');"
        " if (!i || document.getElementById('phraseCard').hidden) return false;"
        " i.value = 'feelime-favorite-e2e';"
        " document.getElementById('phraseCardSave').click(); return true; })()"
    )
    time.sleep(1.0)
    fav_added = []
    for _ in range(4):
        fav_added = panel_items()
        if any("feelime-favorite-e2e" in text for text in fav_added):
            break
        time.sleep(0.7)
    record("P5 favorite added from the editor strip",
           added == 1 and shown is True and filled is True
           and any("feelime-favorite-e2e" in t for t in fav_added),
           f"shown={shown} items={fav_added[:3]}")

    bounds = d.remember_field(d.visible_field_bounds())
    if bounds:
        d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.5)
    kb = d.fresh_kb(refocus=False) or kb
    open_panel("favorites")
    fav_items = []
    for _ in range(6):
        fav_items = panel_items()
        if any("feelime-favorite-e2e" in text for text in fav_items):
            break
        time.sleep(0.7)
    record(
        "P6 favorite renders in panel and pastes",
        any("feelime-favorite-e2e" in text for text in fav_items),
        f"items={fav_items[:3]}",
    )
    d.clear_field(kb)
    if (d.field_text_retry() or "") != "":
        raise RuntimeError("field still dirty before favorite paste")
    clicked = d.devtools_eval(
        "(() => { const row = [...document.querySelectorAll('#panelList .panel-item')]"
        ".find(r => r.textContent.includes('feelime-favorite-e2e'));"
        " if (!row) return false; row.querySelector('.panel-text').click(); return true; })()"
    )
    time.sleep(0.8)
    text = exact_text(d.TEST_INPUT_DESCRIPTION)
    record(
        "P7 favorite paste commits",
        clicked is True and text == "feelime-favorite-e2e",
        f"clicked={clicked} text={text!r}",
    )

    # Cleanup: ⋯ menu delete; count rows before/after.
    bounds = d.remember_field(d.visible_field_bounds())
    if bounds:
        d.tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.5)
    open_panel("favorites")
    before_count = len(panel_items())
    removed = d.devtools_eval(
        "(() => { const row = [...document.querySelectorAll('#panelList .panel-item')]"
        ".find(r => r.textContent.includes('feelime-favorite-e2e'));"
        " if (!row) return false; row.querySelector('.panel-more').click(); return true; })()"
    )
    time.sleep(0.4)
    removed = removed is True and d.devtools_eval(
        "(() => { const del = [...document.getElementById('itemMenu').querySelectorAll('button')]"
        ".find(b => ['删除', 'Delete'].includes(b.textContent.trim()));"
        " if (!del) return false; del.click(); return true; })()"
    ) is True
    time.sleep(0.9)
    after_count = len(panel_items())
    d.devtools_eval("document.getElementById('panelClose').click()")
    time.sleep(0.4)
    record(
        "P8 favorite removal lands",
        removed is True and before_count > 0 and after_count == before_count - 1,
        f"removed={removed} before={before_count} after={after_count}",
    )

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if SKIPPED:
        print("SKIPPED (platform-claimed, covered by mock+JVM):", ", ".join(SKIPPED))
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
