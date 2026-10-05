/**
 * Reglas de estilo como aviso. Ejecuta las pruebas del sistema de diseño y
 * resume lo que no sigue la guía, pero nunca falla: FStructure experimenta y
 * la guía se discute, no se impone.
 *
 *   npm run lint:design
 */
import { spawnSync } from 'node:child_process';

const files = ['src/design-system/designSystem.test.ts', 'src/design-system/fstructureVisual.test.ts'];
const run = spawnSync('npx', ['vitest', 'run', ...files], {
  env: { ...process.env, FS_DESIGN_RULES: '1' },
  encoding: 'utf8',
});
const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
const failed = [...output.matchAll(/^\s*(?:×|FAIL)\s+(.+)$/gm)].map((match) => match[1].trim());
const unique = [...new Set(failed)];
if (run.status === 0) {
  process.stdout.write('Guía de diseño: todo en línea.\n');
} else {
  process.stdout.write(`Guía de diseño: ${unique.length} aviso(s). No bloquean.\n`);
  for (const line of unique) process.stdout.write(`  · ${line}\n`);
  process.stdout.write('Detalle: FS_DESIGN_RULES=1 npx vitest run src/design-system\n');
}
process.exit(0);
