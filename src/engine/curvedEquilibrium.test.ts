import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { generateStructure } from '../data/generators/structureGenerators';
import { prepareCurvedAnalysis } from './curvedMemberAnalysis';
import { analyzeProject as solveMesh } from './straightSolver';
import { auditCurvedEquilibrium } from './curvedEquilibrium';

const solve = (scale = 1) => {
  const p = createBlankProject();
  const g = generateStructure({ kind: 'circular-arch', span: 2, rise: 1, segments: 24, properties: { kind: 'explicit', E: 200e6, A: 0.02, I: 0.0001 } });
  p.nodes = structuredClone([...g.nodes]); p.members = structuredClone([...g.members]); p.nodes[0].support = { type: 'fixed' };
  p.nodalLoads = [{ id: 'P', nodeId: 'N2', caseId: 'LC1', fx: 0, fy: -scale, mz: 0 }];
  const mesh = prepareCurvedAnalysis(p);
  return { project: mesh.project, result: solveMesh(mesh.project, null, { includeEducationTrace: false }) };
};
describe('vector normalization of equilibrium for an internally meshed curve', () => {
  it.each([1e-4, 1, 100])('does not divide an unloaded-axis rounding residual by itself, scale %g', scale => {
    const { project, result } = solve(scale);
    const checked = auditCurvedEquilibrium(project, result);
    expect(checked.success, JSON.stringify(checked.issues)).toBe(true);
    expect(checked.equilibrium!.normalizedResidual).toBeLessThan(1e-8);
    expect(checked.nodeResults).toEqual(result.nodeResults);
    expect(checked.linearResidual).toBe(result.linearResidual);
    expect(checked.conditionEstimate).toBe(result.conditionEstimate);
  });
  it('still rejects a genuine horizontal imbalance and does not round reactions', () => {
    const { project, result } = solve();
    const perturbed = structuredClone(result);
    perturbed.nodeResults[0].rx += 0.01;
    const checked = auditCurvedEquilibrium(project, perturbed);
    expect(checked.success).toBe(false);
    expect(checked.issues.some(i => i.id === 'global-equilibrium' && i.severity === 'error')).toBe(true);
    expect(checked.reliability!.level).toBe('unreliable');
    expect(checked.nodeResults[0].rx).toBe(perturbed.nodeResults[0].rx);
  });
  it('preserves other solver failures even when physical resultants balance', () => {
    const { project, result } = solve();
    result.success = false;
    result.issues.push({ id: 'separate-failure', severity: 'error', title: 'Unverified result', message: 'Must remain an error' });
    expect(auditCurvedEquilibrium(project, result).success).toBe(false);
  });
});
