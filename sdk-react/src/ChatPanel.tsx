import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainboxReactSDK } from './brainbox-sdk';
import { ChatPanelProps, ChatMessage } from './types';
import { useBrainboxChat } from './useBrainboxChat';

const sidebarStyle = {
  width: '220px',
  background: '#F8FAFC',
  borderRight: '1px solid #E2E8F0',
  padding: '16px',
  boxSizing: 'border-box' as const
};

const panelStyle = {
  display: 'flex',
  height: '100%',
  width: '100%',
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)'
};

const bubbleStyle = {
  borderRadius: '18px',
  padding: '12px 14px',
  marginBottom: '12px',
  maxWidth: '100%'
};

function renderMessage(message: ChatMessage, primaryColor: string, accentColor: string) {
  const isUser = message.role === 'user';

  return (
    <div key={message.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          ...bubbleStyle,
          background: isUser ? primaryColor : accentColor,
          color: '#fff',
          borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px'
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

export function ChatPanel({
  sdk,
  primaryColor = '#0F172A',
  accentColor = '#2563EB',
  backgroundColor = '#FFFFFF',
  headerText = 'Brainbox Chat',
  sidebarTitle = 'History',
  initialSessionId,
  design = 'cloud'
}: ChatPanelProps) {
  const { messages, loading, error, sendMessage, sendVoiceNote, createSession, sessionId } = useBrainboxChat(sdk as BrainboxReactSDK);
  const [input, setInput] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialSessionId) {
      // session concept is preserved but not used for UI state yet
    }
  }, [initialSessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input.trim());
    setInput('');
  };

  const handleVoiceNote = async () => {
    if (!voiceNote.trim()) return;
    await sendVoiceNote(voiceNote.trim());
    setVoiceNote('');
  };

  const statusList = useMemo(
    () => [
      { label: 'API status', value: 'Connected' },
      { label: 'Session', value: sessionId || 'None' },
      { label: 'Design', value: design },
      { label: 'Real-time', value: 'Stream-ready' }
    ],
    [sessionId, design]
  );

  return (
    <div style={{ ...panelStyle, background: backgroundColor, minHeight: '560px' }}>
      <aside style={sidebarStyle}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{sidebarTitle}</h3>
          <p style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>Saved chat threads and endpoints.</p>
        </div>

        <div style={{ marginBottom: '18px' }}>
          {statusList.map(item => (
            <div key={item.label} style={{ marginBottom: '12px' }}>
              <strong style={{ display: 'block', color: '#334155', fontSize: '13px' }}>{item.label}</strong>
              <span style={{ color: '#475569', fontSize: '13px' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => createSession('Chat Panel Session')}
          style={{
            width: '100%',
            background: accentColor,
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px',
            cursor: 'pointer'
          }}
        >
          Create Session
        </button>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box' }}>
        <header style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0, color: primaryColor }}>{headerText}</h2>
          <p style={{ marginTop: '8px', color: '#475569' }}>Use the built-in chat UI with instant backend communication.</p>
        </header>

        <section style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', marginBottom: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ color: '#64748B', fontSize: '14px' }}>Your chat history appears here. Send a message to start.</div>
          ) : (
            messages.map(message => renderMessage(message, accentColor, '#0F172A'))
          )}
          <div ref={endRef} />
        </section>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              style={{ flex: 1, minWidth: '200px', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '14px' }}
            />
            <button
              onClick={handleSend}
              style={{
                background: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '12px 18px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={voiceNote}
              onChange={event => setVoiceNote(event.target.value)}
              placeholder="Voice note text (demo)"
              style={{ flex: 1, minWidth: '200px', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '14px' }}
            />
            <button
              onClick={handleVoiceNote}
              style={{
                background: accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '12px 18px',
                cursor: 'pointer'
              }}
            >
              Add Voice Note
            </button>
          </div>

          {error && <div style={{ marginTop: '12px', color: '#DC2626' }}>{error}</div>}
        </div>
      </main>
    </div>
  );
}
