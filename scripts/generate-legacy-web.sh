#!/usr/bin/env bash
# 生成旧 WebView 兼容的键盘/设置入口脚本（#90 Android 9/10）：
#   app/src/main/assets/keyboard/keyboard.legacy.js
#   app/src/main/assets/settings/settings.legacy.js
#
# 出厂 Chromium <80（Android 9/10、BOOX 类不可更新设备）在解析期拒绝
# ES2020 语法（?. ?? 等），整个入口脚本不执行——键盘空白、设置导航
# 失效。源文件保持现代语法（mock 套件直读源），esbuild --target=chrome66
# 转译出 legacy 副本，index.html 探针在解析失败时加载 legacy 版。
# flat/fromEntries 等运行时 API 由源内 polyfill 兜底（esbuild 只转语法）。
#
# 改动 keyboard.js / settings.js 后必须重跑本脚本（mock 套件里
# check_legacy_web.js 会校验产物与源同步，不同步即挂）。
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ESBUILD=${FEELIME_ESBUILD:-$HOME/.config/feelime/toolchain/esbuild}
if [ ! -x "$ESBUILD" ]; then
    echo "esbuild not found at $ESBUILD" >&2
    echo "install: npm install esbuild@0.28 --prefix /tmp/esb && cp /tmp/esb/node_modules/.bin/esbuild ~/.config/feelime/toolchain/" >&2
    echo "or set FEELIME_ESBUILD to the binary path" >&2
    exit 1
fi

"$ESBUILD" "$ROOT/app/src/main/assets/keyboard/keyboard.js" \
    --target=chrome66 --keep-names \
    --outfile="$ROOT/app/src/main/assets/keyboard/keyboard.legacy.js"
"$ESBUILD" "$ROOT/app/src/main/assets/settings/settings.js" \
    --target=chrome66 --keep-names \
    --outfile="$ROOT/app/src/main/assets/settings/settings.legacy.js"
echo "legacy web assets regenerated"
