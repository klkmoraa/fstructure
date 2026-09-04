import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const gatePath = fileURLToPath(new URL('./check-local-foundation-dependencies.mjs', import.meta.url));
const temporaryRoots = [];

const writeProjectFile = (root, path, content) => {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
};

const createProject = ({ dependencies = {}, devDependencies = {}, files = {} } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-foundation-gate-'));
  temporaryRoots.push(root);
  writeProjectFile(root, 'package.json', `${JSON.stringify({
    name: '@fusionstructure/fstructure',
    dependencies,
    devDependencies,
  }, null, 2)}\n`);
  for (const [path, content] of Object.entries(files)) writeProjectFile(root, path, content);
  return root;
};

const runGate = (root) => spawnSync(process.execPath, [gatePath, '--root', root], {
  cwd: root,
  encoding: 'utf8',
});

test.afterEach(() => {
  while (temporaryRoots.length > 0) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

test('allows forbidden-package examples outside production TypeScript sources', () => {
  const root = createProject({
    dependencies: { react: '^19.0.0' },
    files: {
      'src/local.ts': "export const label = '@fusionstructure/foundation';\n",
      'src/local.test.ts': "import { units } from '@fusionstructure/foundation';\nvoid units;\n",
      'docs/example.ts': "import { units } from '@fusionstructure/foundation';\nvoid units;\n",
      'README.md': 'Archived package: @fusionstructure/foundation.\n',
    },
  });

  const result = runGate(root);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Foundation dependency boundary passed/);
});

test('rejects the archived Foundation package from a production import', () => {
  const root = createProject({
    files: {
      'src/consumer.ts': "import { toDisplay } from '@fusionstructure/foundation';\nvoid toDisplay;\n",
    },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src[\\/]consumer\.ts/);
  assert.match(result.stderr, /@fusionstructure\/foundation/);
});

test('rejects sibling-product dependencies declared in package metadata', () => {
  const root = createProject({
    devDependencies: { '@fusionstructure/space3d': '^0.1.0' },
    files: { 'src/local.ts': 'export const local = true;\n' },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package\.json#devDependencies/);
  assert.match(result.stderr, /@fusionstructure\/space3d/);
});

test('rejects archived Foundation packages hidden behind npm aliases', () => {
  const root = createProject({
    dependencies: { 'local-foundation': 'npm:@fusionstructure/foundation@^0.1.0' },
    files: { 'src/local.ts': 'export const local = true;\n' },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package\.json#dependencies/);
  assert.match(result.stderr, /local-foundation/);
  assert.match(result.stderr, /@fusionstructure\/foundation/);
});

test('rejects sibling-product internal imports in production TypeScript', () => {
  const root = createProject({
    files: {
      'src/consumer.tsx': "export const load = () => import('@fusionstructure/space3d/internal');\n",
    },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src[\\/]consumer\.tsx/);
  assert.match(result.stderr, /@fusionstructure\/space3d\/internal/);
});

test('rejects relative production imports that escape into a sibling product', () => {
  const root = createProject({
    files: {
      'src/consumer.ts': "import { model } from '../../space3d/src/model';\nvoid model;\n",
    },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src[\\/]consumer\.ts/);
  assert.match(result.stderr, /\.\.\/[\\/]?\.\.\/[\\/]?space3d/);
});

test('reports fixture paths relative to the project root', () => {
  const root = createProject({
    files: {
      'src/nested/consumer.ts': "export type Units = import('@fusionstructure/foundation').Units;\n",
    },
  });

  const result = runGate(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(relative(root, join(root, 'src', 'nested', 'consumer.ts')).replace(/[\\/]/g, '[\\\\/]')));
});
