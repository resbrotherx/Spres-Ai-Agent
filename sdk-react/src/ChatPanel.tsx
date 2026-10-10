'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { useBrainboxChat } from './useBrainboxChat';
import { BrainboxLogo } from './design/Logo';
import { saveAnswerAsPdf } from './design/exports';
import { MessageContent } from './MessageContent';
import { TypingIndicator } from './co/TypingIndicator';
import {
  CHAT_CSS,
  CHAT_STYLE_ID,
  ChatIcon,
  PersonAvatar,
  Sources,
  ToastStack,
  copyText,
  interpolate,
  mergeData,
  useAutoScroll,
  useInjectedStyle,
  useResolvedMode,
  useSoundPreference,
  useToasts,
  useVoiceRecorder
} from './chatUi';
import type { BrainboxColorMode, ChatMessage, ChatPanelProps, ChatSession, ChatUiData } from './types';

/** Default copy. Override any field with `data` / `manualData`. No demo content. */
export const defaultChatPanelData: ChatUiData = {
  brand: { name: '', workspaceName: '', greetingName: '' },
  user: { name: '', email: '', avatarUrl: '' },
  bot: { name: 'Assistant' },
  greeting: '',
  composer: { placeholder: 'Ask anything' },
  promptCards: [
    { icon: 'sparkles', title: 'What can you do?', description: 'See how the assistant can help you.', prompt: 'What can you help me with?' },
    { icon: 'book', title: 'Getting started', description: 'Walk me through the basics.', prompt: 'How do I get started?' },
    { icon: 'wrench', title: 'Troubleshoot', description: 'Help me fix a problem I’m having.', prompt: 'I have a problem I need help with.' },
    { icon: 'doc', title: 'Policies & docs', description: 'Find an answer in the documentation.', prompt: 'Where can I find your policies and documentation?' }
  ]
};

const PANEL_STYLE_ID = 'bb-gp-styles-v1';

