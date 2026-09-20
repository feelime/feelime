#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
inputs="${FEELIME_NATIVE_INPUTS:?set FEELIME_NATIVE_INPUTS to the verified archive directory}"
ndk="${FEELIME_NATIVE_NDK:?set FEELIME_NATIVE_NDK to the verified Android NDK r29 directory}"
work="${FEELIME_NATIVE_WORK:?set FEELIME_NATIVE_WORK to a new empty build directory}"

[[ "$(uname -m)" == x86_64 ]] || { echo "the pinned native build requires x86_64" >&2; exit 2; }
[[ ! -e "$work" ]] || { echo "FEELIME_NATIVE_WORK must not already exist: $work" >&2; exit 2; }
grep -q 'Pkg.Revision = 29.0.14206865' "$ndk/source.properties" || {
  echo "unexpected NDK identity" >&2; exit 2;
}

mkdir -p "$work/src/rime/librime/deps" "$work/src/hunspell" "$work/src/rime-data" "$work/artifacts"
export SOURCE_DATE_EPOCH=1724457600
reproducible_paths="-ffile-prefix-map=$work=/feelime-build -fmacro-prefix-map=$work=/feelime-build"
export CFLAGS="${CFLAGS:-} $reproducible_paths"
export CXXFLAGS="${CXXFLAGS:-} $reproducible_paths"
extract_into() {
  local archive="$1" destination="$2"
  mkdir -p "$destination"
  tar -xf "$inputs/$archive" --strip-components=1 -C "$destination"
}

extract_into librime-417db2385f732cb0fa194b497042c42abb897d99.tar.gz "$work/src/rime/librime"
extract_into glog-7b134a5c82c0c0b5698bb6bf7a835b230c5638e4.tar.gz "$work/src/rime/librime/deps/glog"
extract_into yaml-cpp-2f86d13775d119edbb69af52e5f566fd65c6953b.tar.gz "$work/src/rime/librime/deps/yaml-cpp"
extract_into leveldb-99b3c03b3284f5886f9ef9a4ef703d57373e61be.tar.gz "$work/src/rime/librime/deps/leveldb"
extract_into marisa-trie-3e87d53b78e15f2f43783d5e376561a8c9722051.tar.gz "$work/src/rime/librime/deps/marisa-trie"
extract_into opencc-e9f3bb3fa1d058fe2fd4f096503222854bdc31ab.tar.gz "$work/src/rime/librime/deps/opencc"
extract_into boost-1.89.0-cmake.tar.xz "$work/src/rime/boost"
cp -R "$repo_root/spikes/native-engine-smoke/native-src/rime/." "$work/src/rime/"

for package in prelude essay luna-pinyin; do
  mkdir -p "$work/src/rime-data/$package"
done
extract_into rime-prelude-082425ea0684bca36474415d4a0e8db9b016487e.tar.gz "$work/src/rime-data/prelude"
extract_into rime-essay-e9b1a374a6ea015fca5bdd04318924b4483ac35a.tar.gz "$work/src/rime-data/essay"
extract_into rime-luna-pinyin-56b934b099dfbeab842320f13aa8b461a6ab3e42.tar.gz "$work/src/rime-data/luna-pinyin"
extract_into rime-stroke-1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48.tar.gz "$work/src/rime-data/stroke"
# See patches/luna-pinyin-zh-hans-reset.patch: simplified Chinese is the
# session-start default, which upstream does not pin.
patch --silent -d "$work/src/rime-data/luna-pinyin" -p1 \
  < "$repo_root/scripts/research/patches/luna-pinyin-zh-hans-reset.patch"

# 基底词库（issue #39）：rime-frost 瘦身组合。luna-pinyin 仓继续提供
# schema（含 zh_hans reset patch），dict 由 frost 源 + 仓库 umbrella 覆盖。
mkdir -p "$work/src/rime-data/rime-frost"
extract_into rime-frost-96278d8.tar.gz "$work/src/rime-data/rime-frost"

extract_into hunspell-f143a42a0b95578c39f8657101624ed44dea6514.tar.gz "$work/src/hunspell/hunspell"
cp -R "$repo_root/spikes/native-engine-smoke/native-src/hunspell/." "$work/src/hunspell/"

