/**
 * El método de secciones en una barra curva, narrado: la geometría del arco, lo que el lado del
 * nudo inicial entrega a la barra, las relaciones de un corte en el ángulo φ, un corte escrito con
 * todos sus números y su cuerpo libre, y la tabla de N, V, M por estaciones junto a lo que da el
 * análisis matricial en los mismos puntos.
 *
 * Nada se calcula aquí: todo viene de `solveStaticsSections` (y de `arcStatics.ts`), que ya lo
 * comprobó contra el solver con la tolerancia del arco mallado. Este archivo también da a la
 * memoria del trabajo mínimo en arcos las piezas comunes: el trazo del trozo conservado sobre la
 * figura de cuerpo libre y las ecuaciones numeradas.
 */
import type { CircularArcGeometry } from '../../graphics/memberCurve';
import { arcPoint, lineOfActionPoint, type Vec2 } from '../../analysis-methods/arcStatics';
import type { ArcStation, MemberCuts } from '../../analysis-methods/staticsSections';
import { asWorkedEquation, drawWorkedEquation, measureWorkedEquation, type EquationInput } from './pdfEquation';
import { number, unitFor } from './pdfFormat';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene, type SceneForce, type SceneMoment } from './pdfFreeBody';
import { createModelProjection, type Rect } from './pdfScene';
import { dimensionalFigure, dimensionalUnit, signedSum } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const SCENE_HEIGHT = 186;
const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
const DEGREES = 180 / Math.PI;

export interface ArcFigures {
  fig: (value: number, forcePower: number, lengthPower: number, reference?: number) => string;
  unit: (forcePower: number, lengthPower: number) => string;
}

export const arcFigures = (context: ReportContext): ArcFigures => ({
  fig: (value, forcePower, lengthPower, reference = value) => dimensionalFigure(context.project, value, forcePower, lengthPower, reference),
  unit: (forcePower, lengthPower) => dimensionalUnit(context.project, forcePower, lengthPower),
});

