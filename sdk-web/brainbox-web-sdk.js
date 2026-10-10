/*!
 * Brainbox Web SDK v2.2.0
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

  var VERSION = '2.2.0';
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

  var DEFAULT_PRIMARY = '#b93fff';

  /**
   * "omago" accent family derived from a customer `primary` color. The default
   * (#b93fff) keeps the hand-tuned original values; other hex colors are mixed;
   * non-hex CSS colors fall back to color-mix().
   */
  function accentVars(primary, dark) {
    var c = hexToRgb(primary);
    var white = { r: 255, g: 255, b: 255 };
    if (c) {
      var isDefault = String(primary).toLowerCase() === DEFAULT_PRIMARY;
      var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      var vars = {
        '--bb-accent': primary,
        '--bb-accent-light': isDefault ? '#efc3ff' : mix(c, white, 0.7),
        '--bb-accent-dark': isDefault ? '#8120d2' : mix(c, { r: 0, g: 0, b: 0 }, 0.28),
        '--bb-accent-text': dark ? mix(c, white, 0.35) : primary,
        '--bb-a06': rgba(c, 0.06), '--bb-a08': rgba(c, 0.08), '--bb-a12': rgba(c, 0.12),
        '--bb-a18': rgba(c, 0.18), '--bb-a30': rgba(c, 0.3), '--bb-a45': rgba(c, 0.45),
        '--bb-accent-tint': rgba(c, dark ? 0.18 : 0.1),
        '--bb-accent-ring': rgba(c, 0.35),
        '--bb-on-accent': lum > 0.72 ? '#08080a' : '#ffffff'
      };
      if (!dark && !isDefault) {
        vars['--bb-body-top'] = 'rgba(255,255,255,.55)';
        vars['--bb-body-bottom'] = rgba(hexToRgb(mixHex(c, white, 0.86)), 0.72);
      }
      return vars;
    }
    var cm = function (pct) { return 'color-mix(in srgb, ' + primary + ' ' + pct + '%, transparent)'; };
    return {
      '--bb-accent': primary, '--bb-accent-light': primary, '--bb-accent-dark': primary, '--bb-accent-text': primary,
      '--bb-a06': cm(6), '--bb-a08': cm(8), '--bb-a12': cm(12), '--bb-a18': cm(18), '--bb-a30': cm(30), '--bb-a45': cm(45),
      '--bb-accent-tint': cm(dark ? 18 : 10), '--bb-accent-ring': cm(35)
    };
  }

  function mixHex(c, target, amount) {
    var ch = function (a, b) { var v = Math.round(a + (b - a) * amount).toString(16); return v.length < 2 ? '0' + v : v; };
    return '#' + ch(c.r, target.r) + ch(c.g, target.g) + ch(c.b, target.b);
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
    send: [['path', { d: 'm22 2-7 20-4-9-9-4Z' }], ['path', { d: 'M22 2 11 13' }]],
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

  /*
   * The Brainbox "omago" orb logo as a standalone SVG (public Brainbox.logo()).
   * Inside the widget the orb is drawn with CSS (.bb-web-orb) so it follows the
   * theme color. The gradient ids are unique per instance in the DOM.
   */
  var logoCounter = 0;
  function logo(size, label) {
    logoCounter += 1;
    var gid = 'bbOrbG-' + logoCounter;
    var hid = 'bbOrbH-' + logoCounter;
    var svg = svgEl('svg', { viewBox: '0 0 64 64', width: size || 32, height: size || 32, class: 'bb-web-logo', focusable: 'false' });
    if (label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', label);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    var defs = svgEl('defs');
    var grad = svgEl('radialGradient', { id: gid, cx: '50%', cy: '50%', r: '50%' });
    [[0, '#efc3ff'], [0.14, '#efc3ff'], [0.42, '#b93fff'], [0.66, '#8120d2'], [0.71, 'rgba(185,63,255,.06)'], [1, 'rgba(185,63,255,0)']].forEach(function (s) {
      grad.appendChild(svgEl('stop', { offset: s[0], 'stop-color': s[1] }));
    });
    var hi = svgEl('radialGradient', { id: hid, cx: '36%', cy: '28%', r: '50%' });
    hi.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.95 }));
    hi.appendChild(svgEl('stop', { offset: 0.24, 'stop-color': '#fff', 'stop-opacity': 0.95 }));
    hi.appendChild(svgEl('stop', { offset: 0.26, 'stop-color': '#fff', 'stop-opacity': 0 }));
    append(defs, [grad, hi]);
    svg.appendChild(defs);
    svg.appendChild(svgEl('circle', { cx: 32, cy: 32, r: 32, fill: 'url(#' + gid + ')' }));
    svg.appendChild(svgEl('circle', { cx: 32, cy: 32, r: 32, fill: 'url(#' + hid + ')' }));
    svg.appendChild(svgEl('path', { d: 'M17.6 32 32.9 21.9 46.4 17.6V46.4L32.9 42.1Z', fill: '#fff' }));
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
   * "omago" design: lavender frosted glass, purple orb, translucent white
   * borders. No drop shadows anywhere: separation comes from borders and
   * translucency (focus rings are outlines).
   * ==================================================================== */

  var CSS = [
    /* --- tokens (light) --- */
    '.bbr{--bb-font:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--bb-mono:"Fira Code",ui-monospace,Menlo,Consolas,"Liberation Mono",monospace;',
    '--bb-accent:#b93fff;--bb-accent-light:#efc3ff;--bb-accent-dark:#8120d2;--bb-accent-text:#b93fff;--bb-on-accent:#ffffff;',
    '--bb-a06:rgba(185,63,255,.06);--bb-a08:rgba(185,63,255,.08);--bb-a12:rgba(185,63,255,.12);--bb-a18:rgba(185,63,255,.18);--bb-a30:rgba(185,63,255,.3);--bb-a45:rgba(185,63,255,.45);',
    '--bb-accent-tint:rgba(185,63,255,.1);--bb-accent-ring:rgba(185,63,255,.35);',
    '--bb-panel:#fbf1ff;--bb-body-top:rgba(255,250,255,.7);--bb-body-bottom:rgba(249,230,255,.72);--bb-body-glow:rgba(255,255,255,.7);',
    '--bb-ink:#08080a;--bb-secondary:rgba(12,12,16,.54);--bb-tertiary:rgba(12,12,16,.42);--bb-meta:rgba(12,12,16,.72);--bb-bubble:rgba(255,255,255,.94);--bb-bubble-ink:rgba(12,12,16,.78);--bb-strong:rgba(12,12,16,.9);',
    '--bb-frame:rgba(255,255,255,.82);--bb-glass:rgba(255,255,255,.36);--bb-glass-line:rgba(255,255,255,.88);--bb-fill:rgba(255,255,255,.4);--bb-fill-2:rgba(255,255,255,.55);--bb-fill-strong:rgba(255,255,255,.8);--bb-solid:#ffffff;',
    '--bb-composer:rgba(255,255,255,.45);--bb-composer-focus:rgba(255,255,255,.62);--bb-toast:rgba(251,241,255,.86);--bb-close-bg:#050506;--bb-close-ink:#ffffff;',
    '--bb-success:#16a34a;--bb-warning:#f59e0b;--bb-danger:#e5484d;--bb-danger-text:#b91c1c;--bb-danger-tint:rgba(254,242,242,.95);--bb-danger-line:rgba(220,38,38,.22);',
    '--bb-avatar:linear-gradient(145deg,#c9b8ad,#9e6f59);',
    '--bb-spring:cubic-bezier(.32,.72,0,1);--bb-ease:cubic-bezier(.25,.1,.25,1);',
    '--bb-radius:22px;--bb-z:9999;--bb-w:360px;--bb-h:560px;--bb-ox:24px;--bb-oy:24px;--bb-sb-w:380px;--bb-sb-top:0px;',
    'font-family:var(--bb-font);font-size:13px;font-weight:400;line-height:1.45;color:var(--bb-ink);letter-spacing:normal;text-align:left;text-transform:none;text-indent:0;word-spacing:normal;direction:ltr;',
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color-scheme:light;}',
    /* --- tokens (dark: deep aubergine glass, lavender accents) --- */
    '.bbr.bb-web-dark{--bb-accent-text:#d49bff;--bb-accent-tint:rgba(185,63,255,.18);',
    '--bb-panel:#1a1022;--bb-body-top:rgba(36,21,48,.9);--bb-body-bottom:rgba(26,14,36,.96);--bb-body-glow:rgba(185,63,255,.1);',
    '--bb-ink:#f6eefc;--bb-secondary:rgba(246,238,252,.6);--bb-tertiary:rgba(246,238,252,.44);--bb-meta:rgba(246,238,252,.78);--bb-bubble:rgba(255,255,255,.075);--bb-bubble-ink:rgba(246,238,252,.9);--bb-strong:#ffffff;',
    '--bb-frame:rgba(212,155,255,.18);--bb-glass:rgba(255,255,255,.04);--bb-glass-line:rgba(255,255,255,.08);--bb-fill:rgba(255,255,255,.06);--bb-fill-2:rgba(255,255,255,.08);--bb-fill-strong:rgba(255,255,255,.14);--bb-solid:#241630;',
    '--bb-composer:rgba(255,255,255,.05);--bb-composer-focus:rgba(255,255,255,.08);--bb-toast:rgba(40,24,54,.9);--bb-close-bg:#f6eefc;--bb-close-ink:#1a1022;',
    '--bb-danger-text:#ff8a80;--bb-danger-tint:rgba(255,69,58,.12);--bb-danger-line:rgba(255,105,97,.3);color-scheme:dark;}',

    /* --- host-CSS resets --- */
    '.bbr *,.bbr *::before,.bbr *::after{box-sizing:border-box;}',
    '.bbr h1,.bbr h2,.bbr h3,.bbr p,.bbr ul,.bbr ol,.bbr li,.bbr form,.bbr label,.bbr pre,.bbr table,.bbr nav,.bbr aside,.bbr main,.bbr section,.bbr header{margin:0;padding:0;font-family:inherit;letter-spacing:normal;text-transform:none;border:0;background:none;box-shadow:none;}',
    '.bbr h1,.bbr h2,.bbr h3{color:inherit;}',
    '.bbr button,.bbr input,.bbr textarea{font-family:inherit;font-size:inherit;line-height:normal;letter-spacing:normal;text-transform:none;margin:0;color:inherit;}',
    '.bbr button{-webkit-appearance:none;appearance:none;background:none;border:0;border-radius:0;padding:0;min-width:0;min-height:0;width:auto;height:auto;box-shadow:none;text-shadow:none;cursor:pointer;font-weight:inherit;-webkit-tap-highlight-color:transparent;',
    'transition:transform 120ms ease,background-color 160ms ease,border-color 160ms ease,color 160ms ease,filter 160ms ease,opacity 160ms ease;}',
    '.bbr button:hover:not(:disabled){filter:brightness(.98);}',
    '.bbr button:active:not(:disabled){transform:translateY(1px) scale(.96);filter:brightness(.94);}',
    '.bbr button:focus,.bbr a:focus,.bbr input:focus,.bbr textarea:focus{outline:none;}',
    '.bbr button:focus-visible,.bbr a:focus-visible{outline:2px solid var(--bb-accent);outline-offset:2px;}',
    '.bbr button:disabled{cursor:not-allowed;}',
    '.bbr input,.bbr textarea{box-shadow:none;border-radius:0;border:0;background:transparent;padding:0;}',
    '.bbr svg{display:block;flex:0 0 auto;overflow:visible;}',
    '.bbr svg.bb-web-icon{fill:none;vertical-align:middle;}',
    '.bbr img{max-width:100%;border:0;}',
    '.bbr a{color:var(--bb-accent-text);}',
    '.bbr .bb-web-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
    '.bbr .bb-web-is-closed{display:none!important;}',

    /* --- motion --- */
    '@keyframes bb-web-open{from{opacity:0;transform:translateY(12px) scale(.98);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-close{from{opacity:1;transform:none;}to{opacity:0;transform:translateY(12px) scale(.98);}}',
    '@keyframes bb-web-slide{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-sheet{from{opacity:.6;transform:translateY(40px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-msg{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-fade{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-pop{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-scale-in{from{opacity:0;transform:scale(.6);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-toast-in{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}',
    '@keyframes bb-web-toast-out{from{opacity:1;transform:none;}to{opacity:0;transform:translateY(4px) scale(.98);}}',
    '@keyframes bb-web-dot{0%,80%,100%{opacity:.25;transform:scale(.85);}40%{opacity:1;transform:scale(1);}}',
    '@keyframes bb-web-blink{0%,100%{opacity:.9;}50%{opacity:.15;}}',
    '@keyframes bb-web-shimmer{from{background-position:150% 0;}to{background-position:-50% 0;}}',
    '@keyframes bb-web-spin{to{transform:rotate(360deg);}}',

    /* --- host containers --- */
    '.bbr.bb-web-host{position:fixed;top:0;left:0;width:0;height:0;z-index:var(--bb-z);}',
    '.bbr .bb-web-float{position:fixed;bottom:var(--bb-oy);right:var(--bb-ox);display:flex;flex-direction:column;align-items:flex-end;gap:16px;pointer-events:none;z-index:2;}',
    '.bbr.bb-web-left .bb-web-float{right:auto;left:var(--bb-ox);align-items:flex-start;}',
    '.bbr .bb-web-float>*{pointer-events:auto;}',
    '.bbr .bb-web-window{width:var(--bb-w);max-width:calc(100vw - 2 * var(--bb-ox));transform-origin:bottom right;animation:bb-web-open 220ms ease-out;box-shadow:none;}',
    '.bbr.bb-web-left .bb-web-window{transform-origin:bottom left;}',
    '.bbr .bb-web-window.is-leaving{animation:bb-web-close 180ms ease-in forwards;pointer-events:none;}',
    '.bbr .bb-web-window .bb-web-panel{height:min(var(--bb-h),calc(100vh - var(--bb-oy) - 86px));}',

    /* --- launcher (purple radial-gradient pill) --- */
    '.bbr .bb-web-launcher{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;width:56px;height:56px;padding:0;border-radius:999px;color:#fff;background:radial-gradient(circle at 20% 20%,var(--bb-accent-light),var(--bb-accent) 50%,var(--bb-accent-dark) 100%);border:2px solid rgba(255,255,255,.55);box-shadow:none;filter:none;animation:bb-web-scale-in 260ms var(--bb-spring);}',
    '.bbr .bb-web-launcher:hover:not(:disabled){filter:brightness(1.06) saturate(1.05);transform:translateY(-1px);}',
    '.bbr .bb-web-launcher:active:not(:disabled){transform:translateY(1px) scale(.97);}',
    '.bbr .bb-web-launcher:focus-visible{outline:3px solid var(--bb-accent-ring);outline-offset:3px;}',
    '.bbr .bb-web-launcher.is-button{width:auto;min-width:104px;height:46px;padding:0 18px 0 15px;font-size:15px;font-weight:760;white-space:nowrap;}',
    '.bbr .bb-web-launcher.is-icon{background:var(--bb-accent);}',
    '.bbr .bb-web-launcher.is-gif{width:64px;height:64px;overflow:hidden;background:#fff;}',
    '.bbr .bb-web-launcher.is-gif img{width:100%;height:100%;object-fit:cover;display:block;border-radius:999px;}',
    '.bbr .bb-web-launcher.is-open{min-width:0;width:52px;height:52px;padding:0;background:var(--bb-close-bg);color:var(--bb-close-ink);border-color:var(--bb-a18);}',
    '.bbr .bb-web-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:var(--bb-danger);color:#fff;font-size:11.5px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;border:2px solid var(--bb-panel);box-shadow:none;animation:bb-web-scale-in 260ms var(--bb-spring);}',
    '.bbr.bb-web-left .bb-web-badge{right:auto;left:-4px;}',

    /* --- orb logo / avatars --- */
    '.bbr .bb-web-orb{position:relative;display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border-radius:999px;overflow:hidden;background:radial-gradient(circle at 36% 28%,rgba(255,255,255,.95) 0 12%,transparent 13%),radial-gradient(circle at 50% 50%,var(--bb-accent-light) 0 14%,var(--bb-accent) 42%,var(--bb-accent-dark) 66%,var(--bb-a06) 71%);}',
    '.bbr .bb-web-orb::before{content:"";width:45%;height:45%;border-radius:999px;background:#fff;clip-path:polygon(0 50%,53% 15%,100% 0,100% 100%,53% 85%);}',
    '.bbr .bb-web-orb.has-image{background:#fff;}',
    '.bbr .bb-web-orb.has-image::before{display:none;}',
    '.bbr .bb-web-orb img{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block;}',
    '.bbr .bb-web-hlogo{width:38px;height:38px;}',
    '.bbr .bb-web-av{width:34px;height:34px;flex:0 0 34px;align-self:flex-start;}',
    '.bbr .bb-web-uav{width:34px;height:34px;flex:0 0 34px;border-radius:999px;overflow:hidden;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:800;background:var(--bb-avatar);}',
    '.bbr .bb-web-uav img{width:100%;height:100%;object-fit:cover;display:block;}',

    /* --- panel (omago) --- */
    '.bbr .bb-web-panel{width:100%;min-height:0;position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--bb-radius);border:2px solid var(--bb-frame);background:var(--bb-panel);box-shadow:none;color:var(--bb-ink);font-size:13px;outline:none;isolation:isolate;}',
    '.bbr .bb-web-header{flex:0 0 auto;position:relative;z-index:3;min-height:68px;padding:12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--bb-glass-line);background:var(--bb-glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);}',
    '.bbr .bb-web-header-copy{flex:1;min-width:0;}',
    '.bbr .bb-web-title{margin:0;font-size:clamp(15px,2.2vw,18px);line-height:1.15;font-weight:820;color:var(--bb-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-subtitle{margin-top:5px;color:var(--bb-secondary);font-size:11px;line-height:1.25;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-header-actions{display:flex;align-items:center;gap:5px;flex:0 0 auto;}',
    '.bbr .bb-web-hbtn{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;flex:0 0 auto;padding:0;color:var(--bb-ink);background:var(--bb-fill-2);border:1px solid var(--bb-glass-line);}',
    '.bbr .bb-web-hbtn:hover:not(:disabled),.bbr .bb-web-hbtn.is-active{background:var(--bb-solid);color:var(--bb-accent-text);}',
    '.bbr .bb-web-hbtn.bb-web-close{width:34px;height:34px;color:var(--bb-close-ink);background:var(--bb-close-bg);border:0;}',
    '.bbr .bb-web-hbtn.bb-web-close:hover:not(:disabled){background:var(--bb-close-bg);color:var(--bb-close-ink);filter:brightness(1.25);}',
    '.bbr .bb-web-body{flex:1;min-height:0;position:relative;display:flex;flex-direction:column;background:radial-gradient(circle at 86% 42%,var(--bb-body-glow),transparent 30%),linear-gradient(180deg,var(--bb-body-top),var(--bb-body-bottom));}',
    '.bbr .bb-web-transcript{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 8px 8px 12px;margin-right:4px;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:var(--bb-a18) transparent;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar{width:7px;}',
    '.bbr .bb-web-transcript::-webkit-scrollbar-thumb{background:var(--bb-a18);border-radius:999px;}',
    '.bbr .bb-web-log{flex:1 0 auto;display:flex;flex-direction:column;padding-bottom:4px;}',

    /* --- intro (empty state) --- */
    '.bbr .bb-web-intro{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:start;margin-bottom:12px;animation:bb-web-fade 200ms ease-out;}',
    '.bbr .bb-web-intro .bb-web-av{margin-top:2px;}',
    '.bbr .bb-web-author{display:flex;align-items:baseline;gap:8px;margin:8px 0;font-weight:820;font-size:15px;color:var(--bb-ink);}',
    '.bbr .bb-web-author time{color:var(--bb-tertiary);font-size:11px;font-weight:700;}',
    '.bbr .bb-web-intro-bubble{width:fit-content;max-width:min(100%,252px);padding:9px 11px;border-radius:0 14px 14px 14px;background:var(--bb-bubble);color:var(--bb-bubble-ink);font-size:12.5px;line-height:1.45;font-weight:560;overflow-wrap:anywhere;}',
    '.bbr .bb-web-intro-bubble+.bb-web-intro-bubble{margin-top:8px;border-radius:14px;}',
    '.bbr .bb-web-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}',
    '.bbr .bb-web-chip{max-width:100%;min-height:32px;padding:6px 12px;border:1px solid var(--bb-a18);border-radius:999px;background:var(--bb-fill);color:var(--bb-accent-text);font-size:12.5px;font-weight:780;line-height:1.3;text-align:left;}',
    '.bbr .bb-web-chip:hover:not(:disabled){background:var(--bb-fill-strong);border-color:var(--bb-a30);}',

    /* --- messages --- */
    '.bbr .bb-web-day{align-self:center;margin:14px 0 4px;padding:3px 10px;border-radius:999px;border:1px solid var(--bb-glass-line);background:var(--bb-fill);font-size:10.5px;line-height:1.3;font-weight:750;letter-spacing:.02em;color:var(--bb-tertiary);}',
    '.bbr .bb-web-row{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:start;margin-top:4px;}',
    '.bbr .bb-web-row.is-first{margin-top:12px;}',
    '.bbr .bb-web-day+.bb-web-row,.bbr .bb-web-log>.bb-web-row:first-child{margin-top:6px;}',
    '.bbr .bb-web-row.is-user{grid-template-columns:minmax(0,1fr) 34px;}',
    '.bbr .bb-web-row.is-user>.bb-web-av{grid-column:2;grid-row:1;}',
    '.bbr .bb-web-row.is-user>.bb-web-col{grid-column:1;grid-row:1;}',
    '.bbr .bb-web-row.is-new{animation:bb-web-msg 160ms ease-out;}',
    '.bbr .bb-web-row>.bb-web-av{visibility:hidden;}',
    '.bbr .bb-web-row.is-first>.bb-web-av{visibility:visible;}',
    '.bbr .bb-web-col{display:flex;flex-direction:column;align-items:flex-start;min-width:0;}',
    '.bbr .bb-web-row.is-user .bb-web-col{align-items:flex-end;}',
    '.bbr .bb-web-msg-meta{display:none;align-items:baseline;gap:7px;margin:0 0 4px;color:var(--bb-meta);font-size:12px;font-weight:800;}',
    '.bbr .bb-web-msg-meta time{color:var(--bb-tertiary);font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums;}',
    '.bbr .bb-web-row.is-first .bb-web-msg-meta{display:flex;}',
    '.bbr .bb-web-row.is-user .bb-web-msg-meta{justify-content:flex-end;}',
    '.bbr .bb-web-bubble{width:fit-content;max-width:92%;padding:8px 11px;border-radius:14px 14px 14px 6px;background:var(--bb-bubble);color:var(--bb-bubble-ink);font-size:13px;line-height:1.5;overflow-wrap:anywhere;}',
    '.bbr .bb-web-row.is-user .bb-web-bubble{max-width:86%;border-radius:14px 14px 6px 14px;color:var(--bb-on-accent);background:var(--bb-accent);}',
    '.bbr .bb-web-row.is-failed .bb-web-bubble{opacity:.6;}',
    '.bbr .bb-web-user-text{white-space:pre-wrap;}',
    '.bbr .bb-web-file{display:inline-flex;align-items:center;gap:8px;}',
    '.bbr .bb-web-file-tile{width:28px;height:28px;flex:0 0 28px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.24);color:inherit;font-size:9px;font-weight:800;letter-spacing:.02em;}',
    '.bbr .bb-web-htime,.bbr .bb-web-time{display:none!important;}',
    '.bbr .bb-web-foot{display:flex;align-items:center;gap:2px;min-height:0;margin-top:4px;font-size:10.5px;line-height:1.3;font-weight:700;color:var(--bb-tertiary);}',
    '.bbr .bb-web-row.is-user .bb-web-foot{flex-direction:row-reverse;}',
    '.bbr .bb-web-foot:empty{display:none;}',
    '.bbr .bb-web-status{padding:0 4px;display:inline-flex;align-items:center;gap:5px;}',
    '.bbr .bb-web-status.is-error{color:var(--bb-danger-text);}',
    '.bbr .bb-web-acts{display:flex;align-items:center;gap:2px;opacity:0;transition:opacity 140ms ease;}',
    '.bbr .bb-web-row:hover .bb-web-acts,.bbr .bb-web-row:focus-within .bb-web-acts,.bbr .bb-web-row.is-latest .bb-web-acts{opacity:1;}',
    '@media (hover:none){.bbr .bb-web-acts{opacity:1;}}',
    '.bbr .bb-web-act{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;color:var(--bb-tertiary);}',
    '.bbr .bb-web-act:hover:not(:disabled){background:var(--bb-fill-strong);color:var(--bb-accent-text);}',
    '.bbr .bb-web-act.is-on{color:var(--bb-accent-text);background:var(--bb-accent-tint);}',
    '.bbr .bb-web-act.is-on .bb-web-icon{fill:var(--bb-a18);}',
    '.bbr .bb-web-act:disabled{opacity:.5;}',
    '.bbr .bb-web-srcbtn{display:inline-flex;align-items:center;gap:4px;height:24px;margin-left:4px;padding:0 9px 0 8px;border-radius:999px;border:1px solid var(--bb-a18);background:var(--bb-fill);color:var(--bb-accent-text);font-size:11.5px;font-weight:760;}',
    '.bbr .bb-web-srcbtn:hover:not(:disabled){background:var(--bb-fill-strong);border-color:var(--bb-a30);}',
    '.bbr .bb-web-srcbtn .bb-web-chev{transition:transform 180ms var(--bb-spring);}',
    '.bbr .bb-web-srcbtn[aria-expanded="true"] .bb-web-chev{transform:rotate(180deg);}',
    '.bbr .bb-web-sources{display:grid;gap:6px;width:100%;max-width:300px;margin-top:6px;animation:bb-web-pop 160ms ease-out;transform-origin:top left;}',
    '.bbr .bb-web-source{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:12px;border:1px solid var(--bb-a18);background:var(--bb-bubble);color:var(--bb-ink);text-decoration:none;}',
    '.bbr a.bb-web-source:hover{background:var(--bb-solid);border-color:var(--bb-a30);}',
    '.bbr .bb-web-source-n{width:20px;height:20px;flex:0 0 20px;border-radius:999px;display:grid;place-items:center;background:var(--bb-accent-tint);color:var(--bb-accent-text);font-size:10.5px;font-weight:800;}',
    '.bbr .bb-web-source-copy{min-width:0;}',
    '.bbr .bb-web-source-title{font-size:12.5px;font-weight:750;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.bbr .bb-web-source-snip{margin-top:2px;font-size:11.5px;line-height:1.4;color:var(--bb-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',

    /* streaming caret + typing */
    '.bbr .bb-web-caret{display:inline-block;width:.42em;height:1.05em;margin-left:2px;vertical-align:-.17em;border-radius:1.5px;background:var(--bb-accent);opacity:.8;animation:bb-web-blink 1s ease infinite;}',
    '.bbr .bb-web-typing{display:inline-flex;align-items:center;gap:8px;width:fit-content;padding:9px 12px;border-radius:14px 14px 14px 6px;background:var(--bb-bubble);font-size:12.5px;color:var(--bb-secondary);}',
    '.bbr .bb-web-dots{display:inline-flex;gap:3px;}',
    '.bbr .bb-web-dots i{width:6px;height:6px;border-radius:999px;background:var(--bb-accent);opacity:.35;animation:bb-web-dot 1.1s ease-in-out infinite;}',
    '.bbr .bb-web-dots i:nth-child(2){animation-delay:.15s;}',
    '.bbr .bb-web-dots i:nth-child(3){animation-delay:.3s;}',
    '.bbr .bb-web-spinner{display:inline-block;width:12px;height:12px;border-radius:999px;border:2px solid var(--bb-a30);border-top-color:var(--bb-accent);animation:bb-web-spin .8s linear infinite;}',

    /* skeletons */
    '.bbr .bb-web-skel{display:grid;gap:10px;padding:12px 0;margin-bottom:auto;}',
    '.bbr .bb-web-skel i{display:block;height:34px;border-radius:14px;background:linear-gradient(90deg,var(--bb-fill) 25%,var(--bb-fill-strong) 50%,var(--bb-fill) 75%);background-size:200% 100%;animation:bb-web-shimmer 1.4s linear infinite;}',
    '.bbr .bb-web-skel i:nth-child(odd){width:62%;justify-self:start;border-bottom-left-radius:6px;}',
    '.bbr .bb-web-skel i:nth-child(even){width:46%;justify-self:end;border-bottom-right-radius:6px;}',
    '.bbr .bb-web-skel i:nth-child(3){height:56px;width:72%;}',
    '.bbr .bb-web-skel.is-list i{width:100%!important;height:34px;border-radius:12px;justify-self:stretch;}',

    /* markdown */
    '.bbr .bb-web-md p{margin:0 0 8px;}',
    '.bbr .bb-web-md>:last-child{margin-bottom:0;}',
    '.bbr .bb-web-md a{color:var(--bb-accent-text);text-decoration:underline;text-underline-offset:2px;}',
    '.bbr .bb-web-md strong{font-weight:750;color:var(--bb-strong);}',
    '.bbr .bb-web-md em{font-style:italic;}',
    '.bbr .bb-web-md-h{font-size:14px;font-weight:800;line-height:1.3;color:var(--bb-ink);margin:8px 0 6px;}',
    '.bbr .bb-web-md-h:first-child{margin-top:0;}',
    '.bbr .bb-web-md .bb-web-md-list{margin:4px 0 8px;padding-left:20px;}',
    '.bbr .bb-web-md ul.bb-web-md-list{list-style:disc;}',
    '.bbr .bb-web-md ol.bb-web-md-list{list-style:decimal;}',
    '.bbr .bb-web-md .bb-web-md-list li{margin-bottom:3px;display:list-item;}',
    '.bbr .bb-web-icode{padding:1px 5px;border-radius:5px;background:var(--bb-a08);color:var(--bb-accent-dark);font-family:var(--bb-mono);font-size:12px;}',
    '.bbr.bb-web-dark .bb-web-icode{color:var(--bb-accent-text);background:var(--bb-a18);}',
    '.bbr .bb-web-code{margin:8px 0;border-radius:10px;overflow:hidden;background:#1e1e2e;border:1px solid #2e2e3e;}',
    '.bbr .bb-web-code pre{margin:0;padding:10px 12px;overflow-x:auto;background:transparent;border:0;font-family:var(--bb-mono);font-size:12px;line-height:1.5;color:#e4e4f0;white-space:pre;}',
    '.bbr .bb-web-code code{color:inherit;background:transparent;font-family:inherit;padding:0;}',
    '.bbr .bb-web-code-head{display:flex;justify-content:space-between;align-items:center;padding:5px 8px 5px 12px;background:#14141e;color:#9d9db3;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}',
    '.bbr .bb-web-code-copy{display:inline-flex;align-items:center;gap:4px;color:#b8b8d1;font-size:11px;padding:2px 8px;border-radius:6px;text-transform:none;}',
    '.bbr .bb-web-code-copy:hover:not(:disabled){background:rgba(255,255,255,.08);}',
    '.bbr .bb-web-table-wrap{overflow-x:auto;margin:8px 0;}',
    '.bbr .bb-web-table{width:100%;border-collapse:collapse;font-size:12px;}',
    '.bbr .bb-web-table th,.bbr .bb-web-table td{border:1px solid var(--bb-a18);padding:5px 7px;text-align:left;vertical-align:top;}',
    '.bbr .bb-web-table th{background:var(--bb-a06);font-weight:700;}',

    /* --- bottom area: toasts, error banner, composer --- */
    '.bbr .bb-web-bottom{flex:0 0 auto;position:relative;z-index:2;display:flex;flex-direction:column;gap:8px;padding:0 12px 12px;}',
    '.bbr .bb-web-error-slot:empty{display:none;}',
    '.bbr .bb-web-toasts{position:absolute;left:12px;right:12px;bottom:calc(100% + 4px);display:flex;flex-direction:column;align-items:stretch;gap:8px;pointer-events:none;z-index:4;}',
    '.bbr .bb-web-toast{display:flex;align-items:flex-start;gap:10px;padding:10px 10px 10px 12px;border-radius:16px;border:1px solid var(--bb-a18);background:var(--bb-toast);-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%);box-shadow:none;pointer-events:auto;animation:bb-web-toast-in 240ms var(--bb-spring);}',
    '.bbr .bb-web-toast.is-leaving{animation:bb-web-toast-out 180ms ease forwards;}',
    '.bbr .bb-web-toast-ic{width:20px;height:20px;flex:0 0 20px;margin-top:1px;border-radius:999px;display:grid;place-items:center;color:#fff;background:radial-gradient(circle at 36% 28%,var(--bb-accent-light),var(--bb-accent) 55%,var(--bb-accent-dark));}',
    '.bbr .bb-web-toast.is-success .bb-web-toast-ic{background:var(--bb-success);}',
    '.bbr .bb-web-toast.is-error .bb-web-toast-ic{background:var(--bb-danger);}',
    '.bbr .bb-web-toast.is-warning .bb-web-toast-ic{background:var(--bb-warning);}',
    '.bbr .bb-web-toast-copy{flex:1;min-width:0;padding-top:1px;}',
    '.bbr .bb-web-toast-title{font-size:12.5px;line-height:1.35;font-weight:800;color:var(--bb-ink);}',
    '.bbr .bb-web-toast-body{font-size:12px;line-height:1.35;font-weight:560;color:var(--bb-secondary);margin-top:1px;}',
    '.bbr .bb-web-toast-action{flex:0 0 auto;height:24px;padding:0 9px;border-radius:999px;color:var(--bb-accent-text);font-size:12px;font-weight:760;}',
    '.bbr .bb-web-toast-action:hover:not(:disabled){background:var(--bb-accent-tint);}',
    '.bbr .bb-web-toast-x{width:22px;height:22px;flex:0 0 22px;border-radius:999px;display:grid;place-items:center;color:var(--bb-tertiary);}',
    '.bbr .bb-web-toast-x:hover:not(:disabled){background:var(--bb-fill-strong);color:var(--bb-ink);}',
    '.bbr .bb-web-error{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 10px;border-radius:12px;background:var(--bb-danger-tint);border:1px solid var(--bb-danger-line);color:var(--bb-danger-text);font-size:12.5px;line-height:1.35;animation:bb-web-pop 160ms ease-out;}',
    '.bbr .bb-web-error-text{flex:1;min-width:0;}',
    '.bbr .bb-web-error-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:999px;background:#b91c1c;color:#fff;font-size:12px;font-weight:700;}',
    '.bbr .bb-web-error-x{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;color:var(--bb-danger-text);}',
    '.bbr .bb-web-error-x:hover:not(:disabled){background:rgba(185,28,28,.08);}',
    '.bbr .bb-web-composer{flex:0 0 auto;position:relative;padding:10px;border-radius:17px;border:1px solid var(--bb-glass-line);background:var(--bb-composer);box-shadow:none;transition:background-color 160ms ease,border-color 160ms ease;}',
    '.bbr .bb-web-composer:focus-within{background:var(--bb-composer-focus);border-color:var(--bb-a30);}',
    '.bbr .bb-web-composer textarea{display:block;width:100%;min-height:30px;max-height:140px;height:30px;padding:2px 2px 6px;border:0;outline:0;resize:none;overflow-y:hidden;color:var(--bb-ink);background:transparent;font-size:13px;line-height:1.4;}',
    '.bbr .bb-web-composer textarea::placeholder{color:var(--bb-secondary);opacity:1;}',
    '.bbr .bb-web-bar{display:flex;align-items:center;gap:6px;}',
    '.bbr .bb-web-tool,.bbr .bb-web-hpill{display:inline-flex;align-items:center;justify-content:center;color:var(--bb-ink);background:var(--bb-fill);border:1px solid transparent;}',
    '.bbr .bb-web-tool{width:34px;height:34px;flex:0 0 34px;border-radius:999px;padding:0;}',
    '.bbr .bb-web-hpill{height:34px;gap:5px;border-radius:999px;padding:0 11px;font-size:12.5px;font-weight:760;white-space:nowrap;}',
    '.bbr .bb-web-tool:hover:not(:disabled),.bbr .bb-web-hpill:hover:not(:disabled),.bbr .bb-web-hpill.is-active{background:var(--bb-fill-strong);border-color:var(--bb-glass-line);}',
    '.bbr .bb-web-hpill.is-active{color:var(--bb-accent-text);}',
    '.bbr .bb-web-tool:disabled{opacity:.45;}',
    '.bbr .bb-web-send{margin-left:auto;width:38px;height:38px;flex:0 0 38px;border-radius:999px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:radial-gradient(circle at 36% 28%,#c3d9ff,var(--bb-accent) 53%,var(--bb-accent-dark) 100%);box-shadow:none;}',
    '.bbr .bb-web-send .bb-web-icon{margin-left:-2px;margin-top:1px;}',
    '.bbr .bb-web-send:hover:not(:disabled){filter:brightness(1.08) saturate(1.05);}',
    '.bbr .bb-web-send:disabled{opacity:.78;cursor:default;}',
    '.bbr .bb-web-send.is-stop{background:var(--bb-close-bg);color:var(--bb-close-ink);}',
    '.bbr .bb-web-send.is-stop .bb-web-icon{margin:0;}',
    '.bbr .bb-web-file-input{display:none!important;}',
    '.bbr .bb-web-emoji-wrap{position:relative;display:inline-flex;}',
    '.bbr .bb-web-emoji-pop{position:absolute;bottom:42px;left:0;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;background:var(--bb-solid);border:1px solid var(--bb-a18);border-radius:14px;box-shadow:none;z-index:10;transform-origin:bottom left;animation:bb-web-pop 160ms ease-out;}',
    '.bbr .bb-web-emoji-pop button{width:32px;height:32px;font-size:18px;line-height:1;border-radius:8px;display:grid;place-items:center;}',
    '.bbr .bb-web-emoji-pop button:hover:not(:disabled){background:var(--bb-a08);}',

    /* --- history (inside the widget) --- */
    '.bbr .bb-web-history{display:flex;flex-direction:column;gap:8px;animation:bb-web-fade 160ms ease-out;}',
    '.bbr .bb-web-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.bbr .bb-web-back{display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:0 11px 0 7px;border-radius:999px;background:var(--bb-fill-2);border:1px solid var(--bb-glass-line);color:var(--bb-accent-text);font-size:12.5px;font-weight:760;}',
    '.bbr .bb-web-back:hover:not(:disabled){background:var(--bb-solid);}',
    '.bbr .bb-web-history-title{font-size:12px;font-weight:800;color:var(--bb-secondary);}',
    '.bbr .bb-web-search{display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--bb-glass-line);background:var(--bb-fill-2);color:var(--bb-secondary);transition:border-color 160ms ease,background-color 160ms ease;}',
    '.bbr .bb-web-search:focus-within{border-color:var(--bb-a30);background:var(--bb-fill-strong);}',
    '.bbr .bb-web-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;padding:0;font-size:12.5px;color:var(--bb-ink);}',
    '.bbr .bb-web-search input::placeholder{color:var(--bb-secondary);opacity:1;}',
    '.bbr .bb-web-group{margin-bottom:10px;}',
    '.bbr .bb-web-group-label{padding:6px 4px 4px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--bb-tertiary);}',
    '.bbr .bb-web-session{width:100%;display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 10px;margin-bottom:4px;border:1px solid transparent;border-radius:12px;background:var(--bb-fill);color:var(--bb-meta);font-size:12.5px;font-weight:600;text-align:left;}',
    '.bbr .bb-web-session .bb-web-icon{color:var(--bb-accent-text);opacity:.8;}',
    '.bbr .bb-web-session span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
    '.bbr .bb-web-session:hover:not(:disabled){background:var(--bb-fill-strong);}',
    '.bbr .bb-web-session.is-active{background:var(--bb-solid);border-color:var(--bb-a30);color:var(--bb-accent-text);}',
    '.bbr .bb-web-muted{color:var(--bb-secondary);font-size:12.5px;}',
    '.bbr .bb-web-center{text-align:center;padding:16px 8px;}',
    '.bbr .bb-web-inline-error{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;color:var(--bb-danger-text);font-size:12.5px;padding:12px 4px;}',
    '.bbr .bb-web-link{padding:0 4px;color:var(--bb-accent-text);font-weight:700;text-decoration:underline;}',

    /* --- sidebar dock --- */
    '.bbr .bb-web-dock{position:fixed;top:var(--bb-sb-top);right:0;bottom:0;width:var(--bb-sb-w);max-width:100vw;display:flex;padding:8px;z-index:1;background:linear-gradient(180deg,var(--bb-a08),var(--bb-a12)),var(--bb-panel);border-left:1px solid var(--bb-a18);box-shadow:none;animation:bb-web-slide 200ms ease-out;}',
    '.bbr .bb-web-dock .bb-web-panel{height:100%;border-radius:18px;}',

    /* --- inline --- */
    '.bbr.bb-web-m-inline{position:relative;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;}',
    '.bbr.bb-web-m-inline .bb-web-panel{flex:1;height:auto;}',

    /* --- page (conversation list + chat), omago palette --- */
    '.bbr.bb-web-m-page{position:relative;width:100%;height:100%;min-height:520px;display:flex;}',
    '.bbr .bb-web-page{flex:1;display:flex;min-width:0;min-height:0;overflow:hidden;position:relative;border-radius:var(--bb-radius);border:2px solid var(--bb-frame);background:var(--bb-panel);color:var(--bb-ink);box-shadow:none;}',
    '.bbr .bb-web-page-side{width:264px;flex:0 0 264px;display:flex;flex-direction:column;gap:10px;padding:14px 12px 12px;background:linear-gradient(180deg,var(--bb-a06),var(--bb-a12)),var(--bb-panel);border-right:1px solid var(--bb-a18);min-height:0;}',
    '.bbr .bb-web-page-brand{display:flex;align-items:center;gap:10px;min-height:38px;padding:0 4px 2px;}',
    '.bbr .bb-web-page-logo{width:34px;height:34px;flex:0 0 34px;}',
    '.bbr .bb-web-page-name{flex:1;min-width:0;font-size:17px;line-height:1.15;font-weight:820;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-close{display:none;}',
    '.bbr .bb-web-newchat{width:100%;height:42px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--bb-close-bg);color:var(--bb-close-ink);font-size:13.5px;font-weight:760;}',
    '.bbr .bb-web-page-sessions{flex:1;min-height:0;overflow-y:auto;margin:0 -4px;padding:4px 4px 0;border-top:1px solid var(--bb-a12);scrollbar-width:thin;scrollbar-color:var(--bb-a18) transparent;}',
    '.bbr .bb-web-page-sessions .bb-web-session .bb-web-icon{display:none;}',
    '.bbr .bb-web-page-sessions .bb-web-session{background:transparent;min-height:32px;font-size:13.5px;margin-bottom:2px;}',
    '.bbr .bb-web-page-sessions .bb-web-session:hover:not(:disabled){background:var(--bb-fill-strong);}',
    '.bbr .bb-web-page-sessions .bb-web-session.is-active{background:var(--bb-accent);border-color:transparent;color:var(--bb-on-accent);font-weight:700;}',
    '.bbr .bb-web-profile{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px;border:1px solid var(--bb-glass-line);border-radius:14px;background:var(--bb-fill-2);}',
    '.bbr .bb-web-profile .bb-web-uav{background:linear-gradient(135deg,var(--bb-accent-dark),var(--bb-accent-light));}',
    '.bbr .bb-web-profile-copy{min-width:0;flex:1;}',
    '.bbr .bb-web-profile-name{font-size:12.5px;font-weight:760;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-profile-email{color:var(--bb-secondary);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-backdrop{display:none;}',
    '.bbr .bb-web-page-stage{flex:1;min-width:0;min-height:0;display:flex;}',
    '.bbr .bb-web-page-card{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative;background:radial-gradient(circle at 86% 30%,var(--bb-body-glow),transparent 32%),linear-gradient(180deg,var(--bb-body-top),var(--bb-body-bottom));}',
    '.bbr .bb-web-page-top{flex:0 0 auto;position:relative;z-index:3;display:flex;align-items:center;gap:8px;min-height:60px;padding:10px 12px 10px 20px;border-bottom:1px solid var(--bb-glass-line);background:var(--bb-glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);}',
    '.bbr .bb-web-page-ws{flex:1;min-width:0;font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.bbr .bb-web-page-tools{display:flex;align-items:center;gap:5px;}',
    '.bbr .bb-web-page-menu{display:none;}',
    '.bbr .bb-web-page .bb-web-transcript{padding:12px 24px 16px;margin-right:0;}',
    '.bbr .bb-web-page-inner{width:min(100%,748px);margin:0 auto;flex:1 0 auto;display:flex;flex-direction:column;}',
    '.bbr .bb-web-page .bb-web-log{flex:1 0 auto;}',
    '.bbr .bb-web-page .bb-web-bubble{font-size:14px;padding:10px 14px;}',
    '.bbr .bb-web-page .bb-web-bottom{width:min(100%,796px);margin:0 auto;padding:0 24px 20px;}',
    '.bbr .bb-web-page .bb-web-toasts{left:24px;right:24px;}',
    '.bbr .bb-web-page .bb-web-composer{padding:12px;border-radius:18px;}',
    '.bbr .bb-web-page .bb-web-composer textarea{font-size:14px;min-height:40px;}',
    '.bbr .bb-web-hero{margin:auto 0 0;padding:28px 0 18px;text-align:center;display:flex;flex-direction:column;align-items:center;animation:bb-web-fade 240ms ease-out;}',
    '.bbr .bb-web-hero .bb-web-welcome-logo{width:84px;height:84px;}',
    '.bbr .bb-web-hello{margin-top:14px;font-size:clamp(22px,3.6vw,32px);line-height:1.1;font-weight:780;color:var(--bb-accent-text);}',
    '.bbr .bb-web-heading{margin-top:6px;font-size:clamp(20px,3.2vw,28px);line-height:1.15;font-weight:760;color:var(--bb-ink);}',
    '.bbr .bb-web-prompts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:8px 0 auto;}',
    '.bbr .bb-web-prompt{display:flex;flex-direction:column;align-items:flex-start;gap:12px;min-height:0;padding:16px;border-radius:18px;border:1px solid var(--bb-a12);background:var(--bb-bubble);color:var(--bb-ink);text-align:left;}',
    '.bbr .bb-web-prompt:hover:not(:disabled){border-color:var(--bb-a30);background:var(--bb-solid);}',
    '.bbr .bb-web-prompt-ic{width:30px;height:30px;border-radius:999px;display:grid;place-items:center;background:var(--bb-accent-tint);color:var(--bb-accent-text);}',
    '.bbr .bb-web-prompt strong{display:block;font-size:13.5px;font-weight:760;line-height:1.3;}',
    '.bbr .bb-web-prompt small{display:block;margin-top:2px;color:var(--bb-secondary);font-size:12px;line-height:1.35;}',
    '.bbr .bb-web-page.is-empty .bb-web-log{flex:0 0 auto;}',

    /* page compact (container narrower than 760px, set via ResizeObserver) */
    '.bbr.bb-web-compact .bb-web-page-side{position:absolute;top:0;bottom:0;left:0;z-index:5;width:min(288px,86%);transform:translateX(-102%);transition:transform 260ms var(--bb-spring);box-shadow:none;}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-side{transform:none;}',
    '.bbr.bb-web-compact .bb-web-page.is-drawer .bb-web-page-backdrop{display:block;position:absolute;inset:0;z-index:4;background:rgba(20,10,30,.25);animation:bb-web-fade 200ms ease;}',
    '.bbr.bb-web-compact .bb-web-page-menu,.bbr.bb-web-compact .bb-web-page-close{display:grid;}',
    '.bbr.bb-web-compact .bb-web-page-top{padding-left:10px;}',
    '.bbr.bb-web-compact .bb-web-page .bb-web-transcript{padding:10px 12px 12px;}',
    '.bbr.bb-web-compact .bb-web-page .bb-web-bottom{padding:0 12px 12px;}',
    '.bbr.bb-web-compact .bb-web-page .bb-web-toasts{left:12px;right:12px;}',
    '.bbr.bb-web-compact .bb-web-prompts{grid-template-columns:1fr;gap:8px;}',
    '.bbr.bb-web-compact .bb-web-prompt{flex-direction:row;align-items:center;gap:12px;padding:12px 14px;}',
    '.bbr.bb-web-compact .bb-web-hero .bb-web-welcome-logo{width:64px;height:64px;}',

    /* --- mobile: floating window becomes a full-screen sheet --- */
    '@media (max-width:575.98px){',
    '.bbr .bb-web-float{right:max(12px,min(var(--bb-ox),16px));bottom:calc(max(12px,min(var(--bb-oy),16px)) + env(safe-area-inset-bottom,0px));}',
    '.bbr.bb-web-left .bb-web-float{left:max(12px,min(var(--bb-ox),16px));right:auto;}',
    '.bbr .bb-web-window{position:fixed;left:0;right:0;bottom:0;top:calc(env(safe-area-inset-top,0px) + 12px);width:100%;max-width:none;animation:bb-web-sheet 220ms ease-out;}',
    '.bbr .bb-web-window.is-leaving{animation:bb-web-fade 180ms ease reverse forwards;}',
    '.bbr .bb-web-window .bb-web-panel{height:100%;border-radius:20px 20px 0 0;border-bottom:0;}',
    '.bbr .bb-web-float.is-open .bb-web-launcher{display:none;}',
    '.bbr .bb-web-dock{width:100%;padding:0;border-left:0;}',
    '.bbr .bb-web-dock .bb-web-panel{border-radius:0;border:0;}',
    '.bbr .bb-web-window .bb-web-bottom,.bbr .bb-web-dock .bb-web-bottom{padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));}',
    '.bbr .bb-web-header{min-height:60px;padding:10px max(10px,env(safe-area-inset-right,0px)) 10px max(10px,env(safe-area-inset-left,0px));gap:8px;}',
    '.bbr .bb-web-header-actions{gap:4px;}',
    '.bbr .bb-web-hlogo{width:34px;height:34px;}',
    '.bbr .bb-web-hbtn{width:36px;height:36px;}',
    '.bbr .bb-web-hbtn.bb-web-close{width:38px;height:38px;}',
    '.bbr .bb-web-hpill .bb-web-btn-label{display:none;}',
    '.bbr .bb-web-hpill{width:38px;padding:0;}',
    '.bbr .bb-web-tool{width:38px;height:38px;flex-basis:38px;}',
    '.bbr .bb-web-send{width:40px;height:40px;flex-basis:40px;}',
    '.bbr .bb-web-composer textarea{font-size:16px;}',
    '.bbr .bb-web-act{width:32px;height:32px;}',
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
    '@keyframes bb-web-toast-in{from{opacity:0;}to{opacity:1;}}',
    '@keyframes bb-web-toast-out{from{opacity:1;}to{opacity:0;}}',
    '.bbr .bb-web-caret,.bbr .bb-web-dots i,.bbr .bb-web-skel i{animation:none!important;}',
    '.bbr .bb-web-dots i{opacity:.6;}',
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
    width: 360,
    height: 560,
    defaultOpen: false,
    launcher: { type: 'button', text: 'Chat', gifUrl: null },
    theme: { mode: 'light', primary: null, panel: null, ink: null, radius: null, fontFamily: null },
    branding: { botName: 'Brainbox AI', title: null, subtitle: 'Typically replies in seconds', logoUrl: null, botAvatarUrl: null },
    welcomeMessages: ["I'm {{botName}}. Ask me anything and I'll answer in seconds."],
    quickActions: [],
    placeholder: 'Type message...',
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
        '--bb-w': px(cfg.width, '360px'),
        '--bb-h': px(cfg.height, '560px'),
        '--bb-ox': cfg.offset.x + 'px',
        '--bb-oy': cfg.offset.y + 'px',
        '--bb-sb-w': px(cfg.sidebarWidth, '380px'),
        '--bb-sb-top': px(cfg.sidebarTop, '0px')
      };
      if (t.radius != null && t.radius !== '') vars['--bb-radius'] = px(t.radius, '22px');
      if (t.fontFamily) vars['--bb-font'] = t.fontFamily;
      // Clear previously applied theme overrides (setTheme / dark switch), then re-apply.
      (this._themeKeys || []).forEach(function (k) { root.style.removeProperty(k); });
      if (t.primary) Object.assign(vars, accentVars(String(t.primary), dark));
      // panel / ink are light-mode surface overrides; dark mode keeps the aubergine palette.
      if (!dark && t.panel) vars['--bb-panel'] = t.panel;
      if (!dark && t.ink) vars['--bb-ink'] = t.ink;
      this._themeKeys = Object.keys(vars);
      Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    }

    _onSchemeChange() {
      if (this._cfg.theme.mode === 'auto') this._applyTheme();
    }

    /* ---------------- internals: DOM builders ---------------- */

    /** Brand mark: customer logoUrl/botAvatarUrl image, or the purple "omago" orb (CSS, follows the theme color). */
    _mark(cls, url) {
      var el = h('span', { class: cls + ' bb-web-orb' + (url ? ' has-image' : ''), 'aria-hidden': 'true' });
      if (url) {
        var img = h('img', { src: url, alt: '' });
        img.addEventListener('error', function () { el.classList.remove('has-image'); img.remove(); });
        el.appendChild(img);
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
      var btn = h('button', { type: 'button', class: 'bb-web-hbtn' + (extraClass ? ' ' + extraClass : ''), title: label, 'aria-label': label }, icon(iconName, 17, 1.9));
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
        btn.appendChild(icon(on ? 'volume' : 'volumeOff', 17, 1.9));
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
        btn.appendChild(icon('x', 26, 1.8));
      } else if (type === 'gif' && cfg.launcher.gifUrl) {
        btn.appendChild(h('img', { src: cfg.launcher.gifUrl, alt: '' }));
      } else if (type === 'button') {
        btn.appendChild(icon('chat', 22, 1.9));
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
        this._mark('bb-web-hlogo', b.logoUrl),
        h('div', { class: 'bb-web-header-copy' }, [
          h('h2', { class: 'bb-web-title', text: title }),
          b.subtitle ? h('div', { class: 'bb-web-subtitle', text: b.subtitle }) : null
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

      var ta = h('textarea', { rows: '1', placeholder: cfg.placeholder || 'Type message...', 'aria-label': 'Message', enterkeyhint: 'send' });
      ta.addEventListener('input', function () { self._autoGrow(); });
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
        append(bar, [attach, fileInput]);
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
      if (this._mode !== 'page' && cfg.features.history) {
        var pill = h('button', { type: 'button', class: 'bb-web-hpill', 'aria-pressed': 'false' });
        pill.addEventListener('click', function () { self._toggleHistory(); });
        els.historyPill = pill;
        bar.appendChild(pill);
      }
      var send = h('button', { type: 'submit', class: 'bb-web-send' });
      send.addEventListener('click', function (e) {
        if (self._st.sending) { e.preventDefault(); self.stop(); }
      });
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
      var now = Date.now();
      // omago intro: bot orb + "name · time" line + intro bubbles + quick-action pills
      var copy = h('div', { class: 'bb-web-intro-copy' }, [
        h('div', { class: 'bb-web-author', role: 'heading', 'aria-level': '2' }, [h('span', { text: this._botName() }), h('time', { datetime: new Date(now).toISOString(), text: formatClock(now, cfg.locale) })])
      ]);
      cfg.welcomeMessages.forEach(function (line) {
        var text = self._interpolate(line);
        if (text) copy.appendChild(h('p', { class: 'bb-web-intro-bubble', text: text }));
      });
      var items = this._quickActionItems();
      if (items.length) {
        var chips = h('div', { class: 'bb-web-chips' });
        items.forEach(function (item) {
          var chip = h('button', { type: 'button', class: 'bb-web-chip', text: item.title });
          chip.addEventListener('click', function () { self.send(item.prompt); });
          chips.appendChild(chip);
        });
        copy.appendChild(chips);
      }
      return h('div', { class: 'bb-web-welcome bb-web-intro' }, [this._mark('bb-web-av', this._botAvatarUrl()), copy]);
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
      var meta = h('div', { class: 'bb-web-msg-meta' }, [
        h('span', { text: isUser ? ((this._cfg.user && this._cfg.user.name) || 'You') : this._botName() }),
        h('time', { datetime: new Date(m.time).toISOString(), text: clock })
      ]);
      var col = h('div', { class: 'bb-web-col' }, [meta, bubble, foot]);
      if (!isUser && m.sources && !m.streaming) {
        m._srcPanel = null;
      }
      var row = h('div', { class: 'bb-web-row ' + (isUser ? 'is-user' : 'is-bot') + (m.failed ? ' is-failed' : '') + (m.streaming ? ' is-streaming' : '') + (m.live && !m._shown ? ' is-new' : '') });
      m._shown = true;
      var av = isUser ? this._userAvatar() : this._mark('bb-web-av', this._botAvatarUrl());
      if (isUser) av.classList.add('bb-web-av');
      row.appendChild(av);
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
      var hint = h('span', { class: 'bb-web-typing-hint', text: 'Thinking…' });
      var started = this._st.sendingSince;
      if (this._typingTimer) clearInterval(this._typingTimer);
      this._typingTimer = setInterval(function () {
        var s = (Date.now() - started) / 1000;
        hint.textContent = s > 45 ? 'Still working on it, this can take a minute…' : (s > 12 ? 'Searching the knowledge base…' : 'Thinking…');
      }, 1000);
      return h('div', { class: 'bb-web-row is-bot is-first is-last is-new bb-web-typing-row', role: 'status', 'aria-label': 'Assistant is typing' }, [
        this._mark('bb-web-av', this._botAvatarUrl()),
        h('div', { class: 'bb-web-col' }, [h('div', { class: 'bb-web-typing' }, [h('span', { class: 'bb-web-dots', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]), hint])])
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
      if (els.historyPill && els.historyPill._bbState !== inHistory) {
        els.historyPill._bbState = inHistory;
        clear(els.historyPill);
        els.historyPill.classList.toggle('is-active', inHistory);
        append(els.historyPill, [icon(inHistory ? 'back' : 'search', 17, 2.1), h('span', { class: 'bb-web-btn-label', text: inHistory ? 'Back to chat' : 'History' })]);
        els.historyPill.setAttribute('aria-label', inHistory ? 'Back to chat' : 'Chat history');
        els.historyPill.setAttribute('aria-pressed', inHistory ? 'true' : 'false');
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
          clear(btn).appendChild(mode === 'stop' ? icon('stop', 18, 2) : icon('send', 18, 2.1));
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
