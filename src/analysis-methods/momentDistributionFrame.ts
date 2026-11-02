/**
 * Cross (distribución de momentos) en marcos, con desplazamiento lateral — resuelto de verdad.
 *
 * `hardyCross.ts` reparte momentos sobre una viga continua de apoyos simples y `kaniFrame.ts`
 * itera nudos de pórtico, pero ninguno admite que los nudos se trasladen: Kani se retira en
 * cuanto el pórtico se desplaza lateralmente. Éste es el procedimiento completo del libro de
 * texto para un marco plano de barras axialmente indeformables:
 *
 * 1. **Etapa sin desplazamiento.** Cada barra se empotra en sus dos extremos y su momento de
 *    empotramiento perfecto (MEP) sale de `analyzeProject` sobre la barra aislada empotrada en
 *    ambos extremos — igual que en Kani, nada se re-deriva aquí. Los nudos que pueden girar
 *    (todo nudo cuyo apoyo no restringe el giro: libres, articulados, deslizantes) se equilibran
 *    en cada ciclo con rigidez 4EI/L y factor de transporte ½. Un apoyo articulado es un nudo
 *    más con factor de distribución 1.
 *
 *    Un extremo de barra *liberado* —una liberación de momento de la barra, o cualquier extremo
 *    que llega a un nudo con articulación interna— no tiene momento: no se equilibra ni recibe
 *    transporte. El otro extremo de esa barra trabaja con la rigidez modificada 3EI/L y no
 *    transporta nada, y el MEP de la barra es el de la barra aislada empotrada en su extremo
 *    continuo y articulada en el liberado (empotrada–articulada), obtenido por el mismo análisis
 *    aislado. Una barra liberada en sus dos extremos no toma momento: no entra en el reparto.
 * 2. **Modos de desplazamiento.** Con las barras indeformables axialmente, las traslaciones de
 *    nudo compatibles son el espacio nulo de las restricciones (u_j − u_i)·e = 0 de cada barra y
 *    de los apoyos. Cada modo k impone a cada barra un giro de cuerda ψ = (δu_j − δu_i)·n/L, y
 *    por tanto un MEP de desplazamiento −6EIψ/L en ambos extremos, que se reparte con el mismo
 *    Cross.
 * 3. **Superposición.** M = M⁰ + Σ c_k·Mᵏ, con c tal que el trabajo virtual de cada modo se anule:
 *
 *        G_k(s) = Σ_barras (M_i + M_j)·ψᵏ + Σ_barras Wᵏ + Σ_nudos P·δuᵏ = 0,
 *
 *    donde Wᵏ, el trabajo de las cargas de barra en el movimiento rígido de esa barra, es menos el
 *    de las reacciones de la barra aislada (empotrada, o empotrada–articulada si tiene un extremo
 *    liberado): Wᵏ = −[R_i·δu_i + R_j·δu_j + (Mr_i + Mr_j)·ψ]. Un extremo liberado tiene M = 0 y
 *    Mr = 0, así que entra en la ecuación sólo por sus fuerzas. El MEP de desplazamiento de una
 *    barra empotrada–articulada es −3EIψ/L en su extremo continuo y 0 en el liberado.
 *    En un pórtico ortogonal de entrepisos, tomando como modo k «el entrepiso k y todo lo de
 *    encima se trasladan juntos», esta ecuación es exactamente la de cortante de entrepiso.
 *
 * Resortes rotacionales de apoyo. Un apoyo que no restringe el giro pero lleva un resorte k_r
 * (`support.spring.kr`) es un nudo más que se equilibra, con el resorte como una rigidez más en
 * ΣK: toma su parte k_r/ΣK del desequilibrio y no transporta nada (su otro «extremo» es el
 * terreno). Su momento final M_r = k_r·θ es el que el nudo ejerce sobre el resorte; la reacción
 * del apoyo es −M_r. El resorte no se traslada, así que no aparece en las ecuaciones de
 * desplazamiento. Los resortes de traslación siguen fuera del método.
 *
 * Convención de signos: momentos de extremo *sobre la barra*, antihorarios positivos (la misma
 * que `MemberResult.localEndForces[2]` y `[5]` y que las escenas de cuerpo libre); giros de
 * cuerda antihorarios positivos.
 *
 * Verificación: el análisis matricial incluye la deformación axial y Cross no. Por eso el
 * resultado se compara contra `analyzeProject` sobre una copia del modelo con A multiplicada por
 * `AXIAL_STIFFNESS_FACTOR` (y la densidad dividida por el mismo factor, para que el peso propio
 * no cambie): esa referencia axialmente rígida tiene que coincidir, o el método se retira. La
 * diferencia contra el análisis real se informa aparte, honestamente, como el efecto de la
 * deformación axial.
 */
import { analyzeProject, selectedFactors } from '../engine/solver';
import { withResolvedGeneratedLoads } from '../engine/generatedLoads';
import { solveLinearSystem } from '../foundation/linearAlgebra';
import type { AnalysisResult, LoadCombination, MemberModel, NodeModel, ProjectModel, SupportDefinition } from '../types';
import { buildFrameGrid, restrainsRotation } from './frameGeometry';
import { evaluate } from './polynomialAlgebra';
import { classifyStructure, type StructureClassification } from './structureClassification';

/** Ciclos de equilibrio/transporte que se conservan para la tabla del PDF. */
export const RECORDED_CYCLES = 4;
/**
 * Cuánto más rígida axialmente es la referencia contra la que se verifica Cross. Con 1e4 la
 * deformación axial residual aún se nota (≈1e-6 relativo); con 1e8 la matriz pierde dígitos por
 * mal condicionamiento. 1e6 deja la referencia a ≈1e-8 de la idealización indeformable.
 */
export const AXIAL_STIFFNESS_FACTOR = 1e6;
/** Discrepancia relativa admitida contra la referencia axialmente rígida. */
const RIGID_TOLERANCE = 1e-4;
const CONVERGENCE = 1e-12;
const MAX_CYCLES = 5000;
const MAX_SWAY_MODES = 12;
/** Momento de empotramiento mayor que produce el desplazamiento supuesto de cada modo (kN·m). */
const DEFAULT_REFERENCE_SWAY_MOMENT = 100;

