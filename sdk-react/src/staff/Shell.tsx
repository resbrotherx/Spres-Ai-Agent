import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BrainboxLogo } from '../design/Logo';
import { Icon } from './icons';
import type { StaffIconName } from './icons';
import { resolveLink } from './router';
import type { StaffNotification } from './types';
import { Avatar, IconButton, menuKeyNav, Segmented, Switch, useDismiss, useStaff } from './ui';
import type { ThemeMode } from './ui';
import { relTime } from './util';
import { PlatformBadge } from './access';

export interface NavItem {
  key: string;
  label: string;
  icon: StaffIconName;
  badge?: number | null;
  alert?: boolean;
  /** Sidebar section heading; items without one go under “Workspace”. */
  group?: string;
}

export function BrandMark({ logoUrl, size = 32 }: { logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return (
      <span className="bb-staff-logo" style={{ width: size, height: size }}>
        <img src={logoUrl} alt="" />
      </span>
    );
  }
  return <BrainboxLogo size={size} title="" style={{ borderRadius: size * 0.23 }} />;
}

export const NOTIF_ICON: Record<string, StaffIconName> = { gap: 'gaps', feedback: 'thumbsDown', training_failed: 'alert', staff: 'staff' };

export function openNotificationLink(routePrefix: string, n: StaffNotification) {
  const target = resolveLink(routePrefix, n.link);
  if (!target) return;
  if (/^https?:/i.test(target)) window.open(target, '_blank', 'noopener');
  else window.location.hash = target;
}

export function NotificationRow({ n, onOpen, fresh, compact }: { n: StaffNotification; onOpen: (n: StaffNotification) => void; fresh?: boolean; compact?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`bb-staff-notif${n.read ? '' : ' is-unread'}${fresh ? ' is-fresh' : ''}${compact ? '' : ' is-wide'}`} onClick={() => onOpen(n)}>
      <span className={`bb-staff-notif-icon is-${n.type}`}>
        <Icon name={NOTIF_ICON[n.type] || 'bell'} size={16} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className={`bb-staff-notif-title${compact ? ' bb-staff-clamp2' : ''}`}>{n.title}</span>
        {n.body ? <span className={`bb-staff-notif-body${compact ? ' bb-staff-clamp2' : ''}`}>{n.body}</span> : null}
        <span className="bb-staff-notif-time">{relTime(n.created_at)}</span>
      </span>
    </button>
  );
}