# Select the licensed dictionaries and create a deterministic sorted prefix
# index at build time. Runtime lookups never scan the full Hunspell .dic.
dictionary_source="$work/src/dictionaries"
extract_into libreoffice-dictionaries-32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4.tar.gz "$dictionary_source"
mkdir -p "$work/artifacts/hunspell"
cp "$dictionary_source/fr_FR/dictionaries/fr.aff" "$work/artifacts/hunspell/fr.aff"
cp "$dictionary_source/fr_FR/dictionaries/fr.dic" "$work/artifacts/hunspell/fr.dic"
cp "$dictionary_source/ru_RU/ru_RU.aff" "$work/artifacts/hunspell/ru_RU.aff"
cp "$dictionary_source/ru_RU/ru_RU.dic" "$work/artifacts/hunspell/ru_RU.dic"
python3 "$repo_root/scripts/research/generate-prefix-index.py" \
  "$work/artifacts/hunspell/fr.dic" "$work/artifacts/hunspell/fr.prefix.txt"
python3 "$repo_root/scripts/research/generate-prefix-index.py" \
  "$work/artifacts/hunspell/ru_RU.dic" "$work/artifacts/hunspell/ru_RU.prefix.txt"

# Build the deployer from the same pinned source/dependencies as Android, then
# precompile both the upstream full-pinyin schema and Feelime's original
# double-pinyin schema. No schema compilation occurs on the device.
cmake -S "$work/src/rime" -B "$work/build/rime-host" -G Ninja \
  -DFEELIME_HOST_DEPLOYER=ON -DCMAKE_BUILD_TYPE=Release -DENABLE_LOGGING=OFF \
  -DCMAKE_C_FLAGS="$reproducible_paths" -DCMAKE_CXX_FLAGS="$reproducible_paths"
cmake --build "$work/build/rime-host" --target rime_deployer
rime_shared="$work/rime-data/shared"
rime_user="$work/rime-data/user"
rime_build="$work/rime-data/build"
mkdir -p "$rime_shared" "$rime_user" "$rime_build"
cp -R "$work/src/rime-data/prelude/." "$rime_shared/"
cp -R "$work/src/rime-data/essay/." "$rime_shared/"
cp -R "$work/src/rime-data/luna-pinyin/." "$rime_shared/"
cp "$repo_root/spikes/native-engine-smoke/original-schemas/ziranma_double_pinyin.schema.yaml" "$rime_shared/"
cp "$repo_root/spikes/native-engine-smoke/original-schemas/double_pinyin_flypy.schema.yaml" "$rime_shared/"
cp "$repo_root/spikes/native-engine-smoke/original-schemas/double_pinyin_sogou.schema.yaml" "$rime_shared/"
cp "$repo_root/spikes/native-engine-smoke/original-schemas/double_pinyin_ziguang.schema.yaml" "$rime_shared/"
# 基底词库换装（issue #39）：frost 六件进 shared/cn_dicts，仓库 umbrella
# （name 仍是 luna_pinyin——fuzzy m1-m31/双拼/T9 全部 schema 引用同一词典
# 名）覆盖 luna 自带 dict。prism/table 同场成对编译（syllable_id 耦合，
# 跨词库混搭会词频错位——A/B 实测 51.7% 命中）。
mkdir -p "$rime_shared/cn_dicts"
for piece in 8105 41448 base ext others corrections; do
  cp "$work/src/rime-data/rime-frost/cn_dicts/$piece.dict.yaml" "$rime_shared/cn_dicts/"
done
cp "$repo_root/scripts/research/rime-dicts/rime-frost-umbrella.dict.yaml" \
  "$rime_shared/luna_pinyin.dict.yaml"

# 笔画（issue #18）：派生词典（上游 stroke.dict.yaml + essay 频次，仓库
# 脚本裁剪/加权/单通配派生）与仓库原创 schema 进同一编译现场。
python3 "$repo_root/scripts/generate-stroke-dict.py" \
  --output "$rime_shared/stroke.dict.yaml" \
  --src "$work/src/rime-data/stroke/stroke.dict.yaml" \
  --essay "$work/src/rime-data/essay/essay.txt"
cp "$repo_root/app/src/main/assets/engine-data/rime/feelime_stroke.schema.yaml" "$rime_shared/"
deployer="$work/build/rime-host/librime/bin/rime_deployer"
"$deployer" --compile "$rime_shared/luna_pinyin.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
"$deployer" --compile "$rime_shared/ziranma_double_pinyin.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
"$deployer" --compile "$rime_shared/double_pinyin_flypy.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
"$deployer" --compile "$rime_shared/double_pinyin_sogou.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
"$deployer" --compile "$rime_shared/double_pinyin_ziguang.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
"$deployer" --compile "$rime_shared/feelime_stroke.schema.yaml" "$rime_user" "$rime_shared" "$rime_build"
# 模糊音 prism 矩阵（issue #39 起纳入正式链路）：31 个 mask 变体必须与
# 本现场 table 同场编译。语义校验（prism.txt 拼写集合）在生成器里，
# byte 级会因 marisa 构建顺序差百字节，不做 cmp。
python3 "$repo_root/scripts/generate-fuzzy-prisms.py" \
  --shared "$rime_shared" --deployer "$deployer" --out "$rime_build/fuzzy"
