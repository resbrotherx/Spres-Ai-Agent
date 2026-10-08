import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { API_URL } from './config';

async function start() {
  // ?mock=1 → serve the staff-dashboard API from an in-memory mock (no backend needed).
  if (new URLSearchParams(window.location.search).get('mock') === '1') {
    const { installStaffMock } = await import('../mock/staff-mock.js');
    installStaffMock({ apiUrl: API_URL });
  }
  const root = createRoot(document.getElementById('root'));
  root.render(<App />);
}

start();