export interface CrossEnd {
  memberId: string;
  /** Nudo en el que está este extremo. */
  nodeId: string;
  farNodeId: string;
  end: 'i' | 'j';
  /**
   * Rigidez a flexión: 4EI/L, 3EI/L si el otro extremo está liberado, 0 si éste lo está.
   * `stiffnessCoefficient` es el 4, el 3 o el 0.
   */
  stiffness: number;
  stiffnessCoefficient: 4 | 3 | 0;
  /** Extremo liberado (liberación de momento o articulación interna): su momento es siempre 0. */
  released: boolean;
  /** Factor de distribución; 0 donde el nudo no se equilibra (empotramiento) y en un extremo liberado. */
  distributionFactor: number;
  /** Fracción de lo equilibrado aquí que se transporta al otro extremo: ½, o 0 si aquél está liberado. */
  carryOverFactor: number;
  /** Índice del otro extremo de la misma barra, que recibe el transporte. */
  partner: number;
  /**
   * Resorte rotacional del apoyo, tratado como un extremo más del nudo: rigidez k_r, sin barra y
   * sin transporte (`partner` es él mismo). `memberId` es `resorte`.
   */
  spring?: boolean;
}

/** Un resorte rotacional de apoyo y lo que tomó en el reparto. */
export interface CrossSpring {
  nodeId: string;
  /** k_r, kN·m/rad. */
  stiffness: number;
  /** Índice de su extremo en `ends`. */
  endIndex: number;
  /** M_r = k_r·θ: momento que el nudo ejerce sobre el resorte. La reacción es −M_r. */
  moment: number;
  /** Giro del nudo, θ = M_r/k_r. */
  rotation: number;
  /** Momento de reacción del apoyo en la referencia axialmente rígida y en el análisis real. */
  rigidReaction: number;
  solverReaction: number;
}

export interface CrossJoint {
  nodeId: string;
  /** Se equilibra en cada ciclo: su apoyo no restringe el giro y algún extremo continuo llega a él. */
  rotates: boolean;
  /** Todos los extremos que llegan al nudo están liberados: una articulación, sin nada que repartir. */
  hinged: boolean;
  /** Momento nodal aplicado (antihorario), bajo la combinación. */
  appliedMoment: number;
  endIndices: number[];
  stiffnessSum: number;
}

export interface CrossCycle {
  /** Momento repartido en cada extremo al equilibrar los nudos. */
  balance: number[];
  /** Momento recibido por transporte desde el otro extremo de la barra. */
  carryOver: number[];
}

export interface CrossDistribution {
  /** Momentos de partida por extremo (MEP de cargas o de desplazamiento). */
  initial: number[];
  /** Los primeros `RECORDED_CYCLES` ciclos, para la tabla. */
  cycles: CrossCycle[];
  /** Ciclos hasta que ningún nudo quedó con desequilibrio medible. */
  cycleCount: number;
  /** Momentos convergidos por extremo. */
  final: number[];
}

/** Un término del MEP que el lector puede repetir con la fórmula del libro. */
export interface CrossFemTerm {
  kind: 'uniform' | 'point';
  /** Etiqueta de la carga (su id, o «peso propio»). */
  label: string;
  /** w (por unidad de longitud) o P, positivos hacia −y local (hacia abajo en una viga i→j). */
  value: number;
  /** Distancia desde el extremo i, para una carga puntual. */
  a?: number;
  momentI: number;
  momentJ: number;
}

export interface CrossMember {
  memberId: string;
  nodeI: string;
  nodeJ: string;
  length: number;
  EI: number;
  cos: number;
  sin: number;
  /** Extremos liberados: el MEP es el de la barra empotrada–articulada (o nulo si lo están ambos). */
  releasedI: boolean;
  releasedJ: boolean;
  /** MEP de las cargas de la barra, sobre la barra, antihorario positivo. */
  fixedEndMomentI: number;
  fixedEndMomentJ: number;
  /** Reacciones de la barra aislada (empotrada o empotrada–articulada), globales, sobre la barra. */
  fixedEndReactionI: { fx: number; fy: number; m: number };
  fixedEndReactionJ: { fx: number; fy: number; m: number };
  /** Presente sólo cuando las fórmulas del libro reproducen el MEP del análisis aislado. */
  femTerms?: CrossFemTerm[];
  /** Cortante isostático (viga simplemente apoyada con sus cargas), convención del diagrama. */
  isostaticShearStart: number;
  isostaticShearEnd: number;
  finalMomentI: number;
  finalMomentJ: number;
  /** V(0) y V(L) en la convención del diagrama: V = V₀ + (M_i + M_j)/L. */
  shearStart: number;
  shearEnd: number;
  /** Mayor y menor momento del diagrama M(x) en la barra (convención del diagrama). */
  spanMaximum: { x: number; value: number };
  spanMinimum: { x: number; value: number };
  /** Lo que la referencia axialmente rígida y el análisis real dan en los mismos extremos. */
  rigidMomentI: number;
  rigidMomentJ: number;
  solverMomentI: number;
  solverMomentJ: number;
}

export interface CrossSwayMode {
  index: number;
  /** Traslación de los nudos bajo el desplazamiento supuesto Δ (m, globales). */
  translations: { nodeId: string; ux: number; uy: number }[];
  /** Desplazamiento supuesto Δ: escala del modo unitario. */
  assumedDisplacement: number;
  /** Giro de cuerda de cada barra bajo Δ (sólo las que giran). */
  chordRotations: { memberId: string; psi: number }[];
  /** Presente en un pórtico ortogonal: el entrepiso cuyo desplazamiento relativo es este modo. */
  storey?: { level: number; height: number; columnIds: string[]; nodeIds: string[] };
  distribution: CrossDistribution;
}

export interface CrossSwayEquation {
  /** Σ (M_i⁰ + M_j⁰)·ψᵏ de la etapa sin desplazamiento, con el modo unitario. */
  nonSwayMomentTerm: number;
  /** Σ Wᵏ, trabajo de las cargas de barra en el movimiento rígido del modo unitario. */
  memberLoadTerm: number;
  /** Σ P·δuᵏ de las cargas nodales. */
  nodalLoadTerm: number;
  /** Σ (M_iˡ + M_jˡ)·ψᵏ de cada estado de desplazamiento l. */
  coefficients: number[];
}

