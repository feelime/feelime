/*
 * Mock-bridge harness: runs the real keyboard.js against a minimal fake DOM,
 * fake clock and a recording FeelimeNative bridge in plain node (zero deps).
 * Headless, fake timers, DOM assertions (docs/testing/verification.md).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
// Source override: FEELIME_KEYBOARD_SRC=<dir> points the suite at any keyboard
// build (e.g. the shipped 3.20.0 sources in nginx kb-preview-src) so the
// same contract tests can baseline older releases.
const KB_SRC = process.env.FEELIME_KEYBOARD_SRC;
const HTML_PATH = (KB_SRC && path.join(KB_SRC, 'index.html')) ||
    path.join(ROOT, 'app/src/main/assets/keyboard/index.html');
const JS_PATH = (KB_SRC && path.join(KB_SRC, 'keyboard.js')) ||
    path.join(ROOT, 'app/src/main/assets/keyboard/keyboard.js');
const VERSION_PATH = (KB_SRC && path.join(KB_SRC, 'VERSION')) ||
    path.join(ROOT, 'app/src/main/assets/keyboard/VERSION');
const KEYBOARD_VERSION = fs.readFileSync(VERSION_PATH, 'utf8').trim();

// ---------------------------------------------------------------- fake DOM

let elementSeed = 0;

class ClassList {
    constructor(owner) {
        this.owner = owner;
        this.set = new Set();
    }
    add(...names) {
        names.forEach(n => this.set.add(n));
        this.owner.className = [...this.set].join(' ');
    }
    remove(...names) {
        names.forEach(n => this.set.delete(n));
        this.owner.className = [...this.set].join(' ');
    }
    toggle(name, force) {
        const target = force === undefined ? !this.set.has(name) : force;
        if (target) this.set.add(name);
        else this.set.delete(name);
        this.owner.className = [...this.set].join(' ');
        return target;
    }
    contains(name) {
        return this.set.has(name);
    }
}

// Real DOM moves never leave a node in two places: append/insertBefore
// detach the node from its current parent first. Toolbar editing moves
// the same button elements between the bar and the pool repeatedly, so
// a missing detach would duplicate them across both containers.
function detachMockNode(node) {
    if (node.parentNode) {
        const siblings = node.parentNode.children;
        const i = siblings.indexOf(node);
        if (i >= 0) siblings.splice(i, 1);
        node.parentNode._materializeTextCache();
    }
}

class FakeElement {
    constructor(tagName) {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.nodeType = 1;
        this.id = '';
        this.seed = elementSeed++;
        this.children = [];
        this.parentNode = null;
        this.attributes = {};
        this.dataset = {};
        this.classList = new ClassList(this);
        // Style as a plain map, plus the standard methods keyboard.js uses
        // on any element (CSS custom properties ride setProperty - the
        // combo card's --combo-cell). documentElement gets the
        // same patch at world build time.
        this.style = {};
        this.style.setProperty = (name, value) => { this.style[name] = value; };
        this.style.removeProperty = name => { delete this.style[name]; };
        this.style.getPropertyValue = name => this.style[name];
        this.listeners = [];
        // NOTE: textContent is deliberately NOT initialised here - the
        // getter lazily aggregates children and only short-circuits when
        // _textContent !== undefined; seeding '' would freeze every element
        // at "" and hide child text (settings.js buildModelRow regression).
        this.disabled = false;
        this.hidden = false;
        // Form fields (panel add/edit inputs) carry a value.
        this.value = '';
        // 设置页外观预览嵌真键盘 iframe：contentWindow 只需要记录
        // postMessage 载荷供断言（设置页单向发，不需要收）。
        if (this.tagName === 'IFRAME') {
            this.contentWindow = {
                calls: [],
                postMessage(payload, origin) {
                    this.calls.push({ payload, origin });
                },
            };
        }
        this._innerHTML = '';
        // Review follow-up: minimal horizontal-scroll model. Elements
        // marked scrollable (OVERFLOW_X_IDS, mirroring keyboard.css
        // overflow-x declarations) report a client/scrollWidth; scrollLeft
        // clamps against the LIVE content width, so a strip rebuild that
        // collapses children snaps scrollLeft back to 0 - the exact defect
        // the review caught on device.
        this._scrollable = false;
        this._scrollLeft = 0;
    }
    get clientWidth() {
        if (!this._scrollable) return 0;
        // 翻页条（.qs-pages，tile 网格）：视口宽 = 一页宽，scrollLeft
        // 以「页」为单位（2 页内容 → max 只有一页的余量）。
        if (this._pageStrip) {
            const first = this.firstElementChild;
            return first ? first.offsetWidth : 360;
        }
        return 360;
    }
    get scrollWidth() {
        if (!this._scrollable) return 0;
        let width = 0;
        for (const child of this.children) {
            width += (child.getBoundingClientRect().width || 44) + 8;
        }
        return Math.max(this.clientWidth, width);
    }
    get scrollLeft() {
        return this._scrollLeft;
    }
    set scrollLeft(value) {
        const max = Math.max(0, this.scrollWidth - this.clientWidth);
        this._scrollLeft = Math.max(0, Math.min(Number(value) || 0, max));
    }
    scrollTo(options) {
        // Real browsers animate with behavior:'smooth'; the harness jumps
        // straight to the target — enough for page-decision assertions.
        if (options && options.left !== undefined) this.scrollLeft = options.left;
    }

    markPageStrip() {
        this._pageStrip = true;
        this._scrollable = true;
    }
    get className() {
        return this.attributes.class || '';
    }
    set className(value) {
        this.attributes.class = value;
        this.classList.set = new Set(value.split(/\s+/).filter(Boolean));
        // 翻页条自标记（重建后的新 strip 也会走到这里）。
        if (this.classList.set.has('qs-pages')) this.markPageStrip();
    }
    get innerHTML() {
        return this._innerHTML;
    }
    set innerHTML(value) {
        this._innerHTML = value;
        this.children = parseFragment(value, this);
        this._textContent = undefined; // recompute lazily
    }
    get textContent() {
        if (this._textContent !== undefined) return this._textContent;
        return this.children.map(child => child.textContent).join('');
    }
    set textContent(value) {
        this._textContent = String(value);
        this.children = [];
        this._innerHTML = '';
    }
    get isConnected() {
        // rAF 兜底守卫（快捷设置页码恢复）依赖真实 DOM 的 isConnected。
        let node = this;
        while (node) {
            if (node.nodeType === 9) return true;
            node = node.parentNode;
        }
        return false;
    }
    get firstElementChild() {
        return (this.children || []).find(child => child.nodeType === 1) || null;
    }

    /** The textContent setter replaced every child with one text
     * string; the real DOM keeps that string as a child TEXT NODE, so a
     * later append must materialize it before adding more children (the
     * 常用 tab's badge span is exactly this: label + appended child). */
    _materializeTextCache() {
        if (this._textContent === undefined) return;
        const textNode = new FakeElement('#text');
        textNode.nodeType = 3;
        textNode.textContent = this._textContent;
        textNode.parentNode = this;
        this.children = [textNode];
        this._textContent = undefined;
    }
    append(...nodes) {
        this._materializeTextCache();
        nodes.forEach(node => {
            if (node === null || node === undefined) return;
            // Real DOM appends raw strings as text nodes (settings.js
            // renderPanels does text.append(item.text)).
            if (typeof node === 'string' || typeof node === 'number') {
                const textNode = new FakeElement('#text');
                textNode.nodeType = 3;
                textNode.textContent = String(node);
                textNode.parentNode = this;
                this.children.push(textNode);
                return;
            }
            detachMockNode(node);
            node.parentNode = this;
            this.children.push(node);
        });
        // Real textContent always reflects the subtree - appended
        // children must invalidate the setter's cache (the 常用 tab's
        // badge is a child span a plain textContent setter would hide).
        this._textContent = undefined;
    }
    cloneNode(_deep = false) {
        const copy = new FakeElement(this.tagName.toLowerCase());
        copy.id = this.id;
        copy.textContent = this.textContent;
        copy.disabled = this.disabled;
        copy.hidden = this.hidden;
        for (const [key, value] of Object.entries(this.attributes)) {
            copy.setAttribute(key, value);
        }
        Object.assign(copy.dataset, this.dataset);
        copy.className = this.className;
        return copy;
    }
    insertBefore(node, ref) {
        if (node === null || node === undefined) return node;
        this._materializeTextCache();
        detachMockNode(node);
        node.parentNode = this;
        const idx = ref ? this.children.indexOf(ref) : -1;
        if (idx < 0) this.children.push(node);
        else this.children.splice(idx, 0, node);
        this._textContent = undefined;
        return node;
    }
    remove() {
        if (this.parentNode) {
            const siblings = this.parentNode.children;
            const i = siblings.indexOf(this);
            if (i >= 0) siblings.splice(i, 1);
            this.parentNode._materializeTextCache();
            this.parentNode = null;
        }
    }
    appendChild(node) {
        this.append(node);
        return node;
    }
    replaceChildren(...nodes) {
        this.children = [];
        this._textContent = undefined;
        this.append(...nodes);
    }
    remove() {
        if (!this.parentNode) return;
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
        this.parentNode._materializeTextCache();
        this.parentNode = null;
    }
    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === 'class') this.className = String(value);
        if (name === 'id') this.id = String(value);
        if (name === 'hidden') this.hidden = true;
    }
    getAttribute(name) {
        return this.attributes[name] === undefined ? null : this.attributes[name];
    }
    addEventListener(type, handler, options) {
        // DOM accepts both the legacy boolean capture argument and the
        // options object; keyboard.js uses the boolean form on candidateBar.
        const opts = typeof options === 'boolean' ? { capture: options } : options;
        this.listeners.push({
            type,
            handler,
            capture: !!(opts && opts.capture),
            passive: !!(opts && opts.passive),
        });
    }
    removeEventListener(type, handler) {
        this.listeners = this.listeners.filter(
            l => !(l.type === type && l.handler === handler),
        );
    }
    click() {
        // Real browsers dispatch click through the full capture/bubble path
        // and invoke *every* listener (capture interceptors included).
        fakeDispatch(this, 'click', 0, 0);
    }
    matches(selector) {
        return matchesSelector(this, selector);
    }
    closest(selector) {
        let node = this;
        while (node) {
            if (matchesSelector(node, selector)) return node;
            node = node.parentNode;
        }
        return null;
    }
    getBoundingClientRect() {
        // Layout-ish geometry: a cell's rect comes from its own child index
        // within its parent (34px cells, a row per 10 siblings). Consecutive
        // siblings (popup cells, keys in a row) therefore sit side by side
        // like the real WebView, keeping drag distances realistic for popup
        // picks and drag-away cancels. Ancestor offsets are deliberately
        // ignored so fixed-position layers stay near the touch origin —
        // EXCEPT the popup's row containers (.kp-row, T9 三行弹层): rows
        // stack vertically in the real WebView, and without a per-row top
        // offset same-column cells of different rows collapse onto one rect
        // and nearest-center always picks the first row.
        const parent = this.parentNode;
        const index = parent ? Math.max(0, parent.children.indexOf(this)) : 0;
        const left = 6 + (index % 10) * 34;
        let top = 2 + Math.floor(index / 10) * 46;
        if (parent && parent.classList && parent.classList.contains('kp-row')) {
            const grand = parent.parentNode;
            const rowIdx = grand ? Math.max(0, grand.children.indexOf(parent)) : 0;
            top += rowIdx * 46;
        }
        return {
            left,
            top,
            width: 44,
            height: 44,
            bottom: top + 44,
            right: left + 44,
        };
    }
    get offsetWidth() {
        return 44;
    }
    get offsetHeight() {
        return 45;
    }
    // WAAPI stub for the flick blob - record the keyframes, never
    // run them (the fake DOM has no compositor; onfinish stays unset and
    // keyboard.js's no-WAAPI guard is what would clear the .run class).
    animate(keyframes, options) {
        this._animations = (this._animations || []).concat([{ keyframes, options }]);
        return { keyframes, options, onfinish: null, cancel() {} };
    }
    // The panel add-row focuses its input on toggle; real focus
    // management does not exist in the fake DOM.
    focus() {}
    blur() {}
    querySelector(selector) {
        return queryDescendants(this, selector, false)[0] || null;
    }
    querySelectorAll(selector) {
        return queryDescendants(this, selector, true);
    }
}

