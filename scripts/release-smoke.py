#!/usr/bin/env python3
"""release 真机冒烟（自动化，v1.4.10 手工冒烟的脚本化）。

为什么存在（发版 15 分钟改造，codex 方案 2026-11-15）：release 包无 CDP
（BuildConfig.DEBUG=false 关调试口），冒烟只能 uiautomator+截图；手工导航
+截图找坐标一轮 ~8min。本脚本固化 v1.4.10 实操配方：

  1. sha 三方链：本地 APK → nginx share 中转 → 设备文件（三方一致才装）
  2. thin 覆盖安装 + versionName 断言（升级路径）
  3. 打字冒烟：设置页「输入测试」导航（uiautomator 找入口，不写死列表
     坐标）→ tap textarea 唤键盘 → 硬编码键位表打 nihao → 空格上屏 →
     dump 断言 EditText 文本（宽松：组合残留或上屏成功都算链路活，
     commitText 后 a11y 文本滞后是已知坑，另存截图供人工复核）
  4. full 覆盖安装 + versionName + logcat 查 ORT/sherpa 引擎 init
  5. 产出：--verify-sha 用的 sha 清单 + 冒烟日志 + 截图目录

用法（宿主侧）：
  FEELIME_SMOKE_ADB="ssh ace-adb adb -s 127.0.0.1:5555" \
  python3 scripts/release-smoke.py --ver 1.4.10 \
      --thin <path>/feelime-v1.4.10-thin.apk \
      --full <path>/feelime-v1.4.10-full.apk \
      --share-url http://gpu.x.felix021.cn/share --share-dir ~/docker/nginx/html/share

键位表当前按 ace（1080×2412，qwerty 竖屏全拼）实测坐标硬编码；分辨率
不符直接拒绝（换设备先实测坐标再扩展表）。手写/语音深验证不在本脚本
（周回归+人工面），本脚本只保「R8 后输入链路活着」。
"""
import argparse
import hashlib
import pathlib
import subprocess
import sys
import time

# ace 1080×2412 实测键位（v1.4.10 冒烟实录；显示坐标×1.205=物理）
KEYS_1080x2412 = {
    "a": (213, 2040), "h": (658, 2040), "i": (836, 2040), "o": (925, 2040),
    "n": (710, 2190), "space": (540, 2340),
}
RESOLUTIONS = {(1080, 2412): KEYS_1080x2412}


def adb(adbcmd, *args, timeout=120):
    cmd = adbcmd.split() + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def must(adbcmd, *args, **kw):
    rc, out, err = adb(adbcmd, *args, **kw)
    if rc != 0:
        sys.exit(f"REJECT: adb {' '.join(args)} failed rc={rc}: {err or out}")
    return out


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ui_dump(adbcmd, tmp="/tmp/smoke-ui.xml"):
    must(adbcmd, "shell", "uiautomator", "dump", tmp)
    return must(adbcmd, "shell", "cat", tmp)


def find_node_bounds(xml, text_contains):
    import re
    for m in re.finditer(r'<node [^>]*text="([^"]*)"[^>]*bounds="(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])"', xml):
        if text_contains in m.group(1):
            xs = re.findall(r"[0-9]+", m.group(2))
            x = (int(xs[0]) + int(xs[2])) // 2
            y = (int(xs[1]) + int(xs[3])) // 2
            return x, y
    return None


