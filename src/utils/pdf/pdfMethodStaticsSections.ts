/**
 * The Method of Sections for beams and frames, narrated the way a student solves it.
 *
 * Free-body diagram of the whole structure → each load reduced to its resultant → the
 * equilibrium equations with the actual numbers (ΣFx, ΣFy, ΣM about a support and ΣM = 0 of
 * one side of every hinge) → the reactions, one at a time where an equation leaves a single
 * unknown → for every member and every stretch between discontinuities, a cut at distance s
 * with N(s), V(s) and M(s) written term by term from the left free body → the values at the
 * ends of the stretch and the extreme moment where V = 0 → the comparison with the matrix
 * analysis.
 *
 * Every figure printed here was solved by `src/analysis-methods/staticsSections.ts`, which
 * already required it to agree with the analysis the rest of the document reports. This file
 * only writes it down; it uses the layout API as it is and builds its scenes from the shared
 * free-body primitives, reusing the per-stretch cut of `pdfSegmentCalculationSection`.
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
import { asWorkedEquation, drawWorkedEquation, measureWorkedEquation, type EquationInput } from './pdfEquation';
import { clearNumber, number } from './pdfFormat';
import { drawFreeBodyScene, sceneHeightFor, type FreeBodyScene, type SceneForce, type SceneMoment } from './pdfFreeBody';
import { segmentScene } from './pdfSegmentCalculationSection';
import { dimensionalFigure, dimensionalUnit, signedSum } from './pdfSubstitution';
import type { ReportContext } from './reportContext';

/** Same height the other method sections give a free body. */
const SCENE_HEIGHT = 186;

const KIND_LABEL: Record<StaticsSectionsResult['classification']['kind'], string> = {
  'simple-beam': 'una viga de un tramo',
  'continuous-beam': 'una viga de varios tramos',
  frame: 'un marco plano',
  truss: 'una armadura',
  other: 'una estructura',
};

const SUPPORT_LABEL: Record<string, string> = {
  pin: 'pasador',
  roller: 'rodillo',
  fixed: 'empotramiento',
  custom: 'apoyo personalizado',
};

const SUPERSCRIPT = ['', '', '²', '³', '⁴'];

interface Figures {
  /** Presentation figure of a force^f · length^l quantity, coherent with every other operand. */
  fig: (value: number, forcePower: number, lengthPower: number, reference?: number) => string;
  unit: (forcePower: number, lengthPower: number) => string;
}

const figuresFor = (context: ReportContext): Figures => ({
  fig: (value, forcePower, lengthPower, reference = value) => dimensionalFigure(context.project, value, forcePower, lengthPower, reference),
  unit: (forcePower, lengthPower) => dimensionalUnit(context.project, forcePower, lengthPower),
});

const drawEquations = (context: ReportContext, caption: string | undefined, equations: readonly EquationInput[]): void => {
  if (!equations.length) return;
  const { layout } = context;
  if (caption) layout.text(caption, 7.9, layout.fonts.bold, layout.palette.ink, 12);
  for (const input of equations) {
    const parsed = asWorkedEquation(input);
    // `R = 36.7 = 36.7 kN` says nothing twice: a substitution that is its own result goes.
    const equation = parsed.substituted !== undefined && parsed.substituted === parsed.result
      ? { ...parsed, substituted: undefined, symbolic: undefined }
      : parsed;
    layout.ensure(measureWorkedEquation(layout, equation, 8.4, 16));
    layout.y -= drawWorkedEquation(layout, equation, 8.4, 16, layout.rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }
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
    default: return `ΣM(${equation.centreNodeId})`;
  }
};

const unknownSense = (context: ReportContext, unknown: StaticsUnknown): string => {
  const node = context.index.node(unknown.nodeId);
  const support = SUPPORT_LABEL[node?.support.type ?? ''] ?? 'apoyo';
  if (unknown.kind === 'moment') return `${support} en ${unknown.nodeId}: momento de reacción, positivo antihorario`;
  if (unknown.direction.y === 0) return `${support} en ${unknown.nodeId}: fuerza horizontal, positiva hacia +x`;
  if (unknown.direction.x === 0) return `${support} en ${unknown.nodeId}: fuerza vertical, positiva hacia +y`;
  return `${support} en ${unknown.nodeId}: fuerza a lo largo de la normal del rodillo, `
    + `(${number(unknown.direction.x, 4)}, ${number(unknown.direction.y, 4)})`;
};

