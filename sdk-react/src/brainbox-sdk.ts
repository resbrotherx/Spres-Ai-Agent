import axios, { AxiosInstance } from 'axios';
import {
  ChatPayload,
  ChatFeedbackPayload,
  ChatSession,
  ChatSessionPayload,
  IngestPayload,
  BrainboxChatResponse,
  SessionsGroupedByDate,
  ApiSourceConfig,
  ApiSourceTestResult,
  DeleteTrainingSourceResponse,
  IngestStatus,
  TrainFileOptions,
  TrainingSource,
  TrainingAudience,
  TrainingSourcesResponse,
  TrainingTaskResponse,
  UpdateTrainingSourcePayload,
  StreamChatOptions,
  StreamMeta
} from './types';

/** Message shown when a publishable (browser) key hits a secret-only endpoint such as training. */
export const SECRET_KEY_REQUIRED_MESSAGE = "This key can't train the AI — use a secret key on a server.";

/** Error thrown by the training methods; `message` carries the backend `detail` when present. */
export class BrainboxApiError extends Error {
  status?: number;
  detail?: unknown;
  /** 'auth' = missing/invalid key (401), 'scope' = key type not allowed (403), 'tenant' = tenant mismatch (403). */
  code?: 'auth' | 'scope' | 'tenant';

  constructor(message: string, status?: number, detail?: unknown, code?: BrainboxApiError['code']) {
    super(message);
    this.name = 'BrainboxApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

function formatDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc, msg, type}]
    const parts = detail.map((d: any) => {
      if (d && typeof d === 'object' && d.msg) {
        const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
        return loc ? `${loc}: ${d.msg}` : String(d.msg);
      }
      return typeof d === 'string' ? d : JSON.stringify(d);
    });
    return parts.join('; ');
  }
  if (typeof detail === 'object') {
    const anyDetail = detail as any;
    if (typeof anyDetail.message === 'string') return anyDetail.message;
    try {
      return JSON.stringify(detail);
    } catch {
      return null;
    }
  }
  return String(detail);
}

/** Build a BrainboxApiError from an HTTP status + parsed body (`hasResponse=false` = network failure). */
function errorFromResponse(status: number | undefined, data: any, hasResponse: boolean): BrainboxApiError {
  const detail = data && typeof data === 'object' ? data.detail ?? data.error ?? data.message : undefined;
  let message = formatDetail(detail);
  const raw = (message || '').toLowerCase();
  if (status === 401) {
    return new BrainboxApiError(
      'Invalid or missing API key (401). Check the key passed to BrainboxReactSDK — it may be revoked or expired.',
      status,
      detail,
      'auth'
    );
  }
  if (status === 403 && raw.includes('secret')) {
    return new BrainboxApiError(SECRET_KEY_REQUIRED_MESSAGE, status, detail, 'scope');
  }
  if (status === 403 && raw.includes('tenant_id')) {
    return new BrainboxApiError(
      "The tenant ID doesn't match this API key's tenant (403). Use the tenant the key was created for, or omit it.",
      status,
      detail,
      'tenant'
    );
  }
  // FastAPI's generic 404 ("Not Found") means the route itself is missing.
  if (status === 404 && (!message || message === 'Not Found')) message = null;
  if (!message) {
    if (!hasResponse) {
      message = 'Network error: could not reach the Brainbox server.';
    } else if (status === 404) {
      message = 'Endpoint not found (404). The training API may not be available on this server yet.';
    } else if (status === 403) {
      message = 'Not allowed (403). Check your API key.';
    } else {
      message = `Request failed with status ${status}.`;
    }
  }
  return new BrainboxApiError(message, status, detail);
}

/** Convert an axios (or other) error into a BrainboxApiError with a readable message. */
export function toBrainboxError(error: unknown): BrainboxApiError {
  if (error instanceof BrainboxApiError) return error;
  if (axios.isAxiosError(error)) {
    return errorFromResponse(error.response?.status, error.response?.data, !!error.response);
  }
  if (error instanceof Error) return new BrainboxApiError(error.message);
  return new BrainboxApiError('Unknown error');
}

/** True for an AbortController cancellation (fetch AbortError or axios CanceledError). */
export function isAbortError(error: unknown): boolean {
  const e = error as any;
  return !!e && (e.name === 'AbortError' || e.name === 'CanceledError' || e.code === 'ERR_CANCELED');
}

/** A static key/token, or a function returning the current one (e.g. a staff JWT that can change after login). */
export type BrainboxCredential = string | (() => string | null | undefined);

