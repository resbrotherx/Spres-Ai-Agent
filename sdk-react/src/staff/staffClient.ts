import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BrainboxApiError, BrainboxReactSDK, toBrainboxError } from '../brainbox-sdk';
import type {
  ApiSourceConfig,
  ApiSourceTestResult,
  DeleteTrainingSourceResponse,
  IngestStatus,
  TrainFileOptions,
  TrainingAudience,
  TrainingSource,
  TrainingSourcesResponse,
  TrainingTaskResponse,
  UpdateTrainingSourcePayload
} from '../types';
import type {
  AcceptInvitePayload,
  AnswerGapPayload,
  AnswerGapResponse,
  ApiKeyInfo,
  BrainboxStaffClientOptions,
  ChangePasswordPayload,
  ConversationDetail,
  ConversationListParams,
  ConversationListResponse,
  CreateApiKeyPayload,
  CreateApiKeyResponse,
  GapListParams,
  GapListResponse,
  InviteStaffPayload,
  InviteStaffResponse,
  KnowledgeGap,
  NotificationListResponse,
  OkResponse,
  OverviewReport,
  ResendInviteResponse,
  StaffLoginResponse,
  StaffUser,
  TenantSettings,
  TenantSettingsUpdate,
  UpdateGapPayload,
  UpdateMePayload,
  UpdateStaffPayload,
  WidgetSettings
} from './types';

const TOKEN_PREFIX = 'bb-staff-token:';

function storageKey(apiUrl: string): string {
  return `${TOKEN_PREFIX}${apiUrl}`;
}

function readStored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode) — keep the token in memory only */
  }
}

/** Pull `detail` out of an API error into a readable message (keeps FastAPI's text for 401/403). */
function staffError(error: unknown): BrainboxApiError {
  const base = toBrainboxError(error);
  const detail = base.detail;
  if ((base.status === 401 || base.status === 403 || base.status === 429) && typeof detail === 'string' && detail) {
    return new BrainboxApiError(detail, base.status, detail, base.code);
  }
  if (base.status === 401) {
    return new BrainboxApiError('Your session has expired. Please sign in again.', 401, detail, 'auth');
  }
  if (base.status === 429 && !detail) {
    return new BrainboxApiError('Too many attempts. Please wait a few minutes and try again.', 429, detail);
  }
  return base;
}

/**
 * Typed client for the Brainbox staff dashboard API (`/api/staff`, `/api/reports`, `/api/settings`, …).
 * Authenticates with a staff JWT (from `login`), persisted in localStorage under `bb-staff-token:<apiUrl>`
 * and cleared automatically on any 401. Training methods reuse {@link BrainboxReactSDK} with the same token
 * (the tenant comes from the JWT, so no tenant id is needed).
 */
export class BrainboxStaffClient {
  readonly apiUrl: string;
  /** A BrainboxReactSDK authenticated with the staff token — pass it to `<TrainingPanel sdk={…} />`. */
  readonly sdk: BrainboxReactSDK;
  private http: AxiosInstance;
  private token: string | null;
  private persist: boolean;
  private key: string;
  private listeners = new Set<(token: string | null) => void>();
  onUnauthorized?: () => void;

  constructor(options: BrainboxStaffClientOptions) {
    this.apiUrl = (options.apiUrl || '').replace(/\/+$/, '');
    this.key = storageKey(this.apiUrl);
    this.persist = options.persist !== false;
    this.token = options.token !== undefined ? options.token : this.persist ? readStored(this.key) : null;
    if (options.token && this.persist) writeStored(this.key, options.token);
    this.onUnauthorized = options.onUnauthorized;

    this.http = axios.create({ baseURL: this.apiUrl, headers: { 'Content-Type': 'application/json' } });
    this.http.interceptors.request.use((config) => {
      if (this.token) config.headers.set('Authorization', `Bearer ${this.token}`);
      return config;
    });
    this.sdk = new BrainboxReactSDK(this.apiUrl, () => this.token);
  }

