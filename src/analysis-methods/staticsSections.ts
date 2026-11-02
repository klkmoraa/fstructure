/**
 * El método de secciones para vigas y marcos isostáticos, resuelto de verdad: sólo estática y
 * cortes, como lo hace un estudiante.
 *
 * `methodOfSections.ts` corta armaduras; esto corta barras a flexión. El camino es el de la
 * pizarra:
 *
 *  1. Diagrama de cuerpo libre de toda la estructura: cada componente de reacción es una
 *     incógnita con un sentido supuesto (el rodillo, a lo largo de su normal).
 *  2. Cada carga se reduce a su resultante —magnitud, punto de aplicación y componentes— a
 *     partir de los datos del proyecto, no del solver. Su suma se compara con la auditoría
 *     independiente de cargas del análisis (`analysis.loadAudit`).
 *  3. Ecuaciones: ΣFx = 0, ΣFy = 0, ΣM = 0 respecto a un apoyo y, por cada articulación o
 *     liberación de momento, ΣM = 0 de la parte que queda a un lado. El sistema pequeño se
 *     resuelve aquí; las reacciones tienen que coincidir con las del análisis matricial.
 *  4. Cada barra se corta a una distancia s de su nudo inicial. El cuerpo libre izquierdo es
 *     todo lo que queda del lado de ese nudo más el trozo [0, s]; N(s), V(s) y M(s) salen de su
 *     equilibrio, tramo por tramo entre discontinuidades de carga, y se comparan con los
 *     diagramas exactos del solver.
 *
 * Convención (la del solver, en ejes locales de la barra): N positiva a tensión, V(s) = suma
 * de fuerzas en +y local a la izquierda del corte, M(s) positivo con dM/ds = V.
 *
 * Barras curvas (arcos circulares nativos): sus cargas se reducen sobre el arco verdadero
 * (`arcStatics.ts`), las ecuaciones globales y de articulación son las mismas, y cada arco se
 * corta en estaciones: N(φ), V(φ) y M(φ) salen del cuerpo libre izquierdo con N a lo largo de la
 * tangente y V hacia la izquierda de i→j. Como el solver sustituye el arco por cuerdas, la
 * comparación en un arco admite el mayor entre 1e-3 y 2δ/f relativo (δ, la flecha de una cuerda
 * de su malla; f, la del arco): una diferencia de ese orden es la del polígono, no del método.
 *
 * Alcance deliberadamente estrecho: sin resortes ni vínculos, sin excentricidades rígidas, sin
 * anillos cerrados y sin segundo orden. Lo que no cabe se rechaza con una razón; un método que no
 * coincidiera con el solver no sería una segunda opinión, sería un error.
 */
import { evaluateSegment } from '../engine/diagram';
import { withResolvedGeneratedLoads } from '../engine/generatedLoads';
import { selectedFactors } from '../engine/solver';
import { solveLinearSystem } from '../foundation/linearAlgebra';
import type { AnalysisResult, GlobalResultant, LoadCombination, MemberModel, NodeModel, ProjectModel } from '../types';
import type { CircularArcGeometry } from '../graphics/memberCurve';
import {
  arcCutAt,
  arcLoadsOf,
  arcLoadsTotal,
  arcPoint,
  arcTangent,
  basisLength as arcBasisLength,
  distributedCentroid,
  isUniformGlobal,
  lineOfActionPoint,
  memberArc,
  nearConcentrated,
  type ArcCut,
  type ArcLoad,
} from './arcStatics';
import { add, evaluate, shift, trim } from './polynomialAlgebra';
import { classifyStructure, type StructureClassification } from './structureClassification';

export interface Vec2 {
  x: number;
  y: number;
}

/** One reaction component: the unknown the free-body diagram of the whole structure exposes. */
export interface StaticsUnknown {
  /** `R_x(N1)`, `R_y(N2)`, `R_n(N2)` (roller normal), `M_R(N1)`. */
  symbol: string;
  nodeId: string;
  kind: 'force' | 'moment';
  /** Positive sense assumed on the diagram, as a global unit vector. Zero for a moment (CCW). */
  direction: Vec2;
  /** Value solved by statics, in the assumed sense. */
  value: number;
  /** What the matrix analysis reports for the same component. */
  solverValue: number;
}

export type LoadResultantKind = 'nodal' | 'point' | 'couple' | 'uniform' | 'triangular' | 'self-weight' | 'arc';

/** An applied action reduced to a force at a point (or a couple), straight from the project data. */
export interface LoadResultant {
  /** `F1`, `F2`… for forces, `C1`… for couples, in the order they are listed. */
  label: string;
  /** Load id in the project; `peso propio` for the self-weight of a member. */
  sourceId: string;
  kind: LoadResultantKind;
  memberId?: string;
  nodeId?: string;
  /** Global components, kN. */
  fx: number;
  fy: number;
  /** Applied couple, kN·m, counter-clockwise positive. */
  couple: number;
  /** Point of application, global coordinates. */
  at: Vec2;
  /** Distance from the member's node i, m. */
  station?: number;
  /** Scenario multiplier already applied to every figure above. */
  factor: number;
  /** Distributed loads: factored intensity magnitude, per unit of the basis length. */
  intensity?: number;
  /** Length the intensity is referred to (real, horizontal or vertical projection), m. */
  basisLength?: number;
  basis?: 'real' | 'horizontal' | 'vertical';
  /** Distributed loads: where the loaded stretch starts and how long it is, along the member. */
  loadStart?: number;
  loadLength?: number;
  /** Repartida sobre un arco: dónde empieza y cuánto mide el trozo cargado, a lo largo del arco. */
  arcSpan?: { from: number; length: number };
}

/** One term of an equilibrium sum. */
export interface EquationTerm {
  /** Index into `unknowns` when the term carries an unknown. */
  unknown?: number;
  /** Label of the known action (a `LoadResultant`) otherwise. */
  resultant?: string;
  /** Coefficient of the unknown, or the term's value for a known action. */
  value: number;
  /** Moment terms: arm from the centre to the point of application. */
  dx?: number;
  dy?: number;
  /** Force components of the term (unit direction for an unknown force). */
  fx?: number;
  fy?: number;
  couple?: number;
}

export interface EquilibriumEquation {
  kind: 'fx' | 'fy' | 'moment' | 'hinge';
  /** Moment centre for `moment` and `hinge`. */
  centreNodeId?: string;
  /** The free body the sum is written for: the whole structure, or one side of a release. */
  nodeIds: string[];
  memberIds: string[];
  /** Hinge equations: the released member end the moment vanishes at. */
  release?: { memberId: string; nodeId: string };
  /** Coefficient of each unknown; the equation reads Σ cᵢ·Xᵢ + constant = 0. */
  coefficients: number[];
  unknownTerms: EquationTerm[];
  knownTerms: EquationTerm[];
  constant: number;
  /** Chosen among the independent equations that determine the reactions. */
  independent: boolean;
}

