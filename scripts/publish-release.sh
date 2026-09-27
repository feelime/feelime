#!/usr/bin/env bash
# 发版产物构建 + 硬校验 + （可选）上传 GitHub release。
#
# 为什么存在：发版序列曾复用 gate 验证过的 direct/debug 产物，而 1.0.19
# 起 debug 构建 applicationId 带 .dev 后缀（与正式包共存的设计）——照老
# 序列走会把 com.feelime.ime.dev 发上 release（issue #40，用户装出
# 「Feelime Dev」）。本脚本把「必须 release 产物」固化成门禁：
#   1. 只构建 assembleDirectRelease（release 构建无 .dev 后缀）
#   2. 逐个产物校验 applicationId 精确等于 com.feelime.ime（任何后缀/别名
#      一律拒绝）、versionName 精确等于 tag、签名者非 debug 证书
#   3. thin→cp→full→cp 顺序坑固化（同路径输出互相覆盖，memory 1.0.14）
#
# 用法: scripts/publish-release.sh v<version> [--upload] [--notes-file <file>]
#   v<version>      版本 tag（如 v1.2.2），必须与 app versionName 一致
#   --upload        校验全过后发布 GitHub release（release 不存在会自动
#                   create；上传后自动核验资产 state/digest/包名）
#   --notes-file F  create 时用的发布说明文件（缺省 --generate-notes，
#                   发布说明可事后 gh release edit 补）
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-}"
UPLOAD=0
NOTES_FILE=""
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --upload) UPLOAD=1 ;;
        --notes-file) NOTES_FILE="${2:-}"; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "usage: $0 v<version> [--upload]   (e.g. $0 v1.2.1)" >&2
    exit 2
fi
VER="${TAG#v}"

# ---- toolchain（arm64 host 走 aapt2 兼容启动器，同 build-debug.sh）----
FEELIME_SDK="${ANDROID_HOME:-/opt/android-sdk}"
BUILD_TOOLS_BIN="$(ls -d "$FEELIME_SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)"
AAPT2="${FEELIME_AAPT2:-${BUILD_TOOLS_BIN}aapt2}"
APKSIGNER="${BUILD_TOOLS_BIN}apksigner"
GRADLE_ARGS=(assembleDirectRelease)
if [[ "$(uname -m)" == "aarch64" ]]; then
    if [[ ! -x "$AAPT2" ]]; then
        echo "arm64 host and aapt2 not executable: $AAPT2" >&2
        exit 1
    fi
    GRADLE_ARGS=("-Pandroid.aapt2FromMavenOverride=$AAPT2" "${GRADLE_ARGS[@]}")
fi

APK_SRC="$PROJECT_DIR/app/build/outputs/apk/direct/release/app-direct-release.apk"
DIST="$PROJECT_DIR/app/build/outputs/release-dist"
mkdir -p "$DIST"

# ---- 单个产物的三重校验；任何一项失败即退出（不发任何文件）----
# 注意取值方式：管道里的 head/grep 提前退出会让上游工具吃 SIGPIPE，被
# pipefail 当成构建失败杀死脚本（aapt2 dump 输出上百行必踩）——先全量
# 捕获进变量，再本地解析。
verify_apk() {
    local apk="$1" expect_ver="$2" badging certs name ver sig
    badging="$("$AAPT2" dump badging "$apk" 2>/dev/null)"
    name="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$badging" | head -1)"
    ver="$(sed -n "s/^package: .*versionName='\([^']*\)'.*/\1/p" <<<"$badging" | head -1)"
    if [[ "$name" != "com.feelime.ime" ]]; then
        echo "REJECT $apk: applicationId='$name' != com.feelime.ime (dev/debug leak)" >&2
        exit 1
    fi
    if [[ "$ver" != "$expect_ver" ]]; then
        echo "REJECT $apk: versionName='$ver' != $expect_ver (stale artifact)" >&2
        exit 1
    fi
    certs="$("$APKSIGNER" verify --print-certs "$apk" 2>/dev/null)"
    sig="$(grep 'Signer.*certificate DN' <<<"$certs" | head -1)"
    if [[ "$sig" != *"CN=Feelime Release"* ]]; then
        echo "REJECT $apk: not release-signed ($sig)" >&2
        exit 1
    fi
    echo "OK $(basename "$apk")  id=$name ver=$ver  ${sig#*: }"
}

