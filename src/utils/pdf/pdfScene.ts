/**
 * Drawing primitives shared by every piece of artwork in the report.
 *
 * `pdfDiagrams.ts` grew these one at a time and kept them private, so the free-body scenes of
 * the method sections could not reach the projection, the arrow or the support glyph without
 * either importing a diagram or drawing a second, subtly different version of each. They live
 * here now, unchanged in behaviour, plus the three the scenes needed and nobody had written:
 * a moment arc, a dashed line, and the ghosted whole model a free body is cut out of.
 *
 * Everything here draws through `layout.page`, which must always be read at the moment of use —
 * a page break replaces it — and takes its colours from the palette, never from a literal.
 */
import type { MemberLoad, MemberModel, NodeModel, ProjectModel, SupportDefinition } from '../../types';
import { circularMemberGeometry, curvePointAt } from '../../graphics/memberCurve';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { TYPE } from './pdfTheme';
import type { SectionGeometry } from '../../features/inspector/sectionGeometry';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  pointAtGrossRatio,
  memberAxis,
  modelBounds,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { number } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor, ReportContext } from './reportContext';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlotBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface Projection {
  at(x: number, y: number): Point;
  /** Model units per PDF point, so a scene can size a stub or a radius in real terms. */
  readonly scale: number;
}

/** Uniform model -> page transform that centres the structure inside `plot`. */
export const createProjection = (nodes: readonly NodeModel[], plot: PlotBox): Projection => {
  const { minX, maxX, minY, maxY } = modelBounds(nodes);
  // Una viga no tiene alto y una columna sola no tiene ancho: esa dimensión no limita la escala
  // (antes contaba como 1 m y una viga en una figura baja quedaba diminuta).
  const width = maxX - minX, height = maxY - minY;
  const extent = Math.max(width, height, 1e-9);
  const byWidth = width > extent * 1e-6 ? (plot.right - plot.left) / width : Number.POSITIVE_INFINITY;
  const byHeight = height > extent * 1e-6 ? (plot.top - plot.bottom) / height : Number.POSITIVE_INFINITY;
  const scale = Number.isFinite(Math.min(byWidth, byHeight)) ? Math.min(byWidth, byHeight) : 1;
  const offsetX = (plot.left + plot.right - (maxX - minX) * scale) / 2;
  const offsetY = (plot.bottom + plot.top - (maxY - minY) * scale) / 2;
  return {
    at: (x, y) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale }),
    scale,
  };
};

/** El trazo del eje de una barra (recta o arco) en coordenadas de página. */
export const memberPolyline = (member: MemberModel, i: NodeModel, j: NodeModel, at: (x: number, y: number) => Point): Point[] => {
  const arc = circularMemberGeometry(member, i, j);
  if (!arc) return [at(i.x, i.y), at(j.x, j.y)];
  return Array.from({ length: 49 }, (_, index) => {
    const point = curvePointAt(arc, index / 48);
    return at(point.x, point.y);
  });
};

/**
 * Encuadre del modelo entero: los nudos y, en una barra curva, su arco. Con sólo los nudos la
 * clave de un arco quedaba fuera de la figura.
 */
export const createModelProjection = (project: Pick<ProjectModel, 'nodes' | 'members'>, plot: PlotBox): Projection => {
  const outline: NodeModel[] = [...project.nodes];
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  for (const member of project.members) {
    const i = nodes.get(member.i), j = nodes.get(member.j);
    const arc = i && j ? circularMemberGeometry(member, i, j) : undefined;
    if (arc) for (let k = 1; k < 16; k += 1) outline.push({ ...i!, ...curvePointAt(arc, k / 16), id: `${member.id}:${k}` });
  }
  return createProjection(outline, plot);
};

/**
 * Projection centred on one point rather than on the whole model.
 *
 * The Method of Joints draws one pin at a time: fitting the whole truss in the frame would
 * leave the joint a three-point dot with three arrows on top of each other. `radius` is the
 * model-space half-width the frame should cover.
 */
