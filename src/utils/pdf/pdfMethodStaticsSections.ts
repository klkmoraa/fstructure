/**
 * Método de secciones en vigas y marcos isostáticos, escrito como memoria de cálculo.
 *
 * Datos (reacciones incógnita, cuerpo libre y cargas) → planteamiento (ΣF = 0, ΣM = 0) →
 * reacciones (resultantes, ecuaciones con los números y despeje) → fuerzas internas por cortes,
 * barra por barra y tramo por tramo, con N(s), V(s) y M(s) → comprobación contra el análisis
 * matricial.
 *
 * Todas las cifras vienen de `src/analysis-methods/staticsSections.ts`, que ya las comprobó
 * contra el análisis matricial; este archivo sólo las escribe, con las piezas de
 * `pdfMemoirKit` y las figuras de cuerpo libre comunes.
 */
import type {
  CutStretch,
  CutTerm,
  EquilibriumEquation,
  LoadResultant,
  MemberCuts,
  StaticsSectionsResult,
  StaticsUnknown,
} from '../../analysis-methods/staticsSections';
import { asWorkedEquation, type EquationInput } from './pdfEquation';
import { drawArcMemberCuts, memoirCheckFitted, memoirFormulaParts } from './pdfMethodArcSections';
import { clearNumber, number, unitFor } from './pdfFormat';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene, type SceneForce, type SceneMoment } from './pdfFreeBody';
import { memoirNote, memoirResults, memoirStep, memoirWork } from './pdfMemoirKit';
import { segmentScene } from './pdfSegmentCalculationSection';
import { dimensionalFigure, dimensionalUnit, signedSum } from './pdfSubstitution';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

/** Same height the other method sections give a free body. */
const SCENE_HEIGHT = 186;
const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };
const DEGREES = 180 / Math.PI;

const KIND_LABEL: Record<StaticsSectionsResult['classification']['kind'], string> = {
  'simple-beam': 'Viga isostática de un tramo',
  'continuous-beam': 'Viga isostática de varios tramos',
  frame: 'Marco plano isostático',
  truss: 'Armadura isostática',
  other: 'Estructura isostática',
};

const SUPPORT_LABEL: Record<string, string> = {
  pin: 'articulado',
  roller: 'rodillo',
  fixed: 'empotramiento',
  custom: 'apoyo',
};

const SUPERSCRIPT = ['', '', '²', '³', '⁴'];

/** Una cifra de tabla con el signo menos tipográfico, como en las fórmulas. */
const cellText = (text: string): string => text.replace(/^-(?=[\d.])/, '−');

interface Figures {
  /** Presentation figure of a force^f · length^l quantity, coherent with every other operand. */
  fig: (value: number, forcePower: number, lengthPower: number, reference?: number) => string;
  unit: (forcePower: number, lengthPower: number) => string;
}

const figuresFor = (context: ReportContext): Figures => ({
  fig: (value, forcePower, lengthPower, reference = value) => dimensionalFigure(context.project, value, forcePower, lengthPower, reference),
  unit: (forcePower, lengthPower) => dimensionalUnit(context.project, forcePower, lengthPower),
});

/** Desarrollo numerado; `R = 36.7 = 36.7 kN` no dice nada dos veces: la sustitución que es su resultado se quita. */
const work = (context: ReportContext, equations: readonly EquationInput[], caption?: string): void => {
  if (!equations.length) return;
  memoirWork(context, equations.map((input) => {
    const parsed = asWorkedEquation(input);
    return parsed.substituted !== undefined && parsed.substituted === parsed.result
      ? { ...parsed, substituted: undefined, symbolic: undefined }
      : parsed;
  }), caption);
};

const drawScene = (context: ReportContext, scene: FreeBodyScene | undefined, caption: string): void => {
  if (!scene || context.options.includeMethodFreeBodies === false) return;
  context.layout.figure(sceneHeightFor(context, SCENE_HEIGHT), (rect) => drawFreeBodyScene(context, rect, scene), caption);
};

const negligible = (value: number, scale: number): boolean => Math.abs(value) <= 1e-9 * Math.max(1, Math.abs(scale));

/** `−(3.000)(60.0)`: a product written with magnitudes and the sign of its turn. */
const product = (figures: Figures, arm: number, force: number, sign: number, scale: number): string => {
  const text = `(${figures.fig(Math.abs(arm), 0, 1)})(${figures.fig(Math.abs(force), 1, 0, scale)})`;
  return sign < 0 ? `−${text}` : text;
};

const unknownCoefficient = (coefficient: number, text: string): string => {
  if (Math.abs(coefficient - 1) <= 1e-12) return text;
  if (Math.abs(coefficient + 1) <= 1e-12) return `−${text}`;
  return `${coefficient < 0 ? '−' : ''}(${number(Math.abs(coefficient), 4)}) ${text}`;
};

