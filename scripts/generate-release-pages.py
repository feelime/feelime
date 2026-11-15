#!/usr/bin/env python3
"""一份版本数据（release.json）生成全部发布材料。

为什么存在（发版 15 分钟改造，codex 方案 2026-11-15）：v1.4.10 手写了
四处材料（内网 index.html、googleplay 材料页四处、GitHub notes、Play
notes），每处都有版本号/sha/日期重复抄写，漏一处就是 1.0.7「内网停旧
版没人发现」的温床。本脚本把数据源收敛为一份 JSON，渲染全部下游；
任何锚点在现有页面里找不到时 fail loud，不静默跳过。

用法：
  generate-release-pages.py --json release.json --dist <release-dist 目录> \
      [--out-notes <dir>] [--web-root <内网 feelime 目录>] [--dry-run]

release.json 结构：
  {
    "version": "1.4.10", "versionCode": 80, "keyboardVersion": "3.73.116",
    "date": "2026-11-15", "prevVersion": "1.4.9",
    "headline": "打字时工具图标插回候选行修复 · 角标一键联动上滑",
    "changes": [ {"type": "修复", "text": "...", "issue": 109}, ... ],
    "playZh": "...", "playEn": "...",          // Play 短版（<500 字符）
    "githubNotes": "..."                        // 可选，缺省从 changes 生成
  }

输出：
  1. 内网 index.html（旧页自动归档为 index-<prevVersion>.html）
  2. googleplay/index.html 四处更新（副标题/产物表行/当前版本卡/GitHub 链接）
  3. notes-zh.md + play-zh.txt + play-en.txt 到 --out-notes（或 stdout dry-run）
产物 sha256/大小从 --dist 下的 feelime-v<ver>-{thin,full}.apk 实测，不抄 JSON。
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
from datetime import date


def load_args():
    p = argparse.ArgumentParser()
    p.add_argument("--json", required=True, help="release.json 路径")
    p.add_argument("--dist", required=True, help="release-dist 目录（含两 APK）")
    p.add_argument("--out-notes", help="notes 输出目录（缺省只打印）")
    p.add_argument("--web-root", help="内网 feelime 目录（缺省跳过内网更新）")
    p.add_argument("--dry-run", action="store_true", help="全部输出只打印不落盘")
    return p.parse_args()


def artifact_info(dist: pathlib.Path, ver: str):
    out = {}
    for kind in ("thin", "full"):
        apk = dist / f"feelime-v{ver}-{kind}.apk"
        if not apk.is_file():
            sys.exit(f"REJECT: missing artifact {apk}")
        data = apk.read_bytes()
        out[kind] = {
            "sha": hashlib.sha256(data).hexdigest(),
            "mib": len(data) / 1048576,
        }
    return out


INDEX_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Feelime {version} 下载</title>
<style>
:root{{color-scheme:light dark;font:16px/1.7 system-ui,sans-serif;background:#f3f4f8;color:#20232b}}
body{{max-width:760px;margin:auto;padding:32px 20px 64px}}h1{{margin-bottom:0}}h2{{font-size:1.2rem}}
.muted{{color:#626875}}section{{background:#fff;padding:20px;margin:20px 0;border-radius:14px}}
a{{color:#147345}}.download{{display:block;background:#147345;color:white;padding:14px;text-align:center;border-radius:10px;text-decoration:none;font-weight:650}}
code{{overflow-wrap:anywhere;font-size:.85rem}}li{{margin:8px 0}}
@media(prefers-color-scheme:dark){{:root{{background:#181a20;color:#eceef2}}section{{background:#242730}}.muted{{color:#b7bdca}}a{{color:#87d8b0}}.download{{color:white}}}}
</style>
<h1>Feelime 离线输入法</h1>
<p>{version} · {headline}</p>
<p class="muted">{version} · 键盘 {keyboardVersion} · {date} · <a href="index-{prevVersion}.html">上一版（{prevVersion}）</a> · <a href="https://github.com/feelime/feelime/releases/tag/v{version}">GitHub Release</a></p>
<section>
<a class="download" href="feelime-v{version}-full.apk" download>下载完整安装包 · {full_mib} MiB</a>
<p>完整包内置语音模型，安装后即可离线使用。正式签名，旧版用户覆盖安装即可，保留设置、常用语、用户词库与输入统计。</p>
<p class="muted">SHA-256<br><code>{full_sha}</code></p>
<p><a class="download" style="background:#3a6ea5" href="feelime-v{version}-thin.apk" download>下载精简版（无语音） · {thin_mib} MiB</a></p>
<p>精简版不含内置语音模型，拼音 / 双拼 / 九宫格 T9 / 候选 / 联想全部功能不变；需要语音时在设置的「语音识别」页下载模型，或改装完整版（两者签名一致，可互相覆盖安装）。</p>
<p class="muted">精简版 SHA-256<br><code>{thin_sha}</code></p>
</section>
<section>
<h2>这版的变化</h2>
<ul>
{change_items}
</ul>
</section>
"""


def change_item_html(ch):
    issue = ""
    if ch.get("issue"):
        issue = (
            f'（<a href="https://github.com/feelime/feelime/issues/{ch["issue"]}">'
            f'#{ch["issue"]}</a>）'
        )
    return f"<li><strong>{ch['type']}</strong>：{ch['text']}{issue}</li>"


