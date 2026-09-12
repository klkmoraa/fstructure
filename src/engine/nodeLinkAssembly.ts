import type { NodeLink } from '../types';
import { type Matrix } from '../foundation/linearAlgebra';

/** Linearized force r = tangentStiffness * delta + constantForce for one link. */
export interface LinkLinearization {
  tangentStiffness: number;
  constantForce: number;
  active: boolean;
}

export const linkRelativeDisplacement = (
  link: NodeLink,
  displacements: readonly number[],
  nodeIndex: ReadonlyMap<string, number>,
): number => {
  const angle = ((link.angleDeg ?? 0) * Math.PI) / 180;
  const nx = Math.cos(angle); const ny = Math.sin(angle);
  const i = nodeIndex.get(link.nodeI);
  if (i === undefined) return Number.NaN;
  let delta = nx * displacements[i * 3] + ny * displacements[i * 3 + 1];
  if (link.nodeJ) {
    const j = nodeIndex.get(link.nodeJ);
    if (j === undefined) return Number.NaN;
    delta = nx * (displacements[j * 3] - displacements[i * 3]) + ny * (displacements[j * 3 + 1] - displacements[i * 3 + 1]);
  }
  return delta;
};

/**
 * Active-set tangent for unilateral contacts, clearance stops and regularized
 * Coulomb friction. Friction keeps a very small post-slip tangent solely to
 * make the static equilibrium well-posed; its reported force is capped.
 */
export const linearizeNodeLink = (link: NodeLink, delta = 0): LinkLinearization => {
  const stiffness = link.stiffness;
  if (link.behavior === 'linear') return { tangentStiffness: stiffness, constantForce: 0, active: true };
  if (link.behavior === 'friction') {
    const limit = link.slipForce ?? 0;
    const elastic = stiffness * delta;
    if (Math.abs(elastic) <= limit) return { tangentStiffness: stiffness, constantForce: 0, active: true };
    const tangentStiffness = Math.max(stiffness * 1e-8, 1e-12);
    return { tangentStiffness, constantForce: Math.sign(elastic) * limit - tangentStiffness * delta, active: true };
  }
  const clearance = link.clearance ?? 0;
  if (link.behavior === 'compression-only') {
    return delta < -clearance ? { tangentStiffness: stiffness, constantForce: stiffness * clearance, active: true } : { tangentStiffness: 0, constantForce: 0, active: false };
  }
  if (link.behavior === 'tension-only') {
    return delta > clearance ? { tangentStiffness: stiffness, constantForce: -stiffness * clearance, active: true } : { tangentStiffness: 0, constantForce: 0, active: false };
  }
  if (delta > clearance) return { tangentStiffness: stiffness, constantForce: -stiffness * clearance, active: true };
  if (delta < -clearance) return { tangentStiffness: stiffness, constantForce: stiffness * clearance, active: true };
  return { tangentStiffness: 0, constantForce: 0, active: false };
};

/** Adds one directional link to K and its offset force to F. */
export const assembleNodeLink = (
  K: Matrix,
  F: number[],
  link: NodeLink,
  nodeIndex: ReadonlyMap<string, number>,
  linearization: LinkLinearization,
  linearizationOffsets?: number[],
): void => {
  if (!linearization.active || !(linearization.tangentStiffness > 0)) return;
  const angle = ((link.angleDeg ?? 0) * Math.PI) / 180;
  const nx = Math.cos(angle); const ny = Math.sin(angle);
  const i = nodeIndex.get(link.nodeI);
  if (i === undefined) return;
  const terms: Array<[number, number]> = [[i * 3, nx], [i * 3 + 1, ny]];
  if (link.nodeJ) {
    const j = nodeIndex.get(link.nodeJ);
    if (j === undefined) return;
    terms[0][1] *= -1; terms[1][1] *= -1;
    terms.push([j * 3, nx], [j * 3 + 1, ny]);
  }
  for (const [row, rowCoefficient] of terms) {
    const offset = -linearization.constantForce * rowCoefficient;
    F[row] += offset;
    if (linearizationOffsets) linearizationOffsets[row] += offset;
    for (const [column, columnCoefficient] of terms) K[row][column] += linearization.tangentStiffness * rowCoefficient * columnCoefficient;
  }
};
