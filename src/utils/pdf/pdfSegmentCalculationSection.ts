/**
 * Calculation sheets organised exactly where the solver changes expression: one free body and
 * one set of N/V/M equations for every member segment.  A global result curve is useful as a
 * summary, but it cannot replace the cut that explains why a polynomial applies on a given
 * interval.
 */
import { evaluateDiagramAt, evaluateSegment } from '../../engine/diagram';
import { circularMemberGeometry, curveTangentAt } from '../../graphics/memberCurve';
import { memberAxis } from '../../graphics/structureGeometry';
import { toDisplay } from '../../foundation/units';
import { clearCell, clearDisplay, clearNumber, display, formatPolynomial, number, quantityUnit, unitFor } from './pdfFormat';
import { memoirNote, memoirWork } from './pdfMemoirKit';
import type { WorkedEquation } from './pdfEquation';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene } from './pdfFreeBody';
import type { AnalysisResult } from '../../types';
import type { ReportContext } from './reportContext';

type MemberResult = AnalysisResult['memberResults'][number];
type Segment = MemberResult['diagramSegments'][number];

const clamp = (value: number, lower: number, upper: number): number => Math.max(lower, Math.min(upper, value));

/** The left free body of one member cut inside one stretch; the Method of Sections reuses it. */
export const segmentScene = (
  context: ReportContext,
  result: MemberResult,
  segment: Segment,
  segmentNumber: number,
): FreeBodyScene | undefined => {
  const { project, index } = context;
  const member = index.member(result.memberId);
  const ni = member ? index.node(member.i) : undefined;
  const nj = member ? index.node(member.j) : undefined;
  if (!member || !ni || !nj) return undefined;

  const axis = memberAxis(member, ni, nj);
  if (!(axis.length > 0)) return undefined;
  const station = (segment.x0 + segment.x1) / 2;
  const startOffset = result.startOffset ?? member.rigidOffsetI ?? 0;
  const ratio = clamp((startOffset + station) / axis.length, 0.04, 0.96);
  const at = { x: ni.x + (nj.x - ni.x) * ratio, y: ni.y + (nj.y - ni.y) * ratio };
  const cutSize = Math.max(axis.length * 0.08, 0.35);
  const values = evaluateSegment(segment, station);
  const sign = (value: number) => value >= 0 ? 1 : -1;
  const forceReference = Math.max(Math.abs(values.axial), Math.abs(values.shear), 1e-12);
  const momentReference = Math.max(Math.abs(values.moment), 1e-12);

  return {
    title: `barra ${member.id} · tramo ${segmentNumber} · corte en s`,
    keptMemberIds: [member.id],
    keptNodeIds: [member.i, member.j],
    hideGhost: true,
    partialMember: { memberId: member.id, ratio, keep: 'start' },
    includeMemberLoads: true,
    cut: {
      from: { x: at.x - axis.normal.x * cutSize, y: at.y - axis.normal.y * cutSize },
      to: { x: at.x + axis.normal.x * cutSize, y: at.y + axis.normal.y * cutSize },
      label: `s = ${display(project, station, 'length')}`,
      labelAt: 'end',
    },
    forces: [
      {
        place: { at }, fx: axis.c * sign(values.axial), fy: axis.s * sign(values.axial), anchor: 'tail',
        label: `N(s) = ${clearDisplay(project, values.axial, 'force', forceReference)}`, tone: 'axial', length: 25,
      },
      {
        place: { at }, fx: axis.normal.x * sign(values.shear), fy: axis.normal.y * sign(values.shear), anchor: 'tail',
        label: `V(s) = ${clearDisplay(project, values.shear, 'force', forceReference)}`, tone: 'shear', length: 25,
      },
    ],
    moments: [{ place: { at }, sign: values.moment, label: `M(s) = ${clearDisplay(project, values.moment, 'moment', momentReference)}`, tone: 'moment' }],
    legend: 'Se conserva el cuerpo libre izquierdo. Las cargas visibles son las reales hasta el corte; N, V y M se leen en los ejes locales de la barra.',
  };
};

/** `c₀ + c₁(ξ) + c₂(ξ)²` con ξ ya sustituido, para la línea que evalúa el corte. */
const substitutedPolynomial = (coefficients: readonly number[], at: string): string => {
  const reference = Math.max(1, ...coefficients.map((value) => Math.abs(value)));
  const terms = coefficients.flatMap((coefficient, power) => {
    if (Math.abs(coefficient) <= reference * 1e-10) return [];
    const magnitude = clearNumber(Math.abs(coefficient), reference, 5);
    const factor = power === 0 ? magnitude : power === 1 ? `${magnitude}(${at})` : `${magnitude}(${at})^${power}`;
    return [{ negative: coefficient < 0, factor }];
  });
  return terms.map((term, index) => index === 0 ? `${term.negative ? '−' : ''}${term.factor}` : `${term.negative ? '−' : '+'} ${term.factor}`).join(' ') || '0';
};

