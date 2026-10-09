import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type BrainboxThemeMode = 'light' | 'dark' | 'auto';

export interface BrainboxThemeOptions {
  /** Brand colour; overrides the accent (send button, user bubbles, links). */
  primary?: string;
  /** 'light' (default), 'dark' or 'auto' (follows the device setting). */
  mode?: BrainboxThemeMode;
  /** Optional font family override. Default: the system font (SF Pro on iOS, Roboto on Android). */
  fontFamily?: string;
}

export interface BrainboxTokens {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  fill: string;
  fillStrong: string;
  label: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  separator: string;
  separatorStrong: string;
  accent: string;
  accentPressed: string;
  accentTint: string;
  onAccent: string;
  botBubble: string;
  success: string;
  successText: string;
  successTint: string;
  danger: string;
  dangerText: string;
  dangerTint: string;
  warning: string;
  gradientFrom: string;
  gradientTo: string;
  backdrop: string;
  fontFamily?: string;
  mono: string;
}

const LIGHT: Omit<BrainboxTokens, 'fontFamily' | 'mono'> = {
  dark: false,
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surface2: '#FBFBFD',
  fill: 'rgba(120,120,128,0.08)',
  fillStrong: 'rgba(120,120,128,0.14)',
  label: '#1D1D1F',
  secondary: '#6E6E73',
  tertiary: '#86868B',
  quaternary: '#AEAEB2',
  separator: 'rgba(60,60,67,0.12)',
  separatorStrong: 'rgba(60,60,67,0.2)',
  accent: '#0071E3',
  accentPressed: '#006EDB',
  accentTint: 'rgba(0,113,227,0.10)',
  onAccent: '#FFFFFF',
  botBubble: '#F2F2F7',
  success: '#34C759',
  successText: '#248A3D',
  successTint: 'rgba(52,199,89,0.12)',
  danger: '#FF3B30',
  dangerText: '#D70015',
  dangerTint: 'rgba(255,59,48,0.10)',
  warning: '#FF9F0A',
  gradientFrom: '#2F7CF6',
  gradientTo: '#5E5CE6',
  backdrop: 'rgba(0,0,0,0.25)'
};

const DARK: Omit<BrainboxTokens, 'fontFamily' | 'mono'> = {
  ...LIGHT,
  dark: true,
  bg: '#000000',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  fill: 'rgba(120,120,128,0.24)',
  fillStrong: 'rgba(120,120,128,0.32)',
  label: '#F5F5F7',
  secondary: '#A1A1A6',
  tertiary: '#8E8E93',
  quaternary: '#636366',
  separator: 'rgba(84,84,88,0.6)',
  separatorStrong: 'rgba(84,84,88,0.8)',
  accent: '#0A84FF',
  accentPressed: '#0071E3',
  accentTint: 'rgba(10,132,255,0.18)',
  botBubble: '#2C2C2E',
  successText: '#30D158',
  dangerText: '#FF453A',
  dangerTint: 'rgba(255,69,58,0.16)',
  backdrop: 'rgba(0,0,0,0.5)'
};

/** Parse #rgb/#rrggbb/rgb()/rgba() into [r,g,b] (null if unknown, e.g. named colours). */
export function parseColor(c?: string): [number, number, number] | null {
  if (!c) return null;
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

export function withAlpha(c: string, a: number): string {
  const rgb = parseColor(c);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : c;
}

function shade(c: string, amount: number): string {
  const rgb = parseColor(c);
  if (!rgb) return c;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return `rgb(${f(rgb[0])},${f(rgb[1])},${f(rgb[2])})`;
}

export function buildTokens(options: BrainboxThemeOptions | undefined, systemDark: boolean): BrainboxTokens {
  const mode = options?.mode || 'light';
  const dark = mode === 'dark' || (mode === 'auto' && systemDark);
  const base = dark ? DARK : LIGHT;
  const t: BrainboxTokens = {
    ...base,
    fontFamily: options?.fontFamily,
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string
  };
  if (options?.primary && parseColor(options.primary)) {
    t.accent = options.primary;
    t.accentPressed = shade(options.primary, -0.08);
    t.accentTint = withAlpha(options.primary, dark ? 0.18 : 0.1);
  }
  return t;
}

/** Resolve theme tokens, following the device appearance when mode is 'auto'. */
export function useBrainboxTheme(options?: BrainboxThemeOptions): BrainboxTokens {
  const scheme = useColorScheme();
  const systemDark = scheme === 'dark';
  return useMemo(
    () => buildTokens(options, systemDark),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.primary, options?.mode, options?.fontFamily, systemDark]
  );
}

/** Type scale from the design spec (system font; weights 400/500/600 only). */
export function typo(t: BrainboxTokens) {
  const f = t.fontFamily ? { fontFamily: t.fontFamily } : {};
  return {
    caption2: { ...f, fontSize: 11, lineHeight: 13, fontWeight: '400' as const },
    caption: { ...f, fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
    footnote: { ...f, fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
    footnoteMedium: { ...f, fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    body: { ...f, fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
    bodyStrong: { ...f, fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
    headline: { ...f, fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.17 },
    title3: { ...f, fontSize: 20, lineHeight: 25, fontWeight: '600' as const, letterSpacing: -0.2 }
  };
}
