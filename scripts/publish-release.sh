#!/usr/bin/env bash
# 发版产物构建 + 硬校验 + GitHub 发布（分阶段）。
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
# 用法: scripts/publish-release.sh v<version> [模式] [选项]
#   v<version>      版本 tag（如 v1.2.2），必须与 app versionName 一致
#
# 模式（发版 15 分钟改造，codex 方案 2026-11-15）：
#   --build-only    构建两包 + 硬校验 + 归档到 release-dist（默认；= 旧 dry-run）
#   --stage         上传「暂存」：产物不重建，读 release-dist 固定字节；
#                   GitHub 建 draft release + 传资产 + digest 核验（不公开）
#   --finalize      draft → 公开（可补 notes）；幂等：已 published 则仅核验
#   --upload        旧全流程 = build-only + stage + finalize 一条龙（含重建，
#                   保留给不走快速流程的场景）
#
# 选项：
#   --notes-file F  release 说明文件（stage 建 draft / finalize 时用）
#   --verify-sha F  冒烟验收记录的 sha256sum 清单（相对 release-dist 的文件
#                   名）。--stage/--upload 强制：清单必须与上传字节逐一一致，
#                   构建不可复现/源码漂移都会在此拦下。
#
# 快速发版序列（build 与 stage 分离，冒烟在中间）：
#   build-only → ace 冒烟（记录 sha 清单）→ stage → finalize
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-}"
MODE="build"
NOTES_FILE=""
SHA_FILE=""
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --build-only) MODE="build" ;;
        --stage) MODE="stage" ;;
        --finalize) MODE="finalize" ;;
        --upload) MODE="upload" ;;
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
    echo "usage: $0 v<version> [--build-only|--stage|--finalize|--upload] [--notes-file F] [--verify-sha F]" >&2
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
THIN="$DIST/feelime-v${VER}-thin.apk"
FULL="$DIST/feelime-v${VER}-full.apk"
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

do_build() {
    cd "$PROJECT_DIR"
    # ---- 构建：thin → cp → full → cp（顺序坑：同路径输出互相覆盖）----
    # 耗时采集（发版 15 分钟改造）：三产物暖构建预算 ≤5.75min（codex 预算
    # 表的硬条件），每步打印墙钟供对账；连续不达标先查这里再动 Gradle。
    local t0 t1
    t0=$(date +%s)
    echo "== thin build =="
    ./gradlew -q "${GRADLE_ARGS[@]}" -PfeelimeModels=thin
    cp "$APK_SRC" "$THIN"
    verify_apk "$THIN" "$VER"
    t1=$(date +%s); echo "-- thin build+verify: $((t1 - t0))s"

    echo "== full build =="
    ./gradlew -q "${GRADLE_ARGS[@]}" -PfeelimeModels=full
    cp "$APK_SRC" "$FULL"
    verify_apk "$FULL" "$VER"
    echo "-- full build+verify: $(( $(date +%s) - t1 ))s (thin+full total: $(( $(date +%s) - t0 ))s)"

    echo "== sha256 =="
    ( cd "$DIST" && sha256sum "$(basename "$THIN")" "$(basename "$FULL")" )
}

