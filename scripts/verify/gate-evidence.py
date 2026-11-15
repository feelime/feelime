#!/usr/bin/env python3
"""段级验证证据账本：record（run-all.sh 每段跑绿后追加）+ check（发版入口判定）。

为什么存在（发版 15 分钟改造，codex 方案 2026-11-15）：旧 STATE_FILE 绑定
apk/git/tree 指纹、跨 commit 即作废——只服务中断续跑。发版决策需要的是
跨 commit 的段级证据：「段 X 最近一次 PASS 在 commit C0，C0..HEAD 的 diff
是否还让它算数」。本脚本把证据持久化到 repo 外（~/.config/feelime/
gate-evidence.jsonl），按 gate-trigger-map.json 的触发面判定有效性：

  FRESH       存在祖先 PASS 记录且 C0..C 的 diff 不触发该段失效面
  STALE       diff 触发失效面（或没有祖先 PASS）→ 发版前必须补跑
  WEEKLY_DUE  设备段距上次 PASS 超 weekly_days → 周回归逾期，发版前补跑

用法：
  gate-evidence.py record --label "5/11 base" --result PASS \
      --git-sha <sha> [--apk-sha <sha>] [--dur 202]
  gate-evidence.py check [--for-ref HEAD] [--json]
      退出码：0=READY（全部段 FRESH）；4=NOT-READY（stdout 列出须补跑段）

判定保守性（codex 复用规则）：段未在 trigger map 列出 → 任何非白名单 diff
都算触发；git 历史读不出（浅仓/漂移）→ STALE。version bump-only 的
app/build.gradle.kts diff 不触发（发版 bump 不烧证据）。
"""
import argparse
import datetime as dt
import fnmatch
import json
import os
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
LEDGER = pathlib.Path(os.environ.get(
    "FEELIME_GATE_EVIDENCE",
    os.path.expanduser("~/.config/feelime/gate-evidence.jsonl")))
TRIGGER_MAP = json.loads((HERE / "gate-trigger-map.json").read_text())

# 与 run-all.sh SEGMENTS 保持一致（check 用它枚举段；record 不校验——
# 单跑子段（前缀匹配）也允许记账，check 只认这里的完整 label）。
ALL_SEGMENTS = [
    "1/11 css-lint", "2/11 mock-suites", "3/11 jvm",
    "5/11 base", "6/11 gesture", "6b/11 voice-hold", "7/11 extended",
    "8/11 editor", "9/11 panel",
    "9a caps-flick", "9b settings-phrases", "9c keymap", "9d pool",
    "9e control-layer", "9f ctrl-switch", "9g backspace", "9h delete",
    "9i fn-voice", "9j height-card", "9k phrase-codes", "9l editor-modes",
    "9m replay-geometry", "9n feel-degrade", "9o input-prefs", "9p t9",
    "9q appearance", "9r stroke", "9s handwriting",
    "10/11 resource", "11/11 asr",
]
LOCAL_SEGMENTS = {"1/11 css-lint", "2/11 mock-suites", "3/11 jvm"}


def git(*args, cwd=REPO):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True,
                          text=True, timeout=60)


def load_ledger():
    if not LEDGER.is_file():
        return []
    out = []
    for line in LEDGER.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            print(f"warning: skipping malformed ledger line: {line[:80]}",
                  file=sys.stderr)
    return out


def cmd_record(args):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "ts": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "label": args.label,
        "result": args.result,
        "git_sha": args.git_sha or (git("rev-parse", "HEAD").stdout.strip()
                                    or "unknown"),
    }
    if args.apk_sha:
        rec["apk_sha"] = args.apk_sha
    if args.dur is not None:
        rec["dur"] = args.dur
    with LEDGER.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def is_ancestor(old, new):
    """old 是 new 的祖先（或相同）。git 不可用/sha 不在历史 → None（按 STALE 处理）。"""
    if old == new:
        return True
    r = git("merge-base", "--is-ancestor", old, new)
    if r.returncode == 0:
        return True
    if r.returncode == 1:
        return False
    return None  # 仓库异常（sha 漂移/gc 掉了）


def diff_files(old, new):
    r = git("diff", "--name-only", old, new)
    if r.returncode != 0:
        return None
    return [l for l in r.stdout.splitlines() if l]


def diff_is_version_bump_only(old, new, path):
    """指定文件的 diff 是否只动 versionCode/versionName 行。只看 +/- 内容行，
    跳过 git 元数据（diff/index/@@ 等）——首版漏了 index 行，bump 豁免被它
    误判成普通改动（2026-11-15 实测 STALE 定罪）。"""
    r = git("diff", "-U0", old, new, "--", path)
    if r.returncode != 0:
        return False
    for line in r.stdout.splitlines():
        if not line.startswith(("+", "-")) or line.startswith(("+++", "---")):
            continue
        body = line[1:].strip()
        if not body:
            continue
        if not (body.startswith("versionCode") or body.startswith("versionName")):
            return False
    return True


