
import {
  createProjection,
  drawArrow,
  drawMemberLoads,
  drawNodeDot,
  drawSupportGlyph,
  type Point,
} from './pdfScene';
import { pdfText } from './pdfGlyphs';
import {
  clearDisplay,
  
  
  
  
} from './pdfFormat';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor, ReportContext } from './reportContext';

/** Framed free-body diagram: geometry, supports, applied actions and optional reactions. */
export const drawGlobalDcl = (
  context: ReportContext,
  rect: { x: number; y: number; width: number; height: number },
  includeReactions = false,
): void => {
  const { layout, project, analysis, scenarioFactors, index } = context;
  const { fonts, palette } = layout;
  if (!project.nodes.length) return;
  // Rect-based rather than cursor-based: the caller reserves the space through
  // `layout.figure`, which is also what numbers and captions the drawing.
  const page = layout.page;
  const left = rect.x;
  const right = rect.x + rect.width;
  const bottom = rect.y;
  const top = rect.y + rect.height;
  page.drawRectangle({ x: left, y: bottom, width: rect.width, height: rect.height, borderWidth: 0.5, borderColor: palette.rule, color: palette.paper });
  const projection = createProjection(project.nodes, {
    left: left + 42,
    right: right - 42,
    bottom: bottom + 30,
    top: top - 22,
  });
  const point = (nodeId: string): Point | undefined => {
    const node = index.node(nodeId);
    return node ? projection.at(node.x, node.y) : undefined;
  };
  for (const member of project.members) {
    const start = point(member.i); const end = point(member.j);
    if (!start || !end) continue;
    page.drawLine({ start, end, thickness: member.type === 'rigid' ? 3 : 2, color: palette.ink });
    page.drawText(pdfText(member.id), { x: (start.x + end.x) / 2 + 3, y: (start.y + end.y) / 2 + 3, size: 6.5, font: fonts.bold, color: palette.inkSoft });
  }
  for (const node of project.nodes) {
    const location = point(node.id);
    if (!location) continue;
    drawNodeDot(layout, location, node.id, palette.ink);
    drawSupportGlyph(layout, location, node.support, palette.inkSoft);
  }
  for (const load of project.nodalLoads) {
    const factor = scenarioFactors[load.caseId] ?? 0;
    const location = point(load.nodeId);
    if (!location || factor === 0 || (load.fx === 0 && load.fy === 0)) continue;
    drawArrow(layout, location, load.fx * factor, load.fy * factor, palette.load, 24);
  }
  drawMemberLoads(context, projection);
  if (includeReactions) {
    const reactionColor = palette.reaction;
    const reactionReference = Math.max(1, ...analysis.nodeResults.flatMap((result) => [Math.abs(result.rx), Math.abs(result.ry)]));
    for (const result of analysis.nodeResults) {
      const location = point(result.nodeId);
      if (!location) continue;
      const components: Array<{ value: number; fx: number; fy: number; label: string }> = [
        { value: result.rx, fx: result.rx, fy: 0, label: 'Rx' },
        { value: result.ry, fx: 0, fy: result.ry, label: 'Ry' },
      ];
      for (const component of components) {
        if (Math.abs(component.value) <= reactionReference * 1e-9) continue;
        const tail = drawArrow(layout, location, component.fx, component.fy, reactionColor, 25);
        if (!tail) continue;
        const value = clearDisplay(project, component.value, 'force', reactionReference);
        const labelX = component.fx === 0 ? tail.x + 4 : Math.min(location.x, tail.x) - 2;
        const labelY = component.fy === 0 ? tail.y + 5 : tail.y + (component.value < 0 ? -8 : 4);
        page.drawText(pdfText(`${component.label} ${value}`), {
          x: labelX,
          y: labelY,
          size: 6.2,
          font: fonts.bold,
          color: reactionColor,
        });
      }
    }
  }
};

/**
 * The elastic curve of a straight beam, drawn over its undeformed axis.
 *
 * A deflection is a number nobody can picture, so a report that computes one and never draws
 * it has done half the work. The vertical scale is exaggerated on purpose and said so in the
 * caption: at true scale the curve would be indistinguishable from the axis.
 *
 * The shape comes from the deflection polynomials the method solved, not from a re-reading of
 * the model — this is the picture of the answer the page just derived.
 */
export const drawElasticCurve = (
  layout: PdfLayout,
  segments: readonly { x0: number; x1: number; deflection: readonly number[] }[],
  span: number,
  left: number,
  bottom: number,
  width: number,
  height: number,
  color: PdfColor,
): { peak: number; peakAt: number } => {
  const { page, rgb, fonts } = layout;
  const baseline = bottom + height / 2;
  const plotLeft = left + 26;
  const plotWidth = Math.max(1, width - 52);
  const evaluate = (coefficients: readonly number[], x: number): number => {
    let value = 0;
    for (let power = coefficients.length - 1; power >= 0; power -= 1) value = value * x + coefficients[power];
    return value;
  };
  const sampleAt = (x: number): number => {
    const segment = segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9) ?? segments[segments.length - 1];
    return segment ? evaluate(segment.deflection, x) : 0;
  };

  const steps = 120;
  const samples: { x: number; value: number }[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = (span * step) / steps;
    samples.push({ x, value: sampleAt(x) });
  }
  const peakSample = samples.reduce((largest, sample) => (Math.abs(sample.value) > Math.abs(largest.value) ? sample : largest), samples[0]);
  const peak = Math.abs(peakSample.value);
  const amplitude = Math.min(height / 2 - 12, 34);
  const toPoint = (sample: { x: number; value: number }) => ({
    x: plotLeft + (sample.x / Math.max(span, 1e-9)) * plotWidth,
    // Positive deflection is upward in the model; on the page +y is up too, so the sign
    // carries straight through and a sagging beam reads as sagging.
    y: baseline + (peak > 0 ? (sample.value / peak) * amplitude : 0),
  });

  page.drawLine({
    start: { x: plotLeft, y: baseline },
    end: { x: plotLeft + plotWidth, y: baseline },
    thickness: 1.1,
    color: rgb(0.42, 0.49, 0.45),
  });
  let previous = toPoint(samples[0]);
  for (const sample of samples.slice(1)) {
    const point = toPoint(sample);
    page.drawLine({ start: previous, end: point, thickness: 1.35, color });
    previous = point;
  }

  const peakPoint = toPoint(peakSample);
  page.drawCircle({ x: peakPoint.x, y: peakPoint.y, size: 2.2, color });
  page.drawText(pdfText('Curva elástica (escala vertical exagerada)'), {
    x: plotLeft,
    y: bottom + 4,
    size: 6.2,
    font: fonts.regular,
    color: rgb(0.38, 0.44, 0.40),
  });
  return { peak: peakSample.value, peakAt: peakSample.x };
};
