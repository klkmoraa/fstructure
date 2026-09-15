import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { findDesignDeliveryGateViolations } from './check-design-delivery-gate.mjs';

const temporaryRoots = [];

const createProject = ({ packageJson, workflow, oracle = true, fixtures = 2 }) => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-design-delivery-gate-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(root, 'validation', 'python'), { recursive: true });
  mkdirSync(join(root, 'validation', 'fixtures', 'concrete-beam'), { recursive: true });
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(join(root, '.github', 'workflows', 'deploy-pages.yml'), workflow);
  if (oracle) {
    writeFileSync(join(root, 'validation', 'python', 'concrete_beam_oracle.py'), 'ORACLE = true\n');
    writeFileSync(join(root, 'validation', 'python', 'test_concrete_beam_oracle.py'), 'FIXTURES = "concrete-beam"\n');
  }
  for (let index = 0; index < fixtures; index += 1) writeFileSync(join(root, 'validation', 'fixtures', 'concrete-beam', `fixture-${index}.json`), '{}\n');
  return root;
};

const configuredPackage = {
  scripts: {
    'design:oracle': 'python3 -m unittest validation/python/test_concrete_beam_oracle.py',
    check: 'oxlint && python3 -m unittest validation/python/test_concrete_beam_oracle.py && vite build',
  },
};

const configuredWorkflow = `steps:
  - uses: actions/setup-node@v4
  - uses: actions/setup-python@v5
  - name: Quality gate
    run: npm run check
`;

test.afterEach(() => {
  while (temporaryRoots.length > 0) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

test('accepts a Pages workflow whose quality gate runs Node, Python and concrete fixtures', () => {
  const root = createProject({ packageJson: configuredPackage, workflow: configuredWorkflow });

  assert.deepEqual(findDesignDeliveryGateViolations(root), []);
});

test('rejects a build-only workflow or an incomplete local quality gate', () => {
  const root = createProject({
    packageJson: { scripts: { check: 'npm run build' } },
    workflow: 'steps:\n  - name: Build application\n    run: npm run build\n',
    oracle: false,
    fixtures: 1,
  });

  assert.deepEqual(findDesignDeliveryGateViolations(root), [
    'package.json#scripts.design:oracle must run the concrete-beam Python oracle',
    'package.json#scripts.check must run the concrete-beam Python oracle',
    'validation/python/concrete_beam_oracle.py is required',
    'validation/python/test_concrete_beam_oracle.py is required',
    'validation/fixtures/concrete-beam must contain at least two JSON fixtures',
    '.github/workflows/deploy-pages.yml must install Python with actions/setup-python',
    '.github/workflows/deploy-pages.yml must run npm run check before publishing',
  ]);
});
