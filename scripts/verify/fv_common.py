"""Shared helpers for the device verify suites (canonical home).

History: these helpers accumulated inside device_height_card_verify.py and
were then imported FROM it by nine other suites, which made every height-card
edit silently change unrelated suites (and any height-card breakage take them
all down). The canonical copies live here now; height-card itself imports
from here too. New suites must import from this module instead of copying
(AGENTS.md 验证层).

Layers:
  - ev/sev/wait_until          DevTools reads + stable-state polling
  - keyboard_*                 geometry-accurate keyboard touches
  - settings_* / launch_settings  settings-app WebView touches
  - switch_mode_real           real long-press mode switching
  - new_recorder               per-suite PASS/FAIL recorder factory
"""
import json
import re
import time
from xml.etree import ElementTree

import device_verify as d

# ---- mode label tables (UI locale aware; shared by every mode suite) ----

MODE_LABELS = {
    "英文 Direct": ("En",),
    "全拼 Pinyin": ("拼", "PY"),
    "双拼": ("双", "DP"),
    "九宫格 T9": ("九", "T9"),
    "Français": ("FR",),
}
MODE_TITLES = {
    "英文 Direct": ("英文 Direct", "English"),
    "全拼 Pinyin": ("全拼 Pinyin", "Pinyin"),
    "双拼": ("双拼", "Double Pinyin"),
    "九宫格 T9": ("九宫格 T9", "T9"),
    "Français": ("Français",),
    "Русский": ("Русский", "Russian"),
    "日本語 Romaji": ("日本語 Romaji", "Japanese"),
}
QUICK_PAIR_KEY = "feelime_quick_pair"
DEFAULT_QUICK_PAIR = ("pinyin", "direct")
MODE_ID_TITLES = {
    "direct": MODE_TITLES["英文 Direct"],
    "pinyin": MODE_TITLES["全拼 Pinyin"],
    "double-pinyin": MODE_TITLES["双拼"],
    "t9": MODE_TITLES["九宫格 T9"],
    "french": MODE_TITLES["Français"],
    "russian": MODE_TITLES["Русский"],
    "japanese": MODE_TITLES["日本語 Romaji"],
}
MODE_ID_LABELS = {
    "direct": ("En",),
    "pinyin": ("拼", "PY"),
    "double-pinyin": ("双", "DP"),
    "french": ("FR",),
    "russian": ("РУ",),
    "japanese": ("日", "JP"),
}


def new_recorder():
    """Per-suite PASS/FAIL recorder: (record, results)."""
    results = []

    def record(name, ok, detail=""):
        results.append((name, bool(ok), detail))
        print(("PASS " if ok else "FAIL ") + name +
              (f"  [{detail}]" if detail else ""), flush=True)

    return record, results


def ev(expression):
    """Read the keyboard WebView through the existing DevTools helper."""
    return d.devtools_eval(expression)


def sev(expression):
    """Read the settings WebView through the existing DevTools helper."""
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


def screen_size():
    values = re.findall(r"(\d+)x(\d+)", d.shell("wm size"))
    if not values:
        return 1080, 2400
    return tuple(int(value) for value in values[-1])


def _quoted(value):
    return json.dumps(value, ensure_ascii=False)


def keyboard_rect(selector):
    expression = (
        "(() => { const el = document.querySelector(" + _quoted(selector) + ");"
        " if (!el || el.hidden) return null;"
        " const r = el.getBoundingClientRect();"
        " return {left:r.left, top:r.top, width:r.width, height:r.height}; })()"
    )
    value = ev(expression)
    if not value or value.get("width", 0) <= 0 or value.get("height", 0) <= 0:
        return None
    return value


def keyboard_text_rect(text, selector="button", contains=False):
    expression = (
        "(() => { const wanted = " + _quoted(text) + ";"
        " const el = [...document.querySelectorAll(" + _quoted(selector) + ")]"
        "   .find(node => "
        + ("node.textContent.includes(wanted)" if contains
           else "node.textContent.trim() === wanted") + ");"
        " if (!el || el.hidden) return null;"
        " const r = el.getBoundingClientRect();"
        " return {left:r.left, top:r.top, width:r.width, height:r.height}; })()"
    )
    value = ev(expression)
    if not value or value.get("width", 0) <= 0 or value.get("height", 0) <= 0:
        return None
    return value