export const createFocusProjection = (centre: Point, radius: number, plot: PlotBox): Projection => {
  const span = Math.max(radius, 1e-6) * 2;
  const scale = Math.min((plot.right - plot.left) / span, (plot.top - plot.bottom) / span);
  const midX = (plot.left + plot.right) / 2;
  const midY = (plot.bottom + plot.top) / 2;
  return {
    at: (x, y) => ({ x: midX + (x - centre.x) * scale, y: midY + (y - centre.y) * scale }),
    scale,
  };
};

/** Arrow head-first at `location`; returns the tail, where labels are anchored. */
export const drawArrow = (
  layout: PdfLayout,
  location: Point,
  fx: number,
  fy: number,
  color: PdfColor,
  length: number,
  thickness = 1.15,
): Point | undefined => {
  const magnitude = Math.hypot(fx, fy);
  if (!(magnitude > 1e-12)) return undefined;
  const dx = fx / magnitude * length;
  const dy = fy / magnitude * length;
  const tail = { x: location.x - dx, y: location.y - dy };
  const page = layout.page;
  page.drawLine({ start: tail, end: location, thickness, color });
  page.drawLine({ start: location, end: { x: location.x - dx * 0.30 - dy * 0.15, y: location.y - dy * 0.30 + dx * 0.15 }, thickness: thickness * 0.87, color });
  page.drawLine({ start: location, end: { x: location.x - dx * 0.30 + dy * 0.15, y: location.y - dy * 0.30 - dx * 0.15 }, thickness: thickness * 0.87, color });
  return tail;
};

/** Dashed segment, in the document's one dash pattern. */
export const drawDashedLine = (
  layout: PdfLayout,
  from: Point,
  to: Point,
  color: PdfColor,
  thickness = 0.9,
): void => {
  layout.page.drawLine({ start: from, end: to, thickness, color, dashArray: [3.2, 2.4] });
};

/**
 * Circular arc with an arrowhead at its leading end: a moment, drawn the way one is drawn on
 * paper. `sign > 0` turns counter-clockwise, which is the positive sense of the model's own
 * `Mz`, so the drawing and the number never disagree.
 *
 * `pdf-lib` has no arc operator exposed through its drawing API, so the arc is a polyline —
 * at this radius and this segment count the facets are well under the line width.
 */
export const drawMomentArc = (
  layout: PdfLayout,
  centre: Point,
  sign: number,
  radius: number,
  color: PdfColor,
  thickness = 1.1,
): Point => {
  const page = layout.page;
  const direction = sign >= 0 ? 1 : -1;
  const from = Math.PI * 0.25;
  const sweep = Math.PI * 1.35;
  const steps = 24;
  const at = (angle: number): Point => ({
    x: centre.x + radius * Math.cos(angle),
    y: centre.y + radius * Math.sin(angle),
  });
  let previous = at(from);
  let last = previous;
  for (let step = 1; step <= steps; step += 1) {
    const angle = from + direction * sweep * (step / steps);
    const point = at(angle);
    page.drawLine({ start: previous, end: point, thickness, color });
    previous = point;
    last = point;
  }
  // Head tangent to the arc at its leading end: rotating the radius by a quarter turn in the
  // direction of travel is the tangent, which is what makes the arrow read as a rotation.
  const endAngle = from + direction * sweep;
  const tangent = { x: -Math.sin(endAngle) * direction, y: Math.cos(endAngle) * direction };
  const head = 4.6;
  const normal = { x: -tangent.y, y: tangent.x };
  page.drawLine({
    start: last,
    end: { x: last.x - tangent.x * head + normal.x * head * 0.5, y: last.y - tangent.y * head + normal.y * head * 0.5 },
    thickness,
    color,
  });
  page.drawLine({
    start: last,
    end: { x: last.x - tangent.x * head - normal.x * head * 0.5, y: last.y - tangent.y * head - normal.y * head * 0.5 },
    thickness,
    color,
  });
  return last;
};

/**
 * The support symbol under `location`: the triangle every support shares, plus the rollers and
 * the ground line that tell a pin from a roller from a fixed end.
 *
 * Lifted verbatim out of `drawGlobalDcl`'s node loop — same geometry, same sizes — so the free
 * body of a cut portion draws its supports exactly as the global diagram draws them.
 */
