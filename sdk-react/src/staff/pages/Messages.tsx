import { useEffect, useMemo, useState } from 'react';
import { BrainboxLogo } from '../../design/Logo';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import { useLiveEvent, useLiveRefresh } from '../live';
import type { ChatMessageRecord, KnowledgeAudience, KnowledgeDoc, KnowledgeLabelJob, KnowledgeOrigin } from '../types';
import { Alert, Avatar, Button, EmptyState, ErrorState, LiveDot, Modal, Pager, RolePill, Segmented, SkeletonRows, useStaff } from '../ui';
import { errMsg, fmtDateTime, fmtNum, relTime, useAsync, useDebounced } from '../util';

const PAGE_SIZE = 25;

/** Who can read each audience (mirrors the backend permission table). */
export const AUDIENCE_INFO: Record<KnowledgeAudience, { label: string; who: string; icon: StaffIconName; tone: string }> = {
  public: { label: 'Public', who: 'Everyone, incl. website visitors', icon: 'globe', tone: 'is-neutral' },
  customer: { label: 'Customers', who: 'Customers and staff', icon: 'user', tone: 'is-teal' },
  vendor: { label: 'Vendors', who: 'Vendors / suppliers and staff', icon: 'building', tone: 'is-indigo' },
  internal: { label: 'Internal', who: 'Company staff only', icon: 'shield', tone: 'is-accent' },
  admin: { label: 'Admins only', who: 'Administrators only', icon: 'lock', tone: 'is-danger' }
};
const AUDIENCES = Object.keys(AUDIENCE_INFO) as KnowledgeAudience[];

const ORIGIN_LABEL: Record<KnowledgeOrigin, string> = { auto: 'Labelled automatically', staff: 'Set by staff', source: 'From its training source' };

function AudiencePill({ audience, muted }: { audience: KnowledgeAudience; muted?: boolean }) {
  const info = AUDIENCE_INFO[audience];
  return (
    <span className={`bb-staff-aud-pill ${info.tone}${muted ? ' is-muted' : ''}`} title={info.who}>
      <Icon name={info.icon} size={12} />
      {info.label}
    </span>
  );
}

function OriginNote({ doc }: { doc: KnowledgeDoc }) {
  if (!doc.audience) return <span className="bb-staff-kb-origin is-warn">Not labelled yet · treated as {AUDIENCE_INFO[doc.effective_audience].label.toLowerCase()}</span>;
  if (!doc.origin) return null;
  return (
    <span className={`bb-staff-kb-origin is-${doc.origin}`} title={doc.reason || undefined}>
      <Icon name={doc.origin === 'auto' ? 'sparkles' : doc.origin === 'staff' ? 'user' : 'database'} size={12} />
      {ORIGIN_LABEL[doc.origin]}
      {doc.origin === 'auto' && doc.reason ? <span className="bb-staff-muted"> · {doc.reason}</span> : null}
    </span>
  );
}

function JobBanner({ job, pending, canAdmin, onStart, onRecheck, onReset, busy }: {
  job: KnowledgeLabelJob;
  pending: number;
  canAdmin: boolean;
  onStart: () => void;
  onRecheck: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  if (job.state === 'running') {
    const total = job.total || 0;
    const done = job.done || 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <section className="bb-staff-card bb-staff-kb-job" aria-live="polite">
        <div className="bb-staff-kb-job-head">
          <span className="bb-staff-tile is-accent" aria-hidden="true">
            <Icon name="sparkles" size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Reading and labelling your knowledge…</b>
            <div className="bb-staff-muted">
              {fmtNum(done)} of {fmtNum(total)} checked · the AI decides who may see each piece. You can keep working.
            </div>
          </div>
          <span className="bb-staff-num">{pct}%</span>
        </div>
        <div className="bb-staff-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>
    );
  }
  return (
    <>
      {job.state === 'done' && job.total ? (
        <Alert tone="success">
          Labelled {fmtNum(job.total)} piece{job.total === 1 ? '' : 's'} of knowledge
          {job.counts
            ? ': ' +
              AUDIENCES.filter((a) => job.counts?.[a])
                .map((a) => `${fmtNum(job.counts?.[a] || 0)} ${AUDIENCE_INFO[a].label.toLowerCase()}`)
                .join(', ')
            : ''}
          . Review them below — change any label and it stays as you set it.
        </Alert>
      ) : null}
      {job.state === 'failed' ? <Alert tone="error">Automatic labelling stopped: {job.error || 'unknown error'}</Alert> : null}
      {pending > 0 ? (
        <Alert
          tone="warn"
          action={
            canAdmin ? (
              <Button size="sm" icon="sparkles" onClick={onStart} loading={busy}>
                Label automatically
              </Button>
            ) : undefined
          }
        >
          {fmtNum(pending)} piece{pending === 1 ? '' : 's'} of knowledge {pending === 1 ? 'was' : 'were'} saved before audiences existed and {pending === 1 ? 'has' : 'have'} no label yet.
          {canAdmin ? ' Let the AI read them and decide who may see each one.' : ' An admin can label them automatically.'}
        </Alert>
      ) : canAdmin ? (
        <div className="bb-staff-kb-actions">
          <Button size="sm" variant="secondary" icon="refresh" onClick={onRecheck} loading={busy}>
            Re-check automatic labels
          </Button>
          <Button size="sm" variant="ghost" icon="undo" onClick={onReset} disabled={busy}>
            Undo automatic labels
          </Button>
        </div>
      ) : null}
    </>
  );
}

