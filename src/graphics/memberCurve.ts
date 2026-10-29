import type { MemberModel, NodeModel } from '../types';

/** Signed sagitta / half-chord. Positive is left of the directed i→j chord. */
export interface CircularMemberCurve { kind: 'circular-arc'; bulge: number }

declare module '../types' {
  interface MemberModel { curve?: CircularMemberCurve }
}

export interface CurvePoint { x: number; y: number }
export interface CircularArcGeometry {
  start: CurvePoint; end: CurvePoint; center: CurvePoint;
  radius: number; startAngle: number; sweep: number; length: number;
  chord: number; c: number; s: number;
}

export const validateMemberCurve = (value: unknown): CircularMemberCurve => {
  if (!value || typeof value !== 'object') throw new Error('La geometría de la barra curva no es válida.');
  const curve = value as Partial<CircularMemberCurve>;
  if (curve.kind !== 'circular-arc' || typeof curve.bulge !== 'number'
    || !Number.isFinite(curve.bulge) || Math.abs(curve.bulge) < 1e-8 || Math.abs(curve.bulge) > 1) {
    throw new Error('La barra curva requiere una flecha no nula y una apertura de hasta 180°.');
  }
  return { kind: 'circular-arc', bulge: curve.bulge };
};

export const circularMemberGeometry = (
  member: Pick<MemberModel, 'curve'>,
  i: CurvePoint,
  j: CurvePoint,
): CircularArcGeometry | undefined => {
  if (!member.curve) return undefined;
  const { bulge: b } = validateMemberCurve(member.curve);
  const dx = j.x - i.x, dy = j.y - i.y;
  const chord = Math.hypot(dx, dy);
  if (!Number.isFinite(chord) || chord <= 1e-10) throw new Error('La curva necesita dos nudos extremos distintos.');
  const c = dx / chord, s = dy / chord;
  const offset = chord * (b * b - 1) / (4 * b);
  const center = { x: (i.x + j.x) / 2 - s * offset, y: (i.y + j.y) / 2 + c * offset };
  const radius = chord * (1 + b * b) / (4 * Math.abs(b));
  const sweep = -4 * Math.atan(b);
  return { start: { ...i }, end: { ...j }, center, radius,
    startAngle: Math.atan2(i.y - center.y, i.x - center.x), sweep,
    length: radius * Math.abs(sweep), chord, c, s };
};

export const curvePointAt = (arc: CircularArcGeometry, ratio: number): CurvePoint => {
  if (ratio <= 0) return { ...arc.start };
  if (ratio >= 1) return { ...arc.end };
  const angle = arc.startAngle + arc.sweep * ratio;
  return { x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) };
};

export const curveTangentAt = (arc: CircularArcGeometry, ratio: number): CurvePoint => {
  const angle = arc.startAngle + arc.sweep * Math.max(0, Math.min(1, ratio));
  const sign = Math.sign(arc.sweep);
  return { x: -sign * Math.sin(angle), y: sign * Math.cos(angle) };
};

export const curveRatioAtPoint = (arc: CircularArcGeometry, point: CurvePoint): number => {
  const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
  const candidates = [-2, -1, 0, 1, 2].map(turn => Math.max(0, Math.min(1,
    (angle - arc.startAngle + turn * 2 * Math.PI) / arc.sweep)));
  return candidates.reduce((best, ratio) => {
    const a = curvePointAt(arc, best), b = curvePointAt(arc, ratio);
    return Math.hypot(b.x - point.x, b.y - point.y) < Math.hypot(a.x - point.x, a.y - point.y) ? ratio : best;
  }, 0);
};

/** Exact SVG circular arc under the canvas' uniform scale (including reflected Y). */
export const curvedMemberPath = (arc: CircularArcGeometry, toScreen: (x: number, y: number) => CurvePoint): string => {
  const a = toScreen(arc.start.x, arc.start.y), b = toScreen(arc.end.x, arc.end.y);
  const middle = curvePointAt(arc, 0.5), m = toScreen(middle.x, middle.y);
  const radius = arc.radius * Math.hypot(b.x - a.x, b.y - a.y) / arc.chord;
  const cross = (b.x - a.x) * (m.y - a.y) - (b.y - a.y) * (m.x - a.x);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 ${cross < 0 ? 1 : 0} ${b.x} ${b.y}`;
};

/** Geometry samples are NOT structural nodes and never enter ProjectModel.nodes. */
export const curveBoundsPoints = (arc: CircularArcGeometry): CurvePoint[] => {
  const points = [arc.start, arc.end];
  for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const point = { x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) };
    const ratio = curveRatioAtPoint(arc, point);
    if (ratio > 0 && ratio < 1) points.push(curvePointAt(arc, ratio));
  }
  return points;
};

export const memberCurveLength = (member: MemberModel, i: NodeModel, j: NodeModel): number =>
  circularMemberGeometry(member, i, j)?.length ?? Math.hypot(j.x - i.x, j.y - i.y);
