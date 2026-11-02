/**
 * El método de secciones en una barra curva, como memoria: la geometría del arco, lo que el lado
 * del nudo inicial entrega a la barra, las relaciones de un corte en el ángulo φ, un corte escrito
 * con todos sus números y su cuerpo libre, y la tabla de N, V, M por estaciones junto a lo que da
 * el análisis matricial en los mismos puntos.
 *
 * Nada se calcula aquí: todo viene de `solveStaticsSections` (y de `arcStatics.ts`), que ya lo
 * comprobó contra el solver con la tolerancia del arco mallado. Este archivo también da a la
 * memoria del trabajo mínimo en arcos las piezas comunes: el trazo del trozo conservado sobre la
 * figura de cuerpo libre y las ecuaciones numeradas.
 */
import type { CircularArcGeometry } from '../../graphics/memberCurve';
import { arcPoint, lineOfActionPoint, type Vec2 } from '../../analysis-methods/arcStatics';
import type { ArcStation, MemberCuts } from '../../analysis-methods/staticsSections';
import { asWorkedEquation, type EquationInput } from './pdfEquation';
import { number, unitFor } from './pdfFormat';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene, type SceneForce, type SceneMoment } from './pdfFreeBody';
import { mathRuns, measureRuns } from './pdfInlineMath';
import { mathFaces } from './pdfMath';
import { memoirCheck, memoirFormula, memoirNote, memoirWork } from './pdfMemoirKit';
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

/** Desarrollo numerado, con un pie opcional; una sustitución que es su propio resultado no se repite. */
export const drawArcEquations = (context: ReportContext, caption: string | undefined, equations: readonly EquationInput[]): void => {
  if (!equations.length) return;
  memoirWork(context, equations.map((input) => {
    const parsed = asWorkedEquation(input);
    return parsed.substituted !== undefined && parsed.substituted === parsed.result
      ? { ...parsed, substituted: undefined, symbolic: undefined }
      : parsed;
  }), caption);
};

/** Un párrafo corto, con la letra del texto de la memoria. */
export const prose = (context: ReportContext, text: string, size?: number): void => {
  if (size === undefined) memoirNote(context, text);
  else context.layout.text(text, size, context.layout.fonts.regular, context.layout.palette.ink, 0);
};

/**
 * Una ecuación de planteamiento con varias relaciones: en un renglón si cabe y, si no, partida
 * entre relaciones; el «donde:» va al final. `memoirFormula` no parte renglones.
 */
export const memoirFormulaParts = (
  context: ReportContext,
  parts: readonly string[],
  where: ReadonlyArray<readonly [symbol: string, meaning: string]> = [],
): void => {
  const faces = mathFaces(context.layout);
  const available = context.layout.contentWidth - 40;
  const lines: string[] = [];
  for (const part of parts) {
    const last = lines[lines.length - 1];
    const joined = last === undefined ? part : `${last},    ${part}`;
    if (last !== undefined && measureRuns(mathRuns(joined), faces, TYPE.math + 1) <= available) lines[lines.length - 1] = joined;
    else lines.push(part);
  }
  lines.forEach((line, index) => memoirFormula(context, line, index === lines.length - 1 ? where : []));
};

/** La comprobación en su renglón: si el texto completo no cabe, la versión corta. */
export const memoirCheckFitted = (context: ReportContext, text: string, short: string, ok: boolean): void => {
  const { layout } = context;
  const prefix = ok ? 'Comprobación: ' : 'Comprobación (revisar): ';
  memoirCheck(context, layout.richWidth(`${prefix}${text}`, layout.fonts.bold, TYPE.body) <= layout.contentWidth ? text : short, ok);
};

/** `(1.234)` con signo dentro: un operando que se multiplica. */
const paren = (text: string): string => `(${text})`;

/**
 * El arco se integra por estaciones: un cortante de 4 × 10⁻⁷ kN junto a cargas de cien es ruido de
 * la cuadratura y se escribe 0.
 */
