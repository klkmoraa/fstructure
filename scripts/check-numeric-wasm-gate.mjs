import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const manifest = join(repositoryRoot, 'crates/numeric-core/Cargo.toml');
const wasm = join(
  repositoryRoot,
  'crates/numeric-core/target/wasm32-unknown-unknown/release/fstructure_numeric_core.wasm',
);
const cargo = process.env.CARGO ?? join(homedir(), '.cargo/bin/cargo');
const wasmBindgen = process.env.WASM_BINDGEN ?? join(homedir(), '.cargo/bin/wasm-bindgen');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'fstructure-wasm-gate-'));
const nodePackage = join(temporaryRoot, 'node');
const webPackage = join(temporaryRoot, 'web');
const committedWebPackage = join(repositoryRoot, 'src/numeric/wasm');

const run = (executable, args) => execFileSync(executable, args, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

try {
  const rustcVersion = run(join(homedir(), '.cargo/bin/rustc'), ['--version']);
  const cargoVersion = run(cargo, ['--version']);
  const wasmBindgenVersion = run(wasmBindgen, ['--version']);
  run(cargo, [
    'build',
    '--locked',
    '--manifest-path', manifest,
    '--target', 'wasm32-unknown-unknown',
    '--release',
    '--features', 'faer-backend',
  ]);
  run(wasmBindgen, [wasm, '--target', 'nodejs', '--out-dir', nodePackage]);
  run(wasmBindgen, [wasm, '--target', 'web', '--out-dir', webPackage]);

  for (const artifact of [
    'fstructure_numeric_core.d.ts',
    'fstructure_numeric_core.js',
    'fstructure_numeric_core_bg.wasm',
    'fstructure_numeric_core_bg.wasm.d.ts',
  ]) {
    const generated = readFileSync(join(webPackage, artifact));
    const committed = readFileSync(join(committedWebPackage, artifact));
    if (!generated.equals(committed)) {
      throw new Error(`checked-in browser artifact is stale: src/numeric/wasm/${artifact}`);
    }
  }

  const require = createRequire(import.meta.url);
  const bindings = require(join(nodePackage, 'fstructure_numeric_core.js'));
  const packed = Array.from(bindings.solve_csc(
    3,
    new Uint32Array([0, 2, 5, 7]),
    new Uint32Array([0, 1, 0, 1, 2, 1, 2]),
    new Float64Array([4, 1, 1, 3, 1, 1, 2]),
    new Float64Array([6, 10, 8]),
  ));
  const expected = [1, 2, 3];
  if (packed.length !== expected.length + 3) {
    throw new Error(`faer WASM returned ${packed.length} values; expected ${expected.length + 3}`);
  }
  const solution = packed.slice(0, expected.length);
  const [conditionEstimate, linearResidual, equilibriumResidual] = packed.slice(expected.length);
  if (solution.some((value, index) => Math.abs(value - expected[index]) > 1e-12)) {
    throw new Error(`faer WASM result ${solution.join(',')} does not match ${expected.join(',')}`);
  }
  if (![conditionEstimate, linearResidual, equilibriumResidual].every(Number.isFinite)
    || linearResidual > 1e-12 || equilibriumResidual > 1e-12) {
    throw new Error(`faer WASM quality is not reliable: ${packed.slice(expected.length).join(',')}`);
  }

  process.stdout.write(`${JSON.stringify({
    gate: 'faer-0.24.4-wasm-sparse-lu',
    status: 'passed',
    target: 'wasm32-unknown-unknown',
    solution,
    quality: { conditionEstimate, linearResidual, equilibriumResidual },
    tolerance: 1e-12,
    rustcVersion,
    cargoVersion,
    wasmBindgenVersion,
    browserArtifactSha256: createHash('sha256')
      .update(readFileSync(join(committedWebPackage, 'fstructure_numeric_core_bg.wasm')))
      .digest('hex'),
  }, null, 2)}\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
