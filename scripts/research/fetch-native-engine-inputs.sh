#!/usr/bin/env bash
set -euo pipefail

destination="${1:?usage: $0 DESTINATION_DIRECTORY}"
mkdir -p "$destination"

fetch() {
  local name="$1" url="$2" sha256="$3" target
  target="$destination/$name"
  if [[ ! -f "$target" ]]; then
    curl --fail --location --proto '=https' --tlsv1.2 --output "$target.part" "$url"
    mv "$target.part" "$target"
  fi
  printf '%s  %s\n' "$sha256" "$target" | sha256sum -c -
}

fetch librime-417db2385f732cb0fa194b497042c42abb897d99.tar.gz \
  https://github.com/rime/librime/archive/417db2385f732cb0fa194b497042c42abb897d99.tar.gz \
  479cfdccae4caeb2a54867fc1ce9b2f02891c41e2b3bc7faff3e5be84dc70c54
fetch rime-prelude-082425ea0684bca36474415d4a0e8db9b016487e.tar.gz \
  https://github.com/rime/rime-prelude/archive/082425ea0684bca36474415d4a0e8db9b016487e.tar.gz \
  66239ba4745d54471e5ce5540b45e86ec663ff5dba004cb23c95531a3bdec00f
fetch rime-essay-e9b1a374a6ea015fca5bdd04318924b4483ac35a.tar.gz \
  https://github.com/rime/rime-essay/archive/e9b1a374a6ea015fca5bdd04318924b4483ac35a.tar.gz \
  11559224d48709b0d77009a550804bfc2b763cfdf048c8d8fe224b3d36ba441c
fetch rime-stroke-1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48.tar.gz \
  https://github.com/rime/rime-stroke/archive/1e8fff9b9494ddec23b0cbc526bcfd8171a6fd48.tar.gz \
  1347a57ab4cf269be9b1c49ce50facfe60617207f2780604fe82914070da8a80
fetch rime-luna-pinyin-56b934b099dfbeab842320f13aa8b461a6ab3e42.tar.gz \
  https://github.com/rime/rime-luna-pinyin/archive/56b934b099dfbeab842320f13aa8b461a6ab3e42.tar.gz \
  876c7ba559794f476abf7195a255aea29000cee281e6f5ec664928dce018bd90
# 基底词库（issue #39）：rime-frost（白霜拼音，GPL-3.0）瘦身组合的
# 源数据。上游默认挂载中 tencent/cell/GB18030 未采用（A/B 实测零首选
# 命中贡献、table 63MB→19MB），cn_dicts 六件在 build 脚本里挑选。
fetch rime-frost-96278d8.tar.gz \
  https://codeload.github.com/gaboolic/rime-frost/tar.gz/96278d8 \
  ee4d2438bef22896dbad1d1027970370c53e3ffee3dd82a03f6615838036efbb
fetch glog-7b134a5c82c0c0b5698bb6bf7a835b230c5638e4.tar.gz \
  https://github.com/google/glog/archive/7b134a5c82c0c0b5698bb6bf7a835b230c5638e4.tar.gz \
  9c48c7c631be5af3502a19d06ebdb5c2f67d8d0bf216f896848089c1792e6193
fetch yaml-cpp-2f86d13775d119edbb69af52e5f566fd65c6953b.tar.gz \
  https://github.com/jbeder/yaml-cpp/archive/2f86d13775d119edbb69af52e5f566fd65c6953b.tar.gz \
  923b2298148581b14ef21d9ce29d83eca102ff671a547dfdbd227245a199bcd8
fetch leveldb-99b3c03b3284f5886f9ef9a4ef703d57373e61be.tar.gz \
  https://github.com/google/leveldb/archive/99b3c03b3284f5886f9ef9a4ef703d57373e61be.tar.gz \
  bc87b9bbc5674c91246a89813355e78401759761342cc049e1c3d56350a8a9d1
fetch marisa-trie-3e87d53b78e15f2f43783d5e376561a8c9722051.tar.gz \
  https://github.com/s-yata/marisa-trie/archive/3e87d53b78e15f2f43783d5e376561a8c9722051.tar.gz \
  c24516edc43be8049ef4e23e50a574d4670036fe3595c49c0f01d4d87ce58f57
fetch opencc-e9f3bb3fa1d058fe2fd4f096503222854bdc31ab.tar.gz \
  https://github.com/BYVoid/OpenCC/archive/e9f3bb3fa1d058fe2fd4f096503222854bdc31ab.tar.gz \
  903c03e92c18c3573b72431e16af3e641e87911236e9fbe4a562e6fde469e215
fetch boost-1.89.0-cmake.tar.xz \
  https://github.com/boostorg/boost/releases/download/boost-1.89.0/boost-1.89.0-cmake.tar.xz \
  67acec02d0d118b5de9eb441f5fb707b3a1cdd884be00ca24b9a73c995511f74
fetch hunspell-f143a42a0b95578c39f8657101624ed44dea6514.tar.gz \
  https://github.com/hunspell/hunspell/archive/f143a42a0b95578c39f8657101624ed44dea6514.tar.gz \
  17055a5fc8a8c6aea1dabe8f2c3c9956499a6a265a991422533ac1904d3c2565
fetch libreoffice-dictionaries-32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4.tar.gz \
  https://github.com/LibreOffice/dictionaries/archive/32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4.tar.gz \
  cbd790eca560de5e8ec8bd64117a00dfd0bc06b091c8f52d23e44ea00d3e8461
fetch mozc-851c3fe33060d2a6090363e4d7ec44fafde2c03d.tar.gz \
  https://github.com/google/mozc/archive/851c3fe33060d2a6090363e4d7ec44fafde2c03d.tar.gz \
  04b2112ba202cccbd9553bbbaf109ef0ab1b438a4c4c677d348dd6975b6598e3

echo "all pinned native-engine source inputs verified"
