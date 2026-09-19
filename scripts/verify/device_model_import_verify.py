#!/usr/bin/env python3
"""Verify model import through Android's real Storage Access Framework.

The model row is found and observed through the settings WebView's DevTools
oracle, but every action under test is a physical ADB action:

* the model's ``导入模型文件`` button is tapped through
  :func:`device_height_card_verify.settings_tap`;
* the archive is selected in DocumentsUI from ``Downloads`` (or by its
  visible ASCII search result); and
* cancellation, rotation, and picker confirmation use Android input/settings
  commands.

The local archive is deliberately injected by the caller.  A test run must
set ``FEELIME_IMPORT_MODEL_ID`` and ``FEELIME_IMPORT_ARCHIVE``.  It may also set
``FEELIME_IMPORT_BAD_ARCHIVE`` (or ``FEELIME_IMPORT_INVALID_ARCHIVE``); when that
variable is absent this script creates a small malformed model ZIP under the
usual temporary directory.  No model path, device serial, or personal host
path is embedded in the gate.

This gate is intentionally separate from ``device_models_verify.py``: it
proves the user-facing file picker and URI hand-off, while that suite proves
thin-package downloads and the complete model manifest.
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
import device_verify as d


PKG = d.PKG
SETTINGS_MARKER = "settings/index.html"
MODEL_ID = os.environ.get("FEELIME_IMPORT_MODEL_ID", "").strip()
GOOD_ARCHIVE = os.environ.get("FEELIME_IMPORT_ARCHIVE", "").strip()
BAD_ARCHIVE = (
    os.environ.get("FEELIME_IMPORT_BAD_ARCHIVE", "").strip()
    or os.environ.get("FEELIME_IMPORT_INVALID_ARCHIVE", "").strip()
)
IMPORT_TIMEOUT = float(os.environ.get("FEELIME_IMPORT_TIMEOUT_S", "180"))
KEEP_ARCHIVE = os.environ.get("FEELIME_IMPORT_KEEP_ARCHIVE", "").strip() == "1"
REMOTE_DIR = "/sdcard/Download"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name +
          (f"  [{detail}]" if detail else ""), flush=True)


def settings_eval(expression):
    """Read-only DevTools access to the settings WebView."""
    return d.devtools_eval_target(SETTINGS_MARKER, expression)


def wait_until(read, predicate=lambda value: bool(value), timeout=8.0,
               interval=0.25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = read()
        except Exception:
            value = None
        if predicate(value):
            return value
        time.sleep(interval)
    # A stale observation is not evidence that the requested state was ever
    # reached.  Callers must receive an explicit timeout result so a previous
    # error/success cannot be mistaken for the new state.
    return None


def model_selector():
    # Model IDs originate in the embedded manifest.  Keep the selector
    # construction closed to CSS/JS injection even though the normal IDs are
    # ASCII slugs.
    if not re.fullmatch(r"[A-Za-z0-9._-]+", MODEL_ID):
        raise ValueError("FEELIME_IMPORT_MODEL_ID must be an ASCII model ID")
    quoted = json.dumps(MODEL_ID)
    return f".model[data-id={quoted}]"


def model_state():
    selector = json.dumps(model_selector())
    return settings_eval(
        "(() => { const row = document.querySelector(" + selector + ");"
        " if (!row) return null;"
        " const status = row.querySelector('.model-status');"
        " const importer = row.querySelector('[data-action=\"import\"]');"
        " const download = row.querySelector('[data-action=\"download\"]');"
        " return {status: status?.textContent?.trim() || '',"
        " statusClass: status?.className || '',"
        " importHidden: importer ? !!importer.hidden : true,"
        " downloadHidden: download ? !!download.hidden : true}; })()"
    )


def voice_page_ready():
    return settings_eval(
        "(() => ({ready: !!window.FeelimeSettings,"
        " page: [...document.querySelectorAll('.page')].find(p => !p.hidden)"
        "?.dataset.page || '', row: !!document.querySelector(" +
        json.dumps(model_selector()) + ")}))()"
    )


def launch_settings_voice():
    d.shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity")
    ready = wait_until(
        voice_page_ready,
        lambda value: isinstance(value, dict) and value.get("ready"),
        timeout=15.0,
        interval=0.5,
    )
    if not ready:
        return False
    if ready.get("page") != "voice":
        try:
            opened = shared.settings_tap('button[data-target="voice"]', wait=0.7)
        except (RuntimeError, ValueError):
            opened = False
        if not opened:
            return False
    return bool(wait_until(
        voice_page_ready,
        lambda value: isinstance(value, dict)
        and value.get("page") == "voice" and value.get("row"),
        timeout=8.0,
        interval=0.4,
    ))


def local_path(raw, label):
    path = Path(raw).expanduser()
    if not path.is_file():
        raise SystemExit(f"{label} is not a file: {path}")
    if path.stat().st_size <= 0:
        raise SystemExit(f"{label} is empty: {path}")
    return path


def make_bad_archive():
    """Create a valid ZIP with no model payload when no bad path was given."""
    tmp_root = Path(os.environ.get("FEELIME_TMP_DIR", Path.home() / "tmp"))
    tmp_root.mkdir(parents=True, exist_ok=True)
    handle, raw = tempfile.mkstemp(
        prefix="feelime-model-import-invalid-", suffix=".zip", dir=tmp_root
    )
    os.close(handle)
    path = Path(raw)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.txt", "This archive has no model payload.\n")
    return path


def local_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def archive_suffix(path):
    """Keep the actual supported archive suffix in the cache filename."""
    name = path.name
    lowered = name.casefold()
    for suffix in (".tar.bz2", ".zip"):
        if lowered.endswith(suffix):
            return name[-len(suffix):]
    raise SystemExit(
        "FEELIME_IMPORT_ARCHIVE must end in .zip or .tar.bz2 when "
        "FEELIME_IMPORT_KEEP_ARCHIVE=1"
    )


def cached_archive_remote(path, digest):
    # The full lower-case digest makes this an ASCII-only, deterministic name
    # while the suffix keeps DocumentsUI's archive type visible.
    return f"{REMOTE_DIR}/feelime-model-import-{digest}{archive_suffix(path)}"


def remote_sha256(remote):
    output = d.shell(
        "sha256sum " + shlex.quote(remote) + " 2>/dev/null"
    )
    token = output.strip().split(maxsplit=1)[0] if output.strip() else ""
    return token.lower() if re.fullmatch(r"[0-9a-f]{64}", token, re.IGNORECASE) else None


def adb_file_size(remote):
    output = d.shell(
        "run-as " + PKG + " sh -c " +
        shlex.quote("wc -c < " + remote + " 2>/dev/null")
    ).strip()
    match = re.search(r"\d+", output)
    return int(match.group(0)) if match else None


def push_archive(path, kind):
    # Keep the picker target ASCII and deterministic even when the injected
    # source path contains Unicode or spaces.  Downloads is the user-visible
    # shared-storage folder offered by DocumentsUI.
    expected_digest = None
    if KEEP_ARCHIVE and kind == "good":
        expected_digest = local_sha256(path)
        remote = cached_archive_remote(path, expected_digest)
        if remote_sha256(remote) == expected_digest:
            print(f"REUSE {remote} sha256={expected_digest}", flush=True)
            return remote
    else:
        remote_name = f"feelime-model-import-{kind}-{os.getpid()}.zip"
        remote = f"{REMOTE_DIR}/{remote_name}"
    d.shell("rm -f " + shlex.quote(remote))
    d.adb("push", str(path), remote, timeout=max(120, int(IMPORT_TIMEOUT)))
    # A media scan helps older DocumentsUI builds refresh Downloads promptly;
    # the file is still selected from the real picker below.
    d.shell(
        "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE "
        "-d " + shlex.quote("file://" + remote) + " >/dev/null 2>&1"
    )
    expected_size = path.stat().st_size
    deadline = time.monotonic() + 20
    observed = None
    while time.monotonic() < deadline:
        value = d.shell("wc -c < " + shlex.quote(remote)).strip()
        match = re.search(r"\d+", value)
        observed = int(match.group(0)) if match else None
        if observed == expected_size:
            if KEEP_ARCHIVE and kind == "good":
                actual = remote_sha256(remote)
                if actual != expected_digest:
                    d.shell("rm -f " + shlex.quote(remote))
                    raise RuntimeError(
                        f"adb push SHA-256 mismatch for {remote}: "
                        f"expected={expected_digest} actual={actual or '?'}"
                    )
                print(f"PUSH {remote} sha256={actual}", flush=True)
            return remote
        time.sleep(0.5)
    raise RuntimeError(
        f"adb push did not expose {remote}: expected={expected_size} observed={observed}"
    )


def cleanup_remote_archives(good_remote, bad_remote):
    for remote in (good_remote, bad_remote):
        keep_good = KEEP_ARCHIVE and remote == good_remote
        if remote and not keep_good:
            d.shell("rm -f " + shlex.quote(remote))


def node_bounds(node):
    raw = node.get("bounds", "")
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", raw)
    return tuple(map(int, match.groups())) if match else None


def picker_xml():
    """Use the shared UI dump oracle; do not invoke a picker callback in JS."""
    xml = d.ui_dump()
    if not xml:
        return ""
    focus = d.shell("dumpsys window | grep -m1 -iE 'mCurrentFocus|mFocusedApp'")
    marker = ("com.google.android.documentsui", "com.android.documentsui",
              "DocumentsUI", "documentsui")
    return xml if any(item in xml or item in focus for item in marker) else ""


def picker_nodes(xml=None):
    xml = xml if xml is not None else picker_xml()
    if not xml:
        return []
    try:
        root = ElementTree.fromstring(xml)
        return list(root.iter("node"))
    except ElementTree.ParseError:
        # DocumentsUI occasionally emits a transient malformed dump while it
        # is rotating.  Retry through the normal polling path rather than
        # scraping a guessed coordinate.
        return []


def picker_open(timeout=12.0):
    return wait_until(
        picker_xml,
        lambda value: bool(value),
        timeout=timeout,
        interval=0.4,
    ) or ""


def picker_tap_node(predicate, timeout=8.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for node in picker_nodes():
            if not predicate(node):
                continue
            bounds = node_bounds(node)
            if not bounds:
                continue
            d.tap((bounds[0] + bounds[2]) // 2,
                  (bounds[1] + bounds[3]) // 2, wait=0.5)
            return True
        time.sleep(0.35)
    return False


def picker_tap_filename(filename, timeout=15.0):
    def exact(node):
        return node.get("text", "") == filename

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if picker_tap_node(exact, timeout=0.8):
            # A single file tap normally returns the URI immediately.  Some
            # OEM DocumentsUI builds select first and expose an explicit Open
            # button, which must also be a real ADB tap.
            if picker_open(timeout=1.5):
                picker_tap_action(("Open", "打开", "选择", "Select", "完成"), timeout=3)
            return bool(wait_until(lambda: not picker_xml(), lambda value: value is True,
                                   timeout=12.0, interval=0.4))
        time.sleep(0.5)
    return False


def picker_tap_action(labels, timeout=5.0):
    wanted = {str(label).casefold() for label in labels}
    return picker_tap_node(
        lambda node: node.get("text", "").strip().casefold() in wanted
        or node.get("content-desc", "").strip().casefold() in wanted,
        timeout=timeout,
    )


def picker_open_roots():
    labels = {"show roots", "显示根目录", "根目录", "导航抽屉"}
    return picker_tap_node(
        lambda node: node.get("content-desc", "").strip().casefold() in labels
        or ("drawer" in node.get("resource-id", "").casefold()
            and node.get("clickable") == "true"),
        timeout=4.0,
    )


def picker_choose_downloads():
    if not picker_open_roots():
        return False
    labels = {"downloads", "download", "下载"}
    return picker_tap_node(
        lambda node: node.get("text", "").strip().casefold() in labels,
        timeout=6.0,
    )


def picker_search(filename):
    labels = {"search", "搜索"}
    if not picker_tap_node(
        lambda node: node.get("content-desc", "").strip().casefold() in labels
        or ("search" in node.get("resource-id", "").casefold()
            and node.get("clickable") == "true"),
        timeout=4.0,
    ):
        return False
    edit = wait_until(
        lambda: next((node for node in picker_nodes()
                      if node.get("class") == "android.widget.EditText"), None),
        lambda node: node is not None,
        timeout=5.0,
        interval=0.25,
    )
    if not edit:
        return False
    # The generated remote filename is ASCII and contains no shell metachar.
    d.shell("input text " + shlex.quote(filename))
    d.shell("input keyevent KEYCODE_ENTER")
    return True


def choose_archive(remote):
    filename = Path(remote).name
    if not picker_open(timeout=10):
        return False
    # First use the current location.  Then use the visible Downloads root;
    # finally fall back to DocumentsUI's own ASCII search.  All three paths
    # remain inside the system picker.
    if picker_tap_filename(filename):
        return True
    if picker_choose_downloads():
        if picker_tap_filename(filename):
            return True
        # A provider may expose the drawer without a Downloads root entry;
        # close it before asking DocumentsUI to search the shared store.
        if picker_open(timeout=1.0):
            d.shell("input keyevent KEYCODE_BACK")
            time.sleep(0.5)
    if picker_search(filename) and picker_tap_filename(filename, timeout=20):
        return True
    return False


def rotation_value():
    xml = d.ui_dump()
    match = re.search(r'\brotation="(\d+)"', xml or "")
    if match:
        return int(match.group(1))
    raw = d.shell("dumpsys window | grep -m1 -iE 'mCurrentRotation|mRotation'")
    if "ROTATION_90" in raw:
        return 1
    if "ROTATION_270" in raw:
        return 3
    if re.search(r"(?:mRotation|rotation)=1\b", raw):
        return 1
    if re.search(r"(?:mRotation|rotation)=3\b", raw):
        return 3
    if "ROTATION_0" in raw:
        return 0
    return None


def set_orientation(landscape):
    # Toggling accelerometer first makes user_rotation take effect on AVD and
    # ColorOS, matching the established device gate convention.
    d.shell("settings put system accelerometer_rotation 1")
    time.sleep(1.0)
    d.shell("settings put system accelerometer_rotation 0")
    d.shell("settings put system user_rotation " + ("1" if landscape else "0"))
    wanted = (1, 3) if landscape else (0, 2)
    value = wait_until(rotation_value, lambda current: current in wanted,
                       timeout=10.0, interval=0.6)
    # The settings WebView can be recreated even though the process survives.
    # shared.settings_tap and the one-shot settings DevTools oracle reacquire it.
    d._DT_SOCKET = None
    return value


def open_import_picker():
    if not launch_settings_voice():
        return False
    state = wait_until(model_state,
                       lambda value: isinstance(value, dict),
                       timeout=8.0, interval=0.4)
    if not state or state.get("importHidden"):
        return False
    try:
        tapped = shared.settings_tap(
            model_selector() + ' [data-action="import"]', wait=0.8
        )
    except (RuntimeError, ValueError):
        tapped = False
    return tapped and bool(picker_open())


def wait_import_terminal(before, timeout=None):
    timeout = IMPORT_TIMEOUT if timeout is None else timeout
    deadline = time.monotonic() + timeout
    saw_progress = False
    before_status = str((before or {}).get("status", ""))
    before_class = str((before or {}).get("statusClass", ""))
    while time.monotonic() < deadline:
        current = model_state()
        if current:
            status = current.get("status", "")
            cls = current.get("statusClass", "")
            if any(marker in status.casefold() for marker in
                   ("reading", "validat", "installing", "读取", "验证", "安装")):
                saw_progress = True
            if "warn" in cls:
                saw_progress = True
            # Once the importer has reported progress, a non-warn row is the
            # persisted completion/error state.  The small grace period also
            # covers a tiny punctuation archive whose events are very fast.
            changed = status != before_status or cls != before_class
            if (saw_progress and "warn" not in cls and status) or (
                    changed and "warn" not in cls and status):
                return current
        time.sleep(0.25)
    return None


def has_status_class(state, wanted):
    if not isinstance(state, dict):
        return False
    return wanted in str(state.get("statusClass", "")).split()


def is_bad_state(state):
    return (has_status_class(state, "bad")
            and bool(str(state.get("status", "")).strip()))


def same_bad_state(state, expected):
    """Require the persisted error to be the same visible error as before."""
    return (is_bad_state(state) and is_bad_state(expected)
            and str(state.get("status", "")).strip() ==
            str(expected.get("status", "")).strip())


def cancel_picker_case(baseline):
    if not open_import_picker():
        record("model import opens the real system file picker", False,
               "settings import action or DocumentsUI unavailable")
        return False
    record("model import opens the real system file picker", True)
    before_rotation = rotation_value()
    rotated = set_orientation(True)
    picker_after_rotation = bool(picker_open(timeout=8.0))
    rotation_ok = rotated in (1, 3) and picker_after_rotation
    record("file picker survives a real device rotation", rotation_ok,
           f"before={before_rotation} after={rotated} picker={picker_after_rotation}")
    # Back is an Android navigation action.  It must only dismiss DocumentsUI;
    # it must not invoke the JS bridge or alter model state.
    d.shell("input keyevent KEYCODE_BACK")
    closed = bool(wait_until(lambda: not picker_xml(), lambda value: value is True,
                             timeout=10.0, interval=0.4))
    set_orientation(False)
    after = wait_until(model_state,
                       lambda value: isinstance(value, dict), timeout=8.0)
    unchanged = bool(after and baseline and
                     after.get("status") == baseline.get("status") and
                     after.get("statusClass") == baseline.get("statusClass"))
    record("cancelling the picker leaves the model unchanged", closed and unchanged,
           f"closed={closed} before={baseline} after={after}")
    return closed and unchanged and rotation_ok


def import_archive_case(remote, label, rotate_before_select=False):
    if not open_import_picker():
        record(f"{label}: opens picker", False, "picker did not open")
        return None
    before = model_state()
    rotated = None
    if rotate_before_select:
        rotated = set_orientation(True)
        still_picker = bool(picker_open(timeout=8.0))
        record(f"{label}: picker remains usable after rotation",
               rotated in (1, 3) and still_picker,
               f"rotation={rotated} picker={still_picker}")
    selected = choose_archive(remote)
    if rotate_before_select:
        set_orientation(False)
    if not selected:
        record(f"{label}: selects archive through DocumentsUI", False,
               f"remote={remote}")
        return None
    terminal = wait_import_terminal(before)
    return terminal


def install_record_snapshot():
    marker = "__FEELIME_IMPORT_RECORDS__"
    raw = d.shell(
        "run-as " + PKG + " sh -c " + shlex.quote(
            "printf '%s\\n' " + marker +
            "; find files/models -name INSTALL.json -type f -print 2>/dev/null"
        )
    )
    if marker not in raw:
        return None
    records = {}
    for line in raw.splitlines():
        path = line.strip()
        if not path or path == marker:
            continue
        value = d.shell("run-as " + PKG + " cat " + shlex.quote(path))
        try:
            payload = json.loads(value)
        except (TypeError, ValueError):
            records[path] = None
        else:
            records[path] = payload
    return records


def installed_snapshot():
    """Capture the selected INSTALL.json and every installed file digest."""
    records = install_record_snapshot()
    if records is None:
        return None, "run-as record probe failed"
    selected_path, selected = next(
        ((path, value) for path, value in records.items()
         if isinstance(value, dict) and value.get("id") == MODEL_ID),
        (None, None),
    )
    if not selected_path or not selected:
        return None, f"no INSTALL.json for {MODEL_ID}; records={list(records)}"
    files = selected.get("files")
    if not isinstance(files, dict) or not files:
        return None, "INSTALL.json has no file map"
    # INSTALL.json stores names relative to the model directory.
    model_dir = selected_path.rsplit("/", 1)[0]
    actual_files = {}
    for relative in files:
        if not isinstance(relative, str) or not relative:
            return None, f"invalid record entry: {relative}"
        remote = f"{model_dir}/{relative}"
        remote_hash = d.shell(
            "run-as " + PKG + " sha256sum " + shlex.quote(remote) + " 2>/dev/null"
        ).split()
        actual_files[relative] = {
            "sha256": remote_hash[0].lower() if remote_hash else "",
            "bytes": adb_file_size(remote),
        }
    return {
        "record_path": selected_path,
        "record": selected,
        "files": actual_files,
    }, ""


def verify_installed_record():
    snapshot, detail = installed_snapshot()
    if snapshot is None:
        return False, detail
    files = snapshot["record"]["files"]
    checked = 0
    for relative, expected in files.items():
        if not isinstance(expected, dict):
            return False, f"invalid record entry: {relative}"
        actual = snapshot["files"].get(relative, {})
        try:
            expected_bytes = int(expected.get("bytes", -1))
        except (TypeError, ValueError):
            expected_bytes = -1
        if (actual.get("sha256", "").lower() !=
                str(expected.get("sha256", "")).lower()
                or actual.get("bytes") != expected_bytes):
            return False, (f"{relative}: hash={actual.get('sha256') or '?'} "
                           f"size={actual.get('bytes')}")
        checked += 1
    return True, f"{MODEL_ID}: INSTALL.json and {checked} files verified"


def main():
    if not MODEL_ID:
        raise SystemExit("FEELIME_IMPORT_MODEL_ID is required")
    if not GOOD_ARCHIVE:
        raise SystemExit("FEELIME_IMPORT_ARCHIVE is required")
    good = local_path(GOOD_ARCHIVE, "FEELIME_IMPORT_ARCHIVE")
    generated_bad = None
    if BAD_ARCHIVE:
        bad = local_path(BAD_ARCHIVE, "FEELIME_IMPORT_BAD_ARCHIVE")
    else:
        generated_bad = make_bad_archive()
        bad = generated_bad

    initial_accel = d.shell("settings get system accelerometer_rotation").strip()
    initial_rotation = d.shell("settings get system user_rotation").strip()
    good_remote = bad_remote = None
    try:
        set_orientation(False)
        good_remote = push_archive(good, "good")
        bad_remote = push_archive(bad, "bad")
        if not launch_settings_voice():
            record("settings voice page and selected model row are reachable", False)
            return 1
        baseline = wait_until(model_state,
                              lambda value: isinstance(value, dict), timeout=8.0)
        if not baseline:
            record("settings voice page and selected model row are reachable", False,
                   "model row missing")
            return 1
        record("settings voice page and selected model row are reachable", True,
               str(baseline))

        cancel_picker_case(baseline)

        bad_state = import_archive_case(
            bad_remote, "bad ZIP import", rotate_before_select=False
        )
        bad_ok = is_bad_state(bad_state)
        record("bad ZIP is rejected and its error stays visible", bad_ok,
               str(bad_state))

        # Recreate the settings Activity after the failure.  This verifies the
        # persisted ModelStore error instead of accepting a one-shot event.
        d.shell(f"am force-stop {PKG}")
        time.sleep(1.0)
        if launch_settings_voice():
            persisted = wait_until(model_state,
                                   lambda value: same_bad_state(value, bad_state),
                                   timeout=12.0, interval=0.5)
        else:
            persisted = None
        record("bad ZIP error survives settings Activity recreation",
               same_bad_state(persisted, bad_state),
               f"expected={bad_state} observed={persisted}")

        good_state = import_archive_case(
            # The official tar.bz2 is the large-file path; keep picker
            # orientation stable while DocumentsUI transfers/selects it.
            good_remote, "correct archive import", rotate_before_select=False
        )
        success = has_status_class(good_state, "ok")
        record("correct archive reaches a verified model state", success,
               str(good_state))
        installed, detail = verify_installed_record()
        record("correct archive writes verified INSTALL.json and model files",
               installed, detail)

        # A failed import after a valid install must leave the sealed record
        # and every installed file untouched.  Capture both before repeating
        # the bad archive case; checking only the visible status would miss a
        # destructive partial replacement.
        before_bad_reimport, before_detail = installed_snapshot()
        bad_after_install = import_archive_case(
            bad_remote, "bad ZIP import after installation",
            rotate_before_select=False,
        )
        bad_after_install_ok = same_bad_state(bad_after_install, bad_state)
        record("bad ZIP is rejected after installation", bad_after_install_ok,
               f"expected={bad_state} observed={bad_after_install}")

        after_bad_reimport, after_detail = installed_snapshot()
        unchanged = bool(
            before_bad_reimport and after_bad_reimport
            and before_bad_reimport["record_path"] ==
            after_bad_reimport["record_path"]
            and before_bad_reimport["record"] == after_bad_reimport["record"]
            and before_bad_reimport["files"] == after_bad_reimport["files"]
        )
        if before_bad_reimport and after_bad_reimport:
            unchanged_detail = (
                f"record_path={before_bad_reimport['record_path']} "
                f"record_same={before_bad_reimport['record'] == after_bad_reimport['record']} "
                f"files_same={before_bad_reimport['files'] == after_bad_reimport['files']}"
            )
        else:
            unchanged_detail = f"before={before_detail} after={after_detail}"
        record("bad ZIP leaves previous INSTALL.json and file hashes unchanged",
               unchanged, unchanged_detail)
        return 0 if all(ok for _, ok, _ in RESULTS) else 1
    finally:
        # Restore the device orientation and remove only the two test files.
        if initial_accel in {"0", "1"}:
            d.shell("settings put system accelerometer_rotation " + initial_accel)
        if initial_rotation in {"0", "1", "2", "3"}:
            d.shell("settings put system user_rotation " + initial_rotation)
        cleanup_remote_archives(good_remote, bad_remote)
        if generated_bad:
            try:
                generated_bad.unlink()
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
