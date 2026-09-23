import { describe, expect, it } from 'vitest';
import type { Space3DMemberResult } from '../model/types';
import {
  deriveSpace3DMemberAxialAction,
  deriveSpace3DMemberMomentMagnitude,
  deriveSpace3DMemberShearMagnitude,
} from './resultSemantics';

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

  it('uses peak resultant shear and bending moment across both ends', () => {
    const result = {
      ...memberResult(-10, 10),
      start: { N: -10, Vy: 3, Vz: 4, T: 0, My: 5, Mz: 12 },
      end: { N: 10, Vy: 6, Vz: 8, T: 0, My: 8, Mz: 15 },
    } satisfies Space3DMemberResult;

    expect(deriveSpace3DMemberShearMagnitude(result)).toBe(10);
    expect(deriveSpace3DMemberMomentMagnitude(result)).toBe(17);
  });
});
