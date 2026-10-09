import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../icons';
import { useLiveEvent, useLiveRefresh } from '../live';
import { Transcript } from './Conversations';
import type { TrainingAudience } from '../../types';
import type { AnswerGapResponse, GapReason, GapStatus, KnowledgeGap } from '../types';
import { GAP_REASONS } from '../types';
import {
  Alert,
  Avatar,
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  LiveDot,
  Pager,
  ReasonChip,
  RolePill,
  Skeleton,
  Segmented,
  SkeletonRows,
  StatusPill,
  useStaff
} from '../ui';
import { errMsg, fmtDateTime, fmtNum, REASON_HELP, REASON_LABELS, relTime, useAsync, useDebounced } from '../util';

const PAGE_SIZE = 20;
const TABS: { key: GapStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' }
];

export const AUDIENCES: { value: TrainingAudience; label: string; help: string }[] = [
  { value: 'public', label: 'Public — anyone', help: 'Anyone, including anonymous visitors on your website chat.' },
  { value: 'customer', label: 'Customers', help: 'Logged-in customers and portal users (staff and admins too).' },
  { value: 'vendor', label: 'Vendors', help: 'Suppliers and vendors (staff and admins too).' },
  { value: 'internal', label: 'Internal staff', help: 'Your team only — never shown to customers, vendors or the public.' },
  { value: 'admin', label: 'Admins only', help: 'Administrators only. Use for sensitive material.' }
];

function defaultAudience(role?: string | null): TrainingAudience {
  const r = (role || '').toLowerCase();
  if (r === 'customer' || r === 'vendor' || r === 'admin') return r;
  if (r === 'internal' || r === 'staff' || r === 'user' || r === 'employee') return 'internal';
  return 'public';
}

/* ------------------------------------------------------------------ */
/* Training task status (polls /api/ingest/status)                     */
/* ------------------------------------------------------------------ */

