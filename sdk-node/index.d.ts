// Type definitions for spres-ai (Brainbox Node.js SDK) 1.1.0

export type Audience = 'public' | 'customer' | 'vendor' | 'internal' | 'admin';

export interface BrainboxOptions {
  /** Defaults to https://port.smartpowerbilling.com */
  apiUrl?: string;
  /** Secret key (sk_live_...). Defaults to process.env.BRAINBOX_SECRET_KEY. */
  apiKey?: string;
  /** Optional: the key already decides the tenant. */
  tenantId?: string | null;
  /** Request timeout in milliseconds (default 60000). */
  timeout?: number;
}

export interface TrainingSource {
  source_id: string;
  tenant_id: string;
  name: string;
  kind: 'file' | 'text' | 'api' | string;
  source_type: string;
  filename?: string | null;
  url?: string | null;
  audience: Audience | string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  documents_count: number;
  records_count: number;
  last_task_id?: string | null;
  last_synced_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  config?: Record<string, unknown> | null;
}

export interface TrainResponse { source: TrainingSource; task_id: string; }
export interface SourcesListResponse { sources: TrainingSource[]; totals: { sources: number; documents: number }; }
export interface TaskStatus { task_id: string; status: string; error_message?: string | null; }
export interface DeleteSourceResponse { deleted: boolean; documents_deleted: number; }

export interface TicketMapping {
  id_field?: string;
  question_field?: string;
  answer_field?: string;
  title_field?: string;
  messages_field?: string;
  extra_fields?: string[];
}

export interface PaginationConfig {
  type?: 'none' | 'page' | 'cursor';
  page_param?: string;
  cursor_path?: string;
  cursor_param?: string;
  max_pages?: number;
}

export interface ApiSourceConfig {
  url: string;
  name?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  data_path?: string;
  source_type?: 'support_tickets' | 'api_generic';
  mapping?: TicketMapping;
  pagination?: PaginationConfig;
  audience?: Audience;
}

export interface ApiTestResult {
  ok: boolean;
  status_code?: number | null;
  records_found: number;
  preview: { title: string; text: string }[];
  detected_fields: string[];
  error?: string | null;
  data_path?: string | null;
  records_skipped?: number;
}

export interface TrainOptions { name?: string; audience?: Audience; }
export interface WaitOptions { /** seconds */ timeout?: number; /** seconds */ poll?: number; raiseOnFailure?: boolean; }

export declare class FunctionInfo {
  name: string;
  file_path: string;
  line_number: number;
  language: string;
  signature: string;
  parameters: string[];
  is_async: boolean;
  class_name: string | null;
  toObject(): Record<string, unknown>;
}

export declare class BrainboxError extends Error {
  statusCode: number | null;
  detail: unknown;
  code?: string;
}
export declare class BrainboxAuthError extends BrainboxError {}
export declare class BrainboxNotFoundError extends BrainboxError {}
export declare class BrainboxValidationError extends BrainboxError {}
export declare class BrainboxTimeoutError extends BrainboxError {}

export declare class BrainboxNodeSDK {
  constructor(options: BrainboxOptions);
  constructor(apiUrl: string, apiKey: string, tenantId?: string | null);
  readonly apiUrl: string;
  readonly tenantId: string | null;
  getApiUrl(): string;

  ingest(sourceType: string, content: string, filePath?: string | null, metadata?: Record<string, unknown>, audience?: Audience): Promise<{ status: string; task_id: string; message: string }>;
  getIngestStatus(taskId: string): Promise<TaskStatus>;
  waitForTask(taskId: string, options?: WaitOptions): Promise<TaskStatus>;
  chat(question: string, sessionId?: string | null): Promise<any>;
  createChatSession(title?: string | null): Promise<any>;
  healthCheck(): Promise<any>;

  trainFile(filePath: string, options?: TrainOptions): Promise<TrainResponse>;
  trainText(content: string, options?: TrainOptions): Promise<TrainResponse>;
  testApiSource(config: ApiSourceConfig): Promise<ApiTestResult>;
  addApiSource(config: ApiSourceConfig): Promise<TrainResponse>;
  listSources(): Promise<SourcesListResponse>;
  getSource(sourceId: string): Promise<TrainingSource>;
  updateSource(sourceId: string, changes: { audience?: Audience; name?: string }): Promise<TrainingSource>;
  deleteSource(sourceId: string): Promise<DeleteSourceResponse>;
  syncSource(sourceId: string): Promise<TrainResponse>;

  findFunction(functionName: string, directory?: string): FunctionInfo[];
  findAllFunctions(directory?: string): FunctionInfo[];
  findFunctionByFile(filePath: string): FunctionInfo[];
  findAsyncFunctions(directory?: string): FunctionInfo[];
}

export declare const AUDIENCES: Audience[];
export declare const DEFAULT_API_URL: string;
export declare const VERSION: string;

export default BrainboxNodeSDK;
