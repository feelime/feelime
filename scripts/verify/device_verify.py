#!/usr/bin/env python3
"""Feelime on-device functional verification (verification-plan.md DEV-A cases).

Drives the IME over adb on device A (PLK110). The assertion oracle is the
native EditText inside SetupActivity, read via uiautomator dump; keyboard
geometry is derived from screenshots by detecting the dark key grid.
"""
import re
import shlex
import subprocess
import sys
import time

# no real serial/host defaults in the repo; the caller must provide
# the target explicitly (a wrong default silently hitting the user's own
# phone is worse than failing fast).
SERIAL = __import__("os").environ.get("FEELIME_ADB_SERIAL", "")
if not SERIAL:
    raise SystemExit("FEELIME_ADB_SERIAL is required (adb serial of the test device)")


def _resolve_pkg():
    """debug 构建带 .dev 包名后缀（与 Play 正式包共存）：FEELIME_PKG 显式
    指定 > 设备上装了 .dev 就测 .dev（套件的日常对象是 debug 迭代包）>
    回落正式包名（报错路径与旧行为一致）。正式包冒烟时显式
    FEELIME_PKG=com.feelime.ime。"""
    import os as _os
    import subprocess as _sp
    explicit = _os.environ.get("FEELIME_PKG", "").strip()
    if explicit:
        return explicit
    try:
        out = _sp.run(["adb", "-s", SERIAL, "shell", "pm list packages"],
                      capture_output=True, timeout=15).stdout.decode()
        if "package:com.feelime.ime.dev\n" in out:
            return "com.feelime.ime.dev"
    except Exception:
        pass
    return "com.feelime.ime"


PKG = _resolve_pkg()
KEY_BG = (0x5F, 0x5F, 0x5F)
SPECIAL_BG = (0x41, 0x41, 0x41)
RESULTS = []


def adb(*args, timeout=30):
    out = subprocess.run(
        ["adb", "-s", SERIAL, *args], capture_output=True, timeout=timeout
    )
    if b"not found" in out.stderr:
        # Flaky link: reconnect once and retry.
        subprocess.run(["adb", "connect", SERIAL], capture_output=True, timeout=15)
        time.sleep(1)
        out = subprocess.run(
            ["adb", "-s", SERIAL, *args], capture_output=True, timeout=timeout
        )
    return out.stdout


def shell(cmd, timeout=30):
    return adb("shell", cmd, timeout=timeout).decode("utf-8", "replace")


# ------------------------------------------------------------ devtools oracle
DEVTOOLS_PORT = __import__("os").environ.get("FEELIME_DEVTOOLS_PORT", "9223")


_DT_SOCKET = None
_DT_PID = None
_DT_ID = 1
_DT_OFFSET = (0, 0)
_DT_SCALE = 1.0
# Native pixel width of the live DevTools WebView target.  This can be
# narrower than `wm size` on a landscape display with a cutout or hinge.
_DT_VIEW_WIDTH = 0


def _attached_target(page):
    """Detached WebViews can retain full geometry and answer stale queries."""
    import json
    try:
        description = json.loads(page.get("description", "{}"))
    except (ValueError, TypeError):
        return True
    return description.get("attached") is not False