export interface CrossVerification {
  axialStiffnessFactor: number;
  /** Mayor |M_Cross − M_rígido| en cualquier extremo, kN·m. */
  rigidResidual: number;
  /** Mayor |M| de la referencia, para leer el residuo en relativo. */
  referenceMoment: number;
  /** Mayor |M_Cross − M_real|: el efecto de la deformación axial que Cross desprecia. */
  solverResidual: number;
  solverReferenceMoment: number;
}

export interface CrossFrameResult {
  applicable: true;
  classification: StructureClassification;
  members: CrossMember[];
  ends: CrossEnd[];
  joints: CrossJoint[];
  nonSway: CrossDistribution;
  modes: CrossSwayMode[];
  equations: CrossSwayEquation[];
  /** c_k: cuántas veces el desplazamiento supuesto de cada modo ocurre de verdad. */
  swayFactors: number[];
  /** Los modos son desplazamientos de entrepiso y las ecuaciones, de cortante de entrepiso. */
  storeyForm: boolean;
  /** Momentos finales por extremo: M⁰ + Σ c_k·Mᵏ. */
  final: number[];
  /** Resortes rotacionales de apoyo, en el orden de sus extremos. */
  springs: CrossSpring[];
  verification: CrossVerification;
}

interface CrossFrameRejection {
  applicable: false;
  reasonKey: string;
}

export type CrossFrameOutcome = CrossFrameResult | CrossFrameRejection;

export interface CrossFrameOptions {
  /**
   * Momento de empotramiento mayor (unidades internas) que produce el desplazamiento supuesto de
   * cada modo: el «100 arbitrario» del libro. Sólo cambia la escala de los estados intermedios.
   */
  referenceSwayMoment?: number;
}

const reject = (reasonKey: string): CrossFrameRejection => ({ applicable: false, reasonKey });

/** Un resorte de traslación (kx, ky o normal): fuera del método. */
const hasTranslationalSpring = (support: SupportDefinition): boolean => [support.spring?.kx, support.spring?.ky, support.spring?.kNormal]
  .some((value) => typeof value === 'number' && value !== 0);

/** k_r de un apoyo que deja girar el nudo; donde el apoyo restringe el giro, el resorte no trabaja. */
const rotationalSpring = (support: SupportDefinition): number => {
  const kr = support.spring?.kr;
  return typeof kr === 'number' && Number.isFinite(kr) && kr > 0 && !restrainsRotation(support) ? kr : 0;
};

const hasPrescribed = (support: SupportDefinition): boolean => Object.values(support.prescribed ?? {})
  .some((value) => typeof value === 'number' && value !== 0);

/** Restricciones de traslación de un apoyo, como filas (cx, cy) de c·u = 0. */
const supportRows = (support: SupportDefinition): [number, number][] => {
  switch (support.type) {
    case 'fixed':
    case 'pin':
      return [[1, 0], [0, 1]];
    case 'roller': {
      const angle = ((support.angleDeg ?? 90) * Math.PI) / 180;
      return [[Math.cos(angle), Math.sin(angle)]];
    }
    case 'custom':
      return [
        ...(support.restrainX ? [[1, 0] as [number, number]] : []),
        ...(support.restrainY ? [[0, 1] as [number, number]] : []),
      ];
    default:
      return [];
  }
};

/**
 * Base del espacio nulo de `rows` (cada fila, una restricción lineal), por eliminación con
 * pivoteo parcial. Las variables libres son las columnas sin pivote; cada vector de la base vale
 * 1 en su variable libre y 0 en las demás libres.
 */
const nullSpace = (rows: readonly number[][], columns: number): number[][] => {
  const matrix = rows.map((row) => [...row]);
  const pivotColumns: number[] = [];
  let rank = 0;
  for (let column = 0; column < columns && rank < matrix.length; column += 1) {
    let best = rank;
    for (let row = rank + 1; row < matrix.length; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[best][column])) best = row;
    }
    if (Math.abs(matrix[best][column]) <= 1e-9) continue;
    [matrix[rank], matrix[best]] = [matrix[best], matrix[rank]];
    const pivot = matrix[rank][column];
    for (let k = 0; k < columns; k += 1) matrix[rank][k] /= pivot;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === rank) continue;
      const factor = matrix[row][column];
      if (factor === 0) continue;
      for (let k = 0; k < columns; k += 1) matrix[row][k] -= factor * matrix[rank][k];
    }
    pivotColumns.push(column);
    rank += 1;
  }
  const pivots = new Set(pivotColumns);
  const free = Array.from({ length: columns }, (_, column) => column).filter((column) => !pivots.has(column));
  return free.map((freeColumn) => {
    const vector = new Array<number>(columns).fill(0);
    vector[freeColumn] = 1;
    pivotColumns.forEach((pivotColumn, row) => {
      vector[pivotColumn] = -matrix[row][freeColumn];
    });
    return vector.map((value) => (Math.abs(value) < 1e-12 ? 0 : value));
  });
};

/**
 * Cross clásico, con los nudos equilibrados todos a la vez en cada ciclo y el transporte
 * después — la tabla del libro, fila «Equilibrio c» y fila «Transporte c».
 */
const distribute = (
  ends: readonly CrossEnd[],
  joints: readonly CrossJoint[],
  initial: readonly number[],
  applied: (joint: CrossJoint) => number,
): CrossDistribution | undefined => {
  const current = [...initial];
  const rotating = joints.filter((joint) => joint.rotates);
  const scale = Math.max(
    0,
    ...initial.map((value) => Math.abs(value)),
    ...rotating.map((joint) => Math.abs(applied(joint))),
  );
  const cycles: CrossCycle[] = [];
  if (scale === 0) return { initial: [...initial], cycles, cycleCount: 0, final: current };
  const tolerance = scale * CONVERGENCE;
  let cycleCount = 0;
  for (; cycleCount <= MAX_CYCLES; cycleCount += 1) {
    const balance = new Array<number>(ends.length).fill(0);
    let largest = 0;
    for (const joint of rotating) {
      const unbalanced = joint.endIndices.reduce((sum, index) => sum + current[index], 0) - applied(joint);
      largest = Math.max(largest, Math.abs(unbalanced));
      for (const index of joint.endIndices) balance[index] = -ends[index].distributionFactor * unbalanced;
    }
    if (largest <= tolerance) break;
    const carryOver = new Array<number>(ends.length).fill(0);
    balance.forEach((value, index) => {
      if (value !== 0) carryOver[ends[index].partner] += ends[index].carryOverFactor * value;
    });
    for (let index = 0; index < ends.length; index += 1) current[index] += balance[index] + carryOver[index];
    if (cycles.length < RECORDED_CYCLES) cycles.push({ balance, carryOver });
  }
  if (cycleCount > MAX_CYCLES) return undefined;
  return { initial: [...initial], cycles, cycleCount, final: current };
};

