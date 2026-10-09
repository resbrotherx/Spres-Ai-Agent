import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BrainboxClient } from './client';
import { BrainboxError } from './errors';
import { getDefaultStorage } from './storage';
import type {
  BrainboxChatResponse,
  BrainboxRating,
  BrainboxSearchResult,
  BrainboxSessionsGrouped,
  BrainboxStorage,
  BrainboxStreamHandle,
  BrainboxUploadFile
} from './types';

export type BrainboxMessageStatus = 'sending' | 'streaming' | 'done' | 'error' | 'stopped';

export interface BrainboxMessage {
  /** Local id (stable for React keys). */
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** ISO timestamp. */
  createdAt: string;
  status: BrainboxMessageStatus;
  /** Server message id (assistant messages; used for feedback). */
  messageId?: number | string | null;
  searchResults?: BrainboxSearchResult[] | null;
  reasoning?: string | null;
  feedback?: BrainboxRating | null;
  cached?: boolean;
  /** Loaded from history (not animated in). */
  fromHistory?: boolean;
}

export type BrainboxChatEventName =
  | 'message'
  | 'response'
  | 'error'
  | 'session'
  | 'feedback'
  | 'upload'
  | 'fallback'
  | 'open'
  | 'close';

export interface UseBrainboxChatOptions {
  /** Stream answers token by token (default true). Falls back to whole answers automatically. */
  streaming?: boolean;
  /** Where the last session id is stored. Default: AsyncStorage if installed, else memory. `null` disables. */
  storage?: BrainboxStorage | null;
  /** Storage namespace (default 'bb-rn'); combined with tenant and user id. */
  storageKey?: string;
  /** Restore the last conversation on mount (default true). */
  persistSession?: boolean;
  /** Open this conversation on mount instead of the stored one. */
  initialSessionId?: string;
  /** Receives every event: message, response, error, session, feedback, upload, fallback. */
  onEvent?: (name: BrainboxChatEventName, detail: any) => void;
}

