/** Brainbox design tokens v2 (see docs: design spec). Shared by widgets and the staff dashboard. */
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO_STACK = '"SF Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';

export const EASE_SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
export const EASE_STANDARD = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
export const BRAND_GRADIENT = 'linear-gradient(135deg, #2F7CF6 0%, #5E5CE6 100%)';

export const LIGHT = {
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
  accentHover: '#0077ED',
  accentPressed: '#006EDB',
  accentTint: 'rgba(0,113,227,0.10)',
  indigo: '#5E5CE6',
  teal: '#30B0C7',
  success: '#34C759',
  successText: '#248A3D',
  successTint: 'rgba(52,199,89,0.12)',
  warning: '#FF9F0A',
  warningText: '#B25000',
  warningTint: 'rgba(255,159,10,0.14)',
  danger: '#FF3B30',
  dangerText: '#D70015',
  dangerTint: 'rgba(255,59,48,0.10)',
  botBubble: '#F2F2F7',
  material: 'rgba(255,255,255,0.72)',
} as const;

export const DARK: Record<keyof typeof LIGHT, string> = {
  ...LIGHT,
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
  accentHover: '#409CFF',
  accentPressed: '#0071E3',
  accentTint: 'rgba(10,132,255,0.18)',
  botBubble: '#2C2C2E',
  material: 'rgba(28,28,30,0.72)',
};

export const SHADOW_POPOVER = '0 8px 28px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)';
export const SHADOW_WINDOW = '0 12px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.08)';
export const SHADOW_LAUNCHER = '0 4px 14px rgba(0,0,0,0.14)';

/** Emit CSS custom properties `--bb-<token>` for a palette, e.g. inside a root selector. */
export function tokensToCss(palette: Record<string, string>, prefix = '--bb-'): string {
  return Object.entries(palette)
    .map(([k, v]) => `${prefix}${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v};`)
    .join('');
}
