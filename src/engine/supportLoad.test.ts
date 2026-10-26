import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { setStiffnessDefaults } from '../data/memberStiffness';
import { handleAnalysisWorkerRequest } from './analysisWorkerProtocol';
import { analyzeProject } from './solver';

describe('13 m pin/roller beam reference', () => {
  const beam = () => {
    const p = createBlankProject();
    p.nodes = [{ id: 'N1', x: 0, y: 0, support: { type: 'pin' } }, { id: 'N2', x: 13, y: 0, support: { type: 'roller', angleDeg: 90 } }];
    p.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8.333e-6 }];
    return setStiffnessDefaults(p, { mode: 'EI', factor: 1 }, true);
  };
  it.each(['N1', 'N2'])('balances 10 kN at %s directly through that support in the worker', nodeId => {
    const p = beam();
    p.nodalLoads = [{ id: 'P', nodeId, caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const before = structuredClone(p);
    const response = handleAnalysisWorkerRequest({ type: 'analyze', requestId: 13, project: p });
    expect(response.type).toBe('analysis-result');
    if (response.type !== 'analysis-result') throw new Error('worker failed');
    const result = structuredClone(response.result);
    expect(result.success).toBe(true);
    expect(result.reliability?.level).toBe('reliable');
    result.nodeResults.forEach(n => expect(n.ry).toBeCloseTo(n.nodeId === nodeId ? 10 : 0, 9));
    result.memberResults[0].localEndForces.forEach(force => expect(force).toBeCloseTo(0, 9));
    expect(result.issues.some(issue => issue.id === 'relative-stiffness')).toBe(true);
    expect(p).toEqual(before);
  });
  it('produces real bending when the same 10 kN is placed at midspan', () => {
    const p = beam();
    p.memberLoads = [{ id: 'P', memberId: 'M1', caseId: 'LC1', type: 'point', position: 0.5, px: 0, py: -10, coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1 }];
    const result = analyzeProject(p);
    expect(result.success).toBe(true);
    result.nodeResults.forEach(n => expect(n.ry).toBeCloseTo(5, 9));
    const m = result.memberResults[0];
    expect(Math.max(Math.abs(m.maxMoment), Math.abs(m.minMoment))).toBeCloseTo(32.5, 9);
    expect(Math.max(Math.abs(m.maxShear), Math.abs(m.minShear))).toBeCloseTo(5, 9);
  });
});