function NotificationsMenu() {
  const { notifications, routePrefix, navigate } = useStaff();
  const { items, unread, fresh, loaded, markRead, markAllRead } = notifications;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('.bb-staff-notif-list [role="menuitem"]')?.focus();
    // While the list is open it already shows what toasts would announce: keep them out of its way.
    const root = ref.current?.closest('.bb-staff');
    root?.classList.toggle('is-notif-open', open);
    return () => root?.classList.remove('is-notif-open');
  }, [open]);

  const openItem = (n: StaffNotification) => {
    setOpen(false);
    markRead(n);
    openNotificationLink(routePrefix, n);
  };

  return (
    <div className="bb-staff-pop-anchor" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className="bb-staff-icon-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={19} />
        {unread ? (
          <span key={unread} className="bb-staff-dot-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="bb-staff-popover bb-staff-notif-pop" role="dialog" aria-label="Notifications">
          <div className="bb-staff-notif-head">
            <h3>Notifications</h3>
            <button type="button" className="bb-staff-link-btn" onClick={() => void markAllRead()} disabled={!unread}>
              Mark all read
            </button>
          </div>
          <div
            className="bb-staff-notif-list"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                btnRef.current?.focus();
              } else menuKeyNav(e);
            }}
          >
            {!loaded ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="bb-staff-skel" style={{ height: 44 }} />
                ))}
              </div>
            ) : items.length ? (
              items.slice(0, 15).map((n) => <NotificationRow key={n.id} n={n} onOpen={openItem} fresh={fresh.has(String(n.id))} compact />)
            ) : (
              <div className="bb-staff-empty is-compact">
                <div className="bb-staff-empty-icon">
                  <Icon name="bell" size={26} strokeWidth={1.5} />
                </div>
                <h4>You’re all caught up</h4>
                <p>New knowledge gaps and feedback will show up here.</p>
              </div>
            )}
          </div>
          <div className="bb-staff-notif-foot">
            <button
              type="button"
              className="bb-staff-link-btn"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const { user, navigate, signOut, themeMode, setThemeMode, sounds, setSounds, openPalette } = useStaff();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  const name = user.full_name || user.email.split('@')[0];
  return (
    <div className="bb-staff-pop-anchor" ref={ref}>
      <button ref={btnRef} type="button" className="bb-staff-user-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${name}`} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.full_name} email={user.email} size="sm" />
      </button>
      {open ? (
        <div className="bb-staff-popover bb-staff-user-pop">
          <div className="bb-staff-menu-head">
            <div className="bb-staff-person">
              <Avatar name={user.full_name} email={user.email} />
              <div className="bb-staff-person-text">
                <div className="bb-staff-person-name bb-staff-truncate">{name}</div>
                <div className="bb-staff-person-sub bb-staff-truncate">{user.email}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={`bb-staff-pill bb-staff-role-${user.role}`}>{user.role}</span>
              {user.is_platform_admin ? <PlatformBadge /> : null}
            </div>
          </div>
          <div className="bb-staff-menu-sep" />
          <div className="bb-staff-menu-setting">
            <span>Appearance</span>
            <Segmented<ThemeMode>
              size="sm"
              label="Appearance"
              value={themeMode}
              onChange={setThemeMode}
              options={[
                { value: 'light', label: '', icon: 'sun', title: 'Light' },
                { value: 'dark', label: '', icon: 'moon', title: 'Dark' },
                { value: 'auto', label: '', icon: 'monitor', title: 'Match system' }
              ]}
            />
          </div>
          <div className="bb-staff-menu-setting">
            <span>Sounds</span>
            <Switch size="sm" checked={sounds} onChange={setSounds} label="Sounds" />
          </div>
          <div className="bb-staff-menu-sep" />
          <div
            className="bb-staff-menu"
            role="menu"
            aria-label="Account"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                btnRef.current?.focus();
              } else menuKeyNav(e);
            }}
          >
            <button type="button" role="menuitem" tabIndex={-1} className="bb-staff-menu-item" onClick={() => { setOpen(false); navigate('/account'); }}>
              <Icon name="user" size={16} /> Account settings
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="bb-staff-menu-item" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              <Icon name="bell" size={16} /> Notifications
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="bb-staff-menu-item" onClick={() => { setOpen(false); openPalette(); }}>
              <Icon name="search" size={16} /> Search
              <kbd className="bb-staff-kbd" style={{ marginLeft: 'auto' }}>⌘K</kbd>
            </button>
            <div className="bb-staff-menu-sep" role="separator" />
            <button type="button" role="menuitem" tabIndex={-1} className="bb-staff-menu-item is-danger" onClick={() => { setOpen(false); signOut(); }}>
              <Icon name="logout" size={16} /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LiveIndicator() {
  const { liveStatus } = useStaff();
  const map = {
    live: { label: 'Live', cls: 'is-live', title: 'Connected — updates arrive instantly' },
    connecting: { label: 'Connecting…', cls: 'is-wait', title: 'Connecting to live updates' },
    reconnecting: { label: 'Reconnecting…', cls: 'is-wait', title: 'Connection lost — reconnecting' },
    polling: { label: 'Auto-refresh', cls: 'is-poll', title: 'Live stream unavailable — refreshing every 15–30 seconds' },
    idle: { label: 'Offline', cls: 'is-off', title: 'Not connected' }
  } as const;
  const m = map[liveStatus] || map.idle;
  return (
    <span className={`bb-staff-conn ${m.cls}`} title={m.title} role="status" aria-live="polite">
      <i aria-hidden="true" />
      <span className="bb-staff-conn-label">{m.label}</span>
    </span>
  );
}

