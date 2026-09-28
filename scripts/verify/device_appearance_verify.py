#!/usr/bin/env python3
"""外观 device gate（issue #15）：外观二级页 + 色彩模式 + 背景图 + 按键不透明度.

整条真实链路：外观页真实控件 -> SettingsBridge 桥调用 -> feelime_keyboard
prefs -> PREFS_CHANGED 广播 -> IME hello -> 键盘 WebView 可见/可计算的状态。

- 外观入口在首页，点进去是独立子页（appearance），返回键回首页。
- 色彩模式：浅色/深色写入 theme_mode，键盘根类与 toolTheme 图形跟随
  （light=太阳 / dark=月牙 / auto=半圆，不换颜色只换图形）。
- 按键不透明度：真实拖动滑块落盘（input 只标记、change 才提交一次），
  键盘侧 --key-alpha 与键帽背景色的 alpha 精确等于 pct/100。
- 背景图：亮/暗两组各自「内置」，键盘 #bgImage 层带 data:image 且随主题
  换组；「无」清空并回到透明底。
"""
import sys
import time

sys.path.insert(0, __file__.rsplit("/", 1)[0])

import device_verify as d
import fv_common as shared

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def sev(expr):
    return shared.sev(expr)


def keyboard_prefs_body():
    return d.shell(f"run-as {d.PKG} cat shared_prefs/feelime_keyboard.xml")


def pref_value(body, key):
    import re
    match = re.search(r'<string name="%s">([^<]*)</string>' % key, body)
    if match:
        return match.group(1)
    match = re.search(r'<int name="%s" value="(-?\d+)"' % key, body)
    return match.group(1) if match else ""


def pick_until_pref(selector, option, key, want, tries=3, expect_value=None):
    """真实 select 挑选项；pref 未落到期望值就重挑（dump ghost 抢点兜底）。"""
    for attempt in range(tries):
        if shared.pick_select_option(selector, option, expect_value=expect_value):
            if wait_pref(key, want):
                return True
        time.sleep(1.0)
        open_appearance_page()
    return False


def wait_pref(key, want, timeout=8.0, cast=str):
    # wait_until 返回末次读数（可能是 ""，falsy），这里换算成真布尔。
    last = shared.wait_until(
        lambda: pref_value(keyboard_prefs_body(), key),
        lambda v: cast(v) == want if v != "" else want in ("", None),
        timeout=timeout)
    return str(last) == str(want)


def open_appearance_page():
    """回首页并进入外观页（am start 复活旧子页，先显式归位）。"""
    if not shared.launch_settings():
        return False
    sev("(() => { if (document.activeElement && document.activeElement.blur)"
        " document.activeElement.blur();"
        " window.FeelimeSettings.showPage('home');"
        " window.scrollTo(0, 0); return 'ok'; })()")
    time.sleep(0.4)
    if not shared.settings_tap('button[data-target="appearance"]'):
        return False
    return shared.wait_until(shared.settings_visible_pages,
                             lambda pages: pages == ["appearance"],
                             timeout=6.0) == ["appearance"]


def open_skin_page():
    """皮肤三级页（main 1eaedc3 起：背景图选择与键面滑杆从外观页挪进
    skin 子页，外观页只剩主题/预览；返回键栈式回外观）。"""
    if not open_appearance_page():
        return False
    if not shared.settings_tap('button[data-target="skin"]'):
        return False
    return shared.wait_until(
        shared.settings_visible_pages,
        lambda pages: "skin" in (pages or []), timeout=6.0) is not None


def scroll_setting_into_view(selector):
    """把目标行滚到视口中央（外观页加了预览区后页面变长，拖拽落点
    依赖元素实际在屏内）。"""
    sev(f"document.querySelector('{selector}')"
        f"?.scrollIntoView({{block: 'center'}})")
    time.sleep(0.5)
    return True


def set_slider_via_events(value):
    """按真实事件序（input 标记 -> change 提交）驱动滑块，返回落盘值。"""
    return sev(f"(() => {{ const el = document.getElementById('keyOpacity');"
               f" el.value = '{value}';"
               f" el.dispatchEvent(new Event('input', {{bubbles: true}}));"
               f" el.dispatchEvent(new Event('change', {{bubbles: true}}));"
               f" return el.value; }})()")


