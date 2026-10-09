#!/usr/bin/env python3
""" Settings and system-entry device checks.

The settings WebView is an observation channel only.  Settings buttons,
DocumentsUI, the IME picker, and every system surface are driven with real
ADB input.  The local keyboard package is supplied by ``FEELIME_KEYBOARD_ZIP``;
the local-install case turns airplane mode on before selecting it, then
restores the device network state.

Launcher and widget UIs are vendor-specific.  This gate observes whether the
app reached their add-request UI, but it never reports a shortcut, widget, or
Quick Settings tile as verified merely because the request returned.  It
prints executable MANUAL steps for adding and tapping each entry.
"""

import hashlib
import json
import os
import re
import shlex
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from xml.etree import ElementTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fv_common as shared
import device_model_import_verify as saf
import device_verify as d


PKG = d.PKG
SETTINGS_MARKER = "settings/index.html"
REMOTE_DIR = "/sdcard/Download"
IMPORT_TIMEOUT = float(os.environ.get("FEELIME_KEYBOARD_IMPORT_TIMEOUT_S", "60"))
RESULTS = []
MANUAL = []
SKIPPED = []


_SAF_PICKER_XML = saf.picker_xml


def strict_picker_xml():
    """Reject a Settings UI dump while DocumentsUI focus is still stale."""
    xml = _SAF_PICKER_XML()
    if not xml:
        return ""
    focus = d.shell("dumpsys window | grep -m1 -iE 'mCurrentFocus|mFocusedApp'")
    body = (xml + "\n" + focus).casefold()
    if "documentsui" not in body:
        return ""
    # During rotation the window focus can remain on DocumentsUI for several
    # seconds while uiautomator still returns the old Settings WebView.  A
    # genuine file picker has one of these provider/navigation markers.
    if not any(marker in body for marker in (
        "recent", "downloads", "download", "open from", "打开方式",
        "search", "搜索", "no items", "没有项目", ".zip",
    )):
        return ""
    return xml


# ``device_model_import_verify`` shares this picker oracle with its own gate;
# patching the module here keeps picker_open/picker_nodes/choose_archive on the
# same strict path without broadening the production code.
saf.picker_xml = strict_picker_xml


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def skip(name, detail):
    SKIPPED.append((name, detail))
    print(f"SKIP {name}  [{detail}]", flush=True)


def manual(name, steps):
    MANUAL.append((name, steps))


