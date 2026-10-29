import type { DiagramQuantity, MemberResult } from '../../types';
import { evaluatePolynomial } from '../../engine/diagram';
import { curvePointAt, curveTangentAt, type CircularArcGeometry } from '../../graphics/memberCurve';
import { diagramScreenPoint as straightPoint, diagramScreenPolyline as straightPolyline, type DiagramFrame as StraightFrame } from './straightResultGeometry';
export { reactionArrows, reactionClearanceFor } from './straightResultGeometry';
export interface DiagramFrame extends StraightFrame { axis: StraightFrame['axis'] & { curve?: CircularArcGeometry } }
export const diagramScreenPoint = (frame: DiagramFrame, x: number, value: number) => {
  const arc = frame.axis.curve;
  if (!arc) return straightPoint(frame, x, value);
  const ratio = ((frame.result.startOffset ?? 0) + x) / arc.length;
  const p = curvePointAt(arc, ratio), t = curveTangentAt(arc, ratio);
  const offset = value * frame.pixelScale * frame.side / frame.cameraScale;
  return frame.toScreen(p.x - t.y * offset, p.y + t.x * offset);
};
export const diagramBaselinePoint = (frame: DiagramFrame, x: number) => diagramScreenPoint(frame, x, 0);
export const diagramScreenPolyline = (frame: DiagramFrame, segments: MemberResult['diagramSegments'], quantity: DiagramQuantity) => {
  if (!frame.axis.curve) return straightPolyline(frame, segments, quantity);
  if (!segments.length) return [];
  const points = [diagramBaselinePoint(frame, 0)];
  for (const segment of segments) for (let k = 0; k <= 4; k++) {
    const xi = (segment.x1 - segment.x0) * k / 4;
    points.push(diagramScreenPoint(frame, segment.x0 + xi, evaluatePolynomial(segment[quantity], xi)));
  }
  points.push(diagramBaselinePoint(frame, frame.result.length));
  return points;
};
