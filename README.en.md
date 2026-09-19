# Feelime Keyboard

**Feelime** is an open-source, fully offline keyboard for Android with a
modern interface and built-in voice input. The keyboard area is rendered
with local HTML/CSS/JavaScript and talks to Android's `InputConnection`
through a token-gated JS Bridge. Speech recognition uses two passes: a
streaming bilingual Zipformer shows partial text in real time, and each
pause segment is re-decoded by a bilingual Paraformer for final correction,
followed by local punctuation and English casing/contraction restoration.
Everything runs on the device.

**Open** · completely open source (MIT) and free. The keyboard UI is plain
HTML/CSS/JS under `app/src/main/assets/keyboard/` — customize the look or
rebuild a layout without repacking the APK (debug builds accept unsigned
hot-update packages and instant local pushes).

**Modern** · a coherent, modern visual language (light/dark themes, unified
tokens and interaction rules — see
[docs/design/appearance.md](docs/design/appearance.md)) plus streaming
offline speech recognition with final-pass correction.

**Private** · fully offline. The WebView has no network or file access;
audio never touches disk (at most ~24 s of PCM kept in memory) and never
leaves the device. Password fields disable voice input and clipboard
history collection.

## Features

- **Fully offline**: speech recognition (sherpa-onnx) and the Chinese
  engine (librime) run on-device
- **Chinese**: full Pinyin / double pinyin (Ziranma / Flypy / Sogou /
  Ziguang, with fuzzy-pinyin groups), T9 keypad, 5-key stroke input
  (wildcard and word-split sentence building), simplified output,
  consecutive word coinage, per-engine user lexicons, a unified candidate
  pool, next-word association and one-handed mode
- **Multilingual**: English, French, Russian, Japanese romaji with offline
  dictionary candidates
- **Voice input**: bilingual streaming recognition, final-pass correction,
  local punctuation recovery
- **Customizable symbol keys**: mix literal text, special keys and
  shortcuts (e.g. Vim macros) in a JSON key table
- **Control-key layer**: sticky Ctrl/Alt/Win/Fn, F1–F12 and combo popups
  for terminals and remote desktops

## Build & install

A standard Android development environment is enough (Linux/macOS with
`ANDROID_HOME` pointing at the Android SDK):

```bash
./scripts/setup-assets.sh     # first run: fetch the sherpa-onnx AAR + models (SHA-256 verified)
ANDROID_HOME=… ./gradlew :app:assembleDirectDebug
adb install -r app/build/outputs/apk/direct/debug/app-direct-debug.apk
```

The dictionary engine data (Chinese/Western/Japanese/association, ~66 MB) ships with the
repository; `checkEngineArtifacts` verifies every file's SHA-256 at build
time. Regenerate via the pinned pipeline — see
[AGENTS.md "词典引擎数据"](AGENTS.md) (Chinese).

The full APK ships with voice models; `-PfeelimeModels=thin` builds a slim
APK that downloads models on first use (in-app, offline afterwards).
Enable Feelime in the system input-method settings and grant the
microphone permission.

## Customizing the keyboard / hot updates

The keyboard lives in `app/src/main/assets/keyboard/`
(`index.html`, `keyboard.css`, `keyboard.js`, `VERSION`). Edit and push
without rebuilding the APK:

```bash
./scripts/push-keyboard.sh --local  # package the repo keyboard and push, instant reload
```

Keyboard packages are signature- and capability-checked and activated
atomically; the settings page can always restore the APK built-in keyboard
(design details: [docs/design/keyboard.md §8](docs/design/keyboard.md)).

## Documentation

| Document | Content |
| --- | --- |
| [AGENTS.md](AGENTS.md) | engineering conventions, commands, verification gates |
| [docs/design/keyboard.md](docs/design/keyboard.md) | authoritative product/interaction design (§ anchors cited by code) |
| [docs/design/appearance.md](docs/design/appearance.md) | visual system and checklist for new UI elements |
| [docs/product/requirements.md](docs/product/requirements.md) | consolidated requirements and known boundaries |
| [docs/testing/verification.md](docs/testing/verification.md) | verification methodology and gates |

## Development

Local gates (no device needed, seconds):

```bash
node scripts/verify/css_lint.js
node scripts/verify/mock_bridge_tests.js
ANDROID_HOME=… ./gradlew testDebugUnitTest
```

Device gates (environment-injected):

```bash
bash scripts/verify/run-all.sh
```

See [docs/testing/verification.md](docs/testing/verification.md) for the
full methodology, suite list and platform quirks. 中文文档：
[README.md](README.md)。

## License

[MIT](LICENSE). Speech by
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), Chinese by
[librime](https://github.com/rime/librime); full third-party list in
[third_party/](third_party/) and [NOTICE](NOTICE).