def refresh_keyboard_geometry():
    # Height previews and IME opening move the native WebView. Its origin
    # in a cached DevTools description is no longer a valid touch target.
    if d._DT_SOCKET is not None:
        d._DT_SOCKET.close()
    d._DT_SOCKET = None


def keyboard_point(selector):
    refresh_keyboard_geometry()
    rect = keyboard_rect(selector)
    if not rect:
        return None
    return (
        round((rect["left"] + rect["width"] / 2) * d._DT_SCALE + d._DT_OFFSET[0]),
        round((rect["top"] + rect["height"] / 2) * d._DT_SCALE + d._DT_OFFSET[1]),
    )


def keyboard_text_point(text, selector="button", contains=False):
    refresh_keyboard_geometry()
    rect = keyboard_text_rect(text, selector, contains=contains)
    if not rect:
        return None
    return (
        round((rect["left"] + rect["width"] / 2) * d._DT_SCALE + d._DT_OFFSET[0]),
        round((rect["top"] + rect["height"] / 2) * d._DT_SCALE + d._DT_OFFSET[1]),
    )


def keyboard_text_point_any(texts, selector="button", contains=False):
    for text in texts:
        point = keyboard_text_point(text, selector, contains=contains)
        if point:
            return point
    return None


def keyboard_tap(selector, wait=0.45):
    point = keyboard_point(selector)
    if not point:
        raise RuntimeError(f"keyboard selector not visible: {selector}")
    d.tap(*point, wait=wait)


def keyboard_text_tap(text, selector="button", contains=False, wait=0.45):
    point = keyboard_text_point(text, selector, contains=contains)
    if not point:
        raise RuntimeError(f"keyboard text not visible: {text!r} in {selector}")
    d.tap(*point, wait=wait)


def keyboard_text_tap_any(texts, selector="button", contains=False, wait=0.45):
    point = keyboard_text_point_any(texts, selector, contains=contains)
    if not point:
        raise RuntimeError(f"keyboard text not visible: {texts!r} in {selector}")
    d.tap(*point, wait=wait)


def keyboard_long_press(selector, hold_ms=650):
    point = keyboard_point(selector)
    if not point:
        raise RuntimeError(f"keyboard selector not visible: {selector}")
    x, y = point
    # Same-point input swipe is Android's real long-press injection.  No
    # TouchEvent is synthesized in the page.
    d.shell(f"input swipe {x} {y} {x} {y} {int(hold_ms)}", timeout=15)
    time.sleep(0.8)


def keyboard_swipe(selector, start_fraction=0.12, end_fraction=0.88,
                   duration_ms=650):
    refresh_keyboard_geometry()
    rect = keyboard_rect(selector)
    if not rect:
        raise RuntimeError(f"keyboard selector not visible: {selector}")
    left = rect["left"] + rect["width"] * start_fraction
    right = rect["left"] + rect["width"] * end_fraction
    y = rect["top"] + rect["height"] / 2
    x1 = round(left * d._DT_SCALE + d._DT_OFFSET[0])
    x2 = round(right * d._DT_SCALE + d._DT_OFFSET[0])
    py = round(y * d._DT_SCALE + d._DT_OFFSET[1])
    d.shell(f"input swipe {x1} {py} {x2} {py} {int(duration_ms)}", timeout=15)
    time.sleep(0.9)


def keyboard_state():
    return ev(
        "(() => ({"
        " mode: document.querySelector('#modeToggle .cn-main')?.textContent || '',"
        " sub: document.querySelector('#modeToggle .cn-sub')?.textContent || '',"
        " preedit: document.getElementById('preeditLine')?.textContent || '',"
        " expanded: !document.getElementById('expandLayer')?.hidden,"
        " composing: document.body.classList.contains('composing'),"
        " modeMenu: document.getElementById('modeMenu')?.classList.contains('open'),"
        " panel: document.getElementById('panelLayer')?.hidden === false"
        "}))()") or {}


def wait_mode(label):
    labels = (label,) if isinstance(label, str) else tuple(label)
    return wait_until(
        lambda: ev("document.querySelector('#modeToggle .cn-main')?.textContent || ''"),
        lambda value: value in labels, timeout=10.0)