/* ChatGPT-style full-page chat. Scoped to .bb-gp so the floating widget keeps its own design. */
const PANEL_CSS = `
.bb-gp {
  --gp-bg: #ffffff; --gp-side: #f9f9f9; --gp-hover: #ececec; --gp-active: #e6e6e6; --gp-text: #0d0d0d; --gp-muted: #5d5d5d;
  --gp-faint: #8f8f8f; --gp-line: rgba(0,0,0,.08); --gp-user: #f4f4f4; --gp-box: #ffffff; --gp-box-line: rgba(0,0,0,.12);
  --gp-pop: #ffffff; --gp-pop-line: rgba(0,0,0,.1); --gp-send: #0d0d0d; --gp-send-ink: #ffffff; --gp-danger: #e02e2a;
  display: grid; grid-template-columns: 260px minmax(0, 1fr); height: var(--bb-p-height, 100%); min-height: 460px; width: 100%;
  background: var(--gp-bg); color: var(--gp-text); overflow: hidden; position: relative; font-size: 14px; line-height: 1.5;
  transition: grid-template-columns 300ms var(--bb-ease);
}
.bb-gp[data-theme="dark"] {
  --gp-bg: #212121; --gp-side: #171717; --gp-hover: #262626; --gp-active: #2f2f2f; --gp-text: #ececec; --gp-muted: #b4b4b4;
  --gp-faint: #8e8e8e; --gp-line: rgba(255,255,255,.08); --gp-user: #303030; --gp-box: #303030; --gp-box-line: rgba(255,255,255,.08);
  --gp-pop: #353535; --gp-pop-line: rgba(255,255,255,.1); --gp-send: #ececec; --gp-send-ink: #0d0d0d; --gp-danger: #f87171;
}
.bb-gp.is-collapsed { grid-template-columns: 0 minmax(0, 1fr); }
.bb-gp button { font: inherit; color: inherit; }
.bb-gp-ib { appearance: none; border: 0; background: transparent; color: var(--gp-muted); width: 34px; height: 34px; border-radius: 8px;
  display: inline-grid; place-items: center; cursor: pointer; flex: none; transition: background-color 120ms, color 120ms; }
.bb-gp-ib:hover { background: var(--gp-hover); color: var(--gp-text); }
.bb-gp-ib:focus-visible, .bb-gp-row:focus-visible, .bb-gp-menu button:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: -2px; box-shadow: none; }
.bb-gp-ib.is-sm { width: 28px; height: 28px; border-radius: 7px; }

/* sidebar */
.bb-gp-side { background: var(--gp-side); min-width: 0; overflow: hidden; display: flex; }
.bb-gp.is-collapsed .bb-gp-side { visibility: hidden; }
.bb-gp-side-inner { width: 260px; flex: none; display: flex; flex-direction: column; height: 100%; }
.bb-gp-side-top { display: flex; align-items: center; gap: 8px; padding: 10px 8px 6px 14px; height: 52px; }
.bb-gp-side-top img { width: 24px; height: 24px; border-radius: 6px; object-fit: cover; }
.bb-gp-brand { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
.bb-gp-nav { padding: 2px 8px 6px; display: flex; flex-direction: column; gap: 1px; }
.bb-gp-row { appearance: none; border: 0; background: transparent; width: 100%; display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px;
  border-radius: 9px; cursor: pointer; text-align: left; font-size: 13.5px; color: var(--gp-text); transition: background-color 120ms; }
.bb-gp-row:hover { background: var(--gp-hover); }
.bb-gp-row svg { color: var(--gp-text); flex: none; }
.bb-gp-search { margin: 2px 8px 6px; position: relative; }
.bb-gp-search input { width: 100%; height: 34px; border: 1px solid var(--gp-line); border-radius: 9px; background: var(--gp-bg); color: var(--gp-text);
  font: inherit; font-size: 13.5px; padding: 0 10px 0 32px; outline: none; }
.bb-gp-search input:focus { border-color: var(--bb-accent); }
.bb-gp-search svg { position: absolute; left: 10px; top: 9px; color: var(--gp-faint); }
.bb-gp-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 12px; scrollbar-width: thin; scrollbar-color: var(--gp-line) transparent; }
.bb-gp-section { font-size: 12px; font-weight: 500; color: var(--gp-faint); padding: 14px 10px 6px; }
.bb-gp-item { position: relative; display: flex; align-items: center; border-radius: 9px; transition: background-color 120ms; }
.bb-gp-item:hover, .bb-gp-item.is-menu { background: var(--gp-hover); }
.bb-gp-item.is-active { background: var(--gp-active); }
.bb-gp-item-main { appearance: none; border: 0; background: transparent; flex: 1; min-width: 0; height: 36px; padding: 0 4px 0 10px; text-align: left; cursor: pointer;
  font-size: 13.5px; color: var(--gp-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-radius: 9px; display: flex; align-items: center; gap: 6px; }
.bb-gp-item-main span { overflow: hidden; text-overflow: ellipsis; }
.bb-gp-item-main svg { color: var(--gp-faint); flex: none; }
.bb-gp-more { opacity: 0; margin-right: 4px; }
.bb-gp-item:hover .bb-gp-more, .bb-gp-item.is-active .bb-gp-more, .bb-gp-item.is-menu .bb-gp-more, .bb-gp-more:focus-visible { opacity: 1; }
@media (hover: none) { .bb-gp-more { opacity: 1; } }
.bb-gp-rename { flex: 1; min-width: 0; height: 32px; margin: 2px; border: 1px solid var(--bb-accent); border-radius: 8px; background: var(--gp-bg);
  color: var(--gp-text); font: inherit; font-size: 13.5px; padding: 0 8px; outline: none; }
.bb-gp-menu { position: absolute; z-index: 30; min-width: 176px; padding: 6px; border-radius: 14px; background: var(--gp-pop); border: 1px solid var(--gp-pop-line);
  box-shadow: 0 10px 32px rgba(0,0,0,.14); animation: bb-c-pop-in 140ms var(--bb-ease) both; }
.bb-gp-menu button { appearance: none; border: 0; background: transparent; width: 100%; display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px;
  border-radius: 9px; cursor: pointer; font-size: 13.5px; color: var(--gp-text); text-align: left; }
.bb-gp-menu button:hover { background: var(--gp-hover); }
.bb-gp-menu button.is-danger { color: var(--gp-danger); }
.bb-gp-menu hr { border: 0; border-top: 1px solid var(--gp-line); margin: 4px 6px; }
.bb-gp-profile { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--gp-line); font-size: 13px; }
.bb-gp-profile b { font-weight: 500; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-gp-profile span { color: var(--gp-faint); font-size: 12px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-gp-empty-list { padding: 18px 12px; font-size: 13px; color: var(--gp-faint); }
.bb-gp-skel { height: 30px; margin: 6px 4px; border-radius: 8px; background: var(--gp-hover); animation: bb-c-shimmer 1.4s linear infinite; }

/* main */
.bb-gp-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; background: var(--gp-bg); }
.bb-gp-top { display: flex; align-items: center; gap: 4px; height: 52px; padding: 0 10px; flex: none; }
.bb-gp-title { flex: 1; min-width: 0; padding: 0 6px; font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-gp-scroll { flex: 1; min-height: 0; overflow-y: auto; scroll-behavior: smooth; position: relative; scrollbar-width: thin; scrollbar-color: var(--gp-line) transparent; }
.bb-gp-col { width: 100%; max-width: 768px; margin: 0 auto; padding: 0 24px; }
.bb-gp-log { display: flex; flex-direction: column; gap: 22px; padding: 18px 0 28px; }
.bb-gp-user { align-self: flex-end; max-width: 72%; background: var(--gp-user); border-radius: 20px; padding: 9px 16px; font-size: 15px; line-height: 1.55;
  white-space: pre-wrap; overflow-wrap: anywhere; animation: bb-c-msg-in 200ms var(--bb-ease) both; }
.bb-gp-bot { display: flex; gap: 14px; align-items: flex-start; animation: bb-c-msg-in 220ms var(--bb-ease) both; }
.bb-gp-bot-av { width: 28px; height: 28px; border-radius: 999px; flex: none; display: grid; place-items: center; border: 1px solid var(--gp-line); overflow: hidden; margin-top: 1px; }
.bb-gp-bot-av img { width: 100%; height: 100%; object-fit: cover; }
.bb-gp-bot-body { flex: 1; min-width: 0; font-size: 15px; line-height: 1.65; }
.bb-gp-bot-body .bb-md { font-size: 15px; line-height: 1.65; }
.bb-gp-bot-body .bb-md p { margin: 0 0 10px; }
.bb-gp-bot-body .bb-md li { margin: 3px 0; }
.bb-gp-bot.is-streaming .bb-md > :last-child::after { content: "\\25CF"; display: inline-block; margin-left: 4px; font-size: 11px; color: var(--gp-text);
  animation: bb-c-caret 1s steps(2, start) infinite; vertical-align: 1px; }
.bb-gp-bot.is-error .bb-gp-bot-body { color: var(--gp-danger); }
.bb-gp-actions { display: flex; align-items: center; gap: 2px; margin: 4px 0 0 -6px; opacity: 0; transition: opacity 140ms; }
.bb-gp-bot:hover .bb-gp-actions, .bb-gp-bot.is-last .bb-gp-actions, .bb-gp-actions:focus-within { opacity: 1; }
@media (hover: none) { .bb-gp-actions { opacity: 1; } }
.bb-gp-actions .bb-gp-ib { width: 30px; height: 30px; color: var(--gp-faint); }
.bb-gp-actions .bb-gp-ib:hover { color: var(--gp-text); }
.bb-gp-actions .bb-gp-ib[aria-pressed="true"] { color: var(--gp-text); }
.bb-gp-note { font-size: 12px; color: var(--gp-faint); margin-left: 6px; }
.bb-gp-bot-body .bb-c-sources { margin: 6px 0 0; }

/* empty state */
.bb-gp-hero { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 0 48px; animation: bb-c-msg-in 300ms var(--bb-ease) both; }
.bb-gp-hero h2 { margin: 0 0 22px; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; text-align: center; line-height: 1.25; }
.bb-gp-hero .bb-gp-composer { width: 100%; padding: 0; }
.bb-gp-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 16px; }
.bb-gp-chip { appearance: none; border: 1px solid var(--gp-line); background: var(--gp-bg); border-radius: 999px; height: 36px; padding: 0 14px;
  display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gp-muted); cursor: pointer; transition: background-color 120ms, color 120ms; }
.bb-gp-chip:hover { background: var(--gp-hover); color: var(--gp-text); }
.bb-gp-chip svg { color: var(--bb-accent); }

/* composer (text and voice share the same box) */
.bb-gp-composer { flex: none; padding: 0 0 10px; position: relative; }
.bb-gp-box { border: 1px solid var(--gp-box-line); background: var(--gp-box); border-radius: 26px; padding: 8px 8px 8px 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04); transition: border-color 140ms, box-shadow 140ms; }
.bb-gp-box:focus-within { border-color: color-mix(in srgb, var(--bb-accent) 45%, var(--gp-box-line)); box-shadow: 0 2px 14px rgba(0,0,0,.06); }
.bb-gp-box textarea { display: block; width: 100%; border: 0; outline: none; resize: none; background: transparent; color: var(--gp-text); font: inherit;
  font-size: 15px; line-height: 1.5; padding: 6px 8px 4px; min-height: 30px; max-height: 200px; overflow-y: auto; }
.bb-gp-box textarea::placeholder { color: var(--gp-faint); }
.bb-gp-box textarea:focus-visible { box-shadow: none; }
.bb-gp-bar { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.bb-gp-bar .bb-gp-ib { border-radius: 999px; }
.bb-gp-spacer { flex: 1; }
.bb-gp-send { appearance: none; border: 0; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; cursor: pointer; flex: none;
  background: var(--gp-send); color: var(--gp-send-ink); transition: opacity 120ms, transform 80ms; }
.bb-gp-send:active:not(:disabled) { transform: scale(.94); }
.bb-gp-send:disabled { background: var(--gp-active); color: var(--gp-faint); cursor: default; }
.bb-gp-send.is-rec { background: var(--gp-danger); color: #fff; }
.bb-gp-rec { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gp-muted); padding-left: 6px; font-variant-numeric: tabular-nums; }
.bb-gp-rec i { width: 8px; height: 8px; border-radius: 999px; background: var(--gp-danger); animation: bb-c-pulse 1.2s ease-in-out infinite; }
.bb-gp-wave { display: inline-flex; align-items: center; gap: 2px; height: 18px; }
.bb-gp-wave b { width: 3px; border-radius: 2px; background: var(--gp-muted); animation: bb-gp-wave 900ms ease-in-out infinite; }
.bb-gp-wave b:nth-child(2) { animation-delay: .15s; } .bb-gp-wave b:nth-child(3) { animation-delay: .3s; } .bb-gp-wave b:nth-child(4) { animation-delay: .45s; } .bb-gp-wave b:nth-child(5) { animation-delay: .6s; }
@keyframes bb-gp-wave { 0%, 100% { height: 4px; } 50% { height: 16px; } }
.bb-gp-plus-menu { left: 6px; bottom: calc(100% + 6px); }
.bb-gp-foot { font-size: 11.5px; color: var(--gp-faint); text-align: center; padding: 8px 0 2px; }
.bb-gp-jump { position: sticky; bottom: 10px; margin: -44px auto 0; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 999px;
  border: 1px solid var(--gp-line); background: var(--gp-bg); color: var(--gp-muted); cursor: pointer; z-index: 3; }
.bb-gp .bb-c-alert { margin: 0 0 8px; }

/* confirm dialog */
.bb-gp-dialog-wrap { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(0,0,0,.32); animation: bb-c-fade-in 160ms both; }
.bb-gp-dialog { width: min(400px, calc(100% - 32px)); background: var(--gp-pop); border-radius: 18px; padding: 20px 20px 16px; box-shadow: 0 20px 60px rgba(0,0,0,.25);
  animation: bb-c-pop-in 180ms var(--bb-ease) both; }
.bb-gp-dialog h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.bb-gp-dialog p { margin: 0; font-size: 13.5px; color: var(--gp-muted); line-height: 1.5; overflow-wrap: anywhere; }
.bb-gp-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.bb-gp-btn { appearance: none; border: 1px solid var(--gp-line); background: transparent; height: 36px; padding: 0 16px; border-radius: 999px; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.bb-gp-btn:hover { background: var(--gp-hover); }
.bb-gp-btn.is-danger { background: var(--gp-danger); border-color: transparent; color: #fff; }
.bb-gp-btn.is-danger:hover { filter: brightness(.95); }

.bb-gp-scrim { display: none; }
.bb-gp:not(.is-collapsed) .bb-gp-toggle { display: none; }
@media (max-width: 860px) {
  .bb-gp, .bb-gp.is-collapsed { grid-template-columns: minmax(0, 1fr); }
  .bb-gp .bb-gp-toggle { display: inline-grid !important; }
  .bb-gp-side { position: absolute; top: 0; bottom: 0; left: 0; width: 280px; max-width: 86%; z-index: 20; transform: translateX(-102%); visibility: hidden; transition: transform 300ms var(--bb-ease), visibility 300ms; }
  .bb-gp.is-drawer .bb-gp-side { transform: none; visibility: visible; box-shadow: 0 12px 40px rgba(0,0,0,.2); }
  .bb-gp-side-inner { width: 100%; }
  .bb-gp.is-drawer .bb-gp-scrim { display: block; position: absolute; inset: 0; background: rgba(0,0,0,.3); z-index: 15; }
  .bb-gp-col { padding: 0 14px; }
  .bb-gp-user { max-width: 86%; }
  .bb-gp-hero h2 { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .bb-gp *, .bb-gp { animation-duration: 1ms !important; transition-duration: 1ms !important; } }
`;

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const isNarrow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches;