  /* -------------------------- token handling -------------------------- */

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
    if (this.persist) writeStored(this.key, token);
    this.listeners.forEach((fn) => fn(token));
  }

  /** Subscribe to token changes (login, logout, 401). Returns an unsubscribe function. */
  onTokenChange(fn: (token: string | null) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  logout(): void {
    this.setToken(null);
  }

  private async call<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const res = await this.http.request<T>(config);
      return res.data;
    } catch (err) {
      const e = staffError(err);
      if (e.status === 401 && this.token && !String(config.url || '').startsWith('/api/staff/login')) {
        this.setToken(null);
        this.onUnauthorized?.();
      }
      throw e;
    }
  }

  /** Wrap SDK (training) calls so a 401 also clears the session. */
  private async viaSdk<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const e = staffError(err);
      if (e.status === 401 && this.token) {
        this.setToken(null);
        this.onUnauthorized?.();
      }
      throw e;
    }
  }

  private seg(id: string | number): string {
    return encodeURIComponent(String(id));
  }

  /* ------------------------------ auth ------------------------------ */

  async login(email: string, password: string): Promise<StaffLoginResponse> {
    const res = await this.call<StaffLoginResponse>({ method: 'POST', url: '/api/staff/login', data: { email, password } });
    this.setToken(res.access_token);
    return res;
  }

  me(): Promise<StaffUser> {
    return this.call({ method: 'GET', url: '/api/staff/me' });
  }

  updateMe(patch: UpdateMePayload): Promise<StaffUser> {
    return this.call({ method: 'PATCH', url: '/api/staff/me', data: patch });
  }

  changePassword(payload: ChangePasswordPayload): Promise<OkResponse> {
    return this.call({ method: 'POST', url: '/api/staff/me/password', data: payload });
  }

  async acceptInvite(payload: AcceptInvitePayload): Promise<StaffLoginResponse> {
    const res = await this.call<StaffLoginResponse>({ method: 'POST', url: '/api/staff/accept-invite', data: payload });
    this.setToken(res.access_token);
    return res;
  }

  forgotPassword(email: string): Promise<OkResponse> {
    return this.call({ method: 'POST', url: '/api/staff/forgot-password', data: { email } });
  }

  async resetPassword(token: string, password: string): Promise<StaffLoginResponse> {
    const res = await this.call<StaffLoginResponse>({ method: 'POST', url: '/api/staff/reset-password', data: { token, password } });
    this.setToken(res.access_token);
    return res;
  }

  /* -------------------------- staff management -------------------------- */

  async listStaff(): Promise<StaffUser[]> {
    const res = await this.call<{ staff: StaffUser[] }>({ method: 'GET', url: '/api/staff' });
    return Array.isArray(res?.staff) ? res.staff : [];
  }

  inviteStaff(payload: InviteStaffPayload): Promise<InviteStaffResponse> {
    return this.call({ method: 'POST', url: '/api/staff/invite', data: payload });
  }

  updateStaff(id: string | number, patch: UpdateStaffPayload): Promise<StaffUser> {
    return this.call({ method: 'PATCH', url: `/api/staff/${this.seg(id)}`, data: patch });
  }

  deleteStaff(id: string | number): Promise<{ deleted: boolean }> {
    return this.call({ method: 'DELETE', url: `/api/staff/${this.seg(id)}` });
  }

  resendInvite(id: string | number): Promise<ResendInviteResponse> {
    return this.call({ method: 'POST', url: `/api/staff/${this.seg(id)}/resend-invite` });
  }

  /* --------------------------- knowledge gaps --------------------------- */

  listGaps(params: GapListParams = {}): Promise<GapListResponse> {
    const clean: Record<string, unknown> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    });
    return this.call({ method: 'GET', url: '/api/reports/gaps', params: clean });
  }

  getGap(id: string | number): Promise<KnowledgeGap> {
    return this.call({ method: 'GET', url: `/api/reports/gaps/${this.seg(id)}` });
  }

  updateGap(id: string | number, patch: UpdateGapPayload): Promise<KnowledgeGap> {
    return this.call({ method: 'PATCH', url: `/api/reports/gaps/${this.seg(id)}`, data: patch });
  }

  answerGap(id: string | number, payload: AnswerGapPayload): Promise<AnswerGapResponse> {
    return this.call({
      method: 'POST',
      url: `/api/reports/gaps/${this.seg(id)}/answer`,
      data: { audience: 'public', ...payload }
    });
  }

  /* ---------------------------- notifications ---------------------------- */

  listNotifications(params: { unread_only?: boolean; limit?: number } = {}): Promise<NotificationListResponse> {
    return this.call({
      method: 'GET',
      url: '/api/notifications',
      params: { unread_only: params.unread_only ?? false, limit: params.limit ?? 30 }
    });
  }

  markNotificationRead(id: string | number): Promise<OkResponse> {
    return this.call({ method: 'POST', url: `/api/notifications/${this.seg(id)}/read` });
  }

  markAllNotificationsRead(): Promise<{ ok: boolean; updated: number }> {
    return this.call({ method: 'POST', url: '/api/notifications/read-all' });
  }

  /* ------------------------------- reports ------------------------------- */

  overview(days = 30): Promise<OverviewReport> {
    return this.call({ method: 'GET', url: '/api/reports/overview', params: { days } });
  }

  listConversations(params: ConversationListParams = {}): Promise<ConversationListResponse> {
    const clean: Record<string, unknown> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    });
    return this.call({ method: 'GET', url: '/api/reports/conversations', params: clean });
  }

  getConversation(sessionId: string): Promise<ConversationDetail> {
    return this.call({ method: 'GET', url: `/api/reports/conversations/${this.seg(sessionId)}` });
  }

  /* ------------------------------- settings ------------------------------- */

  getSettings(): Promise<TenantSettings> {
    return this.call({ method: 'GET', url: '/api/settings' });
  }

  updateSettings(patch: TenantSettingsUpdate): Promise<TenantSettings> {
    return this.call({ method: 'PUT', url: '/api/settings', data: patch });
  }

  async widgetConfig(): Promise<WidgetSettings> {
    const res = await this.call<{ widget: WidgetSettings }>({ method: 'GET', url: '/api/widget-config' });
    return res.widget;
  }

  /* ------------------------------- API keys ------------------------------- */

  async listKeys(): Promise<ApiKeyInfo[]> {
    const res = await this.call<{ keys: ApiKeyInfo[] }>({ method: 'GET', url: '/api/keys' });
    return Array.isArray(res?.keys) ? res.keys : [];
  }

  createKey(payload: CreateApiKeyPayload): Promise<CreateApiKeyResponse> {
    return this.call({ method: 'POST', url: '/api/keys', data: payload });
  }

  revokeKey(id: string | number): Promise<{ revoked: boolean }> {
    return this.call({ method: 'DELETE', url: `/api/keys/${this.seg(id)}` });
  }

  /* ------------------------------- training ------------------------------- */

  listSources(): Promise<TrainingSourcesResponse> {
    return this.viaSdk(() => this.sdk.listSources());
  }

  getSource(sourceId: string): Promise<TrainingSource> {
    return this.viaSdk(() => this.sdk.getSource(sourceId));
  }

  trainFile(file: File, options?: TrainFileOptions): Promise<TrainingTaskResponse> {
    return this.viaSdk(() => this.sdk.trainFile(file, options));
  }

  trainText(name: string, content: string, audience?: TrainingAudience): Promise<TrainingTaskResponse> {
    return this.viaSdk(() => this.sdk.trainText(name, content, audience));
  }

  testApiSource(config: ApiSourceConfig): Promise<ApiSourceTestResult> {
    return this.viaSdk(() => this.sdk.testApiSource(config));
  }

  addApiSource(config: ApiSourceConfig): Promise<TrainingTaskResponse> {
    return this.viaSdk(() => this.sdk.addApiSource(config));
  }

  syncSource(sourceId: string): Promise<TrainingTaskResponse> {
    return this.viaSdk(() => this.sdk.syncSource(sourceId));
  }

  updateSource(sourceId: string, patch: UpdateTrainingSourcePayload): Promise<TrainingSource> {
    return this.viaSdk(() => this.sdk.updateSource(sourceId, patch));
  }

  deleteSource(sourceId: string): Promise<DeleteTrainingSourceResponse> {
    return this.viaSdk(() => this.sdk.deleteSource(sourceId));
  }

  getIngestStatus(taskId: string): Promise<IngestStatus> {
    return this.viaSdk(() => this.sdk.getIngestStatus(taskId));
  }

  health(): Promise<any> {
    return this.call({ method: 'GET', url: '/api/health' });
  }
}

/** Role rank helpers: owner(3) > admin(2) > trainer(1) > viewer(0). */
export const ROLE_RANK: Record<string, number> = { viewer: 0, trainer: 1, admin: 2, owner: 3 };

export function hasRole(role: string | null | undefined, min: 'viewer' | 'trainer' | 'admin' | 'owner'): boolean {
  return (ROLE_RANK[role || ''] ?? -1) >= ROLE_RANK[min];
}