const quiet = (value: number, scale: number): number => (Math.abs(value) <= 1e-7 * Math.max(1, Math.abs(scale)) ? 0 : value);

/** Signo menos tipográfico en una cifra suelta del texto o de una tabla. */
const signed = (text: string): string => text.replace(/^-(?=[\d.])/, '−');

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
  drawArcEquations(context, `Geometría del arco ${memberId}: cuerda c, flecha relativa b = ${number(bulge, 5)}`, [
    {
      lhs: 'R', symbolic: 'c(1 + b^2)/(4|b|)',
      substituted: `${paren(fig(arc.chord, 0, 1))}(1 + ${paren(number(bulge, 5))}^2)/(4·${number(Math.abs(bulge), 5)})`,
      result: fig(arc.radius, 0, 1), unit: unit(0, 1),
    },
    { lhs: 'Δθ', symbolic: '4 arctan|b|', substituted: `4 arctan(${number(Math.abs(bulge), 5)})`, result: `${number(sweep, 6)} rad = ${number(sweep * DEGREES, 5)}°` },
    { lhs: 'L', symbolic: 'R Δθ', substituted: `${paren(fig(arc.radius, 0, 1))}${paren(number(sweep, 6))}`, result: fig(arc.length, 0, 1), unit: unit(0, 1) },
  ]);
  memoirNote(context, `Centro (x_c, y_c) = (${signed(fig(arc.center.x, 0, 1))}, ${signed(fig(arc.center.y, 0, 1))}) ${unit(0, 1)}. A la distancia s: `
    + 'θ = θ_i ± (s/L) Δθ, x = x_c + R cos θ, y = y_c + R sen θ; tangente de i a j con inclinación φ = θ ± 90°.');
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
      ...[
        fig(station.point.x, 0, 1),
        fig(station.point.y, 0, 1),
        number(station.slope * DEGREES, 4),
        fig(quiet(station.axial, scale.force), 1, 0, scale.force),
        fig(quiet(station.shear, scale.force), 1, 0, scale.force),
        fig(quiet(station.moment, scale.moment), 1, 1, scale.moment),
        fig(quiet(station.solver.axial, scale.force), 1, 0, scale.force),
        fig(quiet(station.solver.shear, scale.force), 1, 0, scale.force),
        fig(quiet(station.solver.moment, scale.moment), 1, 1, scale.moment),
      ].map(signed),
    ]),
    { size: 6.8 },
  );
};

