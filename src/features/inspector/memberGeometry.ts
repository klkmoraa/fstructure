import type { MemberModel, NodeModel } from '../../types';
import { circularMemberGeometry } from '../../graphics/memberCurve';

/** Lo que el Inspector dice de la forma de una barra. */
export interface MemberGeometrySummary {
  /** Longitud real de la barra: el arco si es curva, la recta si no. */
  readonly length: number;
  /** Ángulo de la cuerda i → j, en grados. */
  readonly angleDeg: number;
  /** Sólo en barras curvas: distancia recta entre extremos y radio del arco. */
  readonly arc?: { readonly chord: number; readonly radius: number };
}

/**
 * Longitud y ángulo de una barra. En una curva la longitud es la del arco —la
 * que miden las cargas, los diagramas y el peso propio—; la cuerda queda como
 * dato secundario junto al radio.
 */
export const memberGeometrySummary = (
  member: Pick<MemberModel, 'curve'>,
  i: Pick<NodeModel, 'x' | 'y'> | undefined,
  j: Pick<NodeModel, 'x' | 'y'> | undefined,
): MemberGeometrySummary => {
  if (!i || !j) return { length: Number.NaN, angleDeg: Number.NaN };
  const chord = Math.hypot(j.x - i.x, j.y - i.y);
  const angleDeg = Math.atan2(j.y - i.y, j.x - i.x) * 180 / Math.PI;
  let arc: ReturnType<typeof circularMemberGeometry>;
  try { arc = chord > 1e-10 ? circularMemberGeometry(member, i, j) : undefined; } catch { arc = undefined; }
  return arc
    ? { length: arc.length, angleDeg, arc: { chord, radius: arc.radius } }
    : { length: chord, angleDeg };
};
