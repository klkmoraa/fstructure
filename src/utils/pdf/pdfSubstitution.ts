/**
 * Las cifras de la memoria, sustituidas con los números de este proyecto.
 *
 * Aquí se arman las relaciones desarrolladas y las filas de las tablas que el procedimiento
 * matricial y los métodos de armaduras escriben; el dibujo vive en las secciones. Dos reglas:
 *
 *  1. **La aritmética impresa cierra.** Los números de un mismo producto o suma se convierten
 *     con un par fuerza–longitud coherente (`dimensionalValue`), nunca con los factores de
 *     presentación de cada magnitud: `E` en MPa por `A` en m² entre `L` en m no es `EA/L` en
 *     ninguna unidad. Una relación reconstruida aquí se compara con la cifra del análisis
 *     matricial y, si no coincide, no se imprime.
 *  2. **El ruido numérico se lee como cero.** Cada cifra se colapsa contra la magnitud que
 *     gobierna su familia, igual que en el resto de la memoria.
 */
import { unitLabel } from '../../engine/units';
import { frameLocalStiffness } from '../../engine/solver';
import { toDisplay } from '../../foundation/units';
import { memberAxis } from '../../graphics/structureGeometry';
import { clearNumber, number } from './pdfFormat';
import type { WorkedEquation } from './pdfEquation';
import type { ReportContext } from './reportContext';
import type { MatrixTrace, MemberModel, ProjectModel } from '../../types';

const SUPERSCRIPT: Readonly<Record<string, string>> = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };

/**
 * Value in the presentation system's *coherent* force–length pair.
 *
 * `toDisplay(value, units, 'elasticModulus')` answers in MPa or ksi, which is right for a
 * property sheet and wrong inside `EA/L`: the product would no longer be the force per unit
 * length it claims. Composing the conversion from the force and length factors instead keeps
 * every operand of one expression in the same system, so the multiplication the reader
 * repeats on a calculator gives the printed result.
 */
export const dimensionalValue = (project: ProjectModel, value: number, forcePower: number, lengthPower: number): number => {
  const force = toDisplay(1, project.settings.units, 'force');
  const length = toDisplay(1, project.settings.units, 'length');
  return value * force ** forcePower * length ** lengthPower;
};

const withPower = (label: string, exponent: number): string =>
  exponent === 1 ? label : `${label}${SUPERSCRIPT[String(exponent)] ?? `^${exponent}`}`;

/** `kN`, `kN/m`, `kN·m²`, `kip/ft²` — the unit of a force^a · length^b quantity. */
export const dimensionalUnit = (project: ProjectModel, forcePower: number, lengthPower: number): string => {
  const force = unitLabel(project.settings.units, 'force');
  const length = unitLabel(project.settings.units, 'length');
  const numerators: string[] = [];
  const denominators: string[] = [];
  if (forcePower > 0) numerators.push(withPower(force, forcePower));
  else if (forcePower < 0) denominators.push(withPower(force, -forcePower));
  if (lengthPower > 0) numerators.push(withPower(length, lengthPower));
  else if (lengthPower < 0) denominators.push(withPower(length, -lengthPower));
  const head = numerators.join('·') || '1';
  return denominators.length ? `${head}/${denominators.join('·')}` : head;
};

/** Presentation figure of a force^a · length^b quantity, collapsed against its own family. */
export const dimensionalFigure = (project: ProjectModel, value: number, forcePower: number, lengthPower: number, reference = value): string =>
  clearNumber(
    dimensionalValue(project, value, forcePower, lengthPower),
    Math.max(1, Math.abs(dimensionalValue(project, reference, forcePower, lengthPower))),
    6,
  );

/** Local alias: the substitution builders below call it on nearly every line. */
const dim = dimensionalFigure;

/** Wraps a negative operand so `a · −b` never reads as a subtraction. */
const operand = (text: string): string => text.startsWith('−') || text.startsWith('-') ? `(${text})` : text;

/** `12.5 - 4.2 + 0.75`: a chain of signed terms written the way it is added up. */
export const signedSum = (terms: readonly string[]): string => {
  if (!terms.length) return '0';
  return terms.reduce((accumulated, value, index) => {
    if (index === 0) return value;
    const negative = value.startsWith('−') || value.startsWith('-');
    return `${accumulated} ${negative ? '-' : '+'} ${negative ? value.slice(1) : value}`;
  }, '');
};

