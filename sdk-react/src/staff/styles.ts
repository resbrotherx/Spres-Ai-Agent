import { useEffect } from 'react';
import { FONT_STACK, MONO_STACK } from '../design/tokens';

const STYLE_ID = 'bb-staff-styles-v2';

/* Brainbox design system v2 ("Apple-like"): calm, light, hairlines, no heavy shadows, weights ≤ 600. */
export const staffCss = `
.bb-staff {
  --bbs-bg: #F5F5F7;
  --bbs-surface: #FFFFFF;
  --bbs-surface-2: #FBFBFD;
  --bbs-fill: rgba(120,120,128,0.08);
  --bbs-fill-strong: rgba(120,120,128,0.14);
  --bbs-label: #1D1D1F;
  --bbs-secondary: #6E6E73;
  --bbs-tertiary: #86868B;
  --bbs-quaternary: #AEAEB2;
  --bbs-separator: rgba(60,60,67,0.12);
  --bbs-separator-strong: rgba(60,60,67,0.2);
  --bbs-accent: #0071E3;
  --bbs-accent-hover: #0077ED;
  --bbs-accent-pressed: #006EDB;
  --bbs-accent-tint: rgba(0,113,227,0.10);
  --bbs-on-accent: #FFFFFF;
  --bbs-indigo: #5E5CE6;
  --bbs-indigo-tint: rgba(94,92,230,0.12);
  --bbs-teal: #30B0C7;
  --bbs-teal-text: #1A7F91;
  --bbs-teal-tint: rgba(48,176,199,0.14);
  --bbs-success: #34C759;
  --bbs-success-text: #248A3D;
  --bbs-success-tint: rgba(52,199,89,0.12);
  --bbs-warning: #FF9F0A;
  --bbs-warning-text: #B25000;
  --bbs-warning-tint: rgba(255,159,10,0.14);
  --bbs-danger: #FF3B30;
  --bbs-danger-text: #D70015;
  --bbs-danger-tint: rgba(255,59,48,0.10);
  --bbs-bot-bubble: #F2F2F7;
  --bbs-material: rgba(255,255,255,0.72);
  --bbs-series-1: #0071E3;
  --bbs-series-2: #E8710A;
  --bbs-heat-0: rgba(120,120,128,0.08);
  --bbs-shadow-pop: 0 8px 28px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06);
  --bbs-shadow-window: 0 12px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.08);
  --bbs-ring: 0 0 0 3px rgba(0,113,227,0.25);
  --bbs-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --bbs-ease-std: cubic-bezier(0.25, 0.1, 0.25, 1);
  --bbs-radius: 12px;
  --bbs-font: ${FONT_STACK};
  --bbs-mono: ${MONO_STACK};
  --bbs-top: 0px;
  --bbs-side-w: 248px;
  /* legacy aliases (host overrides / older markup) */
  --bbs-primary: var(--bbs-accent);
  --bbs-border: var(--bbs-separator);
  --bbs-text: var(--bbs-label);
  --bbs-muted: var(--bbs-secondary);
  font-family: var(--bbs-font);
  font-size: 14px;
  line-height: 1.45;
  font-weight: 400;
  color: var(--bbs-label);
  background: var(--bbs-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  min-height: calc(100vh - var(--bbs-top));
  display: flex;
  align-items: stretch;
  position: relative;
  text-align: left;
  color-scheme: light;
}
@supports (color: color-mix(in srgb, red 10%, transparent)) {
  .bb-staff {
    --bbs-accent-tint: color-mix(in srgb, var(--bbs-accent) 10%, transparent);
    --bbs-ring: 0 0 0 3px color-mix(in srgb, var(--bbs-accent) 25%, transparent);
  }
}
.bb-staff.is-dark {
  --bbs-bg: #000000;
  --bbs-surface: #1C1C1E;
  --bbs-surface-2: #2C2C2E;
  --bbs-fill: rgba(120,120,128,0.24);
  --bbs-fill-strong: rgba(120,120,128,0.32);
  --bbs-label: #F5F5F7;
  --bbs-secondary: #A1A1A6;
  --bbs-tertiary: #8E8E93;
  --bbs-quaternary: #636366;
  --bbs-separator: rgba(84,84,88,0.6);
  --bbs-separator-strong: rgba(84,84,88,0.8);
  --bbs-accent: #0A84FF;
  --bbs-accent-hover: #409CFF;
  --bbs-accent-pressed: #0071E3;
  --bbs-accent-tint: rgba(10,132,255,0.18);
  --bbs-indigo-tint: rgba(94,92,230,0.24);
  --bbs-teal-text: #64D2E5;
  --bbs-teal-tint: rgba(48,176,199,0.22);
  --bbs-success-text: #30D158;
  --bbs-success-tint: rgba(48,209,88,0.18);
  --bbs-warning-text: #FFB340;
  --bbs-warning-tint: rgba(255,159,10,0.2);
  --bbs-danger-text: #FF6961;
  --bbs-danger-tint: rgba(255,69,58,0.2);
  --bbs-bot-bubble: #2C2C2E;
  --bbs-material: rgba(28,28,30,0.72);
  --bbs-series-1: #0A84FF;
  --bbs-series-2: #D9690B;
  --bbs-heat-0: rgba(120,120,128,0.2);
  --bbs-shadow-pop: 0 8px 28px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.1);
  --bbs-shadow-window: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.12);
  color-scheme: dark;
}
.bb-staff *, .bb-staff *::before, .bb-staff *::after { box-sizing: border-box; }
.bb-staff button, .bb-staff input, .bb-staff select, .bb-staff textarea { font: inherit; color: inherit; letter-spacing: inherit; }
.bb-staff a { color: var(--bbs-accent); text-decoration: none; }
.bb-staff a:hover { text-decoration: underline; text-underline-offset: 2px; }
.bb-staff h1, .bb-staff h2, .bb-staff h3, .bb-staff h4, .bb-staff p { margin: 0; }
.bb-staff b, .bb-staff strong { font-weight: 600; }
.bb-staff :focus-visible { outline: 2px solid var(--bbs-accent); outline-offset: 2px; border-radius: 6px; }
.bb-staff-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.bb-staff-num { font-variant-numeric: tabular-nums; }
.bb-staff-muted { color: var(--bbs-secondary); }
.bb-staff-mono { font-family: var(--bbs-mono); font-size: 12px; }
.bb-staff-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.bb-staff-clamp2 { display: -webkit-box !important; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bb-staff-kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 5px; background: var(--bbs-fill); color: var(--bbs-secondary); font: 500 11px/1 var(--bbs-font); box-shadow: inset 0 -0.5px 0 var(--bbs-separator-strong); }
.bb-staff-page { animation: bb-staff-page .32s var(--bbs-ease); min-width: 0; }
@keyframes bb-staff-page { from { opacity: 0; transform: translateY(6px); } }

/* ---------------------------------------------------------------- Sidebar (material) */
/* Keeps the sidebar column continuous below the sticky sidebar on tall pages. */
.bb-staff.has-side::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: var(--bbs-side-w); background: var(--bbs-material); border-right: 1px solid var(--bbs-separator); pointer-events: none; transition: width .32s var(--bbs-ease); }
.bb-staff-side {
  width: var(--bbs-side-w); flex: none; position: sticky; top: var(--bbs-top); height: calc(100vh - var(--bbs-top));
  display: flex; flex-direction: column; z-index: 40;
  background: var(--bbs-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px);
  border-right: 1px solid var(--bbs-separator);
  transition: width .32s var(--bbs-ease);
}
.bb-staff.is-collapsed { --bbs-side-w: 68px; }
.bb-staff-brand { display: flex; align-items: center; gap: 10px; padding: 16px 12px 10px 16px; min-height: 62px; }
.bb-staff-logo { border-radius: 8px; flex: none; display: grid; place-items: center; overflow: hidden; background: var(--bbs-fill); }
.bb-staff-logo img { width: 100%; height: 100%; object-fit: cover; }
.bb-staff-brand-text { min-width: 0; line-height: 1.2; flex: 1; }
.bb-staff-brand-name { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
.bb-staff-brand-sub { color: var(--bbs-tertiary); font-size: 11px; margin-top: 1px; }
.bb-staff-collapse, .bb-staff-side-close { color: var(--bbs-tertiary) !important; }
.bb-staff-side-search {
  appearance: none; border: 0; margin: 2px 12px 8px; height: 32px; border-radius: 8px; background: var(--bbs-fill); color: var(--bbs-tertiary);
  display: flex; align-items: center; gap: 8px; padding: 0 8px 0 10px; cursor: pointer; font-size: 13px; transition: background .12s var(--bbs-ease-std);
}
.bb-staff-side-search:hover { background: var(--bbs-fill-strong); color: var(--bbs-secondary); }
.bb-staff-side-search .bb-staff-nav-label { flex: 1; text-align: left; }
.bb-staff.is-collapsed .bb-staff-brand { flex-direction: column; padding: 14px 0 8px; gap: 8px; }
.bb-staff.is-collapsed .bb-staff-brand-text, .bb-staff.is-collapsed .bb-staff-nav-label, .bb-staff.is-collapsed .bb-staff-nav-section span,
.bb-staff.is-collapsed .bb-staff-side-user-text, .bb-staff.is-collapsed .bb-staff-side-search .bb-staff-kbd { display: none; }
.bb-staff.is-collapsed .bb-staff-side-search { justify-content: center; padding: 0; margin: 2px 14px 8px; }
.bb-staff-nav { flex: 1; overflow-y: auto; padding: 0 10px 8px; display: flex; flex-direction: column; gap: 1px; scrollbar-width: thin; }
.bb-staff-nav-section { font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--bbs-tertiary); padding: 14px 8px 6px; min-height: 12px; }
.bb-staff.is-collapsed .bb-staff-nav-section { padding: 8px 0 4px; border-top: 1px solid var(--bbs-separator); margin: 6px 8px 0; }
.bb-staff.is-collapsed .bb-staff-nav-section:first-child { border-top: 0; }
.bb-staff-nav-item {
  position: relative; display: flex; align-items: center; gap: 10px; padding: 0 8px; height: 34px; border-radius: 8px; color: var(--bbs-label) !important;
  font-size: 13.5px; text-decoration: none !important; transition: background .12s var(--bbs-ease-std);
}
.bb-staff-nav-item svg { flex: none; color: var(--bbs-accent); }
.bb-staff-nav-item:hover { background: var(--bbs-fill); }
.bb-staff-nav-item[aria-current="page"] { background: var(--bbs-fill-strong); font-weight: 500; }
.bb-staff-nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-nav-badge { min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; background: var(--bbs-fill-strong); color: var(--bbs-secondary); font-size: 11px; font-weight: 500; display: inline-grid; place-items: center; font-variant-numeric: tabular-nums; animation: bb-staff-badge .42s var(--bbs-ease); }
.bb-staff-nav-badge.is-alert { background: var(--bbs-danger); color: #fff; }
@keyframes bb-staff-badge { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
.bb-staff.is-collapsed .bb-staff-nav-item { justify-content: center; padding: 0; }
.bb-staff.is-collapsed .bb-staff-nav-badge { position: absolute; top: 1px; right: 4px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; }
.bb-staff-side-foot { padding: 10px; border-top: 1px solid var(--bbs-separator); }
.bb-staff-side-user { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 10px; min-width: 0; color: inherit !important; text-decoration: none !important; }
.bb-staff-side-user:hover { background: var(--bbs-fill); }
.bb-staff-side-user-text { min-width: 0; line-height: 1.25; display: flex; flex-direction: column; }
.bb-staff-side-user-name { font-weight: 500; font-size: 13px; }
.bb-staff-side-user-role { color: var(--bbs-tertiary); font-size: 11.5px; text-transform: capitalize; }
.bb-staff.is-collapsed .bb-staff-side-user { justify-content: center; }
.bb-staff-scrim { display: none; }

/* ---------------------------------------------------------------- Main / top bar */
.bb-staff-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bb-staff-top {
  position: sticky; top: var(--bbs-top); z-index: 30; height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 20px 0 28px;
  background: var(--bbs-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--bbs-separator);
}
.bb-staff-top-title { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; line-height: 1.2; }
.bb-staff-crumbs { font-size: 11.5px; color: var(--bbs-tertiary); display: flex; gap: 4px; align-items: center; white-space: nowrap; overflow: hidden; }
.bb-staff-crumb { display: inline-flex; align-items: center; gap: 4px; }
.bb-staff-crumbs a { color: var(--bbs-tertiary); }
.bb-staff-top h1 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.bb-staff-top .bb-staff-menu-btn { display: none; }
.bb-staff-top-search { position: relative; width: 240px; max-width: 28vw; }
.bb-staff-top-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--bbs-tertiary); pointer-events: none; }
.bb-staff-top-search input { width: 100%; height: 32px; padding: 0 10px 0 30px; border-radius: 8px; border: 0; background: var(--bbs-fill); outline: none; font-size: 13px; transition: background .12s, box-shadow .12s; }
.bb-staff-top-search input::placeholder { color: var(--bbs-tertiary); }
.bb-staff-top-search input:focus { background: var(--bbs-surface); box-shadow: var(--bbs-ring); }
.bb-staff-top-actions { display: flex; align-items: center; gap: 2px; }
.bb-staff-conn { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; color: var(--bbs-secondary); background: var(--bbs-fill); margin-right: 6px; white-space: nowrap; }
.bb-staff-conn i { width: 7px; height: 7px; border-radius: 50%; background: var(--bbs-quaternary); position: relative; }
.bb-staff-conn.is-live i { background: var(--bbs-success); }
.bb-staff-conn.is-live i::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid var(--bbs-success); animation: bb-staff-ping 2s var(--bbs-ease-std) infinite; }
.bb-staff-conn.is-wait i { background: var(--bbs-warning); animation: bb-staff-blink 1s ease-in-out infinite; }
.bb-staff-conn.is-poll i { background: var(--bbs-tertiary); }
@keyframes bb-staff-ping { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes bb-staff-blink { 50% { opacity: .3; } }
.bb-staff-content { flex: 1; padding: 28px 32px 40px; width: 100%; max-width: 1400px; margin: 0 auto; min-width: 0; }
.bb-staff-page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.bb-staff-stack > .bb-staff-page-head { margin-bottom: 0; }
.bb-staff-page-head h2 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.bb-staff-page-head p { color: var(--bbs-secondary); margin-top: 4px; font-size: 14px; }
.bb-staff-today { display: inline-flex; align-items: center; gap: 6px; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--bbs-separator-strong); color: var(--bbs-secondary); }
.bb-staff-today i { width: 6px; height: 6px; border-radius: 50%; background: var(--bbs-success); }
.bb-staff-today b { color: var(--bbs-label); font-weight: 500; }
.bb-staff-stack { display: flex; flex-direction: column; gap: 20px; }
.bb-staff-livedot { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 999px; background: var(--bbs-fill); color: var(--bbs-secondary); font-size: 11px; font-weight: 500; letter-spacing: 0; vertical-align: middle; }
.bb-staff-livedot i { width: 6px; height: 6px; border-radius: 50%; background: var(--bbs-quaternary); }
.bb-staff-livedot.is-on { background: var(--bbs-success-tint); color: var(--bbs-success-text); }
.bb-staff-livedot.is-on i { background: var(--bbs-success); animation: bb-staff-blink 2s ease-in-out infinite; }

/* ---------------------------------------------------------------- Buttons */
.bb-staff-btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px;
  font-size: 13.5px; font-weight: 500; cursor: pointer; border: 0; white-space: nowrap; line-height: 1;
  transition: background .12s var(--bbs-ease-std), color .12s, transform .08s, box-shadow .12s; text-decoration: none !important;
}
.bb-staff-btn:active:not(:disabled) { transform: scale(.97); }
.bb-staff-btn:disabled { opacity: .4; cursor: default; }
.bb-staff-btn-primary { background: var(--bbs-accent); color: var(--bbs-on-accent) !important; }
.bb-staff-btn-primary:hover:not(:disabled) { background: var(--bbs-accent-hover); }
.bb-staff-btn-secondary, .bb-staff-btn-soft { background: var(--bbs-fill); color: var(--bbs-label) !important; }
.bb-staff-btn-secondary:hover:not(:disabled), .bb-staff-btn-soft:hover:not(:disabled) { background: var(--bbs-fill-strong); }
.bb-staff-btn-soft { color: var(--bbs-accent) !important; background: var(--bbs-accent-tint); }
.bb-staff-btn-ghost { background: transparent; color: var(--bbs-accent) !important; }
.bb-staff-btn-ghost:hover:not(:disabled) { background: var(--bbs-fill); }
.bb-staff-btn-danger { background: var(--bbs-danger-tint); color: var(--bbs-danger-text) !important; }
.bb-staff-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--bbs-danger) 18%, transparent); }
.bb-staff-btn-danger-ghost { background: transparent; color: var(--bbs-danger-text) !important; }
.bb-staff-btn-danger-ghost:hover:not(:disabled) { background: var(--bbs-danger-tint); }
.bb-staff-btn-sm { height: 30px; padding: 0 11px; font-size: 13px; gap: 5px; }
.bb-staff-btn-lg { height: 44px; padding: 0 20px; font-size: 15px; border-radius: 10px; }
.bb-staff-btn-block { width: 100%; }
.bb-staff-icon-btn {
  appearance: none; position: relative; width: 34px; height: 34px; flex: none; border-radius: 8px; border: 0; background: transparent;
  display: inline-grid; place-items: center; color: var(--bbs-secondary); cursor: pointer; transition: background .12s var(--bbs-ease-std), color .12s;
}
.bb-staff-icon-btn:hover:not(:disabled) { background: var(--bbs-fill); color: var(--bbs-label); }
.bb-staff-icon-btn:active:not(:disabled) { transform: scale(.94); }
.bb-staff-icon-btn[aria-expanded="true"] { background: var(--bbs-fill-strong); color: var(--bbs-label); }
.bb-staff-icon-btn-sm { width: 28px; height: 28px; border-radius: 7px; }
.bb-staff-dot-badge { position: absolute; top: 3px; right: 2px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: var(--bbs-danger); color: #fff; font-size: 10.5px; font-weight: 500; display: grid; place-items: center; border: 2px solid var(--bbs-surface); font-variant-numeric: tabular-nums; animation: bb-staff-badge .42s var(--bbs-ease); }
.bb-staff-spin { animation: bb-staff-spin .8s linear infinite; }
@keyframes bb-staff-spin { to { transform: rotate(360deg); } }
.bb-staff-link-btn { appearance: none; border: 0; background: transparent; color: var(--bbs-accent); font-weight: 400; cursor: pointer; padding: 0; font-size: 13px; }
.bb-staff-link-btn:hover:not(:disabled) { text-decoration: underline; text-underline-offset: 2px; }
.bb-staff-link-btn:disabled { color: var(--bbs-quaternary); cursor: default; }

/* ---------------------------------------------------------------- Cards & grids */
.bb-staff-card { background: var(--bbs-surface); border: 1px solid var(--bbs-separator); border-radius: var(--bbs-radius); min-width: 0; }
.bb-staff-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 0; flex-wrap: wrap; }
.bb-staff-card-head h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
.bb-staff-card-head p { color: var(--bbs-secondary); font-size: 12.5px; margin-top: 2px; }
.bb-staff-card-body { padding: 16px 20px 20px; }
.bb-staff-card-list { padding-top: 8px; }
.bb-staff-card-foot { padding: 12px 20px; border-top: 1px solid var(--bbs-separator); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.bb-staff-grid { display: grid; gap: 16px; }
.bb-staff-grid-kpi { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.bb-staff-grid-2-1 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.bb-staff-grid-1-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
.bb-staff-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bb-staff-grid-1 { grid-template-columns: minmax(0, 1fr); }
.bb-staff-subcard { padding: 16px; display: flex; flex-direction: column; gap: 14px; background: var(--bbs-surface-2); }
.bb-staff-subcard.is-answer { border-color: color-mix(in srgb, var(--bbs-accent) 30%, var(--bbs-separator)); background: var(--bbs-surface); }
.bb-staff-subcard-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.bb-staff-subcard-title svg { color: var(--bbs-accent); }

/* Icon tiles */
.bb-staff-tile { border-radius: 8px; display: inline-grid; place-items: center; flex: none; }
.bb-staff-tile.is-accent { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-tile.is-indigo { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-tile.is-teal { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-tile.is-success { background: var(--bbs-success-tint); color: var(--bbs-success-text); }
.bb-staff-tile.is-warning { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-tile.is-danger { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-tile.is-gray { background: var(--bbs-fill); color: var(--bbs-secondary); }

/* KPI tiles */
.bb-staff-kpi { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; position: relative; overflow: hidden; transition: border-color .12s; }
.bb-staff-kpi.is-link:hover { border-color: var(--bbs-separator-strong); }
.bb-staff-kpi-top { display: flex; align-items: center; gap: 10px; }
.bb-staff-kpi-label { font-size: 13px; font-weight: 500; color: var(--bbs-secondary); flex: 1; }
.bb-staff-kpi-chev { color: var(--bbs-quaternary); }
.bb-staff-kpi-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.bb-staff-kpi-value { font-size: 32px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.05; }
.bb-staff-kpi-spark { width: 46%; max-width: 150px; flex: none; margin-bottom: 2px; }
.bb-staff-kpi-delta { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 3px; margin-top: -4px; min-height: 16px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.bb-staff-kpi-delta.is-good { color: var(--bbs-success-text); }
.bb-staff-kpi-delta.is-bad { color: var(--bbs-danger-text); }
.bb-staff-kpi-delta.is-flat { color: var(--bbs-tertiary); font-weight: 400; }
.bb-staff-kpi-vs { color: var(--bbs-tertiary); font-weight: 400; margin-left: 3px; }
.bb-staff-kpi-cta { color: var(--bbs-accent); font-weight: 500; }
.bb-staff-kpi a.bb-staff-kpi-link { position: absolute; inset: 0; border-radius: inherit; z-index: 1; }
/* legacy KPI markup (platform pages) */
.bb-staff-kpi-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--bbs-accent-tint); color: var(--bbs-accent); flex: none; }
.bb-staff-kpi-icon.is-warn { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-kpi-icon.is-sky { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-kpi-icon.is-green { background: var(--bbs-success-tint); color: var(--bbs-success-text); }
.bb-staff-kpi-meta { margin-top: auto; font-size: 12px; color: var(--bbs-secondary); display: flex; align-items: center; gap: 6px; min-height: 18px; }
.bb-staff-meter { height: 6px; border-radius: 999px; background: var(--bbs-accent-tint); overflow: hidden; }
.bb-staff-meter > span { display: block; height: 100%; border-radius: 999px; background: var(--bbs-accent); }

/* Stat strip */
.bb-staff-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.bb-staff-strip-item { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 8px; padding: 14px 18px; color: inherit !important; text-decoration: none !important; border-left: 1px solid var(--bbs-separator); transition: background .12s; min-width: 0; }
.bb-staff-strip-item:first-child { border-left: 0; border-radius: var(--bbs-radius) 0 0 var(--bbs-radius); }
.bb-staff-strip-item:last-child { border-radius: 0 var(--bbs-radius) var(--bbs-radius) 0; }
.bb-staff-strip-item:hover { background: var(--bbs-surface-2); }
.bb-staff-strip-item svg { color: var(--bbs-tertiary); align-self: center; }
.bb-staff-strip-label { font-size: 12.5px; color: var(--bbs-secondary); align-self: center; }
.bb-staff-strip-value { grid-column: 1 / -1; font-size: 20px; font-weight: 500; letter-spacing: -0.01em; margin-top: 4px; }
.bb-staff-strip-sub { grid-column: 1 / -1; font-size: 12px; color: var(--bbs-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---------------------------------------------------------------- Forms */
.bb-staff-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bb-staff-label { font-size: 13px; font-weight: 500; color: var(--bbs-label); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bb-staff-hint { font-size: 12.5px; color: var(--bbs-secondary); line-height: 1.45; }
.bb-staff-error-text { font-size: 12.5px; color: var(--bbs-danger-text); }
.bb-staff-input {
  width: 100%; min-width: 0; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid transparent; background: var(--bbs-fill); outline: none;
  font-size: 14px; color: var(--bbs-label); transition: background .12s, box-shadow .12s, border-color .12s;
}
.bb-staff-input::placeholder { color: var(--bbs-tertiary); }
.bb-staff-input:hover:not(:disabled):not(:focus) { background: var(--bbs-fill-strong); }
.bb-staff-input:focus { background: var(--bbs-surface); border-color: var(--bbs-accent); box-shadow: var(--bbs-ring); }
.bb-staff-input:disabled, .bb-staff-input[readonly] { color: var(--bbs-secondary); cursor: default; }
.bb-staff-input[aria-invalid="true"] { border-color: var(--bbs-danger); }
textarea.bb-staff-input { height: auto; min-height: 110px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
select.bb-staff-input { appearance: none; padding-right: 32px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2386868B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
.bb-staff-input-sm { height: 32px; font-size: 13px; }
.bb-staff-input-group { position: relative; }
.bb-staff-input-group .bb-staff-input { padding-right: 40px; }
.bb-staff-input-group .bb-staff-icon-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; }
.bb-staff-search { position: relative; min-width: 0; }
.bb-staff-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--bbs-tertiary); pointer-events: none; }
.bb-staff-search .bb-staff-input { padding-left: 32px; }
.bb-staff-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; }
.bb-staff-span-2 { grid-column: 1 / -1; }
.bb-staff-color { display: flex; align-items: center; gap: 8px; }
.bb-staff-color input[type="color"] { width: 36px; height: 36px; padding: 3px; border-radius: 8px; border: 1px solid var(--bbs-separator); background: var(--bbs-surface); cursor: pointer; flex: none; }
.bb-staff-color input[type="color"]:disabled { cursor: default; opacity: .5; }
.bb-staff-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 13.5px; color: var(--bbs-label); }
.bb-staff-check input { width: 16px; height: 16px; margin: 2px 0 0; accent-color: var(--bbs-accent); flex: none; }
.bb-staff-check b { font-weight: 500; }
.bb-staff-range { width: 100%; accent-color: var(--bbs-accent); }

/* Switch (iOS) */
.bb-staff-switch { position: relative; display: inline-flex; align-items: center; flex: none; }
.bb-staff-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; width: 100%; height: 100%; z-index: 1; }
.bb-staff-switch input:disabled { cursor: default; }
.bb-staff-switch-track { width: 42px; height: 26px; border-radius: 999px; background: var(--bbs-fill-strong); transition: background .2s var(--bbs-ease-std); position: relative; pointer-events: none; }
.bb-staff-switch-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.15), 0 0 0 .5px rgba(0,0,0,.04); transition: transform .28s var(--bbs-ease); }
.bb-staff-switch input:checked + .bb-staff-switch-track { background: var(--bbs-success); }
.bb-staff-switch input:checked + .bb-staff-switch-track::after { transform: translateX(16px); }
.bb-staff-switch input:focus-visible + .bb-staff-switch-track { box-shadow: var(--bbs-ring); }
.bb-staff-switch input:disabled + .bb-staff-switch-track { opacity: .45; }
.bb-staff-switch-sm .bb-staff-switch-track { width: 34px; height: 20px; }
.bb-staff-switch-sm .bb-staff-switch-track::after { width: 16px; height: 16px; }
.bb-staff-switch-sm input:checked + .bb-staff-switch-track::after { transform: translateX(14px); }
.bb-staff-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 0; border-top: 1px solid var(--bbs-separator); }
.bb-staff-setting-row:first-child { border-top: 0; padding-top: 0; }
.bb-staff-setting-row h4 { font-size: 14px; font-weight: 500; }
.bb-staff-setting-row p { font-size: 13px; color: var(--bbs-secondary); margin-top: 2px; max-width: 560px; }

/* ---------------------------------------------------------------- Pills & chips */
.bb-staff-pill { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 11.5px; font-weight: 500; white-space: nowrap; line-height: 1; text-transform: capitalize; background: var(--bbs-fill); color: var(--bbs-secondary); }
.bb-staff-pill svg { flex: none; }
.bb-staff-pill-dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.bb-staff-role-owner { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-role-admin { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-role-trainer { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-role-viewer, .bb-staff-role-user, .bb-staff-role-public, .bb-staff-role-anonymous, .bb-staff-role-visitor { background: var(--bbs-fill); color: var(--bbs-secondary); }
.bb-staff-role-customer { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-role-vendor { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-role-internal, .bb-staff-role-staff { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-status-active, .bb-staff-status-completed, .bb-staff-status-resolved { background: var(--bbs-success-tint); color: var(--bbs-success-text); }
.bb-staff-status-invited, .bb-staff-status-queued, .bb-staff-status-open { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-status-disabled, .bb-staff-status-dismissed { background: var(--bbs-fill); color: var(--bbs-secondary); }
.bb-staff-status-processing, .bb-staff-status-must_change { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-status-failed { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-reason { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 6px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.bb-staff-reason-no_context { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-reason-low_confidence { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-reason-llm_unknown { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-reason-negative_feedback { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-reason-llm_unavailable { background: var(--bbs-fill); color: var(--bbs-secondary); }
.bb-staff-count { display: inline-grid; place-items: center; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; background: var(--bbs-fill); color: var(--bbs-secondary); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.bb-staff-occ { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; font-size: 13px; font-variant-numeric: tabular-nums; }
.bb-staff-occ.is-hot { color: var(--bbs-warning-text); }
.bb-staff-new-tag { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; margin-right: 6px; border-radius: 5px; background: var(--bbs-accent); color: #fff; font-size: 10.5px; font-weight: 500; vertical-align: 1px; letter-spacing: .02em; }
.bb-staff-chip-stat { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 6px; background: var(--bbs-fill); color: var(--bbs-secondary); font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
.bb-staff-chip-stat.is-warning { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-chip-stat.is-success { background: var(--bbs-success-tint); color: var(--bbs-success-text); }
.bb-staff-chip-stat.is-danger { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }

/* Avatar */
.bb-staff-avatar { width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 12px; font-weight: 500; color: #fff; letter-spacing: .02em; text-transform: uppercase; }
.bb-staff-avatar-sm { width: 26px; height: 26px; font-size: 10.5px; }
.bb-staff-avatar-lg { width: 56px; height: 56px; font-size: 19px; }
.bb-staff-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bb-staff-person-text { min-width: 0; line-height: 1.3; display: flex; flex-direction: column; }
.bb-staff-person-name { font-weight: 500; font-size: 13.5px; }
.bb-staff-person-sub { font-size: 12px; color: var(--bbs-secondary); }

/* ---------------------------------------------------------------- Tabs & segmented */
.bb-staff-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--bbs-separator); overflow-x: auto; scrollbar-width: none; }
.bb-staff-tabs::-webkit-scrollbar { display: none; }
.bb-staff .bb-staff-tab {
  appearance: none; background: transparent; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 10px 12px; display: inline-flex; align-items: center; gap: 8px;
  color: var(--bbs-secondary); font-weight: 500; font-size: 13.5px; cursor: pointer; white-space: nowrap; text-decoration: none !important;
}
.bb-staff .bb-staff-tab:hover { color: var(--bbs-label); text-decoration: none; }
.bb-staff .bb-staff-tab[aria-selected="true"], .bb-staff .bb-staff-tab[aria-current="page"] { color: var(--bbs-label); border-bottom-color: var(--bbs-accent); }
.bb-staff-seg { position: relative; display: inline-flex; padding: 2px; border-radius: 9px; background: var(--bbs-fill); gap: 0; flex: none; isolation: isolate; }
.bb-staff-seg button { position: relative; z-index: 1; appearance: none; border: 0; background: transparent; padding: 0 12px; height: 28px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--bbs-label); cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; transition: color .12s; }
.bb-staff-seg button[aria-pressed="false"] { color: var(--bbs-secondary); }
.bb-staff-seg button[aria-pressed="false"]:hover { color: var(--bbs-label); }
.bb-staff-seg:not(.has-thumb) button[aria-pressed="true"] { background: var(--bbs-surface); box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.04); }
.bb-staff.is-dark .bb-staff-seg:not(.has-thumb) button[aria-pressed="true"] { background: #636366; }
.bb-staff-seg-thumb { position: absolute; z-index: 0; top: 2px; bottom: 2px; left: 0; border-radius: 7px; background: var(--bbs-surface); box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 0 0 .5px rgba(0,0,0,.04); transition: transform .32s var(--bbs-ease), width .32s var(--bbs-ease); }
.bb-staff.is-dark .bb-staff-seg-thumb { background: #636366; }
.bb-staff-seg.is-sm button { height: 24px; padding: 0 9px; font-size: 12px; }
.bb-staff-seg-count { font-size: 11px; color: var(--bbs-tertiary); font-variant-numeric: tabular-nums; }
.bb-staff-seg button[aria-pressed="true"] .bb-staff-seg-count { color: var(--bbs-secondary); }
.bb-staff-scroll-x { max-width: 100%; overflow-x: auto; scrollbar-width: none; min-width: 0; }
.bb-staff-scroll-x::-webkit-scrollbar { display: none; }

/* ---------------------------------------------------------------- Toolbar / filters */
.bb-staff-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--bbs-separator); }
.bb-staff-toolbar.is-sub { padding: 10px 16px; background: var(--bbs-surface-2); }
.bb-staff-toolbar .bb-staff-search { flex: 1 1 220px; max-width: 340px; margin-left: auto; }
.bb-staff-toolbar:not(.is-sub) > .bb-staff-search:first-child { margin-left: 0; }
.bb-staff-toolbar-label { font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--bbs-tertiary); }
.bb-staff-toolbar-count { margin-left: auto; font-size: 12.5px; color: var(--bbs-secondary); }
.bb-staff-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--bbs-separator); }
.bb-staff-filters .bb-staff-search { flex: 1 1 240px; max-width: 360px; }
.bb-staff-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.bb-staff-chip { appearance: none; height: 28px; padding: 0 11px; border-radius: 999px; border: 0; background: var(--bbs-fill); color: var(--bbs-label); font-size: 12.5px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: background .12s; }
.bb-staff-chip:hover { background: var(--bbs-fill-strong); }
.bb-staff-chip[aria-pressed="true"] { background: var(--bbs-accent); color: #fff; }
.bb-staff-chip i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* ---------------------------------------------------------------- Tables */
.bb-staff-table-wrap { overflow-x: auto; position: relative; }
.bb-staff-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.bb-staff-table th { text-align: left; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--bbs-tertiary); padding: 10px 16px; border-bottom: 1px solid var(--bbs-separator); white-space: nowrap; background: transparent; }
.bb-staff-table td { padding: 12px 16px; border-bottom: 1px solid var(--bbs-separator); vertical-align: middle; }
.bb-staff-table tr:last-child td { border-bottom: 0; }
.bb-staff-table tbody tr { transition: background .12s var(--bbs-ease-std); }
.bb-staff-table tbody tr.is-link { cursor: pointer; }
.bb-staff-table tbody tr:hover, .bb-staff-table tbody tr.is-active { background: var(--bbs-surface-2); }
.bb-staff.is-dark .bb-staff-table tbody tr:hover { background: rgba(255,255,255,.03); }
.bb-staff-table tbody tr.is-new { animation: bb-staff-rowin .5s var(--bbs-ease), bb-staff-flash 2.6s var(--bbs-ease-std); }
.bb-staff-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }
.bb-staff-table .is-actions { text-align: right; white-space: nowrap; }
.bb-staff-cell-label { display: none; }
.bb-staff-row-link { color: var(--bbs-label) !important; font-weight: 500; text-decoration: none !important; }
.bb-staff-row-link:hover { color: var(--bbs-accent) !important; }
.bb-staff-pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--bbs-separator); font-size: 13px; color: var(--bbs-secondary); flex-wrap: wrap; }
.bb-staff-pager > div { display: flex; gap: 6px; }
.bb-staff-conv-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bb-staff-conv-sub { display: flex; gap: 8px; align-items: center; margin-top: 2px; flex-wrap: wrap; font-size: 12px; color: var(--bbs-tertiary); min-width: 0; }
.bb-staff-preview { color: var(--bbs-secondary); display: inline-block; vertical-align: bottom; }
@keyframes bb-staff-rowin { from { opacity: 0; transform: translateY(-8px); } }
@keyframes bb-staff-flash { 0%, 30% { background: var(--bbs-accent-tint); } 100% { background: transparent; } }

/* Lists */
.bb-staff-list { list-style: none; margin: 0; padding: 0 0 6px; }
.bb-staff-list > li { display: flex; align-items: center; gap: 12px; padding: 11px 20px; border-top: 1px solid var(--bbs-separator); position: relative; }
.bb-staff-list > li:first-child { border-top: 0; }
.bb-staff-list > li.is-new { animation: bb-staff-rowin .5s var(--bbs-ease), bb-staff-flash 2.6s var(--bbs-ease-std); }
.bb-staff-list-main { flex: 1; min-width: 0; }
.bb-staff-list-title { font-weight: 500; font-size: 13.5px; }
.bb-staff-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--bbs-secondary); margin-top: 4px; min-width: 0; }
.bb-staff-list-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 12px; white-space: nowrap; }
.bb-staff-dot-sep::before { content: "·"; margin-right: 8px; color: var(--bbs-quaternary); }
.bb-staff-list .bb-staff-row-link { font-size: 13.5px; }

/* ---------------------------------------------------------------- Gap rows */
.bb-staff-gap-row { display: grid; grid-template-columns: minmax(0, 1fr) 160px 70px 180px 96px; gap: 16px; align-items: center; padding: 12px 18px; border-top: 1px solid var(--bbs-separator); cursor: pointer; text-decoration: none !important; color: inherit !important; transition: background .12s var(--bbs-ease-std); }
.bb-staff-gap-row:hover { background: var(--bbs-surface-2); }
.bb-staff.is-dark .bb-staff-gap-row:hover { background: rgba(255,255,255,.03); }
.bb-staff-gap-row.is-active { background: var(--bbs-accent-tint); }
.bb-staff-gap-row.is-new { animation: bb-staff-rowin .5s var(--bbs-ease), bb-staff-flash 2.6s var(--bbs-ease-std); }
.bb-staff-gap-row.is-head { cursor: default; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--bbs-tertiary); padding-top: 10px; padding-bottom: 10px; border-top: 0; }
.bb-staff-gap-row.is-head:hover { background: transparent; }
.bb-staff-gap-q { font-weight: 500; font-size: 14px; line-height: 1.4; }
.bb-staff-gap-sub { font-size: 12px; color: var(--bbs-tertiary); margin-top: 2px; }
.bb-staff-col-seen { font-size: 12.5px; text-align: right; }

/* ---------------------------------------------------------------- Drawer & modal (sheets) */
.bb-staff-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.28); z-index: 1000; animation: bb-staff-fade .2s var(--bbs-ease-std); }
.bb-staff-overlay.is-light { background: rgba(0,0,0,.18); }
.bb-staff-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(640px, 100vw); background: var(--bbs-surface); color: var(--bbs-label); z-index: 1001; display: flex; flex-direction: column; box-shadow: var(--bbs-shadow-window); animation: bb-staff-drawer .36s var(--bbs-ease); outline: none; font-family: var(--bbs-font); }
.bb-staff-drawer-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 16px 24px; border-bottom: 1px solid var(--bbs-separator); }
.bb-staff-drawer-title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.bb-staff-drawer-q { font-size: 20px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.3; }
.bb-staff-drawer-body { flex: 1; overflow-y: auto; padding: 20px 24px 28px; display: flex; flex-direction: column; gap: 22px; }
.bb-staff-drawer-foot { padding: 12px 24px; border-top: 1px solid var(--bbs-separator); display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; background: var(--bbs-surface-2); }
.bb-staff-modal-wrap { position: fixed; inset: 0; z-index: 1001; display: grid; place-items: center; padding: 16px; overflow-y: auto; }
.bb-staff-modal { width: min(520px, 100%); min-width: 0; max-width: 100%; background: var(--bbs-surface); color: var(--bbs-label); border-radius: 14px; box-shadow: var(--bbs-shadow-window); animation: bb-staff-sheet .36s var(--bbs-ease); outline: none; font-family: var(--bbs-font); }
.bb-staff-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 4px 24px; }
.bb-staff-modal-head h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.bb-staff-modal-head p { color: var(--bbs-secondary); font-size: 13px; margin-top: 3px; }
.bb-staff-modal-body { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
.bb-staff-modal-foot { padding: 12px 24px 20px; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
@keyframes bb-staff-fade { from { opacity: 0; } }
@keyframes bb-staff-drawer { from { transform: translateX(32px); opacity: 0; } }
@keyframes bb-staff-sheet { from { transform: translateY(12px) scale(.98); opacity: 0; } }
@keyframes bb-staff-pop { from { transform: scale(.96); opacity: 0; } }

/* Popover / menu */
.bb-staff-pop-anchor { position: relative; }
.bb-staff-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 60; background: var(--bbs-surface); color: var(--bbs-label); border-radius: 12px; box-shadow: var(--bbs-shadow-pop); animation: bb-staff-pop .18s var(--bbs-ease); transform-origin: top right; min-width: 220px; }
.bb-staff-menu { padding: 6px; display: flex; flex-direction: column; }
.bb-staff-menu-item { appearance: none; border: 0; background: transparent; display: flex; align-items: center; gap: 10px; padding: 0 10px; height: 32px; border-radius: 7px; font-size: 13.5px; color: var(--bbs-label) !important; cursor: pointer; text-align: left; text-decoration: none !important; width: 100%; }
.bb-staff-menu-item svg { color: var(--bbs-secondary); flex: none; }
.bb-staff-menu-item:hover, .bb-staff-menu-item:focus-visible { background: var(--bbs-accent); color: #fff !important; outline: none; }
.bb-staff-menu-item:hover svg, .bb-staff-menu-item:focus-visible svg { color: #fff; }
.bb-staff-menu-item:hover .bb-staff-kbd, .bb-staff-menu-item:focus-visible .bb-staff-kbd { background: rgba(255,255,255,.2); color: #fff; box-shadow: none; }
.bb-staff-menu-item.is-danger, .bb-staff-menu-item.is-danger svg { color: var(--bbs-danger-text) !important; }
.bb-staff-menu-item.is-danger:hover, .bb-staff-menu-item.is-danger:focus-visible { background: var(--bbs-danger); color: #fff !important; }
.bb-staff-menu-item.is-danger:hover svg, .bb-staff-menu-item.is-danger:focus-visible svg { color: #fff !important; }
.bb-staff-menu-sep { height: 1px; background: var(--bbs-separator); margin: 6px 0; }
.bb-staff-menu-head { padding: 14px 14px 10px; }
.bb-staff-menu-setting { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 14px; font-size: 13.5px; }
.bb-staff-user-pop { width: 280px; }
.bb-staff-user-btn { appearance: none; border: 0; background: transparent; display: flex; align-items: center; padding: 3px; border-radius: 999px; cursor: pointer; margin-left: 4px; }
.bb-staff-user-btn:hover, .bb-staff-user-btn[aria-expanded="true"] { background: var(--bbs-fill); }

/* Notifications */
.bb-staff-notif-pop { width: 380px; max-width: calc(100vw - 24px); overflow: hidden; }
.bb-staff-notif-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; }
.bb-staff-notif-head h3 { font-size: 15px; font-weight: 600; }
.bb-staff-notif-list { max-height: min(440px, 60vh); overflow-y: auto; border-top: 1px solid var(--bbs-separator); }
.bb-staff-notif { display: flex; gap: 12px; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--bbs-separator); cursor: pointer; width: 100%; text-align: left; background: transparent; appearance: none; position: relative; transition: background .12s; }
.bb-staff-notif:last-child { border-bottom: 0; }
.bb-staff-notif.is-wide { padding: 14px 20px; }
.bb-staff-notif:hover, .bb-staff-notif:focus-visible { background: var(--bbs-surface-2); outline: none; }
.bb-staff-notif.is-unread::after { content: ""; position: absolute; right: 16px; top: 18px; width: 8px; height: 8px; border-radius: 50%; background: var(--bbs-accent); }
.bb-staff-notif.is-fresh { animation: bb-staff-notifin .5s var(--bbs-ease), bb-staff-flash 2.4s var(--bbs-ease-std); }
@keyframes bb-staff-notifin { from { opacity: 0; transform: translateY(-10px); max-height: 0; } to { max-height: 160px; } }
.bb-staff-notif-icon { width: 30px; height: 30px; border-radius: 8px; flex: none; display: grid; place-items: center; }
.bb-staff-notif-icon.is-gap { background: var(--bbs-warning-tint); color: var(--bbs-warning-text); }
.bb-staff-notif-icon.is-feedback, .bb-staff-notif-icon.is-training_failed { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-notif-icon.is-staff { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-notif-title { display: block; font-size: 13.5px; font-weight: 500; color: var(--bbs-label); padding-right: 16px; }
.bb-staff-notif-body { display: block; font-size: 12.5px; color: var(--bbs-secondary); margin-top: 2px; }
.bb-staff-notif-time { display: block; font-size: 11.5px; color: var(--bbs-tertiary); margin-top: 4px; }
.bb-staff-notif-foot { padding: 10px; text-align: center; border-top: 1px solid var(--bbs-separator); }

/* ---------------------------------------------------------------- Command palette */
.bb-staff-palette-wrap { position: fixed; inset: 0; z-index: 1001; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
.bb-staff-palette { width: min(620px, 100%); background: var(--bbs-surface); color: var(--bbs-label); border-radius: 14px; box-shadow: var(--bbs-shadow-window); overflow: hidden; animation: bb-staff-sheet .32s var(--bbs-ease); font-family: var(--bbs-font); display: flex; flex-direction: column; max-height: 70vh; }
.bb-staff-palette-input { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 54px; border-bottom: 1px solid var(--bbs-separator); color: var(--bbs-tertiary); }
.bb-staff-palette-input input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: 17px; color: var(--bbs-label); }
.bb-staff-palette-input input::placeholder { color: var(--bbs-tertiary); }
.bb-staff .bb-staff-palette-input input:focus-visible { outline: none; }
.bb-staff-palette-list { overflow-y: auto; padding: 6px; flex: 1; }
.bb-staff-palette-group { font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--bbs-tertiary); padding: 10px 10px 4px; }
.bb-staff-palette-item { display: flex; align-items: center; gap: 10px; padding: 0 10px; min-height: 40px; border-radius: 8px; cursor: pointer; }
.bb-staff-palette-item[aria-selected="true"] { background: var(--bbs-accent); color: #fff; }
.bb-staff-palette-icon { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; background: var(--bbs-fill); color: var(--bbs-secondary); flex: none; }
.bb-staff-palette-item[aria-selected="true"] .bb-staff-palette-icon { background: rgba(255,255,255,.2); color: #fff; }
.bb-staff-palette-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; padding: 6px 0; font-size: 14px; }
.bb-staff-palette-sub { font-size: 12px; color: var(--bbs-tertiary); text-transform: none; }
.bb-staff-palette-item[aria-selected="true"] .bb-staff-palette-sub { color: rgba(255,255,255,.8); }
.bb-staff-palette-enter { opacity: .8; }
.bb-staff-palette-empty { padding: 28px 16px; text-align: center; color: var(--bbs-tertiary); font-size: 13.5px; }
.bb-staff-palette-foot { display: flex; gap: 16px; padding: 8px 16px; border-top: 1px solid var(--bbs-separator); font-size: 12px; color: var(--bbs-tertiary); background: var(--bbs-surface-2); }
.bb-staff-palette-foot span { display: inline-flex; align-items: center; gap: 4px; }

/* ---------------------------------------------------------------- Toasts (glass) */
.bb-staff-toasts { position: fixed; right: 20px; top: calc(var(--bbs-top) + 68px); z-index: 2000; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); font-family: var(--bbs-font); pointer-events: none; }
.bb-staff-toast {
  pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 10px 12px 12px; border-radius: 12px; color: var(--bbs-label);
  background: var(--bbs-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); box-shadow: var(--bbs-shadow-pop);
  font-size: 13px; line-height: 1.4; animation: bb-staff-toastin .26s var(--bbs-ease);
}
.bb-staff.is-notif-open .bb-staff-toasts { opacity: 0; pointer-events: none; transition: opacity .15s; }
.bb-staff-toast.is-leaving { animation: bb-staff-toastout .2s var(--bbs-ease-std) forwards; }
@keyframes bb-staff-toastin { from { opacity: 0; transform: translateY(-8px) scale(.96); } }
@keyframes bb-staff-toastout { to { opacity: 0; transform: translateY(-4px) scale(.98); } }
.bb-staff-toast-icon { width: 20px; height: 20px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; margin-top: 0; }
.bb-staff-toast.is-success .bb-staff-toast-icon { background: var(--bbs-success); }
.bb-staff-toast.is-error .bb-staff-toast-icon { background: var(--bbs-danger); }
.bb-staff-toast.is-warning .bb-staff-toast-icon { background: var(--bbs-warning); }
.bb-staff-toast.is-info .bb-staff-toast-icon { background: var(--bbs-accent); }
.bb-staff-toast-body { flex: 1; min-width: 0; word-break: break-word; padding-top: 1px; }
.bb-staff-toast-title { font-weight: 600; }
.bb-staff-toast-text { color: var(--bbs-secondary); margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.bb-staff-toast-action { appearance: none; border: 0; background: var(--bbs-fill); color: var(--bbs-accent); font-weight: 500; font-size: 12.5px; height: 26px; padding: 0 10px; border-radius: 7px; cursor: pointer; flex: none; align-self: center; }
.bb-staff-toast-action:hover { background: var(--bbs-fill-strong); }
.bb-staff-toast-close { appearance: none; border: 0; background: transparent; color: var(--bbs-tertiary); cursor: pointer; padding: 3px; border-radius: 6px; display: grid; place-items: center; flex: none; }
.bb-staff-toast-close:hover { color: var(--bbs-label); background: var(--bbs-fill); }

/* ---------------------------------------------------------------- Alerts, empty, skeleton, crash */
.bb-staff-alert { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border-radius: 10px; font-size: 13.5px; line-height: 1.5; }
.bb-staff-alert > svg { flex: none; margin-top: 2px; }
.bb-staff-alert-info { background: var(--bbs-accent-tint); color: var(--bbs-label); }
.bb-staff-alert-info > svg { color: var(--bbs-accent); }
.bb-staff-alert-warn { background: var(--bbs-warning-tint); color: var(--bbs-label); }
.bb-staff-alert-warn > svg { color: var(--bbs-warning-text); }
.bb-staff-alert-error { background: var(--bbs-danger-tint); color: var(--bbs-label); }
.bb-staff-alert-error > svg { color: var(--bbs-danger-text); }
.bb-staff-alert-success { background: var(--bbs-success-tint); color: var(--bbs-label); }
.bb-staff-alert-success > svg { color: var(--bbs-success-text); }
.bb-staff-alert .bb-staff-btn { flex: none; align-self: center; }
.bb-staff-empty { text-align: center; padding: 44px 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.bb-staff-empty.is-compact { padding: 28px 20px; }
.bb-staff-empty-icon { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--bbs-accent-tint); color: var(--bbs-accent); margin-bottom: 8px; }
.bb-staff-empty-icon.is-danger { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-empty.is-compact .bb-staff-empty-icon { width: 56px; height: 56px; }
.bb-staff-empty h4 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.bb-staff-empty p { font-size: 14px; color: var(--bbs-secondary); max-width: 380px; }
.bb-staff-crash { text-align: center; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.bb-staff-crash h4 { font-size: 17px; font-weight: 600; }
.bb-staff-crash p { color: var(--bbs-secondary); max-width: 420px; }
.bb-staff-crash-details { margin-top: 14px; font-size: 12px; color: var(--bbs-tertiary); max-width: 560px; }
.bb-staff-crash-details code { display: block; margin-top: 6px; font-family: var(--bbs-mono); text-align: left; white-space: pre-wrap; }
.bb-staff-skel { display: block; border-radius: 8px; background: linear-gradient(90deg, var(--bbs-fill) 25%, var(--bbs-fill-strong) 50%, var(--bbs-fill) 75%); background-size: 200% 100%; animation: bb-staff-shimmer 1.4s ease-in-out infinite; }
@keyframes bb-staff-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.bb-staff-sublime { margin: 0; }
.bb-staff-sublime .bb-sublime-head .bb-staff-btn { background: transparent; border-color: transparent; color: #cfcfc2; }
.bb-staff-sublime .bb-sublime-head .bb-staff-btn:hover { background: rgba(255,255,255,.08); color: #fff; }
.bb-staff-copy-field { display: flex; gap: 8px; align-items: center; padding: 5px 5px 5px 12px; border-radius: 10px; background: var(--bbs-fill); }
.bb-staff-copy-field code { flex: 1; min-width: 0; font-family: var(--bbs-mono); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin: 0; }
.bb-staff-kv dt { font-size: 11px; font-weight: 500; color: var(--bbs-tertiary); text-transform: uppercase; letter-spacing: .04em; }
.bb-staff-kv dd { margin: 4px 0 0; font-size: 13.5px; min-width: 0; }
.bb-staff-quote { border-radius: 12px; padding: 12px 14px; background: var(--bbs-fill); font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.bb-staff-quote.is-bot { background: var(--bbs-bot-bubble); }
.bb-staff-quote.is-danger { background: var(--bbs-danger-tint); }
.bb-staff-section-label { font-size: 11px; font-weight: 500; color: var(--bbs-tertiary); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.bb-staff-section-label .bb-staff-livedot { text-transform: none; }
.bb-staff-inline-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-weight: 500; font-size: 13px; }
.bb-staff-inline-warn { margin-top: 12px; display: flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--bbs-danger-text); }
.bb-staff-confirm { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; font-size: 12.5px; color: var(--bbs-danger-text); font-weight: 500; }
.bb-staff-context { border-radius: 12px; background: var(--bbs-surface-2); border: 1px solid var(--bbs-separator); overflow: hidden; }

/* Training task status */
.bb-staff-task { border-radius: 12px; padding: 14px; background: var(--bbs-accent-tint); display: flex; flex-direction: column; gap: 10px; animation: bb-staff-sheet .32s var(--bbs-ease); }
.bb-staff-task.is-done { background: var(--bbs-success-tint); }
.bb-staff-task.is-failed { background: var(--bbs-danger-tint); }
.bb-staff-task-head { display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
.bb-staff-task-head strong { font-weight: 500; display: block; }
.bb-staff-task-icon { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--bbs-surface); color: var(--bbs-accent); }
.bb-staff-task.is-done .bb-staff-task-icon { background: var(--bbs-success); color: #fff; animation: bb-staff-badge .42s var(--bbs-ease); }
.bb-staff-task.is-failed .bb-staff-task-icon { background: var(--bbs-danger); color: #fff; }
.bb-staff-task-sub { font-size: 12.5px; color: var(--bbs-secondary); margin-top: 1px; }
.bb-staff-task-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.bb-staff-task-steps span { height: 4px; border-radius: 4px; background: var(--bbs-fill-strong); position: relative; overflow: hidden; }
.bb-staff-task-steps span.is-done { background: var(--bbs-success); }
.bb-staff-task-steps span.is-active { background: var(--bbs-accent-tint); }
.bb-staff-task-steps span.is-active::after { content: ""; position: absolute; inset: 0; width: 40%; background: var(--bbs-accent); border-radius: 4px; animation: bb-staff-indet 1.2s var(--bbs-ease-std) infinite; }
@keyframes bb-staff-indet { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
.bb-staff-task-error { font-size: 12.5px; color: var(--bbs-danger-text); }

/* ---------------------------------------------------------------- Charts */
.bb-staff-chart { position: relative; width: 100%; transition: opacity .2s; }
.bb-staff-chart.is-busy { opacity: .55; }
.bb-staff-chart svg { display: block; width: 100%; overflow: visible; }
.bb-staff-chart svg:focus-visible { outline: 2px solid var(--bbs-accent); outline-offset: 4px; }
.bb-staff-chart text { font-family: var(--bbs-font); font-size: 11px; fill: var(--bbs-tertiary); font-variant-numeric: tabular-nums; }
.bb-staff-grid-line { stroke: var(--bbs-separator); stroke-width: 1; }
.bb-staff-axis { stroke: var(--bbs-separator-strong); stroke-width: 1; }
.bb-staff-crosshair { stroke: var(--bbs-tertiary); stroke-width: 1; }
.bb-staff-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 0; animation: bb-staff-draw 1s var(--bbs-ease) both; }
.bb-staff-line.is-2 { animation-delay: .12s; }
.bb-staff-line.is-thin { stroke-width: 1.5; }
.bb-staff-area { opacity: .1; animation: bb-staff-areain .9s var(--bbs-ease-std) both; }
.bb-staff-dot { stroke: var(--bbs-surface); stroke-width: 2; }
.bb-staff-enddots { animation: bb-staff-fade .3s .9s both; }
@keyframes bb-staff-draw { from { stroke-dashoffset: 1; } }
@keyframes bb-staff-areain { from { opacity: 0; } }
.bb-staff-tooltip { position: absolute; pointer-events: none; z-index: 5; background: var(--bbs-surface); color: var(--bbs-label); border-radius: 10px; padding: 10px 12px; font-size: 12px; box-shadow: var(--bbs-shadow-pop); transform: translate(-50%, -100%); white-space: nowrap; animation: bb-staff-fade .12s; }
.bb-staff-tooltip.is-small { padding: 7px 10px; }
.bb-staff-tooltip-title { font-weight: 500; margin-bottom: 6px; color: var(--bbs-secondary); font-size: 11.5px; }
.bb-staff-tooltip-row { display: flex; align-items: center; gap: 10px; line-height: 1.7; }
.bb-staff-tooltip-row span { display: inline-flex; align-items: center; gap: 6px; color: var(--bbs-secondary); }
.bb-staff-tooltip-row b { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 34px; }
.bb-staff-tooltip-row.is-foot { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--bbs-separator); }
.bb-staff-legend { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12.5px; color: var(--bbs-secondary); }
.bb-staff-legend span { display: inline-flex; align-items: center; gap: 6px; }
.bb-staff-key-line { width: 14px; height: 2px; border-radius: 2px; display: inline-block; }
.bb-staff-key-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; flex: none; }
.bb-staff-bars { display: flex; flex-direction: column; gap: 14px; }
.bb-staff-bar-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; font-size: 13px; }
.bb-staff-bar-track { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--bbs-fill); overflow: hidden; }
.bb-staff-bar-track > span { display: block; height: 100%; border-radius: 0 4px 4px 0; min-width: 2px; transform-origin: left; animation: bb-staff-grow .8s var(--bbs-ease) both; }
@keyframes bb-staff-grow { from { transform: scaleX(0); } }
.bb-staff-bar-label { color: var(--bbs-label); text-transform: capitalize; }
.bb-staff-bar-value { font-weight: 500; font-variant-numeric: tabular-nums; }
.bb-staff-bar-pct { color: var(--bbs-tertiary); font-weight: 400; margin-left: 6px; display: inline-block; min-width: 34px; text-align: right; }
.bb-staff-stack-bar { display: flex; gap: 2px; height: 8px; border-radius: 4px; overflow: hidden; }
.bb-staff-stack-bar > span { height: 100%; min-width: 3px; transform-origin: left; animation: bb-staff-grow .8s var(--bbs-ease) both; }
.bb-staff-stack-bar > span:first-child { border-radius: 4px 0 0 4px; }
.bb-staff-stack-bar > span:last-child { border-radius: 0 4px 4px 0; }
.bb-staff-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 16px; background: var(--bbs-separator); border-radius: 10px; overflow: hidden; border: 1px solid var(--bbs-separator); }
.bb-staff-status-cell { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--bbs-surface); }
.bb-staff-status-cell b { font-size: 17px; font-weight: 500; }
.bb-staff-status-cell-label { font-size: 12.5px; color: var(--bbs-secondary); display: inline-flex; align-items: center; gap: 6px; }
.bb-staff-ring { position: relative; flex: none; }
.bb-staff-ring svg { display: block; }
.bb-staff-ring-track { stroke: var(--bbs-fill); }
.bb-staff-ring-fill { animation: bb-staff-ring 1.1s var(--bbs-ease) both; }
@keyframes bb-staff-ring { from { stroke-dashoffset: var(--bbs-ring-c); } }
.bb-staff-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.bb-staff-ring-value { font-size: 28px; font-weight: 500; letter-spacing: -0.02em; }
.bb-staff-ring-center span { font-size: 12px; color: var(--bbs-secondary); margin-top: 3px; }
.bb-staff-rate { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.bb-staff-rate-legend { width: 100%; margin: 0; display: flex; flex-direction: column; }
.bb-staff-rate-legend > div { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--bbs-separator); font-size: 13px; }
.bb-staff-rate-legend > div:first-child { border-top: 0; }
.bb-staff-rate-legend dt { display: inline-flex; align-items: center; gap: 8px; color: var(--bbs-secondary); }
.bb-staff-rate-legend dd { margin: 0; font-weight: 500; }
.bb-staff-heat-wrap { position: relative; }
.bb-staff-heat { display: flex; flex-direction: column; gap: 3px; }
.bb-staff-heat-row { display: grid; grid-template-columns: 34px repeat(24, minmax(0, 1fr)); gap: 3px; align-items: center; }
.bb-staff-heat-day { font-size: 11px; color: var(--bbs-tertiary); }
.bb-staff-heat-hour { font-size: 10.5px; color: var(--bbs-tertiary); white-space: nowrap; overflow: visible; }
.bb-staff-heat-cell { display: block; aspect-ratio: 1 / 1; max-height: 22px; border-radius: 4px; background: var(--bbs-heat-0); animation: bb-staff-fade .5s both; outline: none; transition: transform .12s; }
.bb-staff-heat-cell:hover, .bb-staff-heat-cell:focus-visible { transform: scale(1.18); box-shadow: 0 0 0 2px var(--bbs-surface), 0 0 0 3px var(--bbs-label); }
.bb-staff-heat-cell.is-1 { background: color-mix(in srgb, var(--bbs-series-1) 18%, var(--bbs-surface)); }
.bb-staff-heat-cell.is-2 { background: color-mix(in srgb, var(--bbs-series-1) 36%, var(--bbs-surface)); }
.bb-staff-heat-cell.is-3 { background: color-mix(in srgb, var(--bbs-series-1) 56%, var(--bbs-surface)); }
.bb-staff-heat-cell.is-4 { background: color-mix(in srgb, var(--bbs-series-1) 78%, var(--bbs-surface)); }
.bb-staff-heat-cell.is-5 { background: var(--bbs-series-1); }
.bb-staff-heat-legend { display: flex; align-items: center; gap: 3px; justify-content: flex-end; margin-top: 12px; font-size: 11px; color: var(--bbs-tertiary); }
.bb-staff-heat-legend i { width: 12px; height: 12px; aspect-ratio: auto; animation: none; }
.bb-staff-heat-legend span { margin: 0 4px; }
.bb-staff-topq { list-style: none; margin: 0; padding: 4px 0 8px; }
.bb-staff-topq li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 20px; border-top: 1px solid var(--bbs-separator); font-size: 13.5px; }
.bb-staff-topq li:first-child { border-top: 0; }
.bb-staff-topq-rank { color: var(--bbs-tertiary); font-size: 12px; }
.bb-staff-topq-main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.bb-staff-topq-bar { height: 4px; border-radius: 2px; background: var(--bbs-fill); overflow: hidden; }
.bb-staff-topq-bar > span { display: block; height: 100%; border-radius: 2px; background: var(--bbs-series-1); opacity: .75; transform-origin: left; animation: bb-staff-grow .8s var(--bbs-ease) both; }
.bb-staff-topq-count { font-weight: 500; }

/* ---------------------------------------------------------------- Transcript (chat bubbles, same as widgets) */
.bb-staff-transcript { display: flex; flex-direction: column; gap: 2px; padding: 20px 24px 24px; }
.bb-staff-transcript.is-compact { padding: 14px; }
.bb-staff-day-sep { text-align: center; margin: 10px 0 12px; font-size: 11px; color: var(--bbs-tertiary); font-weight: 500; }
.bb-staff-msg { display: flex; gap: 8px; max-width: 78%; align-items: flex-end; }
.bb-staff-msg.is-start { margin-top: 10px; }
.bb-staff-msg:first-child, .bb-staff-day-sep + .bb-staff-msg { margin-top: 0; }
.bb-staff-msg.is-user { margin-left: auto; flex-direction: row-reverse; }
.bb-staff-msg.is-system { margin: 8px auto; max-width: 90%; }
.bb-staff-msg.is-new { animation: bb-staff-msgin .22s var(--bbs-ease); }
@keyframes bb-staff-msgin { from { opacity: 0; transform: translateY(6px); } }
.bb-staff-msg-avatar { width: 26px; flex: none; align-self: flex-end; margin-bottom: 18px; }
.bb-staff-msg:not(.is-end) .bb-staff-msg-avatar { margin-bottom: 0; }
.bb-staff-msg-col { min-width: 0; display: flex; flex-direction: column; }
.bb-staff-msg.is-user .bb-staff-msg-col { align-items: flex-end; }
.bb-staff-msg-bubble { padding: 9px 13px; border-radius: 18px; font-size: 15px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.bb-staff-transcript.is-compact .bb-staff-msg-bubble { font-size: 13.5px; padding: 7px 11px; }
.bb-staff-msg.is-user .bb-staff-msg-bubble { background: var(--bbs-accent); color: #fff; }
.bb-staff-msg.is-user.is-end .bb-staff-msg-bubble { border-bottom-right-radius: 6px; }
.bb-staff-msg.is-assistant .bb-staff-msg-bubble { background: var(--bbs-bot-bubble); color: var(--bbs-label); }
.bb-staff-msg.is-assistant.is-end .bb-staff-msg-bubble { border-bottom-left-radius: 6px; }
.bb-staff-msg.is-system .bb-staff-msg-bubble { background: transparent; color: var(--bbs-tertiary); font-size: 12px; }
.bb-staff-msg-bubble.is-hit { box-shadow: 0 0 0 2px var(--bbs-surface-2), 0 0 0 3.5px color-mix(in srgb, var(--bbs-warning) 80%, transparent); }
.bb-staff-msg-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; font-size: 11px; color: var(--bbs-tertiary); }
.bb-staff-conv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px 20px; border-bottom: 1px solid var(--bbs-separator); background: var(--bbs-surface-2); }
.bb-staff-conv-title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; display: block; }
.bb-staff-conv-chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.bb-staff-bot-avatar { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #2F7CF6 0%, #5E5CE6 100%); }

/* ---------------------------------------------------------------- Settings */
.bb-staff-settings { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 24px; align-items: start; }
.bb-staff-settings-nav { display: flex; flex-direction: column; gap: 1px; position: sticky; top: calc(var(--bbs-top) + 80px); }
.bb-staff-settings-nav a { display: flex; align-items: center; gap: 10px; padding: 0 10px; height: 34px; border-radius: 8px; color: var(--bbs-label) !important; font-size: 13.5px; text-decoration: none !important; }
.bb-staff-settings-nav a svg { color: var(--bbs-accent); flex: none; }
.bb-staff-settings-nav a:hover { background: var(--bbs-fill); }
.bb-staff-settings-nav a[aria-current="page"] { background: var(--bbs-fill-strong); font-weight: 500; }
.bb-staff-savebar { position: sticky; bottom: 16px; z-index: 20; margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 10px 10px 18px; border-radius: 14px; background: var(--bbs-material); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); box-shadow: var(--bbs-shadow-pop); animation: bb-staff-sheet .32s var(--bbs-ease); flex-wrap: wrap; font-size: 13.5px; }
.bb-staff-widget-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 20px; align-items: start; }
.bb-staff-preview-sticky { position: sticky; top: calc(var(--bbs-top) + 80px); }
.bb-staff-list-editor { display: flex; flex-direction: column; gap: 8px; }
.bb-staff-list-editor-row { display: flex; gap: 6px; }
.bb-staff-threshold { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; background: var(--bbs-surface-2); border: 1px solid var(--bbs-separator); }
.bb-staff-threshold-scale { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--bbs-secondary); }
.bb-staff-threshold-value { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

/* Widget preview (mirrors the Brainbox chat widget, design v2) */
.bb-staff-wp-stage { border-radius: 14px; padding: 20px; background: var(--bbs-bg); border: 1px solid var(--bbs-separator); display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
.bb-staff-wp { width: 100%; max-width: 340px; border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; font-size: 13px; line-height: 1.45; box-shadow: var(--bbs-shadow-window); }
.bb-staff-wp-head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; border-bottom: 1px solid rgba(60,60,67,.12); background: rgba(255,255,255,.72); }
.bb-staff-wp-logo { width: 32px; height: 32px; border-radius: 9px; object-fit: cover; }
.bb-staff-wp-title { font-weight: 600; font-size: 14px; }
.bb-staff-wp-sub { font-size: 11.5px; opacity: .6; display: flex; align-items: center; gap: 5px; }
.bb-staff-wp-sub i { width: 6px; height: 6px; border-radius: 50%; background: #34C759; flex: none; }
.bb-staff-wp-actions { opacity: .45; display: inline-flex; gap: 8px; }
.bb-staff-wp-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 2px; min-height: 250px; }
.bb-staff-wp-day { text-align: center; font-size: 10.5px; opacity: .45; margin: 2px 0 8px; }
.bb-staff-wp-row { display: flex; align-items: flex-end; gap: 6px; }
.bb-staff-wp-av { width: 22px; flex: none; }
.bb-staff-wp-bubble { background: #F2F2F7; color: #1D1D1F; border-radius: 16px; padding: 7px 11px; max-width: 82%; }
.bb-staff-wp-row.is-end .bb-staff-wp-bubble { border-bottom-left-radius: 6px; }
.bb-staff-wp-user { margin-left: auto; margin-top: auto; color: #fff; border-radius: 16px 16px 6px 16px; padding: 7px 11px; max-width: 80%; }
.bb-staff-wp-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px 28px; }
.bb-staff-wp-pill { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 999px; background: rgba(120,120,128,.1); font-size: 12px; font-weight: 500; }
.bb-staff-wp-composer { margin: 0 10px 10px; display: flex; align-items: center; gap: 8px; padding: 5px 5px 5px 14px; border-radius: 20px; background: rgba(120,120,128,.1); }
.bb-staff-wp-composer > span:first-child { flex: 1; opacity: .45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-wp-send { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; flex: none; }
.bb-staff-wp-send-icon { transform: rotate(-90deg); }
.bb-staff-wp-launcher { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px 0 15px; border-radius: 999px; color: #fff; font-weight: 500; font-size: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.14); }
.bb-staff-wp-launcher.is-icon { width: 56px; height: 56px; padding: 0; justify-content: center; background: linear-gradient(135deg, #2F7CF6 0%, #5E5CE6 100%); }

/* API keys / access */
.bb-staff-key-type { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; height: 22px; padding: 0 8px; border-radius: 6px; white-space: nowrap; }
.bb-staff-key-type.is-publishable { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-key-type.is-secret { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-key-type.is-token { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-key-type.is-admin { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-radio-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.bb-staff-radio-card { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--bbs-separator-strong); border-radius: 12px; cursor: pointer; transition: border-color .12s, box-shadow .12s, background .12s; }
.bb-staff-radio-card input { position: absolute; opacity: 0; pointer-events: none; }
.bb-staff-radio-card b { font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 7px; }
.bb-staff-radio-card b svg { color: var(--bbs-accent); }
.bb-staff-radio-card span { font-size: 12.5px; color: var(--bbs-secondary); line-height: 1.4; }
.bb-staff-radio-card:hover { border-color: var(--bbs-tertiary); }
.bb-staff-radio-card.is-checked { border-color: var(--bbs-accent); background: var(--bbs-accent-tint); box-shadow: 0 0 0 1px var(--bbs-accent); }
.bb-staff-radio-card:focus-within { box-shadow: var(--bbs-ring); }
.bb-staff-radio-cards.is-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bb-staff-pa-badge { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 500; color: #fff; background: linear-gradient(135deg, #2F7CF6 0%, #5E5CE6 100%); white-space: nowrap; flex: none; }
.bb-staff-key-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.bb-staff-key-legend-row { padding: 12px 14px; border: 1px solid var(--bbs-separator); border-radius: 12px; background: var(--bbs-surface-2); min-width: 0; }
.bb-staff-key-legend-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.bb-staff-key-legend-row p { margin-top: 7px; font-size: 12.5px; line-height: 1.45; color: var(--bbs-secondary); }
.bb-staff-pw-gen { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bb-staff-pw-gen > div:first-child { flex: 1 1 220px; }
.bb-staff-id-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; min-width: 0; }
.bb-staff-id-chip code { font-family: var(--bbs-mono); font-size: 12px; color: var(--bbs-secondary); background: var(--bbs-fill); padding: 2px 6px; border-radius: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.bb-staff-mini-stats { display: flex; gap: 6px; flex-wrap: wrap; }
.bb-staff-mini-stats > span { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; height: 22px; padding: 0 7px; border-radius: 6px; background: var(--bbs-fill); color: var(--bbs-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.bb-staff-mini-stats > span.is-pk { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-mini-stats > span.is-sk { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-mini-stats > span.is-zero { opacity: .55; }
.bb-staff-force-pw { max-width: 440px; }
/* Show-once secrets: clearly marked */
.bb-staff-modal .bb-staff-alert-warn:has(+ .bb-staff-field), .bb-staff-stack > .bb-staff-alert-warn:first-child { box-shadow: inset 3px 0 0 var(--bbs-warning); }

/* ---------------------------------------------------------------- Auth */
.bb-staff-auth { position: relative; display: grid; place-items: center; min-height: calc(100vh - var(--bbs-top)); width: 100%; overflow: hidden; padding: 40px 16px; background: radial-gradient(1200px 600px at 10% -10%, rgba(47,124,246,.14), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(94,92,230,.14), transparent 60%), var(--bbs-bg); }
.bb-staff-auth-bg { position: absolute; inset: 0; pointer-events: none; }
.bb-staff-auth-bg span { position: absolute; border-radius: 50%; filter: blur(48px); opacity: .5; }
.bb-staff-auth-bg .is-a { width: 380px; height: 380px; left: 6%; top: 8%; background: rgba(47,124,246,.35); animation: bb-staff-float 18s ease-in-out infinite; }
.bb-staff-auth-bg .is-b { width: 300px; height: 300px; right: 8%; top: 22%; background: rgba(94,92,230,.3); animation: bb-staff-float 22s ease-in-out infinite reverse; }
.bb-staff-auth-bg .is-c { width: 260px; height: 260px; left: 38%; bottom: 4%; background: rgba(48,176,199,.22); animation: bb-staff-float 26s ease-in-out infinite; }
.bb-staff.is-dark .bb-staff-auth-bg span { opacity: .35; }
@keyframes bb-staff-float { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, -30px) scale(1.08); } 66% { transform: translate(-30px, 24px) scale(.94); } }
.bb-staff-auth-center { position: relative; width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; gap: 20px; animation: bb-staff-sheet .5s var(--bbs-ease); }
.bb-staff-auth-brandrow { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.bb-staff-auth-brandname { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.bb-staff-auth-tag { font-size: 12px; color: var(--bbs-secondary); margin-top: -6px; }
.bb-staff-auth-card { width: 100%; background: var(--bbs-surface); border-radius: 18px; border: 1px solid var(--bbs-separator); padding: 28px; }
.bb-staff-auth-form { width: 100%; display: flex; flex-direction: column; gap: 16px; }
.bb-staff-auth-form h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; text-align: center; }
.bb-staff-auth-form .bb-staff-auth-lead { color: var(--bbs-secondary); font-size: 14px; margin-top: 6px; text-align: center; }
.bb-staff-auth-form .bb-staff-input { height: 40px; }
.bb-staff-auth-foot { font-size: 12.5px; color: var(--bbs-tertiary); text-align: center; }
.bb-staff-auth-features { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; font-size: 12.5px; color: var(--bbs-secondary); }
.bb-staff-auth-features li { display: inline-flex; align-items: center; gap: 6px; }
.bb-staff-auth-features svg { color: var(--bbs-accent); }
.bb-staff-auth-legal { font-size: 11.5px; color: var(--bbs-tertiary); display: inline-flex; align-items: center; gap: 5px; text-align: center; }
.bb-staff-pw-meter { display: flex; gap: 4px; margin-top: 2px; }
.bb-staff-pw-meter span { flex: 1; height: 4px; border-radius: 4px; background: var(--bbs-fill-strong); transition: background .2s; }
.bb-staff-pw-meter span.is-on { background: var(--bbs-success); }
.bb-staff-center-screen { min-height: calc(100vh - var(--bbs-top)); width: 100%; display: grid; place-items: center; }
.bb-staff-loader { display: grid; place-items: center; animation: bb-staff-breathe 1.4s ease-in-out infinite; }
@keyframes bb-staff-breathe { 50% { transform: scale(.92); opacity: .7; } }

/* Account */
.bb-staff-profile-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.bb-staff-profile-name { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }

/* ---------------------------------------------------------------- Embedded TrainingPanel */
.bb-staff .bb-train-root { font-family: var(--bbs-font); }

/* ---------------------------------------------------------------- Responsive */
@media (max-width: 1280px) {
  .bb-staff-widget-layout { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (max-width: 1100px) {
  .bb-staff-grid-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bb-staff-grid-2-1, .bb-staff-grid-1-2 { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-gap-row { grid-template-columns: minmax(0, 1fr) 150px 64px 96px; }
  .bb-staff-gap-row > .bb-staff-col-who { display: none; }
  .bb-staff-widget-layout { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-preview-sticky { position: static; }
  .bb-staff-conn-label { display: none; }
  .bb-staff-conn { padding: 0 9px; height: 24px; }
}
@media (max-width: 900px) {
  .bb-staff { --bbs-side-w: 280px; }
  .bb-staff.is-collapsed { --bbs-side-w: 280px; }
  .bb-staff-side { position: fixed; left: 0; top: var(--bbs-top); bottom: 0; height: auto; transform: translateX(-102%); transition: transform .36s var(--bbs-ease); z-index: 1100; background: var(--bbs-surface); }
  .bb-staff.is-drawer-open .bb-staff-side { transform: none; box-shadow: var(--bbs-shadow-window); }
  .bb-staff.is-collapsed .bb-staff-brand { flex-direction: row; padding: 16px 12px 10px 16px; }
  .bb-staff.is-collapsed .bb-staff-brand-text, .bb-staff.is-collapsed .bb-staff-nav-label, .bb-staff.is-collapsed .bb-staff-nav-section span, .bb-staff.is-collapsed .bb-staff-side-user-text, .bb-staff.is-collapsed .bb-staff-side-search .bb-staff-kbd { display: revert; }
  .bb-staff.is-collapsed .bb-staff-nav-item { justify-content: flex-start; padding: 0 8px; }
  .bb-staff.is-collapsed .bb-staff-nav-badge { position: static; }
  .bb-staff.is-collapsed .bb-staff-side-search { justify-content: flex-start; padding: 0 8px 0 10px; margin: 2px 12px 8px; }
  .bb-staff-nav-item { height: 40px; font-size: 15px; }
  .bb-staff-collapse { display: none !important; }
  .bb-staff.has-side::before { display: none; }
  .bb-staff-scrim { display: block; position: fixed; inset: 0; top: var(--bbs-top); background: rgba(0,0,0,.28); z-index: 1050; opacity: 0; pointer-events: none; transition: opacity .28s; }
  .bb-staff.is-drawer-open .bb-staff-scrim { opacity: 1; pointer-events: auto; }
  .bb-staff-top .bb-staff-menu-btn { display: inline-grid; margin-left: -6px; }
  .bb-staff-top { padding: 0 12px 0 16px; gap: 6px; }
  .bb-staff-content { padding: 20px 16px 32px; }
  .bb-staff-top-search { display: none; }
  .bb-staff-settings { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-settings-nav { position: static; flex-direction: row; overflow-x: auto; gap: 4px; scrollbar-width: none; padding-bottom: 2px; }
  .bb-staff-settings-nav a { white-space: nowrap; }
  .bb-staff-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bb-staff-strip-item:nth-child(3) { border-left: 0; }
  .bb-staff-strip-item:nth-child(n+3) { border-top: 1px solid var(--bbs-separator); }
  .bb-staff-strip-item { border-radius: 0 !important; }
}
@media (max-width: 760px) {
  .bb-staff-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-form-grid { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-kv { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-page-head h2 { font-size: 22px; }
  .bb-staff-today { display: flex; margin: 6px 0 0; padding: 0; border: 0; }
  .bb-staff-gap-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; padding: 12px 16px; }
  .bb-staff-gap-row.is-head { display: none; }
  .bb-staff-gap-row > .bb-staff-col-reason { grid-column: 1 / 2; grid-row: 2; }
  .bb-staff-gap-row > .bb-staff-col-occ { grid-column: 2; grid-row: 1; align-self: start; }
  .bb-staff-gap-row > .bb-staff-col-seen { grid-column: 2; grid-row: 2; }
  .bb-staff-table.is-responsive thead { display: none; }
  .bb-staff-table.is-responsive, .bb-staff-table.is-responsive tbody, .bb-staff-table.is-responsive tr, .bb-staff-table.is-responsive td { display: block; width: 100%; }
  .bb-staff-table.is-responsive tr { padding: 12px 16px; border-bottom: 1px solid var(--bbs-separator); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 12px; }
  .bb-staff-table.is-responsive tr:last-child { border-bottom: 0; }
  .bb-staff-table.is-responsive td { padding: 0; border: 0; text-align: left !important; min-width: 0; }
  .bb-staff-table.is-responsive td.is-primary, .bb-staff-table.is-responsive td.is-actions { grid-column: 1 / -1; }
  .bb-staff-table.is-responsive td.is-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-start; }
  .bb-staff-table.is-responsive .bb-staff-cell-label { display: block; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--bbs-tertiary); margin-bottom: 3px; }
  .bb-staff-msg { max-width: 90%; }
  .bb-staff-transcript { padding: 16px; }
  .bb-staff-radio-cards, .bb-staff-radio-cards.is-roles { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-drawer-body { padding: 18px 16px; }
  .bb-staff-drawer-head, .bb-staff-drawer-foot { padding-left: 16px; padding-right: 16px; }
  .bb-staff-card-head { padding: 16px 16px 0; }
  .bb-staff-card-body { padding: 14px 16px 16px; }
  .bb-staff-list > li { padding: 11px 16px; }
  .bb-staff-topq li { padding: 9px 16px; }
  .bb-staff-toolbar { padding: 12px; }
  .bb-staff-toolbar .bb-staff-search { max-width: none; margin-left: 0; flex-basis: 100%; }
  .bb-staff-toolbar-count { margin-left: 0; }
  .bb-staff-filters { padding: 12px; }
  .bb-staff-filters .bb-staff-search { max-width: none; }
  .bb-staff-heat-row { grid-template-columns: 28px repeat(24, minmax(0, 1fr)); gap: 2px; }
  .bb-staff-heat { gap: 2px; }
  .bb-staff-heat-cell { border-radius: 2px; }
  /* Sheets slide up from the bottom on phones. */
  .bb-staff-modal-wrap { place-items: end center; padding: 0; }
  .bb-staff-modal { width: 100% !important; border-radius: 14px 14px 0 0; animation: bb-staff-sheetup .38s var(--bbs-ease); max-height: 92vh; overflow-y: auto; padding-bottom: env(safe-area-inset-bottom); }
  @keyframes bb-staff-sheetup { from { transform: translateY(40%); opacity: 0; } }
  .bb-staff-toasts { left: 8px; right: 8px; top: calc(var(--bbs-top) + 8px); width: auto; }
}
@media (max-width: 520px) {
  .bb-staff-grid-kpi { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .bb-staff-kpi { padding: 14px 16px; }
  .bb-staff-kpi-value { font-size: 28px; }
  .bb-staff-top h1 { font-size: 15px; }
  .bb-staff-crumbs { display: none; }
  .bb-staff-palette-btn { display: none; }
  .bb-staff-notif-pop { position: fixed; left: 8px; right: 8px; top: calc(var(--bbs-top) + 60px); width: auto; transform-origin: top center; }
  .bb-staff-user-pop { position: fixed; left: auto; right: 8px; top: calc(var(--bbs-top) + 60px); width: min(280px, calc(100vw - 16px)); }
  .bb-staff-modal-head, .bb-staff-modal-body, .bb-staff-modal-foot { padding-left: 16px; padding-right: 16px; }
  .bb-staff-list > li { flex-wrap: wrap; }
  .bb-staff-list > li > .bb-staff-btn { margin-left: 38px; }
  .bb-staff-list-side { flex-direction: row; }
  .bb-staff-auth-card { padding: 22px 18px; }
  .bb-staff-palette-wrap { padding-top: 8px; }
  .bb-staff-palette-foot { display: none; }
  .bb-staff-heat-hour { font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .bb-staff *, .bb-staff *::before, .bb-staff *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 80ms !important; }
  .bb-staff-auth-bg span { animation: none !important; }
}
/* ---------------------------------------------------------------- Messages page */
.bb-staff-aud-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; }
.bb-staff-aud-card { appearance: none; text-align: left; font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: var(--bbs-radius); border: 1px solid var(--bbs-separator); background: var(--bbs-surface); color: var(--bbs-label); transition: border-color 160ms ease, background-color 160ms ease, transform 120ms ease; }
.bb-staff-aud-card:hover { border-color: var(--bbs-separator-strong, var(--bbs-separator)); background: var(--bbs-fill); }
.bb-staff-aud-card:active { transform: scale(.985); }
.bb-staff-aud-card:focus-visible { outline: 2px solid var(--bbs-accent); outline-offset: 2px; }
.bb-staff-aud-card b { font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
.bb-staff-aud-card .bb-staff-muted { font-size: 12px; line-height: 1.35; }
.bb-staff-aud-card-top { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--bbs-secondary); }
.bb-staff-aud-card.is-active { border-color: var(--bbs-accent); background: var(--bbs-accent-tint); }
.bb-staff-aud-card.is-teal .bb-staff-aud-card-top { color: var(--bbs-teal-text); }
.bb-staff-aud-card.is-indigo .bb-staff-aud-card-top { color: var(--bbs-indigo); }
.bb-staff-aud-card.is-accent .bb-staff-aud-card-top { color: var(--bbs-accent); }
.bb-staff-aud-card.is-danger .bb-staff-aud-card-top { color: var(--bbs-danger-text); }
.bb-staff-aud-card.is-warn .bb-staff-aud-card-top { color: var(--bbs-warning-text); }
.bb-staff-aud-pill { appearance: none; font: inherit; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; border: 1px solid transparent; font-size: 12px; font-weight: 600; background: var(--bbs-fill); color: var(--bbs-secondary); }
.bb-staff-aud-pill.is-teal { background: var(--bbs-teal-tint); color: var(--bbs-teal-text); }
.bb-staff-aud-pill.is-indigo { background: var(--bbs-indigo-tint); color: var(--bbs-indigo); }
.bb-staff-aud-pill.is-accent { background: var(--bbs-accent-tint); color: var(--bbs-accent); }
.bb-staff-aud-pill.is-danger { background: var(--bbs-danger-tint); color: var(--bbs-danger-text); }
.bb-staff-aud-pill.is-muted { opacity: .7; border-style: dashed; border-color: currentColor; }
button.bb-staff-aud-pill { cursor: pointer; }
button.bb-staff-aud-pill.is-on { border-color: currentColor; box-shadow: inset 0 0 0 1px currentColor; }
.bb-staff-kb-job { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.bb-staff-kb-job-head { display: flex; align-items: center; gap: 12px; }
.bb-staff-kb-job-head .bb-staff-tile { width: 32px; height: 32px; }
.bb-staff-progress { height: 6px; border-radius: 999px; background: var(--bbs-fill); overflow: hidden; }
.bb-staff-progress span { display: block; height: 100%; border-radius: inherit; background: var(--bbs-accent); transition: width 400ms ease; }
.bb-staff-kb-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.bb-staff-kb-bulk { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid var(--bbs-separator); background: var(--bbs-accent-tint); }
.bb-staff-kb-bulk select { width: auto; max-width: 100%; }
.bb-staff-kb-list { display: flex; flex-direction: column; }
.bb-staff-kb-selectall { padding: 10px 16px; border-bottom: 1px solid var(--bbs-separator); font-size: 12.5px; color: var(--bbs-secondary); }
.bb-staff-kb-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 200px; gap: 12px; align-items: start; padding: 14px 16px; border-bottom: 1px solid var(--bbs-separator); transition: background-color 160ms ease; }
.bb-staff-kb-row:last-child { border-bottom: 0; }
.bb-staff-kb-row:hover { background: var(--bbs-fill); }
.bb-staff-kb-row.is-selected { background: var(--bbs-accent-tint); }
.bb-staff-kb-check { width: 16px; height: 16px; margin-top: 3px; accent-color: var(--bbs-accent); }
.bb-staff-kb-main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.bb-staff-kb-text { appearance: none; border: 0; background: none; padding: 0; text-align: left; font: inherit; font-size: 13.5px; line-height: 1.5; color: var(--bbs-label); cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.bb-staff-kb-text:hover { color: var(--bbs-accent); }
.bb-staff-kb-text:focus-visible { outline: 2px solid var(--bbs-accent); outline-offset: 2px; border-radius: 4px; }
.bb-staff-kb-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 12px; }
.bb-staff-kb-source { display: inline-flex; align-items: center; gap: 4px; color: var(--bbs-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-kb-origin { display: inline-flex; align-items: center; gap: 4px; color: var(--bbs-secondary); min-width: 0; }
.bb-staff-kb-origin.is-auto { color: var(--bbs-accent); }
.bb-staff-kb-origin.is-warn { color: var(--bbs-warning-text); }
.bb-staff-kb-aud { display: flex; flex-direction: column; gap: 4px; align-items: stretch; }
.bb-staff-kb-who { font-size: 11.5px; color: var(--bbs-tertiary, var(--bbs-secondary)); line-height: 1.3; }
.bb-staff-aud-select { font-weight: 600; }
.bb-staff-aud-select.is-teal { color: var(--bbs-teal-text); }
.bb-staff-aud-select.is-indigo { color: var(--bbs-indigo); }
.bb-staff-aud-select.is-accent { color: var(--bbs-accent); }
.bb-staff-aud-select.is-danger { color: var(--bbs-danger-text); }
.bb-staff-kb-full { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13.5px; line-height: 1.6; max-height: 55vh; overflow-y: auto; padding: 12px 14px; border-radius: 10px; background: var(--bbs-fill); border: 1px solid var(--bbs-separator); }
.bb-staff-kb-modal-foot { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.bb-staff-kb-aud-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.bb-staff-msglist { display: flex; flex-direction: column; }
.bb-staff-msgrow { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--bbs-separator); }
.bb-staff-msgrow:last-child { border-bottom: 0; }
.bb-staff-msgrow.is-ai { background: color-mix(in srgb, var(--bbs-fill) 55%, transparent); }
.bb-staff-msgrow-av { display: grid; place-items: center; width: 32px; height: 32px; }
.bb-staff-msgrow-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.bb-staff-msgrow-head { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; }
.bb-staff-msgrow-time { margin-left: auto; font-size: 12px; white-space: nowrap; }
.bb-staff-msgrow-text { font-size: 13.5px; line-height: 1.5; color: var(--bbs-label); white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.bb-staff-msgrow-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; width: fit-content; }
@media (max-width: 720px) {
  .bb-staff-kb-row { grid-template-columns: auto minmax(0, 1fr); }
  .bb-staff-kb-aud { grid-column: 2; }
  .bb-staff-aud-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bb-staff-msgrow-head { flex-wrap: wrap; }
  .bb-staff-msgrow-time { margin-left: 0; }
}

.bb-staff-share { display: inline-flex; gap: 6px; flex-wrap: wrap; }
a.bb-staff-btn { text-decoration: none; }
`;

export function useStaffStyles(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = staffCss;
      document.head.appendChild(style);
    }
  }, []);
}
