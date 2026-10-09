import { useLiveRefresh } from '../live';
/* Platform admin pages: Companies (tenants), Company detail, All users, All API keys. */
import { useId, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import {
  AccessChoice,
  AccessResult,
  AccessStatusPill,
  KeyStatusPill,
  KeyTypeLegend,
  KeyTypePill,
  NeverShownNote,
  PlatformBadge,
  RawKeyList,
  RawKeyModal,
  SecretField,
  SetPasswordModal
} from '../access';
import type { AccessMode } from '../access';
import type {
  ApiKeyType,
  CreateTenantResponse,
  PlatformApiKey,
  PlatformTenant,
  PlatformUser,
  PlatformUserStatus,
  StaffRole
} from '../types';
import { STAFF_ROLES } from '../types';
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Menu,
  Modal,
  Skeleton,
  SkeletonRows,
  useStaff
} from '../ui';
import { ADMIN_MIN_PASSWORD, copyText, errMsg, fmtDateTime, fmtNum, relTime, ROLE_INFO, shortId, useAsync, useDebounced } from '../util';

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function TenantIdChip({ id, max = 22 }: { id: string; max?: number }) {
  return (
    <span className="bb-staff-id-chip" title={id}>
      <code>{shortId(id, max)}</code>
      <CopyIcon text={id} label="Copy tenant id" />
    </span>
  );
}

function CopyIcon({ text, label }: { text: string; label: string }) {
  const { toast } = useStaff();
  const [done, setDone] = useState(false);
  return (
    <IconButton
      icon={done ? 'check' : 'copy'}
      label={label}
      size="sm"
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } else toast('Couldn’t copy — select the text and copy it manually.', 'error');
      }}
    />
  );
}

function Kpi({ label, value, icon, tone, meta }: { label: string; value: ReactNode; icon: StaffIconName; tone?: 'warn' | 'sky' | 'green'; meta?: ReactNode }) {
  return (
    <div className="bb-staff-card bb-staff-kpi">
      <div className="bb-staff-kpi-top">
        <span className="bb-staff-kpi-label">{label}</span>
        <span className={`bb-staff-kpi-icon${tone ? ` is-${tone}` : ''}`}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="bb-staff-kpi-value bb-staff-num">{value}</div>
      <div className="bb-staff-kpi-meta">{meta}</div>
    </div>
  );
}

function KpiSkeletons({ n = 6 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bb-staff-card bb-staff-kpi">
          <Skeleton w="50%" h={12} />
          <Skeleton w="60%" h={26} />
          <Skeleton w="80%" h={10} />
        </div>
      ))}
    </>
  );
}

function KeyCounts({ pk, sk }: { pk: number; sk: number }) {
  return (
    <span className="bb-staff-mini-stats" aria-label={`${pk} publishable, ${sk} secret active keys`}>
      <span className={`is-pk${pk ? '' : ' is-zero'}`} title="Active publishable keys">
        pk {pk}
      </span>
      <span className={`is-sk${sk ? '' : ' is-zero'}`} title="Active secret keys">
        sk {sk}
      </span>
    </span>
  );
}

function LegendCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bb-staff-card">
      <div className="bb-staff-card-head" style={{ paddingBottom: open ? 14 : 18 }}>
        <div>
          <h3>Keys, tokens & passwords</h3>
          <p>Which credential is which — and why existing keys and passwords can’t be displayed.</p>
        </div>
        <Button size="sm" variant="ghost" iconRight={open ? 'chevronDown' : 'chevronRight'} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Explain'}
        </Button>
      </div>
      {open ? (
        <div className="bb-staff-card-body bb-staff-stack" style={{ paddingTop: 0, gap: 12 }}>
          <KeyTypeLegend />
          <NeverShownNote what="both" />
        </div>
      ) : null}
    </section>
  );
}

const STATUS_FILTERS: { key: PlatformUserStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'invited', label: 'Invited' },
  { key: 'must_change', label: 'Must change password' },
  { key: 'disabled', label: 'Disabled' }
];

/* ------------------------------------------------------------------ */
/* Users table (company detail + all users)                            */
/* ------------------------------------------------------------------ */

