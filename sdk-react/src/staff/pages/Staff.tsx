import { useLiveRefresh } from '../live';
import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { StaffRole, StaffUser } from '../types';
import {
  Alert,
  Avatar,
  Button,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  Menu,
  Modal,
  RolePill,
  SkeletonRows,
  StatusPill,
  Switch,
  useStaff
} from '../ui';
import { ADMIN_MIN_PASSWORD, errMsg, fmtDateTime, relTime, ROLE_INFO, useAsync } from '../util';
import { AccessChoice, AccessResult, AccessStatusPill, PlatformBadge, SetPasswordModal } from '../access';
import type { AccessMode } from '../access';

function staffStatus(u: StaffUser): 'active' | 'invited' | 'disabled' {
  if (!u.is_active) return 'disabled';
  if (u.invited) return 'invited';
  return 'active';
}

function InviteLinkResult({ email, url, sent }: { email: string; url: string; sent: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sent ? (
        <Alert tone="success">
          Invitation emailed to <strong>{email}</strong>. The link is valid for 7 days.
        </Alert>
      ) : (
        <Alert tone="warn">
          Email isn’t configured on the server, so no email was sent. Share this link with <strong>{email}</strong> yourself — it’s valid for 7 days.
        </Alert>
      )}
      <div className="bb-staff-field">
        <span className="bb-staff-label">Invite link</span>
        <div className="bb-staff-copy-field">
          <code title={url}>{url}</code>
          <CopyButton text={url} label="Copy link" variant={sent ? 'secondary' : 'primary'} />
        </div>
      </div>
    </div>
  );
}

