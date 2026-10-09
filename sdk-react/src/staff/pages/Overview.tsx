import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BarList, Heatmap, Ring, SERIES, Sparkline, StackBar, TrendChart } from '../charts';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import { useLiveEvent, useLiveRefresh } from '../live';
import type { ConversationSummary, KnowledgeGap, OverviewReport } from '../types';
import { Avatar, Button, EmptyState, ErrorState, IconTile, LiveDot, ReasonChip, RolePill, Segmented, Skeleton, useStaff } from '../ui';
import type { TileTone } from '../ui';
import { fmtCompact, fmtNum, fmtPct, relTime, useAsync } from '../util';

const RANGES = [7, 30, 90];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/* ------------------------------------------------------------------ */
/* KPI card                                                            */
/* ------------------------------------------------------------------ */

interface Delta {
  /** Relative change (0.12 = +12%) or absolute points when `points`. */
  value: number;
  points?: boolean;
  /** Whether "up" is good for this metric. */
  upIsGood: boolean;
}

function DeltaBadge({ d, period }: { d: Delta | null; period: string }) {
  if (!d || !Number.isFinite(d.value)) return <span className="bb-staff-kpi-delta is-flat">No prior data</span>;
  const flat = Math.abs(d.value) < (d.points ? 0.001 : 0.005);
  const up = d.value > 0;
  const good = flat ? null : up === d.upIsGood;
  const txt = d.points ? `${up ? '+' : ''}${(d.value * 100).toFixed(1)} pts` : `${up ? '+' : ''}${(d.value * 100).toFixed(Math.abs(d.value) < 0.1 ? 1 : 0)}%`;
  return (
    <span className={`bb-staff-kpi-delta ${flat ? 'is-flat' : good ? 'is-good' : 'is-bad'}`} title={`Compared with the previous ${period}`}>
      {flat ? null : <Icon name={up ? 'arrowUpRight' : 'arrowDownRight'} size={12} strokeWidth={2.25} />}
      {flat ? 'No change' : txt}
      <span className="bb-staff-kpi-vs">vs prev. {period}</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
  delta,
  period,
  spark,
  sparkColor,
  to,
  foot
}: {
  label: string;
  value: string;
  icon: StaffIconName;
  tone: TileTone;
  delta?: Delta | null;
  period: string;
  spark?: number[];
  sparkColor?: string;
  to?: string;
  foot?: ReactNode;
}) {
  const { href } = useStaff();
  return (
    <div className={`bb-staff-card bb-staff-kpi${to ? ' is-link' : ''}`}>
      {to ? <a className="bb-staff-kpi-link" href={href(to)} aria-label={`${label}: ${value}`} /> : null}
      <div className="bb-staff-kpi-top">
        <IconTile icon={icon} tone={tone} />
        <span className="bb-staff-kpi-label">{label}</span>
        {to ? <Icon name="chevronRight" size={14} className="bb-staff-kpi-chev" /> : null}
      </div>
      <div className="bb-staff-kpi-row">
        <div className="bb-staff-kpi-value">{value}</div>
        {spark && spark.length > 1 ? (
          <div className="bb-staff-kpi-spark">
            <Sparkline values={spark} color={sparkColor} />
          </div>
        ) : null}
      </div>
      {delta !== undefined ? <DeltaBadge d={delta} period={period} /> : <span className="bb-staff-kpi-delta is-flat">{foot}</span>}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bb-staff-card bb-staff-kpi">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Skeleton w={28} h={28} r={8} />
        <Skeleton w="40%" h={12} />
      </div>
      <Skeleton w="55%" h={30} />
      <Skeleton w="70%" h={11} />
    </div>
  );
}