export const drawSupportGlyph = (
  layout: PdfLayout,
  location: Point,
  support: SupportDefinition,
  color: PdfColor,
): void => {
  if (support.type === 'none') return;
  const page = layout.page;
  page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x - 7, y: location.y - 13 }, thickness: 1, color });
  page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x + 7, y: location.y - 13 }, thickness: 1, color });
  if (support.type === 'roller') {
    page.drawCircle({ x: location.x - 4, y: location.y - 15.5, size: 1.8, borderColor: color, borderWidth: 0.8 });
    page.drawCircle({ x: location.x + 4, y: location.y - 15.5, size: 1.8, borderColor: color, borderWidth: 0.8 });
    page.drawLine({ start: { x: location.x - 10, y: location.y - 19 }, end: { x: location.x + 10, y: location.y - 19 }, thickness: 1, color });
    return;
  }
  page.drawLine({ start: { x: location.x - 9, y: location.y - 13 }, end: { x: location.x + 9, y: location.y - 13 }, thickness: 1, color });
  if (support.type === 'fixed' || (support.type === 'custom' && support.restrainR === true)) {
    // Hatching under the ground line: the one mark that separates a fixed end from a pin
    // without reading the label.
    for (let index = -2; index <= 2; index += 1) {
      const x = location.x + index * 4.5;
      page.drawLine({ start: { x, y: location.y - 13 }, end: { x: x - 3.5, y: location.y - 18 }, thickness: 0.6, color });
    }
  }
};

/** A node dot with its id beside it, the way every diagram in the report draws one. */
export const drawNodeDot = (
  layout: PdfLayout,
  location: Point,
  id: string,
  color: PdfColor,
  size = 3,
  labelSize = 7.4,
): void => {
  const page = layout.page;
  page.drawCircle({ x: location.x, y: location.y, size, color: layout.palette.paper, borderColor: color, borderWidth: 1.1 });
  if (id) page.drawText(pdfText(id), { x: location.x + size + 2, y: location.y + size + 1, size: labelSize, font: layout.fonts.bold, color });
};

interface GhostOptions {
  /** Members drawn at full strength; everything else is ghosted. Absent means ghost all. */
  readonly solidMemberIds?: ReadonlySet<string>;
  /** Nodes drawn at full strength. Absent means ghost all. */
  readonly solidNodeIds?: ReadonlySet<string>;
  /** Ghosted geometry is dropped entirely rather than drawn faint. */
  readonly hideGhost?: boolean;
}

/**
 * The whole structure under a free body: the retained part in ink, the rest a faint outline.
 *
 * A cut portion drawn on its own tells the reader what was kept but not what it was cut from,
 * which is the one thing a section drawing exists to say.
 */
export const drawGhostModel = (
  context: ReportContext,
  projection: Projection,
  options: GhostOptions = {},
): void => {
  const { layout, project, index } = context;
  const { palette } = layout;
  const page = layout.page;
  const solidMembers = options.solidMemberIds;
  const solidNodes = options.solidNodeIds;
  for (const member of project.members) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    const solid = solidMembers === undefined || solidMembers.has(member.id);
    if (!solid && options.hideGhost) continue;
    // Una barra curva se dibuja sobre su arco, también como fantasma.
    const line = memberPolyline(member, ni, nj, projection.at);
    for (let k = 1; k < line.length; k += 1) page.drawLine({
      start: line[k - 1]!,
      end: line[k]!,
      thickness: solid ? (member.type === 'rigid' ? 3 : 2) : 0.8,
      color: solid ? palette.ink : palette.inkFaint,
      opacity: solid ? 1 : 0.5,
      dashArray: solid || line.length > 2 ? undefined : [2.4, 2.4],
    });
  }
  for (const node of project.nodes) {
    const solid = solidNodes === undefined || solidNodes.has(node.id);
    if (!solid && options.hideGhost) continue;
    const location = projection.at(node.x, node.y);
    if (!solid) {
      page.drawCircle({ x: location.x, y: location.y, size: 1.6, color: palette.inkFaint, opacity: 0.5 });
      continue;
    }
    drawNodeDot(layout, location, node.id, palette.ink);
    drawSupportGlyph(layout, location, node.support, palette.inkSoft);
  }
};

