import React, { useEffect, useState } from 'react';
// import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';
import { BrainboxReactSDK, ChatPanel, ChatWidget, TrainingPanel, StaffDashboard } from 'spres-react';
import { API_URL, API_KEY, TENANT_ID } from './config';
const sdk = new BrainboxReactSDK(API_URL, API_KEY, TENANT_ID);

const PARAMS = new URLSearchParams(window.location.search);
// ?theme=dark|auto|light to preview the color modes; ?launcher=icon|gif to change the widget launcher (default: button pill).
const THEME = PARAMS.get('theme') || 'light';
const LAUNCHER = PARAMS.get('launcher') || undefined;

const demoPageStyles = `
.preview-demo { min-height: calc(100vh - 53px); box-sizing: border-box; padding: 64px 24px; background: #F5F5F7; color: #1D1D1F;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
.preview-demo.is-dark { background: #000; color: #F5F5F7; }
.preview-demo-inner { max-width: 720px; margin: 0 auto; }
.preview-demo h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; }
.preview-demo p { font-size: 17px; color: #6E6E73; margin: 0 0 6px; line-height: 1.45; }
.preview-demo.is-dark p { color: #A1A1A6; }
.preview-demo code { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 13px; background: rgba(120,120,128,.12); padding: 1px 5px; border-radius: 5px; }
`;

function ChatDemo() {
  const dark = THEME === 'dark' || (THEME === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return (
    <div className={`preview-demo${dark ? ' is-dark' : ''}`}>
      <style>{demoPageStyles}</style>
      <div className="preview-demo-inner">
        <h1>ChatWidget</h1>
        <p>The floating assistant lives in the bottom-right corner. Answers stream in token by token.</p>
        <p>
          Try <code>?theme=dark</code>, <code>?theme=auto</code> or <code>?launcher=icon</code>.
        </p>
      </div>
      <ChatWidget
        sdk={sdk}
        position="bottom-right"
        mode={THEME}
        launcherType={LAUNCHER}
        buttonText="Ask us"
        launcherGifUrl="https://miro.medium.com/v2/1*9I6EIL5NG20A8se5afVmOg.gif"
        companyName="Sterling Technologies"
        companyDescription="Typically replies in seconds"
        placeholder="Ask a question…"
        showExportButton
      />
    </div>
  );
}

function PanelDemo() {
  return (
    <div style={{ height: 'calc(100vh - 53px)' }}>
      <ChatPanel sdk={sdk} mode={THEME} companyName="Sterling Technologies" showExportButton showFileUpload={false} showImageUpload={false} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Simple hash routing: #/ = chat demo, #/train = training page      */
/* ---------------------------------------------------------------- */

const ROUTES = [
  { path: '/', label: 'Chat widget' },
  { path: '/panel', label: 'Chat page' },
  { path: '/train', label: 'Train AI' },
  { path: '/staff', label: 'Staff dashboard' }
];

const NAV_HEIGHT = 52;
const IS_MOCK = new URLSearchParams(window.location.search).get('mock') === '1';

function currentPath() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  // The dashboard lives under #/staff/...; backend invite/reset links use #/accept-invite and #/reset-password.
  if (hash.startsWith('/accept-invite') || hash.startsWith('/reset-password')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/staff${hash}`);
    return '/staff';
  }
  if (hash === '/staff' || hash.startsWith('/staff/') || hash.startsWith('/staff?')) return '/staff';
  const path = hash.split('?')[0];
  return ROUTES.some((r) => r.path === path) ? path : '/';
}

function useHashRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

const navStyles = `
body { margin: 0; }
.preview-nav { position: sticky; top: 0; z-index: 900; display: flex; align-items: center; gap: 14px; padding: 0 18px; height: 52px; box-sizing: border-box;
  background: rgba(255,255,255,.86); backdrop-filter: blur(10px); border-bottom: 1px solid #ebe9ef;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.preview-nav-brand { font-weight: 650; font-size: 14px; color: #17161c; margin-right: auto; white-space: nowrap; }
.preview-nav-links { display: flex; gap: 4px; padding: 3px; background: #f3f3f5; border: 1px solid #ebe9ef; border-radius: 11px; }
.preview-nav a { font-size: 13px; font-weight: 600; color: #6f6c78; text-decoration: none; padding: 6px 12px; border-radius: 8px; }
.preview-nav a:hover { color: #17161c; }
.preview-nav a[aria-current="page"] { background: #fff; color: #17161c; box-shadow: 0 0 0 1px #ebe9ef; }
.preview-nav a:focus-visible { outline: 2px solid #a882f7; outline-offset: 2px; }
.preview-mock { font-size: 11.5px; font-weight: 650; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
.preview-nav-links { overflow-x: auto; scrollbar-width: none; max-width: 100%; }
@media (max-width: 640px) {
  .preview-nav { padding: 0 10px; gap: 8px; }
  .preview-nav-brand, .preview-mock-long { display: none; }
  .preview-nav-links { margin-left: auto; }
  .preview-nav a { padding: 6px 9px; white-space: nowrap; }
}
`;

function TopNav({ path }) {
  return (
    <nav className="preview-nav" aria-label="Preview pages">
      <style>{navStyles}</style>
      <span className="preview-nav-brand">spres-react preview</span>
      {IS_MOCK ? (
        <span className="preview-mock" title="In-memory mock API. Accounts: owner@ / admin@ / trainer@ / viewer@acme.test, password password123">
          Mock API<span className="preview-mock-long"> · owner@acme.test / password123</span>
        </span>
      ) : null}
      <div className="preview-nav-links">
        {ROUTES.map((r) => (
          <a key={r.path} href={r.path === '/staff' ? '#/staff/overview' : `#${r.path}`} aria-current={path === r.path ? 'page' : undefined}>
            {r.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function TrainPage() {
  return (
    <div style={{ minHeight: 'calc(100vh - 53px)' }}>
      <TrainingPanel sdk={sdk} companyName="Sterling Technologies" mode={THEME} />
    </div>
  );
}

function StaffPage() {
  // ?theme=dark|light|auto sets the dashboard's default appearance (users can still switch it in the account menu).
  const mode = new URLSearchParams(window.location.search).get('theme');
  const theme = mode === 'dark' || mode === 'light' || mode === 'auto' ? { mode } : undefined;
  return <StaffDashboard apiUrl={API_URL} routePrefix="/staff" offsetTop={NAV_HEIGHT} brandName="Brainbox" theme={theme} />;
}

export default function App() {
  const path = useHashRoute();
  return (
    <>
      <TopNav path={path} />
      {path === '/staff' ? <StaffPage /> : path === '/train' ? <TrainPage /> : path === '/panel' ? <PanelDemo /> : <ChatDemo />}
    </>
  );
}