/** Scenario multiplier behind a load, or `undefined` when its case is not in this scenario. */
const caseFactor = (context: ReportContext, caseId: string): number | undefined => {
  const factor = context.scenarioFactors[caseId];
  return factor === undefined || factor === 0 ? undefined : factor;
};

const hasActiveMemberLoads = (context: ReportContext): boolean =>
  context.project.memberLoads.some((load) => caseFactor(context, load.caseId) !== undefined);

/** Largest absolute value of a family, so `clearNumber` has something to collapse against. */
export const scaleOf = (values: readonly number[]): number => Math.max(1e-12, ...values.map((value) => Math.abs(value)));

/**
 * True when two figures are the same number written two ways, relative to the magnitudes
 * involved. Every worked relation in the method sections is gated on this: a memoir must not
 * print an equality that its own numbers do not satisfy.
 */
export const agrees = (left: number, right: number, scale = 1): boolean =>
  Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(scale));

// ---------------------------------------------------------------------------------------
// Método matricial: datos de cada barra
// ---------------------------------------------------------------------------------------

/** Una barra tal como entra en la rigidez: longitud flexible y cosenos directores de i a j. */
interface MemberGeometry {
  readonly member: MemberModel;
  readonly L: number;
  readonly c: number;
  readonly s: number;
  readonly curved: boolean;
}

export const memberGeometry = (context: ReportContext): MemberGeometry[] => context.project.members.flatMap((member) => {
  const ni = context.index.node(member.i);
  const nj = context.index.node(member.j);
  if (!ni || !nj) return [];
  const axis = memberAxis(member, ni, nj);
  return [{ member, L: axis.flexibleLength, c: axis.c, s: axis.s, curved: Boolean(member.curve) }];
});

/**
 * Los cinco términos distintos de la rigidez local de una barra recta:
 * `EA/L`, `12EI/L³`, `6EI/L²`, `4EI/L` y `2EI/L` (con cortante, los de Timoshenko).
 */
export interface StiffnessTerms {
  readonly axial: number;
  readonly shear: number;
  readonly coupling: number;
  readonly near: number;
  readonly far: number;
}

const entry = (matrix: MatrixTrace, row: number, column: number): number =>
  matrix.entries.find((cell) => cell.row === row && cell.column === column)?.value ?? 0;

/**
 * Los términos con que el análisis ensambló la barra: los de su traza cuando existe (incluyen
 * lo que la fórmula de libro no tiene, como el cortante de Timoshenko), y si no, la misma
 * función de rigidez del análisis.
 */
export const stiffnessTerms = (context: ReportContext, geometry: MemberGeometry): StiffnessTerms | undefined => {
  const { member, L } = geometry;
  if (member.type === 'rigid' || geometry.curved || !(L > 0)) return undefined;
  const element = context.analysis.educationTrace?.elements.find((item) => item.memberId === member.id);
  if (element) {
    const k = element.localStiffnessOriginal;
    return { axial: entry(k, 0, 0), shear: entry(k, 1, 1), coupling: entry(k, 1, 2), near: entry(k, 2, 2), far: entry(k, 2, 5) };
  }
  if (member.type === 'truss') return { axial: (member.E * member.A) / L, shear: 0, coupling: 0, near: 0, far: 0 };
  const k = frameLocalStiffness(member, L);
  return { axial: k[0][0], shear: k[1][1], coupling: k[1][2], near: k[2][2], far: k[2][5] };
};

/**
 * La rigidez de una barra desarrollada con sus números: cada término es su regla con `E`, `A`,
 * `I` y `L` sustituidos. Sólo se escribe el término que coincide con el que se ensambló.
 */
