#!/usr/bin/env bash
# publish-release.sh 上传门闸的隔离测试（2026-10-27，#72 发版纪律）。
#
# 不碰真实仓库/SDK/GitHub：临时 git 仓库 + stub gradlew/aapt2/apksigner/gh，
# 验证 --upload 分支的四道门闸（HEAD==tag、干净工作区、--verify-sha 必填、
# 验收清单恰好含本版本 thin/full 各一次且字节一致）：
#   - 任一失败场景必须以非零退出，且 gh release create/upload 一次都不能被调用
#   - 完整正确清单（绝对/相对路径一致）门闸放行，create/upload 各被调用一次
# post-upload 的远端 digest 核验依赖真实 gh api，不在本测试范围（stub 的
# digest 字段留空，成功场景会在该阶段退出——断言只覆盖到 upload 调用）。
set -uo pipefail

REPO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/publish-release.sh"
T="$(mktemp -d /tmp/pubgate-test.XXXXXX)"
fails=0
GH_CALLS="$T/gh-calls"; : > "$GH_CALLS"; export GH_CALLS  # stub gh 是独立进程，必须导出

stub_env() { # $1=repoDir —— 文件全部就位后再做初始提交（顺序反了=工作区恒脏）
    local repo="$1"
    mkdir -p "$repo/scripts" "$T/bin" "$T/sdk/build-tools/99.0.0"
    cp "$REPO_SCRIPT" "$repo/scripts/publish-release.sh"
    # stub gradlew：确定性字节（thin/full 各固定内容），并铺出产物路径
    cat > "$repo/gradlew" <<'SH'
#!/usr/bin/env bash
out="app/build/outputs/apk/direct/release"
mkdir -p "$out"
case "$*" in *feelimeModels=thin*) printf 'fake-thin-apk' > "$out/app-direct-release.apk" ;;
                       *) printf 'fake-full-apk' > "$out/app-direct-release.apk" ;; esac
SH
    chmod +x "$repo/gradlew"
    printf 'app/build/\n' > "$repo/.gitignore"
    # git 仓库：一个提交（tag 由调用方决定打不打/打在哪）
    git -C "$repo" init -q
    git -C "$repo" -c user.email=t@t -c user.name=t add -A
    git -C "$repo" -c user.email=t@t -c user.name=t commit -qm init
    # stub aapt2：dump badging 吐期望包名/版本（FAKE_VER）
    cat > "$T/sdk/build-tools/99.0.0/aapt2" <<'SH'
#!/usr/bin/env bash
[ "$1" = dump ] && [ "$2" = badging ] && \
  echo "package: name='com.feelime.ime' versionCode='69' versionName='9.9.9'"
exit 0
SH
    # stub apksigner：吐 release 签名 DN
    cat > "$T/sdk/build-tools/99.0.0/apksigner" <<'SH'
#!/usr/bin/env bash
echo "Signer #1 certificate DN: CN=Feelime Release"
SH
    chmod +x "$T/sdk/build-tools/99.0.0/"*
    # stub gh：记录子命令；api 按脚本传入的 -q 表达式用真 jq 应答（digest
    # 给不可能匹配的假值——成功场景在 post-upload digest 核验处干净退出，
    # 该阶段属真实 GitHub 行为，不在本隔离测试的断言范围）。
    cat > "$T/bin/gh" <<'SH'
