/*
 * Hand-written SVG charts for the staff dashboard (no chart library).
 * Palette (validated with the dataviz validator, light #FFFFFF / dark #1C1C1E surfaces):
 *   series 1 "questions"  = accent  #0071E3 / #0A84FF
 *   series 2 "unanswered" = orange  #E8710A / #D9690B   (ΔE ≥ 30 under every CVD simulation)
 * Colors come from CSS custom properties so dark mode gets its own validated steps.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { fmtDay, fmtNum, fmtPct } from './util';

export const SERIES = { questions: 'var(--bbs-series-1)', unanswered: 'var(--bbs-series-2)' };

function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth || initial);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const cw = Math.round(entries[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [initial]);
  return [ref, w] as const;
}

/** Round max up to a clean axis value and return ~4 evenly spaced ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (!max || max <= 0) return [0, 1, 2, 3, 4].slice(0, count + 1);
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001 || ticks.length <= count; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
    if (ticks.length > count) break;
  }
  return ticks;
}

/** Smooth (monotone-ish) path through points using cardinal-like bezier with clamped tension. */
function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    let c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    let c2y = p2[1] - (p3[1] - p1[1]) * t;
    // Clamp control points between the two endpoints' y so the curve never overshoots below zero.
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    c1y = Math.max(lo, Math.min(hi, c1y));
    c2y = Math.max(lo, Math.min(hi, c2y));
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export interface TrendPoint {
  date: string;
  questions: number;
  unanswered: number;
}

/** Questions vs unanswered over time: 2px lines, 10% washes, hairline grid, crosshair + tooltip, keyboard. */
export function TrendChart({ data, height = 260, busy }: { data: TrendPoint[]; height?: number; busy?: boolean }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => Math.max(d.questions, d.unanswered)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / top) * innerH;
  const base = padT + innerH;

  const paths = useMemo(() => {
    if (!n) return { q: '', u: '', qa: '', ua: '' };
    const pts = (key: 'questions' | 'unanswered') => data.map((d, i) => [x(i), y(d[key])] as [number, number]);
    const q = smoothPath(pts('questions'));
    const u = smoothPath(pts('unanswered'));
    const close = `L${x(n - 1).toFixed(1)},${base.toFixed(1)}L${x(0).toFixed(1)},${base.toFixed(1)}Z`;
    return { q, u, qa: q + close, ua: u + close };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, top]);

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 78))));
  const xLabels: number[] = [];
  for (let i = 0; i < n; i += labelEvery) xLabels.push(i);
  if (n > 1 && xLabels[xLabels.length - 1] !== n - 1) {
    if (n - 1 - xLabels[xLabels.length - 1] < labelEvery * 0.7) xLabels.pop();
    xLabels.push(n - 1);
  }

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - padL) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!n) return;
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const hd = hover != null ? data[hover] : null;
  const tipW = 176;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), tipW / 2 + 4), width - tipW / 2 - 4) : 0;
  const tipTop = hd ? Math.max(4, Math.min(y(hd.questions), y(hd.unanswered)) - 14) : 0;
  const last = n ? data[n - 1] : null;
  // Key the animated layer by the range so switching ranges replays the draw-in.
  const animKey = `${n}-${data[0]?.date || ''}`;

  return (
    <div className={`bb-staff-chart${busy ? ' is-busy' : ''}`} ref={wrapRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Questions and unanswered questions per day over ${n} days. Use left and right arrow keys to inspect days.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} className={t === 0 ? 'bb-staff-axis' : 'bb-staff-grid-line'} />
            <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={data[i].date} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {fmtDay(data[i].date)}
          </text>
        ))}
        <g key={animKey}>
          <path d={paths.qa} className="bb-staff-area" style={{ fill: SERIES.questions }} />
          <path d={paths.ua} className="bb-staff-area" style={{ fill: SERIES.unanswered }} />
          <path d={paths.q} pathLength={1} className="bb-staff-line" style={{ stroke: SERIES.questions }} />
          <path d={paths.u} pathLength={1} className="bb-staff-line is-2" style={{ stroke: SERIES.unanswered }} />
          {last && hover == null ? (
            <g className="bb-staff-enddots">
              <circle cx={x(n - 1)} cy={y(last.questions)} r={4} className="bb-staff-dot" style={{ fill: SERIES.questions }} />
              <circle cx={x(n - 1)} cy={y(last.unanswered)} r={4} className="bb-staff-dot" style={{ fill: SERIES.unanswered }} />
            </g>
          ) : null}
        </g>
        {hd && hover != null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={base} className="bb-staff-crosshair" />
            <circle cx={x(hover)} cy={y(hd.questions)} r={4.5} className="bb-staff-dot" style={{ fill: SERIES.questions }} />
            <circle cx={x(hover)} cy={y(hd.unanswered)} r={4.5} className="bb-staff-dot" style={{ fill: SERIES.unanswered }} />
          </g>
        ) : null}
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
        />
      </svg>
      {hd ? (
        <div className="bb-staff-tooltip" style={{ left: tipLeft, top: tipTop, width: tipW }} role="presentation">
          <div className="bb-staff-tooltip-title">{fmtDay(hd.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <div className="bb-staff-tooltip-row">
            <b>{fmtNum(hd.questions)}</b>
            <span>
              <i className="bb-staff-key-line" style={{ background: SERIES.questions }} /> Questions
            </span>
          </div>
          <div className="bb-staff-tooltip-row">
            <b>{fmtNum(hd.unanswered)}</b>
            <span>
              <i className="bb-staff-key-line" style={{ background: SERIES.unanswered }} /> Unanswered
            </span>
          </div>
          <div className="bb-staff-tooltip-row is-foot">
            <b>{hd.questions ? fmtPct(1 - hd.unanswered / hd.questions) : '—'}</b>
            <span>Answer rate</span>
          </div>
        </div>
      ) : null}
      <table className="bb-staff-sr">
        <caption>Questions and unanswered per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Questions</th>
            <th>Unanswered</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.questions}</td>
              <td>{d.unanswered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny single-series sparkline for KPI tiles: de-emphasised line, accent end-dot. */
export function Sparkline({ values, color = SERIES.questions, height = 32 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(120);
  if (values.length < 2) return <div ref={ref} style={{ height }} />;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 8) + 4, height - 5 - (v / max) * (height - 10)] as [number, number]);
  const d = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ height }} aria-hidden="true" className="bb-staff-spark">
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <path d={`${d}L${last[0]},${height}L4,${height}Z`} style={{ fill: color }} className="bb-staff-area" />
        <path d={d} pathLength={1} className="bb-staff-line is-thin" style={{ stroke: color }} />
        <circle cx={last[0]} cy={last[1]} r={3.5} className="bb-staff-dot" style={{ fill: color }} />
      </svg>
    </div>
  );
}

