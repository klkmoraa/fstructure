import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { findDuplicateSourceViolations, findSingleAppArchitectureViolations } from './check-single-app-architecture.mjs';

const roots = [];
const project = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-architecture-'));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
};
test.afterEach(() => { while (roots.length) rmSync(roots.pop(), { recursive: true, force: true }); });

test('allows one canonical Vite entry and root design system imports', () => {
  const root = project({
    'src/main.tsx': "import '../design-system/components/controls';\n",
    'src/styles.css': '@import \'./design-system/tokens.css\';\n',
    'vite.config.ts': 'export default {};\n',
  });
  assert.deepEqual(findSingleAppArchitectureViolations(root), []);
});

test('rejects nested Space 3D design-system imports and a second Vite entry', () => {
  const root = project({
    'src/main.tsx': "import './modules/space3d/design-system/components/controls';\n",
    'src/modules/space3d/styles.css': "@import './design-system/tokens.css';\n",
    'vite.config.ts': 'export default {};\n',
    'tools/vite.config.ts': 'export default {};\n',
  });
  const violations = findSingleAppArchitectureViolations(root);
  assert.equal(violations.length, 3);
  assert.ok(violations.some((item) => item.includes('second design system')));
  assert.ok(violations.some((item) => item.includes('multiple Vite entries')));
});

test('rejects byte-identical production copies of the same module', () => {
  const algebra = 'export const zeros = (n) => Array.from({ length: n }, () => 0);\n';
  const root = project({
    'src/main.tsx': "import './foundation/linearAlgebra';\n",
    'src/foundation/linearAlgebra.ts': algebra,
    'src/modules/space3d/foundation/linearAlgebra.ts': algebra,
    'vite.config.ts': 'export default {};\n',
  });
  const violations = findDuplicateSourceViolations(root);
  assert.equal(violations.length, 1);
  assert.ok(violations[0].includes('duplicate source'));
  assert.ok(violations[0].includes('src/foundation/linearAlgebra.ts'));
  // La puerta general también debe reportarlo, no sólo el comprobador aislado.
  assert.ok(findSingleAppArchitectureViolations(root).some((item) => item.includes('duplicate source')));
});

test('allows distinct modules and ignores test files', () => {
  const root = project({
    'src/main.tsx': "import './a';\n",
    'src/a.ts': 'export const a = 1;\n',
    'src/b.ts': 'export const b = 2;\n',
    'src/a.test.ts': 'export const shared = 0;\n',
    'src/modules/space3d/b.test.ts': 'export const shared = 0;\n',
    'vite.config.ts': 'export default {};\n',
  });
  assert.deepEqual(findDuplicateSourceViolations(root), []);
});
