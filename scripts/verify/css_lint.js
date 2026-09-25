#!/usr/bin/env node
/*
 * Static CSS lint for keyboard.css (zero deps, plain node).
 *
 * Two device incidents from batches 4/5 were CSS-layer defects that the mock
 * bridge (no CSS engine) could never see:
 * `.tool { display:flex }` beat the UA `[hidden]` rule, so
 *            compose controls were always visible;
 * `touch-action: none` on children of an `overflow-x: auto`
 *            strip killed its horizontal drag.
 * This lint encodes both failure shapes so they surface locally instead of
 * on the device. Run: node scripts/verify/css_lint.js (wired into run-all).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CSS = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/keyboard/keyboard.css'), 'utf8');
const HTML = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/keyboard/index.html'), 'utf8');
const JS = fs.readFileSync(
    path.join(ROOT, 'app/src/main/assets/keyboard/keyboard.js'), 'utf8');

let failures = 0;
const ruleFails = {};
function fail(rule, message) {
    ruleFails[rule] = (ruleFails[rule] || 0) + 1;
    failures += 1;
    console.log(`FAIL ${rule}: ${message}`);
}
function pass(rule, message) {
    if (!ruleFails[rule]) console.log(`PASS ${rule}: ${message}`);
}

// ---- parse rule blocks: selector { declarations }
const blocks = [];
const blockRe = /([^{}]+)\{([^{}]*)\}/g;
let match;
while ((match = blockRe.exec(CSS))) {
    blocks.push({
        selector: match[1].trim().replace(/\s+/g, ' '),
        body: match[2],
    });
}

// ---- R1: touch-action:none must stay off scroll-container children.
// `none` is only sanctioned on the letter-key grid (keys preventDefault
// touchstart by design and never live in a horizontal scroller). Anything
// else needs an explicit, commented addition to this list.
// ink-canvas: 手写书写区（issue #28）——非滚动容器，笔迹事件全
// preventDefault，touch-action:none 封掉浏览器默认手势。
const ALLOW_TOUCH_NONE = new Set(['kb-key', 'pair-drag', 'height-handle', 'hc-track', 'ink-canvas']); // height-handle/hc-track: keyboard-height drag surfaces (the height handle, the band-floating card) - fixed inside their own card, never inside an overflow-x scroller; pair-drag: settings drag handle, never inside an overflow-x scroller; ink-canvas: handwriting pad (issue #28), never inside a scroller
for (const block of blocks) {
    if (!/touch-action:\s*none/.test(block.body)) continue;
    const classes = [...block.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)]
        .map(m => m[1]);
    const ok = classes.some(c => ALLOW_TOUCH_NONE.has(c));
    if (!ok) {
        fail('R1 touch-action',
            `${block.selector} uses touch-action:none - if it renders inside ` +
            'an overflow-x container this kills the drag; use pan-x or add ' +
            'the class to ALLOW_TOUCH_NONE with a reason');
    }
}
pass('R1 touch-action', 'no touch-action:none outside the key grid');

// ---- R2: elements toggled via [hidden] must keep a [hidden] display rule.
// Any author `display:` declaration on the base selector beats the UA
// `[hidden] { display:none }`, which is exactly the Bug shape.
const hiddenIds = new Set();
for (const m of HTML.matchAll(/id="([\w-]+)"[^>]*\shidden(?:\s|>)/g)) {
    hiddenIds.add(m[1]);
}
for (const m of JS.matchAll(/getElementById\('([\w-]+)'\)\.hidden\s*=/g)) {
    hiddenIds.add(m[1]);
}
let checked = 0;
for (const id of hiddenIds) {
    const baseRe = new RegExp(`(^|[\\s,])#${id}(\\[[^\\]]*\\])?\\s*([,{]|$)`);
    const hiddenRe = new RegExp(`(^|[\\s,])#${id}\\[hidden\\]([\\s,{]|$)`);
    let hasDisplay = false;
    let hasHiddenNone = false;
    for (const block of blocks) {
        if (!baseRe.test(block.selector)) continue;
        if (/display:\s*[a-z-]+/.test(block.body)) hasDisplay = true;
        if (hiddenRe.test(block.selector) &&
            /display:\s*none/.test(block.body)) hasHiddenNone = true;
    }
    if (hasDisplay && !hasHiddenNone) {
        fail('R2 hidden', `#${id} has an author display declaration but no ` +
            '`#id[hidden] { display: none }` to keep the hidden state working');
    }
    if (hasDisplay) checked += 1;
}
pass('R2 hidden', `display-bearing hidden targets checked (${checked} with ` +
    `display rules of ${hiddenIds.size} hidden ids)`);

// ---- R3: scroll containers declared in the harness must exist in CSS.
// mock_bridge_harness.js hard-codes OVERFLOW_X_IDS to model scrollability;
// a rename in CSS would silently un-drag every strip while mock stays green.
const harness = fs.readFileSync(
    path.join(ROOT, 'scripts/verify/mock_bridge_harness.js'), 'utf8');
const declared = [...harness.matchAll(/OVERFLOW_X_IDS\s*=\s*\[([^\]]*)\]/g)]
    .flatMap(m => [...m[1].matchAll(/'([\w-]+)'/g)].map(x => x[1]));
for (const id of declared) {
    if (!new RegExp(`#${id}\\s*\\{[^}]*overflow-x:\\s*(auto|scroll)`).test(CSS)) {
        fail('R3 overflow', `harness models #${id} as overflow-x:auto but ` +
            'keyboard.css has no such rule; sync OVERFLOW_X_IDS with CSS');
    }
}
pass('R3 overflow', `all ${declared.length} harness scroll containers exist in CSS`);

console.log(failures ? `\ncss_lint: ${failures} failure(s)` : '\ncss_lint: all rules pass');
process.exit(failures ? 1 : 0);