/** The signed terms of one equilibrium sum, unknowns first, as a reader writes them. */
const equationTerms = (
  figures: Figures,
  equation: EquilibriumEquation,
  unknowns: readonly StaticsUnknown[],
  scales: { force: number; moment: number },
): string[] => {
  const moment = equation.kind === 'moment' || equation.kind === 'hinge';
  const scale = moment ? scales.moment : scales.force;
  const terms: string[] = [];
  for (const term of equation.unknownTerms) {
    const unknown = unknowns[term.unknown!]!;
    if (!moment || unknown.kind === 'moment') {
      terms.push(unknownCoefficient(term.value, unknown.symbol));
      continue;
    }
    const arm = `(${figures.fig(Math.abs(term.value), 0, 1)}) ${unknown.symbol}`;
    terms.push(term.value < 0 ? `−${arm}` : arm);
  }
  for (const term of equation.knownTerms) {
    if (!moment) {
      terms.push(figures.fig(term.value, 1, 0, scale));
      continue;
    }
    if (term.couple) terms.push(figures.fig(term.couple, 1, 1, scale));
    const dx = term.dx ?? 0;
    const dy = term.dy ?? 0;
    const fx = term.fx ?? 0;
    const fy = term.fy ?? 0;
    if (!negligible(dx * fy, scale)) terms.push(product(figures, dx, fy, Math.sign(dx * fy), scales.force));
    if (!negligible(dy * fx, scale)) terms.push(product(figures, dy, fx, -Math.sign(dy * fx), scales.force));
  }
  return terms;
};

const equationLabel = (equation: EquilibriumEquation): string => {
  switch (equation.kind) {
    case 'fx': return 'ΣF_x';
    case 'fy': return 'ΣF_y';
    default: return `ΣM_{${equation.centreNodeId}}`;
  }
};

/** Sentido supuesto de una reacción, para la tabla de incógnitas. */
const unknownSense = (unknown: StaticsUnknown): string => {
  if (unknown.kind === 'moment') return 'antihorario';
  if (unknown.direction.y === 0) return unknown.direction.x > 0 ? '+x' : '−x';
  if (unknown.direction.x === 0) return unknown.direction.y > 0 ? '+y' : '−y';
  return `normal (${number(unknown.direction.x, 4)}, ${number(unknown.direction.y, 4)})`;
};

const resultantSource = (resultant: LoadResultant): string => {
  const factor = resultant.factor !== 1 ? `, × ${number(resultant.factor, 4)}` : '';
  const on = resultant.memberId ?? resultant.nodeId ?? '';
  switch (resultant.kind) {
    case 'nodal': return `nodal ${resultant.sourceId} en ${on}${factor}`;
    case 'couple': return `par ${resultant.sourceId} en ${on}${factor}`;
    case 'point': return `puntual ${resultant.sourceId} en ${on}${factor}`;
    case 'uniform': return `${resultant.sourceId} en ${on}, parte uniforme${factor}`;
    case 'triangular': return `${resultant.sourceId} en ${on}, parte triangular${factor}`;
    case 'self-weight': return `peso propio de ${on}${factor}`;
    case 'arc': return `${resultant.sourceId} sobre el arco ${on}${factor}`;
  }
};

/** Nodal loads, couples and self-weight resultants: what `includeMemberLoads` does not draw. */
const pushLoadMarks = (
  context: ReportContext,
  resultants: readonly LoadResultant[],
  forces: SceneForce[],
  moments: SceneMoment[],
  keep: (resultant: LoadResultant) => boolean = () => true,
): void => {
  const { fig, unit } = figuresFor(context);
  for (const resultant of resultants) {
    if (!keep(resultant)) continue;
    if (resultant.kind === 'nodal' || resultant.kind === 'self-weight') {
      const magnitude = Math.hypot(resultant.fx, resultant.fy);
      forces.push({
        place: { at: resultant.at }, fx: resultant.fx, fy: resultant.fy, tone: 'load', length: 24,
        label: `${resultant.label} = ${fig(magnitude, 1, 0)} ${unit(1, 0)}`,
      });
    } else if (resultant.kind === 'couple' && resultant.nodeId) {
      moments.push({ place: { at: resultant.at }, sign: resultant.couple, label: resultant.label, tone: 'load' });
    }
  }
};

/** The scene of the whole structure: every load, and every reaction with its assumed sense. */
const wholeStructureScene = (context: ReportContext, solution: StaticsSectionsResult): FreeBodyScene => {
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  for (const unknown of solution.unknowns) {
    if (unknown.kind === 'moment') {
      moments.push({ place: { nodeId: unknown.nodeId }, sign: 1, label: unknown.symbol, tone: 'reaction' });
    } else {
      forces.push({ place: { nodeId: unknown.nodeId }, fx: unknown.direction.x, fy: unknown.direction.y, label: unknown.symbol, tone: 'reaction', length: 24 });
    }
  }
  pushLoadMarks(context, solution.resultants, forces, moments);
  return {
    title: 'cuerpo libre de toda la estructura',
    includeMemberLoads: true,
    forces,
    moments,
    legend: 'Reacciones con su sentido supuesto: un valor negativo actúa al revés. El peso propio se dibuja como su resultante.',
  };
};

