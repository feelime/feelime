#!/usr/bin/env bash
# Build a Feelime keyboard hot-update ZIP from the bundled keyboard.
# Usage: scripts/package-keyboard.sh [--unsigned] [output.zip]
#   signed (default): Ed25519 signature, the production update path
#                     (Env: FEELIME_SIGNING_KEY, PEM private key;
#                      FEELIME_KEY_ID overrides the manifest keyId, used for
#                      throwaway test identities)
#   --unsigned:       no signature - installs ONLY on debug builds
#                     (BuildConfig.DEBUG allows unsigned packages); this is
#                     the fast intranet loop: publish the ZIP, update from
#                     the setup page URL field, no APK rebuild.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
KEYBOARD_DIR="$ROOT/app/src/main/assets/keyboard"
KEY=${FEELIME_SIGNING_KEY:-$HOME/.feelime/release-ed25519.key}
KEY_ID=${FEELIME_KEY_ID:-feelime-release-2026-08}

UNSIGNED=0
ARGS=()
for arg in "$@"; do
    if [ "$arg" = "--unsigned" ]; then UNSIGNED=1; else ARGS+=("$arg"); fi
done
OUT=${ARGS[0]:-feelime-keyboard.zip}

if [ "$UNSIGNED" = "0" ]; then
    [ -f "$KEY" ] || { echo "missing signing key: $KEY (or pass --unsigned)" >&2; exit 1; }
fi
command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }
if [ "$UNSIGNED" = "0" ]; then
    command -v openssl >/dev/null || { echo "openssl required" >&2; exit 1; }
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp "$KEYBOARD_DIR"/{index.html,keyboard.css,keyboard.js,keyboard.legacy.js,VERSION} "$WORK/"

VERSION=$(tr -d '\n' < "$WORK/VERSION")
python3 - "$WORK" "$VERSION" <<'PYEOF'
import ast, hashlib, json, os, re, subprocess, sys, zipfile

work, version = sys.argv[1], sys.argv[2]
key_id = os.environ.get("FEELIME_KEY_ID", "feelime-release-2026-08")
payloads = ["index.html", "keyboard.css", "keyboard.js", "keyboard.legacy.js", "VERSION"]

files = {}
for name in payloads:
    with open(f"{work}/{name}", "rb") as handle:
        files[name] = handle.read()

def canonical(value):
    if isinstance(value, str):
        out = '"'
        for ch in value:
            if ch == '"': out += '\\"'
            elif ch == "\\": out += "\\\\"
            elif ch == "\b": out += "\\b"
            elif ch == "\f": out += "\\f"
            elif ch == "\n": out += "\\n"
            elif ch == "\r": out += "\\r"
            elif ch == "\t": out += "\\t"
            elif ord(ch) < 0x20: out += "\\u%04x" % ord(ch)
            else: out += ch
        return (out + '"').encode()
    if isinstance(value, bool):
        raise SystemExit("bools not allowed")
    if isinstance(value, int):
        return str(value).encode()
    if isinstance(value, list):
        return b"[" + b",".join(canonical(item) for item in value) + b"]"
    if isinstance(value, dict):
        items = sorted(value.items())
        return b"{" + b",".join(canonical(k) + b":" + canonical(v) for k, v in items) + b"}"
    raise SystemExit(f"unsupported type {type(value)}")

capabilities = ast.literal_eval(re.search(
    r"REQUIRED_CAPABILITIES = (\[[^\]]*\])",
    files["keyboard.js"].decode(), re.S).group(1))
if len(capabilities) != len(set(capabilities)):
    raise SystemExit("duplicate keyboard required capability")

manifest = canonical({
    "formatVersion": 1,
    "keyboardVersion": version,
    "minNativeApi": 1,
    # MUST mirror keyboard.js REQUIRED_CAPABILITIES - the installer gates on
    # this list, and a stale list bricks the update handshake (the keyboard
    # requests a capability the manifest never declared, every package dies
    # with COMPAT_CAPABILITIES). Extract the live list from the source
    # instead of hand-maintaining a copy.
    "requiredCapabilities": sorted(capabilities),
    "keyId": key_id,
    "payload": {
        name: {
            "bytes": len(files[name]),
            "sha256": hashlib.sha256(files[name]).hexdigest(),
        }
        for name in payloads
    },
})
with open(f"{work}/feelime-keyboard.json", "wb") as handle:
    handle.write(manifest)
print("content-hash:", hashlib.sha256(manifest).hexdigest())
PYEOF

if [ "$UNSIGNED" = "1" ]; then
    echo "(unsigned package - debug builds only)"
else
    openssl pkeyutl -sign -inkey "$KEY" -rawin \
        -in "$WORK/feelime-keyboard.json" -out "$WORK/feelime-keyboard.sig"
fi

python3 - "$WORK" "$OUT" "$UNSIGNED" <<'PYEOF'
import sys, zipfile

work, out, unsigned = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
entries = [
    "feelime-keyboard.json",
]
if not unsigned:
    entries.append("feelime-keyboard.sig")
entries += [
    "index.html",
    "keyboard.css",
    "keyboard.js",
    "VERSION",
]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in entries:
        info = zipfile.ZipInfo(name)
        # Regular file, rw-r--r--; my verifier rejects symlinks/specials.
        info.external_attr = 0o100644 << 16
        info.create_system = 3
        with open(f"{work}/{name}", "rb") as handle:
            archive.writestr(info, handle.read())
print("wrote", out)
PYEOF

python3 - "$OUT" <<'PYEOF'
import hashlib, sys
with open(sys.argv[1], "rb") as handle:
    print("zip sha256:", hashlib.sha256(handle.read()).hexdigest())
PYEOF
