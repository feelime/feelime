#!/usr/bin/env bash
# #72 候选分页不变量探针 runner（三轮扩为矩阵）。
#
# 模式：
#   none      — 键间零浏览流量（对照基线）
#   iterator  — 新壳：candidate_list_from_index 只读取页（必须与 none 逐帧一致）
#   pages     — 旧壳模拟：每键 PAGE_DOWN x2（收起条预加载的历史行为；带
#               fallback 的库在此模式下允许与 none 不同——此组合不随新壳出货）
# 矩阵：三串 x 两种词库（干净 / ASCII 学习词 fixture）。ASCII fixture 用
# custom_phrase.txt 注入 buy/buys（user_table 精确全串候选排首位、spans 为
# 空——2026-10-27 AVD 回归的定罪形态），复现 hint 取材缺陷并断言 fallback
# 修复（buysv 帧 bu ys v、终帧 不用找房东）。
#
# 用法: scripts/research/run-candidate-paging-probe.sh <native-work-dir> [data-dir]
#   <native-work-dir>  build-cmake-native-engines.sh 的 WORK 目录
#   [data-dir]         数据目录（默认临时目录；ASCII 变体自动派生）
set -euo pipefail
work="${1:?usage: run-candidate-paging-probe.sh <native-work-dir> [data-dir]}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
base="${2:-$(mktemp -d)}"
build="$(mktemp -d)"
libdir="$work/build/rime-host/librime/lib"
lib="$libdir/librime.so"
[ -e "$lib" ] || { echo "host librime not found under $libdir" >&2; exit 2; }
cc -std=c++17 -DGLOG_USE_GLOG_EXPORT \
   -I"$work/src/rime/librime/src" \
   -I"$work/src/rime/librime/deps/glog/src" \
   -I"$work/build/rime-host/librime/deps/glog/glog" \
   "$repo_root/scripts/research/probes/candidate-paging-probe.cc" \
   -o "$build/probe" -L"$libdir" -lrime -lstdc++ -Wl,-rpath,"$libdir" 2>&1 | head -5

# 组装数据目录：staging(build) 与 shared 同构（关闭 maintenance 的 probe
# 不做部署编译，编译产物必须先落位）。
seed_data() {
  local data="$1"
  mkdir -p "$data/user" "$data/build" "$data/shared"
  for dst in shared build; do
    for sub in prelude essay luna-pinyin stroke rime-frost; do
      cp -R "$work/src/rime-data/$sub/." "$data/$dst/" 2>/dev/null || true
    done
    cp -R "$work/artifacts/rime-data/." "$data/$dst/"
  done
}
seed_data "$base"
# ASCII 学习词 fixture（复现 user_table 无 spans 候选排首）
mkdir -p "$base-ascii"
cp -R "$base/." "$base-ascii/"
printf 'buy\tbuy\t100\nbuys\tbuys\t100\n' > "$base-ascii/user/custom_phrase.txt"
# 变体 2：8 条 ASCII 精确码词条排在前面，把首个有 spans 的候选（不要）
# 推出第 0 页——fallback 必须跨页扫描。
mkdir -p "$base-ascii8"
cp -R "$base/." "$base-ascii8/"
# 列序 = 文本<TAB>输入码：编码列恒为 buy/buys（与输入精确匹配才占位），
# 文本列变化（buy1..buy8）。首个有 spans 的候选被推出第 0 页。
{ printf 'buy\tbuy\t100\nbuys\tbuys\t100\n'
  for i in 1 2 3 4 5 6 7 8; do printf 'buy%d\tbuy\t100\n' "$i"; done
  for i in 1 2 3 4; do printf 'buys%d\tbuys\t100\n' "$i"; done
} > "$base-ascii8/user/custom_phrase.txt"

