import { useCallback, useState } from 'react';
import { BrainboxReactSDK } from './brainbox-sdk';
import { ChatMessage, UseBrainboxChatHook } from './types';

const createMessage = (role: 'user' | 'assistant' | 'system', text: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  text,
  timestamp: new Date().toISOString()
});

export function useBrainboxChat(sdk: BrainboxReactSDK): UseBrainboxChatHook {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages(current => [...current, message]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setError(null);
    const userMessage = createMessage('user', text);
    appendMessage(userMessage);
    setLoading(true);

    try {
      await sdk.streamChat(
        text,
        sessionId || undefined,
        chunk => {
          setMessages(current => {
            const existing = current[current.length - 1];
            if (existing && existing.role === 'assistant') {
              return [
                ...current.slice(0, -1),
                {
                  ...existing,
                  text: existing.text + chunk
                }
              ];
            }

            return [...current, createMessage('assistant', chunk)];
          });
        },
        result => {
          if (result?.session_id) {
            setSessionId(result.session_id);
          }
          setLoading(false);
        },
        err => {
          setError(err.message);
          setLoading(false);
        }
      );
    } catch (err: any) {
      setError(err?.message || 'Chat failed');
      setLoading(false);
    }
  }, [appendMessage, messages, sdk, sessionId]);

  const sendVoiceNote = useCallback(async (note: string) => {
    setError(null);
    const voiceMessage = createMessage('user', `Voice note: ${note}`);
    appendMessage(voiceMessage);
    await sendMessage(`Voice note: ${note}`);
  }, [appendMessage, sendMessage]);

  const createSession = useCallback(async (title?: string) => {
    setError(null);
    try {
      const response = await sdk.createChatSession(title);
      if (response?.session_id) {
        setSessionId(response.session_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to create session');
    }
  }, [sdk]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setLoading(false);
    setSessionId(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sessionId,
    sendMessage,
    sendVoiceNote,
    createSession,
    reset
  };
}