export const stiffnessExample = (context: ReportContext, geometry: MemberGeometry, terms: StiffnessTerms): WorkedEquation[] => {
  const { project } = context;
  const { member, L } = geometry;
  const E = dim(project, member.E, 1, -2);
  const A = dim(project, member.A, 0, 2);
  const I = dim(project, member.I ?? 0, 0, 4);
  const length = dim(project, L, 0, 1);
  const EI = member.E * (member.I ?? 0);
  const equations: WorkedEquation[] = [];
  if (agrees(member.E * member.A / L, terms.axial, terms.axial)) {
    equations.push({ lhs: 'EA/L', substituted: `(${E})(${A})/(${length})`, result: dim(project, terms.axial, 1, -1), unit: dimensionalUnit(project, 1, -1) });
  }
  if (member.type !== 'frame' || !(EI > 0)) return equations;
  const flexural: Array<[string, string, number, number, number]> = [
    ['12EI/L^3', `12(${E})(${I})/(${length})^3`, 12 * EI / L ** 3, terms.shear, -1],
    ['6EI/L^2', `6(${E})(${I})/(${length})^2`, 6 * EI / L ** 2, terms.coupling, 0],
    ['4EI/L', `4(${E})(${I})/(${length})`, 4 * EI / L, terms.near, 1],
    ['2EI/L', `2(${E})(${I})/(${length})`, 2 * EI / L, terms.far, 1],
  ];
  for (const [lhs, substituted, value, assembled, lengthPower] of flexural) {
    if (!agrees(value, assembled, assembled)) continue;
    equations.push({ lhs, substituted, result: dim(project, assembled, 1, lengthPower), unit: dimensionalUnit(project, 1, lengthPower) });
  }
  return equations;
};

// ---------------------------------------------------------------------------------------
// Método matricial: cargas
// ---------------------------------------------------------------------------------------

/** Cargas en los nudos ya multiplicadas por su factor, sumadas por nudo: `[P_x, P_y, M]`. */
export const nodalLoadTotals = (context: ReportContext): Array<{ nodeId: string; fx: number; fy: number; mz: number }> => {
  const totals = new Map<string, { nodeId: string; fx: number; fy: number; mz: number }>();
  for (const load of context.project.nodalLoads) {
    const factor = caseFactor(context, load.caseId);
    if (factor === undefined) continue;
    const total = totals.get(load.nodeId) ?? { nodeId: load.nodeId, fx: 0, fy: 0, mz: 0 };
    total.fx += factor * load.fx;
    total.fy += factor * load.fy;
    total.mz += factor * load.mz;
    totals.set(load.nodeId, total);
  }
  return [...totals.values()].filter((total) => Math.abs(total.fx) + Math.abs(total.fy) + Math.abs(total.mz) > 0);
};

/**
 * Vector de cargas equivalentes de una barra con carga uniforme en todo su claro, desarrollado:
 * `qL/2` y `qL²/12`. La intensidad se lee del tramo del diagrama (incluye el peso propio) y el
 * desarrollo se imprime sólo si reproduce el vector que se ensambló.
 */
export const uniformLoadExample = (context: ReportContext): { memberId: string; equations: WorkedEquation[] } | undefined => {
  const { project, analysis } = context;
  for (const element of analysis.educationTrace?.elements ?? []) {
    const result = context.index.memberResult(element.memberId);
    const segment = result?.diagramSegments.length === 1 ? result.diagramSegments[0] : undefined;
    if (!segment) continue;
    // `q(ξ) = q₀ + q₁ξ`: uniforme cuando no tiene pendiente.
    const [qa, slope] = segment.distributedTransverse;
    const L = element.length;
    const f = element.localEquivalentLoadOriginal;
    if (!(L > 0) || Math.abs(qa) === 0 || !agrees(slope * L, 0, qa)) continue;
    const scale = scaleOf(f);
    if (!agrees(qa * L / 2, f[1] ?? Number.NaN, scale) || !agrees(qa * L * L / 12, f[2] ?? Number.NaN, scale)) continue;
    const q = dim(project, qa, 1, -1);
    const length = dim(project, L, 0, 1);
    return {
      memberId: element.memberId,
      equations: [
        { lhs: 'q L/2', substituted: `(${q})(${length})/2`, result: dim(project, f[1]!, 1, 0), unit: unitLabel(project.settings.units, 'force') },
        { lhs: 'q L^2/12', substituted: `(${q})(${length})^2/12`, result: dim(project, f[2]!, 1, 1), unit: dimensionalUnit(project, 1, 1) },
      ],
    };
  }
  return undefined;
};

