import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BrainboxLogo } from '../design/Logo';
import { playSound } from '../design/sounds';
import type { BrainboxSound } from '../design/sounds';
import { LiveHub } from './live';
import { useHashRouter } from './router';
import { NavItem, openNotificationLink, Shell } from './Shell';
import { CommandPalette } from './palette';
import { BrainboxStaffClient } from './staffClient';
import { useStaffStyles } from './styles';
import type { LiveStatus, StaffDashboardProps, StaffDashboardTheme, StaffNotification, StaffUser } from './types';
import { makeCan, StaffContext, StaffErrorBoundary, ToastViewport, useToastState } from './ui';
import type { NotificationStore, StaffContextValue, ThemeMode } from './ui';
import { AcceptInvitePage, ForcePasswordChangePage, LoginPage, ResetPasswordPage } from './pages/Auth';
import { AllKeysPage, AllUsersPage, CompaniesPage, CompanyDetailPage } from './pages/Platform';
import { OverviewPage } from './pages/Overview';
import { GapsPage } from './pages/Gaps';
import { ConversationDetailPage, ConversationsPage } from './pages/Conversations';
import { StaffPage } from './pages/Staff';
import { MessagesPage } from './pages/Messages';
import { SettingsPage } from './pages/Settings';
import { AccountPage, NotificationsPage, TrainingPage } from './pages/Account';

const PUBLIC_ROUTES = ['login', 'accept-invite', 'reset-password', 'forgot-password'];

const TITLES: Record<string, string> = {
  overview: 'Overview',
  gaps: 'Knowledge gaps',
  conversations: 'Conversations',
  messages: 'Messages',
  training: 'Training',
  staff: 'Staff',
  settings: 'Settings',
  notifications: 'Notifications',
  account: 'Account',
  platform: 'Companies'
};

const PLATFORM_TITLES: Record<string, string> = { companies: 'Companies', users: 'All users', keys: 'All API keys' };
const THEME_KEY = 'bb-staff-theme';
const SOUND_KEY = 'bb-staff-sounds';

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}

function themeVars(theme: StaffDashboardTheme | undefined, offsetTop: number): CSSProperties {
  const v: Record<string, string> = { '--bbs-top': `${offsetTop}px` };
  if (!theme) return v as CSSProperties;
  const map: [keyof StaffDashboardTheme, string][] = [
    ['primary', '--bbs-accent'],
    ['primaryHover', '--bbs-accent-hover'],
    ['surface', '--bbs-bg'],
    ['text', '--bbs-label'],
    ['muted', '--bbs-secondary'],
    ['border', '--bbs-separator'],
    ['fontFamily', '--bbs-font']
  ];
  map.forEach(([k, cssVar]) => {
    const val = theme[k];
    if (val != null && val !== '') v[cssVar] = String(val);
  });
  if (theme.primary && !theme.primaryHover) v['--bbs-accent-hover'] = theme.primary;
  if (theme.radius != null) v['--bbs-radius'] = `${theme.radius}px`;
  return v as CSSProperties;
}