export class BrainboxReactSDK {
  private apiUrl: string;
  private credential: BrainboxCredential;
  private tenantId?: string;
  private client: AxiosInstance;
  /** Set after the server answers 404/405 on /api/chat/stream, so later messages skip the probe. */
  private streamUnsupported = false;

  /**
   * @param apiKey   Publishable key (`pk_live_...`) for chat in browsers; secret key (`sk_live_...`)
   *                 for training/ingest — only in server-side or internal admin tools. May also be a
   *                 function returning the current bearer token (e.g. a staff dashboard JWT); it is
   *                 called on every request.
   * @param tenantId Optional: the backend takes the tenant from the key. If given it must match.
   */
  constructor(apiUrl: string, apiKey: BrainboxCredential, tenantId?: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.credential = apiKey;
    this.tenantId = tenantId && tenantId.trim() ? tenantId.trim() : undefined;

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.client.interceptors.request.use((config) => {
      const token = this.apiKey;
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
      return config;
    });
  }

  /** The current key/token (resolves a getter). */
  private get apiKey(): string {
    const c = this.credential;
    return (typeof c === 'function' ? c() : c) || '';
  }

  /** Base URL of the Brainbox API (no trailing slash). */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /** Tenant passed to the constructor, if any (otherwise the key's tenant is used server-side). */
  getTenantId(): string | undefined {
    return this.tenantId;
  }

  /** `{ tenant_id }` when a tenant was configured, else `{}` (the key's tenant is used). */
  private tenant(): { tenant_id?: string } {
    return this.tenantId ? { tenant_id: this.tenantId } : {};
  }

  private appendTenant(formData: FormData): void {
    if (this.tenantId) formData.append('tenant_id', this.tenantId);
  }

  async ingest(
    sourceType: string,
    content: string,
    filePath?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const payload: IngestPayload = {
      ...this.tenant(),
      source_type: sourceType,
      content,
      file_path: filePath,
      metadata: metadata || {}
    };

    const response = await this.client.post('/api/ingest', payload);
    return response.data;
  }

  /** Non-streaming chat (POST /api/chat). */
  async chat(question: string, sessionId?: string, options: { signal?: AbortSignal } = {}): Promise<BrainboxChatResponse> {
    const payload: ChatPayload = {
      ...this.tenant(),
      question,
      session_id: sessionId
    };

    const response = await this.client.post('/api/chat', payload, { signal: options.signal });
    return response.data;
  }