/** One side of a hinge: the part the moment equation is written for. */
const hingeScene = (context: ReportContext, solution: StaticsSectionsResult, equation: EquilibriumEquation): FreeBodyScene => {
  const nodes = new Set(equation.nodeIds);
  const members = new Set(equation.memberIds);
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  for (const unknown of solution.unknowns) {
    if (!nodes.has(unknown.nodeId)) continue;
    if (unknown.kind === 'moment') moments.push({ place: { nodeId: unknown.nodeId }, sign: 1, label: unknown.symbol, tone: 'reaction' });
    else forces.push({ place: { nodeId: unknown.nodeId }, fx: unknown.direction.x, fy: unknown.direction.y, label: unknown.symbol, tone: 'reaction', length: 24 });
  }
  pushLoadMarks(context, solution.resultants, forces, moments, (resultant) => (
    resultant.memberId !== undefined ? members.has(resultant.memberId) : nodes.has(resultant.nodeId ?? '')
  ));
  return {
    title: `articulación en ${equation.centreNodeId}`,
    keptNodeIds: equation.nodeIds,
    keptMemberIds: equation.memberIds,
    includeMemberLoads: true,
    forces,
    moments,
    notes: [{ place: { nodeId: equation.centreNodeId! }, text: 'M = 0', tone: 'moment' }],
    legend: 'Sólo la parte en tinta: sus reacciones y cargas, sumadas en momento respecto a la articulación, dan cero.',
  };
};

/** Signed terms of N, V or M for one cut term, with this project's numbers. */
const cutTermTexts = (figures: Figures, term: CutTerm, quantity: 'axial' | 'shear' | 'moment', scale: number): string[] => {
  const { fig } = figures;
  const out: string[] = [];
  const push = (coefficient: number, forcePower: number, lengthPower: number, factor: string) => {
    if (negligible(coefficient, scale)) return;
    out.push(`${fig(coefficient, forcePower, lengthPower, scale)}${factor ? ` ${factor}` : ''}`);
  };
  const distance = (from: number) => from === 0 ? 's' : `(s − ${fig(from, 0, 1)})`;
  const power = (base: string, exponent: number, divisor: number) => `${base}${SUPERSCRIPT[exponent] ?? `^${exponent}`}/${divisor}`;
  switch (term.kind) {
    case 'start':
      if (quantity === 'axial') push(term.axial, 1, 0, '');
      if (quantity === 'shear') push(term.shear, 1, 0, '');
      if (quantity === 'moment') {
        push(term.moment, 1, 1, '');
        push(term.shear, 1, 0, 's');
      }
      break;
    case 'point':
      if (quantity === 'axial') push(-term.px, 1, 0, '');
      if (quantity === 'shear') push(term.py, 1, 0, '');
      if (quantity === 'moment') push(term.py, 1, 0, distance(term.at));
      break;
    case 'couple':
      if (quantity === 'moment') push(-term.moment, 1, 1, '');
      break;
    case 'partial': {
      const u = distance(term.from);
      if (quantity === 'axial') {
        push(-term.qx, 1, -1, u);
        push(-term.slopeX, 1, -2, power(u, 2, 2));
      }
      if (quantity === 'shear') {
        push(term.qy, 1, -1, u);
        push(term.slopeY, 1, -2, power(u, 2, 2));
      }
      if (quantity === 'moment') {
        push(term.qy, 1, -1, power(u, 2, 2));
        push(term.slopeY, 1, -2, power(u, 3, 6));
      }
      break;
    }
    case 'full':
      if (quantity === 'axial') {
        push(-term.wx, 1, 0, '');
        push(-term.wxTriangle, 1, 0, '');
      }
      if (quantity === 'shear') {
        push(term.wy, 1, 0, '');
        push(term.wyTriangle, 1, 0, '');
      }
      if (quantity === 'moment') {
        push(term.wy, 1, 0, `(s − ${fig(term.from + term.length / 2, 0, 1)})`);
        push(term.wyTriangle, 1, 0, `(s − ${fig(term.from + (2 * term.length) / 3, 0, 1)})`);
      }
      break;
  }
  return out;
};

/** `55.0 + 12.5 s − 5.00 s²`: a polynomial in s with coherent units for every coefficient. */
const polynomialText = (figures: Figures, coefficients: readonly number[], lengthPower: number, length: number): string => {
  const magnitudes = coefficients.map((coefficient, power) => Math.abs(coefficient) * Math.max(1, length) ** power);
  const reference = Math.max(...magnitudes, 1e-300);
  const terms: string[] = [];
  coefficients.forEach((coefficient, power) => {
    if (magnitudes[power]! <= reference * 1e-10) return;
    const value = figures.fig(coefficient, 1, lengthPower - power, coefficient);
    terms.push(power === 0 ? value : power === 1 ? `${value} s` : `${value} s${SUPERSCRIPT[power] ?? `^${power}`}`);
  });
  return terms.length ? signedSum(terms) : '0';
};