const resultantSource = (resultant: LoadResultant): string => {
  const where = resultant.memberId ? `barra ${resultant.memberId}` : `nudo ${resultant.nodeId}`;
  switch (resultant.kind) {
    case 'nodal': return `carga ${resultant.sourceId} en el ${where}`;
    case 'couple': return `par ${resultant.sourceId} en ${resultant.memberId ? `la ${where}` : `el ${where}`}`;
    case 'point': return `carga puntual ${resultant.sourceId} sobre la ${where}`;
    case 'uniform': return `carga repartida ${resultant.sourceId} sobre la ${where}: bloque uniforme`;
    case 'triangular': return `carga repartida ${resultant.sourceId} sobre la ${where}: triángulo de la variación`;
    case 'self-weight': return `peso propio de la ${where}`;
  }
};

const basisLabel = (basis: LoadResultant['basis']): string => basis === 'horizontal'
  ? 'proyección horizontal'
  : basis === 'vertical' ? 'proyección vertical' : 'longitud real';

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
    legend: 'Reacciones dibujadas con el sentido supuesto (positivo): un valor negativo significa que actúan al revés. '
      + 'Las cargas son las del escenario exportado; el peso propio se dibuja como su resultante.',
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

const drawStretch = (
  context: ReportContext,
  figures: Figures,
  member: MemberCuts,
  stretch: CutStretch,
  index: number,
  scale: { force: number; moment: number },
): void => {
  const { layout } = context;
  const { fonts, palette } = layout;
  const { fig, unit } = figures;
  layout.ensure(48);
  layout.text(
    `Tramo ${index + 1}: ${fig(stretch.s0, 0, 1)} ≤ s ≤ ${fig(stretch.s1, 0, 1)} ${unit(0, 1)}`,
    8, fonts.bold, palette.ink, 8,
  );

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
        `Barra ${member.memberId}, tramo ${index + 1}: cuerpo libre izquierdo cortado en s, con lo que el lado de ${member.startNodeId} le transmite en el inicio.`,
      );
    }
  }

  const labels = stretch.terms.flatMap((term) => term.kind === 'start' ? [] : [term.label]);
  layout.text(
    labels.length
      ? `A la izquierda del corte actúan N₀, V₀, M₀ y las cargas ${[...new Set(labels)].join(', ')}.`
      : 'A la izquierda del corte sólo actúan N₀, V₀ y M₀: el tramo no lleva carga antes del corte.',
    7.9, fonts.regular, undefined, 12,
  );
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
  drawEquations(context, undefined, equations);

  const values = (label: string, at: number, entry: CutStretch['start']): readonly [string, string] => [
    `s = ${fig(at, 0, 1)} ${unit(0, 1)}${label}`,
    `N = ${fig(entry.axial, 1, 0, scale.force)} ${unit(1, 0)} · V = ${fig(entry.shear, 1, 0, scale.force)} ${unit(1, 0)} · `
    + `M = ${fig(entry.moment, 1, 1, scale.moment)} ${unit(1, 1)}`,
  ];
  layout.keyValues([values(' (inicio del tramo)', stretch.s0, stretch.start), values(' (fin del tramo)', stretch.s1, stretch.end)], 150);
  for (const zero of stretch.shearZeros) {
    drawEquations(context, 'V(s) se anula dentro del tramo, en s*; ahí M(s) alcanza su extremo:', [
      { lhs: 's*', result: fig(zero.s, 0, 1), unit: unit(0, 1) },
      { lhs: 'M(s*)', substituted: `M(${fig(zero.s, 0, 1)})`, result: fig(zero.moment, 1, 1, scale.moment), unit: unit(1, 1) },
    ]);
  }
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
  // N₀ = −(ΣF_x c + ΣF_y s), V₀ = −ΣF_x s + ΣF_y c, with c or s equal to ±1 and the other zero.
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
      lhs: 'N₀', symbolic: along?.axial[0] ?? '−(ΣF_x c + ΣF_y s)',
      substituted: along?.axial[1] ?? `−(${fx}${c} + ${fy}${s})`,
      result: fig(start.axial, 1, 0, scale.force), unit: unit(1, 0),
    },
    {
      lhs: 'V₀', symbolic: along?.shear[0] ?? '−ΣF_x s + ΣF_y c',
      substituted: along?.shear[1] ?? `−${fx}${s} + ${fy}${c}`,
      result: fig(start.shear, 1, 0, scale.force), unit: unit(1, 0),
    },
    {
      lhs: 'M₀', symbolic: `−ΣM(${member.startNodeId})`,
      substituted: `−(${fig(start.moment, 1, 1, scale.moment)})`,
      result: fig(start.bending, 1, 1, scale.moment), unit: unit(1, 1),
    },
  ];
};

