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
  ['#3b82f6', '#1d4ed8'],
  ['#0ea5e9', '#0369a1'],
  ['#6366f1', '#4338ca'],
  ['#14b8a6', '#0f766e'],
  ['#0284c7', '#1e3a8a'],
  ['#8b5cf6', '#5b21b6']
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
  no_context: '#1d4ed8',
  low_confidence: '#d97706',
  llm_unknown: '#4f46e5',
  negative_feedback: '#dc2626',
  llm_unavailable: '#64748b'
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
