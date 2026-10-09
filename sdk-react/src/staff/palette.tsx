/* ⌘K command palette: jump to pages, run actions, find gaps / conversations / staff / companies. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon } from './icons';
import type { StaffIconName } from './icons';
import type { NavItem } from './Shell';
import { useStaff } from './ui';
import { relTime, useDebounced } from './util';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: StaffIconName;
  run: () => void;
}

function match(text: string, q: string): boolean {
  if (!q) return true;
  const t = text.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}

export function CommandPalette({ nav, onClose }: { nav: NavItem[]; onClose: () => void }) {
  const { client, navigate, user, can, themeMode, setThemeMode, sounds, setSounds, signOut, notifications } = useStaff();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 200);
  const [remote, setRemote] = useState<PaletteItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cache = useRef<{ staff?: any[]; tenants?: any[] }>({});

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.activeElement as HTMLElement | null;
    return () => prev?.focus?.();
  }, []);

  const go = (to: string, query?: Record<string, string>) => {
    onClose();
    navigate(to, query);
  };

  const local = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = nav.map((n) => ({ id: `p:${n.key}`, group: n.group || 'Pages', label: n.label, icon: n.icon, run: () => go(`/${n.key}`) }));
    if (!pages.some((x) => x.id === 'p:notifications')) pages.push({ id: 'p:notifications', group: 'Pages', label: 'Notifications', icon: 'bell', run: () => go('/notifications') });
    pages.push({ id: 'p:account', group: 'Pages', label: 'Account settings', icon: 'user', run: () => go('/account') });
    const actions: PaletteItem[] = [
      { id: 'a:theme', group: 'Actions', label: themeMode === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance', icon: themeMode === 'dark' ? 'sun' : 'moon', run: () => { setThemeMode(themeMode === 'dark' ? 'light' : 'dark'); onClose(); } },
      { id: 'a:sound', group: 'Actions', label: sounds ? 'Mute sounds' : 'Turn sounds on', icon: sounds ? 'volumeOff' : 'volume', run: () => { setSounds(!sounds); onClose(); } },
      { id: 'a:read', group: 'Actions', label: 'Mark all notifications read', icon: 'check', run: () => { void notifications.markAllRead(); onClose(); } },
      { id: 'a:open', group: 'Actions', label: 'Show open knowledge gaps', icon: 'gaps', run: () => go('/gaps', { status: 'open' }) }
    ];
    if (can('trainer')) actions.push({ id: 'a:train', group: 'Actions', label: 'Add training source', icon: 'plus', run: () => go('/training') });
    if (can('admin')) actions.push({ id: 'a:invite', group: 'Actions', label: 'Invite a team member', icon: 'mail', run: () => go('/staff') });
    actions.push({ id: 'a:out', group: 'Actions', label: 'Sign out', icon: 'logout', run: () => { onClose(); signOut(); } });
    return [...pages, ...actions].filter((i) => match(i.label, q.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, q, themeMode, sounds, can]);

  useEffect(() => {
    if (dq.length < 2) {
      setRemote([]);
      setSearching(false);
      return undefined;
    }
    let alive = true;
    setSearching(true);
    const tasks: Promise<PaletteItem[]>[] = [
      client
        .listGaps({ q: dq, status: 'all', page_size: 5 })
        .then((r) =>
          r.items.map((g) => ({
            id: `g:${g.id}`,
            group: 'Knowledge gaps',
            label: g.question,
            sub: `${g.status} · ${relTime(g.last_seen_at)}`,
            icon: 'gaps' as StaffIconName,
            run: () => go(`/gaps/${g.id}`)
          }))
        )
        .catch(() => []),
      client
        .listConversations({ q: dq, page_size: 5 })
        .then((r) =>
          r.items.map((c) => ({
            id: `c:${c.session_id}`,
            group: 'Conversations',
            label: c.title || 'Untitled conversation',
            sub: `${c.user_name || 'Anonymous'} · ${relTime(c.last_message_at || c.created_at)}`,
            icon: 'chat' as StaffIconName,
            run: () => go(`/conversations/${encodeURIComponent(c.session_id)}`)
          }))
        )
        .catch(() => []),
      (cache.current.staff ? Promise.resolve(cache.current.staff) : client.listStaff().then((s) => (cache.current.staff = s)))
        .then((list) =>
          list
            .filter((u: any) => match(`${u.full_name || ''} ${u.email}`, dq))
            .slice(0, 5)
            .map((u: any) => ({ id: `u:${u.id}`, group: 'Staff', label: u.full_name || u.email, sub: `${u.email} · ${u.role}`, icon: 'user' as StaffIconName, run: () => go('/staff', { q: u.email }) }))
        )
        .catch(() => [])
    ];
    if (user.is_platform_admin) {
      tasks.push(
        (cache.current.tenants ? Promise.resolve(cache.current.tenants) : client.listTenants().then((t) => (cache.current.tenants = t)))
          .then((list) =>
            list
              .filter((t: any) => match(`${t.display_name || ''} ${t.tenant_id} ${(t.owners || []).join(' ')}`, dq))
              .slice(0, 5)
              .map((t: any) => ({
                id: `t:${t.tenant_id}`,
                group: 'Companies',
                label: t.display_name || t.tenant_id,
                sub: `${t.staff_count} staff · ${t.open_gaps} open gaps`,
                icon: 'building' as StaffIconName,
                run: () => go(`/platform/companies/${encodeURIComponent(t.tenant_id)}`)
              }))
          )
          .catch(() => [])
      );
    }
    void Promise.all(tasks).then((groups) => {
      if (!alive) return;
      setRemote(([] as PaletteItem[]).concat(...groups));
      setSearching(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, client, user.is_platform_admin]);

  const items = [...local, ...remote];
  useEffect(() => setSel(0), [q, remote.length]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[sel]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  let lastGroup = '';
  return (
    <>
      <div className="bb-staff-overlay is-light" onClick={onClose} />
      <div className="bb-staff-palette-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bb-staff-palette" role="dialog" aria-modal="true" aria-label="Search and jump" onKeyDown={onKey}>
          <div className="bb-staff-palette-input">
            <Icon name="search" size={18} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages, gaps, conversations, people…"
              aria-label="Search"
              role="combobox"
              aria-expanded="true"
              aria-controls="bb-staff-palette-list"
              aria-activedescendant={items[sel] ? `bb-pal-${sel}` : undefined}
            />
            {searching ? <Icon name="loader" size={16} /> : <kbd className="bb-staff-kbd">esc</kbd>}
          </div>
          <div className="bb-staff-palette-list" id="bb-staff-palette-list" role="listbox" ref={listRef}>
            {items.length ? (
              items.map((it, i) => {
                const head = it.group !== lastGroup;
                lastGroup = it.group;
                return (
                  <div key={it.id}>
                    {head ? <div className="bb-staff-palette-group">{it.group}</div> : null}
                    <div
                      id={`bb-pal-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={i === sel}
                      className="bb-staff-palette-item"
                      onMouseMove={() => sel !== i && setSel(i)}
                      onClick={() => it.run()}
                    >
                      <span className="bb-staff-palette-icon">
                        <Icon name={it.icon} size={16} />
                      </span>
                      <span className="bb-staff-palette-text">
                        <span className="bb-staff-truncate">{it.label}</span>
                        {it.sub ? <span className="bb-staff-palette-sub bb-staff-truncate">{it.sub}</span> : null}
                      </span>
                      {i === sel ? <Icon name="enter" size={14} className="bb-staff-palette-enter" /> : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bb-staff-palette-empty">{searching ? 'Searching…' : dq.length < 2 && q ? 'Keep typing to search records…' : 'No results'}</div>
            )}
          </div>
          <div className="bb-staff-palette-foot">
            <span>
              <kbd className="bb-staff-kbd">↑</kbd>
              <kbd className="bb-staff-kbd">↓</kbd> navigate
            </span>
            <span>
              <kbd className="bb-staff-kbd">↵</kbd> open
            </span>
            <span>
              <kbd className="bb-staff-kbd">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
