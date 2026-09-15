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
  await initialize(moduleBytes);
  const packed = Array.from(solveCsc(
    matrix.rowCount,
    Uint32Array.from(matrix.columnPointers),
    Uint32Array.from(matrix.rowIndices),
    Float64Array.from(matrix.values),
    Float64Array.from(rhs),
  ));
  if (packed.length !== matrix.rowCount + 3) {
    throw new Error('faer WASM returned an incompatible result envelope.');
  }
  const solution = packed.slice(0, matrix.rowCount);
  const [conditionEstimate, linearResidual, equilibriumResidual] = packed.slice(matrix.rowCount);
  return {
    solution,
    backend: 'faer-wasm',
    quality: createAnalysisQuality(conditionEstimate, linearResidual, equilibriumResidual),
  };
};
