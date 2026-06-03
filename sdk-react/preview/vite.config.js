import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'spres-react': fileURLToPath(new URL('../src/index.ts', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 4173
  },
  optimizeDeps: {
    include: ['axios']
  }
});