/** The order a reader would solve in: one unknown per equation when possible. */
export interface SolutionStep {
  equation: number;
  /** One unknown is an explicit solve; several are solved simultaneously. */
  unknowns: number[];
  /** Simultaneous steps list every equation of the block. */
  equations: number[];
}

/** An action on the start side of a member cut, already known. */
export interface SideAction {
  label: string;
  fx: number;
  fy: number;
  couple: number;
  at: Vec2;
}

export interface MemberStartForces {
  /** Nodes and members on the side of node i when the member is cut. */
  nodeIds: string[];
  memberIds: string[];
  actions: SideAction[];
  fx: number;
  fy: number;
  /** Moment of the side about node i, counter-clockwise positive. */
  moment: number;
  /** N, V and M just past node i (s = 0⁺), from the equilibrium of that side. */
  axial: number;
  shear: number;
  bending: number;
}

/** One contribution to N(s), V(s), M(s) of the left free body, in local member axes. */
export type CutTerm =
  | { kind: 'start'; axial: number; shear: number; moment: number }
  | { kind: 'point'; label: string; at: number; px: number; py: number }
  | { kind: 'couple'; label: string; at: number; moment: number }
  /** Distributed load the cut passes through: integrated from `from` to s. */
  | { kind: 'partial'; label: string; from: number; qx: number; qy: number; slopeX: number; slopeY: number }
  /** Distributed load wholly left of the cut: its two resultants (uniform + triangular part). */
  | { kind: 'full'; label: string; from: number; length: number; wx: number; wy: number; wyTriangle: number; wxTriangle: number };

export interface StretchValues {
  axial: number;
  shear: number;
  moment: number;
}

export interface CutStretch {
  s0: number;
  s1: number;
  terms: CutTerm[];
  /** Polynomials in s (distance from node i), coefficient k multiplying sᵏ. */
  axial: number[];
  shear: number[];
  moment: number[];
  start: StretchValues;
  end: StretchValues;
  /** Interior points where V(s) = 0, with the moment there (a local extreme). */
  shearZeros: Array<{ s: number; moment: number }>;
}

/** One station of a curved member: the cut by statics and the solver at the same point. */
export interface ArcStation extends ArcCut {
  solver: StretchValues;
}

/** The cuts of a curved member, station by station: its N, V, M are not polynomials in s. */
export interface ArcMemberCuts {
  geometry: CircularArcGeometry;
  loads: ArcLoad[];
  /** Stations every 1/12 of the arc, for the table. */
  stations: ArcStation[];
  /** The cut written out in full: where |M| peaks. */
  worked: ArcStation;
  /** Polygon of the solver: chords, and the largest gap δ between a chord and the arc. */
  solverChords: number;
  chordSagitta: number;
  /** Relative tolerance the arc is checked against: max(1e-3, 2δ/f). */
  tolerance: number;
  /** Largest gaps at the checked stations. */
  residual: { force: number; moment: number };
}

export interface MemberCuts {
  memberId: string;
  startNodeId: string;
  endNodeId: string;
  /** Length along the axis (the arc length on a curved member). */
  length: number;
  /** Direction cosines of the member axis (its tangent at node i on a curved member). */
  c: number;
  s: number;
  start: MemberStartForces;
  /** Polynomial stretches of a straight member; empty on a curved one. */
  stretches: CutStretch[];
  /** Present on a curved member. */
  arc?: ArcMemberCuts;
  /** Largest |M| on the member and where. */
  peakMoment: { s: number; value: number };
}

export interface StaticsSectionsResult {
  applicable: true;
  classification: StructureClassification;
  unknowns: StaticsUnknown[];
  resultants: LoadResultant[];
  equations: EquilibriumEquation[];
  steps: SolutionStep[];
  members: MemberCuts[];
  /** Load resultant about the audit's own reference point, and the audit's figure. */
  loadCheck?: { referencePoint: Vec2; statics: GlobalResultant; solver: GlobalResultant; residual: number };
  /** Largest gaps against the matrix analysis: reactions and N/V/M along every member. */
  reactionResidual: { force: number; moment: number };
  diagramResidual: { force: number; moment: number };
  peakMoment: { memberId: string; s: number; value: number };
}

interface StaticsSectionsRejection {
  applicable: false;
  reasonKey: string;
}

type StaticsSectionsOutcome = StaticsSectionsResult | StaticsSectionsRejection;

/** Relative tolerance against the solver's own numbers, as the method registry requires. */
const MATCH_TOLERANCE = 1e-6;
/** Floor of the relative tolerance on a curved member, which the solver meshes with chords. */
export const ARC_MATCH_TOLERANCE = 1e-3;

/**
 * The solver's polygon for an arc (`prepareCurvedAnalysis`): one chord per π/64 of sweep, at
 * least eight. Returns the chord count, the largest gap δ between a chord and the arc, and the
 * relative tolerance max(1e-3, 2δ/f) with f the rise of the arc over its own chord.
 */
export const arcSolverPolygon = (arc: CircularArcGeometry): { chords: number; sagitta: number; rise: number; tolerance: number } => {
  const chords = Math.max(8, Math.ceil(Math.abs(arc.sweep) / (Math.PI / 64)));
  const sagitta = arc.radius * (1 - Math.cos(Math.abs(arc.sweep) / chords / 2));
  const rise = arc.radius * (1 - Math.cos(Math.abs(arc.sweep) / 2));
  return { chords, sagitta, rise, tolerance: Math.max(ARC_MATCH_TOLERANCE, (2 * sagitta) / Math.max(rise, 1e-12)) };
};

const reject = (reasonKey: string): StaticsSectionsRejection => ({ applicable: false, reasonKey });

const isZero = (value: number, scale: number): boolean => Math.abs(value) <= 1e-12 * Math.max(1, scale);

const momentAbout = (centre: Vec2, at: Vec2, fx: number, fy: number, couple = 0): number =>
  (at.x - centre.x) * fy - (at.y - centre.y) * fx + couple;

/** Reaction components a support contributes, with the sense the diagram assumes for each. */
const unknownsOf = (node: NodeModel): Array<Pick<StaticsUnknown, 'symbol' | 'nodeId' | 'kind' | 'direction'>> => {
  const { support } = node;
  const force = (axis: 'x' | 'y') => ({
    symbol: `R_${axis}(${node.id})`, nodeId: node.id, kind: 'force' as const,
    direction: axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 },
  });
  const moment = { symbol: `M_R(${node.id})`, nodeId: node.id, kind: 'moment' as const, direction: { x: 0, y: 0 } };
  switch (support.type) {
    case 'pin': return [force('x'), force('y')];
    case 'fixed': return [force('x'), force('y'), moment];
    case 'roller': {
      const angle = ((support.angleDeg ?? 90) * Math.PI) / 180;
      const normal = { x: Math.cos(angle), y: Math.sin(angle) };
      // An axis-aligned roller is written as the ordinary component a reader expects; only an
      // inclined one keeps its own normal as the unknown's direction.
      if (Math.abs(normal.y) > 1 - 1e-12) return [force('y')];
      if (Math.abs(normal.x) > 1 - 1e-12) return [force('x')];
      return [{ symbol: `R_n(${node.id})`, nodeId: node.id, kind: 'force', direction: normal }];
    }
    case 'custom': return [
      ...(support.restrainX ? [force('x')] : []),
      ...(support.restrainY ? [force('y')] : []),
      ...(support.restrainR ? [moment] : []),
    ];
    default: return [];
  }
};