function usePrefersDark(): boolean {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(() => !!q?.matches);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setDark(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return dark;
}

/**
 * Brainbox staff dashboard: knowledge-gap inbox, analytics, conversations, training, staff management and
 * workspace settings — a self-contained app with hash routing (`#<routePrefix>/overview`, `/gaps/:id`, …).
 * Updates live over `GET /api/staff/events` (SSE) with a silent polling fallback.
 */
export function StaffDashboard({
  apiUrl,
  brandName = 'Brainbox',
  logoUrl,
  theme,
  routePrefix = '',
  offsetTop = 0,
  client: clientProp,
  className,
  sounds: soundsProp = true,
  live: liveProp = true
}: StaffDashboardProps) {
  useStaffStyles();
  const client = useMemo(() => clientProp || new BrainboxStaffClient({ apiUrl }), [clientProp, apiUrl]);
  const { route, href, navigate } = useHashRouter(routePrefix);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [booting, setBooting] = useState(() => client.isAuthenticated());
  const [openGaps, setOpenGaps] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const expiredRef = useRef(false);
  // Password typed at sign-in, kept in memory only to prefill a forced password change.
  const loginPasswordRef = useRef<string | undefined>(undefined);

  /* ---------------- appearance & sound ---------------- */
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const s = readLS(THEME_KEY);
    return s === 'light' || s === 'dark' || s === 'auto' ? s : theme?.mode || 'light';
  });
  const setThemeMode = useCallback((m: ThemeMode) => {
    setThemeModeState(m);
    writeLS(THEME_KEY, m);
  }, []);
  const prefersDark = usePrefersDark();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && prefersDark);

  const [sounds, setSoundsState] = useState<boolean>(() => {
    const s = readLS(SOUND_KEY);
    return s === '1' ? true : s === '0' ? false : soundsProp;
  });
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  const play = useCallback((name: BrainboxSound) => playSound(name, soundsRef.current), []);
  const setSounds = useCallback((on: boolean) => {
    setSoundsState(on);
    soundsRef.current = on;
    writeLS(SOUND_KEY, on ? '1' : '0');
    if (on) playSound('success', true);
  }, []);

  const { toasts, push, dismiss } = useToastState(play);

  /* ---------------- session ---------------- */
  useEffect(() => {
    let alive = true;
    if (!client.isAuthenticated()) {
      setBooting(false);
      return undefined;
    }
    setBooting(true);
    client
      .me()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, [client]);

  const userRef = useRef<StaffUser | null>(null);
  userRef.current = user;

  useEffect(
    () =>
      client.onTokenChange((token) => {
        if (token) return;
        if (userRef.current && !expiredRef.current) push('Your session expired', 'info', { body: 'Please sign in again.' });
        expiredRef.current = false;
        loginPasswordRef.current = undefined;
        setUser(null);
      }),
    [client, push]
  );

  /* ---------------- live hub ---------------- */
  const hub = useMemo(() => new LiveHub(client), [client]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const ready = !!user && !user.must_change_password;
  useEffect(() => hub.onStatus(setLiveStatus), [hub]);
  useEffect(() => {
    if (!ready || !liveProp) return undefined;
    hub.start();
    return () => hub.stop();
  }, [hub, ready, liveProp]);
  const pollingMode = liveStatus === 'polling' || (!liveProp && ready);

  /* ---------------- counts ---------------- */
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCounts = useCallback(() => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(() => {
      if (!client.isAuthenticated()) return;
      client
        .listGaps({ status: 'open', page: 1, page_size: 1 })
        .then((r) => setOpenGaps(r.counts?.open ?? r.total))
        .catch(() => undefined);
    }, 150);
  }, [client]);

  useEffect(() => {
    if (!ready) return undefined;
    refreshCounts();
    const id = setInterval(refreshCounts, pollingMode ? 15000 : 120000);
    return () => clearInterval(id);
  }, [ready, refreshCounts, pollingMode]);

  /* ---------------- notifications store ---------------- */
  const [notifItems, setNotifItems] = useState<StaffNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const knownIds = useRef<Set<string> | null>(null);

  const markFresh = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFresh((f) => new Set([...Array.from(f), ...ids]));
    setTimeout(() => setFresh((f) => new Set(Array.from(f).filter((x) => !ids.includes(x)))), 2400);
  }, []);

  const announceNotification = useCallback(
    (n: StaffNotification, allTypes: boolean) => {
      if (!allTypes && n.type === 'gap') return; // the `gap` event already toasted it
      const tone = n.type === 'training_failed' ? 'error' : n.type === 'feedback' ? 'warning' : 'info';
      push(n.title, tone, {
        body: n.body,
        sound: 'notify',
        action: n.link ? { label: 'Open', onClick: () => openNotificationLink(routePrefix, n) } : undefined
      });
    },
    [push, routePrefix]
  );

  const loadNotifications = useCallback(
    async (announce = false) => {
      if (!client.isAuthenticated()) return;
      try {
        const res = await client.listNotifications({ limit: 30 });
        const items = res.items || [];
        const prev = knownIds.current;
        const ids = new Set(items.map((n) => String(n.id)));
        if (prev && announce) {
          const added = items.filter((n) => !prev.has(String(n.id)) && !n.read);
          markFresh(added.map((n) => String(n.id)));
          added.slice(0, 2).forEach((n) => announceNotification(n, true));
          if (added.some((n) => n.type === 'gap' || n.type === 'feedback')) refreshCounts();
        }
        knownIds.current = ids;
        setNotifItems(items);
        setUnread(res.unread_count || 0);
        setNotifLoaded(true);
      } catch {
        /* the bell is best-effort */
      }
    },
    [client, markFresh, announceNotification, refreshCounts]
  );

  useEffect(() => {
    if (!ready) {
      knownIds.current = null;
      setNotifItems([]);
      setUnread(0);
      setNotifLoaded(false);
      return undefined;
    }
    void loadNotifications();
    if (!pollingMode) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) void loadNotifications(true);
    }, 15000);
    return () => clearInterval(id);
  }, [ready, pollingMode, loadNotifications]);

  const markRead = useCallback(
    (n: StaffNotification) => {
      if (n.read) return;
      setNotifItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      client.markNotificationRead(n.id).catch(() => {
        setNotifItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        setUnread((u) => u + 1);
      });
    },
    [client]
  );

  const markAllRead = useCallback(async () => {
    const before = notifItems;
    const beforeUnread = unread;
    setNotifItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await client.markAllNotificationsRead();
    } catch (err: any) {
      setNotifItems(before);
      setUnread(beforeUnread);
      push('Couldn’t mark notifications as read', 'error', { body: err?.message });
    }
  }, [client, notifItems, unread, push]);

  const notifications = useMemo<NotificationStore>(
    () => ({ items: notifItems, unread, loaded: notifLoaded, fresh, reload: () => loadNotifications(), markRead, markAllRead }),
    [notifItems, unread, notifLoaded, fresh, loadNotifications, markRead, markAllRead]
  );

  /* ---------------- global live reactions ---------------- */
  const can = useMemo(() => makeCan(user), [user]);
  useEffect(() => {
    if (!ready) return undefined;
    const offs = [
      hub.on('notification', (n) => {
        const id = String(n.id);
        if (knownIds.current?.has(id)) return;
        knownIds.current?.add(id);
        setNotifItems((list) => (list.some((x) => String(x.id) === id) ? list : [n, ...list].slice(0, 50)));
        if (!n.read) setUnread((u) => u + 1);
        markFresh([id]);
        announceNotification(n, false);
      }),
      hub.on('gap', (e) => {
        if (e.action === 'created' && e.gap.status === 'open') {
          setOpenGaps((c) => (c == null ? c : c + 1));
          if (e.gap.reason !== 'negative_feedback') {
            push('New unanswered question', 'warning', {
              body: `“${e.gap.question}”${e.gap.user_name ? ` — ${e.gap.user_name}` : ''}`,
              sound: 'notify',
              action: { label: can('trainer') ? 'Answer' : 'View', onClick: () => navigate(`/gaps/${e.gap.id}`, can('trainer') ? { answer: 1 } : undefined) }
            });
          }
        }
        refreshCounts();
      }),
      hub.on('overview', (o) => {
        if (typeof o.open_gaps === 'number') setOpenGaps(o.open_gaps);
      }),
      hub.on('resync', () => {
        void loadNotifications(true);
        refreshCounts();
      })
    ];
    return () => offs.forEach((off) => off());
  }, [hub, ready, push, navigate, can, refreshCounts, markFresh, announceNotification, loadNotifications]);

  /* ---------------- ⌘K ---------------- */
  useEffect(() => {
    if (!ready) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ready]);

  /* ---------------- routing ---------------- */
  const section = route.segments[0] || '';
  const isPublic = PUBLIC_ROUTES.includes(section);

  useEffect(() => {
    if (route.outside || booting) return;
    if (user && (section === 'login' || section === '')) {
      const next = route.query.next;
      navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/overview', undefined, { replace: true });
    } else if (!user && !isPublic) {
      const next = section ? route.path : undefined;
      navigate('/login', next && next !== '/' ? { next } : undefined, { replace: true });
    }
  }, [user, booting, section, isPublic, route.path, route.query.next, route.outside, navigate]);

  useEffect(() => setPaletteOpen(false), [route.path]);

  const signOut = useCallback(() => {
    expiredRef.current = true;
    client.logout();
    setUser(null);
    push('You’ve been signed out', 'info');
    navigate('/login');
  }, [client, navigate, push]);

  const onAuthenticated = useCallback(
    (u: StaffUser, meta?: { password?: string }) => {
      loginPasswordRef.current = u.must_change_password ? meta?.password : undefined;
      setUser(u);
      push(`Welcome${u.full_name ? `, ${u.full_name.split(' ')[0]}` : ''}`, 'success');
      const next = route.query.next;
      navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/overview', undefined, { replace: true });
    },
    [navigate, push, route.query.next]
  );

  const setQuerySearch = useCallback(
    (q: string) => navigate(route.path, { ...route.query, q: q || undefined, page: undefined }, { replace: true }),
    [navigate, route.path, route.query]
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  const ctx = useMemo<StaffContextValue | null>(
    () =>
      user
        ? {
            client,
            user,
            setUser,
            can,
            toast: push,
            href,
            navigate,
            query: route.query,
            brandName,
            routePrefix,
            openGaps,
            refreshCounts,
            signOut,
            live: hub,
            liveStatus,
            sounds,
            setSounds,
            play,
            themeMode,
            setThemeMode,
            notifications,
            openPalette
          }
        : null,
    [client, user, can, push, href, navigate, route.query, brandName, routePrefix, openGaps, refreshCounts, signOut, hub, liveStatus, sounds, setSounds, play, themeMode, setThemeMode, notifications, openPalette]
  );

  const rootClass = `bb-staff${isDark ? ' is-dark' : ''}${className ? ` ${className}` : ''}`;
  const rootStyle = themeVars(theme, offsetTop);
  const toastsEl = <ToastViewport toasts={toasts} dismiss={dismiss} />;

  if (booting) {
    return (
      <div className={rootClass} style={rootStyle}>
        <div className="bb-staff-center-screen" aria-busy="true" aria-label="Loading">
          <span className="bb-staff-loader">
            <BrainboxLogo size={44} title="" />
          </span>
        </div>
      </div>
    );
  }

  const authProps = { client, brandName, logoUrl, href, navigate, onAuthenticated };

  if (user && user.must_change_password && section !== 'accept-invite' && section !== 'reset-password') {
    return (
      <div className={rootClass} style={rootStyle}>
        <ForcePasswordChangePage
          client={client}
          brandName={brandName}
          logoUrl={logoUrl}
          user={user}
          currentPassword={loginPasswordRef.current}
          onSignOut={signOut}
          onDone={(u) => {
            loginPasswordRef.current = undefined;
            setUser(u);
            push('Password updated', 'success', { body: 'Welcome to the staff console.' });
          }}
        />
        {toastsEl}
      </div>
    );
  }

  if (section === 'accept-invite' || section === 'reset-password' || !user || !ctx) {
    let page: ReactNode;
    if (section === 'accept-invite') page = <AcceptInvitePage {...authProps} token={route.query.token || ''} />;
    else if (section === 'reset-password') page = <ResetPasswordPage {...authProps} token={route.query.token || ''} />;
    else page = <LoginPage {...authProps} next={route.query.next} />;
    return (
      <div className={rootClass} style={rootStyle}>
        {page}
        {toastsEl}
      </div>
    );
  }

  const nav: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'overview' },
    { key: 'gaps', label: 'Knowledge gaps', icon: 'gaps', badge: openGaps, alert: !!openGaps },
    { key: 'conversations', label: 'Conversations', icon: 'chat' },
    { key: 'messages', label: 'Messages', icon: 'database' },
    { key: 'training', label: 'Training', icon: 'training' },
    { key: 'notifications', label: 'Notifications', icon: 'bell', badge: unread || null },
    { key: 'staff', label: 'Staff', icon: 'staff' },
    { key: 'settings', label: 'Settings', icon: 'settings' }
  ];
  if (user.is_platform_admin) {
    nav.push(
      { key: 'platform/companies', label: 'Companies', icon: 'building', group: 'Platform' },
      { key: 'platform/users', label: 'All users', icon: 'staff', group: 'Platform' },
      { key: 'platform/keys', label: 'All API keys', icon: 'key', group: 'Platform' }
    );
  }

  const seg1 = route.segments[1];
  let page: ReactNode;
  let title = TITLES[section] || 'Overview';
  let crumbs: { label: string; to?: string }[] | undefined;
  let search: { placeholder: string; value: string; onChange: (v: string) => void } | null = null;
  switch (section) {
    case 'gaps':
      page = <GapsPage gapId={seg1} />;
      break;
    case 'conversations':
      if (seg1) {
        page = <ConversationDetailPage sessionId={seg1} />;
        crumbs = [{ label: 'Conversations', to: '/conversations' }];
        title = 'Transcript';
      } else {
        page = <ConversationsPage />;
      }
      break;
    case 'messages':
      page = <MessagesPage />;
      break;
    case 'training':
      page = <TrainingPage />;
      break;
    case 'staff':
      page = <StaffPage />;
      search = { placeholder: 'Filter staff…', value: route.query.q || '', onChange: setQuerySearch };
      break;
    case 'settings':
      page = <SettingsPage tab={seg1} />;
      break;
    case 'notifications':
      page = <NotificationsPage />;
      break;
    case 'account':
      page = <AccountPage />;
      break;
    case 'platform': {
      const sub = seg1 && PLATFORM_TITLES[seg1] ? seg1 : 'companies';
      if (!user.is_platform_admin) {
        page = <OverviewPage />;
        title = 'Overview';
        break;
      }
      title = PLATFORM_TITLES[sub];
      crumbs = [{ label: 'Platform' }];
      if (sub === 'companies' && route.segments[2]) {
        page = <CompanyDetailPage tenantId={route.segments[2]} tab={route.segments[3]} />;
        crumbs = [{ label: 'Platform' }, { label: 'Companies', to: '/platform/companies' }];
        title = 'Company';
      } else if (sub === 'users') {
        page = <AllUsersPage />;
        search = { placeholder: 'Filter name, email or company…', value: route.query.q || '', onChange: setQuerySearch };
      } else if (sub === 'keys') {
        page = <AllKeysPage />;
        search = { placeholder: 'Filter keys or companies…', value: route.query.q || '', onChange: setQuerySearch };
      } else {
        page = <CompaniesPage />;
        search = { placeholder: 'Filter companies or owners…', value: route.query.q || '', onChange: setQuerySearch };
      }
      break;
    }
    default:
      page = <OverviewPage />;
      title = 'Overview';
  }

  const navSection = section === 'platform' ? `platform/${seg1 && PLATFORM_TITLES[seg1] ? seg1 : 'companies'}` : section;
  const activeKey = nav.some((n) => n.key === navSection) ? navSection : section === 'account' ? '' : 'overview';

  return (
    <StaffContext.Provider value={ctx}>
      <Shell
        nav={nav}
        active={activeKey}
        title={title}
        crumbs={crumbs}
        search={search}
        logoUrl={logoUrl}
        rootClassName={rootClass}
        rootStyle={rootStyle}
        overlay={
          <>
            {paletteOpen ? <CommandPalette nav={nav} onClose={() => setPaletteOpen(false)} /> : null}
            {toastsEl}
          </>
        }
      >
        <StaffErrorBoundary resetKey={route.path} onHome={() => navigate('/overview')}>
          <div className="bb-staff-page" key={section}>
            {page}
          </div>
        </StaffErrorBoundary>
      </Shell>
    </StaffContext.Provider>
  );
}

export default StaffDashboard;