mkdir -p "$work/artifacts/rime-data"
mkdir -p "$work/artifacts/rime-data"
for output in \
  luna_pinyin.table.bin luna_pinyin.prism.bin luna_pinyin.reverse.bin \
  luna_pinyin.prism.txt luna_pinyin.table.txt luna_pinyin.schema.yaml \
  ziranma_double_pinyin.prism.bin ziranma_double_pinyin.prism.txt \
  ziranma_double_pinyin.schema.yaml \
  double_pinyin_flypy.prism.bin double_pinyin_flypy.prism.txt \
  double_pinyin_flypy.schema.yaml \
  double_pinyin_sogou.prism.bin double_pinyin_sogou.prism.txt \
  double_pinyin_sogou.schema.yaml \
  double_pinyin_ziguang.prism.bin double_pinyin_ziguang.prism.txt \
  double_pinyin_ziguang.schema.yaml \
  stroke.prism.bin stroke.table.bin; do
  cp "$rime_build/$output" "$work/artifacts/rime-data/"
done
mkdir -p "$work/artifacts/rime-data/fuzzy"
cp "$rime_build/fuzzy"/luna_pinyin_fuzzy_m*.prism.bin "$work/artifacts/rime-data/fuzzy/"
# 笔画四件与仓库登记资产逐字节比对——dict/schema 是仓库形态（生成器/
# 原创源文件，部署直接读源码 yaml），prism/table 是编译产物；全部可再
# 生成且必须就是被 third_party 清单审计的那几份字节。
for asset in stroke.dict.yaml feelime_stroke.schema.yaml; do
  cp "$rime_shared/$asset" "$work/artifacts/rime-data/"
done
for asset in stroke.dict.yaml stroke.prism.bin stroke.table.bin \
  feelime_stroke.schema.yaml; do
  cmp -s "$work/artifacts/rime-data/$asset" \
    "$repo_root/app/src/main/assets/engine-data/rime/$asset" || {
    echo "stroke artifact mismatch: $asset (rerun generate / audit manifests)" >&2
    exit 2
  }
done

toolchain="$ndk/build/cmake/android.toolchain.cmake"
for abi in arm64-v8a x86_64; do
  case "$abi" in
    arm64-v8a) target_triple=aarch64-linux-android ;;
    x86_64) target_triple=x86_64-linux-android ;;
  esac
  cmake -S "$work/src/rime" -B "$work/build/rime-$abi" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$toolchain" -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM=android-26 -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="$reproducible_paths" -DCMAKE_CXX_FLAGS="$reproducible_paths" \
    -DCMAKE_SHARED_LINKER_FLAGS=-Wl,--build-id=sha1
  cmake --build "$work/build/rime-$abi" --target feelime_rime

  cmake -S "$work/src/hunspell" -B "$work/build/hunspell-$abi" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$toolchain" -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM=android-26 -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="$reproducible_paths" -DCMAKE_CXX_FLAGS="$reproducible_paths" \
    -DCMAKE_SHARED_LINKER_FLAGS=-Wl,--build-id=sha1
  cmake --build "$work/build/hunspell-$abi" --target feelime_hunspell

  mkdir -p "$work/artifacts/$abi"
  cp "$work/build/rime-$abi/libfeelime_rime.so" "$work/artifacts/$abi/"
  cp "$work/build/hunspell-$abi/libfeelime_hunspell.so" "$work/artifacts/$abi/"

  cmake -S "$repo_root/spikes/native-engine-smoke/native-src/smoke" \
    -B "$work/build/smoke-$abi" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$toolchain" -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM=android-26 -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="$reproducible_paths" -DCMAKE_CXX_FLAGS="$reproducible_paths" \
    -DCMAKE_SHARED_LINKER_FLAGS=-Wl,--build-id=sha1 \
    -DFEELIME_PREBUILT_DIR="$work/artifacts/$abi"
  cmake --build "$work/build/smoke-$abi" --target feelime_smoke

  cp "$work/build/smoke-$abi/libfeelime_smoke.so" "$work/artifacts/$abi/"
  cp "$ndk/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/$target_triple/libc++_shared.so" \
    "$work/artifacts/$abi/"
done

strip="$ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip"
for abi in arm64-v8a x86_64; do
  for library in libfeelime_rime.so libfeelime_hunspell.so libfeelime_smoke.so; do
    "$strip" --strip-unneeded "$work/artifacts/$abi/$library"
  done
done

find "$work/artifacts" -type f -print0 | sort -z | xargs -0 sha256sum
