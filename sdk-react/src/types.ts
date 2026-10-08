import type { BrainboxReactSDK } from './brainbox-sdk';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  userInitials?: string;
  metadata?: {
    context_used?: boolean;
    [key: string]: any;
  };
}

export interface CustomizationProps {
  // Colors
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;

  // Branding
  logoUrl?: string;
  logoText?: string;
  data?: Record<string, any>;
  manualData?: Record<string, any>;
  user?: {
    name?: string;
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    [key: string]: any;
  };
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

  // Features
  showExportButton?: boolean;
  showVoiceInput?: boolean;
  showFileUpload?: boolean;
  showImageUpload?: boolean;
}

export interface ChatWidgetProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  buttonText?: string;
  placeholder?: string;
  width?: string;
  height?: string;
  design?: 'support' | 'assistant';
  defaultOpen?: boolean;
}

export interface ChatPanelProps extends CustomizationProps {
  sdk: BrainboxReactSDK;
  initialSessionId?: string;
  design?: 'cloud' | 'classic';
}

export interface UseBrainboxChatHook {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sessionId: string | null;
  sessions?: ChatSession[];
  sendMessage: (text: string) => Promise<void>;
  sendVoiceNote: (note: Blob) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  uploadImage: (image: File) => Promise<void>;
  createSession: (title?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exportChat: (format: 'json' | 'pdf') => Promise<void>;
  reset: () => void;
}

export interface BrainboxChatResponse {
  response: string;
  session_id?: string;
  /** Id of the stored assistant message (use it for feedback). */
  message_id?: string | number;
  /** Id of the stored user message. */
  user_message_id?: string | number;
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
