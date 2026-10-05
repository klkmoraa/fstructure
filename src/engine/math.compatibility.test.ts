import { describe, expect, it } from 'vitest';

import * as foundation from '../foundation/linearAlgebra';
import * as legacyMath from './math';

describe('engine/math compatibility adapter', () => {
  it('keeps the historical numerical surface while delegating to Foundation', () => {
    expect(Object.keys(legacyMath).sort()).toEqual([
      '__testables', 'addToMatrix', 'addToVector', 'findNullSpaceVector', 'maxAbs',
      'multiply', 'multiplyMatrixVector', 'solveLinearSystem', 'submatrix', 'subvector',
      'transpose', 'zeros',
    ]);
    expect(Object.keys(legacyMath.__testables).sort()).toEqual([
      'SPARSE_MIN_SIZE', 'buildHybridSolver', 'buildLowerCSR', 'findSingleDofConstraints',
      'numericLDLT', 'reverseCuthillMcKee', 'solveLDLT', 'symbolicLDLT',
    ]);
    expect(legacyMath.zeros(1, 2)).toEqual(foundation.zeros(1, 2));
    expect(legacyMath.solveLinearSystem([[3, 1], [2, 4]], [7, 10]))
      .toEqual(foundation.solveLinearSystem([[3, 1], [2, 4]], [7, 10]));
    expect(legacyMath.__testables.findSingleDofConstraints)
      .toBe(foundation.__testables.findSingleVariableConstraints);
  });

  it('translates structured Foundation errors to the established 2D messages', () => {
    expect(() => legacyMath.multiply([[1]], [[1], [2]]))
      .toThrow('Dimensiones incompatibles en multiplicación de matrices.');
    expect(() => legacyMath.solveLinearSystem([], []))
      .toThrow('El sistema lineal no es cuadrado.');
    expect(() => legacyMath.solveLinearSystem([[1, 0], [0, 1]], [Number.NaN, 1]))
      .toThrow('El sistema lineal contiene valores no finitos.');
    expect(() => legacyMath.solveLinearSystem([[1, 2], [2, 4]], [1, 2]))
      .toThrow('La matriz es singular o existe un mecanismo estructural cerca del grado de libertad 2.');
  });
});
