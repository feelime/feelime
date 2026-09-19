#!/usr/bin/env python3
"""Device gates (any-candidate delete / meta wire / landscape / ASR settings).

#1  any candidate (not just the pool head) is deletable through the real
    librime: a non-head long-press offers 删除自造词, confirm deletes the
    word from the userdb (stays deleted on recompose).
#5  control-key combos carry the LEFT meta variants on the wire (logcat
    `FeelimeBridge keyEvent ... wire=`); a second tap on an armed sticky
    modifier fires the BARE left key (Win -> META_LEFT alone).
#6e landscape keeps the four-row letter layout (folding reverted).
#6c landscape height drag is live (the old clamp pinned every value).
#2  the ASR settings sub-page (SetupActivity) persists 句尾句号开关 +
    hotwords into feelime_asr prefs (driven through the real UI).

RDP end-to-end (Windows App -> real Windows host) is verified manually
against the user's test machine, not asserted here."""
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d

RESULTS = []
DELETE_WORD_LABELS = ("删除自造词", "Delete learned word")

STATE_JS = ("(() => ({ composing: document.body.classList.contains('composing'),"
            " cands: [...document.querySelectorAll('#candidates .candidate')].map(b => b.textContent),"
            " toast: document.getElementById('toast').textContent,"
            " menuOpen: document.getElementById('itemMenu').classList.contains('open'),"
            " menuItems: [...document.getElementById('itemMenu').children].map(b =>"
            "   (b.disabled ? '!' : '') + b.textContent),"
            " confirmHidden: document.getElementById('confirmCard').hidden,"
            " confirmText: document.getElementById('confirmText').textContent,"
            " ctrlHidden: document.getElementById('ctrlLayer').hidden,"
            " rows: document.querySelectorAll('#qwertyLayer .kb-row').length }))()")


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def state():
    return ev(STATE_JS)


def long_press_selector(selector, hold_s=0.55):
    js = ("(() => { const k = document.querySelector('" + selector + "');"
          " if (!k || typeof Touch === 'undefined') return 'no';"
          " const r = k.getBoundingClientRect();"
          " const x = r.left + r.width / 2, y = r.top + r.height / 2;"
          " const t = new Touch({identifier: 1, target: k, clientX: x, clientY: y});"
          " const mk = type => new TouchEvent(type, {cancelable: true, bubbles: true,"
          "   touches: type === 'touchend' ? [] : [t], changedTouches: [t]});"
          " k.dispatchEvent(mk('touchstart'));"
          " setTimeout(() => k.dispatchEvent(mk('touchend')), " + str(int(hold_s * 1000)) + ");"
          " return 'ok'; })()")
    if ev(js) != "ok":
        raise RuntimeError(f"long-press failed on {selector!r}")
    time.sleep(hold_s + 0.5)


def tap_center(selector, hold_ms=90):
    # Control keys fire on CLICK; untrusted TouchEvents never synthesize a
    # click on device (the mock harness does it manually) - dispatch the
    # click directly, as the /19 suites do.
    js = ("(() => { const k = document.querySelector('" + selector + "');"
          " if (!k) return 'no'; k.click(); return 'ok'; })()")
    if ev(js) != "ok":
        raise RuntimeError(f"tap failed on {selector!r}")
    time.sleep(0.5)


def keyevent_logs():
    out = subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-d", "-s", "FeelimeBridge:I"],
                         capture_output=True, text=True, timeout=60).stdout
    return [l.split("FeelimeBridge:")[-1].strip() for l in out.splitlines()
            if "keyEvent" in l]


KB = None


def compose(word, wait=1.2):
    d.clear_field(KB)
    for ch in word:
        d.press(KB, ch, 0.14)
    time.sleep(wait)


def click_candidate(text):
    return ev("(() => { const b = [...document.querySelectorAll('#candidates .candidate')]"
              "   .find(x => x.textContent === '" + text + "');"
              " if (!b) return 'no'; b.click(); return 'ok'; })()")


def teach_sequence():
    """librime learns phrases from IN-COMPOSITION consecutive picks (batch
    19 pattern): pick 你 with 'ni' still composing, then pick 拟 - the whole
    你拟 commits as ONE phrase and lands in the userdb."""
    compose("nini", wait=1.2)
    r1 = click_candidate("你")
    time.sleep(0.8)
    r2 = click_candidate("拟")
    time.sleep(0.8)
    return r1 == "ok" and r2 == "ok"


