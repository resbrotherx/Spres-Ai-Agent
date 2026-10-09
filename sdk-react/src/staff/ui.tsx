import { Component, createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { Icon } from './icons';
import type { StaffIconName } from './icons';
import type { BrainboxStaffClient } from './staffClient';
import { hasRole } from './staffClient';
import type { GapReason, LiveStatus, StaffNotification, StaffRole, StaffUser } from './types';
import type { LiveHub } from './live';
import type { BrainboxSound } from '../design/sounds';
import { avatarBg, copyText, initials, REASON_HELP, REASON_LABELS } from './util';

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Secondary line under the title. */
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Play a sound: true = tone default (success/error), a sound name, or false for silence. */
  sound?: boolean | BrainboxSound;
  /** Override auto-dismiss (ms). */
  duration?: number;
}

export type ToastFn = (message: string, tone?: ToastTone, opts?: ToastOptions) => void;

export interface NotificationStore {
  items: StaffNotification[];
  unread: number;
  loaded: boolean;
  /** ids that arrived live in this session (for the insert animation). */
  fresh: Set<string>;
  reload: () => Promise<void>;
  markRead: (n: StaffNotification) => void;
  markAllRead: () => Promise<void>;
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface StaffContextValue {
  client: BrainboxStaffClient;
  user: StaffUser;
  setUser: (u: StaffUser) => void;
  can: (min: StaffRole) => boolean;
  toast: ToastFn;
  href: (to: string, query?: Record<string, string | number | undefined | null>) => string;
  navigate: (to: string, query?: Record<string, string | number | undefined | null>, opts?: { replace?: boolean }) => void;
  query: Record<string, string>;
  brandName: string;
  routePrefix: string;
  openGaps: number | null;
  refreshCounts: () => void;
  signOut: () => void;
  /** Real-time hub (SSE with polling fallback). */
  live: LiveHub;
  liveStatus: LiveStatus;
  sounds: boolean;
  setSounds: (on: boolean) => void;
  play: (name: BrainboxSound) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  notifications: NotificationStore;
  openPalette: () => void;
}

export const StaffContext = createContext<StaffContextValue | null>(null);

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used inside <StaffDashboard>');
  return ctx;
}

export function makeCan(user: StaffUser | null) {
  return (min: StaffRole) => !!user && hasRole(user.role, min);
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  duration: number;
  leaving?: boolean;
}

let toastSeq = 0;

export function useToastState(play?: (name: BrainboxSound) => void) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const playRef = useRef(play);
  playRef.current = play;
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const dismiss = useCallback(
    (id: number) => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => remove(id), 200);
    },
    [remove]
  );
  const push = useCallback<ToastFn>((message, tone = 'success', opts = {}) => {
    const id = ++toastSeq;
    const duration = opts.duration ?? (tone === 'error' ? 6000 : 4000);
    // Max 3 visible: the oldest goes first.
    setToasts((t) => [...t.filter((x) => !x.leaving).slice(-2), { id, message, tone, body: opts.body, action: opts.action, duration }]);
    const sound = opts.sound === undefined ? true : opts.sound;
    if (sound) {
      const name: BrainboxSound | null = typeof sound === 'string' ? sound : tone === 'success' ? 'success' : tone === 'error' ? 'error' : null;
      if (name) playRef.current?.(name);
    }
  }, []);
  return { toasts, push, dismiss };
}

const TOAST_ICON: Record<ToastTone, StaffIconName> = { success: 'check', error: 'x', info: 'info', warning: 'alert' };

