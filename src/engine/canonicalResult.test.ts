import { describe, expect, it } from 'vitest';

import { serializeCanonicalResult } from './canonicalResult';
import type { AnalysisResult } from '../types';

const result = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  success: true,
  issues: [],
  nodeResults: [
    { nodeId: 'N2', ux: 0.0000000000004, uy: -0, rz: 1, rx: 2, ry: 3, rm: 4 },
    { nodeId: 'N1', ux: 1, uy: 2, rz: 3, rx: 4, ry: 5, rm: 6 },
  ],
  memberResults: [],
  displacements: [1, -0],
  residualNorm: 0,
  conditionEstimate: 2,
  equilibrium: {
    sumFx: 0,
    sumFy: -0,
    sumM: 0,
    normalizedComponents: { fx: 0, fy: 0, mz: 0 },
    normalizedResidual: 0,
  },
  explanation: [],
  ...overrides,
});

describe('canonical 2D result serializer', () => {
  it('orders stable IDs and normalizes numeric noise deterministically', () => {
    const first = serializeCanonicalResult(result());
    const second = serializeCanonicalResult(result({ nodeResults: [...result().nodeResults].reverse() }));

    expect(first).toBe(second);
    expect(first).toContain('"nodeId":"N1"');
    expect(first).not.toContain('-0');
    expect(first).toContain('"ux":0');
  });
});