// ---------------------------------------------------------------------------------------
// Método matricial: recuperación de la fuerza en una barra de armadura
// ---------------------------------------------------------------------------------------

/** Alargamiento `δ = (u_j − u_i)c + (v_j − v_i)s` de una barra recta, desde los desplazamientos nodales. */
export const elongation = (context: ReportContext, geometry: MemberGeometry): number | undefined => {
  const i = context.analysis.nodeResults.find((node) => node.nodeId === geometry.member.i);
  const j = context.analysis.nodeResults.find((node) => node.nodeId === geometry.member.j);
  if (!i || !j) return undefined;
  return (j.ux - i.ux) * geometry.c + (j.uy - i.uy) * geometry.s;
};

/** Fuerza axial de una barra de armadura (+ tensión), tal como la publicó el análisis. */
export const trussAxial = (context: ReportContext, memberId: string): number =>
  context.index.memberResult(memberId)?.diagram[0]?.axial ?? 0;

/**
 * `N = (EA/L)[(u_j − u_i)c + (v_j − v_i)s]` con los números de una barra, o nada si la
 * cuenta no reproduce la fuerza que el análisis publicó.
 */
export const trussForceExample = (context: ReportContext, geometry: MemberGeometry, terms: StiffnessTerms): WorkedEquation | undefined => {
  const { project, analysis } = context;
  const delta = elongation(context, geometry);
  const i = analysis.nodeResults.find((node) => node.nodeId === geometry.member.i);
  const j = analysis.nodeResults.find((node) => node.nodeId === geometry.member.j);
  const axial = trussAxial(context, geometry.member.id);
  if (delta === undefined || !i || !j || !agrees(terms.axial * delta, axial, axial)) return undefined;
  const scale = scaleOf([i.ux, i.uy, j.ux, j.uy]);
  const u = (value: number) => dim(project, value, 0, 1, scale);
  return {
    lhs: `N_{${geometry.member.id}}`,
    symbolic: '(EA/L)[(u_j − u_i) c + (v_j − v_i) s]',
    substituted: `(${dim(project, terms.axial, 1, -1)})[(${u(j.ux)} − ${operand(u(i.ux))})(${number(geometry.c, 4)}) + (${u(j.uy)} − ${operand(u(i.uy))})(${number(geometry.s, 4)})]`,
    result: dim(project, axial, 1, 0),
    unit: unitLabel(project.settings.units, 'force'),
  };
};

// ---------------------------------------------------------------------------------------
// Equilibrio global
// ---------------------------------------------------------------------------------------

interface EquilibriumSum {
  /** `ΣF_x`, `ΣF_y`, `ΣM_O`. */
  readonly symbol: string;
  /** La suma desarrollada: resultante de las cargas y, término a término, cada reacción. */
  readonly worked: WorkedEquation;
  /** Closing value alone, for the cover's result chip. */
  readonly result: string;
  readonly unit: string;
}

/**
 * The three global sums, term by term.
 *
 * Each expansion is rebuilt here from the applied resultants and the solved reactions, and
 * then checked against the figure the engine itself published. A reconstruction that does
 * not reproduce the engine's own sum is not printed as an expansion: the report would be
 * showing arithmetic nobody performed. In that case the closing value still appears, alone.
 */
