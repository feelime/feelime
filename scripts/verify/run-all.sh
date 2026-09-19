#!/usr/bin/env bash
# Full verification gate (docs/testing/verification.md). All environment-specific
# values come from required environment variables — no real
# hostnames, serials or paths are stored in the repo:
#   FEELIME_ADB_SERIAL  adb serial of the connected test device
#   FEELIME_VERIFY_APK  exact main APK already installed on the test device
#   FEELIME_ASR_FIXTURE frozen 16 kHz WAV used by the ASR gate
#   FEELIME_BUILDER_SSH ssh target of the build host (optional; JVM suites only)
#   FEELIME_AAPT2       real AAPT2 executable (optional local Gradle override)
#
# 用法（2026-09 评审落地：状态隔离 + 断点续跑 + 敏感度分层）:
#   run-all.sh                      全量 gate（默认；开头做一次基线复位）
#   run-all.sh --list               列出全部段与 profiles
#   run-all.sh 9n 9j                只跑指定段（label 前缀匹配，含本地段）
#   run-all.sh --from 9g            从某段跑到尾
#   run-all.sh --resume             按状态文件跳过已绿段（qemu 死亡/中断后续跑）
#   run-all.sh --profile quick      按 profile 选段（quick/keyboard-js/native-engine/
#                                   kotlin-service/voice/resources/full）
#   FEELIME_GATE_RETRIES            单段额外整跑重试次数（默认 2）
#   FEELIME_GATE_NO_RESET=1         跳过开头基线复位（调试用；不保证套件间隔离）
#   FEELIME_EMU_LOG                 模拟器日志路径（可选；开启图形通道病态检测，
#                                   SwiftShader 死亡前会刷 bad color buffer）
#   FEELIME_EMU_RESTART_CMD         重启模拟器的命令（可选；配合上一项在段边界
#                                   计划内重启，命令需自行后台化）
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

: "${FEELIME_ADB_SERIAL:?FEELIME_ADB_SERIAL is required (adb serial of the test device)}"
: "${FEELIME_VERIFY_APK:?FEELIME_VERIFY_APK is required (exact installed APK)}"
: "${FEELIME_ASR_FIXTURE:?FEELIME_ASR_FIXTURE is required (frozen ASR WAV)}"

# debug 构建包名带 .dev 后缀（与正式包共存）：FEELIME_PKG 显式指定 >
# 设备装了 .dev 用 .dev > 正式包名（与 device_verify._resolve_pkg 同规）。
FEELIME_PKG_RESOLVED="${FEELIME_PKG:-}"
if [ -z "$FEELIME_PKG_RESOLVED" ]; then
    if adb -s "$FEELIME_ADB_SERIAL" shell pm list packages 2>/dev/null \
        | grep -q '^package:com\.feelime\.ime\.dev$'; then
        FEELIME_PKG_RESOLVED=com.feelime.ime.dev
    else
        FEELIME_PKG_RESOLVED=com.feelime.ime
    fi
fi
PKG="$FEELIME_PKG_RESOLVED"
# shell `ime` 按 flattenToShortString 精确匹配（同 device_verify.IME_SVC）
if [ "$PKG" = com.feelime.ime ]; then
    IME_SVC="$PKG/.FeelimeService"
else
    IME_SVC="$PKG/com.feelime.ime.FeelimeService"
fi

# ---- 段定义（label|kind）。kind: local | device | asr ----
SEGMENTS=(
    "1/11 css-lint|local"
    "2/11 mock-suites|local"
    "3/11 jvm|local"
    "5/11 base|device"
    "6/11 gesture|device"
    "6b/11 voice-hold|device"
    "7/11 extended|device"
    "8/11 editor|device"
    "9/11 panel|device"
    "9a caps-flick|device"
    "9b settings-phrases|device"
    "9c keymap|device"
    "9d pool|device"
    "9e control-layer|device"
    "9f ctrl-switch|device"
    "9g backspace|device"
    "9h delete|device"
    "9i fn-voice|device"
    "9j height-card|device"
    "9k phrase-codes|device"
    "9l editor-modes|device"
    "9m replay-geometry|device"
    "9n feel-degrade|device"
    "9o input-prefs|device"
    "9p t9|device"
    "9q appearance|device"
    "10/11 resource|device"
    "11/11 asr|asr"
)