const drawMember = (context: ReportContext, figures: Figures, member: MemberCuts, scale: { force: number; moment: number }): void => {
  const { layout } = context;
  const { fonts, palette } = layout;
  const { fig, unit } = figures;
  const { start } = member;
  layout.heading(`Barra ${member.memberId}: ${member.startNodeId} → ${member.endNodeId}`, 3);
  layout.text(
    `L = ${fig(member.length, 0, 1)} ${unit(0, 1)}; cosenos directores c = ${number(member.c, 4)}, s = ${number(member.s, 4)}. `
    + `La distancia s se mide desde ${member.startNodeId}; N es positiva a tensión, V(s) es la suma de las fuerzas en +y local `
    + 'a la izquierda del corte y M(s) cumple dM/ds = V.',
    8.1, fonts.regular, undefined, 8,
  );
  const others = start.memberIds.length ? ` y las barras ${start.memberIds.join(', ')}` : '';
  layout.text(
    `Al cortar ${member.memberId} justo después de ${member.startNodeId}, a ese lado quedan los nudos {${start.nodeIds.join(', ')}}${others}. `
    + 'Sus acciones externas ya son conocidas; su resultante es lo que el inicio de la barra recibe.',
    8.1, fonts.regular, undefined, 8,
  );
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
  const sideLabel = `lado ${member.startNodeId}`;
  drawEquations(context, `Acciones del lado de ${member.startNodeId}: ${start.actions.map((action) => action.label).join(', ') || 'ninguna'}.`, [
    { lhs: `ΣF_x(${sideLabel})`, substituted: forceTerms('fx').length ? signedSum(forceTerms('fx')) : '0', result: fig(start.fx, 1, 0, scale.force), unit: unit(1, 0) },
    { lhs: `ΣF_y(${sideLabel})`, substituted: forceTerms('fy').length ? signedSum(forceTerms('fy')) : '0', result: fig(start.fy, 1, 0, scale.force), unit: unit(1, 0) },
    { lhs: `ΣM(${member.startNodeId})`, substituted: momentTerms.length ? signedSum(momentTerms) : '0', result: fig(start.moment, 1, 1, scale.moment), unit: unit(1, 1) },
  ]);

  drawEquations(
    context,
    'Fuerzas internas justo después del nudo inicial (s = 0⁺), en ejes locales de la barra:',
    startEquations(figures, member, scale),
  );

  member.stretches.forEach((stretch, index) => drawStretch(context, figures, member, stretch, index, scale));
  layout.text(
    `Momento de mayor valor absoluto en ${member.memberId}: M = ${fig(member.peakMoment.value, 1, 1, scale.moment)} ${unit(1, 1)} `
    + `en s = ${fig(member.peakMoment.s, 0, 1)} ${unit(0, 1)}.`,
    8.3, fonts.bold, palette.ink, 8,
  );
};

