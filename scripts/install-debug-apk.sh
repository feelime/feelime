#!/usr/bin/env bash
# 构建 directDebug APK → 核验产物内 Web 资产与仓库一致 → 装到指定设备。
#
# 为什么核验：改完代码忘了重新构建就 adb install 旧 APK，设备上跑的是
# 旧 JS/Kotlin，整套验收假失败（2026-09-26 真机实录：R4 修正后未重建，
# APK 键盘资产落后 repo，装机前 sha 比对才发现）。把这一步固化在安装
# 流程里，不依赖任何人记得。
#
# 用法: scripts/install-debug-apk.sh <adb-serial> [--no-build] [--allow-stale]
#   --no-build     跳过 gradlew（用现有产物）
#   --allow-stale  产物与 repo 有差异仍强装（显式承认装旧包，仅在复现
#                  历史 bug 需要旧产物时使用）
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$PROJECT_DIR/app/build/outputs/apk/direct/debug/app-direct-debug.apk"
# 只核 Web 资产目录（keyboard/settings）：本次坑的域，且文件名在 APK 内
# 1:1 保留。engine 的 .gz 资产会被 aapt2 解压去后缀改名，逐名比对会误报，
# 不在核验范围。
ASSET_DIRS=(keyboard settings)

serial="${1:-}"
no_build=0
allow_stale=0
for arg in "${@:2}"; do
    case "$arg" in
        --no-build) no_build=1 ;;
        --allow-stale) allow_stale=1 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done
if [[ -z "$serial" ]]; then
    echo "usage: $0 <adb-serial> [--no-build] [--allow-stale]" >&2
    exit 2
fi

cd "$PROJECT_DIR"
if [[ "$no_build" -eq 0 ]]; then
    echo "== build =="
    ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}" ./gradlew -q :app:assembleDirectDebug
fi
if [[ ! -f "$APK" ]]; then
    echo "APK not found: $APK (run without --no-build first)" >&2
    exit 1
fi

echo "== verify APK assets vs repo =="
mismatch=0
checked=0
for dir in "${ASSET_DIRS[@]}"; do
    while IFS= read -r rel; do
        # 空目录占位等非文件条目跳过
        [[ -z "$rel" ]] && continue
        apk_sha=$(unzip -p "$APK" "assets/$dir/$rel" 2>/dev/null | sha256sum | cut -d' ' -f1)
        repo_sha=$(sha256sum "app/src/main/assets/$dir/$rel" | cut -d' ' -f1)
        checked=$((checked + 1))
        if [[ "$apk_sha" != "$repo_sha" ]]; then
            echo "  MISMATCH assets/$dir/$rel (apk=${apk_sha:0:16} repo=${repo_sha:0:16})"
            mismatch=$((mismatch + 1))
        fi
    done < <(cd "app/src/main/assets/$dir" && find . -type f | sed 's|^\./||')
done
if [[ "$mismatch" -gt 0 ]]; then
    if [[ "$allow_stale" -eq 1 ]]; then
        echo "!! $mismatch stale asset(s) -- installing anyway (--allow-stale)"
    else
        echo "ERROR: $mismatch/$checked asset(s) differ between APK and repo." >&2
        echo "  产物落后于代码（忘重建？）——重新跑本脚本去掉 --no-build；" >&2
        echo "  确要装旧产物加 --allow-stale。" >&2
        exit 1
    fi
else
    echo "  $checked asset(s) OK"
fi

echo "== install to $serial =="
adb -s "$serial" install -r --no-streaming "$APK"

cat <<'NOTE'
== 提醒 ==
设备上的键盘 built-in 副本不随重装刷新：键盘资产有变时，需在设置页
「恢复内置」（或 bump 键盘 VERSION 触发热更），再 force-stop 生效。
NOTE
