import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Reglas de estilo del sistema de diseño (radios, color, movimiento, tokens).
 * Orientan, no bloquean: fuera de la suite normal y de CI; se consultan con
 * `npm run lint:design`.
 */
const DESIGN_RULES = ['src/design-system/designSystem.test.ts', 'src/design-system/fstructureVisual.test.ts'];

/**
 * Emite `sw.js` con la lista de lo que la app necesita para abrir sin conexión.
 *
 * Entra el código de la Home y de la mesa (2D, 3D, Diseño y sus workers); la
 * exportación a PDF, las imágenes y las fuentes se guardan la primera vez que
 * se usan, para no gastar datos en lo que quizá nunca se abra. El nombre de la
 * caché cambia con el contenido: cada versión publicada es una caché nueva.
 */
const ON_DEMAND = /pdf/i;

function serviceWorkerPlugin(): Plugin {
  const template = readFileSync(fileURLToPath(new URL('./scripts/sw.template.js', import.meta.url)), 'utf8');
  return {
    name: 'fstructure-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const core = Object.keys(bundle)
        .filter((file) => /\.(js|css)$/.test(file) && !ON_DEMAND.test(file.split('/').pop() ?? ''))
        .sort();
      const precache = ['./', ...core.map((file) => `./${file}`)];
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__FS_VERSION__', version).replace('__FS_PRECACHE__', JSON.stringify(precache)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  base: './',
  test: {
    // Evita saturar el equipo y agotar los tiempos de las pruebas de interfaz.
    maxWorkers: 1,
    testTimeout: 10_000,
    setupFiles: ['src/i18n/testCatalogSetup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', ...(process.env.FS_DESIGN_RULES ? [] : DESIGN_RULES)],
    environment: 'node',
  },
});
