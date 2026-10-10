'use client';
/**
 * Shared building blocks for ChatWidget and ChatPanel (design system v2).
 * Internal module — not part of the public API.
 */
import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { BRAND_GRADIENT, DARK, EASE_SPRING, EASE_STANDARD, FONT_STACK, LIGHT, MONO_STACK, SHADOW_LAUNCHER, SHADOW_POPOVER, SHADOW_WINDOW, tokensToCss } from './design/tokens';
import { BrainboxLogo } from './design/Logo';
import { playSound } from './design/sounds';
import type { BrainboxSound } from './design/sounds';
import { MessageContent } from './MessageContent';
import { TypingIndicator } from './co/TypingIndicator';
import type { BrainboxColorMode, ChatMessage, ChatQuickAction, ChatSession, ChatSource } from './types';

/* ------------------------------------------------------------------ */
/* Style injection (once per id, SSR-safe)                             */
/* ------------------------------------------------------------------ */

const useIsoInsertionEffect: typeof useInsertionEffect =
  typeof window === 'undefined' ? (() => undefined) as any : typeof useInsertionEffect === 'function' ? useInsertionEffect : useLayoutEffect;

export function injectStyle(id: string, css: string): void {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

export function useInjectedStyle(id: string, css: string): void {
  useIsoInsertionEffect(() => {
    injectStyle(id, css);
  }, [id]);
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

/** Resolve 'auto' against prefers-color-scheme (and follow changes). */
export function useResolvedMode(mode: BrainboxColorMode = 'light'): 'light' | 'dark' {
  const query = '(prefers-color-scheme: dark)';
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [systemDark, setSystemDark] = useState<boolean>(get);
  useEffect(() => {
    if (mode !== 'auto' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setSystemDark(mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
    else (mql as any).addListener?.(onChange);
    return () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange);
      else (mql as any).removeListener?.(onChange);
    };
  }, [mode]);
  if (mode === 'dark') return 'dark';
  if (mode === 'auto') return systemDark ? 'dark' : 'light';
  return 'light';
}

/** CSS custom properties for customer colors. */
export function brandStyle(opts: { primaryColor?: string; accentColor?: string; backgroundColor?: string }): CSSProperties {
  const style: Record<string, string> = {};
  if (opts.primaryColor) {
    style['--bb-accent'] = opts.primaryColor;
    style['--bb-brand'] = `linear-gradient(135deg, ${opts.primaryColor} 0%, ${opts.accentColor || opts.primaryColor} 100%)`;
  } else if (opts.accentColor) {
    style['--bb-brand'] = `linear-gradient(135deg, #2F7CF6 0%, ${opts.accentColor} 100%)`;
  }
  if (opts.backgroundColor) style['--bb-surface'] = opts.backgroundColor;
  return style as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Sounds preference                                                   */
/* ------------------------------------------------------------------ */

const SOUND_KEY = 'bb-chat-sounds';

export function useSoundPreference(enabledByProp: boolean) {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === 'off';
    } catch {
      return false;
    }
  });
  const on = enabledByProp && !muted;
  const toggle = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? 'off' : 'on');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const onRef = useRef(on);
  onRef.current = on;
  const play = useCallback((name: BrainboxSound) => playSound(name, onRef.current), []);
  return { soundOn: on, toggleSound: toggle, play };
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

export type ChatIconName =
  | 'chat' | 'x' | 'compose' | 'history' | 'search' | 'volume' | 'volumeOff' | 'expand' | 'shrink' | 'arrowUp'
  | 'stop' | 'copy' | 'check' | 'thumbUp' | 'thumbDown' | 'paperclip' | 'image' | 'smile' | 'mic' | 'chevronDown'
  | 'chevronRight' | 'chevronLeft' | 'sidebar' | 'sun' | 'moon' | 'download' | 'alert' | 'info' | 'checkCircle'
  | 'warning' | 'refresh' | 'doc' | 'sparkles' | 'bulb' | 'book' | 'wrench' | 'help' | 'arrowDown';

const ICONS: Record<ChatIconName, ReactNode> = {
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  compose: (
    <>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7.5" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </>
  ),
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  shrink: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  thumbUp: (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  ),
  thumbDown: (
    <>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </>
  ),
  paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  mic: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  sidebar: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  warning: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
    </>
  ),
  doc: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
    </>
  ),
  bulb: <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" />,
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />
};

