import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { Icon } from './icons';
import type { StaffIconName } from './icons';
import type { BrainboxStaffClient } from './staffClient';
import { hasRole } from './staffClient';
import type { GapReason, StaffRole, StaffUser } from './types';
import { avatarBg, copyText, initials, REASON_HELP, REASON_LABELS } from './util';

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export type ToastTone = 'success' | 'error' | 'info';

export interface StaffContextValue {
  client: BrainboxStaffClient;
  user: StaffUser;
  setUser: (u: StaffUser) => void;
  can: (min: StaffRole) => boolean;
  toast: (message: string, tone?: ToastTone) => void;
  href: (to: string, query?: Record<string, string | number | undefined | null>) => string;
  navigate: (to: string, query?: Record<string, string | number | undefined | null>, opts?: { replace?: boolean }) => void;
  query: Record<string, string>;
  brandName: string;
  routePrefix: string;
  openGaps: number | null;
  refreshCounts: () => void;
  signOut: () => void;
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
}

let toastSeq = 0;

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = ++toastSeq;
      setToasts((t) => [...t.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4200);
    },
    [dismiss]
  );
  return { toasts, push, dismiss };
}

export function ToastViewport({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="bb-staff-toasts" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={`bb-staff-toast is-${t.tone}`} role={t.tone === 'error' ? 'alert' : undefined}>
          <Icon name={t.tone === 'success' ? 'checkCircle' : t.tone === 'error' ? 'alert' : 'info'} size={18} />
          <div className="bb-staff-toast-body">{t.message}</div>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
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
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid #f1f5f9' : 0 }}>
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
        <Icon name={icon} size={24} />
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
          <div style={{ flex: 1, minWidth: 0 }}>{header || <h3 style={{ fontSize: 17, fontWeight: 650 }}>{title}</h3>}</div>
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
