import type { LoadCoordinateSystem, MemberLoad, MemberModel, NodeModel } from '../types';
import { circularMemberGeometry, curvePointAt, curveRatioAtPoint, curveTangentAt, curveBoundsPoints, type CircularArcGeometry } from './memberCurve';

interface Vec2 { x: number; y: number }
interface ModelBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface MemberAxis {
  readonly start: Vec2; readonly end: Vec2; readonly dx: number; readonly dy: number;
  readonly length: number; readonly c: number; readonly s: number; readonly normal: Vec2;
  readonly startOffset: number; readonly endOffset: number; readonly flexibleLength: number;
  readonly curve?: CircularArcGeometry;
}

/** c/s remain the chord basis for global displacement components; curve stations use their tangent. */
export const memberAxis = (member: MemberModel, i: NodeModel, j: NodeModel): MemberAxis => {
  const dx = j.x - i.x, dy = j.y - i.y, chord = Math.hypot(dx, dy);
  const c = dx / chord, s = dy / chord;
  const curve = circularMemberGeometry(member, i, j);
  const length = curve?.length ?? chord;
  const startOffset = member.rigidOffsetI ?? 0, endOffset = member.rigidOffsetJ ?? 0;
  return { start: { x: i.x, y: i.y }, end: { x: j.x, y: j.y }, dx, dy, length, c, s,
    normal: { x: -s, y: c }, startOffset, endOffset, flexibleLength: length - startOffset - endOffset,
    ...(curve ? { curve } : {}) };
};
export const grossRatioFromFlexible = (axis: MemberAxis, flexibleRatio: number): number => {
  const flexibleLength = Math.max(axis.flexibleLength, 0);
  return axis.length > 0 ? (axis.startOffset + flexibleRatio * flexibleLength) / axis.length : flexibleRatio;
};
export const flexibleRatioFromGross = (axis: MemberAxis, grossRatio: number): number => {
  const flexibleLength = Math.max(axis.flexibleLength, 1e-12);
  return Math.min(1, Math.max(0, (grossRatio * axis.length - axis.startOffset) / flexibleLength));
};
export const grossRatioAtPoint = (axis: MemberAxis, point: Vec2): number => {
  if (axis.curve) return curveRatioAtPoint(axis.curve, point);
  const projected = ((point.x - axis.start.x) * axis.dx + (point.y - axis.start.y) * axis.dy) / (axis.dx * axis.dx + axis.dy * axis.dy);
  return Math.min(1, Math.max(0, projected));
};
export const pointAtGrossRatio = (axis: MemberAxis, ratio: number): Vec2 => axis.curve ? curvePointAt(axis.curve, ratio) : ({
  x: axis.start.x + axis.dx * ratio, y: axis.start.y + axis.dy * ratio,
});
export const lerpPoint = (from: Vec2, to: Vec2, ratio: number): Vec2 => ({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
export const toGlobalVector = (axis: MemberAxis, system: LoadCoordinateSystem, x: number, y: number, ratio = 0.5): [number, number] => {
  if (system !== 'local') return [x, y];
  const tangent = axis.curve ? curveTangentAt(axis.curve, ratio) : { x: axis.c, y: axis.s };
  return [tangent.x * x - tangent.y * y, tangent.y * x + tangent.x * y];
};
export const distributedIntensityAt = (load: MemberLoad, t: number): { qx: number; qy: number } => ({
  qx: (load.qxStart ?? 0) + ((load.qxEnd ?? load.qxStart ?? 0) - (load.qxStart ?? 0)) * t,
  qy: (load.qyStart ?? 0) + ((load.qyEnd ?? load.qyStart ?? 0) - (load.qyStart ?? 0)) * t,
});
export const modelBounds = (nodes: readonly Pick<NodeModel, 'x' | 'y'>[]): ModelBounds => {
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};
/** Includes extrema of arcs without adding any nudes to the model. */
export const structureBounds = (nodes: readonly NodeModel[], members: readonly MemberModel[]): ModelBounds => {
  const index = new Map(nodes.map(n => [n.id, n]));
  const points: Vec2[] = [...nodes];
  for (const member of members) {
    const i = index.get(member.i), j = index.get(member.j);
    if (!i || !j) continue;
    const arc = circularMemberGeometry(member, i, j);
    if (arc) points.push(...curveBoundsPoints(arc));
  }
  return modelBounds(points);
};