const QUANTITIES = [
  { key: 'axial', symbol: 'N', lengthPower: 0 },
  { key: 'shear', symbol: 'V', lengthPower: 0 },
  { key: 'moment', symbol: 'M', lengthPower: 1 },
] as const;

/** The forces the start side passes to the member at node i, added to the reused cut scene. */
const startMarks = (member: MemberCuts): { forces: SceneForce[]; moments: SceneMoment[] } => {
  const { start, c, s } = member;
  const scale = Math.max(Math.abs(start.axial), Math.abs(start.shear), 1e-12);
  const forces: SceneForce[] = [];
  const moments: SceneMoment[] = [];
  const place = { nodeId: member.startNodeId };
  // The side pushes on the member with its own resultant: −N along the axis, V across it. The
  // values are in the equations right under the figure; the drawing only names them, because
  // the cut already carries three labelled values on the same short member.
  if (!negligible(start.axial, scale)) {
    const sense = Math.sign(-start.axial);
    // A pull leaves the end outward; a push arrives from outside. Neither lies on the member.
    forces.push({ place, fx: c * sense, fy: s * sense, label: 'N₀', tone: 'axial', length: 22, anchor: sense < 0 ? 'tail' : 'head' });
  }
  if (!negligible(start.shear, scale)) {
    const sense = Math.sign(start.shear);
    forces.push({ place, fx: -s * sense, fy: c * sense, label: 'V₀', tone: 'shear', length: 22 });
  }
  if (!negligible(start.bending, Math.max(1, scale * member.length))) {
    moments.push({ place, sign: -start.bending, label: 'M₀', tone: 'moment' });
  }
  return { forces, moments };
};

/** Horner, para leer N, V o M de un tramo en un punto. */
const valueAt = (coefficients: readonly number[], s: number): number =>
  coefficients.reduceRight((total, coefficient) => total * s + coefficient, 0);

const drawStretch = (
  context: ReportContext,
  figures: Figures,
  member: MemberCuts,
  stretch: CutStretch,
  index: number,
  scale: { force: number; moment: number },
): void => {
  const { fig, unit } = figures;
  const result = context.index.memberResult(member.memberId);
  const middle = (stretch.s0 + stretch.s1) / 2;
  const segment = result?.diagramSegments.find((entry) => middle >= entry.x0 && middle <= entry.x1);
  if (result && segment) {
    const scene = segmentScene(context, result, segment, index + 1);
    if (scene) {
      const marks = startMarks(member);
      drawScene(
        context,
        { ...scene, forces: [...(scene.forces ?? []), ...marks.forces], moments: [...(scene.moments ?? []), ...marks.moments] },
        `Barra ${member.memberId}, tramo ${index + 1}: cuerpo libre izquierdo cortado en s.`,
      );
    }
  }

  const labels = [...new Set(stretch.terms.flatMap((term) => (term.kind === 'start' ? [] : [term.label])))];
  const equations: EquationInput[] = QUANTITIES.map(({ key, symbol, lengthPower }) => {
    const reference = key === 'moment' ? scale.moment : scale.force;
    const terms = stretch.terms.flatMap((term) => cutTermTexts(figures, term, key, reference));
    return {
      lhs: `${symbol}(s)`,
      substituted: terms.length ? signedSum(terms) : '0',
      result: polynomialText(figures, stretch[key], lengthPower, member.length),
      unit: unit(1, lengthPower),
    };
  });
  work(
    context,
    equations,
    `Tramo ${index + 1}: ${fig(stretch.s0, 0, 1)} ≤ s ≤ ${fig(stretch.s1, 0, 1)} ${unit(0, 1)}`
    + `${labels.length ? `; cargas antes del corte: ${labels.join(', ')}` : '; sin cargas antes del corte'}`,
  );

  // Valores en los extremos del tramo y, donde V se anula, el momento extremo.
  const extremes = stretch.shearZeros.filter((zero) => Math.abs(valueAt(stretch.shear, zero.s)) <= 1e-6 * scale.force
    && Math.abs(valueAt(stretch.moment, zero.s) - zero.moment) <= 1e-6 * scale.moment);
  const row = (label: string, s: number, values: { axial: number; shear: number; moment: number }) => [
    label,
    cellText(fig(s, 0, 1)),
    cellText(fig(values.axial, 1, 0, scale.force)),
    cellText(fig(values.shear, 1, 0, scale.force)),
    cellText(fig(values.moment, 1, 1, scale.moment)),
  ];
  context.layout.table([
    { header: 'Punto', width: 96 },
    { header: `s (${unit(0, 1)})`, ...NUMERIC },
    { header: `N (${unit(1, 0)})`, ...NUMERIC },
    { header: `V (${unit(1, 0)})`, ...NUMERIC },
    { header: `M (${unit(1, 1)})`, ...NUMERIC },
  ], [
    row('inicio del tramo', stretch.s0, stretch.start),
    ...extremes.map((zero) => row('V = 0', zero.s, { axial: valueAt(stretch.axial, zero.s), shear: 0, moment: zero.moment })),
    row('fin del tramo', stretch.s1, stretch.end),
  ]);
};