/** Close a popover on outside click / Escape. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open, ref, onClose]);
}

/* ------------------------------------------------------------------ */
/* History item with ⋯ menu (pin / rename / delete)                    */
/* ------------------------------------------------------------------ */

function HistoryItem({
  session,
  active,
  onSelect,
  onPin,
  onRename,
  onDelete
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onPin: (pinned: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title || '');
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenu(false), []);
  useDismiss(menu, wrap, close);
  const title = session.title || 'New chat';

  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== session.title) onRename(value);
  };

  return (
    <div ref={wrap} className={`bb-gp-item${active ? ' is-active' : ''}${menu ? ' is-menu' : ''}`}>
      {editing ? (
        <input
          className="bb-gp-rename"
          value={draft}
          autoFocus
          maxLength={120}
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(session.title || '');
              setEditing(false);
            }
          }}
        />
      ) : (
        <>
          <button type="button" className="bb-gp-item-main" onClick={onSelect} aria-current={active ? 'page' : undefined} title={title}>
            <span>{title}</span>
          </button>
          <button
            type="button"
            className="bb-gp-ib is-sm bb-gp-more"
            aria-label={`Options for ${title}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <ChatIcon name="more" size={16} />
          </button>
        </>
      )}
      {menu ? (
        <div className="bb-gp-menu" role="menu" style={{ right: 4, top: 34 }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onPin(!session.pinned);
            }}
          >
            <ChatIcon name="pin" size={16} />
            {session.pinned ? 'Unpin chat' : 'Pin chat'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setDraft(session.title || '');
              setEditing(true);
            }}
          >
            <ChatIcon name="pencil" size={16} />
            Rename
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            className="is-danger"
            onClick={() => {
              setMenu(false);
              onDelete();
            }}
          >
            <ChatIcon name="trash" size={16} />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer: text and voice in the same box                            */
/* ------------------------------------------------------------------ */

function PanelComposer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  busy,
  placeholder,
  showFileUpload,
  showImageUpload,
  showVoice,
  recording,
  onVoice,
  onFile,
  onImage,
  inputRef,
  footnote
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  busy: boolean;
  placeholder: string;
  showFileUpload?: boolean;
  showImageUpload?: boolean;
  showVoice?: boolean;
  recording: boolean;
  onVoice: () => void;
  onFile: (f: File) => void;
  onImage: (f: File) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  footnote?: boolean;
}) {
  const [plus, setPlus] = useState(false);
  const [secs, setSecs] = useState(0);
  const plusRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const closePlus = useCallback(() => setPlus(false), []);
  useDismiss(plus, plusRef, closePlus);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '30px';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value, inputRef]);

  useEffect(() => {
    if (!recording) {
      setSecs(0);
      return undefined;
    }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const canSend = value.trim().length > 0 && !busy;
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };
  const hasPlus = showFileUpload || showImageUpload;

  return (
    <div className="bb-gp-composer">
      <div className="bb-gp-box">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder={recording ? 'Listening…' : placeholder}
          aria-label="Message"
          disabled={recording}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="bb-gp-bar">
          {hasPlus ? (
            <div ref={plusRef} style={{ position: 'relative' }}>
              <button type="button" className="bb-gp-ib" aria-label="Add files and more" aria-haspopup="menu" aria-expanded={plus} onClick={() => setPlus((p) => !p)} title="Add files">
                <ChatIcon name="plus" size={18} strokeWidth={1.9} />
              </button>
              {plus ? (
                <div className="bb-gp-menu bb-gp-plus-menu" role="menu">
                  {showFileUpload ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlus(false);
                        fileRef.current?.click();
                      }}
                    >
                      <ChatIcon name="paperclip" size={16} />
                      Upload a file
                    </button>
                  ) : null}
                  {showImageUpload ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlus(false);
                        imageRef.current?.click();
                      }}
                    >
                      <ChatIcon name="image" size={16} />
                      Upload an image
                    </button>
                  ) : null}
                </div>
              ) : null}
              <input ref={fileRef} type="file" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }} />
              <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImage(f);
                e.target.value = '';
              }} />
            </div>
          ) : null}
          {recording ? (
            <span className="bb-gp-rec" role="status">
              <i />
              {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
              <span className="bb-gp-wave" aria-hidden="true">
                <b /><b /><b /><b /><b />
              </span>
            </span>
          ) : null}
          <span className="bb-gp-spacer" />
          {showVoice && !streaming && !value.trim() && !recording ? (
            <button type="button" className="bb-gp-ib" onClick={onVoice} aria-label="Record a voice message" title="Voice message">
              <ChatIcon name="mic" size={18} />
            </button>
          ) : null}
          {streaming ? (
            <button type="button" className="bb-gp-send" onClick={onStop} aria-label="Stop generating" title="Stop">
              <ChatIcon name="stop" size={14} />
            </button>
          ) : recording ? (
            <button type="button" className="bb-gp-send is-rec" onClick={onVoice} aria-label="Stop and send voice message" title="Send voice message">
              <ChatIcon name="arrowUp" size={18} strokeWidth={2.2} />
            </button>
          ) : (
            <button type="button" className="bb-gp-send" onClick={onSend} disabled={!canSend} aria-label="Send message" title="Send">
              <ChatIcon name="arrowUp" size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
      {footnote ? <div className="bb-gp-foot">AI can make mistakes. Check important info.</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function PanelMessages({
  messages,
  botAvatar,
  showFeedback,
  canRate,
  title,
  onCopy,
  onFeedback
}: {
  messages: ChatMessage[];
  botAvatar?: string;
  showFeedback: boolean;
  canRate: boolean;
  title: string;
  onCopy: (m: ChatMessage) => void;
  onFeedback: (m: ChatMessage, r: 'up' | 'down') => void;
}) {
  const lastBot = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role !== 'user') return messages[i].id;
    return null;
  }, [messages]);
  return (
    <div className="bb-gp-log" role="log" aria-label="Conversation">
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="bb-gp-user">
              <span className="bb-c-sr">You said: </span>
              {m.text}
            </div>
          );
        }
        const pending = m.status === 'pending';
        const streaming = m.status === 'streaming';
        const busy = pending || streaming;
        return (
          <div key={m.id} className={`bb-gp-bot${streaming ? ' is-streaming' : ''}${m.status === 'error' ? ' is-error' : ''}${m.id === lastBot ? ' is-last' : ''}`} aria-busy={busy || undefined}>
            <span className="bb-gp-bot-av" aria-hidden="true">
              {botAvatar ? <img src={botAvatar} alt="" /> : <BrainboxLogo size={18} />}
            </span>
            <div className="bb-gp-bot-body">
              <span className="bb-c-sr">Assistant said: </span>
              {pending ? <TypingIndicator /> : <MessageContent text={m.text} />}
              {!busy && m.sources && m.sources.length ? <Sources sources={m.sources} /> : null}
              {!busy && m.text ? (
                <div className="bb-gp-actions">
                  <button type="button" className="bb-gp-ib" onClick={() => onCopy(m)} aria-label="Copy" title="Copy">
                    <ChatIcon name="copy" size={16} />
                  </button>
                  {showFeedback && canRate && m.status !== 'error' ? (
                    <>
                      <button type="button" className="bb-gp-ib" onClick={() => onFeedback(m, 'up')} aria-label="Good response" aria-pressed={m.feedback === 'up'} title="Good response">
                        <ChatIcon name="thumbUp" size={16} />
                      </button>
                      <button type="button" className="bb-gp-ib" onClick={() => onFeedback(m, 'down')} aria-label="Bad response" aria-pressed={m.feedback === 'down'} title="Bad response">
                        <ChatIcon name="thumbDown" size={16} />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="bb-gp-ib"
                    aria-label="Save as PDF"
                    title="Save as PDF"
                    onClick={(e) => saveAnswerAsPdf((e.currentTarget.closest('.bb-gp-bot-body') as HTMLElement | null)?.querySelector('.bb-md') as HTMLElement | null, title)}
                  >
                    <ChatIcon name="filePdf" size={16} />
                  </button>
                  {m.status === 'stopped' ? <span className="bb-gp-note">Stopped</span> : null}
                  {m.status === 'error' ? <span className="bb-gp-note">Interrupted</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function ChatPanel({
  sdk,
  primaryColor,
  accentColor,
  backgroundColor,
  height,
  mode = 'light',
  sounds = true,
  headerText,
  sidebarTitle,
  newChatButtonText = 'New chat',
  searchPlaceholder = 'Search chats',
  placeholder,
  initialSessionId,
  persistSession = true,
  defaultSidebarCollapsed = false,
  data,
  manualData,
  logoUrl,
  logoText,
  companyName,
  companyDescription,
  avatarGifUrl,
  user,
  bot,
  showExportButton = true,
  showFileUpload = true,
  showImageUpload = true,
  showVoiceInput = true,
  showFeedback = true
}: ChatPanelProps) {
  useInjectedStyle(CHAT_STYLE_ID, CHAT_CSS);
  useInjectedStyle(PANEL_STYLE_ID, PANEL_CSS);
  const [themeChoice, setThemeChoice] = useState<BrainboxColorMode>(mode);
  useEffect(() => setThemeChoice(mode), [mode]);
  const theme = useResolvedMode(themeChoice);
  const [collapsed, setCollapsed] = useState(defaultSidebarCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ChatSession | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { soundOn, toggleSound, play } = useSoundPreference(sounds);
  const { toasts, push, dismiss, pause, resume } = useToasts();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sdkUser = useMemo(() => {
    try {
      return sdk.getUserProfile?.() || null;
    } catch {
      return null;
    }
  }, [sdk]);

  const ui = useMemo(() => {
    const merged = mergeData(defaultChatPanelData, (manualData || data) as Record<string, any> | undefined);
    const person = { ...(merged.user || {}), ...(sdkUser || {}), ...(user || {}) };
    const botInfo = { ...(merged.bot || {}), ...(bot || {}) };
    const brandName = sidebarTitle || companyName || logoText || merged.brand?.workspaceName || merged.brand?.name || '';
    const first = (merged.brand?.greetingName || person.firstName || person.name || '').split(/\s+/)[0] || '';
    const vars = { name: first, botName: botInfo.name || brandName };
    return {
      brandName,
      logo: logoUrl || merged.brand?.logoUrl || '',
      person,
      botName: botInfo.name || brandName || 'Assistant',
      botAvatar: avatarGifUrl || botInfo.avatarUrl || logoUrl || '',
      hello: merged.greeting ? interpolate(merged.greeting, vars) : headerText || (first ? `${timeGreeting()}, ${first}. What can I help with?` : 'What can I help with?'),
      sub: companyDescription || '',
      cards: merged.promptCards || [],
      placeholder: placeholder || merged.composer?.placeholder || 'Ask anything'
    };
  }, [avatarGifUrl, bot, companyDescription, companyName, data, headerText, logoText, logoUrl, manualData, placeholder, sdkUser, sidebarTitle, user]);

  const chat = useBrainboxChat(sdk, initialSessionId, {
    persistSession,
    userKey: ui.person.email || ui.person.username || undefined,
    onReply: (m) => {
      play('receive');
      setAnnouncement(`${ui.botName}: ${m.text.slice(0, 280)}`);
    },
    onError: (msg) => {
      play('error');
      push({ tone: 'error', title: 'Something went wrong', body: msg, action: { label: 'Retry', onClick: () => void chat.retry() } });
    }
  });

  useEffect(() => {
    if (!chat.sessionsLoaded && !chat.sessionsLoading) void chat.refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);

  const scroll = useAutoScroll([chat.messages]);
  const hasMessages = chat.messages.length > 0;
  const activeTitle = useMemo(() => {
    const s = (chat.sessions || []).find((x) => x.session_id === chat.sessionId);
    if (s?.title) return s.title;
    const firstUser = chat.messages.find((m) => m.role === 'user');
    return firstUser ? firstUser.text.slice(0, 60) : 'New chat';
  }, [chat.messages, chat.sessionId, chat.sessions]);

  const { pinned, others } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (chat.sessions || []).filter((s) => !q || (s.title || '').toLowerCase().includes(q));
    const byNew = (a: ChatSession, b: ChatSession) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    return { pinned: list.filter((s) => s.pinned), others: list.filter((s) => !s.pinned).sort(byNew) };
  }, [chat.sessions, query]);

  const send = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || chat.loading) return;
    setInput('');
    play('send');
    void chat.sendMessage(value);
    scroll.scrollToBottom(false);
  };

  const onCopy = async (m: ChatMessage) => {
    const ok = await copyText(m.text);
    push(ok ? { tone: 'success', title: 'Copied' } : { tone: 'error', title: 'Couldn’t copy' });
  };

  const onFeedback = async (m: ChatMessage, rating: 'up' | 'down') => {
    try {
      await chat.sendFeedback(m.id, rating);
      push({ tone: 'success', title: 'Thanks for the feedback' });
    } catch (err: any) {
      play('error');
      push({ tone: 'error', title: 'Feedback not sent', body: err?.message });
    }
  };

  const voice = useVoiceRecorder(
    (blob) => void chat.sendVoiceNote(blob),
    (msg) => {
      play('error');
      push({ tone: 'error', title: 'Microphone unavailable', body: msg });
    }
  );

  const toggleSidebar = () => {
    if (isNarrow()) setDrawer((d) => !d);
    else setCollapsed((c) => !c);
  };

  const newChat = () => {
    void chat.createSession();
    setInput('');
    setDrawer(false);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const style = {
    '--bb-accent': primaryColor || '#2563eb',
    ...(accentColor ? { '--gp-text': accentColor } : {}),
    ...(backgroundColor && theme === 'light' ? { '--gp-bg': backgroundColor } : {}),
    ...(height ? { '--bb-p-height': height } : {})
  } as CSSProperties;

  const composer = (footnote: boolean) => (
    <PanelComposer
      value={input}
      onChange={setInput}
      onSend={() => send()}
      onStop={chat.stop}
      streaming={chat.loading}
      busy={chat.loading}
      placeholder={ui.placeholder}
      showFileUpload={showFileUpload}
      showImageUpload={showImageUpload}
      showVoice={showVoiceInput}
      recording={voice.recording}
      onVoice={() => void voice.toggle()}
      onFile={(f) => void chat.uploadFile(f)}
      onImage={(f) => void chat.uploadImage(f)}
      inputRef={inputRef}
      footnote={footnote}
    />
  );

  const renderItem = (s: ChatSession) => (
    <HistoryItem
      key={s.session_id}
      session={s}
      active={s.session_id === chat.sessionId}
      onSelect={() => {
        setDrawer(false);
        void chat.loadSession(s.session_id);
      }}
      onPin={(p) => {
        void chat.pinSession(s.session_id, p);
        push({ tone: 'success', title: p ? 'Chat pinned' : 'Chat unpinned' });
      }}
      onRename={(t) => void chat.renameSession(s.session_id, t)}
      onDelete={() => setConfirmDelete(s)}
    />
  );

  return (
    <div
      className={`bb-c bb-gp${collapsed ? ' is-collapsed' : ''}${drawer ? ' is-drawer' : ''}`}
      data-theme={theme}
      data-session-id={chat.sessionId || ''}
      style={style}
    >
      <div className="bb-c-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <aside className="bb-gp-side" aria-label="Chat history" aria-hidden={collapsed && !drawer ? true : undefined}>
        <div className="bb-gp-side-inner">
          <div className="bb-gp-side-top">
            {ui.logo ? <img src={ui.logo} alt="" /> : <BrainboxLogo size={24} />}
            <span className="bb-gp-brand">{ui.brandName || 'Brainbox'}</span>
            <button type="button" className="bb-gp-ib" onClick={toggleSidebar} aria-label="Close sidebar" title="Close sidebar">
              <ChatIcon name="sidebar" size={18} />
            </button>
          </div>
          <div className="bb-gp-nav">
            <button type="button" className="bb-gp-row" onClick={newChat}>
              <ChatIcon name="compose" size={17} />
              {newChatButtonText}
            </button>
            <button type="button" className="bb-gp-row" onClick={() => setSearching((s) => !s)} aria-expanded={searching}>
              <ChatIcon name="search" size={17} />
              {searchPlaceholder}
            </button>
          </div>
          {searching ? (
            <label className="bb-gp-search">
              <span className="bb-c-sr">Search chats</span>
              <ChatIcon name="search" size={15} />
              <input type="search" autoFocus placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          ) : null}
          <nav className="bb-gp-list" aria-label="Chats">
            {chat.sessionsLoading && !(chat.sessions || []).length ? (
              <div aria-busy="true">
                <div className="bb-gp-skel" />
                <div className="bb-gp-skel" />
                <div className="bb-gp-skel" />
              </div>
            ) : (
              <>
                {pinned.length ? (
                  <div role="group" aria-label="Pinned">
                    <div className="bb-gp-section">Pinned</div>
                    {pinned.map(renderItem)}
                  </div>
                ) : null}
                {others.length ? (
                  <div role="group" aria-label="Chats">
                    <div className="bb-gp-section">Chats</div>
                    {others.map(renderItem)}
                  </div>
                ) : null}
                {!pinned.length && !others.length ? (
                  <div className="bb-gp-empty-list">{query ? 'No chats match your search.' : 'Your chats will appear here.'}</div>
                ) : null}
              </>
            )}
          </nav>
          {ui.person.name || ui.person.email ? (
            <div className="bb-gp-profile">
              <PersonAvatar name={ui.person.name || ui.person.email} src={ui.person.avatarUrl} size={28} />
              <div style={{ minWidth: 0 }}>
                <b>{ui.person.name || ui.person.email}</b>
                {ui.person.name && ui.person.email ? <span>{ui.person.email}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="bb-gp-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <main className="bb-gp-main">
        <header className="bb-gp-top">
          <button type="button" className="bb-gp-ib bb-gp-toggle" onClick={toggleSidebar} aria-label="Open sidebar" title="Open sidebar">
            <ChatIcon name="sidebar" size={18} />
          </button>
          {collapsed ? (
            <button type="button" className="bb-gp-ib" onClick={newChat} aria-label={newChatButtonText} title={newChatButtonText}>
              <ChatIcon name="compose" size={18} />
            </button>
          ) : null}
          <h1 className="bb-gp-title">{hasMessages ? activeTitle : ui.botName}</h1>
          <button
            type="button"
            className="bb-gp-ib"
            onClick={() => setThemeChoice(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <ChatIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          {sounds ? (
            <button type="button" className="bb-gp-ib" onClick={toggleSound} aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'} aria-pressed={!soundOn} title={soundOn ? 'Sounds on' : 'Sounds off'}>
              <ChatIcon name={soundOn ? 'volume' : 'volumeOff'} size={18} />
            </button>
          ) : null}
          {showExportButton ? (
            <button type="button" className="bb-gp-ib" onClick={() => saveAnswerAsPdf(scroll.ref.current?.querySelector('.bb-gp-log') as HTMLElement | null, activeTitle)} disabled={!hasMessages} aria-label="Save chat as PDF" title="Save chat as PDF">
              <ChatIcon name="download" size={18} />
            </button>
          ) : null}
        </header>

        <div className="bb-gp-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
          {!hasMessages && !chat.loading ? (
            <div className="bb-gp-col bb-gp-hero">
              <h2>{ui.hello}</h2>
              {ui.sub ? <p style={{ margin: '-12px 0 18px', color: 'var(--gp-muted)', fontSize: 14 }}>{ui.sub}</p> : null}
              {composer(false)}
              {ui.cards.length ? (
                <div className="bb-gp-chips">
                  {ui.cards.map((card) => (
                    <button key={card.title} type="button" className="bb-gp-chip" onClick={() => send(card.prompt || card.title)} title={card.description}>
                      <ChatIcon name={card.icon || 'sparkles'} size={15} />
                      {card.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bb-gp-col">
              <PanelMessages
                messages={chat.messages}
                botAvatar={ui.botAvatar}
                showFeedback={showFeedback}
                canRate={!!chat.sessionId}
                title={activeTitle}
                onCopy={onCopy}
                onFeedback={onFeedback}
              />
            </div>
          )}
          {scroll.showJump ? (
            <button type="button" className="bb-gp-jump" onClick={() => scroll.scrollToBottom()} aria-label="Scroll to latest message">
              <ChatIcon name="arrowDown" size={16} />
            </button>
          ) : null}
        </div>

        {hasMessages || chat.loading ? (
          <div className="bb-gp-col">
            {chat.error && !chat.loading ? (
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
            {composer(true)}
          </div>
        ) : null}
        <div className="bb-gp-col" style={{ position: 'relative' }}>
          <ToastStack toasts={toasts} dismiss={dismiss} pause={pause} resume={resume} />
        </div>
      </main>

      {confirmDelete ? (
        <div className="bb-gp-dialog-wrap" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="bb-gp-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bb-gp-del-t" aria-describedby="bb-gp-del-d">
            <h3 id="bb-gp-del-t">Delete chat?</h3>
            <p id="bb-gp-del-d">
              This will delete <b>{confirmDelete.title || 'this chat'}</b> from your history.
            </p>
            <div className="bb-gp-dialog-actions">
              <button type="button" className="bb-gp-btn" onClick={() => setConfirmDelete(null)} autoFocus>
                Cancel
              </button>
              <button
                type="button"
                className="bb-gp-btn is-danger"
                onClick={() => {
                  const s = confirmDelete;
                  setConfirmDelete(null);
                  void chat.deleteSession(s.session_id);
                  push({ tone: 'success', title: 'Chat deleted' });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ChatPanel;
