/**
 * @deprecated Import numerical primitives from `../foundation/linearAlgebra`.
 *
 * This adapter preserves the established 2D error messages while consumers
 * migrate. New product code must use the Foundation entry point directly.
 */
import {
  LinearAlgebraError,
  __testables as foundationTestables,
  multiply as multiplyFoundation,
  solveLinearSystem as solveFoundation,
} from '../foundation/linearAlgebra';
import type {
  LinearSolveResult,
  LinearSolverPolicy,
  Matrix,
} from '../foundation/linearAlgebra';

/** @deprecated Import numerical primitives from `foundation/linearAlgebra`. */
export {
  addToMatrix,
  addToVector,
  findNullSpaceVector,
  maxAbs,
  multiplyMatrixVector,
  submatrix,
  subvector,
  transpose,
  zeros,
} from '../foundation/linearAlgebra';
/** @deprecated Import numerical types from `foundation/linearAlgebra`. */
export type {
  LinearSolveResult,
  LinearSolverBackend,
  LinearSolverDiagnostics,
  LinearSolverFallbackReason,
  LinearSolverPolicy,
  Matrix,
  NullSpaceResult,
  SparseMatrixCSR,
} from '../foundation/linearAlgebra';

/** @deprecated Import test-only internals from `foundation/linearAlgebra`. */
export const __testables = {
  findSingleDofConstraints: foundationTestables.findSingleVariableConstraints,
  reverseCuthillMcKee: foundationTestables.reverseCuthillMcKee,
  buildLowerCSR: foundationTestables.buildLowerCSR,
  symbolicLDLT: foundationTestables.symbolicLDLT,
  numericLDLT: foundationTestables.numericLDLT,
  solveLDLT: foundationTestables.solveLDLT,
  buildHybridSolver: foundationTestables.buildHybridSolver,
  SPARSE_MIN_SIZE: foundationTestables.SPARSE_MIN_SIZE,
};

const legacyError = (error: unknown): unknown => {
  if (!(error instanceof LinearAlgebraError)) return error;
  switch (error.code) {
    case 'dimension-mismatch':
      return new Error('Dimensiones incompatibles en multiplicación de matrices.');
    case 'non-square-system':
      return new Error('El sistema lineal no es cuadrado.');
    case 'non-finite-value':
      return new Error('El sistema lineal contiene valores no finitos.');
    case 'singular':
      return new Error(`La matriz es singular o existe un mecanismo estructural cerca del grado de libertad ${(error.pivotIndex ?? 0) + 1}.`);
  }
};

/** @deprecated Import `multiply` from `foundation/linearAlgebra`. */
export const multiply = (a: Matrix, b: Matrix): Matrix => {
  try {
    return multiplyFoundation(a, b);
  } catch (error) {
    throw legacyError(error);
  }
};

/** @deprecated Import `solveLinearSystem` from `foundation/linearAlgebra`. */
export const solveLinearSystem = (
  matrix: Matrix,
  vector: number[],
  options: { backend?: LinearSolverPolicy } = {},
): LinearSolveResult => {
  try {
    return solveFoundation(matrix, vector, options);
  } catch (error) {
    throw legacyError(error);
  }
};