export PROBE_BUILD_DUMMY=1
run_case() { # $1=data $2=string $3=mode
  PROBE_COMMIT=1 PROBE_SHARED="$1/shared" PROBE_USER="$1/user" PROBE_BUILD="$1/build" \
    "$build/probe" ziranma_double_pinyin "$2" "$3"
}
fail=0
for data in "$base" "$base-ascii" "$base-ascii8"; do
  tag=$( [ "$data" = "$base" ] && echo clean || { [ "$data" = "$base-ascii" ] && echo ascii || echo ascii8; } )
  for mode in none iterator; do
    for str in nihlkj buysvkfhds buvidku; do
      out=$(run_case "$data" "$str" "$mode" 2>&1) || fail=1
      echo "$out" > "$data/probe-$tag-$mode-$str.log"
      # 逐帧断言：iterator 与 none 一致由探针 exit code（MUTATED=2）保证；
      # 这里断言关键帧分段（第5帧）与终帧。
      case "$str" in
        nihlkj)
          [ "$mode" = none ] || continue
          echo "$out" | grep -q "KEY k .*preedit=\[ni hl k\]" || { echo "FAIL[$tag] nihlk 第5帧"; fail=1; }
          echo "$out" | grep "^KEY j .*preedit=\[ni hl kj\]" | tail -1 | grep -q . || { echo "FAIL[$tag] nihlk 终帧"; fail=1; } ;;
        buysvkfhds)
          [ "$mode" = none ] || continue
          echo "$out" | grep -q "KEY v .*preedit=\[bu ys v\]" || { echo "FAIL[$tag] buysv 第5帧"; fail=1; }
          echo "$out" | grep "^KEY s .*preedit=\[bu ys vk fh ds\]" | tail -1 | grep -q . || { echo "FAIL[$tag] 终帧"; fail=1; } ;;
        buvidku)
          [ "$mode" = none ] || continue
          echo "$out" | grep -q "KEY k .*preedit=\[bu vi dk\]" || { echo "FAIL[$tag] buvidku 第6帧"; fail=1; }
          echo "$out" | grep "^KEY u .*preedit=\[bu vi dk u\]" | tail -1 | grep -q . || { echo "FAIL[$tag] buvidku 终帧"; fail=1; } ;;
      esac
      # 实际提交断言（none/iterator 均查）：恰好一次、词正确
      case "$str" in
        nihlkj) want="你还看" ;;
        buysvkfhds) want="不用找房东" ;;
        buvidku) want="不知道是" ;;
      esac
      n=$(printf '%s\n' "$out" | grep -c "^COMMIT ")
      [ "$n" = 1 ] || { echo "FAIL[$tag/$mode/$str] COMMIT 次数=$n（应恰 1）"; fail=1; }
      printf '%s\n' "$out" | grep -q "^COMMIT $want\$" || { echo "FAIL[$tag/$mode/$str] COMMIT 词不符（期望 $want）"; fail=1; }
    done
  done
  # 旧壳病态复现（fallback 不改变旧壳翻页拖高亮的行为路径）。
  out=$(run_case "$data" buysvkfhds pages 2>&1) || true
  echo "$out" > "$data/probe-$tag-pages-buysvkfhds.log"
done
# ---- 独立运行全快照一致：none vs iterator（同一词库同一串，全部 KEY 行）----
for data in "$base" "$base-ascii" "$base-ascii8"; do
  for str in nihlkj buysvkfhds buvidku; do
    for f in "$data"/probe-*-none-$str.log; do
      peer="${f/-none-/-iterator-}"
      # 不变量域比对（codex 四轮定义）：raw/caret/preedit/seg/status/
      # selected/tags/selectedSpans 必须一致；top5 属惰性候选缓存，读取
      # 模式影响句子候选的物化顺序，允许差异。
      grep '^KEY ' "$f" | sed 's/^KEY //;s/ top5=.*//' > "$f.keyed" 2>/dev/null || true
      grep '^KEY ' "$peer" | sed 's/^KEY //;s/ top5=.*//' > "$peer.keyed" 2>/dev/null || true
      cmp -s "$f.keyed" "$peer.keyed" || { echo "FAIL snapshot mismatch: $f vs $peer"; fail=1; }
    done
  done
done
# ---- ASCII fixture 前置成立断言：第3/4帧首选 ASCII 且 spans 为空 ----
for tag in ascii ascii8; do
  d=$( [ "$tag" = ascii ] && echo "$base-ascii" || echo "$base-ascii8" )
  grep -q "KEY y .*selectedSpans= top5=buy|" "$d/probe-$tag-none-buysvkfhds.log" || {
    echo "FAIL[$tag] frame 'buy' head is not the spanless ASCII entry"; fail=1; }
  grep -q "KEY s .*selectedSpans= top5=buys|" "$d/probe-$tag-none-buysvkfhds.log" || {
    echo "FAIL[$tag] frame 'buys' head is not the spanless ASCII entry"; fail=1; }
done
# ---- 终帧候选与实际提交断言 ----
for tag in clean ascii ascii8; do
  d=$( [ "$tag" = clean ] && echo "$base" || { [ "$tag" = ascii ] && echo "$base-ascii" || echo "$base-ascii8"; } )
  grep -q "top5=你还看|" "$d/probe-$tag-none-nihlkj.log" || { echo "FAIL[$tag] nihlkj 终帧首选"; fail=1; }
  grep -q "top5=不用找房东|" "$d/probe-$tag-none-buysvkfhds.log" || { echo "FAIL[$tag] buysvkfhds 终帧首选"; fail=1; }
  grep -q "top5=不知道是|" "$d/probe-$tag-none-buvidku.log" || { echo "FAIL[$tag] buvidku 终帧首选"; fail=1; }
done
[ "$fail" = 0 ] && echo "probe matrix: ALL PASS" || { echo "probe matrix: FAILURES"; exit 1; }
