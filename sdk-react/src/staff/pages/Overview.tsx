import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarList, SERIES, Sparkline, TrendChart } from '../charts';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import type { OverviewReport } from '../types';
import { Avatar, Button, EmptyState, ErrorState, ReasonChip, RolePill, Skeleton, useStaff } from '../ui';
import { fmtCompact, fmtNum, fmtPct, relTime, useAsync } from '../util';

const RANGES = [7, 30, 90];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Kpi({
  label,
  value,
  icon,
  tone,
  meta,
  to,
  children
}: {
  label: string;
  value: string;
  icon: StaffIconName;
  tone?: 'warn' | 'sky' | 'green';
  meta?: ReactNode;
  to?: string;
  children?: ReactNode;
}) {
  const { href } = useStaff();
  return (
    <div className="bb-staff-card bb-staff-kpi">
      {to ? <a className="bb-staff-kpi-link" href={href(to)} aria-label={`${label}: ${value}`} /> : null}
      <div className="bb-staff-kpi-top">
        <span className="bb-staff-kpi-label">{label}</span>
        <span className={`bb-staff-kpi-icon${tone ? ` is-${tone}` : ''}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="bb-staff-kpi-value">{value}</div>
      {children}
      <div className="bb-staff-kpi-meta">{meta}</div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bb-staff-card bb-staff-kpi">
      <Skeleton w="50%" h={12} />
      <Skeleton w="60%" h={26} />
      <Skeleton w="80%" h={10} />
    </div>
  );
}

const STATUS_META: { key: keyof OverviewReport['sources_by_status']; label: string; color: string; icon: StaffIconName }[] = [
  { key: 'completed', label: 'Trained', color: '#16a34a', icon: 'checkCircle' },
  { key: 'processing', label: 'Processing', color: '#0ea5e9', icon: 'loader' },
  { key: 'queued', label: 'Queued', color: '#d97706', icon: 'clock' },
  { key: 'failed', label: 'Failed', color: '#dc2626', icon: 'alert' }
];

export function OverviewPage() {
  const { client, user, href, navigate, can } = useStaff();
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAsync(() => client.overview(days), [client, days]);
  const first = (user.full_name || '').split(' ')[0] || user.email.split('@')[0];
  const t = data?.totals;
  const daily = data?.daily || [];
  const sbs = data?.sources_by_status;
  const sbsTotal = sbs ? sbs.completed + sbs.processing + sbs.queued + sbs.failed : 0;

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>
            {greeting()}, {first}
          </h2>
          <p>Here’s how your assistant performed over the last {days} days.</p>
        </div>
        <div className="bb-staff-seg" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}

      <div className="bb-staff-grid bb-staff-grid-kpi" aria-busy={loading}>
        {!t ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <Kpi label="Questions" value={fmtCompact(t.questions)} icon="chat" meta={`${fmtNum(t.answered)} answered`}>
              <Sparkline values={daily.map((d) => d.questions)} />
            </Kpi>
            <Kpi label="Answer rate" value={fmtPct(t.answer_rate, 1)} icon="checkCircle" tone="green" meta={`${fmtNum(t.unanswered)} unanswered`}>
              <div className="bb-staff-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(t.answer_rate * 100)} aria-label="Answer rate">
                <span style={{ width: `${Math.round(t.answer_rate * 100)}%`, background: t.answer_rate >= 0.85 ? '#1d4ed8' : t.answer_rate >= 0.7 ? '#d97706' : '#dc2626' }} />
              </div>
            </Kpi>
            <Kpi label="Open gaps" value={fmtNum(t.gaps_open)} icon="gaps" tone="warn" to="/gaps" meta={t.gaps_open ? <span style={{ color: '#c2410c', fontWeight: 600 }}>Needs answers →</span> : 'Inbox zero 🎉'} />
            <Kpi label="Conversations" value={fmtCompact(t.conversations)} icon="chat" tone="sky" to="/conversations" meta={t.conversations ? `${(t.questions / Math.max(1, t.conversations)).toFixed(1)} questions each` : 'No conversations yet'} />
            <Kpi label="Knowledge" value={fmtNum(t.sources)} icon="database" to="/training" meta={`${fmtCompact(t.documents)} chunks indexed`} />
            <Kpi label="Staff" value={fmtNum(t.staff)} icon="staff" tone="sky" to="/staff" meta="Active team members" />
          </>
        )}
      </div>

      <div className="bb-staff-grid bb-staff-grid-2-1">
        <section className="bb-staff-card" aria-labelledby="bb-ov-trend">
          <div className="bb-staff-card-head">
            <div>
              <h3 id="bb-ov-trend">Questions vs. unanswered</h3>
              <p>Daily volume (UTC days) — hover a day for details</p>
            </div>
            <div className="bb-staff-legend">
              <span>
                <i className="bb-staff-key-line" style={{ background: SERIES.questions }} /> Questions
              </span>
              <span>
                <i className="bb-staff-key-line" style={{ background: SERIES.unanswered }} /> Unanswered
              </span>
            </div>
          </div>
          <div className="bb-staff-card-body">
            {!data ? (
              <Skeleton h={260} r={12} />
            ) : daily.some((d) => d.questions) ? (
              <TrendChart data={daily} />
            ) : (
              <EmptyState icon="trendUp" title="No questions in this period">
                Once people start chatting with your assistant, activity shows up here.
              </EmptyState>
            )}
          </div>
        </section>

        <section className="bb-staff-card" aria-labelledby="bb-ov-roles">
          <div className="bb-staff-card-head">
            <div>
              <h3 id="bb-ov-roles">Questions by audience</h3>
              <p>Who is asking</p>
            </div>
          </div>
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
        </section>
      </div>

      <div className="bb-staff-grid bb-staff-grid-2-1">
        <section className="bb-staff-card" aria-labelledby="bb-ov-gaps">
          <div className="bb-staff-card-head">
            <div>
              <h3 id="bb-ov-gaps">Recent knowledge gaps</h3>
              <p>Questions your assistant couldn’t answer</p>
            </div>
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('/gaps')}>
              View all
            </Button>
          </div>
          <div style={{ paddingTop: 8 }}>
            {!data ? (
              <div style={{ padding: '6px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} h={40} />
                ))}
              </div>
            ) : data.recent_gaps.length ? (
              <ul className="bb-staff-list">
                {data.recent_gaps.map((g) => (
                  <li key={g.id}>
                    <Avatar name={g.user_name || 'Anonymous visitor'} email={String(g.user_id || g.id)} size="sm" />
                    <div className="bb-staff-list-main">
                      <a className="bb-staff-row-link bb-staff-clamp2" href={href(`/gaps/${g.id}`)} style={{ display: '-webkit-box' }}>
                        {g.question}
                      </a>
                      <div className="bb-staff-list-meta">
                        <ReasonChip reason={g.reason} />
                        <span>{g.user_name || 'Anonymous visitor'}</span>
                        {g.user_role ? <RolePill role={g.user_role} /> : null}
                        <span className="bb-staff-dot-sep">{relTime(g.last_seen_at)}</span>
                        {g.occurrences > 1 ? <span className="bb-staff-dot-sep">asked {g.occurrences}×</span> : null}
                      </div>
                    </div>
                    {can('trainer') && g.status === 'open' ? (
                      <Button size="sm" variant="soft" icon="sparkles" onClick={() => navigate(`/gaps/${g.id}`, { answer: 1 })}>
                        Answer
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="checkCircle" title="No gaps — nice!">
                Your assistant answered everything in this period.
              </EmptyState>
            )}
          </div>
        </section>

        <section className="bb-staff-card" aria-labelledby="bb-ov-sources">
          <div className="bb-staff-card-head">
            <div>
              <h3 id="bb-ov-sources">Training sources</h3>
              <p>{t ? `${fmtNum(t.sources)} sources · ${fmtCompact(t.documents)} chunks` : 'Status of your knowledge base'}</p>
            </div>
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('/training')}>
              Manage
            </Button>
          </div>
          <div className="bb-staff-card-body">
            {!sbs ? (
              <Skeleton h={90} />
            ) : sbsTotal ? (
              <>
                <div className="bb-staff-stack-bar" role="img" aria-label={STATUS_META.map((m) => `${m.label} ${sbs[m.key]}`).join(', ')}>
                  {STATUS_META.filter((m) => sbs[m.key]).map((m) => (
                    <span key={m.key} style={{ width: `${(sbs[m.key] / sbsTotal) * 100}%`, background: m.color }} title={`${m.label}: ${sbs[m.key]}`} />
                  ))}
                </div>
                <div className="bb-staff-status-grid">
                  {STATUS_META.map((m) => (
                    <div key={m.key} className="bb-staff-status-cell">
                      <b className="bb-staff-num">{fmtNum(sbs[m.key])}</b>
                      <span>
                        <i className="bb-staff-key-dot" style={{ background: m.color }} />
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>
                {sbs.failed ? (
                  <p className="bb-staff-hint" style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', color: '#b91c1c' }}>
                    <Icon name="alert" size={14} /> {sbs.failed} source{sbs.failed > 1 ? 's' : ''} failed — check the Training page.
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState icon="database" title="No training data yet" action={can('trainer') ? <Button size="sm" variant="primary" icon="plus" onClick={() => navigate('/training')}>Add a source</Button> : undefined}>
                Upload documents or connect a tool so your assistant has something to answer from.
              </EmptyState>
            )}
          </div>
        </section>
      </div>

      <section className="bb-staff-card" aria-labelledby="bb-ov-top">
        <div className="bb-staff-card-head">
          <div>
            <h3 id="bb-ov-top">Top questions</h3>
            <p>Most frequently asked in the last {days} days</p>
          </div>
        </div>
        <div style={{ paddingTop: 12 }}>
          {!data ? (
            <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} h={18} />
              ))}
            </div>
          ) : data.top_questions.length ? (
            <div className="bb-staff-table-wrap">
              <table className="bb-staff-table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Question</th>
                    <th className="is-num">Asked</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_questions.map((q, i) => (
                    <tr key={q.question}>
                      <td className="bb-staff-muted bb-staff-num">{i + 1}</td>
                      <td style={{ fontWeight: 550 }}>{q.question}</td>
                      <td className="is-num" style={{ fontWeight: 650 }}>
                        {fmtNum(q.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="chat" title="No questions yet" />
          )}
        </div>
      </section>
    </div>
  );
}