interface MemberGeometry {
  member: MemberModel;
  i: NodeModel;
  j: NodeModel;
  length: number;
  cos: number;
  sin: number;
}

/** Extremos de M(x) en una barra, con la corrección lineal de sus momentos de extremo. */
const momentExtremes = (
  segments: readonly { x0: number; x1: number; moment: readonly number[] }[],
  constant: number,
  slope: number,
): { maximum: { x: number; value: number }; minimum: { x: number; value: number } } => {
  let maximum = { x: 0, value: Number.NEGATIVE_INFINITY };
  let minimum = { x: 0, value: Number.POSITIVE_INFINITY };
  for (const segment of segments) {
    const span = segment.x1 - segment.x0;
    const polynomial = [...segment.moment];
    while (polynomial.length < 2) polynomial.push(0);
    polynomial[0] += constant + slope * segment.x0;
    polynomial[1] += slope;
    const candidates = [0, span];
    // p'(ξ) = c1 + 2 c2 ξ + 3 c3 ξ²
    const c1 = polynomial[1] ?? 0;
    const c2 = polynomial[2] ?? 0;
    const c3 = polynomial[3] ?? 0;
    const a = 3 * c3;
    const b = 2 * c2;
    if (Math.abs(a) > 1e-14) {
      const discriminant = b * b - 4 * a * c1;
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        candidates.push((-b + root) / (2 * a), (-b - root) / (2 * a));
      }
    } else if (Math.abs(b) > 1e-14) {
      candidates.push(-c1 / b);
    }
    for (const xi of candidates) {
      if (!(xi >= -1e-12 && xi <= span + 1e-12)) continue;
      const clamped = Math.min(span, Math.max(0, xi));
      const value = evaluate(polynomial, clamped);
      const x = segment.x0 + clamped;
      if (value > maximum.value) maximum = { x, value };
      if (value < minimum.value) minimum = { x, value };
    }
  }
  return { maximum, minimum };
};

/**
 * Términos de fórmula del MEP: carga uniforme en toda la barra (wL²/12) y carga puntual
 * (Pab²/L²), o sus contrapartes de la barra empotrada–articulada (wL²/8 y Pab(L + b)/2L² en el
 * extremo empotrado) cuando un extremo está liberado. Devuelve `undefined` si la barra lleva otra
 * clase de carga — momento, carga parcial, trapecial — y el MEP se queda sólo con el valor del
 * análisis aislado.
 */
const femTermsOf = (
  project: ProjectModel,
  geometry: MemberGeometry,
  factors: Record<string, number>,
  releasedI: boolean,
  releasedJ: boolean,
): CrossFemTerm[] | undefined => {
  // Pinned at both ends: a simply supported member has no end moment, and nothing to print.
  if (releasedI && releasedJ) return [];
  const { member, length: L, cos: c, sin: s } = geometry;
  const transverse = (x: number, y: number, system: 'global' | 'local'): number => (system === 'local' ? y : -s * x + c * y);
  const terms: CrossFemTerm[] = [];
  let uniform = 0;
  const uniformLabels: string[] = [];
  for (const load of project.memberLoads) {
    if (load.memberId !== member.id) continue;
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0) continue;
    if (load.type === 'distributed') {
      const start = Math.min(load.start, load.end);
      const end = Math.max(load.start, load.end);
      const qyStart = transverse(load.qxStart ?? 0, load.qyStart ?? 0, load.coordinateSystem);
      const qyEnd = transverse(load.qxEnd ?? load.qxStart ?? 0, load.qyEnd ?? load.qyStart ?? 0, load.coordinateSystem);
      const basis = load.lengthBasis === 'horizontal' ? Math.abs(c) : load.lengthBasis === 'vertical' ? Math.abs(s) : 1;
      if (Math.abs(qyStart - qyEnd) > 1e-12 * Math.max(1, Math.abs(qyStart))) return undefined;
      if (Math.abs(qyStart) <= 1e-14) continue;
      if (start > 1e-9 || end < 1 - 1e-9) return undefined;
      uniform += -qyStart * basis * factor;
      uniformLabels.push(load.id);
    } else if (load.type === 'point') {
      const P = -transverse(load.px ?? 0, load.py ?? 0, load.coordinateSystem) * factor;
      if (Math.abs(P) <= 1e-14) continue;
      const a = Math.min(1, Math.max(0, load.position ?? 0.5)) * L;
      const b = L - a;
      const [momentI, momentJ] = releasedJ
        ? [(P * a * b * (L + b)) / (2 * L * L), 0]
        : releasedI
          ? [0, -(P * a * b * (L + a)) / (2 * L * L)]
          : [(P * a * b * b) / (L * L), -(P * a * a * b) / (L * L)];
      terms.push({ kind: 'point', label: load.id, value: P, a, momentI, momentJ });
    } else {
      return undefined;
    }
  }
  const selfWeightFactor = project.loadCases.reduce(
    (sum, loadCase) => sum + (factors[loadCase.id] ?? 0) * (loadCase.selfWeightFactor ?? 0),
    0,
  );
  if (selfWeightFactor !== 0 && member.density && member.A > 0) {
    const weight = (member.density * 9.80665 * member.A) / 1000 * selfWeightFactor;
    const w = -transverse(0, -weight, 'global');
    if (Math.abs(w) > 1e-14) {
      uniform += w;
      uniformLabels.push('peso propio');
    }
  }
  if (Math.abs(uniform) > 0) {
    terms.unshift({
      kind: 'uniform',
      label: uniformLabels.join(' + '),
      value: uniform,
      momentI: releasedI ? 0 : (uniform * L * L) / (releasedJ ? 8 : 12),
      momentJ: releasedJ ? 0 : -(uniform * L * L) / (releasedI ? 8 : 12),
    });
  }
  return terms;
};

