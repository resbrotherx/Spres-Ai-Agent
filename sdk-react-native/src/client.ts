import { SSEParser, SSEEvent } from './sse';
import { BrainboxError, abortError, httpError, networkError, timeoutError, formatDetail } from './errors';
import type {
  BrainboxChatResponse,
  BrainboxClientOptions,
  BrainboxFeedbackPayload,
  BrainboxHealth,
  BrainboxSession,
  BrainboxSessionDetail,
  BrainboxSessionsGrouped,
  BrainboxStreamHandle,
  BrainboxStreamHandlers,
  BrainboxUploadFile,
  BrainboxUploadResponse,
  BrainboxUser
} from './types';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | undefined | null>;
  form?: FormData;
  signal?: AbortSignal;
  timeout?: number;
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

function safeJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function clean(v: string | undefined | null): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : undefined;
}

/**
 * Headless Brainbox API client for React Native (and Node 18+). No dependencies: uses `fetch`
 * for normal requests and `XMLHttpRequest` + `onprogress` for streaming, which works in React
 * Native without polyfills.
 */
export class BrainboxClient {
  readonly apiUrl: string;
  readonly tenantId?: string;
  user: BrainboxUser;
  private credential: BrainboxClientOptions['apiKey'];
  private extraHeaders: Record<string, string>;
  private timeout: number;
  private fetchImpl?: typeof fetch;
  private XHR?: any;
  /** Use POST /api/chat/stream when available. */
  streaming: boolean;
  /** Set after the server answered 404/405 for /api/chat/stream; later calls go straight to /api/chat. */
  streamUnsupported = false;

  constructor(options: BrainboxClientOptions) {
    if (!options || typeof options.apiUrl !== 'string') throw new Error('BrainboxClient: apiUrl is required');
    this.apiUrl = options.apiUrl.replace(/\/+$/, '');
    this.credential = options.apiKey;
    this.tenantId = clean(options.tenantId);
    this.user = { ...(options.user || {}) };
    this.extraHeaders = { ...(options.headers || {}) };
    this.timeout = options.timeout ?? 200000;
    this.streaming = options.streaming !== false;
    this.fetchImpl = options.fetch;
    this.XHR = options.XMLHttpRequest;
  }

  /* ------------------------------------------------------------------ */
  /* plumbing                                                            */
  /* ------------------------------------------------------------------ */

  private get apiKey(): string {
    const c = this.credential;
    return (typeof c === 'function' ? c() : c) || '';
  }

