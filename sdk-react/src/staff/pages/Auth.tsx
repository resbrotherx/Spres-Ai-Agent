import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon } from '../icons';
import { BrandMark } from '../Shell';
import type { BrainboxStaffClient } from '../staffClient';
import type { StaffUser } from '../types';
import { Alert, Button, Field, PasswordInput } from '../ui';
import { errMsg } from '../util';

export interface AuthProps {
  client: BrainboxStaffClient;
  brandName: string;
  logoUrl?: string;
  href: (to: string, q?: Record<string, string | number | undefined | null>) => string;
  navigate: (to: string, q?: Record<string, string | number | undefined | null>, o?: { replace?: boolean }) => void;
  /** `password` is passed by the sign-in form so a forced password change can prefill it (memory only). */
  onAuthenticated: (user: StaffUser, meta?: { password?: string }) => void;
}

function AuthLayout({ brandName, logoUrl, children }: { brandName: string; logoUrl?: string; children: ReactNode }) {
  return (
    <div className="bb-staff-auth">
      <div className="bb-staff-auth-bg" aria-hidden="true">
        <span className="is-a" />
        <span className="is-b" />
        <span className="is-c" />
      </div>
      <div className="bb-staff-auth-center">
        <div className="bb-staff-auth-brandrow">
          <BrandMark logoUrl={logoUrl} size={44} />
          <span className="bb-staff-auth-brandname">{brandName}</span>
          <span className="bb-staff-auth-tag">Staff console</span>
        </div>
        <div className="bb-staff-auth-card">{children}</div>
        <ul className="bb-staff-auth-features" aria-label="What you can do here">
          <li>
            <Icon name="gaps" size={15} /> Knowledge-gap inbox
          </li>
          <li>
            <Icon name="sparkles" size={15} /> Answer once, train instantly
          </li>
          <li>
            <Icon name="shield" size={15} /> Role-based access
          </li>
        </ul>
        <p className="bb-staff-auth-legal">
          <Icon name="lock" size={12} /> Secure staff access · sessions are scoped to your organisation
        </p>
      </div>
    </div>
  );
}

function MobileLogo(_props: { brandName: string; logoUrl?: string }) {
  return null;
}

function pwScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function PasswordMeter({ value }: { value: string }) {
  const score = pwScore(value);
  const label = !value ? 'At least 8 characters' : ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score];
  return (
    <div>
      <div className="bb-staff-pw-meter" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < score ? 'is-on' : ''} />
        ))}
      </div>
      <span className="bb-staff-hint" style={{ display: 'block', marginTop: 4 }}>
        {label}
      </span>
    </div>
  );
}

export function LoginPage(props: AuthProps & { next?: string }) {
  const { client, brandName, logoUrl, onAuthenticated } = props;
  const id = useId();
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const res = await client.login(email.trim(), password);
        onAuthenticated(res.user, { password });
      } else {
        await client.forgotPassword(email.trim());
        setMode('sent');
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout brandName={brandName} logoUrl={logoUrl}>
      {mode === 'sent' ? (
        <div className="bb-staff-auth-form">
          <MobileLogo brandName={brandName} logoUrl={logoUrl} />
          <div className="bb-staff-empty-icon" style={{ margin: '0 auto' }}>
            <Icon name="mail" size={30} strokeWidth={1.5} />
          </div>
          <div>
            <h1>Check your inbox</h1>
            <p className="bb-staff-auth-lead">
              If <b>{email}</b> belongs to a staff account, we’ve sent a link to reset your password. It expires soon, so use it right away.
            </p>
          </div>
          <Button variant="secondary" size="lg" block icon="arrowLeft" onClick={() => setMode('login')}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form className="bb-staff-auth-form" onSubmit={submit} noValidate={false}>
          <MobileLogo brandName={brandName} logoUrl={logoUrl} />
          <div>
            <h1>{mode === 'login' ? 'Sign in' : 'Reset your password'}</h1>
            <p className="bb-staff-auth-lead">
              {mode === 'login' ? `Welcome back to the ${brandName} staff console.` : 'Enter your work email and we’ll send you a reset link.'}
            </p>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Work email" htmlFor={`${id}-email`}>
            <input
              id={`${id}-email`}
              className="bb-staff-input"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          {mode === 'login' ? (
            <Field
              label="Password"
              htmlFor={`${id}-pw`}
              aside={
                <button type="button" className="bb-staff-link-btn" onClick={() => { setError(null); setMode('forgot'); }}>
                  Forgot password?
                </button>
              }
            >
              <PasswordInput id={`${id}-pw`} value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" />
            </Field>
          ) : null}
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!email || (mode === 'login' && !password)}>
            {mode === 'login' ? 'Sign in' : 'Send reset link'}
          </Button>
          {mode === 'forgot' ? (
            <button type="button" className="bb-staff-link-btn" style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => { setError(null); setMode('login'); }}>
              <Icon name="chevronLeft" size={14} />
              Back to sign in
            </button>
          ) : (
            <p className="bb-staff-auth-foot">Don’t have an account? Ask an admin on your team to invite you.</p>
          )}
        </form>
      )}
    </AuthLayout>
  );
}

