import type { AnalysisBudget } from '../shared/contracts';

export const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const MINIMUM_BUDGET_BYTES = 128 * MEBIBYTE;
const MAXIMUM_BUDGET_BYTES = 2 * GIBIBYTE;
const FALLBACK_BUDGET_BYTES = 256 * MEBIBYTE;
const DEFAULT_SOFT_DEADLINE_MS = 30_000;

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

interface SparseLinearSystemShape {
  readonly dimension: number;
  readonly nonZeros: number;
  readonly rhsCount?: number;
}

/**
 * Pessimistic pre-allocation bound. It includes two JS/structured-clone input
 * copies, typed-array/WASM transit, Rust triplets, faer sparse input,
 * permutations/work vectors and worst-case dense LU fill. This can reject a
 * sparse model that a future symbolic estimator would admit, but it cannot
 * silently assume that fill remains proportional to input nnz.
 *
 * The estimate is arithmetic-only and uses bigint to detect overflow before
 * any matrix, typed array or worker is allocated.
 */
export const estimateSparseLinearSystemBytes = ({
  dimension,
  nonZeros,
  rhsCount = 1,
}: SparseLinearSystemShape): number => {
  if (![dimension, nonZeros, rhsCount].every(Number.isSafeInteger)
    || dimension <= 0 || nonZeros < 0 || rhsCount < 1) return Number.POSITIVE_INFINITY;

  const n = BigInt(dimension);
  const nnz = BigInt(nonZeros);
  const rhs = BigInt(rhsCount);
  const jsAndClone = 2n * ((2n * nnz + n + 1n + n * rhs) * 16n);
  const typedAndWasmTransit = 2n * (nnz * 12n + (n + 1n) * 4n + n * rhs * 8n);
  const rustTriplets = nnz * 24n;
  const faerSparseInput = nnz * 24n + (n + 1n) * 16n;
  const potentialDenseFill = n * n * 48n;
  const solveWorkspace = n * (rhs + 8n) * 8n;
  const total = 8n * BigInt(MEBIBYTE)
    + jsAndClone
    + typedAndWasmTransit
    + rustTriplets
    + faerSparseInput
    + potentialDenseFill
    + solveWorkspace;
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : Number.POSITIVE_INFINITY;
};

type AnalysisAdmission =
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
