import { useCallback, useEffect, useRef, useState } from 'react';
import { toBrainboxError } from '../brainbox-sdk';
import type { GapReason, StaffRole } from './types';

export const nf = new Intl.NumberFormat();

export function fmtNum(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return nf.format(n);
}

export function fmtCompact(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 10000) return nf.format(n);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 } as Intl.NumberFormatOptions).format(n);
}

export function fmtPct(r?: number | null, digits = 0): string {
  if (r == null || Number.isNaN(r)) return '—';
  return `${(r * 100).toFixed(digits)}%`;
}

export function relTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d > 300 ? 'numeric' : undefined });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(date: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, opts);
}

export function initials(name?: string | null, email?: string | null): string {
  const src = (name || '').trim() || (email || '').split('@')[0] || '?';
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS = [
  ['#5AA0F7', '#0071E3'],
  ['#8E8CF2', '#5E5CE6'],
  ['#5CCBDB', '#30A0B7'],
  ['#5FD47D', '#2DAF4F'],
  ['#FFB547', '#F08C00'],
  ['#C38BF2', '#A55BE0'],
  ['#9CA3AF', '#6E6E73']
];

export function avatarBg(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export const REASON_LABELS: Record<GapReason, string> = {
  no_context: 'No context',
  low_confidence: 'Low confidence',
  llm_unknown: "Bot didn't know",
  negative_feedback: 'Negative feedback',
  llm_unavailable: 'AI unavailable'
};

export const REASON_HELP: Record<GapReason, string> = {
  no_context: 'Nothing in the knowledge base matched this question for the user’s audience.',
  low_confidence: 'Matches were found, but they were too far from the question to trust.',
  llm_unknown: 'The assistant answered that it didn’t have the information.',
  negative_feedback: 'The user gave the answer a thumbs-down.',
  llm_unavailable: 'The language model was unavailable and a fallback reply was sent.'
};

export const REASON_COLORS: Record<GapReason, string> = {
  no_context: '#0071E3',
  low_confidence: '#FF9F0A',
  llm_unknown: '#5E5CE6',
  negative_feedback: '#FF3B30',
  llm_unavailable: '#8E8E93'
};

export const ROLE_INFO: Record<StaffRole, { label: string; desc: string }> = {
  owner: { label: 'Owner', desc: 'Full control, including admins, owners and billing-level settings.' },
  admin: { label: 'Admin', desc: 'Manage staff, settings and API keys, plus everything trainers can do.' },
  trainer: { label: 'Trainer', desc: 'Train the AI, answer knowledge gaps and triage feedback.' },
  viewer: { label: 'Viewer', desc: 'Read-only access to reports, gaps, conversations and settings.' }
};

export function errMsg(err: unknown): string {
  return toBrainboxError(err).message;
}

/** Simple async loader with stale-response protection. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(
    async (silent = false) => {
      const id = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const res = await run();
        if (id === seq.current) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (id === seq.current) setError(errMsg(err));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [run]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Minimum length for a password an admin sets for someone else (matches the backend). */
export const ADMIN_MIN_PASSWORD = 10;

/**
 * Strong random password generated in the browser (crypto.getRandomValues, rejection sampling — no modulo bias).
 * 16 chars from an alphabet without look-alikes (0/O, 1/l/I), with at least one lower, upper, digit and symbol.
 */
export function generatePassword(length = 16): string {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%*-_+?'];
  const all = sets.join('');
  const cryptoObj: Crypto | undefined = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (!cryptoObj?.getRandomValues) throw new Error('Secure random numbers are not available in this browser.');
  const randIndex = (n: number): number => {
    const limit = Math.floor(256 / n) * n;
    const buf = new Uint8Array(1);
    for (;;) {
      cryptoObj.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % n;
    }
  };
  const chars = sets.map((set) => set[randIndex(set.length)]);
  while (chars.length < length) chars.push(all[randIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Shorten long ids (some tenant ids are JWT-like strings) for display: "eyJhbGci…x9Qk". */
export function shortId(id: string, max = 22): string {
  if (!id || id.length <= max) return id;
  const keep = Math.max(4, Math.floor((max - 1) / 2));
  return `${id.slice(0, keep)}…${id.slice(-Math.max(4, max - keep - 1))}`;
}