def height_state():
    return ev(
        "(() => { const card = document.getElementById('heightCard');"
        " const view = document.getElementById('softKeyboard');"
        " const value = (document.getElementById('heightValue')?.textContent || '')"
        "   .match(/\\d+/);"
        " const cr = card.getBoundingClientRect();"
        " const vr = view.getBoundingClientRect();"
        " return {open:card.classList.contains('open') && !card.hidden,"
        " value:value ? Number(value[0]) : null,"
        " keyboardHeight:Math.round(view?.clientHeight || 0),"
        " cardBottom:cr.bottom, keyboardTop:vr.top,"
        " plusDisabled:!!document.getElementById('heightPlus')?.disabled,"
        " minusDisabled:!!document.getElementById('heightMinus')?.disabled,"
        " saveDisabled:!!document.getElementById('heightCardSave')?.disabled}; })()") or {}


def type_word_adb(keyboard, word, wait=0.28):
    for char in word:
        point = keyboard.get(char)
        if not point:
            raise RuntimeError(f"key geometry has no key for {char!r}")
        d.tap(*point, wait=wait)


def mode_menu_item_point(titles):
    """Return the physical center of the selectable item with this title.

    The menu button contains a shorthand span followed by its translated
    title.  Matching the complete last span keeps a title such as ``English``
    from accidentally selecting another button whose shorthand happens to
    contain the same text.
    """
    refresh_keyboard_geometry()
    payload = ev(
        "(() => { const wanted = " + _quoted(titles) + ";"
        " const item = [...document.querySelectorAll('#modeMenu button')]"
        "   .find(node => {"
        "     const title = node.querySelector('span:last-child')"
        "       ?.textContent.trim() || '';"
        "     return wanted.includes(title);"
        "   });"
        " if (!item || item.classList.contains('preparing')"
        "     || item.classList.contains('current')) return null;"
        " const r = item.getBoundingClientRect();"
        " return {left:r.left, top:r.top, width:r.width, height:r.height};"
        "})()")
    if not payload or payload.get("width", 0) <= 0 or payload.get("height", 0) <= 0:
        return None
    return (
        round((payload["left"] + payload["width"] / 2) * d._DT_SCALE + d._DT_OFFSET[0]),
        round((payload["top"] + payload["height"] / 2) * d._DT_SCALE + d._DT_OFFSET[1]),
    )


def switch_mode_real(title):
    """Open the mode menu with a physical long-press and pick an item."""
    expected = MODE_LABELS[title]
    titles = MODE_TITLES[title]
    current = ev("document.querySelector('#modeToggle .cn-main')?.textContent || ''")
    if current in expected:
        return True
    if ev("document.getElementById('modeMenu')?.classList.contains('open')"):
        keyboard_tap("#modeToggle")
        time.sleep(0.4)
    keyboard_long_press("#modeToggle")
    opened = wait_until(
        lambda: ev("document.getElementById('modeMenu')?.classList.contains('open')"),
        lambda value: value is True, timeout=3.0)
    if not opened:
        return False
    # A mode menu item contains both its shorthand and full title.
    point = None
    for _ in range(20):
        ready = ev(
            "(() => { const wanted = " + _quoted(titles) + ";"
            " const item = [...document.querySelectorAll('#modeMenu button')]"
            "   .find(node => {"
            "     const title = node.querySelector('span:last-child')"
            "       ?.textContent.trim() || '';"
            "     return wanted.includes(title);"
            "   });"
            " return !!item && !item.classList.contains('preparing')"
            "   && !item.classList.contains('current'); })()")
        point = mode_menu_item_point(titles)
        if ready and point:
            break
        time.sleep(0.4)
    if not point:
        return False
    d.tap(*point, wait=0.8)
    return wait_mode(expected) in expected


def settings_payload(selector):
    expression = (
        "(() => { const el = document.querySelector(" + _quoted(selector) + ");"
        " if (!el || el.hidden) return null; const r = el.getBoundingClientRect();"
        " return {left:r.left, top:r.top, width:r.width, height:r.height,"
        " innerWidth:window.innerWidth, innerHeight:window.innerHeight,"
        " dpr:window.devicePixelRatio || 1, screenX:window.screenX || 0,"
        " screenY:window.screenY || 0, title:document.title}; })()"
    )
    return sev(expression)