/**
 * The outline of a cross-section, to scale, inside `rect`.
 *
 * The shape comes from `resolveSectionGeometry`, which is the product's own rule: a real
 * profile is only drawn when the member declares an explicit catalogue identity; anything else
 * resolves to the equivalent rectangle `h = √(12·I/A)` and is labelled as such by the caller.
 * Nothing here infers a commercial profile from `A` and `I`.
 */
export const drawSectionShape = (
  layout: PdfLayout,
  rect: Rect,
  geometry: SectionGeometry,
  color: PdfColor,
): void => {
  const page = layout.page;
  const scale = Math.min(
    rect.width / Math.max(geometry.width, 1e-6),
    rect.height / Math.max(geometry.depth, 1e-6),
  ) * 0.82;
  const w = geometry.width * scale;
  const h = geometry.depth * scale;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const left = cx - w / 2;
  const bottom = cy - h / 2;
  const flange = Math.max(geometry.flange * scale, 1.4);
  const web = Math.max(geometry.web * scale, 1.4);
  const fill = (x: number, y: number, width: number, height: number) =>
    page.drawRectangle({ x, y, width, height, color });

  switch (geometry.shapeType) {
    case 'I':
      fill(left, bottom, w, flange);
      fill(left, bottom + h - flange, w, flange);
      fill(cx - web / 2, bottom + flange, web, h - flange * 2);
      break;
    case 'C':
      fill(left, bottom, w, flange);
      fill(left, bottom + h - flange, w, flange);
      fill(left, bottom + flange, web, h - flange * 2);
      break;
    case 'L':
      fill(left, bottom, w, flange);
      fill(left, bottom + flange, web, h - flange);
      break;
    case 'HSS_RECT':
      fill(left, bottom, w, h);
      page.drawRectangle({
        x: left + web, y: bottom + flange, width: Math.max(w - web * 2, 0), height: Math.max(h - flange * 2, 0),
        color: layout.palette.paper,
      });
      break;
    case 'HSS_ROUND': {
      const radius = Math.min(w, h) / 2;
      page.drawCircle({ x: cx, y: cy, size: radius, color });
      page.drawCircle({ x: cx, y: cy, size: Math.max(radius - web, 0.5), color: layout.palette.paper });
      break;
    }
    default:
      fill(left, bottom, w, h);
      break;
  }
  // The neutral axis is the reference every section property in the table beside this drawing
  // is measured about, so it is drawn rather than assumed.
  page.drawLine({
    start: { x: left - 8, y: cy },
    end: { x: left + w + 8, y: cy },
    thickness: 0.5,
    color: layout.palette.inkFaint,
    dashArray: [3, 2],
  });
};

/** Geometry of the drawn shape, so a caller can hang its dimension lines off the same box. */
export const sectionShapeBox = (rect: Rect, geometry: SectionGeometry): Rect => {
  const scale = Math.min(
    rect.width / Math.max(geometry.width, 1e-6),
    rect.height / Math.max(geometry.depth, 1e-6),
  ) * 0.82;
  const width = geometry.width * scale;
  const height = geometry.depth * scale;
  return {
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
    width,
    height,
  };
};

/**
 * Cajas pequeñas a lo largo de un trazo (una barra, una flecha), cada 5 pt: una cifra que las
 * evita no se escribe encima de la barra ni de las flechas de carga. Antes sólo se evitaban
 * otras cifras y un momento de apoyo quedaba escrito sobre la carga repartida.
 */
export const strokeBoxes = (from: Point, to: Point, pad = 1.5): Rect[] => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / 5));
  return Array.from({ length: steps + 1 }, (_, step) => ({
    x: from.x + (to.x - from.x) * step / steps - pad,
    y: from.y + (to.y - from.y) * step / steps - pad,
    width: pad * 2,
    height: pad * 2,
  }));
};