function Card({ id, title, sub, right, children, className, live }: { id: string; title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; live?: boolean }) {
  return (
    <section className={`bb-staff-card${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <div className="bb-staff-card-head">
        <div style={{ minWidth: 0 }}>
          <h3 id={id}>
            {title}
            {live ? <LiveDot /> : null}
          </h3>
          {sub ? <p>{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const STATUS_META: { key: keyof OverviewReport['sources_by_status']; label: string; color: string; icon: StaffIconName }[] = [
  { key: 'completed', label: 'Trained', color: 'var(--bbs-success)', icon: 'checkCircle' },
  { key: 'processing', label: 'Processing', color: 'var(--bbs-accent)', icon: 'loader' },
  { key: 'queued', label: 'Queued', color: 'var(--bbs-warning)', icon: 'clock' },
  { key: 'failed', label: 'Failed', color: 'var(--bbs-danger)', icon: 'alert' }
];

function sum(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0);
}

/** Day-of-week (Mon=0) × hour grid from conversation start times (local time). */
function buildHeat(items: ConversationSummary[], days: number) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const since = Date.now() - days * 86400000;
  let total = 0;
  items.forEach((c) => {
    const t = new Date(c.created_at);
    if (Number.isNaN(t.getTime()) || t.getTime() < since) return;
    grid[(t.getDay() + 6) % 7][t.getHours()]++;
    total++;
  });
  return { grid, total };
}

export function OverviewPage() {
  const { client, user, href, navigate, can, live } = useStaff();
  const [days, setDays] = useState(30);
  const { data, setData, error, loading, reload } = useAsync(() => client.overview(days), [client, days]);
  // Same report over twice the range → previous-period totals for the deltas (best-effort).
  const prev = useAsync(() => client.overview(Math.min(365, days * 2)).catch(() => null), [client, days]);
  const convs = useAsync(() => client.listConversations({ page: 1, page_size: 100 }).catch(() => null), [client]);
  const [freshGaps, setFreshGaps] = useState<Set<string>>(() => new Set());
  const [freshConvs, setFreshConvs] = useState<Set<string>>(() => new Set());
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [today, setToday] = useState<{ questions: number; unanswered: number } | null>(null);

  useLiveRefresh(live, () => {
    void reload(true);
    void convs.reload(true);
  });

  const flash = (set: (f: (s: Set<string>) => Set<string>) => void, id: string) => {
    set((s) => new Set([...Array.from(s), id]));
    setTimeout(() => set((s) => new Set(Array.from(s).filter((x) => x !== id))), 2600);
  };

  useLiveEvent(live, 'gap', (e) => {
    setData((d) => {
      if (!d) return d;
      let recent = d.recent_gaps.filter((g) => String(g.id) !== String(e.gap.id));
      if (e.gap.status === 'open') recent = [e.gap, ...recent].slice(0, 5);
      const delta = e.action === 'created' && e.gap.status === 'open' ? 1 : e.action === 'resolved' || e.action === 'dismissed' ? -1 : 0;
      return { ...d, recent_gaps: recent, totals: { ...d.totals, gaps_open: Math.max(0, d.totals.gaps_open + delta) } };
    });
    if (e.action === 'created') flash(setFreshGaps, String(e.gap.id));
  });

  useLiveEvent(live, 'overview', (o) => {
    setToday({ questions: o.questions_today, unanswered: o.unanswered_today });
    setData((d) => (d ? { ...d, totals: { ...d.totals, gaps_open: o.open_gaps } } : d));
  });

  useLiveEvent(live, 'conversation', (e) => {
    setPreviews((p) => ({ ...p, [e.session_id]: `${e.role === 'assistant' ? 'Assistant: ' : ''}${e.preview}` }));
    convs.setData((d) => {
      if (!d) return d;
      const existing = d.items.find((c) => c.session_id === e.session_id);
      const updated: ConversationSummary = existing
        ? { ...existing, message_count: existing.message_count + 1, last_message_at: e.created_at, has_gap: existing.has_gap || !!e.gap_reason }
        : { session_id: e.session_id, title: e.title, user_id: null, user_name: e.user_name, user_role: e.user_role, message_count: 1, created_at: e.created_at, last_message_at: e.created_at, has_gap: !!e.gap_reason };
      return { ...d, total: existing ? d.total : d.total + 1, items: [updated, ...d.items.filter((c) => c.session_id !== e.session_id)] };
    });
    flash(setFreshConvs, e.session_id);
    if (e.role === 'user') setToday((t) => (t ? { ...t, questions: t.questions + 1 } : t));
  });

  useEffect(() => {
    const last = data?.daily[data.daily.length - 1];
    if (last && !today) setToday({ questions: last.questions, unanswered: last.unanswered });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const first = (user.full_name || '').split(' ')[0] || user.email.split('@')[0];
  const t = data?.totals;
  const daily = data?.daily || [];
  const sbs = data?.sources_by_status;
  const sbsTotal = sbs ? sbs.completed + sbs.processing + sbs.queued + sbs.failed : 0;
  const period = `${days} days`;

  const deltas = useMemo(() => {
    const pd = prev.data?.daily;
    if (!pd || pd.length < days * 2 || !t) return null;
    const before = pd.slice(0, pd.length - days);
    const q0 = sum(before.map((d) => d.questions));
    const u0 = sum(before.map((d) => d.unanswered));
    if (!q0) return null;
    const rate0 = (q0 - u0) / q0;
    return {
      questions: { value: t.questions / q0 - 1, upIsGood: true },
      rate: { value: t.answer_rate - rate0, points: true, upIsGood: true },
      unanswered: u0 ? { value: t.unanswered / u0 - 1, upIsGood: false } : null,
      conversations: { value: t.questions / q0 - 1, upIsGood: true }
    } as Record<string, Delta | null>;
  }, [prev.data, days, t]);

  const heat = useMemo(() => (convs.data ? buildHeat(convs.data.items, days) : null), [convs.data, days]);
  const rateSpark = daily.filter((d) => d.questions).map((d) => 1 - d.unanswered / d.questions);
  const rate = t?.answer_rate ?? 0;
  const rateColor = rate >= 0.85 ? 'var(--bbs-accent)' : rate >= 0.7 ? 'var(--bbs-warning)' : 'var(--bbs-danger)';
  const recentConvs = (convs.data?.items || []).slice().sort((a, b) => new Date(b.last_message_at || b.created_at).getTime() - new Date(a.last_message_at || a.created_at).getTime()).slice(0, 6);

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head">
        <div>
          <h2>
            {greeting()}, {first}
          </h2>
          <p>
            How your assistant performed over the last {days} days
            {today ? (
              <span className="bb-staff-today">
                <i aria-hidden="true" /> Today <b className="bb-staff-num">{fmtNum(today.questions)}</b> questions · <b className="bb-staff-num">{fmtNum(today.unanswered)}</b> unanswered
              </span>
            ) : null}
          </p>
        </div>
        <Segmented label="Date range" value={days} onChange={setDays} options={RANGES.map((r) => ({ value: r, label: `${r}d`, title: `Last ${r} days` }))} />
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}

      <div className="bb-staff-grid bb-staff-grid-kpi" aria-busy={loading}>
        {!t ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <Kpi label="Questions" value={fmtCompact(t.questions)} icon="chat" tone="accent" delta={deltas ? deltas.questions : null} period={period} spark={daily.map((d) => d.questions)} />
            <Kpi label="Answer rate" value={fmtPct(t.answer_rate, 1)} icon="checkCircle" tone="success" delta={deltas ? deltas.rate : null} period={period} spark={rateSpark} sparkColor="var(--bbs-success)" />
            <Kpi label="Unanswered" value={fmtNum(t.unanswered)} icon="help" tone="warning" delta={deltas ? deltas.unanswered : null} period={period} spark={daily.map((d) => d.unanswered)} sparkColor={SERIES.unanswered} />
            <Kpi
              label="Open gaps"
              value={fmtNum(t.gaps_open)}
              icon="gaps"
              tone="danger"
              to="/gaps"
              period={period}
              foot={t.gaps_open ? <span className="bb-staff-kpi-cta">Needs answers</span> : 'Inbox zero'}
            />
          </>
        )}
      </div>

      {t ? (
        <div className="bb-staff-card bb-staff-strip">
          {(
            [
              ['Conversations', fmtCompact(t.conversations), 'chat', '/conversations', t.conversations ? `${(t.questions / Math.max(1, t.conversations)).toFixed(1)} questions each` : 'None yet'],
              ['Knowledge sources', fmtNum(t.sources), 'database', '/training', `${fmtCompact(t.documents)} chunks indexed`],
              ['Answered', fmtCompact(t.answered), 'thumbsUp', '/conversations', `of ${fmtCompact(t.questions)} questions`],
              ['Team', fmtNum(t.staff), 'staff', '/staff', 'active members']
            ] as [string, string, StaffIconName, string, string][]
          ).map(([label, value, icon, to, sub]) => (
            <a key={label} className="bb-staff-strip-item" href={href(to)}>
              <Icon name={icon} size={16} />
              <span className="bb-staff-strip-label">{label}</span>
              <b className="bb-staff-strip-value">{value}</b>
              <span className="bb-staff-strip-sub">{sub}</span>
            </a>
          ))}
        </div>
      ) : null}

      <div className="bb-staff-grid bb-staff-grid-2-1">
        <Card
          id="bb-ov-trend"
          title="Questions vs. unanswered"
          sub="Daily volume (UTC days) — hover or use arrow keys for details"
          right={
            <div className="bb-staff-legend">
              <span>
                <i className="bb-staff-key-line" style={{ background: SERIES.questions }} /> Questions
              </span>
              <span>
                <i className="bb-staff-key-line" style={{ background: SERIES.unanswered }} /> Unanswered
              </span>
            </div>
          }
        >
          <div className="bb-staff-card-body">
            {!data ? (
              <Skeleton h={260} r={12} />
            ) : daily.some((d) => d.questions) ? (
              <TrendChart data={daily} busy={loading} />
            ) : (
              <EmptyState icon="trendUp" title="No questions in this period">
                Once people start chatting with your assistant, activity shows up here.
              </EmptyState>
            )}
          </div>
        </Card>

        <Card id="bb-ov-rate" title="Answer rate" sub={`Share of questions answered from your knowledge`}>
          <div className="bb-staff-card-body bb-staff-rate">
            {!t ? (
              <Skeleton w={150} h={150} r={75} style={{ margin: '0 auto' }} />
            ) : (
              <>
                <Ring value={rate} size={152} stroke={12} color={rateColor}>
                  <b className="bb-staff-ring-value">{fmtPct(rate, 1)}</b>
                  <span>answered</span>
                </Ring>
                <dl className="bb-staff-rate-legend">
                  <div>
                    <dt>
                      <i className="bb-staff-key-dot" style={{ background: rateColor }} /> Answered
                    </dt>
                    <dd className="bb-staff-num">{fmtNum(t.answered)}</dd>
                  </div>
                  <div>
                    <dt>
                      <i className="bb-staff-key-dot" style={{ background: 'var(--bbs-fill-strong)' }} /> Unanswered
                    </dt>
                    <dd className="bb-staff-num">{fmtNum(t.unanswered)}</dd>
                  </div>
                  <div>
                    <dt>
                      <i className="bb-staff-key-dot" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--bbs-tertiary)' }} /> Target
                    </dt>
                    <dd className="bb-staff-num">85%</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="bb-staff-grid bb-staff-grid-1-2">
        <Card id="bb-ov-roles" title="Questions by audience" sub="Who is asking">
          <div className="bb-staff-card-body">
            {!data ? (
              <div className="bb-staff-bars">
                {[80, 60, 40, 25].map((w) => (
                  <Skeleton key={w} w={`${w}%`} h={26} />
                ))}
              </div>
            ) : data.by_role.length ? (
              <BarList items={[...data.by_role].sort((a, b) => b.questions - a.questions).map((r) => ({ label: r.role || 'unknown', value: r.questions }))} />
            ) : (
              <EmptyState icon="staff" title="No data yet" />
            )}
          </div>
        </Card>
        {heat === null && convs.loading ? (
          <Card id="bb-ov-heat" title="When people ask" sub="Conversations by weekday and hour">
            <div className="bb-staff-card-body">
              <Skeleton h={190} r={10} />
            </div>
          </Card>
        ) : heat && heat.total >= 8 ? (
          <Card id="bb-ov-heat" title="When people ask" sub={`${fmtNum(heat.total)} conversations by weekday and hour (your time zone)`}>
            <div className="bb-staff-card-body">
              <Heatmap grid={heat.grid} total={heat.total} />
            </div>
          </Card>
        ) : (
          <Card id="bb-ov-top-alt" title="Top questions" sub={`Most asked in the last ${days} days`}>
            <TopQuestions data={data} />
          </Card>
        )}
      </div>

      <div className="bb-staff-grid bb-staff-grid-2">
        <Card
          id="bb-ov-gaps"
          title="Recent knowledge gaps"
          sub="Questions your assistant couldn’t answer"
          live
          right={
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('/gaps')}>
              View all
            </Button>
          }
        >
          <div className="bb-staff-card-list">
            {!data ? (
              <div style={{ padding: '6px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} h={40} />
                ))}
              </div>
            ) : data.recent_gaps.length ? (
              <ul className="bb-staff-list">
                {data.recent_gaps.map((g: KnowledgeGap) => (
                  <li key={g.id} className={freshGaps.has(String(g.id)) ? 'is-new' : undefined}>
                    <Avatar name={g.user_name || 'Anonymous visitor'} email={String(g.user_id || g.id)} size="sm" />
                    <div className="bb-staff-list-main">
                      <a className="bb-staff-row-link bb-staff-clamp2" href={href(`/gaps/${g.id}`)}>
                        {g.question}
                      </a>
                      <div className="bb-staff-list-meta">
                        <ReasonChip reason={g.reason} />
                        <span>{g.user_name || 'Anonymous visitor'}</span>
                        <span className="bb-staff-dot-sep">{relTime(g.last_seen_at)}</span>
                        {g.occurrences > 1 ? <span className="bb-staff-dot-sep">asked {g.occurrences}×</span> : null}
                      </div>
                    </div>
                    {can('trainer') && g.status === 'open' ? (
                      <Button size="sm" variant="secondary" icon="sparkles" onClick={() => navigate(`/gaps/${g.id}`, { answer: 1 })}>
                        Answer
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="checkCircle" title="No open gaps">
                Your assistant answered everything — nice work.
              </EmptyState>
            )}
          </div>
        </Card>

        <Card
          id="bb-ov-convs"
          title="Recent conversations"
          sub="Latest activity across all channels"
          live
          right={
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('/conversations')}>
              View all
            </Button>
          }
        >
          <div className="bb-staff-card-list">
            {!convs.data ? (
              <div style={{ padding: '6px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} h={40} />
                ))}
              </div>
            ) : recentConvs.length ? (
              <ul className="bb-staff-list">
                {recentConvs.map((c) => (
                  <li key={c.session_id} className={freshConvs.has(c.session_id) ? 'is-new' : undefined}>
                    <Avatar name={c.user_name || 'Anonymous visitor'} email={String(c.user_id || c.session_id)} size="sm" />
                    <div className="bb-staff-list-main">
                      <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block' }} href={href(`/conversations/${encodeURIComponent(c.session_id)}`)}>
                        {c.title || 'Untitled conversation'}
                      </a>
                      <div className="bb-staff-list-meta">
                        {previews[c.session_id] ? (
                          <span className="bb-staff-truncate bb-staff-preview">{previews[c.session_id]}</span>
                        ) : (
                          <>
                            <span>{c.user_name || 'Anonymous'}</span>
                            {c.user_role ? <RolePill role={c.user_role} /> : null}
                            <span className="bb-staff-dot-sep">{fmtNum(c.message_count)} messages</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="bb-staff-list-side">
                      {c.has_gap ? <span className="bb-staff-pill bb-staff-status-open bb-staff-pill-dot">Gap</span> : null}
                      <span className="bb-staff-muted">{relTime(c.last_message_at || c.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="chat" title="No conversations yet">
                Conversations appear here as soon as people chat with your assistant.
              </EmptyState>
            )}
          </div>
        </Card>
      </div>

      <div className={`bb-staff-grid ${heat && heat.total >= 8 ? 'bb-staff-grid-2-1' : 'bb-staff-grid-1'}`}>
        {heat && heat.total >= 8 ? (
          <Card id="bb-ov-top" title="Top questions" sub={`Most asked in the last ${days} days`}>
            <TopQuestions data={data} />
          </Card>
        ) : null}
        <Card
          id="bb-ov-sources"
          title="Training sources"
          sub={t ? `${fmtNum(t.sources)} sources · ${fmtCompact(t.documents)} chunks` : 'Status of your knowledge base'}
          right={
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('/training')}>
              Manage
            </Button>
          }
        >
          <div className="bb-staff-card-body">
            {!sbs ? (
              <Skeleton h={90} />
            ) : sbsTotal ? (
              <>
                <StackBar parts={STATUS_META.map((m) => ({ key: m.key, value: sbs[m.key], color: m.color, label: m.label }))} label={STATUS_META.map((m) => `${m.label} ${sbs[m.key]}`).join(', ')} />
                <div className="bb-staff-status-grid">
                  {STATUS_META.map((m) => (
                    <div key={m.key} className="bb-staff-status-cell">
                      <span className="bb-staff-status-cell-label">
                        <i className="bb-staff-key-dot" style={{ background: m.color }} />
                        {m.label}
                      </span>
                      <b className="bb-staff-num">{fmtNum(sbs[m.key])}</b>
                    </div>
                  ))}
                </div>
                {sbs.failed ? (
                  <p className="bb-staff-inline-warn">
                    <Icon name="alert" size={14} /> {sbs.failed} source{sbs.failed > 1 ? 's' : ''} failed — <a href={href('/training')}>check Training</a>
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon="database"
                title="No training data yet"
                action={
                  can('trainer') ? (
                    <Button size="sm" variant="primary" icon="plus" onClick={() => navigate('/training')}>
                      Add a source
                    </Button>
                  ) : undefined
                }
              >
                Upload documents or connect a tool so your assistant has something to answer from.
              </EmptyState>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TopQuestions({ data }: { data: OverviewReport | null }) {
  if (!data) {
    return (
      <div style={{ padding: '4px 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={18} />
        ))}
      </div>
    );
  }
  if (!data.top_questions.length) return <EmptyState icon="chat" title="No questions yet" />;
  const max = Math.max(1, ...data.top_questions.map((q) => q.count));
  return (
    <ol className="bb-staff-topq">
      {data.top_questions.map((q, i) => (
        <li key={q.question} title={`${q.question}: ${fmtNum(q.count)}`}>
          <span className="bb-staff-topq-rank bb-staff-num">{i + 1}</span>
          <span className="bb-staff-topq-main">
            <span className="bb-staff-truncate">{q.question}</span>
            <span className="bb-staff-topq-bar" aria-hidden="true">
              <span style={{ width: `${(q.count / max) * 100}%`, animationDelay: `${i * 40}ms` }} />
            </span>
          </span>
          <span className="bb-staff-topq-count bb-staff-num">{fmtNum(q.count)}</span>
        </li>
      ))}
    </ol>
  );
}
