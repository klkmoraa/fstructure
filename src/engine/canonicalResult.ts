import type { AnalysisResult } from '../types';

export const CANONICAL_RESULT_SCHEMA = 'fusionstructure-2d-result/v1';
export const LINEAR_STATIC_ALGORITHM = 'matrix-stiffness-linear-static/v1';
export const P_DELTA_ALGORITHM = 'matrix-stiffness-p-delta/v1';

/** Keep small round-off differences out of cross-repository comparisons. */
const normalizeNumber = (value: number): number | string => {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity';
  if (Object.is(value, -0) || Math.abs(value) <= 1e-12) return 0;
  return Number(value.toPrecision(12));
};

const canonicalize = (value: unknown): unknown => {
  if (typeof value === 'number') return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

/**
 * Stable, deliberately result-focused interchange serialization for direct 2D
 * comparisons. Arrays whose order is structural are preserved; node/member
 * result arrays are sorted by their stable IDs before canonicalization.
 */
export const serializeCanonicalResult = (result: AnalysisResult): string => {
  const snapshot = {
    schema: CANONICAL_RESULT_SCHEMA,
    engineId: 'fusionstructure-2d',
    algorithmId: result.pDelta ? P_DELTA_ALGORITHM : LINEAR_STATIC_ALGORITHM,
    success: result.success,
    issues: [...result.issues].sort((left, right) => left.id.localeCompare(right.id)),
    displacements: result.displacements,
    nodeResults: [...result.nodeResults].sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    memberResults: [...result.memberResults].sort((left, right) => left.memberId.localeCompare(right.memberId)),
    equilibrium: result.equilibrium,
    residualNorm: result.residualNorm,
    constraintResidual: result.constraintResidual,
    linearResidual: result.linearResidual,
    conditionEstimate: result.conditionEstimate,
    pDelta: result.pDelta,
    activeSet: result.activeSet,
  };
  return JSON.stringify(canonicalize(snapshot));
};
