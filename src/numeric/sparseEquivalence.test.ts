/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { solveLinearSystem } from '../foundation/linearAlgebra';
import { solveCscWithFaerWasm } from './faerWasmBackend';
import type { SparseMatrixCSC } from './sparse';

describe('small dense/sparse differential reference', () => {
  it('matches the established dense solver through the real faer WASM CSC boundary', async () => {
    const csc: SparseMatrixCSC = {
      rowCount: 3,
      columnCount: 3,
      columnPointers: [0, 2, 5, 7],
      rowIndices: [0, 1, 0, 1, 2, 1, 2],
      values: [4, 1, 1, 3, 1, 1, 2],
    };
    const rhs = [6, 10, 8];
    const dense = solveLinearSystem([
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ], rhs, { backend: 'dense' });
    const wasm = readFileSync(new URL('./wasm/fstructure_numeric_core_bg.wasm', import.meta.url));
    const sparse = await solveCscWithFaerWasm(csc, rhs, wasm);

    expect(dense.x[0]).toBeCloseTo(1, 12);
    expect(dense.x[1]).toBeCloseTo(2, 12);
    expect(dense.x[2]).toBeCloseTo(3, 12);
    sparse.solution.forEach((value, index) => expect(value).toBeCloseTo(dense.x[index], 12));
    expect(sparse.backend).toBe('faer-wasm');
    expect(sparse.quality.level).toBe('stable');
    expect(sparse.quality.linearResidual).toBeLessThan(1e-12);
  });
});
