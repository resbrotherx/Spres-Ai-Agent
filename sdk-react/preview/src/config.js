// Shared preview connection settings (used by the chat/training demos and the staff dashboard).
// Values come from preview/.env.local (git-ignored) — see preview/.env.example.
const env = import.meta.env;
export const API_URL = env.VITE_BRAINBOX_API_URL || 'https://port.smartpowerbilling.com';
export const API_KEY = env.VITE_BRAINBOX_API_KEY || '';
export const TENANT_ID = env.VITE_BRAINBOX_TENANT_ID || '';