interface MemberLoadOptions {
  /**
   * Members whose loads are drawn. Absent draws every member's.
   *
   * A free body only carries the actions that act *on it*: drawing the load of a member the
   * cut discarded would put a force on the drawing that appears in none of the equations
   * underneath it.
   */
  readonly onlyMemberIds?: ReadonlySet<string>;
  /** Station, 0..1 along the member, past which a load is not drawn. */
  readonly upTo?: (memberId: string) => number;
  /** Donde se apuntan las cajas de las cifras de carga, para que otras etiquetas las eviten. */
  readonly labelBoxes?: Rect[];
  /** Donde se apuntan los trazos de las flechas de carga: una cifra los evita, pero cede antes que encimarse con otra. */
  readonly strokeObstacles?: Rect[];
}

/**
 * Applied member loads — distributed runs, point loads and applied moments — projected onto
 * the page.
 *
 * Lifted out of `drawGlobalDcl` so the free-body scenes draw the applied actions exactly as
 * the report's other diagrams draw them, arrow for arrow. Applied actions keep the one indigo
 * of `--sc-color-load-point`; a response quantity never borrows it, and it never borrows
 * theirs — on a free-body diagram a cause must not be mistakable for an effect.
 */
export const drawMemberLoads = (
  context: ReportContext,
  projection: Projection,
  options: MemberLoadOptions = {},
): void => {
  const { layout, project, index, scenarioFactors } = context;
  const { palette, fonts } = layout;
  const page = layout.page;
  const labelSize = TYPE.micro + 0.6;
  // Las cargas repartidas de varios casos sobre el mismo tramo y en el mismo sentido se dibujan
  // como UNA, ya multiplicada por los factores del escenario exportado: es la carga con la que
  // se escriben las ecuaciones. Antes cada caso dibujaba sus flechas y su identificador interno
  // («CM-V1 [0-0.5]») en el mismo sitio y los textos se encimaban.
  const combined = new Map<string, MemberLoad>();
  const singles: { load: MemberLoad; factor: number }[] = [];
  for (const load of project.memberLoads) {
    if (options.onlyMemberIds && !options.onlyMemberIds.has(load.memberId)) continue;
    const factor = scenarioFactors[load.caseId] ?? 0;
    if (factor === 0) continue;
    if (load.type !== 'distributed') {
      singles.push({ load, factor });
      continue;
    }
    const key = [load.memberId, load.coordinateSystem, load.lengthBasis, number(Math.min(load.start, load.end)), number(Math.max(load.start, load.end))].join('|');
    const scaled = (value: number | undefined) => (value ?? 0) * factor;
    const current = combined.get(key);
    if (!current) {
      combined.set(key, { ...load, qxStart: scaled(load.qxStart), qxEnd: scaled(load.qxEnd ?? load.qxStart), qyStart: scaled(load.qyStart), qyEnd: scaled(load.qyEnd ?? load.qyStart) });
    } else {
      combined.set(key, {
        ...current,
        qxStart: (current.qxStart ?? 0) + scaled(load.qxStart), qxEnd: (current.qxEnd ?? 0) + scaled(load.qxEnd ?? load.qxStart),
        qyStart: (current.qyStart ?? 0) + scaled(load.qyStart), qyEnd: (current.qyEnd ?? 0) + scaled(load.qyEnd ?? load.qyStart),
      });
    }
  }
  const drawn: { load: MemberLoad; factor: number }[] = [...[...combined.values()].map((load) => ({ load, factor: 1 })), ...singles];
  const label = (text: string, x: number, y: number) => {
    const shown = pdfText(text);
    options.labelBoxes?.push({ x, y: y - 1, width: fonts.bold.widthOfTextAtSize(shown, labelSize), height: labelSize + 2 });
    page.drawText(shown, { x, y, size: labelSize, font: fonts.bold, color: palette.load });
  };
  for (const { load, factor } of drawn) {
    const member = index.member(load.memberId);
    if (!member) continue;
    const startNode = index.node(member.i);
    const endNode = index.node(member.j);
    if (!startNode || !endNode) continue;
    const screenStart = projection.at(startNode.x, startNode.y);
    const screenEnd = projection.at(endNode.x, endNode.y);
    const axis = memberAxis(member, startNode, endNode);
    if (!(axis.length > 0) || !(axis.flexibleLength > 0)) continue;
    const limit = options.upTo?.(load.memberId) ?? 1;
    // Sobre el eje real: en un arco, la flecha cae en el arco y no en la cuerda.
    const atFlexibleRatio = (ratio: number) => {
      const point = pointAtGrossRatio(axis, grossRatioFromFlexible(axis, ratio));
      return projection.at(point.x, point.y);
    };
    const globalVector = (x: number, y: number, ratio = 0.5): [number, number] =>
      toGlobalVector(axis, load.coordinateSystem, x, y, ratio);
    const actionColor = load.type === 'distributed' ? palette.loadDistributed : palette.load;
    if (load.type === 'distributed') {
      const startRatio = Math.min(load.start, load.end);
      const endRatio = Math.min(Math.max(load.start, load.end), limit);
      if (!(endRatio > startRatio)) continue;
      const arrowTails: Point[] = [];
      const screenLength = Math.hypot(screenEnd.x - screenStart.x, screenEnd.y - screenStart.y) * (endRatio - startRatio);
      const count = Math.max(4, Math.min(11, Math.round(screenLength / 28) + 1));
      for (let arrowIndex = 0; arrowIndex < count; arrowIndex += 1) {
        const t = arrowIndex / (count - 1);
        const ratio = startRatio + (endRatio - startRatio) * t;
        const intensity = distributedIntensityAt(load, t);
        const [gx, gy] = globalVector(intensity.qx * factor, intensity.qy * factor, ratio);
        const head = atFlexibleRatio(ratio);
        const tail = drawArrow(layout, head, gx, gy, actionColor, 16);
        if (tail) {
          arrowTails.push(tail);
          options.strokeObstacles?.push(...strokeBoxes(head, tail));
        }
      }
      if (arrowTails.length > 1) {
        page.drawLine({ start: arrowTails[0], end: arrowTails.at(-1)!, thickness: 0.9, color: actionColor });
        options.strokeObstacles?.push(...strokeBoxes(arrowTails[0]!, arrowTails.at(-1)!));
      }
      const qStart = Math.hypot(load.qxStart ?? 0, load.qyStart ?? 0);
      const qEnd = Math.hypot(load.qxEnd ?? 0, load.qyEnd ?? 0);
      const unit = unitLabel(project.settings.units, 'distributedForce');
      const magnitude = (value: number) => number(toDisplay(value, project.settings.units, 'distributedForce'), 4);
      const text = Math.abs(qStart - qEnd) <= Math.max(qStart, qEnd) * 1e-9
        ? `q = ${magnitude(qStart)} ${unit}`
        : `q = ${magnitude(qStart)} → ${magnitude(qEnd)} ${unit}`;
      const anchor = arrowTails.length ? arrowTails[Math.floor(arrowTails.length / 2)]! : atFlexibleRatio((startRatio + endRatio) / 2);
      const width = fonts.bold.widthOfTextAtSize(pdfText(text), labelSize);
      label(text, anchor.x - width / 2, anchor.y + 4);
    } else if (load.type === 'point') {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      if (position > limit) continue;
      const [gx, gy] = globalVector((load.px ?? 0) * factor, (load.py ?? 0) * factor, position);
      const location = atFlexibleRatio(position);
      const tail = drawArrow(layout, location, gx, gy, actionColor, 22) ?? location;
      options.strokeObstacles?.push(...strokeBoxes(location, tail));
      const magnitude = Math.hypot(load.px ?? 0, load.py ?? 0) * Math.abs(factor);
      label(`P = ${number(toDisplay(magnitude, project.settings.units, 'force'), 4)} ${unitLabel(project.settings.units, 'force')}`, tail.x + 3, tail.y + 4);
    } else {
      const position = Math.min(1, Math.max(0, load.position ?? 0.5));
      if (position > limit) continue;
      const location = atFlexibleRatio(position);
      const value = (load.moment ?? 0) * factor;
      label(`M = ${number(toDisplay(value, project.settings.units, 'moment'), 4)} ${unitLabel(project.settings.units, 'moment')}`, location.x + 4, location.y + 9);
    }
  }
};

/** A `MemberLoad`'s own type, re-exported so callers need not reach into `types.ts`. */
;
