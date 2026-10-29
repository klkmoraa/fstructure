import { roundGeneratedCoordinate as round } from './generatorSpacing';

export interface GeometryPoint { readonly x: number; readonly y: number }
export interface SegmentedGeometry {
  readonly points: readonly GeometryPoint[];
  /** Segment endpoints are consecutive points; closed paths connect last to first. */
  readonly closed: boolean;
}

const positive = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} debe ser finito y mayor que cero.`);
};
const divisions = (value: number, min: number): void => {
  if (!Number.isInteger(value) || value < min || value > 200) {
    throw new Error(`Las divisiones deben estar entre ${min} y 200.`);
  }
};
const point = (x: number, y: number): GeometryPoint => ({ x: round(x), y: round(y) });

/** Circular arc from span and rise, with endpoints on y=0 and crown at y=rise. */
export const circularArch = (span: number, rise: number, segments: number): SegmentedGeometry => {
  positive(span, 'El claro');
  positive(rise, 'La flecha');
  divisions(segments, 2);
  const radius = span * span / (8 * rise) + rise / 2;
  const cy = rise - radius;
  const start = Math.atan2(-cy, -span / 2);
  const end = Math.atan2(-cy, span / 2);
  const points = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = start + (end - start) * i / segments;
    return point(span / 2 + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  });
  // Exact endpoints avoid residual floating-point noise.
  points[0] = point(0, 0);
  points[segments] = point(span, 0);
  return { points, closed: false };
};

/** Circular ring with no duplicate closing node. */
export const circularRing = (radius: number, segments: number): SegmentedGeometry => {
  positive(radius, 'El radio');
  divisions(segments, 3);
  return {
    points: Array.from({ length: segments }, (_, i) => {
      const angle = 2 * Math.PI * i / segments;
      return point(radius * Math.cos(angle), radius * Math.sin(angle));
    }),
    closed: true,
  };
};

/** One- or two-slope portal outline, ordered from left base to right base. */
export const pitchedPortal = (
  span: number,
  leftHeight: number,
  rightHeight: number,
  ridge?: { readonly x: number; readonly y: number },
): SegmentedGeometry => {
  positive(span, 'El claro');
  positive(leftHeight, 'La altura izquierda');
  positive(rightHeight, 'La altura derecha');
  if (ridge && (!Number.isFinite(ridge.x) || !Number.isFinite(ridge.y)
    || ridge.x <= 0 || ridge.x >= span || ridge.y <= Math.max(leftHeight, rightHeight))) {
    throw new Error('La cumbrera debe estar dentro del claro y sobre ambas columnas.');
  }
  return {
    points: [
      point(0, 0), point(0, leftHeight),
      ...(ridge ? [point(ridge.x, ridge.y)] : []),
      point(span, rightHeight), point(span, 0),
    ],
    closed: false,
  };
};
