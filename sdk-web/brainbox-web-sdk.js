/*!
 * Brainbox Web SDK v2.1.0
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

  var VERSION = '2.1.0';
  var HAS_DOM = typeof document !== 'undefined';
  var MODES = ['floating', 'sidebar', 'inline', 'page'];
  var THEME_MODES = ['light', 'dark', 'auto'];
  var DEFAULT_TIMEOUT = 200000; // /api/chat can take ~180s
  var MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  var EMOJIS = ['\u{1F600}', '\u{1F602}', '\u{1F60D}', '\u{1F44D}', '\u{1F64F}', '\u{1F389}', '\u{1F525}', '❤️', '\u{1F622}', '\u{1F914}', '\u{1F44F}', '✅'];
  var GROUP_GAP_MS = 5 * 60 * 1000;
  var SVG_NS = 'http://www.w3.org/2000/svg';

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

  function mix(c, target, amount) {
    return 'rgb(' + Math.round(c.r + (target.r - c.r) * amount) + ', ' + Math.round(c.g + (target.g - c.g) * amount) + ', ' + Math.round(c.b + (target.b - c.b) * amount) + ')';
  }

  function rgba(c, a) {
    return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')';
  }

  /** Accent family derived from a customer `primary` color (hex: computed; other CSS colors: color-mix). */
  function accentVars(primary) {
    var c = hexToRgb(primary);
    if (c) {
      var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      return {
        '--bb-accent': primary,
        '--bb-accent-hover': mix(c, { r: 255, g: 255, b: 255 }, 0.08),
        '--bb-accent-pressed': mix(c, { r: 0, g: 0, b: 0 }, 0.08),
        '--bb-accent-tint': rgba(c, 0.1),
        '--bb-accent-ring': rgba(c, 0.25),
        '--bb-on-accent': lum > 0.72 ? '#1D1D1F' : '#FFFFFF',
        '--bb-launcher-bg': primary
      };
    }
    return {
      '--bb-accent': primary,
      '--bb-accent-hover': primary,
      '--bb-accent-pressed': primary,
      '--bb-accent-tint': 'color-mix(in srgb, ' + primary + ' 10%, transparent)',
      '--bb-accent-ring': 'color-mix(in srgb, ' + primary + ' 25%, transparent)',
      '--bb-launcher-bg': primary
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

  function formatClock(ts, locale) {
    try {
      return new Intl.DateTimeFormat(locale || undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
    } catch (e) {
      return '';
    }
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function formatDay(ts, locale) {
    var d = new Date(ts);
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (t === start) return 'Today';
    if (t === start - 86400000) return 'Yesterday';
    try {
      var opts = { weekday: 'long', month: 'short', day: 'numeric' };
      if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
      if (start - t < 6 * 86400000) opts = { weekday: 'long' };
      return new Intl.DateTimeFormat(locale || undefined, opts).format(d);
    } catch (e) {
      return d.toDateString();
    }
  }

  function initials(name, fallback) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback || 'You';
    return parts.slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  }

  function mediaMatches(query) {
    try {
      return !!(global.matchMedia && global.matchMedia(query).matches);
    } catch (e) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return mediaMatches('(prefers-reduced-motion: reduce)');
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
   * Sounds: tiny WebAudio synth (no audio files). Same tones as sdk-react's
   * design/sounds.ts. Never throws; silent until the first user gesture.
   * ==================================================================== */

  var TONES = {
    send: [{ freq: 880, to: 1320, start: 0, dur: 0.15, gain: 0.05 }],
    receive: [
      { freq: 1046.5, start: 0, dur: 0.12, gain: 0.04 },
      { freq: 1318.5, start: 0.08, dur: 0.2, gain: 0.04 }
    ],
    notify: [
      { freq: 1046.5, start: 0, dur: 0.16, gain: 0.045 },
      { freq: 1318.5, start: 0.07, dur: 0.16, gain: 0.045 },
      { freq: 1567.98, start: 0.14, dur: 0.16, gain: 0.045 }
    ],
    success: [
      { freq: 1318.5, start: 0, dur: 0.14, gain: 0.04 },
      { freq: 1760, start: 0.09, dur: 0.18, gain: 0.04 }
    ],
    error: [
      { freq: 330, start: 0, dur: 0.09, type: 'triangle', gain: 0.05 },
      { freq: 262, start: 0.1, dur: 0.12, type: 'triangle', gain: 0.05 }
    ]
  };
  var MASTER_VOLUME = 0.6;
  var audioCtx = null;
  var audioUnlocked = false;
  var unlockListening = false;

  function getAudioContext() {
    if (audioCtx) return audioCtx;
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  /** Browsers only allow audio after a user gesture; the AudioContext is created lazily then. */
  function unlockSounds() {
    if (audioUnlocked) return;
    var c = getAudioContext();
    if (!c) return;
    audioUnlocked = true;
    try {
      if (c.state === 'suspended') c.resume().catch(function () { return undefined; });
    } catch (e) { /* ignore */ }
  }

  function listenForAudioUnlock() {
    if (unlockListening || !HAS_DOM || !global.addEventListener) return;
    unlockListening = true;
    var unlock = function () {
      unlockSounds();
      global.removeEventListener('pointerdown', unlock, true);
      global.removeEventListener('keydown', unlock, true);
    };
    global.addEventListener('pointerdown', unlock, true);
    global.addEventListener('keydown', unlock, true);
  }

  function playSound(name, enabled) {
    if (enabled === false || !TONES[name]) return;
    try {
      if (HAS_DOM && document.hidden && name !== 'notify') return;
      if (!audioUnlocked) return; // never create an AudioContext before a user gesture
      var c = getAudioContext();
      if (!c) return;
      var now = c.currentTime + 0.01;
      TONES[name].forEach(function (tone) {
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = tone.type || 'sine';
        osc.frequency.setValueAtTime(tone.freq, now + tone.start);
        if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.start + 0.06);
        var peak = tone.gain * MASTER_VOLUME;
        gain.gain.setValueAtTime(0.0001, now + tone.start);
        gain.gain.exponentialRampToValueAtTime(peak, now + tone.start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + tone.start);
        osc.stop(now + tone.start + tone.dur + 0.02);
      });
    } catch (e) {
      /* sounds are optional */
    }
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

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    return el;
  }

  /* SF-Symbols-like line icons (Lucide geometry), 24x24, stroke 1.75. Each entry: list of [tag, attrs]. */
  var ICONS = {
    x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
    paperclip: [['path', { d: 'm21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l8.8-8.8a4 4 0 0 1 5.7 5.7l-8.9 8.8a2 2 0 1 1-2.8-2.8l8.1-8.1' }]],
    smile: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M8 14s1.5 2 4 2 4-2 4-2' }], ['path', { d: 'M9 9h.01' }], ['path', { d: 'M15 9h.01' }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm20 20-3.5-3.5' }]],
    arrowUp: [['path', { d: 'm5 12 7-7 7 7' }], ['path', { d: 'M12 19V5' }]],
    send: [['path', { d: 'm5 12 7-7 7 7' }], ['path', { d: 'M12 19V5' }]],
    stop: [['rect', { x: 7, y: 7, width: 10, height: 10, rx: 2, fill: 'currentColor', stroke: 'none' }]],
    chat: [['path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }]],
    newchat: [['path', { d: 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }], ['path', { d: 'M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z' }]],
    history: [['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }], ['path', { d: 'M3 3v5h5' }], ['path', { d: 'M12 7v5l4 2' }]],
    dock: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['path', { d: 'M15 3v18' }]],
    undock: [['path', { d: 'M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4' }], ['rect', { x: 12, y: 13, width: 10, height: 7, rx: 2 }]],
    expand: [['path', { d: 'M15 3h6v6' }], ['path', { d: 'M9 21H3v-6' }], ['path', { d: 'M21 3l-7 7' }], ['path', { d: 'M3 21l7-7' }]],
    copy: [['rect', { x: 8, y: 8, width: 14, height: 14, rx: 2 }], ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }]],
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
    refresh: [['path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }]],
    alert: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]],
    warning: [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }], ['path', { d: 'M12 9v4' }], ['path', { d: 'M12 17h.01' }]],
    info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
    file: [['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }], ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }]],
    back: [['path', { d: 'm15 18-6-6 6-6' }]],
    chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
    menu: [['path', { d: 'M4 6h16' }], ['path', { d: 'M4 12h16' }], ['path', { d: 'M4 18h16' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    download: [['path', { d: 'M12 3v12' }], ['path', { d: 'm7 10 5 5 5-5' }], ['path', { d: 'M5 21h14' }]],
    sparkle: [['path', { d: 'm12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z' }], ['path', { d: 'M19 3v4' }], ['path', { d: 'M21 5h-4' }]],
    bulb: [['path', { d: 'M9 18h6' }], ['path', { d: 'M10 22h4' }], ['path', { d: 'M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2Z' }]],
    pie: [['path', { d: 'M21 12a9 9 0 1 1-9-9v9Z' }], ['path', { d: 'M13 3.1A9 9 0 0 1 20.9 11H13Z' }]],
    question: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9.8 9a2.4 2.4 0 0 1 4.4 1.3c0 1.8-2.2 2-2.2 3.7' }], ['path', { d: 'M12 17h.01' }]],
    thumbsUp: [['path', { d: 'M7 10v12' }], ['path', { d: 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z' }]],
    thumbsDown: [['path', { d: 'M17 14V2' }], ['path', { d: 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z' }]],
    volume: [['path', { d: 'M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z' }], ['path', { d: 'M16 9a5 5 0 0 1 0 6' }], ['path', { d: 'M19.4 18.4a9 9 0 0 0 0-12.8' }]],
    volumeOff: [['path', { d: 'M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z' }], ['path', { d: 'm22 9-6 6' }], ['path', { d: 'm16 9 6 6' }]],
    book: [['path', { d: 'M12 7v14' }], ['path', { d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z' }]],
    link: [['path', { d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7' }], ['path', { d: 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' }]]
  };

  function icon(name, size, stroke) {
    var svg = svgEl('svg', {
      width: size || 20,
      height: size || 20,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': stroke || 1.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      class: 'bb-web-icon'
    });
    (ICONS[name] || ICONS.chat).forEach(function (shape) { svg.appendChild(svgEl(shape[0], shape[1])); });
    return svg;
  }

  /* The Brainbox logo (design spec v2). The gradient id is unique per instance in the DOM. */
  var logoCounter = 0;
  function logo(size, label) {
    logoCounter += 1;
    var gid = 'bbLogoG-' + logoCounter;
    var svg = svgEl('svg', { viewBox: '0 0 64 64', width: size || 32, height: size || 32, class: 'bb-web-logo', focusable: 'false' });
    if (label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', label);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    var defs = svgEl('defs');
    var grad = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 });
    grad.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#2F7CF6' }));
    grad.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#5E5CE6' }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(svgEl('rect', { width: 64, height: 64, rx: 15, fill: 'url(#' + gid + ')' }));
    svg.appendChild(svgEl('path', { d: 'M32 15.5 47 24v16L32 48.5 17 40V24z', fill: 'none', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linejoin': 'round' }));
    svg.appendChild(svgEl('path', { d: 'M17 24l15 8.5L47 24M32 32.5v16', fill: 'none', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: '.9' }));
    svg.appendChild(svgEl('circle', { cx: 32, cy: 32.5, r: 3.4, fill: '#fff' }));
    svg.appendChild(svgEl('path', { d: 'M50.5 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z', fill: '#fff' }));
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
        var btn = h('button', { type: 'button', class: 'bb-web-code-copy', 'aria-label': 'Copy code' }, [icon('copy', 13), label]);
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
    if (status === 404) {
      if (action === 'session' || /session/i.test(text)) return 'This conversation no longer exists.';
      if (action === 'feedback') return 'That answer could not be found.';
      return 'The assistant service was not found. Please check the apiUrl setting.';
    }
    if (status === 408 || status === 504) return 'The assistant took too long to answer. Please try again.';
    if (status === 413) return 'That file is too large to upload.';
    if (status === 429) return 'The assistant is busy right now. Please wait a moment and try again.';
    if (status >= 500) return 'The assistant ran into a problem. Please try again in a moment.';
    if (status === 422) return text ? 'Some request details were invalid: ' + (isPlainSentence(text) ? text : 'please try again.') : 'Some request details were invalid.';
    if (isPlainSentence(text)) return text;
    return 'Something went wrong. Please try again.';
  }

  /* ======================================================================
   * Server-Sent Events parser (fetch + ReadableStream; EventSource can't send auth headers)
   * ==================================================================== */

  /** Incremental SSE parser. push() accepts arbitrary text chunks (events may span chunk boundaries). */
  function createSSEParser(onEvent) {
    var buffer = '';
    var eventName = '';
    var data = [];
    function dispatch() {
      if (data.length) onEvent(eventName || 'message', data.join('\n'));
      eventName = '';
      data = [];
    }
    function line(l) {
      if (l === '') { dispatch(); return; }
      if (l.charAt(0) === ':') return; // comment / heartbeat (": ping")
      var idx = l.indexOf(':');
      var field = idx === -1 ? l : l.slice(0, idx);
      var value = idx === -1 ? '' : l.slice(idx + 1);
      if (value.charAt(0) === ' ') value = value.slice(1);
      if (field === 'event') eventName = value;
      else if (field === 'data') data.push(value);
    }
    return {
      push: function (text) {
        buffer += text;
        // a trailing "\r" may be the first half of "\r\n": keep it for the next chunk
        var hold = buffer.charAt(buffer.length - 1) === '\r' ? '\r' : '';
        var body = hold ? buffer.slice(0, -1) : buffer;
        var lines = body.replace(/\r\n|\r/g, '\n').split('\n');
        buffer = lines.pop() + hold;
        lines.forEach(line);
      },
      end: function () {
        if (buffer) { line(buffer.replace(/\r$/, '')); buffer = ''; }
        dispatch();
      }
    };
  }

  /** Remembers backends whose /api/chat/stream is missing (older servers) so we go straight to /api/chat. */
  var STREAM_UNSUPPORTED = {};

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

    _headers(accept, json) {
      var headers = Object.assign({ Accept: accept || 'application/json' }, this.headers);
      if (this.apiKey) headers.Authorization = 'Bearer ' + this.apiKey;
      if (json) headers['Content-Type'] = 'application/json';
      return headers;
    }

    _chatPayload(question, sessionId, context) {
      var q = String(question == null ? '' : question);
      if (context) q = 'Context:\n' + String(context) + '\n\nQuestion:\n' + q;
      var payload = this._scope({ question: q }, true);
      if (sessionId) payload.session_id = sessionId;
      return payload;
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
      var headers = this._headers('application/json', !opts.form && opts.body !== undefined);
      var body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) body = JSON.stringify(opts.body);

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
      return parseJsonResponse(res, raw, opts.action);
    }

    /** POST /api/chat -> { response, reasoning, search_results, session_id, message_id?, user_message_id? } */
    async chat(question, sessionId, context, opts) {
      var payload = this._chatPayload(question, sessionId, context);
      var data = await this.request('POST', '/api/chat', { body: payload, signal: opts && opts.signal, timeout: opts && opts.timeout, action: 'chat' });
      data.response = data.response == null ? '' : String(data.response);
      return data;
    }

    /** True unless this backend already answered /api/chat/stream with 404/405. */
    supportsStreaming() {
      return !STREAM_UNSUPPORTED[this.apiUrl || '/'] && typeof fetch === 'function';
    }

    /**
     * POST /api/chat/stream (Server-Sent Events) with live callbacks. Resolves with the final `done`
     * payload ({ response, reasoning, session_id, message_id, user_message_id, search_results, cached }).
     * opts: { signal, timeout (idle ms), onMeta(meta), onToken(text, fullText), fallback (default true) }
     * When the server has no streaming endpoint (404/405), it falls back to POST /api/chat and calls
     * onToken once with the whole answer. The result carries `streamed: true|false`.
     */
    async chatStream(question, sessionId, context, opts) {
      opts = opts || {};
      var self = this;
      var useFallback = opts.fallback !== false;
      if (!this.supportsStreaming()) {
        if (!useFallback) throw BrainboxError('Streaming is not available on this server.', { code: 'stream_unsupported', retryable: false });
        return this._chatFallback(question, sessionId, context, opts);
      }
      var payload = this._chatPayload(question, sessionId, context);
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var idle = toNumber(opts.timeout, this.timeout);
      var timedOut = false;
      var timer = null;
      function arm() {
        if (!ctrl) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, idle);
      }
      var external = opts.signal;
      var onAbort = function () { if (ctrl) ctrl.abort(); };
      if (external) {
        if (external.aborted) onAbort();
        else external.addEventListener('abort', onAbort);
      }
      function abortError() {
        if (timedOut) return BrainboxError('The assistant took too long to answer. Please try again.', { code: 'timeout' });
        return BrainboxError('Request cancelled.', { code: 'aborted', retryable: false });
      }

      var full = '';
      var done = null;
      var failure = null;
      var parser = createSSEParser(function (name, raw) {
        if (done || failure) return;
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (name === 'meta') {
          if (data && typeof opts.onMeta === 'function') opts.onMeta(data);
        } else if (name === 'token') {
          var t = data && data.t != null ? String(data.t) : '';
          if (t) {
            full += t;
            if (typeof opts.onToken === 'function') opts.onToken(t, full);
          }
        } else if (name === 'done') {
          done = data && typeof data === 'object' ? data : { response: full };
        } else if (name === 'error') {
          var status = data && data.status ? Number(data.status) : 500;
          var text = detailText(data && data.detail);
          failure = BrainboxError(isPlainSentence(text) ? text : friendlyMessage(status, data && data.detail, 'chat'), {
            status: status, code: 'stream_error', detail: data && data.detail, retryable: true
          });
        }
      });

      var res;
      try {
        arm();
        res = await fetch(this.apiUrl + '/api/chat/stream', {
          method: 'POST',
          headers: this._headers('text/event-stream', true),
          body: JSON.stringify(payload),
          credentials: this.credentials,
          signal: ctrl ? ctrl.signal : undefined
        });
        var type = (res.headers && res.headers.get('content-type')) || '';
        if (!res.ok || type.indexOf('text/event-stream') === -1) {
          var raw = await res.text();
          if (res.status === 405 || res.status === 501 || (res.status === 404 && isRouteMissing(raw))) {
            STREAM_UNSUPPORTED[this.apiUrl || '/'] = true;
            if (!useFallback) throw BrainboxError('Streaming is not available on this server.', { code: 'stream_unsupported', status: res.status, retryable: false });
            if (timer) clearTimeout(timer);
            return await self._chatFallback(question, sessionId, context, opts);
          }
          // a 200 JSON answer (e.g. a proxy that does not stream) is still a valid chat result
          var json = parseJsonResponse(res, raw, 'chat');
          json.response = json.response == null ? '' : String(json.response);
          if (typeof opts.onToken === 'function' && json.response) opts.onToken(json.response, json.response);
          json.streamed = false;
          return json;
        }
        var decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
        if (res.body && typeof res.body.getReader === 'function' && decoder) {
          var reader = res.body.getReader();
          for (;;) {
            var chunk = await reader.read();
            if (chunk.done) break;
            arm();
            parser.push(decoder.decode(chunk.value, { stream: true }));
            if (done || failure) {
              try { reader.cancel(); } catch (e) { /* ignore */ }
              break;
            }
          }
          parser.push(decoder.decode());
        } else {
          parser.push(await res.text()); // no ReadableStream: still correct, just not incremental
        }
        parser.end();
      } catch (err) {
        if (err && err.name === 'BrainboxError') throw err;
        if ((ctrl && ctrl.signal.aborted) || (err && err.name === 'AbortError')) throw abortError();
        throw BrainboxError(NETWORK_MESSAGE, { code: 'network' });
      } finally {
        if (timer) clearTimeout(timer);
        if (external) external.removeEventListener('abort', onAbort);
      }
      if (failure) {
        failure.partial = full;
        throw failure;
      }
      if (!done) {
        var cut = BrainboxError('The answer was interrupted. Please try again.', { code: 'stream_incomplete' });
        cut.partial = full;
        throw cut;
      }
      done.response = done.response == null ? full : String(done.response);
      done.streamed = true;
      return done;
    }

    async _chatFallback(question, sessionId, context, opts) {
      var data = await this.chat(question, sessionId, context, { signal: opts.signal, timeout: opts.totalTimeout });
      if (typeof opts.onToken === 'function' && data.response) opts.onToken(data.response, data.response);
      data.streamed = false;
      return data;
    }

    /** POST /api/chat/feedback { session_id, message_id?, rating: 'up'|'down', comment? } -> { ok } */
    sendFeedback(payload, opts) {
      var p = payload || {};
      var body = this._scope({ session_id: p.session_id || p.sessionId, rating: p.rating });
      var mid = p.message_id != null ? p.message_id : p.messageId;
      if (mid != null && mid !== '') body.message_id = Number(mid);
      if (p.comment) body.comment = String(p.comment);
      return this.request('POST', '/api/chat/feedback', { body: body, signal: opts && opts.signal, action: 'feedback' });
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

  /** A 404 that means "no such route" (FastAPI "Not Found", a proxy's "Not found.", or a non-JSON page). */
  function isRouteMissing(raw) {
    var data = null;
    try { data = JSON.parse(raw || 'null'); } catch (e) { return true; }
    if (!data || typeof data !== 'object') return true;
    return /^\s*not found\.?\s*$/i.test(detailText(data.detail));
  }

  function parseJsonResponse(res, raw, action) {
    var data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    }
    if (!res.ok) {
      var detail = data && typeof data === 'object' ? data.detail : undefined;
      throw BrainboxError(friendlyMessage(res.status, detail, action), {
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

  var GROUPS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'Previous 7 days' },
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

  /** Normalize backend search_results into { title, snippet, url } items for the "Sources" disclosure. */
  function normalizeSources(list) {
    if (!Array.isArray(list)) return null;
    var seen = {};
    var out = [];
    list.forEach(function (r, i) {
      if (!r || typeof r !== 'object') return;
      var meta = isPlainObject(r.metadata) ? r.metadata : {};
      var path = r.file_path || meta.file_path || meta.source_path || '';
      var base = path ? String(path).split(/[\\/]/).pop() : '';
      var title = r.title || meta.title || r.file_name || meta.file_name || base || r.name || (r.source ? String(r.source) : '') || ('Source ' + (i + 1));
      var url = safeUrl(r.url || meta.url || (/^https?:\/\//i.test(path) ? path : ''));
      var snippet = String(r.content || r.text || r.snippet || '').replace(/\s+/g, ' ').trim();
      var key = title + '|' + snippet.slice(0, 40);
      if (seen[key]) return;
      seen[key] = true;
      out.push({ title: String(title), snippet: snippet.length > 220 ? snippet.slice(0, 217) + '…' : snippet, url: url, type: r.source ? String(r.source) : '' });
    });
    return out.length ? out : null;
  }

  /* ======================================================================
   * Styles (injected once, every selector scoped under .bb-web-root).
   * Brainbox design system v2: calm, light, hairlines, minimal shadows.
   * ==================================================================== */

  var CSS = [
    /* --- tokens (light) --- */
    '.bbr{--bb-font:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Inter","Segoe UI Variable Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--bb-mono:"SF Mono",ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;',
    '--bb-bg:#F5F5F7;--bb-surface:#FFFFFF;--bb-surface-2:#FBFBFD;--bb-fill:rgba(120,120,128,.08);--bb-fill-strong:rgba(120,120,128,.14);',
    '--bb-label:#1D1D1F;--bb-secondary:#6E6E73;--bb-tertiary:#86868B;--bb-quaternary:#AEAEB2;--bb-separator:rgba(60,60,67,.12);--bb-separator-strong:rgba(60,60,67,.2);',
    '--bb-accent:#0071E3;--bb-accent-hover:#0077ED;--bb-accent-pressed:#006EDB;--bb-accent-tint:rgba(0,113,227,.10);--bb-accent-ring:rgba(0,113,227,.25);--bb-on-accent:#FFFFFF;',
    '--bb-indigo:#5E5CE6;--bb-success:#34C759;--bb-success-text:#248A3D;--bb-success-tint:rgba(52,199,89,.12);--bb-warning:#FF9F0A;--bb-warning-text:#B25000;--bb-warning-tint:rgba(255,159,10,.14);--bb-danger:#FF3B30;--bb-danger-text:#D70015;--bb-danger-tint:rgba(255,59,48,.10);',
    '--bb-bot-bubble:#F2F2F7;--bb-material:rgba(255,255,255,.72);--bb-gradient:linear-gradient(135deg,#2F7CF6 0%,#5E5CE6 100%);--bb-launcher-bg:var(--bb-gradient);',
    '--bb-shadow-pop:0 8px 28px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06);--bb-shadow-window:0 12px 40px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.08);--bb-shadow-launcher:0 4px 14px rgba(0,0,0,.14);',
    '--bb-spring:cubic-bezier(.32,.72,0,1);--bb-ease:cubic-bezier(.25,.1,.25,1);',
    '--bb-radius:18px;--bb-z:9999;--bb-w:380px;--bb-h:600px;--bb-ox:24px;--bb-oy:24px;--bb-sb-w:380px;--bb-sb-top:0px;',
    'font-family:var(--bb-font);font-size:15px;font-weight:400;line-height:1.45;color:var(--bb-label);letter-spacing:normal;text-align:left;text-transform:none;text-indent:0;word-spacing:normal;direction:ltr;',
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;color-scheme:light;}',
    /* --- tokens (dark) --- */
    '.bbr.bb-web-dark{--bb-bg:#000000;--bb-surface:#1C1C1E;--bb-surface-2:#2C2C2E;--bb-fill:rgba(120,120,128,.24);--bb-fill-strong:rgba(120,120,128,.32);',
    '--bb-label:#F5F5F7;--bb-secondary:#A1A1A6;--bb-tertiary:#8E8E93;--bb-quaternary:#636366;--bb-separator:rgba(84,84,88,.6);--bb-separator-strong:rgba(84,84,88,.8);',
    '--bb-accent:#0A84FF;--bb-accent-hover:#409CFF;--bb-accent-pressed:#0071E3;--bb-accent-tint:rgba(10,132,255,.18);--bb-accent-ring:rgba(10,132,255,.35);',
    '--bb-success-text:#30D158;--bb-success-tint:rgba(48,209,88,.16);--bb-warning-text:#FFB340;--bb-warning-tint:rgba(255,159,10,.18);--bb-danger-text:#FF6961;--bb-danger-tint:rgba(255,69,58,.16);',
    '--bb-bot-bubble:#2C2C2E;--bb-material:rgba(28,28,30,.72);',
    '--bb-shadow-pop:0 8px 28px rgba(0,0,0,.4),0 0 0 .5px rgba(255,255,255,.1);--bb-shadow-window:0 12px 40px rgba(0,0,0,.5),0 0 0 .5px rgba(255,255,255,.12);--bb-shadow-launcher:0 4px 14px rgba(0,0,0,.4);color-scheme:dark;}',

    /* --- host-CSS resets --- */
    '.bbr *,.bbr *::before,.bbr *::after{box-sizing:border-box;}',
    '.bbr h1,.bbr h2,.bbr h3,.bbr p,.bbr ul,.bbr ol,.bbr li,.bbr form,.bbr label,.bbr pre,.bbr table,.bbr nav,.bbr aside,.bbr main,.bbr section,.bbr header{margin:0;padding:0;font-family:inherit;letter-spacing:normal;text-transform:none;border:0;background:none;box-shadow:none;}',
    '.bbr h1,.bbr h2,.bbr h3{color:inherit;font-weight:600;}',
    '.bbr button,.bbr input,.bbr textarea{font-family:inherit;font-size:inherit;line-height:normal;letter-spacing:normal;text-transform:none;margin:0;color:inherit;}',
    '.bbr button{-webkit-appearance:none;appearance:none;background:none;border:0;border-radius:0;padding:0;min-width:0;min-height:0;width:auto;height:auto;box-shadow:none;text-shadow:none;cursor:pointer;font-weight:inherit;-webkit-tap-highlight-color:transparent;',
    'transition:transform 80ms var(--bb-ease),box-shadow 120ms var(--bb-ease),background-color 120ms var(--bb-ease),color 120ms var(--bb-ease),opacity 120ms var(--bb-ease);}',
    '.bbr button:active:not(:disabled){transform:scale(.97);}',
    '.bbr button:focus,.bbr a:focus,.bbr input:focus,.bbr textarea:focus{outline:none;}',
    '.bbr button:focus-visible,.bbr a:focus-visible{outline:none;box-shadow:0 0 0 3px var(--bb-accent-ring);}',
    '.bbr button:disabled{cursor:default;}',
    '.bbr input,.bbr textarea{box-shadow:none;border-radius:0;border:0;background:transparent;padding:0;}',
    '.bbr svg{display:block;flex:0 0 auto;overflow:visible;}',
    '.bbr svg.bb-web-icon{fill:none;vertical-align:middle;}',
    '.bbr img{max-width:100%;border:0;}',
    '.bbr a{color:var(--bb-accent);}',
    '.bbr .bb-web-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
    '.bbr .bb-web-is-closed{display:none!important;}',

    /* --- motion --- */
    '@keyframes bb-web-open{from{opacity:0;transform:translateY(12px) scale(.98);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-close{from{opacity:1;transform:none;}to{opacity:0;transform:translateY(12px) scale(.98);}}',
    '@keyframes bb-web-slide{from{opacity:0;transform:translateX(24px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-sheet{from{opacity:.4;transform:translateY(32px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-msg{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-fade{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-pop{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-scale-in{from{opacity:0;transform:scale(.6);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-toast-in{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-toast-out{from{opacity:1;transform:none;}to{opacity:0;transform:translateY(4px) scale(.98);}}',
    '@keyframes bb-web-dot{0%,80%,100%{opacity:.3;transform:scale(.8);}40%{opacity:1;transform:scale(1);}}',
    '@keyframes bb-web-blink{0%,100%{opacity:.85;}50%{opacity:.15;}}',
    '@keyframes bb-web-shimmer{from{background-position:150% 0;}to{background-position:-50% 0;}}',
    '@keyframes bb-web-spin{to{transform:rotate(360deg);}}',
    '@keyframes bb-web-rotate-in{from{opacity:0;transform:rotate(-90deg) scale(.7);}to{opacity:1;transform:none;}}',

    /* --- host containers --- */
    '.bbr.bb-web-host{position:fixed;top:0;left:0;width:0;height:0;z-index:var(--bb-z);}',
    '.bbr .bb-web-float{position:fixed;bottom:var(--bb-oy);right:var(--bb-ox);display:flex;flex-direction:column;align-items:flex-end;gap:16px;pointer-events:none;z-index:2;}',
    '.bbr.bb-web-left .bb-web-float{right:auto;left:var(--bb-ox);align-items:flex-start;}',
    '.bbr .bb-web-float>*{pointer-events:auto;}',
    '.bbr .bb-web-window{width:var(--bb-w);max-width:calc(100vw - 2 * var(--bb-ox));transform-origin:bottom right;animation:bb-web-open 320ms var(--bb-spring);}',
    '.bbr.bb-web-left .bb-web-window{transform-origin:bottom left;}',
    '.bbr .bb-web-window.is-leaving{animation:bb-web-close 200ms var(--bb-ease) forwards;pointer-events:none;}',
    '.bbr .bb-web-window .bb-web-panel{height:min(var(--bb-h),calc(100vh - var(--bb-oy) - 96px));box-shadow:var(--bb-shadow-window);}',

    /* --- launcher --- */
    '.bbr .bb-web-launcher{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:56px;height:56px;padding:0;border-radius:999px;color:#fff;background:var(--bb-launcher-bg);box-shadow:var(--bb-shadow-launcher);animation:bb-web-scale-in 320ms var(--bb-spring);}',
    '.bbr .bb-web-launcher:hover:not(:disabled){transform:scale(1.04);}',
    '.bbr .bb-web-launcher:active:not(:disabled){transform:scale(.97);}',
    '.bbr .bb-web-launcher:focus-visible{box-shadow:var(--bb-shadow-launcher),0 0 0 4px var(--bb-accent-ring);}',
    '.bbr .bb-web-launcher .bb-web-icon{animation:bb-web-rotate-in 220ms var(--bb-spring);}',
    '.bbr .bb-web-launcher.is-button{width:auto;height:48px;padding:0 20px 0 16px;font-size:15px;font-weight:500;white-space:nowrap;}',
    '.bbr .bb-web-launcher.is-button.is-open{width:48px;padding:0;}',
    '.bbr .bb-web-launcher.is-gif{width:64px;height:64px;background:var(--bb-surface);}',
    '.bbr .bb-web-launcher.is-gif img{width:100%;height:100%;object-fit:cover;display:block;border-radius:999px;}',
    '.bbr .bb-web-launcher.is-gif.is-open{width:56px;height:56px;background:var(--bb-launcher-bg);}',
    '.bbr .bb-web-badge{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:var(--bb-danger);color:#fff;font-size:12px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px var(--bb-surface);animation:bb-web-scale-in 260ms var(--bb-spring);}',
    '.bbr.bb-web-left .bb-web-badge{right:auto;left:-3px;}',

    /* --- panel --- */
    '.bbr .bb-web-panel{width:100%;min-height:0;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--bb-radius);background:var(--bb-surface);color:var(--bb-label);outline:none;isolation:isolate;}',
    '.bbr .bb-web-header{flex:0 0 auto;position:relative;z-index:3;min-height:56px;padding:10px 10px 10px 14px;display:flex;align-items:center;gap:10px;background:var(--bb-material);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--bb-separator);}',
    '.bbr .bb-web-hlogo{width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;border-radius:8px;overflow:hidden;}',
    '.bbr .bb-web-hlogo svg{width:32px;height:32px;}',
    '.bbr .bb-web-hlogo img,.bbr .bb-web-av img,.bbr .bb-web-page-logo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.bbr .bb-web-header-copy{flex:1;min-width:0;}',
    '.bbr .bb-web-title{font-size:15px;line-height:1.25;font-weight:600;color:var(--bb-label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-subtitle{display:flex;align-items:center;gap:6px;margin-top:1px;font-size:12px;line-height:1.3;color:var(--bb-secondary);white-space:nowrap;overflow:hidden;}',
    '.bbr .bb-web-subtitle span{overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-dot-online{width:6px;height:6px;flex:0 0 6px;border-radius:999px;background:var(--bb-success);}',
    '.bbr .bb-web-header-actions{display:flex;align-items:center;gap:2px;flex:0 0 auto;}',
    '.bbr .bb-web-hbtn{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;flex:0 0 auto;color:var(--bb-secondary);}',
    '.bbr .bb-web-hbtn:hover:not(:disabled){background:var(--bb-fill);color:var(--bb-label);}',
    '.bbr .bb-web-hbtn.is-active{background:var(--bb-accent-tint);color:var(--bb-accent);}',
    '.bbr .bb-web-body{flex:1;min-height:0;position:relative;display:flex;flex-direction:column;background:var(--bb-surface);}',
    '.bbr .bb-web-transcript{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 14px 12px;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:var(--bb-fill-strong) transparent;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar{width:8px;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar-thumb{background:var(--bb-fill-strong);border-radius:999px;border:2px solid var(--bb-surface);}',
    '.bbr .bb-web-log{flex:1 0 auto;display:flex;flex-direction:column;}',
    '.bbr .bb-web-log>:first-child{margin-top:auto;}',

    /* --- welcome / empty state --- */
    '.bbr .bb-web-welcome{display:flex;flex-direction:column;align-items:center;text-align:center;padding:24px 8px 16px;margin-bottom:auto;animation:bb-web-fade 320ms var(--bb-ease);}',
    '.bbr .bb-web-welcome-logo{width:56px;height:56px;border-radius:13px;overflow:hidden;display:grid;place-items:center;}',
    '.bbr .bb-web-welcome-logo svg,.bbr .bb-web-welcome-logo img{width:56px;height:56px;object-fit:cover;}',
    '.bbr .bb-web-welcome-title{margin-top:14px;font-size:20px;line-height:1.2;font-weight:600;letter-spacing:-.01em;color:var(--bb-label);}',
    '.bbr .bb-web-welcome-text{margin-top:6px;max-width:300px;font-size:14px;line-height:1.45;color:var(--bb-secondary);}',
    '.bbr .bb-web-welcome-text+.bb-web-welcome-text{margin-top:4px;}',
    '.bbr .bb-web-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:18px;}',
    '.bbr .bb-web-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:32px;padding:6px 12px;border-radius:999px;background:var(--bb-fill);color:var(--bb-label);font-size:13px;font-weight:500;line-height:1.3;text-align:left;}',
    '.bbr .bb-web-chip .bb-web-icon{color:var(--bb-accent);}',
    '.bbr .bb-web-chip:hover:not(:disabled){background:var(--bb-fill-strong);}',

    /* --- messages --- */
    '.bbr .bb-web-day{align-self:center;margin:16px 0 6px;font-size:11px;line-height:1.3;font-weight:500;color:var(--bb-tertiary);}',
    '.bbr .bb-web-row{display:flex;align-items:flex-end;gap:8px;margin-top:2px;}',
    '.bbr .bb-web-row.is-first{margin-top:12px;}',
    '.bbr .bb-web-day+.bb-web-row{margin-top:4px;}',
    '.bbr .bb-web-row.is-user{flex-direction:row-reverse;}',
    '.bbr .bb-web-row.is-new{animation:bb-web-msg 220ms var(--bb-spring);}',
    '.bbr .bb-web-av{width:28px;height:28px;flex:0 0 28px;border-radius:7px;overflow:hidden;display:grid;place-items:center;visibility:hidden;align-self:flex-start;}',
    '.bbr .bb-web-av svg{width:28px;height:28px;}',
    '.bbr .bb-web-row.is-first .bb-web-av{visibility:visible;}',
    '.bbr .bb-web-col{display:flex;flex-direction:column;align-items:flex-start;max-width:78%;min-width:0;}',
    '.bbr .bb-web-row.is-user .bb-web-col{align-items:flex-end;}',
    '.bbr .bb-web-bubble{max-width:100%;padding:9px 13px;border-radius:18px;background:var(--bb-bot-bubble);color:var(--bb-label);font-size:15px;line-height:1.45;overflow-wrap:anywhere;}',
    '.bbr .bb-web-row.is-bot .bb-web-bubble{border-bottom-left-radius:6px;}',
    '.bbr .bb-web-row.is-bot:not(.is-first) .bb-web-bubble{border-top-left-radius:6px;}',
    '.bbr .bb-web-row.is-user .bb-web-bubble{background:var(--bb-accent);color:var(--bb-on-accent);border-bottom-right-radius:6px;}',
    '.bbr .bb-web-row.is-user:not(.is-first) .bb-web-bubble{border-top-right-radius:6px;}',
    '.bbr .bb-web-row.is-failed .bb-web-bubble{opacity:.55;}',
    '.bbr .bb-web-user-text{white-space:pre-wrap;}',
    '.bbr .bb-web-file{display:inline-flex;align-items:center;gap:8px;}',
    '.bbr .bb-web-file-tile{width:28px;height:28px;flex:0 0 28px;border-radius:7px;display:grid;place-items:center;background:rgba(255,255,255,.22);color:inherit;font-size:9px;font-weight:600;letter-spacing:.02em;}',
    '.bbr .bb-web-htime{align-self:center;flex:0 0 auto;font-size:11px;color:var(--bb-tertiary);opacity:0;transition:opacity 120ms var(--bb-ease);white-space:nowrap;font-variant-numeric:tabular-nums;pointer-events:none;}',
    '.bbr .bb-web-row:hover .bb-web-htime{opacity:1;}',
    '.bbr .bb-web-row.is-last .bb-web-htime{display:none;}',
    '.bbr .bb-web-foot{display:flex;align-items:center;gap:2px;min-height:0;margin-top:3px;font-size:11px;line-height:1.3;color:var(--bb-tertiary);font-variant-numeric:tabular-nums;}',
    '.bbr .bb-web-row.is-user .bb-web-foot{flex-direction:row-reverse;}',
    '.bbr .bb-web-foot:empty{display:none;}',
    '.bbr .bb-web-time{display:none;padding:0 4px;}',
    '.bbr .bb-web-row.is-last .bb-web-time{display:inline;}',
    '.bbr .bb-web-status{padding:0 4px;display:inline-flex;align-items:center;gap:4px;}',
    '.bbr .bb-web-status.is-error{color:var(--bb-danger-text);}',
    '.bbr .bb-web-acts{display:flex;align-items:center;gap:0;opacity:0;transition:opacity 120ms var(--bb-ease);}',
    '.bbr .bb-web-row:hover .bb-web-acts,.bbr .bb-web-row:focus-within .bb-web-acts,.bbr .bb-web-row.is-latest .bb-web-acts{opacity:1;}',
    '@media (hover:none){.bbr .bb-web-acts{opacity:1;}}',
    '.bbr .bb-web-act{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;color:var(--bb-tertiary);}',
    '.bbr .bb-web-act:hover:not(:disabled){background:var(--bb-fill);color:var(--bb-label);}',
    '.bbr .bb-web-act.is-on{color:var(--bb-accent);}',
    '.bbr .bb-web-act.is-on .bb-web-icon{fill:var(--bb-accent-tint);}',
    '.bbr .bb-web-act:disabled{opacity:.5;}',
    '.bbr .bb-web-srcbtn{display:inline-flex;align-items:center;gap:4px;height:24px;margin-left:4px;padding:0 8px 0 7px;border-radius:999px;background:var(--bb-fill);color:var(--bb-secondary);font-size:12px;font-weight:500;}',
    '.bbr .bb-web-srcbtn:hover:not(:disabled){background:var(--bb-fill-strong);color:var(--bb-label);}',
    '.bbr .bb-web-srcbtn .bb-web-chev{transition:transform 180ms var(--bb-spring);}',
    '.bbr .bb-web-srcbtn[aria-expanded="true"] .bb-web-chev{transform:rotate(180deg);}',
    '.bbr .bb-web-sources{display:grid;gap:6px;width:100%;max-width:340px;margin-top:6px;animation:bb-web-pop 180ms var(--bb-spring);transform-origin:top left;}',
    '.bbr .bb-web-source{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:10px;border:1px solid var(--bb-separator);background:var(--bb-surface);color:var(--bb-label);text-decoration:none;}',
    'a.bb-web-source:hover{background:var(--bb-fill);}',
    '.bbr .bb-web-source-n{width:20px;height:20px;flex:0 0 20px;border-radius:6px;display:grid;place-items:center;background:var(--bb-accent-tint);color:var(--bb-accent);font-size:11px;font-weight:600;}',
    '.bbr .bb-web-source-copy{min-width:0;}',
    '.bbr .bb-web-source-title{font-size:13px;font-weight:500;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.bbr .bb-web-source-snip{margin-top:2px;font-size:12px;line-height:1.4;color:var(--bb-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',

    /* streaming caret + typing */
    '.bbr .bb-web-caret{display:inline-block;width:.42em;height:1.05em;margin-left:2px;vertical-align:-.17em;border-radius:1.5px;background:currentColor;opacity:.6;animation:bb-web-blink 1s var(--bb-ease) infinite;}',
    '.bbr .bb-web-typing{display:inline-flex;align-items:center;gap:4px;height:38px;padding:0 14px;border-radius:18px 18px 18px 6px;background:var(--bb-bot-bubble);}',
    '.bbr .bb-web-typing i{width:6px;height:6px;border-radius:999px;background:var(--bb-tertiary);animation:bb-web-dot 1.2s var(--bb-ease) infinite;}',
    '.bbr .bb-web-typing i:nth-child(2){animation-delay:.15s;}',
    '.bbr .bb-web-typing i:nth-child(3){animation-delay:.3s;}',
    '.bbr .bb-web-typing-hint{margin-top:4px;font-size:11px;color:var(--bb-tertiary);min-height:14px;}',
    '.bbr .bb-web-spinner{display:inline-block;width:12px;height:12px;border-radius:999px;border:1.75px solid var(--bb-fill-strong);border-top-color:var(--bb-secondary);animation:bb-web-spin .8s linear infinite;}',

    /* skeletons */
    '.bbr .bb-web-skel{display:grid;gap:10px;padding:12px 0;margin-bottom:auto;}',
    '.bbr .bb-web-skel i{display:block;height:36px;border-radius:18px;background:linear-gradient(90deg,var(--bb-fill) 25%,var(--bb-fill-strong) 50%,var(--bb-fill) 75%);background-size:200% 100%;animation:bb-web-shimmer 1.4s linear infinite;}',
    '.bbr .bb-web-skel i:nth-child(odd){width:62%;justify-self:start;border-bottom-left-radius:6px;}',
    '.bbr .bb-web-skel i:nth-child(even){width:46%;justify-self:end;border-bottom-right-radius:6px;}',
    '.bbr .bb-web-skel i:nth-child(3){height:58px;width:72%;}',
    '.bbr .bb-web-skel.is-list i{width:100%!important;height:34px;border-radius:8px;justify-self:stretch;}',

    /* markdown */
    '.bbr .bb-web-md p{margin:0 0 8px;}',
    '.bbr .bb-web-md>:last-child{margin-bottom:0;}',
    '.bbr .bb-web-md a{color:var(--bb-accent);text-decoration:none;}',
    '.bbr .bb-web-md a:hover{text-decoration:underline;text-underline-offset:2px;}',
    '.bbr .bb-web-md strong{font-weight:600;}',
    '.bbr .bb-web-md em{font-style:italic;}',
    '.bbr .bb-web-md-h{font-size:15px;font-weight:600;line-height:1.35;margin:10px 0 4px;}',
    '.bbr .bb-web-md-h:first-child{margin-top:0;}',
    '.bbr .bb-web-md .bb-web-md-list{margin:2px 0 8px;padding-left:20px;}',
    '.bbr .bb-web-md ul.bb-web-md-list{list-style:disc;}',
    '.bbr .bb-web-md ol.bb-web-md-list{list-style:decimal;}',
    '.bbr .bb-web-md .bb-web-md-list li{margin-bottom:2px;display:list-item;}',
    '.bbr .bb-web-icode{padding:1px 5px;border-radius:5px;background:var(--bb-fill-strong);font-family:var(--bb-mono);font-size:13px;}',
    '.bbr .bb-web-code{margin:8px 0;border-radius:10px;overflow:hidden;background:var(--bb-surface-2);border:1px solid var(--bb-separator);}',
    '.bbr.bb-web-dark .bb-web-code{background:#000;}',
    '.bbr .bb-web-code pre{margin:0;padding:10px 12px;overflow-x:auto;background:transparent;border:0;font-family:var(--bb-mono);font-size:13px;line-height:1.5;color:var(--bb-label);white-space:pre;}',
    '.bbr .bb-web-code code{color:inherit;background:transparent;font-family:inherit;padding:0;}',
    '.bbr .bb-web-code-head{display:flex;justify-content:space-between;align-items:center;min-height:30px;padding:0 6px 0 12px;border-bottom:1px solid var(--bb-separator);color:var(--bb-secondary);font-size:12px;}',
    '.bbr .bb-web-code-copy{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border-radius:6px;color:var(--bb-secondary);font-size:12px;font-weight:500;}',
    '.bbr .bb-web-code-copy:hover:not(:disabled){background:var(--bb-fill);color:var(--bb-label);}',
    '.bbr .bb-web-table-wrap{overflow-x:auto;margin:8px 0;}',
    '.bbr .bb-web-table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.4;}',
    '.bbr .bb-web-table th,.bbr .bb-web-table td{border:0;border-bottom:1px solid var(--bb-separator);padding:6px 10px 6px 0;text-align:left;vertical-align:top;}',
    '.bbr .bb-web-table th{font-weight:500;color:var(--bb-secondary);}',
    '.bbr .bb-web-table tr:last-child td{border-bottom:0;}',

    /* --- bottom area: toasts, error banner, composer --- */
    '.bbr .bb-web-bottom{flex:0 0 auto;position:relative;z-index:2;padding:0 12px 12px;background:var(--bb-surface);}',
    '.bbr .bb-web-toasts{position:absolute;left:12px;right:12px;bottom:calc(100% + 4px);display:flex;flex-direction:column;align-items:stretch;gap:8px;pointer-events:none;z-index:4;}',
    '.bbr .bb-web-toast{display:flex;align-items:flex-start;gap:10px;padding:10px 10px 10px 12px;border-radius:12px;background:var(--bb-material);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);box-shadow:var(--bb-shadow-pop);pointer-events:auto;animation:bb-web-toast-in 260ms var(--bb-spring);}',
    '.bbr .bb-web-toast.is-leaving{animation:bb-web-toast-out 200ms var(--bb-ease) forwards;}',
    '.bbr .bb-web-toast-ic{width:20px;height:20px;flex:0 0 20px;margin-top:1px;border-radius:999px;display:grid;place-items:center;color:#fff;background:var(--bb-accent);}',
    '.bbr .bb-web-toast.is-success .bb-web-toast-ic{background:var(--bb-success);}',
    '.bbr .bb-web-toast.is-error .bb-web-toast-ic{background:var(--bb-danger);}',
    '.bbr .bb-web-toast.is-warning .bb-web-toast-ic{background:var(--bb-warning);}',
    '.bbr .bb-web-toast-copy{flex:1;min-width:0;padding-top:1px;}',
    '.bbr .bb-web-toast-title{font-size:13px;line-height:1.35;font-weight:600;color:var(--bb-label);}',
    '.bbr .bb-web-toast-body{font-size:13px;line-height:1.35;color:var(--bb-secondary);margin-top:1px;}',
    '.bbr .bb-web-toast-action{flex:0 0 auto;height:24px;padding:0 8px;border-radius:6px;color:var(--bb-accent);font-size:13px;font-weight:500;}',
    '.bbr .bb-web-toast-action:hover:not(:disabled){background:var(--bb-accent-tint);}',
    '.bbr .bb-web-toast-x{width:22px;height:22px;flex:0 0 22px;border-radius:999px;display:grid;place-items:center;color:var(--bb-tertiary);}',
    '.bbr .bb-web-toast-x:hover:not(:disabled){background:var(--bb-fill);color:var(--bb-label);}',
    '.bbr .bb-web-error{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 6px 8px 12px;border-radius:12px;background:var(--bb-danger-tint);color:var(--bb-danger-text);font-size:13px;line-height:1.35;animation:bb-web-pop 180ms var(--bb-spring);}',
    '.bbr .bb-web-error-text{flex:1;min-width:0;}',
    '.bbr .bb-web-error-btn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:8px;background:var(--bb-surface);color:var(--bb-danger-text);font-size:13px;font-weight:500;}',
    '.bbr .bb-web-error-x{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;color:var(--bb-danger-text);}',
    '.bbr .bb-web-error-x:hover:not(:disabled){background:var(--bb-danger-tint);}',
    '.bbr .bb-web-composer{display:flex;align-items:flex-end;gap:2px;padding:4px;border-radius:20px;background:var(--bb-fill);transition:background-color 120ms var(--bb-ease),box-shadow 120ms var(--bb-ease);}',
    '.bbr .bb-web-composer:focus-within{background:var(--bb-surface);box-shadow:0 0 0 1px var(--bb-separator-strong),0 0 0 4px var(--bb-accent-ring);}',
    '.bbr .bb-web-composer textarea{flex:1;min-width:0;display:block;min-height:32px;max-height:140px;height:32px;padding:6px 6px;border:0;outline:0;resize:none;overflow-y:hidden;color:var(--bb-label);background:transparent;font-size:15px;line-height:20px;}',
    '.bbr .bb-web-composer textarea::placeholder{color:var(--bb-tertiary);opacity:1;}',
    '.bbr .bb-web-tool{width:32px;height:32px;flex:0 0 32px;border-radius:999px;display:grid;place-items:center;color:var(--bb-secondary);}',
    '.bbr .bb-web-tool:hover:not(:disabled){background:var(--bb-fill-strong);color:var(--bb-label);}',
    '.bbr .bb-web-tool:disabled{opacity:.45;}',
    '.bbr .bb-web-send{width:32px;height:32px;flex:0 0 32px;border-radius:999px;display:grid;place-items:center;color:var(--bb-on-accent);background:var(--bb-accent);}',
    '.bbr .bb-web-send:hover:not(:disabled){background:var(--bb-accent-hover);}',
    '.bbr .bb-web-send:active:not(:disabled){background:var(--bb-accent-pressed);}',
    '.bbr .bb-web-send:disabled{background:var(--bb-fill-strong);color:var(--bb-quaternary);}',
    '.bbr .bb-web-send .bb-web-icon{animation:bb-web-pop 180ms var(--bb-spring);}',
    '.bbr .bb-web-file-input{display:none!important;}',
    '.bbr .bb-web-emoji-wrap{position:relative;display:flex;}',
    '.bbr .bb-web-emoji-pop{position:absolute;bottom:40px;right:-36px;display:grid;grid-template-columns:repeat(6,1fr);gap:2px;padding:6px;background:var(--bb-surface);border-radius:12px;box-shadow:var(--bb-shadow-pop);z-index:10;transform-origin:bottom right;animation:bb-web-pop 180ms var(--bb-spring);}',
    '.bbr .bb-web-emoji-pop button{width:34px;height:34px;font-size:19px;line-height:1;border-radius:8px;display:grid;place-items:center;}',
    '.bbr .bb-web-emoji-pop button:hover:not(:disabled){background:var(--bb-fill);}',

    /* --- history (inside the widget) --- */
    '.bbr .bb-web-history{display:flex;flex-direction:column;gap:8px;padding-top:6px;animation:bb-web-fade 180ms var(--bb-ease);}',
    '.bbr .bb-web-history-head{display:flex;align-items:center;gap:6px;}',
    '.bbr .bb-web-back{display:inline-flex;align-items:center;gap:2px;height:30px;padding:0 10px 0 4px;border-radius:8px;color:var(--bb-accent);font-size:15px;font-weight:400;}',
    '.bbr .bb-web-back:hover:not(:disabled){background:var(--bb-accent-tint);}',
    '.bbr .bb-web-history-title{font-size:15px;font-weight:600;}',
    '.bbr .bb-web-search{display:flex;align-items:center;gap:6px;height:36px;padding:0 10px;border-radius:10px;background:var(--bb-fill);color:var(--bb-tertiary);transition:background-color 120ms var(--bb-ease),box-shadow 120ms var(--bb-ease);}',
    '.bbr .bb-web-search:focus-within{background:var(--bb-surface);box-shadow:0 0 0 1px var(--bb-separator-strong),0 0 0 4px var(--bb-accent-ring);}',
    '.bbr .bb-web-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;padding:0;font-size:14px;color:var(--bb-label);}',
    '.bbr .bb-web-search input::placeholder{color:var(--bb-tertiary);opacity:1;}',
    '.bbr .bb-web-group{margin-bottom:6px;}',
    '.bbr .bb-web-group-label{padding:10px 8px 4px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:var(--bb-secondary);}',
    '.bbr .bb-web-session{width:100%;display:flex;align-items:center;gap:10px;min-height:36px;padding:6px 8px;border-radius:8px;color:var(--bb-label);font-size:14px;text-align:left;}',
    '.bbr .bb-web-session .bb-web-icon{color:var(--bb-tertiary);}',
    '.bbr .bb-web-session span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
    '.bbr .bb-web-session:hover:not(:disabled){background:var(--bb-fill);}',
    '.bbr .bb-web-session.is-active{background:var(--bb-accent-tint);color:var(--bb-accent);}',
    '.bbr .bb-web-session.is-active .bb-web-icon{color:var(--bb-accent);}',
    '.bbr .bb-web-muted{color:var(--bb-secondary);font-size:13px;}',
    '.bbr .bb-web-center{text-align:center;padding:20px 8px;}',
    '.bbr .bb-web-inline-error{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;color:var(--bb-danger-text);font-size:13px;padding:16px 4px;}',
    '.bbr .bb-web-link{padding:0 4px;color:var(--bb-accent);font-weight:500;}',

    /* --- sidebar dock --- */
    '.bbr .bb-web-dock{position:fixed;top:var(--bb-sb-top);right:0;bottom:0;width:var(--bb-sb-w);max-width:100vw;display:flex;z-index:1;background:var(--bb-surface);border-left:1px solid var(--bb-separator);animation:bb-web-slide 320ms var(--bb-spring);}',
    '.bbr .bb-web-dock .bb-web-panel{height:100%;border-radius:0;}',

    /* --- inline --- */
    '.bbr.bb-web-m-inline{position:relative;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;}',
    '.bbr.bb-web-m-inline .bb-web-panel{flex:1;height:auto;border:1px solid var(--bb-separator);}',

    /* --- page (conversation list + chat) --- */
    '.bbr.bb-web-m-page{position:relative;width:100%;height:100%;min-height:520px;display:flex;}',
    '.bbr .bb-web-page{flex:1;display:flex;min-width:0;min-height:0;overflow:hidden;position:relative;border-radius:14px;border:1px solid var(--bb-separator);background:var(--bb-surface);color:var(--bb-label);}',
    '.bbr .bb-web-page-side{width:264px;flex:0 0 264px;display:flex;flex-direction:column;gap:8px;padding:14px 10px 10px;background:var(--bb-surface-2);border-right:1px solid var(--bb-separator);min-height:0;}',
    '.bbr.bb-web-dark .bb-web-page-side{background:var(--bb-bg);}',
    '.bbr .bb-web-page-brand{display:flex;align-items:center;gap:10px;min-height:36px;padding:0 6px 4px;}',
    '.bbr .bb-web-page-logo{width:28px;height:28px;flex:0 0 28px;border-radius:7px;display:grid;place-items:center;overflow:hidden;}',
    '.bbr .bb-web-page-logo svg{width:28px;height:28px;}',
    '.bbr .bb-web-page-name{flex:1;min-width:0;font-size:15px;line-height:1.2;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-close{display:none;}',
    '.bbr .bb-web-newchat{width:100%;height:36px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--bb-fill);color:var(--bb-label);font-size:14px;font-weight:500;}',
    '.bbr .bb-web-newchat .bb-web-icon{color:var(--bb-accent);}',
    '.bbr .bb-web-newchat:hover:not(:disabled){background:var(--bb-fill-strong);}',
    '.bbr .bb-web-page-sessions{flex:1;min-height:0;overflow-y:auto;margin:0 -4px;padding:0 4px;scrollbar-width:thin;scrollbar-color:var(--bb-fill-strong) transparent;}',
    '.bbr .bb-web-page-sessions .bb-web-session .bb-web-icon{display:none;}',
    '.bbr .bb-web-page-sessions .bb-web-session{min-height:34px;font-size:14px;}',
    '.bbr .bb-web-page-sessions .bb-web-session.is-active{background:var(--bb-fill-strong);color:var(--bb-label);font-weight:500;}',
    '.bbr .bb-web-profile{display:flex;align-items:center;gap:10px;padding:10px 6px 2px;border-top:1px solid var(--bb-separator);}',
    '.bbr .bb-web-uav{width:32px;height:32px;flex:0 0 32px;border-radius:999px;overflow:hidden;display:grid;place-items:center;background:var(--bb-accent-tint);color:var(--bb-accent);font-size:13px;font-weight:500;}',
    '.bbr .bb-web-uav img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.bbr .bb-web-profile-copy{min-width:0;flex:1;}',
    '.bbr .bb-web-profile-name{font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-profile-email{color:var(--bb-secondary);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-backdrop{display:none;}',
    '.bbr .bb-web-page-stage{flex:1;min-width:0;min-height:0;display:flex;}',
    '.bbr .bb-web-page-card{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative;background:var(--bb-surface);}',
    '.bbr .bb-web-page-top{flex:0 0 auto;position:relative;z-index:3;display:flex;align-items:center;gap:8px;min-height:52px;padding:8px 12px 8px 20px;border-bottom:1px solid var(--bb-separator);background:var(--bb-material);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);}',
    '.bbr .bb-web-page-ws{flex:1;min-width:0;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-tools{display:flex;align-items:center;gap:2px;}',
    '.bbr .bb-web-page-menu{display:none;}',
    '.bbr .bb-web-page .bb-web-transcript{padding:8px 24px 16px;}',
    '.bbr .bb-web-page-inner{width:min(100%,720px);margin:0 auto;flex:1 0 auto;display:flex;flex-direction:column;}',
    '.bbr .bb-web-page .bb-web-log{flex:1 0 auto;}',
    '.bbr .bb-web-page .bb-web-col{max-width:85%;}',
    '.bbr .bb-web-page .bb-web-bottom{width:min(100%,768px);margin:0 auto;padding:0 24px 20px;background:transparent;}',
    '.bbr .bb-web-page .bb-web-toasts{left:24px;right:24px;}',
    '.bbr .bb-web-page .bb-web-composer{padding:6px;border-radius:22px;}',
    '.bbr .bb-web-page .bb-web-send{width:34px;height:34px;flex-basis:34px;}',
    '.bbr .bb-web-hero{margin:auto 0 0;padding:32px 0 20px;text-align:center;display:flex;flex-direction:column;align-items:center;animation:bb-web-fade 320ms var(--bb-ease);}',
    '.bbr .bb-web-hero .bb-web-welcome-logo{width:56px;height:56px;}',
    '.bbr .bb-web-hello{margin-top:16px;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-.02em;color:var(--bb-label);}',
    '.bbr .bb-web-heading{margin-top:6px;font-size:17px;line-height:1.35;font-weight:400;letter-spacing:-.01em;color:var(--bb-secondary);}',
    '.bbr .bb-web-prompts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:8px 0 auto;}',
    '.bbr .bb-web-prompt{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-height:0;padding:14px;border-radius:12px;border:1px solid var(--bb-separator);background:var(--bb-surface);color:var(--bb-label);text-align:left;}',
    '.bbr .bb-web-prompt:hover:not(:disabled){background:var(--bb-surface-2);border-color:var(--bb-separator-strong);}',
    '.bbr.bb-web-dark .bb-web-prompt:hover:not(:disabled){background:var(--bb-surface-2);}',
    '.bbr .bb-web-prompt-ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--bb-accent-tint);color:var(--bb-accent);}',
    '.bbr .bb-web-prompt strong{display:block;font-size:14px;font-weight:500;line-height:1.3;}',
    '.bbr .bb-web-prompt small{display:block;margin-top:2px;color:var(--bb-secondary);font-size:13px;line-height:1.35;}',
    '.bbr .bb-web-page.is-empty .bb-web-log{flex:0 0 auto;}',

    /* page compact (container narrower than 760px, set via ResizeObserver) */
    '.bbr.bb-web-compact .bb-web-page-side{position:absolute;top:0;bottom:0;left:0;z-index:5;width:min(288px,86%);transform:translateX(-102%);transition:transform 320ms var(--bb-spring);box-shadow:var(--bb-shadow-pop);}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-side{transform:none;}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-backdrop{display:block;position:absolute;inset:0;z-index:4;background:rgba(0,0,0,.2);animation:bb-web-fade 200ms var(--bb-ease);}',
    '.bbr.bb-web-compact .bb-web-page-menu,.bbr.bb-web-compact .bb-web-page-close{display:grid;}',
    '.bbr.bb-web-compact .bb-web-page-top{padding-left:8px;}',
    '.bbr.bb-web-compact .bb-web-transcript{padding:8px 14px 12px;}',
    '.bbr.bb-web-compact .bb-web-page .bb-web-bottom{padding:0 12px 12px;}',
    '.bbr.bb-web-compact .bb-web-page .bb-web-toasts{left:12px;right:12px;}',
    '.bbr.bb-web-compact .bb-web-prompts{grid-template-columns:1fr;gap:8px;}',
    '.bbr.bb-web-compact .bb-web-prompt{flex-direction:row;align-items:center;gap:12px;padding:12px;}',
    '.bbr.bb-web-compact .bb-web-hello{font-size:20px;}',

    /* --- mobile: floating window becomes a full-screen sheet --- */
    '@media (max-width:575.98px){',
    '.bbr .bb-web-float{right:max(12px,min(var(--bb-ox),16px));bottom:calc(max(12px,min(var(--bb-oy),16px)) + env(safe-area-inset-bottom,0px));}',
    '.bbr.bb-web-left .bb-web-float{left:max(12px,min(var(--bb-ox),16px));right:auto;}',
    '.bbr .bb-web-window{position:fixed;left:0;right:0;bottom:0;top:calc(env(safe-area-inset-top,0px) + 8px);width:100%;max-width:none;animation:bb-web-sheet 320ms var(--bb-spring);}',
    '.bbr .bb-web-window.is-leaving{animation:bb-web-fade 200ms var(--bb-ease) reverse forwards;}',
    '.bbr .bb-web-window .bb-web-panel{height:100%;border-radius:12px 12px 0 0;}',
    '.bbr .bb-web-float.is-open .bb-web-launcher{display:none;}',
    '.bbr .bb-web-dock{width:100%;border-left:0;}',
    '.bbr .bb-web-window .bb-web-bottom,.bbr .bb-web-dock .bb-web-bottom{padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));}',
    '.bbr .bb-web-header{padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(8px,env(safe-area-inset-right,0px));}',
    '.bbr .bb-web-hbtn{width:40px;height:40px;}',
    '.bbr .bb-web-header-actions{gap:0;}',
    '.bbr .bb-web-tool{width:40px;height:40px;flex-basis:40px;}',
    '.bbr .bb-web-send{width:36px;height:36px;flex-basis:36px;margin:2px;}',
    '.bbr .bb-web-composer textarea{min-height:40px;padding:10px 6px;font-size:16px;}',
    '.bbr .bb-web-act{width:32px;height:32px;}',
    '.bbr .bb-web-col{max-width:84%;}',
    '}',

    /* --- reduced motion: opacity only, <=100ms --- */
    '@media (prefers-reduced-motion:reduce){',
    '.bbr *,.bbr *::before,.bbr *::after{animation-duration:100ms!important;animation-iteration-count:1!important;transition-duration:100ms!important;scroll-behavior:auto!important;}',
    '@keyframes bb-web-open{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-close{from{opacity:1;}to{opacity:0;}}',
    '@keyframes bb-web-slide{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-sheet{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-msg{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-pop{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-scale-in{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-rotate-in{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-toast-in{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-toast-out{from{opacity:1;}to{opacity:0;}}',
    '.bbr .bb-web-caret,.bbr .bb-web-typing i,.bbr .bb-web-skel i{animation:none!important;}',
    '.bbr .bb-web-typing i{opacity:.6;}',
    '.bbr button:active:not(:disabled),.bbr .bb-web-launcher:hover:not(:disabled){transform:none;}',
    '.bbr.bb-web-compact .bb-web-page-side{transition:opacity 100ms linear;}',
    '}'
  ].join('\n').replace(/\.bbr\b/g, '.bb-web-root');

  function injectStyles() {
    if (!HAS_DOM) return;
    var existing = document.getElementById('bb-web-styles');
    if (existing && existing.getAttribute('data-version') === VERSION) return;
    var style = existing || document.createElement('style');
    style.id = 'bb-web-styles';
    style.setAttribute('data-version', VERSION);
    style.textContent = CSS;
    if (!existing) (document.head || document.documentElement).appendChild(style);
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
    width: 380,
    height: 600,
    defaultOpen: false,
    launcher: { type: 'icon', text: 'Chat', gifUrl: null },
    theme: { mode: 'light', primary: null, panel: null, ink: null, radius: null, fontFamily: null },
    branding: { botName: 'Brainbox AI', title: null, subtitle: 'Typically replies in seconds', logoUrl: null, botAvatarUrl: null },
    welcomeMessages: ["I'm {{botName}}. Ask me anything and I'll answer in seconds."],
    quickActions: [],
    placeholder: 'Message',
    features: { history: true, upload: true, emoji: true, modeSwitch: true, newChat: true, export: false, feedback: true },
    allowedModes: ['floating', 'sidebar'],
    page: { greeting: 'Hello, {{name}}', heading: 'How can I help you today?' },
    sounds: true,
    streaming: true,
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
    if (!isPlainObject(cfg.launcher)) cfg.launcher = deepMerge(DEFAULTS.launcher, {});
    if (!isPlainObject(cfg.theme)) cfg.theme = deepMerge(DEFAULTS.theme, {});
    if (THEME_MODES.indexOf(cfg.theme.mode) === -1) cfg.theme.mode = 'light';
    if (!Array.isArray(cfg.allowedModes)) cfg.allowedModes = DEFAULTS.allowedModes.slice();
    cfg.allowedModes = cfg.allowedModes.filter(function (m) { return MODES.indexOf(m) !== -1; });
    if (!Array.isArray(cfg.welcomeMessages)) cfg.welcomeMessages = cfg.welcomeMessages ? [String(cfg.welcomeMessages)] : [];
    if (!Array.isArray(cfg.quickActions)) cfg.quickActions = [];
    cfg.user = isPlainObject(cfg.user) ? cfg.user : {};
    cfg.offset = { x: toNumber(cfg.offset && cfg.offset.x, 24), y: toNumber(cfg.offset && cfg.offset.y, 24) };
    if (!raw || !Object.prototype.hasOwnProperty.call(raw, 'sidebarPushContent')) cfg.sidebarPushContent = undefined;
    cfg.sounds = cfg.sounds !== false;
    cfg.streaming = cfg.streaming !== false;
    return cfg;
  }

  function fileExt(name) {
    var m = String(name || '').match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toUpperCase() : 'FILE';
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
      this._toasts = [];
      this._st = {
        messages: [],
        sessionId: null,
        sessionTitle: null,
        sending: false,
        sendingSince: 0,
        streamMsg: null,
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
        unread: 0,
        sound: true
      };

      var stored = this._readStore();
      this._st.sessionId = stored.sessionId || null;
      this._st.sound = this._cfg.sounds && stored.sound !== false;
      this._mode = this._initialMode(stored.mode);
      this._st.open = this._isOverlayMode() ? (typeof stored.open === 'boolean' ? stored.open : !!this._cfg.defaultOpen) : true;

      this._onResize = this._onResize.bind(this);
      this._onDocClick = this._onDocClick.bind(this);
      this._onSchemeChange = this._onSchemeChange.bind(this);
      global.addEventListener('resize', this._onResize);
      document.addEventListener('click', this._onDocClick, true);
      try {
        this._mq = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
        if (this._mq) {
          if (this._mq.addEventListener) this._mq.addEventListener('change', this._onSchemeChange);
          else if (this._mq.addListener) this._mq.addListener(this._onSchemeChange);
        }
      } catch (e) { this._mq = null; }
      if (this._cfg.sounds) listenForAudioUnlock();

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
      this._st.unread = 0;
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
      this._renderOpen(true);
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
      var msg = { id: uid('m'), role: 'user', content: value, time: Date.now(), live: true };
      this._st.messages.push(msg);
      this._st.view = 'chat';
      this._sound('send');
      this._emit('message', { text: value, sessionId: this._st.sessionId });
      return this._ask(msg);
    }

    /** Stop the answer that is being generated (keeps the text received so far). */
    stop() {
      if (!this._st.sending || !this._abort) return false;
      this._stopRequested = true;
      try { this._abort.abort(); } catch (e) { /* ignore */ }
      return true;
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
          var meta = isPlainObject(m.metadata) ? m.metadata : {};
          return {
            id: 'srv-' + (m.id != null ? m.id : uid('h')),
            serverId: m.id != null ? m.id : null,
            role: role,
            content: fileMatch ? fileMatch[1] : content,
            kind: fileMatch ? 'file' : 'text',
            time: parseTime(m.created_at),
            sources: role === 'assistant' ? normalizeSources(m.search_results || meta.search_results) : null,
            rating: m.feedback === 'up' || m.feedback === 'down' ? m.feedback : (m.rating === 'up' || m.rating === 'down' ? m.rating : null)
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
      if (Object.prototype.hasOwnProperty.call(partial, 'sounds')) this._st.sound = this._cfg.sounds;
      if (this._cfg.sounds) listenForAudioUnlock();
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

    /** Turn UI sounds on or off for this widget (remembered in localStorage). */
    setSoundEnabled(on) {
      this._st.sound = !!on && this._cfg.sounds;
      this._writeStore({ sound: !!on });
      this._renderSoundButtons();
      this._emit('soundchange', { enabled: this._st.sound });
    }

    isSoundEnabled() {
      return !!this._st.sound;
    }

    /** Show a toast inside the panel: { type: 'success'|'error'|'warning'|'info', title, body?, action?: { label, onClick }, duration? } */
    toast(opts) {
      return this._toast(opts || {});
    }

    destroy() {
      if (this._destroyed) return;
      this._cancelInFlight();
      this._unmount();
      global.removeEventListener('resize', this._onResize);
      document.removeEventListener('click', this._onDocClick, true);
      if (this._mq) {
        if (this._mq.removeEventListener) this._mq.removeEventListener('change', this._onSchemeChange);
        else if (this._mq.removeListener) this._mq.removeListener(this._onSchemeChange);
      }
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
      return this._st.messages.map(function (m) {
        return { id: m.id, role: m.role, content: m.content, time: m.time, kind: m.kind || 'text', messageId: m.serverId != null ? m.serverId : null, rating: m.rating || null };
      });
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

    _sound(name) {
      if (this._cfg.sounds && this._st.sound) playSound(name, true);
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

    _isDark() {
      var m = this._cfg.theme.mode;
      if (m === 'dark') return true;
      if (m === 'auto') return !!(this._mq && this._mq.matches);
      return false;
    }

    _botName() {
      return this._cfg.branding.botName || 'Assistant';
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
      this._els = { root: root };
      this._applyTheme();
      root.addEventListener('keydown', this._onKeydown.bind(this));

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
      this._els.live = h('div', { class: 'bb-web-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
      root.appendChild(this._els.live);

      this._nodeCache.clear();
      this._toasts = [];
      this._render();
      if (this.isOpen()) this._ensureRestored();
      if (mode === 'page') this._loadSessions();
      this._scrollToBottom(true);
    }

    _unmount() {
      if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = null; }
      if (this._leaveTimer) { clearTimeout(this._leaveTimer); this._leaveTimer = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      this._toasts.forEach(function (t) { if (t.timer) clearTimeout(t.timer); });
      this._toasts = [];
      this._restorePush();
      if (this._els && this._els.root && this._els.root.parentNode) this._els.root.parentNode.removeChild(this._els.root);
      this._els = {};
      this._nodeCache.clear();
    }

    _applyTheme() {
      var root = this._els && this._els.root;
      if (!root) return;
      var cfg = this._cfg;
      var t = cfg.theme || {};
      var dark = this._isDark();
      root.classList.toggle('bb-web-dark', dark);
      root.setAttribute('data-bb-theme', dark ? 'dark' : 'light');
      var vars = {
        '--bb-z': String(toNumber(cfg.zIndex, 9999)),
        '--bb-w': px(cfg.width, '380px'),
        '--bb-h': px(cfg.height, '600px'),
        '--bb-ox': cfg.offset.x + 'px',
        '--bb-oy': cfg.offset.y + 'px',
        '--bb-sb-w': px(cfg.sidebarWidth, '380px'),
        '--bb-sb-top': px(cfg.sidebarTop, '0px')
      };
      if (t.radius != null && t.radius !== '') vars['--bb-radius'] = px(t.radius, '18px');
      if (t.fontFamily) vars['--bb-font'] = t.fontFamily;
      if (t.primary) Object.assign(vars, accentVars(String(t.primary)));
      // panel / ink are light-mode surface overrides (kept for v2.0 hosts)
      ['--bb-surface', '--bb-label', '--bb-accent', '--bb-accent-hover', '--bb-accent-pressed', '--bb-accent-tint', '--bb-accent-ring', '--bb-on-accent', '--bb-launcher-bg'].forEach(function (k) { root.style.removeProperty(k); });
      if (!dark && t.panel) vars['--bb-surface'] = t.panel;
      if (!dark && t.ink) vars['--bb-label'] = t.ink;
      Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    }

    _onSchemeChange() {
      if (this._cfg.theme.mode === 'auto') this._applyTheme();
    }

    /* ---------------- internals: DOM builders ---------------- */

    /** Brand mark: customer logoUrl/botAvatarUrl image, or the Brainbox logo. */
    _mark(cls, url, size) {
      var el = h('span', { class: cls, 'aria-hidden': 'true' });
      var fallback = function () { clear(el); el.appendChild(logo(size)); };
      if (url) {
        var img = h('img', { src: url, alt: '' });
        img.addEventListener('error', fallback);
        el.appendChild(img);
      } else {
        el.appendChild(logo(size));
      }
      return el;
    }

    _botAvatarUrl() {
      var b = this._cfg.branding;
      return b.botAvatarUrl || b.logoUrl || null;
    }

    _userAvatar() {
      var u = this._cfg.user || {};
      var el = h('span', { class: 'bb-web-uav', 'aria-hidden': 'true' });
      if (u.avatarUrl) {
        var img = h('img', { src: u.avatarUrl, alt: '' });
        img.addEventListener('error', function () { img.remove(); el.textContent = initials(u.name, 'U'); });
        el.appendChild(img);
      } else {
        el.textContent = initials(u.name, 'U');
      }
      return el;
    }

    _hbtn(iconName, label, onClick, extraClass) {
      var btn = h('button', { type: 'button', class: 'bb-web-hbtn' + (extraClass ? ' ' + extraClass : ''), title: label, 'aria-label': label }, icon(iconName, 18));
      btn.addEventListener('click', onClick);
      return btn;
    }

    _soundButton() {
      if (!this._cfg.sounds) return null;
      var self = this;
      var btn = h('button', { type: 'button', class: 'bb-web-hbtn bb-web-sound-btn' });
      btn.addEventListener('click', function () {
        self.setSoundEnabled(!self._st.sound);
        if (self._st.sound) { unlockSounds(); playSound('success', true); }
      });
      (this._els.soundBtns = this._els.soundBtns || []).push(btn);
      return btn;
    }

    _renderSoundButtons() {
      var on = !!this._st.sound;
      (this._els.soundBtns || []).forEach(function (btn) {
        clear(btn);
        btn.appendChild(icon(on ? 'volume' : 'volumeOff', 18));
        var label = on ? 'Mute sounds' : 'Turn sounds on';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    _modeSwitchButton(cls) {
      var target = this._modeSwitchTarget();
      if (!target) return null;
      var self = this;
      var label = { floating: 'Pop out to floating window', sidebar: 'Dock to sidebar', inline: 'Show inline', page: 'Open full page' }[target];
      var iconName = { floating: 'undock', sidebar: 'dock', inline: 'undock', page: 'expand' }[target];
      return this._hbtn(iconName, label, function () { self.setMode(target); }, cls || 'bb-web-dock-btn');
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
      var unread = this._st.unread;
      var state = (open ? 'o' : 'c') + type + unread + (this._mode === 'sidebar' && open ? 's' : '');
      if (btn._bbState === state) return;
      btn._bbState = state;
      clear(btn);
      btn.className = 'bb-web-launcher';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var openLabel = cfg.launcher.ariaLabel || 'Open chat';
      btn.setAttribute('aria-label', open ? 'Close chat' : (unread ? openLabel + ', ' + unread + ' unread' : openLabel));
      if (this._mode === 'sidebar' && open) {
        btn.classList.add('bb-web-is-closed');
        return;
      }
      if (type === 'button') btn.classList.add('is-button');
      else if (type === 'gif' && cfg.launcher.gifUrl) btn.classList.add('is-gif');
      else btn.classList.add('is-icon');
      if (open) {
        btn.classList.add('is-open');
        btn.appendChild(icon('x', 24, 2));
      } else if (type === 'gif' && cfg.launcher.gifUrl) {
        btn.appendChild(h('img', { src: cfg.launcher.gifUrl, alt: '' }));
      } else if (type === 'button') {
        btn.appendChild(icon('chat', 20, 2));
        btn.appendChild(h('span', { text: text }));
      } else {
        btn.appendChild(icon('chat', 26, 2));
      }
      if (!open && unread > 0) btn.appendChild(h('span', { class: 'bb-web-badge', 'aria-hidden': 'true', text: unread > 9 ? '9+' : String(unread) }));
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
        els.newChatBtn = this._hbtn('newchat', 'New chat', function () { self.newChat(); });
        actions.appendChild(els.newChatBtn);
      }
      if (cfg.features.history) {
        els.historyBtn = this._hbtn('history', 'Chat history', function () { self._toggleHistory(); });
        els.historyBtn.setAttribute('aria-pressed', 'false');
        actions.appendChild(els.historyBtn);
      }
      if (cfg.features.export) actions.appendChild(this._hbtn('download', 'Export conversation', function () { self._export(); }));
      append(actions, [this._soundButton(), this._modeSwitchButton()]);
      if (overlay) {
        actions.appendChild(this._hbtn('x', 'Close chat', function () { self.close(); if (self._els.launcher) self._els.launcher.focus(); }, 'bb-web-close'));
      }

      var header = h('header', { class: 'bb-web-header' }, [
        this._mark('bb-web-hlogo', b.logoUrl, 32),
        h('div', { class: 'bb-web-header-copy' }, [
          h('h2', { class: 'bb-web-title', text: title }),
          b.subtitle ? h('div', { class: 'bb-web-subtitle' }, [h('i', { class: 'bb-web-dot-online', 'aria-hidden': 'true' }), h('span', { text: b.subtitle })]) : null
        ]),
        actions
      ]);

      els.transcript = h('div', { class: 'bb-web-transcript' });
      els.history = h('div', { class: 'bb-web-history bb-web-is-closed' });
      els.log = this._buildLog();
      els.transcript.appendChild(els.history);
      els.transcript.appendChild(els.log);
      this._buildHistoryView(els.history);
      this._trackScroll();

      var body = h('div', { class: 'bb-web-body' }, [els.transcript, this._buildBottom()]);
      var panel = h('section', {
        class: 'bb-web-panel',
        role: this._mode === 'floating' ? 'dialog' : 'region',
        'aria-label': title,
        tabindex: '-1'
      }, [header, body]);
      els.panel = panel;
      return panel;
    }

    _buildLog() {
      return h('div', { class: 'bb-web-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation' });
    }

    _buildBottom() {
      var els = this._els;
      els.toasts = h('div', { class: 'bb-web-toasts' });
      els.toastLive = h('div', { class: 'bb-web-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
      els.toastAlert = h('div', { class: 'bb-web-sr', 'aria-live': 'assertive', 'aria-atomic': 'true' });
      els.errorSlot = h('div', { class: 'bb-web-error-slot' });
      return h('div', { class: 'bb-web-bottom' }, [els.toasts, els.toastLive, els.toastAlert, els.errorSlot, this._buildComposer()]);
    }

    _trackScroll() {
      var t = this._els.transcript;
      var self = this;
      this._stick = true;
      t.addEventListener('scroll', function () {
        self._stick = t.scrollHeight - t.scrollTop - t.clientHeight < 80;
      }, { passive: true });
    }

    _buildHistoryView(container) {
      var self = this;
      var back = h('button', { type: 'button', class: 'bb-web-back', 'aria-label': 'Back to chat' }, [icon('back', 18), 'Chat']);
      back.addEventListener('click', function () { self._toggleHistory(false); });
      var search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search conversations' });
      search.addEventListener('input', function () { self._st.search = search.value; self._renderSessionLists(); });
      this._els.historySearch = search;
      this._els.historyList = h('div', { class: 'bb-web-history-list' });
      append(container, [
        h('div', { class: 'bb-web-history-head' }, [back, h('span', { class: 'bb-web-history-title', text: 'Conversations' })]),
        h('label', { class: 'bb-web-search' }, [icon('search', 16), search]),
        this._els.historyList
      ]);
    }

    _buildComposer() {
      var self = this;
      var cfg = this._cfg;
      var els = this._els;
      var form = h('form', { class: 'bb-web-composer', novalidate: true });
      form.addEventListener('submit', function (e) { e.preventDefault(); self._submit(); });

      var ta = h('textarea', { rows: '1', placeholder: cfg.placeholder || 'Message', 'aria-label': 'Message', enterkeyhint: 'send' });
      ta.addEventListener('input', function () { self._autoGrow(); });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          self._submit();
        }
      });
      els.input = ta;

      if (cfg.features.upload) {
        var fileInput = h('input', { type: 'file', class: 'bb-web-file-input', tabindex: '-1', 'aria-hidden': 'true' });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (f) self._upload(f);
        });
        var attach = h('button', { type: 'button', class: 'bb-web-tool', title: 'Attach file', 'aria-label': 'Attach file' }, icon('paperclip', 19));
        attach.addEventListener('click', function () { fileInput.click(); });
        els.attachBtn = attach;
        append(form, [attach, fileInput]);
      }
      form.appendChild(ta);
      if (cfg.features.emoji) {
        var wrap = h('div', { class: 'bb-web-emoji-wrap' });
        var emojiBtn = h('button', { type: 'button', class: 'bb-web-tool', title: 'Emoji', 'aria-label': 'Insert emoji', 'aria-expanded': 'false' }, icon('smile', 19));
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
        form.appendChild(wrap);
      }
      var send = h('button', { type: 'submit', class: 'bb-web-send' });
      send.addEventListener('click', function (e) {
        if (self._st.sending) { e.preventDefault(); self.stop(); }
      });
      els.sendBtn = send;
      form.appendChild(send);
      return form;
    }

    _buildPage() {
      var self = this;
      var cfg = this._cfg;
      var b = cfg.branding;
      var els = this._els;
      var u = cfg.user || {};
      var name = b.title || b.botName || 'Assistant';

      var closeDrawer = this._hbtn('x', 'Hide conversations', function () { self._st.drawer = false; self._renderPageDrawer(); }, 'bb-web-page-close');
      var newChat = h('button', { type: 'button', class: 'bb-web-newchat' }, [icon('newchat', 17), h('span', { text: 'New chat' })]);
      newChat.addEventListener('click', function () { self.newChat(); });
      els.newChatBtn = newChat;

      var search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search conversations' });
      search.addEventListener('input', function () { self._st.search = search.value; self._renderSessionLists(); });
      els.pageSessions = h('nav', { class: 'bb-web-page-sessions', 'aria-label': 'Conversations' });

      var side = h('aside', { class: 'bb-web-page-side', 'aria-label': 'Conversations' }, [
        h('div', { class: 'bb-web-page-brand' }, [this._mark('bb-web-page-logo', b.logoUrl, 28), h('div', { class: 'bb-web-page-name', text: name }), closeDrawer]),
        cfg.features.newChat ? newChat : null,
        cfg.features.history ? h('label', { class: 'bb-web-search' }, [icon('search', 16), search]) : null,
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

      var menu = this._hbtn('menu', 'Show conversations', function () { self._st.drawer = true; self._renderPageDrawer(); }, 'bb-web-page-menu');
      els.pageTitle = h('div', { class: 'bb-web-page-ws' });
      var tools = h('div', { class: 'bb-web-page-tools' });
      if (cfg.features.newChat) tools.appendChild(this._hbtn('newchat', 'New chat', function () { self.newChat(); }));
      if (cfg.features.export) tools.appendChild(this._hbtn('download', 'Export conversation', function () { self._export(); }));
      append(tools, [this._soundButton(), this._modeSwitchButton()]);
      var top = h('header', { class: 'bb-web-page-top' }, [menu, els.pageTitle, tools]);

      els.hero = h('div', { class: 'bb-web-hero' }, [
        this._mark('bb-web-welcome-logo', b.logoUrl, 56),
        h('h1', { class: 'bb-web-hello', text: this._interpolate(cfg.page.greeting) }),
        cfg.page.heading ? h('p', { class: 'bb-web-heading', text: this._interpolate(cfg.page.heading) }) : null
      ]);
      els.prompts = h('div', { class: 'bb-web-prompts' });
      this._buildPromptCards(els.prompts);
      els.log = this._buildLog();
      els.transcript = h('div', { class: 'bb-web-transcript' }, h('div', { class: 'bb-web-page-inner' }, [els.hero, els.prompts, els.log]));
      this._trackScroll();

      var card = h('section', { class: 'bb-web-page-card', 'aria-label': name }, [top, els.transcript, this._buildBottom()]);
      var page = h('div', { class: 'bb-web-page' }, [side, backdrop, h('main', { class: 'bb-web-page-stage' }, card)]);
      els.page = page;
      els.panel = card;
      return page;
    }

    _quickActionItems() {
      return this._cfg.quickActions.map(function (qa) {
        var item = typeof qa === 'string' ? { title: qa, prompt: qa } : (qa || {});
        return { title: item.title || item.prompt, prompt: item.prompt || item.title, description: item.description, icon: item.icon };
      }).filter(function (i) { return i.prompt; });
    }

    _buildPromptCards(container) {
      var self = this;
      var icons = ['sparkle', 'bulb', 'question', 'pie'];
      this._quickActionItems().forEach(function (item, i) {
        var btn = h('button', { type: 'button', class: 'bb-web-prompt' }, [
          h('span', { class: 'bb-web-prompt-ic' }, icon(item.icon && ICONS[item.icon] ? item.icon : icons[i % icons.length], 16)),
          h('span', null, [h('strong', { text: item.title }), item.description ? h('small', { text: item.description }) : null])
        ]);
        btn.addEventListener('click', function () { self.send(item.prompt); });
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
      this._renderSoundButtons();
      this._renderPageState();
    }

    _renderOpen(animateClose) {
      var els = this._els;
      if (!els || !els.root) return;
      var open = this._st.open;
      var self = this;
      if (els.window) {
        if (this._leaveTimer) { clearTimeout(this._leaveTimer); this._leaveTimer = null; }
        els.window.classList.remove('is-leaving');
        if (!open && animateClose && !els.window.classList.contains('bb-web-is-closed')) {
          els.window.classList.add('is-leaving');
          this._leaveTimer = setTimeout(function () {
            self._leaveTimer = null;
            if (self._els.window) { self._els.window.classList.remove('is-leaving'); self._els.window.classList.add('bb-web-is-closed'); }
          }, prefersReducedMotion() ? 100 : 190);
        } else {
          els.window.classList.toggle('bb-web-is-closed', !open);
        }
      }
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
      var rows = [];

      if (st.loadingHistory) {
        wanted.push(this._cached('loading', function () {
          return h('div', { class: 'bb-web-skel', role: 'status', 'aria-label': 'Loading conversation' }, [h('i'), h('i'), h('i'), h('i')]);
        }));
      } else if (!st.messages.length && this._mode !== 'page') {
        wanted.push(this._cached('welcome', function () { return self._buildWelcome(); }));
      }

      var prev = null;
      var latestBot = null;
      st.messages.forEach(function (m) { if (m.role !== 'user') latestBot = m; });
      st.messages.forEach(function (m, i) {
        var day = dayKey(m.time);
        if (!prev || dayKey(prev.time) !== day) {
          wanted.push(self._cached('day:' + day, function () { return h('div', { class: 'bb-web-day', role: 'separator', text: formatDay(m.time, self._cfg.locale) }); }));
        }
        var next = st.messages[i + 1];
        var first = !prev || !self._sameGroup(prev, m);
        var last = !next || !self._sameGroup(m, next);
        if (!last && st.sending && !st.streamMsg && i === st.messages.length - 1) last = true;
        var key = 'msg:' + m.id + ':' + (m.failed ? 'f' : '') + ':' + (m.status || '') + ':' + (m.streaming ? 's' : '') + ':' + (m.stopped ? 'x' : '');
        var node = self._cached(key, function () { return self._buildMessage(m); });
        rows.push({ node: node, first: first, last: last, latest: m === latestBot && !st.sending });
        wanted.push(node);
        prev = m;
      });

      if (st.sending && !st.streamMsg) {
        wanted.push(this._cached('typing:' + st.sendingSince, function () { return self._buildTyping(); }));
      }

      rows.forEach(function (r) {
        r.node.classList.toggle('is-first', r.first);
        r.node.classList.toggle('is-last', r.last);
        r.node.classList.toggle('is-latest', r.latest);
      });

      var current = Array.prototype.slice.call(els.log.childNodes);
      var changed = current.length !== wanted.length || current.some(function (n, i) { return n !== wanted[i]; });
      if (changed) {
        var prevCount = current.length;
        wanted.forEach(function (node, i) {
          if (els.log.childNodes[i] !== node) els.log.insertBefore(node, els.log.childNodes[i] || null);
        });
        while (els.log.childNodes.length > wanted.length) els.log.removeChild(els.log.lastChild);
        var keep = new Set(wanted);
        this._nodeCache.forEach(function (node, key) { if (!keep.has(node)) self._nodeCache.delete(key); });
        if (wanted.length >= prevCount) this._scrollToBottom(false);
      }
    }

    _sameGroup(a, b) {
      return a.role === b.role && dayKey(a.time) === dayKey(b.time) && Math.abs(b.time - a.time) < GROUP_GAP_MS;
    }

    _cached(key, build) {
      var node = this._nodeCache.get(key);
      if (!node) {
        node = build();
        this._nodeCache.set(key, node);
      }
      return node;
    }

    _buildWelcome() {
      var self = this;
      var cfg = this._cfg;
      var b = cfg.branding;
      var wrap = h('div', { class: 'bb-web-welcome' }, [
        this._mark('bb-web-welcome-logo', b.botAvatarUrl || b.logoUrl, 56),
        h('div', { class: 'bb-web-welcome-title', role: 'heading', 'aria-level': '2', text: this._interpolate(cfg.page.greeting || 'Hello, {{name}}') })
      ]);
      cfg.welcomeMessages.forEach(function (line) {
        var text = self._interpolate(line);
        if (text) wrap.appendChild(h('p', { class: 'bb-web-welcome-text', text: text }));
      });
      var items = this._quickActionItems();
      if (items.length) {
        var chips = h('div', { class: 'bb-web-chips' });
        items.forEach(function (item) {
          var chip = h('button', { type: 'button', class: 'bb-web-chip' }, [icon(item.icon && ICONS[item.icon] ? item.icon : 'sparkle', 15), h('span', { text: item.title })]);
          chip.addEventListener('click', function () { self.send(item.prompt); });
          chips.appendChild(chip);
        });
        wrap.appendChild(chips);
      }
      return wrap;
    }

    _buildMessage(m) {
      var self = this;
      var isUser = m.role === 'user';
      var locale = this._cfg.locale;
      var clock = formatClock(m.time, locale);
      var bubble = h('div', { class: 'bb-web-bubble' });
      if (isUser) {
        if (m.kind === 'file') {
          bubble.appendChild(h('span', { class: 'bb-web-file' }, [h('span', { class: 'bb-web-file-tile', 'aria-hidden': 'true', text: fileExt(m.content).slice(0, 4) }), h('span', { class: 'bb-web-user-text', text: m.content })]));
        } else {
          bubble.appendChild(h('span', { class: 'bb-web-user-text', text: m.content }));
        }
      } else {
        this._paintBot(bubble, m);
      }
      var foot = h('div', { class: 'bb-web-foot' });
      foot.appendChild(h('time', { class: 'bb-web-time', datetime: new Date(m.time).toISOString(), text: clock }));
      if (isUser) {
        if (m.failed) foot.appendChild(h('span', { class: 'bb-web-status is-error', text: m.kind === 'file' ? 'Upload failed' : 'Not delivered' }));
        else if (m.status === 'Uploading…') foot.appendChild(h('span', { class: 'bb-web-status' }, [h('span', { class: 'bb-web-spinner', 'aria-hidden': 'true' }), m.status]));
        else if (m.status) foot.appendChild(h('span', { class: 'bb-web-status', text: m.status }));
      } else {
        if (m.stopped) foot.appendChild(h('span', { class: 'bb-web-status', text: 'Stopped' }));
        if (m.status) foot.appendChild(h('span', { class: 'bb-web-status is-error', text: m.status }));
        if (!m.streaming) foot.appendChild(this._buildActions(m));
      }
      var col = h('div', { class: 'bb-web-col' }, [bubble, foot]);
      if (!isUser && m.sources && !m.streaming) {
        m._srcPanel = null;
      }
      var row = h('div', { class: 'bb-web-row ' + (isUser ? 'is-user' : 'is-bot') + (m.failed ? ' is-failed' : '') + (m.streaming ? ' is-streaming' : '') + (m.live && !m._shown ? ' is-new' : '') });
      m._shown = true;
      if (!isUser) row.appendChild(this._mark('bb-web-av', this._botAvatarUrl(), 28));
      row.appendChild(col);
      row.appendChild(h('time', { class: 'bb-web-htime', 'aria-hidden': 'true', text: clock }));
      row._bbBubble = bubble;
      row._bbCol = col;
      return row;
    }

    _paintBot(bubble, m) {
      clear(bubble);
      var md = renderMarkdown(m.content || '');
      if (m.streaming) {
        var target = md.lastElementChild;
        while (target && /^(UL|OL)$/.test(target.tagName) && target.lastElementChild) target = target.lastElementChild;
        if (!target || target.classList.contains('bb-web-code') || target.classList.contains('bb-web-table-wrap')) target = md;
        target.appendChild(h('span', { class: 'bb-web-caret', 'aria-hidden': 'true' }));
      }
      bubble.appendChild(md);
    }

    _buildActions(m) {
      var self = this;
      var acts = h('div', { class: 'bb-web-acts' });
      var copyBtn = h('button', { type: 'button', class: 'bb-web-act', title: 'Copy', 'aria-label': 'Copy answer' }, icon('copy', 15));
      copyBtn.addEventListener('click', function () {
        copyText(m.content).then(function () {
          clear(copyBtn).appendChild(icon('check', 15));
          copyBtn.setAttribute('aria-label', 'Copied');
          setTimeout(function () { clear(copyBtn).appendChild(icon('copy', 15)); copyBtn.setAttribute('aria-label', 'Copy answer'); }, 1600);
        });
      });
      acts.appendChild(copyBtn);
      var canRate = this._cfg.features.feedback && !m.local && (m.serverId != null || this._st.sessionId);
      if (canRate) {
        var up = h('button', { type: 'button', class: 'bb-web-act bb-web-fb-up', title: 'Good answer', 'aria-label': 'Good answer', 'aria-pressed': 'false' }, icon('thumbsUp', 15));
        var down = h('button', { type: 'button', class: 'bb-web-act bb-web-fb-down', title: 'Bad answer', 'aria-label': 'Bad answer', 'aria-pressed': 'false' }, icon('thumbsDown', 15));
        var paint = function () {
          up.classList.toggle('is-on', m.rating === 'up');
          down.classList.toggle('is-on', m.rating === 'down');
          up.setAttribute('aria-pressed', m.rating === 'up' ? 'true' : 'false');
          down.setAttribute('aria-pressed', m.rating === 'down' ? 'true' : 'false');
        };
        paint();
        up.addEventListener('click', function () { self._rate(m, 'up', paint, [up, down]); });
        down.addEventListener('click', function () { self._rate(m, 'down', paint, [up, down]); });
        append(acts, [up, down]);
      }
      if (m.sources && m.sources.length) {
        var panelId = uid('bb-src');
        var btn = h('button', { type: 'button', class: 'bb-web-srcbtn', 'aria-expanded': 'false', 'aria-controls': panelId }, [
          icon('book', 13), h('span', { text: m.sources.length === 1 ? '1 source' : m.sources.length + ' sources' }), h('span', { class: 'bb-web-chev' }, icon('chevronDown', 13))
        ]);
        btn.addEventListener('click', function () {
          var row = btn.closest('.bb-web-row');
          var col = row && row._bbCol;
          if (!col) return;
          var existing = col.querySelector('.bb-web-sources');
          if (existing) { existing.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
          col.appendChild(self._buildSources(m.sources, panelId));
          btn.setAttribute('aria-expanded', 'true');
          self._scrollToBottom(false, true);
        });
        acts.appendChild(btn);
      }
      return acts;
    }

    _buildSources(list, id) {
      var wrap = h('div', { class: 'bb-web-sources', id: id, role: 'list', 'aria-label': 'Sources' });
      list.forEach(function (s, i) {
        var inner = [h('span', { class: 'bb-web-source-n', 'aria-hidden': 'true', text: String(i + 1) }), h('span', { class: 'bb-web-source-copy' }, [
          h('span', { class: 'bb-web-source-title', text: s.title, style: { display: 'block' } }),
          s.snippet ? h('span', { class: 'bb-web-source-snip', text: s.snippet }) : null
        ])];
        wrap.appendChild(s.url
          ? h('a', { class: 'bb-web-source', role: 'listitem', href: s.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, inner)
          : h('div', { class: 'bb-web-source', role: 'listitem' }, inner));
      });
      return wrap;
    }

    async _rate(m, rating, paint, buttons) {
      if (m.rating === rating || m._rating) return;
      var st = this._st;
      if (!st.sessionId) return;
      var previous = m.rating || null;
      m.rating = rating;
      m._rating = true;
      paint();
      buttons.forEach(function (b) { b.disabled = true; });
      try {
        var payload = { session_id: st.sessionId, rating: rating };
        if (m.serverId != null) payload.message_id = m.serverId;
        await this.client.sendFeedback(payload);
        this._sound('success');
        this._toast({ type: 'success', title: 'Thanks for your feedback', body: rating === 'down' ? "We'll use it to improve this answer." : null });
        this._emit('feedback', { messageId: m.serverId != null ? m.serverId : null, rating: rating, sessionId: st.sessionId });
      } catch (err) {
        m.rating = previous;
        paint();
        this._sound('error');
        this._toast({ type: 'error', title: "Couldn't send feedback", body: err && err.message ? err.message : null });
      } finally {
        m._rating = false;
        buttons.forEach(function (b) { b.disabled = false; });
      }
    }

    _buildTyping() {
      var hint = h('div', { class: 'bb-web-typing-hint', 'aria-hidden': 'true' });
      var label = h('span', { class: 'bb-web-sr', text: 'Assistant is typing' });
      var started = this._st.sendingSince;
      if (this._typingTimer) clearInterval(this._typingTimer);
      this._typingTimer = setInterval(function () {
        var s = (Date.now() - started) / 1000;
        hint.textContent = s > 45 ? 'Still working on it, this can take a minute…' : (s > 12 ? 'Searching the knowledge base…' : '');
      }, 1000);
      return h('div', { class: 'bb-web-row is-bot is-first is-last is-new bb-web-typing-row', role: 'status' }, [
        this._mark('bb-web-av', this._botAvatarUrl(), 28),
        h('div', { class: 'bb-web-col' }, [h('div', { class: 'bb-web-typing', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), hint, label])
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
      var children = [icon('alert', 17), h('span', { class: 'bb-web-error-text', text: err.message })];
      if (err.retry) {
        var retry = h('button', { type: 'button', class: 'bb-web-error-btn' }, [icon('refresh', 14), 'Retry']);
        retry.addEventListener('click', function () {
          var fn = err.retry;
          self._st.error = null;
          self._render();
          fn();
        });
        children.push(retry);
      }
      var dismiss = h('button', { type: 'button', class: 'bb-web-error-x', 'aria-label': 'Dismiss error' }, icon('x', 14));
      dismiss.addEventListener('click', function () { self._st.error = null; self._renderError(); });
      children.push(dismiss);
      slot.appendChild(h('div', { class: 'bb-web-error', role: 'alert' }, children));
    }

    _toast(opts) {
      var els = this._els;
      if (!els || !els.toasts) return null;
      var self = this;
      var type = ['success', 'error', 'warning', 'info'].indexOf(opts.type) !== -1 ? opts.type : 'info';
      var iconName = { success: 'check', error: 'x', warning: 'warning', info: 'info' }[type];
      var t = { id: uid('t'), timer: null, remaining: toNumber(opts.duration, type === 'error' ? 6000 : 4000), started: 0 };
      var copy = h('div', { class: 'bb-web-toast-copy' }, [h('div', { class: 'bb-web-toast-title', text: String(opts.title || '') }), opts.body ? h('div', { class: 'bb-web-toast-body', text: String(opts.body) }) : null]);
      var node = h('div', { class: 'bb-web-toast is-' + type }, [h('span', { class: 'bb-web-toast-ic', 'aria-hidden': 'true' }, icon(iconName, 12, 2.5)), copy]);
      if (opts.action && opts.action.label) {
        var act = h('button', { type: 'button', class: 'bb-web-toast-action', text: String(opts.action.label) });
        act.addEventListener('click', function () { dismiss(); if (typeof opts.action.onClick === 'function') opts.action.onClick(); });
        node.appendChild(act);
      }
      var x = h('button', { type: 'button', class: 'bb-web-toast-x', 'aria-label': 'Dismiss notification' }, icon('x', 12, 2));
      x.addEventListener('click', function () { dismiss(); });
      node.appendChild(x);
      t.node = node;
      function start() {
        if (t.remaining <= 0) return;
        t.started = Date.now();
        t.timer = setTimeout(dismiss, t.remaining);
      }
      function dismiss() {
        if (t.gone) return;
        t.gone = true;
        if (t.timer) clearTimeout(t.timer);
        var i = self._toasts.indexOf(t);
        if (i !== -1) self._toasts.splice(i, 1);
        node.classList.add('is-leaving');
        setTimeout(function () { node.remove(); }, prefersReducedMotion() ? 100 : 200);
      }
      t.dismiss = dismiss;
      node.addEventListener('mouseenter', function () { if (t.timer) { clearTimeout(t.timer); t.timer = null; t.remaining -= Date.now() - t.started; } });
      node.addEventListener('mouseleave', function () { if (!t.timer && !t.gone) start(); });
      while (this._toasts.length >= 3) this._toasts[0].dismiss();
      this._toasts.push(t);
      els.toasts.appendChild(node);
      var live = type === 'error' ? els.toastAlert : els.toastLive;
      if (live) live.textContent = String(opts.title || '') + (opts.body ? '. ' + opts.body : '');
      start();
      return { dismiss: dismiss };
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
        container.appendChild(h('div', { class: 'bb-web-skel is-list', role: 'status', 'aria-label': 'Loading conversations' }, [h('i'), h('i'), h('i'), h('i')]));
        return;
      }
      if (st.sessionsError && !st.sessions) {
        var retry = h('button', { type: 'button', class: 'bb-web-link', text: 'Retry' });
        retry.addEventListener('click', function () { self._loadSessions(); });
        container.appendChild(h('div', { class: 'bb-web-inline-error', role: 'alert' }, [h('span', { text: st.sessionsError }), retry]));
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
            withIcons ? icon('chat', 16) : null,
            h('span', { text: title })
          ]);
          btn.addEventListener('click', function () { self.loadSession(s.session_id); });
          group.appendChild(btn);
        });
        container.appendChild(group);
      });
      if (!any) {
        container.appendChild(h('p', { class: 'bb-web-muted bb-web-center', text: q ? 'No conversation matches.' : (st.sessionsLoading ? 'Loading…' : 'No conversations yet.') }));
      }
    }

    _renderComposerState() {
      var els = this._els;
      var st = this._st;
      var btn = els.sendBtn;
      if (btn) {
        var hasText = !!(els.input && els.input.value.trim());
        var mode = st.sending ? 'stop' : 'send';
        if (btn._bbMode !== mode) {
          btn._bbMode = mode;
          clear(btn).appendChild(icon(mode === 'stop' ? 'stop' : 'arrowUp', 18, 2.25));
          btn.setAttribute('type', mode === 'stop' ? 'button' : 'submit');
          btn.setAttribute('aria-label', mode === 'stop' ? 'Stop generating' : 'Send message');
          btn.setAttribute('title', mode === 'stop' ? 'Stop' : 'Send (Enter)');
          btn.classList.toggle('is-stop', mode === 'stop');
        }
        btn.disabled = mode === 'send' && !hasText;
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
      els.pageTitle.textContent = this._st.sessionTitle || (this._st.messages.length ? 'New conversation' : (this._cfg.branding.title || this._botName()));
      this._renderPageDrawer();
    }

    _renderPageDrawer() {
      if (this._els.page) this._els.page.classList.toggle('is-drawer', !!this._st.drawer);
    }

    _scrollToBottom(instant, force) {
      var t = this._els && this._els.transcript;
      if (!t) return;
      if (!instant && !force && this._stick === false) return;
      var smooth = !instant && !prefersReducedMotion();
      var self = this;
      var run = function () {
        if (typeof t.scrollTo === 'function') t.scrollTo({ top: t.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        else t.scrollTop = t.scrollHeight;
        self._stick = true;
      };
      if (global.requestAnimationFrame) requestAnimationFrame(run);
      else run();
    }

    /** Repaint the streaming bubble at most once per frame. */
    _schedulePaint(m) {
      if (this._paintPending) return;
      this._paintPending = true;
      var self = this;
      var run = function () {
        self._paintPending = false;
        if (!m.streaming || !self._els || !self._els.log) return;
        var key = 'msg:' + m.id + ':' + (m.failed ? 'f' : '') + ':' + (m.status || '') + ':s:' + (m.stopped ? 'x' : '');
        var row = self._nodeCache.get(key);
        if (!row || !row._bbBubble) return;
        self._paintBot(row._bbBubble, m);
        if (self._stick !== false) {
          var t = self._els.transcript;
          t.scrollTop = t.scrollHeight;
        }
      };
      if (global.requestAnimationFrame && !document.hidden) requestAnimationFrame(run);
      else setTimeout(run, 60);
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
      this._stopRequested = false;
      userMsg.failed = false;
      st.sending = true;
      st.sendingSince = Date.now();
      st.streamMsg = null;
      st.error = null;
      this._render();
      this._scrollToBottom(false, true);
      var botMsg = null;
      var streamed = false;
      var startSession = st.sessionId;
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
        var data;
        var signal = ctrl ? ctrl.signal : undefined;
        if (this._cfg.streaming) {
          data = await this.client.chatStream(userMsg.content, st.sessionId, ctx, {
            signal: signal,
            onMeta: function (meta) {
              if (gen !== self._gen) return;
              if (meta.session_id && meta.session_id !== st.sessionId) {
                st.sessionId = meta.session_id;
                self._writeStore({ sessionId: meta.session_id });
              }
              if (meta.user_message_id != null) userMsg.serverId = meta.user_message_id;
            },
            onToken: function (t) {
              if (gen !== self._gen) return;
              if (!botMsg) {
                botMsg = { id: uid('m'), role: 'assistant', content: '', time: Date.now(), streaming: true, live: true };
                st.messages.push(botMsg);
                st.streamMsg = botMsg;
                if (self._typingTimer) { clearInterval(self._typingTimer); self._typingTimer = null; }
                self._render();
              }
              botMsg.content += t;
              self._schedulePaint(botMsg);
            }
          });
          streamed = !!data.streamed;
        } else {
          data = await this.client.chat(userMsg.content, st.sessionId, ctx, { signal: signal });
        }
        if (gen !== this._gen) return null;
        var newSession = !!data.session_id && data.session_id !== startSession;
        if (data.session_id) {
          st.sessionId = data.session_id;
          this._writeStore({ sessionId: data.session_id });
        }
        var content = data.response && data.response.trim() ? data.response : "Sorry, I don't have an answer for that yet.";
        if (!botMsg) {
          botMsg = { id: uid('m'), role: 'assistant', content: content, time: Date.now(), live: true };
          st.messages.push(botMsg);
        }
        botMsg.content = content;
        botMsg.streaming = false;
        botMsg.serverId = data.message_id != null ? data.message_id : null;
        if (data.user_message_id != null) userMsg.serverId = data.user_message_id;
        botMsg.sources = normalizeSources(data.search_results);
        if (newSession) {
          this._emit('session', { sessionId: st.sessionId });
          if (this._els.pageSessions || st.view === 'history') this._loadSessions();
        }
        this._afterAnswer(content);
        this._emit('response', { text: content, sessionId: st.sessionId, reasoning: data.reasoning, searchResults: data.search_results, messageId: botMsg.serverId, streamed: streamed, raw: data });
        return data;
      } catch (err) {
        if (gen !== this._gen) return null;
        if (err && err.code === 'aborted' && this._stopRequested) {
          if (botMsg) {
            botMsg.streaming = false;
            botMsg.stopped = true;
            botMsg.local = !st.sessionId;
            if (!botMsg.content.trim()) st.messages.splice(st.messages.indexOf(botMsg), 1);
          }
          this._emit('stop', { sessionId: st.sessionId, text: botMsg ? botMsg.content : '' });
          return null;
        }
        if (err && err.code === 'aborted') return null;
        if (botMsg) {
          botMsg.streaming = false;
          if (botMsg.content.trim()) {
            botMsg.status = 'Interrupted';
            botMsg.local = true;
          } else {
            st.messages.splice(st.messages.indexOf(botMsg), 1);
            botMsg = null;
          }
        }
        if (!botMsg) userMsg.failed = true;
        var partial = botMsg;
        this._sound('error');
        this._setError(err, 'chat', function () {
          if (partial) {
            var i = st.messages.indexOf(partial);
            if (i !== -1) st.messages.splice(i, 1);
          }
          return self._ask(userMsg);
        });
        return null;
      } finally {
        if (gen === this._gen) {
          st.sending = false;
          st.streamMsg = null;
          this._abort = null;
          this._stopRequested = false;
          if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = null; }
          this._render();
          this._scrollToBottom(false);
        }
      }
    }

    /** Sounds, unread badge and screen-reader announcement for a finished answer. */
    _afterAnswer(text) {
      var hiddenWidget = this._isOverlayMode() && !this._st.open;
      if (hiddenWidget) {
        this._st.unread += 1;
        this._renderLauncher();
        this._sound('notify');
        this._emit('unread', { count: this._st.unread });
      } else {
        this._sound('receive');
      }
      if (this._els.live) {
        var plain = String(text || '').replace(/[`*_#>|]/g, '').slice(0, 400);
        this._els.live.textContent = this._botName() + ': ' + plain;
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
      var sm = this._st.streamMsg;
      if (sm) { sm.streaming = false; sm.stopped = true; }
      this._st.sending = false;
      this._st.streamMsg = null;
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
        if (this._els.transcript) this._els.transcript.scrollTop = 0;
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
    }

    _autoGrow() {
      var ta = this._els.input;
      if (!ta) return;
      ta.style.height = 'auto';
      var max = 140;
      var min = parseFloat(global.getComputedStyle ? global.getComputedStyle(ta).minHeight : '') || 32;
      ta.style.height = Math.max(min, Math.min(ta.scrollHeight, max)) + 'px';
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
        msg = { id: uid('m'), role: 'user', kind: 'file', content: file.name || 'file', time: Date.now(), live: true };
        st.messages.push(msg);
      }
      msg.failed = false;
      st.view = 'chat';
      if (file.size > MAX_UPLOAD_BYTES) {
        msg.failed = true;
        this._render();
        this._sound('error');
        this._toast({ type: 'error', title: 'File too large', body: 'The maximum size is 10 MB.' });
        this._emit('error', { message: 'That file is too large. The maximum size is 10 MB.', action: 'upload', status: 0, code: 'too_large' });
        return null;
      }
      msg.status = 'Uploading…';
      st.uploading = true;
      this._render();
      this._scrollToBottom(false, true);
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
        this._sound('success');
        this._toast({ type: 'success', title: 'File uploaded', body: file.name || null });
        this._emit('upload', { file: { name: file.name, size: file.size, type: file.type }, sessionId: st.sessionId, raw: res });
        return res;
      } catch (err) {
        if (gen !== this._gen) return null;
        msg.failed = true;
        msg.status = null;
        this._sound('error');
        var canRetry = err.code === 'network' || err.retryable;
        this._toast({ type: 'error', title: 'Upload failed', body: err.message, action: canRetry ? { label: 'Retry', onClick: function () { self._upload(file, msg); } } : null });
        this._emit('error', { message: err.message, action: 'upload', status: err.status, code: err.code });
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
        target.style.paddingRight = px(this._cfg.sidebarWidth, '380px');
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
      if (this._st.view === 'history') {
        e.stopPropagation();
        this._toggleHistory(false);
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
  /** v1 streamChat: real token streaming via POST /api/chat/stream (falls back to one chunk on older servers). */
  BrainboxWebSDK.prototype.streamChat = async function (question, sessionId, onChunk, onComplete, onError) {
    try {
      var result = await this.client.chatStream(question, sessionId, null, {
        onToken: function (t) { if (typeof onChunk === 'function') onChunk(t); }
      });
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
      width: toNumber(o.width, 380),
      height: toNumber(o.height, 600),
      launcher: { type: o.launcherType === 'icon' || o.launcherType === 'gif' ? o.launcherType : 'button', text: o.buttonText || 'Chat', gifUrl: o.launcherGifUrl || null },
      theme: {},
      branding: {},
      placeholder: o.placeholder || 'Message',
      storageKey: o.storageKey || 'bb-web-v1'
    };
    if (o.primaryColor) cfg.theme.primary = o.primaryColor;
    if (o.accentColor) cfg.theme.ink = o.accentColor;
    if (o.backgroundColor && !/^#?f{3}(f{3})?$/i.test(String(o.backgroundColor))) cfg.theme.panel = o.backgroundColor;
    if (o.theme === 'dark' || o.theme === 'auto' || o.theme === 'light') cfg.theme.mode = o.theme;
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
    /** The Brainbox logo as an <svg> element (unique gradient id per call). */
    logo: function (size, label) { return HAS_DOM ? logo(size, label == null ? 'Brainbox' : label) : null; },
    /** UI sounds: Brainbox.sounds.play('send' | 'receive' | 'notify' | 'success' | 'error'). */
    sounds: { play: function (name) { playSound(name, true); }, unlock: unlockSounds, names: Object.keys(TONES) },
    parseSSE: createSSEParser,
    instances: instances,
    BrainboxWebSDK: BrainboxWebSDK,
    BrainboxWebWidget: BrainboxWebWidget
  };
});