function UsersTable({ users, showCompany, onChange, onRemoved }: { users: PlatformUser[]; showCompany?: boolean; onChange: (u: PlatformUser) => void; onRemoved: (u: PlatformUser) => void }) {
  const { client, user: me, toast, href } = useStaff();
  const [busy, setBusy] = useState<string | number | null>(null);
  const [confirm, setConfirm] = useState<string | number | null>(null);
  const [pwFor, setPwFor] = useState<PlatformUser | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const run = async (u: PlatformUser, fn: () => Promise<PlatformUser | void>, msg?: string) => {
    setBusy(u.id);
    try {
      const res = await fn();
      if (res) onChange(res);
      if (msg) toast(msg);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: PlatformUser) => {
    setBusy(u.id);
    try {
      await client.deletePlatformUser(u.id);
      onRemoved(u);
      setConfirm(null);
      toast(`${u.full_name || u.email} was removed.`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const inviteLink = async (u: PlatformUser) => {
    setBusy(u.id);
    try {
      const res = await client.platformInviteLink(u.id);
      setLink({ email: u.email, url: res.invite_url });
      onChange({ ...u, invited: true, status: u.is_active ? 'invited' : u.status });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="bb-staff-table-wrap">
        <table className="bb-staff-table is-responsive">
          <thead>
            <tr>
              <th>User</th>
              {showCompany ? <th>Company</th> : null}
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th className="is-actions">
                <span className="bb-staff-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = String(u.id) === String(me.id);
              const isBusy = busy === u.id;
              const name = u.full_name || u.email.split('@')[0];
              return (
                <tr key={u.id}>
                  <td className="is-primary">
                    <span className="bb-staff-person">
                      <Avatar name={u.full_name} email={u.email} />
                      <span className="bb-staff-person-text">
                        <span className="bb-staff-person-name" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="bb-staff-truncate">{name}</span>
                          {self ? <span className="bb-staff-count">You</span> : null}
                          {u.is_platform_admin ? <PlatformBadge compact /> : null}
                        </span>
                        <span className="bb-staff-person-sub bb-staff-truncate" style={{ display: 'block' }}>
                          {u.email}
                        </span>
                      </span>
                    </span>
                  </td>
                  {showCompany ? (
                    <td style={{ maxWidth: 220 }}>
                      <span className="bb-staff-cell-label">Company</span>
                      <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block' }} href={href(`/platform/companies/${encodeURIComponent(u.tenant_id)}`)} title={u.tenant_id}>
                        {u.tenant_name === u.tenant_id ? shortId(u.tenant_id, 26) : u.tenant_name}
                      </a>
                    </td>
                  ) : null}
                  <td>
                    <span className="bb-staff-cell-label">Role</span>
                    <select
                      className="bb-staff-input bb-staff-input-sm"
                      style={{ width: 118 }}
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={isBusy}
                      onChange={(e) => {
                        const role = e.target.value as StaffRole;
                        void run(u, () => client.updatePlatformUser(u.id, { role }), `${name} is now ${ROLE_INFO[role].label.toLowerCase()}.`);
                      }}
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_INFO[r].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="bb-staff-cell-label">Status</span>
                    <AccessStatusPill user={u} />
                  </td>
                  <td className="bb-staff-muted" title={fmtDateTime(u.last_login_at)}>
                    <span className="bb-staff-cell-label">Last login</span>
                    {u.invited ? 'Pending invite' : relTime(u.last_login_at)}
                  </td>
                  <td className="is-actions">
                    {confirm === u.id ? (
                      <span className="bb-staff-confirm">
                        Remove {name}?
                        <Button size="sm" variant="danger" loading={isBusy} onClick={() => void remove(u)} autoFocus>
                          Remove
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {self ? null : (
                          <Button size="sm" variant="ghost" icon="key" loading={isBusy} onClick={() => setPwFor(u)}>
                            Set password
                          </Button>
                        )}
                        <Menu
                          label={`Actions for ${u.email}`}
                          items={[
                            ...(u.invited || !u.has_password ? [{ label: 'Copy invite link', icon: 'link' as const, onSelect: () => void inviteLink(u) }] : []),
                            u.is_platform_admin
                              ? {
                                  label: self ? 'Platform admin (you)' : 'Remove platform admin',
                                  icon: 'shield' as const,
                                  onSelect: () =>
                                    self
                                      ? toast('You can’t remove your own platform admin access.', 'info')
                                      : void run(u, () => client.updatePlatformUser(u.id, { is_platform_admin: false }), `${name} is no longer a platform admin.`)
                                }
                              : { label: 'Make platform admin', icon: 'shield' as const, onSelect: () => void run(u, () => client.updatePlatformUser(u.id, { is_platform_admin: true }), `${name} is now a platform admin.`) },
                            ...(self
                              ? []
                              : [
                                  u.is_active
                                    ? { label: 'Disable access', icon: 'ban' as const, onSelect: () => void run(u, () => client.updatePlatformUser(u.id, { is_active: false }), `${name} was disabled.`) }
                                    : { label: 'Re-enable access', icon: 'check' as const, onSelect: () => void run(u, () => client.updatePlatformUser(u.id, { is_active: true }), `${name} was re-enabled.`) },
                                  'sep' as const,
                                  { label: 'Remove user', icon: 'trash' as const, danger: true, onSelect: () => setConfirm(u.id) }
                                ])
                          ]}
                        />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pwFor ? (
        <SetPasswordModal
          user={pwFor}
          onClose={() => setPwFor(null)}
          onSubmit={async (password, mustChange) => {
            const res = await client.setPlatformUserPassword(pwFor.id, { password, must_change_password: mustChange });
            onChange(res.user);
          }}
        />
      ) : null}
      {link ? (
        <Modal title="Invite link" description="A new link was created; older links for this user stop working." onClose={() => setLink(null)} footer={<Button variant="primary" onClick={() => setLink(null)}>Done</Button>}>
          <AccessResult email={link.email} inviteUrl={link.url} emailSent={false} />
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Add user modal                                                      */
/* ------------------------------------------------------------------ */

function AddUserModal({ tenants, tenantId, onClose, onCreated }: { tenants?: PlatformTenant[]; tenantId?: string; onClose: () => void; onCreated: (u: PlatformUser) => void }) {
  const { client, toast } = useStaff();
  const id = useId();
  const [tenant, setTenant] = useState(tenantId || tenants?.[0]?.tenant_id || '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('admin');
  const [mode, setMode] = useState<AccessMode>('invite');
  const [pw, setPw] = useState('');
  const [pa, setPa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; invite?: string; sent?: boolean; password?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'password' && pw.length < ADMIN_MIN_PASSWORD) return setError(`The password must be at least ${ADMIN_MIN_PASSWORD} characters.`);
    setBusy(true);
    setError(null);
    try {
      const res = await client.createPlatformUser({
        tenant_id: tenant,
        email: email.trim(),
        role,
        ...(name.trim() ? { full_name: name.trim() } : {}),
        ...(mode === 'password' ? { password: pw, must_change_password: true } : {}),
        ...(pa ? { is_platform_admin: true } : {})
      });
      onCreated(res.user);
      setResult({ email: res.user.email, invite: res.invite_url, sent: res.email_sent, password: mode === 'password' ? pw : undefined });
      toast(`${res.user.email} was added.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Modal title="User added" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <AccessResult email={result.email} inviteUrl={result.invite} emailSent={result.sent} password={result.password} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Add user"
      description="Create a dashboard account for someone at a company."
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="plus" type="submit" form={`${id}-f`} loading={busy} disabled={!email.trim() || !tenant}>
            Add user
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} onSubmit={submit} className="bb-staff-stack" style={{ gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!tenantId && tenants ? (
          <Field label="Company" htmlFor={`${id}-t`}>
            <select id={`${id}-t`} className="bb-staff-input" value={tenant} onChange={(e) => setTenant(e.target.value)} required>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.display_name === t.tenant_id ? shortId(t.tenant_id, 40) : `${t.display_name} (${shortId(t.tenant_id, 24)})`}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="bb-staff-form-grid">
          <Field label="Email" htmlFor={`${id}-e`}>
            <input id={`${id}-e`} type="email" className="bb-staff-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" required data-autofocus />
          </Field>
          <Field label="Full name (optional)" htmlFor={`${id}-n`}>
            <input id={`${id}-n`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Role" htmlFor={`${id}-r`} hint={ROLE_INFO[role].desc}>
            <select id={`${id}-r`} className="bb-staff-input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </select>
          </Field>
          <div className="bb-staff-field" style={{ justifyContent: 'center' }}>
            <label className="bb-staff-check">
              <input type="checkbox" checked={pa} onChange={(e) => setPa(e.target.checked)} />
              <span>
                <b>Platform admin</b>
                <span className="bb-staff-hint" style={{ display: 'block' }}>
                  Can manage every company. Only for Brainbox operators.
                </span>
              </span>
            </label>
          </div>
        </div>
        <AccessChoice mode={mode} setMode={setMode} password={pw} setPassword={setPw} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Keys table (company detail + all keys)                              */
/* ------------------------------------------------------------------ */

function KeysTable({ keys, showCompany, onChange }: { keys: PlatformApiKey[]; showCompany?: boolean; onChange: (updated: PlatformApiKey[], added?: PlatformApiKey) => void }) {
  const { client, toast, href } = useStaff();
  const [confirm, setConfirm] = useState<{ id: string | number; action: 'roll' | 'revoke' } | null>(null);
  const [busy, setBusy] = useState<string | number | null>(null);
  const [rolled, setRolled] = useState<{ key: PlatformApiKey; raw_key: string; oldName: string } | null>(null);

  const roll = async (k: PlatformApiKey) => {
    setBusy(k.id);
    try {
      const res = await client.rollPlatformKey(k.id);
      onChange(keys.map((x) => (x.id === k.id ? { ...x, is_active: false } : x)), res.key);
      setRolled({ key: res.key, raw_key: res.raw_key, oldName: k.key_prefix });
      setConfirm(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const revoke = async (k: PlatformApiKey) => {
    setBusy(k.id);
    try {
      await client.revokePlatformKey(k.id);
      onChange(keys.map((x) => (x.id === k.id ? { ...x, is_active: false } : x)));
      toast(`Key “${k.name}” revoked.`);
      setConfirm(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="bb-staff-table-wrap">
        <table className="bb-staff-table is-responsive">
          <thead>
            <tr>
              {showCompany ? <th>Company</th> : null}
              <th>Name</th>
              <th>Type</th>
              <th>Key</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last used</th>
              <th className="is-actions">
                <span className="bb-staff-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                {showCompany ? (
                  <td className="is-primary" style={{ maxWidth: 220 }}>
                    <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block' }} href={href(`/platform/companies/${encodeURIComponent(k.tenant_id)}/keys`)} title={k.tenant_id}>
                      {k.tenant_name === k.tenant_id ? shortId(k.tenant_id, 26) : k.tenant_name}
                    </a>
                  </td>
                ) : null}
                <td className={showCompany ? undefined : 'is-primary'} style={{ fontWeight: 500 }}>
                  <span className="bb-staff-cell-label">Name</span>
                  {k.name}
                </td>
                <td>
                  <span className="bb-staff-cell-label">Type</span>
                  <KeyTypePill type={k.key_type} />
                </td>
                <td>
                  <span className="bb-staff-cell-label">Key</span>
                  <code className="bb-staff-mono" title="Only the prefix is stored in readable form">
                    {k.key_prefix}…
                  </code>
                </td>
                <td>
                  <span className="bb-staff-cell-label">Status</span>
                  <KeyStatusPill k={k} />
                </td>
                <td className="bb-staff-muted" title={fmtDateTime(k.created_at)}>
                  <span className="bb-staff-cell-label">Created</span>
                  {relTime(k.created_at)}
                  {k.expires_at ? <div style={{ fontSize: 11.5 }}>Expires {fmtDateTime(k.expires_at)}</div> : null}
                </td>
                <td className="bb-staff-muted">
                  <span className="bb-staff-cell-label">Last used</span>
                  {relTime(k.last_used)}
                </td>
                <td className="is-actions">
                  {!k.is_active ? null : confirm?.id === k.id ? (
                    <span className="bb-staff-confirm">
                      {confirm.action === 'roll' ? 'Roll? The current key stops working now.' : 'Revoke? Apps using it stop working.'}
                      <Button size="sm" variant="danger" loading={busy === k.id} onClick={() => void (confirm.action === 'roll' ? roll(k) : revoke(k))} autoFocus>
                        {confirm.action === 'roll' ? 'Roll key' : 'Revoke'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <Button size="sm" variant="ghost" icon="refresh" onClick={() => setConfirm({ id: k.id, action: 'roll' })}>
                        Roll
                      </Button>
                      <Button size="sm" variant="danger-ghost" icon="ban" onClick={() => setConfirm({ id: k.id, action: 'revoke' })}>
                        Revoke
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rolled ? (
        <RawKeyModal
          title="Key rolled — copy the new key"
          result={rolled}
          onClose={() => setRolled(null)}
          note={
            <Alert tone="info">
              The old key <code className="bb-staff-mono">{rolled.oldName}…</code> was revoked. Update every app or server that used it with the new key below.
            </Alert>
          }
        />
      ) : null}
    </>
  );
}

function CreateKeyModal({ tenants, tenantId, onClose, onCreated }: { tenants?: PlatformTenant[]; tenantId?: string; onClose: () => void; onCreated: (k: PlatformApiKey) => void }) {
  const { client } = useStaff();
  const id = useId();
  const [tenant, setTenant] = useState(tenantId || tenants?.[0]?.tenant_id || '');
  const [name, setName] = useState('');
  const [type, setType] = useState<ApiKeyType>('publishable');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<{ key: PlatformApiKey; raw_key: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await client.createPlatformKey({ tenant_id: tenant, name: name.trim(), key_type: type, ...(expires ? { expires_at: new Date(`${expires}T23:59:59`).toISOString() } : {}) });
      onCreated(res.key);
      setRaw(res);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (raw) return <RawKeyModal result={raw} onClose={onClose} />;
  return (
    <Modal
      title="Create API key"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-f`} loading={busy} disabled={!name.trim() || !tenant}>
            Create key
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} onSubmit={submit} className="bb-staff-stack" style={{ gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!tenantId && tenants ? (
          <Field label="Company" htmlFor={`${id}-t`}>
            <select id={`${id}-t`} className="bb-staff-input" value={tenant} onChange={(e) => setTenant(e.target.value)}>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.display_name === t.tenant_id ? shortId(t.tenant_id, 40) : t.display_name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Name" htmlFor={`${id}-n`} hint="e.g. “Website chat” or “Odoo production”.">
          <input id={`${id}-n`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} required data-autofocus />
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="bb-staff-label" style={{ marginBottom: 8 }}>
            Type
          </legend>
          <div className="bb-staff-radio-cards">
            {(
              [
                ['publishable', 'globe', 'Publishable (pk_live_…)', 'Browser, website, mobile. Chat only — this is the “client key”.'],
                ['secret', 'lock', 'Secret (sk_live_…)', 'Servers, Odoo, training. Never in a browser.']
              ] as const
            ).map(([v, icon, label, desc]) => (
              <label key={v} className={`bb-staff-radio-card${type === v ? ' is-checked' : ''}`}>
                <input type="radio" name={`${id}-k`} checked={type === v} onChange={() => setType(v)} />
                <b>
                  <Icon name={icon} size={15} /> {label}
                </b>
                <span>{desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Expires (optional)" htmlFor={`${id}-x`} hint="Leave empty for a key that doesn’t expire.">
          <input id={`${id}-x`} type="date" className="bb-staff-input" value={expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Companies                                                           */
/* ------------------------------------------------------------------ */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: PlatformTenant) => void }) {
  const { client, navigate } = useStaff();
  const id = useId();
  const [name, setName] = useState('');
  const [tid, setTid] = useState('');
  const [tidTouched, setTidTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mode, setMode] = useState<AccessMode>('invite');
  const [pw, setPw] = useState('');
  const [pk, setPk] = useState(true);
  const [sk, setSk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ res: CreateTenantResponse; password?: string } | null>(null);
  const tenantId = tidTouched ? tid : slugify(name);
  const tidValid = /^[A-Za-z0-9._-]{3,64}$/.test(tenantId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tidValid) return setError('Tenant id must be 3–64 characters: letters, digits, “.”, “_” or “-”.');
    if (mode === 'password' && pw.length < ADMIN_MIN_PASSWORD) return setError(`The password must be at least ${ADMIN_MIN_PASSWORD} characters.`);
    setBusy(true);
    setError(null);
    try {
      const res = await client.createTenant({
        tenant_id: tenantId,
        display_name: name.trim() || undefined,
        owner: { email: email.trim(), ...(ownerName.trim() ? { full_name: ownerName.trim() } : {}), ...(mode === 'password' ? { password: pw } : {}) },
        create_keys: { publishable: pk, secret: sk }
      });
      onCreated(res.tenant);
      setResult({ res, password: mode === 'password' ? pw : undefined });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const { res } = result;
    return (
      <Modal
        title={`${res.tenant.display_name} is ready`}
        description="Copy everything below now — passwords and keys are shown only this once."
        onClose={onClose}
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              iconRight="arrowRight"
              onClick={() => {
                onClose();
                navigate(`/platform/companies/${encodeURIComponent(res.tenant.tenant_id)}`);
              }}
            >
              Open company
            </Button>
          </>
        }
      >
        <div className="bb-staff-stack" style={{ gap: 18 }}>
          <div>
            <div className="bb-staff-section-label">
              <Icon name="user" size={14} /> Owner access
            </div>
            <AccessResult email={res.owner.email} inviteUrl={res.invite_url} emailSent={res.email_sent} password={result.password} />
          </div>
          {res.keys.length ? (
            <div>
              <div className="bb-staff-section-label">
                <Icon name="key" size={14} /> API keys
              </div>
              <RawKeyList keys={res.keys} />
            </div>
          ) : null}
          <SecretField label="Tenant id" value={res.tenant.tenant_id} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="New company"
      description="Creates the company workspace, its first owner and (optionally) API keys."
      onClose={onClose}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="plus" type="submit" form={`${id}-f`} loading={busy} disabled={!email.trim() || !tenantId}>
            Create company
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} onSubmit={submit} className="bb-staff-stack" style={{ gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="bb-staff-form-grid">
          <Field label="Company name" htmlFor={`${id}-cn`}>
            <input id={`${id}-cn`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Energy" data-autofocus />
          </Field>
          <Field label="Tenant id" htmlFor={`${id}-ti`} error={tenantId && !tidValid ? '3–64 characters: letters, digits, . _ -' : null} hint="Permanent. Used by keys and the API.">
            <input
              id={`${id}-ti`}
              className="bb-staff-input bb-staff-mono"
              value={tenantId}
              onChange={(e) => {
                setTidTouched(true);
                setTid(e.target.value.trim());
              }}
              placeholder="acme-energy"
              required
              aria-invalid={(!!tenantId && !tidValid) || undefined}
            />
          </Field>
          <Field label="Owner email" htmlFor={`${id}-oe`}>
            <input id={`${id}-oe`} type="email" className="bb-staff-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@company.com" required />
          </Field>
          <Field label="Owner name (optional)" htmlFor={`${id}-on`}>
            <input id={`${id}-on`} className="bb-staff-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </Field>
        </div>
        <AccessChoice mode={mode} setMode={setMode} password={pw} setPassword={setPw} />
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="bb-staff-stack">
          <legend className="bb-staff-label" style={{ marginBottom: 8 }}>
            Create API keys now
          </legend>
          <label className="bb-staff-check">
            <input type="checkbox" checked={pk} onChange={(e) => setPk(e.target.checked)} />
            <span>
              <b>Publishable key</b> <code className="bb-staff-mono">pk_live_…</code>
              <span className="bb-staff-hint" style={{ display: 'block' }}>
                For their website chat widget or mobile app (chat only).
              </span>
            </span>
          </label>
          <label className="bb-staff-check">
            <input type="checkbox" checked={sk} onChange={(e) => setSk(e.target.checked)} />
            <span>
              <b>Secret key</b> <code className="bb-staff-mono">sk_live_…</code>
              <span className="bb-staff-hint" style={{ display: 'block' }}>
                For their server or Odoo. Keep it off browsers.
              </span>
            </span>
          </label>
          <span className="bb-staff-hint">Keys are shown once on the next screen. The owner can also create keys later in Settings → API keys.</span>
        </fieldset>
      </form>
    </Modal>
  );
}

export function CompaniesPage() {
  const { client, query, href, navigate, live } = useStaff();
  const list = useAsync(() => client.listTenants(), [client]);
  const ov = useAsync(() => client.platformOverview(), [client]);
  useLiveRefresh(live, () => {
    void list.reload(true);
    void ov.reload(true);
  });
  const [creating, setCreating] = useState(false);
  const q = (query.q || '').trim().toLowerCase();
  const rows = useMemo(
    () =>
      (list.data || []).filter((t) => !q || [t.display_name, t.tenant_id, ...t.owners].some((v) => (v || '').toLowerCase().includes(q))),
    [list.data, q]
  );
  const o = ov.data;

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Companies</h2>
          <p>Every workspace on this Brainbox server, with its people, keys and usage.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          New company
        </Button>
      </div>

      <div className="bb-staff-grid bb-staff-grid-kpi">
        {o ? (
          <>
            <Kpi label="Companies" value={fmtNum(o.tenants)} icon="building" meta={`${fmtNum(o.platform_admins)} platform admin${o.platform_admins === 1 ? '' : 's'}`} />
            <Kpi label="Staff accounts" value={fmtNum(o.staff)} icon="staff" tone="sky" meta={`${fmtNum(o.staff_active)} active`} />
            <Kpi label="Active keys" value={fmtNum(o.keys.active)} icon="key" meta={`${fmtNum(o.keys.publishable)} pk · ${fmtNum(o.keys.secret)} sk · ${fmtNum(o.keys.revoked)} revoked`} />
            <Kpi label="Documents" value={fmtNum(o.documents)} icon="database" tone="green" meta={`${fmtNum(o.sources)} training sources`} />
            <Kpi label="Conversations" value={fmtNum(o.conversations)} icon="chat" tone="sky" meta={`${fmtNum(o.questions_30d)} questions in 30 days`} />
            <Kpi label="Open gaps" value={fmtNum(o.open_gaps)} icon="gaps" tone="warn" meta="Across all companies" />
          </>
        ) : ov.error ? null : (
          <KpiSkeletons />
        )}
      </div>

      <section className="bb-staff-card">
        {list.error && !list.data ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null}
        {list.loading && !list.data ? <SkeletonRows rows={5} /> : null}
        {list.data ? (
          rows.length ? (
            <div className="bb-staff-table-wrap">
              <table className="bb-staff-table is-responsive">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Owners</th>
                    <th className="is-num">Staff</th>
                    <th>Keys</th>
                    <th className="is-num">Documents</th>
                    <th className="is-num">Open gaps</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const to = `/platform/companies/${encodeURIComponent(t.tenant_id)}`;
                    return (
                      <tr key={t.tenant_id} className="is-link" onClick={(e) => !(e.target as HTMLElement).closest('a,button') && navigate(to)}>
                        <td className="is-primary" style={{ maxWidth: 300 }}>
                          <a className="bb-staff-row-link bb-staff-truncate" style={{ display: 'block' }} href={href(to)}>
                            {t.display_name === t.tenant_id ? shortId(t.tenant_id, 30) : t.display_name}
                          </a>
                          <TenantIdChip id={t.tenant_id} />
                        </td>
                        <td style={{ maxWidth: 240 }}>
                          <span className="bb-staff-cell-label">Owners</span>
                          {t.owners.length ? (
                            <span className="bb-staff-truncate" style={{ display: 'block' }} title={t.owners.join(', ')}>
                              {t.owners[0]}
                              {t.owners.length > 1 ? <span className="bb-staff-muted"> +{t.owners.length - 1}</span> : null}
                            </span>
                          ) : (
                            <span className="bb-staff-muted">No owner</span>
                          )}
                        </td>
                        <td className="is-num">
                          <span className="bb-staff-cell-label">Staff</span>
                          {fmtNum(t.staff_count)}
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Keys</span>
                          <KeyCounts pk={t.key_counts.publishable} sk={t.key_counts.secret} />
                        </td>
                        <td className="is-num">
                          <span className="bb-staff-cell-label">Documents</span>
                          {fmtNum(t.documents)}
                        </td>
                        <td className="is-num">
                          <span className="bb-staff-cell-label">Open gaps</span>
                          {t.open_gaps ? <b style={{ color: 'var(--bbs-warning-text)', fontWeight: 500 }}>{fmtNum(t.open_gaps)}</b> : <span className="bb-staff-muted">0</span>}
                        </td>
                        <td className="bb-staff-muted" title={fmtDateTime(t.last_activity_at)}>
                          <span className="bb-staff-cell-label">Last activity</span>
                          {relTime(t.last_activity_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="building" title={q ? 'No matching companies' : 'No companies yet'} action={!q ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New company</Button> : undefined}>
              {q ? 'Try a different search.' : 'Create the first company and its owner.'}
            </EmptyState>
          )
        ) : null}
      </section>

      <LegendCard />

      {creating ? (
        <NewCompanyModal
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            list.setData((l) => [...(l || []).filter((x) => x.tenant_id !== t.tenant_id), t].sort((a, b) => a.display_name.localeCompare(b.display_name)));
            void ov.reload(true);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Company detail                                                      */
/* ------------------------------------------------------------------ */

type DetailTab = 'staff' | 'keys' | 'usage';

export function CompanyDetailPage({ tenantId, tab: tabParam }: { tenantId: string; tab?: string }) {
  const { client, href, toast, live } = useStaff();
  const { data, setData, error, loading, reload } = useAsync(() => client.getTenant(tenantId), [client, tenantId]);
  const tab: DetailTab = tabParam === 'keys' || tabParam === 'usage' ? tabParam : 'staff';
  useLiveRefresh(live, () => void reload(true), ['staff', 'keys']);
  const [adding, setAdding] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  if (error && !data) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (loading && !data) {
    return (
      <section className="bb-staff-card">
        <SkeletonRows rows={5} />
      </section>
    );
  }
  if (!data) return null;
  const base = `/platform/companies/${encodeURIComponent(tenantId)}`;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (renaming == null) return;
    setSavingName(true);
    try {
      const t = await client.updateTenant(tenantId, { display_name: renaming.trim() });
      setData((d) => (d ? { ...d, display_name: t.display_name } : d));
      setRenaming(null);
      toast('Company renamed.');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const tabs: { key: DetailTab; label: string; icon: StaffIconName; count?: number }[] = [
    { key: 'staff', label: 'Staff', icon: 'staff', count: data.staff.length },
    { key: 'keys', label: 'API keys', icon: 'key', count: data.keys.filter((k) => k.is_active).length },
    { key: 'usage', label: 'Usage', icon: 'trendUp' }
  ];

  return (
    <div className="bb-staff-stack">
      <section className="bb-staff-card">
        <div className="bb-staff-card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span className="bb-staff-kpi-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
            <Icon name="building" size={22} />
          </span>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            {renaming != null ? (
              <form onSubmit={saveName} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="bb-staff-input" style={{ maxWidth: 320 }} value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Company name" autoFocus maxLength={120} />
                <Button type="submit" variant="primary" size="sm" loading={savingName}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="bb-staff-truncate" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em' }} title={data.display_name}>
                  {data.display_name === data.tenant_id ? shortId(data.tenant_id, 36) : data.display_name}
                </h2>
                <IconButton icon="sliders" label="Rename company" size="sm" onClick={() => setRenaming(data.display_name === data.tenant_id ? '' : data.display_name)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }} className="bb-staff-muted">
              <TenantIdChip id={data.tenant_id} max={34} />
              <span className="bb-staff-dot-sep">{data.owners.length ? `Owner${data.owners.length > 1 ? 's' : ''}: ${data.owners.join(', ')}` : 'No owner yet'}</span>
              {data.created_at ? <span className="bb-staff-dot-sep">Since {fmtDateTime(data.created_at)}</span> : null}
            </div>
          </div>
          <KeyCounts pk={data.key_counts.publishable} sk={data.key_counts.secret} />
        </div>
        <div className="bb-staff-tabs" role="tablist" style={{ padding: '0 12px' }}>
          {tabs.map((t) => (
            <a key={t.key} href={href(t.key === 'staff' ? base : `${base}/${t.key}`)} className="bb-staff-tab" aria-current={tab === t.key ? 'page' : undefined}>
              <Icon name={t.icon} size={16} />
              {t.label}
              {t.count != null ? <span className="bb-staff-count">{t.count}</span> : null}
            </a>
          ))}
        </div>
      </section>

      {tab === 'staff' ? (
        <section className="bb-staff-card">
          <div className="bb-staff-card-head" style={{ paddingBottom: 14 }}>
            <div>
              <h3>Staff</h3>
              <p>Dashboard accounts for this company. Passwords are never shown — set a new temporary one if someone is locked out.</p>
            </div>
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              Add user
            </Button>
          </div>
          {data.staff.length ? (
            <UsersTable
              users={data.staff}
              onChange={(u) => setData((d) => (d ? { ...d, staff: d.staff.map((x) => (String(x.id) === String(u.id) ? u : x)).filter((x) => x.tenant_id === tenantId) } : d))}
              onRemoved={(u) => setData((d) => (d ? { ...d, staff: d.staff.filter((x) => x.id !== u.id) } : d))}
            />
          ) : (
            <EmptyState icon="staff" title="No staff yet" action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add user</Button>}>
              Add the company’s owner so they can sign in and invite their team.
            </EmptyState>
          )}
        </section>
      ) : null}

      {tab === 'keys' ? (
        <>
          <section className="bb-staff-card">
            <div className="bb-staff-card-head" style={{ paddingBottom: 14 }}>
              <div>
                <h3>API keys</h3>
                <p>Raw keys are shown only when created or rolled. Roll a key if it was lost or leaked.</p>
              </div>
              <Button variant="primary" icon="plus" onClick={() => setCreatingKey(true)}>
                Create key
              </Button>
            </div>
            {data.keys.length ? (
              <KeysTable
                keys={data.keys}
                onChange={(updated, added) => setData((d) => (d ? { ...d, keys: added ? [added, ...updated] : updated } : d))}
              />
            ) : (
              <EmptyState icon="key" title="No API keys" action={<Button variant="primary" icon="plus" onClick={() => setCreatingKey(true)}>Create key</Button>}>
                Create a publishable key for their website chat, or a secret key for their server.
              </EmptyState>
            )}
          </section>
          <section className="bb-staff-card">
            <div className="bb-staff-card-body bb-staff-stack" style={{ gap: 12 }}>
              <KeyTypeLegend />
              <NeverShownNote />
            </div>
          </section>
        </>
      ) : null}

      {tab === 'usage' ? (
        <div className="bb-staff-grid bb-staff-grid-kpi">
          <Kpi label="Questions (30 days)" value={fmtNum(data.usage.questions)} icon="chat" meta={`${fmtNum(data.usage.questions_all_time)} all time`} />
          <Kpi label="Unanswered (30 days)" value={fmtNum(data.usage.unanswered)} icon="alert" tone="warn" meta={data.usage.questions ? `${Math.round((data.usage.unanswered / data.usage.questions) * 100)}% of questions` : '—'} />
          <Kpi label="Open gaps" value={fmtNum(data.open_gaps)} icon="gaps" tone="warn" meta="Waiting for an answer" />
          <Kpi label="Conversations" value={fmtNum(data.conversations)} icon="chat" tone="sky" meta={`Last activity ${relTime(data.last_activity_at)}`} />
          <Kpi label="Documents" value={fmtNum(data.documents)} icon="database" tone="green" meta={`${fmtNum(data.sources)} training sources`} />
          <Kpi label="Staff" value={fmtNum(data.staff_count)} icon="staff" tone="sky" meta={`${data.staff.filter((s) => s.is_active && !s.invited).length} active`} />
        </div>
      ) : null}

      {adding ? (
        <AddUserModal
          tenantId={tenantId}
          onClose={() => setAdding(false)}
          onCreated={(u) => setData((d) => (d ? { ...d, staff: [...d.staff, u], staff_count: d.staff_count + 1 } : d))}
        />
      ) : null}
      {creatingKey ? (
        <CreateKeyModal tenantId={tenantId} onClose={() => setCreatingKey(false)} onCreated={(k) => setData((d) => (d ? { ...d, keys: [k, ...d.keys] } : d))} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* All users                                                           */
/* ------------------------------------------------------------------ */

export function AllUsersPage() {
  const { client, query, navigate, href, live } = useStaff();
  const q = useDebounced(query.q || '', 300);
  const tenant = query.company || '';
  const role = (query.role || '') as StaffRole | '';
  const status = (query.status || '') as PlatformUserStatus | '';
  const paOnly = query.pa === '1';
  const tenants = useAsync(() => client.listTenants(), [client]);
  const { data, setData, error, loading, reload } = useAsync(
    () => client.listPlatformUsers({ q, tenant_id: tenant, role, status, ...(paOnly ? { platform_admin: true } : {}) }),
    [client, q, tenant, role, status, paOnly]
  );
  useLiveRefresh(live, () => void reload(true), ['staff']);
  const [adding, setAdding] = useState(false);
  const setQ = (patch: Record<string, string | undefined>) => navigate('/platform/users', { ...query, ...patch }, { replace: true });

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>All users</h2>
          <p>Every staff account in every company. Passwords are never shown — set a temporary one or send a fresh invite link.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)} disabled={!tenants.data?.length}>
          Add user
        </Button>
      </div>
      <section className="bb-staff-card">
        <div className="bb-staff-filters">
          <select className="bb-staff-input bb-staff-input-sm" style={{ width: 'auto', maxWidth: 240 }} aria-label="Company" value={tenant} onChange={(e) => setQ({ company: e.target.value || undefined })}>
            <option value="">All companies</option>
            {(tenants.data || []).map((t) => (
              <option key={t.tenant_id} value={t.tenant_id}>
                {t.display_name === t.tenant_id ? shortId(t.tenant_id, 30) : t.display_name}
              </option>
            ))}
          </select>
          <select className="bb-staff-input bb-staff-input-sm" style={{ width: 'auto' }} aria-label="Role" value={role} onChange={(e) => setQ({ role: e.target.value || undefined })}>
            <option value="">All roles</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label}
              </option>
            ))}
          </select>
          <div className="bb-staff-chips" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key || 'all'} type="button" className="bb-staff-chip" aria-pressed={status === f.key} onClick={() => setQ({ status: f.key || undefined })}>
                {f.label}
              </button>
            ))}
            <button type="button" className="bb-staff-chip" aria-pressed={paOnly} onClick={() => setQ({ pa: paOnly ? undefined : '1' })}>
              <Icon name="shield" size={13} /> Platform admins
            </button>
          </div>
        </div>
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={6} /> : null}
        {data ? (
          data.length ? (
            <UsersTable
              users={data}
              showCompany
              onChange={(u) => setData((list) => (list ? list.map((x) => (String(x.id) === String(u.id) ? u : x)) : list))}
              onRemoved={(u) => setData((list) => (list ? list.filter((x) => x.id !== u.id) : list))}
            />
          ) : (
            <EmptyState icon="staff" title="No users match" action={<a href={href('/platform/users')}>Clear filters</a>}>
              Try a different search or filter.
            </EmptyState>
          )
        ) : null}
      </section>
      {adding && tenants.data ? (
        <AddUserModal
          tenants={tenants.data}
          tenantId={tenant || undefined}
          onClose={() => setAdding(false)}
          onCreated={(u) => setData((list) => [...(list || []), u])}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* All API keys                                                        */
/* ------------------------------------------------------------------ */

export function AllKeysPage() {
  const { client, query, navigate, live } = useStaff();
  const tenant = query.company || '';
  const type = (query.type || '') as ApiKeyType | '';
  const state = query.state || 'active';
  const tenants = useAsync(() => client.listTenants(), [client]);
  const { data, setData, error, loading, reload } = useAsync(() => client.listPlatformKeys(tenant || undefined), [client, tenant]);
  useLiveRefresh(live, () => void reload(true), ['keys']);
  const [creating, setCreating] = useState(false);
  const setQ = (patch: Record<string, string | undefined>) => navigate('/platform/keys', { ...query, ...patch }, { replace: true });
  const q = (query.q || '').trim().toLowerCase();
  const rows = useMemo(
    () =>
      (data || []).filter(
        (k) =>
          (!type || k.key_type === type) &&
          (state === 'all' || (state === 'active' ? k.is_active : !k.is_active)) &&
          (!q || [k.name, k.key_prefix, k.tenant_name, k.tenant_id].some((v) => (v || '').toLowerCase().includes(q)))
      ),
    [data, type, state, q]
  );

  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>All API keys</h2>
          <p>Publishable and secret keys of every company. Only prefixes are visible — full keys appear once, when created or rolled.</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)} disabled={!tenants.data?.length}>
          Create key
        </Button>
      </div>
      <section className="bb-staff-card">
        <div className="bb-staff-filters">
          <select className="bb-staff-input bb-staff-input-sm" style={{ width: 'auto', maxWidth: 240 }} aria-label="Company" value={tenant} onChange={(e) => setQ({ company: e.target.value || undefined })}>
            <option value="">All companies</option>
            {(tenants.data || []).map((t) => (
              <option key={t.tenant_id} value={t.tenant_id}>
                {t.display_name === t.tenant_id ? shortId(t.tenant_id, 30) : t.display_name}
              </option>
            ))}
          </select>
          <div className="bb-staff-chips" role="group" aria-label="Key type">
            {(
              [
                ['', 'All types'],
                ['publishable', 'Publishable'],
                ['secret', 'Secret']
              ] as const
            ).map(([v, l]) => (
              <button key={v || 'all'} type="button" className="bb-staff-chip" aria-pressed={type === v} onClick={() => setQ({ type: v || undefined })}>
                {l}
              </button>
            ))}
          </div>
          <div className="bb-staff-seg" role="group" aria-label="Key status">
            {(
              [
                ['active', 'Active'],
                ['revoked', 'Revoked'],
                ['all', 'All']
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={state === v} onClick={() => setQ({ state: v === 'active' ? undefined : v })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={6} /> : null}
        {data ? (
          rows.length ? (
            <KeysTable keys={rows} showCompany onChange={(updated, added) => setData((all) => {
              const map = new Map(updated.map((k) => [String(k.id), k]));
              const merged = (all || []).map((k) => map.get(String(k.id)) || k);
              return added ? [added, ...merged] : merged;
            })} />
          ) : (
            <EmptyState icon="key" title="No keys match">
              Try a different filter.
            </EmptyState>
          )
        ) : null}
      </section>
      <LegendCard defaultOpen />
      {creating && tenants.data ? (
        <CreateKeyModal tenants={tenants.data} tenantId={tenant || undefined} onClose={() => setCreating(false)} onCreated={(k) => setData((list) => [k, ...(list || [])])} />
      ) : null}
    </div>
  );
}

