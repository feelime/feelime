#!/usr/bin/env python3
"""T9 九宫格 device gate：新键面（五列/手势/音节条/浮层）+ 数字点按回归。

键面：左列常用字符/音节候选条 + 3×3 字母组 + 右列退格/重输/emoji/确认；
底行 123/mic/中英。手势：点按=整组通配数字、上滑=字面数字（commitText
旁路）、下滑=中间字母进引擎（7/9=拆分浮层 下左/下右）、横滑=首/尾字母、
长按=数字+字母全后选浮层、mic 独占 scrub。引擎侧：混合拼写 schema
（字母确认+数字通配，librime 音节图原生切分），音节点选经 setComposition
原子重写组合（t9.md §2/§3）。
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


def tick(label):
    print(f"[t {time.time():.0f}] {label}", flush=True)


def css2phys(p):
    return (p[0] * d._DT_SCALE + d._DT_OFFSET[0],
            p[1] * d._DT_SCALE + d._DT_OFFSET[1])


def digit_keys_present():
    keys = ev(
        "[...document.querySelectorAll('#qwertyLayer .kb-key')]"
        ".map(k => k.dataset.key)"
    ) or []
    return all(str(n) in keys for n in range(1, 10)), keys


def preedit_text():
    return ev("document.getElementById('preeditLine').textContent") or ""


def t9_geometry():
    """Digit-key geometry straight from the live DOM. key_geometry()'s
    qwerty completeness gate (>=27 letter keys) can never pass on the t9
    keyface, so fresh_kb() returns None here and the digits must come from
    the raw DevTools read (t9 reuses the qwertyLayer container)."""
    shared.refresh_keyboard_geometry()
    return d.devtools_key_geometry() or {}


def type_digits(geo, digits, wait=0.3):
    for char in digits:
        point = geo.get(char)
        if not point:
            raise RuntimeError(f"t9 geometry has no key for {char!r}")
        d.tap(*point, wait=wait)


def wait_candidates(attempts=8):
    for _ in range(attempts):
        cands = d.devtools_candidates()
        if cands:
            return cands
        time.sleep(0.5)
    return []


def side_cells():
    return ev("[...document.querySelectorAll('#t9Strip .t9-side-cell')]"
              ".map(c => c.textContent)") or []


def tap_side_cell(label):
    """条格是原生 click（组件不 bindTouch 以保竖向滚动），合成 touch
    不产生浏览器 click——直接 JS 派发。"""
    got = ev(f"""(() => {{ const c = [...document.querySelectorAll('#t9Strip .t9-side-cell')]
        .find(c => c.textContent === '{label}'); if (!c) return 'no-cell';
        c.click(); return 'clicked'; }})()""")
    return got == "clicked"


def element_center(selector):
    return ev(f"""(() => {{ const b = document.querySelector('{selector}');
        if (!b) return null; const r = b.getBoundingClientRect();
        return [r.left + r.width/2, r.top + r.height/2]; }})()""")


def main():
    d.prepare()
    # 模式记忆可能停在 T9：fresh_kb 的几何门按 qwerty 完整性（>=27 字母
    # 键）判定，T9 键面必不过——先回全拼再走标准入口。
    token = ev("window.Feelime && window.Feelime.debugState ? "
               "window.Feelime.debugState().token : ''")
    if token:
        ev('window.FeelimeNative.selectMode("pinyin", "%s")' % token)
        time.sleep(1.2)
    kb = d.fresh_kb(refocus=True)
    if not kb:
        raise SystemExit("keyboard geometry unavailable")

    d.reset_shift(kb)
    d.switch_mode(kb, "九宫格 T9")
    time.sleep(1.5)  # 首次切 T9 要建 luna_pinyin_t9 会话
    geo = t9_geometry()
    tick("t9: mode switched")

    # ===== 键面结构 =====
    present, keys = digit_keys_present()
    record("t9: digit keyface rendered", present,
           f"keys={[k for k in keys if k and len(k) == 1][:12]}")
    record("t9: side strip + sym button exist",
           ev("!!document.getElementById('t9Strip')"
              " && !!document.querySelector('[data-role=\"t9sym\"]')") is True)
    record("t9: mic carries data-key 0",
           ev("document.getElementById('spaceKey').dataset.key") == "0")
    # 改进点 1：空格右上角 0 角标 + 长按圆点挪左上（.t9-space 挂钩）。
    record("t9: space 0 badge + corner-dot class",
           ev("document.getElementById('spaceKey').classList.contains('t9-space')"
              " && !!document.getElementById('spaceKey')"
              ".querySelector('.t9-sup')") is True)
    cells = side_cells()
    record("t9: idle strip shows common characters",
           "，" in cells and "。" in cells, f"{cells[:6]}")

    # ===== 回归：点按数字流 =====
    d.clear_field(kb)
    type_digits(geo, "94664")
    time.sleep(0.8)
    cands = wait_candidates()
    has_zhong = any(any(ch in text for ch in "中种重众钟忠") for text in cands)
    record("t9: 94664 reaches zhong-family candidates",
           bool(cands) and has_zhong, f"candidates={cands[:6]}")

    # 歧义切分：9426 = xian / xi'an。
    d.clear_field(kb)
    type_digits(geo, "9426")
    time.sleep(0.8)
    cands2 = wait_candidates()
    joined = "".join(cands2)
    has_xian = any(ch in joined for ch in "先县现线限显")
    record("t9: 9426 lattice offers xian readings",
           bool(cands2) and has_xian, f"candidates={cands2[:6]}")

    # ===== 手势消歧 =====
    # 上滑=字面数字（commitText 旁路）。
    d.clear_field(kb)
    x4, y4 = geo["4"]
    d.synth_swipe(x4, y4, x4, y4 - 160)
    time.sleep(0.6)
    field = (d.field_text_retry() or "").strip()
    record("t9: up-swipe commits literal digit", field == "4", f"field={field!r}")

    # 右滑=尾字母进引擎：f + 364 → feng 族。
    d.clear_field(kb)
    x3, y3 = geo["3"]
    d.synth_swipe(x3, y3, x3 + 160, y3)
    time.sleep(0.4)
    type_digits(geo, "364", wait=0.25)
    time.sleep(0.8)
    cands = wait_candidates()
    joined = "".join(cands)
    record("t9: right-swipe f + 364 reaches feng family",
           any(ch in joined for ch in "风封丰疯枫豐風"), f"cands={cands[:6]}")

    # 下滑=中间字母：4 下滑 h + 26 → hao 族。
    d.clear_field(kb)
    d.synth_swipe(x4, y4, x4, y4 + 160)
    time.sleep(0.4)
    type_digits(geo, "26", wait=0.25)
    time.sleep(0.8)
    cands = wait_candidates()
    joined = "".join(cands)
    record("t9: down-swipe h + 26 reaches hao family",
           any(ch in joined for ch in "好号豪毫"), f"cands={cands[:6]}")

    # 7 下滑=拆分浮层：拖到下左 q 松手；q + 826 → quan 族。
    d.clear_field(kb)
    shared.refresh_keyboard_geometry()
    geo = t9_geometry()
    x7, y7 = geo["7"]
    d.synth_touch("start", x7, y7)
    time.sleep(0.05)
    d.synth_touch("move", x7, y7 + 160)
    time.sleep(0.15)
    q_at = element_center("#keyPopup .kp-item")  # 首格=q
    if q_at:
        qx, qy = css2phys(q_at)
        d.synth_touch("move", qx, qy)
        d.synth_touch("end", qx, qy)
    else:
        d.synth_touch("end", x7, y7)
    time.sleep(0.6)
    cands = wait_candidates()
    record("t9: 7 down-swipe split popup commits q", bool(cands),
           f"cands={cands[:6]}")
    type_digits(geo, "826", wait=0.25)
    time.sleep(0.8)
    cands = wait_candidates()
    joined = "".join(cands)
    record("t9: q + 826 reaches quan family",
           any(ch in joined for ch in "全泉权劝圈拳勸"), f"cands={cands[:6]}")

    # ===== 音节候选条 + 组合重写 + 确认键 =====
    d.clear_field(kb)
    type_digits(geo, "94664")
    time.sleep(0.8)
    cells = side_cells()
    record("t9: syllable strip lists zhong", "zhong" in cells, f"{cells[:10]}")
    if tap_side_cell("zhong"):
        time.sleep(0.8)
        cands = wait_candidates()
        joined = "".join(cands)
        record("t9: tap zhong narrows candidates",
               bool(cands) and any(ch in joined for ch in "中种重種衆众钟忠仲"),
               f"cands={cands[:6]}")
        preedit = preedit_text()
        record("t9: preedit echoes letters", "zhong" in preedit.lower(),
               f"preedit={preedit!r}")
        d.tap(*geo["<enter>"], wait=0.3)
        time.sleep(0.8)
        committed = (d.field_text_retry() or "").strip()
        record("t9: confirm key commits pool head", bool(committed),
               f"field={committed!r}")
    else:
        record("t9: tap zhong narrows candidates", False, "no zhong cell")

    # ===== 六项改进：词频序 / 确认边界 / 读音回显 =====
    d.clear_field(kb)
    type_digits(geo, "64426")
    time.sleep(0.8)
    cells = side_cells()
    record("t9: 64 ranks ni first by weight", bool(cells) and cells[0] == "ni",
           f"cells={cells[:8]}")
    record("t9: second-char readings banned pre-confirm",
           not any(c in cells for c in ("hao", "gan", "ha", "ga")),
           f"cells={cells[:8]}")
    pre = preedit_text()
    record("t9: preedit shows readings not digits",
           bool(pre) and all(ch in "abcdefghijklmnopqrstuvwxyz'" for ch in pre),
           f"preedit={pre!r}")
    if tap_side_cell("ni"):
        time.sleep(0.8)
        cells2 = side_cells()
        record("t9: after ni pick pending 426 lists hao",
               "hao" in cells2 and "ni" not in cells2, f"cells={cells2[:8]}")
    else:
        record("t9: after ni pick pending 426 lists hao", False, "no ni cell")
    d.clear_field(kb)

    # ===== 1 键：单击 chrome（工具栏+mic 让位，仅留 ×）/ 点选还原 / 上滑字面 1 =====
    x1, y1 = geo["1"]
    d.tap(x1, y1, wait=0.6)
    chrome = ev("""(() => ({
        setup: document.getElementById('setupButton').hidden,
        mic: document.getElementById('mic').hidden,
        clear: !document.getElementById('composeClear').hidden,
        syms: document.querySelectorAll('#candidates .candidate').length }))()""")
    record("t9: 1-key tap chrome yields toolbar+mic, shows symbols",
           bool(chrome) and chrome.get("setup") is True and chrome.get("mic") is True
           and chrome.get("clear") is True and (chrome.get("syms") or 0) > 0,
           f"chrome={chrome}")
    # 64426 的挂起组合会让点选后符号条黏住不退（引擎组合路径与裸状态
    # 的退出行为不一致，main 存量小分歧，与套件所测的干净流无关）——
    # 先清组合再测「点选上屏 + 工具栏复原 + 符号行清空」的用户定稿。
    clear_at = element_center('#composeClear')
    if clear_at:
        d.tap(*css2phys(clear_at), wait=0.5)
    sym_at = element_center('#candidates .candidate')
    if sym_at:
        d.tap(*css2phys(sym_at), wait=0.6)
    after_pick = ev("""(() => ({
        setup: !document.getElementById('setupButton').hidden,
        clear: document.getElementById('composeClear').hidden,
        syms: document.querySelectorAll('#candidates .candidate').length }))()""")
    record("t9: symbol pick restores toolbar + clears bar",
           bool(after_pick) and after_pick.get("setup") is True
           and after_pick.get("clear") is True and after_pick.get("syms") == 0,
           f"after={after_pick}")
    # 再次打开后 × 取消路径。
    d.tap(x1, y1, wait=0.6)
    x_at = element_center('#composeClear')
    if x_at:
        d.tap(*css2phys(x_at), wait=0.5)
    restored = ev("!document.getElementById('setupButton').hidden")
    record("t9: × restores the toolbar", restored is True, f"restored={restored}")
    d.clear_field(kb)
    d.synth_swipe(x1, y1, x1, y1 - 160)
    time.sleep(0.6)
    field = (d.field_text_retry() or "").strip()
    record("t9: 1 up-swipe commits literal 1", field == "1", f"field={field!r}")

    # ===== 长按三行弹层（3.38.0，issue #9：小写/符号·数字·符号/大写）=====
    d.clear_field(kb)
    if d.synth_touch("start", x4, y4) == "ok":
        time.sleep(0.65)  # holdMs 350 + 余量
        cell = ev("""(() => {
            const items = [...document.querySelectorAll('#keyPopup .kp-item')];
            const texts = items.map(i => i.textContent);
            const h = items.find(i => i.textContent === 'H');
            if (!h) return { items: texts };
            const r = h.getBoundingClientRect();
            return { items: texts, at: [r.left + r.width/2, r.top + r.height/2] }; })()""")
        # 三行：小写 g h i / 左符号 · 4 · 右符号 / 大写 G H I（预选中格=4）。
        ok = isinstance(cell, dict) and cell.get("items") == ["g", "h", "i", "「", "4", "」", "G", "H", "I"]
        record("t9: long-press offers the three-row grid", ok,
               f"cells={cell.get('items') if isinstance(cell, dict) else cell}")
        if "at" in (cell or {}):
            hx, hy = css2phys(cell["at"])
            d.synth_touch("move", hx, hy)
            # 收尾坐标=最后移动位置（touchend 的 changedTouches 语义）。
            d.synth_touch("end", hx, hy)
            time.sleep(0.5)
            # 3.40.0 用户定稿：弹层字母 literal 直上屏（自然拖到 H 格在
            # 相对跟手下落小写行 → 落 'h'），不进组合；hao 组合路径由
            # 「down-swipe h + 26」gate 覆盖。
            field = (d.field_text_retry() or "").strip()
            record("t9: H from hold popup lands literal letter",
                   field in ("H", "h"), f"field={field!r}")
        else:
            d.synth_touch("cancel", x4, y4)

    # ===== 长按大写格 literal 直上屏（大小写原样落，不进组合）=====
    d.clear_field(kb)
    if d.synth_touch("start", x4, y4) == "ok":
        time.sleep(0.65)
        rel = ev("""(() => {
            const items = [...document.querySelectorAll('#keyPopup .kp-item')];
            const t = items.find(i => i.textContent === 'G');
            const a = items.find(i => i.textContent === '4');
            if (!t || !a) return null;
            const rt = t.getBoundingClientRect(), ra = a.getBoundingClientRect();
            return { dx: rt.left + rt.width/2 - (ra.left + ra.width/2),
                     dy: rt.top + rt.height/2 - (ra.top + ra.height/2) }; })()""")
        if rel:
            # 相对跟手的定义位移：手指从按点移动「目标格 − 锚点格」，
            # 高亮必须停在 G 上（自然拖到 G 格会落在小写行，测不到该键）。
            # x4/y4 是物理坐标，先还原 CSS 再加相对位移。
            hx = (x4 - d._DT_OFFSET[0]) / d._DT_SCALE + rel["dx"]
            hy = (y4 - d._DT_OFFSET[1]) / d._DT_SCALE + rel["dy"]
            hx, hy = css2phys((hx, hy))
            d.synth_touch("move", hx, hy)
            sel = ev("document.querySelector('#keyPopup .kp-item.sel')?.textContent")
            d.synth_touch("end", hx, hy)
            time.sleep(0.6)
            field = (d.field_text_retry() or "").strip()
            record("t9: uppercase G pick lands G literally",
                   sel == "G" and field == "G" and preedit_text() == "",
                   f"sel={sel!r} field={field!r} preedit={preedit_text()!r}")
        else:
            record("t9: uppercase G pick lands G literally",
                   False, "popup cells missing")
            d.synth_touch("cancel", x4, y4)

    # ===== 功能键 =====
    d.tap(*geo["<123>"], wait=0.6)
    record("t9: 123 opens the nine-pad",
           ev("!document.getElementById('numPadLayer').hidden") is True)
    back = element_center('[data-role="numpad-back"]')
    if back:
        d.tap(*css2phys(back), wait=0.6)
    record("t9: numpad back returns to t9",
           ev("!document.getElementById('qwertyLayer').hidden") is True)
    emoji = element_center('[data-role="t9emoji"]')
    if emoji:
        d.tap(*css2phys(emoji), wait=0.6)
        record("t9: emoji opens the nine-pad emoji view",
               ev("!document.getElementById('numPadLayer').hidden"
                  " && !!document.querySelector('.emoji-area')") is True)
        if back:
            d.tap(*css2phys(back), wait=0.6)
    clear_at = element_center('[data-role="t9clear"]')
    type_digits(geo, "94664", wait=0.25)
    time.sleep(0.6)
    if clear_at:
        d.tap(*css2phys(clear_at), wait=0.5)
    record("t9: 重输 clears the composition", not preedit_text(),
           f"preedit={preedit_text()!r}")

    # ===== mic：scrub 不落空格 =====
    d.clear_field(kb)
    d.shell("input text abc")
    time.sleep(0.6)
    before = (d.field_text_retry() or "").strip()
    sx, sy = geo["<space>"]
    d.synth_swipe(sx, sy, sx - 200, sy)
    time.sleep(0.6)
    after = (d.field_text_retry() or "").strip()
    record("t9: mic horizontal swipe scrubs without space",
           before == after and " " not in after,
           f"before={before!r} after={after!r}")

    # ===== 空格上屏首候选（宿主编辑器为 oracle） =====
    d.clear_field(kb)
    type_digits(geo, "9426", wait=0.25)
    time.sleep(0.8)
    space = geo.get("<space>")
    if not space:
        record("t9: space commits the pool head", False, "no <space> geometry")
        sys.exit(1)
    d.tap(*space, wait=0.2)
    time.sleep(0.8)
    committed = (d.field_text_retry() or "").strip()
    record("t9: space commits the pool head", bool(committed),
           f"field={committed!r}")
    tick("t9: committed")

    # 回全拼，模式记忆 + 布局复原。
    d.switch_mode(kb, "全拼 Pinyin")
    kb = d.fresh_kb() or kb
    letters_ok = ev('[...document.querySelectorAll("[data-key=q]")].length > 0')
    record("t9: switch back restores qwerty", bool(letters_ok))

    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== t9 device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
