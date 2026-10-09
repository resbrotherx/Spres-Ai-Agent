/* Shared pieces for account access & API keys: invite-or-password choice, password generator,
 * show-once secrets, key-type legend and pills, set-password modal. */
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon } from './icons';
import type { ApiKeyInfo, StaffUser } from './types';
import { Alert, Button, CopyButton, Field, Modal, PasswordInput, StatusPill } from './ui';
import { ADMIN_MIN_PASSWORD, errMsg, generatePassword } from './util';

/* ------------------------------------------------------------------ */
/* Status & badges                                                     */
/* ------------------------------------------------------------------ */

export type AccessStatus = 'active' | 'invited' | 'must_change' | 'disabled';

export function accessStatus(u: Pick<StaffUser, 'is_active' | 'invited' | 'must_change_password'>): AccessStatus {
  if (!u.is_active) return 'disabled';
  if (u.invited) return 'invited';
  if (u.must_change_password) return 'must_change';
  return 'active';
}

const STATUS_LABEL: Record<AccessStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  must_change: 'Must change password',
  disabled: 'Disabled'
};

export function AccessStatusPill({ user }: { user: Pick<StaffUser, 'is_active' | 'invited' | 'must_change_password'> }) {
  const st = accessStatus(user);
  return <StatusPill status={st} label={STATUS_LABEL[st]} />;
}

export function PlatformBadge({ compact }: { compact?: boolean }) {
  return (
    <span className="bb-staff-pa-badge" title="Platform admin — can manage every company">
      <Icon name="shield" size={12} />
      {compact ? 'Platform' : 'Platform admin'}
    </span>
  );
}

export function KeyTypePill({ type }: { type: ApiKeyInfo['key_type'] }) {
  return (
    <span className={`bb-staff-key-type is-${type}`}>
      <Icon name={type === 'secret' ? 'lock' : 'globe'} size={13} />
      {type === 'secret' ? 'Secret' : 'Publishable'}
    </span>
  );
}

export function KeyStatusPill({ k }: { k: ApiKeyInfo }) {
  const expired = k.expired ?? (!!k.expires_at && new Date(k.expires_at).getTime() < Date.now());
  if (!k.is_active) return <StatusPill status="disabled" label="Revoked" />;
  if (expired) return <StatusPill status="failed" label="Expired" />;
  return <StatusPill status="active" />;
}

