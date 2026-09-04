import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { analyzeProject } from './solver';
import { analyzeProjectPDelta } from './pDelta';
import { readCorpusAssertion, availableSolver2dCorpus, resolveCorpusProject, unsupportedSolver2dCapabilities, solver2dCorpus, evaluateCorpusInvariant } from './solver2dCorpus';
import { serializeCanonicalResult } from './canonicalResult';

const closeEnough = (actual: number, expected: number, atol: number, rtol: number): boolean => Math.abs(actual - expected) <= atol + rtol * Math.max(Math.abs(actual), Math.abs(expected));

describe('direct 2D numerical compatibility corpus', () => {
  it('keeps the post-baseline manifest and artifact digests stable', () => {
    const root = resolve(import.meta.dirname, '..', '..');
    const manifest = JSON.parse(readFileSync(resolve(root, 'migration', 'solver2d-compatibility-manifest.json'), 'utf8')) as { caseCount: number; availableCaseCount: number; unsupportedCaseCount: number; artifacts: Array<{ path: string; sha256: string }> };
    expect(manifest.caseCount).toBe(solver2dCorpus.length);
    expect(manifest.availableCaseCount).toBe(availableSolver2dCorpus.length);
    expect(manifest.unsupportedCaseCount).toBe(unsupportedSolver2dCapabilities.length);
    for (const artifact of manifest.artifacts) {
      const digest = createHash('sha256').update(readFileSync(resolve(root, artifact.path))).digest('hex');
      expect(digest, artifact.path).toBe(artifact.sha256);
    }
  });

  it('executes every available fixture and checks literal independent outputs', () => {
    expect(availableSolver2dCorpus.length).toBeGreaterThanOrEqual(12);
    for (const fixture of availableSolver2dCorpus) {
      const project = resolveCorpusProject(fixture);
      const combination = fixture.id === 'load-combination' ? project.combinations[0] : undefined;
      const result = fixture.id === 'p-delta' ? analyzeProjectPDelta(project, undefined, { maxLoadSteps: 16, maxIterationsPerStep: 40 }) : analyzeProject(project, combination, { includeEducationTrace: false });
      for (const expected of fixture.assertions) expect(expected.nearZeroTolerance, `${fixture.id}/${expected.id} near-zero tolerance`).toBeGreaterThan(0);
      for (const expected of fixture.assertions) {
        if (!result.success && expected.target.kind !== 'analysis') continue;
        const actual = readCorpusAssertion(result, expected.target);
        if (typeof expected.expected === 'boolean') expect(actual, `${fixture.id}/${expected.id}`).toBe(expected.expected);
        else expect(closeEnough(actual as number, expected.expected, expected.atol, expected.rtol), `${fixture.id}/${expected.id}: ${actual} vs ${expected.expected}`).toBe(true);
      }
      expect(fixture.invariants.length, `${fixture.id} must declare invariants`).toBeGreaterThan(0);
      for (const invariant of fixture.invariants) {
        const valid = evaluateCorpusInvariant(project, result, invariant, combination);
        expect(valid, `${fixture.id}/${invariant.id}`).toBe(true);
      }
      if (fixture.id !== 'mechanism-singularity') {
        // The P-Delta result intentionally keeps first-order global diagram
        // closure informational; its frozen tangent solve has its own residual.
        const residual = fixture.id === 'p-delta' ? result.residualNorm : result.equilibrium.normalizedResidual;
        expect(Number.isFinite(residual), `${fixture.id} equilibrium residual must be finite`).toBe(true);
        expect(residual, fixture.id).toBeLessThan(1e-7);
      }
    }
  });

  it('does not fake unsupported capabilities', () => {
    expect(unsupportedSolver2dCapabilities.map((item) => item.id)).toEqual(['buckling', 'modal', 'influence']);
    for (const fixture of unsupportedSolver2dCapabilities) {
      expect(fixture.status).toBe('unsupported');
      expect(fixture.unsupportedReason).toEqual(expect.any(String));
      expect(fixture.assertions).toHaveLength(0);
      expect(fixture.algorithmId).toBe('not-implemented');
    }
  });

  it('is mutation-sensitive: changing a load changes the canonical result', () => {
    const fixture = availableSolver2dCorpus.find((item) => item.id === 'simply-supported-point')!;
    const original = analyzeProject(resolveCorpusProject(fixture), undefined, { includeEducationTrace: false });
    const mutated = resolveCorpusProject(fixture);
    mutated.memberLoads[0].py = -41;
    const changed = analyzeProject(mutated, undefined, { includeEducationTrace: false });
    expect(serializeCanonicalResult(original)).not.toBe(serializeCanonicalResult(changed));
  });
});