/** Ecuaciones numeradas, con un pie opcional; una sustitución que es su propio resultado no se repite. */
export const drawArcEquations = (context: ReportContext, caption: string | undefined, equations: readonly EquationInput[]): void => {
  if (!equations.length) return;
  const { layout } = context;
  if (caption) layout.text(caption, 7.9, layout.fonts.bold, layout.palette.ink, 12);
  for (const input of equations) {
    const parsed = asWorkedEquation(input);
    const equation = parsed.substituted !== undefined && parsed.substituted === parsed.result
      ? { ...parsed, substituted: undefined, symbolic: undefined }
      : parsed;
    layout.ensure(measureWorkedEquation(layout, equation, 8.4, 16));
    layout.y -= drawWorkedEquation(layout, equation, 8.4, 16, layout.rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }
};

export const prose = (context: ReportContext, text: string, size = 8.3): void => {
  context.layout.text(text, size, context.layout.fonts.regular, undefined, 8);
};

/** `(1.234)` con signo dentro: un operando que se multiplica. */
const paren = (text: string): string => `(${text})`;

/**
 * La misma proyección que `drawFreeBodyScene` usa para el modelo entero: el marco menos sus
 * márgenes y la franja de la leyenda. Se repite aquí sólo para trazar encima el trozo de arco que
 * el cuerpo libre conserva, que la escena genérica no sabe dibujar sobre una curva.
 */
const sceneProjection = (context: ReportContext, rect: Rect, scene: FreeBodyScene) => {
  const legendHeight = scene.legend ? TYPE.micro * 2.4 + 6 : 0;
  return createModelProjection(context.project, {
    left: rect.x + 58,
    right: rect.x + rect.width - 58,
    bottom: rect.y + 44 + legendHeight,
    top: rect.y + rect.height - 30,
  });
};

/** El trozo [from, to] del arco, en tinta, sobre una figura ya dibujada. */
export const drawRetainedArc = (context: ReportContext, rect: Rect, scene: FreeBodyScene, arc: CircularArcGeometry, from: number, to: number): void => {
  const projection = sceneProjection(context, rect, scene);
  const steps = Math.max(4, Math.ceil(48 * Math.abs(to - from)));
  const points = Array.from({ length: steps + 1 }, (_, k) => {
    const point = arcPoint(arc, from + ((to - from) * k) / steps);
    return projection.at(point.x, point.y);
  });
  for (let k = 1; k < points.length; k += 1) {
    context.layout.page.drawLine({ start: points[k - 1]!, end: points[k]!, thickness: 2, color: context.layout.palette.ink });
  }
};

/** Una figura de cuerpo libre con un trozo de arco en tinta, numerada como las demás. */
export const drawArcScene = (
  context: ReportContext,
  scene: FreeBodyScene,
  caption: string,
  retained?: { arc: CircularArcGeometry; from: number; to: number },
): void => {
  if (context.options.includeMethodFreeBodies === false) return;
  context.layout.figure(sceneHeightFor(context, SCENE_HEIGHT), (rect) => {
    drawFreeBodyScene(context, rect, scene);
    if (retained) drawRetainedArc(context, rect, scene, retained.arc, retained.from, retained.to);
  }, caption);
};

/** N, V y M sobre la cara del corte del cuerpo libre izquierdo, como flechas. */
export const cutFaceMarks = (
  context: ReportContext,
  point: Vec2,
  tangent: Vec2,
  values: { axial: number; shear: number; moment: number },
  scale: { force: number; moment: number },
): { forces: SceneForce[]; moments: SceneMoment[] } => {
  const { fig, unit } = arcFigures(context);
  const normal = { x: -tangent.y, y: tangent.x };
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  const small = (value: number, reference: number) => Math.abs(value) <= 1e-9 * Math.max(1, reference);
  if (!small(values.axial, scale.force)) {
    // The right part pulls the face along +t in tension (an arrow leaving it), pushes it in compression.
    const sense = Math.sign(values.axial);
    forces.push({
      place: { at: point }, fx: tangent.x * sense, fy: tangent.y * sense, tone: 'axial', length: 22,
      anchor: sense > 0 ? 'tail' : 'head', label: `N = ${fig(values.axial, 1, 0, scale.force)} ${unit(1, 0)}`,
    });
  }
  if (!small(values.shear, scale.force)) {
    // On the left body's face the right part acts with −V along the normal.
    const sense = -Math.sign(values.shear);
    forces.push({
      place: { at: point }, fx: normal.x * sense, fy: normal.y * sense, tone: 'shear', length: 22,
      label: `V = ${fig(values.shear, 1, 0, scale.force)} ${unit(1, 0)}`,
    });
  }
  if (!small(values.moment, scale.moment)) {
    moments.push({ place: { at: point }, sign: values.moment, tone: 'moment', label: `M = ${fig(values.moment, 1, 1, scale.moment)} ${unit(1, 1)}` });
  }
  return { forces, moments };
};

/** Una línea de corte corta, a través del arco en su punto, a lo largo de la normal. */
export const cutLine = (arc: CircularArcGeometry, point: Vec2, tangent: Vec2, label: string) => {
  const half = 0.07 * Math.max(arc.chord, arc.radius);
  const normal = { x: -tangent.y, y: tangent.x };
  return {
    from: { x: point.x - normal.x * half, y: point.y - normal.y * half },
    to: { x: point.x + normal.x * half, y: point.y + normal.y * half },
    label,
    labelAt: 'end' as const,
  };
};

/** La geometría del arco, con sus fórmulas. */
export const drawArcGeometry = (context: ReportContext, arc: CircularArcGeometry, bulge: number, memberId: string): void => {
  const { fig, unit } = arcFigures(context);
  const sweep = Math.abs(arc.sweep);
  drawArcEquations(context, `Geometría del arco ${memberId} (cuerda c y flecha relativa b = ${number(bulge, 5)} del modelo):`, [
    {
      lhs: 'R', symbolic: 'c(1 + b^2)/(4|b|)',
      substituted: `${paren(fig(arc.chord, 0, 1))}(1 + ${paren(number(bulge, 5))}^2)/(4·${number(Math.abs(bulge), 5)})`,
      result: fig(arc.radius, 0, 1), unit: unit(0, 1),
    },
    { lhs: 'Δθ', symbolic: '4 arctan|b|', substituted: `4 arctan(${number(Math.abs(bulge), 5)})`, result: `${number(sweep, 6)} rad = ${number(sweep * DEGREES, 5)}°` },
    { lhs: 'L', symbolic: 'R Δθ', substituted: `${paren(fig(arc.radius, 0, 1))}${paren(number(sweep, 6))}`, result: fig(arc.length, 0, 1), unit: unit(0, 1) },
  ]);
  context.layout.keyValues([
    ['Centro', `(${fig(arc.center.x, 0, 1)}, ${fig(arc.center.y, 0, 1)}) ${unit(0, 1)}`],
    ['Punto a la distancia s', 'x = x_c + R cos θ, y = y_c + R sen θ, con θ = θ_i + (s/L)·Δθ con el signo del giro'],
    ['Tangente y normal', 't = (cos φ, sen φ) en el sentido i → j; n = (−sen φ, cos φ), a la izquierda; φ = θ ± 90°'],
  ], 130);
};

const QUANTITY_HEADERS = (context: ReportContext) => {
  const force = unitFor(context.project, 'force');
  const moment = unitFor(context.project, 'moment');
  return { force, moment };
};

/** La tabla por estaciones: estática y solver lado a lado. */
const drawStationTable = (context: ReportContext, stations: readonly ArcStation[], scale: { force: number; moment: number }): void => {
  const { fig } = arcFigures(context);
  const length = unitFor(context.project, 'length');
  const { force, moment } = QUANTITY_HEADERS(context);
  context.layout.table(
    [
      { header: `s (${length})`, ...NUMERIC },
      { header: `x (${length})`, ...NUMERIC },
      { header: `y (${length})`, ...NUMERIC },
      { header: 'φ (°)', ...NUMERIC },
      { header: `N (${force})`, ...NUMERIC },
      { header: `V (${force})`, ...NUMERIC },
      { header: `M (${moment})`, ...NUMERIC },
      { header: `N mat. (${force})`, ...NUMERIC },
      { header: `V mat. (${force})`, ...NUMERIC },
      { header: `M mat. (${moment})`, ...NUMERIC },
    ],
    stations.map((station, index) => [
      `${fig(station.s, 0, 1)}${index === 0 ? '⁺' : index === stations.length - 1 ? '⁻' : ''}`,
      fig(station.point.x, 0, 1),
      fig(station.point.y, 0, 1),
      number(station.slope * DEGREES, 4),
      fig(station.axial, 1, 0, scale.force),
      fig(station.shear, 1, 0, scale.force),
      fig(station.moment, 1, 1, scale.moment),
      fig(station.solver.axial, 1, 0, scale.force),
      fig(station.solver.shear, 1, 0, scale.force),
      fig(station.solver.moment, 1, 1, scale.moment),
    ]),
    { size: 6.8 },
  );
};

/** Las relaciones generales de un corte en un arco: una vez, en símbolos. */
export const drawArcCutRelations = (context: ReportContext, startNodeId: string): void => {
  prose(context, `Corte a la distancia s de ${startNodeId}, en el punto P = (x_P, y_P) con tangente de inclinación φ. El cuerpo `
    + `libre izquierdo es el lado de ${startNodeId} más el trozo de arco [0, s] con sus cargas; F₀ y M₀(i) son la fuerza y el `
    + 'momento del lado respecto al nudo i, y la carga del trozo se integra a lo largo de la curva:');
  drawArcEquations(context, undefined, [
    'ΣF_x(s) = F₀x + ∫ q_x dL',
    'ΣF_y(s) = F₀y + ∫ q_y dL',
    'ΣM(P) = M₀(i) + (x_i − x_P)F₀y − (y_i − y_P)F₀x + ∫ [(x − x_P)q_y − (y − y_P)q_x] dL',
    'N(s) = −(ΣF_x cos φ + ΣF_y sen φ)',
    'V(s) = −ΣF_x sen φ + ΣF_y cos φ',
    'M(s) = −ΣM(P)',
  ]);
};

/** Un corte con todos sus números: la carga del trozo, las sumas y N, V, M. */
const drawWorkedCut = (context: ReportContext, member: MemberCuts, scale: { force: number; moment: number }): void => {
  const arc = member.arc!;
  const { fig, unit } = arcFigures(context);
  const { start } = member;
  const station = arc.worked;
  const origin = arc.geometry.start;
  const cos = Math.cos(station.slope);
  const sin = Math.sin(station.slope);
  const dx = origin.x - station.point.x;
  const dy = origin.y - station.point.y;
  const force = (value: number) => fig(value, 1, 0, scale.force);
  const moment = (value: number) => fig(value, 1, 1, scale.moment);
  prose(context, `Corte donde |M| es mayor: s = ${fig(station.s, 0, 1)} ${unit(0, 1)} (s/L = ${number(station.t, 5)}), `
    + `P = (${fig(station.point.x, 0, 1)}, ${fig(station.point.y, 0, 1)}) ${unit(0, 1)}, φ = ${number(station.slope * DEGREES, 5)}°. `
    + `Las cargas del trozo [0, s] suman F = (${force(station.load.fx)}, ${force(station.load.fy)}) ${unit(1, 0)} y, respecto a P, `
    + `${moment(station.load.moment)} ${unit(1, 1)}.`);
  drawArcEquations(context, undefined, [
    { lhs: 'ΣF_x(s)', substituted: signedSum([force(start.fx), force(station.load.fx)]), result: force(station.left.fx), unit: unit(1, 0) },
    { lhs: 'ΣF_y(s)', substituted: signedSum([force(start.fy), force(station.load.fy)]), result: force(station.left.fy), unit: unit(1, 0) },
    {
      lhs: 'ΣM(P)',
      substituted: signedSum([
        moment(start.moment),
        `${paren(fig(dx, 0, 1))}${paren(force(start.fy))}`,
        `−${paren(fig(dy, 0, 1))}${paren(force(start.fx))}`,
        moment(station.load.moment),
      ]),
      result: moment(station.left.moment), unit: unit(1, 1),
    },
    {
      lhs: 'N(s)', symbolic: '−(ΣF_x cos φ + ΣF_y sen φ)',
      substituted: `−(${paren(force(station.left.fx))}${paren(number(cos, 5))} + ${paren(force(station.left.fy))}${paren(number(sin, 5))})`,
      result: force(station.axial), unit: unit(1, 0),
    },
    {
      lhs: 'V(s)', symbolic: '−ΣF_x sen φ + ΣF_y cos φ',
      substituted: `−${paren(force(station.left.fx))}${paren(number(sin, 5))} + ${paren(force(station.left.fy))}${paren(number(cos, 5))}`,
      result: force(station.shear), unit: unit(1, 0),
    },
    { lhs: 'M(s)', symbolic: '−ΣM(P)', substituted: `−(${moment(station.left.moment)})`, result: moment(station.moment), unit: unit(1, 1) },
  ]);

  // The free body: the side of node i in ink, the arc up to the cut traced over it.
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  for (const action of start.actions) {
    const reaction = action.label.startsWith('R_') || action.label.startsWith('M_R');
    if (action.couple) moments.push({ place: { at: action.at }, sign: action.couple, label: action.label, tone: reaction ? 'reaction' : 'load' });
    if (action.fx || action.fy) {
      forces.push({ place: { at: action.at }, fx: action.fx, fy: action.fy, label: action.label, tone: reaction ? 'reaction' : 'load', length: 24 });
    }
  }
  const loadAt = lineOfActionPoint(station.load, station.point, arcPoint(arc.geometry, station.t / 2));
  if (loadAt && Math.hypot(station.load.fx, station.load.fy) > 1e-9 * scale.force) {
    forces.push({
      place: { at: loadAt }, fx: station.load.fx, fy: station.load.fy, tone: 'load', length: 26,
      label: `W = ${force(Math.hypot(station.load.fx, station.load.fy))} ${unit(1, 0)}`,
    });
  }
  const face = cutFaceMarks(context, station.point, station.tangent, station, scale);
  drawArcScene(context, {
    title: `corte en s = ${fig(station.s, 0, 1)} ${unit(0, 1)}`,
    keptNodeIds: start.nodeIds,
    keptMemberIds: start.memberIds,
    includeMemberLoads: true,
    cut: cutLine(arc.geometry, station.point, station.tangent, 's'),
    forces: [...forces, ...face.forces],
    moments: [...moments, ...face.moments],
    legend: 'En tinta, el cuerpo libre izquierdo: el lado del nudo inicial y el trozo de arco hasta el corte. W es la '
      + 'resultante de la carga del trozo; en la cara del corte, N (positiva a tensión), V y M con el sentido que actúan.',
  }, `Barra ${member.memberId}: cuerpo libre izquierdo cortado en s = ${fig(station.s, 0, 1)} ${unit(0, 1)}.`, {
    arc: arc.geometry, from: 0, to: station.t,
  });
};

export const drawArcMemberCuts = (context: ReportContext, member: MemberCuts, scale: { force: number; moment: number }): void => {
  const arc = member.arc;
  if (!arc) return;
  const { layout } = context;
  const { fig, unit } = arcFigures(context);
  const { start } = member;
  const model = context.index.member(member.memberId);
  layout.heading(`Barra ${member.memberId}: ${member.startNodeId} → ${member.endNodeId} (arco circular)`, 3);
  drawArcGeometry(context, arc.geometry, model?.curve?.bulge ?? 0, member.memberId);

  const others = start.memberIds.length ? ` y las barras ${start.memberIds.join(', ')}` : '';
  prose(context, `Al cortar ${member.memberId} justo después de ${member.startNodeId}, a ese lado quedan los nudos `
    + `{${start.nodeIds.join(', ')}}${others}, con las acciones ${start.actions.map((action) => action.label).join(', ') || 'ninguna'}. `
    + 'Su resultante es lo que el inicio del arco recibe.');
  const force = (value: number) => fig(value, 1, 0, scale.force);
  const cos = Math.cos(Math.atan2(member.s, member.c));
  const sin = Math.sin(Math.atan2(member.s, member.c));
  drawArcEquations(context, `Lado de ${member.startNodeId}, y fuerzas internas en s = 0⁺ (φ₀ = ${number(Math.atan2(member.s, member.c) * DEGREES, 5)}°):`, [
    { lhs: 'F₀x', result: force(start.fx), unit: unit(1, 0) },
    { lhs: 'F₀y', result: force(start.fy), unit: unit(1, 0) },
    { lhs: `M₀(${member.startNodeId})`, result: fig(start.moment, 1, 1, scale.moment), unit: unit(1, 1) },
    {
      lhs: 'N₀', symbolic: '−(F₀x cos φ₀ + F₀y sen φ₀)',
      substituted: `−(${paren(force(start.fx))}${paren(number(cos, 5))} + ${paren(force(start.fy))}${paren(number(sin, 5))})`,
      result: force(start.axial), unit: unit(1, 0),
    },
    {
      lhs: 'V₀', symbolic: '−F₀x sen φ₀ + F₀y cos φ₀',
      substituted: `−${paren(force(start.fx))}${paren(number(sin, 5))} + ${paren(force(start.fy))}${paren(number(cos, 5))}`,
      result: force(start.shear), unit: unit(1, 0),
    },
  ]);
  drawArcCutRelations(context, member.startNodeId);
  drawWorkedCut(context, member, scale);

  prose(context, `Los mismos cortes cada doceavo del arco (s = 0⁺ y L⁻ en los extremos), junto a lo que da el análisis `
    + `matricial en el mismo punto. El solver sustituye el arco por ${arc.solverChords} cuerdas, cuya mayor separación del `
    + `arco es δ = ${fig(arc.chordSagitta, 0, 1)} ${unit(0, 1)}; por eso la diferencia admitida es relativa, ${number(arc.tolerance, 3)} `
    + '(el mayor entre 0.001 y 2δ/f, con f la flecha del arco).');
  drawStationTable(context, arc.stations, scale);
  layout.text(
    `Momento de mayor valor absoluto en ${member.memberId}: M = ${fig(member.peakMoment.value, 1, 1, scale.moment)} ${unit(1, 1)} `
    + `en s = ${fig(member.peakMoment.s, 0, 1)} ${unit(0, 1)}. Diferencia máxima contra el solver en las estaciones `
    + `comprobadas: ${fig(arc.residual.force, 1, 0, scale.force)} ${unit(1, 0)} en N y V, ${fig(arc.residual.moment, 1, 1, scale.moment)} ${unit(1, 1)} en M.`,
    8.3, layout.fonts.bold, layout.palette.ink, 8,
  );
};