def poll(read, predicate=lambda value: bool(value), timeout=8.0, interval=0.3):
    """Poll without returning a stale value as evidence of success."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = read()
        except Exception:
            value = None
        if predicate(value):
            return value
        time.sleep(interval)
    return None


def settings_eval(expression):
    """Read-only DevTools access to the settings WebView."""
    return d.devtools_eval_target(SETTINGS_MARKER, expression)


def settings_ime_state():
    return settings_eval(
        "(() => {"
        " const hero=document.getElementById('heroStatus');"
        " const row=document.getElementById('imeDefaultRow');"
        " const led=row?.querySelector('[data-led]');"
        " const button=document.getElementById('btnPickIme');"
        " return {hero:hero?.textContent?.trim() || '',"
        " led:led?.className || '', pickHidden:!!button?.hidden,"
        " page:[...document.querySelectorAll('.page')].find(p=>!p.hidden)"
        " ?.dataset.page || ''}; })()"
    )


def update_state():
    return settings_eval(
        "(() => { const node=document.getElementById('updateStatus');"
        " const local=document.getElementById('btnImportZip');"
        " return {text:node?.textContent?.trim() || '',"
        " localHidden:!!local?.hidden,"
        " page:[...document.querySelectorAll('.page')].find(p=>!p.hidden)"
        " ?.dataset.page || ''}; })()"
    )


def status_parts(state):
    text = str((state or {}).get("text", ""))
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    version_match = re.search(
        r"(?:版本|Version)\s*[:：]\s*([^\s]+)", text, re.IGNORECASE
    )
    state_line = next(
        (line for line in lines if line.startswith("状态") or
         line.lower().startswith("status")), ""
    )
    return {
        "lines": lines,
        "source": lines[0] if lines else "",
        "version": version_match.group(1) if version_match else "",
        "state": state_line,
        "text": text,
    }


def last_success_at(state):
    text = status_parts(state)["text"]
    match = re.search(
        r"(?:Last success|上次成功|最近成功)\s*[:：]\s*(\d+)",
        text,
        re.IGNORECASE,
    )
    return int(match.group(1)) if match else None


def active_fingerprint(state):
    parts = status_parts(state)
    hash_match = re.search(
        r"(?:校验内容|内容校验|Content hash)\s*[:：]\s*([^\s…]+)",
        parts["text"], re.IGNORECASE,
    )
    return parts["source"], parts["version"], hash_match.group(1) if hash_match else ""


def active_content_hash(state):
    return active_fingerprint(state)[2]


def is_update_page(state):
    return isinstance(state, dict) and state.get("page") == "update"


def update_failed(state):
    parts = status_parts(state)
    status = parts["state"].casefold()
    return any(marker in status for marker in (
        "失败", "failed", "invalid", "unknown", "signature", "签名",
        "清单", "manifest", "格式", "format", "文件", "file",
    ))


def update_active(state, version="", content_hash=""):
    parts = status_parts(state)
    source = parts["source"].casefold()
    status = parts["state"].casefold()
    source_ok = "热更新" in source or "hot-updated" in source
    # Re-importing the exact same content is reported as READY by the store;
    # that is still an active hot-update and must remain a valid repeat run.
    state_ok = any(marker in status for marker in ("已启用", "就绪", "active", "ready"))
    version_ok = not version or parts["version"] == version
    observed_hash = active_content_hash(state)
    hash_ok = not content_hash or (
        bool(observed_hash) and content_hash.casefold().startswith(observed_hash.casefold())
    )
    return source_ok and state_ok and version_ok and hash_ok


def import_state_ready(state):
    parts = status_parts(state)
    return is_update_page(state) and (
        update_failed(state) or
        any(marker in parts["state"].casefold() for marker in (
            "已启用", "就绪", "active", "ready",
        ))
    )


def transition_after_import(before, after, package):
    """Require a new success timestamp, hash, or observed state transition."""
    return transition_after_import_with_states(before, after, package, ())


def transition_after_import_with_states(before, after, package, observed_states):
    if not update_active(after, package["version"], package["content_hash"]):
        return False
    before_success = last_success_at(before)
    after_success = last_success_at(after)
    if before_success is not None and after_success is not None:
        return after_success > before_success
    before_hash = active_content_hash(before)
    expected_hash = package["content_hash"].casefold()
    if before_hash and before_hash.casefold() != expected_hash[:len(before_hash)]:
        return True
    before_status = status_parts(before)["state"].casefold()
    return any(
        item.casefold() != before_status
        for item in observed_states
        if item
    )


def launch_settings_home(force=True):
    if force:
        d.shell("am force-stop " + PKG)
        time.sleep(1.0)
    else:
        pages = shared.settings_visible_pages()
        if pages in (["home"], ["update"]):
            return True
    d._DT_SOCKET = None
    if not shared.launch_settings(with_fixtures=False):
        return False
    return bool(poll(
        shared.settings_visible_pages,
        lambda pages: pages in (["home"], ["update"]),
        timeout=10.0,
    ))


def launch_update_page(force=False):
    if not launch_settings_home(force=force):
        return False
    pages = shared.settings_visible_pages()
    if pages != ["update"]:
        if not shared.settings_tap('button[data-target="update"]', wait=0.7):
            return False
    return bool(poll(
        shared.settings_visible_pages,
        lambda value: value == ["update"],
        timeout=6.0,
    ))


def local_archive(raw, label):
    path = Path(raw).expanduser()
    if not path.is_file():
        raise SystemExit(f"{label} is not a file: {path}")
    if path.stat().st_size <= 0:
        raise SystemExit(f"{label} is empty: {path}")
    return path


def archive_info(path):
    try:
        with zipfile.ZipFile(path) as archive:
            manifest_bytes = archive.read("feelime-keyboard.json")
            manifest = json.loads(manifest_bytes)
            version = str(manifest["keyboardVersion"])
            version_file = archive.read("VERSION").decode().strip()
    except (KeyError, ValueError, UnicodeError, zipfile.BadZipFile) as error:
        raise SystemExit(f"FEELIME_KEYBOARD_ZIP is not a keyboard package: {error}")
    if not version or version != version_file:
        raise SystemExit(
            "FEELIME_KEYBOARD_ZIP has inconsistent manifest/VERSION: "
            f"{version!r} != {version_file!r}"
        )
    return {
        "version": version,
        "content_hash": hashlib.sha256(manifest_bytes).hexdigest(),
    }


def make_bad_archive():
    tmp_root = Path(os.environ.get("FEELIME_TMP_DIR", Path.home() / "tmp"))
    tmp_root.mkdir(parents=True, exist_ok=True)
    handle, raw = tempfile.mkstemp(
        prefix="feelime-keyboard-b27-invalid-", suffix=".zip", dir=tmp_root
    )
    os.close(handle)
    path = Path(raw)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.txt", "not a Feelime keyboard package\n")
    return path


def remote_archive(path, label):
    remote = f"{REMOTE_DIR}/feelime-keyboard-b27-{label}-{os.getpid()}.zip"
    quoted = shlex.quote(remote)
    d.shell("rm -f " + quoted)
    d.adb("push", str(path), remote, timeout=120)
    expected = path.stat().st_size
    observed = poll(
        lambda: d.shell("wc -c < " + quoted).strip(),
        lambda value: bool(re.fullmatch(r"\d+", str(value or "")))
        and int(value) == expected,
        timeout=20.0,
        interval=0.5,
    )
    if observed is None:
        raise RuntimeError(
            f"adb push did not expose {remote}: expected={expected}"
        )
    # Help DocumentsUI refresh the shared Downloads provider on older images.
    d.shell(
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "
        + shlex.quote("file://" + remote)
    )
    return remote


def cleanup_remote(*remotes):
    for remote in remotes:
        if remote:
            d.shell("rm -f " + shlex.quote(remote))


def node_bounds(node):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    return tuple(map(int, match.groups())) if match else None


def parsed_nodes(xml):
    if not xml:
        return []
    try:
        return list(ElementTree.fromstring(xml).iter("node"))
    except ElementTree.ParseError:
        return []


def tap_node_matching(xml, predicate):
    candidates = []
    for node in parsed_nodes(xml):
        if not predicate(node):
            continue
        bounds = node_bounds(node)
        if not bounds:
            continue
        area = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])
        candidates.append((area, node, bounds))
    if not candidates:
        return False
    _, _, bounds = sorted(candidates, key=lambda item: item[0])[0]
    d.tap((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2, wait=0.8)
    return True


def node_text(node):
    return " ".join((node.get("text", ""), node.get("content-desc", ""))).strip()


def ime_picker_xml():
    xml = d.ui_dump()
    focus = d.shell("dumpsys window | grep -m1 -iE 'mCurrentFocus|mFocusedApp'")
    body = (xml + "\n" + focus).casefold()
    # Android versions use different picker package/window names. Require the
    # picker title or a keyboard/input-method label together with Feelime so a
    # normal settings page containing the app name is not mistaken for it.
    if "feelime" not in body:
        return ""
    if any(marker in body for marker in (
        "choose input method", "选择输入法", "input method", "输入法",
        "keyboard", "键盘",
    )):
        return xml
    return ""


def choose_feelime_from_picker():
    xml = poll(ime_picker_xml, lambda value: bool(value), timeout=10.0)
    if not xml:
        return False
    return tap_node_matching(
        xml,
        lambda node: "feelime" in node_text(node).casefold(),
    )


def current_default_ime():
    value = d.shell("settings get secure default_input_method").strip()
    return value if value not in ("", "null") else ""


def ime_components():
    raw = d.shell("ime list -s")
    return [line.strip() for line in raw.splitlines()
            if re.fullmatch(r"[A-Za-z0-9._]+/[A-Za-z0-9_.$]+", line.strip())]


def set_default_ime(component):
    if not component:
        return False
    quoted = shlex.quote(component)
    d.shell("ime enable " + quoted)
    d.shell("ime set " + quoted)
    return bool(poll(current_default_ime, lambda value: component in str(value), timeout=10.0))


def case_default_picker(initial_default, alternative):
    if not alternative:
        skip(
            "system IME picker return refresh",
            "no non-Feelime IME is installed; cannot create the required precondition",
        )
        return
    if not set_default_ime(alternative):
        record(
            "non-Feelime IME precondition",
            False,
            f"could not select {alternative}",
        )
        return
    if not launch_settings_home(force=True):
        record("settings home reaches IME status card", False, "settings unavailable")
        return
    before = poll(settings_ime_state, lambda value: isinstance(value, dict), timeout=8.0)
    before_not_default = bool(
        before and "ok" not in str(before.get("led", "")).split()
        and before.get("pickHidden") is False
    )
    record(
        "settings shows non-default state before picker",
        before_not_default,
        str(before),
    )
    tapped = shared.settings_tap("#btnPickIme", wait=0.8)
    opened = bool(poll(ime_picker_xml, lambda value: bool(value), timeout=10.0))
    if not tapped or not opened:
        record(
            "settings opens the real system IME picker",
            False,
            f"tapped={tapped} opened={opened}",
        )
        return
    selected = choose_feelime_from_picker()
    if not selected:
        record("system picker selects Feelime by physical tap", False, "Feelime row missing")
        return
    selected_default = poll(
        current_default_ime,
        lambda value: PKG in str(value),
        timeout=12.0,
    )
    after = poll(
        settings_ime_state,
        lambda value: isinstance(value, dict)
        and "ok" in str(value.get("led", "")).split()
        and value.get("pickHidden") is True,
        timeout=12.0,
    )
    refreshed = bool(selected_default and after)
    record(
        "returning from IME picker refreshes settings without reopening",
        refreshed,
        f"default={selected_default!r} state={after}",
    )


def prompt_xml(kind):
    xml = d.ui_dump()
    focus = d.shell("dumpsys window | grep -m1 -iE 'mCurrentFocus|mFocusedApp'")
    body = (xml + "\n" + focus).casefold()
    markers = {
        "shortcut": ("add to home", "添加到主屏幕", "快捷方式"),
        "widget": ("add widget", "添加小组件", "widget", "小部件"),
        "tile": ("quick settings", "快捷设置", "tile", "磁贴"),
    }[kind]
    # The settings page itself contains these labels.  Require a launcher or
    # SystemUI window as well, otherwise the underlying WebView would make an
    # unsupported request look like a confirmation dialog.
    focus_ok = any(marker in focus.casefold() for marker in (
        "launcher", "systemui", "permissioncontroller", "quickstep",
        "tilerequestdialog", "shortcutrequest", "widgetrequest",
    ))
    # AOSP's tile confirmation window is named TileRequestDialog rather than
    # carrying a SystemUI package in the focus line.  Inspect node packages
    # too, while keeping the settings WebView itself out of the match.
    system_surface = any(
        "systemui" in node.get("package", "").casefold()
        or "launcher" in node.get("package", "").casefold()
        for node in parsed_nodes(xml)
    )
    return xml if (focus_ok or system_surface) and any(marker in body for marker in markers) else ""


def case_system_entry_requests(alternative):
    if not alternative:
        skip("system entry requests", "no alternate IME for the non-default precondition")
        return
    if not set_default_ime(alternative):
        skip("system entry requests", f"could not select alternate IME {alternative}")
        return
    if not launch_settings_home(force=True):
        record("system entry buttons are reachable", False, "settings unavailable")
        return
    entries = (
        ("shortcut", "#btnAddShortcut", "桌面快捷方式"),
        ("widget", "#btnAddWidget", "桌面小组件"),
        ("tile", "#btnAddTile", "快捷设置磁贴"),
    )
    for kind, selector, label in entries:
        tapped = shared.settings_tap(selector, wait=0.8)
        prompt = bool(poll(
            lambda: prompt_xml(kind),
            lambda value: bool(value),
            timeout=6.0,
        )) if tapped else False
        if prompt:
            print(f"OBSERVED {label} request reached a system add UI", flush=True)
            # Leave the launcher/control-center surface unchanged for the next
            # request. The actual add-and-tap path is emitted as MANUAL below.
            d.shell("input keyevent KEYCODE_BACK")
            time.sleep(0.8)
        else:
            print(
                f"OBSERVED {label} request did not expose a recognized generic prompt "
                f"(tapped={tapped})",
                flush=True,
            )
        manual(
            label,
            [
                f"保持 Feelime 非默认（可执行：adb -s $FEELIME_ADB_SERIAL shell ime set {alternative}）。",
                f"在设置页点“{label}”，按当前启动器/系统界面确认添加。",
                f"从桌面或控制中心找到“输入法切换”，用真实触摸点按；应打开 Android 系统输入法选择器。",
                "在选择器中点 Feelime，再按返回；设置页状态应显示已设为默认。",
            ],
        )


def open_keyboard_picker():
    if not launch_update_page(force=False):
        return False
    tapped = shared.settings_tap("#btnImportZip", wait=0.8)
    return bool(tapped and saf.picker_open(timeout=12.0))


def wait_picker_closed(timeout=10.0):
    time.sleep(0.6)
    return bool(poll(lambda: not saf.picker_xml(), lambda value: value is True, timeout=timeout))


def restore_portrait():
    """Restore portrait after DocumentsUI's rotation recreation.

    On the API-34 AVD, setting ``user_rotation`` immediately after toggling
    the accelerometer can race the display service: the helper may time out
    with ``user_rotation`` still at 1 even though accelerometer rotation is
    disabled.  A second write after the helper returns makes the test cleanup
    deterministic and lets the settings Activity be relaunched on a stable
    display.
    """
    value = saf.set_orientation(False)
    if value not in (0, 2):
        d.shell("settings put system accelerometer_rotation 0")
        time.sleep(0.8)
        d.shell("settings put system user_rotation 0")
        value = poll(
            saf.rotation_value,
            lambda current: current in (0, 2),
            timeout=10.0,
            interval=0.6,
        )
    d._DT_SOCKET = None
    return value


def case_cancel_and_rotate(baseline):
    if not open_keyboard_picker():
        record("local keyboard import opens DocumentsUI", False, "import button or picker unavailable")
        return
    rotated = saf.set_orientation(True)
    still_open = bool(saf.picker_open(timeout=10.0))
    rotation_ok = rotated in (1, 3) and still_open
    record(
        "local keyboard DocumentsUI survives physical rotation",
        rotation_ok,
        f"rotation={rotated} picker={still_open}",
    )
    d.shell("input keyevent KEYCODE_BACK")
    closed = wait_picker_closed()
    portrait = restore_portrait()
    # DocumentsUI rotation recreates SetupActivity and the settings page
    # intentionally starts at home. Reopen the update page before observing
    # the unchanged status; otherwise a valid cancellation looks like a lost
    # update state and prevents the following import cases from running.
    after = None
    if launch_update_page(force=True):
        after = poll(update_state, is_update_page, timeout=10.0)
    unchanged = bool(
        after and baseline and active_fingerprint(after) == active_fingerprint(baseline)
    )
    record(
        "cancelling local keyboard picker leaves active keyboard unchanged",
        closed and unchanged,
        f"closed={closed} portrait={portrait} before={baseline} after={after}",
    )


def import_keyboard(remote, label):
    before = None
    if launch_update_page(force=False):
        before = poll(update_state, is_update_page, timeout=10.0)
    if not before:
        record(f"{label} baseline status is observable", False, "update page unavailable")
        return None
    if not open_keyboard_picker():
        record(f"{label} opens DocumentsUI", False, "import button or picker unavailable")
        return None
    selected = saf.choose_archive(remote)
    if not selected:
        record(f"{label} selects ZIP through DocumentsUI", False, f"remote={remote}")
        return None
    before_status = status_parts(before)["state"].casefold() if before else ""
    before_success = last_success_at(before)
    before_hash = active_content_hash(before)

    def changed_ready(value):
        if not import_state_ready(value):
            return False
        parts = status_parts(value)
        return (
            parts["state"].casefold() != before_status
            or last_success_at(value) != before_success
            or active_content_hash(value) != before_hash
        )

    return poll(
        update_state,
        changed_ready,
        timeout=IMPORT_TIMEOUT,
        interval=0.4,
    )


def case_rotated_valid_import(remote, package):
    """Select the existing valid archive only after DocumentsUI recreated itself."""
    before = None
    rotated = None
    picker_after_rotation = False
    rotation_error = ""
    selected = False
    state = None
    observed_states = []
    portrait = None

    if launch_update_page(force=False):
        before = poll(update_state, is_update_page, timeout=10.0)
    if not before:
        record(
            "valid local keyboard ZIP opens DocumentsUI for rotated selection",
            False,
            "update status unavailable before import",
        )
        return
    if not open_keyboard_picker():
        record(
            "valid local keyboard ZIP opens DocumentsUI for rotated selection",
            False,
            "import button or picker unavailable",
        )
        return

    try:
        rotated = saf.set_orientation(True)
        picker_after_rotation = bool(saf.picker_open(timeout=10.0))
    except Exception as error:
        rotation_error = repr(error)
    rotation_ok = rotated in (1, 3) and picker_after_rotation
    record(
        "valid local keyboard picker rotates before ZIP selection",
        rotation_ok,
        f"rotation={rotated} picker={picker_after_rotation}"
        + (f" error={rotation_error}" if rotation_error else ""),
    )

    try:
        if rotation_ok:
            # Reuse the same pushed archive as the ordinary import case.  The
            # URI is selected through DocumentsUI after its rotation, so this
            # exercises the recreated picker and its hand-off to Settings.
            selected = saf.choose_archive(remote)
            if selected:
                # Rotation recreates SetupActivity and returns it to home on
                # this AVD. Reopen update before reading the result, then
                # reject the pre-existing ACTIVE/old-error text unless the
                # success timestamp, hash, or observed state actually moves.
                if launch_update_page(force=False):
                    before_status = status_parts(before)["state"].casefold()
                    before_success = last_success_at(before)
                    before_hash = active_content_hash(before)

                    def read_after_import():
                        value = update_state()
                        if value:
                            observed_states.append(status_parts(value)["state"])
                        return value

                    def completed_after_rotation(value):
                        if not import_state_ready(value):
                            return False
                        if not update_active(
                            value, package["version"], package["content_hash"]
                        ):
                            return False
                        after_success = last_success_at(value)
                        if (
                            before_success is not None
                            and after_success is not None
                        ):
                            return after_success > before_success
                        after_hash = active_content_hash(value)
                        if after_hash and before_hash:
                            return after_hash.casefold() != before_hash.casefold()
                        return transition_after_import_with_states(
                            before, value, package, observed_states
                        )

                    state = poll(
                        read_after_import,
                        completed_after_rotation,
                        timeout=IMPORT_TIMEOUT,
                        interval=0.4,
                    )
    finally:
        if saf.picker_xml():
            d.shell("input keyevent KEYCODE_BACK")
            wait_picker_closed()
        portrait = restore_portrait()

    activated = bool(
        state and update_active(state, package["version"], package["content_hash"])
    )
    record(
        "valid local keyboard ZIP activates after DocumentsUI rotation",
        rotation_ok and selected and activated
        and transition_after_import_with_states(
            before, state, package, observed_states
        ),
        f"rotation={rotated} selected={selected} portrait={portrait} "
        f"beforeSuccess={last_success_at(before)} afterSuccess={last_success_at(state)} "
        f"beforeHash={active_content_hash(before)} afterHash={active_content_hash(state)} "
        f"expected={package['version']} expectedHash={package['content_hash']} "
        f"state={state}",
    )


def case_local_import(good_remote, bad_remote, package, baseline):
    bad_state = import_keyboard(bad_remote, "坏键盘包导入")
    bad_ok = bool(
        bad_state and update_failed(bad_state)
        and active_fingerprint(bad_state) == active_fingerprint(baseline)
    )
    record(
        "malformed local keyboard ZIP is rejected without replacing the active keyboard",
        bad_ok,
        f"before={baseline} after={bad_state}",
    )

    case_rotated_valid_import(good_remote, package)

    good_state = import_keyboard(good_remote, "有效键盘包导入")
    good_ok = bool(
        good_state
        and update_active(
            good_state, package["version"], package["content_hash"]
        )
    )
    record(
        "valid local keyboard ZIP installs while network is disabled",
        good_ok,
        f"expected={package['version']} state={good_state}",
    )

    # Recreate the settings Activity to prove activation was persisted, rather
    # than accepting only the one-shot bridge event after the picker closes.
    persisted = None
    if good_ok:
        persisted = poll(
            lambda: (launch_update_page(force=True) and update_state()),
            lambda value: is_update_page(value)
            and update_active(
                value, package["version"], package["content_hash"]
            ),
            timeout=15.0,
            interval=0.6,
        )
    record(
        "local keyboard activation survives settings Activity recreation",
        bool(persisted),
        f"state={persisted}",
    )


def setting_value(scope, key):
    value = d.shell(f"settings get {scope} {key}").strip()
    return value if value not in ("", "null") else ""


def set_airplane(enabled):
    state = "true" if enabled else "false"
    d.shell("settings put global airplane_mode_on " + ("1" if enabled else "0"))
    d.shell(
        "am broadcast -a android.intent.action.AIRPLANE_MODE --ez state " + state
    )
    time.sleep(1.0)


def disable_network():
    initial = {
        "airplane": setting_value("global", "airplane_mode_on"),
        "wifi": setting_value("global", "wifi_on") or setting_value("system", "wifi_on"),
        "data": setting_value("global", "mobile_data"),
    }
    set_airplane(True)
    d.shell("svc wifi disable")
    d.shell("svc data disable")
    observed = setting_value("global", "airplane_mode_on")
    return initial, observed == "1"


def restore_network(initial):
    if initial.get("airplane") == "1":
        set_airplane(True)
    elif initial.get("airplane") == "0":
        set_airplane(False)
    if initial.get("wifi") in {"0", "1"}:
        d.shell("svc wifi " + ("enable" if initial["wifi"] == "1" else "disable"))
    if initial.get("data") in {"0", "1"}:
        d.shell("svc data " + ("enable" if initial["data"] == "1" else "disable"))


def main():
    # 事故门闸（2026-10-10，ace 实录）：本套件为测离线路径会动设备全局
    # 网络状态（airplane + svc wifi/data）。在真机上跑会切断设备自身的
    # 无线电——ace 的 chroot 跑在手机上，adb 通道随网络一起死，
    # restore_network 都发不出去（finally 存在但执行不到）。默认只许
    # 一次性模拟器（emulator-*）；真机要跑必须显式
    # FEELIME_ALLOW_DEVICE_MUTATIONS=1 自担恢复。
    serial = d.SERIAL
    if not serial.startswith("emulator-") and \
            os.environ.get("FEELIME_ALLOW_DEVICE_MUTATIONS") != "1":
        raise SystemExit(
            "refusing to run: this suite toggles airplane/wifi/data device-"
            "globally. Use a disposable emulator (emulator-*), or set "
            "FEELIME_ALLOW_DEVICE_MUTATIONS=1 to accept mutating a real "
            "device (restore may be impossible if adb rides that network).")
    raw_good = os.environ.get("FEELIME_KEYBOARD_ZIP", "").strip()
    if not raw_good:
        raise SystemExit("FEELIME_KEYBOARD_ZIP is required")
    good_path = local_archive(raw_good, "FEELIME_KEYBOARD_ZIP")
    package = archive_info(good_path)
    raw_bad = os.environ.get("FEELIME_KEYBOARD_BAD_ZIP", "").strip()
    generated_bad = None
    if raw_bad:
        bad_path = local_archive(raw_bad, "FEELIME_KEYBOARD_BAD_ZIP")
    else:
        generated_bad = make_bad_archive()
        bad_path = generated_bad

    initial_default = current_default_ime()
    alternative = next((item for item in ime_components() if PKG not in item), "")
    initial_accel = setting_value("system", "accelerometer_rotation")
    initial_rotation = setting_value("system", "user_rotation")
    initial_network = {}
    good_remote = bad_remote = None
    try:
        case_default_picker(initial_default, alternative)
        case_system_entry_requests(alternative)

        # Push while connectivity is still available. ADB transport remains
        # local, and the import itself starts only after airplane mode is set.
        good_remote = remote_archive(good_path, "good")
        bad_remote = remote_archive(bad_path, "bad")
        initial_network, offline = disable_network()
        record(
            "device is offline before local keyboard import",
            offline,
            f"airplane_mode_on={setting_value('global', 'airplane_mode_on')}",
        )

        if not launch_update_page(force=True):
            record("keyboard update page is reachable", False, "settings update page unavailable")
        else:
            baseline = poll(update_state, is_update_page, timeout=10.0)
            if not baseline:
                record("keyboard update status is observable", False, "missing #updateStatus")
            else:
                record("keyboard update status is observable", True, str(baseline))
                case_cancel_and_rotate(baseline)
                case_local_import(good_remote, bad_remote, package, baseline)
        return 0 if all(ok for _, ok, _ in RESULTS) else 1
    except Exception as error:
        record("settings device suite execution", False, repr(error))
        return 1
    finally:
        # Never leave the test archive in shared storage or leave system state
        # changed. If a picker is still open, dismiss it with a real BACK key.
        if saf.picker_xml():
            d.shell("input keyevent KEYCODE_BACK")
        if initial_accel in {"0", "1"}:
            d.shell("settings put system accelerometer_rotation " + initial_accel)
        if initial_rotation in {"0", "1", "2", "3"}:
            d.shell("settings put system user_rotation " + initial_rotation)
        if initial_network:
            restore_network(initial_network)
        cleanup_remote(good_remote, bad_remote)
        if generated_bad:
            try:
                generated_bad.unlink()
            except OSError:
                pass
        if initial_default and current_default_ime() != initial_default:
            set_default_ime(initial_default)
        print_summary()


def print_summary():
    failed = [name for name, ok, _ in RESULTS if not ok]
    passed = len(RESULTS) - len(failed)
    print(f"\n== settings-entry device suite: {passed}/{len(RESULTS)} passed ==")
    if failed:
        print("failures: " + " | ".join(failed))
    if SKIPPED:
        print("skips:")
        for name, detail in SKIPPED:
            print(f"  - {name}: {detail}")
    if MANUAL:
        print("manual checks (not counted as PASS):")
        for name, steps in MANUAL:
            print(f"  {name}:")
            for index, step in enumerate(steps, 1):
                print(f"    {index}. {step}")


if __name__ == "__main__":
    main()
