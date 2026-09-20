# Third-party notice bundle index

Feelime's native-engine feasibility package uses the exact upstream revisions,
archives, build scripts and output bindings recorded in `manifest.json`.  The
complete license and NOTICE texts needed by the shipped native package are stored below
`third_party/licenses/`; this index identifies their scope.  The corresponding
source method and exact archive identity are recorded in `source-closure.json`.

- librime and Mozc: BSD-3-Clause. Mozc's statically linked Abseil, Protobuf and
  zlib dependencies carry Apache-2.0, BSD-3-Clause and Zlib texts respectively.
  Mozc dictionary inputs additionally retain their upstream per-file
  NAIST/IPAdic/ICOT/Okinawa notices.
- Rime prelude, essay, and luna-pinyin schema data: LGPL-3.0-only. Corresponding
  source archives and Feelime modifications must be offered with a release.
- rime-frost (白霜拼音, gaboolic/rime-frost@96278d8): GPL-3.0. The base Chinese
  lexicon is built from a slimmed import set of its cn_dicts (8105/41448/base/
  ext/others/corrections; upstream tencent/cell/GB18030 tables dropped) via the
  repository umbrella `scripts/research/rime-dicts/rime-frost-umbrella.dict.yaml`,
  host-compiled with the pinned deployer. Distributing the APK therefore requires
  GPL-3.0 compliance for the whole offering (the app itself moved MIT -> GPL-3.0
  with this change).
- Hunspell: Feelime selects the MPL-1.1 option. French dictionary: MPL-2.0.
  Russian dictionary: its upstream BSD-like notice must be reproduced.
- Boost, glog, yaml-cpp, LevelDB, marisa-trie, OpenCC, RapidJSON 1.1.0, bundled darts-clone,
  utf8cpp, X11 keysym notices, and the Android NDK runtime notice are included
  under `third_party/licenses/` and bound by `manifest.json`.

The Mozc dependency closure records every selected Bzlmod module and marks the
28 modules actually materialized for the two Android targets.  RE2 is present
in the resolved module graph but was not materialized for either target, so no
RE2 code is part of the shipped output.  Build-only rules are retained in the
dependency-cache manifest; shipped static/runtime components are listed above.

The thin-build ASR encoder archive and its exact extracted entry are recorded
with their URL, sizes and SHA-256 values in `model-archive.json`. Apache
Commons Compress 1.28.0 parses the bzip2/tar stream and resolves
commons-codec 1.19.0, commons-io 2.20.0 and commons-lang3 3.18.0 at runtime.
Their Apache-2.0 license/NOTICE texts are kept under `licenses/`, with source
URLs and artifact hashes in `model-archive.json`.
The mixed Chinese-English OfflinePunctuation CT-Transformer uses the official
Apache-2.0 punctuation archive; its archive and extracted `model.int8.onnx`
hashes are recorded in the same manifest.

No code, library, model, or dictionary is extracted from any third-party input method.

Saved phrase shortcut initials are derived from the pinned Rime Luna Pinyin
dictionary and the existing OpenCC conversion data. Source, license, generator
and SHA-256 are recorded in `third_party/phrase-initials.json`.

Model downloads use unmodified OkHttp 4.12.0 and Okio JVM 3.6.0 (Square,
Apache-2.0) for requests whose cancellation persists before connection starts.
Sources and artifact hashes are recorded in `model-network.json`; full license
texts are in `licenses/okhttp-4.12.0-LICENSE.txt` and `licenses/okio-3.6.0-LICENSE.txt`.