def settings_geometry(selector):
    payload = settings_payload(selector)
    if not payload or payload.get("width", 0) <= 0 or payload.get("height", 0) <= 0:
        return None
    inner_w = float(payload.get("innerWidth") or 0)
    if not inner_w:
        return None
    try:
        root = ElementTree.fromstring(d.ui_dump())
    except ElementTree.ParseError:
        return None
    # 标题匹配优先；但 IME 窗口还挂在无障碍树里时（上一个套件 fresh_kb
    # 收尾常见），ColorOS 会把两个 WebView 都报成空 text，此时按「bounds
    # 高度 ≈ 页面 innerHeight×scale」挑出承载设置页的那块——标题只是
    # 代理，宽高比例才是本体。元素在视口外也要给 geometry，否则外层
    # 拿不到坐标、连滚动都触发不了。
    inner_h = float(payload.get("innerHeight") or 0)
    fallback = None
    fallback_gap = None
    for node in root.iter("node"):
        if node.get("class") != "android.webkit.WebView":
            continue
        bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if not bounds:
            continue
        left, top, right, bottom = map(int, bounds.groups())
        if right <= left or bottom <= top:
            continue
        # Native debug editors and the IME can shrink the settings WebView.
        # Its own accessibility bounds define the origin; CSS pixels scale
        # uniformly and must never be stretched to the whole screen height.
        scale = (right - left) / inner_w
        x = left + (payload["left"] + payload["width"] / 2) * scale
        y = top + (payload["top"] + payload["height"] / 2) * scale
        visible_top = max(top, top + payload["top"] * scale)
        visible_bottom = min(bottom, top + (payload["top"] + payload["height"]) * scale)
        if visible_bottom - visible_top >= min(payload["height"], 24) * scale:
            y = (visible_top + visible_bottom) / 2
        geometry = ((round(x), round(y)), (left, top, right, bottom))
        if node.get("text") == payload.get("title"):
            return geometry
        if node.get("text"):
            continue
        gap = abs((bottom - top) - inner_h * scale)
        if fallback_gap is None or gap < fallback_gap:
            fallback, fallback_gap = geometry, gap
    if fallback_gap is not None and fallback_gap <= max(60.0, 0.2 * inner_h):
        return fallback
    # AVD 快照会间歇性整棵丢掉 WebView 的虚拟视图树（ColorOS 稳定）。
    # 树没了 WebView 原点无从对账，但原生容器节点还在：取最大容器近似
    # 原点，按 CSS 比例换算出目标点。这次点击本身就会让 a11y 重新物化，
    # 后续轮次回到精确路径（settings_tap 的重试循环负责衔接）。
    approx = None
    approx_area = 0
    for node in root.iter("node"):
        bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if not bounds:
            continue
        left, top, right, bottom = map(int, bounds.groups())
        if right <= left or bottom <= top:
            continue
        area = (right - left) * (bottom - top)
        if area > approx_area:
            approx, approx_area = (left, top, right, bottom), area
    if approx and (approx[2] - approx[0]) >= inner_w:
        left, top, right, bottom = approx
        scale = (right - left) / inner_w
        x = left + (payload["left"] + payload["width"] / 2) * scale
        y = top + (payload["top"] + payload["height"] / 2) * scale
        visible_top = max(top, top + payload["top"] * scale)
        visible_bottom = min(bottom, top + (payload["top"] + payload["height"]) * scale)
        if visible_bottom - visible_top >= min(payload["height"], 24) * scale:
            y = (visible_top + visible_bottom) / 2
        return (round(x), round(y)), (left, top, right, bottom)
    return None


def settings_point(selector):
    geometry = settings_geometry(selector)
    return geometry[0] if geometry else None


def settings_tap(selector, wait=0.7, scroll=True):
    # An open IME plus the native test editor can leave only 200 CSS pixels
    # for the page, so reaching controls below the model rows takes >4 swipes.
    geometry = None
    for _ in range(12):
        geometry = settings_geometry(selector)
        if not geometry:
            time.sleep(0.5)
            continue
        point, (left, top, right, bottom) = geometry
        width, height = right - left, bottom - top
        if left <= point[0] < right and top <= point[1] < bottom:
            d.tap(*point, wait=wait)
            return True
        if not scroll:
            break
        # Scroll the settings page with the real Android gesture until the
        # requested DOM node enters the viewport.
        x = (left + right) // 2
        if point[1] < top:
            d.shell(f"input swipe {x} {top + int(height * .25)} "
                    f"{x} {top + int(height * .75)} 260", timeout=15)
        else:
            d.shell(f"input swipe {x} {top + int(height * .78)} "
                    f"{x} {top + int(height * .22)} 260", timeout=15)
        time.sleep(0.6)
    print(f"settings_tap: scroll did not reveal {selector}; geometry={geometry}", flush=True)
    return False


