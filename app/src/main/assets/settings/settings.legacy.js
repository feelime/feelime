"use strict";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
window.__feelimeES = 1;
if (typeof Element !== "undefined" && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function(...nodes) {
    this.textContent = "";
    for (const n of nodes) this.append(n);
  };
}
if (!Object.fromEntries) {
  Object.fromEntries = function(entries) {
    const out = {};
    for (const [k, v] of entries) out[k] = v;
    return out;
  };
}
if (!Array.prototype.flat) {
  Array.prototype.flat = function(depth) {
    const d = depth === void 0 ? 1 : Math.floor(depth);
    const out = [];
    const walk = /* @__PURE__ */ __name((arr, level) => {
      for (const v of arr) {
        if (level > 0 && Array.isArray(v)) walk(v, level - 1);
        else out.push(v);
      }
    }, "walk");
    walk(this, d);
    return out;
  };
}
let keySoundVolumeTimer = 0;
const BRIDGE = window.Native || { ready() {
} };
let token = "";
let lastState = null;
let uiChoice = "auto";
let uiLocale = browserLocale();
let pendingModelConsent = null;
let lastModelError = null;
const $ = /* @__PURE__ */ __name((id) => document.getElementById(id), "$");
const KEYBOARD_MODES = [
  ["direct", "\u82F1\u6587\u76F4\u51FA"],
  ["pinyin", "\u5168\u62FC"],
  ["double-pinyin", "\u53CC\u62FC"],
  ["t9", "\u4E5D\u5BAB\u683C"],
  ["stroke", "\u7B14\u753B"],
  ["flypy", "\u97F3\u5F62"],
  ["handwriting", "\u624B\u5199"],
  ["french", "\u6CD5\u8BED"],
  ["russian", "\u4FC4\u8BED"],
  ["japanese", "\u65E5\u8BED"]
];
const DEFAULT_MENU_MODES = ["direct", "pinyin", "double-pinyin", "t9", "stroke"];
const CK_MODES = [
  ["text", "ck.f.mode.text"],
  ["single", "ck.f.mode.single"],
  ["combo", "ck.f.mode.combo"],
  ["open", "ck.f.mode.open"],
  ["setting", "ck.f.mode.setting"],
  ["panel", "ck.f.mode.panel"],
  ["advanced", "ck.f.mode.advanced"],
  ["op", "ck.f.mode.op"]
];
const CK_EDIT_OPS = [
  ["undo", "ck.op.undo"],
  ["redo", "ck.op.redo"],
  ["cut", "ck.op.cut"],
  ["copy", "ck.op.copy"],
  ["paste", "ck.op.paste"],
  ["selectAll", "ck.op.selectAll"],
  ["clear", "ck.op.clear"],
  ["cursorLeft", "ck.op.cursorLeft"],
  ["cursorRight", "ck.op.cursorRight"],
  ["lineStart", "ck.op.lineStart"],
  ["lineEnd", "ck.op.lineEnd"]
];
const LANG_KB = {
  /* leftKey：第三行左键形态（复刻 keyboard.js isChineseMode 分支）——
   * 中文键盘（pinyin/dp）是「分词」，非中文键盘（法俄英）是 Shift
   * 图标；双拼 sogou/ziguang 方案的 ing 特例不在预览层复刻（方案是
   * 运行时设置，预览画主形态即可）。 */
  pinyin: {
    title: "ck.lang.pinyin",
    rows: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
    leftKey: "sep",
    alts: {
      q: "1",
      w: "2",
      e: "3",
      r: "4",
      t: "5",
      y: "6",
      u: "7",
      i: "8",
      o: "9",
      p: "0",
      a: "-",
      s: "/",
      d: ":",
      f: ";",
      g: "(",
      h: ")",
      j: "~",
      k: '"',
      l: "'",
      z: "@",
      x: "_",
      c: "#",
      v: "&",
      b: "?",
      n: "!",
      m: "\u2026",
      ".": ","
    }
  },
  dp: { title: "ck.lang.dp", rows: ["qwertyuiop", "asdfghjkl", "zxcvbnm"], leftKey: "sep", share: "pinyin" },
  english: { title: "ck.lang.english", rows: ["qwertyuiop", "asdfghjkl", "zxcvbnm"], leftKey: "shift", share: "pinyin" },
  french: {
    title: "ck.lang.french",
    rows: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
    leftKey: "shift",
    alts: {
      q: "1",
      w: "2",
      e: "\xE9",
      r: "4",
      t: "5",
      y: "\xFF",
      u: "\xF9",
      i: "\xEE",
      o: "\xF4",
      p: "0",
      a: "\xE0",
      s: "/",
      d: ":",
      f: ";",
      g: "(",
      h: ")",
      j: "\xAB",
      k: "\xBB",
      l: "\u2019",
      z: "@",
      x: "_",
      c: "\xE7",
      v: "&",
      b: "?",
      n: "!",
      m: ".",
      ".": ","
    }
  },
  russian: {
    title: "ck.lang.russian",
    rows: ["\u0439\u0446\u0443\u043A\u0435\u043D\u0433\u0448\u0449\u0437\u0445\u044A", "\u0444\u044B\u0432\u0430\u043F\u0440\u043E\u043B\u0434\u0436\u044D", "\u044F\u0447\u0441\u043C\u0438\u0442\u044C\u0431\u044E"],
    leftKey: "shift",
    alts: {
      \u0439: "1",
      \u0446: "2",
      \u0443: "3",
      \u043A: "4",
      \u0435: "5",
      \u043D: "6",
      \u0433: "7",
      \u0448: "8",
      \u0449: "9",
      \u0437: "0",
      \u0445: "-",
      \u044A: "=",
      \u0444: "\\",
      \u044B: "/",
      \u0432: ":",
      \u0430: ";",
      \u043F: "(",
      \u0440: ")",
      \u043E: "~",
      \u043B: '"',
      \u0434: "'",
      \u0436: "\xAB",
      \u044D: "\xBB",
      \u044F: "@",
      \u0447: "_",
      \u0441: "#",
      \u043C: "&",
      \u0438: "?",
      \u0442: "!",
      \u044C: "\u2026",
      \u0431: ",",
      \u044E: ".",
      ".": ","
    }
  }
};
const THEME_PRESET_LIST = ["classic", "ocean", "violet", "amber", "sakura", "teal"];
const THEME_PRESET_COLORS = {
  classic: "#23c890",
  ocean: "#4da3ff",
  violet: "#a78bfa",
  amber: "#ff9f45",
  sakura: "#ff8fb1",
  teal: "#2ec8c8"
};
const PRESET_HUE = { classic: 160, ocean: 212, violet: 255, amber: 27, sakura: 344, teal: 180 };
const I18N = {
  zh: {
    "title": "Feelime \u8BBE\u7F6E",
    "hero.tag": "\u79BB\u7EBF\u4E2D\u82F1\u6DF7\u5408\u8BED\u97F3\u8F93\u5165\u6CD5",
    "status.title": "\u72B6\u6001",
    "ime.title": "\u8F93\u5165\u6CD5\u72B6\u6001",
    "ime.enabled": "\u5728\u7CFB\u7EDF\u4E2D\u542F\u7528 Feelime",
    "ime.default": "\u8BBE\u4E3A\u9ED8\u8BA4\u8F93\u5165\u6CD5",
    "ime.enableAction": "\u53BB\u542F\u7528",
    "ime.pickAction": "\u53BB\u5207\u6362",
    "ime.addShortcut": "\u6DFB\u52A0\u684C\u9762\u5FEB\u6377\u65B9\u5F0F",
    "ime.addTile": "\u6DFB\u52A0\u5FEB\u6377\u8BBE\u7F6E\u78C1\u8D34",
    "language.title": "\u754C\u9762\u8BED\u8A00",
    "language.badge": "\u754C\u9762",
    "language.label": "\u663E\u793A\u8BED\u8A00",
    "language.hint": "\u9ED8\u8BA4\u8DDF\u968F\u7CFB\u7EDF\uFF1B\u53EA\u5F71\u54CD Feelime \u754C\u9762\uFF0C\u4E0D\u6539\u53D8\u8F93\u5165\u8BED\u8A00\u3002",
    "language.note": "\u8F93\u5165\u8BED\u8A00\u4ECD\u7531\u952E\u76D8\u6A21\u5F0F\u51B3\u5B9A\u3002",
    "language.auto": "\u8DDF\u968F\u7CFB\u7EDF",
    "language.zh": "\u4E2D\u6587",
    "language.en": "English",
    "nav.groups": "\u8BBE\u7F6E\u5206\u7EC4",
    "nav.back": "\u8FD4\u56DE\u9996\u9875",
    "entry.input.title": "\u952E\u76D8\u4E0E\u8F93\u5165",
    "entry.input.subtitle": "\u53CC\u62FC \xB7 \u5B9A\u5236\u6309\u952E",
    "entry.dict.title": "\u8BCD\u5E93",
    "entry.dict.subtitle": "\u5BFC\u5165 rime \u8BCD\u5E93 \xB7 \u53E0\u52A0\u5019\u9009",
    "entry.voice.title": "\u8BED\u97F3\u8BC6\u522B",
    "entry.voice.subtitle": "\u8BED\u97F3\u6A21\u578B \xB7 \u8BC6\u522B\u8BBE\u7F6E",
    "entry.update.title": "\u952E\u76D8\u70ED\u66F4\u65B0",
    "entry.update.subtitle": "\u952E\u76D8\u524D\u7AEF\u6587\u4EF6\u66F4\u65B0",
    "entry.backup.title": "\u5907\u4EFD\u4E0E\u6062\u590D",
    "entry.backup.subtitle": "\u8BBE\u7F6E \xB7 \u5E38\u7528\u8BED \xB7 \u8BCD\u5E93",
    "entry.about.title": "\u5173\u4E8E",
    "entry.about.subtitle": "\u7248\u672C\u4FE1\u606F \xB7 \u7EC4\u4EF6\u8BF4\u660E",
    "entry.test.title": "\u8F93\u5165\u6D4B\u8BD5",
    "entry.test.subtitle": "\u5524\u8D77\u952E\u76D8\u8BD5\u4E00\u8BD5",
    "page.input": "\u952E\u76D8\u4E0E\u8F93\u5165",
    "page.dict": "\u8BCD\u5E93",
    "dict.badge": "\u53E0\u52A0",
    "dict.import.title": "\u5BFC\u5165\u8BCD\u5E93",
    "dict.import.enable": "rime \u8BCD\u5E93\u6587\u4EF6\uFF08.dict.yaml\uFF09",
    "dict.import.note": "\u8BCD<TAB>\u7801<TAB>\u4F4D\u7F6E \u9010\u884C\u5BFC\u5165\uFF0C\u4E0A\u9650 5000 \u6761\u3002\u7B2C\u4E09\u5217\u53EA\u5BF9\u7EAF\u7B26\u53F7\u8BCD\u751F\u6548\uFF081-9 \u6307\u5B9A\u5019\u9009\u4F4D\u6B21\uFF0C\u4E0D\u586B\u9ED8\u8BA4\u7B2C 3 \u4F4D\uFF09\uFF1B\u6CE8\u610F rime \u8BCD\u5E93\u7684\u7B2C\u4E09\u5217\u539F\u672C\u662F\u6743\u91CD\u2014\u2014\u4F1A\u88AB\u5F53\u4F5C\u4F4D\u7F6E\u89E3\u91CA\uFF0C\u8D85\u8FC7 9 \u6309 9 \u5904\u7406\uFF0C\u5EFA\u8BAE\u5BFC\u5165\u524D\u5220\u6389\u6216\u6539\u5199\u8BE5\u5217\u3002",
    "dict.userwords.title": "\u81EA\u9020\u8BCD",
    "dict.userwords.enable": "\u624B\u52A8\u7EF4\u62A4\u7684\u5E38\u7528\u8BCD",
    "dict.userwords.hint": "\u9010\u6761\u6DFB\u52A0\u300C\u8BCD + \u5168\u62FC\u8F93\u5165\u7801\u300D\uFF0C\u8F93\u5165\u7801\u547D\u4E2D\u5373\u51FA\u8FD9\u4E2A\u8BCD\uFF1B\u9002\u5408\u540D\u5B57\u3001\u7F29\u5199\u3001\u884C\u8BDD\u3002\u6539\u52A8\u5373\u65F6\u751F\u6548\uFF0C\u91CD\u542F\u4FDD\u7559\u3002",
    "dict.userwords.manage": "\u7BA1\u7406\u8BCD\u6761",
    "page.userwords": "\u81EA\u9020\u8BCD",
    "page.fuzzy": "\u6A21\u7CCA\u97F3",
    "page.keyboards": "\u952E\u76D8\u9009\u62E9",
    "userwords.list.title": "\u8BCD\u6761",
    "userwords.list.empty": "\u8FD8\u6CA1\u6709\u8BCD\u6761\uFF0C\u5728\u4E0B\u65B9\u6DFB\u52A0\u3002",
    "userwords.form.text": "\u8BCD\u6761\uFF08\u5982 \u4F60\u597D\u4E16\u754C\uFF09",
    "userwords.form.code": "\u8F93\u5165\u7801\uFF08\u7559\u7A7A\u81EA\u52A8\u6309\u62FC\u97F3\u751F\u6210\uFF09",
    "userwords.form.add": "\u6DFB\u52A0",
    "userwords.form.save": "\u4FDD\u5B58",
    "userwords.form.cancel": "\u53D6\u6D88",
    "userwords.list.note": "\u8F93\u5165\u7801\u7559\u7A7A\u5373\u81EA\u52A8\u6309\u62FC\u97F3\u751F\u6210\uFF08\u591A\u97F3\u5B57\u4F1A\u751F\u6210\u5168\u90E8\u8BFB\u97F3\u7EC4\u5408\uFF0C\u5E76\u81EA\u52A8\u9002\u914D\u53CC\u62FC\u6309\u952E\uFF09\uFF1B\u70B9\u8BCD\u6761\u53EF\u4FEE\u6539\uFF0C\u2715 \u5220\u9664\u3002\u6539\u52A8\u5373\u65F6\u751F\u6548\uFF0C\u4E0A\u9650 200 \u6761\u3002",
    "userwords.note.saved": "\u5DF2\u4FDD\u5B58",
    "userwords.note.deleted": "\u5DF2\u5220\u9664",
    "userwords.err.notReady": "\u6B63\u5728\u8BFB\u53D6\u8BCD\u8868\uFF0C\u7A0D\u540E\u518D\u8BD5",
    "userwords.err.duplicate": "\u8FD9\u4E2A\u8F93\u5165\u7801\u5DF2\u5B58\u5728",
    "userwords.err.limit": "\u6700\u591A 200 \u6761",
    "userwords.form.textErr": "\u8BCD\u6761\u4E0D\u80FD\u4E3A\u7A7A",
    "userwords.form.codeErr": "\u8F93\u5165\u7801\u9700\u4E3A 1-48 \u4F4D\u5B57\u6BCD",
    "userwords.count": "\u5171 {0} \u6761",
    "nav.backDict": "\u8FD4\u56DE\u8BCD\u5E93",
    "dict.base.title": "\u57FA\u5E95\u8BCD\u5E93",
    "dict.base.badge": "\u57FA\u5E95",
    "dict.base.hint": "\u6362\u88C5\u6574\u4E2A\u8BCD\u5E93\uFF1A\u9009\u62E9 zip \u6574\u5305\uFF08\u96FE\u51C7 rime-ice \u9009\u6574\u5305 zip\u3001\u4E07\u8C61\u62FC\u97F3\u9009\u53BB\u58F0\u8C03\u7684 Lite \u7248 zip\uFF1B\u5355\u4E2A .dict.yaml \u53EA\u9002\u5408\u81EA\u5E26\u8BCD\u6761\u884C\u7684\u8BCD\u5178\uFF0C\u53EA\u542B import_tables \u5F15\u7528\u7684\u4F1E\u8868\u4E3B\u6587\u4EF6\u5355\u72EC\u5BFC\u5165\u5FC5\u5931\u8D25\uFF09\uFF0C\u5728\u672C\u673A\u91CD\u65B0\u7F16\u8BD1\uFF08\u51E0\u5206\u949F\uFF09\uFF0C\u6A21\u7CCA\u97F3/\u53CC\u62FC/T9 \u4E00\u8D77\u91CD\u5EFA\uFF1B\u53EF\u968F\u65F6\u6062\u590D\u5185\u7F6E\u3002",
    "dict.base.pick": "\u9009\u62E9\u8BCD\u5E93\u6587\u4EF6\u6362\u88C5",
    "dict.base.revert": "\u6062\u590D\u5185\u7F6E\u8BCD\u5E93",
    "dict.slot.delete": "\u5220\u9664",
    "dict.base.builtin": "\u5185\u7F6E rime-frost\uFF08\u767D\u971C\u62FC\u97F3\uFF09",
    "dict.base.custom": "\u81EA\u5B9A\u4E49\uFF1A{0}",
    "dict.base.builtinNote": "\u5185\u7F6E rime-frost \u8BCD\u5E93",
    "dict.base.entries": "{0} \u8BCD\u6761",
    "dict.base.nonPinyin": "\u62BD\u6837\u53D1\u73B0\u6B64\u8BCD\u5E93\u7684\u8F83\u591A\u7F16\u7801\u4E0D\u662F\u62FC\u97F3\u97F3\u8282\u7EC4\u5408\uFF08\u5F62\u7801/\u97F3\u5F62\u7801\u8868\u7279\u5F81\uFF09\uFF1A\u53EF\u80FD\u65E0\u6CD5\u6309\u8BFB\u97F3\uFF08\u62FC\u97F3\uFF09\u9884\u671F\u6253\u51FA\u8FD9\u4E9B\u5B57\uFF1B\u5982\u9700\u5F62\u7801\u8F93\u5165\u8BF7\u5173\u6CE8\u540E\u7EED\u7684\u4E13\u5C5E\u65B9\u6848\u652F\u6301\u3002",
    "dict.base.t9Skip": "\u6B64\u8BCD\u5E93\u8BCD\u6761\u8F83\u591A\uFF1A\u7F16\u8BD1\u4E5D\u5BAB\u683C\uFF08T9\uFF09\u8BCD\u5E93\u7684\u5185\u5B58\u5F00\u9500\u8D85\u51FA\u672C\u673A\u627F\u53D7\uFF08\u4F1A\u88AB\u7CFB\u7EDF\u4E2D\u6B62\uFF09\uFF0C\u672C\u6B21\u5BFC\u5165\u8DF3\u8FC7\u4E86\u4E5D\u5BAB\u683C\uFF0C\u62FC\u97F3/\u53CC\u62FC\u4E0D\u53D7\u5F71\u54CD\uFF1B\u6362\u66F4\u5C0F\u7684\u8BCD\u5E93\u6216\u6062\u590D\u5185\u7F6E\u540E\u4E5D\u5BAB\u683C\u5373\u6062\u590D\u3002",
    "dict.base.toned": "\u6B64\u8BCD\u5E93\u7684\u7F16\u7801\u5E26\u58F0\u8C03\uFF08\u7591\u4F3C\u5B8C\u6574\u7248\uFF0C\u5982\u4E07\u8C61\u62FC\u97F3 Base\uFF09\uFF1A\u952E\u76D8\u6253\u4E0D\u51FA\u58F0\u8C03\u7B26\u53F7\uFF0C\u5F88\u591A\u5B57\u5C06\u65E0\u6CD5\u547D\u4E2D\uFF0C\u8BF7\u6539\u7528\u53BB\u58F0\u8C03\u7684 Lite \u7248\uFF08\u6216\u6362\u56DE\u5185\u7F6E\u8BCD\u5E93\uFF09\u3002",
    "flypy.title": "\u97F3\u5F62\u7801\u8868",
    "flypy.badge": "\u97F3\u5F62",
    "flypy.hint": "\u5BFC\u5165\u5F62\u7801\u65B9\u6848\u7801\u8868\uFF08\u5982\u5C0F\u9E64\u97F3\u5F62\u7684 rime \u8BCD\u8868 .dict.yaml\uFF0C\u6216 TAB \u5206\u9694\u7684\u300C\u8BCD\u3001\u7801\u300D\u7EAF\u6587\u672C\uFF09\uFF1A\u4E24\u7801\u97F3 + \u4E24\u7801\u5F62\uFF0C\u56DB\u7801\u552F\u4E00\u9876\u5B57\u4E0A\u5C4F\u3002\u5728\u672C\u673A\u7F16\u8BD1\u4E3A\u72EC\u7ACB\u7684\u97F3\u5F62\u6A21\u5F0F\uFF0C\u4E0D\u5F71\u54CD\u62FC\u97F3\u8BCD\u5E93\uFF1B\u53EF\u968F\u65F6\u79FB\u9664\u3002",
    "flypy.pick": "\u5BFC\u5165\u97F3\u5F62\u7801\u8868",
    "flypy.revert": "\u79FB\u9664\u7801\u8868",
    "flypy.none": "\u672A\u5BFC\u5165\uFF08\u6A21\u5F0F\u83DC\u5355\u6682\u65E0\u97F3\u5F62\u6A21\u5F0F\uFF09",
    "flypy.custom": "\u5DF2\u5BFC\u5165\uFF1A{0}",
    "flypy.building": "\u6B63\u5728\u5904\u7406\u97F3\u5F62\u7801\u8868\u2026",
    "dict.base.stageCopy": "\u6B63\u5728\u8BFB\u53D6\u8BCD\u5E93\u6587\u4EF6\u2026",
    "dict.base.stageActivate": "\u6B63\u5728\u5207\u6362\u8BCD\u5E93\u2026",
    "dict.base.stageCompile": "\u6B63\u5728\u7F16\u8BD1\u8BCD\u5E93\uFF08\u671F\u95F4\u4E2D\u6587\u8F93\u5165\u6682\u4E0D\u53EF\u7528\uFF09\uFF0C\u53EF\u79BB\u5F00\u6B64\u9875\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u6362\u88C5",
    "dict.base.elapsed": "\u5DF2\u7F16\u8BD1 {0} \u79D2",
    "dict.base.switching": "\u5F53\u524D\u751F\u6548 {0}\uFF0C\u6B63\u5728\u5207\u6362\u5230 {1}\uFF1A",
    "page.appearance": "\u5916\u89C2",
    "themeMode.auto": "\u8DDF\u968F\u7CFB\u7EDF",
    "themeMode.light": "\u6D45\u8272",
    "themeMode.dark": "\u6DF1\u8272",
    "page.voice": "\u8BED\u97F3\u8BC6\u522B",
    "page.update": "\u952E\u76D8\u70ED\u66F4\u65B0",
    "page.about": "\u5173\u4E8E",
    "page.test": "\u8F93\u5165\u6D4B\u8BD5",
    "input.fuzzy.title": "\u6A21\u7CCA\u97F3",
    "input.fuzzy.manage": "\u7BA1\u7406\u6A21\u7CCA\u97F3",
    "input.fuzzy.manageHint": "\u5206\u4E0D\u6E05\u7684\u97F3\u4E00\u8D77\u6253\uFF1A\u4F5C\u7528\u4E8E\u5168\u62FC\u4E0E\u4E5D\u5BAB\u683C T9\uFF08\u53CC\u62FC\u9664\u5916\uFF09\u3002",
    "input.fuzzy.badge": "\u8F93\u5165",
    "input.fuzzy.g.ping": "\u5E73\u7FD8\u820C",
    "input.fuzzy.g.ping.hint": "z/zh\u3001c/ch\u3001s/sh\uFF1A\u6253 zang \u4E5F\u80FD\u51FA\u300C\u5F20\u300D\uFF0C\u6253 zhang \u4E5F\u80FD\u51FA\u300C\u810F\u300D\u3002",
    "input.fuzzy.g.nl": "\u58F0\u6BCD n/l",
    "input.fuzzy.g.nl.hint": "\u6253 nai \u4E5F\u80FD\u51FA\u300C\u6765\u300D\uFF0C\u6253 lai \u4E5F\u80FD\u51FA\u300C\u5976\u300D\u3002",
    "input.fuzzy.g.fh": "\u58F0\u6BCD f/h",
    "input.fuzzy.g.fh.hint": "\u6253 fu \u4E5F\u80FD\u51FA\u300C\u6E56\u300D\uFF0C\u6253 hu \u4E5F\u80FD\u51FA\u300C\u7236\u300D\u3002",
    "input.fuzzy.g.rl": "\u58F0\u6BCD r/l",
    "input.fuzzy.g.rl.hint": "\u6253 re \u4E5F\u80FD\u51FA\u300C\u4E50\u300D\uFF0C\u6253 le \u4E5F\u80FD\u51FA\u300C\u70ED\u300D\u3002",
    "input.fuzzy.g.nasal": "\u524D\u540E\u9F3B\u97F3",
    "input.fuzzy.g.nasal.hint": "an/ang\u3001en/eng\u3001in/ing\uFF1A\u6253 zang \u4E5F\u80FD\u51FA\u300C\u5F20\u300D\uFF0C\u6253 zhon \u4E5F\u80FD\u51FA\u300C\u4E2D\u300D\u3002",
    "input.assoc.title": "\u4E2D\u6587\u8054\u60F3",
    "input.assoc.badge": "\u8F93\u5165",
    "input.assoc.enable": "\u9009\u8BCD\u540E\u8054\u60F3\u4E0B\u4E00\u4E2A\u8BCD",
    "input.assoc.hint": "\u4E0A\u5C4F\u540E\u5728\u5019\u9009\u6761\u7ED9\u51FA\u9AD8\u9891\u63A5\u7EED\u8BCD\uFF0C\u70B9\u51FB\u53EF\u8FDE\u7EED\u8054\u60F3\uFF1B\u53EA\u5728\u5168\u62FC/\u53CC\u62FC\u751F\u6548\u3002",
    "input.assoc.backspaceClear": "\u8054\u60F3\u65F6\u9000\u683C\u6E05\u9664\u8054\u60F3",
    "input.hwkb.title": "\u7269\u7406\u952E\u76D8",
    "input.hwkb.badge": "\u8F93\u5165",
    "input.hwkb.form": "\u8FDE\u63A5\u7269\u7406\u952E\u76D8\u65F6",
    "input.hwkb.formHint": "\u4EC5\u5019\u9009\u6761\uFF1A\u952E\u76D8\u6536\u6210\u4E00\u6761\u5019\u9009\uFF08\u62FC\u97F3/\u53CC\u62FC\u7B49\u6A21\u5F0F\uFF09\uFF1B\u5B8C\u6574\u952E\u76D8\uFF1A\u7167\u5E38\u663E\u793A\uFF1B\u8DDF\u968F\u7CFB\u7EDF\uFF1A\u7531\u7CFB\u7EDF\u7684\u300C\u8FDE\u63A5\u952E\u76D8\u65F6\u663E\u793A\u5C4F\u5E55\u952E\u76D8\u300D\u5F00\u5173\u51B3\u5B9A\u3002",
    "input.hwkb.candidates": "\u4EC5\u5019\u9009\u6761",
    "input.hwkb.full": "\u5B8C\u6574\u952E\u76D8",
    "input.hwkb.follow": "\u8DDF\u968F\u7CFB\u7EDF",
    "input.hwkb.hint": "\u786C\u952E\u76D8\u6253\u5B57\uFF1A\u5B57\u6BCD\u76F4\u63A5\u8FDB\u62FC\u97F3\u7EC4\u5408\u3001\u7A7A\u683C\u9009\u8BCD\u3001Ctrl+\u7A7A\u683C \u6216 \u5355\u6309 Shift \u5207\u6362\u4E2D\u82F1\u3002",
    "input.quickSwitch.policy": "\u5FEB\u6377\u5207\u6362\uFF08\u5207\u6362\u952E/Ctrl+\u7A7A\u683C\uFF09",
    "input.quickSwitch.policyHint": "\u56FA\u5B9A\u914D\u5BF9\uFF1A\u59CB\u7EC8\u5728\u4F60\u9009\u5B9A\u7684\u4E24\u4E2A\u952E\u76D8\u95F4\u5207\u6362\uFF1B\u5F53\u524D\u952E\u76D8\u2194\u82F1\u6587\uFF1A\u4ECE\u82F1\u6587\u5207\u56DE\u6700\u8FD1\u4F7F\u7528\u7684\u952E\u76D8\u3002",
    "input.quickSwitch.follow": "\u5F53\u524D\u952E\u76D8\u2194\u82F1\u6587",
    "input.quickSwitch.fixed": "\u56FA\u5B9A\u914D\u5BF9",
    "input.assoc.backspaceClearHint": "\u8054\u60F3\u5019\u9009\u663E\u793A\u65F6\u6309\u9000\u683C\u5148\u6E05\u8054\u60F3\u3001\u6062\u590D\u5DE5\u5177\u680F\uFF08\u4E0D\u5220\u5B57\uFF09\uFF1B\u5173\u95ED\u5219\u9000\u683C\u7167\u65E7\u5220\u5B57\u3002",
    "input.datetime.title": "\u65E5\u671F\u65F6\u95F4\u5019\u9009",
    "input.datetime.badge": "\u8F93\u5165",
    "input.datetime.enable": "\u6253 date/time/week \u51FA\u65E5\u671F\u65F6\u95F4",
    "input.datetime.hint": "\u5019\u9009\u6761\u76F4\u63A5\u7ED9\u5F53\u524D\u65E5\u671F\u3001\u65F6\u95F4\u3001\u661F\u671F\uFF08\u5168\u62FC\u6253 riqi/shijian/xingqi \u4E5F\u51FA\uFF09\uFF1B\u4E0D\u9700\u8981\u53EF\u5173\u3002",
    "input.candidates.title": "\u5019\u9009\u589E\u5F3A",
    "input.phrases.title": "\u5019\u9009\u7B26\u53F7\u8BCD",
    "input.phrases.badge": "\u8F93\u5165",
    "input.phrases.enable": "\u9644\u52A0\u7B26\u53F7/emoji \u5019\u9009",
    "input.phrases.hint": "\u6253 shang \u51FA \u2191\u3001dui \u51FA \u2713 \u8FD9\u7C7B\u7B26\u53F7\u8BCD\uFF0C\u9ED8\u8BA4\u6392\u5728\u5019\u9009\u7B2C 3 \u4F4D\uFF0C\u53EF\u5728\u300C\u7BA1\u7406\u8BCD\u6761\u300D\u91CC\u9010\u8BCD\u6307\u5B9A\u4F4D\u7F6E\uFF1B\u5168\u62FC\u548C\u53CC\u62FC\u901A\u7528\u3002",
    "input.phrases.freqSort": "\u57FA\u4E8E\u8BCD\u9891\u6392\u5E8F",
    "input.phrases.freqSortHint": "\u672A\u6307\u5B9A\u4F4D\u7F6E\u7684\u7B26\u53F7\u8BCD\u968F\u4F7F\u7528\u6B21\u6570\u524D\u79FB\uFF085 \u6B21\u540E\u53EF\u5347\u5230\u9996\u4F4D\uFF0C\u7A7A\u683C\u76F4\u9009\uFF09\uFF1B\u5173\u95ED\u65F6\u4E00\u5F8B\u56FA\u5B9A\u5728\u7B2C 3 \u4F4D\u9644\u8FD1\u3002\u624B\u52A8\u6307\u5B9A\u7684\u4F4D\u7F6E\u4E0D\u53D7\u6B64\u5F00\u5173\u5F71\u54CD\u3002",
    "input.phrases.manage": "\u7BA1\u7406\u8BCD\u6761",
    "input.phrases.importHint": "rime \u8BCD\u5E93\u6587\u4EF6\u7684\u8BCD\u6761\u53E0\u52A0\u8FDB\u5019\u9009\uFF08\u4E0D\u66FF\u6362\u5185\u7F6E\u8BCD\u5E93\u3001\u4E0D\u5E26\u539F\u8BCD\u9891\uFF09\u3002\u518D\u6B21\u5BFC\u5165\u4F1A\u66FF\u6362\u4E0A\u4E00\u6B21\u7684\u5BFC\u5165\u8868\u3002",
    "input.phrases.importBtn": "\u9009\u62E9\u6587\u4EF6\u5BFC\u5165",
    "input.phrases.clearBtn": "\u6E05\u7A7A\u5BFC\u5165\u8BCD",
    "input.phrases.confirmClear": "\u786E\u8BA4\u6E05\u7A7A",
    "input.phrases.importedCount": "\u5DF2\u5BFC\u5165 {0} \u6761",
    "page.phrases": "\u5019\u9009\u7B26\u53F7\u8BCD",
    "nav.backInput": "\u8FD4\u56DE\u952E\u76D8\u4E0E\u8F93\u5165",
    "phrases.list.title": "\u8BCD\u6761",
    "phrases.list.empty": "\u8FD8\u6CA1\u6709\u8BCD\u6761\uFF0C\u5728\u4E0B\u65B9\u6DFB\u52A0\u3002",
    "phrases.list.note": "\u8F93\u5165\u7801\u7528\u5168\u62FC\uFF08\u5355\u4E2A\u97F3\u8282\u81EA\u52A8\u9002\u914D\u53CC\u62FC\u6309\u952E\uFF09\uFF1B\u4F4D\u7F6E 1-9 \u6307\u5B9A\u8BE5\u8BCD\u56FA\u5B9A\u6392\u5728\u5019\u9009\u7B2C\u51E0\u4F4D\uFF0C\u7559\u7A7A\u9ED8\u8BA4\u7B2C 3 \u4F4D\uFF1B\u70B9\u8BCD\u6761\u53EF\u4FEE\u6539\uFF0C\u2715 \u5220\u9664\u3002\u6539\u52A8\u5373\u65F6\u751F\u6548\u3002",
    "phrases.rank.aria": "\u56FA\u5B9A\u5728\u7B2C {0} \u4F4D",
    "phrases.form.text": "\u8BCD\u6761\uFF08\u5982 \u2191 \u6216 \u4F60\u597D\uFF09",
    "phrases.form.rank": "\u5019\u9009\u4F4D\u7F6E",
    "phrases.form.code": "\u8F93\u5165\u7801\uFF08\u5982 shang\uFF09",
    "phrases.form.add": "\u6DFB\u52A0",
    "phrases.form.save": "\u4FDD\u5B58\u4FEE\u6539",
    "phrases.form.cancel": "\u53D6\u6D88",
    "phrases.note.saved": "\u5DF2\u4FDD\u5B58",
    "phrases.note.deleted": "\u5DF2\u5220\u9664",
    "phrases.err.duplicate": "\u8BE5\u8F93\u5165\u7801\u5DF2\u6709\u8BCD\u6761",
    "phrases.err.notReady": "\u8BCD\u8868\u8FD8\u5728\u52A0\u8F7D\uFF0C\u7A0D\u7B49\u518D\u8BD5",
    "phrases.err.limit": "\u6700\u591A 200 \u6761\uFF0C\u5148\u5220\u6389\u4E00\u4E9B\u518D\u6DFB\u52A0",
    "input.double.title": "\u53CC\u62FC\u65B9\u6848",
    "input.double.badge": "\u8F93\u5165",
    "input.double.scheme": "\u65B9\u6848",
    "input.double.hint": "\u952E\u76D8\u5207\u5230\u300C\u53CC\u62FC\u300D\u6A21\u5F0F\u540E\u6309\u6240\u9009\u65B9\u6848\u51FA\u5B57\u3002",
    "input.double.layout": "\u952E\u76D8\u5E03\u5C40",
    "input.double.layoutHint": "14 \u952E\u628A\u76F8\u90BB\u4E24\u5B57\u6BCD\u5408\u5E76\u6210\u5BBD\u952E\u5E3D\uFF0C\u6309\u952E\u66F4\u5927\u66F4\u4E0D\u6613\u8BEF\u89E6\u3002",
    "input.double.layout26": "26 \u952E",
    "input.feel.kbLayout": "\u5B57\u6BCD\u952E\u76D8\u5E03\u5C40",
    "input.feel.kbLayoutHint": "\u62FC\u97F3\u3001\u53CC\u62FC\u3001\u82F1\u6587\u952E\u76D8\u901A\u7528\uFF1B14 \u952E\u628A\u76F8\u90BB\u4E24\u5B57\u6BCD\u5408\u5E76\u6210\u5BBD\u952E\u5E3D\uFF0C\u6309\u952E\u66F4\u5927\u66F4\u4E0D\u6613\u8BEF\u89E6\u3002",
    "input.double.layout14": "14 \u952E",
    "input.double.ziranma": "\u81EA\u7136\u7801",
    "input.double.flypy": "\u5C0F\u9E64\u53CC\u62FC",
    "input.double.sogou": "\u641C\u72D7 / \u5FAE\u8F6F\u53CC\u62FC",
    "input.double.ziguang": "\u7D2B\u5149\u53CC\u62FC",
    "input.double.note.ziranma": "\u58F0\u6BCD\u4E0E\u5168\u62FC\u76F8\u540C\uFF08zh=V\u3001ch=I\u3001sh=U \u9664\u5916\uFF09\u3002\u96F6\u58F0\u6BCD\uFF08a/e \u5F00\u5934\uFF09\u76F4\u63A5\u6253\u5168\u62FC\uFF1A\u554A=aa\u3001\u7231=ai\u3001\u5B89=an\u3001\u6069=en\u3001\u4E8C=er\u3002",
    "input.double.note.flypy": "\u58F0\u6BCD\u4E0E\u5168\u62FC\u76F8\u540C\uFF08zh=V\u3001ch=I\u3001sh=U \u9664\u5916\uFF09\u3002\u96F6\u58F0\u6BCD\uFF08a/e/o \u5F00\u5934\uFF09\u53CC\u6253\u9996\u5B57\u6BCD\uFF0C\u4E5F\u53EF\u6253\u5168\u62FC\uFF1A\u554A=aa\u3001\u7231=ai\u3001\u6069=ef\u3001\u4E8C=er\u3002",
    "input.double.note.sogou": "\u58F0\u6BCD\u4E0E\u5168\u62FC\u76F8\u540C\uFF08zh=V\u3001ch=I\u3001sh=U \u9664\u5916\uFF09\uFF1Bing \u5728\u300C;\u300D\u952E\uFF08\u952E\u76D8\u4E0A\u5373\u5206\u8BCD\u952E\u4F4D\u7F6E\uFF09\uFF0C\xFC \u5728 Y\u3002\u96F6\u58F0\u6BCD\u56FA\u5B9A\u5148\u6253 O\uFF1A\u554A=oa\u3001\u7231=ol\u3001\u5B89=oj\u3001\u6069=of\u3001\u4E8C=or\u3002\u641C\u72D7\u4E0E\u5FAE\u8F6F\u53CC\u62FC\u952E\u4F4D\u5B8C\u5168\u4E00\u81F4\uFF0C\u7528\u5FAE\u8F6F\u53CC\u62FC\u4E60\u60EF\u7684\u9009\u8FD9\u9879\u5373\u53EF\u3002",
    "input.double.note.ziguang": "\u7D2B\u5149\u534E\u5B87\u62FC\u97F3\u7684\u53CC\u62FC\u952E\u4F4D\u3002zh=U\u3001ch=A\u3001sh=I\uFF1Bing \u5728\u300C;\u300D\u952E\uFF0C\xFC \u5728 V\uFF08ju/qu/xu \u4E5F\u53EF\u7528 v \u952E\uFF09\u3002\u96F6\u58F0\u6BCD\u56FA\u5B9A\u5148\u6253 O\uFF1A\u554A=oa\u3001\u7231=op\u3001\u5B89=or\u3002",
    "input.double.mapCaption": "\u97F5\u6BCD\u952E\u4F4D\u56FE\uFF08\u952E\u540D\u4E0B\u65B9\u4E3A\u8BE5\u952E\u97F5\u6BCD\uFF0C\u53F3\u4E0B\u4E3A\u53CC\u58F0\u6BCD\uFF09",
    "input.custom.title": "\u5B9A\u5236\u6309\u952E",
    "input.custom.badge": "\u9AD8\u7EA7",
    "input.custom.enabled": "\u542F\u7528\u7B26\u53F7\u9875\u5B9A\u5236",
    "input.custom.jsonLabel": '\u5B9A\u5236 JSON\uFF08{"version":1,"rows":[[{"t":"\u952E\u9762","tap":"\u70B9\u51FB\u8F93\u51FA","note":"\u5907\u6CE8"}]]}\uFF09',
    "input.custom.jsonPlaceholder": "\u7C98\u8D34\u5B9A\u5236 JSON",
    "input.custom.note": "\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u952E\u76D8\u4E0B\u6B21\u8F7D\u5165\u65F6\u751F\u6548\u3002",
    "input.custom.manage": "\u7BA1\u7406\u5B9A\u5236\u6309\u952E",
    "input.custom.badjson": "JSON \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u683C\u5F0F\uFF08version/rows\uFF09",
    "page.customkeys": "\u5B9A\u5236\u6309\u952E",
    "ck.status.title": "\u5B9A\u5236\u6309\u952E",
    "ck.openEditor": "\u6253\u5F00\u7F16\u8F91\u5668",
    "ck.openEditor.hint": "\u70B9\u9009\u521B\u5EFA\u6309\u952E\uFF0C\u4E0D\u7528\u5199\u4EE3\u7801",
    "ck.json.title": "\u9AD8\u7EA7",
    "ck.json.hint": "\u7F16\u8F91\u5668\u591F\u7528\u7684\u65E5\u5E38\u4E0D\u9700\u8981\u52A8\u8FD9\u91CC\uFF1B\u6279\u91CF\u5BFC\u5165/\u5BFC\u51FA\u6216\u9AD8\u7EA7\u73A9\u6CD5\u53EF\u76F4\u63A5\u7C98\u8D34 JSON\u3002",
    "ck.rows.title": "\u6309\u952E\uFF1A\u70B9\u6309\u4FEE\u6539\uFF0C\u957F\u6309\u53EF\u79FB\u52A8/\u5220\u9664",
    "ck.quick.title": "\u5E38\u7528\u952E\uFF0C\u4E00\u952E\u52A0",
    "ck.quick.title.hint": "\u70B9\u6309\u952E\u6539\u5185\u5BB9\uFF0C\u957F\u6309\u8C03\u6574\u4F4D\u7F6E\uFF1B\u70B9\u300C\uFF0B\u300D\u6DFB\u52A0\u65B0\u6309\u952E\u3002",
    "ck.edit.title": "\u7F16\u8F91\u6309\u952E",
    "ck.apply": "\u786E\u5B9A",
    "ck.save": "\u4FDD\u5B58",
    "ck.add": "\uFF0B",
    "ck.f.t": "\u952E\u9762\u6587\u6848",
    "ck.f.t.hint": "\u6309\u94AE\u4E0A\u663E\u793A\u7684\u5B57",
    "ck.f.action": "\u70B9\u51FB\u8F93\u51FA",
    "ck.f.mode": "\u7C7B\u578B",
    "ck.f.mode.text": "\u6587\u672C",
    "ck.f.mode.single": "\u6309\u952E",
    "ck.f.mode.combo": "\u7EC4\u5408",
    "ck.f.mode.advanced": "\u9AD8\u7EA7",
    "ck.f.mode.open": "\u6253\u5F00",
    "ck.f.mode.setting": "\u8BBE\u7F6E",
    "ck.f.mode.panel": "\u9762\u677F",
    "ck.f.kind": "\u7C7B\u578B",
    "ck.lang.title": "\u8BED\u8A00\u952E\u76D8",
    "ck.lang.pinyin": "\u5168\u62FC\u952E\u76D8",
    "ck.lang.dp": "\u53CC\u62FC\u952E\u76D8",
    "ck.lang.english": "\u82F1\u6587\u952E\u76D8",
    "ck.lang.french": "\u6CD5\u8BED\u952E\u76D8",
    "ck.lang.russian": "\u4FC4\u8BED\u952E\u76D8",
    "ck.lang.count": "\u5DF2\u5B9A\u5236 {count} \u952E",
    "ck.lang.default": "\u9ED8\u8BA4",
    "ck.lang.hint1": "\u70B9\u5B57\u6BCD\u952E / \u9017\u53F7\u53E5\u53F7\u952E\u5B9A\u5236\u89D2\u6807\u4E0E\u4E0A\u6ED1\u3001\u4E0B\u6ED1\uFF1B\u5E03\u5C40\u3001\u5355\u51FB\u4E0E\u957F\u6309\u4E0D\u53D8\u3002",
    "ck.lang.hint2": "\u5206\u8BCD / \u9000\u683C / 123 / \u4E2D\u82F1 / \u56DE\u8F66\u4E0D\u53EF\u5B9A\u5236\uFF1B\u7A7A\u683C\u957F\u6309\u6CBF\u7528\u300C\u957F\u6309\u7A7A\u683C\u52A8\u4F5C\u300D\uFF08\u8DE8\u952E\u76D8\u7EDF\u4E00\uFF09\u3002",
    "ck.lang.reset": "\u5168\u90E8\u6062\u590D",
    "ck.lang.resetDone": "\u5DF2\u6062\u590D\u9ED8\u8BA4\uFF08\u8BB0\u5F97\u4FDD\u5B58\uFF09",
    "ck.lang.editTitle": "\u7F16\u8F91\u952E {0}",
    "ck.lang.editKey": "\u5B9A\u5236\u952E {0}",
    "ck.lang.editPunct": "\u5B9A\u5236\u9017\u53F7\u952E",
    "ck.lang.lock": "\u8F93\u51FA\u5B57\u6BCD {0} \xB7 \u5355\u51FB\u4E0E\u957F\u6309\u56FA\u5B9A",
    "ck.lang.lockPunct": "\u8F93\u51FA\u9017\u53F7\uFF0C \xB7 \u5355\u51FB\u4E0E\u957F\u6309\u56FA\u5B9A",
    "ck.lang.alt": "\u89D2\u6807",
    "ck.lang.altPlaceholder": "\u9ED8\u8BA4\uFF1A{0}",
    "ck.lang.slotUp": "\u2197 \u4E0A\u6ED1",
    "ck.lang.slotDown": "\u2198 \u4E0B\u6ED1",
    "ck.lang.defUp": "\u952E\u76D8\u9ED8\u8BA4 \xB7 \u5927\u5199 {0}",
    "ck.lang.defDown": "\u952E\u76D8\u9ED8\u8BA4 \xB7 \u89D2\u6807\u5B57\u7B26",
    "ck.lang.shiftKey": "\u5206\u8BCD",
    "ck.lang.cnEn": "\u4E2D/\u82F1",
    "ck.sym.title": "\u7B26\u53F7\u952E\u76D8",
    "ck.sym.entry": "\u300C\u5B9A\u5236\u300D\u7B26\u53F7\u9875",
    "ck.sym.hint": "\u70B9\u6309\u4FEE\u6539\uFF0C\u957F\u6309\u79FB\u52A8/\u5220\u9664",
    "ck.sym.pageTitle": "\u300C\u5B9A\u5236\u300D\u7B26\u53F7\u9875",
    "ck.f.mode.def": "\u952E\u76D8\u9ED8\u8BA4",
    "ck.f.mode.none": "\u5173\u95ED",
    "ck.f.mode.op": "\u52A8\u4F5C",
    "ck.f.op": "\u52A8\u4F5C",
    "ck.op.undo": "\u64A4\u9500",
    "ck.op.redo": "\u91CD\u505A",
    "ck.op.cut": "\u526A\u5207",
    "ck.op.copy": "\u590D\u5236",
    "ck.op.paste": "\u7C98\u8D34",
    "ck.op.selectAll": "\u5168\u9009",
    "ck.op.clear": "\u6E05\u7A7A\u7F16\u8F91\u6846",
    "ck.op.cursorLeft": "\u5149\u6807\u5DE6\u79FB\u4E00\u8BCD",
    "ck.op.cursorRight": "\u5149\u6807\u53F3\u79FB\u4E00\u8BCD",
    "ck.op.lineStart": "\u5230\u884C\u9996",
    "ck.op.lineEnd": "\u5230\u884C\u5C3E",
    "ck.spaceTitle": "\u957F\u6309\u7A7A\u683C\u52A8\u4F5C",
    "ck.space.edit": "\u7F16\u8F91\u52A8\u4F5C",
    "ck.space.hint": "\u957F\u6309\u7A7A\u683C\u89E6\u53D1\u8BE5\u52A8\u4F5C\uFF08350ms\uFF09\uFF1B\u8BED\u97F3\u8F93\u5165\u4E3A\u6309\u4F4F\u8BF4\u8BDD\uFF0C\u5176\u4F59\u52A8\u4F5C\u89E6\u53D1\u4E00\u6B21\u3002",
    "ck.space.face": "\u7A7A\u683C\u952E\u9762\u6587\u6848",
    "ck.space.faceHint": "\u663E\u793A\u5728\u7A7A\u683C\u952E\u4E0A\uFF08\u5982 \u{1F4CB} \u6216\u300C\u526A\u8D34\u677F\u300D\uFF0C\u6700\u591A 8 \u5B57\uFF09",
    "ck.f.panel.pick": "\u6253\u5F00\u54EA\u4E2A\u9762\u677F",
    "ck.f.text": "\u8981\u8F93\u5165\u7684\u6587\u672C\uFF0C\u5982 :w \u6216 me@example.com",
    "ck.f.mods": "\u4FEE\u9970\u952E",
    "ck.f.key": "\u6309\u952E",
    "ck.f.open.uri": "\u94FE\u63A5\u5730\u5740",
    "ck.f.setting.pick": "\u8981\u6253\u5F00\u7684\u8BBE\u7F6E\u9879",
    "ck.f.open.placeholder": "\u5982 doubao:// \u6216 https://fanyi.baidu.com",
    "ck.f.open.presets": "\u5E38\u7528\u9884\u8BBE",
    "ck.f.open.presetPick": "\u9009\u62E9\u5E38\u7528\u5E94\u7528\u2026",
    "ck.f.open.hint": "\u652F\u6301\u5E94\u7528\u4E13\u5C5E\u94FE\u63A5\uFF08\u9700\u5DF2\u5B89\u88C5\u8BE5\u5E94\u7528\uFF09\u6216\u7F51\u9875\u5730\u5740\uFF1B\u70B9\u51FB\u540E\u5207\u5230\u76EE\u6807\u5E94\u7528\u3001\u952E\u76D8\u6536\u8D77\u3002\u4E0D\u652F\u6301 intent:// \u7B49\u94FE\u63A5\uFF1B\u9700\u952E\u76D8 3.73.22+\uFF08App 1.3.4 \u540E\u968F\u70ED\u66F4/\u5347\u7EA7\u53EF\u7528\uFF09\u3002",
    "ck.f.dsl": "DSL\uFF08\u5982 [esc]ggVGD \u6216 [open:doubao://]\uFF09",
    "ck.help.aria": "DSL \u8BF4\u660E",
    "ck.help.dsl": "<b>\u70B9\u4E86\u8FD9\u9897\u952E\u4F1A\u53D1\u751F\u4EC0\u4E48\uFF0C\u6309\u987A\u5E8F\u5199\u4E0B\u6765\u5C31\u884C\uFF1A</b><br>\xB7 \u8981\u6253\u5B57\uFF0C\u76F4\u63A5\u5199\uFF1A<code>:w</code>\uFF08\u8F93\u5165 :w\uFF09\u3001<code>me@example.com</code>\uFF08\u8F93\u5165\u90AE\u7BB1\uFF09<br>\xB7 \u6309\u4E00\u4E2A\u952E\uFF0C\u5957\u4E0A\u65B9\u62EC\u53F7\uFF1A<code>[esc]</code>\uFF08Esc\uFF09\u3001<code>[f5]</code>\uFF08F5 \u5237\u65B0\uFF09\u3001<code>[backspace]</code>\uFF08\u9000\u683C\uFF09<br>\xB7 \u7EC4\u5408\u952E\uFF1A<code>[ctrl+s]</code>\uFF08\u4FDD\u5B58\uFF09\u3001<code>[alt+f4]</code>\uFF08\u5173\u7A97\u53E3\uFF09<br>\xB7 \u6253\u5F00\u5E94\u7528/\u7F51\u9875\uFF1A<code>[open:doubao://]</code>\uFF08\u8C46\u5305\uFF09\u3001<code>[open:https://fanyi.baidu.com]</code>\uFF08\u7F51\u9875\u7FFB\u8BD1\uFF09<br>\xB7 \u8FDE\u7740\u6765\uFF1A<code>[esc]ggVGD</code> = Vim \u5220\u9664\u5168\u6587\uFF08Esc\uFF0Cgg \u56DE\u5F00\u5934\uFF0CVG \u9009\u5230\u7ED3\u5C3E\uFF0CD \u5220\u9664\uFF09<br>\xB7 \u53EF\u7528\u7684\u952E\u540D\uFF1Aesc\u3001tab\u3001enter\u3001space\u3001backspace\u3001del\u3001left\u3001right\u3001up\u3001down\u3001home\u3001end\u3001pgup\u3001pgdn\u3001f1\uFF5Ef12\u3001\u5355\u5B57\u6BCD\u3001\u6570\u5B57\uFF1B\u7EC4\u5408\u952E\u7684\u4FEE\u9970\uFF1Actrl\u3001alt\u3001shift\u3001win\u3002",
    "ck.f.span": "\u5BBD\u5EA6",
    "ck.f.color": "\u989C\u8272",
    "ck.color.default": "\u9ED8\u8BA4",
    "ck.color.custom": "\u81EA\u5B9A\u4E49",
    "ck.color.hex": "\u8272\u53F7",
    "ck.color.hexLabel": "\u952E\u5E3D\u8272\u53F7",
    "ck.color.hue": "\u8272\u8C03",
    "ck.color.sat": "\u9971\u548C\u5EA6",
    "ck.f.note": "\u5907\u6CE8",
    "ck.f.note.hint": "\u957F\u6309\u952E\u9762\u65F6\u663E\u793A",
    "ck.editBar.hint": "\u62D6\u52A8\u79FB\u52A8\uFF0C\u70B9x\u5220\u9664",
    "ck.editBar.done": "\u5B8C\u6210",
    "ck.common": "\u5E38\u7528",
    "ck.common.hint": "\u9009\u4E00\u9897\u76F4\u63A5\u586B\u597D\uFF0C\u6539\u6539\u5C31\u80FD\u7528",
    "ck.err.t": "\u952E\u9762\u4E0D\u80FD\u4E3A\u7A7A",
    "ck.err.tap": "\u70B9\u51FB\u8F93\u51FA\u4E0D\u80FD\u4E3A\u7A7A",
    "ck.err.open": "\u94FE\u63A5\u9700\u4E3A http(s) \u7F51\u9875\u5730\u5740\u6216\u5E94\u7528\u94FE\u63A5\uFF08\u5982 doubao://\uFF09\uFF0C\u4E14\u4E0D\u80FD\u542B\u7A7A\u683C",
    "ck.err.setting": "\u8BF7\u9009\u62E9\u8981\u6253\u5F00\u7684\u8BBE\u7F6E\u9879",
    "ck.err.panel": "\u9762\u677F\u76EE\u6807\u65E0\u6548",
    "ck.err.tapLong": "\u70B9\u51FB\u8F93\u51FA\u8D85\u8FC7 128 \u5B57\u7B26\uFF08\u94FE\u63A5\u592A\u957F\uFF09\uFF0C\u8BF7\u6362\u77ED\u94FE\u63A5",
    "ck.note.saved": "\u5DF2\u4FDD\u5B58\uFF0C\u952E\u76D8\u4E0B\u6B21\u8F7D\u5165\u65F6\u751F\u6548",
    "ck.note.deleted": "\u5DF2\u5220\u9664",
    "ck.row": "\u7B2C {n} \u884C",
    "ck.none": "\uFF08\u7A7A\u884C\uFF09",
    "ck.align.aria": "\u884C\u5BF9\u9F50",
    "ck.align.left": "\u5DE6",
    "ck.align.center": "\u4E2D",
    "ck.align.right": "\u53F3",
    "ck.dirty": "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539",
    "ck.back.title": "\u6B63\u5728\u7F16\u8F91\u6309\u952E",
    "ck.back.text": "\u8FD8\u5728\u7F16\u8F91\u6A21\u5F0F\uFF08\u62D6\u52A8\u79FB\u52A8\u3001\u70B9x\u5220\u9664\uFF09\u3002\u653E\u5F03\u7F16\u8F91\u8FD8\u662F\u7EE7\u7EED\uFF1F",
    "ck.back.go": "\u653E\u5F03\u7F16\u8F91",
    "ck.back.stay": "\u7EE7\u7EED\u7F16\u8F91",
    "ck.del.title": "\u5220\u9664\u6309\u952E",
    "ck.del.confirm": "\u786E\u5B9A\u5220\u9664\u300C{t}\u300D\u5417\uFF1F",
    "ck.del.go": "\u5220\u9664",
    "ck.del.cancel": "\u53D6\u6D88",
    "ck.add.aria": "\u7B2C {n} \u884C\u6DFB\u52A0\u6309\u952E",
    "ck.newTitle": "\u65B0\u5EFA\u6309\u952E",
    "ck.cancel": "\u53D6\u6D88",
    "ck.confirmLeave": "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u79BB\u5F00\u5C06\u4E22\u5931\u3002\u4ECD\u8981\u79BB\u5F00\u5417\uFF1F",
    "ck.confirmLeaveTitle": "\u672A\u4FDD\u5B58\u7684\u4FEE\u6539",
    "ck.leaveGo": "\u4E22\u5F03\u5E76\u79BB\u5F00",
    "ck.leaveStay": "\u7559\u4E0B",
    "input.keyboards.title": "\u952E\u76D8\u9009\u62E9",
    "input.keyboards.manage": "\u7BA1\u7406\u952E\u76D8\u4E0E\u5FEB\u6377\u5207\u6362",
    "input.keyboards.manageHint": "\u957F\u6309\u83DC\u5355\u5217\u51FA\u54EA\u4E9B\u952E\u76D8\u3001\u5FEB\u6377\u5207\u6362\u952E\u5728\u4E24\u4E2A\u952E\u76D8\u95F4\u5F80\u8FD4\u3002",
    "input.keyboards.badge": "\u83DC\u5355",
    "input.keyboards.enable": "\u957F\u6309\u83DC\u5355\u91CC\u5217\u51FA\u54EA\u4E9B\u952E\u76D8",
    "input.keyboards.hint": "\u52FE\u9009\u7684\u952E\u76D8\u51FA\u73B0\u5728\u957F\u6309\u5207\u6362\u952E\u7684\u83DC\u5355\u91CC\uFF0C\u884C\u5E8F\u5373\u83DC\u5355\u987A\u5E8F\uFF08\u7BAD\u5934\u8C03\u6574\uFF09\uFF1B\u4E0D\u52FE\u7684\u8FD8\u53EF\u4EE5\u5728\u83DC\u5355\u91CC\u4E34\u65F6\u52FE\u56DE\u6765\u3002\u6539\u52A8\u5373\u65F6\u751F\u6548\u3002",
    "input.keyboards.drag": "\u62D6\u52A8\u6392\u5E8F",
    "input.keyboards.moveUp": "\u4E0A\u79FB",
    "input.keyboards.moveDown": "\u4E0B\u79FB",
    "input.english.enable": "\u82F1\u6587\u8BCD\u76F4\u51FA",
    "input.english.hint": "\u62FC\u97F3\u7EC4\u5408\u91CC\u76F4\u63A5\u6572 github\u3001ios\u3001android \u8FD9\u7C7B\u82F1\u6587\u8BCD\u51FA\u5019\u9009\uFF0C\u4E0D\u7528\u5207\u82F1\u6587\u6A21\u5F0F\uFF1B\u5168\u62FC\u548C\u53CC\u62FC\u901A\u7528\u3002",
    "input.phrases.wxSlash": "\u4E07\u8C61 / \u952E\u529F\u80FD\u5F15\u5BFC",
    "input.phrases.wxSlashHint": "\u6362\u88C5\u4E07\u8C61\u62FC\u97F3\u65B9\u6848\u540E\uFF0C\u5F00\u542F\u53EF\u5728\u5168\u62FC/\u53CC\u62FC\u952E\u76D8\u7528 / \u8FDB\u5165\u7B26\u53F7\u5F15\u5BFC\uFF08\u5982 /sj \u51FA\u65F6\u95F4\u7C7B\u5B57\u7B26\u3001/rq \u51FA\u65E5\u671F\u7C7B\u5B57\u7B26\uFF0C\u6765\u81EA\u5185\u7F6E\u9759\u6001\u7B26\u53F7\u8868\uFF0C\u4E0D\u662F\u4E07\u8C61\u65B9\u6848\u7684\u52A8\u6001\u65F6\u95F4\uFF09\uFF1B\u97F3\u5F62\u3001\u4E5D\u5BAB\u3001\u624B\u5199\u3001\u82F1\u6587\u952E\u76D8\u4E0D\u652F\u6301\uFF0C/ \u5728\u8FD9\u4E9B\u952E\u76D8\u76F4\u63A5\u4E0A\u5C4F\uFF1B\u5173\u95ED\u5219 / \u76F4\u63A5\u4E0A\u5C4F\u3002",
    "input.keyboards.pairA": "\u5FEB\u6377\u5207\u6362 \xB7 \u7B2C\u4E00\u4E2A",
    "input.keyboards.pairB": "\u5FEB\u6377\u5207\u6362 \xB7 \u7B2C\u4E8C\u4E2A",
    "input.keyboards.pairHint": "\u70B9\u5207\u6362\u952E\u5728\u4E24\u4E2A\u952E\u76D8\u4E4B\u95F4\u5F80\u8FD4\uFF1B\u9009\u6700\u5E38\u7528\u7684\u4E24\u4E2A\u3002",
    "input.keyboards.saved": "\u5DF2\u4FDD\u5B58\uFF0C\u952E\u76D8\u5373\u65F6\u751F\u6548",
    "input.feel.bubbleLinger": "\u6C14\u6CE1\u505C\u7559\u65F6\u957F",
    "input.feel.bubbleLingerHint": "\u677E\u624B\u540E\u6C14\u6CE1\u591A\u505C\u7559\u4E00\u4F1A\u513F\u518D\u6D88\u5931\uFF0C\u770B\u5F97\u6E05\u6309\u4E86\u4EC0\u4E48\uFF1B0 \u4E3A\u7ACB\u5373\u6D88\u5931\u3002",
    "search.placeholder": "\u641C\u7D22\u8BBE\u7F6E\uFF1A\u9AD8\u5EA6\u3001\u6C14\u6CE1\u3001\u53CC\u62FC\u3001\u8BCD\u5E93\u2026",
    "search.noResults": "\u6CA1\u6709\u5339\u914D\u7684\u8BBE\u7F6E\u9879",
    "action.saveCustom": "\u4FDD\u5B58\u5B9A\u5236",
    "action.insertTemplate": "\u63D2\u5165\u5B9E\u7528\u6A21\u677F",
    "action.insertTemplateDev": "\u5F00\u53D1\u8005\u6A21\u677F",
    "action.viewDocs": "\u67E5\u770B\u8BF4\u660E",
    "voice.models.title": "\u9EA6\u514B\u98CE\u4E0E\u8BED\u97F3\u6A21\u578B",
    "voice.models.badge": "\u8BED\u97F3",
    "voice.backend.label": "\u6A21\u578B\u6765\u6E90",
    "voice.backend.auto": "\u5B89\u88C5\u5305\u4F18\u5148",
    "voice.backend.remote": "\u4F7F\u7528\u4E0B\u8F7D\u6A21\u578B",
    "voice.backend.hint": "\u5207\u6362\u540E\u4E0B\u6B21\u5F55\u97F3\u751F\u6548\u3002\u9009\u62E9\u4E0B\u8F7D\u6A21\u578B\u540E\uFF0C\u8BF7\u5728\u4E0B\u65B9\u8865\u9F50\u6240\u9700\u6A21\u578B\u518D\u5F55\u97F3\u3002",
    "voice.downloadSource.label": "\u6A21\u578B\u4E0B\u8F7D\u6E90",
    "voice.downloadSource.pick": "\u70B9\u9009\u9879\u5373\u4FDD\u5B58\uFF1B\u300C\u6D4B\u901F\u300D\u6BD4\u8F83\u5404\u6E90\u5EF6\u8FDF",
    "voice.downloadSource.speedTest": "\u6D4B\u901F",
    "voice.downloadSource.testing": "\u6D4B\u901F\u4E2D\u2026",
    "voice.downloadSource.gitee": "Gitee \u955C\u50CF\uFF08\u9ED8\u8BA4\uFF09",
    "voice.downloadSource.github": "GitHub \u76F4\u8FDE",
    "voice.downloadSource.ghproxy": "GitHub\uFF08gh-proxy \u52A0\u901F\uFF09",
    "voice.downloadSource.fastest": "\u6700\u5FEB \u2713",
    "voice.downloadSource.unavailable": "\u4E0D\u53EF\u7528",
    "voice.downloadSource.custom": "\u81EA\u5B9A\u4E49\u6E90",
    "voice.downloadSource.customPlaceholder": "\u4F8B\u5982\uFF1Ahttps://example.com/download/handwriting/\uFF08\u5355\u4E2A\u6A21\u578B\u7684\u9891\u9053\u76EE\u5F55\uFF09",
    "voice.downloadSource.save": "\u4FDD\u5B58\u81EA\u5B9A\u4E49\u6E90",
    "voice.downloadSource.hint": "\u4E0B\u8F7D\u540E\u4F1A\u6821\u9A8C\u6587\u4EF6\u5B8C\u6574\u6027\uFF1B\u9ED8\u8BA4\u8D70 Gitee \u56FD\u5185\u955C\u50CF\uFF0C\u4E5F\u53EF\u9009 GitHub \u76F4\u8FDE\u6216 gh-proxy \u52A0\u901F\u3002",
    "voice.holdSpace": "\u957F\u6309\u7A7A\u683C",
    "voice.holdSpaceHint": "\u957F\u6309\u7A7A\u683C\u952E\u89E6\u53D1\u7684\u52A8\u4F5C\uFF1B\u300C\u8BED\u97F3\u8F93\u5165\u300D\u663E\u793A\u9EA6\u514B\u98CE\uFF0C\u300C\u5173\u95ED\u300D\u5219\u957F\u6309\u65E0\u54CD\u5E94\u3002",
    "voice.hold.voice": "\u8BED\u97F3\u8F93\u5165",
    "voice.hold.clipboard": "\u526A\u8D34\u677F\u9762\u677F",
    // #65：旧文案「表情/常用面板」承诺了表情，但该面板只有常用语
    // ——表情改由独立的「表情面板」目标直达（[panel:emoji]）。
    "voice.hold.favorites": "\u5E38\u7528\u8BED\u9762\u677F",
    "voice.hold.emoji": "\u8868\u60C5\u9762\u677F",
    "voice.hold.edit": "\u5FEB\u6377\u7F16\u8F91\u9762\u677F",
    "voice.hold.control": "\u63A7\u5236\u952E\u5C42",
    "voice.hold.custom": "\u5B9A\u5236\u952E\u9762\u677F",
    "voice.hold.none": "\u5173\u95ED",
    "voice.mic.permission": "\u9EA6\u514B\u98CE\u6743\u9650",
    "voice.mic.hint": "\u8BED\u97F3\u8F93\u5165\u5FC5\u9700\uFF0C\u5168\u7A0B\u672C\u5730\u5904\u7406",
    "voice.mic.action": "\u53BB\u6388\u6743",
    "voice.models.note": "\u5B8C\u6574\u5B89\u88C5\u5305\u5DF2\u5185\u7F6E\u5168\u90E8\u6A21\u578B\uFF1B\u7CBE\u7B80\u5B89\u88C5\u5305\u5728\u6B64\u6309\u9700\u4E0B\u8F7D\uFF08\u65AD\u70B9\u7EED\u4F20\uFF0C\u9010\u6587\u4EF6\u6821\u9A8C\uFF09\u3002",
    "voice.asr.title": "\u8BED\u97F3\u8BC6\u522B\u8BBE\u7F6E",
    "voice.asr.badge": "\u8BC6\u522B",
    "voice.asr.stripPeriod": "\u53BB\u6389\u53E5\u5C3E\u53E5\u53F7",
    "voice.asr.idleUnload": "\u7A7A\u95F2\u65F6\u91CA\u653E\u8BED\u97F3\u6A21\u578B",
    "voice.asr.idleUnloadHint": "\u9ED8\u8BA4\u5173\u95ED\uFF1B\u5F00\u542F\u540E\u7A7A\u95F2 5 \u5206\u949F\u91CA\u653E\uFF0C\u4E0B\u6B21\u8BED\u97F3\u9700\u8981\u91CD\u65B0\u52A0\u8F7D",
    "voice.asr.stripHint": "\u95EE\u53F7\u3001\u53F9\u53F7\u4FDD\u7559\uFF1B\u5173\u95ED\u540E\u4FDD\u7559\u6A21\u578B\u8F93\u51FA",
    "voice.asr.numItn": "\u6570\u5B57\u5199\u6210\u963F\u62C9\u4F2F\u6570\u5B57",
    "voice.asr.numItnHint": "\u6570\u91CF\u3001\u65E5\u671F\u3001\u91D1\u989D\u3001\u5C0F\u6570\u81EA\u52A8\u8F6C\u6362\uFF08\u4E09\u4E2A \u2192 3\u4E2A\uFF09\uFF1B\u9ED8\u8BA4\u5173\u95ED",
    "voice.asr.hotwordsLabel": "\u70ED\u8BCD\uFF08\u4E00\u884C\u4E00\u4E2A\uFF0C\u53EF\u586B\u4E2D\u6587\u6216\u82F1\u6587\uFF1B\u8BC6\u522B\u4F18\u5148\u8003\u8651\u8FD9\u4E9B\u8BCD\uFF09",
    "voice.asr.hotwordsWeightHint": "\u67D0\u4E2A\u8BCD\u603B\u8BC6\u522B\u9519\uFF1F\u5728\u8BCD\u540E\u9762\u52A0\u300C:\u6570\u5B57\u300D\u52A0\u5927\u7EA0\u6B63\u529B\u5EA6\uFF0C\u5982 \u59DA\u7A0B:10\u3002\u8303\u56F4 1~20\uFF08\u6700\u591A\u4E00\u4F4D\u5C0F\u6570\uFF09\uFF0C\u4E0D\u586B\u7528\u9ED8\u8BA4\u529B\u5EA6\uFF1B\u6570\u5B57\u8FC7\u5927\u53EF\u80FD\u51FA\u73B0\u91CD\u590D\u8BCD\u6216\u8BEF\u8BC6\u522B\u5176\u4ED6\u8BCD\uFF0C\u8C03\u5C0F\u5373\u53EF\u3002",
    "voice.asr.hotwordsPlaceholder": "\u4F8B\u5982\uFF1A\n\u502A\u59AE\n\u59DA\u7A0B:10 \u2190 \u603B\u8BC6\u522B\u9519\u65F6\u52A0\u6743\u91CD\nGPU",
    "action.saveAsr": "\u4FDD\u5B58\u8BC6\u522B\u8BBE\u7F6E",
    "update.title": "\u952E\u76D8\u70ED\u66F4\u65B0",
    "update.badge": "\u66F4\u65B0",
    "update.note": "\u4EC5\u66FF\u6362 HTML/CSS/JS\uFF0C\u4E0D\u6D89\u53CA\u5F15\u64CE\u3001\u8BCD\u5178\u4E0E\u8BED\u97F3\u6A21\u578B\u3002",
    "update.sourceLabel": "\u66F4\u65B0\u6E90\u5730\u5740\uFF08metainfo.json\uFF09",
    "update.sourcePlaceholder": "https://example.com/feelime/metainfo.json",
    "update.autoCheck": "\u542F\u52A8\u65F6\u81EA\u52A8\u68C0\u67E5\u66F4\u65B0",
    "update.autoCheckHint": "\u6BCF\u5929\u6700\u591A\u68C0\u67E5\u4E00\u6B21\uFF1B\u6E05\u7A7A\u66F4\u65B0\u6E90\u540E\u81EA\u52A8\u68C0\u67E5\u505C\u7528",
    "update.urlLabel": "\u952E\u76D8\u5305\u5730\u5740\uFF08\u8054\u7F51\u4E0B\u8F7D\uFF09",
    "update.urlPlaceholder": "https://example.com/feelime-keyboard.zip",
    "action.checkUpdate": "\u68C0\u67E5\u66F4\u65B0",
    "action.install": "\u8054\u7F51\u4E0B\u8F7D\u5B89\u88C5",
    "action.importLocal": "\u4ECE\u672C\u5730 ZIP \u5BFC\u5165",
    "action.restore": "\u6062\u590D\u5185\u7F6E",
    "update.localHint": "\u4ECE\u672C\u5730 ZIP \u5BFC\u5165\u4E0D\u9700\u8981\u7F51\u7EDC\uFF0C\u4ECD\u4F1A\u6821\u9A8C\u7B7E\u540D\u548C\u517C\u5BB9\u6027\u3002",
    "update.unsigned": "\u26A0 \u672A\u7B7E\u540D\u952E\u76D8\u62E5\u6709 IME \u6743\u9650\uFF08\u4EC5\u9650\u8C03\u8BD5\u6784\u5EFA\uFF09",
    "update.sigConfirmed": "\u26A0 \u5F53\u524D\u952E\u76D8\uFF1A\u7B7E\u540D\u4E0D\u7B26\uFF08\u5DF2\u624B\u52A8\u786E\u8BA4\u5BFC\u5165\uFF09",
    "page.backup": "\u5907\u4EFD\u4E0E\u6062\u590D",
    "backup.title": "\u5907\u4EFD\u4E0E\u6062\u590D",
    "backup.badge": "\u5907\u4EFD",
    "backup.note": "\u628A\u8BBE\u7F6E\u3001\u5E38\u7528\u8BED\u3001\u81EA\u5B9A\u4E49\u952E\u4F4D\u4E0E\u8F93\u5165\u8BCD\u5E93\u6253\u5305\u6210\u4E00\u4E2A JSON \u6587\u4EF6\uFF0C\u65B9\u4FBF\u6362\u673A\u6216\u624B\u5DE5\u7F16\u8F91\u3002",
    "backup.export": "\u5BFC\u51FA\u6570\u636E",
    "backup.import": "\u5BFC\u5165\u6570\u636E",
    "backup.consent.title": "\u786E\u8BA4\u8986\u76D6",
    "backup.consent.badge": "\u8986\u76D6\u63D0\u793A",
    "backup.consent.message": "\u5BFC\u5165\u4F1A\u8986\u76D6\u5F53\u524D\u7684\u8BBE\u7F6E\u3001\u5E38\u7528\u8BED\u3001\u81EA\u5B9A\u4E49\u952E\u4F4D\u4E0E\u8BCD\u5E93\uFF0C\u4E14\u65E0\u6CD5\u64A4\u9500\u3002\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F",
    "backup.consent.cancel": "\u53D6\u6D88",
    "webdav.title": "\u4E91\u7AEF\u5907\u4EFD\uFF08WebDAV\uFF09",
    "webdav.note": "\u5907\u4EFD\u4E0A\u4F20\u5230\u4F60\u81EA\u5DF1\u7684 WebDAV \u7F51\u76D8\uFF08\u5982\u575A\u679C\u4E91\uFF09\u3002\u6BCF\u6B21\u5907\u4EFD\u90FD\u662F\u5E26\u65F6\u95F4\u6233\u7684\u65B0\u6587\u4EF6\uFF0C\u4E0D\u8986\u76D6\u5386\u53F2\uFF1B\u6062\u590D\u65F6\u4ECE\u5217\u8868\u91CC\u6311\u4E00\u4EFD\u4E0B\u8F7D\u3002\u51ED\u636E\u53EA\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E0D\u8FDB\u5907\u4EFD\u6587\u4EF6\u3002",
    "webdav.urlLabel": "\u670D\u52A1\u5668\u5730\u5740",
    "webdav.dirLabel": "\u5B50\u76EE\u5F55",
    "webdav.dir": "feelime-backup",
    "webdav.dirHint": "\u5907\u4EFD\u6587\u4EF6\u5B58\u653E\u5728\u670D\u52A1\u5668\u5730\u5740\u4E0B\u7684\u8FD9\u4E2A\u5B50\u76EE\u5F55\u91CC\u3002\u90E8\u5206\u670D\u52A1\u5546\uFF08\u5982\u575A\u679C\u4E91\uFF09\u4E0D\u652F\u6301\u628A\u6587\u4EF6\u76F4\u63A5\u5B58\u5230\u6839\u76EE\u5F55\uFF0C\u5EFA\u8BAE\u4FDD\u7559\u5B50\u76EE\u5F55\uFF1B\u7559\u7A7A\u5219\u5B58\u5230\u6839\u76EE\u5F55\u3002",
    "webdav.providerLabel": "\u670D\u52A1\u5546",
    "webdav.provider.jg": "\u575A\u679C\u4E91",
    "webdav.provider.inf": "InfiniCLOUD",
    "webdav.provider.nc": "Nextcloud / \u7FA4\u6656",
    "webdav.provider.custom": "\u81EA\u5B9A\u4E49\u2026",
    "webdav.url": "https://dav.jianguoyun.com/dav/feelime/",
    "webdav.userLabel": "\u7528\u6237\u540D",
    "webdav.user": "\u7528\u6237\u540D",
    "webdav.passLabel": "\u5E94\u7528\u5BC6\u7801",
    "webdav.pass": "\u5E94\u7528\u5BC6\u7801\uFF08\u4E0D\u662F\u767B\u5F55\u5BC6\u7801\uFF09",
    "webdav.save": "\u4FDD\u5B58\u5E76\u6D4B\u8BD5",
    "webdav.backup": "\u7ACB\u5373\u5907\u4EFD",
    "webdav.restoreBtn": "\u6062\u590D\u4E91\u7AEF\u5907\u4EFD",
    "webdav.backupModal.title": "\u5907\u4EFD\u5230\u4E91\u7AEF",
    "webdav.backupModal.hint": "\u5C06\u4E0A\u4F20\u4E00\u4EFD\u65B0\u5907\u4EFD\u6587\u4EF6\uFF0C\u6587\u4EF6\u540D\u9ED8\u8BA4\u6309\u5F53\u524D\u65F6\u95F4\u751F\u6210\uFF0C\u53EF\u4FEE\u6539\u3002",
    "webdav.backupModal.nameLabel": "\u5907\u4EFD\u6587\u4EF6\u540D",
    "webdav.backupModal.go": "\u5F00\u59CB\u5907\u4EFD",
    "webdav.backupModal.dup": "\u26A0 \u4E91\u7AEF\u5DF2\u6709\u540C\u540D\u6587\u4EF6\uFF0C\u4FDD\u5B58\u5C06\u8986\u76D6\u5B83",
    "webdav.backupModal.dupBtn": "\u8986\u76D6\u540C\u540D\u6587\u4EF6",
    "webdav.backupModal.unknownDup": "\u672A\u80FD\u6838\u5BF9\u4E91\u7AEF\u662F\u5426\u91CD\u540D\uFF1B\u82E5\u91CD\u540D\uFF0C\u4E0A\u4F20\u65F6\u4F1A\u88AB\u670D\u52A1\u5668\u62E6\u622A",
    "webdav.backupModal.sending": "\u4E0A\u4F20\u4E2D\u2026",
    "webdav.backupModal.badName": "\u6587\u4EF6\u540D\u9700\u4EE5 feelime-backup- \u5F00\u5934\u3001\u4EE5 .json \u7ED3\u5C3E\uFF0C\u4E14\u4E0D\u542B /\u3001\u7A7A\u683C\u6216 +",
    "webdav.restoreModal.title": "\u6062\u590D\u4E91\u7AEF\u5907\u4EFD",
    "webdav.restoreModal.back": "\u8FD4\u56DE",
    "webdav.empty": "\u4E91\u7AEF\u8FD8\u6CA1\u6709\u5907\u4EFD\u3002",
    "webdav.consent.title": "\u786E\u8BA4\u6062\u590D",
    "webdav.consent.message": "\u6062\u590D\u4F1A\u8986\u76D6\u5F53\u524D\u7684\u8BBE\u7F6E\u3001\u5E38\u7528\u8BED\u3001\u81EA\u5B9A\u4E49\u952E\u4F4D\u4E0E\u8BCD\u5E93\uFF0C\u4E14\u65E0\u6CD5\u64A4\u9500\u3002\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F",
    "webdav.consent.confirm": "\u6062\u590D\u8FD9\u4EFD\u5907\u4EFD",
    "webdav.note.testing": "\u8FDE\u63A5\u6D4B\u8BD5\u4E2D\u2026",
    "webdav.note.ok": "\u8FDE\u63A5\u6B63\u5E38",
    "webdav.note.backupOk": "\u5DF2\u5907\u4EFD\uFF1A{0}",
    "webdav.note.restoreOk": "\u5DF2\u6062\u590D\uFF1A{0}",
    "webdav.note.listing": "\u6B63\u5728\u62C9\u53D6\u4E91\u7AEF\u5217\u8868\u2026",
    "webdav.note.backing": "\u6B63\u5728\u5907\u4EFD\u2026",
    "webdav.note.restoring": "\u6B63\u5728\u4E0B\u8F7D\u5E76\u6062\u590D\u2026",
    "webdav.err.AUTH": "\u8BA4\u8BC1\u5931\u8D25\uFF1A\u7528\u6237\u540D\u6216\u5BC6\u7801\u4E0D\u5BF9",
    "webdav.err.NOT_FOUND": "\u5730\u5740\u4E0D\u5B58\u5728\uFF08\u68C0\u67E5\u8DEF\u5F84\uFF09",
    "webdav.err.NO_DAV": "\u8BE5\u5730\u5740\u4E0D\u652F\u6301 WebDAV",
    "webdav.err.EMPTY_URL": "\u5148\u586B\u670D\u52A1\u5668\u5730\u5740",
    "webdav.err.NETWORK": "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25",
    "webdav.err.TOO_LARGE": "\u6587\u4EF6\u8D85\u51FA\u5927\u5C0F\u4E0A\u9650",
    "webdav.err.TOO_LONG": "\u8F93\u5165\u8FC7\u957F",
    "webdav.err.BAD_NAME": "\u5907\u4EFD\u540D\u4E0D\u5408\u6CD5",
    "webdav.err.CONFLICT": "\u4E91\u7AEF\u5DF2\u6709\u540C\u540D\u6587\u4EF6",
    "webdav.err.RESTORE_FAILED": "\u6062\u590D\u5931\u8D25\uFF1A\u5907\u4EFD\u5185\u5BB9\u672A\u901A\u8FC7\u6821\u9A8C",
    "webdav.err.INTERNAL": "\u5185\u90E8\u9519\u8BEF",
    "webdav.err.GENERIC": "\u64CD\u4F5C\u5931\u8D25",
    "webdav.size.kb": "{0} KB",
    "backup.consent.confirm": "\u9009\u62E9\u6587\u4EF6\u5BFC\u5165",
    "backup.done.export": "\u5DF2\u5BFC\u51FA\u5230\u6240\u9009\u4F4D\u7F6E\u3002",
    "backup.done.import": "\u5BFC\u5165\u5B8C\u6210\uFF0C\u6B63\u5728\u751F\u6548\u3002",
    "backup.failed.export": "\u5BFC\u51FA\u5931\u8D25",
    "backup.failed.import": "\u5BFC\u5165\u5931\u8D25",
    "backup.error.FORMAT": "\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JSON\u3002",
    "backup.error.KIND": "\u8FD9\u4E0D\u662F Feelime \u5907\u4EFD\u6587\u4EF6\u3002",
    "backup.error.VERSION": "\u5907\u4EFD\u6587\u4EF6\u7248\u672C\u8F83\u65B0\uFF0C\u8BF7\u5148\u5347\u7EA7 Feelime\u3002",
    "backup.error.IO_ERROR": "\u8BFB\u53D6\u6216\u5199\u5165\u6587\u4EF6\u5931\u8D25\u3002",
    "backup.error.PATH": "\u5907\u4EFD\u91CC\u5305\u542B\u4E0D\u5B89\u5168\u7684\u8DEF\u5F84\uFF0C\u5DF2\u62D2\u7EDD\u3002",
    "backup.error.BASE64": "\u5907\u4EFD\u4E2D\u7684\u8BCD\u5E93\u6570\u636E\u635F\u574F\u3002",
    "kbSig.title": "\u952E\u76D8\u5305\u7B7E\u540D\u4E0D\u7B26",
    "kbSig.badge": "\u5B89\u5168\u63D0\u793A",
    "kbSig.message": "\u8FD9\u4E2A\u952E\u76D8\u5305\u7684\u7B7E\u540D\u4E0E\u5B98\u65B9\u53D1\u5E03\u5BC6\u94A5\u4E0D\u4E00\u81F4\uFF08\u53EF\u80FD\u662F\u81EA\u6539\u5305\u6216\u7B2C\u4E09\u65B9\u5305\uFF09\u3002\u4ECD\u8981\u5BFC\u5165\u5C06\u4EE5\u201C\u5DF2\u786E\u8BA4\u7B7E\u540D\u4E0D\u7B26\u201D\u7684\u72B6\u6001\u8FD0\u884C\uFF0C\u91CD\u542F\u540E\u4ECD\u751F\u6548\u3002",
    "kbSig.cancel": "\u53D6\u6D88",
    "kbSig.confirm": "\u4ECD\u8981\u5BFC\u5165",
    "about.versionTitle": "\u7248\u672C\u4FE1\u606F",
    "about.badge": "\u4FE1\u606F",
    "action.copyVersion": "\u590D\u5236\u7248\u672C\u4FE1\u606F",
    "action.appStore": "\u5728 Google Play \u67E5\u770B\u5E94\u7528",
    "action.githubRepo": "GitHub \u4ED3\u5E93",
    "action.githubIssues": "\u95EE\u9898\u53CD\u9988",
    "action.feishuGroup": "\u52A0\u5165\u98DE\u4E66\u4EA4\u6D41\u7FA4",
    "action.checkUpdate": "\u68C0\u67E5\u66F4\u65B0",
    "action.checkUpdatePlay": "\u53BB Google Play \u66F4\u65B0",
    "action.dlThin": "\u4E0B\u8F7D\u7CBE\u7B80\u7248",
    "action.dlFull": "\u4E0B\u8F7D\u5B8C\u6574\u7248",
    "update.checking": "\u6B63\u5728\u68C0\u67E5\u66F4\u65B0\u2026",
    "update.upToDate": "\u5DF2\u662F\u6700\u65B0\u7248\u672C\uFF08v{0}\uFF09",
    "update.available": "\u53D1\u73B0\u65B0\u7248\u672C v{0}\uFF08\u5F53\u524D v{1}\uFF09\uFF0C\u5EFA\u8BAE\u4E0B\u8F7D\uFF1A",
    "update.failed": "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\uFF08\u6216\u5230 GitHub Releases \u9875\u67E5\u770B\uFF09",
    "about.copyHint": "\u53CD\u9988\u95EE\u9898\u65F6\u76F4\u63A5\u7C98\u8D34\uFF1B\u590D\u5236\u5185\u5BB9\u6807\u8BB0\u4E3A\u654F\u611F\uFF0C\u4E0D\u4F1A\u8FDB\u5165\u952E\u76D8\u526A\u8D34\u677F\u5386\u53F2\u3002",
    "about.offlineHint": "\u5168\u7A0B\u79BB\u7EBF\uFF1A\u8BED\u97F3\u8BC6\u522B\u4E0E\u6587\u5B57\u5019\u9009\u90FD\u4E0D\u8054\u7F51\u3002",
    "about.noticesTitle": "\u7B2C\u4E09\u65B9\u8BB8\u53EF\u4E0E\u7EC4\u4EF6\u8BF4\u660E",
    "about.legalBadge": "\u8BB8\u53EF",
    "about.expandNotices": "\u5C55\u5F00\u5B8C\u6574\u8BF4\u660E",
    "about.openLicenses": "\u5F00\u6E90\u8BB8\u53EF\u4E0E\u81F4\u8C22",
    "about.openLicensesHint": "\u7EC4\u4EF6\u6E05\u5355 \xB7 \u4E0A\u6E38\u94FE\u63A5 \xB7 \u5B8C\u6574\u8BF4\u660E",
    "page.licenses": "\u5F00\u6E90\u8BB8\u53EF\u4E0E\u81F4\u8C22",
    "nav.backAbout": "\u8FD4\u56DE\u5173\u4E8E",
    "licenses.self.title": "\u672C\u5E94\u7528\u8BB8\u53EF",
    "licenses.self.note": "Feelime \u6574\u4F53\u4EE5 GPL-3.0 \u63D0\u4F9B\uFF1A\u5185\u7F6E\u4E2D\u6587\u57FA\u5E95\u8BCD\u5E93\u6765\u81EA rime-frost\uFF08\u540C\u6837 GPL-3.0\uFF09\uFF0C\u5BF9\u5E94\u6E90\u7801\u5373\u5E94\u7528\u6E90\u7801\u4ED3\u5E93\u3002",
    "licenses.components.title": "\u81F4\u8C22\u7EC4\u4EF6",
    "licenses.components.badge": "\u5F00\u6E90",
    "licenses.thanks": "Feelime \u7AD9\u5728\u4EE5\u4E0B\u5F00\u6E90\u9879\u76EE\u7684\u80A9\u8180\u4E0A\uFF0C\u7279\u6B64\u81F4\u8C22\uFF1B\u70B9\u51FB\u94FE\u63A5\u53EF\u8DF3\u8F6C\u4E0A\u6E38\u3002",
    "licenses.full.title": "\u5B8C\u6574\u8BF4\u660E",
    "licenses.cmp.frost": "\u4E2D\u6587\u57FA\u5E95\u8BCD\u5E93\uFF08\u8BED\u6599\u8BCD\u9891\u91CD\u7EDF\uFF09",
    "licenses.cmp.librime": "\u4E2D\u6587\u8F93\u5165\u5F15\u64CE\uFF08\u5185\u5D4C Boost/OpenCC/marisa-trie \u7B49\uFF09",
    "licenses.cmp.rimedata": "Rime \u65B9\u6848\u4E0E\u6570\u636E\u6587\u4EF6",
    "licenses.cmp.sherpa": "\u79BB\u7EBF\u8BED\u97F3\u8BC6\u522B\u8FD0\u884C\u65F6\u4E0E\u6A21\u578B",
    "licenses.cmp.mozc": "\u65E5\u6587\u5F15\u64CE\uFF08Abseil/Protobuf/zlib \u7B49\u968F\u9644\uFF09",
    "licenses.cmp.hunspell": "\u62FC\u5199\u68C0\u67E5\uFF08\u6CD5/\u4FC4\u8BCD\u5178\u968F\u9644\uFF09",
    "licenses.cmp.okhttp": "\u6A21\u578B\u4E0B\u8F7D\u7F51\u7EDC\uFF08\u4EC5\u4E0B\u8F7D\u65F6\u8054\u7F51\uFF09",
    "licenses.cmp.othersName": "\u5176\u4F59\u5185\u5D4C\u4F9D\u8D56",
    "licenses.cmp.others": "Commons Compress\u3001yaml-cpp\u3001LevelDB\u3001RapidJSON \u7B49 \xB7 \u89C1\u4E0B\u65B9\u5B8C\u6574\u8BF4\u660E",
    "test.title": "\u8BD5\u8F93\u5165\u4E00\u6BB5\u6587\u5B57",
    "test.badge": "\u6D4B\u8BD5",
    "test.placeholder": "\u70B9\u8FD9\u91CC\u5524\u8D77 Feelime \u8BD5\u4E00\u8BD5",
    "test.note": "\u8F93\u5165\u5185\u5BB9\u53EA\u7559\u5728\u5F53\u524D\u7F16\u8F91\u6846\u4E2D\u3002",
    "model.builtIn": "\u5DF2\u968F\u5B89\u88C5\u5305\u63D0\u4F9B",
    "model.transferSize": "\u4E0B\u8F7D {download}\uFF08\u6574\u5305\u5305\u542B\u989D\u5916\u6587\u4EF6\uFF09\n\u5B89\u88C5\u540E\u5360\u7528 {installed}",
    "model.installed": "\u5DF2\u4E0B\u8F7D\uFF0C\u6821\u9A8C\u901A\u8FC7",
    "model.downloading": "\u4E0B\u8F7D\u4E2D {percent}%",
    "model.downloadingBytes": "\u4E0B\u8F7D\u4E2D {percent}%\uFF08{done} / {total}\uFF09",
    "model.broken": "\u6587\u4EF6\u5F02\u5E38\uFF0C\u8BF7\u91CD\u65B0\u4E0B\u8F7D",
    "model.missing": "\u672A\u4E0B\u8F7D\uFF08\u7EA6 {size}\uFF09",
    "model.download": "\u4E0B\u8F7D",
    "model.cancel": "\u53D6\u6D88",
    "model.remove": "\u5220\u9664",
    "model.redownload": "\u91CD\u65B0\u4E0B\u8F7D",
    "model.import": "\u5BFC\u5165\u6A21\u578B\u6587\u4EF6",
    "model.importing": "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u6587\u4EF6\u2026",
    "model.importValidating": "\u6B63\u5728\u9A8C\u8BC1\u6A21\u578B\u6587\u4EF6\u2026",
    "model.importInstalling": "\u6B63\u5728\u5B89\u88C5\u5DF2\u9A8C\u8BC1\u6A21\u578B\u2026",
    "model.importFormat": "\u4EC5\u652F\u6301\u4E0E\u5185\u7F6E\u6E05\u5355\u5BF9\u5E94\u7684\u5B98\u65B9\u6A21\u578B tar.bz2 \u6216 zip \u5F52\u6863\u3002",
    "model.title.streaming": "\u6D41\u5F0F\u8BED\u97F3\u8BC6\u522B\uFF08\u4E2D\u82F1\uFF09",
    "model.title.final": "\u6574\u53E5\u7EA0\u9519\u8BC6\u522B",
    "model.title.punctuation": "\u4E2D\u82F1\u6807\u70B9\u6062\u590D",
    "model.consent.title": "\u786E\u8BA4\u4E0B\u8F7D\u6D41\u91CF",
    "model.consent.badge": "\u6D41\u91CF\u63D0\u793A",
    "model.consent.message": "\u6A21\u578B\u201C{name}\u201D\u7EA6 {bytes}\uFF0C\u5F53\u524D\u7F51\u7EDC\u53EF\u80FD\u4EA7\u751F\u6D41\u91CF\u8D39\u7528\u3002\u662F\u5426\u7EE7\u7EED\uFF1F",
    "model.consent.cancel": "\u53D6\u6D88",
    "model.consent.confirm": "\u7EE7\u7EED\u4E0B\u8F7D",
    "update.sourceBuiltIn": "APK \u5185\u7F6E",
    "update.sourceHot": "\u70ED\u66F4\u65B0\u7248\u672C",
    "update.version": "\u7248\u672C\uFF1A{value}",
    "update.hash": "\u5185\u5BB9\u6821\u9A8C\uFF1A{value}\u2026",
    "update.state": "\u72B6\u6001\uFF1A{value}",
    "update.lastError": "\u6700\u8FD1\u9519\u8BEF\uFF1A{value}",
    "update.lastSuccess": "\u4E0A\u6B21\u6210\u529F\uFF1A{value}",
    "update.sourceStatus": "\u66F4\u65B0\u6E90\uFF1A{value}",
    "update.sourceDefault": "\u5B98\u65B9\u9ED8\u8BA4\u6E90",
    "update.sourceCustom": "\u7528\u6237\u8BBE\u7F6E",
    "update.sourceDisabled": "\u5DF2\u505C\u7528",
    "update.states.BUILT_IN": "\u5185\u7F6E",
    "update.states.DOWNLOADING": "\u4E0B\u8F7D\u4E2D",
    "update.states.VERIFYING": "\u6821\u9A8C\u4E2D",
    "update.states.CHECKING_COMPATIBILITY": "\u68C0\u67E5\u517C\u5BB9\u6027",
    "update.states.READY": "\u5DF2\u5C31\u7EEA",
    "update.states.ACTIVE": "\u5DF2\u542F\u7528",
    "update.states.ACTIVATING": "\u542F\u7528\u4E2D",
    "update.states.ROLLED_BACK": "\u5DF2\u56DE\u9000",
    "update.states.FAILED": "\u5931\u8D25",
    "about.appVersion": "App \u7248\u672C",
    "about.activeKeyboard": "\u952E\u76D8\u7248\u672C\uFF08\u5F53\u524D\uFF09",
    "about.builtInKeyboard": "\u952E\u76D8\u7248\u672C\uFF08\u5185\u7F6E\uFF09",
    "about.device": "\u624B\u673A\u578B\u53F7",
    "about.android": "\u7CFB\u7EDF\u7248\u672C",
    "about.androidValue": "Android {release}\uFF08API {sdk}\uFF09",
    "about.inputStats": "\u8F93\u5165\u5B57\u6570",
    "about.inputStatsValue": "\u4ECA\u65E5 {today} \xB7 \u7D2F\u8BA1 {total}",
    "note.saved": "\u5DF2\u4FDD\u5B58",
    "note.copied": "\u5DF2\u590D\u5236",
    "custom.none": "\u672A\u5B9A\u5236",
    "custom.count": "\u5DF2\u5B9A\u5236 {count} \u4E2A\u952E",
    "error.INVALID_CUSTOM_JSON": "\u5B9A\u5236 JSON \u683C\u5F0F\u4E0D\u6B63\u786E\u3002",
    "error.INVALID_DP_SCHEME": "\u53CC\u62FC\u65B9\u6848\u9009\u9879\u65E0\u6548\u3002",
    "input.ink.title": "\u624B\u5199\u8F93\u5165",
    "input.ink.badge": "\u624B\u5199",
    "input.ink.delay": "\u505C\u987F\u89E6\u53D1\u8BC6\u522B",
    "input.ink.delayHint": "\u505C\u7B14\u540E\u7B49\u8FD9\u4E48\u4E45\u5C31\u8BC6\u522B\u4E0A\u4E00\u4E2A\u5B57\uFF1B\u5199\u5F97\u6162\u9009\u300C\u6162\u300D\uFF0C\u62A2\u7740\u8BC6\u522B\u9009\u300C\u5FEB\u300D\u3002",
    "input.ink.live": "\u5B9E\u65F6\uFF08\u9010\u7B14\u8BC6\u522B\uFF09",
    "input.ink.fast": "\u5FEB\uFF08\u7EA6 300 \u6BEB\u79D2\uFF09",
    "input.ink.standard": "\u6807\u51C6\uFF08\u7EA6 600 \u6BEB\u79D2\uFF09",
    "input.ink.slow": "\u6162\uFF08\u7EA6 1200 \u6BEB\u79D2\uFF09",
    "input.feel.title": "\u952E\u76D8\u624B\u611F",
    "input.feel.badge": "\u5FAE\u8C03",
    "input.feel.padHint": "\u952E\u76D8\u4E0B\u65B9\u7684\u7A7A\u767D\u9AD8\u5EA6\uFF0C0 \u4FDD\u6301\u8D34\u5E95\uFF08\u7EC8\u7AEF\u573A\u666F\uFF09\uFF0C\u8865\u507F\u5168\u9762\u5C4F\u624B\u52BF\u6761\u6216\u7CFB\u7EDF\u5143\u7D20\u3002",
    "page.landscape": "\u6A2A\u5C4F\u663E\u793A",
    "input.landscape.title": "\u6A2A\u5C4F\u663E\u793A",
    "input.landscape.badge": "\u6A2A\u5C4F",
    "entry.landscape.title": "\u6A2A\u5C4F\u663E\u793A",
    "entry.landscape.subtitle": "\u6316\u5B54\u5B89\u5168\u533A \xB7 \u9AD8\u5EA6\u4E0A\u9650 \xB7 \u900F\u660E\u5EA6",
    "input.landscape.safeArea": "\u5DE6\u53F3\u7559\u5B89\u5168\u533A",
    "input.landscape.safeAreaHint": "\u952E\u76D8\u80CC\u666F\u94FA\u6EE1\u542B\u6316\u5B54\u7684\u6574\u6761\u77ED\u8FB9\uFF0C\u4F46\u6309\u952E\u533A\u907F\u5F00\u6316\u5B54\u4FA7\uFF1B\u5173\u95ED\u540E\u6309\u952E\u4E5F\u94FA\u6EE1\u3002",
    "input.landscape.ceil": "\u9AD8\u5EA6\u4E0A\u9650",
    "input.landscape.ceilHint": "\u6A2A\u5C4F\u952E\u76D8\u6700\u9AD8\u53EF\u5360\u5C4F\u5E55\u9AD8\u5EA6\u7684\u767E\u5206\u6BD4\uFF0840%\u2013100%\uFF09\u3002",
    "input.landscape.opacity": "\u6574\u4F53\u4E0D\u900F\u660E\u5EA6",
    "input.landscape.opacityHint": "\u6A2A\u5C4F\u65F6\u952E\u76D8\u6574\u5C42\uFF08\u542B\u80CC\u666F\uFF09\u7684\u900F\u660E\u7A0B\u5EA6\uFF0C\u8C03\u4F4E\u53EF\u770B\u5230\u88AB\u952E\u76D8\u76D6\u4F4F\u7684\u5185\u5BB9\u3002",
    "input.feel.padPortrait": "\u5E95\u90E8\u7559\u767D \xB7 \u7AD6\u5C4F",
    "input.feel.padLandscape": "\u5E95\u90E8\u7559\u767D \xB7 \u6A2A\u5C4F",
    "input.feel.padLandscapeHint": "\u6A2A\u5C4F\u5355\u72EC\u4FDD\u5B58\uFF0C\u4E92\u4E0D\u5F71\u54CD\u3002",
    "input.feel.candFont": "\u5019\u9009\u5B57\u53F7",
    "input.feel.candFontHint": "\u5019\u9009\u8BCD\u6587\u5B57\u7684\u5927\u5C0F\uFF0880%-150%\uFF09\uFF0C\u4E0D\u6539\u53D8\u952E\u76D8\u884C\u9AD8\u3002",
    "input.feel.keycapFont": "\u952E\u5E3D\u5B57\u53F7",
    "input.feel.keycapFontHint": "\u952E\u5E3D\u4E3B\u6587\u5B57\u7684\u5927\u5C0F\uFF0850-150%\uFF09\uFF0C\u4E0D\u6539\u53D8\u952E\u76D8\u884C\u9AD8\uFF1B\u8FC7\u5927\u65F6\u81EA\u52A8\u6536\u5728\u89D2\u6807\u4E0B\u65B9\u3002",
    "input.feel.userFont": "\u952E\u76D8\u5B57\u4F53",
    "input.feel.userFontHint": "\u7528\u5BFC\u5165\u7684\u5B57\u4F53\u6E32\u67D3\u952E\u76D8\u6587\u5B57\uFF08TTF/OTF\uFF09\uFF1B\u4E0D\u968F\u6570\u636E\u5907\u4EFD\uFF0C\u6362\u673A\u540E\u9700\u91CD\u65B0\u5BFC\u5165\u3002",
    "input.feel.userFontImport": "\u5BFC\u5165\u5B57\u4F53\u2026",
    "input.feel.userFontClear": "\u6062\u590D\u7CFB\u7EDF\u5B57\u4F53",
    "input.feel.userFontActive": "\u5F53\u524D\uFF1A{name}",
    "input.feel.userFontImported": "\u5DF2\u5BFC\u5165\uFF1A{name}",
    "error.font.IO_ERROR": "\u5B57\u4F53\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
    "error.font.TOO_LARGE": "\u5B57\u4F53\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u8D85\u8FC7 100MB \u4E0A\u9650\u3002",
    "error.font.BAD_MAGIC": "\u5B57\u4F53\u5BFC\u5165\u5931\u8D25\uFF1A\u4E0D\u662F\u6709\u6548\u7684 TTF/OTF \u5B57\u4F53\u6587\u4EF6\u3002",
    "error.font.BAD_FONT": "\u5B57\u4F53\u5BFC\u5165\u5931\u8D25\uFF1A\u6587\u4EF6\u65E0\u6CD5\u88AB\u7CFB\u7EDF\u89E3\u6790\u4E3A\u53EF\u7528\u5B57\u4F53\u3002",
    "fontLarge.title": "\u5B57\u4F53\u6587\u4EF6\u8F83\u5927",
    "fontLarge.badge": "\u63D0\u793A",
    "fontLarge.message": "\u8FD9\u4E2A\u5B57\u4F53\u6587\u4EF6\u6709 {mb} MB\uFF0C\u8D85\u8FC7 20MB\u3002\u5927\u5B57\u4F53\u4F1A\u589E\u52A0\u5185\u5B58\u5360\u7528\u548C\u52A0\u8F7D\u65F6\u95F4\uFF0C\u914D\u7F6E\u8F83\u4F4E\u7684\u8BBE\u5907\u53EF\u80FD\u51FA\u73B0\u5361\u987F\u3002\u4ECD\u8981\u5BFC\u5165\u5417\uFF1F",
    "fontLarge.cancel": "\u53D6\u6D88",
    "fontLarge.confirm": "\u4ECD\u8981\u5BFC\u5165",
    "input.feel.preeditFont": "\u62FC\u97F3\u5B57\u53F7",
    "input.feel.preeditFontHint": "\u6253\u5B57\u65F6\u62FC\u97F3\u5B57\u6BCD\u7684\u5927\u5C0F\uFF1B\u7279\u5927\u6863\u4F1A\u5360\u4E00\u884C\u66F4\u591A\u9AD8\u5EA6\u3002",
    "input.feel.preeditBold": "\u62FC\u97F3\u52A0\u7C97",
    "input.feel.preeditBoldHint": "\u6253\u5B57\u65F6\u7684\u62FC\u97F3\u5B57\u6BCD\u7528\u7C97\u4F53\u663E\u793A\uFF0C\u9ED8\u8BA4\u5173\u3002",
    "input.feel.oneHand": "\u5355\u624B\u6A21\u5F0F",
    "input.feel.oneHandHint": "\u952E\u76D8\u8D34\u5DE6\u6216\u8D34\u53F3\uFF0C\u7A7A\u51FA\u7684\u4FA7\u8FB9\u6761\u653E\u5149\u6807\u4E0E\u7F16\u8F91\u64CD\u4F5C\u3002",
    "input.feel.oneHandPad": "\u5355\u624B\u538B\u7F29\u6BD4\u4F8B",
    "input.feel.oneHandPadHint": "\u5927\u5C4F\u4E0A\u628A\u952E\u76D8\u8FDB\u4E00\u6B65\u6536\u7A84\uFF0C\u65B9\u4FBF\u62C7\u6307\u591F\u5230\u5168\u90E8\u6309\u952E\u3002",
    "pad.default": "\u4E0D\u538B\u7F29",
    "pad.15": "\u6536\u7A84 15%",
    "pad.25": "\u6536\u7A84 25%",
    "pad.35": "\u6536\u7A84 35%",
    "input.feel.sideContent": "\u4FA7\u8FB9\u6761\u5185\u5BB9",
    "input.feel.sideContentHint": "\u5355\u624B\u6A21\u5F0F\u4E0B\u7A7A\u51FA\u533A\u57DF\u7684\u5185\u5BB9\u3002",
    "input.feel.bgImageLight": "\u4EAE\u8272\u80CC\u666F",
    "error.BAD_BG_IMAGE": "\u56FE\u7247\u8FC7\u5927\u6216\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u5148\u7F29\u5C0F\u56FE\u7247\u540E\u91CD\u8BD5",
    "input.feel.bgImageDark": "\u6697\u8272\u80CC\u666F",
    "input.feel.themeMode": "\u8272\u5F69\u6A21\u5F0F",
    "input.feel.themePreset": "\u952E\u76D8\u8272\u8C03",
    "input.feel.themePresetHint": "\u4E00\u4E2A\u8272\u76F8\u9A71\u52A8\u6574\u5957\u952E\u76D8\u914D\u8272\uFF08\u952E\u5E3D/\u9762\u677F/\u5F3A\u8C03\u8272\uFF09\uFF1B\u62D6\u6ED1\u6761\u81EA\u5B9A\u4E49\uFF0C\u6216\u70B9\u9884\u7F6E\u5FEB\u6377\u6863\u3002",
    "input.feel.themeSat": "\u952E\u76D8\u9971\u548C\u5EA6",
    "input.feel.themePreview": "\u6548\u679C\u9884\u89C8",
    "input.feel.themePreviewHint": "\u8272\u8C03\u3001\u9971\u548C\u5EA6\u3001\u6309\u952E\u4E0D\u900F\u660E\u5EA6\u4E0E\u80CC\u666F\u56FE\u5728\u8FD9\u91CC\u5B9E\u65F6\u53CD\u6620\uFF1B\u4EAE\u6697\u5404\u4E00\u7EC4\u3002",
    "preview.light": "\u4EAE\u8272",
    "preview.dark": "\u6697\u8272",
    "entry.skin.title": "\u76AE\u80A4",
    "entry.skin.subtitle": "\u8272\u8C03 \xB7 \u9971\u548C\u5EA6 \xB7 \u80CC\u666F\u56FE",
    "page.skin": "\u76AE\u80A4",
    "nav.backAppearance": "\u8FD4\u56DE\u5916\u89C2",
    "input.feel.keyHue": "\u952E\u9762\u8272\u8C03",
    "input.feel.keyHueHint": "\u53EA\u8C03\u952E\u5E3D/\u5F3A\u8C03\u8272\u7684\u8272\u76F8\uFF08\u80CC\u666F\u4E0D\u52A8\uFF09\uFF1B\u70B9\u300C\u8DDF\u952E\u76D8\u300D\u8FD8\u539F\u8DDF\u968F\u3002",
    "preset.followKey": "\u8DDF\u952E\u76D8\u8272",
    "input.feel.keySat": "\u952E\u9762\u9971\u548C\u5EA6",
    "input.feel.keySatHint": "\u53EA\u8C03\u952E\u5E3D\u7EC4\u7684\u8272\u5F69\u6D53\u5EA6\uFF1B\u6700\u5DE6=\u952E\u5E3D\u53D8\u9ED1\u767D\u7070\u3002",
    "input.english.posLabel": "\u82F1\u6587\u8BCD\u5019\u9009\u4F4D\u7F6E",
    "input.english.posHint": "\u81EA\u52A8\uFF1A\u4E0D\u6253\u6270\u62FC\u97F3\u7684\u8BCD\u6392\u7B2C 1 \u4F4D\u3001\u4E0E\u62FC\u97F3\u952E\u5E8F\u91CD\u53E0\u7684\u6392\u7B2C 3 \u4F4D\uFF1B\u4E5F\u53EF\u56FA\u5B9A\u3002",
    "input.english.posAuto": "\u81EA\u52A8",
    "input.english.pos1": "\u7B2C 1 \u4F4D",
    "input.english.pos3": "\u7B2C 3 \u4F4D",
    "input.english.pos5": "\u7B2C 5 \u4F4D",
    "input.feel.themeSatHint": "\u62C9\u5230\u6700\u5DE6\u662F\u9ED1\u767D\u7070\uFF08\u660E\u6697\u6A21\u5F0F\u5B9A\u9ED1\u767D\u57FA\u5E95\uFF09\uFF0C\u5F80\u53F3\u8272\u5F69\u6E10\u6D53\u3002",
    "input.feel.kbGroup": "\u952E\u76D8",
    "input.feel.keyGroup": "\u952E\u9762",
    "input.feel.keyFollow": "\u8DDF\u968F\u952E\u76D8",
    "input.feel.keyFollowHint": "\u5F00\u542F\u65F6\u952E\u9762\u7684\u8272\u8C03/\u9971\u548C\u5EA6\u8DDF\u968F\u952E\u76D8\u7EC4\uFF1B\u5173\u95ED\u540E\u5404\u81EA\u72EC\u7ACB\u3002",
    "input.feel.themeHex": "\u952E\u76D8\u539F\u8272",
    "input.feel.themeHexHint": "\u751F\u6210\u80CC\u666F/\u9762\u677F\u914D\u8272\u7684\u8F93\u5165\u8272\uFF08\u4E0D\u662F\u6700\u7EC8\u50CF\u7D20\u8272\uFF09\uFF1B\u952E\u9762\u8DDF\u968F\u300C\u952E\u76D8\u300D\u65F6\u4E00\u8D77\u8C03\u6574\u3002",
    "input.feel.keyHex": "\u952E\u9762\u539F\u8272",
    "input.feel.keyHexHint": "\u751F\u6210\u952E\u5E3D/\u5F3A\u8C03\u8272\u7684\u8F93\u5165\u8272\uFF1B\u8DDF\u968F\u5F00\u542F\u65F6\u663E\u793A\u952E\u76D8\u539F\u8272\uFF0C\u5B9E\u9645\u6548\u679C\u89C1\u4E0B\u65B9\u9884\u89C8\u3002",
    "input.feel.hexPlaceholder": "#RRGGBB",
    "preset.classic": "\u9ED8\u8BA4\u7EFF",
    "preset.ocean": "\u6D77\u84DD",
    "preset.violet": "\u7D2B\u7F57\u5170",
    "preset.amber": "\u871C\u6A59",
    "preset.sakura": "\u6A31\u7C89",
    "preset.teal": "\u9752\u78A7",
    "input.feel.themeModeHint": "\u8DDF\u968F\u7CFB\u7EDF\uFF0C\u6216\u56FA\u5B9A\u6D45\u8272/\u6DF1\u8272\u3002",
    "input.feel.keyOpacity": "\u6309\u952E\u4E0D\u900F\u660E\u5EA6",
    "input.feel.kbHeight": "\u952E\u76D8\u9AD8\u5EA6",
    "input.feel.kbHeightHint": "\u7AD6\u5C4F\u952E\u76D8\u7684\u9AD8\u5EA6\uFF1B\u952E\u76D8\u4E0A\u62D6\u62FD\u8C03\u8282\u4E0E\u6B64\u5904\u7B49\u6548\u3002",
    "input.feel.kbHeightReset": "\u6062\u590D\u9ED8\u8BA4",
    "input.feel.keyOpacityHint": "\u952E\u5E3D\u5728\u80CC\u666F\u56FE\u4E0A\u7684\u900F\u660E\u7A0B\u5EA6\uFF0C\u6587\u5B57\u59CB\u7EC8\u5B9E\u8272\u3002",
    "input.feel.keyBubble": "\u6309\u952E\u6C14\u6CE1",
    "input.feel.cnEnComposingGuard": "\u62FC\u97F3\u7EC4\u8BCD\u4E2D\u7981\u6B62\u5207\u6362\u8BED\u8A00",
    "input.feel.cnEnComposingGuardHint": "\u9632\u6B62\u5FEB\u901F\u6253\u5B57\u8BEF\u89E6\u4E2D\u82F1\u5207\u6362\u952E\u628A\u7EC4\u8BCD\u6253\u65AD\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF0C\u5F00\u542F\u540E\u7EC4\u8BCD\u4E2D\u5355\u51FB\u5207\u6362\u952E\u4E0D\u751F\u6548\uFF09\u3002",
    "input.feel.keyBubbleHint": "\u6309\u4E0B\u6309\u952E\u65F6\u5728\u952E\u5E3D\u4E0A\u65B9\u653E\u5927\u663E\u793A\u6240\u6309\u7684\u5B57\u7B26\uFF0C\u65B9\u4FBF\u786E\u8BA4\u6709\u6CA1\u6709\u6309\u9519\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF09\u3002",
    "entry.appearance.title": "\u5916\u89C2",
    "entry.appearance.subtitle": "\u8272\u5F69\u6A21\u5F0F \xB7 \u80CC\u666F\u56FE\u7247 \xB7 \u900F\u660E\u5EA6",
    "input.appearance.title": "\u5916\u89C2",
    "input.appearance.preview": "\u9884\u89C8",
    "input.appearance.previewHint": "\u952E\u76D8\u4E0D\u518D\u81EA\u52A8\u5F39\u51FA\uFF08\u60F3\u5B9E\u65F6\u770B\u914D\u8272\u53BB\u300C\u76AE\u80A4\u300D\u9875\uFF09\uFF1B\u70B9\u8FD9\u4E2A\u8F93\u5165\u6846\u53EF\u4EE5\u5524\u8D77\u952E\u76D8\u8BD5\u6253\u3002",
    "input.appearance.previewPlaceholder": "\u76F4\u63A5\u5728\u8FD9\u91CC\u6253\u5B57\u8BD5\u8BD5",
    "input.appearance.badge": "\u4E3B\u9898",
    "input.feel.bgImageHint": "\u94FA\u6EE1\u6574\u4E2A\u952E\u76D8\u533A\u57DF\uFF08\u5DE5\u5177\u6761\u5230\u5E95\u90E8\u7559\u767D\uFF09\uFF0C\u538B\u7F29\u5230 720px \u5BBD\u5B58\u50A8\uFF0C\u53EA\u5728\u672C\u673A\u751F\u6548\u3002",
    "input.feel.bgImageHintDark": "\u4EAE\u6697\u5207\u6362\u65F6\u5404\u81EA\u4F7F\u7528\u5BF9\u5E94\u7EC4\u7684\u56FE\u7247\u3002",
    "\u81EA\u5B9A\u4E49": "Custom",
    "\u5149\u6807\u63A7\u5236": "\u5149\u6807\u63A7\u5236",
    "\u81EA\u5B9A\u4E49\u56FE\u7247": "\u81EA\u5B9A\u4E49\u56FE\u7247",
    "\u5DE6\u624B": "\u5DE6\u624B",
    "\u53F3\u624B": "\u53F3\u624B",
    "input.feel.hold": "\u957F\u6309\u89E6\u53D1\u65F6\u957F",
    "input.feel.holdHint": "\u957F\u6309\u5F39\u51FA\u9009\u5B57\u3001\u9501\u5B9A\u5927\u5199\u3001\u6253\u5F00\u6A21\u5F0F\u83DC\u5355\u7684\u7B49\u5F85\u65F6\u95F4\u3002",
    "input.feel.flickSwap": "\u4E0A\u4E0B\u6ED1\u65B9\u5411\u4E92\u6362",
    "input.feel.flickSwapHint": "\u9ED8\u8BA4\u4E0A\u6ED1\u51FA\u6570\u5B57/\u7B26\u53F7\u3001\u4E0B\u6ED1\u51FA\u5927\u5199\uFF1B\u5F00\u542F\u540E\u5BF9\u8C03\uFF08\u952E\u9762\u5C0F\u5B57\u63D0\u793A\u968F\u4E4B\u4E0B\u79FB\uFF09\u3002",
    "input.feel.doubleShiftLock": "\u53CC\u51FB Shift \u9501\u5B9A\u5927\u5199",
    "input.feel.doubleShiftLockHint": "300 \u6BEB\u79D2\u5185\u8FDE\u70B9\u4E24\u4E0B Shift \u9501\u5B9A\u5927\u5199\uFF08\u4E0E\u957F\u6309\u9501\u5B9A\u7B49\u6548\uFF09\uFF1B\u5173\u95ED\u540E\u9000\u56DE\u70B9\u6309\u5207\u6362\u3002",
    "input.feel.scrub": "\u5149\u6807\u79FB\u52A8\u901F\u5EA6",
    "input.feel.scrubHint": "\u5149\u6807\u62D6\u62FD\u65F6\u6BCF\u4E2A\u523B\u5EA6\u79FB\u52A8\u7684\u8DDD\u79BB\u3002",
    "input.feel.snap": "\u6ED1\u52A8\u9009\u5B57\u8303\u56F4",
    "input.feel.snapHint": "\u957F\u6309\u6ED1\u9009\u65F6\u624B\u6307\u504F\u79BB\u591A\u8FDC\u53D6\u6D88\u9009\u62E9\uFF1A\u677E=\u66F4\u8FDC\u4E5F\u6709\u6548\uFF0C\u7D27=\u66F4\u65E9\u53D6\u6D88\u3002",
    "input.feel.snapLoose": "\u677E",
    "input.feel.snapStandard": "\u6807\u51C6",
    "input.feel.snapTight": "\u7D27",
    "input.feel.keySound": "\u6309\u952E\u58F0\u97F3",
    "input.feel.keySoundVolume": "\u6309\u952E\u97F3\u91CF",
    "input.feel.keySoundVolumeHint": "\u54D4\u58F0\u3001\u7CFB\u7EDF\u952E\u51FB\u97F3\u4E0E\u81EA\u5B9A\u4E49\u97F3\u6548\u5171\u7528\u3002",
    "input.feel.keyHapticStrength": "\u632F\u52A8\u5F3A\u5EA6",
    "input.feel.keyHapticStrengthHint": "\u672C\u673A\u9A6C\u8FBE\u4E0D\u652F\u6301\u5F3A\u5F31\u8C03\u8282\u65F6\u6309\u8F7B\u91CD\u7684\u65F6\u957F\u8FD1\u4F3C\u3002",
    "input.feel.hapticLight": "\u5F31",
    "input.feel.hapticMedium": "\u4E2D",
    "input.feel.hapticStrong": "\u5F3A",
    "input.feel.keySoundHint": "\u6309\u952E\u65F6\u8F7B\u54CD\u4E00\u58F0\uFF0C\u8DDF\u968F\u7CFB\u7EDF\u97F3\u91CF\uFF0C\u9759\u97F3\u65F6\u4E0D\u54CD\u3002",
    "input.feel.keySoundStyle": "\u6309\u952E\u97F3\u6548",
    "input.feel.keySoundStyleHint": "\u9ED8\u8BA4\u54D4\u58F0\u4E4B\u5916\u7684\u97F3\u6548\uFF1B",
    "input.feel.kssDefault": "\u9ED8\u8BA4\u54D4\u58F0",
    "input.feel.kssKeypress": "\u7CFB\u7EDF\u952E\u51FB\u97F3",
    "input.feel.kssCustom": "\u81EA\u5B9A\u4E49\u97F3\u6548",
    "input.feel.keySoundFile": "\u81EA\u5B9A\u4E49\u97F3\u6548\u6587\u4EF6",
    "input.feel.keySoundFileHint": "\u9009\u4E00\u6BB5 2MB \u5185\u7684\u77ED\u97F3\u9891\uFF08ogg/mp3/wav\uFF09\uFF1B\u4E0D\u5408\u9002\u53EF\u6E05\u9664\u6362\u56DE\u9ED8\u8BA4\u3002",
    "input.feel.keySoundPick": "\u9009\u62E9\u6587\u4EF6",
    "input.feel.keySoundClear": "\u6E05\u9664",
    "feel.keySound.current": "\u5F53\u524D\uFF1A",
    "feel.keySound.none": "\u672A\u9009\u62E9",
    "input.feel.keyHaptic": "\u6309\u952E\u632F\u52A8",
    "diag.title": "\u8BCA\u65AD\u8BB0\u5F55",
    "diag.badge": "\u8C03\u8BD5",
    "diag.toggle": "\u8BB0\u5F55\u5F15\u64CE\u8BCA\u65AD\u4E8B\u4EF6",
    "diag.toggleHint": "\u590D\u73B0\u300C\u6309\u952E\u5B57\u6BCD\u76F4\u63A5\u4E0A\u5C4F\u300D\u8FD9\u7C7B\u6545\u969C\u524D\u6253\u5F00\u3002\u53EA\u8BB0\u5F55\u5F15\u64CE\u4E0E\u7F16\u8F91\u5668\u4E8B\u4EF6\uFF08\u5305\u540D\u3001inputType\u3001\u964D\u7EA7\u539F\u56E0\uFF09\uFF0C\u4E0D\u542B\u4EFB\u4F55\u8F93\u5165\u5185\u5BB9\u3002",
    "diag.copy": "\u5BFC\u51FA\u8BCA\u65AD\u4FE1\u606F",
    "diag.on": "\u8BCA\u65AD\u8BB0\u5F55\u5DF2\u5F00\u542F\uFF0C\u590D\u73B0\u95EE\u9898\u540E\u56DE\u5230\u8FD9\u91CC\u5BFC\u51FA\u8BCA\u65AD\u4FE1\u606F\u3002",
    "diag.exported": "\u8BCA\u65AD\u6587\u4EF6\u5DF2\u751F\u6210\uFF0C\u5728\u5F39\u51FA\u7684\u5206\u4EAB\u9762\u677F\u91CC\u9009\u5FAE\u4FE1 / \u90AE\u4EF6\u7B49\u65B9\u5F0F\u53D1\u9001\u3002",
    "diag.off": "\u8BCA\u65AD\u8BB0\u5F55\u672A\u5F00\u542F\u3002",
    "input.feel.keyHapticHint": "\u6309\u952E\u65F6\u8F7B\u77ED\u632F\u52A8\u4E00\u4E0B\uFF0C\u5F3A\u5EA6\u8DDF\u968F\u673A\u578B\uFF1B\u7CFB\u7EDF\u89E6\u611F\u603B\u5F00\u5173\u5173\u95ED\u65F6\u4E0D\u9707\u3002",
    "error.INVALID_FEEL_OPTION": "\u624B\u611F\u53C2\u6570\u65E0\u6548\uFF0C\u5DF2\u8FD8\u539F\u4E3A\u539F\u503C\u3002",
    "error.EMPTY_SOURCE": "\u8BF7\u5148\u586B\u5165\u66F4\u65B0\u6E90\u5730\u5740\uFF08metainfo.json\uFF09\u3002",
    "error.EMPTY_URL": "\u8BF7\u5148\u586B\u5165\u952E\u76D8\u5305\u5730\u5740\u3002",
    "error.INVALID_SOURCE": "\u66F4\u65B0\u6E90\u5730\u5740\u65E0\u6548\u3002",
    "error.NO_RELEASE": "\u5C1A\u65E0\u53EF\u7528\u53D1\u5E03\u3002",
    "error.NO_INSTALLABLE_ASSET": "\u53D1\u5E03\u4E2D\u6CA1\u6709\u53EF\u5B89\u88C5\u7684\u952E\u76D8\u5305\u3002",
    "error.AMBIGUOUS_ASSET": "\u53D1\u5E03\u4E2D\u7684\u952E\u76D8\u5305\u4E0D\u552F\u4E00\u3002",
    "error.INVALID_ASSET_URL": "\u53D1\u5E03\u8D44\u4EA7\u4E0B\u8F7D\u5730\u5740\u65E0\u6548\u3002",
    "error.RATE_LIMITED": "GitHub \u8BF7\u6C42\u53D7\u5230\u9650\u6D41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    "error.NETWORK_ERROR": "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\u3002",
    "error.BAD_RESPONSE": "\u66F4\u65B0\u6E90\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u5185\u5BB9\u3002",
    "error.INTERNAL_ERROR": "\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    "error.URL_NOT_HTTPS": "\u66F4\u65B0\u5730\u5740\u5FC5\u987B\u4F7F\u7528 HTTPS\u3002",
    "error.URL_USER_INFO": "\u66F4\u65B0\u5730\u5740\u4E0D\u80FD\u5305\u542B\u8D26\u53F7\u6216\u5BC6\u7801\u3002",
    "error.TIMEOUT": "\u7F51\u7EDC\u8BF7\u6C42\u8D85\u65F6\u3002",
    "error.TLS_ERROR": "\u5B89\u5168\u8FDE\u63A5\u5931\u8D25\u3002",
    "error.REDIRECT_LIMIT": "\u91CD\u5B9A\u5411\u6B21\u6570\u8FC7\u591A\u3002",
    "error.REDIRECT_NOT_HTTPS": "\u91CD\u5B9A\u5411\u5730\u5740\u5FC5\u987B\u4F7F\u7528 HTTPS\u3002",
    "error.DOWNLOAD_TOO_LARGE": "\u4E0B\u8F7D\u6587\u4EF6\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\u3002",
    "error.ZIP_TOO_LARGE": "\u952E\u76D8\u5305\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\u3002",
    "error.NOT_ZIP": "\u952E\u76D8\u5305\u683C\u5F0F\u4E0D\u6B63\u786E\u3002",
    "error.SIGNATURE_MISSING": "\u952E\u76D8\u5305\u7F3A\u5C11\u7B7E\u540D\u3002",
    "error.SIGNATURE_BAD": "\u952E\u76D8\u5305\u7B7E\u540D\u6821\u9A8C\u5931\u8D25\u3002",
    "error.PAYLOAD_HASH": "\u952E\u76D8\u6587\u4EF6\u6821\u9A8C\u5931\u8D25\u3002",
    "error.VERSION_MISMATCH": "\u952E\u76D8\u7248\u672C\u4FE1\u606F\u4E0D\u4E00\u81F4\u3002",
    "error.COMPAT_MIN_NATIVE_API": "\u5F53\u524D\u7248\u672C\u7684 Feelime \u4E0D\u652F\u6301\u6B64\u952E\u76D8\u5305\u3002",
    "error.COMPAT_CAPABILITIES": "\u6B64\u952E\u76D8\u5305\u9700\u8981\u672A\u63D0\u4F9B\u7684\u80FD\u529B\u3002",
    "error.FRAGMENT_PIN_MISMATCH": "\u952E\u76D8\u5305\u6821\u9A8C\u6307\u7EB9\u4E0D\u5339\u914D\u3002",
    "error.IO_ERROR": "\u672C\u5730\u6587\u4EF6\u64CD\u4F5C\u5931\u8D25\u3002",
    "error.ENTRY_LIMIT": "\u952E\u76D8\u5305\u5305\u542B\u8FC7\u591A\u6587\u4EF6\u3002",
    "error.DUPLICATE_ENTRY": "\u952E\u76D8\u5305\u5305\u542B\u91CD\u590D\u6587\u4EF6\u3002",
    "error.PATH_TRAVERSAL": "\u952E\u76D8\u5305\u5305\u542B\u4E0D\u5B89\u5168\u8DEF\u5F84\u3002",
    "error.PATH_ABSOLUTE": "\u952E\u76D8\u5305\u5305\u542B\u7EDD\u5BF9\u8DEF\u5F84\u3002",
    "error.PATH_BACKSLASH": "\u952E\u76D8\u5305\u8DEF\u5F84\u683C\u5F0F\u4E0D\u5B89\u5168\u3002",
    "error.PATH_NUL": "\u952E\u76D8\u5305\u8DEF\u5F84\u5305\u542B\u65E0\u6548\u5B57\u7B26\u3002",
    "error.SYMLINK_OR_SPECIAL": "\u952E\u76D8\u5305\u5305\u542B\u4E0D\u652F\u6301\u7684\u7279\u6B8A\u6587\u4EF6\u3002",
    "error.UNICODE_CONFLICT": "\u952E\u76D8\u5305\u6587\u4EF6\u540D\u5B58\u5728\u51B2\u7A81\u3002",
    "error.UNKNOWN_ENTRY": "\u952E\u76D8\u5305\u5305\u542B\u672A\u77E5\u6587\u4EF6\u3002",
    "error.ENVELOPE_MISSING": "\u952E\u76D8\u5305\u7F3A\u5C11\u6821\u9A8C\u5143\u6570\u636E\u3002",
    "error.MANIFEST_INVALID_JSON": "\u952E\u76D8\u5305\u6E05\u5355\u683C\u5F0F\u65E0\u6548\u3002",
    "error.MANIFEST_UNKNOWN_KEY": "\u952E\u76D8\u5305\u6E05\u5355\u5305\u542B\u672A\u77E5\u5B57\u6BB5\u3002",
    "error.MANIFEST_MISSING_KEY": "\u952E\u76D8\u5305\u6E05\u5355\u7F3A\u5C11\u5FC5\u8981\u5B57\u6BB5\u3002",
    "error.MANIFEST_LISTS_ENVELOPE": "\u952E\u76D8\u5305\u6E05\u5355\u7ED3\u6784\u65E0\u6548\u3002",
    "error.MANIFEST_PAYLOAD_ALLOWLIST": "\u952E\u76D8\u5305\u5305\u542B\u4E0D\u5141\u8BB8\u7684\u5185\u5BB9\u3002",
    "error.KEY_UNKNOWN": "\u952E\u76D8\u5305\u7B7E\u540D\u5BC6\u94A5\u672A\u77E5\u3002",
    "error.PAYLOAD_LENGTH": "\u952E\u76D8\u6587\u4EF6\u5927\u5C0F\u6821\u9A8C\u5931\u8D25\u3002",
    "error.INFLATED_TOO_LARGE": "\u952E\u76D8\u5305\u89E3\u538B\u540E\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\u3002",
    "error.HOTWORDS_TRUNCATED": "\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u6709 {count} \u884C\u70ED\u8BCD\u8D85\u51FA\u9650\u5236\uFF08\u6700\u591A {max} \u884C\uFF0C\u6BCF\u884C {chars} \u5B57\uFF09\u3002",
    "error.NO_NETWORK": "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u7F51\u7EDC\u8FDE\u63A5\u3002",
    "error.STALE_CONFIRMATION": "\u4E0B\u8F7D\u786E\u8BA4\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u4E0B\u8F7D\u3002",
    "error.MODEL_DOWNLOAD_FAILED": "\u6A21\u578B\u4E0B\u8F7D\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    "error.MODEL_IMPORT_FAILED": "\u6A21\u578B\u5BFC\u5165\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5B98\u65B9\u5F52\u6863\u683C\u5F0F\u540E\u91CD\u8BD5\u3002",
    "error.MODEL_IMPORT_BUSY": "\u6A21\u578B\u6B63\u5728\u5904\u7406\uFF0C\u8BF7\u7A0D\u5019\u3002",
    "error.MODEL_NETWORK_CHANGED": "\u7F51\u7EDC\u5DF2\u53D8\u5316\uFF0C\u4E0B\u8F7D\u5DF2\u6682\u505C\uFF1B\u8BF7\u91CD\u65B0\u786E\u8BA4\u540E\u91CD\u8BD5\u3002",
    "error.INVALID_MODEL_SOURCE": "\u81EA\u5B9A\u4E49\u6E90\u9700\u8981 HTTPS \u4ED3\u5E93\u5730\u5740\u548C\u5BF9\u5E94\u7684 tar.bz2 \u5F52\u6863\u5730\u5740\u3002"
  },
  en: {
    "title": "Feelime Settings",
    "hero.tag": "Offline Chinese-English voice input",
    "status.title": "Status",
    "ime.title": "Input method status",
    "ime.enabled": "Enable Feelime in system settings",
    "ime.default": "Set as the default input method",
    "ime.enableAction": "Enable",
    "ime.pickAction": "Switch",
    "ime.addShortcut": "Add home-screen shortcut",
    "ime.addTile": "Add Quick Settings tile",
    "language.title": "Interface language",
    "language.badge": "UI",
    "language.label": "Display language",
    "language.hint": "Follows the system by default; this changes Feelime UI only, not input language.",
    "language.note": "Input language is still controlled by the keyboard mode.",
    "language.auto": "Follow system",
    "language.zh": "\u4E2D\u6587",
    "language.en": "English",
    "nav.groups": "Settings sections",
    "nav.back": "Back to home",
    "nav.backAppearance": "Back to appearance",
    "entry.input.title": "Keyboard & input",
    "entry.input.subtitle": "Double pinyin \xB7 Custom keys",
    "entry.dict.title": "Lexicon",
    "entry.dict.subtitle": "Import rime dicts \xB7 Extra candidates",
    "entry.backup.title": "Backup & restore",
    "entry.backup.subtitle": "Settings \xB7 Phrases \xB7 Lexicons",
    "entry.voice.title": "Voice recognition",
    "entry.voice.subtitle": "Voice models \xB7 Recognition options",
    "entry.update.title": "Keyboard updates",
    "entry.update.subtitle": "Update keyboard HTML/CSS/JS",
    "entry.about.title": "About",
    "entry.about.subtitle": "Version info \xB7 Components",
    "entry.test.title": "Input test",
    "entry.test.subtitle": "Wake Feelime and try it",
    "page.input": "Keyboard & input",
    "page.dict": "Lexicon",
    "dict.badge": "Overlay",
    "dict.import.title": "Import a dictionary",
    "dict.import.enable": "rime dictionary file (.dict.yaml)",
    "dict.import.note": "Lines of word<TAB>code are imported, up to 5000 entries; handy for cherry-picking words from community dicts such as rime-ice.",
    "dict.userwords.title": "User words",
    "dict.userwords.enable": "Hand-maintained words",
    "dict.userwords.hint": "Add word + full-pinyin code pairs one by one; typing the code surfaces the word. Great for names, abbreviations, jargon. Applies immediately, survives restart.",
    "dict.userwords.manage": "Manage words",
    "page.userwords": "User words",
    "page.fuzzy": "Fuzzy input",
    "page.keyboards": "Keyboard selection",
    "userwords.list.title": "Words",
    "userwords.list.empty": "No words yet - add one below.",
    "userwords.form.text": "Word (e.g. hello world)",
    "userwords.form.code": "Code (leave empty for auto pinyin)",
    "userwords.form.add": "Add",
    "userwords.form.save": "Save",
    "userwords.form.cancel": "Cancel",
    "userwords.list.note": "Leave the code empty to auto-generate pinyin (polyphones expand to every reading; double-pinyin keys auto-adapt); tap a word to edit, \u2715 deletes. Applies immediately, 200-entry cap.",
    "userwords.note.saved": "Saved",
    "userwords.note.deleted": "Deleted",
    "userwords.err.notReady": "Word list still loading, try again shortly",
    "userwords.err.duplicate": "That code already exists",
    "userwords.err.limit": "200 entries max",
    "userwords.form.textErr": "Word cannot be empty",
    "userwords.form.codeErr": "Code must be 1-48 letters",
    "userwords.count": "{0} entries",
    "nav.backDict": "Back to dictionary",
    "dict.base.title": "Base dictionary",
    "dict.base.badge": "Base",
    "dict.base.hint": "Swap the whole lexicon: pick a zip bundle (rime-ice: the whole zip; wanxiang: the tone-free Lite zip; a lone .dict.yaml only works when it carries its own entries \u2014 umbrella files with just import_tables always fail), recompiles on this device (a few minutes); fuzzy/double-pinyin/T9 rebuild with it. Built-in can be restored anytime.",
    "dict.base.pick": "Pick a dictionary file",
    "dict.base.revert": "Restore built-in",
    "dict.slot.delete": "Delete",
    "dict.base.builtin": "Built-in rime-frost",
    "dict.base.custom": "Custom: {0}",
    "dict.base.builtinNote": "Bundled rime-frost dictionary",
    "dict.base.entries": "{0} entries",
    "dict.base.nonPinyin": "A large share of codes in this dictionary are not pinyin syllable sequences (shape-code layout): characters may not be reachable by typing their pronunciation. Dedicated shape-code schema support may come later.",
    "dict.base.t9Skip": "This dictionary has many entries: compiling the T9 (9-key) prism would exceed this device's available memory, so the 9-key mode was skipped for this import. Pinyin and double-pinyin are unaffected; a smaller dictionary or the built-in one restores it.",
    "dict.base.toned": "Codes in this dictionary carry tone marks (likely the full variant, e.g. wanxiang Base): tones are not typeable on this keyboard, so many entries will never match. Use the tone-free Lite variant (or restore the built-in).",
    "flypy.title": "Shape-code table",
    "flypy.badge": "Shape",
    "flypy.hint": "Import a shape-code table (e.g. the flypy rime dict .dict.yaml, or plain TAB-separated word/code text): two sound codes + two shape codes, unique 4-code auto-commit. Compiled on this device into a standalone mode - the pinyin lexicon is untouched. Removable anytime.",
    "flypy.pick": "Import shape-code table",
    "flypy.revert": "Remove table",
    "flypy.none": "Not imported (no shape mode in the mode menu yet)",
    "flypy.custom": "Imported: {0}",
    "flypy.building": "Processing the shape-code table\u2026",
    "dict.base.stageCopy": "Reading the dictionary file\u2026",
    "dict.base.stageActivate": "Switching dictionary\u2026",
    "dict.base.stageCompile": "Compiling (Chinese input pauses meanwhile) - you can leave this page; the keyboard swaps over when done",
    "dict.base.elapsed": "{0}s elapsed",
    "dict.base.switching": "Active: {0}, switching to {1}: ",
    "page.appearance": "Appearance",
    "themeMode.auto": "Follow system",
    "themeMode.light": "Light",
    "themeMode.dark": "Dark",
    "page.voice": "Voice recognition",
    "page.update": "Keyboard updates",
    "page.about": "About",
    "page.test": "Input test",
    "input.fuzzy.title": "Fuzzy input",
    "input.fuzzy.manage": "Manage fuzzy pinyin",
    "input.fuzzy.manageHint": "Type confusable sounds interchangeably (z/zh, n/l, nasal endings). Applies to full pinyin and T9, not double pinyin.",
    "input.fuzzy.badge": "Input",
    "input.fuzzy.g.ping": "Retroflex z/zh, c/ch, s/sh",
    "input.fuzzy.g.ping.hint": "Typing zang also matches \u5F20, typing zhang also matches \u810F.",
    "input.fuzzy.g.nl": "n/l initials",
    "input.fuzzy.g.nl.hint": "Typing nai also matches \u6765, typing lai also matches \u5976.",
    "input.fuzzy.g.fh": "f/h initials",
    "input.fuzzy.g.fh.hint": "Typing fu also matches \u6E56, typing hu also matches \u7236.",
    "input.fuzzy.g.rl": "r/l initials",
    "input.fuzzy.g.rl.hint": "Typing re also matches \u4E50, typing le also matches \u70ED.",
    "input.fuzzy.g.nasal": "Front/back nasals",
    "input.fuzzy.g.nasal.hint": "an/ang, en/eng, in/ing: typing zang also matches \u5F20, typing zhon also matches \u4E2D.",
    "input.assoc.title": "Chinese word association",
    "input.assoc.badge": "Input",
    "input.assoc.enable": "Suggest the next word after a commit",
    "input.assoc.hint": "Shows frequent followers in the candidates bar after a word commits; tap to keep the chain going. Full/Double Pinyin only.",
    "input.assoc.backspaceClear": "Backspace dismisses associations",
    "input.hwkb.title": "Physical keyboard",
    "input.hwkb.badge": "Input",
    "input.hwkb.form": "When a physical keyboard is connected",
    "input.hwkb.formHint": "Candidates only: the keyboard collapses to a candidates bar (pinyin/double-pinyin etc.); Full keyboard: unchanged; Follow system: obey the system's show-on-screen-keyboard setting.",
    "input.hwkb.candidates": "Candidates only",
    "input.hwkb.full": "Full keyboard",
    "input.hwkb.follow": "Follow system",
    "input.hwkb.hint": "Type with a hard keyboard: letters feed the pinyin composer, space picks a candidate, Ctrl+Space or a lone Shift toggles Chinese/English.",
    "input.quickSwitch.policy": "Quick switch (toggle / Ctrl+Space)",
    "input.quickSwitch.policyHint": "Fixed pair: always flips between the two keyboards you picked; Current keyboard \u2194 English: returns to the last keyboard you used.",
    "input.quickSwitch.follow": "Current keyboard \u2194 English",
    "input.quickSwitch.fixed": "Fixed pair",
    "input.assoc.backspaceClearHint": "When association candidates are showing, backspace clears them and restores the toolbar (nothing deleted); off = backspace deletes as usual.",
    "input.datetime.title": "Date & time candidates",
    "input.datetime.badge": "Input",
    "input.datetime.enable": "Type date/time/week for quick stamps",
    "input.datetime.hint": "The candidates bar offers the current date, time and weekday (full pinyin riqi/shijian/xingqi works too); turn off if unwanted.",
    "input.candidates.title": "Candidate extras",
    "input.phrases.title": "Symbol candidates",
    "input.phrases.badge": "Input",
    "input.phrases.enable": "Symbol / emoji candidates",
    "input.phrases.hint": "Adds words like \u2191 for shang and \u2713 for dui; they sit near candidate #3 by default and each word can get an explicit position under Manage entries; works in full and double Pinyin.",
    "input.phrases.freqSort": "Rank by use frequency",
    "input.phrases.freqSortHint": "Words without an explicit position climb as you pick them (5 picks can move one to the front for space-bar entry); off keeps them near slot #3. Explicit positions ignore this switch.",
    "input.english.enable": "English word candidates",
    "input.english.hint": "Type english words like github, ios or android right inside Pinyin composing \u2014 no mode switch; works in full and double Pinyin.",
    "input.phrases.wxSlash": "wanxiang / feature guide",
    "input.phrases.wxSlashHint": "After installing the wanxiang Pinyin schema, enable to route / into the engine on the full/double-Pinyin keyboards (/sj offers time characters, /rq date characters \u2014 from the built-in static tables, not wanxiang's dynamic time); the shape-code, T9, handwriting and English keyboards are not supported \u2014 / commits directly there, as it does when off.",
    "input.phrases.manage": "Manage entries",
    "input.phrases.importHint": "Entries from a rime dictionary join the candidates as an overlay (the built-in lexicon stays; original frequencies are not carried). Importing again replaces the previous import.",
    "input.phrases.importBtn": "Pick a file",
    "input.phrases.clearBtn": "Clear imported",
    "input.phrases.confirmClear": "Confirm clear",
    "input.phrases.importedCount": "{0} entries imported",
    "page.phrases": "Symbol candidates",
    "nav.backInput": "Back to Keyboard & input",
    "phrases.list.title": "Entries",
    "phrases.list.empty": "No entries yet \u2014 add one below.",
    "phrases.list.note": "Codes use full Pinyin (single-syllable entries also match double-pinyin keys); tap an entry to edit, \u2715 to delete. Changes apply immediately.",
    "phrases.form.text": "Text (e.g. \u2191 or a word)",
    "phrases.form.rank": "Slot",
    "phrases.form.code": "Code (e.g. shang)",
    "phrases.form.add": "Add",
    "phrases.form.save": "Save changes",
    "phrases.form.cancel": "Cancel",
    "phrases.note.saved": "Saved",
    "phrases.note.deleted": "Deleted",
    "phrases.err.duplicate": "An entry with this code already exists",
    "phrases.err.notReady": "Entries are still loading \u2014 try again shortly",
    "phrases.err.limit": "Limit is 200 entries \u2014 remove some first",
    "input.double.title": "Double-pinyin scheme",
    "input.double.badge": "Input",
    "input.double.scheme": "Scheme",
    "input.double.hint": "Takes effect when the keyboard is in Double Pinyin mode.",
    "input.double.layout": "Key layout",
    "input.double.layoutHint": "14-key merges neighbouring letters into wide caps - bigger targets, fewer mis-taps.",
    "input.double.layout26": "26 keys",
    "input.feel.kbLayout": "Letter layout",
    "input.feel.kbLayoutHint": "Applies to pinyin, double-pinyin and English; 14-key merges neighbouring letters into wider caps.",
    "input.double.layout14": "14 keys",
    "input.double.ziranma": "Ziranma",
    "input.double.flypy": "Flypy (\u5C0F\u9E64)",
    "input.double.sogou": "Sogou / MSPY",
    "input.double.ziguang": "Ziguang (\u7D2B\u5149)",
    "input.double.note.ziranma": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e) use full Pinyin: \u554A=aa\u3001\u7231=ai\u3001\u5B89=an\u3001\u6069=en\u3001\u4E8C=er.",
    "input.double.note.flypy": "Initials match full Pinyin (except zh=V, ch=I, sh=U). Zero-initial syllables (a/e/o) double the first letter; full Pinyin also works: \u554A=aa\u3001\u7231=ai\u3001\u6069=ef\u3001\u4E8C=er.",
    "input.double.note.sogou": "Initials match full Pinyin (except zh=V, ch=I, sh=U); ing sits on the \u201C;\u201D key (the wide key on the keyboard), \xFC on Y. Zero-initial syllables always start with O: \u554A=oa\u3001\u7231=ol\u3001\u5B89=oj\u3001\u6069=of\u3001\u4E8C=or. Sogou and MSPY share the exact same layout.",
    "input.double.note.ziguang": "The Ziguang (\u7D2B\u5149) layout. zh=U\u3001ch=A\u3001sh=I; ing sits on the \u201C;\u201D key, \xFC on V (ju/qu/xu also take v). Zero-initial syllables always start with O: \u554A=oa\u3001\u7231=op\u3001\u5B89=or.",
    "input.double.mapCaption": "Final key map (finals under each key, double initials bottom-right)",
    "input.custom.title": "Custom keys",
    "input.custom.badge": "Advanced",
    "input.custom.enabled": "Enable the custom symbols page",
    "input.custom.jsonLabel": 'Custom JSON ({"version":1,"rows":[[{"t":"key label","tap":"output","note":"note"}]]})',
    "input.custom.jsonPlaceholder": "Paste custom JSON",
    "input.custom.note": "Saved on this device and applied the next time the keyboard loads.",
    "input.custom.manage": "Manage custom keys",
    "input.custom.badjson": "Invalid JSON \u2014 check the format (version/rows)",
    "page.customkeys": "Custom keys",
    "ck.status.title": "Custom keys",
    "ck.openEditor": "Open editor",
    "ck.openEditor.hint": "Build keys by tapping - no code needed",
    "ck.json.title": "Advanced",
    "ck.json.hint": "The editor covers everyday needs; use JSON for bulk import/export or advanced tricks.",
    "ck.rows.title": "Keys: tap to edit, hold to move/delete",
    "ck.quick.title": "Quick add",
    "ck.quick.title.hint": "Tap a key to edit it, hold to rearrange; tap \uFF0B to add.",
    "ck.edit.title": "Edit key",
    "ck.apply": "Apply",
    "ck.save": "Save",
    "ck.add": "\uFF0B",
    "ck.f.t": "Label",
    "ck.f.t.hint": "Text shown on the key",
    "ck.f.action": "Tap action",
    "ck.f.mode": "Type",
    "ck.f.mode.text": "Text",
    "ck.f.mode.single": "Key",
    "ck.f.mode.combo": "Combo",
    "ck.f.mode.advanced": "Adv",
    "ck.f.mode.open": "Open",
    "ck.f.mode.setting": "Settings",
    "ck.f.mode.panel": "Panel",
    "ck.f.kind": "Type",
    "ck.lang.title": "Language keyboards",
    "ck.lang.pinyin": "Pinyin (26-key)",
    "ck.lang.dp": "Double Pinyin",
    "ck.lang.english": "English",
    "ck.lang.french": "French",
    "ck.lang.russian": "Russian",
    "ck.lang.count": "{count} keys customized",
    "ck.lang.default": "Default",
    "ck.lang.hint1": "Tap a letter or the comma key to customize its hint and flick actions; layout, tap and long-press stay unchanged.",
    "ck.lang.hint2": "Split / backspace / 123 / CN-EN / enter are fixed; space long-press keeps its global action.",
    "ck.lang.reset": "Reset all",
    "ck.lang.resetDone": "Reset (remember to save)",
    "ck.lang.editTitle": "Edit key {0}",
    "ck.lang.editKey": "Customize key {0}",
    "ck.lang.editPunct": "Customize comma key",
    "ck.lang.lock": "Types letter {0} \xB7 tap & long-press fixed",
    "ck.lang.lockPunct": "Types comma \xB7 tap & long-press fixed",
    "ck.lang.alt": "Hint",
    "ck.lang.altPlaceholder": "Default: {0}",
    "ck.lang.slotUp": "\u2197 Flick up",
    "ck.lang.slotDown": "\u2198 Flick down",
    "ck.lang.defUp": "Default \xB7 uppercase {0}",
    "ck.lang.defDown": "Default \xB7 hint character",
    "ck.lang.shiftKey": "split",
    "ck.lang.cnEn": "\u4E2D/EN",
    "ck.sym.title": "Symbol keyboard",
    "ck.sym.entry": "\u201CCustom\u201D symbol tab",
    "ck.sym.hint": "Tap to edit, long-press to move/delete",
    "ck.sym.pageTitle": "\u201CCustom\u201D symbol tab",
    "ck.f.mode.def": "Keyboard default",
    "ck.f.mode.none": "Off",
    "ck.f.mode.op": "Action",
    "ck.f.op": "Action",
    "ck.op.undo": "Undo",
    "ck.op.redo": "Redo",
    "ck.op.cut": "Cut",
    "ck.op.copy": "Copy",
    "ck.op.paste": "Paste",
    "ck.op.selectAll": "Select all",
    "ck.op.clear": "Clear editor",
    "ck.op.cursorLeft": "Cursor left by word",
    "ck.op.cursorRight": "Cursor right by word",
    "ck.op.lineStart": "Line start",
    "ck.op.lineEnd": "Line end",
    "ck.spaceTitle": "Hold-space action",
    "ck.space.edit": "Edit action",
    "ck.space.face": "Space key label",
    "ck.space.faceHint": "Shown on the space bar (e.g. \u{1F4CB}, up to 8 chars)",
    "ck.space.hint": "A 350ms press on the space bar runs this action; Voice is hold-to-talk, others fire once.",
    "ck.f.panel.pick": "Which panel to open",
    "ck.f.text": "Text to type, e.g. :w or me@example.com",
    "ck.f.mods": "Mods",
    "ck.f.key": "Key",
    "ck.f.open.uri": "Link",
    "ck.f.setting.pick": "Setting to open",
    "ck.f.open.placeholder": "e.g. doubao:// or https://example.com",
    "ck.f.open.presets": "Presets",
    "ck.f.open.presetPick": "Pick a preset\u2026",
    "ck.f.open.hint": "App deeplinks (app must be installed) or web addresses; tapping switches to the target app and hides the keyboard. intent:// etc. are not allowed; requires keyboard 3.73.22+.",
    "ck.f.dsl": "DSL (e.g. [esc]ggVGD or [open:doubao://])",
    "ck.help.aria": "DSL help",
    "ck.help.dsl": "<b>Write what should happen, in order:</b><br>\xB7 Type text: just write it, e.g. <code>:w</code>, <code>me@example.com</code><br>\xB7 One key: bracket it, e.g. <code>[esc]</code>, <code>[f5]</code>, <code>[backspace]</code><br>\xB7 Combos: <code>[ctrl+s]</code> (save), <code>[alt+f4]</code><br>\xB7 Open an app/web page: <code>[open:doubao://]</code>, <code>[open:https://translate.google.com]</code><br>\xB7 Sequences: <code>[esc]ggVGD</code> = Vim delete the whole file: <code>[esc]ggVGD</code><br>\xB7 Key names: esc, tab, enter, space, backspace, del, arrows, home, end, pgup, pgdn, f1-f12, letters, digits; modifiers: ctrl, alt, shift, win.",
    "ck.f.span": "Width",
    "ck.f.color": "Color",
    "ck.color.default": "Default",
    "ck.color.custom": "Custom",
    "ck.color.hex": "Hex",
    "ck.color.hexLabel": "Keycap color code",
    "ck.color.hue": "Hue",
    "ck.color.sat": "Saturation",
    "ck.f.note": "Note",
    "ck.f.note.hint": "Shown on long-press",
    "ck.editBar.hint": "Drag to move, tap \xD7 to delete",
    "ck.editBar.done": "Done",
    "ck.common": "Common",
    "ck.common.hint": "Pick one to prefill, tweak, apply",
    "ck.err.t": "Key face is required",
    "ck.err.tap": "Tap action is required",
    "ck.err.open": "Link must be an http(s) web address or an app link like doubao://, with no spaces",
    "ck.err.setting": "Pick a setting first",
    "ck.err.panel": "Invalid panel target",
    "ck.err.tapLong": "Tap action exceeds 128 characters (link too long) - please use a shorter link",
    "ck.note.saved": "Saved; applied the next time the keyboard loads",
    "ck.note.deleted": "Deleted",
    "ck.row": "Row {n}",
    "ck.none": "(empty)",
    "ck.align.aria": "Row alignment",
    "ck.align.left": "L",
    "ck.align.center": "C",
    "ck.align.right": "R",
    "ck.dirty": "Unsaved changes",
    "ck.back.title": "Editing keys",
    "ck.back.text": "Still in edit mode (drag to move, tap \xD7 to delete). Discard editing or continue?",
    "ck.back.go": "Discard editing",
    "ck.back.stay": "Keep editing",
    "ck.del.title": "Delete key",
    "ck.del.confirm": 'Delete "{t}"?',
    "ck.del.go": "Delete",
    "ck.del.cancel": "Cancel",
    "ck.add.aria": "Add a key to row {n}",
    "ck.newTitle": "New key",
    "ck.cancel": "Cancel",
    "ck.confirmLeave": "You have unsaved changes. Leave anyway?",
    "ck.confirmLeaveTitle": "Unsaved changes",
    "ck.leaveGo": "Discard and leave",
    "ck.leaveStay": "Stay",
    "input.keyboards.title": "Keyboard selection",
    "input.keyboards.manage": "Manage keyboards & quick switch",
    "input.keyboards.manageHint": "Which keyboards appear in the long-press menu, and the quick-switch pair.",
    "input.keyboards.badge": "Menu",
    "input.keyboards.enable": "Keyboards listed in the long-press menu",
    "input.keyboards.hint": "Checked keyboards appear in the mode-key long-press menu; row order is the menu order (arrow buttons). Unchecked ones can be re-enabled from that menu. Applies immediately.",
    "input.keyboards.drag": "Drag to reorder",
    "input.keyboards.moveUp": "Move up",
    "input.keyboards.moveDown": "Move down",
    "input.keyboards.pairA": "Quick switch \xB7 first",
    "input.keyboards.pairB": "Quick switch \xB7 second",
    "input.keyboards.pairHint": "The switch key toggles between these two; pick your two most-used keyboards.",
    "input.keyboards.saved": "Saved; the keyboard applies it immediately",
    "input.feel.bubbleLinger": "Bubble linger",
    "input.feel.bubbleLingerHint": "How long the bubble stays after release; 0 hides it instantly.",
    "search.placeholder": "Search settings: height, bubble, double-pinyin, lexicon\u2026",
    "search.noResults": "No matching settings",
    "action.saveCustom": "Save custom layout",
    "action.insertTemplate": "Insert practical template",
    "action.insertTemplateDev": "Developer template",
    "action.viewDocs": "View guide",
    "voice.models.title": "Microphone & voice models",
    "voice.models.badge": "Voice",
    "voice.backend.label": "Model source",
    "voice.backend.auto": "Prefer app models",
    "voice.backend.remote": "Downloaded models",
    "voice.backend.hint": "Changes apply to the next recording. After selecting downloaded models, download any missing models below before recording.",
    "voice.downloadSource.label": "Model download source",
    "voice.downloadSource.pick": 'Tap an option to save it; "Speed test" compares latency',
    "voice.downloadSource.speedTest": "Speed test",
    "voice.downloadSource.testing": "Testing\u2026",
    "voice.downloadSource.gitee": "Gitee mirror (default)",
    "voice.downloadSource.github": "GitHub direct",
    "voice.downloadSource.ghproxy": "GitHub (gh-proxy)",
    "voice.downloadSource.fastest": "fastest \u2713",
    "voice.downloadSource.unavailable": "unavailable",
    "voice.downloadSource.custom": "Custom source",
    "voice.downloadSource.customPlaceholder": "For example: https://example.com/download/handwriting/ (one model's channel directory)",
    "voice.downloadSource.save": "Save custom source",
    "voice.downloadSource.hint": "Downloads are verified after transfer. Defaults to the Gitee mirror; GitHub direct and gh-proxy accelerated sources are also available.",
    "voice.holdSpace": "Hold space",
    "voice.holdSpaceHint": "What a long-press on the space bar does; Voice shows the mic glyph, Off disables the hold.",
    "voice.hold.voice": "Voice input",
    "voice.hold.clipboard": "Clipboard panel",
    "voice.hold.favorites": "Phrases panel",
    "voice.hold.emoji": "Emoji panel",
    "voice.hold.edit": "Quick edit panel",
    "voice.hold.control": "Control-key layer",
    "voice.hold.custom": "Custom keys panel",
    "voice.hold.none": "Off",
    "voice.mic.permission": "Microphone permission",
    "voice.mic.hint": "Required for voice input; processing stays on this device",
    "voice.mic.action": "Allow",
    "voice.models.note": "The full package includes all models. Smaller packages can download models here with resume and per-file verification.",
    "voice.asr.title": "Voice recognition options",
    "voice.asr.badge": "Recognition",
    "voice.asr.stripPeriod": "Remove final periods",
    "voice.asr.idleUnload": "Release speech models when idle",
    "voice.asr.idleUnloadHint": "Off by default. Release after 5 idle minutes; the next recording reloads the models.",
    "voice.asr.stripHint": "Question and exclamation marks stay; turn off to keep model output unchanged",
    "voice.asr.numItn": "Write numbers as digits",
    "voice.asr.numItnHint": "Quantities, dates, amounts and decimals convert automatically (\u4E09\u4E2A \u2192 3\u4E2A); off by default",
    "voice.asr.hotwordsLabel": "Hotwords (one per line; Chinese or English; recognition gives these words priority)",
    "voice.asr.hotwordsWeightHint": 'A word keeps being misrecognized? Append ":number" for a stronger pull, e.g. \u59DA\u7A0B:10. Range 1-20 (one decimal at most), omitted = default strength; too high may duplicate the word or misrecognize others - lower it then.',
    "voice.asr.hotwordsPlaceholder": "For example:\n\u502A\u59AE\n\u59DA\u7A0B:10 \u2190 stronger pull when misrecognized\nGPU",
    "action.saveAsr": "Save recognition options",
    "update.title": "Keyboard updates",
    "update.badge": "Update",
    "update.note": "Only keyboard HTML/CSS/JS are replaced. The engine, dictionaries, and voice models stay untouched.",
    "update.sourceLabel": "Update source (metainfo.json)",
    "update.sourcePlaceholder": "https://example.com/feelime/metainfo.json",
    "update.autoCheck": "Check for updates when settings opens",
    "update.autoCheckHint": "At most once a day; clearing the source disables automatic checks",
    "update.urlLabel": "Keyboard package URL (network download)",
    "update.urlPlaceholder": "https://example.com/feelime-keyboard.zip",
    "action.checkUpdate": "Check for updates",
    "action.install": "Download and install",
    "action.importLocal": "Import local ZIP",
    "action.restore": "Restore built-in",
    "update.localHint": "Importing a local ZIP needs no network; its signature and compatibility are still verified.",
    "update.unsigned": "\u26A0 An unsigned keyboard has IME access (debug builds only)",
    "update.sigConfirmed": "\u26A0 Active keyboard: signature unverified (manually confirmed)",
    "page.backup": "Backup & restore",
    "backup.title": "Backup & restore",
    "backup.badge": "Backup",
    "backup.note": "Pack settings, saved phrases, custom keys and input lexicons into one editable JSON file for device migration.",
    "backup.export": "Export data",
    "backup.import": "Import data",
    "backup.consent.title": "Confirm overwrite",
    "backup.consent.badge": "Overwrite",
    "backup.consent.message": "Importing overwrites your current settings, saved phrases, custom keys and lexicons. This cannot be undone. Continue?",
    "backup.consent.cancel": "Cancel",
    "webdav.title": "Cloud backup (WebDAV)",
    "webdav.note": "Uploads backups to your own WebDAV server (e.g. Jianguoyun). Each backup is a new timestamped file - history is never overwritten; pick one from the list to restore. Credentials stay on this device and never travel inside backups.",
    "webdav.urlLabel": "Server URL",
    "webdav.dirLabel": "Subdirectory",
    "webdav.dir": "feelime-backup",
    "webdav.dirHint": "Backups are stored under this subdirectory of the server URL. Some providers (e.g. Jianguoyun) cannot store files in the root, so keeping a subdirectory is recommended; leave empty to use the root.",
    "webdav.providerLabel": "Provider",
    "webdav.provider.jg": "Jianguoyun",
    "webdav.provider.inf": "InfiniCLOUD",
    "webdav.provider.nc": "Nextcloud / Synology",
    "webdav.provider.custom": "Custom\u2026",
    "webdav.url": "https://dav.jianguoyun.com/dav/feelime/",
    "webdav.userLabel": "Username",
    "webdav.user": "Username",
    "webdav.passLabel": "App password",
    "webdav.pass": "App password (not the login password)",
    "webdav.save": "Save & test",
    "webdav.backup": "Back up now",
    "webdav.restoreBtn": "Restore from cloud",
    "webdav.backupModal.title": "Back up to cloud",
    "webdav.backupModal.hint": "A new backup file will be uploaded. The name defaults to the current time and can be edited.",
    "webdav.backupModal.nameLabel": "Backup file name",
    "webdav.backupModal.go": "Start backup",
    "webdav.backupModal.dup": "\u26A0 A file with this name already exists in the cloud; saving will overwrite it",
    "webdav.backupModal.dupBtn": "Overwrite existing file",
    "webdav.backupModal.unknownDup": "Could not check the cloud for duplicates; if the name exists, the server will reject the upload",
    "webdav.backupModal.sending": "Uploading\u2026",
    "webdav.backupModal.badName": "The name must start with feelime-backup- and end with .json, with no /, space or +",
    "webdav.restoreModal.title": "Restore from cloud",
    "webdav.restoreModal.back": "Back",
    "webdav.empty": "No cloud backups yet.",
    "webdav.consent.title": "Confirm restore",
    "webdav.consent.message": "Restoring overwrites current settings, favorites, custom keys and dictionaries. This cannot be undone. Continue?",
    "webdav.consent.confirm": "Restore this backup",
    "webdav.note.testing": "Testing connection\u2026",
    "webdav.note.ok": "Connection OK",
    "webdav.note.backupOk": "Backed up: {0}",
    "webdav.note.restoreOk": "Restored: {0}",
    "webdav.note.listing": "Fetching cloud list\u2026",
    "webdav.note.backing": "Backing up\u2026",
    "webdav.note.restoring": "Downloading and restoring\u2026",
    "webdav.err.AUTH": "Auth failed: wrong username or password",
    "webdav.err.NOT_FOUND": "URL not found (check the path)",
    "webdav.err.NO_DAV": "This URL does not speak WebDAV",
    "webdav.err.EMPTY_URL": "Enter the server URL first",
    "webdav.err.NETWORK": "Network error",
    "webdav.err.TOO_LARGE": "File exceeds the size limit",
    "webdav.err.TOO_LONG": "Input too long",
    "webdav.err.BAD_NAME": "Invalid backup name",
    "webdav.err.CONFLICT": "A file with this name already exists in the cloud",
    "webdav.err.RESTORE_FAILED": "Restore failed: the backup content failed validation",
    "webdav.err.INTERNAL": "Internal error",
    "webdav.err.GENERIC": "Operation failed",
    "webdav.size.kb": "{0} KB",
    "backup.consent.confirm": "Choose a file",
    "backup.done.export": "Exported to the chosen location.",
    "backup.done.import": "Import complete; applying changes.",
    "backup.failed.export": "Export failed",
    "backup.failed.import": "Import failed",
    "backup.error.FORMAT": "The file is not valid JSON.",
    "backup.error.KIND": "This is not a Feelime backup file.",
    "backup.error.VERSION": "The backup is from a newer version; update Feelime first.",
    "backup.error.IO_ERROR": "Could not read or write the file.",
    "backup.error.PATH": "The backup contains unsafe paths and was rejected.",
    "backup.error.BASE64": "The lexicon data in the backup is corrupted.",
    "kbSig.title": "Keyboard package signature mismatch",
    "kbSig.badge": "Security",
    "kbSig.message": 'This keyboard package was not signed with the official release key (it may be self-modified or third-party). After importing it runs marked as "signature unverified" and survives restart.',
    "kbSig.cancel": "Cancel",
    "kbSig.confirm": "Import anyway",
    "about.versionTitle": "Version information",
    "about.badge": "Info",
    "action.copyVersion": "Copy version info",
    "action.appStore": "View app on Google Play",
    "action.githubRepo": "GitHub repository",
    "action.githubIssues": "Report an issue",
    "action.feishuGroup": "Join the Feishu group",
    "action.checkUpdate": "Check for updates",
    "action.checkUpdatePlay": "Update on Google Play",
    "action.dlThin": "Download thin build",
    "action.dlFull": "Download full build",
    "update.checking": "Checking for updates\u2026",
    "update.upToDate": "Up to date (v{0})",
    "update.available": "New version v{0} available (current v{1}). Download:",
    "update.failed": "Update check failed. Try again later, or visit GitHub Releases.",
    "about.copyHint": "Paste this when reporting a problem. The copied report is marked sensitive and is kept out of keyboard clipboard history.",
    "about.offlineHint": "Everything stays offline: voice recognition and text candidates use no network.",
    "about.noticesTitle": "Third-party licenses & components",
    "about.legalBadge": "Licenses",
    "about.expandNotices": "Show full notices",
    "about.openLicenses": "Open-source licenses & credits",
    "about.openLicensesHint": "Components \xB7 Upstream links \xB7 Full notices",
    "page.licenses": "Licenses & credits",
    "nav.backAbout": "Back to about",
    "licenses.self.title": "This app's license",
    "licenses.self.note": "Feelime as a whole is offered under GPL-3.0: the built-in Chinese base lexicon comes from rime-frost (also GPL-3.0), and the corresponding source is the app's source repository.",
    "licenses.components.title": "Credits",
    "licenses.components.badge": "Open source",
    "licenses.thanks": "Feelime stands on the shoulders of these open-source projects; tap a link to visit the upstream.",
    "licenses.full.title": "Full notices",
    "licenses.cmp.frost": "Chinese base lexicon (re-curated word frequencies)",
    "licenses.cmp.librime": "Chinese input engine (bundles Boost/OpenCC/marisa-trie etc.)",
    "licenses.cmp.rimedata": "Rime schemas & data files",
    "licenses.cmp.sherpa": "Offline speech recognition runtime & models",
    "licenses.cmp.mozc": "Japanese engine (Abseil/Protobuf/zlib bundled)",
    "licenses.cmp.hunspell": "Spell checking (FR/RU dictionaries bundled)",
    "licenses.cmp.okhttp": "Networking for model downloads (online only while downloading)",
    "licenses.cmp.othersName": "Other bundled dependencies",
    "licenses.cmp.others": "Commons Compress, yaml-cpp, LevelDB, RapidJSON etc. \xB7 see the full notices below",
    "test.title": "Type a test sentence",
    "test.badge": "Test",
    "test.placeholder": "Tap here to wake Feelime and try it",
    "test.note": "Text stays in this editor.",
    "model.builtIn": "Included with the app",
    "model.transferSize": "Download {download} (archive includes extra files)\nInstalled size {installed}",
    "model.installed": "Downloaded and verified",
    "model.downloading": "Downloading {percent}%",
    "model.downloadingBytes": "Downloading {percent}% ({done} / {total})",
    "model.broken": "File is invalid; download again",
    "model.missing": "Not downloaded (about {size})",
    "model.download": "Download",
    "model.cancel": "Cancel",
    "model.remove": "Delete",
    "model.redownload": "Download again",
    "model.import": "Import model file",
    "model.importing": "Reading model file\u2026",
    "model.importValidating": "Verifying model file\u2026",
    "model.importInstalling": "Installing verified model\u2026",
    "model.importFormat": "Only official tar.bz2 or zip archives matching the built-in model list are accepted.",
    "model.title.streaming": "Streaming speech recognition (Chinese/English)",
    "model.title.final": "Full-sentence correction",
    "model.title.punctuation": "Chinese-English punctuation restoration",
    "model.consent.title": "Confirm download",
    "model.consent.badge": "Data notice",
    "model.consent.message": "\u201C{name}\u201D is about {bytes}. Your current network may incur data charges. Continue?",
    "model.consent.cancel": "Cancel",
    "model.consent.confirm": "Continue download",
    "update.sourceBuiltIn": "Built-in APK",
    "update.sourceHot": "Hot-updated version",
    "update.version": "Version: {value}",
    "update.hash": "Content hash: {value}\u2026",
    "update.state": "Status: {value}",
    "update.lastError": "Latest error: {value}",
    "update.lastSuccess": "Last success: {value}",
    "update.sourceStatus": "Update source: {value}",
    "update.sourceDefault": "Official default",
    "update.sourceCustom": "User configured",
    "update.sourceDisabled": "Disabled",
    "update.states.BUILT_IN": "Built-in",
    "update.states.DOWNLOADING": "Downloading",
    "update.states.VERIFYING": "Verifying",
    "update.states.CHECKING_COMPATIBILITY": "Checking compatibility",
    "update.states.READY": "Ready",
    "update.states.ACTIVE": "Active",
    "update.states.ACTIVATING": "Activating",
    "update.states.ROLLED_BACK": "Rolled back",
    "update.states.FAILED": "Failed",
    "about.appVersion": "App version",
    "about.activeKeyboard": "Keyboard version (current)",
    "about.builtInKeyboard": "Keyboard version (built-in)",
    "about.device": "Device",
    "about.android": "System version",
    "about.androidValue": "Android {release} (API {sdk})",
    "about.inputStats": "Characters typed",
    "about.inputStatsValue": "Today {today} \xB7 Total {total}",
    "note.saved": "Saved",
    "note.copied": "Copied",
    "custom.none": "No custom keys",
    "custom.count": "{count} custom keys",
    "error.INVALID_CUSTOM_JSON": "The custom JSON format is invalid.",
    "error.INVALID_DP_SCHEME": "Invalid double-pinyin scheme.",
    "input.ink.title": "Handwriting",
    "input.ink.badge": "Hand",
    "input.ink.delay": "Pause before recognition",
    "input.ink.delayHint": "How long to wait after the pen lifts before recognizing; pick Slow if you write slowly, Fast if it fires too eagerly.",
    "input.ink.live": "Live (per stroke)",
    "input.ink.fast": "Fast (~300 ms)",
    "input.ink.standard": "Standard (~600 ms)",
    "input.ink.slow": "Slow (~1200 ms)",
    "input.feel.title": "Keyboard feel",
    "input.feel.badge": "Tuning",
    "input.feel.pad": "Bottom padding",
    "input.feel.padHint": "Blank strip under the keys; 0 keeps the keyboard flush with the screen (terminal use). Saved per orientation to compensate gesture bars or OEM IME buttons.",
    "page.landscape": "Landscape display",
    "input.landscape.title": "Landscape display",
    "input.landscape.badge": "Landscape",
    "entry.landscape.title": "Landscape display",
    "entry.landscape.subtitle": "Cutout safe area \xB7 height ceiling \xB7 opacity",
    "input.landscape.safeArea": "Keep side safe areas",
    "input.landscape.safeAreaHint": "The keyboard background fills the full short edge including the cutout, while the keys avoid it; off lets keys fill it too.",
    "input.landscape.ceil": "Height ceiling",
    "input.landscape.ceilHint": "Maximum share of the screen height the landscape keyboard may take (40%\u2013100%).",
    "input.landscape.opacity": "Overall opacity",
    "input.landscape.opacityHint": "Opacity of the whole landscape keyboard (background included); lower it to see the content underneath.",
    "input.feel.padPortrait": "Bottom padding \xB7 Portrait",
    "input.feel.padLandscape": "Bottom padding \xB7 Landscape",
    "input.feel.padLandscapeHint": "Saved separately from portrait.",
    "input.feel.candFont": "Candidate text size",
    "input.feel.candFontHint": "Size of the candidate words (80%-150%); keyboard row height is unchanged.",
    "input.feel.keycapFont": "Keycap text size",
    "input.feel.keycapFontHint": "Size of the keycap labels (50%-150%); row height is unchanged. Oversized labels are clamped under the superscripts.",
    "input.feel.userFont": "Keyboard font",
    "input.feel.userFontHint": "Render keyboard text with an imported font (TTF/OTF). Not included in backups; re-import after switching devices.",
    "input.feel.userFontImport": "Import font\u2026",
    "input.feel.userFontClear": "Use system font",
    "input.feel.userFontActive": "Current: {name}",
    "input.feel.userFontImported": "Imported: {name}",
    "error.font.IO_ERROR": "Font import failed: could not read the file, please retry.",
    "error.font.TOO_LARGE": "Font import failed: file exceeds the 100MB limit.",
    "error.font.BAD_MAGIC": "Font import failed: not a valid TTF/OTF font file.",
    "error.font.BAD_FONT": "Font import failed: the file could not be parsed as a usable font.",
    "fontLarge.title": "Large font file",
    "fontLarge.badge": "Notice",
    "fontLarge.message": "This font file is {mb} MB, over 20MB. Large fonts use more memory and take longer to load; lower-end devices may feel sluggish. Import anyway?",
    "fontLarge.cancel": "Cancel",
    "fontLarge.confirm": "Import anyway",
    "input.feel.preeditFont": "Pinyin text size",
    "input.feel.preeditFontHint": "Size of the pinyin letters while typing; the largest level takes extra band height.",
    "input.feel.preeditBold": "Bold pinyin",
    "input.feel.preeditBoldHint": "Show the composing pinyin letters in bold; off by default.",
    "input.feel.oneHand": "One-handed mode",
    "input.feel.oneHandHint": "Shift the keys left or right; the freed side strip holds cursor and editing actions.",
    "input.feel.oneHandPad": "One-handed shrink",
    "input.feel.oneHandPadHint": "Narrow the keyboard further on big screens so your thumb reaches every key.",
    "pad.default": "Off",
    "pad.15": "Shrink 15%",
    "pad.25": "Shrink 25%",
    "pad.35": "Shrink 35%",
    "input.feel.sideContent": "Side strip content",
    "input.feel.sideContentHint": "What fills the freed strip in one-handed mode.",
    "input.feel.bgImageLight": "Light background",
    "error.BAD_BG_IMAGE": "Image is too large or unreadable. Resize it and try again.",
    "input.feel.bgImageDark": "Dark background",
    "input.feel.themeMode": "Color mode",
    "input.feel.themePreset": "Keyboard tint",
    "input.feel.themePresetHint": "One hue drives the whole keyboard palette; drag the slider or tap a preset.",
    "input.feel.themeSat": "Keyboard saturation",
    "input.feel.themeSatHint": "Far left is grayscale (light/dark sets the base); colors deepen to the right.",
    "input.feel.themePreview": "Preview",
    "input.feel.themePreviewHint": "Reflects tint, saturation, key opacity and background images live; one board per theme.",
    "preview.light": "Light",
    "preview.dark": "Dark",
    "input.feel.keyHue": "Keycap tint",
    "input.feel.keyHueHint": "Recolors keycaps/accents only (background stays); tap Follow to inherit again.",
    "input.feel.keySat": "Keycap saturation",
    "input.feel.keySatHint": "Color intensity of the keycap group only; far left makes keycaps grayscale.",
    "input.feel.kbGroup": "Keyboard",
    "input.feel.keyGroup": "Keycaps",
    "input.feel.keyFollow": "Follow keyboard",
    "input.feel.keyFollowHint": "Keycap hue/saturation follow the keyboard group while on; turn off to tune them independently.",
    "input.feel.themeHex": "Keyboard source color",
    "input.feel.themeHexHint": "The input color that generates backgrounds and panels (not the final pixel color); keycaps follow it while Follow is on.",
    "input.feel.keyHex": "Keycap source color",
    "input.feel.keyHexHint": "The input color that generates keycaps and accents; shows the keyboard source color while following.",
    "input.feel.hexPlaceholder": "#RRGGBB",
    "preset.followKey": "Follow keyboard",
    "preset.classic": "Classic green",
    "preset.ocean": "Ocean",
    "preset.violet": "Violet",
    "preset.amber": "Amber",
    "preset.sakura": "Sakura",
    "preset.teal": "Teal",
    "input.feel.themeModeHint": "Follow the system, or pin light/dark.",
    "\u65E0": "None",
    "\u9009\u62E9\u56FE\u7247": "Pick an image\u2026",
    "input.feel.keyOpacity": "Key opacity",
    "input.feel.kbHeight": "Keyboard height",
    "input.feel.kbHeightHint": "Portrait keyboard height; dragging on the keyboard stays equivalent.",
    "input.feel.kbHeightReset": "Reset",
    "input.feel.keyOpacityHint": "How transparent the keycaps sit over the background image; labels stay solid.",
    "input.feel.keyBubble": "Key bubble",
    "input.feel.cnEnComposingGuard": "Block language switch while composing",
    "input.feel.cnEnComposingGuardHint": "Prevents fast typing from grazing the C/EN key and wrecking the composition (off by default).",
    "input.feel.keyBubbleHint": "Enlarge the pressed character above the keycap while held, so mis-presses are obvious (off by default).",
    "entry.appearance.title": "Appearance",
    "entry.appearance.subtitle": "Color mode \xB7 Background \xB7 Opacity",
    "entry.skin.title": "Skin",
    "entry.skin.subtitle": "Tint \xB7 Saturation \xB7 Background",
    "page.skin": "Skin",
    "input.appearance.title": "Appearance",
    "input.appearance.preview": "Preview",
    "input.appearance.previewHint": "The keyboard no longer pops up automatically here (use the Skin page for live colors); tap this box to summon it and try typing.",
    "input.appearance.previewPlaceholder": "Type here to try it",
    "input.appearance.badge": "Theme",
    "input.feel.bgImageHint": "Covers the whole keyboard (toolbar to bottom padding), compressed to 720px wide and stored locally.",
    "input.feel.bgImageHintDark": "Each theme uses its own image when you switch.",
    "\u81EA\u5B9A\u4E49": "Custom",
    "\u5149\u6807\u63A7\u5236": "Cursor",
    "\u81EA\u5B9A\u4E49\u56FE\u7247": "Custom image",
    "\u5DE6\u624B": "Left hand",
    "\u53F3\u624B": "Right hand",
    "\u5173": "Off",
    "\u7A7A\u767D": "Blank",
    "input.feel.hold": "Long-press trigger",
    "input.feel.holdHint": "How long a press waits before popup selection, caps lock, or the mode menu opens.",
    "input.feel.flickSwap": "Swap flick directions",
    "input.feel.flickSwapHint": "By default flick up gives the digit/symbol and flick down uppercases; enabling swaps them (the keycap hint moves below).",
    "input.feel.doubleShiftLock": "Double-tap Shift to enable Caps Lock",
    "input.feel.doubleShiftLockHint": "Two Shift taps within 300 ms lock caps (same as long-press lock); turn off to fall back to single taps.",
    "input.feel.scrub": "Cursor speed",
    "input.feel.scrubHint": "Distance the caret moves per drag step.",
    "input.feel.snap": "Swipe selection range",
    "input.feel.snapHint": "How far the finger may drift during popup swipe before the pick cancels: loose = forgiving, tight = early cancel.",
    "input.feel.keySoundVolume": "Key volume",
    "input.feel.keySoundVolumeHint": "Shared by the beep, system keypress and custom sounds.",
    "input.feel.keyHapticStrength": "Haptic strength",
    "input.feel.keyHapticStrengthHint": "Approximated by duration when the motor lacks amplitude control.",
    "input.feel.hapticLight": "Light",
    "input.feel.hapticMedium": "Medium",
    "input.feel.hapticStrong": "Strong",
    "input.feel.keySound": "Key sound",
    "input.feel.keySoundHint": "A soft click on each key press; follows system volume, silent in mute mode.",
    "input.feel.keySoundStyle": "Key sound style",
    "input.feel.keySoundStyleHint": "Sounds beyond the default beep;",
    "input.feel.kssDefault": "Default beep",
    "input.feel.kssKeypress": "System keypress tone",
    "input.feel.kssCustom": "Custom sound",
    "input.feel.keySoundFile": "Custom sound file",
    "input.feel.keySoundFileHint": "Pick a short audio (ogg/mp3/wav) within 2MB; clear to fall back to the default.",
    "input.feel.keySoundPick": "Choose file",
    "input.feel.keySoundClear": "Clear",
    "feel.keySound.current": "Current: ",
    "feel.keySound.none": "none",
    "input.feel.keyHaptic": "Key vibration",
    "diag.title": "Diagnostics",
    "diag.badge": "Debug",
    "diag.toggle": "Record engine diagnostic events",
    "diag.toggleHint": "Enable before reproducing issues like raw letters landing directly. Records engine/editor events only (package, inputType, degrade reason) \u2014 never any typed content.",
    "diag.copy": "Export diagnostics",
    "diag.on": "Recording. Reproduce the issue, then come back and export the diagnostics.",
    "diag.exported": "Diagnostics file created \u2014 pick WeChat / email etc. in the share sheet.",
    "diag.off": "Diagnostics recording is off.",
    "input.feel.keyHapticHint": "A light tap on each key press; strength follows the device tuning. No vibration while the system haptics master switch is off.",
    "input.feel.snapLoose": "Loose",
    "input.feel.snapStandard": "Standard",
    "input.feel.snapTight": "Tight",
    "error.INVALID_FEEL_OPTION": "Invalid feel option; the previous value was kept.",
    "error.EMPTY_SOURCE": "Enter an update source (metainfo.json) first.",
    "error.EMPTY_URL": "Enter a keyboard package URL first.",
    "error.INVALID_SOURCE": "The update source URL is invalid.",
    "error.NO_RELEASE": "No release is currently available.",
    "error.NO_INSTALLABLE_ASSET": "The release has no installable keyboard package.",
    "error.AMBIGUOUS_ASSET": "The release has ambiguous keyboard packages.",
    "error.INVALID_ASSET_URL": "The release asset URL is invalid.",
    "error.RATE_LIMITED": "GitHub rate limited the request. Try again later.",
    "error.NETWORK_ERROR": "The network request failed.",
    "error.BAD_RESPONSE": "The update source returned an unrecognized response.",
    "error.INTERNAL_ERROR": "Update failed. Try again later.",
    "error.URL_NOT_HTTPS": "The update URL must use HTTPS.",
    "error.URL_USER_INFO": "The update URL cannot contain a username or password.",
    "error.TIMEOUT": "The network request timed out.",
    "error.TLS_ERROR": "The secure connection failed.",
    "error.REDIRECT_LIMIT": "Too many redirects.",
    "error.REDIRECT_NOT_HTTPS": "Redirect URLs must use HTTPS.",
    "error.DOWNLOAD_TOO_LARGE": "The downloaded file is too large.",
    "error.ZIP_TOO_LARGE": "The keyboard package is too large.",
    "error.NOT_ZIP": "The keyboard package has an invalid format.",
    "error.SIGNATURE_MISSING": "The keyboard package has no signature.",
    "error.SIGNATURE_BAD": "Keyboard package signature verification failed.",
    "error.PAYLOAD_HASH": "Keyboard file verification failed.",
    "error.VERSION_MISMATCH": "Keyboard version information is inconsistent.",
    "error.COMPAT_MIN_NATIVE_API": "This Feelime version does not support the package.",
    "error.COMPAT_CAPABILITIES": "The package requires unavailable capabilities.",
    "error.FRAGMENT_PIN_MISMATCH": "The keyboard package fingerprint does not match.",
    "error.IO_ERROR": "A local file operation failed.",
    "error.ENTRY_LIMIT": "The keyboard package contains too many files.",
    "error.DUPLICATE_ENTRY": "The keyboard package contains a duplicate file.",
    "error.PATH_TRAVERSAL": "The keyboard package contains an unsafe path.",
    "error.PATH_ABSOLUTE": "The keyboard package contains an absolute path.",
    "error.PATH_BACKSLASH": "The keyboard package contains an unsafe path format.",
    "error.PATH_NUL": "The keyboard package path contains an invalid character.",
    "error.SYMLINK_OR_SPECIAL": "The keyboard package contains an unsupported special file.",
    "error.UNICODE_CONFLICT": "The keyboard package contains conflicting filenames.",
    "error.UNKNOWN_ENTRY": "The keyboard package contains an unknown file.",
    "error.ENVELOPE_MISSING": "The keyboard package is missing verification metadata.",
    "error.MANIFEST_INVALID_JSON": "The keyboard package manifest is invalid.",
    "error.MANIFEST_UNKNOWN_KEY": "The keyboard package manifest has an unknown field.",
    "error.MANIFEST_MISSING_KEY": "The keyboard package manifest is missing a required field.",
    "error.MANIFEST_LISTS_ENVELOPE": "The keyboard package manifest structure is invalid.",
    "error.MANIFEST_PAYLOAD_ALLOWLIST": "The keyboard package contains disallowed content.",
    "error.KEY_UNKNOWN": "The keyboard package signing key is unknown.",
    "error.PAYLOAD_LENGTH": "Keyboard file size verification failed.",
    "error.INFLATED_TOO_LARGE": "The unpacked keyboard package is too large.",
    "error.HOTWORDS_TRUNCATED": "Saved, but {count} hotword lines exceeded the limit (up to {max} lines, {chars} characters each).",
    "error.NO_NETWORK": "No network connection is available.",
    "error.STALE_CONFIRMATION": "The download confirmation expired; tap Download again.",
    "error.MODEL_DOWNLOAD_FAILED": "Model download failed. Try again later.",
    "error.MODEL_IMPORT_FAILED": "Model import failed. Check that this is an official model archive and try again.",
    "error.MODEL_IMPORT_BUSY": "The model is already being processed.",
    "error.MODEL_NETWORK_CHANGED": "The network changed and the download paused. Confirm and try again.",
    "error.INVALID_MODEL_SOURCE": "A custom source needs an HTTPS repository URL and its matching tar.bz2 archive URL."
  }
};
const PAGES = ["home", "appearance", "skin", "input", "fuzzy", "landscape", "keyboards", "dict", "phrases", "userwords", "voice", "update", "backup", "about", "customkeys", "cksymbol", "cklang", "licenses", "test"];
const ERROR_KEYS = new Set(Object.keys(I18N.zh).filter((key) => key.startsWith("error.")));
const progressPercent = {};
function browserLocale() {
  const value = typeof navigator !== "undefined" && navigator.language || window.navigator && window.navigator.language || "zh-CN";
  return String(value).toLowerCase().startsWith("zh") ? "zh" : "en";
}
__name(browserLocale, "browserLocale");
function normalizeChoice(value) {
  return ["auto", "zh", "en"].includes(value) ? value : "auto";
}
__name(normalizeChoice, "normalizeChoice");
function normalizeLocale(value) {
  return ["zh", "en"].includes(value) ? value : null;
}
__name(normalizeLocale, "normalizeLocale");
function format(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_all, name) => values[name] === void 0 ? `{${name}}` : String(values[name]));
}
__name(format, "format");
function t(key, values) {
  var _a, _b;
  const dictionary = I18N[uiLocale] || I18N.zh;
  const template = (_b = (_a = dictionary[key]) != null ? _a : I18N.zh[key]) != null ? _b : key;
  return format(template, values);
}
__name(t, "t");
function call(action, ...args) {
  try {
    if (typeof BRIDGE[action] === "function") BRIDGE[action](...args, token);
  } catch (error) {
    console.warn("bridge call failed", action, error);
  }
}
__name(call, "call");
function setTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.className = `theme-${theme}`;
}
__name(setTheme, "setTheme");
function applyAppIcon(dataUri) {
  if (!dataUri) return;
  const mark = $("heroLogo");
  if (!mark || mark.dataset.appIcon === "1") return;
  const img = document.createElement("img");
  img.src = dataUri;
  img.alt = "";
  mark.textContent = "";
  mark.append(img);
  mark.dataset.appIcon = "1";
}
__name(applyAppIcon, "applyAppIcon");
function applyLocale() {
  document.documentElement.lang = uiLocale === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  const language = $("uiLanguage");
  if (language) language.value = uiChoice;
  if (lastState) renderDoublePinyin(lastState);
  if (pendingModelConsent) {
    $("modelConsentMessage").textContent = t("model.consent.message", {
      name: pendingModelConsent.name,
      bytes: mb(pendingModelConsent.bytes)
    });
  }
  if (lastModelError) setNote("modelNote", eventText(lastModelError, "error.MODEL_DOWNLOAD_FAILED"));
}
__name(applyLocale, "applyLocale");
function adoptLocale(state) {
  const choice = normalizeChoice(state && state.uiLanguage);
  if (state && state.uiLanguage !== void 0) uiChoice = choice;
  const resolved = normalizeLocale(state && state.uiLocale);
  const next = resolved || (uiChoice === "auto" ? browserLocale() : uiChoice);
  const changed = next !== uiLocale;
  uiLocale = next;
  if (changed || state && state.uiLanguage !== void 0) applyLocale();
}
__name(adoptLocale, "adoptLocale");
function setUiLanguage(choice) {
  uiChoice = normalizeChoice(choice);
  uiLocale = uiChoice === "auto" ? browserLocale() : uiChoice;
  applyLocale();
  call("setUiLanguage", uiChoice);
}
__name(setUiLanguage, "setUiLanguage");
function mb(bytes) {
  return `${(Number(bytes || 0) / 1048576).toFixed(1)} MB`;
}
__name(mb, "mb");
function modelTitle(model) {
  const key = {
    "streaming-zipformer-bilingual-zh-en": "model.title.streaming",
    "paraformer-zh-small": "model.title.final",
    "offline-punct-zh-en": "model.title.punctuation",
    "online-punct-en": "model.title.punctuation"
    // Legacy model ID.
  }[String(model && model.id || "")];
  return key ? t(key) : String(model && (model.title || model.id) || "");
}
__name(modelTitle, "modelTitle");
function activeKeyboardVersion(state) {
  return state.update && state.update.activeVersion || state.keyboardVersion || "?";
}
__name(activeKeyboardVersion, "activeKeyboardVersion");
function statusSpan(text, className) {
  const span = document.createElement("span");
  span.className = className || "";
  span.textContent = text;
  return span;
}
__name(statusSpan, "statusSpan");
function setNote(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}
__name(setNote, "setNote");
function eventText(event, fallbackKey, values) {
  const code = String(event && (event.code || event.errorCode) || "");
  const key = code ? `error.${code}` : "";
  if (key && ERROR_KEYS.has(key)) {
    const translated = t(key, values || event);
    const detail = String(event && (event.detail || event.errorDetail) || "").trim();
    return detail ? `${translated} ${detail}` : translated;
  }
  if (event && event.message) return String(event.message);
  if (event && (event.detail || event.errorDetail)) return String(event.detail || event.errorDetail);
  return t(fallbackKey, values);
}
__name(eventText, "eventText");
window.FeelimeSettings = {
  // #51 定制按键 setting 型的纯函数出口（自动化/表单回填测试用）。
  ckTapFromDraft,
  ckTapParse,
  /** 系统 BACK 键入口（2026-10-04 用户裁定）：编辑态/脏态时壳侧转进
   *  这里，页面弹框问用户——放弃编辑（退出编辑态，改动保留为脏）/继
   *  继续编辑；脏态复用既有离开确认。普通翻页壳侧自理（onSubPage 逐
   *  级返回），不经此路。 */
  backPressed() {
    var _a;
    const openWebdav = document.querySelector(
      "#webdavBackupModal:not([hidden]), #webdavRestoreModal:not([hidden])"
    );
    if (openWebdav) {
      openWebdav.hidden = true;
      return;
    }
    if (typeof ckEditMode === "undefined" || currentPage !== "customkeys") return;
    const openModal = [...document.querySelectorAll(".ck-modal")].find((el) => !el.hidden);
    if (openModal && openModal.id !== "ckBackModal" && openModal.id !== "ckLeaveModal") {
      openModal.hidden = true;
      return;
    }
    if (ckEditMode) {
      document.getElementById("ckBackModal").hidden = false;
      return;
    }
    if (typeof ckDirty !== "undefined" && ckDirty) {
      const back = document.querySelector('.page[data-page="customkeys"] .page-back');
      ckLeaveTarget = ((_a = back == null ? void 0 : back.dataset) == null ? void 0 : _a.back) || "input";
      document.getElementById("ckLeaveModal").hidden = false;
    }
  },
  onBridgeHello(payload) {
    payload = payload || {};
    token = payload.token || "";
    reportImeGestureSupport();
    resyncImeFocusReport();
    if (payload.theme) setTheme(payload.theme);
    applyAppIcon(payload.appIcon);
    if (payload.uiLanguage !== void 0) uiChoice = normalizeChoice(payload.uiLanguage);
    const helloLocale = normalizeLocale(payload.uiLocale);
    uiLocale = helloLocale || (uiChoice === "auto" ? browserLocale() : uiChoice);
    applyLocale();
    call("ready");
    if (!webdavFormInit) {
      webdavFormInit = true;
      webdavFillConfig();
    }
  },
  onEvent(event) {
    if (!event || !event.type) return;
    switch (event.type) {
      case "state":
        lastState = event.state || {};
        if (lastState.theme) setTheme(lastState.theme);
        adoptLocale(lastState);
        render(lastState);
        break;
      case "modelProgress":
        renderProgress(event);
        break;
      case "modelDownloadConfirmation":
        renderModelConsent(event);
        break;
      case "modelDownloadError":
        lastModelError = event;
        if (!pendingModelConsent || pendingModelConsent.id === String(event.id || "")) hideModelConsent();
        setNote("modelNote", eventText(event, "error.MODEL_DOWNLOAD_FAILED"));
        break;
      case "modelImportStatus":
        renderImportStatus(event);
        break;
      case "modelSourceError":
        setNote("modelNote", eventText(event, "error.INVALID_MODEL_SOURCE"));
        break;
      case "customError":
        setNote("customNote", eventText(event, "error.INVALID_CUSTOM_JSON"));
        break;
      case "customPhrasesError":
        setNote("phrasesNote", eventText(event, "error.BAD_PHRASES_PAYLOAD"));
        break;
      case "bgImageError":
        setNote("bgImageNote", eventText(event, "error.BAD_BG_IMAGE"));
        $("bgImageNote").hidden = false;
        break;
      case "keySoundError":
        setNote("feelNote", eventText(event, "error.KEY_SOUND_FILE"));
        break;
      case "userWordsError":
        setNote("userWordsNote", eventText(event, "error.BAD_PHRASES_PAYLOAD"));
        break;
      case "keyboardsError":
        setNote("keyboardsNote", eventText(event, "error.BAD_KEYBOARD_SELECTION"));
        break;
      case "dictImported":
        setNote("dictImportNote", event.message || "");
        break;
      case "dictBaseProgress":
        onDictBaseProgress(event);
        break;
      case "dictBaseDone":
      case "dictBaseError":
        setNote("dictBaseNote", event.message || "");
        $("dictBaseBuilding").hidden = true;
        dictBasePending = null;
        break;
      case "flypyDone":
      case "flypyError":
        setNote("flypyNote", event.message || "");
        $("flypyBuilding").hidden = true;
        break;
      case "dpSchemeError":
        setNote("dpNote", eventText(event, "error.INVALID_DP_SCHEME"));
        break;
      case "bottomPadError":
      case "candidateFontError":
      case "keycapFontError":
      case "preeditFontError":
      case "feelOptionsError":
      case "fuzzyPinyinError":
        setNote("feelNote", eventText(event, "error.INVALID_FEEL_OPTION"));
        break;
      case "fontImportStatus":
        if (!event.ok && event.code === "CONFIRM_LARGE") {
          const mb2 = Number(event.bytes) > 0 ? (Number(event.bytes) / 1048576).toFixed(1) : "20+";
          $("fontConsentMessage").textContent = t("fontLarge.message", { mb: mb2 });
          $("fontConsent").hidden = false;
          userFontNoteHold = null;
          break;
        }
        $("fontConsent").hidden = true;
        userFontNoteHold = event.ok ? t("input.feel.userFontImported", { name: event.name || "?" }) : t(["IO_ERROR", "TOO_LARGE", "BAD_MAGIC", "BAD_FONT"].includes(event.code) ? `error.font.${event.code}` : "error.font.IO_ERROR");
        $("userFontNote").textContent = userFontNoteHold;
        break;
      case "asrNote":
        if (typeof event.hotwords === "string" && asrHotwordsSubmitted !== null && $("hotwords").value === asrHotwordsSubmitted) {
          $("hotwords").value = event.hotwords;
          asrHotwordsDirty = false;
          asrHotwordsSubmitted = null;
        }
        setNote("asrNote", eventText(event, "note.saved", {
          count: event.count,
          max: event.max || event.maxLines,
          chars: event.chars || event.maxChars
        }));
        break;
      case "updateError":
        if (event.confirmable && event.confirmId) {
          pendingKbSigId = String(event.confirmId);
          $("kbSigConsent").hidden = false;
        } else if (pendingKbSigId) {
          pendingKbSigId = "";
          $("kbSigConsent").hidden = true;
        }
        setNote("updateStatus", eventText(event, "error.INTERNAL_ERROR"));
        break;
      case "backupStatus":
        renderBackupStatus(event);
        break;
      case "webdavStatus":
        renderWebdavStatus(event);
        break;
      case "webdavList":
        renderWebdavList(event);
        break;
      default:
        break;
    }
  },
  showPage,
  focusSetting,
  webdavFillConfig
};
let currentPage = "home";
const pageScrolls = {};
function showPage(name) {
  var _a;
  if (!PAGES.includes(name)) return;
  const CK_FAMILY = ["customkeys", "cksymbol", "cklang"];
  if (typeof ckDirty !== "undefined" && CK_FAMILY.includes(currentPage) && !CK_FAMILY.includes(name) && ckDirty) {
    ckLeaveTarget = name;
    document.getElementById("ckLeaveModal").hidden = false;
    return;
  }
  const wasPreview = currentPage === "skin";
  const wasCustomkeys = currentPage === "customkeys";
  if (wasCustomkeys && name !== "customkeys" && typeof ckEditMode !== "undefined" && ckEditMode) {
    ckEditMode = false;
    document.body.classList.remove("ck-editing");
    if (typeof ckEndDragSession === "function") ckEndDragSession();
    if (typeof ckReportState === "function") ckReportState();
  }
  if (typeof window.scrollTo === "function") pageScrolls[currentPage] = window.scrollY;
  currentPage = name;
  document.querySelectorAll("[data-page]").forEach((node) => {
    node.hidden = node.dataset.page !== name;
  });
  if (typeof window.scrollTo === "function") {
    const memo = pageScrolls[name];
    if (typeof memo === "number" && memo > 0) window.scrollTo(0, memo);
    else window.scrollTo(0, 0);
  }
  if (name === "cksymbol" || name === "cklang") {
    const bar = document.getElementById("ckSaveBar");
    const pageEl = document.querySelector('[data-page="' + name + '"]');
    if (bar && pageEl && bar.parentElement !== pageEl) pageEl.append(bar);
  }
  if (name === "cklang") renderLangKb(ckLangCurrent);
  if (name === "customkeys" && !wasCustomkeys && typeof refreshLangCounts === "function") {
    refreshLangCounts();
  }
  const isPreviewPage = name === "skin";
  if (isPreviewPage && !wasPreview) call("previewKeyboard", true);
  if (!isPreviewPage && wasPreview) call("previewKeyboard", false);
  const back = document.querySelector(`.page[data-page="${name}"] .page-back`);
  call("reportPage", name, ((_a = back == null ? void 0 : back.dataset) == null ? void 0 : _a.back) || "home");
  if (name === "customkeys" && !wasCustomkeys && typeof ckEnter === "function") {
    ckEnter();
  }
  if (name === "cksymbol" && typeof ckEnter === "function") {
    if (!ckRows) ckLoad();
    if (typeof ckSyncJsonView === "function") ckSyncJsonView();
    requestAnimationFrame(() => {
      if (currentPage === "cksymbol") ckRenderRows();
    });
  }
}
__name(showPage, "showPage");
let themeHueShown = 160, themeSatShown = 100;
let keyHueShown = 160, keySatShown = 100;
let keyHueFollow = true, keySatFollow = true, keyLFollow = true;
let themeLShown = 0, keyLShown = 0;
const FEEL_BASE = { theme: { s: 100, l: 50 }, key: { s: 100, l: 50 } };
function hslToHex(h, s, l) {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360 + 360) % 360 / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const ch = /* @__PURE__ */ __name((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"), "ch");
  return ("#" + ch(r) + ch(g) + ch(b)).toUpperCase();
}
__name(hslToHex, "hslToHex");
function hexToHsl(str) {
  const m = /^\s*#?([0-9a-fA-F]{6})\s*$/.exec(String(str || ""));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
__name(hexToHsl, "hexToHsl");
function feelInkOn(bgHex) {
  const channel = /* @__PURE__ */ __name((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }, "channel");
  const lum = /* @__PURE__ */ __name((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
  }, "lum");
  const L = lum(bgHex);
  const better = /* @__PURE__ */ __name((ink) => (Math.max(L, ink) + 0.05) / (Math.min(L, ink) + 0.05), "better");
  return better(lum("#1a1a1a")) >= better(lum("#ffffff")) ? "#1a1a1a" : "#fff";
}
__name(feelInkOn, "feelInkOn");
function hexEditing() {
  const a = document.activeElement;
  return !!a && (a.id === "themeHex" || a.id === "keyHex");
}
__name(hexEditing, "hexEditing");
let themeHexConfirmed = "", keyHexConfirmed = "";
function feelHexOf(group) {
  if (group === "theme") {
    return hslToHex(
      themeHueShown,
      FEEL_BASE.theme.s * themeSatShown / 100,
      FEEL_BASE.theme.l + themeLShown
    );
  }
  const kh = keyHueFollow ? themeHueShown : keyHueShown;
  const ks = keySatFollow ? themeSatShown : keySatShown;
  return hslToHex(kh, FEEL_BASE.key.s * ks / 100, FEEL_BASE.key.l + keyLShown);
}
__name(feelHexOf, "feelHexOf");
function refreshHexBoxes(force) {
  [["themeHex", "themeHexSwatch", "theme"], ["keyHex", "keyHexSwatch", "key"]].forEach(([inputId, swId, group]) => {
    const input = document.getElementById(inputId);
    if (!input || !force && document.activeElement === input) return;
    const hex = feelHexOf(group);
    input.value = hex;
    if (group === "theme") themeHexConfirmed = hex;
    else keyHexConfirmed = hex;
    const sw = document.getElementById(swId);
    if (sw) sw.style.background = hex;
  });
}
__name(refreshHexBoxes, "refreshHexBoxes");
function feelApplyHex(group, hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  const satPct = Math.max(0, Math.min(100, hsl.s));
  const lOff = Math.max(-50, Math.min(50, hsl.l - 50));
  if (group === "theme") {
    themeHueShown = hsl.h;
    themeSatShown = satPct;
    themeLShown = lOff;
    const hueEl = $("themeHue"), satEl = $("themeSat");
    if (hueEl) {
      hueEl.value = String(hsl.h);
      hueEl.style.setProperty("--thumb-hue", String(hsl.h));
    }
    if (satEl) satEl.value = String(satPct);
  } else {
    keyHueFollow = false;
    keySatFollow = false;
    keyHueShown = hsl.h;
    keySatShown = satPct;
    keyLShown = lOff;
    const hueEl = $("keyHue"), satEl = $("keySat");
    if (hueEl) {
      hueEl.value = String(hsl.h);
      hueEl.style.setProperty("--thumb-hue", String(hsl.h));
    }
    if (satEl) satEl.value = String(satPct);
  }
  updateThemePreview();
  return true;
}
__name(feelApplyHex, "feelApplyHex");
function bindHexBox(group) {
  const input = document.getElementById(group === "theme" ? "themeHex" : "keyHex");
  if (!input) return;
  input.oninput = () => {
    const raw = String(input.value || "");
    const applied = feelApplyHex(group, raw);
    const sw = document.getElementById(group === "theme" ? "themeHexSwatch" : "keyHexSwatch");
    if (sw && applied) sw.style.background = raw.trim().replace(/^#?/, "#");
  };
  input.onchange = () => {
    if (!feelApplyHex(group, input.value)) {
      feelApplyHex(group, group === "theme" ? themeHexConfirmed : keyHexConfirmed);
      refreshHexBoxes(true);
      return;
    }
    if (group === "theme") {
      call("setThemeHue", themeHueShown);
      call("setThemeSat", themeSatShown);
      call("setThemeL", themeLShown);
    } else {
      call("setKeyHue", keyHueShown);
      call("setKeySat", keySatShown);
      call("setKeyL", keyLShown);
    }
    refreshHexBoxes(true);
  };
}
__name(bindHexBox, "bindHexBox");
let pvKeyAlpha = 1;
let pvBgLightImg = "none", pvBgDarkImg = "none";
function updateThemePreview() {
  const pv = $("themePreview");
  if (!pv) return;
  pv.style.setProperty("--pv-hue", String(Math.round(themeHueShown)));
  pv.style.setProperty("--pv-sat", String(themeSatShown / 100));
  const kh = keyHueFollow ? themeHueShown : keyHueShown;
  const ks = keySatFollow ? themeSatShown : keySatShown;
  pv.style.setProperty("--pv-key-hue", String(Math.round(kh)));
  pv.style.setProperty("--pv-key-sat", String(ks / 100));
  pv.style.setProperty("--pv-key-alpha", String(pvKeyAlpha));
  pv.style.setProperty("--pv-bg-img-light", pvBgLightImg);
  pv.style.setProperty("--pv-bg-img-dark", pvBgDarkImg);
  pv.style.setProperty("--pv-bg-lt", themeLShown / 50);
  const kl = keyLFollow ? themeLShown : keyLShown;
  pv.style.setProperty("--pv-key-lt", kl / 50);
  refreshHexBoxes();
}
__name(updateThemePreview, "updateThemePreview");
function render(state) {
  state = state || {};
  renderIme(state);
  renderDoublePinyin(state);
  renderFeel(state);
  renderLandscape(state);
  renderVoice(state);
  renderAsr(state);
  renderCustom(state);
  renderKeyboards(state);
  renderCustomPhrases(state);
  renderUserWords(state);
  renderDictBase(state);
  renderFlypy(state);
  renderUpdate(state);
  renderAbout(state);
}
__name(render, "render");
function renderLandscape(state) {
  const safe = $("landscapeSafeArea");
  if (safe && document.activeElement !== safe) safe.checked = state.landscapeSafeArea !== 0;
  const hwkb = $("hwkbForm");
  if (hwkb && document.activeElement !== hwkb) hwkb.value = state.hwkbForm || "candidates";
  const qsp = $("quickSwitchPolicy");
  if (qsp && document.activeElement !== qsp) qsp.value = state.quickSwitchPolicy || "fixed";
  const ceil = $("landscapeCeil");
  const ceilOut = $("landscapeCeilOut");
  const ceilVal = Number(state.landscapeCeil);
  if (ceil && Number.isFinite(ceilVal) && ceilVal >= 40 && ceilVal <= 100 && document.activeElement !== ceil) ceil.value = String(ceilVal);
  if (ceilOut) ceilOut.textContent = Math.round(Number(ceil && ceil.value)) + "%";
  const op = $("landscapeOpacity");
  const opOut = $("landscapeOpacityOut");
  const opVal = Number(state.landscapeOpacity);
  if (op && Number.isFinite(opVal) && opVal >= 10 && opVal <= 100 && document.activeElement !== op) op.value = String(opVal);
  if (opOut) opOut.textContent = Math.round(Number(op && op.value)) + "%";
}
__name(renderLandscape, "renderLandscape");
function renderFeel(state) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
  const setSelect = /* @__PURE__ */ __name((id, value, allowed) => {
    const node = $(id);
    if (!node) return;
    const text = String(value);
    if (allowed.includes(text) && document.activeElement !== node) node.value = text;
  }, "setSelect");
  setSelect("bottomPadPortrait", (_a = state.bottomPadPortrait) != null ? _a : 0, ["0", "12", "24", "36", "48"]);
  setSelect("bottomPadLandscape", (_b = state.bottomPadLandscape) != null ? _b : 0, ["0", "12", "24", "36", "48"]);
  {
    const cand = $("candidateFont");
    const candVal = Number((_c = state.candidateFont) != null ? _c : 100);
    if (Number.isFinite(candVal) && candVal >= 80 && candVal <= 150 && document.activeElement !== cand) {
      cand.value = String(candVal);
    }
    const shown = parseInt(cand.value, 10);
    $("candidateFontOut").textContent = `${Number.isFinite(shown) ? shown : 100}%`;
  }
  {
    const kc = $("keycapFont");
    const kcVal = Number((_d = state.keycapFont) != null ? _d : 100);
    if (Number.isFinite(kcVal) && kcVal >= 50 && kcVal <= 150 && document.activeElement !== kc) {
      kc.value = String(kcVal);
    }
    const shown = parseInt(kc.value, 10);
    $("keycapFontOut").textContent = `${Number.isFinite(shown) ? shown : 100}%`;
  }
  {
    const font = state.userFont || {};
    $("btnClearFont").hidden = !font.digest;
    $("userFontNote").textContent = userFontNoteHold !== null ? userFontNoteHold : font.digest ? t("input.feel.userFontActive", { name: font.name || "?" }) : "";
  }
  setSelect("preeditFont", (_e = state.preeditFont) != null ? _e : 0, ["0", "1", "2"]);
  setSelect("oneHand", (_f = state.oneHand) != null ? _f : 0, ["0", "1", "2"]);
  setSelect("oneHandPad", (_g = state.oneHandPad) != null ? _g : 0, ["0", "15", "25", "35"]);
  setSelect("sideContent", (_h = state.sideContent) != null ? _h : 0, ["0", "1"]);
  const themeSel = $("themeMode");
  if (themeSel) {
    const mode = state.themeMode || "auto";
    themeSel.value = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
  }
  const swatches = $("themePresetSwatches");
  const tl = Number(state.themeL);
  if (Number.isFinite(tl) && tl >= -50 && tl <= 50) themeLShown = Math.round(tl);
  const klv = Number(state.keyL);
  if (Number.isFinite(klv) && (klv === -1 || klv >= -50 && klv <= 50)) {
    keyLFollow = klv === -1;
    keyLShown = keyLFollow ? Number.isFinite(tl) ? Math.round(tl) : 0 : Math.round(klv);
  }
  bindHexBox("theme");
  bindHexBox("key");
  const keyFollow = $("keyFollow");
  if (keyFollow) {
    if (document.activeElement !== keyFollow) keyFollow.checked = keyHueFollow && keySatFollow;
    keyFollow.onchange = () => {
      if (keyFollow.checked) {
        call("setKeyHue", -1);
        call("setKeySat", -1);
        call("setKeyL", -1);
      } else {
        call("setKeyHue", keyHueFollow ? themeHueShown : keyHueShown);
        call("setKeySat", keySatFollow ? themeSatShown : keySatShown);
        call("setKeyL", keyLShown);
      }
    };
  }
  const hueInput = $("themeHue");
  const hue = Number(state.themeHue);
  const hasCustomHue = Number.isFinite(hue) && hue >= 0 && hue <= 360;
  if (swatches) {
    const current = !hasCustomHue && THEME_PRESET_LIST.includes(state.themePreset) ? state.themePreset : "";
    swatches.textContent = "";
    THEME_PRESET_LIST.forEach((id) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "preset-swatch" + (id === current ? " active" : "");
      dot.dataset.preset = id;
      dot.style.setProperty("--sw", THEME_PRESET_COLORS[id] || "#23c890");
      dot.setAttribute("aria-label", t("preset." + id));
      dot.setAttribute("aria-pressed", id === current ? "true" : "false");
      dot.addEventListener("click", () => call("setThemePreset", id));
      swatches.append(dot);
    });
  }
  if (hueInput) {
    if (document.activeElement !== hueInput && !hexEditing()) {
      themeHueShown = hasCustomHue ? Math.round(hue) : PRESET_HUE[THEME_PRESET_LIST.includes(state.themePreset) ? state.themePreset : "classic"] || 160;
      hueInput.value = String(themeHueShown);
      hueInput.style.setProperty("--thumb-hue", String(themeHueShown));
    }
    hueInput.classList.toggle("customized", hasCustomHue);
    hueInput.oninput = () => {
      hueInput.style.setProperty("--thumb-hue", hueInput.value);
      const v = Number(hueInput.value);
      if (Number.isFinite(v)) {
        themeHueShown = Math.max(0, Math.min(360, Math.round(v)));
        updateThemePreview();
      }
    };
    hueInput.onchange = () => {
      const v = Math.round(Number(hueInput.value));
      if (Number.isFinite(v) && v >= 0 && v <= 360) call("setThemeHue", v);
    };
  }
  const satInput = $("themeSat");
  if (satInput) {
    const sat = Number(state.themeSat);
    if (document.activeElement !== satInput && !hexEditing()) {
      themeSatShown = Number.isFinite(sat) && sat >= 0 && sat <= 100 ? Math.round(sat) : 100;
      satInput.value = String(themeSatShown);
    }
    satInput.oninput = () => {
      const v = Number(satInput.value);
      if (Number.isFinite(v)) {
        themeSatShown = Math.max(0, Math.min(100, Math.round(v)));
        updateThemePreview();
      }
    };
    satInput.onchange = () => {
      const v = Math.round(Number(satInput.value));
      if (Number.isFinite(v) && v >= 0 && v <= 100) call("setThemeSat", v);
    };
  }
  const keyHueInput = $("keyHue");
  if (keyHueInput) {
    const kv = Number(state.keyHue);
    const hasKeyHue = Number.isFinite(kv) && kv >= 0 && kv <= 360;
    if (document.activeElement !== keyHueInput) keyHueFollow = !hasKeyHue;
    if (document.activeElement !== keyHueInput && !hexEditing()) {
      keyHueShown = hasKeyHue ? Math.round(kv) : themeHueShown;
      keyHueInput.value = String(keyHueShown);
      keyHueInput.style.setProperty("--thumb-hue", String(keyHueShown));
    }
    keyHueInput.classList.toggle("customized", hasKeyHue);
    keyHueInput.oninput = () => {
      keyHueFollow = false;
      keyHueInput.style.setProperty("--thumb-hue", keyHueInput.value);
      const v = Number(keyHueInput.value);
      if (Number.isFinite(v)) {
        keyHueShown = Math.max(0, Math.min(360, Math.round(v)));
        updateThemePreview();
      }
    };
    keyHueInput.onchange = () => {
      const v = Math.round(Number(keyHueInput.value));
      if (Number.isFinite(v) && v >= 0 && v <= 360) call("setKeyHue", v);
    };
    const keySwatches = $("keyHueSwatches");
    if (keySwatches) {
      keySwatches.textContent = "";
      THEME_PRESET_LIST.forEach((id) => {
        const dot = document.createElement("button");
        dot.type = "button";
        const active = hasKeyHue && Math.round(kv) === PRESET_HUE[id];
        dot.className = "preset-swatch" + (active ? " active" : "");
        dot.style.setProperty("--sw", THEME_PRESET_COLORS[id] || "#23c890");
        dot.setAttribute("aria-label", t("preset." + id));
        dot.setAttribute("aria-pressed", active ? "true" : "false");
        dot.addEventListener("click", () => call("setKeyHue", PRESET_HUE[id]));
        keySwatches.append(dot);
      });
    }
  }
  const keySatInput = $("keySat");
  if (keySatInput) {
    const ks = Number(state.keySat);
    const hasKeySat = Number.isFinite(ks) && ks >= 0 && ks <= 100;
    if (document.activeElement !== keySatInput) keySatFollow = !hasKeySat;
    if (document.activeElement !== keySatInput && !hexEditing()) {
      keySatShown = hasKeySat ? Math.round(ks) : themeSatShown;
      keySatInput.value = String(keySatShown);
    }
    keySatInput.oninput = () => {
      keySatFollow = false;
      const v = Number(keySatInput.value);
      if (Number.isFinite(v)) {
        keySatShown = Math.max(0, Math.min(100, Math.round(v)));
        updateThemePreview();
      }
    };
    keySatInput.onchange = () => {
      const v = Math.round(Number(keySatInput.value));
      if (Number.isFinite(v) && v >= 0 && v <= 100) call("setKeySat", v);
    };
  }
  const opacity = $("keyOpacity");
  if (opacity) {
    const opPct = Math.max(5, Math.min(100, Number((_i = state.keyOpacity) != null ? _i : 100)));
    pvKeyAlpha = opPct / 100;
    opacity.value = String(opPct);
  }
  const pvBg = /* @__PURE__ */ __name((imgKey, srcKey) => state[srcKey] && state[srcKey] !== "none" && state[imgKey] ? `url("${state[imgKey].startsWith("https://feelime.local/keyboard/background/") ? state[imgKey] : "data:image/jpeg;base64," + state[imgKey]}")` : "none", "pvBg");
  pvBgLightImg = pvBg("bgImageLight", "bgImageLightSource");
  pvBgDarkImg = pvBg("bgImageDark", "bgImageDarkSource");
  updateThemePreview();
  const bubble = $("keyBubble");
  if (bubble) bubble.checked = state.keyBubble === true;
  const guard = $("cnEnComposingGuard");
  if (guard) guard.checked = state.cnEnComposingGuard === true;
  const lingerSel = $("bubbleLinger");
  if (lingerSel && document.activeElement !== lingerSel) {
    lingerSel.value = String((_j = state.bubbleLinger) != null ? _j : 400);
  }
  const kbHeight = $("kbHeight");
  if (kbHeight) {
    const min = Number((_k = state.kbHeightMin) != null ? _k : 226);
    const max = Number((_l = state.kbHeightMax) != null ? _l : 400);
    kbHeight.min = String(min);
    kbHeight.max = String(max);
    kbHeight.step = "5";
    const saved = Number((_m = state.kbHeightPortrait) != null ? _m : 0);
    kbHeight.value = String(saved >= min ? saved : 272);
    kbHeight.dataset.default = "272";
  }
  [["bgImageLight", "bgImageLightSource"], ["bgImageDark", "bgImageDarkSource"]].forEach(([id, key]) => {
    const sel = $(id);
    if (!sel) return;
    const src = state[key] || "none";
    let opt = sel.querySelector('option[value="custom"]');
    if (src === "custom" && !opt) {
      opt = document.createElement("option");
      opt.value = "custom";
      opt.textContent = t("\u81EA\u5B9A\u4E49");
      sel.append(opt);
    }
    if (opt && src !== "custom") opt.remove();
    sel.value = src === "custom" ? "custom" : src;
  });
  setSelect("holdMs", (_n = state.holdMs) != null ? _n : 350, ["200", "300", "350", "450", "600"]);
  setSelect("kbLayout", state.kbLayout === "14" ? "14" : "26", ["26", "14"]);
  setSelect("scrubSpeed", (_o = state.scrubSpeed) != null ? _o : 3, ["1", "2", "3", "4", "5"]);
  const flickSwap = $("flickSwap");
  if (flickSwap) flickSwap.checked = state.flickSwap === true;
  const doubleShiftLock = $("doubleShiftLock");
  if (doubleShiftLock) doubleShiftLock.checked = state.doubleShiftLock === true;
  setSelect("popupSnap", (_p = state.popupSnap) != null ? _p : 1, ["0", "1", "2"]);
  const setToggle = /* @__PURE__ */ __name((id, value) => {
    const node = $(id);
    if (node && document.activeElement !== node) node.checked = !!value;
  }, "setToggle");
  setToggle("keySound", state.keySound);
  const vol = $("keySoundVolume");
  if (vol && document.activeElement !== vol) vol.value = String((_q = state.keySoundVolume) != null ? _q : 60);
  setSelect("keyHapticStrength", String((_r = state.keyHapticStrength) != null ? _r : 1), ["0", "1", "2"]);
  {
    const style = state.keySoundStyle || "default";
    const sel = $("keySoundStyle");
    if (sel && document.activeElement !== sel) sel.value = style;
    const name = $("keySoundName");
    if (name) name.textContent = state.keySoundName ? t("feel.keySound.current") + state.keySoundName : t("feel.keySound.none");
    const fileRow = $("keySoundFileRow");
    if (fileRow) fileRow.hidden = !(style === "custom" || state.keySoundName);
  }
  setToggle("keyHaptic", state.keyHaptic);
  setToggle("preeditBold", state.preeditBold);
}
__name(renderFeel, "renderFeel");
function renderDoublePinyin(state) {
  const select = $("dpScheme");
  if (!select) return;
  const known = window.FeelimeDp && window.FeelimeDp.schemes || ["ziranma", "flypy", "sogou"];
  const scheme = known.includes(state.dpScheme) ? state.dpScheme : "ziranma";
  if (document.activeElement !== select) select.value = scheme;
  const mask = Number(state.fuzzyPinyinMask) || 0;
  document.querySelectorAll("input[data-fuzzy-bit]").forEach((box) => {
    if (document.activeElement === box) return;
    box.checked = (mask & Number(box.dataset.fuzzyBit)) !== 0;
  });
  if (document.activeElement !== $("associationOn")) {
    $("associationOn").checked = !!state.associationOn;
  }
  if (document.activeElement !== $("backspaceAssocOn")) {
    $("backspaceAssocOn").checked = !!state.backspaceAssocOn;
  }
  if (document.activeElement !== $("wxSlashOn")) {
    $("wxSlashOn").checked = !!state.wxSlashOn;
  }
  if (document.activeElement !== $("dynamicDateTimeOn")) {
    $("dynamicDateTimeOn").checked = state.dynamicDateTimeOn !== false;
  }
  $("dpNote").textContent = t(`input.double.note.${select.value}`);
  renderDpKeymap(select.value);
}
__name(renderDoublePinyin, "renderDoublePinyin");
function renderDpKeymap(scheme) {
  const host = $("dpKeymap");
  if (!host) return;
  host.replaceChildren();
  const data = window.FeelimeDp || {};
  const rows = data.maps && data.maps[scheme];
  if (!Array.isArray(rows)) return;
  const caption = document.createElement("div");
  caption.className = "hint block";
  caption.textContent = t("input.double.mapCaption");
  host.append(caption);
  rows.forEach((cells) => {
    const row = document.createElement("div");
    row.className = "kmap-row";
    cells.forEach(([key, first, second, initial]) => {
      const cell = document.createElement("div");
      cell.className = "kmap-key";
      const cap = document.createElement("b");
      cap.textContent = key === ";" ? ";" : key.toUpperCase();
      cell.append(cap);
      [first, second].forEach((final) => {
        if (!final) return;
        const fin = document.createElement("span");
        fin.textContent = final;
        cell.append(fin);
      });
      if (initial) {
        const ini = document.createElement("i");
        ini.textContent = initial;
        cell.append(ini);
      }
      row.append(cell);
    });
    host.append(row);
  });
}
__name(renderDpKeymap, "renderDpKeymap");
function renderIme(state) {
  const ime = state.ime || {};
  setLed("imeEnabledRow", !!ime.enabled);
  setLed("imeDefaultRow", !!ime.isDefault);
  $("btnEnableIme").hidden = !!ime.enabled;
  $("btnPickIme").hidden = !!ime.isDefault;
}
__name(renderIme, "renderIme");
function setLed(rowId, ok) {
  const row = $(rowId);
  if (!row) return;
  const led = row.querySelector("[data-led]");
  if (led) led.className = `led ${ok ? "ok" : "warn"}`;
}
__name(setLed, "setLed");
function renderVoice(state) {
  renderSpaceHold(state);
  if (document.activeElement !== $("modelBackend")) {
    $("modelBackend").value = state.modelBackend === "remote" ? "remote" : "auto";
  }
  const source = state.modelDownloadSource || {};
  if (document.activeElement !== $("modelDownloadCustom")) {
    $("modelDownloadCustom").value = source.customBase || "";
  }
  renderModelSourceRows(source, state.modelSourceSpeed || {});
  $("modelSourceCustomBox").hidden = source.mode !== "custom";
  const mic = state.mic || {};
  setLed("micRow", !!mic.granted);
  $("btnMic").hidden = !!mic.granted;
  const host = $("modelRows");
  const models = Array.isArray(state.models) ? state.models : [];
  const existing = new Map([...host.querySelectorAll(".model")].map((node) => [node.dataset.id, node]));
  const current = /* @__PURE__ */ new Set();
  models.forEach((model) => {
    current.add(model.id);
    let node = existing.get(model.id);
    if (!node) {
      node = buildModelRow(model);
      host.append(node);
    }
    updateModelRow(node, model);
  });
  existing.forEach((node, id) => {
    if (!current.has(id)) node.remove();
  });
}
__name(renderVoice, "renderVoice");
function renderModelSourceRows(source, speed) {
  const host = $("modelSourceRows");
  if (!host) return;
  const mode = ["gitee", "github", "ghproxy", "custom"].includes(source.mode) ? source.mode : "gitee";
  const entries = Object.entries(speed).filter(([key]) => key !== "running");
  const values = entries.map(([, value]) => value).filter((value) => value > 0);
  const fastest = values.length ? Math.min(...values) : null;
  const button = $("btnSpeedTest");
  if (button) {
    button.disabled = !!speed.running;
    button.textContent = speed.running ? t("voice.downloadSource.testing") : t("voice.downloadSource.speedTest");
  }
  host.querySelectorAll(".source-row").forEach((node) => node.remove());
  [
    ["gitee", "voice.downloadSource.gitee"],
    ["github", "voice.downloadSource.github"],
    ["ghproxy", "voice.downloadSource.ghproxy"],
    ["custom", "voice.downloadSource.custom"]
  ].forEach(([value, labelKey]) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `source-row${mode === value ? " active" : ""}`;
    row.setAttribute("role", "radio");
    row.setAttribute("aria-checked", mode === value ? "true" : "false");
    const label = document.createElement("span");
    label.className = "source-row-label";
    const dot = document.createElement("i");
    dot.className = "source-dot";
    dot.textContent = mode === value ? "\u25CF" : "\u25CB";
    label.append(dot);
    const labelText = document.createElement("span");
    labelText.textContent = t(labelKey);
    label.append(labelText);
    if (fastest !== null && speed[value] === fastest && value !== "custom") {
      const badge = document.createElement("em");
      badge.className = "source-fastest";
      badge.textContent = t("voice.downloadSource.fastest");
      label.append(badge);
    }
    row.append(label);
    if (Object.prototype.hasOwnProperty.call(speed, value)) {
      const result = document.createElement("span");
      result.className = speed[value] > 0 ? "source-ms" : "source-fail";
      result.textContent = speed[value] > 0 ? `${speed[value]} ms` : t("voice.downloadSource.unavailable");
      row.append(result);
    }
    row.addEventListener("click", () => {
      if (value === "custom") {
        $("modelSourceCustomBox").hidden = false;
        $("modelDownloadCustom").focus();
        return;
      }
      call("setModelDownloadSource", value, $("modelDownloadCustom").value || "");
      setNote("modelNote", t("note.saved"));
    });
    host.append(row);
  });
}
__name(renderModelSourceRows, "renderModelSourceRows");
function buildModelRow(model) {
  const node = document.createElement("div");
  node.className = "model";
  node.dataset.id = model.id;
  node.innerHTML = `
        <div class="model-head">
            <span class="model-name"></span>
            <span class="model-size"></span>
        </div>
        <p class="model-status"></p>
        <div class="progress" hidden><i></i></div>
        <div class="model-actions"></div>`;
  node.querySelector(".model-name").textContent = modelTitle(model);
  node.querySelector(".model-size").textContent = mb(model.sizeBytes);
  const actions = node.querySelector(".model-actions");
  const button = /* @__PURE__ */ __name((kind, className, textKey) => {
    const buttonNode = document.createElement("button");
    buttonNode.type = "button";
    buttonNode.className = `btn small ${className}`.trim();
    buttonNode.textContent = t(textKey);
    buttonNode.setAttribute("aria-label", `${t(textKey)}: ${modelTitle(model)}`);
    buttonNode.dataset.action = kind;
    if (kind === "download") buttonNode.addEventListener("click", () => {
      lastModelError = null;
      setNote("modelNote", "");
      call("downloadModel", model.id);
    });
    if (kind === "cancel") buttonNode.addEventListener("click", () => call("cancelModelDownload"));
    if (kind === "remove") buttonNode.addEventListener("click", () => call("deleteModel", model.id));
    if (kind === "import") buttonNode.addEventListener("click", () => {
      lastModelError = null;
      setNote("modelNote", "");
      call("openModelDocument", model.id);
    });
    return buttonNode;
  }, "button");
  actions.append(
    button("download", "primary", "model.download"),
    button("cancel", "", "model.cancel"),
    button("remove", "link", "model.remove"),
    button("import", "", "model.import")
  );
  return node;
}
__name(buildModelRow, "buildModelRow");
function updateModelRow(node, model) {
  const status = node.querySelector(".model-status");
  const bar = node.querySelector(".progress");
  const download = node.querySelector('[data-action="download"]');
  const cancel = node.querySelector('[data-action="cancel"]');
  const remove = node.querySelector('[data-action="remove"]');
  const importer = node.querySelector('[data-action="import"]');
  node.querySelector(".model-name").textContent = modelTitle(model);
  const hasArchive = model.downloadBytes > model.sizeBytes && model.state !== "built_in" && model.state !== "installed";
  node.querySelector(".model-size").textContent = hasArchive ? t("model.transferSize", { download: mb(model.downloadBytes), installed: mb(model.sizeBytes) }) : mb(model.sizeBytes);
  node.querySelectorAll("[data-action]").forEach((button) => {
    const key = {
      download: model.state === "broken" ? "model.redownload" : "model.download",
      cancel: "model.cancel",
      remove: "model.remove",
      import: "model.import"
    }[button.dataset.action];
    if (key) {
      button.textContent = t(key);
      button.setAttribute("aria-label", `${t(key)}: ${modelTitle(model)}`);
    }
  });
  status.className = "model-status";
  bar.hidden = true;
  cancel.hidden = true;
  remove.hidden = true;
  importer.hidden = false;
  download.hidden = true;
  switch (model.state) {
    case "built_in":
      if (model.errorCode) {
        status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
        status.classList.add("bad");
        download.textContent = t("model.redownload");
        download.hidden = false;
      } else {
        status.textContent = t("model.builtIn");
        status.classList.add("ok");
      }
      break;
    case "installed":
      if (model.errorCode) {
        status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
        status.classList.add("bad");
        download.textContent = t("model.redownload");
        download.hidden = false;
        remove.hidden = false;
      } else {
        status.textContent = t("model.installed");
        status.classList.add("ok");
        remove.hidden = false;
      }
      break;
    case "downloading":
      status.textContent = t("model.downloading", { percent: lastPercentFor(model.id) });
      status.classList.add("warn");
      bar.hidden = false;
      bar.firstElementChild.style.width = `${lastPercentFor(model.id)}%`;
      cancel.hidden = false;
      importer.hidden = true;
      break;
    case "importing":
      status.textContent = t("model.importing");
      status.classList.add("warn");
      bar.hidden = false;
      cancel.hidden = false;
      importer.hidden = true;
      break;
    case "broken":
      status.textContent = model.errorCode ? eventText(model, "error.MODEL_DOWNLOAD_FAILED") : t("model.broken");
      status.classList.add("bad");
      download.textContent = t("model.redownload");
      download.hidden = false;
      break;
    default:
      if (model.errorCode) {
        status.textContent = eventText(model, "error.MODEL_DOWNLOAD_FAILED");
        status.classList.add("bad");
        download.textContent = t("model.redownload");
      } else {
        status.textContent = t("model.missing", { size: mb(model.downloadBytes || model.sizeBytes) });
        download.textContent = t("model.download");
      }
      download.hidden = false;
      break;
  }
}
__name(updateModelRow, "updateModelRow");
function lastPercentFor(id) {
  var _a;
  return (_a = progressPercent[id]) != null ? _a : 0;
}
__name(lastPercentFor, "lastPercentFor");
function renderProgress(event) {
  const percent = Math.max(0, Math.min(100, Number(event.percent) || 0));
  progressPercent[event.id] = percent;
  const node = document.querySelector(`.model[data-id="${event.id}"]`);
  if (!node) return;
  const bar = node.querySelector(".progress");
  const status = node.querySelector(".model-status");
  bar.hidden = false;
  bar.firstElementChild.style.width = `${percent}%`;
  status.textContent = t("model.downloadingBytes", {
    percent,
    done: mb(event.doneBytes),
    total: mb(event.totalBytes)
  });
}
__name(renderProgress, "renderProgress");
function renderImportStatus(event) {
  const node = document.querySelector(`.model[data-id="${event.id}"]`);
  if (!node) return;
  const status = node.querySelector(".model-status");
  const labels = {
    reading: "model.importing",
    validating: "model.importValidating",
    installing: "model.importInstalling"
  };
  status.textContent = t(labels[event.status] || "model.importing");
  status.className = "model-status warn";
}
__name(renderImportStatus, "renderImportStatus");
function renderModelConsent(event) {
  lastModelError = null;
  pendingModelConsent = {
    id: String(event.id || ""),
    name: String(event.name || event.id || ""),
    bytes: Number(event.bytes || 0)
  };
  const consent = $("modelConsent");
  consent.hidden = false;
  $("modelConsentMessage").textContent = t("model.consent.message", {
    name: pendingModelConsent.name,
    bytes: mb(pendingModelConsent.bytes)
  });
  setNote("modelNote", "");
}
__name(renderModelConsent, "renderModelConsent");
function hideModelConsent() {
  pendingModelConsent = null;
  const consent = $("modelConsent");
  if (consent) consent.hidden = true;
}
__name(hideModelConsent, "hideModelConsent");
let asrHotwordsDirty = false;
function renderAsr(state) {
  const asr = state.asr || {};
  $("asrIdleUnload").checked = asr.idleUnload === true;
  const field = $("hotwords");
  if ((asr.hotwords || "") === field.value) asrHotwordsDirty = false;
  if (document.activeElement !== field && !asrHotwordsDirty) field.value = asr.hotwords || "";
  if (document.activeElement !== $("stripPeriod")) $("stripPeriod").checked = !!asr.stripPeriod;
  if (document.activeElement !== $("numItn")) $("numItn").checked = asr.itn === true;
}
__name(renderAsr, "renderAsr");
function renderCustom(state) {
  const custom = state.custom || {};
  $("customSummary").textContent = customSummary(custom.summary);
  const ckStatus = document.getElementById("ckStatus");
  if (ckStatus) ckStatus.textContent = customSummary(custom.summary);
  const symCard = document.getElementById("ckSymCard");
  if (symCard) symCard.hidden = custom.enabled === false;
  if (document.activeElement !== $("customEnabled")) $("customEnabled").checked = !!custom.enabled;
  if (document.activeElement !== $("customJson") && !$(`customJson`).value && !ckDirty) {
    $("customJson").value = custom.json || "";
  }
}
__name(renderCustom, "renderCustom");
function customSummary(summary) {
  const raw = String(summary || "");
  if (!raw || raw === "\u672A\u5B9A\u5236" || raw.toLowerCase() === "no custom keys") return t("custom.none");
  const count = raw.match(/(?:已定制\s*(\d+)|(?:custom keys?\s*)?(\d+)\s*custom keys?)/i);
  return count ? t("custom.count", { count: count[1] || count[2] }) : raw;
}
__name(customSummary, "customSummary");
let phraseItems = null;
let phraseEditing = -1;
function phraseState() {
  return { enabled: !!$("phrasesOn").checked, items: phraseItems };
}
__name(phraseState, "phraseState");
let searchIndex = null;
function buildSearchIndex() {
  const entries = [];
  document.querySelectorAll(".page").forEach((page) => {
    var _a;
    const pageName = page.dataset.page;
    if (pageName === "home") return;
    const pageTitle = ((_a = page.querySelector(".page-title")) == null ? void 0 : _a.textContent) || pageName;
    page.querySelectorAll("section.card").forEach((card) => {
      var _a2;
      const heading = card.querySelector(".section-heading h2");
      const title = ((_a2 = heading == null ? void 0 : heading.textContent) == null ? void 0 : _a2.trim()) || "";
      const cardKey = (heading == null ? void 0 : heading.id) || title;
      card.querySelectorAll(".row, label.row").forEach((row) => {
        var _a3, _b;
        const label = row.querySelector(".row-label span") || row.querySelector(".row-label");
        const labelText = ((_a3 = label == null ? void 0 : label.textContent) == null ? void 0 : _a3.trim()) || "";
        const hintParts = [];
        row.querySelectorAll("small").forEach((node) => hintParts.push(node.textContent));
        const keywords = [];
        row.querySelectorAll("[data-keywords]").forEach((node) => keywords.push(node.dataset.keywords));
        if (!labelText && !hintParts.length && !keywords.length) return;
        const control = row.querySelector("select[id], input[id], button[id]");
        const anchorId = control && control.id || ((_b = row.querySelector("[data-keywords][id]")) == null ? void 0 : _b.id) || row.id || (heading == null ? void 0 : heading.id) || "";
        entries.push({
          page: pageName,
          pageTitle,
          title: labelText || title,
          desc: hintParts.join(" ").replace(/\s+/g, " ").trim(),
          anchorId,
          anchorEl: row,
          cardKey,
          rowHit: true,
          text: [labelText, ...hintParts, ...keywords, title].filter(Boolean).join(" ").replace(/\s+/g, " ")
        });
      });
      const parts = [title];
      card.querySelectorAll(".row-label span, .row-label small").forEach((node) => {
        parts.push(node.textContent);
      });
      entries.push({
        page: pageName,
        pageTitle,
        title,
        desc: "",
        anchorId: (heading == null ? void 0 : heading.id) || "",
        anchorEl: heading || card,
        cardKey,
        rowHit: false,
        text: parts.filter(Boolean).join(" ").replace(/\s+/g, " ")
      });
    });
  });
  return entries;
}
__name(buildSearchIndex, "buildSearchIndex");
function flashAnchor(el) {
  if (!el) return;
  el.classList.remove("search-flash");
  void el.offsetWidth;
  el.classList.add("search-flash");
  setTimeout(() => el.classList.remove("search-flash"), 2100);
}
__name(flashAnchor, "flashAnchor");
function focusSetting(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const page = el.closest(".page");
  if (page && page.dataset.page) showPage(page.dataset.page);
  const row = el.closest(".row, label.row, section.card") || el;
  if (typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "center" });
  }
  flashAnchor(row);
  if (window.location) {
    lastAppliedHash = "#" + id;
    window.location.hash = lastAppliedHash;
  }
  return true;
}
__name(focusSetting, "focusSetting");
let lastAppliedHash = "";
function applyLocationHash() {
  const hash = window.location && window.location.hash || "";
  if (!hash || hash === lastAppliedHash) return;
  focusSetting(hash.slice(1));
}
__name(applyLocationHash, "applyLocationHash");
function runSettingsSearch(query) {
  const box = $("searchResults");
  if (!box) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    box.hidden = true;
    box.textContent = "";
    return;
  }
  if (!searchIndex) searchIndex = buildSearchIndex();
  const matched = searchIndex.filter((entry) => entry.text.toLowerCase().includes(q));
  matched.sort((a, b) => (b.title.toLowerCase().includes(q) ? 1 : 0) - (a.title.toLowerCase().includes(q) ? 1 : 0));
  const rowCards = new Set(matched.filter((e) => e.rowHit).map((e) => e.cardKey));
  const hits = matched.filter((e) => e.rowHit || !rowCards.has(e.cardKey)).slice(0, 12);
  box.textContent = "";
  if (!hits.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = t("search.noResults");
    box.append(empty);
  } else {
    hits.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-hit";
      const main = document.createElement("span");
      main.className = "search-hit-main";
      const label = document.createElement("span");
      label.textContent = entry.title || entry.pageTitle;
      main.append(label);
      if (entry.desc) {
        const desc = document.createElement("small");
        desc.className = "search-hit-desc";
        desc.textContent = entry.desc;
        main.append(desc);
      }
      const where = document.createElement("small");
      where.className = "search-hit-page";
      where.textContent = entry.pageTitle;
      button.append(main, where);
      button.addEventListener("click", () => {
        $("settingsSearch").value = "";
        box.hidden = true;
        if (entry.anchorId) {
          focusSetting(entry.anchorId);
        } else {
          showPage(entry.page);
          if (entry.anchorEl) {
            if (typeof entry.anchorEl.scrollIntoView === "function") {
              entry.anchorEl.scrollIntoView({ block: "center" });
            }
            flashAnchor(entry.anchorEl);
          }
        }
      });
      box.append(button);
    });
  }
  box.hidden = false;
}
__name(runSettingsSearch, "runSettingsSearch");
$("settingsSearch").addEventListener("input", (event) => runSettingsSearch(event.target.value));
function selectedMenuModes(state) {
  const raw = state.keyboards && state.keyboards.menuModes || "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed.filter((x) => typeof x === "string");
  } catch (_) {
  }
  return DEFAULT_MENU_MODES.slice();
}
__name(selectedMenuModes, "selectedMenuModes");
function selectedQuickPair(state) {
  const raw = state.keyboards && state.keyboards.quickPair || "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 2) return parsed;
  } catch (_) {
  }
  return ["pinyin", "direct"];
}
__name(selectedQuickPair, "selectedQuickPair");
function selectedModeOrder(state) {
  const raw = state.keyboards && state.keyboards.modeOrder || "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      const known = parsed.filter((id) => KEYBOARD_MODES.some(([m]) => m === id));
      KEYBOARD_MODES.forEach(([id]) => {
        if (!known.includes(id)) known.push(id);
      });
      return known;
    }
  } catch (_) {
  }
  return null;
}
__name(selectedModeOrder, "selectedModeOrder");
function renderKeyboards(state) {
  const host = $("kbModeList");
  if (!host) return;
  const selected = selectedMenuModes(state);
  host.textContent = "";
  const ordered = selectedModeOrder(state) || KEYBOARD_MODES.map(([id]) => id);
  ordered.forEach((id) => {
    const found = KEYBOARD_MODES.find(([modeId]) => modeId === id);
    const label = found ? found[1] : id;
    const row = document.createElement("div");
    row.className = "row switch-row";
    const btns = document.createElement("span");
    btns.className = "kb-order-btns";
    const drag = document.createElement("button");
    drag.type = "button";
    drag.className = "btn small kb-drag";
    drag.textContent = "\u2261";
    drag.setAttribute("aria-label", t("input.keyboards.drag"));
    drag.addEventListener("pointerdown", (e) => beginKbRowDrag(e, row, drag));
    btns.append(drag);
    const lab = document.createElement("label");
    lab.className = "kb-order-label";
    lab.htmlFor = "kbMode_" + id;
    const text = document.createElement("span");
    text.className = "row-label";
    const main = document.createElement("span");
    main.textContent = label;
    text.append(main);
    const box = document.createElement("input");
    box.type = "checkbox";
    box.id = "kbMode_" + id;
    box.className = "toggle";
    box.dataset.kbMode = id;
    box.checked = selected.includes(id);
    box.addEventListener("change", () => saveKeyboardSelectionFromUi());
    lab.append(text, box);
    row.append(btns, lab);
    host.append(row);
  });
  renderQuickPairSelects(state);
}
__name(renderKeyboards, "renderKeyboards");
function beginKbRowDrag(e, row, handle) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  e.preventDefault();
  const host = row.parentElement;
  if (!host) return;
  const pid = e.pointerId;
  let startY = e.clientY;
  let moved = false;
  try {
    host.setPointerCapture(pid);
  } catch (_) {
  }
  const move = /* @__PURE__ */ __name((ev) => {
    if (ev.pointerId !== pid) return;
    if (!moved && Math.abs(ev.clientY - startY) < 6) return;
    moved = true;
    row.classList.add("dragging");
    const siblings = [...host.children].filter((r) => r !== row);
    let anchor = null;
    for (const sib of siblings) {
      const rc = sib.getBoundingClientRect();
      if (ev.clientY < rc.top + rc.height / 2) {
        anchor = sib;
        break;
      }
    }
    const inPlace = anchor ? row.nextSibling === anchor : host.lastElementChild === row;
    if (!inPlace) host.insertBefore(row, anchor);
  }, "move");
  const finish = /* @__PURE__ */ __name((ev) => {
    if (ev.pointerId !== pid && ev.type !== "lostpointercapture") return;
    try {
      host.releasePointerCapture(pid);
    } catch (_) {
    }
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerup", finish);
    host.removeEventListener("pointercancel", finish);
    host.removeEventListener("lostpointercapture", finish);
    row.classList.remove("dragging");
    if (moved) saveKeyboardSelectionFromUi();
  }, "finish");
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", finish);
  host.addEventListener("pointercancel", finish);
  host.addEventListener("lostpointercapture", finish);
}
__name(beginKbRowDrag, "beginKbRowDrag");
function renderQuickPairSelects(state) {
  const selected = selectedMenuModes(state);
  const pair = selectedQuickPair(state);
  [$("quickPairA"), $("quickPairB")].forEach((sel, slot) => {
    if (!sel) return;
    sel.textContent = "";
    KEYBOARD_MODES.forEach(([id, label]) => {
      if (!selected.includes(id)) return;
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      sel.append(option);
    });
    if (!selected.includes(pair[slot])) sel.value = selected[0] || "";
    else sel.value = pair[slot];
    if (sel.dataset.bound !== "1") {
      sel.dataset.bound = "1";
      sel.addEventListener("change", () => saveKeyboardSelectionFromUi());
    }
  });
}
__name(renderQuickPairSelects, "renderQuickPairSelects");
function saveKeyboardSelectionFromUi() {
  const boxes = [...document.querySelectorAll("#kbModeList input[data-kb-mode]")];
  const order = boxes.map((box) => box.dataset.kbMode);
  const modes = boxes.filter((box) => box.checked).map((box) => box.dataset.kbMode);
  if (!modes.length) {
    setNote("keyboardsNote", t("input.keyboards.hint"));
    return;
  }
  const pair = [$("quickPairA").value || modes[0], $("quickPairB").value || modes[0]].filter((id) => modes.includes(id));
  while (pair.length < 2) pair.push(modes.find((m) => !pair.includes(m)) || modes[0]);
  call("saveKeyboardSelection", JSON.stringify(modes), JSON.stringify(pair.slice(0, 2)), JSON.stringify(order));
  renderQuickPairSelects({ keyboards: { menuModes: JSON.stringify(modes), quickPair: JSON.stringify(pair.slice(0, 2)), modeOrder: JSON.stringify(order) } });
  setNote("keyboardsNote", t("input.keyboards.saved"));
}
__name(saveKeyboardSelectionFromUi, "saveKeyboardSelectionFromUi");
function renderCustomPhrases(state) {
  const phrases = state.customPhrases;
  if (phrases) {
    const ranks = phrases.symbolRanks && typeof phrases.symbolRanks === "object" ? phrases.symbolRanks : {};
    phraseItems = (phrases.items || []).map((item) => ({
      text: String(item.text || ""),
      code: String(item.code || ""),
      rank: Number(ranks[item.text] || 0) || 0
    }));
    if (document.activeElement !== $("phrasesOn")) $("phrasesOn").checked = !!phrases.enabled;
    const freqSort = $("symbolFreqSort");
    if (freqSort && document.activeElement !== freqSort) {
      freqSort.checked = phrases.symbolFreqSort === true;
    }
    if (document.activeElement !== $("englishWordsOn")) $("englishWordsOn").checked = phrases.englishEnabled !== false;
    const posSel = $("englishPos");
    if (posSel) {
      const pos = [-1, 1, 3, 5].includes(Number(state.englishPos)) ? Number(state.englishPos) : -1;
      if (document.activeElement !== posSel) posSel.value = String(pos);
      if (!posSel.dataset.bound) {
        posSel.dataset.bound = "1";
        posSel.addEventListener("change", () => {
          const v = Number(posSel.value);
          if ([-1, 1, 3, 5].includes(v)) call("setEnglishPos", v);
        });
      }
    }
    renderPhraseList();
    const imported = phrases.importedCount || 0;
    const note = $("dictImportNote");
    if (note) {
      if (imported === 0 || !note.textContent) {
        note.textContent = imported ? t("input.phrases.importedCount", [imported]) : "";
      }
    }
    const clear = $("btnClearImportedDict");
    if (clear) clear.hidden = imported === 0;
    if (clearDictArmed) disarmClearDict();
  }
}
__name(renderCustomPhrases, "renderCustomPhrases");
function phraseStateReady() {
  if (phraseItems !== null) return true;
  setNote("phrasesNote", t("phrases.err.notReady"));
  return false;
}
__name(phraseStateReady, "phraseStateReady");
function renderPhraseList() {
  const list = $("phraseList");
  list.textContent = "";
  phraseItems.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "phrase-row";
    const label = document.createElement("button");
    label.type = "button";
    label.className = "phrase-edit";
    const text = document.createElement("span");
    text.className = "phrase-text";
    text.textContent = item.text;
    const code = document.createElement("code");
    code.textContent = item.code;
    label.append(text, code);
    if (item.rank >= 1 && item.rank <= 9) {
      const rank = document.createElement("code");
      rank.className = "phrase-rank";
      rank.textContent = "\uFF08\u5019\u9009#" + item.rank + "\uFF09";
      rank.setAttribute("aria-label", t("phrases.rank.aria", [item.rank]));
      label.append(rank);
    }
    label.addEventListener("click", () => startPhraseEdit(index));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "phrase-del";
    del.textContent = "\u2715";
    del.setAttribute("aria-label", t("phrases.note.deleted"));
    del.addEventListener("click", () => {
      if (!phraseStateReady()) return;
      phraseItems.splice(index, 1);
      if (phraseEditing === index) resetPhraseForm();
      if (phraseEditing > index) phraseEditing -= 1;
      savePhrases();
      setNote("phrasesNote", t("phrases.note.deleted"));
    });
    row.append(label, del);
    list.append(row);
  });
  $("phraseEmpty").hidden = phraseItems.length > 0;
}
__name(renderPhraseList, "renderPhraseList");
function startPhraseEdit(index) {
  clearImeGestureSnapshots();
  phraseEditing = index;
  $("phraseText").value = phraseItems[index].text;
  $("phraseCode").value = phraseItems[index].code;
  $("phraseRank").value = phraseItems[index].rank >= 1 ? phraseItems[index].rank : "";
  $("btnSavePhrase").textContent = t("phrases.form.save");
  $("btnCancelPhraseEdit").hidden = false;
}
__name(startPhraseEdit, "startPhraseEdit");
function resetPhraseForm() {
  clearImeGestureSnapshots();
  phraseEditing = -1;
  $("phraseText").value = "";
  $("phraseCode").value = "";
  $("phraseRank").value = "";
  $("btnSavePhrase").textContent = t("phrases.form.add");
  $("btnCancelPhraseEdit").hidden = true;
}
__name(resetPhraseForm, "resetPhraseForm");
function savePhrases() {
  const payload = phraseItems.map((item) => ({
    text: item.text,
    code: item.code,
    rank: item.rank >= 1 && item.rank <= 9 ? item.rank : 0
  }));
  call("saveCustomPhrases", JSON.stringify(payload), phraseState().enabled);
}
__name(savePhrases, "savePhrases");
$("phrasesOn").addEventListener("change", (event) => {
  if (!phraseStateReady()) return;
  call(
    "saveCustomPhrases",
    JSON.stringify(phraseItems.map((item) => ({
      text: item.text,
      code: item.code,
      rank: item.rank >= 1 && item.rank <= 9 ? item.rank : 0
    }))),
    event.target.checked
  );
  setNote("phrasesNote", t("phrases.note.saved"));
});
$("symbolFreqSort").addEventListener("change", (event) => {
  call("setSymbolFreqSort", event.target.checked);
});
$("englishWordsOn").addEventListener("change", (event) => {
  call("setEnglishWords", event.target.checked);
});
$("btnManagePhrases").addEventListener("click", () => showPage("phrases"));
$("btnOpenLicenses").addEventListener("click", () => showPage("licenses"));
$("btnImportDict").addEventListener("click", () => call("openDictDocument"));
$("btnBaseDictPick").addEventListener("click", () => call("openBaseDictDocument"));
function dictBaseStageText(stage, elapsedMs) {
  if (stage === "ACTIVATING") return t("dict.base.stageActivate");
  const seconds = Math.round((elapsedMs || 0) / 1e3);
  const label = stage === "COPYING" ? t("dict.base.stageCopy") : t("dict.base.stageCompile");
  return stage === "COPYING" ? label : `${label}\uFF08${t("dict.base.elapsed", [seconds])}\uFF09`;
}
__name(dictBaseStageText, "dictBaseStageText");
let dictBasePending = null;
function dictBaseBuildingText(base) {
  const stage = dictBaseStageText(base.stage || "COMPILING", base.elapsedMs);
  const target = base.building && (base.targetSlot || dictBasePending);
  if (!target) return stage;
  let label = null;
  if (target === "builtin") label = t("dict.base.builtin");
  else {
    const slot = (Array.isArray(base.slots) ? base.slots : []).find((s) => s && s.id === target);
    label = slot ? String(slot.name || slot.id) : null;
  }
  if (!label) return stage;
  const effective = base.mode === "custom" && base.name ? t("dict.base.custom", [base.name]) : t("dict.base.builtin");
  return t("dict.base.switching", [effective, label]) + stage;
}
__name(dictBaseBuildingText, "dictBaseBuildingText");
function onDictBaseProgress(event) {
  if (event.operation === "flypy") {
    $("flypyBuilding").hidden = false;
    $("flypyBuilding").textContent = dictBaseStageText(event.stage, event.elapsedMs);
    return;
  }
  const building = $("dictBaseBuilding");
  building.hidden = false;
  building.textContent = dictBaseBuildingText({
    ...lastState && lastState.baseDict,
    stage: event.stage,
    elapsedMs: event.elapsedMs,
    building: true
  });
}
__name(onDictBaseProgress, "onDictBaseProgress");
function renderDictBase(state) {
  const base = state.baseDict || {};
  const when = base.installedAt ? new Date(base.installedAt).toLocaleString() : "";
  const host = $("dictBaseSlots");
  if (host) {
    host.textContent = "";
    const building = !!base.building;
    const mkRow = /* @__PURE__ */ __name((value, label, note, delSlot) => {
      const row = document.createElement("label");
      row.className = "dict-slot";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "dictBaseChoice";
      radio.value = value;
      radio.disabled = building;
      row.append(radio);
      const labelBox = document.createElement("span");
      labelBox.className = "slot-label";
      const main = document.createElement("span");
      main.textContent = label;
      labelBox.append(main);
      if (note) {
        const small = document.createElement("small");
        small.textContent = note;
        labelBox.append(small);
      }
      row.append(labelBox);
      if (delSlot) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "slot-del";
        del.textContent = t("dict.slot.delete");
        del.disabled = building;
        del.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          call("deleteBaseDictSlot", delSlot);
        });
        row.append(del);
      }
      radio.addEventListener("change", () => {
        setNote("dictBaseNote", "");
        dictBasePending = radio.value;
        if (radio.value === "builtin") call("clearBaseDict");
        else call("activateBaseDictSlot", radio.value);
      });
      host.append(row);
    }, "mkRow");
    const active = base.activeSlot || null;
    const slots = Array.isArray(base.slots) ? base.slots : [];
    mkRow(
      "builtin",
      t("dict.base.builtin"),
      t("dict.base.builtinNote")
    );
    slots.forEach((slot) => mkRow(
      slot.id,
      String(slot.name || slot.id),
      `${t("dict.base.entries", [slot.entries])}${slot.installedAt ? " \xB7 " + new Date(slot.installedAt).toLocaleString() : ""}`,
      slot.id
    ));
    const want = building && base.targetSlot || active || "builtin";
    host.querySelectorAll("input").forEach((input) => {
      if (input.type === "radio") input.checked = input.value === want;
    });
  }
  const current = $("dictBaseCurrent");
  if (current) current.textContent = base.mode === "custom" && base.name ? `${t("dict.base.custom", [base.name])} \xB7 ${when}` : t("dict.base.builtin");
  const warn = $("dictBaseNonPinyin");
  if (warn) warn.hidden = !(typeof base.nonPinyin === "number");
  const toned = $("dictBaseToned");
  if (toned) toned.hidden = !base.toned;
  const t9skip = $("dictBaseT9Skip");
  if (t9skip) t9skip.hidden = !base.t9Skipped;
  $("btnBaseDictPick").disabled = !!base.building;
  $("dictBaseBuilding").hidden = !base.building || base.operation === "flypy";
  if (base.building && base.operation !== "flypy") {
    $("dictBaseBuilding").textContent = dictBaseBuildingText(base);
  }
}
__name(renderDictBase, "renderDictBase");
$("btnFlypyPick").addEventListener("click", () => call("openFlypyDocument"));
$("btnFlypyRevert").addEventListener("click", () => call("clearFlypy"));
function renderFlypy(state) {
  const base = state.baseDict || {};
  const flypy = base.flypy || {};
  if (flypy.installed) {
    const box = document.querySelector('#kbModeList input[data-kb-mode="flypy"]');
    if (box && !box.checked) {
      box.checked = true;
      saveKeyboardSelectionFromUi();
    }
  }
  const current = $("flypyCurrent");
  const when = flypy.installedAt ? new Date(flypy.installedAt).toLocaleString() : "";
  current.textContent = flypy.installed && flypy.name ? `${t("flypy.custom", [flypy.name])} \xB7 ${when}` : t("flypy.none");
  $("btnFlypyRevert").hidden = !flypy.installed || !!base.building;
  $("btnFlypyPick").disabled = !!base.building;
  const building = $("flypyBuilding");
  building.hidden = !base.building || base.operation !== "flypy";
  if (base.building && base.operation === "flypy") {
    building.textContent = dictBaseStageText(base.stage || "COMPILING", base.elapsedMs);
  }
}
__name(renderFlypy, "renderFlypy");
let clearDictArmed = null;
function disarmClearDict() {
  clearTimeout(clearDictArmed);
  clearDictArmed = null;
  const btn = $("btnClearImportedDict");
  btn.classList.remove("danger");
  btn.textContent = t("input.phrases.clearBtn");
}
__name(disarmClearDict, "disarmClearDict");
$("btnClearImportedDict").addEventListener("click", () => {
  if (clearDictArmed) {
    disarmClearDict();
    call("clearImportedDict");
    return;
  }
  const btn = $("btnClearImportedDict");
  btn.classList.add("danger");
  btn.textContent = t("input.phrases.confirmClear");
  clearDictArmed = setTimeout(disarmClearDict, 4e3);
});
$("btnCancelPhraseEdit").addEventListener("click", resetPhraseForm);
$("btnSavePhrase").addEventListener("click", () => {
  if (!phraseStateReady()) return;
  const text = $("phraseText").value.trim();
  const code = $("phraseCode").value.trim().toLowerCase();
  if (!text) {
    setNote("phrasesNote", t("phrases.form.text"));
    return;
  }
  if (!/^[a-z;]{1,16}$/.test(code)) {
    setNote("phrasesNote", t("phrases.form.code"));
    return;
  }
  const rankInput = Number($("phraseRank").value);
  const rank = Number.isInteger(rankInput) && rankInput >= 1 && rankInput <= 9 ? rankInput : 0;
  if (phraseEditing >= 0) {
    phraseItems[phraseEditing] = { text, code, rank };
  } else {
    if (phraseItems.some((item) => item.code === code)) {
      setNote("phrasesNote", t("phrases.err.duplicate"));
      return;
    }
    if (phraseItems.length >= 200) {
      setNote("phrasesNote", t("phrases.err.limit"));
      return;
    }
    phraseItems.push({ text, code, rank });
  }
  savePhrases();
  resetPhraseForm();
  setNote("phrasesNote", t("phrases.note.saved"));
});
let userWordItems = null;
let userWordEditing = -1;
function renderUserWords(state) {
  const words = state.userWords;
  if (!words) return;
  userWordItems = words.map((item) => ({
    text: String(item.text || ""),
    code: String(item.code || "")
  }));
  renderUserWordList();
  const count = $("userWordsCount");
  if (count) count.textContent = userWordItems.length ? t("userwords.count", [userWordItems.length]) : "";
}
__name(renderUserWords, "renderUserWords");
function userWordStateReady() {
  if (userWordItems !== null) return true;
  setNote("userWordsNote", t("userwords.err.notReady"));
  return false;
}
__name(userWordStateReady, "userWordStateReady");
function renderUserWordList() {
  const list = $("userWordList");
  list.textContent = "";
  userWordItems.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "phrase-row";
    const label = document.createElement("button");
    label.type = "button";
    label.className = "phrase-edit";
    const text = document.createElement("span");
    text.className = "phrase-text";
    text.textContent = item.text;
    const code = document.createElement("code");
    code.textContent = item.code;
    label.append(text, code);
    label.addEventListener("click", () => startUserWordEdit(index));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "phrase-del";
    del.textContent = "\u2715";
    del.setAttribute("aria-label", t("userwords.note.deleted"));
    del.addEventListener("click", () => {
      if (!userWordStateReady()) return;
      userWordItems.splice(index, 1);
      if (userWordEditing === index) resetUserWordForm();
      if (userWordEditing > index) userWordEditing -= 1;
      saveUserWordsToBridge();
      setNote("userWordsNote", t("userwords.note.deleted"));
    });
    row.append(label, del);
    list.append(row);
  });
  $("userWordEmpty").hidden = userWordItems.length > 0;
}
__name(renderUserWordList, "renderUserWordList");
function startUserWordEdit(index) {
  clearImeGestureSnapshots();
  userWordEditing = index;
  $("userWordText").value = userWordItems[index].text;
  $("userWordCode").value = userWordItems[index].code;
  $("btnSaveUserWord").textContent = t("userwords.form.save");
  $("btnCancelUserWordEdit").hidden = false;
}
__name(startUserWordEdit, "startUserWordEdit");
function resetUserWordForm() {
  clearImeGestureSnapshots();
  userWordEditing = -1;
  $("userWordText").value = "";
  $("userWordCode").value = "";
  $("btnSaveUserWord").textContent = t("userwords.form.add");
  $("btnCancelUserWordEdit").hidden = true;
}
__name(resetUserWordForm, "resetUserWordForm");
function saveUserWordsToBridge() {
  const payload = userWordItems.map((item) => ({ text: item.text, code: item.code }));
  call("saveUserWords", JSON.stringify(payload));
  const count = $("userWordsCount");
  if (count) count.textContent = userWordItems.length ? t("userwords.count", [userWordItems.length]) : "";
}
__name(saveUserWordsToBridge, "saveUserWordsToBridge");
$("btnManageUserWords").addEventListener("click", () => showPage("userwords"));
$("btnCancelUserWordEdit").addEventListener("click", resetUserWordForm);
$("btnSaveUserWord").addEventListener("click", () => {
  if (!userWordStateReady()) return;
  const text = $("userWordText").value.trim();
  const code = $("userWordCode").value.trim().toLowerCase();
  if (!text) {
    setNote("userWordsNote", t("userwords.form.textErr"));
    return;
  }
  if (code && !/^[a-z;]{1,48}$/.test(code)) {
    setNote("userWordsNote", t("userwords.form.codeErr"));
    return;
  }
  if (userWordEditing >= 0) {
    userWordItems[userWordEditing] = { text, code };
  } else {
    if (code && userWordItems.some((item) => item.code === code)) {
      setNote("userWordsNote", t("userwords.err.duplicate"));
      return;
    }
    if (userWordItems.length >= 200) {
      setNote("userWordsNote", t("userwords.err.limit"));
      return;
    }
    userWordItems.push({ text, code });
  }
  saveUserWordsToBridge();
  resetUserWordForm();
  setNote("userWordsNote", t("userwords.note.saved"));
});
function updateStateLabel(value) {
  const key = `update.states.${String(value || "").toUpperCase()}`;
  return I18N[uiLocale][key] || I18N.zh[key] || String(value || "");
}
__name(updateStateLabel, "updateStateLabel");
function renderUpdate(state) {
  const update = state.update || {};
  if (document.activeElement !== $("updateSource")) $("updateSource").value = update.source || "";
  if (document.activeElement !== $("updateUrl")) $("updateUrl").value = update.url || "";
  if (document.activeElement !== $("autoUpdateCheck")) {
    $("autoUpdateCheck").checked = !!update.autoCheck;
  }
  const source = update.activeSource === "built_in" ? t("update.sourceBuiltIn") : t("update.sourceHot");
  const sourceStatus = update.sourceMode === "disabled" ? t("update.sourceDisabled") : update.sourceMode === "custom" ? t("update.sourceCustom") : t("update.sourceDefault");
  const lines = [
    `${source}`,
    t("update.sourceStatus", { value: sourceStatus }),
    t("update.version", { value: update.activeVersion || "?" }),
    update.activeContentHash ? t("update.hash", { value: update.activeContentHash.slice(0, 16) }) : "",
    t("update.state", { value: updateStateLabel(update.state) })
  ].filter(Boolean);
  const errorCode = String(update.lastErrorCode || "");
  const errorDetail = String(update.lastErrorDetail || "");
  if (errorCode) {
    const translated = eventText({ code: errorCode, detail: errorDetail }, "error.INTERNAL_ERROR");
    lines.push(t("update.lastError", { value: translated }));
  } else if ((update.lastError || "").trim()) {
    lines.push(t("update.lastError", { value: update.lastError.trim() }));
  }
  if (update.lastSuccessAt) lines.push(t("update.lastSuccess", { value: update.lastSuccessAt }));
  $("updateStatus").textContent = lines.join("\n");
  const confirmedBad = update.activeSource === "hot" && !update.activeSigned && !!update.activeSignatureConfirmed;
  $("updateDanger").hidden = !confirmedBad && !(update.activeSource === "hot" && !update.activeSigned);
  $("updateDanger").textContent = t(confirmedBad ? "update.sigConfirmed" : "update.unsigned");
}
__name(renderUpdate, "renderUpdate");
function aboutRows(state, opts = {}) {
  const device = state.device || {};
  const release = device.release || "?";
  const sdk = device.sdkInt === void 0 ? "?" : device.sdkInt;
  const rows = [
    [t("about.appVersion"), `v${state.appVersion || "?"}`],
    [t("about.activeKeyboard"), `v${activeKeyboardVersion(state)}`],
    [t("about.builtInKeyboard"), `v${state.keyboardVersion || "?"}`],
    [t("about.device"), `${device.manufacturer || ""} ${device.model || ""}`.trim() || "?"],
    [t("about.android"), t("about.androidValue", { release, sdk })]
  ];
  if (state.inputStats && !opts.forCopy) {
    rows.push([
      t("about.inputStats"),
      t("about.inputStatsValue", {
        today: state.inputStats.today || 0,
        total: state.inputStats.total || 0
      })
    ]);
  }
  return rows;
}
__name(aboutRows, "aboutRows");
function renderAbout(state) {
  $("btnAppStore").hidden = !state.playDistribution;
  $("btnAboutCheckUpdate").hidden = false;
  const checkKey = state.playDistribution ? "action.checkUpdatePlay" : "action.checkUpdate";
  $("btnAboutCheckUpdate").dataset.i18n = checkKey;
  $("btnAboutCheckUpdate").textContent = t(checkKey);
  if (state.playDistribution) {
    $("btnDlThin").hidden = true;
    $("btnDlFull").hidden = true;
  }
  setToggleSafe("diagnosticsOn", state.diagnosticsOn);
  const host = $("aboutRows");
  host.replaceChildren();
  aboutRows(state).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("span");
    name.className = "row-label";
    name.textContent = label;
    const val = document.createElement("span");
    val.className = "row-value";
    val.textContent = value;
    row.append(name, val);
    host.append(row);
  });
  if ($("noticesText").textContent !== (state.notices || "")) {
    $("noticesText").textContent = state.notices || "";
  }
}
__name(renderAbout, "renderAbout");
function setToggleSafe(id, value) {
  const node = $(id);
  if (node && document.activeElement !== node) node.checked = !!value;
}
__name(setToggleSafe, "setToggleSafe");
$("btnEnableIme").addEventListener("click", () => call("enableIme"));
$("btnPickIme").addEventListener("click", () => call("pickIme"));
$("btnAddShortcut").addEventListener("click", () => call("addImeShortcut"));
$("btnAddTile").addEventListener("click", () => call("addImeTile"));
$("btnMic").addEventListener("click", () => call("requestMic"));
$("uiLanguage").addEventListener("change", (event) => setUiLanguage(event.target.value));
$("dpScheme").addEventListener("change", (event) => call("setDoublePinyinScheme", event.target.value));
$("kbLayout").addEventListener("change", (event) => call("setKbLayout", event.target.value));
(() => {
  const ta = $("testInput");
  if (!ta) return;
  const fit = /* @__PURE__ */ __name(() => {
    ta.style.height = "auto";
    ta.style.height = Math.max(96, ta.scrollHeight + 2) + "px";
  }, "fit");
  ta.addEventListener("input", fit);
  fit();
})();
function submitFeelOptions() {
  call(
    "setFeelOptions",
    parseInt($("scrubSpeed").value, 10),
    parseInt($("holdMs").value, 10),
    parseInt($("popupSnap").value, 10)
  );
}
__name(submitFeelOptions, "submitFeelOptions");
$("bottomPadPortrait").addEventListener("change", (event) => call("setBottomPadPortrait", parseInt(event.target.value, 10)));
$("landscapeSafeArea").addEventListener("change", (event) => call("setLandscapeSafeArea", event.target.checked));
const landscapeCeilInput = $("landscapeCeil");
landscapeCeilInput.addEventListener("input", () => {
  $("landscapeCeilOut").textContent = landscapeCeilInput.value + "%";
});
landscapeCeilInput.addEventListener("change", () => call("setLandscapeCeil", parseInt(landscapeCeilInput.value, 10)));
const landscapeOpacityInput = $("landscapeOpacity");
landscapeOpacityInput.addEventListener("input", () => {
  $("landscapeOpacityOut").textContent = landscapeOpacityInput.value + "%";
});
landscapeOpacityInput.addEventListener("change", () => call("setLandscapeOpacity", parseInt(landscapeOpacityInput.value, 10)));
$("bottomPadLandscape").addEventListener("change", (event) => call("setBottomPadLandscape", parseInt(event.target.value, 10)));
$("candidateFont").addEventListener("input", (event) => {
  $("candidateFontOut").textContent = `${parseInt(event.target.value, 10)}%`;
});
$("candidateFont").addEventListener("change", (event) => call("setCandidateFont", parseInt(event.target.value, 10)));
$("keycapFont").addEventListener("input", (event) => {
  $("keycapFontOut").textContent = `${parseInt(event.target.value, 10)}%`;
});
$("keycapFont").addEventListener("change", (event) => call("setKeycapFont", parseInt(event.target.value, 10)));
let userFontNoteHold = null;
$("btnImportFont").addEventListener("click", () => {
  userFontNoteHold = null;
  $("fontConsent").hidden = true;
  call("requestUserFontImport");
});
$("btnClearFont").addEventListener("click", () => {
  userFontNoteHold = null;
  $("fontConsent").hidden = true;
  call("clearUserFont");
});
$("preeditFont").addEventListener("change", (event) => call("setPreeditFont", parseInt(event.target.value, 10)));
$("preeditBold").addEventListener("change", (event) => call("setPreeditBold", event.target.checked));
$("oneHand").addEventListener("change", (event) => call("setOneHandMode", parseInt(event.target.value, 10)));
$("oneHandPad").addEventListener("change", (event) => call("setOneHandPad", parseInt(event.target.value, 10)));
$("sideContent").addEventListener("change", (event) => call("setSideContent", parseInt(event.target.value, 10)));
$("themeMode").addEventListener("change", (event) => call("setThemeMode", event.target.value));
let keyOpacityDirty = false;
$("keyOpacity").addEventListener("input", (event) => {
  keyOpacityDirty = true;
  const v = parseInt(event.target.value, 10);
  if (Number.isFinite(v)) {
    pvKeyAlpha = Math.max(0, Math.min(1, v / 100));
    updateThemePreview();
  }
});
$("keyOpacity").addEventListener("change", (event) => {
  if (!keyOpacityDirty) return;
  keyOpacityDirty = false;
  call("setKeyOpacity", parseInt(event.target.value, 10));
});
$("keyBubble").addEventListener("change", (event) => call("setKeyBubble", event.target.checked));
$("cnEnComposingGuard").addEventListener("change", (event) => call("setCnEnComposingGuard", event.target.checked));
$("bubbleLinger").addEventListener("change", (event) => {
  call("setBubbleLinger", parseInt(event.target.value, 10) || 0);
});
let kbHeightDirty = false;
$("kbHeight").addEventListener("input", (event) => {
  kbHeightDirty = true;
});
$("kbHeight").addEventListener("change", (event) => {
  if (!kbHeightDirty) return;
  kbHeightDirty = false;
  call("setKbHeight", parseInt(event.target.value, 10));
});
$("kbHeightReset").addEventListener("click", () => {
  const slider = $("kbHeight");
  slider.value = slider.dataset.default || "272";
  call("setKbHeight", 0);
});
const bgPickGeneration = { light: 0, dark: 0 };
[["bgImageLight", "light"], ["bgImageDark", "dark"]].forEach(([id, variant]) => {
  const sel = $(id);
  sel.dataset.prev = "none";
  sel.addEventListener("change", () => {
    const v = sel.value;
    bgPickGeneration[variant] += 1;
    if (v === "none") {
      call("clearBgImage", variant);
      sel.dataset.prev = "none";
    } else if (v === "builtin") {
      call("setBuiltinBgImage", variant);
      sel.dataset.prev = "builtin";
    } else if (v === "custom") {
      sel.value = sel.dataset.prev;
    } else if (v === "pick") {
      sel.value = sel.dataset.prev;
      pickBgImage(variant);
    }
  });
});
function markBgCustom(variant) {
  const sel = $("bgImage" + (variant === "light" ? "Light" : "Dark"));
  let opt = sel.querySelector('option[value="custom"]');
  if (!opt) {
    opt = document.createElement("option");
    opt.value = "custom";
    opt.textContent = t("\u81EA\u5B9A\u4E49");
    sel.append(opt);
  }
  sel.value = "custom";
  sel.dataset.prev = "custom";
}
__name(markBgCustom, "markBgCustom");
function pickBgImage(variant) {
  const generation = ++bgPickGeneration[variant];
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    $("bgImageNote").hidden = true;
    if (file.size > 16 * 1024 * 1024) {
      setNote("bgImageNote", t("error.BAD_BG_IMAGE"));
      $("bgImageNote").hidden = false;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (generation !== bgPickGeneration[variant]) return;
      call("importBgImage", variant, String(reader.result).split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  });
  input.click();
}
__name(pickBgImage, "pickBgImage");
$("holdMs").addEventListener("change", submitFeelOptions);
$("scrubSpeed").addEventListener("change", submitFeelOptions);
$("flickSwap").addEventListener("change", (event) => call("setFlickSwap", event.target.checked));
$("doubleShiftLock").addEventListener("change", (event) => call("setDoubleShiftLock", event.target.checked));
$("popupSnap").addEventListener("change", submitFeelOptions);
$("modelBackend").addEventListener("change", (event) => call("setModelBackend", event.target.value));
$("spaceHoldEdit").addEventListener("click", openSpaceHoldEditor);
$("btnSpeedTest").addEventListener("click", () => {
  setNote("modelNote", "");
  call("testModelDownloadSpeed");
});
$("btnSaveCustomSource").addEventListener("click", () => {
  call("setModelDownloadSource", "custom", $("modelDownloadCustom").value || "");
  setNote("modelNote", t("note.saved"));
});
$("modelConsentCancel").addEventListener("click", () => {
  if (!pendingModelConsent) return;
  const id = pendingModelConsent.id;
  hideModelConsent();
  call("confirmModelDownload", id, false);
});
$("modelConsentConfirm").addEventListener("click", () => {
  if (!pendingModelConsent) return;
  const id = pendingModelConsent.id;
  hideModelConsent();
  call("confirmModelDownload", id, true);
});
let asrHotwordsSubmitted = null;
$("asrIdleUnload").addEventListener("change", (event) => call("setAsrIdleUnload", event.target.checked));
$("hotwords").addEventListener("input", () => {
  asrHotwordsDirty = true;
});
$("stripPeriod").addEventListener("change", (event) => call("setAsrToggles", event.target.checked, $("numItn").checked));
$("numItn").addEventListener("change", (event) => call("setAsrToggles", $("stripPeriod").checked, event.target.checked));
$("btnSaveAsr").addEventListener("click", () => {
  asrHotwordsSubmitted = $("hotwords").value;
  call("saveAsrSettings", $("stripPeriod").checked, $("numItn").checked, $("hotwords").value);
  setNote("asrNote", t("note.saved"));
});
$("btnSaveCustom").addEventListener("click", () => {
  if (!ckAbsorbJson()) {
    setNote("customNote", t("input.custom.badjson"));
    return;
  }
  ckSaveAll("customNote");
});
$("customEnabled").addEventListener("change", (event) => call("setCustomEnabled", event.target.checked));
$("btnCustomTemplate").addEventListener("click", () => {
  $("customJson").value = CK_TEMPLATE;
  ckMarkDirty(true);
  ckAbsorbJson();
});
$("btnCustomTemplateDev").addEventListener("click", () => {
  $("customJson").value = JSON.stringify({
    version: 1,
    rows: [
      [
        { t: "Esc", tap: "[esc]", note: "\u5355\u952E" },
        { t: ":w", tap: ":w[enter]", note: "\u6587\u672C+\u56DE\u8F66" },
        { t: "\u6574\u7406", tap: "[esc]ggVGD", note: "Vim \u5220\u9664\u5168\u6587" },
        { t: "\u4FDD\u5B58", tap: "[ctrl+s]", note: "\u7EC4\u5408\u952E" },
        { t: "F5", tap: "[f5]", note: "\u529F\u80FD\u952E" }
      ],
      [
        { t: "\u2190", tap: "[left]", note: "\u5149\u6807" },
        { t: "\u884C\u9996", tap: "[home]" },
        { t: "\u884C\u5C3E", tap: "[end]" },
        { t: "\u5220\u5B57", tap: "[bs]" },
        { t: "\u232B", tap: "[backspace]", note: "\u9000\u683C\uFF0C\u957F\u6309\u8FDE\u5220" }
      ],
      [
        { t: "\u90AE\u7BB1", tap: "me@example.com", note: "\u6574\u6BB5\u6587\u672C", align: "right" },
        { t: "\u2713", tap: "\u597D\u7684" },
        { t: "\u2192", tap: "\u2192 " },
        { t: "\uFFE5", tap: "\uFFE5" },
        { t: "\u7FFB\u8BD1", tap: "[open:https://fanyi.baidu.com]", note: "\u6253\u5F00\u5E94\u7528/\u7F51\u9875" }
      ]
    ]
  }, null, 2);
  ckMarkDirty(true);
  ckAbsorbJson();
});
$("btnCheckUpdate").addEventListener("click", () => call("checkUpdate", $("updateSource").value));
$("autoUpdateCheck").addEventListener("change", (event) => call("setAutoUpdateCheck", event.target.checked));
$("associationOn").addEventListener("change", (event) => call("setAssociation", event.target.checked));
$("backspaceAssocOn").addEventListener("change", (event) => call("setBackspaceAssoc", event.target.checked));
$("hwkbForm").addEventListener("change", (event) => call("setHwkbForm", event.target.value));
$("quickSwitchPolicy").addEventListener("change", (event) => call("setQuickSwitchPolicy", event.target.value));
$("wxSlashOn").addEventListener("change", (event) => call("setWxSlash", event.target.checked));
$("dynamicDateTimeOn").addEventListener("change", (event) => call("setDynamicDateTime", event.target.checked));
$("keySound").addEventListener("change", (event) => call("setKeySound", event.target.checked));
$("keySoundVolume").addEventListener("input", (event) => {
  clearTimeout(keySoundVolumeTimer);
  keySoundVolumeTimer = setTimeout(
    () => call("setKeySoundVolume", Number(event.target.value)),
    250
  );
});
$("keyHapticStrength").addEventListener("change", (event) => call("setKeyHapticStrength", Number(event.target.value)));
$("keySoundStyle").addEventListener("change", (event) => {
  if (event.target.value === "custom") call("openKeySoundDocument");
  else call("setKeySoundStyle", event.target.value);
});
$("btnPickKeySound").addEventListener("click", () => call("openKeySoundDocument"));
$("btnClearKeySound").addEventListener("click", () => call("clearKeySoundFile"));
$("keyHaptic").addEventListener("change", (event) => call("setKeyHaptic", event.target.checked));
document.querySelectorAll("input[data-fuzzy-bit]").forEach((box) => {
  box.addEventListener("change", () => {
    let mask = 0;
    document.querySelectorAll("input[data-fuzzy-bit]").forEach((other) => {
      if (other.checked) mask |= Number(other.dataset.fuzzyBit);
    });
    call("setFuzzyPinyinMask", mask);
  });
});
$("btnInstallZip").addEventListener("click", () => call("installZip", $("updateUrl").value));
$("btnImportZip").addEventListener("click", () => call("openKeyboardDocument"));
$("btnRestore").addEventListener("click", () => call("restoreBuiltInKeyboard"));
$("btnExportBackup").addEventListener("click", () => call("exportUserdata"));
$("btnImportBackup").addEventListener("click", () => {
  $("backupConsent").hidden = false;
});
$("backupConsentCancel").addEventListener("click", () => {
  $("backupConsent").hidden = true;
});
$("backupConsentConfirm").addEventListener("click", () => {
  $("backupConsent").hidden = true;
  call("openBackupDocument");
});
let webdavCloudNames = null;
let webdavPickedName = "";
let webdavDupConfirmed = false;
let webdavFormInit = false;
function webdavFillConfig() {
  try {
    const raw = typeof BRIDGE.webdavGetConfig === "function" ? BRIDGE.webdavGetConfig(token) : "";
    const cfg = raw ? JSON.parse(raw) : {};
    $("webdavUrl").value = cfg.url || "";
    $("webdavDir").value = typeof cfg.subdir === "string" ? cfg.subdir : "feelime-backup";
    $("webdavUser").value = cfg.user || "";
    $("webdavPass").value = cfg.password || "";
    webdavSyncProviderSelection();
  } catch (error) {
  }
}
__name(webdavFillConfig, "webdavFillConfig");
const WEBDAV_PROVIDERS = {
  jg: {
    url: "https://dav.jianguoyun.com/dav/",
    ph: "https://dav.jianguoyun.com/dav/"
  },
  inf: { url: "", ph: "https://\u4F60\u7684\u8D26\u53F7.infini-cloud.net/dav/" },
  nc: { url: "", ph: "https://\u4F60\u7684\u670D\u52A1\u5668/remote.php/dav/files/\u7528\u6237\u540D/" },
  custom: { url: "", ph: "https://dav.example.com/dav/" }
};
function webdavSyncProviderSelection() {
  const value = $("webdavUrl").value.trim().replace(/\/+$/, "");
  const key = Object.keys(WEBDAV_PROVIDERS).find((k) => WEBDAV_PROVIDERS[k].url && WEBDAV_PROVIDERS[k].url.replace(/\/+$/, "") === value) || "custom";
  $("webdavProvider").value = key;
  $("webdavUrl").placeholder = (WEBDAV_PROVIDERS[key] || WEBDAV_PROVIDERS.custom).ph;
}
__name(webdavSyncProviderSelection, "webdavSyncProviderSelection");
function webdavWireProviders() {
  $("webdavProvider").addEventListener("change", () => {
    const p = WEBDAV_PROVIDERS[$("webdavProvider").value] || WEBDAV_PROVIDERS.custom;
    if (p.url) $("webdavUrl").value = p.url;
    $("webdavUrl").placeholder = p.ph;
    if (!p.url) $("webdavUrl").focus();
  });
  $("webdavUrl").addEventListener("input", webdavSyncProviderSelection);
}
__name(webdavWireProviders, "webdavWireProviders");
function webdavDisplayName(name) {
  const m = /^feelime-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/.exec(name);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : name;
}
__name(webdavDisplayName, "webdavDisplayName");
function webdavMakeName() {
  const p = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "p");
  const d = /* @__PURE__ */ new Date();
  return "feelime-backup-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".json";
}
__name(webdavMakeName, "webdavMakeName");
function webdavNameValid(name) {
  return name.length > "feelime-backup-.json".length && name.length <= 128 && name.startsWith("feelime-backup-") && name.endsWith(".json") && !/[\s/+]/.test(name);
}
__name(webdavNameValid, "webdavNameValid");
function webdavCheckDup() {
  const name = $("webdavNameInput").value.trim();
  const warn = $("webdavDupWarn");
  const go = $("webdavBackupGo");
  if (!webdavNameValid(name)) {
    webdavDupConfirmed = false;
    warn.hidden = false;
    warn.textContent = t("webdav.backupModal.badName");
    go.disabled = true;
    go.textContent = t("webdav.backupModal.go");
    go.className = "btn primary";
    return;
  }
  const dup = webdavCloudNames !== null && webdavCloudNames.has(name);
  webdavDupConfirmed = dup;
  if (dup) {
    warn.hidden = false;
    warn.textContent = t("webdav.backupModal.dup");
    go.textContent = t("webdav.backupModal.dupBtn");
    go.className = "btn ck-btn-danger";
  } else {
    warn.hidden = webdavCloudNames !== null;
    warn.textContent = t("webdav.backupModal.unknownDup");
    go.textContent = t("webdav.backupModal.go");
    go.className = "btn primary";
  }
  go.disabled = false;
}
__name(webdavCheckDup, "webdavCheckDup");
function webdavOpenBackup() {
  $("webdavNameInput").value = webdavMakeName();
  $("webdavBackupGo").disabled = false;
  $("webdavBackupModal").hidden = false;
  setNote("webdavNote", "");
  call("webdavListBackups");
  webdavCheckDup();
}
__name(webdavOpenBackup, "webdavOpenBackup");
function webdavShowRestoreView(confirm) {
  $("webdavPickView").hidden = confirm;
  $("webdavFootPick").hidden = confirm;
  $("webdavConfirmView").hidden = !confirm;
  $("webdavFootConfirm").hidden = !confirm;
}
__name(webdavShowRestoreView, "webdavShowRestoreView");
function webdavOpenRestore() {
  webdavPickedName = "";
  $("webdavRestoreGo").disabled = true;
  $("webdavPickList").textContent = "";
  $("webdavPickHint").hidden = false;
  $("webdavPickHint").textContent = t("webdav.note.listing");
  webdavShowRestoreView(false);
  $("webdavRestoreModal").hidden = false;
  setNote("webdavNote", "");
  call("webdavListBackups");
}
__name(webdavOpenRestore, "webdavOpenRestore");
function renderWebdavList(event) {
  if (event.ok) {
    const items2 = Array.isArray(event.items) ? event.items : [];
    webdavCloudNames = new Set(items2.map((item) => String(item.name)));
  } else {
    webdavCloudNames = null;
    const mapped = t("webdav.err." + (event.code || "INTERNAL"));
    setNote("webdavNote", mapped.startsWith("webdav.err.") ? t("webdav.err.GENERIC") + "\uFF08" + (event.code || "INTERNAL") + "\uFF09" : mapped);
  }
  if (!$("webdavBackupModal").hidden) webdavCheckDup();
  if ($("webdavRestoreModal").hidden || !event.ok) return;
  const list = $("webdavPickList");
  list.textContent = "";
  const items = Array.isArray(event.items) ? event.items : [];
  $("webdavPickHint").hidden = items.length > 0;
  if (!items.length) {
    $("webdavPickHint").textContent = t("webdav.empty");
    return;
  }
  items.forEach((item) => {
    const name = String(item.name);
    const row = document.createElement("li");
    row.className = "webdav-pick-row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    const time = document.createElement("span");
    time.className = "webdav-pick-time";
    time.textContent = webdavDisplayName(name);
    const size = document.createElement("span");
    size.className = "webdav-pick-size";
    size.textContent = t(
      "webdav.size.kb",
      [String(Math.max(1, Math.round(Number(item.size) / 1024)))]
    );
    row.append(time, size);
    row.addEventListener("click", () => {
      webdavPickedName = name;
      list.querySelectorAll(".webdav-pick-row").forEach((el) => el.setAttribute("aria-selected", String(el === row)));
      $("webdavRestoreGo").disabled = false;
    });
    list.append(row);
  });
}
__name(renderWebdavList, "renderWebdavList");
function renderWebdavStatus(event) {
  const op = event.op || "";
  if (event.ok) {
    if (op === "test" || op === "save") setNote("webdavNote", t("webdav.note.ok"));
    else if (op === "backup") {
      $("webdavBackupModal").hidden = true;
      $("webdavBackupGo").disabled = false;
      setNote("webdavNote", t("webdav.note.backupOk", [webdavDisplayName(event.name || "")]));
      call("webdavListBackups");
    } else if (op === "restore") {
      setNote("webdavNote", t("webdav.note.restoreOk", [webdavDisplayName(event.name || "")]));
    }
    return;
  }
  if (op === "backup" && event.code === "CONFLICT") {
    $("webdavBackupModal").hidden = false;
    $("webdavDupWarn").hidden = false;
    $("webdavDupWarn").textContent = t("webdav.backupModal.dup");
    const go = $("webdavBackupGo");
    go.disabled = false;
    go.textContent = t("webdav.backupModal.dupBtn");
    go.className = "btn ck-btn-danger";
    webdavDupConfirmed = true;
    setNote("webdavNote", "");
    return;
  }
  if (op === "backup") $("webdavBackupModal").hidden = true;
  const mapped = t("webdav.err." + (event.code || "INTERNAL"));
  const text = mapped.startsWith("webdav.err.") ? t("webdav.err.GENERIC") + "\uFF08" + (event.code || "INTERNAL") + "\uFF09" : mapped;
  setNote("webdavNote", text);
}
__name(renderWebdavStatus, "renderWebdavStatus");
webdavWireProviders();
$("btnWebdavSave").addEventListener("click", () => {
  webdavCloudNames = null;
  setNote("webdavNote", t("webdav.note.testing"));
  call("webdavSaveConfig", $("webdavUrl").value.trim(), $("webdavUser").value.trim(), $("webdavPass").value, $("webdavDir").value.trim());
});
$("btnWebdavBackup").addEventListener("click", webdavOpenBackup);
$("btnWebdavRestore").addEventListener("click", webdavOpenRestore);
$("webdavNameInput").addEventListener("input", webdavCheckDup);
$("webdavBackupX").addEventListener("click", () => {
  $("webdavBackupModal").hidden = true;
});
$("webdavBackupMask").addEventListener("click", () => {
  $("webdavBackupModal").hidden = true;
});
$("webdavBackupCancel").addEventListener("click", () => {
  $("webdavBackupModal").hidden = true;
});
$("webdavBackupGo").addEventListener("click", () => {
  const name = $("webdavNameInput").value.trim();
  if (!webdavNameValid(name)) return;
  const go = $("webdavBackupGo");
  go.disabled = true;
  go.textContent = t("webdav.backupModal.sending");
  setNote("webdavNote", t("webdav.note.backing"));
  call("webdavBackup", name, webdavDupConfirmed);
});
$("webdavRestoreX").addEventListener("click", () => {
  $("webdavRestoreModal").hidden = true;
});
$("webdavRestoreMask").addEventListener("click", () => {
  $("webdavRestoreModal").hidden = true;
});
$("webdavRestoreCancel").addEventListener("click", () => {
  $("webdavRestoreModal").hidden = true;
});
$("webdavRestoreGo").addEventListener("click", () => {
  if (!webdavPickedName) return;
  $("webdavConfirmName").textContent = webdavDisplayName(webdavPickedName);
  webdavShowRestoreView(true);
});
$("webdavRestoreBack").addEventListener("click", () => webdavShowRestoreView(false));
$("webdavRestoreConfirm").addEventListener("click", () => {
  if (!webdavPickedName) return;
  $("webdavRestoreModal").hidden = true;
  setNote("webdavNote", t("webdav.note.restoring"));
  call("webdavRestore", webdavPickedName);
  webdavPickedName = "";
});
let pendingKbSigId = "";
$("kbSigConsentCancel").addEventListener("click", () => {
  $("kbSigConsent").hidden = true;
  if (pendingKbSigId) call("dismissKeyboardInstall", pendingKbSigId);
  pendingKbSigId = "";
});
$("kbSigConsentConfirm").addEventListener("click", () => {
  $("kbSigConsent").hidden = true;
  if (pendingKbSigId) call("confirmKeyboardInstall", pendingKbSigId);
  pendingKbSigId = "";
});
$("fontConsentCancel").addEventListener("click", () => {
  $("fontConsent").hidden = true;
});
$("fontConsentConfirm").addEventListener("click", () => {
  $("fontConsent").hidden = true;
  call("confirmLargeFontImport");
});
function renderBackupStatus(event) {
  const exporting = event.direction === "export";
  if (event.ok) {
    setNote("backupNote", t(exporting ? "backup.done.export" : "backup.done.import"));
  } else {
    setNote("backupNote", t(exporting ? "backup.failed.export" : "backup.failed.import") + " " + t("backup.error." + String(event.code || "IO_ERROR")));
  }
}
__name(renderBackupStatus, "renderBackupStatus");
$("diagnosticsOn").addEventListener("change", (event) => {
  call("setDiagnostics", event.target.checked);
  setNote("diagNote", event.target.checked ? t("diag.on") : t("diag.off"));
});
$("btnExportDiagnostics").addEventListener("click", () => {
  if (!lastState || !lastState.diagnosticsOn) {
    setNote("diagNote", t("diag.off"));
    return;
  }
  call("exportDiagnostics");
  setNote("diagNote", t("diag.exported"));
});
$("btnAppStore").addEventListener("click", () => call("openAppStore"));
$("btnGithubRepo").addEventListener("click", () => call("openGithub", "repo"));
$("btnCustomDocs").addEventListener("click", () => call("openDocs"));
const CK_KEYS = [
  ["esc", "Esc"],
  ["tab", "Tab"],
  ["enter", "Enter \u23CE"],
  ["space", "Space"],
  ["backspace", "\u9000\u683C \u232B"],
  ["del", "Del"],
  ["left", "\u2190"],
  ["up", "\u2191"],
  ["down", "\u2193"],
  ["right", "\u2192"],
  ["home", "Home"],
  ["end", "End"],
  ["pgup", "PgUp"],
  ["pgdn", "PgDn"]
].concat(Array.from({ length: 12 }, (_, i) => ["f" + (i + 1), "F" + (i + 1)])).concat(Array.from({ length: 26 }, (_, i) => [String.fromCharCode(97 + i), String.fromCharCode(65 + i)])).concat(Array.from({ length: 10 }, (_, i) => [String(i), String(i)]));
const CK_KEY_NAME = Object.fromEntries(CK_KEYS);
const CK_MODS = [["ctrl", "Ctrl"], ["alt", "Alt"], ["shift", "Shift"], ["win", "Win"]];
const CK_PANEL_TARGETS = [
  ["clipboard", "voice.hold.clipboard"],
  ["favorites", "voice.hold.favorites"],
  ["emoji", "voice.hold.emoji"],
  ["edit", "voice.hold.edit"],
  ["control", "voice.hold.control"],
  ["custom", "voice.hold.custom"]
];
const CK_PANEL_RE = new RegExp("^\\[panel:(" + CK_PANEL_TARGETS.map(([value]) => value).join("|") + ")\\]$");
const CK_COLORS = ["blue", "green", "orange", "red", "purple"];
const CK_QUICK = [
  { t: "Esc", tap: "[esc]" },
  { t: "Tab", tap: "[tab]" },
  { t: "\u23CE", tap: "[enter]" },
  { t: "\u232B", tap: "[backspace]", note: "\u9000\u683C\uFF0C\u957F\u6309\u8FDE\u5220" },
  { t: "\u2190", tap: "[left]" },
  { t: "\u2192", tap: "[right]" },
  { t: "\u2191", tap: "[up]" },
  { t: "\u2193", tap: "[down]" },
  { t: "Home", tap: "[home]" },
  { t: "End", tap: "[end]" },
  { t: "F5", tap: "[f5]" },
  { t: "\u5B58", tap: "[ctrl+s]", color: "h210" },
  { t: "\u590D\u5236", tap: "[ctrl+c]" },
  { t: "\u7C98\u8D34", tap: "[ctrl+v]" },
  { t: "\u526A\u5207", tap: "[ctrl+x]" },
  { t: "\u5168\u9009", tap: "[ctrl+a]" },
  { t: "\u64A4\u9500", tap: "[ctrl+z]" },
  { t: "\u90AE\u7BB1", tap: "me@example.com", span: 2 },
  { t: "\u7FFB\u8BD1", tap: "[open:https://fanyi.baidu.com]", note: "\u6253\u5F00\u767E\u5EA6\u7FFB\u8BD1\u7F51\u9875" },
  { t: "\u8C46\u5305", tap: "[open:doubao://]", note: "\u6253\u5F00\u8C46\u5305 App\uFF08\u9700\u5DF2\u5B89\u88C5\uFF09" },
  { t: "\u626B\u4E00\u626B", tap: "[open:alipays://platformapi/startapp?saId=10000007]", color: "blue", note: "\u6253\u5F00\u652F\u4ED8\u5B9D\u626B\u4E00\u626B\uFF08\u9700\u5DF2\u5B89\u88C5\uFF09" },
  { t: "\u6536\u4ED8\u6B3E", tap: "[open:alipays://platformapi/startapp?saId=20000056]", color: "green", note: "\u6253\u5F00\u652F\u4ED8\u5B9D\u6536\u4ED8\u6B3E\uFF08\u9700\u5DF2\u5B89\u88C5\uFF09" }
];
const CK_OPEN_PRESETS = [
  { label: "\u652F\u4ED8\u5B9D\u626B\u4E00\u626B", t: "\u626B\u4E00\u626B", uri: "alipays://platformapi/startapp?saId=10000007" },
  { label: "\u652F\u4ED8\u5B9D\u6536\u4ED8\u6B3E", t: "\u6536\u4ED8\u6B3E", uri: "alipays://platformapi/startapp?saId=20000056" },
  { label: "\u767E\u5EA6\u7FFB\u8BD1", t: "\u7FFB\u8BD1", uri: "https://fanyi.baidu.com" },
  { label: "\u8C37\u6B4C\u7FFB\u8BD1", t: "\u7FFB\u8BD1", uri: "https://translate.google.com" },
  { label: "\u8C46\u5305", t: "\u8C46\u5305", uri: "doubao://" },
  { label: "\u6709\u9053\u8BCD\u5178", t: "\u8BCD\u5178", uri: "youdaodict://" },
  { label: "\u767E\u5EA6\u641C\u7D22", t: "\u641C\u7D22", uri: "https://www.baidu.com/s?wd=" }
];
let ckRows = null;
let ckEditorTarget = "cell";
let spaceHoldRaw = "voice";
let spaceHoldTextRaw = "";
let ckSel = null;
let ckDraft = null;
let ckDirty = false;
let ckLangKeys = {};
let ckLeaveTarget = null;
function ckReportState() {
  call("reportCkState", !!ckEditMode, !!ckDirty);
}
__name(ckReportState, "ckReportState");
function ckMarkDirty(dirty) {
  ckDirty = dirty;
  ckReportState();
  const bar = document.getElementById("ckSaveBar");
  if (!bar) return;
  document.getElementById("ckSave").classList.toggle("ck-save-dirty", dirty);
  document.getElementById("ckDirtyHint").hidden = !dirty;
}
__name(ckMarkDirty, "ckMarkDirty");
function ckOpenModal(isNew) {
  const modal = document.getElementById("ckModal");
  document.getElementById("ckModalTitle").textContent = ckEditorTarget === "space" ? t("ck.spaceTitle") : t(isNew ? "ck.newTitle" : "ck.edit.title");
  setNote("ckEditNote", "");
  modal.hidden = false;
}
__name(ckOpenModal, "ckOpenModal");
function ckCloseModal() {
  document.getElementById("ckModal").hidden = true;
  ckSel = null;
}
__name(ckCloseModal, "ckCloseModal");
function ckSettingAnchors() {
  const out = [];
  document.querySelectorAll("[data-page]").forEach((page) => {
    var _a;
    const pageName = page.dataset.page;
    const pageTitle = (((_a = page.querySelector("h2, .page-title")) == null ? void 0 : _a.textContent) || pageName).trim().slice(0, 10);
    page.querySelectorAll(".row, label.row").forEach((row) => {
      const control = row.querySelector("select[id], input[id]:not([type=hidden]), button[id], [id]");
      const id = control && control.id || row.id;
      if (!id) return;
      const labelEl = row.querySelector(".row-label span:not(small), .row-label");
      const labelText = labelEl && labelEl.childNodes && labelEl.childNodes[0] ? labelEl.childNodes[0].textContent : "";
      const label = (labelText || row.getAttribute("aria-label") || id).trim().slice(0, 16);
      if (!label) return;
      out.push([id, `${pageTitle} \xB7 ${label}`]);
    });
  });
  return out;
}
__name(ckSettingAnchors, "ckSettingAnchors");
function ckTapParse(tap) {
  const open = /^\[open:(.+)\]$/.exec(String(tap || "").trim());
  if (open) return { mode: "open", open: open[1].trim() };
  const setting = /^\[setting:([\w-]{1,64})\]$/.exec(String(tap || "").trim());
  if (setting) return { mode: "setting", setting: setting[1] };
  const panel = CK_PANEL_RE.exec(String(tap || "").trim().toLowerCase());
  if (panel) return { mode: "panel", panel: panel[1] };
  const edit = /^\[edit:(\w+)\]$/.exec(String(tap || "").trim());
  if (edit && CK_EDIT_OPS.some(([op]) => op === edit[1])) {
    return { mode: "op", op: edit[1] };
  }
  const m = /^\[([a-z0-9+]+)\]$/.exec(String(tap || "").trim().toLowerCase());
  if (m) {
    const parts = m[1].split("+");
    if (parts.length === 1 && CK_KEY_NAME[parts[0]]) {
      return { mode: "single", single: parts[0] };
    }
    const key = parts[parts.length - 1];
    const mods = parts.slice(0, -1);
    const modNames = ["ctrl", "alt", "shift", "win"];
    if (CK_KEY_NAME[key] && mods.every((x) => modNames.includes(x))) {
      return { mode: "combo", comboKey: key, mods: new Set(mods) };
    }
  }
  if (!String(tap || "").includes("[")) return { mode: "text", text: tap || "" };
  return { mode: "advanced", dsl: tap || "" };
}
__name(ckTapParse, "ckTapParse");
function ckTapFromDraft(d) {
  if (d.mode === "text") return d.text || "";
  if (d.mode === "open") {
    const uri = (d.open || "").trim();
    return uri ? "[open:" + uri + "]" : "";
  }
  if (d.mode === "setting") {
    const id = (d.setting || "").trim();
    return id ? "[setting:" + id + "]" : "";
  }
  if (d.mode === "panel") return "[panel:" + (d.panel || "clipboard") + "]";
  if (d.mode === "op") return "[edit:" + (d.op || "copy") + "]";
  if (d.mode === "single") return d.single ? "[" + d.single + "]" : "";
  if (d.mode === "combo") {
    const mods = CK_MODS.filter(([name]) => d.mods.has(name)).map(([name]) => name);
    return d.comboKey ? "[" + mods.concat(d.comboKey).join("+") + "]" : "";
  }
  return d.dsl || "";
}
__name(ckTapFromDraft, "ckTapFromDraft");
function ckLoad() {
  let rows = null;
  try {
    const parsed = JSON.parse($("customJson").value || "null");
    if (parsed && parsed.version === 1 && Array.isArray(parsed.rows)) rows = parsed.rows;
    ckLangKeys = parsed && parsed.langKeys && typeof parsed.langKeys === "object" && !Array.isArray(parsed.langKeys) ? parsed.langKeys : {};
  } catch (_) {
  }
  if (!rows || !rows.some((row) => row && row.length)) rows = JSON.parse(CK_TEMPLATE).rows;
  ckRows = [0, 1, 2].map((i) => Array.isArray(rows[i]) ? rows[i].slice() : []);
  ckJsonProjected = $("customJson").value;
}
__name(ckLoad, "ckLoad");
const CK_TEMPLATE = JSON.stringify({
  version: 1,
  rows: [
    [
      { t: "\u8C22\u8C22", tap: "\u8C22\u8C22", note: "\u70B9\u51FB\u76F4\u63A5\u4E0A\u5C4F\uFF0C\u53EF\u6539\u6210\u81EA\u5DF1\u7684\u9AD8\u9891\u7528\u8BED" },
      { t: "\u597D\u7684", tap: "\u597D\u7684" },
      { t: "\u6536\u5230", tap: "\u6536\u5230" },
      { t: "\u8F9B\u82E6\u4E86", tap: "\u8F9B\u82E6\u4E86" },
      { t: "\u4E0D\u5BA2\u6C14", tap: "\u4E0D\u5BA2\u6C14" },
      { t: "\u6CA1\u95EE\u9898", tap: "\u6CA1\u95EE\u9898" }
    ],
    [
      { t: "\u64A4\u9500", tap: "[ctrl+z]" },
      { t: "\u590D\u5236", tap: "[ctrl+c]" },
      { t: "\u526A\u5207", tap: "[ctrl+x]" },
      { t: "\u7C98\u8D34", tap: "[ctrl+v]" },
      { t: "\u5168\u9009", tap: "[ctrl+a]" },
      { t: "\u4FDD\u5B58", tap: "[ctrl+s]" },
      { t: "\u6362\u884C", tap: "[enter]" }
    ],
    [
      { t: "\u626B\u4E00\u626B", tap: "[open:alipays://platformapi/startapp?saId=10000007]", color: "blue", note: "\u6253\u5F00\u652F\u4ED8\u5B9D\u626B\u4E00\u626B\uFF08\u9700\u5DF2\u5B89\u88C5\uFF09", align: "right" },
      { t: "\u6536\u4ED8\u6B3E", tap: "[open:alipays://platformapi/startapp?saId=20000056]", color: "green", note: "\u6253\u5F00\u652F\u4ED8\u5B9D\u6536\u4ED8\u6B3E\uFF08\u9700\u5DF2\u5B89\u88C5\uFF09" },
      { t: "\u7FFB\u8BD1", tap: "[open:https://fanyi.baidu.com]", note: "\u6253\u5F00\u767E\u5EA6\u7FFB\u8BD1\u7F51\u9875" },
      { t: "\u90AE\u7BB1", tap: "me@example.com", span: 2, note: "\u6539\u6210\u4F60\u81EA\u5DF1\u7684\u90AE\u7BB1" },
      { t: "\u232B", tap: "[backspace]", note: "\u9000\u683C\uFF0C\u957F\u6309\u8FDE\u5220" }
    ]
  ]
}, null, 2);
function ckEnter() {
  if (!ckRows) ckLoad();
  ckSel = null;
  ckEditMode = false;
  document.getElementById("ckEditBar").hidden = true;
  ckCloseModal();
  ckRenderRows();
}
__name(ckEnter, "ckEnter");
const CK_ALIGNS = ["left", "center", "right"];
function ckRowAlign(row) {
  const hit = (row || []).map((c) => c && c.align).find((a) => CK_ALIGNS.includes(a));
  return hit || "left";
}
__name(ckRowAlign, "ckRowAlign");
function ckSetRowAlign(r, align) {
  const row = ckRows[r] || [];
  row.forEach((c) => {
    delete c.align;
  });
  if (align !== "left" && row[0]) row[0].align = align;
}
__name(ckSetRowAlign, "ckSetRowAlign");
function ckKeepRowAlign(r, removed) {
  const row = ckRows[r] || [];
  if (!CK_ALIGNS.includes(removed && removed.align)) return;
  if (!row.some((c) => c !== removed && c.align === removed.align) && row.length > 1) {
    row.find((c) => c !== removed).align = removed.align;
  }
}
__name(ckKeepRowAlign, "ckKeepRowAlign");
function ckFitStrip(strip, minPct) {
  strip.style.fontSize = "";
  const avail = strip.clientWidth;
  if (!avail) return;
  strip.classList.add("ck-fitting");
  for (let round = 0; round < 3 && strip.scrollWidth > avail; round++) {
    const cur2 = parseInt(strip.style.fontSize, 10) || 100;
    const pct = Math.round(cur2 * avail / strip.scrollWidth);
    const clamped = Math.max(minPct, Math.min(pct, cur2));
    strip.style.fontSize = clamped + "%";
    if (clamped <= minPct) break;
  }
  let cur = parseInt(strip.style.fontSize, 10) || 100;
  while (strip.scrollWidth > avail && cur > minPct) {
    cur = Math.max(minPct, cur - 1);
    strip.style.fontSize = cur + "%";
  }
  strip.classList.remove("ck-fitting");
}
__name(ckFitStrip, "ckFitStrip");
function ckRenderRows(skipFit) {
  const host = $("ckRowList");
  const fontSizes = skipFit ? [...host.querySelectorAll(".ck-row-strip")].map((strip) => strip.style.fontSize) : [];
  host.textContent = "";
  const bar = document.getElementById("ckEditBar");
  if (bar) bar.hidden = !ckEditMode;
  const fitted = [];
  ckRows.forEach((row, r) => {
    const line = document.createElement("div");
    line.className = "ck-row-line";
    const head = document.createElement("div");
    head.className = "ck-row-head";
    const label = document.createElement("span");
    label.textContent = t("ck.row", { n: r + 1 });
    head.append(label);
    if (row.length) {
      const seg = document.createElement("div");
      seg.className = "ck-align";
      seg.setAttribute("aria-label", t("ck.align.aria"));
      const cur = ckRowAlign(row);
      for (const a of CK_ALIGNS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ck-align-btn" + (cur === a ? " on" : "");
        b.textContent = t("ck.align." + a);
        b.addEventListener("click", () => {
          ckSetRowAlign(r, a);
          ckRenderRows();
          ckMarkDirty(true);
        });
        seg.append(b);
      }
      head.append(seg);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "ck-chip ck-add-chip ck-head-add";
    add.textContent = t("ck.add");
    add.setAttribute("aria-label", t("ck.add.aria", { n: r + 1 }));
    add.addEventListener("click", () => ckOpenNew(r));
    head.append(add);
    line.append(head);
    const strip = document.createElement("div");
    strip.className = "ck-chips ck-row-strip";
    if (skipFit) strip.style.fontSize = fontSizes[r] || "";
    const align = ckRowAlign(row);
    if (row.length && align !== "left") strip.dataset.align = align;
    if (!row.length) {
      const none = document.createElement("span");
      none.className = "ck-none";
      none.textContent = t("ck.none");
      strip.append(none);
    }
    strip.dataset.ckRow = String(r);
    row.forEach((cell, c) => {
      const held = ckDrag && ckDrag.cell === cell && ckDrag.chip;
      const chip = held || document.createElement("button");
      chip.type = "button";
      const hueM = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color || "");
      const hexM = /^#[0-9a-fA-F]{6}$/.test(cell.color || "");
      const styled = hueM || hexM;
      chip.className = "ck-chip" + (!styled && cell.color ? " ck-" + cell.color : "");
      if (cell.span === 2 || cell.span === 3) chip.dataset.span = String(cell.span);
      if (styled) {
        if (hexM) {
          chip.style.background = cell.color;
          chip.style.borderColor = cell.color;
          chip.style.color = feelInkOn(cell.color);
        } else {
          const s = hueM[2] != null ? hueM[2] : 65;
          chip.style.background = "hsl(" + hueM[1] + ", " + s + "%, 45%)";
          chip.style.borderColor = "hsl(" + hueM[1] + ", " + s + "%, 35%)";
        }
        chip.style.color = "#fff";
      }
      chip.textContent = cell.tap === "[backspace]" || cell.tap === "[bs]" ? "\u232B" : cell.t;
      if (ckEditMode) {
        const x = document.createElement("span");
        x.className = "ck-x";
        x.textContent = "\xD7";
        x.addEventListener("click", (event) => {
          event.stopPropagation();
          ckConfirmDelete(cell);
        });
        chip.append(x);
      } else {
        if (!held) chip.addEventListener("click", () => {
          if (!ckEditMode) ckOpenChip(r, c);
        });
      }
      if (!held) ckBindChipTouch(chip);
      strip.append(chip);
    });
    line.append(strip);
    host.append(line);
    fitted.push(strip);
  });
  if (!skipFit) fitted.forEach((s) => ckFitStrip(s, 55));
}
__name(ckRenderRows, "ckRenderRows");
let ckEditMode = false;
let ckPendingDelete = null;
function ckConfirmDelete(cell) {
  ckPendingDelete = cell;
  const modal = document.getElementById("ckDelModal");
  const label = cell.t || (cell.tap === "[backspace]" || cell.tap === "[bs]" ? "\u232B" : "");
  document.getElementById("ckDelText").textContent = t("ck.del.confirm", { t: label });
  modal.hidden = false;
}
__name(ckConfirmDelete, "ckConfirmDelete");
let ckDrag = null;
let ckDragHandlers = null;
function ckUnbindDrag() {
  if (!ckDragHandlers) return;
  ckDragHandlers.target.removeEventListener("touchmove", ckDragHandlers.move);
  ckDragHandlers.target.removeEventListener("touchend", ckDragHandlers.end);
  ckDragHandlers.target.removeEventListener("touchcancel", ckDragHandlers.end);
  ckDragHandlers = null;
}
__name(ckUnbindDrag, "ckUnbindDrag");
function ckEndDragSession() {
  ckUnbindDrag();
  const dragging = document.querySelector(".ck-dragging");
  if (dragging) dragging.classList.remove("ck-dragging");
  if (ckDrag && ckDrag.ghost) {
    ckDrag.ghost.remove();
    ckDrag.ghost = null;
  }
  ckDrag = null;
}
__name(ckEndDragSession, "ckEndDragSession");
function ckEnterEditMode(firstChip) {
  ckEditMode = true;
  document.getElementById("ckEditBar").hidden = false;
  document.body.classList.add("ck-editing");
  let anchor = null;
  if (firstChip && firstChip.parentElement && firstChip.parentElement.dataset && firstChip.parentElement.dataset.ckRow != null) {
    anchor = {
      r: Number(firstChip.parentElement.dataset.ckRow),
      c: [...firstChip.parentElement.children].indexOf(firstChip)
    };
  }
  if (anchor && ckDrag) ckDrag.cell = ckRows[anchor.r][anchor.c];
  ckRenderRows();
  ckReportState();
  let chip = firstChip;
  if (anchor && ckRows[anchor.r] && ckRows[anchor.r][anchor.c] != null) {
    const st = [...document.querySelectorAll("#ckRowList .ck-chips[data-ck-row]")].find((s) => Number(s.dataset.ckRow) === anchor.r);
    chip = st && [...st.children][anchor.c] || chip;
  }
  if (chip) ckBindDrag(chip);
}
__name(ckEnterEditMode, "ckEnterEditMode");
function ckExitEditMode() {
  ckEditMode = false;
  document.getElementById("ckEditBar").hidden = true;
  document.body.classList.remove("ck-editing");
  ckRenderRows();
  ckReportState();
}
__name(ckExitEditMode, "ckExitEditMode");
function ckBindChipTouch(chip) {
  chip.addEventListener("contextmenu", (event) => event.preventDefault());
  chip.addEventListener("touchstart", (event) => {
    if (event.target && event.target.closest && event.target.closest(".ck-x")) return;
    if (!ckRows) return;
    if (ckDrag) ckEndDragSession();
    const t2 = event.touches[0];
    if (ckEditMode) {
      ckDrag = {
        timer: null,
        dragging: false,
        startX: t2.clientX,
        startY: t2.clientY,
        chip
      };
      ckBindDrag(chip);
      return;
    }
    ckDrag = {
      timer: null,
      dragging: false,
      startX: t2.clientX,
      startY: t2.clientY,
      chip
    };
    ckDrag.timer = setTimeout(() => {
      ckEnterEditMode(ckDrag.chip);
    }, 350);
  }, { passive: true });
  chip.addEventListener("touchmove", (event) => {
    if (!ckDrag) return;
    const t2 = event.touches[0];
    if (!ckDrag.dragging && !ckEditMode && Math.hypot(t2.clientX - ckDrag.startX, t2.clientY - ckDrag.startY) > 10) {
      clearTimeout(ckDrag.timer);
    }
  }, { passive: true });
  chip.addEventListener("touchend", () => {
    if (ckDrag && !ckDrag.dragging) clearTimeout(ckDrag.timer);
  }, { passive: true });
}
__name(ckBindChipTouch, "ckBindChipTouch");
function ckBindDrag(chip) {
  ckUnbindDrag();
  const strip = chip.parentElement;
  if (!strip) return;
  const fromR = Number(strip.dataset.ckRow);
  const fromC = [...strip.children].indexOf(chip);
  const cell = ckRows[fromR] && ckRows[fromR][fromC];
  if (!cell) return;
  let lastX = 0;
  let lastY = 0;
  let rafPending = false;
  const handlers = { target: null, move: null, end: null };
  if (!ckDrag) ckDrag = { timer: null, dragging: false, chip };
  ckDrag.cell = cell;
  ckDrag.chip = chip;
  if (!ckDrag.ghost) {
    const rect = chip.getBoundingClientRect();
    const fontSize = getComputedStyle(chip).fontSize;
    if (!Number.isFinite(ckDrag.startX) || !Number.isFinite(ckDrag.startY)) {
      ckDrag.startX = rect.left + rect.width / 2;
      ckDrag.startY = rect.top + rect.height / 2;
    }
    const ghost = document.createElement("div");
    ghost.className = "ck-ghost";
    ghost.textContent = cell.tap === "[backspace]" || cell.tap === "[bs]" ? "\u232B" : cell.t;
    const ghHue = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color || "");
    const ghHex = /^#[0-9a-fA-F]{6}$/.test(cell.color || "");
    if (!ghHue && !ghHex && cell.color) ghost.classList.add("ck-" + cell.color);
    else if (ghHue || ghHex) {
      if (ghHex) {
        ghost.style.background = cell.color;
        ghost.style.borderColor = cell.color;
        ghost.style.color = feelInkOn(cell.color);
      } else {
        const s = ghHue[2] != null ? ghHue[2] : 65;
        ghost.style.background = "hsl(" + ghHue[1] + ", " + s + "%, 45%)";
        ghost.style.borderColor = "hsl(" + ghHue[1] + ", " + s + "%, 35%)";
      }
      ghost.style.color = "#fff";
    }
    if (cell.span === 2 || cell.span === 3) ghost.style.minWidth = rect.width + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.fontSize = fontSize;
    ckDrag.ghost = ghost;
    ckDrag.grabX = ckDrag.startX - rect.left;
    ckDrag.grabY = ckDrag.startY - rect.top;
    document.body.append(ghost);
    ghost.style.left = ckDrag.startX - ckDrag.grabX + "px";
    ghost.style.top = ckDrag.startY - ckDrag.grabY + "px";
    ghost.style.transform = "translate(0px,0px) scale(1.06)";
  }
  chip.classList.add("ck-dragging");
  const onMove = /* @__PURE__ */ __name((event) => {
    if (!ckEditMode) {
      onEnd();
      return;
    }
    const t2 = event.touches[0];
    ckDrag.dragging = true;
    if (ckDrag.ghost) {
      const dx = t2.clientX - ckDrag.startX;
      const dy = t2.clientY - ckDrag.startY;
      ckDrag.ghost.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.06)";
    }
    if (event.cancelable) event.preventDefault();
    lastX = t2.clientX;
    lastY = t2.clientY;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (ckDragHandlers !== handlers) return;
        reorder(lastX, lastY);
      });
    }
  }, "onMove");
  const reorder = /* @__PURE__ */ __name((x, y) => {
    const strips = [...document.querySelectorAll("#ckRowList .ck-chips[data-ck-row]")];
    let toR = fromR;
    for (const st of strips) {
      const rect = st.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        toR = Number(st.dataset.ckRow);
        break;
      }
    }
    const target = strips.find((st) => Number(st.dataset.ckRow) === toR);
    if (!target) return;
    let toC = ckRows[toR].length;
    [...target.children].forEach((el, i) => {
      if (el === chip) return;
      const rect = el.getBoundingClientRect();
      if (x < rect.left + rect.width / 2) {
        toC = Math.min(toC, i);
      }
    });
    if (toR === fromR && toC > fromC) toC -= 1;
    if (toR === fromR && toC === fromC) return;
    ckKeepRowAlign(fromR, cell);
    ckRows[fromR].splice(fromC, 1);
    ckRows[toR].splice(toC, 0, cell);
    ckMarkDirty(true);
    ckRenderRows(true);
    const stripNow = [...document.querySelectorAll("#ckRowList .ck-chips[data-ck-row]")].find((st) => Number(st.dataset.ckRow) === toR);
    const chipNow = stripNow && [...stripNow.children][toC];
    if (chipNow) ckBindDrag(chipNow);
  }, "reorder");
  const onEnd = /* @__PURE__ */ __name(() => {
    ckEndDragSession();
    ckRenderRows();
  }, "onEnd");
  handlers.move = onMove;
  handlers.end = onEnd;
  handlers.target = ckDrag.chip;
  handlers.target.addEventListener("touchmove", onMove, { passive: false });
  handlers.target.addEventListener("touchend", onEnd, { passive: true });
  handlers.target.addEventListener("touchcancel", onEnd, { passive: true });
  ckDragHandlers = handlers;
}
__name(ckBindDrag, "ckBindDrag");
function ckOpenChip(r, c) {
  const cell = ckRows[r][c];
  ckEditorTarget = "cell";
  ckSel = { r, c, isNew: false };
  ckDraft = {
    t: cell.t,
    text: "",
    single: "esc",
    comboKey: "s",
    mods: /* @__PURE__ */ new Set(["ctrl"]),
    setting: "",
    panel: "clipboard",
    dsl: "",
    ...ckTapParse(cell.tap),
    color: cell.color || "",
    note: cell.note || "",
    span: cell.span === 2 || cell.span === 3 ? cell.span : 0
  };
  ckBuildForm();
  ckOpenModal(false);
}
__name(ckOpenChip, "ckOpenChip");
function ckOpenNew(r) {
  ckEditorTarget = "cell";
  ckSel = { r, c: ckRows[r].length, isNew: true };
  ckDraft = {
    t: "",
    mode: "single",
    single: "esc",
    text: "",
    comboKey: "s",
    mods: /* @__PURE__ */ new Set(["ctrl"]),
    open: "",
    setting: "",
    panel: "clipboard",
    dsl: "",
    color: "",
    note: "",
    span: 0
  };
  ckBuildForm();
  ckOpenModal(true);
}
__name(ckOpenNew, "ckOpenNew");
function ckLangSlotParse(tap) {
  if (tap === void 0 || tap === null) return { mode: "def" };
  if (tap === "") return { mode: "none" };
  const parsed = ckTapParse(tap);
  return { ...parsed, dsl: tap };
}
__name(ckLangSlotParse, "ckLangSlotParse");
function ckBuildLangKeyForm(body, d) {
  const isPunct = d.langKey === ".";
  const lock = document.createElement("div");
  lock.className = "ck-row2 ck-row2-bare";
  lock.innerHTML = '<div class="ck-lang-lock"><span class="ck-lang-k">' + (isPunct ? "\uFF0C" : d.langKey.toUpperCase()) + "</span><span>" + t(isPunct ? "ck.lang.lockPunct" : "ck.lang.lock").replace("{0}", d.langKey) + "</span></div>";
  body.append(lock);
  if (!isPunct) {
    const alt = document.createElement("input");
    alt.className = "ck-input";
    alt.value = d.alt || "";
    const defAlt = ckLangDefaultAlt(d.langLay, d.langKey);
    alt.placeholder = t("ck.lang.altPlaceholder").replace("{0}", defAlt);
    alt.maxLength = 3;
    alt.addEventListener("input", () => {
      d.alt = alt.value.trim();
    });
    body.append(ckField(t("ck.lang.alt"), alt));
  }
  for (const [slot, labelKey] of [["up", "ck.lang.slotUp"], ["down", "ck.lang.slotDown"]]) {
    const sec = document.createElement("div");
    sec.className = "ck-lang-sec";
    const head = document.createElement("div");
    head.className = "ck-lang-sec-t";
    const title = document.createElement("span");
    title.textContent = t(labelKey);
    const cur = document.createElement("span");
    cur.className = "ck-lang-sec-cur";
    const refreshCur = /* @__PURE__ */ __name(() => {
      const tap = ckTapFromDraft(d[slot]);
      cur.textContent = tap ? tap : t(slot === "up" ? "ck.lang.defUp" : "ck.lang.defDown").replace("{0}", d.langKey.toUpperCase());
      cur.classList.toggle("set", !!tap);
    }, "refreshCur");
    head.append(title, cur);
    sec.append(head);
    const modeList = [
      ["def", "ck.f.mode.def"],
      ["none", "ck.f.mode.none"],
      ...CK_MODES
    ];
    const modeSel = document.createElement("select");
    modeSel.className = "ck-input";
    modeList.forEach(([value, labelKey2]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = t(labelKey2);
      modeSel.append(opt);
    });
    modeSel.value = modeList.some(([v]) => v === d[slot].mode) ? d[slot].mode : "def";
    modeSel.addEventListener("change", () => {
      const m = modeSel.value;
      d[slot] = m === "def" ? { mode: "def" } : m === "none" ? { mode: "none" } : { mode: m, ...m === "op" ? { op: "copy" } : m === "panel" ? { panel: "clipboard" } : m === "single" ? { single: "esc" } : m === "combo" ? { comboKey: "s", mods: /* @__PURE__ */ new Set(["ctrl"]) } : m === "text" ? { text: "" } : m === "open" ? { open: "" } : m === "setting" ? { setting: "" } : m === "advanced" ? { dsl: "" } : {} };
      ckBuildForm();
    });
    sec.append(ckField(t("ck.f.kind"), modeSel));
    if (d[slot].mode !== "def" && d[slot].mode !== "none") {
      const holder = document.createElement("div");
      sec.append(holder);
      ckBuildAction(holder, d[slot]);
    }
    body.append(sec);
  }
}
__name(ckBuildLangKeyForm, "ckBuildLangKeyForm");
function openLangKeyEditor(lay, key) {
  ckEditorTarget = "langkey";
  ckSel = null;
  const table = ckLangKeys[lay] = ckLangKeys[lay] || {};
  const cell = table[key] || {};
  ckDraft = {
    langLay: lay,
    langKey: key,
    alt: cell.alt || "",
    up: ckLangSlotParse(cell.up),
    down: ckLangSlotParse(cell.down),
    t: "",
    text: "",
    single: "esc",
    comboKey: "s",
    mods: /* @__PURE__ */ new Set(["ctrl"]),
    open: "",
    setting: "",
    panel: "clipboard",
    dsl: "",
    color: "",
    note: "",
    span: 0
  };
  ckBuildForm();
  ckOpenModal(false);
  document.getElementById("ckModalTitle").textContent = t("ck.lang.editTitle").replace("{0}", key === "." ? "\uFF0C" : key.toUpperCase());
}
__name(openLangKeyEditor, "openLangKeyEditor");
function openSpaceHoldEditor() {
  ckEditorTarget = "space";
  ckSel = null;
  const parsed = spaceHoldRaw === "voice" || spaceHoldRaw === "none" ? { mode: spaceHoldRaw } : ckTapParse(spaceHoldRaw);
  ckDraft = {
    t: "",
    text: "",
    single: "esc",
    comboKey: "s",
    mods: /* @__PURE__ */ new Set(["ctrl"]),
    open: "",
    setting: "",
    panel: "clipboard",
    dsl: "",
    color: "",
    note: "",
    span: 0,
    spaceFace: spaceHoldTextRaw,
    ...parsed
  };
  ckBuildForm();
  ckOpenModal(true);
}
__name(openSpaceHoldEditor, "openSpaceHoldEditor");
function renderSpaceHold(state) {
  spaceHoldTextRaw = typeof state.spaceHoldText === "string" ? state.spaceHoldText : "";
  const raw = typeof state.spaceHoldTap === "string" && state.spaceHoldTap ? state.spaceHoldTap : state.voiceOnSpace === false ? "none" : "voice";
  spaceHoldRaw = raw === "voice" || raw === "none" ? raw : raw.startsWith("dsl:") ? raw.slice(4) : "voice";
  const el = document.getElementById("spaceHoldSummary");
  if (el) el.textContent = spaceHoldSummary(spaceHoldRaw);
}
__name(renderSpaceHold, "renderSpaceHold");
function spaceHoldSummary(raw) {
  if (raw === "voice") return t("voice.hold.voice");
  if (raw === "none") return t("voice.hold.none");
  const parsed = ckTapParse(raw);
  if (parsed.mode === "panel") {
    const labels = Object.fromEntries(CK_PANEL_TARGETS);
    return t(labels[parsed.panel] || "ck.f.mode.panel");
  }
  const keys = {
    text: "ck.f.mode.text",
    single: "ck.f.mode.single",
    combo: "ck.f.mode.combo",
    open: "ck.f.mode.open",
    setting: "ck.f.mode.setting",
    advanced: "ck.f.mode.advanced"
  };
  const key = keys[parsed.mode] || "ck.f.mode.advanced";
  const preview = [...String(raw)].length > 16 ? [...String(raw)].slice(0, 15).join("") + "\u2026" : String(raw);
  return t(key) + " \xB7 " + preview;
}
__name(spaceHoldSummary, "spaceHoldSummary");
function ckField(labelText, control, cls) {
  const wrap = document.createElement("label");
  wrap.className = "ck-row2" + (cls ? " " + cls : "");
  if (labelText != null) {
    const span = document.createElement("span");
    span.className = "ck-row2-label";
    span.textContent = labelText;
    wrap.append(span);
  } else {
    wrap.classList.add("ck-row2-bare");
  }
  control.classList.add("ck-row2-ctl");
  wrap.append(control);
  return wrap;
}
__name(ckField, "ckField");
function ckSegment(options, value, onPick) {
  const row = document.createElement("div");
  row.className = "ck-seg";
  options.forEach(([v, label, cls]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ck-seg-btn" + (cls ? " " + cls : "") + (v === value ? " selected" : "");
    b.textContent = label;
    b.addEventListener("click", () => onPick(v));
    row.append(b);
  });
  return row;
}
__name(ckSegment, "ckSegment");
function ckBuildForm() {
  const body = $("ckEditBody");
  body.textContent = "";
  const d = ckDraft;
  if (ckSel && ckSel.isNew && ckEditorTarget === "cell") {
    const common = document.createElement("div");
    common.className = "ck-common";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ck-common-toggle";
    toggle.textContent = t("ck.common") + " \u25BE";
    const list = document.createElement("div");
    list.className = "ck-chips ck-common-list";
    list.hidden = true;
    CK_QUICK.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ck-chip ck-common-chip" + (item.color ? " ck-" + item.color : "");
      chip.textContent = item.t;
      chip.title = item.note || item.tap;
      chip.addEventListener("click", () => {
        ckDraft.t = item.t;
        ckDraft.note = item.note || "";
        ckDraft.color = item.color || "";
        ckDraft.span = item.span === 2 || item.span === 3 ? item.span : 0;
        Object.assign(ckDraft, ckTapParse(item.tap));
        ckBuildForm();
      });
      list.append(chip);
    });
    toggle.addEventListener("click", () => {
      list.hidden = !list.hidden;
      toggle.textContent = t("ck.common") + (list.hidden ? " \u25BE" : " \u25B4");
    });
    common.append(toggle, list);
    body.append(common);
  }
  if (ckEditorTarget === "langkey") {
    ckBuildLangKeyForm(body, d);
    return;
  }
  if (ckEditorTarget === "cell") {
    const tInput = document.createElement("input");
    tInput.id = "ckT";
    tInput.className = "ck-input";
    tInput.value = d.t;
    tInput.placeholder = t("ck.f.t.hint");
    tInput.addEventListener("input", () => {
      d.t = tInput.value;
    });
    body.append(ckField(t("ck.f.t"), tInput));
  }
  const modeList = ckEditorTarget === "space" ? [["voice", "voice.hold.voice"], ["none", "voice.hold.none"], ...CK_MODES] : CK_MODES;
  const modeSel = document.createElement("select");
  modeSel.id = "ckMode";
  modeSel.className = "ck-input";
  modeList.forEach(([value, labelKey]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = t(labelKey);
    modeSel.append(opt);
  });
  modeSel.value = modeList.some(([value]) => value === d.mode) ? d.mode : modeList[0][0];
  modeSel.addEventListener("change", () => {
    d.mode = modeSel.value;
    ckBuildForm();
  });
  body.append(ckField(t("ck.f.kind"), modeSel));
  const holder = document.createElement("div");
  holder.id = "ckActionHolder";
  body.append(holder);
  ckBuildAction(holder);
  if (ckEditorTarget !== "cell") {
    const faceRow = document.createElement("div");
    faceRow.id = "ckSpaceFaceRow";
    const faceInput = document.createElement("input");
    faceInput.id = "ckSpaceFace";
    faceInput.className = "ck-input";
    faceInput.value = d.spaceFace || "";
    faceInput.placeholder = t("ck.space.faceHint");
    faceInput.maxLength = 16;
    faceInput.addEventListener("input", () => {
      d.spaceFace = faceInput.value;
    });
    faceRow.append(ckField(t("ck.space.face"), faceInput));
    body.append(faceRow);
    const faceVisible = /* @__PURE__ */ __name(() => {
      faceRow.style.display = d.mode === "voice" ? "none" : "";
    }, "faceVisible");
    faceVisible();
    modeSel.addEventListener("change", faceVisible);
    const noteSkip = document.createElement("p");
    noteSkip.className = "hint";
    noteSkip.textContent = t("ck.space.hint");
    body.append(noteSkip);
    return;
  }
  const HUE_RE = /^h\d{1,3}(?:s\d{1,3})?$/;
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const isCustomHue = HUE_RE.test(d.color || "");
  const isCustomHex = HEX_RE.test(d.color || "");
  const colorSeg = ckSegment(
    [
      ["", t("ck.color.default")],
      ["custom", t("ck.color.custom")],
      ["hex", t("ck.color.hex")]
    ],
    isCustomHex ? "hex" : isCustomHue ? "custom" : "",
    (v) => {
      if (v === "custom") {
        if (!HUE_RE.test(d.color || "")) d.color = "h210s65";
      } else if (v === "hex") {
        if (!HEX_RE.test(d.color || "")) d.color = "#FF8A00";
      } else d.color = "";
      ckBuildForm();
    }
  );
  body.append(ckField(t("ck.f.color"), colorSeg, "ck-row-color"));
  if (isCustomHex) {
    const hexWrap = document.createElement("div");
    hexWrap.className = "hex-wrap";
    const hexSwatch = document.createElement("span");
    hexSwatch.className = "hex-swatch";
    hexSwatch.style.background = d.color;
    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.className = "hex-input";
    hexInput.value = d.color.toUpperCase();
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;
    hexInput.addEventListener("input", () => {
      const v = hexInput.value.trim();
      if (HEX_RE.test(v)) {
        d.color = v.toUpperCase();
        hexSwatch.style.background = d.color;
      }
    });
    hexWrap.append(hexSwatch, hexInput);
    body.append(ckField(t("ck.color.hexLabel"), hexWrap, "ck-row-hexcolor"));
  }
  if (isCustomHue) {
    const parts = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(d.color) || [null, "210", "65"];
    let hueVal = parseInt(parts[1], 10);
    let satVal = parts[2] != null ? parseInt(parts[2], 10) : 65;
    const encode = /* @__PURE__ */ __name(() => {
      d.color = "h" + hueVal + "s" + satVal;
    }, "encode");
    const hueWrap = document.createElement("div");
    hueWrap.className = "ck-hue";
    const hue = document.createElement("input");
    hue.type = "range";
    hue.className = "ck-hue-range";
    hue.min = "0";
    hue.max = "359";
    hue.value = String(hueVal);
    const satWrap = document.createElement("div");
    satWrap.className = "ck-hue";
    const sat = document.createElement("input");
    sat.type = "range";
    sat.className = "ck-sat-range";
    sat.min = "0";
    sat.max = "100";
    sat.value = String(satVal);
    const swatch = document.createElement("span");
    swatch.className = "ck-hue-swatch";
    const paint = /* @__PURE__ */ __name(() => {
      const css = "hsl(" + hueVal + ", " + satVal + "%, 45%)";
      swatch.style.background = css;
      hue.style.setProperty("--thumb-hue", String(hueVal));
      sat.style.background = "linear-gradient(90deg, hsl(" + hueVal + ", 0%, 45%), " + css + ")";
    }, "paint");
    paint();
    hue.addEventListener("input", () => {
      hueVal = parseInt(hue.value, 10) || 0;
      encode();
      paint();
    });
    sat.addEventListener("input", () => {
      satVal = parseInt(sat.value, 10) || 0;
      encode();
      paint();
    });
    hueWrap.append(hue, swatch);
    body.append(ckField(t("ck.color.hue"), hueWrap, "ck-row-hue"));
    satWrap.append(sat);
    body.append(ckField(t("ck.color.sat"), satWrap, "ck-row-hue"));
  }
  const noteInput = document.createElement("input");
  noteInput.id = "ckNote";
  noteInput.className = "ck-input";
  noteInput.value = d.note;
  noteInput.placeholder = t("ck.f.note.hint");
  noteInput.addEventListener("input", () => {
    d.note = noteInput.value;
  });
  body.append(ckField(t("ck.f.note"), noteInput));
}
__name(ckBuildForm, "ckBuildForm");
function ckBuildAction(holder, target) {
  holder.textContent = "";
  const d = target || ckDraft;
  if (d.mode === "op") {
    const sel = document.createElement("select");
    sel.className = "ck-input";
    CK_EDIT_OPS.forEach(([value, labelKey]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = t(labelKey);
      sel.append(opt);
    });
    sel.value = CK_EDIT_OPS.some(([v]) => v === d.op) ? d.op : "copy";
    sel.addEventListener("change", () => {
      d.op = sel.value;
    });
    holder.append(ckField(t("ck.f.op"), sel));
  } else if (d.mode === "text") {
    const input = document.createElement("input");
    input.id = "ckText";
    input.className = "ck-input";
    input.value = d.text || "";
    input.placeholder = t("ck.f.text");
    input.addEventListener("input", () => {
      d.text = input.value;
    });
    holder.append(ckField(t("ck.f.mode.text"), input));
  } else if (d.mode === "single" || d.mode === "combo") {
    if (d.mode === "combo") {
      const row = document.createElement("div");
      row.className = "ck-seg";
      CK_MODS.forEach(([name, label]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ck-seg-btn" + (d.mods.has(name) ? " selected" : "");
        chip.textContent = label;
        chip.addEventListener("click", () => {
          d.mods.has(name) ? d.mods.delete(name) : d.mods.add(name);
          ckBuildAction(holder, d);
        });
        row.append(chip);
      });
      holder.append(ckField(t("ck.f.mods"), row));
    }
    const keySel = document.createElement("select");
    keySel.id = "ckKey";
    CK_KEYS.forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      keySel.append(opt);
    });
    keySel.value = d.mode === "single" ? d.single || "esc" : d.comboKey || "s";
    keySel.addEventListener("change", () => {
      if (d.mode === "single") d.single = keySel.value;
      else d.comboKey = keySel.value;
    });
    holder.append(ckField(t("ck.f.key"), keySel));
  } else if (d.mode === "open") {
    const input = document.createElement("input");
    input.id = "ckOpenUri";
    input.className = "ck-input";
    input.value = d.open || "";
    input.placeholder = t("ck.f.open.placeholder");
    input.addEventListener("input", () => {
      d.open = input.value;
    });
    holder.append(ckField(t("ck.f.open.uri"), input));
    const presetSel = document.createElement("select");
    presetSel.id = "ckOpenPreset";
    const mkOpt = /* @__PURE__ */ __name((text, value) => {
      const opt = document.createElement("option");
      opt.textContent = text;
      opt.value = value;
      return opt;
    }, "mkOpt");
    presetSel.append(mkOpt(t("ck.f.open.presetPick"), ""));
    CK_OPEN_PRESETS.forEach((p) => presetSel.append(mkOpt(p.label, p.uri)));
    presetSel.value = CK_OPEN_PRESETS.some((p) => p.uri === (d.open || "")) ? d.open : "";
    presetSel.addEventListener("change", () => {
      if (!presetSel.value) return;
      d.open = presetSel.value;
      if (typeof d.t === "string" && !d.t.trim()) {
        d.t = (CK_OPEN_PRESETS.find((p) => p.uri === presetSel.value) || {}).t || "";
      }
      ckBuildForm();
    });
    holder.append(ckField(t("ck.f.open.presets"), presetSel));
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = t("ck.f.open.hint");
    holder.append(hint);
  } else if (d.mode === "setting") {
    const sel = document.createElement("select");
    sel.id = "ckSettingPick";
    const anchors = ckSettingAnchors();
    const placeholder = document.createElement("option");
    placeholder.textContent = t("ck.f.setting.pick");
    placeholder.value = "";
    sel.append(placeholder);
    anchors.forEach(([id, label]) => {
      const opt = document.createElement("option");
      opt.textContent = label;
      opt.value = id;
      sel.append(opt);
    });
    sel.value = anchors.some(([id]) => id === d.setting) ? d.setting : "";
    sel.addEventListener("change", () => {
      d.setting = sel.value;
      if (typeof d.t === "string" && !d.t.trim()) {
        const found = anchors.find(([id]) => id === sel.value);
        if (found) d.t = found[1].slice(0, 6);
      }
    });
    holder.append(ckField(t("ck.f.setting.pick"), sel));
  } else if (d.mode === "panel") {
    const targets = CK_PANEL_TARGETS.map(([value, labelKey]) => [value, t(labelKey)]);
    const sel = document.createElement("select");
    sel.id = "ckPanelTarget";
    sel.className = "ck-input";
    targets.forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.textContent = label;
      opt.value = value;
      sel.append(opt);
    });
    sel.value = targets.some(([value]) => value === d.panel) ? d.panel : "clipboard";
    sel.addEventListener("change", () => {
      d.panel = sel.value;
      if (typeof d.t === "string" && !d.t.trim()) {
        const found = targets.find(([value]) => value === sel.value);
        if (found) d.t = found[1].slice(0, 6);
      }
    });
    holder.append(ckField(t("ck.f.panel.pick"), sel));
  } else {
    const labelWrap = document.createElement("span");
    labelWrap.className = "ck-dsl-label";
    const labelText = document.createElement("span");
    labelText.textContent = t("ck.f.mode.advanced");
    const help = document.createElement("button");
    help.type = "button";
    help.className = "ck-help";
    help.textContent = "?";
    help.setAttribute("aria-label", t("ck.help.aria"));
    const helpCard = document.createElement("div");
    helpCard.className = "ck-help-card";
    helpCard.hidden = true;
    helpCard.innerHTML = t("ck.help.dsl");
    help.addEventListener("click", () => {
      helpCard.hidden = !helpCard.hidden;
    });
    labelWrap.append(labelText, help);
    const input = document.createElement("input");
    input.id = "ckDsl";
    input.className = "ck-input";
    input.value = d.dsl || "";
    input.placeholder = t("ck.f.dsl");
    input.addEventListener("input", () => {
      d.dsl = input.value;
    });
    const row = ckField(null, input);
    row.prepend(labelWrap);
    labelWrap.classList.add("ck-row2-label");
    labelWrap.style.display = "inline-flex";
    labelWrap.style.gap = "6px";
    labelWrap.style.alignItems = "center";
    holder.append(row, helpCard);
  }
}
__name(ckBuildAction, "ckBuildAction");
$("ckApply").addEventListener("click", () => {
  const d = ckDraft;
  if (ckEditorTarget === "cell" && !d.t.trim()) return setNote("ckEditNote", t("ck.err.t"));
  if (d.mode === "open") {
    const uri = (d.open || "").trim();
    const ok = /^(https?:\/\/|[a-z][a-z0-9+.\-]*:)/i.test(uri) && !/[\s\[\]]/.test(uri) && !/^(intent|javascript|file|content|about|data|android-app|blob):/i.test(uri);
    if (!ok) return setNote("ckEditNote", t("ck.err.open"));
  }
  if (d.mode === "setting") {
    const id = (d.setting || "").trim();
    if (!/^[\w-]{1,64}$/.test(id) || !document.getElementById(id)) {
      return setNote("ckEditNote", t("ck.err.setting"));
    }
  }
  if (d.mode === "panel" && !CK_PANEL_TARGETS.some(([value]) => value === d.panel)) {
    return setNote("ckEditNote", t("ck.err.panel"));
  }
  const tap = ckEditorTarget === "langkey" ? " " : ckTapFromDraft(d);
  if (!tap) return setNote("ckEditNote", t("ck.err.tap"));
  if ([...tap].length > 128) return setNote("ckEditNote", t("ck.err.tapLong"));
  if (ckEditorTarget === "space") {
    const value = d.mode === "voice" ? "voice" : d.mode === "none" ? "none" : "dsl:" + tap;
    call("setSpaceHoldTap", value);
    const face = d.mode === "voice" ? "" : [...(d.spaceFace || "").trim()].slice(0, 8).join("");
    spaceHoldTextRaw = face;
    call("setSpaceHoldText", face);
    spaceHoldRaw = d.mode === "voice" || d.mode === "none" ? d.mode : tap;
    const el = document.getElementById("spaceHoldSummary");
    if (el) el.textContent = spaceHoldSummary(spaceHoldRaw);
    ckCloseModal();
    return;
  }
  if (ckEditorTarget === "langkey") {
    const lay = d.langLay, key = d.langKey;
    for (const slot of ["up", "down"]) {
      const s = d[slot] || {};
      if (s.mode === "open") {
        const uri = (s.open || "").trim();
        const ok = /^(https?:\/\/|[a-z][a-z0-9+.\-]*:)/i.test(uri) && !/[\s\[\]]/.test(uri) && !/^(intent|javascript|file|content|about|data|android-app|blob):/i.test(uri);
        if (!ok) return setNote("ckEditNote", t("ck.err.open"));
      }
      if (s.mode === "setting") {
        const id = (s.setting || "").trim();
        if (!/^[\w-]{1,64}$/.test(id) || !document.getElementById(id)) {
          return setNote("ckEditNote", t("ck.err.setting"));
        }
      }
    }
    const table = ckLangKeys[lay] = ckLangKeys[lay] || {};
    const cell2 = {};
    if (d.alt) cell2.alt = [...d.alt].slice(0, 3).join("");
    for (const slot of ["up", "down"]) {
      const m = d[slot] ? d[slot].mode : "def";
      if (m === "def") continue;
      cell2[slot] = m === "none" ? "" : ckTapFromDraft(d[slot]);
    }
    if (Object.keys(cell2).length) table[key] = cell2;
    else delete table[key];
    if (!Object.keys(table).length) delete ckLangKeys[lay];
    ckCloseModal();
    renderLangKb(lay);
    refreshLangCounts();
    ckMarkDirty(true);
    return;
  }
  const cell = { t: d.t.trim(), tap, note: d.note || "" };
  if (d.color) cell.color = d.color;
  if (d.span === 2 || d.span === 3) cell.span = d.span;
  const prev = ckSel.isNew ? null : ckRows[ckSel.r][ckSel.c];
  if (prev && CK_ALIGNS.includes(prev.align)) cell.align = prev.align;
  if (ckSel.isNew) ckRows[ckSel.r].push(cell);
  else ckRows[ckSel.r][ckSel.c] = cell;
  ckCloseModal();
  ckRenderRows();
  ckMarkDirty(true);
});
$("ckEditDone").addEventListener("click", () => ckExitEditMode());
$("ckBackGo").addEventListener("click", () => {
  document.getElementById("ckBackModal").hidden = true;
  if (ckEditMode) ckExitEditMode();
});
$("ckBackStay").addEventListener("click", () => {
  document.getElementById("ckBackModal").hidden = true;
});
$("ckBackModalMask").addEventListener("click", () => $("ckBackStay").click());
$("ckDelCancel").addEventListener("click", () => {
  ckPendingDelete = null;
  document.getElementById("ckDelModal").hidden = true;
});
$("ckDelGo").addEventListener("click", () => {
  document.getElementById("ckDelModal").hidden = true;
  const cell = ckPendingDelete;
  ckPendingDelete = null;
  if (!cell || !ckRows) return;
  for (let r = 0; r < ckRows.length; r++) {
    const c = ckRows[r].indexOf(cell);
    if (c < 0) continue;
    ckKeepRowAlign(r, cell);
    ckRows[r].splice(c, 1);
    ckRenderRows();
    ckMarkDirty(true);
    return;
  }
});
$("ckDelModalMask").addEventListener("click", () => $("ckDelCancel").click());
$("ckModalCancel").addEventListener("click", () => ckCloseModal());
$("ckModalMask").addEventListener("click", () => ckCloseModal());
let ckLangCurrent = "pinyin";
function ckLangDefaultAlt(lay, key) {
  const conf = LANG_KB[lay] || {};
  const alts = conf.alts || LANG_KB[conf.share] && LANG_KB[conf.share].alts || {};
  const v = alts[key];
  return v == null ? "" : String(Array.isArray(v) ? v[0] : v);
}
__name(ckLangDefaultAlt, "ckLangDefaultAlt");
function renderLangKb(lay) {
  ckLangCurrent = lay;
  const host = document.getElementById("cklangKb");
  if (!host) return;
  const conf = LANG_KB[lay];
  if (!conf) {
    host.textContent = "";
    return;
  }
  const title = document.getElementById("cklangTitle");
  if (title) title.textContent = t(conf.title);
  const table = ckLangKeys[lay] || {};
  host.textContent = "";
  const rows = conf.rows.map(String);
  rows.forEach((rowKeys, idx) => {
    const rowEl = document.createElement("div");
    rowEl.className = "ck-lang-row" + (idx === 1 ? " ck-lang-indent" : "");
    if (idx === 2) {
      const shift = document.createElement("span");
      shift.className = "ck-lang-key ck-lang-key-sp ck-lang-w15";
      shift.textContent = conf.leftKey === "shift" ? "\u21E7" : t("ck.lang.shiftKey");
      rowEl.append(shift);
    }
    [...rowKeys].forEach((key) => rowEl.append(ckLangKeyEl(lay, key, table[key])));
    if (idx === 2) {
      const bs = document.createElement("span");
      bs.className = "ck-lang-key ck-lang-key-sp ck-lang-w2";
      bs.textContent = "\u232B";
      rowEl.append(bs);
    }
    host.append(rowEl);
  });
  const bottom = document.createElement("div");
  bottom.className = "ck-lang-row";
  const locked = /* @__PURE__ */ __name((label, key) => {
    const el = document.createElement("span");
    el.className = "ck-lang-key ck-lang-key-sp" + (key || "");
    el.textContent = label;
    return el;
  }, "locked");
  bottom.append(locked("123", " ck-lang-w2"));
  bottom.append(ckLangKeyEl(lay, ".", table["."]));
  bottom.append(locked("\u2423", " ck-lang-w3"));
  bottom.append(locked(t("ck.lang.cnEn")));
  bottom.append(locked("\u23CE", " ck-lang-w2"));
  host.append(bottom);
}
__name(renderLangKb, "renderLangKb");
function ckLangKeyEl(lay, key, cell) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "ck-lang-key";
  const isPunct = key === ".";
  el.innerHTML = '<span class="ck-lang-sub"></span><span class="ck-lang-main"></span>';
  el.querySelector(".ck-lang-main").textContent = isPunct ? "\uFF0C" : key;
  const sub = cell && cell.alt != null ? cell.alt : isPunct ? "\u3002" : ckLangDefaultAlt(lay, key);
  el.querySelector(".ck-lang-sub").textContent = sub;
  if (cell && Object.keys(cell).length) el.classList.add("ck-lang-custom");
  el.setAttribute("aria-label", t(isPunct ? "ck.lang.editPunct" : "ck.lang.editKey").replace("{0}", isPunct ? "\uFF0C" : key.toUpperCase()));
  el.addEventListener("click", () => openLangKeyEditor(lay, key));
  return el;
}
__name(ckLangKeyEl, "ckLangKeyEl");
function refreshLangCounts() {
  for (const lay of Object.keys(LANG_KB)) {
    const el = document.getElementById("cklangCount-" + lay);
    if (!el) continue;
    const n = ckLangKeys[lay] ? Object.keys(ckLangKeys[lay]).length : 0;
    el.textContent = n ? t("ck.lang.count", { count: n }) : t("ck.lang.default");
  }
}
__name(refreshLangCounts, "refreshLangCounts");
document.querySelectorAll("[data-cklang]").forEach((row) => {
  row.addEventListener("click", () => {
    ckLangCurrent = row.dataset.cklang;
    showPage("cklang");
    renderLangKb(ckLangCurrent);
  });
});
document.getElementById("ckSymbolEntry").addEventListener("click", () => showPage("cksymbol"));
document.getElementById("cklangReset").addEventListener("click", () => {
  delete ckLangKeys[ckLangCurrent];
  renderLangKb(ckLangCurrent);
  refreshLangCounts();
  ckMarkDirty(true);
  setNote("ckSaveNote", t("ck.lang.resetDone"));
});
function ckPackJson() {
  const pack = { version: 1, rows: ckRows };
  if (Object.keys(ckLangKeys).length) pack.langKeys = ckLangKeys;
  return pack;
}
__name(ckPackJson, "ckPackJson");
let ckJsonProjected = "";
function ckSyncJsonView() {
  const ta = $("customJson");
  if (document.activeElement === ta) return;
  if (ta.value !== ckJsonProjected) {
    ckAbsorbJson();
    return;
  }
  ta.value = ckJsonProjected = JSON.stringify(ckPackJson(), null, 2);
}
__name(ckSyncJsonView, "ckSyncJsonView");
function ckAbsorbJson() {
  try {
    const parsed = JSON.parse($("customJson").value || "null");
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.rows)) return false;
    ckRows = [0, 1, 2].map((i) => Array.isArray(parsed.rows[i]) ? parsed.rows[i].slice() : []);
    ckLangKeys = parsed.langKeys && typeof parsed.langKeys === "object" && !Array.isArray(parsed.langKeys) ? parsed.langKeys : {};
    if (currentPage === "cksymbol") ckRenderRows();
    return true;
  } catch (_) {
    return false;
  }
}
__name(ckAbsorbJson, "ckAbsorbJson");
let ckJsonAbsorbTimer = null;
$("customJson").addEventListener("input", () => {
  ckMarkDirty(true);
  clearTimeout(ckJsonAbsorbTimer);
  ckJsonAbsorbTimer = setTimeout(ckAbsorbJson, 250);
});
function ckSaveAll(noteId) {
  const json = JSON.stringify(ckPackJson(), null, 2);
  call("saveCustom", json, $("customEnabled").checked);
  $("customJson").value = ckJsonProjected = json;
  ckMarkDirty(false);
  setNote(noteId, t("ck.note.saved"));
}
__name(ckSaveAll, "ckSaveAll");
$("ckSave").addEventListener("click", () => ckSaveAll("ckSaveNote"));
$("btnOpenCustomKeys").addEventListener("click", () => showPage("customkeys"));
$("btnOpenFuzzy").addEventListener("click", () => showPage("fuzzy"));
$("btnOpenKeyboards").addEventListener("click", () => showPage("keyboards"));
$("ckLeaveStay").addEventListener("click", () => {
  ckLeaveTarget = null;
  document.getElementById("ckLeaveModal").hidden = true;
});
$("ckLeaveGo").addEventListener("click", () => {
  document.getElementById("ckLeaveModal").hidden = true;
  ckMarkDirty(false);
  const target = ckLeaveTarget;
  ckLeaveTarget = null;
  if (target) showPage(target);
});
$("btnGithubIssues").addEventListener("click", () => call("openGithub", "issues"));
$("btnFeishuGroup").addEventListener("click", () => call("openFeishuGroup"));
let latestReleaseAssets = null;
function newerVersion(latest, current) {
  const norm = /* @__PURE__ */ __name((s) => String(s || "").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0), "norm");
  const a = norm(latest), b = norm(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0;
  }
  return false;
}
__name(newerVersion, "newerVersion");
async function checkGithubUpdate() {
  $("btnDlThin").hidden = true;
  $("btnDlFull").hidden = true;
  latestReleaseAssets = null;
  setNote("aboutNote", t("update.checking"));
  const current = lastState && lastState.appVersion || "?";
  const endpoints = [
    "https://gh-proxy.com/https://api.github.com/repos/feelime/feelime/releases/latest",
    "https://api.github.com/repos/feelime/feelime/releases/latest"
  ];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8e3);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const rel = await res.json();
      const tag = String(rel.tag_name || "").replace(/^v/, "");
      if (!tag) continue;
      if (!newerVersion(tag, current)) {
        setNote("aboutNote", t("update.upToDate", [tag]));
        return;
      }
      setNote("aboutNote", t("update.available", [tag, current]));
      latestReleaseAssets = {};
      (rel.assets || []).forEach((asset) => {
        const m = /-(thin|full)\.apk$/.exec(asset.name || "");
        if (m && asset.browser_download_url) latestReleaseAssets[m[1]] = asset.browser_download_url;
      });
      if (latestReleaseAssets.thin) $("btnDlThin").hidden = false;
      if (latestReleaseAssets.full) $("btnDlFull").hidden = false;
      return;
    } catch (_) {
    }
  }
  setNote("aboutNote", t("update.failed"));
}
__name(checkGithubUpdate, "checkGithubUpdate");
$("btnAboutCheckUpdate").addEventListener("click", () => {
  if (lastState && lastState.playDistribution) {
    call("openAppStore");
    return;
  }
  checkGithubUpdate();
});
function downloadRelease(kind) {
  const raw = latestReleaseAssets && latestReleaseAssets[kind];
  if (!raw) return;
  call("openReleaseDownload", "https://gh-proxy.com/" + raw);
}
__name(downloadRelease, "downloadRelease");
$("btnDlThin").addEventListener("click", () => downloadRelease("thin"));
$("btnDlFull").addEventListener("click", () => downloadRelease("full"));
$("btnCopyAbout").addEventListener("click", () => {
  if (!lastState) return;
  call("copyText", aboutRows(lastState, { forCopy: true }).map(([label, value]) => `${label}: ${value}`).join("\n"));
  setNote("aboutNote", t("note.copied"));
});
document.querySelectorAll("[data-target]").forEach((entry) => {
  entry.addEventListener("click", () => showPage(entry.dataset.target));
});
window.addEventListener("hashchange", applyLocationHash);
applyLocationHash();
document.querySelectorAll("[data-back]").forEach((back) => {
  back.addEventListener("click", () => showPage(back.dataset.back || "home"));
});
applyLocale();
const FOCUS_SCROLL_INPUT_TYPES = /* @__PURE__ */ new Set([
  "text",
  "search",
  "url",
  "password",
  "number",
  "email",
  "tel"
]);
document.addEventListener("focusin", (event) => {
  const el = event.target;
  if (el && el.tagName === "INPUT") {
    if (!FOCUS_SCROLL_INPUT_TYPES.has(el.type) || el.readOnly) return;
  } else if (!el || el.tagName !== "TEXTAREA" || el.readOnly) {
    return;
  }
  if (typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ block: "center", behavior: "instant" });
});
function imeEditableTarget(el) {
  if (!el) return false;
  if (el.tagName === "INPUT") {
    return FOCUS_SCROLL_INPUT_TYPES.has(el.type) && !el.readOnly;
  }
  return el.tagName === "TEXTAREA" && !el.readOnly;
}
__name(imeEditableTarget, "imeEditableTarget");
function imeGestureField(el) {
  return imeEditableTarget(el) && typeof el.setSelectionRange === "function" && el.selectionStart !== null && el.selectionStart !== void 0;
}
__name(imeGestureField, "imeGestureField");
function clearImeGestureSnapshots() {
  document.querySelectorAll("input, textarea").forEach((el) => {
    el.__imeDeleteSnapshot = null;
  });
}
__name(clearImeGestureSnapshots, "clearImeGestureSnapshots");
window.Feelime = window.Feelime || {};
window.Feelime.onImeGestureDeleteAll = function() {
  const el = document.activeElement;
  if (!imeGestureField(el)) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start !== end) return;
  if (start === 0) return;
  el.__imeDeleteSnapshot = el.value.slice(0, start);
  el.value = el.value.slice(start);
  el.setSelectionRange(0, 0);
  dispatchImeInput(el);
};
window.Feelime.onImeGestureRestore = function() {
  const el = document.activeElement;
  if (!imeGestureField(el)) return;
  const snap = el.__imeDeleteSnapshot;
  if (!snap) return;
  if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
  el.__imeDeleteSnapshot = null;
  el.value = snap + el.value;
  el.setSelectionRange(snap.length, snap.length);
  dispatchImeInput(el);
};
function dispatchImeInput(el) {
  if (typeof Event !== "function" || typeof el.dispatchEvent !== "function") return;
  const ev = new Event("input", { bubbles: true });
  ev.__imeGesture = true;
  el.dispatchEvent(ev);
}
__name(dispatchImeInput, "dispatchImeInput");
document.addEventListener("input", (event) => {
  if (event.__imeGesture) return;
  const el = event.target;
  if (el && el.__imeDeleteSnapshot != null) el.__imeDeleteSnapshot = null;
}, true);
document.addEventListener("focusin", (event) => {
  if (imeEditableTarget(event.target) && token) Native.imeInputFocused(true, token);
});
document.addEventListener("focusout", (event) => {
  if (imeEditableTarget(event.target) && token) Native.imeInputFocused(false, token);
});
function reportImeGestureSupport() {
  if (token) Native.imeGestureSupport(token);
}
__name(reportImeGestureSupport, "reportImeGestureSupport");
function resyncImeFocusReport() {
  if (!token) return;
  Native.imeInputFocused(imeEditableTarget(document.activeElement), token);
}
__name(resyncImeFocusReport, "resyncImeFocusReport");
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resyncImeFocusReport();
});
window.addEventListener("pageshow", resyncImeFocusReport);