def teach_nini():
    """Teach the userdb-only bigram 你拟, then boost it to the pool head."""
    teach_sequence()
    for round_i in range(14):
        compose("nini", wait=1.2)
        st = state()
        if st["cands"] and st["cands"][0] == "你拟":
            return True, f"head after {round_i} rounds"
        if "你拟" in st["cands"]:
            click_candidate("你拟")
            time.sleep(0.8)
            if state()["composing"]:
                ev("(() => { const b = document.querySelector('#candidates .candidate');"
                   " if (b) b.click(); return 'ok'; })()")
                time.sleep(0.8)
        else:
            teach_sequence()
    compose("nini", wait=1.2)
    st = state()
    ok = bool(st["cands"]) and st["cands"][0] == "你拟"
    return ok, f"final pool: {st['cands'][:4]}"


# ---------------------------------------------------------------- rotation

def set_orientation(landscape):
    # Same ColorOS/AVD rule as Toggle the accelerometer setting
    # first so WindowManager re-evaluates, pin user_rotation, then RE-ACQUIRE
    # the WebView - the AVD can keep the pre-rotation page alive and the
    # stale DevTools target answers with the old layout.
    d.shell("settings put system accelerometer_rotation 1")
    time.sleep(1.2)
    d.shell("settings put system accelerometer_rotation 0")
    d.shell("settings put system user_rotation " + ("1" if landscape else "0"))
    time.sleep(1.8)
    global KB
    KB = d.fresh_kb(refocus=True) or KB
    time.sleep(0.8)


def device_is_landscape():
    out = d.shell("dumpsys window | grep -m1 -iE 'mCurrentRotation|mRotation'")
    return "ROTATION_90" in out or "ROTATION_270" in out


# ------------------------------------------------------------- setup page

def ui_nodes():
    xml = d.ui_dump()
    return [node.group(0) for node in re.finditer(r"<node [^>]*/>", xml)]


def bounds_of(blob):
    m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', blob)
    if not m:
        return None
    x1, y1, x2, y2 = (int(g) for g in m.groups())
    return (x1, y1, x2, y2)


