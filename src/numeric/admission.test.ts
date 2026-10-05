import { describe, expect, it } from 'vitest';

import {
  MEBIBYTE,
  assessAnalysisAdmission,
  createAutomaticAnalysisBudget,
  estimateSparseLinearSystemBytes,
} from './admission';

describe('adaptive analysis admission', () => {
  it('uses 20% of announced memory within the device clamps and a 256 MiB fallback', () => {
    expect(createAutomaticAnalysisBudget(0.25).maxEstimatedBytes).toBe(128 * MEBIBYTE);
    expect(createAutomaticAnalysisBudget(8).maxEstimatedBytes).toBeCloseTo(1.6 * 1024 * MEBIBYTE, 0);
    expect(createAutomaticAnalysisBudget(64).maxEstimatedBytes).toBe(2 * 1024 * MEBIBYTE);
    expect(createAutomaticAnalysisBudget(undefined)).toEqual({
      maxEstimatedBytes: 256 * MEBIBYTE,
      softDeadlineMs: 30_000,
    });
    expect(createAutomaticAnalysisBudget(Number.NaN).maxEstimatedBytes).toBe(256 * MEBIBYTE);
  });

  it('estimates sparse storage before admission and has no entity-count ceiling', () => {
    const small = estimateSparseLinearSystemBytes({ dimension: 3, nonZeros: 7, rhsCount: 1 });
    const veryLargeButSparse = estimateSparseLinearSystemBytes({
      dimension: 10_000_000,
      nonZeros: 10_000_000,
      rhsCount: 1,
    });

    expect(small).toBe(8 * MEBIBYTE + 1_968);
    expect(Number.isFinite(veryLargeButSparse)).toBe(true);
    expect(veryLargeButSparse).toBeGreaterThan(4_000_000_000_000_000);
    expect(estimateSparseLinearSystemBytes({
      dimension: Number.MAX_SAFE_INTEGER,
      nonZeros: Number.MAX_SAFE_INTEGER,
      rhsCount: 1,
    })).toBe(Number.POSITIVE_INFINITY);
    expect(assessAnalysisAdmission(small, { maxEstimatedBytes: small, softDeadlineMs: 30_000 }))
      .toEqual({ accepted: true, estimatedBytes: small, availableBytes: small });
    expect(assessAnalysisAdmission(small + 1, { maxEstimatedBytes: small, softDeadlineMs: 30_000 }))
      .toEqual({ accepted: false, estimatedBytes: small + 1, availableBytes: small, reason: 'memory-budget' });
  });
});
