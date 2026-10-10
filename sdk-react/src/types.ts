import type { BrainboxReactSDK } from './brainbox-sdk';

export type ChatRole = 'user' | 'assistant' | 'system';

/** Lifecycle of a message in the UI. */
export type ChatMessageStatus = 'pending' | 'streaming' | 'done' | 'stopped' | 'error';

/** A knowledge-base hit the answer was based on (`search_results` from the backend). */
export interface ChatSource {
  title?: string;
  source?: string;
  url?: string;
  text?: string;
  content?: string;
  score?: number;
  [key: string]: any;
}

export interface ChatMessage {
  /** Local id (stable for React keys). */
  id: string;
  role: ChatRole;
  text: string;
  /** ISO timestamp. */
  timestamp: string;
  userInitials?: string;
  /** Server id of the stored message — used for 👍/👎 feedback. */
  messageId?: string | number;
  /** `streaming` while tokens arrive; `stopped` when the user pressed stop. */
  status?: ChatMessageStatus;
  /** Knowledge-base hits for an assistant answer. */
  sources?: ChatSource[] | null;
  /** The user's rating of an assistant answer. */
  feedback?: 'up' | 'down';
  metadata?: {
    context_used?: boolean;
    cached?: boolean;
    [key: string]: any;
  };
}

/** Light, dark, or follow the operating system. */
export type BrainboxColorMode = 'light' | 'dark' | 'auto';

export interface ChatQuickAction {
  label: string;
  /** Text sent when the chip is clicked (defaults to `label`). */
  prompt?: string;
  /** Icon name: 'sparkles' | 'help' | 'doc' | 'bulb' | 'chat' | 'book' | 'wrench' | 'search'. */
  icon?: string;
}

export interface ChatPromptCard {
  title: string;
  description?: string;
  prompt?: string;
  icon?: string;
}

/** Copy/content overrides (`data` / `manualData`). Every field is optional. */
export interface ChatUiData {
  brand?: { name?: string; subtitle?: string; logoUrl?: string; workspaceName?: string; greetingName?: string };
  bot?: { name?: string; avatarUrl?: string };
  user?: { name?: string; email?: string; avatarUrl?: string };
  /** Welcome title, e.g. "Hi {{name}}". `{{name}}` / `{{botName}}` are interpolated. */
  greeting?: string;
  /** Extra welcome lines shown as assistant bubbles before the first message. */
  introMessages?: string[];
  /** Widget welcome chips. */
  quickActions?: (string | ChatQuickAction)[];
  /** Full-page (ChatPanel) empty-state cards. */
  promptCards?: ChatPromptCard[];
  /** `searchLabel` is the ChatWidget composer's history button label (default "History"). */
  composer?: { placeholder?: string; searchLabel?: string };
  [key: string]: any;
}

export interface ChatPerson {
  name?: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export interface CustomizationProps {
  // Colors
  /** Accent color: user bubbles, send button, focus rings. ChatWidget default #2563eb (blue); ChatPanel default #0071E3. */
  primaryColor?: string;
  /** Second brand color. ChatWidget: text/ink colour in light mode (default #08080a). ChatPanel: end of the brand gradient. */
  accentColor?: string;
  /** Window / page surface color (ChatWidget light-mode default #f3f6fd). */
  backgroundColor?: string;
  /** CSS border of the floating window. */
  border?: string;
  /** Corner radius of the floating window (default 22px). */
  borderRadius?: string;
  /** 'light' (default), 'dark', or 'auto' (follows prefers-color-scheme). */
  mode?: BrainboxColorMode;
  /** UI sounds (send / receive / error). Default true; users can mute from the header. */
  sounds?: boolean;

  // Branding
  logoUrl?: string;
  logoText?: string;
  companyName?: string;
  companyDescription?: string;
  /** Avatar image (e.g. an animated GIF) for the assistant. Defaults to the Brainbox logo. */
  avatarGifUrl?: string;
  data?: ChatUiData;
  manualData?: ChatUiData;
  user?: ChatPerson;
  bot?: {
    name?: string;
    avatarUrl?: string;
    [key: string]: any;
  };

  // Text customization
  headerText?: string;
  sidebarTitle?: string;
  newChatButtonText?: string;
  searchPlaceholder?: string;
  sendButtonText?: string;
  placeholder?: string;

  // Features
  showExportButton?: boolean;
  showVoiceInput?: boolean;
  showFileUpload?: boolean;
  showImageUpload?: boolean;
  /** Show 👍/👎 under answers (default true). */
  showFeedback?: boolean;
  /** Session to open on mount. Otherwise the last session (remembered in localStorage) is restored. */
  initialSessionId?: string;
  /** Remember and restore the last session id in localStorage (default true). */
  persistSession?: boolean;
  /** @deprecated Kept for backwards compatibility; the design is unified. */
  design?: string;
}

export type ChatWidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';

export interface ChatWidgetProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  position?: ChatWidgetPosition;
  /** 'auto' (default) = round icon until `buttonText` is set, then a pill with the text; 'button' = pill, 'icon' = 60px circle, 'gif' = `launcherGifUrl` image. */
  launcherType?: 'auto' | 'icon' | 'button' | 'gif';
  launcherGifUrl?: string;
  /** Launcher text. Empty (default) = icon-only launcher. */
  buttonText?: string;
  /** Window width (default 360px). */
  width?: string;
  /** Window height (default 540px). */
  height?: string;
  defaultOpen?: boolean;
  /** Called whenever the window opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** z-index of the floating layer (default 9999). */
  zIndex?: number;
}

