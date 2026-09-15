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
  return violations;
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
