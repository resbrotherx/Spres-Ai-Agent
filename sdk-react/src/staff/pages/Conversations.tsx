import { Fragment, useEffect, useRef, useState } from 'react';
import { BrainboxLogo } from '../../design/Logo';
import { Icon } from '../icons';
import { useLiveEvent, useLiveRefresh } from '../live';
import type { ConversationDetail, ConversationMessage, ConversationSummary } from '../types';
import { Avatar, Button, EmptyState, ErrorState, LiveDot, Pager, ReasonChip, RolePill, Segmented, Skeleton, SkeletonRows, useStaff } from '../ui';
import { fmtDateTime, fmtNum, relTime, useAsync, useDebounced } from '../util';

const PAGE_SIZE = 20;
const ROLES = ['', 'public', 'customer', 'vendor', 'internal', 'admin'];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Chat transcript in the same bubble style as the chat widgets: user = accent bubble on the right,
 * assistant = grey bubble with the logo avatar on the left, grouped consecutive messages, day separators.
 */
export function Transcript({
  detail,
  highlight,
  limit,
  compact,
  freshIds
}: {
  detail: ConversationDetail;
  highlight?: string;
  limit?: number;
  compact?: boolean;
  freshIds?: Set<string>;
}) {
  let msgs: ConversationMessage[] = detail.messages;
  if (limit && msgs.length > limit) {
    // Keep the window around the highlighted question when there is one.
    const idx = highlight ? msgs.findIndex((m) => m.role === 'user' && m.content.trim() === highlight.trim()) : -1;
    const end = idx >= 0 ? Math.min(msgs.length, idx + 2 + Math.floor(limit / 2)) : msgs.length;
    msgs = msgs.slice(Math.max(0, end - limit), end);
  }
  return (
    <div className={`bb-staff-transcript${compact ? ' is-compact' : ''}`}>
      {msgs.map((m, i) => {
        const role = m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system';
        const prev = msgs[i - 1];
        const next = msgs[i + 1];
        const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
        const groupStart = newDay || !prev || prev.role !== m.role;
        const groupEnd = !next || next.role !== m.role || new Date(next.created_at).toDateString() !== new Date(m.created_at).toDateString();
        const isHit = !!highlight && role === 'user' && m.content.trim() === highlight.trim();
        return (
          <Fragment key={m.id}>
            {newDay && !compact ? (
              <div className="bb-staff-day-sep">
                <span>{dayLabel(m.created_at)}</span>
              </div>
            ) : null}
            <div className={`bb-staff-msg is-${role}${groupStart ? ' is-start' : ''}${groupEnd ? ' is-end' : ''}${freshIds?.has(String(m.id)) ? ' is-new' : ''}`}>
              {role === 'assistant' ? (
                <span className="bb-staff-msg-avatar">{groupEnd ? <BrainboxLogo size={26} title="" /> : null}</span>
              ) : null}
              <div className="bb-staff-msg-col">
                <span className="bb-staff-sr">{role === 'user' ? `${detail.user_name || 'User'}:` : role === 'assistant' ? 'Assistant:' : 'System:'}</span>
                <div className={`bb-staff-msg-bubble${isHit ? ' is-hit' : ''}`}>{m.content}</div>
                {groupEnd || m.gap_reason || m.feedback ? (
                  <div className="bb-staff-msg-meta">
                    <span title={fmtDateTime(m.created_at)}>{timeOnly(m.created_at)}</span>
                    {m.gap_reason ? <ReasonChip reason={m.gap_reason} /> : null}
                    {m.feedback ? (
                      <span className={`bb-staff-pill ${m.feedback === 'down' ? 'bb-staff-status-failed' : 'bb-staff-status-active'}`} title={m.feedback === 'down' ? 'User rated this answer down' : 'User rated this answer up'}>
                        <Icon name={m.feedback === 'down' ? 'thumbsDown' : 'thumbsUp'} size={12} />
                        {m.feedback === 'down' ? 'Rated down' : 'Rated up'}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ConversationsPage() {
  const { client, query, navigate, href, live } = useStaff();
  const page = Math.max(1, Number(query.page) || 1);
  const role = query.role || '';
  const q = useDebounced(query.q || '', 300);
  const { data, setData, error, loading, reload } = useAsync(() => client.listConversations({ q, user_role: role, page, page_size: PAGE_SIZE }), [client, q, role, page]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [previews, setPreviews] = useState<Record<string, { text: string; role: string }>>({});
  const setQuery = (patch: Record<string, string | number | undefined>, replace = false) => navigate('/conversations', { ...query, ...patch }, { replace });

  useLiveRefresh(live, () => void reload(true));

  useLiveEvent(live, 'conversation', (e) => {
    setPreviews((p) => ({ ...p, [e.session_id]: { text: e.preview, role: e.role } }));
    setData((d) => {
      if (!d) return d;
      const existing = d.items.find((c) => c.session_id === e.session_id);
      const passes = (!role || e.user_role === role) && (!q || `${e.title} ${e.user_name} ${e.preview}`.toLowerCase().includes(q.toLowerCase()));
      if (!existing && (!passes || page !== 1)) return d;
      const updated: ConversationSummary = existing
        ? { ...existing, message_count: existing.message_count + 1, last_message_at: e.created_at, has_gap: existing.has_gap || !!e.gap_reason }
        : { session_id: e.session_id, title: e.title, user_id: null, user_name: e.user_name, user_role: e.user_role, message_count: 1, created_at: e.created_at, last_message_at: e.created_at, has_gap: !!e.gap_reason };
      const rest = d.items.filter((c) => c.session_id !== e.session_id);
      return { ...d, total: existing ? d.total : d.total + 1, items: page === 1 ? [updated, ...rest].slice(0, PAGE_SIZE) : d.items.map((c) => (c.session_id === e.session_id ? updated : c)) };
    });
    setFresh((f) => new Set([...Array.from(f), e.session_id]));
    setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => x !== e.session_id))), 2600);
  });

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head">
        <div>
          <h2>
            Conversations <LiveDot />
          </h2>
          <p>Every chat with your assistant. Flagged conversations contain a knowledge gap.</p>
        </div>
      </div>
      <section className="bb-staff-card">
        <div className="bb-staff-toolbar">
          <div className="bb-staff-search">
            <Icon name="search" size={15} />
            <input
              className="bb-staff-input bb-staff-input-sm"
              type="search"
              placeholder="Search by title, user or message…"
              aria-label="Search conversations"
              value={query.q || ''}
              onChange={(e) => setQuery({ q: e.target.value, page: undefined }, true)}
            />
          </div>
          <div className="bb-staff-scroll-x">
            <Segmented<string>
              size="sm"
              label="Filter by audience"
              value={role}
              onChange={(v) => setQuery({ role: v || undefined, page: undefined })}
              options={ROLES.map((r) => ({ value: r, label: r ? r[0].toUpperCase() + r.slice(1) : 'All' }))}
            />
          </div>
          {data ? (
            <span className="bb-staff-toolbar-count bb-staff-num">
              {fmtNum(data.total)} conversation{data.total === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={7} /> : null}
        {data ? (
          data.items.length ? (
            <>
              <div className="bb-staff-table-wrap">
                <table className="bb-staff-table is-responsive" aria-busy={loading}>
                  <thead>
                    <tr>
                      <th>Conversation</th>
                      <th>User</th>
                      <th className="is-num">Messages</th>
                      <th>Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((c) => {
                      const to = href(`/conversations/${encodeURIComponent(c.session_id)}`);
                      const pv = previews[c.session_id];
                      return (
                        <tr key={c.session_id} className={`is-link${fresh.has(c.session_id) ? ' is-new' : ''}`} onClick={() => (window.location.hash = to)}>
                          <td className="is-primary">
                            <div className="bb-staff-conv-cell">
                              <span className={`bb-staff-tile ${c.has_gap ? 'is-warning' : 'is-accent'}`} style={{ width: 30, height: 30 }} aria-hidden="true">
                                <Icon name={c.has_gap ? 'gaps' : 'chat'} size={16} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block', maxWidth: 480 }} href={to} onClick={(e) => e.stopPropagation()}>
                                  {c.title || 'Untitled conversation'}
                                </a>
                                <div className="bb-staff-conv-sub">
                                  {pv ? (
                                    <span className="bb-staff-truncate bb-staff-preview" style={{ maxWidth: 440 }}>
                                      {pv.role === 'assistant' ? 'Assistant: ' : ''}
                                      {pv.text}
                                    </span>
                                  ) : (
                                    <span>Started {fmtDateTime(c.created_at)}</span>
                                  )}
                                  {c.has_gap ? (
                                    <span className="bb-staff-pill bb-staff-status-open bb-staff-pill-dot" title="Contains a question the assistant couldn’t answer">
                                      Gap
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="bb-staff-cell-label">User</span>
                            <span className="bb-staff-person">
                              <Avatar name={c.user_name || 'Anonymous visitor'} email={String(c.user_id || c.session_id)} size="sm" />
                              <span className="bb-staff-truncate">{c.user_name || 'Anonymous'}</span>
                              {c.user_role ? <RolePill role={c.user_role} /> : null}
                            </span>
                          </td>
                          <td className="is-num">
                            <span className="bb-staff-cell-label">Messages</span>
                            {fmtNum(c.message_count)}
                          </td>
                          <td className="bb-staff-muted" title={fmtDateTime(c.last_message_at || c.created_at)}>
                            <span className="bb-staff-cell-label">Last activity</span>
                            {relTime(c.last_message_at || c.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.total > PAGE_SIZE ? <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => setQuery({ page: p })} /> : null}
            </>
          ) : (
            <EmptyState icon="chat" title={q || role ? 'No matching conversations' : 'No conversations yet'}>
              {q || role ? 'Try a different search or audience.' : 'Conversations appear here as soon as people chat with your assistant.'}
            </EmptyState>
          )
        ) : null}
      </section>
    </div>
  );
}

export function ConversationDetailPage({ sessionId }: { sessionId: string }) {
  const { client, navigate, live } = useStaff();
  const { data, setData, error, loading, reload } = useAsync(() => client.getConversation(sessionId), [client, sessionId]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const refetch = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLiveRefresh(live, () => void reload(true));

  useLiveEvent(live, 'conversation', (e) => {
    if (e.session_id !== sessionId) return;
    // Append the preview instantly, then fetch the full message (previews are truncated).
    const tempId = String(e.message_id ?? `live-${Date.now()}`);
    setData((d) =>
      d && !d.messages.some((m) => String(m.id) === tempId)
        ? { ...d, messages: [...d.messages, { id: tempId, role: e.role, content: e.preview, created_at: e.created_at, gap_reason: e.gap_reason ?? null, feedback: null }] }
        : d
    );
    setFresh((f) => new Set([...Array.from(f), tempId]));
    setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => x !== tempId))), 2400);
    if (refetch.current) clearTimeout(refetch.current);
    refetch.current = setTimeout(() => {
      void client
        .getConversation(sessionId)
        .then((full) => {
          setData(full);
          const last = full.messages[full.messages.length - 1];
          if (last && !e.message_id) {
            setFresh((f) => new Set([...Array.from(f), String(last.id)]));
            setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => x !== String(last.id)))), 2000);
          }
        })
        .catch(() => undefined);
    }, 700);
  });

  useEffect(() => () => {
    if (refetch.current) clearTimeout(refetch.current);
  }, []);

  const count = data?.messages.length || 0;
  const prevCount = useRef(0);
  useEffect(() => {
    if (prevCount.current && count > prevCount.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    prevCount.current = count;
  }, [count]);

  const gaps = data ? data.messages.filter((m) => m.gap_reason).length : 0;
  const downs = data ? data.messages.filter((m) => m.feedback === 'down').length : 0;
  const ups = data ? data.messages.filter((m) => m.feedback === 'up').length : 0;

  return (
    <div className="bb-staff-stack" style={{ maxWidth: 920 }}>
      <div>
        <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/conversations'))}>
          Conversations
        </Button>
      </div>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      <section className="bb-staff-card" style={{ overflow: 'hidden' }}>
        <div className="bb-staff-conv-head">
          {data ? (
            <>
              <span className="bb-staff-person" style={{ minWidth: 0 }}>
                <Avatar name={data.user_name || 'Anonymous visitor'} email={String(data.user_id || data.session_id)} />
                <span className="bb-staff-person-text">
                  <span className="bb-staff-conv-title bb-staff-truncate">{data.title || 'Untitled conversation'}</span>
                  <span className="bb-staff-person-sub">
                    {data.user_name || 'Anonymous visitor'} · Started {fmtDateTime(data.created_at)}
                  </span>
                </span>
              </span>
              <div className="bb-staff-conv-chips">
                {data.user_role ? <RolePill role={data.user_role} /> : null}
                <span className="bb-staff-chip-stat">
                  <Icon name="chat" size={13} /> {fmtNum(count)}
                </span>
                {gaps ? (
                  <span className="bb-staff-chip-stat is-warning">
                    <Icon name="gaps" size={13} /> {gaps} gap{gaps === 1 ? '' : 's'}
                  </span>
                ) : null}
                {ups ? (
                  <span className="bb-staff-chip-stat is-success">
                    <Icon name="thumbsUp" size={13} /> {ups}
                  </span>
                ) : null}
                {downs ? (
                  <span className="bb-staff-chip-stat is-danger">
                    <Icon name="thumbsDown" size={13} /> {downs}
                  </span>
                ) : null}
                <LiveDot />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
              <Skeleton w={34} h={34} r={17} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton w="40%" h={16} />
                <Skeleton w="25%" h={11} />
              </div>
            </div>
          )}
        </div>
        {loading && !data ? (
          <div className="bb-staff-transcript">
            {[60, 40, 70, 35].map((w, i) => (
              <div key={i} className={`bb-staff-msg ${i % 2 ? 'is-assistant' : 'is-user'} is-start is-end`} style={{ width: `${w}%` }}>
                <Skeleton h={40} r={18} />
              </div>
            ))}
          </div>
        ) : null}
        {data && !data.messages.length ? <EmptyState icon="chat" title="No messages in this conversation" /> : null}
        {data && data.messages.length ? <Transcript detail={data} freshIds={fresh} /> : null}
        <div ref={endRef} />
      </section>
    </div>
  );
}