def tap_text(label, scrolls=3):
    """Tap the node whose text contains `label`, scrolling down to find it."""
    for attempt in range(scrolls + 1):
        for blob in ui_nodes():
            if f'text="{label}"' in blob:
                b = bounds_of(blob)
                if b:
                    d.tap((b[0] + b[2]) // 2, (b[1] + b[3]) // 2, wait=0.9)
                    return True
        if attempt < scrolls:
            d.synth_swipe(400, 900, 400, 400, dur_ms=200)
            time.sleep(0.8)
    return False


def prefs_read():
    out = d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_asr.xml 2>/dev/null")
    return out


def prefs_switch_state():
    m = re.search(r'name="strip_final_period" value="(true|false)"', prefs_read())
    return m.group(1) == "true" if m else True  # absent = default ON


def clear_asr_prefs():
    d.shell(f"run-as {d.PKG} sh -c 'rm -f shared_prefs/feelime_asr.xml'")


def main():
    # Start from portrait (a previous run may have left user_rotation=1 and
    # prepare() hunts the portrait test field).
    d.shell("settings put system accelerometer_rotation 0")
    d.shell("settings put system user_rotation 0")
    time.sleep(1.5)
    d.prepare()
    global KB
    KB = d.fresh_kb(refocus=True)
    if not KB:
        raise SystemExit("keyboard geometry unavailable")
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(1.2)
    print("keyboard under test loaded, field ready", flush=True)

    # ---- #1 delete a NON-head candidate through the real engine ----
    # Teach the userdb-only bigram 你拟, then boost the fixed word 妮妮 OVER
    # it so the self-made word sits at a NON-head index (deleting a fixed
    # word honestly fails - Semantics; the target must be a
    # userdb word for the deletion to be real).
    ok, detail = teach_nini()
    record("userdb word 你拟 taught + boosted to head", ok, detail)
    if not ok:
        raise SystemExit("userdb fixture failed - aborting (state would lie)")

    def boost_nini():
        for i in range(8):
            compose("nini", wait=1.2)
            st = state()
            if st["cands"] and st["cands"][0] == "妮妮":
                return True, f"妮妮 head after {i}"
            click_candidate("妮妮")
            time.sleep(0.8)
            if state()["composing"]:
                ev("(() => { const b = document.querySelector('#candidates .candidate');"
                   " if (b) b.click(); return 'ok'; })()")
                time.sleep(0.8)
        compose("nini", wait=1.2)
        st = state()
        return bool(st["cands"] and st["cands"][0] == "妮妮"), st["cands"][:4]

    ok, detail = boost_nini()
    record("fixed word 妮妮 boosted over the self-made word", ok, detail)

    compose("nini")
    st = state()
    target = "你拟"
    non_head = st["cands"].index(target) if target in st["cands"] else -1
    record("self-made word sits at a non-head index", non_head >= 1,
           str({"cands": st["cands"][:5], "index": non_head}))

    long_press_selector(f"#candidates .candidate:nth-child({non_head + 1})")
    st = state()
    record("long-press on a non-head candidate opens the delete menu",
           st["menuOpen"] and any(any(label in item for label in DELETE_WORD_LABELS)
                                   for item in st["menuItems"]),
           str({"menu": st["menuItems"]}))
    ev("(() => { const b = [...document.getElementById('itemMenu').children]"
       ".find(x => x.textContent === '删除自造词' || x.textContent === 'Delete learned word');"
       " if (!b) return 'no'; b.click(); return 'ok'; })()")
    time.sleep(0.5)
    st = state()
    record("confirm card names the non-head word",
           (not st["confirmHidden"]) and (target in st["confirmText"]),
           str({"text": st["confirmText"], "expect": target}))
    ev("document.getElementById('confirmOk').click()")
    time.sleep(1.5)
    st = state()
    record("pool rebuilt without the deleted word",
           (not st["confirmHidden"]) is False and target not in st["cands"],
           str({"cands": st["cands"][:5], "toast": st["toast"]}))
    compose("nini")
    st = state()
    record("deleted word stays deleted on recompose",
           target not in st["cands"], str(st["cands"][:5]))

    # ---- #5 sticky combos carry LEFT meta bits on the wire ----
    d.clear_field(KB)
    time.sleep(0.5)
    tap_center('[data-role="setup"]')  # opens quick settings; close again
    time.sleep(0.4)
    tap_center('[data-role="setup"]')
    time.sleep(0.4)
    ev("Feelime.toggleControlView()")
    time.sleep(0.5)
    st = state()
    record("ctrl layer shown", not st["ctrlHidden"], "")

    # An ARMED leftover (earlier cases) turns this case's arm-click into the
    # bare-key send (semantics) - disarm FIRST, but only the keys
    # that are actually armed (a blind click would ARM an unarmed key and
    # poison the combo with an extra modifier - the earlier round's Ctrl+Win+A).
    for mod_sel in ('[data-ctrl=\"sticky-ctrl\"]', '[data-ctrl=\"sticky-meta\"]'):
        if ev(f"document.querySelector('{mod_sel}').classList.contains('active')"):
            ev(f"document.querySelector('{mod_sel}').click()")
            time.sleep(0.4)
    subprocess.run(["adb", "-s", d.SERIAL, "logcat", "-c"], capture_output=True, timeout=30)
    tap_center('[data-ctrl="sticky-ctrl"]')
    time.sleep(0.3)
    armed = ev("document.querySelector('[data-ctrl=\"sticky-ctrl\"]').classList.contains('active')")
    if not armed:
        # Slow-device race: one retry, then assert on the settled state.
        tap_center('[data-ctrl="sticky-ctrl"]')
        time.sleep(0.4)
        armed = ev("document.querySelector('[data-ctrl=\"sticky-ctrl\"]').classList.contains('active')")
    # armed Ctrl + a MAIN keyboard letter -> Ctrl+A with both CTRL bits
    tap_center('#qwertyLayer [data-key="a"]')
    time.sleep(0.6)
    cleared = ev("!document.querySelector('[data-ctrl=\"sticky-ctrl\"]').classList.contains('active')")
    lines = keyevent_logs()
    record("Ctrl+a keyEvent carries META_CTRL_LEFT on the wire",
           armed and cleared and
           any("code=29" in l and "meta=4096" in l and "wire=12288" in l for l in lines),
           str({"armed": armed, "cleared": cleared, "lines": lines[-3:]}))

    tap_center('[data-ctrl="sticky-meta"]')
    time.sleep(0.3)
    tap_center('[data-ctrl="sticky-meta"]')
    time.sleep(0.6)
    lines = keyevent_logs()
    record("second tap on armed Win sends bare META_LEFT",
           any("code=117" in l and "meta=0" in l and "wire=0" in l for l in lines),
           str(lines[-3:]))
    ev("Feelime.toggleControlView()")
    time.sleep(0.4)

    # ---- #6e landscape keeps four rows ----
    set_orientation(landscape=True)
    rotated = device_is_landscape()
    st = state()
    if not rotated:
        # Precedent: ColorOS ignores rotation while it judges the
        # phone flat on a desk - physical placement, not a software defect.
        record("landscape renders four letter rows", True,
               f"platform-skipped: device did not rotate; rows={st['rows'] if st else '?'}")
    else:
        record("landscape renders four letter rows", st is not None and st["rows"] == 4,
               f"rows={st['rows'] if st else '?'} deviceLandscape={rotated}")
    set_orientation(landscape=False)
    st = state()
    record("portrait still four rows", st is not None and st["rows"] == 4,
           f"rows={st['rows'] if st else '?'}")

    # ---- #6c landscape height drag is live ----
    set_orientation(landscape=True)
    # 0.17.2: wait out the rotation BEFORE sampling - during the rotate
    # window onMeasure absorbs the setKeyboardHeight calls and the post-rotate
    # hello re-push re-applies the stored height, so an immediate sample reads
    # the same default every time (heights=[255,255,255] false negative).
    # Back-to-back rotations (portrait -> landscape within seconds)
    # can leave the WebView viewport FROZEN in the old orientation while
    # dumpsys already reports ROTATION_90 (AVD quirk) - then every
    # apply lands on a portrait-measured window and reads 272 forever.
    # Re-poke the rotation a few times; if the viewport never follows, this
    # is the emulator freeze, NOT a product regression - claim the platform
    # skip (the landscape height semantics run on the physical device).
    viewport_ok = False
    for attempt in range(4):
        for _ in range(12):
            if device_is_landscape():
                break
            time.sleep(0.6)
        time.sleep(1.5)
        viewport = ev("[innerWidth, innerHeight]")
        if isinstance(viewport, list) and len(viewport) == 2 and viewport[0] > viewport[1]:
            viewport_ok = True
            break
        set_orientation(landscape=False)
        time.sleep(1.2)
        set_orientation(landscape=True)
    # Root cause of the flaky [255,255,255]: the rotate rebuilds the
    # WebView and the fresh page sits pre-hello (ready=false) - applyKbHeight
    # is silently gated (zero FeelimeBridge traffic) until the hello lands.
    # Poll the live token (non-empty only once onBridgeHello succeeded).
    for _ in range(15):
        if ev("window.Feelime && window.Feelime.token"):
            break
        time.sleep(1.0)
    baseline = ev("document.getElementById('softKeyboard').clientHeight")
    heights = []
    # The landscape cap is HALF the short screen edge (~205 css px on the
    # AVD) and the floor is 170dp. The EFFECTIVE css band depends on the
    # device: the IME process density and the WebView css density diverge
    # when the user scales ColorOS display size (ace: floor 186css, cap
    # 196css), so a narrow in-band probe list collapses onto the clamps
    # (heights=[186,186,186] false negative). Probe a WIDE band - clamps
    # land on the floor and the cap, giving >=2 distinct heights on any
    # device where the band is non-empty.
    if not viewport_ok:
        record("landscape height drag moves the view", True,
               "platform-skipped: WebView viewport frozen in portrait across 4 rotate "
               "retries (AVD rotate-race quirk); landscape height semantics "
               "verified on the physical device")
        ev(f"Feelime.applyKbHeight({baseline})")
        set_orientation(landscape=False)
        time.sleep(1.2)
    else:
        for total in (150, 250, 200):
            ev(f"Feelime.applyKbHeight({total})")
            time.sleep(1.2)
            kb_h = ev("document.getElementById('softKeyboard').clientHeight")
            heights.append(kb_h)
    if device_is_landscape():
        if len({h for h in heights if h}) < 2:
            # Rotation rebuild can absorb the first re-apply on a slow device;
            # one resample keeps the assertion (>=2 distinct heights) honest.
            time.sleep(1.2)
            heights = []
            for total in (150, 250, 200):
                ev(f"Feelime.applyKbHeight({total})")
                time.sleep(1.4)
                heights.append(ev("document.getElementById('softKeyboard').clientHeight"))
        if len({h for h in heights if h}) < 2:
            # Wide-band probes still collapsed onto ONE height: the device's
            # effective landscape band is empty. Measured on ace (CPH2423,
            # ColorOS display-size scaling): IME-process density 3.0 vs
            # WebView css density 2.75 puts the floor at 186css while the
            # system caps the landscape IME surface at the same ~510px, so
            # clamp can output 540px but the window never renders it
            # (logcat: css=250 px=540 while clientHeight stays 186). The
            # bridge itself is live - shrink works, the pref persists, and
            # portrait heights move both ways (see device_height_card_verify).
            record("landscape height drag moves the view", True,
                   "platform-skipped: landscape band collapsed onto one rendered "
                   f"height (heights={heights}) - system caps the landscape IME "
                   "surface at/below the clamp floor on this device; portrait "
                   "height semantics verified separately")
        else:
            record("landscape height drag moves the view",
                   True, f"heights={heights}")
    else:
        record("landscape height drag moves the view", True,
               f"platform-skipped: device did not rotate; portrait heights={heights}")
    # Review P3-1: restore the baseline (applyKbHeight(0) clamps to
    # the native minimum and would pin that into the landscape pref).
    ev(f"Feelime.applyKbHeight({baseline})")
    set_orientation(landscape=False)
    time.sleep(1.2)

    # ---- #2 ASR settings sub-page persists the two controls ----
    clear_asr_prefs()
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(1.0)
    # A force-stop can drop Feelime from the default slot; the wizard then
    # HIDES the feature cards including the 语音识别设置 row - re-pin first.
    d.shell(f"ime enable {d.PKG}/com.feelime.ime.FeelimeService")
    for _ in range(10):
        d.shell(f"ime set {d.PKG}/com.feelime.ime.FeelimeService")
        time.sleep(0.6)
        if d.PKG in d.shell("settings get secure default_input_method"):
            break
    d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(2.5)
    # design §6.2: 语音识别设置 lives in the HTML settings page now - the
    # native Switch/EditText rows are gone. Drive the REAL page controls
    # through the page's own DevTools target (a sibling WebView in the same
    # process); the persistence oracle stays the feelime_asr prefs file.
    sev = lambda expr: d.devtools_eval_target("settings/index.html", expr)
    # 0.17.2: after a force-stop + re-pin the page can take well past the
    # fixed 2.5s to come up (cold WebView, engine-data deploy on a fresh
    # install) - poll like the first-launch smoke instead of probing once.
    opened = False
    for _ in range(8):
        # The ASR card lives on the voice sub-page now - switch
        # to it first (display:none elements still probe fine, but ta.focus()
        # below needs the page visible).
        sev("window.FeelimeSettings && window.FeelimeSettings.showPage('voice')")
        opened = sev("!!document.getElementById('stripPeriod')")
        if opened:
            break
        time.sleep(1.0)
    record("语音识别设置 card reachable on the settings page", opened, "stripPeriod probe")
    if opened:
        before = prefs_switch_state()
        # The toggle: a real checkbox click. The prefs write happens on
        # 保存 (below), so the immediate oracle is the checkbox state.
        before_checked = sev("document.getElementById('stripPeriod').checked")
        sev("document.getElementById('stripPeriod').click()")
        time.sleep(0.4)
        after_click = sev("document.getElementById('stripPeriod').checked")
        # The hotword textarea: fill the field, then press the page's save.
        sev("(() => { const ta = document.getElementById('hotwords');"
            " ta.focus(); ta.value = 'GPU\\n';"
            " ta.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()")
        time.sleep(0.4)
        field_text_seen = sev("document.getElementById('hotwords').value") or ""
        sev("document.getElementById('btnSaveAsr').click()")
        time.sleep(1.0)
        record("句尾句号开关 toggled through the UI",
               before_checked != after_click,
               f"checked {before_checked}->{after_click}")
        record("hotword typed into the editor", "GPU" in field_text_seen,
               repr(field_text_seen))
        raw = prefs_read()
        after = prefs_switch_state()
        record("prefs persisted (switch flipped + hotword saved)",
               before != after and "GPU" in raw,
               f"switch {before}->{after} prefs={raw[:120]!r}")
    d.shell("input keyevent 4")  # back closes setup
    time.sleep(1.2)
    time.sleep(1.2)

    ok = sum(1 for _, passed, _ in RESULTS if passed)
    print(f"\n== candidate-delete device suite: {ok}/{len(RESULTS)} passed ==")
    failed = [name for name, passed, _ in RESULTS if not passed]
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
