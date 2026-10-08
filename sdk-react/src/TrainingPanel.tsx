import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { useBrainboxTraining } from './useBrainboxTraining';
import { toBrainboxError } from './brainbox-sdk';
import type {
  ApiSourceConfig,
  ApiSourceMapping,
  ApiSourcePagination,
  ApiSourceTestResult,
  ApiSourceType,
  TrainingAudience,
  TrainingPanelProps,
  TrainingSource
} from './types';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const ACCEPTED_EXTENSIONS = ['.pdf', '.xml', '.txt', '.md', '.csv', '.json', '.docx'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const STYLE_ID = 'bb-train-styles';
const FONT_ID = 'bb-train-font';

type TabKey = 'upload' | 'api' | 'text';
type KindFilter = 'all' | 'file' | 'api' | 'text';

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'upload', label: 'Upload files', icon: 'upload' },
  { key: 'api', label: 'Connect API', icon: 'plug' },
  { key: 'text', label: 'Paste text', icon: 'type' }
];

function fileExtension(name?: string | null): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Unknown';
  const diff = Math.round((now - t) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 45) return 'just now';
  if (diff < 90) return '1 min ago';
  const mins = Math.round(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatNumber(n?: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat().format(n);
}

const DEFAULT_AUDIENCE: TrainingAudience = 'internal';

const AUDIENCE_OPTIONS: { value: TrainingAudience; label: string; short: string; help: string }[] = [
  { value: 'public', label: 'Public — anyone', short: 'Public', help: 'Anyone, including anonymous visitors on your website chat.' },
  { value: 'customer', label: 'Customers', short: 'Customers', help: 'Logged-in customers and portal users. Staff and admins see it too.' },
  { value: 'vendor', label: 'Vendors', short: 'Vendors', help: 'Suppliers and vendors. Staff and admins see it too.' },
  { value: 'internal', label: 'Internal staff', short: 'Internal', help: 'Your team only — never shown to customers, vendors or the public.' },
  { value: 'admin', label: 'Admins only', short: 'Admins', help: 'Administrators only. Use for sensitive material.' }
];

const audienceOption = (value?: string | null) => AUDIENCE_OPTIONS.find((o) => o.value === value);

let rowSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(rowSeq++).toString(36)}`;

/* ------------------------------------------------------------------ */
/* Icons (Lucide-style, inline)                                        */
/* ------------------------------------------------------------------ */

type IconName =
  | 'upload'
  | 'plug'
  | 'type'
  | 'file'
  | 'fileCode'
  | 'fileSheet'
  | 'headset'
  | 'refresh'
  | 'trash'
  | 'search'
  | 'check'
  | 'alert'
  | 'x'
  | 'chevron'
  | 'plus'
  | 'eye'
  | 'eyeOff'
  | 'database'
  | 'layers'
  | 'clock'
  | 'sparkles'
  | 'loader'
  | 'info';

function Icon({ name, size = 18, strokeWidth = 1.9 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const paths: Record<IconName, ReactNode> = {
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5" />
        <path d="M12 3v12" />
      </>
    ),
    plug: (
      <>
        <path d="M12 22v-5" />
        <path d="M9 8V2M15 8V2" />
        <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
      </>
    ),
    type: (
      <>
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6M12 4v16" />
      </>
    ),
    file: (
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </>
    ),
    fileCode: (
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
        <path d="M14 2v6h6M10 12l-2 2 2 2M14 12l2 2-2 2" />
      </>
    ),
    fileSheet: (
      <>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8M12 13v4" />
      </>
    ),
    headset: (
      <>
        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    search: <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />,
    check: <path d="M20 6 9 17l-5-5" />,
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 10 5-10 5L2 7Z" />
        <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
      </>
    ),
    loader: <path d="M21 12a9 9 0 1 1-6.22-8.56" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    )
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={name === 'loader' ? 'bb-train-spin' : undefined}
    >
      {paths[name]}
    </svg>
  );
}

function sourceVisual(source: { kind: string; source_type?: string; filename?: string | null }): {
  icon: IconName;
  label: string;
  tone: string;
} {
  if (source.kind === 'api') {
    return source.source_type === 'support_tickets'
      ? { icon: 'headset', label: 'Tickets', tone: 'violet' }
      : { icon: 'plug', label: 'API', tone: 'blue' };
  }
  if (source.kind === 'text') return { icon: 'type', label: 'Text', tone: 'grey' };
  const ext = fileExtension(source.filename);
  switch (ext) {
    case '.pdf':
      return { icon: 'file', label: 'PDF', tone: 'red' };
    case '.xml':
      return { icon: 'fileCode', label: 'XML', tone: 'orange' };
    case '.json':
      return { icon: 'fileCode', label: 'JSON', tone: 'amber' };
    case '.csv':
      return { icon: 'fileSheet', label: 'CSV', tone: 'green' };
    case '.docx':
      return { icon: 'file', label: 'DOCX', tone: 'blue' };
    case '.md':
      return { icon: 'file', label: 'MD', tone: 'grey' };
    case '.txt':
      return { icon: 'file', label: 'TXT', tone: 'grey' };
    default:
      return { icon: 'file', label: ext ? ext.slice(1).toUpperCase().slice(0, 4) : 'FILE', tone: 'grey' };
  }
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const trainingCss = `
.bb-train-root {
  --bb-train-primary: #111114;
  --bb-train-accent: #a882f7;
  --bb-train-bg: #f3f3f5;
  --bb-train-border: #ebe9ef;
  --bb-train-text: #17161c;
  --bb-train-muted: #6f6c78;
  --bb-train-soft: #f7f6f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--bb-train-text);
  background: var(--bb-train-bg);
  min-height: 100%;
  box-sizing: border-box;
  padding: 22px;
  -webkit-font-smoothing: antialiased;
}
.bb-train-root *, .bb-train-root *::before, .bb-train-root *::after { box-sizing: border-box; }
.bb-train-root.bb-train-embedded { padding: 0; background: transparent; min-height: 0; }
.bb-train-embedded .bb-train-inner { max-width: none; }
.bb-train-inner { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.bb-train-card {
  background: #fff;
  border: 1px solid var(--bb-train-border);
  border-radius: 18px;
  box-shadow: 0 18px 45px rgba(17,17,20,.06);
  padding: 22px;
  min-width: 0;
}
.bb-train-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

/* Header */
.bb-train-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
.bb-train-brand { display: flex; align-items: center; gap: 8px; color: var(--bb-train-muted); font-size: 13px; font-weight: 500; margin-bottom: 10px; }
.bb-train-brand img { width: 26px; height: 26px; border-radius: 8px; object-fit: cover; }
.bb-train-brand-mark { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--bb-train-accent) 18%, #fff); color: var(--bb-train-accent); }
.bb-train-title { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 650; letter-spacing: -0.02em; }
.bb-train-subtitle { margin: 6px 0 0; color: var(--bb-train-muted); font-size: 14px; line-height: 1.5; max-width: 560px; }
.bb-train-stats { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 10px; }
.bb-train-stat { background: var(--bb-train-soft); border: 1px solid var(--bb-train-border); border-radius: 14px; padding: 12px 14px; min-width: 0; }
.bb-train-stat-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--bb-train-muted); font-weight: 500; }
.bb-train-stat-value { margin-top: 4px; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Banner */
.bb-train-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; border: 1px solid; }
.bb-train-banner.is-error { background: #fff4f4; border-color: #f6d2d2; color: #8f1d1d; }
.bb-train-banner.is-success { background: #f1fbf4; border-color: #cdebd6; color: #1b6a35; }
.bb-train-banner.is-info { background: color-mix(in srgb, var(--bb-train-accent) 8%, #fff); border-color: color-mix(in srgb, var(--bb-train-accent) 30%, #fff); color: #43307a; }
.bb-train-banner > svg { flex: none; margin-top: 1px; }
.bb-train-banner-body { flex: 1; min-width: 0; word-break: break-word; }
.bb-train-banner .bb-train-btn { margin-left: auto; }

/* Buttons & inputs */
.bb-train-btn {
  appearance: none; border: 1px solid transparent; border-radius: 11px; font: inherit; font-size: 13.5px; font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 14px; cursor: pointer;
  transition: background .15s, border-color .15s, opacity .15s, transform .05s; white-space: nowrap; line-height: 1.2;
}
.bb-train-btn:active:not(:disabled) { transform: translateY(1px); }
.bb-train-btn:disabled { opacity: .5; cursor: not-allowed; }
.bb-train-btn:focus-visible, .bb-train-input:focus-visible, .bb-train-tab:focus-visible, .bb-train-chip:focus-visible, .bb-train-icon-btn:focus-visible, .bb-train-drop:focus-within, .bb-train-seg button:focus-visible, .bb-train-disclosure:focus-visible, .bb-train-status:focus-visible {
  outline: 2px solid var(--bb-train-accent); outline-offset: 2px;
}
.bb-train-btn-primary { background: var(--bb-train-primary); color: #fff; }
.bb-train-btn-primary:hover:not(:disabled) { opacity: .88; }
.bb-train-btn-ghost { background: #fff; color: var(--bb-train-text); border-color: var(--bb-train-border); }
.bb-train-btn-ghost:hover:not(:disabled) { background: var(--bb-train-soft); }
.bb-train-btn-danger { background: #d92d2d; color: #fff; }
.bb-train-btn-danger:hover:not(:disabled) { background: #bf2222; }
.bb-train-btn-sm { padding: 6px 10px; font-size: 12.5px; border-radius: 9px; }
.bb-train-icon-btn { appearance: none; border: 1px solid var(--bb-train-border); background: #fff; color: var(--bb-train-muted); width: 34px; height: 34px; flex: none; border-radius: 10px; display: inline-grid; place-items: center; cursor: pointer; }
.bb-train-icon-btn:hover:not(:disabled) { background: var(--bb-train-soft); color: var(--bb-train-text); }
.bb-train-icon-btn:disabled { opacity: .45; cursor: not-allowed; }

.bb-train-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bb-train-label { font-size: 12.5px; font-weight: 600; color: #34313c; }
.bb-train-hint { font-size: 12px; color: var(--bb-train-muted); line-height: 1.4; }
.bb-train-input {
  width: 100%; min-width: 0; font: inherit; font-size: 13.5px; color: var(--bb-train-text); background: #fff;
  border: 1px solid var(--bb-train-border); border-radius: 11px; padding: 9px 12px; outline: none; transition: border-color .15s, box-shadow .15s;
}
.bb-train-input:hover { border-color: #dcd8e3; }
.bb-train-input:focus { border-color: var(--bb-train-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--bb-train-accent) 20%, transparent); }
.bb-train-input[aria-invalid="true"] { border-color: #e06363; }
textarea.bb-train-input { resize: vertical; min-height: 120px; line-height: 1.5; }
.bb-train-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
select.bb-train-input { appearance: none; padding-right: 34px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236f6c78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
.bb-train-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bb-train-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.bb-train-span-2 { grid-column: span 2; }
.bb-train-url-row { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; }
.bb-train-field-error { color: #b42323; font-size: 12px; }

/* Tabs */
.bb-train-tabs { display: flex; gap: 4px; padding: 4px; background: var(--bb-train-soft); border: 1px solid var(--bb-train-border); border-radius: 13px; width: fit-content; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.bb-train-tab { appearance: none; border: 0; background: transparent; color: var(--bb-train-muted); font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; border-radius: 10px; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; white-space: nowrap; }
.bb-train-tab:hover { color: var(--bb-train-text); }
.bb-train-tab[aria-selected="true"] { background: #fff; color: var(--bb-train-text); box-shadow: 0 1px 2px rgba(17,17,20,.08), 0 0 0 1px var(--bb-train-border); }
.bb-train-tab[aria-selected="true"] svg { color: var(--bb-train-accent); }
.bb-train-tabpanel { margin-top: 18px; }
.bb-train-section-title { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.01em; }
.bb-train-section-sub { margin: 4px 0 0; color: var(--bb-train-muted); font-size: 13px; }

/* Dropzone */
.bb-train-drop {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px;
  padding: 34px 18px; border: 1.5px dashed #d8d3e2; border-radius: 16px; background: var(--bb-train-soft); cursor: pointer; transition: border-color .15s, background .15s;
}
.bb-train-drop:hover, .bb-train-drop.is-over { border-color: var(--bb-train-accent); background: color-mix(in srgb, var(--bb-train-accent) 7%, #fff); }
.bb-train-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.bb-train-drop-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: #fff; border: 1px solid var(--bb-train-border); color: var(--bb-train-accent); box-shadow: 0 6px 16px rgba(17,17,20,.05); }
.bb-train-drop-title { font-weight: 600; font-size: 14.5px; }
.bb-train-drop-title u { text-decoration-color: var(--bb-train-accent); text-underline-offset: 3px; }
.bb-train-drop-meta { color: var(--bb-train-muted); font-size: 12.5px; }
.bb-train-queue { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.bb-train-queue-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--bb-train-border); border-radius: 13px; background: #fff; }
.bb-train-queue-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-train-queue-meta { font-size: 12px; color: var(--bb-train-muted); margin-top: 2px; }
.bb-train-queue-meta.is-error { color: #b42323; }
.bb-train-progress { height: 5px; border-radius: 99px; background: #eeecf2; overflow: hidden; margin-top: 7px; }
.bb-train-progress > span { display: block; height: 100%; background: var(--bb-train-accent); border-radius: inherit; transition: width .2s; }
.bb-train-queue-head { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; gap: 10px; }
.bb-train-queue-head span { font-size: 12.5px; color: var(--bb-train-muted); font-weight: 600; }

/* Type tile */
.bb-train-tile { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; position: relative; flex: none; }
.bb-train-tile-label { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); font-size: 8.5px; font-weight: 700; letter-spacing: .03em; padding: 1px 4px; border-radius: 5px; background: #fff; border: 1px solid currentColor; line-height: 1.2; }
.bb-train-tone-red { background: #fdeeee; color: #d03b3b; }
.bb-train-tone-orange { background: #fff1e6; color: #d86a12; }
.bb-train-tone-amber { background: #fff7df; color: #b07b05; }
.bb-train-tone-green { background: #eaf7ee; color: #23864a; }
.bb-train-tone-blue { background: #ebf2ff; color: #2f62d8; }
.bb-train-tone-violet { background: color-mix(in srgb, var(--bb-train-accent) 16%, #fff); color: color-mix(in srgb, var(--bb-train-accent) 75%, #2a1660); }
.bb-train-tone-grey { background: #f0eff3; color: #57535f; }

/* API form */
.bb-train-form { display: flex; flex-direction: column; gap: 18px; }
.bb-train-fieldset { border: 1px solid var(--bb-train-border); border-radius: 14px; padding: 14px; margin: 0; min-width: 0; }
.bb-train-fieldset legend { padding: 0 6px; font-size: 12.5px; font-weight: 650; color: #34313c; }
.bb-train-kv { display: flex; flex-direction: column; gap: 8px; }
.bb-train-kv-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) auto; gap: 8px; align-items: center; }
.bb-train-kv-value { position: relative; min-width: 0; }
.bb-train-kv-value .bb-train-input { padding-right: 40px; }
.bb-train-kv-value .bb-train-reveal { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); border: 0; width: 30px; height: 30px; background: transparent; }
.bb-train-kv-empty { font-size: 12.5px; color: var(--bb-train-muted); }
.bb-train-disclosure { appearance: none; width: 100%; border: 0; background: transparent; padding: 0; font: inherit; display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; text-align: left; color: var(--bb-train-text); border-radius: 8px; }
.bb-train-disclosure svg { transition: transform .2s; color: var(--bb-train-muted); flex: none; }
.bb-train-disclosure[aria-expanded="true"] svg { transform: rotate(180deg); }
.bb-train-disclosure-body { margin-top: 14px; }
.bb-train-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.bb-train-actions .bb-train-spacer { flex: 1; }

/* Test result */
.bb-train-result { border: 1px solid var(--bb-train-border); border-radius: 14px; overflow: hidden; }
.bb-train-result-head { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding: 12px 14px; background: var(--bb-train-soft); border-bottom: 1px solid var(--bb-train-border); font-size: 13px; }
.bb-train-result-head strong { font-weight: 650; }
.bb-train-result-body { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.bb-train-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bb-train-chip { appearance: none; border: 1px solid var(--bb-train-border); background: #fff; border-radius: 99px; padding: 4px 10px; font: inherit; font-size: 12px; cursor: pointer; color: #34313c; }
.bb-train-mono.bb-train-chip { font-size: 11.5px; }
.bb-train-chip:hover { border-color: var(--bb-train-accent); background: color-mix(in srgb, var(--bb-train-accent) 8%, #fff); }
.bb-train-chip.is-used { background: color-mix(in srgb, var(--bb-train-accent) 14%, #fff); border-color: color-mix(in srgb, var(--bb-train-accent) 45%, #fff); }
.bb-train-preview { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.bb-train-preview li { border: 1px solid var(--bb-train-border); border-radius: 12px; padding: 10px 12px; font-size: 13px; }
.bb-train-preview-title { font-weight: 600; margin-bottom: 4px; }
.bb-train-preview-text { color: #4a4753; white-space: pre-wrap; word-break: break-word; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
.bb-train-target { font-size: 12px; color: var(--bb-train-muted); }
.bb-train-target strong { color: var(--bb-train-text); }

/* Sources list */
.bb-train-list-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.bb-train-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bb-train-search { position: relative; }
.bb-train-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--bb-train-muted); pointer-events: none; }
.bb-train-search .bb-train-input { padding-left: 34px; width: 220px; }
.bb-train-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--bb-train-soft); border: 1px solid var(--bb-train-border); border-radius: 11px; }
.bb-train-seg button { appearance: none; border: 0; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--bb-train-muted); padding: 6px 10px; border-radius: 8px; cursor: pointer; }
.bb-train-seg button[aria-pressed="true"] { background: #fff; color: var(--bb-train-text); box-shadow: 0 0 0 1px var(--bb-train-border); }
.bb-train-table { width: 100%; }
.bb-train-row { display: grid; grid-template-columns: minmax(0, 2.4fr) 120px 128px 70px 70px 104px 130px; gap: 12px; align-items: center; padding: 12px 10px; border-top: 1px solid var(--bb-train-border); }
.bb-train-row.is-head { border-top: 0; padding-top: 0; padding-bottom: 8px; font-size: 11.5px; font-weight: 650; color: var(--bb-train-muted); text-transform: uppercase; letter-spacing: .04em; }
.bb-train-row:not(.is-head):hover { background: #fcfbfd; }
.bb-train-src { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bb-train-src-name { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-train-src-sub { font-size: 12px; color: var(--bb-train-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.bb-train-num { font-variant-numeric: tabular-nums; font-size: 13.5px; }
.bb-train-cell-label { display: none; }
.bb-train-muted { color: var(--bb-train-muted); font-size: 13px; }
.bb-train-row-actions { display: flex; gap: 6px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
.bb-train-confirm { display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap; font-size: 12.5px; }
.bb-train-row-error { grid-column: 1 / -1; font-size: 12px; color: #b42323; background: #fff6f6; border: 1px solid #f6d9d9; padding: 7px 10px; border-radius: 10px; margin-top: -2px; word-break: break-word; }

/* Audience */
.bb-train-audience-field { max-width: 420px; }
.bb-train-aud { position: relative; display: inline-flex; align-items: center; width: fit-content; max-width: 100%; }
.bb-train-aud select {
  appearance: none; font: inherit; font-size: 12px; font-weight: 600; border: 1px solid transparent; border-radius: 99px;
  padding: 4px 24px 4px 10px; cursor: pointer; max-width: 100%; background-color: transparent; color: inherit;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
}
.bb-train-aud select:hover:not(:disabled) { border-color: currentColor; }
.bb-train-aud select:focus-visible { outline: 2px solid var(--bb-train-accent); outline-offset: 2px; }
.bb-train-aud select:disabled { cursor: progress; opacity: .7; }
.bb-train-aud .bb-train-aud-busy { position: absolute; right: -20px; color: var(--bb-train-muted); display: inline-flex; }
.bb-train-aud.is-public { background: #e9f7ee; color: #1f7a42; border-radius: 99px; }
.bb-train-aud.is-customer { background: #ebf2ff; color: #2f62d8; border-radius: 99px; }
.bb-train-aud.is-vendor { background: #fff1e6; color: #b45a0c; border-radius: 99px; }
.bb-train-aud.is-internal { background: color-mix(in srgb, var(--bb-train-accent) 15%, #fff); color: color-mix(in srgb, var(--bb-train-accent) 70%, #2a1660); border-radius: 99px; }
.bb-train-aud.is-admin { background: #fdecec; color: #b42323; border-radius: 99px; }
.bb-train-aud select option { color: var(--bb-train-text); background: #fff; }

/* Status pill */
.bb-train-status { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 99px; font-size: 12px; font-weight: 600; white-space: nowrap; width: fit-content; }
.bb-train-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.bb-train-status.is-queued { background: #f1f0f4; color: #5c5966; }
.bb-train-status.is-processing { background: color-mix(in srgb, var(--bb-train-accent) 15%, #fff); color: color-mix(in srgb, var(--bb-train-accent) 70%, #2a1660); }
.bb-train-status.is-processing .bb-train-status-dot { animation: bb-train-pulse 1.1s ease-in-out infinite; }
.bb-train-status.is-completed { background: #e9f7ee; color: #1f7a42; }
.bb-train-status.is-failed { background: #fdecec; color: #b42323; cursor: help; }
.bb-train-tooltip { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 5; width: max-content; max-width: 280px; white-space: normal; background: #17161c; color: #fff; font-weight: 500; font-size: 12px; line-height: 1.4; padding: 8px 10px; border-radius: 9px; box-shadow: 0 10px 24px rgba(0,0,0,.18); opacity: 0; visibility: hidden; transform: translateY(4px); transition: opacity .15s, transform .15s, visibility .15s; pointer-events: none; }
.bb-train-status:hover .bb-train-tooltip, .bb-train-status:focus .bb-train-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

.bb-train-empty { text-align: center; padding: 38px 16px; color: var(--bb-train-muted); }
.bb-train-empty-icon { width: 52px; height: 52px; border-radius: 16px; margin: 0 auto 12px; display: grid; place-items: center; background: var(--bb-train-soft); border: 1px solid var(--bb-train-border); color: var(--bb-train-accent); }
.bb-train-empty h3 { margin: 0 0 4px; color: var(--bb-train-text); font-size: 15px; font-weight: 650; }
.bb-train-empty p { margin: 0; font-size: 13px; }
.bb-train-skeleton { height: 54px; border-radius: 12px; background: linear-gradient(90deg, #f3f2f6 0%, #faf9fb 50%, #f3f2f6 100%); background-size: 200% 100%; animation: bb-train-shimmer 1.3s linear infinite; margin-top: 8px; }

.bb-train-spin { animation: bb-train-rotate .8s linear infinite; }
@keyframes bb-train-rotate { to { transform: rotate(360deg); } }
@keyframes bb-train-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.7); } }
@keyframes bb-train-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .bb-train-spin, .bb-train-status.is-processing .bb-train-status-dot, .bb-train-skeleton { animation: none; }
}

/* Responsive */
@media (max-width: 980px) {
  .bb-train-row { grid-template-columns: minmax(0, 1fr) 112px 120px 64px 64px 120px; }
  .bb-train-col-synced { display: none; }
}
@media (max-width: 760px) {
  .bb-train-root { padding: 14px; }
  .bb-train-card { padding: 16px; border-radius: 16px; }
  .bb-train-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
  .bb-train-grid, .bb-train-grid-3 { grid-template-columns: minmax(0, 1fr); }
  .bb-train-span-2 { grid-column: auto; }
  .bb-train-row.is-head { display: none; }
  .bb-train-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 12px; padding: 14px 4px; }
  .bb-train-row > .bb-train-src { grid-column: 1 / -1; }
  .bb-train-col-synced { display: block; }
  .bb-train-cell-label { display: block; font-size: 11px; color: var(--bb-train-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
  .bb-train-row-actions, .bb-train-confirm { grid-column: 1 / -1; justify-content: flex-start; }
  .bb-train-list-head { align-items: stretch; }
  .bb-train-toolbar { width: 100%; }
  .bb-train-search { flex: 1; min-width: 0; }
  .bb-train-search .bb-train-input { width: 100%; }
}
@media (max-width: 480px) {
  .bb-train-root { padding: 10px; }
  .bb-train-title { font-size: 22px; }
  .bb-train-stat { padding: 10px; }
  .bb-train-stat-value { font-size: 16px; }
  .bb-train-url-row { grid-template-columns: 88px minmax(0, 1fr); }
  .bb-train-kv-row { grid-template-columns: minmax(0, 1fr) auto; }
  .bb-train-kv-row .bb-train-kv-value { grid-column: 1 / 2; grid-row: 2; }
  .bb-train-kv-row .bb-train-icon-btn { grid-row: 1 / span 2; grid-column: 2; }
  .bb-train-tabs { width: 100%; }
  .bb-train-tab { flex: 1; justify-content: center; padding: 8px 6px; gap: 5px; font-size: 12.5px; }
  .bb-train-seg { width: 100%; order: 3; }
  .bb-train-seg button { flex: 1; }
}
`;

function useInjectedStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = trainingCss;
      document.head.appendChild(style);
    }
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement('link');
      link.id = FONT_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function TypeTile({ source }: { source: { kind: string; source_type?: string; filename?: string | null } }) {
  const v = sourceVisual(source);
  return (
    <span className={`bb-train-tile bb-train-tone-${v.tone}`} aria-hidden="true">
      <Icon name={v.icon} size={18} />
      <span className="bb-train-tile-label">{v.label}</span>
    </span>
  );
}

function StatusPill({ source }: { source: TrainingSource }) {
  const tipId = useId();
  const labels: Record<string, string> = {
    queued: 'Queued',
    processing: 'Processing',
    completed: 'Trained',
    failed: 'Failed'
  };
  const status = source.status || 'queued';
  const failed = status === 'failed';
  return (
    <span
      className={`bb-train-status is-${status}`}
      tabIndex={failed ? 0 : undefined}
      aria-describedby={failed ? tipId : undefined}
    >
      {status === 'completed' ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
      {failed ? <Icon name="alert" size={13} strokeWidth={2.2} /> : null}
      {status === 'queued' || status === 'processing' ? <span className="bb-train-status-dot" /> : null}
      {labels[status] || status}
      {failed ? (
        <span role="tooltip" id={tipId} className="bb-train-tooltip">
          {source.error_message || 'Training failed. Try syncing or re-uploading this source.'}
        </span>
      ) : null}
    </span>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
  action
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className={`bb-train-banner is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info'} size={17} />
      <div className="bb-train-banner-body">{children}</div>
      {action}
      {onDismiss ? (
        <button type="button" className="bb-train-icon-btn" style={{ width: 28, height: 28, border: 0, background: 'transparent' }} onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}

function AudienceField({
  value,
  onChange,
  disabled
}: {
  value: TrainingAudience;
  onChange: (value: TrainingAudience) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const option = audienceOption(value);
  return (
    <div className="bb-train-field bb-train-audience-field">
      <label className="bb-train-label" htmlFor={id}>
        Audience · who can see this
      </label>
      <select
        id={id}
        className="bb-train-input"
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value as TrainingAudience)}
      >
        {AUDIENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="bb-train-hint" id={`${id}-hint`}>
        {option?.help} You can change this later in the sources list.
      </span>
    </div>
  );
}

interface KvRow {
  id: string;
  key: string;
  value: string;
  revealed?: boolean;
}

function KeyValueEditor({
  rows,
  onChange,
  masked,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  groupLabel
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  masked?: boolean;
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  groupLabel: string;
}) {
  const update = (id: string, patch: Partial<KvRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="bb-train-kv">
      {rows.length === 0 ? <div className="bb-train-kv-empty">None added.</div> : null}
      {rows.map((row, i) => (
        <div className="bb-train-kv-row" key={row.id}>
          <input
            className="bb-train-input bb-train-mono"
            value={row.key}
            placeholder={keyPlaceholder}
            aria-label={`${groupLabel} ${i + 1} name`}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => update(row.id, { key: e.target.value })}
          />
          <div className="bb-train-kv-value">
            <input
              className="bb-train-input bb-train-mono"
              value={row.value}
              placeholder={valuePlaceholder}
              type={masked && !row.revealed ? 'password' : 'text'}
              aria-label={`${groupLabel} ${i + 1} value`}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(e) => update(row.id, { value: e.target.value })}
              style={masked ? undefined : { paddingRight: 12 }}
            />
            {masked ? (
              <button
                type="button"
                className="bb-train-icon-btn bb-train-reveal"
                onClick={() => update(row.id, { revealed: !row.revealed })}
                aria-label={row.revealed ? `Hide ${groupLabel.toLowerCase()} ${i + 1} value` : `Show ${groupLabel.toLowerCase()} ${i + 1} value`}
                aria-pressed={!!row.revealed}
              >
                <Icon name={row.revealed ? 'eyeOff' : 'eye'} size={15} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="bb-train-icon-btn"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            aria-label={`Remove ${groupLabel.toLowerCase()} ${i + 1}`}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
      <div>
        <button
          type="button"
          className="bb-train-btn bb-train-btn-ghost bb-train-btn-sm"
          onClick={() => onChange([...rows, { id: nextId('kv'), key: '', value: '' }])}
        >
          <Icon name="plus" size={14} /> {addLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload tab                                                          */
/* ------------------------------------------------------------------ */

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  message?: string;
}

function UploadTab({
  trainFile,
  announce
}: {
  trainFile: ReturnType<typeof useBrainboxTraining>['trainFile'];
  announce: (msg: string) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [over, setOver] = useState(false);
  const [audience, setAudience] = useState<TrainingAudience>(DEFAULT_AUDIENCE);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

  const patch = useCallback((id: string, p: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const handleFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (!files.length) return;
      const newItems: UploadItem[] = files.map((file) => {
        const ext = fileExtension(file.name);
        let message: string | undefined;
        if (!ACCEPTED_EXTENSIONS.includes(ext)) {
          message = `Unsupported file type${ext ? ` (${ext})` : ''}. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`;
        } else if (file.size > MAX_FILE_BYTES) {
          message = `File is ${formatBytes(file.size)} — the limit is 25 MB.`;
        } else if (file.size === 0) {
          message = 'File is empty.';
        }
        return { id: nextId('up'), file, progress: 0, status: message ? 'error' : 'uploading', message };
      });
      setItems((prev) => [...newItems, ...prev]);
      newItems.forEach((item) => {
        if (item.status === 'error') {
          announce(`${item.file.name} rejected: ${item.message}`);
          return;
        }
        trainFile(item.file, { audience, onUploadProgress: (p) => patch(item.id, { progress: p }) })
          .then(() => {
            patch(item.id, { status: 'done', progress: 100, message: 'Uploaded — training queued' });
            announce(`${item.file.name} uploaded. Training queued.`);
          })
          .catch((err) => {
            const msg = toBrainboxError(err).message;
            patch(item.id, { status: 'error', message: msg });
            announce(`${item.file.name} failed to upload: ${msg}`);
          });
      });
    },
    [trainFile, patch, announce, audience]
  );

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    handleFiles(e.dataTransfer?.files ?? null);
  };

  const finished = items.filter((i) => i.status !== 'uploading').length;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <AudienceField value={audience} onChange={setAudience} />
      </div>
      <label
        htmlFor={inputId}
        className={`bb-train-drop${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!over) setOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOver(false);
        }}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          aria-describedby={hintId}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <span className="bb-train-drop-icon">
          <Icon name="upload" size={22} />
        </span>
        <span className="bb-train-drop-title">
          Drop files here or <u>browse</u>
        </span>
        <span className="bb-train-drop-meta" id={hintId}>
          PDF, XML, TXT, MD, CSV, JSON or DOCX · up to 25 MB each · multiple files allowed
        </span>
      </label>

      {items.length > 0 ? (
        <>
          <div className="bb-train-queue-head">
            <span>
              {finished}/{items.length} processed
            </span>
            {finished > 0 ? (
              <button
                type="button"
                className="bb-train-btn bb-train-btn-ghost bb-train-btn-sm"
                onClick={() => setItems((prev) => prev.filter((i) => i.status === 'uploading'))}
              >
                Clear finished
              </button>
            ) : null}
          </div>
          <ul className="bb-train-queue" aria-label="Uploads">
            {items.map((item) => (
              <li key={item.id} className="bb-train-queue-item">
                <TypeTile source={{ kind: 'file', filename: item.file.name }} />
                <div style={{ minWidth: 0 }}>
                  <div className="bb-train-queue-name" title={item.file.name}>
                    {item.file.name}
                  </div>
                  <div className={`bb-train-queue-meta${item.status === 'error' ? ' is-error' : ''}`}>
                    {formatBytes(item.file.size)}
                    {' · '}
                    {item.status === 'uploading' ? `Uploading ${item.progress}%` : item.message}
                  </div>
                  {item.status === 'uploading' ? (
                    <div
                      className="bb-train-progress"
                      role="progressbar"
                      aria-label={`Uploading ${item.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.progress}
                    >
                      <span style={{ width: `${Math.max(item.progress, 3)}%` }} />
                    </div>
                  ) : null}
                </div>
                <span aria-hidden="true" style={{ color: item.status === 'error' ? '#b42323' : item.status === 'done' ? '#1f7a42' : 'var(--bb-train-accent)' }}>
                  <Icon name={item.status === 'error' ? 'alert' : item.status === 'done' ? 'check' : 'loader'} size={18} />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connect API tab                                                     */
/* ------------------------------------------------------------------ */

type MappingKey = 'question_field' | 'answer_field' | 'title_field' | 'id_field' | 'messages_field' | 'extra_fields';

interface ApiFormState {
  name: string;
  audience: TrainingAudience;
  url: string;
  method: 'GET' | 'POST';
  headers: KvRow[];
  query: KvRow[];
  body: string;
  data_path: string;
  source_type: ApiSourceType;
  mapping: Record<MappingKey, string>;
  pagination: { type: ApiSourcePagination['type']; page_param: string; cursor_path: string; cursor_param: string; max_pages: string };
}

const emptyApiForm = (): ApiFormState => ({
  name: '',
  audience: DEFAULT_AUDIENCE,
  url: '',
  method: 'GET',
  headers: [{ id: nextId('kv'), key: 'Authorization', value: '' }],
  query: [],
  body: '',
  data_path: '',
  source_type: 'support_tickets',
  mapping: { question_field: '', answer_field: '', title_field: '', id_field: '', messages_field: '', extra_fields: '' },
  pagination: { type: 'none', page_param: 'page', cursor_path: '', cursor_param: 'cursor', max_pages: '10' }
});

function mappingLabels(type: ApiSourceType): Record<MappingKey, { label: string; hint: string; placeholder: string }> {
  const tickets = type === 'support_tickets';
  return {
    question_field: {
      label: tickets ? 'Customer issue field' : 'Question / content field',
      hint: tickets ? 'What the customer reported' : 'Main text of each record',
      placeholder: tickets ? 'description' : 'body'
    },
    answer_field: {
      label: tickets ? 'Our response field' : 'Answer field',
      hint: tickets ? 'How your team resolved it' : 'Optional answer / resolution',
      placeholder: tickets ? 'resolution' : 'answer'
    },
    title_field: { label: 'Title field', hint: 'Subject or headline', placeholder: 'subject' },
    id_field: { label: 'ID field', hint: 'Unique id, used to de-duplicate on sync', placeholder: 'id' },
    messages_field: {
      label: 'Conversation / messages field',
      hint: 'Array of replies in the thread',
      placeholder: 'comments'
    },
    extra_fields: { label: 'Extra fields', hint: 'Comma-separated, kept as context', placeholder: 'status, priority, tags' }
  };
}

const MAPPING_ORDER: MappingKey[] = ['question_field', 'answer_field', 'title_field', 'id_field', 'messages_field', 'extra_fields'];

function buildApiConfig(form: ApiFormState): { config?: ApiSourceConfig; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Give this source a name.';
  const url = form.url.trim();
  if (!url) errors.url = 'Enter the API URL.';
  else if (!/^https?:\/\/\S+$/i.test(url)) errors.url = 'URL must start with http:// or https://';

  let body: any = undefined;
  if (form.method === 'POST' && form.body.trim()) {
    try {
      body = JSON.parse(form.body);
    } catch {
      errors.body = 'Body must be valid JSON.';
    }
  }

  const toRecord = (rows: KvRow[]) => {
    const out: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.key.trim()) out[r.key.trim()] = r.value;
    });
    return Object.keys(out).length ? out : undefined;
  };

  const mapping: ApiSourceMapping = {};
  (['question_field', 'answer_field', 'title_field', 'id_field', 'messages_field'] as const).forEach((k) => {
    const v = form.mapping[k].trim();
    if (v) mapping[k] = v;
  });
  const extras = form.mapping.extra_fields
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extras.length) mapping.extra_fields = extras;

  let pagination: ApiSourcePagination | undefined;
  if (form.pagination.type !== 'none') {
    const maxPages = parseInt(form.pagination.max_pages, 10);
    if (form.pagination.max_pages && (Number.isNaN(maxPages) || maxPages < 1)) errors.max_pages = 'Must be a positive number.';
    pagination = { type: form.pagination.type };
    if (!Number.isNaN(maxPages) && maxPages > 0) pagination.max_pages = maxPages;
    if (form.pagination.type === 'page') {
      if (form.pagination.page_param.trim()) pagination.page_param = form.pagination.page_param.trim();
    } else {
      if (!form.pagination.cursor_path.trim()) errors.cursor_path = 'Where to find the next cursor in the response.';
      else pagination.cursor_path = form.pagination.cursor_path.trim();
      if (form.pagination.cursor_param.trim()) pagination.cursor_param = form.pagination.cursor_param.trim();
    }
  }

  if (Object.keys(errors).length) return { errors };
  const config: ApiSourceConfig = {
    name: form.name.trim(),
    audience: form.audience,
    url,
    method: form.method,
    source_type: form.source_type
  };
  const headers = toRecord(form.headers);
  const query = toRecord(form.query);
  if (headers) config.headers = headers;
  if (query) config.query = query;
  if (body !== undefined) config.body = body;
  if (form.data_path.trim()) config.data_path = form.data_path.trim();
  if (Object.keys(mapping).length) config.mapping = mapping;
  if (pagination) config.pagination = pagination;
  return { config, errors };
}

function ApiTab({
  testApiSource,
  addApiSource,
  announce
}: {
  testApiSource: ReturnType<typeof useBrainboxTraining>['testApiSource'];
  addApiSource: ReturnType<typeof useBrainboxTraining>['addApiSource'];
  announce: (msg: string) => void;
}) {
  const [form, setForm] = useState<ApiFormState>(emptyApiForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mappingOpen, setMappingOpen] = useState(false);
  const [paginationOpen, setPaginationOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<ApiSourceTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [targetField, setTargetField] = useState<MappingKey | null>(null);
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  const labels = mappingLabels(form.source_type);

  const set = <K extends keyof ApiFormState>(key: K, value: ApiFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(null);
  };
  const setMapping = (key: MappingKey, value: string) => setForm((f) => ({ ...f, mapping: { ...f.mapping, [key]: value } }));
  const setPagination = (patch: Partial<ApiFormState['pagination']>) =>
    setForm((f) => ({ ...f, pagination: { ...f.pagination, ...patch } }));

  const validate = () => {
    const { config, errors: errs } = buildApiConfig(form);
    setErrors(errs);
    if (errs.max_pages || errs.cursor_path) setPaginationOpen(true);
    return config;
  };

  const runTest = async () => {
    const config = validate();
    if (!config) return;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await testApiSource(config);
      setTestResult(res);
      if (res.ok) announce(`Connection succeeded. ${res.records_found} records found.`);
      else announce(`Connection test failed${res.error ? `: ${res.error}` : ''}`);
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setTestError(msg);
      announce(`Connection test failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const config = validate();
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await addApiSource(config);
      const name = res?.source?.name || config.name;
      setSaved(`"${name}" saved. Training has started — progress appears in the sources list below.`);
      announce(`${name} saved. Training started.`);
      setForm(emptyApiForm());
      setTestResult(null);
      setErrors({});
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setSaveError(msg);
      announce(`Saving the API source failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const applyField = (field: string) => {
    let target = targetField;
    if (!target) target = MAPPING_ORDER.find((k) => k !== 'extra_fields' && !form.mapping[k].trim()) || 'extra_fields';
    if (target === 'extra_fields') {
      const existing = form.mapping.extra_fields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!existing.includes(field)) setMapping('extra_fields', [...existing, field].join(', '));
    } else {
      setMapping(target, field);
      // advance to the next empty field for fast click-to-map
      const next = MAPPING_ORDER.find((k) => k !== target && k !== 'extra_fields' && !form.mapping[k].trim());
      setTargetField(next || null);
    }
    setMappingOpen(true);
    announce(`Mapped ${field} to ${labels[target].label}.`);
  };

  const usedFields = new Set<string>();
  MAPPING_ORDER.forEach((k) => {
    const values = k === 'extra_fields' ? form.mapping.extra_fields.split(',') : [form.mapping[k]];
    values.forEach((v) => {
      if (v.trim()) usedFields.add(v.trim());
    });
  });

  const errorProps = (k: string) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${fid(k)}-err` } : {};

  return (
    <form
      className="bb-train-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="bb-train-grid">
        <div className="bb-train-field">
          <label className="bb-train-label" htmlFor={fid('name')}>
            Source name
          </label>
          <input
            id={fid('name')}
            className="bb-train-input"
            value={form.name}
            placeholder="e.g. Zendesk tickets"
            onChange={(e) => set('name', e.target.value)}
            {...errorProps('name')}
          />
          {errors.name ? (
            <span className="bb-train-field-error" id={`${fid('name')}-err`}>
              {errors.name}
            </span>
          ) : null}
        </div>
        <div className="bb-train-field">
          <label className="bb-train-label" htmlFor={fid('type')}>
            Source type
          </label>
          <select
            id={fid('type')}
            className="bb-train-input"
            value={form.source_type}
            onChange={(e) => set('source_type', e.target.value as ApiSourceType)}
          >
            <option value="support_tickets">Customer support tickets</option>
            <option value="api_generic">Generic API</option>
          </select>
          <span className="bb-train-hint">
            {form.source_type === 'support_tickets'
              ? 'Each ticket becomes a customer issue + your team’s response.'
              : 'Each record becomes a document the AI can learn from.'}
          </span>
        </div>
        <div className="bb-train-span-2">
          <AudienceField value={form.audience} onChange={(v) => set('audience', v)} />
        </div>
        <div className="bb-train-field bb-train-span-2">
          <label className="bb-train-label" htmlFor={fid('url')}>
            Endpoint URL
          </label>
          <div className="bb-train-url-row">
            <select
              className="bb-train-input"
              aria-label="HTTP method"
              value={form.method}
              onChange={(e) => set('method', e.target.value as 'GET' | 'POST')}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input
              id={fid('url')}
              className="bb-train-input bb-train-mono"
              value={form.url}
              inputMode="url"
              placeholder="https://yourcompany.zendesk.com/api/v2/tickets.json"
              spellCheck={false}
              onChange={(e) => set('url', e.target.value)}
              {...errorProps('url')}
            />
          </div>
          {errors.url ? (
            <span className="bb-train-field-error" id={`${fid('url')}-err`}>
              {errors.url}
            </span>
          ) : null}
        </div>
      </div>

      <div className="bb-train-grid">
        <fieldset className="bb-train-fieldset">
          <legend>Headers</legend>
          <KeyValueEditor
            rows={form.headers}
            onChange={(rows) => set('headers', rows)}
            masked
            groupLabel="Header"
            keyPlaceholder="Authorization"
            valuePlaceholder="Bearer …"
            addLabel="Add header"
          />
          <p className="bb-train-hint" style={{ margin: '10px 0 0' }}>
            Values are hidden on screen and sent only to your Brainbox server.
          </p>
        </fieldset>
        <fieldset className="bb-train-fieldset">
          <legend>Query parameters</legend>
          <KeyValueEditor
            rows={form.query}
            onChange={(rows) => set('query', rows)}
            groupLabel="Query parameter"
            keyPlaceholder="status"
            valuePlaceholder="solved"
            addLabel="Add parameter"
          />
        </fieldset>
      </div>

      <div className="bb-train-grid">
        <div className="bb-train-field">
          <label className="bb-train-label" htmlFor={fid('path')}>
            Data path <span className="bb-train-muted">(optional)</span>
          </label>
          <input
            id={fid('path')}
            className="bb-train-input bb-train-mono"
            value={form.data_path}
            placeholder="tickets  or  data.items"
            spellCheck={false}
            onChange={(e) => set('data_path', e.target.value)}
          />
          <span className="bb-train-hint">Dot-path to the list of records in the JSON response.</span>
        </div>
        {form.method === 'POST' ? (
          <div className="bb-train-field">
            <label className="bb-train-label" htmlFor={fid('body')}>
              JSON body <span className="bb-train-muted">(optional)</span>
            </label>
            <textarea
              id={fid('body')}
              className="bb-train-input bb-train-mono"
              style={{ minHeight: 90 }}
              value={form.body}
              placeholder={'{\n  "status": "closed"\n}'}
              spellCheck={false}
              onChange={(e) => set('body', e.target.value)}
              {...errorProps('body')}
            />
            {errors.body ? (
              <span className="bb-train-field-error" id={`${fid('body')}-err`}>
                {errors.body}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="bb-train-fieldset">
        <button
          type="button"
          className="bb-train-disclosure"
          aria-expanded={mappingOpen}
          aria-controls={fid('mapping')}
          onClick={() => setMappingOpen((o) => !o)}
        >
          <span>
            <span className="bb-train-label">Field mapping</span>
            <span className="bb-train-hint" style={{ display: 'block', marginTop: 2 }}>
              Optional — we auto-detect common fields. Test the connection, then click a detected field to map it.
            </span>
          </span>
          <Icon name="chevron" />
        </button>
        {mappingOpen ? (
          <div className="bb-train-disclosure-body bb-train-grid bb-train-grid-3" id={fid('mapping')}>
            {MAPPING_ORDER.map((k) => (
              <div className="bb-train-field" key={k}>
                <label className="bb-train-label" htmlFor={fid(`map-${k}`)}>
                  {labels[k].label}
                </label>
                <input
                  id={fid(`map-${k}`)}
                  className="bb-train-input bb-train-mono"
                  value={form.mapping[k]}
                  placeholder={labels[k].placeholder}
                  spellCheck={false}
                  onFocus={() => setTargetField(k)}
                  onChange={(e) => setMapping(k, e.target.value)}
                />
                <span className="bb-train-hint">{labels[k].hint}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="bb-train-fieldset">
        <button
          type="button"
          className="bb-train-disclosure"
          aria-expanded={paginationOpen}
          aria-controls={fid('pagination')}
          onClick={() => setPaginationOpen((o) => !o)}
        >
          <span>
            <span className="bb-train-label">Pagination</span>
            <span className="bb-train-hint" style={{ display: 'block', marginTop: 2 }}>
              {form.pagination.type === 'none'
                ? 'Single request (no pagination).'
                : form.pagination.type === 'page'
                  ? 'Page-number pagination.'
                  : 'Cursor pagination.'}
            </span>
          </span>
          <Icon name="chevron" />
        </button>
        {paginationOpen ? (
          <div className="bb-train-disclosure-body bb-train-grid bb-train-grid-3" id={fid('pagination')}>
            <div className="bb-train-field">
              <label className="bb-train-label" htmlFor={fid('pg-type')}>
                Type
              </label>
              <select
                id={fid('pg-type')}
                className="bb-train-input"
                value={form.pagination.type}
                onChange={(e) => setPagination({ type: e.target.value as ApiSourcePagination['type'] })}
              >
                <option value="none">None</option>
                <option value="page">Page number</option>
                <option value="cursor">Cursor</option>
              </select>
            </div>
            {form.pagination.type === 'page' ? (
              <div className="bb-train-field">
                <label className="bb-train-label" htmlFor={fid('pg-param')}>
                  Page parameter
                </label>
                <input
                  id={fid('pg-param')}
                  className="bb-train-input bb-train-mono"
                  value={form.pagination.page_param}
                  onChange={(e) => setPagination({ page_param: e.target.value })}
                />
              </div>
            ) : null}
            {form.pagination.type === 'cursor' ? (
              <>
                <div className="bb-train-field">
                  <label className="bb-train-label" htmlFor={fid('pg-cpath')}>
                    Next-cursor path
                  </label>
                  <input
                    id={fid('pg-cpath')}
                    className="bb-train-input bb-train-mono"
                    value={form.pagination.cursor_path}
                    placeholder="meta.next_cursor"
                    onChange={(e) => setPagination({ cursor_path: e.target.value })}
                    {...errorProps('cursor_path')}
                  />
                  {errors.cursor_path ? (
                    <span className="bb-train-field-error" id={`${fid('cursor_path')}-err`}>
                      {errors.cursor_path}
                    </span>
                  ) : null}
                </div>
                <div className="bb-train-field">
                  <label className="bb-train-label" htmlFor={fid('pg-cparam')}>
                    Cursor parameter
                  </label>
                  <input
                    id={fid('pg-cparam')}
                    className="bb-train-input bb-train-mono"
                    value={form.pagination.cursor_param}
                    onChange={(e) => setPagination({ cursor_param: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {form.pagination.type !== 'none' ? (
              <div className="bb-train-field">
                <label className="bb-train-label" htmlFor={fid('pg-max')}>
                  Max pages
                </label>
                <input
                  id={fid('pg-max')}
                  className="bb-train-input"
                  inputMode="numeric"
                  value={form.pagination.max_pages}
                  onChange={(e) => setPagination({ max_pages: e.target.value })}
                  {...errorProps('max_pages')}
                />
                {errors.max_pages ? (
                  <span className="bb-train-field-error" id={`${fid('max_pages')}-err`}>
                    {errors.max_pages}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {testError ? <Banner tone="error" onDismiss={() => setTestError(null)}>{testError}</Banner> : null}

      {testResult ? (
        <div className="bb-train-result" aria-label="Connection test result">
          <div className="bb-train-result-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: testResult.ok ? '#1f7a42' : '#b42323', fontWeight: 650 }}>
              <Icon name={testResult.ok ? 'check' : 'alert'} size={16} />
              {testResult.ok ? 'Connection OK' : 'Connection failed'}
            </span>
            {testResult.status_code != null ? (
              <span>
                HTTP <strong>{testResult.status_code}</strong>
              </span>
            ) : null}
            <span>
              <strong>{formatNumber(testResult.records_found)}</strong> records found
            </span>
          </div>
          <div className="bb-train-result-body">
            {testResult.error ? <div className="bb-train-field-error">{testResult.error}</div> : null}
            {testResult.detected_fields?.length ? (
              <div>
                <div className="bb-train-label" style={{ marginBottom: 4 }}>
                  Detected fields
                </div>
                <div className="bb-train-target" style={{ marginBottom: 8 }}>
                  Click a field to map it to{' '}
                  <strong>
                    {targetField
                      ? labels[targetField].label
                      : labels[MAPPING_ORDER.find((k) => k !== 'extra_fields' && !form.mapping[k].trim()) || 'extra_fields'].label}
                  </strong>
                  . Focus a mapping input to change the target.
                </div>
                <div className="bb-train-chips">
                  {testResult.detected_fields.map((f) => (
                    <button
                      type="button"
                      key={f}
                      className={`bb-train-chip bb-train-mono${usedFields.has(f) ? ' is-used' : ''}`}
                      onClick={() => applyField(f)}
                      aria-pressed={usedFields.has(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {testResult.preview?.length ? (
              <div>
                <div className="bb-train-label" style={{ marginBottom: 8 }}>
                  Preview (first {Math.min(testResult.preview.length, 3)} normalized records)
                </div>
                <ul className="bb-train-preview">
                  {testResult.preview.slice(0, 3).map((p, i) => (
                    <li key={i}>
                      {p.title ? <div className="bb-train-preview-title">{p.title}</div> : null}
                      <div className="bb-train-preview-text">{p.text}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : testResult.ok ? (
              <div className="bb-train-muted">No records to preview. Check the data path and mapping.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {saveError ? <Banner tone="error" onDismiss={() => setSaveError(null)}>{saveError}</Banner> : null}
      {saved ? <Banner tone="success" onDismiss={() => setSaved(null)}>{saved}</Banner> : null}

      <div className="bb-train-actions">
        <button type="button" className="bb-train-btn bb-train-btn-ghost" onClick={() => void runTest()} disabled={testing || saving}>
          <Icon name={testing ? 'loader' : 'plug'} size={16} />
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <span className="bb-train-spacer" />
        <button type="submit" className="bb-train-btn bb-train-btn-primary" disabled={saving || testing}>
          <Icon name={saving ? 'loader' : 'sparkles'} size={16} />
          {saving ? 'Saving…' : 'Save & train'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Paste text tab                                                      */
/* ------------------------------------------------------------------ */

function TextTab({
  trainText,
  announce
}: {
  trainText: ReturnType<typeof useBrainboxTraining>['trainText'];
  announce: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<TrainingAudience>(DEFAULT_AUDIENCE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const uid = useId();

  const submit = async () => {
    if (!name.trim() || !content.trim()) {
      setError(!name.trim() ? 'Give this text a name.' : 'Paste some text to train on.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await trainText(name.trim(), content, audience);
      setSuccess(`"${name.trim()}" added. Training has started.`);
      announce(`${name.trim()} added. Training started.`);
      setName('');
      setContent('');
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setError(msg);
      announce(`Adding text failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <form
      className="bb-train-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="bb-train-field">
        <label className="bb-train-label" htmlFor={`${uid}-name`}>
          Name
        </label>
        <input
          id={`${uid}-name`}
          className="bb-train-input"
          value={name}
          placeholder="e.g. Refund policy"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <AudienceField value={audience} onChange={setAudience} />
      <div className="bb-train-field">
        <label className="bb-train-label" htmlFor={`${uid}-content`}>
          Content
        </label>
        <textarea
          id={`${uid}-content`}
          className="bb-train-input"
          style={{ minHeight: 200 }}
          value={content}
          placeholder="Paste FAQs, policies, product docs, canned responses…"
          onChange={(e) => setContent(e.target.value)}
        />
        <span className="bb-train-hint">
          {formatNumber(words)} words · {formatNumber(content.length)} characters
        </span>
      </div>
      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {success ? <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner> : null}
      <div className="bb-train-actions">
        <span className="bb-train-spacer" />
        <button type="submit" className="bb-train-btn bb-train-btn-primary" disabled={busy}>
          <Icon name={busy ? 'loader' : 'sparkles'} size={16} />
          {busy ? 'Adding…' : 'Train on this text'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Sources list                                                        */
/* ------------------------------------------------------------------ */

function SourcesList({
  training,
  announce,
  now,
  readOnly = false
}: {
  training: ReturnType<typeof useBrainboxTraining>;
  announce: (msg: string) => void;
  now: number;
  readOnly?: boolean;
}) {
  const { sources, loading, error, refresh, syncSource, deleteSource, updateSource } = training;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'sync' | 'delete' | 'audience' | undefined>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => {
      if (kind !== 'all' && s.kind !== kind) return false;
      if (!q) return true;
      return [s.name, s.filename, s.url, s.source_type].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [sources, query, kind]);

  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { all: sources.length, file: 0, api: 0, text: 0 };
    sources.forEach((s) => {
      if (s.kind in c) c[s.kind as KindFilter] += 1;
    });
    return c;
  }, [sources]);

  const doSync = async (s: TrainingSource) => {
    setBusy((b) => ({ ...b, [s.source_id]: 'sync' }));
    setActionError(null);
    try {
      await syncSource(s.source_id);
      announce(`Sync started for ${s.name}.`);
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setActionError(`Couldn't sync "${s.name}": ${msg}`);
      announce(`Sync failed for ${s.name}: ${msg}`);
    } finally {
      setBusy((b) => ({ ...b, [s.source_id]: undefined }));
    }
  };

  const doDelete = async (s: TrainingSource) => {
    setBusy((b) => ({ ...b, [s.source_id]: 'delete' }));
    setActionError(null);
    try {
      const res = await deleteSource(s.source_id);
      setConfirmId(null);
      announce(`${s.name} deleted${res?.documents_deleted != null ? `, ${res.documents_deleted} chunks removed` : ''}.`);
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setActionError(`Couldn't delete "${s.name}": ${msg}`);
      announce(`Delete failed for ${s.name}: ${msg}`);
    } finally {
      setBusy((b) => ({ ...b, [s.source_id]: undefined }));
    }
  };

  const doAudience = async (s: TrainingSource, audience: TrainingAudience) => {
    if (audience === s.audience) return;
    setBusy((b) => ({ ...b, [s.source_id]: 'audience' }));
    setActionError(null);
    try {
      await updateSource(s.source_id, { audience });
      announce(`${s.name} is now visible to: ${audienceOption(audience)?.label || audience}.`);
    } catch (err) {
      const msg = toBrainboxError(err).message;
      setActionError(`Couldn't change who can see "${s.name}": ${msg}`);
      announce(`Changing the audience of ${s.name} failed: ${msg}`);
    } finally {
      setBusy((b) => ({ ...b, [s.source_id]: undefined }));
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const subtitleFor = (s: TrainingSource) => {
    if (s.kind === 'api') return s.url || (s.source_type === 'support_tickets' ? 'Support tickets API' : 'API');
    if (s.kind === 'file') return s.filename || 'Uploaded file';
    return 'Pasted text';
  };

  const filters: { key: KindFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'file', label: 'Files' },
    { key: 'api', label: 'APIs' },
    { key: 'text', label: 'Text' }
  ];

  return (
    <section className="bb-train-card" aria-labelledby={`${searchId}-title`}>
      <div className="bb-train-list-head">
        <div>
          <h2 className="bb-train-section-title" id={`${searchId}-title`}>
            Training sources
          </h2>
          <p className="bb-train-section-sub">Every file, text snippet and API your AI has learned from.</p>
        </div>
        <div className="bb-train-toolbar">
          <div className="bb-train-search">
            <label htmlFor={searchId} className="bb-train-sr">
              Search sources
            </label>
            <Icon name="search" size={16} />
            <input
              id={searchId}
              type="search"
              className="bb-train-input"
              placeholder="Search sources…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="bb-train-seg" role="group" aria-label="Filter by kind">
            {filters.map((f) => (
              <button key={f.key} type="button" aria-pressed={kind === f.key} onClick={() => setKind(f.key)}>
                {f.label}
                {counts[f.key] ? ` ${counts[f.key]}` : ''}
              </button>
            ))}
          </div>
          <button type="button" className="bb-train-icon-btn" onClick={() => void manualRefresh()} aria-label="Refresh sources" disabled={refreshing}>
            <Icon name={refreshing ? 'loader' : 'refresh'} size={16} />
          </button>
        </div>
      </div>

      {actionError ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="error" onDismiss={() => setActionError(null)}>
            {actionError}
          </Banner>
        </div>
      ) : null}

      {loading && sources.length === 0 ? (
        <div aria-busy="true" aria-label="Loading sources">
          <div className="bb-train-skeleton" />
          <div className="bb-train-skeleton" />
          <div className="bb-train-skeleton" />
        </div>
      ) : error && sources.length === 0 ? (
        <div className="bb-train-empty">
          <div className="bb-train-empty-icon" style={{ color: '#b42323' }}>
            <Icon name="alert" size={22} />
          </div>
          <h3>Couldn’t load training sources</h3>
          <p>{error}</p>
          <button type="button" className="bb-train-btn bb-train-btn-ghost" style={{ marginTop: 14 }} onClick={() => void manualRefresh()}>
            <Icon name="refresh" size={15} /> Try again
          </button>
        </div>
      ) : sources.length === 0 ? (
        <div className="bb-train-empty">
          <div className="bb-train-empty-icon">
            <Icon name="database" size={22} />
          </div>
          <h3>No training sources yet</h3>
          <p>Upload a document, paste some text or connect your support system to start training.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bb-train-empty">
          <div className="bb-train-empty-icon">
            <Icon name="search" size={22} />
          </div>
          <h3>No matching sources</h3>
          <p>Try a different search or filter.</p>
        </div>
      ) : (
        <div className="bb-train-table" role="table" aria-label="Training sources">
          <div className="bb-train-row is-head" role="row">
            <span role="columnheader">Source</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Audience</span>
            <span role="columnheader">Chunks</span>
            <span role="columnheader">Records</span>
            <span role="columnheader" className="bb-train-col-synced">
              Last synced
            </span>
            <span role="columnheader" style={{ textAlign: 'right' }}>
              Actions
            </span>
          </div>
          {filtered.map((s) => {
            const rowBusy = busy[s.source_id];
            const confirming = confirmId === s.source_id;
            const active = s.status === 'queued' || s.status === 'processing';
            return (
              <div className="bb-train-row" role="row" key={s.source_id}>
                <div className="bb-train-src" role="cell">
                  <TypeTile source={s} />
                  <div style={{ minWidth: 0 }}>
                    <div className="bb-train-src-name" title={s.name}>
                      {s.name}
                    </div>
                    <div className="bb-train-src-sub" title={subtitleFor(s)}>
                      {subtitleFor(s)}
                    </div>
                  </div>
                </div>
                <div role="cell">
                  <span className="bb-train-cell-label">Status</span>
                  <StatusPill source={s} />
                </div>
                <div role="cell">
                  <span className="bb-train-cell-label">Audience</span>
                  {s.audience ? (
                    <span className={`bb-train-aud is-${s.audience}`} title={audienceOption(s.audience)?.help}>
                      <select
                        value={s.audience}
                        aria-label={`Who can see ${s.name}`}
                        disabled={!!rowBusy || readOnly}
                        onChange={(e) => void doAudience(s, e.target.value as TrainingAudience)}
                      >
                        {AUDIENCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.short}
                          </option>
                        ))}
                      </select>
                      {rowBusy === 'audience' ? (
                        <span className="bb-train-aud-busy" aria-hidden="true">
                          <Icon name="loader" size={13} />
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="bb-train-muted">—</span>
                  )}
                </div>
                <div role="cell">
                  <span className="bb-train-cell-label">Chunks</span>
                  <span className="bb-train-num">{active && !s.documents_count ? '—' : formatNumber(s.documents_count)}</span>
                </div>
                <div role="cell">
                  <span className="bb-train-cell-label">Records</span>
                  <span className="bb-train-num">{s.kind === 'api' ? formatNumber(s.records_count) : '—'}</span>
                </div>
                <div role="cell" className="bb-train-col-synced">
                  <span className="bb-train-cell-label">Last synced</span>
                  <span
                    className="bb-train-muted"
                    title={s.last_synced_at || s.created_at ? new Date((s.last_synced_at || s.created_at) as string).toLocaleString() : undefined}
                  >
                    {relativeTime(s.last_synced_at || s.created_at, now)}
                  </span>
                </div>
                {confirming ? (
                  <div className="bb-train-confirm" role="cell">
                    <span>Delete source and its chunks?</span>
                    <button
                      type="button"
                      className="bb-train-btn bb-train-btn-danger bb-train-btn-sm"
                      onClick={() => void doDelete(s)}
                      disabled={rowBusy === 'delete'}
                      autoFocus
                    >
                      {rowBusy === 'delete' ? <Icon name="loader" size={14} /> : null}
                      Delete
                    </button>
                    <button
                      type="button"
                      className="bb-train-btn bb-train-btn-ghost bb-train-btn-sm"
                      onClick={() => setConfirmId(null)}
                      disabled={rowBusy === 'delete'}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Escape') setConfirmId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : readOnly ? (
                  <div className="bb-train-row-actions" role="cell" />
                ) : (
                  <div className="bb-train-row-actions" role="cell">
                    {s.kind === 'api' ? (
                      <button
                        type="button"
                        className="bb-train-btn bb-train-btn-ghost bb-train-btn-sm"
                        onClick={() => void doSync(s)}
                        disabled={!!rowBusy || active}
                        aria-label={`Sync ${s.name}`}
                        title={active ? 'Already training' : 'Fetch latest records and retrain'}
                      >
                        <Icon name={rowBusy === 'sync' ? 'loader' : 'refresh'} size={14} />
                        Sync
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="bb-train-icon-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => setConfirmId(s.source_id)}
                      disabled={!!rowBusy}
                      aria-label={`Delete ${s.name}`}
                      title="Delete"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )}
                {s.status === 'failed' && s.error_message ? (
                  <div className="bb-train-row-error" role="cell">
                    {s.error_message}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* TrainingPanel                                                       */
/* ------------------------------------------------------------------ */

export function TrainingPanel({
  sdk,
  primaryColor,
  accentColor,
  backgroundColor,
  logoUrl,
  companyName,
  title = 'Train your AI',
  variant = 'default',
  readOnly = false
}: TrainingPanelProps) {
  useInjectedStyles();
  const training = useBrainboxTraining(sdk);
  const [tab, setTab] = useState<TabKey>('upload');
  const [liveMessage, setLiveMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [errorDismissed, setErrorDismissed] = useState(false);
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ upload: null, api: null, text: null });
  const uid = useId();

  const announce = useCallback((msg: string) => {
    // Reset first so repeated identical messages are still announced.
    setLiveMessage('');
    setTimeout(() => setLiveMessage(msg), 30);
  }, []);

  // Tick for relative timestamps.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Announce status transitions coming from polling.
  const prevStatuses = useRef<Record<string, string>>({});
  useEffect(() => {
    const prev = prevStatuses.current;
    const changes: string[] = [];
    training.sources.forEach((s) => {
      const before = prev[s.source_id];
      if (before && before !== s.status) {
        if (s.status === 'completed') changes.push(`${s.name} finished training.`);
        else if (s.status === 'failed') changes.push(`${s.name} failed to train.`);
        else if (s.status === 'processing') changes.push(`${s.name} is processing.`);
      }
    });
    const nextStatuses: Record<string, string> = {};
    training.sources.forEach((s) => {
      nextStatuses[s.source_id] = s.status;
    });
    prevStatuses.current = nextStatuses;
    if (changes.length) announce(changes.join(' '));
  }, [training.sources, announce]);

  useEffect(() => {
    if (training.error) setErrorDismissed(false);
  }, [training.error]);

  const lastSync = useMemo<string | null>(() => {
    let best = -Infinity;
    let bestIso: string | null = null;
    for (const s of training.sources) {
      if (!s.last_synced_at) continue;
      const t = new Date(s.last_synced_at).getTime();
      if (!Number.isNaN(t) && t > best) {
        best = t;
        bestIso = s.last_synced_at;
      }
    }
    return bestIso;
  }, [training.sources]);

  const activeCount = training.sources.filter((s) => s.status === 'queued' || s.status === 'processing').length;

  const style = {
    ...(primaryColor ? { '--bb-train-primary': primaryColor } : {}),
    ...(accentColor ? { '--bb-train-accent': accentColor } : {}),
    ...(backgroundColor ? { '--bb-train-bg': backgroundColor } : {})
  } as CSSProperties;

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.key === tab);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const key = TABS[next].key;
    setTab(key);
    tabRefs.current[key]?.focus();
  };

  const showBanner = training.error && !errorDismissed && training.sources.length > 0;

  return (
    <div className={`bb-train-root${variant === 'embedded' ? ' bb-train-embedded' : ''}`} style={style}>
      <div className="bb-train-sr" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <div className="bb-train-inner">
        <header className="bb-train-card bb-train-header">
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            {logoUrl || companyName ? (
              <div className="bb-train-brand">
                {logoUrl ? (
                  <img src={logoUrl} alt="" />
                ) : (
                  <span className="bb-train-brand-mark">
                    <Icon name="sparkles" size={15} />
                  </span>
                )}
                {companyName ? <span>{companyName}</span> : null}
              </div>
            ) : null}
            <h1 className="bb-train-title">{title}</h1>
            <p className="bb-train-subtitle">
              Teach your assistant with documents, knowledge snippets and live data from your tools — like past support
              tickets and how your team resolved them.
            </p>
          </div>
          <div className="bb-train-stats" aria-label="Training summary">
            <div className="bb-train-stat">
              <div className="bb-train-stat-label">
                <Icon name="database" size={14} /> Sources
              </div>
              <div className="bb-train-stat-value">{formatNumber(training.totals.sources || training.sources.length)}</div>
            </div>
            <div className="bb-train-stat">
              <div className="bb-train-stat-label">
                <Icon name="layers" size={14} /> Chunks
              </div>
              <div className="bb-train-stat-value">{formatNumber(training.totals.documents)}</div>
            </div>
            <div className="bb-train-stat">
              <div className="bb-train-stat-label">
                <Icon name="clock" size={14} /> Last sync
              </div>
              <div className="bb-train-stat-value" title={lastSync ? new Date(lastSync).toLocaleString() : undefined}>
                {activeCount ? `${activeCount} running` : relativeTime(lastSync, now)}
              </div>
            </div>
          </div>
        </header>

        {showBanner ? (
          <Banner
            tone="error"
            onDismiss={() => setErrorDismissed(true)}
            action={
              <button type="button" className="bb-train-btn bb-train-btn-ghost bb-train-btn-sm" onClick={() => void training.refresh()}>
                Retry
              </button>
            }
          >
            Couldn’t refresh training sources: {training.error}
          </Banner>
        ) : null}

        {readOnly ? null : (
        <section className="bb-train-card" aria-label="Add training data">
          <div className="bb-train-tabs" role="tablist" aria-label="Training method" onKeyDown={onTabKeyDown}>
            {TABS.map((t) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`${uid}-panel-${t.key}`}
                tabIndex={tab === t.key ? 0 : -1}
                className="bb-train-tab"
                onClick={() => setTab(t.key)}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>
          {TABS.map((t) => (
            <div
              key={t.key}
              className="bb-train-tabpanel"
              role="tabpanel"
              id={`${uid}-panel-${t.key}`}
              aria-labelledby={`${uid}-tab-${t.key}`}
              hidden={tab !== t.key}
            >
              {t.key === 'upload' ? <UploadTab trainFile={training.trainFile} announce={announce} /> : null}
              {t.key === 'api' ? (
                <ApiTab testApiSource={training.testApiSource} addApiSource={training.addApiSource} announce={announce} />
              ) : null}
              {t.key === 'text' ? <TextTab trainText={training.trainText} announce={announce} /> : null}
            </div>
          ))}
        </section>
        )}

        <SourcesList training={training} announce={announce} now={now} readOnly={readOnly} />
      </div>
    </div>
  );
}

export default TrainingPanel;