function ToastView({ t, dismiss }: { t: ToastItem; dismiss: (id: number) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = useRef(t.duration);
  const started = useRef(0);
  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    started.current = Date.now();
    timer.current = setTimeout(() => dismiss(t.id), left.current);
  }, [dismiss, t.id]);
  const pause = () => {
    if (timer.current) clearTimeout(timer.current);
    left.current = Math.max(1200, left.current - (Date.now() - started.current));
  };
  useEffect(() => {
    start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [start]);
  return (
    <div
      className={`bb-staff-toast is-${t.tone}${t.leaving ? ' is-leaving' : ''}`}
      role={t.tone === 'error' ? 'alert' : 'status'}
      aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={pause}
      onMouseLeave={start}
    >
      <span className="bb-staff-toast-icon" aria-hidden="true">
        <Icon name={TOAST_ICON[t.tone]} size={12} strokeWidth={2.75} />
      </span>
      <div className="bb-staff-toast-body">
        <div className="bb-staff-toast-title">{t.message}</div>
        {t.body ? <div className="bb-staff-toast-text">{t.body}</div> : null}
      </div>
      {t.action ? (
        <button
          type="button"
          className="bb-staff-toast-action"
          onClick={() => {
            t.action!.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      ) : null}
      <button type="button" className="bb-staff-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

export function ToastViewport({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="bb-staff-toasts" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastView key={t.id} t={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error boundary                                                      */
/* ------------------------------------------------------------------ */

export class StaffErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; onHome?: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[brainbox] dashboard page crashed', error);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bb-staff-card bb-staff-crash" role="alert">
        <div className="bb-staff-empty-icon is-danger">
          <Icon name="alert" size={30} />
        </div>
        <h4>Something went wrong on this page</h4>
        <p>The rest of the dashboard still works. Try again, or head back to the overview.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <Button variant="primary" icon="refresh" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          {this.props.onHome ? (
            <Button
              variant="secondary"
              icon="overview"
              onClick={() => {
                this.setState({ error: null });
                this.props.onHome!();
              }}
            >
              Go to overview
            </Button>
          ) : null}
        </div>
        <details className="bb-staff-crash-details">
          <summary>Technical details</summary>
          <code>{String(this.state.error?.message || this.state.error)}</code>
        </details>
      </div>
    );
  }
}

/* ------------------------------------------------------------------ */
/* Segmented control (sliding thumb)                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size
}: {
  options: { value: T; label: ReactNode; count?: number | null; icon?: StaffIconName; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const idx = options.findIndex((o) => o.value === value);
  const sig = options.map((o) => `${o.value}:${o.count ?? ''}`).join('|');
  const measure = useCallback(() => {
    const el = ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button')[idx];
    setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [idx]);
  useLayoutEffect(measure, [measure, sig]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !ref.current) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);
  return (
    <div ref={ref} className={`bb-staff-seg${size === 'sm' ? ' is-sm' : ''}${thumb ? ' has-thumb' : ''}`} role="group" aria-label={label}>
      {thumb ? <span className="bb-staff-seg-thumb" style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }} aria-hidden="true" /> : null}
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} title={o.title} aria-label={o.label === '' ? o.title : undefined}>
          {o.icon ? <Icon name={o.icon} size={14} /> : null}
          {o.label}
          {o.count != null ? <span className="bb-staff-seg-count">{o.count > 999 ? '999+' : o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export type TileTone = 'accent' | 'indigo' | 'teal' | 'success' | 'warning' | 'danger' | 'gray';

/** Tinted rounded square holding an icon (KPI cards, list rows). */
export function IconTile({ icon, tone = 'accent', size = 28 }: { icon: StaffIconName; tone?: TileTone; size?: number }) {
  return (
    <span className={`bb-staff-tile is-${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.57)} />
    </span>
  );
}

/** Small "Live" chip shown next to section titles that update in real time. */
export function LiveDot() {
  const ctx = useContext(StaffContext);
  const on = ctx?.liveStatus === 'live';
  return (
    <span className={`bb-staff-livedot${on ? ' is-on' : ''}`} title={on ? 'Updates in real time' : 'Refreshes automatically'}>
      <i aria-hidden="true" />
      {on ? 'Live' : 'Auto'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-ghost';

export function Button({
  variant = 'secondary',
  size,
  icon,
  iconRight,
  loading,
  block,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: 'sm' | 'lg';
  icon?: StaffIconName;
  iconRight?: StaffIconName;
  loading?: boolean;
  block?: boolean;
}) {
  const cls = [
    'bb-staff-btn',
    `bb-staff-btn-${variant}`,
    size ? `bb-staff-btn-${size}` : '',
    block ? 'bb-staff-btn-block' : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Icon name="loader" size={iconSize} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  size,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: StaffIconName; label: string; size?: 'sm' }) {
  return (
    <button
      type="button"
      className={`bb-staff-icon-btn${size === 'sm' ? ' bb-staff-icon-btn-sm' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 18} />
    </button>
  );
}

export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'secondary' }: { text: string; label?: string; size?: 'sm'; variant?: BtnVariant }) {
  const [copied, setCopied] = useState(false);
  const ctx = useContext(StaffContext);
  return (
    <Button
      size={size}
      variant={variant}
      icon={copied ? 'check' : 'copy'}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } else ctx?.toast('Couldn’t copy — select the text and copy it manually.', 'error');
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Small display pieces                                                */
/* ------------------------------------------------------------------ */

export function Avatar({ name, email, size }: { name?: string | null; email?: string | null; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`bb-staff-avatar${size ? ` bb-staff-avatar-${size}` : ''}`}
      style={{ background: avatarBg(email || name || '?') }}
      aria-hidden="true"
    >
      {initials(name, email)}
    </span>
  );
}

export function RolePill({ role }: { role?: string | null }) {
  const r = (role || 'user').toLowerCase();
  return <span className={`bb-staff-pill bb-staff-role-${r.replace(/[^a-z_]/g, '')}`}>{r}</span>;
}

export function StatusPill({ status, label, dot = true }: { status: string; label?: string; dot?: boolean }) {
  return <span className={`bb-staff-pill bb-staff-status-${status}${dot ? ' bb-staff-pill-dot' : ''}`}>{label || status}</span>;
}

export function ReasonChip({ reason }: { reason: GapReason }) {
  const icon: StaffIconName =
    reason === 'negative_feedback' ? 'thumbsDown' : reason === 'llm_unavailable' ? 'cpu' : reason === 'low_confidence' ? 'trendUp' : reason === 'llm_unknown' ? 'help' : 'search';
  return (
    <span className={`bb-staff-reason bb-staff-reason-${reason}`} title={REASON_HELP[reason]}>
      <Icon name={icon} size={13} />
      {REASON_LABELS[reason] || reason}
    </span>
  );
}

export function Skeleton({ w = '100%', h = 14, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="bb-staff-skel" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: '6px 20px 14px' }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--bbs-separator)' : 0 }}>
          <Skeleton w={34} h={34} r={17} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton w={`${55 + ((i * 17) % 35)}%`} h={13} />
            <Skeleton w={`${25 + ((i * 11) % 20)}%`} h={10} />
          </div>
          <Skeleton w={70} h={22} r={99} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'sparkles', title, children, action }: { icon?: StaffIconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="bb-staff-empty">
      <div className="bb-staff-empty-icon">
        <Icon name={icon} size={34} strokeWidth={1.5} />
      </div>
      <h4>{title}</h4>
      {children ? <p>{children}</p> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode; action?: ReactNode }) {
  const icon: StaffIconName = tone === 'error' ? 'alert' : tone === 'warn' ? 'alert' : tone === 'success' ? 'checkCircle' : 'info';
  return (
    <div className={`bb-staff-alert bb-staff-alert-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={17} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ padding: 20 }}>
      <Alert tone="error" action={onRetry ? <Button size="sm" onClick={onRetry} icon="refresh">Retry</Button> : undefined}>
        {message}
      </Alert>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm';
}) {
  return (
    <span className={`bb-staff-switch${size === 'sm' ? ' bb-staff-switch-sm' : ''}`} title={label}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="bb-staff-switch-track" />
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  aside,
  className
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bb-staff-field${className ? ` ${className}` : ''}`}>
      <label className="bb-staff-label" htmlFor={htmlFor}>
        <span>{label}</span>
        {aside}
      </label>
      {children}
      {error ? <span className="bb-staff-error-text">{error}</span> : hint ? <span className="bb-staff-hint">{hint}</span> : null}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  invalid,
  autoFocus
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="bb-staff-input-group">
      <input
        id={id}
        className="bb-staff-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        required
      />
      <IconButton icon={show ? 'eyeOff' : 'eye'} label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} size="sm" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus the dialog on open, trap Tab inside it, close on Escape, restore focus on close. */
export function useDialogFocus(ref: RefObject<HTMLElement>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (el) {
      const first = el.querySelector<HTMLElement>('[data-autofocus]') || el.querySelector<HTMLElement>(FOCUSABLE);
      (first || el).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [ref]);
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  width
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useDialogFocus(ref, onClose);
  return (
    <>
      <div className="bb-staff-overlay" onClick={onClose} />
      <div className="bb-staff-modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div
          ref={ref}
          className="bb-staff-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-t`}
          tabIndex={-1}
          style={width ? { width: `min(${width}px, 100%)` } : undefined}
        >
          <div className="bb-staff-modal-head">
            <div>
              <h3 id={`${id}-t`}>{title}</h3>
              {description ? <p>{description}</p> : null}
            </div>
            <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
          </div>
          <div className="bb-staff-modal-body">{children}</div>
          {footer ? <div className="bb-staff-modal-foot">{footer}</div> : null}
        </div>
      </div>
    </>
  );
}

export function Drawer({
  title,
  header,
  onClose,
  children,
  footer,
  label
}: {
  title?: ReactNode;
  header?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose);
  return (
    <>
      <div className="bb-staff-overlay" onClick={onClose} />
      <aside ref={ref} className="bb-staff-drawer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="bb-staff-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>{header || <h3 className="bb-staff-drawer-title">{title}</h3>}</div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="bb-staff-drawer-body">{children}</div>
        {footer ? <div className="bb-staff-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
}

/** Close a popover on outside click / Escape. */
export function useDismiss(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref]);
}

/** Arrow-key navigation for role="menu" containers. */
export function menuKeyNav(e: ReactKeyboardEvent<HTMLElement>) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  if (!items.length) return;
  const idx = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (e.key === 'ArrowDown') next = (idx + 1) % items.length;
  else if (e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  if (next >= 0) {
    e.preventDefault();
    items[next].focus();
  }
}

/** Kebab / dropdown menu. Items: {label, icon, onSelect, danger, href}. */
export function Menu({
  label,
  items,
  icon = 'more',
  align = 'right'
}: {
  label: string;
  icon?: StaffIconName;
  align?: 'left' | 'right';
  items: ({ label: string; icon?: StaffIconName; onSelect: () => void; danger?: boolean } | 'sep')[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  return (
    <div className="bb-staff-pop-anchor" ref={ref} style={{ display: 'inline-block' }}>
      <button
        ref={btn}
        type="button"
        className="bb-staff-icon-btn bb-staff-icon-btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={icon} size={16} />
      </button>
      {open ? (
        <div className="bb-staff-popover" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}>
          <div
            className="bb-staff-menu"
            role="menu"
            aria-label={label}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                btn.current?.focus();
                return;
              }
              menuKeyNav(e);
            }}
          >
            {items.map((it, i) =>
              it === 'sep' ? (
                <div key={`s${i}`} className="bb-staff-menu-sep" role="separator" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={`bb-staff-menu-item${it.danger ? ' is-danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                >
                  {it.icon ? <Icon name={it.icon} size={16} /> : null}
                  {it.label}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="bb-staff-pager">
      <span className="bb-staff-num">
        {from}–{to} of {total}
      </span>
      <div>
        <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" iconRight="chevronRight" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
