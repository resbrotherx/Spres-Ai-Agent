import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import { resolveLink } from '../router';
import type { StaffNotification } from '../types';
import { TrainingPanel } from '../../TrainingPanel';
import { Alert, Avatar, Button, EmptyState, ErrorState, Field, PasswordInput, RolePill, SkeletonRows, Switch, useStaff } from '../ui';
import { errMsg, fmtDateTime, relTime, ROLE_INFO, useAsync } from '../util';

export function AccountPage() {
  const { client, user, setUser, toast } = useStaff();
  const id = useId();
  const [name, setName] = useState(user.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      setUser(await client.updateMe({ full_name: name.trim() }));
      toast('Profile updated.');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const toggle = async (patch: { notify_email?: boolean; notify_in_app?: boolean }) => {
    const prev = user;
    setUser({ ...user, ...patch });
    try {
      setUser(await client.updateMe(patch));
      toast('Notification preferences saved.');
    } catch (err) {
      setUser(prev);
      toast(errMsg(err), 'error');
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.length < 8) return setPwError('New password must be at least 8 characters.');
    if (pw !== pw2) return setPwError('New passwords don’t match.');
    setPwBusy(true);
    try {
      await client.changePassword({ current_password: cur, new_password: pw });
      setCur('');
      setPw('');
      setPw2('');
      toast('Password changed.');
    } catch (err) {
      setPwError(errMsg(err));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="bb-staff-stack" style={{ maxWidth: 860 }}>
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Account</h2>
          <p>Your profile, notification preferences and password.</p>
        </div>
      </div>

      <section className="bb-staff-card">
        <div className="bb-staff-card-body">
          <div className="bb-staff-profile-head">
            <Avatar name={user.full_name} email={user.email} size="lg" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 650 }}>{user.full_name || user.email.split('@')[0]}</div>
              <div className="bb-staff-muted">{user.email}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <RolePill role={user.role} />
              <div className="bb-staff-hint" style={{ marginTop: 6, maxWidth: 280 }}>
                {ROLE_INFO[user.role]?.desc}
              </div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="bb-staff-form-grid" style={{ marginTop: 22 }}>
            <Field label="Full name" htmlFor={`${id}-n`}>
              <input id={`${id}-n`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email" htmlFor={`${id}-e`} hint="Ask an admin to change your email.">
              <input id={`${id}-e`} className="bb-staff-input" value={user.email} readOnly />
            </Field>
            <div className="bb-staff-span-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="bb-staff-hint">
                Member since {fmtDateTime(user.created_at)} · Last sign-in {relTime(user.last_login_at)}
              </span>
              <Button type="submit" variant="primary" loading={savingName} disabled={name.trim() === (user.full_name || '')}>
                Save profile
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="bb-staff-card">
        <div className="bb-staff-card-head">
          <div>
            <h3>Notifications</h3>
            <p>How you hear about questions the assistant couldn’t answer.</p>
          </div>
        </div>
        <div className="bb-staff-card-body">
          <div className="bb-staff-setting-row">
            <div>
              <h4>Email alerts</h4>
              <p>Get an email when a new knowledge gap or negative feedback comes in.</p>
            </div>
            <Switch checked={user.notify_email} onChange={(v) => void toggle({ notify_email: v })} label="Email alerts" />
          </div>
          <div className="bb-staff-setting-row">
            <div>
              <h4>In-app notifications</h4>
              <p>Show alerts in the bell menu of this dashboard.</p>
            </div>
            <Switch checked={user.notify_in_app} onChange={(v) => void toggle({ notify_in_app: v })} label="In-app notifications" />
          </div>
        </div>
      </section>

      <section className="bb-staff-card">
        <div className="bb-staff-card-head">
          <div>
            <h3>Change password</h3>
            <p>Use at least 8 characters.</p>
          </div>
        </div>
        <form className="bb-staff-card-body" onSubmit={changePw} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pwError ? <Alert tone="error">{pwError}</Alert> : null}
          <div className="bb-staff-form-grid">
            <Field label="Current password" htmlFor={`${id}-c`} className="bb-staff-span-2">
              <PasswordInput id={`${id}-c`} value={cur} onChange={setCur} autoComplete="current-password" />
            </Field>
            <Field label="New password" htmlFor={`${id}-p`}>
              <PasswordInput id={`${id}-p`} value={pw} onChange={setPw} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" htmlFor={`${id}-p2`} error={pw2 && pw !== pw2 ? 'Passwords don’t match' : null}>
              <PasswordInput id={`${id}-p2`} value={pw2} onChange={setPw2} autoComplete="new-password" invalid={!!pw2 && pw !== pw2} />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" icon="lock" loading={pwBusy} disabled={!cur || !pw || !pw2}>
              Update password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

const NOTIF_ICON: Record<string, StaffIconName> = { gap: 'gaps', feedback: 'thumbsDown', training_failed: 'alert', staff: 'staff' };

export function NotificationsPage() {
  const { client, routePrefix, toast } = useStaff();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, setData, error, loading, reload } = useAsync(() => client.listNotifications({ unread_only: unreadOnly, limit: 100 }), [client, unreadOnly]);

  const open = (n: StaffNotification) => {
    if (!n.read) {
      client.markNotificationRead(n.id).catch(() => undefined);
      setData((d) => (d ? { ...d, unread_count: Math.max(0, d.unread_count - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } : d));
    }
    const target = resolveLink(routePrefix, n.link);
    if (target) window.location.hash = target;
  };

  const readAll = async () => {
    try {
      const res = await client.markAllNotificationsRead();
      setData((d) => (d ? { ...d, unread_count: 0, items: d.items.map((x) => ({ ...x, read: true })) } : d));
      toast(res.updated ? `Marked ${res.updated} as read.` : 'All caught up.');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return (
    <div className="bb-staff-stack" style={{ maxWidth: 900 }}>
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Notifications</h2>
          <p>{data ? `${data.unread_count} unread` : 'Alerts about knowledge gaps, feedback and training.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="bb-staff-seg" role="group" aria-label="Filter">
            <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>
              All
            </button>
            <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
              Unread
            </button>
          </div>
          <Button icon="check" onClick={() => void readAll()} disabled={!data?.unread_count}>
            Mark all read
          </Button>
        </div>
      </div>
      <section className="bb-staff-card" style={{ overflow: 'hidden' }}>
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={6} /> : null}
        {data ? (
          data.items.length ? (
            <div>
              {data.items.map((n) => (
                <button key={n.id} type="button" className={`bb-staff-notif${n.read ? '' : ' is-unread'}`} onClick={() => open(n)} style={{ padding: '16px 20px' }}>
                  <span className={`bb-staff-notif-icon is-${n.type}`}>
                    <Icon name={NOTIF_ICON[n.type] || 'bell'} size={17} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="bb-staff-notif-title" style={{ display: 'block' }}>
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="bb-staff-notif-body" style={{ display: 'block' }}>
                        {n.body}
                      </span>
                    ) : null}
                    <span className="bb-staff-notif-time" style={{ display: 'block' }} title={fmtDateTime(n.created_at)}>
                      {relTime(n.created_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon="bell" title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}>
              You’ll be notified here when the assistant can’t answer a question.
            </EmptyState>
          )
        ) : null}
      </section>
    </div>
  );
}

export function TrainingPage() {
  const { client, can, user } = useStaff();
  const canTrain = can('trainer');
  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Training</h2>
          <p>Documents, snippets and connected tools your assistant learns from.</p>
        </div>
      </div>
      {!canTrain ? <Alert tone="info">Your role ({user.role}) can view training sources. Trainers, admins and owners can add or change them.</Alert> : null}
      <TrainingPanel sdk={client.sdk} variant="embedded" readOnly={!canTrain} primaryColor="var(--bbs-primary)" accentColor="var(--bbs-accent)" title="Knowledge sources" />
    </div>
  );
}
