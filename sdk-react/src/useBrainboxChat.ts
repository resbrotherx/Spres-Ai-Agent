'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainboxReactSDK, toBrainboxError } from './brainbox-sdk';
import type {
  BrainboxChatResponse,
  ChatMessage,
  ChatRole,
  ChatSession,
  UseBrainboxChatHook,
  UseBrainboxChatOptions
} from './types';

let localSeq = 0;
const localId = () => `m-${Date.now().toString(36)}-${(localSeq++).toString(36)}`;

const createMessage = (role: ChatRole, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: localId(),
  role,
  text,
  timestamp: new Date().toISOString(),
  userInitials: role === 'user' ? 'U' : 'A',
  status: 'done',
  metadata: { context_used: false },
  ...extra
});

function storageGet(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage may be blocked */
  }
}

function sessionStorageKey(sdk: BrainboxReactSDK, userKey?: string): string {
  const api = typeof sdk.getApiUrl === 'function' ? sdk.getApiUrl() : '';
  const tenant = (typeof sdk.getTenantId === 'function' && sdk.getTenantId()) || '';
  let user = userKey || '';
  if (!user) {
    try {
      const profile = sdk.getUserProfile?.();
      user = profile?.username || profile?.email || '';
    } catch {
      user = '';
    }
  }
  return `bb-chat:last-session:${api}|${tenant}|${user || 'anon'}`;
}

function flattenSessions(grouped: any): ChatSession[] {
  if (!grouped) return [];
  if (Array.isArray(grouped)) return grouped;
  if (Array.isArray(grouped.sessions)) return grouped.sessions;
  const all: ChatSession[] = [
    ...(grouped.today || []),
    ...(grouped.yesterday || []),
    ...(grouped.this_week || []),
    ...(grouped.older || [])
  ];
  const seen = new Set<string>();
  return all.filter((s) => {
    if (!s || !s.session_id || seen.has(s.session_id)) return false;
    seen.add(s.session_id);
    return true;
  });
}

/**
 * Chat state for a Brainbox conversation: streaming answers, stop, retry, feedback,
 * session history (loaded on demand) and last-session persistence.
 */