function matchesSelector(el, selector) {
    const descendant = selector.match(/^(\S+)\s+(\S+)$/);
    if (descendant) {
        const [base, child] = descendant.slice(1);
        const ancestor = el.closest ? el.closest(base) : null;
        return !!ancestor && matchesSelector(el, child);
    }
    // Supports "#id", ".class", "tag", ".class[data-x]", "[data-x]",
    // ".class[data-x=\"y\"]".
    const attrMatch = selector.match(/^([#.]?[\w-]*)?(\[([\w-]+)(?:="([^"]*)")?\])?$/);
    if (!attrMatch) return false;
    const base = attrMatch[1] || '';
    const attrName = attrMatch[3];
    const attrValue = attrMatch[4];
    if (base.startsWith('#') && el.id !== base.slice(1)) return false;
    if (base.startsWith('.') && !el.classList.contains(base.slice(1))) return false;
    if (base && !base.startsWith('#') && !base.startsWith('.')) {
        if (el.tagName !== base.toUpperCase()) return false;
    }
    if (attrName) {
        const value = el.dataset[attrName.replace(/^data-/, '').replace(/-([a-z])/g, (m, c) => c.toUpperCase())];
        if (attrValue !== undefined ? value !== attrValue : value === undefined) return false;
    }
    return true;
}

function queryDescendants(root, selector, all) {
    const found = [];
    const walk = node => {
        node.children.forEach(child => {
            if (matchesSelector(child, selector)) found.push(child);
            walk(child);
        });
    };
    walk(root);
    return all ? found : found.slice(0, 1);
}

function parseFragment(html, parent) {
    const nodes = [];
    const stack = [{ kids: nodes }];
    const regex = /<(\/?)((?:\w|-)+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
    let match;
    while ((match = regex.exec(html))) {
        const [full, closing, tag, rawAttrs, selfClose, text] = match;
        if (tag) {
            if (closing) {
                if (stack.length > 1) stack.pop();
                continue;
            }
            const el = new FakeElement(tag);
            const attrRegex = /([\w-]+)(?:="([^"]*)")?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(rawAttrs || ''))) {
                const name = attrMatch[1];
                const value = attrMatch[2] === undefined ? '' : attrMatch[2];
                if (name === 'class') el.className = value;
                else if (name === 'hidden') el.hidden = true;
                else if (name.startsWith('data-')) {
                    const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (m, c) => c.toUpperCase());
                    el.dataset[camel] = value;
                    el.setAttribute(name, value);
                } else {
                    el.setAttribute(name, value);
                }
            }
            stack[stack.length - 1].kids.push(el);
            el.parentNode = parent;
            if (!selfClose && !['meta', 'link', 'input', 'br', 'img'].includes(tag)) {
                stack.push({ kids: [], el });
                el.children = el.children || [];
                // Route children into the element itself.
                stack[stack.length - 1].kids = el.children;
            }
        } else if (text && text.trim()) {
            const textNode = new FakeElement('#text');
            textNode.nodeType = 3;
            textNode.textContent = text.trim();
            textNode.parentNode = parent;
            stack[stack.length - 1].kids.push(textNode);
        }
    }
    return nodes;
}

function parseSimpleHtml(html, parent) {
    // Tiny parser for the simple markup keyboard.js emits: tags with only a
    // class attribute, plain text between them, no nesting beyond one level.
    const nodes = [];
    const regex = /<(\w+)(?:\s+class="([^"]*)")?>([^<]*)<\/\1>|([^<]+)/g;
    let match;
    while ((match = regex.exec(html))) {
        if (match[1]) {
            const el = new FakeElement(match[1]);
            if (match[2]) el.className = match[2];
            if (match[3]) el.textContent = match[3];
            el.parentNode = parent;
            nodes.push(el);
        } else if (match[4] && match[4].trim()) {
            const text = new FakeElement('#text');
            text.nodeType = 3;
            text.textContent = match[4];
            text.parentNode = parent;
            nodes.push(text);
        }
    }
    return nodes;
}