#!/usr/bin/env bash
echo "gh $1 $2" >> "$GH_CALLS"
if [[ "$1 $2" == "release view" ]]; then exit 1; fi
if [[ "$1 $2" == "release create" || "$1 $2" == "release upload" ]]; then exit 0; fi
q=""; args=("$@")
for ((i=0; i<${#args[@]}; i++)); do [[ "${args[$i]}" == "-q" ]] && q="${args[$((i+1))]}"; done
if [[ "$*" == *"releases/tags/"* ]]; then echo '{"id":1}' | jq -r "$q"; exit 0; fi
if [[ "$*" == *"/assets"* ]]; then
  echo '[{"name":"feelime-v9.9.9-thin.apk","state":"uploaded","digest":"sha256:00"},
        {"name":"feelime-v9.9.9-full.apk","state":"uploaded","digest":"sha256:00"}]' | jq -r "$q"
  exit 0
fi
exit 0
SH
    chmod +x "$T/bin/gh"
}

expect_reject() { # $1=场景名 $2=期望拒绝原因子串 $3...=命令
    local name="$1" why="$2"; shift 2
    local out; out=$("$@" 2>&1); local rc=$?
    local cu
    cu=$(grep -cE "gh release (create|upload)" "$GH_CALLS" || true)
    if [[ $rc -eq 0 ]]; then
        echo "FAIL[$name] 期望非零退出，实际 0"; fails=$((fails+1))
    elif [[ "$out" != *"REJECT"* ]]; then
        echo "FAIL[$name] 期望 REJECT 信息，输出: $out"; fails=$((fails+1))
    elif [[ "$out" != *"$why"* ]]; then
        # 原因不符=可能被后续门闸碰巧拒绝，门闸本身失效也不红
        echo "FAIL[$name] 拒绝原因不含「$why」: $(echo "$out" | grep REJECT | head -1)"; fails=$((fails+1))
    elif [[ "$cu" != 0 ]]; then
        echo "FAIL[$name] 失败场景调用了 gh release create/upload"; fails=$((fails+1))
    else
        echo "ok  [$name] ${out##*REJECT: }" | head -1
    fi
}

run_pub() { # 在 repo 内以环境 stub 跑脚本（参数原样透传）
    local repo="$1"; shift
    ( cd "$repo" && PATH="$T/bin:$PATH" ANDROID_HOME="$T/sdk" \
      scripts/publish-release.sh "$@" ) 2>&1
}

accepted_list() { # 正确清单（sha 与 stub 字节一致）
    printf '%s  %s\n%s  %s\n' \
        "$(printf 'fake-thin-apk' | sha256sum | cut -d' ' -f1)" "feelime-v9.9.9-thin.apk" \
        "$(printf 'fake-full-apk' | sha256sum | cut -d' ' -f1)" "feelime-v9.9.9-full.apk"
}

echo "== 失败场景（必须 REJECT 且 gh 零调用） =="

# A. tag 缺失
: > "$GH_CALLS"; r="$T/a"; mkdir -p "$r"; stub_env "$r"
expect_reject "tag-missing" "tag v9.9.9 not found" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha /dev/null"
# A 场景在 tag 检查前会跑构建——stub 已就位，无妨

# B. HEAD != tag（tag 打在第一个提交，HEAD 是第二个）
: > "$GH_CALLS"; r="$T/b"; mkdir -p "$r"; stub_env "$r"
git -C "$r" tag v9.9.9
echo second > "$r/second.txt"; git -C "$r" -c user.email=t@t -c user.name=t add -A; git -C "$r" -c user.email=t@t -c user.name=t commit -qm second
expect_reject "head-ne-tag" "!= v9.9.9" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha /dev/null"

# C. 工作区脏
: > "$GH_CALLS"; r="$T/c"; mkdir -p "$r"; stub_env "$r"
git -C "$r" tag v9.9.9; echo dirty > "$r/uncommitted.txt"; git -C "$r" add uncommitted.txt
expect_reject "dirty-worktree" "dirty worktree" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha /dev/null"

# D. 未传 --verify-sha
: > "$GH_CALLS"; r="$T/d"; mkdir -p "$r"; stub_env "$r"
git -C "$r" tag v9.9.9
expect_reject "no-sha-file" "requires --verify-sha" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload"

# E~J. 清单形态（tag/HEAD/工作区均正确）
r="$T/e"; mkdir -p "$r"; stub_env "$r"; git -C "$r" tag v9.9.9
THIN_SHA="$(printf 'fake-thin-apk' | sha256sum | cut -d' ' -f1)"
FULL_SHA="$(printf 'fake-full-apk' | sha256sum | cut -d' ' -f1)"
: > "$GH_CALLS"
printf '%s  feelime-v9.9.9-thin.apk\n' "$THIN_SHA" > "$T/miss-full.sha"
expect_reject "list-missing-full" "exactly once each" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/miss-full.sha"
: > "$GH_CALLS"
printf '%s  feelime-v9.9.9-thin.apk\n%s  feelime-v9.9.9-thin.apk\n' "$THIN_SHA" "$THIN_SHA" > "$T/dup-thin.sha"
expect_reject "list-duplicate-thin" "exactly once each" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/dup-thin.sha"
: > "$GH_CALLS"
printf '%s  other.apk\n%s  feelime-v9.9.9-full.apk\n' "$THIN_SHA" "$FULL_SHA" > "$T/unrelated.sha"
expect_reject "list-unrelated-entry" "malformed or unexpected" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/unrelated.sha"
: > "$GH_CALLS"
printf 'zzz  feelime-v9.9.9-thin.apk\n%s  feelime-v9.9.9-full.apk\n' "$FULL_SHA" > "$T/badhash.sha"
expect_reject "list-bad-hash-format" "malformed or unexpected" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/badhash.sha"
: > "$GH_CALLS"
printf '%s  feelime-v9.9.9-thin.apk\n%s  feelime-v9.9.9-full.apk\n' "$(printf 'wrong-thin' | sha256sum | cut -d' ' -f1)" "$FULL_SHA" > "$T/mismatch.sha"
expect_reject "sha-mismatch" "differ from the accepted" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/mismatch.sha"
: > "$GH_CALLS"
expect_reject "sha-file-not-found" "--verify-sha file not found" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/nonexistent.sha"

# M. 中间夹带（整行校验）：伪造行让 sha256sum 校验另一个文件——攻击文件
# 必须真实存在且摘要正确（不靠文件不存在碰巧失败），门闸必须按整行拒绝。
: > "$GH_CALLS"
SMUGGLE_NAME="other feelime-v9.9.9-thin.apk"
mkdir -p "$r/app/build/outputs/release-dist"
printf 'smuggled-bytes' > "$r/app/build/outputs/release-dist/$SMUGGLE_NAME"
SMUGGLE_SHA="$(printf 'smuggled-bytes' | sha256sum | cut -d' ' -f1)"
printf '%s  %s\n%s  %s\n' "$SMUGGLE_SHA" "$SMUGGLE_NAME" "$FULL_SHA" "feelime-v9.9.9-full.apk" > "$T/smuggle.sha"
expect_reject "list-smuggled-filename" "malformed or unexpected" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/smuggle.sha"

# N. 清单缺 thin（与缺 full 对称）
: > "$GH_CALLS"
printf '%s  feelime-v9.9.9-full.apk\n' "$FULL_SHA" > "$T/miss-thin.sha"
expect_reject "list-missing-thin" "exactly once each" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/miss-thin.sha"

# O. full 摘要不符（与 thin 不符对称）
: > "$GH_CALLS"
printf '%s  feelime-v9.9.9-thin.apk\n%s  feelime-v9.9.9-full.apk\n' "$THIN_SHA" "$(printf 'wrong-full' | sha256sum | cut -d' ' -f1)" > "$T/mismatch-full.sha"
expect_reject "sha-mismatch-full" "differ from the accepted" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/mismatch-full.sha"

# P. NUL 夹带：bash read 丢 NUL 后行校验合法、sha256sum 跳过该行只验
# full——只有原始字节层拒绝能堵住。首行摘要对 thin 而言是错的也无所谓。
: > "$GH_CALLS"
printf '%s\000%s  feelime-v9.9.9-thin.apk\n%s  %s\n'     "00000000000000000000000000000000" "00000000000000000000000000000000"     "$FULL_SHA" "feelime-v9.9.9-full.apk" > "$T/nul-smuggle.sha"
expect_reject "list-nul-smuggle" "NUL byte" bash -c "$(declare -f run_pub); T=$T; run_pub $r v9.9.9 --upload --verify-sha $T/nul-smuggle.sha"

echo "== 成功场景（门闸放行，create/upload 各一次） =="

# K. 绝对路径清单（直接调用；post-upload 阶段允许非零收尾）
: > "$GH_CALLS"
accepted_list > "$T/accepted.sha"
out=$(run_pub "$r" v9.9.9 --upload --verify-sha "$T/accepted.sha"); rc=$?
create=$(grep -c "^gh release create" "$GH_CALLS" || true)
upload=$(grep -c "^gh release upload" "$GH_CALLS" || true)
if [[ "$out" == *"verify accepted SHAs"* && "$create" == 1 && "$upload" == 1 ]]; then
    echo "ok  [accepted-absolute] 门闸通过，create=$create upload=$upload（post-upload digest 核验不在范围，rc=$rc）"
else
    echo "FAIL[accepted-absolute] verify 信息缺失或调用数不对 create=$create upload=$upload"; fails=$((fails+1))
fi

# L. 相对路径清单（脚本须按调用者 cwd 解析）
: > "$GH_CALLS"
mkdir -p "$T/lists"; accepted_list > "$T/lists/accepted.sha"
out=$( cd "$T/lists" && PATH="$T/bin:$PATH" ANDROID_HOME="$T/sdk" timeout 90 \
       "$r/scripts/publish-release.sh" v9.9.9 --upload --verify-sha accepted.sha ) 2>&1; rc=$?
create=$(grep -c "^gh release create" "$GH_CALLS" || true)
upload=$(grep -c "^gh release upload" "$GH_CALLS" || true)
if [[ "$out" == *"verify accepted SHAs"* && "$create" == 1 && "$upload" == 1 ]]; then
    echo "ok  [accepted-relative] 相对路径与绝对路径行为一致"
else
    echo "FAIL[accepted-relative] out=$(echo "$out" | tail -2)"; fails=$((fails+1))
fi

rm -rf "$T"
if [[ "$fails" == 0 ]]; then echo "publish gates: ALL PASS"; else echo "publish gates: FAILURES"; exit 1; fi