/**
 * N₀, V₀ and M₀ from the side's resultant. An axis-aligned member reads them straight off one
 * component — `N₀ = −ΣF_x` on a beam drawn left to right — which is how a reader writes it;
 * only an inclined member needs both direction cosines.
 */
const startEquations = (figures: Figures, member: MemberCuts, scale: { force: number; moment: number }): EquationInput[] => {
  const { fig, unit } = figures;
  const { start } = member;
  const fx = `(${fig(start.fx, 1, 0, scale.force)})`;
  const fy = `(${fig(start.fy, 1, 0, scale.force)})`;
  const minus = (negative: boolean) => negative ? '−' : '';
  const unitCosine = (value: number) => Math.abs(Math.abs(value) - 1) <= 1e-12;
  // N₀ = −(ΣF_x cos α + ΣF_y sen α), V₀ = −ΣF_x sen α + ΣF_y cos α, con un coseno ±1 y el otro nulo.
  const along = unitCosine(member.c)
    ? {
      axial: [`${minus(member.c > 0)}ΣF_x`, `${minus(member.c > 0)}${fx}`],
      shear: [`${minus(member.c < 0)}ΣF_y`, `${minus(member.c < 0)}${fy}`],
    }
    : unitCosine(member.s)
      ? {
        axial: [`${minus(member.s > 0)}ΣF_y`, `${minus(member.s > 0)}${fy}`],
        shear: [`${minus(member.s > 0)}ΣF_x`, `${minus(member.s > 0)}${fx}`],
      }
      : undefined;
  const c = `(${number(member.c, 4)})`;
  const s = `(${number(member.s, 4)})`;
  return [
    {
      lhs: 'N_0', symbolic: along?.axial[0] ?? '−(ΣF_x cos α + ΣF_y sen α)',
      substituted: along?.axial[1] ?? `−(${fx}${c} + ${fy}${s})`,
      result: fig(start.axial, 1, 0, scale.force), unit: unit(1, 0),
    },
    {
      lhs: 'V_0', symbolic: along?.shear[0] ?? '−ΣF_x sen α + ΣF_y cos α',
      substituted: along?.shear[1] ?? `−${fx}${s} + ${fy}${c}`,
      result: fig(start.shear, 1, 0, scale.force), unit: unit(1, 0),
    },
    {
      lhs: 'M_0', symbolic: `−ΣM_{${member.startNodeId}}`,
      substituted: `−(${fig(start.moment, 1, 1, scale.moment)})`,
      result: fig(start.bending, 1, 1, scale.moment), unit: unit(1, 1),
    },
  ];
};

/** Lo que queda del lado del nudo inicial al cortar la barra justo después de él. */
const sideNote = (member: MemberCuts): string => {
  const { start } = member;
  const others = start.memberIds.length ? ` y ${start.memberIds.join(', ')}` : '';
  return `Lado de ${member.startNodeId}: nudos ${start.nodeIds.join(', ')}${others}; `
    + `acciones ${start.actions.map((action) => action.label).join(', ') || 'ninguna'}.`;
};

const drawMember = (context: ReportContext, figures: Figures, member: MemberCuts, scale: { force: number; moment: number }): void => {
  // A curved member is cut station by station: its N, V and M are not polynomials in s.
  if (member.arc) {
    drawArcMemberCuts(context, member, scale);
    return;
  }
  const { layout } = context;
  const { fig, unit } = figures;
  const { start } = member;
  layout.heading(`Barra ${member.memberId}: ${member.startNodeId} → ${member.endNodeId}`, 3);
  memoirNote(context, `L = ${fig(member.length, 0, 1)} ${unit(0, 1)}, α = ${number(Math.atan2(member.s, member.c) * DEGREES, 4)}°, `
    + `s desde ${member.startNodeId}. ${sideNote(member)}`);
  const origin = context.index.node(member.startNodeId);
  const forceTerms = (component: 'fx' | 'fy') => start.actions
    .filter((action) => !negligible(action[component], scale.force))
    .map((action) => fig(action[component], 1, 0, scale.force));
  const momentTerms = origin ? start.actions.flatMap((action) => {
    const dx = action.at.x - origin.x;
    const dy = action.at.y - origin.y;
    const terms: string[] = [];
    if (!negligible(action.couple, scale.moment)) terms.push(fig(action.couple, 1, 1, scale.moment));
    if (!negligible(dx * action.fy, scale.moment)) terms.push(product(figures, dx, action.fy, Math.sign(dx * action.fy), scale.force));
    if (!negligible(dy * action.fx, scale.moment)) terms.push(product(figures, dy, action.fx, -Math.sign(dy * action.fx), scale.force));
    return terms;
  }) : [];
  work(context, [
    { lhs: 'ΣF_x', substituted: forceTerms('fx').length ? signedSum(forceTerms('fx')) : '0', result: fig(start.fx, 1, 0, scale.force), unit: unit(1, 0) },
    { lhs: 'ΣF_y', substituted: forceTerms('fy').length ? signedSum(forceTerms('fy')) : '0', result: fig(start.fy, 1, 0, scale.force), unit: unit(1, 0) },
    { lhs: `ΣM_{${member.startNodeId}}`, substituted: momentTerms.length ? signedSum(momentTerms) : '0', result: fig(start.moment, 1, 1, scale.moment), unit: unit(1, 1) },
    ...startEquations(figures, member, scale),
  ], `Acciones del lado de ${member.startNodeId} y fuerzas internas en s = 0⁺`);

  member.stretches.forEach((stretch, index) => drawStretch(context, figures, member, stretch, index, scale));
};