export function ChatIcon({ name, size = 18, strokeWidth = 1.75, className }: { name: ChatIconName | string; size?: number; strokeWidth?: number; className?: string }) {
  const body = ICONS[name as ChatIconName] || ICONS.sparkles;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {body}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

const lightVars = tokensToCss({ ...LIGHT, onAccent: '#FFFFFF', brand: BRAND_GRADIENT });
const darkVars = tokensToCss({ ...DARK, onAccent: '#FFFFFF' });

export const CHAT_STYLE_ID = 'bb-chat-styles-v2';

export const CHAT_CSS = `
.bb-c {
  ${lightVars}
  --bb-font: ${FONT_STACK};
  --bb-mono: ${MONO_STACK};
  --bb-ease: ${EASE_SPRING};
  --bb-ease-std: ${EASE_STANDARD};
  --bb-ring: 0 0 0 3px rgba(0,113,227,0.25);
  --bb-shadow-pop: ${SHADOW_POPOVER};
  font-family: var(--bb-font);
  font-size: 15px;
  line-height: 1.45;
  color: var(--bb-label);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  letter-spacing: 0;
  box-sizing: border-box;
}
.bb-c[data-theme="dark"] {
  ${darkVars}
  --bb-ring: 0 0 0 3px rgba(10,132,255,0.35);
  --bb-shadow-pop: 0 8px 28px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.08);
  color-scheme: dark;
}
@supports (color: color-mix(in srgb, red 50%, blue)) {
  .bb-c {
    --bb-accent-hover: color-mix(in srgb, var(--bb-accent) 90%, #fff);
    --bb-accent-pressed: color-mix(in srgb, var(--bb-accent) 90%, #000);
    --bb-accent-tint: color-mix(in srgb, var(--bb-accent) 12%, transparent);
    --bb-ring: 0 0 0 3px color-mix(in srgb, var(--bb-accent) 28%, transparent);
  }
}
.bb-c *, .bb-c *::before, .bb-c *::after { box-sizing: border-box; }
:where(.bb-c) button { font-family: inherit; line-height: inherit; color: inherit; }
.bb-c :focus { outline: none; }
.bb-c :focus-visible { outline: none; box-shadow: var(--bb-ring); }
.bb-c-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

/* Host-page hardening: keep embedded content immune to generic p/h/li rules on the site. */
.bb-c .bb-md p, .bb-c .bb-md li, .bb-c .bb-md td, .bb-c .bb-md th, .bb-c .bb-c-bubble p { font-size: inherit; line-height: inherit; color: inherit; letter-spacing: inherit; }
.bb-c .bb-md blockquote, .bb-c .bb-md blockquote p { font-size: inherit; color: var(--bb-secondary); }
.bb-c .bb-md h3, .bb-c .bb-md h4, .bb-c .bb-md h5, .bb-c .bb-md h6 { font-size: 15px; font-weight: 600; color: inherit; letter-spacing: 0; }

/* ---------- Icon buttons ---------- */
.bb-c-iconbtn {
  appearance: none; border: 0; background: transparent; color: var(--bb-secondary);
  width: 32px; height: 32px; border-radius: 999px; display: inline-grid; place-items: center; flex: none;
  cursor: pointer; transition: background-color 120ms var(--bb-ease-std), color 120ms var(--bb-ease-std), transform 80ms var(--bb-ease-std);
}
.bb-c-iconbtn:hover { background: var(--bb-fill); color: var(--bb-label); }
.bb-c-iconbtn:active { transform: scale(.94); }
.bb-c-iconbtn[aria-pressed="true"] { color: var(--bb-accent); }
.bb-c-iconbtn:disabled { opacity: .4; cursor: default; }
.bb-c-iconbtn.is-sm { width: 28px; height: 28px; }

.bb-c-btn {
  appearance: none; border: 0; border-radius: 8px; height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
  transition: background-color 120ms var(--bb-ease-std), transform 80ms var(--bb-ease-std);
}
.bb-c-btn:active { transform: scale(.97); }
.bb-c-btn-primary { background: var(--bb-accent); color: var(--bb-on-accent) !important; }
.bb-c-btn-primary:hover { background: var(--bb-accent-hover); }
.bb-c-btn-secondary { background: var(--bb-fill); color: var(--bb-label); }
.bb-c-btn-secondary:hover { background: var(--bb-fill-strong); }
.bb-c-btn-tertiary { background: transparent; color: var(--bb-accent) !important; padding: 0 8px; }
.bb-c-btn-tertiary:hover { background: var(--bb-accent-tint); }

/* ---------- Header ---------- */
.bb-c-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; min-height: 56px; flex: none;
  background: var(--bb-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid var(--bb-separator); position: relative; z-index: 2;
}
.bb-c-header-copy { flex: 1; min-width: 0; }
.bb-c .bb-c-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0; }
.bb-c-subtitle { display: flex; align-items: center; gap: 6px; margin-top: 1px; font-size: 12px; color: var(--bb-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-c-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--bb-success); flex: none; }
.bb-c-header-actions { display: flex; align-items: center; gap: 2px; }

.bb-c-avatar { width: 32px; height: 32px; border-radius: 999px; flex: none; overflow: hidden; display: grid; place-items: center; background: var(--bb-fill); }
.bb-c-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bb-c-avatar.is-logo { background: transparent; border-radius: 9px; }
.bb-c-avatar.is-sm { width: 28px; height: 28px; }
.bb-c-avatar.is-sm.is-logo { border-radius: 8px; }
.bb-c-initials { font-size: 12px; font-weight: 600; color: var(--bb-secondary); }

/* ---------- Message list ---------- */
.bb-c-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; position: relative; }
.bb-c-log { display: flex; flex-direction: column; padding: 12px 14px 8px; }
.bb-c-day { align-self: center; margin: 14px 0 8px; font-size: 11px; font-weight: 500; color: var(--bb-tertiary); letter-spacing: .02em; }
.bb-c-group { display: flex; align-items: flex-end; gap: 8px; margin-top: 10px; animation: bb-c-msg-in 220ms var(--bb-ease) both; }
.bb-c-group.is-user { justify-content: flex-end; }
.bb-c-group-avatar { width: 28px; flex: none; align-self: flex-end; margin-bottom: 20px; }
.bb-c-stack { display: flex; flex-direction: column; gap: 2px; max-width: 78%; min-width: 0; }
.bb-c-group.is-user .bb-c-stack { align-items: flex-end; }
.bb-c-row { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; max-width: 100%; position: relative; }
.bb-c-group.is-user .bb-c-row { align-items: flex-end; }
.bb-c-bubble {
  font-size: 15px; font-weight: 400; line-height: 1.45; padding: 9px 13px; border-radius: 18px; max-width: 100%; min-width: 0;
  overflow-wrap: anywhere; word-break: break-word; background: var(--bb-bot-bubble); color: var(--bb-label);
}
.bb-c-group.is-bot .bb-c-row:not(:first-child) .bb-c-bubble { border-top-left-radius: 6px; }
.bb-c-group.is-bot .bb-c-row .bb-c-bubble { border-bottom-left-radius: 6px; }
.bb-c-group.is-bot .bb-c-row:first-child:not(:last-child) .bb-c-bubble { border-bottom-left-radius: 6px; }
.bb-c-group.is-user .bb-c-bubble { background: var(--bb-accent); color: var(--bb-on-accent); border-bottom-right-radius: 6px; white-space: pre-wrap; }
.bb-c-group.is-user .bb-c-row:not(:first-child) .bb-c-bubble { border-top-right-radius: 6px; }
.bb-c-bubble.is-error { box-shadow: inset 0 0 0 1px rgba(255,59,48,.35); }
.bb-c-bubble.is-pending { padding: 6px 12px; }
.bb-c-group.is-user .bb-c-bubble a { color: inherit; text-decoration: underline; }
.bb-c-bubble.is-streaming .bb-md > :last-child::after {
  content: "\\258D"; display: inline-block; margin-left: 2px; color: var(--bb-accent); font-weight: 400;
  animation: bb-c-caret 1s steps(2, start) infinite; vertical-align: baseline;
}
.bb-c-meta { display: flex; align-items: center; gap: 2px; min-height: 0; max-height: 0; opacity: 0; overflow: hidden; transition: opacity 120ms var(--bb-ease-std), max-height 120ms var(--bb-ease-std); }
.bb-c-row:hover .bb-c-meta, .bb-c-row:focus-within .bb-c-meta, .bb-c-row.is-last .bb-c-meta { max-height: 40px; opacity: 1; }
.bb-c-row.is-last .bb-c-meta { margin-top: 2px; }
.bb-c-time { font-size: 11px; color: var(--bb-tertiary); padding: 2px 4px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.bb-c-note { font-size: 11px; color: var(--bb-tertiary); padding: 2px 4px; }
.bb-c-note.is-error { color: var(--bb-danger-text); }
.bb-c-act { width: 26px; height: 26px; color: var(--bb-tertiary); }
.bb-c-act[aria-pressed="true"] { color: var(--bb-accent); }
@media (hover: none) { .bb-c-meta { max-height: 40px; opacity: 1; } }
.bb-c-sources { margin-top: 4px; font-size: 12px; color: var(--bb-secondary); max-width: 100%; }
.bb-c-sources summary { cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 6px; font-weight: 500; }
.bb-c-sources summary::-webkit-details-marker { display: none; }
.bb-c-sources summary:hover { background: var(--bb-fill); }
.bb-c-sources summary svg { transition: transform 180ms var(--bb-ease); }
.bb-c-sources[open] summary svg { transform: rotate(90deg); }
.bb-c-sources ol { margin: 4px 0 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 4px; }
.bb-c-sources li { line-height: 1.35; }
.bb-c-sources a { color: var(--bb-accent); text-decoration: none; }
.bb-c-sources a:hover { text-decoration: underline; }
.bb-c-src-snippet { display: block; color: var(--bb-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }

.bb-c-jump {
  position: sticky; bottom: 8px; margin: -40px auto 0; display: flex; width: 32px; height: 32px; border-radius: 999px; border: 0;
  background: var(--bb-surface); color: var(--bb-secondary); box-shadow: var(--bb-shadow-pop); place-items: center; justify-content: center; align-items: center; cursor: pointer; z-index: 3;
  animation: bb-c-fade-in 180ms var(--bb-ease) both;
}

/* ---------- Welcome ---------- */
.bb-c-welcome { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 20px 12px; animation: bb-c-msg-in 320ms var(--bb-ease) both; }
.bb-c-welcome-logo { margin-bottom: 14px; }
.bb-c-welcome-logo img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; display: block; }
.bb-c .bb-c-greeting { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }
.bb-c .bb-c-welcome-sub { margin: 6px 0 0; font-size: 14px; color: var(--bb-secondary); max-width: 300px; }
.bb-c-intro { align-self: stretch; display: flex; flex-direction: column; gap: 2px; margin-top: 18px; text-align: left; }
.bb-c-intro .bb-c-bubble { align-self: flex-start; max-width: 85%; }
.bb-c-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }
.bb-c-chip {
  appearance: none; border: 0; background: var(--bb-fill); color: var(--bb-label); border-radius: 999px; padding: 7px 12px;
  font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; max-width: 100%;
  transition: background-color 120ms var(--bb-ease-std), transform 80ms var(--bb-ease-std);
}
.bb-c-chip svg { color: var(--bb-accent); flex: none; }
.bb-c-chip:hover { background: var(--bb-fill-strong); }
.bb-c-chip:active { transform: scale(.97); }

/* ---------- Alerts & toasts ---------- */
.bb-c-alert { display: flex; align-items: center; gap: 8px; margin: 8px 14px 0; padding: 8px 8px 8px 12px; border-radius: 12px; background: var(--bb-danger-tint); color: var(--bb-danger-text); font-size: 13px; }
.bb-c[data-theme="dark"] .bb-c-alert { color: #FF6961; }
.bb-c-alert-msg { flex: 1; min-width: 0; }
.bb-c-alert .bb-c-btn { height: 28px; color: inherit; background: transparent; font-weight: 500; }
.bb-c-alert .bb-c-btn:hover { background: rgba(255,59,48,.12); }
.bb-c-toast-anchor { position: relative; height: 0; flex: none; z-index: 6; }
.bb-c-toasts { position: absolute; left: 12px; right: 12px; bottom: 8px; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.bb-c-toasts.is-top { top: 12px; bottom: auto; left: auto; right: 12px; width: min(360px, calc(100% - 24px)); }
.bb-c-toast {
  pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 10px 8px 10px 12px; border-radius: 12px;
  background: var(--bb-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  box-shadow: var(--bb-shadow-pop); animation: bb-c-toast-in 260ms var(--bb-ease) both;
}
.bb-c-toast.is-leaving { animation: bb-c-toast-out 200ms var(--bb-ease-std) both; }
.bb-c-toast-icon { width: 20px; height: 20px; border-radius: 999px; display: grid; place-items: center; color: #fff; flex: none; margin-top: 0; }
.bb-c-toast-icon.is-success { background: var(--bb-success); }
.bb-c-toast-icon.is-error { background: var(--bb-danger); }
.bb-c-toast-icon.is-warning { background: var(--bb-warning); }
.bb-c-toast-icon.is-info { background: var(--bb-accent); }
.bb-c-toast-copy { flex: 1; min-width: 0; padding-top: 1px; }
.bb-c-toast-title { font-size: 13px; font-weight: 600; line-height: 1.3; }
.bb-c-toast-body { font-size: 13px; color: var(--bb-secondary); line-height: 1.35; margin-top: 1px; overflow-wrap: anywhere; }
.bb-c-toast .bb-c-btn { height: 26px; padding: 0 8px; }
.bb-c-toast .bb-c-iconbtn { width: 24px; height: 24px; }

/* ---------- Composer ---------- */
.bb-c-composer { flex: none; padding: 8px 12px 12px; position: relative; }
.bb-c-capsule {
  display: flex; align-items: flex-end; gap: 2px; padding: 4px; border-radius: 20px; background: var(--bb-fill);
  transition: background-color 120ms var(--bb-ease-std), box-shadow 120ms var(--bb-ease-std);
}
.bb-c-capsule:focus-within { background: var(--bb-surface); box-shadow: var(--bb-ring), inset 0 0 0 1px var(--bb-separator); }
.bb-c-capsule textarea {
  flex: 1; min-width: 0; border: 0; outline: none; background: transparent; resize: none; color: var(--bb-label);
  font: inherit; font-size: 15px; line-height: 1.4; padding: 6px 6px; max-height: 140px; min-height: 32px; height: 32px; overflow-y: auto;
}
.bb-c-capsule textarea::placeholder { color: var(--bb-tertiary); }
.bb-c-capsule textarea:focus-visible { box-shadow: none; }
.bb-c-capsule .bb-c-iconbtn { color: var(--bb-tertiary); }
.bb-c-capsule .bb-c-iconbtn:hover { color: var(--bb-label); }
.bb-c-send {
  appearance: none; border: 0; width: 32px; height: 32px; border-radius: 999px; flex: none; display: grid; place-items: center; cursor: pointer;
  background: var(--bb-accent); color: var(--bb-on-accent); transition: background-color 120ms var(--bb-ease-std), transform 80ms var(--bb-ease-std), opacity 120ms;
}
.bb-c-send:hover:not(:disabled) { background: var(--bb-accent-hover); }
.bb-c-send:active:not(:disabled) { transform: scale(.94); }
.bb-c-send:disabled { background: var(--bb-fill-strong); color: var(--bb-quaternary); cursor: default; }
.bb-c-send.is-stop { background: var(--bb-label); color: var(--bb-surface); }
.bb-c-send.is-recording { background: var(--bb-danger); color: #fff; animation: bb-c-pulse 1.2s ease-in-out infinite; }
.bb-c-file { display: none; }
.bb-c-popover {
  position: absolute; bottom: calc(100% - 2px); left: 12px; z-index: 8; padding: 6px; border-radius: 12px; background: var(--bb-surface);
  box-shadow: var(--bb-shadow-pop); display: grid; grid-template-columns: repeat(6, 32px); gap: 2px; animation: bb-c-pop-in 180ms var(--bb-ease) both;
}
.bb-c-popover button { appearance: none; border: 0; background: transparent; width: 32px; height: 32px; border-radius: 8px; font-size: 18px; cursor: pointer; }
.bb-c-popover button:hover { background: var(--bb-fill); }
.bb-c-hint { font-size: 11px; color: var(--bb-tertiary); text-align: center; margin-top: 6px; }
.bb-c-recording { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--bb-danger-text); padding: 0 6px 6px; }
.bb-c-recording::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: var(--bb-danger); animation: bb-c-pulse 1.2s ease-in-out infinite; }

/* ---------- Segmented control ---------- */
.bb-c-seg { display: flex; gap: 2px; padding: 2px; margin: 0 12px; border-radius: 9px; background: var(--bb-fill); }
.bb-c-seg [role="tab"] {
  appearance: none; border: 0; background: transparent; flex: 1; height: 28px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--bb-secondary);
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: background-color 120ms var(--bb-ease-std);
}
.bb-c-seg [role="tab"][aria-selected="true"] { background: var(--bb-surface); color: var(--bb-label); box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.04); }
.bb-c-voice { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 4px; }
.bb-c-voice .bb-c-send { width: 52px; height: 52px; }
.bb-c-voice-label { font-size: 12px; color: var(--bb-secondary); }

/* ---------- Sessions list ---------- */
.bb-c-search { position: relative; display: flex; align-items: center; }
.bb-c-search svg { position: absolute; left: 9px; color: var(--bb-tertiary); pointer-events: none; }
.bb-c-search input {
  width: 100%; height: 32px; border: 0; border-radius: 8px; background: var(--bb-fill); color: var(--bb-label); font: inherit; font-size: 13px;
  padding: 0 10px 0 30px; transition: background-color 120ms, box-shadow 120ms;
}
.bb-c-search input::placeholder { color: var(--bb-tertiary); }
.bb-c-search input:focus { background: var(--bb-surface); box-shadow: var(--bb-ring); }
.bb-c-sessions { display: flex; flex-direction: column; gap: 1px; }
.bb-c-session-label { font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--bb-tertiary); padding: 14px 10px 6px; }
.bb-c-session {
  appearance: none; border: 0; background: transparent; text-align: left; width: 100%; border-radius: 8px; padding: 7px 10px; cursor: pointer;
  display: flex; flex-direction: column; gap: 1px; transition: background-color 120ms var(--bb-ease-std);
}
.bb-c-session:hover { background: var(--bb-fill); }
.bb-c-session.is-active { background: var(--bb-accent-tint); }
.bb-c-session-title { font-size: 13px; color: var(--bb-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-c-session.is-active .bb-c-session-title { font-weight: 500; color: var(--bb-accent); }
.bb-c-session-date { font-size: 11px; color: var(--bb-tertiary); font-variant-numeric: tabular-nums; }
.bb-c-skel { height: 34px; border-radius: 8px; margin: 4px 0; background: linear-gradient(90deg, var(--bb-fill) 0%, var(--bb-fill-strong) 50%, var(--bb-fill) 100%); background-size: 200% 100%; animation: bb-c-shimmer 1.4s linear infinite; }
.bb-c-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 16px; color: var(--bb-secondary); }
.bb-c-empty-icon { width: 72px; height: 72px; border-radius: 999px; display: grid; place-items: center; background: var(--bb-accent-tint); color: var(--bb-accent); margin-bottom: 14px; }
.bb-c .bb-c-empty h3 { margin: 0 0 4px; font-size: 17px; font-weight: 600; color: var(--bb-label); letter-spacing: -0.01em; }
.bb-c .bb-c-empty p { margin: 0; font-size: 14px; max-width: 280px; }

/* ---------- Animations ---------- */
@keyframes bb-c-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bb-c-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bb-c-pop-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes bb-c-toast-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes bb-c-toast-out { to { opacity: 0; transform: translateY(4px) scale(.98); } }
@keyframes bb-c-caret { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
@keyframes bb-c-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.94); opacity: .8; } }
@keyframes bb-c-shimmer { to { background-position: -200% 0; } }
@keyframes bb-c-window-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes bb-c-launcher-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes bb-c-badge-in { from { transform: scale(0); } to { transform: scale(1); } }

/* ================= Floating widget ================= */
.bb-w { position: fixed; z-index: 9999; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; pointer-events: none; }
.bb-w > * { pointer-events: auto; }
.bb-w.is-left { align-items: flex-start; }
.bb-w.is-center { align-items: center; }
.bb-w.is-top { flex-direction: column-reverse; }
.bb-w-window {
  width: var(--bb-w-width, 380px); max-width: calc(100vw - 32px); height: var(--bb-w-height, 600px); max-height: calc(100vh - 120px);
  display: flex; flex-direction: column; overflow: hidden; position: relative;
  background: var(--bb-surface); border-radius: var(--bb-w-radius, 18px); border: var(--bb-w-border, 0);
  box-shadow: ${SHADOW_WINDOW}; transform-origin: bottom right;
  animation: bb-c-window-in 320ms var(--bb-ease) both;
  transition: width 320ms var(--bb-ease), height 320ms var(--bb-ease);
}
.bb-c[data-theme="dark"] .bb-w-window, .bb-c[data-theme="dark"].bb-w-window { box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.1); }
.bb-w.is-left .bb-w-window { transform-origin: bottom left; }
.bb-w.is-top .bb-w-window { transform-origin: top right; }
.bb-w-window.is-expanded { width: min(720px, calc(100vw - 48px)); height: calc(100vh - 120px); }
.bb-w-launcher {
  appearance: none; border: 0; cursor: pointer; position: relative; flex: none; color: #fff;
  width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center;
  background: var(--bb-brand); box-shadow: ${SHADOW_LAUNCHER};
  animation: bb-c-launcher-in 320ms var(--bb-ease) both;
  transition: transform 120ms var(--bb-ease-std), box-shadow 120ms var(--bb-ease-std);
}
.bb-w-launcher:hover { transform: scale(1.04); }
.bb-w-launcher:active { transform: scale(.96); }
.bb-w-launcher.is-pill { width: auto; height: 48px; padding: 0 18px 0 14px; display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; }
.bb-w-launcher.is-gif { width: 64px; height: 64px; background: var(--bb-surface); overflow: visible; padding: 0; }
.bb-w-launcher.is-gif img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; display: block; }
.bb-w-launcher-icon { display: grid; place-items: center; transition: transform 320ms var(--bb-ease), opacity 200ms; }
.bb-w-badge {
  position: absolute; top: -3px; right: -3px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: #FF3B30; color: #fff; font-size: 12px; font-weight: 600; line-height: 20px; text-align: center;
  box-shadow: 0 0 0 2px #fff; font-variant-numeric: tabular-nums; animation: bb-c-badge-in 260ms var(--bb-ease) both;
}
.bb-w-window .bb-c-header { gap: 8px; padding: 10px 8px 10px 12px; }
.bb-w-window .bb-c-header-actions { gap: 0; }
.bb-w-window .bb-c-header .bb-c-iconbtn { width: 30px; height: 30px; }
.bb-w-body { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }
.bb-w-history { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.bb-w-scrim { display: none; }

@media (max-width: 575px) {
  .bb-w.is-open { inset: 0 !important; transform: none !important; gap: 0; }
  .bb-w.is-open .bb-w-launcher { display: none; }
  .bb-w-window, .bb-w-window.is-expanded {
    position: fixed; left: 0; right: 0; bottom: 0; top: max(env(safe-area-inset-top, 0px), 8px);
    width: 100%; max-width: none; height: auto; max-height: none; border-radius: 12px 12px 0 0; border: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .bb-w-scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.3); animation: bb-c-fade-in 200ms both; }
  .bb-c-composer { padding-bottom: max(12px, env(safe-area-inset-bottom, 0px)); }
  .bb-c-header .bb-c-iconbtn, .bb-c-send { min-width: 36px; min-height: 36px; }
  .bb-w-expand { display: none !important; }
}

/* ================= Full-page panel ================= */
.bb-p {
  display: grid; grid-template-columns: 272px minmax(0, 1fr); height: var(--bb-p-height, 100%); min-height: 420px; width: 100%;
  background: var(--bb-surface); overflow: hidden; position: relative; transition: grid-template-columns 320ms var(--bb-ease);
}
.bb-p.is-collapsed { grid-template-columns: 0 minmax(0, 1fr); }
.bb-p-side {
  display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--bb-surface2);
  border-right: 1px solid var(--bb-separator);
}
.bb-c[data-theme="dark"] .bb-p-side, .bb-c[data-theme="dark"].bb-p .bb-p-side { background: #161618; }
.bb-p.is-collapsed .bb-p-side { border-right: 0; visibility: hidden; }
.bb-p-side-inner { width: 272px; display: flex; flex-direction: column; height: 100%; }
.bb-p-brand { display: flex; align-items: center; gap: 10px; padding: 14px 10px 10px 16px; }
.bb-p-brand img { width: 28px; height: 28px; border-radius: 8px; object-fit: cover; }
.bb-p-brand-name { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-p-side-actions { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 4px; }
.bb-p-new { justify-content: flex-start; height: 36px; width: 100%; }
.bb-p-side-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 6px 12px; }
.bb-p-profile { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--bb-separator); }
.bb-p-profile-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-p-profile-email { font-size: 12px; color: var(--bb-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-p-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; background: var(--bb-surface); }
.bb-p-top { display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 12px; flex: none; background: var(--bb-material);
  -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--bb-separator); z-index: 2; }
.bb-p-top-title { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-p-top .bb-c-btn-secondary { height: 30px; }
.bb-p-column { width: 100%; max-width: 760px; margin: 0 auto; }
.bb-p .bb-c-log { padding: 16px 20px 12px; }
.bb-p .bb-c-composer { padding: 8px 20px 16px; }
.bb-p .bb-c-stack { max-width: 82%; }
.bb-p-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; animation: bb-c-msg-in 320ms var(--bb-ease) both; }
.bb-p-empty img.bb-p-empty-logo { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; }
.bb-c .bb-p-hello { margin: 18px 0 0; font-size: 28px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
.bb-c .bb-p-sub { margin: 6px 0 0; font-size: 17px; color: var(--bb-secondary); letter-spacing: -0.01em; }
.bb-p-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%; max-width: 640px; margin-top: 28px; }
.bb-p-card {
  appearance: none; text-align: left; border: 1px solid var(--bb-separator); background: var(--bb-surface); border-radius: 12px; padding: 14px 16px;
  display: flex; gap: 12px; align-items: flex-start; cursor: pointer; transition: background-color 120ms var(--bb-ease-std), transform 80ms var(--bb-ease-std);
}
.bb-p-card:hover { background: var(--bb-surface2); }
.bb-c[data-theme="dark"] .bb-p-card:hover { background: var(--bb-surface2); }
.bb-p-card:active { transform: scale(.98); }
.bb-p-card-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--bb-accent-tint); color: var(--bb-accent); flex: none; }
.bb-p-card-title { display: block; font-size: 14px; font-weight: 600; color: var(--bb-label); }
.bb-p-card-desc { display: block; font-size: 13px; color: var(--bb-secondary); margin-top: 2px; line-height: 1.35; }
.bb-p-scrim { display: none; }
.bb-p:not(.is-collapsed) .bb-p-toggle { display: none; }
@media (max-width: 860px) {
  .bb-p .bb-p-toggle, .bb-p:not(.is-collapsed) .bb-p-toggle { display: inline-grid; }
  .bb-p, .bb-p.is-collapsed { grid-template-columns: minmax(0, 1fr); }
  .bb-p-side { position: absolute; top: 0; bottom: 0; left: 0; width: 288px; max-width: 86%; z-index: 20; transform: translateX(-102%); visibility: hidden;
    transition: transform 320ms var(--bb-ease), visibility 320ms; box-shadow: none; }
  .bb-p.is-drawer .bb-p-side { transform: none; visibility: visible; box-shadow: 0 12px 40px rgba(0,0,0,.18); }
  .bb-p-side-inner { width: 100%; }
  .bb-p.is-drawer .bb-p-scrim { display: block; position: absolute; inset: 0; background: rgba(0,0,0,.3); z-index: 15; animation: bb-c-fade-in 200ms both; }
  .bb-p .bb-c-log { padding: 12px 14px 8px; }
  .bb-p .bb-c-composer { padding: 8px 12px 12px; }
  .bb-c .bb-p-hello { font-size: 24px; }
  .bb-c .bb-p-sub { font-size: 15px; }
  .bb-p-cards { grid-template-columns: minmax(0, 1fr); }
  .bb-p-top .bb-c-btn-label { display: none; }
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .bb-c *, .bb-c *::before, .bb-c *::after, .bb-c, .bb-w-window, .bb-w-launcher {
    animation-duration: 100ms !important; animation-iteration-count: 1 !important; transition-duration: 100ms !important; scroll-behavior: auto !important;
  }
  .bb-c-group, .bb-c-welcome, .bb-p-empty, .bb-c-toast, .bb-w-window, .bb-w-launcher, .bb-c-popover { animation-name: bb-c-fade-in !important; }
  .bb-c-toast.is-leaving { animation-name: none !important; opacity: 0; }
  .bb-c-bubble.is-streaming .bb-md > :last-child::after { animation: none !important; }
  .bb-w-launcher:hover, .bb-w-launcher:active, .bb-c-btn:active, .bb-c-iconbtn:active, .bb-c-send:active, .bb-c-chip:active, .bb-p-card:active { transform: none !important; }
  .bb-c-send.is-recording, .bb-c-recording::before, .bb-c-skel { animation: none !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayLabel(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  try {
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  } catch {
    return d.toDateString();
  }
}

export function sessionGroupLabel(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return 'Older';
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'Previous 7 days';
  if (diff < 30) return 'Previous 30 days';
  return 'Older';
}

export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  try {
    if (diff <= 0) return formatTime(iso);
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function initialsOf(name?: string): string {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

/** Shallow-deep merge for plain objects (arrays are replaced). */
export function mergeData<T extends Record<string, any>>(base: T, overrides?: Record<string, any> | null): T {
  if (!overrides) return base;
  const output: Record<string, any> = { ...base };
  Object.entries(overrides).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = mergeData((base as any)[key] || {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  });
  return output as T;
}

export function normalizeActions(list?: (string | ChatQuickAction)[]): ChatQuickAction[] {
  return (list || [])
    .map((a) => (typeof a === 'string' ? { label: a } : a))
    .filter((a): a is ChatQuickAction => !!a && !!a.label);
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  leaving?: boolean;
}

let toastSeq = 0;

export function useToasts(max = 3) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 200);
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const arm = useCallback(
    (id: number, tone: ToastTone) => {
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => remove(id), tone === 'error' ? 6000 : 4000);
    },
    [remove]
  );

  const push = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = ++toastSeq;
      setToasts((list) => [...list.filter((t) => !t.leaving), { ...toast, id }].slice(-max));
      arm(id, toast.tone);
      return id;
    },
    [arm, max]
  );

  const pause = useCallback((id: number) => {
    clearTimeout(timers.current[id]);
  }, []);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    []
  );

  return { toasts, push, dismiss: remove, pause, resume: arm };
}

export function ToastStack({
  toasts,
  dismiss,
  pause,
  resume,
  placement = 'bottom'
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
  pause: (id: number) => void;
  resume: (id: number, tone: ToastTone) => void;
  placement?: 'bottom' | 'top';
}) {
  const icon: Record<ToastTone, ChatIconName> = { success: 'check', error: 'x', warning: 'alert', info: 'info' };
  const polite = toasts.filter((t) => t.tone !== 'error');
  const assertive = toasts.filter((t) => t.tone === 'error');
  const render = (t: ToastItem) => (
    <div
      key={t.id}
      className={`bb-c-toast${t.leaving ? ' is-leaving' : ''}`}
      onMouseEnter={() => pause(t.id)}
      onMouseLeave={() => resume(t.id, t.tone)}
    >
      <span className={`bb-c-toast-icon is-${t.tone}`} aria-hidden="true">
        <ChatIcon name={icon[t.tone]} size={12} strokeWidth={2.6} />
      </span>
      <div className="bb-c-toast-copy">
        <div className="bb-c-toast-title">{t.title}</div>
        {t.body ? <div className="bb-c-toast-body">{t.body}</div> : null}
      </div>
      {t.action ? (
        <button
          type="button"
          className="bb-c-btn bb-c-btn-tertiary"
          onClick={() => {
            t.action?.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      ) : null}
      <button type="button" className="bb-c-iconbtn" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
        <ChatIcon name="x" size={14} />
      </button>
    </div>
  );
  return (
    <div className="bb-c-toast-anchor">
      <div className={`bb-c-toasts${placement === 'top' ? ' is-top' : ''}`}>
        <div role="status" aria-live="polite" style={{ display: 'contents' }}>
          {polite.map(render)}
        </div>
        <div role="alert" aria-live="assertive" style={{ display: 'contents' }}>
          {assertive.map(render)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function BotAvatar({ src, size = 32, name }: { src?: string; size?: number; name?: string }) {
  if (src) {
    return (
      <span className={`bb-c-avatar${size < 32 ? ' is-sm' : ''}`} style={{ width: size, height: size }}>
        <img src={src} alt={name ? `${name} avatar` : ''} />
      </span>
    );
  }
  return (
    <span className={`bb-c-avatar is-logo${size < 32 ? ' is-sm' : ''}`} style={{ width: size, height: size }}>
      <BrainboxLogo size={size} title={name || 'Brainbox'} />
    </span>
  );
}

export function PersonAvatar({ name, src, size = 28 }: { name?: string; src?: string; size?: number }) {
  return (
    <span className="bb-c-avatar" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" /> : <span className="bb-c-initials">{initialsOf(name) || '•'}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Message list                                                        */
/* ------------------------------------------------------------------ */

export type ListItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'group'; key: string; role: 'user' | 'bot'; messages: ChatMessage[] };

const GROUP_GAP_MS = 5 * 60 * 1000;

export function buildItems(messages: ChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDay = '';
  let current: Extract<ListItem, { kind: 'group' }> | null = null;
  let lastTime = 0;
  for (const m of messages) {
    if (m.role === 'system') continue;
    const t = new Date(m.timestamp).getTime() || Date.now();
    const day = dayLabel(m.timestamp);
    if (day !== lastDay) {
      items.push({ kind: 'day', key: `day-${m.id}`, label: day });
      lastDay = day;
      current = null;
    }
    const role = m.role === 'user' ? 'user' : 'bot';
    if (!current || current.role !== role || t - lastTime > GROUP_GAP_MS) {
      current = { kind: 'group', key: `g-${m.id}`, role, messages: [] };
      items.push(current);
    }
    current.messages.push(m);
    lastTime = t;
  }
  return items;
}

function sourceLabel(s: ChatSource, i: number): string {
  return String(s.title || s.source_name || s.name || s.filename || s.source || s.metadata?.title || s.metadata?.source || `Source ${i + 1}`);
}

function sourceUrl(s: ChatSource): string | null {
  const url = s.url || s.metadata?.url;
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

export function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <details className="bb-c-sources">
      <summary>
        <ChatIcon name="chevronRight" size={12} strokeWidth={2.2} />
        {sources.length === 1 ? '1 source' : `${sources.length} sources`}
      </summary>
      <ol>
        {sources.slice(0, 8).map((s, i) => {
          const url = sourceUrl(s);
          const label = sourceLabel(s, i);
          const snippet = String(s.text || s.content || s.snippet || '').slice(0, 160);
          return (
            <li key={i}>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ) : (
                <span>{label}</span>
              )}
              {snippet ? <span className="bb-c-src-snippet" title={snippet}>{snippet}</span> : null}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export interface MessageListProps {
  messages: ChatMessage[];
  botName?: string;
  botAvatar?: string;
  showFeedback?: boolean;
  canRate?: boolean;
  onCopy: (message: ChatMessage) => void;
  onFeedback: (message: ChatMessage, rating: 'up' | 'down') => void;
}

export function MessageList({ messages, botName, botAvatar, showFeedback = true, canRate = true, onCopy, onFeedback }: MessageListProps) {
  const items = useMemo(() => buildItems(messages), [messages]);
  return (
    <div className="bb-c-log" role="log" aria-live="off" aria-label="Conversation">
      {items.map((item) => {
        if (item.kind === 'day') {
          return (
            <div key={item.key} className="bb-c-day" role="separator">
              {item.label}
            </div>
          );
        }
        const isUser = item.role === 'user';
        return (
          <div key={item.key} className={`bb-c-group ${isUser ? 'is-user' : 'is-bot'}`}>
            {!isUser ? (
              <span className="bb-c-group-avatar" aria-hidden="true">
                <BotAvatar src={botAvatar} size={28} name={botName} />
              </span>
            ) : null}
            <div className="bb-c-stack">
              {item.messages.map((m, idx) => {
                const last = idx === item.messages.length - 1;
                const pending = m.status === 'pending';
                const streamingNow = m.status === 'streaming';
                const busy = pending || streamingNow;
                const time = formatTime(m.timestamp);
                return (
                  <div key={m.id} className={`bb-c-row${last ? ' is-last' : ''}`}>
                    <span className="bb-c-sr">{isUser ? 'You said:' : `${botName || 'Assistant'} said:`}</span>
                    <div
                      className={`bb-c-bubble${streamingNow ? ' is-streaming' : ''}${pending ? ' is-pending' : ''}${m.status === 'error' ? ' is-error' : ''}`}
                      aria-busy={busy || undefined}
                    >
                      {pending ? (
                        <TypingIndicator />
                      ) : isUser ? (
                        m.text
                      ) : (
                        <MessageContent text={m.text} />
                      )}
                    </div>
                    {!isUser && !busy && m.sources && m.sources.length ? <Sources sources={m.sources} /> : null}
                    {!busy ? (
                      <div className="bb-c-meta">
                        {!isUser && m.text ? (
                          <>
                            <button type="button" className="bb-c-iconbtn bb-c-act" onClick={() => onCopy(m)} aria-label="Copy answer" title="Copy">
                              <ChatIcon name="copy" size={14} />
                            </button>
                            {showFeedback && canRate && m.status !== 'error' ? (
                              <>
                                <button
                                  type="button"
                                  className="bb-c-iconbtn bb-c-act"
                                  onClick={() => onFeedback(m, 'up')}
                                  aria-label="Good answer"
                                  aria-pressed={m.feedback === 'up'}
                                  title="Good answer"
                                >
                                  <ChatIcon name="thumbUp" size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="bb-c-iconbtn bb-c-act"
                                  onClick={() => onFeedback(m, 'down')}
                                  aria-label="Bad answer"
                                  aria-pressed={m.feedback === 'down'}
                                  title="Bad answer"
                                >
                                  <ChatIcon name="thumbDown" size={14} />
                                </button>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {m.status === 'stopped' ? <span className="bb-c-note">Stopped</span> : null}
                        {m.status === 'error' ? <span className="bb-c-note is-error">Interrupted</span> : null}
                        {time ? (
                          <time className="bb-c-time" dateTime={m.timestamp}>
                            {time}
                          </time>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Keeps a scroll container pinned to the bottom while the user hasn't scrolled up. */
export function useAutoScroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinned.current = atBottom;
    setShowJump(!atBottom);
  }, []);
  const scrollToBottom = useCallback((smooth = true) => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setShowJump(false);
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollTop = el.scrollHeight;
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, onScroll, showJump, scrollToBottom };
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

const EMOJI_SET = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '😢', '🤔', '👏', '✅'];

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  busy: boolean;
  placeholder: string;
  showFileUpload?: boolean;
  showImageUpload?: boolean;
  showEmoji?: boolean;
  showVoice?: boolean;
  recording?: boolean;
  onVoice?: () => void;
  onFile?: (file: File) => void;
  onImage?: (file: File) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  onEscape?: () => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  busy,
  placeholder,
  showFileUpload,
  showImageUpload,
  showEmoji = true,
  showVoice,
  recording,
  onVoice,
  onFile,
  onImage,
  inputRef,
  onEscape
}: ComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef || localRef;
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Auto-grow.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '32px';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value, ref]);

  const canSend = value.trim().length > 0 && !busy;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    } else if (e.key === 'Escape') {
      if (emojiOpen) {
        e.stopPropagation();
        setEmojiOpen(false);
      } else {
        onEscape?.();
      }
    }
  };

  return (
    <div className="bb-c-composer">
      {emojiOpen ? (
        <div className="bb-c-popover" role="dialog" aria-label="Emoji">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Insert ${e}`}
              onClick={() => {
                onChange(value + e);
                setEmojiOpen(false);
                ref.current?.focus();
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
      {recording ? <div className="bb-c-recording" role="status">Recording… tap the mic to send</div> : null}
      <div className="bb-c-capsule">
        {showFileUpload ? (
          <>
            <button type="button" className="bb-c-iconbtn" onClick={() => fileRef.current?.click()} aria-label="Attach a file" title="Attach a file">
              <ChatIcon name="paperclip" size={18} />
            </button>
            <input
              ref={fileRef}
              className="bb-c-file"
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile?.(f);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        {showImageUpload ? (
          <>
            <button type="button" className="bb-c-iconbtn" onClick={() => imageRef.current?.click()} aria-label="Add an image" title="Add an image">
              <ChatIcon name="image" size={18} />
            </button>
            <input
              ref={imageRef}
              className="bb-c-file"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImage?.(f);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {showEmoji ? (
          <button
            type="button"
            className="bb-c-iconbtn"
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            title="Emoji"
          >
            <ChatIcon name="smile" size={18} />
          </button>
        ) : null}
        {showVoice && !value.trim() && !streaming ? (
          <button
            type="button"
            className={`bb-c-send${recording ? ' is-recording' : ''}`}
            onClick={onVoice}
            aria-label={recording ? 'Stop recording and send' : 'Record a voice note'}
            aria-pressed={!!recording}
          >
            <ChatIcon name="mic" size={16} strokeWidth={2} />
          </button>
        ) : streaming ? (
          <button type="button" className="bb-c-send is-stop" onClick={onStop} aria-label="Stop generating" title="Stop">
            <ChatIcon name="stop" size={16} />
          </button>
        ) : (
          <button type="button" className="bb-c-send" onClick={onSend} disabled={!canSend} aria-label="Send message" title="Send">
            <ChatIcon name="arrowUp" size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sessions list                                                       */
/* ------------------------------------------------------------------ */

export function SessionList({
  sessions,
  activeId,
  loading,
  query,
  onSelect
}: {
  sessions: ChatSession[];
  activeId: string | null;
  loading: boolean;
  query: string;
  onSelect: (id: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? sessions.filter((s) => (s.title || '').toLowerCase().includes(q)) : sessions;
    return [...list].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
  }, [sessions, query]);

  if (loading && !sessions.length) {
    return (
      <div aria-busy="true" aria-label="Loading conversations">
        <div className="bb-c-skel" />
        <div className="bb-c-skel" />
        <div className="bb-c-skel" />
      </div>
    );
  }
  if (!filtered.length) {
    return (
      <div className="bb-c-empty">
        <div className="bb-c-empty-icon">
          <ChatIcon name={query ? 'search' : 'history'} size={32} strokeWidth={1.5} />
        </div>
        <h3>{query ? 'No matches' : 'No conversations yet'}</h3>
        <p>{query ? 'Try a different search.' : 'Your conversations will appear here.'}</p>
      </div>
    );
  }
  const groups: { label: string; items: ChatSession[] }[] = [];
  filtered.forEach((s) => {
    const label = sessionGroupLabel(s.updated_at || s.created_at);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(s);
    else groups.push({ label, items: [s] });
  });
  return (
    <nav className="bb-c-sessions" aria-label="Conversations">
      {groups.map((g) => (
        <div key={g.label} role="group" aria-label={g.label}>
          <div className="bb-c-session-label">{g.label}</div>
          {g.items.map((s) => (
            <button
              key={s.session_id}
              type="button"
              className={`bb-c-session${s.session_id === activeId ? ' is-active' : ''}`}
              aria-current={s.session_id === activeId ? 'true' : undefined}
              onClick={() => onSelect(s.session_id)}
            >
              <span className="bb-c-session-title">{s.title || 'Untitled conversation'}</span>
              <span className="bb-c-session-date">{shortDate(s.updated_at || s.created_at)}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Voice recording                                                     */
/* ------------------------------------------------------------------ */

export function useVoiceRecorder(onRecorded: (blob: Blob) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const toggle = useCallback(async () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        const hint = typeof window !== 'undefined' && !window.isSecureContext ? ' Recording needs HTTPS or localhost.' : '';
        throw new Error(`Voice recording isn’t available in this browser.${hint}`);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.onstart = () => setRecording(true);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        setRecording(false);
        recorderRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(new Blob(chunks, { type: 'audio/webm' }));
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch (err: any) {
      setRecording(false);
      onError(err?.message || 'Microphone access was denied.');
    }
  }, [onError, onRecorded, recording]);
  return { recording, toggle };
}

/** Copy helper that never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
