/**
 * Verificación mínima: corre sólo lo que toca lo que cambió.
 *
 *   npm run verify            # cambios sin commit frente a HEAD
 *   npm run verify -- main    # cambios frente a otra referencia
 *   npm run verify -- --full  # el gate completo (lo mismo que CI)
 *
 * Qué decide:
 *   - siempre: typecheck;
 *   - .ts/.tsx de src: lint de esos archivos y `vitest related` (sus pruebas y las de quien los importa);
 *   - scripts/: sus pruebas node y el gate de arquitectura;
 *   - src/design o validation/: el oráculo Python de diseño;
 *   - package.json, lockfile, vite.config, index.html o public/: build.
 * CSS y copy no tienen prueba automática: se revisan a la vista.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.includes('--full')) process.exit(spawnSync('npm', ['run', 'check'], { stdio: 'inherit' }).status ?? 1);

const base = args.find((arg) => !arg.startsWith('-')) ?? 'HEAD';
const git = (...command) => execFileSync('git', command, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = [...new Set([...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')])]
  .filter((path) => existsSync(path));

if (changed.length === 0) {
  process.stdout.write(`Sin cambios frente a ${base}. Nada que verificar.\n`);
  process.exit(0);
}

const code = changed.filter((path) => /^src\/.*\.(ts|tsx)$/.test(path));
const scripts = changed.filter((path) => path.startsWith('scripts/'));
const steps = [];
const add = (label, command, commandArgs) => steps.push({ label, command, commandArgs });

add('typecheck', 'npx', ['tsc', '-b', '--noEmit']);
if (code.length) {
  add(`lint (${code.length} archivos)`, 'npx', ['oxlint', ...code]);
  add('pruebas relacionadas', 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...code]);
}
if (scripts.length) {
  add('arquitectura', 'npm', ['run', 'architecture:check']);
  const tests = [...new Set(scripts.map((path) => path.replace(/(\.test)?\.mjs$/, '.test.mjs')))].filter((path) => existsSync(path));
  if (tests.length) add('pruebas de scripts', 'node', ['--test', ...tests]);
}
if (changed.some((path) => path.startsWith('src/design/') || path.startsWith('validation/'))) {
  add('oráculo de diseño', 'npm', ['run', 'design:oracle']);
}
if (changed.some((path) => /^(package(-lock)?\.json|vite\.config\.ts|index\.html|public\/)/.test(path))) {
  add('build', 'npx', ['vite', 'build']);
}

process.stdout.write(`Cambios: ${changed.length} archivo(s) frente a ${base}.\n`);
const failed = [];
for (const step of steps) {
  process.stdout.write(`\n▸ ${step.label}\n`);
  const result = spawnSync(step.command, step.commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) failed.push(step.label);
}
const skipped = changed.filter((path) => /\.(css|md)$/.test(path));
process.stdout.write(`\n${failed.length ? `Falló: ${failed.join(', ')}` : 'Verificación mínima en verde'} (${steps.map((step) => step.label).join(' · ')}).\n`);
if (skipped.length) process.stdout.write(`Revisar a la vista (sin prueba automática): ${skipped.join(', ')}\n`);
process.exit(failed.length ? 1 : 0);