function InviteModal({ roles, onClose, onInvited }: { roles: StaffRole[]; onClose: () => void; onInvited: (u: StaffUser) => void }) {
  const { client, toast } = useStaff();
  const id = useId();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>(roles.includes('trainer') ? 'trainer' : roles[roles.length - 1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AccessMode>('invite');
  const [pw, setPw] = useState('');
  const [result, setResult] = useState<{ url: string | null; sent: boolean; email: string; password?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'password' && pw.length < ADMIN_MIN_PASSWORD) return setError(`The password must be at least ${ADMIN_MIN_PASSWORD} characters.`);
    setBusy(true);
    setError(null);
    try {
      const res = await client.inviteStaff({ email: email.trim(), role, ...(name.trim() ? { full_name: name.trim() } : {}), ...(mode === 'password' ? { password: pw } : {}) });
      onInvited(res.user);
      setResult({ url: res.invite_url, sent: res.email_sent, email: res.user.email, password: res.password_set ? pw : undefined });
      if (res.email_sent) toast(`Invitation sent to ${res.user.email}`);
      else if (res.password_set) toast(`${res.user.email} can sign in now.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Modal
        title={result.password ? 'Account created' : 'Invite created'}
        description={result.password ? 'They’ll choose their own password at first sign-in.' : 'They’ll set their own password when they accept.'}
        onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Done</Button>}
      >
        {result.password ? <AccessResult email={result.email} password={result.password} /> : <InviteLinkResult email={result.email} url={result.url || ''} sent={result.sent} />}
      </Modal>
    );
  }

  return (
    <Modal
      title="Invite staff"
      description="Send an invite link, or set a temporary password if you’d rather hand over the login yourself."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={mode === 'password' ? 'plus' : 'send'} type="submit" form={`${id}-form`} loading={busy} disabled={!email.trim()}>
            {mode === 'password' ? 'Create account' : 'Send invite'}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="bb-staff-form-grid">
          <Field label="Email" htmlFor={`${id}-email`}>
            <input id={`${id}-email`} type="email" className="bb-staff-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" required data-autofocus />
          </Field>
          <Field label="Full name (optional)" htmlFor={`${id}-name`}>
            <input id={`${id}-name`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grace Hopper" />
          </Field>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="bb-staff-label" style={{ marginBottom: 8 }}>
            Role
          </legend>
          <div className="bb-staff-radio-cards is-roles">
            {roles.map((r) => (
              <label key={r} className={`bb-staff-radio-card${role === r ? ' is-checked' : ''}`}>
                <input type="radio" name={`${id}-role`} value={r} checked={role === r} onChange={() => setRole(r)} />
                <b>
                  <RolePill role={r} />
                </b>
                <span>{ROLE_INFO[r].desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <AccessChoice mode={mode} setMode={setMode} password={pw} setPassword={setPw} inviteHint="We email them a link (valid 7 days) to choose their own password." />
      </form>
    </Modal>
  );
}

export function StaffPage() {
  const { client, user: me, can, toast, query, setUser, live } = useStaff();
  const { data, setData, error, loading, reload } = useAsync(() => client.listStaff(), [client]);
  useLiveRefresh(live, () => void reload(true), ['staff']);
  const [inviting, setInviting] = useState(false);
  const [confirmId, setConfirmId] = useState<string | number | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [linkResult, setLinkResult] = useState<{ email: string; url: string; sent: boolean } | null>(null);
  const [pwFor, setPwFor] = useState<StaffUser | null>(null);
  const isAdmin = can('admin');
  const isOwner = can('owner');
  const assignable: StaffRole[] = isOwner ? ['owner', 'admin', 'trainer', 'viewer'] : ['trainer', 'viewer'];

  // Platform-admin accounts can only be changed by a platform admin (the API enforces this too).
  const canManage = (u: StaffUser) =>
    isAdmin && String(u.id) !== String(me.id) && (isOwner || (u.role !== 'owner' && u.role !== 'admin')) && (!u.is_platform_admin || !!me.is_platform_admin);

  const filtered = useMemo(() => {
    const q = (query.q || '').trim().toLowerCase();
    const list = data || [];
    const rank: Record<string, number> = { owner: 0, admin: 1, trainer: 2, viewer: 3 };
    return list
      .filter((u) => !q || [u.full_name, u.email, u.role].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || (a.full_name || a.email).localeCompare(b.full_name || b.email));
  }, [data, query.q]);

  const replace = (u: StaffUser) => setData((list) => (list ? list.map((x) => (String(x.id) === String(u.id) ? u : x)) : list));

  const patch = async (u: StaffUser, body: Parameters<typeof client.updateStaff>[1], msg: string) => {
    setBusyId(u.id);
    try {
      const updated = await client.updateStaff(u.id, body);
      replace(updated);
      toast(msg);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const updateSelf = async (body: { notify_email?: boolean; notify_in_app?: boolean }) => {
    try {
      const updated = await client.updateMe(body);
      replace(updated);
      setUser(updated);
      toast('Notification preferences saved.');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const remove = async (u: StaffUser) => {
    setBusyId(u.id);
    try {
      await client.deleteStaff(u.id);
      setData((list) => (list ? list.filter((x) => x.id !== u.id) : list));
      toast(`${u.full_name || u.email} was removed.`);
      setConfirmId(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resend = async (u: StaffUser) => {
    setBusyId(u.id);
    try {
      const res = await client.resendInvite(u.id);
      setLinkResult({ email: u.email, url: res.invite_url, sent: res.email_sent });
      if (res.email_sent) toast(`Invite re-sent to ${u.email}`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { active: 0, invited: 0, disabled: 0 };
    (data || []).forEach((u) => c[staffStatus(u)]++);
    return c;
  }, [data]);

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Staff</h2>
          <p>
            {data ? (
              <>
                {counts.active} active · {counts.invited} invited · {counts.disabled} disabled. Everyone active is notified about new knowledge gaps.
              </>
            ) : (
              'Your team and what they can do.'
            )}
          </p>
        </div>
        {isAdmin ? (
          <Button variant="primary" icon="plus" onClick={() => setInviting(true)}>
            Invite staff
          </Button>
        ) : null}
      </div>

      {!isAdmin ? <Alert tone="info">You can see your team. Only admins and owners can invite or change staff.</Alert> : null}

      <section className="bb-staff-card">
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={6} /> : null}
        {data ? (
          filtered.length ? (
            <div className="bb-staff-table-wrap">
              <table className="bb-staff-table is-responsive">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Email alerts</th>
                    <th>In-app</th>
                    <th>Last login</th>
                    <th className="is-actions">
                      <span className="bb-staff-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const manage = canManage(u);
                    const self = String(u.id) === String(me.id);
                    const st = staffStatus(u);
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id}>
                        <td className="is-primary">
                          <span className="bb-staff-person">
                            <Avatar name={u.full_name} email={u.email} />
                            <span className="bb-staff-person-text">
                              <span className="bb-staff-person-name" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span className="bb-staff-truncate">{u.full_name || u.email.split('@')[0]}</span>
                                {self ? <span className="bb-staff-count">You</span> : null}
                                {u.is_platform_admin ? <PlatformBadge compact /> : null}
                              </span>
                              <span className="bb-staff-person-sub bb-staff-truncate" style={{ display: 'block' }}>
                                {u.email}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Role</span>
                          {manage ? (
                            <select
                              className="bb-staff-input bb-staff-input-sm"
                              style={{ width: 120 }}
                              aria-label={`Role for ${u.email}`}
                              value={u.role}
                              disabled={busy}
                              onChange={(e) => void patch(u, { role: e.target.value as StaffRole }, `${u.full_name || u.email} is now ${ROLE_INFO[e.target.value as StaffRole].label.toLowerCase()}.`)}
                            >
                              {(assignable.includes(u.role) ? assignable : [u.role, ...assignable]).map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_INFO[r].label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <RolePill role={u.role} />
                          )}
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Status</span>
                          <AccessStatusPill user={u} />
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Email alerts</span>
                          <Switch
                            size="sm"
                            checked={u.notify_email}
                            label={`Email notifications for ${u.email}`}
                            disabled={busy || !(self || manage)}
                            onChange={(v) => (self ? void updateSelf({ notify_email: v }) : void patch(u, { notify_email: v }, `Email alerts ${v ? 'enabled' : 'disabled'} for ${u.full_name || u.email}.`))}
                          />
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">In-app</span>
                          <Switch
                            size="sm"
                            checked={u.notify_in_app}
                            label={self ? 'In-app notifications' : `In-app notifications for ${u.email} (only they can change this)`}
                            disabled={!self}
                            onChange={(v) => void updateSelf({ notify_in_app: v })}
                          />
                        </td>
                        <td className="bb-staff-muted" title={fmtDateTime(u.last_login_at)}>
                          <span className="bb-staff-cell-label">Last login</span>
                          {u.invited ? 'Pending invite' : relTime(u.last_login_at)}
                        </td>
                        <td className="is-actions">
                          {confirmId === u.id ? (
                            <span className="bb-staff-confirm">
                              Remove {u.full_name || u.email}?
                              <Button size="sm" variant="danger" loading={busy} onClick={() => void remove(u)} autoFocus>
                                Remove
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} onKeyDown={(e) => e.key === 'Escape' && setConfirmId(null)}>
                                Cancel
                              </Button>
                            </span>
                          ) : manage ? (
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              {u.invited ? (
                                <Button size="sm" variant="ghost" icon="mail" loading={busy} onClick={() => void resend(u)}>
                                  Resend
                                </Button>
                              ) : null}
                              <Menu
                                label={`Actions for ${u.email}`}
                                items={[
                                  ...(u.invited ? [{ label: 'Resend invite', icon: 'mail' as const, onSelect: () => void resend(u) }] : []),
                                  { label: 'Set password', icon: 'key' as const, onSelect: () => setPwFor(u) },
                                  u.is_active
                                    ? { label: 'Disable access', icon: 'ban' as const, onSelect: () => void patch(u, { is_active: false }, `${u.full_name || u.email} was disabled.`) }
                                    : { label: 'Re-enable access', icon: 'check' as const, onSelect: () => void patch(u, { is_active: true }, `${u.full_name || u.email} was re-enabled.`) },
                                  'sep' as const,
                                  { label: 'Remove from team', icon: 'trash' as const, danger: true, onSelect: () => setConfirmId(u.id) }
                                ]}
                              />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="staff" title={query.q ? 'No matching staff' : 'No staff yet'} action={isAdmin && !query.q ? <Button variant="primary" icon="plus" onClick={() => setInviting(true)}>Invite staff</Button> : undefined}>
              {query.q ? 'Try a different search.' : 'Invite your team so everyone gets notified about knowledge gaps.'}
            </EmptyState>
          )
        ) : null}
      </section>

      <section className="bb-staff-card">
        <div className="bb-staff-card-head">
          <div>
            <h3>Roles</h3>
            <p>What each role can do in the staff console</p>
          </div>
        </div>
        <div className="bb-staff-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(['owner', 'admin', 'trainer', 'viewer'] as StaffRole[]).map((r) => (
            <div key={r} style={{ padding: 14, borderRadius: 12, border: '1px solid var(--bbs-separator)', background: 'var(--bbs-surface-2)' }}>
              <RolePill role={r} />
              <p className="bb-staff-hint" style={{ marginTop: 8 }}>
                {ROLE_INFO[r].desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {inviting ? (
        <InviteModal
          roles={assignable}
          onClose={() => setInviting(false)}
          onInvited={(u) => setData((list) => (list ? [...list.filter((x) => x.id !== u.id), u] : [u]))}
        />
      ) : null}
      {pwFor ? (
        <SetPasswordModal
          user={pwFor}
          onClose={() => setPwFor(null)}
          onSubmit={async (password, mustChange) => {
            const res = await client.setStaffPassword(pwFor.id, { password, must_change_password: mustChange });
            replace(res.user);
          }}
        />
      ) : null}
      {linkResult ? (
        <Modal title="Invite link" description="Resent invitation" onClose={() => setLinkResult(null)} footer={<Button variant="primary" onClick={() => setLinkResult(null)}>Done</Button>}>
          <InviteLinkResult {...linkResult} />
        </Modal>
      ) : null}
    </div>
  );
}
