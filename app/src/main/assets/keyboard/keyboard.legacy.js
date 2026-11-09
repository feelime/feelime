var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
(() => {
  "use strict";
  window.__feelimeES = 1;
  if (typeof Element !== "undefined" && !Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function(...nodes) {
      this.textContent = "";
      for (const n of nodes) this.append(n);
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
  if (!Object.fromEntries) {
    Object.fromEntries = function(entries) {
      const out = {};
      for (const [k, v] of entries) out[k] = v;
      return out;
    };
  }
  try {
    const geom = new URLSearchParams(location.search);
    const dpr = window.devicePixelRatio || 1;
    const band = Number(geom.get("band"));
    const sb = Number(geom.get("sb"));
    if (band > 0) {
      document.documentElement.style.setProperty("--band", band / dpr + "px");
    }
    if (sb > 0) {
      document.documentElement.style.setProperty("--safe-bottom", sb / dpr + "px");
    }
  } catch (_) {
  }
  let uiLocale = "zh";
  try {
    uiLocale = localStorage.getItem("feelime_ui_locale") || (typeof navigator === "undefined" || /^zh/i.test(navigator.language) ? "zh" : "en");
  } catch (_) {
  }
  let dpScheme = "ziranma";
  const UI_EN = {
    "\u8F93\u5165\u7EDF\u8BA1": "Typing stats",
    "\u7D2F\u8BA1\u8F93\u5165": "Total typed",
    "\u5B57": "chars",
    "\u4ECA\u65E5": "Today",
    "\u8FDE\u7EED": "streak",
    "\u5929": "days",
    "\u67E5\u770B": "View",
    "\u7D2F\u8BA1\u51FB\u952E": "Keystrokes",
    "\u952E / \u5B57": "keys / char",
    "\u65E5\u5747\u5B57\u6570": "Daily avg",
    "\u65E5": "Su",
    "\u4E00": "Mo",
    "\u4E8C": "Tu",
    "\u4E09": "We",
    "\u56DB": "Th",
    "\u4E94": "Fr",
    "\u516D": "Sa",
    "\u2248": "\u2248",
    "\u7BC7\u9AD8\u8003\u4F5C\u6587": "exam essays",
    "\u6761\u5FAE\u535A": "weibo posts",
    "\u518D\u6765": "",
    "\u5B57\u5C31\u662F\u4E00\u6761\u5FAE\u535A": " more chars make a weibo post",
    "\u4E0E Feelime \u76F8\u4F34": "with Feelime for",
    "\u82F1\u6587 Direct": "English",
    "\u5168\u62FC Pinyin": "Pinyin",
    "\u53CC\u62FC": "Double Pinyin",
    "\u7B14\u753B Stroke": "Stroke",
    "\u91CD\u8F93": "Restart",
    "\u8BE5\u952E\u76D8\u8FD8\u5728\u51C6\u5907\u4E2D": "That keyboard is still preparing",
    "\u62FC\u97F3\u7EC4\u5408\u4E2D\uFF0C\u5148\u4E0A\u5C4F\u518D\u5207\u6362": "Finish the composition before switching",
    "\u60AC\u6D6E\u952E\u76D8": "Floating keyboard",
    "\u6062\u590D\u505C\u9760": "Dock keyboard",
    "\u62D6\u52A8\u79FB\u52A8": "Drag to move",
    "\u62D6\u52A8\u7F29\u653E": "Drag to resize",
    "\u60AC\u6D6E\u952E\u76D8\u8BF7\u7528\u53F3\u4E0B\u89D2\u628A\u624B\u8C03\u6574\u5927\u5C0F": "Use the corner handle to resize the floating keyboard",
    "\u786C\u4EF6\u952E\u76D8\u5F62\u6001\u4E0B\u4E0D\u652F\u6301\u60AC\u6D6E\u952E\u76D8": "Floating keyboard is unavailable in hardware-keyboard mode",
    "\u5C4F\u5E55\u7A7A\u95F4\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u60AC\u6D6E": "Not enough screen space for floating keyboard",
    "\u5DF2\u622A\u65AD\u81F3 200 \u5B57": "Truncated to 200 characters",
    "\u901A\u914D\u7B26\u53EA\u80FD\u7528\u4E00\u4E2A": "Only one wildcard at a time",
    "\u65E5\u672C\u8A9E Romaji": "Japanese",
    "\u5E38\u7528": "Common",
    "\u5B9A\u5236": "Custom",
    "\u6700\u8FD1": "Recent",
    "\u5F15\u53F7": "Quotes",
    "\u8D27\u5E01": "Currency",
    "\u6570\u5B66": "Math",
    "\u7279\u6B8A": "Special",
    "\u5236\u8868": "Box",
    "\u5E8F\u53F7": "Numbers",
    "\u62FC\u97F3": "Pinyin",
    "\u5E73\u5047\u540D": "Hiragana",
    "\u7247\u5047\u540D": "Katakana",
    "\u5E0C\u814A": "Greek",
    "\u5206\u8BCD": "Split",
    "\u5207\u6362\u952E\u76D8": "Switch keyboard",
    "\u786E\u5B9A": "Confirm",
    "\u6362\u884C": "Enter",
    "\u7A7A\u683C": "Space",
    "\u7B26\u53F7": "Sym",
    "\u8FD4\u56DE\u4E3B\u952E\u76D8": "Back to keyboard",
    "\u8868\u60C5": "Symbols",
    "\u7B11\u8138": "Smileys",
    "\u624B\u52BF": "Gestures",
    "\u52A8\u7269": "Animals",
    // #67 颜文字面板（分类名；颜文字本体不译）
    "\u989C\u6587\u5B57": "Kaomoji",
    "\u5F00\u5FC3": "Happy",
    "\u5356\u840C": "Cute",
    "\u96BE\u8FC7": "Sad",
    "\u751F\u6C14": "Angry",
    "\u60CA\u8BB6": "Surprised",
    "\u65E0\u5948": "Whatever",
    "\u7231\u5FC3": "Love",
    "\u52A0\u6CB9": "Cheer",
    "\u52A8\u4F5C": "Actions",
    "\u98DF\u7269": "Food",
    "\u6D3B\u52A8": "Activity",
    "\u7269\u54C1": "Objects",
    "\u51FA\u73B0\u7A7A\u7684 [] \u8BB0\u53F7": "Empty [] key token",
    "\u300C{0}\u300D\u65E0\u6CD5\u89E3\u6790": "Cannot parse \u201C{0}\u201D",
    "\u300C{0}\u300D\u7F3A\u5C11\u952E\u540D": "\u201C{0}\u201D is missing a key name",
    "\u300C{0}\u300D\u7684\u952E\u540D\u4E0D\u53EF\u7528": "Unsupported key in \u201C{0}\u201D",
    "\u6309\u952E\u6B65\u9AA4\u8D85\u8FC7 {0} \u4E2A": "More than {0} key steps",
    "JSON \u89E3\u6790\u5931\u8D25\uFF1A": "Invalid JSON: ",
    '\u9876\u5C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF08{"version":1,"rows":[...]}\uFF09': 'Use a JSON object: {"version":1,"rows":[...]}',
    "version \u5FC5\u987B\u662F 1": "version must be 1",
    "rows \u5FC5\u987B\u662F\u6570\u7EC4": "rows must be an array",
    "\u6700\u591A {0} \u884C\uFF08\u6536\u5230 {1} \u884C\uFF09": "Up to {0} rows allowed; received {1}",
    "\u7B2C {0} \u884C\u5FC5\u987B\u662F\u6570\u7EC4": "Row {0} must be an array",
    "\u7B2C {0} \u884C\u7B2C {1} \u4E2A\u952E": "Row {0}, key {1}",
    "{0} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08{t, tap, note}\uFF09": "{0} must be an object: {t, tap, note}",
    "{0} \u7F3A\u5C11 t\uFF08\u952E\u9762\uFF09": "{0} is missing t (key label)",
    "\u300C{0}\u300D\u7684 t \u8D85\u8FC7 {1} \u5B57": "The label for \u201C{0}\u201D exceeds {1} characters",
    "\u300C{0}\u300D\u7684 note \u8D85\u8FC7 {1} \u5B57": "The note for \u201C{0}\u201D exceeds {1} characters",
    "{0}\uFF08\u300C{1}\u300D\uFF09\u7F3A\u5C11 tap\uFF08\u5355\u51FB\u884C\u4E3A\uFF09": "{0} (\u201C{1}\u201D) is missing tap (key action)",
    "\u300C{0}\u300D\u7684 tap \u8D85\u8FC7 {1} \u5B57\u7B26": "The action for \u201C{0}\u201D exceeds {1} characters",
    "\u300C{0}\u300D\u7684 tap {1}": "Action for \u201C{0}\u201D: {1}",
    "\u952E\u603B\u6570\u8D85\u8FC7 {0}": "More than {0} keys",
    "\u81F3\u5C11\u8981\u5B9A\u4E49\u4E00\u4E2A\u952E": "Add at least one key",
    "\u6309\u952E\u65E0\u6548\uFF1A{0}": "Invalid key: {0}",
    "\u6A2A\u5C4F\u5DF2\u8FBE\u5C4F\u5E55\u4E0A\u9650": "Maximum landscape height",
    "\u62D6\u52A8\u4E3A\u9884\u89C8\uFF0C\u677E\u624B\u5E94\u7528": "Drag to preview; release to apply",
    "\u952E\u76D8\u9AD8\u5EA6\u5DF2\u4FDD\u5B58": "Keyboard height saved",
    "\u952E\u76D8\u9AD8\u5EA6\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5": "Failed to save keyboard height, try again",
    "\u952E\u76D8\u9AD8\u5EA6\u4FDD\u5B58\u672A\u786E\u8BA4\uFF0C\u8BF7\u91CD\u8BD5": "Height save not confirmed, try again",
    "\u6062\u590D\u9ED8\u8BA4": "Reset",
    "\u5DF2\u6062\u590D\u9ED8\u8BA4\u9AD8\u5EA6": "Default height restored",
    "\u8F93\u5165\u6CD5\u5FEB\u6377\u5207\u6362": "Quick switch",
    "\u957F\u6309\u83DC\u5355": "Keyboard menu",
    "\u5B9A\u5236\u6309\u952E": "Custom keys",
    "\u8FD4\u56DE\u8BBE\u7F6E\u9996\u9875": "Back to quick settings",
    "\u6536\u8D77\u8BBE\u7F6E": "Close quick settings",
    "\u8272\u5F69\u6A21\u5F0F": "Appearance",
    "\u8DDF\u968F\u7CFB\u7EDF": "System",
    "\u6D45\u8272": "Light",
    "\u6DF1\u8272": "Dark",
    "\u6ED1\u52A8\u8DDF\u624B": "Cursor speed",
    "\u5149\u6807\u79FB\u52A8\u901F\u5EA6": "Cursor speed",
    "\u5FEB\u6377\u5207\u6362": "Quick switch",
    "\u7F16\u8F91\u5DE5\u5177\u680F": "Edit toolbar",
    "\u6B63\u5728\u51C6\u5907\u8BED\u8A00\u6570\u636E\u2026": "Preparing language data\u2026",
    "\u300C{0}\u300D\u5F15\u64CE\u542F\u52A8\u5931\u8D25\uFF0C\u6682\u65F6\u82F1\u6587\u76F4\u51FA\uFF1B\u70B9\u6A21\u5F0F\u952E\u91CD\u8BD5": "{0} failed to start; English Direct is serving. Tap the mode key to retry",
    "\u300C{0}\u300D\u6682\u4EE5\u82F1\u6587\u76F4\u51FA\uFF0C\u70B9\u6A21\u5F0F\u952E\u91CD\u8BD5": "{0} is temporarily serving as English Direct; tap the mode key to retry",
    "{0} \u4E2A\u952E\u76D8": "{0} keyboards",
    "\u952E\u76D8\u9AD8\u5EA6": "Keyboard height",
    "\u8C03\u8282 \u203A": "Adjust \u203A",
    // 快捷设置方块（tile 网格）新增文案。
    "\u4E2D\u6587\u8054\u60F3": "Associations",
    "\u6309\u952E\u58F0\u97F3": "Key sound",
    "\u6309\u952E\u632F\u52A8": "Key vibration",
    "\u5355\u624B\u6A21\u5F0F": "One-handed",
    "\u6570\u5B57\u952E\u76D8": "Number pad",
    "Emoji": "Emoji",
    "\u5DE6\u624B": "Left hand",
    "\u53F3\u624B": "Right hand",
    "\u5168\u9009": "Select all",
    "\u7C98\u8D34": "Paste",
    "\u590D\u5236": "Copy",
    "\u526A\u5207": "Cut",
    // #39-10 编辑工具条。选择 = 点亮后方向键带 SHIFT 连续扩选
    // （搜狗「开始选择」的 Android 等价物）。
    "\u7F16\u8F91\u5DE5\u5177": "Editing",
    "\u9009\u62E9": "Select",
    "\u5149\u6807\u5230\u884C\u9996": "Line start",
    "\u5149\u6807\u5230\u884C\u5C3E": "Line end",
    // #36 双拼 14 键布局。
    "\u53CC\u62FC14\u952E": "Dp 14-key",
    "14\u952E": "14",
    "26\u952E": "26",
    "\u5149\u6807\u5DE6\u79FB": "Move cursor left",
    "\u5149\u6807\u53F3\u79FB": "Move cursor right",
    "\u5149\u6807\u4E0A\u79FB": "Move cursor up",
    "\u5149\u6807\u4E0B\u79FB": "Move cursor down",
    "\u5019\u9009\u5B57\u53F7": "Candidate size",
    "\u754C\u9762\u8BED\u8A00": "Language",
    "\u5E95\u90E8\u7559\u767D": "Bottom padding",
    "\u957F\u6309\u65F6\u957F": "Long-press delay",
    "\u6ED1\u52A8\u9009\u5B57": "Swipe reach",
    "\u53CC\u62FC\u65B9\u6848": "Double-pinyin",
    "\u8C03\u8282": "Adjust",
    "\u5F00": "On",
    "\u5173": "Off",
    "\u6807\u51C6": "Standard",
    "\u5927": "Large",
    "\u66F4\u5927": "Larger",
    "\u677E": "Loose",
    "\u7D27": "Tight",
    "\u4E2D\u6587": "Chinese",
    "\u81EA\u7136\u7801": "Ziranma",
    "\u5C0F\u9E64\u53CC\u62FC": "Flypy",
    "\u641C\u72D7 / \u5FAE\u8F6F\u53CC\u62FC": "Sogou / MSPY",
    "\u7D2B\u5149\u53CC\u62FC": "Ziguang",
    "\u677E\u624B\u64A4\u9500": "Release to cancel",
    "\u7C98\u8D34 JSON \u5B9A\u4E49\u7B26\u53F7\u952E\u76D8\uFF08\u6700\u591A 3 \u884C\uFF0C\u6BCF\u884C\u952E\u6570\u4E0D\u9650\uFF09\uFF1At=\u952E\u9762\uFF0C": "Paste JSON to define up to 3 key rows: t=label, ",
    "tap=\u5355\u51FB\u884C\u4E3A\uFF08\u6587\u672C / [esc] \u5355\u952E / [ctrl+s] \u7EC4\u5408\uFF0C\u53EF\u6DF7\u6392\uFF0C\u5982 [esc]ggVGD\uFF09\uFF0C": "tap=action (text, [esc], or [ctrl+s]; combine them, e.g. [esc]ggVGD), ",
    "span=\u5BBD\u952E\u500D\u6570\uFF081-3\uFF0C\u53EF\u9009\uFF09\uFF0Ccolor=\u952E\u9762\u989C\u8272\uFF08blue/green/orange/red/purple\uFF0C\u53EF\u9009\uFF09\uFF0C[backspace]=\u9000\u683C\uFF0C": "span=key width 1-3 (optional), color=key color blue/green/orange/red/purple (optional), [backspace]=backspace, ",
    "note=\u957F\u6309\u8BF4\u660E\u3002\u8D85\u5BBD\u7684\u884C\u53EF\u4EE5\u5DE6\u53F3\u62D6\u52A8\u67E5\u770B\u3002": "note=long-press description. Swipe wide rows to see more keys.",
    "\u5F53\u524D\u72B6\u6001": "Status",
    "\u5DF2\u5B9A\u5236 {0} \u4E2A\u952E": "{0} custom keys",
    "\u672A\u5B9A\u5236": "No custom keys",
    "\u7C98\u8D34 JSON \u203A": "Paste JSON \u203A",
    "\u7C98\u8D34 JSON \u5B9A\u5236\u6309\u952E": "Paste custom-key JSON",
    "\u63D2\u5165\u6A21\u677F \u203A": "Use example \u203A",
    "\u63D2\u5165\u5B9A\u5236\u6A21\u677F": "Use custom keyboard example",
    "\u67E5\u770B\u8BF4\u660E \u203A": "View guide \u203A",
    "\u67E5\u770B\u5B9A\u5236\u6309\u952E\u8BF4\u660E": "View the custom-key guide",
    "\u7C98\u8D34\u5B9A\u5236 JSON": "Paste custom keyboard JSON",
    "\u4FDD\u5B58\u5931\u8D25\uFF1A\u672C\u5730\u5B58\u50A8\u4E0D\u53EF\u7528": "Could not save. Local storage is unavailable.",
    "\u5DF2\u4FDD\u5B58 {0} \u4E2A\u952E": "Saved {0} keys",
    "\u52FE\u9009\u4E24\u9879\u4F5C\u4E3A\u5207\u6362\u952E\u7684\u5FEB\u6377\u5207\u6362\u5BF9\uFF08\u70B9\u5DF2\u52FE\u9009\u9879\u65E0\u6548\u679C\uFF0C\u70B9\u672A\u52FE\u9009\u9879\u4F1A\u66FF\u6362\u6700\u65E9\u52FE\u9009\u7684\u4E00\u9879\uFF09": "Choose two keyboards for quick switching. A new selection replaces the oldest one.",
    "\u5FEB\u6377\u5207\u6362 {0}": "Quick switch: {0}",
    "\u52FE\u9009\u957F\u6309\u5207\u6362\u952E\u65F6\u5217\u51FA\u7684\u952E\u76D8 \xB7 \u62D6\u52A8\u6392\u5E8F\uFF08\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\uFF09": "Choose keyboards shown on long press. Drag to reorder; keep at least one.",
    "\u957F\u6309\u83DC\u5355\u663E\u793A {0}": "Show {0} in keyboard menu",
    "\u62D6\u52A8\u6392\u5E8F": "Drag to reorder",
    "\u6682\u65E0\u5355\u5B57": "No single-character candidates",
    "\u6682\u65E0\u5019\u9009": "No candidates",
    "\u526A\u8D34\u677F\u5DF2\u5F00\u542F\uFF0C\u590D\u5236\u7684\u5185\u5BB9\u5C06\u5728\u8FD9\u91CC\u663E\u793A": "Copied text will appear here.",
    "\u6682\u65E0\u5E38\u7528\u8BED\uFF0C\u70B9\u53F3\u4E0A\u89D2\u300C\uFF0B\u6DFB\u52A0\u300D": "No saved phrases. Tap Add to create one.",
    "\u2026\uFF08\u5185\u5BB9\u8FC7\u957F\uFF09": "\u2026 (text truncated)",
    "\u7EC4\u5408\u8FC7\u957F\uFF0C\u5DF2\u6E05\u7A7A": "Composition too long; cleared",
    "\u5220\u9664": "Delete",
    "\u66F4\u591A\u64CD\u4F5C": "More actions",
    "\u7F16\u8F91\u5E38\u7528\u8BED": "Edit phrase",
    "\u6DFB\u52A0\u5E38\u7528\u8BED": "Add phrase",
    "\u7F6E\u9876": "Pin to top",
    "\u7F16\u8F91": "Edit",
    "\u5220\u9664\u81EA\u9020\u8BCD": "Delete learned word",
    "\u8BE5\u5019\u9009\u9700\u5347\u7EA7 APK \u540E\u5220\u9664": "Update the app to delete this word.",
    "\u4ECE\u81EA\u9009\u8BCD\u8BCD\u5E93\u5220\u9664\u300C{0}\u300D\uFF1F\uFF08\u56FA\u5B9A\u8BCD\u5E93\u7684\u8BCD\u5220\u4E0D\u6389\uFF09": "Delete \u201C{0}\u201D from learned words? Built-in words cannot be deleted.",
    "\u300C{0}\u300D\u6765\u81EA\u56FA\u5B9A\u8BCD\u5E93\uFF0C\u65E0\u6CD5\u5220\u9664": "\u201C{0}\u201D is a built-in word and cannot be deleted.",
    "\u5DF2\u4ECE\u81EA\u9009\u8BCD\u8BCD\u5E93\u5220\u9664\u300C{0}\u300D": "Deleted \u201C{0}\u201D from learned words.",
    "\u6B63\u5728\u8046\u542C\u2026": "Listening\u2026",
    "\u7ED3\u675F\u8BC6\u522B\u2026": "Finishing\u2026",
    "\u53D6\u6D88": "Cancel",
    "\u4FDD\u5B58": "Save",
    "\u5173\u95ED": "Close",
    "\u8F93\u5165\u5E38\u7528\u5185\u5BB9\uFF08\u6700\u591A 200 \u5B57\uFF09": "Enter a phrase (up to 200 characters)",
    "\u5E38\u7528\u8BED\u5185\u5BB9": "Phrase",
    "\u5B9A\u5236\u6309\u952E JSON": "Custom-key JSON",
    "\u8F93\u5165\u5E38\u7528\u5185\u5BB9": "Enter a phrase",
    "\u8F93\u5165\u7801": "Shortcut",
    "\u7559\u7A7A\u65F6\u81EA\u52A8\u751F\u6210": "Leave blank to generate",
    "\u4F8B\u5982\uFF1Anh": "e.g. hello",
    "\u4F4D\u6B21": "Rank",
    "\u4F4D\u6B21\u51CF\u4E00": "Rank down",
    "\u4F4D\u6B21\u52A0\u4E00": "Rank up",
    "\u51CF\u5C11\u9AD8\u5EA6": "Decrease height",
    "\u589E\u52A0\u9AD8\u5EA6": "Increase height",
    "\u5FEB\u6377\u8BBE\u7F6E": "Quick settings",
    "\u5B8C\u6574\u8BBE\u7F6E": "All settings",
    "\u63A7\u5236\u952E": "Control keys",
    "\u5207\u6362\u8F93\u5165\u6CD5": "Switch input method",
    "\u526A\u8D34\u677F": "Clipboard",
    "\u5E38\u7528\u8BED": "Phrases",
    "\u8BED\u97F3\u8F93\u5165": "Voice input",
    "\u6536\u8D77\u952E\u76D8": "Hide keyboard",
    "\u53D6\u6D88\u7EC4\u5408": "Clear composition",
    "\u5C55\u5F00\u5019\u9009": "Expand candidates",
    "\u6536\u8D77\u5019\u9009": "Collapse candidates",
    "\u8BCD\u9891": "Frequency",
    "\u5355\u5B57": "Single",
    "\u5019\u9009\u533A": "Candidates",
    "\u6536\u8D77\u63A7\u5236\u952E": "Hide control keys",
    "\u5173\u95ED\u9762\u677F": "Close panel",
    "\u6E05\u7A7A\u526A\u8D34\u677F": "Clear clipboard",
    "\u6E05\u7A7A": "Clear",
    "\u786E\u8BA4\u6E05\u7A7A": "Confirm clear",
    "\uFF0B\u6DFB\u52A0": "\uFF0B Add",
    "\u677E\u624B\u7ED3\u675F": "Release to finish.",
    "\u70B9\u51FB\u4EFB\u610F\u4F4D\u7F6E\u7ED3\u675F": "Tap anywhere to finish.",
    "\u53D6\u6D88\u8BED\u97F3\u8F93\u5165": "Cancel voice input",
    "\u64A4\u9500\u672C\u6B21\u542C\u5199": "Discard this dictation",
    "\u64A4\u9500": "Discard",
    "\u5DF2\u64A4\u9500\u672C\u6B21\u542C\u5199": "Dictation discarded",
    "\u8BF4\u5B8C\u4E86\uFF0C\u7ED3\u675F\u5E76\u4E0A\u5C4F": "Done \u2014 finish and insert",
    "\u8BF4\u5B8C\u4E86": "Done",
    "\u6B63\u5728\u52A0\u8F7D\u8BED\u97F3\u5F15\u64CE\u2026": "Loading voice engine\u2026",
    "\u5C31\u7EEA\u540E\u81EA\u52A8\u5F00\u59CB\u8046\u542C\uFF0C\u70B9\u51FB\u53EF\u53D6\u6D88": "Listening starts automatically \u2014 tap to cancel",
    "\u677E\u624B\u4E0A\u5C4F": "Release to insert",
    "\u4E0A\u6ED1\u64A4\u9500": "Slide up to discard",
    "\u5F53\u524D\u7248\u672C\u4E0D\u652F\u6301\u53D6\u6D88\u8BED\u97F3\u8F93\u5165\uFF0C\u8BF7\u66F4\u65B0 APK": "Update the app to enable voice cancellation.",
    "\u5173\u95ED\u7EC4\u5408\u952E\u6D6E\u5C42": "Close shortcut menu",
    "Meta \u952E": "Meta key",
    "\u8F93\u5165": "Input",
    "\u8FD4\u56DE": "Back",
    "\u5220\u9664\u7EC4\u5408": "Clear composition",
    "\u4E0A\u5C4F\u539F\u6587": "Commit typed text",
    "\u5C55\u5F00\u5019\u9009\u8BCD": "Expand candidates",
    "\u6536\u8D77\u5019\u9009\u8BCD": "Collapse candidates",
    "\u6253\u5F00\u5B8C\u6574\u8BBE\u7F6E": "Open all settings",
    "Fn \u7C98\u6EDE\u952E": "Sticky Fn",
    "\u5F00\u59CB\u8BED\u97F3\u8F93\u5165": "Start voice input",
    "\u6E05\u9664\u8F93\u5165": "Clear composition",
    "\u952E\u76D8\u8BBE\u7F6E": "Quick settings",
    // 手写键面（issue #28）。空书写区提示三行（round-5）。
    "\u5728\u6B64\u624B\u5199": "Write here",
    "\u5982\u672A\u8BC6\u522B\uFF0C\u8BF7\u51CF\u5C11\u8FDE\u7B14": "If not recognized, try less cursive",
    "\u5DF2\u6E05\u7A7A\u7B14\u8FF9": "Ink cleared",
    "\u624B\u5199\u6A21\u578B\u672A\u5C31\u7EEA": "Handwriting model not ready",
    "\u624B\u5199\u8BC6\u522B\u5931\u8D25": "Handwriting recognition failed",
    "\u624B\u5199": "Handwriting"
  };
  function t(source, ...values) {
    const pattern = uiLocale === "en" ? UI_EN[source] || source : source;
    return pattern.replace(/\{(\d+)\}/g, (match, index) => values[index] === void 0 ? match : String(values[index]));
  }
  __name(t, "t");
  function translateStaticUi() {
    document.documentElement.lang = uiLocale === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    ["aria-label", "placeholder"].forEach((attribute) => {
      document.querySelectorAll("[data-i18n-" + attribute + "]").forEach((node) => {
        node.setAttribute(attribute, t(node.getAttribute("data-i18n-" + attribute)));
      });
    });
  }
  __name(translateStaticUi, "translateStaticUi");
  const KEYBOARD_VERSION = "3.73.99";
  const EXCLUSIVE_VIEWS = {
    settings: { el: "settingsPanel", openClass: "open", close: "closeSettingsPanel", returnField: "settingsReturnLayer" },
    stats: { el: "statsLayer", openClass: null, close: "closeStatsPanel", returnField: "statsReturnLayer" },
    edit: { el: "editLayer", openClass: null, close: "closeEditPanel", returnField: "editReturnLayer" },
    panel: { el: "panelLayer", openClass: null, close: "closePanel", returnField: "panelReturnLayer" },
    modeMenu: { el: "modeMenu", openClass: "open", close: "closeModeMenu" }
  };
  const MERGEABLE_14 = /* @__PURE__ */ new Set(["pinyin", "double-pinyin", "direct"]);
  const PANEL_STEPS = /* @__PURE__ */ new Set(["clipboard", "favorites", "kaomoji", "edit", "control", "emoji", "custom"]);
  function isSymbolicText(text) {
    if (!text) return false;
    return [...String(text)].every((ch) => !new RegExp("\\p{L}", "u").test(ch) && !new RegExp("\\p{N}", "u").test(ch));
  }
  __name(isSymbolicText, "isSymbolicText");
  const SYMBOL_USE_KEY = "symUse.v1";
  const SYMBOL_PROMOTE_AT = 5;
  function readSymbolUseCounts() {
    try {
      const raw = localStorage.getItem(SYMBOL_USE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const clean = {};
      Object.keys(parsed).forEach((key) => {
        const value = parsed[key];
        if (Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) {
          clean[key] = value;
        }
      });
      return clean;
    } catch (_) {
      return {};
    }
  }
  __name(readSymbolUseCounts, "readSymbolUseCounts");
  function writeSymbolUseCounts(counts) {
    try {
      localStorage.setItem(SYMBOL_USE_KEY, JSON.stringify(counts));
    } catch (_) {
    }
  }
  __name(writeSymbolUseCounts, "writeSymbolUseCounts");
  const DYNAMIC_INPUT_CODES = {
    date: { kind: "date", head: true },
    time: { kind: "time", head: true },
    week: { kind: "week", head: true },
    riqi: { kind: "date", head: false },
    shijian: { kind: "time", head: false },
    xingqi: { kind: "week", head: false },
    xingq: { kind: "week", head: false }
  };
  const dynamicWeekNames = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
  function dynamicCandidatesFor(raw, mode) {
    if (mode !== "pinyin" && mode !== "double-pinyin") return [];
    let spec = DYNAMIC_INPUT_CODES[raw];
    if (!spec) return [];
    if (!spec.head && mode !== "pinyin") return [];
    const now = /* @__PURE__ */ new Date();
    const pad = /* @__PURE__ */ __name((value) => String(value).padStart(2, "0"), "pad");
    let texts;
    if (spec.kind === "date") {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      texts = [
        iso,
        `${y}/${pad(m)}/${pad(d)}`,
        `${y}\u5E74${m}\u6708${d}\u65E5`,
        `${y}\u5E74${m}\u6708${d}\u65E5 \u661F\u671F${dynamicWeekNames[now.getDay()]}`,
        `${y}${pad(m)}${pad(d)}`
      ];
    } else if (spec.kind === "time") {
      const hh = now.getHours();
      texts = [
        `${pad(hh)}:${pad(now.getMinutes())}`,
        `${pad(hh)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        `${hh < 12 ? "\u4E0A\u5348" : "\u4E0B\u5348"}${hh % 12 || 12}:${pad(now.getMinutes())}`
      ];
    } else {
      const name = dynamicWeekNames[now.getDay()];
      texts = [`\u661F\u671F${name}`, `\u5468${name}`, now.getDay() === 0 ? "\u661F\u671F\u5929" : `\u793C\u62DC${name}`];
    }
    return texts.map((text, index) => ({
      id: `dyn:${spec.kind}-${index}`,
      text,
      dynamic: true,
      head: spec.head
    }));
  }
  __name(dynamicCandidatesFor, "dynamicCandidatesFor");
  const KAOMOJI_TABS = [
    { id: "happy", name: "\u5F00\u5FC3", items: [
      "(\uFF61\uFF65\u03C9\uFF65\uFF61)\uFF89\u2661",
      "(\u0E51\u2022\u0300\u3142\u2022\u0301)\u0648\u2727",
      "(\u2267\u25BD\u2266)",
      "\u30FE(\u2267\u2207\u2266*)\u309D",
      "(\uFF3E\u25BD\uFF3E)",
      "(^\u25BD^)/",
      "(\u2267\u2200\u2266)",
      "(^o^)\uFF0F",
      "(\u2606\u25BD\u2606)",
      "(\u2727\u2200\u2727)",
      "(\u273F\u25E1\u203F\u25E1)",
      "\uFF61\uFF9F+..\uFF61\uFF9F+",
      "(^\u25BD^)/~",
      "( \u02D8 \xB3\u02D8)\u2665",
      "(*\u2267\u25BD\u2266)",
      "(\u2229\u02C3o\u02C2\u2229)\u2661",
      "(*^\u25BD^*)",
      "(\u2261^\u2207^\u2261)",
      "o((>\u03C9< ))o",
      "(\u273F\u25BD\u273F)"
    ] },
    { id: "cute", name: "\u5356\u840C", items: [
      "(\u0E51\xB4\u3142`\u0E51)",
      "(\uFF61>\uFE4F<\uFF61)",
      "(\u0E51\u2022\u0301 \u2083 \u2022\u0300\u0E51)",
      "(\u0E05\xB4\u03C9`\u0E05)",
      "(\u25CD\u2022\u1D17\u2022\u25CD)\u2661",
      "(\u3063\u02D8\u03C9\u02D8\u03C2)",
      "(\u0E51\u02D9\u30FC\u02D9\u0E51)",
      "(\uFF61\u2022\u0300\u1D17-)\u2727",
      "(\xB4,,\u2022\u03C9\u2022,,)\u2661",
      "(\u706C\xBA\u03C9\xBA\u706C)",
      "\u2661(\u0150\u03C9\u0150\u4EBA)",
      "(=^\uFF65\u03C9\uFF65^=)",
      "\u3064\u2661",
      "(\u0E51\uFF1E\u25E1\uFF1C\u0E51)",
      "(\u2606\u03C9\u2606)",
      "(\u2283\u2022\u0300\u03C9\u2022\u0301)\u2283",
      "(=\u2460\u03C9\u2460=)",
      "(\u0E51\u1D54\u2314\u1D54\u0E51)",
      "(\xB4,,\u2022\u03C9\u2022,,)",
      "(\u15D2\u15E8\u15D5)"
    ] },
    { id: "sad", name: "\u96BE\u8FC7", items: [
      "(\u2565\uFE4F\u2565)",
      "(\uFF1B\u2032\u2312`)",
      "\u30FD(\xB4\u25A1`\u3002)\uFF89",
      "(T_T)",
      "(\uFF61\u2022\u0301\uFE3F\u2022\u0300\uFF61)",
      "(\u4E2A_\u4E2A)",
      "(\xB4;\u03C9;`)",
      "(\u3063- \u2038 - \u03C2)",
      "(\uFE4F\u02D8\uFE4F\u02D8)",
      "\u3002\u30FB\uFF9F\u30FB(\uFF1E\u0434\uFF1C)\u30FB\uFF9F\u30FB\u3002",
      "(\u2533_\u2533\u2026)",
      "(;\u0434;)",
      "(T\u0434T)",
      "(;\u2032\uFE3F`)",
      "(\u260D\uFE4F\u2070)",
      "\uFF65\uFF9F\uFF65(\u2044\u2044\u2022\u2044\u03C9\u2044\u2022\u2044\u2044)\uFF65\uFF9F\uFF65",
      "(TT)",
      "\u3002\u309C(\u309C\xB4\u03C9`\u309C)\u309C\u3002",
      "(\u4E2A\u02CA\u0348\u15DC\u02CB\u0348\u4E2A)",
      "(;\uFE4F;)"
    ] },
    { id: "angry", name: "\u751F\u6C14", items: [
      "(\u256C \uFF9F\u0434\uFF9F)",
      "(\uFF40\u0394\xB4)\uFF01",
      "(\u256F\xB0\u25A1\xB0\uFF09\u256F\uFE35 \u253B\u2501\u253B",
      "(\uFF89\uFF40\u22BF\xB4)\uFF89 \u253B\u2501\u253B",
      "(\u25BC\u3078\u25BC\u30E1)",
      "(\uFF0D\u2038\u10DA)",
      "\u30FD(\uFF4F`\u76BF\u2032\uFF4F)\uFF89",
      "(\u256C\uFFE3\u76BF\uFFE3)\uFF1D\u25CB",
      "\u250C\u2229\u2510(\u25E3_\u25E2)\u250C\u2229\u2510",
      "(\u266F\u25BC\u76BF\u25BC)",
      "(\uB208_\uB208)",
      "(\uFF40\u3078\xB4)",
      "(\uFF03`\u0434\xB4)\u30CE",
      "\u0669(\u256C\u0298\u76CA\u0298\u256C)\u06F6",
      "(\xAC_\xAC",
      "\u51F8(\u2299\u2582\u2299\u2716 )",
      "(>_<)",
      "(\u0482 `\u0437\xB4 )",
      "(\uFF40\u043C\xB4)",
      "( \u309C\u0434\u309C)"
    ] },
    { id: "surprise", name: "\u60CA\u8BB6", items: [
      "(\u2299_\u2299)",
      "\u03A3(\uFF9F\u0414\uFF9F)",
      "w(\uFF9F\u0414\uFF9F)w",
      "\u03A3(\xB0\u25B3\xB0|||)",
      "(\uFF03\xB0\u0414\xB0)",
      "(\u25CE_\u25CE;)",
      "(\u30FBo\u30FB)",
      "( \uFF9F\u0434\uFF9F)",
      "\u03A3(\u309C\u0414\u309C)",
      "(O_O;)",
      "(\u2299\uFE4F\u2299)",
      "\u03A3(\u0E51\xB0\u0434\xB0\u30CE)\u30CE",
      "(\u3186_\u3186)",
      "w(\uFF65\u0434\uFF65)w",
      "(\u30FB\u25A1\u30FB\uFF1B)",
      "(\u2299\u2299)",
      "( \uFF9F\u0434\uFF9F)!",
      "( \uFF9F\u2200\uFF9F)",
      "\u03A3(\uFF9F\u2200\uFF9F)",
      "(\xB0\u30ED\xB0) !",
      "(\u30FB_\u30FB;"
    ] },
    { id: "meh", name: "\u65E0\u5948", items: [
      "\u256E(\u256F\u25BD\u2570)\u256D",
      "\u256E(\u256F_\u2570)\u256D",
      "(\xB4-\u03C9-`)",
      "(\uFFE3^\uFFE3)",
      "(\xAC_\xAC)",
      "(\u30FC\u30FC;)",
      "(\xB4\u2200`)",
      "(\uFF65\uFF65;)\uFF8A\uFF6F",
      "\u2510(\xB4\u0434`)\u250C",
      "\u2510(\xB4\uFF5E`)\u250C",
      "(\uFFE3_\uFFE3|||)",
      '(=_=)"',
      "\xA63\u2593\u2593",
      "(\uFFE3o\uFFE3) . z Z",
      "(\xB4-\uFE4F-`)",
      "(\u30FC_\u30FC)!!",
      "\u2510(\uFF65_\uFF65)\u250C",
      "(\uFF1B\u4E00_\u4E00)",
      "(\uFFE3\u30D8\uFFE3)",
      "(\uFF1D\u3002\uFF1D)"
    ] },
    { id: "love", name: "\u7231\u5FC3", items: [
      "\u2661",
      "(\u25CF'\u25E1'\u25CF)\uFF89\u2665",
      "\u266A(\xB4\u25BD\uFF40)",
      "\u2764(\u0964 \u141B \u3002)\u2764",
      "(\u25CD\u2022\u1D17\u2022\u25CD)\u2727",
      "\u2661\u2727( \u0941\u2022\u1D17\u2022\u0942 )",
      "(\u3063\xB4\u03C9`c)\u2661",
      "(\u02D8\uFE36\u02D8)\u2661",
      "\u2765(\u309D\u25E1\u30FB)",
      "(\u0E51\u2661\u2313\u2661\u0E51)",
      "\u2665(\u02C6\u2323\u02C6\u0505)",
      "\u266A(^\u2207^*)",
      "(\u2283\uFF61\u2022\u0301\u203F\u2022\u0300\uFF61)\u2283\u2661",
      "(\u2661\xB0\u25BD\xB0\u2661)",
      "(\u3065\uFFE3 \xB3\uFFE3)\u3065",
      "(\u3063\xB4\u2200`)\u3063",
      "(\u3063\u2022\u0300\u03C9\u2022\u0301)\u3063\u2661",
      "\u2764(\u3002\u2022\u0301\u1D17\u2022\u0300\u3002)\u2661",
      "\u2727*\u3002\u0669(\u02CA\u03C9\u02CB*)\u0648\u2727*\u3002",
      "\u2282(\xB4\u30FB\u03C9\u30FB\uFF40\u2282)"
    ] },
    { id: "cheer", name: "\u52A0\u6CB9", items: [
      "(\u0E07 \u2022\u0300_\u2022\u0301)\u0E07",
      "(\u0E51\u2022\u0300\u3142\u2022\u0301)\u0648\u2727",
      "(\u3063\u2022\u0300\u03C9\u2022\u0301)\u3063\u2727\u207E\u207E",
      "\u2727(\u2256 \u25E1 \u2256\u273F)",
      "(\u0E07'\u0300-'\u0301)\u0E07",
      "\u1566\u1564",
      "(\u2022\u0300\u1D17\u2022\u0301)\u0648 \u0311\u0311",
      "\u30FE(\u25CD\xB0\u2207\xB0\u25CD)\uFF89\uFF9E",
      "(\u0E07 \u2022\u0305_\u2022\u0305)\u0E07",
      "\u0E07(\u0300-\u0300\u0E07)",
      "(\u0E51\u2022\u0300\u3142\u2022\u0301)\u2727",
      "\u0669(\u0E51\u2022\u0300\u03C9\u2022\u0301\u0E51)\u06F6",
      "\u1566(\xF2_\xF3\u02C7)\u1564",
      "(\u0E07 \u2022_\u2022)\u0E07",
      "\u1559(\u2022\u0300\u2038\u2022\u0301\u2036)\u1557",
      "\u30FE(\uFF3E\u2207\uFF3E)",
      "o(>\u03C9<)o",
      "\u1555( \u141B )\u1557",
      "d(^^*)",
      "(\u2022\u0300\u1D17\u2022\u0301)\u0648"
    ] },
    { id: "action", name: "\u52A8\u4F5C", items: [
      "orz",
      "OTL",
      "Orz",
      "_(:\u0437\u300D\u2220)_",
      "(=_=)",
      "(zzz)",
      "(\u02D8\u03C9\u02D8)",
      "m(_ _)m",
      "(T\u03B5T)",
      "\u03A3(\u3063\xB0\u0414\xB0;)\u3063",
      "(\xA63[\u2593\u2593]",
      "_(\u2510\u300C\u03B5:)_",
      "\u30FE(\xB4\uFE36`\u2661)\uFF89",
      "\u0449(\u0298\u257B\u0298)\u0449",
      "( \u02D8\u2022\u03C9\u2022\u02D8 )",
      "( \u02D8 \xB3\u02D8)o\xB0",
      "\u2282(\u30FB\uFE4F\u30FB\u2282)",
      "(/\u03C9\uFF3C)",
      "\u2282(\xB4\u30FB\u03C9\u30FB\uFF40\u2282)",
      "(\u2192_\u2192)",
      "(\u2190_\u2190)"
    ] },
    { id: "animal", name: "\u52A8\u7269", items: [
      "(=^\uFF65\u03C9\uFF65^=)",
      "(\u0E05^\u03C9^\u0E05)",
      "\u30FE(=\uFF65\u03C9\uFF65=)o",
      "(\u204E\u02C3\u11BA\u02C2\u204E)",
      "(^\u30FB\u03C9\u30FB^ )",
      "\u0E05(\uFF3E\u30FB\u03C9\u30FB\uFF3E\u0E05)",
      "\u222A\u30FB\u03C9\u30FB\u222A",
      "\u222A\xBA\u03C9\xBA\u222A",
      "\u0295\u2022\u1D25\u2022\u0294",
      "\u0295\u0298\u203F\u0298\u0294",
      "(=\xB4\u30A7`=)",
      "\u222A\uFF65\u03C9\uFF65\u222A",
      "(=\u2460\u03C9\u2460=)",
      "(=\u272A \u03C9 \u272A=)",
      "\u0295 \u1D54\u1D25\u1D54 \u0294",
      "(=\u2460\u03C9\u2460=)",
      "(=\uFF58\u03C9x=)",
      "(=\u2312\u203F\u203F\u2312=)",
      "\u02C1\u02DA\u1D17\u02DA\u02C0",
      "(=\u0444\u03C9\u0444=)"
    ] }
  ];
  const TOOL_CATALOG = {
    ctrl: "ctrlTool",
    ime: "imeSwitchButton",
    clipboard: "clipboardButton",
    favorites: "favoritesButton",
    mic: "mic",
    // 开关型/动作型工具：默认不上栏，只待在编辑仓库里由用户添加（动态创建）。
    // setup 是静态元素（index.html 里的 fullSetupButton），其余动态创建。
    setup: "fullSetupButton",
    theme: "toolTheme",
    vibrate: "toolVibrate",
    sound: "toolSound",
    assoc: "toolAssoc",
    onehand: "toolOneHand",
    // #55 悬浮键盘：动作型工具（默认不上栏，编辑仓库自选）。
    floating: "toolFloating",
    numpad: "toolNumpad",
    emoji: "toolEmoji",
    // #39-10 编辑工具条：替换键区的编辑面板（方向键/扩选/全选/
    // 复制剪切粘贴），动作全部复用现有桥通道。
    edit: "editTool",
    // #39-12 定制按键：工具栏直达的独立面板。忘了登进这份目录的话
    // buildToggleTools 照样建按钮，但 setupToolbarEditor 的接线循环
    // 遍历的是本目录——池里那颗点不动也拖不了（真机实录）。
    custom: "toolCustom",
    // #67 颜文字面板：默认不上栏，用户从工具编辑仓库自选。
    kaomoji: "toolKaomoji"
  };
  const HW_TEXT_MODES = /* @__PURE__ */ new Set(["pinyin", "double-pinyin", "flypy", "french", "russian", "japanese"]);
  const TOOLBAR_DEFAULT = { left: ["ctrl", "ime"], right: ["clipboard", "favorites", "mic"] };
  const MIN_NATIVE_API = 1;
  const REQUIRED_CAPABILITIES = [
    "candidate-revision-v1",
    "clipboard-v1",
    "commit-text-v1",
    "compose-control-v1",
    "unicode-compose-v1",
    "cursor-repeat-v1",
    "cursor-delta-v1",
    "panel-compose-v1",
    "favorites-v2",
    "ime-control-v1",
    "key-event-v1",
    "keyboard-height-reset-v1",
    "keyboard-update-status-v1",
    "text-input-v1",
    "voice-session-v1",
    "voice-cancel-v1"
  ];
  const MAX_COMMIT_CODE_POINTS = 2e3;
  const SCRUB_UNIT_BASE_PX = 36;
  const BS_UNDO_KEYCODE = 29 + "Z".charCodeAt(0) - 65;
  const MODES = {
    "direct": { label: "En", title: "\u82F1\u6587 Direct", layout: "qwerty", engine: false },
    "pinyin": { label: "\u62FC", title: "\u5168\u62FC Pinyin", layout: "qwerty", engine: true },
    // 键位是自然码（ei→Z / ie→X / iao→C / ou→B 是自然码特征）；旧文件名
    // ziranma_double_pinyin 是历史误名，显示一律用「双拼」。
    "double-pinyin": { label: "\u53CC", title: "\u53CC\u62FC", layout: "qwerty", engine: true },
    // 九宫格：键面是数字（schema 侧把音节表 xlit 成数字串），候选出词。
    "t9": { label: "\u4E5D", title: "\u4E5D\u5BAB\u683C T9", layout: "t9", engine: true },
    // 笔画（issue #18）：T9 网格骨架，键面是笔画部件（点按发 h/s/p/n/z
    // 进引擎，preedit 由 schema xlit 成部件字形回显）。strictReady：旧
    // APK 的 hello 不带 stroke 就绪字段，缺失必须当不可用——沿用
    // !== false 的宽松判定会把缺键当可用，出现可点却无效的入口。
    "stroke": { label: "\u7B14", title: "\u7B14\u753B Stroke", layout: "t9", engine: true, strictReady: true },
    // 音形（issue #20，首版小鹤音形）：qwerty 键面（码即字母），
    // 码表用户导入、设备端编译独立 flypy table/prism。strictReady：
    // 未导入（hello 缺字段或产物未落地）时菜单不出入口。
    "flypy": { label: "\u5F62", title: "\u97F3\u5F62 Shape", layout: "qwerty", engine: true, strictReady: true },
    // 手写（issue #28，design/handwriting.md §1）：独立识别引擎
    // （recognizeInk 笔迹 → onInkCandidates 候选），不接按键引擎
    // （engine:false——退格/空格/回车由原生 Direct 承载）。
    // strictReady：模型未落地（旧 APK 的 hello 缺字段 / thin 未下载）
    // 时菜单不出入口，宽松判定会出现可点却无效的模式。
    "handwriting": { label: "\u624B", title: "\u624B\u5199 Handwriting", layout: "handwriting", engine: false, strictReady: true },
    "french": { label: "FR", title: "Fran\xE7ais", layout: "qwerty-fr", engine: true },
    "russian": { label: "\u0420\u0423", title: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", layout: "cyrillic", engine: true },
    "japanese": { label: "\u65E5", title: "\u65E5\u672C\u8A9E Romaji", layout: "qwerty", engine: true }
  };
  const LAYOUTS = {
    // 九宫格 T9：键面数字为主、字母组为角标（alts）；分隔键（分词）
    // 保留——数字切分歧义（9426 = xian / xi'an）靠它手动消歧。
    t9: {
      // 字母组角标只做键面提示，不参与上滑/弹窗上屏（见 altCandidates）。
      hintsOnly: true,
      rows: [
        "123",
        "456",
        { keys: "789", shift: true, backspace: true }
      ],
      alts: {
        "2": "abc",
        "3": "def",
        "4": "ghi",
        "5": "jkl",
        "6": "mno",
        "7": "pqrs",
        "8": "tuv",
        "9": "wxyz"
      },
      // 长按三行浮层的中列符号（issue #9）：每键两个，分列数字
      // 左右；键面左上角小字展示同一组，长按能出什么不用猜。
      keySymbols: {
        "2": ["\u2014", "&"],
        "3": ["\uFF08", "\uFF09"],
        "4": ["\u300C", "\u300D"],
        "5": ["\u3001", "\uFF1A"],
        "6": ["\uFF1B", "\uFF5E"],
        "7": ["\u300A", "\u300B"],
        "8": ["\u2026", "\xB7"],
        "9": ["%", "/"]
      }
    },
    qwerty: {
      rows: [
        "qwertyuiop",
        { keys: "asdfghjkl", indent: true },
        { keys: "zxcvbnm", shift: true, backspace: true }
      ],
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
        // J/k carried fullwidth “ ” on the ENGLISH
        // keyboard - the half-width ~ " ' are what English expects
        // (French keeps its own accented set in qwerty-fr).
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
    // 14 键贴合布局（拼音/双拼/英文的 kbLayout pref）：26 字母
    // 两两合并到 14 个宽键帽，'|' 分组（L、M 单键）。合并对内两颗
    // 半区仍是标准 kb-key（data-key=单字母），长按弹层/分词/引擎
    // 全链路零改动——减少误触的来源是键帽变宽、行内缝隙减半。键帽
    // 显示两字母并排居中（韵母小字不显示，方案键位图在设置页有）。
    dp14: {
      rows: [
        "qw|er|ty|ui|op",
        { keys: "as|df|gh|jk|l", indent: true },
        { keys: "zx|cv|bn|m", shift: true, backspace: true }
      ]
    },
    // French uses standard QWERTY (no AZERTY); accent candidates
    // follow the design section 6.2 fixture exactly.
    // French long-press set: a gains ä and o gains ö -
    // the collection was incomplete, not just the candidate flow.
    "qwerty-fr": {
      rows: [
        "qwertyuiop",
        { keys: "asdfghjkl", indent: true },
        { keys: "zxcvbnm", shift: true, backspace: true }
      ],
      alts: {
        q: "1",
        w: "2",
        e: ["3", "\xE9", "\xE8", "\xEA", "\xEB"],
        r: "4",
        t: "5",
        y: ["6", "\xFF"],
        u: ["7", "\xF9", "\xFB", "\xFC"],
        i: ["8", "\xEE", "\xEF"],
        o: ["9", "\xF4", "\xF6", "\u0153"],
        p: "0",
        a: ["-", "\xE0", "\xE2", "\xE4", "\xE6"],
        s: "/",
        d: ":",
        f: ";",
        g: "(",
        h: ")",
        j: ["~", "\xAB"],
        k: ["'", "\xBB"],
        l: ['"', "\u2019"],
        z: "@",
        x: "_",
        c: ["#", "\xE7"],
        v: "&",
        b: "?",
        n: "!",
        m: ".",
        ".": ","
      }
    },
    cyrillic: {
      rows: [
        "\u0439\u0446\u0443\u043A\u0435\u043D\u0433\u0448\u0449\u0437\u0445\u044A",
        { keys: "\u0444\u044B\u0432\u0430\u043F\u0440\u043E\u043B\u0434\u0436\u044D", indent: true },
        { keys: "\u044F\u0447\u0441\u043C\u0438\u0442\u044C\u0431\u044E", shift: true, backspace: true }
      ],
      // 角标按 qwerty-EN 的音位习惯铺满全部 32 键（#59 验收
      // 反馈：旧方案数字散落、符号缺失、部分键无角标）。行一
      // 数字 1-0 连续占前 10 键、尾部 -/=（PC ЙЦУКЕН 习惯）；
      // ё 不占唯一角标位——挂 е 的长按弹层（角标/上滑仍是 5，
      // 与法语重音同机制）。行二符号对齐 qwerty 音位 + 俄文
      // 引号 «»；行三 qwerty 符号 + 句读。
      alts: {
        \u0439: "1",
        \u0446: "2",
        \u0443: "3",
        \u043A: "4",
        \u0435: ["5", "\u0451"],
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
        \u044E: "."
      }
    }
  };
  const ICON_PATHS = {
    stats: "M5 13h3v6H5zM10.5 8h3v11h-3zM16 4h3v15h-3z",
    custom: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h3v4h4v3h-7z",
    shift: "M12 5l7 7h-4v6H9v-6H5z",
    caps: "M12 3l7 7h-4v6H9v-6H5zM7 19h10v2H7z",
    backspace: "M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.59 12.59L16 17l-2.5-2.5L11 17l-1.41-1.41L12.09 13 9.59 10.5 11 9.1l2.5 2.5L16 9.1l1.41 1.41L14.91 13z",
    mic: "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z M19 12a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2z",
    arrowLeft: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    smiley: "M15.5 11c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5zM11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",
    // 快捷设置方块图标（wechat 式 tile 网格）。同一构建器，键面不用。
    // 色彩模式三态三图形（fill 同色 currentColor，不换色）：
    // auto=半填充圆（自动切换）、light=太阳、dark=月牙。
    theme: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 2v14a7 7 0 010-14z",
    themeSun: "M12 8.2a3.8 3.8 0 110 7.6 3.8 3.8 0 010-7.6zM12 1.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM12 19.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM3 10.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM21 10.5a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM5.6 4.1a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM18.4 4.1a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM5.6 16.9a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0zM18.4 16.9a1.5 1.5 0 1 1 0 3.0a1.5 1.5 0 1 1 0 -3.0z",
    themeMoon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
    assoc: "M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2H10l-5 4V6a2 2 0 012-2zm2 4h10v2H7V8zm0 4h6v2H7v-2z",
    sound: "M3 9v6h4l5 4V5L7 9H3zm11.5 3a3.5 3.5 0 00-2-3.16v6.32a3.5 3.5 0 002-3.16zM12.5 3.8v2.1a6.2 6.2 0 010 12.2v2.1a8.3 8.3 0 000-16.4z",
    vibrate: "M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v16h6V4H9zM3 8h2v8H3V8zm16 0h2v8h-2V8z",
    height: "M12 2l4.5 5.5h-9L12 2zm0 20l-4.5-5.5h9L12 22zM6 11h12v2H6v-2z",
    swap: "M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
    font: "M10 4h4l5 16h-2.6l-1.2-4H8.8l-1.2 4H5L10 4zm-.4 9.5h4.8L12 6.8 9.6 13.5z",
    lang: "M12 2a10 10 0 100 20 10 10 0 000-20zm7.9 9h-3.4a15 15 0 00-1.2-5.7A8 8 0 0119.9 11zM12 4c.9 1.2 1.9 3.4 2.2 7H9.8c.3-3.6 1.3-5.8 2.2-7zM8.7 5.3A15 15 0 007.5 11H4.1a8 8 0 014.6-5.7zM4.1 13h3.4a15 15 0 001.2 5.7A8 8 0 014.1 13zM12 20c-.9-1.2-1.9-3.4-2.2-7h4.4c-.3 3.6-1.3 5.8-2.2 7zm3.3-1.3a15 15 0 001.2-5.7h3.4a8 8 0 01-4.6 5.7z",
    pad: "M3 5h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v8h16V7H4zM2 19h20v2H2v-2z",
    onehand: "M4 4h10a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v12h8V6H5zm12 3h4v2h-4V9zm0 4h4v2h-4v-2z",
    // #55 悬浮三件（codex 设计稿）：入口=四角活动范围+与边界分离的
    // 小键盘（与 onehand 的左右分区拉开）；缩放=东北-西南双箭头
    // （把手在右上、向外拉=放大）；停靠=上沿开口的窗口+向下箭头
    // +底条（「下放回底部」，替换歧义的 ⌂）。
    floating: "M2 3h5v2H4v3H2zM17 3h5v5h-2V5h-3zM2 16h2v3h3v2H2zM20 16h2v5h-5v-2h3zM6 7h12v10H6zM8 9v6h8V9zM9 10h2v2H9zM13 10h2v2h-2zM9 13h6v1H9z",
    resize: "M14 3h7v7h-2V6.4l-4.8 4.8-1.4-1.4L17.6 5H14zM3 14h2v3.6l4.8-4.8 1.4 1.4L6.4 19H10v2H3z",
    dock: "M3 3h4v2H5v14h14V5h-2V3h4v18H3zM11 3h2v8h3l-4 4-4-4h3zM7 17h10v2H7z",
    timer: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 110 14 7 7 0 010-14zm-1 2h2v5.4l4 2.4-1 1.6-5-3V7z",
    snap: "M12 8a2 2 0 110 4 2 2 0 010-4zM2 11h5v2H2v-2zm15 0h5v2h-5v-2zM11 3h2v5h-2V3zm0 13h2v5h-2v-5z",
    menu: "M5 4h3v3H5V4zm5.5 0h3v3h-3V4zM16 4h3v3h-3V4zM5 10.5h3v3H5v-3zm5.5 0h3v3h-3v-3zm5.5 0h3v3h-3v-3zM5 17h3v3H5v-3zm5.5 0h3v3h-3v-3zm5.5 0h3v3h-3v-3z",
    keyboard: "M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zm1 2v8h16V8H4zm2 1.5h2v2H6v-2zm3.5 0h2v2h-2v-2zm3.5 0h2v2h-2v-2zM6 13h8v1.5H6V13zm9.5 0H17v1.5h-1.5V13z",
    dp: "M8 3.5L3 12l5 8.5 5-8.5-5-8.5zm8 0l-5 8.5 5 8.5 5-8.5-5-8.5z",
    // #39-10 编辑工具条：衬线 I（编辑语义）+ 左右小箭头（选区/光标
    // 可向两侧移动；2026-09-30 用户参照图定稿）。
    edit: "M9 4h6v2H9V4zM11 6h2v12h-2V6zM9 18h6v2H9v-2zM6 10L2.5 12 6 14zM18 10L21.5 12 18 14z",
    gear: "M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z"
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ICON_TEXTS = { numpad: "123", kaomoji: "^_^" };
  const ICONS = {};
  for (const name of [...Object.keys(ICON_PATHS), ...Object.keys(ICON_TEXTS)]) {
    const pathData = ICON_PATHS[name];
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    if (ICON_TEXTS[name]) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", "12");
      text.setAttribute("y", "17");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "13");
      text.setAttribute("font-weight", "700");
      text.textContent = ICON_TEXTS[name];
      svg.append(text);
    } else {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", pathData);
      svg.append(path);
    }
    ICONS[name] = svg;
  }
  const ZH_COMMON_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    // 行首两位是半角 +/-（用户需求：数学/列表高频，中式标点已被
    // 主键盘标点槽与 T9/手写左列覆盖）；、；：？！～（）仍是全角。
    // 前 30 格是历史面（有测试按序冻结），追加行只允许往后放。
    ["+", "-", "\u3001", "\uFF1B", "\uFF1A", "\uFF1F", "\uFF01", "\uFF5E", "\uFF08", "\uFF09"],
    ["\u201C", "\u201D", "\u2018", "\u2019", "\u300A", "\u300B", "\u3008", "\u3009", "\u2026", "\xB7"],
    // 2026-10-28 用户定案：常用页扩到 60（6 行，可上滑）——
    // 破折号/人民币/温度/章节号、全角技术符、括号补系。
    ["\u2014", "\uFFE5", "\u2103", "\u2109", "\xA7", "\u2116", "\uFF20", "\uFF03", "\uFF0A", "\uFF06"],
    ["\uFF05", "\uFF0B", "\uFF1D", "\uFF3C", "\uFF0F", "\uFF5C", "\uFF3B", "\uFF3D", "\uFF5B", "\uFF5D"],
    ["\u3014", "\u3015", "\u3016", "\u3017", "\u3010", "\u3011", "\uFF1C", "\uFF1E", "\u3005", "\u3007"]
  ];
  const EN_COMMON_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    // 2026-11-05 用户定案：& 挪去第 4 行，原位给 |（半角竖线，
    // 引号 En 页那个 | 藏得太深）。
    ["-", "/", ":", ";", "(", ")", "|", "@", "+", "="],
    // # 同挪第 4 行，原位给 \（半角反斜杠，此前整键不可达）。
    [".", ",", "?", "!", '"', "'", "*", "\\", "%", "^"],
    // & # 打头进第 4 行；原 4-6 行字符顺延不删（用户定案：常用
    // 可以不止 6 行），尾行短行由渲染层补空格垫齐。
    ["&", "#", "\xB0", "\xB1", "\xD7", "\xF7", "\xB5", "\xA9", "\xAE", "\u2122"],
    ["\xA7", "\xB6", "\u2020", "\u2021", "\u2022", "\u2030", "\xA4", "\xAA", "\xBA", "\xA8"],
    ["\xA6", "`", "\u2013", "\u2014", "\u2039", "\u203A", "\xAB", "\xBB", "{", "}"],
    ["[", "]"]
  ];
  const ZH_QUOTE_ROWS = [
    ["\u201C", "\u201D", "\u2018", "\u2019", "\u201E", "\u201F", "\xAB", "\xBB", "\u2039", "\u203A"],
    ["\u300C", "\u300D", "\u300E", "\u300F", "\u3010", "\u3011", "\u3016", "\u3017", "\u3014", "\u3015"],
    ["\u300A", "\u300B", "\u3008", "\u3009", "\uFF3B", "\uFF3D", "\uFF5B", "\uFF5D", "\uFF03", "\uFE41"]
  ];
  const EN_QUOTE_ROWS = [
    ["[", "]", "{", "}", "(", ")", "<", ">", "'", '"'],
    ["`", "*", "/", "\\", "|", "~", "^", "&", "@", "#"],
    ["$", "%", "=", "+", "_", "\xAB", "\xBB", "\u2039", "\u203A", "\xA7"]
  ];
  const VARIANT_TABLES = {
    common: { zh: ZH_COMMON_ROWS, en: EN_COMMON_ROWS },
    quote: { zh: ZH_QUOTE_ROWS, en: EN_QUOTE_ROWS }
  };
  const NUM_PAD_SYMBOLS = [
    "@",
    "%",
    "-",
    "+",
    "/",
    "*",
    "(",
    ")",
    "#",
    "$",
    "&",
    "_",
    "=",
    "~",
    "^",
    ":",
    ";"
  ];
  const T9_SIDE_CHARS = [
    "\uFF0C",
    "\u3002",
    "\uFF1F",
    "\uFF01",
    "\uFF1B",
    "\uFF1A",
    "\u3001",
    "\u201C",
    "\u201D",
    "\uFF08",
    "\uFF09",
    "\u300A",
    "\u300B",
    "\u2026",
    "\xB7",
    "\u2014"
  ];
  const T9_BAR_SYMBOLS = ["@", "#", ".", "*", "+", "-", "_", "/", "="];
  const T9_SPLIT = { "7": ["q", "r"], "9": ["x", "y"] };
  const STROKE_KEYS = {
    "1": { main: "\u4E00", code: "h", syms: ["\uFF01", "\uFF1F"] },
    "2": { main: "\u4E28", code: "s", syms: ["\u2014", "&"] },
    "3": { main: "\u4E3F", code: "p", syms: ["\uFF08", "\uFF09"] },
    "4": { main: "\u4E36", code: "n", syms: ["\u300C", "\u300D"] },
    "5": { main: "\u4E59", code: "z", syms: ["\u3001", "\uFF1A"] },
    "6": { main: "\uFF0A", code: "*", syms: ["\uFF1B", "\uFF5E"] },
    "8": { main: "\uFF0C", code: ",", syms: ["\u2026", "\xB7"] },
    "9": { main: "\u5206\u8BCD", code: "'", syms: ["%", "/"] }
  };
  const t9Place = /* @__PURE__ */ __name((grid) => (button, row, column) => {
    button.style.gridRow = String(row);
    button.style.gridColumn = String(column);
    grid.append(button);
  }, "t9Place");
  const T9_XLIT = {
    a: "2",
    b: "2",
    c: "2",
    d: "3",
    e: "3",
    f: "3",
    g: "4",
    h: "4",
    i: "4",
    j: "5",
    k: "5",
    l: "5",
    m: "6",
    n: "6",
    o: "6",
    p: "7",
    q: "7",
    r: "7",
    s: "7",
    t: "8",
    u: "8",
    v: "8",
    w: "9",
    x: "9",
    y: "9",
    z: "9"
  };
  const t9ToDigits = /* @__PURE__ */ __name((text) => [...text].map((ch) => T9_XLIT[ch] || ch).join(""), "t9ToDigits");
  const EMOJI_CATEGORIES = [
    { id: "smiley", label: "\u7B11\u8138", emojis: "\u{1F600} \u{1F603} \u{1F604} \u{1F601} \u{1F606} \u{1F605} \u{1F923} \u{1F602} \u{1F642} \u{1F643} \u{1F609} \u{1F60A} \u{1F607} \u{1F970} \u{1F60D} \u{1F929} \u{1F618} \u{1F617} \u{1F61A} \u{1F619} \u{1F972} \u{1F60B} \u{1F61B} \u{1F61C} \u{1F92A} \u{1F61D} \u{1F911} \u{1F917} \u{1F92D} \u{1F92B} \u{1F914} \u{1FAE1} \u{1F910} \u{1F928} \u{1F610} \u{1F611} \u{1F636} \u{1F60F} \u{1F612} \u{1F644} \u{1F62C} \u{1F62E}\u200D\u{1F4A8} \u{1F925} \u{1F60C} \u{1F614} \u{1F62A} \u{1F924} \u{1F634} \u{1F637} \u{1F912} \u{1F915} \u{1F922} \u{1F92E} \u{1F975} \u{1F976} \u{1F635} \u{1F92F} \u{1F920} \u{1F973} \u{1F978} \u{1F60E} \u{1F913} \u{1F9D0} \u{1F615} \u{1F61F}".split(" ") },
    { id: "hand", label: "\u624B\u52BF", emojis: "\u{1F44B} \u{1F91A} \u{1F590}\uFE0F \u270B \u{1F596} \u{1F44C} \u{1F90C} \u{1F90F} \u270C\uFE0F \u{1F91E} \u{1FAF0} \u{1F91F} \u{1F918} \u{1F919} \u{1F448} \u{1F449} \u{1F446} \u{1F447} \u261D\uFE0F \u{1F44D} \u{1F44E} \u270A \u{1F44A} \u{1F91B} \u{1F91C} \u{1F44F} \u{1F64C} \u{1F450} \u{1F932} \u{1F91D} \u{1F64F} \u270D\uFE0F \u{1F485} \u{1F933} \u{1F4AA} \u{1F9BE} \u{1F9B5} \u{1F9B6} \u{1F442} \u{1F443} \u{1F9E0} \u{1FAC0} \u{1F476} \u{1F9D2} \u{1F466} \u{1F467} \u{1F471} \u{1F468} \u{1F469} \u{1F9D3} \u{1F474} \u{1F475} \u{1F64D} \u{1F64E} \u{1F645} \u{1F646} \u{1F481} \u{1F64B} \u{1F926} \u{1F937} \u{1F647} \u{1F9D8} \u{1F6C0} \u{1F6CC}".split(" ") },
    { id: "animal", label: "\u52A8\u7269", emojis: "\u{1F436} \u{1F431} \u{1F42D} \u{1F439} \u{1F430} \u{1F98A} \u{1F43B} \u{1F43C} \u{1F428} \u{1F42F} \u{1F981} \u{1F42E} \u{1F437} \u{1F438} \u{1F435} \u{1F648} \u{1F649} \u{1F64A} \u{1F414} \u{1F427} \u{1F426} \u{1F424} \u{1F986} \u{1F985} \u{1F989} \u{1F987} \u{1F43A} \u{1F417} \u{1F434} \u{1F984} \u{1F41D} \u{1F41B} \u{1F98B} \u{1F40C} \u{1F41E} \u{1F41C} \u{1FAB0} \u{1F982} \u{1F422} \u{1F40D} \u{1F98E} \u{1F419} \u{1F991} \u{1F990} \u{1F980} \u{1F421} \u{1F420} \u{1F41F} \u{1F42C} \u{1F433} \u{1F40B} \u{1F988} \u{1F40A} \u{1F405} \u{1F406} \u{1F993} \u{1F98D} \u{1F418} \u{1F98F} \u{1F42A} \u{1F992} \u{1F403} \u{1F404} \u{1F40E} \u{1F416}".split(" ") },
    { id: "food", label: "\u98DF\u7269", emojis: "\u{1F34F} \u{1F34E} \u{1F350} \u{1F34A} \u{1F34B} \u{1F34C} \u{1F349} \u{1F347} \u{1F353} \u{1FAD0} \u{1F352} \u{1F351} \u{1F96D} \u{1F34D} \u{1F965} \u{1F95D} \u{1F345} \u{1F951} \u{1F966} \u{1F96C} \u{1F952} \u{1F33D} \u{1F955} \u{1F9C4} \u{1F9C5} \u{1F954} \u{1F360} \u{1F950} \u{1F35E} \u{1F956} \u{1F968} \u{1F9C0} \u{1F95A} \u{1F373} \u{1F95E} \u{1F9C7} \u{1F953} \u{1F354} \u{1F35F} \u{1F355} \u{1F32D} \u{1F96A} \u{1F32E} \u{1F32F} \u{1F957} \u{1F35D} \u{1F35C} \u{1F372} \u{1F363} \u{1F371} \u{1F364} \u{1F359} \u{1F35A} \u{1F358} \u{1F365} \u{1F366} \u{1F369} \u{1F36A} \u{1F382} \u{1F370} \u{1F9C1} \u{1F36B} \u{1F36C} \u{1F36D} \u{1F375}".split(" ") },
    { id: "activity", label: "\u6D3B\u52A8", emojis: "\u26BD \u{1F3C0} \u{1F3C8} \u26BE \u{1F94E} \u{1F3BE} \u{1F3D0} \u{1F3C9} \u{1F94F} \u{1F3B1} \u{1F3F8} \u{1F3D2} \u{1F94D} \u{1F3D1} \u{1F945} \u26F3 \u{1F3F9} \u{1F3A3} \u{1F94A} \u{1F94B} \u{1F3BD} \u{1F6F9} \u{1F6FC} \u{1F3C6} \u{1F947} \u{1F948} \u{1F949} \u{1F3C5} \u{1F396}\uFE0F \u{1F3AF} \u{1F3AA} \u{1F3AD} \u{1F3A8} \u{1F3AC} \u{1F3A4} \u{1F3A7} \u{1F3B8} \u{1F3B9} \u{1F941} \u{1F3BA} \u{1F3B2} \u265F\uFE0F \u{1F9E9} \u{1F3AE} \u{1F579}\uFE0F \u{1F3B3} \u{1F3BF} \u26F8\uFE0F \u{1F94C} \u{1F3CB}\uFE0F \u{1F93C} \u{1F938} \u26F9\uFE0F \u{1F93A} \u{1F93E} \u{1F3CC}\uFE0F \u{1F3C7} \u{1F9D7} \u{1F3C4} \u{1F6B4} \u{1F6B5} \u{1F3D3} \u{1F93D}".split(" ") },
    { id: "object", label: "\u7269\u54C1", emojis: "\u231A \u{1F4F1} \u{1F4BB} \u2328\uFE0F \u{1F5A5}\uFE0F \u{1F5A8}\uFE0F \u{1F5B1}\uFE0F \u{1F4BE} \u{1F4BF} \u{1F4C0} \u{1F4F7} \u{1F4F8} \u{1F4F9} \u{1F3A5} \u{1F4DE} \u260E\uFE0F \u{1F4DF} \u{1F4E0} \u{1F4FA} \u{1F4FB} \u{1F399}\uFE0F \u23F0 \u{1F570}\uFE0F \u231B \u{1F4A1} \u{1F526} \u{1F56F}\uFE0F \u{1F9EF} \u{1F4B8} \u{1F4B5} \u{1F4B0} \u{1F4B3} \u{1F48E} \u2696\uFE0F \u{1F9F0} \u{1F527} \u{1F528} \u2699\uFE0F \u{1F9F2} \u{1F52B} \u{1F4A3} \u{1F52A} \u{1F6E1}\uFE0F \u{1F52E} \u{1F489} \u{1F48A} \u{1FA79} \u{1FA7A} \u{1F6AA} \u{1FA91} \u{1F6CF}\uFE0F \u{1F6BD} \u{1F6BF} \u{1F6C1} \u{1F9F4} \u{1F9F9} \u{1F9FA} \u{1F511} \u{1F5DD}\uFE0F \u{1F4E6} \u{1F4EB} \u{1F4DD} \u270F\uFE0F \u{1F4CC} \u{1F4CE}".split(" ") },
    { id: "symbol", label: "\u8868\u60C5", emojis: "\u2764\uFE0F \u{1F9E1} \u{1F49B} \u{1F49A} \u{1F499} \u{1F49C} \u{1F5A4} \u{1F90D} \u{1F90E} \u{1F494} \u2763\uFE0F \u{1F495} \u{1F49E} \u{1F493} \u{1F497} \u{1F496} \u{1F498} \u{1F49D} \u{1F49F} \u262E\uFE0F \u271D\uFE0F \u262A\uFE0F \u{1F549}\uFE0F \u2638\uFE0F \u2721\uFE0F \u{1F52F} \u{1F54E} \u262F\uFE0F \u2626\uFE0F \u{1F6D0} \u26CE \u2648 \u2649 \u264A \u264B \u264C \u264D \u264E \u264F \u2650 \u2651 \u2652 \u2653 \u{1F194} \u269B\uFE0F \u2705 \u274C \u2753 \u2757 \u{1F4AF} \u{1F51E} \u{1F6AD} \u267B\uFE0F \u269C\uFE0F \u{1F531} \u{1F4DB} \u{1F530} \u2B55 \u{1F251} \u{1F236} \u{1F21A} \u{1F238} \u{1F23A} \u{1F237}\uFE0F \u{1F525}".split(" ") }
  ];
  const SYMBOL_CATEGORIES = [
    { id: "common", label: "\u5E38\u7528", rows: null },
    // filled per keyboard mode
    // #39-12 定稿：定制表回符号面板 tab（工具栏按钮 = 直达此 tab，
    // 与数字/表情的行为模式统一；不做独立面板）。位置沿用旧版第
    // 二位——追加到末尾会被分类条横滚藏到一屏外，用户找不到
    // （真机实录）。
    { id: "custom", label: "\u5B9A\u5236", rows: null },
    // The user's own table, between 常用 and 最近; hidden
    // from the strip until it has content (renderSymbolCats filters).
    { id: "recent", label: "\u6700\u8FD1", rows: null },
    // filled from history, falls back to 常用
    {
      id: "quote",
      label: "\u5F15\u53F7",
      // 中/En paired like 常用 - rows come from VARIANT_TABLES.
      rows: null
    },
    {
      id: "money",
      label: "\u8D27\u5E01",
      rows: [
        ["$", "\u20AC", "\xA3", "\xA5", "\u20A9", "\u20BD", "\u20B9", "\u20AB", "\u0E3F", "\xA2"],
        ["\xA4", "\u20B4", "\u20A6", "\u20B2", "\u20B1", "\uFDFC", "\u20AA", "\u20AD", "\u20AE", "\u20AF"],
        ["\u20BF", "\u20BA", "\u20BC", "\u20BE", "\u0192", "\u09F3", "\u20A1", "\u20B5", "\u20B8", "\u20A0"],
        ["\u20A2", "\u20A3", "\u20A4", "\u20A5", "\u20A7", "\u20A8", "\u20B3", "\uFF05", "\uFF04", "\uFF06"]
      ]
    },
    {
      id: "math",
      label: "\u6570\u5B66",
      rows: [
        // 行首 + -（2026-10-28 用户定案：数学页最常用的两个符号
        // 打头）；尾部去掉 ∘ ≔ 冷门符保持 60 整。
        ["+", "-", "\xB1", "\xD7", "\xF7", "\u2260", "\u2248", "\u2264", "\u2265", "\u221E"],
        ["\u221A", "\xB0", "\u2211", "\u222B", "\u220F", "\u2208", "\u2209", "\u2282", "\u2283", "\u222A"],
        ["\u2229", "\u2205", "\u2032", "\u2033", "\u2030", "\u2295", "\u2297", "\u2299", "\u2235", "\u2234"],
        ["\u22A5", "\u2261", "\u2243", "\u2245", "\u221D", "\u2220", "\u2227", "\u2228", "\xAC", "\u2203"],
        ["\u2200", "\u2286", "\u2287", "\u2296", "\u2298", "\u2216", "\u2202", "\u2207", "\u2135", "\u2212"],
        ["\u220E", "\u2308", "\u2309", "\u230A", "\u230B", "\u2218", "\u2217", "\u22C5", "\u2213", "\u2237"]
      ]
    },
    // 特殊（#64，微信输入法「图形」tab 同类）：星形/勾叉/国际象棋/
    // 扑克/音符的单色文本符号。与 emoji 面板的「表情」分类（彩色
    // emoji）互不冲突：这里走 sendSymbol 文本直上屏，含 VS16 的
    // 彩色形态仍在 emoji 侧。前 3 行是历史面（有守门测试逐字冻结），
    // 新增行只允许追加。
    {
      id: "special",
      label: "\u7279\u6B8A",
      rows: [
        ["\u2605", "\u2606", "\u2726", "\u2727", "\u2729", "\u2713", "\u2714", "\u2717", "\u2718", "\u2611"],
        ["\u2654", "\u2655", "\u2656", "\u2657", "\u2658", "\u2659", "\u265A", "\u265B", "\u265C", "\u265D"],
        ["\u265E", "\u265F", "\u2664", "\u2665", "\u2666", "\u2667", "\u2669", "\u266A", "\u266B"],
        ["\u25A1", "\u25A0", "\u25A2", "\u25A3", "\u25A4", "\u25A5", "\u25A6", "\u25A7", "\u25A8", "\u25A9"],
        ["\u25D0", "\u25D1", "\u25D2", "\u25D3", "\u25D5", "\u25C7", "\u25C6", "\u25C8", "\u25CB", "\u25CE"],
        ["\u25CF", "\u2610", "\u2612", "\u2661", "\u2662", "\u25B2", "\u25BC", "\u25C4", "\u25BA", "\u25AC"],
        ["\u25E2"]
      ]
    },
    // 制表（box-drawing）：单线/双线/混合线/圆角/斜线/半格，
    // 排版表格与代码注释用。全部 U+2500-257F 单 BMP。
    {
      id: "boxdraw",
      label: "\u5236\u8868",
      rows: [
        ["\u2500", "\u2501", "\u2502", "\u2503", "\u2504", "\u2505", "\u2506", "\u2507", "\u2508", "\u2509"],
        ["\u250A", "\u250B", "\u2574", "\u2575", "\u2576", "\u2577", "\u2578", "\u2579", "\u257A", "\u257B"],
        ["\u250C", "\u250D", "\u250E", "\u250F", "\u2510", "\u2511", "\u2512", "\u2513", "\u2514", "\u2515"],
        ["\u2516", "\u2517", "\u2518", "\u2519", "\u251A", "\u251B", "\u251C", "\u251D", "\u251E", "\u251F"],
        ["\u2520", "\u2521", "\u2522", "\u2523", "\u2524", "\u2525", "\u2526", "\u2527", "\u2528", "\u2529"],
        ["\u252A", "\u252B", "\u252C", "\u252D", "\u252E", "\u252F", "\u2530", "\u2531", "\u2532", "\u2533"],
        ["\u2534", "\u2535", "\u2536", "\u2537", "\u2538", "\u2539", "\u253A", "\u253B", "\u253C", "\u253D"],
        ["\u253E", "\u253F", "\u2540", "\u2541", "\u2542", "\u2543", "\u2544", "\u2545", "\u2546", "\u2547"],
        ["\u2548", "\u2549", "\u254B", "\u256D", "\u256E", "\u256F", "\u2570", "\u2571", "\u2572"],
        ["\u2573", "\u257F", "\u2550", "\u2551", "\u2552", "\u2553", "\u2554", "\u2555", "\u2556", "\u2557"],
        ["\u2558", "\u2559", "\u255A", "\u255B", "\u255C", "\u255D", "\u255E", "\u255F", "\u2560", "\u2561"],
        ["\u2562", "\u2563", "\u2564", "\u2565", "\u2566", "\u2567", "\u2568", "\u2569", "\u256A", "\u256B"],
        ["\u256C"]
      ]
    },
    // The 方向 category fires HOST key events, not text - it has no
    // rows of its own and is rendered by the arrows branch of
    // renderSymbols (design §2.4).
    { id: "arrows", label: "\u65B9\u5411", rows: null },
    {
      id: "num",
      label: "\u5E8F\u53F7",
      rows: [
        ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465", "\u2466", "\u2467", "\u2468", "\u2469"],
        ["\u246A", "\u246B", "\u246C", "\u246D", "\u246E", "\u246F", "\u2470", "\u2471", "\u2472", "\u2473"],
        ["\u2488", "\u2489", "\u248A", "\u248B", "\u248C", "\u248D", "\u248E", "\u248F", "\u2490", "\u2491"],
        ["\u2492", "\u2493", "\u2494", "\u2495", "\u2496", "\u2497", "\u2498", "\u2499", "\u249A", "\u249B"],
        ["\u2474", "\u2475", "\u2476", "\u2477", "\u2478", "\u2479", "\u247A", "\u247B", "\u247C", "\u247D"],
        ["\u247E", "\u247F", "\u2480", "\u2481", "\u2482", "\u2483", "\u2484", "\u2485", "\u2486", "\u2487"],
        ["\u2160", "\u2161", "\u2162", "\u2163", "\u2164", "\u2165", "\u2166", "\u2167", "\u2168", "\u2169"],
        ["\u216A", "\u216B", "\u2170", "\u2171", "\u2172", "\u2173", "\u2174", "\u2175", "\u2176", "\u2177"],
        ["\u2178", "\u2179", "\u217A", "\u217B", "\u3220", "\u3221", "\u3222", "\u3223", "\u3224", "\u3225"],
        ["\u3226", "\u3227", "\u3228", "\u3229", "\u3280", "\u3281", "\u3282", "\u3284", "\u3285", "\u3286"],
        ["\u3287", "\u3288", "\u3289", "\u24EA", "\u3251", "\u3252", "\u3253", "\u3254", "\u3255", "\u3256"],
        ["\u3257", "\u3258", "\u3259", "\u325A", "\u325B", "\u325C", "\u325D", "\u325E", "\u325F", "\u32B1"],
        ["\u32B2", "\u32B3", "\u32B4", "\u32B5", "\u32B6", "\u32B7", "\u32B9", "\u32BA", "\u32BB", "\u32BC"],
        ["\u32BD", "\u32BE", "\u32BF"],
        ["\u24EB", "\u24EC", "\u24ED", "\u24EE", "\u24EF", "\u24F0", "\u24F1"]
      ]
    },
    {
      id: "pinyin",
      label: "\u62FC\u97F3",
      rows: [
        ["\u0101", "\xE1", "\u01CE", "\xE0", "\u014D", "\xF3", "\u01D2", "\xF2", "\u0113", "\xE9"],
        ["\u011B", "\xE8", "\u012B", "\xED", "\u01D0", "\xEC", "\u016B", "\xFA", "\u01D4", "\xF9"],
        ["\u01D6", "\u01D8", "\u01DA", "\u01DC", "\xFC", "\xEA", "\u0144", "\u0148", "\u01F9"],
        ["\u0100", "\xC1", "\u01CD", "\xC0", "\u014C", "\xD3", "\u01D1", "\xD2", "\u0112", "\xC9"],
        ["\u011A", "\xC8", "\u012A", "\xCD", "\u01CF", "\xCC", "\u016A", "\xDA", "\u01D3", "\xD9"],
        ["\u01D5", "\u01D7", "\u01D9", "\u01DB", "\xDC", "\xCA", "\u0143", "\u0147", "\u01F8"],
        // 法语/北欧/德语/西语/捷克等拉丁标注。
        ["\xE0", "\xE2", "\xE4", "\xE9", "\xE8", "\xEA", "\xEB", "\xEE", "\xEF", "\xF4"],
        ["\xF9", "\xFB", "\xFC", "\xE7", "\u0153", "\xE6", "\xFF", "\xF8", "\xE5", "\xF1"],
        ["\xE3", "\xF5", "\xEC", "\xF2", "\xFD", "\u010D", "\u0161", "\u017E", "\xBF", "\xA1"],
        ["\u0159", "\u017A"]
      ]
    },
    {
      id: "hira",
      label: "\u5E73\u5047\u540D",
      rows: [
        // 标准五十音图（2026-10-28 用户定案：先清音按图排，再按
        // 图序排促音/小书き、清浊音、半浊音，最后记号）。
        ["\u3042", "\u3044", "\u3046", "\u3048", "\u304A", "\u304B", "\u304D", "\u304F", "\u3051", "\u3053"],
        ["\u3055", "\u3057", "\u3059", "\u305B", "\u305D", "\u305F", "\u3061", "\u3064", "\u3066", "\u3068"],
        ["\u306A", "\u306B", "\u306C", "\u306D", "\u306E", "\u306F", "\u3072", "\u3075", "\u3078", "\u307B"],
        ["\u307E", "\u307F", "\u3080", "\u3081", "\u3082", "\u3084", "\u3086", "\u3088", "\u3089", "\u308A"],
        ["\u308B", "\u308C", "\u308D", "\u308F", "\u3092", "\u3093"],
        // 促音 + 小书き（五十音图序）。
        ["\u3063", "\u3041", "\u3043", "\u3045", "\u3047", "\u3049", "\u3083", "\u3085", "\u3087", "\u308E"],
        // 清浊音（か/さ/た/ば 各行按图序）。
        ["\u304C", "\u304E", "\u3050", "\u3052", "\u3054", "\u3056", "\u3058", "\u305A", "\u305C", "\u305E"],
        ["\u3060", "\u3062", "\u3065", "\u3067", "\u3069", "\u3070", "\u3073", "\u3076", "\u3079", "\u307C"],
        // 半浊音。
        ["\u3071", "\u3074", "\u3077", "\u307A", "\u307D"],
        // 记号：ゐゑ、ー 长音、゛゜（U+309B/C 间隔形，禁组合形）、
        // ゝゞ 繰り返し、中点、〆。
        ["\u3090", "\u3091", "\u30FC", "\u309B", "\u309C", "\u309D", "\u309E", "\u30FB", "\u3006"]
      ]
    },
    {
      id: "kata",
      label: "\u7247\u5047\u540D",
      rows: [
        // 标准五十音图（与平假名同构：清音 → 促音/小书き →
        // 清浊音含ヴ → 半浊音 → 记号）。
        ["\u30A2", "\u30A4", "\u30A6", "\u30A8", "\u30AA", "\u30AB", "\u30AD", "\u30AF", "\u30B1", "\u30B3"],
        ["\u30B5", "\u30B7", "\u30B9", "\u30BB", "\u30BD", "\u30BF", "\u30C1", "\u30C4", "\u30C6", "\u30C8"],
        ["\u30CA", "\u30CB", "\u30CC", "\u30CD", "\u30CE", "\u30CF", "\u30D2", "\u30D5", "\u30D8", "\u30DB"],
        ["\u30DE", "\u30DF", "\u30E0", "\u30E1", "\u30E2", "\u30E4", "\u30E6", "\u30E8", "\u30E9", "\u30EA"],
        ["\u30EB", "\u30EC", "\u30ED", "\u30EF", "\u30F2", "\u30F3"],
        // 促音 + 小书き（五十音图序）。
        ["\u30C3", "\u30A1", "\u30A3", "\u30A5", "\u30A7", "\u30A9", "\u30E3", "\u30E5", "\u30E7", "\u30EE"],
        // 清浊音（カ/サ/タ/バ 各行按图序，ヴ=ウ 段浊音收尾）。
        ["\u30AC", "\u30AE", "\u30B0", "\u30B2", "\u30B4", "\u30B6", "\u30B8", "\u30BA", "\u30BC", "\u30BE"],
        ["\u30C0", "\u30C2", "\u30C5", "\u30C7", "\u30C9", "\u30D0", "\u30D3", "\u30D6", "\u30D9", "\u30DC"],
        ["\u30F4"],
        // 半浊音。
        ["\u30D1", "\u30D4", "\u30D7", "\u30DA", "\u30DD"],
        // 记号：ヰヱ、ー 长音、゛゜（间隔形）、ヽヾ 繰り返し、中点。
        ["\u30F0", "\u30F1", "\u30FC", "\u309B", "\u309C", "\u30FD", "\u30FE", "\u30FB"]
      ]
    },
    {
      id: "greek",
      label: "\u5E0C\u814A",
      rows: [
        ["\u0391", "\u0392", "\u0393", "\u0394", "\u0395", "\u0396", "\u0397", "\u0398", "\u0399", "\u039A"],
        ["\u039B", "\u039C", "\u039D", "\u039E", "\u039F", "\u03A0", "\u03A1", "\u03A3", "\u03A4", "\u03A5"],
        ["\u03A6", "\u03A7", "\u03A8", "\u03A9", "\u03B1", "\u03B2", "\u03B3", "\u03B4", "\u03B5", "\u03B6"],
        ["\u03B7", "\u03B8", "\u03B9", "\u03BA", "\u03BB", "\u03BC", "\u03BD", "\u03BE", "\u03BF", "\u03C0"],
        ["\u03C1", "\u03C3", "\u03C2", "\u03C4", "\u03C5", "\u03C6", "\u03C7", "\u03C8", "\u03C9"],
        ["\u03AC", "\u03AD", "\u03AE", "\u03AF", "\u03CC", "\u03CD", "\u03CE", "\u03CA", "\u03CB", "\u0390"],
        ["\u03B0", "\u0386", "\u0388", "\u0389", "\u038A", "\u038C", "\u038F", "\u03D6", "\u03F1", "\u03F2"],
        ["\u03F4"]
      ]
    }
  ];
  const CN_ALTS = {
    a: "-",
    s: "/",
    d: "\uFF1A",
    f: "\uFF1B",
    g: "\uFF08",
    h: "\uFF09",
    j: "\uFF5E",
    k: "\u201C",
    l: "\u201D",
    z: "@",
    x: ".",
    c: "#",
    v: "\u3001",
    b: "\uFF1F",
    n: "\uFF01",
    m: "\u2026"
  };
  const CTRL_KEY_CODES = {
    Escape: 111,
    Tab: 61,
    Home: 122,
    End: 123,
    PageUp: 92,
    PageDown: 93,
    Del: 112,
    ArrowUp: 19,
    ArrowDown: 20,
    ArrowLeft: 21,
    ArrowRight: 22,
    ".": 56,
    // The custom-key DSL and the Fn layer reach the whole
    // special-key palette - physical Backspace/Enter/Space join too.
    Enter: 66,
    Space: 62,
    Backspace: 67,
    // The old entry was `F4: 131` - 131 is KEYCODE_F1, so
    // Alt+F4 was rejected by the native whitelist and NEVER fired.
    // KEYCODE_F4 is 134; the whole F row is here for the Fn layer.
    F1: 131,
    F2: 132,
    F3: 133,
    F4: 134,
    F5: 135,
    F6: 136,
    F7: 137,
    F8: 138,
    F9: 139,
    F10: 140,
    F11: 141,
    F12: 142,
    // The bare LEFT modifier keys - a second tap on an armed
    // sticky modifier fires these (Win alone opens the Start menu).
    CtrlLeft: 113,
    AltLeft: 57,
    MetaLeft: 117
  };
  const FN_KEYS = {
    q: "F1",
    w: "F2",
    e: "F3",
    r: "F4",
    t: "F5",
    y: "F6",
    u: "F7",
    i: "F8",
    o: "F9",
    p: "F10",
    k: "F11",
    l: "F12"
  };
  const STICKY_ALONE = { Ctrl: "CtrlLeft", Alt: "AltLeft", Meta: "MetaLeft" };
  const CTRL_META_BITS = { Shift: 1, Alt: 2, Ctrl: 4096, Meta: 65536 };
  const COMBO_GRIDS = {
    ctrl: [
      ["Ctrl", "Z"],
      ["Ctrl", "X"],
      ["Ctrl", "C"],
      ["Ctrl", "W"],
      ["Ctrl", "V"],
      ["Ctrl", "A"],
      ["Ctrl", "U"],
      ["Ctrl", "K"],
      ["Ctrl", "E"]
    ],
    alt: [
      ["Alt", "F"],
      ["Alt", "B"],
      ["Alt", "."],
      ["Alt", "D"],
      ["Alt", "T"],
      ["Alt", "H"],
      ["Alt", "C"],
      ["Alt", "L"],
      ["Alt", "N"]
    ],
    comb: [
      ["Ctrl", "Alt", "Del"],
      ["Ctrl", "Shift", "C"],
      ["Ctrl", "Shift", "V"],
      ["Ctrl", "Shift", "Esc"],
      ["Ctrl", "Shift", "T"],
      ["Ctrl", "Shift", "N"],
      ["Ctrl", "Shift", "W"],
      ["Ctrl", "Shift", "Tab"],
      ["Alt", "F4"]
    ],
    // Long-press the Win key - desktop shortcuts that make
    // sense on a phone-as-terminal (show desktop / lock / project).
    meta: [
      ["Meta", "D"],
      ["Meta", "L"],
      ["Meta", "P"]
    ]
  };
  const KB_ROW_MIN = 32;
  const FLOAT_BAR_SPACE = 30;
  const INK_CONTROL_ROW_H = 46;
  const DEFAULT_MENU_MODES = ["direct", "pinyin", "double-pinyin", "t9", "stroke"];
  const THEME_PRESETS = ["classic", "ocean", "violet", "amber", "sakura", "teal"];
  const INK_SIDE_SYMBOLS = ["\uFF0C", "\u3002", "\uFF1F", "\uFF01", "\uFF1A", "\uFF1B", "\u3001", "\uFF5E", "\u2026\u2026", "\xB7", "\uFF03", "\uFF20"];
  const INK_HINT_LINES = ["\u5728\u6B64\u624B\u5199", "\u5982\u672A\u8BC6\u522B\uFF0C\u8BF7\u51CF\u5C11\u8FDE\u7B14"];
  const INK_SMOOTH_STEP = 3;
  function smoothInkStroke(points, step = INK_SMOOTH_STEP) {
    if (!Array.isArray(points) || points.length < 3) return points;
    const kernel = [1, 2, 3, 2, 1];
    const smoothed = points.map((point, index) => {
      let sumX = 0, sumY = 0, sumW = 0;
      for (let offset = -2; offset <= 2; offset++) {
        const j = index + offset;
        if (j < 0 || j >= points.length) continue;
        const weight = kernel[offset + 2];
        sumX += points[j].x * weight;
        sumY += points[j].y * weight;
        sumW += weight;
      }
      return { x: sumX / sumW, y: sumY / sumW };
    });
    smoothed[0] = { x: points[0].x, y: points[0].y };
    smoothed[smoothed.length - 1] = { x: points[points.length - 1].x, y: points[points.length - 1].y };
    const resampled = [smoothed[0]];
    let from = smoothed[0];
    let carry = 0;
    for (let i = 1; i < smoothed.length; i++) {
      let to = smoothed[i];
      let seg = Math.hypot(to.x - from.x, to.y - from.y);
      while (carry + seg >= step) {
        const t2 = (step - carry) / seg;
        from = { x: from.x + (to.x - from.x) * t2, y: from.y + (to.y - from.y) * t2 };
        resampled.push({ x: from.x, y: from.y });
        seg = Math.hypot(to.x - from.x, to.y - from.y);
        carry = 0;
      }
      carry += seg;
      from = to;
    }
    const end = smoothed[smoothed.length - 1];
    const tail = resampled[resampled.length - 1];
    if (Math.hypot(end.x - tail.x, end.y - tail.y) > 0) resampled.push(end);
    return resampled;
  }
  __name(smoothInkStroke, "smoothInkStroke");
  const CUSTOM_KEYS_STORE = "feelime_custom_keys_v2";
  const CUSTOM_LIMITS = {
    rows: 3,
    keys: 100,
    tapChars: 128,
    labelChars: 12,
    noteChars: 60,
    maxKeySteps: 16
    // combo/key steps per tap (the 25/s bridge throttle)
  };
  const STORE_BACKUP_KEYS = [
    "feelime_ui_locale",
    "feelime_scrub_speed",
    "feelime_quick_pair",
    "feelime_menu_modes",
    "feelime_mode_order"
  ];
  function collectStores() {
    const stores = {};
    try {
      for (const key of STORE_BACKUP_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) stores[key] = value;
      }
    } catch (_) {
    }
    return stores;
  }
  __name(collectStores, "collectStores");
  function pushStores(changed) {
    try {
      if (typeof Native.pushStores !== "function") return;
      const payload = changed || collectStores();
      const carry = {};
      for (const key of STORE_BACKUP_KEYS) {
        if (payload[key] !== void 0) carry[key] = payload[key];
      }
      carry.__rev = localStorage.getItem("feelime_stores_rev") || "0";
      const rev = Native.pushStores(JSON.stringify(carry), keyboard.token);
      if (rev === "-1") {
        pullStores(keyboard.token);
        if (!changed) return;
        const replay = collectStores();
        for (const key in changed) {
          try {
            localStorage.setItem(key, changed[key]);
          } catch (_) {
          }
          replay[key] = changed[key];
        }
        keyboard.onStoresRestored(replay);
        pushStores();
        return;
      }
      if (rev) localStorage.setItem("feelime_stores_rev", String(rev));
    } catch (_) {
    }
  }
  __name(pushStores, "pushStores");
  function pullStores(token) {
    try {
      if (typeof Native.getStores !== "function") return;
      const mirror = JSON.parse(Native.getStores(token) || "{}");
      if (!Object.prototype.hasOwnProperty.call(mirror, "values")) return;
      const remoteRev = parseInt(mirror.rev || 0, 10) || 0;
      const localRev = parseInt(localStorage.getItem("feelime_stores_rev") || "0", 10) || 0;
      if (remoteRev === localRev) return;
      const values = mirror.values;
      const valid = values !== null && typeof values === "object" && !Array.isArray(values);
      if (valid) {
        keyboard.onStoresRestored(values);
        localStorage.setItem("feelime_stores_rev", String(remoteRev));
      }
    } catch (_) {
    }
  }
  __name(pullStores, "pullStores");
  const CUSTOM_KEY_TOKENS = {
    esc: "Escape",
    tab: "Tab",
    enter: "Enter",
    space: "Space",
    bs: "Backspace",
    backspace: "Backspace",
    del: "Del",
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    home: "Home",
    end: "End",
    pgup: "PageUp",
    pgdn: "PageDown",
    pageup: "PageUp",
    pagedown: "PageDown",
    f1: "F1",
    f2: "F2",
    f3: "F3",
    f4: "F4",
    f5: "F5",
    f6: "F6",
    f7: "F7",
    f8: "F8",
    f9: "F9",
    f10: "F10",
    f11: "F11",
    f12: "F12"
  };
  const CUSTOM_MOD_TOKENS = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", win: "Meta", meta: "Meta" };
  const EDIT_STEP_TOKENS = {
    undo: 1,
    redo: 1,
    cut: 1,
    copy: 1,
    paste: 1,
    selectAll: 1,
    clear: 1,
    cursorLeft: 1,
    cursorRight: 1,
    lineStart: 1,
    lineEnd: 1
  };
  const CUSTOM_KEY_COLORS = ["blue", "green", "orange", "red", "purple"];
  const CUSTOM_TEMPLATE = JSON.stringify({
    version: 1,
    rows: [
      [
        { t: "Esc", tap: "[esc]", note: "Vim / \u7EC8\u7AEF Esc" },
        { t: ":w", tap: ":w[enter]", note: "Vim \u4FDD\u5B58" },
        { t: "\u6574\u7406", tap: "[esc]ggVGD", note: "Vim \u5168\u6587\u91CD\u65B0\u7F29\u8FDB" },
        { t: "\u4FDD\u5B58", tap: "[ctrl+s]", note: "\u5E38\u89C1\u4FDD\u5B58\u5FEB\u6377\u952E", color: "blue" },
        { t: "\u221A", tap: "\u221A" },
        { t: "\u2192", tap: "\u2192" },
        { t: "F5", tap: "[f5]", note: "\u5237\u65B0" },
        { t: "\u232B", tap: "[backspace]", note: "\u9000\u683C\uFF0C\u957F\u6309\u8FDE\u5220" }
      ],
      [
        { t: "\u90AE\u7BB1", tap: "me@example.com", span: 2 }
      ],
      []
    ]
  }, null, 2);
  const FULL_PINYIN_SYLLABLES = `a ai an ang ao
        ba bai ban bang bao bei ben beng bi bian biang biao bie bin bing bo bu
        ca cai can cang cao ce cei cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo
        da dai dan dang dao de dei den deng di dia dian diao die din ding diu dong dou du duan dui dun duo
        e eh ei en eng er
        fa fan fang fei fen feng fiao fo fong fou fu
        ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
        ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo
        ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun
        ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
        la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lv lvan lve
        ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
        na nai nan nang nao ne nei nen neng ni nia nian niang niao nie nin ning niu nong nou nu nuan nun nuo nv nve
        o ou
        pa pai pan pang pao pei pen peng pi pia pian piao pie pin ping po pou pu
        qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun
        ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo
        sa sai san sang sao se sei sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo
        ta tai tan tang tao te tei teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
        wa wai wan wang wei wen weng wo wong wu
        xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
        ya yai yan yang yao ye yi yin ying yo yong you yu yuan yue yun
        za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo`.trim().split(/\s+/);
  const FULL_PINYIN_SYLLABLES_SET = new Set(FULL_PINYIN_SYLLABLES);
  const T9_SYLLABLE_INDEX = { "full": { "33": ["de"], "43": ["he", "ge"], "744": ["shi"], "53": ["le", "ke"], "924": ["zai", "wai", "yai"], "96": ["wo", "yo"], "93": ["ye", "ze"], "548": ["jiu", "liu"], "94": ["yi", "zi", "xi"], "384": ["dui"], "326": ["dan", "dao", "fan"], "6426": ["nian", "mian", "miao", "niao"], "943": ["zhe", "xie"], "37": ["er"], "786": ["suo", "qun", "run", "ruo", "sun"], "968": ["you", "zou"], "94664": ["zhong", "xiong"], "64": ["ni", "mi"], "636": ["men", "nen"], "934": ["wei", "zei"], "946": ["yin", "xin"], "82": ["ta"], "736": ["ren", "pen", "sen"], "98": ["yu", "xu", "wu", "zu"], "54": ["ji", "li"], "486": ["guo", "huo", "hun", "gun"], "78": ["ru", "qu", "pu", "su"], "468": ["hou", "gou"], "2664": ["cong"], "74264": ["shang", "qiang"], "424": ["hai", "gai"], "3364": ["deng", "feng"], "368": ["dou", "fou"], "634": ["mei", "nei"], "484": ["hui", "gui"], "234": ["bei", "cei"], "524": ["lai", "kai"], "22": ["ba", "ca"], "386": ["duo", "dun"], "436": ["hen", "gen"], "9664": ["yong", "zong", "wong"], "726": ["ran", "san", "pan", "pao", "rao", "sao"], "9426": ["xian", "xiao", "zhan", "zhao"], "926": ["yao", "wan", "yan", "zao", "zan"], "7486": ["shuo", "shun"], "63": ["ne", "me"], "24": ["bi", "ci", "ai"], "944": ["zhi"], "743": ["qie", "she", "pie"], "74": ["qi", "si", "ri", "pi"], "2": ["a"], "6364": ["neng", "meng"], "62": ["na", "ma"], "986": ["zuo", "yun", "xun", "zun"], "482": ["hua", "gua"], "4664": ["gong", "hong"], "28": ["bu", "cu"], "984": ["zui"], "5464": ["jing", "ling"], "9826": ["xuan", "yuan", "zuan"], "8664": ["tong"], "784": ["sui", "rui"], "54264": ["jiang", "liang"], "434": ["gei", "hei"], "546": ["jin", "lin"], "9464": ["xing", "ying"], "983": ["yue", "xue"], "3264": ["dang", "fang"], "7264": ["rang", "pang", "sang"], "526": ["kan", "lao", "kao", "lan"], "5426": ["jian", "jiao", "lian", "liao"], "9264": ["yang", "wang", "zang"], "543": ["jie", "lie"], "84": ["ti"], "936": ["wen", "zen"], "942": ["xia", "zha"], "32": ["da", "fa"], "542": ["jia", "lia"], "2426": ["chan", "biao", "bian", "chao"], "746": ["pin", "qin"], "7436": ["shen"], "9436": ["zhen"], "7664": ["rong", "song"], "94826": ["zhuan"], "7426": ["qian", "shao", "pian", "qiao", "piao", "shan"], "226": ["ban", "bao", "cao", "can"], "2464": ["bing"], "248": ["chu"], "4364": ["geng", "heng"], "426": ["hao", "gan", "gao", "han"], "34": ["di", "ei", "eh"], "58": ["ju", "lv", "lu", "ku"], "748": ["shu", "qiu"], "3664": ["dong", "fong"], "783": ["que"], "4826": ["guan", "huan"], "3426": ["dian", "diao", "fiao"], "68": ["mu", "nu", "nv", "ou"], "236": ["ben", "cen"], "94264": ["xiang", "zhang"], "24264": ["chang", "biang"], "334": ["fei", "dei"], "48": ["hu", "gu"], "74364": ["sheng"], "7468": ["shou"], "336": ["fen", "den"], "884": ["tui"], "583": ["jue", "lve"], "286": ["cun", "cuo"], "586": ["kuo", "lun", "luo", "jun", "kun"], "224": ["cai", "bai"], "24364": ["cheng"], "7464": ["ping", "qing"], "824": ["tai"], "948": ["zhu", "xiu"], "7364": ["peng", "reng", "seng"], "7826": ["quan", "ruan", "suan"], "94364": ["zheng"], "26": ["an", "bo", "ao"], "7484": ["shui"], "8426": ["tian", "tiao"], "534": ["lei", "kei"], "58264": ["kuang"], "624": ["mai", "nai"], "38": ["du", "fu"], "3464": ["ding"], "244": ["chi"], "724": ["pai", "sai"], "66": ["mo"], "243": ["bie", "che"], "868": ["tou"], "948264": ["zhuang"], "52": ["la", "ka"], "8826": ["tuan"], "83": ["te"], "9486": ["zhun", "zhuo"], "6": ["o"], "5664": ["kong", "long"], "324": ["dai"], "24664": ["chong"], "626": ["nan", "man", "nao", "mao"], "9364": ["zeng", "weng"], "2264": ["bang", "cang"], "536": ["ken"], "88": ["tu"], "6464": ["ming", "ning"], "4264": ["hang", "gang"], "3826": ["duan"], "826": ["tao", "tan"], "8464": ["ting"], "242": ["cha"], "2364": ["ceng", "beng"], "92": ["ya", "za", "wa"], "5826": ["kuan", "juan", "luan", "lvan"], "24826": ["chuan"], "48264": ["guang", "huang"], "668": ["mou", "nou"], "7434": ["shei"], "73": ["se", "re"], "23": ["ce"], "72": ["pa", "sa"], "5824": ["kuai"], "9484": ["zhui"], "768": ["sou", "rou", "pou"], "646": ["nin", "min"], "248264": ["chuang"], "9468": ["zhou"], "2486": ["chun", "chuo"], "734": ["pei", "sei"], "8364": ["teng"], "7482": ["shua"], "5264": ["kang", "lang"], "76": ["po"], "748264": ["shuang"], "42": ["ha", "ga"], "742": ["sha", "qia", "pia"], "284": ["cui"], "648": ["niu", "miu"], "568": ["kou", "lou"], "584": ["kui"], "4824": ["huai", "guai"], "3": ["e"], "5364": ["keng", "leng"], "2484": ["chui"], "64264": ["niang"], "9424": ["zhai"], "7424": ["shai"], "36": ["en", "fo"], "364": ["eng"], "6264": ["mang", "nang"], "843": ["tie"], "9482": ["zhua"], "886": ["tuo", "tun"], "6664": ["nong"], "8264": ["tang"], "686": ["nuo", "nun"], "2468": ["chou"], "6826": ["nuan"], "343": ["die"], "2436": ["chen"], "643": ["mie", "nie"], "348": ["diu"], "74664": ["qiong"], "582": ["kua"], "2424": ["chai"], "74824": ["shuai"], "264": ["ang"], "268": ["cou"], "54664": ["jiong"], "246": ["bin"], "683": ["nve"], "94824": ["zhuai"], "24824": ["chuai"], "56": ["lo"], "2826": ["cuan"], "74826": ["shuan"], "834": ["tei"], "342": ["dia"], "5863464": ["junding"], "782": ["rua"], "2482": ["chua"], "642": ["nia"], "9434": ["zhei"] }, "pre": { "2": ["b", "c"], "7": ["p", "q", "r", "s"], "6": ["m", "n"], "3": ["f", "d"], "8": ["t"], "5": ["l", "k", "j"], "4": ["g", "h"], "9": ["x", "z", "y", "w"], "94": ["zh"], "24": ["ch"], "74": ["sh"] }, "w": { "a": 241987, "ai": 27194, "an": 77968, "ang": 2638, "ao": 7456, "ba": 297688, "bai": 18893, "ban": 133998, "bang": 48398, "bao": 98057, "bei": 307050, "ben": 110259, "beng": 9228, "bi": 250303, "bian": 49184, "biao": 50480, "bie": 60802, "bin": 1843, "bing": 132093, "bo": 23765, "bu": 207954, "ca": 3732, "cai": 92394, "can": 26557, "cang": 12182, "cao": 57636, "ce": 32378, "cen": 1308, "ceng": 39396, "cha": 39817, "chai": 4336, "chan": 157472, "chang": 104251, "chao": 47703, "che": 28616, "chen": 5833, "cheng": 91329, "chi": 64535, "chong": 50333, "chou": 7356, "chu": 131290, "chua": 5, "chuai": 1665, "chuan": 36479, "chuang": 28040, "chui": 12365, "chun": 24143, "chuo": 5624, "ci": 121297, "cong": 412357, "cou": 2627, "cu": 8543, "cuan": 1207, "cui": 15712, "cun": 98198, "cuo": 41913, "da": 159662, "dai": 51204, "dan": 562737, "dang": 176606, "dao": 322254, "de": 15378500, "dei": 43371, "den": 28, "deng": 396005, "di": 117349, "dia": 182, "dian": 111245, "diao": 18300, "die": 6602, "ding": 67788, "diu": 5100, "dong": 117002, "dou": 391232, "du": 68624, "duan": 44690, "dui": 584384, "dun": 17448, "duo": 294090, "e": 13374, "ei": 5305, "en": 10134, "eng": 10134, "er": 539248, "fa": 120894, "fan": 33534, "fang": 114225, "fei": 104251, "fen": 101685, "feng": 53675, "fo": 3368, "fou": 67858, "fu": 49524, "ga": 7018, "gai": 88611, "gan": 73137, "gang": 37286, "gao": 65920, "ge": 626691, "gei": 188201, "gen": 147430, "geng": 125721, "gong": 209310, "gou": 117534, "gu": 76665, "gua": 9446, "guai": 7505, "guan": 112060, "guang": 36138, "gui": 28931, "gun": 8644, "guo": 430059, "ha": 17356, "hai": 398723, "han": 19158, "hang": 44921, "hao": 124546, "he": 2111740, "hei": 22743, "hen": 294090, "heng": 17639, "hong": 10295, "hou": 424548, "hu": 103580, "hua": 218677, "huai": 13611, "huan": 76656, "huang": 15592, "hui": 328671, "hun": 13393, "huo": 307899, "ji": 433606, "jia": 159662, "jian": 169881, "jiang": 189390, "jiao": 152337, "jie": 162145, "jin": 185284, "jing": 206450, "jiong": 1943, "jiu": 662839, "ju": 117279, "juan": 11054, "jue": 99038, "jun": 20471, "ka": 19593, "kai": 191457, "kan": 171172, "kang": 21317, "kao": 55435, "ke": 463104, "kei": 36, "ken": 47340, "keng": 12698, "kong": 52183, "kou": 15140, "ku": 16083, "kua": 4558, "kuai": 29689, "kuan": 38037, "kuang": 70367, "kui": 14031, "kun": 12335, "kuo": 98057, "la": 57684, "lai": 306900, "lan": 12239, "lang": 8966, "lao": 130337, "le": 1758340, "lei": 72936, "leng": 4380, "li": 270298, "lia": 5477, "lian": 56359, "liang": 102276, "liao": 50243, "lie": 47768, "lin": 14686, "ling": 100461, "liu": 29772, "lo": 1575, "long": 7256, "lou": 10262, "lu": 31123, "luan": 7513, "lun": 50447, "luo": 39237, "lv": 48585, "lve": 30773, "ma": 191507, "mai": 69102, "man": 34361, "mang": 9938, "mao": 17448, "me": 229812, "mei": 339165, "men": 474118, "meng": 13491, "mi": 31043, "mian": 112834, "miao": 34086, "mie": 5646, "min": 13243, "ming": 45277, "miu": 1216, "mo": 60898, "mou": 35516, "mu": 111169, "na": 229812, "nai": 11506, "nan": 49856, "nang": 1872, "nao": 22788, "ne": 262461, "nei": 145310, "nen": 1238, "neng": 231337, "ni": 492791, "nian": 561011, "niang": 11554, "niao": 4810, "nie": 3229, "nin": 28473, "ning": 4571, "niu": 15631, "nong": 7982, "nou": 28, "nu": 45671, "nuan": 6711, "nuo": 7401, "nv": 26409, "nve": 1820, "o": 52861, "ou": 23075, "pa": 29699, "pai": 62621, "pan": 32877, "pang": 16319, "pao": 22328, "pei": 23626, "pen": 10376, "peng": 83108, "pi": 17210, "pian": 37616, "piao": 30226, "pie": 991, "pin": 157472, "ping": 87412, "po": 21074, "pou": 2431, "pu": 46321, "qi": 244945, "qia": 7017, "qian": 144346, "qiang": 24975, "qiao": 30416, "qie": 249296, "qin": 28585, "qing": 70367, "qiong": 5024, "qiu": 102525, "qu": 334183, "quan": 80604, "que": 113483, "qun": 23042, "ran": 270797, "rang": 171499, "rao": 8137, "re": 13271, "ren": 453337, "reng": 25913, "ri": 100724, "rong": 145310, "rou": 19002, "ru": 430059, "rua": 19, "ruan": 46998, "rui": 4750, "run": 20840, "ruo": 16573, "sa": 8034, "sai": 35543, "san": 43160, "sang": 6200, "sao": 4077, "se": 32382, "sen": 4185, "seng": 1406, "sha": 16822, "shai": 10409, "shan": 12775, "shang": 403722, "shao": 62654, "she": 111999, "shei": 32982, "shen": 155349, "sheng": 103356, "shi": 1799850, "shou": 102144, "shu": 117279, "shua": 22625, "shuai": 3151, "shuan": 534, "shuang": 17758, "shui": 75217, "shun": 16678, "shuo": 267892, "si": 209310, "song": 18669, "sou": 29331, "su": 34911, "suan": 40652, "sui": 195193, "sun": 15339, "suo": 531005, "ta": 456616, "tai": 87412, "tan": 16511, "tang": 7489, "tao": 43260, "te": 53417, "tei": 378, "teng": 22816, "ti": 160751, "tian": 74823, "tiao": 33270, "tie": 9776, "ting": 40801, "tong": 202194, "tou": 60086, "tu": 45975, "tuan": 54171, "tui": 100581, "tun": 2514, "tuo": 8e3, "wa": 7545, "wai": 100461, "wan": 91334, "wang": 80539, "wei": 471708, "wen": 160751, "weng": 653, "wo": 889049, "wu": 66653, "xi": 166470, "xia": 159752, "xian": 270732, "xiang": 109045, "xiao": 97239, "xie": 283623, "xin": 76905, "xing": 185284, "xiong": 21890, "xiu": 38729, "xu": 269447, "xuan": 202800, "xue": 162734, "xun": 45112, "ya": 38123, "yan": 84982, "yang": 166264, "yao": 269447, "ye": 693871, "yi": 626691, "yin": 471708, "ying": 99740, "yo": 3101, "yong": 277346, "you": 527912, "yu": 439612, "yuan": 89796, "yue": 182932, "yun": 50031, "za": 33538, "zai": 1436320, "zan": 22833, "zang": 7591, "zao": 42666, "ze": 202800, "zei": 4862, "zen": 76710, "zeng": 49111, "zha": 6845, "zhai": 10916, "zhan": 74704, "zhang": 72090, "zhao": 64811, "zhe": 555006, "zhen": 153469, "zheng": 79081, "zhi": 249628, "zhong": 497871, "zhou": 25394, "zhu": 86942, "zhua": 9052, "zhuai": 1679, "zhuan": 144350, "zhuang": 59764, "zhui": 29497, "zhun": 53344, "zhuo": 8033, "zi": 433606, "zong": 51524, "zou": 35582, "zu": 32618, "zuan": 3600, "zui": 207726, "zun": 9676, "zuo": 220986, "junding": 50 } };
  function modeLabel(mode) {
    if (uiLocale === "en") return { pinyin: "PY", "double-pinyin": "DP", t9: "T9", japanese: "JP", handwriting: "HW" }[mode] || MODES[mode].label;
    return (MODES[mode] || MODES.direct).label;
  }
  __name(modeLabel, "modeLabel");
  function dpFinals() {
    return DP_INITIAL_FINALS[dpScheme] || DP_INITIAL_FINALS.ziranma;
  }
  __name(dpFinals, "dpFinals");
  const DP_INITIAL_FINALS = { "ziranma": { "a": "ahijklno", "b": "acdfghijklmnouxyz", "c": "abefghijkloprsuvz", "d": "abcefghijklmopqrsuvwxyz", "e": "efginrz", "f": "abcfghjosuz", "g": "abdefghjkloprsuvwyz", "h": "abdefghjkloprsuvwyz", "i": "abdefghijkloprsuvwy", "j": "cdimnpqrstuvwxy", "k": "abdefghjkloprsuvwyz", "l": "abcdeghijklmnopqrstuvwxyz", "m": "abcefghijklmnoquxyz", "n": "abcdefghijklmnopqrstuvwxyz", "o": "abefghjkloruz", "p": "abcfghijklmnouwxyz", "q": "cdimnpqrstuvwxy", "r": "befghijkoprsuvw", "s": "abefghijkloprsuvz", "t": "abceghijklmoprsuvxyz", "u": "abdefghijklopruvwyz", "v": "abdefghijkloprsuvwyz", "w": "afghjlosuz", "x": "cdimnpqrstuvwxy", "y": "abehijklnoprstuvy", "z": "abefghijkloprsuvz" }, "flypy": { "a": "acdhijno", "b": "abcdfghijklmnopuw", "c": "acdefghijorsuvwyz", "d": "acdefghijkmnopqrsuvwxyz", "e": "efghinrw", "f": "afghjnosuwz", "g": "acdefghjklorsuvwxyz", "h": "acdefghjklorsuvwxyz", "i": "acdefghijklorsuvxyz", "j": "biklmnpqrstuvxy", "k": "acdefghjklorsuvwxyz", "l": "abcdeghijklmnopqrstuvwxyz", "m": "abcdefghijkmnopquwz", "n": "abcdefghijklmnopqrstuvwxyz", "o": "ouz", "p": "abcdfghijkmnopuwxz", "q": "biklmnpqrstuvxy", "r": "cefghijorsuvxyz", "s": "acdefghijorsuvwyz", "t": "acdeghijkmnoprsuvwyz", "u": "acdefghijkloruvwxyz", "v": "acdefghijklorsuvwxyz", "w": "adfghjosuw", "x": "biklmnpqrstuvxy", "y": "abcdehijkorstuvyz", "z": "acdefghijorsuvwyz" }, "sogou": { "a": "ahjkl", "b": ";acdfghijklmnouxz", "c": "abefghijkloprsuvz", "d": ";abcefghijklmopqrsuvwxz", "e": "efgrz", "f": "abcfghjosuz", "g": "abdefghjkloprsuvwyz", "h": "abdefghjkloprsuvwyz", "i": "abdefghijkloprsuvwy", "j": ";cdimnpqrstuwxy", "k": "abdefghjkloprsuvwyz", "l": ";abcdeghijklmnopqrstuwxyz", "m": ";abcefghijklmnoquxz", "n": ";abcdefghijklmnopqrstuwxyz", "o": "abefghjkloruz", "p": ";abcfghijklmnouwxz", "q": ";cdimnpqrstuwxy", "r": "befghijkoprsuvw", "s": "abefghijkloprsuvz", "t": ";abceghijklmoprsuvxz", "u": "abdefghijklopruvwyz", "v": "abdefghijkloprsuvwyz", "w": "afghjlosuz", "x": ";cdimnpqrstuwxy", "y": ";abehijklnoprstuy", "z": "abefghijkloprsuvz" }, "ziguang": { "a": "aeghilmnopqrstuwxyz", "b": ";abdfgikopqrstuwy", "c": "aehiklmnopqrstuwz", "d": ";abdefhijklmnopqrstuwxz", "f": "abhkorstuwz", "g": "aeghklmnopqrstuwxyz", "h": "aeghklmnopqrstuwxyz", "i": "aegiklmnopqrstuwxyz", "j": ";bdfghijlmnuvxy", "k": "aeghklmnopqrstuwxyz", "l": ";abdefghijklmnopqrstuvxyz", "m": ";abdefijkopqrstuwyz", "n": ";abdefghijklmnopqrstuvwxyz", "o": "aejkopqrstwz", "p": ";abdfikopqrstuwxyz", "q": ";bdfghijlmnuvxy", "r": "ehilmnoqrstuwxz", "s": "aehiklmnopqrstuwz", "t": ";abdefhiklmnopqrstuz", "u": "aeghiklmnopqrstuwxyz", "w": "ahkoprstuw", "x": ";bdfghijlmnuvxy", "y": ";aehilmnopqrsuvyz", "z": "aehiklmnopqrstuwz" } };
  const DP_KEYMAP = { "ziranma": { "q": "iu", "w": "ua/ia", "e": null, "r": "uan/er", "t": "ue/ve", "y": "ing/uai", "u": "sh", "i": "ch", "o": "uo", "p": "un", "a": null, "s": "ong/iong", "d": "iang/uang", "f": "en", "g": "eng", "h": "ang", "j": "an", "k": "ao", "l": "ai", "z": "ei", "x": "ie", "c": "iao", "v": "zh/ui \xFC", "b": "ou", "n": "in", "m": "ian" }, "flypy": { "q": "iu", "w": "ei", "e": null, "r": "uan/er", "t": "ue/ve", "y": "un", "u": "sh", "i": "ch", "o": "uo", "p": "ie", "a": null, "s": "ong/iong", "d": "ai", "f": "en", "g": "eng", "h": "ang", "j": "an", "k": "ing/uai", "l": "iang/uang", "z": "ou", "x": "ua/ia", "c": "ao", "v": "zh/ui \xFC", "b": "in", "n": "iao", "m": "ian" }, "sogou": { "q": "iu", "w": "ua/ia", "e": null, "r": "uan/er", "t": "ue/ve", "y": "uai", "u": "sh", "i": "ch", "o": "uo", "p": "un", "a": null, "s": "ong/iong", "d": "iang/uang", "f": "en", "g": "eng", "h": "ang", "j": "an", "k": "ao", "l": "ai", "z": "ei", "x": "ie", "c": "iao", "v": "zh/ui", "b": "ou", "n": "in", "m": "ian" }, "ziguang": { "q": "ao", "w": "en", "e": null, "r": "an", "t": "eng", "y": "uai/in", "u": "zh", "i": "sh", "o": "uo", "p": "ai", "a": "ch", "s": "ang", "d": "ie", "f": "ian", "g": "iang/uang", "h": "ong/iong", "j": "iu/er", "k": "ei", "l": "uan", "z": "ou", "x": "ua/ia", "v": null, "b": "iao", "n": "ui \xFCe", "m": "un" } };
  function decimateInkStrokes(strokes, maxPoints = 48) {
    const total = strokes.reduce((n, stroke) => n + stroke.length, 0);
    if (total <= maxPoints) return strokes;
    const scale = Math.fround(maxPoints / Math.fround(total));
    return strokes.map((stroke) => {
      const keep = Math.max(1, Math.min(
        stroke.length,
        Math.round(Math.fround(stroke.length * scale))
      ));
      if (keep >= stroke.length) return stroke;
      const span = Math.max(1, keep - 1);
      return Array.from({ length: keep }, (_, j) => stroke[Math.floor(j * (stroke.length - 1) / span)]);
    });
  }
  __name(decimateInkStrokes, "decimateInkStrokes");
  const _FeelimeKeyboard = class _FeelimeKeyboard {
    constructor() {
      this.token = "";
      this.ready = false;
      this.mode = "direct";
      this.engineReady = {};
      this.shift = false;
      this.caps = false;
      this.lastShiftTapAt = -Infinity;
      this.voiceState = "idle";
      this.voiceReadyHaptic = false;
      this.editorSensitive = false;
      this.composing = false;
      this.expanded = false;
      this.lastEngineState = null;
      this.lastRawInput = "";
      this.symbolCat = "common";
      this.tableVariants = {};
      this.keyLayer = "letters";
      this.editSelecting = false;
      this.kbLayout = "26";
      this.caseMode = null;
      this.lettersLayout = null;
      this.emojiView = false;
      this.renderedMode = null;
      this.panelEditorKeyLayer = null;
      this.panelTab = "clipboard";
      this.kaomojiTab = KAOMOJI_TABS[0].id;
      this.panelOpen = false;
      this.ctrlView = false;
      this.ctrlSuspended = false;
      this.ctrlReturnLayer = "letters";
      this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
      this.comboGrid = null;
      this.comboAnchor = null;
      this._overlayOpen = false;
      this.landscape = false;
      this.helloOrientation = null;
      this.safeBottom = 0;
      this.floatBand = 0;
      this.kbHeight = 0;
      this.helloSeen = false;
      this.rowHeight = 44;
      this.heightEditSaved = null;
      this.customEditRow = null;
      this.editorReturn = null;
      this.itemMenuOpen = null;
      this.panelEditItem = null;
      this.clipboardItems = [];
      this.favoriteItems = [];
      this.popup = null;
      this.popupEndEvents = /* @__PURE__ */ new WeakSet();
      this.popupRetiredIds = /* @__PURE__ */ new Set();
      this.touchOrigin = null;
      this.pressById = /* @__PURE__ */ new Map();
      this.swiping = false;
      this.voiceHold = false;
      this.spaceHoldTap = "voice";
      this.spaceHoldText = "";
      this.voiceSession = null;
      this.spaceHoldTimer = 0;
      this.inkStrokes = [];
      this.inkCurrent = null;
      this.inkTouchId = null;
      this.inkOrigin = null;
      this.inkMoved = false;
      this.inkReqId = 0;
      this.inkStaleAfter = 0;
      this.inkCandidates = [];
      this.inkTimer = null;
      this.inkHoldTimer = null;
      this.inkBarActive = false;
      this._inkViewport = "";
      this.toolbarYield = false;
      this.customChainQueue = [];
      this.customChainActive = false;
      this.customChainLastTextAt = 0;
      this.customChainTimer = 0;
      this.pressedKeys = /* @__PURE__ */ new Set();
      this.lastRevision = 0;
      this.toastTimer = null;
      this.expandKey = null;
      this.expandTab = "freq";
      this.expandRendered = 0;
      this.variantReplaying = false;
      this.variantTarget = null;
      this.variantReplayTimer = null;
      this.variantAnchor = null;
      this.scrubSpeed = 3;
      this.scrubSpeedFromNative = false;
      this.holdMs = 350;
      this.flickSwap = false;
      this.doubleShiftLock = true;
      this.popupSnap = 1;
      this.bottomPad = 0;
      this.candidateFont = 100;
      this.keycapFont = 100;
      this.userFontDigest = "";
      this.preeditFont = 0;
      this.preeditBold = false;
      this.oneHand = 0;
      this.oneHandPad = 0;
      this.oneHandSideMemory = 0;
      this.sideContent = 0;
      this.bgImageLight = "";
      this.bgImageDark = "";
      this.keyOpacity = 100;
      this.landscapeSafeArea = true;
      this.safeSideL = 0;
      this.safeSideR = 0;
      this.landscapeOpacity = 100;
      this.keyBubble = false;
      this.cnEnGuard = false;
      this.floating = false;
      this.floatGeom = null;
      this.bubbleLinger = 400;
      this.themeMode = "auto";
      this.toolbarLeft = TOOLBAR_DEFAULT.left.slice();
      this.toolbarRight = TOOLBAR_DEFAULT.right.slice();
      this.toolbarEdit = false;
      this.associationOn = false;
      this.assocWords = [];
      this.backspaceAssocOn = false;
      this.wxSlashOn = false;
      this.keySound = false;
      this.keyHaptic = false;
      this.uiLanguageChoice = "auto";
      this.quickPending = {};
      this.qsPage = 0;
      this.degrade = null;
      this.warming = false;
      this.seenDegradeSeq = 0;
      this.quickPair = ["pinyin", "direct"];
      this.hwQueue = [];
      this.hwDraining = false;
      this.hwDrainTimer = null;
      this.hwWaitSeq = 0;
      this.hwSeqCounter = 0;
      this.hwDoneSeq = 0;
      this.hwGen = 0;
      this.hwStateSeen = false;
      this.hwReported = false;
      this.hwPanelHeightSent = null;
      this.hardwareKeyboard = false;
      this.hwkbForm = "candidates";
      this.quickSwitchPolicy = "fixed";
      this.quickReturnMode = "pinyin";
      try {
        const speed = parseInt(localStorage.getItem("feelime_scrub_speed") || "3", 10);
        if (speed >= 1 && speed <= 5) this.scrubSpeed = speed;
      } catch (_) {
      }
      try {
        const pair = JSON.parse(localStorage.getItem("feelime_quick_pair") || "null");
        if (Array.isArray(pair) && pair.length === 2 && MODES[pair[0]] && MODES[pair[1]]) this.quickPair = pair;
      } catch (_) {
      }
      try {
        this.lastKbMode = localStorage.getItem("feelime_last_kb_mode") || "";
      } catch (_) {
        this.lastKbMode = "";
      }
      this.scrubBase = null;
      this.scrubSteps = 0;
      this.delBase = null;
      this.delSteps = 0;
      this.delUnit = 0;
      this.delNet = 0;
      this.bsVertical = 0;
      this.expandCandidates = [];
      this.expandHasNext = false;
      this.loadingMore = false;
      this._diagTouch = 0;
      this.touchEpoch = 0;
      this._diagRafAt = 0;
      this._diagCallBlocked = 0;
      this._diagNoClick = { swipe: 0, pop: 0, long: 0 };
      this._diagCancel = 0;
      if (window.FeelimeNative && typeof window.setInterval === "function") {
        this._diagRaf = null;
        this._diagInterval = null;
        window.addEventListener(
          "pointerdown",
          () => {
            if (this.touchDiagnostics) this._diagTouch += 1;
          },
          { capture: true, passive: true }
        );
        const onDiagCancel = /* @__PURE__ */ __name(() => {
          if (this.touchDiagnostics) this._diagCancel += 1;
        }, "onDiagCancel");
        window.addEventListener("touchcancel", onDiagCancel, { capture: true, passive: true });
        window.addEventListener("pointercancel", onDiagCancel, { capture: true, passive: true });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) this._diagRafAt = 0;
        });
        this._diagHeartbeat = () => {
          if (!this.touchDiagnostics || !this.token || typeof Native.diagEvent !== "function") return;
          const rafAlive = Date.now() - this._diagRafAt < 2600;
          const pl = document.getElementById("preeditLine");
          const ds = window.Feelime.debugState();
          const err = window.__diagErr || "";
          const p = this.popup;
          const bubEl = document.getElementById("keyBubble");
          const popStr = !p ? "0" : `1/${p.key || "?"}@${p.fingerId === void 0 ? "x" : p.fingerId}/${p.openedAt ? Math.round((Date.now() - p.openedAt) / 100) / 10 : "?"}s`;
          Native.diagEvent(
            `heartbeat raf=${rafAlive ? 1 : 0} touch=${this._diagTouch} cancel=${this._diagCancel} blocked=${this._diagCallBlocked} noClick=${this._diagNoClick.swipe}/${this._diagNoClick.pop}/${this._diagNoClick.long} pop=${popStr} bub=${bubEl && !bubEl.hidden ? 1 : 0} press=${this.pressedKeys.size} states=${window.__diagStates || 0} preedit=${pl ? pl.textContent.length : -1} vr=${ds.vr} warm=${ds.warm} comp=${ds.comp} vis=${document.hidden ? "h" : "v"} rev=${window.__diagRev || 0}` + (err ? ` err=${err}` : ""),
            this.token
          );
          this._diagTouch = 0;
          this._diagCancel = 0;
          this._diagCallBlocked = 0;
          this._diagNoClick = { swipe: 0, pop: 0, long: 0 };
          window.__diagStates = 0;
        };
      }
    }
    syncDiagnosticProbe() {
      if (!this.touchDiagnostics) {
        if (this._diagRaf != null) cancelAnimationFrame(this._diagRaf);
        if (this._diagInterval != null) window.clearInterval(this._diagInterval);
        this._diagRaf = this._diagInterval = null;
        this._diagRafAt = 0;
        return;
      }
      if (!this._diagHeartbeat || this._diagInterval != null) return;
      this._diagTouch = this._diagCancel = this._diagCallBlocked = 0;
      this._diagNoClick = { swipe: 0, pop: 0, long: 0 };
      const tick = /* @__PURE__ */ __name(() => {
        if (!this.touchDiagnostics) return;
        this._diagRafAt = Date.now();
        this._diagRaf = requestAnimationFrame(tick);
      }, "tick");
      if (typeof requestAnimationFrame === "function") this._diagRaf = requestAnimationFrame(tick);
      this._diagInterval = window.setInterval(this._diagHeartbeat, 2500);
    }
    setup() {
      const moveAt = {};
      [
        "touchstart",
        "touchmove",
        "touchend",
        "touchcancel",
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel"
      ].forEach((type) => {
        document.addEventListener(type, (event) => {
          if (!this.touchDiagnostics) return;
          if (type.endsWith("move")) {
            const now = Date.now();
            if (moveAt[type] !== void 0 && now - moveAt[type] < 100) return;
            moveAt[type] = now;
          }
          this.traceTouch(type, event);
        }, { capture: true, passive: true });
      });
      window.addEventListener("blur", () => this.cancelTouches());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.cancelTouches();
      });
      document.addEventListener("touchstart", (event) => {
        this.reconcileTouchSnapshot(event, true);
        if (this.popup && this.popup.fingerId !== void 0 && !Array.from(event.touches).some(
          (item) => item.identifier === this.popup.fingerId
        )) {
          this.closePopup(true);
        }
        if (event.touches.length === event.changedTouches.length) {
          this.cancelTouches();
          document.querySelectorAll("#ctrlLayer [data-ctrl]").forEach((button) => {
            button._suppressClick = false;
          });
        }
      }, { capture: true, passive: true });
      const pointers = /* @__PURE__ */ new Map();
      document.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") pointers.set(event.pointerId, {
          target: event.target,
          x: event.clientX,
          y: event.clientY
        });
      }, { capture: true, passive: true });
      document.addEventListener("touchstart", (event) => {
        const liveIds = new Set(Array.from(event.touches, (t2) => t2.identifier));
        const newIds = new Set(Array.from(event.changedTouches, (t2) => t2.identifier));
        for (const [id, pointer] of pointers) {
          if (pointer.touch && (!liveIds.has(pointer.touch.identifier) || newIds.has(pointer.touch.identifier))) pointers.delete(id);
        }
        for (const touch of event.changedTouches) {
          const pointer = Array.from(pointers.values()).find((p) => !p.touch && p.target === (touch.target || event.target) && p.x === touch.clientX && p.y === touch.clientY);
          if (pointer) pointer.touch = touch;
        }
      }, { capture: true, passive: true });
      const forgetPointers = /* @__PURE__ */ __name((event) => {
        for (const [id, pointer] of pointers) {
          if (pointer.touch && Array.from(event.changedTouches || []).some(
            (t2) => t2.identifier === pointer.touch.identifier
          )) pointers.delete(id);
        }
      }, "forgetPointers");
      document.addEventListener("touchend", (event) => {
        this.reconcileTouchSnapshot(event);
        this.finishPopupTouch(event, false);
        for (const touch of event.changedTouches) this.pressById.delete(touch.identifier);
        forgetPointers(event);
      }, { capture: true, passive: true });
      document.addEventListener("touchcancel", (event) => {
        this.reconcileTouchSnapshot(event);
        this.cancelTouchEvent(event);
        forgetPointers(event);
      }, { capture: true, passive: true });
      document.addEventListener(
        "pointerup",
        (event) => pointers.delete(event.pointerId),
        { capture: true, passive: true }
      );
      document.addEventListener(
        "touchmove",
        (event) => this.reconcileTouchSnapshot(event),
        { capture: true, passive: true }
      );
      document.addEventListener("pointercancel", (event) => {
        const pointer = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        if (!pointer || !pointer.touch) return;
        const id = pointer.touch.identifier;
        this.cancelTouchEvent({
          target: pointer.target,
          changedTouches: [pointer.touch],
          touches: Array.from(this.pressById.keys()).filter((key) => key !== id).map((identifier) => ({ identifier }))
        });
      }, { capture: true, passive: true });
      window.addEventListener("blur", () => pointers.clear());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) pointers.clear();
      });
      document.addEventListener("contextmenu", (event) => {
        const t2 = event.target;
        if (t2 && t2.closest && t2.closest('textarea, input, [contenteditable=""], [contenteditable="true"]')) {
          return;
        }
        event.preventDefault();
      });
      translateStaticUi();
      this.renderMode();
      this.renderSymbols();
      document.querySelector('[data-action="letters"]').addEventListener("click", () => this.showLetters());
      this.renderSymbolCats();
      document.getElementById("setupButton").addEventListener("click", () => this.toggleSettingsPanel());
      {
        const hwTag = document.getElementById("hwModeTag");
        if (hwTag) {
          hwTag.dataset.lp = "mode-menu";
          hwTag.addEventListener("click", () => {
            if (hwTag._suppressClick) {
              hwTag._suppressClick = false;
              return;
            }
            this.toggleChineseEnglish();
          });
          this.bindTouch(hwTag);
        }
      }
      {
        const bar = document.getElementById("candidateBar");
        let barTouchStart = null;
        bar.addEventListener("touchstart", (event) => {
          const t2 = event.changedTouches[0];
          if (t2) barTouchStart = { x: t2.clientX, y: t2.clientY };
        }, { capture: true, passive: true });
        bar.addEventListener(
          "touchcancel",
          () => {
            barTouchStart = null;
          },
          { capture: true, passive: true }
        );
        bar.addEventListener("touchend", (event) => {
          const start = barTouchStart;
          barTouchStart = null;
          if (!start) return;
          const t2 = event.changedTouches[0];
          if (t2 && Math.hypot(t2.clientX - start.x, t2.clientY - start.y) > 24) {
            event.preventDefault();
          }
        }, { capture: true });
      }
      const fullSetup = document.getElementById("fullSetupButton");
      if (fullSetup) {
        fullSetup.addEventListener("click", () => {
          this.closeOtherViews();
          this.call(() => Native.openSetup(this.token));
        });
      }
      document.getElementById("symCatBar").insertBefore(
        this.specialKey(
          "backspace",
          ICONS.backspace,
          () => this.backspaceAction(),
          "sym-bar-del",
          "repeat"
        ),
        null
      );
      this.setupToolbarEditor && this.setupToolbarEditor();
      document.querySelectorAll("#sideGrid .side-key").forEach((key) => {
        const dir = key.getAttribute("data-side-cursor");
        const action = key.getAttribute("data-side-action");
        key.addEventListener("click", () => {
          if (dir) {
            this.call(() => {
              if (typeof Native.editorCursor !== "function") return;
              Native.editorCursor(dir, this.token);
            });
          } else if (action) {
            this.call(() => {
              if (typeof Native.editorAction !== "function") return;
              Native.editorAction(action, this.token);
            });
          }
        });
      });
      const clipBtn = document.getElementById("clipboardButton");
      if (clipBtn) clipBtn.addEventListener("click", () => this.openPanel("clipboard"));
      const favBtn = document.getElementById("favoritesButton");
      if (favBtn) favBtn.addEventListener("click", () => this.openPanel("favorites"));
      document.getElementById("panelClose").addEventListener("click", () => this.closePanel());
      document.getElementById("panelClear").addEventListener("click", () => {
        if (this.panelTab !== "clipboard") return;
        if (this.panelClearTimer) {
          this.armPanelClear(false);
          this.call(() => Native.clearClipboard(this.token));
        } else {
          this.armPanelClear(true);
        }
      });
      document.getElementById("panelManage").addEventListener("click", () => this.openPanelEditor(null));
      const editorInput = document.getElementById("panelEditorInput");
      editorInput.addEventListener("focus", () => this.setPanelInput(true));
      document.querySelectorAll(".phrase-input").forEach((field) => {
        field.addEventListener("focus", () => this.reportPanelSelection());
        field.addEventListener("input", () => {
          field.__imeDeleteSnapshot = null;
          this.reportPanelSelection();
        });
        ["select", "click", "keyup"].forEach((name) => field.addEventListener(name, () => this.reportPanelSelection()));
      });
      editorInput.addEventListener("blur", () => {
        if (!document.body.classList.contains("editing")) {
          this.setPanelInput(false);
        }
      });
      editorInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.savePanelEditor();
      });
      document.getElementById("panelEditorSave").addEventListener("click", () => this.savePanelEditor());
      document.getElementById("panelEditorCancel").addEventListener("click", () => this.closePanelEditor());
      document.getElementById("phraseCardSave").addEventListener("click", () => this.savePanelEditor());
      document.getElementById("phraseCardCancel").addEventListener("click", () => this.closePanelEditor());
      document.getElementById("phraseCardClose").addEventListener("click", () => this.closePanelEditor());
      const nudgeRank = /* @__PURE__ */ __name((step) => {
        const value = document.getElementById("phraseCardRankValue");
        const next = Math.min(Math.max((parseInt(value.textContent, 10) || 1) + step, 1), 99);
        value.textContent = String(next);
      }, "nudgeRank");
      document.getElementById("phraseCardRankDown").addEventListener("click", () => nudgeRank(-1));
      document.getElementById("phraseCardRankUp").addEventListener("click", () => nudgeRank(1));
      document.getElementById("softKeyboard").addEventListener("touchstart", (event) => {
        const inLayer = /* @__PURE__ */ __name((id) => event.target && event.target.closest && event.target.closest(id), "inLayer");
        if (this.itemMenuOpen && !inLayer("#itemMenu")) this.closeItemMenu();
        if (this.comboGrid && !inLayer("#comboPopup")) {
          const anchor = this.comboAnchor;
          const onAnchor = anchor && event.target.closest && event.target.closest("[data-ctrl]") === anchor;
          this.closeComboGrid();
          if (onAnchor) anchor._suppressClick = true;
        }
        if (document.getElementById("modeMenu").classList.contains("open") && !inLayer("#modeMenu")) {
          const toggle = this.modeMenuAnchor || document.getElementById("modeToggle");
          const onToggle = toggle && event.target.closest && toggle.contains(event.target);
          this.closeModeMenu();
          if (onToggle) toggle._suppressClick = true;
        }
      }, { capture: true, passive: true });
      document.querySelectorAll("[data-panel-tab]").forEach((button) => {
        button.addEventListener("click", () => this.openPanel(button.dataset.panelTab));
        this.bindTouch(button);
      });
      document.getElementById("hide").addEventListener("click", () => this.call(() => Native.hideKeyboard(this.token)));
      const micBtn = document.getElementById("mic");
      if (micBtn) micBtn.addEventListener("click", () => this.toggleVoice());
      const imeSwitch = document.getElementById("imeSwitchButton");
      if (imeSwitch) imeSwitch.addEventListener("click", () => this.call(() => Native.switchInputMethod(this.token)));
      const ctrlToolBtn = document.getElementById("ctrlTool");
      if (ctrlToolBtn) ctrlToolBtn.addEventListener("click", () => this.setControlView(!this.ctrlView));
      this.bindCtrlLayer();
      document.getElementById("comboClose").addEventListener("click", () => {
        this.closeComboGrid();
      });
      this.bindPressFeedback(document.getElementById("comboClose"));
      this.bindPressFeedback(document.getElementById("confirmCancel"));
      this.bindPressFeedback(document.getElementById("confirmOk"));
      this.bindHeightCard();
      document.getElementById("confirmCancel").addEventListener("click", () => this.closeConfirmCard());
      document.getElementById("confirmOk").addEventListener("click", () => this.deleteHighlightedCandidate());
      if (typeof window.addEventListener === "function") {
        window.addEventListener("resize", () => {
          if (!this.helloOrientation) {
            this.applyOrientation(window.innerWidth > window.innerHeight);
          }
          this.onFloatingResize();
          this.applyHeight();
          if ((this.oneHand || 0) !== 0) this.applyOneHand();
          document.querySelectorAll(".sym-custom-row").forEach((strip) => this.fitCustomRow(strip));
        });
      }
      if (typeof ResizeObserver === "function") {
        this.heightObserver = new ResizeObserver(() => this.applyHeight());
        this.heightObserver.observe(document.getElementById("softKeyboard"), { box: "border-box" });
      }
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          this.applyHeight();
          document.querySelectorAll(".sym-custom-row").forEach((strip) => this.fitCustomRow(strip));
        }
      });
      document.getElementById("composeClear").addEventListener("click", () => {
        if (this.t9SymBar) {
          this.t9CloseSymbolBar();
          return;
        }
        if (this.mode === "handwriting" && ((this.inkCandidates || []).length || (this.inkStrokes || []).length)) {
          this.inkReset();
          return;
        }
        if (this.assocWords.length && !this.composing) {
          this.assocWords = [];
          this.renderCandidates(this.lastEngineState || {});
          return;
        }
        this.clearComposing();
      });
      document.getElementById("composeExpand").addEventListener("click", () => this.setExpanded(true));
      document.getElementById("expandCollapse").addEventListener("click", () => this.setExpanded(false));
      document.getElementById("expandGrid").addEventListener("scroll", () => this.maybeLoadMoreCandidates());
      document.getElementById("candidates").addEventListener("scroll", () => this.maybeLoadMoreCandidates());
      document.querySelectorAll("[data-expand-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          this.expandTab = button.dataset.expandTab;
          document.querySelectorAll("[data-expand-tab]").forEach((el) => el.classList.toggle("active", el === button));
          this.renderExpanded();
        });
      });
      this.bindTouch(document.getElementById("composeClear"));
      this.bindTouch(document.getElementById("composeExpand"));
      this.bindTouch(document.getElementById("expandCollapse"));
      document.getElementById("voiceOverlay").addEventListener("click", () => {
        this.requestVoiceStop(false);
      });
      const finishVoice = /* @__PURE__ */ __name((event) => {
        event.stopPropagation();
        this.requestVoiceStop(false);
      }, "finishVoice");
      document.getElementById("voiceScrim").addEventListener("click", finishVoice);
      document.getElementById("voiceCard").addEventListener("click", finishVoice);
      const voiceClose = document.getElementById("voiceClose");
      voiceClose.addEventListener("click", (event) => {
        event.stopPropagation();
        if (this.requestVoiceStop(true)) {
          this.showToast(t("\u5DF2\u64A4\u9500\u672C\u6B21\u542C\u5199"));
        }
      });
      this.bindPressFeedback(voiceClose);
      const voiceDone = document.getElementById("voiceDone");
      voiceDone.addEventListener("click", (event) => {
        event.stopPropagation();
        this.requestVoiceStop(false);
      });
      this.bindPressFeedback(voiceDone);
      this.bindTouch(document.getElementById("mic"));
      this.setupFlick(document.getElementById("softKeyboard"));
      if (this.kbHeight) this.applyKbHeight(this.kbHeight);
      this.applyHeight();
      if (typeof Native === "object" && Native !== null && typeof Native.requestState === "function") {
        Native.requestState();
      }
    }
    /* ===== bridge helpers ===== */
    call(action) {
      if (!this.ready || !this.token) {
        this._diagCallBlocked += 1;
        return;
      }
      return action(this.lastRevision);
    }
    /** 退格键帽统一出口（issue #46）：开关开启且处于联想让位态
     *  （无组合）时，退格等效 × ——清联想恢复工具栏、不动编辑框；
     *  其余情况照旧走原生删除（回执透传给 #34 回滑恢复）。 */
    backspaceAction(hwSeq, hwGen) {
      if (this.backspaceAssocOn && this.assocWords.length && !this.composing) {
        this.assocWords = [];
        this.renderCandidates(this.lastEngineState || {});
        return true;
      }
      return this.call(() => hwSeq && typeof Native.hwBackspace === "function" ? Native.hwBackspace(hwSeq, hwGen, this.token) : Native.backspace(this.token));
    }
    isChineseMode() {
      return this.mode === "pinyin" || this.mode === "double-pinyin" || this.mode === "t9" || this.mode === "stroke";
    }
    /** #39-8：形码（flypy）的符号交互与拼音一致——上滑 CN_ALTS 全角
     * 符号、弹层/下滑 literal 直发（sendSymbol），否则符号会走 sendText
     * 进形码引擎当编码被静默吞掉（用户实测「上滑没有反应」）。但引擎
     * 语义仍是形码：isChineseMode 不收 flypy（第三行左键的分词/Shift
     * 选择、T9 弹层等以它为准，' 分词对形码引擎无语义）。 */
    chineseSymMode() {
      return this.isChineseMode() || this.mode === "flypy";
    }
    sendKey(key) {
      const stickyArmed = this.ctrlView && this.sticky && Object.keys(this.sticky).some((name) => this.sticky[name]);
      if (stickyArmed) {
        const mods = Object.keys(this.sticky).filter((name) => this.sticky[name]);
        const shiftMod = this.shift ? ["Shift"] : [];
        const fnLabel = this.sticky.Fn ? FN_KEYS[key] : null;
        if (fnLabel) {
          this.sendCombo([...mods.filter((name) => name !== "Fn"), ...shiftMod, fnLabel]);
          return;
        }
        if (/^[a-z]$/i.test(key) && mods.some((name) => name !== "Fn")) {
          this.sendCombo([...mods.filter((name) => name !== "Fn"), ...shiftMod, key.toUpperCase()]);
          return;
        }
      }
      if (key === "." && this.chineseSymMode()) {
        this.enginePunct(",");
      } else {
        const text = this.applyCase(key);
        this.call(() => Native.key(text, this.token));
      }
      if (this.shift) {
        this.shift = false;
        this.updateLabels();
      }
    }
    sendText(text) {
      if (!text) return;
      if (this.mode === "t9") text = this.applyCase(text).toLowerCase();
      else text = this.applyCase(text);
      this.call(() => Native.key(text, this.token));
      if (this.shift) {
        this.shift = false;
        this.updateLabels();
      }
    }
    /**
     * Symbol-grid insertion is literal text, never engine input: routing
     * digits through key() feeds Chinese modes, where they are consumed
     * as candidate selectors and nothing lands (user-reported bug).
     * commitText bypasses composition, like panel paste.
     */
    sendSymbol(text) {
      if (!text) return;
      if (text === "/" && this.wxSlashOn && (this.mode === "pinyin" || this.mode === "double-pinyin")) {
        this.call(() => Native.key("/", this.token));
        if (this.shift) {
          this.shift = false;
          this.updateLabels();
        }
        return;
      }
      this.call(() => Native.commitText(text, this.token));
      if (this.shift) {
        this.shift = false;
        this.updateLabels();
      }
    }
    // Shift/Caps must also apply to accented and Cyrillic letters
    // arriving via popups and flicks, not just to [a-z0-9а-яё] key taps.
    applyCase(text) {
      if (!(this.shift || this.caps)) return text;
      if (!new RegExp("^\\p{L}$", "u").test(text)) return text;
      if (text !== text.toLowerCase()) return text;
      return text.toUpperCase();
    }
    toggleVoice() {
      if (!this.ready) return;
      if (this.voiceState === "listening" || this.voiceState === "loading") {
        this.requestVoiceStop(false);
      } else {
        this.voiceSession = "toolbar";
        Native.startVoice(this.token);
      }
    }
    /** Stop submits the current partial; cancel discards it.  The native
     * cancel entry is capability-gated so an older APK can never fall
     * back to stopVoice and accidentally commit a cancelled utterance. */
    requestVoiceStop(cancel) {
      const active = ["listening", "loading"].includes(this.voiceState) || this.voiceSession;
      if (!active) return false;
      if (cancel) {
        if (typeof Native.cancelVoice !== "function") {
          this.showToast(t("\u5F53\u524D\u7248\u672C\u4E0D\u652F\u6301\u53D6\u6D88\u8BED\u97F3\u8F93\u5165\uFF0C\u8BF7\u66F4\u65B0 APK"));
          return false;
        }
        Native.cancelVoice(this.token);
        return true;
      }
      Native.stopVoice(this.token);
      return false;
    }
    /* ===== rendering ===== */
    /** Keep the native side informed about layers that
     * overlap the float band above the keyboard - the band is not
     * touchable while closed, so any popup living there must flip the
     * native touch region (see FeelimeService.onComputeInsets). */
    syncOverlay() {
      const open = this.comboGrid !== null || document.getElementById("modeMenu").classList.contains("open") || document.getElementById("itemMenu").classList.contains("open") || document.getElementById("phraseCard").classList.contains("open") || // The height card lives in the band too - without
      // this line every real touch on it fell through to the host
      // app (±/strip/cancel all dead under a finger; synthetic
      // clicks bypassed hit-testing, so every suite stayed green).
      document.getElementById("heightCard").classList.contains("open");
      if (this._overlayOpen === open) return;
      this._overlayOpen = open;
      if (typeof Native.setOverlayOpen === "function") {
        this.call(() => Native.setOverlayOpen(open, this.token));
      }
    }
    renderMode() {
      const config = MODES[this.mode] || MODES.direct;
      this.shift = false;
      this.caps = false;
      if (this.renderedMode !== this.mode) {
        this.renderedMode = this.mode;
        this.tableVariants = {};
        if (this.mode !== "handwriting") this.inkReset();
        if (!document.getElementById("symbolLayer").hidden) {
          this.renderSymbolCats();
          this.renderSymbols();
        }
      }
      this.renderLetters(config.layout === "qwerty" && MERGEABLE_14.has(this.mode) && this.kbLayout === "14" ? "dp14" : config.layout);
      this.applyModeHeight();
      this.closeOtherViews();
      this.renderDegradeBadge();
    }
    renderLetters(layoutName) {
      this.cancelTouches();
      if (layoutName === "handwriting") {
        this.t9SymBar = false;
        if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
        return this.renderHandwriting();
      }
      if (layoutName === "t9") {
        this.t9SymBar = false;
        if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
        return this.mode === "stroke" ? this.renderStroke() : this.renderT9();
      }
      this.t9SymBar = false;
      if (!this.composing) this.setToolbarYield(this.assocWords.length > 0);
      const layout = LAYOUTS[layoutName] || LAYOUTS.qwerty;
      this.lettersLayout = layoutName;
      const layer = document.getElementById("qwertyLayer");
      layer.replaceChildren();
      layout.rows.forEach((definition) => {
        const config = typeof definition === "string" ? { keys: definition } : definition;
        const row = this.row(config.indent);
        if (config.shift && config.backspace) {
          const indentDef = layout.rows.find((r) => typeof r === "object" && r.indent && r.keys);
          const indentKeys = String(indentDef ? indentDef.keys : "");
          const paired = indentKeys.includes("|") || String(config.keys).includes("|");
          const letters = indentKeys.replace(/\|/g, "").length;
          if (paired) row.classList.add("kb-align-dp14");
          else if (letters === 9) row.classList.add("kb-align-9");
          else if (letters === 11) row.classList.add("kb-align-11");
        }
        if (config.shift) {
          row.append(this.isChineseMode() ? this.mode === "double-pinyin" && (dpScheme === "sogou" || dpScheme === "ziguang") ? this.specialKey("sep", "ing", () => this.call(() => Native.key(";", this.token)), "kb-wide-1_4 kb-mod sep") : this.specialKey("sep", t("\u5206\u8BCD"), () => this.call(() => Native.key("'", this.token)), "kb-wide-1_4 kb-mod sep") : this.specialKey("shift", ICONS.shift, () => this.toggleShift(), "kb-wide-1_4 kb-mod shift", "lock"));
        }
        if (String(config.keys).includes("|")) {
          String(config.keys).split("|").forEach((group) => {
            if (group.length === 1) {
              row.append(this.letterKey(group));
              return;
            }
            const pair = document.createElement("div");
            pair.className = "merge-pair";
            [...group].forEach((key) => pair.append(this.letterKey(key)));
            row.append(pair);
          });
        } else {
          [...config.keys].forEach((key) => row.append(this.letterKey(key)));
        }
        if (config.backspace) row.append(this.specialKey("backspace", ICONS.backspace, () => this.backspaceAction(), "kb-wide-1_4 kb-special", "repeat"));
        layer.append(row);
      });
      const bottom = this.row();
      bottom.append(this.specialKey("symbols", "123", () => this.showSymbols(), "kb-wide-2_1 kb-special", "numpad"));
      bottom.append(this.letterKey("."));
      const space = this.spaceKey();
      space.dataset.key = " ";
      bottom.append(space);
      bottom.append(this.cnEnKey());
      bottom.append(this.enterKey());
      layer.append(bottom);
      this.updateLabels();
    }
    /* ===== 九宫格 T9 键面：五列网格（微信式，preview-t9 定稿） =====
     * c1 音节/常用字符条（grid-row 1/5，底部符号键）· c2-c4 字母组 3×3 ·
     * c5 退格/重输/emoji/确认。底行 123 与中英各 2/3 键宽，省出的
     * 空间全部给空格（mic）键（用户定稿）。 */
    renderT9() {
      const layer = document.getElementById("qwertyLayer");
      layer.replaceChildren();
      const grid = document.createElement("div");
      grid.className = "t9-grid";
      this.t9GridSide(grid);
      const place = t9Place(grid);
      const coords = {
        "1": [1, 2],
        "2": [1, 3],
        "3": [1, 4],
        "4": [2, 2],
        "5": [2, 3],
        "6": [2, 4],
        "7": [3, 2],
        "8": [3, 3],
        "9": [3, 4]
      };
      Object.keys(coords).forEach((digit) => {
        if (digit === "1") {
          const one = document.createElement("button");
          one.className = "kb-key t9-key";
          one.dataset.key = "1";
          one.innerHTML = '<span class="t9-sup">1</span><span class="t9-group">@#.</span>';
          one.addEventListener("click", () => this.t9SymbolBar());
          this.bindTouch(one);
          place(one, coords[digit][0], coords[digit][1]);
        } else {
          place(this.t9LetterKey(digit), coords[digit][0], coords[digit][1]);
        }
      });
      this.t9GridChrome(grid, place);
      layer.append(grid);
      this.t9SideSig = null;
      this.renderT9Side();
      this.updateLabels();
    }
    /** T9 网格左列（笔画键面共用同一骨架）：竖向滚动条（native
     * scroll，无 bindTouch——preventDefault 杀拖动的既有教训）+
     * 底部符号键（面板入口，非 @#. 后选）。 */
    t9GridSide(grid) {
      const side = document.createElement("div");
      side.className = "t9-side";
      const strip = document.createElement("div");
      strip.className = "t9-strip";
      strip.id = "t9Strip";
      side.append(strip);
      const symBtn = this.specialKey(
        "t9sym",
        t("\u7B26\u53F7"),
        () => this.showSymbols(),
        "t9-sym-btn kb-special"
      );
      symBtn.setAttribute("aria-label", t("\u7B26\u53F7\u9762\u677F"));
      side.append(symBtn);
      grid.append(side);
    }
    /** T9 网格的功能列与底行（笔画键面共用同一骨架）：c5 退格/重输/
     * emoji，底行 123(2/3) + mic 空格(5/3) + 中英(2/3) + 确认。 */
    t9GridChrome(grid, place) {
      place(this.specialKey(
        "backspace",
        ICONS.backspace,
        () => this.backspaceAction(),
        "kb-special",
        "repeat"
      ), 1, 5);
      const clearKey = this.specialKey(
        "t9clear",
        t("\u91CD\u8F93"),
        () => this.clearComposing(),
        "kb-special"
      );
      place(clearKey, 2, 5);
      const emojiKey = this.specialKey(
        "t9emoji",
        ICONS.smiley,
        () => {
          this.emojiView = true;
          this.showNumpad();
        },
        "kb-special"
      );
      place(emojiKey, 3, 5);
      const r4 = document.createElement("div");
      r4.className = "t9-r4";
      r4.append(this.specialKey(
        "symbols",
        "123",
        () => this.showNumpad(),
        "t9-narrow kb-special"
      ));
      const space = this.spaceKey();
      space.dataset.key = "0";
      space.classList.add("t9-wide");
      space.classList.add("t9-space");
      const zero = document.createElement("span");
      zero.className = "t9-sup";
      zero.textContent = "0";
      space.append(zero);
      r4.append(space);
      const cnEn = this.cnEnKey();
      cnEn.classList.add("t9-narrow");
      r4.append(cnEn);
      r4.style.gridRow = "4";
      r4.style.gridColumn = "2 / 5";
      grid.append(r4);
      const enter = this.enterKey("");
      enter.style.gridRow = "4";
      enter.style.gridColumn = "5";
      grid.append(enter);
    }
    /* ===== 笔画键面（issue #18）：T9 五列网格骨架，3×3 换成笔画
     * 部件键。左列无音节枚举（renderT9Side 的 stroke 分支恒出常用
     * 字符），其余交互（退格/重输/emoji/底行/确认）与 T9 一致。 */
    renderStroke() {
      const layer = document.getElementById("qwertyLayer");
      layer.replaceChildren();
      const grid = document.createElement("div");
      grid.className = "t9-grid";
      this.t9GridSide(grid);
      const place = t9Place(grid);
      const coords = {
        "1": [1, 2],
        "2": [1, 3],
        "3": [1, 4],
        "4": [2, 2],
        "5": [2, 3],
        "6": [2, 4],
        "7": [3, 2],
        "8": [3, 3],
        "9": [3, 4]
      };
      Object.keys(coords).forEach((digit) => {
        if (digit === "7") {
          const sym = document.createElement("button");
          sym.className = "kb-key t9-key";
          sym.dataset.key = "7";
          sym.innerHTML = '<span class="t9-sup">7</span><span class="t9-group">@#.</span>';
          sym.addEventListener("click", () => this.t9SymbolBar());
          this.bindTouch(sym);
          place(sym, coords[digit][0], coords[digit][1]);
        } else {
          place(this.strokeKey(digit), coords[digit][0], coords[digit][1]);
        }
      });
      this.t9GridChrome(grid, place);
      layer.append(grid);
      this.t9SideSig = null;
      this.renderT9Side();
      this.updateLabels();
    }
    /** 笔画键：主字形=笔画部件（一丨丿丶乙 / ＊ / ， / 分词），右上
     * 角标=数字（上滑字面），左上小字=长按可出的两个符号。点按=
     * 部件编码进引擎（8 键发 ASCII ',' 走 punctuator）；6 键的第二
     * 个 * 在 JS 拦截（码表只派生了单通配行，** 无命中）。rawInput
     * 是 schema xlit 后的部件字形，* 原样保留（probe 实测）。 */
    strokeKey(digit) {
      const def = STROKE_KEYS[digit];
      const button = document.createElement("button");
      button.className = "kb-key t9-key";
      button.dataset.key = digit;
      button.dataset.lp = "popup";
      const hint = document.createElement("span");
      hint.className = "t9-hint";
      hint.textContent = (def.syms || []).join("");
      const sup = document.createElement("span");
      sup.className = "t9-sup";
      sup.textContent = digit;
      const group = document.createElement("span");
      group.className = "t9-group";
      if (/[一-鿿]/.test(def.main) && def.main.length > 1) {
        group.classList.add("t9-cjk");
      }
      group.textContent = t(def.main);
      button.append(hint, sup, group);
      button.addEventListener("click", () => this.strokeActivate(digit));
      this.bindTouch(button);
      return button;
    }
    /** 中文模式标点进引擎的统一入口（qwerty 标点槽 tap/上滑/长按
     * 与 stroke 8 键共用）：组合中走两步流——Android 构建的 librime
     * 组合中标点路径吞键（全拼 ni+',' 整体无声丢弃，真机实锤；host
     * gcc 构建正常，机制未明，见 keyboard.md §9.6），先按 id 确认池头
     * 候选，回声收掉组合后 commitText 直发全角标点；空闲态照旧发
     * ASCII 走引擎 punctuator 转全角。 */
    enginePunct(ascii, hwSeq, hwGen) {
      const fullwidth = ascii === "," ? "\uFF0C" : "\u3002";
      if (hwSeq !== void 0 && hwSeq !== null && !this.composing) {
        this.call(() => typeof Native.hwKeyChar === "function" ? Native.hwKeyChar(ascii, hwSeq, hwGen, this.token) : this.sendText(ascii));
        return;
      }
      if (this.composing) {
        const candidate = this.englishOrderedPool(this.expandCandidates || []).find((item) => !String(item.id).startsWith("alt:"));
        if (candidate) {
          this.pendingPunct = {
            text: fullwidth,
            raw: this.lastRawInput,
            at: Date.now(),
            ...hwGen !== void 0 ? { gen: hwGen } : {}
          };
          this.choosePoolCandidate(candidate, hwSeq, hwGen);
          return;
        }
      }
      this.sendText(ascii);
    }
    /** 笔画键的统一激活入口（点按与长按中格共用——codex 评审 P1：
     * closePopup 的引擎通道原先直发 send 绕过了这里的两个守卫）。
     * 6 键=单通配（码表只派生单 * 行，第二个拦截：回显含 * 或上一
     * 个 * 还在途）；8 键=标点（enginePunct：组合中两步流，空闲走
     * punctuator）。 */
    strokeActivate(digit) {
      const def = STROKE_KEYS[digit];
      if (!def) return;
      if (digit === "6" && this.composing && ((this.lastRawInput || "").includes("*") || this.wildcardInFlight)) {
        this.showToast(t("\u901A\u914D\u7B26\u53EA\u80FD\u7528\u4E00\u4E2A"));
        return;
      }
      if (digit === "8") {
        this.enginePunct(",");
        return;
      }
      if (digit === "6") this.wildcardInFlight = true;
      this.call(() => Native.key(def.code, this.token));
    }
    /* ===== 手写键面（issue #28，design/handwriting.md）：大块书写区
     * canvas + 底部控制行（退格/空格/中英/回车）。识别走独立桥
     * （recognizeInk → onInkCandidates），不进按键引擎；本节事件
     * 一律 stopPropagation——根级 setupFlick 只认 bindTouch 记下的
     * touchOrigin，书写区不挂 bindTouch 即天然不进 flick/scrub 仲裁。
     * 书写区是 flex 唯一的弹性块，控制行高固定（.ink-controls 的
     * --ink-row-h，不吃 --kb-row-h 预算）：applyHeight 在视图被瞬时
     * 量高时烘焙出的陈旧行变量再也压不塌书写区（重唤折叠 P1 的
     * 根因通道被结构性拆除）。 */
    renderHandwriting() {
      const layer = document.getElementById("qwertyLayer");
      layer.replaceChildren();
      const layout = document.createElement("div");
      layout.className = "ink-layout";
      layout.style.setProperty("--ink-row-h", INK_CONTROL_ROW_H + "px");
      const pad = document.createElement("div");
      pad.className = "ink-pad";
      pad.id = "inkPad";
      const canvas = document.createElement("canvas");
      canvas.id = "inkCanvas";
      canvas.className = "ink-canvas";
      const hint = document.createElement("span");
      hint.className = "ink-hint";
      hint.id = "inkHint";
      INK_HINT_LINES.forEach((line) => {
        const row = document.createElement("span");
        row.className = "ink-hint-line";
        row.textContent = t(line);
        hint.append(row);
      });
      pad.append(canvas, hint);
      this.bindInkPad(pad);
      if (this.landscape) {
        const rail = document.createElement("div");
        rail.className = "ink-rail";
        rail.append(...this.inkSideKeys(true), ...this.inkBottomKeys(false));
        layout.append(pad, rail);
      } else {
        const side = document.createElement("div");
        side.className = "ink-side";
        side.append(...this.inkSideKeys());
        const main = document.createElement("div");
        main.className = "ink-main";
        main.append(pad, side);
        const bottom = document.createElement("div");
        bottom.className = "ink-bottom";
        bottom.append(...this.inkBottomKeys());
        layout.append(main, bottom);
      }
      layer.append(layout);
      this.updateLabels();
      this.inkResize();
      this.applyModeHeight();
    }
    /** 右窄列（round-6，用户拍板）：竖屏 = ⌫（固定 1 格）+ 滚动
     * 符号列（视口 3 格高，上滑滚出更多、点按直上屏——T9/数字面板
     * 左列同款形态，不再是手势弹层）。横屏 rail 保持 2×4 定稿：
     * ⌫ + 中英键 + 两颗纯点按符号键（横屏空间紧，不滚）。 */
    inkSideKeys(landscape = false) {
      const keys = [this.inkBackspaceKey()];
      if (landscape) {
        keys.push(this.inkSymbolKey("\uFF0C"), this.cnEnKey(), this.inkSymbolKey("\u3002"));
      } else {
        keys.push(this.inkSymbolScroller());
      }
      return keys;
    }
    /** 滚动符号列：常驻滚动列表，初始露前三格，上滑滚出更多。
     * 滚动走 CSS overflow（触摸原生滚动），点按=sendSymbol 直上屏。 */
    inkSymbolScroller() {
      const scroller = document.createElement("div");
      scroller.className = "ink-scroll";
      INK_SIDE_SYMBOLS.forEach((char) => scroller.append(this.inkSymbolCell(char)));
      return scroller;
    }
    /** 滚动列里的单个符号格。 */
    inkSymbolCell(char) {
      const button = document.createElement("button");
      button.className = "kb-key kb-special ink-key ink-sym";
      button.dataset.role = "ink-sym";
      button.textContent = char;
      button.setAttribute("aria-label", char);
      button.addEventListener("click", () => {
        this.nativeKeyFeedback();
        this.sendSymbol(char);
      });
      return button;
    }
    /** 横屏 rail 的纯点按符号键（无手势）。 */
    inkSymbolKey(char) {
      return this.inkSymbolCell(char);
    }
    /** 退格（round-4 反馈）：书写区有笔迹时=清笔迹+候选回工具栏
     * （inkReset，与 × / 长按清空同一出口），不删编辑框字符；无
     * 笔迹时照旧走原生删除。语义锚在**手势起点**：长按连发把笔迹
     * 清掉之后，同一次按住的后续 click（repeat 的 setInterval 与
     * 松手补的那次）都不得转成删除——所以按下时先记状态，清笔迹
     * 那一次同时把连发收走。 */
    inkBackspaceKey() {
      const button = this.specialKey(
        "backspace",
        ICONS.backspace,
        () => this.inkBackspace(button),
        "ink-key kb-special",
        "repeat"
      );
      button.addEventListener("touchstart", () => {
        button._inkHadStrokes = this.inkStrokes.length > 0 || (this.inkCurrent || []).length > 0;
      });
      return button;
    }
    inkBackspace(button) {
      if (button._inkHadStrokes) {
        this.inkReset();
        if (button._cancelRepeat) button._cancelRepeat();
        return;
      }
      this.backspaceAction();
    }
    /** 底行：符号（符号面板）/ 123（九宫格）/ 空格（候选条有手写
     * 候选时=确认 top1，见 spaceKey）/ 快捷切换（=其他键盘底行的
     * 中英切换键同款：短按翻 quick-pair、长按=完整模式菜单，见
     * cnEnKey）/ 换行。横屏不设切换格（includeMode=false）：八键恰
     * 两列四行。 */
    inkBottomKeys(includeMode = true) {
      const keys = [
        this.specialKey(
          "ink-symbols",
          t("\u7B26\u53F7"),
          () => this.showSymbols(),
          "ink-key kb-special"
        ),
        this.specialKey(
          "ink-numpad",
          "123",
          () => this.showNumpad(),
          "ink-key kb-special"
        ),
        this.inkSpaceKey()
      ];
      if (includeMode) keys.push(this.cnEnKey());
      keys.push(this.enterKey());
      return keys;
    }
    /** 手写空格：= spaceKey（top1 确认 / mic 长按）+ data-key 借
     * T9 空格的横滑 scrub 通道（.kb-key[data-key] 手势层认它）。
     * 垂直方向没有字面语义（setupFlick 让路），上滑留给 bindSpaceHold
     * 的语音长按/撤销。 */
    inkSpaceKey() {
      const space = this.spaceKey();
      space.dataset.key = "0";
      return space;
    }
    /** 抽出条/弹层的选中：指针压在哪格选哪格（格子不重叠、不透明，
     * rect 命中与 elementFromPoint 等价，且在 mock 的合成几何下同样
     * 可测），离开条=取消选中——不弹「松手撤销」，没选过谈不上
     * 撤销；松手无选中=无输入。 */
    moveInkPopup(touch) {
      if (!this.popup) return;
      const cell = this.popup.cells.find((cell2) => {
        const rect = cell2.item.getBoundingClientRect();
        return touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
      }) || null;
      this.popup.selected = cell;
      this.popup.cells.forEach((item) => item.item.classList.toggle("sel", item === this.popup.selected));
    }
    /** 手写模式的高度预算（竖屏）：面板宽高比钉在 1.6:1（wetype
     * 实测 984×590 口径），键盘总高 = 顶部 chrome + 控制行 + 面板。
     * 横屏不改总高（native 钳半屏，预算本就见底，面板改左右布局
     * 竖向铺满——见 .ink-layout 的横屏分支）。 */
    inkPanelTarget() {
      const width = Math.max(0, (window.innerWidth || 0) - 8);
      return Math.round(width / 1.6);
    }
    /** 手写键面的固定纵向开销：拼音带 + 候选条槽 + 控制行 + 底部
     * 留白（与 .ink-layout/.ink-controls/#candidateBar 的 CSS 常量
     * 一一对应；漏掉任何一段面板就会比目标矮）。 */
    inkChromeHeight() {
      const band = 18 + (this.preeditFont === 2 ? 11 : this.preeditFont === 1 ? 8 : 4);
      const bar = 2 + 40 + 10;
      const row = INK_CONTROL_ROW_H + 5;
      return band + bar + row + 5;
    }
    /** 手写模式期望的内容高度（竖屏），钳进 native 的高度上下限。 */
    inkDesiredHeight() {
      const min = this.inkChromeHeight() + 96;
      const bounds = this.heightBounds();
      const panel = this.inkPanelTarget() + this.inkChromeHeight();
      return Math.round(Math.min(bounds.max, Math.max(min, panel)));
    }
    /** 把键盘总高切到当前模式应有的值。高度体系统一（五轮反馈 5，
     * 用户拍板「统一到矮的」）：所有模式含手写一律用 stored（未调过
     * = native 默认 272），手写仅保内容下限（chrome+最小面板，防弹性
     * 面板被压塌——P1 的教训）。切换键盘不再跳高度。幂等：值相同不
     * 发桥。重唤键盘（resetToHome / applyHeightNow）也走这里——这是
     * 重唤后布局没跟手写态走的 P1 修复的另一半。 */
    applyModeHeight() {
      const card = document.getElementById("heightCard");
      if (card && card.classList.contains("open")) return;
      if (!this.helloSeen) return;
      const stored = this.storedKbHeight();
      const base = stored > 0 ? stored : this.heightDefaultCss || 272;
      if (this.landscape || this.mode !== "handwriting") {
        if (this.kbHeight !== base) this.applyKbHeightLocal(base);
        return;
      }
      const desired = Math.max(base, this.inkChromeHeight() + 96);
      const authoritative = Math.max(this.kbHeight, base);
      if (authoritative !== desired) {
        this.applyKbHeight(desired);
      } else if (this.kbHeight !== desired) {
        this.applyKbHeightLocal(desired);
      }
    }
    /** 「按权威值对齐本地布局」专用：不发高度桥、不写 pref。
     *  stored 路径的回推是 native→hello→JS→native 的回声——native 的
     *  view 高度本来就是它自己按 pref 量的，JS 再教一遍除了制造
     *  debounce 回写覆盖（滑杆值被冲掉的 round-8 同族）没有任何收益。
     *  用户显式编辑（applyKbHeight）与手写下限抬升仍走发桥版本。 */
    applyKbHeightLocal(content) {
      this.kbHeight = Math.round(Number(content) || 0);
      this.applyHeight();
    }
    /** 书写区手势：一笔一采样（首触点起笔，move 追点，end 收笔）。
     * 停笔触发识别的延时走设置档（默认 600ms）；收笔后再落新笔会先
     * 撤未决请求（reqId 失配，迟到结果被丢弃）；长按原地把笔迹清空。 */
    bindInkPad(pad) {
      const INK_HOLD_SLOP = 6;
      const INK_MIN_POINT_GAP = 2;
      const at = /* @__PURE__ */ __name((touch) => {
        const rect = pad.getBoundingClientRect ? pad.getBoundingClientRect() : { left: 0, top: 0 };
        return {
          x: touch.clientX - (rect.left || 0),
          y: touch.clientY - (rect.top || 0)
        };
      }, "at");
      pad.addEventListener("touchstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.inkTouchId !== null) return;
        const touch = event.changedTouches[0];
        this.inkTouchId = touch.identifier;
        this.inkOrigin = at(touch);
        this.inkMoved = false;
        this.inkCurrent = [this.inkOrigin];
        this.inkStaleAfter = this.inkReqId;
        if ((this.inkCandidates || []).length) {
          this.inkCandidates = [];
          this.renderCandidates(this.lastEngineState || {});
        }
        this.applyInkBarChrome();
        clearTimeout(this.inkTimer);
        this.inkTimer = null;
        clearTimeout(this.inkHoldTimer);
        this.inkHoldTimer = setTimeout(() => {
          this.inkHoldTimer = null;
          if (!this.inkMoved) {
            this.inkTouchId = null;
            this.inkCurrent = null;
            this.inkReset();
            this.showToast(t("\u5DF2\u6E05\u7A7A\u7B14\u8FF9"));
          }
        }, this.holdMs);
        this.inkPaint();
      }, { passive: false });
      pad.addEventListener("touchmove", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.inkTouchId === null) return;
        const touch = Array.from(event.changedTouches).find(
          (item) => item.identifier === this.inkTouchId
        );
        if (!touch) return;
        const point = at(touch);
        if (!this.inkMoved) {
          if (Math.hypot(
            point.x - this.inkOrigin.x,
            point.y - this.inkOrigin.y
          ) < INK_HOLD_SLOP) return;
          this.inkMoved = true;
          clearTimeout(this.inkHoldTimer);
          this.inkHoldTimer = null;
        }
        const stroke = this.inkCurrent || [];
        const last = stroke[stroke.length - 1];
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_POINT_GAP) return;
        stroke.push(point);
        this.inkCurrent = stroke;
        this.inkPaint();
      }, { passive: false });
      const release = /* @__PURE__ */ __name((event) => {
        const touch = event.changedTouches && Array.from(event.changedTouches).find(
          (item) => item.identifier === this.inkTouchId
        );
        if (!touch) return null;
        this.inkTouchId = null;
        clearTimeout(this.inkHoldTimer);
        this.inkHoldTimer = null;
        return this.inkCurrent;
      }, "release");
      pad.addEventListener("touchend", (event) => {
        const stroke = release(event);
        if (stroke === null) return;
        if (stroke && stroke.length) this.inkStrokes.push(stroke);
        this.inkCurrent = null;
        this.inkPaint();
        if (this.inkStrokes.length) {
          this.inkRecognize();
        }
      }, { passive: false });
      pad.addEventListener("touchcancel", (event) => {
        const stroke = release(event);
        if (stroke === null) return;
        if (this.token && window.FeelimeNative && typeof Native.diagEvent === "function") {
          const last = stroke && stroke.length ? stroke[stroke.length - 1] : null;
          Native.diagEvent(
            `inkCancel pts=${stroke ? stroke.length : 0}` + (last ? ` x=${Math.round(last.x)} y=${Math.round(last.y)}` : ""),
            this.token
          );
        }
        this.inkCurrent = null;
        this.inkPaint();
        this.applyInkBarChrome();
      }, { passive: false });
    }
    /** 画布分辨率跟 CSS 盒走（devicePixelRatio 保清晰）；无 2d 环境
     * （mock/预览降级）只记尺寸不画。 */
    inkResize() {
      const canvas = document.getElementById("inkCanvas");
      if (!canvas) return;
      this.inkSymFont();
      const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
      const width = Math.max(1, Math.round(rect && rect.width || 320));
      const height = Math.max(1, Math.round(rect && rect.height || 132));
      const ratio = typeof window !== "undefined" && typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
      this._inkRatio = ratio;
      this._inkColor = this.inkColor();
      if (canvas.width === width * ratio && canvas.height === height * ratio) return;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      this.inkPaint();
    }
    /** 符号列字号跟格高（视口剥缝三等分）：格高随键盘总高变化，
     * 写死字号在矮高度下裁字。inkResize 每次几何变化都先跑这里，
     * 画布早退不影响字号对账。mock/jsdom 无布局（rect=0）跳过，
     * CSS 落回 22px 缺省。 */
    inkSymFont() {
      const scroll = document.querySelector(".ink-scroll");
      if (!scroll || typeof scroll.getBoundingClientRect !== "function") return;
      const vh = scroll.getBoundingClientRect().height;
      if (!(vh > 0)) return;
      const cellH = (vh - 10) / 3;
      const size = Math.max(12, Math.min(22, Math.round(cellH * 0.5)));
      scroll.style.setProperty("--ink-sym-size", size + "px");
    }
    inkContext() {
      const canvas = document.getElementById("inkCanvas");
      if (!canvas || typeof canvas.getContext !== "function") return null;
      try {
        return canvas.getContext("2d");
      } catch (_) {
        return null;
      }
    }
    /** 重放笔迹（局部 CSS px → 画布像素按缩放比映射）。 */
    inkPaint() {
      const pad = document.getElementById("inkPad");
      if (pad) pad.classList.toggle(
        "writing",
        this.inkStrokes.length > 0 || (this.inkCurrent || []).length > 0
      );
      if (this._inkFrame != null) return;
      if (typeof requestAnimationFrame !== "function") {
        this.inkPaintFrame();
        return;
      }
      this._inkFrame = requestAnimationFrame(() => {
        this._inkFrame = null;
        this.inkPaintFrame();
      });
    }
    inkPaintFrame() {
      const context = this.inkContext();
      if (!context || typeof context.scale !== "function") return;
      const canvas = document.getElementById("inkCanvas");
      const ratio = this._inkRatio || 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 3.2 * ratio;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = this._inkColor || (this._inkColor = this.inkColor());
      context.beginPath();
      const all = this.inkCurrent && this.inkCurrent.length ? this.inkStrokes.concat([this.inkCurrent]) : this.inkStrokes;
      all.forEach((stroke) => {
        stroke.forEach((point, index) => {
          const x = point.x * ratio;
          const y = point.y * ratio;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
      });
      context.stroke();
    }
    /** 墨色跟主题 token 走（§1.1）；取不到 var（mock/降级）用中性灰。 */
    inkColor() {
      if (typeof getComputedStyle !== "function") return "#888";
      const styles = getComputedStyle(document.documentElement);
      const value = styles && styles.getPropertyValue && styles.getPropertyValue("--text");
      return value && value.trim() || "#888";
    }
    inkSchedule(delay) {
      clearTimeout(this.inkTimer);
      this.inkTimer = setTimeout(() => {
        this.inkTimer = null;
        this.inkRecognize();
      }, delay);
    }
    /** 发送识别请求（design §2/§3）：w/h 承载书写区 CSS 尺寸，坐标
     * 保留原始比例（归一在 native 侧做）；发送前对每笔做平滑去抖
     * （smoothInkStroke，只影响这条 payload）。旧 APK 无此桥方法时
     * 静默跳过（§5.4 feature-detect）。 */
    inkRecognize() {
      if (!this.inkStrokes.length) return;
      if (typeof Native.recognizeInk !== "function") return;
      const canvas = document.getElementById("inkCanvas");
      const rect = canvas && typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : { width: 320, height: 132 };
      const round1 = /* @__PURE__ */ __name((value) => Math.round(value * 10) / 10, "round1");
      const strokes = this.inkStrokes.map((stroke) => smoothInkStroke(stroke).map((point) => [round1(point.x), round1(point.y)]));
      const payload = JSON.stringify({
        w: Math.round(rect.width || 320),
        h: Math.round(rect.height || 132),
        strokes: this.inkPredecimated ? decimateInkStrokes(strokes) : strokes,
        originalStrokeSizes: this.inkPredecimated ? strokes.map((stroke) => stroke.length) : void 0
      });
      if (payload.length > 4096) return;
      this.inkReqId += 1;
      this.call(() => Native.recognizeInk(this.inkReqId, payload, this.token));
    }
    /** 清笔迹与候选（点选上屏 / 长按清空 / 离开模式共用）。 */
    inkReset() {
      this.inkStrokes = [];
      this.inkCurrent = null;
      this.inkCandidates = [];
      clearTimeout(this.inkTimer);
      this.inkTimer = null;
      this.inkPaint();
      if (this.mode === "handwriting") this.renderCandidates(this.lastEngineState || {});
      else {
        const tag = document.getElementById("inkTag");
        if (tag) tag.hidden = true;
        this.setToolbarYield(false);
        this.inkBarActive = false;
      }
    }
    /** 键盘收起/失焦的触摸卫生（§10.6）：撤长按计时、丢弃进行中的笔。 */
    inkCancelTouch() {
      this.inkTouchId = null;
      this.inkCurrent = null;
      clearTimeout(this.inkHoldTimer);
      this.inkHoldTimer = null;
    }
    /** 手写候选态（wetype 形态，issue #28 round-2）：有识别候选=工具
     * 栏整行让位（含 mic，仅留 ×），「手写」标识 + 候选横排占满整行；
     * 无候选/清空后=工具栏原样。语音进行中不让位——mic 是 stop 入口
     * 必须存活（与联想让位的守卫同一口径）。round-3：点选上屏后的
     * 联想词同一条 bar 接手，让位语义与拼音态一致（× 由 composeClear
     * 的联想分支恢复），但「手写」标识只跟识别候选走。
     * #39-6 后续（复发）：让位提前到落笔——写字全程（笔迹进行中/
     * 已有笔迹/有候选）整行让位。原实现等「候选回来」才让位，写字
     * 与识别在途的窗口里按钮全在，短笔画（点/顿笔，位移小、约 0.1s
     * 抬笔）与正常点按不可分，起笔稍高即误触（24px 守卫天然漏过）。
     * 收起键一并隐藏（用户裁定：写字中行内只留标识与 ×；收键盘走
     * 系统返回键/点输入框外）。 */
    applyInkBarChrome() {
      const active = this.mode === "handwriting" && ((this.inkCandidates || []).length > 0 || (this.inkStrokes || []).length > 0 || this.inkTouchId !== null);
      this.inkBarActive = active;
      const assocOnly = this.mode === "handwriting" && !active && (this.assocWords || []).length > 0;
      const tag = document.getElementById("inkTag");
      if (tag) tag.hidden = !active;
      if (this.voiceState === "idle") {
        this.setToolbarYield(active || assocOnly);
        if (active) {
          const mic = document.getElementById("mic");
          if (mic) mic.hidden = true;
        }
        const hideBtn = document.getElementById("hide");
        if (hideBtn) hideBtn.hidden = active;
      }
      return active;
    }
    /** 点选候选：commitText 直上屏并清笔迹（design §2 数据流）。
     * 清笔迹同时撤掉互斥态 → 工具栏恢复（wetype 同款：上屏后回
     * 工具栏，继续写再进候选态）。 */
    commitInkCandidate(candidate) {
      if (typeof Native.commitAssoc === "function") {
        this.call(() => Native.commitAssoc(candidate.text, this.token));
      } else {
        this.sendSymbol(candidate.text);
      }
      this.inkReset();
    }
    /** 识别结果（design §3）：reqId 与最新请求不符即丢弃；错误提示
     * 但不阻塞书写；成功则整条刷新候选（复用候选条 DOM）。 */
    onInkCandidates(payload) {
      if (this.mode !== "handwriting") return;
      const reqId = Number(payload && payload.reqId);
      if (reqId !== this.inkReqId || reqId <= (this.inkStaleAfter || 0)) return;
      const error = payload && payload.error;
      if (error === "unavailable") {
        this.showToast(t("\u624B\u5199\u6A21\u578B\u672A\u5C31\u7EEA"));
        return;
      }
      if (error) {
        this.showToast(t("\u624B\u5199\u8BC6\u522B\u5931\u8D25"));
        return;
      }
      const candidates = Array.isArray(payload.candidates) ? payload.candidates.filter((item) => item && item.text).map((item) => ({ id: `ink:${item.text}`, text: item.text })) : [];
      this.assocWords = [];
      this.inkCandidates = candidates;
      this.renderCandidates(this.lastEngineState || {});
    }
    /** 字母组键：主字形=字母组（ABC），右上角标=数字，左上角小字=
     * 长按可出的两个符号（issue #9）。点按=整组通配（数字进引擎）；
     * 长按=三行弹层（大小写+符号）；四向滑动见 setupFlick。 */
    t9LetterKey(digit) {
      const button = document.createElement("button");
      button.className = "kb-key t9-key";
      button.dataset.key = digit;
      button.dataset.lp = "popup";
      const hint = document.createElement("span");
      hint.className = "t9-hint";
      hint.textContent = (LAYOUTS.t9.keySymbols[digit] || []).join("");
      const sup = document.createElement("span");
      sup.className = "t9-sup";
      sup.textContent = digit;
      const group = document.createElement("span");
      group.className = "t9-group";
      group.textContent = (LAYOUTS.t9.alts[digit] || "").toUpperCase();
      button.append(hint, sup, group);
      button.addEventListener("click", () => this.call(() => Native.key(digit, this.token)));
      this.bindTouch(button);
      return button;
    }
    /** 待确认段音节枚举：对「未确认前缀之后的输入」做前缀枚举，逐位
     * 校验字母一致性（段中已确认的字母必须与音节同位相同或该位是
     * 数字）。候选跨前缀长度按词典词频全局降序（输入 64 → ni 在
     * mi/o 之前），声母前缀层缀尾。 */
    t9SegmentSyllables(seg) {
      const digits = t9ToDigits(seg);
      const consistent = /* @__PURE__ */ __name((form, n) => {
        for (let i = 0; i < n; i++) {
          if (seg[i] !== form[i] && seg[i] !== t9ToDigits(form[i]).charAt(0)) {
            return false;
          }
        }
        return true;
      }, "consistent");
      const w = T9_SYLLABLE_INDEX.w || {};
      const full = [];
      for (let n = 1; n <= seg.length; n++) {
        (T9_SYLLABLE_INDEX.full[digits.slice(0, n)] || []).forEach((s) => {
          if (consistent(s, n)) full.push(s);
        });
      }
      full.sort((a, b) => (w[b] || 0) - (w[a] || 0));
      const pre = [];
      const seen = /* @__PURE__ */ new Set();
      Object.values(T9_SYLLABLE_INDEX.pre).forEach((list) => list.forEach((p) => {
        if (!seen.has(p) && p.length <= seg.length && consistent(p, p.length)) {
          seen.add(p);
          pre.push(p);
        }
      }));
      return { full, pre };
    }
    /** 未确认段：键盘侧记录的「用户点选确认」边界之后的输入。引擎回显
     * 的段空格是切分猜测不是用户确认（64426 会被引擎猜成 64|426，
     * 首字还没定就展示第二字读法是错的，用户定稿：只出首字读法）。 */
    t9PendingSegment() {
      const raw = (this.lastRawInput || "").replace(/ /g, "");
      const cut = Math.min(this.t9ConfirmedLen || 0, raw.length);
      return raw.slice(cut).replace(/^[^a-z2-9]+/i, "");
    }
    /** 当前读音（候选字上方的拼音提示）：按引擎回显的段切分，段内
     * 贪婪最长覆盖（同长取词频高）拼出 'ni'hao'——取词频首位会把
     * nian 截成 ni（codex round-4 P2-1），读音必须覆盖整段；剩余
     * 无匹配时原样保留。 */
    t9Reading() {
      const parts = (this.lastRawInput || "").trim().split(/ +/).filter(Boolean);
      if (!this.composing || !parts.length) return "";
      const w = T9_SYLLABLE_INDEX.w || {};
      const out = [];
      parts.forEach((part) => {
        let i = 0;
        while (i < part.length) {
          if (!/[a-z2-9]/.test(part.charAt(i))) {
            let j = i + 1;
            while (j < part.length && !/[a-z2-9]/.test(part.charAt(j))) j++;
            out.push(part.slice(i, j));
            i = j;
            continue;
          }
          let best = null;
          this.t9SegmentSyllables(part.slice(i)).full.forEach((s) => {
            if (!best || s.length > best.length || s.length === best.length && (w[s] || 0) > (w[best] || 0)) {
              best = s;
            }
          });
          if (!best) {
            out.push(part.slice(i));
            break;
          }
          out.push(best);
          i += best.length;
        }
      });
      return out.join("'");
    }
    /** 左列双态：空闲=常用字符（中文标点，sendSymbol 直上屏）；组合中=
        拼音音节候选（完整音节可点重写组合，声母前缀置灰提示）。
        内容签名不变不重建——滚动位置在竖拖时不被引擎事件打断。 */
    renderT9Side() {
      const strip = document.getElementById("t9Strip");
      if (!strip || this.mode !== "t9" && this.mode !== "stroke") return;
      if (this.mode === "stroke") {
        if (this.t9SideSig === "sym") return;
        this.t9SideSig = "sym";
        strip.replaceChildren();
        T9_SIDE_CHARS.forEach((char) => strip.append(this.t9SideCell(char)));
        return;
      }
      const seg = this.composing ? this.t9PendingSegment() : "";
      const sig = this.composing && seg ? `syl:${seg}` : "sym";
      if (sig === this.t9SideSig) return;
      this.t9SideSig = sig;
      strip.replaceChildren();
      if (sig === "sym") {
        T9_SIDE_CHARS.forEach((char) => strip.append(this.t9SideCell(char)));
        return;
      }
      const { full, pre } = this.t9SegmentSyllables(seg);
      full.forEach((syllable) => {
        const cell = this.t9SideCell(
          syllable,
          () => this.t9PickSyllable(syllable, seg)
        );
        cell.classList.add("t9-syl-full");
        strip.append(cell);
      });
      pre.forEach((initial) => {
        const cell = this.t9SideCell(initial, () => {
        });
        cell.classList.add("t9-syl-pre");
        strip.append(cell);
      });
    }
    t9SideCell(label, action) {
      const cell = document.createElement("button");
      cell.className = "t9-side-cell";
      cell.textContent = label;
      cell.addEventListener("click", action || (() => this.sendSymbol(label)));
      return cell;
    }
    /** 点选音节：把未完成段重写为「选中音节 + 段内剩余」。混合串由
     * 引擎音节图原生切分（BridgeContract 对 T9 放行 2-9），复用双拼
     * 变体的原子 setComposition 通道。段前的已确认部分（含回显空格）
     * 原样保留。 */
    t9PickSyllable(syllable, seg) {
      if (this.variantReplaying) return;
      const raw = (this.lastRawInput || "").replace(/ /g, "");
      const head = raw.slice(0, raw.length - seg.length);
      this._t9ConfirmedText = head + syllable;
      this.t9ConfirmedLen = this._t9ConfirmedText.length;
      this.switchToVariant(this._t9ConfirmedText + seg.slice(syllable.length));
    }
    /** preedit 观感：字母段与数字段之间插窄空格（64426 → ni·426 观感），
     * 只改显示——lastRawInput 仍是无空格混合串。 */
    t9PreeditLabel(raw) {
      return (raw || "").replace(/([a-z]+)([2-9])/g, "$1\u202F$2");
    }
    /** 1 键（点按/长按）：候选条展开西文/技术符号行（sendSymbol 直
     * 上屏）。长按（chrome=true）额外收起工具栏图标，仅保留最右的
     * × 供取消本次符号行——取消后工具栏原样恢复。 */
    /** 1 键符号行（用户定稿：单击即开）：候选栏展开西文/技术符号行，
     * 工具栏快捷按钮全部让位（含 mic），仅保留最右 × 供取消。点选
     * 符号或 × 都会关闭符号行并复原工具栏。语音进行中不开（mic 是
     * 停止入口）。 */
    t9SymbolBar() {
      if (this.composing || this.voiceState !== "idle") return;
      this.t9SymBar = true;
      this.t9BarChrome = true;
      this.setToolbarYield(true);
      this.renderT9SymbolBar();
    }
    /** 工具栏让位开关（T9 符号行与中文联想共用）：整条语义——上栏
     * 的所有工具（含动态开关工具与 mic）全部收起，仅留 ×。不得逐 id
     * 枚举：动态工具曾被漏掉，联想让位时还挂着半条工具栏（真机翻
     * 车）。固定 chrome（setup）不在 TOOL_CATALOG，单列。 */
    setToolbarYield(active) {
      this.toolbarYield = active;
      ["setupButton", ...Object.values(TOOL_CATALOG)].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = active;
      });
      const clear = document.getElementById("composeClear");
      if (clear) clear.hidden = !active;
    }
    /** 撤掉符号行 chrome：工具栏图标复位、× 隐藏。联想等引擎事件
     * 也会走这条路（onAssoc 直调 renderCandidates，不经过
     * updateComposing——不恢复的话工具栏会一直空着，codex round-4
     * P2-3）；组合态例外，可见性由 updateComposing 统一管。 */
    t9RestoreBarChrome(composing) {
      this.t9SymBar = false;
      this.t9BarChrome = false;
      if (composing) return;
      this.setToolbarYield(false);
    }
    t9CloseSymbolBar() {
      this.t9RestoreBarChrome(false);
      this.renderCandidates(this.lastEngineState || {});
    }
    renderT9SymbolBar() {
      const bar = document.getElementById("candidates");
      bar.replaceChildren();
      T9_BAR_SYMBOLS.forEach((symbol) => {
        const button = document.createElement("button");
        button.className = "candidate";
        button.textContent = symbol;
        button.addEventListener("click", () => {
          this.sendSymbol(symbol);
          this.t9CloseSymbolBar();
        });
        button.addEventListener("mousedown", (event) => event.preventDefault());
        bar.append(button);
      });
    }
    cnEnKey() {
      const button = document.createElement("button");
      button.className = "kb-key kb-special kb-wide-1_15";
      button.dataset.role = "cnEn";
      button.id = "modeToggle";
      button.dataset.lp = "mode-menu";
      button.setAttribute("aria-label", t("\u5207\u6362\u952E\u76D8"));
      const main = document.createElement("span");
      main.className = "cn-main";
      const sub = document.createElement("span");
      sub.className = "cn-sub";
      button.append(main, sub);
      button.addEventListener("click", () => {
        if (button._suppressClick) {
          button._suppressClick = false;
          return;
        }
        this.toggleChineseEnglish();
      });
      this.bindTouch(button);
      return button;
    }
    /** 回车键业务动作（软键面 click 与硬件键盘 hwKey 同一入口，#H）：
     * T9/笔画组合中=选池头候选，其余走 Native.enter。提取自原
     * click 回调，行为零变化。 */
    enterAction(hwSeq, hwGen) {
      if ((this.mode === "t9" || this.mode === "stroke") && this.composing) {
        const candidate = (this.expandCandidates || []).find((item) => !String(item.id).startsWith("alt:"));
        if (candidate) {
          this.choosePoolCandidate(candidate, hwSeq, hwGen);
          return;
        }
      }
      this.call(() => hwSeq && typeof Native.hwEnter === "function" ? Native.hwEnter(hwSeq, hwGen, this.token) : Native.enter(this.token));
    }
    enterKey(longPress = "repeat") {
      const button = document.createElement("button");
      button.className = "kb-key kb-special kb-wide-2_25";
      button.dataset.role = "enter";
      button.id = "enterKey";
      if (longPress) button.dataset.lp = longPress;
      button.setAttribute("aria-label", this.composing ? t("\u786E\u5B9A") : t("\u6362\u884C"));
      button.textContent = this.composing ? t("\u786E\u5B9A") : t("\u6362\u884C");
      button.addEventListener("click", () => this.enterAction());
      this.bindTouch(button);
      return button;
    }
    /** 手写接入 quick-pair（round-5）：非手写模式记下「上次使用的
     * 键盘」；进手写时若配对还是出厂默认（拼/En，用户从未定制过），
     * 迁成 手写↔该键盘——切换键在两个方向都立即可用（拼 ⇄ 手）。
     * 定制过的对不动（含用户特意选回 拼/En 的情形），改对走
     * 模式菜单/设置页的 快捷切换 入口。 */
    adoptQuickPairForHandwriting(nextMode) {
      if (nextMode !== "handwriting") {
        this.lastKbMode = nextMode;
        try {
          localStorage.setItem("feelime_last_kb_mode", nextMode);
        } catch (_) {
        }
      }
    }
    /** The saved pair alone determines the shortcut. A temporary mode
     * selected from the long-press menu returns to the first pair entry.
     * While a degrade fallback serves, the short press retries the
     * FAILED mode instead of toggling the pair (mode-fallback §2.3). */
    /** #H 快捷切换目标（codex 双拼事故二轮定案）：软键盘切换键、
     *  硬键 Ctrl+空格/Shift 单按、底行目标小字共用同一解析——
     *  follow：当前键盘↔英文（英文侧回 quickReturnMode 记忆）；
     *  fixed：固定配对翻转（配对外模式回 pair[0]，存量约定）。
     *  降级重试优先级保留在上层调用处。 */
    quickSwitchTarget() {
      if ((this.quickSwitchPolicy || "fixed") === "fixed") {
        const pair = this.quickPair;
        return this.mode === pair[0] ? pair[1] : pair[0];
      }
      if (this.mode === "direct") {
        return MODES[this.quickReturnMode] ? this.quickReturnMode : "pinyin";
      }
      return "direct";
    }
    toggleChineseEnglish() {
      if (this.cnEnGuard && this.composing) {
        this.showToast(t("\u62FC\u97F3\u7EC4\u5408\u4E2D\uFF0C\u5148\u4E0A\u5C4F\u518D\u5207\u6362"));
        return;
      }
      if (this.degrade && this.degrade.active && this.degrade.failedMode) {
        this.call(() => Native.selectMode(this.degrade.failedMode, this.token));
        return;
      }
      const target = this.quickSwitchTarget();
      const targetConfig = MODES[target];
      if (targetConfig && targetConfig.strictReady && this.engineReady[target] !== true) {
        this.showToast(t("\u8BE5\u952E\u76D8\u8FD8\u5728\u51C6\u5907\u4E2D"));
        return;
      }
      this.call(() => Native.selectMode(target, this.token));
    }
    row(indent = false) {
      const row = document.createElement("div");
      row.className = "kb-row" + (indent ? " kb-indent" : "");
      return row;
    }
    letterKey(key) {
      const button = document.createElement("button");
      button.className = "kb-key kb-letter";
      button.dataset.key = key;
      button.dataset.lp = "popup";
      button.innerHTML = '<span class="kb-alt"></span><span class="kb-main"></span>';
      button.querySelector(".kb-alt").textContent = this.keyAltHint(key);
      button.addEventListener("click", () => this.sendKey(key));
      this.bindTouch(button);
      return button;
    }
    functionKey(label, action, classes = "", longPress = "") {
      const button = document.createElement("button");
      button.className = "kb-key " + classes;
      button.textContent = label;
      if (longPress) button.dataset.lp = longPress;
      button.addEventListener("click", action);
      this.bindTouch(button);
      return button;
    }
    // icon-bearing special key with a stable data-role for
    // structure-based assertions (text content is empty for icon keys).
    specialKey(role, icon, action, classes = "", longPress = "") {
      const button = document.createElement("button");
      button.className = "kb-key " + classes;
      button.dataset.role = role;
      if (typeof icon === "string") {
        button.textContent = icon;
      } else {
        button.append(icon.cloneNode(true));
      }
      if (longPress) button.dataset.lp = longPress;
      button.addEventListener("click", action);
      this.bindTouch(button);
      return button;
    }
    // ---- #H 硬件键盘：hwKey 串行队列 + revision 屏障（design
    // hardware-keyboard.md §4.1）。物理键由 native 全认领后 evaluate
    // 注入（window.Feelime.hwKey），全部走软键盘同一批 action。----
    /** #H 会话换代通知（native onStartInput 驱动，codex 复审 P1-1）：
     *  编辑器切换的瞬间对齐 gen 并作废在途 hw 动作——不等下一次
     *  hwKey/hello（间隔期内旧编辑器的两步标点续步会按旧 gen 比较
     *  成功，把标点补进新编辑器）。 */
    hwSessionReset(gen) {
      if (gen !== void 0 && gen !== null) this.hwGen = Number(gen) || 0;
      this.hwQueue.length = 0;
      this.hwWaitSeq = 0;
      if (this.pendingPunct && this.pendingPunct.gen !== void 0) {
        this.pendingPunct = null;
      }
    }
    hwEnqueue(kind, value, gen) {
      if (gen !== void 0 && gen !== null) this.hwGen = gen;
      const needsState = kind !== "char";
      this.hwQueue.push({
        kind,
        value,
        needsState,
        at: Date.now(),
        gen: this.hwGen
      });
      this.hwDrain();
    }
    hwDrain() {
      if (this.hwDraining) return;
      const job = this.hwQueue[0];
      if (!job) return;
      if (job.gen !== void 0 && job.gen !== this.hwGen) {
        if (window.__diagHwStaleGen != null) window.__diagHwStaleGen++;
        this.hwQueue.shift();
        return this.hwDrain();
      }
      if (this.pendingPunct) {
        this.hwArmDrainTimer(job);
        return;
      }
      const stateDep = job.needsState || job.kind === "char" && (job.value === 44 || job.value === 46) && this.chineseSymMode();
      if (stateDep && (this.hwDoneSeq || 0) < (this.hwWaitSeq || 0)) {
        if (Date.now() - job.at > 120) {
          if (window.__diagHwTimeouts != null) window.__diagHwTimeouts++;
        } else {
          this.hwArmDrainTimer(job);
          return;
        }
      }
      this.hwQueue.shift();
      this.hwDraining = true;
      try {
        this.hwRun(job);
      } finally {
        this.hwDraining = false;
      }
      this.hwDrain();
    }
    hwArmDrainTimer(job) {
      if (this.hwDrainTimer) return;
      this.hwDrainTimer = setTimeout(() => {
        this.hwDrainTimer = null;
        this.hwDrain();
      }, Math.max(10, 120 - (Date.now() - job.at)));
    }
    hwRun(job) {
      if (job.kind === "space" || job.kind === "enter" || job.kind === "backspace") {
        const seq2 = ++this.hwSeqCounter;
        if (job.kind === "space") this.spaceAction(seq2, this.hwGen);
        else if (job.kind === "enter") this.enterAction(seq2, this.hwGen);
        else this.backspaceAction(seq2, this.hwGen);
        this.hwWaitSeq = seq2;
        return;
      }
      if (job.kind !== "char") return;
      const ch = String.fromCodePoint(job.value);
      if ((ch === "," || ch === ".") && this.chineseSymMode()) {
        const pseq = ++this.hwSeqCounter;
        this.hwWaitSeq = pseq;
        this.enginePunct(ch, pseq, this.hwGen);
        return;
      }
      const seq = ++this.hwSeqCounter;
      this.hwWaitSeq = seq;
      this.call(() => typeof Native.hwKeyChar === "function" ? Native.hwKeyChar(ch, seq, this.hwGen, this.token) : Native.key(ch, this.token));
    }
    /** 空格键业务动作（软键面 click 与硬件键盘 hwKey 同一入口，
     * #H 硬件键盘支持）：手写候选确认 → 组合中按 id 选池头 →
     * 无组合直发 space。提取自原 click 回调，行为零变化
     * （软键盘既有 mock 全量回归即证明）。 */
    spaceAction(hwSeq, hwGen) {
      if (this.mode === "handwriting" && (this.inkCandidates || []).length) {
        this.commitInkCandidate(this.inkCandidates[0]);
        return;
      }
      const ordered = this.englishOrderedPool(this.expandCandidates || []);
      const candidate = ordered.find((item) => !String(item.id).startsWith("alt:"));
      if (this.composing && candidate) {
        this.choosePoolCandidate(candidate, hwSeq, hwGen);
        return;
      }
      this.call(() => hwSeq && typeof Native.hwSpace === "function" ? Native.hwSpace(hwSeq, hwGen, this.token) : Native.space(this.token));
    }
    spaceKey() {
      const button = document.createElement("button");
      button.className = "kb-key kb-wide-4";
      button.id = "spaceKey";
      if (this.spaceHoldTap !== "none") button.dataset.lp = "space-hold";
      button.setAttribute("aria-label", t("\u7A7A\u683C"));
      if (this.spaceHoldTap === "voice") {
        const mic = document.createElementNS(SVG_NS, "svg");
        mic.setAttribute("viewBox", "0 0 24 24");
        mic.setAttribute("class", "space-mic");
        mic.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", ICON_PATHS.mic);
        path.setAttribute("fill", "currentColor");
        mic.append(path);
        button.append(mic);
      } else if (this.spaceHoldText) {
        const label = document.createElement("span");
        label.className = "space-face";
        label.textContent = this.spaceHoldText;
        button.append(label);
      }
      button.addEventListener("click", () => this.spaceAction());
      this.bindSpaceHold(button);
      this.bindTouch(button, { skipClick: true });
      return button;
    }
    bindSpaceHold(button) {
      const SLIDE_CANCEL_PX = 110;
      let startY = 0;
      let slideProgress = 0;
      let holdConsumed = false;
      button._cancelSpaceHold = () => {
        clearTimeout(this.spaceHoldTimer);
        if (this.voiceHold) {
          this.voiceHold = false;
          this.resetSlideCancel();
          this.requestVoiceStop(true);
        }
      };
      const start = /* @__PURE__ */ __name((event) => {
        event.preventDefault();
        button.classList.add("active-touch");
        startY = event.touches[0].clientY;
        slideProgress = 0;
        holdConsumed = false;
        if (!this.ready || !this.token || this.spaceHoldTap === "none") return;
        this.spaceHoldTimer = setTimeout(() => {
          const act = this.spaceHoldTap;
          if (act === "voice") {
            this.voiceHold = true;
            this.voiceSession = "space-hold";
            Native.startVoice(this.token);
          } else {
            holdConsumed = true;
            this.runCustomCell({ tap: act });
          }
        }, 350);
      }, "start");
      const move = /* @__PURE__ */ __name((event) => {
        if (!this.voiceHold) return;
        const dy = startY - event.touches[0].clientY;
        slideProgress = Math.max(0, Math.min(1, dy / SLIDE_CANCEL_PX));
        this.updateSlideCancel(slideProgress);
      }, "move");
      const finish = /* @__PURE__ */ __name((cancelled) => {
        if (!this.pressedKeys.has(button)) return;
        button.classList.remove("active-touch");
        clearTimeout(this.spaceHoldTimer);
        const armed = slideProgress >= 1;
        slideProgress = 0;
        this.resetSlideCancel();
        if (this.voiceHold) {
          this.voiceHold = false;
          this.requestVoiceStop(armed ? true : cancelled);
          if (armed) this.showToast(t("\u5DF2\u64A4\u9500\u672C\u6B21\u542C\u5199"));
        } else if (!cancelled && !holdConsumed) {
          if (!this.swiping) button.click();
        }
      }, "finish");
      button.addEventListener("touchstart", start, { passive: false });
      button.addEventListener("touchmove", move, { passive: true });
      button.addEventListener("touchend", () => finish(false));
      button.addEventListener("touchcancel", () => finish(true));
    }
    /** 上滑撤销的进度动画：浮层变小变透明；下方 toast 胶囊
     * 「上滑撤销」字体和背景同步放大（transform scale），过阈值 arm。 */
    updateSlideCancel(progress) {
      const card = document.getElementById("voiceCard");
      const hint = document.getElementById("voiceSlideHint");
      if (!card || !hint) return;
      card.style.transform = `translate(-50%, -50%) scale(${(1 - 0.22 * progress).toFixed(3)})`;
      card.style.opacity = (1 - 0.55 * progress).toFixed(3);
      hint.style.transform = `translateX(-50%) scale(${(0.85 + 0.45 * progress).toFixed(3)})`;
      hint.classList.toggle("arm", progress >= 1);
    }
    resetSlideCancel() {
      const card = document.getElementById("voiceCard");
      const hint = document.getElementById("voiceSlideHint");
      if (card) {
        card.style.transform = "";
        card.style.opacity = "";
      }
      if (hint) {
        hint.style.transform = "";
        hint.classList.remove("arm");
      }
    }
    /** 按键声音/触感（issue #5 问题 2）：开关在设置页、默认全关，
     * 原生按偏好决定发声/振动。走 call() 门闸：桥未就绪不发；
     * 旧 APK 无此通道时 typeof 守卫静默跳过。 */
    nativeKeyFeedback() {
      this.call(() => {
        if (typeof Native.keyFeedback === "function") {
          Native.keyFeedback(this.token);
        }
      });
    }
    /** 按键气泡取字（issue #30-1）：qwerty 字母读键面主标（随
     *  shift/大小写更新），其余按 data-key 直取（符号格/九宫格数字）；
     *  空格与功能键（无 data-key 无主标）不出气泡；中文态逗/句号
     *  沿用弹层的全角显示映射。 */
    bubbleGlyph(button) {
      const main = button.querySelector(".kb-main");
      if (main && main.textContent) return main.textContent;
      const key = button.dataset.key;
      if (!key || key === " ") return null;
      if (this.isChineseMode() && (key === "," || key === ".")) {
        return key === "," ? "\uFF0C" : "\u3002";
      }
      return key.length <= 2 ? key : null;
    }
    showKeyBubble(button) {
      const glyph = this.bubbleGlyph(button);
      if (!glyph) return;
      const bubble = document.getElementById("keyBubble");
      if (!bubble) return;
      this.bubbleButton = button;
      bubble.textContent = glyph;
      bubble.hidden = false;
      const rect = button.getBoundingClientRect();
      const left = Math.max(4, Math.min(
        innerWidth - bubble.offsetWidth - 4,
        rect.left + rect.width / 2 - bubble.offsetWidth / 2
      ));
      bubble.style.left = left + "px";
      bubble.style.top = Math.max(2, rect.top - bubble.offsetHeight - 6) + "px";
    }
    /** flick 判定后把气泡换成实际将上屏的字符（键位不动，仅换文字）。 */
    updateKeyBubble(glyph) {
      const bubble = document.getElementById("keyBubble");
      if (!bubble || bubble.hidden) return;
      bubble.textContent = glyph;
      this.scheduleHideBubble();
    }
    /** 松手后气泡短暂停留（验收 2026-09-24：立刻消失看不清），停留
     *  时长 hello.bubbleLinger（0=立即，默认 400ms）；新按下或 flick
     *  换字都会取消在途的隐藏调度。 */
    scheduleHideBubble() {
      if (this.bubbleHideTimer) {
        clearTimeout(this.bubbleHideTimer);
        this.bubbleHideTimer = 0;
      }
      if (!this.bubbleLinger) {
        this.hideKeyBubble();
        return;
      }
      this.bubbleHideTimer = setTimeout(() => {
        this.bubbleHideTimer = 0;
        this.hideKeyBubble();
      }, this.bubbleLinger);
    }
    hideKeyBubble() {
      this.bubbleButton = null;
      if (this.bubbleHideTimer) {
        clearTimeout(this.bubbleHideTimer);
        this.bubbleHideTimer = 0;
      }
      const bubble = document.getElementById("keyBubble");
      if (bubble && !bubble.hidden) bubble.hidden = true;
    }
    /** design §10.6: reconcile pending holds against the live snapshot too.
     * Changed end/cancel contacts still get their normal finish path.
     * A newly started ID is a new session, even if an old end was lost. */
    reconcileTouchSnapshot(event, starting = false) {
      const live = new Set(Array.from(event.touches || [], (t2) => t2.identifier));
      const changed = new Set(Array.from(event.changedTouches || [], (t2) => t2.identifier));
      const ending = event.type === "touchend" || event.type === "touchcancel";
      const missing = Array.from(this.pressById.values()).filter((press) => press.id !== void 0 && (starting && changed.has(press.id) || !live.has(press.id) && !(ending && changed.has(press.id))));
      if (!missing.length) return;
      this.traceTouch(starting && missing.some((p) => changed.has(p.id)) ? "fault-id-reuse" : "fault-missing-contact", event);
      for (const press of missing) this.popupRetiredIds.add(press.id);
      this.cancelTouchEvent({
        target: null,
        touches: event.touches,
        changedTouches: missing.map((p) => ({ identifier: p.id })),
        reason: "snapshot-missing"
      });
    }
    /** Contact metadata only: no key glyphs, candidates or editor text. */
    traceTouch(kind, event) {
      var _a, _b, _c, _d;
      if (!this.touchDiagnostics || !this.token || typeof Native.diagEvent !== "function") return;
      const targetId = /* @__PURE__ */ __name((target) => {
        var _a2;
        if (!target) return "-";
        const key = ((_a2 = target.closest) == null ? void 0 : _a2.call(target, ".kb-key")) || target;
        if (!this._touchTargets) this._touchTargets = /* @__PURE__ */ new WeakMap();
        if (!this._touchTargets.has(key)) {
          this._touchTargets.set(key, this._touchTargetSeq = (this._touchTargetSeq || 0) + 1);
        }
        return this._touchTargets.get(key);
      }, "targetId");
      const points = /* @__PURE__ */ __name((list) => Array.from(list || []).slice(0, 6).map((t2) => `${t2.identifier}:${Math.round(t2.clientX || 0)}:${Math.round(t2.clientY || 0)}`).join(","), "points");
      const popup = this.popup;
      const dom = document.getElementById("keyPopup");
      const line = `${kind.startsWith("fault-") ? "touchFault" : "touchTrace"} n=${this._touchTraceSeq = (this._touchTraceSeq || 0) + 1} t=${Date.now()} e=${kind} ts=${Math.round((event == null ? void 0 : event.timeStamp) || 0)} changed=${points(event == null ? void 0 : event.changedTouches)} live=${points(event == null ? void 0 : event.touches)} ptr=${(_a = event == null ? void 0 : event.pointerId) != null ? _a : "-"}/${(event == null ? void 0 : event.pointerType) || "-"} target=${targetId(event == null ? void 0 : event.target)} ledger=${Array.from(this.pressById.keys()).slice(0, 12).join(",")} bindings=${Array.from(this.pressById.values()).slice(0, 12).map((p) => `${p.id}:${targetId(p.button)}`).join(",")} origin=${(_c = (_b = this.touchOrigin) == null ? void 0 : _b.id) != null ? _c : "-"} press=${this.pressedKeys.size} owner=${(_d = popup == null ? void 0 : popup.fingerId) != null ? _d : "-"} age=${popup ? Date.now() - popup.openedAt : 0} dom=${(dom == null ? void 0 : dom.classList.contains("open")) ? 1 : 0} swipe=${this.swiping ? 1 : 0}`;
      try {
        Native.diagEvent(line, this.token);
      } catch (_) {
      }
    }
    bindTouch(button, options = {}) {
      if (!button) return;
      if (button.dataset.bound) return;
      button.dataset.bound = "1";
      let holdTimer = 0;
      let repeatTimer = 0;
      let longFired = false;
      let press = null;
      const clear = /* @__PURE__ */ __name(() => {
        var _a;
        if (holdTimer || repeatTimer) this.traceTouch("timer-clear/" + ((_a = press == null ? void 0 : press.id) != null ? _a : "?"));
        clearTimeout(holdTimer);
        clearInterval(repeatTimer);
        holdTimer = repeatTimer = 0;
      }, "clear");
      button._cancelRepeat = clear;
      button._cancelPress = () => {
        clear();
        button._suppressClick = false;
        if (button._cancelSpaceHold) button._cancelSpaceHold();
      };
      button.addEventListener("touchstart", (event) => {
        if (this.floatDragSession || this.floatResizeSession) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        clear();
        this.pressedKeys.add(button);
        button.classList.add("active-touch");
        this.nativeKeyFeedback();
        if (this.keyBubble && !this.popup) this.showKeyBubble(button);
        else if (this.bubbleHideTimer) this.hideKeyBubble();
        longFired = false;
        const touch = event.changedTouches[0];
        press = {
          x: touch.clientX,
          y: touch.clientY,
          id: touch.identifier,
          button
        };
        this.pressById.set(press.id, press);
        this.touchEpoch += 1;
        this.traceTouch("press-start/" + press.id, event);
        this.popupRetiredIds.delete(press.id);
        if (this.touchOrigin && !Array.from(event.touches).some(
          (item) => item.identifier === this.touchOrigin.id
        )) {
          this.touchOrigin = null;
        }
        if (!this.touchOrigin) {
          this.touchOrigin = {
            x: press.x,
            y: press.y,
            id: press.id,
            button
          };
        }
        if (button.dataset.lp === "repeat") {
          holdTimer = setTimeout(() => {
            repeatTimer = setInterval(() => button.click(), 75);
          }, this.holdMs + 40);
        } else if (button.dataset.lp === "popup" && button.dataset.key) {
          holdTimer = setTimeout(() => {
            var _a, _b;
            this.traceTouch("popup-timer-fire/" + ((_a = press == null ? void 0 : press.id) != null ? _a : "?"));
            if (this.swiping) return;
            const ownerPress = this.touchOrigin && this.touchOrigin.button === button ? this.pressById.get(this.touchOrigin.id) : null;
            const base = ((ownerPress == null ? void 0 : ownerPress.button) === button ? ownerPress : null) || (press && ((_b = this.pressById.get(press.id)) == null ? void 0 : _b.button) === button ? this.pressById.get(press.id) : null) || Array.from(this.pressById.values()).find((p) => p.button === button);
            if (!base) return;
            this.traceTouch("popup-base/" + base.id);
            if (this.mode === "t9") {
              this.openT9HoldPopup(button, base);
            } else if (this.mode === "stroke") {
              this.openStrokeHoldPopup(button, base);
            } else this.openPopup(button, base);
          }, this.holdMs);
        } else if (button.dataset.lp === "lock") {
          holdTimer = setTimeout(() => {
            if (!this.swiping) {
              longFired = true;
              this.lockShift();
            }
          }, this.holdMs);
        } else if (button.dataset.lp === "mode-menu") {
          holdTimer = setTimeout(() => {
            longFired = true;
            this.toggleModeMenu();
          }, this.holdMs);
        } else if (button.dataset.lp === "numpad") {
          holdTimer = setTimeout(() => {
            if (!this.swiping) {
              longFired = true;
              this.showNumpad();
            }
          }, this.holdMs);
        }
      }, { passive: false });
      button.addEventListener("touchmove", (event) => {
        const touch = press && Array.from(event.touches).find(
          (item) => item.identifier === press.id
        ) || event.touches[0];
        if (!touch) return;
        const at = document.elementFromPoint && document.elementFromPoint(touch.clientX, touch.clientY);
        if (at !== button && !(at && button.contains(at))) clear();
      }, { passive: true });
      button.addEventListener("touchend", (event) => {
        var _a;
        event.preventDefault();
        this.traceTouch("press-end/" + ((_a = press == null ? void 0 : press.id) != null ? _a : "?"), event);
        const ownsPopup = this.finishPopupTouch(event, false);
        const ownerPress = this.popup ? this.pressById.get(this.popup.fingerId) : null;
        const sameKeyNonOwner = !!(this.popup && !ownsPopup && ownerPress && ownerPress.button === button);
        for (const item of event.changedTouches || []) {
          this.pressById.delete(item.identifier);
        }
        if (sameKeyNonOwner) return;
        if (!this.pressedKeys.has(button) && !ownsPopup) {
          this.scheduleHideBubble();
          return;
        }
        this.pressedKeys.delete(button);
        button.classList.remove("active-touch");
        this.scheduleHideBubble();
        clear();
        if (ownsPopup) return;
        if ([...event.changedTouches || []].some(
          (item) => this.popupRetiredIds.has(item.identifier)
        )) return;
        if (this.popup) {
          if (!longFired && !this.swiping && !options.skipClick) {
            button.click();
          }
        } else if (options.skipClick) {
        } else if (longFired) this._diagNoClick.long += 1;
        else if (this.swiping) this._diagNoClick.swipe += 1;
        else if (this.popup) this._diagNoClick.pop += 1;
        else button.click();
      }, { passive: false });
    }
    /** 页面级取消出口：事件即使没经过原键，也按手指账本收尾。 */
    cancelTouchEvent(event) {
      this.traceTouch("press-cancel/" + (event.reason || "event"), event);
      const ids = new Set(Array.from(event.changedTouches || [], (t2) => t2.identifier));
      const buttons = /* @__PURE__ */ new Set();
      for (const id of ids) {
        const press = this.pressById.get(id);
        if (press) buttons.add(press.button);
        this.pressById.delete(id);
      }
      this.finishPopupTouch(event, true);
      for (const button of buttons) {
        if (Array.from(this.pressById.values()).some((p) => p.button === button)) continue;
        this.pressedKeys.delete(button);
        button.classList.remove("active-touch");
        if (button._cancelPress) button._cancelPress();
        clearTimeout(button._comboTimer);
        if (this.bubbleButton === button) this.hideKeyBubble();
      }
      const target = event.target;
      const tool = target && target.closest && target.closest(".tool");
      if (tool) {
        clearTimeout(tool._editHold);
        tool._editHoldPos = null;
      }
      const bar = target && target.closest && target.closest("#candidateBar");
      if (bar) {
        clearTimeout(bar._barHold);
        bar._barHoldPos = null;
      }
      if (this.finishTouchGesture) this.finishTouchGesture(event, true);
    }
    cancelTouches() {
      this.traceTouch("cancel-all");
      this.inkCancelTouch();
      this.cancelFloatGestures();
      this.cancelCustomChain();
      this.hideKeyBubble();
      for (const button of this.pressedKeys) {
        button.classList.remove("active-touch");
        if (button._cancelPress) button._cancelPress();
        clearTimeout(button._comboTimer);
      }
      this.pressedKeys.clear();
      if (this.popup) this.closePopup(true);
      this.touchOrigin = null;
      this.pressById.clear();
      this.popupRetiredIds.clear();
      const tbar = document.getElementById("candidateBar");
      if (tbar) {
        clearTimeout(tbar._barHold);
        tbar._barHoldPos = null;
        tbar.querySelectorAll(".tool").forEach((el) => {
          clearTimeout(el._editHold);
          el._editHoldPos = null;
        });
      }
      this.scrubBase = null;
      this.scrubSteps = 0;
      if (this.delBase !== null) {
        this.call(() => Native.backspaceGestureEnd(this.token));
      }
      this.delBase = null;
      this.delSteps = 0;
      this.delNet = 0;
      this.bsVertical = 0;
      this.swiping = false;
    }
    setupFlick(root) {
      const threshold = 38;
      root.addEventListener("touchmove", (event) => {
        if (this.popup) {
          event.preventDefault();
          const list = Array.from(event.touches);
          const own = list.find((item) => item.identifier === this.popup.fingerId);
          if (!own && this.popup.fingerId !== void 0) {
            this.closePopup(true);
            return;
          }
          if (own && Array.from(event.changedTouches || []).some(
            (item) => item.identifier === this.popup.fingerId
          )) {
            this.armPopupStallWatchdog();
          }
          this.movePopup(own || list[0]);
          return;
        }
        if (event.target && event.target.closest && (event.target.closest("#expandLayer") || event.target.closest("#candidates"))) return;
        if (!this.touchOrigin) return;
        let touch = Array.from(event.touches).find((item) => item.identifier === this.touchOrigin.id);
        if (!touch) return;
        let dx = touch.clientX - this.touchOrigin.x;
        let dy = touch.clientY - this.touchOrigin.y;
        let originButton = this.touchOrigin.button;
        let button = originButton.closest(".kb-key[data-key]");
        if (!this.swiping) {
          if (Math.hypot(dx, dy) < threshold) {
            const alt = Array.from(event.touches).find((item) => {
              if (item.identifier === this.touchOrigin.id) return false;
              const p = this.pressById.get(item.identifier);
              return !!p && Math.hypot(
                item.clientX - p.x,
                item.clientY - p.y
              ) >= threshold;
            });
            if (!alt) return;
            const heir = this.pressById.get(alt.identifier);
            this.touchOrigin = {
              x: heir.x,
              y: heir.y,
              id: heir.id,
              button: heir.button
            };
            touch = alt;
            dx = alt.clientX - heir.x;
            dy = alt.clientY - heir.y;
            originButton = heir.button;
            button = originButton.closest(".kb-key[data-key]");
          }
          this.swiping = true;
          clearTimeout(this.spaceHoldTimer);
          const bsKey = originButton.closest('.kb-key[data-role="backspace"]');
          if (bsKey) {
            if (bsKey._cancelRepeat) bsKey._cancelRepeat();
            if (bsKey.classList.contains("ink-key")) return;
            if (!bsKey.closest("#qwertyLayer")) return;
            if (this.composing) {
              if (Math.abs(dx) > Math.abs(dy) && dx < 0) this.clearComposing();
              return;
            }
            if (this.editorSensitive) return;
            if (Math.abs(dx) > Math.abs(dy)) {
              if (dx < 0 && this.deleteGestureSupported()) {
                this.engageDeleteScrub(bsKey, dx, dy, threshold);
              }
              return;
            }
            if (this.deleteGestureSupported()) {
              this.bsVertical = dy < 0 ? -1 : 1;
            }
            return;
          }
          if ((this.mode === "t9" || this.mode === "stroke") && this.t9Flick(
            originButton,
            dx,
            dy,
            touch.clientX,
            touch.identifier
          )) return;
          if (Math.abs(dy) >= Math.abs(dx) && button && button.dataset.key) {
            if (button.id === "spaceKey") return;
            const key = button.dataset.key;
            {
              const table = this.langKeysTable();
              const cell = table && table[key];
              const raw = cell ? dy < 0 ? cell.up : cell.down : void 0;
              if (raw !== void 0) {
                if (raw) this.runTapDsl(raw);
                return;
              }
            }
            let value;
            const altOnUp = !this.flickSwap;
            if (key === "." && this.chineseSymMode()) {
              value = dy < 0 === altOnUp ? "." : ",";
            } else {
              value = dy < 0 === altOnUp ? this.altCandidates(key)[0] : key.toUpperCase();
            }
            if (value) {
              if (this.keyBubble && !this.popup) this.updateKeyBubble(value);
              if (this.chineseSymMode() && key === ".") {
                this.enginePunct(value);
              } else if (this.chineseSymMode()) {
                this.sendSymbol(value);
              } else {
                this.sendText(value);
              }
              this.showFlick(button, dy);
            }
          } else if (Math.abs(dx) > Math.abs(dy) && button && !this.composing && !this.voiceHold) {
            const unit = SCRUB_UNIT_BASE_PX / this.scrubSpeed;
            const direction = dx > 0 ? 1 : -1;
            const distance = Math.hypot(dx, dy) || threshold;
            const crossingX = this.touchOrigin.x + dx / distance * threshold;
            this.scrubBase = crossingX - direction * unit;
            this.scrubSteps = direction;
            this.call(() => Native.moveCursor(direction, this.token));
          }
        } else if (this.scrubBase !== null) {
          this.applyScrub(touch.clientX);
        } else if (this.delBase !== null) {
          this.applyDeleteScrub(touch.clientX);
        }
      }, { passive: false, capture: true });
      const finish = /* @__PURE__ */ __name((event, cancelled) => {
        const origin = this.touchOrigin;
        if (origin && !Array.from(event.changedTouches || []).some(
          (touch) => touch.identifier === origin.id
        )) return;
        if (!cancelled && origin && this.scrubBase !== null) {
          const touch = Array.from(event.changedTouches || []).find(
            (item) => item.identifier === origin.id
          );
          if (touch) this.applyScrub(touch.clientX);
        }
        if (origin && this.delBase !== null) {
          if (!cancelled) {
            const touch = Array.from(event.changedTouches || []).find(
              (item) => item.identifier === origin.id
            );
            if (touch) this.applyDeleteScrub(touch.clientX);
          }
          this.delBase = null;
          this.delSteps = 0;
          this.delNet = 0;
          this.delRetry = false;
          this.call(() => Native.backspaceGestureEnd(this.token));
        }
        if (!cancelled && origin && this.bsVertical) {
          if (this.bsVertical < 0) {
            if (typeof Native.deleteBeforeCursor === "function") {
              this.call(() => Native.deleteBeforeCursor(this.token));
            } else if (typeof Native.clearEditorText === "function") {
              this.call(() => Native.clearEditorText(this.token));
            } else {
              this.call(() => Native.editorAction("selectAll", this.token));
              this.call(() => Native.backspace(this.token));
            }
          } else {
            if (typeof Native.undoDeleteBeforeCursor === "function") {
              this.call(() => Native.undoDeleteBeforeCursor(this.token));
            } else {
              this.call(() => Native.keyEvent(
                BS_UNDO_KEYCODE,
                CTRL_META_BITS.Ctrl,
                this.token
              ));
            }
          }
        }
        this.bsVertical = 0;
        this.touchOrigin = null;
        const rest = Array.from(event.touches || []);
        const heir = rest.find((item) => this.pressById.has(item.identifier));
        if (heir) {
          const next = this.pressById.get(heir.identifier);
          this.touchOrigin = {
            x: next.x,
            y: next.y,
            id: next.id,
            button: next.button
          };
        }
        this.scrubBase = null;
        this.scrubSteps = 0;
        setTimeout(() => {
          this.swiping = false;
        }, 0);
      }, "finish");
      root.addEventListener("touchend", (event) => finish(event, false), { capture: true });
      this.finishTouchGesture = finish;
    }
    /** Continuous scrub: crossing a unit boundary moves the caret by the
     * exact number of crossed steps, so fast drags jump multiple cells
     * and direction flips at the fixed threshold anchor automatically.
     * Unit scales with the user's speed setting: 36px per step at 1x down
     * to 7.2px at 5x (3x keeps the shipped 12px feel). */
    applyScrub(clientX) {
      const unit = SCRUB_UNIT_BASE_PX / this.scrubSpeed;
      const steps = Math.trunc((clientX - this.scrubBase) / unit);
      if (steps === this.scrubSteps) return;
      const delta = steps - this.scrubSteps;
      this.scrubSteps = steps;
      let remaining = delta;
      while (remaining) {
        const move = Math.max(-256, Math.min(256, remaining));
        this.call(() => Native.moveCursor(move, this.token));
        remaining -= move;
      }
    }
    /** #34 新桥能力探测：键盘可热更到旧 APK 上，四个手势桥缺任何
     * 一个就把整套手势降级为不启用（typeof 守卫，与 keyFeedback 的
     * 兼容模式同款；不进 REQUIRED_CAPABILITIES——那会让旧壳拒绝
     * 整个新键盘）。 */
    deleteGestureSupported() {
      return typeof Native.backspaceGestureBegin === "function" && typeof Native.backspaceN === "function" && typeof Native.backspaceRestoreOne === "function" && typeof Native.backspaceGestureEnd === "function";
    }
    /** #34 跟手删启动：锚点数学与空格 scrub 同源（在固定阈值跨越处
     * 定锚、首个跨越恰删一字）。步长也与空格 scrub 同源
     * （SCRUB_UNIT_BASE_PX / scrubSpeed，#59 验收反馈：键宽×0.6
     * ≈29px/字是空格 12px/字的 2.4 倍，跟手感明显迟钝；顺带让
     * 速度档位对退格同样生效）。begin 先行——native 侧恢复缓冲
     * 的光标前文本基线读取是异步的，越早开始越好。 */
    engageDeleteScrub(bsKey, dx, dy, threshold) {
      this.delUnit = SCRUB_UNIT_BASE_PX / this.scrubSpeed;
      const distance = Math.hypot(dx, dy) || threshold;
      const crossingX = this.touchOrigin.x + dx / distance * threshold;
      this.delBase = crossingX + this.delUnit;
      this.delSteps = -1;
      this.delNet = 1;
      this.delRetry = false;
      this.call(() => Native.backspaceGestureBegin(this.token));
      this.call(() => Native.backspaceN(1, this.token));
    }
    /** #34 跟手删连续段。净删除数是位置的函数（target = max(0,
     * -steps)）：左滑删、右滑把本会话已删的恢复回来、恢复完再右滑
     * 无操作——纯位置语义让「右滑抖动再回来」不会误删新字符。
     * 删除走批量桥（一次事件跨过的单位合一次调用，快速甩动不丢步，
     * 与 applyScrub 的批量理由相同；单次上限 16 与 native 的
     * MAX_BACKSPACE_GESTURE_UNITS 对齐）；恢复逐字弹回，凭
     * backspaceRestoreOne 的回执决定成败（见函数内注释）。 */
    applyDeleteScrub(clientX) {
      const steps = Math.trunc((clientX - this.delBase) / this.delUnit);
      if (steps === this.delSteps && !this.delRetry) return;
      this.delRetry = false;
      this.delSteps = steps;
      const target = Math.max(0, -steps);
      let delta = target - this.delNet;
      this.delNet = target;
      while (delta > 0) {
        const count = Math.min(16, delta);
        this.call(() => Native.backspaceN(count, this.token));
        delta -= count;
      }
      while (delta < 0) {
        const ok = this.call(() => Native.backspaceRestoreOne(this.token));
        if (ok === false) {
          this.delRetry = true;
          break;
        }
        delta += 1;
      }
      if (delta < 0) this.delNet = target - delta;
    }
    /** T9 手势仲裁（t9.md §3）。返回 true=已消费；false=落回通用
     * 分支（mic 的横滑 scrub 由通用代码处理——scrub 选择器认
     * .kb-key[data-key]，mic 在 T9 下挂 data-key=0）。 */
    t9Flick(originButton, dx, dy, clientX, fingerId) {
      const button = originButton && originButton.closest(".kb-key[data-key]");
      if (!button) return false;
      const vertical = Math.abs(dy) >= Math.abs(dx);
      if (button.id === "spaceKey") {
        if (this.voiceHold) return true;
        if (!vertical) return false;
        if (dy < 0) {
          this.sendSymbol("0");
          this.showFlick(button, dy, dx);
        }
        return true;
      }
      const key = button.dataset.key;
      if (this.mode === "stroke") {
        if (/^[1-9]$/.test(key)) {
          if (vertical && dy < 0) {
            this.sendSymbol(key);
            this.showFlick(button, dy, dx);
          }
          return true;
        }
        return false;
      }
      if (this.mode === "t9" && key === "1") {
        if (vertical && dy < 0) {
          this.sendSymbol("1");
          this.showFlick(button, dy, dx);
        }
        return true;
      }
      if (this.mode !== "t9" || !/^[2-9]$/.test(key)) return false;
      const letters = (LAYOUTS.t9.alts[key] || "").split("");
      if (vertical) {
        if (dy < 0) {
          this.sendSymbol(key);
        } else if (T9_SPLIT[key]) {
          this.openT9Popup(button, T9_SPLIT[key], {
            split: true,
            initialX: clientX != null ? clientX : null,
            fingerId
          });
        } else {
          this.sendText(letters[Math.floor((letters.length - 1) / 2)]);
        }
      } else {
        this.sendText(dx < 0 ? letters[0] : letters[letters.length - 1]);
      }
      this.showFlick(button, dy, dx);
      return true;
    }
    altCandidates(key) {
      if (this.chineseSymMode() && CN_ALTS[key]) return [CN_ALTS[key]];
      const layout = LAYOUTS[(MODES[this.mode] || MODES.direct).layout] || LAYOUTS.qwerty;
      if (layout.hintsOnly) return [];
      const value = layout.alts[key];
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }
    /** 键面角标显示：hintsOnly 布局（t9）也要画出字母组，但走的是
     * 展示语义，与 altCandidates 的可上屏备选分开。 */
    keyAltHint(key) {
      const custom = this.langKeysTable();
      const cell = custom && custom[key];
      if (cell && cell.alt != null) return cell.alt;
      if (this.chineseSymMode() && CN_ALTS[key]) return CN_ALTS[key];
      const layout = LAYOUTS[(MODES[this.mode] || MODES.direct).layout] || LAYOUTS.qwerty;
      const value = layout.alts[key];
      if (!value) return "";
      return Array.isArray(value) ? value[0] : value;
    }
    /** 长按全后选：数字 + 字母组逐个（4 → [4 g h i]）。 */
    /** T9 长按（issue #9）：三行弹层——上行=字母组小写、中行=左符号
     * ·数字·右符号、下行=大写。全部 literal 直上屏（commitText，
     * 大小写原样落）——数字格也字面落 editor（issue #62 用户裁定：
     * 长按选数字就是要打这个数字；旧规则「数字格=通配进引擎、与
     * 点按同义」让长按弹数字形同虚设）。已有组合时 commitText 先
     * 落现有组合再插数字（TextInputCoordinator 语义，与字母/符号
     * literal 同通道）。拼音里确认字母由下滑/横滑手势承担，不经
     * 弹层；7/9 下滑拆分（opts.split）仍走引擎通道不变。 */
    openT9HoldPopup(button, press) {
      this.hideKeyBubble();
      const key = button.dataset.key;
      const letters = (LAYOUTS.t9.alts[key] || "").split("");
      const syms = LAYOUTS.t9.keySymbols[key] || [];
      const cells = [
        ...letters.map((ch) => ({ char: ch, literal: true })),
        { char: syms[0], literal: true },
        { char: key, literal: true },
        { char: syms[1], literal: true },
        ...letters.map((ch) => ({ char: ch.toUpperCase(), literal: true }))
      ].filter((cell) => cell.char);
      this.openT9Popup(button, cells, { grid: true, press });
    }
    /** 笔画长按（issue #18，用户定稿 2026-09-19）：与 T9 同款三排——
     * 小写字母组 / 左符号 · 数字 · 右符号 / 大写字母组。字母组沿用
     * T9 的数字键位分配（2=abc…9=wxyz，拨号键盘肌肉记忆）。上屏
     * 规则与 T9 有一处分歧（#62 起）：字母（含大写）与符号同样
     * literal 直上屏（commitText），但**中格数字=点按同义（发部件
     * 编码，send 字段）**——笔画的数字键面印的是笔画部件，长按选
     * 数字=选部件，不字面上屏；T9 的中格数字才字面落。预选中格、
     * 相对跟手。1 键无字母组：退回单排 符号·数字·符号。 */
    openStrokeHoldPopup(button, press) {
      this.hideKeyBubble();
      const key = button.dataset.key;
      const def = STROKE_KEYS[key] || {};
      const syms = def.syms || [];
      const letters = (LAYOUTS.t9.alts[key] || "").split("");
      const middle = [
        { char: syms[0], literal: true },
        { char: key, send: def.code },
        { char: syms[1], literal: true }
      ].filter((cell) => cell.char);
      const cells = letters.length ? [
        ...letters.map((ch) => ({ char: ch, literal: true })),
        ...middle,
        ...letters.map((ch) => ({ char: ch.toUpperCase(), literal: true }))
      ] : middle;
      this.openT9Popup(
        button,
        cells,
        Object.assign(letters.length ? { grid: true } : { middle: true }, { press })
      );
    }
    /** T9 浮层：长按=三行大小写+符号+数字弹层（opts.grid，#62 起
     * 全格 literal 直上屏）；7/9 下滑=拆分字母（opts.split：按触点
     * x 半边判定下左/下右，不按格子距离——拖动方向与浮层位置相反，
     * 距离命中会立刻取消），split 格走引擎通道（enginePath →
     * sendText）。literal 格直上屏（commitText）；笔画中格带 send
     * 字段走 strokeActivate（部件编码，语义与 T9 数字不同）。
     */
    openT9Popup(button, cells, opts = {}) {
      const popup = document.getElementById("keyPopup");
      const inner = document.getElementById("keyPopupInner");
      inner.classList.add(opts.grid ? "t9-grid3" : "t9-row");
      inner.replaceChildren();
      const defs = cells.map((cell) => typeof cell === "object" ? cell : { char: cell });
      const makeItem = /* @__PURE__ */ __name((def) => {
        const item = document.createElement("div");
        item.className = "kp-item";
        item.textContent = def.char;
        return { item, char: def.char, send: def.send, literal: !!def.literal, cx: 0, cy: 0 };
      }, "makeItem");
      const items = [];
      if (opts.grid) {
        const per = (defs.length - 3) / 2;
        [defs.slice(0, per), defs.slice(per, per + 3), defs.slice(per + 3)].forEach((group) => {
          const row = document.createElement("div");
          row.className = "kp-row";
          group.forEach((def) => {
            const cell = makeItem(def);
            row.append(cell.item);
            items.push(cell);
          });
          inner.append(row);
        });
      } else {
        defs.forEach((def) => {
          const cell = makeItem(def);
          inner.append(cell.item);
          items.push(cell);
        });
      }
      popup.classList.add("open");
      const rect = button.getBoundingClientRect();
      const left = Math.max(4, Math.min(
        innerWidth - popup.offsetWidth - 4,
        rect.left + rect.width / 2 - popup.offsetWidth / 2
      ));
      popup.style.left = left + "px";
      popup.style.top = Math.max(2, rect.top - popup.offsetHeight - 6) + "px";
      items.forEach((cell) => {
        const r = cell.item.getBoundingClientRect();
        cell.cx = r.left + r.width / 2;
        cell.cy = r.top + r.height / 2;
      });
      let selected;
      if (opts.split && typeof opts.initialX === "number") {
        const mid = (items[0].cx + items[1].cx) / 2;
        selected = opts.initialX < mid ? items[0] : items[1];
      } else if (opts.grid || opts.middle) {
        selected = items[Math.floor(items.length / 2)];
      } else {
        selected = items[0];
      }
      selected.item.classList.add("sel");
      this.popup = {
        key: button.dataset.key,
        cells: items,
        selected,
        cancelled: false,
        enginePath: true,
        // 长按浮层取证：心跳捎带 open 时长——悬挂现场直接读出
        // 「弹层开了多久没人收」。
        openedAt: Date.now()
      };
      if (opts.split) {
        this.popup.split = true;
        if (opts.fingerId !== void 0) this.popup.fingerId = opts.fingerId;
      }
      if (opts.grid || opts.middle) this.attachRelativeTracking(popup, selected, opts.press);
      if (!opts.split) this.armPopupStallWatchdog();
      this.traceTouch("popup-open");
    }
    /** 松手/取消共用的弹层终判：不依赖原键还在文档中，也不依赖
     * touchOrigin 的手势所有权。只有仍按住的手指才能继续持有浮层。
     * 同一事件可能经过页面和原键两次；记录消费结果，防止重复上屏。 */
    finishPopupTouch(event, cancelled) {
      if (this.popupEndEvents.has(event)) return true;
      const popup = this.popup;
      if (!popup) return false;
      const ownsPopup = this.popupOwnsTouch(popup, event);
      const ownerStillDown = Array.from(event.touches || []).some(
        (touch) => touch.identifier === popup.fingerId
      );
      if (!ownsPopup && ownerStillDown) return false;
      if (ownsPopup) this.popupEndEvents.add(event);
      if (ownsPopup && !cancelled && popup.relative) {
        const last = Array.from(event.changedTouches || []).find(
          (touch) => touch.identifier === popup.fingerId
        );
        if (last) this.movePopup(last);
      }
      this.closePopup(
        cancelled || !ownsPopup,
        !ownsPopup ? "end-owner-missing" : cancelled ? "touch-cancel" : "touch-end"
      );
      return ownsPopup;
    }
    /** 弹层是否属于本次事件里变化的手指（多指仲裁）：所属手指
     *  才能提交选中项。fingerId 未知（未记录
     *  的旧弹层、mock 无 identifier）恒真，保持单指既有语义。 */
    popupOwnsTouch(popup, event) {
      return popup.fingerId === void 0 || Array.from(event.changedTouches || []).some(
        (item) => item.identifier === popup.fingerId
      );
    }
    /** 相对跟手选中（issue #9 定稿，qwerty accent 弹层同款）：高亮锚在
     * 预选格上，跟随手指「相对按下点」的位移同步移动——手指全程不必
     * 碰到浮层；虚拟光标滑出卡片边界 = 淡出 + 「松手撤销」，拖回恢复。
     * origin 拷贝自按下点：capture 收尾会清 touchOrigin，弹层必须自带
     * 位移基准。press=开弹层那根手指自己的按下点（重叠双指下全局
     * touchOrigin 属于首指，拷它会把这根手指的位移钉到首指位置上，
     * 一动就出卡片边界被当「松手撤销」）。 */
    attachRelativeTracking(popup, anchor, press) {
      this.popup.relative = true;
      this.popup.anchor = anchor;
      const base = press || this.touchOrigin;
      this.popup.origin = base ? { x: base.x, y: base.y } : null;
      this.popup.fingerId = base ? base.id : void 0;
      const card = popup.getBoundingClientRect();
      this.popup.cardRect = {
        left: card.left,
        top: card.top,
        right: card.right,
        bottom: card.bottom
      };
    }
    openPopup(button, press) {
      this.hideKeyBubble();
      const key = button.dataset.key;
      const upper = key.toUpperCase();
      const chars = [
        ...this.altCandidates(key).flatMap((char) => new RegExp("^\\p{L}$", "u").test(char) && char === char.toLowerCase() ? [char, char.toUpperCase()] : [char]),
        upper,
        key
      ].filter((v, i, all) => all.indexOf(v) === i);
      const popup = document.getElementById("keyPopup");
      const inner = document.getElementById("keyPopupInner");
      inner.replaceChildren();
      const cells = chars.map((char) => {
        const item = document.createElement("div");
        item.className = "kp-item";
        const glyph = this.chineseSymMode() && (char === "," || char === ".") ? char === "," ? "\uFF0C" : "\u3002" : char;
        item.textContent = glyph;
        inner.append(item);
        return { item, char, cx: 0, cy: 0 };
      });
      popup.classList.add("open");
      const rect = button.getBoundingClientRect();
      const left = Math.max(4, Math.min(innerWidth - popup.offsetWidth - 4, rect.left + rect.width / 2 - popup.offsetWidth / 2));
      popup.style.left = left + "px";
      popup.style.top = Math.max(2, rect.top - popup.offsetHeight - 6) + "px";
      cells.forEach((cell) => {
        const r = cell.item.getBoundingClientRect();
        cell.cx = r.left + r.width / 2;
        cell.cy = r.top + r.height / 2;
      });
      const selected = cells.find((cell) => cell.char === upper) || cells[0];
      selected.item.classList.add("sel");
      this.popup = {
        key,
        cells,
        selected,
        cancelled: false,
        openedAt: Date.now()
      };
      this.attachRelativeTracking(popup, selected, press);
      this.armPopupStallWatchdog();
      this.traceTouch("popup-open");
    }
    /** owner 停滞看门狗（最后防线，1.3.9 复发分析 §5）：owner 的
     *  end 永不到达且事件流静默（没有 start/move 给对账机会）时，
     *  浮层不存在任何退出事件——多指打字又屏蔽「全新序列」兜底。
     *  5s 无有效 owner 移动即撤销：超时语义=交互失联，与 cancel
     *  一致，绝不替用户提交选中项（自动提交会在打字中插入未经
     *  确认的大写字符）。闭包绑浮层实例，旧回调关不掉新浮层。 */
    armPopupStallWatchdog() {
      clearTimeout(this._popupStallTimer);
      const popup = this.popup;
      if (!popup || popup.split) return;
      this._popupStallTimer = setTimeout(() => {
        if (this.popup === popup) {
          this.traceTouch("fault-popup-stall");
          this.closePopup(true, "stall");
        }
      }, 5e3);
    }
    /** 「松手撤销」提示（issue #9）：弹层滑出卡片边界时浮层淡出，
     *  这条 toast 把状态说破——固定挂在浮层上方中线，不跟手；
     *  拖回卡片内自动恢复。 */
    showPopupCancelTip(show) {
      const tip = document.getElementById("keyPopupCancelTip");
      const popup = document.getElementById("keyPopup");
      if (!tip || !popup) return;
      if (!show) {
        tip.classList.remove("show");
        return;
      }
      tip.textContent = t("\u677E\u624B\u64A4\u9500");
      const card = popup.getBoundingClientRect();
      tip.style.left = card.left + card.width / 2 + "px";
      tip.style.top = Math.max(2, card.top - 30) + "px";
      tip.classList.add("show");
    }
    movePopup(touch) {
      if (!this.popup) return;
      if (this.popup.absolute) {
        this.moveInkPopup(touch);
        return;
      }
      if (this.popup.split) {
        const mid = (this.popup.cells[0].cx + this.popup.cells[1].cx) / 2;
        const sel = touch.clientX < mid ? this.popup.cells[0] : this.popup.cells[1];
        this.popup.cancelled = false;
        this.popup.selected = sel;
        this.showPopupCancelTip(false);
        this.popup.cells.forEach((cell) => cell.item.classList.toggle("sel", cell === sel));
        return;
      }
      const inner = document.getElementById("keyPopupInner");
      const anchor = this.popup.anchor;
      const r = this.popup.cardRect;
      const origin = this.popup.origin || this.touchOrigin || { x: anchor.cx, y: anchor.cy };
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      const scale = [1.4, 1, 0.7][this.popupSnap] || 1;
      const DEAD = Math.round(12 * scale);
      const SLOP = Math.round(6 * scale);
      if (!this.popup.tracking) {
        if (Math.hypot(dx, dy) <= DEAD) return;
        this.popup.tracking = true;
      }
      const vx = anchor.cx + dx;
      const vy = anchor.cy + dy;
      const inside = vx >= r.left - SLOP && vx <= r.right + SLOP && vy >= r.top - SLOP && vy <= r.bottom + SLOP;
      if (!inside) {
        if (!this.popup.cancelled) {
          this.popup.cancelled = true;
          this.popup.selected = null;
          this.popup.cells.forEach((cell) => cell.item.classList.remove("sel"));
          inner.style.transform = "scale(0.92)";
          inner.style.opacity = "0.5";
          this.showPopupCancelTip(true);
        }
        return;
      }
      if (this.popup.cancelled) {
        this.popup.cancelled = false;
        inner.style.transform = "";
        inner.style.opacity = "";
        this.showPopupCancelTip(false);
      }
      let selected = this.popup.cells[0];
      let best = Infinity;
      this.popup.cells.forEach((cell) => {
        const d = Math.hypot(vx - cell.cx, vy - cell.cy);
        if (d < best) {
          best = d;
          selected = cell;
        }
      });
      this.popup.cells.forEach((cell) => cell.item.classList.toggle("sel", cell === selected));
      this.popup.selected = selected;
    }
    closePopup(cancel, reason = "explicit") {
      clearTimeout(this._popupStallTimer);
      const popup = this.popup;
      if (popup) this.traceTouch("popup-close/" + reason + "/" + (cancel ? "cancel" : "commit"));
      this.popup = null;
      if (cancel && popup && popup.fingerId !== void 0) {
        this.popupRetiredIds.add(popup.fingerId);
      }
      const inner = document.getElementById("keyPopupInner");
      inner.style.transform = "";
      inner.style.opacity = "";
      inner.style.maxHeight = "";
      inner.classList.remove("t9-row", "t9-grid3", "kp-grid", "kp-drawer");
      const popupEl = document.getElementById("keyPopup");
      popupEl.classList.remove("open", "kp-drawer");
      popupEl.style.width = "";
      this.showPopupCancelTip(false);
      if (cancel || (popup == null ? void 0 : popup.cancelled)) return;
      if (popup == null ? void 0 : popup.enginePath) {
        if (!popup.selected) return;
        if (popup.selected.literal) {
          this.sendSymbol(popup.selected.char);
        } else if (this.mode === "stroke" && popup.key !== "7") {
          this.strokeActivate(popup.key);
        } else {
          this.sendText(popup.selected.send || popup.selected.char);
        }
        return;
      }
      if (popup == null ? void 0 : popup.selected) {
        const char = popup.selected.char;
        if (this.chineseSymMode() && (char === "," || char === ".")) {
          this.enginePunct(char);
        } else if (this.chineseSymMode()) {
          this.sendSymbol(char);
        } else {
          this.sendText(char);
        }
      }
    }
    /** The flick feedback is a direction-only blob - a
     * viscous half-ellipse that peels OFF the key along the swipe and
     * fades fast. It must NOT preview the character (the character
     * actually lands; showing it read as a duplicate). */
    showFlick(button, dy, dx = 0) {
      const blob = document.getElementById("flickBlob");
      if (!blob) return;
      const rect = button.getBoundingClientRect();
      const size = Math.min(38, rect.width * 0.72);
      blob.style.left = rect.left + rect.width / 2 - size / 2 + "px";
      blob.style.top = rect.top + rect.height / 2 - size / 2 + "px";
      blob.style.width = size + "px";
      blob.style.height = size + "px";
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const dir = (horizontal ? dx : dy) < 0 ? -1 : 1;
      const axis = horizontal ? "X" : "Y";
      blob.classList.add("run");
      if (typeof blob.animate === "function") {
        const anim = blob.animate([
          { transform: "scale(1.12, 0.55)", opacity: 0.5, filter: "blur(1.5px)" },
          { transform: `scale(1, 1) translate${axis}(${dir * 12}px)`, opacity: 0.38, filter: "blur(2.5px)", offset: 0.45 },
          { transform: `scale(0.82, 1.28) translate${axis}(${dir * 26}px)`, opacity: 0, filter: "blur(5px)" }
        ], { duration: 250, easing: "cubic-bezier(.2, .7, .3, 1)" });
        anim.onfinish = () => blob.classList.remove("run");
      } else {
        blob.classList.remove("run");
      }
    }
    toggleShift() {
      if (this.mode === "french" && this.composing) {
        this.caseMode = this.caseMode === "cap" ? "upper" : this.caseMode === "upper" ? null : "cap";
        this.updateCaseKeyVisual();
        this.renderCandidates(this.lastEngineState || {});
        return;
      }
      const tappedAt = Date.now();
      if (this.doubleShiftLock && tappedAt - this.lastShiftTapAt <= 300) {
        this.lastShiftTapAt = -Infinity;
        this.lockShift();
        return;
      }
      this.lastShiftTapAt = tappedAt;
      if (this.caps) {
        this.caps = false;
        this.lastShiftTapAt = -Infinity;
      } else {
        this.shift = !this.shift;
      }
      this.updateLabels();
    }
    /** caseMode 的 shift 键指示（cap=单亮，upper=锁定亮）。 */
    updateCaseKeyVisual() {
      const key = document.querySelector(".kb-mod.shift");
      if (!key) return;
      key.classList.toggle("case-cap", this.caseMode === "cap");
      key.classList.toggle("case-upper", this.caseMode === "upper");
    }
    /** 大小写变形（首字母大写对撇号词取真首字母：c'était → C'était）。 */
    caseifyText(text) {
      if (this.caseMode === "cap") {
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
      if (this.caseMode === "upper") return text.toUpperCase();
      return text;
    }
    lockShift() {
      this.caps = true;
      this.shift = false;
      this.updateLabels();
    }
    updateLabels() {
      var _a;
      const chinese = this.mode === "pinyin" || this.mode === "double-pinyin" || this.mode === "flypy";
      const upper = this.shift || this.caps;
      document.querySelectorAll("[data-key]").forEach((button) => {
        const key = button.dataset.key;
        const main = button.querySelector(".kb-main");
        if (!main) return;
        main.textContent = chinese || upper ? key.toUpperCase() : key;
      });
      const punct = document.querySelector('[data-key="."] .kb-alt');
      if (punct) punct.textContent = chinese ? "\u3002" : this.altCandidates(".")[0] || "";
      const punctMain = document.querySelector('[data-key="."] .kb-main');
      if (punctMain) punctMain.textContent = chinese ? "\uFF0C" : ".";
      (_a = document.querySelector('[data-key="."]')) == null ? void 0 : _a.classList.toggle("zh-punct", chinese);
      const shift = document.querySelector(".shift");
      shift == null ? void 0 : shift.classList.toggle("active", this.shift);
      shift == null ? void 0 : shift.classList.toggle("locked", this.caps);
      if (shift && shift.querySelector("svg path")) {
        shift.querySelector("svg path").setAttribute("d", this.caps ? ICON_PATHS.caps : ICON_PATHS.shift);
      }
      this.updateToggleLabels();
      this.updateHwModeTag();
      this.updateEnterLabel();
      this.renderFnLabels();
    }
    updateToggleLabels() {
      const toggle = document.getElementById("modeToggle");
      if (!toggle) return;
      const target = this.quickSwitchTarget();
      toggle.querySelector(".cn-main").textContent = modeLabel(this.mode);
      toggle.querySelector(".cn-sub").textContent = modeLabel(target);
    }
    updateEnterLabel() {
      const label = this.composing ? t("\u786E\u5B9A") : t("\u6362\u884C");
      const enter = document.getElementById("enterKey");
      if (enter) {
        enter.textContent = label;
        enter.setAttribute("aria-label", label);
      }
      const numEnter = document.getElementById("numEnterKey");
      if (numEnter) {
        numEnter.textContent = label;
        numEnter.setAttribute("aria-label", label);
      }
    }
    /* ===== symbol layer ===== */
    /** The key-area layers are mutually exclusive; this field owns
     * which one is visible. Full-width borrowers (panel, quick
     * settings, editors) hide every layer via hideKeyLayers and hand
     * the remembered one back with showKeyLayer - no call site juggles
     * the individual hidden flags any more. */
    exclusiveOpen(name) {
      const v = EXCLUSIVE_VIEWS[name];
      if (!v) return false;
      const el = document.getElementById(v.el);
      if (!el) return false;
      return v.openClass ? el.classList.contains(v.openClass) : !el.hidden;
    }
    /** 收口互斥（#39-12）：开 except 视图前关掉其余开着的互斥视图。
     *  except 省略 = 全关（resetToHome/renderMode 等全收场景）。 */
    closeOtherViews(except) {
      Object.keys(EXCLUSIVE_VIEWS).forEach((name) => {
        if (name === except || !this.exclusiveOpen(name)) return;
        const close = EXCLUSIVE_VIEWS[name].close;
        if (typeof this[close] === "function") this[close]();
      });
    }
    showKeyLayer(name) {
      this.keyLayer = name;
      this.closeModeMenu();
      Object.entries(EXCLUSIVE_VIEWS).forEach(([viewName, v]) => {
        if (viewName === "modeMenu" || !this.exclusiveOpen(viewName)) return;
        if (v.returnField) this[v.returnField] = name;
        this[v.close]();
      });
      if (name !== "numpad") this.emojiView = false;
      this.hideKeyLayers();
      document.getElementById(
        name === "symbols" ? "symbolLayer" : name === "numpad" ? "numPadLayer" : "qwertyLayer"
      ).hidden = false;
      this.hwNotifyPanelHeight();
    }
    hideKeyLayers() {
      document.querySelectorAll(".kb-layer").forEach((el) => {
        if (el.id !== "ctrlLayer") el.hidden = true;
      });
    }
    showSymbols() {
      this.symbolCat = "common";
      this.renderSymbolCats();
      this.renderSymbols();
      this.showKeyLayer("symbols");
    }
    showLetters() {
      this.showKeyLayer("letters");
    }
    /** The IME re-showing always lands on the main view -
     * a keyboard hidden from the symbol layer must not come back
     * there. Closes every panel/layer and returns to the letters (the
     * active MODE is untouched - renderMode would also drop it). */
    resetToHome() {
      this.cancelTouches();
      this.closeOtherViews();
      this.clearEditorStrip();
      this.closeItemMenu();
      this.closeComboGrid();
      this.closeModeMenu();
      this.closeConfirmCard();
      if (document.getElementById("heightCard").classList.contains("open")) {
        if (this.heightEditedLive) this.applyKbHeight(this.heightEditSaved);
        this.exitHeightEdit();
      }
      this.setControlView(false);
      this.setExpanded(false);
      this.showLetters();
      if (this.mode === "handwriting") this.applyModeHeight();
      if (this.toolbarEdit) this.cancelToolbarEdit();
      this.auditToolbarTools();
    }
    recent() {
      try {
        return JSON.parse(localStorage.getItem("feelime_symbol_recent") || "[]");
      } catch (_) {
        return [];
      }
    }
    remember(value) {
      const values = [value, ...this.recent().filter((item) => item !== value)].slice(0, 16);
      localStorage.setItem("feelime_symbol_recent", JSON.stringify(values));
    }
    /* ===== 九宫格数字键盘（长按 123）与 emoji 选择器 ===== */
    showNumpad() {
      this.renderNumpad();
      this.showKeyLayer("numpad");
    }
    /** The nine-pad (long-press 123): a 4×5 grid - the left column is
     * the number-symbol strip (vertical scroll, literal commits) over
     * the back key, then digits, '.', the action column and the emoji
     * sub-view. EVERY glyph commits literally via sendSymbol - the
     * Chinese engine never sees these digits as candidate selectors,
     * and '.' stays a decimal point in every mode (design §2.6). */
    renderNumpad() {
      const layer = document.getElementById("numPadLayer");
      layer.replaceChildren();
      const grid = document.createElement("div");
      grid.className = "num-grid";
      const syms = document.createElement("div");
      syms.className = "num-syms";
      NUM_PAD_SYMBOLS.forEach((value) => {
        const button = document.createElement("button");
        button.className = "num-sym-key";
        button.textContent = value;
        button.addEventListener("click", () => this.sendSymbol(value));
        syms.append(button);
      });
      grid.append(syms);
      const back = this.specialKey(
        "numpad-back",
        ICONS.arrowLeft,
        () => this.showLetters(),
        "num-back"
      );
      back.setAttribute("aria-label", t("\u8FD4\u56DE\u4E3B\u952E\u76D8"));
      grid.append(back);
      if (this.emojiView) {
        grid.append(this.renderEmojiArea());
      } else {
        const push = /* @__PURE__ */ __name((cell) => grid.append(cell), "push");
        const digit = /* @__PURE__ */ __name((value) => this.functionKey(
          value,
          () => this.sendSymbol(value),
          "num-digit"
        ), "digit");
        push(digit("1"));
        push(digit("2"));
        push(digit("3"));
        push(this.specialKey(
          "backspace",
          ICONS.backspace,
          () => this.backspaceAction(),
          "num-fn kb-special",
          "repeat"
        ));
        push(digit("4"));
        push(digit("5"));
        push(digit("6"));
        push(this.functionKey(
          t("\u7A7A\u683C"),
          () => this.call(() => Native.space(this.token)),
          "num-fn kb-special"
        ));
        push(digit("7"));
        push(digit("8"));
        push(digit("9"));
        const emojiKey = this.specialKey(
          "emoji",
          ICONS.smiley,
          () => this.toggleEmojiView(),
          "num-fn kb-special"
        );
        emojiKey.setAttribute("aria-label", "emoji");
        push(emojiKey);
        push(this.functionKey(t("\u7B26\u53F7"), () => this.showSymbols(), "num-fn kb-special"));
        push(digit("0"));
        push(digit("."));
        const enter = this.functionKey(
          t("\u6362\u884C"),
          () => this.call(() => Native.enter(this.token)),
          "num-fn kb-special",
          "repeat"
        );
        enter.id = "numEnterKey";
        push(enter);
      }
      layer.append(grid);
      this.updateEnterLabel();
    }
    /** The emoji sub-view replaces the digit area (cols 2-5): a
     * horizontally snapping page scroller over the category strip.
     * Pages pair with the strip through a shared index (design §2.6). */
    renderEmojiArea() {
      const area = document.createElement("div");
      area.className = "emoji-area";
      const recents = this.emojiRecents();
      const categories = recents.length ? [{ id: "recent", label: "\u5E38\u7528", emojis: recents }, ...EMOJI_CATEGORIES] : EMOJI_CATEGORIES;
      const pages = document.createElement("div");
      pages.className = "emoji-pages";
      const pageCats = [];
      const firstPage = {};
      categories.forEach((category) => {
        firstPage[category.id] = pageCats.length;
        for (let i = 0; i < category.emojis.length; i += 24) {
          pageCats.push(category.id);
          const page = document.createElement("div");
          page.className = "emoji-page";
          category.emojis.slice(i, i + 24).forEach((emoji) => {
            const button = document.createElement("button");
            button.className = "emoji-key";
            button.textContent = emoji;
            button.addEventListener("click", () => {
              this.sendSymbol(emoji);
              this.rememberEmoji(emoji);
            });
            page.append(button);
          });
          pages.append(page);
        }
      });
      const strip = document.createElement("div");
      strip.className = "emoji-cats";
      const digitsTab = document.createElement("button");
      digitsTab.className = "sym-cat";
      digitsTab.textContent = "123";
      digitsTab.addEventListener("click", () => this.toggleEmojiView());
      strip.append(digitsTab);
      const tabs = [];
      categories.forEach((category, index) => {
        const tab = document.createElement("button");
        tab.className = "sym-cat" + (index === 0 ? " active" : "");
        tab.textContent = t(category.label);
        tab.addEventListener("click", () => {
          const left = firstPage[category.id] * (pages.clientWidth || 0);
          if (typeof pages.scrollTo === "function") {
            pages.scrollTo({ left, behavior: "smooth" });
          } else {
            pages.scrollLeft = left;
          }
        });
        tabs.push(tab);
        strip.append(tab);
      });
      pages.addEventListener("scroll", () => {
        const width = pages.clientWidth;
        if (!width) return;
        const catId = pageCats[Math.round(pages.scrollLeft / width)] || pageCats[0];
        tabs.forEach((tab, index) => tab.classList.toggle("active", categories[index].id === catId));
      });
      area.append(pages, strip);
      return area;
    }
    toggleEmojiView() {
      this.emojiView = !this.emojiView;
      this.renderNumpad();
    }
    emojiRecents() {
      try {
        const parsed = JSON.parse(localStorage.getItem("feelime_emoji_recent") || "[]");
        if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === "string");
      } catch (_) {
      }
      return [];
    }
    rememberEmoji(emoji) {
      const values = [emoji, ...this.emojiRecents().filter((item) => item !== emoji)].slice(0, 16);
      localStorage.setItem("feelime_emoji_recent", JSON.stringify(values));
    }
    renderSymbolCats() {
      const strip = document.getElementById("symCats");
      strip.replaceChildren();
      SYMBOL_CATEGORIES.forEach((category) => {
        if (category.id === "custom" && !this.hasCustomRows()) return;
        const button = document.createElement("button");
        button.className = "sym-cat" + (category.id === this.symbolCat ? " active" : "");
        button.textContent = t(category.label);
        button.dataset.symCat = category.id;
        if (VARIANT_TABLES[category.id]) {
          button.classList.add("sym-cat-variant");
          const badge = document.createElement("span");
          badge.className = "cat-sub";
          badge.textContent = this.variantNow(category.id) === "zh" ? "\u4E2D" : "En";
          button.append(badge);
        }
        button.addEventListener("click", () => {
          if (VARIANT_TABLES[category.id] && this.symbolCat === category.id) {
            const to = this.variantNow(category.id) === "zh" ? "en" : "zh";
            this.tableVariants[category.id] = to;
            const badge = button.querySelector(".cat-sub");
            if (badge) badge.textContent = to === "zh" ? "\u4E2D" : "En";
            this.renderSymbols();
            return;
          }
          this.symbolCat = category.id;
          document.querySelectorAll("[data-sym-cat]").forEach((el) => el.classList.toggle("active", el.dataset.symCat === category.id));
          this.renderSymbols();
          if (button.scrollIntoView) {
            button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
        });
        strip.append(button);
      });
    }
    /** The variant a paired table (常用/引号) shows: the pinned one
     * (second tap on the active tab flips it) or the default - both
     * follow the input mode (issue #48: 引号 used to default to zh,
     * forcing an extra tap in English mode). */
    variantNow(catId) {
      if (this.tableVariants[catId]) return this.tableVariants[catId];
      return !this.chineseSymMode() ? "en" : "zh";
    }
    rowsFor(catId) {
      return VARIANT_TABLES[catId][this.variantNow(catId)];
    }
    commonRows() {
      return VARIANT_TABLES.common[this.variantNow("common")];
    }
    /** The user's custom symbol table - exactly 3 rows of
     * key caps (≤10/10/9; row 3's tenth cell stays the delete key).
     * Stored in localStorage; null (tab hidden) until it has content.
     * This format is REPLACED by pasted JSON
     * (feelime_custom_keys_v2); the old comma tables migrate once. */
    customRows() {
      try {
        const rows = JSON.parse(localStorage.getItem("feelime_custom_rows") || "null");
        if (Array.isArray(rows) && rows.length === 3 && rows.some((row) => Array.isArray(row) && row.length)) return rows;
      } catch (_) {
      }
      return null;
    }
    /** The pasted-JSON table: rows of {t, tap, note}. Null
     * until the user saved one; older comma rows migrate over. */
    customKeys() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEYS_STORE) || "null");
        if (parsed && parsed.version === 1 && Array.isArray(parsed.rows) && parsed.rows.length <= CUSTOM_LIMITS.rows) {
          return parsed.rows;
        }
      } catch (_) {
      }
      const legacy = this.customRows();
      if (legacy) {
        const rows = legacy.map((row) => (row || []).map((value) => ({ t: value, tap: value, note: "" })));
        try {
          localStorage.setItem(
            CUSTOM_KEYS_STORE,
            JSON.stringify({ version: 1, rows })
          );
          localStorage.removeItem("feelime_custom_rows");
        } catch (_) {
        }
        return rows;
      }
      return null;
    }
    /** 语言键盘定制变化后的字母层重画：只在当前显示的就是字母层
     *  时立即重渲染（符号/T9 层的角标不来自 langKeys，切回时
     *  renderLetters 自然读新值）。 */
    rerenderLangKeys() {
      const qwerty = document.getElementById("qwertyLayer");
      if (qwerty && !qwerty.hidden) {
        this.renderLetters((MODES[this.mode] || MODES.direct).layout);
      }
    }
    /** 语言键盘定制段（当前输入法的布局）：读 localStorage 镜像，
     *  坏数据/未设置 = null（所有查表点自然走默认行为）。双拼不分
     *  方案存一份（dp）；direct=english。 */
    langKeysTable() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEYS_STORE) || "null");
        if (!parsed || parsed.version !== 1 || !parsed.langKeys) return null;
        const lay = this.langKeyLayoutId();
        const table = lay && parsed.langKeys[lay];
        return table && typeof table === "object" ? table : null;
      } catch (_) {
        return null;
      }
    }
    /** 全量 langKeys 段（跨布局；符号页编辑器整包保存时带回），
     *  未设置/坏数据 = null。 */
    storedLangKeys() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEYS_STORE) || "null");
        if (parsed && parsed.version === 1 && parsed.langKeys && typeof parsed.langKeys === "object") {
          return parsed.langKeys;
        }
      } catch (_) {
      }
      return null;
    }
    /** 输入法 mode → 语言键盘定制 layout id（与设置页四级页一致；
     *  不在集合内（T9/笔画/手写/音形等）返回 null=不开放）。 */
    langKeyLayoutId() {
      switch (this.mode) {
        case "pinyin":
          return "pinyin";
        case "double-pinyin":
          return "dp";
        case "direct":
          return "english";
        case "french":
          return "french";
        case "russian":
          return "russian";
        default:
          return null;
      }
    }
    /** [open:URI] 的表单校验（与 native openLink 桥同口径，桥侧
     *  再校验一次兜底）：http(s) 网页地址或应用自定义 scheme；
     *  intent://（点名组件）、data:（塞标记给浏览器）、android-app:
     *  （点名任意包拉起）等能夹带信息走私跳转的形态一律拒绝。
     *  方括号也拒：DSL 以 [..] 切步，含括号的 URI 会被静默截断
     *  （IPv6 字面量同理，属可接受损失）。 */
    validateOpenUri(uri) {
      if (!uri) return { error: t("\u7F3A\u5C11\u94FE\u63A5") };
      if (/[\s]/.test(uri)) return { error: t("\u94FE\u63A5\u91CC\u4E0D\u80FD\u6709\u7A7A\u683C") };
      if (/[\[\]]/.test(uri)) return { error: t("\u94FE\u63A5\u91CC\u4E0D\u80FD\u6709\u65B9\u62EC\u53F7") };
      const scheme = /^([a-z][a-z0-9+.\-]*):/i.exec(uri);
      if (!scheme) return { error: t("\u5FC5\u987B\u662F http(s) \u7F51\u9875\u5730\u5740\u6216\u5E94\u7528\u94FE\u63A5\uFF08\u5982 doubao://\uFF09") };
      const name = scheme[1].toLowerCase();
      const blocked = [
        "intent",
        "javascript",
        "file",
        "content",
        "about",
        "data",
        "android-app",
        "blob"
      ];
      if (blocked.includes(name)) {
        return { error: t("\u4E0D\u652F\u6301 {0} \u94FE\u63A5", name + ":") };
      }
      return { ok: true };
    }
    /** Tap DSL -> execution steps. Text outside [..] commits
     * literally; [name] presses a key; [mod+...+name] a combo;
     * [open:URI] opens an app/web page. Returns {steps} or
     * {error} (message names the offending token). */
    parseTapDsl(tap) {
      const trimmed = String(tap || "").trim();
      if (/^\[open:/i.test(trimmed) && /[\[\]]/.test(trimmed.slice(1, -1))) {
        return { error: t("\u94FE\u63A5\u91CC\u4E0D\u80FD\u6709\u65B9\u62EC\u53F7") };
      }
      const steps = [];
      const re = /\[([^\[\]]*)\]/g;
      let index = 0;
      let match;
      const pushText = /* @__PURE__ */ __name((chunk) => {
        if (chunk) steps.push({ text: chunk });
      }, "pushText");
      while (match = re.exec(tap)) {
        pushText(tap.slice(index, match.index));
        index = match.index + match[0].length;
        const raw = match[1].trim();
        if (raw.toLowerCase().startsWith("open:")) {
          const uri = raw.slice(5).trim();
          const check = this.validateOpenUri(uri);
          if (check.error) return { error: t("\u300C{0}\u300D{1}", match[0], check.error) };
          steps.push({ open: uri });
          continue;
        }
        if (raw.toLowerCase().startsWith("setting:")) {
          const id = raw.slice(8).trim();
          if (!/^[\w-]{1,64}$/.test(id)) {
            return { error: t("\u300C{0}\u300D\u8BBE\u7F6E\u9879\u6807\u8BC6\u65E0\u6548", match[0]) };
          }
          steps.push({ openSetup: id });
          continue;
        }
        if (raw.toLowerCase().startsWith("panel:")) {
          const target = raw.slice(6).trim().toLowerCase();
          if (!PANEL_STEPS.has(target)) {
            return { error: t("\u300C{0}\u300D\u9762\u677F\u540D\u65E0\u6548", match[0]) };
          }
          steps.push({ panel: target });
          continue;
        }
        if (raw.toLowerCase().startsWith("edit:")) {
          const op = raw.slice(5).trim();
          if (!EDIT_STEP_TOKENS[op]) {
            return { error: t("\u300C{0}\u300D\u7F16\u8F91\u64CD\u4F5C\u540D\u65E0\u6548", match[0]) };
          }
          steps.push({ edit: op });
          continue;
        }
        const body = raw.toLowerCase();
        if (!body) return { error: t("\u51FA\u73B0\u7A7A\u7684 [] \u8BB0\u53F7") };
        const mods = [];
        let key = null;
        for (const part of body.split("+").map((p) => p.trim()).filter(Boolean)) {
          if (key === null && CUSTOM_MOD_TOKENS[part]) {
            mods.push(CUSTOM_MOD_TOKENS[part]);
            continue;
          }
          if (key === null) {
            key = part;
            continue;
          }
          return { error: t("\u300C{0}\u300D\u65E0\u6CD5\u89E3\u6790", match[0]) };
        }
        if (!key) return { error: t("\u300C{0}\u300D\u7F3A\u5C11\u952E\u540D", match[0]) };
        const comboLabel = CUSTOM_KEY_TOKENS[key] || (/^[a-z]$/.test(key) ? key.toUpperCase() : null);
        if (!comboLabel) return { error: t("\u300C{0}\u300D\u7684\u952E\u540D\u4E0D\u53EF\u7528", match[0]) };
        steps.push({ combo: [...mods, comboLabel] });
      }
      pushText(tap.slice(index));
      if (steps.filter((step) => step.combo).length > CUSTOM_LIMITS.maxKeySteps) {
        return { error: t("\u6309\u952E\u6B65\u9AA4\u8D85\u8FC7 {0} \u4E2A", CUSTOM_LIMITS.maxKeySteps) };
      }
      return { steps };
    }
    /** Validate a pasted JSON definition. Returns {rows} or
     * {error} with the FIRST problem (position + reason). */
    parseCustomKeys(text) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        return { error: t("JSON \u89E3\u6790\u5931\u8D25\uFF1A") + err.message };
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: t('\u9876\u5C42\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF08{"version":1,"rows":[...]}\uFF09') };
      }
      if (data.version !== 1) return { error: t("version \u5FC5\u987B\u662F 1") };
      if (!Array.isArray(data.rows)) return { error: t("rows \u5FC5\u987B\u662F\u6570\u7EC4") };
      if (data.rows.length > CUSTOM_LIMITS.rows) {
        return { error: t("\u6700\u591A {0} \u884C\uFF08\u6536\u5230 {1} \u884C\uFF09", CUSTOM_LIMITS.rows, data.rows.length) };
      }
      const rows = [];
      let total = 0;
      for (let r = 0; r < data.rows.length; r++) {
        const row = data.rows[r];
        if (!Array.isArray(row)) return { error: t("\u7B2C {0} \u884C\u5FC5\u987B\u662F\u6570\u7EC4", r + 1) };
        const keys = [];
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          const at = t("\u7B2C {0} \u884C\u7B2C {1} \u4E2A\u952E", r + 1, c + 1);
          if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
            return { error: t("{0} \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08{t, tap, note}\uFF09", at) };
          }
          const label = typeof cell.t === "string" ? cell.t.trim() : "";
          if (!label) return { error: t("{0} \u7F3A\u5C11 t\uFF08\u952E\u9762\uFF09", at) };
          if ([...label].length > CUSTOM_LIMITS.labelChars) {
            return { error: t("\u300C{0}\u300D\u7684 t \u8D85\u8FC7 {1} \u5B57", label, CUSTOM_LIMITS.labelChars) };
          }
          const note = cell.note == null ? "" : String(cell.note);
          if ([...note].length > CUSTOM_LIMITS.noteChars) {
            return { error: t("\u300C{0}\u300D\u7684 note \u8D85\u8FC7 {1} \u5B57", label, CUSTOM_LIMITS.noteChars) };
          }
          const tap = typeof cell.tap === "string" ? cell.tap : "";
          if (!tap) return { error: t("{0}\uFF08\u300C{1}\u300D\uFF09\u7F3A\u5C11 tap\uFF08\u5355\u51FB\u884C\u4E3A\uFF09", at, label) };
          if ([...tap].length > CUSTOM_LIMITS.tapChars) {
            return { error: t("\u300C{0}\u300D\u7684 tap \u8D85\u8FC7 {1} \u5B57\u7B26", label, CUSTOM_LIMITS.tapChars) };
          }
          const parsed = this.parseTapDsl(tap);
          if (parsed.error) return { error: t("\u300C{0}\u300D\u7684 tap {1}", label, parsed.error) };
          if (cell.span != null) {
            if (![1, 2, 3].includes(cell.span)) {
              return { error: t("\u300C{0}\u300D\u7684 span \u53EA\u80FD\u662F 1/2/3", label) };
            }
          }
          if (cell.color != null) {
            const hex = /^#[0-9a-fA-F]{6}$/.test(cell.color);
            const hue = /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color);
            const hueOk = hue && Number(hue[1]) <= 359 && (hue[2] == null || Number(hue[2]) <= 100);
            if (!hex && !hueOk && !CUSTOM_KEY_COLORS.includes(cell.color)) {
              return { error: t("\u300C{0}\u300D\u7684 color \u53EA\u80FD\u662F\uFF1A{1}\u3001\u81EA\u5B9A\u4E49\u8272\u8C03 h0-h359 \u6216 #RRGGBB", label, CUSTOM_KEY_COLORS.join("/")) };
            }
          }
          if (cell.align != null && !["left", "center", "right"].includes(cell.align)) {
            return { error: t("\u300C{0}\u300D\u7684 align \u53EA\u80FD\u662F\uFF1Aleft/center/right", label) };
          }
          if (++total > CUSTOM_LIMITS.keys) {
            return { error: t("\u952E\u603B\u6570\u8D85\u8FC7 {0}", CUSTOM_LIMITS.keys) };
          }
          const clean = { t: label, tap, note };
          if (cell.span === 2 || cell.span === 3) clean.span = cell.span;
          if (cell.color != null) clean.color = cell.color;
          if (cell.align === "left" || cell.align === "center" || cell.align === "right") {
            clean.align = cell.align;
          }
          keys.push(clean);
        }
        rows.push(keys);
      }
      const langParsed = this.parseLangKeys(data.langKeys || null);
      if (langParsed.error) return { error: langParsed.error };
      if (!rows.some((row) => row.length) && !langParsed.value) {
        return { error: t("\u81F3\u5C11\u8981\u5B9A\u4E49\u4E00\u4E2A\u952E") };
      }
      const out = { rows };
      if (langParsed.value) out.langKeys = langParsed.value;
      return out;
    }
    /** langKeys 段（语言键盘定制）校验：{layout:{key:{alt,up,down}}}。
     *  layout 白名单与设置页四级页一致；key 是布局按键字符；alt ≤3
     *  字；up/down 是 tap DSL（parseTapDsl 权威校验，长度同 tapChars）。
     *  返回 {ok,value?} 或 {ok:false,error}。null/undefined = 未设置
     *  （合法，value null）。 */
    parseLangKeys(data) {
      if (data == null) return { ok: true, value: null };
      if (typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: t("langKeys \u5FC5\u987B\u662F\u5BF9\u8C61") };
      }
      const LAYOUTS_OK = ["pinyin", "dp", "english", "french", "russian"];
      const out = {};
      let any = false;
      for (const lay of Object.keys(data)) {
        if (!LAYOUTS_OK.includes(lay)) {
          return { ok: false, error: t("langKeys \u4E0D\u652F\u6301\u7684\u8BED\u8A00\u952E\u76D8\uFF1A{0}", lay) };
        }
        const table = data[lay];
        if (typeof table !== "object" || Array.isArray(table)) {
          return { ok: false, error: t("langKeys.{0} \u5FC5\u987B\u662F\u5BF9\u8C61", lay) };
        }
        const cleanTable = {};
        for (const key of Object.keys(table)) {
          if ([...key].length !== 1) {
            return { ok: false, error: t("langKeys.{0} \u7684\u952E\u540D\u5FC5\u987B\u662F\u5355\u5B57\u7B26\uFF1A{1}", lay, key) };
          }
          const cell = table[key];
          if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
            return { ok: false, error: t("langKeys.{0}.{1} \u5FC5\u987B\u662F\u5BF9\u8C61", lay, key) };
          }
          const clean = {};
          if (cell.alt != null) {
            if (typeof cell.alt !== "string" || [...cell.alt].length < 1 || [...cell.alt].length > 3) {
              return { ok: false, error: t("langKeys.{0}.{1} \u7684 alt \u9700\u4E3A 1-3 \u4E2A\u5B57\u7B26", lay, key) };
            }
            clean.alt = cell.alt;
          }
          for (const slot of ["up", "down"]) {
            const tap = cell[slot];
            if (tap == null) continue;
            if (typeof tap !== "string" || [...tap].length > CUSTOM_LIMITS.tapChars) {
              return { ok: false, error: t(
                "langKeys.{0}.{1} \u7684 {2} \u9700\u4E3A 1-{3} \u5B57\u7B26",
                lay,
                key,
                slot,
                CUSTOM_LIMITS.tapChars
              ) };
            }
            const parsed = this.parseTapDsl(tap);
            if (parsed.error) {
              return { ok: false, error: t("langKeys.{0}.{1} \u7684 {2} {3}", lay, key, slot, parsed.error) };
            }
            clean[slot] = tap;
          }
          if (!Object.keys(clean).length) {
            return { ok: false, error: t("langKeys.{0}.{1} \u81F3\u5C11\u8981\u5B9A\u4E49 alt/up/down \u4E4B\u4E00", lay, key) };
          }
          cleanTable[key] = clean;
          any = true;
        }
        if (Object.keys(cleanTable).length) out[lay] = cleanTable;
      }
      return { ok: true, value: any ? out : null };
    }
    /** Fire one custom key - text chunks commit literally,
     * key/combo steps go through sendCombo (same channel as the ctrl
     * layer). Steps were validated when the table was saved; a table
     * edited out-of-band re-validates defensively. */
    /** #39-12：cell 的 tap 恰好是单个裸 Backspace（无文本/无修饰）
     *  → 退格专属渲染（specialKey + 长按连删）。 */
    /** 自定义行按需缩放（2026-10-04）：比例相对【当前字号】算
     *  （cur × avail / sw），多轮精化补 min-width/padding 不随字缩
     *  的残差；下限 55%，放不下交还横向滚动。resize/旋转后幂等重跑
     *  （行几何随视口变），无布局环境（mock/隐藏）clientWidth=0
     *  自动跳过。 */
    fitCustomRow(strip) {
      strip.style.fontSize = "";
      const avail = strip.clientWidth;
      if (!avail) return;
      for (let round = 0; round < 3 && strip.scrollWidth > avail; round++) {
        const cur2 = parseInt(strip.style.fontSize, 10) || 100;
        const pct = Math.round(cur2 * avail / strip.scrollWidth);
        const clamped = Math.max(55, Math.min(pct, cur2));
        strip.style.fontSize = clamped + "%";
        if (clamped <= 55) break;
      }
      let cur = parseInt(strip.style.fontSize, 10) || 100;
      while (strip.scrollWidth > avail && cur > 55) {
        cur = Math.max(55, cur - 1);
        strip.style.fontSize = cur + "%";
      }
    }
    customCellIsBackspace(cell) {
      const parsed = this.parseTapDsl(cell.tap);
      if (parsed.error) return false;
      const steps = parsed.steps;
      return steps.length === 1 && steps[0].combo && steps[0].combo.length === 1 && steps[0].combo[0] === "Backspace";
    }
    // #48（omt vim 退不出）：xterm.js 宿主里 commitText 的落地是
    // 异步的 composition 流，紧跟其后的 keyEvent 会把它掐死——
    // 定制键序列 [esc]:wq[enter] 实测 onData 只有 \x1b 和 \r，:wq
    // 蒸发，vim 收到 ESC 退出插入模式后光标下移一行，不保存退出。
    // 方向实测（真机 xterm+onData 矩阵）：键→文本 0ms 安全；文本→
    // 键 0ms 致死、150ms 起全通（取 300ms 余量）。故只在文本步后面
    // 还跟键步时垫台阶。Termux 等原生终端视图无此坑，垫了也无感。
    // 同步跑到台阶点、余下步骤 setTimeout 续跑（纯定时器，假时钟可测）。
    runCustomCell(cell) {
      const parsed = this.parseTapDsl(cell.tap);
      if (parsed.error) {
        this.showToast(t("\u6309\u952E\u65E0\u6548\uFF1A{0}", parsed.error));
        return;
      }
      this.customChainQueue.push(parsed.steps);
      this.pumpCustomChain();
    }
    /** 队列泵：上一条宏跑完（或整链作废）才起下一条。衔接处的
     *  text→key 间距由 customChainLastTextAt 时间窗统一裁决——跨宏/
     *  跨点击的相邻与宏内同罪同罚，几秒后的新点击不垫冤枉台阶。 */
    pumpCustomChain() {
      if (this.customChainActive) return;
      const steps = this.customChainQueue.shift();
      if (!steps) return;
      this.customChainActive = true;
      this.runCustomStepsFrom(steps, 0);
    }
    /** 作废在途宏链：native onStartInput（编辑器换代，经
     *  Feelime.cancelCustomChain 钩子）与收起链（cancelTouches）
     *  触发——台阶里的延迟键步不能发进新输入框，队列整段丢弃。 */
    cancelCustomChain() {
      this.customChainQueue.length = 0;
      if (this.customChainTimer) {
        clearTimeout(this.customChainTimer);
        this.customChainTimer = 0;
      }
      this.customChainActive = false;
      this.customChainLastTextAt = 0;
    }
    /** #50 面板动作分发（唯一入口）：长按空格动作与定制按键
     *  [panel:x] 步骤共用。一次性打开，无收尾语义。 */
    runPanelStep(target) {
      if (target === "clipboard") this.openPanel("clipboard");
      else if (target === "favorites") this.openPanel("favorites");
      else if (target === "edit") this.toggleEditPanel();
      else if (target === "control") this.setControlView(true);
      else if (target === "emoji") {
        this.emojiView = true;
        this.showNumpad();
      } else if (target === "custom") this.showCustomTab();
      else if (target === "kaomoji") this.openPanel("kaomoji");
    }
    /** 直达符号面板的「定制」tab（#39-12 工具栏按钮的直达逻辑，
     *  #65 抽出供 [panel:custom] 复用）。空表引导去设置页；打开
     *  语义：重复调用停在定制 tab（工具栏按钮的 toggle 不在此）。 */
    showCustomTab() {
      if (!this.hasCustomRows()) {
        this.showToast(t("\u8FD8\u6CA1\u6709\u5B9A\u5236\u6309\u952E\uFF0C\u53BB\u8BBE\u7F6E\u7684\u5B9A\u5236\u6309\u952E\u91CC\u4FDD\u5B58"));
        this.call(() => Native.openSetupPage("customTitle", this.token));
        return;
      }
      this.showSymbols();
      this.symbolCat = "custom";
      document.querySelectorAll("[data-sym-cat]").forEach((el) => el.classList.toggle("active", el.dataset.symCat === "custom"));
      this.renderSymbols();
      const customTab = document.querySelector('[data-sym-cat="custom"]');
      if (customTab && customTab.scrollIntoView) {
        customTab.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest"
        });
      }
    }
    /** 定制表里有没有实际按键（#65）：`[]`/`[[],[],[]]` 是合法但
     *  空的表，customKeys() 对它们返回真值——判空按「任一行有键」
     *  口径。分类条过滤、工具栏按钮、[panel:custom] 三处共用，
     *  避免「只有语言键定制、符号行为空」时打开零按键的定制页。 */
    hasCustomRows() {
      return (this.customKeys() || []).some((row) => Array.isArray(row) && row.length > 0);
    }
    /** [edit:x] 的组合键形态（无则 null：cut/copy/paste/selectAll/clear
     *  走原生通道，不占用组合键事件）。供台阶判断与执行共用。 */
    editOpCombo(op) {
      switch (op) {
        case "undo":
          return ["Ctrl", "Z"];
        case "redo":
          return ["Ctrl", "Shift", "Z"];
        case "cursorLeft":
          return ["Ctrl", "ArrowLeft"];
        case "cursorRight":
          return ["Ctrl", "ArrowRight"];
        case "lineStart":
          return ["Home"];
        case "lineEnd":
          return ["End"];
        default:
          return null;
      }
    }
    /** [edit:x] 执行：原生 action 优先（与编辑工具栏同通道），无原生
     *  action 的（undo/redo/光标类）发等价组合键。 */
    runEditStep(op) {
      const native = { cut: 1, copy: 1, paste: 1, selectAll: 1 }[op];
      if (native) {
        if (typeof Native.editorAction !== "function") {
          this.showToast(t("\u6B64\u6309\u952E\u9700\u8981\u5347\u7EA7 App \u540E\u4F7F\u7528\uFF08\u7F16\u8F91\u64CD\u4F5C\uFF09"));
          return;
        }
        this.call(() => Native.editorAction(op, this.token));
        return;
      }
      if (op === "clear") {
        if (typeof Native.clearEditorText !== "function") {
          this.showToast(t("\u6B64\u6309\u952E\u9700\u8981\u5347\u7EA7 App \u540E\u4F7F\u7528\uFF08\u7F16\u8F91\u64CD\u4F5C\uFF09"));
          return;
        }
        this.call(() => Native.clearEditorText(this.token));
        return;
      }
      const combo = this.editOpCombo(op);
      if (combo) this.sendCombo(combo);
    }
    /** 纯 DSL 串执行（虚拟按键用：语言键盘上滑/下滑、空格长按）：
     *  与定制键宏同一队列同一台阶语义，错误给 toast。 */
    runTapDsl(tap) {
      const parsed = this.parseTapDsl(tap);
      if (parsed.error) {
        this.showToast(t("\u6309\u952E\u65E0\u6548\uFF1A{0}", parsed.error));
        return;
      }
      this.customChainQueue.push(parsed.steps);
      this.pumpCustomChain();
    }
    /** #48：DSL 步骤执行器。文本步→键步的通道切换处垫台阶到
     *  距最后一次文本发送满 300ms（见 runCustomCell 上方注释）；
     *  同步跑到台阶点，余下步骤 setTimeout 续跑（无 async，假时钟
     *  可测——harness 的 Date 已接 FakeClock）。 */
    runCustomStepsFrom(steps, index) {
      for (let i = index; i < steps.length; i++) {
        const step = steps[i];
        if (step.open) {
          if (typeof Native.openLink !== "function") {
            this.showToast(t("\u6B64\u6309\u952E\u9700\u8981\u5347\u7EA7 App \u540E\u4F7F\u7528\uFF08\u6253\u5F00\u94FE\u63A5\uFF09"));
            this.cancelCustomChain();
            return;
          }
          this.call(() => Native.openLink(step.open, this.token));
        } else if (step.openSetup) {
          if (typeof Native.openSetupPage !== "function") {
            this.showToast(t("\u6B64\u6309\u952E\u9700\u8981\u5347\u7EA7 App \u540E\u4F7F\u7528\uFF08\u6253\u5F00\u8BBE\u7F6E\uFF09"));
            this.cancelCustomChain();
            return;
          }
          this.call(() => Native.openSetupPage(step.openSetup, this.token));
        } else if (step.panel) {
          this.runPanelStep(step.panel);
        } else if (step.edit) {
          const sinceEdit = Date.now() - this.customChainLastTextAt;
          const combo = this.editOpCombo(step.edit);
          if (combo && sinceEdit < 300) {
            this.customChainTimer = setTimeout(() => {
              this.customChainTimer = 0;
              if (!this.customChainActive) return;
              this.runEditStep(step.edit);
              this.runCustomStepsFrom(steps, i + 1);
            }, 300 - sinceEdit);
            return;
          }
          this.runEditStep(step.edit);
        } else if (step.text) {
          this.sendSymbol(step.text);
          this.customChainLastTextAt = Date.now();
        } else {
          const sinceText = Date.now() - this.customChainLastTextAt;
          if (sinceText < 300) {
            this.customChainTimer = setTimeout(() => {
              this.customChainTimer = 0;
              if (!this.customChainActive) return;
              this.sendCombo(step.combo);
              this.runCustomStepsFrom(steps, i + 1);
            }, 300 - sinceText);
            return;
          }
          this.sendCombo(step.combo);
        }
      }
      this.customChainActive = false;
      this.pumpCustomChain();
    }
    symbolCategoryRows() {
      let values;
      if (VARIANT_TABLES[this.symbolCat]) {
        values = this.rowsFor(this.symbolCat).flat();
      } else if (this.symbolCat === "recent") {
        values = this.recent();
        for (const row of this.commonRows()) {
          for (const value of row) {
            if (values.length >= 30) break;
            if (!values.includes(value)) values.push(value);
          }
        }
      } else {
        const category = SYMBOL_CATEGORIES.find((c) => c.id === this.symbolCat) || SYMBOL_CATEGORIES[0];
        values = category.rows.flat();
      }
      const rows = [];
      for (let i = 0; i < values.length; i += 10) rows.push(values.slice(i, i + 10));
      return rows;
    }
    /** 通用符号格：click-only，绝不 bindTouch——bindTouch 的
     * touchstart preventDefault 会杀 #symGrid 的竖向原生滚动
     * （.ink-scroll/.num-syms/.sym-custom-row 同批教训），pan-y 由
     * CSS 在 .sym-grid-inner .kb-key 上重申。触感放 click 时点：
     * 从格上起手拖动滚动不该震（inkSymbolCell 同口径）。 */
    symCell(value, opts = {}) {
      const button = document.createElement("button");
      button.className = "kb-key " + (value.length > 1 ? "sym-multi" : "sym-single");
      button.textContent = value;
      button.setAttribute("aria-label", value);
      button.addEventListener("click", () => {
        this.nativeKeyFeedback();
        this.sendSymbol(value);
        this.remember(value);
        if (opts.rerender) this.renderSymbols();
      });
      return button;
    }
    renderSymbols() {
      if (this.symbolCat === "custom") {
        const grid2 = document.getElementById("symGrid");
        grid2.textContent = "";
        const wrap = document.createElement("div");
        wrap.className = "sym-custom";
        const rowsBox = document.createElement("div");
        rowsBox.className = "sym-custom-rows";
        const rows = this.customKeys() || [[], [], []];
        rows.forEach((row) => {
          const strip = document.createElement("div");
          strip.className = "kb-row sym-custom-row";
          const align = (row || []).map((c) => c && c.align).find((a) => a === "left" || a === "center" || a === "right");
          if (align) strip.dataset.align = align;
          (row || []).forEach((cell) => {
            if (this.customCellIsBackspace(cell)) {
              strip.append(this.specialKey(
                "backspace",
                ICONS.backspace,
                () => this.backspaceAction(),
                "kb-special sym-custom-key",
                "repeat"
              ));
              return;
            }
            const button = document.createElement("button");
            button.className = "kb-key sym-custom-key";
            const hueM = cell.color ? /^h(\d{1,3})(?:s(\d{1,3}))?$/.exec(cell.color) : null;
            const hexM = cell.color ? /^#[0-9a-fA-F]{6}$/.test(cell.color) : false;
            if (hexM) {
              const chan = /* @__PURE__ */ __name((v) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              }, "chan");
              const lum = /* @__PURE__ */ __name((hex) => {
                const n = parseInt(hex.slice(1), 16);
                return 0.2126 * chan(n >> 16 & 255) + 0.7152 * chan(n >> 8 & 255) + 0.0722 * chan(n & 255);
              }, "lum");
              const L = lum(cell.color);
              const better = /* @__PURE__ */ __name((ink) => (Math.max(L, ink) + 0.05) / (Math.min(L, ink) + 0.05), "better");
              button.style.background = cell.color;
              button.style.borderColor = cell.color;
              button.style.color = better(lum("#1a1a1a")) >= better(lum("#ffffff")) ? "#1a1a1a" : "#fff";
            } else if (cell.color && !hueM && CUSTOM_KEY_COLORS.includes(cell.color)) {
              button.classList.add("ck-" + cell.color);
            } else if (hueM) {
              const sat = hueM[2] != null ? hueM[2] : 65;
              button.style.background = "hsl(" + hueM[1] + ", " + sat + "%, 45%)";
              button.style.borderColor = "hsl(" + hueM[1] + ", " + sat + "%, 35%)";
              button.style.color = "#fff";
            }
            if (cell.span === 2 || cell.span === 3) {
              button.dataset.span = String(cell.span);
            }
            button.textContent = cell.t;
            button.addEventListener("click", () => this.runCustomCell(cell));
            if (cell.note) {
              this.bindItemLongPress(button, () => {
                this.showKeyNote(button, cell.note);
                const dismiss = /* @__PURE__ */ __name(() => {
                  const tip = document.getElementById("keyNote");
                  if (tip) tip.remove();
                  button.removeEventListener("touchend", dismiss);
                  button.removeEventListener("touchcancel", dismiss);
                }, "dismiss");
                button.addEventListener("touchend", dismiss, { passive: true });
                button.addEventListener("touchcancel", dismiss, { passive: true });
              });
            }
            strip.append(button);
          });
          rowsBox.append(strip);
        });
        wrap.append(rowsBox);
        grid2.append(wrap);
        [...rowsBox.children].forEach((strip) => this.fitCustomRow(strip));
        return;
      }
      const grid = document.getElementById("symGrid");
      grid.replaceChildren();
      if (this.symbolCat === "arrows") {
        const arrowsRows = [
          [["\u2190"], ["\u2191"], ["\u2192"], ["\u2193"], ["\u2194"], ["\u2195"], ["\u2196"], ["\u2197"], ["\u2198"], ["\u2199"]],
          [["\u21E6"], ["\u21E8"], ["\u21E7"], ["\u21E9"], ["\u21A9"], ["\u21AA"], ["\u21B0"], ["\u21B1"], ["\u21B2"], ["\u21B3"]]
        ];
        const wrap = document.createElement("div");
        wrap.className = "sym-arrows";
        arrowsRows.forEach((cells) => {
          const row = this.row();
          cells.forEach(([glyph, text]) => {
            const value = text || glyph;
            row.append(this.functionKey(
              glyph,
              () => {
                this.sendSymbol(value);
                if (!text) this.remember(glyph);
              },
              "sym-single"
            ));
          });
          while (row.children.length < 10) {
            const blank = document.createElement("span");
            blank.className = "sym-blank";
            row.append(blank);
          }
          wrap.append(row);
        });
        grid.append(wrap);
        return;
      }
      const inner = document.createElement("div");
      inner.className = "sym-grid-inner";
      this.symbolCategoryRows().forEach((values) => {
        const row = this.row();
        const cells = [...values];
        while (cells.length < 10) cells.push("");
        cells.forEach((value) => {
          if (value === "") {
            const blank = document.createElement("span");
            blank.className = "sym-blank";
            row.append(blank);
            return;
          }
          row.append(this.symCell(value, { rerender: this.symbolCat === "recent" }));
        });
        inner.append(row);
      });
      grid.append(inner);
      grid.scrollTop = 0;
      grid.classList.toggle(
        "sym-scrollable",
        grid.scrollHeight > grid.clientHeight
      );
    }
    /* ===== control-key layer  ===== */
    /** Swap the TOOLBAR for the two control-key rows (the bar's 40px
     * slot, The rows never exceed the slot so the keyboard
     * body keeps its height). The ctrl view is a SWITCH: composing or
     * a panel only SUSPENDS it (see suspendCtrlView), the user turns
     * it off with the X. Any layer that owns the bar blocks entering. */
    setControlView(on) {
      if (on && this.composing) return;
      if (on && this.panelOpen) return;
      if (on && document.getElementById("settingsPanel").classList.contains("open")) return;
      if (on && !document.getElementById("editLayer").hidden) return;
      if (on && document.body.classList.contains("editing")) return;
      this.ctrlView = on;
      this.ctrlSuspended = false;
      this.hwNotifyPanelHeight();
      document.body.classList.toggle("ctrl-view", on);
      document.getElementById("ctrlLayer").hidden = !on;
      document.getElementById("candidateBar").hidden = on;
      if (!on) {
        this.closeComboGrid();
        this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
      }
      this.renderCtrlSticky();
      this.applyHeight();
    }
    /** The ctrl view is a switch, not a one-shot. When a
     * composition (or a panel) borrows the toolbar, the display hands
     * the bar back but the switch STAYS ON; maybeResumeCtrlView brings
     * the rows back once the borrower leaves. */
    suspendCtrlView() {
      if (!this.ctrlView || this.ctrlSuspended) return;
      this.ctrlSuspended = true;
      this.closeComboGrid();
      this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
      this.renderCtrlSticky();
      document.body.classList.remove("ctrl-view");
      document.getElementById("ctrlLayer").hidden = true;
      document.getElementById("candidateBar").hidden = false;
      this.applyHeight();
    }
    maybeResumeCtrlView() {
      if (!this.ctrlView || !this.ctrlSuspended) return;
      if (this.composing || this.panelOpen) return;
      if (document.body.classList.contains("editing")) return;
      if (document.getElementById("settingsPanel").classList.contains("open")) return;
      this.ctrlSuspended = false;
      document.body.classList.add("ctrl-view");
      document.getElementById("ctrlLayer").hidden = false;
      document.getElementById("candidateBar").hidden = true;
      this.applyHeight();
    }
    /** Pressed feedback for buttons that keep their native
     * click path (no bindTouch) - the class goes on directly; :active
     * alone is unreliable on touch. */
    bindPressFeedback(el) {
      el.addEventListener("touchstart", () => {
        this.pressedKeys.add(el);
        el.classList.add("active-touch");
      }, { passive: true });
      const finish = /* @__PURE__ */ __name(() => {
        this.pressedKeys.delete(el);
        el.classList.remove("active-touch");
      }, "finish");
      el.addEventListener("touchend", finish);
      el.addEventListener("touchcancel", finish);
    }
    bindCtrlLayer() {
      document.querySelectorAll("#ctrlLayer [data-ctrl]").forEach((button) => {
        this.bindPressFeedback(button);
        button.addEventListener("click", () => {
          if (button._suppressClick) {
            button._suppressClick = false;
            return;
          }
          this.handleCtrlKey(button.dataset.ctrl);
        });
        if (button.classList.contains("ctrl-mod") || button.classList.contains("ctrl-combo")) {
          button.addEventListener("touchstart", () => {
            button._comboTimer = setTimeout(() => {
              button._suppressClick = true;
              this.openComboGrid(
                button.dataset.ctrl === "sticky-fn" ? "comb" : button.dataset.ctrl.replace("sticky-", ""),
                button
              );
            }, 350);
          }, { passive: true });
          button.addEventListener("touchend", () => {
            clearTimeout(button._comboTimer);
          });
          button.addEventListener("touchcancel", () => {
            clearTimeout(button._comboTimer);
            button._suppressClick = false;
          });
        }
      });
      document.getElementById("comboPopup").addEventListener("click", (event) => {
        if (event.target.id === "comboPopup") this.closeComboGrid();
      });
    }
    /** Sticky modifiers: Ctrl/Alt/Meta/Fn arm the NEXT key into a combo
     * (reference terminal-keyboard behaviour); they light up and clear
     * after the combo lands. Fn additionally relabels the letter rows
     * (renderFnLabels). */
    renderCtrlSticky() {
      document.querySelectorAll("#ctrlLayer .ctrl-mod").forEach((button) => {
        const mod = button.dataset.ctrl.replace("sticky-", "");
        const meta = mod === "ctrl" ? "Ctrl" : mod === "alt" ? "Alt" : mod === "fn" ? "Fn" : "Meta";
        button.classList.toggle("active", this.sticky[meta]);
      });
      this.renderFnLabels();
    }
    /** While Fn is armed the twelve mapped keys print their
     * F-number as the main glyph (the letter drops to the small alt
     * slot). The OFF branch restores the base glyphs itself - every
     * disarm path (sendCombo, second-tap disarm, collapse/suspend) only
     * calls renderCtrlSticky, and an earlier review showed an early return
     * left F1..F12 printed while taps already typed letters. The alt
     * slot must go back to the mode's alt hint, not the bare letter. */
    renderFnLabels() {
      const on = this.ctrlView && this.sticky.Fn;
      const chinese = this.mode === "pinyin" || this.mode === "double-pinyin" || this.mode === "flypy";
      const upper = this.shift || this.caps;
      document.querySelectorAll("#qwertyLayer [data-key]").forEach((button) => {
        const key = button.dataset.key;
        if (!FN_KEYS[key]) return;
        const main = button.querySelector(".kb-main");
        const alt = button.querySelector(".kb-alt");
        if (!main || !alt) return;
        button.classList.toggle("fn-label", on);
        if (on) {
          main.textContent = FN_KEYS[key];
          alt.textContent = chinese || upper ? key.toUpperCase() : key;
        } else {
          main.textContent = chinese || upper ? key.toUpperCase() : key;
          alt.textContent = this.keyAltHint(key);
        }
      });
    }
    handleCtrlKey(action) {
      if (action === "collapse") {
        this.setControlView(false);
        return;
      }
      if (action.startsWith("sticky-")) {
        const meta = action === "sticky-ctrl" ? "Ctrl" : action === "sticky-alt" ? "Alt" : action === "sticky-fn" ? "Fn" : "Meta";
        if (this.sticky[meta]) {
          if (meta === "Fn") {
            this.sticky.Fn = false;
            this.renderCtrlSticky();
            return;
          }
          this.sendCombo([STICKY_ALONE[meta]]);
          return;
        }
        this.sticky[meta] = true;
        this.renderCtrlSticky();
        return;
      }
      const mods = Object.keys(this.sticky).filter((key) => this.sticky[key]);
      if (this.shift) mods.push("Shift");
      this.sendCombo([...mods, action]);
    }
    /** Send one host key event: [modifiers..., key] -> keycode + meta
     * bits over Native.keyEvent (whitelisted on the native side).
     * EVERY modifier combo rides the PHYSICAL channel
     * (modifier key down -> key down/up -> modifier up). The RDP round
     * proved the single-event form leaves the remote Alt held down -
     * the Alt+Tab switcher never commits (the client synthesizes
     * Alt-down from the meta bit but no matching Alt-up), the same
     * failure class as the original Win report. Ctrl/Shift join them
     * for one uniform sequence that mirrors a physical left-hand press. */
    sendCombo(parts) {
      const label = parts[parts.length - 1];
      const keyCode = this.keyCodeFor(label);
      if (!keyCode) return;
      let meta = 0;
      parts.slice(0, -1).forEach((mod) => {
        meta |= CTRL_META_BITS[mod] || 0;
      });
      const physical = meta !== 0 && typeof Native.keyEventPhysical === "function";
      this.call(() => physical ? Native.keyEventPhysical(keyCode, meta, this.token) : Native.keyEvent(keyCode, meta, this.token));
      this.sticky = { Ctrl: false, Alt: false, Meta: false, Fn: false };
      this.renderCtrlSticky();
      if (this.shift) {
        this.shift = false;
        this.updateLabels();
      }
    }
    keyCodeFor(label) {
      if (CTRL_KEY_CODES[label] !== void 0) return CTRL_KEY_CODES[label];
      if (/^[A-Z]$/.test(label)) return 29 + label.charCodeAt(0) - 65;
      return 0;
    }
    /** The 3x3 combo grid floats above the control layer; cells carry
     * the full key names stacked per line (demo round 3). 
     * #0.3: placement hugs the trigger's top edge across the WHOLE IME
     * window (band included), shrinking its cells if the headroom is
     * short - the trigger key itself is never covered and the card
     * never straddles the key rows half-off (design §0 总原则).
     * Tapping the anchor again only closes the card. */
    openComboGrid(grid, anchor) {
      const popup = document.getElementById("comboPopup");
      const inner = document.getElementById("comboPopupInner");
      inner.replaceChildren();
      (COMBO_GRIDS[grid] || []).forEach((combo) => {
        const cell = document.createElement("button");
        cell.className = "combo-cell";
        combo.forEach((part, index) => {
          const line = document.createElement("span");
          line.className = index === combo.length - 1 ? "combo-main" : "combo-mod";
          line.textContent = part;
          cell.append(line);
        });
        cell.addEventListener("click", () => {
          this.closeComboGrid();
          this.sendCombo(combo);
        });
        inner.append(cell);
      });
      this.comboGrid = grid;
      this.comboAnchor = anchor || null;
      popup.classList.add("open");
      const rect = anchor.getBoundingClientRect();
      const availUp = rect.top - 20;
      popup.style.removeProperty("--combo-cell");
      if (popup.offsetHeight > availUp) {
        popup.style.setProperty(
          "--combo-cell",
          Math.max(40, Math.floor((availUp - 26) / 3)) + "px"
        );
      }
      const cardW = popup.offsetWidth;
      const cardH = popup.offsetHeight;
      const left = Math.max(16, Math.min(
        innerWidth - cardW - 16,
        rect.left + rect.width / 2 - cardW / 2
      ));
      if (cardH <= availUp) {
        popup.style.left = left + "px";
        popup.style.top = rect.top - cardH - 6 + "px";
      } else {
        const cy = rect.top + rect.height / 2;
        popup.style.top = Math.max(14, Math.min(cy - cardH / 2, innerHeight - cardH - 4)) + "px";
        popup.style.left = (rect.right + 8 + cardW <= innerWidth - 16 ? rect.right + 8 : Math.max(16, rect.left - 8 - cardW)) + "px";
      }
      this.syncOverlay();
    }
    closeComboGrid() {
      this.comboGrid = null;
      this.comboAnchor = null;
      const popup = document.getElementById("comboPopup");
      popup.classList.remove("open");
      this.syncOverlay();
    }
    /* ===== #H 硬键盘候选条形态（design hardware-keyboard.md §5）=====
     * body.hwkb = hardwareKeyboard（hello 字段）&& 档位==candidates &&
     * mode∈引擎文本模式。手写/T9/笔画/direct 即使硬键盘在也显示完整
     * 键盘（笔迹区/九键/英文键帽必须可见）。档位存 native pref
     * （feelime_hwkb_form），随 hello 的 hwkbForm 字段下发。
     * 高度由 native 的 contentHeightPx 收缩——CSS 只隐藏键区。 */
    applyHwForm() {
      const active = !!this.hardwareKeyboard && (this.hwkbForm || "candidates") === "candidates" && HW_TEXT_MODES.has(this.mode);
      if (document.body.classList.contains("hwkb") === active) return;
      document.body.classList.toggle("hwkb", active);
      this.applyHeight();
      this.hwNotifyPanelHeight();
      this.updateHwModeTag();
    }
    /* ===== #H 面板高度态（design §7，codex 评审 P1-9）=====
     * 候选条形态下面板/控制层/语音遮罩开关时通知 native 换窗口高度：
     * candidates=候选条预算、ctrl=控制行预算、full=完整键盘高度。
     * 状态取自标志位（时序无关 DOM），native 侧只在 hwkb 形态
     * 分支消费该值，其余形态自然忽略。 */
    /** #H 候选条形态快捷切换键（#87 顺带优化）：modeToggle 的紧凑
     *  形态——cn-main=当前模式简称、cn-sub=快捷对目标简称（看清「在
     *  哪」与「下一站是谁」，比单行两字全名更可辨）；点按翻对、长按
     *  完整模式菜单（软键盘切换键同交互）。
     *
     *  #87 定案：标签刷新不得挂在 applyHwForm 的形态早退下——形态
     *  未变的纯模式切换（如 双拼→形码）会被短路滞留旧名（用户实录
     *  + AVD 复现）。现挂三处确定性刷新：updateLabels / hello（
     *  adoptQuickPair 之后）/ 引擎态模式变更分支。显隐由这里管
     *  （CSS [hidden] 兜底），非文本模式随形态隐藏。 */
    updateHwModeTag() {
      const el = document.getElementById("hwModeTag");
      if (!el) return;
      const active = document.body.classList.contains("hwkb") && HW_TEXT_MODES.has(this.mode);
      el.hidden = !active;
      if (!active) return;
      el.querySelector(".cn-main").textContent = modeLabel(this.mode);
      el.querySelector(".cn-sub").textContent = modeLabel(this.quickSwitchTarget());
    }
    hwPanelHeightState() {
      if (["listening", "loading", "stopping"].includes(this.voiceState)) return "full";
      if (this.panelOpen || this.expanded || this.keyLayer === "numpad" || this.keyLayer === "symbols" || document.body.classList.contains("editing") || this.toolbarEdit || this.keyLayer === "settings" || this.keyLayer === "stats" || this.keyLayer === "edit") return "full";
      if (this.ctrlView) return "ctrl";
      return "candidates";
    }
    hwNotifyPanelHeight() {
      if (typeof Native.hwPanelHeight !== "function") return;
      const state = this.hwPanelHeightState();
      if (state === this.hwPanelHeightSent) return;
      this.hwPanelHeightSent = state;
      this.call(() => Native.hwPanelHeight(state, this.token));
    }
    /* ===== orientation & keyboard height  ===== */
    applyOrientation(landscape) {
      if (this.landscape === landscape) return;
      this.landscape = landscape;
      document.body.classList.toggle("landscape", landscape);
      this.kbHeight = this.storedKbHeight();
      this.renderMode();
      this.applyHeight();
      const memKey = this.floatMemoryKey();
      if (this._floatOrientKey === void 0) {
        this._floatOrientKey = memKey;
      } else if (this._floatOrientKey !== memKey) {
        this._floatOrientKey = memKey;
        this.applyFloatMemory(true);
      }
    }
    /** Saved CONTENT keyboard height (CSS px) for the current orientation;
     * 0 = native default (272). Legacy keys held a per-row height (<100)
     * - ignored so an old value cannot clamp the new content height. */
    storedKbHeight() {
      const nativeValue = Math.round(this.nativeStoredHeightCss || 0);
      return nativeValue >= 120 ? nativeValue : 0;
    }
    /** The native side owns the content height; its view also carries the
     * bottom safe area. Keep the rows inside the content portion so the
     * same content height gives the same key height in both orientations.
     * chrome = top pad + bar + gaps + bottom pad, including the inter-row
     * margins (portrait 14+2+40+10+5+3*5 = 86). */
    safeBottomPx() {
      return Math.max(0, Number(this.safeBottom) || 0);
    }
    /** Fixed vertical space outside the four qwerty rows. Candidate and
     * control slots have the same total height (design §11). The
     * composing-preedit band rides the top of that budget; its height
     * mirrors the CSS --preedit-band levels (18/22/25px — sized to a
     * CJK font line box so vendor fonts don't clip descenders, issue
     * #8): the rows shrink by 4/8/11 against the old 14px base. */
    layoutChrome() {
      const bandExtra = this.preeditFont === 2 ? 11 : this.preeditFont === 1 ? 8 : 4;
      return (this.landscape ? 78 : 86) + bandExtra;
    }
    /** Read the native view's total height back as content height. The
     * fallback keeps the preview usable before its layout has measured. */
    currentContentHeight(fallback = 272) {
      const view = document.getElementById("softKeyboard");
      const measured = Number(view && view.clientHeight);
      const safe = this.safeBottomPx();
      const pad = this.bottomPadPx();
      const total = Number.isFinite(measured) && measured > 0 ? measured : Number(fallback) + safe + pad;
      return Math.max(0, Math.round(total - safe - pad));
    }
    /** The bottom blank strip in CSS px (dp == px in this WebView);
     * mirrored into CSS so #softKeyboard's bottom padding owns the
     * exact same space the JS budgets exclude (mode-fallback §3). */
    bottomPadPx() {
      return Math.max(0, Number(this.bottomPad) || 0);
    }
    // 候选字号：80-150 连续百分比直写 CSS 变量（issue #42 替代
    // 三档 data 属性），行高预算不动。
    applyCandidateFont() {
      const pct = Number(this.candidateFont);
      const clamped = Number.isFinite(pct) ? Math.min(150, Math.max(80, pct)) : 100;
      document.body.dataset.candFont = clamped === 100 ? "normal" : "scaled";
      document.body.style.setProperty("--cand-font-scale", String(clamped / 100));
    }
    // 键帽字号（issue #70）：50-150 连续百分比直写 --keycap-font-scale，
    // 只缩放键面文字，行高/触摸区预算不动；与角标的碰撞由 CSS min()
    // 静态钳制（见 .kb-main/.t9-group），缩小侧无碰撞风险。
    applyKeycapFont() {
      const pct = Number(this.keycapFont);
      const clamped = Number.isFinite(pct) ? Math.min(150, Math.max(50, pct)) : 100;
      document.body.dataset.keycapFont = clamped === 100 ? "normal" : "scaled";
      document.body.style.setProperty("--keycap-font-scale", String(clamped / 100));
      this.applyKeycapMetrics();
    }
    /** 键帽水位线（#55 用户反馈 5）：按键上边/角标/主字/下边四段
     * 空白按 3:6:4 分摊行高余量——高度变化（悬浮缩放、停靠高度
     * 设置）时三段留白等比伸缩，不再让中间空隙独吞增量。44px 行
     * 高 100% 字号的输出与旧实现逐像素一致（3/9/22/4px），存量
     * 视觉零跳变。字号由 JS 算好写 var：CSS min()/max() 要
     * Chrome 79+，WebView 66 上整条 font-size 静默失效（#90 遗留
     * 盲区，顺手修掉）。 */
    applyKeycapMetrics(H) {
      const root = document.documentElement.style;
      if (!(H > 0)) {
        const rowStr = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement).getPropertyValue("--kb-row-h") : "";
        H = parseFloat(rowStr) || 44;
      }
      const pct = Number(this.keycapFont);
      const S = (Number.isFinite(pct) ? Math.min(150, Math.max(50, pct)) : 100) / 100;
      const px = /* @__PURE__ */ __name((v) => Math.round(v * 100) / 100 + "px", "px");
      if (H < 24) {
        root.setProperty("--cap-alt-size", "0px");
        root.setProperty("--cap-main-size", px(Math.min(Math.min(22, H * 0.5) * S, H * 0.8)));
        document.body.dataset.capSingle = "on";
        return;
      }
      document.body.dataset.capSingle = "off";
      const A = Math.max(9, Math.min(11, 9 * H / 44));
      const M = Math.min(Math.min(22, H * 0.5) * S, H * 0.8 - A);
      const R = H - A - M;
      root.setProperty("--cap-alt-size", px(A));
      root.setProperty("--cap-main-size", px(M));
      root.setProperty("--cap-top", px(R * 3 / 13));
      root.setProperty("--cap-gap", px(R * 6 / 13));
      root.setProperty("--cap-bottom", px(R * 4 / 13));
    }
    // 用户字体（issue #70）：digest 非空时挂同源 face.css（@font-face
    // 定义在里面，CSP style-src 'self' 不允许内联）并切 --kb-font；
    // digest 空 = 移除。digest 不变不重挂（重导字体换 digest，URL 随
    // 之换，绕开 WebView 缓存钉死）。
    applyUserFont(digest) {
      digest = String(digest || "");
      if (digest === this.userFontDigest && this.userFontLink_) return;
      this.userFontDigest = digest;
      if (this.userFontLink_ && this.userFontLink_.parentNode) {
        this.userFontLink_.remove();
      }
      this.userFontLink_ = null;
      if (!digest) {
        document.body.style.setProperty("--kb-font", "system-ui");
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/keyboard/fonts/" + encodeURIComponent(digest) + "/face.css";
      link.onerror = () => {
        if (this.userFontLink_ === link) {
          document.body.style.setProperty("--kb-font", "system-ui");
        }
      };
      this.userFontLink_ = link;
      (document.head || document.documentElement).appendChild(link);
      document.body.style.setProperty("--kb-font", '"FeelimeUser"');
    }
    // 拼音字号（issue #8）：悬浮带回 1.0.13 的顶部形态，档位驱动
    // --preedit-font-scale（字号）与 --preedit-band-scale（带高 +
    // 顶部 padding/横屏 bar margin，随档位让位）。带高变化改写行高
    // 预算（layoutChrome 按 preeditFont 加增量），切档重算 applyHeight。
    applyPreeditFont() {
      const level = Number(this.preeditFont) || 0;
      document.body.dataset.preeditFont = level === 1 ? "large" : level === 2 ? "xlarge" : "normal";
      this.applyHeight();
    }
    // 单手模式（issue #15）：data 属性驱动 CSS 布局（键区同侧让位 +
    // #sidePad 贴另一侧占满让位条），侧边内容三态与自定义图在这里一并
    // 落地。位置纯 CSS（含安全区对齐），无需 JS 定位。
    /* ===== #55 悬浮键盘（spike：画布模式） =====
     * native 把 IME 窗口铺满可用区（零占位，REGION 触摸限定卡片），
     * JS 在画布内移动/缩放真实布局（不用 transform scale——字体和
     * 触摸目标会一起缩水，clientHeight 口径也会漂）。几何上报 native
     * 驱动 touchableRegion；spike 首版内存态，松手上报一次。 */
    setFloatingMode(on) {
      if (on === this.floating) return;
      try {
        throw new Error("SFM|" + on + "|" + this.floatMemoryKey() + "|" + new Error().stack.split("\n").slice(2, 5).join(" <- "));
      } catch (e) {
        (window.__sfm = window.__sfm || []).push(e.message);
      }
      if (on && document.body.classList.contains("hwkb")) {
        this.showToast(t("\u786C\u4EF6\u952E\u76D8\u5F62\u6001\u4E0B\u4E0D\u652F\u6301\u60AC\u6D6E\u952E\u76D8"));
        return;
      }
      if (on) {
        const probeW = Math.max(this.floatMinW(), Math.round(window.innerWidth * 0.82));
        if (this.floatMinH(probeW) + FLOAT_BAR_SPACE + 8 > window.innerHeight) {
          this.showToast(t("\u5C4F\u5E55\u7A7A\u95F4\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u60AC\u6D6E"));
          return;
        }
      }
      this.floating = on;
      if (on && !this.floatGeom) {
        const mem = this.loadFloatMemory();
        if (mem && mem.on && mem.w > 0) {
          this.floatGeom = { x: mem.x, y: mem.y, w: mem.w, h: mem.h };
          this._floatGeomTouched = true;
        }
      }
      if (on && !this.floatGeom) this.setFloatInitialGeom();
      this.cancelFloatGestures();
      document.body.dataset.floating = on ? "on" : "off";
      if (on) this.buildFloatHandles();
      this.applyFloatingGeom();
      this.syncFloatingRect();
      this._floatOrientKey = this.floatMemoryKey();
      if (on) {
        if (this._floatGeomTouched) this.saveFloatMemory();
        else this.saveFloatMemoryOn();
      } else this.saveFloatMemoryOff();
      this.call(() => {
        if (typeof Native.setFloating === "function") {
          Native.setFloating(on, this.token);
        }
      });
      if (on) {
        this.applyOneHand();
        this.closeOtherViews();
      } else {
        this.applyHeight();
      }
      this.hwNotifyPanelHeight();
    }
    /** 几何写 CSS 变量；卡片真实重排（行高等预算随高度走）。 */
    applyFloatingGeom() {
      const g = this.floatGeom;
      if (!g) return;
      const st = document.documentElement.style;
      st.setProperty("--float-x", g.x + "px");
      st.setProperty("--float-y", g.y + "px");
      st.setProperty("--float-w", g.w + "px");
      st.setProperty("--float-h", g.h + "px");
      this.fitFloatingToolbar();
    }
    /** 卡片矩形上报 native（css px→REGION 物理px换算在 native）。 */
    syncFloatingRect() {
      if (!this.floating || !this.floatGeom) return;
      const g = this.floatGeom;
      const pad = 4, barH = FLOAT_BAR_SPACE;
      this.call(() => {
        if (typeof Native.setFloatingRect === "function") {
          Native.setFloatingRect(
            g.x - pad,
            g.y - barH,
            g.w + pad * 2,
            g.h + barH + pad,
            this.token
          );
        }
      });
    }
    /** 悬浮卡片把手层（拖动条+停靠+右下缩放角）。独立手势：不走
     *  bindTouch/touchOrigin（字母键手势所有权），touch identifier
     *  认手。 */
    buildFloatHandles() {
      if (document.getElementById("floatBar")) return;
      const bar = document.createElement("div");
      bar.id = "floatBar";
      const dock = document.createElement("button");
      dock.id = "floatDock";
      dock.type = "button";
      dock.setAttribute("aria-label", t("\u6062\u590D\u505C\u9760"));
      const dockIcon = ICONS.dock.cloneNode(true);
      dockIcon.setAttribute("width", "18");
      dockIcon.setAttribute("height", "18");
      dock.append(dockIcon);
      dock.addEventListener("click", (e) => {
        e.stopPropagation();
        this.setFloatingMode(false);
      });
      const grip = document.createElement("div");
      grip.id = "floatGrip";
      grip.className = "float-grip";
      grip.setAttribute("aria-label", t("\u62D6\u52A8\u79FB\u52A8"));
      const resize = document.createElement("div");
      resize.id = "floatResize";
      resize.className = "float-resize";
      resize.setAttribute("aria-label", t("\u62D6\u52A8\u7F29\u653E"));
      const rzIcon = ICONS.resize.cloneNode(true);
      rzIcon.setAttribute("width", "18");
      rzIcon.setAttribute("height", "18");
      resize.append(rzIcon);
      bar.append(dock, grip, resize);
      const layer = document.createElement("div");
      layer.id = "floatHandles";
      layer.append(bar);
      document.body.append(layer);
      grip.addEventListener("touchstart", (e) => {
        if (this.floatDragSession || this.floatResizeSession) return;
        if (this.pressedKeys.size > 0) return;
        const t0 = e.changedTouches[0];
        this.floatDragSession = {
          id: t0.identifier,
          sx: t0.clientX,
          sy: t0.clientY,
          gx: this.floatGeom.x,
          gy: this.floatGeom.y
        };
        e.preventDefault();
      }, { passive: false });
      grip.addEventListener("touchmove", (e) => {
        const drag = this.floatDragSession;
        if (!drag) return;
        for (const tch of e.changedTouches) {
          if (tch.identifier !== drag.id) continue;
          const g = this.floatGeom;
          g.x = drag.gx + tch.clientX - drag.sx;
          g.y = drag.gy + tch.clientY - drag.sy;
          this.clampFloatGeom();
          this.applyFloatingGeom();
        }
        e.preventDefault();
      }, { passive: false });
      const endDrag = /* @__PURE__ */ __name((e) => {
        const drag = this.floatDragSession;
        if (!drag) return;
        if (![...e.changedTouches || []].some((t2) => t2.identifier === drag.id)) return;
        this.floatDragSession = null;
        const t0 = [...e.changedTouches || []].find((t2) => t2.identifier === drag.id);
        if (t0 && Math.abs(t0.clientX - drag.sx) + Math.abs(t0.clientY - drag.sy) > 3) {
          this._floatGeomTouched = true;
        }
        this.syncFloatingRect();
        if (this._floatGeomTouched) this.saveFloatMemory();
      }, "endDrag");
      grip.addEventListener("touchend", endDrag);
      grip.addEventListener("touchcancel", endDrag);
      resize.addEventListener("touchstart", (e) => {
        if (this.floatDragSession || this.floatResizeSession) return;
        if (this.pressedKeys.size > 0) return;
        const t0 = e.changedTouches[0];
        this.floatResizeSession = {
          id: t0.identifier,
          sx: t0.clientX,
          sy: t0.clientY,
          gx: this.floatGeom.x,
          gy: this.floatGeom.y,
          gw: this.floatGeom.w,
          gh: this.floatGeom.h
        };
        e.preventDefault();
      }, { passive: false });
      resize.addEventListener("touchmove", (e) => {
        const rz = this.floatResizeSession;
        if (!rz) return;
        for (const tch of e.changedTouches) {
          if (tch.identifier !== rz.id) continue;
          const g = this.floatGeom;
          const bottom = rz.gy + rz.gh;
          g.w = rz.gw + tch.clientX - rz.sx;
          g.h = rz.gh - (tch.clientY - rz.sy);
          g.x = rz.gx;
          g.w = Math.max(this.floatMinW(), Math.min(window.innerWidth - rz.gx - 4, g.w));
          g.h = Math.max(this.floatMinH(g.w), Math.min(bottom - FLOAT_BAR_SPACE, g.h));
          g.y = bottom - g.h;
          this.clampFloatGeom();
          this.applyFloatingGeom();
        }
        e.preventDefault();
      }, { passive: false });
      const endRz = /* @__PURE__ */ __name((e) => {
        const rz = this.floatResizeSession;
        if (!rz) return;
        if (![...e.changedTouches || []].some((t2) => t2.identifier === rz.id)) return;
        this.floatResizeSession = null;
        const t0 = [...e.changedTouches || []].find((t2) => t2.identifier === rz.id);
        if (t0 && Math.abs(t0.clientX - rz.sx) + Math.abs(t0.clientY - rz.sy) > 3) {
          this._floatGeomTouched = true;
        }
        this.syncFloatingRect();
        if (this._floatGeomTouched) this.saveFloatMemory();
      }, "endRz");
      resize.addEventListener("touchend", endRz);
      resize.addEventListener("touchcancel", endRz);
    }
    /** 悬浮卡片最小尺寸：宽=短边（横竖屏中较小者）的 60%——竖屏
     *  即视口 60%；横屏若按横屏宽算 60% 会得到 549/915 级的巨大
     *  下限（用户实测「最小宽度占 60% 屏宽不合理，应对齐竖屏」），
     *  对齐竖屏当量=0.6×min(W,H)。高=内容下限（codex P2-3）。 */
    floatMinW() {
      return Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.6);
    }
    floatMinH(w) {
      return Math.round(this.layoutChrome() + 4 * KB_ROW_MIN + 8);
    }
    /** 几何钳制（codex P2-4/5）：顶边至少留把手高度 26px；尺寸在
     * 画布内先钳上限再抬下限；尺寸抬升可能越界——最后按包围盒
     * 重钳位置，保证把手与缩放角始终在画布内。 */
    /** 悬浮安全初值：竖屏宽 82% 视口；横屏 92%——悬浮卡两侧
     *  不需要停靠态给安全区留的空白（用户实测「两边空白收一下」）。
     *  高 55% 但不低于内容下限（codex review P2-3：189px 会被
     *  overflow:hidden 裁掉第四行）。居中贴底。 */
    setFloatInitialGeom() {
      const wPct = this.landscape ? 0.92 : 0.82;
      const w = Math.max(this.floatMinW(), Math.round(window.innerWidth * wPct));
      const h = Math.max(
        this.floatMinH(w),
        Math.min(Math.round(window.innerHeight * 0.55), Math.round(w * 0.72))
      );
      this.floatGeom = {
        x: Math.round((window.innerWidth - w) / 2),
        y: window.innerHeight - h - 8,
        w,
        h
      };
    }
    /** 悬浮记忆（#55 横竖屏独立）：{on,x,y,w,h} 按方向存
     *  localStorage。旋转会触发 IMS 重建输入视图（native 侧
     *  onCreateInputView 复位悬浮态），方向翻转也换视口尺寸——
     *  两处都从各自方向的记忆恢复，用户的悬浮选择不被一次旋转
     *  清掉（用户实测：横悬浮→竖悬浮→回横屏唤起变停靠）。 */
    floatMemoryKey() {
      return this.landscape ? "feelime_float3_landscape" : "feelime_float3_portrait";
    }
    loadFloatMemory() {
      try {
        const raw = localStorage.getItem(this.floatMemoryKey());
        if (!raw) return null;
        const m = JSON.parse(raw);
        if (!m || typeof m.on !== "boolean") return null;
        if (!m.on) return { on: false };
        const ok = [m.x, m.y, m.w, m.h].every((v) => typeof v === "number" && isFinite(v) && v > 0);
        return ok ? m : { on: true };
      } catch (_) {
        return null;
      }
    }
    saveFloatMemory() {
      if (!this.floating || !this.floatGeom) return;
      try {
        localStorage.setItem(this.floatMemoryKey(), JSON.stringify(
          Object.assign({ on: true }, this.floatGeom)
        ));
      } catch (_) {
      }
    }
    saveFloatMemoryOff() {
      try {
        localStorage.setItem(this.floatMemoryKey(), '{"on":false}');
      } catch (_) {
      }
    }
    saveFloatMemoryOn() {
      try {
        localStorage.setItem(this.floatMemoryKey(), '{"on":true}');
      } catch (_) {
      }
    }
    /** 应用当前方向的悬浮记忆（页面重建恢复 / 方向翻转切换）：
     *  on=true 走完整进入流程（几何走记忆初值）；off/无记忆且当前
     *  悬浮中 → 停靠。预置 floating=false 以穿过 setFloatingMode
     *  的同态早退（换向重进是合法的全流程重放）。force（翻转/
     *  重建恢复点）在悬浮中也完整重放——旧几何是另一方向的，只
     *  对齐会带着横屏宽卡回竖屏；非 force 的同向重复调用才走
     *  「仅对齐几何」。 */
    applyFloatMemory(force) {
      const mem = this.loadFloatMemory();
      if (mem && mem.on) {
        if (this.floating && !force) {
          if (mem.w && this.floatGeom && (this.floatGeom.w !== mem.w || this.floatGeom.x !== mem.x || this.floatGeom.y !== mem.y || this.floatGeom.h !== mem.h)) {
            this.floatGeom = { x: mem.x, y: mem.y, w: mem.w, h: mem.h };
            this.clampFloatGeom();
            this.applyFloatingGeom();
            this.syncFloatingRect();
          }
          return;
        }
        this.floating = false;
        this.floatGeom = null;
        this.setFloatingMode(true);
      } else if (this.floating) {
        this.setFloatingMode(false);
      }
    }
    clampFloatGeom() {
      const g = this.floatGeom;
      const H = window.innerHeight, W = window.innerWidth;
      g.w = Math.max(this.floatMinW(), Math.min(W - 8, g.w));
      g.h = Math.max(this.floatMinH(g.w), Math.min(H - FLOAT_BAR_SPACE - 8, g.h));
      g.x = Math.max(0, Math.min(W - g.w - 4, g.x));
      g.y = Math.max(FLOAT_BAR_SPACE + 4, Math.min(H - g.h - 4, g.y));
    }
    onFloatingResize() {
      if (!this.floating || !this.floatGeom) return;
      if (!this._floatGeomTouched) this.setFloatInitialGeom();
      this.clampFloatGeom();
      this.applyFloatingGeom();
      this.syncFloatingRect();
      if (this._floatGeomTouched) this.saveFloatMemory();
    }
    /** 悬浮几何手势会话（codex P2-6：提为实例字段，取消/隐藏/旋转
     * 链路可清；P2-7：与按键手势互斥的占用标志）。 */
    cancelFloatGestures() {
      this.floatDragSession = null;
      this.floatResizeSession = null;
    }
    applyOneHand() {
      const level = Number(this.oneHand) || 0;
      if (level === 1 || level === 2) {
        try {
          localStorage.setItem("feelime_onehand_side", String(level));
        } catch (_) {
        }
        if (this.ready && this.token && this.oneHandSideMemory !== level && typeof Native.setQuickPref === "function") {
          this.oneHandSideMemory = level;
          this.call(() => Native.setQuickPref(
            "oneHandSide",
            String(level),
            this.token
          ));
        }
      }
      const eff = this.floating ? 0 : level;
      document.body.dataset.oneHand = eff === 1 ? "left" : eff === 2 ? "right" : "off";
      const content = Number(this.sideContent) || 0;
      document.body.dataset.sideContent = content === 1 ? "blank" : "cursor";
      const padPct = Number(this.oneHandPad) || 0;
      if (padPct > 0) {
        const padW = Math.round(window.innerWidth * padPct / 100);
        document.documentElement.style.setProperty("--side-pad-w", padW + "px");
      } else {
        document.documentElement.style.removeProperty("--side-pad-w");
      }
      this.pruneOverflowTools();
      document.querySelectorAll(".sym-custom-row").forEach((strip) => this.fitCustomRow(strip));
    }
    /** 背景图片（亮/暗两组，issue #15）：铺满整个键盘区域（工具条
     *  到底部留白；float band 扩展透明区在 WebView 之外，天然不覆
     *  盖）。按当前主题取对应组；该组无图 = 纯色背景。 */
    applyBackground() {
      const light = document.documentElement.classList.contains("theme-light");
      const image = light ? this.bgImageLight : this.bgImageDark;
      const layer = document.getElementById("bgImage");
      if (layer) {
        layer.style.backgroundImage = image ? `url("${image.startsWith("/keyboard/background/") || image.startsWith("https://feelime.local/keyboard/background/") ? image : "data:image/jpeg;base64," + image}")` : "";
      }
      document.body.dataset.bgImage = image ? "on" : "off";
      this.pushChromeColor();
    }
    /** #27 手势条跟主题色：把键盘底色推给壳，native 把 IME 窗口
     * 的导航栏与窗口背景涂成同色——WebView 铺不满手势条的机型
     * （MIUI 实录黑条）不再露出系统黑层。背景图模式推 transparent
     * （CSS 的 bgImage 层自己铺到屏底）。 */
    pushChromeColor() {
      if (typeof Native.setChromeColor !== "function" || !this.token) return;
      const wallpaper = document.body.dataset.bgImage === "on";
      const host = document.getElementById("softKeyboard");
      const color = wallpaper || !host ? "transparent" : getComputedStyle(host).backgroundColor;
      try {
        Native.setChromeColor(color, this.token);
      } catch (_) {
      }
    }
    /** 键帽不透明度：只动背景 alpha 变量，键帽文字保持实色。 */
    applyKeyOpacity() {
      const pct = Math.max(0, Math.min(100, Number(this.keyOpacity) || 0));
      document.documentElement.style.setProperty(
        "--key-alpha",
        String(Math.max(0.05, pct / 100))
      );
    }
    /** #39 横屏三项：挖孔安全区（键区 padding 让位，背景仍铺满——
     *  同单手模式的 padding 语义）与整体不透明度（含背景，窗口涂层
     *  由 native 侧同步转透明）。只写 CSS 变量；竖屏选择器不生效，
     *  变量残留无害。 */
    applyLandscapeChrome() {
      var _a;
      const root = document.documentElement.style;
      const safe = this.landscapeSafeArea !== false;
      const l = safe ? Math.max(0, Number(this.safeSideL) || 0) : 0;
      const r = safe ? Math.max(0, Number(this.safeSideR) || 0) : 0;
      root.setProperty("--safe-side-l", l + "px");
      root.setProperty("--safe-side-r", r + "px");
      const pct = Math.max(10, Math.min(100, Number((_a = this.landscapeOpacity) != null ? _a : 100)));
      root.setProperty("--kb-landscape-opacity", String(pct / 100));
    }
    // ---- 工具栏编辑模式（issue #15）----
    // 布局是两个有序数组（左组 / 右组，中间候选区留空）。按钮 DOM 永远
    // 存在于 candidateBar（编辑态把未上栏的按钮移进下方仓库 grid），
    // applyToolbarLayout 只负责按数组重排；事件绑定在元素上，移动安全。
    applyToolbarLayoutValue(raw) {
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        parsed = null;
      }
      const valid = /* @__PURE__ */ __name((arr) => Array.isArray(arr) && arr.length <= 4 && arr.every((id) => typeof id === "string" && id in TOOL_CATALOG) && new Set(arr).size === arr.length, "valid");
      if (!parsed || !valid(parsed.left) || !valid(parsed.right)) return;
      this.toolbarLeft = parsed.left.slice();
      this.toolbarRight = parsed.right.slice();
    }
    applyToolbarLayout() {
      if (this.panelOpen) return;
      const pre = document.getElementById("candidates");
      const hideBtn = document.getElementById("hide");
      if (!pre || !hideBtn) return;
      const resolve = /* @__PURE__ */ __name((id) => document.getElementById(TOOL_CATALOG[id]), "resolve");
      this.toolbarLeft.forEach((id) => {
        const el = resolve(id);
        if (el) pre.parentNode.insertBefore(el, pre);
      });
      this.toolbarRight.forEach((id) => {
        const el = resolve(id);
        if (el) hideBtn.parentNode.insertBefore(el, hideBtn);
      });
      this.pruneOverflowTools();
      this.renderToolbarEditor();
    }
    /** 工具栏对账（兜底，每次编辑操作 / 键盘弹起后跑）：不变式是
     *  「每颗工具要么在候选条、要么在下方仓库完整展示」。实现拆两层：
     *  1) applyToolbarLayout 把数组内的按钮重新插桩（防 DOM 脱队），
     *     末尾的 renderToolbarEditor 把栏上没有的全部收进仓库；
     *  2) hidden 只对栏上按钮按 composing/溢出重算，仓库内的按钮
     *     一律可见（历史上把 hidden 写到仓库按钮上，编辑态里看着
     *     像凭空消失）。 */
    auditToolbarTools() {
      this.applyToolbarLayout();
      const composeHidden = document.body.classList.contains("composing");
      const overflow = this._overflowTools || /* @__PURE__ */ new Set();
      Object.entries(TOOL_CATALOG).forEach(([id, dom]) => {
        if (dom === "mic") return;
        const el = document.getElementById(dom);
        if (!el) return;
        el.hidden = el.closest("#toolbarEditorGrid") ? false : this.toolbarYield || composeHidden || overflow.has(id);
      });
      const mic = document.getElementById("mic");
      if (mic) mic.hidden = this.toolbarYield || composeHidden && this.voiceState === "idle";
    }
    /** 溢出兜底：已保存的布局可能比当前候选条容量大（典型：单手模式
     *  让位 64px 后放不下 6 颗）——放不下的按钮隐藏，收起键永远留在
     *  栏内、不压侧边栏。配置不丢：切回宽布局/退出单手自动恢复。 */
    pruneOverflowTools() {
      const cap = this.toolbarCapacity();
      this._overflowTools = /* @__PURE__ */ new Set();
      let shown = 0;
      [...this.toolbarLeft, ...this.toolbarRight].forEach((id) => {
        if (shown >= cap) {
          this._overflowTools.add(id);
          return;
        }
        shown++;
      });
      [...this.toolbarLeft, ...this.toolbarRight].forEach((id) => {
        const el = document.getElementById(TOOL_CATALOG[id]);
        if (el) el.hidden = this.toolbarYield || this._overflowTools.has(id);
      });
    }
    enterToolbarEdit() {
      if (this.toolbarEdit || this.composing) return;
      const editor = document.getElementById("toolbarEditor");
      if (!editor) return;
      this.closeOtherViews();
      this._toolbarSnapshot = {
        left: this.toolbarLeft.slice(),
        right: this.toolbarRight.slice()
      };
      this.toolbarEdit = true;
      document.body.classList.add("toolbar-edit");
      this.hwNotifyPanelHeight();
      editor.hidden = false;
      this.renderToolbarEditor();
      this.showToast(t("\u5DE5\u5177\u680F\u7F16\u8F91\uFF1A\u70B9\u4E0B\u65B9\u56FE\u6807\u6DFB\u52A0\uFF0C\u62D6\u52A8\u6392\u5E8F\uFF0C\xD7 \u79FB\u9664"));
    }
    exitToolbarEdit() {
      this.closeToolbarEdit(true);
    }
    /** 「取消」：按进入编辑时的快照整体回退，不落盘。 */
    cancelToolbarEdit() {
      if (!this.toolbarEdit) return;
      if (this._toolbarSnapshot) {
        this.toolbarLeft = this._toolbarSnapshot.left.slice();
        this.toolbarRight = this._toolbarSnapshot.right.slice();
      }
      this.closeToolbarEdit(false);
    }
    closeToolbarEdit(save) {
      if (!this.toolbarEdit) return;
      this.toolbarEdit = false;
      document.body.classList.remove("toolbar-edit");
      this.hwNotifyPanelHeight();
      const editor = document.getElementById("toolbarEditor");
      if (editor) editor.hidden = true;
      this._toolbarSnapshot = null;
      this.applyToolbarLayout();
      if (save && typeof Native.setQuickPref === "function") {
        this.call(() => Native.setQuickPref(
          "toolbarLayout",
          JSON.stringify({ left: this.toolbarLeft, right: this.toolbarRight }),
          this.token
        ));
      }
    }
    /** 下方仓库：把未上栏的 catalog 按钮移入 grid（点按添加）。只做
     *  增量搬移、绝不清空 grid——按钮一旦被移出 DOM，getElementById
     *  就再也找不回它（× 掉第二个 icon 时第一个会凭空消失）。 */
    renderToolbarEditor() {
      const grid = document.getElementById("toolbarEditorGrid");
      if (!grid) return;
      const used = /* @__PURE__ */ new Set([...this.toolbarLeft, ...this.toolbarRight]);
      Object.keys(TOOL_CATALOG).forEach((id) => {
        const el = document.getElementById(TOOL_CATALOG[id]);
        if (!el) return;
        if (used.has(id)) return;
        el.classList.add("editor-pool");
        if (!el.closest("#toolbarEditorGrid")) grid.append(el);
      });
    }
    addToToolbar(id) {
      if (this.toolbarLeft.includes(id) || this.toolbarRight.includes(id)) return;
      const el = document.getElementById(TOOL_CATALOG[id]);
      if (!el || !el.classList.contains("editor-pool")) return;
      if (this.toolbarLeft.length + this.toolbarRight.length >= this.toolbarCapacity()) {
        this.showToast(t("\u5DE5\u5177\u680F\u7A7A\u95F4\u4E0D\u591F"));
        return;
      }
      el.classList.remove("editor-pool");
      if (this.toolbarRight.length < 4) {
        this.toolbarRight.push(id);
      } else if (this.toolbarLeft.length < 4) {
        this.toolbarLeft.push(id);
      } else return;
      this.applyToolbarLayout();
    }
    removeFromToolbar(id) {
      this.toolbarLeft = this.toolbarLeft.filter((x) => x !== id);
      this.toolbarRight = this.toolbarRight.filter((x) => x !== id);
      this.applyToolbarLayout();
    }
    /** 开关型/动作型工具（色彩模式/振动/声音/联想/单手 + 数字键盘/
     *  Emoji 直达）：index.html 没有静态节点，这里动态创建，初始只
     *  待在编辑仓库里，由用户上栏。开关型的点击 = 快捷设置同名 tile
     *  的 toggle、状态用 state-on 底色；动作型直达对应键区视图。 */
    buildToggleTools() {
      const defs = [
        { key: "theme", id: "toolTheme", icon: "theme", label: "\u8272\u5F69\u6A21\u5F0F" },
        { key: "vibrate", id: "toolVibrate", icon: "vibrate", label: "\u6309\u952E\u632F\u52A8" },
        { key: "sound", id: "toolSound", icon: "sound", label: "\u6309\u952E\u58F0\u97F3" },
        { key: "assoc", id: "toolAssoc", icon: "assoc", label: "\u4E2D\u6587\u8054\u60F3" },
        { key: "onehand", id: "toolOneHand", icon: "onehand", label: "\u5355\u624B\u6A21\u5F0F" },
        { key: "floating", id: "toolFloating", icon: "floating", label: "\u60AC\u6D6E\u952E\u76D8" },
        { key: "numpad", id: "toolNumpad", icon: "numpad", label: "\u6570\u5B57\u952E\u76D8" },
        { key: "emoji", id: "toolEmoji", icon: "smiley", label: "Emoji" },
        { key: "edit", id: "editTool", icon: "edit", label: "\u7F16\u8F91\u5DE5\u5177" },
        { key: "custom", id: "toolCustom", icon: "custom", label: "\u5B9A\u5236\u6309\u952E" },
        { key: "kaomoji", id: "toolKaomoji", icon: "kaomoji", label: "\u989C\u6587\u5B57" }
      ];
      const pool = document.getElementById("toolbarEditorGrid");
      defs.forEach(({ key, id, icon, label }) => {
        if (document.getElementById(id)) return;
        const b = document.createElement("button");
        b.id = id;
        b.className = "tool editor-pool";
        b.dataset.tool = key;
        b.setAttribute("aria-label", t(label));
        b.setAttribute("data-i18n-aria-label", label);
        const svg = ICONS[icon].cloneNode(true);
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        b.append(svg);
        b.addEventListener("click", () => {
          if (this.toolbarEdit) return;
          if (key === "numpad") {
            if (this.keyLayer === "numpad") this.showLetters();
            else this.showNumpad();
            return;
          }
          if (key === "emoji") {
            if (this.emojiView && this.keyLayer === "numpad") this.showLetters();
            else {
              this.emojiView = true;
              this.showNumpad();
            }
            return;
          }
          if (key === "edit") {
            this.toggleEditPanel();
            return;
          }
          if (key === "custom") {
            if (this.keyLayer === "symbols" && this.symbolCat === "custom") {
              this.showLetters();
              return;
            }
            this.showCustomTab();
            return;
          }
          if (key === "kaomoji") {
            if (this.panelOpen && this.panelTab === "kaomoji") this.closePanel();
            else this.openPanel("kaomoji");
            return;
          }
          this.toggleExtraTool(key);
        });
        if (pool) pool.append(b);
      });
      this.syncToolStates();
    }
    /** 色彩模式三态循环（工具条按钮与快捷设置方块共用）。本地即时
     *  生效，意图进 quickPending 并落 native pref（theme_mode 是唯一
     *  真相源）。只写 localStorage 的话，任何一次 hello——比如调
     *  不透明度滑块触发的 PREFS_CHANGED——都会按旧 pref 把主题洗回
     *  去（真机实录：暗色下调滑块，键盘弹回系统亮色）。 */
    cycleThemeNative() {
      const modes = ["auto", "light", "dark"];
      const next = this.qStep(
        "themeMode",
        modes,
        modes.includes(this.themeMode) ? this.themeMode : "auto"
      );
      this.themeMode = next;
      applyTheme(next);
      if (typeof Native.setQuickPref === "function") {
        this.call(() => Native.setQuickPref("themeMode", next, this.token));
      }
      pushStores();
      return next;
    }
    /** 开关型工具的点击行为（与快捷设置 tile 同参）。 */
    toggleExtraTool(key) {
      const setNative = /* @__PURE__ */ __name((k, v) => {
        if (typeof Native.setQuickPref === "function") {
          this.call(() => Native.setQuickPref(k, String(v), this.token));
        }
      }, "setNative");
      if (key === "theme") {
        this.cycleThemeNative();
      } else if (key === "sound") {
        this.keySound = this.qFlip("keySound", this.keySound);
        setNative("keySound", this.keySound ? "1" : "0");
      } else if (key === "vibrate") {
        this.keyHaptic = this.qFlip("keyHaptic", this.keyHaptic);
        setNative("keyHaptic", this.keyHaptic ? "1" : "0");
      } else if (key === "assoc") {
        this.associationOn = this.qFlip("association", this.associationOn);
        if (!this.associationOn) this.assocWords = [];
        setNative("association", this.associationOn ? "1" : "0");
      } else if (key === "onehand") {
        this.oneHand = this.qRead("oneHand", this.oneHand) === 0 ? this.oneHandSide() : 0;
        this.quickPending["oneHand"] = this.oneHand;
        this.applyOneHand();
        setNative("oneHand", this.oneHand);
      } else if (key === "floating") {
        this.setFloatingMode(!this.floating);
      }
      if (this.settingsPage === null) this.renderSettingsPanel();
      this.syncToolStates();
    }
    /** 开关型工具 icon 的 on 底色跟随当前状态（hello / 点击后同步）。 */
    syncToolStates() {
      const set = /* @__PURE__ */ __name((id, on) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("state-on", !!on);
      }, "set");
      const theme = this.themeMode || "auto";
      set("toolTheme", false);
      this.swapThemeGlyph(theme);
      set("toolVibrate", this.keyHaptic);
      set("toolSound", this.keySound);
      set("toolAssoc", this.associationOn);
      set("toolOneHand", (this.oneHand || 0) !== 0);
    }
    /** 色彩模式按钮的三态图形：跟随系统=半填充圆、浅色=太阳、
     *  深色=月牙（同一 currentColor，只换形不换色）。幂等：图形
     *  名记在 dataset，不变就不动 DOM。 */
    swapThemeGlyph(theme) {
      const el = document.getElementById("toolTheme");
      if (!el) return;
      const glyph = theme === "light" ? "themeSun" : theme === "dark" ? "themeMoon" : "theme";
      if (el.dataset.glyph === glyph) return;
      el.dataset.glyph = glyph;
      const old = el.querySelector("svg");
      if (old) old.remove();
      const svg = ICONS[glyph].cloneNode(true);
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      el.append(svg);
    }
    /** 候选条当前宽度还放得下几颗工具（单手模式键区让位后 bar 变窄，
     *  容量自动变小）。候选词与工具栏**互斥**（让位机制）：候选显示
     *  时整行归候选、工具全组隐藏；空闲时整行归工具——不存在「给
     *  候选留底」的预算，只扣 F 与收起键（issue #47 复盘修正）。
     *  布局塌陷时（宽度 0）放宽到 8，不挡编辑。
     *  尺寸实测化（#55 窄卡溢出返工）：按钮宽读 DOM 实值（悬浮态
     *  fitFloatingToolbar 会连续缩到 18-26px，32 常量预算偏大导致
     *  prune 放行超量）；gap 同步实测（chrome66 上 flex gap 失效
     *  读出 0，预算反而更宽裕，自洽）。 */
    toolbarCapacity() {
      if (this.floating && this._ftoolPruneCap != null) return this._ftoolPruneCap;
      const bar = document.getElementById("candidateBar");
      const setup = document.getElementById("setupButton");
      const hide = document.getElementById("hide");
      if (!bar || !setup || !hide || !bar.clientWidth) return 8;
      const gapRaw = typeof getComputedStyle === "function" ? getComputedStyle(bar).gap : "";
      const GAP = parseFloat(gapRaw) || 0;
      const BTN = setup.offsetWidth || 32;
      const avail = bar.clientWidth - setup.offsetWidth - hide.offsetWidth - GAP * 2;
      return Math.max(1, Math.floor(avail / (BTN + GAP)));
    }
    /** 悬浮窄卡工具尺寸连续缩放（#55 用户二报溢出，codex 方案修正版：
     *  候选/工具互斥让位下不存在「候选保底」，空闲态整行归工具）。
     *  随卡片宽按比例缩（32×r 起步、上限 26 与首版档位一致、下限
     *  18 保触摸），N 个按钮装不下时由 pruneOverflowTools 按（实测
     *  化后的）容量截尾隐藏——固定键 setup/hide 不进截断，收起键
     *  永远可点。停靠态不跑（32px 档原生）。 */
    fitFloatingToolbar() {
      const root = document.documentElement.style;
      if (!this.floating) {
        root.removeProperty("--ftool-s");
        root.removeProperty("--ftool-icon");
        this._ftoolPruneCap = null;
        this.pruneOverflowTools();
        return;
      }
      const bar = document.getElementById("candidateBar");
      if (!bar || !bar.clientWidth) return;
      const domIds = Object.values(TOOL_CATALOG);
      const fixedCount = [...bar.querySelectorAll(".tool")].filter((el) => !el.hidden && el.id && domIds.indexOf(el.id) < 0).length;
      const nCfg = this.toolbarLeft.length + this.toolbarRight.length;
      const N = fixedCount + nCfg;
      if (N < 1) return;
      const gapRaw = typeof getComputedStyle === "function" ? getComputedStyle(bar).gap : "";
      const G = Math.max(2, parseFloat(gapRaw) || 0);
      const B = Math.max(0, bar.clientWidth - G - 8);
      const K = Math.floor((B + G) / (18 + G));
      const M = Math.max(fixedCount, Math.min(N, K));
      const size = Math.max(18, Math.min(26, (B - (M - 1) * G) / M));
      root.setProperty("--ftool-s", Math.floor(size * 10) / 10 + "px");
      root.setProperty("--ftool-icon", Math.floor(size / 2 * 10) / 10 + "px");
      this._ftoolPruneCap = Math.max(1, M - fixedCount);
      this.pruneOverflowTools();
    }
    /** 编辑态下按组内索引移动 id（拖拽落位）。跨组拖入满组（4）时
     *  与落点按钮交换——拖动是调序手段，静默拒绝会让用户以为坏了。
     *  id 还在仓库（不在任何组）时是「从仓库拖上栏」，走 addToToolbar
     *  （带容量检查 + 清掉 editor-pool 角标）。 */
    moveInToolbar(id, group, index) {
      if (!this.toolbarLeft.includes(id) && !this.toolbarRight.includes(id)) {
        this.addToToolbar(id);
        return;
      }
      const from = this.toolbarLeft.includes(id) ? this.toolbarLeft : this.toolbarRight;
      const to = group === "left" ? this.toolbarLeft : this.toolbarRight;
      const origIndex = from.indexOf(id);
      const old = from.filter((x) => x !== id);
      if (to === from) {
        old.splice(Math.max(0, Math.min(index, old.length)), 0, id);
        this.toolbarLeft = group === "left" ? old : this.toolbarLeft;
        this.toolbarRight = group === "right" ? old : this.toolbarRight;
        this.applyToolbarLayout();
        return;
      }
      if (to.length < 4) {
        to.splice(Math.max(0, Math.min(index, to.length)), 0, id);
      } else {
        const victimIndex = Math.max(0, Math.min(index, to.length - 1));
        const victim = to[victimIndex];
        to.splice(victimIndex, 1, id);
        old.splice(Math.max(0, Math.min(origIndex, old.length)), 0, victim);
      }
      if (from === this.toolbarLeft) this.toolbarLeft = old;
      else this.toolbarRight = old;
      this.applyToolbarLayout();
    }
    /** 编辑模式事件接线（issue #15）：长按候选条工具进入编辑；× 移除
     *  到仓库；仓库点按添加；编辑态长按工具=拖动排序（跨左右组，中间
     *  候选区不放按钮）；「完成」退出并保存。 */
    setupToolbarEditor() {
      const bar = document.getElementById("candidateBar");
      const doneBtn = document.getElementById("toolbarEditDone");
      if (!bar || !doneBtn) return;
      const EDIT_HOLD_MS = 280;
      this.buildToggleTools();
      Object.entries(TOOL_CATALOG).forEach(([id, dom]) => {
        const el = document.getElementById(dom);
        if (!el) return;
        el.dataset.tool = id;
        const x = document.createElement("span");
        x.className = "tool-x";
        x.textContent = "\xD7";
        x.addEventListener("touchstart", (event) => {
          event.stopPropagation();
          event.preventDefault();
        }, { passive: false });
        x.addEventListener("touchend", (event) => {
          event.stopPropagation();
          event.preventDefault();
          if (this.toolbarEdit) this.removeFromToolbar(id);
        }, { passive: false });
        el.append(x);
        el.addEventListener("touchstart", (event) => {
          if (this.toolbarEdit) {
            event.preventDefault();
            event.stopImmediatePropagation();
            el._editStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            this.beginToolbarDrag(id, el, event);
            return;
          }
          if (el.closest("#toolbarEditorGrid")) return;
          const start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          el._editHoldPos = start;
          el._editHold = setTimeout(() => {
            const pos = el._editHoldPos || start;
            if (Math.abs(pos.x - start.x) < 12 && Math.abs(pos.y - start.y) < 12) {
              this.enterToolbarEdit();
            }
          }, EDIT_HOLD_MS);
        }, { passive: true });
        el.addEventListener("touchmove", (event) => {
          const t2 = event.touches[0];
          if (t2 && el._editHoldPos) {
            el._editHoldPos = { x: t2.clientX, y: t2.clientY };
          }
        }, { passive: true });
        el.addEventListener("touchend", (event) => {
          clearTimeout(el._editHold);
          el._editHoldPos = null;
          if (!this.toolbarEdit || !el._editStart) return;
          const t2 = event.changedTouches[0];
          const moved = Math.hypot(
            t2.clientX - el._editStart.x,
            t2.clientY - el._editStart.y
          ) >= 12;
          el._editStart = null;
          if (moved) return;
          if (el.closest("#toolbarEditorGrid")) {
            this.addToToolbar(id);
          }
        }, { passive: true });
        ["touchend", "touchcancel"].forEach((name) => el.addEventListener(name, () => {
          clearTimeout(el._editHold);
          el._editHoldPos = null;
        }, { passive: true }));
      });
      if (!bar) throw new Error("TBE-REG-NOBAR");
      bar.addEventListener("click", (event) => {
        if (!this.toolbarEdit) return;
        const tool = event.target.closest(".tool");
        if (!tool || !tool.dataset.tool) return;
        event.stopPropagation();
        if (event.target.classList.contains("tool-x")) {
          this.removeFromToolbar(tool.dataset.tool);
        }
      }, true);
      const grid = document.getElementById("toolbarEditorGrid");
      if (grid) {
        grid.addEventListener("click", (event) => {
          if (!this.toolbarEdit) return;
          if (event.target.closest("[data-tool]")) event.stopPropagation();
        }, true);
      }
      doneBtn.addEventListener("click", () => this.exitToolbarEdit());
      const cancelBtn = document.getElementById("toolbarEditCancel");
      if (cancelBtn) cancelBtn.addEventListener("click", () => this.cancelToolbarEdit());
      bar.addEventListener("touchstart", (event) => {
        if (this.toolbarEdit || event.target !== bar) return;
        const start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        bar._barHoldPos = start;
        bar._barHold = setTimeout(() => {
          const pos = bar._barHoldPos || start;
          if (Math.abs(pos.x - start.x) < 12 && Math.abs(pos.y - start.y) < 12) {
            this.enterToolbarEdit();
          }
        }, EDIT_HOLD_MS);
      }, { passive: true });
      bar.addEventListener("touchmove", (event) => {
        const t2 = event.touches[0];
        if (t2 && bar._barHoldPos) {
          bar._barHoldPos = { x: t2.clientX, y: t2.clientY };
        }
      }, { passive: true });
      ["touchend", "touchcancel"].forEach((name) => bar.addEventListener(name, () => {
        clearTimeout(bar._barHold);
        bar._barHoldPos = null;
      }, { passive: true }));
    }
    /** 编辑态拖拽：ghost（44px 圆钮，见 .toolbar-drag-ghost）跟手，
     *  松手按落点 x 定组（candidateBar 中点分左右）与组内索引（各
     *  按钮中点比较），中间候选区不放按钮。 */
    beginToolbarDrag(id, el, event) {
      const SIZE = 44;
      const ghost = el.cloneNode(true);
      ghost.classList.remove("toolbar-dragging");
      ghost.classList.add("toolbar-drag-ghost");
      ghost.style.left = event.touches[0].clientX - SIZE / 2 + "px";
      ghost.style.top = event.touches[0].clientY - SIZE / 2 + "px";
      ghost.style.width = SIZE + "px";
      ghost.style.height = SIZE + "px";
      document.body.append(ghost);
      el.classList.add("toolbar-dragging");
      const move = /* @__PURE__ */ __name((ev) => {
        const t2 = ev.touches[0];
        ghost.style.left = t2.clientX - SIZE / 2 + "px";
        ghost.style.top = t2.clientY - SIZE / 2 + "px";
      }, "move");
      const up = /* @__PURE__ */ __name((ev) => {
        window.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", up);
        window.removeEventListener("touchcancel", up);
        ghost.remove();
        el.classList.remove("toolbar-dragging");
        if (!ev.changedTouches.length) return;
        const t2 = ev.changedTouches[0];
        const barEl = document.getElementById("candidateBar");
        const barRect = barEl.getBoundingClientRect();
        if (t2.clientY < barRect.top || t2.clientY > barRect.bottom) return;
        const group = t2.clientX < barRect.left + barRect.width / 2 ? "left" : "right";
        const arr = group === "left" ? this.toolbarLeft.filter((x) => x !== id) : this.toolbarRight.filter((x) => x !== id);
        let index = arr.length;
        for (let i = 0; i < arr.length; i++) {
          const other = document.getElementById(TOOL_CATALOG[arr[i]]);
          if (!other) continue;
          const r = other.getBoundingClientRect();
          if (t2.clientX < r.left + r.width / 2) {
            index = i;
            break;
          }
        }
        this.moveInToolbar(id, group, index);
      }, "up");
      window.addEventListener("touchmove", move, { passive: true });
      window.addEventListener("touchend", up);
      window.addEventListener("touchcancel", up);
    }
    applyHeight() {
      const view = document.getElementById("softKeyboard");
      const total = view && view.clientHeight || window.innerHeight;
      const safe = this.floating ? 0 : this.safeBottomPx();
      const pad = this.floating ? 0 : this.bottomPadPx();
      const available = Math.max(0, total - safe - pad);
      const root = document.documentElement;
      if (root && root.style && typeof root.style.setProperty === "function") {
        root.style.setProperty("--kb-bottom-pad", pad + "px");
      }
      const chrome = this.layoutChrome();
      const rows = 4;
      const fit = Math.floor((available - chrome) / rows);
      const rowHeight = Math.max(this.landscape ? 1 : KB_ROW_MIN, fit);
      if (root && root.style && typeof root.style.setProperty === "function") {
        root.style.setProperty("--kb-row-h", rowHeight + "px");
        root.style.setProperty("--safe-bottom", safe + "px");
      }
      const signature = [total, pad, safe, rowHeight, this.landscape].join("/");
      if (this._lastHeightSig !== void 0 && signature !== this._lastHeightSig && !this._heightConverging && typeof requestAnimationFrame === "function") {
        this._heightConverging = true;
        requestAnimationFrame(() => {
          this._heightConverging = false;
          this.applyHeight();
        });
      }
      this._lastHeightSig = signature;
      const memKey = this.floatMemoryKey();
      if (this._floatOrientKey === void 0) {
        this._floatOrientKey = memKey;
      } else if (this._floatOrientKey !== memKey) {
        this._floatOrientKey = memKey;
        this.applyFloatMemory(true);
      }
      this.applyKeycapMetrics(rowHeight);
      if (document.getElementById("heightCard").classList.contains("open")) {
        this.placeHeightCard();
      }
      this.auditToolbarTools();
      this.fitFloatingToolbar();
      if (this.mode === "handwriting") this.inkSyncViewport();
      if (this.modeMenuAnchor) {
        const mm = document.getElementById("modeMenu");
        if (mm.classList.contains("open")) {
          if (this.modeMenuAnchor.getBoundingClientRect().width > 0) {
            this.positionModeMenu(this.modeMenuAnchor);
          } else {
            this.closeModeMenu();
          }
        }
      }
    }
    /** native 落盘回执（setKeyboardHeightNow 的 commit 结果）：提示
     *  只在确认写上盘后出现；失败明确告知（codex 终审 P2）。 */
    onHeightSaved(ok) {
      if (this._heightSavedTimer) {
        clearTimeout(this._heightSavedTimer);
        this._heightSavedTimer = null;
      }
      this.showToast(ok ? t("\u952E\u76D8\u9AD8\u5EA6\u5DF2\u4FDD\u5B58") : t("\u952E\u76D8\u9AD8\u5EA6\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"));
    }
    /** 书写区几何对账：pad 的 CSS 盒变了（旋转/总高变化/重唤）才重建
     * 画布分辨率。收起期间改过布局再唤起时，renderHandwriting 不重跑
     * （模式没变），这里是唯一按新几何重放笔迹的通道。 */
    inkSyncViewport() {
      const canvas = document.getElementById("inkCanvas");
      if (!canvas) return;
      const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
      const key = rect ? [Math.round(rect.width), Math.round(rect.height)].join("x") : "";
      if (!key || key === this._inkViewport) return;
      this._inkViewport = key;
      this.inkResize();
    }
    /** Push a new CONTENT height to the native side. Old bridges (and the
     * preview harness without the native method) fall back to styling the
     * total view height, adding the safe area exactly once. */
    applyKbHeight(content, now) {
      const value = Math.round(Number(content) || 0);
      this.kbHeight = value;
      const view = document.getElementById("softKeyboard");
      if (now && typeof Native.setKeyboardHeightNow === "function") {
        this.call(() => Native.setKeyboardHeightNow(value, this.token));
      } else if (typeof Native.setKeyboardHeight === "function") {
        this.call(() => Native.setKeyboardHeight(value, this.token));
      } else if (view) {
        view.style.height = (value || this.heightDefaultCss || 272) + this.safeBottomPx() + "px";
      }
      this.applyHeight();
    }
    /** Drag the keyboard's top edge to resize the WHOLE
     * view (keys and fonts scale with it); Save keeps the content height
     * for the CURRENT orientation, Cancel restores. */
    /** The height adjuster is a card floating above the
     * keyboard view. Two adjusters: -/+ buttons (fine, applied live)
     * and a drag strip (coarse, PREVIEW only - the height lands on
     * release/save; the user explicitly rejected live drag resize).
     * Every applied path funnels through applyKbHeight → the native
     * setKeyboardHeight bridge (which persists the pref) - the old save
     * path wrote only localStorage and the height silently reverted. */
    heightBounds() {
      const ink = this.mode === "handwriting" && !this.landscape;
      const chrome = ink ? this.inkChromeHeight() : this.layoutChrome();
      const floor = ink ? 96 : 4 * KB_ROW_MIN;
      const min = Math.max(chrome + floor, this.heightFloorCss || 0);
      const fallback = Math.max(
        min + 40,
        window.innerHeight - (this.floatBand || 0) - this.safeBottomPx()
      );
      const max = Math.max(min, this.heightCeilCss || fallback);
      return { min, max };
    }
    enterHeightEdit() {
      this.heightEditSaved = this.currentContentHeight();
      this.heightResetPending = false;
      this.heightEditedLive = false;
      const bounds = this.heightBounds();
      const capped = bounds.max <= bounds.min + 2;
      this.heightPreview = capped ? this.heightEditSaved : Math.max(bounds.min, this.heightEditSaved);
      if (this.floating) {
        this.showToast(t("\u60AC\u6D6E\u952E\u76D8\u8BF7\u7528\u53F3\u4E0B\u89D2\u628A\u624B\u8C03\u6574\u5927\u5C0F"));
        return;
      }
      this.closeOtherViews();
      const card = document.getElementById("heightCard");
      card.hidden = false;
      card.classList.add("open");
      this.placeHeightCard();
      this.renderHeightCard();
      this.syncOverlay();
    }
    placeHeightCard() {
      const card = document.getElementById("heightCard");
      const kb = document.getElementById("softKeyboard").getBoundingClientRect();
      card.style.top = "0px";
      const h = card.offsetHeight;
      card.style.top = Math.max(14, kb.top - h - 6) + "px";
    }
    exitHeightEdit() {
      const card = document.getElementById("heightCard");
      card.classList.remove("open");
      card.hidden = true;
      this.applyHeight();
      this.syncOverlay();
      this.maybeResumeCtrlView();
    }
    renderHeightCard() {
      const bounds = this.heightBounds();
      const content = Math.round(this.heightPreview);
      document.getElementById("heightValue").innerHTML = content + "<small>px</small>";
      const track = document.getElementById("heightTrack");
      const thumb = document.getElementById("heightThumb");
      const capped = bounds.max <= bounds.min + 2;
      const hint = document.getElementById("heightHint");
      if (hint) hint.textContent = capped ? t("\u6A2A\u5C4F\u5DF2\u8FBE\u5C4F\u5E55\u4E0A\u9650") : t("\u62D6\u52A8\u5B9E\u65F6\u9884\u89C8\uFF0C\u4FDD\u5B58\u540E\u751F\u6548");
      track.style.opacity = capped ? ".35" : "";
      document.getElementById("heightMinus").disabled = capped;
      document.getElementById("heightPlus").disabled = capped;
      document.getElementById("heightCardSave").disabled = capped && !this.heightResetPending;
      const span = Math.max(1, bounds.max - bounds.min);
      const frac = Math.min(1, Math.max(0, (content - bounds.min) / span));
      const width = track && track.clientWidth || 200;
      thumb.style.left = Math.round(frac * (width - 14)) + "px";
      if (track && track.style && typeof track.style.setProperty === "function") {
        track.style.setProperty("--frac", String(frac));
      }
    }
    applyHeightPreview(total) {
      const bounds = this.heightBounds();
      this.heightResetPending = false;
      this.heightPreview = Math.round(Math.min(bounds.max, Math.max(bounds.min, total)));
      this.renderHeightCard();
    }
    bindHeightCard() {
      const step = /* @__PURE__ */ __name((delta) => {
        const current = this.heightPreview;
        this.heightPreview = current;
        this.applyHeightPreview(current + delta);
        this.heightEditedLive = true;
        this.applyKbHeight(this.heightPreview);
      }, "step");
      document.getElementById("heightMinus").addEventListener("click", () => step(-4));
      document.getElementById("heightPlus").addEventListener("click", () => step(4));
      const track = document.getElementById("heightTrack");
      let startX = 0;
      let startContent = 272;
      let dragging = false;
      track.addEventListener("touchstart", (event) => {
        if (this.heightBounds().max <= this.heightBounds().min + 2) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        const touch = event.touches[0];
        const rect = track.getBoundingClientRect();
        const bounds = this.heightBounds();
        const width = rect.width - 14;
        const frac = Math.min(1, Math.max(0, (touch.clientX - rect.left) / width));
        startContent = bounds.min + frac * (bounds.max - bounds.min);
        this.heightResetPending = false;
        this.heightPreview = startContent;
        startX = touch.clientX;
        dragging = true;
        this.renderHeightCard();
      }, { passive: false });
      track.addEventListener("touchmove", (event) => {
        if (!dragging) return;
        event.preventDefault();
        const bounds = this.heightBounds();
        const width = (track.clientWidth || 200) - 14;
        const dx = event.touches[0].clientX - startX;
        this.heightPreview = Math.round(
          Math.min(bounds.max, Math.max(bounds.min, startContent + dx / width * (bounds.max - bounds.min)))
        );
        this.renderHeightCard();
        this.applyKbHeight(this.heightPreview);
        this.placeHeightCard();
      }, { passive: false });
      track.addEventListener("touchend", () => {
        if (!dragging) return;
        dragging = false;
        this.heightEditedLive = true;
      });
      track.addEventListener("touchcancel", () => {
        dragging = false;
      });
      document.getElementById("heightCardCancel").addEventListener("click", () => {
        if (this.heightEditedLive) this.applyKbHeight(this.heightEditSaved);
        this.exitHeightEdit();
      });
      document.getElementById("heightCardReset").addEventListener("click", () => {
        this.heightResetPending = true;
        this.heightPreview = this.heightDefaultCss || 272;
        this.renderHeightCard();
        this.applyKbHeight(this.heightPreview);
        this.placeHeightCard();
      });
      document.getElementById("heightCardSave").addEventListener("click", () => {
        const content = Math.round(this.heightPreview);
        this.applyKbHeight(this.heightResetPending ? 0 : content, true);
        this.nativeStoredHeightCss = this.heightResetPending ? 0 : content;
        if (this._heightSavedTimer) clearTimeout(this._heightSavedTimer);
        const hasAck = Array.isArray(this.nativeCaps) && this.nativeCaps.includes("height-ack-v1");
        this._heightSavedTimer = setTimeout(() => {
          this._heightSavedTimer = null;
          this.showToast(hasAck ? t("\u952E\u76D8\u9AD8\u5EA6\u4FDD\u5B58\u672A\u786E\u8BA4\uFF0C\u8BF7\u91CD\u8BD5") : t("\u952E\u76D8\u9AD8\u5EA6\u5DF2\u4FDD\u5B58"));
        }, hasAck ? 3e3 : 800);
        this.exitHeightEdit();
      });
    }
    /* ===== mode menu ===== */
    toggleModeMenu(anchor) {
      this.closeOtherViews("modeMenu");
      const menu = document.getElementById("modeMenu");
      if (menu.classList.contains("open")) {
        this.closeModeMenu();
        return;
      }
      menu.replaceChildren();
      this.modeOrder().forEach((name) => {
        const config = MODES[name];
        const button = document.createElement("button");
        const ready = config.strictReady ? this.engineReady[name] === true : !config.engine || this.engineReady[name] !== false;
        const current = name === this.mode;
        button.className = current ? "current" : ready ? "" : "preparing";
        button.innerHTML = `<span class="prep">${ready ? modeLabel(name) : "\u2026"}</span><span>${t(config.title)}</span>`;
        if (ready && !current) {
          button.addEventListener("click", () => {
            this.closeModeMenu();
            this.call(() => Native.selectMode(name, this.token));
          });
        }
        menu.append(button);
      });
      menu.scrollTop = 0;
      menu.classList.add("open");
      menu.style.maxHeight = "none";
      const anchorEl = anchor || document.body.classList.contains("hwkb") && document.getElementById("hwModeTag") || document.getElementById("modeToggle");
      if (!anchorEl) return;
      this.modeMenuAnchor = anchorEl;
      this.positionModeMenu(anchorEl);
      this.syncOverlay();
    }
    /** 模式菜单锚点定位（#92 抽出）：右缘对齐锚点右缘、菜单在锚点
     *  上方；两条硬约束——左缘/上缘不得推出视口。hwkb 候选条形态
     *  下切换键在候选条左侧，旧行为右对齐会把左缘算成负数
     *  （min-width 180 > 键右缘），菜单左半被窗口裁掉（杉树反馈
     *  「弹窗不能完整显示」的形态）。高度结算后由 applyHeight 重调
     *  （视口变了按新几何重摆）。 */
    positionModeMenu(anchorEl) {
      const menu = document.getElementById("modeMenu");
      const toggle = anchorEl.getBoundingClientRect();
      menu.style.bottom = "auto";
      menu.style.maxWidth = Math.max(24, Math.min(innerWidth * 0.7, innerWidth - 8)) + "px";
      const w = menu.offsetWidth;
      const minRight = Math.max(4, innerWidth - w - 4);
      const rightGap = Math.min(Math.max(4, innerWidth - toggle.right), minRight);
      menu.style.left = "auto";
      menu.style.right = rightGap + "px";
      const availUp = Math.max(0, toggle.top - 14);
      if (menu.offsetHeight <= availUp) {
        menu.style.maxHeight = "";
        menu.style.top = toggle.top - menu.offsetHeight - 6 + "px";
      } else {
        menu.style.maxHeight = availUp + "px";
        menu.style.top = "14px";
      }
    }
    closeModeMenu() {
      document.getElementById("modeMenu").classList.remove("open");
      this.modeMenuAnchor = null;
      this.syncOverlay();
    }
    /** Automation hook : wipe the editor through the IME's own
     * deletion cascade - host-injected keyevents are unreliable while
     * the WebView is focused. */
    clearEditorBridge() {
      if (!this.ready || !this.token) return "not-ready";
      this.call(() => Native.clearComposing(this.token));
      for (let i = 0; i < 160; i++) {
        this.call(() => Native.backspace(this.token));
      }
      return "ok";
    }
    /* ===== quick settings panel  ===== */
    toggleSettingsPanel(page = null) {
      const panel = document.getElementById("settingsPanel");
      if (panel.classList.contains("open")) {
        this.closeSettingsPanel();
        return;
      }
      this.closeOtherViews("settings");
      if (this.ctrlView) this.suspendCtrlView();
      this.clearEditorStrip();
      this.settingsPage = page;
      this.qsPage = 0;
      this.renderSettingsPanel();
      panel.classList.add("open");
      panel.hidden = false;
      this.settingsReturnLayer = this.keyLayer;
      this.keyLayer = "settings";
      this.hideKeyLayers();
      this.hwNotifyPanelHeight();
    }
    closeSettingsPanel() {
      const panel = document.getElementById("settingsPanel");
      if (!panel) return;
      if (!panel.classList.contains("open")) return;
      panel.classList.remove("open");
      panel.hidden = true;
      this.settingsPage = null;
      this.hideSettingsPageBar();
      this.showKeyLayer(this.settingsReturnLayer || "letters");
      this.maybeResumeCtrlView();
      this.hwNotifyPanelHeight();
    }
    /* ===== #39-10 编辑工具条（可选工具栏控件，搜狗「文字编辑」
     * 形态）：替换键区的编辑面板，工具栏保留（再点工具即收）。
     * 动作全部复用现有桥通道——方向键 editorCursor（终端等
     * keyevent-cursor 场景天然兼容）、扩选/行首行尾走 sendCombo
     * （SHIFT+Arrow/Home/End 组合层）、全选复制剪切粘贴
     * editorAction（宿主 context menu 通道）、删除 backspace。 */
    toggleStatsPanel() {
      this.closeOtherViews("stats");
      const layer = document.getElementById("statsLayer");
      if (layer && !layer.hidden) {
        this.closeStatsPanel();
        return;
      }
      if (this.ctrlView) this.suspendCtrlView();
      this.renderStatsPanel();
      this.statsReturnLayer = this.keyLayer;
      this.keyLayer = "stats";
      this.hideKeyLayers();
      layer.hidden = false;
      document.body.classList.add("stats-page");
      this.hwNotifyPanelHeight();
    }
    closeStatsPanel() {
      const layer = document.getElementById("statsLayer");
      if (!layer || layer.hidden) return;
      layer.hidden = true;
      const bar = document.getElementById("statsPageBar");
      if (bar) {
        bar.hidden = true;
        bar.replaceChildren();
      }
      document.body.classList.remove("stats-page");
      this.showKeyLayer(this.statsReturnLayer || "letters");
      this.maybeResumeCtrlView();
    }
    /** #41 二轮：统计浮层。数据经 inputStats 桥同步拉全量 JSON。 */
    renderStatsPanel() {
      const layer = document.getElementById("statsLayer");
      if (!layer) return;
      let data = {};
      try {
        const raw = typeof Native.inputStats === "function" ? Native.inputStats(this.token) : "";
        data = raw ? JSON.parse(raw) : {};
      } catch (error) {
        data = {};
      }
      const total = Number(data.total) || 0;
      const today = Number(data.today) || 0;
      const keystrokes = Number(data.keystrokes) || 0;
      const streak = Number(data.streak) || 0;
      const avgDaily = Number(data.avgDaily) || 0;
      const days = Array.isArray(data.daily) ? data.daily : [];
      const withDays = data.since ? Math.max(1, Math.floor((Date.now() - /* @__PURE__ */ new Date(data.since + "T00:00:00")) / 864e5) + 1) : 1;
      const fmt = /* @__PURE__ */ __name((n) => {
        if (n < 1e4) return String(n);
        if (uiLocale === "en") return Math.round(n / 1e3) + "k";
        return (n / 1e4).toFixed(1).replace(/\.0$/, "") + "\u4E07";
      }, "fmt");
      layer.textContent = "";
      const wrap = document.createElement("div");
      wrap.className = "stats-wrap";
      const el = /* @__PURE__ */ __name((cls, html) => {
        const node = document.createElement("div");
        node.className = cls;
        if (html != null) node.innerHTML = html;
        return node;
      }, "el");
      const bar = document.getElementById("statsPageBar");
      if (bar) {
        bar.replaceChildren();
        const label = document.createElement("span");
        label.className = "page-title";
        label.textContent = t("\u8F93\u5165\u7EDF\u8BA1");
        const close = document.createElement("button");
        close.className = "tool";
        close.textContent = "\xD7";
        close.setAttribute("aria-label", t("\u6536\u8D77\u7EDF\u8BA1"));
        close.addEventListener("click", () => this.closeStatsPanel());
        bar.append(label, close);
        bar.hidden = false;
      }
      const hero = el("stats-hero");
      hero.append(el("stats-hero-label", t("\u7D2F\u8BA1\u8F93\u5165")));
      const totalLine = el("stats-total");
      totalLine.id = "statsTotal";
      const unit = document.createElement("span");
      unit.className = "stats-total-unit";
      unit.textContent = t("\u5B57");
      totalLine.append(unit);
      hero.append(totalLine);
      hero.append(el(
        "stats-sub",
        t("\u4ECA\u65E5") + " <b>" + today.toLocaleString() + "</b> " + t("\u5B57") + " \xB7 " + t("\u8FDE\u7EED") + " <b>" + streak + "</b> " + t("\u5929")
      ));
      wrap.append(hero);
      const cards = el("stats-cards");
      const card = /* @__PURE__ */ __name((v, k) => {
        const c = el("stats-card");
        c.append(el("stats-card-v", v), el("stats-card-k", k));
        return c;
      }, "card");
      cards.append(
        card(fmt(keystrokes), t("\u7D2F\u8BA1\u51FB\u952E")),
        card(total > 0 ? (keystrokes / total).toFixed(1) : "\u2014", t("\u952E / \u5B57")),
        card(fmt(avgDaily), t("\u65E5\u5747\u5B57\u6570"))
      );
      wrap.append(cards);
      const DOW = [t("\u65E5"), t("\u4E00"), t("\u4E8C"), t("\u4E09"), t("\u56DB"), t("\u4E94"), t("\u516D")];
      const max = Math.max(1, ...days.map((d) => Number(d.chars) || 0));
      const bars = el("stats-bars");
      days.forEach((d, i) => {
        const isToday = i === days.length - 1;
        const col = el("stats-bar-col");
        const bar2 = el("stats-bar" + (isToday ? " today" : ""));
        bar2.style.height = Math.round(Math.max(0.04, (Number(d.chars) || 0) / max) * 100) + "%";
        col.append(bar2);
        const dow = el("stats-bar-dow" + (isToday ? " today" : ""));
        dow.textContent = DOW[(/* @__PURE__ */ new Date(d.date + "T00:00:00")).getDay()];
        col.append(dow);
        bars.append(col);
      });
      wrap.append(bars);
      let fun = "";
      if (total >= 800) {
        fun = t("\u2248") + " <b>" + Math.round(total / 800) + "</b> " + t("\u7BC7\u9AD8\u8003\u4F5C\u6587");
      } else if (total >= 140) {
        fun = t("\u2248") + " <b>" + Math.round(total / 140) + "</b> " + t("\u6761\u5FAE\u535A");
      } else {
        fun = t("\u518D\u6765") + " <b>" + (140 - total) + "</b> " + t("\u5B57\u5C31\u662F\u4E00\u6761\u5FAE\u535A");
      }
      wrap.append(el("stats-fun", fun + " \xB7 " + t("\u4E0E Feelime \u76F8\u4F34") + " <b>" + withDays + "</b> " + t("\u5929")));
      const badges = el("stats-badges");
      [100, 1e3, 1e4, 1e5, 1e6].forEach((m) => {
        const b = el("stats-badge" + (total >= m ? " earned" : ""));
        b.append(el("dot"));
        const label = document.createElement("span");
        label.textContent = m >= 1e4 ? fmt(m) : String(m);
        b.append(label);
        badges.append(b);
      });
      wrap.append(badges);
      layer.append(wrap);
      const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame.bind(window) : null;
      if (raf) raf(() => raf(() => wrap.classList.add("grown")));
      else wrap.classList.add("grown");
      this.countUp(layer.querySelector("#statsTotal"), total, unit, raf);
    }
    /** 大数字滚动（ease-out ~0.9s；键盘可见时 rAF 正常跑）。 */
    countUp(node, target, unitNode, raf) {
      if (!node) return;
      if (!(target > 0)) {
        node.textContent = "0";
        if (unitNode) node.append(unitNode);
        return;
      }
      if (!raf) {
        node.textContent = target.toLocaleString();
        if (unitNode) node.append(unitNode);
        return;
      }
      const start = Date.now();
      const step = /* @__PURE__ */ __name(() => {
        const p = Math.min(1, (Date.now() - start) / 900);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) raf(step);
        else if (unitNode) node.append(unitNode);
      }, "step");
      raf(step);
    }
    toggleEditPanel() {
      this.closeOtherViews("edit");
      const layer = document.getElementById("editLayer");
      if (layer && !layer.hidden) {
        this.closeEditPanel();
        return;
      }
      this.closeModeMenu();
      this.closeSettingsPanel();
      if (this.panelOpen) this.closePanel();
      if (this.ctrlView) this.suspendCtrlView();
      this.clearEditorStrip();
      this.editSelecting = false;
      this.renderEditPanel();
      this.editReturnLayer = this.keyLayer;
      this.keyLayer = "edit";
      this.hideKeyLayers();
      layer.hidden = false;
      this.hwNotifyPanelHeight();
    }
    closeEditPanel() {
      const layer = document.getElementById("editLayer");
      if (!layer || layer.hidden) return;
      layer.hidden = true;
      this.editSelecting = false;
      this.showKeyLayer(this.editReturnLayer || "letters");
      this.maybeResumeCtrlView();
    }
    renderEditPanel() {
      const layer = document.getElementById("editLayer");
      if (!layer) return;
      const grid = document.createElement("div");
      grid.className = "edit-grid";
      const cell = /* @__PURE__ */ __name((edit, label, opts = {}) => {
        const b = document.createElement("button");
        b.className = "kb-key kb-special" + (opts.word ? " edit-word" : "");
        b.dataset.edit = edit;
        if (opts.arrow) b.dataset.arrow = edit;
        b.textContent = label;
        if (opts.aria) {
          b.setAttribute("aria-label", t(opts.aria));
          b.setAttribute("data-i18n-aria-label", opts.aria);
        }
        b.addEventListener("touchstart", () => {
          b.classList.add("active-touch");
        }, { passive: true });
        const lift = /* @__PURE__ */ __name(() => b.classList.remove("active-touch"), "lift");
        b.addEventListener("touchend", lift);
        b.addEventListener("touchcancel", lift);
        grid.append(b);
        return b;
      }, "cell");
      cell("up", "\u2191", { arrow: true, aria: "\u5149\u6807\u4E0A\u79FB" });
      cell("left", "\u2190", { arrow: true, aria: "\u5149\u6807\u5DE6\u79FB" });
      const sel = cell("sel", t("\u9009\u62E9"), { aria: "\u9009\u62E9" });
      cell("right", "\u2192", { arrow: true, aria: "\u5149\u6807\u53F3\u79FB" });
      cell("down", "\u2193", { arrow: true, aria: "\u5149\u6807\u4E0B\u79FB" });
      cell("home", "|\u2190", { aria: "\u5149\u6807\u5230\u884C\u9996" });
      cell("all", t("\u5168\u9009"), { word: true, aria: "\u5168\u9009" });
      cell("end", "\u2192|", { aria: "\u5149\u6807\u5230\u884C\u5C3E" });
      cell("del", t("\u5220\u9664"), { word: true, aria: "\u5220\u9664" });
      cell("copy", t("\u590D\u5236"), { word: true, aria: "\u590D\u5236" });
      cell("cut", t("\u526A\u5207"), { word: true, aria: "\u526A\u5207" });
      cell("paste", t("\u7C98\u8D34"), { word: true, aria: "\u7C98\u8D34" });
      const cursor = /* @__PURE__ */ __name((way) => {
        if (this.editSelecting) {
          this.sendCombo(["Shift", {
            up: "ArrowUp",
            down: "ArrowDown",
            left: "ArrowLeft",
            right: "ArrowRight"
          }[way]]);
        } else if (typeof Native.editorCursor === "function") {
          this.call(() => Native.editorCursor(way, this.token));
        } else {
          this.sendCombo([{
            up: "ArrowUp",
            down: "ArrowDown",
            left: "ArrowLeft",
            right: "ArrowRight"
          }[way]]);
        }
      }, "cursor");
      const bind = /* @__PURE__ */ __name((edit, handler) => {
        const el = grid.querySelector(`[data-edit="${edit}"]`);
        el.addEventListener("click", handler);
      }, "bind");
      bind("up", () => cursor("up"));
      bind("down", () => cursor("down"));
      bind("left", () => cursor("left"));
      bind("right", () => cursor("right"));
      bind("home", () => this.sendCombo(this.editSelecting ? ["Shift", "Home"] : ["Home"]));
      bind("end", () => this.sendCombo(this.editSelecting ? ["Shift", "End"] : ["End"]));
      bind("all", () => this.call(() => Native.editorAction("selectAll", this.token)));
      const disarm = /* @__PURE__ */ __name(() => {
        this.editSelecting = false;
        sel.classList.remove("armed");
      }, "disarm");
      bind("del", () => {
        this.call(() => Native.backspace(this.token));
        disarm();
      });
      bind("copy", () => {
        this.call(() => Native.editorAction("copy", this.token));
        disarm();
      });
      bind("cut", () => {
        this.call(() => Native.editorAction("cut", this.token));
        disarm();
      });
      bind("paste", () => {
        this.call(() => Native.editorAction("paste", this.token));
        disarm();
      });
      sel.addEventListener("click", () => {
        this.editSelecting = !this.editSelecting;
        sel.classList.toggle("armed", this.editSelecting);
      });
      layer.replaceChildren(grid);
    }
    /** Quick settings sub-pages: only the custom-row editor's
     * return landing (定制符号) is left - the quick-switch and
     * long-press-menu pages were superseded by tile deep-links into
     * the settings app (3.59.6) and removed. */
    renderSettingsPanel(page = this.settingsPage) {
      const panel = document.getElementById("settingsPanel");
      panel.replaceChildren();
      if (page) {
        this.showSettingsPageBar(page === "custom" ? t("\u5B9A\u5236\u6309\u952E") : "");
      } else {
        this.hideSettingsPageBar();
      }
      if (page === "custom") this.renderCustomPage(panel);
      else this.renderSettingsHome(panel);
    }
    /** Sub-page chrome lives in the candidate bar - a ‹ back
     * button and the page title on the left, a close × on the right,
     * same .tool pill styling as the rest of the toolbar; every regular
     * tool hides while a sub-page is up (body.settings-page). */
    showSettingsPageBar(title) {
      const bar = document.getElementById("settingsPageBar");
      bar.replaceChildren();
      const back = document.createElement("button");
      back.className = "tool";
      back.textContent = "\u2039";
      back.setAttribute("aria-label", t("\u8FD4\u56DE\u8BBE\u7F6E\u9996\u9875"));
      back.addEventListener("click", () => {
        this.settingsPage = null;
        this.renderSettingsPanel();
      });
      const label = document.createElement("span");
      label.className = "page-title";
      label.textContent = title;
      const close = document.createElement("button");
      close.className = "tool";
      close.textContent = "\xD7";
      close.setAttribute("aria-label", t("\u6536\u8D77\u8BBE\u7F6E"));
      close.addEventListener("click", () => this.closeSettingsPanel());
      bar.append(back, label, close);
      bar.hidden = false;
      document.body.classList.add("settings-page");
    }
    hideSettingsPageBar() {
      const bar = document.getElementById("settingsPageBar");
      if (bar) bar.hidden = true;
      document.body.classList.remove("settings-page");
    }
    /** 快捷设置首页：微信式 2×4 方块网格，横向滑动翻页（native
     *  scroll-snap，无手势代码）。工具栏保持现状（齿轮=完整设置），
     *  网格末尾再放一块大的「完整设置」。与主键盘重复的能力（语音、
     *  剪贴板）不进面板；tile 即状态——点按直接生效并重渲染回读。 */
    renderSettingsHome(panel) {
      const wrap = document.createElement("div");
      wrap.className = "qs-wrap";
      const pages = document.createElement("div");
      pages.className = "qs-pages";
      const defs = this.quickTileDefs();
      for (let i = 0; i < defs.length; i += 8) {
        const page = document.createElement("div");
        page.className = "qs-page";
        defs.slice(i, i + 8).forEach((def) => page.append(this.qsTile(def)));
        pages.append(page);
      }
      let drag = null;
      const pageW = /* @__PURE__ */ __name(() => pages.firstElementChild ? pages.firstElementChild.offsetWidth : 0, "pageW");
      pages.addEventListener("touchstart", (e) => {
        const t2 = e.touches && e.touches[0];
        if (!t2) return;
        drag = {
          startX: t2.clientX,
          startY: t2.clientY,
          startLeft: pages.scrollLeft,
          lastX: t2.clientX,
          lastT: Date.now(),
          v: 0,
          axis: null
        };
      }, { passive: true });
      pages.addEventListener("touchmove", (e) => {
        if (!drag) return;
        const t0 = e.touches && e.touches[0];
        if (!t0) return;
        const x = t0.clientX;
        const y = t0.clientY;
        if (drag.axis === null) {
          const dx = Math.abs(x - drag.startX);
          const dy = Math.abs(y - drag.startY);
          if (dx < 8 && dy < 8) return;
          drag.axis = dx > dy ? "x" : "y";
        }
        if (drag.axis !== "x") {
          drag = null;
          return;
        }
        const now = Date.now();
        drag.v = (x - drag.lastX) / Math.max(1, now - drag.lastT);
        drag.lastX = x;
        drag.lastT = now;
        e.preventDefault();
        const pw = pageW();
        if (!pw) return;
        const max = (pages.children.length - 1) * pw;
        let left = drag.startLeft - (x - drag.startX);
        if (left < 0) left /= 3;
        if (left > max) left = max + (left - max) / 3;
        pages.scrollLeft = left;
      }, { passive: false });
      pages.addEventListener("touchend", () => {
        if (!drag) return;
        const pw = pageW();
        if (drag.axis === "x" && pw) {
          const startPage = Math.round(drag.startLeft / pw);
          const delta = pages.scrollLeft - drag.startLeft;
          const distance = Math.abs(delta);
          const fast = Math.abs(drag.v) > 0.2 && distance > pw * 0.04;
          let page = startPage;
          if (fast || distance > pw * 0.25) {
            page = startPage + (delta > 0 ? 1 : -1);
          }
          page = Math.max(startPage - 1, Math.min(page, startPage + 1));
          page = Math.max(0, Math.min(page, pages.children.length - 1));
          pages.scrollTo({ left: page * pw, behavior: "smooth" });
        }
        drag = null;
      });
      pages.addEventListener("scroll", () => this.qsSyncDots(pages), { passive: true });
      const dots = document.createElement("div");
      dots.className = "qs-dots";
      pages.querySelectorAll(".qs-page").forEach(() => dots.append(document.createElement("span")));
      wrap.append(pages, dots);
      panel.append(wrap);
      this.qsPages = pages;
      const restore = /* @__PURE__ */ __name(() => {
        if (!pages.isConnected || this.qsPages !== pages) return;
        const pageW2 = pages.firstElementChild ? pages.firstElementChild.offsetWidth : 0;
        if (!pageW2) {
          requestAnimationFrame(restore);
          return;
        }
        pages.scrollLeft = pageW2 * (this.qsPage || 0);
        this.qsSyncDots(pages);
      }, "restore");
      restore();
    }
    qsTile(def) {
      const tile = document.createElement("button");
      tile.className = "qs-tile" + (def.on && def.on() ? " on" : "") + (def.big ? " qs-big" : "");
      if (def.icon) tile.append(def.icon.cloneNode(true));
      const name = document.createElement("span");
      name.className = "qs-name";
      name.textContent = def.label;
      tile.append(name);
      if (def.state) {
        const state = document.createElement("span");
        state.className = "qs-state";
        state.textContent = def.state();
        tile.append(state);
      }
      tile.addEventListener("click", () => def.tap());
      if (def.hold) {
        let holdTimer = null;
        const holdMs = Number(this.holdMs) > 0 ? Number(this.holdMs) : 450;
        tile.addEventListener("touchstart", () => {
          holdTimer = setTimeout(() => {
            holdTimer = null;
            this.closeSettingsPanel();
            this.call(() => Native.openSetupPage(def.hold, this.token));
          }, holdMs);
        }, { passive: true });
        const cancel = /* @__PURE__ */ __name(() => {
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
        }, "cancel");
        tile.addEventListener("touchmove", cancel, { passive: true });
        tile.addEventListener("touchend", cancel);
        tile.addEventListener("touchcancel", cancel);
      }
      return tile;
    }
    /** 翻页圆点跟随横向滚动位置（scroll 事件驱动，无触摸仲裁）；
     *  当前页码记到 this.qsPage，重渲染后由 renderSettingsHome 恢复。 */
    qsSyncDots(pages) {
      const strip = pages || this.qsPages;
      if (!strip || !strip.parentNode) return;
      const dots = strip.parentNode.querySelector(".qs-dots");
      if (!dots || !dots.children.length || !strip.firstElementChild) return;
      const pageW = strip.firstElementChild.offsetWidth || 1;
      const idx = Math.max(0, Math.min(
        dots.children.length - 1,
        Math.round(strip.scrollLeft / pageW)
      ));
      this.qsPage = idx;
      [...dots.children].forEach((dot, i) => dot.classList.toggle("cur", i === idx));
    }
    /** 快捷偏好的未决意图层：tap 把「下一个值」写进 quickPending 并
     *  发送；hello 快照只有等于意图才撤签。渲染读 qRead（意图优先），
     *  连点永远基于上一次意图翻转/步进，不会丢操作（codex P2）。 */
    qRead(key, actual) {
      const pending = this.quickPending[key];
      return pending === void 0 ? actual : pending;
    }
    /** 单手直达切换（#38）记忆的侧：1=左 2=右；无记忆默认右手。
     *  native 记忆（hello 下发）优先——设置页选侧时键盘 WebView 可能
     *  根本没创建，localStorage 永远不更新（codex P2-3）。 */
    oneHandSide() {
      if (this.oneHandSideMemory === 1 || this.oneHandSideMemory === 2) {
        return this.oneHandSideMemory;
      }
      const v = Number(localStorage.getItem("feelime_onehand_side"));
      return v === 1 || v === 2 ? v : 2;
    }
    qFlip(key, current) {
      const pending = this.quickPending[key];
      const next = pending === void 0 ? !current : !pending;
      this.quickPending[key] = next;
      return next;
    }
    qStep(key, list, current) {
      const pending = this.quickPending[key];
      const cur = pending === void 0 ? current : pending;
      const next = list[(list.indexOf(cur) + 1) % list.length];
      this.quickPending[key] = next;
      return next;
    }
    qConfirm(key, actual) {
      const pending = this.quickPending[key];
      if (pending !== void 0 && String(pending) === String(actual)) {
        delete this.quickPending[key];
      }
    }
    /** 方块定义：{icon, label, state?, on?, big?, tap}。state() 返回
     *  状态行文本，on() 高亮开关/当前档；写偏好走 ImeBridge.setQuickPref
     *  （旧 APK 没有该方法：typeof 守卫，点了不动，不产生假状态）。 */
    quickTileDefs() {
      const quickPref = /* @__PURE__ */ __name((key, value) => {
        if (typeof Native.setQuickPref === "function") {
          this.call(() => Native.setQuickPref(key, String(value), this.token));
        }
      }, "quickPref");
      const cycle = /* @__PURE__ */ __name((list, cur) => list[(list.indexOf(cur) + 1) % list.length], "cycle");
      const themeText = { auto: t("\u8DDF\u968F\u7CFB\u7EDF"), light: t("\u6D45\u8272"), dark: t("\u6DF1\u8272") };
      const snapText = { 0: t("\u677E"), 1: t("\u6807\u51C6"), 2: t("\u7D27") };
      const CAND_STEPS = [80, 90, 100, 110, 120, 130, 140, 150];
      const oneHandText = { 0: t("\u5173"), 1: t("\u5DE6\u624B"), 2: t("\u53F3\u624B") };
      const themeTheme = /* @__PURE__ */ __name(() => this.themeMode || "auto", "themeTheme");
      const rehome = /* @__PURE__ */ __name(() => {
        if (this.settingsPage === null) this.renderSettingsPanel();
      }, "rehome");
      const customRows = this.customKeys();
      return [
        {
          icon: ICONS.theme,
          label: t("\u8272\u5F69\u6A21\u5F0F"),
          hold: "themeMode",
          state: /* @__PURE__ */ __name(() => themeText[themeTheme()] || themeText.auto, "state"),
          tap: /* @__PURE__ */ __name(() => {
            this.cycleThemeNative();
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.assoc,
          label: t("\u4E2D\u6587\u8054\u60F3"),
          hold: "associationOn",
          on: /* @__PURE__ */ __name(() => this.qRead("association", this.associationOn), "on"),
          state: /* @__PURE__ */ __name(() => this.qRead("association", this.associationOn) ? t("\u5F00") : t("\u5173"), "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.associationOn = this.qFlip("association", this.associationOn);
            if (!this.associationOn) this.assocWords = [];
            quickPref("association", this.associationOn ? "1" : "0");
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.sound,
          label: t("\u6309\u952E\u58F0\u97F3"),
          hold: "keySound",
          on: /* @__PURE__ */ __name(() => this.qRead("keySound", this.keySound), "on"),
          state: /* @__PURE__ */ __name(() => this.qRead("keySound", this.keySound) ? t("\u5F00") : t("\u5173"), "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.keySound = this.qFlip("keySound", this.keySound);
            quickPref("keySound", this.keySound ? "1" : "0");
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.vibrate,
          label: t("\u6309\u952E\u632F\u52A8"),
          hold: "keyHaptic",
          on: /* @__PURE__ */ __name(() => this.qRead("keyHaptic", this.keyHaptic), "on"),
          state: /* @__PURE__ */ __name(() => this.qRead("keyHaptic", this.keyHaptic) ? t("\u5F00") : t("\u5173"), "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.keyHaptic = this.qFlip("keyHaptic", this.keyHaptic);
            quickPref("keyHaptic", this.keyHaptic ? "1" : "0");
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.height,
          label: t("\u952E\u76D8\u9AD8\u5EA6"),
          hold: "kbHeight",
          state: /* @__PURE__ */ __name(() => t("\u8C03\u8282"), "state"),
          tap: /* @__PURE__ */ __name(() => this.enterHeightEdit(), "tap")
        },
        {
          // #41 二轮：输入统计（键盘区浮层，含动画与换算）。
          icon: ICONS.stats,
          label: t("\u8F93\u5165\u7EDF\u8BA1"),
          state: /* @__PURE__ */ __name(() => t("\u67E5\u770B"), "state"),
          tap: /* @__PURE__ */ __name(() => {
            this.toggleStatsPanel();
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.swap,
          label: t("\u5FEB\u6377\u5207\u6362"),
          state: /* @__PURE__ */ __name(() => this.quickPair.map((m) => modeLabel(m)).join(" \xB7 "), "state"),
          // 验收 2026-09-24 二改：tile 直达完整设置的「对应设置
          // 行」（quickPairA=快捷切换对），不再只落卡级；锚定
          // 与呼吸灯由设置页 focusSetting 统一处理。
          tap: /* @__PURE__ */ __name(() => {
            this.closeSettingsPanel();
            this.call(() => Native.openSetupPage("quickPairA", this.token));
          }, "tap")
        },
        {
          icon: ICONS.menu,
          label: t("\u957F\u6309\u83DC\u5355"),
          state: /* @__PURE__ */ __name(() => t("{0} \u4E2A\u952E\u76D8", this.menuModes().length), "state"),
          // menuModesRow=「长按菜单里列出哪些键盘」设置行。
          tap: /* @__PURE__ */ __name(() => {
            this.closeSettingsPanel();
            this.call(() => Native.openSetupPage("menuModesRow", this.token));
          }, "tap")
        },
        {
          icon: ICONS.font,
          label: t("\u5019\u9009\u5B57\u53F7"),
          hold: "candidateFont",
          state: /* @__PURE__ */ __name(() => `${this.qRead("candidateFont", this.candidateFont)}%`, "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.candidateFont = this.qStep("candidateFont", CAND_STEPS, this.candidateFont);
            this.applyCandidateFont();
            quickPref("candidateFont", this.candidateFont);
            rehome();
          }, "tap")
        },
        {
          // 单手模式（issue #15 起，#38 改直达）：单击 = 开
          // （上次用的侧，无记忆右手）/关，不再三档循环；
          // 侧在长按设置行或设置 App 里选。tile 状态行常显
          // 当前模式（qRead 回读，含未决意图）。
          icon: ICONS.onehand,
          label: t("\u5355\u624B\u6A21\u5F0F"),
          hold: "oneHand",
          state: /* @__PURE__ */ __name(() => oneHandText[this.qRead("oneHand", this.oneHand)] || oneHandText[0], "state"),
          on: /* @__PURE__ */ __name(() => (this.qRead("oneHand", this.oneHand) || 0) !== 0, "on"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.oneHand = this.qRead("oneHand", this.oneHand) === 0 ? this.oneHandSide() : 0;
            this.quickPending["oneHand"] = this.oneHand;
            this.applyOneHand();
            quickPref("oneHand", this.oneHand);
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.pad,
          label: t("\u5E95\u90E8\u7559\u767D"),
          hold: "bottomPadPortrait",
          state: /* @__PURE__ */ __name(() => {
            const pad = this.qRead("bottomPad", this.bottomPad);
            return pad ? pad + "dp" : t("\u5173");
          }, "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.bottomPad = this.qStep("bottomPad", [0, 12, 24, 36, 48], Number(this.bottomPad) || 0);
            this.applyHeight();
            quickPref("bottomPad", this.bottomPad);
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.timer,
          label: t("\u957F\u6309\u65F6\u957F"),
          hold: "holdMs",
          state: /* @__PURE__ */ __name(() => (Number(this.qRead("holdMs", this.holdMs)) || 350) + "ms", "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.holdMs = this.qStep("holdMs", [200, 300, 350, 450, 600], Number(this.holdMs) || 350);
            quickPref("holdMs", this.holdMs);
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.snap,
          label: t("\u6ED1\u52A8\u9009\u5B57"),
          hold: "scrubSpeed",
          state: /* @__PURE__ */ __name(() => snapText[this.qRead("popupSnap", this.popupSnap)] || snapText[1], "state"),
          tap: /* @__PURE__ */ __name(() => {
            if (typeof Native.setQuickPref !== "function") return;
            this.popupSnap = this.qStep("popupSnap", [0, 1, 2], this.popupSnap);
            quickPref("popupSnap", this.popupSnap);
            rehome();
          }, "tap")
        },
        {
          icon: ICONS.swap,
          label: t("\u7F16\u8F91\u5DE5\u5177\u680F"),
          tap: /* @__PURE__ */ __name(() => {
            this.closeSettingsPanel();
            this.enterToolbarEdit();
          }, "tap")
        },
        {
          icon: ICONS.gear,
          label: t("\u5B8C\u6574\u8BBE\u7F6E"),
          big: true,
          tap: /* @__PURE__ */ __name(() => {
            this.closeSettingsPanel();
            this.call(() => Native.openSetup(this.token));
          }, "tap")
        }
      ];
    }
    /** 自然码键位图（，重排，再调）：说明统一
     * 在示意图上方；每行独立居中（不再用 shift/⌫ 占位格凑宽度）；
     * 双韵母键内上下两行；V 的前两个短 candidate 并排一行（ui ü）。 */
    /** The custom table is PASTED JSON now - one editor for
     * the whole table (validation errors are shown, never swallowed),
     * plus a template button for a quick start. */
    renderCustomPage(panel) {
      const box = document.createElement("div");
      box.className = "custom-editor";
      const hint = document.createElement("div");
      hint.className = "pair-hint";
      hint.textContent = t("\u7C98\u8D34 JSON \u5B9A\u4E49\u7B26\u53F7\u952E\u76D8\uFF08\u6700\u591A 3 \u884C\uFF0C\u6BCF\u884C\u952E\u6570\u4E0D\u9650\uFF09\uFF1At=\u952E\u9762\uFF0C") + t("tap=\u5355\u51FB\u884C\u4E3A\uFF08\u6587\u672C / [esc] \u5355\u952E / [ctrl+s] \u7EC4\u5408\uFF0C\u53EF\u6DF7\u6392\uFF0C\u5982 [esc]ggVGD\uFF09\uFF0C") + t("span=\u5BBD\u952E\u500D\u6570\uFF081-3\uFF0C\u53EF\u9009\uFF09\uFF0Ccolor=\u952E\u9762\u989C\u8272\uFF08blue/green/orange/red/purple\uFF0C\u53EF\u9009\uFF09\uFF0C[backspace]=\u9000\u683C\uFF0C") + t("align=\u884C\u5BF9\u9F50\uFF08left/center/right\uFF0C\u53EF\u9009\uFF0C\u6302\u884C\u5185\u4EFB\u610F\u952E\uFF09\u3002note=\u957F\u6309\u8BF4\u660E\u3002\u8D85\u5BBD\u7684\u884C\u53EF\u4EE5\u5DE6\u53F3\u62D6\u52A8\u67E5\u770B\u3002");
      box.append(hint);
      const status = document.createElement("div");
      status.className = "set-row";
      const label = document.createElement("span");
      label.className = "set-label";
      label.textContent = t("\u5F53\u524D\u72B6\u6001");
      const preview = document.createElement("span");
      preview.className = "custom-preview";
      const rows = this.customKeys();
      preview.textContent = rows ? t("\u5DF2\u5B9A\u5236 {0} \u4E2A\u952E", rows.reduce((sum, row) => sum + (row || []).length, 0)) : t("\u672A\u5B9A\u5236");
      status.append(label, preview);
      const actions = document.createElement("div");
      actions.className = "custom-actions";
      const edit = document.createElement("button");
      edit.className = "set-opt set-nav";
      edit.textContent = t("\u7C98\u8D34 JSON \u203A");
      edit.setAttribute("aria-label", t("\u7C98\u8D34 JSON \u5B9A\u5236\u7B26\u53F7"));
      edit.addEventListener("click", () => this.openCustomJsonEditor());
      const template = document.createElement("button");
      template.className = "set-opt set-nav";
      template.textContent = t("\u63D2\u5165\u6A21\u677F \u203A");
      template.setAttribute("aria-label", t("\u63D2\u5165\u5B9A\u5236\u6A21\u677F"));
      template.addEventListener("click", () => this.openCustomJsonEditor(CUSTOM_TEMPLATE));
      const docs = document.createElement("button");
      docs.className = "set-opt set-nav";
      docs.textContent = t("\u67E5\u770B\u8BF4\u660E \u203A");
      docs.setAttribute("aria-label", t("\u67E5\u770B\u5B9A\u5236\u7B26\u53F7\u8BF4\u660E"));
      docs.addEventListener("click", () => {
        if (typeof Native.openDocs === "function") this.call(() => Native.openDocs(this.token));
      });
      actions.append(edit, template, docs);
      box.append(status, actions);
      panel.append(box);
    }
    /** Edit the whole custom table as JSON in the shared
     * editor strip (textarea; system paste works there). */
    openCustomJsonEditor(prefill = null) {
      this.editorReturn = "custom";
      this.customEditRow = null;
      const current = this.customKeys();
      const rows = current || JSON.parse(CUSTOM_TEMPLATE).rows;
      const editor = document.getElementById("panelEditor");
      const input = document.getElementById("panelEditorInput");
      const area = document.getElementById("panelEditorArea");
      input.hidden = true;
      area.hidden = false;
      area.value = prefill != null ? prefill : JSON.stringify({ version: 1, rows }, null, 2);
      area.placeholder = t("\u7C98\u8D34\u5B9A\u5236 JSON");
      this.editorMode = "custom-json";
      this.closeSettingsPanel();
      this.showKeyLayer("letters");
      document.body.classList.add("editing");
      this.hwNotifyPanelHeight();
      editor.hidden = false;
      area.focus();
      this.setPanelInput(true);
    }
    /** Validate + persist the pasted JSON. Errors keep the
     * editor open and name the first problem - nothing is truncated
     * silently. */
    saveCustomJson(text) {
      const parsed = this.parseCustomKeys(text);
      if (parsed.error) {
        this.showToast(parsed.error);
        return;
      }
      try {
        const payload = JSON.stringify({
          version: 1,
          rows: parsed.rows,
          langKeys: parsed.langKeys || this.storedLangKeys() || void 0
        });
        localStorage.setItem(CUSTOM_KEYS_STORE, payload);
        Native.setCustomKeys(payload, this.token);
      } catch (_) {
        this.showToast(t("\u4FDD\u5B58\u5931\u8D25\uFF1A\u672C\u5730\u5B58\u50A8\u4E0D\u53EF\u7528"));
        return;
      }
      this.editorMode = null;
      this.renderSymbolCats();
      this.closePanelEditor();
      this.showToast(t("\u5DF2\u4FDD\u5B58 {0} \u4E2A\u952E", parsed.rows.reduce((sum, row) => sum + row.length, 0)));
    }
    /** Minimal in-flow touch drag (pairs, phrases):
     * while the finger holds a row handle the row swaps with whatever
     * sibling it crosses; onDrop receives the resulting row-id order. */
    bindListDrag(row, box, rowSelector, idAttr, onDrop) {
      const handle = row.querySelector(".pair-drag");
      handle.addEventListener("touchstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
        row.classList.add("dragging");
        const move = /* @__PURE__ */ __name((ev) => {
          ev.preventDefault();
          const y = ev.touches[0].clientY;
          for (const other of box.querySelectorAll(rowSelector)) {
            if (other === row) continue;
            const r = other.getBoundingClientRect();
            if (y >= r.top && y <= r.bottom) {
              if (y > r.top + r.height / 2 && row.nextElementSibling !== other) {
                box.insertBefore(row, other.nextElementSibling);
              } else if (y <= r.top + r.height / 2 && row.previousElementSibling !== other) {
                box.insertBefore(row, other);
              }
              break;
            }
          }
        }, "move");
        const up = /* @__PURE__ */ __name(() => {
          row.classList.remove("dragging");
          handle.removeEventListener("touchmove", move);
          handle.removeEventListener("touchend", up);
          handle.removeEventListener("touchcancel", up);
          onDrop([...box.querySelectorAll(rowSelector)].map((el) => el.dataset[idAttr]));
        }, "up");
        handle.addEventListener("touchmove", move, { passive: false });
        handle.addEventListener("touchend", up);
        handle.addEventListener("touchcancel", up);
      }, { passive: false });
    }
    /** Saved drag order  applied to the long-press menu. */
    modeOrder() {
      const ordered = this.orderedModeNames();
      let menu = null;
      try {
        menu = JSON.parse(localStorage.getItem("feelime_menu_modes") || "null");
      } catch (_) {
      }
      if (Array.isArray(menu)) {
        const filtered = ordered.filter((name) => menu.includes(name));
        if (filtered.length) return filtered;
      }
      const enabled = ordered.filter((name) => DEFAULT_MENU_MODES.includes(name));
      return enabled.length ? enabled : ordered;
    }
    /** Every known keyboard in the saved drag order (unfiltered). */
    orderedModeNames() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem("feelime_mode_order") || "null");
      } catch (_) {
      }
      const names = Object.keys(MODES);
      if (Array.isArray(saved)) {
        const clean = saved.filter((n) => MODES[n]);
        names.forEach((n) => {
          if (!clean.includes(n)) clean.push(n);
        });
        return clean;
      }
      return names;
    }
    /** Which keyboards the long-press menu lists. Null = all. */
    menuModes() {
      let menu = null;
      try {
        menu = JSON.parse(localStorage.getItem("feelime_menu_modes") || "null");
      } catch (_) {
      }
      const filtered = Array.isArray(menu) && menu.length ? this.orderedModeNames().filter((name) => menu.includes(name)) : null;
      return filtered && filtered.length ? filtered : this.orderedModeNames();
    }
    /* ===== candidates ===== */
    clearComposing() {
      this.pendingPunct = null;
      this.call(() => Native.clearComposing(this.token));
      this.composing = false;
      this.updateComposing({ composing: false }, "");
      if (this.expanded) this.setExpanded(false);
    }
    setExpanded(expanded) {
      this.expanded = expanded;
      this.hwNotifyPanelHeight();
      document.body.classList.toggle("expanded", expanded);
      document.getElementById("expandLayer").hidden = !expanded;
      if (expanded) {
        const key = this.lastRawInput || "";
        if (key !== this.expandKey) {
          this.expandKey = key;
          this.expandCandidates = [];
          this.variantAnchor = null;
        }
        this.loadingMore = false;
        this.accumulateCandidates(this.lastEngineState || {});
        this.renderExpanded();
        this.renderCandidates(this.lastEngineState || {});
        this.maybeLoadMoreCandidates();
      } else {
        document.getElementById("expandPreedit").textContent = "";
      }
    }
    /** Merge one engine state's candidates into the strip (dedupe by id). */
    accumulateCandidates(state) {
      const known = new Set(this.expandCandidates.map((candidate) => candidate.id));
      (state.candidates || []).forEach((candidate) => {
        if (!known.has(candidate.id)) this.expandCandidates.push(candidate);
      });
      this.expandHasNext = !!state.hasNextPage;
      this.loadingMore = false;
      this.injectFavoriteCandidates();
      if (this.symbolicPrefixChanged) {
        this.symbolicPrefixChanged = false;
        if (this.expanded) this.renderExpanded();
      }
    }
    /** 常用语注入 (design §7.4): favorites whose input code
     * prefixes the raw keys join the shared pool. Exact code matches take
     * their configured 1-based rank slot (default 1 = the pool
     * head, as before rank slots existed); prefix matches sit after the
     * engine's first candidate.
     * These are overlay entries (fav:<id>) - the engine holds no such
     * candidate, so choosing them commits the text directly instead of
     * Native.chooseCandidate. The pool is RECOMPUTED from the
     * engine slice every call (all fav: entries are stripped first), so
     * list edits mid-composition converge instead of losing or stranding
     * earlier fav entries.
     * Accent variants (alt:<char>) join the same overlay -
     * the layout's accented long-press set for the composition's FIRST
     * character, so typing "ete" offers é/è/ê/ë one tap away (iOS-style;
     * picking one REPLACES the first character and keeps composing via
     * switchToVariant). Position is AFTER the engine's first candidate
     * (never at the head - the space key confirms
     * expandCandidates[0], and "a"+space must stay "a", not "à").
     * Only accented glyphs are taken - alts also carry digits/'-' which
     * must not surf in the word bar. */
    injectFavoriteCandidates() {
      const rawEngine = this.expandCandidates.filter((candidate) => !String(candidate.id).startsWith("fav:") && !String(candidate.id).startsWith("dyn:") && !String(candidate.id).startsWith("alt:"));
      const ranks = this.symbolRanks || {};
      const freqOn = this.symbolFreqSort === true;
      const symbolic = rawEngine.filter((candidate) => isSymbolicText(candidate.text));
      let engine = rawEngine;
      if (symbolic.length) {
        const slotted = /* @__PURE__ */ __name((candidate) => {
          const rank = Number(ranks[candidate.text]);
          return Number.isInteger(rank) && rank >= 1 && rank <= 9;
        }, "slotted");
        const auto = symbolic.filter((candidate) => !slotted(candidate));
        const pinnedSyms = symbolic.filter((candidate) => slotted(candidate));
        let autos = auto;
        if (freqOn && auto.length) {
          const counts = readSymbolUseCounts();
          autos = auto.map((candidate, index) => ({ candidate, index, uses: counts[candidate.text] || 0 })).sort((a, b) => b.uses - a.uses || a.index - b.index).map((entry) => entry.candidate);
        }
        const restAll = rawEngine.filter((candidate) => !symbolic.includes(candidate));
        if (freqOn) {
          const counts = readSymbolUseCounts();
          const promoted = autos.filter((candidate) => (counts[candidate.text] || 0) >= SYMBOL_PROMOTE_AT);
          const plain = autos.filter((candidate) => (counts[candidate.text] || 0) < SYMBOL_PROMOTE_AT);
          engine = [...promoted, ...restAll.slice(0, 2), ...plain, ...restAll.slice(2), ...pinnedSyms];
        } else {
          engine = [...restAll.slice(0, 2), ...autos, ...restAll.slice(2), ...pinnedSyms];
        }
      }
      if (this.mode === "stroke" && !(this.lastRawInput || "").includes("'")) {
        const sentences = engine.filter((candidate) => [...candidate.text].length > 1);
        if (sentences.length) {
          const rest = engine.filter((candidate) => !sentences.includes(candidate));
          engine = [...rest, ...sentences];
        }
      }
      const raw = (this.lastRawInput || "").replace(/ /g, "").toLowerCase();
      const engineTexts = new Set(engine.map((candidate) => candidate.text));
      const dyn = (raw && this.dynamicDateTimeOn !== false ? dynamicCandidatesFor(raw, this.mode) : []).filter((item) => !engineTexts.has(item.text));
      const exact = [];
      const prefix = [];
      if (raw) {
        (this.favoriteItems || []).forEach((item) => {
          const code = (item.code || "").toLowerCase();
          if (!code || !raw.startsWith(code)) return;
          if (engineTexts.has(item.text)) return;
          (raw === code ? exact : prefix).push({
            id: `fav:${item.id}`,
            text: item.text,
            favorite: true,
            rank: item.rank || 1
          });
        });
      }
      const variants = [];
      if (raw && raw.length === 1) {
        const layout = LAYOUTS[MODES[this.mode] && MODES[this.mode].layout];
        const alts = layout && layout.alts[raw[0]];
        if (Array.isArray(alts)) {
          alts.forEach((ch) => {
            if (ch.charCodeAt(0) < 128 || engineTexts.has(ch)) return;
            variants.push({ id: `alt:${ch}`, text: ch, variant: true });
          });
        }
      }
      const pool = [
        ...dyn.filter((item) => item.head),
        ...engine.slice(0, 1),
        ...variants,
        ...dyn.filter((item) => !item.head),
        ...prefix,
        ...engine.slice(1)
      ];
      let prevRank = 0;
      let prevIndex = -1;
      exact.slice().sort((a, b) => a.rank - b.rank).forEach((item) => {
        const at = item.rank === prevRank ? prevIndex + 1 : Math.min(item.rank - 1, pool.length);
        pool.splice(at, 0, item);
        prevRank = item.rank;
        prevIndex = at;
      });
      this.expandCandidates = pool;
      const signatures = this.englishOrderedPool(pool).map((candidate) => candidate.id + "\0" + candidate.text);
      const previous = this.symbolicPrefixIds || [];
      this.symbolicPrefixChanged = previous.length > signatures.length || previous.slice(0, Math.max(this.expandRendered || 0, 3)).some((signature, i) => signature !== signatures[i]);
      this.symbolicPrefixIds = signatures;
    }
    /** Single pick funnel for pool entries: engine ids ride the engine
     * channel; overlay entries (favorites, dynamic date/time dyn:)
     * clear the composition and commit;
     * accent variants swap the first character and KEEP the
     * composition alive - pick é on "ete" and it becomes "éte",
     * still composing (iOS-style, via the atomic setComposition). */
    choosePoolCandidate(candidate, hwSeq, hwGen) {
      if (this.mode === "french" && this.caseMode && this.composing && candidate && !String(candidate.id).startsWith("alt:")) {
        const text = this.caseifyText(candidate.text);
        if (text !== candidate.text) {
          this.call(() => Native.clearComposing(this.token));
          this.call(() => Native.commitText(text + " ", this.token));
          return;
        }
      }
      if (candidate && String(candidate.id).startsWith("dyn:")) {
        this.call(() => Native.clearComposing(this.token));
        this.call(() => Native.commitText(candidate.text, this.token));
        return;
      }
      if (candidate && String(candidate.id).startsWith("fav:")) {
        this.call(() => Native.clearComposing(this.token));
        this.call(() => Native.commitText(candidate.text, this.token));
        return;
      }
      if (candidate && String(candidate.id).startsWith("alt:")) {
        const raw = (this.lastRawInput || "").replace(/ /g, "");
        this.switchToVariant(candidate.text + raw.slice(1));
        return;
      }
      if (hwSeq) this.hwWaitSeq = Math.max(this.hwWaitSeq || 0, hwSeq);
      const bumpSymbol = candidate && isSymbolicText(candidate.text) ? (() => {
        const counts = readSymbolUseCounts();
        counts[candidate.text] = (counts[candidate.text] || 0) + 1;
        writeSymbolUseCounts(counts);
      }) : null;
      this.call((revision) => {
        if (bumpSymbol) bumpSymbol();
        return hwSeq && typeof Native.hwChoose === "function" ? Native.hwChoose(hwSeq, hwGen, revision, candidate.id, this.token) : Native.chooseCandidate(revision, candidate.id, this.token);
      });
    }
    /** Fresh composition: the filter tab returns to 词频 (word freq). */
    resetExpandTab() {
      this.expandTab = "freq";
      document.querySelectorAll("[data-expand-tab]").forEach((el) => el.classList.toggle("active", el.dataset.expandTab === "freq"));
    }
    renderExpanded() {
      const strip = document.getElementById("expandGrid");
      document.getElementById("expandPreedit").textContent = this.mode === "t9" ? this.t9Reading() || this.t9PreeditLabel(this.lastRawInput) : this.lastRawInput || "";
      strip.replaceChildren();
      this.expandRendered = 0;
      this.renderVariants();
      this.appendExpandedCandidates();
    }
    /** Parse variants (double pinyin): every way to read the raw
     * keys as exact syllables or first-key abbreviations. The first entry
     * is the raw input itself; a single-key first segment expands into
     * every syllable that starts with it (xi'an, xy'an, xr'an ...), and
     * longer inputs offer syllable-boundary prefixes (vf, vf'x ...) whose
     * trailing segment the engine completes via its abbreviations. */
    expandVariantsFor(rawInput) {
      const raw = (rawInput || "").replace(/ /g, "");
      if (this.mode === "pinyin") {
        const input = (rawInput || "").replace(/’/g, "'").toLowerCase().trim();
        if (!input || input.length > 64 || !/^[a-z' \t]+$/.test(input)) return [];
        const segments2 = input.split(/[' \t]+/).filter(Boolean);
        if (segments2.length < 2) return [];
        const incomplete = [];
        for (let index2 = 0; index2 < segments2.length; index2++) {
          const segment = segments2[index2];
          if (FULL_PINYIN_SYLLABLES.includes(segment)) continue;
          if (!FULL_PINYIN_SYLLABLES.some((value) => value.startsWith(segment))) return [];
          incomplete.push(index2);
        }
        if (incomplete.length !== 1) return [];
        const index = incomplete[0];
        return FULL_PINYIN_SYLLABLES.filter((value) => value.startsWith(segments2[index])).map((value) => segments2.map((segment, at) => at === index ? value : segment).join("'"));
      }
      if (!raw || this.mode !== "double-pinyin") return [];
      const variants = [];
      const seen = /* @__PURE__ */ new Set([raw]);
      const push = /* @__PURE__ */ __name((keys) => {
        if (!seen.has(keys)) {
          seen.add(keys);
          variants.push(keys);
        }
      }, "push");
      const segments = raw.split("'");
      const first = segments[0];
      if (first.length === 1 && segments.length > 1) {
        const finals = dpFinals()[first[0]] || "";
        for (const final of finals) {
          const keys = first + final + "'" + segments.slice(1).join("'");
          push(keys);
        }
      }
      if (segments.some((seg) => seg.length === 1)) {
        const joined = raw.replace(/'/g, "");
        for (let cut = 2; cut <= joined.length - 2; cut += 2) {
          push(joined.slice(0, cut));
        }
      }
      return variants;
    }
    renderVariants() {
      const column = document.getElementById("expandVariants");
      column.replaceChildren();
      if (this.mode === "t9") {
        const seg = this.t9PendingSegment();
        if (!seg) {
          column.hidden = true;
          return;
        }
        column.hidden = false;
        const makeSyllable = /* @__PURE__ */ __name((syllable, disabled) => {
          const button = document.createElement("button");
          button.className = "expand-variant";
          button.textContent = syllable;
          if (disabled) button.disabled = true;
          else button.addEventListener("click", () => this.t9PickSyllable(syllable, seg));
          column.append(button);
        }, "makeSyllable");
        const { full, pre } = this.t9SegmentSyllables(seg);
        full.forEach((s) => makeSyllable(s, false));
        pre.forEach((p) => makeSyllable(p, true));
        return;
      }
      const raw = this.mode === "pinyin" ? (this.lastRawInput || "").trim().replace(/ +/g, "'") : (this.lastRawInput || "").replace(/ /g, "");
      if (!this.variantAnchor) this.variantAnchor = raw;
      const anchor = this.variantAnchor;
      const variants = this.expandVariantsFor(anchor);
      column.hidden = variants.length === 0 && !(this.mode === "pinyin" && anchor);
      const makeButton = /* @__PURE__ */ __name((keys) => {
        const button = document.createElement("button");
        button.className = "expand-variant" + (keys === raw ? " current" : "");
        button.textContent = keys;
        button.addEventListener("click", () => this.switchToVariant(keys));
        column.append(button);
      }, "makeButton");
      if (!column.hidden) {
        makeButton(anchor);
        variants.forEach(makeButton);
      }
    }
    /** Switch to a parse variant IN PLACE: the variant highlights at once
     * and the right-hand grid swaps to that parse's candidates. The
     * rewind+retype happens inside one native call, so there is no
     * visible delete-and-retype and the layer never collapses. The grid
     * keeps the previous parse's candidates until the target echo lands
     * (variantReplaying suppresses intermediate re-renders). */
    switchToVariant(keys) {
      if (this.variantReplaying) return;
      clearTimeout(this.variantReplayTimer);
      this.variantReplaying = true;
      this.variantWasExpanded = this.expanded;
      this.variantTarget = keys;
      if (this.mode !== "t9") {
        document.querySelectorAll("#expandVariants .expand-variant").forEach((el) => {
          el.classList.toggle("current", el.textContent === keys);
        });
      }
      document.getElementById("expandGrid").classList.add("reloading");
      document.getElementById("expandPreedit").textContent = keys;
      if (typeof Native.setComposition === "function") {
        this.call(() => Native.setComposition(keys, this.token));
      } else {
        const previous = (this.lastRawInput || "").replace(/ /g, "");
        const replay = [];
        for (let i = 0; i < previous.length; i++) replay.push("<backspace>");
        for (const ch of keys) replay.push(ch);
        const step = /* @__PURE__ */ __name(() => {
          if (!replay.length) return;
          const next = replay.shift();
          if (next === "<backspace>") {
            this.call(() => Native.backspace(this.token));
          } else {
            this.call(() => Native.key(next, this.token));
          }
          setTimeout(step, 45);
        }, "step");
        step();
      }
      this.variantReplayTimer = setTimeout(() => {
        if (this.variantReplaying) this.finishVariantReplay();
      }, 1500);
    }
    /** Lift the replay guard once the target composition's echo has
     * landed (safety valve: 1500ms without it), then refresh the grid
     * on the chosen parse. The refresh must NOT go through the
     * expandKey reset - that path clears the variant anchor and would
     * shrink the list to the new parse's own expansions. */
    finishVariantReplay() {
      clearTimeout(this.variantReplayTimer);
      this.variantReplayTimer = null;
      this.variantReplaying = false;
      this.variantTarget = null;
      document.getElementById("expandGrid").classList.remove("reloading");
      if (!this.expanded && this.variantWasExpanded) {
        this.setExpanded(true);
        return;
      }
      const state = this.lastEngineState || {};
      const rawEcho = state.rawInput || state.composing || "";
      if (rawEcho) this.lastRawInput = rawEcho;
      this.expandKey = rawEcho;
      this.expandCandidates = [];
      this.accumulateCandidates(state);
      this.renderExpanded();
      this.renderCandidates(state);
    }
    /** Incremental strip append (P1-2): replacing the whole strip would
     * collapse scrollWidth and clamp scrollLeft back to 0 on every page
     * fetch - the endless drag would snap to the left each time. The
     * filter tab re-renders fully (renderExpanded); appends stay
     * incremental for the same tab. */
    appendExpandedCandidates() {
      const strip = document.getElementById("expandGrid");
      const ordered = this.englishOrderedPool(this.expandCandidates || []);
      const visible = ordered.filter((candidate) => this.expandTab !== "single" || [...candidate.text].length === 1);
      visible.forEach((candidate, index) => {
        if (index < this.expandRendered) return;
        const button = document.createElement("button");
        button.className = index === 0 ? "expand-candidate first" : "expand-candidate";
        button.textContent = candidate.text;
        let longPressed = false;
        button.addEventListener("click", () => {
          if (longPressed) {
            longPressed = false;
            return;
          }
          this.choosePoolCandidate(candidate);
        });
        this.bindCandidateLongPress(button, candidate, () => {
          longPressed = true;
        });
        button.addEventListener("mousedown", (event) => event.preventDefault());
        strip.append(button);
        this.expandRendered += 1;
      });
      if (!visible.length) {
        if (!strip.querySelector(".expand-empty")) {
          const empty = document.createElement("div");
          empty.className = "expand-empty";
          empty.textContent = this.expandTab === "single" ? t("\u6682\u65E0\u5355\u5B57") : t("\u6682\u65E0\u5019\u9009");
          strip.append(empty);
        }
      } else {
        const empty = strip.querySelector(".expand-empty");
        if (empty) empty.remove();
      }
    }
    /** Fetch the next page when the visible candidate surface is scrolled
     * near its end (or too short to scroll at all). The bar
     * (horizontal) joins the expanded grid (vertical) - whichever is on
     * screen drives the shared native cursor. */
    maybeLoadMoreCandidates() {
      if (!this.expandHasNext || this.loadingMore) return;
      if (this.mode === "stroke" && this.composing && !this.readOnlyPaging) return;
      const strip = document.getElementById("expandGrid");
      const bar = document.getElementById("candidates");
      let nearEnd = false;
      let tooShort = false;
      if (this.expanded) {
        if (!strip.children.length) return;
        const top = strip.scrollTop || 0;
        const height = strip.clientHeight || 0;
        const total = strip.scrollHeight || 0;
        nearEnd = top + height >= total - 120;
        tooShort = total <= height;
      } else {
        const left = bar.scrollLeft || 0;
        const width = bar.clientWidth || 0;
        const total = bar.scrollWidth || 0;
        if (!total) return;
        nearEnd = left + width >= total - 120;
        tooShort = total <= width;
      }
      if (!nearEnd && !tooShort) return;
      this.loadingMore = true;
      this.call((revision) => Native.pageNext(revision, this.token));
      setTimeout(() => {
        this.loadingMore = false;
      }, 900);
    }
    /** #29 英文词候选位置（用户验收三轮）：auto=-1（引擎有中文候选
     *  第 3、没有则自然第 1），或固定 1/3/5。渲染层重排——rime 侧
     *  stabledb 词条权重不参与与主词典的组间排序（实测 0/1/-99 同位），
     *  位置控制只能在这层做；空格确认与点击都按重排后的池头（空格
     *  本来就走 choosePoolCandidate 解耦分页，共用同一视图即一致）。
     *  auto 的冲突判定用统一规则「池里有没有中文候选」——不看键序
     *  能否切成全拼音节（双拼 ui=shi 在全拼音节表下误判无冲突，
     *  英文占了第一位；各双拼方案映射不同，音节表预判永远追不平，
     *  引擎真值天然适配全拼/双拼/模糊音/自造词）。 */
    englishOrderedPool(pool) {
      const ranks = this.symbolRanks || {};
      const pinOf = /* @__PURE__ */ __name((item) => {
        const rank = Number(ranks[item && item.text]);
        return Number.isInteger(rank) && rank >= 1 && rank <= 9 && isSymbolicText(item && item.text) ? rank : 0;
      }, "pinOf");
      const pinned = [];
      const plain = [];
      (Array.isArray(pool) ? pool : []).forEach((item) => (pinOf(item) ? pinned : plain).push(item));
      const merged = this.englishOrderedPoolInner(plain);
      if (!pinned.length) return merged;
      pinned.slice().sort((a, b) => pinOf(a) - pinOf(b)).forEach((item) => {
        const at = Math.min(pinOf(item) - 1, merged.length);
        merged.splice(at, 0, item);
      });
      return merged;
    }
    englishOrderedPoolInner(pool) {
      const pos = Number(this.englishPos);
      if (!Array.isArray(pool) || !pool.length || pos === 0) return pool;
      if (!["pinyin", "double-pinyin", "t9", "stroke"].includes(this.mode)) return pool;
      const isEnglish = /* @__PURE__ */ __name((t2) => typeof t2 === "string" && t2.length >= 2 && t2.length <= 20 && /^[A-Za-z][A-Za-z0-9]*$/.test(t2), "isEnglish");
      const english = [];
      const rest = [];
      pool.forEach((item) => {
        (isEnglish(item && item.text) ? english : rest).push(item);
      });
      if (!english.length || !rest.length) return pool;
      const target = pos > 0 ? pos : 3;
      const out = rest.slice();
      english.forEach((item, i) => {
        const at = Math.min(out.length, Math.max(0, target - 1 + i));
        out.splice(at, 0, item);
      });
      return out;
    }
    renderCandidates(state) {
      if (this.variantReplaying) return;
      if (this.mode === "handwriting") {
        const inkBar = document.getElementById("candidates");
        const inkHeld = inkBar.scrollLeft || 0;
        inkBar.replaceChildren();
        const ink = this.inkCandidates || [];
        const source = ink.length ? ink : (this.assocWords || []).map((word) => ({
          id: `assoc:${word}`,
          text: word,
          assoc: true
        }));
        source.forEach((candidate, index) => {
          const button = document.createElement("button");
          button.className = candidate.assoc ? "candidate assoc" : index === 0 ? "candidate first" : "candidate";
          button.textContent = candidate.text;
          button.addEventListener("click", () => candidate.assoc ? this.commitAssocWord(candidate.text) : this.commitInkCandidate(candidate));
          button.addEventListener("mousedown", (event) => event.preventDefault());
          inkBar.append(button);
        });
        inkBar.scrollLeft = inkHeld;
        this.applyInkBarChrome();
        return;
      }
      if (this.t9SymBar) {
        if (state.composing || this.mode !== "t9" && this.mode !== "stroke" || (this.expandCandidates || []).length || this.assocWords.length) {
          this.t9RestoreBarChrome(state.composing);
        } else {
          this.renderT9SymbolBar();
          return;
        }
      }
      if (!state.composing && this.voiceState === "idle") {
        this.setToolbarYield(this.assocWords.length > 0);
      }
      const bar = document.getElementById("candidates");
      const held = bar.scrollLeft || 0;
      const ordered = this.englishOrderedPool(this.expandCandidates || []);
      const labels = ordered.map((candidate) => this.mode === "french" && this.caseMode && state.composing ? this.caseifyText(candidate.text) : candidate.text);
      const existing = Array.from(bar.children);
      const appendOnly = existing.length <= ordered.length && existing.every((button, i) => button._poolCandidate === ordered[i] && button.textContent === labels[i]);
      if (!appendOnly) bar.replaceChildren();
      if (!(this.expandCandidates || []).length && this.assocWords.length && !state.composing) {
        this.assocWords.forEach((word) => {
          const button = document.createElement("button");
          button.className = "candidate assoc";
          button.textContent = word;
          button.addEventListener("click", () => this.commitAssocWord(word));
          button.addEventListener("mousedown", (event) => event.preventDefault());
          bar.append(button);
        });
        bar.scrollLeft = held;
        return;
      }
      ordered.forEach((candidate, index) => {
        if (appendOnly && index < existing.length) return;
        const button = document.createElement("button");
        button.className = index === 0 ? "candidate first" : "candidate";
        button.textContent = labels[index];
        button._poolCandidate = candidate;
        let longPressed = false;
        button.addEventListener("click", () => {
          if (longPressed) {
            longPressed = false;
            return;
          }
          this.choosePoolCandidate(candidate);
        });
        this.bindCandidateLongPress(button, candidate, () => {
          longPressed = true;
        });
        button.addEventListener("mousedown", (event) => event.preventDefault());
        bar.append(button);
      });
      bar.scrollLeft = held;
      if (!this.expanded) this.maybeLoadMoreCandidates();
    }
    /** M4 composing chrome: preedit line, toolbar swap, enter label. */
    updateComposing(state, rawInput) {
      if (this.variantReplaying) return;
      const wasComposing = this.composing;
      this.composing = !!state.composing;
      if (wasComposing && !this.composing && this.caseMode) {
        this.caseMode = null;
        this.updateCaseKeyVisual();
      }
      if (this.composing && rawInput !== void 0) this.lastRawInput = rawInput;
      if (this.pendingPunct) {
        const pending = this.pendingPunct;
        const staleGen = pending.gen !== void 0 && pending.gen !== this.hwGen;
        const rawChanged = pending.raw !== void 0 && pending.raw !== this.lastRawInput;
        const stale = Date.now() - pending.at > 3e3;
        if (!this.composing && !staleGen) {
          this.pendingPunct = null;
          if (pending.gen !== void 0 && typeof Native.hwCommit === "function") {
            this.call(() => Native.hwCommit(pending.text, pending.gen, this.token));
          } else {
            this.sendSymbol(pending.text);
          }
        } else if (rawChanged || stale || staleGen) {
          this.pendingPunct = null;
        }
      }
      this.wildcardInFlight = false;
      document.body.classList.toggle("composing", this.composing);
      const preedit = document.getElementById("preeditLine");
      preedit.textContent = this.composing ? this.mode === "t9" ? this.t9Reading() || this.t9PreeditLabel(this.lastRawInput) : this.lastRawInput : "";
      if (!this.composing) {
        this.t9ConfirmedLen = 0;
        this._t9ConfirmedText = "";
      } else if (this.mode === "t9" && this.t9ConfirmedLen) {
        const raw = (this.lastRawInput || "").replace(/ /g, "");
        if (!raw.startsWith(this._t9ConfirmedText || "")) {
          this.t9ConfirmedLen = 0;
          this._t9ConfirmedText = "";
        }
      }
      const recording = ["listening", "loading", "stopping"].includes(this.voiceState);
      document.getElementById("setupButton").hidden = this.composing;
      const clipboardButtonEl = document.getElementById("clipboardButton");
      if (clipboardButtonEl) clipboardButtonEl.hidden = this.composing;
      const favoritesButtonEl = document.getElementById("favoritesButton");
      if (favoritesButtonEl) favoritesButtonEl.hidden = this.composing;
      const ctrlToolEl = document.getElementById("ctrlTool");
      if (ctrlToolEl) ctrlToolEl.hidden = this.composing;
      const imeSwitchButtonEl = document.getElementById("imeSwitchButton");
      if (imeSwitchButtonEl) imeSwitchButtonEl.hidden = this.composing;
      Object.values(TOOL_CATALOG).forEach((dom) => {
        if (dom === "mic") return;
        const el = document.getElementById(dom);
        if (el) el.hidden = this.composing || this._overflowTools && this._overflowTools.has(dom);
      });
      if (this.composing && this.ctrlView) this.suspendCtrlView();
      else if (!this.composing) this.maybeResumeCtrlView();
      if (this.composing && !this.settingsInputFocus) this.closeSettingsPanel();
      const voiceBusy = recording;
      document.getElementById("composeClear").hidden = !this.composing && !(this.mode === "handwriting" && !!this.inkBarActive) || voiceBusy;
      if ((this.mode === "t9" || this.mode === "stroke") && this.t9BarChrome && !this.composing && !voiceBusy) {
        this.setToolbarYield(true);
      } else if ((this.assocWords || []).length && !voiceBusy) {
        this.setToolbarYield(true);
      }
      document.getElementById("composeExpand").hidden = !this.composing || voiceBusy;
      if (!this.composing && this.expanded && !this.variantReplaying) this.setExpanded(false);
      const mic = document.getElementById("mic");
      if (mic) mic.hidden = this.composing && !recording;
      if (this.mode === "handwriting") this.applyInkBarChrome();
      document.getElementById("hide").hidden = this.composing || this.mode === "handwriting" && !!this.inkBarActive;
      if (this.composing && !wasComposing && !this.settingsInputFocus) {
        if (this.panelOpen) this.closePanel();
        this.closeModeMenu();
      }
      this.updateEnterLabel();
      this.renderT9Side();
    }
    /* ===== clipboard / favorites panel ===== */
    /** Tear the shared editor strip down completely: hide it, drop the
     * editing key-height override, release the native redirect and clear
     * every routing flag (review finding - leaving any of these
     * dangling strands the UI in half-torn-down states). */
    clearEditorStrip() {
      const card = document.getElementById("phraseCard");
      if (card.classList.contains("open")) {
        card.classList.remove("open");
        card.hidden = true;
        document.body.classList.remove("editing");
        if (this.settingsInputFocus) this.setPanelInput(false);
        this.panelEditItem = null;
      }
      const editor = document.getElementById("panelEditor");
      if (!editor.hidden) {
        editor.hidden = true;
        document.body.classList.remove("editing");
        if (this.settingsInputFocus) this.setPanelInput(false);
        this.panelEditItem = null;
      }
      this.customEditRow = null;
      this.editorReturn = null;
      this.editorMode = null;
      this.hwNotifyPanelHeight();
    }
    openPanel(tab) {
      if (!this.ready) return;
      const want = ["favorites", "kaomoji"].includes(tab) ? tab : "clipboard";
      this.panelTab = want;
      this.panelOpen = true;
      this.hwNotifyPanelHeight();
      this.armPanelClear(false);
      this.panelReturnLayer = this.keyLayer === "letters" ? this.keyLayer : "letters";
      this.closeModeMenu();
      if (this.ctrlView) this.suspendCtrlView();
      this.closeSettingsPanel();
      if (!this.phraseCardOpen()) this.clearEditorStrip();
      this.closeItemMenu();
      this.closeOtherViews("panel");
      document.getElementById("candidateBar").hidden = true;
      this.hideKeyLayers();
      document.getElementById("panelLayer").hidden = false;
      const kaomojiForm = this.panelTab === "kaomoji";
      document.querySelector(".panel-tabs").hidden = kaomojiForm;
      document.getElementById("kaomojiTabs").hidden = !kaomojiForm;
      const kaomojiAttr = document.getElementById("panelLayer").dataset;
      if (kaomojiForm) kaomojiAttr.kaomoji = "";
      else delete kaomojiAttr.kaomoji;
      document.querySelectorAll("[data-panel-tab]").forEach((button) => {
        button.classList.toggle("active", button.dataset.panelTab === this.panelTab);
      });
      document.getElementById("panelClear").hidden = this.panelTab !== "clipboard";
      document.getElementById("panelManage").hidden = this.panelTab !== "favorites";
      this.renderPanel();
      if (this.panelTab === "clipboard") Native.getClipboard(this.token);
      else if (this.panelTab === "favorites") Native.getFavorites(this.token);
    }
    renderKaomoji() {
      const list = document.getElementById("panelList");
      const empty = document.getElementById("panelEmpty");
      list.replaceChildren();
      empty.hidden = true;
      delete document.getElementById("panelLayer").dataset.empty;
      const chips = document.getElementById("kaomojiTabs");
      chips.replaceChildren();
      KAOMOJI_TABS.forEach((cat) => {
        const chip = document.createElement("button");
        chip.className = "kaomoji-chip";
        chip.classList.toggle("active", cat.id === this.kaomojiTab);
        chip.textContent = t(cat.name);
        chip.setAttribute("data-i18n", cat.name);
        chip.addEventListener("click", () => {
          this.kaomojiTab = cat.id;
          this.renderKaomoji();
        });
        chips.append(chip);
      });
      const grid = document.createElement("div");
      grid.className = "kaomoji-grid";
      (KAOMOJI_TABS.find((c) => c.id === this.kaomojiTab) || KAOMOJI_TABS[0]).items.forEach((text) => {
        const cell = document.createElement("button");
        cell.className = "kaomoji-cell";
        cell.textContent = text;
        cell.addEventListener("click", () => {
          if (this.phraseCardOpen()) {
            this.fillPhraseCardFromPanel(text);
            return;
          }
          this.call(() => Native.commitText(text, this.token));
          this.closePanel();
        });
        grid.append(cell);
      });
      list.append(grid);
    }
    closePanel() {
      this.armPanelClear(false);
      if (this.settingsInputFocus && !this.phraseCardOpen()) this.setPanelInput(false);
      this.panelOpen = false;
      this.hwNotifyPanelHeight();
      document.getElementById("panelLayer").hidden = true;
      document.getElementById("candidateBar").hidden = false;
      this.auditToolbarTools();
      this.showKeyLayer(this.panelReturnLayer || "letters");
      this.maybeResumeCtrlView();
    }
    /** 面板头「清空」的两击确认态（#39）：on=红字「确认清空」并起
     * 3s 定时，超时自动撤；off=恢复文案与样式。WebView 无原生
     * confirm（WebChromeClient 未挂 onJsConfirm），确认只能自建。 */
    armPanelClear(on) {
      const btn = document.getElementById("panelClear");
      clearTimeout(this.panelClearTimer);
      this.panelClearTimer = null;
      if (on) {
        this.panelClearTimer = setTimeout(() => this.armPanelClear(false), 3e3);
        btn.classList.add("danger");
        btn.textContent = t("\u786E\u8BA4\u6E05\u7A7A");
      } else {
        btn.classList.remove("danger");
        btn.textContent = t("\u6E05\u7A7A");
      }
    }
    renderPanel() {
      const list = document.getElementById("panelList");
      if (this.panelTab === "kaomoji") {
        this.renderKaomoji();
        return;
      }
      const empty = document.getElementById("panelEmpty");
      list.replaceChildren();
      const layer = document.getElementById("panelLayer");
      const items = this.panelTab === "clipboard" ? this.clipboardItems : this.favoriteItems;
      empty.hidden = items.length > 0;
      if (items.length) delete layer.dataset.empty;
      else layer.dataset.empty = "1";
      if (!items.length) {
        empty.textContent = this.panelTab === "clipboard" ? t("\u526A\u8D34\u677F\u5DF2\u5F00\u542F\uFF0C\u590D\u5236\u7684\u5185\u5BB9\u5C06\u5728\u8FD9\u91CC\u663E\u793A") : t("\u6682\u65E0\u5E38\u7528\u8BED\uFF0C\u70B9\u53F3\u4E0A\u89D2\u300C\uFF0B\u6DFB\u52A0\u300D");
        return;
      }
      items.forEach((item) => {
        const row = document.createElement(this.panelTab === "favorites" ? "div" : "button");
        row.className = "panel-item";
        row.dataset.itemId = item.id;
        const tooLong = [...item.text].length > MAX_COMMIT_CODE_POINTS;
        if (tooLong) row.classList.add("disabled");
        const commit = /* @__PURE__ */ __name(() => {
          if (tooLong) return;
          if (this.phraseCardOpen()) {
            this.fillPhraseCardFromPanel(item.text);
            return;
          }
          this.call(() => {
            if (typeof Native.pasteText !== "function") {
              Native.commitText(item.text, this.token);
            } else {
              Native.pasteText(item.text, this.token);
            }
          });
          this.closePanel();
        }, "commit");
        if (this.panelTab === "clipboard") {
          const preview2 = document.createElement("span");
          preview2.className = "panel-text";
          preview2.textContent = tooLong ? Array.from(item.text).slice(0, 400).join("") + t("\u2026\uFF08\u5185\u5BB9\u8FC7\u957F\uFF09") : item.text;
          const remove = document.createElement("span");
          remove.className = "panel-remove";
          remove.textContent = "\xD7";
          remove.setAttribute("aria-label", t("\u5220\u9664"));
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            this.call(() => Native.removeClipboard(item.id, this.token));
          });
          row.append(preview2, remove);
          row.addEventListener("click", commit);
          list.append(row);
          return;
        }
        const handle = document.createElement("span");
        handle.className = "pair-drag";
        handle.textContent = "\u2261";
        const preview = document.createElement("span");
        preview.className = "panel-text";
        preview.textContent = item.text;
        let longPressed = false;
        preview.addEventListener("click", () => {
          if (longPressed) {
            longPressed = false;
            return;
          }
          commit();
        });
        this.bindItemLongPress(preview, () => {
          longPressed = true;
        });
        const more = document.createElement("button");
        more.className = "panel-more";
        more.textContent = "\u22EF";
        more.setAttribute("aria-label", t("\u66F4\u591A\u64CD\u4F5C"));
        more.addEventListener("click", () => this.openItemMenu(item, more));
        row.append(handle, preview, more);
        this.bindListDrag(row, list, ".panel-item", "itemId", (order) => {
          order.forEach((id, index) => {
            var _a;
            if (((_a = (this.favoriteItems || [])[index]) == null ? void 0 : _a.id) !== id) {
              this.call(() => Native.favoritesMove(id, index, this.token));
            }
          });
        });
        list.append(row);
      });
    }
    /** Focus tracking for panel inputs, shared with the
     * native redirect - while active, editor writes come back through
     * onPanelCommit/onPanelDelete instead of the host editor. */
    setPanelInput(active) {
      const changed = this.settingsInputFocus !== active;
      this.settingsInputFocus = active;
      if (changed) {
        this.panelSession = (this.panelSession || 0) + 1;
        this.panelSpans = /* @__PURE__ */ new Map();
        if (this.panelSelections) {
          for (const field of this.panelSelections.keys()) {
            field.__imeDeleteSnapshot = null;
          }
        }
        this.panelSelections = /* @__PURE__ */ new Map();
        this.panelTargets = /* @__PURE__ */ new Map();
        this.panelTarget = null;
        this.panelSavePending = false;
      }
      if (changed) this.call(() => Native.panelInput(active, this.token));
      if (active) this.reportPanelSelection();
    }
    panelInputField() {
      const el = document.activeElement;
      if (el && el.classList && el.classList.contains("phrase-input")) return el;
      return this.settingsInputFocus ? this.panelTarget || null : null;
    }
    rememberPanelSelection(field) {
      var _a, _b;
      if (!this.panelSelections) this.panelSelections = /* @__PURE__ */ new Map();
      this.panelSelections.set(field, {
        value: field.value,
        start: (_a = field.selectionStart) != null ? _a : field.value.length,
        end: (_b = field.selectionEnd) != null ? _b : field.value.length
      });
    }
    reportPanelSelection() {
      var _a, _b;
      if (!this.settingsInputFocus) return;
      const field = this.panelInputField();
      if (!field) return;
      const changed = this.panelTarget !== field;
      if (changed) {
        this.panelSession = (this.panelSession || 0) + 1;
        this.panelTarget = field;
        this.panelTargets.set(this.panelSession, field);
      }
      const previous = this.panelSelections && this.panelSelections.get(field);
      const start = (_a = field.selectionStart) != null ? _a : field.value.length;
      const end = (_b = field.selectionEnd) != null ? _b : start;
      if (!changed && previous && previous.value === field.value && previous.start === start && previous.end === end) return;
      this.panelSavePending = false;
      if (!changed) {
        for (const [session, target] of this.panelTargets) {
          if (target === field) this.panelTargets.delete(session);
        }
        this.panelSession = (this.panelSession || 0) + 1;
        this.panelTargets.set(this.panelSession, field);
      }
      if (this.panelSpans) this.panelSpans.delete(field);
      this.rememberPanelSelection(field);
      this.call(() => Native.panelSelection(start, end, this.panelSession || 0, this.token));
    }
    panelPayloadCurrent(payload) {
      return this.settingsInputFocus && (!payload || payload.session == null || this.panelTargets && this.panelTargets.has(payload.session));
    }
    panelPayloadField(payload) {
      if (!this.panelPayloadCurrent(payload)) return null;
      return payload && payload.session != null ? this.panelTargets.get(payload.session) : this.panelInputField();
    }
    replacePanelRange(field, start, end, text) {
      field.__imeDeleteSnapshot = null;
      field.value = field.value.slice(0, start) + text + field.value.slice(end);
      const caret = start + text.length;
      try {
        field.setSelectionRange(caret, caret);
      } catch (_) {
      }
      this.rememberPanelSelection(field);
    }
    insertIntoPanelInput(text, field = this.panelInputField()) {
      var _a, _b;
      if (!field) return;
      const span = this.panelSpans && this.panelSpans.get(field);
      const start = span && span.field === field ? span.start : (_a = field.selectionStart) != null ? _a : field.value.length;
      const end = span && span.field === field ? span.end : (_b = field.selectionEnd) != null ? _b : start;
      this.replacePanelRange(field, start, end, text);
      if (this.panelSpans) this.panelSpans.delete(field);
    }
    deleteFromPanelInput(count, field = this.panelInputField()) {
      var _a, _b;
      if (!field) return;
      if (this.panelSpans) this.panelSpans.delete(field);
      for (let i = 0; i < count; i++) {
        let start = (_a = field.selectionStart) != null ? _a : field.value.length;
        const end = (_b = field.selectionEnd) != null ? _b : start;
        if (start === end) {
          if (start === 0) return;
          const prefix = Array.from(field.value.slice(0, start));
          start -= prefix[prefix.length - 1].length;
        }
        this.replacePanelRange(field, start, end, "");
      }
    }
    onPanelCommit(payload) {
      if (!this.panelPayloadCurrent(payload)) return;
      this.insertIntoPanelInput(String(payload && payload.text || ""), this.panelPayloadField(payload));
    }
    onPanelComposing(payload) {
      var _a, _b;
      if (!this.panelPayloadCurrent(payload)) return;
      const field = this.panelPayloadField(payload);
      if (!field) return;
      const span = this.panelSpans && this.panelSpans.get(field);
      const start = span && span.field === field ? span.start : (_a = field.selectionStart) != null ? _a : field.value.length;
      const end = span && span.field === field ? span.end : (_b = field.selectionEnd) != null ? _b : start;
      const text = String(payload && payload.text || "");
      this.replacePanelRange(field, start, end, text);
      this.panelSpans.set(field, { field, start, end: start + text.length });
    }
    onPanelFinishComposing(payload) {
      const field = this.panelPayloadField(payload);
      if (field && this.panelSpans) this.panelSpans.delete(field);
    }
    onPanelReopen(payload) {
      var _a, _b;
      if (!this.panelPayloadCurrent(payload)) return;
      const field = this.panelPayloadField(payload);
      if (!field) return;
      const word = payload && payload.word;
      const selectionStart = (_a = field.selectionStart) != null ? _a : field.value.length;
      const end = (_b = field.selectionEnd) != null ? _b : selectionStart;
      const start = end - (typeof word === "string" ? word.length : 0) - 1;
      const valid = typeof word === "string" && word.length > 0 && selectionStart === end && start >= 0 && field.value.slice(start, end) === word + " ";
      if (!valid) {
        if (payload && payload.session != null && this.panelTargets) {
          this.panelTargets.delete(payload.session);
        }
        if (field === this.panelTarget) {
          if (this.panelSelections) this.panelSelections.delete(field);
          this.reportPanelSelection();
        }
        return;
      }
      this.replacePanelRange(field, start, end, word);
      this.panelSpans.set(field, { field, start, end: start + word.length });
    }
    onPanelDelete(payload) {
      if (this.panelPayloadCurrent(payload)) this.deleteFromPanelInput(Number(payload && payload.count || 1), this.panelPayloadField(payload));
    }
    /** #85 面板输入的上滑删/下滑恢复：面板文字在键盘页自己的
     *  输入框里，宿主 IC 路径查询不回、DEL 连发逐条 evaluate——
     *  手势由服务直调这里，同步改字段。快照挂在字段上，任何其它
     *  面板写入（replacePanelRange）都会清掉它。 */
    onImeGestureDeleteAll(payload) {
      const field = this.panelPayloadField(payload);
      if (!field) return;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      if (start == null || end == null) return;
      if (start !== end) return;
      if (start === 0) return;
      const snap = field.value.slice(0, start);
      if (this.panelSpans) this.panelSpans.delete(field);
      this.replacePanelRange(field, 0, start, "");
      field.__imeDeleteSnapshot = snap;
    }
    onImeGestureRestore(payload) {
      const field = this.panelPayloadField(payload);
      if (!field || !field.__imeDeleteSnapshot) return;
      if (field.selectionStart !== 0 || field.selectionEnd !== 0) return;
      const snap = field.__imeDeleteSnapshot;
      this.replacePanelRange(field, 0, 0, snap);
    }
    /** The phrase editor is a card floating ABOVE the
     * keyboard view (band area) - the old
     * in-keyboard strip is gone for the favorites flow. Redirect typing
     * still works: the card textarea keeps the .phrase-input class.
     * The custom-JSON editor keeps the legacy strip until it moves to
     * the full settings page (design §15/§6.2). */
    /** The floating phrase card is mid-edit (add or update) - panel
     * items then act as its content picker instead of committing. */
    phraseCardOpen() {
      return document.getElementById("phraseCard").classList.contains("open");
    }
    /** Fill the phrase card's 常用内容 field from a panel item
     * (clipboard history / favorites), then close the panel back to
     * the keyboard - the card stays open for the code/rank steps.
     * Mirrors the retired paste button: 200-char cap with a toast. */
    fillPhraseCardFromPanel(text) {
      const input = document.getElementById("phraseCardInput");
      if (!input) return;
      const value = String(text);
      input.__imeDeleteSnapshot = null;
      input.value = [...value].slice(0, 200).join("");
      this.rememberPanelSelection(input);
      this.reportPanelSelection();
      if ([...value].length > 200) this.showToast(t("\u5DF2\u622A\u65AD\u81F3 200 \u5B57"));
      this.closePanel();
      input.focus();
    }
    openPanelEditor(item) {
      this.panelEditItem = item || null;
      this.customEditRow = null;
      this.editorReturn = null;
      this.closeItemMenu();
      this.editorMode = null;
      const card = document.getElementById("phraseCard");
      const input = document.getElementById("phraseCardInput");
      const code = document.getElementById("phraseCardCode");
      document.getElementById("phraseCardTitle").textContent = item ? t("\u7F16\u8F91\u5E38\u7528\u8BED") : t("\u6DFB\u52A0\u5E38\u7528\u8BED");
      input.value = item ? item.text : "";
      code.value = item && item.code || "";
      input.__imeDeleteSnapshot = null;
      code.__imeDeleteSnapshot = null;
      document.getElementById("phraseCardRankValue").textContent = String(item ? item.rank || 1 : 1);
      document.getElementById("panelLayer").hidden = true;
      document.getElementById("candidateBar").hidden = false;
      this.panelOpen = false;
      this.panelEditorKeyLayer = this.keyLayer;
      this.showKeyLayer("letters");
      document.body.classList.add("editing");
      this.hwNotifyPanelHeight();
      card.hidden = false;
      card.classList.add("open");
      this.placePhraseCard();
      this.syncOverlay();
      input.focus();
      this.setPanelInput(true);
    }
    /** Place the card flush above the keyboard view; when the band is
     * too short (landscape) clamp to the window top and let the modal
     * card ride over the keyboard top rows (see design §0). */
    placePhraseCard() {
      const card = document.getElementById("phraseCard");
      const kb = document.getElementById("softKeyboard").getBoundingClientRect();
      card.style.top = "0px";
      const h = card.offsetHeight;
      const top = Math.max(14, kb.top - h - 6);
      card.style.top = top + "px";
    }
    closePanelEditor() {
      const editor = document.getElementById("panelEditor");
      const input = document.getElementById("panelEditorInput");
      const area = document.getElementById("panelEditorArea");
      const card = document.getElementById("phraseCard");
      card.classList.remove("open");
      card.hidden = true;
      document.getElementById("phraseCardInput").value = "";
      document.getElementById("phraseCardCode").value = "";
      document.getElementById("phraseCardRankValue").textContent = "1";
      input.value = "";
      input.hidden = false;
      area.value = "";
      area.hidden = true;
      this.editorMode = null;
      editor.hidden = true;
      document.body.classList.remove("editing");
      this.hwNotifyPanelHeight();
      if (this.settingsInputFocus) this.setPanelInput(false);
      if (this.editorReturn === "custom") {
        this.editorReturn = null;
        this.customEditRow = null;
        this.toggleSettingsPanel("custom");
        return;
      }
      this.keyLayer = this.panelEditorKeyLayer || this.keyLayer;
      this.panelEditorKeyLayer = null;
      this.openPanel("favorites");
    }
    savePanelEditor() {
      if (this.panelSavePending) return;
      if (!this.settingsInputFocus) return this.finishSavePanelEditor();
      this.panelSavePending = true;
      this.call(() => Native.panelFlush(this.panelSession || 0, this.token));
    }
    onPanelFlushed(payload) {
      if (!this.panelSavePending || !payload || payload.session !== this.panelSession) return;
      this.panelSavePending = false;
      this.finishSavePanelEditor();
    }
    finishSavePanelEditor() {
      if (this.editorMode === "custom-json") {
        this.saveCustomJson(document.getElementById("panelEditorArea").value);
        return;
      }
      const input = document.getElementById("phraseCardInput");
      const codeEl = document.getElementById("phraseCardCode");
      const rank = Math.min(Math.max(
        parseInt(document.getElementById("phraseCardRankValue").textContent, 10) || 1,
        1
      ), 99);
      const text = input.value.trim();
      const code = codeEl.value.trim();
      if (!text) return;
      if (this.panelEditItem) {
        const id = this.panelEditItem.id;
        if (text !== this.panelEditItem.text || code !== (this.panelEditItem.code || "") || rank !== (this.panelEditItem.rank || 1)) {
          this.call(() => Native.favoritesUpdate(id, text, code, rank, this.token));
        }
      } else {
        this.call(() => Native.favoritesAdd(text, code, rank, this.token));
      }
      this.panelEditItem = null;
      this.closePanelEditor();
    }
    /** Pin/edit/delete ride a long-press menu (⋯ tap opens
     * the same one); rows only carry the drag handle, text and ⋯. */
    openItemMenu(item, anchor) {
      const menu = document.getElementById("itemMenu");
      this.closeItemMenu();
      this.itemMenuOpen = item.id;
      const build = /* @__PURE__ */ __name((label, cls, action) => {
        const button = document.createElement("button");
        if (cls) button.className = cls;
        button.textContent = label;
        button.addEventListener("click", () => {
          this.closeItemMenu();
          action();
        });
        menu.append(button);
      }, "build");
      build(t("\u7F6E\u9876"), "", () => this.call(() => Native.favoritesMove(item.id, 0, this.token)));
      build(t("\u7F16\u8F91"), "", () => this.openPanelEditor(item));
      build(t("\u5220\u9664"), "danger", () => this.call(() => Native.removeFavorite(item.id, this.token)));
      menu.classList.add("open");
      const rect = anchor.getBoundingClientRect();
      menu.style.left = Math.max(4, Math.min(
        innerWidth - menu.offsetWidth - 4,
        rect.right - menu.offsetWidth
      )) + "px";
      menu.style.top = Math.max(2, rect.top - menu.offsetHeight - 6) + "px";
      this.syncOverlay();
    }
    closeItemMenu() {
      this.itemMenuOpen = null;
      const menu = document.getElementById("itemMenu");
      menu.classList.remove("open");
      menu.replaceChildren();
      this.syncOverlay();
    }
    /* ===== 长按候选删除自造词 ===== */
    /** Long-press a candidate (bar or expanded grid). The candidates keep
     * native clicks (bindTouch would kill the bar's pan), so this is the
     * passive bindItemLongPress plus the click-suppress flag callback.
     * Only Chinese modes have a librime user lexicon to delete from. */
    bindCandidateLongPress(button, candidate, onLongPress) {
      if (!this.isChineseMode()) return;
      if (/^(fav|dyn|alt):/.test(String(candidate.id))) return;
      this.bindItemLongPress(button, () => {
        onLongPress();
        this.openCandidateMenu(candidate, button);
      });
    }
    /** EVERY candidate is deletable now - the engine seeks to
     * the candidate's page and walks the librime highlight (selector's
     * Down = next candidate) onto it before Shift+Delete. Natives with
     * neither bridge method get no menu at all; head-only natives can
     * only delete the head, so off-head falls back to the upgrade hint. */
    openCandidateMenu(candidate, anchor) {
      if (this.composing === false) return;
      const hasAny = typeof Native.deleteCandidate === "function";
      const hasHeadOnly = typeof Native.deleteHighlightedCandidate === "function";
      if (!hasAny && !hasHeadOnly) return;
      const head = (this.expandCandidates || [])[0];
      const deletable = hasAny || hasHeadOnly && !!head && head.id === candidate.id;
      const menu = document.getElementById("itemMenu");
      this.closeItemMenu();
      this.itemMenuOpen = "candidate";
      const build = /* @__PURE__ */ __name((label, cls, action) => {
        const button = document.createElement("button");
        if (cls) button.className = cls;
        button.textContent = label;
        button.addEventListener("click", () => {
          this.closeItemMenu();
          action();
        });
        menu.append(button);
      }, "build");
      if (deletable) {
        build(t("\u5220\u9664\u81EA\u9020\u8BCD"), "danger", () => this.confirmDeleteCandidate(candidate));
      } else {
        const hint = document.createElement("button");
        hint.disabled = true;
        hint.textContent = t("\u8BE5\u5019\u9009\u9700\u5347\u7EA7 APK \u540E\u5220\u9664");
        menu.append(hint);
      }
      menu.classList.add("open");
      menu.style.left = "0";
      menu.style.top = "0";
      const rect = anchor.getBoundingClientRect();
      const left = Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, rect.left));
      menu.style.left = left + "px";
      menu.style.top = Math.min(innerHeight - menu.offsetHeight - 2, rect.bottom + 6) + "px";
      this.syncOverlay();
    }
    confirmDeleteCandidate(candidate) {
      this.deleteTarget = candidate;
      document.getElementById("confirmText").textContent = t("\u4ECE\u81EA\u9009\u8BCD\u8BCD\u5E93\u5220\u9664\u300C{0}\u300D\uFF1F\uFF08\u56FA\u5B9A\u8BCD\u5E93\u7684\u8BCD\u5220\u4E0D\u6389\uFF09", candidate.text);
      document.getElementById("confirmCard").hidden = false;
    }
    closeConfirmCard() {
      this.deleteTarget = null;
      document.getElementById("confirmCard").hidden = true;
    }
    deleteHighlightedCandidate() {
      const candidate = this.deleteTarget;
      this.closeConfirmCard();
      if (!candidate) return;
      const head = (this.expandCandidates || [])[0];
      const isHead = head && head.id === candidate.id;
      if (typeof Native.deleteCandidate === "function") {
        this.pendingDelete = candidate;
        this.call((revision) => Native.deleteCandidate(revision, candidate.id, this.token));
      } else if (isHead && typeof Native.deleteHighlightedCandidate === "function") {
        this.pendingDelete = candidate;
        this.call(() => Native.deleteHighlightedCandidate(this.token));
      } else {
        return;
      }
      setTimeout(() => {
        this.pendingDelete = null;
      }, 1500);
    }
    /** Long-press on a panel row text (no preventDefault: the list must
     * keep scrolling); a drag past a few px cancels the timer. */
    bindItemLongPress(el, onLongPress) {
      let timer = 0;
      let startX = 0;
      let startY = 0;
      el.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        timer = setTimeout(() => {
          timer = 0;
          onLongPress();
        }, 380);
      }, { passive: true });
      el.addEventListener("touchmove", (event) => {
        if (!timer) return;
        const touch = event.touches[0];
        if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 12) {
          clearTimeout(timer);
          timer = 0;
        }
      }, { passive: true });
      const clear = /* @__PURE__ */ __name(() => {
        if (timer) clearTimeout(timer);
        timer = 0;
      }, "clear");
      el.addEventListener("touchend", clear, { passive: true });
      el.addEventListener("touchcancel", clear, { passive: true });
    }
    onClipboard(payload) {
      this.clipboardItems = (payload.items || []).map((item) => ({
        id: String(item.id),
        text: String(item.text),
        time: Number(item.time) || 0
      }));
      if (this.panelOpen && this.panelTab === "clipboard") this.renderPanel();
    }
    /** 导入备份后原生把 localStorage 级设置推回来（userdata.md §1.4）。
     * 白名单外的键一律忽略；主题当场生效，语言变化重走一次渲染。 */
    onStoresRestored(stores) {
      let localeChanged = false;
      let localeRemoved = false;
      let quickPairRemoved = false;
      try {
        const incoming = stores || {};
        for (const key of STORE_BACKUP_KEYS) {
          if (Object.prototype.hasOwnProperty.call(incoming, key)) continue;
          if (localStorage.getItem(key) === null) continue;
          if (key === "feelime_ui_locale") {
            localeChanged = true;
            localeRemoved = true;
          }
          if (key === "feelime_quick_pair") quickPairRemoved = true;
          localStorage.removeItem(key);
        }
        for (const key of Object.keys(incoming)) {
          if (!STORE_BACKUP_KEYS.includes(key)) continue;
          if (key === "feelime_ui_locale" && incoming[key] !== uiLocale) {
            localeChanged = true;
          }
          localStorage.setItem(key, String(incoming[key]));
        }
      } catch (_) {
      }
      applyTheme(this.themeMode || "auto");
      if (!this.scrubSpeedFromNative) {
        try {
          const speed = parseInt(localStorage.getItem("feelime_scrub_speed") || "3", 10);
          if (speed >= 1 && speed <= 5) this.scrubSpeed = speed;
        } catch (_) {
        }
      }
      if (quickPairRemoved) this.quickPair = ["pinyin", "direct"];
      try {
        const pair = JSON.parse(localStorage.getItem("feelime_quick_pair") || "null");
        if (Array.isArray(pair) && pair.length === 2 && MODES[pair[0]] && MODES[pair[1]]) this.quickPair = pair;
      } catch (_) {
      }
      this.updateToggleLabels();
      if (localeChanged) {
        uiLocale = String((stores || {})["feelime_ui_locale"] || (localeRemoved ? "zh" : uiLocale));
        translateStaticUi();
        this.renderLetters((MODES[this.mode] || MODES.direct).layout);
        this.renderSymbolCats();
      }
      this.updateLabels();
      if (document.getElementById("settingsPanel").classList.contains("open")) {
        this.renderSettingsPanel();
      }
    }
    onFavorites(payload) {
      this.favoriteItems = (payload.items || []).map((item) => ({
        id: String(item.id),
        text: String(item.text),
        time: Number(item.time) || 0,
        code: String(item.code || ""),
        rank: Math.min(Math.max(Number(item.rank) || 1, 1), 99)
      }));
      if (this.composing) {
        this.injectFavoriteCandidates();
        this.renderCandidates(this.lastEngineState || {});
        if (this.expanded) this.renderExpanded();
      }
      if (this.panelOpen && this.panelTab === "favorites") this.renderPanel();
    }
    /* ===== native callbacks ===== */
    onBridgeHello(payload) {
      if (payload.nativeApiVersion < MIN_NATIVE_API) return;
      const provided = payload.capabilities || [];
      if (!REQUIRED_CAPABILITIES.every((cap) => provided.includes(cap))) return;
      this.inkPredecimated = provided.includes("ink-predecimated-v1");
      this.helloSeen = true;
      this.readOnlyPaging = provided.includes("rime-read-only-paging-v1");
      this.nativeCaps = provided;
      const localeChanged = (payload.uiLocale === "zh" || payload.uiLocale === "en") && payload.uiLocale !== uiLocale;
      if (localeChanged) {
        uiLocale = payload.uiLocale;
        try {
          localStorage.setItem("feelime_ui_locale", uiLocale);
        } catch (_) {
        }
        translateStaticUi();
      }
      this.token = payload.pageGenerationToken;
      this.engineReady = payload.engineDataReady || {};
      this.safeBottom = Math.max(0, Number(payload.safeBottom) || 0);
      this.bottomPad = Math.max(0, Number(payload.bottomPad) || 0);
      {
        const cf = Number(payload.candidateFont);
        if (cf >= 80 && cf <= 150) this.candidateFont = cf;
        else if (cf === 0) this.candidateFont = 100;
        else if (cf === 1) this.candidateFont = 120;
        else if (cf === 2) this.candidateFont = 135;
      }
      this.applyCandidateFont();
      {
        const kf = Number(payload.keycapFont);
        if (kf >= 50 && kf <= 150) this.keycapFont = kf;
      }
      this.applyKeycapFont();
      if (typeof payload.userFontDigest === "string") {
        this.applyUserFont(payload.userFontDigest);
      }
      if (Number(payload.preeditFont) in { 0: 1, 1: 1, 2: 1 }) {
        this.preeditFont = Number(payload.preeditFont);
      }
      this.applyPreeditFont();
      if (typeof payload.preeditBold === "boolean") {
        this.preeditBold = payload.preeditBold;
      }
      document.body.dataset.preeditBold = this.preeditBold ? "1" : "0";
      if (Number(payload.oneHand) in { 0: 1, 1: 1, 2: 1 }) {
        this.oneHand = Number(payload.oneHand);
      }
      if (Number(payload.oneHandPad) in { 0: 1, 15: 1, 25: 1, 35: 1 }) {
        this.oneHandPad = Number(payload.oneHandPad);
      }
      if (Number(payload.oneHandSide) in { 1: 1, 2: 1 }) {
        this.oneHandSideMemory = Number(payload.oneHandSide);
      }
      const side = Number(payload.sideContent);
      if (side === 0 || side === 1) this.sideContent = side;
      else if (side === 2) this.sideContent = 1;
      if (typeof payload.bgImageLight === "string") this.bgImageLight = payload.bgImageLight;
      if (typeof payload.bgImageDark === "string") this.bgImageDark = payload.bgImageDark;
      const opacity = Number(payload.keyOpacity);
      if (opacity >= 0 && opacity <= 100) this.keyOpacity = opacity;
      if (typeof payload.landscapeSafeArea === "boolean") {
        this.landscapeSafeArea = payload.landscapeSafeArea;
      }
      this.safeSideL = Math.max(0, Number(payload.safeSideL) || 0);
      this.safeSideR = Math.max(0, Number(payload.safeSideR) || 0);
      const landOpacity = Number(payload.landscapeOpacity);
      if (landOpacity >= 10 && landOpacity <= 100) this.landscapeOpacity = landOpacity;
      if (typeof payload.keyBubble === "boolean") this.keyBubble = payload.keyBubble;
      if (typeof payload.cnEnComposingGuard === "boolean") this.cnEnGuard = payload.cnEnComposingGuard;
      const lingerMs = Number(payload.bubbleLinger);
      if (lingerMs >= 0) this.bubbleLinger = lingerMs;
      this.applyOneHand();
      this.applyBackground();
      this.applyKeyOpacity();
      this.applyLandscapeChrome();
      {
        const preset = typeof payload.themePreset === "string" ? payload.themePreset : "";
        if (THEME_PRESETS.includes(preset) && preset !== "classic") {
          document.documentElement.dataset.preset = preset;
        } else {
          delete document.documentElement.dataset.preset;
        }
      }
      {
        const hue = Number(payload.themeHue);
        if (Number.isFinite(hue) && hue >= 0 && hue <= 360) {
          document.documentElement.style.setProperty("--kb-hue", String(Math.round(hue)));
        } else {
          document.documentElement.style.removeProperty("--kb-hue");
        }
        this.englishPos = [-1, 1, 3, 5].includes(Number(payload.englishPos)) ? Number(payload.englishPos) : -1;
        const kh = Number(payload.keyHue);
        if (Number.isFinite(kh) && kh >= 0 && kh <= 360) {
          document.documentElement.style.setProperty("--key-hue", String(Math.round(kh)));
        } else {
          document.documentElement.style.removeProperty("--key-hue");
        }
        const ks = Number(payload.keySat);
        if (Number.isFinite(ks) && ks >= 0 && ks <= 100) {
          document.documentElement.style.setProperty("--key-sat", String(ks / 100));
        } else {
          document.documentElement.style.removeProperty("--key-sat");
        }
        const sat = Number(payload.themeSat);
        if (Number.isFinite(sat) && sat >= 0 && sat <= 100) {
          document.documentElement.style.setProperty("--kb-sat", String(sat / 100));
        } else {
          document.documentElement.style.removeProperty("--kb-sat");
        }
        const tl = Number(payload.themeL);
        if (Number.isFinite(tl) && tl >= -50 && tl <= 50 && tl !== 0) {
          document.documentElement.style.setProperty("--bg-lt", String(tl / 50));
        } else {
          document.documentElement.style.removeProperty("--bg-lt");
        }
        let kl = Number(payload.keyL);
        if (!Number.isFinite(kl)) kl = 0;
        const keyLt = kl === -1 ? Number.isFinite(tl) ? tl : 0 : kl;
        if (keyLt >= -50 && keyLt <= 50 && keyLt !== 0) {
          document.documentElement.style.setProperty("--key-lt", String(keyLt / 50));
        } else {
          document.documentElement.style.removeProperty("--key-lt");
        }
        this.pushChromeColor();
      }
      const themeMode = payload.themeMode;
      if (themeMode === "auto" || themeMode === "light" || themeMode === "dark") {
        this.qConfirm("themeMode", themeMode);
        try {
          localStorage.removeItem("feelime_theme");
        } catch (_) {
        }
        if (this.quickPending.themeMode === void 0 && themeMode !== this.themeMode) {
          this.themeMode = themeMode;
          applyTheme(themeMode);
        }
      } else {
        let legacy = null;
        try {
          const saved = localStorage.getItem("feelime_theme");
          if (saved === "auto" || saved === "light" || saved === "dark") legacy = saved;
          localStorage.removeItem("feelime_theme");
        } catch (_) {
        }
        if (legacy !== null) {
          this.themeMode = legacy;
          applyTheme(legacy);
          if (typeof Native.setQuickPref === "function" && this.token) {
            Native.setQuickPref("themeMode", legacy, this.token);
          }
        }
      }
      {
        let klv = Number(payload.keyL);
        if (!Number.isFinite(klv)) klv = 0;
        if (klv === -1) klv = Number.isFinite(Number(payload.themeL)) ? Number(payload.themeL) : 0;
        if (document.documentElement.classList.contains("theme-light")) {
          document.documentElement.style.removeProperty("--key-ink");
        } else {
          const cap = 37 + 63 * 0.75 * (klv / 50);
          if (cap > 60) {
            document.documentElement.style.setProperty("--key-ink", "#1a1a1a");
          } else {
            document.documentElement.style.removeProperty("--key-ink");
          }
        }
      }
      if (typeof payload.toolbarLayout === "string" && payload.toolbarLayout) {
        this.applyToolbarLayoutValue(payload.toolbarLayout);
      }
      this.applyToolbarLayout();
      this.associationOn = !!payload.associationOn;
      this.touchDiagnostics = payload.touchDiagnostics === true;
      this.syncDiagnosticProbe();
      if (!this.associationOn) this.assocWords = [];
      this.backspaceAssocOn = !!payload.backspaceAssocOn;
      this.wxSlashOn = !!payload.wxSlashOn;
      this.dynamicDateTimeOn = payload.dynamicDateTimeOn !== false;
      if (payload.uiLanguage === "auto" || payload.uiLanguage === "zh" || payload.uiLanguage === "en") {
        this.uiLanguageChoice = payload.uiLanguage;
      }
      if (typeof payload.keySound === "boolean") this.keySound = payload.keySound;
      if (typeof payload.keyHaptic === "boolean") this.keyHaptic = payload.keyHaptic;
      if (typeof payload.voiceReadyHaptic === "boolean") this.voiceReadyHaptic = payload.voiceReadyHaptic;
      this.qConfirm("association", this.associationOn);
      this.qConfirm("keySound", this.keySound);
      this.qConfirm("keyHaptic", this.keyHaptic);
      this.qConfirm("uiLocale", this.uiLanguageChoice);
      this.qConfirm("candidateFont", this.candidateFont);
      this.qConfirm("preeditFont", this.preeditFont);
      this.qConfirm("oneHand", this.oneHand);
      this.syncToolStates();
      this.auditToolbarTools();
      this.qConfirm("sideContent", this.sideContent);
      this.qConfirm("bottomPad", this.bottomPad);
      this.qConfirm("holdMs", this.holdMs);
      this.qConfirm("popupSnap", this.popupSnap);
      if (Number(payload.holdMs) in { 200: 1, 300: 1, 350: 1, 450: 1, 600: 1 }) {
        this.holdMs = Number(payload.holdMs);
      }
      if (Number(payload.scrubSpeed) >= 1 && Number(payload.scrubSpeed) <= 5) {
        this.scrubSpeed = Number(payload.scrubSpeed);
        this.scrubSpeedFromNative = true;
      }
      if (typeof payload.flickSwap === "boolean") {
        this.flickSwap = payload.flickSwap;
        document.body.classList.toggle("flick-swap", this.flickSwap);
      }
      if (typeof payload.doubleShiftLock === "boolean") {
        this.doubleShiftLock = payload.doubleShiftLock;
      }
      if (Number(payload.popupSnap) in { 0: 1, 1: 1, 2: 1 }) {
        this.popupSnap = Number(payload.popupSnap);
      }
      this.floatBand = Number(payload.floatBand) || 0;
      this.heightDefaultCss = Number(payload.heightDefault) || 272;
      this.nativeStoredHeightCss = Number(payload.storedKbHeight) || 0;
      this.heightFloorCss = Number(payload.heightFloor) || 0;
      this.heightCeilCss = Number(payload.heightCeil) || 0;
      {
        const root = document.documentElement;
        if (root && root.style && typeof root.style.setProperty === "function") {
          root.style.setProperty("--band", this.floatBand + "px");
        }
        try {
          const nativeCustom = Native.customKeys(this.token);
          if (nativeCustom === "disabled") {
            localStorage.removeItem(CUSTOM_KEYS_STORE);
          } else if (nativeCustom) {
            const parsed = this.parseCustomKeys(nativeCustom);
            if (!parsed.error) {
              const prevLang = this.storedLangKeys();
              const langChanged = JSON.stringify(prevLang || null) !== JSON.stringify(parsed.langKeys || null);
              localStorage.setItem(
                CUSTOM_KEYS_STORE,
                JSON.stringify({
                  version: 1,
                  rows: parsed.rows,
                  langKeys: parsed.langKeys || void 0
                })
              );
              if (langChanged) this.rerenderLangKeys();
            }
          } else {
            const local = localStorage.getItem(CUSTOM_KEYS_STORE);
            if (local) {
              const parsed = this.parseCustomKeys(local);
              if (!parsed.error) {
                Native.setCustomKeys(local, this.token);
              }
            }
          }
        } catch (_) {
        }
      }
      if (payload.orientation) {
        this.helloOrientation = payload.orientation;
        this.applyOrientation(payload.orientation === "landscape");
        this._floatOrientKey = this.floatMemoryKey();
        this.applyFloatMemory(true);
      }
      this.applyHeight();
      if (document.getElementById("phraseCard").classList.contains("open")) {
        this.placePhraseCard();
      }
      if (payload.theme === "dark" || payload.theme === "light") {
        systemTheme = payload.theme;
        systemThemeKnown = true;
        try {
          localStorage.setItem("feelime_system_theme", payload.theme);
        } catch (_) {
        }
        applyTheme(this.themeMode || "auto");
      }
      const nextMode = MODES[payload.mode] ? payload.mode : "direct";
      const modeChanged = nextMode !== this.mode;
      this.mode = nextMode;
      this.hardwareKeyboard = !!payload.hardwareKeyboard;
      this.symbolRanks = payload.symbolRanks && typeof payload.symbolRanks === "object" ? payload.symbolRanks : {};
      this.symbolFreqSort = payload.symbolFreqSort === true;
      this.hwkbForm = payload.hwkbForm || "candidates";
      if (payload.quickSwitchPolicy !== void 0) {
        this.quickSwitchPolicy = payload.quickSwitchPolicy;
        this.quickReturnMode = payload.quickReturnMode || "pinyin";
        this.quickPolicyMigrated = true;
      } else if (!this.quickPolicyMigrated) {
        this.quickPolicyMigrated = true;
        this.quickSwitchPolicy = "fixed";
        this.quickPolicyReportPending = true;
      }
      if (payload.hwGen !== void 0) this.hwGen = Number(payload.hwGen) || 0;
      const seqBase = Number(payload.hwSeqBase) || 0;
      if (seqBase > (this.hwSeqCounter || 0)) this.hwSeqCounter = seqBase;
      this.applyHwForm();
      this.adoptQuickPairForHandwriting(nextMode);
      this.ready = true;
      if (modeChanged) this.pendingPunct = null;
      const nextScheme = payload.dpScheme && Object.prototype.hasOwnProperty.call(DP_INITIAL_FINALS, payload.dpScheme) ? payload.dpScheme : "ziranma";
      const schemeChanged = nextScheme !== dpScheme;
      dpScheme = nextScheme;
      this.qConfirm("dpScheme", dpScheme);
      const rawHold = typeof payload.spaceHoldTap === "string" && payload.spaceHoldTap ? payload.spaceHoldTap : payload.voiceOnSpace === false ? "none" : "voice";
      const nextSpaceHold = rawHold === "voice" || rawHold === "none" ? rawHold : rawHold.startsWith("dsl:") ? rawHold.slice(4) : "voice";
      const spaceHoldChanged = nextSpaceHold !== this.spaceHoldTap;
      this.spaceHoldTap = nextSpaceHold;
      const nextSpaceText = typeof payload.spaceHoldText === "string" ? [...payload.spaceHoldText].slice(0, 8).join("") : "";
      const spaceTextChanged = nextSpaceText !== this.spaceHoldText;
      this.spaceHoldText = nextSpaceText;
      const nextKbLayout = payload.kbLayout === "14" ? "14" : "26";
      const kbLayoutChanged = nextKbLayout !== this.kbLayout;
      this.kbLayout = nextKbLayout;
      this.updateHwModeTag();
      if (modeChanged) this.renderMode();
      else if (kbLayoutChanged && MERGEABLE_14.has(this.mode)) {
        this.renderMode();
      } else if (spaceHoldChanged || spaceTextChanged) {
        this.renderMode();
      }
      this.applyEngineLifecycle({ ...payload, snapshot: true });
      if (schemeChanged && this.mode === "double-pinyin") {
        this.renderMode();
      }
      if (localeChanged) {
        this.renderLetters((MODES[this.mode] || MODES.direct).layout);
        this.renderSymbolCats();
        this.updateLabels();
        if (this.keyLayer === "numpad") this.renderNumpad();
        if (document.getElementById("settingsPanel").classList.contains("open")) this.renderSettingsPanel();
        if (this.panelOpen) this.renderPanel();
        if (this.expanded) this.renderExpanded();
        document.getElementById("phraseCardTitle").textContent = t(this.panelEditItem ? "\u7F16\u8F91\u5E38\u7528\u8BED" : "\u6DFB\u52A0\u5E38\u7528\u8BED");
        if (document.getElementById("heightCard").classList.contains("open")) this.renderHeightCard();
      }
      Native.keyboardReady(KEYBOARD_VERSION, MIN_NATIVE_API, JSON.stringify(REQUIRED_CAPABILITIES), this.token);
      if (this.quickPolicyReportPending) {
        this.quickPolicyReportPending = false;
        if (typeof Native.setQuickSwitchPolicy === "function") {
          this.call(() => Native.setQuickSwitchPolicy(this.quickSwitchPolicy, this.token));
        }
      }
      if (typeof Native.reportHwKeys === "function" && this.hwStateSeen) {
        this.hwReported = true;
        this.call(() => Native.reportHwKeys(1, this.token));
      } else if (typeof Native.reportHwKeys === "function") {
        setTimeout(() => {
          if (!this.hwReported) {
            this.hwReported = true;
            this.call(() => Native.reportHwKeys(1, this.token));
          }
        }, 300);
      }
      this.pushChromeColor();
      this.call(() => Native.getFavorites(this.token));
      pullStores(this.token);
      pushStores();
      setTimeout(() => this.applyHeight(), 250);
      setTimeout(() => this.applyHeight(), 900);
    }
    /** Degraded/warming state from engine events AND hello (mode-fallback
     * §2.1): hello restores the persistent badge after a WebView rebuild
     * but never toasts (degradedActive absent); each degrade transition
     * carries a fresh seq so a retry that fails again toasts again. */
    applyEngineLifecycle(payload) {
      if (payload.warming !== void 0 && this.warming !== !!payload.warming) {
        this.warming = !!payload.warming;
        this.warmingSince = this.warming ? Date.now() : 0;
      }
      if (payload.degraded) {
        const seq = Number(payload.degradeSeq) || 0;
        const failedMode = payload.failedMode || "";
        const active = payload.degradedActive !== void 0 ? !!payload.degradedActive : true;
        const previous = this.degrade;
        this.degrade = { failedMode, seq, active };
        if (payload.snapshot) this.seenDegradeSeq = Math.max(this.seenDegradeSeq, seq);
        if (active && this.variantReplaying) {
          clearTimeout(this.variantReplayTimer);
          this.variantReplayTimer = null;
          this.variantReplaying = false;
          this.variantTarget = null;
          const grid = document.getElementById("expandGrid");
          if (grid) grid.classList.remove("reloading");
          if (this.expanded) this.setExpanded(false);
        }
        if (active && !payload.snapshot && seq > this.seenDegradeSeq) {
          this.seenDegradeSeq = seq;
          const modeName = MODES[failedMode] ? t(MODES[failedMode].title) : failedMode;
          this.showToast(
            t("\u300C{0}\u300D\u5F15\u64CE\u542F\u52A8\u5931\u8D25\uFF0C\u6682\u65F6\u82F1\u6587\u76F4\u51FA\uFF1B\u70B9\u6A21\u5F0F\u952E\u91CD\u8BD5").replace("{0}", modeName)
          );
        }
        this.renderDegradeBadge();
      } else if (this.degrade) {
        this.degrade = null;
        this.renderDegradeBadge();
      }
      this.updateEngineStatus();
      {
        const panel = document.getElementById("settingsPanel");
        if (panel && panel.classList.contains("open") && !this.settingsPage) {
          this.renderSettingsPanel();
        }
      }
    }
    renderDegradeBadge() {
      const toggle = document.getElementById("modeToggle");
      if (!toggle) return;
      toggle.classList.toggle("degraded", !!(this.degrade && this.degrade.active));
    }
    /** Warming wins over degraded: while language data is still
     *  preparing (including a user-initiated retry of the failed mode),
     *  that is the actionable state — the degrade text would keep telling
     *  the user to retry a retry already running.
     *  #82 验收：模式切换触发的 warming 是亚秒级闪现，状态条跟着闪
     *  一下没有任何信息量（用户验收吐槽）。延迟 800ms 显示：闪过的不
     *  出现，首装/换基底词库的真编译（持续数秒以上）照常给解释——
     *  那是唯一能说明「键盘为什么没词」的状态。 */
    updateEngineStatus() {
      const el = document.getElementById("engineStatus");
      if (!el) return;
      const degradedActive = !!(this.degrade && this.degrade.active);
      const candidates = document.getElementById("candidates");
      clearTimeout(this.warmingShowTimer);
      this.warmingShowTimer = null;
      const showNow = degradedActive || !!this.warming && Date.now() - (this.warmingSince || 0) >= 800;
      if (candidates) candidates.hidden = showNow;
      if (this.warming) {
        el.textContent = t("\u6B63\u5728\u51C6\u5907\u8BED\u8A00\u6570\u636E\u2026");
        if (showNow) {
          el.hidden = false;
        } else {
          el.hidden = true;
          this.warmingShowTimer = setTimeout(() => {
            if (this.warming) this.updateEngineStatus();
          }, Math.max(0, 800 - (Date.now() - (this.warmingSince || 0))));
        }
      } else if (degradedActive) {
        const modeName = MODES[this.degrade.failedMode] ? t(MODES[this.degrade.failedMode].title) : this.degrade.failedMode;
        el.textContent = t("\u300C{0}\u300D\u6682\u4EE5\u82F1\u6587\u76F4\u51FA\uFF0C\u70B9\u6A21\u5F0F\u952E\u91CD\u8BD5").replace("{0}", modeName);
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    }
    /** 中文联想（docs/design/association.md）：原生在 commit 后/点击后
     * 推送后继词；编辑器切换等场景推空列表清屏。 */
    onAssoc(payload) {
      this.assocWords = Array.isArray(payload && payload.words) ? payload.words.filter((word) => typeof word === "string" && word) : [];
      if (this.variantReplaying) return;
      this.renderCandidates(this.lastEngineState || {});
    }
    /** 联想词点击：原生写入编辑器并推下一轮联想（连续联想）。 */
    commitAssocWord(word) {
      this.assocWords = [];
      this.renderCandidates(this.lastEngineState || {});
      if (typeof Native !== "undefined" && typeof Native.commitAssoc === "function") {
        Native.commitAssoc(word, this.token);
      }
    }
    onEngineState(payload) {
      this.lastRevision = payload.revision || 0;
      this.lastEngineState = payload;
      if (payload.composing && this.assocWords.length) this.assocWords = [];
      if (payload.mode && this.mode && payload.mode !== this.mode && this.assocWords.length) {
        this.assocWords = [];
      }
      if (payload.phase === "LOADING" && !this.warming) {
        this.warming = true;
        this.warmingSince = Date.now();
      }
      if (payload.phase === "READY" && !payload.composing) {
        this.warming = false;
        this.warmingSince = 0;
      }
      if (payload.degraded !== void 0) this.applyEngineLifecycle(payload);
      else if (payload.phase === "LOADING" || payload.phase === "READY" || this.degrade) {
        this.updateEngineStatus();
      }
      if (this.variantReplaying && payload.composing) {
        const echoed = payload.rawInput || payload.composing || "";
        const raw = this.mode === "pinyin" ? echoed.trim().replace(/ +/g, "'") : echoed.replace(/ /g, "");
        if (this.variantTarget && raw === this.variantTarget) this.finishVariantReplay();
      }
      if (!payload.composing) {
        this._autoCollapseKey = null;
        this._deadClearPending = false;
      }
      if (this.variantReplaying) return;
      if (payload.mode && MODES[payload.mode] && payload.mode !== this.mode) {
        this.mode = payload.mode;
        this.applyHwForm();
        this.adoptQuickPairForHandwriting(payload.mode);
        this.renderMode();
        this.updateHwModeTag();
      }
      this.updateComposing(payload, payload.rawInput || payload.composing || "");
      if (payload.composing) {
        const key = payload.rawInput || payload.composing || "";
        if (key && key !== this.expandKey) {
          this.expandKey = key;
          this.expandCandidates = [];
          this.resetExpandTab();
          this.variantAnchor = null;
          if (this.expanded) this.renderExpanded();
        }
        if (this.pendingDelete) {
          const gone = this.pendingDelete;
          this.pendingDelete = null;
          this.expandCandidates = [];
          this.accumulateCandidates(payload);
          if (this.expanded) this.renderExpanded();
          const stillThere = (this.expandCandidates || []).some((c) => c.text === gone.text);
          this.showToast(stillThere ? t("\u300C{0}\u300D\u6765\u81EA\u56FA\u5B9A\u8BCD\u5E93\uFF0C\u65E0\u6CD5\u5220\u9664", gone.text) : t("\u5DF2\u4ECE\u81EA\u9009\u8BCD\u8BCD\u5E93\u5220\u9664\u300C{0}\u300D", gone.text));
        } else {
          this.accumulateCandidates(payload);
        }
      } else if (!this.variantReplaying) {
        this.expandCandidates = [];
        this.expandKey = null;
        this.pendingDelete = null;
        if (!document.getElementById("confirmCard").hidden) this.closeConfirmCard();
      }
      this.renderCandidates(payload);
      if (this.expanded && !this.variantReplaying) {
        if (payload.composing) {
          this.appendExpandedCandidates();
          this.maybeLoadMoreCandidates();
        } else {
          this.setExpanded(false);
        }
      }
      if (this.mode === "pinyin" || this.mode === "double-pinyin") {
        if (payload.composing) {
          const raw = (payload.rawInput || "").replace(/ /g, "");
          const engineCands = payload.candidates || [];
          if (raw && raw !== this._autoCollapseKey) {
            if (raw.length >= 40 && engineCands.length) {
              this._autoCollapseKey = raw;
              this.call((revision) => Native.chooseCandidate(
                revision,
                engineCands[0].id,
                this.token
              ));
            } else if (raw.length >= 16 && !engineCands.length) {
              if (!this._deadClearPending) {
                this._deadClearPending = true;
                this._autoCollapseKey = raw;
                this.call(() => Native.clearComposing(this.token));
                this.showToast(t("\u7EC4\u5408\u8FC7\u957F\uFF0C\u5DF2\u6E05\u7A7A"));
              }
            }
          }
        }
      }
    }
    onVoiceLevel(level) {
      document.querySelector("#levelBar i").style.transform = `scaleX(${Math.max(0, Math.min(1, level || 0))})`;
    }
    onNativeState(payload) {
      const prevVoiceState = this.voiceState;
      this.voiceState = payload.state || "idle";
      if (prevVoiceState === "loading" && this.voiceState === "listening" && this.voiceReadyHaptic) {
        this.call(() => {
          if (typeof Native.voiceReadyHaptic === "function") {
            Native.voiceReadyHaptic(this.token);
          }
        });
      }
      if (this.voiceState === "idle" || this.voiceState === "error") {
        this.voiceSession = null;
      }
      this.hwNotifyPanelHeight();
      const overlay = document.getElementById("voiceOverlay");
      const recording = ["listening", "loading", "stopping"].includes(this.voiceState);
      overlay.classList.toggle("open", recording);
      if (recording) overlay.dataset.state = this.voiceState;
      else delete overlay.dataset.state;
      overlay.classList.toggle("hold", recording && this.voiceSession === "space-hold");
      if (!recording) this.resetSlideCancel();
      document.getElementById("voiceStatus").textContent = this.voiceState === "listening" ? t("\u6B63\u5728\u8046\u542C\u2026") : this.voiceState === "loading" ? t("\u6B63\u5728\u52A0\u8F7D\u8BED\u97F3\u5F15\u64CE\u2026") : this.voiceState === "stopping" ? t("\u7ED3\u675F\u8BC6\u522B\u2026") : "";
      document.getElementById("voiceHint").textContent = this.voiceState === "loading" ? t("\u5C31\u7EEA\u540E\u81EA\u52A8\u5F00\u59CB\u8046\u542C\uFF0C\u70B9\u51FB\u53EF\u53D6\u6D88") : this.voiceSession === "space-hold" ? t("\u677E\u624B\u4E0A\u5C4F") : t("\u70B9\u51FB\u4EFB\u610F\u4F4D\u7F6E\u7ED3\u675F");
      if (payload.message && this.voiceState === "error") {
        document.getElementById("voiceStatus").textContent = payload.message;
      }
      document.getElementById("partialText").textContent = payload.partial || "";
      this.onVoiceLevel(payload.level);
      const mic = document.getElementById("mic");
      if (mic) mic.className = "tool" + (this.voiceState === "idle" ? "" : " " + this.voiceState);
      const space = document.querySelector("#spaceKey");
      space == null ? void 0 : space.classList.toggle("voice", this.voiceState !== "idle");
      this.updateMicDisabled();
      this.updateComposing({ composing: this.composing });
      if (payload.message) this.showToast(payload.message);
    }
    onEditorInfo(payload) {
      this.editorSensitive = !!payload.sensitive;
      this.updateMicDisabled();
    }
    /** H4: mic disabled is the OR of editor sensitivity and stop-in-progress. */
    updateMicDisabled() {
      const mic = document.getElementById("mic");
      if (mic) mic.disabled = this.editorSensitive || this.voiceState === "stopping";
    }
    /** 定制键备注：锚在键上方的气泡（1.6s 自隐）。 */
    showKeyNote(anchor, text) {
      const old = document.getElementById("keyNote");
      if (old) old.remove();
      const tip = document.createElement("div");
      tip.id = "keyNote";
      tip.textContent = text;
      document.body.append(tip);
      const r = anchor.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      tip.style.left = Math.max(8, Math.min(
        vw - tip.offsetWidth - 8,
        r.left + r.width / 2 - tip.offsetWidth / 2
      )) + "px";
      tip.style.top = Math.max(6, r.top - tip.offsetHeight - 10) + "px";
      clearTimeout(this._keyNoteTimer);
      this._keyNoteTimer = setTimeout(() => tip.remove(), 1600);
    }
    showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("open");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("open"), 2600);
    }
  };
  __name(_FeelimeKeyboard, "FeelimeKeyboard");
  let FeelimeKeyboard = _FeelimeKeyboard;
  const Native = window.FeelimeNative || {
    keyboardReady: /* @__PURE__ */ __name(() => {
    }, "keyboardReady"),
    pushStores: /* @__PURE__ */ __name(() => "", "pushStores"),
    getStores: /* @__PURE__ */ __name(() => "{}", "getStores"),
    key: /* @__PURE__ */ __name((value) => console.log("key", value), "key"),
    setComposition: /* @__PURE__ */ __name((keys) => console.log("setComposition", keys), "setComposition"),
    space: /* @__PURE__ */ __name(() => console.log("space"), "space"),
    backspace: /* @__PURE__ */ __name(() => console.log("backspace"), "backspace"),
    enter: /* @__PURE__ */ __name(() => console.log("enter"), "enter"),
    moveCursor: /* @__PURE__ */ __name((delta) => console.log("moveCursor", delta), "moveCursor"),
    recognizeInk: /* @__PURE__ */ __name((reqId, payload) => console.log("recognizeInk", reqId, payload), "recognizeInk"),
    keyEvent: /* @__PURE__ */ __name((keyCode, metaState) => console.log("keyEvent", keyCode, metaState), "keyEvent"),
    chooseCandidate: /* @__PURE__ */ __name((revision, id) => console.log("choose", revision, id), "chooseCandidate"),
    deleteHighlightedCandidate: /* @__PURE__ */ __name(() => console.log("deleteHighlightedCandidate"), "deleteHighlightedCandidate"),
    deleteCandidate: /* @__PURE__ */ __name((revision, id) => console.log("deleteCandidate", revision, id), "deleteCandidate"),
    pageNext: /* @__PURE__ */ __name(() => {
    }, "pageNext"),
    pagePrevious: /* @__PURE__ */ __name(() => {
    }, "pagePrevious"),
    selectMode: /* @__PURE__ */ __name((mode) => console.log("mode", mode), "selectMode"),
    startVoice: /* @__PURE__ */ __name(() => {
    }, "startVoice"),
    stopVoice: /* @__PURE__ */ __name(() => {
    }, "stopVoice"),
    switchInputMethod: /* @__PURE__ */ __name(() => {
    }, "switchInputMethod"),
    hideKeyboard: /* @__PURE__ */ __name(() => {
    }, "hideKeyboard"),
    openSetup: /* @__PURE__ */ __name(() => {
    }, "openSetup"),
    reloadKeyboard: /* @__PURE__ */ __name(() => {
    }, "reloadKeyboard"),
    requestState: /* @__PURE__ */ __name(() => {
    }, "requestState"),
    commitText: /* @__PURE__ */ __name((text) => console.log("commitText", text), "commitText"),
    getClipboard: /* @__PURE__ */ __name(() => {
    }, "getClipboard"),
    removeClipboard: /* @__PURE__ */ __name((id) => console.log("removeClipboard", id), "removeClipboard"),
    clearClipboard: /* @__PURE__ */ __name(() => {
    }, "clearClipboard"),
    getFavorites: /* @__PURE__ */ __name(() => {
    }, "getFavorites"),
    removeFavorite: /* @__PURE__ */ __name((id) => console.log("removeFavorite", id), "removeFavorite")
  };
  const THEMES = ["auto", "light", "dark"];
  const THEME_LABELS = { auto: "\u8DDF\u968F\u7CFB\u7EDF", light: "\u6D45\u8272", dark: "\u6DF1\u8272" };
  let systemTheme = "light";
  let systemThemeKnown = false;
  try {
    const saved = localStorage.getItem("feelime_system_theme");
    if (saved === "dark" || saved === "light") {
      systemTheme = saved;
      systemThemeKnown = true;
    }
  } catch (_) {
  }
  function applyTheme(theme) {
    if (theme !== "auto" && theme !== "light" && theme !== "dark") theme = "auto";
    const root = document.documentElement;
    if (theme !== "auto") {
      root.className = `theme-${theme}`;
    } else {
      root.className = systemThemeKnown ? `theme-${systemTheme}` : "";
    }
    try {
      keyboard.swapThemeGlyph(theme);
      keyboard.applyBackground();
      keyboard._inkColor = keyboard.inkColor();
      keyboard.inkPaint();
    } catch (_) {
    }
  }
  __name(applyTheme, "applyTheme");
  function cycleTheme() {
    try {
      const current = localStorage.getItem("feelime_theme") || "auto";
      const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
      localStorage.setItem("feelime_theme", next);
      applyTheme(next);
      return next;
    } catch (_) {
      return "auto";
    }
  }
  __name(cycleTheme, "cycleTheme");
  applyTheme();
  const keyboard = new FeelimeKeyboard();
  const defocusButtons = /* @__PURE__ */ __name(() => {
    document.querySelectorAll("button:not([tabindex])").forEach((button) => {
      button.tabIndex = -1;
    });
  }, "defocusButtons");
  if (typeof MutationObserver === "function") {
    new MutationObserver(defocusButtons).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  defocusButtons();
  keyboard.cycleTheme = cycleTheme;
  keyboard.themeLabel = () => t(THEME_LABELS[keyboard.themeMode] || THEME_LABELS.auto);
  window.Feelime = {
    onBridgeHello: /* @__PURE__ */ __name((payload) => keyboard.onBridgeHello(payload), "onBridgeHello"),
    // #12 复发取证：native 推送到达 JS 的对账计数（心跳捎带
    // states=N preedit=L，与 native 日志的 stateApplied 行数对照：
    // 相等=JS 收到了（查渲染层）；少=推送丢（查 evaluate 层））。
    onEngineState: /* @__PURE__ */ __name((payload) => {
      window.__diagStates = (window.__diagStates || 0) + 1;
      window.__diagRev = payload && payload.revision;
      keyboard.hwDoneSeq = Math.max(keyboard.hwDoneSeq || 0, payload && payload.hwDoneSeq || 0);
      if (!keyboard.hwStateSeen) {
        keyboard.hwStateSeen = true;
        if (!keyboard.hwReported && typeof Native.reportHwKeys === "function") {
          keyboard.hwReported = true;
          keyboard.call(() => Native.reportHwKeys(1, keyboard.token));
        }
      }
      try {
        const r = keyboard.onEngineState(payload);
        keyboard.hwDrain();
        return r;
      } catch (e) {
        window.__diagErr = String(e && e.message || e).slice(0, 60);
        throw e;
      }
    }, "onEngineState"),
    onAssoc: /* @__PURE__ */ __name((payload) => keyboard.onAssoc(payload), "onAssoc"),
    onNativeState: /* @__PURE__ */ __name((payload) => keyboard.onNativeState(payload), "onNativeState"),
    onVoiceLevel: /* @__PURE__ */ __name((level) => keyboard.onVoiceLevel(level), "onVoiceLevel"),
    onInkCandidates: /* @__PURE__ */ __name((payload) => keyboard.onInkCandidates(payload), "onInkCandidates"),
    onEditorInfo: /* @__PURE__ */ __name((payload) => keyboard.onEditorInfo(payload), "onEditorInfo"),
    cancelTouches: /* @__PURE__ */ __name(() => keyboard.cancelTouches(), "cancelTouches"),
    // #H 硬件键盘：native 全认领后的注入入口（design §1/§4.1）。
    hwKey: /* @__PURE__ */ __name((kind, value, gen) => keyboard.hwEnqueue(kind, value, gen), "hwKey"),
    // #H 会话换代（native onStartInput 驱动，codex 复审 P1-1）。
    hwSessionReset: /* @__PURE__ */ __name((gen) => keyboard.hwSessionReset(gen), "hwSessionReset"),
    quickPairToggle: /* @__PURE__ */ __name(() => keyboard.toggleChineseEnglish(), "quickPairToggle"),
    // #48 编辑器换代作废在途定制宏链（native onStartInput 驱动）。
    cancelCustomChain: /* @__PURE__ */ __name(() => keyboard.cancelCustomChain(), "cancelCustomChain"),
    cancelToolbarEdit: /* @__PURE__ */ __name(() => keyboard.cancelToolbarEdit(), "cancelToolbarEdit"),
    // 工具位（debugState 同类）：自定义行缩放器，mock/预览直调锁数值。
    fitCustomRow: /* @__PURE__ */ __name((strip) => keyboard.fitCustomRow(strip), "fitCustomRow"),
    onClipboard: /* @__PURE__ */ __name((payload) => keyboard.onClipboard(payload), "onClipboard"),
    onFavorites: /* @__PURE__ */ __name((payload) => keyboard.onFavorites(payload), "onFavorites"),
    onStoresRestored: /* @__PURE__ */ __name((stores) => keyboard.onStoresRestored(stores), "onStoresRestored"),
    onPanelCommit: /* @__PURE__ */ __name((payload) => keyboard.onPanelCommit(payload), "onPanelCommit"),
    onPanelDelete: /* @__PURE__ */ __name((payload) => keyboard.onPanelDelete(payload), "onPanelDelete"),
    onImeGestureDeleteAll: /* @__PURE__ */ __name((payload) => keyboard.onImeGestureDeleteAll(payload), "onImeGestureDeleteAll"),
    onImeGestureRestore: /* @__PURE__ */ __name((payload) => keyboard.onImeGestureRestore(payload), "onImeGestureRestore"),
    onPanelComposing: /* @__PURE__ */ __name((payload) => keyboard.onPanelComposing(payload), "onPanelComposing"),
    onPanelFinishComposing: /* @__PURE__ */ __name((payload) => keyboard.onPanelFinishComposing(payload), "onPanelFinishComposing"),
    onPanelReopen: /* @__PURE__ */ __name((payload) => keyboard.onPanelReopen(payload), "onPanelReopen"),
    onPanelFlushed: /* @__PURE__ */ __name((payload) => keyboard.onPanelFlushed(payload), "onPanelFlushed"),
    // Debug/automation hooks: the mode menu and settings panel render
    // lazily, so DOM-only openers would show an empty container.
    toggleModeMenu: /* @__PURE__ */ __name(() => keyboard.toggleModeMenu(), "toggleModeMenu"),
    // #55 悬浮键盘（spike）：CDP/自动化直调（工具栏入口照常可用）。
    setFloatingMode: /* @__PURE__ */ __name((on) => keyboard.setFloatingMode(on), "setFloatingMode"),
    closeModeMenu: /* @__PURE__ */ __name(() => keyboard.closeModeMenu(), "closeModeMenu"),
    toggleSettingsPanel: /* @__PURE__ */ __name(() => keyboard.toggleSettingsPanel(), "toggleSettingsPanel"),
    closeSettingsPanel: /* @__PURE__ */ __name(() => keyboard.closeSettingsPanel(), "closeSettingsPanel"),
    // #39-10 编辑面板（preview/诊断与 mock 套件共用入口）。
    toggleEditPanel: /* @__PURE__ */ __name(() => keyboard.toggleEditPanel(), "toggleEditPanel"),
    toggleStatsPanel: /* @__PURE__ */ __name(() => keyboard.toggleStatsPanel(), "toggleStatsPanel"),
    toggleControlView: /* @__PURE__ */ __name(() => keyboard.setControlView(!keyboard.ctrlView), "toggleControlView"),
    showNumpad: /* @__PURE__ */ __name(() => keyboard.showNumpad(), "showNumpad"),
    // Called by the native side on every IME show: hiding the IME can
    // DETACH the input view, and a re-attach hands ResizeObserver the
    // current size as its baseline (no callback) - a pad/height change
    // made while hidden would then keep a stale row budget (device-gate
    // proven). Re-derive from the live geometry at show time.
    // 手写总高也在这里再推一次：重唤键盘不重跑 renderMode（模式没
    // 变），收起期间动过高度的场合靠这一下回到手写态（P1 重唤折叠）。
    applyHeightNow: /* @__PURE__ */ __name(() => {
      keyboard.applyModeHeight();
      keyboard.applyHeight();
    }, "applyHeightNow"),
    // 键帽水位线探针/驱动（#55）：无参=按当前 --kb-row-h 重算。
    applyKeycapMetrics: /* @__PURE__ */ __name((H) => keyboard.applyKeycapMetrics(H), "applyKeycapMetrics"),
    // 悬浮工具条拟合探针/驱动（#55 窄卡溢出返工）。
    fitToolbar: /* @__PURE__ */ __name(() => keyboard.fitFloatingToolbar(), "fitToolbar"),
    onHeightSaved: /* @__PURE__ */ __name((ok) => keyboard.onHeightSaved(ok), "onHeightSaved"),
    // Native all-up audit probe: read-only per call, but a reported
    // residue now triggers native-side remediation (cancelTouches
    // injection) — see FeelimeService dispatchTouchEvent allUp comment.
    touchState: /* @__PURE__ */ __name(() => {
      var _a, _b, _c;
      return {
        popup: !!keyboard.popup,
        dom: !!((_a = document.getElementById("keyPopup")) == null ? void 0 : _a.classList.contains("open")),
        owner: (_c = (_b = keyboard.popup) == null ? void 0 : _b.fingerId) != null ? _c : null,
        ids: Array.from(keyboard.pressById.keys()).slice(0, 12),
        press: keyboard.pressedKeys.size,
        epoch: keyboard.touchEpoch
      };
    }, "touchState"),
    // allUp 治理的注入入口（带代际守卫）：audit 查询时的 epoch 与
    // 实际执行时不等 = 查询后又有新按下（evaluateJavascript 异步
    // 落地窗口）——放弃清理，绝不清正在进行的按压。
    cancelTouchesEpochGuard: /* @__PURE__ */ __name((epoch) => {
      if (keyboard.touchEpoch !== epoch) return "skipped";
      keyboard.cancelTouches();
      return "cleared";
    }, "cancelTouchesEpochGuard"),
    // Read-only automation probe (device gates): the keyboard instance is
    // a closure, so gates cannot reach runtime fields without this.
    debugState: /* @__PURE__ */ __name(() => ({
      mode: keyboard.mode,
      // #39-12 守门：互斥注册表名单（mock 枚举 DOM 层比对，
      // 新视图漏登记直接红）。
      exclusiveViews: Object.keys(EXCLUSIVE_VIEWS),
      exclusiveEls: Object.values(EXCLUSIVE_VIEWS).map((v) => v.el),
      // #12 复发取证：渲染短路三嫌疑直接暴露（心跳捎带）。
      vr: keyboard.variantReplaying ? 1 : 0,
      warm: keyboard.warming ? 1 : 0,
      comp: keyboard.composing ? 1 : 0,
      holdMs: keyboard.holdMs,
      scrubSpeed: keyboard.scrubSpeed,
      popupSnap: keyboard.popupSnap,
      bottomPad: keyboard.bottomPad,
      // 手写（issue #28）：在途请求号 + 笔迹规模，设备门禁断言用。
      inkReqId: keyboard.inkReqId,
      inkStrokes: keyboard.inkStrokes.length,
      // 停顿触发延时档位（设置回归断言用）。
      // Copy: a hand-out reference would let automation mutate the
      // live degrade state (active=false left a stale badge).
      degraded: keyboard.degrade ? { ...keyboard.degrade } : null,
      warming: keyboard.warming,
      // 工具栏编辑模式（issue #15）：编辑态 + 左右分组只读快照。
      toolbarEdit: keyboard.toolbarEdit,
      toolbarLeft: keyboard.toolbarLeft.slice(),
      toolbarRight: keyboard.toolbarRight.slice(),
      // #46 联想让位态退格清联想开关（设置页写入，hello 回读）。
      backspaceAssocOn: keyboard.backspaceAssocOn,
      // #45 万象 / 键功能引导开关。
      wxSlashOn: keyboard.wxSlashOn,
      // Automation gates drive setComposition (T9 音节条引擎验证等)；
      // DevTools 已是调试构建的完整控制面，token 不放大攻击面。
      token: keyboard.token
    }), "debugState"),
    // Voice-overlay preview hooks: 长按空格的浮层（无按钮、上滑撤销）
    // 与 mic 浮层不同形；preview 页没有真实的按住手势，用钩子驱动。
    setVoiceSession: /* @__PURE__ */ __name((session) => {
      keyboard.voiceSession = session;
    }, "setVoiceSession"),
    previewVoiceSlide: /* @__PURE__ */ __name((progress) => keyboard.updateSlideCancel(progress), "previewVoiceSlide"),
    clearEditor: /* @__PURE__ */ __name(() => keyboard.clearEditorBridge(), "clearEditor"),
    // The native re-show path lands the keyboard on its
    // main view.
    resetToHome: /* @__PURE__ */ __name(() => keyboard.resetToHome(), "resetToHome"),
    // Suite hook: drives the content-height bridge without
    // synthesizing a drag (the drag gesture itself is covered by ).
    applyKbHeight: /* @__PURE__ */ __name((content) => keyboard.applyKbHeight(content), "applyKbHeight"),
    // Suite/preview hook: the height card lives behind a toolbar tap;
    // tests drive the live-preview semantics directly.
    enterHeightEdit: /* @__PURE__ */ __name(() => keyboard.enterHeightEdit(), "enterHeightEdit"),
    // Suite/preview hook (issue #28 round-2): the ink delay setting and
    // the recognition-path smoother, for unit tests and preview probes.
    inkSmooth: /* @__PURE__ */ __name((points) => smoothInkStroke(points), "inkSmooth"),
    inkDecimate: /* @__PURE__ */ __name((strokes) => decimateInkStrokes(strokes), "inkDecimate"),
    // Preview/suite hook (issue #8): switch the preedit font level
    // without a native hello round-trip.
    setPreeditFont: /* @__PURE__ */ __name((level) => {
      keyboard.preeditFont = Number(level) || 0;
      keyboard.applyPreeditFont();
    }, "setPreeditFont"),
    // Preview/suite hook (issue #15): drive one-handed mode and the
    // side-strip content without a native hello round-trip.
    // Suite hook (issue #15): drive the toolbar drag landing directly
    // (mock cannot synthesize window-level touchmove/touchend).
    toolbarMove: /* @__PURE__ */ __name((id, group, index) => keyboard.moveInToolbar(id, group, index), "toolbarMove"),
    // Suite hook (issue #15): run the toolbar audit on demand.
    toolbarAudit: /* @__PURE__ */ __name(() => keyboard.auditToolbarTools(), "toolbarAudit"),
    // Suite hook (issue #15): add from the pool directly (idempotency
    // assertions).
    toolbarAdd: /* @__PURE__ */ __name((id) => keyboard.addToToolbar(id), "toolbarAdd"),
    // Suite hook (issue #15): overwrite both groups (audit-scenario
    // setup: ghost array entries / orphans cannot be built otherwise).
    toolbarSet: /* @__PURE__ */ __name((left, right) => {
      keyboard.toolbarLeft = [...left];
      keyboard.toolbarRight = [...right];
      keyboard.applyToolbarLayout();
    }, "toolbarSet"),
    setOneHand: /* @__PURE__ */ __name((level) => {
      keyboard.oneHand = Number(level) || 0;
      keyboard.applyOneHand();
    }, "setOneHand"),
    setOneHandPad: /* @__PURE__ */ __name((pct) => {
      keyboard.oneHandPad = Number(pct) || 0;
      keyboard.applyOneHand();
    }, "setOneHandPad"),
    setSideContent: /* @__PURE__ */ __name((mode) => {
      const n = Number(mode) || 0;
      keyboard.sideContent = n === 2 ? 1 : n;
      keyboard.applyOneHand();
    }, "setSideContent"),
    // Suite hook: the real theme-switch entry (toolbar tool / quick
    // tile route through it too).
    cycleTheme: /* @__PURE__ */ __name(() => keyboard.cycleTheme(), "cycleTheme"),
    // Suite/preview hook: re-evaluate the theme→image mapping after
    // switching html theme classes directly (applyTheme does this in
    // real flows).
    refreshBackground: /* @__PURE__ */ __name(() => keyboard.applyBackground(), "refreshBackground"),
    // Suite/preview hook: drive the background image without a hello.
    setBgImage: /* @__PURE__ */ __name((variant, base64) => {
      if (variant === "light") keyboard.bgImageLight = base64 || "";
      else if (variant === "dark") keyboard.bgImageDark = base64 || "";
      keyboard.applyBackground();
    }, "setBgImage"),
    // Device-suite hook: driving the newer bridge methods (height/key
    // events) from automation needs the live page token.
    get token() {
      return keyboard.token;
    },
    // design §15: custom-table editing moved to the full settings page;
    // suites drive the surviving save path directly.
    saveCustomJson: /* @__PURE__ */ __name((text) => keyboard.saveCustomJson(text), "saveCustomJson")
  };
  keyboard.setup();
})();