/**
 * Las funciones del tramo y su valor en el corte, en una línea cada una:
 * `M(ξ) = 49.74 ξ − 13.27 ξ² = 49.74(2.5) − 13.27(2.5)² = 41.4 kN·m`.
 */
const drawEquations = (context: ReportContext, segment: Segment): void => {
  const { project } = context;
  const middle = (segment.x0 + segment.x1) / 2;
  const values = evaluateSegment(segment, middle);
  const lengthScale = toDisplay(1, project.settings.units, 'length');
  const station = clearNumber((middle - segment.x0) * lengthScale, Math.max(1, segment.x1 * lengthScale), 5);
  const equations: WorkedEquation[] = (['axial', 'shear', 'moment'] as const).map((key) => {
    const symbol = key === 'axial' ? 'N' : key === 'shear' ? 'V' : 'M';
    const unit = unitFor(project, quantityUnit(key));
    const polynomial = formatPolynomial(project, key, segment[key], 'ξ');
    const value = clearCell(project, values[key], quantityUnit(key));
    if (polynomial === '0') return { lhs: `${symbol}(ξ)`, result: '0', unit };
    // Los coeficientes en unidades de presentación, igual que `formatPolynomial`, para que la
    // sustitución dé, con la calculadora, la cifra impresa.
    const yScale = toDisplay(1, project.settings.units, quantityUnit(key));
    const converted = segment[key].map((coefficient, power) => coefficient * yScale / lengthScale ** power);
    const xi = (middle - segment.x0) * lengthScale;
    const evaluated = converted.reduce((sum, coefficient, power) => sum + coefficient * xi ** power, 0);
    const closes = Math.abs(evaluated - values[key] * yScale) <= 1e-6 * Math.max(1, ...converted.map(Math.abs));
    const constant = converted.slice(1).every((coefficient) => Math.abs(coefficient) <= Math.max(1, ...converted.map(Math.abs)) * 1e-10);
    if (constant) return { lhs: `${symbol}(ξ)`, result: value, unit };
    return closes
      ? { lhs: `${symbol}(ξ)`, symbolic: polynomial, substituted: substitutedPolynomial(converted, station), result: value, unit }
      : { lhs: `${symbol}(ξ)`, substituted: polynomial, unit };
  });
  const origin = segment.x0 > 0 ? `ξ = s − ${display(project, segment.x0, 'length')}` : 'ξ = s';
  memoirWork(context, equations, `Funciones del tramo (${origin}) y su valor en el corte, ξ = ${station} ${unitFor(project, 'length')}:`);
};

/**
 * Una barra curva no se corta tramo a tramo: el solver la resuelve con una malla interna de
 * cuerdas y sus «tramos» son cientos (la memoria de un arco llegaba a 193 páginas). Se escribe
 * como en un libro: N, V y M a lo largo del arco, en estaciones, con la tangente de cada una.
 */
const drawCurvedMember = (context: ReportContext, result: AnalysisResult['memberResults'][number]): void => {
  const { layout, project, index } = context;
  const member = index.member(result.memberId);
  const i = member ? index.node(member.i) : undefined;
  const j = member ? index.node(member.j) : undefined;
  const arc = member && i && j ? circularMemberGeometry(member, i, j) : undefined;
  if (!member || !arc) return;
  layout.heading(`Barra curva ${member.id}: ${member.i} → ${member.j}`, 2);
  memoirNote(context, `Arco circular; s se mide sobre el arco desde ${member.i}. N es tangente al arco y V normal, a la izquierda de i → j.`);
  layout.table([
    { header: `Radio (${unitFor(project, 'length')})`, align: 'right' },
    { header: `Cuerda (${unitFor(project, 'length')})`, align: 'right' },
    { header: `Longitud (${unitFor(project, 'length')})`, align: 'right' },
  ], [[clearCell(project, arc.radius, 'length'), clearCell(project, arc.chord, 'length'), clearCell(project, arc.length, 'length')]]);
  const stations = 12;
  const reference = (quantity: 'axial' | 'shear' | 'moment') => Math.max(1, ...result.criticalPoints.filter((point) => point.quantity === quantity).map((point) => Math.abs(point.value)));
  const rows = Array.from({ length: stations + 1 }, (_, k) => {
    const s = arc.length * k / stations;
    const value = evaluateDiagramAt(result.diagramSegments, result.diagramJumps, s, k === stations ? 'left' : 'right');
    const tangent = curveTangentAt(arc, k / stations);
    const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
    return [
      clearCell(project, s, 'length'),
      number(angle, 4),
      clearCell(project, value?.axial ?? 0, 'force', reference('axial')),
      clearCell(project, value?.shear ?? 0, 'force', reference('shear')),
      clearCell(project, value?.moment ?? 0, 'moment', reference('moment')),
    ];
  });
  layout.table([
    { header: `s (${unitFor(project, 'length')})`, align: 'right' },
    { header: 'Tangente (°)', align: 'right' },
    { header: `N (${unitFor(project, 'force')})`, align: 'right' },
    { header: `V (${unitFor(project, 'force')})`, align: 'right' },
    { header: `M (${unitFor(project, 'moment')})`, align: 'right' },
  ], rows);
  const extreme = (quantity: 'axial' | 'shear' | 'moment', kind: 'maximum' | 'minimum') => result.criticalPoints.find((point) => point.quantity === quantity && point.kind === kind);
  const extremes = (['axial', 'shear', 'moment'] as const).flatMap((quantity) => {
    const max = extreme(quantity, 'maximum');
    const min = extreme(quantity, 'minimum');
    if (!max && !min) return [];
    const unit = quantity === 'moment' ? 'moment' as const : 'force' as const;
    const cell = (point: typeof max) => point ? clearCell(project, point.value, unit, reference(quantity)) : '—';
    const where = (point: typeof max) => point ? clearCell(project, point.x, 'length') : '—';
    return [[`${quantity === 'axial' ? 'N' : quantity === 'shear' ? 'V' : 'M'} (${unitFor(project, unit)})`, cell(max), where(max), cell(min), where(min)]];
  });
  if (extremes.length) {
    layout.table([
      { header: 'Extremos en el arco' },
      { header: 'Máximo', align: 'right' },
      { header: `en s (${unitFor(project, 'length')})`, align: 'right' },
      { header: 'Mínimo', align: 'right' },
      { header: `en s (${unitFor(project, 'length')})`, align: 'right' },
    ], extremes);
  }
};

