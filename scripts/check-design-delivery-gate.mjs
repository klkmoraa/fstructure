import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredOracleCommand = 'python3 -m unittest validation/python/test_concrete_beam_oracle.py';

const readText = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';

export const findDesignDeliveryGateViolations = (root) => {
  const resolvedRoot = resolve(root);
  const violations = [];
  const packagePath = join(resolvedRoot, 'package.json');
  const packageJson = existsSync(packagePath) ? JSON.parse(readText(packagePath)) : {};
  const scripts = packageJson.scripts ?? {};

  if (scripts['design:oracle'] !== requiredOracleCommand) {
    violations.push('package.json#scripts.design:oracle must run the concrete-beam Python oracle');
  }
  if (typeof scripts.check !== 'string' || !scripts.check.includes(requiredOracleCommand)) {
    violations.push('package.json#scripts.check must run the concrete-beam Python oracle');
  }

  const oraclePath = join(resolvedRoot, 'validation', 'python', 'concrete_beam_oracle.py');
  if (!existsSync(oraclePath)) violations.push('validation/python/concrete_beam_oracle.py is required');
  const oracleTestPath = join(resolvedRoot, 'validation', 'python', 'test_concrete_beam_oracle.py');
  if (!existsSync(oracleTestPath)) violations.push('validation/python/test_concrete_beam_oracle.py is required');
  const fixtureDirectory = join(resolvedRoot, 'validation', 'fixtures', 'concrete-beam');
  const fixtureCount = existsSync(fixtureDirectory)
    ? readdirSync(fixtureDirectory).filter((entry) => entry.endsWith('.json')).length
    : 0;
  if (fixtureCount < 2) violations.push('validation/fixtures/concrete-beam must contain at least two JSON fixtures');

  const workflowPath = join(resolvedRoot, '.github', 'workflows', 'deploy-pages.yml');
  const workflow = readText(workflowPath);
  if (!/uses:\s*actions\/setup-python@/u.test(workflow)) {
    violations.push('.github/workflows/deploy-pages.yml must install Python with actions/setup-python');
  }
  if (!/run:\s*npm run check\s*(?:\n|$)/u.test(workflow)) {
    violations.push('.github/workflows/deploy-pages.yml must run npm run check before publishing');
  }
  return violations;
};

export const runDesignDeliveryGate = (root) => {
  const violations = findDesignDeliveryGateViolations(root);
  if (violations.length === 0) {
    process.stdout.write('Design delivery gate passed.\n');
    return 0;
  }
  process.stderr.write(`Design delivery gate failed:\n${violations.map((violation) => `- ${violation}`).join('\n')}\n`);
  return 1;
};

const isMainModule = () => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule()) process.exitCode = runDesignDeliveryGate(process.cwd());
