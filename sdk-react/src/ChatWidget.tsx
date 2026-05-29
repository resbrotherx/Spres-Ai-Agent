import { CSSProperties, useMemo, useRef, useState } from 'react';
import { BrainboxReactSDK } from './brainbox-sdk';
import { ChatWidgetProps, ChatMessage } from './types';
import { useBrainboxChat } from './useBrainboxChat';

const defaultButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 8px 18px rgba(0,0,0,0.16)'
};

const bubbleStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 14px',
  marginBottom: '10px',
  lineHeight: 1.5,
  maxWidth: '100%'
};

function renderMessage(message: ChatMessage, primaryColor: string, accentColor: string) {
  const isUser = message.role === 'user';
  const containerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start'
  };

  return (
    <div key={message.id} style={containerStyle}>
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

export function ChatWidget({
  sdk,
  position = 'bottom-right',
  primaryColor = '#3B82F6',
  accentColor = '#111827',
  backgroundColor = '#F8FAFC',
  buttonText = 'Support',
  placeholder = 'Ask a question...',
  width = '340px',
  height = '480px',
  design = 'support'
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, loading, error, sendMessage } = useBrainboxChat(sdk as BrainboxReactSDK);
  const endRef = useRef<HTMLDivElement | null>(null);

  const positionStyle = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      maxWidth: width,
      width
    };

    if (position.includes('bottom')) base.bottom = '20px';
    if (position.includes('top')) base.top = '20px';
    if (position.includes('right')) base.right = '20px';
    if (position.includes('left')) base.left = '20px';
    if (position === 'center') {
      base.left = '50%';
      base.transform = 'translateX(-50%)';
      base.bottom = '20px';
    }

    return base;
  }, [position, width]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input.trim());
    setInput('');
  };

  const headerText = design === 'support' ? 'Support Chat' : 'AI Assistant';

  return (
    <div style={positionStyle}>
      {open && (
        <div
          style={{
            borderRadius: '24px',
            background: '#fff',
            boxShadow: '0 24px 80px rgba(15, 23, 42, 0.12)',
            overflow: 'hidden',
            height
          }}
        >
          <div style={{ background: primaryColor, color: '#fff', padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{headerText}</strong>
                <div style={{ fontSize: '12px', opacity: 0.85 }}>Powered by Brainbox</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ padding: '16px', background: backgroundColor, height: `calc(${height} - 132px)`, overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '14px' }}>
                {design === 'support'
                  ? 'Ask a support question and get an answer in real time.'
                  : 'Start chatting with AI instantly.'}
              </div>
            ) : (
              messages.map(message => renderMessage(message, primaryColor, accentColor))
            )}
            <div ref={endRef} />
          </div>
          <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleSend()}
                placeholder={placeholder}
                style={{
                  flex: 1,
                  border: '1px solid #CBD5E1',
                  borderRadius: '999px',
                  padding: '12px 16px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSend}
                style={{
                  ...defaultButtonStyle,
                  background: primaryColor,
                  padding: '0 18px',
                  minWidth: '95px'
                }}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
            {error && <div style={{ marginTop: '10px', color: '#EF4444' }}>{error}</div>}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{
          ...defaultButtonStyle,
          background: primaryColor,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '120px'
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}