function SetPasswordForm({
  title,
  lead,
  withName,
  submitLabel,
  onSubmit,
  brandName,
  logoUrl,
  tokenMissing,
  href
}: {
  title: string;
  lead: string;
  withName?: boolean;
  submitLabel: string;
  onSubmit: (pw: string, name: string) => Promise<void>;
  brandName: string;
  logoUrl?: string;
  tokenMissing: boolean;
  href: AuthProps['href'];
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = !!pw2 && pw !== pw2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords don’t match.');
    setError(null);
    setBusy(true);
    try {
      await onSubmit(pw, name.trim());
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout brandName={brandName} logoUrl={logoUrl}>
      <form className="bb-staff-auth-form" onSubmit={submit}>
        <MobileLogo brandName={brandName} logoUrl={logoUrl} />
        <div>
          <h1>{title}</h1>
          <p className="bb-staff-auth-lead">{lead}</p>
        </div>
        {tokenMissing ? (
          <Alert tone="error">
            This link is missing its token. Open the link from your email again, or <a href={href('/login')}>go to sign in</a>.
          </Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {withName ? (
          <Field label="Full name" htmlFor={`${id}-name`}>
            <input id={`${id}-name`} className="bb-staff-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
          </Field>
        ) : null}
        <Field label="New password" htmlFor={`${id}-pw`}>
          <PasswordInput id={`${id}-pw`} value={pw} onChange={setPw} autoComplete="new-password" autoFocus={!withName} />
          <PasswordMeter value={pw} />
        </Field>
        <Field label="Confirm password" htmlFor={`${id}-pw2`} error={mismatch ? 'Passwords don’t match' : null}>
          <PasswordInput id={`${id}-pw2`} value={pw2} onChange={setPw2} autoComplete="new-password" invalid={mismatch} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={tokenMissing || !pw || !pw2}>
          {submitLabel}
        </Button>
        <p className="bb-staff-auth-foot">
          <a href={href('/login')}>Back to sign in</a>
        </p>
      </form>
    </AuthLayout>
  );
}

export function AcceptInvitePage(props: AuthProps & { token: string }) {
  const { client, token, onAuthenticated } = props;
  return (
    <SetPasswordForm
      title="Join your team"
      lead={`You’ve been invited to the ${props.brandName} staff console. Set your name and a password to get started.`}
      withName
      submitLabel="Accept invite & sign in"
      tokenMissing={!token}
      brandName={props.brandName}
      logoUrl={props.logoUrl}
      href={props.href}
      onSubmit={async (pw, name) => {
        const res = await client.acceptInvite({ token, password: pw, ...(name ? { full_name: name } : {}) });
        onAuthenticated(res.user);
      }}
    />
  );
}

export function ResetPasswordPage(props: AuthProps & { token: string }) {
  const { client, token, onAuthenticated } = props;
  return (
    <SetPasswordForm
      title="Choose a new password"
      lead="Pick a strong password you don’t use anywhere else. You’ll be signed in right after."
      submitLabel="Update password & sign in"
      tokenMissing={!token}
      brandName={props.brandName}
      logoUrl={props.logoUrl}
      href={props.href}
      onSubmit={async (pw) => {
        const res = await client.resetPassword(token, pw);
        onAuthenticated(res.user);
      }}
    />
  );
}

/**
 * Shown right after sign-in when an admin set this account's password (`must_change_password`):
 * the user must pick their own before using the dashboard. The current password is prefilled
 * from the sign-in form when available (kept in memory only).
 */
export function ForcePasswordChangePage({
  client,
  brandName,
  logoUrl,
  user,
  currentPassword,
  onDone,
  onSignOut
}: {
  client: BrainboxStaffClient;
  brandName: string;
  logoUrl?: string;
  user: StaffUser;
  currentPassword?: string;
  onDone: (user: StaffUser) => void;
  onSignOut: () => void;
}) {
  const id = useId();
  const [cur, setCur] = useState(currentPassword || '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = !!pw2 && pw !== pw2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== pw2) return setError('Passwords don’t match.');
    if (pw === cur) return setError('Choose a password that’s different from the temporary one.');
    setError(null);
    setBusy(true);
    try {
      await client.changePassword({ current_password: cur, new_password: pw });
      const fresh = await client.me().catch(() => ({ ...user, must_change_password: false }));
      onDone({ ...fresh, must_change_password: false });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout brandName={brandName} logoUrl={logoUrl}>
      <form className="bb-staff-auth-form" onSubmit={submit}>
        <MobileLogo brandName={brandName} logoUrl={logoUrl} />
        <div>
          <h1>Choose a new password</h1>
          <p className="bb-staff-auth-lead">
            An administrator set a temporary password for <b>{user.email}</b>. Pick your own to continue — only you will know it.
          </p>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Temporary password" htmlFor={`${id}-cur`} hint={currentPassword ? 'Filled in from the sign-in form.' : 'The password you just signed in with.'}>
          <PasswordInput id={`${id}-cur`} value={cur} onChange={setCur} autoComplete="current-password" autoFocus={!currentPassword} />
        </Field>
        <Field label="New password" htmlFor={`${id}-pw`}>
          <PasswordInput id={`${id}-pw`} value={pw} onChange={setPw} autoComplete="new-password" autoFocus={!!currentPassword} />
          <PasswordMeter value={pw} />
        </Field>
        <Field label="Confirm new password" htmlFor={`${id}-pw2`} error={mismatch ? 'Passwords don’t match' : null}>
          <PasswordInput id={`${id}-pw2`} value={pw2} onChange={setPw2} autoComplete="new-password" invalid={mismatch} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={!cur || !pw || !pw2}>
          Save password & continue
        </Button>
        <p className="bb-staff-auth-foot">
          <button type="button" className="bb-staff-link-btn" onClick={onSignOut}>
            Sign out instead
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
