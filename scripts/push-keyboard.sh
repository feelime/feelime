#!/usr/bin/env bash
# ADB debug hot-update: push a keyboard ZIP through the SAME install
# path as production updates (SetupActivity -> KeyboardStore.install). The IME
# reloads via the KEYBOARD_UPDATED broadcast; no force-stop, no restart.
# Usage: scripts/push-keyboard.sh <keyboard.zip> [serial]
#        scripts/push-keyboard.sh --local [serial]   # package+push the repo keyboard
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [ "${1:-}" = "--local" ]; then
    ZIP=$(mktemp -u /tmp/feelime-kb-XXXXXX.zip)
    "$HERE/package-keyboard.sh" "$ZIP"
    shift || true
else
    ZIP=${1:?usage: push-keyboard.sh <keyboard.zip> | --local [serial]}
    shift || true
fi
SERIAL=${1:-}
ADB=(adb)
[ -n "$SERIAL" ] && ADB=(adb -s "$SERIAL")
# debug 构建包名带 .dev 后缀（与正式包共存）：显式 FEELIME_PKG >
# 设备装了 .dev 用 .dev > 正式包名。
PKG=${FEELIME_PKG:-}
if [ -z "$PKG" ]; then
    if "${ADB[@]}" shell pm list packages 2>/dev/null | grep -q '^package:com\.feelime\.ime\.dev$'; then
        PKG=com.feelime.ime.dev
    else
        PKG=com.feelime.ime
    fi
fi

"${ADB[@]}" shell pm path "$PKG" >/dev/null || {
    echo "Feelime is not installed on the connected device." >&2
    exit 1
}

"${ADB[@]}" push "$ZIP" /data/local/tmp/feelime-kb.zip
"${ADB[@]}" shell "run-as $PKG sh -c 'mkdir -p files/keyboard-inbox && cp /data/local/tmp/feelime-kb.zip files/keyboard-inbox/inbox.zip'"
"${ADB[@]}" shell rm /data/local/tmp/feelime-kb.zip
"${ADB[@]}" shell am start -n "$PKG/com.feelime.ime.SetupActivity" --es feelime.install 1
echo "install requested; re-show the keyboard to load the new version"
