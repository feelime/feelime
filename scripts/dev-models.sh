#!/usr/bin/env bash
# Publish the machine-local model tree as a download source for device tests
# (the docs say WHERE it mounts; no hostname lives in the repo).
#
# Two modes:
#   scripts/dev-models.sh <web-root>/feelime/models [url-prefix]
#       Copy the verified model tree + a digest-filled manifest.json into an
#       nginx/static web root (persistent deployment).
#   scripts/dev-models.sh --serve <device-reachable-host> [port]
#       Generate the same layout under the local cache and serve it with a
#       temporary `python3 -m http.server`; writes models/dev-urls.json
#       (gitignored) so the next `-PfeelimeModels=thin -PfeelimeDevModels=true
#       assembleDirectDebug` build embeds this LAN prefix. On the settings
#       page pick 「自定义源」 (leave the base empty) to download from it.
#       gzip-backed files (gunzip=true, e.g. the streaming encoder) cannot
#       be served raw here - download those via the default gitee source.
#       For a device on a far network, run the same on a host near it
#       (or its own Termux) and point dev-urls.json at that address.
#
# The sha256/bytes come from the locally verified model tree (shared
# ~/.config/feelime/models by default; legacy in-tree app/src/modelAssets/full
# still works). Model bytes NEVER enter the repo.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$HERE/feelime-env.sh"

CONFIG_DIR="${FEELIME_CONFIG_DIR:-$HOME/.config/feelime}"
MODELS_ROOT="${FEELIME_MODELS_DIR:-$CONFIG_DIR/models}"
REPO_ROOT=$(cd "$HERE/.." && pwd)
REPO_FALLBACK="$REPO_ROOT/app/src/modelAssets/full"
if [[ -d "$MODELS_ROOT" ]]; then
    SRC="$MODELS_ROOT"
elif [[ -d "$REPO_FALLBACK" ]]; then
    SRC="$REPO_FALLBACK"
else
    echo "no model tree found (run scripts/setup-assets.sh first)" >&2
    echo "  tried: $MODELS_ROOT" >&2
    echo "  tried: $REPO_FALLBACK" >&2
    exit 2
fi

SERVE_HOST=""
SERVE_PORT=""
if [[ "${1:-}" == "--serve" ]]; then
    shift
    SERVE_HOST=${1:?usage: dev-models.sh --serve <device-reachable-host> [port]}
    SERVE_PORT=${2:-8765}
    OUT="${XDG_CACHE_HOME:-/tmp}/feelime/serve"
    URL_PREFIX="http://$SERVE_HOST:$SERVE_PORT"
else
    OUT=${1:?usage: dev-models.sh <nginx-share>/feelime/models [url-prefix] | --serve <host> [port]}
    URL_PREFIX=${2:-}
fi
mkdir -p "$OUT"

python3 - "$SRC" "$OUT" "$REPO_ROOT" <<'PY'
import hashlib, json, os, shutil, sys
src, out, repo_root = sys.argv[1], sys.argv[2], sys.argv[3]
manifest_path = os.path.join(repo_root, "models", "manifest.json")
manifest = json.load(open(manifest_path))

def digest_matches(path, size, digest):
    if not os.path.isfile(path) or os.path.getsize(path) != size:
        return False
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest() == digest

for model in manifest["models"]:
    for entry in model["files"]:
        local = os.path.join(src, entry["path"])
        data = open(local, "rb").read()
        entry["bytes"] = len(data)
        entry["sha256"] = hashlib.sha256(data).hexdigest()
        model_dir = entry["path"].split("/", 1)[0]
        local_dest = os.path.join(out, entry["path"])
        download_dest = os.path.join(
            out, model_dir, entry.get("downloadPath", entry["path"].split("/", 1)[1])
        )
        for dest in {local_dest, download_dest}:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            # Compare bytes as well as size: a same-sized refreshed model must
            # never leave stale LAN content behind its new manifest digest.
            if not digest_matches(dest, len(data), entry["sha256"]):
                shutil.copyfile(local, dest)
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=2)
print("model web root written to", out)
for model in manifest["models"]:
    print(" ", model["id"], sum(f["bytes"] for f in model["files"]), "bytes")
PY

if [[ -n "$URL_PREFIX" ]]; then
  [[ "$URL_PREFIX" == */ ]] || URL_PREFIX="$URL_PREFIX/"
  printf '[\n  "%s"\n]\n' "$URL_PREFIX" > "$HERE/../models/dev-urls.json"
  echo "models/dev-urls.json written ($URL_PREFIX)"
  echo "rebuild with: ./gradlew -PfeelimeModels=thin -PfeelimeDevModels=true :app:assembleDirectDebug"
fi

if [[ -n "$SERVE_HOST" ]]; then
  echo "serving $OUT at $URL_PREFIX (Ctrl-C to stop)"
  # Range-aware server: the device downloader resumes with Range requests;
  # plain `python3 -m http.server` answers 200-full-body and corrupts .part.
  exec python3 "$HERE/serve-models.py" "$SERVE_PORT" "$OUT"
fi