export function Shell({
  nav,
  active,
  title,
  crumbs,
  search,
  logoUrl,
  rootClassName,
  rootStyle,
  overlay,
  children
}: {
  nav: NavItem[];
  active: string;
  title: string;
  crumbs?: { label: string; to?: string }[];
  search?: { placeholder: string; value: string; onChange: (v: string) => void } | null;
  logoUrl?: string;
  rootClassName: string;
  rootStyle?: CSSProperties;
  /** Rendered inside the root (toasts, modals). */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const { brandName, href, user, sounds, setSounds, openPalette } = useStaff();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('bb-staff-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    try {
      localStorage.setItem('bb-staff-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Close the mobile drawer when the page changes; Escape closes it too.
  useEffect(() => setDrawer(false), [active, title]);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const name = user.full_name || user.email.split('@')[0];

  return (
    <div className={`${rootClassName} has-side${collapsed ? ' is-collapsed' : ''}${drawer ? ' is-drawer-open' : ''}`} style={rootStyle}>
      <aside className="bb-staff-side" id="bb-staff-sidebar" aria-label="Main navigation">
        <div className="bb-staff-brand">
          <BrandMark logoUrl={logoUrl} size={30} />
          <div className="bb-staff-brand-text">
            <div className="bb-staff-brand-name bb-staff-truncate">{brandName}</div>
            <div className="bb-staff-brand-sub">Staff console</div>
          </div>
          {drawer ? (
            <IconButton icon="x" label="Close menu" size="sm" className="bb-staff-side-close" onClick={() => setDrawer(false)} />
          ) : (
            <IconButton
              icon="sidebar"
              size="sm"
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="bb-staff-collapse"
              onClick={() => setCollapsed((c) => !c)}
              aria-pressed={collapsed}
            />
          )}
        </div>
        <button type="button" className="bb-staff-side-search" onClick={openPalette} title={collapsed ? 'Search (⌘K)' : undefined}>
          <Icon name="search" size={15} />
          <span className="bb-staff-nav-label">Search</span>
          <kbd className="bb-staff-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="bb-staff-nav">
          {nav.map((item, i) => {
            const group = item.group || 'Workspace';
            const heading = i === 0 || (nav[i - 1].group || 'Workspace') !== group;
            return (
              <div key={item.key} style={{ display: 'contents' }}>
                {heading ? (
                  <div className={`bb-staff-nav-section${group !== 'Workspace' ? ' is-platform' : ''}`}>
                    <span>{group}</span>
                  </div>
                ) : null}
                <a href={href(`/${item.key}`)} className="bb-staff-nav-item" aria-current={active === item.key ? 'page' : undefined} title={collapsed ? item.label : undefined}>
                  <Icon name={item.icon} size={18} />
                  <span className="bb-staff-nav-label">{item.label}</span>
                  {item.badge ? (
                    <span key={item.badge} className={`bb-staff-nav-badge${item.alert ? ' is-alert' : ''}`} aria-label={`${item.badge} open`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </a>
              </div>
            );
          })}
        </nav>
        <div className="bb-staff-side-foot">
          <a href={href('/account')} className="bb-staff-side-user" title={collapsed ? name : undefined}>
            <Avatar name={user.full_name} email={user.email} size="sm" />
            <span className="bb-staff-side-user-text">
              <span className="bb-staff-side-user-name bb-staff-truncate">{name}</span>
              <span className="bb-staff-side-user-role">
                {user.role}
                {user.is_platform_admin ? ' · platform' : ''}
              </span>
            </span>
          </a>
        </div>
      </aside>
      <div className="bb-staff-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <div className="bb-staff-main">
        <header className="bb-staff-top">
          <IconButton icon="menu" label="Open menu" className="bb-staff-menu-btn" onClick={() => setDrawer(true)} aria-controls="bb-staff-sidebar" aria-expanded={drawer} />
          <div className="bb-staff-top-title">
            <nav className="bb-staff-crumbs" aria-label="Breadcrumb">
              <span>{brandName}</span>
              {(crumbs || []).map((c, i) => (
                <span key={i} className="bb-staff-crumb">
                  <Icon name="chevronRight" size={11} />
                  {c.to ? <a href={href(c.to)}>{c.label}</a> : <span>{c.label}</span>}
                </span>
              ))}
            </nav>
            <h1>{title}</h1>
          </div>
          {search ? (
            <div className="bb-staff-top-search" role="search">
              <Icon name="filter" size={14} />
              <input type="search" placeholder={search.placeholder} aria-label={search.placeholder} value={search.value} onChange={(e) => search.onChange(e.target.value)} />
            </div>
          ) : null}
          <div className="bb-staff-top-actions">
            <LiveIndicator />
            <button type="button" className="bb-staff-icon-btn bb-staff-palette-btn" onClick={openPalette} aria-label="Search and jump (⌘K)" title={`Search and jump (${isMac ? '⌘K' : 'Ctrl+K'})`}>
              <Icon name="search" size={18} />
            </button>
            <IconButton icon={sounds ? 'volume' : 'volumeOff'} label={sounds ? 'Mute sounds' : 'Turn sounds on'} onClick={() => setSounds(!sounds)} aria-pressed={sounds} />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>
        <main className="bb-staff-content" id="bb-staff-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      {overlay}
    </div>
  );
}
