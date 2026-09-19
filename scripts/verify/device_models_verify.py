#!/usr/bin/env python3
"""Production thin-APK model download and voice smoke gate.

This gate exercises the path that the ASR regression APK cannot cover:

* the installed production APK contains a verified model manifest;
* SetupActivity's real voice-settings page is opened;
* every model's real ``Download``/``下载`` button is activated through
  ``input tap``;
* a metered-network consent card is handled through physical ADB taps;
* the native files and INSTALL.json agree with the embedded manifest; and
* the production keyboard can enter the listening state after the download.

The caller must install a thin APK and provide ``FEELIME_ADB_SERIAL`` and
``FEELIME_VERIFY_APK``.  The script does not clear app data.  A genuinely
fresh download run therefore starts with no entries under ``files/models``
(or the caller may remove only that app-private directory before the run).
"""

import hashlib
import json
import os
import re
import shlex
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fv_common as shared
import device_verify as d


PKG = "com.feelime.ime"
SETTINGS_MARKER = "settings/index.html"
MODEL_TIMEOUT_SECONDS = int(os.environ.get("FEELIME_MODEL_TIMEOUT_S", "1200"))
VOICE_TIMEOUT_SECONDS = int(os.environ.get("FEELIME_VOICE_TIMEOUT_S", "240"))
MIB = 1024 * 1024
THIN_APK_MAX_BYTES = 100 * MIB
THIN_APK_MAX_ZIP_OVERHEAD_BYTES = 2 * MIB
RESULTS = []

INSTALLED_MARKERS = (
    "已下载",
    "Downloaded and verified",
    "included with the app",
    "已随安装包提供",
)
MISSING_MARKERS = ("未下载", "Not downloaded")
DOWNLOADING_MARKERS = ("下载中", "Downloading")
FAILURE_MARKERS = (
    "下载失败",
    "校验失败",
    "文件异常",
    "model download failed",
    "file is invalid",
)


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def apk_manifest(apk_path):
    with zipfile.ZipFile(apk_path) as archive:
        candidates = [name for name in archive.namelist()
                      if name.endswith("assets/models/manifest.json")]
        if not candidates:
            raise RuntimeError("APK has no assets/models/manifest.json")
        return json.loads(archive.read(candidates[0]).decode("utf-8"))


def thin_apk_assets(apk_path, models):
    """Verify that a thin APK carries only the manifest, never model bytes.

    ``src/modelAssets/full`` is rooted directly at the APK ``assets/``
    directory, while the generated manifest is under ``assets/models``.  The
    model directory names therefore come from the manifest paths rather than
    from a hardcoded list.
    """
    actual_bytes = Path(apk_path).stat().st_size
    if actual_bytes >= THIN_APK_MAX_BYTES:
        return False, (
            f"thin APK is {actual_bytes / MIB:.1f} MiB; "
            f"limit is <{THIN_APK_MAX_BYTES / MIB:.0f} MiB"
        )
    model_dirs = {
        str(entry.get("path", "")).split("/", 1)[0]
        for model in models
        for entry in model.get("files", [])
        if "/" in str(entry.get("path", ""))
    }
    embedded = []
    unexpected_manifest_assets = []
    with zipfile.ZipFile(apk_path) as archive:
        compressed_bytes = sum(info.compress_size for info in archive.infolist())
        for name in archive.namelist():
            if not name.startswith("assets/"):
                continue
            rel = name[len("assets/"):]
            if rel.endswith("/"):
                continue
            if rel == "models/manifest.json":
                continue
            if any(rel == directory or rel.startswith(directory + "/")
                   for directory in model_dirs):
                embedded.append(name)
            elif rel.startswith("models/"):
                # A thin package may ship the verified manifest, but no
                # generated model asset beside it.
                unexpected_manifest_assets.append(name)
    if embedded:
        return False, "embedded model payload: " + ", ".join(embedded[:6])
    if unexpected_manifest_assets:
        return False, "unexpected assets/models entries: " + ", ".join(
            unexpected_manifest_assets[:6]
        )
    zip_overhead = actual_bytes - compressed_bytes
    if zip_overhead < 0 or zip_overhead >= THIN_APK_MAX_ZIP_OVERHEAD_BYTES:
        return False, (
            f"APK ZIP overhead is {zip_overhead} bytes; "
            f"limit is <{THIN_APK_MAX_ZIP_OVERHEAD_BYTES} bytes"
        )
    return True, (
        "assets/models/manifest.json only; "
        f"actual={actual_bytes} bytes, compressed={compressed_bytes} bytes, "
        f"zip-overhead={zip_overhead} bytes"
    )


