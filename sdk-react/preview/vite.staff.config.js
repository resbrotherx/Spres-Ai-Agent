// Builds the hosted staff dashboard into sdk-web/staff/ (served by nginx at /sdk/staff/).
//   npx vite build --config vite.staff.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./staff-app', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      'spres-react': fileURLToPath(new URL('../src/index.ts', import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL('../../sdk-web/staff', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false
  }
});