def key_alpha_state():
    """键盘侧透明度取证：根变量 + 实键帽（.kb-key）背景 alpha。

    alpha=1 时 Chromium 把 computed 序列化成 rgb()（无 alpha 段），此时
    keyAlpha 回退整串，断言只对 rootAlpha 精确匹配。"""
    return d.devtools_eval(
        "(() => {"
        " const rootAlpha = getComputedStyle(document.documentElement)"
        "   .getPropertyValue('--key-alpha').trim();"
        " const key = document.querySelector('.kb-key');"
        " let bg = '';"
        " if (key) {"
        "   const rgba = getComputedStyle(key).backgroundColor;"
        "   const m = rgba.match(/rgba?\\([^)]*[, ]([\\d.]+)\\)/);"
        "   bg = m ? m[1] : rgba;"
        " }"
        " return JSON.stringify({rootAlpha, keyAlpha: bg});"
        "})()")


def keyboard_theme_state():
    import json
    raw = d.devtools_eval(
        "(() => JSON.stringify({"
        " rootClass: document.documentElement.className,"
        " glyph: document.querySelector('#toolTheme')?.dataset?.glyph || '',"
        " bgOn: document.body.dataset.bgImage === 'on',"
        " bgImage: (document.getElementById('bgImage')?.style.backgroundImage || '').slice(0, 30),"
        "}))()") or "{}"
    try:
        return json.loads(raw)
    except ValueError:
        return {}