function TaskStatus({ taskId, sourceId, sourceName }: { taskId: string; sourceId?: string; sourceName?: string }) {
  const { client, href, live, liveStatus, toast } = useStaff();
  const [status, setStatus] = useState<string>('queued');
  const [error, setError] = useState<string | null>(null);
  const announced = useRef(false);
  const s = String(status).toLowerCase();
  const done = s === 'completed' || s === 'success';
  const failed = s === 'failed' || s === 'error';

  useLiveEvent(live, 'training', (e) => {
    if (!sourceId || e.source.source_id !== sourceId) return;
    setStatus(e.source.status);
    if (e.source.error_message) setError(e.source.error_message);
  });

  // Poll /api/ingest/status unless the live stream is delivering training events.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await client.getIngestStatus(taskId);
        if (!alive) return;
        setStatus(res.status);
        if (res.error_message) setError(res.error_message);
        if (!['completed', 'failed', 'success', 'error'].includes(String(res.status).toLowerCase())) timer = setTimeout(tick, liveStatus === 'live' ? 8000 : 2000);
      } catch (err) {
        if (alive) setError(errMsg(err));
      }
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, taskId]);

  useEffect(() => {
    if (announced.current || (!done && !failed)) return;
    announced.current = true;
    if (done) toast('Assistant trained', 'success', { body: sourceName ? `“${sourceName}” is now part of its knowledge.` : 'It will use this answer from now on.' });
    else toast('Training failed', 'error', { body: error || 'Open Training to retry.' });
  }, [done, failed]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = ['queued', 'processing', 'completed'];
  const at = done ? 2 : failed ? -1 : s === 'processing' ? 1 : 0;
  return (
    <div className={`bb-staff-task${done ? ' is-done' : failed ? ' is-failed' : ''}`} role="status" aria-live="polite">
      <div className="bb-staff-task-head">
        <span className="bb-staff-task-icon">
          <Icon name={done ? 'check' : failed ? 'alert' : 'loader'} size={16} strokeWidth={done ? 2.5 : 1.75} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong>{done ? 'Trained — the assistant now knows this' : failed ? 'Training failed' : 'Training the assistant…'}</strong>
          <div className="bb-staff-task-sub">
            {sourceName ? <>“{sourceName}” · </> : null}
            <a href={href('/training')}>View in Training</a>
          </div>
        </div>
        <StatusPill status={done ? 'completed' : failed ? 'failed' : s === 'processing' ? 'processing' : 'queued'} label={done ? 'Completed' : failed ? 'Failed' : s === 'processing' ? 'Processing' : 'Queued'} />
      </div>
      {!failed ? (
        <div className="bb-staff-task-steps" aria-hidden="true">
          {steps.map((st, i) => (
            <span key={st} className={i < at ? 'is-done' : i === at ? (done ? 'is-done' : 'is-active') : ''} />
          ))}
        </div>
      ) : null}
      {error && failed ? <div className="bb-staff-task-error">{error}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gap detail drawer                                                   */
/* ------------------------------------------------------------------ */

function GapDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (g: KnowledgeGap) => void }) {
  const { client, can, toast, href, query, refreshCounts, user, live } = useStaff();
  const uid = useId();
  const { data: gap, setData: setGap, error, loading, reload } = useAsync(() => client.getGap(id), [client, id]);
  const [answer, setAnswer] = useState('');
  const [audience, setAudience] = useState<TrainingAudience>('public');
  const [similar, setSimilar] = useState(true);
  const [busy, setBusy] = useState<null | 'answer' | 'dismiss' | 'reopen'>(null);
  const [result, setResult] = useState<AnswerGapResponse | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState('');
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const canTrain = can('trainer');

  useEffect(() => {
    if (gap) setAudience(defaultAudience(gap.user_role));
  }, [gap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gap && query.answer && answerRef.current) answerRef.current.focus();
  }, [gap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (g: KnowledgeGap) => {
    setGap(g);
    onChanged(g);
    refreshCounts();
  };

  useLiveEvent(live, 'gap', (e) => {
    if (String(e.gap.id) === String(id)) setGap(e.gap);
  });

  const conv = useAsync(() => (gap?.session_id ? client.getConversation(gap.session_id).catch(() => null) : Promise.resolve(null)), [client, gap?.session_id]);
  useLiveEvent(live, 'conversation', (e) => {
    if (gap?.session_id && e.session_id === gap.session_id) void conv.reload(true);
  });

  const submitAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!gap || !answer.trim()) return;
    setBusy('answer');
    try {
      const res = await client.answerGap(gap.id, { answer: answer.trim(), audience, also_resolve_similar: similar });
      setResult(res);
      apply(res.gap);
      setAnswer('');
      const n = res.resolved_similar || 0;
      toast('Answer saved', 'success', { body: n ? `Training now · ${n} similar question${n === 1 ? '' : 's'} also resolved.` : 'Training the assistant now.' });
    } catch (err) {
      toast('Couldn’t save the answer', 'error', { body: errMsg(err) });
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: GapStatus, resolution_note?: string) => {
    if (!gap) return;
    const before = gap;
    // Optimistic: reflect the change immediately, roll back if the server refuses.
    apply({ ...gap, status, resolution_note: resolution_note || gap.resolution_note, resolved_by: status === 'open' ? null : user.full_name || user.email, resolved_at: status === 'open' ? null : new Date().toISOString() });
    setDismissing(false);
    setBusy(status === 'open' ? 'reopen' : 'dismiss');
    try {
      const g = await client.updateGap(gap.id, { status, ...(resolution_note ? { resolution_note } : {}) });
      apply(g);
      setNote('');
      toast(status === 'open' ? 'Gap reopened' : 'Gap dismissed', 'success', status === 'open' ? undefined : { action: { label: 'Undo', onClick: () => void client.updateGap(g.id, { status: 'open' }).then(apply).catch(() => undefined) } });
    } catch (err) {
      apply(before);
      toast('Couldn’t update the gap', 'error', { body: errMsg(err) });
    } finally {
      setBusy(null);
    }
  };

  const header = gap ? (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <StatusPill status={gap.status} />
        <ReasonChip reason={gap.reason} />
        <span className="bb-staff-muted" style={{ fontSize: 12 }}>
          Gap #{gap.id}
        </span>
      </div>
      <h3 className="bb-staff-drawer-q">{gap.question}</h3>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton w={160} h={20} />
      <Skeleton w="85%" h={22} />
    </div>
  );

  let footer = null;
  if (gap && canTrain) {
    if (gap.status === 'open') {
      footer = dismissing ? null : (
        <Button variant="ghost" icon="ban" onClick={() => setDismissing(true)}>
          Dismiss
        </Button>
      );
    } else {
      footer = (
        <Button variant="secondary" icon="undo" loading={busy === 'reopen'} onClick={() => void setStatus('open')}>
          Reopen
        </Button>
      );
    }
  }

  return (
    <Drawer label="Knowledge gap details" header={header} onClose={onClose} footer={footer}>
      {error ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !gap ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton h={90} />
          <Skeleton h={120} />
          <Skeleton h={180} />
        </div>
      ) : null}
      {gap ? (
        <>
          <dl className="bb-staff-kv" style={{ margin: 0 }}>
            <div>
              <dt>Asked by</dt>
              <dd>
                <span className="bb-staff-person">
                  <Avatar name={gap.user_name || 'Anonymous visitor'} email={String(gap.user_id || gap.id)} size="sm" />
                  <span className="bb-staff-truncate">{gap.user_name || 'Anonymous visitor'}</span>
                  {gap.user_role ? <RolePill role={gap.user_role} /> : null}
                </span>
              </dd>
            </div>
            <div>
              <dt>Occurrences</dt>
              <dd>
                <b className="bb-staff-num">{fmtNum(gap.occurrences)}</b> {gap.occurrences === 1 ? 'time' : 'times'}
              </dd>
            </div>
            <div>
              <dt>First asked</dt>
              <dd>{fmtDateTime(gap.created_at)}</dd>
            </div>
            <div>
              <dt>Last asked</dt>
              <dd>{fmtDateTime(gap.last_seen_at)}</dd>
            </div>
            <div>
              <dt>Why it’s a gap</dt>
              <dd className="bb-staff-muted" style={{ fontSize: 13 }}>
                {REASON_HELP[gap.reason]}
              </dd>
            </div>
            <div>
              <dt>Best match distance</dt>
              <dd>
                {gap.best_distance == null ? (
                  <span className="bb-staff-muted">No match found</span>
                ) : (
                  <span className="bb-staff-num">{gap.best_distance.toFixed(3)}</span>
                )}
              </dd>
            </div>
          </dl>

          {conv.data && conv.data.messages.length ? (
            <div>
              <div className="bb-staff-section-label">
                <Icon name="chat" size={14} /> Conversation context <LiveDot />
              </div>
              <div className="bb-staff-context">
                <Transcript detail={conv.data} highlight={gap.question} limit={8} compact />
              </div>
            </div>
          ) : null}
          <div>
            {conv.data && conv.data.messages.length ? null : (
              <>
                <div className="bb-staff-section-label">
                  <Icon name="brain" size={14} /> What the assistant said
                </div>
                {gap.answer_given ? (
              <div className="bb-staff-quote is-bot">{gap.answer_given}</div>
            ) : (
              <div className="bb-staff-quote bb-staff-muted">No answer was recorded.</div>
                )}
              </>
            )}
            {gap.last_feedback_comment ? (
              <div style={{ marginTop: 12 }}>
                <div className="bb-staff-section-label">
                  <Icon name="thumbsDown" size={14} /> User feedback
                </div>
                <div className="bb-staff-quote is-danger">
                  {gap.last_feedback_comment}
                </div>
              </div>
            ) : null}
            {gap.session_id ? (
              <a href={href(`/conversations/${encodeURIComponent(gap.session_id)}`)} className="bb-staff-inline-link">
                <Icon name="chat" size={15} /> Open the full conversation
              </a>
            ) : null}
          </div>

          {gap.status === 'resolved' ? (
            <Alert tone="success">
              <strong>Resolved</strong>
              {gap.resolved_by ? <> by {gap.resolved_by}</> : null}
              {gap.resolved_at ? <> · {fmtDateTime(gap.resolved_at)}</> : null}
              {gap.resolution_note ? <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{gap.resolution_note}</div> : null}
              {gap.source_id ? (
                <div style={{ marginTop: 4 }}>
                  Trained as a source · <a href={href('/training')}>View training sources</a>
                </div>
              ) : null}
            </Alert>
          ) : null}
          {gap.status === 'dismissed' ? (
            <Alert tone="info">
              <strong>Dismissed</strong>
              {gap.resolved_by ? <> by {gap.resolved_by}</> : null}
              {gap.resolved_at ? <> · {fmtDateTime(gap.resolved_at)}</> : null}
              {gap.resolution_note ? <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{gap.resolution_note}</div> : null}
            </Alert>
          ) : null}

          {result ? <TaskStatus taskId={result.task_id} sourceId={result.source?.source_id} sourceName={result.source?.name} /> : null}

          {gap.status === 'open' && canTrain && dismissing ? (
            <div className="bb-staff-card bb-staff-subcard">
              <Field label="Why dismiss this question? (optional)" htmlFor={`${uid}-note`} hint="E.g. spam, out of scope, already covered elsewhere.">
                <textarea id={`${uid}-note`} className="bb-staff-input" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} data-autofocus autoFocus />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setDismissing(false)}>
                  Cancel
                </Button>
                <Button variant="danger" icon="ban" loading={busy === 'dismiss'} onClick={() => void setStatus('dismissed', note.trim())}>
                  Dismiss gap
                </Button>
              </div>
            </div>
          ) : null}

          {gap.status === 'open' && canTrain && !dismissing ? (
            <form onSubmit={submitAnswer} className="bb-staff-card bb-staff-subcard is-answer">
              <div>
                <h4 className="bb-staff-subcard-title">
                  <Icon name="sparkles" size={17} /> Answer &amp; train
                </h4>
                <p className="bb-staff-hint" style={{ marginTop: 3 }}>
                  Write the answer once — it’s saved as a training source and the assistant will use it next time.
                </p>
              </div>
              <Field label="Answer" htmlFor={`${uid}-answer`} hint={`${answer.trim().length} characters`}>
                <textarea
                  ref={answerRef}
                  id={`${uid}-answer`}
                  className="bb-staff-input"
                  style={{ minHeight: 140 }}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write a clear, complete answer as you’d like the assistant to give it…"
                  required
                />
              </Field>
              <Field label="Who can see this answer" htmlFor={`${uid}-aud`} hint={AUDIENCES.find((a) => a.value === audience)?.help}>
                <select id={`${uid}-aud`} className="bb-staff-input" value={audience} onChange={(e) => setAudience(e.target.value as TrainingAudience)}>
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="bb-staff-check">
                <input type="checkbox" checked={similar} onChange={(e) => setSimilar(e.target.checked)} />
                <span>
                  Also resolve similar open questions
                  <span className="bb-staff-hint" style={{ display: 'block' }}>
                    Closes other open gaps that ask the same thing.
                  </span>
                </span>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="primary" icon="send" loading={busy === 'answer'} disabled={!answer.trim()}>
                  Answer &amp; train
                </Button>
              </div>
            </form>
          ) : null}

          {gap.status === 'open' && !canTrain ? (
            <Alert tone="info">Your role ({user.role}) can view gaps but not answer them. Ask a trainer or admin to answer it.</Alert>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Gaps list                                                           */
/* ------------------------------------------------------------------ */

export function GapsPage({ gapId }: { gapId?: string }) {
  const { client, query, navigate, href, live } = useStaff();
  const status = (['open', 'resolved', 'dismissed'].includes(query.status) ? query.status : 'open') as GapStatus;
  const reason = (GAP_REASONS as string[]).includes(query.reason) ? (query.reason as GapReason) : '';
  const page = Math.max(1, Number(query.page) || 1);
  const q = useDebounced(query.q || '', 300);
  const { data, setData, error, loading, reload } = useAsync(
    () => client.listGaps({ status, reason, q, page, page_size: PAGE_SIZE }),
    [client, status, reason, q, page]
  );
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const known = useRef<Set<string>>(new Set());

  // Highlight rows that appear after the first load (live inserts and polling refreshes alike).
  useEffect(() => {
    if (!data) return;
    const ids = data.items.map((g) => String(g.id));
    const added = known.current.size ? ids.filter((id) => !known.current.has(id)) : [];
    ids.forEach((id) => known.current.add(id));
    if (added.length) {
      setFresh((f) => new Set([...Array.from(f), ...added]));
      setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => !added.includes(x)))), 2600);
    }
  }, [data]);
  useEffect(() => {
    known.current = new Set();
  }, [status, reason, q, page]);

  useLiveRefresh(live, () => void reload(true));

  useLiveEvent(live, 'gap', (e) => {
    const g = e.gap;
    setData((d) => {
      if (!d) return d;
      const counts = { ...d.counts };
      const existing = d.items.find((x) => String(x.id) === String(g.id));
      if (existing && existing.status !== g.status) {
        counts[existing.status] = Math.max(0, counts[existing.status] - 1);
        counts[g.status] = (counts[g.status] || 0) + 1;
      } else if (!existing && e.action === 'created') {
        counts[g.status] = (counts[g.status] || 0) + 1;
      }
      const matches = g.status === status && (!reason || g.reason === reason) && (!q || g.question.toLowerCase().includes(q.toLowerCase()));
      let items = d.items;
      if (existing) items = matches ? items.map((x) => (String(x.id) === String(g.id) ? g : x)) : items.filter((x) => String(x.id) !== String(g.id));
      else if (matches && page === 1 && e.action === 'created') items = [g, ...items].slice(0, PAGE_SIZE);
      const total = d.total + (items.length - d.items.length);
      return { ...d, items, counts, total };
    });
  });

  const setQuery = (patch: Record<string, string | number | undefined>, replace = false) => {
    const base = gapId ? `/gaps/${gapId}` : '/gaps';
    navigate(base, { ...query, ...patch }, { replace });
  };
  const listQuery = { ...query };
  delete listQuery.answer;

  const onChanged = (g: KnowledgeGap) => {
    setData((d) => {
      if (!d) return d;
      const existing = d.items.find((x) => x.id === g.id);
      const counts = { ...d.counts };
      if (existing && existing.status !== g.status) {
        counts[existing.status] = Math.max(0, counts[existing.status] - 1);
        counts[g.status] = (counts[g.status] || 0) + 1;
      }
      return { ...d, counts, items: d.items.map((x) => (x.id === g.id ? g : x)) };
    });
  };

  const counts = data?.counts;

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head">
        <div>
          <h2>
            Knowledge gaps <LiveDot />
          </h2>
          <p>Questions your assistant couldn’t answer. Answer them once and the AI learns.</p>
        </div>
      </div>

      <section className="bb-staff-card">
        <div className="bb-staff-toolbar">
          <Segmented<GapStatus>
            label="Gap status"
            value={status}
            onChange={(v) => setQuery({ status: v, page: undefined })}
            options={TABS.map((t) => ({ value: t.key, label: t.label, count: counts ? counts[t.key] : null }))}
          />
          <div className="bb-staff-search">
            <Icon name="search" size={15} />
            <input
              className="bb-staff-input bb-staff-input-sm"
              type="search"
              placeholder="Search questions…"
              aria-label="Search questions"
              value={query.q || ''}
              onChange={(e) => setQuery({ q: e.target.value, page: undefined }, true)}
            />
          </div>
        </div>
        <div className="bb-staff-toolbar is-sub">
          <span className="bb-staff-toolbar-label">Reason</span>
          <div className="bb-staff-scroll-x">
            <Segmented<string>
              size="sm"
              label="Filter by reason"
              value={reason}
              onChange={(v) => setQuery({ reason: v || undefined, page: undefined })}
              options={[{ value: '', label: 'All' }, ...GAP_REASONS.map((r) => ({ value: r as string, label: REASON_LABELS[r], title: REASON_HELP[r] }))]}
            />
          </div>
        </div>

        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={6} /> : null}
        {data ? (
          data.items.length ? (
            <div role="list" aria-busy={loading} aria-live="polite" aria-relevant="additions">
              <div className="bb-staff-gap-row is-head" aria-hidden="true">
                <span>Question</span>
                <span className="bb-staff-col-reason">Reason</span>
                <span className="bb-staff-col-occ">Asked</span>
                <span className="bb-staff-col-who">Who asked</span>
                <span className="bb-staff-col-seen">Last seen</span>
              </div>
              {data.items.map((g) => (
                <a
                  key={g.id}
                  role="listitem"
                  href={href(`/gaps/${g.id}`, listQuery)}
                  className={`bb-staff-gap-row${String(g.id) === gapId ? ' is-active' : ''}${fresh.has(String(g.id)) ? ' is-new' : ''}`}
                  aria-label={`${g.question} — ${REASON_LABELS[g.reason]}, asked ${g.occurrences} times`}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="bb-staff-gap-q bb-staff-clamp2">
                      {fresh.has(String(g.id)) ? <span className="bb-staff-new-tag">New</span> : null}
                      {g.question}
                    </div>
                    {g.status !== 'open' && g.resolved_by ? (
                      <div className="bb-staff-gap-sub">
                        {g.status === 'resolved' ? 'Resolved' : 'Dismissed'} by {g.resolved_by} · {relTime(g.resolved_at)}
                      </div>
                    ) : g.answer_given ? (
                      <div className="bb-staff-gap-sub bb-staff-truncate">Bot: {g.answer_given}</div>
                    ) : null}
                  </div>
                  <span className="bb-staff-col-reason">
                    <ReasonChip reason={g.reason} />
                  </span>
                  <span className={`bb-staff-col-occ bb-staff-occ${g.occurrences >= 5 ? ' is-hot' : ''}`}>
                    {g.occurrences >= 5 ? <Icon name="trendUp" size={14} /> : null}
                    {fmtNum(g.occurrences)}×
                  </span>
                  <span className="bb-staff-col-who bb-staff-person">
                    <Avatar name={g.user_name || 'Anonymous visitor'} email={String(g.user_id || g.id)} size="sm" />
                    <span className="bb-staff-person-text">
                      <span className="bb-staff-person-name bb-staff-truncate">{g.user_name || 'Anonymous'}</span>
                      <span className="bb-staff-person-sub" style={{ textTransform: 'capitalize' }}>
                        {g.user_role || 'visitor'}
                      </span>
                    </span>
                  </span>
                  <span className="bb-staff-col-seen bb-staff-muted" title={fmtDateTime(g.last_seen_at)}>
                    {relTime(g.last_seen_at)}
                  </span>
                </a>
              ))}
              {data.total > PAGE_SIZE ? <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => setQuery({ page: p })} /> : null}
            </div>
          ) : (
            <EmptyState icon={status === 'open' ? 'checkCircle' : 'gaps'} title={query.q || reason ? 'No matching gaps' : status === 'open' ? 'No open gaps' : `No ${status} gaps`}>
              {query.q || reason
                ? 'Try a different search or clear the filters.'
                : status === 'open'
                  ? 'When the assistant can’t answer a question, it lands here instantly and your team gets notified.'
                  : 'Nothing here yet.'}
            </EmptyState>
          )
        ) : null}
      </section>

      {gapId ? (
        <GapDrawer
          id={gapId}
          onClose={() => {
            const rest = { ...query };
            delete rest.answer;
            navigate('/gaps', rest);
          }}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}