class FakeDocument extends FakeElement {
    constructor() {
        super('#document');
        this.nodeType = 9;
        this.body = new FakeElement('body');
        this.documentElement = new FakeElement('html');
        // CSS custom properties (keyboard.js writes --kb-row-h etc. through
        // setProperty) - a plain map per element.
        this.documentElement.style.setProperty = (name, value) => {
            this.documentElement.style[name] = value;
        };
        this.documentElement.style.getPropertyValue = name => this.documentElement.style[name];
        this.documentElement.style.removeProperty = name => {
            delete this.documentElement.style[name];
        };
        this.documentElement.append(this.body);
        this.append(this.documentElement);
        this.elementsById = new Map();
        // Keyboard.js routes panel commits via activeElement.
        this.activeElement = null;
    }
    createElement(tag) {
        return new FakeElement(tag);
    }
    createElementNS(_namespace, tag) {
        return new FakeElement(tag);
    }
    getElementById(id) {
        if (this.elementsById.has(id)) return this.elementsById.get(id);
        const walk = node => {
            for (const child of node.children) {
                if (child.id === id) return child;
                const found = walk(child);
                if (found) return found;
            }
            return null;
        };
        return walk(this.documentElement);
    }
    querySelector(selector) {
        if (selector.startsWith('#')) {
            const el = this.getElementById(selector.slice(1));
            return el && matchesSelector(el, selector) ? el : this.querySelectorAll(selector)[0] || null;
        }
        return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
        return queryDescendants(this.documentElement, selector, true);
    }
}

