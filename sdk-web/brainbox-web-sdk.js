/*!
 * Brainbox Web SDK v2.0.0
 * Framework-agnostic chat widget + headless API client for the Brainbox AI backend.
 * Works on plain HTML sites, WordPress, Odoo and any JavaScript app. No dependencies.
 *
 *   const bb = Brainbox.init({ apiUrl: 'https://api.example.com', apiKey: '...', tenantId: '...' });
 *
 * v1 globals (BrainboxWebSDK / BrainboxWebWidget) keep working through a thin
 * compatibility layer at the bottom of this file.
 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.Brainbox = api;
    root.BrainboxWebSDK = api.BrainboxWebSDK;
    root.BrainboxWebWidget = api.BrainboxWebWidget;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (global) {
  'use strict';

  var VERSION = '2.0.0';
  var HAS_DOM = typeof document !== 'undefined';
  var MODES = ['floating', 'sidebar', 'inline', 'page'];
  var DEFAULT_TIMEOUT = 200000; // /api/chat can take ~180s
  var MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  var EMOJIS = ['\u{1F600}', '\u{1F602}', '\u{1F60D}', '\u{1F44D}', '\u{1F64F}', '\u{1F389}', '\u{1F525}', '❤️', '\u{1F622}', '\u{1F914}', '\u{1F44F}', '✅'];
  var DEFAULT_PRIMARY = '#b93fff';

  /* ======================================================================
   * Small utilities
   * ==================================================================== */

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]';
  }

  function deepMerge(base, extra) {
    var out = Object.assign({}, base);
    if (!extra) return out;
    Object.keys(extra).forEach(function (key) {
      var value = extra[key];
      if (value === undefined) return;
      if (isPlainObject(value) && isPlainObject(base[key])) {
        out[key] = deepMerge(base[key], value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  var idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || 'bb') + '-' + Date.now().toString(36) + '-' + idCounter;
  }

  function hexToRgb(hex) {
    var m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mixRgb(c, target, amount) {
    var r = Math.round(c.r + (target.r - c.r) * amount);
    var g = Math.round(c.g + (target.g - c.g) * amount);
    var b = Math.round(c.b + (target.b - c.b) * amount);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  function mixRgbObj(c, target, amount) {
    return { r: Math.round(c.r + (target.r - c.r) * amount), g: Math.round(c.g + (target.g - c.g) * amount), b: Math.round(c.b + (target.b - c.b) * amount) };
  }

  function rgba(c, a) {
    return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')';
  }

  /** Derived palette from the primary color (works for any hex; falls back to the raw value). */
  function palette(primary) {
    var c = hexToRgb(primary);
    if (!c) {
      return { light: primary, dark: primary, bodyTop: 'rgba(255,255,255,.55)', bodyBottom: 'rgba(0,0,0,.03)', a06: 'rgba(0,0,0,.04)', a08: 'rgba(0,0,0,.05)', a12: 'rgba(0,0,0,.07)', a18: 'rgba(0,0,0,.12)', a30: 'rgba(0,0,0,.2)', a45: 'rgba(0,0,0,.3)' };
    }
    var isDefault = String(primary).toLowerCase() === DEFAULT_PRIMARY;
    return {
      light: isDefault ? '#efc3ff' : mixRgb(c, { r: 255, g: 255, b: 255 }, 0.7),
      dark: isDefault ? '#8120d2' : mixRgb(c, { r: 0, g: 0, b: 0 }, 0.28),
      bodyTop: isDefault ? 'rgba(255,250,255,.7)' : 'rgba(255,255,255,.55)',
      bodyBottom: isDefault ? 'rgba(249,230,255,.72)' : rgba(mixRgbObj(c, { r: 255, g: 255, b: 255 }, 0.86), 0.72),
      a06: rgba(c, 0.06), a08: rgba(c, 0.08), a12: rgba(c, 0.12), a18: rgba(c, 0.18), a30: rgba(c, 0.3), a45: rgba(c, 0.45)
    };
  }

  function px(v, fallback) {
    if (typeof v === 'number' && isFinite(v)) return v + 'px';
    if (typeof v === 'string' && v.trim()) return /^\d+(\.\d+)?$/.test(v.trim()) ? v.trim() + 'px' : v.trim();
    return fallback;
  }

  function toNumber(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  /** Parse backend timestamps. Timezone-less ISO strings are treated as UTC (FastAPI default). */
  function parseTime(value) {
    if (value == null || value === '') return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    var s = String(value);
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
    var t = Date.parse(s);
    return isNaN(t) ? Date.now() : t;
  }

  function formatTime(ts, locale) {
    try {
      var d = new Date(ts);
      var now = new Date();
      var sameDay = d.toDateString() === now.toDateString();
      var opts = sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      return new Intl.DateTimeFormat(locale || undefined, opts).format(d);
    } catch (e) {
      return '';
    }
  }

  function initials(name, fallback) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback || 'You';
    return parts.slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  }

  function prefersReducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function safeStorage() {
    try {
      var s = global.localStorage;
      var k = '__bb_web_test__';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (e) {
      return null;
    }
  }

  function resolveElement(target) {
    if (!HAS_DOM || !target) return null;
    if (typeof target === 'string') {
      try {
        return document.querySelector(target) || document.getElementById(target.replace(/^#/, ''));
      } catch (e) {
        return document.getElementById(target.replace(/^#/, ''));
      }
    }
    return target && target.nodeType === 1 ? target : null;
  }

  function copyText(text) {
    if (global.navigator && navigator.clipboard && global.isSecureContext !== false) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  /* ======================================================================
   * DOM helpers (never use innerHTML with dynamic content)
   * ==================================================================== */

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else if (key === 'style' && isPlainObject(value)) Object.assign(node.style, value);
        else node.setAttribute(key, value === true ? '' : String(value));
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return node;
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* Lucide-style 24x24 stroke icons. Each entry: list of [tag, attrs]. */
  var ICONS = {
    x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
    paperclip: [['path', { d: 'm21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l8.8-8.8a4 4 0 0 1 5.7 5.7l-8.9 8.8a2 2 0 1 1-2.8-2.8l8.1-8.1' }]],
    smile: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M8 14s1.5 2 4 2 4-2 4-2' }], ['path', { d: 'M9 9h.01' }], ['path', { d: 'M15 9h.01' }]],
    search: [['path', { d: 'm21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z' }]],
    send: [['path', { d: 'm22 2-7 20-4-9-9-4Z' }], ['path', { d: 'M22 2 11 13' }]],
    chat: [['path', { d: 'M21 12a8 8 0 0 1-8 8H7l-4 3 1.3-5.1A8 8 0 1 1 21 12Z' }], ['path', { d: 'm14.5 7.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z' }]],
    newchat: [['path', { d: 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }], ['path', { d: 'M18.4 2.6a1 1 0 0 1 3 3l-9 9a2 2 0 0 1-.85.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z' }]],
    history: [['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }], ['path', { d: 'M3 3v5h5' }], ['path', { d: 'M12 7v5l4 2' }]],
    dock: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['path', { d: 'M15 3v18' }], ['path', { d: 'm8 9 3 3-3 3' }]],
    undock: [['path', { d: 'M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4' }], ['rect', { x: 12, y: 13, width: 10, height: 7, rx: 2 }]],
    expand: [['path', { d: 'M15 3h6v6' }], ['path', { d: 'M9 21H3v-6' }], ['path', { d: 'M21 3l-7 7' }], ['path', { d: 'M3 21l7-7' }]],
    copy: [['rect', { x: 8, y: 8, width: 14, height: 14, rx: 2 }], ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }]],
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
    refresh: [['path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }]],
    alert: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]],
    file: [['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }], ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }]],
    back: [['path', { d: 'm12 19-7-7 7-7' }], ['path', { d: 'M19 12H5' }]],
    menu: [['path', { d: 'M4 6h16' }], ['path', { d: 'M4 12h16' }], ['path', { d: 'M4 18h16' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    download: [['path', { d: 'M12 3v12' }], ['path', { d: 'm7 10 5 5 5-5' }], ['path', { d: 'M5 21h14' }]],
    sparkle: [['path', { d: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z' }], ['path', { d: 'm5 17 .8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8Z' }]],
    bulb: [['path', { d: 'M9 18h6' }], ['path', { d: 'M10 22h4' }], ['path', { d: 'M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2Z' }]],
    pie: [['path', { d: 'M21 12a9 9 0 1 1-9-9v9Z' }], ['path', { d: 'M13 3.1A9 9 0 0 1 20.9 11H13Z' }]],
    question: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7' }], ['path', { d: 'M12 17h.01' }]]
  };

  function icon(name, size, stroke) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size || 20));
    svg.setAttribute('height', String(size || 20));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(stroke || 2));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'bb-web-icon');
    (ICONS[name] || ICONS.chat).forEach(function (shape) {
      var el = document.createElementNS(ns, shape[0]);
      Object.keys(shape[1]).forEach(function (k) { el.setAttribute(k, String(shape[1][k])); });
      svg.appendChild(el);
    });
    return svg;
  }

  /* ======================================================================
   * Safe markdown-lite (parse to tokens, render with DOM APIs only)
   * ==================================================================== */

  var SAFE_URL = /^(https?:\/\/|mailto:)[^\s]+$/i;
  var INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^\s)]+\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]])|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g;

  function safeUrl(url) {
    return SAFE_URL.test(url || '') ? url : null;
  }

  function parseInline(text) {
    var out = [];
    var src = String(text || '');
    var last = 0;
    var re = new RegExp(INLINE_RE.source, 'g');
    var m;
    while ((m = re.exec(src))) {
      if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
      var tok = m[0];
      if (m[1]) {
        out.push({ t: 'code', v: tok.slice(1, -1) });
      } else if (m[2]) {
        out.push({ t: 'b', v: tok.slice(2, -2) });
      } else if (m[3]) {
        var lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        var href = lm && safeUrl(lm[2]);
        out.push(href ? { t: 'a', v: lm[1], href: href } : { t: 'text', v: tok });
      } else if (m[4]) {
        var bare = safeUrl(tok);
        out.push(bare ? { t: 'a', v: tok, href: bare } : { t: 'text', v: tok });
      } else if (m[5]) {
        var before = src[m.index - 1];
        if (tok[0] === '_' && before && /\w/.test(before)) out.push({ t: 'text', v: tok });
        else out.push({ t: 'i', v: tok.slice(1, -1) });
      }
      last = m.index + tok.length;
    }
    if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
    return out;
  }

  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return parseInline(c.trim()); });
  }

  function parseMarkdown(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var blocks = [];
    var para = [];
    var list = null;
    function flushPara() {
      if (para.length) { blocks.push({ type: 'p', lines: para.map(parseInline) }); para = []; }
    }
    function flushList() {
      if (list) { blocks.push(list); list = null; }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
      if (fence) {
        flushPara(); flushList();
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
        blocks.push({ type: 'code', lang: fence[1] || '', text: code.join('\n') });
        continue;
      }
      if (!line.trim()) { flushPara(); flushList(); continue; }
      var heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (heading) {
        flushPara(); flushList();
        blocks.push({ type: 'h', level: heading[1].length, inline: parseInline(heading[2]) });
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        flushPara(); flushList();
        var header = splitRow(line);
        var rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        i--;
        blocks.push({ type: 'table', header: header, rows: rows });
        continue;
      }
      var ul = line.match(/^\s*[-*•+]\s+(.*)$/);
      var ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        var kind = ul ? 'ul' : 'ol';
        if (!list || list.type !== kind) {
          flushList();
          list = { type: kind, start: ol ? (parseInt(ol[1], 10) || 1) : 1, items: [] };
        }
        list.items.push(parseInline(ul ? ul[1] : ol[2]));
        continue;
      }
      if (list && /^\s{2,}\S/.test(line)) {
        var items = list.items;
        items[items.length - 1] = items[items.length - 1].concat([{ t: 'text', v: ' ' }], parseInline(line.trim()));
        continue;
      }
      flushList();
      para.push(line);
    }
    flushPara();
    flushList();
    return blocks;
  }

  function renderInline(tokens) {
    var frag = document.createDocumentFragment();
    tokens.forEach(function (tok) {
      if (tok.t === 'text') frag.appendChild(document.createTextNode(tok.v));
      else if (tok.t === 'b') frag.appendChild(h('strong', { text: tok.v }));
      else if (tok.t === 'i') frag.appendChild(h('em', { text: tok.v }));
      else if (tok.t === 'code') frag.appendChild(h('code', { class: 'bb-web-icode', text: tok.v }));
      else if (tok.t === 'a') frag.appendChild(h('a', { href: tok.href, target: '_blank', rel: 'noopener noreferrer nofollow', text: tok.v }));
    });
    return frag;
  }

  /** Render markdown-lite text into a detached element. Exposed as Brainbox.renderMarkdown. */
  function renderMarkdown(text) {
    var root = h('div', { class: 'bb-web-md' });
    parseMarkdown(text).forEach(function (block) {
      if (block.type === 'p') {
        var p = h('p');
        block.lines.forEach(function (inline, idx) {
          if (idx > 0) p.appendChild(h('br'));
          p.appendChild(renderInline(inline));
        });
        root.appendChild(p);
      } else if (block.type === 'h') {
        root.appendChild(h('div', { class: 'bb-web-md-h bb-web-md-h' + block.level, role: 'heading', 'aria-level': block.level }, renderInline(block.inline)));
      } else if (block.type === 'ul' || block.type === 'ol') {
        var listEl = h(block.type, { class: 'bb-web-md-list', start: block.type === 'ol' && block.start !== 1 ? block.start : null });
        block.items.forEach(function (inline) { listEl.appendChild(h('li', null, renderInline(inline))); });
        root.appendChild(listEl);
      } else if (block.type === 'code') {
        var label = h('span', { text: 'Copy' });
        var copyIcon = icon('copy', 13);
        var btn = h('button', { type: 'button', class: 'bb-web-code-copy', 'aria-label': 'Copy code' }, [copyIcon, label]);
        btn.addEventListener('click', function () {
          copyText(block.text).then(function () {
            label.textContent = 'Copied';
            btn.setAttribute('aria-label', 'Copied');
            btn.replaceChild(icon('check', 13), btn.firstChild);
            setTimeout(function () {
              label.textContent = 'Copy';
              btn.setAttribute('aria-label', 'Copy code');
              btn.replaceChild(icon('copy', 13), btn.firstChild);
            }, 1600);
          });
        });
        root.appendChild(h('div', { class: 'bb-web-code' }, [
          h('div', { class: 'bb-web-code-head' }, [h('span', { text: block.lang || 'code' }), btn]),
          h('pre', null, h('code', { text: block.text }))
        ]));
      } else if (block.type === 'table') {
        var thead = h('thead', null, h('tr', null, block.header.map(function (cell) { return h('th', null, renderInline(cell)); })));
        var tbody = h('tbody', null, block.rows.map(function (row) {
          return h('tr', null, row.map(function (cell) { return h('td', null, renderInline(cell)); }));
        }));
        root.appendChild(h('div', { class: 'bb-web-table-wrap' }, h('table', { class: 'bb-web-table' }, [thead, tbody])));
      }
    });
    return root;
  }

  /* ======================================================================
   * Errors
   * ==================================================================== */

  var NETWORK_MESSAGE = "Can't reach the assistant right now. Please check your connection and try again.";

  function BrainboxError(message, info) {
    var err = new Error(message);
    Object.setPrototypeOf(err, BrainboxError.prototype);
    err.name = 'BrainboxError';
    info = info || {};
    err.status = info.status || 0;
    err.code = info.code || 'error';
    err.detail = info.detail;
    err.retryable = info.retryable !== false;
    return err;
  }
  BrainboxError.prototype = Object.create(Error.prototype);
  BrainboxError.prototype.constructor = BrainboxError;

  function detailText(detail) {
    if (!detail) return '';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map(function (d) {
        if (!d) return '';
        if (typeof d === 'string') return d;
        var where = Array.isArray(d.loc) ? d.loc.filter(function (x) { return x !== 'body'; }).join('.') : '';
        return (d.msg || d.message || '') + (where ? ' (' + where + ')' : '');
      }).filter(Boolean).join('; ');
    }
    if (typeof detail === 'object') return detail.msg || detail.message || '';
    return '';
  }

  function isPlainSentence(s) {
    return typeof s === 'string' && s.length > 0 && s.length <= 220 && !/^\s*[[{<]/.test(s) && !/traceback|exception|sqlalchemy|errno/i.test(s);
  }

  function friendlyMessage(status, detail, action) {
    var text = detailText(detail);
    if (status === 401) return "The assistant couldn't verify this website. Please check the API key configuration.";
    if (status === 403) return isPlainSentence(text) && text.length < 120 ? text : "You don't have access to the assistant.";
    if (status === 404) return action === 'session' ? 'This conversation no longer exists.' : 'The assistant service was not found. Please check the apiUrl setting.';
    if (status === 408 || status === 504) return 'The assistant took too long to answer. Please try again.';
    if (status === 413) return 'That file is too large to upload.';
    if (status === 429) return 'The assistant is busy right now. Please wait a moment and try again.';
    if (status >= 500) return 'The assistant ran into a problem. Please try again in a moment.';
    if (status === 422) return text ? 'Some request details were invalid: ' + (isPlainSentence(text) ? text : 'please try again.') : 'Some request details were invalid.';
    if (isPlainSentence(text)) return text;
    return 'Something went wrong. Please try again.';
  }

  /* ======================================================================
   * Headless API client
   * ==================================================================== */

  class Client {
    constructor(options) {
      var o = options || {};
      this.apiUrl = String(o.apiUrl == null ? '' : o.apiUrl).replace(/\/+$/, '');
      this.apiKey = o.apiKey || null;
      this.tenantId = o.tenantId || null;
      this.user = isPlainObject(o.user) ? Object.assign({}, o.user) : {};
      this.headers = isPlainObject(o.headers) ? Object.assign({}, o.headers) : {};
      this.credentials = o.credentials || 'same-origin';
      this.timeout = toNumber(o.timeout, DEFAULT_TIMEOUT);
    }

    /** Body fields shared by all calls. tenant_id / user_id only when configured (a proxy may inject them). */
    _scope(extra, withName) {
      var out = {};
      if (this.tenantId) out.tenant_id = this.tenantId;
      if (this.user && this.user.id != null && this.user.id !== '') out.user_id = String(this.user.id);
      if (withName && this.user && this.user.name) out.user_name = String(this.user.name);
      return Object.assign(out, extra || {});
    }

    /**
     * Low-level request. Throws BrainboxError with a user-friendly `message`.
     * opts: { body, form, query, signal, timeout, action }
     */
    async request(method, path, opts) {
      opts = opts || {};
      var url = this.apiUrl + path;
      if (opts.query) {
        var qs = Object.keys(opts.query).filter(function (k) {
          return opts.query[k] != null && opts.query[k] !== '';
        }).map(function (k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(opts.query[k]);
        }).join('&');
        if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
      }
      var headers = Object.assign({ Accept: 'application/json' }, this.headers);
      if (this.apiKey) headers.Authorization = 'Bearer ' + this.apiKey;
      var body;
      if (opts.form) {
        body = opts.form;
      } else if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.body);
      }

      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timedOut = false;
      var timer = ctrl ? setTimeout(function () { timedOut = true; ctrl.abort(); }, opts.timeout || this.timeout) : null;
      var external = opts.signal;
      var onAbort = function () { if (ctrl) ctrl.abort(); };
      if (external) {
        if (external.aborted) onAbort();
        else external.addEventListener('abort', onAbort);
      }

      var res;
      var raw;
      try {
        res = await fetch(url, { method: method, headers: headers, body: body, credentials: this.credentials, signal: ctrl ? ctrl.signal : undefined });
        raw = await res.text();
      } catch (err) {
        if (timedOut) throw BrainboxError('The assistant took too long to answer. Please try again.', { code: 'timeout' });
        if ((ctrl && ctrl.signal.aborted) || (err && err.name === 'AbortError')) throw BrainboxError('Request cancelled.', { code: 'aborted', retryable: false });
        throw BrainboxError(NETWORK_MESSAGE, { code: 'network' });
      } finally {
        if (timer) clearTimeout(timer);
        if (external) external.removeEventListener('abort', onAbort);
      }

      var data = null;
      if (raw) {
        try { data = JSON.parse(raw); } catch (e) { data = null; }
      }
      if (!res.ok) {
        var detail = data && typeof data === 'object' ? data.detail : undefined;
        throw BrainboxError(friendlyMessage(res.status, detail, opts.action), {
          status: res.status,
          code: 'http_' + res.status,
          detail: detail,
          retryable: res.status >= 500 || res.status === 408 || res.status === 429
        });
      }
      if (data === null || typeof data !== 'object') {
        throw BrainboxError('The assistant sent an unexpected response. Please try again.', { status: res.status, code: 'bad_response' });
      }
      return data;
    }

    /** POST /api/chat -> { response, reasoning, search_results, session_id } */
    async chat(question, sessionId, context, opts) {
      var q = String(question == null ? '' : question);
      if (context) q = 'Context:\n' + String(context) + '\n\nQuestion:\n' + q;
      var payload = this._scope({ question: q }, true);
      if (sessionId) payload.session_id = sessionId;
      var data = await this.request('POST', '/api/chat', { body: payload, signal: opts && opts.signal, timeout: opts && opts.timeout, action: 'chat' });
      data.response = data.response == null ? '' : String(data.response);
      return data;
    }

    /** POST /api/chat/sessions -> { today, yesterday, this_week, older } (always normalized) */
    async listSessions(opts) {
      var data = await this.request('POST', '/api/chat/sessions', { body: this._scope(), signal: opts && opts.signal, action: 'sessions' });
      return normalizeSessions(data);
    }

    /** GET /api/chat/session/{id}/messages */
    async getSessionMessages(sessionId, opts) {
      var scope = this._scope();
      var data = await this.request('GET', '/api/chat/session/' + encodeURIComponent(sessionId) + '/messages', {
        query: { tenant_id: scope.tenant_id, user_id: scope.user_id },
        signal: opts && opts.signal,
        action: 'session'
      });
      data.messages = Array.isArray(data.messages) ? data.messages : [];
      return data;
    }

    /** POST /api/chat/session */
    async createSession(title) {
      var body = this._scope({}, true);
      if (title) body.title = String(title);
      return this.request('POST', '/api/chat/session', { body: body, action: 'create' });
    }

    _upload(path, field, file, sessionId, opts) {
      var form = new FormData();
      form.append(field, file, file && file.name ? file.name : 'upload');
      var scope = this._scope();
      if (scope.tenant_id) form.append('tenant_id', scope.tenant_id);
      if (scope.user_id) form.append('user_id', scope.user_id);
      if (sessionId) form.append('session_id', sessionId);
      return this.request('POST', path, { form: form, signal: opts && opts.signal, action: 'upload' });
    }

    /** POST /api/chat/upload/file (multipart field "file") */
    uploadFile(file, sessionId, opts) {
      return this._upload('/api/chat/upload/file', 'file', file, sessionId, opts);
    }

    /** POST /api/chat/upload/image (multipart field "image") */
    uploadImage(file, sessionId, opts) {
      return this._upload('/api/chat/upload/image', 'image', file, sessionId, opts);
    }

    /** GET /api/health */
    health() {
      return this.request('GET', '/api/health', { action: 'health' });
    }
  }

  var GROUPS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This week' },
    { key: 'older', label: 'Older' }
  ];

  function normalizeSessions(data) {
    var out = { today: [], yesterday: [], this_week: [], older: [] };
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.sessions) ? data.sessions : null);
    if (list) {
      var now = new Date();
      var startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      list.forEach(function (s) {
        var t = parseTime(s.created_at);
        if (t >= startToday) out.today.push(s);
        else if (t >= startToday - 86400000) out.yesterday.push(s);
        else if (t >= startToday - 7 * 86400000) out.this_week.push(s);
        else out.older.push(s);
      });
      return out;
    }
    GROUPS.forEach(function (g) {
      out[g.key] = data && Array.isArray(data[g.key]) ? data[g.key].filter(function (s) { return s && s.session_id; }) : [];
    });
    return out;
  }

  /* ======================================================================
   * Styles (injected once, every selector scoped under .bb-web-root)
   * ==================================================================== */

  var CSS = [
    /* --- root, theme tokens and host-CSS resets --- */
    '.bbr{--bb-primary:#b93fff;--bb-primary-light:#efc3ff;--bb-primary-dark:#8120d2;--bb-primary-a06:rgba(185,63,255,.06);--bb-primary-a08:rgba(185,63,255,.08);--bb-primary-a12:rgba(185,63,255,.12);--bb-primary-a18:rgba(185,63,255,.18);--bb-primary-a30:rgba(185,63,255,.3);--bb-primary-a45:rgba(185,63,255,.45);--bb-panel:#fbf1ff;--bb-body-top:rgba(255,250,255,.7);--bb-body-bottom:rgba(249,230,255,.72);--bb-ink:#08080a;--bb-radius:22px;--bb-muted:rgba(12,12,16,.54);--bb-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--bb-z:9999;--bb-w:360px;--bb-h:560px;--bb-ox:24px;--bb-oy:24px;--bb-sb-w:380px;--bb-sb-top:0px;',
    'font-family:var(--bb-font);font-size:13px;font-weight:400;line-height:1.45;color:var(--bb-ink);letter-spacing:normal;text-align:left;text-transform:none;text-indent:0;word-spacing:normal;-webkit-font-smoothing:antialiased;direction:ltr;}',
    '.bbr *,.bbr *::before,.bbr *::after{box-sizing:border-box;}',
    '.bbr h1,.bbr h2,.bbr h3,.bbr p,.bbr ul,.bbr ol,.bbr li,.bbr form,.bbr label,.bbr pre,.bbr table{margin:0;padding:0;font-family:inherit;letter-spacing:normal;text-transform:none;}',
    '.bbr h1,.bbr h2,.bbr h3{color:inherit;}',
    '.bbr button,.bbr input,.bbr textarea{font-family:inherit;font-size:inherit;line-height:normal;letter-spacing:normal;text-transform:none;margin:0;color:inherit;}',
    '.bbr button{-webkit-appearance:none;appearance:none;background:none;border:0;border-radius:0;padding:0;min-width:0;min-height:0;width:auto;height:auto;box-shadow:none;text-shadow:none;cursor:pointer;font-weight:inherit;-webkit-tap-highlight-color:transparent;transition:transform 120ms ease,box-shadow 160ms ease,background-color 160ms ease,border-color 160ms ease,color 160ms ease,filter 160ms ease,opacity 160ms ease;}',
    '.bbr button:hover:not(:disabled){filter:brightness(.98);}',
    '.bbr button:active:not(:disabled){transform:translateY(1px) scale(.96);filter:brightness(.94);}',
    '.bbr button:focus{outline:none;}',
    '.bbr button:focus-visible,.bbr a:focus-visible{outline:2px solid var(--bb-primary);outline-offset:2px;}',
    '.bbr button:disabled{cursor:not-allowed;opacity:.55;}',
    '.bbr input,.bbr textarea{box-shadow:none;border-radius:0;}',
    '.bbr svg.bb-web-icon{display:block;flex:0 0 auto;fill:none;overflow:visible;vertical-align:middle;}',
    '.bbr img{max-width:100%;border:0;}',
    '.bbr a{color:var(--bb-primary);}',
    '.bbr .bb-web-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',

    /* --- host containers --- */
    '.bbr.bb-web-host{position:fixed;top:0;left:0;width:0;height:0;z-index:var(--bb-z);}',
    '.bbr .bb-web-float{position:fixed;bottom:var(--bb-oy);right:var(--bb-ox);display:flex;flex-direction:column;align-items:flex-end;gap:16px;pointer-events:none;z-index:2;}',
    '.bbr.bb-web-left .bb-web-float{right:auto;left:var(--bb-ox);align-items:flex-start;}',
    '.bbr .bb-web-float>*{pointer-events:auto;}',
    '.bbr .bb-web-window{width:var(--bb-w);max-width:calc(100vw - 2 * var(--bb-ox));animation:bb-web-pop 180ms ease-out;}',
    '.bbr .bb-web-window .bb-web-panel{height:min(var(--bb-h),calc(100vh - var(--bb-oy) - 86px));}',
    '.bbr .bb-web-is-closed{display:none!important;}',
    '@keyframes bb-web-pop{from{opacity:0;transform:translateY(12px) scale(.98);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-slide{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-sheet{from{opacity:.6;transform:translateY(40px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}',

    /* --- launcher --- */
    '.bbr .bb-web-launcher{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-width:104px;height:46px;padding:0 18px 0 15px;border-radius:999px;color:#fff;font-size:15px;font-weight:760;white-space:nowrap;background:radial-gradient(circle at 20% 20%,var(--bb-primary-light),var(--bb-primary) 50%,var(--bb-primary-dark) 100%);box-shadow:0 18px 40px rgba(92,28,135,.22);}',
    '.bbr .bb-web-launcher:hover:not(:disabled){box-shadow:0 0 36px var(--bb-primary-a45),0 16px 38px rgba(92,28,135,.24);}',
    '.bbr .bb-web-launcher.is-icon{min-width:0;width:56px;height:56px;padding:0;background:var(--bb-primary);}',
    '.bbr .bb-web-launcher.is-gif{min-width:0;width:64px;height:64px;padding:0;overflow:hidden;background:#fff;}',
    '.bbr .bb-web-launcher.is-gif img{width:100%;height:100%;object-fit:cover;display:block;border-radius:999px;}',
    '.bbr .bb-web-launcher.is-open{min-width:0;width:52px;height:52px;padding:0;background:#050506;color:#fff;}',

    /* --- panel (omago) --- */
    '.bbr .bb-web-panel{width:100%;min-height:0;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--bb-radius);border:2px solid rgba(255,255,255,.82);background:var(--bb-panel);box-shadow:0 34px 90px rgba(82,35,108,.24),inset 0 0 0 1px rgba(255,255,255,.7);color:var(--bb-ink);font-size:13px;outline:none;}',
    '.bbr .bb-web-header{flex:0 0 auto;min-height:68px;padding:12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.88);background:rgba(255,255,255,.36);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);}',
    '.bbr .bb-web-header-copy{flex:1;min-width:0;}',
    '.bbr .bb-web-title{margin:0;font-size:clamp(15px,2.2vw,18px);line-height:1.15;font-weight:820;color:#0a0a0d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-subtitle{margin-top:5px;color:rgba(9,9,12,.54);font-size:11px;line-height:1.25;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-header-actions{display:flex;align-items:center;gap:5px;flex:0 0 auto;}',
    '.bbr .bb-web-orb{position:relative;display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border-radius:999px;overflow:hidden;background:radial-gradient(circle at 36% 28%,rgba(255,255,255,.95) 0 12%,transparent 13%),radial-gradient(circle at 50% 50%,var(--bb-primary-light) 0 14%,var(--bb-primary) 42%,var(--bb-primary-dark) 66%,var(--bb-primary-a06) 71%);}',
    '.bbr .bb-web-orb::before{content:"";width:45%;height:45%;border-radius:999px;background:#fff;clip-path:polygon(0 50%,53% 15%,100% 0,100% 100%,53% 85%);}',
    '.bbr .bb-web-orb.has-image{background:#fff;}',
    '.bbr .bb-web-orb.has-image::before{display:none;}',
    '.bbr .bb-web-orb img{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block;}',
    '.bbr .bb-web-orb.is-logo{width:38px;height:38px;}',
    '.bbr .bb-web-hbtn,.bbr .bb-web-close{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;flex:0 0 auto;padding:0;}',
    '.bbr .bb-web-hbtn{color:#1a1020;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8);}',
    '.bbr .bb-web-hbtn:hover:not(:disabled),.bbr .bb-web-hbtn.is-active{background:#fff;color:var(--bb-primary);}',
    '.bbr .bb-web-close{width:34px;height:34px;color:#fff;background:#050506;}',
    '.bbr .bb-web-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px;background:radial-gradient(circle at 86% 42%,rgba(255,255,255,.7),transparent 30%),linear-gradient(180deg,var(--bb-body-top),var(--bb-body-bottom));}',
    '.bbr .bb-web-transcript{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:4px;scrollbar-width:thin;scrollbar-color:var(--bb-primary-a18) transparent;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar{width:7px;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar-thumb{background:var(--bb-primary-a18);border-radius:999px;}',
    '.bbr .bb-web-log{display:grid;gap:12px;padding-bottom:4px;}',

    /* intro */
    '.bbr .bb-web-intro{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:start;}',
    '.bbr .bb-web-author{display:flex;align-items:baseline;gap:8px;margin:8px 0;font-weight:820;font-size:15px;color:#0b0b0f;}',
    '.bbr .bb-web-author time{color:rgba(12,12,16,.45);font-size:11px;font-weight:700;}',
    '.bbr .bb-web-intro-bubble{width:fit-content;max-width:min(100%,252px);padding:9px 11px;border-radius:0 14px 14px 14px;background:rgba(255,255,255,.92);color:rgba(12,12,16,.72);font-size:12.5px;line-height:1.45;font-weight:560;box-shadow:0 12px 28px rgba(142,64,202,.06);overflow-wrap:anywhere;}',
    '.bbr .bb-web-intro-bubble+.bb-web-intro-bubble{margin-top:8px;border-radius:14px;}',
    '.bbr .bb-web-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
    '.bbr .bb-web-pill{max-width:100%;min-height:32px;padding:6px 12px;border:1px solid var(--bb-primary-a18);border-radius:999px;background:rgba(255,255,255,.35);color:var(--bb-primary);font-size:12.5px;font-weight:780;line-height:1.3;text-align:left;box-shadow:inset 0 0 0 1px rgba(255,255,255,.34);}',
    '.bbr .bb-web-pill:hover:not(:disabled){background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),0 8px 20px rgba(156,71,216,.08);}',

    /* messages */
    '.bbr .bb-web-msg{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:start;animation:bb-web-fade 160ms ease-out;}',
    '.bbr .bb-web-msg.is-user{grid-template-columns:minmax(0,1fr) 34px;}',
    '.bbr .bb-web-msg-copy{min-width:0;}',
    '.bbr .bb-web-msg-meta{display:flex;align-items:baseline;gap:7px;margin:0 0 4px;color:rgba(12,12,16,.72);font-size:12px;font-weight:800;}',
    '.bbr .bb-web-msg-meta time{color:rgba(12,12,16,.42);font-size:10.5px;font-weight:700;}',
    '.bbr .bb-web-msg.is-user .bb-web-msg-meta{justify-content:flex-end;}',
    '.bbr .bb-web-bubble{width:fit-content;max-width:92%;padding:8px 11px;border-radius:14px 14px 14px 6px;background:rgba(255,255,255,.94);color:rgba(12,12,16,.78);font-size:13px;line-height:1.5;overflow-wrap:anywhere;box-shadow:0 10px 24px rgba(142,64,202,.05);}',
    '.bbr .bb-web-msg.is-user .bb-web-bubble{margin-left:auto;max-width:86%;border-radius:14px 14px 6px 14px;color:#fff;background:var(--bb-primary);}',
    '.bbr .bb-web-msg.is-failed .bb-web-bubble{opacity:.6;}',
    '.bbr .bb-web-user-text{white-space:pre-wrap;}',
    '.bbr .bb-web-file-chip{display:inline-flex;vertical-align:-3px;margin-right:5px;}',
    '.bbr .bb-web-msg-status{margin-top:4px;font-size:10.5px;font-weight:700;color:rgba(12,12,16,.45);text-align:right;}',
    '.bbr .bb-web-msg-status.is-error{color:#b91c1c;}',
    '.bbr .bb-web-avatar{width:34px;height:34px;border-radius:999px;overflow:hidden;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:800;background:linear-gradient(145deg,#c9b8ad,#9e6f59);}',
    '.bbr .bb-web-avatar img{width:100%;height:100%;object-fit:cover;display:block;}',

    /* markdown */
    '.bbr .bb-web-md p{margin:0 0 8px;}',
    '.bbr .bb-web-md p:last-child{margin-bottom:0;}',
    '.bbr .bb-web-md a{color:var(--bb-primary);text-decoration:underline;text-underline-offset:2px;}',
    '.bbr .bb-web-md strong{font-weight:750;color:rgba(12,12,16,.9);}',
    '.bbr .bb-web-md em{font-style:italic;}',
    '.bbr .bb-web-md-h{font-weight:800;color:#0b0b0f;margin:8px 0 6px;}',
    '.bbr .bb-web-md-h:first-child{margin-top:0;}',
    '.bbr .bb-web-md-h1,.bbr .bb-web-md-h2{font-size:15px;}',
    '.bbr .bb-web-md-h3,.bbr .bb-web-md-h4,.bbr .bb-web-md-h5,.bbr .bb-web-md-h6{font-size:13.5px;}',
    '.bbr .bb-web-md .bb-web-md-list{margin:4px 0 8px;padding-left:20px;}',
    '.bbr .bb-web-md ul.bb-web-md-list{list-style:disc;}',
    '.bbr .bb-web-md ol.bb-web-md-list{list-style:decimal;}',
    '.bbr .bb-web-md .bb-web-md-list li{margin-bottom:3px;display:list-item;}',
    '.bbr .bb-web-md .bb-web-md-list:last-child{margin-bottom:0;}',
    '.bbr .bb-web-icode{padding:1px 5px;border-radius:5px;background:var(--bb-primary-a08);color:var(--bb-primary-dark);font-family:"Fira Code",Menlo,Consolas,monospace;font-size:12px;}',
    '.bbr .bb-web-code{margin:8px 0;border-radius:10px;overflow:hidden;background:#1e1e2e;border:1px solid #2e2e3e;}',
    '.bbr .bb-web-code pre{margin:0;padding:10px 12px;overflow-x:auto;background:transparent;border:0;font-family:"Fira Code",Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:#e4e4f0;white-space:pre;}',
    '.bbr .bb-web-code code{color:inherit;background:transparent;font-family:inherit;padding:0;}',
    '.bbr .bb-web-code-head{display:flex;justify-content:space-between;align-items:center;padding:5px 8px 5px 12px;background:#14141e;color:#9d9db3;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}',
    '.bbr .bb-web-code-copy{display:inline-flex;align-items:center;gap:4px;color:#b8b8d1;font-size:11px;padding:2px 8px;border-radius:6px;text-transform:none;}',
    '.bbr .bb-web-code-copy:hover:not(:disabled){background:rgba(255,255,255,.08);}',
    '.bbr .bb-web-table-wrap{overflow-x:auto;margin:8px 0;}',
    '.bbr .bb-web-table{width:100%;border-collapse:collapse;font-size:12px;}',
    '.bbr .bb-web-table th,.bbr .bb-web-table td{border:1px solid rgba(0,0,0,.1);padding:5px 7px;text-align:left;vertical-align:top;}',
    '.bbr .bb-web-table th{background:rgba(0,0,0,.04);font-weight:700;}',

    /* typing / spinner / misc */
    '.bbr .bb-web-typing{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:14px 14px 14px 6px;background:rgba(255,255,255,.94);width:fit-content;font-size:12.5px;color:#8a8a9a;}',
    '.bbr .bb-web-dots{display:inline-flex;gap:3px;}',
    '.bbr .bb-web-dots i{width:6px;height:6px;border-radius:999px;background:var(--bb-primary);opacity:.35;animation:bb-web-typing 1.1s ease-in-out infinite;}',
    '.bbr .bb-web-dots i:nth-child(2){animation-delay:.15s;}',
    '.bbr .bb-web-dots i:nth-child(3){animation-delay:.3s;}',
    '@keyframes bb-web-typing{0%,80%,100%{opacity:.25;transform:scale(.85);}40%{opacity:1;transform:scale(1);}}',
    '.bbr .bb-web-spinner{display:inline-block;width:13px;height:13px;border-radius:999px;border:2px solid var(--bb-primary-a30);border-top-color:var(--bb-primary);animation:bb-web-spin .8s linear infinite;vertical-align:-2px;margin-right:6px;}',
    '@keyframes bb-web-spin{to{transform:rotate(360deg);}}',
    '.bbr .bb-web-muted{color:var(--bb-muted);font-size:12.5px;}',
    '.bbr .bb-web-center{text-align:center;padding:16px 8px;}',
    '.bbr .bb-web-link{padding:0 4px;color:var(--bb-primary);font-weight:700;text-decoration:underline;}',

    /* error banner */
    '.bbr .bb-web-error{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 8px 8px 10px;border-radius:12px;background:rgba(254,242,242,.95);border:1px solid rgba(220,38,38,.22);color:#b91c1c;font-size:12.5px;line-height:1.35;}',
    '.bbr .bb-web-error-text{flex:1;min-width:0;}',
    '.bbr .bb-web-error-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;background:#b91c1c;color:#fff;font-size:12px;font-weight:700;}',
    '.bbr .bb-web-error-x{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;color:#b91c1c;}',
    '.bbr .bb-web-error-x:hover:not(:disabled){background:rgba(185,28,28,.08);}',
    '.bbr .bb-web-inline-error{color:#b91c1c;font-size:12.5px;padding:10px 4px;}',

    /* history */
    '.bbr .bb-web-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}',
    '.bbr .bb-web-history-head span{font-size:12px;font-weight:800;color:rgba(12,12,16,.6);}',
    '.bbr .bb-web-ghost{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.6);color:var(--bb-primary);font-size:12.5px;font-weight:760;box-shadow:inset 0 0 0 1px rgba(255,255,255,.85);}',
    '.bbr .bb-web-hsearch{display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;margin:0 0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,.6);color:rgba(12,12,16,.5);}',
    '.bbr .bb-web-hsearch input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;padding:0;font-size:12.5px;color:var(--bb-ink);}',
    '.bbr .bb-web-group{margin-bottom:10px;}',
    '.bbr .bb-web-group-label{padding:6px 4px 4px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:rgba(12,12,16,.45);}',
    '.bbr .bb-web-session{width:100%;display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 10px;margin-bottom:4px;border:1px solid transparent;border-radius:12px;background:rgba(255,255,255,.4);color:rgba(12,12,16,.8);font-size:12.5px;font-weight:600;text-align:left;}',
    '.bbr .bb-web-session span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
    '.bbr .bb-web-session:hover:not(:disabled){background:rgba(255,255,255,.8);}',
    '.bbr .bb-web-session.is-active{background:#fff;border-color:var(--bb-primary-a30);color:var(--bb-primary);}',

    /* composer */
    '.bbr .bb-web-composer{flex:0 0 auto;position:relative;padding:10px;border-radius:17px;border:1px solid rgba(255,255,255,.86);background:rgba(255,255,255,.45);box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),0 14px 35px rgba(128,54,180,.05);}',
    '.bbr .bb-web-composer:focus-within{background:rgba(255,255,255,.62);border-color:var(--bb-primary-a30);}',
    '.bbr .bb-web-composer textarea{display:block;width:100%;min-height:30px;max-height:140px;height:30px;padding:2px 2px 6px;border:0;outline:0;resize:none;overflow-y:auto;color:#0d0d10;background:transparent;font-size:13px;line-height:1.4;}',
    '.bbr .bb-web-composer textarea::placeholder{color:rgba(10,10,14,.52);opacity:1;}',
    '.bbr .bb-web-bar{display:flex;align-items:center;gap:6px;}',
    '.bbr .bb-web-tool,.bbr .bb-web-hpill{display:inline-flex;align-items:center;justify-content:center;color:#07070a;background:rgba(255,255,255,.4);}',
    '.bbr .bb-web-tool{width:34px;height:34px;border-radius:999px;padding:0;}',
    '.bbr .bb-web-hpill{height:34px;gap:5px;border-radius:999px;padding:0 11px;font-size:12.5px;font-weight:760;white-space:nowrap;}',
    '.bbr .bb-web-tool:hover:not(:disabled),.bbr .bb-web-hpill:hover:not(:disabled),.bbr .bb-web-hpill.is-active{background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),0 8px 20px rgba(156,71,216,.08);}',
    '.bbr .bb-web-send{margin-left:auto;width:38px;height:38px;border-radius:999px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:radial-gradient(circle at 36% 28%,#c3d9ff,var(--bb-primary) 53%,var(--bb-primary-dark) 100%);}',
    '.bbr .bb-web-send:disabled{opacity:.78;}',
    '.bbr .bb-web-send:hover:not(:disabled){box-shadow:0 0 26px var(--bb-primary-a45),0 12px 28px rgba(92,28,135,.22);}',
    '.bbr .bb-web-file-input{display:none!important;}',
    '.bbr .bb-web-emoji-wrap{position:relative;display:inline-flex;}',
    '.bbr .bb-web-emoji-pop{position:absolute;bottom:42px;left:0;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:10;}',
    '.bbr .bb-web-emoji-pop button{width:32px;height:32px;font-size:18px;line-height:1;border-radius:6px;display:grid;place-items:center;}',
    '.bbr .bb-web-emoji-pop button:hover:not(:disabled){background:rgba(0,0,0,.05);}',

    /* --- sidebar dock --- */
    '.bbr .bb-web-dock{position:fixed;top:var(--bb-sb-top);right:0;bottom:0;width:var(--bb-sb-w);max-width:100vw;display:flex;padding:8px;z-index:1;background:linear-gradient(180deg,var(--bb-primary-a08),var(--bb-primary-a12)),var(--bb-panel);border-left:1px solid var(--bb-primary-a18);}',
    '.bbr .bb-web-dock .bb-web-panel{height:100%;border-radius:18px;box-shadow:0 10px 40px rgba(82,35,108,.14),inset 0 0 0 1px rgba(255,255,255,.7);animation:bb-web-slide 180ms ease-out;}',

    /* --- inline --- */
    '.bbr.bb-web-m-inline{position:relative;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;}',
    '.bbr.bb-web-m-inline .bb-web-panel{flex:1;height:auto;box-shadow:0 16px 40px rgba(82,35,108,.12),inset 0 0 0 1px rgba(255,255,255,.7);}',

    /* --- page (cortex layout) --- */
    '.bbr.bb-web-m-page{position:relative;width:100%;height:100%;min-height:520px;display:flex;}',
    '.bbr .bb-web-page{flex:1;display:flex;min-width:0;min-height:0;overflow:hidden;position:relative;border-radius:20px;background:#f3f3f5;color:#0d0d0f;}',
    '.bbr .bb-web-page-side{width:268px;flex:0 0 268px;display:flex;flex-direction:column;gap:10px;padding:16px 12px;background:#f1f1f2;border-right:1px solid #e5e3ea;min-height:0;}',
    '.bbr .bb-web-page-brand{display:flex;align-items:center;gap:12px;min-height:38px;padding:0 4px;}',
    '.bbr .bb-web-page-logo{width:34px;height:34px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;overflow:hidden;color:#fff;background:var(--bb-primary);}',
    '.bbr .bb-web-page-logo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.bbr .bb-web-page-logo.is-small{width:26px;height:26px;border-radius:9px;}',
    '.bbr .bb-web-page-name{flex:1;min-width:0;font-size:18px;line-height:1.1;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-close{display:none;width:32px;height:32px;border-radius:8px;place-items:center;color:#1c1c1e;}',
    '.bbr .bb-web-newchat{width:100%;height:44px;border-radius:8px;background:#0f0f10;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-size:14px;font-weight:600;box-shadow:0 9px 16px rgba(0,0,0,.08);}',
    '.bbr .bb-web-psearch{position:relative;display:block;}',
    '.bbr .bb-web-psearch .bb-web-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#a5a5ad;}',
    '.bbr .bb-web-psearch input{width:100%;height:40px;border:1px solid #e8e7eb;border-radius:8px;background:rgba(255,255,255,.9);padding:0 12px 0 36px;color:#1d1d20;font-size:14px;outline:none;}',
    '.bbr .bb-web-psearch input:focus{border-color:var(--bb-primary-a45);}',
    '.bbr .bb-web-page-sessions{flex:1;min-height:0;overflow-y:auto;border-top:1px solid #e4e3e8;padding-top:12px;scrollbar-width:thin;}',
    '.bbr .bb-web-page-sessions .bb-web-group-label{color:#aaa7af;font-size:11px;font-weight:600;text-transform:none;letter-spacing:0;padding:0 8px 6px;}',
    '.bbr .bb-web-page-sessions .bb-web-session{background:transparent;border:0;border-radius:6px;min-height:32px;padding:6px 8px;margin-bottom:2px;font-size:14px;font-weight:450;color:#1c1c1f;}',
    '.bbr .bb-web-page-sessions .bb-web-session .bb-web-icon{display:none;}',
    '.bbr .bb-web-page-sessions .bb-web-session:hover:not(:disabled){background:rgba(255,255,255,.75);}',
    '.bbr .bb-web-page-sessions .bb-web-session.is-active{background:var(--bb-primary);color:#fff;}',
    '.bbr .bb-web-profile{margin-top:auto;display:flex;align-items:center;gap:10px;min-height:52px;padding:8px;border:1px solid #e6e5ea;border-radius:8px;background:rgba(255,255,255,.78);box-shadow:0 10px 24px rgba(17,17,17,.04);}',
    '.bbr .bb-web-profile .bb-web-avatar{width:36px;height:36px;background:linear-gradient(135deg,var(--bb-primary-dark),var(--bb-primary-light));}',
    '.bbr .bb-web-profile-copy{min-width:0;flex:1;}',
    '.bbr .bb-web-profile-name{font-size:12px;font-weight:760;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-profile-email{color:#8d8b92;font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-backdrop{display:none;}',
    '.bbr .bb-web-page-stage{flex:1;min-width:0;min-height:0;display:flex;padding:22px;}',
    '.bbr .bb-web-page-card{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:#fff;border:1px solid #ebe9ef;box-shadow:0 18px 45px rgba(17,17,20,.06);padding:12px 16px 16px;}',
    '.bbr .bb-web-page-top{flex:0 0 auto;display:flex;align-items:center;gap:10px;min-height:40px;}',
    '.bbr .bb-web-page-ws{display:inline-flex;align-items:center;gap:8px;min-height:36px;max-width:100%;min-width:0;padding:0 12px 0 6px;border:1px solid #eceaf0;border-radius:8px;background:#fff;font-weight:680;font-size:13px;}',
    '.bbr .bb-web-page-ws span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-tools{margin-left:auto;display:flex;align-items:center;gap:8px;}',
    '.bbr .bb-web-page-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:36px;height:36px;padding:0 10px;border:1px solid #eceaf0;border-radius:8px;background:#fff;color:#151518;font-weight:650;font-size:13px;}',
    '.bbr .bb-web-page-btn:hover:not(:disabled){background:#f6f3fb;border-color:var(--bb-primary-a30);}',
    '.bbr .bb-web-page-menu{display:none;}',
    '.bbr .bb-web-page-scroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:4px 6px 4px 0;scrollbar-width:thin;}',
    '.bbr .bb-web-hero{margin:auto 0 0;padding:24px 0 8px;text-align:center;}',
    '.bbr .bb-web-hero-orb{width:112px;height:112px;margin:0 auto 10px;border-radius:999px;position:relative;overflow:hidden;background:radial-gradient(circle at 35% 26%,rgba(255,255,255,.96) 0 20%,rgba(255,255,255,.2) 40%,transparent 55%),radial-gradient(circle at 58% 64%,var(--bb-primary-a45),var(--bb-primary-a18) 54%,transparent 62%),conic-gradient(from 20deg,var(--bb-primary-a12),var(--bb-primary-dark),var(--bb-primary-light),var(--bb-primary),var(--bb-primary-a12));box-shadow:0 0 34px var(--bb-primary-a45),inset 12px 10px 24px rgba(255,255,255,.72),inset -16px -18px 28px var(--bb-primary-a30);}',
    '.bbr .bb-web-hero-orb img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.bbr .bb-web-hello{margin:0;font-size:clamp(24px,4vw,34px);line-height:1.1;font-weight:780;color:var(--bb-primary);}',
    '.bbr .bb-web-heading{margin:4px 0 0;font-size:clamp(24px,4vw,34px);line-height:1.1;font-weight:760;color:#050505;}',
    '.bbr .bb-web-m-page-log,.bbr .bb-web-page .bb-web-log{width:min(100%,748px);margin:0 auto;gap:16px;}',
    '.bbr .bb-web-page .bb-web-msg{grid-template-columns:32px minmax(0,1fr);gap:12px;}',
    '.bbr .bb-web-page .bb-web-msg.is-user{grid-template-columns:minmax(0,1fr) 32px;}',
    '.bbr .bb-web-page .bb-web-orb,.bbr .bb-web-page .bb-web-avatar{width:32px;height:32px;}',
    '.bbr .bb-web-page .bb-web-msg-copy{display:flex;flex-direction:column;}',
    '.bbr .bb-web-page .bb-web-msg-meta{order:2;margin:4px 2px 0;font-weight:600;font-size:11px;color:#999;}',
    '.bbr .bb-web-page .bb-web-msg-meta span{display:none;}',
    '.bbr .bb-web-page .bb-web-msg-meta time{font-weight:600;color:#999;font-size:11px;}',
    '.bbr .bb-web-page .bb-web-bubble{order:1;max-width:85%;padding:12px 15px;border-radius:18px 18px 18px 6px;background:#f8f5ff;color:#242126;font-size:14px;box-shadow:none;}',
    '.bbr .bb-web-page .bb-web-msg.is-user .bb-web-bubble{max-width:75%;border-radius:18px 18px 6px 18px;background:var(--bb-primary);color:#fff;}',
    '.bbr .bb-web-page .bb-web-typing{background:#f8f5ff;border-radius:18px 18px 18px 6px;}',
    '.bbr .bb-web-page .bb-web-error{width:min(100%,748px);margin:8px auto 0;}',
    '.bbr .bb-web-page .bb-web-composer{width:min(100%,748px);margin:12px auto 0;padding:10px 12px 12px;border-radius:18px;background:#fff;border:4px solid var(--bb-primary-a06);box-shadow:0 14px 32px var(--bb-primary-a08);}',
    '.bbr .bb-web-page .bb-web-composer:focus-within{border-color:var(--bb-primary-a18);background:#fff;}',
    '.bbr .bb-web-page .bb-web-composer textarea{font-size:15px;min-height:52px;height:52px;padding:6px 6px 8px;color:#19191c;}',
    '.bbr .bb-web-page .bb-web-composer textarea::placeholder{color:#a9a7b0;}',
    '.bbr .bb-web-page .bb-web-tool{border-radius:8px;background:#fbfbfc;}',
    '.bbr .bb-web-page .bb-web-tool:hover:not(:disabled){background:#f6f3fb;box-shadow:none;}',
    '.bbr .bb-web-page .bb-web-send{width:40px;height:40px;border:3px solid var(--bb-primary-a12);background:radial-gradient(circle at 35% 25%,var(--bb-primary-light),var(--bb-primary) 64%,var(--bb-primary-dark));}',
    '.bbr .bb-web-prompts{width:min(100%,748px);margin:14px auto auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}',
    '.bbr .bb-web-prompt{min-height:120px;display:flex;flex-direction:column;align-items:flex-start;gap:16px;border:1px solid #f0eef3;border-radius:18px;background:#fff;color:#0d0d0f;text-align:left;padding:18px;box-shadow:0 14px 30px rgba(17,17,20,.04);}',
    '.bbr .bb-web-prompt:hover:not(:disabled){border-color:var(--bb-primary-a30);box-shadow:0 16px 34px var(--bb-primary-a08);}',
    '.bbr .bb-web-prompt .bb-web-icon{color:var(--bb-primary);}',
    '.bbr .bb-web-prompt strong{display:block;font-size:14px;font-weight:700;margin-bottom:4px;}',
    '.bbr .bb-web-prompt>span{display:block;color:#0d0d0f;}',
    '.bbr .bb-web-prompt>span>span{display:block;color:#a8a6ae;font-size:12px;line-height:1.3;}',
    '.bbr .bb-web-page.is-empty .bb-web-page-scroll{flex:0 1 auto;margin-top:auto;}',

    /* page compact (container narrower than 760px, set via ResizeObserver) */
    '.bbr.bb-web-compact .bb-web-page-side{position:absolute;top:0;bottom:0;left:0;z-index:3;width:min(290px,86%);transform:translateX(-105%);transition:transform 180ms ease;box-shadow:20px 0 50px rgba(17,17,20,.12);}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-side{transform:none;}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-backdrop{display:block;position:absolute;inset:0;z-index:2;background:rgba(20,10,30,.25);}',
    '.bbr.bb-web-compact .bb-web-page-menu,.bbr.bb-web-compact .bb-web-page-close{display:inline-grid;}',
    '.bbr.bb-web-compact .bb-web-page-stage{padding:8px;}',
    '.bbr.bb-web-compact .bb-web-page-card{padding:10px;}',
    '.bbr.bb-web-compact .bb-web-prompts{grid-template-columns:1fr;gap:8px;}',
    '.bbr.bb-web-compact .bb-web-prompt{min-height:0;flex-direction:row;align-items:center;gap:12px;padding:12px 14px;}',
    '.bbr.bb-web-compact .bb-web-hero-orb{width:80px;height:80px;}',
    '.bbr.bb-web-compact .bb-web-page-btn .bb-web-btn-label{display:none;}',

    /* --- responsive (viewport based for floating / sidebar) --- */
    '@media (max-width:991.98px){.bbr .bb-web-dock{box-shadow:-20px 0 50px rgba(82,35,108,.18);}}',
    '@media (max-width:575.98px){',
    '.bbr .bb-web-float{right:max(12px,min(var(--bb-ox),16px));bottom:max(12px,min(var(--bb-oy),16px));}',
    '.bbr.bb-web-left .bb-web-float{left:max(12px,min(var(--bb-ox),16px));right:auto;}',
    '.bbr .bb-web-window{position:fixed;left:0;right:0;bottom:0;width:100%;max-width:none;animation:bb-web-sheet 200ms ease-out;}',
    '.bbr .bb-web-window .bb-web-panel{height:calc(100vh - 32px);border-radius:20px 20px 0 0;border-bottom:0;}',
    '@supports (height:100dvh){.bbr .bb-web-window .bb-web-panel{height:calc(100dvh - 32px);}}',
    '.bbr .bb-web-float.is-open .bb-web-launcher{display:none;}',
    '.bbr .bb-web-dock{width:100%;padding:0;}',
    '.bbr .bb-web-dock .bb-web-panel{border-radius:0;border:0;}',
    '.bbr .bb-web-header{min-height:60px;padding:10px;gap:8px;}',
    '.bbr .bb-web-header-actions{gap:4px;}',
    '.bbr .bb-web-orb.is-logo{width:34px;height:34px;}',
    '.bbr .bb-web-hpill .bb-web-btn-label{display:none;}',
    '.bbr .bb-web-hpill{width:34px;padding:0;}',
    '}',
    '@media (prefers-reduced-motion:reduce){.bbr *,.bbr *::before,.bbr *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}}'
  ].join('\n').replace(/\.bbr\b/g, '.bb-web-root');

  function injectStyles() {
    if (!HAS_DOM || document.getElementById('bb-web-styles')) return;
    var style = document.createElement('style');
    style.id = 'bb-web-styles';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ======================================================================
   * Configuration
   * ==================================================================== */

  var DEFAULTS = {
    apiUrl: '',
    apiKey: null,
    tenantId: null,
    user: {},
    headers: {},
    credentials: 'same-origin',
    timeout: DEFAULT_TIMEOUT,
    mode: 'floating',
    container: null,
    position: 'bottom-right',
    offset: { x: 24, y: 24 },
    zIndex: 9999,
    sidebarWidth: 380,
    sidebarTop: 0,
    sidebarPushContent: undefined,
    width: 360,
    height: 560,
    defaultOpen: false,
    launcher: { type: 'button', text: 'Chat', gifUrl: null },
    theme: { primary: DEFAULT_PRIMARY, panel: '#fbf1ff', ink: '#08080a', radius: 22, fontFamily: null },
    branding: { botName: 'Brainbox AI', title: null, subtitle: 'Your AI assistant', logoUrl: null, botAvatarUrl: null },
    welcomeMessages: ["Hi {{name}}! I'm {{botName}}. How can I help you today?"],
    quickActions: [],
    placeholder: 'Type message...',
    features: { history: true, upload: true, emoji: true, modeSwitch: true, newChat: true, export: false },
    allowedModes: ['floating', 'sidebar'],
    page: { greeting: 'Hello, {{name}}', heading: 'How can I assist you today?' },
    context: null,
    storageKey: 'bb-web',
    locale: undefined,
    onEvent: null
  };

  function normalizeConfig(raw) {
    var cfg = deepMerge(DEFAULTS, raw || {});
    if (MODES.indexOf(cfg.mode) === -1) cfg.mode = 'floating';
    if (cfg.position !== 'bottom-left') cfg.position = 'bottom-right';
    if (typeof cfg.launcher === 'string') cfg.launcher = deepMerge(DEFAULTS.launcher, { type: cfg.launcher });
    if (!Array.isArray(cfg.allowedModes)) cfg.allowedModes = DEFAULTS.allowedModes.slice();
    cfg.allowedModes = cfg.allowedModes.filter(function (m) { return MODES.indexOf(m) !== -1; });
    if (!Array.isArray(cfg.welcomeMessages)) cfg.welcomeMessages = cfg.welcomeMessages ? [String(cfg.welcomeMessages)] : [];
    if (!Array.isArray(cfg.quickActions)) cfg.quickActions = [];
    cfg.user = isPlainObject(cfg.user) ? cfg.user : {};
    cfg.offset = { x: toNumber(cfg.offset && cfg.offset.x, 24), y: toNumber(cfg.offset && cfg.offset.y, 24) };
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, 'sidebarPushContent')) cfg.sidebarPushContent = undefined;
    return cfg;
  }

  /* ======================================================================
   * Widget
   * ==================================================================== */

  var instances = [];

  class Widget {
    constructor(options) {
      if (!HAS_DOM) throw new Error('Brainbox.init() needs a browser DOM. Use new Brainbox.Client() for headless use.');
      injectStyles();
      this._raw = Object.assign({}, options || {});
      this._cfg = normalizeConfig(this._raw);
      this.client = new Client(this._cfg);
      this._listeners = {};
      this._gen = 0;
      this._sessionsGen = 0;
      this._abort = null;
      this._nodeCache = new Map();
      this._destroyed = false;
      this._pushState = null;
      this._st = {
        messages: [],
        sessionId: null,
        sessionTitle: null,
        sending: false,
        sendingSince: 0,
        uploading: false,
        error: null,
        view: 'chat',
        sessions: null,
        sessionsLoading: false,
        sessionsError: null,
        search: '',
        loadingHistory: false,
        restored: false,
        open: false,
        drawer: false,
        emoji: false,
        introTime: Date.now()
      };

      var stored = this._readStore();
      this._st.sessionId = stored.sessionId || null;
      this._mode = this._initialMode(stored.mode);
      this._st.open = this._isOverlayMode() ? (typeof stored.open === 'boolean' ? stored.open : !!this._cfg.defaultOpen) : true;

      this._onResize = this._onResize.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      global.addEventListener('resize', this._onResize);
      document.addEventListener('click', this._onDocClick, true);

      this._mount();
      instances.push(this);
      this._emit('ready', { mode: this._mode });
    }

    /* ---------------- public API ---------------- */

    open() {
      if (this._destroyed) return;
      if (!this._isOverlayMode()) { this._focusComposer(); return; }
      if (this._st.open) { this._focusComposer(); return; }
      this._st.open = true;
      this._writeStore({ open: true });
      this._renderOpen();
      this._ensureRestored();
      this._focusComposer();
      this._scrollToBottom(true);
      this._emit('open', { mode: this._mode });
    }

    close() {
      if (this._destroyed || !this._isOverlayMode() || !this._st.open) return;
      this._st.open = false;
      this._st.emoji = false;
      this._writeStore({ open: false });
      this._renderOpen();
      this._emit('close', { mode: this._mode });
    }

    toggle() {
      if (this.isOpen() && this._isOverlayMode()) this.close();
      else this.open();
    }

    isOpen() {
      return this._isOverlayMode() ? !!this._st.open : true;
    }

    getMode() {
      return this._mode;
    }

    setMode(mode) {
      if (this._destroyed || MODES.indexOf(mode) === -1 || mode === this._mode) return false;
      if ((mode === 'inline' || mode === 'page') && !resolveElement(this._cfg.container)) {
        this._warn('setMode("' + mode + '") needs a `container`.');
        return false;
      }
      var previous = this._mode;
      var wasOpen = this.isOpen();
      var draft = this._els && this._els.input ? this._els.input.value : '';
      this._unmount();
      this._mode = mode;
      if (this._cfg.allowedModes.indexOf(mode) !== -1) this._writeStore({ mode: mode });
      if (this._isOverlayMode()) {
        this._st.open = wasOpen;
        this._writeStore({ open: wasOpen });
      }
      this._mount();
      if (draft && this._els.input) { this._els.input.value = draft; this._autoGrow(); }
      if (this.isOpen()) this._focusComposer();
      this._emit('modechange', { mode: mode, previous: previous });
      return true;
    }

    async send(text) {
      var value = String(text == null ? '' : text).trim();
      if (!value || this._destroyed || this._st.sending) return null;
      if (this._isOverlayMode() && !this._st.open) this.open();
      var msg = { id: uid('m'), role: 'user', content: value, time: Date.now() };
      this._st.messages.push(msg);
      this._st.view = 'chat';
      this._emit('message', { text: value, sessionId: this._st.sessionId });
      return this._ask(msg);
    }

    newChat() {
      if (this._destroyed) return;
      this._cancelInFlight();
      this._st.messages = [];
      this._st.sessionId = null;
      this._st.sessionTitle = null;
      this._st.error = null;
      this._st.view = 'chat';
      this._st.loadingHistory = false;
      this._st.uploading = false;
      this._st.restored = true;
      this._st.introTime = Date.now();
      this._st.drawer = false;
      this._nodeCache.clear();
      this._writeStore({ sessionId: null });
      this._render();
      this._focusComposer();
      this._emit('session', { sessionId: null });
    }

    async loadSession(sessionId, opts) {
      if (this._destroyed || !sessionId) return null;
      opts = opts || {};
      this._cancelInFlight();
      var gen = this._gen;
      var st = this._st;
      st.sessionId = sessionId;
      st.messages = [];
      st.sessionTitle = this._findSessionTitle(sessionId);
      st.view = 'chat';
      st.error = null;
      st.loadingHistory = true;
      st.restored = true;
      st.drawer = false;
      this._nodeCache.clear();
      this._render();
      try {
        var data = await this.client.getSessionMessages(sessionId);
        if (gen !== this._gen) return null;
        st.messages = data.messages.filter(function (m) { return m && m.content != null; }).map(function (m) {
          var role = m.role === 'user' ? 'user' : 'assistant';
          var content = String(m.content);
          var fileMatch = role === 'user' ? content.match(/^Uploaded (?:file|image): (.+)$/) : null;
          return {
            id: 'srv-' + (m.id != null ? m.id : uid('h')),
            role: role,
            content: fileMatch ? fileMatch[1] : content,
            kind: fileMatch ? 'file' : 'text',
            time: parseTime(m.created_at)
          };
        });
        if (data.title) st.sessionTitle = data.title;
        this._writeStore({ sessionId: sessionId });
        this._emit('session', { sessionId: sessionId, title: st.sessionTitle });
        return data;
      } catch (err) {
        if (gen !== this._gen) return null;
        if (err.status === 404 || err.status === 403) {
          st.sessionId = null;
          st.sessionTitle = null;
          this._writeStore({ sessionId: null });
          if (opts.silent) return null;
        }
        var self = this;
        this._setError(err, 'session', err.status === 404 || err.status === 403 ? null : function () { return self.loadSession(sessionId); });
        return null;
      } finally {
        if (gen === this._gen) {
          st.loadingHistory = false;
          this._render();
          this._scrollToBottom(true);
        }
      }
    }

    updateConfig(partial) {
      if (this._destroyed || !partial) return;
      var draft = this._els && this._els.input ? this._els.input.value : '';
      var nextMode = partial.mode;
      this._raw = deepMerge(this._raw, partial);
      ['container', 'sidebarPushContent', 'context', 'onEvent', 'headers', 'user', 'welcomeMessages', 'quickActions', 'allowedModes'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(partial, k)) this._raw[k] = partial[k];
      }, this);
      var prevClient = this.client;
      this._cfg = normalizeConfig(this._raw);
      var clientKeys = ['apiUrl', 'apiKey', 'tenantId', 'user', 'headers', 'credentials', 'timeout'];
      if (clientKeys.some(function (k) { return Object.prototype.hasOwnProperty.call(partial, k); })) {
        this.client = new Client(this._cfg);
      } else {
        this.client = prevClient;
      }
      this._unmount();
      if (nextMode && MODES.indexOf(nextMode) !== -1) this._mode = nextMode;
      this._mount();
      if (draft && this._els.input) { this._els.input.value = draft; this._autoGrow(); }
    }

    destroy() {
      if (this._destroyed) return;
      this._cancelInFlight();
      this._unmount();
      global.removeEventListener('resize', this._onResize);
      document.removeEventListener('click', this._onDocClick, true);
      this._destroyed = true;
      var idx = instances.indexOf(this);
      if (idx !== -1) instances.splice(idx, 1);
      this._emit('destroy', {});
      this._listeners = {};
    }

    on(name, fn) {
      if (typeof fn !== 'function') return function () {};
      (this._listeners[name] = this._listeners[name] || []).push(fn);
      var self = this;
      return function off() {
        var list = self._listeners[name] || [];
        var i = list.indexOf(fn);
        if (i !== -1) list.splice(i, 1);
      };
    }

    getSessionId() {
      return this._st.sessionId;
    }

    getMessages() {
      return this._st.messages.map(function (m) { return { id: m.id, role: m.role, content: m.content, time: m.time, kind: m.kind || 'text' }; });
    }

    /* ---------------- internals: config / storage ---------------- */

    _warn(msg) {
      if (global.console && console.warn) console.warn('[Brainbox] ' + msg);
    }

    _emit(name, detail) {
      var list = (this._listeners[name] || []).slice();
      list.forEach(function (fn) {
        try { fn(detail); } catch (e) { if (global.console) console.error(e); }
      });
      if (typeof this._cfg.onEvent === 'function') {
        try { this._cfg.onEvent(name, detail); } catch (e) { if (global.console) console.error(e); }
      }
    }

    _storeKey() {
      var c = this._cfg;
      return (c.storageKey || 'bb-web') + ':' + (c.tenantId || 'default') + ':' + (c.user && c.user.id != null && c.user.id !== '' ? c.user.id : 'anon');
    }

    _readStore() {
      var s = safeStorage();
      if (!s) return {};
      try {
        var v = JSON.parse(s.getItem(this._storeKey()) || '{}');
        return isPlainObject(v) ? v : {};
      } catch (e) {
        return {};
      }
    }

    _writeStore(patch) {
      var s = safeStorage();
      if (!s) return;
      try {
        var next = Object.assign(this._readStore(), patch);
        Object.keys(next).forEach(function (k) { if (next[k] == null) delete next[k]; });
        s.setItem(this._storeKey(), JSON.stringify(next));
      } catch (e) { /* storage full or blocked */ }
    }

    _initialMode(storedMode) {
      var cfg = this._cfg;
      var mode = cfg.mode;
      var canSwitch = cfg.features.modeSwitch && cfg.allowedModes.length > 1 && cfg.allowedModes.indexOf(mode) !== -1;
      if (canSwitch && storedMode && cfg.allowedModes.indexOf(storedMode) !== -1) mode = storedMode;
      if ((mode === 'inline' || mode === 'page') && !resolveElement(cfg.container)) {
        if (mode === cfg.mode) this._warn('mode "' + mode + '" needs a `container`; falling back to "floating".');
        mode = 'floating';
      }
      return mode;
    }

    _isOverlayMode() {
      return this._mode === 'floating' || this._mode === 'sidebar';
    }

    _botName() {
      return this._cfg.branding.botName || 'Assistant';
    }

    _userName() {
      return (this._cfg.user && this._cfg.user.name) || 'You';
    }

    _interpolate(str) {
      var name = this._cfg.user && this._cfg.user.name ? String(this._cfg.user.name).split(/\s+/)[0] : '';
      var s = String(str == null ? '' : str);
      if (!name) s = s.replace(/,?\s*\{\{\s*name\s*\}\}/g, function (m) { return m.charAt(0) === ',' ? '' : ' there'; });
      return s.replace(/\{\{\s*name\s*\}\}/g, name).replace(/\{\{\s*botName\s*\}\}/g, this._botName()).replace(/\s+([!?.,])/g, '$1').trim();
    }

    _modeSwitchTarget() {
      var cfg = this._cfg;
      if (!cfg.features.modeSwitch) return null;
      var list = cfg.allowedModes.filter(function (m) {
        return m === 'floating' || m === 'sidebar' || !!resolveElement(cfg.container);
      });
      var idx = list.indexOf(this._mode);
      if (idx === -1 || list.length < 2) return null;
      return list[(idx + 1) % list.length];
    }

    /* ---------------- internals: mount / unmount ---------------- */

    _mount() {
      var cfg = this._cfg;
      var mode = this._mode;
      var root = h('div', { class: 'bb-web-root bb-web-m-' + mode + (cfg.position === 'bottom-left' ? ' bb-web-left' : ''), 'data-bb-mode': mode });
      this._applyTheme(root);
      root.addEventListener('keydown', this._onKeydown.bind(this));
      this._els = { root: root };

      if (mode === 'floating' || mode === 'sidebar') {
        root.classList.add('bb-web-host');
        var float = h('div', { class: 'bb-web-float' });
        this._els.float = float;
        var panel = this._buildPanel();
        if (mode === 'floating') {
          var win = h('div', { class: 'bb-web-window' }, panel);
          this._els.window = win;
          float.appendChild(win);
        } else {
          var dock = h('div', { class: 'bb-web-dock' }, panel);
          this._els.dock = dock;
          root.appendChild(dock);
        }
        var launcher = this._buildLauncher();
        if (launcher) float.appendChild(launcher);
        root.appendChild(float);
        document.body.appendChild(root);
      } else {
        var container = resolveElement(cfg.container);
        root.appendChild(mode === 'page' ? this._buildPage() : this._buildPanel());
        container.appendChild(root);
        if (typeof ResizeObserver !== 'undefined') {
          var self = this;
          this._ro = new ResizeObserver(function (entries) {
            var w = entries[0] && entries[0].contentRect ? entries[0].contentRect.width : root.clientWidth;
            root.classList.toggle('bb-web-compact', w < 760);
            if (w >= 760 && self._st.drawer) { self._st.drawer = false; self._renderPageDrawer(); }
          });
          this._ro.observe(root);
        } else {
          root.classList.toggle('bb-web-compact', root.clientWidth < 760);
        }
      }

      this._nodeCache.clear();
      this._render();
      if (this.isOpen()) this._ensureRestored();
      if (mode === 'page') this._loadSessions();
      this._scrollToBottom(true);
    }

    _unmount() {
      if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      this._restorePush();
      if (this._els && this._els.root && this._els.root.parentNode) this._els.root.parentNode.removeChild(this._els.root);
      this._els = {};
      this._nodeCache.clear();
    }

    _applyTheme(root) {
      var cfg = this._cfg;
      var t = cfg.theme || {};
      var primary = t.primary || DEFAULT_PRIMARY;
      var pal = palette(primary);
      var vars = {
        '--bb-primary': primary,
        '--bb-primary-light': pal.light,
        '--bb-primary-dark': pal.dark,
        '--bb-primary-a06': pal.a06,
        '--bb-primary-a08': pal.a08,
        '--bb-primary-a12': pal.a12,
        '--bb-primary-a18': pal.a18,
        '--bb-primary-a30': pal.a30,
        '--bb-primary-a45': pal.a45,
        '--bb-panel': t.panel || '#fbf1ff',
        '--bb-body-top': pal.bodyTop,
        '--bb-body-bottom': pal.bodyBottom,
        '--bb-ink': t.ink || '#08080a',
        '--bb-radius': px(t.radius, '22px'),
        '--bb-z': String(toNumber(cfg.zIndex, 9999)),
        '--bb-w': px(cfg.width, '360px'),
        '--bb-h': px(cfg.height, '560px'),
        '--bb-ox': cfg.offset.x + 'px',
        '--bb-oy': cfg.offset.y + 'px',
        '--bb-sb-w': px(cfg.sidebarWidth, '380px'),
        '--bb-sb-top': px(cfg.sidebarTop, '0px')
      };
      if (t.fontFamily) vars['--bb-font'] = t.fontFamily;
      Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    }

    /* ---------------- internals: DOM builders ---------------- */

    _orb(extraClass, url) {
      var orb = h('span', { class: 'bb-web-orb' + (extraClass ? ' ' + extraClass : '') + (url ? ' has-image' : ''), 'aria-hidden': 'true' });
      if (url) {
        var img = h('img', { src: url, alt: '' });
        img.addEventListener('error', function () { orb.classList.remove('has-image'); img.remove(); });
        orb.appendChild(img);
      }
      return orb;
    }

    _userAvatar() {
      var u = this._cfg.user || {};
      var el = h('span', { class: 'bb-web-avatar', 'aria-hidden': 'true' });
      if (u.avatarUrl) {
        var img = h('img', { src: u.avatarUrl, alt: '' });
        img.addEventListener('error', function () { img.remove(); el.textContent = initials(u.name, 'U'); });
        el.appendChild(img);
      } else {
        el.textContent = initials(u.name, 'U');
      }
      return el;
    }

    _buildLauncher() {
      var cfg = this._cfg;
      var type = cfg.launcher && cfg.launcher.type;
      if (type === 'none') return null;
      var self = this;
      var btn = h('button', { type: 'button', class: 'bb-web-launcher', 'aria-haspopup': 'dialog' });
      btn.addEventListener('click', function () { self.toggle(); });
      this._els.launcher = btn;
      return btn;
    }

    _renderLauncher() {
      var btn = this._els.launcher;
      if (!btn) return;
      var cfg = this._cfg;
      var open = this._st.open;
      var type = cfg.launcher.type;
      var text = cfg.launcher.text || 'Chat';
      clear(btn);
      btn.className = 'bb-web-launcher';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close chat' : (cfg.launcher.ariaLabel || 'Open chat'));
      if (this._mode === 'sidebar' && open) {
        btn.classList.add('bb-web-is-closed');
        return;
      }
      if (open) {
        btn.classList.add('is-open');
        btn.appendChild(icon('x', 26, 1.8));
      } else if (type === 'gif' && cfg.launcher.gifUrl) {
        btn.classList.add('is-gif');
        btn.appendChild(h('img', { src: cfg.launcher.gifUrl, alt: '' }));
      } else if (type === 'icon') {
        btn.classList.add('is-icon');
        btn.appendChild(icon('chat', 26));
      } else {
        btn.appendChild(icon('chat', 22));
        btn.appendChild(h('span', { text: text }));
      }
    }

    _buildPanel() {
      var self = this;
      var cfg = this._cfg;
      var b = cfg.branding;
      var els = this._els;
      var title = b.title || b.botName || 'Assistant';
      var overlay = this._isOverlayMode();

      var actions = h('div', { class: 'bb-web-header-actions' });
      if (cfg.features.newChat) {
        els.newChatBtn = h('button', { type: 'button', class: 'bb-web-hbtn', title: 'New chat', 'aria-label': 'New chat' }, icon('newchat', 17, 1.9));
        els.newChatBtn.addEventListener('click', function () { self.newChat(); });
        actions.appendChild(els.newChatBtn);
      }
      if (cfg.features.history) {
        els.historyBtn = h('button', { type: 'button', class: 'bb-web-hbtn', title: 'Chat history', 'aria-label': 'Chat history', 'aria-pressed': 'false' }, icon('history', 17, 1.9));
        els.historyBtn.addEventListener('click', function () { self._toggleHistory(); });
        actions.appendChild(els.historyBtn);
      }
      if (cfg.features.export) {
        var exp = h('button', { type: 'button', class: 'bb-web-hbtn', title: 'Export conversation', 'aria-label': 'Export conversation' }, icon('download', 17, 1.9));
        exp.addEventListener('click', function () { self._export(); });
        actions.appendChild(exp);
      }
      var target = this._modeSwitchTarget();
      if (target) {
        var label = { floating: 'Pop out to floating window', sidebar: 'Dock to sidebar', inline: 'Show inline', page: 'Open full page' }[target];
        var iconName = { floating: 'undock', sidebar: 'dock', inline: 'undock', page: 'expand' }[target];
        var dockBtn = h('button', { type: 'button', class: 'bb-web-hbtn bb-web-dock-btn', title: label, 'aria-label': label }, icon(iconName, 17, 1.9));
        dockBtn.addEventListener('click', function () { self.setMode(target); });
        actions.appendChild(dockBtn);
      }
      if (overlay) {
        var closeBtn = h('button', { type: 'button', class: 'bb-web-close', title: 'Close', 'aria-label': 'Close chat' }, icon('x', 20, 1.8));
        closeBtn.addEventListener('click', function () { self.close(); if (self._els.launcher) self._els.launcher.focus(); });
        actions.appendChild(closeBtn);
      }

      var header = h('header', { class: 'bb-web-header' }, [
        this._orb('is-logo', b.logoUrl),
        h('div', { class: 'bb-web-header-copy' }, [
          h('h2', { class: 'bb-web-title', text: title }),
          b.subtitle ? h('div', { class: 'bb-web-subtitle', text: b.subtitle }) : null
        ]),
        actions
      ]);

      els.transcript = h('div', { class: 'bb-web-transcript' });
      els.history = h('div', { class: 'bb-web-history bb-web-is-closed' });
      els.log = h('div', { class: 'bb-web-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation' });
      els.transcript.appendChild(els.history);
      els.transcript.appendChild(els.log);
      this._buildHistoryView(els.history);

      els.errorSlot = h('div', { class: 'bb-web-error-slot' });
      var body = h('div', { class: 'bb-web-body' }, [els.transcript, els.errorSlot, this._buildComposer(true)]);

      var panel = h('section', {
        class: 'bb-web-panel',
        role: this._mode === 'floating' ? 'dialog' : 'region',
        'aria-label': title,
        tabindex: '-1'
      }, [header, body]);
      els.panel = panel;
      return panel;
    }

    _buildHistoryView(container) {
      var self = this;
      var back = h('button', { type: 'button', class: 'bb-web-ghost' }, [icon('back', 14), 'Back to chat']);
      back.addEventListener('click', function () { self._toggleHistory(false); });
      var search = h('input', { type: 'search', placeholder: 'Search conversations', 'aria-label': 'Search conversations' });
      search.addEventListener('input', function () { self._st.search = search.value; self._renderSessionLists(); });
      this._els.historySearch = search;
      this._els.historyList = h('div', { class: 'bb-web-history-list' });
      append(container, [
        h('div', { class: 'bb-web-history-head' }, [back, h('span', { text: 'Your conversations' })]),
        h('label', { class: 'bb-web-hsearch' }, [icon('search', 15), search]),
        this._els.historyList
      ]);
    }

    _buildComposer(showHistoryPill) {
      var self = this;
      var cfg = this._cfg;
      var els = this._els;
      var form = h('form', { class: 'bb-web-composer', novalidate: true });
      form.addEventListener('submit', function (e) { e.preventDefault(); self._submit(); });

      var ta = h('textarea', { rows: '1', placeholder: cfg.placeholder || 'Type message...', 'aria-label': 'Message', enterkeyhint: 'send' });
      ta.addEventListener('input', function () { self._autoGrow(); self._renderComposerState(); });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          self._submit();
        }
      });
      els.input = ta;

      var bar = h('div', { class: 'bb-web-bar' });
      if (cfg.features.upload) {
        var fileInput = h('input', { type: 'file', class: 'bb-web-file-input', tabindex: '-1', 'aria-hidden': 'true' });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (f) self._upload(f);
        });
        var attach = h('button', { type: 'button', class: 'bb-web-tool', title: 'Attach file', 'aria-label': 'Attach file' }, icon('paperclip', 19, 1.8));
        attach.addEventListener('click', function () { fileInput.click(); });
        els.attachBtn = attach;
        bar.appendChild(attach);
        bar.appendChild(fileInput);
      }
      if (cfg.features.emoji) {
        var wrap = h('div', { class: 'bb-web-emoji-wrap' });
        var emojiBtn = h('button', { type: 'button', class: 'bb-web-tool', title: 'Emoji', 'aria-label': 'Insert emoji', 'aria-expanded': 'false' }, icon('smile', 19, 1.8));
        var pop = h('div', { class: 'bb-web-emoji-pop bb-web-is-closed', role: 'menu', 'aria-label': 'Emoji' });
        EMOJIS.forEach(function (em) {
          var b = h('button', { type: 'button', role: 'menuitem', 'aria-label': 'Insert ' + em, text: em });
          b.addEventListener('click', function () { self._insertText(em); self._toggleEmoji(false); });
          pop.appendChild(b);
        });
        emojiBtn.addEventListener('click', function () { self._toggleEmoji(); });
        els.emojiBtn = emojiBtn;
        els.emojiPop = pop;
        els.emojiWrap = wrap;
        append(wrap, [emojiBtn, pop]);
        bar.appendChild(wrap);
      }
      if (showHistoryPill && cfg.features.history) {
        var pill = h('button', { type: 'button', class: 'bb-web-hpill', 'aria-label': 'Chat history' });
        pill.addEventListener('click', function () { self._toggleHistory(); });
        els.historyPill = pill;
        bar.appendChild(pill);
      }
      var send = h('button', { type: 'submit', class: 'bb-web-send', title: 'Send (Enter)', 'aria-label': 'Send message' }, icon('send', 19, 2.1));
      els.sendBtn = send;
      bar.appendChild(send);
      append(form, [ta, bar]);
      return form;
    }

    _buildPage() {
      var self = this;
      var cfg = this._cfg;
      var b = cfg.branding;
      var els = this._els;
      var u = cfg.user || {};

      var logo = h('span', { class: 'bb-web-page-logo', 'aria-hidden': 'true' });
      if (b.logoUrl) logo.appendChild(h('img', { src: b.logoUrl, alt: '' }));
      else logo.appendChild(icon('sparkle', 18, 1.9));

      var closeDrawer = h('button', { type: 'button', class: 'bb-web-page-close', 'aria-label': 'Hide conversations' }, icon('x', 18));
      closeDrawer.addEventListener('click', function () { self._st.drawer = false; self._renderPageDrawer(); });

      var newChat = h('button', { type: 'button', class: 'bb-web-newchat' }, [icon('plus', 18), h('span', { text: 'New chat' })]);
      newChat.addEventListener('click', function () { self.newChat(); });
      els.newChatBtn = newChat;

      var search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search conversations' });
      search.addEventListener('input', function () { self._st.search = search.value; self._renderSessionLists(); });

      els.pageSessions = h('nav', { class: 'bb-web-page-sessions', 'aria-label': 'Conversations' });

      var side = h('aside', { class: 'bb-web-page-side', 'aria-label': 'Conversations' }, [
        h('div', { class: 'bb-web-page-brand' }, [logo, h('div', { class: 'bb-web-page-name', text: b.title || b.botName || 'Assistant' }), closeDrawer]),
        cfg.features.newChat ? newChat : null,
        cfg.features.history ? h('label', { class: 'bb-web-psearch' }, [icon('search', 17), search]) : null,
        cfg.features.history ? els.pageSessions : h('div', { style: { flex: '1' } }),
        u.name || u.email ? h('div', { class: 'bb-web-profile' }, [
          this._userAvatar(),
          h('div', { class: 'bb-web-profile-copy' }, [
            h('div', { class: 'bb-web-profile-name', text: u.name || '' }),
            u.email ? h('div', { class: 'bb-web-profile-email', text: u.email }) : null
          ])
        ]) : null
      ]);

      var backdrop = h('div', { class: 'bb-web-page-backdrop' });
      backdrop.addEventListener('click', function () { self._st.drawer = false; self._renderPageDrawer(); });

      var menu = h('button', { type: 'button', class: 'bb-web-page-btn bb-web-page-menu', 'aria-label': 'Show conversations' }, icon('menu', 18));
      menu.addEventListener('click', function () { self._st.drawer = true; self._renderPageDrawer(); });

      var smallLogo = h('span', { class: 'bb-web-page-logo is-small', 'aria-hidden': 'true' });
      if (b.logoUrl) smallLogo.appendChild(h('img', { src: b.logoUrl, alt: '' }));
      else smallLogo.appendChild(icon('sparkle', 14, 2));
      els.pageTitle = h('span');
      var tools = h('div', { class: 'bb-web-page-tools' });
      if (cfg.features.export) {
        var exp = h('button', { type: 'button', class: 'bb-web-page-btn', 'aria-label': 'Export conversation' }, [icon('download', 17), h('span', { class: 'bb-web-btn-label', text: 'Export' })]);
        exp.addEventListener('click', function () { self._export(); });
        tools.appendChild(exp);
      }
      var target = this._modeSwitchTarget();
      if (target) {
        var label = { floating: 'Pop out to floating window', sidebar: 'Dock to sidebar', inline: 'Show inline', page: 'Open full page' }[target];
        var sw = h('button', { type: 'button', class: 'bb-web-page-btn bb-web-dock-btn', title: label, 'aria-label': label }, icon(target === 'sidebar' ? 'dock' : 'undock', 17));
        sw.addEventListener('click', function () { self.setMode(target); });
        tools.appendChild(sw);
      }
      var top = h('header', { class: 'bb-web-page-top' }, [menu, h('div', { class: 'bb-web-page-ws' }, [smallLogo, els.pageTitle]), tools]);

      els.hero = h('div', { class: 'bb-web-hero' });
      var heroOrb = h('div', { class: 'bb-web-hero-orb', 'aria-hidden': 'true' });
      if (b.botAvatarUrl) heroOrb.appendChild(h('img', { src: b.botAvatarUrl, alt: '' }));
      append(els.hero, [
        heroOrb,
        h('h1', { class: 'bb-web-hello', text: this._interpolate(cfg.page.greeting) }),
        h('h2', { class: 'bb-web-heading', text: this._interpolate(cfg.page.heading) })
      ]);
      els.log = h('div', { class: 'bb-web-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation' });
      els.transcript = h('div', { class: 'bb-web-page-scroll' }, [els.hero, els.log]);
      els.errorSlot = h('div', { class: 'bb-web-error-slot' });
      els.prompts = h('div', { class: 'bb-web-prompts' });
      this._buildPromptCards(els.prompts);

      var card = h('section', { class: 'bb-web-page-card', 'aria-label': b.title || b.botName || 'Chat' }, [
        top, els.transcript, els.errorSlot, this._buildComposer(false), els.prompts
      ]);
      var page = h('div', { class: 'bb-web-page' }, [side, backdrop, h('main', { class: 'bb-web-page-stage' }, card)]);
      els.page = page;
      els.panel = card;
      return page;
    }

    _buildPromptCards(container) {
      var self = this;
      var icons = ['pie', 'bulb', 'question', 'sparkle'];
      this._cfg.quickActions.forEach(function (qa, i) {
        var item = typeof qa === 'string' ? { title: qa, prompt: qa } : (qa || {});
        var prompt = item.prompt || item.title;
        if (!prompt) return;
        var btn = h('button', { type: 'button', class: 'bb-web-prompt' }, [
          icon(item.icon && ICONS[item.icon] ? item.icon : icons[i % icons.length], 22),
          h('span', null, [h('strong', { text: item.title || prompt }), item.description ? h('span', { text: item.description }) : null])
        ]);
        btn.addEventListener('click', function () { self.send(prompt); });
        container.appendChild(btn);
      });
      if (!container.childNodes.length) container.classList.add('bb-web-is-closed');
    }

    /* ---------------- internals: rendering ---------------- */

    _render() {
      if (!this._els || !this._els.root) return;
      this._renderOpen();
      this._renderMessages();
      this._renderError();
      this._renderHistoryState();
      this._renderComposerState();
      this._renderPageState();
    }

    _renderOpen() {
      var els = this._els;
      if (!els || !els.root) return;
      var open = this._st.open;
      if (els.window) els.window.classList.toggle('bb-web-is-closed', !open);
      if (els.dock) els.dock.classList.toggle('bb-web-is-closed', !open);
      if (els.float) els.float.classList.toggle('is-open', !!open);
      els.root.classList.toggle('bb-web-open', !!open);
      this._renderLauncher();
      if (this._mode === 'sidebar') this._applyPush();
      if (els.emojiPop && !open) this._toggleEmoji(false);
    }

    _renderMessages() {
      var els = this._els;
      var st = this._st;
      if (!els.log) return;
      var self = this;
      var wanted = [];

      if (st.loadingHistory) {
        wanted.push(this._cached('loading', function () {
          return h('div', { class: 'bb-web-muted bb-web-center', role: 'status' }, [h('span', { class: 'bb-web-spinner' }), 'Loading conversation...']);
        }));
      } else if (!st.messages.length && this._mode !== 'page') {
        wanted.push(this._cached('intro', function () { return self._buildIntro(); }));
      }

      st.messages.forEach(function (m) {
        var key = 'msg:' + m.id + ':' + (m.failed ? 'f' : '') + ':' + (m.status || '');
        wanted.push(self._cached(key, function () { return self._buildMessage(m); }));
      });

      if (st.sending) {
        wanted.push(this._cached('typing:' + st.sendingSince, function () { return self._buildTyping(); }));
      }

      var current = Array.prototype.slice.call(els.log.childNodes);
      var changed = current.length !== wanted.length || current.some(function (n, i) { return n !== wanted[i]; });
      if (changed) {
        var prevCount = current.length;
        wanted.forEach(function (node, i) {
          if (els.log.childNodes[i] !== node) els.log.insertBefore(node, els.log.childNodes[i] || null);
        });
        while (els.log.childNodes.length > wanted.length) els.log.removeChild(els.log.lastChild);
        // drop cache entries that are no longer displayed
        var keep = new Set(wanted);
        this._nodeCache.forEach(function (node, key) { if (!keep.has(node)) self._nodeCache.delete(key); });
        if (wanted.length >= prevCount) this._scrollToBottom(false);
      }
    }

    _cached(key, build) {
      var node = this._nodeCache.get(key);
      if (!node) {
        node = build();
        this._nodeCache.set(key, node);
      }
      return node;
    }

    _buildIntro() {
      var self = this;
      var cfg = this._cfg;
      var copy = h('div', { class: 'bb-web-intro-copy' }, [
        h('div', { class: 'bb-web-author' }, [h('span', { text: this._botName() }), h('time', { text: formatTime(this._st.introTime, cfg.locale) })])
      ]);
      cfg.welcomeMessages.forEach(function (line) {
        var text = self._interpolate(line);
        if (text) copy.appendChild(h('div', { class: 'bb-web-intro-bubble', text: text }));
      });
      if (cfg.quickActions.length) {
        var actions = h('div', { class: 'bb-web-actions' });
        cfg.quickActions.forEach(function (qa) {
          var label = typeof qa === 'string' ? qa : (qa && (qa.title || qa.prompt));
          var prompt = typeof qa === 'string' ? qa : (qa && (qa.prompt || qa.title));
          if (!label) return;
          var pill = h('button', { type: 'button', class: 'bb-web-pill', text: label });
          pill.addEventListener('click', function () { self.send(prompt); });
          actions.appendChild(pill);
        });
        copy.appendChild(actions);
      }
      return h('div', { class: 'bb-web-intro' }, [this._orb('', cfg.branding.botAvatarUrl), copy]);
    }

    _buildMessage(m) {
      var isUser = m.role === 'user';
      var bubble = h('div', { class: 'bb-web-bubble' });
      if (isUser) {
        if (m.kind === 'file') bubble.appendChild(h('span', { class: 'bb-web-file-chip' }, icon('paperclip', 14, 2)));
        bubble.appendChild(h('span', { class: 'bb-web-user-text', text: m.content }));
      } else {
        bubble.appendChild(renderMarkdown(m.content));
      }
      var meta = h('div', { class: 'bb-web-msg-meta' }, [
        h('span', { text: isUser ? this._userName() : this._botName() }),
        h('time', { datetime: new Date(m.time).toISOString(), text: formatTime(m.time, this._cfg.locale) })
      ]);
      var copy = h('div', { class: 'bb-web-msg-copy' }, [meta, bubble]);
      if (m.failed) copy.appendChild(h('div', { class: 'bb-web-msg-status is-error', text: m.kind === 'file' ? 'Upload failed' : 'Not sent' }));
      else if (m.status) copy.appendChild(h('div', { class: 'bb-web-msg-status', text: m.status }));
      var row = h('div', { class: 'bb-web-msg' + (isUser ? ' is-user' : '') + (m.failed ? ' is-failed' : '') });
      if (isUser) append(row, [copy, this._userAvatar()]);
      else append(row, [this._orb('', this._cfg.branding.botAvatarUrl), copy]);
      return row;
    }

    _buildTyping() {
      var label = h('span', { text: 'Thinking...' });
      var started = this._st.sendingSince;
      if (this._typingTimer) clearInterval(this._typingTimer);
      this._typingTimer = setInterval(function () {
        var s = (Date.now() - started) / 1000;
        label.textContent = s > 45 ? 'Still working on it, this can take a minute...' : (s > 12 ? 'Searching the knowledge base...' : 'Thinking...');
      }, 1000);
      return h('div', { class: 'bb-web-msg bb-web-typing-row' }, [
        this._orb('', this._cfg.branding.botAvatarUrl),
        h('div', { class: 'bb-web-typing', role: 'status' }, [h('span', { class: 'bb-web-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), label])
      ]);
    }

    _renderError() {
      var slot = this._els.errorSlot;
      if (!slot) return;
      var err = this._st.error;
      var key = err ? err.id : null;
      if (slot._bbKey === key) return;
      slot._bbKey = key;
      clear(slot);
      if (!err) return;
      var self = this;
      var children = [icon('alert', 16), h('span', { class: 'bb-web-error-text', text: err.message })];
      if (err.retry) {
        var retry = h('button', { type: 'button', class: 'bb-web-error-btn' }, [icon('refresh', 13), 'Retry']);
        retry.addEventListener('click', function () {
          var fn = err.retry;
          self._st.error = null;
          self._render();
          fn();
        });
        children.push(retry);
      }
      var dismiss = h('button', { type: 'button', class: 'bb-web-error-x', 'aria-label': 'Dismiss error' }, icon('x', 13));
      dismiss.addEventListener('click', function () { self._st.error = null; self._renderError(); });
      children.push(dismiss);
      slot.appendChild(h('div', { class: 'bb-web-error', role: 'alert' }, children));
    }

    _renderHistoryState() {
      var els = this._els;
      var inHistory = this._st.view === 'history';
      if (els.history) {
        els.history.classList.toggle('bb-web-is-closed', !inHistory);
        els.log.classList.toggle('bb-web-is-closed', inHistory);
      }
      if (els.historyBtn) {
        els.historyBtn.classList.toggle('is-active', inHistory);
        els.historyBtn.setAttribute('aria-pressed', inHistory ? 'true' : 'false');
      }
      if (els.historyPill) {
        clear(els.historyPill);
        els.historyPill.classList.toggle('is-active', inHistory);
        append(els.historyPill, [icon(inHistory ? 'back' : 'search', 17, 2.1), h('span', { class: 'bb-web-btn-label', text: inHistory ? 'Back to chat' : 'History' })]);
        els.historyPill.setAttribute('aria-label', inHistory ? 'Back to chat' : 'Chat history');
      }
      this._renderSessionLists();
    }

    _renderSessionLists() {
      var els = this._els;
      if (els.historyList && this._st.view === 'history') this._renderSessionList(els.historyList, true);
      if (els.pageSessions) this._renderSessionList(els.pageSessions, false);
    }

    _renderSessionList(container, withIcons) {
      var self = this;
      var st = this._st;
      clear(container);
      if (st.sessionsLoading && !st.sessions) {
        container.appendChild(h('div', { class: 'bb-web-muted bb-web-center', role: 'status' }, [h('span', { class: 'bb-web-spinner' }), 'Loading...']));
        return;
      }
      if (st.sessionsError && !st.sessions) {
        var retry = h('button', { type: 'button', class: 'bb-web-link', text: 'Retry' });
        retry.addEventListener('click', function () { self._loadSessions(); });
        container.appendChild(h('div', { class: 'bb-web-inline-error', role: 'alert' }, [h('span', { text: st.sessionsError + ' ' }), retry]));
        return;
      }
      var q = (st.search || '').trim().toLowerCase();
      var any = false;
      GROUPS.forEach(function (g) {
        var items = ((st.sessions && st.sessions[g.key]) || []).filter(function (s) {
          return !q || String(s.title || '').toLowerCase().indexOf(q) !== -1;
        });
        if (!items.length) return;
        any = true;
        var group = h('div', { class: 'bb-web-group' }, h('div', { class: 'bb-web-group-label', text: g.label }));
        items.forEach(function (s) {
          var title = s.title || 'Untitled conversation';
          var active = s.session_id === st.sessionId;
          var btn = h('button', { type: 'button', class: 'bb-web-session' + (active ? ' is-active' : ''), title: title, 'aria-current': active ? 'true' : null }, [
            withIcons ? icon('chat', 14, 1.8) : null,
            h('span', { text: title })
          ]);
          btn.addEventListener('click', function () { self.loadSession(s.session_id); });
          group.appendChild(btn);
        });
        container.appendChild(group);
      });
      if (!any) {
        container.appendChild(h('p', { class: 'bb-web-muted bb-web-center', text: q ? 'No conversation matches.' : (st.sessionsLoading ? 'Loading...' : 'No conversations yet.') }));
      }
    }

    _renderComposerState() {
      var els = this._els;
      var st = this._st;
      if (els.sendBtn) {
        var hasText = !!(els.input && els.input.value.trim());
        els.sendBtn.disabled = st.sending || !hasText;
        els.sendBtn.setAttribute('aria-busy', st.sending ? 'true' : 'false');
      }
      if (els.attachBtn) els.attachBtn.disabled = st.uploading;
      if (els.log) els.log.setAttribute('aria-busy', st.sending || st.loadingHistory ? 'true' : 'false');
    }

    _renderPageState() {
      var els = this._els;
      if (!els.page) return;
      var empty = !this._st.messages.length && !this._st.loadingHistory && !this._st.sending;
      els.page.classList.toggle('is-empty', empty);
      els.hero.classList.toggle('bb-web-is-closed', !empty);
      if (els.prompts.childNodes.length) els.prompts.classList.toggle('bb-web-is-closed', !empty);
      els.pageTitle.textContent = this._st.sessionTitle || (this._st.messages.length ? 'Conversation' : (this._cfg.branding.title || this._botName()));
      this._renderPageDrawer();
    }

    _renderPageDrawer() {
      if (this._els.page) this._els.page.classList.toggle('is-drawer', !!this._st.drawer);
    }

    _scrollToBottom(instant) {
      var t = this._els && this._els.transcript;
      if (!t) return;
      var smooth = !instant && !prefersReducedMotion();
      var run = function () {
        if (typeof t.scrollTo === 'function') t.scrollTo({ top: t.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        else t.scrollTop = t.scrollHeight;
      };
      if (global.requestAnimationFrame) requestAnimationFrame(run);
      else run();
    }

    /* ---------------- internals: behaviour ---------------- */

    _submit() {
      var input = this._els.input;
      if (!input || this._st.sending) return;
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      this._autoGrow();
      this.send(text);
    }

    async _ask(userMsg) {
      var st = this._st;
      var self = this;
      this._cancelInFlight();
      var gen = this._gen;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      this._abort = ctrl;
      userMsg.failed = false;
      st.sending = true;
      st.sendingSince = Date.now();
      st.error = null;
      this._render();
      this._scrollToBottom(false);
      try {
        var ctx = null;
        if (typeof this._cfg.context === 'function') {
          try {
            ctx = await this._cfg.context();
          } catch (e) {
            ctx = null;
          }
          if (ctx != null && typeof ctx !== 'string') ctx = JSON.stringify(ctx);
        }
        var data = await this.client.chat(userMsg.content, st.sessionId, ctx, { signal: ctrl ? ctrl.signal : undefined });
        if (gen !== this._gen) return null;
        var newSession = data.session_id && data.session_id !== st.sessionId;
        if (data.session_id) {
          st.sessionId = data.session_id;
          this._writeStore({ sessionId: data.session_id });
        }
        var content = data.response && data.response.trim() ? data.response : "Sorry, I don't have an answer for that yet.";
        st.messages.push({ id: uid('m'), role: 'assistant', content: content, time: Date.now() });
        if (newSession) {
          this._emit('session', { sessionId: st.sessionId });
          if (this._els.pageSessions || st.view === 'history') this._loadSessions();
          else st.sessionsStale = true;
        }
        this._emit('response', { text: content, sessionId: st.sessionId, reasoning: data.reasoning, searchResults: data.search_results, raw: data });
        return data;
      } catch (err) {
        if (gen !== this._gen || err.code === 'aborted') return null;
        userMsg.failed = true;
        this._setError(err, 'chat', function () { return self._ask(userMsg); });
        return null;
      } finally {
        if (gen === this._gen) {
          st.sending = false;
          this._abort = null;
          if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = null; }
          this._render();
          this._scrollToBottom(false);
        }
      }
    }

    _setError(err, action, retry) {
      var message = err && err.message ? err.message : 'Something went wrong. Please try again.';
      if (err && !(err instanceof BrainboxError) && err.name !== 'BrainboxError') message = 'Something went wrong. Please try again.';
      this._st.error = { id: uid('e'), message: message, retry: retry || null, action: action };
      this._renderError();
      this._emit('error', { message: message, action: action, status: err && err.status, code: err && err.code });
    }

    _cancelInFlight() {
      this._gen += 1;
      if (this._abort) {
        try { this._abort.abort(); } catch (e) { /* ignore */ }
        this._abort = null;
      }
      this._st.sending = false;
      if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = null; }
    }

    _ensureRestored() {
      var st = this._st;
      if (st.restored) return;
      st.restored = true;
      if (st.sessionId && !st.messages.length) this.loadSession(st.sessionId, { silent: true });
    }

    async _loadSessions() {
      if (!this._cfg.features.history) return;
      var st = this._st;
      var gen = ++this._sessionsGen;
      st.sessionsLoading = true;
      st.sessionsError = null;
      this._renderSessionLists();
      try {
        var data = await this.client.listSessions();
        if (gen !== this._sessionsGen) return;
        st.sessions = data;
        st.sessionsStale = false;
        if (st.sessionId && !st.sessionTitle) st.sessionTitle = this._findSessionTitle(st.sessionId);
      } catch (err) {
        if (gen !== this._sessionsGen) return;
        st.sessionsError = err.message || 'Could not load conversations.';
      } finally {
        if (gen === this._sessionsGen) {
          st.sessionsLoading = false;
          this._renderSessionLists();
          this._renderPageState();
        }
      }
    }

    _findSessionTitle(id) {
      var s = this._st.sessions;
      if (!s) return null;
      for (var i = 0; i < GROUPS.length; i++) {
        var list = s[GROUPS[i].key] || [];
        for (var j = 0; j < list.length; j++) if (list[j].session_id === id) return list[j].title || null;
      }
      return null;
    }

    _toggleHistory(force) {
      var st = this._st;
      var next = typeof force === 'boolean' ? force : st.view !== 'history';
      st.view = next ? 'history' : 'chat';
      this._renderHistoryState();
      if (next) {
        this._loadSessions();
        if (this._els.historySearch) this._els.historySearch.focus({ preventScroll: true });
      } else {
        this._scrollToBottom(true);
        this._focusComposer();
      }
    }

    _toggleEmoji(force) {
      var els = this._els;
      if (!els.emojiPop) return;
      var next = typeof force === 'boolean' ? force : !this._st.emoji;
      this._st.emoji = next;
      els.emojiPop.classList.toggle('bb-web-is-closed', !next);
      els.emojiBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
    }

    _insertText(text) {
      var ta = this._els.input;
      if (!ta) return;
      var start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
      var end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : ta.value.length;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      var pos = start + text.length;
      ta.focus();
      try { ta.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
      this._autoGrow();
      this._renderComposerState();
    }

    _autoGrow() {
      var ta = this._els.input;
      if (!ta) return;
      ta.style.height = 'auto';
      var max = 140;
      ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
      ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
      this._renderComposerState();
    }

    _focusComposer() {
      var input = this._els && this._els.input;
      if (!input) return;
      setTimeout(function () {
        try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
      }, 30);
    }

    async _upload(file, existingMsg) {
      if (!this._cfg.features.upload || !file) return null;
      var st = this._st;
      var self = this;
      var msg = existingMsg;
      if (!msg) {
        msg = { id: uid('m'), role: 'user', kind: 'file', content: file.name || 'file', time: Date.now() };
        st.messages.push(msg);
      }
      msg.failed = false;
      st.view = 'chat';
      if (file.size > MAX_UPLOAD_BYTES) {
        msg.failed = true;
        this._render();
        this._setError(BrainboxError('That file is too large. The maximum size is 10 MB.', { code: 'too_large' }), 'upload', null);
        return null;
      }
      msg.status = 'Uploading...';
      st.uploading = true;
      st.error = null;
      this._render();
      this._scrollToBottom(false);
      var gen = this._gen;
      try {
        if (!st.sessionId) {
          try {
            var created = await this.client.createSession(file.name ? 'File: ' + file.name : 'New chat');
            if (gen === this._gen && created && created.session_id) {
              st.sessionId = created.session_id;
              this._writeStore({ sessionId: st.sessionId });
              this._emit('session', { sessionId: st.sessionId });
            }
          } catch (e) { /* upload without a session as a fallback */ }
        }
        var isImage = IMAGE_TYPES.indexOf(file.type) !== -1;
        var res = isImage ? await this.client.uploadImage(file, st.sessionId) : await this.client.uploadFile(file, st.sessionId);
        if (gen !== this._gen) return null;
        msg.status = 'Uploaded';
        this._emit('upload', { file: { name: file.name, size: file.size, type: file.type }, sessionId: st.sessionId, raw: res });
        return res;
      } catch (err) {
        if (gen !== this._gen) return null;
        msg.failed = true;
        msg.status = null;
        this._setError(err, 'upload', err.code === 'network' || err.retryable ? function () { return self._upload(file, msg); } : null);
        return null;
      } finally {
        if (gen === this._gen) {
          st.uploading = false;
          this._render();
        }
      }
    }

    _export() {
      var lines = this._st.messages.map(function (m) {
        return '[' + new Date(m.time).toISOString() + '] ' + (m.role === 'user' ? 'You' : 'Assistant') + ':\n' + m.content + '\n';
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = h('a', { href: url, download: 'conversation-' + (this._st.sessionId || 'new') + '.txt' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      this._emit('export', { count: this._st.messages.length });
    }

    _pushTarget() {
      var cfg = this._cfg;
      if (cfg.sidebarPushContent === null || cfg.sidebarPushContent === false) return null;
      if (cfg.sidebarPushContent === undefined) return document.body;
      return resolveElement(cfg.sidebarPushContent);
    }

    _applyPush() {
      var target = this._pushTarget();
      var shouldPush = this._mode === 'sidebar' && this._st.open && global.innerWidth >= 992 && target;
      if (shouldPush) {
        if (!this._pushState || this._pushState.el !== target) {
          this._restorePush();
          this._pushState = { el: target, prev: target.style.paddingRight };
        }
        var w = px(this._cfg.sidebarWidth, '380px');
        target.style.paddingRight = w;
      } else {
        this._restorePush();
      }
    }

    _restorePush() {
      if (this._pushState) {
        this._pushState.el.style.paddingRight = this._pushState.prev || '';
        this._pushState = null;
      }
    }

    _onResize() {
      if (this._mode === 'sidebar') this._applyPush();
    }

    _onDocClick(e) {
      if (!this._st.emoji || !this._els.emojiWrap) return;
      if (!this._els.emojiWrap.contains(e.target)) this._toggleEmoji(false);
    }

    _onKeydown(e) {
      if (e.key !== 'Escape') return;
      if (this._st.emoji) {
        this._toggleEmoji(false);
        if (this._els.emojiBtn) this._els.emojiBtn.focus();
        e.stopPropagation();
        return;
      }
      if (this._mode === 'page' && this._st.drawer) {
        this._st.drawer = false;
        this._renderPageDrawer();
        return;
      }
      if (this._isOverlayMode() && this._st.open) {
        e.stopPropagation();
        this.close();
        if (this._els.launcher) this._els.launcher.focus();
      }
    }
  }

  /* ======================================================================
   * v1 compatibility layer
   * ==================================================================== */

  /** v1: new BrainboxWebSDK(apiUrl, apiKey, tenantId). Methods now throw a BrainboxError on HTTP errors. */
  function BrainboxWebSDK(apiUrl, apiKey, tenantId) {
    if (!(this instanceof BrainboxWebSDK)) return new BrainboxWebSDK(apiUrl, apiKey, tenantId);
    this.apiUrl = String(apiUrl || '').replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.tenantId = tenantId;
    this.client = new Client({ apiUrl: this.apiUrl, apiKey: apiKey, tenantId: tenantId });
  }
  BrainboxWebSDK.prototype.ingest = function (sourceType, content, filePath, metadata) {
    return this.client.request('POST', '/api/ingest', {
      body: { tenant_id: this.tenantId, source_type: sourceType, content: content, file_path: filePath, metadata: metadata || {} },
      action: 'ingest'
    });
  };
  BrainboxWebSDK.prototype.chat = function (question, sessionId) {
    return this.client.chat(question, sessionId);
  };
  BrainboxWebSDK.prototype.createChatSession = function (title) {
    return this.client.createSession(title || 'New Session');
  };
  BrainboxWebSDK.prototype.listSessions = function () {
    return this.client.listSessions();
  };
  BrainboxWebSDK.prototype.healthCheck = function () {
    return this.client.health();
  };
  /** v1 "streaming": the backend has no streaming endpoint, so the full answer arrives as one chunk. */
  BrainboxWebSDK.prototype.streamChat = async function (question, sessionId, onChunk, onComplete, onError) {
    try {
      var result = await this.chat(question, sessionId);
      if (typeof onChunk === 'function') onChunk(result.response || '');
      if (typeof onComplete === 'function') onComplete(result);
      return result;
    } catch (err) {
      if (typeof onError === 'function') onError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };

  /** v1: new BrainboxWebWidget({ sdk, position, primaryColor, ... }) -> mapped onto Brainbox.init(). */
  function BrainboxWebWidget(options) {
    if (!(this instanceof BrainboxWebWidget)) return new BrainboxWebWidget(options);
    var o = options || {};
    var sdk = o.sdk || {};
    var inline = o.position === 'inline' && o.containerId;
    var cfg = {
      apiUrl: sdk.apiUrl || o.apiUrl || '',
      apiKey: sdk.apiKey || o.apiKey,
      tenantId: sdk.tenantId || o.tenantId,
      mode: inline ? 'inline' : 'floating',
      container: inline ? '#' + String(o.containerId).replace(/^#/, '') : null,
      allowedModes: inline ? ['inline'] : ['floating', 'sidebar'],
      position: String(o.position || '').indexOf('left') !== -1 ? 'bottom-left' : 'bottom-right',
      width: toNumber(o.width, 360),
      height: toNumber(o.height, 560),
      launcher: { type: o.launcherType === 'icon' || o.launcherType === 'gif' ? o.launcherType : 'button', text: o.buttonText || 'Chat', gifUrl: o.launcherGifUrl || null },
      theme: {},
      branding: {},
      placeholder: o.placeholder || 'Type message...',
      storageKey: o.storageKey || 'bb-web-v1'
    };
    if (o.primaryColor) cfg.theme.primary = o.primaryColor;
    if (o.accentColor) cfg.theme.ink = o.accentColor;
    if (o.backgroundColor && !/^#?f{3}(f{3})?$/i.test(String(o.backgroundColor))) cfg.theme.panel = o.backgroundColor;
    if (o.title) { cfg.branding.title = o.title; cfg.branding.botName = o.title; }
    if (o.subtitle) cfg.branding.subtitle = o.subtitle;
    if (o.logoUrl) cfg.branding.logoUrl = o.logoUrl;
    if (o.user) cfg.user = o.user;
    var widget = new Widget(cfg);
    if (o.containerId && !inline && widget._els && widget._els.root && !document.getElementById(o.containerId)) {
      widget._els.root.id = String(o.containerId);
    }
    this.widget = widget;
    this.sdk = o.sdk;
  }
  BrainboxWebWidget.prototype.open = function () { this.widget.open(); };
  BrainboxWebWidget.prototype.close = function () { this.widget.close(); };
  BrainboxWebWidget.prototype.toggleWidget = function () { this.widget.toggle(); };
  BrainboxWebWidget.prototype.sendMessage = function (text) { return this.widget.send(text); };
  BrainboxWebWidget.prototype.destroy = function () { this.widget.destroy(); };

  /* ======================================================================
   * Public namespace
   * ==================================================================== */

  return {
    version: VERSION,
    init: function (options) { return new Widget(options); },
    Client: Client,
    Widget: Widget,
    BrainboxError: BrainboxError,
    renderMarkdown: renderMarkdown,
    instances: instances,
    BrainboxWebSDK: BrainboxWebSDK,
    BrainboxWebWidget: BrainboxWebWidget
  };
});