def main():
    d.prepare()

    # S1 外观入口 -> 子页。
    entry_ok = bool(shared.launch_settings()) and bool(sev(
        "!!document.querySelector('[data-target=\"appearance\"]')"))
    record("home shows the appearance entry", entry_ok)
    record("appearance entry opens its page", open_appearance_page())

    # S2 归零：滑块回到 100（不透明默认），色彩模式回 auto。
    if not open_appearance_page():
        record("appearance page re-open for resets", False)
    else:
        set_slider_via_events(100)
        record("slider resets to 100", wait_pref("key_opacity", "100"))
        # 跟随系统（真实 select 通道）。已在 auto 时不走 pick：
        # expect_value 校验依赖「值真实变化」，对已是目标值的 select 必轮空。
        current_mode = sev("document.getElementById('themeMode').value")
        if current_mode == "auto":
            record("theme mode resets to auto", True, "already auto")
        else:
            record("theme mode resets to auto",
                   pick_until_pref("#themeMode", ["跟随系统", "Follow system"],
                                   "theme_mode", "auto", expect_value="auto"))

    # S3 色彩模式 -> 浅色 / 深色（真实 select + 键盘跟随）。
    if not open_appearance_page():
        record("theme_mode=light via real select", False, "page open failed")
    elif not (scroll_setting_into_view("#themeMode")
              and pick_until_pref("#themeMode", ["浅色", "Light"], "theme_mode", "light", expect_value="light")):
        record("theme_mode=light via real select", False)
    else:
        record("theme_mode=light via real select", True)
        kb = d.fresh_kb(refocus=True)
        state = keyboard_theme_state()
        record("keyboard follows light theme", state.get("rootClass") == "theme-light",
               state)
        record("light glyph is the sun", state.get("glyph") == "themeSun", state)

    if not open_appearance_page():
        record("theme_mode=dark via real select", False, "page open failed")
    elif not (scroll_setting_into_view("#themeMode")
              and pick_until_pref("#themeMode", ["深色", "Dark"], "theme_mode", "dark", expect_value="dark")):
        record("theme_mode=dark via real select", False)
    else:
        record("theme_mode=dark via real select", True)
        d.fresh_kb(refocus=True)
        state = keyboard_theme_state()
        record("keyboard follows dark theme", "theme-light" not in state.get("rootClass", ""),
               state)
        record("dark glyph is the moon", state.get("glyph") == "themeMoon", state)

    # S4 背景图：亮/暗两组各自内置（先亮组，键盘取证；再暗组换主题取证）。
    # 皮肤三级页之后 bg 选择在 skin 页；themeMode 仍在外观页。
    if not open_skin_page():
        record("light bg builtin via real select", False, "page open failed")
    elif not (scroll_setting_into_view("#bgImageLight")
              and pick_until_pref("#bgImageLight", ["内置", "Built-in"], "bg_image_light_src", "builtin", expect_value="builtin")):
        record("light bg builtin via real select", False)
    else:
        record("light bg builtin via real select",
               wait_pref("bg_image_light_src", "builtin"))
        # 亮组图只在浅色主题下展示（S3 把主题留在了深色，先切回来）。
        if not (open_appearance_page()
                and shared.pick_select_option("#themeMode", ["浅色", "Light"],
                                          expect_value="light")
                and wait_pref("theme_mode", "light")):
            record("light bg check needs light theme", False)
        d.fresh_kb(refocus=True)
        state = keyboard_theme_state()
        record("light keyboard shows the light bg image",
               state.get("bgOn") is True and "data:image" in state.get("bgImage", ""),
               state)
        d.screenshot("/tmp/fv-appearance-light-bg.png")

    if not open_skin_page():
        record("dark bg builtin via real select", False, "page open failed")
    elif not (scroll_setting_into_view("#bgImageDark")
              and pick_until_pref("#bgImageDark", ["内置", "Built-in"], "bg_image_dark_src", "builtin", expect_value="builtin")):
        record("dark bg builtin via real select", False)
    else:
        record("dark bg builtin via real select",
               wait_pref("bg_image_dark_src", "builtin"))
        open_appearance_page()
        pick_until_pref("#themeMode", ["深色", "Dark"], "theme_mode", "dark", expect_value="dark")
        d.fresh_kb(refocus=True)
        state = keyboard_theme_state()
        record("dark keyboard keeps a bg image (dark group)",
               state.get("bgOn") is True and "data:image" in state.get("bgImage", ""),
               state)
        d.screenshot("/tmp/fv-appearance-dark-bg.png")

    # S5 不透明度：真实拖动滑块（拇指实际移动），再精确落 50 做键盘断言。
    if not open_skin_page():
        record("appearance page re-open for slider", False)
    else:
        scroll_setting_into_view("#keyOpacity")
        geo = shared.settings_geometry("#keyOpacity")
        record("slider geometry visible", bool(geo))
        if geo:
            (cx, cy), _ = geo
            d.shell(f"input swipe {cx} {cy} {cx - 140} {cy} 320")
            time.sleep(1.2)
            dragged = sev("document.getElementById('keyOpacity').value")
            try:
                dragged_num = int(str(dragged))
            except (TypeError, ValueError):
                dragged_num = -1
            record("real drag moves the slider below 100",
                   5 <= dragged_num < 100, f"value={dragged}")
            final = set_slider_via_events(50)
            record("slider commits exactly 50", str(final) == "50"
                   and wait_pref("key_opacity", "50"))
            kb = d.fresh_kb(refocus=True)
            alpha = key_alpha_state() or ""
            record("keyboard --key-alpha follows 50%",
                   '"rootAlpha":"0.5"' in alpha and '"keyAlpha":"0.5"' in alpha,
                   alpha)
            d.screenshot("/tmp/fv-appearance-opacity50.png")

    # S6 返回首页；清理到默认（无背景 / auto / 不透明）。
    # 返回链（skin 三级页后是两跳）：skin→外观→首页。
    back_ok = False
    if "skin" in (shared.settings_visible_pages() or []):
        b1 = sev("(() => { const b = document.querySelector("
                 " '[data-page=\"skin\"] [data-back]');"
                 " if (b) { b.click(); return 'ok'; } return 'miss'; })()")
        time.sleep(0.6)
        if b1 == "ok" and shared.settings_visible_pages() == ["appearance"]:
            b2 = sev("(() => { const b = document.querySelector("
                     " '[data-page=\"appearance\"] [data-back]');"
                     " if (b) { b.click(); return 'ok'; } return 'miss'; })()")
            time.sleep(0.6)
            back_ok = b2 == "ok" and shared.settings_visible_pages() == ["home"]
    record("appearance back button returns home", back_ok)

    # 清理：bg/不透明度在 skin 页，主题在外观页。
    if open_skin_page():
        legs = {
            "bgLight": pick_until_pref("#bgImageLight", ["无", "None"], "bg_image_light_src", "", expect_value="none"),
            "bgDark": pick_until_pref("#bgImageDark", ["无", "None"], "bg_image_dark_src", "", expect_value="none"),
            "opacity": (set_slider_via_events(100), wait_pref("key_opacity", "100"))[1],
        }
        if open_appearance_page():
            legs["theme"] = pick_until_pref("#themeMode", ["跟随系统", "Follow system"], "theme_mode", "auto", expect_value="auto")
        record("cleanup restores defaults (no bg / auto / opaque)", all(legs.values()),
               " ".join(f"{k}={'ok' if v else 'FAIL'}" for k, v in legs.items()))
    else:
        record("cleanup restores defaults (no bg / auto / opaque)", False,
               "page re-open failed")

    d.fresh_kb(refocus=True)
    state = keyboard_theme_state()
    record("keyboard bg layer cleared after cleanup",
           state.get("bgOn") is False and state.get("bgImage") == "", state)

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== appearance device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
