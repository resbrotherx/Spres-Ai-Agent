import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons';
import type { StaffIconName } from './icons';
import { resolveLink } from './router';
import type { StaffNotification } from './types';
import { Avatar, IconButton, menuKeyNav, useDismiss, useStaff } from './ui';
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

export function BrandMark({ logoUrl, size = 36 }: { logoUrl?: string; size?: number }) {
  return (
    <span className="bb-staff-logo" style={{ width: size, height: size }}>
      {logoUrl ? <img src={logoUrl} alt="" /> : <Icon name="brain" size={Math.round(size * 0.55)} strokeWidth={1.8} />}
    </span>
  );
}

const NOTIF_ICON: Record<string, StaffIconName> = { gap: 'gaps', feedback: 'thumbsDown', training_failed: 'alert', staff: 'staff' };

function NotificationsMenu() {
  const { client, routePrefix, navigate, toast } = useStaff();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const load = useCallback(async () => {
    try {
      const res = await client.listNotifications({ limit: 15 });
      setItems(res.items || []);
      setUnread(res.unread_count || 0);
    } catch {
      /* the bell is best-effort; pages show their own errors */
    }
  }, [client]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void load().finally(() => {
      setLoading(false);
      // Move focus into the list so arrow keys / Enter work right away.
      ref.current?.querySelector<HTMLElement>('.bb-staff-notif-list [role="menuitem"]')?.focus();
    });
  }, [open, load]);

  const openItem = async (n: StaffNotification) => {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      client.markNotificationRead(n.id).catch(() => undefined);
    }
    const target = resolveLink(routePrefix, n.link);
    if (target) {
      if (/^https?:/i.test(target)) window.open(target, '_blank', 'noopener');
      else window.location.hash = target;
    }
  };

  const readAll = async () => {
    try {
      await client.markAllNotificationsRead();
      setItems((list) => list.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (err: any) {
      toast(err?.message || 'Couldn’t mark notifications as read', 'error');
    }
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
        {unread ? <span className="bb-staff-dot-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="bb-staff-popover bb-staff-notif-pop" role="dialog" aria-label="Notifications">
          <div className="bb-staff-notif-head">
            <h3>
              Notifications {unread ? <span className="bb-staff-count" style={{ marginLeft: 6, background: '#dbeafe', color: '#1d4ed8' }}>{unread}</span> : null}
            </h3>
            <button type="button" className="bb-staff-link-btn" onClick={() => void readAll()} disabled={!unread} style={!unread ? { opacity: 0.45, cursor: 'default' } : undefined}>
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
            {loading && !items.length ? (
              <div style={{ padding: 24, textAlign: 'center' }} className="bb-staff-muted">
                <Icon name="loader" /> Loading…
              </div>
            ) : items.length ? (
              items.map((n) => (
                <button key={n.id} type="button" role="menuitem" className={`bb-staff-notif${n.read ? '' : ' is-unread'}`} onClick={() => void openItem(n)}>
                  <span className={`bb-staff-notif-icon is-${n.type}`}>
                    <Icon name={NOTIF_ICON[n.type] || 'bell'} size={17} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="bb-staff-notif-title bb-staff-clamp2" style={{ display: '-webkit-box' }}>
                      {n.title}
                    </span>
                    {n.body ? <span className="bb-staff-notif-body bb-staff-clamp2" style={{ display: '-webkit-box' }}>{n.body}</span> : null}
                    <span className="bb-staff-notif-time" style={{ display: 'block' }}>
                      {n.read ? '' : 'New · '}
                      {relTime(n.created_at)}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="bb-staff-empty" style={{ padding: '32px 20px' }}>
                <div className="bb-staff-empty-icon">
                  <Icon name="bell" size={22} />
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
  const { user, navigate, signOut } = useStaff();
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
        <span className="bb-staff-user-btn-name bb-staff-truncate">{name}</span>
        <Icon name="chevronDown" size={15} className="bb-staff-muted" />
      </button>
      {open ? (
        <div className="bb-staff-popover" style={{ width: 260 }}>
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
  const { brandName, href, user } = useStaff();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('bb-staff-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);

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
            <BrandMark logoUrl={logoUrl} />
            <div className="bb-staff-brand-text">
              <div className="bb-staff-brand-name bb-staff-truncate">{brandName}</div>
              <div className="bb-staff-brand-sub">Staff console</div>
            </div>
            {drawer ? (
              <button type="button" className="bb-staff-collapse" style={{ marginLeft: 'auto', display: 'grid', padding: 6 }} onClick={() => setDrawer(false)} aria-label="Close menu">
                <Icon name="x" size={18} />
              </button>
            ) : null}
          </div>
          <nav className="bb-staff-nav">
            {nav.map((item, i) => {
              const group = item.group || 'Workspace';
              const heading = i === 0 || (nav[i - 1].group || 'Workspace') !== group;
              return (
              <div key={item.key} style={{ display: 'contents' }}>
              {heading ? (
                <div className={`bb-staff-nav-section${group !== 'Workspace' ? ' is-platform' : ''}`}>
                  {group !== 'Workspace' ? <Icon name="shield" size={12} /> : null}
                  {group}
                </div>
              ) : null}
              <a
                key={item.key}
                href={href(`/${item.key}`)}
                className="bb-staff-nav-item"
                aria-current={active === item.key ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={19} />
                <span className="bb-staff-nav-label">{item.label}</span>
                {item.badge ? (
                  <span className={`bb-staff-nav-badge${item.alert ? ' is-alert' : ''}`} aria-label={`${item.badge} open`}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </a>
              </div>
              );
            })}
          </nav>
          <div className="bb-staff-side-foot">
            <a href={href('/account')} className="bb-staff-side-user" style={{ textDecoration: 'none' }} title={collapsed ? name : undefined}>
              <Avatar name={user.full_name} email={user.email} size="sm" />
              <span className="bb-staff-side-user-text">
                <span className="bb-staff-side-user-name bb-staff-truncate" style={{ display: 'block' }}>
                  {name}
                </span>
                <span className="bb-staff-side-user-role">{user.role}{user.is_platform_admin ? ' · platform admin' : ''}</span>
              </span>
            </a>
            <button type="button" className="bb-staff-collapse" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
              <Icon name="chevronLeft" size={17} />
              <span className="bb-staff-collapse-label">Collapse</span>
            </button>
          </div>
        </aside>
        <div className="bb-staff-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <div className="bb-staff-main">
        <header className="bb-staff-top">
          <IconButton icon="menu" label="Open menu" className="bb-staff-menu-btn" onClick={() => setDrawer(true)} aria-controls="bb-staff-sidebar" aria-expanded={drawer} />
          <div className="bb-staff-top-title">
            {crumbs && crumbs.length ? (
              <nav className="bb-staff-crumbs" aria-label="Breadcrumb">
                {crumbs.map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {c.to ? <a href={href(c.to)}>{c.label}</a> : <span>{c.label}</span>}
                    <Icon name="chevronRight" size={12} />
                  </span>
                ))}
              </nav>
            ) : null}
            <h1>{title}</h1>
          </div>
          {search ? (
            <div className="bb-staff-top-search" role="search">
              <Icon name="search" size={16} />
              <input type="search" placeholder={search.placeholder} aria-label={search.placeholder} value={search.value} onChange={(e) => search.onChange(e.target.value)} />
            </div>
          ) : null}
          <div className="bb-staff-top-actions">
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