# ---- 上传门闸（必须发布验收过的包，任何不一致在创建 release 前失败）----
# 1) HEAD 必须正是传入 tag：从 tag worktree 构建，防止「验收了 A、上传了 B」
# 2) 工作区必须干净：脏构建的字节没有对应验收记录
# 3) --verify-sha 必填：上传字节与冒烟验收清单逐一比对（产物漂移在此拦下，
#    绝不带未验收字节上 release）
gate_release() {
    TAG_COMMIT="$(git -C "$PROJECT_DIR" rev-parse -q --verify "refs/tags/${TAG}^{commit}")" \
        || { echo "REJECT: local tag $TAG not found — create (and push) the tag first" >&2; exit 1; }
    HEAD_COMMIT="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
    [[ "$HEAD_COMMIT" == "$TAG_COMMIT" ]] \
        || { echo "REJECT: HEAD $HEAD_COMMIT != $TAG ($TAG_COMMIT) — build from the tag worktree" >&2; exit 1; }
    [[ -z "$(git -C "$PROJECT_DIR" status --porcelain)" ]] \
        || { echo "REJECT: dirty worktree — commit or stash before publishing" >&2; exit 1; }
    [[ -n "$SHA_FILE" ]] \
        || { echo "REJECT: staging/uploading requires --verify-sha <accepted sha256 list> (release-smoke acceptance record)" >&2; exit 1; }
    [[ -f "$SHA_FILE" ]] \
        || { echo "REJECT: --verify-sha file not found: $SHA_FILE" >&2; exit 1; }
    # 清单必须恰好列出本版本 thin/full 两个文件各一次。sha256sum -c 只验
    # 证清单里已有的条目——漏掉 full、重复 thin、甚至只列一个无关文件都
    # 会"通过"，随后照常上传两个 APK。且 sha256sum 把「哈希后两个空格的
    # 其余全部」当文件名（可含空格）：`<hash>␣␣other feelime-…-thin.apk`
    # 会被首/末字段解析放过而实际校验的是另一个文件——所以必须整行精确
    # 等于 "<64hex>␣␣<本版本文件名>"（sha256sum 默认双空格格式）。
    thin_entry="$(basename "$THIN")"; full_entry="$(basename "$FULL")"
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
        || { echo "REJECT: staged artifacts differ from the accepted SHAs — these bytes were never smoke-accepted; rerun build+smoke" >&2; exit 1; }
    # stage 模式不重建：上传前对固定产物再做一次身份校验（防 dist 被
    # 别的流程覆盖成未验收字节而 sha 清单本身又过期吻合的边角）。
    verify_apk "$THIN" "$VER"
    verify_apk "$FULL" "$VER"
}

# ---- stage：draft release + 资产 + digest 核验（不公开）----
do_stage() {
    gate_release
    # gh release upload 只能往已存在的 release 里传——还没有就先建 draft
    # （--draft：对外不可见，finalize 才公开；tag 已 push 时 create 不会
    # 重复打 tag）。已 published 的 release 不允许再 stage。
    if gh release view "$TAG" >/dev/null 2>&1; then
        IS_DRAFT="$(gh release view "$TAG" --json isDraft -q .isDraft)"
        if [[ "$IS_DRAFT" != "true" ]]; then
            echo "REJECT: release $TAG already published — nothing to stage (use --finalize to re-verify)" >&2
            exit 1
        fi
        echo "== reuse existing draft $TAG =="
    else
        echo "== create draft release $TAG =="
        if [[ -n "$NOTES_FILE" ]]; then
            gh release create "$TAG" --draft --title "$TAG" --notes-file "$NOTES_FILE"
        else
            gh release create "$TAG" --draft --title "$TAG" --generate-notes
        fi
    fi
    echo "== upload assets to draft $TAG =="
    gh release upload "$TAG" "$THIN" "$FULL" --clobber
    # ---- 暂存后核验（不依赖人记得）：资产 state + 远端 digest 与本地
    # sha256 逐一比对 + 下载 thin 包复核包名（.dev 泄漏的最后防线）。
    echo "== post-stage verify =="
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
    echo "STAGED: $TAG draft verified (package, version, digest, signature) — finalize to publish"
}

# ---- finalize：draft → 公开（幂等）----
do_finalize() {
    gh release view "$TAG" >/dev/null 2>&1 \
        || { echo "REJECT: release $TAG not found — stage first" >&2; exit 1; }
    IS_DRAFT="$(gh release view "$TAG" --json isDraft -q .isDraft)"
    if [[ "$IS_DRAFT" == "true" ]]; then
        if [[ -n "$NOTES_FILE" ]]; then
            gh release edit "$TAG" --draft=false --notes-file "$NOTES_FILE" >/dev/null
        else
            gh release edit "$TAG" --draft=false >/dev/null
        fi
        echo "PUBLISHED: $TAG"
    else
        echo "already published: $TAG"
    fi
    gh release view "$TAG" --json url -q .url
}

case "$MODE" in
    build)
        do_build
        echo "built only (next: smoke-accept, then --stage): $THIN $FULL"
        ;;
    stage)
        do_stage
        ;;
    finalize)
        do_finalize
        ;;
    upload)
        do_build
        do_stage
        do_finalize
        ;;
esac
