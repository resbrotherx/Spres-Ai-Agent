import React, { useEffect, useState } from 'react';
// import { BrainboxReactSDK, ChatPanel, ChatWidget } from '../../dist';
import { BrainboxReactSDK, ChatPanel, ChatWidget, TrainingPanel, StaffDashboard } from 'spres-react';
import { API_URL, API_KEY, TENANT_ID } from './config';
const sdk = new BrainboxReactSDK(API_URL, API_KEY, TENANT_ID);

function ChatDemo() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6'}}>

   
        <ChatWidget
          sdk={sdk}
          position="bottom-right"
          primaryColor="#2563EB"
          //accentColor="#18d72e"
         // backgroundColor="#0c1217"
          buttonText="Ai"
          placeholder="Ask a question..."
          width="360px"
          height="520px"
          defaultOpen = {false}
          design = "Ai"
          logoUrl="https://i.pinimg.com/originals/eb/bd/f7/ebbdf7ce4f7f502d1f28b96b5cbd7a1f.gif"
          logoText = "Smart Power Billing"
          companyName = "Sterling Technologies"
          companyDescription="Ask us anything about your account."
          user={{ name: "Patrick Fra" }}
          launcherType="button"
          launcherGifUrl="https://miro.medium.com/v2/1*9I6EIL5NG20A8se5afVmOg.gif"
         // bot = "void 0,"
          //data = "oppp"
          // manualData = void 0
        />
        <ChatPanel
          sdk={sdk}
          position="bottom-right"
          primaryColor="#0e0e12"
          accentColor="#293756"
          backgroundColor="#f6f7f8"
          buttonText="Support"
          placeholder="Ask a question..."
          width="360px"
          logoUrl="https://i.pinimg.com/originals/eb/bd/f7/ebbdf7ce4f7f502d1f28b96b5cbd7a1f.gif"
          //height="520px"
          //design="support"
          user={{ name: "Sarah Connor", email: "sarah@acme.com" }}
          companyName = "Sterling"
          avatarGifUrl = "https://cdn.dribbble.com/userupload/23400373/file/original-aaa8682220d5fd60c715fce6b52f7f3e.gif"
          showExportButton = {true}
          showFileUpload = {true}
          showImageUpload = {true}
          showVoiceInput = {true}
        />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Simple hash routing: #/ = chat demo, #/train = training page      */
/* ---------------------------------------------------------------- */

const ROUTES = [
  { path: '/', label: 'Chat' },
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
    <div style={{ minHeight: 'calc(100vh - 53px)', background: '#f3f3f5' }}>
      <TrainingPanel
        sdk={sdk}
        companyName="Sterling Technologies"
        logoUrl="https://i.pinimg.com/originals/eb/bd/f7/ebbdf7ce4f7f502d1f28b96b5cbd7a1f.gif"
      />
    </div>
  );
}

function StaffPage() {
  return <StaffDashboard apiUrl={API_URL} routePrefix="/staff" offsetTop={NAV_HEIGHT} brandName="Brainbox" />;
}

export default function App() {
  const path = useHashRoute();
  return (
    <>
      <TopNav path={path} />
      {path === '/staff' ? <StaffPage /> : path === '/train' ? <TrainPage /> : <ChatDemo />}
    </>
  );
}