def manifest_models(manifest):
    models = manifest.get("models")
    if not isinstance(models, list) or not models:
        raise RuntimeError("embedded model manifest has no models")
    result = []
    for model in models:
        files = model.get("files")
        if not isinstance(files, list) or not files:
            raise RuntimeError(f"model {model.get('id', '?')} has no files")
        for entry in files:
            path = entry.get("path", "")
            digest = entry.get("sha256", "")
            size = entry.get("bytes", 0)
            if (not re.fullmatch(r"[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+", path)
                    or not re.fullmatch(r"[0-9a-fA-F]{64}", digest)
                    or not isinstance(size, int) or size <= 0):
                raise RuntimeError(
                    f"model manifest is not verified: {model.get('id', '?')} {path}"
                )
        result.append(model)
    return result


def installed_apk_matches(apk_path):
    local_digest = hashlib.sha256(Path(apk_path).read_bytes()).hexdigest()
    apk_path_on_device = d.shell(f"pm path {PKG}").strip()
    lines = apk_path_on_device.splitlines()
    apk_path_on_device = lines[0].removeprefix("package:") if lines else ""
    if not apk_path_on_device:
        return False, "production APK is not installed"
    remote = d.shell(f"sha256sum {shlex.quote(apk_path_on_device)}").split()
    if not remote:
        return False, "device APK hash unavailable"
    return remote[0] == local_digest, f"local={local_digest[:16]} device={remote[0][:16]}"


def settings_eval(expression):
    """Evaluate an expression on the live SettingsActivity WebView."""
    return d.devtools_eval_target(SETTINGS_MARKER, expression)


