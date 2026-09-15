/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { solveLinearSystem } from '../foundation/linearAlgebra';
import { decodeFaerWasmResult, solveCscWithFaerWasm } from './faerWasmBackend';
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
    expect(sparse.quality.level).toBe('limited');
    expect(sparse.qualityEvidence.equilibrium).toBe('algebraic-only');
    expect(sparse.quality.linearResidual).toBeLessThan(1e-12);
  });

  it('rejects non-finite matrices, right-hand sides, solutions and metrics at the TS boundary', async () => {
    const wasm = readFileSync(new URL('./wasm/fstructure_numeric_core_bg.wasm', import.meta.url));
    const base: SparseMatrixCSC = {
      rowCount: 1,
      columnCount: 1,
      columnPointers: [0, 1],
      rowIndices: [0],
      values: [2],
    };

    await expect(solveCscWithFaerWasm({ ...base, values: [Number.NaN] }, [2], wasm)).rejects.toThrow(/finite/);
    await expect(solveCscWithFaerWasm(base, [Number.POSITIVE_INFINITY], wasm)).rejects.toThrow(/finite/);
    expect(() => decodeFaerWasmResult(1, [Number.NaN, 1, 0, 0])).toThrow(/solution/);
    expect(() => decodeFaerWasmResult(1, [1, Number.NaN, 0, 0])).toThrow(/metrics/);
  });
});
