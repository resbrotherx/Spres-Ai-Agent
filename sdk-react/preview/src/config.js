// Shared preview connection settings (used by the chat/training demos and the staff dashboard).
// Values come from preview/.env.local (git-ignored) — see preview/.env.example.
const env = import.meta.env;
// ?api=http://localhost:8787 points the demos at a local mock server (development only).
const qsApi = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('api') : null;
export const API_URL = qsApi || env.VITE_BRAINBOX_API_URL || 'https://port.smartpowerbilling.com';
export const API_KEY = env.VITE_BRAINBOX_API_KEY || '';
export const TENANT_ID = env.VITE_BRAINBOX_TENANT_ID || '';