export const drawStaticsSections = (context: ReportContext, solution: StaticsSectionsResult): void => {
  const { layout } = context;
  const { fonts, palette } = layout;
  const figures = figuresFor(context);
  const { fig, unit } = figures;
  const { unknowns, equations } = solution;
  const independent = equations.filter((equation) => equation.independent);
  const hinges = independent.filter((equation) => equation.kind === 'hinge');
  const forceScale = Math.max(
    1,
    ...unknowns.filter((unknown) => unknown.kind === 'force').map((unknown) => Math.abs(unknown.value)),
    ...solution.resultants.map((entry) => Math.hypot(entry.fx, entry.fy)),
  );
  const extent = Math.max(1, ...solution.members.map((member) => member.length));
  const scale = { force: forceScale, moment: forceScale * extent };

  layout.heading('5. Procedimiento: Método de secciones (estática y cortes)');
  layout.text(
    'La estructura es isostática: sus reacciones salen sólo de las ecuaciones de equilibrio, y cada fuerza '
    + 'interna sale de cortar la barra y equilibrar el trozo que queda a un lado. No interviene ninguna rigidez. '
    + 'El orden es el de la pizarra: cuerpo libre, resultantes, ecuaciones, reacciones y, barra por barra, '
    + 'un corte por tramo con N(s), V(s) y M(s).',
    8.7, fonts.regular, undefined, 8,
  );

  // 5.1 ---------------------------------------------------------------------------------------
  layout.heading('5.1 Clasificación y diagrama de cuerpo libre', 2);
  layout.text(
    `Es ${KIND_LABEL[solution.classification.kind]} con ${unknowns.length} componentes de reacción. `
    + `Hay 3 ecuaciones de equilibrio global${hinges.length ? ` y ${hinges.length} de articulación (ΣM = 0 de una parte)` : ''}: `
    + `${independent.length} ecuaciones independientes para ${unknowns.length} incógnitas, g = 0.`,
    8.3, fonts.regular, undefined, 8,
  );
  layout.keyValues(unknowns.map((unknown) => [unknown.symbol, unknownSense(context, unknown)]), 110);
  drawScene(context, wholeStructureScene(context, solution), 'Diagrama de cuerpo libre de la estructura completa, con las reacciones como incógnitas.');

  // 5.2 ---------------------------------------------------------------------------------------
  layout.heading('5.2 Resultantes de las cargas', 2);
  layout.text(
    'Cada carga se reduce a una fuerza en un punto. Una carga repartida trapecial se separa en un bloque uniforme '
    + '(resultante q·L en el centro del tramo cargado, de longitud L) y un triángulo con la variación (resultante '
    + 'Δq·L/2 a dos tercios desde el inicio a). Las intensidades ya incluyen el factor del escenario.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const resultant of solution.resultants) {
    const factor = resultant.factor !== 1 ? ` (factor ${number(resultant.factor, 4)})` : '';
    const equations: EquationInput[] = [];
    if (resultant.intensity !== undefined && resultant.basisLength !== undefined) {
      const magnitude = Math.hypot(resultant.fx, resultant.fy);
      const triangle = resultant.kind === 'triangular';
      equations.push({
        lhs: `|${resultant.label}|`,
        symbolic: triangle ? 'Δq L/2' : resultant.kind === 'self-weight' ? 'w L' : 'q L',
        substituted: `(${fig(resultant.intensity, 1, -1)})(${fig(resultant.basisLength, 0, 1)})${triangle ? '/2' : ''}`,
        result: fig(magnitude, 1, 0),
        unit: unit(1, 0),
      });
      if (resultant.loadStart !== undefined && resultant.loadLength !== undefined && resultant.station !== undefined) {
        equations.push({
          lhs: `s(${resultant.label})`,
          symbolic: triangle ? 'a + 2L/3' : 'a + L/2',
          substituted: `${fig(resultant.loadStart, 0, 1)} + ${triangle ? '2' : ''}(${fig(resultant.loadLength, 0, 1)})/${triangle ? '3' : '2'}`,
          result: fig(resultant.station, 0, 1),
          unit: unit(0, 1),
        });
      }
    }
    drawEquations(context, `${resultant.label}: ${resultantSource(resultant)}${factor}`, equations);
    if (!equations.length) layout.text(`${resultant.label}: ${resultantSource(resultant)}${factor}`, 7.9, fonts.bold, palette.ink, 12);
    const position = `(${fig(resultant.at.x, 0, 1)}, ${fig(resultant.at.y, 0, 1)}) ${unit(0, 1)}`;
    const basis = resultant.basis && resultant.basis !== 'real' ? `; L medida en ${basisLabel(resultant.basis)}` : '';
    layout.keyValues([[
      resultant.kind === 'couple' ? 'Par' : 'Componentes',
      resultant.kind === 'couple'
        ? `C = ${fig(resultant.couple, 1, 1)} ${unit(1, 1)} (antihorario positivo), en ${position}`
        : `F_x = ${fig(resultant.fx, 1, 0, scale.force)} ${unit(1, 0)}, F_y = ${fig(resultant.fy, 1, 0, scale.force)} ${unit(1, 0)}, aplicada en ${position}`
          + `${resultant.station !== undefined && resultant.memberId ? `, a ${fig(resultant.station, 0, 1)} ${unit(0, 1)} del nudo inicial de ${resultant.memberId}` : ''}${basis}`,
    ]], 110);
  }
  if (solution.loadCheck) {
    const { statics, solver, referencePoint, residual } = solution.loadCheck;
    layout.text(
      `Suma de todas las resultantes, con momentos respecto a (${fig(referencePoint.x, 0, 1)}, ${fig(referencePoint.y, 0, 1)}) ${unit(0, 1)}: `
      + `ΣF_x = ${fig(statics.fx, 1, 0, scale.force)} ${unit(1, 0)}, ΣF_y = ${fig(statics.fy, 1, 0, scale.force)} ${unit(1, 0)}, `
      + `ΣM = ${fig(statics.mz, 1, 1, scale.moment)} ${unit(1, 1)}. La auditoría independiente de cargas del análisis da `
      + `${fig(solver.fx, 1, 0, scale.force)}, ${fig(solver.fy, 1, 0, scale.force)} y ${fig(solver.mz, 1, 1, scale.moment)}; `
      + `diferencia relativa ${clearNumber(residual, 1)}.`,
      8.1, fonts.regular, undefined, 8,
    );
  }

  // 5.3 ---------------------------------------------------------------------------------------
  layout.heading('5.3 Ecuaciones de equilibrio', 2);
  layout.text(
    'Fuerzas positivas hacia +x y +y; momentos positivos en sentido antihorario. En las sumas de momentos cada '
    + 'carga aparece como brazo × fuerza con el signo de su giro, y cada incógnita lleva su brazo como coeficiente.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const equation of independent) {
    if (equation.kind === 'hinge') {
      const release = equation.release!;
      layout.text(
        `Articulación en ${release.nodeId} (extremo de ${release.memberId}): el momento ahí es nulo, así que la parte `
        + `{${equation.nodeIds.join(', ')}}${equation.memberIds.length ? ` con ${equation.memberIds.join(', ')}` : ''} `
        + 'suma cero en momentos respecto a ese punto. Se toma el lado con menos incógnitas.',
        8.1, fonts.regular, undefined, 8,
      );
      drawScene(context, hingeScene(context, solution, equation), `Parte a un lado de la articulación ${release.nodeId}: ΣM(${release.nodeId}) = 0.`);
    }
    const terms = equationTerms(figures, equation, unknowns, scale);
    const moment = equation.kind === 'moment' || equation.kind === 'hinge';
    drawEquations(context, undefined, [{
      lhs: equationLabel(equation),
      substituted: terms.length ? signedSum(terms) : '0',
      result: '0',
      unit: unit(1, moment ? 1 : 0),
    }]);
  }
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
    layout.note(
      `${dependent === 1 ? 'Otra ecuación de articulación' : `Otras ${dependent} ecuaciones de articulación`} (el mismo punto visto `
      + 'desde el otro lado) no aporta información nueva; se usa sólo como comprobación y también se cumple.'
      + crowded.map(([nodeId, count]) => (
        ` En ${nodeId} concurren ${count} barras: de sus ${count} ecuaciones de momento nulo sólo ${count - 1} son independientes, `
        + 'porque juntas equivalen al equilibrio de momentos del propio nudo, que las sumas globales ya imponen.'
      )).join(''),
      8,
    );
  }

  // 5.4 ---------------------------------------------------------------------------------------
  layout.heading('5.4 Reacciones', 2);
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
      drawEquations(
        context,
        `De ${equationLabel(equation)}${names.length ? `, con ${names.join(', ')} ya ${names.length === 1 ? 'conocida' : 'conocidas'}` : ''}:`,
        [{
          lhs: unknown.symbol,
          substituted: Math.abs(coefficient - 1) <= 1e-12 || flip ? numerator : `(${numerator})/(${coefficientText})`,
          result: fig(unknown.value, 1, lengthPower, scale.force),
          unit: unit(1, lengthPower),
        }],
      );
      solved.add(index);
      continue;
    }
    drawEquations(
      context,
      `Las ecuaciones ${step.equations.map((entry) => equationLabel(equations[entry]!)).join(', ')} se resuelven simultáneamente:`,
      step.unknowns.map((index) => {
        const unknown = unknowns[index]!;
        const lengthPower = unknown.kind === 'moment' ? 1 : 0;
        return { lhs: unknown.symbol, result: fig(unknown.value, 1, lengthPower, scale.force), unit: unit(1, lengthPower) };
      }),
    );
    step.unknowns.forEach((index) => solved.add(index));
  }
  layout.text(
    'Cada reacción contra lo que obtiene el análisis matricial en el mismo apoyo: el método y el solver tienen que coincidir.',
    8.1, fonts.regular, undefined, 8,
  );
  layout.keyValues(unknowns.map((unknown) => {
    const lengthPower = unknown.kind === 'moment' ? 1 : 0;
    const reversed = unknown.value < 0 && !negligible(unknown.value, scale.force) ? '; actúa al revés del sentido supuesto' : '';
    return [
      unknown.symbol,
      `${fig(unknown.value, 1, lengthPower, scale.force)} ${unit(1, lengthPower)} por estática · `
      + `${fig(unknown.solverValue, 1, lengthPower, scale.force)} ${unit(1, lengthPower)} por el análisis matricial${reversed}`,
    ];
  }), 110);

  // 5.5 ---------------------------------------------------------------------------------------
  layout.heading('5.5 Fuerzas internas por cortes', 2);
  layout.text(
    'Cada barra se corta a una distancia s de su nudo inicial y se conserva el cuerpo libre izquierdo: todo lo que '
    + 'queda del lado de ese nudo más el trozo [0, s]. El lado del nudo entrega N₀, V₀ y M₀ en el inicio; las cargas '
    + 'del trozo se suman encima. La expresión cambia sólo donde empieza o termina una carga, así que hay un corte por tramo.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const member of solution.members) drawMember(context, figures, member, scale);

  // 5.6 ---------------------------------------------------------------------------------------
  layout.heading('5.6 Verificación contra el análisis matricial', 2);
  layout.text(
    'Los dos caminos parten del mismo modelo y llegan por separado; si no coincidieran, el procedimiento de arriba '
    + 'estaría mal y no se habría impreso. Diferencias máximas medidas:',
    8.3, fonts.regular, undefined, 8,
  );
  layout.keyValues([
    ['Reacciones (fuerza)', `${clearNumber(solution.reactionResidual.force, 1)} ${unit(1, 0)}`],
    ['Reacciones (momento)', `${clearNumber(solution.reactionResidual.moment, 1)} ${unit(1, 1)}`],
    ['N y V a lo largo de las barras', `${clearNumber(solution.diagramResidual.force, 1)} ${unit(1, 0)}`],
    ['M a lo largo de las barras', `${clearNumber(solution.diagramResidual.moment, 1)} ${unit(1, 1)}`],
    ...(solution.loadCheck ? [['Resultante de cargas (relativa)', clearNumber(solution.loadCheck.residual, 1)] as const] : []),
  ], 170);
  layout.text(
    `Momento de mayor valor absoluto en la estructura: ${fig(solution.peakMoment.value, 1, 1, scale.moment)} ${unit(1, 1)} `
    + `en la barra ${solution.peakMoment.memberId}, s = ${fig(solution.peakMoment.s, 0, 1)} ${unit(0, 1)}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};