def screenshot(adbcmd, outdir, name):
    # exec-out 的二进制经 text 管道会毁 PNG——落设备文件再 pull（exec-out
    # 损 PNG 的老坑，memory release-smoke-forensics）
    must(adbcmd, "shell", "screencap", "-p", f"/sdcard/{name}.png")
    must(adbcmd, "pull", f"/sdcard/{name}.png", str(outdir / f"{name}.png"))
    must(adbcmd, "shell", "rm", "-f", f"/sdcard/{name}.png")
    print(f"  shot: {outdir / (name + '.png')}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ver", required=True)
    p.add_argument("--thin", required=True, type=pathlib.Path)
    p.add_argument("--full", required=True, type=pathlib.Path)
    p.add_argument("--share-url", required=True, help="nginx share 的 URL 前缀")
    p.add_argument("--share-dir", required=True, type=pathlib.Path, help="nginx share 的本地目录")
    p.add_argument("--adb", default="adb -s emulator-5554")
    p.add_argument("--remote-cmd", default="ssh ace-adb",
                   help="在设备侧宿主执行命令的方式（wget 用）")
    p.add_argument("--out", default=pathlib.Path("~/tmp/release-smoke").expanduser())
    args = p.parse_args()
    adbcmd = args.adb

    for apk in (args.thin, args.full):
        if not apk.is_file():
            sys.exit(f"REJECT: missing {apk}")
    args.out.mkdir(parents=True, exist_ok=True)

    # ---- 0. 分辨率与键位表 ----
    size = must(adbcmd, "shell", "wm", "size")  # "Physical size: 1080x2412"
    wh = size.split(":")[-1].strip().split("x")
    keymap = RESOLUTIONS.get((int(wh[0]), int(wh[1])))
    if not keymap:
        sys.exit(f"REJECT: unsupported resolution {size.strip()} — add a measured keymap first")

    # ---- 1. thin：sha 三方链 + 安装 ----
    thin_sha = sha256_of(args.thin)
    stage = args.share_dir / f"rel-smoke-{int(time.time())}"
    stage.mkdir(parents=True, exist_ok=True)
    remote_dir = f"{stage.name}"
    must_local = subprocess.run(["cp", str(args.thin), str(stage / args.thin.name)])
    if must_local.returncode != 0:
        sys.exit("REJECT: cp to share failed")
    url = f"{args.share_url}/{remote_dir}/{args.thin.name}"
    wget = args.remote_cmd.split() + [
        f"wget --no-proxy -q -O /tmp/smoke.apk {url} && sha256sum /tmp/smoke.apk"]
    r = subprocess.run(wget, capture_output=True, text=True, timeout=600)
    dev_sha = (r.stdout.split()[0] if r.stdout else "")
    if dev_sha != thin_sha:
        sys.exit(f"REJECT: device-side sha mismatch local={thin_sha[:12]} remote={dev_sha[:12]}")
    print(f"sha chain OK (thin {thin_sha[:12]})")
    print(must(adbcmd, "install", "-r", "/tmp/smoke.apk"))

    ver = must(adbcmd, "shell", "dumpsys", "package", "com.feelime.ime")
    if f"versionName={args.ver}" not in ver:
        sys.exit(f"REJECT: versionName != {args.ver}")

    # ---- 2. 打字冒烟 ----
    must(adbcmd, "shell", "am", "force-stop", "com.feelime.ime")
    time.sleep(1)
    must(adbcmd, "shell", "am", "start", "-n",
         "com.feelime.ime/com.feelime.ime.SetupActivity")
    time.sleep(2.5)
    pos = None
    for _ in range(6):
        xml = ui_dump(adbcmd)
        pos = find_node_bounds(xml, "输入测试")
        if pos:
            break
        must(adbcmd, "shell", "input", "swipe", "540", "1800", "540", "1000", "300")
        time.sleep(0.8)
    if not pos:
        screenshot(adbcmd, args.out, "no-test-entry")
        sys.exit("REJECT: 输入测试 entry not found")
    must(adbcmd, "shell", "input", "tap", str(pos[0]), str(pos[1]))
    time.sleep(1.5)
    xml = ui_dump(adbcmd)
    ta = find_node_bounds(xml, "点这里唤起") or find_node_bounds(xml, "Feelime")
    if not ta:
        screenshot(adbcmd, args.out, "no-textarea")
        sys.exit("REJECT: testInput textarea not found")
    must(adbcmd, "shell", "input", "tap", str(ta[0]), str(ta[1]))
    time.sleep(2)
    for ch in "nihao":
        x, y = keymap[ch]
        must(adbcmd, "shell", "input", "tap", str(x), str(y))
        time.sleep(0.25)
    screenshot(adbcmd, args.out, f"typing-{args.ver}")
    sx, sy = keymap["space"]
    must(adbcmd, "shell", "input", "tap", str(sx), str(sy))
    time.sleep(1.2)
    xml = ui_dump(adbcmd)
    field = None
    import re
    for m in re.finditer(r'<node [^>]*class="android.widget.EditText"[^>]*text="([^"]*)"', xml):
        field = m.group(1)
    ok = field and ("你好" in field or "nihao" in field)
    print(f"typing smoke: field={field!r} -> {'PASS' if ok else 'CHECK SCREENSHOT'}")
    screenshot(adbcmd, args.out, f"typed-{args.ver}")
    must(adbcmd, "shell", "input", "keyevent", "4")  # 收键盘
    time.sleep(0.8)

    # ---- 3. full：覆盖安装 + 引擎 init ----
    full_sha = sha256_of(args.full)
    subprocess.run(["cp", str(args.full), str(stage / args.full.name)], check=True)
    url = f"{args.share_url}/{remote_dir}/{args.full.name}"
    wget = args.remote_cmd.split() + [
        f"wget --no-proxy -q -O /tmp/smoke.apk {url} && sha256sum /tmp/smoke.apk"]
    r = subprocess.run(wget, capture_output=True, text=True, timeout=1200)
    dev_sha = (r.stdout.split()[0] if r.stdout else "")
    if dev_sha != full_sha:
        sys.exit(f"REJECT: full sha mismatch local={full_sha[:12]} remote={dev_sha[:12]}")
    must(adbcmd, "shell", "input", "keyevent", "4")
    time.sleep(0.5)
    print(must(adbcmd, "install", "-r", "/tmp/smoke.apk"))
    must(adbcmd, "shell", "am", "force-stop", "com.feelime.ime")
    time.sleep(1)
    must(adbcmd, "shell", "logcat", "-c")
    must(adbcmd, "shell", "am", "start", "-n",
         "com.feelime.ime/com.feelime.ime.SetupActivity")
    time.sleep(6)
    log = must(adbcmd, "shell", "logcat", "-d", "-s",
               "FeelimeEngine", "onnxruntime", "sherpa")
    engine_ok = bool(log.strip())
    print(f"engine init log: {'PASS' if engine_ok else 'NO LOG LINES (check manually)'}")

    # ---- 4. 清理 + sha 清单 ----
    subprocess.run(["rm", "-rf", str(stage)], check=True)
    remote_cmd = args.remote_cmd.split() + ["rm -f /tmp/smoke.apk"]
    subprocess.run(remote_cmd, capture_output=True)
    sha_list = args.out / "sha-list.txt"
    sha_list.write_text(
        f"{thin_sha}  feelime-v{args.ver}-thin.apk\n"
        f"{full_sha}  feelime-v{args.ver}-full.apk\n")
    print(f"sha list: {sha_list}")
    print("SMOKE DONE (typing/engine verdicts above; screenshots for human review)")


if __name__ == "__main__":
    main()
