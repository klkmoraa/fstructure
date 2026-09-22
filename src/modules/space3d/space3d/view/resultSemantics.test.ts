import { describe, expect, it } from 'vitest';
import type { Space3DMemberResult } from '../model/types';
import { deriveSpace3DMemberAxialAction } from './resultSemantics';

const memberResult = (startN: number, endN: number): Space3DMemberResult => ({
  memberId: 'M1',
  length: 1,
  basis: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
  start: { N: startN, Vy: 0, Vz: 0, T: 0, My: 0, Mz: 0 },
  end: { N: endN, Vy: 0, Vz: 0, T: 0, My: 0, Mz: 0 },
});

describe('Space 3D result semantics', () => {
  it('presents tension as positive and compression as negative', () => {
    expect(deriveSpace3DMemberAxialAction(memberResult(-10, 10))).toBe(10);
    expect(deriveSpace3DMemberAxialAction(memberResult(10, -10))).toBe(-10);
  });
});
