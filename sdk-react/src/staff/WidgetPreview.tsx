import { BrainboxLogo } from '../design/Logo';
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
 * Static, faithful mock of the Brainbox chat widget (design v2) driven by the widget settings —
 * used for the live preview in Settings → Chat widget.
 */
export function WidgetPreview({ widget }: { widget: WidgetSettings }) {
  const primary = widget.theme?.primary || '#0071E3';
  const panel = widget.theme?.panel || '#FFFFFF';
  const ink = widget.theme?.ink || '#1D1D1F';
  const b = widget.branding || ({} as WidgetSettings['branding']);
  const botName = b.botName || 'Brainbox AI';
  const title = b.title || botName;
  const welcome = (widget.welcomeMessages || []).filter(Boolean);
  const actions = (widget.quickActions || []).filter(Boolean);
  const launcherType = widget.launcher?.type || 'icon';
  const avatar = b.logoUrl ? <img src={b.logoUrl} alt="" className="bb-staff-wp-logo" /> : <BrainboxLogo size={32} title="" style={{ borderRadius: 9 }} />;

  return (
    <div className="bb-staff-wp-stage" aria-label="Chat widget preview" role="img">
      <div className="bb-staff-wp" style={{ background: panel, color: ink }}>
        <div className="bb-staff-wp-head">
          {avatar}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="bb-staff-wp-title bb-staff-truncate">{title}</div>
            <div className="bb-staff-wp-sub bb-staff-truncate">
              <i aria-hidden="true" />
              {b.subtitle || 'Online · typically replies in seconds'}
            </div>
          </div>
          <span className="bb-staff-wp-actions">
            <Icon name="plus" size={15} />
            <Icon name="x" size={15} />
          </span>
        </div>
        <div className="bb-staff-wp-body">
          <div className="bb-staff-wp-day">Today</div>
          {(welcome.length ? welcome : [`Hi! I'm ${botName}. How can I help you today?`]).slice(0, 3).map((m, i, arr) => (
            <div key={i} className={`bb-staff-wp-row${i === arr.length - 1 ? ' is-end' : ''}`}>
              <span className="bb-staff-wp-av">{i === arr.length - 1 ? <BrainboxLogo size={22} title="" /> : null}</span>
              <div className="bb-staff-wp-bubble">{fill(m, botName)}</div>
            </div>
          ))}
          {actions.length ? (
            <div className="bb-staff-wp-pills">
              {actions.slice(0, 4).map((a) => (
                <span key={a} className="bb-staff-wp-pill">
                  <Icon name="sparkles" size={12} />
                  {a}
                </span>
              ))}
            </div>
          ) : null}
          <div className="bb-staff-wp-user" style={{ background: primary }}>
            How do I reset my password?
          </div>
        </div>
        <div className="bb-staff-wp-composer">
          <span>{widget.placeholder || 'Message…'}</span>
          <span className="bb-staff-wp-send" style={{ background: primary }}>
            <Icon name="arrowRight" size={15} strokeWidth={2.25} className="bb-staff-wp-send-icon" />
          </span>
        </div>
      </div>
      <span
        className={`bb-staff-wp-launcher${launcherType === 'button' ? '' : ' is-icon'}`}
        style={launcherType === 'button' ? { background: primary } : undefined}
      >
        <Icon name="chat" size={launcherType === 'button' ? 17 : 24} />
        {launcherType === 'button' ? widget.launcher?.text || 'Chat' : null}
      </span>
    </div>
  );
}
