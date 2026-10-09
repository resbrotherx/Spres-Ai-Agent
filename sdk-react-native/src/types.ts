/** End user identity. `id` is sent as `user_id` (per-user history), `name` as `user_name`. */
export interface BrainboxUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

/** Response of POST /api/chat (and the `done` event of POST /api/chat/stream). */
export interface BrainboxChatResponse {
  response: string;
  reasoning?: string | null;
  search_results?: BrainboxSearchResult[] | null;
  session_id?: string | null;
  /** Id of the stored assistant message (send it to `sendFeedback`). */
  message_id?: number | string | null;
  user_message_id?: number | string | null;
  /** Only on streamed answers: true when served from the answer cache. */
  cached?: boolean;
  [key: string]: unknown;
}

/** One knowledge-base hit returned with an answer. The shape depends on the source. */
export interface BrainboxSearchResult {
  title?: string;
  source?: string;
  url?: string;
  content?: string;
  text?: string;
  score?: number;
  metadata?: Record<string, any>;
  [key: string]: unknown;
}

export interface BrainboxSession {
  session_id: string;
  title?: string | null;
  created_at: string;
  user_id?: string | null;
}

/** POST /api/chat/sessions */
export interface BrainboxSessionsGrouped {
  today: BrainboxSession[];
  yesterday: BrainboxSession[];
  this_week: BrainboxSession[];
  older: BrainboxSession[];
}

export interface BrainboxStoredMessage {
  id: number;
  role: 'user' | 'assistant' | string;
  content: string;
  created_at: string;
  user_initials?: string | null;
  metadata?: Record<string, any> | null;
}

/** GET /api/chat/session/{id}/messages */
export interface BrainboxSessionDetail {
  session_id: string;
  title?: string | null;
  created_at: string;
  user_id?: string | null;
  messages: BrainboxStoredMessage[];
}

export type BrainboxRating = 'up' | 'down';

export interface BrainboxFeedbackPayload {
  session_id: string;
  message_id?: number | string | null;
  rating: BrainboxRating;
  comment?: string;
}

/** A local file for uploads. Use what your picker returns (expo-document-picker, react-native-image-picker...). */
export interface BrainboxUploadFile {
  uri: string;
  name: string;
  type?: string;
}

export interface BrainboxUploadResponse {
  session_id?: string;
  filename?: string;
  message?: string;
  [key: string]: unknown;
}

export interface BrainboxHealth {
  status?: string;
  [key: string]: unknown;
}

/** `meta` event of the stream. */
export interface BrainboxStreamMeta {
  session_id?: string | null;
  user_message_id?: number | string | null;
}

export interface BrainboxStreamHandlers {
  sessionId?: string | null;
  /** Session + user message stored on the server. */
  onMeta?: (meta: BrainboxStreamMeta) => void;
  /** A text delta arrived. `text` is everything received so far. */
  onToken?: (delta: string, text: string) => void;
  /** Final answer. Replace any streamed text with `result.response`. */
  onDone?: (result: BrainboxChatResponse) => void;
  onError?: (error: import('./errors').BrainboxError) => void;
  /** Called once if the client falls back to POST /api/chat (reason: 'unsupported' | 'error' | 'disabled'). */
  onFallback?: (reason: 'unsupported' | 'error' | 'disabled') => void;
}

export interface BrainboxStreamHandle {
  /** Cancel the request. No further callbacks fire. */
  abort: () => void;
  /** Resolves with the final answer, or `null` on error/abort. Never rejects. */
  done: Promise<BrainboxChatResponse | null>;
}

/** Minimal key-value storage (AsyncStorage-compatible). */
export interface BrainboxStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface BrainboxClientOptions {
  /** Backend base URL, e.g. https://api.example.com (the SDK calls `${apiUrl}/api/...`). */
  apiUrl: string;
  /** Publishable key (`pk_...`). Sent as `Authorization: Bearer <key>`. May be a getter. */
  apiKey?: string | (() => string | null | undefined);
  /** Optional: the backend takes the tenant from the key. If set it must match. */
  tenantId?: string;
  user?: BrainboxUser;
  /** Extra headers on every request. */
  headers?: Record<string, string>;
  /** Request timeout in ms (default 200000 — answers can take ~3 minutes). */
  timeout?: number;
  /** Use POST /api/chat/stream (default true). Falls back to POST /api/chat automatically. */
  streaming?: boolean;
  /** Injected for tests / custom networking. Defaults to the globals. */
  fetch?: typeof fetch;
  XMLHttpRequest?: any;
}
