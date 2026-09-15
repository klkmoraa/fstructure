import type { AnalysisQuality } from '../shared/contracts';
import { solveLinearSystem, type Matrix } from '../foundation/linearAlgebra';

export interface SparseMatrixCSC {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly columnPointers: readonly number[];
  readonly rowIndices: readonly number[];
  readonly values: readonly number[];
}

export interface SparseMatrixCSR {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly rowPointers: readonly number[];
  readonly columnIndices: readonly number[];
  readonly values: readonly number[];
}

export class SparseMatrixFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SparseMatrixFormatError';
  }
}

const validateCompressed = (
  rowCount: number,
  columnCount: number,
  pointers: readonly number[],
  indices: readonly number[],
  values: readonly number[],
  majorCount: number,
  minorCount: number,
): void => {
  if (!Number.isSafeInteger(rowCount) || !Number.isSafeInteger(columnCount) || rowCount < 0 || columnCount < 0) {
    throw new SparseMatrixFormatError('Sparse matrix dimensions must be non-negative safe integers.');
  }
  if (pointers.length !== majorCount + 1 || pointers[0] !== 0 || pointers[pointers.length - 1] !== values.length) {
    throw new SparseMatrixFormatError('Compressed pointers do not span the value array.');
  }
  if (indices.length !== values.length || values.some((value) => !Number.isFinite(value))) {
    throw new SparseMatrixFormatError('Sparse indices and finite values must have the same length.');
  }
  for (let index = 0; index < pointers.length; index += 1) {
    if (!Number.isSafeInteger(pointers[index]) || pointers[index] < 0
      || (index > 0 && pointers[index] < pointers[index - 1])) {
      throw new SparseMatrixFormatError('Compressed pointers must be monotonic safe integers.');
    }
  }
  if (indices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= minorCount)) {
    throw new SparseMatrixFormatError('Sparse index is outside the matrix dimensions.');
  }
};

export const validateCscMatrix = (matrix: SparseMatrixCSC): void => {
  validateCompressed(
    matrix.rowCount,
    matrix.columnCount,
    matrix.columnPointers,
    matrix.rowIndices,
    matrix.values,
    matrix.columnCount,
    matrix.rowCount,
  );
};

export const validateCsrMatrix = (matrix: SparseMatrixCSR): void => {
  validateCompressed(
    matrix.rowCount,
    matrix.columnCount,
    matrix.rowPointers,
    matrix.columnIndices,
    matrix.values,
    matrix.rowCount,
    matrix.columnCount,
  );
};

export const csrToCsc = (matrix: SparseMatrixCSR): SparseMatrixCSC => {
  validateCsrMatrix(matrix);
  const counts = Array.from<number>({ length: matrix.columnCount }).fill(0);
  for (const column of matrix.columnIndices) counts[column] += 1;
  const columnPointers = Array.from<number>({ length: matrix.columnCount + 1 }).fill(0);
  for (let column = 0; column < matrix.columnCount; column += 1) {
    columnPointers[column + 1] = columnPointers[column] + counts[column];
  }
  const next = columnPointers.slice(0, -1);
  const rowIndices = Array.from<number>({ length: matrix.values.length });
  const values = Array.from<number>({ length: matrix.values.length });
  for (let row = 0; row < matrix.rowCount; row += 1) {
    for (let index = matrix.rowPointers[row]; index < matrix.rowPointers[row + 1]; index += 1) {
      const column = matrix.columnIndices[index];
      const destination = next[column]++;
      rowIndices[destination] = row;
      values[destination] = matrix.values[index];
    }
  }
  return { rowCount: matrix.rowCount, columnCount: matrix.columnCount, columnPointers, rowIndices, values };
};

export const cscToDense = (matrix: SparseMatrixCSC): Matrix => {
  validateCscMatrix(matrix);
  const dense = Array.from(
    { length: matrix.rowCount },
    () => Array.from<number>({ length: matrix.columnCount }).fill(0),
  );
  for (let column = 0; column < matrix.columnCount; column += 1) {
    for (let index = matrix.columnPointers[column]; index < matrix.columnPointers[column + 1]; index += 1) {
      dense[matrix.rowIndices[index]][column] += matrix.values[index];
    }
  }
  return dense;
};

export const createAnalysisQuality = (
  conditionEstimate: number,
  linearResidual: number,
  equilibriumResidual: number,
): AnalysisQuality => {
  const finite = [conditionEstimate, linearResidual, equilibriumResidual].every(Number.isFinite);
  const level: AnalysisQuality['level'] = !finite
    ? 'failed'
    : conditionEstimate <= 1e10 && linearResidual <= 1e-12 && equilibriumResidual <= 1e-8
      ? 'stable'
      : conditionEstimate <= 1e12 && linearResidual <= 1e-8 && equilibriumResidual <= 1e-6
        ? 'limited'
        : 'unreliable';
  return { conditionEstimate, linearResidual, equilibriumResidual, level };
};

export interface SparseSolveResult {
  readonly solution: number[];
  readonly backend: 'dense-reference';
  readonly quality: AnalysisQuality;
}

/**
 * Public small-model reference adapter. It preserves the established dense
 * solver and is deliberately labelled so it cannot be mistaken for WASM/faer.
 */
export const solveCscWithDenseReference = (
  matrix: SparseMatrixCSC,
  rhs: readonly number[],
): SparseSolveResult => {
  if (matrix.rowCount !== matrix.columnCount || rhs.length !== matrix.rowCount) {
    throw new SparseMatrixFormatError('Sparse linear system dimensions are incompatible.');
  }
  const dense = cscToDense(matrix);
  const solved = solveLinearSystem(dense, [...rhs], { backend: 'dense' });
  return {
    solution: solved.x,
    backend: 'dense-reference',
    quality: createAnalysisQuality(solved.conditionEstimate, solved.relativeResidual, solved.relativeResidual),
  };
};
