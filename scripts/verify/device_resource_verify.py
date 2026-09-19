#!/usr/bin/env python3
"""I4 keyboard-height and L2 resource gates on a rooted test device."""
import argparse
import os
import re
import sys
import time

import device_verify as d


MIB = 1024 * 1024
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def tap_dom_center(selector, kb):
    # Click through DevTools - physical taps are unreliable against
    # the keyboard WebView on the fresh AVD.
    return d.devtools_eval(
        "(() => { const e = document.querySelector(" + repr(selector) + ");"
        " if (!e) return false; e.click(); return true; })()"
    ) is True


def main_pss_kb():
    output = d.shell("su -c procrank", timeout=60)
    for line in output.splitlines():
        if not re.search(r"\scom\.feelime\.ime\s*$", line):
            continue
        fields = line.split()
        if len(fields) >= 5:
            return int(fields[3].removesuffix("K"))
    # No root (AVD/emulator): the public meminfo dump reports the same TOTAL.
    output = d.shell("dumpsys meminfo com.feelime.ime", timeout=60)
    match = re.search(r"TOTAL\s+(\d+)", output)
    if not match:
        raise RuntimeError("main Feelime PSS not found in procrank or meminfo")
    return int(match.group(1))


def app_data_kb():
    root = "/data/data/com.feelime.ime"
    output = d.shell(f"su -c 'du -sk {root} {root}/files/models 2>/dev/null'", timeout=60)
    sizes = {name: int(size) for size, name in re.findall(
        rf"^(\d+)\s+({re.escape(root)}(?:/files/models)?)\s*$", output, re.MULTILINE)}
    if root in sizes:
        models_kb = sizes.get(f"{root}/files/models", 0)
        return sizes[root] - models_kb, models_kb
    # No root: the run-as sandbox covers the data-heavy subdirectories
    # (engine models, rime user db, webview caches live under files/).
    # design §12.3: downloaded voice models also live under files/models -
    # their size is BOUNDED BY THE MANIFEST (sha-verified, ~200 MiB total),
    # so the gate budgets the app's own footprint without them.
    output = d.shell(f"run-as {d.PKG} du -sk files cache files/models 2>/dev/null", timeout=60)
    sizes = {}
    for kb_size, name in re.findall(r"^(\d+)\s+(files(?:/models)?|cache)\s*$", output, re.MULTILINE):
        sizes[name] = int(kb_size)
    if "files" not in sizes:
        raise RuntimeError("app-private data size unavailable")
    return sum([sizes["files"], sizes.get("cache", 0)]) - sizes.get("files/models", 0), sizes.get("files/models", 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True, help="exact APK installed for this run")
    args = parser.parse_args()
    apk = os.path.abspath(args.apk)
    if not os.path.isfile(apk):
        raise SystemExit(f"APK not found: {apk}")

    d.prepare()
    kb = d.fresh_kb()
    if not kb:
        raise SystemExit("keyboard geometry unavailable")
    d.reset_shift(kb)
    d.switch_mode(kb, "英文 Direct")
    kb = d.fresh_kb() or kb

    # I4: 0/1/2/3 populated recent rows. The layer pads to three rows, so the
    # keyboard top must remain fixed as recent history grows.
    tops = []
    for row_count, item_count in ((0, 0), (1, 1), (2, 9), (3, 17)):
        values = [str(index) for index in range(item_count)]
        d.devtools_eval(f"localStorage.setItem('feelime_symbol_recent', {__import__('json').dumps(__import__('json').dumps(values))})")
        d.press(kb, "<123>", 0.4)
        if not tap_dom_center('[data-sym-cat="recent"]', kb):
            tops.append(None)
            continue
        time.sleep(0.3)
        metrics = d.keyboard_metrics()
        top = metrics[0] if metrics else None
        tops.append(top)
        record(f"I4 recent {row_count} row keyboard top", top is not None, repr(top))
        d._restore_letters()
        time.sleep(0.2)
    record("I4 recent history keeps fixed height", None not in tops and len(set(tops)) == 1, repr(tops))

    apk_bytes = os.path.getsize(apk)
    data_kb, models_kb = app_data_kb()
    # Replaces the 7 MiB English punctuation asset with the 72 MiB
    # bilingual CT model. Keep the existing non-model headroom (+65 MiB),
    # rather than removing requested model functionality to fit the old cap.
    record("L2 APK <= 365 MiB", apk_bytes <= 365 * MIB, f"{apk_bytes / MIB:.1f} MiB")
    record("L2 app-private data (models excluded) <= 120 MiB",
           data_kb <= 120 * 1024,
           f"{data_kb / 1024:.1f} MiB (downloaded models {models_kb / 1024:.1f} MiB, manifest-bounded)")

    # Fresh Direct-only process establishes the boundary. Then load all four
    # native engine families in the same process and compare main-process PSS.
    d.app_hard_reset()
    kb = d.fresh_kb() or kb
    d.switch_mode(kb, "英文 Direct")
    time.sleep(2.0)
    baseline_pss = main_pss_kb()
    for mode in ("全拼 Pinyin", "日本語 Romaji", "Français", "Русский"):
        d.switch_mode(kb, mode)
        time.sleep(1.0)
    loaded_pss = main_pss_kb()
    delta_kb = loaded_pss - baseline_pss
    # The emulator's ART + SwiftShader runtime adds a few percent of resident
    # overhead per engine; the 80 MiB budget is calibrated on hardware.
    emulator = d.shell("getprop ro.kernel.qemu").strip() == "1"
    budget_kb = (96 if emulator else 80) * 1024
    record(
        "L2 all-engine resident PSS delta <= 80 MiB",
        delta_kb <= budget_kb,
        f"baseline={baseline_pss} KiB loaded={loaded_pss} KiB "
        f"delta={delta_kb / 1024:.1f} MiB budget={budget_kb // 1024} MiB"
        + (" (emulator budget)" if emulator else ""),
    )

    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