def _dt_handshake(ws_url):
    """Open a raw DevTools websocket for one page target (None on failure)."""
    import base64
    import socket as _socket

    host_port = ws_url.split("//")[1].split("/")[0]
    host, port = host_port.split(":")
    try:
        sock = _socket.create_connection((host, int(port)), timeout=10)
    except OSError:
        return None
    sock.settimeout(10)  # recv MUST time out: a half-open socket during IME
    # window teardown would otherwise block the suite forever .
    key = base64.b64encode(__import__("os").urandom(16)).decode()
    sock.sendall(
        (
            f"GET {ws_url.split(host_port)[1]} HTTP/1.1\r\nHost: {host_port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        ).encode()
    )
    try:
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = sock.recv(4096)
            if not chunk:
                raise OSError("peer closed during handshake")
            head += chunk
    except OSError:
        sock.close()
        return None
    return sock


def _dt_connect():
    """One persistent DevTools websocket per process (reconnects on pid change).

    The IME can recreate its WebView inside one process; the replaced page
    lingers in /json/list as a zombie that answers DOM queries with stale
    state and zero layout rects. Try feelime.local pages newest-first and
    keep the first one whose root element has real layout."""
    global _DT_SOCKET, _DT_PID, _DT_OFFSET, _DT_SCALE, _DT_VIEW_WIDTH
    import json as _json

    # Read pidof once. The process can disappear between two ADB round-trips;
    # the old double-call form could pass the first condition and then index
    # an empty second result.
    pid_output = shell(f"pidof {PKG}").strip().split()
    pid = pid_output[0] if pid_output else ""
    if not pid:
        return None
    if _DT_SOCKET is not None and pid == _DT_PID:
        return _DT_SOCKET
    if _DT_SOCKET is not None:
        try:
            _DT_SOCKET.close()
        except OSError:
            pass
        _DT_SOCKET = None
    subprocess.run(
        ["adb", "-s", SERIAL, "forward", f"tcp:{DEVTOOLS_PORT}", f"localabstract:webview_devtools_remote_{pid}"],
        capture_output=True, timeout=15,
    )
    listing = subprocess.run(
        ["curl", "-s", "-m", "6", f"http://127.0.0.1:{DEVTOOLS_PORT}/json/list"],
        capture_output=True, timeout=10,
    ).stdout.decode("utf-8", "replace")
    pages = _json.loads(listing or "[]")
    targets = [page for page in pages if "feelime.local" in page.get("url", "")
               and _attached_target(page)]
    # (real device): one process can accumulate FOUR targets across
    # rotations - detached landscape WebViews keep answering DOM queries next
    # to the live portrait one, and picking a zombie splits the suite (taps
    # drive the live page, evals read the dead one). The target description
    # carries the WebView's pixel size; keep only targets whose width matches
    # the CURRENT screen orientation (the keyboard always spans the screen
    # width - it is wider than tall in BOTH orientations, so a w>h test would
    # be meaningless).
    wm = re.search(r"(\d+)x(\d+)", shell("wm size") or "")
    surface = shell("dumpsys input | grep -m1 SurfaceOrientation").strip()
    device_landscape = surface.endswith("1")
    expected_width = 0
    if wm:
        short_side, long_side = sorted(int(g) for g in wm.groups())
        expected_width = long_side if device_landscape else short_side
    def _orientation_matches(page):
        if not expected_width:
            return True  # no usable signal - do not exclude
        try:
            desc = _json.loads(page.get("description", "{}"))
            width = int(desc.get("width", 0))
        except (ValueError, TypeError):
            return True
        if not width:
            return True
        return abs(width - expected_width) <= expected_width * 0.2
    # PREFER orientation-matched targets, but if none qualify (rotation gap:
    # the only surviving WebView still carries the old orientation), fall
    # back to the full list - a stale oracle beats no oracle at all.
    matched = [page for page in targets if _orientation_matches(page)]
    targets = matched or targets
    if not targets:
        return None
    chosen = None
    for target in reversed(targets):  # newest WebViews are appended last
        sock = _dt_handshake(target["webSocketDebuggerUrl"])
        if sock is None:
            continue
        _DT_SOCKET = sock
        _DT_PID = pid
        alive = devtools_eval(
            "document.documentElement.getBoundingClientRect().height > 100"
        )
        if alive is True:
            chosen = target
            break
        # zombie pages answer DOM queries with stale state and zero
        # rects — never fall back to one; keep scanning for a live page.
        _DT_SOCKET = None
        _DT_PID = None
        try:
            sock.close()
        except OSError:
            pass
    if chosen is None:
        return None
    try:
        description = _json.loads(chosen.get("description", "{}"))
        _DT_OFFSET = (description.get("screenX", 0), description.get("screenY", 0))
        _DT_VIEW_WIDTH = int(description.get("width", 0) or 0)
    except (ValueError, TypeError):
        _DT_OFFSET = (0, 0)
        _DT_VIEW_WIDTH = 0
    # Physical/CSS scale from the live viewport . The pixel-analysis
    # density in keyboard_metrics() counts toolbar rows too and ran ~17%
    # high on the fresh AVD, throwing every synthetic touch into the row
    # gaps - the DOM viewport ratio is the authoritative conversion.
    inner = devtools_eval("window.innerWidth")
    screen = subprocess.run(
        ["adb", "-s", SERIAL, "shell", "wm size"], capture_output=True, timeout=15
    ).stdout.decode()
    match = re.search(r"(\d+)x(\d+)", screen)
    try:
        # wm size stays in natural portrait coordinates after rotation.
        # Use this WebView's actual pixel width, including landscape insets.
        physical_width = _DT_VIEW_WIDTH or int(match.group(1))
        _DT_SCALE = physical_width / float(inner)
    except (TypeError, ValueError, ZeroDivisionError, AttributeError):
        _DT_SCALE = 2.625
    return _DT_SOCKET


def devtools_eval(expression):
    """Evaluate JS over the persistent DevTools socket (None on failure)."""
    import json as _json
    import struct as _struct
    import time as _time

    global _DT_ID, _DT_SOCKET, _DT_PID
    for attempt in range(3):
        sock = _dt_connect()
        if sock is None:
            _time.sleep(1.0)
            continue
        _DT_ID += 1
        message_id = _DT_ID
        payload = _json.dumps(
            {"id": message_id, "method": "Runtime.evaluate",
             "params": {"expression": expression, "returnByValue": True}}
        ).encode()
        mask = __import__("os").urandom(4)
        frame = bytearray([0x81])
        length = len(payload)
        if length < 126:
            frame.append(0x80 | length)
        elif length < 65536:
            frame.append(0x80 | 126)
            frame += _struct.pack(">H", length)
        else:
            frame.append(0x80 | 127)
            frame += _struct.pack(">Q", length)
        frame += mask
        frame += bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        try:
            sock.sendall(bytes(frame))
            buffer = b""
            # recv 的 10s 超时只防「沉默的半开连接」；对端若持续吐事件流
            # （永不沉默），这里必须另设硬截止，否则等 id 匹配响应的循环
            # 会把套件吊死（2026-09-12 input-prefs 首跑实录）。
            deadline = _time.monotonic() + 15.0
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    raise OSError("socket closed")
                if _time.monotonic() > deadline:
                    raise OSError("eval deadline exceeded (event storm?)")
                buffer += chunk
                while len(buffer) >= 2:
                    opcode = buffer[0] & 0x0F
                    size = buffer[1] & 0x7F
                    offset = 2
                    if size == 126:
                        if len(buffer) < 4:
                            break
                        size = _struct.unpack(">H", buffer[2:4])[0]
                        offset = 4
                    elif size == 127:
                        if len(buffer) < 10:
                            break
                        size = _struct.unpack(">Q", buffer[2:10])[0]
                        offset = 10
                    if len(buffer) < offset + size:
                        break
                    body = buffer[offset:offset + size]
                    buffer = buffer[offset + size:]
                    if opcode == 1:
                        data = _json.loads(body.decode())
                        if data.get("id") == message_id:
                            if "result" not in data:
                                # A replaced/hidden page keeps answering its
                                # old socket with an eval error instead of
                                # closing it - raise so the shared OSError
                                # handler drops the connection and retries on
                                # a fresh handshake.
                                raise OSError("stale devtools target")
                            return data.get("result", {}).get("result", {}).get("value")
        except OSError:
            try:
                sock.close()
            except OSError:
                pass
            _DT_SOCKET = None
            _time.sleep(1.0)
    return None


def devtools_eval_target(url_marker, expression):
    """Evaluate JS on the DevTools target whose URL contains url_marker.

    design §6.2: the settings page is a SECOND WebView in the IME process
    (file:///android_asset/settings/index.html) - the persistent keyboard
    socket (_dt_connect filters feelime.local) can never reach it. Opens a
    one-shot socket per call; None on any failure (same silence contract as
    devtools_eval)."""
    import json as _json
    import os as _os
    import struct as _struct
    import subprocess as _subprocess
    import time as _time

    try:
        pid = shell(f"pidof {PKG}").strip().split()[0]
    except (IndexError, AttributeError):
        return None
    port = str(int(DEVTOOLS_PORT) + 1)
    _subprocess.run(
        ["adb", "-s", SERIAL, "forward", f"tcp:{port}",
         f"localabstract:webview_devtools_remote_{pid}"],
        capture_output=True, timeout=15,
    )
    try:
        listing = _subprocess.run(
            ["curl", "-s", "-m", "6", f"http://127.0.0.1:{port}/json/list"],
            capture_output=True, timeout=10,
        ).stdout.decode("utf-8", "replace")
        pages = [page for page in _json.loads(listing or "[]")
                 if url_marker in page.get("url", "") and _attached_target(page)]
        web_socket = pages[0]["webSocketDebuggerUrl"] if pages else None
        if not web_socket:
            return None
        import socket as _socket
        from urllib.parse import urlparse as _urlparse
        parsed = _urlparse(web_socket)
        target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        sock = _socket.create_connection(("127.0.0.1", port), timeout=10)
        request = (f"GET {target} HTTP/1.1\r\n"
                   f"Host: 127.0.0.1:{port}\r\n"
                   "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                   "Sec-WebSocket-Key: ZmVsaW1lLXZlcmlmeS1rZXk=\r\n"
                   "Sec-WebSocket-Version: 13\r\n\r\n")
        sock.sendall(request.encode())
        buffer = b""
        while b"\r\n\r\n" not in buffer:
            chunk = sock.recv(4096)
            if not chunk:
                raise OSError("handshake closed")
            buffer += chunk
        # Frames (if any raced in) follow the blank line - keep them.
        buffer = buffer.split(b"\r\n\r\n", 1)[1]
        payload = _json.dumps(
            {"id": 1, "method": "Runtime.evaluate",
             "params": {"expression": expression, "returnByValue": True}}
        ).encode()
        mask = _os.urandom(4)
        frame = bytearray([0x81])
        length = len(payload)
        if length < 126:
            frame.append(0x80 | length)
        elif length < 65536:
            frame.append(0x80 | 126)
            frame += _struct.pack(">H", length)
        else:
            frame.append(0x80 | 127)
            frame += _struct.pack(">Q", length)
        frame += mask
        frame += bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        sock.sendall(bytes(frame))
        deadline = _time.time() + 10
        while _time.time() < deadline:
            # Top up until at least one complete frame is buffered.
            if len(buffer) < 2:
                needs_more = True
            else:
                size = buffer[1] & 0x7F
                if size == 126:
                    needs_more = len(buffer) < 4
                elif size == 127:
                    needs_more = len(buffer) < 10
                else:
                    needs_more = len(buffer) < size + 2
            if not needs_more and len(buffer) >= 2:
                size = buffer[1] & 0x7F
                offset = 2
                if size == 126:
                    size = _struct.unpack(">H", buffer[2:4])[0]
                    offset = 4
                elif size == 127:
                    size = _struct.unpack(">Q", buffer[2:10])[0]
                    offset = 10
                needs_more = len(buffer) < offset + size
            if needs_more:
                sock.settimeout(max(0.2, deadline - _time.time()))
                chunk = sock.recv(65536)
                if not chunk:
                    raise OSError("socket closed")
                buffer += chunk
                continue
            opcode = buffer[0] & 0x0F
            size = buffer[1] & 0x7F
            offset = 2
            if size == 126:
                size = _struct.unpack(">H", buffer[2:4])[0]
                offset = 4
            elif size == 127:
                size = _struct.unpack(">Q", buffer[2:10])[0]
                offset = 10
            body = buffer[offset:offset + size]
            buffer = buffer[offset + size:]
            if opcode == 1:
                data = _json.loads(body.decode())
                if data.get("id") == 1:
                    return data.get("result", {}).get("result", {}).get("value")
        return None
    except (OSError, ValueError, KeyError, IndexError):
        return None


def keyboard_chip():
    """ The chip lives on the keyboard toggle (cn-main shorthand)."""
    return devtools_eval(
        "(() => { const t = document.getElementById('modeToggle');"
        " return t ? t.querySelector('.cn-main').textContent : null; })()"
    )


def devtools_click_mode(title):
    """Click the mode item through the real UI via DevTools. The
    toolbar mode button is gone, so the DevTools flow calls the exposed
    keyboard.toggleModeMenu() (rendering the items) - the physical long-press
    path is covered by open_mode_menu. The chip label only updates after the
    async native roundtrip."""
    order = ["英文 Direct", "全拼 Pinyin", "双拼", "九宫格 T9",
             "笔画 Stroke", "Français", "Русский", "日本語 Romaji"]
    index = order.index(title)
    return devtools_eval(
        "(() => { const menu = document.getElementById('modeMenu');"
        " if (!menu.classList.contains('open')) window.Feelime.toggleModeMenu();"
        f" const item = menu.children[{index}];"
        " if (!item) return 'missing';"
        " if (item.classList.contains('current')) {"
        "   window.Feelime.closeModeMenu();"
        " } else { item.click(); }"
        " return 'clicked'; })()"
    )


def devtools_preedit():
    """M4: raw input lives on #preeditLine while composing (empty otherwise)."""
    return devtools_eval("document.getElementById('preeditLine').textContent") or ""


def devtools_candidates():
    return devtools_eval(
        "[...document.getElementById('candidates').children].map(c => c.textContent)"
    ) or []



def devtools_switch_mode(title):
    """Switch mode through the real UI, driven deterministically via DevTools.
 Opens the lazily rendered menu via the exposed hook."""
    order = ["英文 Direct", "全拼 Pinyin", "双拼", "九宫格 T9",
             "笔画 Stroke", "Français", "Русский", "日本語 Romaji"]
    index = order.index(title)
    return devtools_eval(
        "(() => { const menu = document.getElementById('modeMenu');"
        " if (!menu.classList.contains('open')) window.Feelime.toggleModeMenu();"
        f" const item = menu.children[{index}];"
        " if (!item) return 'missing';"
        " if (item.classList.contains('current')) {"
        "   window.Feelime.closeModeMenu();"  # already active: just close
        " } else { item.click(); }"
        " return document.querySelector('#modeToggle .cn-main').textContent; })()"
    )


def tap(x, y, wait=0.35):
    shell(f"input tap {int(x)} {int(y)}")
    time.sleep(wait)


def screenshot(path="/tmp/fv-screen.png"):
    import time as _time

    for _ in range(4):
        data = adb("exec-out", "screencap", "-p", timeout=20)
        if data[:8].startswith(b"\x89PNG") and len(data) > 8000:
            with open(path, "wb") as handle:
                handle.write(data)
            return path
        _time.sleep(1.0)
    raise RuntimeError("screenshot capture failed")


def ui_dump():
    # Recording animations can prevent the standard dumper's idle wait from
    # completing. The optional shell-side runner reads the same real view
    # hierarchy with that wait disabled; it never changes the application.
    dump_jar = __import__("os").environ.get("FEELIME_UI_DUMP_JAR", "").strip()
    dump_command = (
        "uiautomator runtest " + shlex.quote(dump_jar) +
        " -c com.feelime.verify.uidump.UiDumpTest -e output /sdcard/fv-ui.xml"
        if dump_jar else "uiautomator dump /sdcard/fv-ui.xml"
    )
    out = ""
    for _ in range(3):
        shell("rm -f /sdcard/fv-ui.xml")
        try:
            # 病态 SystemUI（ANR/僵尸页）能让 dump 卡满任意时长：显式 20s
            # 边界 + 捕获重试，别让 30s 的 TimeoutExpired 在上层被吞成一圈
            # 无感知的爬行（2026-09-12 input-prefs 首跑实录）。
            shell(dump_command + " >/dev/null 2>&1", timeout=20)
        except subprocess.TimeoutExpired:
            time.sleep(1.0)
            continue
        out = shell("cat /sdcard/fv-ui.xml 2>/dev/null")
        # 有效的 XML 就是一份确定的快照，直接返回，由调用方决定找不到目标
        # 节点怎么办（ensure_keyboard_up 等本来就有外层轮询）。把「没有
        # EditText」当失败重试会白烧满 3 轮 dump：无编辑框场景（设置页、
        # 键盘收起）每次查询从 ~4s 涨到 ~12s，叠上 visible_field_bounds 的
        # 6 次滚动重试就是几分钟级的爬行（2026-09-12 input-prefs 实测）。
        if out.lstrip().startswith("<?xml"):
            return out
        time.sleep(1.0)
    return ""


TEST_INPUT_DESCRIPTION = "feelime-test-input"
SETUP_LAUNCH_DESCRIPTION_PREFIX = "feelime-setup-launch:"
def expand_debug_fixtures():
    """ The in-page toggle is GONE - the fixtures show only when
    SetupActivity is launched with EXTRA_SHOW_FIXTURES (every am-start site
    passes it now). This helper therefore NEVER relaunches the activity (a
    mid-case relaunch would drop focus, clear fixtures and hide the
    keyboard); it only reports what is on screen. It stays a
    no-op on the 0.16.0 baseline APK, whose fixtures are always visible."""
    xml = ui_dump()
    return f'content-desc="{TEST_INPUT_DESCRIPTION}"' in xml


def field_bounds(description=TEST_INPUT_DESCRIPTION):
    """Bounds of one explicitly named SetupActivity editor fixture."""
    bounds = _field_bounds_once(description)
    if bounds is None and expand_debug_fixtures():
        bounds = _field_bounds_once(description)
    return bounds


def _field_bounds_once(description=TEST_INPUT_DESCRIPTION):
    xml = ui_dump()
    for node in re.finditer(r"<node [^>]*/>", xml):
        blob = node.group(0)
        if ('android.widget.EditText' not in blob or
                f'content-desc="{description}"' not in blob):
            continue
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', blob)
        if not bounds:
            continue
        return tuple(int(g) for g in bounds.groups())
    return None


def field_text_retry(attempts=4, description=TEST_INPUT_DESCRIPTION):
    for _ in range(attempts):
        value = field_text(description)
        if value is not None:
            return value
        time.sleep(0.8)
    return None


HINT_TEXT = "点这里唤起 Feelime 并测试输入"


def field_text(description=TEST_INPUT_DESCRIPTION):
    """Text of an exact editor fixture; never fall back to another field."""
    value = _field_text_once(description)
    if value is None and expand_debug_fixtures():
        value = _field_text_once(description)
    return value


def _field_text_once(description=TEST_INPUT_DESCRIPTION):
    xml = ui_dump()
    for node in re.finditer(r"<node [^>]*/>", xml):
        blob = node.group(0)
        if ("android.widget.EditText" not in blob or
                f'content-desc="{description}"' not in blob):
            continue
        text = re.search(r' text="([^"]*)"', blob)
        if not text or text.group(1) == HINT_TEXT:
            return ""
        return text.group(1)
    return None


def field_newline_count():
    """Enter must not add a newline when it committed composing."""
    text = field_text_retry() or ""
    return text.count("\n") + text.count("&#10;") + text.count("\\n")


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


# ---------------------------------------------------------------- keyboard geometry
def load_image(path):
    from PIL import Image

    return Image.open(path).convert("RGB")


def keyboard_metrics():
    """Keyboard block top + dp density; palette-aware for both themes."""
    image = load_image(screenshot())
    width, height = image.size
    pixels = image.load()

    def close(color, target, tol):
        return all(abs(color[i] - target[i]) <= tol for i in range(3))

    def solid(y, palette):
        hits = 0
        total = 0
        for x in range(0, width, 4):
            total += 1
            color = pixels[x, y]
            if palette == "light":
                if close(color, (0xE2, 0xE3, 0xE8), 12) or close(color, (0xFC, 0xFC, 0xFC), 10) or close(color, (0xB7, 0xBB, 0xC4), 12):
                    hits += 1
            else:
                if close(color, (0x20, 0x20, 0x20), 8) or close(color, (0x5F, 0x5F, 0x5F), 12) or close(color, (0x41, 0x41, 0x41), 12):
                    hits += 1
        return hits / total

    bottom = palette = None
    for y in range(height - 4, int(height * 0.4), -1):
        if solid(y, "dark") > 0.95:
            bottom, palette = y, "dark"
            break
        if solid(y, "light") > 0.95:
            bottom, palette = y, "light"
            break
    if bottom is None:
        return None
    top = bottom
    y = bottom
    while y > int(height * 0.4):
        if solid(y, palette) > 0.85:
            top = y
            y -= 1
            continue
        resumed = None
        for probe in range(y - 1, max(y - 40, int(height * 0.4)), -1):
            if solid(probe, palette) > 0.85:
                resumed = probe
                break
        if resumed is None:
            break
        top = resumed
        y = resumed - 1
    top = max(top, bottom - int(height * 0.40))
    return top, (height - top) / 272.0, palette


def devtools_to_screen(css_x, css_y):
    """CSS viewport 坐标 → 屏幕物理坐标（DevTools 偏移 + DOM 缩放比）。
    devtools_key_geometry() 里的换算逻辑的公共形态。"""
    import subprocess as _sp
    import re as _re
    inner = devtools_eval("window.innerWidth")
    if not inner:
        return None
    screen = _sp.run(
        ["adb", "-s", SERIAL, "shell", "wm size"], capture_output=True, timeout=15
    ).stdout.decode()
    match = _re.search(r"(\d+)x(\d+)", screen)
    if not match:
        return None
    scale = int(match.group(1)) / inner
    offset_x, offset_y = _DT_OFFSET
    return (int(css_x * scale) + offset_x, int(css_y * scale) + offset_y)


def devtools_key_geometry():
    """Exact key centers from the live DOM (CSS px scaled to physical)."""
    if devtools_eval(
        "document.getElementById('qwertyLayer')"
        " && !document.getElementById('qwertyLayer').hidden"
    ) is not True:
        # Hidden layer reports all-zero rects; that would poison every tap.
        return None
    payload = devtools_eval(
        "(() => {"
        " const out = { cssWidth: window.innerWidth };"
        " document.querySelectorAll('#qwertyLayer [data-key]').forEach(el => {"
        "   const r = el.getBoundingClientRect();"
        "   out[el.dataset.key] = [r.left + r.width / 2, r.top + r.height / 2];"
        " });"
        " const roles = { shift: '<shift>', sep: '<shift>', backspace: '<backspace>',"
        "   enter: '<enter>', cnEn: '<cn-en>', symbols: '<123>' };"
        " document.querySelectorAll('#qwertyLayer [data-role]').forEach(el => {"
        "   const name = roles[el.dataset.role];"
        "   if (!name) return;"
        "   const r = el.getBoundingClientRect();"
        "   out[name] = [r.left + r.width / 2, r.top + r.height / 2];"
        "   if (el.dataset.role === 'shift') {"
        "     out['<shift-green>'] = el.classList.contains('active') || el.classList.contains('locked'); }"
        " });"
        " document.querySelectorAll('#candidateBar [data-role]').forEach(el => {"
        "   if (el.dataset.role !== 'setup') return;"
        "   const r = el.getBoundingClientRect();"
        "   out['<setup>'] = [r.left + r.width / 2, r.top + r.height / 2];"
        " });"
        " const space = document.getElementById('spaceKey');"
        " if (space) { const r = space.getBoundingClientRect();"
        "   out['<space>'] = [r.left + r.width / 2, r.top + r.height / 2]; }"
        " return out; })()"
    )
    if not payload or "cssWidth" not in payload:
        return None
    css_keys = [v for k, v in payload.items() if isinstance(v, list)]
    if css_keys and sum(1 for x, _ in css_keys if x == 0) > len(css_keys) / 2:
        # Zombie page: hidden=False but every rect is zero (detached WebView).
        return None
    import subprocess as _sp

    screen = _sp.run(
        ["adb", "-s", SERIAL, "shell", "wm size"], capture_output=True, timeout=15
    ).stdout.decode()
    import re as _re

    match = _re.search(r"(\d+)x(\d+)", screen)
    if not match:
        return None
    width = int(match.group(1))
    scale = width / payload.pop("cssWidth")
    offset_x, offset_y = _DT_OFFSET
    kb = {}
    for name, value in payload.items():
        if isinstance(value, bool):
            kb[name] = value
            continue
        x, y = value
        kb[name] = (int(x * scale) + offset_x, int(y * scale) + offset_y)
    points = [v for v in kb.values() if isinstance(v, tuple)]
    if points:
        kb["<top>"] = min(y for _, y in points)
        kb["<density>"] = scale
        kb.setdefault("<shift-green>", False)
    return kb


def key_geometry():
    """Key grid from the live DOM when possible; pixel analysis as fallback."""
    required_special = {
        "<shift>", "<backspace>", "<123>", "<space>", "<cn-en>", "<enter>",
    }
    def complete(value):
        letter_keys = [name for name in value or {} if len(name) == 1]
        return bool(value) and required_special.issubset(value) and len(letter_keys) >= 27

    dom = devtools_key_geometry()
    if complete(dom):
        return dom
    if keyboard_chip() is not None:
        # Devtools is alive: the DOM read failed because the layer is hidden
        # or the page is a zombie. Pixel analysis of an unverified screen can
        # fabricate a qwerty map from the symbol layer — restore the letters
        # layer and retry instead.
        _restore_letters()
        time.sleep(0.3)
        dom = devtools_key_geometry()
        if complete(dom):
            return dom
        return None
    return key_geometry_pixels()


def key_geometry_pixels():
    """Detect the qwerty key grid by pixel analysis of the rendered keyboard."""
    image = load_image(screenshot())
    width, height = image.size
    pixels = image.load()
    bg = (0x20, 0x20, 0x20)

    def close(color, target, tol):
        return all(abs(color[i] - target[i]) <= tol for i in range(3))

    def keyboardish(color):
        return close(color, bg, 8) or close(color, KEY_BG, 12) or close(color, (0x41, 0x41, 0x41), 12)

    def solid_fraction(y, palette=None):
        hits = 0
        total = 0
        for x in range(0, width, 4):
            total += 1
            color = pixels[x, y]
            if palette is not None and palette == "light":
                if close(color, (0xE2, 0xE3, 0xE8), 12) or close(color, (0xFC, 0xFC, 0xFC), 10) or close(color, (0xB7, 0xBB, 0xC4), 12):
                    hits += 1
            elif palette is not None and palette == "dark":
                if keyboardish(color):
                    hits += 1
            elif keyboardish(color):
                hits += 1
        return hits / total

    # Keyboard block at the bottom of the screen; lock onto ONE luminance
    # palette (dark or light theme) so the walk cannot leak into the app.
    bottom = None
    palette = None
    for y in range(height - 4, int(height * 0.4), -1):
        if solid_fraction(y, "dark") > 0.95:
            bottom = y
            palette = "dark"
            break
        if solid_fraction(y, "light") > 0.95:
            bottom = y
            palette = "light"
            break
    if bottom is None:
        return None
    top = bottom
    y = bottom
    while y > int(height * 0.4):
        if solid_fraction(y, palette) > 0.85:
            top = y
            y -= 1
            continue
        resumed = None
        for probe in range(y - 1, max(y - 40, int(height * 0.4)), -1):
            if solid_fraction(probe, palette) > 0.85:
                resumed = probe
                break
        if resumed is None:
            break
        top = resumed
        y = resumed - 1
    # The IME view is a fixed-height block at the bottom (~272dp): never let
    # the walk leak into the app when both share the dark palette.
    top = max(top, bottom - int(height * 0.40))

    # Calibrate the rendered key color (WebView color management shifts it).
    from collections import Counter

    histogram = Counter()
    for yy in range(top, height, 4):
        for x in range(0, width, 4):
            color = pixels[x, yy]
            if not close(color, bg, 10):
                histogram[(color[0] // 8, color[1] // 8, color[2] // 8)] += 1
    if not histogram:
        return None
    bucket = histogram.most_common(1)[0][0]
    key_color = (bucket[0] * 8 + 4, bucket[1] * 8 + 4, bucket[2] * 8 + 4)

    # Letter rows = contiguous bands of key-colored coverage.
    counts = {yy: sum(1 for x in range(0, width, 6) if close(pixels[x, yy], key_color, 8)) for yy in range(top, height)}
    peak = max(counts.values()) if counts else 0
    if peak < width / 6 * 0.4:
        return None
    cutoff = peak * 0.5
    bands = []
    current = None
    for yy in range(top, height):
        if counts[yy] >= cutoff:
            if current is None:
                current = [yy, yy]
            else:
                current[1] = yy
        else:
            if current is not None:
                bands.append(tuple(current))
                current = None
    if current is not None:
        bands.append(tuple(current))
    bands = [band for band in bands if band[1] - band[0] > 40]
    if len(bands) < 3:
        return None
    r1, r2, r3 = bands[-3], bands[-2], bands[-1]
    y1 = (r1[0] + r1[1]) // 2
    y2 = (r2[0] + r2[1]) // 2
    y3 = (r3[0] + r3[1]) // 2
    y4 = (r3[1] + height) // 2
    density = (height - top) / 272.0

    def color_runs(y, x_from, x_to, tolerances):
        found = []
        run_start = None
        gap = 0
        for x in range(max(0, x_from), min(width, x_to)):
            if any(close(pixels[x, y], target, tol) for target, tol in tolerances):
                if run_start is None:
                    run_start = x
                gap = 0
            else:
                if run_start is not None:
                    gap += 1
                    if gap > 2:
                        if x - gap - run_start > 24:
                            found.append((run_start + x - gap) // 2)
                        run_start = None
                        gap = 0
        if run_start is not None and x_to - run_start > 24:
            found.append((run_start + x_to) // 2)
        return found

    key_tol = [(key_color, 8)]
    keyboard = {}

    centers1 = color_runs(y1, 0, width, key_tol)
    if len(centers1) < 10:
        return None
    for index, char in enumerate("qwertyuiop"):
        keyboard[char] = (centers1[index], y1)

    centers2 = color_runs(y2, 0, width, key_tol)
    if len(centers2) < 9:
        return None
    for index, char in enumerate("asdfghjkl"):
        keyboard[char] = (centers2[index], y2)

    # Row 3 letters in key color; shift/backspace in special color at the sides.
    # Row 3: zxcvbnm are evenly spaced; shift/backspace (special color, which
    # renders within tolerance of the key color) sit outside the even run.
    raw3 = color_runs(y3, 0, width, key_tol)
    # special keys can render dark, light-theme gray, or green active
    special_tol = [((0x41, 0x41, 0x41), 10), ((0xB7, 0xBB, 0xC4), 14), (key_color, 8), ((0x10, 0x3A, 0x24), 16)]
    letters3 = None
    shift_at = None
    backspace_at = None
    for start_index in range(0, max(1, len(raw3) - 6)):
        window = raw3[start_index:start_index + 7]
        if len(window) < 7:
            break
        spacings = [window[i + 1] - window[i] for i in range(6)]
        median = sorted(spacings)[3]
        if not all(abs(space - median) < median * 0.25 for space in spacings):
            continue
        # The letter window must leave special keys on BOTH sides.
        left_side = color_runs(y3, 0, window[0] - 55, special_tol)
        right_side = color_runs(y3, window[6] + 55, width, special_tol)
        if left_side and right_side:
            letters3 = window
            shift_at = left_side[-1]
            backspace_at = right_side[0]
            break
    if letters3 is None:
        return None
    for index, char in enumerate("zxcvbnm"):
        keyboard[char] = (letters3[index], y3)
    keyboard["<shift>"] = (shift_at, y3)
    keyboard["<shift-green>"] = any(
        close(pixels[x, y3], (0x10, 0x3A, 0x24), 18)
        for x in range(max(0, shift_at - 30), min(width, shift_at + 30), 6)
    )
    keyboard["<backspace>"] = (backspace_at, y3)

    # Bottom row: special-colored keys; glyph interiors can split runs, so
    # cluster centers closer than 70px.
    raw4 = color_runs(y4, 0, width, special_tol)
    clustered = []
    for center in raw4:
        if clustered and center - clustered[-1] < 70:
            clustered[-1] = (clustered[-1] + center) // 2
        else:
            clustered.append(center)
    if len(clustered) < 5:
        return None
    keyboard["<123>"] = (clustered[0], y4)
    keyboard["."] = (clustered[1], y4)
    keyboard["<space>"] = (clustered[2], y4)
    keyboard["<cn-en>"] = (clustered[3], y4)
    keyboard["<enter>"] = (clustered[4], y4)

    keyboard["<top>"] = r1[0] - 51 * density  # row1 top minus bar+margin (M4: recalibrate on device)
    keyboard["<density>"] = density
    return keyboard


_PRESS_ROLES = {
    # Chinese modes render the 分词 separator in the shift slot.
    "<shift>": '[data-role="shift"],[data-role="sep"]',
    "<backspace>": '[data-role="backspace"]',
    "<enter>": '[data-role="enter"]',
    "<cn-en>": '[data-role="cnEn"]',
    "<123>": '[data-role="symbols"]',
    "<space>": '#spaceKey',
}


def press(keyboard, key, wait=0.35):
    """Press a keyboard key. Synthetic TouchEvents through DevTools
    are the primary path - `input tap` proved unreliable on the fresh AVD
    (one tap landed as two commits, likely an input/touch scaling mismatch),
    while an in-page dispatch is exact and single-shot. Coordinates stay as
    the fallback for keys the DOM does not expose."""
    label = key.replace("\\", "\\\\").replace('"', '\\"')
    sel = _PRESS_ROLES.get(key, f'[data-key="{label}"]')
    ok = devtools_eval(
        "(() => { const k = document.querySelector('" + sel + "');"
        " if (!k || typeof Touch === 'undefined') return 'no';"
        " const r = k.getBoundingClientRect();"
        " const x = r.left + r.width / 2, y = r.top + r.height / 2;"
        " const t = new Touch({identifier: 1, target: k, clientX: x, clientY: y});"
        " const mk = type => new TouchEvent(type, {cancelable: true, bubbles: true,"
        "   touches: type === 'touchend' ? [] : [t], changedTouches: [t]});"
        " k.dispatchEvent(mk('touchstart'));"
        " k.dispatchEvent(mk('touchend'));"
        " return 'ok'; })()"
    )
    if ok != "ok":
        raise RuntimeError(f"synthetic press failed for {key!r}: {ok!r}")
    time.sleep(wait)


_SYNTH_TOUCH_JS = (
    "(() => { const css = [Math.round((__PX__ - __OX__) / __DEN__),"
    " Math.round((__PY__ - __OY__) / __DEN__)];"
    " const el = document.elementFromPoint(css[0], css[1]);"
    " if (!el) return 'no-target';"
    " const kind = '__KIND__';"
    " if (kind !== 'start' && !window.__synthTarget) return 'no-target';"
    " const target = kind === 'start' ? el : window.__synthTarget;"
    " const t = new Touch({identifier: 7, target: target, clientX: css[0], clientY: css[1]});"
    " const ev = new TouchEvent('touch' + kind, {cancelable: true, bubbles: true,"
    "   touches: kind === 'end' ? [] : [t], changedTouches: [t]});"
    " target.dispatchEvent(ev);"
    " if (kind === 'start') window.__synthTarget = target;"
    " else if (kind === 'end') window.__synthTarget = null;"
    " return 'ok'; })()"
)


def synth_touch(action, x, y):
    """Dispatch a synthetic touchstart/move/end at PHYSICAL (x, y) through
    DevTools. This AVD's `input tap/swipe/motionevent` injection
    proved unreliable against the keyboard WebView (double commits, lost
    holds), while in-page TouchEvents are exact."""
    # Plain replaces, not str.format: the JS body is full of braces that
    # str.format would try to parse as fields.
    js = (_SYNTH_TOUCH_JS
          .replace("__PX__", str(int(x))).replace("__PY__", str(int(y)))
          .replace("__OX__", str(int(_DT_OFFSET[0])))
          .replace("__OY__", str(int(_DT_OFFSET[1])))
          .replace("__DEN__", repr(float(_DT_SCALE)))
          .replace("__KIND__", action))
    return devtools_eval(js)


_SYNTH_GESTURE_JS = (
    "(() => { const pts = __PTS__; const step = __STEP__;"
    " const el0 = document.elementFromPoint(pts[0][0], pts[0][1]);"
    " if (!el0) return 'no-target';"
    " const dispatch = (kind, px, py) => {"
    "   const t = new Touch({identifier: 7, target: el0, clientX: px, clientY: py});"
    "   const ev = new TouchEvent('touch' + kind, {cancelable: true, bubbles: true,"
    "     touches: kind === 'end' ? [] : [t], changedTouches: [t]});"
    "   el0.dispatchEvent(ev);"
    " };"
    " const dwell = ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) {} };"
    " dispatch('start', pts[0][0], pts[0][1]);"
    " for (let i = 1; i < pts.length; i++) {"
    "   dwell(step);"
    "   dispatch(i === pts.length - 1 ? 'end' : 'move', pts[i][0], pts[i][1]);"
    " }"
    " window.__synthTarget = null;"
    " return 'ok'; })()"
)


def synth_gesture(points_css, step_ms=30):
    """Whole gesture in ONE DevTools eval . Per-event evals over
    network adb (real device) stretch a 160ms flick past the keyboard's 350ms
    long-press threshold - the popup opens mid-swipe and eats the gesture
    (up-flick released as the default uppercase cell etc). Real fingers
    stream moves at 60Hz; the in-page busy-wait keeps that pacing regardless
    of RPC latency."""
    pts = ", ".join(f"[{int(x)},{int(y)}]" for x, y in points_css)
    js = _SYNTH_GESTURE_JS.replace("__PTS__", "[" + pts + "]").replace(
        "__STEP__", str(int(step_ms)))
    return devtools_eval(js)


def synth_swipe(x1, y1, x2, y2, dur_ms=160):
    """Synthetic swipe through DevTools : `input touchscreen swipe`
    loses events against the keyboard WebView on the fresh AVD, and per-event
    evals stretch wall-clock past the 350ms long-press gate on network adb -
    so the whole gesture dispatches inside one eval."""
    steps = 4
    points = []
    for i in range(steps + 1):
        px = x1 + (x2 - x1) * i // steps
        py = y1 + (y2 - y1) * i // steps
        points.append([
            round((px - _DT_OFFSET[0]) / _DT_SCALE),
            round((py - _DT_OFFSET[1]) / _DT_SCALE),
        ])
    return synth_gesture(points, step_ms=max(1, int(dur_ms) // steps)) == "ok"


def press_hold(keyboard, key, hold_s=0.55):
    """Long-press a key: synthetic down, real dwell, synthetic up."""
    x, y = keyboard[key]
    if synth_touch("start", x, y) != "ok":
        raise RuntimeError(f"synthetic hold failed for {key!r} - keyboard not up?")
    time.sleep(hold_s)
    synth_touch("end", x, y)
    time.sleep(0.3)


def type_word(keyboard, word, wait=0.3):
    for char in word:
        press(keyboard, char, wait)


# ---------------------------------------------------------------- test cases
def prepare():
    shell("svc power stayon true")
    shell("input keyevent KEYCODE_WAKEUP")
    shell("wm dismiss-keyguard")
    shell("input keyevent 82")
    # 设备被拿去把玩后可能停在横屏（加速度旋转开着 + 平放）——设置页
    # 的验证全程假设竖屏，先锁死再继续；已在前台的 activity 对旋转
    # 设置不响应，回一次桌面让重进的窗口按新方向布局。
    shell("settings put system accelerometer_rotation 0")
    shell("settings put system user_rotation 0")
    shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    import re as _re
    if shell("dumpsys input | grep -m1 SurfaceOrientation").strip().endswith("1"):
        shell("input keyevent KEYCODE_HOME")
        time.sleep(1.2)
    shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(1.5)
    for attempt in range(8):
        if field_bounds():
            break
        # A previous suite can leave a level-two page on screen,
        # which has no test field - back out to the level-one menu first.
        # One back is not enough when the keyboard update page is
        # up (its own history swallows the first), so back twice and relaunch.
        if attempt == 3:
            shell("input keyevent 4")
            time.sleep(0.6)
            shell("input keyevent 4")
            time.sleep(0.6)
            shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
            time.sleep(1.5)
        # The test field is intentionally below the settings menu. Bring that
        # exact accessibility node into the viewport; never substitute the
        # visible update-URL EditText.
        shell("input swipe 540 1750 540 650 220")
        time.sleep(0.5)
    shell("settings get secure default_input_method")
    bounds = remember_field(field_bounds())
    if not bounds:
        raise SystemExit("test field not found")
    if PKG not in shell("settings get secure default_input_method"):
        shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
        time.sleep(0.5)
    tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.5)
    close_mode_menu_if_open()
    # Release any leftover shift/caps state from earlier runs.
    for _ in range(3):
        kb = key_geometry()
        if not kb or not kb.get("<shift-green>"):
            break
        tap(*kb["<shift>"], 0.4)
    # Ensure empty start.
    for _ in range(40):
        shell("input keyevent 67")
    time.sleep(0.3)


def clear_field(kb=None):
    """Wipe the test editor: drain the engine preedit, then select-all +
    delete on the host. The select+delete occasionally races the IME's
    composing span (AVD: one character of residue), so verify and
    repeat up to three rounds until the fixture reads empty."""
    for _ in range(3):
        # The WebView can eat host keyevents entirely; the IME-side
        # cascade (clearComposing + backspace burst) drains engine buffer and
        # committed text without depending on the host key path.
        devtools_eval("window.Feelime && window.Feelime.clearEditor && window.Feelime.clearEditor()")
        time.sleep(0.4)
        shell("input keycombination 113 29")  # CTRL_LEFT + A = select all
        time.sleep(0.35)
        shell("input keyevent 67")
        shell("input keyevent 67")
        time.sleep(0.25)
        text = field_text()
        if text == "":
            return


def app_hard_reset():
    """Nuclear option when input connections die: restart app + IME."""
    # Wake first: screencap of an asleep screen is a tiny PNG that fails
    # the size check in screenshot() and kills every pixel-based helper.
    shell("svc power stayon true")
    shell("input keyevent KEYCODE_WAKEUP")
    shell("wm dismiss-keyguard")
    shell("input keyevent 82")
    # SIGKILL 的 WebView 永远不提交 localStorage：leveldb log 里留 torn
    # tail 后，恢复截断点之后的追加永久不可见（2026-09-12 9m 全程实录，
    # 写进文件的 key 重启后读不回来）。先优雅收起 IME 让 WebView 走
    # destroy/flush，再 force-stop；收不起来就按原样硬杀（尽力语义）。
    if input_shown():
        shell("input keyevent KEYCODE_BACK")
        for _ in range(4):
            if not input_shown():
                break
            time.sleep(0.5)
    time.sleep(0.8)
    shell("am force-stop " + PKG)
    time.sleep(1.5)
    shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    import re as _re
    if shell("dumpsys input | grep -m1 SurfaceOrientation").strip().endswith("1"):
        shell("input keyevent KEYCODE_HOME")
        time.sleep(1.2)
    shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(3.5)
    global _DT_SOCKET, _DT_PID
    _DT_SOCKET = None
    _DT_PID = None
    bounds = remember_field(visible_field_bounds())
    if bounds:
        tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 2.0)
    close_mode_menu_if_open()


def case_english(kb):
    text = None
    for attempt in range(3):
        type_word(kb, "hello", wait=0.35)
        time.sleep(0.6)
        text = field_text_retry()
        if text and text.strip():
            break
        if attempt == 1:
            app_hard_reset()
        kb = fresh_kb() or kb
    record("direct typing commits without preedit", text == "hello", repr(text))
    press(kb, "<space>")
    press(kb, "<space>")
    text = field_text_retry()
    record("space key commits spaces", text == "hello  ", repr(text))
    clear_field()
    type_word(kb, "abc")
    for _ in range(3):
        press(kb, "<backspace>")
    text = field_text_retry()
    record("backspace deletes committed chars", text == "", repr(text))
    press(kb, "<shift>")
    press(kb, "h")
    press(kb, "i")
    text = field_text_retry()
    record("shift gives single uppercase", text == "Hi", repr(text))
    clear_field()
    # Caps lock via long press on shift (synthetic hold - the AVD
    # `input swipe` injection does not reach the keyboard WebView reliably).
    press_hold(kb, "<shift>", 0.6)
    type_word(kb, "ok")
    text = field_text_retry()
    record("caps lock uppercase", text == "OK", repr(text))
    clear_field()
    reset_shift()  # never leak caps into later cases


MODE_ORDER = ["英文 Direct", "全拼 Pinyin", "双拼", "九宫格 T9", "笔画 Stroke", "Français", "Русский", "日本語 Romaji"]


def menu_open():
    """The popup menu = a green current-mode row PLUS white item rows below.

    The always-green mode chip alone must not count as an open menu.
    """
    image = load_image(screenshot())
    width, height = image.size
    pixels = image.load()
    metrics = keyboard_metrics()
    scan_top = int(metrics[0]) if metrics else int(height * 0.6)
    light = keyboard_palette(image, metrics) == "light"
    green_rows = []
    white_rows = []
    for y in range(scan_top, height, 3):
        green = sum(
            1
            for x in range(0, int(width * 0.6), 3)
            # M4 accent #23c890 has B=0x90=144; cap B below 160, not 140.
            if pixels[x, y][1] > 120 and pixels[x, y][0] < 110 and pixels[x, y][2] < 160
        )
        if light:
            white = sum(
                1
                for x in range(0, int(width * 0.6), 3)
                if all(channel < 110 for channel in pixels[x, y])
            )
        else:
            white = sum(
                1
                for x in range(0, int(width * 0.6), 3)
                if all(channel > 185 for channel in pixels[x, y])
            )
        if green > 5:
            green_rows.append(y)
        if white > 6:
            white_rows.append(y)
    if not green_rows:
        return False
    below_green = [y for y in white_rows if y > green_rows[0] + 40]
    return len(below_green) >= 2


def close_mode_menu_if_open():
    state = devtools_eval(
        "(() => { const menu = document.getElementById('modeMenu');"
        " if (!menu) return 'none';"
        " if (menu.classList.contains('open')) { return 'open'; }"
        " return 'already'; })()"
    )
    if state == "already":
        time.sleep(0.4)
        return
    if state == "open":
        # The menu has no toolbar opener any more - close via the
        # key it belongs to (a long press would just reopen it).
        devtools_eval(
            "(() => { document.getElementById('modeMenu').classList.remove('open'); return true; })()"
        )
        time.sleep(0.4)
        return
    for _ in range(2):
        if not menu_open():
            return
        time.sleep(0.5)


def open_mode_menu(kb):
    """ The mode menu is opened by LONG-PRESSING the space-adjacent
    keyboard toggle (the toolbar mode button is gone)."""
    if menu_open():
        return
    center = devtools_eval(
        "(() => { const t = document.getElementById('modeToggle');"
        " if (!t) return null; const r = t.getBoundingClientRect();"
        " return JSON.stringify([r.left + r.width / 2, r.top + r.height / 2]); })()"
    )
    if not center:
        raise RuntimeError("keyboard toggle not found")
    cx, cy = json.loads(center)
    shell(f"input touchscreen swipe {int(cx)} {int(cy)} {int(cx)} {int(cy)} 500")
    time.sleep(0.6)
    if not menu_open():
        raise RuntimeError("mode menu did not open")


def keyboard_palette(image, metrics):
    """Theme polarity from the keyboard's own area, not the nav-bar anchor."""
    if not metrics:
        return "dark"
    top = int(metrics[0])
    height = image.size[1]
    width = image.size[0]
    pixels = image.load()
    y = int(top + (height - top) * 0.55)
    bright = sum(1 for x in range(0, width, 6) if sum(pixels[x, y]) > 560)
    return "light" if bright > width / 6 * 0.5 else "dark"


def measure_menu_rows():
    """Measure the open grid menu: per-row y centers and the green row/col."""
    image = load_image(screenshot())
    width, height = image.size
    pixels = image.load()
    metrics = keyboard_metrics()
    if not metrics:
        return None
    top = int(metrics[0])
    light = keyboard_palette(image, metrics) == "light"

    def is_text(x, y):
        color = pixels[x, y]
        if light:
            return all(channel < 110 for channel in color)
        return all(channel > 185 for channel in color)

    bands = []
    current = None
    for y in range(top + 30, height, 2):
        green_xs = [
            x
            for x in range(10, int(width * 0.95), 3)
            # M4 accent #23c890 has B=0x90=144; cap B below 160, not 140.
            if pixels[x, y][1] > 120 and pixels[x, y][0] < 110 and pixels[x, y][2] < 160
        ]
        text = sum(1 for x in range(10, int(width * 0.95), 3) if is_text(x, y))
        if green_xs or text > 6:
            if current is None:
                current = [y, y, green_xs]
            else:
                current[1] = y
                current[2].extend(green_xs)
        else:
            if current is not None:
                bands.append(tuple(current))
                current = None
    if current is not None:
        bands.append(tuple(current))
    # Keep plausible item rows (text ~20-70px tall). Theme/settings rows can
    # be clipped thin by the viewport bottom, so 3 mode rows are enough.
    rows = [band for band in bands if 18 <= band[1] - band[0] <= 70]
    if len(rows) < 3:
        return None
    item_rows = rows[:3]
    green_row = None
    green_col = None
    for index, (y0, y1, xs) in enumerate(item_rows):
        if xs:
            green_row = index
            green_col = 0 if max(xs) < width / 2 else 1
            break
    centers = [(band[0] + band[1]) // 2 for band in item_rows]
    return {"centers": centers, "green_row": green_row, "green_col": green_col, "width": width}


def reset_shift(kb=None):
    """Release leftover shift/caps with FRESH geometry (green = engaged)."""
    kb = kb or key_geometry()
    for _ in range(4):
        if not kb or not kb.get("<shift-green>"):
            return
        tap(*kb["<shift>"], 0.4)
        time.sleep(0.3)
        kb = key_geometry()


ENGINE_WARMUP = {"全拼 Pinyin": 2.5, "双拼": 2.5, "笔画 Stroke": 2.5, "Français": 2.5,
                 "Русский": 2.5, "日本語 Romaji": 4.0, "英文 Direct": 0.6}


def scroll_setup_top():
    """Restore the Setup page to its very top before dumping.

    The activity keeps its scroll position across onNewIntent (the panel
    deep-link scrolls it to favorites), so the swipe budget must cover the
    full page, not just a screenful."""
    for _ in range(7):
        # x=80 keeps the gesture off the form fields (an EditText start point
        # swallows the swipe) and clear of the system edge-back zone, which on
        # this panel reaches ~48px (16dp) from the left.
        shell("input swipe 80 1700 80 2150 150")
        time.sleep(0.25)


def visible_field_bounds():
    for _ in range(6):
        bounds = field_bounds()
        if bounds:
            return bounds
        shell("input swipe 540 1750 540 650 220")
        time.sleep(0.5)
    return None


LAST_FIELD_BOUNDS = None


def remember_field(bounds):
    global LAST_FIELD_BOUNDS
    if bounds:
        LAST_FIELD_BOUNDS = bounds
    return bounds


def ensure_keyboard_up():
    """The IME WebView (and its DevTools socket) is destroyed while hidden.

    DevTools answers even after hide, so chip presence alone cannot mean
    "shown" - require mInputShown too, and re-tap the field otherwise."""
    if keyboard_chip() is not None and input_shown():
        return
    # 恢复判定只看本次活体查询：缓存坐标兜底会跳过路由恢复，对着设置页
    # 子页盲点旧坐标（codex round-1 P2-6）。
    live = remember_field(visible_field_bounds())
    if not live:
        # SetupActivity 的子页（输入设置等）没有测试编辑框，swipe 也滚不出
        # 来；home 页有。路由重置一次，替代之前几分钟的盲转重试
        # （2026-09-13 input-prefs 60s 采样：25/30 卡在这个循环）。
        reset = devtools_eval_target(
            "settings/index.html",
            "!!window.FeelimeSettings && (window.FeelimeSettings.showPage('home'), true)")
        if reset is True:
            live = remember_field(visible_field_bounds())
    bounds = live or LAST_FIELD_BOUNDS
    if bounds:
        tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.5)
    for _ in range(6):
        if keyboard_chip() is not None and input_shown():
            return
        bounds = remember_field(visible_field_bounds()) or LAST_FIELD_BOUNDS
        if bounds:
            tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.2)
        time.sleep(1.0)


def input_shown():
    """True while the system reports the IME visible.

    keyboard_chip()/DevTools stay responsive after hide (the WebView lives
    until process teardown), so they cannot be used as a hidden signal.
    """
    return "=true" in shell("dumpsys input_method | grep -m1 'mInputShown='")


def current_ime():
    """Package/class of the IME currently bound to the focused editor."""
    return shell("dumpsys input_method | grep -m1 mCurMethodId=").strip()


def wait_password_binding(timeout_steps=10):
    """Settle who owns a just-focused password editor.

    Returns ("claimed", ime) when a vendor security IME took the binding -
    ColorOS does this on password focus, a beat AFTER the previous IME is
    first re-shown, so Feelime must not conclude early - or ("hosted", ime)
    once the settle window passes with Feelime still bound (devices without
    that policy); suites assert only in the hosted case.
    """
    last = ""
    for _ in range(timeout_steps):
        last = current_ime()
        if "securitykeyboard" in last and "com.feelime.ime" not in last:
            return "claimed", last
        time.sleep(0.5)
    if "com.feelime.ime" in last and input_shown():
        # The IME column can lag the actual EditorInfo handover: trust only
        # our own onStartInput receipt of a password inputType (0x81 class
        # text = 129 decimal), logged by the service.
        delivered = shell(
            "logcat -d -s FeelimePanel:* | grep -c 'onStartInput type=129'"
        ).strip()
        if delivered not in ("0", ""):
            return "hosted", last
        return "unknown", last
    return "unknown", last


def platform_claims_password_editors():
    """True when a vendor security IME force-claims password fields."""
    ime = current_ime()
    return "com.feelime.ime" not in ime and "securitykeyboard" in ime, ime


def ensure_keyboard_down():
    """Hide the IME so raw taps reach app fields again.

    The next tap must land on the app field, not on the collapsing IME
    window, so wait until mInputShown flips false plus teardown slack.
    """
    if not input_shown():
        return
    for _ in range(4):
        shell("input keyevent KEYCODE_BACK")
        for _ in range(4):
            if not input_shown():
                time.sleep(0.7)
                return
            time.sleep(0.5)
    raise RuntimeError("keyboard would not hide")


def switch_mode(kb, title):
    # modeLabel() keeps the long menu titles stable but uses short English
    # aliases for the Chinese modes when the keyboard UI is English.
    expected = {
        "英文 Direct": {"En"},
        "全拼 Pinyin": {"拼", "PY"},
        "双拼": {"双", "DP"},
        "九宫格 T9": {"九", "T9"},
        "笔画 Stroke": {"笔", "ST"},
        "Français": {"FR"},
        "Русский": {"РУ"},
        "日本語 Romaji": {"日", "JP"},
    }[title]
    ensure_keyboard_up()
    chip = None
    for attempt in range(5):
        clicked = devtools_click_mode(title)
        time.sleep(1.0)  # chip updates only after the native roundtrip
        for _ in range(3):
            chip = keyboard_chip()
            if chip in expected:
                break
            time.sleep(0.5)
        if chip in expected:
            break
        if clicked is None or chip is None:
            global _DT_SOCKET
            _DT_SOCKET = None  # force a fresh connection next attempt
            time.sleep(1.5)
        else:
            time.sleep(0.6)
    # Wait out the async engine start. Do not tap field_bounds() here: after
    # SetupActivity scrolls, uiautomator can still report the EditText below
    # the IME's top edge. Tapping that occluded rect actually presses a key
    # (usually Space) and corrupts the assertion input.
    time.sleep(ENGINE_WARMUP.get(title, 1.5))
    if chip not in expected and chip is None:
        # devtools went dark: one hard reset often revives the socket chain
        app_hard_reset()
        kb = fresh_kb() or kb
        devtools_click_mode(title)
        time.sleep(2.0)
        chip = keyboard_chip()
    if chip not in expected and chip is not None:
        raise RuntimeError(f"devtools switch produced chip {chip!r}, expected one of {sorted(expected)!r}")
    if chip is None:
        close_mode_menu_if_open()
        open_mode_menu(kb)
    elif devtools_eval(
        "document.getElementById('modeMenu').classList.contains('open')"
    ) is not True:
        # Already in the target mode: devtools_click_mode saw the item as
        # current and closed the menu, so there is nothing left to measure.
        # (Trust the DOM here — the pixel menu_open() false-positives on the
        # pinyin candidate bar.)
        return
    index = MODE_ORDER.index(title)
    menu = measure_menu_rows()
    if not menu:
        raise RuntimeError("menu rows not measurable")
    target_row, target_col = index // 2, index % 2
    if menu["green_row"] == target_row and menu["green_col"] == target_col:
        # Already on the target mode - close via the exposed hook
        # (the toolbar button that used to own this toggle is gone).
        devtools_eval("window.Feelime.closeModeMenu()")
        time.sleep(0.4)
        if menu_open():
            raise RuntimeError("menu did not close for current mode " + title)
        return
    x = menu["width"] * (0.27 if target_col == 0 else 0.77)
    base_y = menu["centers"][target_row]
    for offset in (0, 28, -28, 56, -56):
        tap(x, base_y + offset, 0.9)
        time.sleep(0.45)
        if not menu_open():
            return
    raise RuntimeError("mode menu did not close after selecting " + title)


def tap_grid_menu_item(kb, index):
    menu = measure_menu_rows()
    if not menu:
        raise RuntimeError("menu rows not measurable")
    target_row, target_col = index // 2, index % 2
    x = menu["width"] * (0.27 if target_col == 0 else 0.77)
    tap(x, menu["centers"][target_row], 0.9)


def current_menu_mode(kb):
    menu = measure_menu_rows()
    if not menu or menu["green_row"] is None:
        return None
    return menu["green_row"] * 2 + menu["green_col"]


def _restore_letters():
    """Return to the letters layer via DOM clicks (the ABC button only
    exists while the symbol layer is shown, so retry until qwerty is back)."""
    for _ in range(4):
        if devtools_eval("!document.getElementById('qwertyLayer').hidden") is True:
            return True
        devtools_eval("document.querySelector('[data-action=\"letters\"]') && document.querySelector('[data-action=\"letters\"]').click()")
        time.sleep(0.5)
    return devtools_eval("!document.getElementById('qwertyLayer').hidden") is True


def warm_tap(kb):
    """ Key presses go through DevTools-synthesized TouchEvents,
    which bypass the IME window's first-touch swallow entirely - no physical
    warm-up tap (it used to land on the setup page when the keyboard was
    hidden and could open dialogs). Just restore the letters layer."""
    for _ in range(3):
        if _restore_letters():
            return
        time.sleep(0.3)


def type_word_verified(kb, word, expect_regex):
    """Type and verify the composing preedit via DevTools; retry on glitches."""
    import re as _re

    for attempt in range(4):
        warm_tap(kb)
        type_word(kb, word, wait=0.4)
        time.sleep(1.0)
        chip = devtools_preedit()
        if _re.search(expect_regex, chip.replace(" ", "").replace("\u00a0", "")):
            return True
        print(f"  [type retry {attempt}] chip={chip!r}")
        clear_engine_buffer(kb)
    return False


def clear_engine_buffer(kb):
    """Backspace until the engine preedit/chip is provably empty."""
    for _ in range(40):
        press(kb, "<backspace>", 0.15)
        if not devtools_preedit():
            break
    time.sleep(0.4)


def fresh_kb(refocus=True):
    """Re-show the keyboard, refocus the field, recalibrate geometry."""
    global _DT_SOCKET, _DT_PID
    # Rotation may detach the old WebView without changing the process.
    # Reconnect to an attached target before using any cached geometry.
    if _DT_SOCKET is not None:
        try:
            _DT_SOCKET.close()
        except OSError:
            pass
    _DT_SOCKET = None
    _DT_PID = None
    ensure_keyboard_up()
    _restore_letters()
    if refocus:
        bounds = remember_field(visible_field_bounds()) or LAST_FIELD_BOUNDS
        # _DT_OFFSET is the WebView's physical screen origin. An EditText
        # whose centre is at/below it is covered by the keyboard; tapping it
        # would inject a key instead of focusing the app field.
        field_y = (bounds[1] + bounds[3]) / 2 if bounds else None
        keyboard_top = _DT_OFFSET[1] if _DT_OFFSET[1] > 0 else None
        if bounds and (keyboard_top is None or field_y < keyboard_top):
            tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 0.9)
    for _ in range(4):
        kb = key_geometry()
        if kb:
            return kb
        close_mode_menu_if_open()
        time.sleep(1.0)
    return None




def case_pinyin(kb):
    reset_shift(kb)
    switch_mode(kb, "全拼 Pinyin")
    typed_ok = False
    for reset_attempt in range(2):
        clear_field(kb)
        typed_ok = type_word_verified(kb, "nihao", r"^nihao$")
        if typed_ok:
            break
        print(f"  [pinyin dead {reset_attempt}] chip={keyboard_chip()!r}")
        app_hard_reset()
        time.sleep(2.0)
        kb = fresh_kb() or kb
        reset_shift(kb)
        switch_mode(kb, "全拼 Pinyin")
        time.sleep(1.5)
    screenshot("/tmp/fv-pinyin-preedit.png")
    candidates = []
    for _ in range(6):
        time.sleep(0.5)
        candidates = devtools_candidates()
        if len(candidates) >= 2:
            break
    record(
        "C2 pinyin preedit and candidates render",
        typed_ok and len(candidates) >= 2 and any("你" in c for c in candidates),
        f"candidates={candidates[:6]}",
    )
    clear_field(kb)
    if type_word_verified(kb, "nihao", r"^nihao$"):
        devtools_eval("window.__ev = []")  # per-case checkpoint
        press(kb, "<space>")
        time.sleep(0.6)
        text = field_text_retry()
        commit_now = ""
        for _ in range(5):
            commit_now = devtools_eval(
                "(window.__ev || []).filter(e => e.includes(':m')).map(e => e.split(':m')[1]).join('|')"
            ) or ""
            if "你好" in commit_now:
                break
            time.sleep(0.6)
        # exact field — a leading orphan letter (e.g. 'n你好') is a
        # FAIL, not a tolerated prefix.
        c4_ok = commit_now.split("|").count("你好") >= 1 and text == "你好"
        record("C4 space commits first candidate", c4_ok, f"text={text!r}")
        press(kb, "<backspace>")
        time.sleep(0.5)
        text = field_text_retry()
        record("C6 backspace over committed chinese", text == "你", repr(text))
    else:
        record("C4 space commits first candidate", False, "typing not verified")
        record("C6 backspace over committed chinese", False, "typing not verified")
    commit_trace = ""
    for attempt in range(3):
        clear_field(kb)
        if not type_word_verified(kb, "nihao", r"^nihao$"):
            continue
        devtools_eval("window.__ev = []")  # per-case checkpoint
        press(kb, "<enter>")
        time.sleep(0.8)
        commit_trace = devtools_eval(
            "(window.__ev || []).filter(e => e.includes(':m')).map(e => e.split(':m')[1]).join('|')"
        ) or ""
        text = field_text_retry()
        # raw string committed exactly once, no newline added.
        newlines = field_newline_count()
        if commit_trace.count("nihao") >= 1 and text == "nihao":
            record("C5 enter commits raw string", newlines == 0,
                   f"trace={commit_trace[-60:]!r} newlines={newlines}")
            break
    else:
        record("C5 enter commits raw string", False, f"trace={commit_trace[-80:]!r}")
    clear_field(kb)



def case_double_pinyin(kb):
    kb = fresh_kb() or kb
    reset_shift(kb)
    switch_mode(kb, "双拼")
    clear_field()
    typed_ok = type_word_verified(kb, "nihk", r"nihk")
    devtools_eval("window.__ev = []")  # per-case checkpoint
    # Space commits the FIRST candidate, whatever the scheme-local user dict
    # ranks first (word-building put 你号 above the built-in 你好 on
    # this device - that is correct behaviour, not a regression).
    expected_first = (devtools_candidates()[:1] or [""])[0]
    press(kb, "<space>")
    time.sleep(0.8)
    commit_trace = devtools_eval(
        "(window.__ev || []).filter(e => e.includes(':m')).map(e => e.split(':m')[1]).join('|')"
    ) or ""
    text = field_text_retry()
    ok = typed_ok and expected_first and text == expected_first \
        and commit_trace.count(expected_first) >= 1
    record("D2 double pinyin ni+hk space commits first candidate", ok,
           f"first={expected_first!r} text={text!r} trace={commit_trace[-40:]!r}")
    clear_field()


def case_layouts(kb):
    kb = fresh_kb() or kb
    switch_mode(kb, "Français")
    screenshot("/tmp/fv-fr.png")
    # structural DOM assertion, never a hardcoded pass.
    fr_rows = devtools_eval(
        "(() => { const rows = [...document.querySelectorAll('#qwertyLayer .kb-row')];"
        " return rows.map(row => [...row.querySelectorAll('[data-key]')].map(k => k.dataset.key).join('')); })()"
    )
    fr_ok = fr_rows[:3] == ["qwertyuiop", "asdfghjkl", "zxcvbnm"] if fr_rows else False
    record("E1 french layout is qwerty", fr_ok, f"rows={fr_rows}")

    switch_mode(kb, "Русский")
    screenshot("/tmp/fv-ru.png")
    ru_rows = devtools_eval(
        "(() => { const rows = [...document.querySelectorAll('#qwertyLayer .kb-row')];"
        " return rows.map(row => [...row.querySelectorAll('[data-key]')].map(k => k.dataset.key).join('')); })()"
    )
    ru_ok = ru_rows[:3] == ["йцукенгшщзхъ", "фывапролджэ", "ячсмитьбю"] if ru_rows else False
    record("F1 russian йцукен layout", ru_ok, f"rows={ru_rows}")

    switch_mode(kb, "日本語 Romaji")
    clear_field()
    type_word(kb, "konnichiha")
    press(kb, "<space>")
    text = field_text_retry()
    record("G1/G4 japanese romaji converts", text == "こんにちは", repr(text))
    clear_field()
    switch_mode(kb, "英文 Direct")


def case_symbols(kb):
    kb = fresh_kb() or kb
    clear_field(kb)
    press(kb, "<123>")
    time.sleep(0.5)
    screenshot("/tmp/fv-symbols.png")
    # The grid opens on 常用, whose first row is the digits in
    # every mode - no category switch needed before the taps.
    time.sleep(0.5)
    for digit in ("1", "2"):
        clicked = devtools_eval(
            "(() => { const k=[...document.querySelectorAll('#symGrid .kb-key')]"
            ".find(b => b.textContent === '" + digit + "');"
            " if (!k) return false; k.click(); return true; })()"
        )
        if clicked is not True:
            raise RuntimeError(f"symbol key {digit} not clickable")
    text = field_text_retry()
    record("I1 symbol layer digits type", text == "12", repr(text))
    # Back to letters via a real touch on the ABC tab. The symbol layer's tab
    # row is not aligned with qwerty row 4 after the M2 layout change, so use
    # its live DOM rect and convert CSS coordinates to physical screen space.
    letters_visible = _restore_letters()
    text2 = field_text_retry()
    letters_visible = devtools_eval(
        "!document.getElementById('qwertyLayer').hidden"
    ) is True
    record("I2 letters restored", text2 == "12" and letters_visible,
           f"text={text2!r} qwerty_visible={letters_visible}")
    clear_field()


def case_mode_persistence(kb):
    # Robust switch: devtools click + patient chip reads + one hard reset.
    def to_pinyin():
        for attempt in range(4):
            ensure_keyboard_up()
            devtools_click_mode("全拼 Pinyin")
            for _ in range(4):
                chip = keyboard_chip()
                if chip in ("拼", "PY"):
                    return True
                time.sleep(0.7)
            if attempt == 1:
                app_hard_reset()
        return False

    if not to_pinyin():
        record("H1 mode persisted across hide/show", False, "switch unavailable")
        return
    shell("input keyevent KEYCODE_BACK")
    time.sleep(1.2)
    bounds = remember_field(visible_field_bounds()) or LAST_FIELD_BOUNDS
    if bounds:
        tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 1.6)
    chip = None
    for _ in range(5):
        chip = keyboard_chip()
        if chip is not None:
            break
        time.sleep(0.9)
    record("H1 mode persisted across hide/show", chip in ("拼", "PY"), f"chip={chip!r}")

    # persistence must survive process death, not just hide/show.
    shell("am force-stop " + PKG)
    time.sleep(2.0)
    shell(f"ime set {PKG}/com.feelime.ime.FeelimeService")
    import re as _re
    if shell("dumpsys input | grep -m1 SurfaceOrientation").strip().endswith("1"):
        shell("input keyevent KEYCODE_HOME")
        time.sleep(1.2)
    shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity --ez com.feelime.ime.extra.SHOW_DEBUG_FIXTURES true")
    time.sleep(3.5)
    scroll_setup_top()
    bounds = remember_field(visible_field_bounds()) or LAST_FIELD_BOUNDS
    if bounds:
        tap((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 2.0)
    chip2 = None
    for _ in range(5):
        chip2 = keyboard_chip()
        if chip2 is not None:
            break
        time.sleep(0.9)
    record("H1 mode persisted across process death", chip2 in ("拼", "PY"), f"chip={chip2!r}")
    devtools_click_mode("英文 Direct")
    time.sleep(0.8)


def case_settings_entry(kb):
    kb = fresh_kb() or kb
    opened = False
    detail = ""
    before_xml = ui_dump()
    before_match = re.search(
        rf'content-desc="({re.escape(SETUP_LAUNCH_DESCRIPTION_PREFIX)}\d+)"', before_xml
    )
    before_marker = before_match.group(1) if before_match else None
    # M4 moved settings to the toolbar setupButton; Turned that
    # button into the quick settings PANEL. Moved the full
    # SetupActivity entry from a panel row into a toolbar button that only
    # shows while the panel is open.
    click_js = (
        "(() => { const b = document.getElementById('setupButton');"
        " if (!b) return 'no-setup-button';"
        " b.click(); return 'clicked'; })()"
    )
    open_js = (
        "(() => { const b = document.getElementById('fullSetupButton');"
        " if (!b) return 'no-button';"
        " if (b.hidden) return 'hidden'; b.click(); return 'clicked'; })()"
    )
    result2 = None
    for attempt in range(3):
        close_mode_menu_if_open()
        result = devtools_eval(click_js)
        if result is None:
            # The persistent socket can die mid-suite (zombie page or drop);
            # markers in the dump below prove the click often landed anyway.
            # Force a fresh connection and click once more for observability.
            global _DT_SOCKET, _DT_PID
            _DT_SOCKET = None
            _DT_PID = None
            time.sleep(1.0)
            result = devtools_eval(click_js)
        time.sleep(0.9)
        panel_open = devtools_eval(
            "(() => { const p = document.getElementById('settingsPanel');"
            " return !!p && p.classList.contains('open') && !p.hidden; })()"
        )
        if panel_open is True:
            result2 = devtools_eval(open_js)
            time.sleep(1.4)
        scroll_setup_top()
        xml = ui_dump()
        markers = [m for m in ("麦克风", "启用", "下载并安装", "恢复") if m in xml]
        after_match = re.search(
            rf'content-desc="({re.escape(SETUP_LAUNCH_DESCRIPTION_PREFIX)}\d+)"', xml
        )
        after_marker = after_match.group(1) if after_match else None
        # The redesigned settings page varies its copy per state; the durable
        # oracle is the launch counter increment plus the resumed activity.
        resumed = shell("dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity'")

        detail = (f"result={result!r} panel={panel_open!r} full={result2!r} "
                  f"before={before_marker!r} "
                  f"after={after_marker!r} markers={markers} resumed={resumed!r}")
        if (result == "clicked" and panel_open is True and result2 == "clicked"
                and after_marker and after_marker != before_marker
                and "SetupActivity" in resumed):
            opened = True
            break
    record("K1 setup button opens quick panel, row launches full settings", opened, detail)
    shell("input keyevent KEYCODE_BACK")
    time.sleep(0.8)
    # The panel sits over the keyboard; a stale open state would swallow the
    # next suite's keys.
    devtools_eval("window.Feelime && window.Feelime.closeSettingsPanel()")
    time.sleep(0.3)


def main():
    prepare()
    kb = fresh_kb(refocus=True)
    if not kb:
        record("keyboard geometry detected", False)
        sys.exit(1)
    reset_shift(kb)
    # Normalize to DIRECT mode: earlier runs may leave CJK modes active.
    devtools_click_mode("英文 Direct")
    time.sleep(1.2)
    record("mode normalized to direct", keyboard_chip() == "En", keyboard_chip())
    # The mode switch re-renders the key grid (e.g. Russian layout has no
    # 'h'); recalibrate before any case runs.
    kb = fresh_kb(refocus=True) or kb
    record("no leftover shift state", not kb.get("<shift-green>"))
    # The hook eval can race a not-yet-ready WebView and come back empty,
    # which silently empties every later commit-trace assertion (C4/C5/D2).
    # Retry until the page confirms the hook is installed.
    for _ in range(6):
        hooked = devtools_eval(
            "(() => { if (!window.Feelime || !window.Feelime.onEngineState) return 'not-ready';"
            " window.__ev = []; for (const k of ['onEngineState','onNativeState']) {"
            " const o = window.Feelime[k];"
            " window.Feelime[k] = p => { try { window.__ev.push(k[2] + ':' + p.phase + ':' + p.code + ':' + p.mode + ':' + (p.composing || '') + ':c' + (p.candidates ? p.candidates.length : 0) + ':m' + (p.commit || '')); } catch (e) {} o(p); }; }"
            " return 'hooked'; })()"
        )
        if hooked == "hooked":
            break
        time.sleep(0.8)
    else:
        record("commit trace hook installed", False, repr(hooked))
    if not kb:
        record("keyboard geometry detected", False)
        screenshot("/tmp/fv-geometry-fail.png")
        metrics = keyboard_metrics()
        print("diagnostics: metrics =", metrics)
        sys.exit(1)
    record("keyboard geometry detected", True, f"{len(kb)} keys")
    case_english(kb)
    case_pinyin(kb)
    case_double_pinyin(kb)
    case_layouts(kb)
    case_symbols(kb)
    case_mode_persistence(kb)
    case_settings_entry(kb)
    failed = [name for name, ok, _ in RESULTS if not ok]
    print(f"\n== {len(RESULTS) - len(failed)}/{len(RESULTS)} passed ==")
    trace = devtools_eval("window.__ev ? window.__ev.slice(-60) : []")
    if trace:
        print("-- engine event trace (tail) --")
        for line in trace:
            print("  ", line)
    if failed:
        print("FAILED:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("SUITE ERROR:", error)
        try:
            trace = devtools_eval("window.__ev ? window.__ev.slice(-80) : []")
            if trace:
                print("-- engine event trace (tail) --")
                for line in trace:
                    print("  ", line)
            print("chip:", keyboard_chip())
            print("candidates:", devtools_candidates())
        except Exception:
            pass
        raise