export const equilibriumSums = (context: ReportContext, maxTerms = 13): EquilibriumSum[] => {
  const { project, analysis } = context;
  const audit = analysis.loadAudit;
  const forceUnit = unitLabel(project.settings.units, 'force');
  const momentUnit = dimensionalUnit(project, 1, 1);
  const reference = audit
    ? Math.max(Math.abs(audit.source.fx), Math.abs(audit.source.fy), 1)
    : scaleOf(analysis.nodeResults.flatMap((node) => [node.rx, node.ry]));
  const momentReference = Math.max(Math.abs(audit?.source.mz ?? 0), Math.abs(analysis.equilibrium.sumM), 1);
  const origin = analysis.equilibrium.referencePoint ?? audit?.referencePoint ?? { x: 0, y: 0 };
  const supported = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0);
  const nodeOf = (nodeId: string) => context.index.node(nodeId);

  const build = (
    symbol: string,
    engineValue: number,
    appliedValue: number | undefined,
    reactionTerm: (node: typeof supported[number]) => number,
    forcePower: number,
    lengthPower: number,
    scale: number,
    unit: string,
  ): EquilibriumSum => {
    const closing = clearNumber(dimensionalValue(project, engineValue, forcePower, lengthPower), Math.max(1, Math.abs(dimensionalValue(project, scale, forcePower, lengthPower))), 6);
    const alone: EquilibriumSum = { symbol, worked: { lhs: symbol, result: closing, unit }, result: `${closing} ${unit}`, unit };
    if (appliedValue === undefined) return alone;
    const reactions = supported.map(reactionTerm);
    // Past a handful of supports the expansion stops being readable, so the reactions
    // collapse into their own single term. The sum printed is still the sum performed —
    // one fewer intermediate step, never a different arithmetic.
    const terms = reactions.length + 1 > maxTerms
      ? [appliedValue, reactions.reduce((sum, value) => sum + value, 0)]
      : [appliedValue, ...reactions];
    const total = terms.reduce((sum, value) => sum + value, 0);
    // Tolerance is relative to the actions that produced the sum: an expansion agreeing to
    // one part in 1e-8 of the load is the same sum, written differently.
    if (Math.abs(total - engineValue) > 1e-8 * Math.max(1, Math.abs(scale))) return alone;
    const written = signedSum(terms.map((value) => dim(project, value, forcePower, lengthPower, scale)));
    return { symbol, worked: { lhs: symbol, substituted: written, result: closing, unit }, result: `${closing} ${unit}`, unit };
  };

  return [
    build('ΣF_x', analysis.equilibrium.sumFx, audit?.source.fx, (node) => node.rx, 1, 0, reference, forceUnit),
    build('ΣF_y', analysis.equilibrium.sumFy, audit?.source.fy, (node) => node.ry, 1, 0, reference, forceUnit),
    build(
      'ΣM_O',
      analysis.equilibrium.sumM,
      audit?.source.mz,
      (node) => {
        const model = nodeOf(node.nodeId);
        if (!model) return Number.NaN;
        return node.rm + node.ry * (model.x - origin.x) - node.rx * (model.y - origin.y);
      },
      1,
      1,
      momentReference,
      momentUnit,
    ),
  ];
};

// ---------------------------------------------------------------------------------------
// Free bodies: what the truss methods actually add up
// ---------------------------------------------------------------------------------------

/** One bar crossing the boundary of a free body, and the end of it that stays inside. */
interface SeveredBar {
  readonly memberId: string;
  /** Node of the bar that belongs to the retained portion. */
  readonly nodeId: string;
  /** Axial force, tension positive. */
  readonly force: number;
}

/**
 * The equilibrium of a retained portion of a truss, written out term by term.
 *
 * This is the arithmetic the Method of Joints and the Method of Sections actually perform:
 * each bar force multiplied by its own direction cosine, plus the reactions and applied loads
 * of the retained nodes, adding up to zero. Each sum is written twice — first with the names
 * of its terms (`N_{CI1} c_{CI1} + F_x(B0)`), then with their numbers — and printed only if it
 * really closes on this analysis's numbers. The whole development is skipped when the model
 * carries member loads, whose distributed contribution this helper does not integrate.
 */
