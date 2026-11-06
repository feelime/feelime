// #90 旧 WebView 兼容带的一致性 gate：mock 套件入口 require 本文件。
// 校验三件事，任一失配直接 throw（fail-fast，不许静默跑绿）：
//   1) esbuild 可用（工具缺失=没人生成 legacy 产物，先修环境）
//   2) 入库的 *.legacy.js 与「esbuild chrome66 重新转译源文件」逐字节
//      一致——改了 keyboard.js/settings.js 忘跑 generate-legacy-web.sh
//      会让旧 WebView 跑到陈旧逻辑（新机上一切正常，测不出来）
//   3) 两个 index.html 的探针（flag + document.write fallback）在位
//
// 教训来源：feelime-generated-asset-fixture-blindspot（手写 fixture 掩盖
// 生成器残次产物）——资产类改动必须直读真实产物做一致性断言。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const PAIRS = [
    { src: 'app/src/main/assets/keyboard/keyboard.js', legacy: 'app/src/main/assets/keyboard/keyboard.legacy.js' },
    { src: 'app/src/main/assets/settings/settings.js', legacy: 'app/src/main/assets/settings/settings.legacy.js' },
];

const esbuild = process.env.FEELIME_ESBUILD ||
    path.join(os.homedir(), '.config/feelime/toolchain/esbuild');
if (!fs.existsSync(esbuild)) {
    throw new Error(`check_legacy_web: esbuild missing at ${esbuild} — install per scripts/generate-legacy-web.sh`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feelime-legacy-'));
try {
    for (const { src, legacy } of PAIRS) {
        const out = path.join(tmp, path.basename(legacy));
        execFileSync(esbuild, [path.join(ROOT, src), '--target=chrome66', '--keep-names', `--outfile=${out}`], { stdio: 'pipe' });
        const want = fs.readFileSync(out);
        const have = fs.readFileSync(path.join(ROOT, legacy));
        if (!want.equals(have)) {
            throw new Error(`check_legacy_web: ${legacy} stale vs ${src} — rerun scripts/generate-legacy-web.sh`);
        }
    }
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

for (const [html, legacyName] of [
    ['app/src/main/assets/keyboard/index.html', 'keyboard.legacy.js'],
    ['app/src/main/assets/settings/index.html', 'settings.legacy.js'],
]) {
    const text = fs.readFileSync(path.join(ROOT, html), 'utf8');
    if (!text.includes('window.__feelimeES = 0') || !text.includes(legacyName)) {
        throw new Error(`check_legacy_web: ${html} missing the legacy probe (flag/fallback)`);
    }
}
module.exports = 'legacy web assets consistent';