export function useBrainboxChat(
  sdk: BrainboxReactSDK,
  initialSessionId?: string,
  options: UseBrainboxChatOptions = {}
): UseBrainboxChatHook {
  const { persistSession = true, userKey, open } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId || null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const sessionRef = useRef<string | null>(sessionId);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionsLoadedRef = useRef(false);
  const mounted = useRef(true);
  const lastQuestion = useRef<string | null>(null);
  /** Bumped whenever the conversation is replaced, so late callbacks of an old request are ignored. */
  const generation = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const callbacks = useRef(options);
  callbacks.current = options;

  const storageKey = sessionStorageKey(sdk, userKey);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const setSessionId = useCallback(
    (sid: string | null) => {
      sessionRef.current = sid;
      setSessionIdState(sid);
      if (persistSession) storageSet(storageKey, sid);
    },
    [persistSession, storageKey]
  );

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const grouped = await sdk.listSessions();
      if (!mounted.current) return;
      setSessions(flattenSessions(grouped));
      sessionsLoadedRef.current = true;
      setSessionsLoaded(true);
    } catch (err) {
      if (mounted.current) setError(toBrainboxError(err).message);
    } finally {
      if (mounted.current) setSessionsLoading(false);
    }
  }, [sdk]);

  /** Refresh the session list only if the UI has asked for it before. */
  const refreshIfLoaded = useCallback(() => {
    if (sessionsLoadedRef.current) void refreshSessions();
  }, [refreshSessions]);

  const loadSession = useCallback(
    async (sid: string) => {
      if (!sid) return;
      generation.current += 1;
      abortRef.current?.abort();
      inFlight.current = false;
      setStreaming(false);
      setError(null);
      setLoading(true);
      try {
        const data = await sdk.getSessionMessages(sid);
        if (!mounted.current) return;
        const list: any[] = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
        setSessionId(sid);
        setMessages(
          list.map((msg: any) => ({
            id: `s-${msg.id ?? localId()}`,
            role: (msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant') as ChatRole,
            text: String(msg.content ?? msg.text ?? ''),
            timestamp: msg.created_at || new Date().toISOString(),
            userInitials: msg.user_initials,
            messageId: msg.id,
            status: 'done',
            sources: msg.search_results || msg.metadata?.search_results || null,
            metadata: msg.metadata
          }))
        );
      } catch (err) {
        const e = toBrainboxError(err);
        if (mounted.current) {
          // A remembered session that no longer exists: start fresh silently.
          if (e.status === 404 || e.status === 403) {
            if (sessionRef.current === sid || !sessionRef.current) setSessionId(null);
            storageSet(storageKey, null);
          } else {
            setError(e.message);
          }
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [sdk, setSessionId, storageKey]
  );

  // Restore: explicit initialSessionId wins, otherwise the remembered last session.
  useEffect(() => {
    const sid = initialSessionId || (persistSession ? storageGet(storageKey) : null);
    if (sid) void loadSession(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, initialSessionId]);

  // Unread replies while closed.
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  const markRead = useCallback(() => setUnreadCount(0), []);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => {
    setMessages((current) =>
      current.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m))
    );
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const controller = new AbortController();
      const gen = generation.current;
      const current = () => mounted.current && generation.current === gen;
      abortRef.current = controller;
      inFlight.current = true;
      lastQuestion.current = text;
      setError(null);
      setLoading(true);
      setStreaming(false);

      const reply = createMessage('assistant', '', { status: 'pending' });
      setMessages((current) => [...current, reply]);

      // Batch token updates to one render per animation frame.
      let buffer = '';
      let frame: number | null = null;
      const flush = () => {
        frame = null;
        const text = buffer;
        patchMessage(reply.id, { text, status: 'streaming' });
      };
      const schedule = () => {
        if (frame != null) return;
        if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(flush);
        else flush();
      };
      const cancelFrame = () => {
        if (frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        frame = null;
      };

      const finish = () => {
        if (abortRef.current === controller) abortRef.current = null;
        if (!current()) return;
        inFlight.current = false;
        setLoading(false);
        setStreaming(false);
      };

      await sdk.streamChat(
        text,
        sessionRef.current || undefined,
        (chunk) => {
            if (controller.signal.aborted || !current()) return;
          if (!buffer) setStreaming(true);
          buffer += chunk;
          schedule();
        },
        (result: BrainboxChatResponse) => {
          cancelFrame();
          if (controller.signal.aborted || !current()) return finish();
          if (result?.session_id && result.session_id !== sessionRef.current) setSessionId(result.session_id);
          const final: Partial<ChatMessage> = {
            text: typeof result?.response === 'string' && result.response ? result.response : buffer,
            status: 'done',
            messageId: result?.message_id,
            sources: Array.isArray(result?.search_results) ? result.search_results : null,
            timestamp: new Date().toISOString(),
            metadata: { context_used: !!(result?.search_results && result.search_results.length), cached: !!result?.cached }
          };
          let finished: ChatMessage | null = null;
          setMessages((current) =>
            current.map((m) => {
              if (m.id !== reply.id) return m;
              finished = { ...m, ...final };
              return finished;
            })
          );
          if (openRef.current === false) setUnreadCount((n) => n + 1);
          finish();
          refreshIfLoaded();
          const done = finished || ({ ...reply, ...final } as ChatMessage);
          callbacks.current.onReply?.(done);
        },
        (err) => {
          cancelFrame();
          finish();
          if (!current()) return;
          const partial = buffer;
          if (partial) {
            patchMessage(reply.id, { text: partial, status: 'error' });
          } else {
            setMessages((current) => current.filter((m) => m.id !== reply.id));
          }
          setError(err.message);
          callbacks.current.onError?.(err.message);
        },
        {
          signal: controller.signal,
          onMeta: (meta) => {
            if (!current()) return;
            if (meta?.session_id && meta.session_id !== sessionRef.current) setSessionId(meta.session_id);
          }
        }
      );

      // Aborted: keep what we have.
      if (controller.signal.aborted) {
        cancelFrame();
        if (current()) {
          const partial = buffer;
          if (partial) patchMessage(reply.id, { text: partial, status: 'stopped' });
          else setMessages((current) => current.filter((m) => m.id !== reply.id));
        }
        finish();
      }
    },
    [patchMessage, refreshIfLoaded, sdk, setSessionId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const question = (text || '').trim();
      if (!question || inFlight.current) return;
      inFlight.current = true;
      setMessages((current) => [...current, createMessage('user', question)]);
      await ask(question);
    },
    [ask]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(async () => {
    const q = lastQuestion.current;
    if (!q || inFlight.current) return;
    inFlight.current = true;
    setMessages((current) => {
      const last = current[current.length - 1];
      return last && last.role === 'assistant' && last.status === 'error' ? current.slice(0, -1) : current;
    });
    await ask(q);
  }, [ask]);

  const sendFeedback = useCallback(
    async (id: string, rating: 'up' | 'down') => {
      const message = messages.find((m) => m.id === id);
      const sid = sessionRef.current;
      if (!message || !sid) throw new Error('This answer can’t be rated yet.');
      const previous = message.feedback;
      patchMessage(id, { feedback: rating });
      try {
        await sdk.sendFeedback({ session_id: sid, message_id: message.messageId, rating });
      } catch (err) {
        if (mounted.current) patchMessage(id, { feedback: previous });
        throw toBrainboxError(err);
      }
    },
    [messages, patchMessage, sdk]
  );

  const ensureSession = useCallback(
    async (title: string) => {
      let sid = sessionRef.current;
      if (!sid) {
        const response = await sdk.createChatSession(title);
        sid = response?.session_id || null;
        if (sid) setSessionId(sid);
      }
      return sid;
    },
    [sdk, setSessionId]
  );

  const sendVoiceNote = useCallback(
    async (note: Blob) => {
      setError(null);
      try {
        const sid = await ensureSession('Voice note');
        const voiceFile = new File([note], 'voice.webm', { type: note.type || 'audio/webm' });
        await sdk.uploadFile(voiceFile, sid || undefined);
        setMessages((current) => [...current, createMessage('user', '🎙️ Voice note sent')]);
        refreshIfLoaded();
      } catch (err) {
        const msg = toBrainboxError(err).message || 'Failed to send voice note';
        setError(msg);
        callbacks.current.onError?.(msg);
      }
    },
    [ensureSession, refreshIfLoaded, sdk]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const sid = await ensureSession(file.name || 'File upload');
        await sdk.uploadFile(file, sid || undefined);
        setMessages((current) => [...current, createMessage('user', `📎 ${file.name}`)]);
        refreshIfLoaded();
      } catch (err) {
        const msg = toBrainboxError(err).message || 'Failed to upload file';
        setError(msg);
        callbacks.current.onError?.(msg);
      }
    },
    [ensureSession, refreshIfLoaded, sdk]
  );

  const uploadImage = useCallback(
    async (image: File) => {
      setError(null);
      try {
        const sid = await ensureSession(image.name || 'Image upload');
        await sdk.uploadImage(image, sid || undefined);
        setMessages((current) => [...current, createMessage('user', `🖼️ ${image.name}`)]);
        refreshIfLoaded();
      } catch (err) {
        const msg = toBrainboxError(err).message || 'Failed to upload image';
        setError(msg);
        callbacks.current.onError?.(msg);
      }
    },
    [ensureSession, refreshIfLoaded, sdk]
  );

  const createSession = useCallback(
    async (title?: string) => {
      generation.current += 1;
      abortRef.current?.abort();
      inFlight.current = false;
      setError(null);
      setMessages([]);
      setStreaming(false);
      setLoading(false);
      setSessionId(null);
      if (!title) return null;
      try {
        const response = await sdk.createChatSession(title);
        const sid: string | null = response?.session_id || null;
        if (sid && mounted.current) {
          setSessionId(sid);
          if (sessionsLoadedRef.current) {
            setSessions((prev) => [
              { session_id: sid, title: response?.title || title, created_at: response?.created_at || new Date().toISOString() },
              ...prev.filter((s) => s.session_id !== sid)
            ]);
          }
        }
        return sid;
      } catch (err) {
        if (mounted.current) setError(toBrainboxError(err).message);
        return null;
      }
    },
    [sdk, setSessionId]
  );

  const exportChat = useCallback(
    async (format: 'json' | 'pdf' = 'json') => {
      try {
        if (typeof document === 'undefined') return;
        const payload = { sessionId, messages, exportedAt: new Date().toISOString() };
        let blob: Blob;
        let ext: string;
        if (format === 'json') {
          blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          ext = 'json';
        } else {
          // Plain-text transcript (no PDF dependency in the SDK).
          const lines = messages.map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? 'You' : 'Assistant'}: ${m.text}`);
          blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
          ext = 'txt';
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat-${sessionId || 'export'}-${Date.now()}.${ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err: any) {
        setError(err?.message || 'Failed to export chat');
      }
    },
    [messages, sessionId]
  );

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    generation.current += 1;
    abortRef.current?.abort();
    inFlight.current = false;
    setMessages([]);
    setError(null);
    setLoading(false);
    setStreaming(false);
    setSessionId(null);
  }, [setSessionId]);

  return {
    messages,
    loading,
    streaming,
    error,
    sessionId,
    sessions,
    sessionsLoaded,
    sessionsLoading,
    unreadCount,
    markRead,
    sendMessage,
    stop,
    retry,
    sendFeedback,
    sendVoiceNote,
    uploadFile,
    uploadImage,
    createSession,
    loadSession,
    refreshSessions,
    exportChat,
    clearError,
    reset
  };
}