/** Progress ring (answer rate). Fill color carries severity; the track is a lighter step. */
export function Ring({ value, size = 132, stroke = 12, children, color }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="bb-staff-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="bb-staff-ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="bb-staff-ring-fill"
          style={{ stroke: color || 'var(--bbs-accent)', strokeDasharray: c, ['--bbs-ring-c' as any]: c, strokeDashoffset: c * (1 - v) } as CSSProperties}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="bb-staff-ring-center">{children}</div>
    </div>
  );
}

/** Horizontal bar list (single series → one hue). Values in text tokens; bars animate in. */
export function BarList({
  items,
  color = SERIES.questions,
  valueLabel
}: {
  items: { label: string; value: number; hint?: string }[];
  color?: string;
  valueLabel?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="bb-staff-bars" role="list">
      {items.map((it, i) => (
        <div key={it.label} className="bb-staff-bar-row" role="listitem" title={`${it.label}: ${fmtNum(it.value)} (${fmtPct(it.value / total)})`}>
          <span className="bb-staff-bar-label">{it.label}</span>
          <span className="bb-staff-bar-value">
            {valueLabel ? valueLabel(it.value) : fmtNum(it.value)}
            <span className="bb-staff-bar-pct">{fmtPct(it.value / total)}</span>
          </span>
          <div className="bb-staff-bar-track" aria-hidden="true">
            <span style={{ width: `${(it.value / max) * 100}%`, background: color, animationDelay: `${i * 50}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day-of-week × hour heatmap (sequential: one hue, light → dark). Per-cell hover tooltip. */
export function Heatmap({ grid, total, unit = 'conversations' }: { grid: number[][]; total: number; unit?: string }) {
  const [hover, setHover] = useState<{ d: number; h: number; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...grid.map((r) => Math.max(...r)));
  const step = (v: number) => (v <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  const show = (d: number, h: number, el: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!wrap) return;
    setHover({ d, h, x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top });
  };
  const hourLabel = (h: number) => new Date(2020, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
  return (
    <div className="bb-staff-heat-wrap" ref={wrapRef} onPointerLeave={() => setHover(null)}>
      <div className="bb-staff-heat" role="grid" aria-label={`${unit} by day of week and hour (your local time), ${total} total`}>
        {grid.map((row, d) => (
          <div key={d} className="bb-staff-heat-row" role="row">
            <span className="bb-staff-heat-day" role="rowheader">
              {DOW[d]}
            </span>
            {row.map((v, h) => (
              <span
                key={h}
                role="gridcell"
                tabIndex={d === 0 && h === 0 ? 0 : -1}
                aria-label={`${DOW[d]} ${hourLabel(h)}: ${v} ${unit}`}
                className={`bb-staff-heat-cell is-${step(v)}`}
                style={{ animationDelay: `${(d * 24 + h) * 3}ms` }}
                onPointerEnter={(e) => show(d, h, e.currentTarget)}
                onFocus={(e) => show(d, h, e.currentTarget)}
                onBlur={() => setHover(null)}
              />
            ))}
          </div>
        ))}
        <div className="bb-staff-heat-row is-axis" aria-hidden="true">
          <span className="bb-staff-heat-day" />
          {Array.from({ length: 24 }).map((_, h) => (
            <span key={h} className="bb-staff-heat-hour">
              {h % 6 === 0 ? hourLabel(h).replace(/\s/g, '').toLowerCase() : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="bb-staff-heat-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={`bb-staff-heat-cell is-${i}`} />
        ))}
        <span>More</span>
      </div>
      {hover ? (
        <div className="bb-staff-tooltip is-small" style={{ left: hover.x, top: hover.y - 6 }} role="presentation">
          <div className="bb-staff-tooltip-row">
            <b>{fmtNum(grid[hover.d][hover.h])}</b>
            <span>{unit}</span>
          </div>
          <div className="bb-staff-tooltip-title" style={{ margin: '2px 0 0' }}>
            {DOW[hover.d]} · {hourLabel(hover.h)}–{hourLabel((hover.h + 1) % 24)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal stacked bar with 2px surface gaps between segments. */
export function StackBar({ parts, label }: { parts: { key: string; value: number; color: string; label: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="bb-staff-stack-bar" role="img" aria-label={label}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span key={p.key} style={{ flexGrow: p.value / total, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
    </div>
  );
}