def wait_settings_ready(timeout=60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if settings_eval("window.FeelimeSettings ? 'ready' : null") == "ready":
            return True
        time.sleep(1.0)
    return False


def model_states():
    raw = settings_eval(
        "JSON.stringify([...document.querySelectorAll('.model')].map(node => ({"
        "id: node.dataset.id, status: node.querySelector('.model-status')?.textContent || ''"
        "})))"
    )
    if not isinstance(raw, str):
        return []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return []


def status_contains(status, markers):
    value = str(status or "").casefold()
    return any(str(marker).casefold() in value for marker in markers)


def status_is_installed(status):
    return status_contains(status, INSTALLED_MARKERS)


def status_is_missing(status):
    return status_contains(status, MISSING_MARKERS)


def status_is_failure(status):
    return status_contains(status, FAILURE_MARKERS)


def model_note():
    value = settings_eval(
        "document.getElementById('modelNote')?.textContent || ''"
    )
    return str(value or "").strip()


def device_model_files():
    """Return app-private model entries and a probe diagnostic.

    A marker distinguishes an empty/nonexistent ``files/models`` directory
    from a failed ``run-as`` invocation.  The latter must fail the gate rather
    than being mistaken for a clean thin install.
    """
    marker = "__FEELIME_MODELS_BEGIN__"
    raw = d.shell(
        "run-as " + PKG + " sh -c "
        + shlex.quote(
            "printf '%s\\n' " + marker
            + "; if [ -e files/models ]; then find files/models -mindepth 1 -print; fi"
        )
    )
    if marker not in raw:
        return None, raw.strip() or "run-as probe returned no marker"
    entries = [line.strip() for line in raw.splitlines()
               if line.strip() and line.strip() != marker]
    return entries, "none" if not entries else ", ".join(entries[:12])


def device_model_snapshot():
    """Return every model entry with its current byte size.

    The cancellation check must catch a delayed ``.part`` file as well as a
    completed model.  Include directories (with size ``-1``) so that a
    newly-created empty model directory cannot hide a transfer either.
    """
    marker = "__FEELIME_MODEL_SIZES_BEGIN__"
    probe = (
        "printf '%s\\n' " + marker
        + "; if [ -e files/models ]; then "
        + "find files/models -mindepth 1 -print | while IFS= read -r path; do "
        + "if [ -f \"$path\" ]; then size=$(wc -c < \"$path\"); "
        + "else size=-1; fi; printf '%s\\t%s\\n' \"$path\" \"$size\"; "
        + "done; fi"
    )
    raw = d.shell(
        "run-as " + PKG + " sh -c " + shlex.quote(probe)
    )
    if marker not in raw:
        return None, raw.strip() or "run-as model size probe returned no marker"
    snapshot = {}
    for line in raw.splitlines():
        if not line.strip() or line.strip() == marker:
            continue
        try:
            path, raw_size = line.rsplit("\t", 1)
            size = int(raw_size.strip())
        except (TypeError, ValueError):
            return None, "malformed model size probe line: " + line.strip()
        if not path:
            return None, "malformed model size probe path"
        snapshot[path] = size
    detail = "none" if not snapshot else ", ".join(
        f"{path}={size}" for path, size in sorted(snapshot.items())[:12]
    )
    return snapshot, detail


def diagnostic_snapshot(states=None):
    """Collect small, immediately useful state after a device failure."""
    if states is None:
        states = {entry.get("id"): entry.get("status", "")
                  for entry in model_states()}
    _, files_detail = device_model_files()
    consent_state = model_consent_state()
    consent = "visible" if consent_state is True else (
        "hidden" if consent_state is False else "unknown"
    )
    return (
        f"states={states}; note={model_note() or '-'}; "
        f"consent={consent}; "
        f"files/models={files_detail}"
    )


def model_consent_state():
    """Read the consent card's own hidden flag before tapping its controls."""
    value = settings_eval(
        "(() => { const card = document.getElementById('modelConsent');"
        " return !!(card && !card.hidden); })()"
    )
    return value if isinstance(value, bool) else None


def model_download_selector(model_id):
    """Select one model's action so another row cannot receive the tap."""
    return (".model[data-id=" + json.dumps(str(model_id), ensure_ascii=False)
            + "] [data-action=\"download\"]")


def tap_model_download(model_id):
    # settings_tap reads the title-matched native Settings WebView bounds,
    # maps CSS pixels proportionally, and scrolls in either direction while
    # keeping the physical gesture inside that WebView.
    return shared.settings_tap(model_download_selector(model_id), wait=0.5)


def wait_for_consent(timeout=8, before=None):
    deadline = time.monotonic() + timeout
    saw_visible_card = False
    while time.monotonic() < deadline:
        consent_state = model_consent_state()
        if consent_state is None:
            return None
        if consent_state:
            saw_visible_card = True
            return True
        if saw_visible_card:
            return None
        if before:
            current = {entry.get("id"): entry.get("status", "")
                       for entry in model_states()}
            if any(
                current.get(model_id, "") != before.get(model_id, "")
                and (status_is_installed(current.get(model_id, ""))
                     or status_is_failure(current.get(model_id, ""))
                     or status_contains(current.get(model_id, ""), ("下载中", "Downloading")))
                for model_id in before
            ):
                return False
        time.sleep(0.25)
    return None if saw_visible_card else False


def tap_consent(confirm, timeout=15):
    """Tap only the consent card's own DOM action through real ADB input."""
    if model_consent_state() is not True:
        return False
    selector = "#modelConsentConfirm" if confirm else "#modelConsentCancel"
    return shared.settings_tap(selector, wait=0.6)


def wait_for_cancelled_download(model_id, before, baseline_snapshot=None, timeout=4):
    """Ensure cancellation hides consent and starts no delayed transfer.

    Returning success early after the card disappears would miss a download
    job that starts a moment later, so observe the whole short window while
    checking the target state and every model entry on disk.
    """
    if baseline_snapshot is None:
        return False, before
    if timeout <= 0:
        return False, before
    deadline = time.monotonic() + timeout
    last = before
    observed = False
    while time.monotonic() < deadline:
        # The consent card is in normal document flow.  Its own hidden flag is
        # the authoritative cancellation result; accessibility text elsewhere
        # can belong to a row-level Cancel action.
        if model_consent_state() is not False:
            return False, last
        current = {entry.get("id"): entry.get("status", "")
                   for entry in model_states()}
        last = current
        status = current.get(model_id, "")
        if (status != before.get(model_id, "")
                or not status_is_missing(status)):
            return False, current
        for current_id, new in current.items():
            old = before.get(current_id, "")
            if current_id == model_id:
                continue
            # A model that was already installed before cancellation is part
            # of the accepted baseline. Only a newly installed or newly
            # downloading *other* model indicates that this tap hit the
            # wrong row or leaked a transfer.
            if ((status_is_installed(new) and not status_is_installed(old))
                    or (status_contains(new, DOWNLOADING_MARKERS)
                        and not status_contains(old, DOWNLOADING_MARKERS))):
                return False, current
        snapshot, _ = device_model_snapshot()
        if snapshot is None or snapshot != baseline_snapshot:
            return False, current
        observed = True
        time.sleep(0.25)
    # Reaching the end of the short observation window is success only
    # because every iteration above proved the card hidden, the target still
    # missing, and the complete file/size snapshot unchanged.
    return observed, last


def wait_for_download(before, expected_ids, before_note=None):
    if before_note is None:
        before_note = model_note()
    deadline = time.monotonic() + MODEL_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        current = {entry.get("id"): entry.get("status", "") for entry in model_states()}
        if current and any(status_is_failure(value) for value in current.values()):
            return None, current
        note = model_note()
        if note and (note != before_note or status_contains(
                note, ("失败", "failed", "error", "network", "invalid", "校验")
        )):
            return None, current
        for model_id in expected_ids:
            old = before.get(model_id, "")
            new = current.get(model_id, "")
            if status_is_installed(new) and not status_is_installed(old):
                return model_id, current
        time.sleep(1.0)
    return None, {entry.get("id"): entry.get("status", "") for entry in model_states()}


def device_file_checks(model):
    model_dir = model["files"][0]["path"].split("/", 1)[0]
    record_path = f"files/models/{model_dir}/INSTALL.json"
    raw_record = d.shell(f"run-as {PKG} cat {shlex.quote(record_path)} 2>/dev/null")
    try:
        install_record = json.loads(raw_record)
    except (TypeError, ValueError):
        return False, f"{model['id']}: INSTALL.json unreadable"
    if install_record.get("id") != model.get("id") or install_record.get("version") != model.get("version"):
        return False, f"{model['id']}: INSTALL.json id/version mismatch"

    installed_files = install_record.get("files")
    if not isinstance(installed_files, dict):
        return False, f"{model['id']}: INSTALL.json files missing"
    for entry in model["files"]:
        name = entry["path"].split("/", 1)[1]
        path = f"files/models/{model_dir}/{name}"
        remote_hash = d.shell(
            f"run-as {PKG} sha256sum {shlex.quote(path)} 2>/dev/null"
        ).split()
        remote_size = d.shell(
            f"run-as {PKG} sh -c 'wc -c < {shlex.quote(path)}' 2>/dev/null"
        ).strip()
        expected_hash = entry["sha256"].lower()
        expected_size = str(entry["bytes"])
        record_entry = installed_files.get(name, {})
        try:
            record_size = int(record_entry.get("bytes", -1))
        except (TypeError, ValueError):
            record_size = -1
        ok = (
            bool(remote_hash)
            and remote_hash[0].lower() == expected_hash
            and remote_size == expected_size
            and record_entry.get("sha256", "").lower() == expected_hash
            and record_size == entry["bytes"]
        )
        if not ok:
            return False, (
                f"{model['id']}/{name}: "
                f"hash={remote_hash[0][:16] if remote_hash else '?'} "
                f"size={remote_size or '?'}"
            )
    return True, f"{model['id']} {sum(entry['bytes'] for entry in model['files'])} bytes"


def physical_mic_point():
    # IME animation can move the WebView after editor preparation.
    if d._DT_SOCKET is not None:
        d._DT_SOCKET.close()
    d._DT_SOCKET = None
    css = d.devtools_eval(
        "(() => { const node = document.getElementById('mic');"
        " if (!node) return null; const r = node.getBoundingClientRect();"
        " return [r.left + r.width / 2, r.top + r.height / 2, window.innerWidth]; })()"
    )
    if not isinstance(css, list) or len(css) != 3 or not css[2]:
        return None
    screen = re.search(r"(\d+)x(\d+)", d.shell("wm size"))
    if not screen:
        return None
    scale = int(screen.group(1)) / float(css[2])
    return (int(css[0] * scale + d._DT_OFFSET[0]),
            int(css[1] * scale + d._DT_OFFSET[1]))


def voice_smoke():
    d.shell("pm grant com.feelime.ime android.permission.RECORD_AUDIO 2>/dev/null")
    d.app_hard_reset()
    keyboard = d.fresh_kb(refocus=True)
    if not keyboard:
        return False, "keyboard geometry unavailable"
    point = physical_mic_point()
    if not point:
        return False, "mic geometry unavailable"
    d.tap(*point, wait=0.8)
    deadline = time.monotonic() + VOICE_TIMEOUT_SECONDS
    state = None
    while time.monotonic() < deadline:
        state = d.devtools_eval(
            "(() => { const o = document.getElementById('voiceOverlay');"
            " return o ? {open: o.classList.contains('open'), text: o.textContent} : null; })()"
        )
        text = str(state.get("text", "")) if isinstance(state, dict) else ""
        listening = "聆听" in text or "listening" in text.casefold()
        if isinstance(state, dict) and state.get("open") and listening:
            d.tap(*point, wait=0.5)
            return True, "production keyboard entered listening state"
        if state is None and time.monotonic() + 2 < deadline:
            time.sleep(1.0)
        else:
            time.sleep(1.0)
    return False, f"voice state did not reach listening: {state!r}; {diagnostic_snapshot()}"


def main():
    apk_path = os.environ.get("FEELIME_VERIFY_APK", "")
    if not apk_path or not os.path.isfile(apk_path):
        raise SystemExit("FEELIME_VERIFY_APK must point to the installed thin APK")
    try:
        manifest = apk_manifest(apk_path)
    except (OSError, KeyError, TypeError, ValueError, zipfile.BadZipFile) as error:
        record("embedded manifest is readable", False, str(error))
        return 1
    try:
        models = manifest_models(manifest)
    except RuntimeError as error:
        record("embedded manifest is verified", False, str(error))
        return 1
    thin, thin_detail = thin_apk_assets(apk_path, models)
    record("thin APK contains no embedded model payload", thin, thin_detail)
    if not thin:
        return 1
    match, detail = installed_apk_matches(apk_path)
    record("installed APK matches FEELIME_VERIFY_APK", match, detail)
    if not match:
        return 1

    initial_files, initial_files_detail = device_model_files()
    initial_missing = initial_files == []
    record("thin install has no downloaded model files", initial_missing,
           initial_files_detail)
    if initial_files is None or not initial_missing:
        record("initial model state is missing", False,
               "fresh thin install required; clear only files/models before retry")
        return 1

    by_id = {model.get("id"): model for model in models}
    expected_ids = [model.get("id") for model in models]
    record("embedded manifest contains streaming/final/punctuation models",
           {model.get("role") for model in models} >= {"asr-streaming", "asr-final", "punctuation"},
           ", ".join(expected_ids))
    if (any(not model.get("id") for model in models)
            or {model.get("role") for model in models}
            < {"asr-streaming", "asr-final", "punctuation"}):
        return 1

    d.shell("svc power stayon true")
    d.shell("input keyevent KEYCODE_WAKEUP")
    d.shell("wm dismiss-keyguard")
    d.shell(f"am start -n {PKG}/com.feelime.ime.SetupActivity")
    if not wait_settings_ready():
        record("settings WebView ready", False,
               "settings/index.html did not attach; " + diagnostic_snapshot())
        return 1
    record("settings WebView ready", True)
    settings_eval("window.FeelimeSettings.showPage('voice'); 'ok'")
    rows_deadline = time.monotonic() + 60
    rows = []
    while time.monotonic() < rows_deadline:
        rows = model_states()
        if {entry.get("id") for entry in rows} >= set(expected_ids):
            break
        time.sleep(1.0)
    if {entry.get("id") for entry in rows} < set(expected_ids):
        record("voice model rows rendered", False, diagnostic_snapshot())
        return 1
    record("voice model rows rendered", True)

    states = {entry.get("id"): entry.get("status", "") for entry in model_states()}
    non_missing = {
        model_id: states.get(model_id, "")
        for model_id in expected_ids
        if not status_is_missing(states.get(model_id, ""))
    }
    if non_missing:
        record("thin model download starts from missing models", False,
               f"unexpected states={non_missing}; {diagnostic_snapshot(states)}")
        return 1
    record("thin model download starts from missing models", True, str(states))

    for model_id in expected_ids:
        before = {entry.get("id"): entry.get("status", "") for entry in model_states()}
        before_note = model_note()
        baseline_snapshot, baseline_detail = device_model_snapshot()
        if baseline_snapshot is None:
            record("model file size snapshot before download", False,
                   baseline_detail)
            return 1
        if not status_is_missing(before.get(model_id, "")):
            record("real settings download tap", False,
                   f"expected missing model={model_id}; {diagnostic_snapshot(before)}")
            return 1
        if not tap_model_download(model_id):
            record("real settings download tap", False,
                   f"model={model_id}; {diagnostic_snapshot(before)}")
            return 1
        tapped_model_id = model_id
        if tapped_model_id not in by_id:
            record("real settings download tap", False,
                   f"unknown model id={tapped_model_id}; "
                   + diagnostic_snapshot(before))
            return 1

        # On a metered network the first physical tap only opens the app's
        # consent card. Exercise cancellation once to prove that it does not
        # start a transfer, then repeat the real tap and approve it. On an
        # unmetered network no card is expected and this loop proceeds
        # directly to the download wait below.
        consent = wait_for_consent(before=before)
        if consent is None:
            record("metered model download consent state", False,
                   "consent card became unreachable or DevTools state was "
                   "unavailable; " + diagnostic_snapshot(before))
            return 1
        if consent is True:
            record("metered model download consent shown", True)
            if not tap_consent(confirm=False):
                record("metered model download cancellation tap", False,
                       diagnostic_snapshot(before))
                return 1
            cancelled, after_cancel = wait_for_cancelled_download(
                tapped_model_id, before, baseline_snapshot=baseline_snapshot
            )
            record("cancelled model download remains missing", cancelled,
                   str(after_cancel))
            if not cancelled:
                record("model download cancellation diagnostic", False,
                       diagnostic_snapshot(after_cancel))
                return 1
            if not tap_model_download(tapped_model_id):
                record("real settings download retry tap", False,
                       f"model={tapped_model_id}; {diagnostic_snapshot(before)}")
                return 1
            retry_consent = wait_for_consent(before=before)
            if retry_consent is not True or not tap_consent(confirm=True):
                record("metered model download confirmation tap", False,
                       diagnostic_snapshot(before))
                return 1
            record("metered model download confirmation tap", True)
        downloaded_id, after = wait_for_download(
            before, [tapped_model_id], before_note=before_note
        )
        if not downloaded_id:
            record("model download completes", False,
                   diagnostic_snapshot(after))
            return 1
        record(f"real settings download tap: {downloaded_id}", True)
        ok, detail = device_file_checks(by_id[downloaded_id])
        record(f"{downloaded_id} files and INSTALL.json match manifest", ok, detail)
        if not ok:
            record(f"{downloaded_id} download failure diagnostic", False,
                   diagnostic_snapshot(after))
            return 1

    final_states = {entry.get("id"): entry.get("status", "") for entry in model_states()}
    all_installed = all(status_is_installed(final_states.get(model_id, ""))
                        for model_id in expected_ids)
    record("all manifest models show verified installed", all_installed,
           str(final_states) if all_installed else diagnostic_snapshot(final_states))
    if not all_installed:
        return 1

    ok, detail = voice_smoke()
    record("thin production APK voice listening smoke", ok, detail)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