/** Las relaciones generales de un corte en un arco: una vez, en símbolos. */
export const drawArcCutRelations = (context: ReportContext, startNodeId: string): void => {
  memoirNote(context, `Corte a la distancia s de ${startNodeId}, en P = (x_P, y_P) con tangente de inclinación φ; `
    + `se conserva el lado de ${startNodeId} y el trozo de arco [0, s].`);
  memoirFormulaParts(context, ['ΣF_x = F_{0x} + ∫ q_x dL', 'ΣF_y = F_{0y} + ∫ q_y dL']);
  memoirFormulaParts(context, ['ΣM_P = M_0 + (x_i − x_P) F_{0y} − (y_i − y_P) F_{0x} + ∫ m_q dL']);
  memoirFormulaParts(context, ['N(s) = −(ΣF_x cos φ + ΣF_y sen φ)', 'V(s) = −ΣF_x sen φ + ΣF_y cos φ', 'M(s) = −ΣM_P'], [
    ['F_0, M_0', `fuerza y momento del lado de ${startNodeId}, respecto al nudo i`],
    ['q_x, q_y', 'carga del trozo por unidad de longitud de arco'],
    ['m_q', '(x − x_P) q_y − (y − y_P) q_x, momento de la carga respecto a P'],
    ['N, V, M', 'N positiva a tensión; V y M con el sentido de las barras rectas'],
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
  const force = (value: number) => fig(quiet(value, scale.force), 1, 0, scale.force);
  const moment = (value: number) => fig(quiet(value, scale.moment), 1, 1, scale.moment);
  memoirNote(context, `Corte de |M| máximo: s = ${fig(station.s, 0, 1)} ${unit(0, 1)} (s/L = ${number(station.t, 5)}), `
    + `P = (${signed(fig(station.point.x, 0, 1))}, ${signed(fig(station.point.y, 0, 1))}) ${unit(0, 1)}, φ = ${signed(number(station.slope * DEGREES, 5))}°; `
    + `carga del trozo (${signed(force(station.load.fx))}, ${signed(force(station.load.fy))}) ${unit(1, 0)} y momento ${signed(moment(station.load.moment))} ${unit(1, 1)} respecto a P.`);
  drawArcEquations(context, undefined, [
    { lhs: 'ΣF_x', substituted: signedSum([force(start.fx), force(station.load.fx)]), result: force(station.left.fx), unit: unit(1, 0) },
    { lhs: 'ΣF_y', substituted: signedSum([force(start.fy), force(station.load.fy)]), result: force(station.left.fy), unit: unit(1, 0) },
    {
      lhs: 'ΣM_P',
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
    { lhs: 'M(s)', symbolic: '−ΣM_P', substituted: `−(${moment(station.left.moment)})`, result: moment(station.moment), unit: unit(1, 1) },
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
    legend: 'En tinta, el lado del nudo inicial y el trozo de arco hasta el corte; W, la carga del trozo; en la cara, N, V y M.',
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

  const others = start.memberIds.length ? ` y ${start.memberIds.join(', ')}` : '';
  memoirNote(context, `Lado de ${member.startNodeId}: nudos ${start.nodeIds.join(', ')}${others}; `
    + `acciones ${start.actions.map((action) => action.label).join(', ') || 'ninguna'}.`);
  const force = (value: number) => fig(value, 1, 0, scale.force);
  const cos = Math.cos(Math.atan2(member.s, member.c));
  const sin = Math.sin(Math.atan2(member.s, member.c));
  drawArcEquations(context, `Acciones del lado de ${member.startNodeId} y fuerzas internas en s = 0⁺, con φ_0 = ${number(Math.atan2(member.s, member.c) * DEGREES, 5)}°`, [
    { lhs: 'F_{0x}', result: force(start.fx), unit: unit(1, 0) },
    { lhs: 'F_{0y}', result: force(start.fy), unit: unit(1, 0) },
    { lhs: 'M_0', result: fig(start.moment, 1, 1, scale.moment), unit: unit(1, 1) },
    {
      lhs: 'N_0', symbolic: '−(F_{0x} cos φ_0 + F_{0y} sen φ_0)',
      substituted: `−(${paren(force(start.fx))}${paren(number(cos, 5))} + ${paren(force(start.fy))}${paren(number(sin, 5))})`,
      result: force(start.axial), unit: unit(1, 0),
    },
    {
      lhs: 'V_0', symbolic: '−F_{0x} sen φ_0 + F_{0y} cos φ_0',
      substituted: `−${paren(force(start.fx))}${paren(number(sin, 5))} + ${paren(force(start.fy))}${paren(number(cos, 5))}`,
      result: force(start.shear), unit: unit(1, 0),
    },
  ]);
  drawArcCutRelations(context, member.startNodeId);
  drawWorkedCut(context, member, scale);

  memoirNote(context, `Cortes cada doceavo del arco junto al análisis matricial («mat.»), que modela el arco con ${arc.solverChords} cuerdas `
    + `(separación máxima δ = ${fig(arc.chordSagitta, 0, 1)} ${unit(0, 1)}); diferencia admitida ${number(arc.tolerance, 3)}, relativa (mayor de 0.001 y 2δ/f).`);
  drawStationTable(context, arc.stations, scale);
  memoirNote(context, `Diferencia máxima con el análisis matricial en ${member.memberId}: ${fig(arc.residual.force, 1, 0, scale.force)} ${unit(1, 0)} `
    + `en N y V, ${fig(arc.residual.moment, 1, 1, scale.moment)} ${unit(1, 1)} en M.`);
};
