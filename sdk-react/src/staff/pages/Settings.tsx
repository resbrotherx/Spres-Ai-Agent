import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon } from '../icons';
import type { StaffIconName } from '../icons';
import type { ApiKeyInfo, ApiKeyType, TenantSettings, WidgetSettings } from '../types';
import { WidgetPreview } from '../WidgetPreview';
import {
  Alert,
  Button,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Modal,
  Skeleton,
  SkeletonRows,
  StatusPill,
  Switch,
  useStaff
} from '../ui';
import { errMsg, fmtDateTime, relTime, useAsync } from '../util';

type TabKey = 'general' | 'alerts' | 'widget' | 'keys' | 'install';

const TABS: { key: TabKey; label: string; icon: StaffIconName }[] = [
  { key: 'general', label: 'General', icon: 'building' },
  { key: 'alerts', label: 'Gaps & alerts', icon: 'bell' },
  { key: 'widget', label: 'Chat widget', icon: 'palette' },
  { key: 'keys', label: 'API keys', icon: 'key' },
  { key: 'install', label: 'Install & embed', icon: 'code' }
];

const DEFAULT_WIDGET: WidgetSettings = {
  theme: { primary: '#b93fff', panel: '#fff8ff', ink: '#08080a' },
  branding: { botName: 'Brainbox AI', title: null, subtitle: 'Your AI assistant', logoUrl: null },
  launcher: { type: 'button', text: 'Chat' },
  welcomeMessages: ["Hi {{name}}! I'm {{botName}}. How can I help you today?"],
  quickActions: [],
  placeholder: 'Type message...'
};

function normalize(s: TenantSettings): TenantSettings {
  const w = s.widget || DEFAULT_WIDGET;
  return {
    ...s,
    widget: {
      theme: { ...DEFAULT_WIDGET.theme, ...(w.theme || {}) },
      branding: { ...DEFAULT_WIDGET.branding, ...(w.branding || {}) },
      launcher: { ...DEFAULT_WIDGET.launcher, ...(w.launcher || {}) },
      welcomeMessages: Array.isArray(w.welcomeMessages) ? w.welcomeMessages : [],
      quickActions: Array.isArray(w.quickActions) ? w.quickActions : [],
      placeholder: w.placeholder ?? DEFAULT_WIDGET.placeholder
    }
  };
}

function Card({ title, sub, children, aside }: { title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bb-staff-card">
      <div className="bb-staff-card-head">
        <div>
          <h3>{title}</h3>
          {sub ? <p>{sub}</p> : null}
        </div>
        {aside}
      </div>
      <div className="bb-staff-card-body">{children}</div>
    </section>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <Field label={label} htmlFor={id} error={value && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? 'Use a hex color like #1d4ed8' : null}>
      <div className="bb-staff-color">
        <input type="color" aria-label={`${label} picker`} value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        <input id={id} className="bb-staff-input bb-staff-mono" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={7} />
      </div>
    </Field>
  );
}

