/**
 * Answer tools: tables get a Table / Chart switch and a spreadsheet download; any answer can be
 * saved as a PDF (the browser's "Save as PDF" print dialog). No third-party libraries.
 */
import { useMemo, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** "₦45,000", "$1.2k", "12%", "(300)" → number; null when the cell isn't numeric. */
export function parseNumber(raw: string): number | null {
  let s = String(raw ?? '').replace(/[*_`]/g, '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^[^\d\-+.]+/, '').replace(/[%\s]+$/, '');
  const mult = /k$/i.test(s) ? 1e3 : /m$/i.test(s) ? 1e6 : /b$/i.test(s) ? 1e9 : 1;
  s = s.replace(/[kmb]$/i, '').replace(/,/g, '');
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s) * mult;
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Indexes of columns (after the first) where most cells are numbers. */
export function numericColumns(head: string[], rows: string[][]): number[] {
  if (rows.length < 2) return [];
  const cols: number[] = [];
  for (let c = 1; c < head.length; c++) {
    const vals = rows.map((r) => parseNumber(r[c] || ''));
    const ok = vals.filter((v) => v !== null).length;
    if (ok >= Math.max(2, Math.ceil(rows.length * 0.6))) cols.push(c);
  }
  return cols.slice(0, 4);
}

const plain = (s: string) => String(s ?? '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();

/* ------------------------------------------------------------------ */
/* Downloads                                                           */
/* ------------------------------------------------------------------ */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV with a BOM so Excel opens accents and currency signs correctly. */
export function downloadTableCsv(head: string[], rows: string[][], filename = 'table.csv') {
  const esc = (v: string) => {
    const s = plain(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [head, ...rows].map((r) => head.map((_, i) => esc(r[i] || '')).join(',')).join('\r\n');
  saveBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
}

const PRINT_CSS = `
body { font: 14px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 32px 40px; }
h1.doc-title { font-size: 18px; margin: 0 0 4px; } .doc-meta { color: #666; font-size: 12px; margin: 0 0 20px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; } th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; } th { background: #f3f6fd; }
pre { background: #272822; color: #f8f8f2; padding: 12px 14px; border-radius: 8px; overflow: hidden; white-space: pre-wrap; font: 12px/1.6 "SF Mono", Menlo, Consolas, monospace; }
code { font-family: "SF Mono", Menlo, Consolas, monospace; } .bb-tk-com { color: #75715e; } .bb-tk-str { color: #e6db74; } .bb-tk-num, .bb-tk-lit { color: #ae81ff; } .bb-tk-kw { color: #f92672; } .bb-tk-fn { color: #a6e22e; } .bb-tk-type { color: #66d9ef; }
.bb-ln { display: block; } .bb-ln::before { display: none; } .bb-sublime-head, .bb-ans-tools, .bb-tbl-bar, button { display: none !important; }
svg { max-width: 100%; } a { color: #2563eb; }
.bb-c-sr { display: none; } .bb-gp-user, .bb-web-row.is-user .bb-web-bubble { background: #f1f3f6; border-radius: 14px; padding: 8px 12px; margin: 14px 0 8px auto; max-width: 75%; width: fit-content; }
.bb-gp-bot-av, .bb-gp-actions, .bb-c-sources summary { display: none !important; } .bb-gp-bot, .bb-web-row { margin: 8px 0; }
`;

/** Print an answer's rendered HTML (React-rendered, already safe) via a hidden iframe → "Save as PDF". */
export function saveAnswerAsPdf(el: HTMLElement | null, title = 'Answer') {
  if (!el || typeof document === 'undefined') return;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  const safeTitle = title.replace(/[<>&]/g, '');
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>${PRINT_CSS}</style></head><body>` +
      `<h1 class="doc-title">${safeTitle}</h1><p class="doc-meta">${new Date().toLocaleString()}</p>${el.innerHTML}</body></html>`
  );
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 1500);
    }
  }, 250);
}

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/* ------------------------------------------------------------------ */

const SERIES = ['#2563eb', '#16a34a', '#f59e0b', '#db2777'];
const fmt = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n * 100) / 100));

