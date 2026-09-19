#!/usr/bin/env python3
"""Device gate: toolbar edit mode (issue #15) on the real device.

入口（tile / 长按工具 / 长按空白）、× 移除、仓库点按添加、拖动跨组、
取消回退、完成落盘、开关型工具 toggle + state-on、composing 全隐藏。
布局改动一律用「取消」收尾或显式恢复，离开时尽量还原默认布局。"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import device_verify as d

RESULTS = []
SHOT_DIR = os.environ.get("FEELIME_TBE_SHOTS", "/tmp/toolbar-edit")


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def ev(expr):
    return d.devtools_eval(expr)


def state():
    return ev("window.Feelime.debugState() ? JSON.stringify(window.Feelime.debugState()) : 'no-facade'")


def st():
    import json
    raw = state()
    return json.loads(raw) if raw and raw != "no-facade" else {}


def center(el_id):
    """DOM 元素中心的屏幕坐标（CSS px → 物理 px，含 DevTools 偏移）。"""
    r = ev(f"""(() => {{
        const el = document.getElementById({el_id!r});
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {{x: b.left + b.width / 2, y: b.top + b.height / 2,
                w: b.width, h: b.height}};
    }})()""")
    if not r or not r.get("w"):
        return None
    return d.devtools_to_screen(r["x"], r["y"])


def tap_el(el_id, wait=0.5):
    p = center(el_id)
    if not p:
        return False
    d.tap(*p, wait)
    return True


def tap_qs_tile(label, wait=0.6):
    """快捷设置 tile 按名点击（自动翻到所在页）。"""
    p = ev(f"""(() => {{
        const tiles = [...document.querySelectorAll('.qs-tile')];
        const t = tiles.find(el =>
            (el.querySelector('.qs-name') || {{}}).textContent === {label!r});
        if (!t) return null;
        const pages = document.querySelector('.qs-pages');
        if (pages) {{
            const tr = t.getBoundingClientRect();
            const pr = pages.getBoundingClientRect();
            if (tr.right < pr.left + 4 || tr.left > pr.right - 4) {{
                pages.scrollLeft += pages.clientWidth;  // 翻一页
                return null;  // 调用方重试
            }}
        }}
        const r = t.getBoundingClientRect();
        return {{x: r.left + r.width / 2, y: r.top + r.height / 2}};
    }})()""")
    if not p:
        return False
    sp = d.devtools_to_screen(p["x"], p["y"])
    d.tap(*sp, wait)
    return True


def shot(name):
    os.makedirs(SHOT_DIR, exist_ok=True)
    path = os.path.join(SHOT_DIR, name)
    d.screenshot(path)
    print("  shot:", path, flush=True)


def x_badge_center(el_id):
    r = ev(f"""(() => {{
        const el = document.getElementById({el_id!r});
        const x = el && el.querySelector(':scope > .tool-x');
        if (!x) return null;
        const b = x.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return null;  // hidden 子树
        return {{x: b.left + b.width / 2, y: b.top + b.height / 2}};
    }})()""")
    if not r:
        return None
    return d.devtools_to_screen(r["x"], r["y"])


def remove_tool(el_id):
    x = x_badge_center(el_id)
    if not x:
        return False
    d.tap(*x, 0.4)
    return True


def ensure_idle():
    """composing 残留会让长按入口被守卫挡住（正确行为），先点 × 清。"""
    for _ in range(3):
        if ev('document.body.classList.contains("composing")') is not True:
            return True
        clear_p = ev("""(() => {
            const el = document.getElementById('composeClear');
            if (!el || el.hidden) return null;
            const b = el.getBoundingClientRect();
            return {x: b.left + b.width / 2, y: b.top + b.height / 2};
        })()""")
        if not clear_p:
            d.shell("input keyevent 67")
            time.sleep(0.2)
            continue
        sp = d.devtools_to_screen(clear_p["x"], clear_p["y"])
        d.tap(*sp, 0.4)
        time.sleep(0.3)
    return ev('document.body.classList.contains("composing")') is not True


def enter_edit():
    """确保空闲后长按 mic 进入编辑态，返回是否成功。"""
    ensure_idle()
    p = center("mic")
    if not p:
        return False
    d.shell(f"input swipe {int(p[0])} {int(p[1])} {int(p[0])} {int(p[1])} 700")
    time.sleep(0.7)
    return st().get("toolbarEdit") is True


def reset_layout():
    """布局重置为默认（写偏好后重启 IME 生效）。Native 是 keyboard.js
    闭包常量，eval 全局里必须用 window.FeelimeNative。"""
    ok = d.devtools_eval("""(() => {
        if (typeof window.FeelimeNative === 'undefined'
            || typeof window.FeelimeNative.setQuickPref !== 'function') return false;
        window.FeelimeNative.setQuickPref('toolbarLayout',
            JSON.stringify({left: ['ctrl', 'ime'],
                            right: ['clipboard', 'favorites', 'mic']}),
            window.Feelime.debugState().token);
        return true;
    })()""")
    print("reset_layout wrote pref:", ok, flush=True)
    time.sleep(0.3)
    d.shell(f"am force-stop {d.PKG}")
    time.sleep(1)
    d.shell(f"ime set {d.IME_SVC}")
    time.sleep(0.5)


def drag(from_id, to_x, to_y, ms=650):
    p = center(from_id)
    if not p:
        return False
    d.shell(f"input swipe {int(p[0])} {int(p[1])} {int(to_x)} {int(to_y)} {ms}")
    time.sleep(0.4)
    return True


def bar_gap_point():
    """候选条上接近左端、不在任何按钮上的空白点（长按空白入口用）。"""
    r = ev("""(() => {
        const bar = document.getElementById('candidateBar');
        const b = bar.getBoundingClientRect();
        const cand = document.getElementById('candidates').getBoundingClientRect();
        return {x: cand.left + cand.width * 0.5, y: b.top + b.height / 2,
                cw: cand.width};
    })()""")
    if not r:
        return None
    return d.devtools_to_screen(r["x"], r["y"])


def main():
    d.prepare()          # 先把键盘 WebView 跑起来,pref 写入需要活页面
    reset_layout()       # 写默认布局 + 重启 IME 读回
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    if not kb:
        # 停在九宫格等布局时缺 <shift> 等 special 键，先切全拼再标定。
        d.devtools_click_mode("全拼 Pinyin")
        time.sleep(1.2)
        kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    time.sleep(0.5)

    # T1 长按工具栏工具进入编辑态（280ms 入口，抗微动）。
    ok = enter_edit()
    record("T1 long-press mic enters edit mode", ok, state())
    shot("t1-edit-mode.png")
    pool_ids = ev("[...document.getElementById('toolbarEditorGrid').children].map(c => c.id)")
    record("T2 pool holds the 5 toggle tools",
           pool_ids == ["toolTheme", "toolVibrate", "toolSound", "toolAssoc", "toolOneHand"],
           str(pool_ids))

    # T3 × 移除 favorites → 仓库。
    before = st()["toolbarRight"]
    ok = remove_tool("favoritesButton")
    time.sleep(0.3)
    after = st()["toolbarRight"]
    record("T3 × removes favorites", ok and "favorites" not in after and "favorites" in before,
           f"{before} -> {after}")
    shot("t3-removed.png")

    # T4 仓库点按添加回右组。
    ok = tap_el("favoritesButton")
    time.sleep(0.3)
    record("T4 pool tap adds favorites back",
           ok and "favorites" in st()["toolbarRight"], state())

    # T5 拖动 mic 到左组（跨组）。
    bar = ev("""(() => { const b = document.getElementById('candidateBar').getBoundingClientRect();
        return {left: b.left + b.width * 0.12, y: b.top + b.height / 2}; })()""")
    target = d.devtools_to_screen(bar["left"], bar["y"])
    ok = drag("mic", *target)
    time.sleep(0.3)
    s = st()
    record("T5 drag mic into the left group",
           ok and "mic" in s["toolbarLeft"] and "mic" not in s["toolbarRight"],
           f"L={s['toolbarLeft']} R={s['toolbarRight']}")
    shot("t5-dragged.png")

    # T6 取消 → 整体回退（拖动/移除全部撤销）。
    tap_el("toolbarEditCancel")
    time.sleep(0.4)
    s = st()
    record("T6 cancel restores the snapshot",
           s["toolbarEdit"] is False and "mic" in s["toolbarRight"]
           and "mic" not in s["toolbarLeft"], state())

    # T7 tile 入口（第二页）。
    tap_el("setupButton", 0.7)
    if not tap_qs_tile("编辑工具栏"):
        tap_qs_tile("编辑工具栏", 0.8)
    time.sleep(0.4)
    record("T7 quick-settings tile opens the editor", st().get("toolbarEdit") is True,
           state())
    tap_el("toolbarEditCancel")

    # T8 开关型工具：上栏 → 点击 toggle → state-on。
    # 进编辑态，× 掉 ctrl 腾位，tap pool 的 toolSound，完成退出。
    ok = enter_edit()
    record("T8-pre long-press re-enters edit mode", ok, state())
    remove_tool("ctrlTool")
    time.sleep(0.2)
    tap_el("toolSound")
    time.sleep(0.2)
    tap_el("toolbarEditDone")
    time.sleep(0.4)
    s = st()
    record("T8a sound tool joins the right group", "sound" in s["toolbarRight"],
           state())
    # 点击它：state-on 必须翻转一次（起点状态不假设，验证「翻转」本身）。
    on0 = ev("document.getElementById('toolSound').classList.contains('state-on')")
    tap_el("toolSound")
    time.sleep(0.4)
    on1 = ev("document.getElementById('toolSound').classList.contains('state-on')")
    tap_el("toolSound")
    time.sleep(0.4)
    on2 = ev("document.getElementById('toolSound').classList.contains('state-on')")
    record("T8b tap toggles keySound (state-on flips)",
           on0 != on1 and on1 != on2 and on0 == on2, f"{on0}->{on1}->{on2}")
    shot("t8-toggle-on.png")
    # 收尾：再点一次，尽量把 keySound 归回关闭态。
    if on2 is True:
        tap_el("toolSound")

    # T9 composing（全拼出候选）时全部工具隐藏，只剩 ×。
    d.devtools_click_mode("全拼 Pinyin")
    time.sleep(0.8)
    kb = d.fresh_kb(refocus=True)
    letters = kb.get("n") and kb.get("i")
    if letters:
        d.tap(*kb["n"], 0.25)
        d.tap(*kb["i"], 0.5)
    time.sleep(0.5)
    hidden = ev("""(() => {
        const ids = ['toolTheme','toolVibrate','toolSound','toolAssoc','toolOneHand',
                     'mic','hide','setupButton','clipboardButton','favoritesButton'];
        return JSON.stringify(ids.map(id => { const el = document.getElementById(id);
            return [id, !!el && el.hidden]; }));
    })()""")
    import json
    rows = json.loads(hidden)
    bad = [row for row in rows if row[0] != "mic" and not row[1]]
    mic_hidden = [row for row in rows if row[0] == "mic"][0][1]
    record("T9 composing hides every tool (mic included, only × stays)",
           not bad and mic_hidden, str(rows))
    shot("t9-composing-hidden.png")
    # 清空组合：× 是组合态唯一的取消入口。
    ensure_idle()
    time.sleep(0.3)

    # T10 恢复默认布局:UI 路径的移除/添加已被 T3/T4/T8 覆盖,这里用
    # pref 通道整体重置(比在窄条上串多颗按钮稳定),重启后断言。
    reset_layout()
    d.prepare()
    kb = d.fresh_kb(refocus=True)
    time.sleep(0.4)
    s = st()
    layout_ok = (s["toolbarLeft"] == ["ctrl", "ime"]
                 and s["toolbarRight"] == ["clipboard", "favorites", "mic"]
                 and s["toolbarEdit"] is False)
    record("T10 default layout restored", layout_ok,
           f"L={s['toolbarLeft']} R={s['toolbarRight']}")
    shot("t10-default.png")

    failures = [r for r in RESULTS if not r[1]]
    print(f"\n== toolbar-edit device gate: {len(RESULTS) - len(failures)} passed, "
          f"{len(failures)} failed ==", flush=True)
    for name, _, detail in failures:
        print("FAILED:", name, detail[:200], flush=True)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