export const drawStaticsSections = (context: ReportContext, solution: StaticsSectionsResult): void => {
  const { layout, project } = context;
  const figures = figuresFor(context);
  const { fig, unit } = figures;
  const { unknowns, equations } = solution;
  const lengthUnit = unitFor(project, 'length');
  const independent = equations.filter((equation) => equation.independent);
  const hinges = independent.filter((equation) => equation.kind === 'hinge');
  const forceScale = Math.max(
    1,
    ...unknowns.filter((unknown) => unknown.kind === 'force').map((unknown) => Math.abs(unknown.value)),
    ...solution.resultants.map((entry) => Math.hypot(entry.fx, entry.fy)),
  );
  const extent = Math.max(1, ...solution.members.map((member) => member.length));
  const scale = { force: forceScale, moment: forceScale * extent };
  const arcs = solution.members.filter((member) => member.arc);
  const kind = arcs.length && arcs.length === solution.members.length ? 'Arco isostático' : KIND_LABEL[solution.classification.kind];

  layout.heading('5. Método de secciones');
  memoirNote(context, `${kind}: ${unknowns.length} reacciones y ${independent.length} ecuaciones independientes `
    + `(3 de equilibrio${hinges.length ? ` y ${hinges.length} de articulación` : ''}). Incógnitas: las reacciones; después, N, V y M por cortes.`);

  // 5.1 ---------------------------------------------------------------------------------------
  memoirStep(context, '5.1 Datos');
  layout.table([
    { header: 'Reacción' },
    { header: 'Apoyo' },
    { header: 'Sentido supuesto' },
  ], unknowns.map((unknown) => [
    unknown.symbol,
    `${SUPPORT_LABEL[context.index.node(unknown.nodeId)?.support.type ?? ''] ?? 'apoyo'} en ${unknown.nodeId}`,
    unknownSense(unknown),
  ]));
  drawScene(context, wholeStructureScene(context, solution), 'Cuerpo libre de la estructura completa, con las reacciones como incógnitas.');
  const couples = solution.resultants.some((resultant) => resultant.kind === 'couple');
  layout.table([
    { header: 'Carga', width: 44 },
    { header: 'Origen' },
    { header: `F_x (${unit(1, 0)})`, ...NUMERIC, width: 64 },
    { header: `F_y (${unit(1, 0)})`, ...NUMERIC, width: 64 },
    ...(couples ? [{ header: `C (${unit(1, 1)})`, ...NUMERIC, width: 64 }] : []),
    { header: `x (${lengthUnit})`, ...NUMERIC, width: 54 },
    { header: `y (${lengthUnit})`, ...NUMERIC, width: 54 },
  ], solution.resultants.map((resultant) => [
    resultant.label,
    resultantSource(resultant),
    resultant.kind === 'couple' ? '—' : cellText(fig(resultant.fx, 1, 0, scale.force)),
    resultant.kind === 'couple' ? '—' : cellText(fig(resultant.fy, 1, 0, scale.force)),
    ...(couples ? [resultant.kind === 'couple' ? cellText(fig(resultant.couple, 1, 1, scale.moment)) : '—'] : []),
    cellText(fig(resultant.at.x, 0, 1)),
    cellText(fig(resultant.at.y, 0, 1)),
  ]));
  memoirNote(context, 'Cargas ya factorizadas; (x, y) es un punto de su línea de acción.');
  if (solution.loadCheck) {
    const { statics, referencePoint, residual } = solution.loadCheck;
    memoirNote(context, `Suma de cargas: ΣF_x = ${fig(statics.fx, 1, 0, scale.force)} ${unit(1, 0)}, ΣF_y = ${fig(statics.fy, 1, 0, scale.force)} ${unit(1, 0)}, `
      + `ΣM = ${fig(statics.mz, 1, 1, scale.moment)} ${unit(1, 1)} respecto a (${fig(referencePoint.x, 0, 1)}, ${fig(referencePoint.y, 0, 1)}) ${lengthUnit}; `
      + `igual a la auditoría de cargas del análisis (diferencia relativa ${clearNumber(residual, 1)}).`);
  }

  // 5.2 ---------------------------------------------------------------------------------------
  memoirStep(context, '5.2 Planteamiento');
  memoirFormulaParts(context, ['ΣF_x = 0', 'ΣF_y = 0', 'ΣM_O = 0', ...(hinges.length ? ['ΣM_{art} = 0'] : [])], [
    ['ΣF_x, ΣF_y', 'suma de fuerzas, positivas hacia +x y +y'],
    ['ΣM_O', 'suma de momentos respecto a un punto O, antihorario positivo (brazo × fuerza)'],
    ...(hinges.length ? [['ΣM_{art}', 'momentos de una de las partes respecto a la articulación'] as [string, string]] : []),
  ]);

  // 5.3 ---------------------------------------------------------------------------------------
  memoirStep(context, '5.3 Reacciones');
  const resultantWork: EquationInput[] = [];
  for (const resultant of solution.resultants) {
    if (resultant.intensity === undefined || resultant.basisLength === undefined) continue;
    const magnitude = Math.hypot(resultant.fx, resultant.fy);
    const triangle = resultant.kind === 'triangular';
    resultantWork.push({
      lhs: `|${resultant.label}|`,
      symbolic: triangle ? 'Δq L/2' : resultant.kind === 'self-weight' ? 'w L' : 'q L',
      substituted: `(${fig(resultant.intensity, 1, -1)})(${fig(resultant.basisLength, 0, 1)})${triangle ? '/2' : ''}`,
      result: fig(magnitude, 1, 0),
      unit: unit(1, 0),
    });
    if (resultant.loadStart !== undefined && resultant.loadLength !== undefined && resultant.station !== undefined) {
      resultantWork.push({
        lhs: `s(${resultant.label})`,
        symbolic: triangle ? 'a + 2L/3' : 'a + L/2',
        substituted: `${fig(resultant.loadStart, 0, 1)} + ${triangle ? '2' : ''}(${fig(resultant.loadLength, 0, 1)})/${triangle ? '3' : '2'}`,
        result: fig(resultant.station, 0, 1),
        unit: unit(0, 1),
      });
    }
  }
  work(context, resultantWork, 'Resultantes de las cargas repartidas (L medida según la base de cada carga):');
  const onArcs = solution.resultants.filter((resultant) => resultant.arcSpan);
  if (onArcs.length) {
    memoirNote(context, `${onArcs.map((resultant) => resultant.label).join(', ')}: ${onArcs.length === 1 ? 'carga' : 'cargas'} sobre el arco, `
      + `F = ∫ q dL a lo largo de la curva${onArcs.every((resultant) => resultant.intensity !== undefined) ? '; con q constante, |F| = q L' : ''}.`);
  }

  let pending: EquationInput[] = [];
  const flush = () => {
    work(context, pending, 'Ecuaciones de equilibrio:');
    pending = [];
  };
  for (const equation of independent) {
    const terms = equationTerms(figures, equation, unknowns, scale);
    const moment = equation.kind === 'moment' || equation.kind === 'hinge';
    const relation: EquationInput = {
      lhs: equationLabel(equation),
      substituted: terms.length ? signedSum(terms) : '0',
      result: '0',
      unit: unit(1, moment ? 1 : 0),
    };
    if (equation.kind !== 'hinge') {
      pending.push(relation);
      continue;
    }
    flush();
    const release = equation.release!;
    drawScene(context, hingeScene(context, solution, equation), `Parte a un lado de la articulación ${release.nodeId}: ΣM = 0 respecto a ${release.nodeId}.`);
    work(context, [relation], `Articulación en ${release.nodeId}: parte ${equation.nodeIds.join(', ')}`
      + `${equation.memberIds.length ? ` con ${equation.memberIds.join(', ')}` : ''}, la de menos incógnitas`);
  }
  flush();
  const dependent = equations.filter((equation) => !equation.independent && equation.kind === 'hinge').length;
  if (dependent) {
    // Where three or more members meet at a hinge, the repeated equation is not «the other side»
    // of a two-member hinge but the node's own ΣM = 0: n ends, n − 1 independent conditions.
    const endsAtHinge = new Map<string, number>();
    for (const equation of equations) {
      if (equation.kind === 'hinge' && equation.release) {
        endsAtHinge.set(equation.release.nodeId, (endsAtHinge.get(equation.release.nodeId) ?? 0) + 1);
      }
    }
    const crowded = [...endsAtHinge].filter(([, count]) => count >= 3);
    memoirNote(context, `${dependent === 1 ? 'La ecuación de la otra parte' : `Otras ${dependent} ecuaciones de articulación`} `
      + 'no aporta información nueva: se cumple y sirve de comprobación.'
      + crowded.map(([nodeId, count]) => ` En ${nodeId} concurren ${count} barras: sólo ${count - 1} de sus ecuaciones son independientes.`).join(''));
  }

  const solved = new Set<number>();
  for (const step of solution.steps) {
    const equation = equations[step.equation]!;
    if (step.unknowns.length === 1 && step.equations.length === 1) {
      const index = step.unknowns[0]!;
      const unknown = unknowns[index]!;
      const coefficient = equation.coefficients[index]!;
      const moment = equation.kind === 'moment' || equation.kind === 'hinge';
      const sumPower = moment ? 1 : 0;
      const sumScale = moment ? scale.moment : scale.force;
      // Everything else in the equation, already a number: the reactions solved before this
      // one, then the loads. The unknown is minus their sum over its own coefficient.
      const knownUnknowns = equation.coefficients
        .map((value, other) => ({ value, other }))
        .filter(({ value, other }) => other !== index && value !== 0 && solved.has(other));
      const others = [
        ...knownUnknowns.map(({ value, other }) => value * unknowns[other]!.value),
        ...equation.knownTerms.map((term) => term.value),
      ].filter((value) => !negligible(value, sumScale));
      const flip = Math.abs(coefficient + 1) <= 1e-12;
      const numerator = others.length
        ? signedSum(others.map((value) => fig(flip ? value : -value, 1, sumPower, sumScale)))
        : '0';
      const coefficientText = moment && unknown.kind === 'force' ? fig(coefficient, 0, 1) : number(coefficient, 6);
      const lengthPower = unknown.kind === 'moment' ? 1 : 0;
      const names = knownUnknowns.map(({ other }) => unknowns[other]!.symbol);
      work(
        context,
        [{
          lhs: unknown.symbol,
          substituted: Math.abs(coefficient - 1) <= 1e-12 || flip ? numerator : `(${numerator})/(${coefficientText})`,
          result: fig(unknown.value, 1, lengthPower, scale.force),
          unit: unit(1, lengthPower),
        }],
        `De ${equationLabel(equation)} = 0${names.length ? `, con ${names.join(', ')} ya ${names.length === 1 ? 'conocida' : 'conocidas'}` : ''}:`,
      );
      solved.add(index);
      continue;
    }
    work(
      context,
      step.unknowns.map((index) => {
        const unknown = unknowns[index]!;
        const lengthPower = unknown.kind === 'moment' ? 1 : 0;
        return { lhs: unknown.symbol, result: fig(unknown.value, 1, lengthPower, scale.force), unit: unit(1, lengthPower) };
      }),
      `Sistema de ${step.equations.map((entry) => equationLabel(equations[entry]!)).join(', ')}:`,
    );
    step.unknowns.forEach((index) => solved.add(index));
  }
  memoirResults(context, 'Reacciones', unknowns.map((unknown) => {
    const lengthPower = unknown.kind === 'moment' ? 1 : 0;
    return [unknown.symbol, `${fig(unknown.value, 1, lengthPower, scale.force)} ${unit(1, lengthPower)}`];
  }));
  if (unknowns.some((unknown) => unknown.value < 0 && !negligible(unknown.value, scale.force))) {
    memoirNote(context, 'Un valor negativo actúa en sentido contrario al supuesto.');
  }

  // 5.4 ---------------------------------------------------------------------------------------
  memoirStep(context, '5.4 Fuerzas internas por cortes');
  if (solution.members.some((member) => !member.arc)) {
    memoirFormulaParts(context, ['N(s) = N_0 − ΣP_x', 'V(s) = V_0 + ΣP_y', 'M(s) = M_0 + V_0 s + ΣP_y (s − a)'], [
      ['s', 'distancia desde el nudo inicial de la barra'],
      ['P_x, P_y', 'cargas antes del corte, en ejes de la barra, aplicadas en s = a'],
      ['N, V, M', 'N positiva a tensión; dM/ds = V'],
    ]);
    memoirFormulaParts(context, ['N_0 = −(ΣF_x cos α + ΣF_y sen α)', 'V_0 = −ΣF_x sen α + ΣF_y cos α', 'M_0 = −ΣM_i'], [
      ['ΣF, ΣM_i', 'resultante de las acciones del lado del nudo inicial i'],
      ['α', 'inclinación de la barra, de i a j'],
    ]);
  }
  for (const member of solution.members) drawMember(context, figures, member, scale);
  memoirResults(context, 'Momentos máximos', solution.members.map((member) => [
    `M_{máx}(${member.memberId})`,
    `${fig(member.peakMoment.value, 1, 1, scale.moment)} ${unit(1, 1)}, s = ${fig(member.peakMoment.s, 0, 1)} ${unit(0, 1)}`,
  ]));

  // 5.5 ---------------------------------------------------------------------------------------
  memoirStep(context, '5.5 Comprobación');
  const forceGap = Math.max(solution.reactionResidual.force, solution.diagramResidual.force);
  const momentGap = Math.max(solution.reactionResidual.moment, solution.diagramResidual.moment);
  const tolerance = Math.max(1e-3, ...arcs.map((member) => member.arc!.tolerance));
  const gaps = `${fig(forceGap, 1, 0, scale.force)} ${unit(1, 0)} y ${fig(momentGap, 1, 1, scale.moment)} ${unit(1, 1)}`;
  memoirCheckFitted(
    context,
    `reacciones y diagramas contra el análisis matricial, diferencias máximas ${gaps}.`,
    `reacciones y diagramas, diferencias con el análisis matricial ${gaps}.`,
    forceGap <= tolerance * scale.force && momentGap <= tolerance * scale.moment,
  );
};
