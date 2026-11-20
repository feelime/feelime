#!/usr/bin/env node
// 桥面契约门：JS 调用的每个桥方法，在原生侧都必须有 @JavascriptInterface。
//
// 背景（#115，v1.4.11 后修复）：setKeyBubble 漏了 @JavascriptInterface，
// JS 调用静默失败——设置页开关点了不生效，日志里什么都没有。WebView 只
// 暴露带注解的方法，漏注解不报错，任何一层测试都测不出来。这里用最便宜
// 的方式把它变成硬门：JS 侧出现的桥方法名，原生侧必须找得到。
//
// 覆盖两个桥：
//   keyboard.js  → Native.xxx(...)        → FeelimeService.ImeBridge
//   settings.js  → call("xxx", ...) 与     → SettingsBridge
//                  Native.xxx(...)
// legacy 资产是生成物（check_legacy_web.js 管一致性），这里只查源文件。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 无 token 的例外：requestState 只做一次状态重推，页面恢复用。
const TOKENLESS_OK = new Set(['requestState']);

function annotatedMethods(file) {
  const src = read(file);
  const names = new Set();
  const badToken = [];
  const re = /@JavascriptInterface\s*\n\s*(?:@\w+(?:\([^)]*\))?\s*\n\s*)*fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    names.add(name);
    // token 必须是最后一个形参：settings.js 的 call(action, ...args)
    // 固定把 token 追加在末尾，形参错位会静默传错值。
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const params = src.slice(open + 1, end).split(',').map((x) => x.trim()).filter(Boolean);
    const tail = params.length ? params[params.length - 1] : '';
    if (!/\btoken\b/.test(tail) && !TOKENLESS_OK.has(name)) {
      badToken.push(name);
    }
  }
  return { names, badToken };
}

/** JS 里点名的桥方法：直接调用与 call("name") 两种写法。 */
function jsCalls(file) {
  const src = read(file);
  const names = new Set();
  for (const m of src.matchAll(/Native\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bcall\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g)) names.add(m[1]);
  return names;
}

const checks = [
  {
    js: 'app/src/main/assets/keyboard/keyboard.js',
    native: 'app/src/main/java/com/feelime/ime/FeelimeService.kt',
    label: 'keyboard → ImeBridge',
  },
  {
    js: 'app/src/main/assets/settings/settings.js',
    native: 'app/src/main/java/com/feelime/ime/SettingsBridge.kt',
    label: 'settings → SettingsBridge',
  },
];

let failed = false;
for (const c of checks) {
  const calls = jsCalls(c.js);
  const { names: native, badToken } = annotatedMethods(c.native);
  const missing = [...calls].filter((n) => !native.has(n)).sort();
  if (badToken.length) {
    failed = true;
    console.error(`FAIL ${c.label}: token 不是最后一个形参: ${badToken.sort().join(', ')}`);
  }
  if (missing.length) {
    failed = true;
    console.error(`FAIL ${c.label}: JS 调了但原生没有 @JavascriptInterface 方法: ${missing.join(', ')}`);
    for (const n of missing) {
      // 有同名方法但漏注解时给出明确指路（#115 同形错误）。
      const src = read(c.native);
      const re = new RegExp(`fun\\s+${n}\\s*\\(`);
      if (re.test(src)) console.error(`  ${n}: 原生有同名 fun，但没有 @JavascriptInterface`);
    }
  } else {
    console.log(`PASS ${c.label} 桥面对齐（${calls.size} 个方法）`);
  }
}

if (failed) process.exit(1);
