import React, { useId } from 'react';

export interface BrainboxLogoProps {
  size?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** The Brainbox mark (design spec v2). Identical in every SDK. */
export function BrainboxLogo({ size = 32, title = 'Brainbox', className, style }: BrainboxLogoProps) {
  const gradientId = `bbLogoG-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2F7CF6" />
          <stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
      <path d="M32 15.5 47 24v16L32 48.5 17 40V24z" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" />
      <path
        d="M17 24l15 8.5L47 24M32 32.5v16"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity=".9"
      />
      <circle cx="32" cy="32.5" r="3.4" fill="#fff" />
      <path d="M50.5 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff" />
    </svg>
  );
}

/** Same mark as an SVG string (for favicons, emails, non-React hosts). */
export const BRAINBOX_LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bbLogoG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F7CF6"/><stop offset="1" stop-color="#5E5CE6"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#bbLogoG)"/><path d="M32 15.5 47 24v16L32 48.5 17 40V24z" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="M17 24l15 8.5L47 24M32 32.5v16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/><circle cx="32" cy="32.5" r="3.4" fill="#fff"/><path d="M50.5 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff"/></svg>`;