export const solveMomentDistributionFrame = (
  project: ProjectModel,
  analysis: AnalysisResult,
  combination: LoadCombination | null = null,
  options: CrossFrameOptions = {},
): CrossFrameOutcome => {
  const classification = classifyStructure(project);
  if (project.members.some((member) => member.curve)) return reject('method.rejectedCurvedMember');
  const isBeam = classification.kind === 'simple-beam' || classification.kind === 'continuous-beam';
  if (classification.kind !== 'frame' && !isBeam) return reject('method.rejectedNotFrame');
  if (isBeam && classification.indeterminacy < 1) return reject('method.rejectedStaticallyDeterminate');
  if (!project.members.length) return reject('method.rejectedNotFrame');

  // Moment releases and internal hinges are part of the method (modified stiffness 3EI/L, no
  // carry-over, propped-cantilever fixed-end moments). A truss bar, a rigid link, or a release of
  // axial force or shear is not: the members have to be frame members, continuous in u and v.
  if (project.members.some((member) => (
    member.type !== 'frame'
    || Boolean(member.releases?.iAxial || member.releases?.iShear || member.releases?.jAxial || member.releases?.jShear)
  ))) {
    return reject('method.rejectedContinuityRequired');
  }

  const factors = selectedFactors(project, combination);
  const active = (caseId: string) => (factors[caseId] ?? 0) !== 0;
  const prepared: ProjectModel = { ...withResolvedGeneratedLoads(project), generatedLoadSources: [] };
  if (
    project.members.some((member) => (
      member.beamTheory === 'timoshenko'
      || (member.axialBehavior !== undefined && member.axialBehavior !== 'both')
      || member.rotationalSpringI !== undefined || member.rotationalSpringJ !== undefined
      || Boolean(member.rigidOffsetI) || Boolean(member.rigidOffsetJ)
    ))
    || project.nodes.some((node) => hasTranslationalSpring(node.support) || hasPrescribed(node.support))
    || (project.nodeLinks?.length ?? 0) > 0
    || (project.multiPointConstraints?.length ?? 0) > 0
    || (project.prescribedDisplacements ?? []).some((entry) => active(entry.caseId) && entry.value !== 0)
    || (prepared.memberInitialEffects ?? []).some((effect) => active(effect.caseId))
  ) {
    return reject('method.rejectedModelFeature');
  }
  if (project.settings.analysisMode === 'p-delta' || analysis.pDelta) return reject('method.rejectedSecondOrder');
  if (!analysis.success) return reject('method.rejectedGeometry');

  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  // A pinned end: the member's own moment release, or any end that reaches an internal hinge.
  const releasedAt = (member: MemberModel, end: 'i' | 'j'): boolean => Boolean(
    (end === 'i' ? member.releases?.iMoment : member.releases?.jMoment) || byId.get(end === 'i' ? member.i : member.j)?.internalHinge,
  );
  const geometries: MemberGeometry[] = [];
  for (const member of project.members) {
    const i = byId.get(member.i);
    const j = byId.get(member.j);
    if (!i || !j) return reject('method.rejectedGeometry');
    const length = Math.hypot(j.x - i.x, j.y - i.y);
    if (!(length > 0) || !(member.E * member.I > 0)) return reject('method.rejectedGeometry');
    geometries.push({ member, i, j, length, cos: (j.x - i.x) / length, sin: (j.y - i.y) / length });
  }

  // ---------------------------------------------------------------------------------------
  // Momentos de empotramiento perfecto: la barra aislada, empotrada en sus dos extremos — o
  // articulada en el que esté liberado: un nudo empotrado con la barra liberada en él es un
  // apoyo articulado para esa barra.
  // ---------------------------------------------------------------------------------------
  const isolatedRuns = new Map<string, { localEndForces: number[]; segments: { x0: number; x1: number; moment: number[] }[]; reactionI: { fx: number; fy: number; m: number }; reactionJ: { fx: number; fy: number; m: number } }>();
  for (const { member, i, j } of geometries) {
    const isolated: ProjectModel = {
      ...prepared,
      nodes: [{ ...i, support: { type: 'fixed' }, internalHinge: false }, { ...j, support: { type: 'fixed' }, internalHinge: false }],
      members: [{ ...member, releases: { iMoment: releasedAt(member, 'i'), jMoment: releasedAt(member, 'j') } }],
      memberLoads: prepared.memberLoads.filter((load) => load.memberId === member.id),
      nodalLoads: [],
      prescribedDisplacements: [],
      memberInitialEffects: [],
      nodeLinks: [],
      multiPointConstraints: [],
      nodalMasses: [],
      generatedLoadSources: [],
      movingLoadCases: [],
    };
    const run = analyzeProject(isolated, combination, { includeEducationTrace: false });
    const result = run.success ? run.memberResults.find((entry) => entry.memberId === member.id) : undefined;
    const nodeI = run.nodeResults.find((entry) => entry.nodeId === i.id);
    const nodeJ = run.nodeResults.find((entry) => entry.nodeId === j.id);
    if (!result || !nodeI || !nodeJ || result.localEndForces.length < 6) return reject('method.rejectedGeometry');
    isolatedRuns.set(member.id, {
      localEndForces: result.localEndForces,
      segments: result.diagramSegments.map((segment) => ({ x0: segment.x0, x1: segment.x1, moment: [...segment.moment] })),
      reactionI: { fx: nodeI.rx, fy: nodeI.ry, m: nodeI.rm },
      reactionJ: { fx: nodeJ.rx, fy: nodeJ.ry, m: nodeJ.rm },
    });
  }

  // ---------------------------------------------------------------------------------------
  // Extremos, nudos, rigideces y factores de distribución.
  // ---------------------------------------------------------------------------------------
  const ends: CrossEnd[] = [];
  for (const { member, length } of geometries) {
    const first = ends.length;
    const releasedI = releasedAt(member, 'i');
    const releasedJ = releasedAt(member, 'j');
    // 4EI/L with ½ carried over; 3EI/L and nothing carried when the far end is pinned; nothing at
    // all at a pinned end.
    const end = (released: boolean, farReleased: boolean): Pick<CrossEnd, 'stiffness' | 'stiffnessCoefficient' | 'released' | 'carryOverFactor'> => {
      const stiffnessCoefficient = released ? 0 : farReleased ? 3 : 4;
      return {
        stiffness: (stiffnessCoefficient * member.E * member.I) / length,
        stiffnessCoefficient,
        released,
        carryOverFactor: released || farReleased ? 0 : 0.5,
      };
    };
    ends.push({ memberId: member.id, nodeId: member.i, farNodeId: member.j, end: 'i', ...end(releasedI, releasedJ), distributionFactor: 0, partner: first + 1 });
    ends.push({ memberId: member.id, nodeId: member.j, farNodeId: member.i, end: 'j', ...end(releasedJ, releasedI), distributionFactor: 0, partner: first });
  }
  // A rotational support spring is one more stiffness at its joint: it takes its share of every
  // unbalance and carries nothing over. Its ends follow every member end, so 2m and 2m + 1 are
  // still member m's.
  const memberEndCount = ends.length;
  const connectedIds = new Set(ends.map((entry) => entry.nodeId));
  for (const node of project.nodes) {
    const kr = rotationalSpring(node.support);
    if (!kr || !connectedIds.has(node.id)) continue;
    const index = ends.length;
    ends.push({
      memberId: 'resorte', nodeId: node.id, farNodeId: node.id, end: 'i', stiffness: kr, stiffnessCoefficient: 0,
      released: false, distributionFactor: 0, carryOverFactor: 0, partner: index, spring: true,
    });
  }
  const springPadding = new Array<number>(ends.length - memberEndCount).fill(0);
  const appliedMoment = new Map<string, number>();
  const nodalForce = new Map<string, { fx: number; fy: number }>();
  for (const load of project.nodalLoads) {
    const factor = factors[load.caseId] ?? 0;
    if (factor === 0) continue;
    appliedMoment.set(load.nodeId, (appliedMoment.get(load.nodeId) ?? 0) + factor * (load.mz ?? 0));
    const force = nodalForce.get(load.nodeId) ?? { fx: 0, fy: 0 };
    nodalForce.set(load.nodeId, { fx: force.fx + factor * load.fx, fy: force.fy + factor * load.fy });
  }
  const joints: CrossJoint[] = [];
  for (const node of project.nodes) {
    const endIndices = ends.flatMap((end, index) => (end.nodeId === node.id ? [index] : []));
    if (!endIndices.length) continue;
    const stiffnessSum = endIndices.reduce((sum, index) => sum + ends[index].stiffness, 0);
    const hinged = endIndices.every((index) => ends[index].released);
    // A node where every end is pinned has nothing to balance: its rotation belongs to no member.
    const rotates = !restrainsRotation(node.support) && !hinged && stiffnessSum > 0;
    if (rotates) for (const index of endIndices) ends[index].distributionFactor = ends[index].stiffness / stiffnessSum;
    joints.push({ nodeId: node.id, rotates, hinged, appliedMoment: appliedMoment.get(node.id) ?? 0, endIndices, stiffnessSum });
  }

  const members: CrossMember[] = geometries.map(({ member, length, cos, sin }) => {
    const run = isolatedRuns.get(member.id)!;
    const lef = run.localEndForces;
    const releasedI = releasedAt(member, 'i');
    const releasedJ = releasedAt(member, 'j');
    // A pinned end carries no moment: the isolated run gives round-off there, written as 0.
    const femI = releasedI ? 0 : lef[2];
    const femJ = releasedJ ? 0 : lef[5];
    const femSum = femI + femJ;
    return {
      memberId: member.id,
      nodeI: member.i,
      nodeJ: member.j,
      length,
      EI: member.E * member.I,
      cos,
      sin,
      releasedI,
      releasedJ,
      fixedEndMomentI: femI,
      fixedEndMomentJ: femJ,
      fixedEndReactionI: run.reactionI,
      fixedEndReactionJ: run.reactionJ,
      isostaticShearStart: lef[1] - femSum / length,
      isostaticShearEnd: -lef[4] - femSum / length,
      finalMomentI: 0,
      finalMomentJ: 0,
      shearStart: 0,
      shearEnd: 0,
      spanMaximum: { x: 0, value: 0 },
      spanMinimum: { x: 0, value: 0 },
      rigidMomentI: 0,
      rigidMomentJ: 0,
      solverMomentI: 0,
      solverMomentJ: 0,
    };
  });
  // The textbook formulas are printed only where they reproduce the isolated analysis exactly.
  members.forEach((entry, index) => {
    const terms = femTermsOf(prepared, geometries[index], factors, entry.releasedI, entry.releasedJ);
    if (!terms) return;
    const sumI = terms.reduce((sum, term) => sum + term.momentI, 0);
    const sumJ = terms.reduce((sum, term) => sum + term.momentJ, 0);
    const scale = Math.max(1e-9, Math.abs(entry.fixedEndMomentI), Math.abs(entry.fixedEndMomentJ));
    if (Math.abs(sumI - entry.fixedEndMomentI) <= 1e-7 * scale && Math.abs(sumJ - entry.fixedEndMomentJ) <= 1e-7 * scale) {
      entry.femTerms = terms;
    }
  });

  // ---------------------------------------------------------------------------------------
  // Etapa sin desplazamiento.
  // ---------------------------------------------------------------------------------------
  // Ends 2m and 2m + 1 are member m's i and j ends, in that order, throughout.
  const loadFem = [...members.flatMap((member) => [member.fixedEndMomentI, member.fixedEndMomentJ]), ...springPadding];
  const nonSway = distribute(ends, joints, loadFem, (joint) => joint.appliedMoment);
  if (!nonSway) return reject('method.rejectedNotConverged');

  // ---------------------------------------------------------------------------------------
  // Modos de desplazamiento: espacio nulo de la inextensibilidad y de los apoyos.
  // ---------------------------------------------------------------------------------------
  const jointIds = new Set(joints.map((joint) => joint.nodeId));
  const connected = project.nodes.filter((node) => jointIds.has(node.id));
  const position = new Map(connected.map((node, index) => [node.id, index]));
  const count = connected.length;
  // Columns: every uy first, then every ux, so that the free variables — the ones a mode is
  // normalised on — are horizontal translations whenever the geometry allows it.
  const uyColumn = (nodeId: string) => position.get(nodeId)!;
  const uxColumn = (nodeId: string) => count + position.get(nodeId)!;
  const constraintRows: number[][] = [];
  for (const { member, cos, sin } of geometries) {
    const row = new Array<number>(2 * count).fill(0);
    row[uxColumn(member.j)] += cos;
    row[uyColumn(member.j)] += sin;
    row[uxColumn(member.i)] -= cos;
    row[uyColumn(member.i)] -= sin;
    constraintRows.push(row);
  }
  for (const node of connected) {
    for (const [cx, cy] of supportRows(node.support)) {
      const row = new Array<number>(2 * count).fill(0);
      row[uxColumn(node.id)] = cx;
      row[uyColumn(node.id)] = cy;
      constraintRows.push(row);
    }
  }
  let unitModes = nullSpace(constraintRows, 2 * count);
  if (unitModes.length > MAX_SWAY_MODES) return reject('method.rejectedTooManySwayModes');

  // An orthogonal storey frame reads best in storey drifts: mode s moves every level from s
  // up by the same amount, so only the columns of storey s turn and its virtual-work equation
  // is that storey's shear equation.
  let storeys: CrossSwayMode['storey'][] | undefined;
  const grid = unitModes.length ? buildFrameGrid(project, { allowReleases: true }) : undefined;
  if (grid && unitModes.length === grid.storyLevels.length - 1) {
    const drifts: number[][] = [];
    const storeyInfo: NonNullable<CrossSwayMode['storey']>[] = [];
    for (let level = 1; level < grid.storyLevels.length; level += 1) {
      const vector = new Array<number>(2 * count).fill(0);
      const nodeIds: string[] = [];
      for (const line of grid.nodeGrid) {
        for (let s = level; s < line.length; s += 1) {
          vector[uxColumn(line[s])] = 1;
          nodeIds.push(line[s]);
        }
      }
      drifts.push(vector);
      storeyInfo.push({
        level,
        height: grid.storyLevels[level] - grid.storyLevels[level - 1],
        columnIds: grid.columns.map((line) => line[level]?.memberId).filter((id): id is string => Boolean(id)),
        nodeIds,
      });
    }
    const compatible = drifts.every((vector) => constraintRows.every((row) => (
      Math.abs(row.reduce((sum, value, index) => sum + value * vector[index], 0)) <= 1e-9
    )));
    if (compatible) {
      unitModes = drifts;
      storeys = storeyInfo;
    }
  }

  const translationOf = (vector: readonly number[], nodeId: string) => ({
    ux: vector[uxColumn(nodeId)] ?? 0,
    uy: vector[uyColumn(nodeId)] ?? 0,
  });
  const chordRotation = (vector: readonly number[], geometry: MemberGeometry): number => {
    const ui = translationOf(vector, geometry.member.i);
    const uj = translationOf(vector, geometry.member.j);
    // n = e rotated +90°: (−sin, cos).
    return ((uj.ux - ui.ux) * -geometry.sin + (uj.uy - ui.uy) * geometry.cos) / geometry.length;
  };

  const referenceSwayMoment = options.referenceSwayMoment ?? DEFAULT_REFERENCE_SWAY_MOMENT;
  const modes: CrossSwayMode[] = [];
  const unitRotations: number[][] = [];
  for (const [index, vector] of unitModes.entries()) {
    const psi = geometries.map((geometry) => chordRotation(vector, geometry));
    unitRotations.push(psi);
    // −6EIψ/L at both ends of a continuous member; −3EIψ/L at the continuous end of a member
    // pinned at the other, 0 at the pinned end. Ends 2m and 2m + 1 again.
    const unitFem = geometries.flatMap((geometry, m) => {
      const [endI, endJ] = [ends[2 * m], ends[2 * m + 1]];
      const both = endI.stiffnessCoefficient === 4 && endJ.stiffnessCoefficient === 4;
      const value = (coefficient: number) => (coefficient === 0 ? 0 : -((both ? 6 : 3) * geometry.member.E * geometry.member.I * psi[m]) / geometry.length);
      return [value(endI.stiffnessCoefficient), value(endJ.stiffnessCoefficient)];
    }).concat(springPadding);
    const largest = Math.max(0, ...unitFem.map((value) => Math.abs(value)));
    if (!(largest > 0)) return reject('method.rejectedGeometry');
    const delta = referenceSwayMoment / largest;
    const swayFem = unitFem.map((value) => value * delta);
    const distribution = distribute(ends, joints, swayFem, () => 0);
    if (!distribution) return reject('method.rejectedNotConverged');
    modes.push({
      index,
      translations: connected
        .map((node) => {
          const t = translationOf(vector, node.id);
          return { nodeId: node.id, ux: t.ux * delta, uy: t.uy * delta };
        })
        .filter((entry) => entry.ux !== 0 || entry.uy !== 0),
      assumedDisplacement: delta,
      chordRotations: geometries
        .map((geometry, m) => ({ memberId: geometry.member.id, psi: psi[m] * delta }))
        .filter((entry) => Math.abs(entry.psi) > 0),
      storey: storeys?.[index],
      distribution,
    });
  }

  // ---------------------------------------------------------------------------------------
  // Ecuaciones de trabajo virtual (o de cortante de entrepiso) y superposición.
  // ---------------------------------------------------------------------------------------
  const momentSumTerm = (state: readonly number[], psi: readonly number[]): number => geometries.reduce(
    (sum, _geometry, m) => sum + (state[2 * m] + state[2 * m + 1]) * psi[m],
    0,
  );
  const equations: CrossSwayEquation[] = unitModes.map((vector, k) => {
    const psi = unitRotations[k];
    const memberLoadTerm = members.reduce((sum, member, m) => {
      const ui = translationOf(vector, member.nodeI);
      const uj = translationOf(vector, member.nodeJ);
      const work = member.fixedEndReactionI.fx * ui.ux + member.fixedEndReactionI.fy * ui.uy
        + member.fixedEndReactionJ.fx * uj.ux + member.fixedEndReactionJ.fy * uj.uy
        + (member.fixedEndReactionI.m + member.fixedEndReactionJ.m) * psi[m];
      return sum - work;
    }, 0);
    const nodalLoadTerm = connected.reduce((sum, node) => {
      const force = nodalForce.get(node.id);
      if (!force) return sum;
      const t = translationOf(vector, node.id);
      return sum + force.fx * t.ux + force.fy * t.uy;
    }, 0);
    return {
      nonSwayMomentTerm: momentSumTerm(nonSway.final, psi),
      memberLoadTerm,
      nodalLoadTerm,
      coefficients: modes.map((mode) => momentSumTerm(mode.distribution.final, psi)),
    };
  });

  let swayFactors: number[] = [];
  if (modes.length) {
    try {
      swayFactors = solveLinearSystem(
        equations.map((equation) => [...equation.coefficients]),
        equations.map((equation) => -(equation.nonSwayMomentTerm + equation.memberLoadTerm + equation.nodalLoadTerm)),
      ).x;
    } catch {
      return reject('method.rejectedGeometry');
    }
    if (swayFactors.some((value) => !Number.isFinite(value))) return reject('method.rejectedGeometry');
  }
  const final = nonSway.final.map((value, index) => (
    value + modes.reduce((sum, mode, k) => sum + swayFactors[k] * mode.distribution.final[index], 0)
  ));

  // ---------------------------------------------------------------------------------------
  // Cada barra por secciones: cortantes de extremo y momento máximo.
  // ---------------------------------------------------------------------------------------
  members.forEach((member, m) => {
    const mi = final[2 * m];
    const mj = final[2 * m + 1];
    member.finalMomentI = mi;
    member.finalMomentJ = mj;
    const correction = (mi + mj) / member.length;
    member.shearStart = member.isostaticShearStart + correction;
    member.shearEnd = member.isostaticShearEnd + correction;
    // M(x) = M_ff(x) + (MEP_i − M_i) + [(M_i + M_j) − (MEP_i + MEP_j)]·x/L, with M_ff the
    // isolated fixed–fixed diagram (whose own ends are −MEP_i and MEP_j).
    const run = isolatedRuns.get(member.memberId)!;
    const extremes = momentExtremes(
      run.segments,
      member.fixedEndMomentI - mi,
      (mi + mj - member.fixedEndMomentI - member.fixedEndMomentJ) / member.length,
    );
    member.spanMaximum = extremes.maximum;
    member.spanMinimum = extremes.minimum;
  });

  // ---------------------------------------------------------------------------------------
  // Verificación: referencia axialmente rígida, y el análisis real.
  // ---------------------------------------------------------------------------------------
  const rigidProject: ProjectModel = {
    ...prepared,
    members: prepared.members.map((member) => ({
      ...member,
      A: member.A * AXIAL_STIFFNESS_FACTOR,
      // Self-weight is ρ·g·A: dividing ρ keeps every load exactly as it was.
      ...(member.density === undefined ? {} : { density: member.density / AXIAL_STIFFNESS_FACTOR }),
    })),
  };
  const rigid = analyzeProject(rigidProject, combination, { includeEducationTrace: false });
  if (!rigid.success) return reject('method.rejectedGeometry');
  let rigidResidual = 0;
  let referenceMoment = 0;
  let solverResidual = 0;
  let solverReferenceMoment = 0;
  for (const member of members) {
    const rigidResult = rigid.memberResults.find((entry) => entry.memberId === member.memberId);
    const solverResult = analysis.memberResults.find((entry) => entry.memberId === member.memberId);
    if (!rigidResult || !solverResult) return reject('method.rejectedGeometry');
    member.rigidMomentI = rigidResult.localEndForces[2];
    member.rigidMomentJ = rigidResult.localEndForces[5];
    member.solverMomentI = solverResult.localEndForces[2];
    member.solverMomentJ = solverResult.localEndForces[5];
    rigidResidual = Math.max(rigidResidual, Math.abs(member.finalMomentI - member.rigidMomentI), Math.abs(member.finalMomentJ - member.rigidMomentJ));
    referenceMoment = Math.max(referenceMoment, Math.abs(member.rigidMomentI), Math.abs(member.rigidMomentJ));
    solverResidual = Math.max(solverResidual, Math.abs(member.finalMomentI - member.solverMomentI), Math.abs(member.finalMomentJ - member.solverMomentJ));
    solverReferenceMoment = Math.max(solverReferenceMoment, Math.abs(member.solverMomentI), Math.abs(member.solverMomentJ));
  }
  // A spring's moment is the support's reaction, reversed: it has to be the rigid run's too.
  const springs: CrossSpring[] = [];
  for (const [endIndex, entry] of ends.entries()) {
    if (!entry.spring) continue;
    const rigidNode = rigid.nodeResults.find((result) => result.nodeId === entry.nodeId);
    const solverNode = analysis.nodeResults.find((result) => result.nodeId === entry.nodeId);
    if (!rigidNode || !solverNode) return reject('method.rejectedGeometry');
    const moment = final[endIndex]!;
    springs.push({
      nodeId: entry.nodeId, stiffness: entry.stiffness, endIndex, moment, rotation: moment / entry.stiffness,
      rigidReaction: rigidNode.rm, solverReaction: solverNode.rm,
    });
    rigidResidual = Math.max(rigidResidual, Math.abs(-moment - rigidNode.rm));
    solverResidual = Math.max(solverResidual, Math.abs(-moment - solverNode.rm));
  }
  if (!(rigidResidual <= RIGID_TOLERANCE * Math.max(referenceMoment, 1e-6))) return reject('method.rejectedRigidMismatch');

  return {
    applicable: true,
    classification,
    members,
    ends,
    joints,
    nonSway,
    modes,
    equations,
    swayFactors,
    storeyForm: Boolean(storeys) && modes.length > 0,
    final,
    springs,
    verification: {
      axialStiffnessFactor: AXIAL_STIFFNESS_FACTOR,
      rigidResidual,
      referenceMoment,
      solverResidual,
      solverReferenceMoment,
    },
  };
};
