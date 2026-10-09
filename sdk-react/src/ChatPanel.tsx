'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useBrainboxChat } from './useBrainboxChat';
import { BrainboxLogo } from './design/Logo';
import {
  CHAT_CSS,
  CHAT_STYLE_ID,
  ChatIcon,
  Composer,
  MessageList,
  PersonAvatar,
  SessionList,
  ToastStack,
  brandStyle,
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
import type { BrainboxColorMode, ChatMessage, ChatPanelProps, ChatUiData } from './types';

/** Default copy. Override any field with `data` / `manualData`. No demo content. */
export const defaultChatPanelData: ChatUiData = {
  brand: { name: '', workspaceName: '', greetingName: '' },
  user: { name: '', email: '', avatarUrl: '' },
  bot: { name: 'Assistant' },
  greeting: '',
  composer: { placeholder: 'Message…' },
  promptCards: [
    { icon: 'sparkles', title: 'What can you do?', description: 'See how the assistant can help you.', prompt: 'What can you help me with?' },
    { icon: 'book', title: 'Getting started', description: 'Walk me through the basics.', prompt: 'How do I get started?' },
    { icon: 'wrench', title: 'Troubleshoot', description: 'Help me fix a problem I’m having.', prompt: 'I have a problem I need help with.' },
    { icon: 'doc', title: 'Policies & docs', description: 'Find an answer in the documentation.', prompt: 'Where can I find your policies and documentation?' }
  ]
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const isNarrow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 860px)').matches;

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
  searchPlaceholder = 'Search',
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
  const [themeChoice, setThemeChoice] = useState<BrainboxColorMode>(mode);
  useEffect(() => setThemeChoice(mode), [mode]);
  const theme = useResolvedMode(themeChoice);
  const [collapsed, setCollapsed] = useState(defaultSidebarCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
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
      hello: merged.greeting ? interpolate(merged.greeting, vars) : first ? `${timeGreeting()}, ${first}` : timeGreeting(),
      sub: headerText || companyDescription || 'How can I help you today?',
      cards: merged.promptCards || [],
      placeholder: placeholder || merged.composer?.placeholder || 'Message…'
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

  // The sidebar is visible, so the session list is "needed" right away.
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
    return firstUser ? firstUser.text.slice(0, 60) : 'New conversation';
  }, [chat.messages, chat.sessionId, chat.sessions]);

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
    ...brandStyle({ primaryColor, accentColor, backgroundColor }),
    ...(height ? { '--bb-p-height': height } : {})
  } as CSSProperties;

  const sidebarHidden = collapsed;

  return (
    <div
      className={`bb-c bb-p${collapsed ? ' is-collapsed' : ''}${drawer ? ' is-drawer' : ''}`}
      data-theme={theme}
      data-session-id={chat.sessionId || ''}
      style={style}
    >
      <div className="bb-c-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <aside className="bb-p-side" aria-label="Conversations sidebar" aria-hidden={sidebarHidden && !drawer ? true : undefined}>
        <div className="bb-p-side-inner">
          <div className="bb-p-brand">
            {ui.logo ? <img src={ui.logo} alt="" /> : <BrainboxLogo size={28} />}
            <span className="bb-p-brand-name">{ui.brandName || 'Brainbox'}</span>
            <button type="button" className="bb-c-iconbtn" onClick={toggleSidebar} aria-label="Hide sidebar" title="Hide sidebar">
              <ChatIcon name="sidebar" size={18} />
            </button>
          </div>
          <div className="bb-p-side-actions">
            <button type="button" className="bb-c-btn bb-c-btn-secondary bb-p-new" onClick={newChat}>
              <ChatIcon name="compose" size={16} />
              {newChatButtonText}
            </button>
            <label className="bb-c-search">
              <span className="bb-c-sr">Search conversations</span>
              <ChatIcon name="search" size={15} />
              <input type="search" placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className="bb-p-side-scroll">
            <SessionList
              sessions={chat.sessions || []}
              activeId={chat.sessionId}
              loading={chat.sessionsLoading}
              query={query}
              onSelect={(id) => {
                setDrawer(false);
                void chat.loadSession(id);
              }}
            />
          </div>
          {ui.person.name || ui.person.email ? (
            <div className="bb-p-profile">
              <PersonAvatar name={ui.person.name || ui.person.email} src={ui.person.avatarUrl} size={28} />
              <div style={{ minWidth: 0 }}>
                <div className="bb-p-profile-name">{ui.person.name || ui.person.email}</div>
                {ui.person.name && ui.person.email ? <div className="bb-p-profile-email">{ui.person.email}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="bb-p-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <main className="bb-p-main">
        <header className="bb-p-top">
          <button
            type="button"
            className="bb-c-iconbtn bb-p-toggle"
            onClick={toggleSidebar}
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <ChatIcon name="sidebar" size={18} />
          </button>
          {collapsed ? (
            <button type="button" className="bb-c-iconbtn" onClick={newChat} aria-label={newChatButtonText} title={newChatButtonText}>
              <ChatIcon name="compose" size={18} />
            </button>
          ) : null}
          <h1 className="bb-p-top-title">{hasMessages ? activeTitle : ui.brandName || 'New conversation'}</h1>
          <button
            type="button"
            className="bb-c-iconbtn"
            onClick={() => setThemeChoice(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <ChatIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
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
          {showExportButton ? (
            <button type="button" className="bb-c-btn bb-c-btn-secondary" onClick={() => void chat.exportChat('json')} disabled={!hasMessages}>
              <ChatIcon name="download" size={15} />
              <span className="bb-c-btn-label">Export</span>
            </button>
          ) : null}
        </header>

        <div className="bb-c-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
          {!hasMessages && !chat.loading ? (
            <div className="bb-p-empty" style={{ minHeight: '100%' }}>
              {ui.logo ? <img className="bb-p-empty-logo" src={ui.logo} alt="" /> : <BrainboxLogo size={56} />}
              <h2 className="bb-p-hello">{ui.hello}</h2>
              <p className="bb-p-sub">{ui.sub}</p>
              {ui.cards.length ? (
                <div className="bb-p-cards">
                  {ui.cards.map((card) => (
                    <button key={card.title} type="button" className="bb-p-card" onClick={() => send(card.prompt || card.title)}>
                      <span className="bb-p-card-icon" aria-hidden="true">
                        <ChatIcon name={card.icon || 'sparkles'} size={16} />
                      </span>
                      <span>
                        <span className="bb-p-card-title">{card.title}</span>
                        {card.description ? <span className="bb-p-card-desc">{card.description}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bb-p-column">
              <MessageList
                messages={chat.messages}
                botName={ui.botName}
                botAvatar={ui.botAvatar}
                showFeedback={showFeedback}
                canRate={!!chat.sessionId}
                onCopy={onCopy}
                onFeedback={onFeedback}
              />
            </div>
          )}
          {scroll.showJump ? (
            <button type="button" className="bb-c-jump" onClick={() => scroll.scrollToBottom()} aria-label="Scroll to latest message">
              <ChatIcon name="arrowDown" size={16} />
            </button>
          ) : null}
        </div>

        <div className="bb-p-column">
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
          <ToastStack toasts={toasts} dismiss={dismiss} pause={pause} resume={resume} />
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
            showVoice={showVoiceInput}
            recording={voice.recording}
            onVoice={() => void voice.toggle()}
            onFile={(f) => void chat.uploadFile(f)}
            onImage={(f) => void chat.uploadImage(f)}
            inputRef={inputRef}
          />
        </div>
      </main>
    </div>
  );
}

export default ChatPanel;
