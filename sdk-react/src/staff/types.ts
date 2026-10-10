import type { TrainingAudience, TrainingSource } from '../types';

/* ------------------------------------------------------------------ */
/* Staff users & auth                                                  */
/* ------------------------------------------------------------------ */

/** owner > admin > trainer > viewer */
export type StaffRole = 'owner' | 'admin' | 'trainer' | 'viewer';

export const STAFF_ROLES: StaffRole[] = ['owner', 'admin', 'trainer', 'viewer'];

export interface StaffUser {
  id: string | number;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  last_login_at: string | null;
  created_at: string;
  /** True while the invite hasn't been accepted yet. */
  invited: boolean;
  /** Brainbox operator: can manage every company via the Platform pages (`/api/platform/*`). */
  is_platform_admin?: boolean;
  /** An admin set this user's password; the dashboard asks them to choose their own at sign-in. */
  must_change_password?: boolean;
}

export interface StaffLoginResponse {
  access_token: string;
  token_type: 'bearer' | string;
  expires_in: number;
  user: StaffUser;
}

export interface UpdateMePayload {
  full_name?: string;
  notify_email?: boolean;
  notify_in_app?: boolean;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AcceptInvitePayload {
  token: string;
  password: string;
  full_name?: string;
}

export interface OkResponse {
  ok: boolean;
}

/* ------------------------------------------------------------------ */
/* Staff management                                                    */
/* ------------------------------------------------------------------ */

export interface StaffListResponse {
  staff: StaffUser[];
}

export interface InviteStaffPayload {
  email: string;
  full_name?: string;
  role: StaffRole;
  /** Set a temporary password (≥ 10 chars) instead of emailing an invite. */
  password?: string;
}

export interface InviteStaffResponse {
  user: StaffUser;
  /** null when a password was set instead. */
  invite_url: string | null;
  email_sent: boolean;
  /** True when the account was created with a temporary password. */
  password_set?: boolean;
}

export interface SetStaffPasswordPayload {
  password: string;
  /** Ask the user to choose their own password at the next sign-in (default true). */
  must_change_password?: boolean;
}

export interface UpdateStaffPayload {
  role?: StaffRole;
  is_active?: boolean;
  full_name?: string;
  notify_email?: boolean;
}

export interface ResendInviteResponse {
  invite_url: string;
  email_sent: boolean;
}

/* ------------------------------------------------------------------ */
/* Knowledge gaps                                                      */
/* ------------------------------------------------------------------ */

export type GapReason = 'no_context' | 'low_confidence' | 'llm_unknown' | 'llm_unavailable' | 'negative_feedback';
export type GapStatus = 'open' | 'resolved' | 'dismissed';

export const GAP_REASONS: GapReason[] = ['no_context', 'low_confidence', 'llm_unknown', 'negative_feedback', 'llm_unavailable'];

export interface KnowledgeGap {
  id: string | number;
  tenant_id: string;
  question: string;
  reason: GapReason;
  status: GapStatus;
  occurrences: number;
  best_distance: number | null;
  answer_given: string | null;
  session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  resolution_note: string | null;
  /** Staff name. */
  resolved_by: string | null;
  resolved_at: string | null;
  /** Training source created from the staff answer. */
  source_id: string | null;
  /** Comment left with the most recent thumbs-down (negative_feedback gaps). */
  last_feedback_comment?: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface GapListParams {
  status?: GapStatus | 'all';
  reason?: GapReason | '';
  q?: string;
  page?: number;
  page_size?: number;
}

export interface GapListResponse {
  items: KnowledgeGap[];
  total: number;
  page: number;
  page_size: number;
  counts: { open: number; resolved: number; dismissed: number };
}

export interface UpdateGapPayload {
  status?: GapStatus;
  resolution_note?: string;
}

export interface AnswerGapPayload {
  answer: string;
  audience?: TrainingAudience;
  also_resolve_similar?: boolean;
}

export interface AnswerGapResponse {
  gap: KnowledgeGap;
  source: TrainingSource;
  task_id: string;
  /** How many other open gaps were resolved with `also_resolve_similar`. */
  resolved_similar?: number;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationType = 'gap' | 'feedback' | 'training_failed' | 'staff';

export interface StaffNotification {
  id: string | number;
  type: NotificationType;
  title: string;
  body: string;
  /** Dashboard hash route, e.g. "#/gaps/12". */
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: StaffNotification[];
  unread_count: number;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface OverviewReport {
  range: { from: string; to: string; days: number };
  totals: {
    conversations: number;
    questions: number;
    answered: number;
    unanswered: number;
    /** 0–1 */
    answer_rate: number;
    gaps_open: number;
    sources: number;
    documents: number;
    staff: number;
  };
  daily: { date: string; questions: number; unanswered: number }[];
  by_role: { role: string; questions: number }[];
  top_questions: { question: string; count: number }[];
  recent_gaps: KnowledgeGap[];
  sources_by_status: { completed: number; processing: number; queued: number; failed: number };
}

export interface ConversationSummary {
  session_id: string;
  title: string | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  message_count: number;
  created_at: string;
  last_message_at: string | null;
  has_gap: boolean;
}

export interface ConversationListParams {
  q?: string;
  user_role?: string;
  page?: number;
  page_size?: number;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface ConversationMessage {
  id: string | number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  created_at: string;
  /** Set on assistant messages that produced a knowledge gap. */
  gap_reason?: GapReason | null;
  /** End-user rating of an assistant message. */
  feedback?: 'up' | 'down' | null;
}

export interface ConversationDetail {
  session_id: string;
  title: string | null;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  created_at: string;
  messages: ConversationMessage[];
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface WidgetSettings {
  theme: { primary: string; panel: string; ink: string };
  branding: { botName: string; title: string | null; subtitle: string | null; logoUrl: string | null };
  launcher: { type: 'button' | 'icon' | 'gif' | string; text: string };
  welcomeMessages: string[];
  quickActions: string[];
  placeholder: string;
}

export interface TenantSettings {
  tenant_id: string;
  display_name: string | null;
  support_email: string | null;
  gap_distance_threshold: number;
  notify_on_gap: boolean;
  notify_on_feedback: boolean;
  email_max_per_hour: number;
  /** Read-only: whether SMTP is configured on the server. */
  smtp_configured: boolean;
  widget: WidgetSettings;
}

/** PUT /api/settings is a partial merge. */
export type TenantSettingsUpdate = Partial<Omit<TenantSettings, 'tenant_id' | 'smtp_configured' | 'widget'>> & {
  widget?: Partial<WidgetSettings>;
};

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

export type ApiKeyType = 'publishable' | 'secret';

export interface ApiKeyInfo {
  id: string | number;
  name: string;
  key_type: ApiKeyType;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
  expires_at: string | null;
  expired?: boolean;
  /** An admin can show the full key again (keys created before this feature: roll first). */
  can_reveal?: boolean;
}

export interface CreateApiKeyPayload {
  name: string;
  key_type: ApiKeyType;
  expires_at?: string | null;
}

export interface CreateApiKeyResponse {
  key: ApiKeyInfo;
  /** Shown once — store it now. */
  raw_key: string;
}

/** Roll = a replacement key (same name/type) is created and the old one revoked. */
export interface RollApiKeyResponse<K = ApiKeyInfo> {
  key: K;
  /** The NEW raw key — shown once. */
  raw_key: string;
  revoked_id: string | number;
}

/* ------------------------------------------------------------------ */
/* Platform admin (/api/platform/*)                                    */
/* ------------------------------------------------------------------ */

export type PlatformUserStatus = 'active' | 'invited' | 'must_change' | 'disabled';

export interface PlatformTenant {
  tenant_id: string;
  display_name: string;
  staff_count: number;
  owners: string[];
  key_counts: { publishable: number; secret: number; active: number; total?: number };
  documents: number;
  sources: number;
  conversations: number;
  open_gaps: number;
  last_activity_at: string | null;
  created_at: string | null;
}

export interface PlatformUser extends StaffUser {
  tenant_name: string;
  status: PlatformUserStatus;
  has_password: boolean;
}

export interface PlatformApiKey extends ApiKeyInfo {
  tenant_id: string;
  tenant_name: string;
}

export interface PlatformTenantDetail extends PlatformTenant {
  usage: { days: number; questions: number; unanswered: number; questions_all_time: number };
  staff: PlatformUser[];
  keys: PlatformApiKey[];
}

export interface PlatformOverview {
  tenants: number;
  staff: number;
  staff_active: number;
  platform_admins: number;
  keys: { publishable: number; secret: number; active: number; revoked: number };
  documents: number;
  sources: number;
  conversations: number;
  questions_30d: number;
  open_gaps: number;
}

export interface CreateTenantPayload {
  tenant_id: string;
  display_name?: string;
  owner: { email: string; full_name?: string; password?: string };
  create_keys?: { publishable?: boolean; secret?: boolean };
}

export interface CreateTenantResponse {
  tenant: PlatformTenant;
  owner: StaffUser;
  password_set: boolean;
  invite_url?: string;
  email_sent?: boolean;
  /** Raw keys — shown once. */
  keys: { key: ApiKeyInfo & { tenant_id?: string }; raw_key: string }[];
}

export interface PlatformUserListParams {
  q?: string;
  tenant_id?: string;
  role?: StaffRole | '';
  status?: PlatformUserStatus | '';
  platform_admin?: boolean;
}

export interface PlatformCreateUserPayload {
  tenant_id: string;
  email: string;
  full_name?: string;
  role: StaffRole;
  password?: string;
  must_change_password?: boolean;
  is_platform_admin?: boolean;
}

export interface PlatformCreateUserResponse {
  user: PlatformUser;
  password_set: boolean;
  invite_url?: string;
  email_sent?: boolean;
}

export interface PlatformUpdateUserPayload {
  role?: StaffRole;
  is_active?: boolean;
  full_name?: string;
  is_platform_admin?: boolean;
  tenant_id?: string;
}

export interface PlatformCreateKeyPayload extends CreateApiKeyPayload {
  tenant_id: string;
}

/* ------------------------------------------------------------------ */
/* Client / component options                                          */
/* ------------------------------------------------------------------ */

export interface BrainboxStaffClientOptions {
  apiUrl: string;
  /** Initial JWT. Defaults to the one persisted in localStorage for this apiUrl. */
  token?: string | null;
  /** Called after a 401 (the stored token has already been cleared). */
  onUnauthorized?: () => void;
  /** Persist the token in localStorage (default true). */
  persist?: boolean;
}

export interface StaffDashboardTheme {
  /** Color scheme: 'light' (default), 'dark' or 'auto' (follows the OS). Users can override it from the account menu. */
  mode?: 'light' | 'dark' | 'auto';
  /** Accent color (buttons, links, charts). Default #0071E3. */
  primary?: string;
  primaryHover?: string;
  accent?: string;
  sidebarFrom?: string;
  sidebarTo?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  radius?: number;
  fontFamily?: string;
}

export interface StaffDashboardProps {
  apiUrl: string;
  brandName?: string;
  logoUrl?: string;
  theme?: StaffDashboardTheme;
  /** Hash prefix for every dashboard route, e.g. "/staff" → `#/staff/overview`. Default ''. */
  routePrefix?: string;
  /** Pixels of fixed host chrome above the dashboard (keeps the sidebar sticky below it). Default 0. */
  offsetTop?: number;
  /** Provide your own client (e.g. shared with other code); otherwise one is created from apiUrl. */
  client?: import('./staffClient').BrainboxStaffClient;
  className?: string;
  /** UI sounds (WebAudio, generated). Default true; users can mute from the top bar (persisted). */
  sounds?: boolean;
  /** Real-time updates via `GET /api/staff/events` (SSE), falling back to polling. Default true. */
  live?: boolean;
}

/* ------------------------------------------------------------------ */
/* Real-time events (GET /api/staff/events)                            */
/* ------------------------------------------------------------------ */

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'polling';

export interface LiveGapEvent {
  action: 'created' | 'updated' | 'resolved' | 'dismissed';
  gap: KnowledgeGap;
}

export interface LiveConversationEvent {
  action: 'message';
  session_id: string;
  title: string | null;
  user_name: string | null;
  user_role: string | null;
  role: 'user' | 'assistant';
  preview: string;
  created_at: string;
  /** Optional extras some servers include. */
  message_id?: string | number;
  gap_reason?: GapReason | null;
}

export interface LiveTrainingEvent {
  action: 'status';
  source: TrainingSource;
}

export interface LiveOverviewEvent {
  questions_today: number;
  unanswered_today: number;
  open_gaps: number;
}

/* ------------------------------- knowledge (Messages page) ------------------------------- */

export type KnowledgeAudience = 'public' | 'customer' | 'vendor' | 'internal' | 'admin';
/** How a label was decided: training source, automatic labeller, or a staff member. */
export type KnowledgeOrigin = 'source' | 'auto' | 'staff';

export interface KnowledgeDoc {
  id: number;
  content: string;
  length: number;
  source_type: string;
  source_id: string | null;
  source_name: string | null;
  file_path: string | null;
  audience: KnowledgeAudience | null;
  effective_audience: KnowledgeAudience;
  origin: KnowledgeOrigin | null;
  reason: string | null;
  created_at: string;
}

export interface KnowledgeLabelJob {
  state: 'idle' | 'running' | 'done' | 'failed';
  scope?: 'unlabelled' | 'auto';
  use_ai?: boolean;
  done?: number;
  total?: number;
  counts?: Partial<Record<KnowledgeAudience, number>>;
  started_at?: string;
  finished_at?: string | null;
  started_by?: string | null;
  error?: string | null;
}

export interface KnowledgeListParams {
  audience?: KnowledgeAudience | 'unlabelled' | '';
  origin?: KnowledgeOrigin | '';
  source_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface KnowledgeListResponse {
  items: KnowledgeDoc[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<KnowledgeAudience | 'unlabelled', number>;
  origin_counts: Record<string, number>;
  legacy_audience: KnowledgeAudience;
  job: KnowledgeLabelJob;
}

export interface ChatMessageRecord {
  id: number;
  session_id: string;
  sender: 'user' | 'assistant' | string;
  content: string;
  created_at: string;
  conversation_title: string | null;
  user_name: string | null;
  user_id: string | null;
  user_role: string | null;
  /** false = sent before roles were recorded (treated as public). */
  role_recorded: boolean;
}

export interface MessageListParams {
  role?: string;
  sender?: 'user' | 'assistant' | '';
  q?: string;
  page?: number;
  page_size?: number;
}

export interface MessageListResponse {
  items: ChatMessageRecord[];
  total: number;
  page: number;
  page_size: number;
  role_counts: Record<string, number>;
}

export interface LiveEventMap {
  hello: { user_id: string | number; tenant_id: string; server_time: string };
  notification: StaffNotification;
  gap: LiveGapEvent;
  conversation: LiveConversationEvent;
  training: LiveTrainingEvent;
  staff: { action: 'created' | 'updated' | 'deleted'; user: StaffUser };
  keys: { action: 'created' | 'rolled' | 'revoked'; key: ApiKeyInfo };
  overview: LiveOverviewEvent;
  /** Automatic knowledge labelling progress (Messages page). */
  knowledge: { action: 'started' | 'progress' | 'finished'; job: KnowledgeLabelJob };
  /** Client-side: polling fallback asks pages to refresh silently (every 30 s). */
  poll: { at: number };
  /** Client-side: stream (re)connected after a gap — refetch anything that may have missed events. */
  resync: { at: number };
}