function KnowledgeTab() {
  const { client, query, navigate, can, toast, live } = useStaff();
  const page = Math.max(1, Number(query.page) || 1);
  const audience = (query.audience || '') as KnowledgeAudience | 'unlabelled' | '';
  const origin = (query.origin || '') as KnowledgeOrigin | '';
  const q = useDebounced(query.q || '', 300);
  const list = useAsync(() => client.listKnowledge({ audience, origin, q, page, page_size: PAGE_SIZE }), [client, audience, origin, q, page]);
  const status = useAsync(() => client.knowledgeLabelStatus(), [client]);
  const [job, setJob] = useState<KnowledgeLabelJob | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkAud, setBulkAud] = useState<KnowledgeAudience>('internal');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<KnowledgeDoc | null>(null);
  const canTrain = can('trainer');
  const canAdmin = can('admin');
  const setQuery = (patch: Record<string, string | number | undefined>, replace = false) => navigate('/messages', { ...query, ...patch }, { replace });
  const currentJob = job || status.data?.job || list.data?.job || { state: 'idle' as const };

  useLiveRefresh(live, () => {
    void list.reload(true);
    void status.reload(true);
  });
  useLiveEvent(live, 'knowledge', (e) => {
    setJob(e.job);
    if (e.action === 'finished') {
      void list.reload(true);
      void status.reload(true);
    }
  });

  // Poll while a job runs (live events usually arrive first; this covers a dropped stream).
  const running = currentJob.state === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => {
      void client
        .knowledgeLabelStatus()
        .then((r) => {
          setJob(r.job);
          if (r.job.state !== 'running') {
            void list.reload(true);
            void status.reload(true);
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, client]);

  const start = async (scope: 'unlabelled' | 'auto') => {
    setBusy(true);
    try {
      const r = await client.startKnowledgeLabelling(scope, true);
      setJob(r.job);
      toast(scope === 'auto' ? 'Re-checking automatic labels…' : 'Labelling started — this runs in the background', 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!window.confirm('Undo every automatic label? Those pieces go back to "not labelled" (treated as public). Labels set by staff are kept.')) return;
    setBusy(true);
    try {
      const r = await client.resetKnowledgeLabels();
      toast(`${fmtNum(r.reset)} automatic label${r.reset === 1 ? '' : 's'} removed`, 'success');
      setJob(null);
      await Promise.all([list.reload(true), status.reload(true)]);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const setOne = async (doc: KnowledgeDoc, aud: KnowledgeAudience) => {
    try {
      const updated = await client.setKnowledgeAudience(doc.id, aud);
      list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === doc.id ? { ...x, ...updated, content: x.content } : x)) } : d));
      if (open?.id === doc.id) setOpen(updated);
      toast(`Now visible to: ${AUDIENCE_INFO[aud].who.toLowerCase()}`, 'success');
      void status.reload(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const applyBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await client.bulkKnowledgeAudience(ids, bulkAud);
      toast(`${fmtNum(r.updated)} updated → ${AUDIENCE_INFO[bulkAud].label}`, 'success');
      setSelected(new Set());
      await Promise.all([list.reload(true), status.reload(true)]);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const openDoc = async (doc: KnowledgeDoc) => {
    setOpen(doc);
    try {
      setOpen(await client.getKnowledge(doc.id));
    } catch {
      /* keep the preview */
    }
  };

  const counts = list.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const items = list.data?.items || [];
  const allOnPage = items.length > 0 && items.every((d) => selected.has(d.id));

  return (
    <div className="bb-staff-stack">
      <JobBanner
        job={currentJob}
        pending={status.data?.pending ?? counts?.unlabelled ?? 0}
        canAdmin={canAdmin}
        busy={busy}
        onStart={() => void start('unlabelled')}
        onRecheck={() => void start('auto')}
        onReset={() => void reset()}
      />

      <div className="bb-staff-aud-grid" role="group" aria-label="Filter by who may see it">
        <button type="button" className={`bb-staff-aud-card${!audience ? ' is-active' : ''}`} onClick={() => setQuery({ audience: undefined, page: undefined })}>
          <span className="bb-staff-aud-card-top">
            <Icon name="database" size={15} /> All knowledge
          </span>
          <b className="bb-staff-num">{counts ? fmtNum(total) : '–'}</b>
          <span className="bb-staff-muted">Everything the AI has learned</span>
        </button>
        {AUDIENCES.map((a) => (
          <button
            key={a}
            type="button"
            className={`bb-staff-aud-card ${AUDIENCE_INFO[a].tone}${audience === a ? ' is-active' : ''}`}
            onClick={() => setQuery({ audience: audience === a ? undefined : a, page: undefined })}
          >
            <span className="bb-staff-aud-card-top">
              <Icon name={AUDIENCE_INFO[a].icon} size={15} /> {AUDIENCE_INFO[a].label}
            </span>
            <b className="bb-staff-num">{counts ? fmtNum(counts[a] || 0) : '–'}</b>
            <span className="bb-staff-muted">{AUDIENCE_INFO[a].who}</span>
          </button>
        ))}
        {counts?.unlabelled ? (
          <button type="button" className={`bb-staff-aud-card is-warn${audience === 'unlabelled' ? ' is-active' : ''}`} onClick={() => setQuery({ audience: audience === 'unlabelled' ? undefined : 'unlabelled', page: undefined })}>
            <span className="bb-staff-aud-card-top">
              <Icon name="alert" size={15} /> Not labelled
            </span>
            <b className="bb-staff-num">{fmtNum(counts.unlabelled)}</b>
            <span className="bb-staff-muted">Saved before audiences existed</span>
          </button>
        ) : null}
      </div>

      <section className="bb-staff-card">
        <div className="bb-staff-toolbar">
          <div className="bb-staff-search">
            <Icon name="search" size={15} />
            <input
              className="bb-staff-input bb-staff-input-sm"
              type="search"
              placeholder="Search what the AI knows…"
              aria-label="Search knowledge"
              value={query.q || ''}
              onChange={(e) => setQuery({ q: e.target.value, page: undefined }, true)}
            />
          </div>
          <div className="bb-staff-scroll-x">
            <Segmented<string>
              size="sm"
              label="Filter by how the label was set"
              value={origin}
              onChange={(v) => setQuery({ origin: v || undefined, page: undefined })}
              options={[
                { value: '', label: 'Any label' },
                { value: 'auto', label: 'Automatic' },
                { value: 'staff', label: 'By staff' },
                { value: 'source', label: 'From source' }
              ]}
            />
          </div>
          {list.data ? (
            <span className="bb-staff-toolbar-count bb-staff-num">
              {fmtNum(list.data.total)} piece{list.data.total === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {canTrain && selected.size ? (
          <div className="bb-staff-kb-bulk" role="region" aria-label="Bulk change">
            <b>{fmtNum(selected.size)} selected</b>
            <span className="bb-staff-muted">Who may see them:</span>
            <select className="bb-staff-input bb-staff-input-sm" value={bulkAud} onChange={(e) => setBulkAud(e.target.value as KnowledgeAudience)} aria-label="New audience">
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_INFO[a].label} — {AUDIENCE_INFO[a].who}
                </option>
              ))}
            </select>
            <Button size="sm" icon="check" onClick={() => void applyBulk()} loading={busy}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}

        {list.error && !list.data ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null}
        {list.loading && !list.data ? <SkeletonRows rows={6} /> : null}
        {list.data ? (
          items.length ? (
            <>
              <div className="bb-staff-kb-list" aria-busy={list.loading}>
                {canTrain ? (
                  <label className="bb-staff-check bb-staff-kb-selectall">
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={() => setSelected((s) => {
                        const next = new Set(s);
                        items.forEach((d) => (allOnPage ? next.delete(d.id) : next.add(d.id)));
                        return next;
                      })}
                    />
                    Select all on this page
                  </label>
                ) : null}
                {items.map((doc) => (
                  <article key={doc.id} className={`bb-staff-kb-row${selected.has(doc.id) ? ' is-selected' : ''}`}>
                    {canTrain ? (
                      <input
                        type="checkbox"
                        className="bb-staff-kb-check"
                        aria-label={`Select knowledge #${doc.id}`}
                        checked={selected.has(doc.id)}
                        onChange={() => setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(doc.id)) next.delete(doc.id);
                          else next.add(doc.id);
                          return next;
                        })}
                      />
                    ) : null}
                    <div className="bb-staff-kb-main">
                      <button type="button" className="bb-staff-kb-text" onClick={() => void openDoc(doc)} title="Open full text">
                        {doc.content || <i className="bb-staff-muted">(empty)</i>}
                      </button>
                      <div className="bb-staff-kb-meta">
                        <span className="bb-staff-kb-source">
                          <Icon name="database" size={12} /> {doc.source_name || doc.source_type}
                        </span>
                        <span className="bb-staff-muted" title={fmtDateTime(doc.created_at)}>
                          {relTime(doc.created_at)}
                        </span>
                        <OriginNote doc={doc} />
                      </div>
                    </div>
                    <div className="bb-staff-kb-aud">
                      {canTrain ? (
                        <select
                          className={`bb-staff-input bb-staff-input-sm bb-staff-aud-select ${AUDIENCE_INFO[doc.effective_audience].tone}`}
                          value={doc.audience || ''}
                          aria-label={`Who may see knowledge #${doc.id}`}
                          onChange={(e) => e.target.value && void setOne(doc, e.target.value as KnowledgeAudience)}
                        >
                          {!doc.audience ? <option value="">Not labelled</option> : null}
                          {AUDIENCES.map((a) => (
                            <option key={a} value={a}>
                              {AUDIENCE_INFO[a].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <AudiencePill audience={doc.effective_audience} muted={!doc.audience} />
                      )}
                      <span className="bb-staff-kb-who">{AUDIENCE_INFO[doc.effective_audience].who}</span>
                    </div>
                  </article>
                ))}
              </div>
              {list.data.total > PAGE_SIZE ? <Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={(p) => setQuery({ page: p })} /> : null}
            </>
          ) : (
            <EmptyState icon="database" title={q || audience || origin ? 'Nothing matches' : 'The AI hasn’t learned anything yet'}>
              {q || audience || origin ? 'Try another search or filter.' : 'Add documents, text or APIs on the Training page.'}
            </EmptyState>
          )
        ) : null}
      </section>

      {open ? (
        <Modal
          title={`Knowledge #${open.id}`}
          description={`${open.source_name || open.source_type} · ${fmtDateTime(open.created_at)} · ${fmtNum(open.length)} characters`}
          onClose={() => setOpen(null)}
          width={720}
          footer={
            canTrain ? (
              <div className="bb-staff-kb-modal-foot">
                <span className="bb-staff-muted">Who may see this:</span>
                <div className="bb-staff-kb-aud-buttons">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`bb-staff-aud-pill ${AUDIENCE_INFO[a].tone}${open.audience === a ? ' is-on' : ''}`}
                      aria-pressed={open.audience === a}
                      onClick={() => void setOne(open, a)}
                      title={AUDIENCE_INFO[a].who}
                    >
                      <Icon name={AUDIENCE_INFO[a].icon} size={12} />
                      {AUDIENCE_INFO[a].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : undefined
          }
        >
          <div className="bb-staff-stack" style={{ gap: 10 }}>
            <div>
              <AudiencePill audience={open.effective_audience} muted={!open.audience} /> <OriginNote doc={open} />
            </div>
            <div className="bb-staff-kb-full">{open.content}</div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

const MSG_ROLES = ['', 'public', 'customer', 'vendor', 'internal', 'admin'];

function MessagesTab() {
  const { client, query, navigate, href, live } = useStaff();
  const page = Math.max(1, Number(query.page) || 1);
  const role = query.role || '';
  const sender = (query.sender || '') as '' | 'user' | 'assistant';
  const q = useDebounced(query.q || '', 300);
  const { data, error, loading, reload } = useAsync(() => client.listMessages({ role, sender, q, page, page_size: PAGE_SIZE }), [client, role, sender, q, page]);
  const setQuery = (patch: Record<string, string | number | undefined>, replace = false) => navigate('/messages', { ...query, ...patch }, { replace });
  useLiveRefresh(live, () => void reload(true));
  useLiveEvent(live, 'conversation', () => {
    if (page === 1) void reload(true);
  });
  const counts = data?.role_counts || {};
  const all = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return (
    <section className="bb-staff-card">
      <div className="bb-staff-toolbar">
        <div className="bb-staff-search">
          <Icon name="search" size={15} />
          <input
            className="bb-staff-input bb-staff-input-sm"
            type="search"
            placeholder="Search messages or names…"
            aria-label="Search messages"
            value={query.q || ''}
            onChange={(e) => setQuery({ q: e.target.value, page: undefined }, true)}
          />
        </div>
        <div className="bb-staff-scroll-x">
          <Segmented<string>
            size="sm"
            label="Filter by the person's role"
            value={role}
            onChange={(v) => setQuery({ role: v || undefined, page: undefined })}
            options={MSG_ROLES.map((r) => ({
              value: r,
              label: `${r ? r[0].toUpperCase() + r.slice(1) : 'All'}${data ? ` ${fmtNum(r ? counts[r] || 0 : all)}` : ''}`
            }))}
          />
        </div>
        <div className="bb-staff-scroll-x">
          <Segmented<string>
            size="sm"
            label="Filter by sender"
            value={sender}
            onChange={(v) => setQuery({ sender: v || undefined, page: undefined })}
            options={[
              { value: '', label: 'Everyone' },
              { value: 'user', label: 'People' },
              { value: 'assistant', label: 'AI replies' }
            ]}
          />
        </div>
      </div>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      {loading && !data ? <SkeletonRows rows={7} /> : null}
      {data ? (
        data.items.length ? (
          <>
            <div className="bb-staff-msglist" aria-busy={loading}>
              {data.items.map((m: ChatMessageRecord) => {
                const isAi = m.sender === 'assistant';
                const name = isAi ? 'Assistant' : m.user_name || 'Anonymous visitor';
                return (
                  <article key={m.id} className={`bb-staff-msgrow${isAi ? ' is-ai' : ''}`}>
                    <span className="bb-staff-msgrow-av">{isAi ? <BrainboxLogo size={30} title="" /> : <Avatar name={name} email={String(m.user_id || m.session_id)} size="sm" />}</span>
                    <div className="bb-staff-msgrow-body">
                      <div className="bb-staff-msgrow-head">
                        <b className="bb-staff-truncate">{name}</b>
                        {!isAi ? (
                          m.role_recorded ? (
                            <RolePill role={m.user_role} />
                          ) : (
                            <span className="bb-staff-pill bb-staff-role-public" title="Sent before roles were recorded — treated as public">
                              public · not recorded
                            </span>
                          )
                        ) : (
                          <span className="bb-staff-muted">replied to {m.role_recorded ? m.user_role : 'a visitor'}</span>
                        )}
                        <span className="bb-staff-muted bb-staff-msgrow-time" title={fmtDateTime(m.created_at)}>
                          {relTime(m.created_at)}
                        </span>
                      </div>
                      <div className="bb-staff-msgrow-text">{m.content}</div>
                      <a className="bb-staff-row-link bb-staff-msgrow-link" href={href(`/conversations/${encodeURIComponent(m.session_id)}`)}>
                        {m.conversation_title || 'Open conversation'} <Icon name="arrowRight" size={12} />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
            {data.total > PAGE_SIZE ? <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => setQuery({ page: p })} /> : null}
          </>
        ) : (
          <EmptyState icon="chat" title={q || role || sender ? 'No matching messages' : 'No messages yet'}>
            {q || role || sender ? 'Try a different search or filter.' : 'Messages appear here as soon as people chat with your assistant.'}
          </EmptyState>
        )
      ) : null}
    </section>
  );
}

export function MessagesPage() {
  const { query, navigate } = useStaff();
  const tab = query.tab === 'chats' ? 'chats' : 'knowledge';
  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head">
        <div>
          <h2>
            Messages <LiveDot />
          </h2>
          <p>Everything your AI has learned and every chat message — and who is allowed to see each one.</p>
        </div>
      </div>
      <div className="bb-staff-tabs" role="tablist" aria-label="Messages">
        {(
          [
            ['knowledge', 'AI knowledge', 'brain'],
            ['chats', 'Chat messages', 'chat']
          ] as const
        ).map(([k, label, icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="bb-staff-tab" onClick={() => navigate('/messages', k === 'knowledge' ? {} : { tab: k })}>
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'knowledge' ? <KnowledgeTab /> : <MessagesTab />}
    </div>
  );
}

