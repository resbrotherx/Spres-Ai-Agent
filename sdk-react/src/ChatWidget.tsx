'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useBrainboxChat } from './useBrainboxChat';
import { BrainboxLogo } from './design/Logo';
import {
  BotAvatar,
  CHAT_CSS,
  CHAT_STYLE_ID,
  ChatIcon,
  Composer,
  MessageList,
  SessionList,
  ToastStack,
  brandStyle,
  copyText,
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
import type { ChatMessage, ChatUiData, ChatWidgetProps } from './types';

/** Default copy. Override any field with `data` / `manualData`. No demo content. */
export const defaultChatWidgetData: ChatUiData = {
  brand: { name: '', subtitle: '', logoUrl: '' },
  bot: { name: 'Assistant', avatarUrl: '' },
  user: { name: '' },
  greeting: '',
  introMessages: [],
  quickActions: [
    { label: 'What can you help me with?', icon: 'sparkles' },
    { label: 'How do I get started?', icon: 'book' },
    { label: 'I have a problem', icon: 'wrench' }
  ],
  composer: { placeholder: 'Message…' }
};

type View = 'chat' | 'history';

export function ChatWidget({
  sdk,
  position = 'bottom-right',
  primaryColor,
  accentColor,
  backgroundColor,
  border,
  borderRadius,
  launcherType = 'icon',
  launcherGifUrl,
  buttonText = 'Chat',
  placeholder,
  width = '380px',
  height = '600px',
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
  showVoiceInput = false,
  showFileUpload = false,
  showImageUpload = false,
  showFeedback = true,
  initialSessionId,
  persistSession = true
}: ChatWidgetProps) {
  useInjectedStyle(CHAT_STYLE_ID, CHAT_CSS);
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
  const windowRef = useRef<HTMLElement>(null);
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
    const greeting = merged.greeting ? interpolate(merged.greeting, vars) : first ? `Hi ${first}` : 'Hi there';
    return {
      title,
      subtitle: companyDescription || merged.brand?.subtitle || 'Typically replies in seconds',
      logo: logoUrl || merged.brand?.logoUrl || '',
      botName: botInfo.name || title,
      botAvatar: avatarGifUrl || botInfo.avatarUrl || logoUrl || merged.brand?.logoUrl || '',
      person,
      greeting,
      welcomeSub: `Ask me anything — I’m here to help.`,
      intro: (merged.introMessages || []).map((m: string) => interpolate(m, vars)).filter(Boolean),
      actions: normalizeActions(merged.quickActions),
      placeholder: placeholder || merged.composer?.placeholder || 'Message…'
    };
  }, [avatarGifUrl, bot, companyDescription, companyName, data, headerText, logoText, logoUrl, manualData, placeholder, sdkUser, user]);

  const chat = useBrainboxChat(sdk, initialSessionId, {
    persistSession,
    open,
    userKey: ui.person.email || ui.person.username || undefined,
    onReply: (m) => {
      if (open) play('receive');
      else play('notify');
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

  const newChat = () => {
    void chat.createSession();
    setView('chat');
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const onKeyDownWindow = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (view === 'history') {
      setView('chat');
      setTimeout(() => inputRef.current?.focus(), 30);
    } else setOpen(false);
  };

  const isLeft = position.includes('left');
  const isTop = position.includes('top');
  const layerStyle: CSSProperties = { zIndex };
  if (position === 'center') {
    layerStyle.left = '50%';
    layerStyle.transform = 'translateX(-50%)';
    layerStyle.bottom = 24;
  } else {
    if (isTop) layerStyle.top = 24;
    else layerStyle.bottom = 24;
    if (isLeft) layerStyle.left = 24;
    else layerStyle.right = 24;
  }
  const rootStyle = {
    ...layerStyle,
    ...brandStyle({ primaryColor, accentColor, backgroundColor }),
    '--bb-w-width': width,
    '--bb-w-height': height,
    ...(borderRadius ? { '--bb-w-radius': borderRadius } : {}),
    ...(border ? { '--bb-w-border': border } : {})
  } as CSSProperties;

  const unread = chat.unreadCount;
  const hasMessages = chat.messages.length > 0;
  const canRate = !!chat.sessionId;

  const launcherLabel = open ? 'Close chat' : unread ? `Open chat, ${unread} unread ${unread === 1 ? 'reply' : 'replies'}` : 'Open chat';

  const launcher =
    !open && launcherType === 'gif' && launcherGifUrl ? (
      <button ref={launcherRef} type="button" className="bb-w-launcher is-gif" onClick={() => setOpen(true)} aria-label={launcherLabel}>
        <img src={launcherGifUrl} alt="" />
        {unread ? <span className="bb-w-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
    ) : !open && launcherType === 'button' ? (
      <button ref={launcherRef} type="button" className="bb-w-launcher is-pill" onClick={() => setOpen(true)} aria-label={launcherLabel}>
        <ChatIcon name="chat" size={20} />
        <span>{buttonText}</span>
        {unread ? <span className="bb-w-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
    ) : (
      <button
        ref={launcherRef}
        type="button"
        className="bb-w-launcher"
        onClick={() => setOpen(!open)}
        aria-label={launcherLabel}
        aria-expanded={open}
      >
        <span className="bb-w-launcher-icon" key={open ? 'open' : 'closed'}>
          <ChatIcon name={open ? 'chevronDown' : 'chat'} size={26} strokeWidth={open ? 2 : 1.75} />
        </span>
        {!open && unread ? <span className="bb-w-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
    );

  return (
    <div
      className={`bb-c bb-w${isLeft ? ' is-left' : ''}${isTop ? ' is-top' : ''}${position === 'center' ? ' is-center' : ''}${open ? ' is-open' : ''}`}
      data-theme={theme}
      style={rootStyle}
    >
      <div className="bb-c-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {open ? <div className="bb-w-scrim" onClick={() => setOpen(false)} aria-hidden="true" /> : null}
      {open ? (
        <section
          ref={windowRef}
          className={`bb-w-window${expanded ? ' is-expanded' : ''}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={onKeyDownWindow}
        >
          <header className="bb-c-header">
            {view === 'history' ? (
              <button
                type="button"
                className="bb-c-iconbtn"
                onClick={() => {
                  setView('chat');
                  setTimeout(() => inputRef.current?.focus(), 30);
                }}
                aria-label="Back to chat"
              >
                <ChatIcon name="chevronLeft" size={20} />
              </button>
            ) : ui.logo ? (
              <BotAvatar src={ui.logo} name={ui.title} />
            ) : (
              <span className="bb-c-avatar is-logo">
                <BrainboxLogo size={32} title={ui.title} />
              </span>
            )}
            <div className="bb-c-header-copy">
              <h2 className="bb-c-title" id={titleId}>
                {view === 'history' ? 'Conversations' : ui.title}
              </h2>
              {view === 'history' ? null : (
                <div className="bb-c-subtitle">
                  <span className="bb-c-dot" aria-hidden="true" />
                  <span>{chat.streaming ? 'Typing…' : ui.subtitle}</span>
                </div>
              )}
            </div>
            <div className="bb-c-header-actions">
              {view === 'chat' ? (
                <>
                  <button type="button" className="bb-c-iconbtn" onClick={newChat} aria-label="New conversation" title="New conversation">
                    <ChatIcon name="compose" size={18} />
                  </button>
                  <button type="button" className="bb-c-iconbtn" onClick={() => setView('history')} aria-label="Conversation history" title="History">
                    <ChatIcon name="history" size={18} />
                  </button>
                </>
              ) : null}
              {showExportButton && hasMessages && view === 'chat' ? (
                <button type="button" className="bb-c-iconbtn" onClick={() => void chat.exportChat('json')} aria-label="Export conversation" title="Export">
                  <ChatIcon name="download" size={18} />
                </button>
              ) : null}
              {sounds ? (
                <button
                  type="button"
                  className="bb-c-iconbtn"
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
                  aria-pressed={!soundOn}
                  title={soundOn ? 'Sounds on' : 'Sounds off'}
                >
                  <ChatIcon name={soundOn ? 'volume' : 'volumeOff'} size={18} />
                </button>
              ) : null}
              <button
                type="button"
                className="bb-c-iconbtn bb-w-expand"
                onClick={() => setExpanded((x) => !x)}
                aria-label={expanded ? 'Shrink window' : 'Expand window'}
                aria-pressed={expanded}
                title={expanded ? 'Shrink' : 'Expand'}
              >
                <ChatIcon name={expanded ? 'shrink' : 'expand'} size={16} />
              </button>
              <button type="button" className="bb-c-iconbtn" onClick={() => setOpen(false)} aria-label="Close chat" title="Close">
                <ChatIcon name="x" size={18} />
              </button>
            </div>
          </header>

          <div className="bb-w-body">
            {view === 'history' ? (
              <div className="bb-w-history">
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
                  }}
                />
              </div>
            ) : (
              <>
                <div className="bb-c-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
                  {!hasMessages && !chat.loading ? (
                    <div className="bb-c-welcome">
                      <div className="bb-c-welcome-logo">{ui.logo ? <img src={ui.logo} alt="" /> : <BrainboxLogo size={48} />}</div>
                      <h3 className="bb-c-greeting">{ui.greeting}</h3>
                      <p className="bb-c-welcome-sub">{ui.welcomeSub}</p>
                      {ui.intro.length ? (
                        <div className="bb-c-intro">
                          {ui.intro.map((m: string, i: number) => (
                            <div key={i} className="bb-c-bubble">
                              {m}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {ui.actions.length ? (
                        <div className="bb-c-chips">
                          {ui.actions.map((a) => (
                            <button key={a.label} type="button" className="bb-c-chip" onClick={() => send(a.prompt || a.label)}>
                              <ChatIcon name={a.icon || 'sparkles'} size={15} />
                              {a.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <MessageList
                      messages={chat.messages}
                      botName={ui.botName}
                      botAvatar={ui.botAvatar}
                      showFeedback={showFeedback}
                      canRate={canRate}
                      onCopy={onCopy}
                      onFeedback={onFeedback}
                    />
                  )}
                  {scroll.showJump ? (
                    <button type="button" className="bb-c-jump" onClick={() => scroll.scrollToBottom()} aria-label="Scroll to latest message">
                      <ChatIcon name="arrowDown" size={16} />
                    </button>
                  ) : null}
                </div>
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
              </>
            )}
            <ToastStack toasts={toasts} dismiss={dismiss} pause={pause} resume={resume} />
            {view === 'chat' && showVoiceInput ? (
              <div className="bb-c-seg" role="tablist" aria-label="Input mode">
                {(['chat', 'voice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
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
                    <ChatIcon name={m === 'chat' ? 'chat' : 'mic'} size={14} />
                    {m === 'chat' ? 'Chat' : 'Voice'}
                  </button>
                ))}
              </div>
            ) : null}
            {view === 'chat' && showVoiceInput && inputMode === 'voice' ? (
              <div className="bb-c-composer">
                <div className="bb-c-voice">
                  <button
                    type="button"
                    className={`bb-c-send${voice.recording ? ' is-recording' : ''}`}
                    onClick={() => void voice.toggle()}
                    aria-label={voice.recording ? 'Stop recording and send' : 'Start recording'}
                    aria-pressed={voice.recording}
                  >
                    <ChatIcon name={voice.recording ? 'stop' : 'mic'} size={22} />
                  </button>
                  <span className="bb-c-voice-label" role="status">
                    {voice.recording ? 'Recording… tap to send' : 'Tap to record a voice note'}
                  </span>
                </div>
              </div>
            ) : view === 'chat' ? (
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => send()}
                onStop={chat.stop}
                streaming={chat.loading}
                busy={chat.loading}
                placeholder={ui.placeholder}
                showFileUpload={showFileUpload}
                showImageUpload={showImageUpload}
                onFile={(f) => void chat.uploadFile(f)}
                onImage={(f) => void chat.uploadImage(f)}
                inputRef={inputRef}
                onEscape={() => setOpen(false)}
              />
            ) : null}
          </div>
        </section>
      ) : null}
      {launcher}
    </div>
  );
}

export default ChatWidget;
