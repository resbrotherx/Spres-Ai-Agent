import { Icon } from './icons';
import type { WidgetSettings } from './types';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a hex color with white (amt > 0) or black (amt < 0). */
export function shade(hex: string, amt: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const out = rgb.map((c) => Math.round(c + (t - c) * p));
  return `rgb(${out[0]}, ${out[1]}, ${out[2]})`;
}

export function alpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : hex;
}

function fill(text: string, botName: string) {
  return text.replace(/\{\{\s*botName\s*\}\}/g, botName || 'Assistant').replace(/\{\{\s*name\s*\}\}/g, 'Alex');
}

/**
 * Static, faithful mock of the spres-web / spres-react chat widget ("omago" design) driven by the
 * widget settings — used for the live preview in Settings → Chat widget.
 */
export function WidgetPreview({ widget }: { widget: WidgetSettings }) {
  // Defaults match the backend / spres-web widget defaults.
  const primary = widget.theme?.primary || '#b93fff';
  const panel = widget.theme?.panel || '#fff8ff';
  const ink = widget.theme?.ink || '#08080a';
  const b = widget.branding || ({} as WidgetSettings['branding']);
  const botName = b.botName || 'Brainbox AI';
  const title = b.title || botName;
  const light = shade(primary, 0.55);
  const dark = shade(primary, -0.3);
  const welcome = (widget.welcomeMessages || []).filter(Boolean);
  const actions = (widget.quickActions || []).filter(Boolean);
  const launcherType = widget.launcher?.type || 'button';

  return (
    <div className="bb-staff-wp-stage" aria-label="Chat widget preview" role="img">
      <div className="bb-staff-wp" style={{ background: panel, color: ink }}>
        <div className="bb-staff-wp-head" style={{ background: `linear-gradient(180deg, ${alpha(primary, 0.1)}, transparent)` }}>
          <span
            className="bb-staff-wp-orb"
            style={{
              background: b.logoUrl
                ? '#fff'
                : `radial-gradient(circle at 36% 28%, rgba(255,255,255,.95) 0 12%, transparent 13%), radial-gradient(circle at 50% 50%, ${light} 0 14%, ${primary} 42%, ${dark} 66%, ${alpha(primary, 0.06)} 71%)`
            }}
          >
            {b.logoUrl ? <img src={b.logoUrl} alt="" /> : null}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="bb-staff-wp-title bb-staff-truncate">{title}</div>
            <div className="bb-staff-wp-sub bb-staff-truncate">{b.subtitle || 'Your AI assistant'}</div>
          </div>
          <span style={{ opacity: 0.5, display: 'inline-flex', gap: 6 }}>
            <Icon name="more" size={16} />
            <Icon name="x" size={16} />
          </span>
        </div>
        <div className="bb-staff-wp-body" style={{ background: `linear-gradient(180deg, rgba(255,255,255,.55), ${alpha(primary, 0.05)})` }}>
          {(welcome.length ? welcome : [`Hi! I'm ${botName}. How can I help you today?`]).slice(0, 3).map((m, i) => (
            <div key={i} className="bb-staff-wp-bubble">
              {fill(m, botName)}
            </div>
          ))}
          {actions.length ? (
            <div className="bb-staff-wp-pills">
              {actions.slice(0, 4).map((a) => (
                <span key={a} className="bb-staff-wp-pill" style={{ color: primary, borderColor: alpha(primary, 0.22) }}>
                  {a}
                </span>
              ))}
            </div>
          ) : null}
          <div className="bb-staff-wp-user" style={{ background: primary, marginTop: 'auto' }}>
            How do I reset my password?
          </div>
        </div>
        <div className="bb-staff-wp-composer">
          <span>{widget.placeholder || 'Type message...'}</span>
          <span className="bb-staff-wp-send" style={{ background: `radial-gradient(circle at 36% 28%, ${light}, ${primary} 53%, ${dark} 100%)` }}>
            <Icon name="send" size={15} />
          </span>
        </div>
      </div>
      <span
        className={`bb-staff-wp-launcher${launcherType === 'icon' || launcherType === 'gif' ? ' is-icon' : ''}`}
        style={{ background: `radial-gradient(circle at 20% 20%, ${light}, ${primary} 50%, ${dark} 100%)` }}
      >
        <Icon name="chat" size={18} />
        {launcherType === 'icon' || launcherType === 'gif' ? null : widget.launcher?.text || 'Chat'}
      </span>
    </div>
  );
}