const hasSpring = (node: NodeModel): boolean => Object.entries(node.support.spring ?? {})
  .some(([key, value]) => key !== 'angleDeg' && Math.abs(value ?? 0) > 0);

interface MemberGeometry {
  member: MemberModel;
  ni: NodeModel;
  nj: NodeModel;
  length: number;
  c: number;
  s: number;
  /** Circular arc of a curved member; `length` is then the arc length. */
  arc?: CircularArcGeometry;
}

/** A member load in local axes, per unit real length, in the solver's own reading of it. */
type LocalLoad =
  | { kind: 'point'; label: string; at: number; px: number; py: number }
  | { kind: 'couple'; label: string; at: number; moment: number }
  | { kind: 'distributed'; label: string; a: number; b: number; qxA: number; qxB: number; qyA: number; qyB: number };

const toGlobal = (geometry: MemberGeometry, x: number, y: number): Vec2 => ({
  x: geometry.c * x - geometry.s * y,
  y: geometry.s * x + geometry.c * y,
});

const toLocal = (geometry: MemberGeometry, x: number, y: number): Vec2 => ({
  x: geometry.c * x + geometry.s * y,
  y: -geometry.s * x + geometry.c * y,
});

const pointOn = (geometry: MemberGeometry, station: number): Vec2 => ({
  x: geometry.ni.x + geometry.c * station,
  y: geometry.ni.y + geometry.s * station,
});

/** Polynomials of one cut term, in s. Shared by the solve and, through the result, the report. */
export const cutTermPolynomials = (term: CutTerm): { axial: number[]; shear: number[]; moment: number[] } => {
  switch (term.kind) {
    case 'start':
      return { axial: [term.axial], shear: [term.shear], moment: trim([term.moment, term.shear]) };
    case 'point':
      return { axial: [-term.px], shear: [term.py], moment: trim([-term.py * term.at, term.py]) };
    case 'couple':
      return { axial: [0], shear: [0], moment: [-term.moment] };
    case 'partial':
      // u = s − from: N = −(qx u + kx u²/2), V = qy u + ky u²/2, M = qy u²/2 + ky u³/6.
      return {
        axial: shift([0, -term.qx, -term.slopeX / 2], -term.from),
        shear: shift([0, term.qy, term.slopeY / 2], -term.from),
        moment: shift([0, 0, term.qy / 2, term.slopeY / 6], -term.from),
      };
    case 'full': {
      const uniformArm = term.from + term.length / 2;
      const triangleArm = term.from + (2 * term.length) / 3;
      return {
        axial: [-(term.wx + term.wxTriangle)],
        shear: [term.wy + term.wyTriangle],
        moment: trim([-(term.wy * uniformArm + term.wyTriangle * triangleArm), term.wy + term.wyTriangle]),
      };
    }
  }
};

/** Real roots of a polynomial of degree ≤ 2 strictly inside (0, h). */
const rootsInside = (polynomial: readonly number[], h: number): number[] => {
  const [c0 = 0, c1 = 0, c2 = 0] = polynomial;
  const scale = Math.max(Math.abs(c0), Math.abs(c1) * h, Math.abs(c2) * h * h, 1e-300);
  const margin = h * 1e-9;
  const inside = (u: number) => u > margin && u < h - margin;
  if (Math.abs(c2) * h * h <= 1e-12 * scale) {
    if (Math.abs(c1) * h <= 1e-12 * scale) return [];
    return [-c0 / c1].filter(inside);
  }
  const discriminant = c1 * c1 - 4 * c2 * c0;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant);
  const q = -0.5 * (c1 + Math.sign(c1 || 1) * root);
  const roots = [q / c2, ...(q !== 0 ? [c0 / q] : [])];
  return [...new Set(roots.filter(inside).map((u) => Number(u.toPrecision(15))))].sort((a, b) => a - b);
};

/** Connected nodes reachable from `start` without crossing `excludedMemberId`. */
const componentFrom = (
  start: string,
  excludedMemberId: string,
  members: readonly MemberModel[],
): Set<string> => {
  const reached = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const current = stack.pop()!;
    for (const member of members) {
      if (member.id === excludedMemberId) continue;
      const other = member.i === current ? member.j : member.j === current ? member.i : undefined;
      if (other !== undefined && !reached.has(other)) {
        reached.add(other);
        stack.push(other);
      }
    }
  }
  return reached;
};

/** Stations of the table: every twelfth of the arc. */
const TABLE_STATIONS = 12;
/** Stations checked against the solver, and sampled for the peak moment. */
const CHECK_STATIONS = 48;
const PEAK_SAMPLES = 192;

/**
 * The cuts of one arc, station by station, each checked against the solver's diagram at the same
 * arc length. Returns `undefined` when they do not land on it within the polygon's tolerance.
 */
const cutArc = (
  arc: CircularArcGeometry,
  loads: readonly ArcLoad[],
  start: MemberStartForces,
  analysis: AnalysisResult,
  memberId: string,
  forceScale: number,
  momentScale: number,
): { cuts: ArcMemberCuts; peak: { s: number; value: number } } | undefined => {
  const result = analysis.memberResults.find((entry) => entry.memberId === memberId);
  if (!result || !result.diagramSegments.length || (result.startOffset ?? 0) !== 0) return undefined;
  const side = { fx: start.fx, fy: start.fy, moment: start.moment };
  const solverAt = (s: number): StretchValues | undefined => {
    const segment = result.diagramSegments.find((entry) => s >= entry.x0 && s <= entry.x1)
      ?? (s <= result.diagramSegments[0]!.x0 ? result.diagramSegments[0] : result.diagramSegments[result.diagramSegments.length - 1]);
    if (!segment) return undefined;
    const value = evaluateSegment(segment, s);
    return { axial: value.axial, shear: value.shear, moment: value.moment };
  };
  const station = (t: number): ArcStation | undefined => {
    const cut = arcCutAt(arc, loads, side, t);
    const solver = solverAt(cut.s);
    return solver ? { ...cut, solver } : undefined;
  };
  const polygon = arcSolverPolygon(arc);
  let force = 0;
  let moment = 0;
  for (let k = 0; k <= CHECK_STATIONS; k += 1) {
    const t = k / CHECK_STATIONS;
    // A concentrated action is a jump: the solver's diagram there could be either side of it.
    if (nearConcentrated(loads, t)) continue;
    const entry = station(t);
    if (!entry) return undefined;
    force = Math.max(force, Math.abs(entry.axial - entry.solver.axial), Math.abs(entry.shear - entry.solver.shear));
    moment = Math.max(moment, Math.abs(entry.moment - entry.solver.moment));
  }
  if (force > polygon.tolerance * forceScale || moment > polygon.tolerance * momentScale) return undefined;

  const stations: ArcStation[] = [];
  for (let k = 0; k <= TABLE_STATIONS; k += 1) {
    const entry = station(k / TABLE_STATIONS);
    if (!entry) return undefined;
    stations.push(entry);
  }
  // Peak |M|: sampled, then refined by golden section between the neighbours of the best sample.
  const magnitude = (t: number) => Math.abs(arcCutAt(arc, loads, side, t).moment);
  let best = 0;
  for (let k = 1; k <= PEAK_SAMPLES; k += 1) if (magnitude(k / PEAK_SAMPLES) > magnitude(best / PEAK_SAMPLES)) best = k;
  let low = Math.max(0, (best - 1) / PEAK_SAMPLES);
  let high = Math.min(1, (best + 1) / PEAK_SAMPLES);
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const a = high - ratio * (high - low);
    const b = low + ratio * (high - low);
    if (magnitude(a) >= magnitude(b)) high = b;
    else low = a;
  }
  const candidates = [best / PEAK_SAMPLES, (low + high) / 2];
  const peakT = candidates.reduce((winner, t) => (magnitude(t) > magnitude(winner) ? t : winner), candidates[0]!);
  const worked = station(peakT);
  if (!worked) return undefined;
  return {
    cuts: {
      geometry: arc, loads: [...loads], stations, worked,
      solverChords: polygon.chords, chordSagitta: polygon.sagitta, tolerance: polygon.tolerance,
      residual: { force, moment },
    },
    peak: { s: worked.s, value: worked.moment },
  };
};

