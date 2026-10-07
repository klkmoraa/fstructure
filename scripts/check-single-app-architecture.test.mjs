import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { findDuplicateSourceViolations, findSingleAppArchitectureViolations, findToolIsolationViolations } from './check-single-app-architecture.mjs';

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

test('rejects a tool importing another isolated tool, but allows shared pieces and adapters', () => {
  const root = project({
    'src/modules/space3d/space3d/model/types.ts': "import '../../../../design/elements/beam';\nimport '../../../../foundation/linearAlgebra';\n",
    'src/design/elements/beam.ts': "import '../../foundation/units';\n",
    'src/features/design/Workbench.tsx': "import '../../design/elements/beam';\n",
    'src/features/workspace/adapters/Space3DSurface.tsx': "import '../../../modules/space3d/space3d/model/types';\n",
    'src/foundation/linearAlgebra.ts': 'export const a = 1;\n',
    'src/foundation/units.ts': 'export const b = 2;\n',
    'vite.config.ts': 'export default {};\n',
  });
  const violations = findToolIsolationViolations(root);
  assert.equal(violations.length, 1);
  assert.ok(violations.some((item) => item.includes('space3d imports model2d')));
  assert.ok(findSingleAppArchitectureViolations(root).some((item) => item.includes('space3d imports model2d')));
});

test('only the workspace frontier uses declared integrations, and integrations never import tool interfaces', () => {
  const root = project({
    'src/integrations/model2dDesign.ts': "import '../design/elements/structure';\nimport '../engine/solver';\n",
    'src/integrations/leaky.ts': "import '../features/design/workbench/FrameWorkbench';\n",
    'src/integrations/space3dDesign.ts': "import '../modules/space3d/space3d/engine/solver';\nimport '../modules/space3d/space3d/model/types';\n",
    'src/integrations/viewer.ts': "import '../modules/space3d/space3d/view/Space3DCanvas';\n",
    'src/modules/space3d/space3d/engine/solver.ts': 'export const c = 3;\n',
    'src/modules/space3d/space3d/model/types.ts': 'export const d = 4;\n',
    'src/modules/space3d/space3d/view/Space3DCanvas.tsx': 'export const e = 5;\n',
    'src/features/workspace/adapters/DesignSurface.tsx': "import '../../../integrations/model2dDesign';\n",
    'src/features/design/workbench/FrameWorkbench.tsx': "import '../../../integrations/model2dDesign';\n",
    'src/features/results/ResultsPanel.tsx': "import '../../integrations/model2dDesign';\n",
    'src/design/elements/structure.ts': 'export const a = 1;\n',
    'src/engine/solver.ts': 'export const b = 2;\n',
    'vite.config.ts': 'export default {};\n',
  });
  const violations = findToolIsolationViolations(root);
  // El motor y el modelo del 3D son bibliotecas que un puente puede usar; su visor no.
  assert.equal(violations.length, 4);
  assert.ok(violations.some((item) => item.includes('leaky.ts') && item.includes('integration imports a tool interface')));
  assert.ok(violations.some((item) => item.includes('viewer.ts') && item.includes('integration imports a tool interface')));
  assert.ok(!violations.some((item) => item.includes('space3dDesign.ts')));
  assert.ok(violations.some((item) => item.startsWith('src/features/design/') && item.includes('only src/features/workspace may use integrations')));
  assert.ok(violations.some((item) => item.startsWith('src/features/results/') && item.includes('only src/features/workspace may use integrations')));
});