// Elements that keyboard.css gives `overflow-x: auto` (horizontal
// containers). The harness has no CSS engine, so scrollability is declared
// here - keep in sync with keyboard.css (css_lint.js guards the other side).
// ExpandGrid scrolled vertically now, so it left this list.
const OVERFLOW_X_IDS = ['symCats', 'candidates'];

// Parses the real index.html into fake elements (structure-level assertions
// come along for free: symbol layer starts hidden, voice overlay exists...).
function loadDocument(html) {
    const doc = new FakeDocument();
    const stack = [doc.documentElement, doc.body];
    const regex = /<(\/?)(\w+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
    let match;
    while ((match = regex.exec(html))) {
        const [full, closing, tag, rawAttrs, selfClose, text] = match;
        if (tag) {
            if (closing) {
                if (stack.length > 1) stack.pop();
                continue;
            }
            const el = new FakeElement(tag);
            const attrRegex = /([\w-]+)(?:="([^"]*)")?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(rawAttrs || ''))) {
                const name = attrMatch[1];
                const value = attrMatch[2] === undefined ? '' : attrMatch[2];
                if (name === 'id') {
                    el.id = value;
                    doc.elementsById.set(value, el);
                } else if (name === 'class') {
                    el.className = value;
                } else if (name.startsWith('data-')) {
                    // M4: generic dataset fill so [data-role=…] selectors work.
                    const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (m, c) => c.toUpperCase());
                    el.dataset[camel] = value;
                    el.setAttribute(name, value);
                } else if (name === 'hidden') {
                    el.hidden = true;
                } else if (name !== 'src' && name !== 'rel' && name !== 'charset' && name !== 'name' && name !== 'content' && name !== 'lang' && name !== 'title') {
                    el.setAttribute(name, value);
                }
            }
            stack[stack.length - 1].append(el);
            if (!selfClose && !['meta', 'link'].includes(tag)) stack.push(el);
        } else if (text && text.trim() && stack.length > 1) {
            const top = stack[stack.length - 1];
            if (top.children.length === 0 && top.textContent === '') {
                top.textContent = text.trim();
            }
        }
    }
    for (const id of OVERFLOW_X_IDS) {
        const el = doc.getElementById(id);
        if (el) el._scrollable = true;
    }
    return doc;
}