cd "$PROJECT_DIR"

# ---- 构建：thin → cp → full → cp（顺序坑：同路径输出互相覆盖）----
echo "== thin build =="
./gradlew -q "${GRADLE_ARGS[@]}" -PfeelimeModels=thin
cp "$APK_SRC" "$DIST/feelime-v${VER}-thin.apk"
verify_apk "$DIST/feelime-v${VER}-thin.apk" "$VER"

echo "== full build =="
./gradlew -q "${GRADLE_ARGS[@]}" -PfeelimeModels=full
cp "$APK_SRC" "$DIST/feelime-v${VER}-full.apk"
verify_apk "$DIST/feelime-v${VER}-full.apk" "$VER"

echo "== sha256 =="
( cd "$DIST" && sha256sum "feelime-v${VER}-thin.apk" "feelime-v${VER}-full.apk" )

if [[ "$UPLOAD" == 1 ]]; then
    # gh release upload 只能往已存在的 release 里传——release 还没建就
    # 先 create（tag 已 push 时 create 不会重复打 tag）。--notes-file
    # 可选，缺省 --generate-notes（发布说明可事后 gh release edit 补）。
    if ! gh release view "$TAG" >/dev/null 2>&1; then
        echo "== create release $TAG =="
        if [[ -n "$NOTES_FILE" ]]; then
            gh release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE"
        else
            gh release create "$TAG" --title "$TAG" --generate-notes
        fi
    fi
    echo "== upload $TAG =="
    gh release upload "$TAG" \
        "$DIST/feelime-v${VER}-thin.apk" \
        "$DIST/feelime-v${VER}-full.apk" \
        --clobber
    # ---- 发布后核验（不依赖人记得）：资产 state + 远端 digest 与本地
    # sha256 逐一比对 + 下载 thin 包复核包名（.dev 泄漏的最后防线）。
    echo "== post-upload verify =="
    RID="$(gh api "repos/{owner}/{repo}/releases/tags/$TAG" -q .id)"
    for i in $(seq 1 40); do
        STATES="$(gh api "repos/{owner}/{repo}/releases/$RID/assets" \
            -q '[.[] | select(.name | startswith("feelime-v"))] | map(.state) | join(",")')"
        [[ "$STATES" == "uploaded,uploaded" ]] && break
        sleep 15
    done
    echo "asset states: $STATES"
    [[ "$STATES" == "uploaded,uploaded" ]] || { echo "REJECT: assets not uploaded" >&2; exit 1; }
    for f in thin full; do
        LOCAL_SHA="$(sha256sum "$DIST/feelime-v${VER}-${f}.apk" | cut -d' ' -f1)"
        REMOTE="$(gh api "repos/{owner}/{repo}/releases/$RID/assets" \
            -q ".[] | select(.name == \"feelime-v${VER}-${f}.apk\") | .digest")"
        echo "  ${f}: local=$LOCAL_SHA remote=$REMOTE"
        [[ "$REMOTE" == "sha256:$LOCAL_SHA" ]] || { echo "REJECT: ${f} digest mismatch" >&2; exit 1; }
    done
    TMPD="$(mktemp -d)"
    gh release download "$TAG" --pattern "feelime-v${VER}-thin.apk" --clobber -D "$TMPD" >/dev/null
    verify_apk "$TMPD/feelime-v${VER}-thin.apk" "$VER"
    rm -rf "$TMPD"
    echo "VERIFIED: $TAG assets are correct (package, version, digest, signature)"
else
    echo "dry-run only (pass --upload to publish): $DIST/feelime-v${VER}-{thin,full}.apk"
fi
