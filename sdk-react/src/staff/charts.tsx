import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { fmtDay, fmtNum, fmtPct } from './util';

/** Chart palette — validated (light surface, CVD-safe adjacent pair): blue for questions, orange for unanswered. */
export const SERIES = { questions: '#1d4ed8', unanswered: '#ea580c' };
const GRID = '#eef2f7';
const AXIS = '#e2e8f0';

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

export interface TrendPoint {
  date: string;
  questions: number;
  unanswered: number;
}

/** Questions vs unanswered over time: 2px lines, 10% area wash under questions, crosshair + tooltip. */
export function TrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => Math.max(d.questions, d.unanswered)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / top) * innerH;

  const paths = useMemo(() => {
    if (!n) return { q: '', u: '', area: '' };
    const line = (key: 'questions' | 'unanswered') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('');
    const q = line('questions');
    const area = `${q}L${x(n - 1).toFixed(1)},${(padT + innerH).toFixed(1)}L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)}Z`;
    return { q, u: line('unanswered'), area };
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
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 90), width - 90) : 0;
  const tipTop = hd ? Math.max(8, Math.min(y(hd.questions), y(hd.unanswered)) - 12) : 0;

  return (
    <div className="bb-staff-chart" ref={wrapRef}>
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
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
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
        <path d={paths.area} fill={SERIES.questions} opacity={0.1} />
        <path d={paths.q} fill="none" stroke={SERIES.questions} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={paths.u} fill="none" stroke={SERIES.unanswered} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hd && hover != null ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="#94a3b8" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(hd.questions)} r={5} fill={SERIES.questions} stroke="#fff" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(hd.unanswered)} r={5} fill={SERIES.unanswered} stroke="#fff" strokeWidth={2} />
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
        <div className="bb-staff-tooltip" style={{ left: tipLeft, top: tipTop }} role="presentation">
          <div className="bb-staff-tooltip-title">{fmtDay(hd.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <div className="bb-staff-tooltip-row">
            <span>
              <i className="bb-staff-key-line" style={{ background: SERIES.questions }} /> Questions
            </span>
            <b>{fmtNum(hd.questions)}</b>
          </div>
          <div className="bb-staff-tooltip-row">
            <span>
              <i className="bb-staff-key-line" style={{ background: SERIES.unanswered }} /> Unanswered
            </span>
            <b>{fmtNum(hd.unanswered)}</b>
          </div>
          <div className="bb-staff-tooltip-row" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,.12)' }}>
            <span>Answer rate</span>
            <b>{hd.questions ? fmtPct(1 - hd.unanswered / hd.questions) : '—'}</b>
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

/** Tiny single-series sparkline for KPI tiles. */
export function Sparkline({ values, color = SERIES.questions, height = 34 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(120);
  if (values.length < 2) return <div ref={ref} style={{ height }} />;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - (v / max) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <path d={`${d}L${last[0]},${height}L2,${height}Z`} fill={color} opacity={0.08} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
        <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
      </svg>
    </div>
  );
}

/** Horizontal bar list (single series → one hue). */
export function BarList({ items, color = SERIES.questions, valueLabel }: { items: { label: string; value: number }[]; color?: string; valueLabel?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="bb-staff-bars" role="list">
      {items.map((it) => (
        <div key={it.label} className="bb-staff-bar-row" role="listitem" title={`${it.label}: ${fmtNum(it.value)} (${fmtPct(it.value / total)})`}>
          <span className="bb-staff-bar-label">{it.label}</span>
          <span className="bb-staff-bar-value">
            {valueLabel ? valueLabel(it.value) : fmtNum(it.value)}
            <span className="bb-staff-muted" style={{ fontWeight: 500, marginLeft: 6 }}>
              {fmtPct(it.value / total)}
            </span>
          </span>
          <div className="bb-staff-bar-track" aria-hidden="true">
            <span style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