export const drawSegmentCalculationPart = (context: ReportContext): void => {
  const { layout, analysis, project } = context;
  layout.part(
    'Cálculo por miembro y por tramo',
    'Cada tramo de cada barra: cuerpo libre, corte y funciones N, V y M.',
  );
  if (!analysis.memberResults.length) {
    layout.note('El análisis no dio barras que documentar por tramos.');
    return;
  }

  // Una barra de armadura sólo lleva N constante: cortarla tramo a tramo llenaba decenas de
  // páginas con N(ξ) = cte, V = 0, M = 0. Sus fuerzas van en una tabla.
  const trussResults = analysis.memberResults.filter((result) => context.index.member(result.memberId)?.type === 'truss');
  if (trussResults.length) {
    layout.heading('Barras de armadura', 2);
    memoirNote(context, 'Barras articuladas sin carga entre sus extremos: N constante y V = M = 0.');
    const reference = Math.max(1, ...trussResults.map((result) => Math.abs(result.diagram[0]?.axial ?? 0)));
    layout.table([
      { header: 'Barra', width: 60 },
      { header: 'Nudos', width: 90 },
      { header: `Longitud (${unitFor(project, 'length')})`, align: 'right' },
      { header: `N (${unitFor(project, 'force')})`, align: 'right' },
      { header: 'Estado', width: 90 },
    ], trussResults.map((result) => {
      const member = context.index.member(result.memberId)!;
      const axial = result.diagram[0]?.axial ?? 0;
      const state = Math.abs(axial) <= reference * 1e-9 ? 'sin fuerza' : axial > 0 ? 'tensión' : 'compresión';
      return [member.id, `${member.i} → ${member.j}`, clearCell(project, result.length, 'length'), clearCell(project, axial, 'force', reference), state];
    }));
  }

  for (const result of analysis.memberResults) {
    const member = context.index.member(result.memberId);
    if (!member || !result.diagramSegments.length || member.type === 'truss') continue;
    if (member.curve) {
      drawCurvedMember(context, result);
      continue;
    }
    layout.heading(`Barra ${member.id}: ${member.i} → ${member.j}, L = ${display(project, result.length, 'length')}`, 2);
    if (result.diagramSegments.length > 1) memoirNote(context, 'Un tramo por cada cambio de carga; en cada uno las funciones son exactas.');
    for (const [segmentIndex, segment] of result.diagramSegments.entries()) {
      const scene = segmentScene(context, result, segment, segmentIndex + 1);
      // El título del tramo no se queda solo al pie: va con su figura.
      layout.ensure(scene ? sceneHeightFor(context, 210) + 60 : 90);
      layout.heading(`Tramo ${segmentIndex + 1}: ${display(project, segment.x0, 'length')} ≤ s ≤ ${display(project, segment.x1, 'length')}`, 3);
      if (scene) {
        layout.figure(
          sceneHeightFor(context, 210),
          (rect) => drawFreeBodyScene(context, rect, scene),
          `Barra ${member.id}, tramo ${segmentIndex + 1}: cuerpo libre hasta el corte, con N, V y M en ejes locales.`,
        );
      }
      drawEquations(context, segment);
    }
  }
};