// ---------------------------------------------------------------- fake clock

class FakeClock {
    constructor() {
        this.now = 0;
        this.tasks = new Map();
        this.nextId = 1;
    }
    setTimeout(fn, delay) {
        const id = this.nextId++;
        this.tasks.set(id, { at: this.now + delay, fn, interval: 0 });
        return id;
    }
    clearTimeout(id) {
        this.tasks.delete(id);
    }
    setInterval(fn, interval) {
        const id = this.nextId++;
        this.tasks.set(id, { at: this.now + interval, fn, interval });
        return id;
    }
    clearInterval(id) {
        this.tasks.delete(id);
    }
    advance(ms) {
        const target = this.now + ms;
        while (true) {
            const due = [...this.tasks.entries()]
                .filter(([, t]) => t.at <= target)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) break;
            const [id, task] = due;
            this.now = task.at;
            if (task.interval) task.at = task.at + task.interval;
            else this.tasks.delete(id);
            task.fn();
        }
        this.now = target;
    }
}

// ---------------------------------------------------------------- mock bridge

class MockNative {
    constructor() {
        this.calls = [];
        this.respond = () => {};
        // design §15: payload the native customKeys() query returns.
        this.customKeysPayload = '';
    }
    _record(method, args) {
        this.calls.push({ method, args, at: Date.now() });
    }
    keyboardReady(version, minApi, caps, token) {
        this._record('keyboardReady', [version, minApi, caps, token]);
    }
    commitAssoc(text, token) {
        this._record('commitAssoc', [text, token]);
    }
    setKeyboardHeight(totalCssPx, token) {
        this._record('setKeyboardHeight', [totalCssPx, token]);
    }
    // design §15: the settings page's native table mirror.
    customKeys(token) {
        this._record('customKeys', [token]);
        return this.customKeysPayload;
    }
    setCustomKeys(json, token) {
        this._record('setCustomKeys', [json, token]);
    }
    // 快捷设置方块（tile 网格）的偏好写通道。
    setQuickPref(key, value, token) {
        this._record('setQuickPref', [key, value, token]);
    }
    key(char, token) {
        this._record('key', [char, token]);
    }
    // issue #5 问题 2：按键声音/触感，开关在设置页、默认全关。
    keyFeedback(token) {
        this._record('keyFeedback', [token]);
    }
    setComposition(keys, token) {
        this._record('setComposition', [keys, token]);
    }
    space(token) {
        this._record('space', [token]);
    }
    backspace(token) {
        this._record('backspace', [token]);
    }
    enter(token) {
        this._record('enter', [token]);
    }
    moveCursor(delta, token) {
        this._record('moveCursor', [delta, token]);
    }
    // Control layer: raw host key events (keycode + meta).
    keyEvent(keyCode, metaState, token) {
        this._record('keyEvent', [keyCode, metaState, token]);
    }
    // The physical Win-combo channel (modifier down, key
    // down/up, modifier up) - recorded separately so tests can tell the
    // two forms apart.
    keyEventPhysical(keyCode, metaState, token) {
        this._record('keyEventPhysical', [keyCode, metaState, token]);
    }
    // Popup band touchability flips.
    setOverlayOpen(open, token) {
        this._record('setOverlayOpen', [open, token]);
    }
    chooseCandidate(revision, id, token) {
        this._record('chooseCandidate', [revision, id, token]);
    }
    pageNext(revision, token) {
        this._record('pageNext', [revision, token]);
    }
    pagePrevious(revision, token) {
        this._record('pagePrevious', [revision, token]);
    }
    selectMode(mode, token) {
        this._record('selectMode', [mode, token]);
    }
    startVoice(token) {
        this._record('startVoice', [token]);
    }
    stopVoice(token) {
        this._record('stopVoice', [token]);
    }
    cancelVoice(token) {
        this._record('cancelVoice', [token]);
    }
    switchInputMethod(token) {
        this._record('switchInputMethod', [token]);
    }
    commitText(text, token) {
        this._record('commitText', [text, token]);
    }
    clearComposing(token) {
        this._record('clearComposing', [token]);
    }
    getClipboard(token) {
        this._record('getClipboard', [token]);
    }
    removeClipboard(id, token) {
        this._record('removeClipboard', [id, token]);
    }
    clearClipboard(token) {
        this._record('clearClipboard', [token]);
    }
    getFavorites(token) {
        this._record('getFavorites', [token]);
    }
    // userdata 备份的 localStorage 设置级镜像（docs/design/userdata.md §1.4）。
    // 与原生 ImeBridge.pushStores 一致：合并进镜像并抬高 rev，下次拉取可见。
    pushStores(json, token) {
        this._record('pushStores', [json, token]);
        this.storesRev = (this.storesRev || 0) + 1;
        let pushed = {};
        try { pushed = JSON.parse(json || '{}'); } catch (_) {}
        const base = this.storesPayload ? JSON.parse(this.storesPayload) : null;
        const values = Object.assign({}, (base && base.values) || {}, pushed);
        this.storesPayload = JSON.stringify({ rev: this.storesRev, values });
        return String(this.storesRev);
    }
    getStores(token) {
        this._record('getStores', [token]);
        if (this.storesPayload) return this.storesPayload;
        return JSON.stringify({ rev: this.storesRev || 0, values: {} });
    }
    removeFavorite(id, token) {
        this._record('removeFavorite', [id, token]);
    }
    // Phrase manager (settings sub-page) CRUD.
    // Keyboard 3.25.0: a rank arg rides before the token.
    favoritesAdd(text, code, rank, token) {
        this._record('favoritesAdd', [text, code, rank, token]);
    }
    favoritesUpdate(id, text, code, rank, token) {
        this._record('favoritesUpdate', [id, text, code, rank, token]);
    }
    favoritesRemove(id, token) {
        this._record('favoritesRemove', [id, token]);
    }
    favoritesMove(id, to, token) {
        this._record('favoritesMove', [id, to, token]);
    }
    panelFlush(session, token) { this._record('panelFlush', [session, token]); }
    panelSelection(start, end, session, token) { this._record('panelSelection', [start, end, session, token]); }