export interface ChatPanelProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  /** CSS height of the panel (default 100%; give the parent a height or pass e.g. "100vh"). */
  height?: string;
  /** Start with the sessions sidebar collapsed. */
  defaultSidebarCollapsed?: boolean;
  /** @deprecated ChatPanel is always full-page; these widget props are accepted and ignored. */
  position?: string;
  buttonText?: string;
  width?: string;
}

export interface UseBrainboxChatOptions {
  /** Remember the last session id in localStorage (default true). */
  persistSession?: boolean;
  /** Part of the storage key so different signed-in users don't share a session. */
  userKey?: string;
  /** Whether the chat UI is visible. While false, finished replies increase `unreadCount`. */
  open?: boolean;
  /** Called when an assistant reply finishes. */
  onReply?: (message: ChatMessage) => void;
  /** Called when sending fails. */
  onError?: (message: string) => void;
}

export interface UseBrainboxChatHook {
  messages: ChatMessage[];
  /** True while waiting for an answer (before and during streaming) or while a session loads. */
  loading: boolean;
  /** True while tokens are arriving. */
  streaming: boolean;
  error: string | null;
  sessionId: string | null;
  /** Sessions (newest first). Empty until `refreshSessions()` has been called once. */
  sessions?: ChatSession[];
  sessionsLoaded: boolean;
  sessionsLoading: boolean;
  /** Replies received while `options.open` was false. */
  unreadCount: number;
  markRead: () => void;
  sendMessage: (text: string) => Promise<void>;
  /** Abort the answer that is streaming (the partial text is kept). */
  stop: () => void;
  /** Re-ask the last question after an error. */
  retry: () => Promise<void>;
  /** Rate an assistant answer (👍/👎) by its local message id. */
  sendFeedback: (localMessageId: string, rating: 'up' | 'down') => Promise<void>;
  sendVoiceNote: (note: Blob) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  uploadImage: (image: File) => Promise<void>;
  /** Start a new conversation. With a `title` the session is created on the server right away. */
  createSession: (title?: string) => Promise<string | null>;
  loadSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  /** Rename a chat in the history. */
  renameSession: (sessionId: string, title: string) => Promise<void>;
  /** Pin / unpin a chat (pinned chats are listed first). */
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>;
  /** Remove a chat from the history (opens a new chat if it was the open one). */
  deleteSession: (sessionId: string) => Promise<void>;
  exportChat: (format: 'json' | 'pdf') => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export interface BrainboxChatResponse {
  response: string;
  session_id?: string;
  /** Id of the stored assistant message (use it for feedback). */
  message_id?: string | number;
  /** Id of the stored user message. */
  user_message_id?: string | number;
  reasoning?: string;
  search_results?: ChatSource[] | null;
  cached?: boolean;
  [key: string]: any;
}

/** First SSE event of /api/chat/stream. */
export interface StreamMeta {
  session_id?: string;
  user_message_id?: string | number;
}

export interface StreamChatOptions {
  /** Abort the request (stop generating). */
  signal?: AbortSignal;
  /** Called once the server has stored the question (carries the session id). */
  onMeta?: (meta: StreamMeta) => void;
}

/** POST /api/chat/feedback. A 'down' rating reports a knowledge gap to staff. */
export interface ChatFeedbackPayload {
  session_id: string;
  message_id?: string | number;
  rating: 'up' | 'down';
  comment?: string;
  user_id?: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  /** Pinned to the top of the history. */
  pinned?: boolean;
}

/** `tenant_id` is optional: the backend takes the tenant from the API key (and rejects a mismatch). */
export interface ChatSessionPayload {
  tenant_id?: string;
  title?: string;
}

export interface ChatPayload {
  tenant_id?: string;
  question: string;
  session_id?: string;
}

export interface IngestPayload {
  tenant_id?: string;
  source_type: string;
  content: string;
  file_path?: string;
  metadata?: Record<string, any>;
  audience?: TrainingAudience;
}

export interface SessionsGroupedByDate {
  pinned?: ChatSession[];
  today: ChatSession[];
  yesterday: ChatSession[];
  this_week: ChatSession[];
  older: ChatSession[];
}

/* ------------------------------------------------------------------ */
/* Training                                                            */
/* ------------------------------------------------------------------ */

export type TrainingSourceKind = 'file' | 'api' | 'text';
export type TrainingSourceStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ApiSourceType = 'support_tickets' | 'api_generic';

/**
 * Who the assistant may use a training source for.
 * - public: anyone, incl. anonymous website visitors (publishable keys always chat as public)
 * - customer: logged-in customers / portal users
 * - vendor: suppliers / vendors
 * - internal: your staff (default for new sources)
 * - admin: administrators only
 * Staff (internal) also see public, customer and vendor content; admins see everything.
 */
export type TrainingAudience = 'public' | 'customer' | 'vendor' | 'internal' | 'admin';

export const TRAINING_AUDIENCES: TrainingAudience[] = ['public', 'customer', 'vendor', 'internal', 'admin'];

export interface TrainingSource {
  source_id: string;
  tenant_id: string;
  name: string;
  kind: TrainingSourceKind;
  source_type: string;
  filename?: string | null;
  url?: string | null;
  /** Missing only on backends that predate audiences. */
  audience?: TrainingAudience;
  status: TrainingSourceStatus;
  documents_count: number;
  records_count?: number | null;
  last_task_id?: string | null;
  last_synced_at?: string | null;
  error_message?: string | null;
  created_at: string;
  config?: Record<string, any> | null;
}

export interface TrainingTaskResponse {
  source: TrainingSource;
  task_id: string;
}

export interface TrainingSourcesResponse {
  sources: TrainingSource[];
  totals: { sources: number; documents: number };
}

export interface DeleteTrainingSourceResponse {
  deleted: boolean;
  documents_deleted: number;
}

export interface ApiSourceMapping {
  id_field?: string;
  question_field?: string;
  answer_field?: string;
  title_field?: string;
  messages_field?: string;
  extra_fields?: string[];
}

export interface ApiSourcePagination {
  type: 'none' | 'page' | 'cursor';
  page_param?: string;
  cursor_path?: string;
  cursor_param?: string;
  max_pages?: number;
}

/** Third-party API source configuration. `tenant_id` is added by the SDK. */
export interface ApiSourceConfig {
  name: string;
  /** Defaults to "internal" on the server. */
  audience?: TrainingAudience;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  data_path?: string;
  source_type: ApiSourceType;
  mapping?: ApiSourceMapping;
  pagination?: ApiSourcePagination;
}

export interface ApiSourceTestResult {
  ok: boolean;
  status_code?: number | null;
  records_found: number;
  preview: { title?: string; text: string }[];
  detected_fields: string[];
  error?: string | null;
}

export interface IngestStatus {
  task_id: string;
  status: string;
  error_message?: string | null;
}

export interface TrainFileOptions {
  name?: string;
  /** Defaults to "internal" on the server. */
  audience?: TrainingAudience;
  onUploadProgress?: (percent: number) => void;
}

/** PATCH /api/train/sources/{id}. A new audience relabels every chunk of the source. */
export interface UpdateTrainingSourcePayload {
  audience?: TrainingAudience;
  name?: string;
}

export interface TrainingPanelProps {
  sdk: BrainboxReactSDK;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  companyName?: string;
  title?: string;
  /** 'embedded' drops the outer padding/background so the panel sits inside another app (e.g. the staff dashboard). */
  variant?: 'default' | 'embedded';
  /** Hide the "add training data" forms and the per-source actions (sync, delete, audience). */
  readOnly?: boolean;
  /** 'light' (default), 'dark' or 'auto'. */
  mode?: BrainboxColorMode;
  /** Success / error sounds (default true). */
  sounds?: boolean;
  /** Show toasts for uploads, training results and errors (default true). */
  toasts?: boolean;
}

export interface UseBrainboxTrainingHook {
  sources: TrainingSource[];
  totals: { sources: number; documents: number };
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  trainFile: (file: File, options?: TrainFileOptions) => Promise<TrainingTaskResponse>;
  trainText: (name: string, content: string, audience?: TrainingAudience) => Promise<TrainingTaskResponse>;
  testApiSource: (config: ApiSourceConfig) => Promise<ApiSourceTestResult>;
  addApiSource: (config: ApiSourceConfig) => Promise<TrainingTaskResponse>;
  syncSource: (sourceId: string) => Promise<TrainingTaskResponse>;
  deleteSource: (sourceId: string) => Promise<DeleteTrainingSourceResponse>;
  updateSource: (sourceId: string, patch: UpdateTrainingSourcePayload) => Promise<TrainingSource>;
}
