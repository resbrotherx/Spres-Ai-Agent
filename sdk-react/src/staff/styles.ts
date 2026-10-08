import { useEffect } from 'react';

const STYLE_ID = 'bb-staff-styles';
const FONT_ID = 'bb-staff-font';

export const staffCss = `
.bb-staff {
  --bbs-primary: #1d4ed8;
  --bbs-primary-hover: #1e40af;
  --bbs-accent: #0ea5e9;
  --bbs-soft: #eff6ff;
  --bbs-soft-2: #dbeafe;
  --bbs-surface: #f8fafc;
  --bbs-card: #ffffff;
  --bbs-side-from: #0b1f44;
  --bbs-side-to: #0f2a5f;
  --bbs-text: #0f172a;
  --bbs-text-2: #334155;
  --bbs-muted: #64748b;
  --bbs-faint: #94a3b8;
  --bbs-border: #e2e8f0;
  --bbs-border-2: #cbd5e1;
  --bbs-success: #16a34a;
  --bbs-success-soft: #dcfce7;
  --bbs-warning: #d97706;
  --bbs-warning-soft: #fef3c7;
  --bbs-danger: #dc2626;
  --bbs-danger-soft: #fee2e2;
  --bbs-series-2: #ea580c;
  --bbs-radius: 14px;
  --bbs-radius-sm: 10px;
  --bbs-shadow-sm: 0 1px 2px rgba(15,23,42,.05);
  --bbs-shadow: 0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.05);
  --bbs-shadow-lg: 0 12px 40px rgba(15,23,42,.16), 0 2px 6px rgba(15,23,42,.06);
  --bbs-ring: 0 0 0 3px rgba(29,78,216,.22);
  --bbs-font: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --bbs-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --bbs-top: 0px;
  --bbs-side-w: 252px;
  font-family: var(--bbs-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--bbs-text);
  background: var(--bbs-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: "cv11", "ss01";
  min-height: calc(100vh - var(--bbs-top));
  display: flex;
  align-items: stretch;
  position: relative;
  text-align: left;
}
.bb-staff *, .bb-staff *::before, .bb-staff *::after { box-sizing: border-box; }
/* Keeps the navy column continuous below the sticky sidebar on tall pages. */
.bb-staff.has-side::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: var(--bbs-side-w); background: var(--bbs-side-to); transition: width .2s ease; pointer-events: none; }
.bb-staff button, .bb-staff input, .bb-staff select, .bb-staff textarea { font: inherit; color: inherit; }
.bb-staff a { color: var(--bbs-primary); text-decoration: none; }
.bb-staff a:hover { text-decoration: underline; text-underline-offset: 2px; }
.bb-staff h1, .bb-staff h2, .bb-staff h3, .bb-staff h4, .bb-staff p { margin: 0; }
.bb-staff :focus-visible { outline: 2px solid var(--bbs-primary); outline-offset: 2px; border-radius: 6px; }
.bb-staff-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.bb-staff-num { font-variant-numeric: tabular-nums; }
.bb-staff-muted { color: var(--bbs-muted); }
.bb-staff-mono { font-family: var(--bbs-mono); font-size: 12.5px; }
.bb-staff-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.bb-staff-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ---------------------------------------------------------------- Sidebar */
.bb-staff-side {
  width: var(--bbs-side-w); flex: none; position: sticky; top: var(--bbs-top); height: calc(100vh - var(--bbs-top));
  display: flex; flex-direction: column; color: #cbd5e1; z-index: 40;
  background: radial-gradient(120% 60% at 0% 0%, rgba(14,165,233,.18), transparent 60%), linear-gradient(180deg, var(--bbs-side-from), var(--bbs-side-to));
  border-right: 1px solid rgba(255,255,255,.06);
  transition: width .2s ease;
}
.bb-staff.is-collapsed { --bbs-side-w: 76px; }
.bb-staff-brand { display: flex; align-items: center; gap: 11px; padding: 18px 18px 14px; min-height: 68px; }
.bb-staff-logo {
  width: 36px; height: 36px; border-radius: 11px; flex: none; display: grid; place-items: center; color: #fff; overflow: hidden;
  background: linear-gradient(135deg, var(--bbs-accent), var(--bbs-primary)); box-shadow: 0 6px 18px rgba(14,165,233,.35), inset 0 1px 0 rgba(255,255,255,.25);
}
.bb-staff-logo img { width: 100%; height: 100%; object-fit: cover; }
.bb-staff-brand-text { min-width: 0; line-height: 1.2; }
.bb-staff-brand-name { color: #fff; font-weight: 700; font-size: 15px; letter-spacing: -.01em; }
.bb-staff-brand-sub { color: #7dd3fc; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; margin-top: 2px; }
.bb-staff.is-collapsed .bb-staff-brand { padding: 18px 20px 14px; }
.bb-staff.is-collapsed .bb-staff-brand-text, .bb-staff.is-collapsed .bb-staff-nav-label, .bb-staff.is-collapsed .bb-staff-nav-section,
.bb-staff.is-collapsed .bb-staff-side-user-text, .bb-staff.is-collapsed .bb-staff-collapse-label { display: none; }
.bb-staff-nav { flex: 1; overflow-y: auto; padding: 6px 12px; display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent; }
.bb-staff-nav-section { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #64748b; padding: 14px 10px 6px; }
.bb-staff-nav-item {
  position: relative; display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; color: #cbd5e1 !important;
  font-weight: 550; font-size: 13.5px; text-decoration: none !important; transition: background .15s, color .15s; min-height: 40px;
}
.bb-staff-nav-item svg { flex: none; color: #94a3b8; transition: color .15s; }
.bb-staff-nav-item:hover { background: rgba(255,255,255,.06); color: #fff !important; }
.bb-staff-nav-item:hover svg { color: #e2e8f0; }
.bb-staff-nav-item[aria-current="page"] { background: linear-gradient(90deg, rgba(29,78,216,.55), rgba(29,78,216,.25)); color: #fff !important; box-shadow: inset 0 0 0 1px rgba(147,197,253,.18); }
.bb-staff-nav-item[aria-current="page"]::before { content: ""; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--bbs-accent); }
.bb-staff-nav-item[aria-current="page"] svg { color: #7dd3fc; }
.bb-staff-nav-item:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 1px; }
.bb-staff-nav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-nav-badge { min-width: 22px; height: 20px; padding: 0 7px; border-radius: 99px; background: rgba(14,165,233,.2); color: #bae6fd; font-size: 11.5px; font-weight: 700; display: inline-grid; place-items: center; font-variant-numeric: tabular-nums; }
.bb-staff-nav-badge.is-alert { background: #f97316; color: #fff; }
.bb-staff.is-collapsed .bb-staff-nav-item { justify-content: center; padding: 9px 0; }
.bb-staff.is-collapsed .bb-staff-nav-badge { position: absolute; top: 3px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; }
.bb-staff-side-foot { padding: 12px; border-top: 1px solid rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 8px; }
.bb-staff-side-user { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 12px; background: rgba(255,255,255,.04); min-width: 0; }
.bb-staff-side-user-text { min-width: 0; line-height: 1.25; }
.bb-staff-side-user-name { color: #fff; font-weight: 600; font-size: 13px; }
.bb-staff-side-user-role { color: #94a3b8; font-size: 11.5px; text-transform: capitalize; }
.bb-staff-collapse { appearance: none; border: 0; background: transparent; color: #94a3b8; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer; font-size: 12.5px; font-weight: 550; }
.bb-staff-collapse:hover { background: rgba(255,255,255,.06); color: #fff; }
.bb-staff.is-collapsed .bb-staff-collapse { justify-content: center; }
.bb-staff.is-collapsed .bb-staff-collapse svg { transform: rotate(180deg); }
.bb-staff.is-collapsed .bb-staff-side-user { justify-content: center; padding: 6px 0; background: transparent; }
.bb-staff-scrim { display: none; }

/* ---------------------------------------------------------------- Main / topbar */
.bb-staff-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bb-staff-top {
  position: sticky; top: var(--bbs-top); z-index: 30; height: 64px; display: flex; align-items: center; gap: 12px; padding: 0 28px;
  background: rgba(255,255,255,.88); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--bbs-border);
}
.bb-staff-top-title { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.bb-staff-crumbs { font-size: 12px; color: var(--bbs-muted); display: flex; gap: 6px; align-items: center; white-space: nowrap; overflow: hidden; }
.bb-staff-crumbs a { color: var(--bbs-muted); }
.bb-staff-top h1 { font-size: 17px; font-weight: 650; letter-spacing: -.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-staff-top .bb-staff-menu-btn { display: none; }
.bb-staff-top-search { position: relative; width: 300px; max-width: 34vw; }
.bb-staff-top-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--bbs-faint); pointer-events: none; }
.bb-staff-top-search input { width: 100%; height: 38px; padding: 0 12px 0 36px; border-radius: 10px; border: 1px solid var(--bbs-border); background: var(--bbs-surface); outline: none; font-size: 13.5px; transition: border-color .15s, box-shadow .15s, background .15s; }
.bb-staff-top-search input:focus { border-color: var(--bbs-primary); background: #fff; box-shadow: var(--bbs-ring); }
.bb-staff-top-actions { display: flex; align-items: center; gap: 6px; }
.bb-staff-content { flex: 1; padding: 28px; width: 100%; max-width: 1360px; margin: 0 auto; min-width: 0; }
.bb-staff-page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.bb-staff-page-head h2 { font-size: 24px; font-weight: 700; letter-spacing: -.025em; line-height: 1.2; }
.bb-staff-page-head p { color: var(--bbs-muted); margin-top: 4px; font-size: 14px; }
.bb-staff-stack { display: flex; flex-direction: column; gap: 20px; }

/* ---------------------------------------------------------------- Buttons */
.bb-staff-btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 15px; border-radius: 10px;
  font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid transparent; white-space: nowrap; line-height: 1;
  transition: background .15s, border-color .15s, box-shadow .15s, color .15s, transform .05s; text-decoration: none !important;
}
.bb-staff-btn:active:not(:disabled) { transform: translateY(1px); }
.bb-staff-btn:disabled { opacity: .55; cursor: not-allowed; }
.bb-staff-btn-primary { background: var(--bbs-primary); color: #fff !important; box-shadow: 0 1px 2px rgba(29,78,216,.25), inset 0 1px 0 rgba(255,255,255,.12); }
.bb-staff-btn-primary:hover:not(:disabled) { background: var(--bbs-primary-hover); }
.bb-staff-btn-secondary { background: #fff; color: var(--bbs-text) !important; border-color: var(--bbs-border); box-shadow: var(--bbs-shadow-sm); }
.bb-staff-btn-secondary:hover:not(:disabled) { background: var(--bbs-surface); border-color: var(--bbs-border-2); }
.bb-staff-btn-soft { background: var(--bbs-soft); color: var(--bbs-primary) !important; }
.bb-staff-btn-soft:hover:not(:disabled) { background: var(--bbs-soft-2); }
.bb-staff-btn-ghost { background: transparent; color: var(--bbs-text-2) !important; }
.bb-staff-btn-ghost:hover:not(:disabled) { background: #f1f5f9; }
.bb-staff-btn-danger { background: var(--bbs-danger); color: #fff !important; }
.bb-staff-btn-danger:hover:not(:disabled) { background: #b91c1c; }
.bb-staff-btn-danger-ghost { background: transparent; color: var(--bbs-danger) !important; }
.bb-staff-btn-danger-ghost:hover:not(:disabled) { background: var(--bbs-danger-soft); }
.bb-staff-btn-sm { height: 32px; padding: 0 11px; font-size: 12.5px; border-radius: 8px; gap: 6px; }
.bb-staff-btn-lg { height: 44px; padding: 0 20px; font-size: 14.5px; border-radius: 11px; }
.bb-staff-btn-block { width: 100%; }
.bb-staff-icon-btn {
  appearance: none; position: relative; width: 38px; height: 38px; flex: none; border-radius: 10px; border: 1px solid transparent; background: transparent;
  display: inline-grid; place-items: center; color: var(--bbs-muted); cursor: pointer; transition: background .15s, color .15s;
}
.bb-staff-icon-btn:hover:not(:disabled) { background: #f1f5f9; color: var(--bbs-text); }
.bb-staff-icon-btn[aria-expanded="true"] { background: var(--bbs-soft); color: var(--bbs-primary); }
.bb-staff-icon-btn-sm { width: 30px; height: 30px; border-radius: 8px; }
.bb-staff-dot-badge { position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: var(--bbs-danger); color: #fff; font-size: 10.5px; font-weight: 700; display: grid; place-items: center; border: 2px solid #fff; font-variant-numeric: tabular-nums; }
.bb-staff-spin { animation: bb-staff-spin .8s linear infinite; }
@keyframes bb-staff-spin { to { transform: rotate(360deg); } }

/* ---------------------------------------------------------------- Cards */
.bb-staff-card { background: var(--bbs-card); border: 1px solid var(--bbs-border); border-radius: var(--bbs-radius); box-shadow: var(--bbs-shadow); min-width: 0; }
.bb-staff-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 0; flex-wrap: wrap; }
.bb-staff-card-head h3 { font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
.bb-staff-card-head p { color: var(--bbs-muted); font-size: 12.5px; margin-top: 2px; }
.bb-staff-card-body { padding: 18px 20px 20px; }
.bb-staff-card-foot { padding: 12px 20px; border-top: 1px solid var(--bbs-border); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.bb-staff-grid { display: grid; gap: 20px; }
.bb-staff-grid-kpi { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }
.bb-staff-grid-2-1 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.bb-staff-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

/* KPI tiles */
.bb-staff-kpi { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden; }
.bb-staff-kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bb-staff-kpi-label { font-size: 12.5px; font-weight: 600; color: var(--bbs-muted); }
.bb-staff-kpi-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: var(--bbs-soft); color: var(--bbs-primary); flex: none; }
.bb-staff-kpi-icon.is-warn { background: #fff7ed; color: #c2410c; }
.bb-staff-kpi-icon.is-sky { background: #e0f2fe; color: #0369a1; }
.bb-staff-kpi-icon.is-green { background: #dcfce7; color: #15803d; }
.bb-staff-kpi-value { font-size: 28px; font-weight: 700; letter-spacing: -.03em; line-height: 1.05; }
.bb-staff-kpi-meta { margin-top: auto; font-size: 12px; color: var(--bbs-muted); display: flex; align-items: center; gap: 6px; min-height: 18px; }
.bb-staff-kpi a.bb-staff-kpi-link { position: absolute; inset: 0; border-radius: inherit; }
.bb-staff-kpi:hover { border-color: #bfdbfe; }
.bb-staff-meter { height: 6px; border-radius: 99px; background: var(--bbs-soft-2); overflow: hidden; }
.bb-staff-meter > span { display: block; height: 100%; border-radius: 99px; background: var(--bbs-primary); }

/* ---------------------------------------------------------------- Forms */
.bb-staff-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bb-staff-label { font-size: 13px; font-weight: 600; color: var(--bbs-text-2); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bb-staff-hint { font-size: 12.5px; color: var(--bbs-muted); line-height: 1.45; }
.bb-staff-error-text { font-size: 12.5px; color: var(--bbs-danger); }
.bb-staff-input {
  width: 100%; min-width: 0; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--bbs-border-2); background: #fff; outline: none;
  font-size: 14px; color: var(--bbs-text); transition: border-color .15s, box-shadow .15s;
}
.bb-staff-input::placeholder { color: var(--bbs-faint); }
.bb-staff-input:hover:not(:disabled) { border-color: #94a3b8; }
.bb-staff-input:focus { border-color: var(--bbs-primary); box-shadow: var(--bbs-ring); }
.bb-staff-input:disabled, .bb-staff-input[readonly] { background: var(--bbs-surface); color: var(--bbs-muted); cursor: not-allowed; }
.bb-staff-input[aria-invalid="true"] { border-color: var(--bbs-danger); }
textarea.bb-staff-input { height: auto; min-height: 110px; padding: 10px 12px; line-height: 1.55; resize: vertical; }
select.bb-staff-input { appearance: none; padding-right: 34px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
.bb-staff-input-sm { height: 34px; font-size: 13px; border-radius: 9px; }
.bb-staff-input-group { position: relative; }
.bb-staff-input-group .bb-staff-input { padding-right: 42px; }
.bb-staff-input-group .bb-staff-icon-btn { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; }
.bb-staff-search { position: relative; min-width: 0; }
.bb-staff-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--bbs-faint); pointer-events: none; }
.bb-staff-search .bb-staff-input { padding-left: 35px; }
.bb-staff-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; }
.bb-staff-span-2 { grid-column: 1 / -1; }
.bb-staff-color { display: flex; align-items: center; gap: 8px; }
.bb-staff-color input[type="color"] { width: 40px; height: 40px; padding: 3px; border-radius: 10px; border: 1px solid var(--bbs-border-2); background: #fff; cursor: pointer; flex: none; }
.bb-staff-color input[type="color"]:disabled { cursor: not-allowed; opacity: .6; }
.bb-staff-check { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 13.5px; color: var(--bbs-text-2); }
.bb-staff-check input { width: 16px; height: 16px; margin: 2px 0 0; accent-color: var(--bbs-primary); flex: none; }
.bb-staff-range { width: 100%; accent-color: var(--bbs-primary); }

/* Switch */
.bb-staff-switch { position: relative; display: inline-flex; align-items: center; flex: none; }
.bb-staff-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; width: 100%; height: 100%; }
.bb-staff-switch input:disabled { cursor: not-allowed; }
.bb-staff-switch-track { width: 38px; height: 22px; border-radius: 99px; background: #cbd5e1; transition: background .15s; position: relative; pointer-events: none; }
.bb-staff-switch-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.25); transition: transform .18s; }
.bb-staff-switch input:checked + .bb-staff-switch-track { background: var(--bbs-primary); }
.bb-staff-switch input:checked + .bb-staff-switch-track::after { transform: translateX(16px); }
.bb-staff-switch input:focus-visible + .bb-staff-switch-track { box-shadow: var(--bbs-ring); }
.bb-staff-switch input:disabled + .bb-staff-switch-track { opacity: .5; }
.bb-staff-switch-sm .bb-staff-switch-track { width: 32px; height: 18px; }
.bb-staff-switch-sm .bb-staff-switch-track::after { width: 12px; height: 12px; }
.bb-staff-switch-sm input:checked + .bb-staff-switch-track::after { transform: translateX(14px); }
.bb-staff-setting-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 16px 0; border-top: 1px solid var(--bbs-border); }
.bb-staff-setting-row:first-child { border-top: 0; padding-top: 0; }
.bb-staff-setting-row h4 { font-size: 14px; font-weight: 600; }
.bb-staff-setting-row p { font-size: 13px; color: var(--bbs-muted); margin-top: 3px; max-width: 560px; }

/* ---------------------------------------------------------------- Pills & chips */
.bb-staff-pill { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px; border-radius: 99px; font-size: 11.5px; font-weight: 650; white-space: nowrap; line-height: 1; text-transform: capitalize; border: 1px solid transparent; }
.bb-staff-pill svg { flex: none; }
.bb-staff-pill-dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.bb-staff-role-owner { background: #1e1b4b; color: #e0e7ff; }
.bb-staff-role-admin { background: #dbeafe; color: #1e40af; }
.bb-staff-role-trainer { background: #e0f2fe; color: #075985; }
.bb-staff-role-viewer { background: #f1f5f9; color: #475569; }
.bb-staff-role-user { background: #f1f5f9; color: #475569; }
.bb-staff-role-customer { background: #ecfeff; color: #0e7490; }
.bb-staff-role-vendor { background: #f5f3ff; color: #6d28d9; }
.bb-staff-role-internal, .bb-staff-role-staff { background: #eff6ff; color: #1d4ed8; }
.bb-staff-role-public, .bb-staff-role-anonymous, .bb-staff-role-visitor { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
.bb-staff-status-active, .bb-staff-status-completed, .bb-staff-status-resolved { background: var(--bbs-success-soft); color: #15803d; }
.bb-staff-status-invited, .bb-staff-status-queued { background: var(--bbs-warning-soft); color: #b45309; }
.bb-staff-status-disabled, .bb-staff-status-dismissed { background: #f1f5f9; color: #64748b; }
.bb-staff-status-open { background: #fff7ed; color: #c2410c; }
.bb-staff-status-processing { background: #e0f2fe; color: #0369a1; }
.bb-staff-status-failed { background: var(--bbs-danger-soft); color: #b91c1c; }
.bb-staff-reason { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 7px; font-size: 12px; font-weight: 600; white-space: nowrap; border: 1px solid; }
.bb-staff-reason-no_context { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
.bb-staff-reason-low_confidence { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.bb-staff-reason-llm_unknown { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
.bb-staff-reason-negative_feedback { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.bb-staff-reason-llm_unavailable { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
.bb-staff-count { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 99px; background: #f1f5f9; color: var(--bbs-muted); font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
.bb-staff-occ { display: inline-flex; align-items: center; gap: 4px; font-weight: 650; font-size: 13px; font-variant-numeric: tabular-nums; }
.bb-staff-occ.is-hot { color: #c2410c; }

/* Avatar */
.bb-staff-avatar { width: 34px; height: 34px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; color: #fff; letter-spacing: .02em; background: linear-gradient(135deg, #3b82f6, #1d4ed8); text-transform: uppercase; }
.bb-staff-avatar-sm { width: 26px; height: 26px; font-size: 10.5px; }
.bb-staff-avatar-lg { width: 52px; height: 52px; font-size: 18px; }
.bb-staff-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bb-staff-person-text { min-width: 0; line-height: 1.3; }
.bb-staff-person-name { font-weight: 600; font-size: 13.5px; }
.bb-staff-person-sub { font-size: 12px; color: var(--bbs-muted); }

/* ---------------------------------------------------------------- Tabs & segmented */
.bb-staff-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--bbs-border); overflow-x: auto; scrollbar-width: none; }
.bb-staff-tabs::-webkit-scrollbar { display: none; }
.bb-staff-tab {
  appearance: none; background: transparent; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 10px 14px; display: inline-flex; align-items: center; gap: 8px;
  color: var(--bbs-muted); font-weight: 600; font-size: 13.5px; cursor: pointer; white-space: nowrap; text-decoration: none !important;
}
.bb-staff-tab:hover { color: var(--bbs-text); }
.bb-staff-tab[aria-selected="true"], .bb-staff-tab[aria-current="page"] { color: var(--bbs-primary); border-bottom-color: var(--bbs-primary); }
.bb-staff-tab[aria-selected="true"] .bb-staff-count, .bb-staff-tab[aria-current="page"] .bb-staff-count { background: var(--bbs-soft-2); color: var(--bbs-primary); }
.bb-staff-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: #f1f5f9; border: 1px solid var(--bbs-border); gap: 2px; }
.bb-staff-seg button { appearance: none; border: 0; background: transparent; padding: 0 12px; height: 30px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--bbs-muted); cursor: pointer; white-space: nowrap; }
.bb-staff-seg button:hover { color: var(--bbs-text); }
.bb-staff-seg button[aria-pressed="true"] { background: #fff; color: var(--bbs-primary); box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 0 0 1px var(--bbs-border); }

/* ---------------------------------------------------------------- Tables */
.bb-staff-table-wrap { overflow-x: auto; }
.bb-staff-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
.bb-staff-table th { text-align: left; font-size: 11.5px; font-weight: 650; text-transform: uppercase; letter-spacing: .05em; color: var(--bbs-muted); padding: 10px 16px; background: var(--bbs-surface); border-bottom: 1px solid var(--bbs-border); white-space: nowrap; }
.bb-staff-table th:first-child { border-top-left-radius: var(--bbs-radius); }
.bb-staff-table th:last-child { border-top-right-radius: var(--bbs-radius); }
.bb-staff-table td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.bb-staff-table tr:last-child td { border-bottom: 0; }
.bb-staff-table tbody tr { transition: background .12s; }
.bb-staff-table tbody tr.is-link { cursor: pointer; }
.bb-staff-table tbody tr.is-link:hover, .bb-staff-table tbody tr.is-active { background: #f8fbff; }
.bb-staff-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }
.bb-staff-table .is-actions { text-align: right; white-space: nowrap; }
.bb-staff-cell-label { display: none; }
.bb-staff-row-link { color: var(--bbs-text) !important; font-weight: 600; text-decoration: none !important; }
.bb-staff-row-link:hover { color: var(--bbs-primary) !important; }
.bb-staff-pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--bbs-border); font-size: 13px; color: var(--bbs-muted); flex-wrap: wrap; }
.bb-staff-pager > div { display: flex; gap: 6px; }

/* Lists */
.bb-staff-list { list-style: none; margin: 0; padding: 0; }
.bb-staff-list > li { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid #f1f5f9; }
.bb-staff-list > li:first-child { border-top: 0; }
.bb-staff-list-main { flex: 1; min-width: 0; }
.bb-staff-list-title { font-weight: 600; font-size: 13.5px; color: var(--bbs-text); }
.bb-staff-list-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--bbs-muted); margin-top: 4px; }
.bb-staff-dot-sep::before { content: "·"; margin-right: 8px; color: var(--bbs-faint); }

/* Filter bar */
.bb-staff-filters { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--bbs-border); }
.bb-staff-filters .bb-staff-search { flex: 1 1 240px; max-width: 360px; }
.bb-staff-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.bb-staff-chip { appearance: none; height: 30px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--bbs-border); background: #fff; color: var(--bbs-text-2); font-size: 12.5px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.bb-staff-chip:hover { border-color: var(--bbs-border-2); background: var(--bbs-surface); }
.bb-staff-chip[aria-pressed="true"] { background: var(--bbs-soft); border-color: #93c5fd; color: var(--bbs-primary); }
.bb-staff-chip i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* ---------------------------------------------------------------- Gap rows */
.bb-staff-gap-row { display: grid; grid-template-columns: minmax(0, 1fr) 170px 90px 190px 110px; gap: 16px; align-items: center; padding: 14px 18px; border-top: 1px solid #f1f5f9; cursor: pointer; text-decoration: none !important; color: inherit !important; transition: background .12s; }
.bb-staff-gap-row:first-child { border-top: 0; }
.bb-staff-gap-row:hover { background: #f8fbff; }
.bb-staff-gap-row.is-active { background: var(--bbs-soft); box-shadow: inset 3px 0 0 var(--bbs-primary); }
.bb-staff-gap-row.is-head { cursor: default; background: var(--bbs-surface); font-size: 11.5px; font-weight: 650; text-transform: uppercase; letter-spacing: .05em; color: var(--bbs-muted); padding-top: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--bbs-border); }
.bb-staff-gap-q { font-weight: 600; color: var(--bbs-text); font-size: 14px; line-height: 1.4; }
.bb-staff-gap-sub { font-size: 12px; color: var(--bbs-muted); margin-top: 3px; }

/* ---------------------------------------------------------------- Drawer & modal */
.bb-staff-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(2px); z-index: 1000; animation: bb-staff-fade .15s ease-out; }
.bb-staff-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); background: #fff; z-index: 1001; display: flex; flex-direction: column; box-shadow: var(--bbs-shadow-lg); animation: bb-staff-slide .2s ease-out; outline: none; font-family: var(--bbs-font); }
.bb-staff-drawer-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px; border-bottom: 1px solid var(--bbs-border); }
.bb-staff-drawer-body { flex: 1; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; }
.bb-staff-drawer-foot { padding: 14px 22px; border-top: 1px solid var(--bbs-border); display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; background: var(--bbs-surface); }
.bb-staff-modal-wrap { position: fixed; inset: 0; z-index: 1001; display: grid; place-items: center; padding: 16px; overflow-y: auto; }
.bb-staff-modal { width: min(520px, 100%); background: #fff; border-radius: 16px; box-shadow: var(--bbs-shadow-lg); animation: bb-staff-pop .18s ease-out; outline: none; font-family: var(--bbs-font); }
.bb-staff-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 4px; }
.bb-staff-modal-head h3 { font-size: 17px; font-weight: 650; letter-spacing: -.015em; }
.bb-staff-modal-head p { color: var(--bbs-muted); font-size: 13px; margin-top: 3px; }
.bb-staff-modal-body { padding: 16px 22px; display: flex; flex-direction: column; gap: 16px; }
.bb-staff-modal-foot { padding: 14px 22px 20px; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
@keyframes bb-staff-fade { from { opacity: 0; } }
@keyframes bb-staff-slide { from { transform: translateX(24px); opacity: 0; } }
@keyframes bb-staff-pop { from { transform: translateY(8px) scale(.98); opacity: 0; } }
@keyframes bb-staff-drop { from { transform: translateY(-4px); opacity: 0; } }

/* Popover / menu */
.bb-staff-pop-anchor { position: relative; }
.bb-staff-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 60; background: #fff; border: 1px solid var(--bbs-border); border-radius: 14px; box-shadow: var(--bbs-shadow-lg); animation: bb-staff-drop .14s ease-out; min-width: 220px; }
.bb-staff-menu { padding: 6px; display: flex; flex-direction: column; }
.bb-staff-menu-item { appearance: none; border: 0; background: transparent; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; font-size: 13.5px; font-weight: 500; color: var(--bbs-text-2) !important; cursor: pointer; text-align: left; text-decoration: none !important; width: 100%; }
.bb-staff-menu-item svg { color: var(--bbs-muted); flex: none; }
.bb-staff-menu-item:hover, .bb-staff-menu-item:focus-visible { background: #f1f5f9; color: var(--bbs-text) !important; outline: none; }
.bb-staff-menu-item.is-danger, .bb-staff-menu-item.is-danger svg { color: var(--bbs-danger) !important; }
.bb-staff-menu-item.is-danger:hover { background: var(--bbs-danger-soft); }
.bb-staff-menu-sep { height: 1px; background: var(--bbs-border); margin: 6px 4px; }
.bb-staff-menu-head { padding: 10px 10px 8px; }
.bb-staff-user-btn { appearance: none; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 9px; padding: 3px 8px 3px 3px; border-radius: 99px; cursor: pointer; }
.bb-staff-user-btn:hover, .bb-staff-user-btn[aria-expanded="true"] { background: #f1f5f9; }
.bb-staff-user-btn-name { font-size: 13px; font-weight: 600; max-width: 140px; }

/* Notifications */
.bb-staff-notif-pop { width: 400px; max-width: calc(100vw - 24px); }
.bb-staff-notif-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; border-bottom: 1px solid var(--bbs-border); }
.bb-staff-notif-head h3 { font-size: 15px; font-weight: 650; }
.bb-staff-notif-list { max-height: min(440px, 60vh); overflow-y: auto; }
.bb-staff-notif { display: flex; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; width: 100%; text-align: left; background: transparent; border-left: 0; border-right: 0; border-top: 0; appearance: none; position: relative; }
.bb-staff-notif:hover, .bb-staff-notif:focus-visible { background: #f8fbff; outline: none; }
.bb-staff-notif.is-unread { background: #f5f9ff; }
.bb-staff-notif.is-unread::after { content: ""; position: absolute; right: 16px; top: 18px; width: 8px; height: 8px; border-radius: 50%; background: var(--bbs-primary); }
.bb-staff-notif-icon { width: 34px; height: 34px; border-radius: 10px; flex: none; display: grid; place-items: center; }
.bb-staff-notif-icon.is-gap { background: #fff7ed; color: #c2410c; }
.bb-staff-notif-icon.is-feedback { background: #fef2f2; color: #b91c1c; }
.bb-staff-notif-icon.is-training_failed { background: #fef2f2; color: #b91c1c; }
.bb-staff-notif-icon.is-staff { background: var(--bbs-soft); color: var(--bbs-primary); }
.bb-staff-notif-title { font-size: 13.5px; font-weight: 600; color: var(--bbs-text); padding-right: 16px; }
.bb-staff-notif-body { font-size: 12.5px; color: var(--bbs-muted); margin-top: 2px; }
.bb-staff-notif-time { font-size: 11.5px; color: var(--bbs-faint); margin-top: 4px; }
.bb-staff-notif-foot { padding: 10px; text-align: center; }

/* ---------------------------------------------------------------- Toasts */
.bb-staff-toasts { position: fixed; right: 20px; bottom: 20px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); font-family: var(--bbs-font); pointer-events: none; }
.bb-staff-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; padding: 12px 12px 12px 14px; background: #0f172a; color: #f8fafc; border-radius: 12px; box-shadow: var(--bbs-shadow-lg); font-size: 13.5px; line-height: 1.45; animation: bb-staff-pop .18s ease-out; }
.bb-staff-toast > svg { flex: none; margin-top: 1px; }
.bb-staff-toast.is-success > svg { color: #4ade80; }
.bb-staff-toast.is-error > svg { color: #f87171; }
.bb-staff-toast.is-info > svg { color: #7dd3fc; }
.bb-staff-toast-body { flex: 1; min-width: 0; word-break: break-word; }
.bb-staff-toast button { appearance: none; border: 0; background: transparent; color: #94a3b8; cursor: pointer; padding: 2px; border-radius: 6px; display: grid; place-items: center; }
.bb-staff-toast button:hover { color: #fff; }

/* ---------------------------------------------------------------- Alerts, empty, skeleton */
.bb-staff-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; border: 1px solid; }
.bb-staff-alert > svg { flex: none; margin-top: 2px; }
.bb-staff-alert-info { background: var(--bbs-soft); border-color: #bfdbfe; color: #1e3a8a; }
.bb-staff-alert-warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.bb-staff-alert-error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.bb-staff-alert-success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.bb-staff-alert strong { font-weight: 650; }
.bb-staff-empty { text-align: center; padding: 44px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.bb-staff-empty-icon { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--bbs-soft); color: var(--bbs-primary); margin-bottom: 6px; box-shadow: inset 0 0 0 1px #dbeafe; }
.bb-staff-empty h4 { font-size: 15px; font-weight: 650; }
.bb-staff-empty p { font-size: 13px; color: var(--bbs-muted); max-width: 380px; }
.bb-staff-skel { display: block; border-radius: 8px; background: linear-gradient(90deg, #eef2f7 25%, #f8fafc 50%, #eef2f7 75%); background-size: 200% 100%; animation: bb-staff-shimmer 1.3s ease-in-out infinite; }
@keyframes bb-staff-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.bb-staff-code { position: relative; background: #0b1220; color: #e2e8f0; border-radius: 12px; padding: 16px 16px 16px; font-family: var(--bbs-mono); font-size: 12.5px; line-height: 1.65; overflow-x: auto; white-space: pre; border: 1px solid #1e293b; margin: 0; }
.bb-staff-code-wrap { position: relative; }
.bb-staff-code-wrap .bb-staff-btn { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,.08); color: #e2e8f0 !important; border-color: rgba(255,255,255,.12); box-shadow: none; }
.bb-staff-code-wrap .bb-staff-btn:hover { background: rgba(255,255,255,.16); }
.bb-staff-copy-field { display: flex; gap: 8px; align-items: center; padding: 6px 6px 6px 12px; border: 1px solid var(--bbs-border-2); border-radius: 10px; background: var(--bbs-surface); }
.bb-staff-copy-field code { flex: 1; min-width: 0; font-family: var(--bbs-mono); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; }
.bb-staff-kv dt { font-size: 11.5px; font-weight: 650; color: var(--bbs-muted); text-transform: uppercase; letter-spacing: .05em; }
.bb-staff-kv dd { margin: 4px 0 0; font-size: 13.5px; color: var(--bbs-text); min-width: 0; }
.bb-staff-quote { border-radius: 12px; padding: 14px 16px; background: var(--bbs-surface); border: 1px solid var(--bbs-border); font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: var(--bbs-text-2); }
.bb-staff-quote.is-bot { background: #fff; border-left: 3px solid #f59e0b; }
.bb-staff-section-label { font-size: 12px; font-weight: 650; color: var(--bbs-muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.bb-staff-confirm { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; font-size: 12.5px; color: var(--bbs-danger); font-weight: 600; }

/* ---------------------------------------------------------------- Charts */
.bb-staff-chart { position: relative; width: 100%; }
.bb-staff-chart svg { display: block; width: 100%; overflow: visible; }
.bb-staff-chart text { font-family: var(--bbs-font); font-size: 11px; fill: var(--bbs-muted); font-variant-numeric: tabular-nums; }
.bb-staff-tooltip { position: absolute; pointer-events: none; z-index: 5; background: #0f172a; color: #f8fafc; border-radius: 10px; padding: 9px 11px; font-size: 12px; box-shadow: var(--bbs-shadow-lg); min-width: 150px; transform: translate(-50%, -100%); white-space: nowrap; }
.bb-staff-tooltip-title { font-weight: 650; margin-bottom: 5px; color: #cbd5e1; font-size: 11.5px; }
.bb-staff-tooltip-row { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.bb-staff-tooltip-row span:first-child { display: inline-flex; align-items: center; gap: 6px; color: #cbd5e1; }
.bb-staff-tooltip-row b { font-variant-numeric: tabular-nums; color: #fff; }
.bb-staff-legend { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--bbs-text-2); }
.bb-staff-legend span { display: inline-flex; align-items: center; gap: 7px; }
.bb-staff-key-line { width: 14px; height: 3px; border-radius: 3px; display: inline-block; }
.bb-staff-key-dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; flex: none; }
.bb-staff-bars { display: flex; flex-direction: column; gap: 14px; }
.bb-staff-bar-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; font-size: 13px; }
.bb-staff-bar-row .bb-staff-bar-track { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; }
.bb-staff-bar-row .bb-staff-bar-track > span { display: block; height: 100%; border-radius: 0 4px 4px 0; background: var(--bbs-primary); min-width: 2px; }
.bb-staff-bar-label { color: var(--bbs-text-2); font-weight: 550; text-transform: capitalize; }
.bb-staff-bar-value { font-weight: 650; font-variant-numeric: tabular-nums; }
.bb-staff-stack-bar { display: flex; gap: 2px; height: 10px; border-radius: 5px; overflow: hidden; background: #f1f5f9; }
.bb-staff-stack-bar > span { height: 100%; }
.bb-staff-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.bb-staff-status-cell { padding: 10px 12px; border-radius: 10px; border: 1px solid var(--bbs-border); display: flex; flex-direction: column; gap: 2px; }
.bb-staff-status-cell b { font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
.bb-staff-status-cell span { font-size: 12px; color: var(--bbs-muted); display: inline-flex; align-items: center; gap: 6px; }
.bb-staff-hero-rate { display: flex; align-items: baseline; gap: 8px; }

/* ---------------------------------------------------------------- Transcript */
.bb-staff-transcript { display: flex; flex-direction: column; gap: 14px; padding: 22px; background: linear-gradient(180deg, #f8fbff, #fff 240px); }
.bb-staff-msg { display: flex; gap: 10px; max-width: 78%; }
.bb-staff-msg.is-user { margin-left: auto; flex-direction: row-reverse; }
.bb-staff-msg-bubble { padding: 11px 14px; border-radius: 16px; font-size: 14px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.bb-staff-msg.is-user .bb-staff-msg-bubble { background: var(--bbs-primary); color: #fff; border-bottom-right-radius: 5px; }
.bb-staff-msg.is-assistant .bb-staff-msg-bubble { background: #fff; border: 1px solid var(--bbs-border); border-bottom-left-radius: 5px; box-shadow: var(--bbs-shadow-sm); }
.bb-staff-msg.is-system .bb-staff-msg-bubble { background: #f1f5f9; color: var(--bbs-muted); font-size: 12.5px; }
.bb-staff-msg-time { font-size: 11px; color: var(--bbs-faint); margin-top: 4px; }
.bb-staff-msg.is-user .bb-staff-msg-time { text-align: right; }
.bb-staff-bot-avatar { width: 30px; height: 30px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--bbs-accent), var(--bbs-primary)); }

/* ---------------------------------------------------------------- Settings */
.bb-staff-settings { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
.bb-staff-settings-nav { display: flex; flex-direction: column; gap: 2px; position: sticky; top: calc(var(--bbs-top) + 88px); }
.bb-staff-settings-nav a { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; color: var(--bbs-text-2) !important; font-weight: 550; font-size: 13.5px; text-decoration: none !important; }
.bb-staff-settings-nav a svg { color: var(--bbs-muted); flex: none; }
.bb-staff-settings-nav a:hover { background: #f1f5f9; }
.bb-staff-settings-nav a[aria-current="page"] { background: #fff; color: var(--bbs-primary) !important; box-shadow: var(--bbs-shadow-sm), 0 0 0 1px var(--bbs-border); }
.bb-staff-settings-nav a[aria-current="page"] svg { color: var(--bbs-primary); }
.bb-staff-savebar { position: sticky; bottom: 16px; z-index: 20; margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px 12px 18px; border-radius: 14px; background: #0f172a; color: #e2e8f0; box-shadow: var(--bbs-shadow-lg); animation: bb-staff-pop .18s ease-out; flex-wrap: wrap; }
.bb-staff-savebar .bb-staff-btn-secondary { background: transparent; color: #e2e8f0 !important; border-color: rgba(255,255,255,.2); box-shadow: none; }
.bb-staff-savebar .bb-staff-btn-secondary:hover { background: rgba(255,255,255,.08); }
.bb-staff-widget-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 20px; align-items: start; }
.bb-staff-preview-sticky { position: sticky; top: calc(var(--bbs-top) + 88px); }
.bb-staff-list-editor { display: flex; flex-direction: column; gap: 8px; }
.bb-staff-list-editor-row { display: flex; gap: 6px; }
.bb-staff-threshold { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; background: var(--bbs-surface); border: 1px solid var(--bbs-border); }
.bb-staff-threshold-scale { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--bbs-muted); }
.bb-staff-threshold-value { font-size: 22px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }

/* Widget preview mock (mirrors the spres-web "omago" widget) */
.bb-staff-wp-stage { border-radius: 16px; padding: 18px; background: repeating-linear-gradient(45deg, #f8fafc 0 10px, #f1f5f9 10px 20px); border: 1px solid var(--bbs-border); display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
.bb-staff-wp { width: 100%; max-width: 344px; border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; border: 2px solid rgba(255,255,255,.85); font-size: 13px; line-height: 1.45; box-shadow: 0 24px 60px rgba(15,23,42,.18); }
.bb-staff-wp-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px; }
.bb-staff-wp-orb { width: 34px; height: 34px; border-radius: 50%; flex: none; overflow: hidden; display: grid; place-items: center; }
.bb-staff-wp-orb img { width: 100%; height: 100%; object-fit: cover; }
.bb-staff-wp-title { font-weight: 750; font-size: 14px; }
.bb-staff-wp-sub { font-size: 12px; opacity: .6; }
.bb-staff-wp-body { padding: 6px 14px 12px; display: flex; flex-direction: column; gap: 8px; min-height: 230px; }
.bb-staff-wp-bubble { background: rgba(255,255,255,.75); border-radius: 14px 14px 14px 6px; padding: 9px 12px; max-width: 88%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.8); }
.bb-staff-wp-user { margin-left: auto; color: #fff; border-radius: 14px 14px 6px 14px; padding: 9px 12px; max-width: 80%; }
.bb-staff-wp-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.bb-staff-wp-pill { padding: 5px 11px; border-radius: 99px; background: rgba(255,255,255,.5); font-size: 12px; font-weight: 700; border: 1px solid; }
.bb-staff-wp-composer { margin: 0 10px 10px; display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; border-radius: 16px; background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.9); }
.bb-staff-wp-composer > span:first-child { flex: 1; opacity: .45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bb-staff-wp-send { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; flex: none; }
.bb-staff-wp-launcher { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px 0 15px; border-radius: 99px; color: #fff; font-weight: 760; font-size: 15px; box-shadow: 0 14px 30px rgba(15,23,42,.2); }
.bb-staff-wp-launcher.is-icon { width: 56px; height: 56px; padding: 0; justify-content: center; }

/* API keys */
.bb-staff-key-type { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
.bb-staff-key-type.is-publishable { background: #ecfeff; color: #0e7490; }
.bb-staff-key-type.is-secret { background: #fef2f2; color: #b91c1c; }
.bb-staff-radio-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.bb-staff-radio-card { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--bbs-border-2); border-radius: 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s, background .15s; }
.bb-staff-radio-card input { position: absolute; opacity: 0; pointer-events: none; }
.bb-staff-radio-card b { font-size: 13.5px; font-weight: 650; display: flex; align-items: center; gap: 7px; }
.bb-staff-radio-card span { font-size: 12.5px; color: var(--bbs-muted); line-height: 1.4; }
.bb-staff-radio-card:hover { border-color: #93c5fd; }
.bb-staff-radio-card.is-checked { border-color: var(--bbs-primary); background: #f8fbff; box-shadow: 0 0 0 1px var(--bbs-primary); }
.bb-staff-radio-card:focus-within { box-shadow: var(--bbs-ring); }
.bb-staff-radio-cards.is-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); }

/* ---------------------------------------------------------------- Auth screens */
.bb-staff-auth { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: calc(100vh - var(--bbs-top)); width: 100%; background: #fff; }
.bb-staff-auth-brand {
  position: relative; overflow: hidden; color: #e0f2fe; padding: 48px 56px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px;
  background: radial-gradient(80% 60% at 100% 0%, rgba(14,165,233,.45), transparent 60%), radial-gradient(70% 60% at 0% 100%, rgba(29,78,216,.6), transparent 60%), linear-gradient(160deg, #0b1f44 0%, #0f2a5f 45%, #1d4ed8 100%);
}
.bb-staff-auth-brand::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(ellipse at 30% 40%, #000 30%, transparent 75%); -webkit-mask-image: radial-gradient(ellipse at 30% 40%, #000 30%, transparent 75%); pointer-events: none; }
.bb-staff-auth-brand > * { position: relative; }
.bb-staff-auth-logo { display: flex; align-items: center; gap: 12px; color: #fff; font-weight: 700; font-size: 17px; }
.bb-staff-auth-pitch h2 { font-size: clamp(28px, 3.2vw, 40px); line-height: 1.12; font-weight: 750; letter-spacing: -.03em; color: #fff; max-width: 520px; }
.bb-staff-auth-pitch h2 em { font-style: normal; background: linear-gradient(90deg, #7dd3fc, #bae6fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
.bb-staff-auth-pitch p { margin-top: 16px; font-size: 15.5px; line-height: 1.6; color: #bfdbfe; max-width: 480px; }
.bb-staff-auth-features { list-style: none; margin: 28px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; max-width: 480px; }
.bb-staff-auth-features li { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; color: #dbeafe; line-height: 1.5; }
.bb-staff-auth-features li > span:first-child { width: 32px; height: 32px; border-radius: 10px; flex: none; display: grid; place-items: center; background: rgba(255,255,255,.1); color: #7dd3fc; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
.bb-staff-auth-features b { color: #fff; font-weight: 650; display: block; }
.bb-staff-auth-card { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); backdrop-filter: blur(6px); max-width: 420px; font-size: 13px; color: #dbeafe; }
.bb-staff-auth-form-side { display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: #fff; }
.bb-staff-auth-form { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 18px; }
.bb-staff-auth-form h1 { font-size: 26px; font-weight: 750; letter-spacing: -.025em; }
.bb-staff-auth-form .bb-staff-auth-lead { color: var(--bbs-muted); font-size: 14.5px; margin-top: 6px; }
.bb-staff-auth-mobile-logo { display: none; }
.bb-staff-auth-foot { font-size: 12.5px; color: var(--bbs-faint); text-align: center; }
.bb-staff-link-btn { appearance: none; border: 0; background: transparent; color: var(--bbs-primary); font-weight: 600; cursor: pointer; padding: 0; font-size: 13px; }
.bb-staff-link-btn:hover { text-decoration: underline; text-underline-offset: 2px; }
.bb-staff-pw-meter { display: flex; gap: 4px; margin-top: 2px; }
.bb-staff-pw-meter span { flex: 1; height: 4px; border-radius: 4px; background: #e2e8f0; }
.bb-staff-pw-meter span.is-on { background: var(--bbs-primary); }
.bb-staff-center-screen { min-height: calc(100vh - var(--bbs-top)); width: 100%; display: grid; place-items: center; }
.bb-staff-loader { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--bbs-accent), var(--bbs-primary)); box-shadow: 0 10px 30px rgba(29,78,216,.3); animation: bb-staff-pulse 1.2s ease-in-out infinite; }
@keyframes bb-staff-pulse { 50% { transform: scale(.92); opacity: .75; } }

/* ---------------------------------------------------------------- Account / profile */
.bb-staff-profile-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

/* ---------------------------------------------------------------- Embedded TrainingPanel (blue variant) */
.bb-staff .bb-train-root {
  --bb-train-border: #e2e8f0; --bb-train-text: #0f172a; --bb-train-muted: #64748b; --bb-train-soft: #f8fafc;
  font-family: var(--bbs-font);
}
.bb-staff .bb-train-card { border-radius: var(--bbs-radius); box-shadow: var(--bbs-shadow); }
.bb-staff .bb-train-btn-primary:hover:not(:disabled) { opacity: 1; background: var(--bbs-primary-hover); }
.bb-staff .bb-train-label { color: var(--bbs-text-2); }
.bb-staff .bb-train-drop { border-color: #bfdbfe; background: #f8fbff; }
.bb-staff .bb-train-input:hover { border-color: #94a3b8; }

/* ---------------------------------------------------------------- Responsive */
@media (max-width: 1280px) {
  .bb-staff-grid-kpi { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .bb-staff-widget-layout { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (max-width: 1100px) {
  .bb-staff-grid-2-1 { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-gap-row { grid-template-columns: minmax(0, 1fr) 160px 80px 110px; }
  .bb-staff-gap-row > .bb-staff-col-who { display: none; }
  .bb-staff-widget-layout { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-preview-sticky { position: static; }
}
@media (max-width: 900px) {
  .bb-staff { --bbs-side-w: 272px; }
  .bb-staff.is-collapsed { --bbs-side-w: 272px; }
  .bb-staff-side { position: fixed; left: 0; top: var(--bbs-top); bottom: 0; height: auto; transform: translateX(-100%); transition: transform .22s ease; box-shadow: none; z-index: 1100; }
  .bb-staff.is-drawer-open .bb-staff-side { transform: none; box-shadow: 24px 0 60px rgba(2,6,23,.35); }
  .bb-staff.is-collapsed .bb-staff-brand-text, .bb-staff.is-collapsed .bb-staff-nav-label, .bb-staff.is-collapsed .bb-staff-nav-section, .bb-staff.is-collapsed .bb-staff-side-user-text { display: revert; }
  .bb-staff.is-collapsed .bb-staff-nav-item { justify-content: flex-start; padding: 9px 10px; }
  .bb-staff.is-collapsed .bb-staff-nav-badge { position: static; }
  .bb-staff-collapse { display: none; }
  .bb-staff-scrim { display: block; position: fixed; inset: 0; top: var(--bbs-top); background: rgba(15,23,42,.5); z-index: 1050; opacity: 0; pointer-events: none; transition: opacity .2s; }
  .bb-staff.is-drawer-open .bb-staff-scrim { opacity: 1; pointer-events: auto; }
  .bb-staff-top .bb-staff-menu-btn { display: inline-grid; margin-left: -8px; }
  .bb-staff.has-side::before { display: none; }
  .bb-staff-top { padding: 0 16px; }
  .bb-staff-content { padding: 20px 16px; }
  .bb-staff-top-search { display: none; }
  .bb-staff-settings { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-settings-nav { position: static; flex-direction: row; overflow-x: auto; gap: 4px; scrollbar-width: none; padding-bottom: 2px; }
  .bb-staff-settings-nav a { white-space: nowrap; }
  .bb-staff-auth { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-auth-brand { display: none; }
  .bb-staff-auth-mobile-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; margin-bottom: 8px; }
  .bb-staff-user-btn-name { display: none; }
}
@media (max-width: 760px) {
  .bb-staff-grid-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .bb-staff-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-form-grid { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-kv { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-page-head h2 { font-size: 21px; }
  .bb-staff-gap-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; }
  .bb-staff-gap-row.is-head { display: none; }
  .bb-staff-gap-row > .bb-staff-col-reason { grid-column: 1 / 2; grid-row: 2; }
  .bb-staff-gap-row > .bb-staff-col-occ { grid-column: 2; grid-row: 1; align-self: start; }
  .bb-staff-gap-row > .bb-staff-col-seen { grid-column: 2; grid-row: 2; text-align: right; }
  .bb-staff-table.is-responsive thead { display: none; }
  .bb-staff-table.is-responsive, .bb-staff-table.is-responsive tbody, .bb-staff-table.is-responsive tr, .bb-staff-table.is-responsive td { display: block; width: 100%; }
  .bb-staff-table.is-responsive tr { padding: 12px 16px; border-bottom: 1px solid var(--bbs-border); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 12px; }
  .bb-staff-table.is-responsive tr:last-child { border-bottom: 0; }
  .bb-staff-table.is-responsive td { padding: 0; border: 0; text-align: left !important; min-width: 0; }
  .bb-staff-table.is-responsive td.is-primary, .bb-staff-table.is-responsive td.is-actions { grid-column: 1 / -1; }
  .bb-staff-table.is-responsive td.is-actions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-start; }
  .bb-staff-table.is-responsive .bb-staff-cell-label { display: block; font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .05em; color: var(--bbs-muted); margin-bottom: 3px; }
  .bb-staff-msg { max-width: 92%; }
  .bb-staff-transcript { padding: 16px; }
  .bb-staff-radio-cards, .bb-staff-radio-cards.is-roles { grid-template-columns: minmax(0, 1fr); }
  .bb-staff-drawer-body { padding: 18px 16px; }
  .bb-staff-drawer-head, .bb-staff-drawer-foot { padding-left: 16px; padding-right: 16px; }
  .bb-staff-card-head { padding: 16px 16px 0; }
  .bb-staff-card-body { padding: 16px; }
  .bb-staff-list > li { padding: 12px 16px; }
  .bb-staff-filters { padding: 12px; }
  .bb-staff-filters .bb-staff-search { max-width: none; }
}
@media (max-width: 480px) {
  .bb-staff-kpi { padding: 14px; }
  .bb-staff-kpi-value { font-size: 23px; }
  .bb-staff-kpi-icon { width: 28px; height: 28px; }
  .bb-staff-top h1 { font-size: 16px; }
  .bb-staff-crumbs { display: none; }
  .bb-staff-status-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .bb-staff-auth-form-side { padding: 28px 16px; align-items: flex-start; }
  .bb-staff-notif-pop { position: fixed; left: 12px; right: 12px; top: 60px; width: auto; }
  .bb-staff-modal-head, .bb-staff-modal-body, .bb-staff-modal-foot { padding-left: 16px; padding-right: 16px; }
  .bb-staff-list > li { flex-wrap: wrap; }
  .bb-staff-list > li > .bb-staff-btn { margin-left: 38px; }
}
@media (prefers-reduced-motion: reduce) {
  .bb-staff *, .bb-staff-overlay, .bb-staff-drawer, .bb-staff-modal, .bb-staff-toast { animation: none !important; transition: none !important; }
}
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
    if (!document.getElementById(FONT_ID) && !document.getElementById('bb-train-font')) {
      const link = document.createElement('link');
      link.id = FONT_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);
}