    panelInput(active, token) {
        this._record('panelInput', [active, token]);
    }
    // 手写识别（issue #28，design/handwriting.md §3）：只记录调用；
    // 结果由测试经 world.context.window.Feelime.onInkCandidates 注入。
    recognizeInk(reqId, payload, token) {
        this._record('recognizeInk', [reqId, payload, token]);
    }
    hideKeyboard(token) {
        this._record('hideKeyboard', [token]);
    }
    openSetup(token) {
        this._record('openSetup', [token]);
    }
    reloadKeyboard(token) {
        this._record('reloadKeyboard', [token]);
    }
    requestState() {
        this._record('requestState', []);
    }
    deleteHighlightedCandidate(token) {
        this._record('deleteHighlightedCandidate', [token]);
    }
    deleteCandidate(revision, candidateId, token) {
        this._record('deleteCandidate', [revision, candidateId, token]);
    }
    of(method) {
        return this.calls.filter(c => c.method === method);
    }
    reset() {
        this.calls = [];
    }
}

// ---------------------------------------------------------------- world

class KeyboardWorld {
    constructor() {
        this.html = fs.readFileSync(HTML_PATH, 'utf8');
        this.js = fs.readFileSync(JS_PATH, 'utf8');
        this.clock = new FakeClock();
        this.native = new MockNative();
        this.storage = new Map();
        // Era alias: the pinned 3.20.0 fixture persists under the pre-rename
        // `felime_*` keys while the current keyboard uses `feelime_*`; keep
        // both spellings pointing at the same entries so era-agnostic tests
        // can seed and assert with either prefix.
        const storage = this.storage;
        const alias = k => k.startsWith('feelime_') ? `felime_${k.slice(8)}`
                        : k.startsWith('felime_') ? `feelime_${k.slice(7)}` : null;
        const storageGet = storage.get.bind(storage);
        const storageHas = storage.has.bind(storage);
        storage.get = k => storageHas(k) ? storageGet(k)
                        : (alias(k) && storageHas(alias(k)) ? storageGet(alias(k)) : storageGet(k));
        storage.has = k => storageHas(k) || (!!(alias(k)) && storageHas(alias(k)));
        const storageSet = storage.set.bind(storage);
        storage.set = (k, v) => { storageSet(k, v); const a = alias(k); if (a) storageSet(a, v); };
        const storageDelete = storage.delete.bind(storage);
        storage.delete = k => { storageDelete(k); const a = alias(k); if (a) storageDelete(a); };
        this.tokenValue = 'tok-1';
    }