def pick_select_option(selector, option_text, wait=1.0, expect_value=None):
    """Real-tap a settings <select>, then pick the option in the system dialog.

    WebView select dialogs are native UI - the options are visible in the
    a11y dump and tappable like any other dialog row.  option_text accepts a
    str or a list of alternates (the page follows the device UI language:
    AVD runs English, the ColorOS handset runs Chinese).

    The dump ALSO contains ghost matches - the closed select's own value
    text, stale hidden pages - so tapping the first hit is not proof of
    anything.  With expect_value (the option's value inside the <select>)
    every tap is verified over DevTools: the value must actually change,
    otherwise the next candidate (or a reopened dialog) gets the next try.
    """
    wanted = [option_text] if isinstance(option_text, str) else list(option_text)
    if not settings_tap(selector, wait=wait):
        return False
    time.sleep(0.9)

    def value_now():
        if expect_value is None:
            return None
        return sev("document.querySelector(" + _quoted(selector) + ")?.value")

    start = value_now()
    for _ in range(5):
        candidates = []
        try:
            root = ElementTree.fromstring(d.ui_dump())
        except ElementTree.ParseError:
            root = None
        if root is not None:
            for node in root.iter("node"):
                if node.get("text", "").strip() in wanted:
                    bounds = re.fullmatch(
                        r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
                    if bounds:
                        x1, y1, x2, y2 = map(int, bounds.groups())
                        candidates.append(((x1 + x2) / 2, (y1 + y2) / 2))
        for point in candidates:
            d.tap(*point, wait=0.8)
            if expect_value is None or value_now() != start:
                return True
            # Ghost hit (value unchanged): its tap may have toggled the
            # dialog - reopen before trying the next candidate.
            time.sleep(0.6)
            settings_tap(selector, wait=wait)
            time.sleep(0.9)
        time.sleep(0.6)
    # Never leave the dialog open on a failure path.
    d.shell("input keyevent KEYCODE_BACK")
    time.sleep(0.6)
    return False


def settings_visible_pages():
    return sev("[...document.querySelectorAll('.page')].filter(p => !p.hidden)"
               ".map(p => p.dataset.page)") or []


def settings_home_text():
    return sev("document.querySelector('[data-page=\"home\"]')?.innerText || ''") or ""


def wait_settings_ready():
    return wait_until(
        lambda: sev("!!window.FeelimeSettings && !!window.FeelimeSettings.showPage"),
        lambda value: value is True, timeout=12.0, interval=0.5)


def launch_settings(with_fixtures=True):
    # 默认带 SHOW_DEBUG_FIXTURES：SetupActivity 是 singleTop，不带 extra 的
    # am start 也走 onNewIntent，而 onNewIntent 让 fixtures 跟随 intent——
    # 一个不带 extra 的 relaunch 会把测试编辑框藏掉，之后整个套件都在对着
    # 设置页瞎点（键盘永远唤不起来，2026-09-13 input-prefs v6 实录）。
    # 显式 with_fixtures=False 的套件（settings_entry/height_card）不受影响。
    extra = " --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true" if with_fixtures else ""
    d.shell(f"am start -n {d.PKG}/com.feelime.ime.SetupActivity{extra}")
    time.sleep(1.5)
    ready = wait_settings_ready()
    if not ready:
        return ready
    # am start RESUMES the activity with whatever sub-page an earlier suite
    # left open (9i parks settings on the input-test page, its editor still
    # focused and the page scrolled). Reset the router, drop focus (the
    # browser otherwise scroll-anchores back toward the focused editor) and
    # WAIT until the scroll truly settles - a moving page makes every
    # geometry read a stale snapshot and the taps land on other entries.
    sev("(() => { if (document.activeElement && document.activeElement.blur)"
        " document.activeElement.blur();"
        " window.FeelimeSettings.showPage('home');"
        " window.scrollTo(0, 0); return 'ok'; })()")
    stable = 0
    for _ in range(12):
        if str(sev("window.scrollY")) in ("0", "0.0"):
            stable += 1
            if stable >= 2:
                break
        else:
            stable = 0
            sev("window.scrollTo(0, 0)")
        time.sleep(0.4)
    return ready
