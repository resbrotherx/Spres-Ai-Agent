'use client';
import { useInsertionEffect, useLayoutEffect } from 'react';

const STYLE_ID = 'bb-typing-styles-v2';
const CSS = `
.bb-typing { display: inline-flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; color: var(--bb-tertiary, #86868B); }
.bb-typing-dots { display: inline-flex; gap: 4px; align-items: center; height: 16px; }
.bb-typing-dots i { width: 6px; height: 6px; border-radius: 999px; background: currentColor; opacity: .3; animation: bb-typing-pulse 1.2s ease-in-out infinite; }
.bb-typing-dots i:nth-child(2) { animation-delay: .15s; }
.bb-typing-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes bb-typing-pulse { 0%, 80%, 100% { opacity: .3; transform: scale(.85); } 40% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .bb-typing-dots i { animation: bb-typing-fade 1.2s linear infinite; transform: none; } }
@keyframes bb-typing-fade { 0%, 100% { opacity: .3; } 50% { opacity: .9; } }
`;

const useIsoEffect: typeof useInsertionEffect =
  typeof window === 'undefined' ? ((() => undefined) as any) : typeof useInsertionEffect === 'function' ? useInsertionEffect : useLayoutEffect;

export interface TypingIndicatorProps {
  /** Optional visible label next to the dots (e.g. "Searching knowledge base…"). */
  label?: string;
  /** Screen-reader text (default "Assistant is typing"). */
  srLabel?: string;
}

/** Three pulsing dots (design spec v2). Styles are injected once per page. */
export function TypingIndicator({ label, srLabel = 'Assistant is typing' }: TypingIndicatorProps) {
  useIsoEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);
  return (
    <span className="bb-typing" role="status" aria-label={label || srLabel}>
      <span className="bb-typing-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {label ? <span className="bb-typing-label">{label}</span> : null}
    </span>
  );
}

export default TypingIndicator;