    build() {
        const doc = loadDocument(this.html);
        const world = this;
        const sandbox = {
            console: { log() {}, error() {} },
            document: doc,
            window: {},
            localStorage: {
                getItem: k => (world.storage.has(k) ? world.storage.get(k) : null),
                setItem: (k, v) => world.storage.set(k, v),
                // The legacy custom-rows migration removes its old key.
                removeItem: k => world.storage.delete(k),
            },
            innerWidth: 393,
            innerHeight: 252,
            // B: keyboard.js binds a resize listener (guarded by
            // typeof addEventListener) - provide a minimal bus so tests can
            // fire viewport changes.
            resizeListeners: [],
            addEventListener(type, fn) {
                if (type === 'resize') this.resizeListeners.push(fn);
            },
            fireResize() {
                this.resizeListeners.forEach(fn => fn());
            },
            setTimeout: (fn, d) => this.clock.setTimeout(fn, d),
            clearTimeout: id => this.clock.clearTimeout(id),
            setInterval: (fn, d) => this.clock.setInterval(fn, d),
            clearInterval: id => this.clock.clearInterval(id),
            JSON,
            Math,
            RegExp,
            Date,
            Object,
            Array,
            String,
            Number,
            Boolean,
            Map,
            Set,
            Promise,
        };
        sandbox.window = sandbox;
        sandbox.window.FeelimeNative = this.native;
        // the pinned 3.20.0 fixture still binds the pre-rename bridge name
        sandbox.window.FelimeNative = this.native;
        this.context = vm.createContext(sandbox);
        vm.runInContext(this.js, this.context, { filename: 'keyboard.js' });
        // the pinned 3.20.0 fixture exposes the pre-rename keyboard global;
        // alias it so era-agnostic helpers can drive both generations
        sandbox.window.Feelime = sandbox.window.Feelime || sandbox.window.Felime;
        this.document = doc;
        return this;
    }

    // ---- bridge-level helpers
    hello(overrides = {}) {
        const payload = Object.assign(
            {
                nativeApiVersion: 1,
                // Union of every era's capability list: native capabilities
                // only grow, so a superset satisfies both the 3.20.0
                // baseline (favorites-v1) and the current keyboard
                // (favorites-v2).
                capabilities: [
                    'candidate-revision-v1',
                    'clipboard-v1',
                    'commit-text-v1',
                    'compose-control-v1', 'unicode-compose-v1',
                    'cursor-repeat-v1', 'cursor-delta-v1', 'panel-compose-v1',
                    'favorites-v1',
                    'favorites-v2',
                    'ime-control-v1',
                    'key-event-v1',
                    'keyboard-update-status-v1',
                    'keyboard-height-reset-v1',
                    'text-input-v1',
                    'voice-session-v1',
                    'voice-cancel-v1',
                ],
                pageGenerationToken: this.tokenValue,
                mode: 'direct',
                // 界面语言「选择值」（auto/zh/en）；uiLocale 是解析结果。
                uiLanguage: 'zh',
                theme: 'light',
                orientation: 'portrait',
                engineDataReady: { pinyin: true, 'double-pinyin': true, japanese: true, french: true, russian: true },
            },
            overrides,
        );
        this.context.window.Feelime.onBridgeHello(payload);
    }

    // ---- panel payload injectors (FeelimeService pushes these after a get*)
    clipboard(items) {
        this.context.window.Feelime.onClipboard({ items });
    }

    favorites(items) {
        this.context.window.Feelime.onFavorites({ items });
    }

