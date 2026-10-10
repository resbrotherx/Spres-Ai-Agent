'use client';
/**
 * Floating chat widget — "omago" design (frosted glass, blue accent, no shadows).
 *
 * Shares the chat logic and a few building blocks with ChatPanel (chatUi.tsx), but every visual rule of the
 * widget lives in OMAGO_CSS below and is scoped to `.bb-o`, so ChatPanel's look is unaffected.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useBrainboxChat } from './useBrainboxChat';
import { MessageContent } from './MessageContent';
import { TypingIndicator } from './co/TypingIndicator';
import {
  CHAT_CSS,
  CHAT_STYLE_ID,
  ChatIcon,
  SessionList,
  Sources,
  ToastStack,
  buildItems,
  copyText,
  formatTime,
  initialsOf,
  interpolate,
  mergeData,
  normalizeActions,
  useAutoScroll,
  useInjectedStyle,
  useResolvedMode,
  useSoundPreference,
  useToasts,
  useVoiceRecorder
} from './chatUi';
import type { ChatMessage, ChatQuickAction, ChatUiData, ChatWidgetProps } from './types';

/** Default copy. Override any field with `data` / `manualData`. No demo content. */
export const defaultChatWidgetData: ChatUiData = {
  brand: { name: '', subtitle: '', logoUrl: '' },
  bot: { name: 'Assistant', avatarUrl: '' },
  user: { name: '' },
  greeting: '',
  introMessages: [],
  quickActions: ['What can you help me with?', 'How do I get started?', 'I have a problem'],
  composer: { placeholder: 'Type message…', searchLabel: 'History' }
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const OMAGO_STYLE_ID = 'bb-omago-styles-v3';

const OMAGO_CSS = `
.bb-c.bb-o {
  --bb-o-primary: #2563eb;
  --bb-o-ink: #08080a;
  --bb-o-panel: #f3f6fd;
  --bb-o-radius: 22px;
  --bb-o-border: 2px solid rgba(255,255,255,.82);
  --bb-o-header: rgba(255,255,255,.36);
  --bb-o-header-line: rgba(255,255,255,.88);
  --bb-o-body: radial-gradient(circle at 86% 42%, rgba(255,255,255,.7), transparent 30%), linear-gradient(180deg, rgba(251,252,255,.7), rgba(224,233,253,.72));
  --bb-o-text: rgba(12,12,16,.74);
  --bb-o-muted: rgba(12,12,16,.5);
  --bb-o-faint: rgba(12,12,16,.42);
  --bb-o-glass: rgba(255,255,255,.25);
  --bb-o-glass-hover: rgba(255,255,255,.45);
  --bb-o-glass-line: rgba(255,255,255,.86);
  --bb-o-bot: rgba(255,255,255,.94);
  --bb-o-pill-line: rgba(37,99,235,.18);
  --bb-o-pill-text: var(--bb-o-primary);
  --bb-o-close-bg: #050506;
  --bb-o-close-fg: #fff;
  --bb-o-pop: #fff;
  --bb-o-pop-line: rgba(37,99,235,.18);
  --bb-o-scroll: rgba(37,99,235,.18);
  /* Shared tokens used by toasts, sources, history list and markdown. */
  --bb-accent: var(--bb-o-primary);
  --bb-label: var(--bb-o-ink);
  --bb-secondary: rgba(12,12,16,.62);
  --bb-tertiary: rgba(12,12,16,.46);
  --bb-quaternary: rgba(12,12,16,.3);
  --bb-surface: #ffffff;
  --bb-surface2: #f8faff;
  --bb-fill: rgba(37,99,235,.08);
  --bb-fill-strong: rgba(37,99,235,.14);
  --bb-separator: rgba(37,99,235,.16);
  --bb-separator-strong: rgba(37,99,235,.26);
  --bb-material: rgba(255,255,255,.94);
  --bb-accent-tint: rgba(37,99,235,.12);
  --bb-ring: none;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  color: var(--bb-o-ink);
}
.bb-c.bb-o[data-theme="dark"] {
  --bb-o-ink: #eef3fc;
  --bb-o-panel: #0e1526;
  --bb-o-border: 2px solid rgba(143,179,255,.2);
  --bb-o-header: rgba(255,255,255,.04);
  --bb-o-header-line: rgba(143,179,255,.16);
  --bb-o-body: radial-gradient(circle at 86% 42%, rgba(37,99,235,.12), transparent 34%), linear-gradient(180deg, rgba(20,30,52,.9), rgba(13,20,38,.96));
  --bb-o-text: rgba(238,243,252,.84);
  --bb-o-muted: rgba(238,243,252,.6);
  --bb-o-faint: rgba(238,243,252,.46);
  --bb-o-glass: rgba(255,255,255,.06);
  --bb-o-glass-hover: rgba(255,255,255,.12);
  --bb-o-glass-line: rgba(143,179,255,.2);
  --bb-o-bot: rgba(255,255,255,.08);
  --bb-o-pill-line: rgba(143,179,255,.3);
  --bb-o-pill-text: #a9c4ff;
  --bb-o-close-bg: #e6eeff;
  --bb-o-close-fg: #0e1526;
  --bb-o-pop: #151f37;
  --bb-o-pop-line: rgba(143,179,255,.22);
  --bb-o-scroll: rgba(143,179,255,.22);
  --bb-label: var(--bb-o-ink);
  --bb-secondary: rgba(238,243,252,.66);
  --bb-tertiary: rgba(238,243,252,.48);
  --bb-quaternary: rgba(238,243,252,.3);
  --bb-surface: #151f37;
  --bb-surface2: #1a2540;
  --bb-fill: rgba(143,179,255,.1);
  --bb-fill-strong: rgba(143,179,255,.16);
  --bb-separator: rgba(143,179,255,.16);
  --bb-separator-strong: rgba(143,179,255,.26);
  --bb-material: rgba(20,30,52,.96);
  --bb-accent-tint: rgba(143,179,255,.16);
}
@supports (color: color-mix(in srgb, red 50%, blue)) {
  .bb-c.bb-o { --bb-accent-tint: color-mix(in srgb, var(--bb-o-primary) 12%, transparent); --bb-o-pill-line: color-mix(in srgb, var(--bb-o-primary) 18%, transparent); }
  .bb-c.bb-o[data-theme="dark"] { --bb-o-pill-text: color-mix(in srgb, var(--bb-o-primary) 55%, #fff); --bb-o-pill-line: color-mix(in srgb, var(--bb-o-primary) 34%, transparent); }
}

/* No shadows anywhere in the widget — focus is shown with an outline instead. */
.bb-c.bb-o, .bb-c.bb-o *, .bb-c.bb-o *::before, .bb-c.bb-o *::after { box-shadow: none !important; text-shadow: none; }
.bb-c.bb-o :focus-visible { box-shadow: none !important; outline: 2px solid var(--bb-o-primary); outline-offset: 2px; }
.bb-c.bb-o textarea:focus-visible, .bb-c.bb-o input:focus-visible { outline: none; }

.bb-o { position: fixed; display: flex; flex-direction: column; align-items: flex-end; gap: 16px; pointer-events: none; }
.bb-o > * { pointer-events: auto; }
.bb-o.is-left { align-items: flex-start; }
.bb-o.is-center { align-items: center; }
.bb-o.is-top { flex-direction: column-reverse; }
.bb-o button { -webkit-tap-highlight-color: transparent; font-family: inherit; }

/* ---------- Window ---------- */
.bb-o-window {
  width: var(--bb-o-width, 360px); max-width: calc(100vw - 28px);
  height: var(--bb-o-height, 540px); max-height: calc(100vh - 48px);
  border-radius: var(--bb-o-radius); border: var(--bb-o-border); background: var(--bb-o-panel);
  overflow: hidden; position: relative; display: flex; flex-direction: column;
  transform-origin: bottom right; animation: bb-o-in 300ms cubic-bezier(.32,.72,0,1) both;
  transition: width 300ms cubic-bezier(.32,.72,0,1), height 300ms cubic-bezier(.32,.72,0,1);
}
.bb-o.is-left .bb-o-window { transform-origin: bottom left; }
.bb-o.is-top .bb-o-window { transform-origin: top right; }
.bb-o-window.is-expanded { width: min(720px, calc(100vw - 48px)); height: calc(100vh - 48px); }

/* ---------- Header ---------- */
.bb-o-header {
  min-height: 68px; padding: 12px; display: flex; align-items: center; gap: 10px; flex: none; position: relative; z-index: 2;
  border-bottom: 1px solid var(--bb-o-header-line); background: var(--bb-o-header);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
}
.bb-o-header-copy { min-width: 0; flex: 1; }
.bb-c .bb-o-title { margin: 0; font-size: clamp(15px, 2.2vw, 18px); line-height: 1.15; font-weight: 820; color: var(--bb-o-ink); letter-spacing: 0; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.bb-o-subtitle { margin-top: 6px; color: var(--bb-o-ink); opacity: .54; font-size: 11px; line-height: 1.25; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-o-header-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.bb-o-hbtn {
  appearance: none; border: 0; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; flex: none; cursor: pointer;
  background: transparent; color: var(--bb-o-ink); opacity: .72;
  transition: background-color 160ms ease, opacity 160ms ease, transform 120ms ease;
}
.bb-o-hbtn:hover { background: var(--bb-o-glass-hover); opacity: 1; }
.bb-o-hbtn:active { transform: scale(.94); }
.bb-o-hbtn[aria-pressed="true"] { color: var(--bb-o-primary); opacity: 1; }
.bb-o-close {
  margin-left: 2px; appearance: none; border: 0; width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; flex: none; cursor: pointer;
  color: var(--bb-o-close-fg); background: var(--bb-o-close-bg); transition: transform 120ms ease, filter 160ms ease;
}
.bb-o-close:hover { filter: brightness(1.25); }
.bb-o-close:active { transform: translateY(1px) scale(.96); }

/* ---------- Orb logo / avatars ---------- */
.bb-o-orb {
  position: relative; display: grid; place-items: center; flex: none; border-radius: 999px; overflow: hidden;
  background:
    radial-gradient(circle at 36% 28%, rgba(255,255,255,.95) 0 12%, transparent 13%),
    radial-gradient(circle at 50% 50%, #9dbcff 0 14%, #2f6bff 42%, #1d3fae 66%, rgba(29,63,174,.05) 71%);
}
.bb-o-orb::before { content: ""; width: 45%; height: 45%; border-radius: 999px; background: #fff; clip-path: polygon(0 50%, 53% 15%, 100% 0, 100% 100%, 53% 85%); }
.bb-o-orb.has-image { background: var(--bb-o-glass); }
.bb-o-orb.has-image::before { display: none; }
.bb-o-orb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; border-radius: inherit; }
.bb-o-person {
  width: 34px; height: 34px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; flex: none;
  color: #fff; font-size: 12px; font-weight: 820;
  background: radial-gradient(circle at 50% 24%, #f7ded0 0 20%, transparent 21%), linear-gradient(145deg, #c9b8ad, #9e6f59);
}
.bb-o-person.has-initials { background: linear-gradient(145deg, #a8bde8, #5c78b8); }
.bb-o-person img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ---------- Body ---------- */
.bb-o-body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px; background: var(--bb-o-body); position: relative; }
.bb-o-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; margin-right: -4px; position: relative; scroll-behavior: smooth; }
.bb-o-scroll::-webkit-scrollbar { width: 7px; }
.bb-o-scroll::-webkit-scrollbar-thumb { background: var(--bb-o-scroll); border-radius: 999px; }
.bb-o-scroll { scrollbar-width: thin; scrollbar-color: var(--bb-o-scroll) transparent; }

/* Welcome */
.bb-o-welcome { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px 14px 24px; animation: bb-o-msg-in 300ms cubic-bezier(.32,.72,0,1) both; }
.bb-o-start-title { margin: 14px 0 6px; font-size: 19px; line-height: 1.25; font-weight: 820; letter-spacing: -.01em; color: var(--bb-o-ink); }
.bb-o-start-text { max-width: 270px; margin: 0 auto; font-size: 13px; line-height: 1.5; font-weight: 520; color: var(--bb-o-muted); overflow-wrap: anywhere; }
.bb-o-start-text + .bb-o-start-text { margin-top: 6px; }
.bb-o-welcome .bb-o-actions { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 18px; }
.bb-o-welcome .bb-o-pill { text-align: center; }
.bb-o-author { display: flex; align-items: baseline; gap: 8px; margin: 7px 0 8px; font-weight: 820; font-size: 15px; color: var(--bb-o-ink); }
.bb-o-author span { color: var(--bb-o-faint); font-size: 11px; font-weight: 760; }
.bb-o-actions { display: grid; gap: 8px; margin-top: 12px; justify-items: start; }
.bb-o-pill {
  appearance: none; width: fit-content; max-width: 100%; min-height: 32px; padding: 0 11px; border: 1px solid var(--bb-o-pill-line); border-radius: 999px;
  background: var(--bb-o-glass); color: var(--bb-o-pill-text); font-size: 12.5px; font-weight: 780; cursor: pointer; text-align: left;
  display: inline-flex; align-items: center; gap: 6px; transition: background-color 160ms ease, transform 120ms ease;
}
.bb-o-pill:hover { background: var(--bb-o-glass-hover); }
.bb-o-pill:active { transform: translateY(1px) scale(.97); }

/* Messages */
.bb-o-log { display: flex; flex-direction: column; gap: 12px; padding-bottom: 6px; }
.bb-o-day { align-self: center; padding: 2px 10px; border-radius: 999px; background: var(--bb-o-glass); color: var(--bb-o-faint); font-size: 10.5px; font-weight: 720; letter-spacing: .02em; }
.bb-o-group { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 8px; align-items: start; animation: bb-o-msg-in 220ms cubic-bezier(.32,.72,0,1) both; }
.bb-o-group.is-user { grid-template-columns: minmax(0, 1fr) 34px; }
.bb-o-copy { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.bb-o-group.is-user .bb-o-copy { align-items: flex-end; }
.bb-o-meta { display: flex; align-items: baseline; gap: 7px; margin: 0; color: var(--bb-o-ink); opacity: .8; font-size: 12px; font-weight: 800; max-width: 100%; }
.bb-o-meta b { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-o-meta time { color: var(--bb-o-faint); font-size: 10.5px; font-weight: 720; white-space: nowrap; }
.bb-o-row { display: flex; flex-direction: column; align-items: flex-start; max-width: 100%; min-width: 0; }
.bb-o-group.is-user .bb-o-row { align-items: flex-end; }
.bb-o-bubble {
  display: block; max-width: 100%; min-width: 0; padding: 8px 10px; border-radius: 14px 14px 14px 6px;
  background: var(--bb-o-bot); color: var(--bb-o-text); font-size: 12.5px; line-height: 1.45; font-weight: 500; overflow-wrap: anywhere; word-break: break-word;
}
.bb-o-group.is-user .bb-o-bubble { max-width: min(88%, 260px); border-radius: 14px 14px 6px 14px; color: #fff; background: var(--bb-o-primary); white-space: pre-wrap; font-weight: 560; }
.bb-o-group.is-user .bb-o-bubble a { color: inherit; text-decoration: underline; }
.bb-o-bubble.is-pending { padding: 4px 12px; }
.bb-o-bubble.is-error { border: 1px solid rgba(220,38,38,.35); }
.bb-c .bb-o-bubble .bb-md p, .bb-c .bb-o-bubble .bb-md li { font-size: inherit; }
.bb-c .bb-o-bubble .bb-md h1, .bb-c .bb-o-bubble .bb-md h2, .bb-c .bb-o-bubble .bb-md h3, .bb-c .bb-o-bubble .bb-md h4, .bb-c .bb-o-bubble .bb-md h5, .bb-c .bb-o-bubble .bb-md h6 { font-size: 13.5px; font-weight: 800; color: var(--bb-o-ink); }
.bb-c .bb-o-bubble .bb-md strong { font-weight: 760; color: var(--bb-o-ink); }
.bb-c .bb-o-bubble .bb-code { background: rgba(255,255,255,.7); }
.bb-c.bb-o[data-theme="dark"] .bb-o-bubble .bb-code { background: rgba(0,0,0,.25); }
.bb-c .bb-o-bubble .bb-code pre, .bb-c .bb-o-bubble .bb-md table { font-size: 12px; }
.bb-o-bubble.is-streaming .bb-md > :last-child::after {
  content: "\\258D"; display: inline-block; margin-left: 2px; color: var(--bb-o-primary); font-weight: 400; animation: bb-o-caret 1s steps(2, start) infinite;
}
.bb-o-tools { display: flex; align-items: center; gap: 2px; min-height: 0; max-height: 0; opacity: 0; overflow: hidden; transition: opacity 120ms ease, max-height 120ms ease; }
.bb-o-row:hover .bb-o-tools, .bb-o-row:focus-within .bb-o-tools, .bb-o-row.is-last .bb-o-tools { max-height: 40px; opacity: 1; }
.bb-o-row.is-last .bb-o-tools { margin-top: 3px; }
@media (hover: none) { .bb-o-tools { max-height: 40px; opacity: 1; } }
.bb-o-tool-btn {
  appearance: none; border: 0; width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; cursor: pointer;
  background: transparent; color: var(--bb-o-faint); transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
}
.bb-o-tool-btn:hover { background: var(--bb-o-glass-hover); color: var(--bb-o-ink); }
.bb-o-tool-btn:active { transform: scale(.92); }
.bb-o-tool-btn[aria-pressed="true"] { color: var(--bb-o-primary); }
.bb-o-note { font-size: 10.5px; font-weight: 720; color: var(--bb-o-faint); padding: 0 4px; }
.bb-o-note.is-error { color: #dc2626; }
.bb-o .bb-c-sources { font-size: 11.5px; color: var(--bb-o-muted); }
.bb-o .bb-c-sources summary { font-weight: 720; }
.bb-o .bb-c-sources summary:hover { background: var(--bb-o-glass-hover); }
.bb-o .bb-c-src-snippet { max-width: 220px; }

.bb-o-jump {
  position: sticky; bottom: 6px; margin: -36px auto 0; width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; cursor: pointer; z-index: 3;
  border: 1px solid var(--bb-o-pop-line); background: var(--bb-o-pop); color: var(--bb-o-ink); animation: bb-o-fade 180ms both;
}

/* History */
.bb-o-history { display: flex; flex-direction: column; gap: 6px; }
.bb-c .bb-o-history-title { margin: 2px 2px 4px; font-size: 15px; font-weight: 820; color: var(--bb-o-ink); }
.bb-o .bb-c-search input { height: 34px; border-radius: 999px; background: var(--bb-o-glass); border: 1px solid var(--bb-o-glass-line); color: var(--bb-o-ink); font-size: 12.5px; }
.bb-o .bb-c-search input:focus { background: var(--bb-o-glass-hover); border-color: var(--bb-o-pill-line); }
.bb-o .bb-c-session { border-radius: 12px; padding: 8px 10px; }
.bb-o .bb-c-session:hover { background: var(--bb-o-glass-hover); }
.bb-o .bb-c-session.is-active { background: var(--bb-accent-tint); }
.bb-o .bb-c-session-title { font-size: 12.5px; font-weight: 650; }
.bb-o .bb-c-session-label { padding: 10px 10px 4px; font-weight: 720; }
.bb-o .bb-c-skel { border-radius: 12px; }
.bb-o .bb-c-empty { padding: 24px 12px; }
.bb-o .bb-c-empty-icon { width: 56px; height: 56px; }
.bb-c.bb-o .bb-c-empty h3 { font-size: 15px; font-weight: 800; }
.bb-c.bb-o .bb-c-empty p { font-size: 12.5px; }

/* Alert + toasts (flat, no shadow) */
.bb-o .bb-c-alert { margin: 8px 0 0; border-radius: 14px; font-size: 12.5px; }
.bb-o .bb-c-toasts, .bb-o .bb-c-toasts.is-top { top: 0; bottom: auto; left: 0; right: 0; width: auto; }
.bb-o .bb-c-toast { border-radius: 14px; border: 1px solid var(--bb-o-pop-line); background: var(--bb-material); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.bb-o .bb-c-toast-title { font-size: 12.5px; font-weight: 760; }
.bb-o .bb-c-toast-body { font-size: 12px; }

/* ---------- Mode switch ---------- */
.bb-o-modes {
  align-self: center; display: grid; grid-template-columns: 1fr 1fr; min-width: 172px; min-height: 38px; margin: 10px auto 12px; padding: 4px; flex: none;
  border-radius: 999px; border: 1px solid var(--bb-o-glass-line); background: var(--bb-o-glass);
}
.bb-o-mode {
  appearance: none; border: 0; border-radius: 999px; background: transparent; color: var(--bb-o-ink); display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; font-size: 13px; font-weight: 760; cursor: pointer; padding: 0 12px; opacity: .72; transition: background-color 160ms ease, opacity 160ms ease;
}
.bb-o-mode[aria-selected="true"] { background: var(--bb-o-glass-hover); opacity: 1; }
.bb-c.bb-o:not([data-theme="dark"]) .bb-o-mode[aria-selected="true"] { background: rgba(255,255,255,.62); }

/* ---------- Composer ---------- */
.bb-o-composer {
  position: relative; flex: none; min-height: 88px; padding: 10px; border-radius: 17px;
  border: 1px solid var(--bb-o-glass-line); background: var(--bb-o-glass);
}
.bb-o-gap { height: 10px; flex: none; }
.bb-o-composer textarea {
  display: block; width: 100%; min-height: 30px; height: 30px; max-height: 96px; padding: 0 2px; border: 0; outline: 0; resize: none;
  color: var(--bb-o-ink); background: transparent; font: inherit; font-size: 13px; line-height: 1.35; overflow-y: auto;
}
.bb-o-composer textarea::placeholder { color: var(--bb-o-ink); opacity: .52; }
.bb-o-bar { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.bb-o-tool, .bb-o-history-btn {
  appearance: none; border: 0; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none;
  color: var(--bb-o-ink); background: var(--bb-o-glass); transition: background-color 160ms ease, transform 120ms ease;
}
.bb-o-tool { width: 34px; height: 34px; border-radius: 999px; }
.bb-o-history-btn { height: 34px; gap: 5px; border-radius: 999px; padding: 0 10px; font-size: 12.5px; font-weight: 780; white-space: nowrap; }
.bb-o-tool:hover, .bb-o-history-btn:hover { background: var(--bb-o-glass-hover); }
.bb-o-tool:active, .bb-o-history-btn:active { transform: translateY(1px) scale(.96); }
.bb-o-tool[aria-expanded="true"], .bb-o-history-btn[aria-pressed="true"] { background: var(--bb-o-glass-hover); color: var(--bb-o-primary); }
.bb-o-send {
  appearance: none; border: 0; margin-left: auto; width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; cursor: pointer; flex: none;
  color: #fff; background: radial-gradient(circle at 36% 28%, #c3d9ff, var(--bb-o-primary) 53%, #1d3fae 100%);
  transition: transform 120ms ease, filter 160ms ease, opacity 160ms ease;
}
.bb-o-send:hover:not(:disabled) { filter: brightness(1.08) saturate(1.1); }
.bb-o-send:active:not(:disabled) { transform: translateY(1px) scale(.95); }
.bb-o-send:disabled { opacity: .6; cursor: default; }
.bb-o-send.is-stop { background: var(--bb-o-close-bg); color: var(--bb-o-close-fg); }
.bb-o-send.is-recording { background: #dc2626; animation: bb-o-pulse 1.2s ease-in-out infinite; }
.bb-o-file { display: none; }
.bb-o-status { display: flex; align-items: center; gap: 6px; color: #dc2626; font-size: 12px; font-weight: 760; margin-top: 8px; }
.bb-o-status::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #dc2626; animation: bb-o-pulse 1.2s ease-in-out infinite; }
.bb-o-emoji {
  position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 8; display: grid; grid-template-columns: repeat(6, 32px); gap: 2px; padding: 6px;
  background: var(--bb-o-pop); border: 1px solid var(--bb-o-pop-line); border-radius: 14px; animation: bb-o-pop 160ms cubic-bezier(.32,.72,0,1) both;
}
.bb-o-emoji button { appearance: none; border: 0; background: transparent; width: 32px; height: 32px; border-radius: 8px; font-size: 18px; cursor: pointer; }
.bb-o-emoji button:hover { background: var(--bb-fill); }

/* ---------- Launcher ---------- */
.bb-o-launcher {
  appearance: none; border: 0; cursor: pointer; position: relative; flex: none; color: #fff; display: inline-flex; align-items: center; justify-content: center;
  min-width: 104px; height: 46px; padding: 0 15px; gap: 10px; border-radius: 999px; font-size: 14px; font-weight: 760;
  background: radial-gradient(circle at 20% 20%, #9dbcff, var(--bb-o-primary) 50%, #1d3fae 100%);
  animation: bb-o-launch 300ms cubic-bezier(.32,.72,0,1) both; transition: transform 120ms ease, filter 160ms ease;
}
.bb-o-launcher:hover { filter: brightness(1.06) saturate(1.1); }
.bb-o-launcher:active { transform: translateY(1px) scale(.96); }
.bb-o-launcher.is-icon { min-width: 0; width: 60px; height: 60px; padding: 0; border: 3px solid rgba(255,255,255,.7); background: radial-gradient(circle at 30% 24%, #9dbcff, var(--bb-o-primary) 52%, #1d3fae 100%); }
.bb-o-launcher.is-icon svg { transition: transform 260ms cubic-bezier(.32,.72,0,1); }
.bb-o-launcher.is-icon:hover svg { transform: rotate(-8deg) scale(1.06); }
.bb-o-launcher.is-gif { min-width: 0; width: 64px; height: 64px; padding: 0; background: transparent; }
.bb-o-launcher.is-gif img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; display: block; }
.bb-o-badge {
  position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; border: 2px solid #fff;
  background: #050506; color: #fff; font-size: 11px; font-weight: 800; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums;
  animation: bb-o-badge 260ms cubic-bezier(.32,.72,0,1) both;
}

/* ---------- Animations ---------- */
@keyframes bb-o-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes bb-o-launch { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
@keyframes bb-o-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes bb-o-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bb-o-pop { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
@keyframes bb-o-badge { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes bb-o-caret { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
@keyframes bb-o-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.94); opacity: .8; } }

/* ---------- Small screens: floating card that fills the viewport ---------- */
@media (max-width: 575px) {
  .bb-o.is-open { inset: 12px !important; transform: none !important; gap: 0; }
  .bb-o.is-open .bb-o-window, .bb-o.is-open .bb-o-window.is-expanded { width: 100%; max-width: none; height: 100%; max-height: none; border-radius: 20px; }
  .bb-o-header { min-height: 64px; gap: 8px; }
  .bb-o-expand { display: none !important; }
  .bb-o-body { padding: 10px; }
  .bb-o-hbtn { width: 36px; height: 36px; }
  .bb-o-composer { padding-bottom: max(10px, env(safe-area-inset-bottom, 0px)); }
}

@media (prefers-reduced-motion: reduce) {
  .bb-o *, .bb-o *::before, .bb-o *::after, .bb-o-window, .bb-o-launcher {
    animation-duration: 100ms !important; animation-iteration-count: 1 !important; transition-duration: 100ms !important; scroll-behavior: auto !important;
  }
  .bb-o-window, .bb-o-launcher, .bb-o-group, .bb-o-welcome, .bb-o-emoji, .bb-o .bb-c-toast { animation-name: bb-o-fade !important; }
  .bb-o .bb-c-toast.is-leaving { animation-name: none !important; opacity: 0; }
  .bb-o-bubble.is-streaming .bb-md > :last-child::after, .bb-o-send.is-recording, .bb-o-status::before { animation: none !important; }
  .bb-o button:active { transform: none !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Orb({ size, src, label }: { size: number; src?: string; label?: string }) {
  return (
    <span
      className={`bb-o-orb${src ? ' has-image' : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {src ? <img src={src} alt="" /> : null}
    </span>
  );
}

