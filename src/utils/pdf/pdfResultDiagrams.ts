/**
 * Diagramas de fuerzas internas N, V y M de la estructura completa.
 *
 * La memoria tenía el cuerpo libre de cada tramo pero ningún diagrama de la estructura: el
 * lector tenía que reconstruir el cortante y el momento leyendo polinomios. Aquí cada barra
 * lleva su curva exacta (los segmentos polinómicos del solver, muestreados), con la misma
 * escala para todas las barras, el mismo lado que el lienzo (+ hacia la normal izquierda de
 * i→j) y los colores de las señales de la marca. Las barras curvas se dibujan sobre su arco.
 *
 * Las cifras: el extremo de cada barra y sus valores en los nudos, sin encimarse; los
 * extremos globales siempre se escriben.
 */
import { evaluatePolynomial } from '../../engine/diagram';
import { circularMemberGeometry, curvePointAt, curveTangentAt } from '../../graphics/memberCurve';
import { memberAxis, pointAtGrossRatio } from '../../graphics/structureGeometry';
import type { DiagramQuantity, MemberModel, MemberResult, NodeModel } from '../../types';
import { clearDisplay } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import { createModelProjection, drawNodeDot, drawSupportGlyph, memberPolyline, type Point, type Rect } from './pdfScene';
import { TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';

const SAMPLES_PER_SEGMENT = 8;
const LABEL_SIZE = TYPE.micro + 0.4;

/** Valor de la cantidad en todo el modelo: la referencia de la escala común. */
export const quantityExtreme = (context: ReportContext, quantity: DiagramQuantity): number =>
  context.analysis.memberResults.reduce((largest, result) => Math.max(
    largest,
    ...result.criticalPoints.filter((point) => point.quantity === quantity).map((point) => Math.abs(point.value)),
    ...result.diagram.map((point) => Math.abs(point[quantity])),
  ), 0);

/** Punto del eje y normal izquierda (en el modelo) a la distancia `x` del inicio flexible. */
const stationOn = (member: MemberModel, i: NodeModel, j: NodeModel, result: MemberResult) => {
  const axis = memberAxis(member, i, j);
  const arc = circularMemberGeometry(member, i, j);
  return (x: number) => {
    const ratio = Math.min(1, Math.max(0, ((result.startOffset ?? 0) + x) / axis.length));
    if (arc) {
      const point = curvePointAt(arc, ratio);
      const tangent = curveTangentAt(arc, ratio);
      return { point, normal: { x: -tangent.y, y: tangent.x } };
    }
    return { point: pointAtGrossRatio(axis, ratio), normal: axis.normal };
  };
};

export { memberPolyline } from './pdfScene';

/** Polígono cerrado en una trayectoria SVG para `drawSvgPath` con origen (0, 0). */
const svgPath = (points: readonly Point[]): string =>
  points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${(-point.y).toFixed(2)}`).join(' ') + ' Z';

export const drawResultDiagram = (context: ReportContext, rect: Rect, quantity: DiagramQuantity): void => {
  const { layout, project, analysis, index } = context;
  const { palette, fonts } = layout;
  const page = layout.page;
  page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, borderWidth: 0.5, borderColor: palette.rule, color: palette.paper });
  if (!project.nodes.length) return;

  const amplitude = Math.min(rect.height, rect.width) * 0.17;
  const projection = createModelProjection(project, {
    left: rect.x + 30 + amplitude * 0.6,
    right: rect.x + rect.width - 30 - amplitude * 0.6,
    bottom: rect.y + 26 + amplitude * 0.75,
    top: rect.y + rect.height - 28 - amplitude * 0.75,
  });
  const color = palette.quantity[quantity];
  const reference = quantityExtreme(context, quantity);
  const scale = reference > 0 ? amplitude / reference : 0;
  const unit = quantity === 'moment' ? 'moment' as const : 'force' as const;
  const placed: Rect[] = [];
  // Trazos que ninguna cifra debe cruzar: los ejes de las barras y las curvas de los diagramas.
  // Se llenan cuando ya se conocen (más abajo), antes de escribir la primera cifra.
  const strokes: Array<[Point, Point]> = [];
  const crosses = (box: Rect, [a, b]: [Point, Point]) => {
    // Liang–Barsky: ¿algún tramo del segmento cae dentro de la caja (con 1 pt de aire)?
    const x0 = box.x - 1, x1 = box.x + box.width + 1, y0 = box.y - 1, y1 = box.y + box.height + 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    let enter = 0, exit = 1;
    for (const [p, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]] as const) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) enter = Math.max(enter, t); else exit = Math.min(exit, t);
      if (enter > exit) return false;
    }
    return true;
  };
  const fits = (box: Rect) => box.x >= rect.x + 2 && box.x + box.width <= rect.x + rect.width - 2
    && box.y >= rect.y + 2 && box.y + box.height <= rect.y + rect.height - 2
    && !placed.some((other) => box.x < other.x + other.width + 2 && other.x < box.x + box.width + 2
      && box.y < other.y + other.height + 1 && other.y < box.y + box.height + 1)
    && !strokes.some((segment) => crosses(box, segment));
  const written: Array<{ text: string; at: Point }> = [];
  const label = (text: string, at: Point, outward: Point, force: boolean) => {
    // La misma cifra en el mismo nudo (la viga y la columna que llegan a él, o el extremo
    // global ya escrito) se escribe una vez.
    const value = text.replace(/^[NVM] (máx|mín) /, '');
    if (!force && written.some((entry) => entry.text.endsWith(value) && Math.hypot(entry.at.x - at.x, entry.at.y - at.y) < 40)) return;
    written.push({ text, at });
    const shown = pdfText(text);
    const width = fonts.bold.widthOfTextAtSize(shown, LABEL_SIZE);
    // Más lejos a lo largo de la normal y, si no cabe, corrida a un lado o al otro.
    const tangent = { x: -outward.y, y: outward.x };
    const candidates = [1, 1.8, 2.8, 4].flatMap((reach) => [0, 1, -1].map((side) => ({
      x: at.x + outward.x * 6 * reach + tangent.x * side * (width / 2 + 6) - (outward.x < -0.3 ? width : outward.x > 0.3 ? 0 : width / 2),
      y: at.y + outward.y * 6 * reach + tangent.y * side * (LABEL_SIZE + 4) - (outward.y < -0.3 ? LABEL_SIZE : outward.y > 0.3 ? 0 : LABEL_SIZE / 2),
    })));
    const box = candidates.map((origin) => ({ x: origin.x, y: origin.y - 1, width, height: LABEL_SIZE + 2 })).find(fits)
      ?? (force ? { x: Math.min(Math.max(candidates[0]!.x, rect.x + 4), rect.x + rect.width - width - 4), y: candidates[0]!.y - 1, width, height: LABEL_SIZE + 2 } : undefined);
    if (!box) return;
    placed.push(box);
    // Un halo de papel: si una cifra obligada no encontró sitio libre, sigue legible.
    page.drawRectangle({ x: box.x - 1.5, y: box.y, width: box.width + 3, height: box.height, color: palette.paper, opacity: 0.85 });
    page.drawText(shown, { x: box.x, y: box.y + 1.5, size: LABEL_SIZE, font: fonts.bold, color: palette.ink });
  };

  const globalMax = { value: 0, memberId: '', x: 0 };
  const globalMin = { value: 0, memberId: '', x: 0 };
  const perMember: Array<{ member: MemberModel; result: MemberResult; i: NodeModel; j: NodeModel }> = [];
  for (const member of project.members) {
    const result = analysis.memberResults.find((entry) => entry.memberId === member.id);
    const i = index.node(member.i), j = index.node(member.j);
    if (!result || !i || !j) continue;
    perMember.push({ member, result, i, j });
    for (const point of result.criticalPoints) {
      if (point.quantity !== quantity) continue;
      if (point.value > globalMax.value) Object.assign(globalMax, { value: point.value, memberId: member.id, x: point.x });
      if (point.value < globalMin.value) Object.assign(globalMin, { value: point.value, memberId: member.id, x: point.x });
    }
  }

  // Primero los rellenos, después los ejes encima y por último las cifras.
  const curves = perMember.map(({ member, result, i, j }) => {
    const at = stationOn(member, i, j, result);
    const toPage = (x: number, value: number) => {
      const { point, normal } = at(x);
      const base = projection.at(point.x, point.y);
      return { base, tip: { x: base.x + normal.x * value * scale, y: base.y + normal.y * value * scale }, normal };
    };
    const samples: Array<{ x: number; value: number; base: Point; tip: Point; normal: Point }> = [];
    for (const segment of result.diagramSegments) {
      const length = segment.x1 - segment.x0;
      for (let k = 0; k <= SAMPLES_PER_SEGMENT; k += 1) {
        const xi = length * k / SAMPLES_PER_SEGMENT;
        const value = evaluatePolynomial(segment[quantity], xi);
        samples.push({ x: segment.x0 + xi, value, ...toPage(segment.x0 + xi, value) });
      }
    }
    return { member, result, samples };
  });
  // Una barra de armadura tiene N constante: en vez de una banda que se cruza con las de sus
  // vecinas, se pinta la barra (azul a tensión, rojo a compresión) y su cifra con T/C.
  const trussBar = (member: MemberModel) => quantity === 'axial' && member.type === 'truss';
  for (const { member, samples } of curves) {
    if (trussBar(member)) continue;
    if (samples.length < 2 || scale === 0) continue;
    const polygon = [...samples.map((sample) => sample.base), ...samples.slice().reverse().map((sample) => sample.tip)];
    page.drawSvgPath(svgPath(polygon), { x: 0, y: 0, color, opacity: 0.16, borderWidth: 0 });
    page.drawSvgPath(samples.map((sample, k) => `${k ? 'L' : 'M'}${sample.tip.x.toFixed(2)} ${(-sample.tip.y).toFixed(2)}`).join(' '),
      { x: 0, y: 0, borderColor: color, borderWidth: 1 });
    // Cierres verticales en los extremos, como en el lienzo.
    for (const end of [samples[0]!, samples[samples.length - 1]!]) page.drawLine({ start: end.base, end: end.tip, thickness: 0.6, color });
  }
  for (const { member, result, i, j } of perMember) {
    const line = memberPolyline(member, i, j, projection.at);
    const axial = trussBar(member) ? (result.diagram[0]?.axial ?? 0) : 0;
    const tension = axial > reference * 1e-6, compression = axial < -reference * 1e-6;
    const tone = tension ? palette.quantity.axial : compression ? palette.quantity.moment : palette.ink;
    const thickness = trussBar(member) && reference > 0 ? 1.2 + 3.2 * Math.abs(axial) / reference : member.type === 'rigid' ? 2.6 : 1.5;
    for (let k = 1; k < line.length; k += 1) page.drawLine({ start: line[k - 1]!, end: line[k]!, thickness, color: trussBar(member) ? tone : palette.ink });
  }
  for (const node of project.nodes) {
    const location = projection.at(node.x, node.y);
    drawNodeDot(layout, location, '', palette.ink, 1.8, 0);
    drawSupportGlyph(layout, location, node.support, palette.inkSoft);
  }
  if (scale === 0) {
    page.drawText(pdfText('Sin valores distintos de cero en este escenario.'), { x: rect.x + 12, y: rect.y + 12, size: TYPE.small, font: fonts.regular, color: palette.inkSoft });
    return;
  }
  // Obstáculos para las cifras: el eje de cada barra y la curva de cada diagrama.
  for (const { member, i, j } of perMember) {
    const line = memberPolyline(member, i, j, projection.at);
    for (let k = 1; k < line.length; k += 1) strokes.push([line[k - 1]!, line[k]!]);
  }
  for (const { member, samples } of curves) {
    if (trussBar(member)) continue;
    for (let k = 1; k < samples.length; k += 1) strokes.push([samples[k - 1]!.tip, samples[k]!.tip]);
  }
  const symbol = quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M';
  const write = (value: number) => clearDisplay(project, value, unit, reference);
  // Extremos globales, siempre (en una armadura cada barra ya lleva su cifra).
  const allTruss = quantity === 'axial' && perMember.every(({ member }) => member.type === 'truss');
  for (const extreme of allTruss ? [] : [globalMax, globalMin]) {
    if (!extreme.memberId || Math.abs(extreme.value) < reference * 1e-6) continue;
    const curve = curves.find((entry) => entry.member.id === extreme.memberId);
    const sample = curve?.samples.reduce((best, entry) => Math.abs(entry.x - extreme.x) < Math.abs(best.x - extreme.x) ? entry : best);
    if (!sample) continue;
    const sign = extreme.value >= 0 ? 1 : -1;
    label(`${symbol} ${extreme === globalMax ? 'máx' : 'mín'} ${write(extreme.value)}`, sample.tip, { x: sample.normal.x * sign, y: sample.normal.y * sign }, true);
  }
  // Por barra: valores en los extremos y el extremo propio, donde quepan.
  for (const { member, samples } of curves) {
    if (!samples.length) continue;
    if (trussBar(member)) {
      const middle = samples[Math.floor(samples.length / 2)]!;
      const value = middle.value;
      if (Math.abs(value) <= reference * 1e-6) {
        label('0', middle.base, middle.normal, false);
        continue;
      }
      label(`${write(Math.abs(value))} (${value > 0 ? 'T' : 'C'})`, middle.base, middle.normal, true);
      continue;
    }
    const significant = (value: number) => Math.abs(value) > reference * 0.02;
    const own = samples.reduce((best, entry) => Math.abs(entry.value) > Math.abs(best.value) ? entry : best);
    for (const sample of [samples[0]!, own, samples[samples.length - 1]!]) {
      if (!significant(sample.value)) continue;
      const sign = sample.value >= 0 ? 1 : -1;
      label(write(sample.value), sample.tip, { x: sample.normal.x * sign, y: sample.normal.y * sign }, false);
    }
  }
};
