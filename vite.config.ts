import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Reglas de estilo del sistema de diseño (radios, color, movimiento, tokens).
 * Orientan, no bloquean: fuera de la suite normal y de CI; se consultan con
 * `npm run lint:design`.
 */
const DESIGN_RULES = ['src/design-system/designSystem.test.ts', 'src/design-system/fstructureVisual.test.ts'];

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    setupFiles: ['src/i18n/testCatalogSetup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', ...(process.env.FS_DESIGN_RULES ? [] : DESIGN_RULES)],
    environment: 'node',
  },
});
