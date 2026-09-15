import type { AnalysisBudget } from '../shared/contracts';

export const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const MINIMUM_BUDGET_BYTES = 128 * MEBIBYTE;
const MAXIMUM_BUDGET_BYTES = 2 * GIBIBYTE;
const FALLBACK_BUDGET_BYTES = 256 * MEBIBYTE;
export const DEFAULT_SOFT_DEADLINE_MS = 30_000;

const finitePositive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Builds the device-local budget without imposing any entity-count ceiling. */
export const createAutomaticAnalysisBudget = (deviceMemoryGiB?: number): AnalysisBudget => {
  const maxEstimatedBytes = finitePositive(deviceMemoryGiB)
    ? Math.floor(Math.min(MAXIMUM_BUDGET_BYTES, Math.max(MINIMUM_BUDGET_BYTES, deviceMemoryGiB * GIBIBYTE * 0.2)))
    : FALLBACK_BUDGET_BYTES;
  return { maxEstimatedBytes, softDeadlineMs: DEFAULT_SOFT_DEADLINE_MS };
};

export const createBrowserAnalysisBudget = (): AnalysisBudget => {
  const memory = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { readonly deviceMemory?: number }).deviceMemory;
  return createAutomaticAnalysisBudget(memory);
};

export interface SparseLinearSystemShape {
  readonly dimension: number;
  readonly nonZeros: number;
  readonly rhsCount?: number;
}

/**
 * Conservative pre-allocation estimate for CSC input, sparse factors,
 * permutations and solve work vectors. The estimate is arithmetic only: it
 * never creates a matrix or a typed array.
 */
export const estimateSparseLinearSystemBytes = ({
  dimension,
  nonZeros,
  rhsCount = 1,
}: SparseLinearSystemShape): number => {
  if (![dimension, nonZeros, rhsCount].every(Number.isSafeInteger)
    || dimension < 0 || nonZeros < 0 || rhsCount < 1) return Number.POSITIVE_INFINITY;

  const matrix = nonZeros * (Float64Array.BYTES_PER_ELEMENT + Uint32Array.BYTES_PER_ELEMENT)
    + (dimension + 1) * Uint32Array.BYTES_PER_ELEMENT;
  const factorReserve = nonZeros * 16;
  const workVectors = dimension * (rhsCount + 2) * Float64Array.BYTES_PER_ELEMENT;
  const permutation = dimension * Uint32Array.BYTES_PER_ELEMENT;
  const total = matrix + factorReserve + workVectors + permutation + 8;
  return Number.isSafeInteger(total) ? total : Number.POSITIVE_INFINITY;
};

export type AnalysisAdmission =
  | { readonly accepted: true; readonly estimatedBytes: number; readonly availableBytes: number }
  | {
    readonly accepted: false;
    readonly estimatedBytes: number;
    readonly availableBytes: number;
    readonly reason: 'memory-budget';
  };

export const assessAnalysisAdmission = (
  estimatedBytes: number,
  budget: AnalysisBudget,
): AnalysisAdmission => {
  const accepted = Number.isFinite(estimatedBytes)
    && estimatedBytes >= 0
    && Number.isFinite(budget.maxEstimatedBytes)
    && budget.maxEstimatedBytes >= 0
    && estimatedBytes <= budget.maxEstimatedBytes;
  return accepted
    ? { accepted: true, estimatedBytes, availableBytes: budget.maxEstimatedBytes }
    : { accepted: false, estimatedBytes, availableBytes: budget.maxEstimatedBytes, reason: 'memory-budget' };
};