# 敏感度 profiles：按改动面选段（评审 P0-3「mock 优先在批次执行层失守」——
# 普通批次的设备验证应该是 ~30min 的 L3 冒烟，不是 ~2h 的全量）。
PROFILES=(
    "quick|5/11 base 7/11 extended 9n feel-degrade 9o input-prefs 9/11 panel 9j height-card"
    "input|5/11 base 9n feel-degrade 9o input-prefs 9p t9 9q appearance"
    "keyboard-js|5/11 base 7/11 extended 9a caps-flick 9c keymap 9d pool"
    "native-engine|5/11 base 7/11 extended 9g backspace 9h delete"
    "kotlin-service|5/11 base 8/11 editor 9n feel-degrade 10/11 resource"
    "voice|6/11 gesture 6b/11 voice-hold 9i fn-voice 11/11 asr"
    "resources|10/11 resource"
)

usage() {
    # 头注释块到第一个非注释行为止（别把源码当帮助文本打印出去）
    awk 'NR > 1 && !/^#/ { exit } NR > 1 { sub(/^# ?/, ""); print }' "$0"
    exit 2
}

LIST_ONLY=0; RESUME=0; FROM_SEG=""; PROFILE="full"; LOCK_HELD=0; POSITIONAL=()
ORIG_ARGS=("$@")   # 解析循环会 shift 光 $@；flock 重入要带原始参数
while [[ $# -gt 0 ]]; do
    case "$1" in
        --list) LIST_ONLY=1 ;;
        --resume) RESUME=1 ;;
        --gate-lock-held) LOCK_HELD=1 ;;   # 内部标志：由下面的 flock 包装传入
        --from) [[ $# -ge 2 ]] || { echo "--from needs a segment label" >&2; usage; }; FROM_SEG="$2"; shift ;;
        --profile) [[ $# -ge 2 ]] || { echo "--profile needs a name" >&2; usage; }; PROFILE="$2"; shift ;;
        -h|--help) usage ;;
        -*) echo "unknown flag: $1" >&2; usage ;;
        *) POSITIONAL+=("$1") ;;
    esac
    shift
done

if [[ "$LIST_ONLY" == "1" ]]; then
    echo "segments:"
    printf '  %s\n' "${SEGMENTS[@]%%|*}"
    echo "profiles:"
    printf '  %s\n' "${PROFILES[@]%%|*}"
    exit 0
fi

# 并发锁：一台设备同时只允许一个 gate/驱动（2026-09-11 reg1 教训：两个驱动
# 并发打同一台 AVD，全部症状都是打架伪象，整跑作废）。锁由 flock 包装进程
# 持有，不能放在 gate 自己的 fd 上——fd 会被套件子进程继承，任何长命子进程
# （gradle daemon、ssh 控制连接）都会把锁拖过 gate 生命周期，之后这台设备
# 的所有 gate 永远拿不到锁。
GATE_LOCK="/tmp/feelime-gate-${FEELIME_ADB_SERIAL}.lock"
if [[ "$LOCK_HELD" != "1" ]]; then
    exec 9>"$GATE_LOCK"
    flock -n 9 || { echo "another gate/driver holds $GATE_LOCK - refusing to interleave" >&2; exit 3; }
    exec 9>&-
    # bash "$0" 中转：脚本未必带可执行位（`bash run-all.sh` 是标准用法）
    # --close：锁 fd 只留在 flock 父进程手里。不带它，gate 派生的一切
    # 后代（含 FEELIME_EMU_RESTART_CMD 重启出的模拟器）都会继承 fd，
    # gate 退出后锁悬在活体进程上，下一次 gate 被拒之门外（2026-09-12）。
    exec flock --close -n "$GATE_LOCK" bash "$0" --gate-lock-held "${ORIG_ARGS[@]}"
fi

