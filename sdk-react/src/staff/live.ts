/*
 * Real-time hub for the staff dashboard.
 *
 * Connects to `GET /api/staff/events` (Server-Sent Events over fetch + ReadableStream so the staff
 * Bearer token can be sent as a header), reconnects with exponential backoff, pauses while signed out,
 * and — when the server doesn't have the endpoint yet (404/405/501) — falls back silently to polling:
 * it emits `poll` every 30 s so pages refresh their data, and the dashboard polls notifications every 15 s.
 */
import { useEffect, useRef } from 'react';
import type { BrainboxStaffClient } from './staffClient';
import type { LiveEventMap, LiveStatus } from './types';

type Handler<T> = (payload: T) => void;
type AnyHandler = (name: string, payload: unknown) => void;

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];
const HEARTBEAT_TIMEOUT = 45000;
const POLL_PAGE_MS = 30000;
/** How often to re-probe the stream endpoint while in polling mode. */
const REPROBE_MS = 5 * 60000;

export class LiveHub {
  status: LiveStatus = 'idle';
  private handlers = new Map<string, Set<Handler<any>>>();
  private anyHandlers = new Set<AnyHandler>();
  private statusHandlers = new Set<(s: LiveStatus) => void>();
  private abort: AbortController | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private hadConnection = false;
  private unsubToken: (() => void) | null = null;

  constructor(private client: BrainboxStaffClient) {}

  on<K extends keyof LiveEventMap>(name: K, fn: Handler<LiveEventMap[K]>): () => void {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  }

  onAny(fn: AnyHandler): () => void {
    this.anyHandlers.add(fn);
    return () => {
      this.anyHandlers.delete(fn);
    };
  }

  onStatus(fn: (s: LiveStatus) => void): () => void {
    this.statusHandlers.add(fn);
    return () => {
      this.statusHandlers.delete(fn);
    };
  }

  /** Dispatch an event to subscribers (also used for locally-synthesised events). */
  emit<K extends keyof LiveEventMap>(name: K, payload: LiveEventMap[K]): void {
    this.handlers.get(name)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        // A broken subscriber must never kill the stream.
        // eslint-disable-next-line no-console
        console.error('[brainbox] live handler failed', err);
      }
    });
    this.anyHandlers.forEach((fn) => {
      try {
        fn(name, payload);
      } catch {
        /* ignore */
      }
    });
  }

  private setStatus(s: LiveStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusHandlers.forEach((fn) => fn(s));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubToken = this.client.onTokenChange((token) => {
      if (!token) this.pause();
      else if (this.running && this.status === 'idle') this.connect();
    });
    if (this.client.isAuthenticated()) this.connect();
  }

  stop(): void {
    this.running = false;
    this.unsubToken?.();
    this.unsubToken = null;
    this.pause();
  }

  private pause() {
    this.clearTimers();
    this.abort?.abort();
    this.abort = null;
    this.retry = 0;
    this.hadConnection = false;
    this.setStatus('idle');
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.timer = null;
    this.pollTimer = null;
    this.watchdog = null;
  }

  private kick() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      // No data (not even a heartbeat) for too long: assume a dead proxy connection.
      this.abort?.abort();
    }, HEARTBEAT_TIMEOUT);
  }

  private scheduleReconnect() {
    if (!this.running || !this.client.isAuthenticated()) return this.setStatus('idle');
    this.setStatus('reconnecting');
    const delay = BACKOFF[Math.min(this.retry, BACKOFF.length - 1)] * (0.8 + Math.random() * 0.4);
    this.retry++;
    this.timer = setTimeout(() => this.connect(), delay);
  }

  private startPolling() {
    this.clearTimers();
    this.setStatus('polling');
    this.pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.emit('poll', { at: Date.now() });
    }, POLL_PAGE_MS);
    this.timer = setTimeout(() => {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.connect();
    }, REPROBE_MS);
  }

  private async connect() {
    if (!this.running) return;
    const token = this.client.getToken();
    if (!token) return this.setStatus('idle');
    this.clearTimers();
    this.abort?.abort();
    const ctrl = new AbortController();
    this.abort = ctrl;
    if (this.status !== 'reconnecting' && this.status !== 'polling') this.setStatus('connecting');
    let res: Response;
    try {
      res = await fetch(`${this.client.apiUrl}/api/staff/events`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: ctrl.signal
      });
    } catch {
      if (ctrl.signal.aborted && this.abort !== ctrl) return;
      return this.scheduleReconnect();
    }
    if (this.abort !== ctrl) return;
    if (res.status === 403 || res.status === 404 || res.status === 405 || res.status === 501) {
      // The server doesn't stream (yet) or won't stream to this account: poll instead (silently).
      return this.startPolling();
    }
    if (res.status === 401) {
      // Let the regular client run its 401 handling (clears the session → login screen).
      this.client.me().catch(() => undefined);
      return this.setStatus('idle');
    }
    if (!res.ok || !res.body) return this.scheduleReconnect();

    const reconnected = this.hadConnection;
    this.hadConnection = true;
    this.retry = 0;
    this.setStatus('live');
    this.kick();
    if (reconnected) this.emit('resync', { at: Date.now() });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        this.kick();
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        // Events are separated by a blank line (\n\n or \r\n\r\n).
        while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
          this.dispatchRaw(raw);
        }
      }
    } catch {
      /* aborted or network error → reconnect below */
    }
    if (this.abort !== ctrl) return;
    if (this.watchdog) clearTimeout(this.watchdog);
    this.scheduleReconnect();
  }

  private dispatchRaw(raw: string) {
    let name = 'message';
    const data: string[] = [];
    raw.split(/\r?\n/).forEach((line) => {
      if (!line || line.startsWith(':')) return;
      const i = line.indexOf(':');
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'event') name = value;
      else if (field === 'data') data.push(value);
    });
    if (!data.length) return;
    let payload: unknown;
    try {
      payload = JSON.parse(data.join('\n'));
    } catch {
      return;
    }
    this.emit(name as keyof LiveEventMap, payload as never);
  }
}

/** Subscribe to a live event for the lifetime of the component (handler may change freely). */
export function useLiveEvent<K extends keyof LiveEventMap>(hub: LiveHub | null | undefined, name: K, handler: (payload: LiveEventMap[K]) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!hub) return undefined;
    return hub.on(name, (p) => ref.current(p));
  }, [hub, name]);
}

/** Silent refresh of the current page when the polling fallback ticks or the stream reconnects. */
export function useLiveRefresh(hub: LiveHub | null | undefined, reload: () => void, extra: (keyof LiveEventMap)[] = []) {
  const ref = useRef(reload);
  ref.current = reload;
  const key = extra.join(',');
  useEffect(() => {
    if (!hub) return undefined;
    let t: ReturnType<typeof setTimeout> | null = null;
    // Coalesce bursts of events into one refetch.
    const fire = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => ref.current(), 250);
    };
    const offs = (['poll', 'resync', ...extra] as (keyof LiveEventMap)[]).map((n) => hub.on(n, fire));
    return () => {
      if (t) clearTimeout(t);
      offs.forEach((off) => off());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, key]);
}
