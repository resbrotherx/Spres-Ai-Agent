import { useCallback, useState, useEffect } from 'react';
import { BrainboxReactSDK } from './brainbox-sdk';
import { ChatMessage, UseBrainboxChatHook, ChatSession, SessionsGroupedByDate } from './types';

const createMessage = (role: 'user' | 'assistant' | 'system', text: string, userInitials?: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  text,
  timestamp: new Date().toISOString(),
  userInitials: userInitials || (role === 'user' ? 'U' : 'A'),
  metadata: {
    context_used: false
  }
});

export function useBrainboxChat(sdk: BrainboxReactSDK, initialSessionId?: string): UseBrainboxChatHook {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const refreshSessions = useCallback(async () => {
    const groupedSessions = await sdk.listSessions();
    const allSessions = [
      ...groupedSessions.today,
      ...groupedSessions.yesterday,
      ...groupedSessions.this_week,
      ...groupedSessions.older
    ];
    setSessions(allSessions);
  }, [sdk]);

  // Fetch all sessions on mount
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        await refreshSessions();
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
      }
    };

    if (sdk) {
      fetchSessions();
    }
  }, [sdk, refreshSessions]);

  // Load initial session messages if provided
  useEffect(() => {
    if (initialSessionId && sessionId) {
      loadSession(initialSessionId);
    }
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages(current => [...current, message]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setError(null);
    const userMessage = createMessage('user', text, 'U');
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

            return [...current, createMessage('assistant', chunk, 'A')];
          });
        },
        result => {
          if (result?.session_id) {
            setSessionId(result.session_id);
          }
          refreshSessions().catch(err => console.error('Failed to refresh sessions:', err));
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
  }, [appendMessage, refreshSessions, sdk, sessionId]);

  const sendVoiceNote = useCallback(async (note: Blob) => {
    setError(null);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const response = await sdk.createChatSession('Voice note');
        targetSessionId = response?.session_id || null;
        if (targetSessionId) {
          setSessionId(targetSessionId);
        }
      }
      const voiceFile = new File([note], 'voice.webm', { type: note.type || 'audio/webm' });
      await sdk.uploadFile(voiceFile, targetSessionId || undefined);
      const voiceMessage = createMessage('user', 'Voice note uploaded', 'U');
      appendMessage(voiceMessage);
      await refreshSessions();
    } catch (err: any) {
      setError(err?.message || 'Failed to send voice note');
    }
  }, [appendMessage, refreshSessions, sdk, sessionId]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const response = await sdk.createChatSession(file.name || 'File upload');
        targetSessionId = response?.session_id || null;
        if (targetSessionId) {
          setSessionId(targetSessionId);
        }
      }
      await sdk.uploadFile(file, targetSessionId || undefined);
      const fileMessage = createMessage('user', `📎 Uploaded: ${file.name}`, 'U');
      appendMessage(fileMessage);
      await refreshSessions();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload file');
    }
  }, [appendMessage, refreshSessions, sdk, sessionId]);

  const uploadImage = useCallback(async (image: File) => {
    setError(null);
    try {
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const response = await sdk.createChatSession(image.name || 'Image upload');
        targetSessionId = response?.session_id || null;
        if (targetSessionId) {
          setSessionId(targetSessionId);
        }
      }
      await sdk.uploadImage(image, targetSessionId || undefined);
      const imageMessage = createMessage('user', `🖼️ Uploaded: ${image.name}`, 'U');
      appendMessage(imageMessage);
      await refreshSessions();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image');
    }
  }, [appendMessage, refreshSessions, sdk, sessionId]);

  const createSession = useCallback(async (title?: string) => {
    setError(null);
    setMessages([]);
    setSessionId(null);
  }, []);

  const loadSession = useCallback(async (sid: string) => {
    setError(null);
    setLoading(true);
    try {
      setSessionId(sid);
      const sessionMessages = await sdk.getSessionMessages(sid);
      const formattedMessages = sessionMessages.messages.map((msg: any) => ({
        id: `msg-${msg.id}`,
        role: msg.role as 'user' | 'assistant',
        text: msg.content,
        timestamp: msg.created_at,
        userInitials: msg.user_initials,
        metadata: msg.metadata
      }));
      setMessages(formattedMessages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  const exportChat = useCallback(async (format: 'json' | 'pdf' = 'json') => {
    try {
      const exportData = {
        sessionId,
        messages,
        timestamp: new Date().toISOString(),
        format
      };

      if (format === 'json') {
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat-${sessionId || 'export'}-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        // TODO: Implement PDF export using a library like jsPDF
        console.log('PDF export not yet implemented');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to export chat');
    }
  }, [messages, sessionId]);

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
    sessions,
    sendMessage,
    sendVoiceNote,
    uploadFile,
    uploadImage,
    createSession,
    loadSession,
    exportChat,
    reset
  };
}
