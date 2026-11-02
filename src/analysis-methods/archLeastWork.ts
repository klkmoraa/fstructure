/**
 * Trabajo mínimo (Castigliano) en arcos circulares, resuelto de verdad.
 *
 * Un arco circular nativo entre dos apoyos, hiperestático: biarticulado (una incógnita, el
 * empuje H), empotrado en los dos extremos (tres) o empotrado en uno y apoyado en el otro. El
 * camino es el del libro:
 *
 *  1. Estructura liberada isostática. Biarticulado: el apoyo B se vuelve un rodillo vertical y
 *     la redundante es su reacción horizontal, el empuje H. Con un extremo empotrado: el otro se
 *     suelta del todo (voladizo curvo) y sus componentes de reacción son las redundantes X_k.
 *  2. Por estática en la liberada (`arcStatics.ts`): M₀, N₀ y V₀ de las cargas a lo largo del
 *     arco, y m_k, n_k, v_k de cada redundante unitaria.
 *  3. La energía de deformación del arco delgado sin cortante, U = ∫M²/2EI ds + ∫N²/2EA ds, es
 *     mínima respecto a cada redundante: ∂U/∂X_j = 0, o sea
 *
 *         Σ_k X_k (∫ m_j m_k ds/EI + ∫ n_j n_k ds/EA) = −(∫ M₀ m_j ds/EI + ∫ N₀ n_j ds/EA).
 *
 *     Las integrales se evalúan con Simpson compuesto (192 intervalos, partidos en los bordes de
 *     las cargas, donde los integrandos dejan de ser lisos).
 *  4. M = M₀ + Σ X_k m_k, y lo mismo N y V, se comparan estación por estación con el análisis
 *     matricial. El solver malla el arco con cuerdas rectas; la tolerancia es la del polígono,
 *     max(1e-3, 2δ/f) relativa (`arcSolverPolygon`).
 *
 * Como referencia, y sólo donde es de verdad aplicable —biarticulado circular con apoyos a la
 * misma altura y una única carga vertical uniforme por proyección horizontal en todo el claro—,
 * se da también la fórmula cerrada que desprecia la deformación axial.
 */
