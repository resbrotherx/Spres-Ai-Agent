export type BrainboxErrorCode =
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'stream'
  | `http_${number}`;

/**
 * Every client method rejects with a BrainboxError. `message` is safe to show to end users;
 * `detail` holds the raw backend `detail` for logging.
 */
export class BrainboxError extends Error {
  status: number;
  code: BrainboxErrorCode;
  detail?: unknown;
  /** True when trying again later may succeed (network, timeout, 429, 5xx). */
  retryable: boolean;

  constructor(message: string, opts: { status?: number; code?: BrainboxErrorCode; detail?: unknown; retryable?: boolean } = {}) {
    super(message);
    this.name = 'BrainboxError';
    this.status = opts.status ?? 0;
    this.code = opts.code ?? (this.status ? (`http_${this.status}` as BrainboxErrorCode) : 'network');
    this.detail = opts.detail;
    this.retryable = opts.retryable ?? false;
    // Keep instanceof working when compiled to ES5-style classes.
    Object.setPrototypeOf(this, BrainboxError.prototype);
  }
}

/** Turn a FastAPI `detail` (string | [{loc,msg}] | object) into one readable line. */
export function formatDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        if (d && typeof d === 'object' && d.msg) {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${d.msg}` : String(d.msg);
        }
        return typeof d === 'string' ? d : JSON.stringify(d);
      })
      .join('; ');
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

/** Build a friendly error from an HTTP status and the parsed JSON body (if any). */
export function httpError(status: number, body: unknown): BrainboxError {
  const data: any = body && typeof body === 'object' ? body : null;
  const detail = data ? data.detail ?? data.error ?? data.message : typeof body === 'string' ? body : undefined;
  let text = formatDetail(detail);
  if (text && text.length > 300) text = text.slice(0, 300) + '…';
  const lower = (text || '').toLowerCase();
  if (status === 401) {
    return new BrainboxError('The assistant is not configured correctly (invalid or missing API key).', {
      status, code: 'auth', detail
    });
  }
  if (status === 403) {
    const msg = lower.includes('tenant')
      ? "The tenant ID doesn't match this API key."
      : lower.includes('secret')
        ? "This key can't do that — it needs a secret key on a server."
        : text || 'Not allowed with this API key.';
    return new BrainboxError(msg, { status, code: 'forbidden', detail });
  }
  if (status === 404) {
    return new BrainboxError(text && text !== 'Not Found' ? text : 'Not found.', { status, code: 'not_found', detail });
  }
  if (status === 422) {
    return new BrainboxError(text ? `Invalid request: ${text}` : 'Invalid request.', { status, code: 'validation', detail });
  }
  if (status === 429) {
    return new BrainboxError('Too many requests. Please wait a moment and try again.', {
      status, code: 'rate_limited', detail, retryable: true
    });
  }
  if (status >= 500) {
    return new BrainboxError('The assistant is having trouble right now. Please try again.', {
      status, code: 'server', detail, retryable: true
    });
  }
  return new BrainboxError(text || `Request failed (${status}).`, { status, detail });
}

export function networkError(cause?: unknown): BrainboxError {
  return new BrainboxError("Can't reach the assistant right now. Check your connection and try again.", {
    code: 'network', retryable: true, detail: cause instanceof Error ? cause.message : cause
  });
}

export function timeoutError(): BrainboxError {
  return new BrainboxError('The assistant took too long to answer. Please try again.', { code: 'timeout', retryable: true });
}

export function abortError(): BrainboxError {
  return new BrainboxError('Request cancelled.', { code: 'aborted' });
}
