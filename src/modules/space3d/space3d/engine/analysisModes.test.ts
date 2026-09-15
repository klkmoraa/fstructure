import { describe, expect, it } from 'vitest';

import { axialCantilever } from './fixtures';
import { analyzeSpace3DModal } from './analysisModes';

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