  /**
   * Streaming chat over Server-Sent Events (POST /api/chat/stream).
   *
   * Tokens are delivered to `onChunk` as they arrive; `onComplete` receives the final
   * response (its `response` is the authoritative full text). When the server has no
   * streaming endpoint (404/405) the SDK transparently falls back to POST /api/chat and
   * delivers the whole answer as a single chunk.
   *
   * Pass `options.signal` to cancel: the request is aborted and neither `onComplete` nor
   * `onError` is called.
   */
  async streamChat(
    question: string,
    sessionId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete?: (result: BrainboxChatResponse) => void,
    onError?: (error: BrainboxApiError) => void,
    options: StreamChatOptions = {}
  ): Promise<void> {
    const { signal, onMeta } = options;
    const fallback = async () => {
      const result = await this.chat(question, sessionId, { signal });
      if (signal?.aborted) return;
      if (result?.session_id) onMeta?.({ session_id: result.session_id, user_message_id: result.user_message_id });
      const text = typeof result?.response === 'string' ? result.response : '';
      if (text) onChunk(text);
      onComplete?.(result);
    };

    try {
      if (this.streamUnsupported || typeof fetch !== 'function') {
        await fallback();
        return;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
      const token = this.apiKey;
      if (token) headers.Authorization = `Bearer ${token}`;
      const payload: ChatPayload = { ...this.tenant(), question, session_id: sessionId };

      let res: Response;
      try {
        res = await fetch(`${this.apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal
        });
      } catch (err) {
        if (isAbortError(err)) return;
        throw errorFromResponse(undefined, null, false);
      }

      const readJson = async (): Promise<any> => {
        try {
          return await res.json();
        } catch {
          return null;
        }
      };

      if (!res.ok) {
        const data = await readJson();
        const detail = data && typeof data === 'object' ? data.detail : undefined;
        // Route missing (FastAPI "Not Found") or method not allowed → server predates streaming.
        if (res.status === 405 || (res.status === 404 && (detail == null || detail === 'Not Found'))) {
          this.streamUnsupported = true;
          await fallback();
          return;
        }
        throw errorFromResponse(res.status, data, true);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        // A proxy (or an older server) answered with a plain JSON chat response.
        const data = (await readJson()) as BrainboxChatResponse | null;
        if (!data) throw new BrainboxApiError('Unexpected response from the chat server.', res.status);
        if (data.session_id) onMeta?.({ session_id: data.session_id, user_message_id: data.user_message_id });
        if (data.response) onChunk(data.response);
        onComplete?.(data);
        return;
      }

      let streamed = '';
      let meta: StreamMeta | null = null;
      let finished = false;
      const handleEvent = (event: string, data: string) => {
        if (finished) return;
        let parsed: any = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = null;
        }
        if (event === 'meta' && parsed) {
          meta = parsed as StreamMeta;
          onMeta?.(meta);
        } else if (event === 'token') {
          const t = parsed && typeof parsed.t === 'string' ? parsed.t : '';
          if (t) {
            streamed += t;
            onChunk(t);
          }
        } else if (event === 'done') {
          finished = true;
          const result: BrainboxChatResponse = {
            ...(parsed || {}),
            response: parsed && typeof parsed.response === 'string' ? parsed.response : streamed,
            session_id: parsed?.session_id ?? meta?.session_id
          };
          onComplete?.(result);
        } else if (event === 'error') {
          finished = true;
          const detail = parsed?.detail || 'The assistant could not finish this answer.';
          onError?.(new BrainboxApiError(String(detail), parsed?.status, parsed?.detail));
        }
      };

      await readSse(res, handleEvent, signal);
      if (signal?.aborted) return;
      if (!finished) {
        const m = meta as StreamMeta | null;
        if (streamed) {
          onComplete?.({ response: streamed, session_id: m?.session_id, user_message_id: m?.user_message_id });
        } else {
          throw new BrainboxApiError('The connection closed before the answer arrived. Please try again.');
        }
      }
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return;
      onError?.(toBrainboxError(error));
    }
  }

  async createChatSession(title?: string): Promise<any> {
    const payload: ChatSessionPayload = {
      ...this.tenant(),
      title: title || 'New Session'
    };

    const response = await this.client.post('/api/chat/session', payload);
    return response.data;
  }

  async listSessions(): Promise<SessionsGroupedByDate> {
    const response = await this.client.post('/api/chat/sessions', this.tenant());
    return response.data;
  }

  /** Rename and/or pin a chat in the history. */
  async updateSession(sessionId: string, changes: { title?: string; pinned?: boolean }): Promise<ChatSession> {
    return this.request(() =>
      this.client.post<ChatSession>(`/api/chat/session/${encodeURIComponent(sessionId)}/update`, { ...this.tenant(), ...changes })
    );
  }

  renameSession(sessionId: string, title: string): Promise<ChatSession> {
    return this.updateSession(sessionId, { title });
  }

  pinSession(sessionId: string, pinned: boolean): Promise<ChatSession> {
    return this.updateSession(sessionId, { pinned });
  }

  /** Remove a chat from the history (staff reports keep it). */
  async deleteSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request(() =>
      this.client.post<{ ok: boolean }>(`/api/chat/session/${encodeURIComponent(sessionId)}/delete`, this.tenant())
    );
  }

  async getSessionMessages(sessionId: string): Promise<any> {
    const response = await this.client.get(`/api/session/${sessionId}/messages`);
    return response.data;
  }

  async uploadFile(file: File, sessionId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    this.appendTenant(formData);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const response = await this.client.post('/api/chat/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async uploadImage(image: File, sessionId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('image', image);
    this.appendTenant(formData);
    if (sessionId) {
      formData.append('session_id', sessionId);
    }

    const response = await this.client.post('/api/chat/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /** Rate an assistant answer. A thumbs-down is reported to staff as a knowledge gap. */
  async sendFeedback(payload: ChatFeedbackPayload): Promise<{ ok: boolean }> {
    return this.request(() => this.client.post<{ ok: boolean }>('/api/chat/feedback', { ...this.tenant(), ...payload }));
  }

  async healthCheck(): Promise<any> {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  getUserProfile(): any {
    try {
      const token = this.apiKey;
      const payload = token?.split?.('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      const name = decoded.name || decoded.full_name || decoded.username || decoded.sub || 'User';
      return {
        name,
        email: decoded.email || '',
        username: decoded.username || decoded.sub || name,
        firstName: decoded.first_name || decoded.given_name || '',
        lastName: decoded.last_name || decoded.family_name || '',
        avatarUrl: decoded.avatar_url || decoded.picture || ''
      };
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Training                                                          */
  /* ---------------------------------------------------------------- */

  private async request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await fn();
      return response.data;
    } catch (error) {
      throw toBrainboxError(error);
    }
  }

  /** Upload a document (PDF, XML, TXT, MD, CSV, JSON, DOCX...) and train on it. */
  async trainFile(file: File, nameOrOptions?: string | TrainFileOptions): Promise<TrainingTaskResponse> {
    const options: TrainFileOptions =
      typeof nameOrOptions === 'string' ? { name: nameOrOptions } : nameOrOptions || {};
    const formData = new FormData();
    formData.append('file', file);
    this.appendTenant(formData);
    if (options.name) formData.append('name', options.name);
    if (options.audience) formData.append('audience', options.audience);

    return this.request(() =>
      this.client.post<TrainingTaskResponse>('/api/train/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!options.onUploadProgress) return;
          const total = event.total || file.size || 0;
          const percent = total ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0;
          options.onUploadProgress(percent);
        }
      })
    );
  }

  /** Train on raw text. `audience` defaults to "internal" on the server. */
  async trainText(name: string, content: string, audience?: TrainingAudience): Promise<TrainingTaskResponse> {
    return this.request(() =>
      this.client.post<TrainingTaskResponse>('/api/train/text', {
        ...this.tenant(),
        name,
        content,
        ...(audience ? { audience } : {})
      })
    );
  }

  /** Dry-run a third-party API source: fetch, normalize and preview records without training. */
  async testApiSource(config: ApiSourceConfig): Promise<ApiSourceTestResult> {
    return this.request(() =>
      this.client.post<ApiSourceTestResult>('/api/train/api-source/test', {
        ...config,
        ...this.tenant()
      })
    );
  }

  /** Save a third-party API source (e.g. a support-ticket system) and start training on it. */
  async addApiSource(config: ApiSourceConfig): Promise<TrainingTaskResponse> {
    return this.request(() =>
      this.client.post<TrainingTaskResponse>('/api/train/api-source', {
        ...config,
        ...this.tenant()
      })
    );
  }

  /** Re-fetch an API source and retrain on its latest records. */
  async syncSource(sourceId: string): Promise<TrainingTaskResponse> {
    return this.request(() =>
      this.client.post<TrainingTaskResponse>(
        `/api/train/sources/${encodeURIComponent(sourceId)}/sync`,
        null,
        { params: this.tenant() }
      )
    );
  }

  /** List every training source for this tenant. */
  async listSources(): Promise<TrainingSourcesResponse> {
    return this.request(() =>
      this.client.get<TrainingSourcesResponse>('/api/train/sources', {
        params: this.tenant()
      })
    );
  }

  async getSource(sourceId: string): Promise<TrainingSource> {
    return this.request(() =>
      this.client.get<TrainingSource>(`/api/train/sources/${encodeURIComponent(sourceId)}`, {
        params: this.tenant()
      })
    );
  }

  /** Delete a training source and all documents/chunks it produced. */
  async deleteSource(sourceId: string): Promise<DeleteTrainingSourceResponse> {
    return this.request(() =>
      this.client.delete<DeleteTrainingSourceResponse>(`/api/train/sources/${encodeURIComponent(sourceId)}`, {
        params: this.tenant()
      })
    );
  }

  /** Rename and/or change who can see a source. A new audience relabels all of its chunks at once. */
  async updateSource(sourceId: string, patch: UpdateTrainingSourcePayload): Promise<TrainingSource> {
    return this.request(() =>
      this.client.patch<TrainingSource>(`/api/train/sources/${encodeURIComponent(sourceId)}`, patch, {
        params: this.tenant()
      })
    );
  }

  async getIngestStatus(taskId: string): Promise<IngestStatus> {
    return this.request(() =>
      this.client.get<IngestStatus>(`/api/ingest/status/${encodeURIComponent(taskId)}`)
    );
  }
}

/** Read a `text/event-stream` body and dispatch each `event:` / `data:` block. */
async function readSse(
  res: Response,
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let buffer = '';
  const flush = (final: boolean) => {
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = final ? '' : parts.pop() || '';
    for (const block of parts) {
      if (!block.trim()) continue;
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue; // comments / heartbeats
        const idx = line.indexOf(':');
        const field = idx === -1 ? line : line.slice(0, idx);
        let value = idx === -1 ? '' : line.slice(idx + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      onEvent(event, data.join('\n'));
    }
  };

  const body = res.body;
  if (!body || typeof body.getReader !== 'function') {
    buffer = (await res.text()) + '\n\n';
    flush(true);
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      flush(false);
      if (signal?.aborted) break;
    }
    if (!signal?.aborted) {
      buffer += decoder.decode() + '\n\n';
      flush(true);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