  private headers(json: boolean): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json', ...this.extraHeaders };
    if (json) h['Content-Type'] = 'application/json';
    const key = this.apiKey;
    if (key) h.Authorization = `Bearer ${key}`;
    return h;
  }

  /** `{tenant_id?, user_id?, user_name?}` — only fields that are set, so a proxy can inject them. */
  private scope(withName = true): Record<string, string> {
    const s: Record<string, string> = {};
    if (this.tenantId) s.tenant_id = this.tenantId;
    const uid = clean(this.user.id);
    if (uid) s.user_id = uid;
    const name = clean(this.user.name);
    if (withName && name) s.user_name = name;
    return s;
  }

  private url(path: string, query?: RequestOptions['query']): string {
    let u = this.apiUrl + path;
    if (query) {
      const parts = Object.keys(query)
        .filter((k) => query[k] != null && query[k] !== '')
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`);
      if (parts.length) u += (u.includes('?') ? '&' : '?') + parts.join('&');
    }
    return u;
  }

  /** Low-level request helper. Resolves with parsed JSON; rejects with BrainboxError. */
  async request<T = any>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const f = this.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
    if (!f) throw new BrainboxError('fetch is not available in this environment.', { code: 'network' });
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl?.abort();
    }, opts.timeout ?? this.timeout);
    const onExternalAbort = () => ctrl?.abort();
    if (opts.signal) {
      if (opts.signal.aborted) ctrl?.abort();
      else opts.signal.addEventListener?.('abort', onExternalAbort);
    }
    let res: Response;
    try {
      res = await f(this.url(path, opts.query), {
        method,
        headers: this.headers(!opts.form && opts.body !== undefined),
        body: opts.form ? (opts.form as any) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      clearTimeout(timer);
      opts.signal?.removeEventListener?.('abort', onExternalAbort);
      if (timedOut) throw timeoutError();
      if (opts.signal?.aborted) throw abortError();
      throw networkError(e);
    }
    let text = '';
    try {
      text = await res.text();
    } catch (e) {
      if (timedOut) throw timeoutError();
      if (opts.signal?.aborted) throw abortError();
      throw networkError(e);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener?.('abort', onExternalAbort);
    }
    const data = safeJson(text);
    if (!res.ok) throw httpError(res.status, data);
    return data as T;
  }

  /* ------------------------------------------------------------------ */
  /* chat                                                                */
  /* ------------------------------------------------------------------ */

  private chatBody(question: string, sessionId?: string | null) {
    const body: Record<string, unknown> = { ...this.scope(), question };
    if (sessionId) body.session_id = sessionId;
    return body;
  }

  /** POST /api/chat — the whole answer at once. */
  async chat(question: string, sessionId?: string | null, opts: { signal?: AbortSignal } = {}): Promise<BrainboxChatResponse> {
    const data = await this.request<BrainboxChatResponse | string>('POST', '/api/chat', {
      body: this.chatBody(question, sessionId),
      signal: opts.signal
    });
    if (typeof data === 'string') return { response: data };
    return data || { response: '' };
  }

  /**
   * Stream an answer from POST /api/chat/stream (SSE over XMLHttpRequest). Falls back to POST /api/chat
   * when streaming is disabled, unsupported by the server (404/405), or fails before the first event.
   * Callbacks never fire after `abort()`.
   */
  streamChat(question: string, handlers: BrainboxStreamHandlers = {}): BrainboxStreamHandle {
    const sessionId = handlers.sessionId ?? null;
    let resolveDone!: (r: BrainboxChatResponse | null) => void;
    const done = new Promise<BrainboxChatResponse | null>((r) => (resolveDone = r));
    let aborted = false;
    let finished = false;
    let fellBack = false;
    let xhr: any = null;
    let xhrDead = false;
    let fallbackCtrl: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const safe = (fn: () => void) => {
      try {
        fn();
      } catch (e) {
        // A throwing user callback must not break the stream state machine.
        if (typeof console !== 'undefined') console.warn('[brainbox] callback error', e);
      }
    };

    const finish = (result: BrainboxChatResponse | null, error?: BrainboxError) => {
      if (finished || aborted) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (error) safe(() => handlers.onError?.(error));
      else if (result) safe(() => handlers.onDone?.(result));
      resolveDone(error ? null : result);
    };

    const killXhr = () => {
      xhrDead = true;
      if (xhr) {
        try {
          xhr.abort();
        } catch {
          /* ignore */
        }
      }
    };

    const deliverWhole = (res: BrainboxChatResponse) => {
      if (aborted || finished) return;
      safe(() => handlers.onMeta?.({ session_id: res.session_id ?? null, user_message_id: res.user_message_id ?? null }));
      const text = res.response || '';
      if (text) safe(() => handlers.onToken?.(text, text));
      finish({ ...res, response: text });
    };

    const runFallback = (reason: 'unsupported' | 'error' | 'disabled') => {
      if (fellBack || aborted || finished) return;
      fellBack = true;
      killXhr();
      if (timer) clearTimeout(timer);
      safe(() => handlers.onFallback?.(reason));
      fallbackCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      this.chat(question, sessionId, { signal: fallbackCtrl?.signal }).then(deliverWhole, (err) => {
        finish(null, err instanceof BrainboxError ? err : networkError(err));
      });
    };

    const abort = () => {
      if (aborted || finished) return;
      aborted = true;
      if (timer) clearTimeout(timer);
      killXhr();
      fallbackCtrl?.abort();
      resolveDone(null);
    };

    const XHR = this.XHR || (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : undefined);
    if (!this.streaming || !XHR) {
      // Defer so the caller gets the handle before any callback fires.
      Promise.resolve().then(() => runFallback('disabled'));
      return { abort, done };
    }
    if (this.streamUnsupported) {
      Promise.resolve().then(() => runFallback('unsupported'));
      return { abort, done };
    }

    const parser = new SSEParser();
    let mode: 'pending' | 'sse' | 'json' | 'error' = 'pending';
    let seen = 0;
    let text = '';
    let started = false;

    const handleEvent = (ev: SSEEvent) => {
      if (finished || aborted) return;
      let data: any = null;
      try {
        data = ev.data ? JSON.parse(ev.data) : null;
      } catch {
        data = ev.data;
      }
      switch (ev.event) {
        case 'meta':
          started = true;
          safe(() => handlers.onMeta?.({ session_id: data?.session_id ?? null, user_message_id: data?.user_message_id ?? null }));
          break;
        case 'token': {
          started = true;
          const delta = typeof data === 'string' ? data : typeof data?.t === 'string' ? data.t : '';
          if (!delta) break;
          text += delta;
          safe(() => handlers.onToken?.(delta, text));
          break;
        }
        case 'done': {
          started = true;
          const res: BrainboxChatResponse = data && typeof data === 'object' ? { ...data } : { response: text };
          if (typeof res.response !== 'string') res.response = text;
          killXhr();
          finish(res);
          break;
        }
        case 'error': {
          const status = Number(data?.status) || 0;
          const detail = data && typeof data === 'object' ? data.detail : data;
          const err = status ? httpError(status, { detail }) : new BrainboxError(formatDetail(detail) || 'The answer could not be completed. Please try again.', {
            code: 'stream', detail, retryable: true
          });
          killXhr();
          finish(null, err);
          break;
        }
        default:
          break; // unknown events (e.g. future additions) are ignored
      }
    };

    const consume = () => {
      if (mode !== 'sse' || xhrDead) return;
      const all: string = xhr.responseText || '';
      if (all.length <= seen) return;
      const chunk = all.slice(seen);
      seen = all.length;
      for (const ev of parser.push(chunk)) handleEvent(ev);
    };

    const checkHeaders = (): boolean => {
      if (mode !== 'pending') return true;
      if (xhr.readyState < 2) return false;
      const st: number = xhr.status;
      if (st === 404 || st === 405) {
        this.streamUnsupported = true;
        runFallback('unsupported');
        return false;
      }
      if (st === 0 || st >= 500 || st === 501) {
        runFallback('error');
        return false;
      }
      if (st >= 200 && st < 300) {
        const ct = String((xhr.getResponseHeader && xhr.getResponseHeader('content-type')) || '').toLowerCase();
        mode = ct.includes('application/json') ? 'json' : 'sse';
      } else {
        mode = 'error'; // 4xx with a JSON detail: read the full body, no fallback (it would fail the same way)
      }
      return true;
    };

    const onEnd = () => {
      if (xhrDead || finished || aborted) return;
      if (mode === 'pending' && !checkHeaders()) return;
      const st: number = xhr.status;
      if (mode === 'json') {
        const data = safeJson(xhr.responseText || '');
        deliverWhole(typeof data === 'object' && data ? (data as BrainboxChatResponse) : { response: String(data || '') });
        return;
      }
      if (mode === 'error') {
        finish(null, httpError(st, safeJson(xhr.responseText || '')));
        return;
      }
      consume();
      for (const ev of parser.end()) handleEvent(ev);
      if (finished || aborted) return;
      if (!started) runFallback('error');
      else
        finish(null, new BrainboxError('The answer was interrupted. Please try again.', {
          code: 'stream', retryable: true, detail: { partial: text }
        }));
    };

    const onNetError = () => {
      if (xhrDead || finished || aborted) return;
      if (!started) runFallback('error');
      else finish(null, networkError());
    };

    try {
      xhr = new XHR();
      xhr.open('POST', this.url('/api/chat/stream'));
      const h = this.headers(true);
      h.Accept = 'text/event-stream';
      h['Cache-Control'] = 'no-cache';
      Object.keys(h).forEach((k) => xhr.setRequestHeader(k, h[k]));
      try {
        xhr.responseType = 'text';
      } catch {
        /* some implementations make this read-only */
      }
      // Handlers must exist before send(): React Native only delivers incremental text when an
      // onprogress/onreadystatechange listener is attached at send time.
      xhr.onreadystatechange = () => {
        if (xhrDead || aborted || finished) return;
        if (!checkHeaders()) return;
        if (xhr.readyState >= 3) consume();
        if (xhr.readyState === 4) {
          if (xhr.status === 0) onNetError();
          else onEnd();
        }
      };
      xhr.onprogress = () => {
        if (xhrDead || aborted || finished) return;
        if (!checkHeaders()) return;
        consume();
      };
      xhr.onerror = onNetError;
      xhr.ontimeout = onNetError;
      timer = setTimeout(() => {
        if (finished || aborted) return;
        killXhr();
        fallbackCtrl?.abort();
        finish(null, timeoutError());
      }, this.timeout);
      xhr.send(JSON.stringify(this.chatBody(question, sessionId)));
    } catch {
      Promise.resolve().then(() => runFallback('error'));
    }

    return { abort, done };
  }

  /* ------------------------------------------------------------------ */
  /* sessions, uploads, feedback                                         */
  /* ------------------------------------------------------------------ */

  /** POST /api/chat/session — create an empty conversation. */
  createSession(title?: string): Promise<BrainboxSession> {
    return this.request('POST', '/api/chat/session', { body: { ...this.scope(), title: title || 'New conversation' } });
  }

  /** POST /api/chat/sessions — conversations grouped by date. */
  async listSessions(): Promise<BrainboxSessionsGrouped> {
    const data = await this.request<Partial<BrainboxSessionsGrouped>>('POST', '/api/chat/sessions', { body: this.scope(false) });
    return {
      today: data?.today || [],
      yesterday: data?.yesterday || [],
      this_week: data?.this_week || [],
      older: data?.older || []
    };
  }

  /** GET /api/chat/session/{id}/messages */
  getSessionMessages(sessionId: string): Promise<BrainboxSessionDetail> {
    const s = this.scope(false);
    return this.request('GET', `/api/chat/session/${encodeURIComponent(sessionId)}/messages`, {
      query: { tenant_id: s.tenant_id, user_id: s.user_id }
    });
  }

  /**
   * Upload a local file (`{uri, name, type}` from any picker). Images go to /api/chat/upload/image,
   * everything else to /api/chat/upload/file. Pass `kind` to force one.
   */
  uploadFile(file: BrainboxUploadFile, sessionId?: string | null, opts: { kind?: 'file' | 'image' } = {}): Promise<BrainboxUploadResponse> {
    if (!file || !file.uri) return Promise.reject(new BrainboxError('No file selected.', { code: 'validation' }));
    const isImage = opts.kind ? opts.kind === 'image' : /^image\//i.test(file.type || '') || IMAGE_RE.test(file.name || '');
    const field = isImage ? 'image' : 'file';
    const form = new FormData();
    form.append(field, { uri: file.uri, name: file.name || (isImage ? 'image.jpg' : 'file'), type: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream') } as any);
    const s = this.scope();
    Object.keys(s).forEach((k) => form.append(k, s[k]));
    if (sessionId) form.append('session_id', sessionId);
    return this.request('POST', `/api/chat/upload/${field}`, { form });
  }

  uploadImage(file: BrainboxUploadFile, sessionId?: string | null): Promise<BrainboxUploadResponse> {
    return this.uploadFile(file, sessionId, { kind: 'image' });
  }

  /** POST /api/chat/feedback — 👍/👎 on an answer. A 👎 is reported to staff as a knowledge gap. */
  sendFeedback(payload: BrainboxFeedbackPayload): Promise<{ ok: boolean }> {
    const s = this.scope(false);
    const body: Record<string, unknown> = { ...s, session_id: payload.session_id, rating: payload.rating };
    if (payload.message_id != null && payload.message_id !== '') {
      const n = Number(payload.message_id);
      body.message_id = Number.isFinite(n) ? n : payload.message_id;
    }
    if (payload.comment) body.comment = payload.comment;
    return this.request('POST', '/api/chat/feedback', { body });
  }

  /** GET /api/health (no key needed). */
  health(): Promise<BrainboxHealth> {
    return this.request('GET', '/api/health', { timeout: 15000 });
  }
}
