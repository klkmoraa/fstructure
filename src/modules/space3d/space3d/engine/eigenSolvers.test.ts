/**
 * Lanczos con inversión contra la cadena de muelles y masas, cuyos
 * autovalores son conocidos: con N masas m, N muelles k y un extremo fijo,
 * λⱼ = (4k/m)·sin²((2j−1)·π / (2·(2N+1))).
 */
import { describe, expect, it } from 'vitest';
import { smallestGeneralizedEigenpairs, symmetricTridiagonalEigen } from './eigenSolvers';
import { addToSkyline, cloneSkyline, countSkylineNegativePivots, createSkylineMatrix, factorizeSkyline, type Space3DSkylineMatrix } from './skylineSolver';

/** Una o varias cadenas desacopladas, una detrás de otra en la numeración. */
const chains = (count: number, N: number, k: number) => {
  const n = count * N;
  const first = new Int32Array(n);
  for (let i = 0; i < n; i += 1) first[i] = i % N === 0 ? i : i - 1;
  const matrix = createSkylineMatrix(first);
  for (let c = 0; c < count; c += 1) {
    for (let i = 0; i < N; i += 1) {
      const row = c * N + i;
      addToSkyline(matrix, row, row, i === N - 1 ? k : 2 * k);
      if (i > 0) addToSkyline(matrix, row, row - 1, -k);
    }
  }
  return matrix;
};

const solveWith = (stiffness: Space3DSkylineMatrix, mass: number) => {
  const factorization = factorizeSkyline(cloneSkyline(stiffness));
  return {
    n: stiffness.n,
    solve: (rhs: Float64Array) => factorization.solve(rhs),
    applyB: (vector: Float64Array) => vector.map((value) => value * mass),
    sturmCount: (sigma: number) => {
      const shifted = cloneSkyline(stiffness);
      for (let i = 0; i < shifted.n; i += 1) addToSkyline(shifted, i, i, -sigma * mass);
      return countSkylineNegativePivots(shifted);
    },
  };
};

const exact = (N: number, k: number, m: number, j: number) => (4 * k / m) * Math.sin(((2 * j - 1) * Math.PI) / (2 * (2 * N + 1))) ** 2;

describe('Space3D eigen solvers', () => {
  it('diagonalizes a symmetric tridiagonal matrix', () => {
    // [2 −1 0; −1 2 −1; 0 −1 2]: 2 − 2cos(jπ/4).
    const { values, vectors } = symmetricTridiagonalEigen([2, 2, 2], [-1, -1]);
    const sorted = [...values].sort((a, b) => a - b);
    [1, 2, 3].forEach((j, index) => expect(sorted[index]).toBeCloseTo(2 - 2 * Math.cos((j * Math.PI) / 4), 13));
    for (const vector of vectors) expect(Math.hypot(...vector)).toBeCloseTo(1, 13);
  });

  it('finds the lowest modes of a 400-mass chain and verifies them with Sturm', () => {
    const N = 400; const k = 1500; const m = 2.5;
    const result = smallestGeneralizedEigenpairs({ ...solveWith(chains(1, N, k), m), count: 6 });
    expect(result.converged).toBe(true);
    expect(result.sturmVerified).toBe(true);
    result.pairs.forEach((pair, index) => expect(pair.value / exact(N, k, m, index + 1)).toBeCloseTo(1, 9));
    // Normalizados en masa: φᵀ·M·φ = 1.
    for (const pair of result.pairs) expect(pair.vector.reduce((sum, value) => sum + m * value * value, 0)).toBeCloseTo(1, 10);
    expect(result.steps).toBeLessThan(120);
  });

  it('recovers every copy of a repeated eigenvalue (a symmetric building has equal X and Z periods)', () => {
    const N = 60; const k = 800; const m = 1.2;
    const result = smallestGeneralizedEigenpairs({ ...solveWith(chains(2, N, k), m), count: 4 });
    expect(result.sturmVerified).toBe(true);
    const expected = [1, 1, 2, 2].map((j) => exact(N, k, m, j));
    result.pairs.forEach((pair, index) => expect(pair.value / expected[index]).toBeCloseTo(1, 9));
  });
});