    engineState(payload) {
        this.context.window.Feelime.onEngineState(payload);
    }

    assoc(words) {
        this.context.window.Feelime.onAssoc({ words });
    }

    nativeState(payload) {
        this.context.window.Feelime.onNativeState(payload);
    }

    editorInfo(payload) {
        this.context.window.Feelime.onEditorInfo(payload);
    }

    // ---- DOM helpers
    $(id) {
        return this.document.getElementById(id);
    }

    key(char) {
        return this.document.querySelectorAll(`[data-key="${char}"]`)[0];
    }

    /** 快捷设置方块（tile 网格渲染后的首页）：按名称行取块。 */
    tile(label) {
        return [...this.document.querySelectorAll('.qs-tile')]
            .find(el => (el.querySelector('.qs-name') || { textContent: '' }).textContent === label);
    }

    tileNames() {
        return [...this.document.querySelectorAll('.qs-tile .qs-name')].map(el => el.textContent);
    }

    // ---- touch helpers
    dispatch(el, type, x, y, details = {}) {
        return fakeDispatch(el, type, x, y, details);
    }

    touchDown(el, x = 20, y = 20) {
        const event = this.dispatch(el, 'touchstart', x, y);
        el._touchPrevented = !!(event && event.defaultPrevented);
    }

    touchUp(el, x = 20, y = 20) {
        this.dispatch(el, 'touchend', x, y);
        // Browsers synthesize a click after touchend unless the touchstart
        // was preventDefault()-ed (keys do that and click manually).
        if (el && !el._touchPrevented) el.click();
    }

    touchCancel(el) {
        this.dispatch(el, 'touchcancel', 20, 20);
    }

    tap(el) {
        this.touchDown(el);
        this.touchUp(el);
    }

    move(el, x, y) {
        this.dispatch(el, 'touchmove', x, y);
    }

    /**
     * Simulated horizontal pan across `el` (review follow-up).
     * Browser semantics under test: if any listener preventDefault()s the
     * touchstart or touchmove, the synthetic scroll is cancelled and
     * scrollLeft stays put; otherwise the nearest scrollable ancestor
     * scrolls by -dx (dragging left reveals content on the right).
     * Returns {cancelled, scrollLeft}.
     */
    drag(el, dx, x = 60, y = 20) {
        const start = this.dispatch(el, 'touchstart', x, y);
        const move = this.dispatch(el, 'touchmove', x + dx, y);
        const cancelled = !!(start && start.defaultPrevented) ||
            !!(move && move.defaultPrevented);
        let scroller = null;
        if (!cancelled) {
            scroller = el;
            while (scroller && !scroller._scrollable) scroller = scroller.parentNode;
            if (scroller) scroller.scrollLeft += -dx;
        }
        this.dispatch(el, 'touchend', x + dx, y);
        return { cancelled, scrollLeft: scroller ? scroller.scrollLeft : 0 };
    }
}

// Shared event dispatcher (used by KeyboardWorld.dispatch for touch
// synthesis and by FakeElement.click for synthetic clicks): walks the
// ancestor chain capture-first, honors stopPropagation, then bubbles.
function fakeDispatch(el, type, x, y, details = {}) {
    const event = {
        target: el,
        defaultPrevented: false,
        touches: [{ clientX: x, clientY: y }],
        changedTouches: [{ clientX: x, clientY: y }],
        preventDefault() {
            this.defaultPrevented = true;
        },
        stopPropagation() {
            this.propagationStopped = true;
        },
        stopImmediatePropagation() {
            this.propagationStopped = true;
            this.immediateStopped = true;
        },
        ...details,
    };
    const path = [];
    let node = el;
    while (node) {
        path.push(node);
        node = node.parentNode;
    }
    const run = listeners => {
        for (const l of listeners) {
            if (event.immediateStopped) return;
            l.handler(event);
            if (event.propagationStopped) return;
        }
    };
    // capture phase: root -> target
    run(path.slice().reverse().flatMap(ancestor =>
        ancestor.listeners.filter(l => l.type === type && l.capture)));
    if (event.propagationStopped) return event;
    // bubble phase: target -> root
    run(path.flatMap(ancestor =>
        ancestor.listeners.filter(l => l.type === type && !l.capture)));
    return event;
}

module.exports = { KeyboardWorld, FakeElement, FakeClock, MockNative, loadDocument, KEYBOARD_VERSION };

// Standalone run: quick smoke of harness plumbing.
if (require.main === module) {
    const world = new KeyboardWorld().build();
    world.hello();
    console.log('harness smoke: keys =', world.document.querySelectorAll('[data-key]').length);
}