function Person({ name, src }: { name?: string; src?: string }) {
  const initials = initialsOf(name);
  return (
    <span className={`bb-o-person${!src && initials ? ' has-initials' : ''}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials || null}
    </span>
  );
}

/** Chat bubble + sparkle (original omago launcher icon). */
function OmagoIcon({ name, size = 22, strokeWidth = 2 }: { name: 'chat' | 'aichat' | 'voice' | 'send'; size?: number; strokeWidth?: number }) {
  const paths: Record<string, ReactNode> = {
    aichat: (
      <>
        <path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.8-5.4A8.5 8.5 0 1 1 21 11.5Z" />
        <path d="M12 6.9l1.15 2.75L15.9 10.8l-2.75 1.15L12 14.7l-1.15-2.75L8.1 10.8l2.75-1.15Z" fill="currentColor" stroke="none" />
      </>
    ),
    chat: (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.3-5.1A8 8 0 1 1 21 12Z" />
        <path d="m14.5 7.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
      </>
    ),
    voice: (
      <>
        <rect x="4" y="9" width="4" height="6" rx="2" />
        <rect x="10" y="5" width="4" height="14" rx="2" />
        <rect x="16" y="11" width="4" height="4" rx="2" />
        <path d="m18.5 4 .7 1.7 1.8.8-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.8Z" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    )
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

const EMOJI_SET = ['😀', '😂', '😍', '👍', '🙏', '🎉', '🔥', '❤️', '😢', '🤔', '👏', '✅'];

/* ------------------------------------------------------------------ */
/* Message list                                                        */
/* ------------------------------------------------------------------ */

interface OmagoMessagesProps {
  messages: ChatMessage[];
  botName: string;
  botAvatar?: string;
  userName: string;
  userAvatar?: string;
  showFeedback: boolean;
  canRate: boolean;
  onCopy: (m: ChatMessage) => void;
  onFeedback: (m: ChatMessage, rating: 'up' | 'down') => void;
}

function OmagoMessages({ messages, botName, botAvatar, userName, userAvatar, showFeedback, canRate, onCopy, onFeedback }: OmagoMessagesProps) {
  const items = useMemo(() => buildItems(messages), [messages]);
  return (
    <div className="bb-o-log" role="log" aria-live="off" aria-label="Conversation">
      {items.map((item) => {
        if (item.kind === 'day') {
          return (
            <div key={item.key} className="bb-o-day" role="separator">
              {item.label}
            </div>
          );
        }
        const isUser = item.role === 'user';
        const first = item.messages[0];
        const time = formatTime(first?.timestamp);
        const avatar = isUser ? <Person name={userName} src={userAvatar} /> : <Orb size={34} src={botAvatar} />;
        const copy = (
          <div className="bb-o-copy">
            <div className="bb-o-meta">
              <b>{isUser ? userName || 'You' : botName}</b>
              {time ? <time dateTime={first.timestamp}>{time}</time> : null}
            </div>
            {item.messages.map((m, idx) => {
              const last = idx === item.messages.length - 1;
              const pending = m.status === 'pending';
              const streamingNow = m.status === 'streaming';
              const busy = pending || streamingNow;
              return (
                <div key={m.id} className={`bb-o-row${last ? ' is-last' : ''}`}>
                  <span className="bb-c-sr">{isUser ? 'You said:' : `${botName} said:`}</span>
                  <div
                    className={`bb-o-bubble${streamingNow ? ' is-streaming' : ''}${pending ? ' is-pending' : ''}${m.status === 'error' ? ' is-error' : ''}`}
                    aria-busy={busy || undefined}
                  >
                    {pending ? <TypingIndicator /> : isUser ? m.text : <MessageContent text={m.text} />}
                  </div>
                  {!isUser && !busy && m.sources && m.sources.length ? <Sources sources={m.sources} /> : null}
                  {!busy && !isUser && (m.text || m.status === 'stopped' || m.status === 'error') ? (
                    <div className="bb-o-tools">
                      {m.text ? (
                        <button type="button" className="bb-o-tool-btn" onClick={() => onCopy(m)} aria-label="Copy answer" title="Copy">
                          <ChatIcon name="copy" size={14} />
                        </button>
                      ) : null}
                      {m.text && showFeedback && canRate && m.status !== 'error' ? (
                        <>
                          <button
                            type="button"
                            className="bb-o-tool-btn"
                            onClick={() => onFeedback(m, 'up')}
                            aria-label="Good answer"
                            aria-pressed={m.feedback === 'up'}
                            title="Good answer"
                          >
                            <ChatIcon name="thumbUp" size={14} />
                          </button>
                          <button
                            type="button"
                            className="bb-o-tool-btn"
                            onClick={() => onFeedback(m, 'down')}
                            aria-label="Bad answer"
                            aria-pressed={m.feedback === 'down'}
                            title="Bad answer"
                          >
                            <ChatIcon name="thumbDown" size={14} />
                          </button>
                        </>
                      ) : null}
                      {m.status === 'stopped' ? <span className="bb-o-note">Stopped</span> : null}
                      {m.status === 'error' ? <span className="bb-o-note is-error">Interrupted</span> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
        return (
          <div key={item.key} className={`bb-o-group ${isUser ? 'is-user' : 'is-bot'}`}>
            {isUser ? (
              <>
                {copy}
                {avatar}
              </>
            ) : (
              <>
                {avatar}
                {copy}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

interface OmagoComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  streaming: boolean;
  placeholder: string;
  historyLabel: string;
  historyOpen: boolean;
  onToggleHistory: () => void;
  voiceMode: boolean;
  recording: boolean;
  onVoice: () => void;
  showFileUpload: boolean;
  showImageUpload: boolean;
  onFile: (f: File) => void;
  onImage: (f: File) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  onEscape: () => void;
}

function OmagoComposer(props: OmagoComposerProps) {
  const { value, onChange, onSend, onStop, busy, streaming, placeholder, historyLabel, historyOpen, onToggleHistory, voiceMode, recording, onVoice, inputRef, onEscape } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiId = useId();

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '30px';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value, inputRef]);

  const canSend = value.trim().length > 0 && !busy;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (emojiOpen) setEmojiOpen(false);
      else onEscape();
    }
  };

  let action: ReactNode;
  if (streaming) {
    action = (
      <button type="button" className="bb-o-send is-stop" onClick={onStop} aria-label="Stop generating" title="Stop">
        <ChatIcon name="stop" size={18} />
      </button>
    );
  } else if (voiceMode && !value.trim()) {
    action = (
      <button
        type="button"
        className={`bb-o-send${recording ? ' is-recording' : ''}`}
        onClick={onVoice}
        aria-label={recording ? 'Stop recording and send' : 'Record a voice note'}
        aria-pressed={recording}
        title={recording ? 'Stop and send' : 'Record'}
      >
        {recording ? <ChatIcon name="stop" size={18} /> : <OmagoIcon name="voice" size={22} strokeWidth={2.1} />}
      </button>
    );
  } else {
    action = (
      <button type="button" className="bb-o-send" onClick={onSend} disabled={!canSend} aria-label="Send message" title="Send">
        <OmagoIcon name="send" size={20} strokeWidth={2.1} />
      </button>
    );
  }

  return (
    <div className="bb-o-composer">
      {emojiOpen ? (
        <div className="bb-o-emoji" id={emojiId} role="dialog" aria-label="Emoji">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Insert ${e}`}
              onClick={() => {
                onChange(value + e);
                setEmojiOpen(false);
                inputRef.current?.focus();
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        placeholder={voiceMode ? 'Voice mode ready — tap the mic or type…' : placeholder}
        aria-label="Message"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="bb-o-bar">
        {props.showFileUpload ? (
          <>
            <button type="button" className="bb-o-tool" onClick={() => fileRef.current?.click()} aria-label="Attach a file" title="Attach a file">
              <ChatIcon name="paperclip" size={20} strokeWidth={1.8} />
            </button>
            <input
              ref={fileRef}
              className="bb-o-file"
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onFile(f);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        {props.showImageUpload ? (
          <>
            <button type="button" className="bb-o-tool" onClick={() => imageRef.current?.click()} aria-label="Add an image" title="Add an image">
              <ChatIcon name="image" size={19} strokeWidth={1.8} />
            </button>
            <input
              ref={imageRef}
              className="bb-o-file"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onImage(f);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        <button
          type="button"
          className="bb-o-tool"
          onClick={() => setEmojiOpen((o) => !o)}
          aria-label="Insert emoji"
          aria-expanded={emojiOpen}
          aria-controls={emojiOpen ? emojiId : undefined}
          title="Emoji"
        >
          <ChatIcon name="smile" size={20} strokeWidth={1.8} />
        </button>
        <button type="button" className="bb-o-history-btn" onClick={onToggleHistory} aria-pressed={historyOpen} title="Previous conversations">
          <ChatIcon name={historyOpen ? 'chevronLeft' : 'search'} size={18} strokeWidth={2.2} />
          {historyOpen ? 'Back to chat' : historyLabel}
        </button>
        {action}
      </div>
      {recording ? (
        <div className="bb-o-status" role="status">
          Recording… tap the button to send
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */

type View = 'chat' | 'history';

export function ChatWidget({
  sdk,
  position = 'bottom-right',
  primaryColor = '#2563eb',
  accentColor = '#08080a',
  backgroundColor = '#f3f6fd',
  border,
  borderRadius,
  launcherType = 'auto',
  launcherGifUrl,
  buttonText,
  placeholder,
  width = '360px',
  height = '540px',
  defaultOpen = false,
  onOpenChange,
  zIndex = 9999,
  mode = 'light',
  sounds = true,
  logoUrl,
  logoText,
  companyName,
  companyDescription,
  headerText,
  avatarGifUrl,
  user,
  bot,
  data,
  manualData,
  showExportButton = false,
  showVoiceInput = true,
  showFileUpload = true,
  showImageUpload = false,
  showFeedback = true,
  initialSessionId,
  persistSession = true
}: ChatWidgetProps) {
  useInjectedStyle(CHAT_STYLE_ID, CHAT_CSS);
  useInjectedStyle(OMAGO_STYLE_ID, OMAGO_CSS);
  const theme = useResolvedMode(mode);
  const [open, setOpenState] = useState(defaultOpen);
  const [view, setView] = useState<View>('chat');
  const [inputMode, setInputMode] = useState<'chat' | 'voice'>('chat');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { soundOn, toggleSound, play } = useSoundPreference(sounds);
  const { toasts, push, dismiss, pause, resume } = useToasts();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const sdkUser = useMemo(() => {
    try {
      return sdk.getUserProfile?.() || null;
    } catch {
      return null;
    }
  }, [sdk]);

  const ui = useMemo(() => {
    const merged = mergeData(defaultChatWidgetData, (manualData || data) as Record<string, any> | undefined);
    const person = { ...(merged.user || {}), ...(sdkUser || {}), ...(user || {}) };
    const botInfo = { ...(merged.bot || {}), ...(bot || {}) };
    const title = headerText || companyName || logoText || merged.brand?.name || botInfo.name || 'Assistant';
    const first = (person.firstName || person.name || '').split(/\s+/)[0] || '';
    const vars = { name: first, botName: botInfo.name || title };
    const greeting = merged.greeting ? interpolate(merged.greeting, vars) : first ? `Hi ${first} 👋` : 'Hi there 👋';
    const actions: ChatQuickAction[] = normalizeActions(merged.quickActions);
    const intro = (merged.introMessages || []).map((m: string) => interpolate(m, vars)).filter(Boolean);
    const welcome = [
      merged.greeting ? greeting : `${greeting} Ask me anything — I’m here to help.`,
      ...(intro.length ? intro : actions.length ? ['Here are a few ways I can assist you right now.'] : [])
    ];
    return {
      title,
      subtitle: companyDescription || merged.brand?.subtitle || 'Typically replies in seconds',
      logo: logoUrl || merged.brand?.logoUrl || '',
      botName: botInfo.name || title,
      botAvatar: avatarGifUrl || botInfo.avatarUrl || logoUrl || merged.brand?.logoUrl || '',
      userName: String(person.name || [person.firstName, person.lastName].filter(Boolean).join(' ') || ''),
      userAvatar: person.avatarUrl ? String(person.avatarUrl) : '',
      person,
      welcome,
      actions,
      placeholder: placeholder || merged.composer?.placeholder || 'Type message…',
      historyLabel: merged.composer?.searchLabel || 'History'
    };
  }, [avatarGifUrl, bot, companyDescription, companyName, data, headerText, logoText, logoUrl, manualData, placeholder, sdkUser, user]);

  const chat = useBrainboxChat(sdk, initialSessionId, {
    persistSession,
    open,
    userKey: ui.person.email || ui.person.username || undefined,
    onReply: (m) => {
      play(open ? 'receive' : 'notify');
      setAnnouncement(`${ui.botName}: ${m.text.slice(0, 280)}`);
    },
    onError: (msg) => {
      play('error');
      push({ tone: 'error', title: 'Message not sent', body: msg, action: { label: 'Retry', onClick: () => void chat.retry() } });
    }
  });

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  // Focus management: input on open, launcher on close.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) setTimeout(() => inputRef.current?.focus(), 60);
    if (!open && wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Load sessions only when history is opened.
  useEffect(() => {
    if (open && view === 'history' && !chat.sessionsLoaded && !chat.sessionsLoading) void chat.refreshSessions();
  }, [open, view, chat.sessionsLoaded, chat.sessionsLoading, chat.refreshSessions]);

  const scroll = useAutoScroll([chat.messages, open, view]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 30);

  const send = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || chat.loading) return;
    setInput('');
    play('send');
    setView('chat');
    void chat.sendMessage(value);
    scroll.scrollToBottom(false);
  };

  const onCopy = async (m: ChatMessage) => {
    const ok = await copyText(m.text);
    push(ok ? { tone: 'success', title: 'Copied to clipboard' } : { tone: 'error', title: 'Couldn’t copy' });
  };

  const onFeedback = async (m: ChatMessage, rating: 'up' | 'down') => {
    try {
      await chat.sendFeedback(m.id, rating);
      push({ tone: 'success', title: 'Thanks for the feedback', body: rating === 'down' ? 'We’ll use it to improve this answer.' : undefined });
    } catch (err) {
      play('error');
      push({ tone: 'error', title: 'Feedback not sent', body: err instanceof Error ? err.message : undefined });
    }
  };

  const voice = useVoiceRecorder(
    (blob) => void chat.sendVoiceNote(blob),
    (msg) => {
      play('error');
      push({ tone: 'error', title: 'Microphone unavailable', body: msg });
    }
  );

  const newChat = () => {
    void chat.createSession();
    setView('chat');
    setInput('');
    focusInput();
  };

  const toggleHistory = () => {
    setView((v) => (v === 'history' ? 'chat' : 'history'));
    setQuery('');
  };

  const onKeyDownWindow = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (view === 'history') {
      setView('chat');
      focusInput();
    } else setOpen(false);
  };

  const isLeft = position.includes('left');
  const isTop = position.includes('top');
  const rootStyle: Record<string, string | number> = { zIndex };
  if (position === 'center') {
    rootStyle.left = '50%';
    rootStyle.transform = 'translateX(-50%)';
    rootStyle.bottom = 24;
  } else {
    rootStyle[isTop ? 'top' : 'bottom'] = 24;
    rootStyle[isLeft ? 'left' : 'right'] = 24;
  }
  rootStyle['--bb-o-primary'] = primaryColor;
  rootStyle['--bb-o-width'] = width;
  rootStyle['--bb-o-height'] = height;
  if (borderRadius) rootStyle['--bb-o-radius'] = borderRadius;
  if (border) rootStyle['--bb-o-border'] = border;
  // Ink and panel colours are light-mode colours; dark mode keeps its own navy palette.
  if (theme === 'light') {
    rootStyle['--bb-o-ink'] = accentColor;
    rootStyle['--bb-o-panel'] = backgroundColor;
  }

  const unread = chat.unreadCount;
  const hasMessages = chat.messages.length > 0;
  const canRate = !!chat.sessionId;
  const badge = unread ? (
    <span className="bb-o-badge" aria-hidden="true">
      {unread > 9 ? '9+' : unread}
    </span>
  ) : null;
  const launcherLabel = unread ? `Open chat, ${unread} unread ${unread === 1 ? 'reply' : 'replies'}` : 'Open chat';

  const launcherText = (buttonText || '').trim();
  // 'auto': round icon until a launcher text is configured.
  const effectiveLauncher = launcherType === 'auto' || !launcherType ? (launcherText ? 'button' : 'icon') : launcherType;
  let launcher: ReactNode = null;
  if (!open) {
    if (effectiveLauncher === 'gif' && launcherGifUrl) {
      launcher = (
        <button ref={launcherRef} type="button" className="bb-o-launcher is-gif" onClick={() => setOpen(true)} aria-label={launcherLabel}>
          <img src={launcherGifUrl} alt="" />
          {badge}
        </button>
      );
    } else if (effectiveLauncher !== 'button') {
      launcher = (
        <button ref={launcherRef} type="button" className="bb-o-launcher is-icon" onClick={() => setOpen(true)} aria-label={launcherLabel}>
          <OmagoIcon name="aichat" size={28} strokeWidth={1.9} />
          {badge}
        </button>
      );
    } else {
      launcher = (
        <button ref={launcherRef} type="button" className="bb-o-launcher" onClick={() => setOpen(true)} aria-label={launcherLabel}>
          <OmagoIcon name="aichat" size={22} strokeWidth={1.9} />
          <span>{launcherText || 'Chat'}</span>
          {badge}
        </button>
      );
    }
  }

  const voiceMode = showVoiceInput && inputMode === 'voice';

  return (
    <div
      className={`bb-c bb-o${isLeft ? ' is-left' : ''}${isTop ? ' is-top' : ''}${position === 'center' ? ' is-center' : ''}${open ? ' is-open' : ''}`}
      data-theme={theme}
      data-design="omago"
      style={rootStyle as CSSProperties}
    >
      <div className="bb-c-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {open ? (
        <section className={`bb-o-window${expanded ? ' is-expanded' : ''}`} role="dialog" aria-modal="false" aria-labelledby={titleId} onKeyDown={onKeyDownWindow}>
          <header className="bb-o-header">
            <Orb size={38} src={ui.logo || undefined} />
            <div className="bb-o-header-copy">
              <h2 className="bb-o-title" id={titleId}>
                {ui.title}
              </h2>
              <div className="bb-o-subtitle">{chat.streaming ? 'Typing…' : ui.subtitle}</div>
            </div>
            <div className="bb-o-header-actions">
              <button type="button" className="bb-o-hbtn" onClick={newChat} aria-label="New conversation" title="New conversation">
                <ChatIcon name="compose" size={17} />
              </button>
              {showExportButton && hasMessages ? (
                <button type="button" className="bb-o-hbtn" onClick={() => void chat.exportChat('json')} aria-label="Export conversation" title="Export">
                  <ChatIcon name="download" size={17} />
                </button>
              ) : null}
              {sounds ? (
                <button
                  type="button"
                  className="bb-o-hbtn"
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                  aria-pressed={!soundOn}
                  title={soundOn ? 'Sounds on' : 'Sounds off'}
                >
                  <ChatIcon name={soundOn ? 'volume' : 'volumeOff'} size={17} />
                </button>
              ) : null}
              <button
                type="button"
                className="bb-o-hbtn bb-o-expand"
                onClick={() => setExpanded((x) => !x)}
                aria-label={expanded ? 'Shrink window' : 'Expand window'}
                aria-pressed={expanded}
                title={expanded ? 'Shrink' : 'Expand'}
              >
                <ChatIcon name={expanded ? 'shrink' : 'expand'} size={15} />
              </button>
              <button type="button" className="bb-o-close" onClick={() => setOpen(false)} aria-label="Close chat" title="Close">
                <ChatIcon name="x" size={20} strokeWidth={1.9} />
              </button>
            </div>
          </header>

          <div className="bb-o-body">
            <ToastStack toasts={toasts} dismiss={dismiss} pause={pause} resume={resume} placement="top" />
            <div className="bb-o-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
              {view === 'history' ? (
                <div className="bb-o-history">
                  <h3 className="bb-o-history-title">Conversations</h3>
                  <label className="bb-c-search">
                    <span className="bb-c-sr">Search conversations</span>
                    <ChatIcon name="search" size={15} />
                    <input type="search" placeholder="Search" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
                  </label>
                  <SessionList
                    sessions={chat.sessions || []}
                    activeId={chat.sessionId}
                    loading={chat.sessionsLoading}
                    query={query}
                    onSelect={(id) => {
                      setView('chat');
                      void chat.loadSession(id);
                      focusInput();
                    }}
                  />
                </div>
              ) : !hasMessages && !chat.loading ? (
                <div className="bb-o-welcome">
                  <Orb size={64} src={ui.botAvatar || undefined} />
                  <h2 className="bb-o-start-title">{ui.botName}</h2>
                  {ui.welcome.map((m, i) => (
                    <p key={i} className="bb-o-start-text">
                      {m}
                    </p>
                  ))}
                  {ui.actions.length ? (
                    <div className="bb-o-actions">
                      {ui.actions.map((a) => (
                        <button key={a.label} type="button" className="bb-o-pill" onClick={() => send(a.prompt || a.label)}>
                          {a.icon ? <ChatIcon name={a.icon} size={14} /> : null}
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <OmagoMessages
                  messages={chat.messages}
                  botName={ui.botName}
                  botAvatar={ui.botAvatar || undefined}
                  userName={ui.userName}
                  userAvatar={ui.userAvatar || undefined}
                  showFeedback={showFeedback}
                  canRate={canRate}
                  onCopy={onCopy}
                  onFeedback={onFeedback}
                />
              )}
              {scroll.showJump && view === 'chat' ? (
                <button type="button" className="bb-o-jump" onClick={() => scroll.scrollToBottom()} aria-label="Scroll to latest message">
                  <ChatIcon name="arrowDown" size={16} />
                </button>
              ) : null}
            </div>
            {chat.error && !chat.loading && view === 'chat' ? (
              <div className="bb-c-alert" role="alert">
                <ChatIcon name="alert" size={16} />
                <span className="bb-c-alert-msg">{chat.error}</span>
                <button type="button" className="bb-c-btn" onClick={() => void chat.retry()}>
                  Retry
                </button>
                <button type="button" className="bb-c-iconbtn is-sm" onClick={chat.clearError} aria-label="Dismiss error">
                  <ChatIcon name="x" size={14} />
                </button>
              </div>
            ) : null}
            {showVoiceInput && view === 'chat' ? (
              <div className="bb-o-modes" role="tablist" aria-label="Conversation mode">
                {(['chat', 'voice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    className="bb-o-mode"
                    aria-selected={inputMode === m}
                    tabIndex={inputMode === m ? 0 : -1}
                    onClick={() => setInputMode(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setInputMode(inputMode === 'chat' ? 'voice' : 'chat');
                      }
                    }}
                  >
                    <OmagoIcon name={m} size={20} strokeWidth={1.9} />
                    {m === 'chat' ? 'Chat' : 'Voice'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bb-o-gap" />
            )}
            <OmagoComposer
              value={input}
              onChange={setInput}
              onSend={() => send()}
              onStop={chat.stop}
              busy={chat.loading}
              streaming={chat.loading && !voice.recording}
              placeholder={ui.placeholder}
              historyLabel={ui.historyLabel}
              historyOpen={view === 'history'}
              onToggleHistory={toggleHistory}
              voiceMode={voiceMode}
              recording={voice.recording}
              onVoice={() => void voice.toggle()}
              showFileUpload={showFileUpload}
              showImageUpload={showImageUpload}
              onFile={(f) => void chat.uploadFile(f)}
              onImage={(f) => void chat.uploadImage(f)}
              inputRef={inputRef}
              onEscape={() => (view === 'history' ? setView('chat') : setOpen(false))}
            />
          </div>
        </section>
      ) : null}
      {launcher}
    </div>
  );
}

export default ChatWidget;
