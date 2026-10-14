// Hosted staff dashboard (no chat demos, no keys): staff sign in with their own email and password.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StaffDashboard } from 'spres-react';

// Same server that hosts this page, unless overridden with ?api=
const API_URL = new URLSearchParams(window.location.search).get('api') || window.location.origin;

// Invite and reset links arrive as #/accept-invite... and #/reset-password...; the dashboard lives under #/staff.
const hash = window.location.hash.replace(/^#/, '');
if (!hash || hash === '/') {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/staff/overview`);
} else if (hash.startsWith('/accept-invite') || hash.startsWith('/reset-password')) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/staff${hash}`);
}

const mode = new URLSearchParams(window.location.search).get('theme');
const theme = mode === 'dark' || mode === 'light' || mode === 'auto' ? { mode } : undefined;

createRoot(document.getElementById('root')).render(
  <StaffDashboard apiUrl={API_URL} routePrefix="/staff" brandName="Brainbox" theme={theme} />
);