def match_any(path, patterns):
    for pat in patterns:
        if fnmatch.fnmatch(path, pat):
            return True
    return False


def triggers_invalidate(label, files, old_sha, new_sha):
    """files（C0..C 的 diff 列表）是否让段 label 的旧证据失效。"""
    seg_cfg = TRIGGER_MAP["segments"].get(label)
    whitelist = TRIGGER_MAP["whitelist"]
    global_triggers = TRIGGER_MAP["global_triggers"]
    bump_file = TRIGGER_MAP["version_bump_only_file"]
    for f in files:
        if match_any(f, whitelist):
            continue
        if f == bump_file:
            continue  # 该文件的触发与否由 version-bump-only 判定统一处理
        if match_any(f, global_triggers):
            return True
        # 段未配置 → 保守：任何剩余代码/资产文件都触发
        if seg_cfg is None:
            return True
        if match_any(f, seg_cfg["triggers"]):
            return True
    # bump 文件单独判定：只动版本行 → 不触发（发版 bump 不烧毁证据）
    if bump_file in files \
            and not diff_is_version_bump_only(old_sha, new_sha, bump_file):
        return True
    return False


def latest_valid_pass(label, ref, ledger):
    """找 label 在 ref 上仍有效的最近 PASS 记录；返回 (rec, why)。"""
    recs = [r for r in ledger if r.get("label") == label
            and r.get("result") == "PASS" and r.get("git_sha")]
    recs.sort(key=lambda r: r.get("ts", ""), reverse=True)
    for rec in recs:
        anc = is_ancestor(rec["git_sha"], ref)
        if anc is False:
            continue  # 记录不在目标历史里（分支合并前的旧记录）——看下一条
        if anc is None:
            return None, f"git history unreadable for {rec['git_sha'][:8]}"
        files = diff_files(rec["git_sha"], ref)
        if files is None:
            return None, "git diff unreadable"
        if not triggers_invalidate(label, files, rec["git_sha"], ref):
            return rec, None
        return None, f"diff since {rec['git_sha'][:8]} touches this segment's trigger set"
    return None, "no ancestor PASS record"


def cmd_check(args):
    ref = args.for_ref
    r = git("rev-parse", ref)
    if r.returncode != 0:
        sys.exit(f"REJECT: cannot resolve ref {ref}")
    ref_sha = r.stdout.strip()
    ledger = load_ledger()
    now = dt.datetime.now().astimezone()
    weekly = TRIGGER_MAP["weekly_days"]
    rows, must_run = [], []
    for label in ALL_SEGMENTS:
        rec, why = latest_valid_pass(label, ref_sha, ledger)
        if rec is None:
            rows.append((label, "STALE", why))
            must_run.append(label)
            continue
        age_days = None
        ts = rec.get("ts")
        if ts:
            try:
                age = now - dt.datetime.fromisoformat(ts)
                age_days = age.total_seconds() / 86400
            except ValueError:
                pass
        if label not in LOCAL_SEGMENTS and age_days is not None and age_days > weekly:
            rows.append((label, "WEEKLY_DUE",
                         f"last PASS {age_days:.1f}d ago (> {weekly}d weekly regression)"))
            must_run.append(label)
            continue
        age_txt = f"{age_days:.1f}d" if age_days is not None else "?"
        rows.append((label, "FRESH", f"pass@{rec['git_sha'][:8]} {age_txt} ago"))
    if args.json:
        print(json.dumps({
            "ref": ref_sha,
            "ready": not must_run,
            "must_run": must_run,
            "segments": [{"label": l, "status": s, "detail": d}
                         for l, s, d in rows],
        }, ensure_ascii=False, indent=2, default=str))
    else:
        for l, s, d in rows:
            print(f"{s:11s} {l:22s} {d}")
    if must_run:
        print(f"\nNOT-READY: {len(must_run)} segment(s) need a run before release:")
        print("  " + " ".join(must_run))
        sys.exit(4)
    print("\nREADY: all segments have valid evidence for release")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("record")
    pr.add_argument("--label", required=True)
    pr.add_argument("--result", default="PASS")
    pr.add_argument("--git-sha", default="")
    pr.add_argument("--apk-sha", default="")
    pr.add_argument("--dur", type=int, default=None)
    pr.set_defaults(fn=cmd_record)
    pc = sub.add_parser("check")
    pc.add_argument("--for-ref", default="HEAD")
    pc.add_argument("--json", action="store_true")
    pc.set_defaults(fn=cmd_check)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
