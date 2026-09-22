import type { Space3DMemberResult } from '../model/types';

/**
 * Signed member axial action for presentation, tension positive.
 *
 * Solver end forces are local end actions and therefore have opposite signs for
 * a constant axial state. The antisymmetric component is the member action that
 * the result UI should present consistently.
 */
export const deriveSpace3DMemberAxialAction = (result: Space3DMemberResult): number =>
  (result.end.N - result.start.N) / 2;
