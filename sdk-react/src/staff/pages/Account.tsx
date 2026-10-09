import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '../icons';
import { useLiveEvent, useLiveRefresh } from '../live';
import { NotificationRow, openNotificationLink } from '../Shell';
import type { StaffNotification } from '../types';
import { TrainingPanel } from '../../TrainingPanel';
import { Alert, Avatar, Button, EmptyState, ErrorState, Field, LiveDot, PasswordInput, RolePill, Segmented, SkeletonRows, Switch, useStaff } from '../ui';
import { errMsg, fmtDateTime, relTime, ROLE_INFO, useAsync } from '../util';
import { PlatformBadge } from '../access';

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
      toast('Profile updated', 'success');
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
      toast('Preferences saved', 'success');
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
      toast('Password changed', 'success');
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
              <div className="bb-staff-profile-name">{user.full_name || user.email.split('@')[0]}</div>
              <div className="bb-staff-muted">{user.email}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <RolePill role={user.role} />
                {user.is_platform_admin ? <PlatformBadge /> : null}
              </span>
              <div className="bb-staff-hint" style={{ marginTop: 6, maxWidth: 280 }}>
                {ROLE_INFO[user.role]?.desc}
                {user.is_platform_admin ? ' As a platform admin you can also manage every company (Platform section).' : ''}
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

export function NotificationsPage() {
  const { client, routePrefix, toast, live, notifications } = useStaff();
  const [unreadOnly, setUnreadOnly] = useState<'all' | 'unread'>('all');
  const { data, setData, error, loading, reload } = useAsync(() => client.listNotifications({ unread_only: unreadOnly === 'unread', limit: 100 }), [client, unreadOnly]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  useLiveRefresh(live, () => void reload(true));
  useLiveEvent(live, 'notification', (n) => {
    setData((d) => (d && !d.items.some((x) => x.id === n.id) ? { ...d, unread_count: d.unread_count + (n.read ? 0 : 1), items: [n, ...d.items] } : d));
    const id = String(n.id);
    setFresh((f) => new Set([...Array.from(f), id]));
    setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => x !== id))), 2400);
  });

  const open = (n: StaffNotification) => {
    if (!n.read) {
      notifications.markRead(n);
      setData((d) => (d ? { ...d, unread_count: Math.max(0, d.unread_count - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } : d));
    }
    openNotificationLink(routePrefix, n);
  };

  const readAll = async () => {
    const n = data?.unread_count || 0;
    setData((d) => (d ? { ...d, unread_count: 0, items: d.items.map((x) => ({ ...x, read: true })) } : d));
    await notifications.markAllRead();
    toast(n ? `Marked ${n} as read` : 'All caught up', 'success');
  };

  return (
    <div className="bb-staff-stack" style={{ maxWidth: 900 }}>
      <div className="bb-staff-page-head">
        <div>
          <h2>
            Notifications <LiveDot />
          </h2>
          <p>{data ? `${data.unread_count} unread` : 'Alerts about knowledge gaps, feedback and training.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented<'all' | 'unread'> label="Filter" value={unreadOnly} onChange={setUnreadOnly} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
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
            <div role="list">
              {data.items.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={open} fresh={fresh.has(String(n.id))} />
              ))}
            </div>
          ) : (
            <EmptyState icon="bell" title={unreadOnly === 'unread' ? 'No unread notifications' : 'No notifications yet'}>
              You’ll be notified here when the assistant can’t answer a question.
            </EmptyState>
          )
        ) : null}
      </section>
    </div>
  );
}

export function TrainingPage() {
  const { client, can, user, live, themeMode } = useStaff();
  const canTrain = can('trainer');
  const [rev, setRev] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refresh the embedded panel's source list on `training` events without remounting it (keeps any
  // half-filled form): a fresh prototype-linked SDK object makes its data hook refetch.
  const bump = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRev((r) => r + 1), 400);
  };
  useLiveEvent(live, 'training', bump);
  useLiveRefresh(live, bump);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const sdk = useMemo(() => (rev ? (Object.create(client.sdk) as typeof client.sdk) : client.sdk), [client, rev]);
  return (
    <div className="bb-staff-stack">
      <div className="bb-staff-page-head">
        <div>
          <h2>
            Training <LiveDot />
          </h2>
          <p>Documents, snippets and connected tools your assistant learns from.</p>
        </div>
      </div>
      {!canTrain ? <Alert tone="info">Your role ({user.role}) can view training sources. Trainers, admins and owners can add or change them.</Alert> : null}
      <TrainingPanel sdk={sdk} variant="embedded" readOnly={!canTrain} title="Knowledge sources" mode={themeMode} />
    </div>
  );
}
