import type { AnalysisResult, DiagramQuantity, NodeModel } from '../../types';
import { segmentBezierControls } from '../../engine/diagram';

/**
 * Geometría en pantalla de lo que dibuja la capa de resultados: la curva de
 * cada diagrama y las flechas de reacción. La comparten el dibujo
 * (`CanvasResultLayer`) y el repartidor de etiquetas, que necesita los mismos
 * trazos para no poner una cifra encima de ellos.
 */
type MemberResult = AnalysisResult['memberResults'][number];
type NodeResult = AnalysisResult['nodeResults'][number];
type ScreenPoint = { x: number; y: number };
type ToScreen = (x: number, y: number) => ScreenPoint;

export const reactionClearanceFor = (type: NodeModel['support']['type']): { bottom: number; side: number } => ({
  bottom: type === 'roller' ? 28 : type === 'pin' || type === 'custom' ? 25 : type === 'fixed' ? 16 : 8,
  side: type === 'none' ? 8 : type === 'fixed' ? 20 : 18,
});

const REACTION_ARROW_LENGTH = 48;

/** Flechas de reacción de un nudo, de la cola a la punta, en píxeles de pantalla. */
export const reactionArrows = (
  point: ScreenPoint,
  result: Pick<NodeResult, 'rx' | 'ry'>,
  supportType: NodeModel['support']['type'],
): Array<{ component: 'rx' | 'ry'; from: ScreenPoint; to: ScreenPoint }> => {
  const { bottom, side } = reactionClearanceFor(supportType);
  const arrows: Array<{ component: 'rx' | 'ry'; from: ScreenPoint; to: ScreenPoint }> = [];
  if (Math.abs(result.rx) > 1e-8) {
    const direction = Math.sign(result.rx);
    arrows.push({
      component: 'rx',
      from: { x: point.x - direction * (side + REACTION_ARROW_LENGTH), y: point.y },
      to: { x: point.x - direction * side, y: point.y },
    });
  }
  if (Math.abs(result.ry) > 1e-8) {
    const near = { x: point.x, y: point.y + bottom };
    const far = { x: point.x, y: point.y + bottom + REACTION_ARROW_LENGTH };
    arrows.push(result.ry > 0 ? { component: 'ry', from: far, to: near } : { component: 'ry', from: near, to: far });
  }
  return arrows;
};

/** Cómo se lleva una ordenada del diagrama de una barra a la pantalla. */
export interface DiagramFrame {
  result: Pick<MemberResult, 'startOffset' | 'length'>;
  /** Eje de la barra (`memberAxis`): nudo inicial, cosenos directores y normal. */
  axis: { start: { x: number; y: number }; c: number; s: number; normal: { x: number; y: number } };
  /** +1 o −1: el lado del eje en el que se dibujan los valores positivos. */
  side: number;
  /** Píxeles por unidad de la magnitud. */
  pixelScale: number;
  cameraScale: number;
  toScreen: ToScreen;
}

/** Punto de la curva del diagrama en la abscisa `x` de la barra flexible, con ordenada `value`. */
export const diagramScreenPoint = (frame: DiagramFrame, x: number, value: number): ScreenPoint => {
  const { axis, side } = frame;
  const grossX = (frame.result.startOffset ?? 0) + x;
  const offsetModel = (value * frame.pixelScale) / frame.cameraScale;
  return frame.toScreen(
    axis.start.x + axis.c * grossX + axis.normal.x * side * offsetModel,
    axis.start.y + axis.s * grossX + axis.normal.y * side * offsetModel,
  );
};

/** Punto de la línea base del diagrama (el eje de la barra) en la abscisa `x`. */
export const diagramBaselinePoint = (frame: DiagramFrame, x: number): ScreenPoint => diagramScreenPoint(frame, x, 0);

const SAMPLES_PER_SEGMENT = 16;

const cubicAt = (p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint, p3: ScreenPoint, t: number): ScreenPoint => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
};

/**
 * La curva que dibuja `CanvasResultLayer`, muestreada como polilínea: desde la
 * línea base al primer valor, cada tramo cúbico, cada salto y de vuelta a la
 * línea base. Recorre los mismos comandos del trazo, así que coincide con lo
 * que se ve.
 */
export const diagramScreenPolyline = (
  frame: DiagramFrame,
  segments: MemberResult['diagramSegments'],
  quantity: DiagramQuantity,
): ScreenPoint[] => {
  if (!segments.length) return [];
  const first = segmentBezierControls(segments[0], quantity);
  let pen = diagramScreenPoint(frame, first.x0, first.y0);
  const points = [diagramBaselinePoint(frame, 0), pen];
  segments.forEach((segment, index) => {
    const control = segmentBezierControls(segment, quantity);
    const c1 = diagramScreenPoint(frame, control.c1x, control.c1y);
    const c2 = diagramScreenPoint(frame, control.c2x, control.c2y);
    const end = diagramScreenPoint(frame, control.x1, control.y1);
    for (let step = 1; step <= SAMPLES_PER_SEGMENT; step += 1) points.push(cubicAt(pen, c1, c2, end, step / SAMPLES_PER_SEGMENT));
    pen = end;
    const next = segments[index + 1];
    if (next && Math.abs(next.x0 - segment.x1) < 1e-8) {
      const nextControl = segmentBezierControls(next, quantity);
      if (Math.abs(nextControl.y0 - control.y1) > 1e-10) {
        pen = diagramScreenPoint(frame, nextControl.x0, nextControl.y0);
        points.push(pen);
      }
    }
  });
  points.push(diagramBaselinePoint(frame, frame.result.length));
  return points;
};