export interface UseBrainboxChatResult {
  messages: BrainboxMessage[];
  /** Text of the answer currently streaming ('' when idle). */
  streamingText: string;
  /** A request is in flight. */
  sending: boolean;
  /** Tokens are arriving (sending && at least one token received). */
  streaming: boolean;
  error: BrainboxError | null;
  /** The last question failed and `retry()` can resend it. */
  canRetry: boolean;
  sessionId: string | null;
  sessions: BrainboxSessionsGrouped | null;
  sessionsLoading: boolean;
  /** Loading a past conversation. */
  historyLoading: boolean;
  /** Initial restore from storage finished. */
  ready: boolean;
  send: (text: string) => Promise<BrainboxChatResponse | null>;
  stop: () => void;
  retry: () => Promise<BrainboxChatResponse | null>;
  newChat: () => void;
  loadSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<BrainboxSessionsGrouped | null>;
  sendFeedback: (localMessageId: string, rating: BrainboxRating) => Promise<void>;
  uploadFile: (file: BrainboxUploadFile) => Promise<void>;
  clearError: () => void;
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Backend timestamps without a timezone are UTC. */
export function parseServerTime(s?: string | null): Date {
  if (!s) return new Date();
  const hasTz = /([zZ]|[+-]\d\d:?\d\d)$/.test(s);
  const d = new Date(hasTz ? s : s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? new Date() : d;
}

export function useBrainboxChat(client: BrainboxClient, options: UseBrainboxChatOptions = {}): UseBrainboxChatResult {
  const {
    streaming: streamingOpt = true,
    storageKey = 'bb-rn',
    persistSession = true,
    initialSessionId
  } = options;
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;

  const [messages, setMessages] = useState<BrainboxMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<BrainboxError | null>(null);
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId || null);
  const [sessions, setSessions] = useState<BrainboxSessionsGrouped | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;
  const emit = useCallback((name: BrainboxChatEventName, detail: any) => {
    try {
      onEventRef.current?.(name, detail);
    } catch {
      /* ignore listener errors */
    }
  }, []);

  const mounted = useRef(true);
  const sessionRef = useRef<string | null>(sessionId);
  const messagesRef = useRef<BrainboxMessage[]>(messages);
  messagesRef.current = messages;
  const handleRef = useRef<BrainboxStreamHandle | null>(null);
  const runRef = useRef(0); // increments on every new run / reset; stale callbacks compare against it
  const sendingRef = useRef(false);
  const lastFailed = useRef<{ question: string; userId: string } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const key = useMemo(
    () => `${storageKey}:${client.tenantId || 'default'}:${client.user.id || 'anon'}:session`,
    [storageKey, client]
  );

  const persist = useCallback(
    (sid: string | null) => {
      if (!storage || !persistSession) return;
      (sid ? storage.setItem(key, sid) : storage.removeItem(key)).catch(() => undefined);
    },
    [storage, persistSession, key]
  );

  const setSessionId = useCallback(
    (sid: string | null) => {
      if (sessionRef.current === sid) return;
      sessionRef.current = sid;
      setSessionIdState(sid);
      persist(sid);
      emit('session', { sessionId: sid });
    },
    [persist, emit]
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runRef.current++;
      handleRef.current?.abort();
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  const patch = useCallback((id: string, fn: (m: BrainboxMessage) => BrainboxMessage | null) => {
    setMessages((list) => {
      const out: BrainboxMessage[] = [];
      for (const m of list) {
        if (m.id !== id) out.push(m);
        else {
          const next = fn(m);
          if (next) out.push(next);
        }
      }
      return out;
    });
  }, []);

  const finishRun = useCallback(() => {
    sendingRef.current = false;
    handleRef.current = null;
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (mounted.current) {
      setSending(false);
      setStreamingText('');
    }
  }, []);

  const run = useCallback(
    (question: string, userId: string): Promise<BrainboxChatResponse | null> => {
      const runId = ++runRef.current;
      const assistantId = uid('a');
      sendingRef.current = true;
      setSending(true);
      setStreamingText('');
      setError(null);
      setMessages((list) => [
        ...list,
        { id: assistantId, role: 'assistant', text: '', createdAt: new Date().toISOString(), status: 'streaming' }
      ]);
      let acc = '';
      const live = () => mounted.current && runRef.current === runId;
      const flush = () => {
        flushTimer.current = null;
        if (!live()) return;
        const t = acc;
        setStreamingText(t);
        patch(assistantId, (m) => ({ ...m, text: t }));
      };

      client.streaming = streamingOpt;
      const handle = client.streamChat(question, {
        sessionId: sessionRef.current,
        onFallback: (reason) => emit('fallback', { reason }),
        onMeta: (meta) => {
          if (!live()) return;
          if (meta.session_id) setSessionId(String(meta.session_id));
          patch(userId, (m) => ({ ...m, status: 'done' }));
        },
        onToken: (_delta, full) => {
          if (!live()) return;
          acc = full;
          if (!flushTimer.current) flushTimer.current = setTimeout(flush, 32);
        },
        onDone: (res) => {
          if (!live()) return;
          if (flushTimer.current) clearTimeout(flushTimer.current);
          flushTimer.current = null;
          if (res.session_id) setSessionId(String(res.session_id));
          lastFailed.current = null;
          patch(userId, (m) => ({ ...m, status: 'done' }));
          patch(assistantId, (m) => ({
            ...m,
            text: res.response || acc,
            status: 'done',
            messageId: res.message_id ?? null,
            searchResults: Array.isArray(res.search_results) ? res.search_results : null,
            reasoning: res.reasoning ?? null,
            cached: !!res.cached
          }));
          emit('response', {
            text: res.response,
            sessionId: res.session_id ?? sessionRef.current,
            reasoning: res.reasoning,
            searchResults: res.search_results,
            raw: res
          });
        },
        onError: (err) => {
          if (!live()) return;
          if (flushTimer.current) clearTimeout(flushTimer.current);
          flushTimer.current = null;
          lastFailed.current = { question, userId };
          setCanRetry(true);
          patch(userId, (m) => ({ ...m, status: 'error' }));
          patch(assistantId, (m) => (acc ? { ...m, text: acc, status: 'error' } : null));
          setError(err);
          emit('error', { message: err.message, action: 'chat', status: err.status, code: err.code });
        }
      });
      handleRef.current = handle;
      return handle.done.then((res) => {
        if (runRef.current === runId) finishRun();
        return res;
      });
    },
    [client, streamingOpt, emit, patch, setSessionId, finishRun]
  );

  const send = useCallback(
    async (text: string) => {
      const question = (text || '').trim();
      if (!question || sendingRef.current) return null;
      lastFailed.current = null;
      setCanRetry(false);
      const userId = uid('u');
      setMessages((list) => [
        ...list,
        { id: userId, role: 'user', text: question, createdAt: new Date().toISOString(), status: 'sending' }
      ]);
      emit('message', { text: question, sessionId: sessionRef.current });
      return run(question, userId);
    },
    [run, emit]
  );

  const stop = useCallback(() => {
    const h = handleRef.current;
    if (!h) return;
    runRef.current++;
    h.abort();
    // Keep partial text as a stopped answer; drop an empty placeholder.
    setMessages((list) =>
      list
        .filter((m) => !(m.role === 'assistant' && m.status === 'streaming' && !m.text))
        .map((m) =>
          m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m.status === 'sending' ? { ...m, status: 'done' as const } : m
        )
    );
    finishRun();
  }, [finishRun]);

  const retry = useCallback(async () => {
    const f = lastFailed.current;
    if (!f || sendingRef.current) return null;
    lastFailed.current = null;
    setCanRetry(false);
    setMessages((list) => {
      const idx = list.findIndex((m) => m.id === f.userId);
      if (idx === -1) return list;
      // Drop any partial answer after the failed question.
      return [...list.slice(0, idx), { ...list[idx], status: 'sending' as const }, ...list.slice(idx + 1).filter((m) => m.role !== 'assistant' || m.status !== 'error')];
    });
    setError(null);
    return run(f.question, f.userId);
  }, [run]);

  const reset = useCallback(() => {
    runRef.current++;
    handleRef.current?.abort();
    finishRun();
    lastFailed.current = null;
    setCanRetry(false);
    setMessages([]);
    setError(null);
  }, [finishRun]);

  const newChat = useCallback(() => {
    reset();
    setSessionId(null);
  }, [reset, setSessionId]);

  const loadSession = useCallback(
    async (sid: string) => {
      if (!sid) return;
      reset();
      const runId = runRef.current;
      setHistoryLoading(true);
      try {
        const detail = await client.getSessionMessages(sid);
        if (!mounted.current || runRef.current !== runId) return;
        const list: BrainboxMessage[] = (detail?.messages || [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: `h-${m.id}`,
            role: m.role as 'user' | 'assistant',
            text: m.content || '',
            createdAt: parseServerTime(m.created_at).toISOString(),
            status: 'done' as const,
            messageId: m.role === 'assistant' ? m.id : null,
            fromHistory: true
          }));
        setMessages(list);
        setSessionId(detail?.session_id || sid);
      } catch (e) {
        if (!mounted.current || runRef.current !== runId) return;
        const err = e instanceof BrainboxError ? e : new BrainboxError(String(e));
        if (err.status === 404) {
          // The stored conversation is gone (or belongs to someone else): start fresh.
          setSessionId(null);
        } else {
          setError(err);
          emit('error', { message: err.message, action: 'session', status: err.status, code: err.code });
        }
      } finally {
        if (mounted.current && runRef.current === runId) setHistoryLoading(false);
      }
    },
    [client, reset, setSessionId, emit]
  );

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const grouped = await client.listSessions();
      if (mounted.current) setSessions(grouped);
      return grouped;
    } catch (e) {
      const err = e instanceof BrainboxError ? e : new BrainboxError(String(e));
      emit('error', { message: err.message, action: 'session', status: err.status, code: err.code });
      if (mounted.current) setError(err);
      return null;
    } finally {
      if (mounted.current) setSessionsLoading(false);
    }
  }, [client, emit]);

  const sendFeedback = useCallback(
    async (localId: string, rating: BrainboxRating) => {
      const msg = messagesRef.current.find((m) => m.id === localId);
      const sid = sessionRef.current;
      if (!msg || msg.role !== 'assistant' || !sid) return;
      const previous = msg.feedback ?? null;
      if (previous === rating) return;
      patch(localId, (m) => ({ ...m, feedback: rating }));
      try {
        await client.sendFeedback({ session_id: sid, message_id: msg.messageId ?? null, rating });
        emit('feedback', { sessionId: sid, messageId: msg.messageId, rating });
      } catch (e) {
        if (mounted.current) patch(localId, (m) => ({ ...m, feedback: previous }));
        const err = e instanceof BrainboxError ? e : new BrainboxError(String(e));
        emit('error', { message: err.message, action: 'feedback', status: err.status, code: err.code });
      }
    },
    [client, patch, emit]
  );

  const uploadFile = useCallback(
    async (file: BrainboxUploadFile) => {
      setError(null);
      try {
        let sid = sessionRef.current;
        if (!sid) {
          const created = await client.createSession(file.name || 'Upload');
          sid = created?.session_id || null;
          if (sid) setSessionId(sid);
        }
        const raw = await client.uploadFile(file, sid);
        if (raw?.session_id && !sessionRef.current) setSessionId(String(raw.session_id));
        if (!mounted.current) return;
        setMessages((list) => [
          ...list,
          { id: uid('u'), role: 'user', text: `📎 ${file.name}`, createdAt: new Date().toISOString(), status: 'done' }
        ]);
        emit('upload', { file: { name: file.name, type: file.type }, sessionId: sid, raw });
      } catch (e) {
        const err = e instanceof BrainboxError ? e : new BrainboxError(String(e));
        if (mounted.current) setError(err);
        emit('error', { message: err.message, action: 'upload', status: err.status, code: err.code });
      }
    },
    [client, setSessionId, emit]
  );

  // Restore the last conversation (or open initialSessionId) once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let sid: string | null = initialSessionId || null;
      if (!sid && storage && persistSession) {
        try {
          sid = await storage.getItem(key);
        } catch {
          sid = null;
        }
      }
      if (cancelled) return;
      if (sid) await loadSession(sid);
      if (!cancelled && mounted.current) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clearError = useCallback(() => {
    setError(null);
    setCanRetry(false);
    lastFailed.current = null;
  }, []);

  return {
    messages,
    streamingText,
    sending,
    streaming: sending && streamingText.length > 0,
    error,
    canRetry,
    sessionId,
    sessions,
    sessionsLoading,
    historyLoading,
    ready,
    send,
    stop,
    retry,
    newChat,
    loadSession,
    refreshSessions,
    sendFeedback,
    uploadFile,
    clearError
  };
}
