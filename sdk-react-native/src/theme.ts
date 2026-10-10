import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type BrainboxThemeMode = 'light' | 'dark' | 'auto';

export interface BrainboxThemeOptions {
  /** Brand colour (default omago purple #b93fff): user bubbles, send button, launcher, pills, links. */
  primary?: string;
  /** 'light' (default, lavender glass), 'dark' (deep aubergine) or 'auto' (follows the device setting). */
  mode?: BrainboxThemeMode;
  /** Optional font family override. Default: the system font (SF Pro on iOS, Roboto on Android). */
  fontFamily?: string;
}

export interface BrainboxTokens {
  dark: boolean;
  /** Window / panel colour (omago lavender #fbf1ff). */
  panel: string;
  /** Body gradient (top -> bottom) drawn behind the transcript. */
  bodyFrom: string;
  bodyTo: string;
  /** Soft glow on the body gradient. */
  bodyGlow: string;
  /** Translucent header over the panel and its bottom rule. */
  headerBg: string;
  headerBorder: string;
  /** 2px frosted window border. */
  frameBorder: string;
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
  /** Light / deep ends of the accent gradient (send button, launcher). */
  accentLight: string;
  accentDeep: string;
  onAccent: string;
  botBubble: string;
  botText: string;
  /** Quick-action / history pill. */
  pillBg: string;
  pillBorder: string;
  pillText: string;
  /** Composer card and its tool buttons. */
  composerBg: string;
  composerBorder: string;
  toolBg: string;
  /** Header close circle. */
  closeBg: string;
  closeIcon: string;
  /** Purple orb logo stops (centre -> mid -> rim). */
  orbCore: string;
  orbMid: string;
  orbRim: string;
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

/** "omago": lavender frosted glass (the original Brainbox pop-up design). */
const LIGHT: Omit<BrainboxTokens, 'fontFamily' | 'mono'> = {
  dark: false,
  panel: '#fbf1ff',
  bodyFrom: '#fffaff',
  bodyTo: '#f9e6ff',
  bodyGlow: 'rgba(255,255,255,0.7)',
  headerBg: 'rgba(255,255,255,0.36)',
  headerBorder: 'rgba(255,255,255,0.88)',
  frameBorder: 'rgba(255,255,255,0.82)',
  bg: '#fbf1ff',
  surface: '#FFFFFF',
  surface2: 'rgba(255,255,255,0.6)',
  fill: 'rgba(185,63,255,0.08)',
  fillStrong: 'rgba(185,63,255,0.14)',
  label: '#08080a',
  secondary: 'rgba(9,9,12,0.54)',
  tertiary: 'rgba(12,12,16,0.45)',
  quaternary: 'rgba(12,12,16,0.28)',
  separator: 'rgba(185,63,255,0.12)',
  separatorStrong: 'rgba(185,63,255,0.2)',
  accent: '#b93fff',
  accentPressed: '#a531e6',
  accentTint: 'rgba(185,63,255,0.10)',
  accentLight: '#efc3ff',
  accentDeep: '#8120d2',
  onAccent: '#FFFFFF',
  botBubble: 'rgba(255,255,255,0.94)',
  botText: 'rgba(12,12,16,0.72)',
  pillBg: 'rgba(255,255,255,0.23)',
  pillBorder: 'rgba(185,63,255,0.18)',
  pillText: '#b93fff',
  composerBg: 'rgba(255,255,255,0.18)',
  composerBorder: 'rgba(255,255,255,0.86)',
  toolBg: 'rgba(255,255,255,0.25)',
  closeBg: '#08080a',
  closeIcon: '#FFFFFF',
  orbCore: '#d987ff',
  orbMid: '#b334ff',
  orbRim: '#8e31dc',
  success: '#34C759',
  successText: '#248A3D',
  successTint: 'rgba(52,199,89,0.12)',
  danger: '#FF3B30',
  dangerText: '#D70015',
  dangerTint: 'rgba(255,59,48,0.10)',
  warning: '#FF9F0A',
  gradientFrom: '#d987ff',
  gradientTo: '#8e31dc',
  backdrop: 'rgba(26,16,34,0.25)'
};

/** Dark omago: deep aubergine with lavender accents. */
const DARK: Omit<BrainboxTokens, 'fontFamily' | 'mono'> = {
  ...LIGHT,
  dark: true,
  panel: '#1a1022',
  bodyFrom: '#21142b',
  bodyTo: '#160d1d',
  bodyGlow: 'rgba(217,135,255,0.08)',
  headerBg: 'rgba(255,255,255,0.05)',
  headerBorder: 'rgba(217,135,255,0.16)',
  frameBorder: 'rgba(217,135,255,0.24)',
  bg: '#1a1022',
  surface: '#24172e',
  surface2: 'rgba(255,255,255,0.05)',
  fill: 'rgba(217,135,255,0.10)',
  fillStrong: 'rgba(217,135,255,0.18)',
  label: '#f6ecff',
  secondary: 'rgba(246,236,255,0.6)',
  tertiary: 'rgba(246,236,255,0.45)',
  quaternary: 'rgba(246,236,255,0.28)',
  separator: 'rgba(217,135,255,0.14)',
  separatorStrong: 'rgba(217,135,255,0.24)',
  accentTint: 'rgba(185,63,255,0.2)',
  botBubble: '#2a1b36',
  botText: 'rgba(246,236,255,0.88)',
  pillBg: 'rgba(255,255,255,0.05)',
  pillBorder: 'rgba(217,135,255,0.28)',
  pillText: '#e0a8ff',
  composerBg: 'rgba(255,255,255,0.05)',
  composerBorder: 'rgba(217,135,255,0.22)',
  toolBg: 'rgba(255,255,255,0.08)',
  closeBg: '#f6ecff',
  closeIcon: '#1a1022',
  successText: '#30D158',
  dangerText: '#FF6B6B',
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

/** Mix a colour towards another (t = 0..1). */
function mix(c: string, to: string, t: number): string {
  const a = parseColor(c);
  const b = parseColor(to);
  if (!a || !b) return c;
  const m = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
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
    t.accentTint = withAlpha(options.primary, dark ? 0.2 : 0.1);
    t.accentLight = mix(options.primary, '#ffffff', 0.65);
    t.accentDeep = mix(options.primary, '#000000', 0.3);
    t.pillBorder = withAlpha(options.primary, dark ? 0.32 : 0.18);
    t.pillText = dark ? mix(options.primary, '#ffffff', 0.35) : options.primary;
    t.separator = withAlpha(options.primary, dark ? 0.16 : 0.12);
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

/** Type scale (system font). The omago header, author line and pills use heavy weights. */
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
    title3: { ...f, fontSize: 20, lineHeight: 25, fontWeight: '800' as const, letterSpacing: -0.2 },
    /** Header title: bold 17. */
    title: { ...f, fontSize: 17, lineHeight: 20, fontWeight: '800' as const },
    /** Header subtitle: 11pt. */
    subtitle: { ...f, fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
    /** Message author line (name + time). */
    meta: { ...f, fontSize: 12, lineHeight: 15, fontWeight: '800' as const },
    metaTime: { ...f, fontSize: 10.5, lineHeight: 13, fontWeight: '700' as const },
    /** Quick-action / history pill. */
    pill: { ...f, fontSize: 13, lineHeight: 16, fontWeight: '700' as const }
  };
}