def render_index(meta, art):
    return INDEX_TEMPLATE.format(
        version=meta["version"],
        headline=meta["headline"],
        keyboardVersion=meta["keyboardVersion"],
        date=meta["date"],
        prevVersion=meta["prevVersion"],
        full_mib=round(art["full"]["mib"], 1),
        thin_mib=round(art["thin"]["mib"], 1),
        full_sha=art["full"]["sha"],
        thin_sha=art["thin"]["sha"],
        change_items="\n".join(change_item_html(c) for c in meta["changes"]),
    )


def github_notes(meta):
    if meta.get("githubNotes"):
        return meta["githubNotes"]
    feats = [c for c in meta["changes"] if c["type"] == "新功能"]
    fixes = [c for c in meta["changes"] if c["type"] == "修复"]
    parts = []
    if feats:
        parts.append("## 新功能\n\n" + "\n".join(f"- **{c['text']}**" for c in feats))
    if fixes:
        parts.append("## 修复\n\n" + "\n".join(f"- **{c['text']}**" for c in fixes))
    parts.append(f"\n键盘热更版本 {meta['keyboardVersion']}。")
    return "\n\n".join(parts)


def sub_or_die(text, pattern, repl, count, what):
    new, n = re.subn(pattern, repl, text, count=count)
    if n != count:
        sys.exit(f"REJECT: googleplay 材料页锚点未命中（{what}，期望 {count} 处，实际 {n}）——页面结构变了，先人工核对")
    return new


def update_googleplay(html, meta, art):
    v, vc, kv = meta["version"], meta["versionCode"], meta["keyboardVersion"]
    # 1. 副标题：alpha 最新行整行替换
    html = sub_or_die(
        html,
        r'<p class="sub">alpha 最新 [^<]*</p>',
        f'<p class="sub">alpha 最新 {v}（versionCode {vc}，{meta["date"]}） · production 在架 1.4.5（75，2026-10-23 上架） · 全部文件位于 ~/share/feelime/googleplay/ · 截图与图文素材为 1.0.2 时期制作，仍然可用</p>',
        1, "副标题 alpha 行")
    # 2. 产物表：在上一版行后插入本版行
    prev_row = re.compile(
        rf'(<tr><td>{re.escape(meta["prevVersion"])}</td><td>\d+</td><td>[\d.]+</td><td>\d{{4}}-\d{{2}}-\d{{2}}</td><td>.*?</tr>)')
    row = (f'<tr><td>{v}</td><td>{vc}</td><td>{kv}</td><td>{meta["date"]}</td>'
           f'<td><a href="feelime-play-release-{v}.aab">AAB</a></td></tr>')
    html = sub_or_die(html, prev_row, r"\1" + row, 1, "产物表上一版行")
    # 3. Play 当前版本卡整块替换
    summary = meta.get("materialSummary", meta["headline"])
    card = (
        f'<tr><th>Play 当前版本</th><td><span class="file">feelime-play-release-{v}.aab</span><br>'
        f'versionCode {vc} · **alpha 在架**（{meta["date"]}） · production 在架 1.4.5（75，2026-10-23 上架；两轮 closed testing 12人×28天 后获准）<br>'
        f'<span class="muted" style="color:#9aa0b4">{meta["date"]} · {summary}</span></td></tr>')
    html = sub_or_die(html, r'<tr><th>Play 当前版本</th>.*?</tr>', card, 1, "Play 当前版本卡")
    # 4. GitHub release 链接行首插入
    link = f'<a style="color:#09D967" href="https://github.com/feelime/feelime/releases/tag/v{v}">v{v}</a> · '
    html = sub_or_die(html, r'<tr><th>GitHub release</th><td>', '<tr><th>GitHub release</th><td>' + link, 1, "GitHub 链接行")
    return html


def write(path: pathlib.Path, content: str, dry: bool):
    if dry:
        print(f"===== {path} =====")
        print(content[:2000] + ("…[truncated]" if len(content) > 2000 else ""))
        return
    path.write_text(content)
    print(f"wrote {path}")


def main():
    args = load_args()
    meta = json.loads(pathlib.Path(args.json).read_text())
    ver = meta["version"]
    if meta.get("date") is None:
        meta["date"] = date.today().isoformat()
    art = artifact_info(pathlib.Path(args.dist), ver)

    notes_dir = pathlib.Path(args.out_notes) if args.out_notes else None
    if notes_dir and not args.dry_run:
        notes_dir.mkdir(parents=True, exist_ok=True)
    for name, content in [
        ("notes-zh.md", github_notes(meta)),
        ("play-zh.txt", meta["playZh"]),
        ("play-en.txt", meta["playEn"]),
    ]:
        target = notes_dir / name if notes_dir else pathlib.Path(f"/dev/stdout-dry/{name}")
        if notes_dir or args.dry_run:
            write(target, content, args.dry_run)

    if args.web_root:
        web = pathlib.Path(args.web_root)
        index = web / "index.html"
        if not index.is_file():
            sys.exit(f"REJECT: {index} not found")
        # 归档旧页（幂等：归档名已存在则跳过归档，新页照写）
        archive = web / f"index-{meta['prevVersion']}.html"
        if not archive.is_file() and not args.dry_run:
            archive.write_text(index.read_text())
            print(f"archived old index -> {archive}")
        write(index, render_index(meta, art), args.dry_run)

        gp = web / "googleplay" / "index.html"
        if not gp.is_file():
            sys.exit(f"REJECT: {gp} not found")
        write(gp, update_googleplay(gp.read_text(), meta, art), args.dry_run)

    print("done.")


if __name__ == "__main__":
    main()
