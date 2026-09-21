#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$PROJECT_DIR/scripts/feelime-env.sh"

# Install targets are machine-local and shared by every worktree/clone on
# this host (see AGENTS.md, "Machine-local build environment"); the repo
# never receives these bytes. Downloads cache under XDG_CACHE_HOME so a
# re-run after a worktree switch never re-downloads.
CONFIG_DIR="${FEELIME_CONFIG_DIR:-$HOME/.config/feelime}"
LIB_DIR="${FEELIME_ANDROID_DIR:-$CONFIG_DIR/android}"
MODELS_ROOT="${FEELIME_MODELS_DIR:-$CONFIG_DIR/models}"
ASSET_DIR="$MODELS_ROOT/asr-model"
FINAL_ASSET_DIR="$MODELS_ROOT/final-model"
PUNCT_ASSET_DIR="$MODELS_ROOT/punctuation"
CACHE_DIR="${XDG_CACHE_HOME:-/tmp}/feelime"

# 必须用 static-link-onnxruntime 变体：普通变体内嵌 libonnxruntime.so
# （1.27.1），与手写识别的 onnxruntime-android（1.27.0）同名 so 不能共存
# ——GNU symbol version 失配（OrtGetApiBase@VERS_1.27.x），dlopen 直接
# 报 cannot locate symbol（真机实测 2026-09-21，issue #28）。static-link
# 变体把 onnxruntime 静态链进 libsherpa-onnx-jni.so，两套推理栈互不相干。
AAR_NAME="sherpa-onnx-static-link-onnxruntime-1.13.6.aar"
AAR_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.6/$AAR_NAME"
AAR_SHA256="01e87037afca2ed49085062aace5c012e60321e8e23e3a72b6d9ac02c843f66c"

MODEL_ARCHIVE="sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20-mobile.tar.bz2"
MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$MODEL_ARCHIVE"
MODEL_SHA256="45b8d04fe8faf5146397ff2e71d90ca8effdfcbe9adc30fdce769e92cabd6b03"
MODEL_DIR="sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20-mobile"

FINAL_ARCHIVE="sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2"
FINAL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$FINAL_ARCHIVE"
FINAL_SHA256="da92b3db5218c5be53aad53e57d1b6e63e7fc98a0e054fbdd6dbe18e9c6b1450"
FINAL_DIR="sherpa-onnx-paraformer-zh-small-2024-03-09"

PUNCT_ARCHIVE="sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8.tar.bz2"
PUNCT_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/punctuation-models/$PUNCT_ARCHIVE"
PUNCT_SHA256="c0d5aa5f8eeb686032345e180bedf39319dc2e0556781c6264bcadba8328a6e1"
PUNCT_DIR="sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8"

# 手写识别（design/handwriting.md §5.3）：PP-OCRv5 mobile rec fp32 单文件，
# ModelScope 直链（国内直连），sha256 与 models/manifest.json 同源。
INK_ASSET_DIR="$MODELS_ROOT/handwriting"
INK_URL="https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile.onnx"
INK_SHA256="5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5"

mkdir -p "$LIB_DIR" "$ASSET_DIR" "$FINAL_ASSET_DIR" "$PUNCT_ASSET_DIR" "$INK_ASSET_DIR" "$CACHE_DIR"

download_and_verify() {
    local url="$1" output="$2" expected="$3"
    if [[ ! -f "$output" ]] || ! echo "$expected  $output" | sha256sum --check --status; then
        echo "Downloading $(basename "$output")..."
        curl -fL --retry 3 --continue-at - --output "$output" "$url"
    fi
    echo "$expected  $output" | sha256sum --check
}

download_and_verify "$AAR_URL" "$CACHE_DIR/$AAR_NAME" "$AAR_SHA256"
download_and_verify "$MODEL_URL" "$CACHE_DIR/$MODEL_ARCHIVE" "$MODEL_SHA256"
download_and_verify "$FINAL_URL" "$CACHE_DIR/$FINAL_ARCHIVE" "$FINAL_SHA256"
download_and_verify "$PUNCT_URL" "$CACHE_DIR/$PUNCT_ARCHIVE" "$PUNCT_SHA256"
install -m 0644 "$CACHE_DIR/$AAR_NAME" "$LIB_DIR/$AAR_NAME"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
tar -xjf "$CACHE_DIR/$MODEL_ARCHIVE" -C "$TEMP_DIR"
install -m 0644 "$TEMP_DIR/$MODEL_DIR/encoder-epoch-99-avg-1.int8.onnx" "$ASSET_DIR/encoder.int8.onnx"
install -m 0644 "$TEMP_DIR/$MODEL_DIR/decoder-epoch-99-avg-1.onnx" "$ASSET_DIR/decoder.onnx"
install -m 0644 "$TEMP_DIR/$MODEL_DIR/joiner-epoch-99-avg-1.int8.onnx" "$ASSET_DIR/joiner.int8.onnx"
install -m 0644 "$TEMP_DIR/$MODEL_DIR/tokens.txt" "$ASSET_DIR/tokens.txt"
# The matching, small tokenizer vocabulary ships in both full and thin APKs.
# Its source/revision/license are recorded in third_party/asr-hotwords.json.
echo "d0b642f3a2eacd5fadefdeff9e0e1358cab729647cbb7fe58cf738e1f7407029  $PROJECT_DIR/app/src/main/assets/asr-hotwords/bpe.vocab" | sha256sum --check
echo "a8e0e4ec53810e433789b54a5c0134a7eaa2ffca595a6334d54c00da858841d3  $ASSET_DIR/tokens.txt" | sha256sum --check

tar -xjf "$CACHE_DIR/$FINAL_ARCHIVE" -C "$TEMP_DIR"
install -m 0644 "$TEMP_DIR/$FINAL_DIR/model.int8.onnx" "$FINAL_ASSET_DIR/model.int8.onnx"
install -m 0644 "$TEMP_DIR/$FINAL_DIR/tokens.txt" "$FINAL_ASSET_DIR/tokens.txt"

tar -xjf "$CACHE_DIR/$PUNCT_ARCHIVE" -C "$TEMP_DIR"
install -m 0644 "$TEMP_DIR/$PUNCT_DIR/model.int8.onnx" "$PUNCT_ASSET_DIR/model.int8.onnx"
# The previous OnlinePunctuation model used this same directory. Remove its
# vocabulary so an incremental setup cannot leave an incompatible companion
# file beside the OfflinePunctuation model.
rm -f "$PUNCT_ASSET_DIR/bpe.vocab"

# 手写模型：目录缺失/文件不完整才下载（本地已有同 sha 文件则零流量）。
if ! echo "$INK_SHA256  $INK_ASSET_DIR/model.onnx" | sha256sum --check --status; then
    download_and_verify "$INK_URL" "$CACHE_DIR/ppocrv5-mobile-rec.onnx" "$INK_SHA256"
    install -m 0644 "$CACHE_DIR/ppocrv5-mobile-rec.onnx" "$INK_ASSET_DIR/model.onnx"
fi

echo "Feelime streaming ASR, final-pass ASR, punctuation, and handwriting models are ready."
echo "  AAR:    $LIB_DIR/$AAR_NAME"
echo "  models: $MODELS_ROOT"

# The :feelime-models PAD module resolves its assets through the in-tree
# path (gitignored); keep it pointing at the shared tree so Play builds see
# the same verified bytes as direct builds.
ln -sfn "$MODELS_ROOT" "$PROJECT_DIR/app/src/modelAssets/full"
