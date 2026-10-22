import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import type { MemberModel } from '../types';
import { analyzeProject } from './solver';
import { solveTrussEquilibrium } from './trussEquilibrium';
import { handleAnalysisWorkerRequest } from './analysisWorkerProtocol';
import { resolveReliability, isTrustedForCombination } from './reliability';
import { trussAxialReadings } from '../features/results/trussAxial';
import example from '../../public/examples/armadura-fijo-movil.fusionstructure.json';
import { normalizeProject } from '../data/migrate';

const G = 9.80665;
const photo = () => {
  const p = createBlankProject();
  p.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 0, y: 4, support: { type: 'none' } },
    { id: 'N3', x: 3, y: 4, support: { type: 'none' } },
    { id: 'N4', x: 3, y: 3, support: { type: 'roller', angleDeg: 90 } },
  ];
  p.members = [['N1', 'N2'], ['N2', 'N3'], ['N1', 'N3'], ['N3', 'N4']]
    .map(([i, j], index): MemberModel => ({ id: `M${index + 1}`, i, j, type: 'truss', E: 200e6, A: 0.01, I: 0 }));
  p.nodalLoads = [{ id: 'P', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -G, mz: 0 }];
  return p;
};

describe('joint equilibrium of a truss with an unloaded mechanism', () => {
  it('opens the supplied example with the original supports and no additional bars', () => {
    const p = normalizeProject(example);
    expect(p.members).toHaveLength(4);
    expect(p.nodes.find(n => n.id === 'N1')!.support.type).toBe('pin');
    expect(p.nodes.find(n => n.id === 'N4')!.support).toMatchObject({ type: 'roller', angleDeg: 90 });
    expect(analyzeProject(p).trussEquilibrium!.memberForces[3].axial / G).toBeCloseTo(-1, 8);
  });
  it('returns the photo forces, retaining failed stability and no displacement or design results', () => {
    const p = photo();
    const before = structuredClone(p);
    const result = analyzeProject(p);
    expect(result.success).toBe(false);
    expect(result.mechanism?.nullity).toBe(1);
    expect(result.trussEquilibrium?.normalizedResidual).toBeLessThan(1e-12);
    expect(result.trussEquilibrium?.memberForces.map(m => m.axial / G)).toEqual(expect.arrayContaining([expect.closeTo(-1, 8)]));
    result.trussEquilibrium!.memberForces.slice(0, 3).forEach(m => expect(m.axial).toBeCloseTo(0, 8));
    expect(result.trussEquilibrium!.reactions.find(n => n.nodeId === 'N4')!.ry / G).toBeCloseTo(1, 8);
    expect(result.trussEquilibrium!.reactions.find(n => n.nodeId === 'N1')!.ry).toBeCloseTo(0, 8);
    expect(result.displacements).toEqual([]);
    expect(result.memberResults).toEqual([]);
    expect(result.nodeResults).toEqual([]);
    expect(isTrustedForCombination(resolveReliability(result).level)).toBe(false);
    expect(trussAxialReadings(p, result).size).toBe(0);
    expect(p).toEqual(before);
  });

  it('checks a second reference with horizontal load, tension and compression', () => {
    const p = photo();
    p.nodalLoads.push({ id: 'H', nodeId: 'N2', caseId: 'LC1', fx: 5 * G, fy: 0, mz: 0 });
    const result = analyzeProject(p).trussEquilibrium!;
    expect(result.memberForces.find(m => m.memberId === 'M2')!.axial / G).toBeCloseTo(-5, 8);
    expect(result.memberForces.find(m => m.memberId === 'M3')!.axial / G).toBeCloseTo(25 / 3, 8);
    expect(result.memberForces.find(m => m.memberId === 'M4')!.axial / G).toBeCloseTo(-23 / 3, 8);
    expect(result.reactions.find(n => n.nodeId === 'N1')!.rx / G).toBeCloseTo(-5, 8);
    expect(result.reactions.find(n => n.nodeId === 'N1')!.ry / G).toBeCloseTo(-20 / 3, 8);
  });

  it('refuses a load along the mechanism, even if extremely small', () => {
    for (const load of [G, 1e-12]) {
      const p = photo();
      p.nodalLoads = [{ id: 'H', nodeId: 'N4', caseId: 'LC1', fx: load, fy: 0, mz: 0 }];
      expect(analyzeProject(p).trussEquilibrium).toBeUndefined();
    }
  });

  it('uses the selected load combination and survives worker serialization', () => {
    const p = photo();
    p.combinations = [{ id: 'U', name: 'U', factors: { LC1: 1.5 } }];
    const response = handleAnalysisWorkerRequest({ type: 'analyze', requestId: 1, project: p, combinationId: 'U' });
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error('worker failed');
    const cloned = structuredClone(response.result);
    expect(cloned.trussEquilibrium!.memberForces.find(m => m.memberId === 'M4')!.axial / G).toBeCloseTo(-1.5, 8);
    expect(solveTrussEquilibrium(p, {} )!.memberForces.every(m => Math.abs(m.axial) < 1e-12)).toBe(true);
  });

  it('preserves the force solution when the geometry, load and roller are rotated', () => {
    const p = photo();
    p.nodes = p.nodes.map(node => ({ ...node, x: (node.x - node.y) / Math.SQRT2, y: (node.x + node.y) / Math.SQRT2 }));
    p.nodes[3].support.angleDeg = 135;
    p.nodalLoads[0].fx = G / Math.SQRT2;
    p.nodalLoads[0].fy = -G / Math.SQRT2;
    const result = analyzeProject(p).trussEquilibrium!;
    expect(result.memberForces[3].axial / G).toBeCloseTo(-1, 8);
    expect(result.reactions.find(n => n.nodeId === 'N4')!.rx / G).toBeCloseTo(-1 / Math.SQRT2, 8);
    expect(result.reactions.find(n => n.nodeId === 'N4')!.ry / G).toBeCloseTo(1 / Math.SQRT2, 8);
  });

  it('refuses nonunique forces and unsupported constitutive behavior', () => {
    const duplicate = photo();
    duplicate.members.push({ ...duplicate.members[0], id: 'extra' });
    expect(solveTrussEquilibrium(duplicate, { LC1: 1 })).toBeUndefined();
    const unilateral = photo(); unilateral.members[3].axialBehavior = 'tension-only';
    expect(solveTrussEquilibrium(unilateral, { LC1: 1 })).toBeUndefined();
    const spring = photo(); spring.nodes[3].support.spring = { kx: 100 };
    expect(solveTrussEquilibrium(spring, { LC1: 1 })).toBeUndefined();
    const weight = photo(); weight.loadCases[0].selfWeightFactor = 1;
    expect(solveTrussEquilibrium(weight, { LC1: 1 })).toBeUndefined();
    const mixed = photo(); mixed.members[0].type = 'frame'; mixed.members[0].I = 0.0001;
    expect(solveTrussEquilibrium(mixed, { LC1: 1 })).toBeUndefined();
    expect(analyzeProject(photo(), null, { nodeLinkLinearizations: new Map() }).trussEquilibrium).toBeUndefined();
  });

  it('keeps stable structures on the ordinary displacement analysis path', () => {
    const p = photo(); p.nodes[3].support = { type: 'pin' };
    const result = analyzeProject(p);
    expect(result.success).toBe(true);
    expect(result.trussEquilibrium).toBeUndefined();
  });
});
