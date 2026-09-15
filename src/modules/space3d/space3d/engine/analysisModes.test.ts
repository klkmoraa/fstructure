import { describe, expect, it } from 'vitest';

import { axialCantilever } from './fixtures';
import { analyzeSpace3DBuckling, analyzeSpace3DInfluence, analyzeSpace3DPDelta, analyzeSpace3DModal } from './analysisModes';

describe('Space3D modal study', () => {
  it('returns a positive frequency and six-component mode shape from member mass', () => {
    const base = axialCantilever({ P: 0 });
    const project = {
      ...base,
      members: [{ ...base.members[0], density: 7_850 }],
    };

    const result = analyzeSpace3DModal(project, { modes: 1, targetId: 'CO1' });

    expect(result.success).toBe(true);
    expect(result.totalMass).toBeCloseTo(0.157, 12);
    expect(result.modes).toHaveLength(1);
    expect(result.modes[0].frequency).toBeGreaterThan(0);
    expect(result.modes[0].shape[0]).toMatchObject({ nodeId: 'I', ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 });
    expect(result.modes[0].shape[1]).toHaveProperty('rz');
  });

  it('fails explicitly when the model has no positive mass', () => {
    const result = analyzeSpace3DModal(axialCantilever(), { modes: 1, targetId: 'CO1' });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('masa');
  });
});

describe('Space3D stability studies', () => {
  it('keeps a zero-compression P-Delta run equal to the linear reference', () => {
    const project = axialCantilever({ P: 10 });
    const result = analyzeSpace3DPDelta(project, 'CO1', { maxIterations: 3 });

    expect(result.success).toBe(true);
    expect(result.converged).toBe(true);
    expect(result.analysis.nodeResults.find((node) => node.nodeId === 'J')?.displacement.ux).toBeCloseTo(1e-5, 12);
  });

  it('does not fabricate a critical factor when no member is in compression', () => {
    const result = analyzeSpace3DBuckling(axialCantilever({ P: 10 }), 'CO1', { modes: 1 });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('comprimido');
  });

  it('finds a positive elastic factor for a compressed frame reference', () => {
    const result = analyzeSpace3DBuckling(axialCantilever({ P: -10 }), 'CO1', { modes: 1 });

    expect(result.success).toBe(true);
    expect(result.criticalLoadFactor).toBeGreaterThan(0);
    expect(result.referenceAxialForces.M1).toBeCloseTo(-10, 8);
  });

  it('amplifies a transverse displacement when compression is present', () => {
    const base = axialCantilever({ P: -100 });
    const project = { ...base, nodalLoads: [{ ...base.nodalLoads[0], fy: 10 }] };
    const linear = analyzeSpace3DPDelta(project, 'CO1', { maxIterations: 5 });

    expect(linear.success).toBe(true);
    expect(linear.analysis.nodeResults[1].displacement.uy).toBeGreaterThan(0);
    expect(linear.analysis.nodeResults[1].displacement.uy).toBeGreaterThan(linear.linear.nodeResults[1].displacement.uy);
  });

  it('requires an explicit spatial unit-load direction for influence responses', () => {
    const result = analyzeSpace3DInfluence(axialCantilever({ P: 0 }), {
      targetId: 'CO1',
      target: { kind: 'member', memberId: 'M1', position: 1, quantity: 'N', side: 'continuous' },
      positions: [0, 1, 2],
      unitLoad: [1, 0, 0],
    });

    expect(result.success).toBe(true);
    expect(result.points).toHaveLength(3);
    expect(result.points.every((point) => Number.isFinite(point.value))).toBe(true);
    expect(result.maxEquilibriumResidual).toBeLessThanOrEqual(1e-8);
  });

  it('rejects every dense study before allocation when the memory budget is exhausted', () => {
    const project = axialCantilever({ P: -10 });
    const budget = { maxEstimatedBytes: 1, softDeadlineMs: 30_000 };
    const influence = analyzeSpace3DInfluence(project, {
      targetId: 'CO1',
      target: { kind: 'member', memberId: 'M1', position: 1, quantity: 'N', side: 'continuous' },
      positions: [0, 1, 2],
      unitLoad: [1, 0, 0],
      budget,
    });
    const results = [
      analyzeSpace3DPDelta(project, 'CO1', { budget }),
      analyzeSpace3DModal(project, { targetId: 'CO1', modes: 1, budget }),
      analyzeSpace3DBuckling(project, 'CO1', { modes: 1, budget }),
      influence,
    ];

    for (const result of results) {
      expect(result.success).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({ code: 'memory-budget' }));
    }
  });
});