import { selectedFactors } from '../engine/solver';
import { solveLinearSystem } from '../foundation/linearAlgebra';
import type { CircularArcGeometry } from '../graphics/memberCurve';
import type { AnalysisResult, LoadCombination, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { evaluateSegment } from '../engine/diagram';
import {
  arcBreakpoints,
  arcCutAt,
  arcLoadsOf,
  arcLoadsTotal,
  memberArc,
  nearConcentrated,
  simpsonStations,
  type ArcLoad,
  type ArcStartSide,
  type Vec2,
} from './arcStatics';
import { arcSolverPolygon } from './staticsSections';
import { classifyStructure } from './structureClassification';

/** Intervalos de Simpson en todo el arco. */
export const SIMPSON_PANELS = 192;
const TABLE_STATIONS = 12;
const CHECK_STATIONS = 48;

export type ArchForm = 'two-hinged' | 'cantilever';

/** Una redundante: la componente de reacción que se suelta en el extremo liberado. */
export interface ArchRedundant {
  /** `H`, o `X_1`, `X_2`, `X_3`. */
  symbol: string;
  kind: 'force' | 'moment';
  nodeId: string;
  /** Sentido positivo supuesto sobre el arco (unitario); cero para un momento (antihorario). */
  direction: Vec2;
  /** Valor por trabajo mínimo, en el sentido supuesto. */
  value: number;
  /** Sin el término axial: sólo ∫m m/EI. */
  bendingOnlyValue: number;
  /** Lo que da el análisis matricial para la misma componente. */
  solverValue: number;
}

/** Una reacción de la estructura liberada (bajo las cargas, o por unidad de redundante). */
export interface ArchReaction {
  nodeId: string;
  fx: number;
  fy: number;
  moment: number;
}

export interface ArchStation {
  t: number;
  s: number;
  point: Vec2;
  /** Inclinación de la tangente, rad. */
  slope: number;
  M0: number;
  N0: number;
  V0: number;
  m: number[];
  n: number[];
  v: number[];
  M: number;
  N: number;
  V: number;
  solver?: { axial: number; shear: number; moment: number };
}

/** Fórmula cerrada sin deformación axial (biarticulado circular, w uniforme por proyección horizontal). */
export interface ArchClosedForm {
  w: number;
  radius: number;
  /** Semiángulo del arco, rad. */
  alpha: number;
  /** ∫(sen²α − sen²θ)(cos θ − cos α) dθ y ∫(cos θ − cos α)² dθ, de −α a α. */
  numerator: number;
  denominator: number;
  thrust: number;
}

export interface ArchLeastWorkResult {
  applicable: true;
  memberId: string;
  startNodeId: string;
  endNodeId: string;
  geometry: CircularArcGeometry;
  EI: number;
  EA: number;
  form: ArchForm;
  /** El apoyo que se conserva entero en la liberada, y el que se suelta. */
  keptNodeId: string;
  releasedNodeId: string;
  loads: ArcLoad[];
  /** Cargas en nudo de los extremos, factorizadas. */
  nodalLoads: Array<{ nodeId: string; fx: number; fy: number; moment: number }>;
  /** Reacciones de la liberada bajo las cargas. */
  basicReactions: ArchReaction[];
  /** Reacciones de la liberada por redundante unitaria. */
  unitReactions: ArchReaction[][];
  redundants: ArchRedundant[];
  /** ∫ m_j m_k ds/EI y ∫ n_j n_k ds/EA. */
  bending: number[][];
  axial: number[][];
  /** ∫ M₀ m_j ds/EI y ∫ N₀ n_j ds/EA. */
  loadBending: number[];
  loadAxial: number[];
  panels: number;
  /** Estaciones de la tabla: cada doceavo del arco. */
  stations: ArchStation[];
  /** Momento final de mayor valor absoluto. */
  peak: { s: number; value: number };
  closedForm?: ArchClosedForm;
  verification: {
    chords: number;
    sagitta: number;
    rise: number;
    tolerance: number;
    forceScale: number;
    momentScale: number;
    /** Mayores diferencias contra el solver. */
    redundant: number;
    force: number;
    moment: number;
  };
}

interface ArchRejection {
  applicable: false;
  reasonKey: string;
}

export type ArchLeastWorkOutcome = ArchLeastWorkResult | ArchRejection;

const reject = (reasonKey: string): ArchRejection => ({ applicable: false, reasonKey });

const cross = (r: Vec2, f: Vec2): number => r.x * f.y - r.y * f.x;

type SupportShape = 'pin' | 'fixed' | 'other';

const shapeOf = (support: SupportDefinition): SupportShape => {
  if (support.type === 'pin') return 'pin';
  if (support.type === 'fixed') return 'fixed';
  if (support.type === 'custom') {
    if (support.restrainX && support.restrainY && support.restrainR) return 'fixed';
    if (support.restrainX && support.restrainY && !support.restrainR) return 'pin';
  }
  return 'other';
};

const hasSpring = (support: SupportDefinition): boolean => Object.entries(support.spring ?? {})
  .some(([key, value]) => key !== 'angleDeg' && Math.abs(value ?? 0) > 0);

const hasPrescribed = (support: SupportDefinition): boolean => Object.values(support.prescribed ?? {})
  .some((value) => Math.abs(value ?? 0) > 0);

/** Fórmula cerrada H = (wR/2)·I₁/I₂ del biarticulado circular con w por proyección horizontal. */
export const circularTwoHingedThrust = (w: number, radius: number, alpha: number): ArchClosedForm => {
  const sin = Math.sin(alpha);
  const cos = Math.cos(alpha);
  const numerator = (4 / 3) * sin ** 3 - 2 * alpha * sin * sin * cos + alpha * cos - sin * cos * cos;
  const denominator = alpha + 2 * alpha * cos * cos - 3 * sin * cos;
  return { w, radius, alpha, numerator, denominator, thrust: (w * radius * numerator) / (2 * denominator) };
};

export const solveArchLeastWork = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
): ArchLeastWorkOutcome => {
  const classification = classifyStructure(project);
  if (classification.kind !== 'frame' || classification.indeterminacy < 1) return reject('method.rejectedArchShape');
  const [member] = project.members;
  if (project.members.length !== 1 || !member?.curve || member.type !== 'frame' || project.nodes.length !== 2) {
    return reject('method.rejectedArchShape');
  }
  if (project.settings.analysisMode === 'p-delta' || analysis.pDelta) return reject('method.rejectedSecondOrder');
  if (!analysis.success || !analysis.memberResults.length) return reject('method.rejectedStaticsAnalysis');

  const factors = selectedFactors(project, combination);
  const active = (caseId: string) => (factors[caseId] ?? 0) !== 0;
  if (
    member.beamTheory === 'timoshenko'
    || (member.axialBehavior ?? 'both') !== 'both'
    || member.rotationalSpringI !== undefined || member.rotationalSpringJ !== undefined
    || Boolean(member.rigidOffsetI) || Boolean(member.rigidOffsetJ)
    || Object.values(member.releases ?? {}).some(Boolean)
    || project.nodes.some((node) => node.internalHinge || hasSpring(node.support) || hasPrescribed(node.support))
    || (project.nodeLinks ?? []).length > 0
    || (project.multiPointConstraints ?? []).length > 0
    || (project.generatedLoadSources ?? []).length > 0
    || (project.prescribedDisplacements ?? []).some((entry) => active(entry.caseId) && entry.value !== 0)
    || (project.memberInitialEffects ?? []).some((effect) => active(effect.caseId))
  ) {
    return reject('method.rejectedModelFeature');
  }
  if (!(member.E > 0) || !(member.I > 0) || !(member.A > 0)) return reject('method.rejectedArchShape');

  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const arc = memberArc(member, nodes);
  const ni = nodes.get(member.i);
  const nj = nodes.get(member.j);
  if (!arc || !ni || !nj) return reject('method.rejectedArchShape');
  const shapeI = shapeOf(ni.support);
  const shapeJ = shapeOf(nj.support);
  if (shapeI === 'other' || shapeJ === 'other') return reject('method.rejectedArchSupports');

  // ---- La estructura liberada ------------------------------------------------------------------
  // Two pins: B becomes a vertical roller, H is the redundant. A fixed end: the other is set free.
  const form: ArchForm = shapeI === 'pin' && shapeJ === 'pin' ? 'two-hinged' : 'cantilever';
  const kept: NodeModel = form === 'two-hinged' ? ni : shapeI === 'fixed' ? ni : nj;
  const released: NodeModel = kept === ni ? nj : ni;
  const releasedShape = released === ni ? shapeI : shapeJ;
  if (form === 'two-hinged' && Math.abs(released.x - kept.x) <= 1e-9 * arc.chord) return reject('method.rejectedArchSupports');

  const inward = Math.sign(kept.x - released.x) || 1;
  const redundantsDraft: Array<Pick<ArchRedundant, 'symbol' | 'kind' | 'nodeId' | 'direction'>> = form === 'two-hinged'
    ? [{ symbol: 'H', kind: 'force', nodeId: released.id, direction: { x: inward, y: 0 } }]
    : [
      { symbol: 'X_1', kind: 'force', nodeId: released.id, direction: { x: 1, y: 0 } },
      { symbol: 'X_2', kind: 'force', nodeId: released.id, direction: { x: 0, y: 1 } },
      ...(releasedShape === 'fixed' ? [{ symbol: 'X_3', kind: 'moment' as const, nodeId: released.id, direction: { x: 0, y: 0 } }] : []),
    ];
  if (redundantsDraft.length !== classification.indeterminacy) return reject('method.rejectedArchSupports');

  const loads = arcLoadsOf(project, member, arc, factors);
  const nodalLoads = project.nodalLoads
    .filter((load) => active(load.caseId) && (load.nodeId === ni.id || load.nodeId === nj.id))
    .map((load) => {
      const factor = factors[load.caseId] ?? 0;
      return { nodeId: load.nodeId, fx: load.fx * factor, fy: load.fy * factor, moment: load.mz * factor };
    });

  /**
   * Reactions of the released structure under a set of actions given by their total force and
   * their moment about node i. The cantilever's kept end takes everything; the two-hinged's pin
   * A and vertical roller B share it by ΣM(A) = 0.
   */
  const basicReactions = (total: { fx: number; fy: number; momentAboutI: number }): ArchReaction[] => {
    if (form === 'cantilever') {
      const momentAboutKept = total.momentAboutI + cross({ x: ni.x - kept.x, y: ni.y - kept.y }, { x: total.fx, y: total.fy });
      return [{ nodeId: kept.id, fx: -total.fx, fy: -total.fy, moment: -momentAboutKept }];
    }
    // Pin at A (= i here: the two-hinged keeps i), vertical roller at B.
    const by = -total.momentAboutI / (nj.x - ni.x);
    return [
      { nodeId: ni.id, fx: -total.fx, fy: -total.fy - by, moment: 0 },
      { nodeId: nj.id, fx: 0, fy: by, moment: 0 },
    ];
  };

  /** What the left free body receives at node i: its reactions and any action applied there. */
  const startSide = (reactions: readonly ArchReaction[], applied: readonly { nodeId: string; fx: number; fy: number; moment: number }[]): ArcStartSide => {
    const atI = [...reactions, ...applied].filter((entry) => entry.nodeId === ni.id);
    return {
      fx: atI.reduce((sum, entry) => sum + entry.fx, 0),
      fy: atI.reduce((sum, entry) => sum + entry.fy, 0),
      moment: atI.reduce((sum, entry) => sum + entry.moment, 0),
    };
  };

  const origin = { x: ni.x, y: ni.y };
  const memberTotal = arcLoadsTotal(arc, loads, origin);
  const loadTotal = nodalLoads.reduce((sum, load) => {
    const node = nodes.get(load.nodeId)!;
    return {
      fx: sum.fx + load.fx,
      fy: sum.fy + load.fy,
      momentAboutI: sum.momentAboutI + load.moment + cross({ x: node.x - origin.x, y: node.y - origin.y }, { x: load.fx, y: load.fy }),
    };
  }, { fx: memberTotal.fx, fy: memberTotal.fy, momentAboutI: memberTotal.moment });
  const basic = basicReactions(loadTotal);
  const loadStart = startSide(basic, nodalLoads);

  const unitActions = redundantsDraft.map((redundant) => ({
    nodeId: released.id,
    fx: redundant.kind === 'force' ? redundant.direction.x : 0,
    fy: redundant.kind === 'force' ? redundant.direction.y : 0,
    moment: redundant.kind === 'moment' ? 1 : 0,
  }));
  const unitReactions = unitActions.map((action) => basicReactions({
    fx: action.fx,
    fy: action.fy,
    momentAboutI: action.moment + cross({ x: released.x - origin.x, y: released.y - origin.y }, { x: action.fx, y: action.fy }),
  }));
  const unitStarts = unitActions.map((action, k) => startSide(unitReactions[k]!, [action]));

  const count = redundantsDraft.length;
  const evaluateAt = (t: number): Omit<ArchStation, 'M' | 'N' | 'V'> => {
    const base = arcCutAt(arc, loads, loadStart, t);
    const units = unitStarts.map((start) => arcCutAt(arc, [], start, t));
    return {
      t, s: base.s, point: base.point, slope: base.slope,
      M0: base.moment, N0: base.axial, V0: base.shear,
      m: units.map((cut) => cut.moment), n: units.map((cut) => cut.axial), v: units.map((cut) => cut.shear),
    };
  };

  // ---- ∂U/∂X = 0, con Simpson -----------------------------------------------------------------
  const EI = member.E * member.I;
  const EA = member.E * member.A;
  const bending = Array.from({ length: count }, () => new Array<number>(count).fill(0));
  const axial = Array.from({ length: count }, () => new Array<number>(count).fill(0));
  const loadBending = new Array<number>(count).fill(0);
  const loadAxial = new Array<number>(count).fill(0);
  const breakpoints = arcBreakpoints(loads);
  for (const { t, weight, before } of simpsonStations(breakpoints, SIMPSON_PANELS)) {
    // The end of a stretch is read just before a concentrated action, its start just after.
    const sample = evaluateAt(before ? t - 1e-9 : t);
    const ds = weight * arc.length;
    for (let j = 0; j < count; j += 1) {
      loadBending[j] += (sample.M0 * sample.m[j]! * ds) / EI;
      loadAxial[j] += (sample.N0 * sample.n[j]! * ds) / EA;
      for (let k = 0; k < count; k += 1) {
        bending[j]![k] += (sample.m[j]! * sample.m[k]! * ds) / EI;
        axial[j]![k] += (sample.n[j]! * sample.n[k]! * ds) / EA;
      }
    }
  }
  let values: number[];
  let bendingOnly: number[];
  try {
    values = solveLinearSystem(
      bending.map((row, j) => row.map((value, k) => value + axial[j]![k]!)),
      loadBending.map((value, j) => -(value + loadAxial[j]!)),
    ).x;
    bendingOnly = solveLinearSystem(bending.map((row) => [...row]), loadBending.map((value) => -value)).x;
  } catch {
    return reject('method.rejectedArchSupports');
  }
  if (values.some((value) => !Number.isFinite(value))) return reject('method.rejectedArchSupports');

  const complete = (entry: Omit<ArchStation, 'M' | 'N' | 'V'>): ArchStation => ({
    ...entry,
    M: entry.M0 + entry.m.reduce((sum, value, k) => sum + values[k]! * value, 0),
    N: entry.N0 + entry.n.reduce((sum, value, k) => sum + values[k]! * value, 0),
    V: entry.V0 + entry.v.reduce((sum, value, k) => sum + values[k]! * value, 0),
  });

  // ---- Verificación contra el análisis matricial ----------------------------------------------
  const result = analysis.memberResults.find((entry) => entry.memberId === member.id);
  const solverNode = analysis.nodeResults.find((entry) => entry.nodeId === released.id);
  if (!result || !result.diagramSegments.length || !solverNode) return reject('method.rejectedStaticsAnalysis');
  const solverAt = (s: number) => {
    const segment = result.diagramSegments.find((entry) => s >= entry.x0 && s <= entry.x1)
      ?? (s <= result.diagramSegments[0]!.x0 ? result.diagramSegments[0]! : result.diagramSegments[result.diagramSegments.length - 1]!);
    const value = evaluateSegment(segment, s);
    return { axial: value.axial, shear: value.shear, moment: value.moment };
  };
  const polygon = arcSolverPolygon(arc);
  const totalLoad = Math.hypot(loadTotal.fx, loadTotal.fy);
  const redundants: ArchRedundant[] = redundantsDraft.map((draft, k) => ({
    ...draft,
    value: values[k]!,
    bendingOnlyValue: bendingOnly[k]!,
    solverValue: draft.kind === 'moment' ? solverNode.rm : solverNode.rx * draft.direction.x + solverNode.ry * draft.direction.y,
  }));
  const forceScale = Math.max(1, totalLoad, ...redundants.filter((entry) => entry.kind === 'force').map((entry) => Math.abs(entry.value)));

  const checked: ArchStation[] = [];
  for (let k = 0; k <= CHECK_STATIONS; k += 1) {
    const t = k / CHECK_STATIONS;
    if (nearConcentrated(loads, t)) continue;
    const station = complete(evaluateAt(t));
    checked.push({ ...station, solver: solverAt(station.s) });
  }
  // The solver's gap is geometric — its chords sit up to δ off the arc — so a moment gap is of
  // the order of a force times δ: it is measured against force × rise (or |M| if larger), which
  // does not depend on which structure was chosen as the released one.
  const momentScale = Math.max(1, forceScale * polygon.rise, ...checked.map((station) => Math.abs(station.M)));
  let force = 0;
  let moment = 0;
  for (const station of checked) {
    force = Math.max(force, Math.abs(station.N - station.solver!.axial), Math.abs(station.V - station.solver!.shear));
    moment = Math.max(moment, Math.abs(station.M - station.solver!.moment));
  }
  let redundantGap = 0;
  for (const redundant of redundants) {
    const scale = redundant.kind === 'moment' ? momentScale : forceScale;
    redundantGap = Math.max(redundantGap, Math.abs(redundant.value - redundant.solverValue) / scale);
  }
  if (redundantGap > polygon.tolerance || force > polygon.tolerance * forceScale || moment > polygon.tolerance * momentScale) {
    return reject('method.rejectedArchMismatch');
  }

  const stations = Array.from({ length: TABLE_STATIONS + 1 }, (_, k) => {
    const station = complete(evaluateAt(k / TABLE_STATIONS));
    return { ...station, solver: solverAt(station.s) };
  });
  let peak = { s: 0, value: 0 };
  for (let k = 0; k <= SIMPSON_PANELS; k += 1) {
    const station = complete(evaluateAt(k / SIMPSON_PANELS));
    if (Math.abs(station.M) > Math.abs(peak.value)) peak = { s: station.s, value: station.M };
  }

  // ---- La fórmula cerrada, sólo donde aplica ---------------------------------------------------
  let closedForm: ArchClosedForm | undefined;
  const level = Math.abs(nj.y - ni.y) <= 1e-9 * arc.chord;
  const midpoint = arcCutAt(arc, [], { fx: 0, fy: 0, moment: 0 }, 0.5).point;
  const rises = midpoint.y > Math.max(ni.y, nj.y);
  const [only] = loads;
  if (
    form === 'two-hinged' && level && rises && loads.length === 1 && nodalLoads.length === 0 && only?.kind === 'distributed'
    && only.basis === 'horizontal' && only.system === 'global' && only.t0 <= 1e-12 && only.t1 >= 1 - 1e-12
    && only.qxA === 0 && only.qxB === 0 && only.qyA === only.qyB && only.qyA < 0
  ) {
    closedForm = circularTwoHingedThrust(-only.qyA, arc.radius, Math.abs(arc.sweep) / 2);
  }

  return {
    applicable: true,
    memberId: member.id,
    startNodeId: member.i,
    endNodeId: member.j,
    geometry: arc,
    EI,
    EA,
    form,
    keptNodeId: kept.id,
    releasedNodeId: released.id,
    loads,
    nodalLoads,
    basicReactions: basic,
    unitReactions,
    redundants,
    bending,
    axial,
    loadBending,
    loadAxial,
    panels: SIMPSON_PANELS,
    stations,
    peak,
    ...(closedForm ? { closedForm } : {}),
    verification: {
      chords: polygon.chords,
      sagitta: polygon.sagitta,
      rise: polygon.rise,
      tolerance: polygon.tolerance,
      forceScale,
      momentScale,
      redundant: redundantGap,
      force,
      moment,
    },
  };
};