/** Horizontal bar chart (grouped when there are several numeric columns). */
export function TableChart({ head, rows, cols }: { head: string[]; rows: string[][]; cols: number[] }) {
  const data = rows.slice(0, 20).map((r) => ({ label: plain(r[0] || ''), values: cols.map((c) => parseNumber(r[c] || '') ?? 0) }));
  const max = Math.max(1, ...data.reduce<number[]>((acc, d) => acc.concat(d.values.map((v) => Math.abs(v))), []));
  const barH = 14;
  const gap = 4;
  const groupH = cols.length * (barH + gap) + 10;
  const labelW = 120;
  const width = 560;
  const plotW = width - labelW - 60;
  const height = data.length * groupH + 8;
  return (
    <figure className="bb-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Chart of ${cols.map((c) => plain(head[c])).join(', ')} by ${plain(head[0])}`}>
        {data.map((d, i) => {
          const y0 = i * groupH + 4;
          return (
            <g key={i}>
              <text x={labelW - 8} y={y0 + (groupH - 10) / 2 + 4} textAnchor="end" className="bb-chart-label">
                {d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label}
              </text>
              {d.values.map((v, s) => {
                const w = Math.max(2, (Math.abs(v) / max) * plotW);
                const y = y0 + s * (barH + gap);
                return (
                  <g key={s}>
                    <rect x={labelW} y={y} width={w} height={barH} rx={4} fill={SERIES[s % SERIES.length]} opacity={v < 0 ? 0.5 : 1}>
                      <title>{`${d.label} · ${plain(head[cols[s]])}: ${v.toLocaleString()}`}</title>
                    </rect>
                    <text x={labelW + w + 6} y={y + barH - 3} className="bb-chart-value">
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {cols.length > 1 ? (
        <figcaption className="bb-chart-legend">
          {cols.map((c, s) => (
            <span key={c}>
              <i style={{ background: SERIES[s % SERIES.length] }} />
              {plain(head[c])}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Table block                                                         */
/* ------------------------------------------------------------------ */

export function TableBlock({ head, rows, renderCell }: { head: string[]; rows: string[][]; renderCell: (text: string, key: string) => ReactNode }) {
  const cols = useMemo(() => numericColumns(head, rows), [head, rows]);
  const [view, setView] = useState<'table' | 'chart'>('table');
  return (
    <div className="bb-tbl">
      <div className="bb-tbl-bar">
        {cols.length ? (
          <span className="bb-tbl-seg" role="tablist" aria-label="Show as">
            <button type="button" role="tab" aria-selected={view === 'table'} onClick={() => setView('table')}>
              Table
            </button>
            <button type="button" role="tab" aria-selected={view === 'chart'} onClick={() => setView('chart')}>
              Chart
            </button>
          </span>
        ) : null}
        <button type="button" className="bb-tbl-dl" onClick={() => downloadTableCsv(head, rows)} title="Download as a spreadsheet (opens in Excel)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Excel
        </button>
      </div>
      {view === 'chart' && cols.length ? (
        <TableChart head={head} rows={rows} cols={cols} />
      ) : (
        <div className="bb-md-table-wrap">
          <table>
            <thead>
              <tr>
                {head.map((h, hi) => (
                  <th key={hi}>{renderCell(h, `h${hi}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, ci) => (
                    <td key={ci}>{renderCell(r[ci] || '', `${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const ANSWER_TOOLS_CSS = `
.bb-tbl { margin: 8px 0 10px; border: 1px solid var(--bb-separator, rgba(0,0,0,.1)); border-radius: 12px; overflow: hidden; }
.bb-tbl-bar { display: flex; align-items: center; gap: 6px; justify-content: flex-end; padding: 5px 6px; border-bottom: 1px solid var(--bb-separator, rgba(0,0,0,.08)); background: var(--bb-surface2, rgba(0,0,0,.02)); }
.bb-tbl-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bb-fill, rgba(0,0,0,.05)); margin-right: auto; }
.bb-tbl-seg button, .bb-tbl-dl { appearance: none; border: 0; background: transparent; font: inherit; font-size: 12px; font-weight: 500; color: var(--bb-secondary, #555); padding: 3px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.bb-tbl-seg button[aria-selected="true"] { background: var(--bb-surface, #fff); color: var(--bb-label, #111); }
.bb-tbl-dl:hover, .bb-tbl-seg button:hover { color: var(--bb-label, #111); background: var(--bb-fill, rgba(0,0,0,.05)); }
.bb-tbl .bb-md-table-wrap { margin: 0; }
.bb-tbl table { width: 100%; }
.bb-tbl th { background: var(--bb-surface2, rgba(0,0,0,.02)); }
.bb-chart { margin: 0; padding: 10px 12px 8px; }
.bb-chart svg { width: 100%; height: auto; display: block; }
.bb-chart-label { font-size: 11px; fill: var(--bb-secondary, #555); }
.bb-chart-value { font-size: 10.5px; fill: var(--bb-tertiary, #777); font-variant-numeric: tabular-nums; }
.bb-chart-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11.5px; color: var(--bb-secondary, #555); padding: 4px 4px 0; }
.bb-chart-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
`;
