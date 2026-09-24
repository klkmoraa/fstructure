import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dependencySpecifiersIn } from './check-local-foundation-dependencies.mjs';

const isProductionTypeScript = (name) => /(?<!\.(?:test|spec))\.(?:ts|tsx)$/.test(name);
const isStylesheet = (name) => /\.css$/.test(name);

const filesUnder = (directory, predicate, ignored = new Set(['node_modules', '.git', 'dist', 'docs'])) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignored.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, predicate, ignored);
    return predicate(entry.name) ? [path] : [];
  });
};

const isInside = (path, directory) => path === directory || path.startsWith(`${directory}/`);

/**
 * Copias byte a byte que sí pueden coexistir, con su razón.
 *
 * `catalogs.ts` y `catalogEn.ts` tienen texto idéntico pero importan catálogos
 * hermanos que difieren entre el árbol canónico y el del módulo, así que
 * resuelven a contenidos distintos: unificarlos cambiaría traducciones. Toda
 * entrada nueva aquí exige una razón equivalente y explícita.
 */
const ALLOWED_IDENTICAL_COPIES = new Map([
  ['src/i18n/catalogs.ts|src/modules/space3d/i18n/catalogs.ts', 'índice idéntico que resuelve a catálogos hermanos distintos'],
  ['src/i18n/catalogEn.ts|src/modules/space3d/i18n/catalogEn.ts', 'índice idéntico que resuelve a catálogos hermanos distintos'],
]);

/**
 * Reporta archivos de producción duplicados byte a byte.
 *
 * La duplicación de Foundation y de un segundo sistema de diseño pasó el gate
 * anterior porque sólo se prohibía importar el árbol anidado, no que existiera.
 * Dos fuentes idénticas divergen en silencio: la que se edita deja a la otra
 * atrás sin que nada falle.
 */
export const findDuplicateSourceViolations = (root) => {
  const resolvedRoot = resolve(root);
  const sourceRoot = join(resolvedRoot, 'src');
  const byDigest = new Map();
  for (const path of filesUnder(sourceRoot, (name) => isProductionTypeScript(name) || isStylesheet(name))) {
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    byDigest.set(digest, [...(byDigest.get(digest) ?? []), relative(resolvedRoot, path)]);
  }
  const violations = [];
  for (const paths of byDigest.values()) {
    if (paths.length < 2) continue;
    const sorted = [...paths].sort();
    if (ALLOWED_IDENTICAL_COPIES.has(sorted.join('|'))) continue;
    violations.push(`${sorted.join(' == ')} (duplicate source)`);
  }
  return violations.sort();
};

/**
 * Territorio de cada herramienta aislada. El Modelo 2D es el resto de `src`: la
 * app y sus piezas comunes (Foundation, sistema de diseño, almacenamiento).
 *
 * Una herramienta puede usar piezas comunes, pero nunca el código de otra
 * herramienta. Los adaptadores de `src/features/workspace` son la única
 * frontera que las conoce a todas, y los puentes de datos declarados viven en
 * `src/integrations`.
 */
const TOOL_TERRITORIES = new Map([
  ['design', ['src/design', 'src/features/design']],
  ['space3d', ['src/modules/space3d']],
  ['fem', ['src/modules/fem']],
]);

const territoryOf = (resolvedRoot, path) => {
  for (const [tool, directories] of TOOL_TERRITORIES) {
    if (directories.some((directory) => isInside(path, join(resolvedRoot, directory)))) return tool;
  }
  return null;
};

/** Reporta imports de producción que cruzan de una herramienta aislada a otra. */
export const findToolIsolationViolations = (root) => {
  const resolvedRoot = resolve(root);
  const violations = [];
  for (const path of filesUnder(join(resolvedRoot, 'src'), isProductionTypeScript)) {
    const territory = territoryOf(resolvedRoot, path);
    // La interfaz del Modelo 2D (`src/features`) tampoco puede cargar la
    // interfaz de otra herramienta. Sólo la frontera de `src/features/workspace`
    // (registro, adaptadores y shells) conoce a todas. El resto de `src` —
    // almacenamiento, workers, motores— es infraestructura común.
    const isModel2DInterface = !territory
      && isInside(path, join(resolvedRoot, 'src/features'))
      && !isInside(path, join(resolvedRoot, 'src/features/workspace'));
    if (!territory && !isModel2DInterface) continue;
    const owner = territory ?? 'model2d';
    for (const specifier of dependencySpecifiersIn(readFileSync(path, 'utf8'), path)) {
      if (!specifier.startsWith('.')) continue;
      const targetPath = resolve(dirname(path), specifier);
      const target = territoryOf(resolvedRoot, targetPath);
      // Desde el 2D sólo se vigila la interfaz ajena; `src/design` es biblioteca de cálculo.
      if (isModel2DInterface && target === 'design' && !isInside(targetPath, join(resolvedRoot, 'src/features/design'))) continue;
      if (target && target !== owner) violations.push(`${relative(resolvedRoot, path)} -> ${specifier} (${owner} imports ${target})`);
    }
  }
  return violations.sort();
};

/** Reports production imports that revive a second shell/design system or Vite entry. */
export const findSingleAppArchitectureViolations = (root) => {
  const resolvedRoot = resolve(root);
  const violations = [];
  const sourceRoot = join(resolvedRoot, 'src');
  const nestedDesignSystem = join(sourceRoot, 'modules', 'space3d', 'design-system');

  for (const path of filesUnder(sourceRoot, isProductionTypeScript)) {
    // This directory is retained only as the hashed migration corpus. What
    // matters for the canonical app is that no production file imports it.
    if (isInside(path, nestedDesignSystem)) continue;
    const source = readFileSync(path, 'utf8');
    for (const specifier of dependencySpecifiersIn(source, path)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(path), specifier);
      if (isInside(target, nestedDesignSystem)) violations.push(`${relative(resolvedRoot, path)} -> ${specifier} (second design system)`);
    }
  }

  for (const path of filesUnder(sourceRoot, isStylesheet)) {
    if (isInside(path, nestedDesignSystem)) continue;
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(path), specifier);
      if (isInside(target, nestedDesignSystem)) violations.push(`${relative(resolvedRoot, path)} -> ${specifier} (second design system)`);
    }
  }

  const viteEntries = filesUnder(resolvedRoot, (name) => /^vite\.config\.[cm]?[jt]sx?$/.test(name));
  if (viteEntries.length > 1) violations.push(`multiple Vite entries: ${viteEntries.map((path) => relative(resolvedRoot, path)).sort().join(', ')}`);
  return [...violations, ...findDuplicateSourceViolations(resolvedRoot), ...findToolIsolationViolations(resolvedRoot)];
};

export const runSingleAppArchitectureGate = (root) => {
  const violations = findSingleAppArchitectureViolations(root);
  if (violations.length === 0) {
    process.stdout.write('Single-app architecture boundary passed.\n');
    return 0;
  }
  process.stderr.write(`Single-app architecture boundary failed:\n${violations.map((violation) => `- ${violation}`).join('\n')}\n`);
  return 1;
};

const isMainModule = () => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule()) {
  const root = process.argv.length === 4 && process.argv[2] === '--root' ? resolve(process.argv[3]) : process.cwd();
  process.exitCode = runSingleAppArchitectureGate(root);
}
