/**
 * Reglas de estilo como aviso. Ejecuta las pruebas del sistema de diseño y
 * resume lo que no sigue la guía sin bloquear por diferencias de estilo.
 * Un error al ejecutar la auditoría sí falla: no equivale a estar en línea.
 *
 *   npm run lint:design
 */
import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const files = ['src/design-system/designSystem.test.ts', 'src/design-system/fstructureVisual.test.ts'];
const run = spawnSync('npx', ['vitest', 'run', ...files], {
  env: { ...process.env, FS_DESIGN_RULES: '1' },
  encoding: 'utf8',
});
const output = stripVTControlCharacters(`${run.stdout ?? ''}${run.stderr ?? ''}`);
const failed = [...output.matchAll(/^\s*(?:×|FAIL)\s+(.+)$/gm)].map((match) => match[1].trim());
const unique = [...new Set(failed)];
if (run.error || run.status === null || (run.status !== 0 && unique.length === 0)) {
  process.stderr.write('Guía de diseño: no se pudo completar la auditoría.\n');
  process.stderr.write(run.error ? `${run.error.message}\n` : output);
  process.exit(1);
} else if (run.status === 0) {
  process.stdout.write('Guía de diseño: todo en línea.\n');
} else {
  process.stdout.write(`Guía de diseño: ${unique.length} aviso(s). No bloquean.\n`);
  for (const line of unique) process.stdout.write(`  · ${line}\n`);
  process.stdout.write('Detalle: FS_DESIGN_RULES=1 npx vitest run src/design-system\n');
}
process.exit(0);