/** What every credential is for — answers "where are the client key / tokens?". */
export function KeyTypeLegend() {
  const rows: [ReactNode, string, string][] = [
    [<KeyTypePill type="publishable" />, 'pk_live_…', 'Browser, website widget and mobile apps — chat only. This is the “client key”; there is no separate one.'],
    [<KeyTypePill type="secret" />, 'sk_live_…', 'Servers, Odoo and training. Can do everything for its company — never put it in a browser or app.'],
    [
      <span className="bb-staff-key-type is-token">
        <Icon name="user" size={13} /> Staff login token
      </span>,
      'JWT',
      'Issued automatically when a staff member signs in to this dashboard; expires after 12 hours. Not a key you hand out.'
    ],
    [
      <span className="bb-staff-key-type is-admin">
        <Icon name="shield" size={13} /> Admin token
      </span>,
      'env var',
      'BRAINBOX_ADMIN_TOKEN on the server, for platform-level scripts. Never shown in the dashboard.'
    ]
  ];
  return (
    <div className="bb-staff-key-legend">
      {rows.map(([pill, fmt, desc], i) => (
        <div key={i} className="bb-staff-key-legend-row">
          <div className="bb-staff-key-legend-head">
            {pill}
            <code className="bb-staff-mono bb-staff-muted">{fmt}</code>
          </div>
          <p>{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function NeverShownNote({ what = 'keys' }: { what?: 'keys' | 'passwords' | 'both' }) {
  return (
    <p className="bb-staff-hint" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <Icon name="lock" size={13} />
      <span>
        {what !== 'passwords' ? 'Keys are stored only as one-way hashes, so an existing key can never be shown again — roll it to get a new one. ' : ''}
        {what !== 'keys' ? 'Passwords are hashed too and never shown; you can set a new temporary one instead.' : ''}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Show-once secrets                                                   */
/* ------------------------------------------------------------------ */

export function SecretField({ label, value, copyLabel = 'Copy', primary }: { label: ReactNode; value: string; copyLabel?: string; primary?: boolean }) {
  return (
    <div className="bb-staff-field">
      <span className="bb-staff-label">{label}</span>
      <div className="bb-staff-copy-field">
        <code title={value}>{value}</code>
        <CopyButton text={value} label={copyLabel} variant={primary ? 'primary' : 'secondary'} />
      </div>
    </div>
  );
}

export function RawKeyList({ keys }: { keys: { key: Pick<ApiKeyInfo, 'name' | 'key_type'>; raw_key: string }[] }) {
  if (!keys.length) return null;
  const hasSecret = keys.some((k) => k.key.key_type === 'secret');
  return (
    <div className="bb-staff-stack" style={{ gap: 12 }}>
      <Alert tone="warn">
        <b>Copy {keys.length > 1 ? 'these keys' : 'this key'} now — {keys.length > 1 ? 'they' : 'it'} won’t be shown again.</b> Only a hash is stored.
        {hasSecret ? ' Never put a secret key in browser code, an app or a public repository.' : ''}
      </Alert>
      {keys.map((k) => (
        <SecretField
          key={k.raw_key}
          label={
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <KeyTypePill type={k.key.key_type} /> {k.key.name}
            </span>
          }
          value={k.raw_key}
          primary
        />
      ))}
    </div>
  );
}

export function RawKeyModal({ title = 'Copy your new key', result, onClose, note }: { title?: string; result: { key: ApiKeyInfo; raw_key: string }; onClose: () => void; note?: ReactNode }) {
  return (
    <Modal title={title} description="This is the only time the full key is shown." onClose={onClose} footer={<Button variant="primary" onClick={onClose}>I’ve saved it</Button>}>
      <div className="bb-staff-stack" style={{ gap: 12 }}>
        {note}
        <RawKeyList keys={[{ key: result.key, raw_key: result.raw_key }]} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Password entry with generator                                       */
/* ------------------------------------------------------------------ */

export function GeneratedPasswordInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const short = !!value && value.length < ADMIN_MIN_PASSWORD;
  return (
    <div className="bb-staff-stack" style={{ gap: 8 }}>
      <div className="bb-staff-pw-gen">
        <div style={{ flex: 1, minWidth: 0 }}>
          <PasswordInput id={id} value={value} onChange={onChange} autoComplete="new-password" placeholder={`At least ${ADMIN_MIN_PASSWORD} characters`} invalid={short} autoFocus={autoFocus} />
        </div>
        <Button icon="sparkles" onClick={() => onChange(generatePassword())}>
          Generate
        </Button>
        {value ? <CopyButton text={value} label="Copy" /> : null}
      </div>
      <span className={short ? 'bb-staff-error-text' : 'bb-staff-hint'}>
        {short ? `Use at least ${ADMIN_MIN_PASSWORD} characters.` : 'Share it privately (not in the same email as the login link). They’ll be asked to choose their own at first sign-in.'}
      </span>
    </div>
  );
}

export type AccessMode = 'invite' | 'password';

/** “Send invite link” vs “Set a password” radio cards + the password field. */
export function AccessChoice({
  mode,
  setMode,
  password,
  setPassword,
  inviteHint = 'They get a link (valid 7 days) and choose their own password.'
}: {
  mode: AccessMode;
  setMode: (m: AccessMode) => void;
  password: string;
  setPassword: (v: string) => void;
  inviteHint?: string;
}) {
  const id = useId();
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="bb-staff-stack">
      <legend className="bb-staff-label" style={{ marginBottom: 8 }}>
        How do they get in?
      </legend>
      <div className="bb-staff-radio-cards">
        <label className={`bb-staff-radio-card${mode === 'invite' ? ' is-checked' : ''}`}>
          <input type="radio" name={`${id}-m`} checked={mode === 'invite'} onChange={() => setMode('invite')} />
          <b>
            <Icon name="mail" size={15} /> Send invite link
          </b>
          <span>{inviteHint}</span>
        </label>
        <label className={`bb-staff-radio-card${mode === 'password' ? ' is-checked' : ''}`}>
          <input
            type="radio"
            name={`${id}-m`}
            checked={mode === 'password'}
            onChange={() => {
              setMode('password');
              if (!password) setPassword(generatePassword());
            }}
          />
          <b>
            <Icon name="key" size={15} /> Set a password
          </b>
          <span>Active right away with a temporary password they must change at first sign-in.</span>
        </label>
      </div>
      {mode === 'password' ? (
        <Field label="Temporary password" htmlFor={`${id}-pw`}>
          <GeneratedPasswordInput id={`${id}-pw`} value={password} onChange={setPassword} />
        </Field>
      ) : null}
    </fieldset>
  );
}

/** Result shown after creating someone: invite link and/or temporary password (shown once). */
export function AccessResult({ email, inviteUrl, emailSent, password }: { email: string; inviteUrl?: string | null; emailSent?: boolean; password?: string | null }) {
  return (
    <div className="bb-staff-stack" style={{ gap: 12 }}>
      {password ? (
        <>
          <Alert tone="success">
            <b>{email}</b> can sign in now. Share the temporary password privately — it isn’t stored anywhere you can see it again. They’ll choose their own at first sign-in.
          </Alert>
          <SecretField label="Sign-in email" value={email} />
          <SecretField label="Temporary password" value={password} copyLabel="Copy password" primary />
        </>
      ) : inviteUrl ? (
        <>
          {emailSent ? (
            <Alert tone="success">
              Invitation emailed to <strong>{email}</strong>. The link is valid for 7 days.
            </Alert>
          ) : (
            <Alert tone="warn">
              No email was sent (email isn’t configured, or the link isn’t absolute). Share this link with <strong>{email}</strong> yourself — it’s valid for 7 days.
            </Alert>
          )}
          <SecretField label="Invite link" value={inviteUrl} copyLabel="Copy link" primary={!emailSent} />
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Set password modal                                                  */
/* ------------------------------------------------------------------ */

export function SetPasswordModal({
  user,
  onClose,
  onSubmit
}: {
  user: Pick<StaffUser, 'email' | 'full_name'>;
  onClose: () => void;
  onSubmit: (password: string, mustChange: boolean) => Promise<void>;
}) {
  const id = useId();
  const [pw, setPw] = useState(() => generatePassword());
  const [mustChange, setMustChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < ADMIN_MIN_PASSWORD) return setError(`Use at least ${ADMIN_MIN_PASSWORD} characters.`);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pw, mustChange);
      setDone(pw);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const who = user.full_name || user.email;
  if (done) {
    return (
      <Modal title="Password set" description={`For ${who}`} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="bb-staff-stack" style={{ gap: 12 }}>
          <Alert tone="success">
            The new password works right away{mustChange ? '; they’ll be asked to choose their own after signing in' : ''}. Copy it now — it won’t be shown again. Sessions that are already signed in stay valid until they expire (12 h); disable the account to cut access immediately.
          </Alert>
          <SecretField label="Sign-in email" value={user.email} />
          <SecretField label="New password" value={done} copyLabel="Copy password" primary />
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      title="Set password"
      description={`Choose a temporary password for ${who}. Their current password stops working.`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="key" type="submit" form={`${id}-f`} loading={busy} disabled={pw.length < ADMIN_MIN_PASSWORD}>
            Set password
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} onSubmit={submit} className="bb-staff-stack" style={{ gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="New password" htmlFor={`${id}-pw`}>
          <GeneratedPasswordInput id={`${id}-pw`} value={pw} onChange={setPw} autoFocus />
        </Field>
        <label className="bb-staff-check">
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          <span>
            <b>Ask them to choose a new password at next sign-in</b>
            <span className="bb-staff-hint" style={{ display: 'block' }}>
              Recommended — you’ll know this password, they shouldn’t keep using it.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
