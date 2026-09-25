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

/**
 * Peak resultant shear magnitude along the member, kN. With stations (member
 * loads make the shear vary inside the span) the peak is taken over them;
 * without, over both ends.
 */
export const deriveSpace3DMemberShearMagnitude = (result: Space3DMemberResult): number =>
  result.stations && result.stations.length > 0
    ? Math.max(...result.stations.map((station) => Math.hypot(station.Vy, station.Vz)))
    : Math.max(
      Math.hypot(result.start.Vy, result.start.Vz),
      Math.hypot(result.end.Vy, result.end.Vz),
    );

/**
 * Peak resultant bending-moment magnitude along the member, kN·m: the span
 * moment of a loaded beam is often larger than its end moments.
 */
export const deriveSpace3DMemberMomentMagnitude = (result: Space3DMemberResult): number =>
  result.stations && result.stations.length > 0
    ? Math.max(...result.stations.map((station) => Math.hypot(station.My, station.Mz)))
    : Math.max(
      Math.hypot(result.start.My, result.start.Mz),
      Math.hypot(result.end.My, result.end.Mz),
    );