function ListEditor({ label, items, onChange, placeholder, disabled, hint, max = 6 }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean; hint?: string; max?: number }) {
  return (
    <div className="bb-staff-field">
      <span className="bb-staff-label">{label}</span>
      <div className="bb-staff-list-editor">
        {items.map((it, i) => (
          <div key={i} className="bb-staff-list-editor-row">
            <input
              className="bb-staff-input"
              value={it}
              aria-label={`${label} ${i + 1}`}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {!disabled ? <IconButton icon="trash" label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} /> : null}
          </div>
        ))}
        {!disabled && items.length < max ? (
          <div>
            <Button size="sm" variant="soft" icon="plus" onClick={() => onChange([...items, ''])}>
              Add
            </Button>
          </div>
        ) : null}
        {!items.length && disabled ? <span className="bb-staff-hint">None</span> : null}
      </div>
      {hint ? <span className="bb-staff-hint">{hint}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

function KeysTab() {
  const { client, toast, can } = useStaff();
  const { data, setData, error, loading, reload } = useAsync(() => (can('admin') ? client.listKeys() : Promise.resolve([] as ApiKeyInfo[])), [client]);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<string | number | null>(null);
  const [busy, setBusy] = useState<string | number | null>(null);

  if (!can('admin')) return <Alert tone="info">Only admins and owners can view and manage API keys.</Alert>;

  const revoke = async (k: ApiKeyInfo) => {
    setBusy(k.id);
    try {
      await client.revokeKey(k.id);
      setData((list) => (list ? list.map((x) => (x.id === k.id ? { ...x, is_active: false } : x)) : list));
      toast(`Key “${k.name}” revoked.`);
      setConfirm(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bb-staff-stack">
      <section className="bb-staff-card">
        <div className="bb-staff-card-head" style={{ paddingBottom: 14 }}>
          <div>
            <h3>API keys</h3>
            <p>Publishable keys are safe in browsers (chat only). Secret keys can train and must stay on servers.</p>
          </div>
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Create key
          </Button>
        </div>
        {error && !data ? <ErrorState message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? <SkeletonRows rows={3} /> : null}
        {data ? (
          data.length ? (
            <div className="bb-staff-table-wrap">
              <table className="bb-staff-table is-responsive">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Last used</th>
                    <th>Created</th>
                    <th className="is-actions">
                      <span className="bb-staff-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((k) => {
                    const expired = k.expired ?? (!!k.expires_at && new Date(k.expires_at).getTime() < Date.now());
                    return (
                      <tr key={k.id}>
                        <td className="is-primary" style={{ fontWeight: 600 }}>
                          {k.name}
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Type</span>
                          <span className={`bb-staff-key-type is-${k.key_type}`}>
                            <Icon name={k.key_type === 'secret' ? 'lock' : 'globe'} size={13} />
                            {k.key_type === 'secret' ? 'Secret' : 'Publishable'}
                          </span>
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Key</span>
                          <code className="bb-staff-mono">{k.key_prefix}…</code>
                        </td>
                        <td>
                          <span className="bb-staff-cell-label">Status</span>
                          {!k.is_active ? <StatusPill status="disabled" label="Revoked" /> : expired ? <StatusPill status="failed" label="Expired" /> : <StatusPill status="active" />}
                        </td>
                        <td className="bb-staff-muted">
                          <span className="bb-staff-cell-label">Last used</span>
                          {relTime(k.last_used)}
                        </td>
                        <td className="bb-staff-muted" title={fmtDateTime(k.created_at)}>
                          <span className="bb-staff-cell-label">Created</span>
                          {relTime(k.created_at)}
                          {k.expires_at ? <div style={{ fontSize: 11.5 }}>Expires {fmtDateTime(k.expires_at)}</div> : null}
                        </td>
                        <td className="is-actions">
                          {!k.is_active ? null : confirm === k.id ? (
                            <span className="bb-staff-confirm">
                              Revoke? Apps using it stop working.
                              <Button size="sm" variant="danger" loading={busy === k.id} onClick={() => void revoke(k)} autoFocus>
                                Revoke
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="danger-ghost" icon="ban" onClick={() => setConfirm(k.id)}>
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="key" title="No API keys yet" action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Create key</Button>}>
              Create a publishable key for your website chat, or a secret key for server integrations like Odoo.
            </EmptyState>
          )
        ) : null}
      </section>
      {creating ? <CreateKeyModal onClose={() => setCreating(false)} onCreated={(k) => setData((list) => [k, ...(list || [])])} /> : null}
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKeyInfo) => void }) {
  const { client } = useStaff();
  const id = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState<ApiKeyType>('publishable');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<{ key: ApiKeyInfo; raw: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await client.createKey({ name: name.trim(), key_type: type, ...(expires ? { expires_at: new Date(`${expires}T23:59:59`).toISOString() } : {}) });
      onCreated(res.key);
      setRaw({ key: res.key, raw: res.raw_key });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (raw) {
    return (
      <Modal title="Copy your new key" description="This is the only time the full key is shown." onClose={onClose} footer={<Button variant="primary" onClick={onClose}>I’ve saved it</Button>}>
        <Alert tone="warn">
          Store it somewhere safe now. {raw.key.key_type === 'secret' ? 'Never put a secret key in browser code or a public repository.' : 'Publishable keys can only chat — they’re safe to embed in your website.'}
        </Alert>
        <div className="bb-staff-copy-field">
          <code title={raw.raw}>{raw.raw}</code>
          <CopyButton text={raw.raw} variant="primary" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Create API key"
      onClose={onClose}
      width={540}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-f`} loading={busy} disabled={!name.trim()}>
            Create key
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Name" htmlFor={`${id}-n`} hint="So you can recognise it later, e.g. “Website chat” or “Odoo production”.">
          <input id={`${id}-n`} className="bb-staff-input" value={name} onChange={(e) => setName(e.target.value)} required data-autofocus />
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="bb-staff-label" style={{ marginBottom: 8 }}>
            Type
          </legend>
          <div className="bb-staff-radio-cards">
            {(
              [
                ['publishable', 'globe', 'Publishable', 'For browsers and the chat widget. Chat only, always public audience.'],
                ['secret', 'lock', 'Secret', 'For servers (Odoo, backends). Can train the AI and assert user roles.']
              ] as const
            ).map(([v, icon, label, desc]) => (
              <label key={v} className={`bb-staff-radio-card${type === v ? ' is-checked' : ''}`}>
                <input type="radio" name={`${id}-t`} checked={type === v} onChange={() => setType(v)} />
                <b>
                  <Icon name={icon} size={15} /> {label}
                </b>
                <span>{desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Expires (optional)" htmlFor={`${id}-e`} hint="Leave empty for a key that doesn’t expire.">
          <input id={`${id}-e`} type="date" className="bb-staff-input" value={expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Install / embed                                                     */
/* ------------------------------------------------------------------ */

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="bb-staff-code-wrap">
      <pre className="bb-staff-code" aria-label={label}>
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  );
}

function js(v: unknown): string {
  return JSON.stringify(v);
}

function InstallTab({ settings }: { settings: TenantSettings }) {
  const { client, user, can } = useStaff();
  const [tab, setTab] = useState<'html' | 'react' | 'odoo'>('html');
  const keys = useAsync(() => (can('admin') ? client.listKeys() : Promise.resolve([] as ApiKeyInfo[])), [client]);
  const pk = (keys.data || []).find((k) => k.key_type === 'publishable' && k.is_active);
  const apiUrl = client.apiUrl || 'https://your-brainbox-server';
  const w = settings.widget;
  const pkText = 'pk_live_YOUR_PUBLISHABLE_KEY';

  const list = (arr: string[]) => {
    const items = arr.filter(Boolean);
    return items.length ? `[\n${items.map((x) => `      ${js(x)}`).join(',\n')}\n    ]` : '[]';
  };
  const html = `<!-- Brainbox chat widget -->
<script src="${apiUrl}/sdk/brainbox-web-sdk.js"></script>
<script>
  Brainbox.init({
    apiUrl: ${js(apiUrl)},
    apiKey: ${js(pkText)},${pk ? ` // your key starts with ${pk.key_prefix}` : ''}
    theme: { primary: ${js(w.theme.primary)}, panel: ${js(w.theme.panel)}, ink: ${js(w.theme.ink)} },
    branding: {
      botName: ${js(w.branding.botName || 'Brainbox AI')},
      title: ${js(w.branding.title || null)},
      subtitle: ${js(w.branding.subtitle || null)},
      logoUrl: ${js(w.branding.logoUrl || null)}
    },
    launcher: { type: ${js(w.launcher.type)}, text: ${js(w.launcher.text || 'Chat')} },
    welcomeMessages: ${list(w.welcomeMessages)},
    quickActions: ${list(w.quickActions)},
    placeholder: ${js(w.placeholder || 'Type message...')}
  });
</script>`;

  const react = `// npm install spres-react
import { BrainboxReactSDK, ChatWidget } from 'spres-react';

const sdk = new BrainboxReactSDK('${apiUrl}', '${pkText}');

export function SupportChat() {
  return (
    <ChatWidget
      sdk={sdk}
      primaryColor="${w.theme.primary}"
      backgroundColor="${w.theme.panel}"
      companyName={${js(w.branding.title || w.branding.botName || 'Brainbox AI')}}
      companyDescription={${js(w.branding.subtitle || '')}}${w.branding.logoUrl ? `\n      logoUrl="${w.branding.logoUrl}"` : ''}
      bot={{ name: ${js(w.branding.botName || 'Brainbox AI')} }}
      launcherType="${w.launcher.type === 'icon' || w.launcher.type === 'gif' ? w.launcher.type : 'button'}"
      buttonText={${js(w.launcher.text || 'Chat')}}
      placeholder={${js(w.placeholder || 'Type message...')}}
    />
  );
}`;

  const odoo: [string, string, string?][] = [
    ['Backend URL', apiUrl],
    ['Secret API key (sk_...)', 'sk_live_… (create a secret key in API keys)', 'Stays on the Odoo server; never sent to browsers.'],
    ['Tenant ID', user.tenant_id],
    ['Primary color', w.theme.primary],
    ['Panel color', w.theme.panel],
    ['Bot name', w.branding.botName || ''],
    ['Header title', w.branding.title || ''],
    ['Header subtitle', w.branding.subtitle || ''],
    ['Launcher text', w.launcher.text || ''],
    ['Logo URL', w.branding.logoUrl || '']
  ];

  return (
    <div className="bb-staff-stack">
      {pk ? (
        <Alert tone="info">
          Use your publishable key <code className="bb-staff-mono">{pk.key_prefix}…</code> (“{pk.name}”). Full keys are only shown when created — create a new one in <b>API keys</b> if you lost it.
        </Alert>
      ) : (
        <Alert tone="warn">
          You’ll need a <b>publishable key</b> for website embeds{can('admin') ? ' — create one in the API keys tab.' : ' — ask an admin to create one.'}
        </Alert>
      )}
      <section className="bb-staff-card">
        <div className="bb-staff-tabs" role="tablist" aria-label="Platform" style={{ padding: '0 12px' }}>
          {(
            [
              ['html', 'HTML / any website', 'globe'],
              ['react', 'React', 'code'],
              ['odoo', 'Odoo add-on', 'building']
            ] as const
          ).map(([k, label, icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className="bb-staff-tab" onClick={() => setTab(k)}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="bb-staff-card-body" role="tabpanel">
          {tab === 'html' ? (
            <div className="bb-staff-stack" style={{ gap: 12 }}>
              <p className="bb-staff-hint">Paste before the closing &lt;/body&gt; tag. The settings below mirror your Chat widget tab.</p>
              <CodeBlock code={html} label="HTML snippet" />
            </div>
          ) : null}
          {tab === 'react' ? (
            <div className="bb-staff-stack" style={{ gap: 12 }}>
              <p className="bb-staff-hint">Render the widget anywhere in your React app.</p>
              <CodeBlock code={react} label="React snippet" />
            </div>
          ) : null}
          {tab === 'odoo' ? (
            <div className="bb-staff-stack" style={{ gap: 12 }}>
              <p className="bb-staff-hint">
                Install the <b>brainbox_ai</b> add-on, then open <b>Settings → Brainbox AI</b> and enter these values.
              </p>
              <div className="bb-staff-table-wrap">
                <table className="bb-staff-table">
                  <thead>
                    <tr>
                      <th>Odoo setting</th>
                      <th>Value</th>
                      <th className="is-actions">
                        <span className="bb-staff-sr">Copy</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {odoo.map(([k, v, note]) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</td>
                        <td style={{ minWidth: 0 }}>
                          <code className="bb-staff-mono" style={{ wordBreak: 'break-all' }}>
                            {v || '—'}
                          </code>
                          {note ? <div className="bb-staff-hint">{note}</div> : null}
                        </td>
                        <td className="is-actions">{v && !v.startsWith('sk_live_…') ? <CopyButton text={v} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings page                                                       */
/* ------------------------------------------------------------------ */

export function SettingsPage({ tab: tabParam }: { tab?: string }) {
  const { client, can, toast, href, user } = useStaff();
  const tab: TabKey = (TABS.find((t) => t.key === tabParam)?.key || 'general') as TabKey;
  const { data, setData, error, reload } = useAsync(() => client.getSettings().then(normalize), [client]);
  const [draft, setDraft] = useState<TenantSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const uid = useId();
  const canEdit = can('admin');

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = useMemo(() => !!data && !!draft && JSON.stringify(data) !== JSON.stringify(draft), [data, draft]);

  const set = (patch: Partial<TenantSettings>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setW = (patch: Partial<WidgetSettings>) => setDraft((d) => (d ? { ...d, widget: { ...d.widget, ...patch } } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { tenant_id: _t, smtp_configured: _s, ...rest } = draft;
      const widget = { ...rest.widget, welcomeMessages: rest.widget.welcomeMessages.filter((x) => x.trim()), quickActions: rest.widget.quickActions.filter((x) => x.trim()) };
      const res = normalize(await client.updateSettings({ ...rest, widget }));
      setData(res);
      setDraft(res);
      toast('Settings saved.');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const d = draft;
  const ro = !canEdit;

  let body: ReactNode = null;
  if (!d) {
    body = error ? (
      <ErrorState message={error} onRetry={() => void reload()} />
    ) : (
      <div className="bb-staff-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton w="30%" h={18} />
        <Skeleton h={40} />
        <Skeleton h={40} />
        <Skeleton w="60%" h={40} />
      </div>
    );
  } else if (tab === 'general') {
    body = (
      <Card title="Organisation" sub="How your workspace appears to staff and in notification emails.">
        <div className="bb-staff-form-grid">
          <Field label="Display name" htmlFor={`${uid}-dn`} hint="Shown in emails and the dashboard.">
            <input id={`${uid}-dn`} className="bb-staff-input" value={d.display_name || ''} onChange={(e) => set({ display_name: e.target.value })} disabled={ro} />
          </Field>
          <Field label="Support email" htmlFor={`${uid}-se`} hint="Where customers can reach a human.">
            <input id={`${uid}-se`} type="email" className="bb-staff-input" value={d.support_email || ''} onChange={(e) => set({ support_email: e.target.value })} disabled={ro} />
          </Field>
          <Field label="Tenant ID" htmlFor={`${uid}-tid`} hint="Used by integrations (e.g. the Odoo add-on)." className="bb-staff-span-2">
            <div className="bb-staff-copy-field">
              <code id={`${uid}-tid`}>{d.tenant_id || user.tenant_id}</code>
              <CopyButton text={d.tenant_id || user.tenant_id} />
            </div>
          </Field>
        </div>
      </Card>
    );
  } else if (tab === 'alerts') {
    const t = d.gap_distance_threshold;
    body = (
      <div className="bb-staff-stack">
        <Card title="Gap detection" sub="When should a question count as unanswered?">
          <div className="bb-staff-threshold">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <label htmlFor={`${uid}-th`} className="bb-staff-label">
                Confidence threshold (max. distance)
              </label>
              <span className="bb-staff-threshold-value">{t.toFixed(2)}</span>
            </div>
            <input id={`${uid}-th`} type="range" className="bb-staff-range" min={0.2} max={1} step={0.01} value={t} disabled={ro} onChange={(e) => set({ gap_distance_threshold: Number(e.target.value) })} aria-describedby={`${uid}-thd`} />
            <div className="bb-staff-threshold-scale" aria-hidden="true">
              <span>0.20 · strict (more gaps)</span>
              <span>default 0.55</span>
              <span>1.00 · lenient</span>
            </div>
            <p id={`${uid}-thd`} className="bb-staff-hint">
              Each answer is grounded on the closest matching chunks of your knowledge base. If even the best match is further away than this
              distance, the question is reported as a <b>low-confidence</b> gap. Lower it to catch more weak answers; raise it if you see too many
              false alarms.
            </p>
          </div>
        </Card>
        <Card title="Notifications" sub="Who hears about new gaps, and how.">
          <div className="bb-staff-setting-row">
            <div>
              <h4>Notify on new knowledge gaps</h4>
              <p>Email every staff member (with email alerts on) the first time a new unanswered question appears. In-app notifications are always created.</p>
            </div>
            <Switch checked={d.notify_on_gap} onChange={(v) => set({ notify_on_gap: v })} label="Notify on new knowledge gaps" disabled={ro} />
          </div>
          <div className="bb-staff-setting-row">
            <div>
              <h4>Notify on negative feedback</h4>
              <p>Alert the team when someone gives an answer a thumbs-down.</p>
            </div>
            <Switch checked={d.notify_on_feedback} onChange={(v) => set({ notify_on_feedback: v })} label="Notify on negative feedback" disabled={ro} />
          </div>
          <div className="bb-staff-setting-row">
            <div>
              <h4>Email limit</h4>
              <p>Maximum alert emails per hour for your workspace. Beyond this, only in-app notifications are created.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="bb-staff-input"
                style={{ width: 96 }}
                min={0}
                max={1000}
                aria-label="Maximum emails per hour"
                value={d.email_max_per_hour}
                disabled={ro}
                onChange={(e) => set({ email_max_per_hour: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span className="bb-staff-muted" style={{ fontSize: 13 }}>
                / hour
              </span>
            </div>
          </div>
          <div className="bb-staff-setting-row">
            <div>
              <h4>Email delivery (SMTP)</h4>
              <p>Configured by your server administrator through environment variables (SMTP_HOST, SMTP_FROM…).</p>
            </div>
            {d.smtp_configured ? <StatusPill status="active" label="Configured" /> : <StatusPill status="invited" label="Not configured" />}
          </div>
          {!d.smtp_configured ? (
            <Alert tone="warn">Email isn’t configured, so alerts and invites are in-app only. Invite links can still be copied and shared manually.</Alert>
          ) : null}
        </Card>
      </div>
    );
  } else if (tab === 'widget') {
    const w = d.widget;
    body = (
      <div className="bb-staff-widget-layout">
        <div className="bb-staff-stack">
          <Card title="Colors" sub="Match your brand.">
            <div className="bb-staff-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <ColorField label="Primary" value={w.theme.primary} onChange={(v) => setW({ theme: { ...w.theme, primary: v } })} disabled={ro} />
              <ColorField label="Panel" value={w.theme.panel} onChange={(v) => setW({ theme: { ...w.theme, panel: v } })} disabled={ro} />
              <ColorField label="Text (ink)" value={w.theme.ink} onChange={(v) => setW({ theme: { ...w.theme, ink: v } })} disabled={ro} />
            </div>
          </Card>
          <Card title="Branding">
            <div className="bb-staff-form-grid">
              <Field label="Bot name" htmlFor={`${uid}-bn`}>
                <input id={`${uid}-bn`} className="bb-staff-input" value={w.branding.botName} onChange={(e) => setW({ branding: { ...w.branding, botName: e.target.value } })} disabled={ro} />
              </Field>
              <Field label="Header title" htmlFor={`${uid}-ht`} hint="Defaults to the bot name.">
                <input id={`${uid}-ht`} className="bb-staff-input" value={w.branding.title || ''} onChange={(e) => setW({ branding: { ...w.branding, title: e.target.value || null } })} disabled={ro} />
              </Field>
              <Field label="Subtitle" htmlFor={`${uid}-st`}>
                <input id={`${uid}-st`} className="bb-staff-input" value={w.branding.subtitle || ''} onChange={(e) => setW({ branding: { ...w.branding, subtitle: e.target.value || null } })} disabled={ro} />
              </Field>
              <Field label="Logo URL" htmlFor={`${uid}-lu`}>
                <input id={`${uid}-lu`} type="url" className="bb-staff-input" placeholder="https://…" value={w.branding.logoUrl || ''} onChange={(e) => setW({ branding: { ...w.branding, logoUrl: e.target.value || null } })} disabled={ro} />
              </Field>
            </div>
          </Card>
          <Card title="Launcher & composer">
            <div className="bb-staff-form-grid">
              <Field label="Launcher type" htmlFor={`${uid}-lt`}>
                <select id={`${uid}-lt`} className="bb-staff-input" value={w.launcher.type} onChange={(e) => setW({ launcher: { ...w.launcher, type: e.target.value } })} disabled={ro}>
                  <option value="button">Button with text</option>
                  <option value="icon">Round icon</option>
                  <option value="gif">Animated image</option>
                </select>
              </Field>
              <Field label="Launcher text" htmlFor={`${uid}-ltx`}>
                <input id={`${uid}-ltx`} className="bb-staff-input" value={w.launcher.text} onChange={(e) => setW({ launcher: { ...w.launcher, text: e.target.value } })} disabled={ro || w.launcher.type !== 'button'} />
              </Field>
              <Field label="Input placeholder" htmlFor={`${uid}-ph`} className="bb-staff-span-2">
                <input id={`${uid}-ph`} className="bb-staff-input" value={w.placeholder} onChange={(e) => setW({ placeholder: e.target.value })} disabled={ro} />
              </Field>
            </div>
          </Card>
          <Card title="Conversation starters">
            <div className="bb-staff-stack" style={{ gap: 18 }}>
              <ListEditor label="Welcome messages" items={w.welcomeMessages} onChange={(v) => setW({ welcomeMessages: v })} placeholder="Hi {{name}}! How can I help?" disabled={ro} hint="Use {{name}} for the user’s name and {{botName}} for the bot name." max={3} />
              <ListEditor label="Quick actions" items={w.quickActions} onChange={(v) => setW({ quickActions: v })} placeholder="Track my order" disabled={ro} hint="Suggested questions shown as buttons." />
            </div>
          </Card>
        </div>
        <div className="bb-staff-preview-sticky">
          <div className="bb-staff-section-label">
            <Icon name="eye" size={14} /> Live preview
          </div>
          <WidgetPreview widget={w} />
        </div>
      </div>
    );
  } else if (tab === 'keys') {
    body = <KeysTab />;
  } else if (tab === 'install') {
    body = <InstallTab settings={dirty && data ? data : d} />;
  }

  const formTab = tab === 'general' || tab === 'alerts' || tab === 'widget';

  return (
    <div>
      <div className="bb-staff-page-head">
        <div>
          <h2>Settings</h2>
          <p>Configure your workspace, alerts, chat widget and integrations.</p>
        </div>
      </div>
      <div className="bb-staff-settings">
        <nav className="bb-staff-settings-nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <a key={t.key} href={href(`/settings/${t.key}`)} aria-current={tab === t.key ? 'page' : undefined}>
              <Icon name={t.icon} size={17} />
              {t.label}
            </a>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {ro && formTab && d ? (
            <div style={{ marginBottom: 16 }}>
              <Alert tone="info">You have read-only access. Only admins and owners can change settings.</Alert>
            </div>
          ) : null}
          {body}
          {formTab && dirty && canEdit ? (
            <div className="bb-staff-savebar" role="region" aria-label="Unsaved changes">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 550 }}>
                <Icon name="info" size={16} /> You have unsaved changes
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setDraft(data)} disabled={saving}>
                  Discard
                </Button>
                <Button variant="primary" icon="check" onClick={() => void save()} loading={saving}>
                  Save changes
                </Button>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