selected_names=()
if [[ ${#POSITIONAL[@]} -gt 0 ]]; then
    selected_names=("${POSITIONAL[@]}")
elif [[ "$PROFILE" != "full" ]]; then
    profile_line=""
    for entry in "${PROFILES[@]}"; do
        [[ "${entry%%|*}" == "$PROFILE" ]] && profile_line="${entry#*|}"
    done
    [[ -n "$profile_line" ]] || { echo "unknown profile: $PROFILE" >&2; usage; }
    read -ra selected_names <<<"$profile_line"
fi

# 把选择条件折算成"每个段是否启用"：--from/--profile 折算出的 selected_names
# 与位置参数走同一条 label 前缀匹配（如 `9n`、`9g`）。
segment_enabled() {
    local label="$1"
    if [[ ${#selected_names[@]} -eq 0 ]]; then return 0; fi
    for want in "${selected_names[@]}"; do
        [[ "$label" == "$want" || "$label" == "$want"* ]] && return 0
    done
    return 1
}

# 未知段名必须响亮报错：静默跑 0 段然后 GATE_OK，等于「绿灯但什么都没测」。
if [[ ${#POSITIONAL[@]} -gt 0 ]]; then
    for want in "${POSITIONAL[@]}"; do
        hit=0
        for entry in "${SEGMENTS[@]}"; do
            label="${entry%%|*}"
            [[ "$label" == "$want" || "$label" == "$want"* ]] && { hit=1; break; }
        done
        [[ "$hit" == "1" ]] || { echo "unknown segment: $want" >&2; usage; }
    done
fi
if [[ -n "$FROM_SEG" && ( ${#POSITIONAL[@]} -gt 0 || "$PROFILE" != "full" ) ]]; then
    echo "--from cannot be combined with positional segments or --profile" >&2
    usage
fi

if [[ -n "$FROM_SEG" ]]; then
    selected_names=()
    seen_from=0
    filtered=()
    for entry in "${SEGMENTS[@]}"; do
        label="${entry%%|*}"
        [[ "$label" == "$FROM_SEG" || "$label" == "$FROM_SEG"* ]] && seen_from=1
        if [[ "$seen_from" == "1" ]]; then filtered+=("$label"); fi
    done
    [[ "$seen_from" == "1" ]] || { echo "unknown --from segment: $FROM_SEG" >&2; usage; }
    selected_names=("${filtered[@]}")
fi

# 断点续跑状态：每个段绿了就记一行；--resume 时跳过。换 APK/换 commit/
# 改工作区（套件代码变了，旧绿段不再算数）后状态文件自动作废。
STATE_FILE="/tmp/feelime-gate-state-${FEELIME_ADB_SERIAL}.json"
[[ -f "$FEELIME_VERIFY_APK" ]] || { echo "verification APK is missing: $FEELIME_VERIFY_APK" >&2; exit 2; }
apk_sha=$(sha256sum "$FEELIME_VERIFY_APK" | awk '{print $1}')
git_sha=$(git -C "$HERE/../.." rev-parse HEAD 2>/dev/null || echo "unknown")
# git 瞬时失败（index.lock 竞争等）不能炸 gate：set -e 下管道 128 会无声退出
tree_sha=$( { git -C "$HERE/../.." status --porcelain 2>/dev/null || echo not-a-repo; } \
    | sha256sum | awk '{print $1}' | cut -c1-12)
run_fingerprint="$apk_sha $git_sha $tree_sha"

state_load() {
    if [[ "$RESUME" == "1" && -f "$STATE_FILE" ]] \
        && grep -qF "\"fingerprint\": \"$run_fingerprint\"" "$STATE_FILE"; then
        return 0
    fi
    echo "{\"fingerprint\": \"$run_fingerprint\", \"done\": []}" > "$STATE_FILE"
    return 1
}

state_done() {
    [[ -f "$STATE_FILE" ]] && grep -qF "\"$1\"" "$STATE_FILE"
}

state_mark() {
    # 文件被外部清掉（别的主机进程打扫 /tmp、或另一个 agent 误删）时降级重建
    # 而不是炸掉整跑：段本身已经绿了，丢的只是之前的记录（stderr 明说）。
    python3 - "$STATE_FILE" "$1" "$run_fingerprint" <<'PY'
import json, os, sys
path, seg, fingerprint = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    data = json.load(open(path))
    if data.get("fingerprint") != fingerprint:
        raise ValueError("fingerprint mismatch")
except Exception:
    print(f"state file {path} missing/foreign - recreated "
          f"(earlier segment marks lost)", file=sys.stderr)
    data = {"fingerprint": fingerprint, "done": []}
if seg not in data["done"]:
    data["done"].append(seg)
tmppath = path + ".tmp"
json.dump(data, open(tmppath, "w"))
os.replace(tmppath, path)
PY
}

had_resume_state=$( [[ -f "$STATE_FILE" ]] && grep -cF "\"fingerprint\": \"$run_fingerprint\"" "$STATE_FILE" || true )
state_load || true
if [[ "$RESUME" == "1" && "$had_resume_state" == "0" ]]; then
    echo "--resume: no matching state (fingerprint changed or first run); starting fresh"
fi

local_apk_sha="$apk_sha"
device_apk_path=$(adb -s "$FEELIME_ADB_SERIAL" shell pm path "$PKG" | sed -n 's/^package://p' | tr -d '\r' | head -1)
[[ -n "$device_apk_path" ]] || { echo "Feelime is not installed on the target" >&2; exit 2; }
device_apk_sha=$(adb -s "$FEELIME_ADB_SERIAL" shell sha256sum "$device_apk_path" | awk '{print $1}')
[[ "$local_apk_sha" == "$device_apk_sha" ]] || {
    echo "installed APK does not match FEELIME_VERIFY_APK" >&2
    exit 2
}
echo "installed APK identity verified: $local_apk_sha"

GRADLE_AAPT_ARGS=()
if [[ -n "${FEELIME_AAPT2:-}" ]]; then
    GRADLE_AAPT_ARGS+=("-Pandroid.aapt2FromMavenOverride=$FEELIME_AAPT2")
fi

# Device suites flake on transient emulator/host state (a11y dumps, system
# ANR dialogs, screenshot hiccups, cross-suite panel residue) - observed as
# whole-suite failures that pass on an immediate standalone rerun. Re-run a
# failed suite whole, at most FEELIME_GATE_RETRIES extra times (default 2).
# A dead emulator must fail loudly instead of burning retries, and every
# retry that turned a step green is reported in the summary so a green gate
# stays honest.
DEVICE_SUITE_RETRIES=${FEELIME_GATE_RETRIES:-2}
RETRIED_STEPS=()

# A freshly (re)booted emulator can sit behind a SystemUI ANR dialog, which
# blocks the fixtures' editor focus ("test field not found" in every suite).
# Dismiss it deterministically instead of burning suite retries on it.
settle_device() {
    local i dump btn bounds
    for i in $(seq 1 60); do
        [[ "$(adb -s "$FEELIME_ADB_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '[:space:]')" == "1" ]] && break
        sleep 5
    done
    adb -s "$FEELIME_ADB_SERIAL" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
    for i in 1 2 3 4 5; do
        dump=$(adb -s "$FEELIME_ADB_SERIAL" exec-out uiautomator dump /dev/tty 2>/dev/null || true)
        btn=$(grep -oE '<node [^>]*text="(Wait|等待)"[^>]*/>' <<<"$dump" | head -1 || true)
        [[ -z "$btn" ]] && return 0
        bounds=$(sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p' <<<"$btn")
        [[ -z "$bounds" ]] && return 0
        read -r x1 y1 x2 y2 <<<"$bounds" || true
        echo "settle: dismissing an ANR dialog (tap Wait)"
        adb -s "$FEELIME_ADB_SERIAL" shell input tap $((( x1 + x2 ) / 2)) $((( y1 + y2 ) / 2))
        sleep 6
    done
}

# 基线复位（每个 gate 一次，2026-09-11 评审 P0-1）：设备持久状态是今天
# 最大的假失败源（feel_hold_ms=600 残留把弹层用例全灭、height pref 让
# 候选池假回归、语音浮层泄漏污染下一个套件）。pm clear 一次性抹掉
# prefs/localStorage/热更 inbox/用户词库，之后重授权、重选 IME、关旋转。
reset_device() {
    echo "reset: pm clear + regrant + IME re-select (baseline restore)"
    # 关键步骤失败要带语境退出，不能让 set -e 在这里无声整跑退出
    # （pm clear 也会抹掉 files/ 下下载/导入的模型：全量 APK 走 assets 内置
    # 模型不受影响；thin 构建在 reset 后语音段会因无模型挂——用全量 APK 是
    # 本 gate 的前置）。
    adb -s "$FEELIME_ADB_SERIAL" shell pm clear "$PKG" >/dev/null \
        || { echo "reset: pm clear failed - is $FEELIME_ADB_SERIAL alive?" >&2; exit 2; }
    adb -s "$FEELIME_ADB_SERIAL" shell pm grant "$PKG" android.permission.RECORD_AUDIO >/dev/null 2>&1 || true
    # pm clear 后 IME 需要重新 enable/set；disabled 列表先查（记忆：直接
    # ime enable 可能 unrecognized）。
    adb -s "$FEELIME_ADB_SERIAL" shell ime enable "$IME_SVC" >/dev/null 2>&1 || true
    adb -s "$FEELIME_ADB_SERIAL" shell ime set "$IME_SVC" >/dev/null \
        || { echo "reset: ime set failed - the keyboard cannot come up" >&2; exit 2; }
    adb -s "$FEELIME_ADB_SERIAL" shell settings put global hide_error_dialogs 1 >/dev/null
    adb -s "$FEELIME_ADB_SERIAL" shell settings put system accelerometer_rotation 0 >/dev/null
    adb -s "$FEELIME_ADB_SERIAL" shell settings put system user_rotation 0 >/dev/null
    adb -s "$FEELIME_ADB_SERIAL" shell svc power stayon true >/dev/null 2>&1 || true
}

# 套件间轻量清扫：杀进程 + 清全部 prefs（app 实际有 9 个 prefs 文件：
# keyboard/clipboard/asr/engine/custom_keys/ui/favorites/webview_stores/
# keyboard_update——列清单必漏，gate 开头有 pm clear 兜底，段间可以全清）。
# 各套件自行 seed 自己需要的状态；跨套件依赖即污染（候选池套件注释里的
# 假回归就是这类）。
sweep_device() {
    # SIGKILL 前先优雅收起 IME：WebView 靠 destroy 才提交 localStorage，
    # 硬杀留 torn tail 会把 leveldb 恢复截断点之后的写入永久判丢失
    # （2026-09-12 9m replay-geometry 假失败实录）。收不起来就按原样硬杀。
    if adb -s "$FEELIME_ADB_SERIAL" shell dumpsys input_method 2>/dev/null |
        grep -q "mInputShown=true"; then
        adb -s "$FEELIME_ADB_SERIAL" shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
        sleep 1
    fi
    adb -s "$FEELIME_ADB_SERIAL" shell am force-stop "$PKG" >/dev/null 2>&1 || true
    adb -s "$FEELIME_ADB_SERIAL" shell \
        "run-as "$PKG" sh -c 'rm -f shared_prefs/*.xml'" \
        >/dev/null 2>&1 || true
    adb -s "$FEELIME_ADB_SERIAL" shell settings put global hide_error_dialogs 1 >/dev/null 2>&1 || true
}

# 模拟器图形通道病态检测（2026-09-12 qemu 定位结论）：SwiftShader 死亡前
# 几十分钟持续刷 "bad color buffer handle"，且病态期 WebView 渲染已失败
# （套件假失败的最大来源：settings 打不开/几何读不到都不是产品回归）。
# FEELIME_EMU_LOG 指向模拟器日志时，每个设备段后检查计数；涨了就响亮
# 警告；再配 FEELIME_EMU_RESTART_CMD 时在段边界计划内重启（比死在段中
# 间 + --resume 便宜得多）。
EMU_ERR_COUNT=0
graphics_health_check() {
    [[ -n "${FEELIME_EMU_LOG:-}" && -f "$FEELIME_EMU_LOG" ]] || return 0
    local n
    n=$(grep -c "bad color buffer" "$FEELIME_EMU_LOG" 2>/dev/null) || n=0
    if [[ "$n" -gt "$EMU_ERR_COUNT" ]]; then
        echo "WARNING: emulator graphics channel is degrading (bad-color-buffer ${EMU_ERR_COUNT} -> ${n})." >&2
        echo "         Suite failures from here on are suspect: WebView rendering breaks before the emulator dies." >&2
        if [[ -n "${FEELIME_EMU_RESTART_CMD:-}" ]]; then
            echo "         restarting the emulator at this segment boundary..." >&2
            adb -s "$FEELIME_ADB_SERIAL" emu kill >/dev/null 2>&1 || true
            sleep 4
            bash -c "$FEELIME_EMU_RESTART_CMD" \
                || { echo "emulator restart command failed" >&2; exit 2; }
            settle_device
            echo "         emulator restarted (graphics state fresh)."
        fi
    fi
    EMU_ERR_COUNT=$n
}

run_suite() {
    local label="$1"
    shift
    local attempt
    for attempt in 0 $(seq 1 "$DEVICE_SUITE_RETRIES"); do
        if [[ "$attempt" != "0" ]]; then
            if ! adb -s "$FEELIME_ADB_SERIAL" get-state >/dev/null 2>&1; then
                echo "RETRY-ABORT [$label]: device $FEELIME_ADB_SERIAL is gone (emulator died?); restart it, then rerun with --resume" >&2
                return 1
            fi
            echo "RETRY $attempt/$DEVICE_SUITE_RETRIES [$label]: previous attempt failed - rerunning"
        fi
        settle_device
        if "$@"; then
            if [[ "$attempt" != "0" ]]; then
                RETRIED_STEPS+=("$label (passed on retry $attempt)")
            fi
            return 0
        fi
        sleep 5
    done
    echo "STILL FAILING after $DEVICE_SUITE_RETRIES retries [$label]" >&2
    return 1
}

print_retry_summary() {
    if [[ "${#RETRIED_STEPS[@]}" -gt 0 ]]; then
        echo "gate is green, but ${#RETRIED_STEPS[@]} step(s) only passed on retry:"
        printf '  - %s\n' "${RETRIED_STEPS[@]}"
    fi
}

run_local_css() {
    node "$HERE/css_lint.js"
    python3 "$HERE/../generate-keyboard-data.py" --check
    python3 "$HERE/../generate-phrase-initials.py" --check
}

run_local_mock() {
    node "$HERE/mock_bridge_tests.js"
    node "$HERE/mock_settings_tests.js"
    bash "$HERE/mock_baseline_tests.sh"
}

run_local_jvm() {
    if [[ -n "${FEELIME_BUILDER_SSH:-}" ]]; then
        BUILDER_DIR="${FEELIME_BUILDER_DIR:-~/code/feelime}"
        ssh "$FEELIME_BUILDER_SSH" "cd $BUILDER_DIR && ANDROID_HOME=\${FEELIME_BUILDER_SDK:-/opt/android-sdk} ./gradlew -q testDebugUnitTest" >/dev/null
        ssh "$FEELIME_BUILDER_SSH" "cd $BUILDER_DIR && ANDROID_HOME=\${FEELIME_BUILDER_SDK:-/opt/android-sdk} ./gradlew -q --settings-file \"\$PWD/spikes/native-engine-smoke/settings.gradle.kts\" --project-dir \"\$PWD/spikes/native-engine-smoke\" testDebugUnitTest" >/dev/null
    else
        (cd "$HERE/../.." && ./gradlew -q "${GRADLE_AAPT_ARGS[@]}" testDebugUnitTest)
        (cd "$HERE/../.." && ./gradlew -q "${GRADLE_AAPT_ARGS[@]}" \
            --settings-file "$PWD/spikes/native-engine-smoke/settings.gradle.kts" \
            --project-dir "$PWD/spikes/native-engine-smoke" testDebugUnitTest)
    fi
    echo "JVM suites green"
}

run_asr() {
    # 性能门只在真机上成立（baseline 是 arm64 物理设备录的，AVD 上不可
    # 复现）。AVD 日常门跑单次正确性 smoke；发布前在真机跑完整 5 跑。
    if [[ "$(adb -s "$FEELIME_ADB_SERIAL" shell getprop ro.kernel.qemu | tr -d '[:space:]')" == "1" ]]; then
        echo "AVD detected: single ASR correctness smoke (perf gate is physical-device only)."
        ANDROID_SERIAL="$FEELIME_ADB_SERIAL" bash "$HERE/../research/run-asr-regression.sh" \
            --runs 1 --fixture "$FEELIME_ASR_FIXTURE" --waive-perf-gate
    else
        ANDROID_SERIAL="$FEELIME_ADB_SERIAL" bash "$HERE/../research/run-asr-regression.sh" \
            --runs 5 --fixture "$FEELIME_ASR_FIXTURE"
    fi
}

# ---- 遍历段（set -e：段重试耗尽即整跑退出，退出码非零；修复后 --resume 续跑）----
device_reset_pending=1
skipped=0
executed=0

for entry in "${SEGMENTS[@]}"; do
    label="${entry%%|*}"
    kind="${entry#*|}"
    segment_enabled "$label" || continue
    if state_done "$label"; then
        echo "== $label: already green in state file, skipping (--resume) =="
        skipped=$((skipped + 1))
        continue
    fi
    case "$kind" in
        local)
            echo "== $label =="
            case "$label" in
                "1/11 css-lint") run_local_css ;;
                "2/11 mock-suites") run_local_mock ;;
                "3/11 jvm") run_local_jvm ;;
            esac
            ;;
        device)
            if [[ "$device_reset_pending" == "1" && "${FEELIME_GATE_NO_RESET:-0}" != "1" ]]; then
                settle_device   # 冷启 AVD 可能卡在 SystemUI ANR 弹窗后面，先排掉
                reset_device
                device_reset_pending=0
            fi
            echo "== $label =="
            case "$label" in
                "5/11 base") run_suite "$label" python3 "$HERE/device_verify.py" ;;
                "6/11 gesture") run_suite "$label" python3 "$HERE/device_gesture_verify.py" ;;
                "6b/11 voice-hold") run_suite "$label" python3 "$HERE/device_voice_hold_verify.py" ;;
                "7/11 extended") run_suite "$label" python3 "$HERE/device_extended_verify.py" ;;
                "8/11 editor") run_suite "$label" python3 "$HERE/device_editor_verify.py" ;;
                "9/11 panel") run_suite "$label" python3 "$HERE/device_panel_verify.py" ;;
                "9a caps-flick") run_suite "$label" python3 "$HERE/device_caps_flick_verify.py" ;;
                "9b settings-phrases") run_suite "$label" python3 "$HERE/device_settings_phrases_verify.py" ;;
                "9c keymap") run_suite "$label" python3 "$HERE/device_keymap_verify.py" ;;
                "9d pool") run_suite "$label" python3 "$HERE/device_candidate_pool_verify.py" ;;
                "9e control-layer") run_suite "$label" python3 "$HERE/device_control_layer_verify.py" ;;
                "9f ctrl-switch") run_suite "$label" python3 "$HERE/device_control_switch_verify.py" ;;
                "9g backspace") run_suite "$label" python3 "$HERE/device_backspace_delete_verify.py" ;;
                "9h delete") run_suite "$label" python3 "$HERE/device_candidate_delete_verify.py" ;;
                "9i fn-voice") run_suite "$label" python3 "$HERE/device_fn_custom_verify.py" ;;
                "9j height-card") run_suite "$label" python3 "$HERE/device_height_card_verify.py" ;;
                "9k phrase-codes") run_suite "$label" python3 "$HERE/device_phrase_codes_verify.py" ;;
                "9l editor-modes") run_suite "$label" python3 "$HERE/device_editor_modes_verify.py" ;;
                "9m replay-geometry") run_suite "$label" python3 "$HERE/device_replay_geometry_verify.py" ;;
                "9n feel-degrade") run_suite "$label" python3 "$HERE/device_feel_degrade_verify.py" ;;
                "9o input-prefs") run_suite "$label" python3 "$HERE/device_input_prefs_verify.py" ;;
                "9p t9") run_suite "$label" python3 "$HERE/device_t9_verify.py" ;;
                "9q appearance") run_suite "$label" python3 "$HERE/device_appearance_verify.py" ;;
                "10/11 resource") run_suite "$label" python3 "$HERE/device_resource_verify.py" --apk "$FEELIME_VERIFY_APK" ;;
                *) echo "unknown device segment: $label" >&2; exit 2 ;;
            esac
            sweep_device
            graphics_health_check
            ;;
        asr)
            echo "== $label =="
            run_asr
            ;;
    esac
    state_mark "$label"
    executed=$((executed + 1))
done

# 双保险：有选择条件却一个段都没跑（解析期校验已挡住绝大多数路径），
# 宁可红也不能静默绿灯。
if [[ ${#selected_names[@]} -gt 0 && "$executed" -eq 0 && "$skipped" -eq 0 ]]; then
    echo "no segment ran for the given selection - refusing to report green" >&2
    exit 2
fi

print_retry_summary
if [[ "$skipped" -gt 0 ]]; then
    echo "$skipped segment(s) skipped via --resume state"
fi
echo "GATE_OK"

# ---- 专项套件（不在全量序列里，按需单独跑；依赖额外宿主/探针 APK 或音频）----
# device_cursor_host_verify.py   光标滑动宿主探针（需安装 cursor-host APK）
# device_models_verify.py        模型导入/下载面（需 models 探针 APK）
# device_punctuation_verify.py   标点探针（punctuation-probe 宿主，见其 build.sh）
# device_settings_entry_verify.py 系统入口/设置专项（依赖 device_model_import_verify）
# device_voice_stop_verify.py    生产语音停/取消专项（真实编辑器+触摸）
