import initFaerWasm, { solve_csc as solveCsc } from './wasm/fstructure_numeric_core.js';
import {
  createAnalysisQuality,
  validateCscMatrix,
  type SparseMatrixCSC,
} from './sparse';

export interface FaerWasmSolveResult {
  readonly solution: number[];
  readonly backend: 'faer-wasm';
  readonly quality: ReturnType<typeof createAnalysisQuality>;
  readonly qualityEvidence: {
    readonly equilibrium: 'algebraic-only';
  };
}

let initialized = false;
let initialization: Promise<unknown> | null = null;

const initialize = (moduleBytes?: BufferSource): Promise<unknown> => {
  if (initialized) return Promise.resolve();
  if (!initialization) {
    initialization = initFaerWasm(moduleBytes === undefined ? undefined : { module_or_path: moduleBytes })
      .then((output) => {
        initialized = true;
        return output;
      })
      .catch((error: unknown) => {
        initialization = null;
        throw error;
      });
  }
  return initialization;
};

/** Runs the gated faer 0.24.4 CSC solver; it never falls back to dense silently. */
export const solveCscWithFaerWasm = async (
  matrix: SparseMatrixCSC,
  rhs: readonly number[],
  moduleBytes?: BufferSource,
): Promise<FaerWasmSolveResult> => {
  validateCscMatrix(matrix);
  if (matrix.rowCount !== matrix.columnCount || rhs.length !== matrix.rowCount) {
    throw new Error('Sparse linear system dimensions are incompatible.');
  }
  if (rhs.some((value) => !Number.isFinite(value))) {
    throw new Error('Sparse right-hand side must contain only finite values.');
  }
  await initialize(moduleBytes);
  const packed = Array.from(solveCsc(
    matrix.rowCount,
    Uint32Array.from(matrix.columnPointers),
    Uint32Array.from(matrix.rowIndices),
    Float64Array.from(matrix.values),
    Float64Array.from(rhs),
  ));
  return decodeFaerWasmResult(matrix.rowCount, packed);
};

/** Validates every value crossing from WebAssembly before it can be published. */
export const decodeFaerWasmResult = (
  dimension: number,
  packed: readonly number[],
): FaerWasmSolveResult => {
  if (!Number.isSafeInteger(dimension) || dimension <= 0 || packed.length !== dimension + 3) {
    throw new Error('faer WASM returned an incompatible result envelope.');
  }
  const solution = packed.slice(0, dimension);
  if (solution.some((value) => !Number.isFinite(value))) {
    throw new Error('faer WASM returned a non-finite solution.');
  }
  const [conditionEstimate, linearResidual, algebraicEquilibriumResidual] = packed.slice(dimension);
  if (![conditionEstimate, linearResidual, algebraicEquilibriumResidual]
    .every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error('faer WASM returned non-finite or invalid metrics.');
  }
  const algebraicQuality = createAnalysisQuality(
    conditionEstimate,
    linearResidual,
    algebraicEquilibriumResidual,
  );
  return {
    solution,
    backend: 'faer-wasm',
    quality: {
      ...algebraicQuality,
      level: algebraicQuality.level === 'stable' ? 'limited' : algebraicQuality.level,
    },
    qualityEvidence: { equilibrium: 'algebraic-only' },
  };
};
