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
# 用法: scripts/publish-release.sh v<version> [--upload] [--notes-file <file>] [--verify-sha <file>]
#   v<version>      版本 tag（如 v1.2.2），必须与 app versionName 一致
#   --upload        校验全过后发布 GitHub release（release 不存在会自动
#                   create；上传后自动核验资产 state/digest/包名）
#   --notes-file F  create 时用的发布说明文件（缺省 --generate-notes，
#                   发布说明可事后 gh release edit 补）
#   --verify-sha F  冒烟验收时记录的 sha256sum 清单（相对 release-dist 的
#                   文件名）。--upload 时强制：重建出的 thin/full APK 字节
#                   必须与验收清单一致（构建不可复现/源码漂移都会在此拦下），
#                   任何不一致在创建 release 前失败。
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-}"
UPLOAD=0
NOTES_FILE=""
SHA_FILE=""
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --upload) UPLOAD=1 ;;
        --notes-file) NOTES_FILE="${2:-}"; shift ;;
        --verify-sha) SHA_FILE="${2:-}"; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
    shift
done
# 清单路径按调用者目录转绝对——后续在 PROJECT_DIR / DIST 下 cd 多次，
# 相对路径会失效或意外命中同名文件。
if [[ -n "$SHA_FILE" && "$SHA_FILE" != /* ]]; then
    SHA_FILE="$(pwd)/$SHA_FILE"
fi
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
    # ---- 上传门闸（必须发布验收过的包，任何不一致在创建 release 前失败）----
    # 1) HEAD 必须正是传入 tag：从 tag worktree 构建，防止「验收了 A、上传了 B」
    # 2) 工作区必须干净：脏构建的字节没有对应验收记录
    # 3) --verify-sha 必填：重建字节与冒烟验收清单逐一比对（构建不可复现/
    #    源码漂移在此拦下，绝不带未验收字节上 release）
    TAG_COMMIT="$(git -C "$PROJECT_DIR" rev-parse -q --verify "refs/tags/${TAG}^{commit}")" \
        || { echo "REJECT: local tag $TAG not found — create (and push) the tag first" >&2; exit 1; }
    HEAD_COMMIT="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
    [[ "$HEAD_COMMIT" == "$TAG_COMMIT" ]] \
        || { echo "REJECT: HEAD $HEAD_COMMIT != $TAG ($TAG_COMMIT) — build from the tag worktree" >&2; exit 1; }
    [[ -z "$(git -C "$PROJECT_DIR" status --porcelain)" ]] \
        || { echo "REJECT: dirty worktree — commit or stash before publishing" >&2; exit 1; }
    [[ -n "$SHA_FILE" ]] \
        || { echo "REJECT: --upload requires --verify-sha <accepted sha256 list> (release-smoke acceptance record)" >&2; exit 1; }
    [[ -f "$SHA_FILE" ]] \
        || { echo "REJECT: --verify-sha file not found: $SHA_FILE" >&2; exit 1; }
    # 清单必须恰好列出本版本 thin/full 两个文件各一次。sha256sum -c 只验
    # 证清单里已有的条目——漏掉 full、重复 thin、甚至只列一个无关文件都
    # 会"通过"，随后照常上传两个 APK。且 sha256sum 把「哈希后两个空格的
    # 其余全部」当文件名（可含空格）：`<hash>␣␣other feelime-…-thin.apk`
    # 会被首/末字段解析放过而实际校验的是另一个文件——所以必须整行精确
    # 等于 "<64hex>␣␣<本版本文件名>"（sha256sum 默认双空格格式）。
    thin_entry="feelime-v${VER}-thin.apk"; full_entry="feelime-v${VER}-full.apk"
    n_thin=0; n_full=0
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -n "$line" ]] || continue
        hash="${line%% *}"
        if [[ "$hash" =~ ^[0-9a-f]{64}$ && ( "$line" == "$hash  $thin_entry" || "$line" == "$hash  $full_entry" ) ]]; then
            if [[ "$line" == *"$thin_entry" ]]; then n_thin=$((n_thin+1)); else n_full=$((n_full+1)); fi
        else
            echo "REJECT: malformed or unexpected entry in $SHA_FILE: $line" >&2; exit 1
        fi
    done < "$SHA_FILE"
    [[ "$n_thin" == 1 && "$n_full" == 1 ]] \
        || { echo "REJECT: $SHA_FILE must list $thin_entry and $full_entry exactly once each (got thin=$n_thin full=$n_full)" >&2; exit 1; }
    echo "== verify accepted SHAs ($SHA_FILE) =="
    # bash read 会丢 NUL，会造成上面的行校验与 sha256sum 的解析不一致
    # （sha256sum 默认跳过畸形行，攻击行可以只过门闸、不参与字节校验）。
    # 先在原始字节层面拒绝 NUL，再让 sha256sum 以 --strict 遇畸形行即败。
    if ! cmp -s "$SHA_FILE" <(tr -d '\0' < "$SHA_FILE"); then
        echo "REJECT: NUL byte in $SHA_FILE" >&2; exit 1
    fi
    ( cd "$DIST" && sha256sum --strict -c "$SHA_FILE" ) \
        || { echo "REJECT: rebuilt artifacts differ from the accepted SHAs — rerun smoke acceptance on these bytes before uploading" >&2; exit 1; }
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
