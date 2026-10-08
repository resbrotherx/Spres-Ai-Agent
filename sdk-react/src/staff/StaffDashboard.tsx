import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons';
import { useHashRouter } from './router';
import { NavItem, Shell } from './Shell';
import { BrainboxStaffClient } from './staffClient';
import { useStaffStyles } from './styles';
import type { StaffDashboardProps, StaffDashboardTheme, StaffUser } from './types';
import { makeCan, StaffContext, ToastViewport, useToastState } from './ui';
import type { StaffContextValue } from './ui';
import { AcceptInvitePage, LoginPage, ResetPasswordPage } from './pages/Auth';
import { OverviewPage } from './pages/Overview';
import { GapsPage } from './pages/Gaps';
import { ConversationDetailPage, ConversationsPage } from './pages/Conversations';
import { StaffPage } from './pages/Staff';
import { SettingsPage } from './pages/Settings';
import { AccountPage, NotificationsPage, TrainingPage } from './pages/Account';

const PUBLIC_ROUTES = ['login', 'accept-invite', 'reset-password', 'forgot-password'];

const TITLES: Record<string, string> = {
  overview: 'Overview',
  gaps: 'Knowledge gaps',
  conversations: 'Conversations',
  training: 'Training',
  staff: 'Staff',
  settings: 'Settings',
  notifications: 'Notifications',
  account: 'Account'
};

function themeVars(theme: StaffDashboardTheme | undefined, offsetTop: number): CSSProperties {
  const v: Record<string, string> = { '--bbs-top': `${offsetTop}px` };
  if (!theme) return v as CSSProperties;
  const map: [keyof StaffDashboardTheme, string][] = [
    ['primary', '--bbs-primary'],
    ['primaryHover', '--bbs-primary-hover'],
    ['accent', '--bbs-accent'],
    ['sidebarFrom', '--bbs-side-from'],
    ['sidebarTo', '--bbs-side-to'],
    ['surface', '--bbs-surface'],
    ['text', '--bbs-text'],
    ['muted', '--bbs-muted'],
    ['border', '--bbs-border'],
    ['fontFamily', '--bbs-font']
  ];
  map.forEach(([k, cssVar]) => {
    const val = theme[k];
    if (val != null && val !== '') v[cssVar] = String(val);
  });
  if (theme.radius != null) v['--bbs-radius'] = `${theme.radius}px`;
  return v as CSSProperties;
}

/**
 * Brainbox staff dashboard: knowledge-gap inbox, analytics, conversations, training, staff management and
 * workspace settings — a self-contained app with hash routing (`#<routePrefix>/overview`, `/gaps/:id`, …).
 */
export function StaffDashboard({
  apiUrl,
  brandName = 'Brainbox',
  logoUrl,
  theme,
  routePrefix = '',
  offsetTop = 0,
  client: clientProp,
  className
}: StaffDashboardProps) {
  useStaffStyles();
  const client = useMemo(() => clientProp || new BrainboxStaffClient({ apiUrl }), [clientProp, apiUrl]);
  const { route, href, navigate } = useHashRouter(routePrefix);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [booting, setBooting] = useState(() => client.isAuthenticated());
  const { toasts, push, dismiss } = useToastState();
  const [openGaps, setOpenGaps] = useState<number | null>(null);
  const expiredRef = useRef(false);

  // Restore the session from the stored token.
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

  // Session ended (logout or 401) → back to the login screen.
  useEffect(
    () =>
      client.onTokenChange((token) => {
        if (token) return;
        if (userRef.current && !expiredRef.current) push('Your session expired. Please sign in again.', 'info');
        expiredRef.current = false;
        setUser(null);
      }),
    [client, push]
  );

  const refreshCounts = useCallback(() => {
    if (!client.isAuthenticated()) return;
    client
      .listGaps({ status: 'open', page: 1, page_size: 1 })
      .then((r) => setOpenGaps(r.counts?.open ?? r.total))
      .catch(() => undefined);
  }, [client]);

  useEffect(() => {
    if (!user) return undefined;
    refreshCounts();
    const id = setInterval(refreshCounts, 60000);
    return () => clearInterval(id);
  }, [user, refreshCounts]);

  const section = route.segments[0] || '';
  const isPublic = PUBLIC_ROUTES.includes(section);

  // Redirects: root → overview; signed-in on /login → next/overview.
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

  const signOut = useCallback(() => {
    expiredRef.current = true;
    client.logout();
    setUser(null);
    push('You’ve been signed out.', 'info');
    navigate('/login');
  }, [client, navigate, push]);

  const onAuthenticated = useCallback(
    (u: StaffUser) => {
      setUser(u);
      push(`Welcome${u.full_name ? `, ${u.full_name.split(' ')[0]}` : ''}!`);
      const next = route.query.next;
      navigate(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/overview', undefined, { replace: true });
    },
    [navigate, push, route.query.next]
  );

  const setQuerySearch = useCallback(
    (q: string) => navigate(route.path, { ...route.query, q: q || undefined, page: undefined }, { replace: true }),
    [navigate, route.path, route.query]
  );

  const ctx = useMemo<StaffContextValue | null>(
    () =>
      user
        ? {
            client,
            user,
            setUser,
            can: makeCan(user),
            toast: push,
            href,
            navigate,
            query: route.query,
            brandName,
            routePrefix,
            openGaps,
            refreshCounts,
            signOut
          }
        : null,
    [client, user, push, href, navigate, route.query, brandName, routePrefix, openGaps, refreshCounts, signOut]
  );

  const rootClass = `bb-staff${className ? ` ${className}` : ''}`;
  const rootStyle = themeVars(theme, offsetTop);
  const toastsEl = <ToastViewport toasts={toasts} dismiss={dismiss} />;

  if (booting) {
    return (
      <div className={rootClass} style={rootStyle}>
        <div className="bb-staff-center-screen" aria-busy="true" aria-label="Loading">
          <span className="bb-staff-loader">
            <Icon name="brain" size={22} />
          </span>
        </div>
      </div>
    );
  }

  const authProps = { client, brandName, logoUrl, href, navigate, onAuthenticated };

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
    { key: 'training', label: 'Training', icon: 'training' },
    { key: 'staff', label: 'Staff', icon: 'staff' },
    { key: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const seg1 = route.segments[1];
  let page: ReactNode;
  let title = TITLES[section] || 'Overview';
  let crumbs: { label: string; to?: string }[] | undefined;
  let search: { placeholder: string; value: string; onChange: (v: string) => void } | null = null;
  switch (section) {
    case 'gaps':
      page = <GapsPage gapId={seg1} />;
      search = { placeholder: 'Search knowledge gaps…', value: route.query.q || '', onChange: setQuerySearch };
      break;
    case 'conversations':
      if (seg1) {
        page = <ConversationDetailPage sessionId={seg1} />;
        crumbs = [{ label: 'Conversations', to: '/conversations' }];
        title = 'Transcript';
      } else {
        page = <ConversationsPage />;
        search = { placeholder: 'Search conversations…', value: route.query.q || '', onChange: setQuerySearch };
      }
      break;
    case 'training':
      page = <TrainingPage />;
      break;
    case 'staff':
      page = <StaffPage />;
      search = { placeholder: 'Search staff…', value: route.query.q || '', onChange: setQuerySearch };
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
    default:
      page = <OverviewPage />;
      title = 'Overview';
  }

  const activeKey = nav.some((n) => n.key === section) ? section : section === 'account' || section === 'notifications' ? '' : 'overview';

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
        overlay={toastsEl}
      >
        {page}
      </Shell>
    </StaffContext.Provider>
  );
}

export default StaffDashboard;
