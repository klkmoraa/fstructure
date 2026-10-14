import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Entrada independiente: no incluye App, workers, datos personales ni service worker.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
  build: {
    outDir: 'dist-proposals',
    rollupOptions: { input: fileURLToPath(new URL('./proposals.html', import.meta.url)) },
  },
});
