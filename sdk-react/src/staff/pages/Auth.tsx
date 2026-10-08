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
  onAuthenticated: (user: StaffUser) => void;
}

function AuthLayout({ brandName, logoUrl, children }: { brandName: string; logoUrl?: string; children: ReactNode }) {
  return (
    <div className="bb-staff-auth">
      <section className="bb-staff-auth-brand" aria-hidden="false">
        <div className="bb-staff-auth-logo">
          <BrandMark logoUrl={logoUrl} size={40} />
          <span>{brandName}</span>
          <span className="bb-staff-pill" style={{ background: 'rgba(255,255,255,.12)', color: '#bae6fd', marginLeft: 4 }}>
            Staff
          </span>
        </div>
        <div className="bb-staff-auth-pitch">
          <h2>
            Every question answered. <em>Every gap closed.</em>
          </h2>
          <p>The control room for your AI assistant — see what customers and staff ask, catch what it couldn’t answer, and teach it in minutes.</p>
          <ul className="bb-staff-auth-features">
            <li>
              <span>
                <Icon name="gaps" size={17} />
              </span>
              <span>
                <b>Knowledge-gap inbox</b>
                Unanswered questions land here and alert your whole team by email and in-app.
              </span>
            </li>
            <li>
              <span>
                <Icon name="training" size={17} />
              </span>
              <span>
                <b>Answer once, train forever</b>
                Reply to a gap and the AI learns it instantly — for the right audience.
              </span>
            </li>
            <li>
              <span>
                <Icon name="shield" size={17} />
              </span>
              <span>
                <b>Roles &amp; permissions</b>
                Owners, admins, trainers and viewers — everyone sees exactly what they should.
              </span>
            </li>
          </ul>
        </div>
        <div className="bb-staff-auth-card">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 600 }}>
            <Icon name="lock" size={15} /> Secure staff access
          </span>
          <span>Sessions are signed tokens scoped to your organisation. Ask an admin for an invite if you don’t have an account.</span>
        </div>
      </section>
      <section className="bb-staff-auth-form-side">{children}</section>
    </div>
  );
}

function MobileLogo({ brandName, logoUrl }: { brandName: string; logoUrl?: string }) {
  return (
    <div className="bb-staff-auth-mobile-logo">
      <BrandMark logoUrl={logoUrl} size={34} />
      <span>{brandName}</span>
    </div>
  );
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
        onAuthenticated(res.user);
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
          <div className="bb-staff-empty-icon" style={{ width: 56, height: 56 }}>
            <Icon name="mail" size={26} />
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
            <button type="button" className="bb-staff-link-btn" style={{ alignSelf: 'center' }} onClick={() => { setError(null); setMode('login'); }}>
              ← Back to sign in
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
