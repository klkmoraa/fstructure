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

/** Peak resultant shear magnitude across both member ends, kN. */
export const deriveSpace3DMemberShearMagnitude = (result: Space3DMemberResult): number =>
  Math.max(
    Math.hypot(result.start.Vy, result.start.Vz),
    Math.hypot(result.end.Vy, result.end.Vz),
  );

/** Peak resultant bending-moment magnitude across both member ends, kN·m. */
export const deriveSpace3DMemberMomentMagnitude = (result: Space3DMemberResult): number =>
  Math.max(
    Math.hypot(result.start.My, result.start.Mz),
    Math.hypot(result.end.My, result.end.Mz),
  );