export const freeBodyEquations = (
  context: ReportContext,
  keptNodeIds: readonly string[],
  bars: readonly SeveredBar[],
): WorkedEquation[] => {
  const { project, analysis, index } = context;
  if (hasActiveMemberLoads(context)) return [];
  const origin = index.node(keptNodeIds[0]);
  if (!origin) return [];

  interface Term { fx: number; fy: number; x: number; y: number; bar?: SeveredBar; nodeId?: string; c?: number; s?: number }
  const terms: Term[] = [];
  const scaleOfForces: number[] = [];

  for (const bar of bars) {
    const member = index.member(bar.memberId);
    const here = index.node(bar.nodeId);
    if (!member || !here) return [];
    const farId = member.i === bar.nodeId ? member.j : member.i;
    const far = index.node(farId);
    if (!far) return [];
    // Medido desde el nudo conservado hacia el otro extremo: una barra en tensión tira del nudo
    // hacia ella. (`memberAxis` usa los dos nudos en el orden en que se le pasan.)
    const axis = memberAxis(member, here, far);
    terms.push({ fx: bar.force * axis.c, fy: bar.force * axis.s, x: here.x, y: here.y, bar, c: axis.c, s: axis.s });
    scaleOfForces.push(bar.force);
  }
  for (const nodeId of keptNodeIds) {
    const node = index.node(nodeId);
    const result = analysis.nodeResults.find((item) => item.nodeId === nodeId);
    if (!node) return [];
    const loads = project.nodalLoads.filter((load) => load.nodeId === nodeId && caseFactor(context, load.caseId) !== undefined);
    const fx = (result?.rx ?? 0) + loads.reduce((sum, load) => sum + (caseFactor(context, load.caseId) ?? 1) * load.fx, 0);
    const fy = (result?.ry ?? 0) + loads.reduce((sum, load) => sum + (caseFactor(context, load.caseId) ?? 1) * load.fy, 0);
    if (Math.abs(fx) + Math.abs(fy) === 0) continue;
    terms.push({ fx, fy, x: node.x, y: node.y, nodeId });
    scaleOfForces.push(fx, fy);
  }
  if (!terms.length) return [];
  const scale = scaleOf(scaleOfForces);
  const forceUnit = unitLabel(project.settings.units, 'force');

  const named = (term: Term, component: 'fx' | 'fy'): string => term.bar
    ? `N_{${term.bar.memberId}} ${component === 'fx' ? 'c' : 's'}_{${term.bar.memberId}}`
    : `F_${component === 'fx' ? 'x' : 'y'}(${term.nodeId})`;
  const valued = (term: Term, component: 'fx' | 'fy'): string => {
    if (!term.bar) return dim(project, term[component], 1, 0, scale);
    const cosine = (component === 'fx' ? term.c : term.s) ?? 0;
    return `(${dim(project, term.bar.force, 1, 0, scale)})(${number(cosine, 4)})`;
  };

  const equations: WorkedEquation[] = [];
  for (const [component, symbol] of [['fx', 'ΣF_x'], ['fy', 'ΣF_y']] as const) {
    const total = terms.reduce((sum, term) => sum + term[component], 0);
    if (!agrees(total, 0, scale)) continue;
    // Una barra de fuerza nula entra igual si tiene componente en esa dirección: es la suma que
    // demuestra que su fuerza es cero (ΣF_y = N_{M1}(1) = 0 en un nudo sin carga vertical).
    const present = terms.filter((term) => term.bar
      ? Math.abs((component === 'fx' ? term.c : term.s) ?? 0) > 1e-9
      : Math.abs(term[component]) > scale * 1e-12);
    if (!present.length) continue;
    equations.push({
      lhs: symbol,
      symbolic: present.map((term) => named(term, component)).join(' + '),
      substituted: signedSum(present.map((term) => valued(term, component))),
      result: '0',
      unit: forceUnit,
    });
  }
  // A single joint carries every force at the same point, so its moment sum is trivially zero
  // and printing it would add a row of noughts, not a check.
  if (keptNodeIds.length > 1) {
    const momentScale = Math.max(1, scale * Math.max(1, ...terms.map((term) => Math.hypot(term.x - origin.x, term.y - origin.y))));
    const moments = terms.map((term) => (term.x - origin.x) * term.fy - (term.y - origin.y) * term.fx);
    const total = moments.reduce((sum, value) => sum + value, 0);
    if (agrees(total, 0, momentScale)) {
      const written = signedSum(terms
        .map((term, position) => ({ term, moment: moments[position] }))
        .filter((item) => Math.abs(item.moment) > momentScale * 1e-12)
        .map(({ term }) => `(${dim(project, term.x - origin.x, 0, 1)})(${dim(project, term.fy, 1, 0, scale)})`
          + ` − (${dim(project, term.y - origin.y, 0, 1)})(${dim(project, term.fx, 1, 0, scale)})`));
      if (written && written !== '0') {
        equations.push({ lhs: `ΣM_{${origin.id}}`, symbolic: 'Σ(Δx F_y − Δy F_x)', substituted: written, result: '0', unit: dimensionalUnit(project, 1, 1) });
      }
    }
  }
  return equations;
};