export const solveStaticsSections = (
  rawProject: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): StaticsSectionsOutcome => {
  const classification = classifyStructure(rawProject);
  if (classification.kind !== 'simple-beam' && classification.kind !== 'continuous-beam' && classification.kind !== 'frame') {
    return reject('method.rejectedStaticsKind');
  }
  if (classification.indeterminacy !== 0) return reject('method.rejectedIndeterminateStatics');
  if (rawProject.settings.analysisMode === 'p-delta' || analysis.pDelta) return reject('method.rejectedStaticsSecondOrder');
  if (!analysis.success || !analysis.nodeResults.length || !analysis.memberResults.length) return reject('method.rejectedStaticsAnalysis');

  // The same projection the solver analyses: generated sources become ordinary member loads.
  if ((rawProject.generatedLoadSources ?? []).some((source) => source.kind === 'elastic-foundation')) {
    return reject('method.rejectedStaticsSupports');
  }
  const project = withResolvedGeneratedLoads(rawProject);
  const factors = selectedFactors(project, combination);
  const active = (caseId: string) => (factors[caseId] ?? 0) !== 0;

  // ---- Scope -----------------------------------------------------------------------------
  if ((project.nodeLinks ?? []).length || (project.multiPointConstraints ?? []).length) return reject('method.rejectedStaticsSupports');
  if (project.nodes.some(hasSpring)) return reject('method.rejectedStaticsSupports');
  if ((project.prescribedDisplacements ?? []).some((entry) => active(entry.caseId))) return reject('method.rejectedStaticsSupports');
  if (project.nodes.some((node) => Object.values(node.support.prescribed ?? {}).some((value) => Math.abs(value ?? 0) > 0))) {
    return reject('method.rejectedStaticsSupports');
  }
  for (const member of project.members) {
    if (member.type !== 'frame') return reject('method.rejectedStaticsMembers');
    if ((member.rigidOffsetI ?? 0) !== 0 || (member.rigidOffsetJ ?? 0) !== 0) return reject('method.rejectedStaticsMembers');
    if (member.rotationalSpringI !== undefined || member.rotationalSpringJ !== undefined) return reject('method.rejectedStaticsSupports');
    if ((member.axialBehavior ?? 'both') !== 'both') return reject('method.rejectedStaticsMembers');
    const releases = member.releases;
    if (releases?.iAxial || releases?.iShear || releases?.jAxial || releases?.jShear) return reject('method.rejectedStaticsMembers');
  }

  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const geometryById = new Map<string, MemberGeometry>();
  for (const member of project.members) {
    const ni = nodeById.get(member.i);
    const nj = nodeById.get(member.j);
    if (!ni || !nj || member.i === member.j) return reject('method.rejectedStaticsMembers');
    const length = Math.hypot(nj.x - ni.x, nj.y - ni.y);
    if (!(length > 0)) return reject('method.rejectedStaticsMembers');
    const arc = member.curve ? memberArc(member, nodeById) : undefined;
    if (member.curve && !arc) return reject('method.rejectedStaticsMembers');
    geometryById.set(member.id, {
      member, ni, nj, length: arc ? arc.length : length, c: (nj.x - ni.x) / length, s: (nj.y - ni.y) / length,
      ...(arc ? { arc } : {}),
    });
  }
  // On an arc the solver answers for its polygon of chords: the check admits the polygon's gap.
  const tolerance = Math.max(MATCH_TOLERANCE, ...[...geometryById.values()].map((geometry) => (
    geometry.arc ? arcSolverPolygon(geometry.arc).tolerance : MATCH_TOLERANCE
  )));

  // Cuts only isolate a side when the members form a tree: one connected piece, no closed ring.
  const structural = new Set(project.members.flatMap((member) => [member.i, member.j]));
  for (const node of project.nodes) {
    if (structural.has(node.id)) continue;
    const loaded = project.nodalLoads.some((load) => load.nodeId === node.id && active(load.caseId));
    if (node.support.type !== 'none' || loaded) return reject('method.rejectedStaticsMembers');
  }
  const [firstStructural] = structural;
  if (firstStructural === undefined) return reject('method.rejectedStaticsMembers');
  if (project.members.length !== structural.size - 1 || componentFrom(firstStructural, '', project.members).size !== structural.size) {
    return reject('method.rejectedClosedLoop');
  }

  // ---- Unknowns ----------------------------------------------------------------------------
  const solverByNode = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry]));
  const draftUnknowns = project.nodes.filter((node) => structural.has(node.id)).flatMap(unknownsOf);
  if (!draftUnknowns.length) return reject('method.rejectedStaticsSystem');

  // ---- Load resultants, from the project data ------------------------------------------------
  const resultants: LoadResultant[] = [];
  const localLoads = new Map<string, LocalLoad[]>(project.members.map((member) => [member.id, []]));
  let forceCount = 0;
  let coupleCount = 0;
  const pushResultant = (entry: Omit<LoadResultant, 'label'>) => {
    const label = entry.kind === 'couple' ? `C${++coupleCount}` : `F${++forceCount}`;
    resultants.push({ ...entry, label });
  };

  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    const node = nodeById.get(load.nodeId);
    if (!factor || !node) continue;
    if (load.fx !== 0 || load.fy !== 0) {
      pushResultant({ sourceId: load.id, kind: 'nodal', nodeId: node.id, fx: load.fx * factor, fy: load.fy * factor, couple: 0, at: { x: node.x, y: node.y }, factor });
    }
    if (load.mz !== 0) {
      pushResultant({ sourceId: load.id, kind: 'couple', nodeId: node.id, fx: 0, fy: 0, couple: load.mz * factor, at: { x: node.x, y: node.y }, factor });
    }
  }

  for (const load of project.memberLoads) {
    const factor = factors[load.caseId] ?? 0;
    const geometry = geometryById.get(load.memberId);
    if (!factor || !geometry || geometry.arc) continue;
    const { length } = geometry;
    const loads = localLoads.get(load.memberId)!;
    const vector = (x: number, y: number): { local: Vec2; global: Vec2 } => load.coordinateSystem === 'local'
      ? { local: { x, y }, global: toGlobal(geometry, x, y) }
      : { local: toLocal(geometry, x, y), global: { x, y } };
    if (load.type === 'point') {
      const station = Math.min(1, Math.max(0, load.position ?? 0.5)) * length;
      const { local, global } = vector((load.px ?? 0) * factor, (load.py ?? 0) * factor);
      loads.push({ kind: 'point', label: load.id, at: station, px: local.x, py: local.y });
      if (global.x !== 0 || global.y !== 0) {
        pushResultant({ sourceId: load.id, kind: 'point', memberId: load.memberId, fx: global.x, fy: global.y, couple: 0, at: pointOn(geometry, station), station, factor });
      }
      continue;
    }
    if (load.type === 'moment') {
      const station = Math.min(1, Math.max(0, load.position ?? 0.5)) * length;
      const moment = (load.moment ?? 0) * factor;
      loads.push({ kind: 'couple', label: load.id, at: station, moment });
      if (moment !== 0) {
        pushResultant({ sourceId: load.id, kind: 'couple', memberId: load.memberId, fx: 0, fy: 0, couple: moment, at: pointOn(geometry, station), station, factor });
      }
      continue;
    }
    const basisScale = load.lengthBasis === 'horizontal' ? Math.abs(geometry.c) : load.lengthBasis === 'vertical' ? Math.abs(geometry.s) : 1;
    const a = Math.min(load.start, load.end) * length;
    const b = Math.max(load.start, load.end) * length;
    const start = vector((load.qxStart ?? 0) * factor, (load.qyStart ?? 0) * factor);
    const end = vector((load.qxEnd ?? load.qxStart ?? 0) * factor, (load.qyEnd ?? load.qyStart ?? 0) * factor);
    const span = b - a;
    if (!(span > 0)) continue;
    loads.push({
      kind: 'distributed', label: load.id, a, b,
      qxA: start.local.x * basisScale, qxB: end.local.x * basisScale,
      qyA: start.local.y * basisScale, qyB: end.local.y * basisScale,
    });
    // Textbook decomposition: a uniform block of the start intensity, plus a triangle of the
    // difference. Each has a well-defined resultant and centroid even when the trapezoid's
    // total resultant would vanish.
    const basisLength = span * basisScale;
    const uniform = { x: start.global.x * basisLength, y: start.global.y * basisLength };
    if (uniform.x !== 0 || uniform.y !== 0) {
      pushResultant({
        sourceId: load.id, kind: 'uniform', memberId: load.memberId, fx: uniform.x, fy: uniform.y, couple: 0,
        at: pointOn(geometry, a + span / 2), station: a + span / 2, factor,
        intensity: Math.hypot(start.global.x, start.global.y), basisLength, basis: load.lengthBasis, loadStart: a, loadLength: span,
      });
    }
    const delta = { x: end.global.x - start.global.x, y: end.global.y - start.global.y };
    if (delta.x !== 0 || delta.y !== 0) {
      pushResultant({
        sourceId: load.id, kind: 'triangular', memberId: load.memberId,
        fx: delta.x * basisLength / 2, fy: delta.y * basisLength / 2, couple: 0,
        at: pointOn(geometry, a + (2 * span) / 3), station: a + (2 * span) / 3, factor,
        intensity: Math.hypot(delta.x, delta.y), basisLength, basis: load.lengthBasis, loadStart: a, loadLength: span,
      });
    }
  }

  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0) {
    for (const geometry of geometryById.values()) {
      const { member, length } = geometry;
      if (geometry.arc || !member.density || !(member.A > 0)) continue;
      const weight = (member.density * 9.80665 * member.A) / 1000 * selfWeightFactor;
      const local = toLocal(geometry, 0, -weight);
      localLoads.get(member.id)!.push({ kind: 'distributed', label: 'peso propio', a: 0, b: length, qxA: local.x, qxB: local.x, qyA: local.y, qyB: local.y });
      pushResultant({
        sourceId: 'peso propio', kind: 'self-weight', memberId: member.id, fx: 0, fy: -weight * length, couple: 0,
        at: pointOn(geometry, length / 2), station: length / 2, factor: selfWeightFactor,
        intensity: Math.abs(weight), basisLength: length, basis: 'real', loadStart: 0, loadLength: length,
      });
    }
  }

  // Curved members: every load reduced on the arc itself, in the solver's own reading of it.
  const arcLoads = new Map<string, ArcLoad[]>();
  for (const geometry of geometryById.values()) {
    const { arc, member } = geometry;
    if (!arc) continue;
    const loads = arcLoadsOf(project, member, arc, factors);
    arcLoads.set(member.id, loads);
    for (const load of loads) {
      const factor = load.factor ?? 1;
      if (load.kind === 'point') {
        if (load.fx !== 0 || load.fy !== 0) {
          pushResultant({ sourceId: load.label, kind: 'point', memberId: member.id, fx: load.fx, fy: load.fy, couple: 0, at: arcPoint(arc, load.t), station: load.t * arc.length, factor });
        }
        continue;
      }
      if (load.kind === 'couple') {
        if (load.moment !== 0) {
          pushResultant({ sourceId: load.label, kind: 'couple', memberId: member.id, fx: 0, fy: 0, couple: load.moment, at: arcPoint(arc, load.t), station: load.t * arc.length, factor });
        }
        continue;
      }
      const origin = { x: geometry.ni.x, y: geometry.ni.y };
      const total = arcLoadsTotal(arc, [load], origin);
      const centroid = distributedCentroid(arc, load, 0, 1);
      const at = centroid ? lineOfActionPoint(total, origin, centroid) : undefined;
      const arcSpan = { from: load.t0 * arc.length, length: (load.t1 - load.t0) * arc.length };
      if (!at) {
        // A distributed load whose forces cancel still turns the structure: a couple.
        if (Math.abs(total.moment) > 0) {
          pushResultant({ sourceId: load.label, kind: 'couple', memberId: member.id, fx: 0, fy: 0, couple: total.moment, at: origin, factor, arcSpan });
        }
        continue;
      }
      pushResultant({
        sourceId: load.label, kind: load.label === 'peso propio' ? 'self-weight' : 'arc', memberId: member.id,
        fx: total.fx, fy: total.fy, couple: 0, at, factor, basis: load.basis, arcSpan,
        ...(isUniformGlobal(load) ? { intensity: Math.hypot(load.qxA, load.qyA), basisLength: arcBasisLength(arc, load.basis, load.t0, load.t1) } : {}),
      });
    }
  }

  const xs = project.nodes.map((node) => node.x);
  const ys = project.nodes.map((node) => node.y);
  const extent = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const loadActivity = resultants.reduce((sum, entry) => sum + Math.abs(entry.fx) + Math.abs(entry.fy) + Math.abs(entry.couple) / extent, 0);

  // ---- The independent load audit: our resultants against the solver's own integration ------
  let loadCheck: StaticsSectionsResult['loadCheck'];
  const audit = analysis.loadAudit;
  if (audit) {
    const reference = audit.referencePoint ?? (() => {
      const node = audit.referenceNodeId ? nodeById.get(audit.referenceNodeId) : undefined;
      return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
    })();
    const statics = resultants.reduce<GlobalResultant>((sum, entry) => ({
      fx: sum.fx + entry.fx,
      fy: sum.fy + entry.fy,
      mz: sum.mz + momentAbout(reference, entry.at, entry.fx, entry.fy, entry.couple),
    }), { fx: 0, fy: 0, mz: 0 });
    const residual = Math.max(
      Math.abs(statics.fx - audit.source.fx),
      Math.abs(statics.fy - audit.source.fy),
      Math.abs(statics.mz - audit.source.mz) / extent,
    ) / Math.max(1, loadActivity);
    if (residual > tolerance) return reject('method.rejectedStaticsMismatch');
    loadCheck = { referencePoint: reference, statics, solver: { ...audit.source }, residual };
  }

  // ---- Equations ----------------------------------------------------------------------------
  const unknownCount = draftUnknowns.length;
  const nodeOf = (unknown: { nodeId: string }) => nodeById.get(unknown.nodeId)!;

  const buildEquation = (
    kind: EquilibriumEquation['kind'],
    nodeIds: readonly string[],
    memberIds: readonly string[],
    centre?: NodeModel,
    release?: EquilibriumEquation['release'],
  ): EquilibriumEquation => {
    const nodes = new Set(nodeIds);
    const members = new Set(memberIds);
    const coefficients = new Array<number>(unknownCount).fill(0);
    const unknownTerms: EquationTerm[] = [];
    draftUnknowns.forEach((unknown, index) => {
      if (!nodes.has(unknown.nodeId)) return;
      const at = nodeOf(unknown);
      let value: number;
      if (kind === 'fx') value = unknown.kind === 'force' ? unknown.direction.x : 0;
      else if (kind === 'fy') value = unknown.kind === 'force' ? unknown.direction.y : 0;
      else value = unknown.kind === 'moment' ? 1 : momentAbout(centre!, at, unknown.direction.x, unknown.direction.y);
      if (isZero(value, 1)) return;
      coefficients[index] = value;
      unknownTerms.push({
        unknown: index, value,
        ...(centre ? { dx: at.x - centre.x, dy: at.y - centre.y } : {}),
        fx: unknown.direction.x, fy: unknown.direction.y, couple: unknown.kind === 'moment' ? 1 : 0,
      });
    });
    const knownTerms: EquationTerm[] = [];
    for (const entry of resultants) {
      const onSide = entry.memberId !== undefined ? members.has(entry.memberId) : nodes.has(entry.nodeId ?? '');
      if (!onSide) continue;
      const value = kind === 'fx' ? entry.fx : kind === 'fy' ? entry.fy : momentAbout(centre!, entry.at, entry.fx, entry.fy, entry.couple);
      if (value === 0) continue;
      knownTerms.push({
        resultant: entry.label, value,
        ...(centre ? { dx: entry.at.x - centre.x, dy: entry.at.y - centre.y } : {}),
        fx: entry.fx, fy: entry.fy, couple: entry.couple,
      });
    }
    return {
      kind, ...(centre ? { centreNodeId: centre.id } : {}), nodeIds: [...nodeIds], memberIds: [...memberIds],
      ...(release ? { release } : {}), coefficients, unknownTerms, knownTerms,
      constant: knownTerms.reduce((sum, term) => sum + term.value, 0), independent: false,
    };
  };

  const allNodeIds = project.nodes.filter((node) => structural.has(node.id)).map((node) => node.id);
  const allMemberIds = project.members.map((member) => member.id);
  // Moments about the support with the most unknown forces: they drop out of the sum, which is
  // exactly why a student takes moments there.
  const forceCountAt = (nodeId: string) => draftUnknowns.filter((unknown) => unknown.nodeId === nodeId && unknown.kind === 'force').length;
  const centreId = allNodeIds.reduce((best, nodeId) => forceCountAt(nodeId) > forceCountAt(best) ? nodeId : best, allNodeIds[0]!);
  const equations: EquilibriumEquation[] = [
    buildEquation('fx', allNodeIds, allMemberIds),
    buildEquation('fy', allNodeIds, allMemberIds),
    buildEquation('moment', allNodeIds, allMemberIds, nodeById.get(centreId)),
  ];

  // One ΣM = 0 per released member end, written for the side with fewer unknowns. At a hinge
  // where n members meet that is n equations, the moment at the hinge end of each member about
  // the hinge, but only n − 1 of them are independent: together they add up to the node's own
  // ΣM = 0, already implied by the global sums. The greedy choice below keeps n − 1 and the
  // last one stays as a check, exactly as `classifyStructure` counts n − 1 conditions there.
  for (const member of project.members) {
    for (const end of ['i', 'j'] as const) {
      const nodeId = end === 'i' ? member.i : member.j;
      const released = end === 'i' ? member.releases?.iMoment : member.releases?.jMoment;
      if (!released && !nodeById.get(nodeId)?.internalHinge) continue;
      const near = componentFrom(nodeId, member.id, project.members);
      const nearNodes = allNodeIds.filter((id) => near.has(id));
      const farNodes = allNodeIds.filter((id) => !near.has(id));
      const nearMembers = project.members.filter((entry) => entry.id !== member.id && near.has(entry.i)).map((entry) => entry.id);
      const farMembers = project.members.filter((entry) => entry.id === member.id || !near.has(entry.i)).map((entry) => entry.id);
      const unknownsOn = (ids: readonly string[]) => draftUnknowns.filter((unknown) => ids.includes(unknown.nodeId)).length;
      const leftmost = (ids: readonly string[]) => Math.min(...ids.map((id) => nodeById.get(id)!.x));
      const nearFirst = unknownsOn(nearNodes) !== unknownsOn(farNodes)
        ? unknownsOn(nearNodes) < unknownsOn(farNodes)
        : nearNodes.length !== farNodes.length ? nearNodes.length < farNodes.length : leftmost(nearNodes) <= leftmost(farNodes);
      equations.push(buildEquation(
        'hinge',
        nearFirst ? nearNodes : farNodes,
        nearFirst ? nearMembers : farMembers,
        nodeById.get(nodeId),
        { memberId: member.id, nodeId },
      ));
    }
  }

  // Greedy choice of independent rows: the three global sums first, then the hinges.
  const basis: number[][] = [];
  for (const equation of equations) {
    const norm = Math.hypot(...equation.coefficients);
    if (!(norm > 0)) continue;
    let residual = equation.coefficients.map((value) => value / norm);
    for (const vector of basis) {
      const projection = residual.reduce((sum, value, index) => sum + value * vector[index]!, 0);
      residual = residual.map((value, index) => value - projection * vector[index]!);
    }
    const remaining = Math.hypot(...residual);
    if (remaining <= 1e-9) continue;
    basis.push(residual.map((value) => value / remaining));
    equation.independent = true;
  }
  const chosen = equations.filter((equation) => equation.independent);
  if (chosen.length < unknownCount) return reject('method.rejectedIndeterminateStatics');

  let values: number[];
  try {
    values = solveLinearSystem(chosen.map((equation) => [...equation.coefficients]), chosen.map((equation) => -equation.constant)).x;
  } catch {
    return reject('method.rejectedStaticsSystem');
  }
  if (values.some((value) => !Number.isFinite(value))) return reject('method.rejectedStaticsSystem');

  // Every equation — including the dependent ones not used to solve — has to close.
  for (const equation of equations) {
    const terms = equation.coefficients.map((coefficient, index) => coefficient * values[index]!);
    const total = terms.reduce((sum, value) => sum + value, 0) + equation.constant;
    const activity = terms.reduce((sum, value) => sum + Math.abs(value), 0)
      + equation.knownTerms.reduce((sum, term) => sum + Math.abs(term.value), 0);
    const scale = equation.kind === 'fx' || equation.kind === 'fy' ? Math.max(1, activity) : Math.max(extent, activity);
    if (Math.abs(total) > 1e-8 * scale) return reject('method.rejectedStaticsSystem');
  }

  const unknowns: StaticsUnknown[] = draftUnknowns.map((unknown, index) => {
    const solver = solverByNode.get(unknown.nodeId);
    const solverValue = !solver
      ? Number.NaN
      : unknown.kind === 'moment'
        ? solver.rm
        : solver.rx * unknown.direction.x + solver.ry * unknown.direction.y;
    return { ...unknown, value: values[index]!, solverValue };
  });

  // The reactions have to be the matrix analysis's own, component by component in global axes.
  const reactionScale = Math.max(1, loadActivity, ...unknowns.filter((unknown) => unknown.kind === 'force').map((unknown) => Math.abs(unknown.value)));
  let reactionForceResidual = 0;
  let reactionMomentResidual = 0;
  for (const nodeId of new Set(unknowns.map((unknown) => unknown.nodeId))) {
    const solver = solverByNode.get(nodeId);
    if (!solver) return reject('method.rejectedStaticsMismatch');
    const own = unknowns.filter((unknown) => unknown.nodeId === nodeId);
    const rx = own.reduce((sum, unknown) => sum + unknown.direction.x * unknown.value, 0);
    const ry = own.reduce((sum, unknown) => sum + unknown.direction.y * unknown.value, 0);
    const rm = own.filter((unknown) => unknown.kind === 'moment').reduce((sum, unknown) => sum + unknown.value, 0);
    reactionForceResidual = Math.max(reactionForceResidual, Math.abs(rx - solver.rx), Math.abs(ry - solver.ry));
    // A support that restrains no rotation reports none.
    if (own.some((unknown) => unknown.kind === 'moment')) reactionMomentResidual = Math.max(reactionMomentResidual, Math.abs(rm - solver.rm));
  }
  if (reactionForceResidual > tolerance * reactionScale || reactionMomentResidual > tolerance * reactionScale * extent) {
    return reject('method.rejectedStaticsMismatch');
  }

  // Solve order: one unknown at a time while some chosen equation has a single one left.
  const steps: SolutionStep[] = [];
  const known = new Set<number>();
  const pending = new Set(chosen.map((equation) => equations.indexOf(equation)));
  const open = (index: number) => equations[index]!.coefficients
    .map((coefficient, unknown) => ({ coefficient, unknown }))
    .filter(({ coefficient, unknown }) => coefficient !== 0 && !known.has(unknown))
    .map(({ unknown }) => unknown);
  while (pending.size && known.size < unknownCount) {
    const next = [...pending].find((index) => open(index).length === 1);
    if (next === undefined) {
      const block = [...pending];
      const remaining = Array.from({ length: unknownCount }, (_, index) => index).filter((index) => !known.has(index));
      steps.push({ equation: block[0]!, unknowns: remaining, equations: block });
      remaining.forEach((index) => known.add(index));
      break;
    }
    const [unknown] = open(next);
    steps.push({ equation: next, unknowns: [unknown!], equations: [next] });
    known.add(unknown!);
    pending.delete(next);
  }

  // ---- Cuts along every member ----------------------------------------------------------------
  const valueOf = (unknown: StaticsUnknown) => unknown.value;
  let diagramForceResidual = 0;
  let diagramMomentResidual = 0;
  const forceScale = Math.max(1, loadActivity, ...unknowns.map((unknown) => Math.abs(valueOf(unknown)) / (unknown.kind === 'moment' ? extent : 1)));
  const momentScale = forceScale * extent;
  const members: MemberCuts[] = [];

  for (const member of project.members) {
    const geometry = geometryById.get(member.id)!;
    const { length } = geometry;
    const side = componentFrom(member.i, member.id, project.members);
    const sideNodeIds = allNodeIds.filter((id) => side.has(id));
    const sideMemberIds = project.members.filter((entry) => entry.id !== member.id && side.has(entry.i)).map((entry) => entry.id);
    const sideMembers = new Set(sideMemberIds);
    const origin = { x: geometry.ni.x, y: geometry.ni.y };

    const actions: SideAction[] = [];
    for (const unknown of unknowns) {
      if (!side.has(unknown.nodeId)) continue;
      const at = nodeOf(unknown);
      actions.push({
        label: unknown.symbol,
        fx: unknown.kind === 'force' ? unknown.direction.x * unknown.value : 0,
        fy: unknown.kind === 'force' ? unknown.direction.y * unknown.value : 0,
        couple: unknown.kind === 'moment' ? unknown.value : 0,
        at: { x: at.x, y: at.y },
      });
    }
    for (const entry of resultants) {
      const onSide = entry.memberId !== undefined ? sideMembers.has(entry.memberId) : side.has(entry.nodeId ?? '');
      if (onSide) actions.push({ label: entry.label, fx: entry.fx, fy: entry.fy, couple: entry.couple, at: entry.at });
    }
    const fx = actions.reduce((sum, action) => sum + action.fx, 0);
    const fy = actions.reduce((sum, action) => sum + action.fy, 0);
    const moment = actions.reduce((sum, action) => sum + momentAbout(origin, action.at, action.fx, action.fy, action.couple), 0);
    // Along the member axis at node i: the chord of a straight member, the tangent of an arc.
    const axis = geometry.arc ? arcTangent(geometry.arc, 0) : { x: geometry.c, y: geometry.s };
    const start: MemberStartForces = {
      nodeIds: sideNodeIds, memberIds: sideMemberIds, actions, fx, fy, moment,
      axial: -(fx * axis.x + fy * axis.y),
      shear: -fx * axis.y + fy * axis.x,
      bending: -moment,
    };

    if (geometry.arc) {
      const outcome = cutArc(geometry.arc, arcLoads.get(member.id) ?? [], start, analysis, member.id, forceScale, momentScale);
      if (!outcome) return reject('method.rejectedStaticsMismatch');
      members.push({
        memberId: member.id, startNodeId: member.i, endNodeId: member.j, length: geometry.arc.length, c: axis.x, s: axis.y,
        start, stretches: [], arc: outcome.cuts, peakMoment: outcome.peak,
      });
      continue;
    }

    const loads = localLoads.get(member.id)!;
    const tolerance = length * 1e-9;
    // Where the expression changes: the ends, and every edge of a load. Both ends are kept
    // exactly; an interior edge closer than the tolerance to one of them, or to another edge,
    // is the same section.
    const interior = loads.flatMap((load) => load.kind === 'distributed' ? [load.a, load.b] : [load.at])
      .filter((value) => value > tolerance && value < length - tolerance)
      .sort((a, b) => a - b);
    const breakpoints = [0];
    for (const value of [...interior, length]) {
      if (value - breakpoints[breakpoints.length - 1]! > tolerance) breakpoints.push(value);
    }
    breakpoints[breakpoints.length - 1] = length;

    const result = analysis.memberResults.find((entry) => entry.memberId === member.id);
    if (!result || !result.diagramSegments.length || (result.startOffset ?? 0) !== 0) return reject('method.rejectedStaticsMismatch');
    const solverAt = (station: number) => {
      const segment = result.diagramSegments.find((entry) => station > entry.x0 && station < entry.x1)
        ?? result.diagramSegments.find((entry) => station >= entry.x0 - tolerance && station <= entry.x1 + tolerance);
      return segment ? evaluateSegment(segment, station) : undefined;
    };

    const stretches: CutStretch[] = [];
    let peak = { s: 0, value: 0 };
    for (let index = 0; index < breakpoints.length - 1; index += 1) {
      const s0 = breakpoints[index]!;
      const s1 = breakpoints[index + 1]!;
      const terms: CutTerm[] = [{ kind: 'start', axial: start.axial, shear: start.shear, moment: start.bending }];
      for (const load of loads) {
        if (load.kind === 'point') {
          if (load.at <= s0 + tolerance && (load.px !== 0 || load.py !== 0)) terms.push({ kind: 'point', label: load.label, at: load.at, px: load.px, py: load.py });
        } else if (load.kind === 'couple') {
          if (load.at <= s0 + tolerance && load.moment !== 0) terms.push({ kind: 'couple', label: load.label, at: load.at, moment: load.moment });
        } else if (load.a <= s0 + tolerance) {
          const span = load.b - load.a;
          const slopeX = (load.qxB - load.qxA) / span;
          const slopeY = (load.qyB - load.qyA) / span;
          if (load.qxA === 0 && load.qxB === 0 && load.qyA === 0 && load.qyB === 0) continue;
          if (load.b <= s0 + tolerance) {
            terms.push({
              kind: 'full', label: load.label, from: load.a, length: span,
              wx: load.qxA * span, wy: load.qyA * span,
              wxTriangle: (load.qxB - load.qxA) * span / 2, wyTriangle: (load.qyB - load.qyA) * span / 2,
            });
          } else {
            terms.push({ kind: 'partial', label: load.label, from: load.a, qx: load.qxA, qy: load.qyA, slopeX, slopeY });
          }
        }
      }
      let axial: number[] = [0];
      let shear: number[] = [0];
      let moment: number[] = [0];
      for (const term of terms) {
        const polynomials = cutTermPolynomials(term);
        axial = add(axial, polynomials.axial);
        shear = add(shear, polynomials.shear);
        moment = add(moment, polynomials.moment);
      }
      const at = (station: number): StretchValues => ({ axial: evaluate(axial, station), shear: evaluate(shear, station), moment: evaluate(moment, station) });
      const h = s1 - s0;
      const shearZeros = rootsInside(shift(shear, s0), h).map((u) => ({ s: s0 + u, moment: evaluate(moment, s0 + u) }));
      const stretch: CutStretch = { s0, s1, terms, axial, shear, moment, start: at(s0), end: at(s1), shearZeros };
      stretches.push(stretch);
      for (const candidate of [{ s: s0, value: stretch.start.moment }, { s: s1, value: stretch.end.moment }, ...shearZeros.map((zero) => ({ s: zero.s, value: zero.moment }))]) {
        if (Math.abs(candidate.value) > Math.abs(peak.value)) peak = candidate;
      }

      // The cut has to land on the solver's own exact diagram, inside every stretch.
      for (const ratio of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const station = s0 + h * ratio;
        const solver = solverAt(station);
        if (!solver) return reject('method.rejectedStaticsMismatch');
        const mine = at(station);
        diagramForceResidual = Math.max(diagramForceResidual, Math.abs(mine.axial - solver.axial), Math.abs(mine.shear - solver.shear));
        diagramMomentResidual = Math.max(diagramMomentResidual, Math.abs(mine.moment - solver.moment));
      }
    }
    members.push({
      memberId: member.id, startNodeId: member.i, endNodeId: member.j, length, c: geometry.c, s: geometry.s,
      start, stretches, peakMoment: peak,
    });
  }
  // Without arcs `tolerance` is the strict one; with them, the straight members inherit the arcs' reactions.
  if (diagramForceResidual > tolerance * forceScale || diagramMomentResidual > tolerance * momentScale) {
    return reject('method.rejectedStaticsMismatch');
  }
  for (const entry of members) {
    if (!entry.arc) continue;
    diagramForceResidual = Math.max(diagramForceResidual, entry.arc.residual.force);
    diagramMomentResidual = Math.max(diagramMomentResidual, entry.arc.residual.moment);
  }

  const governing = members.reduce(
    (best, entry) => Math.abs(entry.peakMoment.value) > Math.abs(best.value) ? { memberId: entry.memberId, ...entry.peakMoment } : best,
    { memberId: members[0]!.memberId, ...members[0]!.peakMoment },
  );

  return {
    applicable: true,
    classification,
    unknowns,
    resultants,
    equations,
    steps,
    members,
    ...(loadCheck ? { loadCheck } : {}),
    reactionResidual: { force: reactionForceResidual, moment: reactionMomentResidual },
    diagramResidual: { force: diagramForceResidual, moment: diagramMomentResidual },
    peakMoment: governing,
  };
};
