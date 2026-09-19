#!/usr/bin/env python3
"""笔画输入法 device gate（issue #18）：键面结构 + 引擎链路 + 手势 + 浮层。

键面：T9 五列网格骨架，3×3 = 一丨丿丶乙 / ＊ / @#. / ， / 分词；点按发
h/s/p/n/z/*/',/（ASCII ，走 punctuator）。引擎链路（host probe 定论）：
preedit 由 schema xlit 成部件字形回显（* 原样）；completion 候选带剩余码
comment（v1 不展示）；句子候选（☯，多字）在键盘侧压后；组合中 ',' =
提交高亮候选 + ，；第二 * 在 JS 拦截（码表只有单通配行）。
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


def ev(expr):
    return d.devtools_eval(expr)


def css2phys(p):
    return (p[0] * d._DT_SCALE + d._DT_OFFSET[0],
            p[1] * d._DT_SCALE + d._DT_OFFSET[1])


def stroke_geometry():
    """笔画键面复用 qwertyLayer 容器：数字键几何直接从活体 DOM 读
    （fresh_kb 的 qwerty 完整性门在这里必不过）。"""
    shared.refresh_keyboard_geometry()
    return d.devtools_key_geometry() or {}


def type_digits(geo, digits, wait=0.3):
    for char in digits:
        point = geo.get(char)
        if not point:
            raise RuntimeError(f"stroke geometry has no key for {char!r}")
        d.tap(*point, wait=wait)


def wait_candidates(attempts=8):
    for _ in range(attempts):
        cands = d.devtools_candidates()
        if cands:
            return cands
        time.sleep(0.5)
    return []


def preedit():
    return ev("document.getElementById('preeditLine').textContent") or ""


def main():
    d.prepare()
    # 模式记忆可能停在 T9/笔画：先回全拼走标准入口（几何门只认 qwerty）。
    token = ev("window.Feelime && window.Feelime.debugState ? "
               "window.Feelime.debugState().token : ''")
    if token:
        ev('window.FeelimeNative.selectMode("pinyin", "%s")' % token)
        time.sleep(1.2)
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")

    d.reset_shift(kb)
    d.switch_mode(kb, "笔画 Stroke")
    time.sleep(4.0)  # 首次切笔画要部署 stroke 资产并建 feelime_stroke 会话
    geo = stroke_geometry()
    print(f"[t {time.time():.0f}] stroke: mode switched, geo keys={sorted(geo)[:12]}", flush=True)

    # ===== 键面结构 =====
    caps = ev(
        "[...document.querySelectorAll('#qwertyLayer .t9-key[data-key]')]"
        ".map(k => k.dataset.key + '=' + k.querySelector('.t9-group').textContent)"
    ) or []
    record("stroke: keycaps 1-9 (一丨丿丶乙＊@#.，分词)",
           caps == ["1=一", "2=丨", "3=丿", "4=丶", "5=乙",
                    "6=＊", "7=@#.", "8=，", "9=分词"] or
           caps == ["1=一", "2=丨", "3=丿", "4=丶", "5=乙",
                    "6=＊", "7=@#.", "8=，", "9=Split"], f"caps={caps}")
    record("stroke: chrome keys + mic space present",
           ev("!!document.querySelector('[data-role=\"backspace\"]')"
              " && !!document.querySelector('[data-role=\"t9clear\"]')"
              " && !!document.querySelector('[data-role=\"t9emoji\"]')"
              " && document.getElementById('spaceKey').dataset.key === '0'") is True)
    cells = ev("[...document.querySelectorAll('#t9Strip .t9-side-cell')]"
               ".map(c => c.textContent)") or []
    record("stroke: side strip shows common characters",
           "，" in cells and "。" in cells, f"{cells[:6]}")

    # ===== 点按出字：1=横(h)，组合不进宿主编辑器 =====
    d.clear_field(kb)
    type_digits(geo, "1")
    time.sleep(0.8)
    cands = wait_candidates()
    record("stroke: tap 1 (h) reaches stroke candidates",
           bool(cands) and "一" in cands, f"candidates={cands[:6]}")
    record("stroke: preedit shows the component glyph",
           preedit() == "一", f"preedit={preedit()!r}")
    field = (d.field_text_retry() or "").strip()
    record("stroke: composition stays out of the host editor",
           field == "", f"field={field!r}")

    # ===== 通配：h* 派生行命中 =====
    d.clear_field(kb)
    type_digits(geo, "16")
    time.sleep(0.8)
    cands = wait_candidates()
    joined = "".join(cands)
    record("stroke: h* wildcard reaches derived rows",
           any(ch in joined for ch in "二七十四厂丁"), f"cands={cands[:6]}")
    record("stroke: wildcard preedit keeps *",
           preedit() == "一*", f"preedit={preedit()!r}")

    # ===== 第二个 * 拦截（码表只有单通配行）=====
    before = preedit()
    x6, y6 = geo["6"]
    d.tap(x6, y6)
    time.sleep(0.5)
    toast = ev("document.getElementById('toast').classList.contains('open')"
               " && document.getElementById('toast').textContent") or ""
    record("stroke: second * is blocked with a toast",
           preedit() == before and ("通配" in str(toast) or "wildcard" in str(toast)),
           f"preedit={preedit()!r} toast={toast!r}")

    # ===== 分词 + 句子候选压后：h'z → 单字在前，「一乙」(☯) 压后 =====
    d.clear_field(kb)
    type_digits(geo, "195")
    time.sleep(0.8)
    cands = wait_candidates()
    record("stroke: h'z split query yields candidates",
           bool(cands), f"cands={cands[:6]}")
    record("stroke: sentence candidate is pushed back",
           bool(cands) and len(cands[0]) == 1 and "一乙" in cands
           and cands.index("一乙") > 0,
           f"cands={cands[:6]}")

    # ===== 空格确认=池头单字 =====
    d.clear_field(kb)
    type_digits(geo, "1")
    time.sleep(0.6)
    xs, ys = ev("""(() => { const s = document.getElementById('spaceKey');
        const r = s.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()""")
    sx, sy = css2phys((xs, ys))
    d.tap(sx, sy)
    time.sleep(0.6)
    field = (d.field_text_retry() or "").strip()
    record("stroke: space commits the head candidate", field == "一", f"field={field!r}")

    # ===== 组合中 8 键=','：提交高亮候选 + ，（probe 定论：十，）=====
    d.clear_field(kb)
    type_digits(geo, "12")
    time.sleep(0.8)
    cands = wait_candidates()
    head = cands[0] if cands else ""
    type_digits(geo, "8")
    time.sleep(0.6)
    field = (d.field_text_retry() or "").strip()
    record("stroke: comma commits head candidate + full-width comma",
           field == head + "，", f"head={head!r} field={field!r}")

    # ===== 上滑=字面数字（commitText 旁路）=====
    d.clear_field(kb)
    x5, y5 = geo["5"]
    d.clear_field(kb)
    d.synth_swipe(x5, y5, x5, y5 - 160)
    time.sleep(0.6)
    field = (d.field_text_retry() or "").strip()
    record("stroke: up-swipe commits literal 5", field == "5", f"field={field!r}")

    # ===== 长按三排浮层（同 T9）：小写 jkl / 、 5 ： / 大写 JKL，中格预选 =====
    d.clear_field(kb)
    if d.synth_touch("start", x5, y5) == "ok":
        time.sleep(0.65)  # holdMs 350 + 余量
        items = ev("[...document.querySelectorAll('#keyPopup .kp-item')]"
                   ".map(i => i.textContent)") or []
        rows = ev("[...document.querySelectorAll('#keyPopupInner .kp-row')].length")
        sel = ev("(() => { const s = document.querySelector('#keyPopup .kp-item.sel');"
                 " return s ? s.textContent : null; })()")
        record("stroke: long-press offers the T9-style three rows",
               items == ["j", "k", "l", "、", "5", "：", "J", "K", "L"] and rows == 3,
               f"cells={items} rows={rows}")
        record("stroke: middle digit cell is preselected", sel == "5", f"sel={sel!r}")
        # 松手不拖=点按同义：发 z（乙），数字不进引擎。
        d.synth_touch("end", x5, y5)
        time.sleep(0.5)
        record("stroke: popup release feeds the stroke code",
               preedit() == "乙", f"preedit={preedit()!r}")
    else:
        record("stroke: long-press offers the T9-style three rows", False, "synth_touch unavailable")

    # ===== 长按拖上排=小写字母 literal 直上屏（相对跟手，T9 同款）=====
    d.clear_field(kb)
    if d.synth_touch("start", x5, y5) == "ok":
        time.sleep(0.65)
        scale = d._DT_SCALE
        d.synth_touch("move", x5 - 34 * scale, y5 - 46 * scale)
        sel = ev("(() => { const s = document.querySelector('#keyPopup .kp-item.sel');"
                 " return s ? s.textContent : null; })()")
        d.synth_touch("end", x5 - 34 * scale, y5 - 46 * scale)
        time.sleep(0.5)
        field = (d.field_text_retry() or "").strip()
        record("stroke: up-left drag lands the lowercase letter literally",
               sel == "j" and field == "j", f"sel={sel!r} field={field!r}")
    else:
        record("stroke: up-left drag lands the lowercase letter literally", False, "synth_touch unavailable")

    # ===== 7 键=@#. 符号行：开/点选/工具栏复原 =====
    d.clear_field(kb)
    x7, y7 = geo["7"]
    d.tap(x7, y7)
    time.sleep(0.6)
    bar = d.devtools_candidates()
    record("stroke: 7 opens the western/technical symbol bar",
           "".join(bar) == "@#.*+-_/=", f"bar={bar}")
    record("stroke: toolbar yields to the symbol bar",
           ev("document.getElementById('setupButton').hidden") is True)
    d.tap(x7, y7)  # 再次点 7 维持展开（t9 语义：单击即开）；点选符号收尾
    time.sleep(0.3)
    pick = ev("""(() => { const b = [...document.querySelectorAll('#candidates .candidate')][0];
        if (!b) return 'no-cell'; b.click(); return b.textContent; })()""")
    time.sleep(0.5)
    field = (d.field_text_retry() or "").strip()
    record("stroke: symbol pick commits literally and closes the bar",
           pick == "@" and field == "@", f"pick={pick!r} field={field!r}")
    record("stroke: toolbar restores after the pick",
           ev("!document.getElementById('setupButton').hidden") is True)

    # ===== 汇总 =====
    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== stroke device gate: {len(RESULTS) - len(failed)}/{len(RESULTS)} PASS ==", flush=True)
    if failed:
        print("failures:", " | ".join(failed), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
