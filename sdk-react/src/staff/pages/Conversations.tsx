import { Icon } from '../icons';
import { Avatar, Button, EmptyState, ErrorState, Pager, ReasonChip, RolePill, Skeleton, SkeletonRows, useStaff } from '../ui';
import { fmtDateTime, fmtNum, relTime, useAsync, useDebounced } from '../util';

const PAGE_SIZE = 20;
const ROLES = ['', 'public', 'customer', 'vendor', 'internal', 'admin'];

export function ConversationsPage() {
  const { client, query, navigate, href } = useStaff();
  const page = Math.max(1, Number(query.page) || 1);
  const role = query.role || '';
  const q = useDebounced(query.q || '', 300);
  const { data, error, loading, reload } = useAsync(
    () => client.listConversations({ q, user_role: role, page, page_size: PAGE_SIZE }),
    [client, q, role, page]
  );
  const setQuery = (patch: Record<string, string | number | undefined>, replace = false) => navigate('/conversations', { ...query, ...patch }, { replace });

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Conversations</h2>
          <p>Every chat with your assistant. Flagged conversations contain a knowledge gap.</p>
        </div>
      </div>
      <section className="bb-staff-card">
        <div className="bb-staff-filters">
          <div className="bb-staff-search">
            <Icon name="search" size={16} />
            <input
              className="bb-staff-input bb-staff-input-sm"
              type="search"
              placeholder="Search by title or user…"
              aria-label="Search conversations"
              value={query.q || ''}
              onChange={(e) => setQuery({ q: e.target.value, page: undefined }, true)}
            />
          </div>
          <select className="bb-staff-input bb-staff-input-sm" style={{ width: 'auto', minWidth: 150 }} aria-label="Filter by role" value={role} onChange={(e) => setQuery({ role: e.target.value || undefined, page: undefined })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r ? r[0].toUpperCase() + r.slice(1) : 'All audiences'}
              </option>
            ))}
          </select>
          {data ? (
            <span className="bb-staff-muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
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
                      return (
                        <tr key={c.session_id} className="is-link" onClick={() => (window.location.hash = to)}>
                          <td className="is-primary">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <span className="bb-staff-kpi-icon is-sky" style={{ width: 30, height: 30 }}>
                                <Icon name="chat" size={15} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block', maxWidth: 460 }} href={to} onClick={(e) => e.stopPropagation()}>
                                  {c.title || 'Untitled conversation'}
                                </a>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                                  <span className="bb-staff-muted" style={{ fontSize: 12 }}>
                                    Started {fmtDateTime(c.created_at)}
                                  </span>
                                  {c.has_gap ? (
                                    <span className="bb-staff-pill bb-staff-status-open" title="Contains a question the assistant couldn’t answer">
                                      <Icon name="gaps" size={12} /> Gap
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
                              <span className="bb-staff-truncate" style={{ fontWeight: 550 }}>
                                {c.user_name || 'Anonymous'}
                              </span>
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
  const { client, navigate } = useStaff();
  const { data, error, loading, reload } = useAsync(() => client.getConversation(sessionId), [client, sessionId]);

  return (
    <div className="bb-staff-stack">
      <div>
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/conversations'))}>
          Back to conversations
        </Button>
      </div>
      {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
      <section className="bb-staff-card" style={{ overflow: 'hidden' }}>
        <div className="bb-staff-card-head" style={{ paddingBottom: 16, borderBottom: '1px solid var(--bbs-border)', alignItems: 'flex-start' }}>
          {data ? (
            <>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 17 }}>{data.title || 'Untitled conversation'}</h3>
                <p>
                  Started {fmtDateTime(data.created_at)} · {fmtNum(data.messages.length)} messages
                </p>
              </div>
              <span className="bb-staff-person">
                <Avatar name={data.user_name || 'Anonymous visitor'} email={String(data.user_id || data.session_id)} />
                <span className="bb-staff-person-text">
                  <span className="bb-staff-person-name" style={{ display: 'block' }}>
                    {data.user_name || 'Anonymous visitor'}
                  </span>
                  {data.user_role ? <RolePill role={data.user_role} /> : null}
                </span>
              </span>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <Skeleton w="40%" h={18} />
              <Skeleton w="25%" h={12} />
            </div>
          )}
        </div>
        <div className="bb-staff-transcript" aria-live="off">
          {loading && !data
            ? [60, 40, 70, 35].map((w, i) => (
                <div key={i} className={`bb-staff-msg ${i % 2 ? 'is-assistant' : 'is-user'}`} style={{ width: `${w}%` }}>
                  <Skeleton h={44} r={16} />
                </div>
              ))
            : null}
          {data && !data.messages.length ? <EmptyState icon="chat" title="No messages in this conversation" /> : null}
          {data?.messages.map((m) => {
            const role = m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system';
            return (
              <div key={m.id} className={`bb-staff-msg is-${role}`}>
                {role === 'assistant' ? (
                  <span className="bb-staff-bot-avatar" aria-hidden="true">
                    <Icon name="brain" size={15} />
                  </span>
                ) : role === 'user' ? (
                  <Avatar name={data.user_name || 'Anonymous visitor'} email={String(data.user_id || data.session_id)} size="sm" />
                ) : null}
                <div style={{ minWidth: 0 }}>
                  <span className="bb-staff-sr">{role === 'user' ? `${data.user_name || 'User'}:` : role === 'assistant' ? 'Assistant:' : 'System:'}</span>
                  <div className="bb-staff-msg-bubble">{m.content}</div>
                  <div className="bb-staff-msg-time" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: role === 'user' ? 'flex-end' : undefined }}>
                    {fmtDateTime(m.created_at)}
                    {m.gap_reason ? <ReasonChip reason={m.gap_reason} /> : null}
                    {m.feedback ? (
                      <span className={`bb-staff-pill ${m.feedback === 'down' ? 'bb-staff-status-failed' : 'bb-staff-status-active'}`} title={m.feedback === 'down' ? 'User rated this answer down' : 'User rated this answer up'}>
                        <Icon name={m.feedback === 'down' ? 'thumbsDown' : 'check'} size={12} />
                        {m.feedback === 'down' ? 'Rated down' : 'Rated up'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
